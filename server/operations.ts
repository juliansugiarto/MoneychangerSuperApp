import Decimal from "decimal.js";
import { and, desc, eq, gt, gte, inArray, isNull, like, lt, lte, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import {
  auditLogs,
  bankAccountMovements,
  bankAccounts,
  companyProfile,
  cashBalanceMovements,
  cashBalances,
  cashDenominationBalances,
  cashDenominationEntries,
  consumerComplaints,
  currencies,
  customers,
  dailyOperationalChecklists,
  directorAcknowledgements,
  exchangeTransactionDenominationEntries,
  exchangeTransactionLines,
  exchangeTransactionPaymentDenominations,
  exchangeTransactions,
  financialStatementSnapshots,
  operationalRates,
  operationalDocuments,
  operationalSettings,
  publicAnnouncements,
  marketRateObservations,
  rateReferenceSnapshots,
  rateVolatilityAlerts,
  regulatoryReportPackages,
  regulatoryIncidentReports,
  serviceRequests,
  stockOpnames,
  transactionReviewActions,
  type StaffRole,
} from "../drizzle/schema";
import { getDb } from "./db";
import { knownDenominationsFor } from "../shared/currencyDenominations";
import { isKnownSuspiciousIndicatorCode } from "../shared/suspiciousTransactionIndicators";

/** Rejects a denomination value that doesn't match a real banknote/coin for this currency (when we have a curated list — see shared/currencyDenominations.ts). Never trust the client alone here: this is exactly the check that stops a typo like "IDR 131250000 × 1 lembar" from being recorded as if it were a real note. */
function assertKnownDenomination(value: Decimal, currencyCode: string | undefined, label: string) {
  const known = knownDenominationsFor(currencyCode);
  if (!known) return;
  const matches = known.some((denomination) => value.eq(denomination));
  if (!matches) throw new Error(`Nilai pecahan ${value.toFixed(0)} bukan pecahan ${currencyCode} yang dikenal pada ${label}. Pecahan yang berlaku: ${known.join(", ")}.`);
}

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const DEFAULT_REVIEW_THRESHOLD_USD = "10000.00";
const DEFAULT_EDD_CASH_DAILY_THRESHOLD_IDR = "100000000.00";
const DEFAULT_RATE_SHOCK_THRESHOLD_PERCENT = "1.5000";
const OPENING_CHECKLIST_KEYS = ["modalKerjaDiterima", "alatUvSiap", "mesinHitungSiap", "kasAwalDicatat"] as const;
const CLOSING_CHECKLIST_KEYS = ["opnameFisikDilakukan", "kasDirekonsiliasi", "uangDiserahterimakan", "brankasDikunci"] as const;

function emptyChecklist(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, false]));
}

function normalizeChecklist(checks: Record<string, unknown> | null | undefined, keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, checks?.[key] === true]));
}

function isChecklistComplete(checks: Record<string, boolean>, keys: readonly string[]) {
  return keys.every((key) => checks[key] === true);
}

type AuditEntry = {
  actorUserId: number | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) {
    const error = new Error("Database tidak tersedia. Coba ulangi tindakan ini.") as Error & { code?: string };
    error.code = "DATABASE_UNAVAILABLE";
    throw error;
  }
  return db;
}

function isTransientDatabaseFailure(error: unknown) {
  const values: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth += 1) {
    const record = current as { message?: unknown; code?: unknown; cause?: unknown };
    if (typeof record.message === "string") values.push(record.message);
    if (typeof record.code === "string") values.push(record.code);
    current = record.cause;
  }
  const text = values.join(" ");
  return /DATABASE_UNAVAILABLE|EAI_AGAIN|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|PROTOCOL_CONNECTION_LOST/i.test(text);
}

/** Retries a read once for temporary DNS or connection failures; never retries writes. */
export async function retryTransientDatabaseRead<T>(operation: () => Promise<T>, retryDelayMs = 200): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDatabaseFailure(error)) throw error;
    console.warn("[Database] Transient read failure; retrying once.", error);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return operation();
  }
}

/**
 * A checklist may be created by a concurrent browser request for the same
 * Jakarta business date. Re-read briefly after a failed insert; this retries
 * reads only and never repeats the write.
 */
export async function waitForConcurrentInitialization<T>(read: () => Promise<T | undefined>, attempts = 3, retryDelayMs = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await read();
    if (value) return value;
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
  return undefined;
}

async function writeAudit(entry: AuditEntry) {
  const db = await databaseOrThrow();
  await db.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeState: entry.beforeState ?? null,
    afterState: entry.afterState ?? null,
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? null,
  });
}

function nonNegativeDecimal(value: string, label: string) {
  let parsed: Decimal;
  try {
    parsed = new Decimal(value);
  } catch {
    throw new Error(`${label} harus berupa angka desimal yang valid.`);
  }
  if (!parsed.isFinite() || parsed.lte(0)) throw new Error(`${label} harus lebih besar dari nol.`);
  return parsed;
}

function nonNegativeOrZeroDecimal(value: string, label: string) {
  let parsed: Decimal;
  try {
    parsed = new Decimal(value);
  } catch {
    throw new Error(`${label} harus berupa angka desimal yang valid.`);
  }
  if (!parsed.isFinite() || parsed.lt(0)) throw new Error(`${label} tidak boleh bernilai negatif.`);
  return parsed;
}

/** Converts a foreign-currency amount to Rupiah without IEEE-754 floating-point math. */
export function calculateRupiahAmount(foreignAmount: string, rate: string, quoteUnit: string) {
  const foreign = nonNegativeDecimal(foreignAmount, "Nominal valuta");
  const rateDecimal = nonNegativeDecimal(rate, "Kurs");
  const unit = nonNegativeDecimal(quoteUnit, "Satuan kuotasi");
  return foreign.mul(rateDecimal).div(unit).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function calculateStockVariance(physicalBalance: string, systemBalance: string) {
  const physical = nonNegativeOrZeroDecimal(physicalBalance, "Saldo fisik");
  const system = nonNegativeOrZeroDecimal(systemBalance, "Saldo sistem");
  return physical.minus(system).toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6);
}

export function calculateCashBalanceAfter(operation: "BUY" | "SELL", currentBalance: string, foreignAmount: string) {
  const before = nonNegativeOrZeroDecimal(currentBalance, "Saldo kas");
  const amount = nonNegativeDecimal(foreignAmount, "Nominal valuta");
  if (operation === "SELL" && before.lt(amount)) throw new Error("Saldo valuta tidak mencukupi untuk menyelesaikan transaksi SELL.");
  return (operation === "BUY" ? before.plus(amount) : before.minus(amount)).toFixed(6);
}

export function captureRateSnapshot(rate: string, quoteUnit: string) {
  return {
    rateSnapshot: nonNegativeDecimal(rate, "Kurs").toFixed(6),
    quoteUnitSnapshot: nonNegativeDecimal(quoteUnit, "Satuan kuotasi").toFixed(6),
  };
}

export function normalizeReviewThreshold(value: string) {
  return nonNegativeDecimal(value, "Ambang review USD").toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function normalizeEddCashDailyThreshold(value: string) {
  return nonNegativeDecimal(value, "Ambang EDD tunai harian Rupiah").toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function normalizeRateShockThreshold(value: string) {
  return nonNegativeDecimal(value, "Ambang perubahan kurs").toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

/** LTKT (Laporan Transaksi Keuangan Tunai) to PPATK — a fixed regulatory threshold, not an
 * operator-tunable risk setting like the EDD cash threshold above, so it's a constant rather than
 * something read from operational_settings. Applies to cash transactions only (bank transfers leave
 * their own trail at the bank). */
const LTKT_CASH_THRESHOLD_IDR = "500000000.00";

export function assessReviewRequirement(input: {
  rupiahAmount: string;
  thresholdUsd: string;
  usdSellRate?: string | null;
  usdQuoteUnit?: string | null;
  cashDailyRupiahTotal?: string | null;
  eddCashDailyThresholdIdr?: string | null;
  isCashPayment?: boolean;
  profileStatus: "ACTIVE" | "INACTIVE" | "RESTRICTED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}) {
  const usdEquivalent = input.usdSellRate && input.usdQuoteUnit
    ? new Decimal(input.rupiahAmount).mul(input.usdQuoteUnit).div(input.usdSellRate)
    : null;
  const exceedsThreshold = usdEquivalent ? usdEquivalent.gte(new Decimal(input.thresholdUsd)) : false;
  const exceedsCashDailyEdd = input.isCashPayment && input.cashDailyRupiahTotal && input.eddCashDailyThresholdIdr
    ? new Decimal(input.cashDailyRupiahTotal).gte(new Decimal(input.eddCashDailyThresholdIdr))
    : false;
  const ltktThreshold = new Decimal(LTKT_CASH_THRESHOLD_IDR);
  const meetsLtktThreshold = Boolean(input.isCashPayment) && (
    new Decimal(input.rupiahAmount).gte(ltktThreshold)
    || (input.cashDailyRupiahTotal ? new Decimal(input.cashDailyRupiahTotal).gte(ltktThreshold) : false)
  );
  const profileMismatch = input.profileStatus === "RESTRICTED" || input.riskLevel === "HIGH";
  const reviewReason = [
    exceedsThreshold ? "NILAI_SETARA_USD_MELEBIHI_AMBANG" : null,
    exceedsCashDailyEdd ? "AKUMULASI_TRANSAKSI_TUNAI_HARIAN_MEMENUHI_AMBANG_EDD" : null,
    meetsLtktThreshold ? "MEMENUHI_AMBANG_LTKT_PPATK" : null,
    input.profileStatus === "RESTRICTED" ? "PROFIL_NASABAH_RESTRICTED" : null,
    input.riskLevel === "HIGH" ? "RISIKO_NASABAH_TINGGI" : null,
  ].filter(Boolean).join("; ") || null;
  return { requiresReview: exceedsThreshold || exceedsCashDailyEdd || profileMismatch, reviewReason, usdEquivalent: usdEquivalent?.toFixed(6) ?? null, meetsLtktThreshold, exceedsThreshold };
}

export function submissionTransition(status: "DRAFT" | "RETURNED", requiresReview: boolean) {
  return requiresReview
    ? { status: "PENDING_REVIEW" as const, reviewStatus: "NEEDS_REVIEW" as const }
    : { status: "APPROVED" as const, reviewStatus: "NOT_REVIEWED" as const };
}

export function assertTransactionCanBeCancelled(status: string) {
  if (["COMPLETED", "CANCELLED"].includes(status)) throw new Error("Transaksi yang selesai atau sudah dibatalkan tidak dapat dibatalkan.");
}

type ComplaintStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "ESCALATED_LAPS_BI";

export function assertComplaintStatusTransition(current: ComplaintStatus, next: ComplaintStatus, resolution?: string) {
  if (["RESOLVED", "ESCALATED_LAPS_BI"].includes(current)) throw new Error("Pengaduan yang sudah memiliki hasil akhir tidak dapat diubah lagi.");
  if (next === "OPEN") throw new Error("Pengaduan tidak dapat dikembalikan ke status awal.");
  if (["RESOLVED", "ESCALATED_LAPS_BI"].includes(next) && !resolution?.trim()) throw new Error("Catatan penyelesaian atau alasan eskalasi wajib diisi.");
}

export async function listConsumerComplaints() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(consumerComplaints).orderBy(desc(consumerComplaints.createdAt));
  });
}

export async function createConsumerComplaint(input: {
  reporterName: string;
  reporterIdentityNumber: string;
  reporterPhone: string;
  reporterEmail?: string;
  transactionAt?: Date;
  receiptNumber?: string;
  transactionDetails?: string;
  chronology: string;
  supportingDocuments?: string;
  category: "CASH_COUNT" | "BOARD_RATE" | "STAFF_SERVICE" | "OTHER";
}, actorUserId: number) {
  const db = await databaseOrThrow();
  const complaintNumber = `PGD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nanoid(6).toUpperCase()}`;
  await db.insert(consumerComplaints).values({
    complaintNumber,
    reporterName: input.reporterName.trim(),
    reporterIdentityNumber: input.reporterIdentityNumber.trim(),
    reporterPhone: input.reporterPhone.trim(),
    reporterEmail: input.reporterEmail?.trim() || null,
    transactionAt: input.transactionAt ?? null,
    receiptNumber: input.receiptNumber?.trim() || null,
    transactionDetails: input.transactionDetails?.trim() || null,
    chronology: input.chronology.trim(),
    supportingDocuments: input.supportingDocuments?.trim() || null,
    category: input.category,
    status: "OPEN",
    receivedByUserId: actorUserId,
  });
  const created = (await db.select().from(consumerComplaints).where(eq(consumerComplaints.complaintNumber, complaintNumber)).limit(1))[0];
  if (!created) throw new Error("Pengaduan tidak dapat dicatat.");
  await writeAudit({ actorUserId, action: "COMPLAINT_CREATED", entityType: "CONSUMER_COMPLAINT", entityId: String(created.id), afterState: { complaintNumber: created.complaintNumber, category: created.category, status: created.status } });
  return created;
}

export async function updateConsumerComplaint(input: { complaintId: number; status: ComplaintStatus; resolution?: string }, actorUserId: number) {
  const db = await databaseOrThrow();
  const current = (await db.select().from(consumerComplaints).where(eq(consumerComplaints.id, input.complaintId)).limit(1))[0];
  if (!current) throw new Error("Pengaduan tidak ditemukan.");
  assertComplaintStatusTransition(current.status, input.status, input.resolution);
  const isFinal = input.status === "RESOLVED" || input.status === "ESCALATED_LAPS_BI";
  await db.update(consumerComplaints).set({ status: input.status, resolution: input.resolution?.trim() || null, resolvedByUserId: isFinal ? actorUserId : null, resolvedAt: isFinal ? new Date() : null }).where(eq(consumerComplaints.id, input.complaintId));
  const updated = (await db.select().from(consumerComplaints).where(eq(consumerComplaints.id, input.complaintId)).limit(1))[0];
  if (!updated) throw new Error("Pengaduan tidak dapat diperbarui.");
  await writeAudit({ actorUserId, action: "COMPLAINT_STATUS_UPDATED", entityType: "CONSUMER_COMPLAINT", entityId: String(updated.id), beforeState: { status: current.status }, afterState: { status: updated.status }, reason: updated.resolution });
  if (isFinal) {
    await createDirectorKnowledgeItem({
      eventType: "CONSUMER_COMPLAINT",
      entityType: "consumer_complaint",
      entityId: String(updated.id),
      title: `Pengaduan ${updated.complaintNumber} ${updated.status === "RESOLVED" ? "diselesaikan" : "dieskalasi"}`,
      detail: updated.resolution ?? "Pengaduan telah mencapai status akhir dan memerlukan pengetahuan Direksi.",
      createdByUserId: actorUserId,
    });
  }
  return updated;
}

type ServiceRequestStatus = "BARU" | "MENUNGGU_VERIFIKASI" | "KURS_DIKONFIRMASI" | "SIAP_DILAYANI" | "KEDALUWARSA" | "DIBATALKAN";

const SERVICE_REQUEST_TERMINAL_STATUSES: ServiceRequestStatus[] = ["KEDALUWARSA", "DIBATALKAN"];

export function assertServiceRequestStatusTransition(current: ServiceRequestStatus, next: ServiceRequestStatus) {
  if (SERVICE_REQUEST_TERMINAL_STATUSES.includes(current)) throw new Error("Permintaan layanan yang sudah berakhir tidak dapat diubah lagi.");
  if (next === "BARU") throw new Error("Permintaan layanan tidak dapat dikembalikan ke status awal.");
  const allowed: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
    BARU: ["MENUNGGU_VERIFIKASI", "DIBATALKAN"],
    MENUNGGU_VERIFIKASI: ["KURS_DIKONFIRMASI", "DIBATALKAN"],
    KURS_DIKONFIRMASI: ["SIAP_DILAYANI", "KEDALUWARSA", "DIBATALKAN"],
    SIAP_DILAYANI: ["KEDALUWARSA", "DIBATALKAN"],
    KEDALUWARSA: [],
    DIBATALKAN: [],
  };
  if (!allowed[current].includes(next)) throw new Error(`Perubahan status dari ${current} ke ${next} tidak diizinkan.`);
}

export async function listServiceRequests() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select({ request: serviceRequests, currency: currencies }).from(serviceRequests)
      .innerJoin(currencies, eq(serviceRequests.currencyId, currencies.id))
      .orderBy(desc(serviceRequests.createdAt));
  });
}

export async function createPublicServiceRequest(input: {
  requesterName: string;
  contactChannel: "PHONE" | "WHATSAPP" | "EMAIL";
  contactValue: string;
  currencyId: number;
  operation: "BUY" | "SELL";
  foreignAmount: string;
  preferredServiceAt?: Date;
  contactConsent: boolean;
}) {
  const db = await databaseOrThrow();
  if (!input.contactConsent) throw new Error("Persetujuan untuk dihubungi diperlukan sebelum permintaan dikirim.");
  nonNegativeDecimal(input.foreignAmount, "Nominal indikatif");
  if (!new Decimal(input.foreignAmount).gt(0)) throw new Error("Nominal indikatif harus lebih besar dari nol.");
  if (input.preferredServiceAt && input.preferredServiceAt.getTime() < Date.now() - 60_000) throw new Error("Waktu kunjungan pilihan tidak boleh berada di masa lalu.");
  const currency = (await db.select().from(currencies).where(and(eq(currencies.id, input.currencyId), eq(currencies.active, true))).limit(1))[0];
  if (!currency) throw new Error("Mata uang tidak tersedia untuk permintaan layanan.");
  const requestNumber = `LNY-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nanoid(6).toUpperCase()}`;
  await db.insert(serviceRequests).values({
    requestNumber,
    requesterName: input.requesterName.trim(),
    contactChannel: input.contactChannel,
    contactValue: input.contactValue.trim(),
    currencyId: input.currencyId,
    operation: input.operation,
    foreignAmount: input.foreignAmount.trim(),
    preferredServiceAt: input.preferredServiceAt ?? null,
    contactConsent: true,
    status: "BARU",
  });
  const created = (await db.select().from(serviceRequests).where(eq(serviceRequests.requestNumber, requestNumber)).limit(1))[0];
  if (!created) throw new Error("Permintaan layanan tidak dapat dicatat.");
  await writeAudit({ actorUserId: null, action: "SERVICE_REQUEST_CREATED", entityType: "SERVICE_REQUEST", entityId: String(created.id), afterState: { requestNumber: created.requestNumber, currencyId: created.currencyId, operation: created.operation, status: created.status }, metadata: { public: true } });
  return { requestNumber: created.requestNumber, createdAt: created.createdAt };
}

export async function updateServiceRequest(input: {
  requestId: number;
  status: Exclude<ServiceRequestStatus, "BARU">;
  staffNotes?: string;
  confirmedOperationalRateId?: number;
  confirmedRateExpiresAt?: Date;
}, actorUserId: number) {
  const db = await databaseOrThrow();
  const current = (await db.select().from(serviceRequests).where(eq(serviceRequests.id, input.requestId)).limit(1))[0];
  if (!current) throw new Error("Permintaan layanan tidak ditemukan.");
  assertServiceRequestStatusTransition(current.status, input.status);

  let confirmedOperationalRateId: number | null = current.confirmedOperationalRateId;
  let confirmedRateExpiresAt: Date | null = current.confirmedRateExpiresAt;
  let confirmedByUserId: number | null = current.confirmedByUserId;
  let confirmedAt: Date | null = current.confirmedAt;

  if (input.status === "KURS_DIKONFIRMASI") {
    if (!input.confirmedOperationalRateId || !input.confirmedRateExpiresAt) throw new Error("Kurs aktif dan waktu kedaluwarsa harus dipilih saat mengonfirmasi kurs.");
    if (input.confirmedRateExpiresAt.getTime() <= Date.now()) throw new Error("Waktu kedaluwarsa kurs harus berada di masa depan.");
    const activeRate = (await db.select().from(operationalRates).where(and(
      eq(operationalRates.id, input.confirmedOperationalRateId),
      eq(operationalRates.currencyId, current.currencyId),
      eq(operationalRates.status, "ACTIVE"),
      eq(operationalRates.isDemo, false),
      eq(operationalRates.isHistorical, false),
    )).limit(1))[0];
    if (!activeRate) throw new Error("Kurs operasional aktif untuk mata uang ini tidak ditemukan.");
    confirmedOperationalRateId = activeRate.id;
    confirmedRateExpiresAt = input.confirmedRateExpiresAt;
    confirmedByUserId = actorUserId;
    confirmedAt = new Date();
  }

  await db.update(serviceRequests).set({
    status: input.status,
    assignedToUserId: actorUserId,
    staffNotes: input.staffNotes?.trim() || current.staffNotes,
    confirmedOperationalRateId,
    confirmedRateExpiresAt,
    confirmedByUserId,
    confirmedAt,
  }).where(eq(serviceRequests.id, input.requestId));
  const updated = (await db.select().from(serviceRequests).where(eq(serviceRequests.id, input.requestId)).limit(1))[0];
  if (!updated) throw new Error("Permintaan layanan tidak dapat diperbarui.");
  await writeAudit({ actorUserId, action: "SERVICE_REQUEST_STATUS_UPDATED", entityType: "SERVICE_REQUEST", entityId: String(updated.id), beforeState: { status: current.status }, afterState: { status: updated.status, assignedToUserId: updated.assignedToUserId, confirmedOperationalRateId: updated.confirmedOperationalRateId, confirmedRateExpiresAt: updated.confirmedRateExpiresAt }, reason: updated.staffNotes });
  return updated;
}

export async function listPublicAnnouncements() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const now = new Date();
    return db.select().from(publicAnnouncements).where(and(
      eq(publicAnnouncements.status, "PUBLISHED"),
      or(isNull(publicAnnouncements.expiresAt), gt(publicAnnouncements.expiresAt, now)),
    )).orderBy(desc(publicAnnouncements.publishedAt));
  });
}

export async function listPublicAnnouncementsForStaff() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(publicAnnouncements).orderBy(desc(publicAnnouncements.createdAt));
  });
}

export async function createPublicAnnouncement(input: { title: string; content: string; expiresAt?: Date }, actorUserId: number) {
  const db = await databaseOrThrow();
  await db.insert(publicAnnouncements).values({ title: input.title.trim(), content: input.content.trim(), expiresAt: input.expiresAt ?? null, createdByUserId: actorUserId, status: "DRAFT" });
  const created = (await db.select().from(publicAnnouncements).orderBy(desc(publicAnnouncements.id)).limit(1))[0];
  if (!created) throw new Error("Pengumuman tidak dapat dibuat.");
  await writeAudit({ actorUserId, action: "PUBLIC_ANNOUNCEMENT_CREATED", entityType: "PUBLIC_ANNOUNCEMENT", entityId: String(created.id), afterState: { title: created.title, status: created.status } });
  return created;
}

export async function updatePublicAnnouncement(input: { announcementId: number; title: string; content: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; expiresAt?: Date }, actorUserId: number) {
  const db = await databaseOrThrow();
  const current = (await db.select().from(publicAnnouncements).where(eq(publicAnnouncements.id, input.announcementId)).limit(1))[0];
  if (!current) throw new Error("Pengumuman tidak ditemukan.");
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now() && input.status === "PUBLISHED") throw new Error("Pengumuman publik tidak dapat diterbitkan dengan waktu kedaluwarsa di masa lalu.");
  const isNewlyPublished = input.status === "PUBLISHED" && current.status !== "PUBLISHED";
  await db.update(publicAnnouncements).set({
    title: input.title.trim(),
    content: input.content.trim(),
    status: input.status,
    expiresAt: input.expiresAt ?? null,
    publishedAt: isNewlyPublished ? new Date() : current.publishedAt,
    publishedByUserId: isNewlyPublished ? actorUserId : current.publishedByUserId,
  }).where(eq(publicAnnouncements.id, input.announcementId));
  const updated = (await db.select().from(publicAnnouncements).where(eq(publicAnnouncements.id, input.announcementId)).limit(1))[0];
  if (!updated) throw new Error("Pengumuman tidak dapat diperbarui.");
  await writeAudit({ actorUserId, action: "PUBLIC_ANNOUNCEMENT_UPDATED", entityType: "PUBLIC_ANNOUNCEMENT", entityId: String(updated.id), beforeState: { title: current.title, status: current.status }, afterState: { title: updated.title, status: updated.status, expiresAt: updated.expiresAt } });
  return updated;
}

