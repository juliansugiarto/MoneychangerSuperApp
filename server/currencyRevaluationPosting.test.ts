import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountingPeriods,
  currencies,
  currencyRevaluations,
  journalEntries,
  journalEntryLines,
  rateReferenceSnapshots,
} from "../drizzle/schema";
import * as db from "./db";

vi.mock("./ledgerOperations", () => ({ postJournalEntry: vi.fn() }));
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { postJournalEntry } from "./ledgerOperations";
import { writeAudit } from "./operations";
import { postCurrencyRevaluation } from "./currencyRevaluation";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

type Write = { op: "insert" | "update"; table: unknown; values?: unknown };

/**
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data.
 *
 * Fake ini merekam tulisannya **beserta transaksinya**: baris bukti yang tersimpan tanpa penanda
 * periodenya terlihat seperti revaluasi yang belum berjalan padahal jurnalnya sudah ada, dan itu
 * hanya dapat dicegah oleh transaksi, bukan oleh urutan pemanggilan.
 */
function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const transactions: Write[][] = [];

  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy"]) {
      thenable[method] = () => chain(rows);
    }
    return thenable as never;
  };
  const select = () => ({
    from: (table: unknown) => {
      const queue = queues.get(table) ?? [];
      return chain((queue.length > 1 ? queue.shift() : queue[0]) ?? []);
    },
  });

  const writerFor = (log: Write[]) => ({
    insert: (table: unknown) => ({
      values: (values: unknown) => { log.push({ op: "insert", table, values }); return Promise.resolve(); },
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: () => { log.push({ op: "update", table, values }); return Promise.resolve(); },
      }),
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
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { transactions };
}

const september = {
  id: 16,
  periodStart: dbDay("2026-09-01"),
  periodEnd: dbDay("2026-09-30"),
  status: "TERBUKA" as const,
  revaluationPostedAt: null,
};

/** USD 1.000 tercatat Rp 16.300.000 di 1-1220. */
const usdLines = [
  { currencyCode: "USD", side: "DEBIT" as const, amount: "16300000.00", foreignAmount: "1000.000000" },
];

/** Kurs penutup 30 Sep tengah 16.500 → nilai baru 16.500.000, selisih +200.000. */
const closingSnapshot = {
  id: 80, currencyId: 2, referenceDate: dbDay("2026-09-30"),
  buyRate: "16400.000000", sellRate: "16600.000000", quoteUnit: "1.000000",
};

const scenario = (options: {
  period?: unknown; lines?: unknown[]; snapshots?: unknown[]; prior?: unknown[]; journals?: unknown[];
} = {}) =>
  mockDb([
    { table: accountingPeriods, results: [[options.period ?? september]] },
    { table: journalEntryLines, results: [options.lines ?? usdLines] },
    { table: currencies, results: [[{ id: 2, code: "USD" }]] },
    { table: rateReferenceSnapshots, results: [options.snapshots ?? [closingSnapshot]] },
    { table: currencyRevaluations, results: [options.prior ?? []] },
    { table: journalEntries, results: [options.journals ?? []] },
  ]);

const writesTo = (transactions: Write[][], table: unknown) =>
  transactions.flat().filter((write) => write.table === table);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 91, entryNumber: "JU-202609-0012" } as never);
  vi.mocked(writeAudit).mockReset().mockResolvedValue(undefined as never);
});

