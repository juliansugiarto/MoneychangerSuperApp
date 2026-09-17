import { describe, expect, it } from "vitest";
import { buildCopyDrafts, buildReferenceDrafts, planDraftReplacement, pricingCells, type BoardCellPayload, type BoardDraftInput } from "./rateBoard";

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

const cell = (over: Partial<BoardCellPayload> = {}): BoardCellPayload => ({
  currencyId: 1, currencyCode: "USD", currencyName: "Dolar Amerika Serikat", rateTierId: null, tierLabel: "Pecahan lain", sortOrder: 9999,
  quoteUnit: "1.000000", activeRateId: null, activeBuyRate: null, activeSellRate: null, activeEffectiveAt: null,
  draftRateId: null, draftBuyRate: null, draftSellRate: null,
  referenceBuyRate: null, referenceSellRate: null, referenceSnapshotId: null, ...over,
});

describe("salin kurs kemarin", () => {
  it("membuat draf dari kurs yang sedang aktif, per kelompok", () => {
    const drafts = buildCopyDrafts([
      cell({ rateTierId: 5, tierLabel: "100", activeRateId: 21, activeBuyRate: "16290.000000", activeSellRate: "16400.000000" }),
      cell({ rateTierId: 6, tierLabel: "5\u201320", activeRateId: 22, activeBuyRate: "16100.000000", activeSellRate: "16300.000000" }),
    ]);
    expect(drafts).toEqual([
      { currencyId: 1, rateTierId: 5, quoteUnit: "1.000000", buyRate: "16290.000000", sellRate: "16400.000000" },
      { currencyId: 1, rateTierId: 6, quoteUnit: "1.000000", buyRate: "16100.000000", sellRate: "16300.000000" },
    ]);
  });

  it("melewati sel yang belum punya kurs aktif alih-alih mengarang nol", () => {
    expect(buildCopyDrafts([cell()])).toEqual([]);
  });
});

describe("saran dari referensi BI", () => {
  it("membuat draf untuk setiap kelompok dari snapshot valutanya", () => {
    const drafts = buildReferenceDrafts([
      cell({ rateTierId: 5, tierLabel: "100", referenceBuyRate: "16200.000000", referenceSellRate: "16360.000000", referenceSnapshotId: 9 }),
      cell({ rateTierId: null, referenceBuyRate: "16200.000000", referenceSellRate: "16360.000000", referenceSnapshotId: 9 }),
    ]);
    expect(drafts.map((row) => row.rateTierId)).toEqual([5, null]);
    expect(drafts[0]).toEqual({ currencyId: 1, rateTierId: 5, quoteUnit: "1.000000", buyRate: "16200.000000", sellRate: "16360.000000", referenceSnapshotId: 9 });
  });

  it("melewati valuta yang belum punya snapshot BI", () => {
    expect(buildReferenceDrafts([cell()])).toEqual([]);
  });
});

describe("harga papan untuk kasir", () => {
  it("hanya membawa kurs yang berlaku, tanpa draf maupun referensi BI", () => {
    const rows = pricingCells([
      cell({ activeRateId: 21, activeBuyRate: "16290.000000", activeSellRate: "16400.000000", draftRateId: 31, draftBuyRate: "16500.000000", draftSellRate: "16600.000000", referenceBuyRate: "16200.000000", referenceSnapshotId: 9 }),
      cell({ currencyId: 2, currencyCode: "SGD", draftRateId: 32, draftBuyRate: "12000.000000", draftSellRate: "12100.000000" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ activeBuyRate: "16290.000000", draftRateId: null, draftBuyRate: null, draftSellRate: null, referenceBuyRate: null, referenceSnapshotId: null });
  });
});