export async function listCurrencies() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(currencies).orderBy(currencies.code);
  });
}

export async function createCurrency(input: { code: string; name: string; actorUserId: number }) {
  const db = await databaseOrThrow();
  const code = input.code.trim().toUpperCase();
  await db.insert(currencies).values({ code, name: input.name.trim(), active: true });
  const created = (await db.select().from(currencies).where(eq(currencies.code, code)).limit(1))[0];
  if (!created) throw new Error("Mata uang tidak dapat dibuat.");
  await writeAudit({ actorUserId: input.actorUserId, action: "CURRENCY_CREATED", entityType: "currency", entityId: String(created.id), afterState: { code: created.code, name: created.name, active: created.active } });
  return created;
}

/**
 * Registers a currency on first use, idempotently — lets a teller pick any world currency (GBP, IDR,
 * INR, ...) straight from the transaction/cash form without waiting on an Admin to pre-create it via
 * Kurs Operasional. Never touches operational rates; purely a reference-data lookup/insert.
 */
export async function ensureCurrency(input: { code: string; name: string }) {
  const db = await databaseOrThrow();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("Kode mata uang harus 3 huruf sesuai ISO 4217.");
  const existing = (await db.select().from(currencies).where(eq(currencies.code, code)).limit(1))[0];
  if (existing) return existing;
  await db.insert(currencies).values({ code, name: input.name.trim() || code, active: true }).onDuplicateKeyUpdate({ set: { code: sql`${currencies.code}` } });
  const created = (await db.select().from(currencies).where(eq(currencies.code, code)).limit(1))[0];
  if (!created) throw new Error("Mata uang tidak dapat didaftarkan.");
  return created;
}

export async function setCurrencyActive(input: { currencyId: number; active: boolean; actorUserId: number }) {
  const db = await databaseOrThrow();
  const existing = (await db.select().from(currencies).where(eq(currencies.id, input.currencyId)).limit(1))[0];
  if (!existing) throw new Error("Mata uang tidak ditemukan.");
  await db.update(currencies).set({ active: input.active }).where(eq(currencies.id, input.currencyId));
  await writeAudit({ actorUserId: input.actorUserId, action: input.active ? "CURRENCY_ACTIVATED" : "CURRENCY_DEACTIVATED", entityType: "currency", entityId: String(input.currencyId), beforeState: { active: existing.active }, afterState: { active: input.active } });
  return { ...existing, active: input.active };
}

export type BeneficialOwnerInput = {
  fullName: string;
  identityType: "KTP" | "PASSPORT" | "OTHER";
  identityNumber: string;
  phoneNumber?: string;
  address: string;
  occupation?: string;
  relationshipToCustomer: string;
};

export type CustomerInput = {
  cifNumber: string;
  fullName: string;
  phoneNumber: string;
  identityType: "KTP" | "PASSPORT" | "OTHER";
  identityNumber: string;
  /** Kosong/undefined berarti identitas berlaku seumur hidup (mis. eKTP). */
  identityExpiryDate?: Date;
  placeOfBirth: string;
  dateOfBirth: Date;
  address: string;
  occupation: string;
  sourceOfFunds: string;
  transactionPurpose: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  riskNotes?: string;
  /** Nasabah ini hanya bertindak atas nama pihak lain; identitas pemilik manfaat sebenarnya wajib disertakan. */
  hasBeneficialOwner?: boolean;
  beneficialOwner?: BeneficialOwnerInput;
  pepStatus?: "NONE" | "SELF" | "RELATED";
  pepDetails?: string;
  /** Kecocokan dengan DTTOT/PPSPM; bila true, wajib dilaporkan LTKM ke PPATK secara manual sesuai prosedur resmi. */
  dttotPpsdmMatch?: boolean;
  dttotPpsdmNotes?: string;
};

export async function listCustomers() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(customers).where(and(eq(customers.isDemo, false), eq(customers.isHistorical, false))).orderBy(desc(customers.updatedAt));
  });
}

/** Menyarankan nomor CIF berikutnya mengikuti pola `CIF-<urutan>` dari nasabah aktif tersimpan. Staf tetap dapat mengganti nilai ini secara manual sebelum disimpan. */
export async function getNextCifNumber() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return computeNextCifNumber(db);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeNextCifNumber(db: any) {
  const rows = await db.select({ cifNumber: customers.cifNumber }).from(customers).where(and(eq(customers.isDemo, false), eq(customers.isHistorical, false)));
  let maxSequence = 0;
  let padWidth = 6;
  for (const row of rows) {
    const match = row.cifNumber.match(/^CIF-(\d+)$/i);
    if (!match) continue;
    const sequence = Number.parseInt(match[1], 10);
    if (sequence > maxSequence) { maxSequence = sequence; padWidth = match[1].length; }
  }
  return `CIF-${String(maxSequence + 1).padStart(padWidth, "0")}`;
}

export async function searchCustomers(query: string, limit = 20) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const term = query.trim();
    if (term.length < 2) return [];
    return db.select({
      id: customers.id,
      cifNumber: customers.cifNumber,
      fullName: customers.fullName,
      phoneNumber: customers.phoneNumber,
      identityType: customers.identityType,
      identityNumber: customers.identityNumber,
      address: customers.address,
      occupation: customers.occupation,
      sourceOfFunds: customers.sourceOfFunds,
      profileStatus: customers.profileStatus,
      riskLevel: customers.riskLevel,
      transactionPurpose: customers.transactionPurpose,
      hasBeneficialOwner: customers.hasBeneficialOwner,
      beneficialOwnerCustomerId: customers.beneficialOwnerCustomerId,
    }).from(customers).where(and(
      eq(customers.isDemo, false),
      eq(customers.isHistorical, false),
      eq(customers.profileStatus, "ACTIVE"),
      or(
        like(customers.fullName, `%${term}%`),
        like(customers.cifNumber, `%${term}%`),
        like(customers.identityNumber, `%${term}%`),
      ),
    )).orderBy(customers.fullName).limit(Math.min(Math.max(limit, 1), 30));
  });
}

/** Fetches a single active, live customer row — used to pre-fill/confirm the representative (kuasa/wakil) picker from a linked beneficial owner. */
export async function getCustomerById(customerId: number) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const row = (await db.select({
      id: customers.id,
      cifNumber: customers.cifNumber,
      fullName: customers.fullName,
      phoneNumber: customers.phoneNumber,
      identityType: customers.identityType,
      identityNumber: customers.identityNumber,
      address: customers.address,
      occupation: customers.occupation,
      sourceOfFunds: customers.sourceOfFunds,
      profileStatus: customers.profileStatus,
      riskLevel: customers.riskLevel,
      transactionPurpose: customers.transactionPurpose,
    }).from(customers).where(and(eq(customers.id, customerId), eq(customers.isDemo, false), eq(customers.isHistorical, false))).limit(1))[0];
    if (!row) throw new Error("Nasabah tidak ditemukan.");
    return row;
  });
}

export async function createCustomer(input: CustomerInput, actorUserId: number) {
  if (input.hasBeneficialOwner && !input.beneficialOwner) throw new Error("Data pemilik manfaat (beneficial owner) wajib diisi.");
  if (input.pepStatus && input.pepStatus !== "NONE" && !input.pepDetails?.trim()) throw new Error("Keterangan PEP wajib diisi.");
  if (input.dttotPpsdmMatch && !input.dttotPpsdmNotes?.trim()) throw new Error("Catatan kecocokan DTTOT/PPSPM wajib diisi.");
  const cifNumber = input.cifNumber.trim().toUpperCase();
  const identityType = input.identityType;
  const identityNumber = input.identityNumber.trim().toUpperCase();
  if (input.hasBeneficialOwner && input.beneficialOwner && input.beneficialOwner.identityType === identityType && input.beneficialOwner.identityNumber.trim().toUpperCase() === identityNumber) {
    throw new Error("Pemilik manfaat (beneficial owner) tidak boleh sama dengan nasabah itu sendiri.");
  }
  const isHighRisk = Boolean(input.dttotPpsdmMatch);
  const db = await databaseOrThrow();
  const created = await db.transaction(async (tx) => {
    await tx.insert(customers).values({
      cifNumber,
      fullName: input.fullName.trim(),
      phoneNumber: input.phoneNumber.trim(),
      identityType,
      identityNumber,
      identityExpiryDate: input.identityExpiryDate ?? null,
      placeOfBirth: input.placeOfBirth.trim(),
      dateOfBirth: input.dateOfBirth,
      address: input.address.trim(),
      occupation: input.occupation.trim(),
      sourceOfFunds: input.sourceOfFunds.trim(),
      transactionPurpose: input.transactionPurpose.trim(),
      hasBeneficialOwner: input.hasBeneficialOwner ?? false,
      pepStatus: input.pepStatus ?? "NONE",
      pepDetails: input.pepStatus && input.pepStatus !== "NONE" ? input.pepDetails?.trim() || null : null,
      dttotPpsdmMatch: isHighRisk,
      dttotPpsdmNotes: isHighRisk ? input.dttotPpsdmNotes?.trim() || null : null,
      riskLevel: isHighRisk ? "HIGH" : (input.riskLevel ?? "LOW"),
      profileStatus: isHighRisk ? "RESTRICTED" : "ACTIVE",
      riskNotes: input.riskNotes?.trim() || null,
      createdByUserId: actorUserId,
    });
    const [row] = await tx.select().from(customers).where(eq(customers.cifNumber, cifNumber)).limit(1);
    if (!row) throw new Error("Data nasabah tidak dapat dibuat.");

    if (input.hasBeneficialOwner && input.beneficialOwner) {
      const bo = input.beneficialOwner;
      const boIdentityNumber = bo.identityNumber.trim().toUpperCase();
      const [existingBo] = await tx.select().from(customers).where(and(eq(customers.identityType, bo.identityType), eq(customers.identityNumber, boIdentityNumber))).limit(1);
      let beneficialOwnerCustomerId: number;
      if (existingBo) {
        beneficialOwnerCustomerId = existingBo.id;
      } else {
        const boCif = await computeNextCifNumber(tx);
        await tx.insert(customers).values({
          cifNumber: boCif,
          fullName: bo.fullName.trim(),
          phoneNumber: bo.phoneNumber?.trim() || "-",
          identityType: bo.identityType,
          identityNumber: boIdentityNumber,
          address: bo.address.trim(),
          occupation: bo.occupation?.trim() || null,
          sourceOfFunds: `Pemilik manfaat (beneficial owner) dari nasabah ${row.cifNumber} — ${row.fullName}.`,
          transactionPurpose: "Profil KYC pemilik manfaat (beneficial owner); dibuat otomatis dari pendaftaran nasabah terkait.",
          riskNotes: `Beneficial owner untuk CIF ${row.cifNumber} (${row.fullName}). Hubungan: ${bo.relationshipToCustomer.trim()}.`,
          createdByUserId: actorUserId,
        });
        const [insertedBo] = await tx.select().from(customers).where(eq(customers.cifNumber, boCif)).limit(1);
        if (!insertedBo) throw new Error("Profil pemilik manfaat (beneficial owner) tidak dapat dibuat.");
        beneficialOwnerCustomerId = insertedBo.id;
      }
      await tx.update(customers).set({ beneficialOwnerCustomerId }).where(eq(customers.id, row.id));
      row.beneficialOwnerCustomerId = beneficialOwnerCustomerId;
    }
    return row;
  });
  await writeAudit({ actorUserId, action: "CUSTOMER_CREATED", entityType: "customer", entityId: String(created.id), afterState: { cifNumber: created.cifNumber, fullName: created.fullName, riskLevel: created.riskLevel, profileStatus: created.profileStatus, hasBeneficialOwner: created.hasBeneficialOwner, pepStatus: created.pepStatus, dttotPpsdmMatch: created.dttotPpsdmMatch } });
  return created;
}

export type CustomerUpdateInput = {
  fullName: string;
  phoneNumber: string;
  identityType: "KTP" | "PASSPORT" | "OTHER";
  identityNumber: string;
  identityExpiryDate?: Date;
  placeOfBirth: string;
  dateOfBirth: Date;
  address: string;
  occupation: string;
  sourceOfFunds: string;
  transactionPurpose: string;
  profileStatus: "ACTIVE" | "RESTRICTED" | "INACTIVE";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskNotes?: string;
  pepStatus: "NONE" | "SELF" | "RELATED";
  pepDetails?: string;
  dttotPpsdmMatch: boolean;
  dttotPpsdmNotes?: string;
};

/**
 * Edits an existing customer profile — always requires a reason (this is the actual safeguard: KYC
 * data can be corrected, but never silently). Doesn't touch beneficial-owner linkage (hasBeneficialOwner/
 * beneficialOwnerCustomerId) — that relationship is set once at creation and stays a separate concern.
 */
export async function updateCustomer(input: { customerId: number; changeReason: string } & CustomerUpdateInput, actor: { id: number; role: StaffRole }) {
  const changeReason = input.changeReason.trim();
  if (changeReason.length < 5) throw new Error("Alasan perubahan wajib diisi (minimal 5 karakter) untuk jejak audit.");
  if (input.pepStatus !== "NONE" && !input.pepDetails?.trim()) throw new Error("Keterangan PEP wajib diisi.");
  if (input.dttotPpsdmMatch && !input.dttotPpsdmNotes?.trim()) throw new Error("Catatan kecocokan DTTOT/PPSPM wajib diisi.");

  const db = await databaseOrThrow();
  const existing = (await db.select().from(customers).where(and(eq(customers.id, input.customerId), eq(customers.isDemo, false), eq(customers.isHistorical, false))).limit(1))[0];
  if (!existing) throw new Error("Nasabah tidak ditemukan.");

  const nextValues = {
    fullName: input.fullName.trim(),
    phoneNumber: input.phoneNumber.trim(),
    identityType: input.identityType,
    identityNumber: input.identityNumber.trim().toUpperCase(),
    identityExpiryDate: input.identityExpiryDate ?? null,
    placeOfBirth: input.placeOfBirth.trim(),
    dateOfBirth: input.dateOfBirth,
    address: input.address.trim(),
    occupation: input.occupation.trim(),
    sourceOfFunds: input.sourceOfFunds.trim(),
    transactionPurpose: input.transactionPurpose.trim(),
    profileStatus: input.profileStatus,
    riskLevel: input.riskLevel,
    riskNotes: input.riskNotes?.trim() || null,
    pepStatus: input.pepStatus,
    pepDetails: input.pepStatus !== "NONE" ? input.pepDetails?.trim() || null : null,
    dttotPpsdmMatch: input.dttotPpsdmMatch,
    dttotPpsdmNotes: input.dttotPpsdmMatch ? input.dttotPpsdmNotes?.trim() || null : null,
  };

  await db.update(customers).set(nextValues).where(eq(customers.id, input.customerId));
  await writeAudit({
    actorUserId: actor.id, action: "CUSTOMER_UPDATED", entityType: "customer", entityId: String(input.customerId),
    beforeState: {
      fullName: existing.fullName, phoneNumber: existing.phoneNumber, identityType: existing.identityType, identityNumber: existing.identityNumber,
      identityExpiryDate: existing.identityExpiryDate, placeOfBirth: existing.placeOfBirth, dateOfBirth: existing.dateOfBirth, address: existing.address,
      occupation: existing.occupation, sourceOfFunds: existing.sourceOfFunds, transactionPurpose: existing.transactionPurpose, profileStatus: existing.profileStatus,
      riskLevel: existing.riskLevel, riskNotes: existing.riskNotes, pepStatus: existing.pepStatus, pepDetails: existing.pepDetails,
      dttotPpsdmMatch: existing.dttotPpsdmMatch, dttotPpsdmNotes: existing.dttotPpsdmNotes,
    },
    afterState: nextValues,
    reason: changeReason,
  });
  const [updated] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
  if (!updated) throw new Error("Nasabah tidak dapat diperbarui.");
  return updated;
}

export async function importCustomers(rows: CustomerInput[], actorUserId: number) {
  if (!rows.length) throw new Error("Tidak ada baris nasabah yang dapat diimpor.");
  if (rows.length > 300) throw new Error("Maksimal 300 nasabah dapat diimpor dalam satu kali proses.");
  const normalizedRows = rows.map((row) => ({
    ...row,
    cifNumber: row.cifNumber.trim().toUpperCase(), fullName: row.fullName.trim(), phoneNumber: row.phoneNumber.trim(),
    identityNumber: row.identityNumber.trim().toUpperCase(), placeOfBirth: row.placeOfBirth.trim(), address: row.address.trim(),
    occupation: row.occupation.trim(), sourceOfFunds: row.sourceOfFunds.trim(), transactionPurpose: row.transactionPurpose.trim(), riskNotes: row.riskNotes?.trim() || null,
  }));
  const cifs = normalizedRows.map((row) => row.cifNumber);
  if (new Set(cifs).size !== cifs.length) throw new Error("Terdapat CIF ganda di file impor.");
  const identityKeys = normalizedRows.map((row) => `${row.identityType}:${row.identityNumber}`);
  if (new Set(identityKeys).size !== identityKeys.length) throw new Error("Terdapat identitas nasabah ganda di file impor.");
  const db = await databaseOrThrow();
  await db.transaction(async (tx) => {
    const existing = await tx.select({ cifNumber: customers.cifNumber }).from(customers).where(inArray(customers.cifNumber, cifs));
    if (existing.length) throw new Error(`CIF sudah terdaftar: ${existing.map((item) => item.cifNumber).join(", ")}.`);
    await tx.insert(customers).values(normalizedRows.map((row) => ({ ...row, riskLevel: row.riskLevel ?? "LOW", createdByUserId: actorUserId })));
    await tx.insert(auditLogs).values({ actorUserId, action: "CUSTOMER_IMPORT_COMPLETED", entityType: "customer_import", entityId: new Date().toISOString(), metadata: { insertedCount: normalizedRows.length, cifNumbers: cifs } });
  });
  return { insertedCount: normalizedRows.length };
}

export async function listReferenceSnapshots() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select({ snapshot: rateReferenceSnapshots, currency: currencies }).from(rateReferenceSnapshots).innerJoin(currencies, eq(rateReferenceSnapshots.currencyId, currencies.id)).where(eq(rateReferenceSnapshots.isDemo, false)).orderBy(desc(rateReferenceSnapshots.referenceDate), currencies.code);
  });
}

export async function listMarketRateObservations(limit = 100) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select({ observation: marketRateObservations, currency: currencies }).from(marketRateObservations)
      .innerJoin(currencies, eq(marketRateObservations.currencyId, currencies.id))
      .orderBy(desc(marketRateObservations.observedAt)).limit(limit);
  });
}

export async function listRateVolatilityAlerts(limit = 100) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select({ alert: rateVolatilityAlerts, currency: currencies }).from(rateVolatilityAlerts)
      .innerJoin(currencies, eq(rateVolatilityAlerts.currencyId, currencies.id))
      .orderBy(desc(rateVolatilityAlerts.createdAt)).limit(limit);
  });
}

export async function recordMarketRateObservation(input: {
  currencyCode: string;
  sourceName: string;
  sourceKind: "OFFICIAL" | "MARKET" | "MANUAL";
  sourceUrl?: string;
  quoteUnit: string;
  buyRate: string;
  sellRate: string;
  observedAt?: Date;
  payloadHash?: string;
  notes?: string;
}, actorUserId?: number | null) {
  const db = await databaseOrThrow();
  const currency = (await db.select().from(currencies).where(eq(currencies.code, input.currencyCode.trim().toUpperCase())).limit(1))[0];
  if (!currency) throw new Error(`Mata uang ${input.currencyCode.trim().toUpperCase()} belum tersedia.`);
  const quoteUnit = nonNegativeDecimal(input.quoteUnit, "Satuan kuotasi").toFixed(6);
  const buyRate = nonNegativeDecimal(input.buyRate, "Kurs beli referensi").toFixed(6);
  const sellRate = nonNegativeDecimal(input.sellRate, "Kurs jual referensi").toFixed(6);
  const observedAt = input.observedAt ?? new Date();
  const prior = (await db.select().from(marketRateObservations).where(and(eq(marketRateObservations.currencyId, currency.id), eq(marketRateObservations.sourceName, input.sourceName.trim()))).orderBy(desc(marketRateObservations.observedAt)).limit(1))[0];
  await db.insert(marketRateObservations).values({
    currencyId: currency.id, sourceName: input.sourceName.trim(), sourceKind: input.sourceKind, sourceUrl: input.sourceUrl?.trim() || null,
    quoteUnit, buyRate, sellRate, observedAt, payloadHash: input.payloadHash?.trim() || null, notes: input.notes?.trim() || null, recordedByUserId: actorUserId ?? null,
  });
  const observation = (await db.select().from(marketRateObservations).orderBy(desc(marketRateObservations.id)).limit(1))[0];
  if (!observation) throw new Error("Observasi kurs tidak dapat disimpan.");
  let alert = null;
  if (prior) {
    const percentageChange = new Decimal(sellRate).minus(String(prior.sellRate)).abs().div(String(prior.sellRate)).mul(100);
    const setting = (await db.select({ rateShockThresholdPercent: operationalSettings.rateShockThresholdPercent }).from(operationalSettings).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD")).limit(1))[0];
    const threshold = new Decimal(String(setting?.rateShockThresholdPercent ?? DEFAULT_RATE_SHOCK_THRESHOLD_PERCENT));
    if (percentageChange.gte(threshold)) {
      const percentageChangeText = percentageChange.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
      const severity = percentageChange.gte(threshold.mul(2)) ? "HIGH" as const : "ATTENTION" as const;
      const message = `${currency.code} dari ${input.sourceName.trim()} berubah ${percentageChangeText}% dibanding observasi sebelumnya.`;
      await db.insert(rateVolatilityAlerts).values({ currencyId: currency.id, sourceName: input.sourceName.trim(), observationId: observation.id, alertType: "REFERENCE_MOVEMENT", percentageChange: percentageChangeText, severity, message });
      alert = (await db.select().from(rateVolatilityAlerts).orderBy(desc(rateVolatilityAlerts.id)).limit(1))[0] ?? null;
      if (alert) await createDirectorKnowledgeItem({ eventType: "RATE_SHOCK", entityType: "rate_volatility_alert", entityId: String(alert.id), title: `Peringatan perubahan kurs ${currency.code}`, detail: message, createdByUserId: actorUserId ?? null });
    }
  }
  await writeAudit({ actorUserId: actorUserId ?? null, action: "MARKET_RATE_OBSERVATION_RECORDED", entityType: "market_rate_observation", entityId: String(observation.id), afterState: { currencyCode: currency.code, sourceName: observation.sourceName, sourceKind: observation.sourceKind, buyRate, sellRate, observedAt }, metadata: { alertId: alert?.id ?? null } });
  return { observation, alert };
}

export async function resolveRateVolatilityAlert(input: { alertId: number; notes: string }, actorUserId: number) {
  const db = await databaseOrThrow();
  const current = (await db.select().from(rateVolatilityAlerts).where(eq(rateVolatilityAlerts.id, input.alertId)).limit(1))[0];
  if (!current) throw new Error("Peringatan kurs tidak ditemukan.");
  if (current.resolvedAt) throw new Error("Peringatan kurs sudah ditandai ditinjau.");
  const resolvedAt = new Date();
  await db.update(rateVolatilityAlerts).set({ resolvedAt, resolvedByUserId: actorUserId, resolutionNotes: input.notes.trim() }).where(eq(rateVolatilityAlerts.id, input.alertId));
  await writeAudit({ actorUserId, action: "RATE_VOLATILITY_ALERT_RESOLVED", entityType: "rate_volatility_alert", entityId: String(input.alertId), beforeState: { resolvedAt: null }, afterState: { resolvedAt }, reason: input.notes.trim() });
  return { ...current, resolvedAt, resolvedByUserId: actorUserId, resolutionNotes: input.notes.trim() };
}

export async function listOperationalRates() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select({ rate: operationalRates, currency: currencies }).from(operationalRates).innerJoin(currencies, eq(operationalRates.currencyId, currencies.id)).where(and(eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false))).orderBy(desc(operationalRates.effectiveAt), currencies.code);
  });
}

