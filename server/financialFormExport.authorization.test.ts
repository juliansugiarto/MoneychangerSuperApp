import { describe, expect, it } from "vitest";
import { financialFormExportDenial, formExportFileName } from "./financialFormExport";

/**
 * Otorisasi unduhan ekspor form ditegakkan di server.
 *
 * Tombolnya memang hanya tampil bagi Controller ke atas, tetapi menyembunyikan tombol bukan
 * otorisasi: rutenya dapat dipanggil langsung, dan berkasnya memuat seluruh angka laporan keuangan
 * perusahaan beserta lembar penelusuran ke akunnya.
 */
const boleh = { role: "CONTROLLER", mustChangePassword: false };

describe("otorisasi unduhan ekspor form", () => {
  it("menolak STAFF dan ADMIN", () => {
    for (const role of ["STAFF", "ADMIN"]) {
      const denial = financialFormExportDenial({ role, mustChangePassword: false }, 2025);
      expect(denial?.status, role).toBe(403);
      expect(denial?.message, role).toContain("Controller atau Shareholder");
    }
  });

  it("menolak peran yang tidak dikenal", () => {
    expect(financialFormExportDenial({ role: "", mustChangePassword: false }, 2025)?.status).toBe(403);
    expect(financialFormExportDenial({ role: "AUDITOR", mustChangePassword: false }, 2025)?.status).toBe(403);
  });

  it("menolak pengguna yang wajib mengganti kata sandi, bahkan Shareholder", () => {
    const denial = financialFormExportDenial({ role: "SHAREHOLDER", mustChangePassword: true }, 2025);
    expect(denial?.status).toBe(403);
    expect(denial?.message).toContain("Ganti kata sandi");
  });

  it("mendahulukan penggantian kata sandi di atas pemeriksaan peran", () => {
    expect(financialFormExportDenial({ role: "STAFF", mustChangePassword: true }, 2025)?.message).toContain("Ganti kata sandi");
  });

  it("menerima Controller dan Shareholder", () => {
    expect(financialFormExportDenial({ role: "CONTROLLER", mustChangePassword: false }, 2025)).toBeNull();
    expect(financialFormExportDenial({ role: "SHAREHOLDER", mustChangePassword: false }, 2025)).toBeNull();
  });

  it("menolak tahun yang bukan bilangan bulat wajar", () => {
    for (const year of [Number.NaN, 1999, 2101, 2025.5, "2025", null, undefined]) {
      const denial = financialFormExportDenial(boleh, year);
      expect(denial?.status, String(year)).toBe(400);
      expect(denial?.message, String(year)).toContain("Tahun buku tidak valid");
    }
  });

  it("memeriksa peran sebelum tahun, sehingga peran yang salah tidak belajar apa pun dari tahunnya", () => {
    expect(financialFormExportDenial({ role: "STAFF", mustChangePassword: false }, Number.NaN)?.status).toBe(403);
  });
});

describe("nama berkas unduhan", () => {
  it("menyebut tahun bukunya dan berakhiran xlsx", () => {
    expect(formExportFileName(2025)).toBe("Laporan-Keuangan-B0002-B0003-B0004-2025.xlsx");
    expect(formExportFileName(2024)).toContain("2024");
  });

  it("tidak memuat karakter yang merusak header Content-Disposition", () => {
    expect(formExportFileName(2025)).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});
