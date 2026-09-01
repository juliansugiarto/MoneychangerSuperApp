import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { activateOperationalRate, assessReviewRequirement, assertComplaintStatusTransition, assertTransactionCanBeCancelled, calculateCashBalanceAfter, calculateOpeningCashAdjustment, calculateRupiahAmount, calculateStockVariance, captureRateSnapshot, differencePercent, jakartaBusinessDate, midpointPerUnit, normalizeEddCashDailyThreshold, normalizeRateShockThreshold, normalizeReviewThreshold, openingCashMovementReason, retryTransientDatabaseRead, selectPublicActiveRateRows, submissionTransition, waitForConcurrentInitialization } from "./operations";

describe("calculateRupiahAmount", () => {
  it("calculates Rupiah from a decimal foreign amount without floating point artifacts", () => {
    expect(calculateRupiahAmount("1234.567891", "15789.123456", "1")).toBe("19492744.85");
  });

  it("respects a BI quote unit of 100 for JPY and rounds at the final Rupiah amount", () => {
    expect(calculateRupiahAmount("1.25", "11272.75", "100")).toBe("140.91");
  });

  it("rejects a non-positive foreign amount", () => {
    expect(() => calculateRupiahAmount("0", "17786.62", "1")).toThrow("Nominal valuta harus lebih besar dari nol.");
  });
});

