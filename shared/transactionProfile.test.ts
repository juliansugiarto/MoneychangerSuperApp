import { describe, expect, it } from "vitest";
import {
  PROFILE_DEVIATION_MULTIPLE,
  assessProfileDeviation,
  isProfileReviewDue,
  profileReviewIntervalMonths,
} from "./transactionProfile";

/** Deklarasi lengkap yang dipakai sebagian besar uji: Rp 10 juta, 5 transaksi, USD saja. */
const deklarasi = {
  declaredMonthlyValueIdr: "10000000.00",
  declaredMonthlyCount: 5,
  declaredCurrencies: ["USD"],
};

const aktivitas = (over: Partial<{ totalValueIdr: string | number; transactionCount: number; currencyCodes: string[] }> = {}) => ({
  totalValueIdr: 0,
  transactionCount: 0,
  currencyCodes: [] as string[],
  ...over,
});

describe("penyimpangan profil transaksi", () => {
  it("menyalakan bendera tepat pada dua kali lipat, bukan sesudahnya", () => {
    const tepatDuaKali = assessProfileDeviation(deklarasi, aktivitas({ totalValueIdr: "20000000.00", currencyCodes: ["USD"] }));
    expect(tepatDuaKali.reasons).toContain("NILAI_BULANAN_MELEBIHI_PROFIL");
    expect(tepatDuaKali.hasDeviation).toBe(true);

    const sedikitDiBawah = assessProfileDeviation(deklarasi, aktivitas({ totalValueIdr: "19990000.00", currencyCodes: ["USD"] }));
    expect(sedikitDiBawah.reasons).not.toContain("NILAI_BULANAN_MELEBIHI_PROFIL");
    expect(sedikitDiBawah.hasDeviation).toBe(false);
  });

  it("tidak pernah menyimpang bila deklarasinya belum ada, melainkan PROFIL_BELUM_DIDEKLARASIKAN", () => {
    const hasil = assessProfileDeviation(
      { declaredMonthlyValueIdr: null, declaredMonthlyCount: null, declaredCurrencies: null },
      aktivitas({ totalValueIdr: "900000000.00", transactionCount: 400, currencyCodes: ["USD", "SGD"] }),
    );

    expect(hasil.reasons).toEqual(["PROFIL_BELUM_DIDEKLARASIKAN"]);
    expect(hasil.hasDeviation).toBe(false);
  });

  it("menyebut mata uang tak terdeklarasi sebagai alasan tersendiri", () => {
    const hasil = assessProfileDeviation(deklarasi, aktivitas({ totalValueIdr: "1000000.00", transactionCount: 1, currencyCodes: ["USD", "SGD"] }));

    expect(hasil.reasons).toEqual(["MATA_UANG_TIDAK_DIDEKLARASIKAN"]);
    expect(hasil.undeclaredCurrencies).toEqual(["SGD"]);
    expect(hasil.hasDeviation).toBe(true);
  });

  it("menyalakan bendera frekuensi pada dua kali lipat deklarasi transaksinya", () => {
    const tepatDuaKali = assessProfileDeviation(deklarasi, aktivitas({ transactionCount: 10, currencyCodes: ["USD"] }));
    expect(tepatDuaKali.reasons).toContain("FREKUENSI_BULANAN_MELEBIHI_PROFIL");

    const satuKurang = assessProfileDeviation(deklarasi, aktivitas({ transactionCount: 9, currencyCodes: ["USD"] }));
    expect(satuKurang.reasons).not.toContain("FREKUENSI_BULANAN_MELEBIHI_PROFIL");
  });

  it("menyalakan frekuensi sendirian ketika nilainya masih wajar", () => {
    // Pemecahan transaksi: 12 setoran kecil, totalnya Rp 6 juta — jauh di bawah ambang nilai.
    const hasil = assessProfileDeviation(deklarasi, aktivitas({ totalValueIdr: "6000000.00", transactionCount: 12, currencyCodes: ["USD"] }));

    expect(hasil.reasons).toEqual(["FREKUENSI_BULANAN_MELEBIHI_PROFIL"]);
    expect(hasil.hasDeviation).toBe(true);
  });

  it("memperlakukan deklarasi nol sebagai belum dideklarasikan pada kedua ukuran", () => {
    const hasil = assessProfileDeviation(
      { declaredMonthlyValueIdr: "0.00", declaredMonthlyCount: 0, declaredCurrencies: [] },
      aktivitas({ totalValueIdr: "1000.00", transactionCount: 1, currencyCodes: ["USD"] }),
    );

    expect(hasil.reasons).toEqual(["PROFIL_BELUM_DIDEKLARASIKAN"]);
    expect(hasil.hasDeviation).toBe(false);
  });

  it("menilai ukuran yang dideklarasikan meski ukuran lainnya kosong", () => {
    const hasil = assessProfileDeviation(
      { declaredMonthlyValueIdr: "10000000.00", declaredMonthlyCount: null, declaredCurrencies: null },
      aktivitas({ totalValueIdr: "20000000.00", transactionCount: 999, currencyCodes: ["SGD"] }),
    );

    // Nilainya menyimpang; frekuensi dan mata uang tidak dinilai karena tidak dideklarasikan.
    expect(hasil.reasons).toEqual(["NILAI_BULANAN_MELEBIHI_PROFIL"]);
  });

  it("memakai pengali yang sama untuk nilai dan frekuensi", () => {
    expect(PROFILE_DEVIATION_MULTIPLE).toBe(2);

    const hasil = assessProfileDeviation(deklarasi, aktivitas({ currencyCodes: ["USD"] }));
    expect(hasil.valueThresholdIdr).toBe(10_000_000 * PROFILE_DEVIATION_MULTIPLE);
    expect(hasil.countThreshold).toBe(5 * PROFILE_DEVIATION_MULTIPLE);
  });
});