describe("postCurrencyRevaluation", () => {
  it("menulis satu jurnal REVALUASI_KURS bersumber REVAL-2026-09", async () => {
    scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.sourceType).toBe("REVALUASI_KURS");
    expect(entry.sourceReference).toBe("REVAL-2026-09");
    expect(entry.lines).toEqual([
      { accountCode: "1-1220", side: "DEBIT", amount: "200000.00", memo: "Revaluasi kurs 2026-09" },
      { accountCode: "7-1500", side: "KREDIT", amount: "200000.00", memo: "Revaluasi kurs 2026-09" },
    ]);
  });

  it("bertanggal hari terakhir bulan itu, tengah malam lokal", async () => {
    scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.entryDate).toEqual(dbDay("2026-09-30"));
  });

  it("menulis satu baris bukti per mata uang", async () => {
    const { transactions } = scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    const inserted = writesTo(transactions, currencyRevaluations)[0]?.values as Record<string, unknown>[];
    expect(inserted.map((row) => [row.currencyId, row.foreignBalance, row.carryingBefore, row.carryingAfter, row.difference, row.journalEntryId]))
      .toEqual([[2, "1000.000000", "16300000.00", "16500000.00", "200000.00", 91]]);
  });

  it("menyimpan bukti kurs pada barisnya", async () => {
    const { transactions } = scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    const inserted = writesTo(transactions, currencyRevaluations)[0]?.values as Record<string, unknown>[];
    expect(inserted[0].rateSnapshotId).toBe(80);
    expect(inserted[0].midRatePerUnit).toBe("16500.000000000000");
  });

  it("menandai periodenya sudah direvaluasi di dalam transaksi yang sama", async () => {
    const { transactions } = scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].map((write) => write.table)).toEqual([currencyRevaluations, accountingPeriods]);
    const marker = transactions[0][1].values as Record<string, unknown>;
    expect(marker.revaluationPostedAt).toBeInstanceOf(Date);
    expect(marker.revaluationJournalEntryId).toBe(91);
  });

  it("menolak dijalankan dua kali", async () => {
    scenario({ period: { ...september, revaluationPostedAt: new Date("2026-10-01T08:00:00") } });
    await expect(postCurrencyRevaluation({ periodId: 16 }, { id: 3 })).rejects.toThrow(/sudah dijalankan/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("memakai ulang jurnal yang sudah tertulis bila percobaan sebelumnya gagal setelah menjurnal", async () => {
    // Kunci (REVALUASI_KURS, REVAL-2026-09) sudah terisi tetapi penanda periodenya kosong. Menulis
    // jurnal kedua hanya akan menabrak kunci unik dan mengunci bulan itu selamanya.
    const { transactions } = scenario({ journals: [{ id: 91, entryNumber: "JU-202609-0012" }] });
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    expect(postJournalEntry).not.toHaveBeenCalled();
    const marker = writesTo(transactions, accountingPeriods)[0]?.values as Record<string, unknown>;
    expect(marker.revaluationJournalEntryId).toBe(91);
  });

  it("menandai periode yang selisihnya nol sudah direvaluasi, tanpa menulis jurnal", async () => {
    // Kurs yang tidak bergerak adalah keadaan sah yang tetap harus bisa ditutup.
    const { transactions } = scenario({ lines: [] });
    const result = await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(result.skipped).toMatch(/tidak ada selisih kurs/i);
    const marker = writesTo(transactions, accountingPeriods)[0]?.values as Record<string, unknown>;
    expect(marker.revaluationPostedAt).toBeInstanceOf(Date);
    expect(marker.revaluationJournalEntryId).toBeNull();
  });

  it("menolak periode yang sudah ditutup", async () => {
    scenario({ period: { ...september, status: "DITUTUP" } });
    await expect(postCurrencyRevaluation({ periodId: 16 }, { id: 3 })).rejects.toThrow(/sudah ditutup/i);
  });

  it("membatalkan seluruhnya bila ada satu penghalang", async () => {
    // Revaluasi tidak pernah berjalan sebagian: buku besar yang setengah diretranslasi jauh lebih
    // sulit ditelusuri daripada yang belum diretranslasi sama sekali.
    scenario({ snapshots: [] });
    await expect(postCurrencyRevaluation({ periodId: 16 }, { id: 3 })).rejects.toThrow(/tidak ada kurs BI/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("menulis jejak audit berisi total dan rincian per mata uang", async () => {
    scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    const [audit] = vi.mocked(writeAudit).mock.calls[0];
    expect(audit.action).toBe("CURRENCY_REVALUATION_POSTED");
    expect(audit.entityType).toBe("accounting_periods");
    expect((audit.afterState as Record<string, unknown>).totalDifference).toBe("200000.00");
    expect((audit.afterState as Record<string, unknown>).currencies).toHaveLength(1);
  });
});
