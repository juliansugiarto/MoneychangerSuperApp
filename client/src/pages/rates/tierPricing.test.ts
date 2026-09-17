import { describe, expect, it } from "vitest";
import { suggestDenominationRate } from "./tierPricing";
import type { BoardCellPayload } from "@shared/rateBoard";
import type { RateTierRow } from "@shared/rateTiers";

const TIERS: RateTierRow[] = [{ id: 5, currencyId: 1, label: "100", denominationValues: ["100"], sortOrder: 1, active: true }];
const cell = (rateTierId: number | null, buy: string, sell: string): BoardCellPayload => ({
  currencyId: 1, currencyCode: "USD", currencyName: "Dolar Amerika Serikat", rateTierId, tierLabel: rateTierId ? "100" : "Pecahan lain", sortOrder: 1,
  quoteUnit: "1.000000", activeRateId: rateTierId ?? 99, activeBuyRate: buy, activeSellRate: sell, activeEffectiveAt: new Date(),
  draftRateId: null, draftBuyRate: null, draftSellRate: null, referenceBuyRate: null, referenceSellRate: null, referenceSnapshotId: null,
});
const CELLS = [cell(5, "16290.000000", "16400.000000"), cell(null, "16000.000000", "16200.000000")];

describe("harga pecahan dari papan", () => {
  it("BELI memakai kurs beli kelompok yang memuat pecahannya", () => {
    expect(suggestDenominationRate({ cells: CELLS }, TIERS, 1, "BUY", "100")).toBe("16290.000000");
  });

  it("JUAL memakai kurs jual kelompok itu", () => {
    expect(suggestDenominationRate({ cells: CELLS }, TIERS, 1, "SELL", "100")).toBe("16400.000000");
  });

  it("pecahan tanpa kelompok jatuh ke kurs tingkat valuta", () => {
    expect(suggestDenominationRate({ cells: CELLS }, TIERS, 1, "BUY", "10")).toBe("16000.000000");
  });

  it("valuta tanpa kurs aktif tidak diisi sama sekali", () => {
    expect(suggestDenominationRate({ cells: [] }, TIERS, 1, "BUY", "100")).toBeNull();
  });

  it("menyesuaikan kurs papan per 100 unit ke satuan harga baris bon", () => {
    const jpy = { ...cell(null, "11225.580000", "11340.000000"), currencyId: 3, currencyCode: "JPY", quoteUnit: "100.000000" };
    expect(suggestDenominationRate({ cells: [jpy] }, [], 3, "BUY", "1000", "1")).toBe("112.255800");
  });
});
