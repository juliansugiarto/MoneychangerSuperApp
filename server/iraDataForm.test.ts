import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import {
  foldCustomerComposition,
  foldTransactionComposition,
  readIraDataForm,
  type IraCustomerRow,
  type IraTransactionRow,
} from "./iraDataForm";

/**
 * Agregat Form C1 — komposisi seluruh lembaga selama satu periode penilaian.
 *
 * Pertanyaan yang berbeda dari Paket H: di sana aktivitas satu nasabah satu bulan, di sini komposisi
 * lembaganya. Karena itu pembacanya baru, tetapi daftar status dan helper jendela waktunya dipakai
 * ulang, tidak diturunkan ulang.
 */

const periodStart = new Date("2026-09-01T00:00:00.000Z");
const periodEnd = new Date("2026-10-01T00:00:00.000Z");

describe("agregat Form C1 — lipatan transaksi", () => {
  /**
   * Jebakan bon berbaris banyak. `exchange_transactions.rupiahAmount` adalah nilai **bonnya**;
   * menjumlahkan hasil join baris apa adanya menghitung bon yang sama berkali-kali. Omzet per mata
   * uang justru harus datang dari `exchange_transaction_lines.rupiahAmount`.
   */
  it("menjumlahkan omzet per mata uang dari bon berbaris banyak tanpa menggandakan bonnya", () => {
    const rows: IraTransactionRow[] = [
      { source: "LINE", transactionId: 1, bonRupiahAmount: "30000000.00", lineRupiahAmount: "20000000.00", currencyCode: "USD", distributionChannel: "KANTOR", nationality: "ID" },
      { source: "LINE", transactionId: 1, bonRupiahAmount: "30000000.00", lineRupiahAmount: "10000000.00", currencyCode: "SGD", distributionChannel: "KANTOR", nationality: "ID" },
    ];
    const hasil = foldTransactionComposition(rows, new Map());

    expect(hasil.transactionCount).toBe(1);
    expect(hasil.totalRupiah).toBe("30000000.00");
    expect(hasil.currencyTurnover).toEqual([
      { code: "USD", rupiah: "20000000.00", sharePercent: "66.67" },
      { code: "SGD", rupiah: "10000000.00", sharePercent: "33.33" },
    ]);
  });

  it("membaca mata uang dari currencyId pada bon lama DAN dari lines pada bon berbaris banyak", () => {
    const rows: IraTransactionRow[] = [
      // Bon lama bermata uang tunggal: nilainya ada di bonnya, tidak punya baris sama sekali.
      { source: "LEGACY", transactionId: 7, bonRupiahAmount: "5000000.00", lineRupiahAmount: null, currencyCode: "AED", distributionChannel: "KANTOR", nationality: "ID" },
      // Bon berbaris banyak: baris legacy-nya ikut terbawa query tetapi kode mata uangnya kosong.
      { source: "LEGACY", transactionId: 8, bonRupiahAmount: "15000000.00", lineRupiahAmount: null, currencyCode: null, distributionChannel: "KANTOR", nationality: "ID" },
      { source: "LINE", transactionId: 8, bonRupiahAmount: "15000000.00", lineRupiahAmount: "15000000.00", currencyCode: "USD", distributionChannel: "KANTOR", nationality: "ID" },
    ];
    const hasil = foldTransactionComposition(rows, new Map());

    expect(hasil.transactionCount).toBe(2);
    expect(hasil.totalRupiah).toBe("20000000.00");
    // AED terbaca dari bon lama, USD dari barisnya, dan bon 8 tidak dihitung dua kali.
    expect(hasil.currencyTurnover.map((row) => [row.code, row.rupiah])).toEqual([
      ["USD", "15000000.00"],
      ["AED", "5000000.00"],
    ]);
  });

  it("menghitung komposisi jalur distribusi per bon, bukan per baris", () => {
    const rows: IraTransactionRow[] = [
      { source: "LINE", transactionId: 1, bonRupiahAmount: "10000000.00", lineRupiahAmount: "6000000.00", currencyCode: "USD", distributionChannel: "LAYANAN_DELIVERY", nationality: "ID" },
      { source: "LINE", transactionId: 1, bonRupiahAmount: "10000000.00", lineRupiahAmount: "4000000.00", currencyCode: "SGD", distributionChannel: "LAYANAN_DELIVERY", nationality: "ID" },
      { source: "LINE", transactionId: 2, bonRupiahAmount: "10000000.00", lineRupiahAmount: "10000000.00", currencyCode: "USD", distributionChannel: "KANTOR", nationality: "ID" },
    ];
    const hasil = foldTransactionComposition(rows, new Map());

    const delivery = hasil.distributionChannels.find((row) => row.channel === "LAYANAN_DELIVERY");
    expect(delivery?.transactionCount).toBe(1);
    expect(delivery?.sharePercent).toBe("50.00");
    // Ketiga jalur selalu muncul, termasuk yang nol — jalur yang tidak dipakai tahun ini tetap
    // baris pada formulirnya.
    expect(hasil.distributionChannels).toHaveLength(3);
  });

  it("menjumlahkan nominal transaksi nasabah bernegara berisiko tinggi per jenis risiko", () => {
    const negara = new Map([["COUNTRY|CN|TPPU", "TINGGI" as const], ["COUNTRY|IR|PPSPM", "TINGGI" as const]]);
    const rows: IraTransactionRow[] = [
      { source: "LINE", transactionId: 1, bonRupiahAmount: "9000000.00", lineRupiahAmount: "9000000.00", currencyCode: "USD", distributionChannel: "KANTOR", nationality: "CN" },
      { source: "LINE", transactionId: 2, bonRupiahAmount: "1000000.00", lineRupiahAmount: "1000000.00", currencyCode: "USD", distributionChannel: "KANTOR", nationality: "IR" },
      { source: "LINE", transactionId: 3, bonRupiahAmount: "5000000.00", lineRupiahAmount: "5000000.00", currencyCode: "USD", distributionChannel: "KANTOR", nationality: "ID" },
    ];
    const hasil = foldTransactionComposition(rows, negara);

    expect(hasil.highRiskCountry).toEqual([
      { riskType: "TPPU", transactionCount: 1, rupiah: "9000000.00" },
      { riskType: "TPPT", transactionCount: 0, rupiah: "0.00" },
      { riskType: "PPSPM", transactionCount: 1, rupiah: "1000000.00" },
    ]);
  });

  it("periode tanpa satu bon pun menghasilkan nol, bukan pembagian dengan nol", () => {
    const hasil = foldTransactionComposition([], new Map());
    expect(hasil.transactionCount).toBe(0);
    expect(hasil.totalRupiah).toBe("0.00");
    expect(hasil.currencyTurnover).toEqual([]);
    expect(hasil.distributionChannels.every((row) => row.sharePercent === "0.00")).toBe(true);
  });
});

