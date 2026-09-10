import { describe, expect, it } from "vitest";
import { companyProfileDocumentDeactivationDenial, companyProfileDocumentPurgeDenial } from "./companyProfileDocuments";

/**
 * Tabel peran atas kedua gerbang dokumen profil perusahaan. Menonaktifkan: Controller ke atas.
 * Menghapus permanen: hanya Pemegang Saham (keputusan pengguna 11 September 2026).
 */
describe("gerbang dokumen profil perusahaan", () => {
  it.each([
    ["STAFF", false, false, false],
    ["ADMIN", false, false, false],
    ["CONTROLLER", false, true, false],
    ["SHAREHOLDER", false, true, true],
    ["SHAREHOLDER", true, false, false],
    ["CONTROLLER", true, false, false],
  ] as const)("%s (mustChangePassword=%s): nonaktif %s, hapus permanen %s", (role, mustChangePassword, mayDeactivate, mayPurge) => {
    const user = { role, mustChangePassword };
    expect(companyProfileDocumentDeactivationDenial(user) === null).toBe(mayDeactivate);
    expect(companyProfileDocumentPurgeDenial(user) === null).toBe(mayPurge);
  });

  it("penolakannya berstatus 403 dengan pesan yang menyebut siapa yang boleh", () => {
    expect(companyProfileDocumentDeactivationDenial({ role: "ADMIN", mustChangePassword: false })).toEqual({
      status: 403,
      message: "Hanya Controller ke atas yang dapat menonaktifkan dokumen profil perusahaan.",
    });
    expect(companyProfileDocumentPurgeDenial({ role: "CONTROLLER", mustChangePassword: false })).toEqual({
      status: 403,
      message: "Hanya Pemegang Saham yang dapat menghapus permanen dokumen profil perusahaan.",
    });
  });

  it("kata sandi yang wajib diganti menahan siapa pun, dengan pesannya sendiri", () => {
    expect(companyProfileDocumentDeactivationDenial({ role: "SHAREHOLDER", mustChangePassword: true })?.message).toMatch(/Ganti kata sandi/);
    expect(companyProfileDocumentPurgeDenial({ role: "SHAREHOLDER", mustChangePassword: true })?.message).toMatch(/Ganti kata sandi/);
  });
});
