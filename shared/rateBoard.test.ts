import { describe, expect, it } from "vitest";
import { cellChanged, cellKey, editedValue, filterBoardCells, pendingCells, type BoardEdits } from "./rateBoard";
import type { BoardCellPayload } from "./rateBoard";

const cell = (over: Partial<BoardCellPayload> = {}): BoardCellPayload => ({
  currencyId: 1, currencyCode: "USD", currencyName: "Dolar Amerika Serikat", rateTierId: null, tierLabel: "Pecahan lain", sortOrder: 9999,
  quoteUnit: "1.000000", activeRateId: 21, activeBuyRate: "16290.000000", activeSellRate: "16400.000000", activeEffectiveAt: new Date("2026-09-16T02:00:00Z"),
  draftRateId: null, draftBuyRate: null, draftSellRate: null,
  referenceBuyRate: "16200.000000", referenceSellRate: "16360.000000", referenceSnapshotId: 9, ...over,
});

describe("kunci sel", () => {
  it("membedakan kelompok dari kurs tingkat valuta", () => {
    expect(cellKey({ currencyId: 1, rateTierId: null })).toBe("1:ALL");
    expect(cellKey({ currencyId: 1, rateTierId: 5 })).toBe("1:5");
  });
});

describe("nilai sel", () => {
  it("menampilkan suntingan bila ada, lalu draf, lalu kurs aktif", () => {
    const aktif = cell();
    expect(editedValue(aktif, {}, "buyRate")).toBe("16290.000000");
    expect(editedValue(cell({ draftBuyRate: "16310.000000" }), {}, "buyRate")).toBe("16310.000000");
    expect(editedValue(aktif, { "1:ALL": { buyRate: "16350" } }, "buyRate")).toBe("16350");
  });

  it("sel tanpa kurs sama sekali kosong, bukan nol", () => {
    expect(editedValue(cell({ activeBuyRate: null, activeSellRate: null, activeRateId: null }), {}, "buyRate")).toBe("");
  });
});

describe("sel berubah", () => {
  it("berubah ketika suntingannya berbeda dari kurs aktif", () => {
    expect(cellChanged(cell(), { "1:ALL": { buyRate: "16350" } })).toBe(true);
    expect(cellChanged(cell(), { "1:ALL": { buyRate: "16290.000000" } })).toBe(false);
  });

  it("draf tersimpan yang berbeda dari kurs aktif juga dihitung berubah", () => {
    expect(cellChanged(cell({ draftRateId: 31, draftBuyRate: "16310.000000", draftSellRate: "16400.000000" }), {})).toBe(true);
  });
});

describe("penyaring papan", () => {
  const cells = [cell(), cell({ currencyId: 2, currencyCode: "SGD", currencyName: "Dolar Singapura", activeRateId: null, activeBuyRate: null, activeSellRate: null })];

  it("Semua menampilkan seluruh baris", () => {
    expect(filterBoardCells(cells, "SEMUA", "", {})).toHaveLength(2);
  });

  it("Berubah hanya menampilkan sel yang disunting atau berdraf", () => {
    expect(filterBoardCells(cells, "BERUBAH", "", { "1:ALL": { buyRate: "16350" } }).map((row) => row.currencyCode)).toEqual(["USD"]);
  });

  it("Tanpa kurs hanya menampilkan sel yang belum punya kurs aktif", () => {
    expect(filterBoardCells(cells, "TANPA_KURS", "", {}).map((row) => row.currencyCode)).toEqual(["SGD"]);
  });

  it("pencarian cocok pada kode maupun nama valuta, tanpa peduli huruf besar-kecil", () => {
    expect(filterBoardCells(cells, "SEMUA", "singapura", {}).map((row) => row.currencyCode)).toEqual(["SGD"]);
    expect(filterBoardCells(cells, "SEMUA", "usd", {}).map((row) => row.currencyCode)).toEqual(["USD"]);
  });
});

describe("sel siap diaktifkan", () => {
  it("hanya menghitung sel yang benar-benar berubah", () => {
    const edits: BoardEdits = { "1:ALL": { buyRate: "16350" } };
    expect(pendingCells([cell(), cell({ currencyId: 2, currencyCode: "SGD" })], edits)).toHaveLength(1);
  });
});
