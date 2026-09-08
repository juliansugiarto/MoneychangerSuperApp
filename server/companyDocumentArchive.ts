import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  companyDocumentVersions,
  companyDocuments,
  employees,
  operationalDocuments,
  type CompanyDocumentCategory,
} from "../drizzle/schema";
import { archiveDateKey } from "../shared/companyDocumentArchive";
import { databaseOrThrow, writeAudit } from "./operations";

/**
 * Arsip dokumen perusahaan — SOP, kebijakan internal, surat-menyurat BI, notulen rapat, dan
 * korespondensi regulator, beserta riwayat versinya.
 *
 * Modul ini **tidak pernah menghapus baris apa pun**. Menghapus sebuah dokumen berarti
 * menonaktifkannya (keputusan pengguna 8 September 2026): arsip kepatuhan yang isinya dapat lenyap
 * tanpa jejak bernilai lebih kecil bagi pemeriksa daripada arsip yang tidak dapat.
 */

export type ArchiveActor = { id: number };

export type CreateCompanyDocumentInput = {
  category: CompanyDocumentCategory;
  title: string;
  referenceNumber?: string | null;
  responsibleEmployeeId?: number | null;
  notes?: string | null;
  operationalDocumentId: number;
  validFrom: Date;
  validUntil?: Date | null;
};

export type AddCompanyDocumentVersionInput = {
  companyDocumentId: number;
  operationalDocumentId: number;
  validFrom: Date;
  validUntil?: Date | null;
  changeReason: string;
};

/** Berkas yang boleh dipasang sebagai versi: sudah ada, milik arsip, dan belum dipakai versi lain. */
async function assertUsableArchiveFile(db: Awaited<ReturnType<typeof databaseOrThrow>>, operationalDocumentId: number) {
  const [file] = await db
    .select({ id: operationalDocuments.id, ownerType: operationalDocuments.ownerType })
    .from(operationalDocuments)
    .where(eq(operationalDocuments.id, operationalDocumentId))
    .limit(1);
  if (!file) throw new Error("Berkas dokumen tidak ditemukan.");
  if (file.ownerType !== "COMPANY_ARCHIVE") throw new Error("Berkas ini bukan berkas arsip perusahaan.");

  const [used] = await db
    .select({ id: companyDocumentVersions.id })
    .from(companyDocumentVersions)
    .where(eq(companyDocumentVersions.operationalDocumentId, operationalDocumentId))
    .limit(1);
  // Indeks uniknya adalah jaring pengaman, bukan pengganti pemeriksaan ini: klien yang mengirim id
  // yang sama dua kali harus mendapat pesan yang menjelaskan sebabnya, bukan galat basis data.
  if (used) throw new Error("Berkas ini sudah dipakai versi dokumen lain.");
}

function assertValidityRange(validFrom: Date, validUntil: Date | null | undefined) {
  if (validUntil && archiveDateKey(validUntil) < archiveDateKey(validFrom)) {
    throw new Error("Tanggal berakhir tidak boleh mendahului tanggal mulai berlaku.");
  }
}

async function assertResponsibleEmployee(db: Awaited<ReturnType<typeof databaseOrThrow>>, employeeId: number | null | undefined) {
  if (!employeeId) return;
  const [employee] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!employee) throw new Error("Pegawai penanggung jawab tidak ditemukan.");
}

/**
 * Dokumen baru beserta versi pertamanya, **dalam satu transaksi**.
 *
 * Dokumen tanpa versi adalah keadaan yang tidak boleh dapat terjadi: seluruh pembaca — daftar,
 * worklist, dan halaman arsip — menganggap setiap dokumen punya versi berjalan. Membiarkan
 * dokumennya tertinggal ketika versinya gagal ditulis akan membuat keadaan itu ada di basis data
 * tanpa ada satu pun layar yang dapat menampilkannya.
 */
export async function createCompanyDocument(input: CreateCompanyDocumentInput, actor: ArchiveActor) {
  const title = input.title.trim();
  if (!title) throw new Error("Judul dokumen wajib diisi.");
  assertValidityRange(input.validFrom, input.validUntil);

  const db = await databaseOrThrow();
  await assertUsableArchiveFile(db, input.operationalDocumentId);
  await assertResponsibleEmployee(db, input.responsibleEmployeeId);

  const created = await db.transaction(async (tx) => {
    const [document] = await tx.insert(companyDocuments).values({
      category: input.category,
      title,
      referenceNumber: input.referenceNumber?.trim() || null,
      responsibleEmployeeId: input.responsibleEmployeeId ?? null,
      notes: input.notes?.trim() || null,
      createdByUserId: actor.id,
    }).$returningId();

    await tx.insert(companyDocumentVersions).values({
      companyDocumentId: document.id,
      versionNumber: 1,
      operationalDocumentId: input.operationalDocumentId,
      validFrom: input.validFrom,
      validUntil: input.validUntil ?? null,
      // Versi pertama tidak perlu alasan perubahan; belum ada yang diubah.
      changeReason: null,
      supersededAt: null,
      uploadedByUserId: actor.id,
    });

    return document;
  });

  await writeAudit({
    actorUserId: actor.id,
    action: "COMPANY_DOCUMENT_CREATED",
    entityType: "company_documents",
    entityId: String(created.id),
    afterState: {
      category: input.category,
      title,
      referenceNumber: input.referenceNumber?.trim() || null,
      responsibleEmployeeId: input.responsibleEmployeeId ?? null,
      validFrom: input.validFrom,
      validUntil: input.validUntil ?? null,
      operationalDocumentId: input.operationalDocumentId,
    },
  });

  return created;
}

