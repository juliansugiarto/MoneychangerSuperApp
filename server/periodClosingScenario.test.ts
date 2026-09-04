import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountingPeriods,
  cashBalances,
  currencies,
  journalEntries,
  journalEntryLines,
  periodClosingValuations,
  rateReferenceSnapshots,
  stockOpnames,
} from "../drizzle/schema";
import { parseAmount } from "../shared/ledger";
import * as db from "./db";

vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, postJournalEntry: vi.fn(), accountBalancesFor: vi.fn() };
});
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn(), getOpnameSystemCounts: vi.fn() };
});

import { accountBalancesFor, closeAccountingPeriod, postJournalEntry } from "./ledgerOperations";
import { postPeriodClosing, postYearEndProfitClosing } from "./periodClosing";

/**
 * Dua periode berurutan, dibaca dari ujung ke ujung.
 *
 * Uji-uji sebelumnya memeriksa tiap bagian sendiri-sendiri; yang belum terbukti adalah bahwa
 * bagian-bagian itu **tersambung**: nilai persediaan akhir sebuah periode harus muncul sebagai
 * persediaan awal periode berikutnya, dan akun 1-1210 Kas UKA harus berakhir pada nilai periode
 * terakhir saja. Bila pembalikannya terlewat, 1-1210 akan menumpuk tiap bulan dan neraca perlahan
 * membesar tanpa ada satu pun uji bagian yang gagal.
 *
 * Seluruhnya berjalan atas `getDb` yang dipalsukan; tidak ada data yang dibuat di basis data.
 */
const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const writes: { op: string; table: unknown; values?: unknown }[] = [];
  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "orderBy", "limit"]) thenable[method] = () => chain(rows);
    return thenable as never;
  };
  const writer = {
    delete: (table: unknown) => ({ where: () => { writes.push({ op: "delete", table }); return Promise.resolve(); } }),
    insert: (table: unknown) => ({ values: (values: unknown) => { writes.push({ op: "insert", table, values }); return Promise.resolve(); } }),
    update: (table: unknown) => ({ set: (values: unknown) => ({ where: () => { writes.push({ op: "update", table, values }); return Promise.resolve(); } }) }),
  };
  const fakeDb = {
    select: vi.fn(() => ({
      from: (table: unknown) => {
        const queue = queues.get(table) ?? [];
        return chain((queue.length > 1 ? queue.shift() : queue[0]) ?? []);
      },
    })),
    ...writer,
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(writer)),
  };
  return { spy: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), writes };
}

const usd = { currencyId: 1, currencyCode: "USD", availableAmount: "12500.000000" };
const rate = (id: number, day: string, buy: string, sell: string) => ({
  id, currencyId: 1, referenceDate: dbDay(day), buyRate: buy, sellRate: sell, quoteUnit: "1.000000",
});
const opname = (id: number, day: string, quantity: string) => ({
  id, currencyId: 1, opnameDate: dbDay(day), physicalBalance: quantity, reconciliationStatus: "RECONCILED" as const,
});
const period = (id: number, start: string, end: string, overrides: Record<string, unknown> = {}) => ({
  id, periodStart: dbDay(start), periodEnd: dbDay(end), status: "TERBUKA" as const,
  valuationPostedAt: null, profitClosingPostedAt: null, ...overrides,
});

const reads = (options: {
  periods: unknown[][];
  opnames?: unknown[];
  rates?: unknown[];
  priorTotal?: string | null;
  currencies?: unknown[];
}) => [
  { table: accountingPeriods, results: options.periods },
  { table: currencies, results: [options.currencies ?? [usd]] },
  { table: stockOpnames, results: [options.opnames ?? []] },
  { table: rateReferenceSnapshots, results: [options.rates ?? []] },
  { table: periodClosingValuations, results: [options.priorTotal ? [{ total: options.priorTotal }] : []] },
  { table: journalEntries, results: [[]] },
  { table: journalEntryLines, results: [[]] },
  { table: cashBalances, results: [[]] },
];