export function midpointPerUnit(buyRate: string, sellRate: string, quoteUnit: string) {
  const unit = new Decimal(String(quoteUnit));
  if (!unit.gt(0)) return null;
  return new Decimal(String(buyRate)).plus(String(sellRate)).div(2).div(unit).toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6);
}

export function differencePercent(base: string, reference: string | null) {
  if (!reference || new Decimal(reference).isZero()) return null;
  return new Decimal(base).minus(reference).div(reference).mul(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

/** Compares current outlet prices with recorded references without changing an outlet rate. */
export async function getRateComparisonDashboard() {
  const [operationalRows, referenceRows, observationRows] = await Promise.all([listOperationalRates(), listReferenceSnapshots(), listMarketRateObservations(250)]);
  const activeRates = selectPublicActiveRateRows(operationalRows);
  const biByCurrency = new Map<number, typeof referenceRows[number]>();
  const jisdorByCurrency = new Map<number, typeof observationRows[number]>();
  const marketByCurrency = new Map<number, typeof observationRows[number]>();
  for (const row of referenceRows) if (!biByCurrency.has(row.currency.id)) biByCurrency.set(row.currency.id, row);
  for (const row of observationRows) {
    if (row.observation.sourceName === "JISDOR" && !jisdorByCurrency.has(row.currency.id)) jisdorByCurrency.set(row.currency.id, row);
    if (row.observation.sourceKind !== "OFFICIAL" && !marketByCurrency.has(row.currency.id)) marketByCurrency.set(row.currency.id, row);
  }
  return activeRates.map(({ rate, currency }) => {
    const bi = biByCurrency.get(currency.id);
    const jisdor = jisdorByCurrency.get(currency.id);
    const market = marketByCurrency.get(currency.id);
    const outletMidpointPerUnit = midpointPerUnit(String(rate.buyRate), String(rate.sellRate), String(rate.quoteUnit));
    const biMidpointPerUnit = bi ? midpointPerUnit(String(bi.snapshot.buyRate), String(bi.snapshot.sellRate), String(bi.snapshot.quoteUnit)) : null;
    const jisdorMidpointPerUnit = jisdor ? midpointPerUnit(String(jisdor.observation.buyRate), String(jisdor.observation.sellRate), String(jisdor.observation.quoteUnit)) : null;
    const marketMidpointPerUnit = market ? midpointPerUnit(String(market.observation.buyRate), String(market.observation.sellRate), String(market.observation.quoteUnit)) : null;
    return {
      currency: { id: currency.id, code: currency.code, name: currency.name },
      outlet: { buyRate: String(rate.buyRate), sellRate: String(rate.sellRate), quoteUnit: String(rate.quoteUnit), effectiveAt: rate.effectiveAt, midpointPerUnit: outletMidpointPerUnit },
      bi: bi ? { sourceName: "Bank Indonesia", observedAt: bi.snapshot.referenceDate, midpointPerUnit: biMidpointPerUnit } : null,
      jisdor: jisdor ? { sourceName: jisdor.observation.sourceName, observedAt: jisdor.observation.observedAt, midpointPerUnit: jisdorMidpointPerUnit } : null,
      market: market ? { sourceName: market.observation.sourceName, observedAt: market.observation.observedAt, midpointPerUnit: marketMidpointPerUnit } : null,
      differences: { versusBiPercent: differencePercent(outletMidpointPerUnit ?? "0", biMidpointPerUnit), versusJisdorPercent: differencePercent(outletMidpointPerUnit ?? "0", jisdorMidpointPerUnit), versusMarketPercent: differencePercent(outletMidpointPerUnit ?? "0", marketMidpointPerUnit) },
    };
  });
}

export function selectPublicActiveRateRows<T extends { rate: { currencyId: number; status: string; effectiveAt: Date; notes: string | null; isDemo?: boolean; isHistorical?: boolean } }>(rows: T[], now = new Date()) {
  const seen = new Set<number>();
  return rows.filter(({ rate }) => {
    if (rate.status !== "ACTIVE" || rate.effectiveAt > now || rate.isDemo || rate.isHistorical || rate.notes?.startsWith("[DEMO]")) return false;
    if (seen.has(rate.currencyId)) return false;
    seen.add(rate.currencyId);
    return true;
  });
}

/** Returns the current operational rate by currency for the unauthenticated public board. */
export async function listPublicActiveRates() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const rows = await db.select({ rate: operationalRates, currency: currencies }).from(operationalRates)
      .innerJoin(currencies, eq(operationalRates.currencyId, currencies.id))
      .where(and(eq(operationalRates.status, "ACTIVE"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false), eq(currencies.active, true), lte(operationalRates.effectiveAt, new Date())))
      .orderBy(desc(operationalRates.effectiveAt), currencies.code);
    return selectPublicActiveRateRows(rows).map(({ rate, currency }) => ({ rate, currency, isDemo: false }));
  });
}

export async function proposeOperationalRate(input: { currencyId: number; referenceSnapshotId?: number | null; quoteUnit: string; buyRate: string; sellRate: string; effectiveAt: Date; notes?: string }, actorUserId: number) {
  const db = await databaseOrThrow();
  const currency = (await db.select().from(currencies).where(and(eq(currencies.id, input.currencyId), eq(currencies.active, true))).limit(1))[0];
  if (!currency) throw new Error("Mata uang aktif tidak ditemukan.");
  if (input.referenceSnapshotId) {
    const reference = (await db.select({ id: rateReferenceSnapshots.id }).from(rateReferenceSnapshots).where(and(eq(rateReferenceSnapshots.id, input.referenceSnapshotId), eq(rateReferenceSnapshots.isDemo, false))).limit(1))[0];
    if (!reference) throw new Error("Snapshot referensi demo tidak dapat digunakan untuk proposal kurs operasional.");
  }
  nonNegativeDecimal(input.quoteUnit, "Satuan kuotasi");
  nonNegativeDecimal(input.buyRate, "Kurs beli");
  nonNegativeDecimal(input.sellRate, "Kurs jual");
  await db.insert(operationalRates).values({
    currencyId: input.currencyId,
    referenceSnapshotId: input.referenceSnapshotId ?? null,
    quoteUnit: new Decimal(input.quoteUnit).toFixed(6),
    buyRate: new Decimal(input.buyRate).toFixed(6),
    sellRate: new Decimal(input.sellRate).toFixed(6),
    effectiveAt: input.effectiveAt,
    status: "DRAFT",
    proposedByUserId: actorUserId,
    notes: input.notes?.trim() || null,
  });
  const created = (await db.select().from(operationalRates).orderBy(desc(operationalRates.id)).limit(1))[0];
  if (!created) throw new Error("Proposal kurs tidak dapat dibuat.");
  await writeAudit({ actorUserId, action: "OPERATIONAL_RATE_PROPOSED", entityType: "operational_rate", entityId: String(created.id), afterState: { currencyId: created.currencyId, quoteUnit: created.quoteUnit, buyRate: created.buyRate, sellRate: created.sellRate, effectiveAt: created.effectiveAt } });
  return created;
}

/** Creates at most one DRAFT per newest BI snapshot, so repeated submissions stay idempotent. */
export async function proposeLatestReferenceRates(actorUserId: number, effectiveAt = new Date()) {
  const db = await databaseOrThrow();
  const references = await db.select({ snapshot: rateReferenceSnapshots, currency: currencies }).from(rateReferenceSnapshots)
    .innerJoin(currencies, eq(rateReferenceSnapshots.currencyId, currencies.id))
    .where(and(eq(currencies.active, true), eq(rateReferenceSnapshots.isDemo, false)))
    .orderBy(desc(rateReferenceSnapshots.referenceDate), desc(rateReferenceSnapshots.fetchedAt), currencies.code);
  const latestByCurrency = new Map<number, typeof references[number]>();
  for (const row of references) if (!latestByCurrency.has(row.currency.id)) latestByCurrency.set(row.currency.id, row);
  if (!latestByCurrency.size) throw new Error("Belum ada snapshot BI tersimpan. Sinkronkan referensi terlebih dahulu.");

  const createdIds: number[] = [];
  const skippedCurrencyCodes: string[] = [];
  await db.transaction(async (tx) => {
    for (const { snapshot, currency } of Array.from(latestByCurrency.values())) {
      const existing = (await tx.select({ id: operationalRates.id }).from(operationalRates).where(and(eq(operationalRates.referenceSnapshotId, snapshot.id), eq(operationalRates.status, "DRAFT"))).limit(1))[0];
      if (existing) { skippedCurrencyCodes.push(currency.code); continue; }
      await tx.insert(operationalRates).values({
        currencyId: currency.id, referenceSnapshotId: snapshot.id, quoteUnit: String(snapshot.quoteUnit), buyRate: String(snapshot.buyRate), sellRate: String(snapshot.sellRate), effectiveAt, status: "DRAFT", proposedByUserId: actorUserId,
        notes: `Proposal otomatis dari snapshot BI ${snapshot.referenceDate.toISOString().slice(0, 10)}. Tinjau margin sebelum aktivasi.`,
      });
      const created = (await tx.select({ id: operationalRates.id }).from(operationalRates).where(and(eq(operationalRates.referenceSnapshotId, snapshot.id), eq(operationalRates.status, "DRAFT"))).orderBy(desc(operationalRates.id)).limit(1))[0];
      if (created) createdIds.push(created.id);
    }
    await tx.insert(auditLogs).values({ actorUserId, action: "OPERATIONAL_RATE_BULK_PROPOSED", entityType: "operational_rate_batch", entityId: effectiveAt.toISOString(), afterState: { createdRateIds: createdIds, skippedCurrencyCodes }, metadata: { source: "LATEST_BI_REFERENCE_SNAPSHOTS", effectiveAt } });
  });
  return { created: createdIds.length, skipped: skippedCurrencyCodes.length, createdRateIds: createdIds, skippedCurrencyCodes };
}

export async function activateOperationalRate(rateId: number, actorUserId: number, approvalReason: string) {
  const reason = approvalReason.trim();
  if (reason.length < 10) throw new Error("Alasan aktivasi kurs minimal 10 karakter.");
  const db = await databaseOrThrow();
  const draft = (await db.select().from(operationalRates).where(eq(operationalRates.id, rateId)).limit(1))[0];
  if (!draft || draft.status !== "DRAFT") throw new Error("Hanya proposal kurs berstatus DRAFT yang dapat diaktifkan.");
  if (draft.isDemo || draft.isHistorical) throw new Error("Proposal kurs demo atau historis tidak dapat diaktifkan pada operasi live.");
  const activatedAt = new Date();
  await db.transaction(async (tx) => {
    await tx.update(operationalRates).set({ status: "RETIRED" }).where(and(eq(operationalRates.currencyId, draft.currencyId), eq(operationalRates.status, "ACTIVE"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false)));
    await tx.update(operationalRates).set({ status: "ACTIVE", approvedByUserId: actorUserId, approvedAt: activatedAt }).where(eq(operationalRates.id, rateId));
    await tx.insert(auditLogs).values({ actorUserId, action: "OPERATIONAL_RATE_ACTIVATED", entityType: "operational_rate", entityId: String(rateId), beforeState: { status: draft.status }, afterState: { status: "ACTIVE", approvedAt: activatedAt }, reason });
  });
  return { ...draft, status: "ACTIVE" as const, approvedByUserId: actorUserId, approvedAt: activatedAt };
}

/** Activates selected draft versions; activation remains atomic for each currency. */
export async function activateOperationalRates(rateIds: number[], actorUserId: number, approvalReason: string) {
  const uniqueRateIds = Array.from(new Set(rateIds));
  if (!uniqueRateIds.length) throw new Error("Pilih setidaknya satu proposal kurs untuk diaktifkan.");
  for (const rateId of uniqueRateIds) await activateOperationalRate(rateId, actorUserId, approvalReason);
  return { activated: uniqueRateIds.length, rateIds: uniqueRateIds };
}

async function reviewThresholdUsd() {
  const db = await databaseOrThrow();
  const found = (await db.select().from(operationalSettings).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD")).limit(1))[0];
  if (found) return found.reviewThresholdUsd;
  await db.insert(operationalSettings).values({ settingCode: "REVIEW_THRESHOLD" });
  return DEFAULT_REVIEW_THRESHOLD_USD;
}

async function reviewThresholds() {
  const db = await databaseOrThrow();
  const found = (await db.select().from(operationalSettings).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD")).limit(1))[0];
  if (found) return { reviewThresholdUsd: found.reviewThresholdUsd, eddCashDailyThresholdIdr: found.eddCashDailyThresholdIdr };
  await db.insert(operationalSettings).values({ settingCode: "REVIEW_THRESHOLD" });
  return { reviewThresholdUsd: DEFAULT_REVIEW_THRESHOLD_USD, eddCashDailyThresholdIdr: DEFAULT_EDD_CASH_DAILY_THRESHOLD_IDR };
}

export async function getReviewThreshold() {
  try {
    const db = await databaseOrThrow();
    const found = (await db.select().from(operationalSettings).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD")).limit(1))[0];
    return { reviewThresholdUsd: found?.reviewThresholdUsd ?? DEFAULT_REVIEW_THRESHOLD_USD, eddCashDailyThresholdIdr: found?.eddCashDailyThresholdIdr ?? DEFAULT_EDD_CASH_DAILY_THRESHOLD_IDR, rateShockThresholdPercent: found?.rateShockThresholdPercent ?? DEFAULT_RATE_SHOCK_THRESHOLD_PERCENT, isFallback: false };
  } catch (error) {
    // The threshold read is informational on the rates screen. A temporary DB
    // outage must not fail the whole tRPC batch or prevent reporting from loading.
    console.warn("[Operations] Review threshold unavailable; using safe default.", error);
    return { reviewThresholdUsd: DEFAULT_REVIEW_THRESHOLD_USD, eddCashDailyThresholdIdr: DEFAULT_EDD_CASH_DAILY_THRESHOLD_IDR, rateShockThresholdPercent: DEFAULT_RATE_SHOCK_THRESHOLD_PERCENT, isFallback: true };
  }
}

export async function updateReviewThreshold(reviewThresholdUsd: string, actorUserId: number, eddCashDailyThresholdIdr?: string, rateShockThresholdPercent?: string) {
  const db = await databaseOrThrow();
  const normalized = normalizeReviewThreshold(reviewThresholdUsd);
  const normalizedEdd = eddCashDailyThresholdIdr ? normalizeEddCashDailyThreshold(eddCashDailyThresholdIdr) : undefined;
  const normalizedRateShock = rateShockThresholdPercent ? normalizeRateShockThreshold(rateShockThresholdPercent) : undefined;
  const existing = (await db.select().from(operationalSettings).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD")).limit(1))[0];
  if (existing) {
    await db.update(operationalSettings).set({ reviewThresholdUsd: normalized, ...(normalizedEdd ? { eddCashDailyThresholdIdr: normalizedEdd } : {}), ...(normalizedRateShock ? { rateShockThresholdPercent: normalizedRateShock } : {}), updatedByUserId: actorUserId }).where(eq(operationalSettings.id, existing.id));
  } else {
    await db.insert(operationalSettings).values({ settingCode: "REVIEW_THRESHOLD", reviewThresholdUsd: normalized, eddCashDailyThresholdIdr: normalizedEdd ?? DEFAULT_EDD_CASH_DAILY_THRESHOLD_IDR, rateShockThresholdPercent: normalizedRateShock ?? DEFAULT_RATE_SHOCK_THRESHOLD_PERCENT, updatedByUserId: actorUserId });
  }
  await writeAudit({ actorUserId, action: "REVIEW_THRESHOLD_UPDATED", entityType: "operational_setting", entityId: "REVIEW_THRESHOLD", beforeState: { reviewThresholdUsd: existing?.reviewThresholdUsd ?? DEFAULT_REVIEW_THRESHOLD_USD, eddCashDailyThresholdIdr: existing?.eddCashDailyThresholdIdr ?? DEFAULT_EDD_CASH_DAILY_THRESHOLD_IDR, rateShockThresholdPercent: existing?.rateShockThresholdPercent ?? DEFAULT_RATE_SHOCK_THRESHOLD_PERCENT }, afterState: { reviewThresholdUsd: normalized, eddCashDailyThresholdIdr: normalizedEdd ?? existing?.eddCashDailyThresholdIdr ?? DEFAULT_EDD_CASH_DAILY_THRESHOLD_IDR, rateShockThresholdPercent: normalizedRateShock ?? existing?.rateShockThresholdPercent ?? DEFAULT_RATE_SHOCK_THRESHOLD_PERCENT } });
  return { reviewThresholdUsd: normalized, eddCashDailyThresholdIdr: normalizedEdd ?? existing?.eddCashDailyThresholdIdr ?? DEFAULT_EDD_CASH_DAILY_THRESHOLD_IDR, rateShockThresholdPercent: normalizedRateShock ?? existing?.rateShockThresholdPercent ?? DEFAULT_RATE_SHOCK_THRESHOLD_PERCENT };
}

function transactionNumber() {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `FX-${timestamp}-${nanoid(6).toUpperCase()}`;
}

/** One currency within a bon. Priced per denomination (not per line) — e.g. USD 100s at one rate, USD
 * 10s at another, in the same currency and deal — so foreignAmount/agreedRate on the line are derived
 * from summing/averaging the denominations, never entered directly. */
export type CreateTransactionLineInput = {
  currencyId: number;
  /** Defaults to 1 — only needed for currencies quoted per 100 units etc. */
  quoteUnit?: string;
  /** Required, at least one row — each denomination group carries its own price. */
  denominations: PricedDenominationInput[];
};

export type CreateTransactionInput = {
  operation: "BUY" | "SELL";
  customerId: number;
  /** Physical receipt-book number, typed manually by the teller. Unique per operation (Jual and Beli books are numbered independently). */
  receiptNumber: string;
  lines: CreateTransactionLineInput[];
  dealNotes?: string;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "OTHER";
  paymentReference?: string;
  /** Physical Rupiah denomination breakdown for the payment leg — required when paymentMethod is CASH. */
  paymentDenominations?: DenominationEntryInput[];
  /** Company bank account the transfer moved through — required when paymentMethod is BANK_TRANSFER. */
  bankAccountId?: number;
  /** The other side of the transfer — whose account the money came from (JUAL) or went to (BELI). */
  counterpartyBankName?: string;
  counterpartyAccountNumber?: string;
  counterpartyAccountHolderName?: string;
  counterpartyNameMismatchReason?: string;
  transactionPurposeSnapshot?: string;
  customerActingAs?: "SELF" | "REPRESENTATIVE";
  /** Registered customer id acting as representative/kuasa; the name and identity number are snapshotted server-side from that customer. */
  representativeCustomerId?: number;
  underlyingRequired?: boolean;
  underlyingReference?: string;
  underlyingNotes?: string;
  /** Required once the >=10,000 USD-equivalent underlying threshold is met — a separate business
   * justification from underlyingNotes (which describes the supporting documents themselves). */
  thresholdReason?: string;
  isSuspiciousTransaction?: boolean;
  suspiciousIndicators?: string[];
  suspiciousNotes?: string;
  transactionAt: Date;
};

/** Groups exchangeTransactionLines (joined to currency) by transactionId, for attaching to a batch of listed transactions in one extra query instead of N+1. Also returns single-currency legacy bons (pre-multi-line) as a synthesized one-line array, so callers never need two code paths. */
async function linesByTransactionId(db: Awaited<ReturnType<typeof databaseOrThrow>>, rows: { transaction: typeof exchangeTransactions.$inferSelect }[]) {
  const transactionIds = rows.map(({ transaction }) => transaction.id);
  const lineRows = transactionIds.length
    ? await db.select({ line: exchangeTransactionLines, currency: currencies }).from(exchangeTransactionLines)
      .innerJoin(currencies, eq(exchangeTransactionLines.currencyId, currencies.id))
      .where(inArray(exchangeTransactionLines.transactionId, transactionIds))
      .orderBy(exchangeTransactionLines.transactionId, exchangeTransactionLines.lineNumber)
    : [];
  const grouped = new Map<number, { line: typeof exchangeTransactionLines.$inferSelect; currency: typeof currencies.$inferSelect }[]>();
  for (const row of lineRows) {
    const existing = grouped.get(row.line.transactionId) ?? [];
    existing.push(row);
    grouped.set(row.line.transactionId, existing);
  }
  const legacyCurrencyIds = Array.from(new Set(rows.filter(({ transaction }) => !grouped.has(transaction.id) && transaction.currencyId).map(({ transaction }) => transaction.currencyId as number)));
  const legacyCurrencies = legacyCurrencyIds.length ? await db.select().from(currencies).where(inArray(currencies.id, legacyCurrencyIds)) : [];
  const legacyCurrencyById = new Map(legacyCurrencies.map((currency) => [currency.id, currency]));
  // Priced denomination rows are the printed kwitansi's real rows (each carries its own price); fetch
  // them for every transaction in this batch and group by line so callers get them alongside each line.
  const denominationRows = transactionIds.length
    ? await db.select().from(exchangeTransactionDenominationEntries).where(inArray(exchangeTransactionDenominationEntries.transactionId, transactionIds))
    : [];
  const denomsByLineId = new Map<number, typeof denominationRows>();
  const legacyDenomsByTransactionId = new Map<number, typeof denominationRows>();
  for (const denomination of denominationRows) {
    if (denomination.transactionLineId != null) {
      const existing = denomsByLineId.get(denomination.transactionLineId) ?? [];
      existing.push(denomination);
      denomsByLineId.set(denomination.transactionLineId, existing);
    } else {
      const existing = legacyDenomsByTransactionId.get(denomination.transactionId) ?? [];
      existing.push(denomination);
      legacyDenomsByTransactionId.set(denomination.transactionId, existing);
    }
  }
  return (transaction: typeof exchangeTransactions.$inferSelect) => {
    const lines = grouped.get(transaction.id);
    if (lines) return lines.map((entry) => ({ ...entry, denominations: denomsByLineId.get(entry.line.id) ?? [] }));
    // Bon created before multi-line bons existed: synthesize a single line from the legacy header columns so callers have one shape to render.
    const legacyCurrency = transaction.currencyId ? legacyCurrencyById.get(transaction.currencyId) : undefined;
    if (!legacyCurrency || !transaction.foreignAmount || !transaction.rateSnapshot) return [];
    return [{ line: { id: -transaction.id, transactionId: transaction.id, lineNumber: 1, currencyId: transaction.currencyId!, operationalRateId: transaction.operationalRateId, referenceRateSnapshot: transaction.referenceRateSnapshot, quoteUnit: transaction.quoteUnitSnapshot ?? "1.000000", agreedRate: transaction.rateSnapshot, foreignAmount: transaction.foreignAmount, rupiahAmount: transaction.rupiahAmount, createdAt: transaction.createdAt }, currency: legacyCurrency, denominations: legacyDenomsByTransactionId.get(transaction.id) ?? [] }];
  };
}

export async function listTransactions(requester: { id: number; role: StaffRole }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const baseQuery = db.select({ transaction: exchangeTransactions, customer: customers }).from(exchangeTransactions)
      .innerJoin(customers, eq(exchangeTransactions.customerId, customers.id));
    const liveTransactionFilter = and(eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false), eq(customers.isDemo, false), eq(customers.isHistorical, false));
    const rows = requester.role === "STAFF"
      ? await baseQuery.where(and(liveTransactionFilter, eq(exchangeTransactions.tellerUserId, requester.id))).orderBy(desc(exchangeTransactions.transactionAt))
      : await baseQuery.where(liveTransactionFilter).orderBy(desc(exchangeTransactions.transactionAt));
    const liveRows = rows.filter(({ transaction, customer }) => !transaction.isDemo && !transaction.isHistorical && !customer.isDemo && !customer.isHistorical);
    const resolveLines = await linesByTransactionId(db, liveRows);
    return liveRows.map((row) => ({ ...row, lines: resolveLines(row.transaction) }));
  });
}

export async function listTransactionDenominations(transactionId: number) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(exchangeTransactionDenominationEntries).where(eq(exchangeTransactionDenominationEntries.transactionId, transactionId)).orderBy(desc(exchangeTransactionDenominationEntries.denominationValue));
  });
}

