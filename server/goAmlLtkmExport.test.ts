import { describe, expect, it, vi } from "vitest";
import { companyProfile, currencies, customers, exchangeTransactionLines, exchangeTransactions } from "../drizzle/schema";
import * as db from "./db";
import { getGoAmlLtkmExport } from "./operations";

/** A thenable resolving to `rows` for any chain of select-builder calls — same pattern used throughout this codebase's DB-touching tests. */
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

function mockDb(rowsByTable: Map<unknown, unknown[]>) {
  return vi.spyOn(db, "getDb").mockResolvedValue({ select: () => ({ from: (table: unknown) => chain(rowsByTable.get(table) ?? []) }) } as never);
}

const profile = { id: 1, goamlRentityId: 1000031, goamlReportingUserCode: "sipendar_pelapor" };
const usd = { id: 2, code: "USD" };

const completeCustomer = {
  id: 1, fullName: "Budi Santoso", dateOfBirth: "1990-05-20", placeOfBirth: "Jakarta", gender: "MALE" as const, nationality: "ID",
  address: "Jl. A", addressType: "RUMAH" as const, addressCountry: "ID", addressProvince: null, addressCity: "Jakarta", addressDistrict: null, addressPostalCode: null,
  phoneNumber: "081234567890", occupation: "Karyawan", sourceOfFunds: "Gaji", npwp: null, identityType: "KTP" as const, identityNumber: "3174000000000001", identityExpiryDate: null,
};

function suspiciousTransaction(overrides: Record<string, unknown> = {}) {
  return { id: 20, transactionNumber: "FX-20260901-000020", transactionAt: new Date("2026-09-01T09:00:00.000Z"), operation: "BUY" as const, status: "COMPLETED" as const, paymentMethod: "CASH" as const, isSuspiciousTransaction: true, rupiahAmount: "80000000.00", currencyId: null, foreignAmount: null, rateSnapshot: null, ...overrides };
}

