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

const liveCustomer = { id: 10, isDemo: false, profileStatus: "ACTIVE", riskLevel: "LOW" };
const demoCustomer = { ...liveCustomer, isDemo: true };
const demoTransaction = { id: 30, isDemo: true, status: "DRAFT", tellerUserId: 9, requiresReview: false };

describe("isolasi struktural data demo", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("menolak customer demo pada pembuatan transaksi live", async () => {
    // Operational rates are now optional reference-only data (teller types the price manually per
    // line), so a demo rate can no longer block bon creation the way a demo customer still does.
    // createTransaction's activeRatesByCurrency lookup filters eq(operationalRates.isDemo, false)
    // directly, so a demo rate simply never becomes a line's referenceRateSnapshot — see that query.
    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([demoCustomer]));
    await expect(operations.createTransaction({ customerId: 10, operation: "BUY", receiptNumber: "1", lines: [{ currencyId: 1, denominations: [{ value: "100", quantity: 1, rate: "15000" }] }], paymentMethod: "CASH", transactionAt: new Date() }, 9)).rejects.toThrow("Nasabah demo");
  });

  it("menolak transaksi demo pada seluruh tindakan lifecycle live", async () => {
    const actor = { id: 9, role: "TELLER" as const };

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([demoTransaction]));
    await expect(operations.submitTransaction(30, actor)).rejects.toThrow("Transaksi demo");

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([demoTransaction]));
    await expect(operations.cancelTransaction(30, "uji", actor)).rejects.toThrow("Transaksi demo");

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([{ ...demoTransaction, status: "PENDING_REVIEW" }]));
    await expect(operations.recordReviewAction({ transactionId: 30, action: "APPROVED", notes: "uji" }, 8)).rejects.toThrow("Transaksi demo");

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([{ ...demoTransaction, status: "APPROVED" }]));
    await expect(operations.completeTransaction(30, actor)).rejects.toThrow("Transaksi demo");
  });

  it("menyaring record demo dari daftar transaksi dan laporan live", async () => {
    const liveRow = { transaction: { id: 1, isDemo: false }, customer: { id: 1, isDemo: false }, currency: { code: "USD" } };
    const demoTransactionRow = { transaction: { id: 2, isDemo: true }, customer: { id: 1, isDemo: false }, currency: { code: "USD" } };
    const demoCustomerRow = { transaction: { id: 3, isDemo: false }, customer: { id: 2, isDemo: true }, currency: { code: "JPY" } };

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([liveRow, demoTransactionRow, demoCustomerRow]));
    await expect(operations.listTransactions({ id: 9, role: "ADMIN" })).resolves.toEqual([{ ...liveRow, lines: [] }]);

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([liveRow, demoTransactionRow, demoCustomerRow]));
    await expect(operations.getTransactionReport({ from: new Date("2026-08-01"), to: new Date("2026-08-31") })).resolves.toEqual([liveRow]);
  });
});
