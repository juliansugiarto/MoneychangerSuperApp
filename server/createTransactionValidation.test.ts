import { describe, expect, it, vi } from "vitest";
import { bankAccounts, currencies, customers, exchangeTransactions, operationalRates, operationalSettings, rateReferenceSnapshots } from "../drizzle/schema";
import * as db from "./db";
import { createTransaction } from "./operations";

/** A thenable resolving to `rows` for any chain of select-builder calls. */
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

/** These two guard clauses both throw before createTransaction ever opens its db.transaction, so
 * only the top-level `db.select` chain needs mocking — keyed by table identity, same pattern as
 * bankTransferPosting.test.ts. */
function mockTopLevelDb(rowsByTable: Map<unknown, unknown[]>) {
  const fakeDb = { select: () => ({ from: (table: unknown) => chain(rowsByTable.get(table) ?? []) }) };
  return vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

const activeCustomer = { id: 1, isDemo: false, isHistorical: false, profileStatus: "ACTIVE", fullName: "Budi Santoso" };
const idrCurrency = { id: 1, code: "IDR", active: true };
const usdCurrency = { id: 2, code: "USD", active: true };
const activeBankAccount = { id: 5, currencyId: 1, active: true };

const baseLine = { currencyId: 2, denominations: [{ value: "100", quantity: 1, rate: "15000" }] };
const baseInput = {
  operation: "BUY" as const, customerId: 1, receiptNumber: "1", lines: [baseLine],
  paymentMethod: "BANK_TRANSFER" as const, bankAccountId: 5,
  counterpartyBankName: "BCA", counterpartyAccountNumber: "12345", counterpartyAccountHolderName: "Budi Santoso",
  transactionAt: new Date("2026-09-01T08:00:00.000Z"),
};

describe("createTransaction — Rupiah cannot be a transaction line", () => {
  it("rejects a line whose currency resolves to IDR", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [idrCurrency]],
      [operationalRates, []],
    ]));
    await expect(createTransaction({ ...baseInput, lines: [{ ...baseLine, currencyId: 1 }] }, 9)).rejects.toThrow(/Rupiah tidak dapat dipilih/);
    getDb.mockRestore();
  });

  it("accepts a genuine foreign currency line (control case — doesn't throw on the IDR guard)", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
    ]));
    // Fails later (no db.transaction mocked), but must NOT fail with the IDR message — proves the
    // guard correctly lets a real foreign currency through.
    await expect(createTransaction(baseInput, 9)).rejects.not.toThrow(/Rupiah tidak dapat dipilih/);
    getDb.mockRestore();
  });
});

describe("createTransaction — bank transfer counterparty name mismatch", () => {
  it("rejects a mismatched counterparty account holder name with no reason given", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
    ]));
    await expect(createTransaction({ ...baseInput, counterpartyAccountHolderName: "Someone Else" }, 9)).rejects.toThrow(/berbeda dengan nama nasabah/);
    getDb.mockRestore();
  });

  it("rejects a mismatch reason shorter than 5 characters", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
    ]));
    await expect(createTransaction({ ...baseInput, counterpartyAccountHolderName: "Someone Else", counterpartyNameMismatchReason: "abc" }, 9)).rejects.toThrow(/berbeda dengan nama nasabah/);
    getDb.mockRestore();
  });

  it("requires the counterparty bank name, account number, and holder name together for a bank transfer", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
    ]));
    await expect(createTransaction({ ...baseInput, counterpartyBankName: "" }, 9)).rejects.toThrow(/wajib diisi untuk transfer bank/);
    getDb.mockRestore();
  });

  it("does not throw the mismatch error when the account holder name matches the customer exactly (case-insensitive)", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
    ]));
    await expect(createTransaction({ ...baseInput, counterpartyAccountHolderName: "budi santoso" }, 9)).rejects.not.toThrow(/berbeda dengan nama nasabah/);
    getDb.mockRestore();
  });
});

