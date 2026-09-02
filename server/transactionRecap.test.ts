import { describe, expect, it, vi } from "vitest";

const getDbMock = vi.fn();

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

const operations = await import("./operations");

function queryResult<T>(rows: T[]) {
  const query: Record<string, unknown> & PromiseLike<T[]> = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
  return query;
}

/** getTransactionReport issues exactly two db.select calls in order: legacy single-currency rows, then multi-line rows. */
function databaseWithSelectResults(...results: unknown[][]) {
  let index = 0;
  return { select: vi.fn(() => queryResult(results[index++] ?? [])) };
}

const usd = { code: "USD" };
const customer = { id: 1, isDemo: false, isHistorical: false };

function completedTransaction(overrides: Record<string, unknown>) {
  return { id: overrides.id, transactionAt: new Date("2026-09-01T08:00:00.000Z"), status: "COMPLETED", operation: "BUY", isDemo: false, isHistorical: false, ...overrides };
}

describe("getTransactionRecap — weighted-average gross margin estimate", () => {
  it("computes per-currency volume, avg rates, and a matched-volume margin estimate from COMPLETED transactions only", async () => {
    const rows = [
      { transaction: completedTransaction({ id: 1, operation: "BUY", foreignAmount: "1000", rateSnapshot: "15000", rupiahAmount: "15000000.00" }), customer, currency: usd },
      { transaction: completedTransaction({ id: 2, operation: "BUY", foreignAmount: "1000", rateSnapshot: "15000", rupiahAmount: "15000000.00" }), customer, currency: usd },
      { transaction: completedTransaction({ id: 3, operation: "SELL", foreignAmount: "800", rateSnapshot: "15600", rupiahAmount: "12480000.00" }), customer, currency: usd },
      // Not COMPLETED — must be excluded from the recap entirely.
      { transaction: completedTransaction({ id: 4, operation: "SELL", status: "DRAFT", foreignAmount: "500", rateSnapshot: "15600", rupiahAmount: "7800000.00" }), customer, currency: usd },
      { transaction: completedTransaction({ id: 5, operation: "SELL", status: "CANCELLED", foreignAmount: "500", rateSnapshot: "15600", rupiahAmount: "7800000.00" }), customer, currency: usd },
    ];
    getDbMock.mockResolvedValueOnce(databaseWithSelectResults(rows, []));

    const recap = await operations.getTransactionRecap({ from: new Date("2026-09-01"), to: new Date("2026-09-02") });

    expect(recap.transactionCount).toBe(3);
    expect(recap.buyCount).toBe(2);
    expect(recap.sellCount).toBe(1);
    expect(recap.totalBuyRupiah).toBe("30000000.00");
    expect(recap.totalSellRupiah).toBe("12480000.00");
    expect(recap.totalTurnoverRupiah).toBe("42480000.00");

    expect(recap.currencies).toHaveLength(1);
    const usdRow = recap.currencies[0];
    expect(usdRow.currencyCode).toBe("USD");
    expect(usdRow.avgBuyRate).toBe("15000.000000");
    expect(usdRow.avgSellRate).toBe("15600.000000");
    // matched volume = min(2000 bought, 800 sold) = 800; margin = (15600 - 15000) * 800 = 480000
    expect(usdRow.grossMarginEstimate).toBe("480000.00");
    expect(recap.totalGrossMarginEstimate).toBe("480000.00");
  });

  it("returns nulls for a currency with only one side (nothing to match against)", async () => {
    const rows = [
      { transaction: completedTransaction({ id: 1, operation: "BUY", foreignAmount: "200", rateSnapshot: "20000", rupiahAmount: "4000000.00" }), customer, currency: { code: "EUR" } },
    ];
    getDbMock.mockResolvedValueOnce(databaseWithSelectResults(rows, []));

    const recap = await operations.getTransactionRecap({ from: new Date("2026-09-01"), to: new Date("2026-09-02") });
    expect(recap.currencies[0].avgSellRate).toBeNull();
    expect(recap.currencies[0].grossMarginEstimate).toBeNull();
    expect(recap.totalGrossMarginEstimate).toBe("0.00");
  });
});