describe("irama peninjauan profil berbasis risiko", () => {
  it("memakai satu bulan untuk HIGH, tiga bulan untuk MEDIUM, dua belas bulan untuk LOW", () => {
    expect(profileReviewIntervalMonths("HIGH")).toBe(1);
    expect(profileReviewIntervalMonths("MEDIUM")).toBe(3);
    expect(profileReviewIntervalMonths("LOW")).toBe(12);
  });

  it("selalu jatuh tempo bagi nasabah yang belum pernah ditinjau", () => {
    const asOf = new Date("2026-09-08T00:00:00.000Z");
    expect(isProfileReviewDue(null, "LOW", asOf)).toBe(true);
    expect(isProfileReviewDue(undefined, "MEDIUM", asOf)).toBe(true);
    expect(isProfileReviewDue(null, "HIGH", asOf)).toBe(true);
  });

  it("jatuh tempo tepat pada tanggal iramanya, bukan sehari sesudahnya", () => {
    const ditinjau = new Date("2026-08-08T00:00:00.000Z");
    expect(isProfileReviewDue(ditinjau, "HIGH", new Date("2026-09-08T00:00:00.000Z"))).toBe(true);
    expect(isProfileReviewDue(ditinjau, "HIGH", new Date("2026-09-07T23:00:00.000Z"))).toBe(false);
  });

  it("menahan nasabah MEDIUM selama tiga bulan dan nasabah LOW selama dua belas bulan", () => {
    const ditinjau = new Date("2026-01-15T00:00:00.000Z");

    expect(isProfileReviewDue(ditinjau, "MEDIUM", new Date("2026-04-14T00:00:00.000Z"))).toBe(false);
    expect(isProfileReviewDue(ditinjau, "MEDIUM", new Date("2026-04-15T00:00:00.000Z"))).toBe(true);

    expect(isProfileReviewDue(ditinjau, "LOW", new Date("2026-12-31T00:00:00.000Z"))).toBe(false);
    expect(isProfileReviewDue(ditinjau, "LOW", new Date("2027-01-15T00:00:00.000Z"))).toBe(true);
  });

  it("memundurkan tanggal yang tidak ada pada bulan tujuan ke hari terakhirnya", () => {
    // Ditinjau 31 Januari, irama HIGH: jatuh tempo 28 Februari, bukan melompat ke 2 atau 3 Maret.
    const ditinjau = new Date("2026-01-31T00:00:00.000Z");
    expect(isProfileReviewDue(ditinjau, "HIGH", new Date("2026-02-28T00:00:00.000Z"))).toBe(true);
    expect(isProfileReviewDue(ditinjau, "HIGH", new Date("2026-02-27T00:00:00.000Z"))).toBe(false);
  });
});