describe("createTransaction — TKM (transaksi mencurigakan) indicators", () => {
  it("rejects isSuspiciousTransaction with no indicators selected", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
      [operationalSettings, [{ settingCode: "REVIEW_THRESHOLD", reviewThresholdUsd: "10000.00", eddCashDailyThresholdIdr: "100000000.00" }]],
    ]));
    await expect(createTransaction({ ...baseInput, isSuspiciousTransaction: true, suspiciousIndicators: [] }, 9)).rejects.toThrow(/Pilih minimal satu indikator TKM/);
    getDb.mockRestore();
  });

  it("rejects an indicator code that isn't in the curated list", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
      [operationalSettings, [{ settingCode: "REVIEW_THRESHOLD", reviewThresholdUsd: "10000.00", eddCashDailyThresholdIdr: "100000000.00" }]],
    ]));
    await expect(createTransaction({ ...baseInput, isSuspiciousTransaction: true, suspiciousIndicators: ["NOT_A_REAL_CODE"] }, 9)).rejects.toThrow(/tidak dikenal/);
    getDb.mockRestore();
  });

  it("does not throw a TKM validation error for a genuine curated indicator", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
      [operationalSettings, [{ settingCode: "REVIEW_THRESHOLD", reviewThresholdUsd: "10000.00", eddCashDailyThresholdIdr: "100000000.00" }]],
    ]));
    await expect(createTransaction({ ...baseInput, isSuspiciousTransaction: true, suspiciousIndicators: ["MENOLAK_IDENTIFIKASI"] }, 9)).rejects.not.toThrow(/indikator TKM|tidak dikenal/);
    getDb.mockRestore();
  });
});

describe("createTransaction — underlying threshold reason", () => {
  const usdReferenceRate = { sellRate: "17000.000000", buyRate: "17000.000000", quoteUnit: "1.000000" };
  const reviewSettings = { settingCode: "REVIEW_THRESHOLD", reviewThresholdUsd: "10000.00", eddCashDailyThresholdIdr: "100000000.00" };
  // 100 is a genuine USD note (curated denomination) — 2000 of them is a real, valid-looking 200,000 USD deal, comfortably above the 10,000 USD threshold at any plausible rate.
  const largeLine = { currencyId: 2, denominations: [{ value: "100", quantity: 2000, rate: "17000" }] };

  it("requires a threshold reason once the deal's USD equivalent (via the BI reference rate) meets the threshold", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
      [rateReferenceSnapshots, [{ rate: usdReferenceRate }]],
      [operationalSettings, [reviewSettings]],
    ]));
    await expect(createTransaction({ ...baseInput, lines: [largeLine] }, 9)).rejects.toThrow(/ambang setara USD 10.000/);
    getDb.mockRestore();
  });

  it("does not throw the threshold-reason error once a reason is provided", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
      [rateReferenceSnapshots, [{ rate: usdReferenceRate }]],
      [operationalSettings, [reviewSettings]],
    ]));
    await expect(createTransaction({ ...baseInput, lines: [largeLine], thresholdReason: "Pembelian properti sesuai akta jual beli terlampir" }, 9)).rejects.not.toThrow(/ambang setara USD 10.000/);
    getDb.mockRestore();
  });

  it("does not require a threshold reason for a small deal well under the threshold", async () => {
    const getDb = mockTopLevelDb(new Map<unknown, unknown[]>([
      [customers, [activeCustomer]],
      [exchangeTransactions, []],
      [currencies, [usdCurrency]],
      [operationalRates, []],
      [bankAccounts, [activeBankAccount]],
      [rateReferenceSnapshots, [{ rate: usdReferenceRate }]],
      [operationalSettings, [reviewSettings]],
    ]));
    await expect(createTransaction(baseInput, 9)).rejects.not.toThrow(/ambang setara USD 10.000/);
    getDb.mockRestore();
  });
});
