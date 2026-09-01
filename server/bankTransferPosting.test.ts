import { describe, expect, it, vi } from "vitest";
import {
  bankAccounts,
  cashBalances,
  exchangeTransactionDenominationEntries,
  exchangeTransactionLines,
  exchangeTransactionPaymentDenominations,
  exchangeTransactions,
  stockOpnames,
} from "../drizzle/schema";
import * as db from "./db";
import { completeTransaction } from "./operations";

/** A thenable that resolves to `rows` regardless of which chain methods get called on it — good
 * enough for read-only query mocking since every call site here already knows exactly which rows
 * it expects back (we control that by table identity, see makeFakeTx below). */
function chain(rows: unknown[]): any {
  const self = {
    from: () => self,
    where: () => self,
    orderBy: () => self,
    limit: () => self,
    innerJoin: () => self,
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
  return self;
}

/** Builds a fake `tx` for completeTransaction, keyed by table identity (not call order or field
 * shape) — every `.from(table)` returns the row set registered for that exact table object, so the
 * mock doesn't care how many times a table is queried or in what sequence. */
function makeFakeTx(rowsByTable: Map<unknown, unknown[]>) {
  return {
    select: () => ({ from: (table: unknown) => chain(rowsByTable.get(table) ?? []) }),
    insert: () => ({ values: () => ({ $returningId: () => Promise.resolve([{ id: 999 }]), onDuplicateKeyUpdate: () => Promise.resolve(undefined) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
    execute: () => Promise.resolve(undefined),
  };
}

function mockCompleteTransactionDb(input: {
  transaction: Record<string, unknown>;
  line: Record<string, unknown>;
  cashBalance: Record<string, unknown>;
  bankAccount?: Record<string, unknown>;
}) {
  const rowsByTable = new Map<unknown, unknown[]>([
    [exchangeTransactions, [input.transaction]],
    [exchangeTransactionLines, [input.line]],
    [exchangeTransactionDenominationEntries, []],
    [cashBalances, [input.cashBalance]],
    [stockOpnames, []],
    [exchangeTransactionPaymentDenominations, []],
    [bankAccounts, input.bankAccount ? [input.bankAccount] : []],
  ]);
  const fakeTx = makeFakeTx(rowsByTable);
  const fakeDb = { transaction: (callback: (tx: unknown) => unknown) => callback(fakeTx) };
  return vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

const baseTransaction = {
  id: 1, transactionNumber: "FX-TEST-1", status: "APPROVED", isDemo: false, isHistorical: false,
  tellerUserId: 7, paymentMethod: "BANK_TRANSFER", rupiahAmount: "5000000.00", currencyId: null, foreignAmount: null,
};
const baseLine = { id: 10, transactionId: 1, lineNumber: 1, currencyId: 2, foreignAmount: "300.000000" };

describe("completeTransaction — bank transfer leg", () => {
  it("BUY: pays the customer out, so the company bank account balance decreases by the Rupiah amount", async () => {
    const getDb = mockCompleteTransactionDb({
      transaction: { ...baseTransaction, operation: "BUY", bankAccountId: 5 },
      line: baseLine,
      cashBalance: { id: 1, currencyId: 2, availableAmount: "0.000000" },
      bankAccount: { id: 5, availableAmount: "10000000.000000" },
    });
    const result = await completeTransaction(1, { id: 7, role: "STAFF" });
    expect(result.bankResult).toEqual({ bankAccountId: 5, before: "10000000.000000", after: "5000000.000000" });
    getDb.mockRestore();
  });

  it("SELL: takes payment in, so the company bank account balance increases by the Rupiah amount", async () => {
    const getDb = mockCompleteTransactionDb({
      transaction: { ...baseTransaction, operation: "SELL", bankAccountId: 5 },
      line: baseLine,
      cashBalance: { id: 1, currencyId: 2, availableAmount: "1000.000000" },
      bankAccount: { id: 5, availableAmount: "10000000.000000" },
    });
    const result = await completeTransaction(1, { id: 7, role: "STAFF" });
    expect(result.bankResult).toEqual({ bankAccountId: 5, before: "10000000.000000", after: "15000000.000000" });
    getDb.mockRestore();
  });

  it("never touches bank balances when paymentMethod is CASH", async () => {
    const getDb = mockCompleteTransactionDb({
      transaction: { ...baseTransaction, operation: "BUY", paymentMethod: "CASH", bankAccountId: null },
      line: baseLine,
      cashBalance: { id: 1, currencyId: 2, availableAmount: "0.000000" },
    });
    const result = await completeTransaction(1, { id: 7, role: "STAFF" });
    expect(result.bankResult).toBeNull();
    getDb.mockRestore();
  });
});
