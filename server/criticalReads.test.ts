import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.fn();

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

const operations = await import("./operations");

function emptySelectQuery() {
  const query: Record<string, unknown> & PromiseLike<unknown[]> = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    then: (onfulfilled, onrejected) => Promise.resolve([]).then(onfulfilled, onrejected),
  };
  return query;
}

function readOnlyDatabase() {
  return { select: vi.fn(() => emptySelectQuery()) };
}

const requester = { id: 901, role: "ADMIN" as const };
const dateRange = { from: new Date("2026-08-01T00:00:00.000Z"), to: new Date("2026-09-01T00:00:00.000Z") };

const criticalReads: Array<[string, () => Promise<unknown>, number]> = [
  ["currency list", () => operations.listCurrencies(), 2],
  ["customer list", () => operations.listCustomers(), 2],
  ["BI reference snapshot list", () => operations.listReferenceSnapshots(), 2],
  ["operational rate list", () => operations.listOperationalRates(), 2],
  ["transaction list", () => operations.listTransactions(requester), 2],
  ["cash balance list", () => operations.listCashBalances(), 2],
  ["stock opname list", () => operations.listStockOpnames(requester), 2],
  ["dashboard", () => operations.getOperationalDashboard(), 3],
  ["transaction report", () => operations.getTransactionReport(dateRange), 2],
  ["stock opname report", () => operations.getStockOpnameReport(dateRange), 2],
  ["audit log", () => operations.getAuditLog(), 2],
];

describe("critical operational reads", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it.each(criticalReads)("retries once and succeeds for %s after a temporary unavailable database", async (_name, read, expectedDatabaseCalls) => {
    getDbMock.mockResolvedValueOnce(null).mockResolvedValue(readOnlyDatabase());

    await expect(read()).resolves.toBeDefined();
    expect(getDbMock).toHaveBeenCalledTimes(expectedDatabaseCalls);
  });
});
