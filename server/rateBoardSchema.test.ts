import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { exchangeTransactionDenominationEntries, exchangeTransactions, operationalRates, operationalSettings, rateTiers } from "../drizzle/schema";

describe("skema papan kurs", () => {
  it("kurs operasional membawa kelompok, alasan, dan id batch", () => {
    const columns = Object.keys(getTableColumns(operationalRates));
    expect(columns).toEqual(expect.arrayContaining(["rateTierId", "approvalReason", "activationBatchId"]));
  });

  it("kelompok pecahan menyimpan nilai mukanya sebagai larik", () => {
    const columns = Object.keys(getTableColumns(rateTiers));
    expect(columns).toEqual(expect.arrayContaining(["currencyId", "label", "denominationValues", "sortOrder", "active", "createdByUserId"]));
  });

  it("tiap baris pecahan bon membawa rujukan dan selisihnya sendiri", () => {
    const columns = Object.keys(getTableColumns(exchangeTransactionDenominationEntries));
    expect(columns).toEqual(expect.arrayContaining(["operationalRateId", "referenceRateSnapshot", "rateDeviationPercent"]));
  });

  it("alasan selisih ada di header bon dan toleransinya di pengaturan", () => {
    expect(Object.keys(getTableColumns(exchangeTransactions))).toContain("rateDeviationReason");
    expect(getTableColumns(operationalSettings).rateDeviationTolerancePercent.default).toBe("0.5000");
  });
});