describe("getGoAmlLtkmExport", () => {
  it("throws when no indicator codes are supplied", async () => {
    await expect(getGoAmlLtkmExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), indicatorCodes: [] })).rejects.toThrow(/indikator/);
  });

  it("throws when an indicator code isn't in the goAML report_indicator_type codebook", async () => {
    await expect(getGoAmlLtkmExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), indicatorCodes: ["MADE-UP-CODE"] })).rejects.toThrow(/tidak dikenal/);
  });

  it("throws a clear error when goamlRentityId is not configured", async () => {
    const getDb = mockDb(new Map([[companyProfile, [{ id: 1, goamlRentityId: null, goamlReportingUserCode: "x" }]]]));
    await expect(getGoAmlLtkmExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), indicatorCodes: ["POLA-001"] })).rejects.toThrow(/rentity_id/);
    getDb.mockRestore();
  });

  it("throws a clear error when goamlReportingUserCode is not configured", async () => {
    const getDb = mockDb(new Map([[companyProfile, [{ id: 1, goamlRentityId: 1000031, goamlReportingUserCode: null }]]]));
    await expect(getGoAmlLtkmExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), indicatorCodes: ["POLA-001"] })).rejects.toThrow(/user pelapor/);
    getDb.mockRestore();
  });

  it("builds an XML report for a suspicious CASH/COMPLETED bon with a complete customer profile, embedding the caller's chosen indicators", async () => {
    const line1 = { transactionId: 20, lineNumber: 1, currencyId: 2, foreignAmount: "5000.000000", agreedRate: "16000.000000", rupiahAmount: "80000000.00" };
    const getDb = mockDb(new Map<unknown, unknown[]>([
      [companyProfile, [profile]],
      [exchangeTransactions, [{ transaction: suspiciousTransaction(), customer: completeCustomer }]],
      [exchangeTransactionLines, [{ line: line1, currency: usd }]],
    ]));
    const result = await getGoAmlLtkmExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), indicatorCodes: ["POLA-001", "TUNDA-002"], reason: "Pola transaksi terpecah." });
    getDb.mockRestore();
    expect(result.skipped).toEqual([]);
    expect(result.transactionCount).toBe(1);
    expect(result.lineCount).toBe(1);
    expect(result.xml).toContain("FX-20260901-000020-L1");
    expect(result.xml).toContain("<report_code>LTKM</report_code>");
    expect(result.xml).toContain("<reason>Pola transaksi terpecah.</reason>");
    expect(result.xml).toContain("<report_indicators><indicator>POLA-001</indicator><indicator>TUNDA-002</indicator></report_indicators>");
    expect(result.fileName).toMatch(/^LTKM_/);
  });

  it("includes both BUY and SELL suspicious bons — LTKM is not direction-scoped like LTKT", async () => {
    const sellTransaction = suspiciousTransaction({ id: 21, transactionNumber: "FX-20260901-000021", operation: "SELL" as const });
    const getDb = mockDb(new Map<unknown, unknown[]>([
      [companyProfile, [profile]],
      [exchangeTransactions, [
        { transaction: suspiciousTransaction(), customer: completeCustomer },
        { transaction: sellTransaction, customer: completeCustomer },
      ]],
      [exchangeTransactionLines, [
        { line: { transactionId: 20, lineNumber: 1, currencyId: 2, foreignAmount: "5000", agreedRate: "16000", rupiahAmount: "80000000.00" }, currency: usd },
        { line: { transactionId: 21, lineNumber: 1, currencyId: 2, foreignAmount: "5000", agreedRate: "16000", rupiahAmount: "80000000.00" }, currency: usd },
      ]],
    ]));
    const result = await getGoAmlLtkmExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), indicatorCodes: ["POLA-001"] });
    getDb.mockRestore();
    expect(result.transactionCount).toBe(2);
    expect(result.lineCount).toBe(2);
  });

  it("falls back to the legacy single-currency header when no exchange_transaction_lines rows exist", async () => {
    const legacyTransaction = suspiciousTransaction({ currencyId: 2, foreignAmount: "5000.000000", rateSnapshot: "16000.000000" });
    const getDb = mockDb(new Map<unknown, unknown[]>([
      [companyProfile, [profile]],
      [exchangeTransactions, [{ transaction: legacyTransaction, customer: completeCustomer }]],
      [exchangeTransactionLines, []],
      [currencies, [usd]],
    ]));
    const result = await getGoAmlLtkmExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), indicatorCodes: ["POLA-001"] });
    getDb.mockRestore();
    expect(result.lineCount).toBe(1);
    expect(result.xml).toContain("FX-20260901-000020-L1");
    expect(result.xml).toContain("<foreign_amount>5000.000000</foreign_amount>");
  });

  it("skips a transaction whose customer profile is missing goAML-mandatory fields, with a specific reason, instead of guessing or crashing", async () => {
    const incompleteCustomer = { ...completeCustomer, gender: null, addressCity: null };
    const getDb = mockDb(new Map<unknown, unknown[]>([
      [companyProfile, [profile]],
      [exchangeTransactions, [{ transaction: suspiciousTransaction(), customer: incompleteCustomer }]],
      [exchangeTransactionLines, [{ line: { transactionId: 20, lineNumber: 1, currencyId: 2, foreignAmount: "5000", agreedRate: "16000", rupiahAmount: "80000000.00" }, currency: usd }]],
    ]));
    const result = await getGoAmlLtkmExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), indicatorCodes: ["POLA-001"] });
    getDb.mockRestore();
    expect(result.transactionCount).toBe(0);
    expect(result.lineCount).toBe(0);
    expect(result.xml).toBeNull();
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain("jenis kelamin");
    expect(result.skipped[0].reason).toContain("kota");
  });

  it("returns an empty result (no XML) when nothing qualifies in the period", async () => {
    const getDb = mockDb(new Map<unknown, unknown[]>([
      [companyProfile, [profile]],
      [exchangeTransactions, []],
    ]));
    const result = await getGoAmlLtkmExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), indicatorCodes: ["POLA-001"] });
    getDb.mockRestore();
    expect(result.xml).toBeNull();
    expect(result.transactionCount).toBe(0);
  });
});
