import { beforeEach, describe, expect, it, vi } from "vitest";

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
    then: (onfulfilled, onrejected) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
  return query;
}

function databaseWithSelectResults(...results: unknown[][]) {
  let index = 0;
  const database = {
    select: vi.fn(() => queryResult(results[index++] ?? [])),
    update: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn(),
  };
  return {
    ...database,
    transaction: vi.fn(async (callback: (tx: typeof database) => unknown) => callback(database)),
  };
}

const liveCustomer = { id: 10, isDemo: false, isHistorical: false, profileStatus: "ACTIVE", riskLevel: "LOW" };
const historicalCustomer = { ...liveCustomer, isHistorical: true };
const historicalTransaction = {
  id: 30,
  isDemo: false,
  isHistorical: true,
  status: "PENDING_REVIEW",
  tellerUserId: 9,
  requiresReview: true,
  currencyId: 1,
  transactionNumber: "HIST-0001",
  operation: "BUY",
  foreignAmount: "100.000000",
};

describe("use case isolasi buku besar historis", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("menampilkan catatan historis hanya pada arsip, bukan daftar maupun laporan live", async () => {
    const liveRow = { transaction: { id: 1, isDemo: false, isHistorical: false }, customer: { id: 1, isDemo: false, isHistorical: false }, currency: { code: "USD" } };
    const historicalRow = { transaction: { id: 2, isDemo: false, isHistorical: true }, customer: { id: 2, isDemo: false, isHistorical: true }, currency: { code: "JPY" } };
    const dateRange = { from: new Date("2025-01-01"), to: new Date("2027-01-01") };

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([liveRow, historicalRow]));
    await expect(operations.listTransactions({ id: 9, role: "ADMIN" })).resolves.toEqual([{ ...liveRow, lines: [] }]);

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([liveRow, historicalRow]));
    await expect(operations.getTransactionReport(dateRange)).resolves.toEqual([liveRow]);

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([liveRow, historicalRow]));
    await expect(operations.getHistoricalTransactionReport(dateRange)).resolves.toEqual([historicalRow]);
  });

  it("menolak data historis pada pembuatan transaksi live dan seluruh mutasi transaksi atau kas live", async () => {
    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([historicalCustomer]));
    await expect(operations.createTransaction({ customerId: 10, operation: "BUY", receiptNumber: "1", lines: [{ currencyId: 1, denominations: [{ value: "100", quantity: 1, rate: "15000" }] }], paymentMethod: "CASH", transactionAt: new Date() }, 9)).rejects.toThrow("Nasabah demo atau historis");
    // Operational rates are now optional reference-only data (teller types the price manually per
    // line), so a historical rate can no longer block bon creation the way it used to — createTransaction's
    // activeRatesByCurrency lookup filters eq(operationalRates.isHistorical, false) directly instead.

    const actor = { id: 9, role: "STAFF" as const };
    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([historicalTransaction]));
    await expect(operations.recordReviewAction({ transactionId: 30, action: "APPROVED", notes: "uji" }, 8)).rejects.toThrow("Transaksi demo atau historis");

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([historicalTransaction]));
    await expect(operations.completeTransaction(30, actor)).rejects.toThrow("Transaksi demo atau historis");
  });
});
