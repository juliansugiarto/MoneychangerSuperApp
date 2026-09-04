import { describe, expect, it } from "vitest";
import { addMonths, depreciationForMonth, depreciationSchedule, monthKey, monthsBetween } from "./depreciation";

/** Brankas Rp 24.000.000, kelompok 1 (4 tahun = 48 bulan), dibeli 17 Maret 2026. */
const brankas = {
  acquisitionMonth: "2026-03",
  firstJournalMonth: "2026-03",
  acquisitionCost: "24000000.00",
  residualValue: "0.00",
  usefulLifeMonths: 48,
  openingAccumulatedDepreciation: "0.00",
};

describe("aritmetika bulan", () => {
  it("membaca bulan dari kolom date tanpa memundurkan tanggalnya", () => {
    // Tengah malam lokal, bentuk yang benar-benar keluar dari mysql2 pada mesin WIB.
    expect(monthKey(new Date("2026-03-01T00:00:00"))).toBe("2026-03");
    expect(monthKey("2026-12-31")).toBe("2026-12");
  });

  it("menambah bulan melintasi pergantian tahun", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-02", -3)).toBe("2025-11");
  });

  it("menghitung selisih bulan", () => {
    expect(monthsBetween("2026-03", "2026-03")).toBe(0);
    expect(monthsBetween("2026-03", "2027-03")).toBe(12);
    expect(monthsBetween("2027-03", "2026-03")).toBe(-12);
  });
});

describe("jadwal penyusutan garis lurus", () => {
  it("menyusutkan bulan perolehan secara penuh — aturan DJP, keputusan spec 2", () => {
    expect(depreciationForMonth(brankas, "2026-03")).toBe("500000.00");
  });

  it("tidak membebani bulan sebelum perolehan", () => {
    expect(depreciationForMonth(brankas, "2026-02")).toBe("0.00");
  });

  it("berhenti membebani setelah umur manfaat habis", () => {
    // Bulan ke-48 adalah Februari 2030; Maret 2030 sudah di luar umur manfaat.
    expect(depreciationForMonth(brankas, "2030-02")).toBe("500000.00");
    expect(depreciationForMonth(brankas, "2030-03")).toBe("0.00");
  });

  it("menghasilkan tepat sebanyak umur manfaat baris", () => {
    expect(depreciationSchedule(brankas)).toHaveLength(48);
  });

  it("menjumlah tepat sama dengan dasar penyusutan — tidak ada sen yang hilang", () => {
    // Angka yang sengaja tidak habis dibagi: 10.000.000 / 48 = 208.333,333...
    const asset = { ...brankas, acquisitionCost: "10000000.00" };
    const rows = depreciationSchedule(asset);
    const total = rows.reduce((sum, row) => sum + Math.round(Number(row.charge) * 100), 0);
    expect(total).toBe(1_000_000_000);
    expect(rows[rows.length - 1].accumulated).toBe("10000000.00");
    expect(rows[rows.length - 1].carrying).toBe("0.00");
  });

  it("menyebar sisa pembulatan, tidak menumpuknya di bulan terakhir", () => {
    const rows = depreciationSchedule({ ...brankas, acquisitionCost: "10000000.00" });
    const charges = new Set(rows.map((row) => row.charge));
    // Hanya dua nilai yang boleh muncul, dan keduanya berselisih satu sen.
    expect(charges.size).toBe(2);
    expect([...charges].sort()).toEqual(["208333.33", "208333.34"]);
  });

  it("mengurangkan nilai residu dari dasar penyusutan", () => {
    const kendaraan = { ...brankas, acquisitionCost: "240000000.00", residualValue: "24000000.00", usefulLifeMonths: 96 };
    expect(depreciationForMonth(kendaraan, "2026-03")).toBe("2250000.00");
    const rows = depreciationSchedule(kendaraan);
    expect(rows[rows.length - 1].carrying).toBe("24000000.00");
  });

  it("tidak menyusutkan tanah — usefulLifeMonths NULL", () => {
    const tanah = { ...brankas, usefulLifeMonths: null, acquisitionCost: "500000000.00" };
    expect(depreciationSchedule(tanah)).toEqual([]);
    expect(depreciationForMonth(tanah, "2026-03")).toBe("0.00");
  });
});

describe("aset warisan", () => {
  /** Dibeli Maret 2024, buku besar ini dipakai mulai September 2026; 30 bulan sudah lewat. */
  const warisan = {
    acquisitionMonth: "2024-03",
    firstJournalMonth: "2026-09",
    acquisitionCost: "24000000.00",
    residualValue: "0.00",
    usefulLifeMonths: 48,
    openingAccumulatedDepreciation: "15000000.00",
  };

  it("melanjutkan sisa bulan, bukan memulai ulang", () => {
    expect(depreciationSchedule(warisan)).toHaveLength(18);
  });

  it("membagi sisa dasar penyusutan atas sisa bulan", () => {
    // (24.000.000 − 15.000.000) / 18 = 500.000
    expect(depreciationForMonth(warisan, "2026-09")).toBe("500000.00");
  });

  it("berakhir tepat pada nilai residu, memperhitungkan akumulasi yang dibawa", () => {
    const rows = depreciationSchedule(warisan);
    expect(rows[rows.length - 1].accumulated).toBe("24000000.00");
    expect(rows[rows.length - 1].carrying).toBe("0.00");
  });

  it("tidak menghidupkan kembali penyusutan aset yang umurnya sudah habis", () => {
    const habis = { ...warisan, firstJournalMonth: "2028-09", openingAccumulatedDepreciation: "24000000.00" };
    expect(depreciationSchedule(habis)).toEqual([]);
  });

  it("menolak akumulasi awal yang melebihi dasar penyusutan", () => {
    const salah = { ...warisan, openingAccumulatedDepreciation: "30000000.00" };
    expect(() => depreciationSchedule(salah)).toThrow(/akumulasi/i);
  });

  it("menolak bulan jurnal pertama yang mendahului bulan perolehan", () => {
    const salah = { ...warisan, firstJournalMonth: "2024-01" };
    expect(() => depreciationSchedule(salah)).toThrow(/bulan/i);
  });
});

describe("penolakan masukan yang tidak masuk akal", () => {
  it("menolak harga perolehan negatif", () => {
    expect(() => depreciationSchedule({ ...brankas, acquisitionCost: "-1.00" })).toThrow(/perolehan/i);
  });

  it("menolak nilai residu melebihi harga perolehan", () => {
    expect(() => depreciationSchedule({ ...brankas, residualValue: "30000000.00" })).toThrow(/residu/i);
  });

  it("menolak umur manfaat nol atau negatif", () => {
    expect(() => depreciationSchedule({ ...brankas, usefulLifeMonths: 0 })).toThrow(/umur manfaat/i);
    expect(() => depreciationSchedule({ ...brankas, usefulLifeMonths: -12 })).toThrow(/umur manfaat/i);
  });

  it("menolak bulan yang bukan YYYY-MM", () => {
    expect(() => addMonths("2026-3", 1)).toThrow(/YYYY-MM/);
  });
});
