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

  it("tepat USD 10.000 belum wajib underlying; sedikit di atasnya sudah", () => {
    // PADG 15/2026: transaksi "dengan nominal di atas threshold" wajib underlying; sampai dengan
    // USD 10.000 cukup surat pernyataan nasabah.
    expect(assessReviewRequirement({ ...base, rupiahAmount: rupiahFor(10000), monthlyRupiahTotal: rupiahFor(10000) }).exceedsThreshold).toBe(false);
    expect(assessReviewRequirement({ ...base, rupiahAmount: "160000016", monthlyRupiahTotal: "160000016" }).exceedsThreshold).toBe(true);
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

  it("hanya pembelian valas oleh nasabah yang dihitung: nasabah yang MENJUAL valas tidak dimintai underlying", () => {
    // Bon BUY (kita membeli dari nasabah) sebesar USD 12.000 tidak tunduk pada ambang pembelian.
    const jualKeKita = assessReviewRequirement({ ...base, operation: "BUY", rupiahAmount: rupiahFor(12000), monthlyRupiahTotal: rupiahFor(12000), monthlyPurchaseRupiahTotal: "0" });
    expect(jualKeKita.exceedsThreshold).toBe(false);
    // ...tetapi tetap masuk antrean tinjauan karena nilainya besar.
    expect(jualKeKita.requiresReview).toBe(true);
    expect(jualKeKita.reviewReason).toContain("NILAI_BELI_SETARA_USD_MELEBIHI_AMBANG_REVIEW");
  });

  it("akumulasi ambang memakai total PEMBELIAN sebulan, bukan total seluruh bon nasabah", () => {
    // Bulan ini nasabah menjual USD 9.000 ke kita lalu membeli USD 3.000: total semua bon USD 12.000,
    // tetapi pembeliannya baru USD 3.000 — belum wajib underlying.
    const result = assessReviewRequirement({ ...base, operation: "SELL", rupiahAmount: rupiahFor(3000), monthlyRupiahTotal: rupiahFor(12000), monthlyPurchaseRupiahTotal: rupiahFor(3000) });
    expect(result.exceedsThreshold).toBe(false);
    // Pembelian kedua yang membawa akumulasi pembelian ke USD 11.000 sudah wajib.
    const kedua = assessReviewRequirement({ ...base, operation: "SELL", rupiahAmount: rupiahFor(8000), monthlyRupiahTotal: rupiahFor(20000), monthlyPurchaseRupiahTotal: rupiahFor(11000) });
    expect(kedua.exceedsThreshold).toBe(true);
    expect(kedua.exceedsOnAccumulation).toBe(true);
  });
});
