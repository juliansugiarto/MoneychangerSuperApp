import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import * as operations from "./operations";
import {
  addCompanyDocumentVersion,
  createCompanyDocument,
  deactivateCompanyDocument,
} from "./companyDocumentArchive";

/** Penulis arsip dokumen perusahaan: nomor versi, penggantian, penonaktifan, dan auditnya. */

const arsipFile = { id: 41, ownerType: "COMPANY_ARCHIVE", documentType: "COMPANY_ARCHIVE_FILE", originalFileName: "sop-v1.pdf" };
const arsipFileKedua = { id: 42, ownerType: "COMPANY_ARCHIVE", documentType: "COMPANY_ARCHIVE_FILE", originalFileName: "sop-v2.pdf" };
const dokumen = { id: 7, category: "SOP", title: "Prosedur Penerimaan Nasabah", deactivatedAt: null };
const pegawai = { id: 5, fullName: "Petugas Kepatuhan" };

type Rows = Record<string, unknown[]>;

/**
 * Pasangan kolom-nilai yang terikat pada sebuah klausa SQL Drizzle.
 *
 * Basis data palsu yang mengabaikan `where` akan mengembalikan baris yang di produksi tidak akan
 * pernah terbaca — dan uji yang gagal karenanya gagal atas kekeliruan palsunya sendiri, bukan atas
 * kekeliruan kodenya. Karena itu palsunya ikut menyaring.
 */
function boundPairs(clause: unknown): Record<string, unknown> {
  const pairs: Record<string, unknown> = {};
  let lastColumn: string | null = null;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const candidate = node as { name?: unknown; value?: unknown; queryChunks?: unknown[]; columnType?: unknown };
    if (typeof candidate.name === "string" && candidate.columnType) lastColumn = candidate.name;
    // `Array.isArray` menyisihkan StringChunk pemisah (` = `), yang juga punya `value` dan kalau
    // tidak disisihkan akan merebut giliran Param yang sesungguhnya.
    else if (lastColumn && "value" in candidate && !Array.isArray(candidate.value)) { pairs[lastColumn] = candidate.value; lastColumn = null; }
    if (Array.isArray(candidate.queryChunks)) candidate.queryChunks.forEach(walk);
  };
  walk(clause);
  return pairs;
}

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    innerJoin: () => makeReader(rows),
    leftJoin: () => makeReader(rows),
    where: (clause: unknown) => {
      const pairs = boundPairs(clause);
      const matching = rows.filter((row) => Object.entries(pairs).every(([key, value]) => {
        const record = row as Record<string, unknown>;
        return !(key in record) || record[key] === value;
      }));
      return makeReader(matching);
    },
    limit: () => makeReader(rows),
    orderBy: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

function mockDb(rows: Rows) {
  const inserted: { table: string; values: Record<string, unknown> }[] = [];
  const updated: { table: string; values: Record<string, unknown> }[] = [];
  const deleted: string[] = [];
  const fakeDb: Record<string, unknown> = {
    select: vi.fn(() => ({ from: (table: unknown) => makeReader(rows[tableName(table)] ?? []) })),
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserted.push({ table: tableName(table), values });
        return { $returningId: () => Promise.resolve([{ id: 99 }]), then: (ok: any) => Promise.resolve(undefined).then(ok) };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        updated.push({ table: tableName(table), values });
        return { where: () => Promise.resolve(undefined) };
      },
    })),
    delete: vi.fn((table: unknown) => { deleted.push(tableName(table)); return { where: () => Promise.resolve(undefined) }; }),
  };
  fakeDb.transaction = vi.fn((run: (tx: unknown) => Promise<unknown>) => run(fakeDb));
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  const audit = vi.spyOn(operations, "writeAudit").mockResolvedValue(undefined as never);
  return { inserted, updated, deleted, audit };
}

