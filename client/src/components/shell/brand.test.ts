import { describe, expect, it } from "vitest";
import { PRODUCT_NAME, brandInitials, brandName } from "./brand";

describe("merek pada shell", () => {
  it("memakai nama dagang, lalu nama badan hukum, lalu nama produk", () => {
    expect(brandName({ tradingName: "Valas Sentosa", legalEntityName: "PT Valas Sentosa Abadi" })).toBe("Valas Sentosa");
    expect(brandName({ tradingName: "  ", legalEntityName: "PT Valas Sentosa Abadi" })).toBe("PT Valas Sentosa Abadi");
    expect(brandName(null)).toBe(PRODUCT_NAME);
  });

  it("inisial dua huruf, melewati kata badan hukum", () => {
    expect(brandInitials("PT Ibukota Valasindo")).toBe("IV");
    expect(brandInitials("Valas Sentosa Abadi")).toBe("VS");
    expect(brandInitials("Rupiah")).toBe("RU");
  });
});
