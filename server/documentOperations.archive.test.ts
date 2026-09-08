import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import * as storage from "./storage";
import { listCompanyDocuments, operationalDocumentUploadDenial, uploadOperationalDocument } from "./documentOperations";

/**
 * Berkas arsip perusahaan pada jalur unggah dokumen yang sudah ada.
 *
 * Berkas ujinya dibuat di dalam uji ini sebagai buffer kecil — tidak ada dokumen nyata, tidak ada
 * KYC, dan tidak ada workbook yang disalin ke dalam repositori.
 */

const pdfBytes = Buffer.from("%PDF-1.4\nuji arsip\n%%EOF\n", "utf8");

/** Nilai yang terikat pada sebuah klausa SQL Drizzle, dikumpulkan dari `queryChunks`-nya. */
function boundValues(clause: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const candidate = node as { value?: unknown; queryChunks?: unknown[] };
    if (typeof candidate.value === "string") found.push(candidate.value);
    if (Array.isArray(candidate.queryChunks)) candidate.queryChunks.forEach(walk);
  };
  walk(clause);
  return found;
}

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    limit: () => makeReader(rows),
    orderBy: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function mockDb(rows: unknown[]) {
  const inserted: Record<string, unknown>[] = [];
  const fakeDb: Record<string, unknown> = {
    select: vi.fn(() => ({ from: () => makeReader(rows) })),
    insert: vi.fn(() => ({ values: (values: Record<string, unknown>) => { inserted.push(values); return Promise.resolve(undefined); } })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  vi.spyOn(storage, "storagePut").mockImplementation(async (key: string) => ({ key, url: `https://uji.invalid/${key}` }) as never);
  return { inserted };
}

const arsipInput = {
  documentType: "COMPANY_ARCHIVE_FILE" as const,
  originalFileName: "sop-penerimaan-nasabah.pdf",
  mimeType: "application/pdf",
  byteSize: pdfBytes.byteLength,
  data: pdfBytes,
};

describe("unggah berkas arsip perusahaan", () => {
  it("menghasilkan baris ber-ownerType COMPANY_ARCHIVE, bukan COMPANY", () => {
    // Bukan COMPANY: listCompanyDocuments menyaring dengan ownerType saja dan mengirimkan seluruh
    // hasilnya ke halaman Profil Perusahaan.
    const created = { id: 9, ownerType: "COMPANY_ARCHIVE", documentType: "COMPANY_ARCHIVE_FILE" };
    const { inserted } = mockDb([created]);
    return uploadOperationalDocument(arsipInput, 3).then(() => {
      expect(inserted).toHaveLength(1);
      expect(inserted[0].ownerType).toBe("COMPANY_ARCHIVE");
      expect(inserted[0].documentType).toBe("COMPANY_ARCHIVE_FILE");
      expect(inserted[0].customerId).toBeNull();
      expect(inserted[0].transactionId).toBeNull();
      expect(inserted[0].expenseId).toBeNull();
      expect(inserted[0].uploadedByUserId).toBe(3);
    });
  });

  it("menyimpan berkasnya di bawah jalur arsip perusahaan tersendiri", async () => {
    mockDb([{ id: 9 }]);
    await uploadOperationalDocument(arsipInput, 3);
    const put = vi.mocked(storage.storagePut);
    expect(put.mock.calls[0][0]).toMatch(/^operasional\/arsip-perusahaan\//);
  });

  it("menolak berkas arsip yang dihubungkan ke nasabah, transaksi, atau pengeluaran", async () => {
    mockDb([{ id: 9 }]);
    await expect(uploadOperationalDocument({ ...arsipInput, customerId: 1 }, 3)).rejects.toThrow();
    await expect(uploadOperationalDocument({ ...arsipInput, transactionId: 1 }, 3)).rejects.toThrow();
    await expect(uploadOperationalDocument({ ...arsipInput, expenseId: 1 }, 3)).rejects.toThrow();
  });

  it("tetap menolak MIME di luar JPG, PNG, WEBP, dan PDF", async () => {
    mockDb([{ id: 9 }]);
    await expect(uploadOperationalDocument({ ...arsipInput, mimeType: "application/zip" }, 3)).rejects.toThrow(/JPG, PNG, WEBP, atau PDF/);
  });

  it("tetap menolak ukuran yang tidak konsisten dengan berkasnya", async () => {
    mockDb([{ id: 9 }]);
    await expect(uploadOperationalDocument({ ...arsipInput, byteSize: pdfBytes.byteLength + 10 }, 3)).rejects.toThrow(/tidak konsisten/);
  });

  it("tidak muncul pada listCompanyDocuments, sehingga halaman Profil Perusahaan tidak berubah", async () => {
    // Satu-satunya bukti bahwa arsip tidak membocor ke layar yang tidak memintanya: query itu
    // menyaring ownerType = COMPANY, dan berkas arsip tidak memakainya.
    const capturedWhere: unknown[] = [];
    const fakeDb: Record<string, unknown> = {
      select: vi.fn(() => ({ from: () => ({ where: (clause: unknown) => { capturedWhere.push(clause); return { orderBy: () => Promise.resolve([]) }; } }) })),
    };
    vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
    const hasil = await listCompanyDocuments();
    expect(hasil).toEqual([]);
    // Nilai yang terikat pada klausanya, bukan objeknya: objek SQL Drizzle memuat rujukan
    // melingkar ke tabelnya sehingga tidak dapat diserialkan.
    const nilaiTerikat = boundValues(capturedWhere[0]);
    expect(nilaiTerikat).toContain("COMPANY");
    expect(nilaiTerikat).not.toContain("COMPANY_ARCHIVE");
  });
});

describe("gerbang peran unggah berkas arsip", () => {
  const boleh = { mustChangePassword: false };

  it("menolak STAFF dan ADMIN dengan 403", () => {
    // Ditegakkan di server, bukan disembunyikan di UI.
    for (const role of ["STAFF", "ADMIN"]) {
      const denial = operationalDocumentUploadDenial({ role, ...boleh }, "COMPANY_ARCHIVE_FILE");
      expect(denial?.status).toBe(403);
      expect(denial?.message).toContain("Controller");
    }
  });

  it("mengizinkan CONTROLLER dan SHAREHOLDER", () => {
    expect(operationalDocumentUploadDenial({ role: "CONTROLLER", ...boleh }, "COMPANY_ARCHIVE_FILE")).toBeNull();
    expect(operationalDocumentUploadDenial({ role: "SHAREHOLDER", ...boleh }, "COMPANY_ARCHIVE_FILE")).toBeNull();
  });

  it("menolak peran yang tidak dikenal, bukan meloloskannya", () => {
    expect(operationalDocumentUploadDenial({ role: "", ...boleh }, "COMPANY_ARCHIVE_FILE")?.status).toBe(403);
    expect(operationalDocumentUploadDenial({ role: "AUDITOR", ...boleh }, "COMPANY_ARCHIVE_FILE")?.status).toBe(403);
  });

  it("tetap menjaga ketiga jenis dokumen profil perusahaan seperti sebelumnya", () => {
    for (const documentType of ["COMPANY_LOGO", "LICENSE_CERTIFICATE", "LICENSE_ATTACHMENT"]) {
      expect(operationalDocumentUploadDenial({ role: "STAFF", ...boleh }, documentType)?.status).toBe(403);
    }
  });

  it("tidak menghalangi staf mengunggah KTP, underlying, dan struk pengeluaran", () => {
    for (const documentType of ["KTP_PHOTO", "UNDERLYING_FORM", "EXPENSE_RECEIPT"]) {
      expect(operationalDocumentUploadDenial({ role: "STAFF", ...boleh }, documentType)).toBeNull();
    }
  });

  it("menahan siapa pun yang wajib mengganti kata sandi lebih dulu", () => {
    const denial = operationalDocumentUploadDenial({ role: "SHAREHOLDER", mustChangePassword: true }, "COMPANY_ARCHIVE_FILE");
    expect(denial?.status).toBe(403);
    expect(denial?.message).toContain("Ganti kata sandi");
  });
});