describe("agregat Form C1 — lipatan nasabah", () => {
  const nasabah: IraCustomerRow[] = [
    { id: 1, customerType: "INDIVIDU", entityLegalForm: null, occupationCategory: "KARYAWAN_SWASTA", pepStatus: "NONE" },
    { id: 2, customerType: "INDIVIDU", entityLegalForm: null, occupationCategory: "WIRAUSAHA", pepStatus: "SELF" },
    { id: 3, customerType: "INDIVIDU", entityLegalForm: null, occupationCategory: null, pepStatus: "NONE" },
    { id: 4, customerType: null, entityLegalForm: null, occupationCategory: null, pepStatus: "RELATED" },
    { id: 5, customerType: "BADAN_USAHA", entityLegalForm: "PT", occupationCategory: null, pepStatus: "NONE" },
  ];

  it("melaporkan jumlah nasabah tanpa occupationCategory alih-alih diam-diam mengecilkan penyebut", () => {
    const hasil = foldCustomerComposition(nasabah);

    expect(hasil.customersTotal).toBe(5);
    // Dua perorangan berkategori; nasabah 3 dan 4 belum berkategori dan itu dinyatakan, bukan
    // dihilangkan dari laporan.
    expect(hasil.occupationDenominator).toBe(2);
    expect(hasil.customersWithoutOccupationCategory).toBe(2);
    expect(hasil.customersWithoutCustomerType).toBe(1);
  });

  it("persentase pekerjaan dihitung atas nasabah berkategori saja, dan itu dinyatakan hasilnya", () => {
    const hasil = foldCustomerComposition(nasabah);

    const karyawan = hasil.occupationCategories.find((row) => row.code === "KARYAWAN_SWASTA");
    expect(karyawan?.customerCount).toBe(1);
    // 1 dari 2 berkategori = 50%, bukan 1 dari 5 = 20%. Penyebutnya ikut dikembalikan supaya
    // pembacanya tahu persentase ini atas apa.
    expect(karyawan?.sharePercent).toBe("50.00");
    expect(hasil.occupationDenominator).toBe(2);
  });

  it("badan usaha dihitung atas badan usaha saja, dan PEP atas seluruh nasabah", () => {
    const hasil = foldCustomerComposition(nasabah);

    expect(hasil.legalFormDenominator).toBe(1);
    expect(hasil.legalForms.find((row) => row.code === "PT")?.sharePercent).toBe("100.00");
    // PEP tidak mengenal kategori: dua dari lima nasabah, apa pun jenisnya.
    expect(hasil.pepCustomerCount).toBe(2);
  });

  it("seluruh kategori muncul termasuk yang nol", () => {
    const hasil = foldCustomerComposition(nasabah);
    expect(hasil.occupationCategories).toHaveLength(23);
    expect(hasil.legalForms).toHaveLength(11);
    expect(hasil.occupationCategories.find((row) => row.code === "ATLET")?.customerCount).toBe(0);
  });
});

