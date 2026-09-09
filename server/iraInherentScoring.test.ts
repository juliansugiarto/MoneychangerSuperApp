import { describe, expect, it } from "vitest";
import type { IraRiskLevel } from "../drizzle/schema";
import { IRA_PARAMETERS } from "../shared/iraParameters";
import { classificationKey } from "./iraRiskClassification";
import { scoreInherentParameters, type InherentScoringInput } from "./iraInherentScoring";
import type { IraDataForm } from "./iraDataForm";

const FORM_KOSONG: IraDataForm = {
  periodStart: new Date("2026-01-01T00:00:00Z"),
  periodEnd: new Date("2027-01-01T00:00:00Z"),
  transactionCount: 0,
  totalRupiah: "0.00",
  currencyTurnover: [],
  distributionChannels: [
    { channel: "KANTOR", transactionCount: 0, sharePercent: "0.00" },
    { channel: "LAYANAN_DELIVERY", transactionCount: 0, sharePercent: "0.00" },
    { channel: "ONLINE_MERCHANT", transactionCount: 0, sharePercent: "0.00" },
  ],
  highRiskCountry: [
    { riskType: "TPPU", transactionCount: 0, rupiah: "0.00" },
    { riskType: "TPPT", transactionCount: 0, rupiah: "0.00" },
    { riskType: "PPSPM", transactionCount: 0, rupiah: "0.00" },
  ],
  customersTotal: 0,
  customersWithoutCustomerType: 0,
  customersWithoutOccupationCategory: 0,
  customersWithoutLegalForm: 0,
  occupationDenominator: 0,
  legalFormDenominator: 0,
  occupationCategories: [],
  legalForms: [],
  pepCustomerCount: 0,
  customersWithoutNationality: 0,
  nationalityDenominator: 0,
  highRiskCountryCustomers: [
    { riskType: "TPPU", customerCount: 0, sharePercent: "0.00" },
    { riskType: "TPPT", customerCount: 0, sharePercent: "0.00" },
    { riskType: "PPSPM", customerCount: 0, sharePercent: "0.00" },
  ],
};

const levels = (entries: [Parameters<typeof classificationKey>[0], string, Parameters<typeof classificationKey>[2], IraRiskLevel][]) =>
  new Map(entries.map(([dimension, code, riskType, level]) => [classificationKey(dimension, code, riskType), level]));

const input = (over: Partial<InherentScoringInput> = {}): InherentScoringInput => ({
  form: FORM_KOSONG,
  levels: new Map(),
  province: null,
  thresholds: new Map(),
  ...over,
});

const valueOf = (result: ReturnType<typeof scoreInherentParameters>, code: string) =>
  result.find((entry) => entry.code === code)!;