/** Historical ledger imports are deliberately exposed through a separate Controller-only view. */
export async function getHistoricalTransactionReport(input: { from: Date; to: Date; limit?: number }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const rows = await db.select({ transaction: exchangeTransactions, customer: customers, currency: currencies }).from(exchangeTransactions)
      .innerJoin(customers, eq(exchangeTransactions.customerId, customers.id))
      .innerJoin(currencies, eq(exchangeTransactions.currencyId, currencies.id))
      .where(and(
        gte(exchangeTransactions.transactionAt, input.from),
        lt(exchangeTransactions.transactionAt, input.to),
        eq(exchangeTransactions.isDemo, false),
        eq(exchangeTransactions.isHistorical, true),
        eq(customers.isDemo, false),
        eq(customers.isHistorical, true),
      ))
      .orderBy(desc(exchangeTransactions.transactionAt))
      .limit(input.limit ?? 1000);
    return rows.filter(({ transaction, customer }) => transaction.isHistorical && !transaction.isDemo && customer.isHistorical && !customer.isDemo);
  });
}

export async function createTransaction(input: CreateTransactionInput, tellerUserId: number) {
  const db = await databaseOrThrow();
  const customer = (await db.select().from(customers).where(and(eq(customers.id, input.customerId), eq(customers.isDemo, false), eq(customers.isHistorical, false))).limit(1))[0];
  if (!customer) throw new Error("Nasabah tidak ditemukan.");
  if (customer.isDemo || customer.isHistorical) throw new Error("Nasabah demo atau historis tidak dapat digunakan pada transaksi operasional.");
  if (customer.profileStatus === "INACTIVE") throw new Error("Nasabah tidak aktif dan tidak dapat digunakan pada transaksi.");
  if (!input.lines?.length) throw new Error("Bon harus punya minimal satu baris mata uang.");
  if (input.lines.length > 30) throw new Error("Terlalu banyak baris pada satu bon.");
  const receiptNumber = input.receiptNumber.trim();
  if (!receiptNumber) throw new Error("Nomor kwitansi wajib diisi.");
  const duplicateReceipt = (await db.select({ id: exchangeTransactions.id }).from(exchangeTransactions).where(and(eq(exchangeTransactions.operation, input.operation), eq(exchangeTransactions.receiptNumber, receiptNumber))).limit(1))[0];
  if (duplicateReceipt) throw new Error(`Nomor kwitansi ${receiptNumber} sudah dipakai pada bon ${input.operation === "BUY" ? "beli" : "jual"} lain.`);

  let representative: typeof customer | undefined;
  if (input.customerActingAs === "REPRESENTATIVE") {
    if (!input.representativeCustomerId) throw new Error("Pilih nasabah terdaftar sebagai pihak kuasa/wakil.");
    representative = (await db.select().from(customers).where(and(eq(customers.id, input.representativeCustomerId), eq(customers.isDemo, false), eq(customers.isHistorical, false))).limit(1))[0];
    if (!representative) throw new Error("Nasabah pihak kuasa/wakil tidak ditemukan.");
    if (representative.profileStatus === "INACTIVE") throw new Error("Nasabah pihak kuasa/wakil tidak aktif.");
    if (representative.id === customer.id) throw new Error("Pihak kuasa/wakil harus nasabah yang berbeda dari nasabah transaksi.");
  }

  const lineCurrencyIds = Array.from(new Set(input.lines.map((line) => line.currencyId)));
  const lineCurrencies = await db.select().from(currencies).where(inArray(currencies.id, lineCurrencyIds));
  const currencyById = new Map(lineCurrencies.map((currency) => [currency.id, currency]));
  const activeRatesByCurrency = new Map((await db.select({ rate: operationalRates }).from(operationalRates)
    .where(and(inArray(operationalRates.currencyId, lineCurrencyIds), eq(operationalRates.status, "ACTIVE"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false))))
    .map(({ rate }) => [rate.currencyId, rate]));

  type PreparedLine = { currencyId: number; operationalRateId: number | null; referenceRateSnapshot: string | null; quoteUnit: string; agreedRate: string; foreignAmount: string; rupiahAmount: string; denominationRows: ReturnType<typeof reconcilePricedDenominations>["rows"] };
  const preparedLines: PreparedLine[] = input.lines.map((line, index) => {
    const currency = currencyById.get(line.currencyId);
    if (!currency || !currency.active) throw new Error(`Mata uang pada baris ${index + 1} tidak ditemukan atau tidak aktif.`);
    // The base currency (IDR) is always the payment side of a deal, never the traded line — a
    // transaction line has to be a genuine foreign currency. Enforced here too, not just in the
    // client's CurrencyPicker, since the client filter alone is never the only line of defense.
    if (currency.code === "IDR") throw new Error(`Baris ${index + 1}: Rupiah tidak dapat dipilih sebagai mata uang baris — Rupiah selalu sisi pembayaran.`);
    const quoteUnit = nonNegativeDecimal(line.quoteUnit ?? "1", `Satuan kuotasi baris ${index + 1}`);
    const { rows: denominationRows, totalForeign, totalRupiah } = reconcilePricedDenominations(line.denominations, quoteUnit, `baris ${index + 1}`, currency.code);
    // agreedRate on the line is a derived weighted average across its (possibly differently-priced)
    // denomination rows — informational only; the authoritative price lives on each denomination row.
    // reconcilePricedDenominations guarantees at least one row with value>0 and rate>0, so totalForeign>0.
    const agreedRate = new Decimal(totalRupiah).div(totalForeign).times(quoteUnit);
    const activeRate = activeRatesByCurrency.get(line.currencyId);
    const referenceRateSnapshot = activeRate ? (input.operation === "BUY" ? activeRate.buyRate : activeRate.sellRate) : null;
    return { currencyId: line.currencyId, operationalRateId: activeRate?.id ?? null, referenceRateSnapshot, quoteUnit: quoteUnit.toFixed(6), agreedRate: agreedRate.toFixed(6), foreignAmount: totalForeign.toFixed(6), rupiahAmount: totalRupiah, denominationRows };
  });
  const rupiahAmount = preparedLines.reduce((sum, line) => sum.plus(line.rupiahAmount), new Decimal(0)).toFixed(2);

  // A SELL bon hands out foreign currency we're supposed to already be holding — never let it draft
  // against stock we don't have.
  if (input.operation === "SELL") {
    const requiredByCurrency = new Map<number, Decimal>();
    const denomRequiredByCurrency = new Map<number, Map<string, number>>();
    for (const line of preparedLines) {
      requiredByCurrency.set(line.currencyId, (requiredByCurrency.get(line.currencyId) ?? new Decimal(0)).plus(line.foreignAmount));
      const denomMap = denomRequiredByCurrency.get(line.currencyId) ?? new Map<string, number>();
      for (const entry of line.denominationRows) denomMap.set(entry.denominationValue, (denomMap.get(entry.denominationValue) ?? 0) + entry.quantity);
      denomRequiredByCurrency.set(line.currencyId, denomMap);
    }
    for (const [lineCurrencyId, required] of Array.from(requiredByCurrency.entries())) {
      const code = currencyById.get(lineCurrencyId)?.code ?? `#${lineCurrencyId}`;
      await assertSufficientStock(db, lineCurrencyId, code, required, denomRequiredByCurrency.get(lineCurrencyId) ?? new Map(), "dijual");
    }
  }

  // The other side of a CASH deal: physical Rupiah handed over/received. Required whenever payment is
  // CASH (bank transfer/other never touch physical stock), reconciled the same way as a foreign line.
  let paymentDenominationRows: ReturnType<typeof reconcileDenominations> = [];
  let paymentCurrencyId: number | null = null;
  if (input.paymentMethod === "CASH") {
    if (!input.paymentDenominations?.length) throw new Error("Rincian pecahan Rupiah yang diterima/dibayarkan wajib diisi untuk pembayaran tunai.");
    paymentDenominationRows = reconcileDenominations(input.paymentDenominations, new Decimal(rupiahAmount), "IDR");
    const idrCurrency = await ensureCurrency({ code: "IDR", name: "Rupiah Indonesia" });
    paymentCurrencyId = idrCurrency.id;
    if (input.operation === "BUY") {
      const denomRequired = new Map(paymentDenominationRows.map((row) => [row.denominationValue, row.quantity]));
      await assertSufficientStock(db, idrCurrency.id, "IDR", new Decimal(rupiahAmount), denomRequired, "membayar pembelian");
    }
  }

  let bankAccount: { id: number; currencyId: number } | null = null;
  let counterpartyNameMismatchReason: string | null = null;
  if (input.paymentMethod === "BANK_TRANSFER") {
    if (!input.bankAccountId) throw new Error("Pilih rekening bank perusahaan yang menerima/mengirim transfer.");
    const account = (await db.select({ id: bankAccounts.id, currencyId: bankAccounts.currencyId, active: bankAccounts.active }).from(bankAccounts).where(eq(bankAccounts.id, input.bankAccountId)).limit(1))[0];
    if (!account || !account.active) throw new Error("Rekening bank tidak ditemukan atau sudah tidak aktif.");
    bankAccount = account;
    if (!input.counterpartyBankName?.trim() || !input.counterpartyAccountNumber?.trim() || !input.counterpartyAccountHolderName?.trim()) {
      throw new Error("Nama bank, nomor rekening, dan atas nama rekening lawan transaksi wajib diisi untuk transfer bank.");
    }
    // The counterparty account should normally belong to the customer themselves — a mismatch isn't
    // blocked (a legitimate kuasa/wakil or third-party payment happens), but it can never be silent:
    // the reason gets printed on the kwitansi automatically (see printBon).
    const namesMatch = input.counterpartyAccountHolderName.trim().toUpperCase() === customer.fullName.trim().toUpperCase();
    if (!namesMatch) {
      if (!input.counterpartyNameMismatchReason?.trim() || input.counterpartyNameMismatchReason.trim().length < 5) {
        throw new Error(`Atas nama rekening lawan ("${input.counterpartyAccountHolderName.trim()}") berbeda dengan nama nasabah ("${customer.fullName}") — wajib diisi keterangan alasan (minimal 5 karakter).`);
      }
      counterpartyNameMismatchReason = input.counterpartyNameMismatchReason.trim();
    }
  }

  // The >=10,000 USD-equivalent review/underlying threshold is measured against the official BI
  // reference sell rate (synced daily via syncBiReferenceRates), not the outlet's own quoted rate —
  // the outlet's rate is negotiable per deal, so anchoring the regulatory threshold to it would let
  // the threshold be gamed by quoting a different rate. Falls open (no trigger) only if BI's rate
  // hasn't synced yet for USD, same fail-open shape the outlet-rate lookup had before.
  const usdBiReferenceRate = (await db.select({ rate: rateReferenceSnapshots }).from(rateReferenceSnapshots)
    .innerJoin(currencies, eq(rateReferenceSnapshots.currencyId, currencies.id))
    .where(and(eq(currencies.code, "USD"), eq(rateReferenceSnapshots.source, "BI_TRANSACTION_RATES"), eq(rateReferenceSnapshots.isDemo, false)))
    .orderBy(desc(rateReferenceSnapshots.referenceDate)).limit(1))[0]?.rate;
  const thresholds = await reviewThresholds();
  const businessDate = jakartaBusinessDate(input.transactionAt);
  const nextDate = nextBusinessDate(businessDate);
  const dailyCashTotal = input.paymentMethod === "CASH"
    ? (await db.select({ total: sql<string>`COALESCE(SUM(${exchangeTransactions.rupiahAmount}), 0)` }).from(exchangeTransactions).where(and(
      eq(exchangeTransactions.customerId, input.customerId),
      eq(exchangeTransactions.paymentMethod, "CASH"),
      gte(exchangeTransactions.transactionAt, businessDate),
      lt(exchangeTransactions.transactionAt, nextDate),
      inArray(exchangeTransactions.status, ["DRAFT", "PENDING_REVIEW", "APPROVED", "RETURNED", "COMPLETED"]),
      eq(exchangeTransactions.isDemo, false),
      eq(exchangeTransactions.isHistorical, false),
    )))[0]?.total ?? "0"
    : "0";
  const cashDailyRupiahTotal = new Decimal(dailyCashTotal).plus(rupiahAmount).toFixed(2);
  const assessment = assessReviewRequirement({ rupiahAmount, thresholdUsd: thresholds.reviewThresholdUsd, usdSellRate: usdBiReferenceRate?.sellRate, usdQuoteUnit: usdBiReferenceRate?.quoteUnit, cashDailyRupiahTotal, eddCashDailyThresholdIdr: thresholds.eddCashDailyThresholdIdr, isCashPayment: input.paymentMethod === "CASH", profileStatus: customer.profileStatus, riskLevel: customer.riskLevel });

  // Underlying stops being optional once the >=10,000 USD-equivalent threshold is met — PBI
  // 18/20/PBI/2016 requires it, so the teller's checkbox choice is overridden, not just defaulted.
  // The business-reason field is required alongside it (separate from underlyingNotes, which is
  // about the documents themselves).
  const underlyingRequired = assessment.exceedsThreshold || (input.underlyingRequired ?? false);
  if (assessment.exceedsThreshold && !input.thresholdReason?.trim()) {
    throw new Error("Transaksi ini mencapai ambang setara USD 10.000 — alasan wajib diisi sebelum melanjutkan.");
  }

  // TKM (Transaksi Keuangan Mencurigakan) — never auto-approved: flagging it always forces human
  // review, and at least one real indicator must be picked (never trust the client's checklist
  // alone; validated again here against the curated list).
  if (input.isSuspiciousTransaction) {
    if (!input.suspiciousIndicators?.length) throw new Error("Pilih minimal satu indikator TKM saat menandai transaksi sebagai mencurigakan.");
    const unknownCode = input.suspiciousIndicators.find((code) => !isKnownSuspiciousIndicatorCode(code));
    if (unknownCode) throw new Error(`Indikator TKM "${unknownCode}" tidak dikenal.`);
  }
  const requiresReview = assessment.requiresReview || Boolean(input.isSuspiciousTransaction);
  const reviewReason = [assessment.reviewReason, input.isSuspiciousTransaction ? "TRANSAKSI_MENCURIGAKAN_TKM" : null].filter(Boolean).join("; ") || null;
  const number = transactionNumber();

  const created = await db.transaction(async (tx) => {
    await tx.insert(exchangeTransactions).values({
      transactionNumber: number,
      receiptNumber,
      transactionAt: input.transactionAt,
      operation: input.operation,
      customerId: input.customerId,
      tellerUserId,
      dealNotes: input.dealNotes?.trim() || null,
      rupiahAmount,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference?.trim() || null,
      bankAccountId: bankAccount?.id ?? null,
      counterpartyBankName: bankAccount ? input.counterpartyBankName!.trim() : null,
      counterpartyAccountNumber: bankAccount ? input.counterpartyAccountNumber!.trim() : null,
      counterpartyAccountHolderName: bankAccount ? input.counterpartyAccountHolderName!.trim() : null,
      counterpartyNameMismatchReason,
      customerFullNameSnapshot: customer.fullName,
      customerIdentityTypeSnapshot: customer.identityType,
      customerIdentityNumberSnapshot: customer.identityNumber,
      customerPhoneSnapshot: customer.phoneNumber,
      customerAddressSnapshot: customer.address,
      customerOccupationSnapshot: customer.occupation,
      sourceOfFundsSnapshot: customer.sourceOfFunds,
      transactionPurposeSnapshot: input.transactionPurposeSnapshot?.trim() || customer.transactionPurpose,
      customerActingAs: input.customerActingAs ?? "SELF",
      representativeCustomerId: representative?.id ?? null,
      representativeName: representative?.fullName ?? null,
      representativeIdentityNumber: representative?.identityNumber ?? null,
      underlyingRequired,
      underlyingReference: input.underlyingReference?.trim() || null,
      underlyingNotes: input.underlyingNotes?.trim() || null,
      thresholdReason: input.thresholdReason?.trim() || null,
      isSuspiciousTransaction: input.isSuspiciousTransaction ?? false,
      suspiciousIndicators: input.isSuspiciousTransaction ? input.suspiciousIndicators ?? null : null,
      suspiciousNotes: input.isSuspiciousTransaction ? input.suspiciousNotes?.trim() || null : null,
      status: "DRAFT",
      requiresReview,
      reviewStatus: requiresReview ? "NEEDS_REVIEW" : "NOT_REVIEWED",
      reviewReason,
    });
    const row = (await tx.select().from(exchangeTransactions).where(eq(exchangeTransactions.transactionNumber, number)).limit(1))[0];
    if (!row) throw new Error("Transaksi tidak dapat dibuat.");
    for (const [index, line] of Array.from(preparedLines.entries())) {
      const [insertedLine] = await tx.insert(exchangeTransactionLines).values({
        transactionId: row.id,
        lineNumber: index + 1,
        currencyId: line.currencyId,
        operationalRateId: line.operationalRateId,
        referenceRateSnapshot: line.referenceRateSnapshot,
        quoteUnit: line.quoteUnit,
        agreedRate: line.agreedRate,
        foreignAmount: line.foreignAmount,
        rupiahAmount: line.rupiahAmount,
      }).$returningId();
      if (insertedLine) {
        await tx.insert(exchangeTransactionDenominationEntries).values(line.denominationRows.map((entry) => ({ transactionId: row.id, transactionLineId: insertedLine.id, denominationValue: entry.denominationValue, quantity: entry.quantity, lineTotal: entry.lineTotal, agreedRate: entry.agreedRate })));
      }
    }
    if (paymentDenominationRows.length && paymentCurrencyId) {
      await tx.insert(exchangeTransactionPaymentDenominations).values(paymentDenominationRows.map((entry) => ({ transactionId: row.id, currencyId: paymentCurrencyId, denominationValue: entry.denominationValue, quantity: entry.quantity, lineTotal: entry.subtotal })));
    }
    return row;
  });
  await writeAudit({ actorUserId: tellerUserId, action: "TRANSACTION_DRAFT_CREATED", entityType: "exchange_transaction", entityId: String(created.id), afterState: { transactionNumber: number, receiptNumber, operation: input.operation, lineCount: preparedLines.length, rupiahAmount, requiresReview, reviewReason, underlyingRequired: created.underlyingRequired } });
  return created;
}

export async function submitTransaction(transactionId: number, actor: { id: number; role: StaffRole }) {
  const db = await databaseOrThrow();
  const transaction = (await db.select().from(exchangeTransactions).where(and(eq(exchangeTransactions.id, transactionId), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false))).limit(1))[0];
  if (!transaction) throw new Error("Transaksi tidak ditemukan.");
  if (transaction.isDemo || transaction.isHistorical) throw new Error("Transaksi demo atau historis tidak dapat diproses pada operasi live.");
  if (actor.role === "STAFF" && transaction.tellerUserId !== actor.id) throw new Error("Staff hanya dapat mengirim transaksi miliknya sendiri.");
  if (!(["DRAFT", "RETURNED"] as const).includes(transaction.status as "DRAFT" | "RETURNED")) throw new Error("Hanya transaksi DRAFT atau RETURNED yang dapat dikirim.");
  if (transaction.underlyingRequired) {
    const underlyingDocs = await db.select({ documentType: operationalDocuments.documentType }).from(operationalDocuments).where(and(
      eq(operationalDocuments.transactionId, transaction.id),
      inArray(operationalDocuments.documentType, ["UNDERLYING_FORM", "UNDERLYING_STATEMENT", "UNDERLYING_INVOICE"]),
    ));
    const uploadedTypes = new Set(underlyingDocs.map((doc) => doc.documentType));
    const missing = [
      !uploadedTypes.has("UNDERLYING_FORM") ? "Formulir Underlying" : null,
      !uploadedTypes.has("UNDERLYING_STATEMENT") ? "Surat Pernyataan" : null,
      !uploadedTypes.has("UNDERLYING_INVOICE") ? "Invoice" : null,
    ].filter(Boolean);
    if (missing.length) throw new Error(`Unggah dokumen underlying berikut sebelum mengirim bon transaksi ini: ${missing.join(", ")}.`);
  }
  const next = submissionTransition(transaction.status as "DRAFT" | "RETURNED", transaction.requiresReview);
  await db.update(exchangeTransactions).set(next).where(eq(exchangeTransactions.id, transactionId));
  await writeAudit({ actorUserId: actor.id, action: "TRANSACTION_SUBMITTED", entityType: "exchange_transaction", entityId: String(transactionId), beforeState: { status: transaction.status }, afterState: next });
  if (next.status === "APPROVED") {
    // Low-risk bon: no human review required, so the physical exchange is already final by the time this
    // is recorded — post cash/stock immediately instead of waiting on a separate manual "Selesaikan" click.
    return completeTransaction(transactionId, actor);
  }
  return { ...transaction, ...next };
}

export async function cancelTransaction(transactionId: number, reason: string, actor: { id: number; role: StaffRole }) {
  const db = await databaseOrThrow();
  const transaction = (await db.select().from(exchangeTransactions).where(and(eq(exchangeTransactions.id, transactionId), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false))).limit(1))[0];
  if (!transaction) throw new Error("Transaksi tidak ditemukan.");
  if (transaction.isDemo || transaction.isHistorical) throw new Error("Transaksi demo atau historis tidak dapat diproses pada operasi live.");
  if (actor.role === "STAFF" && transaction.tellerUserId !== actor.id) throw new Error("Staff hanya dapat membatalkan transaksi miliknya sendiri.");
  assertTransactionCanBeCancelled(transaction.status);
  const cancelledAt = new Date();
  await db.update(exchangeTransactions).set({ status: "CANCELLED", cancelledByUserId: actor.id, cancelledAt, cancellationReason: reason }).where(eq(exchangeTransactions.id, transactionId));
  await writeAudit({ actorUserId: actor.id, action: "TRANSACTION_CANCELLED", entityType: "exchange_transaction", entityId: String(transactionId), beforeState: { status: transaction.status }, afterState: { status: "CANCELLED", cancelledAt }, reason });
  return { ...transaction, status: "CANCELLED" as const, cancelledByUserId: actor.id, cancelledAt, cancellationReason: reason };
}

export async function recordReviewAction(input: { transactionId: number; action: "APPROVED" | "RETURNED" | "ESCALATED"; notes: string }, actor: { id: number; role: StaffRole }) {
  const db = await databaseOrThrow();
  const transaction = (await db.select().from(exchangeTransactions).where(and(eq(exchangeTransactions.id, input.transactionId), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false))).limit(1))[0];
  if (!transaction || transaction.status !== "PENDING_REVIEW") throw new Error("Hanya transaksi PENDING_REVIEW yang dapat ditinjau.");
  if (transaction.isDemo || transaction.isHistorical) throw new Error("Transaksi demo atau historis tidak dapat diproses pada operasi live.");
  const reviewedAt = new Date();
  const next = input.action === "APPROVED"
    ? { status: "APPROVED" as const, reviewStatus: "REVIEWED" as const }
    : input.action === "RETURNED"
      ? { status: "RETURNED" as const, reviewStatus: "NEEDS_REVIEW" as const }
      : { status: "PENDING_REVIEW" as const, reviewStatus: "ESCALATED" as const };
  const result = await db.transaction(async (tx) => {
    await tx.update(exchangeTransactions).set({ ...next, reviewedByUserId: actor.id, reviewedAt, reviewerNotes: input.notes }).where(eq(exchangeTransactions.id, input.transactionId));
    await tx.insert(transactionReviewActions).values({ transactionId: input.transactionId, action: input.action, reviewerUserId: actor.id, notes: input.notes });
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: `TRANSACTION_REVIEW_${input.action}`, entityType: "exchange_transaction", entityId: String(input.transactionId), beforeState: { status: transaction.status, reviewStatus: transaction.reviewStatus }, afterState: { ...next, reviewedAt }, reason: input.notes });
    return { ...transaction, ...next, reviewedByUserId: actor.id, reviewedAt, reviewerNotes: input.notes };
  });
  if (input.action === "APPROVED") {
    await createDirectorKnowledgeItem({
      eventType: "FLAGGED_TRANSACTION_APPROVED",
      entityType: "exchange_transaction",
      entityId: String(input.transactionId),
      title: `Transaksi ${transaction.transactionNumber} disetujui Supervisor`,
      detail: `Transaksi ter-flag telah disetujui oleh Supervisor. Catatan keputusan: ${input.notes}`,
      createdByUserId: actor.id,
    });
    // Supervisor approval is the final human sign-off for a flagged bon — post cash/stock immediately,
    // same as the auto-approved path, instead of requiring a separate manual "Selesaikan" click.
    return completeTransaction(input.transactionId, actor);
  }
  return result;
}

