import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountingPeriods, fixedAssetDepreciationEntries, fixedAssets } from "../drizzle/schema";
import * as db from "./db";

vi.mock("./ledgerOperations", () => ({ postJournalEntry: vi.fn() }));
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { postJournalEntry } from "./ledgerOperations";
import { writeAudit } from "./operations";
import { disposeFixedAsset } from "./fixedAssets";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

type Write = { op: "update"; table: unknown; values?: unknown };

function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const writes: Write[] = [];
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
    update: vi.fn((table: unknown) => ({
      set: (values: unknown) => ({
        where: () => {
          writes.push({ op: "update", table, values });
          return Promise.resolve();
        },
      }),
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { writes };
}

/** Brankas Rp 24.000.000, 48 bulan, mulai Maret 2026 → 500.000 per bulan. */
const brankas = {
  id: 1,
  name: "Brankas Chubb",
  acquisitionDate: dbDay("2026-03-17"),
  acquisitionCost: "24000000.00",
  residualValue: "0.00",
  usefulLifeMonths: 48,
  firstJournalMonth: "2026-03",
  openingAccumulatedDepreciation: "0.00",
  status: "AKTIF" as const,
  disposalDate: null,
};

const tanah = {
  ...brankas,
  id: 3,
  name: "Tanah Outlet",
  acquisitionDate: dbDay("2026-01-08"),
  acquisitionCost: "500000000.00",
  usefulLifeMonths: null,
  firstJournalMonth: "2026-01",
};

/** Maret, April, Mei sudah dijurnal — tiga bulan penuh. */
const threePostedMonths = [
  { assetId: 1, periodMonth: "2026-03", charge: "500000.00" },
  { assetId: 1, periodMonth: "2026-04", charge: "500000.00" },
  { assetId: 1, periodMonth: "2026-05", charge: "500000.00" },
];

const mayPeriod = { id: 9, periodStart: dbDay("2026-05-01"), periodEnd: dbDay("2026-05-31"), status: "TERBUKA" as const };

const scenario = (options: { asset?: unknown; entries?: unknown[]; period?: unknown } = {}) =>
  mockDb([
    { table: fixedAssets, results: [options.asset === null ? [] : [options.asset ?? brankas]] },
    { table: fixedAssetDepreciationEntries, results: [options.entries ?? threePostedMonths] },
    { table: accountingPeriods, results: [[options.period ?? mayPeriod]] },
  ]);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 92, entryNumber: "JU-202605-0007" } as never);
  vi.mocked(writeAudit).mockReset().mockResolvedValue(undefined as never);
});

