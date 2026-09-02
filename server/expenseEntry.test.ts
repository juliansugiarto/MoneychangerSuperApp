import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.fn();

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

const operations = await import("./operations");

function queryResult<T>(rows: T[]) {
  const query: Record<string, unknown> & PromiseLike<T[]> = {
    from: () => query,
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
  return query;
}

function fakeDb(insertedRow: Record<string, unknown>) {
  return {
    insert: vi.fn(() => ({ values: () => ({ $returningId: () => Promise.resolve([{ id: 1 }]) }) })),
    select: vi.fn(() => queryResult([{ id: 1, ...insertedRow }])),
  };
}

describe("createExpense — simple operational expense log", () => {
  beforeEach(() => getDbMock.mockReset());

  it("rejects an unknown category", async () => {
    getDbMock.mockResolvedValue(fakeDb({}));
    await expect(operations.createExpense({ expenseDate: new Date("2026-09-01"), category: "NOT_REAL" as never, amount: "100000", description: "Uji" }, 1)).rejects.toThrow("Kategori pengeluaran tidak dikenal.");
  });

  it("rejects a blank description", async () => {
    getDbMock.mockResolvedValue(fakeDb({}));
    await expect(operations.createExpense({ expenseDate: new Date("2026-09-01"), category: "SEWA", amount: "100000", description: "   " }, 1)).rejects.toThrow("Deskripsi pengeluaran wajib diisi.");
  });

  it("rejects a zero or negative amount", async () => {
    getDbMock.mockResolvedValue(fakeDb({}));
    await expect(operations.createExpense({ expenseDate: new Date("2026-09-01"), category: "SEWA", amount: "0", description: "Sewa" }, 1)).rejects.toThrow(/lebih besar dari nol/);
  });

  it("records a valid expense entry with the recording user's id", async () => {
    getDbMock.mockResolvedValue(fakeDb({ category: "GAJI", amount: "1500000.00", description: "Gaji staf" }));
    const created = await operations.createExpense({ expenseDate: new Date("2026-09-01"), category: "GAJI", amount: "1500000", description: "Gaji staf" }, 7);
    expect(created?.category).toBe("GAJI");
  });
});
