import { describe, expect, it } from "vitest";
import { planBoardActivation, type ActivationDraft } from "./rateBoard";

const draft = (id: number, currencyId: number, rateTierId: number | null, over: Partial<ActivationDraft> = {}): ActivationDraft => ({
  id, currencyId, currencyCode: currencyId === 1 ? "USD" : "SGD", rateTierId, tierLabel: rateTierId ? String(rateTierId) : "Pecahan lain",
  status: "DRAFT", isDemo: false, isHistorical: false, ...over,
});

const ALASAN = "Kurs pagi 16 September, mengikuti pergerakan referensi BI.";

describe("rencana aktivasi papan", () => {
  it("mengaktifkan seluruh draf dan me-RETIRE tepat pasangan valuta + kelompok yang sama", () => {
    const plan = planBoardActivation([draft(11, 1, 5), draft(12, 1, 6), draft(13, 2, null)], ALASAN, "batch-pagi");
    expect(plan.activateRateIds).toEqual([11, 12, 13]);
    expect(plan.retireKeys).toEqual([
      { currencyId: 1, rateTierId: 5 },
      { currencyId: 1, rateTierId: 6 },
      { currencyId: 2, rateTierId: null },
    ]);
    expect(plan.batchId).toBe("batch-pagi");
  });

  it("tidak menyentuh kurs tingkat valuta ketika hanya kelompok yang diubah", () => {
    const plan = planBoardActivation([draft(11, 1, 5)], ALASAN, "batch-siang");
    expect(plan.retireKeys).toEqual([{ currencyId: 1, rateTierId: 5 }]);
  });

  it("menolak alasan yang lebih pendek dari sepuluh karakter", () => {
    expect(() => planBoardActivation([draft(11, 1, null)], "naik", "b")).toThrow(/10 karakter/);
  });

  it("menolak seluruh batch ketika satu draf tidak berstatus DRAFT, dan menyebut valuta serta kelompoknya", () => {
    expect(() => planBoardActivation([draft(11, 1, 5), draft(12, 1, 6, { status: "RETIRED", tierLabel: "50" }), draft(13, 2, null)], ALASAN, "b"))
      .toThrow(/USD.*50/);
  });

  it("menolak draf demo atau historis", () => {
    expect(() => planBoardActivation([draft(11, 1, null, { isDemo: true })], ALASAN, "b")).toThrow(/demo atau historis/i);
    expect(() => planBoardActivation([draft(11, 1, null, { isHistorical: true })], ALASAN, "b")).toThrow(/demo atau historis/i);
  });

  it("menolak dua draf untuk pasangan valuta + kelompok yang sama dalam satu batch", () => {
    expect(() => planBoardActivation([draft(11, 1, 5), draft(12, 1, 5)], ALASAN, "b")).toThrow(/dua draf/i);
  });

  it("menolak batch kosong", () => {
    expect(() => planBoardActivation([], ALASAN, "b")).toThrow(/setidaknya satu/i);
  });
});
