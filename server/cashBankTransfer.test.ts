import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { recordCashBankTransfer } from "./operations";

function mockDb(opts: { currencyCode?: string; cashAmount?: string; bankCurrencyId?: number; bankAmount?: string } = {}) {
  const { currencyCode = "IDR", cashAmount = "100000000.000000", bankCurrencyId = 1, bankAmount = "50000000.000000" } = opts;
  const inserted: { values: any }[] = [];
  const updates: any[] = [];
  const fakeTx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn((fields: Record<string, unknown> = {}) => ({
      from: (table: any) => ({
        where: () => ({ limit: () => {
          const name = String(table?.[Symbol.for("drizzle:Name")] ?? "");
          if (name === "bank_accounts") return Promise.resolve([{ id: 9, currencyId: bankCurrencyId, availableAmount: bankAmount, active: true }]);
          if (name === "currencies") return Promise.resolve([{ id: 1, code: currencyCode, active: true }]);
          return Promise.resolve([{ id: 1, currencyId: 1, availableAmount: cashAmount }]);
        } }),
      }),
    })),
    update: vi.fn(() => ({ set: (values: any) => { updates.push(values); return { where: () => Promise.resolve(undefined) }; } })),
    insert: vi.fn(() => ({ values: (values: any) => { inserted.push({ values }); return { $returningId: () => Promise.resolve([{ id: inserted.length }]), onDuplicateKeyUpdate: () => Promise.resolve(undefined) }; } })),
  };
  const fakeDb = {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ code: currencyCode }]) }) }) })),
    insert: vi.fn(() => ({ values: () => Promise.resolve(undefined) })),
    transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(fakeTx)),
  };
  return { getDb: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), inserted, updates };
}

const controller = { id: 7, role: "CONTROLLER" as const };
const setor = {
  currencyId: 1, bankAccountId: 9, direction: "TO_BANK" as const, amount: "25000000",
  notes: "Setor kas berlebih ke rekening BCA",
  denominations: [{ value: "100000", quantity: 250 }],
};

describe("recordCashBankTransfer", () => {
  it("menggerakkan kedua sisi: mutasi kas BANK_DEPOSIT dan mutasi bank CASH_TRANSFER", async () => {
    const { getDb, inserted } = mockDb();
    await recordCashBankTransfer(setor, controller);
    expect(inserted.some((row) => row.values?.category === "BANK_DEPOSIT" && row.values?.direction === "OUT")).toBe(true);
    expect(inserted.some((row) => row.values?.category === "CASH_TRANSFER" && row.values?.direction === "IN")).toBe(true);
    getDb.mockRestore();
  });

  it("membalik kedua arah saat menarik dari bank ke kas", async () => {
    const { getDb, inserted } = mockDb();
    await recordCashBankTransfer({ ...setor, direction: "TO_CASH" }, controller);
    expect(inserted.some((row) => row.values?.category === "BANK_WITHDRAWAL" && row.values?.direction === "IN")).toBe(true);
    expect(inserted.some((row) => row.values?.category === "CASH_TRANSFER" && row.values?.direction === "OUT")).toBe(true);
    getDb.mockRestore();
  });

  it("menolak rekening yang mata uangnya berbeda dari kas", async () => {
    const { getDb } = mockDb({ bankCurrencyId: 2 });
    await expect(recordCashBankTransfer(setor, controller)).rejects.toThrow(/mata uang/i);
    getDb.mockRestore();
  });

  it("menolak setoran yang melebihi kas tersedia", async () => {
    const { getDb } = mockDb({ cashAmount: "1000000.000000" });
    await expect(recordCashBankTransfer(setor, controller)).rejects.toThrow(/melebihi saldo/i);
    getDb.mockRestore();
  });

  it("menolak penarikan yang melebihi saldo rekening", async () => {
    const { getDb } = mockDb({ bankAmount: "1000000.000000" });
    await expect(recordCashBankTransfer({ ...setor, direction: "TO_CASH" }, controller)).rejects.toThrow(/melebihi saldo rekening/i);
    getDb.mockRestore();
  });

  it("menolak tanpa rincian pecahan", async () => {
    const { getDb } = mockDb();
    await expect(recordCashBankTransfer({ ...setor, denominations: [] }, controller)).rejects.toThrow(/pecahan/i);
    getDb.mockRestore();
  });
});
