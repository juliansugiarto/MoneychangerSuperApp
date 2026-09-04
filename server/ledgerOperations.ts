import Decimal from "decimal.js";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  accountingPeriods,
  cashBalanceMovements,
  cashBalances,
  chartOfAccounts,
  currencies,
  journalEntries,
  journalEntryLines,
  type journalSourceTypes,
} from "../drizzle/schema";
import { CHART_OF_ACCOUNTS, findAccount, type AccountType } from "../shared/chartOfAccounts";
import {
  accountBalance,
  assertJournalIsPostable,
  buildTrialBalance,
  calendarDay,
  formatAmount,
  isoDay,
  monthEndIso,
  monthStartIso,
  oppositeSide,
  parseAmount,
  reconcileCash,
  type JournalSide,
} from "../shared/ledger";
import { CASH_ACCOUNT } from "../shared/journalMapping";
import { databaseOrThrow, jakartaBusinessDate, retryTransientDatabaseRead, writeAudit } from "./operations";

type JournalSourceType = (typeof journalSourceTypes)[number];

export type JournalLineInput = {
  accountCode: string;
  side: JournalSide;
  amount: string;
  currencyCode?: string;
  foreignAmount?: string;
  memo?: string;
  branchId?: number;
};

/**
 * Tanggal pada buku besar adalah hari kalender, bukan saat — dan dua representasi berikut sengaja
 * dipisahkan tegas, karena mencampurnya melahirkan kesalahan yang hanya muncul di batas periode.
 *
 * - Dibaca dari basis data, kolom `date` kembali sebagai `Date` tengah malam UTC, sehingga
 *   `toISOString()` menghasilkan hari yang benar.
 * - Dikirim ke basis data, `Date` diformat memakai zona waktu proses. `Date` tengah malam UTC akan
 *   terkirim sebagai "2026-09-01 07:00:00" di GMT+7, dan pembanding `entryDate >= ...` menyingkirkan
 *   jurnal 1 September dari laporan September itu sendiri. Karena itu setiap tanggal yang dikirim
 *   dinormalkan lebih dulu ke tengah malam waktu lokal pada hari yang dimaksud.
 *
 * Aritmetika bulan selalu dikerjakan atas teks "YYYY-MM-DD", tidak pernah atas getter UTC sebuah
 * tanggal tengah malam lokal — itulah campuran yang membuat 1 September jatuh ke periode Agustus.
 */
/** Tanggal siap kirim: tengah malam waktu lokal pada hari kalender yang dimaksud. */
const dbDate = (value: Date | string) => new Date(`${calendarDay(value)}T00:00:00`);

