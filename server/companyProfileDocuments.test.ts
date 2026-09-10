import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { deactivateCompanyProfileDocument, purgeCompanyProfileDocument } from "./companyProfileDocuments";

/**
 * Pengganti `deleteCompanyDocument`: nonaktif beralasan untuk Controller ke atas, hapus permanen
 * beraudit lengkap untuk Pemegang Saham. Tabel peran murninya ada di
 * `companyProfileDocuments.authorization.test.ts`.
 */

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    orderBy: () => makeReader(rows),
    limit: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

const sertifikat = {
  id: 31, ownerType: "COMPANY" as const, documentType: "LICENSE_CERTIFICATE" as const,
  customerId: null, transactionId: null, expenseId: null,
  storageKey: "operational-documents/company/izin-31.pdf", originalFileName: "izin-usaha.pdf", mimeType: "application/pdf", byteSize: 20480,
  documentReference: "KEP-BI-01", notes: null, uploadedByUserId: 3, createdAt: new Date("2026-01-02T03:00:00Z"),
  deactivatedAt: null as Date | null, deactivatedByUserId: null as number | null, deactivationReason: null as string | null,
};

function mockDb(document: Record<string, unknown> | null, logoDocumentId: number | null = null) {
  const events: string[] = [];
  const sets: Record<string, unknown>[] = [];
  const audits: Record<string, any>[] = [];
  const fakeDb = {
    select: vi.fn(() => ({
      from: (table: unknown) => {
        const name = tableName(table);
        if (name === "operational_documents") return makeReader(document ? [document] : []);
        if (name === "company_profile") return makeReader([{ logoDocumentId }]);
        return makeReader([]);
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        events.push(`update:${tableName(table)}`);
        sets.push(values);
        return { where: () => Promise.resolve(undefined) };
      },
    })),
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        events.push(`insert:${tableName(table)}`);
        if (tableName(table) === "audit_logs") audits.push(values);
        return Promise.resolve(undefined);
      },
    })),
    delete: vi.fn((table: unknown) => ({
      where: () => {
        events.push(`delete:${tableName(table)}`);
        return Promise.resolve(undefined);
      },
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { events, sets, audits, fakeDb };
}

const controller = { id: 5, role: "CONTROLLER", mustChangePassword: false };
const pemegangSaham = { id: 4, role: "SHAREHOLDER", mustChangePassword: false };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("alasan wajib", () => {
  it.each(["", "   "])("menonaktifkan dengan alasan %j ditolak tanpa menyentuh basis data", async (reason) => {
    const { events } = mockDb(sertifikat);
    await expect(deactivateCompanyProfileDocument({ documentId: 31, reason }, controller)).rejects.toThrow(/Alasan penonaktifan wajib/);
    expect(events).toEqual([]);
  });

  it.each(["", "   "])("menghapus permanen dengan alasan %j ditolak tanpa menyentuh basis data", async (reason) => {
    const { events } = mockDb(sertifikat);
    await expect(purgeCompanyProfileDocument({ documentId: 31, reason }, pemegangSaham)).rejects.toThrow(/Alasan penghapusan permanen wajib/);
    expect(events).toEqual([]);
  });
});

describe("hanya dokumen profil perusahaan", () => {
  it.each(["CUSTOMER", "TRANSACTION", "EXPENSE", "COMPANY_ARCHIVE"])("dokumen %s ditolak pada kedua jalur, pesannya menyebut Pasal 48", async (ownerType) => {
    const { events } = mockDb({ ...sertifikat, ownerType });
    await expect(deactivateCompanyProfileDocument({ documentId: 31, reason: "salah unggah" }, controller)).rejects.toThrow(/Pasal 48/);
    await expect(purgeCompanyProfileDocument({ documentId: 31, reason: "salah unggah" }, pemegangSaham)).rejects.toThrow(/Pasal 48/);
    expect(events).toEqual([]);
  });

  it("dokumen yang tidak ada ditolak", async () => {
    mockDb(null);
    await expect(deactivateCompanyProfileDocument({ documentId: 99, reason: "salah unggah" }, controller)).rejects.toThrow(/tidak ditemukan/);
  });
});

describe("logo yang sedang dipakai", () => {
  it("tidak dapat dinonaktifkan maupun dihapus", async () => {
    const logo = { ...sertifikat, documentType: "COMPANY_LOGO" as const };
    const { events } = mockDb(logo, 31);
    await expect(deactivateCompanyProfileDocument({ documentId: 31, reason: "ganti logo" }, controller)).rejects.toThrow(/Logo yang sedang dipakai/);
    await expect(purgeCompanyProfileDocument({ documentId: 31, reason: "ganti logo" }, pemegangSaham)).rejects.toThrow(/Logo yang sedang dipakai/);
    expect(events).toEqual([]);
  });
});

describe("gerbang ditegakkan di penulis", () => {
  it("ADMIN tidak dapat menonaktifkan walau memanggil penulisnya langsung", async () => {
    const { events } = mockDb(sertifikat);
    await expect(deactivateCompanyProfileDocument({ documentId: 31, reason: "salah unggah" }, { id: 2, role: "ADMIN", mustChangePassword: false })).rejects.toThrow(/Hanya Controller/);
    expect(events).toEqual([]);
  });

  it("CONTROLLER tidak dapat menghapus permanen walau memanggil penulisnya langsung", async () => {
    const { events } = mockDb(sertifikat);
    await expect(purgeCompanyProfileDocument({ documentId: 31, reason: "salah unggah" }, controller)).rejects.toThrow(/Hanya Pemegang Saham/);
    expect(events).toEqual([]);
  });
});

describe("deactivateCompanyProfileDocument", () => {
  it("menolak dokumen yang sudah nonaktif", async () => {
    const { events } = mockDb({ ...sertifikat, deactivatedAt: new Date("2026-09-01T02:00:00Z") });
    await expect(deactivateCompanyProfileDocument({ documentId: 31, reason: "izin diperbarui" }, controller)).rejects.toThrow(/sudah nonaktif/);
    expect(events).toEqual([]);
  });

  it("mengisi ketiga kolom nonaktif dan menulis satu audit, tanpa menghapus apa pun", async () => {
    const { events, sets, audits, fakeDb } = mockDb(sertifikat);
    await deactivateCompanyProfileDocument({ documentId: 31, reason: "  izin diperbarui  " }, controller);

    expect(sets).toHaveLength(1);
    expect(sets[0].deactivatedAt).toBeInstanceOf(Date);
    expect(sets[0]).toMatchObject({ deactivatedByUserId: 5, deactivationReason: "izin diperbarui" });
    expect(fakeDb.delete).not.toHaveBeenCalled();
    expect(events).toEqual(["update:operational_documents", "insert:audit_logs"]);

    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "COMPANY_PROFILE_DOCUMENT_DEACTIVATED",
      entityType: "operational_documents",
      entityId: "31",
      actorUserId: 5,
      reason: "izin diperbarui",
    });
    expect(audits[0].beforeState).toMatchObject({ originalFileName: "izin-usaha.pdf", deactivatedAt: null });
    expect(audits[0].afterState).toMatchObject({ deactivatedByUserId: 5 });
  });
});

