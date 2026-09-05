import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountingPeriods,
  cashBalances,
  currencies,
  currencyRevaluations,
  journalEntries,
  journalEntryLines,
  periodClosingValuations,
  rateReferenceSnapshots,
  stockOpnames,
} from "../drizzle/schema";
import * as db from "./db";

/**
 * `closeAccountingPeriod` yang asli ikut diuji, jadi `./ledgerOperations` hanya ditambal pada dua
 * fungsi yang dipanggil `periodClosing.ts` — bukan diganti seluruhnya. Bentuknya sama seperti
 * `depreciationGate.test.ts`.
 */
vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, postJournalEntry: vi.fn(), accountBalancesFor: vi.fn() };
});
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn(), getOpnameSystemCounts: vi.fn() };
});

import { accountBalancesFor, closeAccountingPeriod, postJournalEntry } from "./ledgerOperations";
import { postYearEndProfitClosing } from "./periodClosing";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

type Write = { op: "update" | "insert" | "delete"; table: unknown; values?: unknown };

function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const writes: Write[] = [];
  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "orderBy", "limit"]) thenable[method] = () => chain(rows);
    return thenable as never;
  };
  const rowsFor = (table: unknown) => {
    const queue = queues.get(table) ?? [];
    return (queue.length > 1 ? queue.shift() : queue[0]) ?? [];
  };
  const writer = {
    delete: (table: unknown) => ({ where: () => { writes.push({ op: "delete", table }); return Promise.resolve(); } }),
    insert: (table: unknown) => ({ values: (values: unknown) => { writes.push({ op: "insert", table, values }); return Promise.resolve(); } }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({ where: () => { writes.push({ op: "update", table, values }); return Promise.resolve(); } }),
    }),
  };
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => chain(rowsFor(table)) })),
    ...writer,
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(writer)),
  };
  return { spy: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), writes };
}

const posted = new Date("2026-10-01T03:00:00Z");

const september = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  periodStart: dbDay("2026-09-01"),
  periodEnd: dbDay("2026-09-30"),
  status: "TERBUKA" as const,
  depreciationPostedAt: posted,
  revaluationPostedAt: posted,
  valuationPostedAt: posted,
  profitClosingPostedAt: null,
  ...overrides,
});

const december = (overrides: Record<string, unknown> = {}) => ({
  ...september(),
  id: 12,
  periodStart: dbDay("2026-12-01"),
  periodEnd: dbDay("2026-12-31"),
  ...overrides,
});

/** Dua belas bulan 2026; yang disebut `missing` belum direvaluasi. */
const twelveMonths = (missing: string[] = []) =>
  Array.from({ length: 12 }, (_, index) => {
    const month = `${index + 1}`.padStart(2, "0");
    return {
      periodStart: dbDay(`2026-${month}-01`),
      depreciationPostedAt: posted,
      revaluationPostedAt: missing.includes(`2026-${month}`) ? null : posted,
    };
  });

const reads = (periods: unknown[][]) => [
  { table: accountingPeriods, results: periods },
  { table: journalEntries, results: [[]] },
  { table: journalEntryLines, results: [[]] },
  { table: currencies, results: [[]] },
  { table: currencyRevaluations, results: [[]] },
  { table: stockOpnames, results: [[]] },
  { table: rateReferenceSnapshots, results: [[]] },
  { table: periodClosingValuations, results: [[]] },
  { table: cashBalances, results: [[]] },
];

const actor = { id: 42 };

beforeEach(() => {
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 4100, entryNumber: "JU-2026-12-0099" } as never);
  vi.mocked(accountBalancesFor).mockReset().mockResolvedValue([]);
});

describe("closeAccountingPeriod menuntut revaluasi kurs", () => {
  it("menolak periode yang revaluasinya belum dijurnal", async () => {
    const { spy, writes } = mockDb(reads([[september({ revaluationPostedAt: null })]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/revaluasi kurs belum dijurnal/i);
    expect(writes).toEqual([]);
    spy.mockRestore();
  });

  it("memeriksa penyusutan sebelum revaluasi", async () => {
    // Keduanya kosong: pesan penyusutanlah yang lebih dulu sampai, karena ia langkah pertama pada
    // urutan tutup bulan yang tertulis di panduan.
    const { spy } = mockDb(reads([[september({ depreciationPostedAt: null, revaluationPostedAt: null })]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/penyusutan/i);
    spy.mockRestore();
  });

  it("memeriksa revaluasi sebelum penilaian persediaan", async () => {
    // Revaluasi mengubah laba periode ini; penilaian persediaan tidak bergantung padanya.
    const { spy } = mockDb(reads([[september({ revaluationPostedAt: null, valuationPostedAt: null })]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/revaluasi kurs/i);
    spy.mockRestore();
  });

  it("meloloskan periode yang ketiganya sudah dijalankan", async () => {
    const { spy, writes } = mockDb(reads([[september()]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).resolves.toEqual({ id: 9 });
    expect(writes).toEqual([
      expect.objectContaining({ table: accountingPeriods, values: expect.objectContaining({ status: "DITUTUP" }) }),
    ]);
    spy.mockRestore();
  });
});

describe("postYearEndProfitClosing menuntut dua belas bulan revaluasi", () => {
  it("menolak dan menyebut bulan yang revaluasinya belum dijurnal", async () => {
    // Penutup laba menolkan 7-1500; menutupnya sebelum selisih kursnya lengkap memindahkan angka
    // yang salah ke 3-2100, dan 3-2100 tidak pernah ditinjau lagi.
    const { spy } = mockDb(reads([[december()], [], twelveMonths(["2026-12"]), []]));

    await expect(postYearEndProfitClosing({ periodId: 12 }, actor)).rejects.toThrow(/revaluasi kurs belum dijurnal untuk .*2026-12/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("menyebut seluruh bulan yang tertinggal, bukan hanya yang pertama", async () => {
    const { spy } = mockDb(reads([[december()], [], twelveMonths(["2026-07", "2026-12"]), []]));

    const error = await postYearEndProfitClosing({ periodId: 12 }, actor).catch((caught: Error) => caught);
    expect((error as Error).message).toMatch(/2026-07/);
    expect((error as Error).message).toMatch(/2026-12/);
    spy.mockRestore();
  });

  it("meloloskan tahun yang seluruh bulannya sudah direvaluasi", async () => {
    const { spy } = mockDb(reads([[december()], [], twelveMonths(), []]));

    await expect(postYearEndProfitClosing({ periodId: 12 }, actor)).resolves.toBeTruthy();
    spy.mockRestore();
  });
});