const actor = { id: 2 };
const linesOf = (call: number) => vi.mocked(postJournalEntry).mock.calls[call]?.[0].lines ?? [];

/** Saldo bersih sebuah akun dari seluruh baris jurnal yang tercatat, debit positif. */
const netOf = (accountCode: string) =>
  vi.mocked(postJournalEntry).mock.calls
    .flatMap((call) => call[0].lines)
    .filter((line) => line.accountCode === accountCode)
    .reduce((sum, line) => sum + (line.side === "DEBIT" ? parseAmount(line.amount) : -parseAmount(line.amount)), 0n);

beforeEach(() => {
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 1, entryNumber: "JU-1" } as never);
  vi.mocked(accountBalancesFor).mockReset().mockResolvedValue([]);
});

describe("penutupan dua periode berurutan", () => {
  it("periode pertama hanya membukukan persediaan akhir; tidak ada persediaan awal untuk dibalik", async () => {
    const { spy } = mockDb(
      reads({
        periods: [[period(1, "2026-09-01", "2026-09-30")], []],
        opnames: [opname(900, "2026-09-30", "12500.000000")],
        rates: [rate(500, "2026-09-30", "16200.000000", "16400.000000")],
      }),
    );

    const result = await postPeriodClosing({ periodId: 1 }, actor);

    expect(linesOf(0)).toEqual([
      expect.objectContaining({ accountCode: "1-1210", side: "DEBIT", amount: "203750000.00" }),
      expect.objectContaining({ accountCode: "5-1300", side: "KREDIT", amount: "203750000.00" }),
    ]);
    expect(result.skipped).toBeNull();
    spy.mockRestore();
  });

  it("periode kedua membalik nilai periode pertama, sehingga 1-1210 tidak menumpuk", async () => {
    // Inilah yang tidak akan tertangkap uji per bagian: bila pembalikannya terlewat, tiap uji
    // bagian tetap lulus sementara Kas UKA membesar sebulan sekali tanpa alasan. Karena itu kedua
    // periode dijalankan berurutan di dalam satu uji, dan yang diperiksa adalah saldo 1-1210
    // setelah keduanya — bukan setelah salah satunya.
    const first = mockDb(
      reads({
        periods: [[period(1, "2026-09-01", "2026-09-30")], []],
        opnames: [opname(900, "2026-09-30", "12500.000000")],
        rates: [rate(500, "2026-09-30", "16200.000000", "16400.000000")],
      }),
    );
    await postPeriodClosing({ periodId: 1 }, actor);
    first.spy.mockRestore();

    const second = mockDb(
      reads({
        periods: [[period(2, "2026-10-01", "2026-10-31")], [{ id: 1 }]],
        opnames: [opname(950, "2026-10-31", "10000.000000")],
        rates: [rate(560, "2026-10-31", "16000.000000", "16200.000000")],
        priorTotal: "203750000.000000",
      }),
    );
    await postPeriodClosing({ periodId: 2 }, actor);
    second.spy.mockRestore();

    expect(linesOf(1)).toEqual([
      expect.objectContaining({ accountCode: "5-1100", side: "DEBIT", amount: "203750000.00" }),
      expect.objectContaining({ accountCode: "1-1210", side: "KREDIT", amount: "203750000.00" }),
      expect.objectContaining({ accountCode: "1-1210", side: "DEBIT", amount: "161000000.00" }),
      expect.objectContaining({ accountCode: "5-1300", side: "KREDIT", amount: "161000000.00" }),
    ]);
    // Kas UKA berakhir pada nilai periode kedua saja: 203,75jt masuk lalu keluar, 161jt tersisa.
    expect(netOf("1-1210")).toBe(parseAmount("161000000.00"));
    // Persediaan akhir periode pertama menjadi persediaan awal periode kedua, tepat sebesar itu.
    expect(netOf("5-1100")).toBe(parseAmount("203750000.00"));
  });

  it("valuta yang habis terjual mengembalikan 1-1210 ke nol dan periodenya tetap dapat ditutup", async () => {
    const first = mockDb(
      reads({
        periods: [[period(1, "2026-09-01", "2026-09-30")], []],
        opnames: [opname(900, "2026-09-30", "12500.000000")],
        rates: [rate(500, "2026-09-30", "16200.000000", "16400.000000")],
      }),
    );
    await postPeriodClosing({ periodId: 1 }, actor);
    first.spy.mockRestore();

    const second = mockDb(
      reads({
        periods: [[period(2, "2026-10-01", "2026-10-31")], [{ id: 1 }]],
        opnames: [opname(980, "2026-10-31", "0.000000")],
        rates: [rate(600, "2026-10-31", "16000.000000", "16200.000000")],
        priorTotal: "203750000.000000",
      }),
    );
    const result = await postPeriodClosing({ periodId: 2 }, actor);

    expect(linesOf(1)).toEqual([
      expect.objectContaining({ accountCode: "5-1100", side: "DEBIT", amount: "203750000.00" }),
      expect.objectContaining({ accountCode: "1-1210", side: "KREDIT", amount: "203750000.00" }),
    ]);
    // Seluruh valuta terjual: Kas UKA kembali nol, bukan tertinggal bersaldo.
    expect(netOf("1-1210")).toBe(0n);
    expect(result.skipped).toBeNull();
    // Periodenya tetap ditandai sudah dinilai, sehingga tetap dapat ditutup.
    expect(second.writes.find((write) => write.op === "update")?.values).toEqual(
      expect.objectContaining({ valuationPostedAt: expect.any(Date) }),
    );
    second.spy.mockRestore();
  });
});

