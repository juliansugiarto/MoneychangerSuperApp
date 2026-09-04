import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountingPeriods, fixedAssetDepreciationEntries, fixedAssets } from "../drizzle/schema";
import * as db from "./db";

vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { buildMonthlyDepreciation } from "./fixedAssets";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

/**
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data.
 *
 * Kueri dibedakan lewat **tabel** yang diberikan ke `from()`, bukan lewat urutan pemanggilan —
 * pola yang sama seperti `periodValuation.test.ts`. Tiap uji menyiapkan keadaannya sendiri dan
 * tidak mewarisi keadaan dari uji sebelumnya.
 */
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

const marchPeriod = {
  id: 7,
  periodStart: dbDay("2026-03-01"),
  periodEnd: dbDay("2026-03-31"),
  status: "TERBUKA" as const,
  depreciationPostedAt: null,
};

/** Brankas Rp 24.000.000, 48 bulan, mulai Maret 2026 → 500.000 per bulan. */
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

/** Kendaraan Rp 240.000.000, 96 bulan, mulai Januari 2026 → 2.500.000 per bulan. */
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

const tanah = {
  id: 3,
  assetCode: null,
  name: "Tanah Outlet",
  category: "TANAH" as const,
  acquisitionDate: dbDay("2026-01-08"),
  acquisitionCost: "500000000.00",
  residualValue: "0.00",
  usefulLifeMonths: null,
  firstJournalMonth: "2026-01",
  openingAccumulatedDepreciation: "0.00",
  status: "AKTIF" as const,
  disposalDate: null,
};

const scenario = (options: { period?: unknown; assets?: unknown[]; entries?: unknown[] } = {}) =>
  mockDb([
    { table: accountingPeriods, results: [options.period === null ? [] : [options.period ?? marchPeriod]] },
    { table: fixedAssets, results: [options.assets ?? [brankas, kendaraan]] },
    { table: fixedAssetDepreciationEntries, results: [options.entries ?? []] },
  ]);

beforeEach(() => vi.restoreAllMocks());