/**
 * Versi berikutnya sebuah dokumen: menutup versi berjalan dan menyisipkan yang baru, dalam satu
 * transaksi.
 *
 * Alasan perubahan **wajib** di sini (keputusan pengguna 7). Riwayat versi tanpa alasan menjawab
 * "apa yang berubah" tetapi tidak pernah menjawab "mengapa", dan pertanyaan kedua itulah yang
 * diajukan pemeriksa.
 */
export async function addCompanyDocumentVersion(input: AddCompanyDocumentVersionInput, actor: ArchiveActor) {
  const changeReason = input.changeReason?.trim();
  if (!changeReason) throw new Error("Alasan perubahan wajib diisi saat mengganti versi dokumen.");
  assertValidityRange(input.validFrom, input.validUntil);

  const db = await databaseOrThrow();
  const [document] = await db
    .select({ id: companyDocuments.id, title: companyDocuments.title, deactivatedAt: companyDocuments.deactivatedAt })
    .from(companyDocuments)
    .where(eq(companyDocuments.id, input.companyDocumentId))
    .limit(1);
  if (!document) throw new Error("Dokumen arsip tidak ditemukan.");
  if (document.deactivatedAt) throw new Error("Dokumen sudah nonaktif; aktifkan kembali sebelum mengganti versinya.");

  await assertUsableArchiveFile(db, input.operationalDocumentId);

  const [current] = await db
    .select({ id: companyDocumentVersions.id, versionNumber: companyDocumentVersions.versionNumber })
    .from(companyDocumentVersions)
    .where(eq(companyDocumentVersions.companyDocumentId, input.companyDocumentId))
    .orderBy(desc(companyDocumentVersions.versionNumber))
    .limit(1);

  const supersededAt = new Date();
  const versionNumber = (current?.versionNumber ?? 0) + 1;

  const created = await db.transaction(async (tx) => {
    if (current) {
      await tx.update(companyDocumentVersions)
        .set({ supersededAt })
        .where(and(eq(companyDocumentVersions.companyDocumentId, input.companyDocumentId), isNull(companyDocumentVersions.supersededAt)));
    }

    const [version] = await tx.insert(companyDocumentVersions).values({
      companyDocumentId: input.companyDocumentId,
      versionNumber,
      operationalDocumentId: input.operationalDocumentId,
      validFrom: input.validFrom,
      validUntil: input.validUntil ?? null,
      changeReason,
      supersededAt: null,
      uploadedByUserId: actor.id,
    }).$returningId();

    return version;
  });

  await writeAudit({
    actorUserId: actor.id,
    action: "COMPANY_DOCUMENT_VERSION_ADDED",
    entityType: "company_document_versions",
    entityId: String(created.id),
    reason: changeReason,
    afterState: {
      companyDocumentId: input.companyDocumentId,
      versionNumber,
      operationalDocumentId: input.operationalDocumentId,
      validFrom: input.validFrom,
      validUntil: input.validUntil ?? null,
    },
  });

  return created;
}

/**
 * Menonaktifkan sebuah dokumen. **Tidak menghapus apa pun** — keputusan pengguna 3.
 *
 * Alasannya wajib: penonaktifan tanpa alasan pada berkas pemeriksaan hanya terbaca sebagai dokumen
 * yang hilang.
 */
export async function deactivateCompanyDocument(input: { companyDocumentId: number; reason: string }, actor: ArchiveActor) {
  const reason = input.reason?.trim();
  if (!reason) throw new Error("Alasan penonaktifan wajib diisi.");

  const db = await databaseOrThrow();
  const [document] = await db
    .select({ id: companyDocuments.id, title: companyDocuments.title, deactivatedAt: companyDocuments.deactivatedAt })
    .from(companyDocuments)
    .where(eq(companyDocuments.id, input.companyDocumentId))
    .limit(1);
  if (!document) throw new Error("Dokumen arsip tidak ditemukan.");
  if (document.deactivatedAt) throw new Error("Dokumen sudah nonaktif.");

  const deactivatedAt = new Date();
  await db.update(companyDocuments)
    .set({ deactivatedAt, deactivatedByUserId: actor.id, deactivationReason: reason })
    .where(eq(companyDocuments.id, input.companyDocumentId));

  await writeAudit({
    actorUserId: actor.id,
    action: "COMPANY_DOCUMENT_DEACTIVATED",
    entityType: "company_documents",
    entityId: String(input.companyDocumentId),
    reason,
    beforeState: { title: document.title, deactivatedAt: null },
    afterState: { title: document.title, deactivatedAt, deactivatedByUserId: actor.id },
  });
}