const actor = { id: 3 };
const buatInput = {
  category: "SOP" as const,
  title: "Prosedur Penerimaan Nasabah",
  operationalDocumentId: 41,
  validFrom: new Date(2026, 8, 1),
  validUntil: new Date(2027, 7, 31),
};

describe("membuat dokumen arsip", () => {
  it("menulis dokumen beserta versi 1 dalam satu transaksi", async () => {
    const { inserted } = mockDb({ operational_documents: [arsipFile], company_document_versions: [] });
    await createCompanyDocument(buatInput, actor);

    const dokumenBaris = inserted.find((row) => row.table === "company_documents");
    const versiBaris = inserted.find((row) => row.table === "company_document_versions");
    expect(dokumenBaris?.values.title).toBe("Prosedur Penerimaan Nasabah");
    expect(dokumenBaris?.values.createdByUserId).toBe(3);
    expect(versiBaris?.values.versionNumber).toBe(1);
    expect(versiBaris?.values.operationalDocumentId).toBe(41);
    expect(versiBaris?.values.supersededAt).toBeNull();
    // Versi pertama tidak perlu alasan perubahan — keputusan pengguna 7.
    expect(versiBaris?.values.changeReason).toBeNull();
  });

  it("menolak berkas yang bukan ownerType COMPANY_ARCHIVE", async () => {
    mockDb({ operational_documents: [{ id: 41, ownerType: "COMPANY", documentType: "COMPANY_LOGO" }] });
    await expect(createCompanyDocument(buatInput, actor)).rejects.toThrow(/arsip/i);
  });

  it("menolak berkas yang tidak ada", async () => {
    mockDb({ operational_documents: [] });
    await expect(createCompanyDocument(buatInput, actor)).rejects.toThrow(/tidak ditemukan/i);
  });

  it("menolak berkas yang sudah dipakai versi lain", async () => {
    mockDb({ operational_documents: [arsipFile], company_document_versions: [{ id: 1, operationalDocumentId: 41 }] });
    await expect(createCompanyDocument(buatInput, actor)).rejects.toThrow(/sudah dipakai/i);
  });

  it("menolak validUntil yang mendahului validFrom", async () => {
    mockDb({ operational_documents: [arsipFile], company_document_versions: [] });
    await expect(createCompanyDocument({ ...buatInput, validUntil: new Date(2026, 7, 1) }, actor)).rejects.toThrow(/berakhir/i);
  });

  it("menolak penanggung jawab yang tidak ada pada daftar pegawai", async () => {
    mockDb({ operational_documents: [arsipFile], company_document_versions: [], employees: [] });
    await expect(createCompanyDocument({ ...buatInput, responsibleEmployeeId: 5 }, actor)).rejects.toThrow(/pegawai/i);
  });

  it("menerima penanggung jawab yang ada", async () => {
    const { inserted } = mockDb({ operational_documents: [arsipFile], company_document_versions: [], employees: [pegawai] });
    await createCompanyDocument({ ...buatInput, responsibleEmployeeId: 5 }, actor);
    expect(inserted.find((row) => row.table === "company_documents")?.values.responsibleEmployeeId).toBe(5);
  });

  it("menulis audit COMPANY_DOCUMENT_CREATED", async () => {
    const { audit } = mockDb({ operational_documents: [arsipFile], company_document_versions: [] });
    await createCompanyDocument(buatInput, actor);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "COMPANY_DOCUMENT_CREATED", actorUserId: 3 }));
  });
});

