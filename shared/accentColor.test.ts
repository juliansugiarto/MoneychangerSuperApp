import { describe, expect, it } from "vitest";
import {
  DARK_TEXT,
  LIGHT_TEXT,
  MIN_CONTRAST,
  PRODUCT_ACCENT,
  contrastRatio,
  normalizeHexColor,
  resolveAccent,
} from "./accentColor";

describe("normalizeHexColor", () => {
  it.each([
    ["#abc", "#AABBCC"],
    ["1d4ed8", "#1D4ED8"],
    [" #0F766E ", "#0F766E"],
  ])("%j → %j", (input, expected) => {
    expect(normalizeHexColor(input)).toBe(expected);
  });

  it.each(["", "merah", "#12345", "#GGGGGG", null, undefined])("menolak %j", (input) => {
    expect(normalizeHexColor(input)).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("putih lawan hitam adalah 21", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("warna yang tidak sah menghasilkan null", () => {
    expect(contrastRatio("biru", "#FFFFFF")).toBeNull();
  });
});

describe("resolveAccent", () => {
  it("aksen produk sendiri lolos AA dengan teks putih", () => {
    expect(contrastRatio(PRODUCT_ACCENT, LIGHT_TEXT)!).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("tanpa aksen perusahaan: memakai aksen produk tanpa peringatan", () => {
    expect(resolveAccent(null)).toMatchObject({ accent: PRODUCT_ACCENT, contrast: LIGHT_TEXT, usedFallback: false, reason: null });
  });

  it("aksen yang tidak sah: memakai aksen produk dan melaporkan INVALID", () => {
    expect(resolveAccent("merah")).toMatchObject({ accent: PRODUCT_ACCENT, usedFallback: true, reason: "INVALID" });
  });

  it("aksen gelap memakai teks putih", () => {
    expect(resolveAccent("#0F766E")).toMatchObject({ accent: "#0F766E", contrast: LIGHT_TEXT, usedFallback: false });
  });

  it("aksen terang memakai teks gelap", () => {
    expect(resolveAccent("#FFD60A")).toMatchObject({ accent: "#FFD60A", contrast: DARK_TEXT, usedFallback: false });
  });

  it("abu-abu tengah tidak lolos dengan teks mana pun → aksen produk, LOW_CONTRAST", () => {
    // #7A7A7A: kontras ±4,30 dengan putih dan ±4,15 dengan #111827.
    expect(resolveAccent("#7A7A7A")).toMatchObject({ accent: PRODUCT_ACCENT, usedFallback: true, reason: "LOW_CONTRAST" });
  });

  it("apa pun masukannya, pasangan yang dikembalikan selalu lolos AA", () => {
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const hex = `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
          expect(resolveAccent(hex).ratio).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      }
    }
  });
});
