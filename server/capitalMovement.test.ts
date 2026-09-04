import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { recordCapitalMovement } from "./operations";

function mockDb(currencyCode = "IDR", availableAmount = "0.000000") {
  const inserted: { values: any }[] = [];
  const fakeTx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, currencyId: 1, code: currencyCode, availableAmount, active: true }]) }) }) })),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),
    insert: vi.fn(() => ({ values: (values: any) => { inserted.push({ values }); return { $returningId: () => Promise.resolve([{ id: inserted.length }]), onDuplicateKeyUpdate: () => Promise.resolve(undefined) }; } })),
  };
  const fakeDb = {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ code: currencyCode }]) }) }) })),
    insert: vi.fn(() => ({ values: () => Promise.resolve(undefined) })),
    transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(fakeTx)),
  };
  return { getDb: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), inserted };
}

const controller = { id: 7, role: "CONTROLLER" as const };
const setoran = {
  currencyId: 1, direction: "IN" as const, amount: "500000000",
  notes: "Setoran modal awal dari pemilik",
  denominations: [{ value: "100000", quantity: 5000 }],
};

describe("recordCapitalMovement", () => {
  it("mencatat setoran modal sebagai mutasi berkategori CAPITAL_INJECTION", async () => {
    const { getDb, inserted } = mockDb();
    await recordCapitalMovement(setoran, controller);
    expect(inserted.some((row) => row.values?.category === "CAPITAL_INJECTION" && row.values?.direction === "IN")).toBe(true);
    getDb.mockRestore();
  });

  it("menolak setoran modal dalam valuta asing, karena menjurnalnya menuntut kurs", async () => {
    const { getDb } = mockDb("USD");
    await expect(recordCapitalMovement({ ...setoran, denominations: [{ value: "100", quantity: 10 }], amount: "1000" }, controller))
      .rejects.toThrow(/Rupiah/i);
    getDb.mockRestore();
  });

  it("menolak tanpa rincian pecahan, karena stok pecahan adalah sumber kebenaran operasional", async () => {
    const { getDb } = mockDb();
    await expect(recordCapitalMovement({ ...setoran, denominations: [] }, controller)).rejects.toThrow(/pecahan/i);
    getDb.mockRestore();
  });

  it("menolak rincian pecahan yang tidak sama dengan nominalnya", async () => {
    const { getDb } = mockDb();
    await expect(recordCapitalMovement({ ...setoran, denominations: [{ value: "100000", quantity: 1 }] }, controller)).rejects.toThrow(/tidak sama/i);
    getDb.mockRestore();
  });

  it("menolak catatan yang terlalu pendek untuk menjadi jejak audit", async () => {
    const { getDb } = mockDb();
    await expect(recordCapitalMovement({ ...setoran, notes: "abc" }, controller)).rejects.toThrow(/[Cc]atatan/);
    getDb.mockRestore();
  });

  it("menolak penarikan yang melebihi saldo kas tersedia", async () => {
    const { getDb } = mockDb("IDR", "1000000.000000");
    await expect(recordCapitalMovement({ ...setoran, direction: "OUT" }, controller)).rejects.toThrow(/melebihi saldo/i);
    getDb.mockRestore();
  });
});