export function jakartaBusinessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  // MySQL DATE is compared as midnight. Using noon made an existing DATE row
  // invisible to equality queries and triggered a duplicate-key insert.
  return new Date(Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day"))));
}

export type DenominationEntryInput = { value: string; quantity: number };

/** Validates a denomination breakdown against the declared total and returns rows ready to insert. Throws if it doesn't reconcile, so a movement can never be saved with a breakdown that doesn't add up. currencyCode is optional only for call sites that predate per-currency validation being wired through everywhere — new callers should always pass it. */
function reconcileDenominations(entries: DenominationEntryInput[], expectedTotal: Decimal, currencyCode?: string) {
  if (!entries.length) return [];
  let sum = new Decimal(0);
  const rows = entries.map((entry) => {
    const value = nonNegativeOrZeroDecimal(entry.value, "Nilai pecahan");
    if (value.lte(0)) throw new Error("Nilai pecahan harus lebih besar dari nol.");
    assertKnownDenomination(value, currencyCode, "rincian pecahan");
    if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) throw new Error("Jumlah lembar/keping tiap pecahan harus bilangan bulat positif.");
    const subtotal = value.times(entry.quantity);
    sum = sum.plus(subtotal);
    return { denominationValue: value.toFixed(6), quantity: entry.quantity, subtotal: subtotal.toFixed(6) };
  });
  if (!sum.eq(expectedTotal)) throw new Error(`Rincian pecahan (${sum.toFixed(2)}) tidak sama dengan jumlah kas yang dimasukkan (${expectedTotal.toFixed(2)}). Perbaiki rincian sebelum menyimpan.`);
  return rows;
}

/** Resets a currency's running denomination stock to exactly these counts — for opening cash, which declares an authoritative physical count for the day, the same way it SETS cashBalances.availableAmount rather than adding to it. A blank/no-denomination opening leaves prior counts untouched (advisory field, not required every time). */
async function resetDenominationBalances(tx: any, currencyId: number, entries: { value: string; quantity: number }[]) {
  if (!entries.length) return;
  await tx.delete(cashDenominationBalances).where(eq(cashDenominationBalances.currencyId, currencyId));
  await tx.insert(cashDenominationBalances).values(entries.map((entry) => ({ currencyId, denominationValue: new Decimal(entry.value).toFixed(6), quantity: entry.quantity })));
}

/** Adds (sign=1) or removes (sign=-1) notes/coins from a currency's running denomination stock — for adjustments and completed transactions, which move stock by a delta rather than redeclaring it. */
async function applyDenominationBalanceDelta(tx: any, currencyId: number, entries: { value: string; quantity: number }[], sign: 1 | -1) {
  for (const entry of entries) {
    const denominationValue = new Decimal(entry.value).toFixed(6);
    const delta = sign * entry.quantity;
    await tx.insert(cashDenominationBalances).values({ currencyId, denominationValue, quantity: delta }).onDuplicateKeyUpdate({ set: { quantity: sql`${cashDenominationBalances.quantity} + ${delta}` } });
  }
}

/**
 * Refuses to let a bon draft against stock we don't actually have — checks both the aggregate currency
 * balance and every specific denomination required. Only COMPLETED movements count (that's when cash
 * actually moved), so a same-day buy-then-sell (or sell-then-buy-to-cover) works as long as the earlier
 * leg was completed, not just submitted/approved.
 */
async function assertSufficientStock(db: Awaited<ReturnType<typeof databaseOrThrow>>, currencyId: number, currencyCode: string, requiredTotal: Decimal, requiredDenominations: Map<string, number>, verb: string) {
  const balance = (await db.select().from(cashBalances).where(eq(cashBalances.currencyId, currencyId)).limit(1))[0];
  const available = balance ? new Decimal(String(balance.availableAmount)) : new Decimal(0);
  if (available.lt(requiredTotal)) {
    throw new Error(`Stok ${currencyCode} tidak mencukupi untuk ${verb}. Tersedia ${available.toFixed(2)}, dibutuhkan ${requiredTotal.toFixed(2)}. Selesaikan (bukan hanya kirim) transaksi terkait terlebih dahulu bila baru saja bergerak hari ini.`);
  }
  if (!requiredDenominations.size) return;
  const denominationRows = await db.select().from(cashDenominationBalances).where(eq(cashDenominationBalances.currencyId, currencyId));
  const denomAvailable = new Map(denominationRows.map((row) => [new Decimal(String(row.denominationValue)).toFixed(6), row.quantity]));
  for (const [denominationValue, required] of Array.from(requiredDenominations.entries())) {
    const rowAvailable = denomAvailable.get(denominationValue) ?? 0;
    if (rowAvailable < required) throw new Error(`Stok pecahan ${currencyCode} ${denominationValue} tidak mencukupi untuk ${verb} (tersedia ${rowAvailable}, dibutuhkan ${required}).`);
  }
}

export type PricedDenominationInput = { value: string; quantity: number; rate: string };

/**
 * Transaction bons price by denomination, not by line: e.g. USD 100s at one rate, USD 10s at another,
 * within the same currency/deal. Every row is its own priced group — unlike reconcileDenominations
 * (cash movements only), there is no separate "declared total" to reconcile against; the line's
 * foreign/rupiah totals are simply the sum of these rows. Requires at least one row.
 */
function reconcilePricedDenominations(entries: PricedDenominationInput[], quoteUnit: Decimal, lineLabel: string, currencyCode: string) {
  if (!entries.length) throw new Error(`Rincian pecahan wajib diisi minimal satu baris pada ${lineLabel}.`);
  let totalForeign = new Decimal(0);
  let totalRupiah = new Decimal(0);
  const rows = entries.map((entry) => {
    const value = nonNegativeOrZeroDecimal(entry.value, "Nilai pecahan");
    if (value.lte(0)) throw new Error(`Nilai pecahan pada ${lineLabel} harus lebih besar dari nol.`);
    assertKnownDenomination(value, currencyCode, lineLabel);
    if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) throw new Error(`Jumlah lembar/keping tiap pecahan pada ${lineLabel} harus bilangan bulat positif.`);
    const rate = nonNegativeDecimal(entry.rate, "Harga pecahan");
    if (rate.lte(0)) throw new Error(`Harga pecahan pada ${lineLabel} harus lebih besar dari nol.`);
    const foreignSubtotal = value.times(entry.quantity);
    const rupiahSubtotal = foreignSubtotal.times(rate).div(quoteUnit).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    totalForeign = totalForeign.plus(foreignSubtotal);
    totalRupiah = totalRupiah.plus(rupiahSubtotal);
    return { denominationValue: value.toFixed(6), quantity: entry.quantity, lineTotal: foreignSubtotal.toFixed(6), agreedRate: rate.toFixed(6), rupiahSubtotal: rupiahSubtotal.toFixed(2) };
  });
  return { rows, totalForeign, totalRupiah: totalRupiah.toFixed(2) };
}

export function openingCashMovementReason(currencyCode: string, businessDate = jakartaBusinessDate()) {
  return `OPENING_CASH_${businessDate.toISOString().slice(0, 10)}_${currencyCode.trim().toUpperCase()}`;
}

export function calculateOpeningCashAdjustment(currentBalance: string, declaredOpeningAmount: string) {
  const current = nonNegativeOrZeroDecimal(currentBalance, "Saldo sistem");
  const declared = nonNegativeOrZeroDecimal(declaredOpeningAmount, "Kas pembukaan");
  return declared.minus(current).toFixed(6);
}

export async function getDailyOperationalChecklist() {
  const db = await databaseOrThrow();
  const businessDate = jakartaBusinessDate();
  const readChecklist = async () => (await db.select().from(dailyOperationalChecklists).where(eq(dailyOperationalChecklists.businessDate, businessDate)).limit(1))[0];
  const existing = await readChecklist();
  if (existing) return existing;
  let insertError: unknown = null;
  try {
    await db.insert(dailyOperationalChecklists).values({ businessDate, openingChecks: emptyChecklist(OPENING_CHECKLIST_KEYS), closingChecks: emptyChecklist(CLOSING_CHECKLIST_KEYS) });
  } catch (error) {
    // Two browser requests can initialize the same Jakarta business day simultaneously.
    // The read below is authoritative: rethrow only if no competing request created the row.
    insertError = error;
  }
  const created = await waitForConcurrentInitialization(readChecklist);
  if (!created) throw insertError instanceof Error ? insertError : new Error("Checklist operasional harian tidak dapat disiapkan.");
  return created;
}

export async function updateDailyOperationalChecklist(input: { phase: "OPENING" | "CLOSING"; checks: Record<string, unknown>; notes?: string }, actorUserId: number) {
  const current = await getDailyOperationalChecklist();
  const keys = input.phase === "OPENING" ? OPENING_CHECKLIST_KEYS : CLOSING_CHECKLIST_KEYS;
  const nextChecks = normalizeChecklist(input.checks, keys);
  const complete = isChecklistComplete(nextChecks, keys);
  const now = new Date();
  const db = await databaseOrThrow();
  const values = input.phase === "OPENING"
    ? { openingChecks: nextChecks, openingCompletedAt: complete ? now : null, openingCompletedByUserId: complete ? actorUserId : null, notes: input.notes?.trim() || current.notes }
    : { closingChecks: nextChecks, closingCompletedAt: complete ? now : null, closingCompletedByUserId: complete ? actorUserId : null, notes: input.notes?.trim() || current.notes };
  await db.update(dailyOperationalChecklists).set(values).where(eq(dailyOperationalChecklists.id, current.id));
  const updated = (await db.select().from(dailyOperationalChecklists).where(eq(dailyOperationalChecklists.id, current.id)).limit(1))[0];
  if (!updated) throw new Error("Checklist operasional tidak dapat diperbarui.");
  await writeAudit({ actorUserId, action: input.phase === "OPENING" ? "DAILY_OPENING_CHECKLIST_UPDATED" : "DAILY_CLOSING_CHECKLIST_UPDATED", entityType: "daily_operational_checklist", entityId: String(updated.id), beforeState: input.phase === "OPENING" ? { checks: current.openingChecks } : { checks: current.closingChecks }, afterState: { checks: nextChecks, complete }, reason: input.notes?.trim() || null });
  return updated;
}

function nextBusinessDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 12));
}

export async function completeTransaction(transactionId: number, actor: { id: number; role: StaffRole }) {
  const db = await databaseOrThrow();
  const result = await db.transaction(async (tx) => {
    const transaction = (await tx.select().from(exchangeTransactions).where(and(eq(exchangeTransactions.id, transactionId), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false))).limit(1))[0];
    if (!transaction) throw new Error("Transaksi tidak ditemukan.");
    if (transaction.isDemo || transaction.isHistorical) throw new Error("Transaksi demo atau historis tidak dapat diproses pada operasi live.");
    if (actor.role === "STAFF" && transaction.tellerUserId !== actor.id) throw new Error("Staff hanya dapat menyelesaikan transaksi miliknya sendiri.");
    if (transaction.status !== "APPROVED") throw new Error("Hanya transaksi APPROVED yang dapat diselesaikan.");

    const lines = await tx.select().from(exchangeTransactionLines).where(eq(exchangeTransactionLines.transactionId, transactionId)).orderBy(exchangeTransactionLines.lineNumber);
    // Bons created before multi-line bons existed have no rows here; post cash from the legacy header columns instead.
    const postingLines = lines.length
      ? lines.map((line) => ({ currencyId: line.currencyId, foreignAmount: line.foreignAmount, transactionLineId: line.id as number | null }))
      : (transaction.currencyId && transaction.foreignAmount ? [{ currencyId: transaction.currencyId, foreignAmount: transaction.foreignAmount, transactionLineId: null }] : []);
    if (!postingLines.length) throw new Error("Bon tidak memiliki baris mata uang untuk diposting ke kas.");
    const realLineIds = lines.map((line) => line.id);
    const denominationsByLineId = new Map<number, { denominationValue: string; quantity: number }[]>();
    if (realLineIds.length) {
      const denominationRows = await tx.select().from(exchangeTransactionDenominationEntries).where(inArray(exchangeTransactionDenominationEntries.transactionLineId, realLineIds));
      for (const row of denominationRows) {
        if (row.transactionLineId == null) continue;
        const existing = denominationsByLineId.get(row.transactionLineId) ?? [];
        existing.push({ denominationValue: row.denominationValue, quantity: row.quantity });
        denominationsByLineId.set(row.transactionLineId, existing);
      }
    }

    const direction = transaction.operation === "BUY" ? "IN" as const : "OUT" as const;
    const opnameDate = jakartaBusinessDate();
    const cashResults: { currencyId: number; before: string; after: string }[] = [];
    for (const [index, postingLine] of Array.from(postingLines.entries())) {
      await tx.insert(cashBalances).values({ currencyId: postingLine.currencyId, availableAmount: "0.000000" }).onDuplicateKeyUpdate({ set: { currencyId: sql`${cashBalances.currencyId}` } });
      await tx.execute(sql`SELECT ${cashBalances.id} FROM ${cashBalances} WHERE ${cashBalances.currencyId} = ${postingLine.currencyId} FOR UPDATE`);
      const balance = (await tx.select().from(cashBalances).where(eq(cashBalances.currencyId, postingLine.currencyId)).limit(1))[0];
      if (!balance) throw new Error("Saldo kas tidak dapat dikunci.");
      const movementAmount = new Decimal(String(postingLine.foreignAmount));
      const beforeBalance = new Decimal(String(balance.availableAmount));
      const afterBalance = new Decimal(calculateCashBalanceAfter(transaction.operation, beforeBalance.toFixed(6), movementAmount.toFixed(6)));
      await tx.update(cashBalances).set({ availableAmount: afterBalance.toFixed(6) }).where(eq(cashBalances.id, balance.id));
      const reason = postingLines.length > 1 ? `TRANSACTION_${transaction.operation}_${transaction.transactionNumber}_L${index + 1}` : `TRANSACTION_${transaction.operation}_${transaction.transactionNumber}`;
      const [cashMovement] = await tx.insert(cashBalanceMovements).values({ cashBalanceId: balance.id, transactionId: transaction.id, transactionLineId: postingLine.transactionLineId, direction, amount: movementAmount.toFixed(6), reason, createdByUserId: actor.id }).$returningId();
      const lineDenominations = postingLine.transactionLineId != null ? denominationsByLineId.get(postingLine.transactionLineId) : undefined;
      if (lineDenominations?.length && cashMovement) {
        await tx.insert(cashDenominationEntries).values(lineDenominations.map((entry) => ({ cashBalanceMovementId: cashMovement.id, denominationValue: entry.denominationValue, quantity: entry.quantity, subtotal: new Decimal(entry.denominationValue).times(entry.quantity).toFixed(6) })));
        await applyDenominationBalanceDelta(tx, postingLine.currencyId, lineDenominations.map((entry) => ({ value: entry.denominationValue, quantity: entry.quantity })), direction === "IN" ? 1 : -1);
      }

      const existingOpname = (await tx.select().from(stockOpnames).where(and(eq(stockOpnames.opnameDate, opnameDate), eq(stockOpnames.currencyId, postingLine.currencyId), eq(stockOpnames.reconciliationStatus, "OPEN"), eq(stockOpnames.isDemo, false), eq(stockOpnames.isHistorical, false))).limit(1))[0];
      if (existingOpname) {
        await tx.update(stockOpnames).set({
          purchases: transaction.operation === "BUY" ? sql`${stockOpnames.purchases} + ${movementAmount.toFixed(6)}` : existingOpname.purchases,
          sales: transaction.operation === "SELL" ? sql`${stockOpnames.sales} + ${movementAmount.toFixed(6)}` : existingOpname.sales,
          closingSystemBalance: afterBalance.toFixed(6),
        }).where(eq(stockOpnames.id, existingOpname.id));
      }
      cashResults.push({ currencyId: postingLine.currencyId, before: beforeBalance.toFixed(6), after: afterBalance.toFixed(6) });
    }

    // The other side of a CASH deal: physical Rupiah moves opposite the foreign currency (BUY pays it
    // out, SELL takes it in). Bank transfer/other never touch physical stock, so nothing to post there;
    // a bon predating this feature has no payment-denomination rows either, so this is a no-op for it.
    const paymentRows = transaction.paymentMethod === "CASH"
      ? await tx.select().from(exchangeTransactionPaymentDenominations).where(eq(exchangeTransactionPaymentDenominations.transactionId, transactionId))
      : [];
    if (paymentRows.length) {
      const paymentCurrencyId = paymentRows[0].currencyId;
      const paymentTotal = paymentRows.reduce((sum, row) => sum.plus(String(row.lineTotal)), new Decimal(0));
      const paymentDirection = transaction.operation === "BUY" ? "OUT" as const : "IN" as const;
      await tx.insert(cashBalances).values({ currencyId: paymentCurrencyId, availableAmount: "0.000000" }).onDuplicateKeyUpdate({ set: { currencyId: sql`${cashBalances.currencyId}` } });
      await tx.execute(sql`SELECT ${cashBalances.id} FROM ${cashBalances} WHERE ${cashBalances.currencyId} = ${paymentCurrencyId} FOR UPDATE`);
      const paymentBalance = (await tx.select().from(cashBalances).where(eq(cashBalances.currencyId, paymentCurrencyId)).limit(1))[0];
      if (!paymentBalance) throw new Error("Saldo kas Rupiah tidak dapat dikunci.");
      const paymentBefore = new Decimal(String(paymentBalance.availableAmount));
      // calculateCashBalanceAfter treats BUY as +amount/SELL as -amount; Rupiah needs the opposite of the
      // deal's own operation, so the flipped operation is passed in rather than duplicating that math.
      const paymentAfter = new Decimal(calculateCashBalanceAfter(transaction.operation === "BUY" ? "SELL" : "BUY", paymentBefore.toFixed(6), paymentTotal.toFixed(6)));
      await tx.update(cashBalances).set({ availableAmount: paymentAfter.toFixed(6) }).where(eq(cashBalances.id, paymentBalance.id));
      const [paymentMovement] = await tx.insert(cashBalanceMovements).values({ cashBalanceId: paymentBalance.id, transactionId: transaction.id, transactionLineId: null, direction: paymentDirection, amount: paymentTotal.toFixed(6), reason: `TRANSACTION_${transaction.operation}_${transaction.transactionNumber}_IDR`, createdByUserId: actor.id }).$returningId();
      if (paymentMovement) {
        await tx.insert(cashDenominationEntries).values(paymentRows.map((row) => ({ cashBalanceMovementId: paymentMovement.id, denominationValue: row.denominationValue, quantity: row.quantity, subtotal: row.lineTotal })));
        await applyDenominationBalanceDelta(tx, paymentCurrencyId, paymentRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })), paymentDirection === "IN" ? 1 : -1);
      }
      cashResults.push({ currencyId: paymentCurrencyId, before: paymentBefore.toFixed(6), after: paymentAfter.toFixed(6) });
    }

    // Bank transfer leg: same IN/OUT direction logic as the CASH payment leg above (BUY pays the
    // customer out, SELL takes payment in), just posted against a bank account balance instead of
    // physical stock — no denominations, since there are no notes to count.
    let bankResult: { bankAccountId: number; before: string; after: string } | null = null;
    if (transaction.paymentMethod === "BANK_TRANSFER" && transaction.bankAccountId) {
      await tx.execute(sql`SELECT ${bankAccounts.id} FROM ${bankAccounts} WHERE ${bankAccounts.id} = ${transaction.bankAccountId} FOR UPDATE`);
      const account = (await tx.select().from(bankAccounts).where(eq(bankAccounts.id, transaction.bankAccountId)).limit(1))[0];
      if (!account) throw new Error("Rekening bank untuk transaksi ini tidak ditemukan.");
      const bankBefore = new Decimal(String(account.availableAmount));
      const bankDirection = transaction.operation === "BUY" ? "OUT" as const : "IN" as const;
      const bankAfter = new Decimal(calculateCashBalanceAfter(transaction.operation === "BUY" ? "SELL" : "BUY", bankBefore.toFixed(6), String(transaction.rupiahAmount)));
      await tx.update(bankAccounts).set({ availableAmount: bankAfter.toFixed(6) }).where(eq(bankAccounts.id, account.id));
      await tx.insert(bankAccountMovements).values({ bankAccountId: account.id, transactionId: transaction.id, transactionLineId: null, direction: bankDirection, amount: String(transaction.rupiahAmount), reason: `TRANSACTION_${transaction.operation}_${transaction.transactionNumber}_IDR`, category: "TRANSACTION", createdByUserId: actor.id });
      bankResult = { bankAccountId: account.id, before: bankBefore.toFixed(6), after: bankAfter.toFixed(6) };
    }

    await tx.update(exchangeTransactions).set({ status: "COMPLETED" }).where(eq(exchangeTransactions.id, transactionId));
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: "TRANSACTION_COMPLETED_AND_CASH_POSTED", entityType: "exchange_transaction", entityId: String(transaction.id), beforeState: { status: transaction.status }, afterState: { status: "COMPLETED", cashResults, bankResult }, metadata: { transactionNumber: transaction.transactionNumber, lineCount: postingLines.length } });
    return { ...transaction, status: "COMPLETED" as const, cashResults, bankResult };
  });
  return result;
}

/** The single company-profile row (id ascending, first one), or null if never configured yet — printed receipts and regulator screens fall back to sensible defaults when this is null. */
export async function getCompanyProfile() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return (await db.select().from(companyProfile).orderBy(companyProfile.id).limit(1))[0] ?? null;
  });
}

/** Creates or updates the single company-profile row — Controller/Shareholder only (enforced at the router). Upsert-by-existence rather than a fixed id, since a fresh install has no row yet. */
export async function updateCompanyProfile(
  input: {
    legalEntityName: string; tradingName: string; licenseNumber?: string; kupvaCode?: string; npwp?: string; nib?: string;
    biReporterCode?: string; address?: string; phone?: string; email?: string; website?: string; logoDocumentId?: number;
  },
  actor: { id: number; role: StaffRole },
) {
  const legalEntityName = input.legalEntityName.trim();
  const tradingName = input.tradingName.trim();
  if (!legalEntityName || !tradingName) throw new Error("Nama PT dan nama moneychanger wajib diisi.");

  const db = await databaseOrThrow();
  const values = {
    legalEntityName, tradingName,
    licenseNumber: input.licenseNumber?.trim() || null, kupvaCode: input.kupvaCode?.trim() || null,
    npwp: input.npwp?.trim() || null, nib: input.nib?.trim() || null, biReporterCode: input.biReporterCode?.trim() || null,
    address: input.address?.trim() || null, phone: input.phone?.trim() || null, email: input.email?.trim() || null, website: input.website?.trim() || null,
    logoDocumentId: input.logoDocumentId ?? null, updatedByUserId: actor.id,
  };
  const existing = (await db.select({ id: companyProfile.id }).from(companyProfile).orderBy(companyProfile.id).limit(1))[0];
  if (existing) {
    await db.update(companyProfile).set(values).where(eq(companyProfile.id, existing.id));
  } else {
    await db.insert(companyProfile).values(values);
  }
  await writeAudit({ actorUserId: actor.id, action: "COMPANY_PROFILE_UPDATED", entityType: "company_profile", entityId: String(existing?.id ?? "new"), afterState: values });
  return (await db.select().from(companyProfile).orderBy(companyProfile.id).limit(1))[0];
}

