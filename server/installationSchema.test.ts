import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { appInstallation, companyProfile, ownerRecoveryCodes } from "../drizzle/schema";
import { THEME_PALETTES, THEME_PALETTE_IDS } from "../shared/themePalettes";

describe("skema sub-proyek 2", () => {
  it("penyiapan dan kode pemulihan hanya menyimpan hash", () => {
    expect(Object.keys(getTableColumns(appInstallation))).toEqual(expect.arrayContaining(["setupCompletedAt", "setupCodeHash", "setupCodeExpiresAt"]));
    expect(Object.keys(getTableColumns(ownerRecoveryCodes))).toEqual(expect.arrayContaining(["userId", "codeHash", "usedAt"]));
    expect(Object.keys(getTableColumns(ownerRecoveryCodes))).not.toContain("code");
  });

  it("profil perusahaan membawa palet, warna sendiri, dan isian halaman publik", () => {
    const columns = getTableColumns(companyProfile);
    expect(Object.keys(columns)).toEqual(expect.arrayContaining(["themePalette", "accentColor", "publicPageEnabled", "secondaryPhone", "openingHours", "mapUrl", "publicFaq", "fraudWarning"]));
    expect(columns.themePalette.default).toBe("MARUN");
    expect(THEME_PALETTE_IDS).toEqual(THEME_PALETTES.map((palette) => palette.id));
  });

  it("isian 0061 hanya menandai instalasi yang sudah punya Pemegang Saham", () => {
    const sql = readFileSync(new URL("../drizzle/0061_isi_app_installation.sql", import.meta.url), "utf8");
    expect(sql).toContain("WHERE EXISTS (SELECT 1 FROM `users` WHERE `role` = 'SHAREHOLDER')");
    expect(sql).toContain("UTC_TIMESTAMP()");
  });
});
