import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountingPeriods,
  cashBalances,
  currencies,
  journalEntries,
  periodClosingValuations,
  rateReferenceSnapshots,
  stockOpnames,
} from "../drizzle/schema";
import * as db from "./db";

vi.mock("./ledgerOperations", () => ({ postJournalEntry: vi.fn() }));
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn(), getOpnameSystemCounts: vi.fn() };
});

import { postJournalEntry } from "./ledgerOperations";
import { writeAudit } from "./operations";
import { postPeriodClosing } from "./periodClosing";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

type Write = { op: "delete" | "insert" | "update"; table: unknown; values?: unknown };

/**
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data.
 *
 * Selain membaca (pola sama seperti `periodValuation.test.ts`), fake ini merekam **tulisannya**:
 * apa yang ditulis, ke tabel mana, dan yang terpenting — apakah ia berada di dalam transaksi yang
 * sama. Penilaian yang tersimpan tanpa penanda periodenya terlihat seperti penutupan yang sah
 * padahal bukan, dan itu hanya dapat dicegah oleh transaksi, bukan oleh urutan pemanggilan.
 */
function mockDb(options: {
  reads: { table: unknown; results: unknown[][] }[];
  onInsert?: (table: unknown) => void;
}) {
  const queues = new Map(options.reads.map((entry) => [entry.table, [...entry.results]]));
  const transactions: Write[][] = [];

  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "orderBy", "limit"]) thenable[method] = () => chain(rows);
    return thenable as never;
  };
  const select = () => ({
    from: (table: unknown) => {
      const queue = queues.get(table) ?? [];
      return chain((queue.length > 1 ? queue.shift() : queue[0]) ?? []);
    },
  });

  const writerFor = (log: Write[]) => ({
    delete: (table: unknown) => ({ where: () => { log.push({ op: "delete", table }); return Promise.resolve(); } }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        options.onInsert?.(table);
        log.push({ op: "insert", table, values });
        return Promise.resolve();
      },
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({ where: () => { log.push({ op: "update", table, values }); return Promise.resolve(); } }),
    }),
  });

  const fakeDb = {
    select: vi.fn(select),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const log: Write[] = [];
      // Transaksi yang gagal tidak meninggalkan jejak: log-nya baru dicatat setelah callback-nya
      // selesai, persis seperti commit.
      const result = await callback(writerFor(log));
      transactions.push(log);
      return result;
    }),
  };
  const spy = vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { spy, transactions, fakeDb };
}

const period = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  periodStart: dbDay("2026-09-01"),
  periodEnd: dbDay("2026-09-30"),
  status: "TERBUKA" as const,
  valuationPostedAt: null,
  profitClosingPostedAt: null,
  ...overrides,
});

const usd = { currencyId: 1, currencyCode: "USD", availableAmount: "12500.000000" };
const usdOpname = {
  id: 900,
  currencyId: 1,
  opnameDate: dbDay("2026-09-30"),
  physicalBalance: "12500.000000",
  reconciliationStatus: "RECONCILED" as const,
};
const usdRate = {
  id: 500,
  currencyId: 1,
  referenceDate: dbDay("2026-09-30"),
  buyRate: "16200.000000",
  sellRate: "16400.000000",
  quoteUnit: "1.000000",
};

const reads = (options: {
  periods?: unknown[][];
  currencies?: unknown[];
  opnames?: unknown[];
  rates?: unknown[];
  valuations?: unknown[];
  existingJournal?: unknown[];
} = {}) => [
  { table: accountingPeriods, results: options.periods ?? [[period()], []] },
  { table: currencies, results: [options.currencies ?? [usd]] },
  { table: stockOpnames, results: [options.opnames ?? [usdOpname]] },
  { table: rateReferenceSnapshots, results: [options.rates ?? [usdRate]] },
  { table: periodClosingValuations, results: [options.valuations ?? []] },
  { table: journalEntries, results: [options.existingJournal ?? []] },
  { table: cashBalances, results: [[]] },
];

const actor = { id: 42 };

beforeEach(() => {
  vi.mocked(postJournalEntry).mockReset();
  vi.mocked(writeAudit).mockReset();
  vi.mocked(postJournalEntry).mockResolvedValue({ id: 3100, entryNumber: "JU-2026-09-0007" } as never);
});

