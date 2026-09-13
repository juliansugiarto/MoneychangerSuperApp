import { describe, expect, it } from "vitest";
import { DARK_TEXT, LIGHT_TEXT } from "@shared/accentColor";
import { paletteById } from "@shared/themePalettes";
import { applyTheme } from "./brandAccent";

describe("applyTheme", () => {
  it("menulis keenam variabel palet terpilih dan menandai wadahnya", () => {
    const element = document.createElement("div");
    const zamrud = paletteById("ZAMRUD");
    applyTheme(element, "ZAMRUD");
    expect(element.style.getPropertyValue("--paper")).toBe(zamrud.paper);
    expect(element.style.getPropertyValue("--ink")).toBe(zamrud.ink);
    expect(element.style.getPropertyValue("--brand")).toBe(zamrud.brand);
    expect(element.style.getPropertyValue("--brand-contrast")).toBe(zamrud.brandInk);
    expect(element.style.getPropertyValue("--second")).toBe(zamrud.second);
    expect(element.style.getPropertyValue("--second-contrast")).toBe(zamrud.secondInk);
    expect(element.getAttribute("data-tema")).toBe("ZAMRUD");
  });

  it("warna utama sendiri yang lolos kontras menggantikan warna utama palet", () => {
    const element = document.createElement("div");
    const result = applyTheme(element, "MARUN", "#0F766E");
    expect(element.style.getPropertyValue("--brand")).toBe("#0F766E");
    expect(element.style.getPropertyValue("--brand-contrast")).toBe(LIGHT_TEXT);
    expect(result.brand.usedFallback).toBe(false);
  });

  it("warna utama sendiri yang gagal kontras diganti warna utama palet terpilih, beserta alasannya", () => {
    const element = document.createElement("div");
    const result = applyTheme(element, "SAMUDRA", "#7A7A7A");
    expect(element.style.getPropertyValue("--brand")).toBe(paletteById("SAMUDRA").brand);
    expect(element.style.getPropertyValue("--brand-contrast")).toBe(paletteById("SAMUDRA").brandInk);
    expect(result.brand.reason).toBe("LOW_CONTRAST");
  });

  it("warna utama sendiri yang terang memakai teks gelap", () => {
    const element = document.createElement("div");
    applyTheme(element, null, "#FFD60A");
    expect(element.style.getPropertyValue("--brand-contrast")).toBe(DARK_TEXT);
  });
});
