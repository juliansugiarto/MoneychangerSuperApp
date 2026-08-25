import { describe, expect, it } from "vitest";
import { customerInput } from "./routers";
import { assessReviewRequirement, assertTransactionCanBeCancelled, calculateCashBalanceAfter, calculateRupiahAmount, calculateStockVariance, captureRateSnapshot, submissionTransition } from "./operations";
import { v1Fixtures } from "./v1Fixtures";

describe("V1 use-case scenarios with isolated dummy data", () => {
  it("accepts a complete KYC/CDD customer fixture", () => {
    expect(customerInput.parse(v1Fixtures.customer)).toMatchObject({
      cifNumber: "TEST-CIF-0001",
      placeOfBirth: "Jakarta",
      phoneNumber: "081234567890",
      sourceOfFunds: "Penghasilan bulanan",
    });
  });

  it("rejects an incomplete KYC/CDD profile before it can be created", () => {
    const { placeOfBirth: _placeOfBirth, ...incomplete } = v1Fixtures.customer;
    expect(customerInput.safeParse(incomplete).success).toBe(false);
  });

  it("requires a contact number so a newly created KYC profile can support the printed bon", () => {
    const { phoneNumber: _phoneNumber, ...withoutPhone } = v1Fixtures.customer;
    expect(customerInput.safeParse(withoutPhone).success).toBe(false);
  });

  it("processes a normal BUY transaction through approval and an atomic cash increase", () => {
    const fixture = v1Fixtures.normalUsdBuy;
    const rupiahAmount = calculateRupiahAmount(fixture.foreignAmount, fixture.rate, fixture.quoteUnit);
    const review = assessReviewRequirement({ rupiahAmount, thresholdUsd: "10000.00", usdSellRate: fixture.rate, usdQuoteUnit: fixture.quoteUnit, profileStatus: "ACTIVE", riskLevel: "LOW" });

    expect(rupiahAmount).toBe("4000000.00");
    expect(review.requiresReview).toBe(false);
    expect(submissionTransition("DRAFT", review.requiresReview)).toEqual({ status: "APPROVED", reviewStatus: "NOT_REVIEWED" });
    expect(calculateCashBalanceAfter(fixture.operation, fixture.currentCashBalance, fixture.foreignAmount)).toBe("1250.000000");
  });

  it("flags a high-risk JPY SELL transaction and preserves its quote-unit snapshot for review", () => {
    const fixture = v1Fixtures.flaggedJpySell;
    const rupiahAmount = calculateRupiahAmount(fixture.foreignAmount, fixture.rate, fixture.quoteUnit);
    const review = assessReviewRequirement({ rupiahAmount, thresholdUsd: "10000.00", usdSellRate: "16000.000000", usdQuoteUnit: "1.000000", profileStatus: "ACTIVE", riskLevel: fixture.riskLevel });

    expect(captureRateSnapshot(fixture.rate, fixture.quoteUnit)).toEqual({ rateSnapshot: "11272.750000", quoteUnitSnapshot: "100.000000" });
    expect(review).toMatchObject({ requiresReview: true, reviewReason: "RISIKO_NASABAH_TINGGI" });
    expect(submissionTransition("DRAFT", review.requiresReview)).toEqual({ status: "PENDING_REVIEW", reviewStatus: "NEEDS_REVIEW" });
  });

  it("prevents a SELL from taking cash below zero and keeps completed records non-cancellable", () => {
    expect(() => calculateCashBalanceAfter("SELL", "100.000000", "101.000000")).toThrow("Saldo valuta tidak mencukupi");
    expect(() => assertTransactionCanBeCancelled("COMPLETED")).toThrow("tidak dapat dibatalkan");
  });

  it("records a valid zero physical count as a measurable stock-opname variance", () => {
    expect(calculateStockVariance("0", "125.500000")).toBe("-125.500000");
  });
});
