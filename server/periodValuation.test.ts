import { describe, expect, it, vi } from "vitest";
import { accountingPeriods, cashBalances, currencies, periodClosingValuations, rateReferenceSnapshots, stockOpnames } from "../drizzle/schema";
import * as db from "./db";

vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, getOpnameSystemCounts: vi.fn() };
});

import { getOpnameSystemCounts } from "./operations";
import { buildPeriodValuation } from "./periodClosing";

/**
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data sama sekali.
 *
 * Berbeda dari `opnameSystemCounts.test.ts` yang membedakan kueri lewat urutan pemanggilan
 * `select`, di sini kueri dibedakan lewat **tabel** yang diberikan ke `from()`. Urutan kueri pada
 * `buildPeriodValuation` bergantung pada cabang — kueri penilaian periode sebelumnya hanya berjalan
 * bila periode itu ada — dan uji yang menghitung urutan akan pecah setiap kali cabangnya bergeser.
 * `accounting_periods` dibaca dua kali, jadi nilainya antre: periode ini lebih dulu, lalu periode
 * dinilai sebelumnya.
 */
function mockDb(tables: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(tables.map((entry) => [entry.table, [...entry.results]]));
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
        // Antrean yang habis mengulang hasil terakhirnya: kueri yang tidak diatur uji ini
        // mengembalikan kosong, bukan melempar galat yang menyamarkan penyebab sebenarnya.
        return chain((queue.length > 1 ? queue.shift() : queue[0]) ?? []);
      },
    })),
  };
  return vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

/** Kolom `date` MySQL kembali sebagai tengah malam **waktu lokal**, bukan tengah malam UTC. */
const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

const period = {
  id: 7,
  periodStart: dbDay("2026-09-01"),
  periodEnd: dbDay("2026-09-30"),
  status: "TERBUKA" as const,
  valuationPostedAt: null,
  valuationJournalEntryId: null,
  profitClosingPostedAt: null,
  profitClosingJournalEntryId: null,
};

const usdCurrency = { currencyId: 1, currencyCode: "USD", availableAmount: "12500.000000" };
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

const scenario = (options: {
  periods?: unknown[][];
  currencies?: unknown[];
  opnames?: unknown[];
  rates?: unknown[];
  valuations?: unknown[];
}) =>
  mockDb([
    { table: accountingPeriods, results: options.periods ?? [[period], []] },
    { table: currencies, results: [options.currencies ?? [usdCurrency]] },
    { table: stockOpnames, results: [options.opnames ?? [usdOpname]] },
    { table: rateReferenceSnapshots, results: [options.rates ?? [usdRate]] },
    { table: periodClosingValuations, results: [options.valuations ?? []] },
  ]);

const emptyCounts = { counter: [], safe: [] };