describe("inisialisasi checklist paralel", () => {
  it("membaca ulang row yang dibuat permintaan lain tanpa mengulang penulisan", async () => {
    const row = { id: 17, businessDate: "2026-08-25" };
    const read = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(row);

    await expect(waitForConcurrentInitialization(read, 3, 0)).resolves.toEqual(row);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("berhenti setelah batas pembacaan ulang bila row belum tersedia", async () => {
    const read = vi.fn().mockResolvedValue(undefined);

    await expect(waitForConcurrentInitialization(read, 2, 0)).resolves.toBeUndefined();
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe("tanggal bisnis Jakarta", () => {
  it("menghasilkan awal hari UTC agar cocok dengan kolom MySQL DATE", () => {
    expect(jakartaBusinessDate(new Date("2026-08-24T18:30:00.000Z")).toISOString()).toBe("2026-08-25T00:00:00.000Z");
  });
});

describe("review thresholds and immutable rate snapshots", () => {
  it("normalizes the configurable review threshold in decimal precision", () => {
    expect(normalizeReviewThreshold("10000.005")).toBe("10000.01");
  });

  it("normalizes the configurable EDD cash threshold in Rupiah precision", () => {
    expect(normalizeEddCashDailyThreshold("100000000.005")).toBe("100000000.01");
  });

  it("normalizes a material-rate-movement threshold to four decimal places", () => {
    expect(normalizeRateShockThreshold("1.23456")).toBe("1.2346");
  });

  it("flags an amount exactly at the configured USD-equivalent threshold", () => {
    expect(assessReviewRequirement({ rupiahAmount: "160000000.00", thresholdUsd: "10000.00", usdSellRate: "16000.00", usdQuoteUnit: "1.00", profileStatus: "ACTIVE", riskLevel: "LOW" })).toMatchObject({ requiresReview: true, reviewReason: "NILAI_SETARA_USD_MELEBIHI_AMBANG" });
  });

  it("flags a high-risk profile even below the value threshold", () => {
    expect(assessReviewRequirement({ rupiahAmount: "1000000.00", thresholdUsd: "10000.00", usdSellRate: "16000.00", usdQuoteUnit: "1.00", profileStatus: "ACTIVE", riskLevel: "HIGH" })).toMatchObject({ requiresReview: true, reviewReason: "RISIKO_NASABAH_TINGGI" });
  });

  it("flags a cash transaction when its Jakarta-day cash accumulation reaches the EDD threshold", () => {
    expect(assessReviewRequirement({ rupiahAmount: "15000000.00", thresholdUsd: "10000.00", usdSellRate: "16000.00", usdQuoteUnit: "1.00", cashDailyRupiahTotal: "100000000.00", eddCashDailyThresholdIdr: "100000000.00", isCashPayment: true, profileStatus: "ACTIVE", riskLevel: "LOW" })).toMatchObject({ requiresReview: true, reviewReason: "AKUMULASI_TRANSAKSI_TUNAI_HARIAN_MEMENUHI_AMBANG_EDD" });
  });

  it("flags a single cash transaction at or above the Rp 500 million LTKT threshold", () => {
    const result = assessReviewRequirement({ rupiahAmount: "500000000.00", thresholdUsd: "10000.00", isCashPayment: true, profileStatus: "ACTIVE", riskLevel: "LOW" });
    expect(result.meetsLtktThreshold).toBe(true);
    expect(result.reviewReason).toContain("MEMENUHI_AMBANG_LTKT_PPATK");
  });

  it("flags a cash day whose accumulated total reaches the LTKT threshold even if this transaction alone doesn't", () => {
    const result = assessReviewRequirement({ rupiahAmount: "50000000.00", thresholdUsd: "10000.00", cashDailyRupiahTotal: "500000000.00", isCashPayment: true, profileStatus: "ACTIVE", riskLevel: "LOW" });
    expect(result.meetsLtktThreshold).toBe(true);
  });

  it("never flags the LTKT threshold for a bank transfer, even above Rp 500 million", () => {
    const result = assessReviewRequirement({ rupiahAmount: "600000000.00", thresholdUsd: "10000.00", isCashPayment: false, profileStatus: "ACTIVE", riskLevel: "LOW" });
    expect(result.meetsLtktThreshold).toBe(false);
  });

  it("copies both the rate and quote unit used by a transaction", () => {
    const captured = captureRateSnapshot("11272.75", "100");
    const laterMasterRate = captureRateSnapshot("11500.00", "1");
    expect(captured).toEqual({ rateSnapshot: "11272.750000", quoteUnitSnapshot: "100.000000" });
    expect(captured).not.toEqual(laterMasterRate);
  });
});

describe("operational-rate activation controls", () => {
  it("rejects activation before any database write when the decision reason is too short", async () => {
    await expect(activateOperationalRate(1, 1, "singkat"))
      .rejects.toThrow("Alasan aktivasi kurs minimal 10 karakter.");
  });
});

describe("rate comparison arithmetic", () => {
  it("normalizes a JPY quote per 100 into a midpoint per one currency unit", () => {
    expect(midpointPerUnit("11091.40", "11203.58", "100")).toBe("111.474900");
  });

  it("calculates the outlet difference against a reference without floating-point artifacts", () => {
    expect(differencePercent("17703.000000", "17616.470000")).toBe("0.4912");
    expect(differencePercent("100", null)).toBeNull();
  });
});

describe("transaction lifecycle rules", () => {
  it("routes a flagged draft into review and a normal draft to approval", () => {
    expect(submissionTransition("DRAFT", true)).toEqual({ status: "PENDING_REVIEW", reviewStatus: "NEEDS_REVIEW" });
    expect(submissionTransition("DRAFT", false)).toEqual({ status: "APPROVED", reviewStatus: "NOT_REVIEWED" });
  });

  it("blocks cancellation after completion while allowing a draft to be cancelled", () => {
    expect(() => assertTransactionCanBeCancelled("COMPLETED")).toThrow("tidak dapat dibatalkan");
    expect(() => assertTransactionCanBeCancelled("DRAFT")).not.toThrow();
  });
});

describe("consumer complaint lifecycle rules", () => {
  it("allows a received complaint to be put under review", () => {
    expect(() => assertComplaintStatusTransition("OPEN", "IN_REVIEW")).not.toThrow();
  });

  it("requires a written result for resolution or escalation", () => {
    expect(() => assertComplaintStatusTransition("IN_REVIEW", "RESOLVED")).toThrow("wajib diisi");
    expect(() => assertComplaintStatusTransition("IN_REVIEW", "ESCALATED_LAPS_BI", "Dokumen pendukung diteruskan untuk evaluasi.")).not.toThrow();
  });

  it("prevents reopening or altering an outcome that is already final", () => {
    expect(() => assertComplaintStatusTransition("RESOLVED", "IN_REVIEW")).toThrow("hasil akhir");
    expect(() => assertComplaintStatusTransition("IN_REVIEW", "OPEN")).toThrow("status awal");
  });
});

describe("stock opname arithmetic", () => {
  it("accepts a valid zero physical count and calculates a negative variance", () => {
    expect(calculateStockVariance("0", "125.500000")).toBe("-125.500000");
  });

  it("rejects a negative physical balance", () => {
    expect(() => calculateStockVariance("-1", "0")).toThrow("Saldo fisik tidak boleh bernilai negatif.");
  });
});

describe("cash balance arithmetic", () => {
  it("adds completed BUY amounts and subtracts completed SELL amounts without floating point loss", () => {
    expect(calculateCashBalanceAfter("BUY", "12.500000", "0.125000")).toBe("12.625000");
    expect(calculateCashBalanceAfter("SELL", "12.625000", "0.125000")).toBe("12.500000");
  });

  it("creates a stable Jakarta-business-date opening key and adjusts the ledger to the declared physical opening cash", () => {
    expect(openingCashMovementReason("usd", new Date("2026-08-13T12:00:00.000Z"))).toBe("OPENING_CASH_2026-08-13_USD");
    expect(calculateOpeningCashAdjustment("1250.500000", "1200.125000")).toBe("-50.375000");
  });
});

describe("transient database read retry", () => {
  it("retries once after a temporary DNS failure", async () => {
    let attempts = 0;
    const result = await retryTransientDatabaseRead(async () => {
      attempts += 1;
      if (attempts === 1) {
        const error = Object.assign(new Error("query failed"), { cause: { code: "EAI_AGAIN" } });
        throw error;
      }
      return "success";
    }, 0);

    expect(result).toBe("success");
    expect(attempts).toBe(2);
  });
});

describe("public operational-rate visibility", () => {
  it("shows one current active real rate per currency and excludes structurally marked demo, future, and retired records", () => {
    const now = new Date("2026-08-13T05:00:00.000Z");
    const rows = [
      { rate: { currencyId: 1, status: "ACTIVE", effectiveAt: new Date("2026-08-13T04:00:00.000Z"), notes: null }, label: "USD-current" },
      { rate: { currencyId: 1, status: "ACTIVE", effectiveAt: new Date("2026-08-13T03:00:00.000Z"), notes: null }, label: "USD-prior" },
      { rate: { currencyId: 2, status: "ACTIVE", effectiveAt: new Date("2026-08-13T04:00:00.000Z"), notes: "[DEMO] training" }, label: "JPY-demo" },
      { rate: { currencyId: 5, status: "ACTIVE", effectiveAt: new Date("2026-08-13T04:00:00.000Z"), notes: null, isDemo: true }, label: "EUR-structural-demo" },
      { rate: { currencyId: 3, status: "ACTIVE", effectiveAt: new Date("2026-08-13T06:00:00.000Z"), notes: null }, label: "SGD-future" },
      { rate: { currencyId: 4, status: "RETIRED", effectiveAt: new Date("2026-08-13T04:00:00.000Z"), notes: null }, label: "AUD-retired" },
    ];

    expect(selectPublicActiveRateRows(rows, now).map((row) => row.label)).toEqual(["USD-current"]);
  });
});
