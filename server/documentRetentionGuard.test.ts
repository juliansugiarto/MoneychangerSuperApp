import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pasal 48 PBI 10/2024 mewajibkan penatausahaan dokumen Pengguna Jasa. Satu-satunya penghapusan
 * baris `operational_documents` yang boleh ada di repo ini adalah `purgeCompanyProfileDocument`,
 * yang berpagar `ownerType = "COMPANY"` dan hanya dapat dijalankan SHAREHOLDER.
 *
 * Tanpa penjaga ini, paket berikutnya dapat menambahkan jalur hapus dokumen nasabah atau transaksi
 * tanpa ada yang mengeluh.
 */

const serverDir = join(process.cwd(), "server");

/** Seluruh berkas sumber `.ts` di bawah `server/`, rekursif, tanpa berkas uji. */
function serverSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : serverSources(path);
    return entry.name.endsWith(".ts") && !entry.name.includes(".test.") ? [path] : [];
  });
}

const DELETE_OPERATIONAL_DOCUMENTS = /delete\(\s*operationalDocuments\s*\)|DELETE\s+FROM\s+`?operational_documents`?/i;

describe("penjaga penatausahaan dokumen", () => {
  it("hanya companyProfileDocuments.ts yang menghapus baris operational_documents", () => {
    const offenders = serverSources(serverDir)
      .filter((path) => !path.endsWith(join("server", "companyProfileDocuments.ts")))
      .filter((path) => DELETE_OPERATIONAL_DOCUMENTS.test(readFileSync(path, "utf8")))
      .map((path) => path.slice(serverDir.length + 1));
    expect(offenders).toEqual([]);
  });

  it("penghapus satu-satunya itu tetap berpagar ownerType COMPANY dan gerbang Pemegang Saham", () => {
    const source = readFileSync(join(serverDir, "companyProfileDocuments.ts"), "utf8");
    expect(source.match(/delete\(\s*operationalDocuments\s*\)/g)).toHaveLength(1);
    expect(source).toMatch(/document\.ownerType !== "COMPANY"/);
    expect(source).toMatch(/assertAllowed\(companyProfileDocumentPurgeDenial\(actor\)\)/);
  });

  it("router tidak lagi mengekspos documents.deleteCompany", () => {
    const routers = readFileSync(join(serverDir, "routers.ts"), "utf8");
    expect(routers).not.toMatch(/\bdeleteCompany\s*:/);
    expect(routers).not.toMatch(/deleteCompanyDocument/);
  });
});
