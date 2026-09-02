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
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    insert: vi.fn(() => ({ values: () => Promise.resolve() })),
    execute: vi.fn(),
  };
  return {
    ...database,
    transaction: vi.fn(async (callback: (tx: typeof database) => unknown) => callback(database)),
  };
}

const pendingTransaction = { id: 30, status: "PENDING_REVIEW", isDemo: false, isHistorical: false, tellerUserId: 9, transactionNumber: "TX-30" };

describe("recordReviewAction — maker-checker", () => {
  beforeEach(() => getDbMock.mockReset());

  it("rejects a non-shareholder reviewer who is also the transaction's own teller (maker)", async () => {
    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([pendingTransaction]));
    await expect(operations.recordReviewAction({ transactionId: 30, action: "APPROVED", notes: "uji" }, { id: 9, role: "ADMIN" })).rejects.toThrow("tidak dapat meninjau transaksinya sendiri");
  });

  it("rejects a CONTROLLER maker reviewing their own transaction too", async () => {
    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([pendingTransaction]));
    await expect(operations.recordReviewAction({ transactionId: 30, action: "RETURNED", notes: "uji" }, { id: 9, role: "CONTROLLER" })).rejects.toThrow("tidak dapat meninjau transaksinya sendiri");
  });

  it("allows a SHAREHOLDER to bypass maker-checker and review their own transaction", async () => {
    // RETURNED (not APPROVED) avoids the extra createDirectorKnowledgeItem side-call that would need its own db mock.
    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([pendingTransaction]));
    await expect(operations.recordReviewAction({ transactionId: 30, action: "RETURNED", notes: "uji" }, { id: 9, role: "SHAREHOLDER" })).resolves.not.toThrow();
  });

  it("allows a different reviewer (not the maker) to review normally", async () => {
    getDbMock.mockResolvedValueOnce(databaseWithSelectResults([pendingTransaction]));
    await expect(operations.recordReviewAction({ transactionId: 30, action: "RETURNED", notes: "uji" }, { id: 8, role: "ADMIN" })).resolves.not.toThrow();
  });
});