describe("purgeCompanyProfileDocument", () => {
  it("menulis audit SEBELUM delete, lengkap dengan storageKey dan storageObjectRetained", async () => {
    const { events, audits } = mockDb({ ...sertifikat, deactivatedAt: new Date("2026-09-01T02:00:00Z"), deactivatedByUserId: 5, deactivationReason: "izin diperbarui" });
    await purgeCompanyProfileDocument({ documentId: 31, reason: "memuat KTP pihak lain" }, pemegangSaham);

    expect(events).toEqual(["insert:audit_logs", "delete:operational_documents"]);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "COMPANY_PROFILE_DOCUMENT_PURGED",
      entityId: "31",
      actorUserId: 4,
      reason: "memuat KTP pihak lain",
      metadata: { storageObjectRetained: true },
    });
    expect(audits[0].beforeState).toMatchObject({
      storageKey: "operational-documents/company/izin-31.pdf",
      originalFileName: "izin-usaha.pdf",
      byteSize: 20480,
      deactivationReason: "izin diperbarui",
    });
  });

  it("boleh menghapus dokumen yang masih aktif", async () => {
    const { events } = mockDb(sertifikat);
    await purgeCompanyProfileDocument({ documentId: 31, reason: "memuat KTP pihak lain" }, pemegangSaham);
    expect(events).toEqual(["insert:audit_logs", "delete:operational_documents"]);
  });

  it("bila audit gagal ditulis, barisnya tidak dihapus", async () => {
    const { fakeDb } = mockDb(sertifikat);
    fakeDb.insert.mockImplementation(() => ({ values: () => Promise.reject(new Error("audit gagal")) }) as never);
    await expect(purgeCompanyProfileDocument({ documentId: 31, reason: "memuat KTP pihak lain" }, pemegangSaham)).rejects.toThrow(/audit gagal/);
    expect(fakeDb.delete).not.toHaveBeenCalled();
  });
});
