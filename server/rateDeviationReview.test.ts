import { describe, expect, it } from "vitest";
import { assessDenominationDeviations, resolveDenominationReference, type ActiveRateForPricing, type PricedEntry } from "./rateBoard";
import { RATE_DEVIATION_REVIEW_REASON } from "../shared/rateDeviation";
import type { RateTierRow } from "../shared/rateTiers";

const TIERS: RateTierRow[] = [
  { id: 5, currencyId: 1, label: "100", denominationValues: ["100"], sortOrder: 1, active: true },
  { id: 6, currencyId: 1, label: "5–20", denominationValues: ["5", "10", "20"], sortOrder: 2, active: true },
];
const RATES: ActiveRateForPricing[] = [
  { id: 21, currencyId: 1, rateTierId: 5, buyRate: "16290.000000", sellRate: "16400.000000", quoteUnit: "1.000000" },
  { id: 22, currencyId: 1, rateTierId: 6, buyRate: "16100.000000", sellRate: "16250.000000", quoteUnit: "1.000000" },
  { id: 23, currencyId: 1, rateTierId: null, buyRate: "16000.000000", sellRate: "16200.000000", quoteUnit: "1.000000" },
];
const entry = (denominationValue: string, agreedRate: string): PricedEntry => ({ currencyId: 1, currencyCode: "USD", denominationValue, agreedRate });
const ALASAN = "Nasabah lama, harga disepakati manajer konter.";

describe("rujukan per baris pecahan", () => {
  it("memakai kurs kelompok yang memuat nilai mukanya", () => {
    expect(resolveDenominationReference(entry("100.000000", "16290"), "BUY", TIERS, RATES))
      .toEqual({ operationalRateId: 21, referenceRateSnapshot: "16290.000000", rateDeviationPercent: "0.0000" });
  });

  it("memakai kurs jual untuk bon JUAL dan kurs beli untuk bon BELI", () => {
    expect(resolveDenominationReference(entry("100.000000", "16400"), "SELL", TIERS, RATES).referenceRateSnapshot).toBe("16400.000000");
    expect(resolveDenominationReference(entry("100.000000", "16290"), "BUY", TIERS, RATES).referenceRateSnapshot).toBe("16290.000000");
  });

  it("jatuh ke kurs tingkat valuta untuk pecahan tanpa kelompok", () => {
    expect(resolveDenominationReference(entry("2.000000", "16000"), "BUY", TIERS, RATES).operationalRateId).toBe(23);
  });

  it("tanpa kurs aktif, baris pecahan tidak membawa rujukan maupun selisih", () => {
    expect(resolveDenominationReference(entry("100.000000", "16290"), "BUY", TIERS, []))
      .toEqual({ operationalRateId: null, referenceRateSnapshot: null, rateDeviationPercent: null });
  });

  it("menyamakan satuan kuotasi: kurs papan per 100 dibandingkan dengan harga bon per 1", () => {
    const jpy: ActiveRateForPricing[] = [{ id: 40, currencyId: 3, rateTierId: null, buyRate: "11225.580000", sellRate: "11340.000000", quoteUnit: "100.000000" }];
    const perSatu = { currencyId: 3, currencyCode: "JPY", denominationValue: "1000.000000", agreedRate: "112.2558", quoteUnit: "1.000000" };
    expect(resolveDenominationReference(perSatu, "BUY", [], jpy))
      .toEqual({ operationalRateId: 40, referenceRateSnapshot: "112.255800", rateDeviationPercent: "0.0000" });
  });

  it("satu bon dapat membawa dua rujukan berbeda untuk dua pecahan", () => {
    const seratus = resolveDenominationReference(entry("100.000000", "16290"), "BUY", TIERS, RATES);
    const sepuluh = resolveDenominationReference(entry("10.000000", "16100"), "BUY", TIERS, RATES);
    expect([seratus.operationalRateId, sepuluh.operationalRateId]).toEqual([21, 22]);
  });
});

describe("toleransi selisih pada bon", () => {
  const tiersByCurrency = new Map([[1, TIERS]]);

  it("menerima harga di dalam toleransi tanpa menyalakan tinjauan", () => {
    const result = assessDenominationDeviations({ entries: [entry("100.000000", "16290")], operation: "BUY", tiersByCurrency, activeRates: RATES, tolerancePercent: "0.5000", reason: null });
    expect(result.exceeding).toEqual([]);
    expect(result.requiresReview).toBe(false);
  });

  it("menolak harga di luar toleransi ketika alasannya kosong, menyebut valuta dan pecahannya", () => {
    expect(() => assessDenominationDeviations({ entries: [entry("100.000000", "16485")], operation: "BUY", tiersByCurrency, activeRates: RATES, tolerancePercent: "0.5000", reason: null }))
      .toThrow(/USD 100.*16\.290.*Isi alasan selisih harga/s);
  });

  it("menolak alasan yang lebih pendek dari sepuluh karakter", () => {
    expect(() => assessDenominationDeviations({ entries: [entry("100.000000", "16485")], operation: "BUY", tiersByCurrency, activeRates: RATES, tolerancePercent: "0.5000", reason: "beda" }))
      .toThrow(/Isi alasan selisih harga/);
  });

  it("menerima harga di luar toleransi dengan alasan, dan menandainya untuk tinjauan", () => {
    const result = assessDenominationDeviations({ entries: [entry("100.000000", "16485")], operation: "BUY", tiersByCurrency, activeRates: RATES, tolerancePercent: "0.5000", reason: ALASAN });
    expect(result.requiresReview).toBe(true);
    expect(result.exceeding).toHaveLength(1);
    // 195 / 16290 x 100 = 1.19705..., dibulatkan setengah ke atas pada 4 desimal menjadi 1.1971.
    expect(result.exceeding[0].deviationPercent).toBe("1.1971");
  });

  it("tidak memeriksa toleransi untuk valuta tanpa kurs aktif", () => {
    const result = assessDenominationDeviations({ entries: [entry("100.000000", "99999")], operation: "BUY", tiersByCurrency, activeRates: [], tolerancePercent: "0.5000", reason: null });
    expect(result.requiresReview).toBe(false);
    expect(result.references[0].rateDeviationPercent).toBeNull();
  });

  it("menyalakan alasan tinjauan yang sama dengan yang dibaca antrean", () => {
    expect(RATE_DEVIATION_REVIEW_REASON).toBe("SELISIH_KURS_MELEBIHI_TOLERANSI");
  });
});
