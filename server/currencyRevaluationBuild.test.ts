import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountingPeriods,
  currencies,
  currencyRevaluations,
  journalEntryLines,
  rateReferenceSnapshots,
} from "../drizzle/schema";
import * as db from "./db";

vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { buildCurrencyRevaluation } from "./currencyRevaluation";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

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

const september = {
  id: 16,
  periodStart: dbDay("2026-09-01"),
  periodEnd: dbDay("2026-09-30"),
  status: "TERBUKA" as const,
  revaluationPostedAt: null,
};

/** USD 1.000 masuk pada kurs tengah 16.300 → tercatat Rp 16.300.000 di 1-1220. */
const usdLines = [
  { currencyCode: "USD", side: "DEBIT" as const, amount: "16300000.00", foreignAmount: "1000.000000" },
];

/** Kurs penutup 30 Sep: (16.400 + 16.600) / 2 = 16.500 → nilai baru 16.500.000, selisih +200.000. */
const closingSnapshot = {
  id: 80, currencyId: 2, referenceDate: dbDay("2026-09-30"),
  buyRate: "16400.000000", sellRate: "16600.000000", quoteUnit: "1.000000",
};

const usdCurrency = { id: 2, code: "USD" };

const scenario = (options: {
  period?: unknown; lines?: unknown[]; snapshots?: unknown[]; prior?: unknown[]; currencyRows?: unknown[];
} = {}) =>
  mockDb([
    { table: accountingPeriods, results: [[options.period ?? september]] },
    { table: journalEntryLines, results: [options.lines ?? usdLines] },
    { table: currencies, results: [options.currencyRows ?? [usdCurrency]] },
    { table: rateReferenceSnapshots, results: [options.snapshots ?? [closingSnapshot]] },
    { table: currencyRevaluations, results: [options.prior ?? []] },
  ]);

beforeEach(() => vi.restoreAllMocks());

describe("buildCurrencyRevaluation", () => {
  it("menghitung selisih antara nilai tercatat dan nilai pada kurs penutup", async () => {
    scenario();
    const plan = await buildCurrencyRevaluation(16);

    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({
      currencyCode: "USD",
      foreignBalance: "1000.000000",
      carryingBefore: "16300000.00",
      midRatePerUnit: "16500.000000000000",
      carryingAfter: "16500000.00",
      difference: "200000.00",
    });
    expect(plan.totalDifference).toBe("200000.00");
  });

  it("membaca saldo valuta dan nilai tercatat dari baris jurnal yang sama", async () => {
    // Keduanya harus datang dari sumber yang sama. Mengambil saldo valuta dari mutasi bank
    // sementara nilai Rupiahnya dari jurnal akan berselisih setiap kali ada mutasi yang dilewati
    // karena kursnya belum ada — dan selisih palsu itu akan dijurnal sebagai laba/rugi kurs.
    scenario({ lines: [
      { currencyCode: "USD", side: "DEBIT" as const, amount: "16000000.00", foreignAmount: "1000.000000" },
    ] });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows[0].carryingBefore).toBe("16000000.00");
    expect(plan.rows[0].difference).toBe("500000.00");
  });

  it("mengurangi baris kredit dari saldo maupun nilai tercatatnya", async () => {
    scenario({ lines: [
      ...usdLines,
      { currencyCode: "USD", side: "KREDIT" as const, amount: "6520000.00", foreignAmount: "400.000000" },
    ] });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows[0].foreignBalance).toBe("600.000000");
    expect(plan.rows[0].carryingBefore).toBe("9780000.00");
  });

  it("menyimpan bukti kurs yang dipakai beserta tanggalnya", async () => {
    scenario();
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows[0].rateSnapshotId).toBe(80);
    expect(plan.rows[0].rateReferenceDate).toBe("2026-09-30");
  });

  it("menambahkan selisih revaluasi periode sebelumnya ke nilai tercatat", async () => {
    // Revaluasi Agustus sudah menaikkan 1-1220 sebesar 100.000. Jurnal revaluasi tidak membawa
    // penanda mata uang — ia satu jurnal untuk semuanya — jadi sukunya diambil dari tabel buktinya.
    scenario({ prior: [{ currencyId: 2, periodId: 15, difference: "100000.00" }] });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows[0].carryingBefore).toBe("16400000.00");
    expect(plan.rows[0].difference).toBe("100000.00");
  });

  it("melewati mata uang yang saldonya nol tanpa menjadikannya penghalang", async () => {
    scenario({ lines: [
      ...usdLines,
      { currencyCode: "USD", side: "KREDIT" as const, amount: "16300000.00", foreignAmount: "1000.000000" },
    ] });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows).toEqual([]);
    expect(plan.blockers).toEqual([]);
  });

  it("menjadikan mata uang tanpa kurs sampai akhir periode sebagai penghalang beralasan", async () => {
    scenario({ snapshots: [] });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows).toEqual([]);
    expect(plan.blockers).toEqual([
      { currencyCode: "USD", reason: "tidak ada kurs BI sampai 2026-09-30" },
    ]);
  });

  it("mengabaikan baris 1-1220 yang tidak bermata uang", async () => {
    // Baris jurnal revaluasi itu sendiri menyentuh 1-1220 tanpa penanda mata uang. Menghitungnya
    // sebagai mutasi akan menggandakan selisih yang sudah pernah dijurnal.
    scenario({ lines: [
      ...usdLines,
      { currencyCode: null, side: "DEBIT" as const, amount: "200000.00", foreignAmount: null },
    ] });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows[0].carryingBefore).toBe("16300000.00");
  });

  it("melempar galat bernama bila periodenya tidak ada", async () => {
    mockDb([{ table: accountingPeriods, results: [[]] }]);
    await expect(buildCurrencyRevaluation(999)).rejects.toThrow(/tidak ditemukan/i);
  });
});