describe("penghitung sisi risiko inheren", () => {
  it("menghasilkan tepat 33 baris, satu untuk tiap parameter", () => {
    const hasil = scoreInherentParameters(input());
    expect(hasil).toHaveLength(33);
    expect(hasil.map((entry) => entry.code)).toEqual(IRA_PARAMETERS.map((parameter) => parameter.code));
  });

  it("parameter DINYATAKAN tidak dihitung di sini — nilainya kosong, bukan nol", () => {
    const hasil = scoreInherentParameters(input());
    const dinyatakan = hasil.filter((entry) => entry.source === "NYATAKAN");
    expect(dinyatakan).toHaveLength(9);
    for (const entry of dinyatakan) {
      expect([entry.code, entry.machineScore, entry.basis]).toEqual([entry.code, null, null]);
    }
    expect(hasil.filter((entry) => entry.source === "HITUNG")).toHaveLength(24);
    // Yang terhitung wajib punya nilai, atau alasan tertulis mengapa belum ada — tidak boleh
    // kosong tanpa keterangan. Pada agregat kosong ini keempat parameter wilayah memang belum
    // dapat dinilai karena provinsi gerainya tidak dikirim.
    for (const entry of hasil.filter((e) => e.source === "HITUNG")) {
      expect([entry.code, entry.machineScore !== null || entry.missingReason !== null]).toEqual([entry.code, true]);
    }
  });

  it("mata uang berisiko tinggi: persentase omzetnya menentukan pitanya, skala tetap terbalik", () => {
    const form: IraDataForm = {
      ...FORM_KOSONG,
      totalRupiah: "100000000.00",
      currencyTurnover: [
        { code: "USD", rupiah: "90000000.00", sharePercent: "90.00" },
        { code: "EUR", rupiah: "10000000.00", sharePercent: "10.00" },
      ],
    };
    const hasil = scoreInherentParameters(input({ form, levels: levels([["CURRENCY", "USD", "TPPU", "TINGGI"]]) }));
    const tinggi = valueOf(hasil, "TPPU_1A");
    // 90% masuk pita kelima; pita kelima bernilai 1 — risiko tertinggi.
    expect(tinggi.machineScore).toBe(1);
    expect(tinggi.bandIndex).toBe(5);
    expect(tinggi.basis).toMatchObject({ numerator: "90000000.00", denominator: "100000000.00", percent: "90.00" });
  });

  it("mata uang tanpa klasifikasi dibaca RENDAH dan tidak ikut persentase berisiko tinggi", () => {
    const form: IraDataForm = {
      ...FORM_KOSONG,
      totalRupiah: "100000000.00",
      currencyTurnover: [{ code: "USD", rupiah: "100000000.00", sharePercent: "100.00" }],
    };
    const hasil = scoreInherentParameters(input({ form }));
    expect(valueOf(hasil, "TPPU_1A").machineScore).toBe(5);
    expect(valueOf(hasil, "TPPU_1A").basis).toMatchObject({ numerator: "0.00", percent: "0.00" });
    expect(valueOf(hasil, "TPPU_1B").machineScore).toBe(5);
  });

  it("periode tanpa satu pun transaksi menghasilkan 0% dan nilai 5, bukan galat pembagian", () => {
    const hasil = scoreInherentParameters(input());
    expect(valueOf(hasil, "TPPU_1A").machineScore).toBe(5);
    expect(valueOf(hasil, "TPPU_2A").machineScore).toBe(5);
    expect(valueOf(hasil, "TPPU_3A").basis).toMatchObject({ denominator: "0" });
  });

  it("jalur distribusi memakai klasifikasi jalur, bukan tebakan aplikasi", () => {
    const form: IraDataForm = {
      ...FORM_KOSONG,
      transactionCount: 10,
      distributionChannels: [
        { channel: "KANTOR", transactionCount: 5, sharePercent: "50.00" },
        { channel: "LAYANAN_DELIVERY", transactionCount: 3, sharePercent: "30.00" },
        { channel: "ONLINE_MERCHANT", transactionCount: 2, sharePercent: "20.00" },
      ],
    };
    const tanpaKlasifikasi = scoreInherentParameters(input({ form }));
    // Tanpa klasifikasi seluruh jalur RENDAH: 0% berisiko tinggi maupun menengah.
    expect(valueOf(tanpaKlasifikasi, "TPPU_2A").machineScore).toBe(5);

    const hasil = scoreInherentParameters(input({
      form,
      levels: levels([
        ["DISTRIBUTION_CHANNEL", "ONLINE_MERCHANT", "TPPU", "TINGGI"],
        ["DISTRIBUTION_CHANNEL", "LAYANAN_DELIVERY", "TPPU", "MENENGAH"],
      ]),
    }));
    expect(valueOf(hasil, "TPPU_2A").basis).toMatchObject({ numerator: "2", denominator: "10", percent: "20.00" });
    expect(valueOf(hasil, "TPPU_2A").machineScore).toBe(5);
    expect(valueOf(hasil, "TPPU_2B").basis).toMatchObject({ percent: "30.00" });
    expect(valueOf(hasil, "TPPU_2B").machineScore).toBe(4);
  });

  it("profesi memakai penyebut nasabah berkategori, dan yang belum berkategori dilaporkan", () => {
    const form: IraDataForm = {
      ...FORM_KOSONG,
      customersTotal: 10,
      occupationDenominator: 4,
      customersWithoutOccupationCategory: 6,
      occupationCategories: [
        { code: "WIRAUSAHA", customerCount: 3, sharePercent: "75.00" },
        { code: "KARYAWAN_SWASTA", customerCount: 1, sharePercent: "25.00" },
      ],
    };
    const hasil = scoreInherentParameters(input({ form, levels: levels([["OCCUPATION", "WIRAUSAHA", "TPPU", "TINGGI"]]) }));
    const nilai = valueOf(hasil, "TPPU_3A");
    expect(nilai.basis).toMatchObject({ numerator: "3", denominator: "4", percent: "75.00", customersWithoutCategory: 6 });
    // Pita sempit: >3% sudah pita kelima, bernilai 1.
    expect(nilai.machineScore).toBe(1);
  });

  it("wilayah geografis memakai peringkat provinsi gerai, bukan persentase", () => {
    const rendah = scoreInherentParameters(input({ province: "JAWA_BARAT" }));
    expect(valueOf(rendah, "TPPU_4A").machineScore).toBe(5);
    expect(valueOf(rendah, "TPPU_4A").basis).toMatchObject({ province: "JAWA_BARAT", level: "RENDAH" });

    const tinggi = scoreInherentParameters(input({
      province: "JAWA_BARAT",
      levels: levels([["PROVINCE", "JAWA_BARAT", "TPPU", "TINGGI"]]),
    }));
    expect(valueOf(tinggi, "TPPU_4A").machineScore).toBe(1);
    expect(valueOf(tinggi, "TPPU_4B").machineScore).toBe(1);
  });

  it("provinsi gerai yang belum diisi menjadi nilai kosong beserta alasannya, bukan RENDAH diam-diam", () => {
    const hasil = scoreInherentParameters(input({ province: null }));
    const nilai = valueOf(hasil, "TPPU_4A");
    expect(nilai.machineScore).toBeNull();
    expect(nilai.missingReason).toMatch(/provinsi/i);
  });

  it("kehadiran WN negara FATF diambil dari ada atau tidaknya transaksi, bukan dari persentase", () => {
    const ada: IraDataForm = {
      ...FORM_KOSONG,
      highRiskCountry: [
        { riskType: "TPPU", transactionCount: 2, rupiah: "5000000.00" },
        { riskType: "TPPT", transactionCount: 0, rupiah: "0.00" },
        { riskType: "PPSPM", transactionCount: 0, rupiah: "0.00" },
      ],
    };
    expect(valueOf(scoreInherentParameters(input({ form: ada })), "TPPU_3E").machineScore).toBe(1);
    expect(valueOf(scoreInherentParameters(input()), "TPPU_3E").machineScore).toBe(5);
  });

  it("PPSPM_3A memakai komposisi nasabah, bukan komposisi transaksi", () => {
    const form: IraDataForm = {
      ...FORM_KOSONG,
      nationalityDenominator: 50,
      highRiskCountryCustomers: [
        { riskType: "TPPU", customerCount: 0, sharePercent: "0.00" },
        { riskType: "TPPT", customerCount: 0, sharePercent: "0.00" },
        { riskType: "PPSPM", customerCount: 1, sharePercent: "2.00" },
      ],
      highRiskCountry: [
        { riskType: "TPPU", transactionCount: 0, rupiah: "0.00" },
        { riskType: "TPPT", transactionCount: 0, rupiah: "0.00" },
        { riskType: "PPSPM", transactionCount: 40, rupiah: "9000000.00" },
      ],
    };
    const nilai = valueOf(scoreInherentParameters(input({ form })), "PPSPM_3A");
    expect(nilai.basis).toMatchObject({ numerator: "1", denominator: "50", percent: "2.00" });
    // Pita sempit: >1-2% adalah pita ketiga, bernilai 3.
    expect(nilai.machineScore).toBe(3);
  });

  it("PPSPM_3C mengakui di basisnya bahwa UMKM tidak dapat dibedakan", () => {
    const nilai = valueOf(scoreInherentParameters(input()), "PPSPM_3C");
    expect(String(nilai.basis!.note)).toMatch(/UMKM/);
  });

  it("ambang tersimpan menggantikan bawaan template", () => {
    const form: IraDataForm = {
      ...FORM_KOSONG,
      totalRupiah: "100000000.00",
      currencyTurnover: [{ code: "USD", rupiah: "30000000.00", sharePercent: "30.00" }],
    };
    const dasar = input({ form, levels: levels([["CURRENCY", "USD", "TPPU", "TINGGI"]]) });
    expect(valueOf(scoreInherentParameters(dasar), "TPPU_1A").machineScore).toBe(4);

    const disunting = scoreInherentParameters({
      ...dasar,
      thresholds: new Map([["TPPU_1A", ["5.00", "10.00", "15.00", "20.00", null]]]),
    });
    expect(valueOf(disunting, "TPPU_1A").machineScore).toBe(1);
    expect(valueOf(disunting, "TPPU_1A").basis).toMatchObject({ bandsFromDatabase: true });
  });

  it("tiap nilai membawa angka mentahnya supaya dapat ditelusuri tanpa membuka kode", () => {
    const hasil = scoreInherentParameters(input());
    for (const entry of hasil.filter((row) => row.source === "HITUNG" && row.machineScore !== null)) {
      expect([entry.code, entry.basis === null]).toEqual([entry.code, false]);
    }
  });
});
