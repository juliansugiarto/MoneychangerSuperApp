import { describe, expect, it } from "vitest";
import { MISSING_ADDRESS, MISSING_NAME, printedCompany } from "./printedCompany";

describe("identitas perusahaan pada cetakan", () => {
  it("memakai Profil Perusahaan bila terisi", () => {
    expect(printedCompany({ legalEntityName: "PT ABC Valas", tradingName: "ABC Valas", address: "Jl. Uji 1", phone: "+62 21 555" }))
      .toEqual({ legalName: "PT ABC Valas", tradingName: "ABC Valas", address: "Jl. Uji 1", phone: "+62 21 555" });
  });

  it("profil kosong mencetak catatan 'belum diisi', tidak pernah identitas perusahaan lain", () => {
    expect(printedCompany(null)).toEqual({ legalName: MISSING_NAME, tradingName: MISSING_NAME, address: MISSING_ADDRESS, phone: null });
    expect(MISSING_NAME).toContain("lengkapi Profil Perusahaan");
  });

  it("nama badan hukum kosong jatuh ke nama dagang; telepon kosong dihilangkan, bukan diisi", () => {
    expect(printedCompany({ legalEntityName: " ", tradingName: "ABC Valas", address: null, phone: "  " }))
      .toEqual({ legalName: "ABC Valas", tradingName: "ABC Valas", address: MISSING_ADDRESS, phone: null });
  });
});
