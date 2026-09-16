import { describe, expect, it } from "vitest";
import { planDraftReplacement, type BoardDraftInput } from "./rateBoard";

const input = (currencyId: number, rateTierId: number | null, buyRate: string): BoardDraftInput =>
  ({ currencyId, rateTierId, quoteUnit: "1.000000", buyRate, sellRate: "16400.000000" });

describe("menyimpan draf papan", () => {
  it("mengganti draf lama pada pasangan valuta + kelompok yang sama", () => {
    const plan = planDraftReplacement([{ id: 31, currencyId: 1, rateTierId: 5 }], [input(1, 5, "16290")]);
    expect(plan.replaceRateIds).toEqual([31]);
    expect(plan.inserts).toHaveLength(1);
  });

  it("membiarkan draf kelompok lain pada valuta yang sama", () => {
    const plan = planDraftReplacement([{ id: 31, currencyId: 1, rateTierId: 5 }, { id: 32, currencyId: 1, rateTierId: 6 }], [input(1, 6, "16250")]);
    expect(plan.replaceRateIds).toEqual([32]);
  });

  it("membedakan kurs tingkat valuta dari kelompok mana pun", () => {
    const plan = planDraftReplacement([{ id: 31, currencyId: 1, rateTierId: null }], [input(1, 5, "16290")]);
    expect(plan.replaceRateIds).toEqual([]);
    expect(plan.inserts).toEqual([input(1, 5, "16290")]);
  });

  it("menolak kurs beli yang lebih tinggi daripada kurs jual", () => {
    expect(() => planDraftReplacement([], [{ currencyId: 1, rateTierId: null, quoteUnit: "1.000000", buyRate: "16500", sellRate: "16400" }]))
      .toThrow(/beli.*jual/i);
  });

  it("menolak kurs nol atau negatif", () => {
    expect(() => planDraftReplacement([], [{ currencyId: 1, rateTierId: null, quoteUnit: "1.000000", buyRate: "0", sellRate: "16400" }]))
      .toThrow(/lebih besar dari nol/i);
  });

  it("menolak dua sel untuk pasangan valuta + kelompok yang sama dalam satu penyimpanan", () => {
    expect(() => planDraftReplacement([], [input(1, 5, "16290"), input(1, 5, "16295")])).toThrow(/dua nilai/i);
  });
});
