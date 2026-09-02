import { describe, expect, it, vi } from "vitest";
import { companyProfile, currencies, customers, exchangeTransactionLines, exchangeTransactions } from "../drizzle/schema";
import * as db from "./db";
import { getGoAmlLtktExport } from "./operations";

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

function sellTransaction(overrides: Record<string, unknown> = {}) {
  return { id: 10, transactionNumber: "FX-20260901-000010", transactionAt: new Date("2026-09-01T09:00:00.000Z"), operation: "SELL" as const, status: "COMPLETED" as const, paymentMethod: "CASH" as const, rupiahAmount: "600000000.00", currencyId: null, foreignAmount: null, rateSnapshot: null, ...overrides };
}

describe("getGoAmlLtktExport", () => {
  it("throws a clear error when goamlRentityId is not configured", async () => {
    const getDb = mockDb(new Map([[companyProfile, [{ id: 1, goamlRentityId: null, goamlReportingUserCode: "x" }]]]));
    await expect(getGoAmlLtktExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), direction: "MASUK" })).rejects.toThrow(/rentity_id/);
    getDb.mockRestore();
  });

  it("throws a clear error when goamlReportingUserCode is not configured", async () => {
    const getDb = mockDb(new Map([[companyProfile, [{ id: 1, goamlRentityId: 1000031, goamlReportingUserCode: null }]]]));
    await expect(getGoAmlLtktExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), direction: "MASUK" })).rejects.toThrow(/user pelapor/);
    getDb.mockRestore();
  });

  it("builds one XML line per currency line of a modern multi-line bon, with a complete customer profile", async () => {
    const line1 = { transactionId: 10, lineNumber: 1, currencyId: 2, foreignAmount: "20000.000000", agreedRate: "15000.000000", rupiahAmount: "300000000.00" };
    const line2 = { transactionId: 10, lineNumber: 2, currencyId: 2, foreignAmount: "20000.000000", agreedRate: "15000.000000", rupiahAmount: "300000000.00" };
    const getDb = mockDb(new Map<unknown, unknown[]>([
      [companyProfile, [profile]],
      [exchangeTransactions, [{ transaction: sellTransaction(), customer: completeCustomer }]],
      [exchangeTransactionLines, [{ line: line1, currency: usd }, { line: line2, currency: usd }]],
    ]));
    const result = await getGoAmlLtktExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), direction: "MASUK" });
    getDb.mockRestore();
    expect(result.skipped).toEqual([]);
    expect(result.transactionCount).toBe(1);
    expect(result.lineCount).toBe(2);
    expect(result.xml).toContain("FX-20260901-000010-L1");
    expect(result.xml).toContain("FX-20260901-000010-L2");
    expect(result.xml).toContain("<report_code>LTKTM</report_code>");
    expect(result.fileName).toMatch(/^LTKTM_/);
  });

  it("falls back to the legacy single-currency header when no exchange_transaction_lines rows exist", async () => {
    const legacyTransaction = sellTransaction({ currencyId: 2, foreignAmount: "40000.000000", rateSnapshot: "15000.000000" });
    const getDb = mockDb(new Map<unknown, unknown[]>([
      [companyProfile, [profile]],
      [exchangeTransactions, [{ transaction: legacyTransaction, customer: completeCustomer }]],
      [exchangeTransactionLines, []],
      [currencies, [usd]],
    ]));
    const result = await getGoAmlLtktExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), direction: "MASUK" });
    getDb.mockRestore();
    expect(result.lineCount).toBe(1);
    expect(result.xml).toContain("FX-20260901-000010-L1");
    expect(result.xml).toContain("<foreign_amount>40000.000000</foreign_amount>");
  });

  it("skips a transaction whose customer profile is missing goAML-mandatory fields, with a specific reason, instead of guessing or crashing", async () => {
    const incompleteCustomer = { ...completeCustomer, gender: null, addressCity: null };
    const getDb = mockDb(new Map<unknown, unknown[]>([
      [companyProfile, [profile]],
      [exchangeTransactions, [{ transaction: sellTransaction(), customer: incompleteCustomer }]],
      [exchangeTransactionLines, [{ line: { transactionId: 10, lineNumber: 1, currencyId: 2, foreignAmount: "20000", agreedRate: "15000", rupiahAmount: "600000000.00" }, currency: usd }]],
    ]));
    const result = await getGoAmlLtktExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), direction: "MASUK" });
    getDb.mockRestore();
    expect(result.transactionCount).toBe(0);
    expect(result.lineCount).toBe(0);
    expect(result.xml).toBeNull();
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain("jenis kelamin");
    expect(result.skipped[0].reason).toContain("kota");
  });

  it("uses report_code LTKTK for the KELUAR direction (BUY bons — Rupiah paid out)", async () => {
    const buyTransaction = sellTransaction({ operation: "BUY" as const });
    const getDb = mockDb(new Map<unknown, unknown[]>([
      [companyProfile, [profile]],
      [exchangeTransactions, [{ transaction: buyTransaction, customer: completeCustomer }]],
      [exchangeTransactionLines, [{ line: { transactionId: 10, lineNumber: 1, currencyId: 2, foreignAmount: "20000", agreedRate: "15000", rupiahAmount: "600000000.00" }, currency: usd }]],
    ]));
    const result = await getGoAmlLtktExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), direction: "KELUAR" });
    getDb.mockRestore();
    expect(result.xml).toContain("<report_code>LTKTK</report_code>");
    expect(result.xml).toContain("<transmode_code>PBVAL</transmode_code>");
    expect(result.fileName).toMatch(/^LTKTK_/);
  });

  it("returns an empty result (no XML) when nothing qualifies in the period", async () => {
    const getDb = mockDb(new Map<unknown, unknown[]>([
      [companyProfile, [profile]],
      [exchangeTransactions, []],
    ]));
    const result = await getGoAmlLtktExport({ from: new Date("2026-09-01"), to: new Date("2026-09-02"), direction: "MASUK" });
    getDb.mockRestore();
    expect(result.xml).toBeNull();
    expect(result.transactionCount).toBe(0);
  });
});
