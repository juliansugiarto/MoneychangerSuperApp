import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import {
  accountingPeriods,
  bankAccountMovements,
  currencies,
  currencyRevaluations,
  journalEntries,
  journalEntryLines,
  rateReferenceSnapshots,
} from "../drizzle/schema";
import * as db from "./db";

/**
 * Skenario menyeluruh paket F1: satu cerita dijalankan dari ujung ke ujung.
 *
 * Uji-uji lain memeriksa satu fungsi sekaligus dengan bacaan yang sudah disiapkan. Yang ini
 * menjalankan penjurnalan mutasi bank valuta asing, revaluasi akhir periode, gerbang penutupan, dan
 * revaluasi bulan berikutnya **di atas satu buku besar yang sama** — sehingga tulisan satu langkah
 * menjadi bacaan langkah berikutnya. Kekeliruan yang hanya muncul saat langkah-langkahnya
 * bersambung tidak terlihat oleh uji per fungsi: nilai tercatat yang dibaca dari sumber berbeda
 * dengan saldo valutanya, atau selisih yang sudah dijurnal ikut terhitung lagi bulan depan.
 *
 * `./ledgerOperations` ditambal hanya pada `postJournalEntry`; `closeAccountingPeriod` yang asli
 * ikut diuji, termasuk pemeriksaan keutuhan jurnal atas jurnal yang benar-benar tercatat di sini.
 */
vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, postJournalEntry: vi.fn() };
});
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { closeAccountingPeriod, postJournalEntry } from "./ledgerOperations";
import { writeAudit } from "./operations";
import { postBankMovements } from "./ledgerPosting";
import { buildCurrencyRevaluation, postCurrencyRevaluation } from "./currencyRevaluation";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);
const actor = { id: 42 };

type MappedLine = { accountCode: string; side: "DEBIT" | "KREDIT"; amount: string; memo?: string; currencyCode?: string; foreignAmount?: string };
type JournalEntryInput = { entryDate: Date; description: string; sourceType: string; sourceReference: string; lines: MappedLine[] };
type StoredJournal = { id: number; entryNumber: string; entryDate: Date; sourceType: string; sourceReference: string; totalDebit: string; totalCredit: string };
type PeriodRow = {
  id: number; periodStart: Date; periodEnd: Date; status: "TERBUKA" | "DITUTUP";
  depreciationPostedAt: Date | null; revaluationPostedAt: Date | null; revaluationJournalEntryId: number | null;
  valuationPostedAt: Date | null; profitClosingPostedAt: Date | null;
  closedAt: Date | null; closedByUserId: number | null; closingNotes: string | null;
};

const sum = (lines: MappedLine[], side: "DEBIT" | "KREDIT") =>
  lines.filter((line) => line.side === side).reduce((total, line) => total.plus(line.amount), new Decimal(0));

/**
 * Buku besar palsu yang **menyimpan** apa yang ditulis padanya.
 *
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data. Kueri dibedakan lewat tabel yang diberikan
 * ke `from()`, dan untuk `journal_entries` — yang punya tiga bentuk kueri berbeda — lewat kolom yang
 * diminta: `{sourceReference}` milik `alreadyJournaled`, `{id, entryNumber}` milik pencarian jurnal
 * revaluasi, dan tanpa kolom milik `verifyLedgerIntegrity`. Bukan urutan pemanggilan.
 *
 * `where()` tidak dievaluasi, jadi periode yang sedang dikerjakan ditunjuk lewat `pakaiPeriode`.
 */
