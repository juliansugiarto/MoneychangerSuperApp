import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { suggestDenominationBreakdown } from "./operations";

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    limit: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

/** Tells apart the currency-lookup select() from the stock-balance select() by their field shape, same trick simulation.test.ts uses. */
function mockDbWithStock(stockRows: { value: string; quantity: number }[]) {
  const fakeDb = {
    select: vi.fn((fields: Record<string, unknown>) => makeReader("code" in fields ? [{ code: "IDR" }] : stockRows)),
  };
  return vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

describe("suggestDenominationBreakdown", () => {
  it("finds an exact combination when one exists within available quantities", async () => {
    const getDb = mockDbWithStock([
      { value: "100000.000000", quantity: 5 },
      { value: "50000.000000", quantity: 3 },
      { value: "20000.000000", quantity: 10 },
    ]);
    const result = await suggestDenominationBreakdown({ currencyId: 1, targetAmount: "590000" });
    expect(result.exact).toBe(true);
    expect(result.shortfall).toBe("0");
    const total = result.breakdown.reduce((sum, row) => sum + Number(row.value) * row.quantity, 0);
    expect(total).toBe(590000);
    // never exceeds recorded stock for any denomination used
    for (const row of result.breakdown) {
      const stocked = row.value === "100000.000000" ? 5 : row.value === "50000.000000" ? 3 : 10;
      expect(row.quantity).toBeLessThanOrEqual(stocked);
    }
    getDb.mockRestore();
  });

  it("reports an honest shortfall instead of a wrong total when stock genuinely can't cover the target", async () => {
    // Only 100,000 notes on hand (350 of them = Rp 35,000,000) but the target needs an amount
    // that isn't a clean multiple of 100,000 — mirrors the real bug report (needed 7x 50,000 with
    // zero 50,000 notes in stock).
    const getDb = mockDbWithStock([{ value: "100000.000000", quantity: 350 }]);
    const result = await suggestDenominationBreakdown({ currencyId: 1, targetAmount: "35390000" });
    expect(result.exact).toBe(false);
    expect(result.shortfall).toBe("390000");
    const total = result.breakdown.reduce((sum, row) => sum + Number(row.value) * row.quantity, 0);
    expect(total).toBe(35000000);
    expect(result.breakdown[0]).toEqual({ value: "100000.000000", quantity: 350 });
    getDb.mockRestore();
  });

  it("never suggests more notes of a denomination than are actually in stock", async () => {
    const getDb = mockDbWithStock([
      { value: "50000.000000", quantity: 2 },
      { value: "20000.000000", quantity: 100 },
    ]);
    // A greedy-only approach would want 7x 50,000, but only 2 are in stock.
    const result = await suggestDenominationBreakdown({ currencyId: 1, targetAmount: "350000" });
    expect(result.exact).toBe(true);
    const fifty = result.breakdown.find((row) => row.value === "50000.000000");
    expect(fifty?.quantity ?? 0).toBeLessThanOrEqual(2);
    const total = result.breakdown.reduce((sum, row) => sum + Number(row.value) * row.quantity, 0);
    expect(total).toBe(350000);
    getDb.mockRestore();
  });

  it("rejects a non-positive target", async () => {
    const getDb = mockDbWithStock([{ value: "100000.000000", quantity: 5 }]);
    await expect(suggestDenominationBreakdown({ currencyId: 1, targetAmount: "0" })).rejects.toThrow(/lebih besar dari nol/);
    getDb.mockRestore();
  });

  it("rejects when no stock is recorded for the currency at all", async () => {
    const getDb = mockDbWithStock([]);
    await expect(suggestDenominationBreakdown({ currencyId: 1, targetAmount: "100000" })).rejects.toThrow(/Belum ada stok pecahan/);
    getDb.mockRestore();
  });
});