describe("mengganti versi dokumen arsip", () => {
  const gantiInput = { companyDocumentId: 7, operationalDocumentId: 42, validFrom: new Date(2027, 0, 1), validUntil: null, changeReason: "revisi berkala tahunan" };
  const versiBerjalan = { id: 1, companyDocumentId: 7, versionNumber: 1, operationalDocumentId: 41, supersededAt: null };

  it("menaikkan nomor versi dan menutup versi sebelumnya", async () => {
    const { inserted, updated } = mockDb({
      company_documents: [dokumen], operational_documents: [arsipFileKedua], company_document_versions: [versiBerjalan],
    });
    await addCompanyDocumentVersion(gantiInput, actor);

    const versiBaru = inserted.find((row) => row.table === "company_document_versions");
    expect(versiBaru?.values.versionNumber).toBe(2);
    expect(versiBaru?.values.changeReason).toBe("revisi berkala tahunan");
    const penutupan = updated.find((row) => row.table === "company_document_versions");
    expect(penutupan?.values.supersededAt).toBeInstanceOf(Date);
  });

  it("menolak versi kedua tanpa alasan perubahan", async () => {
    mockDb({ company_documents: [dokumen], operational_documents: [arsipFileKedua], company_document_versions: [versiBerjalan] });
    await expect(addCompanyDocumentVersion({ ...gantiInput, changeReason: "   " }, actor)).rejects.toThrow(/alasan/i);
  });

  it("menolak menambah versi pada dokumen yang sudah nonaktif", async () => {
    mockDb({
      company_documents: [{ ...dokumen, deactivatedAt: new Date("2026-09-01T03:00:00.000Z") }],
      operational_documents: [arsipFileKedua], company_document_versions: [versiBerjalan],
    });
    await expect(addCompanyDocumentVersion(gantiInput, actor)).rejects.toThrow(/nonaktif/i);
  });

  it("menolak dokumen yang tidak ada", async () => {
    mockDb({ company_documents: [], operational_documents: [arsipFileKedua], company_document_versions: [] });
    await expect(addCompanyDocumentVersion(gantiInput, actor)).rejects.toThrow(/tidak ditemukan/i);
  });

  it("menulis audit COMPANY_DOCUMENT_VERSION_ADDED", async () => {
    const { audit } = mockDb({ company_documents: [dokumen], operational_documents: [arsipFileKedua], company_document_versions: [versiBerjalan] });
    await addCompanyDocumentVersion(gantiInput, actor);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "COMPANY_DOCUMENT_VERSION_ADDED" }));
  });
});

describe("menonaktifkan dokumen arsip", () => {
  it("mengisi tiga kolom dan tidak menghapus baris mana pun", async () => {
    const { updated, deleted } = mockDb({ company_documents: [dokumen] });
    await deactivateCompanyDocument({ companyDocumentId: 7, reason: "digantikan SOP terbaru" }, actor);

    const baris = updated.find((row) => row.table === "company_documents");
    expect(baris?.values.deactivatedAt).toBeInstanceOf(Date);
    expect(baris?.values.deactivatedByUserId).toBe(3);
    expect(baris?.values.deactivationReason).toBe("digantikan SOP terbaru");
    // Menghapus berarti menonaktifkan — keputusan pengguna 3. Dihitung, bukan diandaikan.
    expect(deleted).toEqual([]);
  });

  it("menolak penonaktifan tanpa alasan", async () => {
    mockDb({ company_documents: [dokumen] });
    await expect(deactivateCompanyDocument({ companyDocumentId: 7, reason: "  " }, actor)).rejects.toThrow(/alasan/i);
  });

  it("menolak dokumen yang sudah nonaktif", async () => {
    mockDb({ company_documents: [{ ...dokumen, deactivatedAt: new Date("2026-09-01T03:00:00.000Z") }] });
    await expect(deactivateCompanyDocument({ companyDocumentId: 7, reason: "sudah tidak dipakai" }, actor)).rejects.toThrow(/nonaktif/i);
  });

  it("menulis audit COMPANY_DOCUMENT_DEACTIVATED beserta alasannya", async () => {
    const { audit } = mockDb({ company_documents: [dokumen] });
    await deactivateCompanyDocument({ companyDocumentId: 7, reason: "digantikan SOP terbaru" }, actor);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "COMPANY_DOCUMENT_DEACTIVATED", reason: "digantikan SOP terbaru" }));
  });
});