function bukuBesar(options: { periods: PeriodRow[]; rates: { id: number; currencyId: number; referenceDate: string; buyRate: string; sellRate: string; quoteUnit: string }[] }) {
  const periods = options.periods.map((period) => ({ ...period }));
  const rates = options.rates.map((rate) => ({ ...rate, referenceDate: dbDay(rate.referenceDate) }));
  const movements: Record<string, unknown>[] = [];
  const journals: StoredJournal[] = [];
  const lines: (MappedLine & { entryId: number })[] = [];
  const revaluations: Record<string, unknown>[] = [];
  let focus = periods[0];
  let nextJournalId = 1;

  const rowsFor = (table: unknown, fields: Record<string, unknown> | undefined): unknown[] => {
    if (table === accountingPeriods) return [focus, ...periods.filter((period) => period !== focus)];
    if (table === bankAccountMovements) return movements;
    if (table === rateReferenceSnapshots) return rates;
    if (table === currencies) return [{ id: 2, code: "USD" }];
    if (table === currencyRevaluations) return revaluations.filter((row) => row.periodId !== focus.id);
    // `buildCurrencyRevaluation` meminta empat kolom dan hanya peduli baris 1-1220;
    // `verifyLedgerIntegrity` meminta seluruh kolom dan harus melihat kedua kaki tiap jurnal.
    if (table === journalEntryLines) return fields ? lines.filter((line) => line.accountCode === "1-1220") : lines;
    if (table === journalEntries) {
      if (!fields) return journals;
      const keys = Object.keys(fields).sort().join(",");
      if (keys === "sourceReference") return journals.filter((entry) => entry.sourceType === "MUTASI_BANK");
      return journals.filter((entry) => entry.sourceType === "REVALUASI_KURS" && entry.sourceReference === `REVAL-${bulanFokus()}`);
    }
    return [];
  };

  const bulanFokus = () => `${focus.periodStart.getFullYear()}-${`${focus.periodStart.getMonth() + 1}`.padStart(2, "0")}`;

  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy"]) {
      thenable[method] = () => chain(rows);
    }
    return thenable as never;
  };

  const writer = {
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        const rows = Array.isArray(values) ? values : [values];
        if (table === currencyRevaluations) revaluations.push(...(rows as Record<string, unknown>[]));
        return Promise.resolve();
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          if (table === accountingPeriods) Object.assign(focus, values);
          return Promise.resolve();
        },
      }),
    }),
  };

  const fakeDb = {
    select: vi.fn((fields?: Record<string, unknown>) => ({ from: (table: unknown) => chain(rowsFor(table, fields)) })),
    ...writer,
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(writer)),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);

  return {
    periods,
    journals,
    revaluations,
    pakaiPeriode(month: string) {
      const found = periods.find((period) => `${period.periodStart.getFullYear()}-${`${period.periodStart.getMonth() + 1}`.padStart(2, "0")}` === month);
      if (!found) throw new Error(`Periode ${month} tidak ada pada cerita ini.`);
      focus = found;
      return found;
    },
    catatMutasi(row: { id: number; amount: string; createdAt: string; reason: string }) {
      movements.push({
        id: row.id, category: "CAPITAL_INJECTION", direction: "IN",
        amount: row.amount, reason: row.reason, createdAt: dbDay(row.createdAt),
        currencyCode: "USD", currencyId: 2,
      });
    },
    /** Pengganti `postJournalEntry`: mencatat jurnalnya supaya langkah berikutnya membacanya. */
    catatJurnal(entry: JournalEntryInput) {
      const id = nextJournalId++;
      const month = `${entry.entryDate.getFullYear()}${`${entry.entryDate.getMonth() + 1}`.padStart(2, "0")}`;
      const stored: StoredJournal = {
        id,
        entryNumber: `JU-${month}-${`${id}`.padStart(4, "0")}`,
        entryDate: entry.entryDate,
        sourceType: entry.sourceType,
        sourceReference: entry.sourceReference,
        totalDebit: sum(entry.lines, "DEBIT").toFixed(2),
        totalCredit: sum(entry.lines, "KREDIT").toFixed(2),
      };
      journals.push(stored);
      lines.push(...entry.lines.map((line) => ({ ...line, entryId: id })));
      return { id, entryNumber: stored.entryNumber };
    },
    saldo(accountCode: string) {
      const own = lines.filter((line) => line.accountCode === accountCode);
      return sum(own, "DEBIT").minus(sum(own, "KREDIT")).toFixed(2);
    },
    jurnalBersumber(sourceType: string) {
      return journals.filter((entry) => entry.sourceType === sourceType);
    },
    barisJurnal(entryNumber: string) {
      const entry = journals.find((journal) => journal.entryNumber === entryNumber);
      return lines.filter((line) => line.entryId === entry?.id).map((line) => [line.accountCode, line.side, line.amount]);
    },
  };
}

type Buku = ReturnType<typeof bukuBesar>;

const bulan = (id: number, month: number, overrides: Partial<PeriodRow> = {}): PeriodRow => {
  const start = new Date(2026, month - 1, 1);
  return {
    id,
    periodStart: start,
    periodEnd: new Date(start.getFullYear(), start.getMonth() + 1, 0),
    status: "TERBUKA",
    depreciationPostedAt: new Date("2026-01-01T00:00:00"),
    revaluationPostedAt: null,
    revaluationJournalEntryId: null,
    valuationPostedAt: new Date("2026-01-01T00:00:00"),
    profitClosingPostedAt: null,
    closedAt: null,
    closedByUserId: null,
    closingNotes: null,
    ...overrides,
  };
};

