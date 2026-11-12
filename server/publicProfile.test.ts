import { describe, expect, it } from "vitest";
import type { CompanyProfile } from "../drizzle/schema";
import { PUBLIC_PROFILE_KEYS, isPublicLogo, readPublicProfile, toPublicProfile } from "./publicProfile";

const row = {
  id: 1, legalEntityName: "PT Rahasia Tbk", tradingName: "Valas Terang", licenseNumber: "IZIN-778899", kupvaCode: "KUPVA-5566",
  npwp: "01.234.567.8-999.000", nib: "NIB-4455", biReporterCode: "SANDI-BI-7788", sipesatIdPjk: "PJK-3344", goamlRentityId: 99887,
  goamlReportingUserCode: "GOAML-USER-1", address: "Jl. Uji 1", province: "JAWA_BARAT", phone: "+62 21 555", email: "rahasia@contoh.test",
  website: null, baseCurrencyCode: "IDR", timezone: "Asia/Jakarta", themePalette: "ZAMRUD", accentColor: null, publicPageEnabled: true,
  secondaryPhone: null, openingHours: "Senin–Sabtu 08.00–17.00", openingSchedule: null, moneyRules: null, mapUrl: "https://maps.example/abc", publicFaq: null, fraudWarning: null,
  logoDocumentId: 5, updatedByUserId: 1, updatedAt: new Date(), createdAt: new Date(),
} as CompanyProfile;

describe("profil publik", () => {
  it("hanya kunci yang dipaku; NPWP, NIB, kode BI/PPATK/goAML, dan email tidak pernah keluar", () => {
    const output = toPublicProfile(row, null, false);
    expect(Object.keys(output).sort()).toEqual([...PUBLIC_PROFILE_KEYS].sort());
    const json = JSON.stringify(output);
    for (const secret of ["01.234.567.8-999.000", "NIB-4455", "SANDI-BI-7788", "PJK-3344", "99887", "GOAML-USER-1", "rahasia@contoh.test"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("bukti izin untuk bagian Resmi & aman dan jadwal terstruktur ikut keluar", () => {
    const schedule = [{ open: "09:00", close: "17:00" }, null, null, null, null, null, null];
    const output = toPublicProfile({ ...row, openingSchedule: schedule, moneyRules: { denominations: "USD 100", condition: null, series: null } } as CompanyProfile, null, false);
    expect(output).toMatchObject({ legalEntityName: "PT Rahasia Tbk", licenseNumber: "IZIN-778899", kupvaCode: "KUPVA-5566", openingSchedule: schedule, timezone: "Asia/Jakarta", moneyRules: { denominations: "USD 100" } });
  });

  it("instalasi tanpa profil memakai bawaan produk", () => {
    expect(toPublicProfile(null, null, true)).toMatchObject({ tradingName: null, themePalette: "MARUN", publicPageEnabled: true, publicFaq: null, setupRequired: true, openingSchedule: null, moneyRules: null, timezone: "Asia/Jakarta", licenseNumber: null });
  });

  it("peta tersimpan yang bukan https dibuang; nama dagang kosong jatuh ke nama badan hukum", () => {
    const output = toPublicProfile({ ...row, tradingName: " ", mapUrl: "javascript:alert(1)" } as CompanyProfile, null, false);
    expect(output.mapUrl).toBeNull();
    expect(output.tradingName).toBe("PT Rahasia Tbk");
  });

  it("logo yang gagal ditandatangani tidak menjatuhkan halaman publik", async () => {
    const output = await readPublicProfile({ getProfile: async () => row, setupRequired: async () => false, logoUrl: async () => { throw new Error("R2 belum diatur"); } });
    expect(output.logoUrl).toBeNull();
    expect(output.tradingName).toBe("Valas Terang");
  });

  it("logo nonaktif atau bukan COMPANY_LOGO tidak pernah dipublikasikan", () => {
    expect(isPublicLogo({ documentType: "COMPANY_LOGO", deactivatedAt: null })).toBe(true);
    expect(isPublicLogo({ documentType: "COMPANY_LOGO", deactivatedAt: new Date() })).toBe(false);
    expect(isPublicLogo({ documentType: "LICENSE_CERTIFICATE", deactivatedAt: null })).toBe(false);
    expect(isPublicLogo(undefined)).toBe(false);
  });
});
