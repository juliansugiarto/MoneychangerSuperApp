import { describe, expect, it } from "vitest";
import { latestPublicRateEffectiveAt, sortPublicRates, type PublicRateRow } from "../shared/publicRates";

const rates: PublicRateRow[] = [
  { currency: { id: 2, code: "USD", name: "Dolar Amerika Serikat" }, tier: null, rate: { id: 2, buyRate: "16000", sellRate: "16100", quoteUnit: "1", effectiveAt: new Date("2026-08-19T03:00:00.000Z") } },
  { currency: { id: 1, code: "AUD", name: "Dolar Australia" }, tier: null, rate: { id: 1, buyRate: "10200", sellRate: "10300", quoteUnit: "1", effectiveAt: new Date("2026-08-19T02:00:00.000Z") } },
  { currency: { id: 3, code: "JPY", name: "Yen Jepang" }, tier: null, rate: { id: 3, buyRate: "105", sellRate: "108", quoteUnit: "100", effectiveAt: new Date("2026-08-19T04:00:00.000Z") } },
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

  it("menampilkan kelompok pecahan di bawah valutanya, berurutan", () => {
    const withTiers: PublicRateRow[] = [
      { currency: { id: 2, code: "USD", name: "Dolar Amerika Serikat" }, tier: null, rate: { id: 5, buyRate: "16000", sellRate: "16100", quoteUnit: "1", effectiveAt: new Date("2026-09-16T02:00:00.000Z") } },
      { currency: { id: 2, code: "USD", name: "Dolar Amerika Serikat" }, tier: { id: 1, label: "100" }, rate: { id: 6, buyRate: "16290", sellRate: "16400", quoteUnit: "1", effectiveAt: new Date("2026-09-16T02:00:00.000Z") } },
      { currency: { id: 1, code: "AUD", name: "Dolar Australia" }, tier: null, rate: { id: 7, buyRate: "10200", sellRate: "10300", quoteUnit: "1", effectiveAt: new Date("2026-09-16T02:00:00.000Z") } },
    ];
    expect(sortPublicRates(withTiers).map((row) => `${row.currency.code} ${row.tier?.label ?? "-"}`)).toEqual(["AUD -", "USD 100", "USD -"]);
  });
});
