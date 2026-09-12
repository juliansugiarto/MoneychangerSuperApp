import { describe, expect, it } from "vitest";
import { LIGHT_TEXT, PRODUCT_ACCENT } from "@shared/accentColor";
import { applyBrandAccent } from "./brandAccent";

describe("applyBrandAccent", () => {
  it("menulis aksen perusahaan yang lolos ke --brand dan --brand-contrast", () => {
    const element = document.createElement("div");
    const result = applyBrandAccent(element, "#0F766E");
    expect(element.style.getPropertyValue("--brand")).toBe("#0F766E");
    expect(element.style.getPropertyValue("--brand-contrast")).toBe(LIGHT_TEXT);
    expect(result.usedFallback).toBe(false);
  });

  it("aksen yang tidak lolos kontras diganti aksen produk", () => {
    const element = document.createElement("div");
    const result = applyBrandAccent(element, "#7A7A7A");
    expect(element.style.getPropertyValue("--brand")).toBe(PRODUCT_ACCENT);
    expect(result.reason).toBe("LOW_CONTRAST");
  });

  it("tanpa aksen: aksen produk, tanpa peringatan", () => {
    const element = document.createElement("div");
    expect(applyBrandAccent(element, null)).toMatchObject({ accent: PRODUCT_ACCENT, usedFallback: false });
  });
});
