import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.fn();

vi.mock("./db", () => ({ getDb: getDbMock }));

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
  return {
    select: vi.fn(() => queryResult(results[index++] ?? [])),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    execute: vi.fn(async () => undefined),
  };
}

const liveOpnameRow = { opname: { id: 1, isDemo: false, isHistorical: false }, currency: { code: "USD" } };
const historicalOpnameRow = { opname: { id: 2, isDemo: false, isHistorical: true }, currency: { code: "JPY" } };
const historicalOpname = { id: 2, currencyId: 1, tellerUserId: 9, isDemo: false, isHistorical: true, reconciliationStatus: "SUBMITTED", closingSystemBalance: "0.000000", variance: "0.000000" };

describe("stock opname historis", () => {
  beforeEach(() => getDbMock.mockReset());

  it("menyaring arsip dari daftar dan laporan stock opname live", async () => {
    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([liveOpnameRow, historicalOpnameRow]));
    await expect(operations.listStockOpnames({ id: 9, role: "ADMIN" })).resolves.toEqual([liveOpnameRow]);

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([liveOpnameRow, historicalOpnameRow]));
    await expect(operations.getStockOpnameReport({ from: new Date("2025-01-01"), to: new Date("2027-01-01") })).resolves.toEqual([liveOpnameRow]);
  });

  it("tidak membiarkan arsip menghambat pembukaan atau mengubah siklus opname live", async () => {
    const activeCurrency = { id: 1, code: "USD", active: true };
    const createdLiveOpname = { id: 3, currencyId: 1, isDemo: false, isHistorical: false };
    const openingDb = databaseWithSelectResults([activeCurrency], [historicalOpname], [], [createdLiveOpname]);
    getDbMock.mockResolvedValue(openingDb);
    await expect(operations.openStockOpname({ currencyId: 1, actorUserId: 9 })).resolves.toEqual(createdLiveOpname);

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([historicalOpname]));
    await expect(operations.submitStockOpname({ stockOpnameId: 2, physicalBalance: "0" }, { id: 9, role: "STAFF" })).rejects.toThrow("Stock opname tidak ditemukan.");

    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([historicalOpname]));
    await expect(operations.reconcileStockOpname({ stockOpnameId: 2, notes: "uji" }, 8)).rejects.toThrow("Hanya stock opname SUBMITTED");
  });
});
