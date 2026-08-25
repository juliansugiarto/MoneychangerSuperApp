import { describe, expect, it } from "vitest";
import { latestPublicRateEffectiveAt, sortPublicRates, type PublicRateRow } from "../shared/publicRates";

const rates: PublicRateRow[] = [
  { currency: { id: 2, code: "USD", name: "Dolar Amerika Serikat" }, rate: { id: 2, buyRate: "16000", sellRate: "16100", quoteUnit: "1", effectiveAt: new Date("2026-08-19T03:00:00.000Z") } },
  { currency: { id: 1, code: "AUD", name: "Dolar Australia" }, rate: { id: 1, buyRate: "10200", sellRate: "10300", quoteUnit: "1", effectiveAt: new Date("2026-08-19T02:00:00.000Z") } },
  { currency: { id: 3, code: "JPY", name: "Yen Jepang" }, rate: { id: 3, buyRate: "105", sellRate: "108", quoteUnit: "100", effectiveAt: new Date("2026-08-19T04:00:00.000Z") } },
];

describe("public rate transparency", () => {
  it("keeps every active row and orders the board by currency code", () => {
    const ordered = sortPublicRates(rates);

    expect(ordered).toHaveLength(3);
    expect(ordered.map((item) => item.currency.code)).toEqual(["AUD", "JPY", "USD"]);
    expect(rates.map((item) => item.currency.code)).toEqual(["USD", "AUD", "JPY"]);
  });

  it("uses the newest effective timestamp for the public update label", () => {
    expect(latestPublicRateEffectiveAt(rates)?.toISOString()).toBe("2026-08-19T04:00:00.000Z");
    expect(latestPublicRateEffectiveAt([])).toBeNull();
  });
});
