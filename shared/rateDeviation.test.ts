import { describe, expect, it } from "vitest";
import { RATE_DEVIATION_REVIEW_REASON, deviationRejectionMessage, exceedsTolerance, rateDeviationPercent } from "./rateDeviation";

describe("persen selisih harga", () => {
  it("dihitung sebagai selisih mutlak terhadap kurs papan", () => {
    // 195 / 16290 x 100 = 1.19705..., dibulatkan setengah ke atas pada 4 desimal menjadi 1.1971.
    expect(rateDeviationPercent("16485", "16290")).toBe("1.1971");
    expect(rateDeviationPercent("16095", "16290")).toBe("1.1971");
  });

  it("bernilai nol ketika harganya sama persis dengan papan", () => {
    expect(rateDeviationPercent("16290", "16290")).toBe("0.0000");
  });

  it("tidak dapat dihitung tanpa kurs papan — valuta tanpa kurs aktif tetap seperti sebelumnya", () => {
    expect(rateDeviationPercent("16290", null)).toBeNull();
    expect(rateDeviationPercent("16290", "0")).toBeNull();
  });
});

describe("ambang toleransi", () => {
  it("berlaku dua arah dan hanya melampaui batas ketika benar-benar lebih besar", () => {
    expect(exceedsTolerance("1.1970", "0.5000")).toBe(true);
    expect(exceedsTolerance("0.5000", "0.5000")).toBe(false);
    expect(exceedsTolerance("0.4999", "0.5000")).toBe(false);
  });

  it("tidak pernah menyalakan tinjauan ketika selisihnya tidak dapat dihitung", () => {
    expect(exceedsTolerance(null, "0.5000")).toBe(false);
  });
});

describe("pesan penolakan", () => {
  it("menyebut valuta, pecahan, harga papan, dan batasnya", () => {
    const message = deviationRejectionMessage([
      { currencyCode: "USD", denominationValue: "100.000000", agreedRate: "16485.000000", referenceRate: "16290.000000", deviationPercent: "1.1970" },
    ], "0.5000");
    expect(message).toContain("USD 100");
    expect(message).toContain("1,2%");
    expect(message).toContain("16.290");
    expect(message).toContain("0,5%");
    expect(message).toContain("Isi alasan selisih harga atau pakai kurs papan.");
  });

  it("menyebut setiap baris yang melampaui batas, bukan hanya yang pertama", () => {
    const message = deviationRejectionMessage([
      { currencyCode: "USD", denominationValue: "100.000000", agreedRate: "16485", referenceRate: "16290", deviationPercent: "1.1970" },
      { currencyCode: "SGD", denominationValue: "50.000000", agreedRate: "12000", referenceRate: "12500", deviationPercent: "4.0000" },
    ], "0.5000");
    expect(message).toContain("USD 100");
    expect(message).toContain("SGD 50");
  });
});

describe("alasan tinjauan", () => {
  it("memakai kode yang sama dengan daftar alasan yang sudah ada", () => {
    expect(RATE_DEVIATION_REVIEW_REASON).toBe("SELISIH_KURS_MELEBIHI_TOLERANSI");
  });
});