describe("disposeFixedAsset", () => {
  it("memakai akumulasi yang benar-benar tercatat, bukan jadwal teoretisnya", async () => {
    // Tiga baris dijurnal @500.000 → akumulasi 1.500.000. Memakai jadwal akan mengeluarkan dari
    // 1-1520 lebih banyak daripada yang pernah masuk, dan neracanya tetap seimbang sementara
    // angkanya salah.
    scenario();
    await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "0.00" }, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    const accumulated = entry.lines.find((line) => line.accountCode === "1-1520");
    expect(accumulated?.amount).toBe("1500000.00");
  });

  it("menjurnal laba ke 7-1400 bersumber PELEPASAN_ASET", async () => {
    scenario();
    const result = await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "24000000.00" }, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.sourceType).toBe("PELEPASAN_ASET");
    expect(entry.sourceReference).toBe("LEPAS-1");
    expect(entry.entryDate).toEqual(dbDay("2026-05-31"));
    // Nilai buku 24.000.000 − 1.500.000 = 22.500.000; hasil 24.000.000 → laba 1.500.000.
    expect(result.gainLoss).toBe("1500000.00");
    expect(entry.lines).toContainEqual(
      expect.objectContaining({ accountCode: "7-1400", side: "KREDIT", amount: "1500000.00" }),
    );
  });

  it("menjurnal rugi ke 7-1400 bila hasilnya di bawah nilai buku", async () => {
    scenario();
    const result = await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "20000000.00" }, { id: 3 });
    expect(result.gainLoss).toBe("-2500000.00");
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.lines).toContainEqual(
      expect.objectContaining({ accountCode: "7-1400", side: "DEBIT", amount: "2500000.00" }),
    );
  });

  it("mencatat hasil pelepasan sebagai piutang, bukan sebagai kas", async () => {
    scenario();
    await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "20000000.00" }, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.lines.map((line) => line.accountCode)).toContain("1-1320");
    expect(entry.lines.map((line) => line.accountCode)).not.toContain("1-1110");
  });

  it("menandai asetnya DILEPAS beserta tanggal, hasil, dan jurnalnya", async () => {
    const { writes } = scenario();
    await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "1000000.00", notes: "Dijual ke rekanan" }, { id: 3 });
    const values = writes.find((write) => write.table === fixedAssets)?.values as Record<string, unknown>;
    expect(values.status).toBe("DILEPAS");
    expect(values.disposalDate).toEqual(dbDay("2026-05-31"));
    expect(values.disposalProceeds).toBe("1000000.00");
    expect(values.disposalJournalEntryId).toBe(92);
    expect(values.disposalNotes).toBe("Dijual ke rekanan");
  });

  it("menolak aset yang penyusutannya belum dijurnal sampai bulan pelepasan, menyebut bulannya", async () => {
    // Baris hanya sampai Maret, pelepasan Mei → April dan Mei tertinggal.
    scenario({ entries: [threePostedMonths[0]] });
    await expect(disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "0.00" }, { id: 3 }))
      .rejects.toThrow(/2026-04/);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("menyebut seluruh bulan yang tertinggal, bukan hanya yang pertama", async () => {
    scenario({ entries: [threePostedMonths[0]] });
    await expect(disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "0.00" }, { id: 3 }))
      .rejects.toThrow(/2026-05/);
  });

  it("menerima tanah tanpa menuntut baris penyusutan apa pun", async () => {
    scenario({ asset: tanah, entries: [] });
    await expect(disposeFixedAsset({ assetId: 3, disposalDate: "2026-05-31", proceeds: "600000000.00" }, { id: 3 }))
      .resolves.toBeTruthy();
  });

  it("menolak aset yang sudah dilepas", async () => {
    scenario({ asset: { ...brankas, status: "DILEPAS", disposalDate: dbDay("2026-05-31") } });
    await expect(disposeFixedAsset({ assetId: 1, disposalDate: "2026-06-30", proceeds: "0.00" }, { id: 3 }))
      .rejects.toThrow(/sudah dilepas/i);
  });

  it("menolak aset yang tidak ada", async () => {
    scenario({ asset: null });
    await expect(disposeFixedAsset({ assetId: 99, disposalDate: "2026-05-31", proceeds: "0.00" }, { id: 3 }))
      .rejects.toThrow(/tidak ditemukan/i);
  });

  it("menolak tanggal pelepasan yang mendahului tanggal perolehan", async () => {
    scenario();
    await expect(disposeFixedAsset({ assetId: 1, disposalDate: "2025-01-01", proceeds: "0.00" }, { id: 3 }))
      .rejects.toThrow(/perolehan/i);
  });

  it("menolak pelepasan yang jurnalnya jatuh pada periode tertutup", async () => {
    scenario({ period: { ...mayPeriod, status: "DITUTUP" } });
    await expect(disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "0.00" }, { id: 3 }))
      .rejects.toThrow(/ditutup/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("menulis jejak audit berisi nilai buku dan laba/ruginya", async () => {
    scenario();
    await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "24000000.00" }, { id: 3 });
    const [audit] = vi.mocked(writeAudit).mock.calls[0];
    expect(audit.action).toBe("FIXED_ASSET_DISPOSED");
    expect(audit.entityType).toBe("fixed_assets");
    const after = audit.afterState as Record<string, unknown>;
    expect(after.accumulated).toBe("1500000.00");
    expect(after.carryingAmount).toBe("22500000.00");
    expect(after.gainLoss).toBe("1500000.00");
  });
});