/** Every company bank account and its running balance — includes inactive accounts so Controller/Shareholder can still see history; the transaction form filters to active ones itself. */
export async function listBankAccounts() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select({ account: bankAccounts, currency: currencies }).from(bankAccounts)
      .innerJoin(currencies, eq(bankAccounts.currencyId, currencies.id))
      .orderBy(bankAccounts.bankName, bankAccounts.accountHolderName);
  });
}

/** Declares a new company bank account with its opening balance — the bank-account equivalent of recordOpeningCash, minus denominations (nothing physical to count). */
export async function createBankAccount(
  input: { bankName: string; accountHolderName: string; accountNumber: string; currencyId: number; openingBalance: string; notes?: string },
  actor: { id: number; role: StaffRole },
) {
  const bankName = input.bankName.trim();
  const accountHolderName = input.accountHolderName.trim();
  const accountNumber = input.accountNumber.trim();
  if (!bankName || !accountHolderName || !accountNumber) throw new Error("Nama bank, nama pemilik rekening, dan nomor rekening wajib diisi.");
  const openingBalance = nonNegativeOrZeroDecimal(input.openingBalance, "Saldo awal rekening");

  const db = await databaseOrThrow();
  const currency = (await db.select({ id: currencies.id, code: currencies.code }).from(currencies).where(and(eq(currencies.id, input.currencyId), eq(currencies.active, true))).limit(1))[0];
  if (!currency) throw new Error("Mata uang aktif tidak ditemukan.");

  return db.transaction(async (tx) => {
    const [created] = await tx.insert(bankAccounts).values({
      bankName, accountHolderName, accountNumber, currencyId: currency.id,
      availableAmount: openingBalance.toFixed(6), notes: input.notes?.trim() || null, createdByUserId: actor.id,
    }).$returningId();
    if (!created) throw new Error("Rekening bank tidak dapat disimpan.");
    await tx.insert(bankAccountMovements).values({ bankAccountId: created.id, direction: "ADJUSTMENT", amount: openingBalance.toFixed(6), reason: `Saldo awal rekening ${bankName} ${accountNumber}`, category: "OPENING", createdByUserId: actor.id });
    await writeAudit({ actorUserId: actor.id, action: "BANK_ACCOUNT_CREATED", entityType: "bank_account", entityId: String(created.id), afterState: { bankName, accountHolderName, accountNumber, currencyCode: currency.code, openingBalance: openingBalance.toFixed(6) }, reason: input.notes?.trim() || null });
    return { id: created.id, bankName, accountHolderName, accountNumber, currencyCode: currency.code, availableAmount: openingBalance.toFixed(6) };
  });
}

/** Metadata-only edit (bank name, holder name, account number, notes, active flag) — balance never moves through this path, only through opening/adjustment/completed transfers, same separation cash keeps between "declare the account" and "move its money". */
export async function updateBankAccount(
  input: { bankAccountId: number; bankName: string; accountHolderName: string; accountNumber: string; active: boolean; notes?: string },
  actor: { id: number; role: StaffRole },
) {
  const bankName = input.bankName.trim();
  const accountHolderName = input.accountHolderName.trim();
  const accountNumber = input.accountNumber.trim();
  if (!bankName || !accountHolderName || !accountNumber) throw new Error("Nama bank, nama pemilik rekening, dan nomor rekening wajib diisi.");

  const db = await databaseOrThrow();
  const existing = (await db.select().from(bankAccounts).where(eq(bankAccounts.id, input.bankAccountId)).limit(1))[0];
  if (!existing) throw new Error("Rekening bank tidak ditemukan.");
  await db.update(bankAccounts).set({ bankName, accountHolderName, accountNumber, active: input.active, notes: input.notes?.trim() || null }).where(eq(bankAccounts.id, input.bankAccountId));
  await writeAudit({
    actorUserId: actor.id, action: "BANK_ACCOUNT_UPDATED", entityType: "bank_account", entityId: String(input.bankAccountId),
    beforeState: { bankName: existing.bankName, accountHolderName: existing.accountHolderName, accountNumber: existing.accountNumber, active: existing.active, notes: existing.notes },
    afterState: { bankName, accountHolderName, accountNumber, active: input.active, notes: input.notes?.trim() || null },
  });
  return { id: input.bankAccountId, bankName, accountHolderName, accountNumber, active: input.active };
}

/** Manual correction to a bank account's balance — e.g. a bank fee, interest posted, or fixing a data-entry mistake. Always requires a reason, same as recordCashAdjustment. */
export async function recordBankAccountAdjustment(
  input: { bankAccountId: number; direction: "IN" | "OUT"; amount: string; notes: string },
  actor: { id: number; role: StaffRole },
) {
  const amount = nonNegativeOrZeroDecimal(input.amount, "Jumlah penyesuaian");
  if (amount.lte(0)) throw new Error("Jumlah penyesuaian harus lebih besar dari nol.");
  const notes = input.notes.trim();
  if (notes.length < 5) throw new Error("Catatan penyesuaian wajib diisi (minimal 5 karakter) untuk jejak audit.");

  const db = await databaseOrThrow();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT ${bankAccounts.id} FROM ${bankAccounts} WHERE ${bankAccounts.id} = ${input.bankAccountId} FOR UPDATE`);
    const account = (await tx.select().from(bankAccounts).where(eq(bankAccounts.id, input.bankAccountId)).limit(1))[0];
    if (!account) throw new Error("Rekening bank tidak ditemukan.");
    const before = new Decimal(String(account.availableAmount));
    if (input.direction === "OUT" && before.lt(amount)) throw new Error("Jumlah penyesuaian melebihi saldo rekening yang tersedia.");
    const after = input.direction === "OUT" ? before.minus(amount) : before.plus(amount);
    await tx.update(bankAccounts).set({ availableAmount: after.toFixed(6) }).where(eq(bankAccounts.id, account.id));
    await tx.insert(bankAccountMovements).values({ bankAccountId: account.id, direction: input.direction, amount: amount.toFixed(6), reason: notes, category: "ADJUSTMENT", createdByUserId: actor.id });
    await writeAudit({ actorUserId: actor.id, action: "BANK_ACCOUNT_ADJUSTMENT_RECORDED", entityType: "bank_account", entityId: String(account.id), beforeState: { availableAmount: before.toFixed(6) }, afterState: { availableAmount: after.toFixed(6) }, reason: notes, metadata: { direction: input.direction, amount: amount.toFixed(6) } });
    return { id: account.id, beforeAmount: before.toFixed(6), afterAmount: after.toFixed(6) };
  });
}

export async function listCashBalances() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select({ balance: cashBalances, currency: currencies }).from(cashBalances).innerJoin(currencies, eq(cashBalances.currencyId, currencies.id)).orderBy(currencies.code);
  });
}

/** Current running stock per denomination (see cashDenominationBalances) — the system-expected physical count to compare against at closing, and what SELL bons are checked against at creation. Zero-quantity rows are kept out of the read to avoid clutter from fully-spent denominations. */
export async function listCashDenominationBalances() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select({ balance: cashDenominationBalances, currency: currencies }).from(cashDenominationBalances)
      .innerJoin(currencies, eq(cashDenominationBalances.currencyId, currencies.id))
      .where(gt(cashDenominationBalances.quantity, 0))
      .orderBy(currencies.code, desc(cashDenominationBalances.denominationValue));
  });
}

function gcdBig(a: bigint, b: bigint): bigint {
  a = a < BigInt(0) ? -a : a;
  b = b < BigInt(0) ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

const DENOMINATION_SUGGESTION_SCALE = 6;
const DENOMINATION_SUGGESTION_STATE_CAP = 200_000;

/** Largest-denomination-first, capped by what's actually in stock — used only as the fallback when an exact combination can't be found (or the search space is too large to solve exactly), so the teller still gets a usable starting point instead of nothing. */
function greedyDenominationBreakdown(denoms: { value: string; valueBig: bigint; quantity: number }[], targetBig: bigint) {
  const sorted = [...denoms].sort((a, b) => (b.valueBig > a.valueBig ? 1 : a.valueBig > b.valueBig ? -1 : 0));
  let remaining = targetBig;
  const breakdown: { value: string; quantity: number }[] = [];
  for (const denom of sorted) {
    if (remaining <= BigInt(0) || denom.valueBig <= BigInt(0)) continue;
    const want = remaining / denom.valueBig;
    const used = want > BigInt(denom.quantity) ? BigInt(denom.quantity) : want;
    if (used > BigInt(0)) {
      breakdown.push({ value: denom.value, quantity: Number(used) });
      remaining -= used * denom.valueBig;
    }
  }
  return { breakdown, remaining };
}

/**
 * Suggests a denomination breakdown that sums exactly to `targetAmount`, built only from currency
 * actually in `cash_denomination_balances` right now — a UX helper so a teller doesn't have to
 * mentally solve "which real notes do we have on hand that add up to this" by hand for every bon.
 * This never loosens the "pecahan wajib" rule: it only pre-fills a combination that (a) uses real
 * curated denominations and (b) is provably available in current stock; the teller can still edit
 * it, and the usual reconcile/stock-sufficiency checks still run unchanged at submit time.
 */
export async function suggestDenominationBreakdown(input: { currencyId: number; targetAmount: string }) {
  const db = await databaseOrThrow();
  const currency = (await db.select({ code: currencies.code }).from(currencies).where(eq(currencies.id, input.currencyId)).limit(1))[0];
  if (!currency) throw new Error("Mata uang tidak ditemukan.");

  const target = new Decimal(input.targetAmount);
  if (target.lte(0)) throw new Error("Jumlah target harus lebih besar dari nol.");

  const stockRowsRaw = await db.select({ value: cashDenominationBalances.denominationValue, quantity: cashDenominationBalances.quantity })
    .from(cashDenominationBalances)
    .where(and(eq(cashDenominationBalances.currencyId, input.currencyId), gt(cashDenominationBalances.quantity, 0)));
  if (!stockRowsRaw.length) throw new Error(`Belum ada stok pecahan ${currency.code} yang tercatat untuk diisi otomatis.`);
  // Normalize "100000.000000" (raw decimal(24,6) column) down to "100000" — denomination values are
  // always whole numbers, and the client's dropdown options are plain integer strings; a mismatch here
  // means the UI's denomination Select can't find its selected option and renders as unset.
  const stockRows = stockRowsRaw.map((row) => ({ value: new Decimal(row.value).toFixed(0), quantity: row.quantity }));

  const factor = new Decimal(10).pow(DENOMINATION_SUGGESTION_SCALE);
  const targetUnits = target.mul(factor);
  if (!targetUnits.isInteger()) throw new Error("Jumlah target memiliki presisi desimal yang tidak didukung untuk auto-isi.");
  const targetBig = BigInt(targetUnits.toFixed(0));

  const denoms = stockRows.map((row) => ({ value: row.value, valueBig: BigInt(new Decimal(row.value).mul(factor).toFixed(0)), quantity: row.quantity })).filter((row) => row.valueBig > BigInt(0));

  let unit = targetBig;
  for (const denom of denoms) unit = gcdBig(unit, denom.valueBig);
  if (unit <= BigInt(0)) throw new Error("Tidak ada pecahan yang dapat digunakan untuk auto-isi.");

  const steps = targetBig / unit;
  if (steps <= BigInt(DENOMINATION_SUGGESTION_STATE_CAP)) {
    const stepsNum = Number(steps);
    type Item = { unitValue: number; quantity: number; denomIndex: number };
    const items: Item[] = [];
    denoms.forEach((denom, denomIndex) => {
      const stepValue = Number(denom.valueBig / unit);
      let remainingQty = denom.quantity;
      let chunk = 1;
      while (remainingQty > 0) {
        const take = Math.min(chunk, remainingQty);
        items.push({ unitValue: stepValue * take, quantity: take, denomIndex });
        remainingQty -= take;
        chunk *= 2;
      }
    });

    const dp = new Array<number>(stepsNum + 1).fill(Infinity);
    const choice = new Array<number>(stepsNum + 1).fill(-1);
    dp[0] = 0;
    for (let i = 0; i < items.length; i++) {
      const { unitValue, quantity } = items[i];
      for (let amount = stepsNum; amount >= unitValue; amount--) {
        if (dp[amount - unitValue] + quantity < dp[amount]) {
          dp[amount] = dp[amount - unitValue] + quantity;
          choice[amount] = i;
        }
      }
    }

    if (dp[stepsNum] !== Infinity) {
      const usedByDenom = new Map<number, number>();
      let remaining = stepsNum;
      while (remaining > 0) {
        const item = items[choice[remaining]];
        usedByDenom.set(item.denomIndex, (usedByDenom.get(item.denomIndex) ?? 0) + item.quantity);
        remaining -= item.unitValue;
      }
      const breakdown = denoms.map((denom, index) => ({ value: denom.value, quantity: usedByDenom.get(index) ?? 0 })).filter((row) => row.quantity > 0);
      return { exact: true, currencyCode: currency.code, breakdown, shortfall: "0" };
    }
  }

  const { breakdown, remaining } = greedyDenominationBreakdown(denoms, targetBig);
  return {
    exact: remaining === BigInt(0),
    currencyCode: currency.code,
    breakdown,
    shortfall: remaining > BigInt(0) ? new Decimal(remaining.toString()).div(factor).toFixed(DENOMINATION_SUGGESTION_SCALE).replace(/0+$/, "").replace(/\.$/, "") : "0",
  };
}

/** Records the declared morning float as an immutable, auditable adjustment before the daily count begins. */
export async function recordOpeningCash(input: { currencyId: number; openingAmount: string; notes?: string; denominations: DenominationEntryInput[] }, actor: { id: number; role: StaffRole }) {
  const declaredAmount = nonNegativeOrZeroDecimal(input.openingAmount, "Kas pembukaan");
  if (!input.denominations?.length) throw new Error("Rincian pecahan wajib diisi untuk kas awal — stok pecahan sistem dimulai dari sini.");
  const db = await databaseOrThrow();
  const currencyForValidation = (await db.select({ code: currencies.code }).from(currencies).where(eq(currencies.id, input.currencyId)).limit(1))[0];
  const denominationRows = reconcileDenominations(input.denominations, declaredAmount, currencyForValidation?.code);
  return db.transaction(async (tx) => {
    const currency = (await tx.select().from(currencies).where(and(eq(currencies.id, input.currencyId), eq(currencies.active, true))).limit(1))[0];
    if (!currency) throw new Error("Mata uang aktif tidak ditemukan.");
    await tx.insert(cashBalances).values({ currencyId: input.currencyId, availableAmount: "0.000000" }).onDuplicateKeyUpdate({ set: { currencyId: sql`${cashBalances.currencyId}` } });
    await tx.execute(sql`SELECT ${cashBalances.id} FROM ${cashBalances} WHERE ${cashBalances.currencyId} = ${input.currencyId} FOR UPDATE`);
    const balance = (await tx.select().from(cashBalances).where(eq(cashBalances.currencyId, input.currencyId)).limit(1))[0];
    if (!balance) throw new Error("Saldo kas tidak dapat dikunci.");
    const reason = openingCashMovementReason(currency.code);
    const existing = (await tx.select({ id: cashBalanceMovements.id }).from(cashBalanceMovements).where(and(eq(cashBalanceMovements.cashBalanceId, balance.id), eq(cashBalanceMovements.reason, reason))).limit(1))[0];
    if (existing) throw new Error(`Kas pembukaan ${currency.code} untuk hari ini sudah dicatat. Gunakan stock opname untuk mencatat hasil hitung fisik.`);
    const before = new Decimal(String(balance.availableAmount));
    const adjustment = new Decimal(calculateOpeningCashAdjustment(before.toFixed(6), declaredAmount.toFixed(6)));
    await tx.update(cashBalances).set({ availableAmount: declaredAmount.toFixed(6) }).where(eq(cashBalances.id, balance.id));
    const [movement] = await tx.insert(cashBalanceMovements).values({ cashBalanceId: balance.id, direction: "ADJUSTMENT", amount: adjustment.toFixed(6), reason, category: "OPENING", createdByUserId: actor.id }).$returningId();
    if (denominationRows.length && movement) {
      await tx.insert(cashDenominationEntries).values(denominationRows.map((row) => ({ ...row, cashBalanceMovementId: movement.id })));
      await resetDenominationBalances(tx, input.currencyId, denominationRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })));
    }
    await writeAudit({ actorUserId: actor.id, action: "OPENING_CASH_RECORDED", entityType: "cash_balance", entityId: String(balance.id), beforeState: { availableAmount: before.toFixed(6) }, afterState: { availableAmount: declaredAmount.toFixed(6), currency: currency.code }, reason: input.notes?.trim() || null, metadata: { movementReason: reason, adjustment: adjustment.toFixed(6), denominationCount: denominationRows.length } });
    return { balanceId: balance.id, currencyCode: currency.code, beforeAmount: before.toFixed(6), openingAmount: declaredAmount.toFixed(6) };
  });
}

/** Off-hours cash movements that aren't part of the normal transaction flow — owner safe deposits/withdrawals, or a sale made outside business hours. Always requires a note and always writes an audit trail so it shows up correctly in the daily stock report. */
export async function recordCashAdjustment(
  input: { currencyId: number; category: "SAFE_DEPOSIT" | "SAFE_WITHDRAWAL" | "OFF_HOURS_SALE" | "OTHER"; amount: string; notes: string; denominations: DenominationEntryInput[] },
  actor: { id: number; role: StaffRole },
) {
  const amount = nonNegativeOrZeroDecimal(input.amount, "Jumlah penyesuaian");
  if (amount.lte(0)) throw new Error("Jumlah penyesuaian harus lebih besar dari nol.");
  const notes = input.notes.trim();
  if (notes.length < 5) throw new Error("Catatan penyesuaian wajib diisi (minimal 5 karakter) untuk jejak audit.");
  if (!input.denominations?.length) throw new Error("Rincian pecahan wajib diisi untuk penyesuaian kas/brankas.");
  // Deposits into the safe and off-hours sales both remove cash from the counter; a withdrawal from the safe adds it back.
  const direction: "IN" | "OUT" = input.category === "SAFE_WITHDRAWAL" ? "IN" : "OUT";
  const db = await databaseOrThrow();
  const currencyForValidation = (await db.select({ code: currencies.code }).from(currencies).where(eq(currencies.id, input.currencyId)).limit(1))[0];
  const denominationRows = reconcileDenominations(input.denominations, amount, currencyForValidation?.code);
  return db.transaction(async (tx) => {
    const currency = (await tx.select().from(currencies).where(and(eq(currencies.id, input.currencyId), eq(currencies.active, true))).limit(1))[0];
    if (!currency) throw new Error("Mata uang aktif tidak ditemukan.");
    await tx.execute(sql`SELECT ${cashBalances.id} FROM ${cashBalances} WHERE ${cashBalances.currencyId} = ${input.currencyId} FOR UPDATE`);
    const balance = (await tx.select().from(cashBalances).where(eq(cashBalances.currencyId, input.currencyId)).limit(1))[0];
    if (!balance) throw new Error("Saldo kas belum ada. Catat kas awal terlebih dahulu.");
    const before = new Decimal(String(balance.availableAmount));
    if (direction === "OUT" && before.lt(amount)) throw new Error("Jumlah penyesuaian melebihi saldo kas yang tersedia.");
    const after = direction === "OUT" ? before.minus(amount) : before.plus(amount);
    await tx.update(cashBalances).set({ availableAmount: after.toFixed(6) }).where(eq(cashBalances.id, balance.id));
    const reason = `${input.category}_${Date.now()}_${currency.code}`;
    const [movement] = await tx.insert(cashBalanceMovements).values({ cashBalanceId: balance.id, direction, amount: amount.toFixed(6), reason: `${input.category}: ${notes}`.slice(0, 255), category: input.category, createdByUserId: actor.id }).$returningId();
    if (denominationRows.length && movement) {
      await tx.insert(cashDenominationEntries).values(denominationRows.map((row) => ({ ...row, cashBalanceMovementId: movement.id })));
      await applyDenominationBalanceDelta(tx, input.currencyId, denominationRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })), direction === "IN" ? 1 : -1);
    }
    await writeAudit({ actorUserId: actor.id, action: "CASH_ADJUSTMENT_RECORDED", entityType: "cash_balance", entityId: String(balance.id), beforeState: { availableAmount: before.toFixed(6) }, afterState: { availableAmount: after.toFixed(6), currency: currency.code }, reason: notes, metadata: { category: input.category, direction, amount: amount.toFixed(6), denominationCount: denominationRows.length } });
    return { balanceId: balance.id, currencyCode: currency.code, beforeAmount: before.toFixed(6), afterAmount: after.toFixed(6), direction, category: input.category };
  });
}

/** Greedy, largest-first decomposition into curated real denominations — used only for the *receiving* side of a note exchange, where supply is effectively unlimited (a bank hands over whatever combination is requested), unlike suggestDenominationBreakdown which is bounded by what's actually in our own till. */
function decomposeIntoCuratedDenominations(amount: Decimal, currencyCode: string, excludeValue?: string) {
  const known = knownDenominationsFor(currencyCode);
  if (!known) throw new Error(`Belum ada daftar pecahan baku untuk ${currencyCode}, tidak dapat menguraikan nilai tukar otomatis.`);
  const candidates = known.filter((value) => String(value) !== excludeValue).sort((a, b) => b - a);
  let remaining = amount;
  const result: { value: string; quantity: number }[] = [];
  for (const value of candidates) {
    if (remaining.lte(0)) break;
    const take = remaining.div(value).floor();
    if (take.gt(0)) {
      result.push({ value: String(value), quantity: take.toNumber() });
      remaining = remaining.minus(take.mul(value));
    }
  }
  if (!remaining.eq(0)) throw new Error(`Nilai ${amount.toFixed(0)} tidak dapat diuraikan tepat menjadi pecahan baku ${currencyCode}.`);
  return result;
}

/**
 * Proposes an equal-value note exchange (e.g. 1x100,000 -> 1x50,000+2x20,000+2x5,000) to close a
 * shortfall that suggestDenominationBreakdown couldn't fill from current stock alone — this is the
 * "auto-convert pecahan" the teller needs when the till's recorded composition is lopsided (e.g. all
 * 100,000s from an ATM withdrawal) but the aggregate cash on hand is genuinely enough. Never invents
 * value: the receiving side always sums to exactly what's given up. Purely a proposal — nothing is
 * written until recordDenominationExchange is called with it (or an edited version of it).
 */
export async function suggestDenominationExchange(input: { currencyId: number; shortfallAmount: string }) {
  const db = await databaseOrThrow();
  const currency = (await db.select({ code: currencies.code }).from(currencies).where(eq(currencies.id, input.currencyId)).limit(1))[0];
  if (!currency) throw new Error("Mata uang tidak ditemukan.");
  const shortfall = new Decimal(input.shortfallAmount);
  if (shortfall.lte(0)) throw new Error("Nilai kekurangan harus lebih besar dari nol.");

  const stockRowsRaw = await db.select({ value: cashDenominationBalances.denominationValue, quantity: cashDenominationBalances.quantity })
    .from(cashDenominationBalances)
    .where(and(eq(cashDenominationBalances.currencyId, input.currencyId), gt(cashDenominationBalances.quantity, 0)));
  const stockRows = stockRowsRaw
    .map((row) => ({ value: new Decimal(row.value).toFixed(0), quantity: row.quantity }))
    .sort((a, b) => new Decimal(a.value).minus(new Decimal(b.value)).toNumber());

  const breakable = stockRows.find((row) => new Decimal(row.value).gte(shortfall));
  if (!breakable) throw new Error(`Tidak ada pecahan ${currency.code} di stok yang cukup besar untuk ditukar guna menutupi kekurangan Rp ${shortfall.toFixed(0)}. Perlu penambahan modal atau penukaran pecahan dari luar.`);

  const receive = decomposeIntoCuratedDenominations(new Decimal(breakable.value), currency.code, breakable.value);
  return { currencyCode: currency.code, give: [{ value: breakable.value, quantity: 1 }], receive };
}

/**
 * Records a real, equal-value note exchange — physically, a teller trading e.g. one 100,000 note for
 * smaller ones (with a bank, or another till). Never changes cashBalances.availableAmount (the
 * currency total is unchanged by definition, enforced by the equal-value check below); only the
 * denomination composition moves. Kept as two separate ledger movements (one OUT, one IN) so it reads
 * the same way in stock history as any other denomination-affecting event, rather than inventing a new
 * mixed-direction shape.
 */
export async function recordDenominationExchange(
  input: { currencyId: number; give: DenominationEntryInput[]; receive: DenominationEntryInput[]; notes?: string },
  actor: { id: number; role: StaffRole },
) {
  const db = await databaseOrThrow();
  const currency = (await db.select({ code: currencies.code }).from(currencies).where(and(eq(currencies.id, input.currencyId), eq(currencies.active, true))).limit(1))[0];
  if (!currency) throw new Error("Mata uang aktif tidak ditemukan.");
  if (!input.give?.length || !input.receive?.length) throw new Error("Sisi yang ditukar dan diterima wajib diisi.");

  const giveTotal = input.give.reduce((sum, entry) => sum.plus(new Decimal(entry.value).mul(entry.quantity)), new Decimal(0));
  const receiveTotal = input.receive.reduce((sum, entry) => sum.plus(new Decimal(entry.value).mul(entry.quantity)), new Decimal(0));
  if (giveTotal.lte(0)) throw new Error("Nilai tukar harus lebih besar dari nol.");
  if (!giveTotal.eq(receiveTotal)) throw new Error("Nilai pecahan yang diberikan dan diterima harus sama persis — pertukaran pecahan tidak boleh mengubah nilai total.");

  const giveRows = reconcileDenominations(input.give, giveTotal, currency.code);
  const receiveRows = reconcileDenominations(input.receive, receiveTotal, currency.code);
  const autoReason = `Tukar pecahan ${currency.code}: ${input.give.map((e) => `${e.quantity}x${e.value}`).join("+")} -> ${input.receive.map((e) => `${e.quantity}x${e.value}`).join("+")}`;
  const reason = (input.notes?.trim() || autoReason).slice(0, 255);

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT ${cashBalances.id} FROM ${cashBalances} WHERE ${cashBalances.currencyId} = ${input.currencyId} FOR UPDATE`);
    const balance = (await tx.select().from(cashBalances).where(eq(cashBalances.currencyId, input.currencyId)).limit(1))[0];
    if (!balance) throw new Error("Saldo kas belum ada. Catat kas awal terlebih dahulu.");

    for (const row of giveRows) {
      const stock = (await tx.select({ quantity: cashDenominationBalances.quantity }).from(cashDenominationBalances).where(and(eq(cashDenominationBalances.currencyId, input.currencyId), eq(cashDenominationBalances.denominationValue, row.denominationValue))).limit(1))[0];
      if (!stock || stock.quantity < row.quantity) throw new Error(`Stok pecahan ${currency.code} ${row.denominationValue} tidak mencukupi untuk ditukar (tersedia ${stock?.quantity ?? 0}, dibutuhkan ${row.quantity}).`);
    }

    const [outMovement] = await tx.insert(cashBalanceMovements).values({ cashBalanceId: balance.id, direction: "OUT", amount: giveTotal.toFixed(6), reason, category: "DENOMINATION_EXCHANGE", createdByUserId: actor.id }).$returningId();
    if (outMovement) await tx.insert(cashDenominationEntries).values(giveRows.map((row) => ({ ...row, cashBalanceMovementId: outMovement.id })));
    const [inMovement] = await tx.insert(cashBalanceMovements).values({ cashBalanceId: balance.id, direction: "IN", amount: receiveTotal.toFixed(6), reason, category: "DENOMINATION_EXCHANGE", createdByUserId: actor.id }).$returningId();
    if (inMovement) await tx.insert(cashDenominationEntries).values(receiveRows.map((row) => ({ ...row, cashBalanceMovementId: inMovement.id })));

    await applyDenominationBalanceDelta(tx, input.currencyId, giveRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })), -1);
    await applyDenominationBalanceDelta(tx, input.currencyId, receiveRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })), 1);

    await writeAudit({ actorUserId: actor.id, action: "DENOMINATION_EXCHANGE_RECORDED", entityType: "cash_balance", entityId: String(balance.id), beforeState: { give: giveRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })) }, afterState: { receive: receiveRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })) }, reason, metadata: { currencyCode: currency.code, amount: giveTotal.toFixed(6) } });
    return { currencyCode: currency.code, give: giveRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })), receive: receiveRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })) };
  });
}