describe("penutupan Desember", () => {
  it("menolak dikunci sebelum penutup labanya dijalankan, lalu memindahkan labanya ke 3-2100", async () => {
    const december = period(12, "2026-12-01", "2026-12-31", { valuationPostedAt: new Date("2027-01-02T03:00:00Z") });
    const blocked = mockDb(reads({ periods: [[december]] }));
    await expect(closeAccountingPeriod({ periodId: 12 }, actor)).rejects.toThrow(/penutup laba/i);
    blocked.spy.mockRestore();

    vi.mocked(accountBalancesFor).mockResolvedValue([
      { accountCode: "4-1100", balance: parseAmount("500000000.00") },
      { accountCode: "5-1200", balance: parseAmount("430000000.00") },
      { accountCode: "5-1300", balance: parseAmount("161000000.00") },
      { accountCode: "6-1100", balance: parseAmount("30000000.00") },
    ] as never);
    const posting = mockDb(reads({ periods: [[december], [], []] }));

    await postYearEndProfitClosing({ periodId: 12 }, actor);

    const lines = linesOf(0);
    // Laba = 500jt penjualan − 430jt pembelian + 161jt persediaan akhir − 30jt gaji = 201jt.
    expect(lines.at(-1)).toEqual(expect.objectContaining({ accountCode: "3-2100", side: "KREDIT", amount: "201000000.00" }));
    const debit = lines.filter((line) => line.side === "DEBIT").reduce((sum, line) => sum + parseAmount(line.amount), 0n);
    const credit = lines.filter((line) => line.side === "KREDIT").reduce((sum, line) => sum + parseAmount(line.amount), 0n);
    expect(debit).toBe(credit);
    posting.spy.mockRestore();

    // Setelah penanda terisi, gerbangnya melepas penguncian.
    const closed = mockDb(reads({ periods: [[{ ...december, profitClosingPostedAt: new Date("2027-01-03T03:00:00Z") }]] }));
    await expect(closeAccountingPeriod({ periodId: 12 }, actor)).resolves.toEqual({ id: 12 });
    closed.spy.mockRestore();
  });
});
