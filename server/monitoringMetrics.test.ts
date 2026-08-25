import { describe, expect, it } from "vitest";
import { minorToDecimal, summarizeMonitoring, type MonitoringRecord } from "../shared/monitoring";

const records: MonitoringRecord[] = [
  { transaction: { id: 1, operation: "BUY", status: "PENDING_REVIEW", requiresReview: true, transactionAt: "2026-08-18T04:00:00.000Z", rupiahAmount: "150000.50" }, customer: { id: 10, fullName: "Nasabah Satu" }, currency: { code: "USD" } },
  { transaction: { id: 2, operation: "SELL", status: "COMPLETED", requiresReview: false, transactionAt: "2026-08-18T08:00:00.000Z", rupiahAmount: "250000" }, customer: { id: 10, fullName: "Nasabah Satu" }, currency: { code: "USD" } },
  { transaction: { id: 3, operation: "BUY", status: "COMPLETED", requiresReview: false, transactionAt: "2026-08-19T05:00:00.000Z", rupiahAmount: "100000" }, customer: { id: 11, fullName: "Nasabah Dua" }, currency: { code: "JPY" } },
];

describe("summarizeMonitoring", () => {
  it("menghasilkan keadaan kosong yang jujur tanpa angka atau rasio buatan", () => {
    const summary = summarizeMonitoring([]);
    expect(summary.transactionCount).toBe(0);
    expect(summary.uniqueCustomerCount).toBe(0);
    expect(summary.reviewRatePct).toBe(0);
    expect(summary.daily).toEqual([]);
    expect(minorToDecimal(summary.totalValueMinor)).toBe("0.00");
  });

  it("mengagregasi bon beli dan jual dengan presisi minor-unit", () => {
    const summary = summarizeMonitoring(records);
    expect(summary.transactionCount).toBe(3);
    expect(summary.buyCount).toBe(2);
    expect(summary.sellCount).toBe(1);
    expect(summary.uniqueCustomerCount).toBe(2);
    expect(minorToDecimal(summary.buyValueMinor)).toBe("250000.50");
    expect(minorToDecimal(summary.sellValueMinor)).toBe("250000.00");
    expect(minorToDecimal(summary.totalValueMinor)).toBe("500000.50");
    expect(summary.currencies.map((item) => item.code)).toEqual(["USD", "JPY"]);
  });

  it("menjaga filter arah transaksi dan menghitung sinyal review dari data asli", () => {
    const summary = summarizeMonitoring(records, "BUY");
    expect(summary.transactionCount).toBe(2);
    expect(summary.pendingReviewCount).toBe(1);
    expect(summary.requiresReviewCount).toBe(1);
    expect(summary.reviewRatePct).toBe(50);
    expect(summary.daily).toHaveLength(2);
  });
});