export async function listStockOpnames(user: { id: number; role: StaffRole }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const query = db.select({ opname: stockOpnames, currency: currencies }).from(stockOpnames).innerJoin(currencies, eq(stockOpnames.currencyId, currencies.id));
    const rows = user.role === "STAFF"
      ? await query.where(and(eq(stockOpnames.isDemo, false), eq(stockOpnames.isHistorical, false), eq(stockOpnames.tellerUserId, user.id))).orderBy(desc(stockOpnames.opnameDate), currencies.code)
      : await query.where(and(eq(stockOpnames.isDemo, false), eq(stockOpnames.isHistorical, false))).orderBy(desc(stockOpnames.opnameDate), currencies.code);
    return rows.filter(({ opname }) => !opname.isDemo && !opname.isHistorical);
  });
}

export async function openStockOpname(input: { currencyId: number; actorUserId: number }) {
  const db = await databaseOrThrow();
  const currency = (await db.select().from(currencies).where(and(eq(currencies.id, input.currencyId), eq(currencies.active, true))).limit(1))[0];
  if (!currency) throw new Error("Mata uang aktif tidak ditemukan.");
  const opnameDate = jakartaBusinessDate();
  const existing = (await db.select().from(stockOpnames).where(and(eq(stockOpnames.opnameDate, opnameDate), eq(stockOpnames.currencyId, input.currencyId), eq(stockOpnames.isDemo, false), eq(stockOpnames.isHistorical, false))).limit(1))[0];
  if (existing && !existing.isDemo && !existing.isHistorical) throw new Error("Stock opname untuk mata uang dan tanggal hari ini sudah ada.");
  const balance = (await db.select().from(cashBalances).where(eq(cashBalances.currencyId, input.currencyId)).limit(1))[0];
  const openingBalance = balance ? String(balance.availableAmount) : "0.000000";
  await db.insert(stockOpnames).values({ opnameDate, currencyId: input.currencyId, openingSystemBalance: openingBalance, closingSystemBalance: openingBalance, tellerUserId: input.actorUserId });
  const created = (await db.select().from(stockOpnames).where(and(eq(stockOpnames.opnameDate, opnameDate), eq(stockOpnames.currencyId, input.currencyId))).limit(1))[0];
  if (!created) throw new Error("Stock opname tidak dapat dibuka.");
  await writeAudit({ actorUserId: input.actorUserId, action: "STOCK_OPNAME_OPENED", entityType: "stock_opname", entityId: String(created.id), afterState: { opnameDate, currencyId: input.currencyId, openingSystemBalance: openingBalance } });
  return created;
}

export async function submitStockOpname(input: { stockOpnameId: number; physicalBalance: string; varianceNotes?: string }, actor: { id: number; role: StaffRole }) {
  const db = await databaseOrThrow();
  const opname = (await db.select().from(stockOpnames).where(and(eq(stockOpnames.id, input.stockOpnameId), eq(stockOpnames.isDemo, false), eq(stockOpnames.isHistorical, false))).limit(1))[0];
  if (!opname || opname.isDemo || opname.isHistorical) throw new Error("Stock opname tidak ditemukan.");
  if (actor.role === "STAFF" && opname.tellerUserId !== actor.id) throw new Error("Staff hanya dapat mengirim stock opname miliknya sendiri.");
  if (opname.reconciliationStatus !== "OPEN") throw new Error("Hanya stock opname OPEN yang dapat dikirim.");
  const physical = nonNegativeOrZeroDecimal(input.physicalBalance, "Saldo fisik");
  const currentBalance = (await db.select().from(cashBalances).where(eq(cashBalances.currencyId, opname.currencyId)).limit(1))[0];
  const systemBalance = new Decimal(String(currentBalance?.availableAmount ?? opname.closingSystemBalance));
  const variance = new Decimal(calculateStockVariance(physical.toFixed(6), systemBalance.toFixed(6)));
  await db.update(stockOpnames).set({ closingSystemBalance: systemBalance.toFixed(6), physicalBalance: physical.toFixed(6), variance: variance.toFixed(6), reconciliationStatus: "SUBMITTED", varianceNotes: input.varianceNotes?.trim() || null }).where(eq(stockOpnames.id, opname.id));
  await writeAudit({ actorUserId: actor.id, action: "STOCK_OPNAME_SUBMITTED", entityType: "stock_opname", entityId: String(opname.id), beforeState: { reconciliationStatus: opname.reconciliationStatus }, afterState: { reconciliationStatus: "SUBMITTED", closingSystemBalance: systemBalance.toFixed(6), physicalBalance: physical.toFixed(6), variance: variance.toFixed(6) }, reason: input.varianceNotes?.trim() || null });
  return { ...opname, closingSystemBalance: systemBalance.toFixed(6), physicalBalance: physical.toFixed(6), variance: variance.toFixed(6), reconciliationStatus: "SUBMITTED" as const, varianceNotes: input.varianceNotes?.trim() || null };
}

export async function reconcileStockOpname(input: { stockOpnameId: number; notes: string }, reviewerUserId: number) {
  const db = await databaseOrThrow();
  const opname = (await db.select().from(stockOpnames).where(and(eq(stockOpnames.id, input.stockOpnameId), eq(stockOpnames.isDemo, false), eq(stockOpnames.isHistorical, false))).limit(1))[0];
  if (!opname || opname.isDemo || opname.isHistorical || opname.reconciliationStatus !== "SUBMITTED") throw new Error("Hanya stock opname SUBMITTED yang dapat direkonsiliasi.");
  const hasVariance = !new Decimal(String(opname.variance ?? "0")).isZero();
  const status = hasVariance ? "VARIANCE" as const : "RECONCILED" as const;
  const reviewedAt = new Date();
  await db.update(stockOpnames).set({ reconciliationStatus: status, reviewerUserId, reviewedAt, varianceNotes: input.notes }).where(eq(stockOpnames.id, opname.id));
  await writeAudit({ actorUserId: reviewerUserId, action: "STOCK_OPNAME_RECONCILED", entityType: "stock_opname", entityId: String(opname.id), beforeState: { reconciliationStatus: opname.reconciliationStatus }, afterState: { reconciliationStatus: status, reviewedAt }, reason: input.notes });
  const result = { ...opname, reconciliationStatus: status, reviewerUserId, reviewedAt, varianceNotes: input.notes };
  if (hasVariance) {
    await createDirectorKnowledgeItem({
      eventType: "STOCK_VARIANCE",
      entityType: "stock_opname",
      entityId: String(opname.id),
      title: `Varians stock opname ${opname.opnameDate.toISOString().slice(0, 10)}`,
      detail: `Terdapat selisih ${String(opname.variance)} pada stock opname. Catatan Supervisor: ${input.notes}`,
      createdByUserId: reviewerUserId,
    });
  }
  return result;
}

export async function getOperationalDashboard() {
  const start = jakartaBusinessDate();
  try {
    const result = await retryTransientDatabaseRead(async () => {
      const db = await databaseOrThrow();
    const end = nextBusinessDate(start);
    const [todayTransactions, cashBalancesResult, pendingReview, variances] = await Promise.all([
      db.select({ transaction: exchangeTransactions, customer: customers }).from(exchangeTransactions).innerJoin(customers, eq(exchangeTransactions.customerId, customers.id)).where(and(gte(exchangeTransactions.transactionAt, start), lt(exchangeTransactions.transactionAt, end), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false), eq(customers.isDemo, false), eq(customers.isHistorical, false))).orderBy(desc(exchangeTransactions.transactionAt)),
      listCashBalances(),
      db.select().from(exchangeTransactions).where(and(eq(exchangeTransactions.status, "PENDING_REVIEW"), eq(exchangeTransactions.requiresReview, true), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false))).orderBy(desc(exchangeTransactions.transactionAt)),
      db.select({ opname: stockOpnames, currency: currencies }).from(stockOpnames).innerJoin(currencies, eq(stockOpnames.currencyId, currencies.id)).where(and(eq(stockOpnames.reconciliationStatus, "VARIANCE"), eq(stockOpnames.isDemo, false), eq(stockOpnames.isHistorical, false))).orderBy(desc(stockOpnames.opnameDate)),
    ]);
    return { businessDate: start, todayTransactions, cashBalances: cashBalancesResult, pendingReview, variances };
    });
    return { ...result, isDataUnavailable: false };
  } catch (error) {
    if (!isTransientDatabaseFailure(error)) throw error;
    console.warn("[Operations] Dashboard unavailable during temporary database outage.", error);
    return { businessDate: start, todayTransactions: [], cashBalances: [], pendingReview: [], variances: [], isDataUnavailable: true };
  }
}

export async function getTransactionReport(input: { from: Date; to: Date }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const periodFilter = and(gte(exchangeTransactions.transactionAt, input.from), lt(exchangeTransactions.transactionAt, input.to), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false), eq(customers.isDemo, false), eq(customers.isHistorical, false));
    // Legacy single-currency bons: unchanged query/shape. A multi-line bon has currencyId null on its
    // header, so it never matches this inner join — it's picked up separately below instead of duplicated here.
    const legacyRows = await db.select({ transaction: exchangeTransactions, customer: customers, currency: currencies }).from(exchangeTransactions).innerJoin(customers, eq(exchangeTransactions.customerId, customers.id)).innerJoin(currencies, eq(exchangeTransactions.currencyId, currencies.id)).where(periodFilter);
    // Multi-line bons: one report row per exchangeTransactionLines row, with that line's own currency/amount/rate.
    const lineRows = await db.select({ transaction: exchangeTransactions, customer: customers, currency: currencies, line: exchangeTransactionLines }).from(exchangeTransactionLines)
      .innerJoin(exchangeTransactions, eq(exchangeTransactionLines.transactionId, exchangeTransactions.id))
      .innerJoin(customers, eq(exchangeTransactions.customerId, customers.id))
      .innerJoin(currencies, eq(exchangeTransactionLines.currencyId, currencies.id))
      .where(periodFilter);
    const rows = [
      ...legacyRows,
      ...lineRows.map(({ transaction, customer, currency, line }) => ({ transaction: { ...transaction, foreignAmount: line.foreignAmount, rateSnapshot: line.agreedRate, rupiahAmount: line.rupiahAmount }, customer, currency })),
    ];
    return rows.filter(({ transaction, customer }) => !transaction.isDemo && !transaction.isHistorical && !customer.isDemo && !customer.isHistorical)
      .sort((a, b) => new Date(b.transaction.transactionAt).getTime() - new Date(a.transaction.transactionAt).getTime());
  });
}

export async function getStockOpnameReport(input: { from: Date; to: Date }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const rows = await db.select({ opname: stockOpnames, currency: currencies }).from(stockOpnames).innerJoin(currencies, eq(stockOpnames.currencyId, currencies.id)).where(and(gte(stockOpnames.opnameDate, input.from), lt(stockOpnames.opnameDate, input.to), eq(stockOpnames.isDemo, false), eq(stockOpnames.isHistorical, false))).orderBy(desc(stockOpnames.opnameDate), currencies.code);
    return rows.filter(({ opname }) => !opname.isDemo && !opname.isHistorical);
  });
}

export async function getAuditLog(limit = 100) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  });
}

type LkuSourceRow = {
  transaction: { operation: "BUY" | "SELL"; foreignAmount: string; rupiahAmount: string; status: string; isDemo: boolean; isHistorical: boolean };
  currency: { code: string };
};

export function buildLkuSnapshotRows(rows: LkuSourceRow[]) {
  const grouped = new Map<string, { currencyCode: string; buyForeign: Decimal; sellForeign: Decimal; buyIdr: Decimal; sellIdr: Decimal; transactionCount: number }>();
  for (const row of rows) {
    if (row.transaction.isDemo || row.transaction.isHistorical || row.transaction.status !== "COMPLETED") continue;
    const current = grouped.get(row.currency.code) ?? { currencyCode: row.currency.code, buyForeign: new Decimal(0), sellForeign: new Decimal(0), buyIdr: new Decimal(0), sellIdr: new Decimal(0), transactionCount: 0 };
    const foreign = new Decimal(row.transaction.foreignAmount);
    const rupiah = new Decimal(row.transaction.rupiahAmount);
    if (row.transaction.operation === "BUY") { current.buyForeign = current.buyForeign.plus(foreign); current.buyIdr = current.buyIdr.plus(rupiah); }
    else { current.sellForeign = current.sellForeign.plus(foreign); current.sellIdr = current.sellIdr.plus(rupiah); }
    current.transactionCount += 1;
    grouped.set(row.currency.code, current);
  }
  return Array.from(grouped.values()).sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)).map((row) => ({
    currencyCode: row.currencyCode, buyForeign: row.buyForeign.toFixed(6), sellForeign: row.sellForeign.toFixed(6), buyIdr: row.buyIdr.toFixed(2), sellIdr: row.sellIdr.toFixed(2), transactionCount: row.transactionCount,
  }));
}

function regulatoryDigest(payload: unknown) { return createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }

type RegulatoryPackageLockRecord = { id: number; reportType: string; periodStart: Date; periodEnd: Date; status: string };

export function regulatoryPeriodLockBlocker(input: { candidate: Omit<RegulatoryPackageLockRecord, "id" | "status">; packages: RegulatoryPackageLockRecord[]; currentPackageId?: number }) {
  const existing = input.packages.find((item) => item.id !== input.currentPackageId && item.reportType === input.candidate.reportType && item.periodStart.getTime() === input.candidate.periodStart.getTime() && item.periodEnd.getTime() === input.candidate.periodEnd.getTime() && ["PREPARED", "APPROVED", "EXPORTED"].includes(item.status));
  return existing ? `Periode ini sudah dikunci oleh paket ${existing.id} berstatus ${existing.status}. Buat koreksi melalui prosedur pelaporan yang disetujui, bukan draf kedua.` : null;
}

async function activeRegulatoryPackageLock(input: { reportType: "LKU" | "FINANCIAL_READINESS" | "INCIDENTAL"; periodStart: Date; periodEnd: Date; currentPackageId?: number }) {
  const db = await databaseOrThrow();
  const rows = await db.select({ id: regulatoryReportPackages.id, reportType: regulatoryReportPackages.reportType, periodStart: regulatoryReportPackages.periodStart, periodEnd: regulatoryReportPackages.periodEnd, status: regulatoryReportPackages.status }).from(regulatoryReportPackages)
    .where(and(eq(regulatoryReportPackages.reportType, input.reportType), eq(regulatoryReportPackages.periodStart, input.periodStart), eq(regulatoryReportPackages.periodEnd, input.periodEnd), inArray(regulatoryReportPackages.status, ["PREPARED", "APPROVED", "EXPORTED"])));
  return regulatoryPeriodLockBlocker({ candidate: input, packages: rows, currentPackageId: input.currentPackageId });
}

async function createLkuSnapshot(input: { from: Date; to: Date }) {
  if (input.to <= input.from) throw new Error("Akhir periode harus setelah awal periode.");
  const db = await databaseOrThrow();
  const periodFilter = and(gte(exchangeTransactions.transactionAt, input.from), lt(exchangeTransactions.transactionAt, input.to), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false), eq(exchangeTransactions.status, "COMPLETED"));
  // Multi-line bons: one LKU row per exchangeTransactionLines row (its own currency/amount), not per bon.
  const lineRows = await db.select({ transaction: exchangeTransactions, currency: currencies, line: exchangeTransactionLines }).from(exchangeTransactionLines)
    .innerJoin(exchangeTransactions, eq(exchangeTransactionLines.transactionId, exchangeTransactions.id))
    .innerJoin(currencies, eq(exchangeTransactionLines.currencyId, currencies.id))
    .where(periodFilter);
  const transactionIdsWithLines = new Set(lineRows.map(({ transaction }) => transaction.id));
  // Bons predating multi-line bons never got a exchangeTransactionLines row; fall back to their single legacy currencyId/foreignAmount.
  const legacyRows = await db.select({ transaction: exchangeTransactions, currency: currencies }).from(exchangeTransactions)
    .innerJoin(currencies, eq(exchangeTransactions.currencyId, currencies.id))
    .where(periodFilter);
  const sourceRows: LkuSourceRow[] = [
    ...lineRows.map(({ transaction, currency, line }) => ({ transaction: { operation: transaction.operation, foreignAmount: line.foreignAmount, rupiahAmount: line.rupiahAmount, status: transaction.status, isDemo: transaction.isDemo, isHistorical: transaction.isHistorical }, currency: { code: currency.code } })),
    ...legacyRows.filter(({ transaction }) => !transactionIdsWithLines.has(transaction.id)).map(({ transaction, currency }) => ({ transaction: { operation: transaction.operation, foreignAmount: transaction.foreignAmount ?? "0.000000", rupiahAmount: transaction.rupiahAmount, status: transaction.status, isDemo: transaction.isDemo, isHistorical: transaction.isHistorical }, currency: { code: currency.code } })),
  ];
  const rows = buildLkuSnapshotRows(sourceRows);
  const totals = rows.reduce((accumulator, row) => ({ buyIdr: new Decimal(accumulator.buyIdr).plus(row.buyIdr).toFixed(2), sellIdr: new Decimal(accumulator.sellIdr).plus(row.sellIdr).toFixed(2), transactionCount: accumulator.transactionCount + row.transactionCount }), { buyIdr: "0.00", sellIdr: "0.00", transactionCount: 0 });
  const snapshot = { reportType: "LKU", periodStart: input.from.toISOString(), periodEndExclusive: input.to.toISOString(), scope: "LIVE_COMPLETED_ONLY", rows, totals, excluded: ["DRAFT", "PENDING_REVIEW", "APPROVED", "RETURNED", "CANCELLED", "SIMULATION", "HISTORICAL"], generatedAt: new Date().toISOString() };
  const validationSummary = { isReadyToPrepare: true, blockers: [], warnings: ["Cek Pelawat belum dimodelkan dalam aplikasi; konfirmasi nilai nol atau lengkapi melalui kanal pelaporan resmi.", ...(rows.length === 0 ? ["Tidak ada transaksi live berstatus selesai pada periode ini."] : [])], completedTransactionCount: totals.transactionCount, sourceScope: "LIVE_COMPLETED_ONLY" };
  return { snapshot, validationSummary, sourceDigest: regulatoryDigest({ rows, totals, from: input.from.toISOString(), to: input.to.toISOString() }) };
}

export async function getRegulatoryReportingReadiness(input: { from: Date; to: Date }) {
  const lku = await createLkuSnapshot(input);
  const latestFinancialSnapshot = (await listFinancialStatementSnapshots())[0];
  return {
    lku,
    financialReadiness: latestFinancialSnapshot
      ? { status: "SNAPSHOT_TERSEDIA", snapshotId: latestFinancialSnapshot.id, note: "Snapshot keuangan terkendali tersedia. Pastikan periodenya sesuai sebelum membuat paket keuangan." }
      : { status: "PERLU_INPUT_TERKENDALI", missing: ["Neraca", "Laporan laba rugi", "Laporan perubahan ekuitas"], note: "Laporan keuangan tidak dihitung dari bon/kas saja. Masukkan snapshot buku besar atau trial balance yang telah direkonsiliasi." },
    incidentalReadiness: { status: "REVIEW_MANUAL", categories: ["Perubahan Direksi/Komisaris/Pemegang Saham", "Perubahan kantor/cabang/gerai", "Gangguan usaha atau force majeure", "Kerja sama", "Permintaan lain dari Bank Indonesia"], note: "Sistem dapat membantu menelusuri bukti internal, tetapi keputusan klasifikasi dan narasi laporan insidental tetap oleh petugas berwenang." },
  };
}

