import { and, desc, eq } from "drizzle-orm";
import { customers, exchangeTransactions, operationalDocuments } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ACCEPTED_DOCUMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type OperationalDocumentType = "KTP_PHOTO" | "UNDERLYING" | "UNDERLYING_FORM" | "UNDERLYING_STATEMENT" | "UNDERLYING_INVOICE" | "COMPANY_LOGO" | "LICENSE_CERTIFICATE" | "LICENSE_ATTACHMENT";
const COMPANY_DOCUMENT_TYPES = new Set<OperationalDocumentType>(["COMPANY_LOGO", "LICENSE_CERTIFICATE", "LICENSE_ATTACHMENT"]);

type UploadDocumentInput = {
  documentType: OperationalDocumentType;
  customerId?: number;
  transactionId?: number;
  originalFileName: string;
  mimeType: string;
  byteSize: number;
  data: Buffer;
  documentReference?: string;
  notes?: string;
};

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  return db;
}

function cleanFileName(value: string) {
  const cleaned = value.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 180);
  return cleaned || "dokumen";
}

export function decodeOperationalDocumentData(value: string) {
  const encoded = value.replace(/^data:[^;]+;base64,/, "").trim();
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("File dokumen tidak valid.");
  const data = Buffer.from(encoded, "base64");
  if (!data.length || data.length > MAX_DOCUMENT_BYTES) throw new Error("Ukuran dokumen harus antara 1 byte dan 8 MB.");
  return data;
}

export function assertAcceptedOperationalDocument(mimeType: string, data: Buffer, byteSize: number) {
  if (!ACCEPTED_DOCUMENT_MIME_TYPES.has(mimeType)) throw new Error("Format dokumen harus JPG, PNG, WEBP, atau PDF.");
  if (data.byteLength !== byteSize) throw new Error("Ukuran dokumen tidak konsisten.");
}

export async function uploadOperationalDocument(input: UploadDocumentInput, actorUserId: number) {
  const db = await databaseOrThrow();
  assertAcceptedOperationalDocument(input.mimeType, input.data, input.byteSize);
  const isCompanyDoc = COMPANY_DOCUMENT_TYPES.has(input.documentType);
  const isKtp = input.documentType === "KTP_PHOTO";
  if (!isCompanyDoc && (isKtp ? !input.customerId || input.transactionId : !input.transactionId || input.customerId)) {
    throw new Error(isKtp ? "Foto KTP harus terhubung ke satu nasabah." : "Underlying harus terhubung ke satu draft transaksi.");
  }
  if (isCompanyDoc && (input.customerId || input.transactionId)) throw new Error("Dokumen profil perusahaan tidak boleh terhubung ke nasabah atau transaksi.");

  if (input.customerId) {
    const customer = (await db.select({ id: customers.id }).from(customers).where(and(
      eq(customers.id, input.customerId), eq(customers.isDemo, false), eq(customers.isHistorical, false),
    )).limit(1))[0];
    if (!customer) throw new Error("Nasabah live tidak ditemukan untuk dokumen KTP.");
  }

  if (input.transactionId) {
    const transaction = (await db.select({ id: exchangeTransactions.id, status: exchangeTransactions.status }).from(exchangeTransactions).where(and(
      eq(exchangeTransactions.id, input.transactionId), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false),
    )).limit(1))[0];
    if (!transaction) throw new Error("Draft transaksi live tidak ditemukan untuk dokumen underlying.");
    if (!(["DRAFT", "RETURNED"] as const).includes(transaction.status as "DRAFT" | "RETURNED")) {
      throw new Error("Underlying hanya dapat ditambahkan pada draft atau transaksi yang dikembalikan.");
    }
  }

  const fileName = cleanFileName(input.originalFileName);
  const ownerPath = isCompanyDoc ? "perusahaan" : input.customerId ? `nasabah-${input.customerId}` : `transaksi-${input.transactionId}`;
  const { key } = await storagePut(`operasional/${ownerPath}/${Date.now()}-${fileName}`, input.data, input.mimeType);
  await db.insert(operationalDocuments).values({
    ownerType: isCompanyDoc ? "COMPANY" : isKtp ? "CUSTOMER" : "TRANSACTION",
    documentType: input.documentType,
    customerId: input.customerId ?? null,
    transactionId: input.transactionId ?? null,
    storageKey: key,
    originalFileName: fileName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    documentReference: input.documentReference?.trim() || null,
    notes: input.notes?.trim() || null,
    uploadedByUserId: actorUserId,
  });
  const created = (await db.select().from(operationalDocuments).where(eq(operationalDocuments.storageKey, key)).limit(1))[0];
  if (!created) throw new Error("Metadata dokumen tidak dapat disimpan.");
  return created;
}

export async function listOperationalDocuments(input: { customerId?: number; transactionId?: number }) {
  const db = await databaseOrThrow();
  if (!input.customerId && !input.transactionId) return [];
  return input.customerId
    ? db.select().from(operationalDocuments).where(eq(operationalDocuments.customerId, input.customerId)).orderBy(desc(operationalDocuments.createdAt))
    : db.select().from(operationalDocuments).where(eq(operationalDocuments.transactionId, input.transactionId!)).orderBy(desc(operationalDocuments.createdAt));
}

export async function listCompanyDocuments() {
  const db = await databaseOrThrow();
  return db.select().from(operationalDocuments).where(eq(operationalDocuments.ownerType, "COMPANY")).orderBy(desc(operationalDocuments.createdAt));
}

export async function deleteCompanyDocument(documentId: number) {
  const db = await databaseOrThrow();
  const document = (await db.select().from(operationalDocuments).where(and(eq(operationalDocuments.id, documentId), eq(operationalDocuments.ownerType, "COMPANY"))).limit(1))[0];
  if (!document) throw new Error("Dokumen tidak ditemukan.");
  await db.delete(operationalDocuments).where(eq(operationalDocuments.id, documentId));
}

export async function getOperationalDocumentDownloadUrl(documentId: number) {
  const db = await databaseOrThrow();
  const document = (await db.select().from(operationalDocuments).where(eq(operationalDocuments.id, documentId)).limit(1))[0];
  if (!document) throw new Error("Dokumen tidak ditemukan.");
  return storageGetSignedUrl(document.storageKey);
}
