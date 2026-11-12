// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicRateRow } from "@shared/publicRates";
import { operationalUtcOffset } from "@shared/regulatoryActionQueue";
import { useCalculation } from "./useCalculation";
import { toRateViews, type Dir } from "./viewModel";

const jpy = (buy: string, sell: string, quoteUnit: string): PublicRateRow[] => [
  { currency: { id: 4, code: "JPY", name: "Yen Jepang" }, tier: null, previous: null, rate: { id: Number(quoteUnit), buyRate: buy, sellRate: sell, quoteUnit, effectiveAt: new Date("2026-11-12T02:00:00Z") } },
];

describe("kalkulator membekukan kurs", () => {
  it("kurs dan satuan kutipan dibekukan bersama; perubahan satuan menyalakan 'kurs berubah'", () => {
    const { result, rerender } = renderHook(({ views, dir }) => useCalculation(views, dir), { initialProps: { views: toRateViews(jpy("105", "108", "1")), dir: "jual" as Dir } });
    act(() => result.current.changeAmount("1000"));
    expect(result.current.result?.total).toBe(105000);
    // Staf mengutip ulang JPY per 100: estimasi lama tetap 1000 × 105 / 1, bukan ÷ 100.
    rerender({ views: toRateViews(jpy("10500", "10800", "100")), dir: "jual" });
    expect(result.current.result?.total).toBe(105000);
    expect(result.current.rateChanged).toBe(true);
    act(() => result.current.recalculate());
    expect(result.current.result?.total).toBe(105000);
    expect(result.current.rateChanged).toBe(false);
  });

  it("selisih zona untuk waktu datang mengikuti zona operasional", () => {
    expect(operationalUtcOffset("Asia/Jakarta")).toBe("+07:00");
    expect(operationalUtcOffset("Asia/Makassar")).toBe("+08:00");
    expect(operationalUtcOffset("Asia/Jayapura")).toBe("+09:00");
  });
});
