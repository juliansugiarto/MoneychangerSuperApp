import { eq } from "drizzle-orm";
import { companyProfile, operationalDocuments } from "../drizzle/schema";
import { isRoleAllowed, type BackOfficeRole } from "../shared/backOfficeNavigation";
import { databaseOrThrow, writeAudit } from "./operations";

/**
 * Dokumen profil perusahaan (`ownerType = "COMPANY"`: logo, sertifikat dan lampiran izin usaha) —
 * pengganti `deleteCompanyDocument`, satu-satunya jalur penghapusan sungguhan yang dulu tersisa.
 *
 * Polanya meniru arsip Paket I (`server/companyDocumentArchive.ts`): **dinonaktifkan, bukan
 * dihapus**, dengan alasan tertulis dan jejak audit. Hapus permanen tetap ada, tetapi hanya untuk
 * Pemegang Saham, dan auditnya ditulis sebelum barisnya lenyap.
 *
 * Dokumen ini **bukan** dokumen Pasal 48 PBI 10/2024 — pasal itu hanya mengikat data Pengguna Jasa
 * dan Transaksi keuangan Pengguna Jasa. Dokumen `CUSTOMER` dan `TRANSACTION` tidak punya jalur
 * nonaktif maupun hapus sama sekali; `server/documentRetentionGuard.test.ts` menjaganya.
 *
 * Penegakan gerbangnya di penulis, bukan hanya di router — preseden `decideHighRisk`. Gerbang di
 * router menjaga layar; penulisnya yang menjaga data.
 */

type GateUser = { role: string; mustChangePassword: boolean };
type Denial = { status: 403; message: string } | null;
type DocumentActor = GateUser & { id: number };
type Db = Awaited<ReturnType<typeof databaseOrThrow>>;

/** Menonaktifkan: CONTROLLER ke atas, sama seperti ambang mengunggahnya. */
export function companyProfileDocumentDeactivationDenial(user: GateUser): Denial {
  if (user.mustChangePassword) return { status: 403, message: "Ganti kata sandi terlebih dahulu sebelum menonaktifkan dokumen." };
  if (!isRoleAllowed(user.role as BackOfficeRole, "CONTROLLER")) {
    return { status: 403, message: "Hanya Controller ke atas yang dapat menonaktifkan dokumen profil perusahaan." };
  }
  return null;
}

/**
 * Menghapus permanen: **hanya SHAREHOLDER**, Controller sekalipun tidak. Keputusan pengguna
 * 11 September 2026 — jalur ini ada untuk berkas salah unggah yang memuat data pribadi pihak lain,
 * bukan untuk kerapian.
 */
export function companyProfileDocumentPurgeDenial(user: GateUser): Denial {
  if (user.mustChangePassword) return { status: 403, message: "Ganti kata sandi terlebih dahulu sebelum menghapus dokumen." };
  if (!isRoleAllowed(user.role as BackOfficeRole, "SHAREHOLDER")) {
    return { status: 403, message: "Hanya Pemegang Saham yang dapat menghapus permanen dokumen profil perusahaan." };
  }
  return null;
}

function assertAllowed(denial: Denial) {
  if (denial) throw new Error(denial.message);
}

/** Penjaga bersama: hanya `COMPANY`, dan bukan logo yang sedang dipakai. */
async function loadPurgeableDocument(db: Db, documentId: number) {
  const [document] = await db.select().from(operationalDocuments)
    .where(eq(operationalDocuments.id, documentId)).limit(1);
  if (!document) throw new Error("Dokumen tidak ditemukan.");
  if (document.ownerType !== "COMPANY") {
    throw new Error("Hanya dokumen profil perusahaan yang dapat dinonaktifkan atau dihapus. Dokumen nasabah dan transaksi wajib ditatausahakan (Pasal 48 PBI 10/2024).");
  }
  const [profile] = await db.select({ logoDocumentId: companyProfile.logoDocumentId }).from(companyProfile).limit(1);
  if (profile?.logoDocumentId === documentId) {
    throw new Error("Logo yang sedang dipakai tidak dapat dinonaktifkan atau dihapus. Ganti logonya lebih dulu.");
  }
  return document;
}

/**
 * Menonaktifkan sebuah dokumen profil perusahaan. **Tidak menghapus apa pun.** Alasannya wajib:
 * dokumen yang lenyap dari layar tanpa alasan hanya terbaca sebagai dokumen yang hilang.
 */
export async function deactivateCompanyProfileDocument(input: { documentId: number; reason: string }, actor: DocumentActor) {
  assertAllowed(companyProfileDocumentDeactivationDenial(actor));
  const reason = input.reason?.trim();
  if (!reason) throw new Error("Alasan penonaktifan wajib diisi.");

  const db = await databaseOrThrow();
  const document = await loadPurgeableDocument(db, input.documentId);
  if (document.deactivatedAt) throw new Error("Dokumen sudah nonaktif.");

  const deactivatedAt = new Date();
  await db.update(operationalDocuments)
    .set({ deactivatedAt, deactivatedByUserId: actor.id, deactivationReason: reason })
    .where(eq(operationalDocuments.id, input.documentId));

  await writeAudit({
    actorUserId: actor.id,
    action: "COMPANY_PROFILE_DOCUMENT_DEACTIVATED",
    entityType: "operational_documents",
    entityId: String(input.documentId),
    reason,
    beforeState: { originalFileName: document.originalFileName, documentType: document.documentType, deactivatedAt: null },
    afterState: { originalFileName: document.originalFileName, deactivatedAt, deactivatedByUserId: actor.id },
  });
}

/**
 * Menghapus permanen baris metadata sebuah dokumen profil perusahaan.
 *
 * Auditnya ditulis **sebelum** `DELETE` dan memuat metadata lengkap berkasnya — sesudah barisnya
 * lenyap, `audit_logs` adalah satu-satunya tempat jejaknya bisa hidup. Bila audit gagal ditulis,
 * barisnya tidak dihapus.
 */
export async function purgeCompanyProfileDocument(input: { documentId: number; reason: string }, actor: DocumentActor) {
  assertAllowed(companyProfileDocumentPurgeDenial(actor));
  const reason = input.reason?.trim();
  if (!reason) throw new Error("Alasan penghapusan permanen wajib diisi.");

  const db = await databaseOrThrow();
  const document = await loadPurgeableDocument(db, input.documentId);

  await writeAudit({
    actorUserId: actor.id,
    action: "COMPANY_PROFILE_DOCUMENT_PURGED",
    entityType: "operational_documents",
    entityId: String(input.documentId),
    reason,
    beforeState: {
      documentType: document.documentType, originalFileName: document.originalFileName,
      storageKey: document.storageKey, mimeType: document.mimeType, byteSize: document.byteSize,
      documentReference: document.documentReference, notes: document.notes,
      uploadedByUserId: document.uploadedByUserId, createdAt: document.createdAt,
      deactivatedAt: document.deactivatedAt, deactivatedByUserId: document.deactivatedByUserId,
      deactivationReason: document.deactivationReason,
    },
    // Jujur, bukan kosmetik: `server/storage.ts` tidak punya penghapus objek, jadi berkasnya
    // tertinggal di penyimpanan (keputusan pengguna 11 September 2026: berkas yatim dibiarkan).
    metadata: { storageObjectRetained: true },
  });

  await db.delete(operationalDocuments).where(eq(operationalDocuments.id, input.documentId));
}