/**
 * Pasangan kolom-nilai terikat pada klausa Drizzle. Satu kolom dapat memikul beberapa nilai:
 * `inArray` menaruh nilainya sebagai **larik Param telanjang** di antara chunk-chunk klausanya,
 * bukan satu Param bernilai larik. Penelusur yang hanya menuruni `queryChunks` melewatkannya
 * seluruhnya, sehingga penyaringan status diam-diam tidak berlaku dan bon CANCELLED ikut terhitung
 * — persis kekeliruan yang uji ini ada untuk menangkapnya. Karena itu larik ikut dituruni.
 *
 * `Array.isArray(value)` tetap menyisihkan StringChunk pemisah, yang juga punya `value`.
 */
function boundValues(clause: unknown): Record<string, unknown[]> {
  const pairs: Record<string, unknown[]> = {};
  let lastColumn: string | null = null;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const candidate = node as { name?: unknown; value?: unknown; queryChunks?: unknown[]; columnType?: unknown };
    if (typeof candidate.name === "string" && candidate.columnType) lastColumn = candidate.name;
    else if (lastColumn && "value" in candidate && !Array.isArray(candidate.value)) {
      (pairs[lastColumn] ??= []).push(candidate.value);
    }
    if (Array.isArray(candidate.queryChunks)) candidate.queryChunks.forEach(walk);
  };
  walk(clause);
  return pairs;
}

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    innerJoin: () => makeReader(rows),
    leftJoin: () => makeReader(rows),
    where: (clause: unknown) => {
      const pairs = boundValues(clause);
      return makeReader(rows.filter((row) => Object.entries(pairs).every(([key, values]) => {
        const record = row as Record<string, unknown>;
        if (!(key in record)) return true;
        return values.some((value) => value instanceof Date && record[key] instanceof Date
          ? true
          : record[key] === value);
      })));
    },
    orderBy: () => makeReader(rows),
    limit: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

function mockDb(rowsByTable: Record<string, unknown[]>) {
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => makeReader(rowsByTable[tableName(table)] ?? []) })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

describe("agregat Form C1 — pembacaan basis data", () => {
  it("mengecualikan bon CANCELLED, isDemo, dan isHistorical", async () => {
    mockDb({
      exchange_transactions: [
        { transactionId: 1, bonRupiahAmount: "10000000.00", currencyCode: "USD", distributionChannel: "KANTOR", nationality: "ID", status: "COMPLETED", isDemo: false, isHistorical: false, lineRupiahAmount: null },
        { transactionId: 2, bonRupiahAmount: "99000000.00", currencyCode: "USD", distributionChannel: "KANTOR", nationality: "ID", status: "CANCELLED", isDemo: false, isHistorical: false, lineRupiahAmount: null },
        { transactionId: 3, bonRupiahAmount: "88000000.00", currencyCode: "USD", distributionChannel: "KANTOR", nationality: "ID", status: "COMPLETED", isDemo: true, isHistorical: false, lineRupiahAmount: null },
        { transactionId: 4, bonRupiahAmount: "77000000.00", currencyCode: "USD", distributionChannel: "KANTOR", nationality: "ID", status: "COMPLETED", isDemo: false, isHistorical: true, lineRupiahAmount: null },
      ],
      customers: [],
      ira_risk_classifications: [],
    });

    const hasil = await readIraDataForm(periodStart, periodEnd);

    // Hanya bon 1 yang tersisa; ketiga lainnya tidak boleh menyentuh omzet apa pun.
    expect(hasil.transactionCount).toBe(1);
    expect(hasil.totalRupiah).toBe("10000000.00");
  });

  it("mengembalikan batas periode yang diminta apa adanya", async () => {
    mockDb({ exchange_transactions: [], customers: [], ira_risk_classifications: [] });
    const hasil = await readIraDataForm(periodStart, periodEnd);
    expect(hasil.periodStart).toEqual(periodStart);
    expect(hasil.periodEnd).toEqual(periodEnd);
  });
});
