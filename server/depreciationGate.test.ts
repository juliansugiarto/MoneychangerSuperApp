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
import * as db from "./db";

/**
 * `closeAccountingPeriod` yang asli ikut diuji, jadi `./ledgerOperations` hanya ditambal pada dua
 * fungsi yang dipanggil `periodClosing.ts` — bukan diganti seluruhnya. Bentuknya sama seperti
 * `periodCloseGate.test.ts`, yang menguji gerbang penilaian paket C.
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
  valuationPostedAt: posted,
  profitClosingPostedAt: null,
  ...overrides,
});

const december = (overrides: Record<string, unknown> = {}) => ({
  id: 12,
  periodStart: dbDay("2026-12-01"),
  periodEnd: dbDay("2026-12-31"),
  status: "TERBUKA" as const,
  depreciationPostedAt: posted,
  valuationPostedAt: posted,
  profitClosingPostedAt: null,
  ...overrides,
});

/** Dua belas bulan 2026, seluruhnya sudah disusutkan kecuali yang disebut `missing`. */
const twelveMonths = (missing: string[] = []) =>
  Array.from({ length: 12 }, (_, index) => {
    const month = `${index + 1}`.padStart(2, "0");
    return {
      periodStart: dbDay(`2026-${month}-01`),
      depreciationPostedAt: missing.includes(`2026-${month}`) ? null : posted,
    };
  });

const reads = (periods: unknown[][], extra: { journal?: unknown[] } = {}) => [
  { table: accountingPeriods, results: periods },
  { table: journalEntries, results: [extra.journal ?? []] },
  { table: journalEntryLines, results: [[]] },
  { table: currencies, results: [[]] },
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

describe("closeAccountingPeriod menuntut penyusutan", () => {
  it("menolak periode yang penyusutannya belum dijurnal", async () => {
    const { spy, writes } = mockDb(reads([[september({ depreciationPostedAt: null })]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/penyusutan aset tetap belum dijurnal/i);
    expect(writes).toEqual([]);
    spy.mockRestore();
  });

  it("mendahulukan pesan jurnal tidak utuh daripada pesan penyusutan", async () => {
    // Jurnal yang tidak utuh adalah masalah yang lebih besar, dan pesannyalah yang harus sampai
    // lebih dulu — urutan yang sama seperti gerbang penilaian paket C.
    const { spy } = mockDb(
      reads([[september({ depreciationPostedAt: null })]], {
        journal: [{ id: 1, entryNumber: "JU-2026-09-0001", totalDebit: "10.00", totalCredit: "10.00" }],
      }),
    );

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/tidak utuh/i);
    spy.mockRestore();
  });

  it("memeriksa penyusutan sebelum penilaian persediaan", async () => {
    // Penyusutan mengubah laba periode itu; penilaian persediaan tidak bergantung padanya. Bila
    // keduanya sama-sama belum berjalan, pesan penyusutanlah yang lebih dulu sampai.
    const { spy } = mockDb(reads([[september({ depreciationPostedAt: null, valuationPostedAt: null })]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/penyusutan/i);
    spy.mockRestore();
  });

  it("meloloskan periode yang penyusutan dan penilaiannya sudah dijalankan", async () => {
    const { spy, writes } = mockDb(reads([[september()]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).resolves.toEqual({ id: 9 });
    expect(writes).toEqual([
      expect.objectContaining({ table: accountingPeriods, values: expect.objectContaining({ status: "DITUTUP" }) }),
    ]);
    spy.mockRestore();
  });
});

describe("postYearEndProfitClosing menuntut dua belas bulan penyusutan", () => {
  it("menolak dan menyebut bulan yang penyusutannya belum dijurnal", async () => {
    // Penutup laba menolkan 6-1700; menutupnya sebelum bebannya lengkap memindahkan angka yang
    // salah ke 3-2100, dan 3-2100 tidak pernah ditinjau lagi.
    const { spy } = mockDb(reads([[december()], [], twelveMonths(["2026-12"]), []]));

    await expect(postYearEndProfitClosing({ periodId: 12 }, actor)).rejects.toThrow(/2026-12/);
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

  it("meloloskan tahun yang seluruh bulannya sudah disusutkan", async () => {
    const { spy } = mockDb(reads([[december()], [], twelveMonths(), []]));

    await expect(postYearEndProfitClosing({ periodId: 12 }, actor)).resolves.toBeTruthy();
    spy.mockRestore();
  });
});