/** Hari sebelum sebuah tanggal, dihitung atas teks harinya agar tidak bergantung jam maupun zona. */
const previousDayIso = (value: Date | string) =>
  new Date(new Date(`${isoDay(value)}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Bagan akun
// ---------------------------------------------------------------------------

/**
 * Menyemai bagan akun dari `shared/chartOfAccounts.ts`.
 *
 * Idempoten dan tidak pernah menghapus: akun yang hilang dari definisi tetap tinggal di basis data
 * karena mungkin sudah dipakai baris jurnal, dan menghapusnya akan memutus penelusuran pos laporan
 * ke buku besarnya — persis yang menjadi temuan pemeriksaan.
 */
export async function ensureChartOfAccounts(actor?: { id: number }) {
  const db = await databaseOrThrow();
  const existing = await db.select().from(chartOfAccounts);
  const byCode = new Map(existing.map((row) => [row.code, row]));

  const rowFor = (account: (typeof CHART_OF_ACCOUNTS)[number]) => ({
    name: account.name,
    type: account.type,
    normalBalance: account.normalBalance,
    isContra: account.contra === true,
    forms: account.forms,
  });

  const missing = CHART_OF_ACCOUNTS.filter((account) => !byCode.has(account.code));
  if (missing.length) {
    await db.insert(chartOfAccounts).values(missing.map((account) => ({ code: account.code, ...rowFor(account) })));
  }

  const changed: { code: string; before: unknown; after: unknown }[] = [];
  for (const account of CHART_OF_ACCOUNTS) {
    const current = byCode.get(account.code);
    if (!current) continue;
    const values = rowFor(account);
    const unchanged =
      current.name === values.name &&
      current.type === values.type &&
      current.normalBalance === values.normalBalance &&
      current.isContra === values.isContra &&
      JSON.stringify(current.forms) === JSON.stringify(values.forms);
    if (unchanged) continue;
    await db.update(chartOfAccounts).set(values).where(eq(chartOfAccounts.id, current.id));
    changed.push({
      code: account.code,
      before: { name: current.name, type: current.type, normalBalance: current.normalBalance, isContra: current.isContra },
      after: { name: values.name, type: values.type, normalBalance: values.normalBalance, isContra: values.isContra },
    });
  }

  // Akun yang sudah dipakai baris jurnal dapat berubah di sini, dan mengubah `normalBalance`
  // membalik tanda seluruh saldo historis akun itu. Perubahan sebesar itu harus terbaca di jejak
  // audit, bukan hanya di riwayat kode.
  if (actor && (missing.length || changed.length)) {
    await writeAudit({
      actorUserId: actor.id,
      action: "CHART_OF_ACCOUNTS_SEEDED",
      entityType: "chart_of_accounts",
      entityId: "*",
      afterState: { inserted: missing.map((account) => account.code), changed },
    });
  }
  return { inserted: missing.length, updated: changed.length, total: CHART_OF_ACCOUNTS.length };
}

export async function listAccounts() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(chartOfAccounts).orderBy(asc(chartOfAccounts.code));
  });
}

// ---------------------------------------------------------------------------
// Periode pembukuan
// ---------------------------------------------------------------------------

export async function listAccountingPeriods() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const rows = await db.select().from(accountingPeriods).orderBy(desc(accountingPeriods.periodStart));
    return rows.map((row) => ({
      ...row,
      periodStart: calendarDay(row.periodStart),
      periodEnd: calendarDay(row.periodEnd),
    }));
  });
}

/**
 * Periode yang memuat sebuah tanggal, dibuat otomatis sebagai periode bulanan bila belum ada.
 *
 * Pembuatan otomatis tidak melemahkan penguncian: periode yang sudah ditutup tetap ditemukan dan
 * tetap menolak jurnal baru. Yang dihindari hanyalah pengguna terhalang mencatat jurnal pertama
 * hanya karena belum sempat membuat periodenya.
 */
async function periodForDate(db: Awaited<ReturnType<typeof databaseOrThrow>>, entryDate: Date, actorUserId: number) {
  const day = dbDate(entryDate);
  const [existing] = await db
    .select()
    .from(accountingPeriods)
    .where(and(lte(accountingPeriods.periodStart, day), gte(accountingPeriods.periodEnd, day)))
    .limit(1);
  if (existing) return existing;

  // Dua pencatatan jurnal pertama pada bulan yang sama dapat sama-sama mendapati periodenya belum
  // ada. Yang kalah menerima pelanggaran indeks unik — itu bukan galat yang perlu sampai ke
  // pengguna, cukup baca ulang periode yang baru saja dibuat pihak lain.
  try {
    await db.insert(accountingPeriods).values({
      periodStart: dbDate(monthStartIso(entryDate)),
      periodEnd: dbDate(monthEndIso(entryDate)),
      createdByUserId: actorUserId,
    });
  } catch (error) {
    if (!isDuplicateKeyFor(error, "accounting_periods_range_uq")) throw error;
  }

  const [created] = await db
    .select()
    .from(accountingPeriods)
    .where(and(lte(accountingPeriods.periodStart, day), gte(accountingPeriods.periodEnd, day)))
    .limit(1);
  if (!created) throw new Error("Periode pembukuan untuk tanggal tersebut tidak dapat dibuat.");
  return created;
}

export async function closeAccountingPeriod(input: { periodId: number; notes?: string }, actor: { id: number }) {
  const db = await databaseOrThrow();
  const [period] = await db.select().from(accountingPeriods).where(eq(accountingPeriods.id, input.periodId));
  if (!period) throw new Error("Periode pembukuan tidak ditemukan.");
  if (period.status === "DITUTUP") throw new Error("Periode ini sudah ditutup.");

  // Menutup periode berarti mengunci angkanya; lebih baik gagal di sini daripada di hadapan
  // pemeriksa. Yang diperiksa adalah keutuhan tiap jurnalnya, bukan keseimbangan neraca saldo —
  // yang terakhir tidak pernah gagal selama tiap jurnal disimpan lewat aplikasi ini.
  const integrity = await verifyLedgerIntegrity({ from: period.periodStart, to: period.periodEnd });
  if (integrity.problems.length) {
    const detail = integrity.problems.slice(0, 3).map((problem) => `${problem.entryNumber} (${problem.problem})`).join(", ");
    throw new Error(`Periode tidak dapat ditutup: ${integrity.problems.length} jurnal tidak utuh — ${detail}.`);
  }

  // Mengunci tanpa menilai adalah keadaan yang berlaku sampai paket C, dan justru itu yang membuat
  // 1-1210 Kas UKA nol selamanya. Penilaian karena itu menjadi syarat, bukan anjuran. Diperiksa
  // **setelah** keutuhan jurnal: jurnal yang tidak utuh masalah yang lebih besar, dan pesannyalah
  // yang harus sampai lebih dulu.
  // Penyusutan lebih dulu daripada penilaian: ia mengubah laba periode ini, sementara penilaian
  // persediaan tidak bergantung padanya. Bulan yang terlupa membuat laba berlebih persis sebesar
  // penyusutan yang tidak pernah dibebankan, dan tidak ada satu pun laporan yang menolaknya.
  if (!period.depreciationPostedAt) {
    throw new Error(
      "Periode tidak dapat ditutup: penyusutan aset tetap belum dijurnal. Jalankan penyusutan bulanan pada panel Periode lebih dulu.",
    );
  }
  if (!period.valuationPostedAt) {
    throw new Error(
      "Periode tidak dapat ditutup: penilaian persediaan akhir UKA belum dijalankan. Jalankan penilaian pada panel Penutupan Periode lebih dulu.",
    );
  }
  if (calendarDay(period.periodEnd).slice(5) === "12-31" && !period.profitClosingPostedAt) {
    throw new Error("Periode Desember tidak dapat ditutup: jurnal penutup laba ke Laba Ditahan belum dijalankan.");
  }

  const closedAt = new Date();
  await db
    .update(accountingPeriods)
    .set({ status: "DITUTUP", closedByUserId: actor.id, closedAt, closingNotes: input.notes?.trim() || null })
    .where(eq(accountingPeriods.id, input.periodId));

  await writeAudit({
    actorUserId: actor.id,
    action: "ACCOUNTING_PERIOD_CLOSED",
    entityType: "accounting_periods",
    entityId: String(input.periodId),
    beforeState: { status: period.status },
    afterState: { status: "DITUTUP", closedAt },
  });
  return { id: input.periodId };
}

export async function reopenAccountingPeriod(input: { periodId: number; reason: string }, actor: { id: number }) {
  const reason = input.reason.trim();
  // Membuka kembali periode yang sudah ditutup adalah tindakan yang harus terbaca di jejak audit
  // beserta alasannya; tanpa alasan, yang tersisa hanyalah angka yang berubah tanpa keterangan.
  if (reason.length < 5) throw new Error("Sebutkan alasan membuka kembali periode yang sudah ditutup.");

  const db = await databaseOrThrow();
  const [period] = await db.select().from(accountingPeriods).where(eq(accountingPeriods.id, input.periodId));
  if (!period) throw new Error("Periode pembukuan tidak ditemukan.");
  if (period.status !== "DITUTUP") throw new Error("Periode ini sedang terbuka.");

  // Alasan pembukaan ditambahkan, bukan menimpa: catatan yang dibuat saat periode ditutup adalah
  // keterangan atas angka yang sudah dikunci, dan menghapusnya menghilangkan konteks itu selamanya.
  const closingNotes = [period.closingNotes, `Dibuka kembali ${isoDay(new Date())}: ${reason}`]
    .filter(Boolean)
    .join("\n");

  await db
    .update(accountingPeriods)
    .set({ status: "TERBUKA", closedByUserId: null, closedAt: null, closingNotes })
    .where(eq(accountingPeriods.id, input.periodId));

  await writeAudit({
    actorUserId: actor.id,
    action: "ACCOUNTING_PERIOD_REOPENED",
    entityType: "accounting_periods",
    entityId: String(input.periodId),
    beforeState: { status: period.status, closedAt: period.closedAt, closingNotes: period.closingNotes },
    afterState: { status: "TERBUKA", reason },
  });
  return { id: input.periodId };
}

// ---------------------------------------------------------------------------
// Jurnal
// ---------------------------------------------------------------------------

/**
 * Nomor jurnal berurutan per bulan (JU-YYYYMM-0001).
 *
 * Nomor berurutan dipakai, bukan acak, karena pemeriksa membaca buku besar sebagai daftar bernomor
 * dan lompatan nomor adalah pertanyaan pertama yang diajukan. Tabrakan nomor karena dua pencatatan
 * bersamaan tertahan indeks unik dan dicoba ulang, bukan diam-diam menimpa.
 */
async function nextEntryNumber(db: Awaited<ReturnType<typeof databaseOrThrow>>, entryDate: Date) {
  const prefix = `JU-${calendarDay(entryDate).slice(0, 7).replace("-", "")}-`;
  // Urutan dihitung numerik, bukan menurut teks: setelah jurnal ke-9999 dalam sebulan, "10000"
  // lebih kecil daripada "9999" secara teks dan nomor akan berhenti bertambah.
  const [row] = await db
    .select({ latest: sql<number | null>`MAX(CAST(SUBSTRING(${journalEntries.entryNumber}, ${prefix.length + 1}) AS UNSIGNED))` })
    .from(journalEntries)
    .where(sql`${journalEntries.entryNumber} LIKE ${`${prefix}%`}`);
  const sequence = (Number(row?.latest ?? 0) || 0) + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

/**
 * Apakah galat ini pelanggaran indeks unik tertentu?
 *
 * Nama indeksnya hanya muncul pada `sqlMessage` di rantai `cause`, bukan pada pesan luar
 * DrizzleQueryError yang isinya kueri beserta seluruh nama kolom — mencocokkan pesan luar akan
 * menganggap hampir setiap kegagalan insert sebagai tabrakan nomor.
 */
function isDuplicateKeyFor(error: unknown, indexName: string) {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const record = current as { code?: unknown; sqlMessage?: unknown; cause?: unknown };
    if (record.code === "ER_DUP_ENTRY" && typeof record.sqlMessage === "string" && record.sqlMessage.includes(indexName)) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

async function insertJournal(
  db: Awaited<ReturnType<typeof databaseOrThrow>>,
  input: {
    entryDate: Date;
    description: string;
    sourceType: JournalSourceType;
    sourceReference: string | null;
    branchId: number | null;
    lines: JournalLineInput[];
    reversesEntryId?: number | null;
    reversalReason?: string | null;
  },
  actor: { id: number },
) {
  const summary = assertJournalIsPostable(input.lines.map((line) => ({ accountCode: line.accountCode, side: line.side, amount: line.amount })));

  const codes = [...new Set(input.lines.map((line) => line.accountCode))];
  const known = await db.select().from(chartOfAccounts).where(inArray(chartOfAccounts.code, codes));
  const knownByCode = new Map(known.map((row) => [row.code, row]));
  for (const code of codes) {
    const account = knownByCode.get(code);
    if (!account) throw new Error(`Akun ${code} tidak ada pada bagan akun.`);
    if (!account.isActive) throw new Error(`Akun ${code} sudah tidak aktif dan tidak dapat dijurnal.`);
  }

  const period = await periodForDate(db, input.entryDate, actor.id);
  if (period.status === "DITUTUP") {
    throw new Error(
      `Periode ${calendarDay(period.periodStart)} s.d. ${calendarDay(period.periodEnd)} sudah ditutup; catat koreksinya sebagai jurnal balik pada periode terbuka.`,
    );
  }

  const postedAt = new Date();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const entryNumber = await nextEntryNumber(db, input.entryDate);
    try {
      await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(journalEntries).values({
          entryNumber,
          entryDate: dbDate(input.entryDate),
          description: input.description.trim(),
          sourceType: input.sourceType,
          sourceReference: input.sourceReference,
          branchId: input.branchId,
          totalDebit: formatAmount(summary.totalDebit),
          totalCredit: formatAmount(summary.totalCredit),
          reversesEntryId: input.reversesEntryId ?? null,
          reversalReason: input.reversalReason ?? null,
          postedByUserId: actor.id,
          postedAt,
        }).$returningId();

        await tx.insert(journalEntryLines).values(
          input.lines.map((line, position) => ({
            entryId: inserted.id,
            lineNumber: position + 1,
            accountCode: line.accountCode,
            side: line.side,
            amount: formatAmount(parseAmount(line.amount)),
            currencyCode: line.currencyCode?.toUpperCase() || null,
            foreignAmount: line.foreignAmount ?? null,
            branchId: line.branchId ?? input.branchId,
            memo: line.memo?.trim() || null,
          })),
        );
      });

      const [saved] = await db.select().from(journalEntries).where(eq(journalEntries.entryNumber, entryNumber)).limit(1);
      if (!saved) throw new Error("Jurnal tidak dapat dibaca kembali setelah disimpan.");
      return saved;
    } catch (error) {
      // Sumber yang sama sudah pernah dijurnal — inilah sifat idempoten yang sengaja dibangun,
      // dan pesannya harus terbaca manusia, bukan kueri SQL mentah dari driver.
      if (isDuplicateKeyFor(error, "journal_entries_source_uq")) {
        throw new Error(`${input.sourceType} ${input.sourceReference} sudah pernah dijurnal; tidak dijurnal ulang.`);
      }
      // Hanya tabrakan nomor jurnal yang layak dicoba ulang: pencatatan lain merebut nomor itu
      // lebih dulu.
      if (!isDuplicateKeyFor(error, "journal_entries_number_uq")) throw error;
    }
  }
  throw new Error(
    `Nomor jurnal untuk ${isoDay(input.entryDate)} tidak dapat dialokasikan setelah tiga percobaan; coba ulangi pencatatan ini.`,
  );
}

export async function postJournalEntry(
  input: {
    entryDate: Date;
    description: string;
    lines: JournalLineInput[];
    sourceType?: JournalSourceType;
    sourceReference?: string;
    branchId?: number;
  },
  actor: { id: number },
) {
  const db = await databaseOrThrow();
  const entry = await insertJournal(
    db,
    {
      entryDate: input.entryDate,
      description: input.description,
      sourceType: input.sourceType ?? "MANUAL",
      sourceReference: input.sourceReference?.trim() || null,
      branchId: input.branchId ?? null,
      lines: input.lines,
    },
    actor,
  );

  await writeAudit({
    actorUserId: actor.id,
    action: "JOURNAL_ENTRY_POSTED",
    entityType: "journal_entries",
    entityId: String(entry.id),
    afterState: {
      entryNumber: entry.entryNumber,
      entryDate: entry.entryDate,
      sourceType: entry.sourceType,
      totalDebit: entry.totalDebit,
    },
  });
  return entry;
}

/**
 * Jurnal balik: satu-satunya cara mengoreksi jurnal yang sudah tersimpan.
 *
 * Baris jurnal tidak pernah diubah maupun dihapus, sehingga buku besar yang ditunjukkan kepada
 * pemeriksa memuat kekeliruannya sekaligus perbaikannya — bukan hanya hasil akhir yang rapi.
 */
export async function reverseJournalEntry(
  input: { entryId: number; reason: string; entryDate?: Date },
  actor: { id: number },
) {
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Sebutkan alasan koreksi pada jurnal balik.");

  const db = await databaseOrThrow();
  const [original] = await db.select().from(journalEntries).where(eq(journalEntries.id, input.entryId));
  if (!original) throw new Error("Jurnal tidak ditemukan.");

  const [alreadyReversed] = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.reversesEntryId, input.entryId))
    .limit(1);
  if (alreadyReversed) throw new Error(`Jurnal ini sudah dibalik oleh ${alreadyReversed.entryNumber}.`);
  if (original.reversesEntryId) throw new Error("Jurnal balik tidak dapat dibalik lagi; catat jurnal baru bila perlu.");

  const lines = await db
    .select()
    .from(journalEntryLines)
    .where(eq(journalEntryLines.entryId, input.entryId))
    .orderBy(asc(journalEntryLines.lineNumber));

  const entry = await insertJournal(
    db,
    {
      // Hari operasional WIB, bukan hari UTC: antara pukul 00:00 dan 07:00 WIB, `new Date()` masih
      // hari sebelumnya di UTC — dan bila bulan itu baru ditutup, jurnal baliknya justru ditolak
      // periode tertutup, tepat pada satu-satunya mekanisme untuk mengoreksinya.
      entryDate: input.entryDate ?? jakartaBusinessDate(),
      description: `Koreksi atas ${original.entryNumber}: ${original.description}`,
      sourceType: original.sourceType,
      // Kunci sumber hanya boleh dimiliki jurnal aslinya, supaya penjurnalan otomatis yang
      // dijalankan ulang tetap menganggap sumber tersebut sudah pernah dijurnal.
      sourceReference: null,
      branchId: original.branchId,
      reversesEntryId: original.id,
      reversalReason: reason,
      lines: lines.map((line) => ({
        accountCode: line.accountCode,
        side: oppositeSide(line.side as JournalSide),
        amount: line.amount,
        currencyCode: line.currencyCode ?? undefined,
        foreignAmount: line.foreignAmount ?? undefined,
        memo: line.memo ?? undefined,
        branchId: line.branchId ?? undefined,
      })),
    },
    actor,
  );

  await writeAudit({
    actorUserId: actor.id,
    action: "JOURNAL_ENTRY_REVERSED",
    entityType: "journal_entries",
    entityId: String(original.id),
    beforeState: { entryNumber: original.entryNumber },
    afterState: { reversalEntryNumber: entry.entryNumber, reason },
  });
  return entry;
}

export async function listJournalEntries(input?: { from?: Date; to?: Date; sourceType?: JournalSourceType; limit?: number }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const conditions = [
      input?.from ? gte(journalEntries.entryDate, dbDate(input.from)) : undefined,
      input?.to ? lte(journalEntries.entryDate, dbDate(input.to)) : undefined,
      input?.sourceType ? eq(journalEntries.sourceType, input.sourceType) : undefined,
    ].filter(Boolean);

    const rows = await db
      .select()
      .from(journalEntries)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.id))
      .limit(input?.limit ?? 200);
    if (!rows.length) return [];

    const lines = await db
      .select()
      .from(journalEntryLines)
      .where(inArray(journalEntryLines.entryId, rows.map((row) => row.id)))
      .orderBy(asc(journalEntryLines.entryId), asc(journalEntryLines.lineNumber));

    return rows.map((row) => ({
      ...row,
      entryDate: calendarDay(row.entryDate),
      lines: lines.filter((line) => line.entryId === row.id),
    }));
  });
}

/**
 * Batas rentang dinormalkan di sini dan hanya di sini. Pemanggil menyerahkan tanggal apa adanya —
 * menormalkannya dua kali justru memundurkan batasnya satu hari, karena `dbDate` atas tanggal
 * tengah malam lokal membaca hari kalender UTC-nya yang sudah berbeda.
 */
async function loadLines(from?: Date | string, to?: Date | string, accountCode?: string) {
  const db = await databaseOrThrow();
  const conditions = [
    from ? gte(journalEntries.entryDate, dbDate(from)) : undefined,
    to ? lte(journalEntries.entryDate, dbDate(to)) : undefined,
    accountCode ? eq(journalEntryLines.accountCode, accountCode) : undefined,
  ].filter(Boolean);

  return db
    .select({
      entryId: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      entryDate: journalEntries.entryDate,
      description: journalEntries.description,
      sourceType: journalEntries.sourceType,
      sourceReference: journalEntries.sourceReference,
      accountCode: journalEntryLines.accountCode,
      side: journalEntryLines.side,
      amount: journalEntryLines.amount,
      memo: journalEntryLines.memo,
      lineNumber: journalEntryLines.lineNumber,
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries, eq(journalEntryLines.entryId, journalEntries.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(journalEntries.entryDate), asc(journalEntries.id), asc(journalEntryLines.lineNumber));
}

/**
 * Neraca saldo — dasar penyusunan tiap pos laporan keuangan.
 *
 * Inilah bentuk yang diminta pemeriksa pada temuan 7.1: setiap pos dapat ditelusuri ke akunnya,
 * dan tiap akun ke baris jurnal beserta rujukan sumbernya.
 */
export async function buildTrialBalanceReport(input: { from?: Date; to?: Date }) {
  return retryTransientDatabaseRead(async () => {
    const [priorRows, rows, accounts] = await Promise.all([
      input.from ? loadLines(undefined, previousDayIso(input.from)) : Promise.resolve([]),
      loadLines(input.from, input.to),
      listAccounts(),
    ]);
    const accountsByCode = new Map(accounts.map((account) => [account.code, account]));
    const asTrialLine = (row: { accountCode: string; side: string; amount: string }) => ({
      accountCode: row.accountCode,
      side: row.side as JournalSide,
      amount: parseAmount(row.amount),
    });

    const trial = buildTrialBalance(rows.map(asTrialLine), priorRows.map(asTrialLine));

    return {
      from: input.from ? isoDay(input.from) : null,
      to: input.to ? isoDay(input.to) : null,
      rows: trial.rows.map((row) => {
        const account = accountsByCode.get(row.accountCode) ?? findAccount(row.accountCode);
        const normalBalance = account?.normalBalance ?? "DEBIT";
        return {
          accountCode: row.accountCode,
          accountName: account?.name ?? row.accountCode,
          accountType: (account?.type ?? "ASET") as AccountType,
          forms: (account?.forms ?? []) as string[],
          openingBalance: formatAmount(normalBalance === "DEBIT" ? row.openingBalance : -row.openingBalance),
          totalDebit: formatAmount(row.totalDebit),
          totalCredit: formatAmount(row.totalCredit),
          debitBalance: formatAmount(row.debitBalance),
          creditBalance: formatAmount(row.creditBalance),
          balance: formatAmount(
            accountBalance(normalBalance, row.debitBalance, row.creditBalance),
          ),
        };
      }),
      totalDebit: formatAmount(trial.totalDebit),
      totalCredit: formatAmount(trial.totalCredit),
      difference: formatAmount(trial.totalDebit - trial.totalCredit),
      balanced: trial.balanced,
      entryCount: new Set(rows.map((row) => row.entryId)).size,
    };
  });
}

/**
 * Saldo tiap akun atas sebuah rentang, searah saldo normal akunnya.
 *
 * Tanpa `from` hasilnya kumulatif sejak awal pembukuan — bentuk yang dibutuhkan neraca. Dengan
 * `from`, hasilnya mutasi periode itu saja — bentuk yang dibutuhkan laporan laba rugi.
 */
export async function accountBalancesFor(input: { from?: Date | string; to?: Date | string }) {
  const [rows, accounts] = await Promise.all([loadLines(input.from, input.to), listAccounts()]);
  const normalByCode = new Map(accounts.map((account) => [account.code, account.normalBalance]));

  const totals = new Map<string, { debit: bigint; credit: bigint }>();
  for (const row of rows) {
    const entry = totals.get(row.accountCode) ?? { debit: 0n, credit: 0n };
    if (row.side === "DEBIT") entry.debit += parseAmount(row.amount);
    else entry.credit += parseAmount(row.amount);
    totals.set(row.accountCode, entry);
  }

  return [...totals.entries()].map(([accountCode, entry]) => ({
    accountCode,
    balance: accountBalance(normalByCode.get(accountCode) ?? findAccount(accountCode)?.normalBalance ?? "DEBIT", entry.debit, entry.credit),
  }));
}

/**
 * Pemeriksaan keutuhan buku besar: setiap jurnal harus punya jumlah debit sama dengan kredit, dan
 * jumlah itu harus sama dengan total yang tersimpan pada kepala jurnalnya.
 *
 * Membandingkan jumlah kedua sisi neraca saldo tidak akan pernah gagal — angkanya diturunkan dari
 * saldo bersih tiap akun, sehingga selalu seimbang selama tiap jurnal seimbang, dan `postJournalEntry`
 * sudah menjaminnya saat menyimpan. Yang benar-benar perlu ditangkap adalah baris yang berubah di
 * luar aplikasi: jurnal setengah tersimpan atau baris yang disunting langsung lewat SQL.
 */
export async function verifyLedgerIntegrity(input: { from?: Date; to?: Date }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const conditions = [
      input.from ? gte(journalEntries.entryDate, dbDate(input.from)) : undefined,
      input.to ? lte(journalEntries.entryDate, dbDate(input.to)) : undefined,
    ].filter(Boolean);

    const entries = await db
      .select()
      .from(journalEntries)
      .where(conditions.length ? and(...conditions) : undefined);
    if (!entries.length) return { checked: 0, problems: [] as { entryNumber: string; problem: string }[] };

    const lines = await db
      .select()
      .from(journalEntryLines)
      .where(inArray(journalEntryLines.entryId, entries.map((entry) => entry.id)));

    const problems: { entryNumber: string; problem: string }[] = [];
    for (const entry of entries) {
      const own = lines.filter((line) => line.entryId === entry.id);
      if (own.length < 2) {
        problems.push({ entryNumber: entry.entryNumber, problem: `hanya ${own.length} baris` });
        continue;
      }
      const debit = own.filter((line) => line.side === "DEBIT").reduce((sum, line) => sum + parseAmount(line.amount), 0n);
      const credit = own.filter((line) => line.side === "KREDIT").reduce((sum, line) => sum + parseAmount(line.amount), 0n);
      if (debit !== credit) {
        problems.push({ entryNumber: entry.entryNumber, problem: `debit ${formatAmount(debit)} ≠ kredit ${formatAmount(credit)}` });
      } else if (debit !== parseAmount(entry.totalDebit) || credit !== parseAmount(entry.totalCredit)) {
        problems.push({
          entryNumber: entry.entryNumber,
          problem: `jumlah baris ${formatAmount(debit)} tidak sama dengan total tersimpan ${entry.totalDebit}`,
        });
      }
    }
    return { checked: entries.length, problems };
  });
}

/**
 * Buku besar satu akun: mutasi berurutan beserta saldo berjalannya.
 *
 * Saldo awal dihitung dari seluruh mutasi sebelum tanggal mulai, bukan dianggap nol, supaya buku
 * besar sebulan dapat dibaca sendiri tanpa menjumlah ulang seluruh riwayat.
 */
export async function buildAccountLedger(input: { accountCode: string; from?: Date; to?: Date }) {
  return retryTransientDatabaseRead(async () => {
    const account = (await listAccounts()).find((row) => row.code === input.accountCode);
    const definition = findAccount(input.accountCode);
    if (!account && !definition) throw new Error(`Akun ${input.accountCode} tidak ada pada bagan akun.`);
    const normalBalance = account?.normalBalance ?? definition!.normalBalance;

    const [priorRows, rows] = await Promise.all([
      // Saldo awal dihitung dari seluruh mutasi sampai hari sebelum tanggal mulai.
      input.from ? loadLines(undefined, previousDayIso(input.from), input.accountCode) : Promise.resolve([]),
      loadLines(input.from, input.to, input.accountCode),
    ]);

    let running = priorRows.reduce((sum, row) => {
      const amount = parseAmount(row.amount);
      return row.side === "DEBIT" ? sum + amount : sum - amount;
    }, 0n);
    const openingBalance = normalBalance === "DEBIT" ? running : -running;

    const movements = rows.map((row) => {
      const amount = parseAmount(row.amount);
      running += row.side === "DEBIT" ? amount : -amount;
      return {
        entryId: row.entryId,
        entryNumber: row.entryNumber,
        entryDate: calendarDay(row.entryDate),
        description: row.description,
        sourceType: row.sourceType,
        sourceReference: row.sourceReference,
        memo: row.memo,
        debit: row.side === "DEBIT" ? formatAmount(amount) : "0.00",
        credit: row.side === "KREDIT" ? formatAmount(amount) : "0.00",
        runningBalance: formatAmount(normalBalance === "DEBIT" ? running : -running),
      };
    });

    return {
      accountCode: input.accountCode,
      accountName: account?.name ?? definition!.name,
      accountType: (account?.type ?? definition!.type) as AccountType,
      normalBalance,
      openingBalance: formatAmount(openingBalance),
      closingBalance: formatAmount(normalBalance === "DEBIT" ? running : -running),
      movements,
    };
  });
}

/**
 * Selisih buku besar terhadap kas operasional, dan penjelasannya.
 *
 * 1-1110 memuat seluruh kas Rupiah milik sendiri, sementara `cash_balances.availableAmount` hanya
 * memuat laci — perpindahan ke brankas sengaja tidak dijurnal karena B0002 hanya punya satu baris
 * kas. Selisih keduanya karena itu harus persis sebesar isi brankas. Ditampilkan supaya selisihnya
 * dapat **ditunjukkan**, bukan sekadar ada.
 */
export async function getCashReconciliation(input: { asOf: Date }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const upperBound = new Date(`${isoDay(input.asOf)}T23:59:59`);

    const ledgerRows = await db
      .select({ side: journalEntryLines.side, amount: journalEntryLines.amount })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalEntryLines.entryId))
      .where(and(eq(journalEntryLines.accountCode, CASH_ACCOUNT), lte(journalEntries.entryDate, dbDate(input.asOf))));
    let ledgerCents = 0n;
    for (const row of ledgerRows) ledgerCents += row.side === "DEBIT" ? parseAmount(String(row.amount)) : -parseAmount(String(row.amount));

    const balanceRow = (await db
      .select({ id: cashBalances.id, availableAmount: cashBalances.availableAmount })
      .from(cashBalances)
      .innerJoin(currencies, eq(currencies.id, cashBalances.currencyId))
      .where(eq(currencies.code, "IDR"))
      .limit(1))[0];
    const operationalCents = balanceRow ? parseAmount(new Decimal(String(balanceRow.availableAmount)).toFixed(2)) : 0n;

    let safeCents = 0n;
    if (balanceRow) {
      const safeRows = await db
        .select({ category: cashBalanceMovements.category, amount: cashBalanceMovements.amount })
        .from(cashBalanceMovements)
        .where(and(
          eq(cashBalanceMovements.cashBalanceId, balanceRow.id),
          inArray(cashBalanceMovements.category, ["SAFE_DEPOSIT", "SAFE_WITHDRAWAL"]),
          lte(cashBalanceMovements.createdAt, upperBound),
        ));
      for (const row of safeRows) {
        const cents = parseAmount(new Decimal(String(row.amount)).toFixed(2));
        safeCents += row.category === "SAFE_DEPOSIT" ? cents : -cents;
      }
    }

    const ledgerCashIdr = formatAmount(ledgerCents);
    const operationalCashIdr = formatAmount(operationalCents);
    const safeBalanceIdr = formatAmount(safeCents);
    return {
      asOf: isoDay(input.asOf),
      ledgerCashIdr,
      operationalCashIdr,
      safeBalanceIdr,
      ...reconcileCash({ ledgerCashIdr, operationalCashIdr, safeBalanceIdr }),
    };
  });
}
