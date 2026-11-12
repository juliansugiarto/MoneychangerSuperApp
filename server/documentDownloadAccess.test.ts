import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import * as storage from "./storage";
import { getOperationalDocumentDownloadUrl } from "./documentOperations";

/**
 * Tautan unduh mengikuti aturan yang sama dengan daftar dokumennya: arsip perusahaan dan dokumen
 * perusahaan yang dinonaktifkan hanya terlihat oleh CONTROLLER ke atas, jadi id-nya pun tidak boleh
 * menjadi pintu belakang bagi STAFF/ADMIN. Penolakan berpesan sama dengan "tidak ditemukan".
 */
function serve(document: Record<string, unknown> | undefined) {
  const reader: any = { from: () => reader, where: () => reader, limit: () => Promise.resolve(document ? [document] : []) };
  vi.spyOn(db, "getDb").mockResolvedValue({ select: () => reader } as never);
  return vi.spyOn(storage, "storageGetSignedUrl").mockResolvedValue("https://uji.invalid/tautan");
}

afterEach(() => vi.restoreAllMocks());

const archiveFile = { id: 7, ownerType: "COMPANY_ARCHIVE", documentType: "COMPANY_ARCHIVE_FILE", storageKey: "arsip/7.pdf", deactivatedAt: null };
const retiredLicense = { id: 8, ownerType: "COMPANY", documentType: "LICENSE_CERTIFICATE", storageKey: "izin/8.pdf", deactivatedAt: new Date("2026-10-01T00:00:00Z") };
const customerKtp = { id: 9, ownerType: "CUSTOMER", documentType: "KTP_PHOTO", storageKey: "ktp/9.jpg", deactivatedAt: null };

describe("izin tautan unduh dokumen", () => {
  it.each([["STAFF"], ["ADMIN"]] as const)("%s tidak bisa mengunduh berkas arsip perusahaan lewat id", async (role) => {
    const signer = serve(archiveFile);
    await expect(getOperationalDocumentDownloadUrl(7, role)).rejects.toThrow("Dokumen tidak ditemukan.");
    expect(signer).not.toHaveBeenCalled();
  });

  it("STAFF tidak bisa mengunduh dokumen perusahaan yang sudah dinonaktifkan", async () => {
    const signer = serve(retiredLicense);
    await expect(getOperationalDocumentDownloadUrl(8, "STAFF")).rejects.toThrow("Dokumen tidak ditemukan.");
    expect(signer).not.toHaveBeenCalled();
  });

  it.each([["CONTROLLER"], ["SHAREHOLDER"]] as const)("%s tetap bisa mengunduh arsip dan dokumen nonaktif", async (role) => {
    serve(archiveFile);
    await expect(getOperationalDocumentDownloadUrl(7, role)).resolves.toBe("https://uji.invalid/tautan");
    serve(retiredLicense);
    await expect(getOperationalDocumentDownloadUrl(8, role)).resolves.toBe("https://uji.invalid/tautan");
  });

  it("STAFF tetap bisa mengunduh foto KTP nasabah yang memang bisa ia lihat di daftarnya", async () => {
    serve(customerKtp);
    await expect(getOperationalDocumentDownloadUrl(9, "STAFF")).resolves.toBe("https://uji.invalid/tautan");
  });
});
