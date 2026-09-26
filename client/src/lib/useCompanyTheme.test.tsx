import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCompanyTheme } from "./useCompanyTheme";

describe("useCompanyTheme", () => {
  it("memasang palet pilihan perusahaan ke dokumen", () => {
    renderHook(() => useCompanyTheme({ themePalette: "ZAMRUD", accentColor: null }));
    expect(document.documentElement.style.getPropertyValue("--brand")).toBe("#0F5A41");
    expect(document.documentElement.getAttribute("data-tema")).toBe("ZAMRUD");
  });
});
