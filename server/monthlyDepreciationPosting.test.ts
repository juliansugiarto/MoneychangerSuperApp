import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountingPeriods,
  fixedAssetDepreciationEntries,
  fixedAssets,
  journalEntries,
} from "../drizzle/schema";
import * as db from "./db";

vi.mock("./ledgerOperations", () => ({ postJournalEntry: vi.fn() }));
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { postJournalEntry } from "./ledgerOperations";
import { writeAudit } from "./operations";
import { postMonthlyDepreciation } from "./fixedAssets";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

type Write = { op: "insert" | "update"; table: unknown; values?: unknown };

/**
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data.
 *
 * Selain membaca, fake ini merekam **tulisannya** beserta transaksinya — pola sama seperti
 * `periodClosingPosting.test.ts`. Baris rincian yang tersimpan tanpa penanda periodenya terlihat
 * seperti penyusutan yang belum berjalan padahal jurnalnya sudah ada, dan itu hanya dapat dicegah
 * oleh transaksi, bukan oleh urutan pemanggilan.
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
      values: (values: unknown) => {
        log.push({ op: "insert", table, values });
        return Promise.resolve();
      },
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: () => {
          log.push({ op: "update", table, values });
          return Promise.resolve();
        },
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

const marchPeriod = {
  id: 7,
  periodStart: dbDay("2026-03-01"),
  periodEnd: dbDay("2026-03-31"),
  status: "TERBUKA" as const,
  depreciationPostedAt: null,
};

const brankas = {
  id: 1,
  assetCode: "AT-001",
  name: "Brankas Chubb",
  category: "PERALATAN_KANTOR" as const,
  acquisitionDate: dbDay("2026-03-17"),
  acquisitionCost: "24000000.00",
  residualValue: "0.00",
  usefulLifeMonths: 48,
  firstJournalMonth: "2026-03",
  openingAccumulatedDepreciation: "0.00",
  status: "AKTIF" as const,
  disposalDate: null,
};

const kendaraan = {
  id: 2,
  assetCode: null,
  name: "Kendaraan Operasional",
  category: "KENDARAAN" as const,
  acquisitionDate: dbDay("2026-01-08"),
  acquisitionCost: "240000000.00",
  residualValue: "0.00",
  usefulLifeMonths: 96,
  firstJournalMonth: "2026-01",
  openingAccumulatedDepreciation: "0.00",
  status: "AKTIF" as const,
  disposalDate: null,
};

const scenario = (options: { period?: unknown; assets?: unknown[]; entries?: unknown[]; journals?: unknown[] } = {}) =>
  mockDb([
    { table: accountingPeriods, results: [[options.period ?? marchPeriod]] },
    { table: fixedAssets, results: [options.assets ?? [brankas, kendaraan]] },
    { table: fixedAssetDepreciationEntries, results: [options.entries ?? []] },
    { table: journalEntries, results: [options.journals ?? []] },
  ]);

const writesTo = (transactions: Write[][], table: unknown) =>
  transactions.flat().filter((write) => write.table === table);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 91, entryNumber: "JU-202603-0004" } as never);
  vi.mocked(writeAudit).mockReset().mockResolvedValue(undefined as never);
});

describe("postMonthlyDepreciation", () => {
  it("menulis satu jurnal untuk seluruh aset, bersumber PENYUSUTAN", async () => {
    scenario();
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.sourceType).toBe("PENYUSUTAN");
    expect(entry.sourceReference).toBe("SUSUT-2026-03");
    expect(entry.lines).toEqual([
      { accountCode: "6-1700", side: "DEBIT", amount: "3000000.00", memo: "Penyusutan aset tetap 2026-03" },
      { accountCode: "1-1520", side: "KREDIT", amount: "3000000.00", memo: "Penyusutan aset tetap 2026-03" },
    ]);
  });

  it("bertanggal hari terakhir bulan itu, tengah malam lokal", async () => {
    scenario();
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.entryDate).toEqual(dbDay("2026-03-31"));
  });

  it("menulis satu baris rincian per aset", async () => {
    const { transactions } = scenario();
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    const inserted = writesTo(transactions, fixedAssetDepreciationEntries)[0]?.values as Record<string, unknown>[];
    expect(inserted.map((row) => [row.assetId, row.periodMonth, row.charge, row.journalEntryId])).toEqual([
      [1, "2026-03", "500000.00", 91],
      [2, "2026-03", "2500000.00", 91],
    ]);
  });

  it("menandai periodenya sudah disusutkan di dalam transaksi yang sama", async () => {
    const { transactions } = scenario();
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    // Satu transaksi memuat keduanya: baris tanpa penanda membuat penyusutan tampak belum
    // berjalan padahal jurnalnya sudah ada.
    expect(transactions).toHaveLength(1);
    expect(transactions[0].map((write) => write.table)).toEqual([fixedAssetDepreciationEntries, accountingPeriods]);
    const marker = transactions[0][1].values as Record<string, unknown>;
    expect(marker.depreciationPostedAt).toBeInstanceOf(Date);
    expect(marker.depreciationJournalEntryId).toBe(91);
  });

  it("menolak dijalankan dua kali", async () => {
    scenario({ period: { ...marchPeriod, depreciationPostedAt: new Date("2026-04-01T08:00:00") } });
    await expect(postMonthlyDepreciation({ periodId: 7 }, { id: 3 })).rejects.toThrow(/sudah dijalankan/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("memakai ulang jurnal yang sudah tertulis bila percobaan sebelumnya gagal setelah menjurnal", async () => {
    // Kunci (PENYUSUTAN, SUSUT-2026-03) sudah terisi, tetapi penanda periodenya kosong. Menulis
    // jurnal kedua hanya akan menabrak kunci unik dan mengunci bulan itu selamanya.
    const { transactions } = scenario({ journals: [{ id: 91, entryNumber: "JU-202603-0004" }] });
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    expect(postJournalEntry).not.toHaveBeenCalled();
    const marker = writesTo(transactions, accountingPeriods)[0]?.values as Record<string, unknown>;
    expect(marker.depreciationJournalEntryId).toBe(91);
  });

  it("menandai periode yang bebannya nol sudah disusutkan, tanpa menulis jurnal", async () => {
    const { transactions } = scenario({ assets: [] });
    const result = await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(result.skipped).toMatch(/tidak ada beban penyusutan/i);
    const marker = writesTo(transactions, accountingPeriods)[0]?.values as Record<string, unknown>;
    expect(marker.depreciationPostedAt).toBeInstanceOf(Date);
    expect(marker.depreciationJournalEntryId).toBeNull();
  });

  it("menolak periode yang sudah ditutup", async () => {
    scenario({ period: { ...marchPeriod, status: "DITUTUP" } });
    await expect(postMonthlyDepreciation({ periodId: 7 }, { id: 3 })).rejects.toThrow(/sudah ditutup/i);
  });

  it("membatalkan seluruhnya bila ada satu penghalang", async () => {
    // Penyusutan tidak pernah berjalan sebagian: buku besar yang setengah disusutkan jauh lebih
    // sulit ditelusuri daripada yang belum disusutkan sama sekali.
    scenario({ entries: [{ assetId: 1, periodMonth: "2026-03", charge: "500000.00" }] });
    await expect(postMonthlyDepreciation({ periodId: 7 }, { id: 3 })).rejects.toThrow(/sudah dijurnal/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("menulis jejak audit berisi total dan rincian per aset", async () => {
    scenario();
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    const [audit] = vi.mocked(writeAudit).mock.calls[0];
    expect(audit.action).toBe("MONTHLY_DEPRECIATION_POSTED");
    expect(audit.entityType).toBe("accounting_periods");
    expect((audit.afterState as Record<string, unknown>).totalCharge).toBe("3000000.00");
    expect((audit.afterState as Record<string, unknown>).assets).toHaveLength(2);
  });
});
