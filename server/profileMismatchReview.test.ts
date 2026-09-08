import { describe, expect, it } from "vitest";
import { assessReviewRequirement } from "./operations";

/**
 * `profileMismatch` sebagai perbandingan sungguhan, bukan pengecekan kategori.
 *
 * Sebelumnya benderanya berbunyi `profileStatus === "RESTRICTED" || riskLevel === "HIGH"` — dua
 * kolom yang diisi manusia. Nasabah berisiko LOW yang bertransaksi sepuluh kali lipat kebiasaannya
 * tidak pernah menyalakannya, dan itulah temuan yang ditutup di sini.
 *
 * Batasnya: transaksi yang menyimpang **dialirkan ke review**, sama seperti ambang setara USD yang
 * sudah ada. Ia tidak memblokir transaksi dan tidak mengubah data nasabah.
 */
const dasar = {
  rupiahAmount: "5000000.00",
  thresholdUsd: "10000",
  // Tanpa kurs USD, ambang setara USD tidak menyala — agar yang diuji di sini hanya bendera profil.
  profileStatus: "ACTIVE" as const,
  riskLevel: "LOW" as const,
};

const deklarasi = {
  declaredMonthlyValueIdr: "10000000.00",
  declaredMonthlyCount: 5,
};

describe("penyimpangan profil pada jalur transaksi", () => {
  it("menyalakan review ketika akumulasi bulanan nasabah LOW mencapai dua kali lipat deklarasinya", () => {
    const hasil = assessReviewRequirement({ ...dasar, ...deklarasi, monthlyRupiahTotal: "20000000.00" });

    expect(hasil.requiresReview).toBe(true);
    expect(hasil.reviewReason).toContain("AKTIVITAS_MENYIMPANG_DARI_PROFIL");
  });

  it("tidak menyalakan review bagi nasabah yang sama ketika masih di bawah ambang", () => {
    const hasil = assessReviewRequirement({ ...dasar, ...deklarasi, monthlyRupiahTotal: "19990000.00" });

    expect(hasil.requiresReview).toBe(false);
    expect(hasil.reviewReason).toBeNull();
  });

  /**
   * Kekosongan deklarasi bukan penyimpangan pada jalur transaksi — ia urusan worklist pemantauan,
   * bukan urusan kasir. Menyalakannya di sini akan memaksa review pada setiap transaksi seluruh
   * nasabah lama yang belum pernah ditanya, dan antrean review itu akan berhenti dibaca orang.
   */
  it("tidak menyalakan review bagi nasabah yang belum berdeklarasi, sebesar apa pun aktivitasnya", () => {
    const hasil = assessReviewRequirement({
      ...dasar,
      declaredMonthlyValueIdr: null,
      declaredMonthlyCount: null,
      monthlyRupiahTotal: "900000000.00",
      monthlyTransactionCount: 300,
    });

    expect(hasil.requiresReview).toBe(false);
    expect(hasil.reviewReason).toBeNull();
  });

  it("menyalakan review pada pemecahan transaksi — frekuensi menyimpang meski nilainya wajar", () => {
    const hasil = assessReviewRequirement({
      ...dasar,
      ...deklarasi,
      monthlyRupiahTotal: "6000000.00",
      monthlyTransactionCount: 10,
    });

    expect(hasil.requiresReview).toBe(true);
    expect(hasil.reviewReason).toContain("AKTIVITAS_MENYIMPANG_DARI_PROFIL");
  });

  it("memperlakukan deklarasi nol sebagai belum dideklarasikan, bukan ambang nol", () => {
    const hasil = assessReviewRequirement({
      ...dasar,
      declaredMonthlyValueIdr: "0.00",
      declaredMonthlyCount: 0,
      monthlyRupiahTotal: "1000000.00",
      monthlyTransactionCount: 1,
    });

    expect(hasil.requiresReview).toBe(false);
  });
});

describe("bendera lama tidak berubah", () => {
  it("tetap menyalakan review bagi profil RESTRICTED", () => {
    const hasil = assessReviewRequirement({ ...dasar, profileStatus: "RESTRICTED" });

    expect(hasil.requiresReview).toBe(true);
    expect(hasil.reviewReason).toContain("PROFIL_NASABAH_RESTRICTED");
  });

  it("tetap menyalakan review bagi nasabah berisiko tinggi", () => {
    const hasil = assessReviewRequirement({ ...dasar, riskLevel: "HIGH" });

    expect(hasil.requiresReview).toBe(true);
    expect(hasil.reviewReason).toContain("RISIKO_NASABAH_TINGGI");
  });

  it("tetap menyalakan keduanya sekaligus tanpa saling menutupi", () => {
    const hasil = assessReviewRequirement({ ...dasar, ...deklarasi, profileStatus: "RESTRICTED", riskLevel: "HIGH", monthlyRupiahTotal: "20000000.00" });

    expect(hasil.reviewReason).toContain("PROFIL_NASABAH_RESTRICTED");
    expect(hasil.reviewReason).toContain("RISIKO_NASABAH_TINGGI");
    expect(hasil.reviewReason).toContain("AKTIVITAS_MENYIMPANG_DARI_PROFIL");
  });

  it("tidak menyalakan apa pun bagi nasabah biasa tanpa deklarasi dan tanpa akumulasi", () => {
    const hasil = assessReviewRequirement(dasar);

    expect(hasil.requiresReview).toBe(false);
    expect(hasil.reviewReason).toBeNull();
  });
});
