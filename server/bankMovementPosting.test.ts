import { beforeEach, describe, expect, it, vi } from "vitest";
import { bankAccountMovements, journalEntries, rateReferenceSnapshots } from "../drizzle/schema";
import * as db from "./db";

vi.mock("./ledgerOperations", () => ({ postJournalEntry: vi.fn() }));
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { postJournalEntry } from "./ledgerOperations";
import { postBankMovements } from "./ledgerPosting";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

/** `getDb` dipalsukan; uji ini tidak menyentuh basis data. Kueri dibedakan lewat tabelnya. */
function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy"]) {
      thenable[method] = () => chain(rows);
    }
    return thenable as never;
  };
  const fakeDb = {
    select: vi.fn(() => ({
      from: (table: unknown) => {
        const queue = queues.get(table) ?? [];
        return chain((queue.length > 1 ? queue.shift() : queue[0]) ?? []);
      },
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

const usdMovement = {
  id: 11,
  category: "CAPITAL_INJECTION" as const,
  direction: "IN" as const,
  amount: "1000.000000",
  reason: "Setoran modal USD",
  createdAt: dbDay("2026-09-15"),
  currencyCode: "USD",
  currencyId: 2,
};

/** Kurs BI 15 Sep: beli 16.200, jual 16.400, quoteUnit 1 → tengah 16.300. */
const usdSnapshot = {
  id: 71, currencyId: 2, referenceDate: dbDay("2026-09-15"),
  buyRate: "16200.000000", sellRate: "16400.000000", quoteUnit: "1.000000",
};

const scenario = (options: { movements?: unknown[]; snapshots?: unknown[] } = {}) =>
  mockDb([
    { table: bankAccountMovements, results: [options.movements ?? [usdMovement]] },
    { table: rateReferenceSnapshots, results: [options.snapshots ?? [usdSnapshot]] },
    { table: journalEntries, results: [[]] },
  ]);

const range = { from: dbDay("2026-09-01"), to: dbDay("2026-09-30") };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 501, entryNumber: "JU-202609-0011" } as never);
});

describe("postBankMovements untuk rekening valuta asing", () => {
  it("menjurnal ke 1-1220 pada kurs tengah tanggal mutasi", async () => {
    scenario();
    const outcome = await postBankMovements(range, { id: 3 });

    expect(outcome.skipped).toEqual([]);
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.sourceType).toBe("MUTASI_BANK");
    expect(entry.sourceReference).toBe("BANK-11");
    expect(entry.lines).toEqual([
      { accountCode: "1-1220", side: "DEBIT", amount: "16300000.00", memo: "Setoran modal USD" },
      { accountCode: "3-1100", side: "KREDIT", amount: "16300000.00", memo: "Setoran modal USD" },
    ]);
  });

  it("mundur ke kurs terakhir sebelum tanggal mutasi", async () => {
    // Mutasi pada akhir pekan memakai kurs hari kerja terakhir. Mundur adalah keadaan sah;
    // memakai kurs yang belum terbit tidak.
    scenario({ movements: [{ ...usdMovement, createdAt: dbDay("2026-09-20") }] });
    await postBankMovements(range, { id: 3 });

    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.lines[0].amount).toBe("16300000.00");
  });

  it("melewati mutasi yang seluruh kursnya terbit sesudah tanggalnya", async () => {
    scenario({ movements: [{ ...usdMovement, createdAt: dbDay("2026-09-10") }] });
    const outcome = await postBankMovements(range, { id: 3 });

    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(outcome.skipped[0].reason).toMatch(/kurs BI pada tanggal mutasi belum tersedia/i);
  });

  it("memakai hanya kurs mata uangnya sendiri", async () => {
    // Kurs SGD tidak boleh dipakai menilai mutasi USD hanya karena tanggalnya lebih dekat.
    scenario({ snapshots: [
      { id: 90, currencyId: 3, referenceDate: dbDay("2026-09-15"), buyRate: "12000.000000", sellRate: "12200.000000", quoteUnit: "1.000000" },
      usdSnapshot,
    ] });
    await postBankMovements(range, { id: 3 });

    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.lines[0].amount).toBe("16300000.00");
  });

  it("membagi dengan quoteUnit, supaya JPY yang dikutip per 100 tidak meleset seratus kali", async () => {
    scenario({
      movements: [{ ...usdMovement, currencyCode: "JPY", currencyId: 4, amount: "10000.000000" }],
      snapshots: [{ id: 95, currencyId: 4, referenceDate: dbDay("2026-09-15"), buyRate: "10000.000000", sellRate: "10200.000000", quoteUnit: "100.000000" }],
    });
    await postBankMovements(range, { id: 3 });

    // (10.000 + 10.200) / 2 / 100 = 101 per yen; 10.000 yen = 1.010.000.
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.lines[0].amount).toBe("1010000.00");
  });

  it("tidak menuntut kurs untuk rekening IDR", async () => {
    scenario({
      movements: [{ ...usdMovement, currencyCode: "IDR", currencyId: 1, amount: "5000000.000000" }],
      snapshots: [],
    });
    const outcome = await postBankMovements(range, { id: 3 });

    expect(outcome.skipped).toEqual([]);
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.lines[0].accountCode).toBe("1-1120");
    expect(entry.lines[0].amount).toBe("5000000.00");
  });
});
