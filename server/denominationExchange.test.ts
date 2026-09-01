import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { recordDenominationExchange, suggestDenominationExchange } from "./operations";

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    limit: () => makeReader(rows),
    innerJoin: () => makeReader(rows),
    orderBy: () => Promise.resolve(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

describe("suggestDenominationExchange", () => {
  function mockDb(stockRows: { value: string; quantity: number }[]) {
    const fakeDb = { select: vi.fn((fields: Record<string, unknown>) => makeReader("code" in fields ? [{ code: "IDR" }] : stockRows)) };
    return vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  }

  it("proposes breaking the smallest available note that covers the shortfall, decomposed into curated denominations summing exactly to it", async () => {
    const getDb = mockDb([{ value: "100000.000000", quantity: 350 }]);
    const result = await suggestDenominationExchange({ currencyId: 1, shortfallAmount: "25000" });
    expect(result.give).toEqual([{ value: "100000", quantity: 1 }]);
    const receiveTotal = result.receive.reduce((sum, row) => sum + Number(row.value) * row.quantity, 0);
    expect(receiveTotal).toBe(100000); // never invents or loses value
    expect(result.receive.some((row) => row.value === "100000")).toBe(false); // never "exchanges" a note for itself
    getDb.mockRestore();
  });

  it("picks a smaller note over a larger one when both would cover the shortfall, to minimize overbreaking", async () => {
    const getDb = mockDb([
      { value: "100000.000000", quantity: 10 },
      { value: "50000.000000", quantity: 10 },
    ]);
    const result = await suggestDenominationExchange({ currencyId: 1, shortfallAmount: "25000" });
    expect(result.give).toEqual([{ value: "50000", quantity: 1 }]);
    getDb.mockRestore();
  });

  it("refuses when no single note in stock is large enough to cover the shortfall", async () => {
    const getDb = mockDb([{ value: "5000.000000", quantity: 100 }]);
    await expect(suggestDenominationExchange({ currencyId: 1, shortfallAmount: "25000" })).rejects.toThrow(/Tidak ada pecahan/);
    getDb.mockRestore();
  });
});

describe("recordDenominationExchange", () => {
  function mockDb(denominationQuantity: Record<string, number>) {
    const balanceRow = { id: 1, currencyId: 1, availableAmount: "999999999.000000" };
    const inserted: { table: string; values: unknown }[] = [];
    const fakeTx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn((fields: Record<string, unknown>) => {
        if ("quantity" in fields) {
          // stock lookup for a specific denomination during the give-side sufficiency check
          return { from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) } as never;
        }
        return { from: () => ({ where: () => ({ limit: () => Promise.resolve([balanceRow]) }) }) } as never;
      }),
      insert: vi.fn(() => ({ values: (values: unknown) => { inserted.push({ table: "unknown", values }); return { $returningId: () => Promise.resolve([{ id: inserted.length }]) }; } })),
    };
    const fakeDb = {
      select: vi.fn((fields: Record<string, unknown>) => makeReader("code" in fields ? [{ code: "IDR" }] : [])),
      transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(fakeTx)),
    };
    return { getDb: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), fakeTx, inserted, denominationQuantity };
  }

  it("rejects an exchange where give and receive don't sum to the same value", async () => {
    const { getDb } = mockDb({});
    await expect(recordDenominationExchange(
      { currencyId: 1, give: [{ value: "100000", quantity: 1 }], receive: [{ value: "50000", quantity: 1 }] },
      { id: 1, role: "STAFF" },
    )).rejects.toThrow(/sama persis/);
    getDb.mockRestore();
  });

  it("rejects a non-real denomination on either side", async () => {
    const { getDb } = mockDb({});
    await expect(recordDenominationExchange(
      { currencyId: 1, give: [{ value: "100000", quantity: 1 }], receive: [{ value: "25000", quantity: 4 }] },
      { id: 1, role: "STAFF" },
    )).rejects.toThrow(/bukan pecahan/);
    getDb.mockRestore();
  });
});