/** Kurs tengah = (beli + jual) / 2. 16.300 pada 15 Sep, 16.500 pada 30 Sep, 16.100 pada 31 Okt. */
const rates = [
  { id: 71, currencyId: 2, referenceDate: "2026-09-15", buyRate: "16200.000000", sellRate: "16400.000000", quoteUnit: "1.000000" },
  { id: 80, currencyId: 2, referenceDate: "2026-09-30", buyRate: "16400.000000", sellRate: "16600.000000", quoteUnit: "1.000000" },
  { id: 90, currencyId: 2, referenceDate: "2026-10-31", buyRate: "16000.000000", sellRate: "16200.000000", quoteUnit: "1.000000" },
];

const pasangJurnalPalsu = (buku: Buku) => {
  vi.mocked(postJournalEntry).mockImplementation(async (entry) => buku.catatJurnal(entry as JournalEntryInput) as never);
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(postJournalEntry).mockReset();
  vi.mocked(writeAudit).mockReset().mockResolvedValue(undefined as never);
});

describe("setoran USD → revaluasi September → revaluasi Oktober", () => {
  it("menjalankan seluruh alurnya dan berakhir pada nilai kurs penutup", async () => {
    const buku = bukuBesar({ periods: [bulan(16, 9), bulan(17, 10)], rates });
    pasangJurnalPalsu(buku);
    buku.pakaiPeriode("2026-09");

    // 1. Setoran USD 1.000 pada 15 September, kurs tengah 16.300.
    buku.catatMutasi({ id: 11, amount: "1000.000000", createdAt: "2026-09-15", reason: "Setoran modal USD" });
    const posting = await postBankMovements({ from: dbDay("2026-09-01"), to: dbDay("2026-09-30") }, actor);
    expect(posting.skipped).toEqual([]);
    expect(buku.barisJurnal(posting.posted[0].entryNumber)).toEqual([
      ["1-1220", "DEBIT", "16300000.00"],
      ["3-1100", "KREDIT", "16300000.00"],
    ]);
    expect(buku.saldo("1-1220")).toBe("16300000.00");

    // 2. Revaluasi 30 September pada kurs tengah 16.500 → selisih +200.000.
    const rencana = await buildCurrencyRevaluation(16);
    expect(rencana.rows[0]).toMatchObject({
      currencyCode: "USD", foreignBalance: "1000.000000",
      carryingBefore: "16300000.00", midRatePerUnit: "16500.000000000000",
      carryingAfter: "16500000.00", difference: "200000.00",
    });

    const hasil = await postCurrencyRevaluation({ periodId: 16 }, actor);
    expect(buku.barisJurnal(hasil.entryNumber!)).toEqual([
      ["1-1220", "DEBIT", "200000.00"],
      ["7-1500", "KREDIT", "200000.00"],
    ]);

    // 3. Nilai tercatat kini persis USD 1.000 × 16.500 — dapat diturunkan ulang.
    expect(buku.saldo("1-1220")).toBe("16500000.00");
    expect(buku.saldo("7-1500")).toBe("-200000.00");

    // 4. Oktober: kurs turun ke 16.100 → rugi 400.000 ke debit 7-1500.
    buku.pakaiPeriode("2026-10");
    const oktober = await buildCurrencyRevaluation(17);
    expect(oktober.rows[0]).toMatchObject({
      carryingBefore: "16500000.00", midRatePerUnit: "16100.000000000000",
      carryingAfter: "16100000.00", difference: "-400000.00",
    });

    const hasilOktober = await postCurrencyRevaluation({ periodId: 17 }, actor);
    expect(buku.barisJurnal(hasilOktober.entryNumber!)).toEqual([
      ["7-1500", "DEBIT", "400000.00"],
      ["1-1220", "KREDIT", "400000.00"],
    ]);

    // 5. Saldo akhir tetap dapat diturunkan ulang: USD 1.000 × 16.100.
    expect(buku.saldo("1-1220")).toBe("16100000.00");
    expect(buku.saldo("7-1500")).toBe("200000.00");
  });
});