export type FinancialStatementRow = { code: string; label: string; value: string };
export type FinancialStatementInput = { periodStart: Date; periodEnd: Date; sourceLabel: string; sourceReference?: string; sourceStorageKey?: string; sourceFileName?: string; sourceMimeType?: string; profitLossRows: FinancialStatementRow[]; balanceSheetRows: FinancialStatementRow[]; equityRows: FinancialStatementRow[] };

function validFinancialNumber(value: string) {
  return /^-?\d+(\.\d{1,2})?$/.test(value);
}

export function validateFinancialStatementSnapshot(input: Omit<FinancialStatementInput, "periodStart" | "periodEnd" | "sourceLabel" | "sourceReference">) {
  const errors: string[] = []; const warnings: string[] = [];
  const groups: Array<[string, FinancialStatementRow[]]> = [["Laba rugi", input.profitLossRows], ["Neraca", input.balanceSheetRows], ["Perubahan ekuitas", input.equityRows]];
  for (const [name, rows] of groups) {
    if (!rows.length) errors.push(`${name} belum memiliki pos akun.`);
    const codes = new Set<string>();
    rows.forEach((row, index) => {
      if (!row.code.trim() || !row.label.trim()) errors.push(`${name} baris ${index + 1} harus memiliki kode dan nama pos.`);
      if (codes.has(row.code.trim())) errors.push(`${name} memiliki kode pos ganda: ${row.code.trim()}.`);
      codes.add(row.code.trim());
      if (!validFinancialNumber(row.value)) errors.push(`${name} pos ${row.code || index + 1} memiliki nilai tidak valid.`);
    });
  }
  if (!input.profitLossRows.some((row) => /^0?1/.test(row.code.trim()))) warnings.push("Periksa kembali apakah pendapatan utama telah dimasukkan pada laba rugi.");
  return { valid: errors.length === 0, errors, warnings, counts: { profitLoss: input.profitLossRows.length, balanceSheet: input.balanceSheetRows.length, equity: input.equityRows.length } };
}

function normalizeFinancialRows(rows: FinancialStatementRow[]) {
  return rows.map((row) => ({ code: row.code.trim(), label: row.label.trim(), value: new Decimal(row.value).toFixed(2) }));
}

export async function listFinancialStatementSnapshots() {
  return retryTransientDatabaseRead(async () => { const db = await databaseOrThrow(); return db.select().from(financialStatementSnapshots).orderBy(desc(financialStatementSnapshots.createdAt)); });
}

export async function createFinancialStatementSnapshot(input: FinancialStatementInput, actorUserId: number) {
  if (input.periodEnd.getTime() < input.periodStart.getTime()) throw new Error("Akhir periode tidak boleh sebelum awal periode.");
  const payload = { profitLossRows: normalizeFinancialRows(input.profitLossRows), balanceSheetRows: normalizeFinancialRows(input.balanceSheetRows), equityRows: normalizeFinancialRows(input.equityRows) };
  const validationSummary = validateFinancialStatementSnapshot(payload);
  if (!validationSummary.valid) throw new Error(validationSummary.errors[0] ?? "Snapshot keuangan tidak valid.");
  const db = await databaseOrThrow(); const sourceDigest = regulatoryDigest({ ...payload, periodStart: input.periodStart.toISOString(), periodEnd: input.periodEnd.toISOString(), sourceLabel: input.sourceLabel.trim(), sourceReference: input.sourceReference?.trim() || null, sourceStorageKey: input.sourceStorageKey ?? null });
  await db.insert(financialStatementSnapshots).values({ periodStart: input.periodStart, periodEnd: input.periodEnd, sourceLabel: input.sourceLabel.trim(), sourceReference: input.sourceReference?.trim() || null, sourceStorageKey: input.sourceStorageKey ?? null, sourceFileName: input.sourceFileName ?? null, sourceMimeType: input.sourceMimeType ?? null, ...payload, validationSummary, sourceDigest, createdByUserId: actorUserId });
  const created = (await db.select().from(financialStatementSnapshots).where(eq(financialStatementSnapshots.sourceDigest, sourceDigest)).limit(1))[0];
  if (!created) throw new Error("Snapshot keuangan tidak dapat disimpan.");
  await writeAudit({ actorUserId, action: "FINANCIAL_SNAPSHOT_CREATED", entityType: "financial_statement_snapshot", entityId: String(created.id), afterState: { periodStart: created.periodStart, periodEnd: created.periodEnd, sourceLabel: created.sourceLabel, sourceDigest } });
  return created;
}

export async function createRegulatoryFinancialDraft(snapshotId: number, actorUserId: number) {
  const db = await databaseOrThrow(); const snapshot = (await db.select().from(financialStatementSnapshots).where(eq(financialStatementSnapshots.id, snapshotId)).limit(1))[0];
  if (!snapshot) throw new Error("Snapshot keuangan tidak ditemukan.");
  const summary = snapshot.validationSummary as { valid?: boolean; errors?: string[] };
  if (!summary.valid || summary.errors?.length) throw new Error("Snapshot keuangan belum lolos validasi.");
  const periodLock = await activeRegulatoryPackageLock({ reportType: "FINANCIAL_READINESS", periodStart: snapshot.periodStart, periodEnd: snapshot.periodEnd });
  if (periodLock) throw new Error(periodLock);
  const packageNumber = `REG-FIN-${snapshot.periodStart.toISOString().slice(0, 10).replace(/-/g, "")}-${nanoid(6).toUpperCase()}`;
  const dataSnapshot = { financialSnapshotId: snapshot.id, sourceLabel: snapshot.sourceLabel, sourceReference: snapshot.sourceReference, profitLossRows: snapshot.profitLossRows, balanceSheetRows: snapshot.balanceSheetRows, equityRows: snapshot.equityRows, scope: "CONTROLLED_FINANCIAL_SNAPSHOT" };
  await db.insert(regulatoryReportPackages).values({ packageNumber, reportType: "FINANCIAL_READINESS", periodStart: snapshot.periodStart, periodEnd: snapshot.periodEnd, dataSnapshot, validationSummary: snapshot.validationSummary, sourceDigest: snapshot.sourceDigest, createdByUserId: actorUserId });
  const created = (await db.select().from(regulatoryReportPackages).where(eq(regulatoryReportPackages.packageNumber, packageNumber)).limit(1))[0];
  if (!created) throw new Error("Draf paket keuangan tidak dapat dibuat.");
  await writeAudit({ actorUserId, action: "REGULATORY_FINANCIAL_DRAFT_CREATED", entityType: "regulatory_report_package", entityId: String(created.id), afterState: { financialSnapshotId: snapshot.id, sourceDigest: snapshot.sourceDigest } });
  return created;
}

export type RegulatoryIncidentInput = { category: "GOVERNANCE" | "OFFICE_OR_OUTLET" | "BUSINESS_DISRUPTION" | "FORCE_MAJEURE" | "COOPERATION" | "REGULATOR_REQUEST" | "OTHER"; incidentAt: Date; discoveredAt: Date; title: string; description: string; evidenceReference?: string; initialAction?: string };

export async function listRegulatoryIncidentReports() {
  return retryTransientDatabaseRead(async () => { const db = await databaseOrThrow(); return db.select().from(regulatoryIncidentReports).orderBy(desc(regulatoryIncidentReports.incidentAt)); });
}

export async function createRegulatoryIncidentReport(input: RegulatoryIncidentInput, actorUserId: number) {
  if (input.discoveredAt.getTime() < input.incidentAt.getTime()) throw new Error("Waktu diketahui tidak boleh sebelum waktu kejadian.");
  const db = await databaseOrThrow(); const reportNumber = `INC-${input.incidentAt.toISOString().slice(0, 10).replace(/-/g, "")}-${nanoid(6).toUpperCase()}`;
  await db.insert(regulatoryIncidentReports).values({ ...input, title: input.title.trim(), description: input.description.trim(), evidenceReference: input.evidenceReference?.trim() || null, initialAction: input.initialAction?.trim() || null, reportNumber, createdByUserId: actorUserId });
  const created = (await db.select().from(regulatoryIncidentReports).where(eq(regulatoryIncidentReports.reportNumber, reportNumber)).limit(1))[0];
  if (!created) throw new Error("Register laporan insidental tidak dapat disimpan.");
  await writeAudit({ actorUserId, action: "REGULATORY_INCIDENT_CREATED", entityType: "regulatory_incident_report", entityId: String(created.id), afterState: { category: created.category, incidentAt: created.incidentAt, reportNumber } });
  return created;
}

export async function prepareRegulatoryIncidentReport(incidentId: number, actorUserId: number) {
  const db = await databaseOrThrow(); const current = (await db.select().from(regulatoryIncidentReports).where(eq(regulatoryIncidentReports.id, incidentId)).limit(1))[0];
  if (!current) throw new Error("Register insidental tidak ditemukan."); const status = nextRegulatoryReportStatus({ action: "PREPARE", currentStatus: current.status, actorUserId }) as "PREPARED"; const preparedAt = new Date();
  await db.update(regulatoryIncidentReports).set({ status, preparedByUserId: actorUserId, preparedAt }).where(eq(regulatoryIncidentReports.id, incidentId));
  await writeAudit({ actorUserId, action: "REGULATORY_INCIDENT_PREPARED", entityType: "regulatory_incident_report", entityId: String(incidentId), beforeState: { status: current.status }, afterState: { status, preparedAt } });
  return { ...current, status, preparedByUserId: actorUserId, preparedAt };
}

export async function approveRegulatoryIncidentReport(incidentId: number, actorUserId: number, approvalNotes?: string) {
  const db = await databaseOrThrow(); const current = (await db.select().from(regulatoryIncidentReports).where(eq(regulatoryIncidentReports.id, incidentId)).limit(1))[0];
  if (!current) throw new Error("Register insidental tidak ditemukan."); const status = nextRegulatoryReportStatus({ action: "APPROVE", currentStatus: current.status, preparedByUserId: current.preparedByUserId, actorUserId }) as "APPROVED"; const approvedAt = new Date();
  await db.update(regulatoryIncidentReports).set({ status, approvedByUserId: actorUserId, approvedAt, approvalNotes: approvalNotes?.trim() || null }).where(eq(regulatoryIncidentReports.id, incidentId));
  await writeAudit({ actorUserId, action: "REGULATORY_INCIDENT_APPROVED", entityType: "regulatory_incident_report", entityId: String(incidentId), beforeState: { status: current.status }, afterState: { status, approvedAt }, reason: approvalNotes?.trim() || null });
  return { ...current, status, approvedByUserId: actorUserId, approvedAt, approvalNotes: approvalNotes?.trim() || null };
}

export async function markRegulatoryIncidentExported(incidentId: number, actorUserId: number) {
  const db = await databaseOrThrow(); const current = (await db.select().from(regulatoryIncidentReports).where(eq(regulatoryIncidentReports.id, incidentId)).limit(1))[0];
  if (!current) throw new Error("Register insidental tidak ditemukan."); const status = nextRegulatoryReportStatus({ action: "EXPORT", currentStatus: current.status, actorUserId }) as "EXPORTED"; if (current.status === "EXPORTED") return current; const exportedAt = new Date();
  await db.update(regulatoryIncidentReports).set({ status, exportedByUserId: actorUserId, exportedAt }).where(eq(regulatoryIncidentReports.id, incidentId));
  await writeAudit({ actorUserId, action: "REGULATORY_INCIDENT_EXPORTED", entityType: "regulatory_incident_report", entityId: String(incidentId), beforeState: { status: current.status }, afterState: { status, exportedAt } });
  return { ...current, status, exportedByUserId: actorUserId, exportedAt };
}

export async function listRegulatoryReportPackages() {
  return retryTransientDatabaseRead(async () => { const db = await databaseOrThrow(); return db.select().from(regulatoryReportPackages).orderBy(desc(regulatoryReportPackages.createdAt)); });
}

export async function createRegulatoryLkuDraft(input: { from: Date; to: Date }, actorUserId: number) {
  const db = await databaseOrThrow();
  const periodLock = await activeRegulatoryPackageLock({ reportType: "LKU", periodStart: input.from, periodEnd: input.to });
  if (periodLock) throw new Error(periodLock);
  const { snapshot, validationSummary, sourceDigest } = await createLkuSnapshot(input);
  const packageNumber = `REG-LKU-${input.from.toISOString().slice(0, 10).replace(/-/g, "")}-${nanoid(6).toUpperCase()}`;
  await db.insert(regulatoryReportPackages).values({ packageNumber, reportType: "LKU", periodStart: input.from, periodEnd: input.to, dataSnapshot: snapshot, validationSummary, sourceDigest, createdByUserId: actorUserId });
  const created = (await db.select().from(regulatoryReportPackages).where(eq(regulatoryReportPackages.packageNumber, packageNumber)).limit(1))[0];
  if (!created) throw new Error("Draf paket LKU tidak dapat dibuat.");
  await writeAudit({ actorUserId, action: "REGULATORY_REPORT_DRAFT_CREATED", entityType: "regulatory_report_package", entityId: String(created.id), afterState: { reportType: created.reportType, periodStart: created.periodStart, periodEnd: created.periodEnd, sourceDigest } });
  return created;
}

export async function prepareRegulatoryReportPackage(packageId: number, actorUserId: number) {
  const db = await databaseOrThrow(); const current = (await db.select().from(regulatoryReportPackages).where(eq(regulatoryReportPackages.id, packageId)).limit(1))[0];
  if (!current) throw new Error("Paket pelaporan tidak ditemukan.");
  const nextStatus = nextRegulatoryReportStatus({ action: "PREPARE", currentStatus: current.status, actorUserId });
  const periodLock = await activeRegulatoryPackageLock({ reportType: current.reportType, periodStart: current.periodStart, periodEnd: current.periodEnd, currentPackageId: current.id });
  if (periodLock) throw new Error(periodLock);
  const now = new Date(); await db.update(regulatoryReportPackages).set({ status: nextStatus, preparedByUserId: actorUserId, preparedAt: now }).where(eq(regulatoryReportPackages.id, packageId));
  await writeAudit({ actorUserId, action: "REGULATORY_REPORT_PREPARED", entityType: "regulatory_report_package", entityId: String(packageId), beforeState: { status: current.status }, afterState: { status: nextStatus, preparedAt: now } });
  return { ...current, status: nextStatus, preparedByUserId: actorUserId, preparedAt: now };
}

export function regulatoryApprovalBlocker(input: { status: string; preparedByUserId: number | null; actorUserId: number }) {
  if (input.status !== "PREPARED") return "Paket harus berstatus siap diperiksa sebelum disetujui.";
  if (input.preparedByUserId === input.actorUserId) return "Pembuat paket tidak dapat menyetujui paketnya sendiri. Gunakan Shareholder lain sebagai pemeriksa.";
  return null;
}

export function regulatoryReturnBlocker(input: { status: string; preparedByUserId: number | null; actorUserId: number }) {
  if (input.status !== "PREPARED") return "Hanya paket siap diperiksa yang dapat dikembalikan.";
  if (input.preparedByUserId === input.actorUserId) return "Pembuat paket tidak dapat mengembalikan paketnya sendiri sebagai pemeriksa. Gunakan Shareholder lain.";
  return null;
}

export function nextRegulatoryReportStatus(input: { action: "PREPARE" | "RETURN" | "APPROVE" | "EXPORT"; currentStatus: string; preparedByUserId?: number | null; actorUserId: number }) {
  if (input.action === "PREPARE") {
    if (input.currentStatus !== "DRAFT") throw new Error("Hanya draf yang dapat disiapkan.");
    return "PREPARED" as const;
  }
  if (input.action === "RETURN") {
    const blocker = regulatoryReturnBlocker({ status: input.currentStatus, preparedByUserId: input.preparedByUserId ?? null, actorUserId: input.actorUserId });
    if (blocker) throw new Error(blocker);
    return "RETURNED" as const;
  }
  if (input.action === "APPROVE") {
    const blocker = regulatoryApprovalBlocker({ status: input.currentStatus, preparedByUserId: input.preparedByUserId ?? null, actorUserId: input.actorUserId });
    if (blocker) throw new Error(blocker);
    return "APPROVED" as const;
  }
  if (input.currentStatus !== "APPROVED" && input.currentStatus !== "EXPORTED") throw new Error("Paket harus disetujui sebelum diekspor.");
  return "EXPORTED" as const;
}

export async function approveRegulatoryReportPackage(packageId: number, actorUserId: number, approvalNotes?: string) {
  const db = await databaseOrThrow(); const current = (await db.select().from(regulatoryReportPackages).where(eq(regulatoryReportPackages.id, packageId)).limit(1))[0];
  if (!current) throw new Error("Paket pelaporan tidak ditemukan.");
  const nextStatus = nextRegulatoryReportStatus({ action: "APPROVE", currentStatus: current.status, preparedByUserId: current.preparedByUserId, actorUserId });
  const now = new Date(); await db.update(regulatoryReportPackages).set({ status: nextStatus, approvedByUserId: actorUserId, approvedAt: now, approvalNotes: approvalNotes?.trim() || null }).where(eq(regulatoryReportPackages.id, packageId));
  await writeAudit({ actorUserId, action: "REGULATORY_REPORT_APPROVED", entityType: "regulatory_report_package", entityId: String(packageId), beforeState: { status: current.status }, afterState: { status: nextStatus, approvedAt: now }, reason: approvalNotes?.trim() || null });
  return { ...current, status: nextStatus, approvedByUserId: actorUserId, approvedAt: now, approvalNotes: approvalNotes?.trim() || null };
}

export async function returnRegulatoryReportPackage(packageId: number, actorUserId: number, returnNotes: string) {
  const db = await databaseOrThrow(); const current = (await db.select().from(regulatoryReportPackages).where(eq(regulatoryReportPackages.id, packageId)).limit(1))[0];
  if (!current) throw new Error("Paket pelaporan tidak ditemukan.");
  const normalizedNotes = returnNotes.trim();
  if (normalizedNotes.length < 5) throw new Error("Catatan pengembalian minimal 5 karakter.");
  const nextStatus = nextRegulatoryReportStatus({ action: "RETURN", currentStatus: current.status, preparedByUserId: current.preparedByUserId, actorUserId });
  const now = new Date(); await db.update(regulatoryReportPackages).set({ status: nextStatus, returnedByUserId: actorUserId, returnedAt: now, returnNotes: normalizedNotes }).where(eq(regulatoryReportPackages.id, packageId));
  await writeAudit({ actorUserId, action: "REGULATORY_REPORT_RETURNED", entityType: "regulatory_report_package", entityId: String(packageId), beforeState: { status: current.status }, afterState: { status: nextStatus, returnedAt: now }, reason: normalizedNotes });
  return { ...current, status: nextStatus, returnedByUserId: actorUserId, returnedAt: now, returnNotes: normalizedNotes };
}

export async function setRegulatoryReportManualDeadline(input: { packageId: number; dueAt: Date | null; notes: string }, actorUserId: number) {
  const db = await databaseOrThrow(); const current = (await db.select().from(regulatoryReportPackages).where(eq(regulatoryReportPackages.id, input.packageId)).limit(1))[0];
  if (!current) throw new Error("Paket pelaporan tidak ditemukan.");
  if (!(["DRAFT", "PREPARED", "RETURNED"] as const).includes(current.status as "DRAFT" | "PREPARED" | "RETURNED")) throw new Error("Tenggat manual hanya dapat diatur pada draf, paket siap diperiksa, atau paket yang dikembalikan.");
  const normalizedNotes = input.notes.trim();
  if (normalizedNotes.length < 5) throw new Error("Alasan tenggat manual minimal 5 karakter.");
  if (input.dueAt && input.dueAt.getTime() < current.createdAt.getTime()) throw new Error("Tenggat manual tidak boleh sebelum paket dibuat.");
  await db.update(regulatoryReportPackages).set({ manualDueAt: input.dueAt, manualDueNotes: normalizedNotes }).where(eq(regulatoryReportPackages.id, input.packageId));
  await writeAudit({ actorUserId, action: input.dueAt ? "REGULATORY_REPORT_DEADLINE_SET" : "REGULATORY_REPORT_DEADLINE_CLEARED", entityType: "regulatory_report_package", entityId: String(input.packageId), beforeState: { manualDueAt: current.manualDueAt, manualDueNotes: current.manualDueNotes }, afterState: { manualDueAt: input.dueAt, manualDueNotes: normalizedNotes }, reason: normalizedNotes });
  return { ...current, manualDueAt: input.dueAt, manualDueNotes: normalizedNotes };
}

export async function markRegulatoryReportExported(packageId: number, actorUserId: number) {
  const db = await databaseOrThrow(); const current = (await db.select().from(regulatoryReportPackages).where(eq(regulatoryReportPackages.id, packageId)).limit(1))[0];
  if (!current) throw new Error("Paket pelaporan tidak ditemukan."); const nextStatus = nextRegulatoryReportStatus({ action: "EXPORT", currentStatus: current.status, actorUserId }); if (current.status === "EXPORTED") return current;
  const now = new Date(); await db.update(regulatoryReportPackages).set({ status: nextStatus, exportedByUserId: actorUserId, exportedAt: now }).where(eq(regulatoryReportPackages.id, packageId));
  await writeAudit({ actorUserId, action: "REGULATORY_REPORT_EXPORTED", entityType: "regulatory_report_package", entityId: String(packageId), beforeState: { status: current.status }, afterState: { status: nextStatus, exportedAt: now } });
  return { ...current, status: nextStatus, exportedByUserId: actorUserId, exportedAt: now };
}

export async function createDirectorKnowledgeItem(input: {
  eventType: "FLAGGED_TRANSACTION_APPROVED" | "STOCK_VARIANCE" | "RATE_SHOCK" | "CONSUMER_COMPLAINT";
  entityType: string;
  entityId: string;
  title: string;
  detail: string;
  createdByUserId?: number | null;
}) {
  const db = await databaseOrThrow();
  await db.insert(directorAcknowledgements).values({
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    title: input.title,
    detail: input.detail,
    createdByUserId: input.createdByUserId ?? null,
  });
  const created = (await db.select().from(directorAcknowledgements).orderBy(desc(directorAcknowledgements.id)).limit(1))[0];
  if (!created) throw new Error("Item pengakuan Direksi tidak dapat dibuat.");
  await writeAudit({ actorUserId: input.createdByUserId ?? null, action: "DIRECTOR_ACKNOWLEDGEMENT_CREATED", entityType: "director_acknowledgement", entityId: String(created.id), afterState: { eventType: created.eventType, entityType: created.entityType, entityId: created.entityId } });
  return created;
}

export async function listDirectorAcknowledgements() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(directorAcknowledgements).orderBy(desc(directorAcknowledgements.createdAt));
  });
}

export async function acknowledgeDirectorItem(input: { acknowledgementId: number; notes?: string }, actorUserId: number) {
  const db = await databaseOrThrow();
  const current = (await db.select().from(directorAcknowledgements).where(eq(directorAcknowledgements.id, input.acknowledgementId)).limit(1))[0];
  if (!current) throw new Error("Item pengakuan Direksi tidak ditemukan.");
  if (current.acknowledgedAt) throw new Error("Item ini sudah ditandai diketahui.");
  const acknowledgedAt = new Date();
  await db.update(directorAcknowledgements).set({ acknowledgedAt, acknowledgedByUserId: actorUserId, acknowledgementNotes: input.notes?.trim() || null }).where(eq(directorAcknowledgements.id, current.id));
  await writeAudit({ actorUserId, action: "DIRECTOR_ACKNOWLEDGEMENT_RECORDED", entityType: "director_acknowledgement", entityId: String(current.id), beforeState: { acknowledgedAt: null }, afterState: { acknowledgedAt }, reason: input.notes?.trim() || null });
  return { ...current, acknowledgedAt, acknowledgedByUserId: actorUserId, acknowledgementNotes: input.notes?.trim() || null };
}
