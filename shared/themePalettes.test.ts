import { describe, expect, it } from "vitest";
import { MIN_CONTRAST, PRODUCT_ACCENT, contrastRatio, normalizeHexColor } from "./accentColor";
import { DEFAULT_PALETTE_ID, THEME_PALETTES, paletteById } from "./themePalettes";

describe("palet tema Konter Tebal", () => {
  it("enam palet berurutan dengan Marun sebagai bawaan dan aksen produk", () => {
    expect(THEME_PALETTES.map((palette) => palette.id)).toEqual(["MARUN", "ZAMRUD", "SAMUDRA", "TERAKOTA", "ANGGUR", "ARANG"]);
    expect(DEFAULT_PALETTE_ID).toBe("MARUN");
    expect(paletteById(DEFAULT_PALETTE_ID).brand).toBe(PRODUCT_ACCENT);
  });

  it.each(THEME_PALETTES.map((palette) => [palette.id, palette] as const))("%s: heks sah dan setiap pasangan lolos AA", (_id, palette) => {
    for (const value of [palette.paper, palette.ink, palette.brand, palette.brandInk, palette.second, palette.secondInk]) {
      expect(normalizeHexColor(value)).toBe(value);
    }
    expect(contrastRatio(palette.ink, palette.paper)!).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(palette.brandInk, palette.brand)!).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(palette.secondInk, palette.second)!).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("id yang tidak dikenal atau kosong jatuh ke palet bawaan", () => {
    expect(paletteById("TIDAK-ADA").id).toBe("MARUN");
    expect(paletteById(null).id).toBe("MARUN");
  });
});