describe("gerbang penutupan periode di dalam alur yang sama", () => {
  it("menolak menutup September sebelum revaluasinya dijurnal, lalu meloloskannya sesudah", async () => {
    const buku = bukuBesar({ periods: [bulan(16, 9), bulan(17, 10)], rates });
    pasangJurnalPalsu(buku);
    buku.pakaiPeriode("2026-09");

    buku.catatMutasi({ id: 11, amount: "1000.000000", createdAt: "2026-09-15", reason: "Setoran modal USD" });
    await postBankMovements({ from: dbDay("2026-09-01"), to: dbDay("2026-09-30") }, actor);

    await expect(closeAccountingPeriod({ periodId: 16 }, actor)).rejects.toThrow(/revaluasi kurs belum dijurnal/i);
    expect(buku.periods[0].status).toBe("TERBUKA");

    await postCurrencyRevaluation({ periodId: 16 }, actor);
    expect(buku.periods[0].revaluationPostedAt).toBeInstanceOf(Date);

    await expect(closeAccountingPeriod({ periodId: 16 }, actor)).resolves.toEqual({ id: 16 });
    expect(buku.periods[0].status).toBe("DITUTUP");
  });
});

describe("mutasi yang kursnya belum ada", () => {
  it("tidak dijurnal, tidak ikut direvaluasi, dan tidak membuat selisih palsu", async () => {
    // Mutasi 10 September mendahului seluruh kurs yang ada. Ia dilewati beralasan — dan karena
    // saldo valuta maupun nilai tercatatnya sama-sama dibaca dari baris jurnal, ketiadaannya tidak
    // melahirkan selisih kurs yang tidak pernah terjadi.
    const buku = bukuBesar({ periods: [bulan(16, 9)], rates });
    pasangJurnalPalsu(buku);
    buku.pakaiPeriode("2026-09");

    buku.catatMutasi({ id: 12, amount: "500.000000", createdAt: "2026-09-10", reason: "Setoran USD terlalu awal" });
    const posting = await postBankMovements({ from: dbDay("2026-09-01"), to: dbDay("2026-09-30") }, actor);

    expect(posting.posted).toEqual([]);
    expect(posting.skipped[0].reason).toMatch(/kurs BI pada tanggal mutasi belum tersedia/i);

    const rencana = await buildCurrencyRevaluation(16);
    expect(rencana.rows).toEqual([]);
    expect(rencana.totalDifference).toBe("0.00");
  });
});

describe("idempotensi revaluasi", () => {
  it("dua kali menjalankan revaluasi bulan yang sama tidak pernah menghasilkan jurnal ganda", async () => {
    const buku = bukuBesar({ periods: [bulan(16, 9)], rates });
    pasangJurnalPalsu(buku);
    buku.pakaiPeriode("2026-09");

    buku.catatMutasi({ id: 11, amount: "1000.000000", createdAt: "2026-09-15", reason: "Setoran modal USD" });
    await postBankMovements({ from: dbDay("2026-09-01"), to: dbDay("2026-09-30") }, actor);
    await postCurrencyRevaluation({ periodId: 16 }, actor);
    expect(buku.jurnalBersumber("REVALUASI_KURS")).toHaveLength(1);

    // Percobaan kedua yang paling wajar: tombolnya ditekan lagi.
    await expect(postCurrencyRevaluation({ periodId: 16 }, actor)).rejects.toThrow(/sudah dijalankan/i);
    expect(buku.jurnalBersumber("REVALUASI_KURS")).toHaveLength(1);

    // Yang lebih halus: jurnalnya tertulis tetapi penanda periodenya hilang — keadaan yang tersisa
    // bila transaksinya gagal sesudah menjurnal. Kunci (REVALUASI_KURS, REVAL-2026-09) dipakai
    // ulang, bukan ditulis kedua kalinya.
    buku.periods[0].revaluationPostedAt = null;
    buku.periods[0].revaluationJournalEntryId = null;
    buku.revaluations.length = 0;
    const sebelum = vi.mocked(postJournalEntry).mock.calls.length;
    await postCurrencyRevaluation({ periodId: 16 }, actor);
    expect(vi.mocked(postJournalEntry).mock.calls).toHaveLength(sebelum);
    expect(buku.jurnalBersumber("REVALUASI_KURS")).toHaveLength(1);
    expect(buku.saldo("1-1220")).toBe("16500000.00");
  });
});