describe("buildPeriodValuation", () => {
  it("menilai satu mata uang dari opname terakhir di dalam periode dan kurs tengah BI", async () => {
    const getDb = scenario({});

    const result = await buildPeriodValuation(7);

    expect(result.blockers).toEqual([]);
    expect(result.rows).toEqual([
      {
        currencyId: 1,
        currencyCode: "USD",
        quantity: "12500.000000",
        stockOpnameId: 900,
        opnameDate: "2026-09-30",
        rateSnapshotId: 500,
        rateReferenceDate: "2026-09-30",
        buyRate: "16200.000000",
        sellRate: "16400.000000",
        quoteUnit: "1.000000",
        midRatePerUnit: "16300.000000000000",
        rupiahValue: "203750000.00",
      },
    ]);
    expect(result.closingValue).toBe("203750000.00");
    expect(result.periodStart).toBe("2026-09-01");
    expect(result.periodEnd).toBe("2026-09-30");
    expect(result.isFiscalYearEnd).toBe(false);
    getDb.mockRestore();
  });

  it("mengecualikan IDR sepenuhnya meski opname Rupiahnya ada dan bersaldo besar", async () => {
    // Uji terpenting di berkas ini. Memasukkan IDR menghitung kas Rupiah dua kali — sekali pada
    // 1-1110 dan sekali lagi pada 1-1210 — dan neracanya **tetap seimbang**, sehingga kekeliruannya
    // tidak akan terlihat dari laporan mana pun.
    const getDb = scenario({
      currencies: [usdCurrency, { currencyId: 2, currencyCode: "IDR", availableAmount: "900000000.000000" }],
      opnames: [
        usdOpname,
        { id: 901, currencyId: 2, opnameDate: dbDay("2026-09-30"), physicalBalance: "900000000.000000", reconciliationStatus: "RECONCILED" },
      ],
      rates: [usdRate, { id: 501, currencyId: 2, referenceDate: dbDay("2026-09-30"), buyRate: "1.000000", sellRate: "1.000000", quoteUnit: "1.000000" }],
    });

    const result = await buildPeriodValuation(7);

    expect(result.rows.map((row) => row.currencyCode)).toEqual(["USD"]);
    expect(result.blockers).toEqual([]);
    getDb.mockRestore();
  });

  it("memakai opname yang lebih awal bila akhir periode tidak dihitung, dan menyebut tanggalnya", async () => {
    const getDb = scenario({
      opnames: [
        { ...usdOpname, id: 880, opnameDate: dbDay("2026-09-28") },
        { ...usdOpname, id: 870, opnameDate: dbDay("2026-09-20") },
      ],
    });

    const result = await buildPeriodValuation(7);

    expect(result.rows[0]?.stockOpnameId).toBe(880);
    expect(result.rows[0]?.opnameDate).toBe("2026-09-28");
    getDb.mockRestore();
  });

  it("menolak mata uang yang tidak punya opname sama sekali di dalam periode", async () => {
    vi.mocked(getOpnameSystemCounts).mockResolvedValue({ counter: [], safe: [{ value: "100.000000", quantity: 3 }] } as never);
    const getDb = scenario({ opnames: [] });

    const result = await buildPeriodValuation(7);

    expect(result.rows).toEqual([]);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]?.currencyCode).toBe("USD");
    expect(result.blockers[0]?.reason).toMatch(/opname/i);
    getDb.mockRestore();
  });

  it("menolak opname yang belum ditinjau — OPEN maupun SUBMITTED bukan bukti", async () => {
    const getDb = scenario({ opnames: [{ ...usdOpname, reconciliationStatus: "SUBMITTED" }] });

    const result = await buildPeriodValuation(7);

    expect(result.rows).toEqual([]);
    expect(result.blockers[0]?.reason).toMatch(/SUBMITTED/);
    getDb.mockRestore();
  });

  it("menerima opname berstatus VARIANCE — hitungan fisik yang sudah ditinjau tetap bukti", async () => {
    const getDb = scenario({ opnames: [{ ...usdOpname, reconciliationStatus: "VARIANCE" }] });

    const result = await buildPeriodValuation(7);

    expect(result.blockers).toEqual([]);
    expect(result.rows[0]?.rupiahValue).toBe("203750000.00");
    getDb.mockRestore();
  });

  it("memundurkan kurs ke snapshot terakhir sebelum akhir periode, dan menyebut tanggal yang dipakai", async () => {
    // 30 September 2026 boleh saja hari libur; BI tidak mengumumkan kurs hari itu. Keputusan
    // pengguna 5: boleh mundur, tetapi tanggalnya harus terbaca.
    const getDb = scenario({ rates: [{ ...usdRate, id: 480, referenceDate: dbDay("2026-09-28") }] });

    const result = await buildPeriodValuation(7);

    expect(result.rows[0]?.rateSnapshotId).toBe(480);
    expect(result.rows[0]?.rateReferenceDate).toBe("2026-09-28");
    getDb.mockRestore();
  });

  it("menolak kurs yang jatuh sebelum awal periode — itu sinkronisasi BI yang tertinggal", async () => {
    const getDb = scenario({ rates: [{ ...usdRate, id: 300, referenceDate: dbDay("2026-08-15") }] });

    const result = await buildPeriodValuation(7);

    expect(result.rows).toEqual([]);
    expect(result.blockers[0]?.reason).toMatch(/sinkronisasi kurs BI/i);
    expect(result.blockers[0]?.reason).toContain("2026-08-15");
    getDb.mockRestore();
  });

  it("melewati mata uang tanpa opname yang stoknya memang nol, tanpa penghalang dan tanpa baris", async () => {
    vi.mocked(getOpnameSystemCounts).mockResolvedValue(emptyCounts as never);
    const getDb = scenario({
      currencies: [{ currencyId: 3, currencyCode: "SGD", availableAmount: "0.000000" }],
      opnames: [],
      rates: [],
    });

    const result = await buildPeriodValuation(7);

    expect(result.rows).toEqual([]);
    expect(result.blockers).toEqual([]);
    getDb.mockRestore();
  });

  it("membaca nilai persediaan awal dari periode dinilai sebelumnya, dan nol bila belum pernah ada", async () => {
    const withPrior = scenario({
      periods: [[period], [{ id: 6 }]],
      valuations: [{ total: "180000000.000000" }],
    });
    expect((await buildPeriodValuation(7)).priorClosingValue).toBe("180000000.00");
    withPrior.mockRestore();

    const withoutPrior = scenario({ periods: [[period], []] });
    expect((await buildPeriodValuation(7)).priorClosingValue).toBe("0.00");
    withoutPrior.mockRestore();
  });
});
