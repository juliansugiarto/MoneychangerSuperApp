import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, accountBalancesFor: vi.fn(), loadLines: vi.fn() };
});
vi.mock("./settlements", () => ({ listOutstandingSettlements: vi.fn() }));

import {
  accountingPeriods,
  currencies,
  currencyRevaluations,
  fixedAssetDepreciationEntries,
  fixedAssets,
  operationalExpenses,
  periodClosingValuations,
} from "../drizzle/schema";
import { parseAmount } from "../shared/ledger";
import * as db from "./db";
import { buildGeneratedNotes } from "./financialNotes";
import { accountBalancesFor, loadLines } from "./ledgerOperations";
import { listOutstandingSettlements } from "./settlements";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);
const range = { from: dbDay("2026-09-01"), to: dbDay("2026-09-30") };

const at = (entries: Record<string, string>) =>
  Object.entries(entries).map(([accountCode, amount]) => ({ accountCode, balance: parseAmount(amount) }));

function mockDb(tables: Partial<Record<string, unknown[]>> = {}) {
  const queues = new Map<unknown, unknown[]>([
    [accountingPeriods, tables.periods ?? [{ id: 16, periodEnd: dbDay("2026-09-30") }]],
    [periodClosingValuations, tables.valuations ?? []],
    [currencyRevaluations, tables.revaluations ?? []],
    [currencies, tables.currencies ?? [{ id: 2, code: "USD" }]],
    [fixedAssets, tables.assets ?? []],
    [fixedAssetDepreciationEntries, tables.depreciation ?? []],
    [operationalExpenses, tables.expenses ?? []],
  ]);
  const chain = (rows: unknown[]): any => {
    const thenable = Promise.resolve(rows) as any;
    for (const method of ["where", "innerJoin", "orderBy", "limit"]) thenable[method] = () => chain(rows);
    return thenable;
  };
  vi.spyOn(db, "getDb").mockResolvedValue({
    select: () => ({ from: (table: unknown) => chain((queues.get(table) as unknown[]) ?? []) }),
  } as never);
}

const noteOf = (notes: Awaited<ReturnType<typeof buildGeneratedNotes>>, key: string) => notes.find((note) => note.key === key)!;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(accountBalancesFor).mockReset().mockResolvedValue([]);
  vi.mocked(loadLines).mockReset().mockResolvedValue([] as never);
  vi.mocked(listOutstandingSettlements).mockReset().mockResolvedValue({ payables: [], receivables: [] } as never);
});