describe("postPeriodClosing", () => {
  it("menolak periode yang sudah ditutup", async () => {
    const { spy } = mockDb({ reads: reads({ periods: [[period({ status: "DITUTUP" })], []] }) });

    await expect(postPeriodClosing({ periodId: 7 }, actor)).rejects.toThrow(/sudah ditutup/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("menolak selama masih ada penghalang, dan menyebut mata uang beserta alasannya", async () => {
    // Penutupan tidak boleh berjalan sebagian: menilai USD lalu menyerah pada SGD meninggalkan
    // buku besar yang setengah tertutup dan tidak dapat ditelusuri.
    const { spy } = mockDb({
      reads: reads({
        currencies: [usd, { currencyId: 3, currencyCode: "SGD", availableAmount: "500.000000" }],
        opnames: [usdOpname],
      }),
    });

    await expect(postPeriodClosing({ periodId: 7 }, actor)).rejects.toThrow(/SGD/);
    expect(postJournalEntry).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("menulis satu baris penilaian per mata uang lalu satu jurnal TUTUP_PERIODE bertanggal akhir periode", async () => {
    const { spy, transactions } = mockDb({ reads: reads() });

    const result = await postPeriodClosing({ periodId: 7 }, actor);

    expect(postJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        entryDate: dbDay("2026-09-30"),
        sourceType: "TUTUP_PERIODE",
        sourceReference: "TUTUP-7",
      }),
      actor,
    );
    const inserted = transactions[0]?.find((write) => write.op === "insert");
    expect(inserted?.table).toBe(periodClosingValuations);
    expect(inserted?.values).toEqual([
      expect.objectContaining({ periodId: 7, currencyId: 1, quantity: "12500.000000", rupiahValue: "203750000.00", stockOpnameId: 900, rateSnapshotId: 500 }),
    ]);
    expect(result.entryNumber).toBe("JU-2026-09-0007");
    expect(result.skipped).toBeNull();
    spy.mockRestore();
  });

  it("tetap menandai periode sudah dinilai meski jurnalnya dilewati karena kedua sisi nol", async () => {
    // Outlet yang belum memegang UKA menghasilkan nol baris penilaian. Tanpa penanda ini, periode
    // seperti itu tidak akan pernah dapat ditutup.
    const { spy, transactions } = mockDb({ reads: reads({ currencies: [], opnames: [], rates: [] }) });

    const result = await postPeriodClosing({ periodId: 7 }, actor);

    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(result.skipped).toMatch(/tidak ada persediaan/i);
    const marker = transactions[0]?.find((write) => write.op === "update");
    expect(marker?.table).toBe(accountingPeriods);
    expect(marker?.values).toEqual(expect.objectContaining({ valuationPostedAt: expect.any(Date), valuationJournalEntryId: null }));
    spy.mockRestore();
  });

  it("menolak dijalankan dua kali dengan pesan yang terbaca manusia, tanpa jurnal kedua", async () => {
    const { spy } = mockDb({ reads: reads({ periods: [[period({ valuationPostedAt: new Date("2026-10-01T03:00:00Z") })], []] }) });

    await expect(postPeriodClosing({ periodId: 7 }, actor)).rejects.toThrow(/sudah dijalankan/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("memakai ulang jurnal penutupan yang sudah ada alih-alih menulis yang kedua", async () => {
    // Percobaan sebelumnya boleh saja gagal setelah jurnalnya tertulis tetapi sebelum penanda
    // periodenya tersimpan. Mengulang harus memulihkan keadaan itu, bukan menabrak kunci unik.
    const { spy, transactions } = mockDb({
      reads: reads({ existingJournal: [{ id: 2900, entryNumber: "JU-2026-09-0001" }] }),
    });

    const result = await postPeriodClosing({ periodId: 7 }, actor);

    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(result.entryNumber).toBe("JU-2026-09-0001");
    expect(transactions[0]?.find((write) => write.op === "update")?.values).toEqual(
      expect.objectContaining({ valuationJournalEntryId: 2900 }),
    );
    spy.mockRestore();
  });

  it("menulis baris penilaian dan penanda periodenya dalam satu transaksi", async () => {
    const { spy, transactions } = mockDb({ reads: reads() });

    await postPeriodClosing({ periodId: 7 }, actor);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.map((write) => write.op)).toEqual(["delete", "insert", "update"]);
    spy.mockRestore();
  });

  it("tidak menandai periode sudah dinilai bila penulisan barisnya gagal", async () => {
    const { spy, transactions } = mockDb({
      reads: reads(),
      onInsert: () => { throw new Error("deadlock"); },
    });

    await expect(postPeriodClosing({ periodId: 7 }, actor)).rejects.toThrow(/deadlock/);
    expect(transactions).toHaveLength(0);
    expect(writeAudit).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("mencatat jejak audit beserta nilai per mata uang", async () => {
    const { spy } = mockDb({ reads: reads() });

    await postPeriodClosing({ periodId: 7 }, actor);

    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 42,
        action: "PERIOD_CLOSING_VALUATION_POSTED",
        entityType: "accounting_periods",
        entityId: "7",
        afterState: expect.objectContaining({
          closingValue: "203750000.00",
          currencies: [
            expect.objectContaining({ currencyCode: "USD", rupiahValue: "203750000.00", opnameDate: "2026-09-30", rateReferenceDate: "2026-09-30" }),
          ],
        }),
      }),
    );
    spy.mockRestore();
  });
});
