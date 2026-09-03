import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  accountingPeriods,
  chartOfAccounts,
  journalEntries,
  journalEntryLines,
  type journalSourceTypes,
} from "../drizzle/schema";
import { CHART_OF_ACCOUNTS, findAccount, type AccountType } from "../shared/chartOfAccounts";
import {
  accountBalance,
  assertJournalIsPostable,
  buildTrialBalance,
  formatAmount,
  isoDay,
  monthEndIso,
  monthStartIso,
  oppositeSide,
  parseAmount,
  type JournalSide,
} from "../shared/ledger";
import { databaseOrThrow, retryTransientDatabaseRead, writeAudit } from "./operations";

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
const dbDate = (value: Date | string) => new Date(`${isoDay(value)}T00:00:00`);

const asIsoDate = isoDay;

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
export async function ensureChartOfAccounts() {
  const db = await databaseOrThrow();
  const existing = await db.select().from(chartOfAccounts);
  const byCode = new Map(existing.map((row) => [row.code, row]));

  let inserted = 0;
  let updated = 0;
  for (const account of CHART_OF_ACCOUNTS) {
    const current = byCode.get(account.code);
    const values = {
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      isContra: account.contra === true,
      forms: account.forms,
    };
    if (!current) {
      await db.insert(chartOfAccounts).values({ code: account.code, ...values });
      inserted += 1;
      continue;
    }
    const unchanged =
      current.name === values.name &&
      current.type === values.type &&
      current.normalBalance === values.normalBalance &&
      current.isContra === values.isContra &&
      JSON.stringify(current.forms) === JSON.stringify(values.forms);
    if (!unchanged) {
      await db.update(chartOfAccounts).set(values).where(eq(chartOfAccounts.id, current.id));
      updated += 1;
    }
  }
  return { inserted, updated, total: CHART_OF_ACCOUNTS.length };
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
      periodStart: asIsoDate(row.periodStart),
      periodEnd: asIsoDate(row.periodEnd),
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

  await db.insert(accountingPeriods).values({
    periodStart: dbDate(monthStartIso(entryDate)),
    periodEnd: dbDate(monthEndIso(entryDate)),
    createdByUserId: actorUserId,
  });
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

  // Menutup periode yang buku besarnya tidak seimbang akan mengunci angka yang tidak dapat
  // dipertanggungjawabkan; lebih baik gagal di sini daripada di hadapan pemeriksa.
  const trial = await buildTrialBalanceReport({ from: period.periodStart, to: period.periodEnd });
  if (!trial.balanced) {
    throw new Error(`Neraca saldo periode ini belum seimbang (selisih ${trial.difference}); periode tidak dapat ditutup.`);
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

  await db
    .update(accountingPeriods)
    .set({ status: "TERBUKA", closedByUserId: null, closedAt: null, closingNotes: reason })
    .where(eq(accountingPeriods.id, input.periodId));

  await writeAudit({
    actorUserId: actor.id,
    action: "ACCOUNTING_PERIOD_REOPENED",
    entityType: "accounting_periods",
    entityId: String(input.periodId),
    beforeState: { status: period.status, closedAt: period.closedAt },
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
  const prefix = `JU-${asIsoDate(entryDate).slice(0, 7).replace("-", "")}-`;
  const [row] = await db
    .select({ latest: sql<string | null>`MAX(${journalEntries.entryNumber})` })
    .from(journalEntries)
    .where(sql`${journalEntries.entryNumber} LIKE ${`${prefix}%`}`);
  const sequence = row?.latest ? Number(row.latest.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
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
      `Periode ${asIsoDate(period.periodStart)} s.d. ${asIsoDate(period.periodEnd)} sudah ditutup; catat koreksinya sebagai jurnal balik pada periode terbuka.`,
    );
  }

  const postedAt = new Date();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const entryNumber = await nextEntryNumber(db, input.entryDate);
    try {
      await db.transaction(async (tx) => {
        await tx.insert(journalEntries).values({
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
        });
        const [entry] = await tx.select().from(journalEntries).where(eq(journalEntries.entryNumber, entryNumber)).limit(1);
        if (!entry) throw new Error("Jurnal tidak dapat disimpan.");

        await tx.insert(journalEntryLines).values(
          input.lines.map((line, position) => ({
            entryId: entry.id,
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
      const message = error instanceof Error ? error.message : String(error);
      // Nomor jurnal direbut pencatatan lain: ambil nomor berikutnya dan ulangi. Tabrakan pada
      // kunci sumber adalah hal berbeda — itu berarti jurnalnya memang sudah ada.
      if (!/entryNumber|journal_entries_number_uq|Duplicate entry/i.test(message)) throw error;
      if (/journal_entries_source_uq/i.test(message)) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Nomor jurnal tidak dapat dialokasikan.");
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
      entryDate: input.entryDate ?? new Date(),
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
      entryDate: asIsoDate(row.entryDate),
      lines: lines.filter((line) => line.entryId === row.id),
    }));
  });
}

async function loadLines(from?: Date, to?: Date, accountCode?: string) {
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
    const [rows, accounts] = await Promise.all([loadLines(input.from, input.to), listAccounts()]);
    const accountsByCode = new Map(accounts.map((account) => [account.code, account]));

    const trial = buildTrialBalance(rows.map((row) => ({ accountCode: row.accountCode, side: row.side as JournalSide, amount: parseAmount(row.amount) })));

    return {
      from: input.from ? asIsoDate(input.from) : null,
      to: input.to ? asIsoDate(input.to) : null,
      rows: trial.rows.map((row) => {
        const account = accountsByCode.get(row.accountCode);
        const definition = findAccount(row.accountCode);
        return {
          accountCode: row.accountCode,
          accountName: account?.name ?? definition?.name ?? row.accountCode,
          accountType: (account?.type ?? definition?.type ?? "ASET") as AccountType,
          forms: (account?.forms ?? definition?.forms ?? []) as string[],
          totalDebit: formatAmount(row.totalDebit),
          totalCredit: formatAmount(row.totalCredit),
          debitBalance: formatAmount(row.debitBalance),
          creditBalance: formatAmount(row.creditBalance),
          balance: formatAmount(
            accountBalance(account?.normalBalance ?? definition?.normalBalance ?? "DEBIT", row.totalDebit, row.totalCredit),
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
      input.from ? loadLines(undefined, new Date(input.from.getTime() - 86_400_000), input.accountCode) : Promise.resolve([]),
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
        entryDate: asIsoDate(row.entryDate),
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