describe("buildMonthlyDepreciation", () => {
  it("menghitung beban tiap aset aktif untuk bulan periode itu", async () => {
    scenario();
    const result = await buildMonthlyDepreciation(7);
    expect(result.periodMonth).toBe("2026-03");
    expect(result.rows.map((row) => [row.assetName, row.charge])).toEqual([
      ["Brankas Chubb", "500000.00"],
      ["Kendaraan Operasional", "2500000.00"],
    ]);
    expect(result.totalCharge).toBe("3000000.00");
  });

  it("menghitung akumulasi sesudahnya dari baris yang sudah dijurnal, bukan dari jadwalnya", async () => {
    // Brankas sudah punya satu baris Maret senilai 500.000; April harus berakumulasi 1.000.000.
    scenario({
      period: { ...marchPeriod, id: 8, periodStart: dbDay("2026-04-01"), periodEnd: dbDay("2026-04-30") },
      assets: [brankas],
      entries: [{ assetId: 1, periodMonth: "2026-03", charge: "500000.00" }],
    });
    const result = await buildMonthlyDepreciation(8);
    expect(result.rows[0].charge).toBe("500000.00");
    expect(result.rows[0].accumulatedAfter).toBe("1000000.00");
    expect(result.rows[0].carryingAfter).toBe("23000000.00");
  });

  it("melewati aset yang belum diperoleh pada bulan itu", async () => {
    scenario({ period: { ...marchPeriod, id: 6, periodStart: dbDay("2026-02-01"), periodEnd: dbDay("2026-02-28") } });
    const result = await buildMonthlyDepreciation(6);
    expect(result.rows.map((row) => row.assetName)).not.toContain("Brankas Chubb");
    expect(result.rows.map((row) => row.assetName)).toContain("Kendaraan Operasional");
  });

  it("melewati tanah tanpa menjadikannya penghalang", async () => {
    scenario({ assets: [brankas, tanah] });
    const result = await buildMonthlyDepreciation(7);
    expect(result.rows.map((row) => row.assetName)).not.toContain("Tanah Outlet");
    expect(result.blockers).toEqual([]);
  });

  it("melewati aset yang habis disusutkan tanpa galat — asetnya tetap terdaftar", async () => {
    scenario({
      period: { ...marchPeriod, id: 60, periodStart: dbDay("2031-03-01"), periodEnd: dbDay("2031-03-31") },
      assets: [brankas],
    });
    const result = await buildMonthlyDepreciation(60);
    expect(result.rows).toEqual([]);
    expect(result.totalCharge).toBe("0.00");
    expect(result.blockers).toEqual([]);
  });

  it("melewati aset yang sudah dilepas sebelum bulan itu", async () => {
    scenario({ assets: [brankas, { ...kendaraan, status: "DILEPAS", disposalDate: dbDay("2026-02-28") }] });
    const result = await buildMonthlyDepreciation(7);
    expect(result.rows.map((row) => row.assetName)).not.toContain("Kendaraan Operasional");
  });

  it("tetap menyusutkan aset yang dilepas di dalam bulan itu", async () => {
    scenario({ assets: [{ ...kendaraan, status: "DILEPAS", disposalDate: dbDay("2026-03-20") }] });
    const result = await buildMonthlyDepreciation(7);
    expect(result.rows.map((row) => row.assetName)).toContain("Kendaraan Operasional");
  });

  it("mengembalikan aset yang bulan itu sudah dijurnal sebagai penghalang, bukan barisnya", async () => {
    scenario({ assets: [brankas], entries: [{ assetId: 1, periodMonth: "2026-03", charge: "500000.00" }] });
    const result = await buildMonthlyDepreciation(7);
    expect(result.rows).toEqual([]);
    expect(result.blockers).toEqual([
      { assetName: "Brankas Chubb", reason: "penyusutan bulan 2026-03 sudah dijurnal" },
    ]);
  });

  it("menolak periode yang tidak ada", async () => {
    scenario({ period: null });
    await expect(buildMonthlyDepreciation(999)).rejects.toThrow(/tidak ditemukan/i);
  });

  it("membagi sisa dasar penyusutan aset warisan atas sisa bulannya, bukan atas umur manfaat penuh", async () => {
    // Dibeli Maret 2024, jurnal pertama September 2026, akumulasi awal 15.000.000 dari 24.000.000
    // atas 48 bulan. Sisa 18 bulan × 500.000 — bukan 9.000.000 / 48 = 187.500.
    const warisan = {
      ...brankas,
      acquisitionDate: dbDay("2024-03-05"),
      firstJournalMonth: "2026-09",
      openingAccumulatedDepreciation: "15000000.00",
    };
    scenario({
      period: { ...marchPeriod, id: 13, periodStart: dbDay("2026-09-01"), periodEnd: dbDay("2026-09-30") },
      assets: [warisan],
    });
    const result = await buildMonthlyDepreciation(13);
    expect(result.rows[0].charge).toBe("500000.00");
    expect(result.rows[0].accumulatedAfter).toBe("15500000.00");
    expect(result.rows[0].carryingAfter).toBe("8500000.00");
  });

  it("menyatakan total nol untuk outlet tanpa aset tersusutkan, bukan galat", async () => {
    scenario({ assets: [] });
    const result = await buildMonthlyDepreciation(7);
    expect(result.rows).toEqual([]);
    expect(result.totalCharge).toBe("0.00");
    expect(result.blockers).toEqual([]);
  });

  it("meneruskan status dan penanda periodenya supaya panel dapat mematikan tombolnya", async () => {
    const postedAt = new Date("2026-04-01T08:00:00");
    scenario({ period: { ...marchPeriod, status: "DITUTUP", depreciationPostedAt: postedAt } });
    const result = await buildMonthlyDepreciation(7);
    expect(result.status).toBe("DITUTUP");
    expect(result.depreciationPostedAt).toEqual(postedAt);
    expect(result.periodStart).toBe("2026-03-01");
    expect(result.periodEnd).toBe("2026-03-31");
  });
});
