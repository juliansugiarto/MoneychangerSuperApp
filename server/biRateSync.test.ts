import { describe, expect, it } from "vitest";
import { parseBiTransactionRates, parseJisdorRate } from "./biRateSync";

const sampleBiTable = `
  Last Update 13 August 2026
  |Currencies |Value |Sell |Buy |
  |AED |1 |4,891.47 |4,842.53 |
  |JPY |100 |11,272.75 |11,159.88 |
  |USD |1 |17,965.38 |17,786.62 |
`;

describe("parseBiTransactionRates", () => {
  it("extracts the BI reference date and buy/sell rates without floating-point conversion", () => {
    const result = parseBiTransactionRates(sampleBiTable);
    const usd = result.rates.find((rate) => rate.code === "USD");

    expect(result.referenceDate.toISOString().slice(0, 10)).toBe("2026-08-13");
    expect(usd).toEqual({ code: "USD", quoteUnit: "1", sellRate: "17965.38", buyRate: "17786.62" });
  });

  it("retains the original BI quote unit for JPY", () => {
    const result = parseBiTransactionRates(sampleBiTable);
    const jpy = result.rates.find((rate) => rate.code === "JPY");

    expect(jpy?.quoteUnit).toBe("100");
    expect(jpy?.sellRate).toBe("11272.75");
  });

  it("rejects a source that does not disclose its last-update date", () => {
    expect(() => parseBiTransactionRates("|USD |1 |17,965.38 |17,786.62 |"))
      .toThrow("Tanggal pembaruan tidak ditemukan");
  });
});

describe("parseJisdorRate", () => {
  it("extracts the newest JISDOR date and USD/IDR value without floating-point conversion", () => {
    const result = parseJisdorRate("Rates JISDOR Information\nPeriod\nFrom\nTo\n|Date |Rates |\n|24 August 2026 |\nRp17,703.00 |");

    expect(result.referenceDate.toISOString().slice(0, 10)).toBe("2026-08-24");
    expect(result.rate).toBe("17703.00");
  });

  it("rejects a JISDOR source without a visible newest row", () => {
    expect(() => parseJisdorRate("JISDOR data unavailable"))
      .toThrow("Nilai JISDOR terbaru tidak ditemukan");
  });
});