describe("catatan CALK yang dibangkitkan", () => {
  it("menghasilkan tepat delapan catatan bangkitan", async () => {
    mockDb();
    const notes = await buildGeneratedNotes(range);
    expect(notes).toHaveLength(8);
    expect(notes.every((note) => note.kind === "BANGKITAN")).toBe(true);
  });

  it("merinci kas dan setara kas beserta saldo valutanya, tanpa memasukkan Kas UKA", async () => {
    mockDb();
    vi.mocked(accountBalancesFor).mockResolvedValue(at({ "1-1110": "5000000.00", "1-1220": "16300000.00", "1-1210": "210050000.00" }));
    vi.mocked(loadLines).mockResolvedValue([
      { currencyCode: "USD", foreignAmount: "1000.000000", side: "DEBIT" },
    ] as never);

    const note = noteOf(await buildGeneratedNotes(range), "KAS_DAN_SETARA_KAS");
    const codes = note.table.rows.map((row) => row[0]);
    // 1-1210 adalah persediaan, bukan setara kas — memasukkannya menghitung pergerakan yang sama dua kali.
    expect(codes).not.toContain("1-1210");
    expect(note.table.rows.some((row) => row[2] === "16300000.00")).toBe(true);
    expect(note.table.rows.some((row) => row[2] === "1000.00 USD")).toBe(true);
  });

  it("memperingatkan bila rincian 2-1900 tidak sama dengan saldo akunnya", async () => {
    // Selisihnya berarti ada beban yang belum dijurnal, atau jurnal yang menyentuh 2-1900 di luar
    // modulnya. Menampilkan saldo akunnya saja akan menyembunyikan keduanya.
    mockDb();
    vi.mocked(accountBalancesFor).mockResolvedValue(at({ "2-1900": "24000000.00" }));
    vi.mocked(listOutstandingSettlements).mockResolvedValue({
      payables: [{ targetType: "ASET_TETAP", targetId: 2, label: "Kendaraan", originDate: "2026-09-01", originalAmount: "24000000.00", settledAmount: "4000000.00", outstandingAmount: "20000000.00", direction: "PEMBAYARAN", journalEntryId: 55 }],
      receivables: [],
    } as never);

    const note = noteOf(await buildGeneratedNotes(range), "KEWAJIBAN_LAIN_LAIN");
    expect(note.warning).toMatch(/berbeda dari saldo 2-1900/);
  });

  it("diam ketika rincian 2-1900 sudah sejalan dengan saldonya", async () => {
    mockDb();
    vi.mocked(accountBalancesFor).mockResolvedValue(at({ "2-1900": "20000000.00" }));
    vi.mocked(listOutstandingSettlements).mockResolvedValue({
      payables: [{ targetType: "ASET_TETAP", targetId: 2, label: "Kendaraan", originDate: "2026-09-01", originalAmount: "24000000.00", settledAmount: "4000000.00", outstandingAmount: "20000000.00", direction: "PEMBAYARAN", journalEntryId: 55 }],
      receivables: [],
    } as never);

    expect(noteOf(await buildGeneratedNotes(range), "KEWAJIBAN_LAIN_LAIN").warning).toBeUndefined();
  });

  it("merinci aset tetap beserta beban penyusutan yang benar-benar dijurnal", async () => {
    mockDb({
      assets: [{ id: 2, name: "Kendaraan operasional", category: "KENDARAAN", acquisitionDate: dbDay("2026-09-01"), acquisitionCost: "24000000.00", openingAccumulatedDepreciation: "0.00", usefulLifeMonths: 48, status: "AKTIF", disposalDate: null }],
      depreciation: [{ assetId: 2, charge: "500000.00", accumulatedAfter: "500000.00" }],
    });

    const note = noteOf(await buildGeneratedNotes(range), "ASET_TETAP");
    expect(note.table.rows[0]).toEqual([
      "Kendaraan operasional", "KENDARAAN", "2026-09-01", "24000000.00", "500000.00", "23500000.00", "48 bulan", "500000.00", "Aktif",
    ]);
  });

  it("merinci selisih kurs per mata uang beserta kurs dan tanggalnya", async () => {
    mockDb({
      revaluations: [{ currencyId: 2, foreignBalance: "1000.000000", midRatePerUnit: "16300.000000000000", rateReferenceDate: dbDay("2026-09-30"), carryingBefore: "17636000.00", carryingAfter: "16300000.00", difference: "-1336000.00" }],
    });

    const note = noteOf(await buildGeneratedNotes(range), "SELISIH_KURS");
    expect(note.table.rows[0][0]).toBe("USD");
    expect(note.table.rows[0][6]).toBe("-1336000.00");
  });

  it("mengungkapkan perolehan aset lewat kewajiban sebagai transaksi nonkas", async () => {
    // SAK EP mengeluarkannya dari Arus Kas dan memintanya diungkapkan di sini — bukan disajikan
    // sebagai arus kas yang tidak pernah terjadi.
    mockDb({ assets: [{ id: 2, name: "Kendaraan operasional", category: "KENDARAAN", acquisitionDate: dbDay("2026-09-01"), acquisitionCost: "24000000.00", openingAccumulatedDepreciation: "0.00", usefulLifeMonths: 48, status: "AKTIF", disposalDate: null }] });
    vi.mocked(listOutstandingSettlements).mockResolvedValue({
      payables: [{ targetType: "ASET_TETAP", targetId: 2, label: "Kendaraan operasional", originDate: "2026-09-01", originalAmount: "24000000.00", settledAmount: "0.00", outstandingAmount: "24000000.00", direction: "PEMBAYARAN", journalEntryId: 55 }],
      receivables: [],
    } as never);

    const note = noteOf(await buildGeneratedNotes(range), "TRANSAKSI_NONKAS");
    expect(note.table.rows[0]).toEqual(["Perolehan aset tetap lewat kewajiban", "Kendaraan operasional", "2026-09-01", "24000000.00"]);
  });

  it("tidak mengungkapkan kewajiban dari periode lain sebagai transaksi nonkas periode ini", async () => {
    mockDb({ assets: [{ id: 2, name: "Kendaraan operasional", category: "KENDARAAN", acquisitionDate: dbDay("2026-07-15"), acquisitionCost: "24000000.00", openingAccumulatedDepreciation: "0.00", usefulLifeMonths: 48, status: "AKTIF", disposalDate: null }] });
    vi.mocked(listOutstandingSettlements).mockResolvedValue({
      payables: [{ targetType: "ASET_TETAP", targetId: 2, label: "Kendaraan operasional", originDate: "2026-07-15", originalAmount: "24000000.00", settledAmount: "0.00", outstandingAmount: "24000000.00", direction: "PEMBAYARAN", journalEntryId: 55 }],
      receivables: [],
    } as never);

    expect(noteOf(await buildGeneratedNotes(range), "TRANSAKSI_NONKAS").table.rows).toHaveLength(0);
  });
});

describe("kolom uang pada tabel catatan", () => {
  it("menandai kolom Rupiah, dan tidak menandai kurs maupun kuantitas valuta", async () => {
    // Kolom kurs diformat bergaya Rupiah akan kehilangan desimal yang justru menjadi buktinya —
    // pemeriksa menurunkan ulang nilai penilaian dari kuantitas dikali kurs itu.
    mockDb();
    const notes = await buildGeneratedNotes(range);
    const selisihKurs = noteOf(notes, "SELISIH_KURS");
    expect(selisihKurs.table.moneyColumns).toEqual([4, 5, 6]);
    expect(selisihKurs.table.columns[2]).toBe("Kurs tengah");

    const persediaan = noteOf(notes, "PERSEDIAAN_UKA");
    expect(persediaan.table.moneyColumns).toEqual([5]);
  });

  it("tidak pernah menunjuk kolom yang tidak ada", async () => {
    mockDb();
    for (const note of await buildGeneratedNotes(range)) {
      for (const index of note.table.moneyColumns) {
        expect(index).toBeLessThan(note.table.columns.length);
      }
    }
  });
});
