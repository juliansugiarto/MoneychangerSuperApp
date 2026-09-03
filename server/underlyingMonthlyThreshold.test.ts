import { describe, expect, it } from "vitest";
import { assessReviewRequirement } from "./operations";

/**
 * Ketentuan batas: maksimal USD 10.000 atau ekuivalennya **per pelaku transaksi dalam satu bulan**
 * tanpa dokumen pendukung. Melebihi itu bukan berarti dilarang, tetapi akumulasi pembelian dalam
 * sebulan yang melampaui batas wajib disertai underlying yang sah.
 *
 * Sebelum perbaikan ini ambang dibandingkan per transaksi, sehingga beberapa transaksi kecil dalam
 * satu bulan tidak pernah meminta underlying meskipun akumulasinya sudah melewati batas.
 */
const RATE = { usdSellRate: "16000", usdQuoteUnit: "1" };
const THRESHOLD = "10000.00";
const base = { thresholdUsd: THRESHOLD, profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const, ...RATE };

// USD 10.000 pada kurs 16.000 setara Rp 160.000.000.
const rupiahFor = (usd: number) => String(usd * 16000);

describe("ambang underlying atas akumulasi sebulan", () => {
  it("meminta underlying ketika satu transaksi sendirian sudah melewati ambang", () => {
    const result = assessReviewRequirement({ ...base, rupiahAmount: rupiahFor(12000), monthlyRupiahTotal: rupiahFor(12000) });
    expect(result.exceedsThreshold).toBe(true);
    expect(result.exceedsOnAccumulation).toBe(false);
    expect(result.reviewReason).toContain("NILAI_SETARA_USD_MELEBIHI_AMBANG");
  });

  it("meminta underlying ketika akumulasi sebulan melewati ambang meski tiap transaksi kecil", () => {
    // Inilah kasus yang lolos sebelumnya: empat transaksi USD 3.000 dalam sebulan.
    const result = assessReviewRequirement({ ...base, rupiahAmount: rupiahFor(3000), monthlyRupiahTotal: rupiahFor(12000) });
    expect(result.exceedsThreshold).toBe(true);
    expect(result.exceedsOnAccumulation).toBe(true);
    expect(result.reviewReason).toContain("AKUMULASI_BULANAN_SETARA_USD_MELEBIHI_AMBANG");
  });

  it("membedakan alasan akumulasi dari alasan nilai transaksi tunggal", () => {
    // Petugas perlu tahu mengapa underlying diminta; alasan yang sama untuk dua sebab berbeda
    // membuat penjelasan ke nasabah keliru.
    const tunggal = assessReviewRequirement({ ...base, rupiahAmount: rupiahFor(11000), monthlyRupiahTotal: rupiahFor(11000) });
    const akumulasi = assessReviewRequirement({ ...base, rupiahAmount: rupiahFor(1000), monthlyRupiahTotal: rupiahFor(11000) });
    expect(tunggal.reviewReason).not.toContain("AKUMULASI_BULANAN");
    expect(akumulasi.reviewReason).toContain("AKUMULASI_BULANAN");
  });

  it("tidak meminta underlying selama akumulasi sebulan masih di bawah ambang", () => {
    const result = assessReviewRequirement({ ...base, rupiahAmount: rupiahFor(3000), monthlyRupiahTotal: rupiahFor(9000) });
    expect(result.exceedsThreshold).toBe(false);
    expect(result.requiresReview).toBe(false);
  });

  it("memperlakukan tepat sepuluh ribu sebagai sudah mencapai ambang", () => {
    // Ketentuannya "maksimal USD 10.000 tanpa dokumen", jadi tepat di angka itu sudah termasuk.
    const result = assessReviewRequirement({ ...base, rupiahAmount: rupiahFor(10000), monthlyRupiahTotal: rupiahFor(10000) });
    expect(result.exceedsThreshold).toBe(true);
  });

  it("melaporkan nilai setara USD transaksi dan akumulasinya secara terpisah", () => {
    const result = assessReviewRequirement({ ...base, rupiahAmount: rupiahFor(2000), monthlyRupiahTotal: rupiahFor(11000) });
    expect(Number(result.usdEquivalent)).toBeCloseTo(2000, 2);
    expect(Number(result.monthlyUsdEquivalent)).toBeCloseTo(11000, 2);
  });

  it("kembali ke nilai transaksi tunggal bila akumulasi tidak tersedia", () => {
    // Pemanggil lama yang belum menyertakan akumulasi tidak boleh diam-diam berhenti memeriksa.
    const result = assessReviewRequirement({ ...base, rupiahAmount: rupiahFor(12000) });
    expect(result.exceedsThreshold).toBe(true);
  });

  it("tidak memaksa underlying ketika kurs referensi USD belum tersedia", () => {
    // Tanpa kurs, nilai setara USD tidak dapat dihitung; menebaknya akan menghalangi transaksi
    // yang sah, dan pemeriksaan lain tetap berjalan.
    const result = assessReviewRequirement({ thresholdUsd: THRESHOLD, profileStatus: "ACTIVE", riskLevel: "LOW", rupiahAmount: rupiahFor(12000), monthlyRupiahTotal: rupiahFor(12000) });
    expect(result.exceedsThreshold).toBe(false);
    expect(result.usdEquivalent).toBeNull();
  });
});
