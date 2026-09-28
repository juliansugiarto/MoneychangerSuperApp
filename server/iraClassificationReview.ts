import { and, desc, eq, isNotNull } from "drizzle-orm";
import { auditLogs, currencies, customers, iraClassificationReviews, iraRiskClassifications, operationalSettings, users } from "../drizzle/schema";
import { unclassifiedCodes } from "../shared/iraClassificationReview";
import { getDb } from "./db";

/** Pengesahan berkala klasifikasi risiko — Pasal 9 ayat (6) PBI 10/2024. */

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Basis data tidak tersedia.");
  return db;
}

/**
 * Semesta negara = kewarganegaraan nasabah yang benar-benar tercatat (bukan demo), sama dengan yang
 * dibaca Form C1 — tidak ada daftar negara tertutup.
 */
export async function listUnclassifiedCodes() {
  const db = await databaseOrThrow();
  const [rows, currencyRows, countryRows] = await Promise.all([
    db.select({ dimension: iraRiskClassifications.dimension, code: iraRiskClassifications.code, riskType: iraRiskClassifications.riskType }).from(iraRiskClassifications),
    db.select({ code: currencies.code }).from(currencies).where(eq(currencies.active, true)),
    db.select({ nationality: customers.nationality }).from(customers).where(and(isNotNull(customers.nationality), eq(customers.isDemo, false))),
  ]);
  return unclassifiedCodes({ currencyCodes: currencyRows.map((row) => row.code), countryCodes: countryRows.map((row) => row.nationality ?? ""), rows });
}

export async function signClassificationReview(input: { notes: string }, actor: { id: number }) {
  const notes = input.notes?.trim() ?? "";
  if (notes.length < 3) throw new Error("Catatan tinjauan wajib diisi.");
  const missing = await listUnclassifiedCodes();
  if (missing.length) throw new Error(`${missing.length} kode belum diklasifikasi — klasifikasikan dahulu sebelum mengesahkan tinjauan.`);
  const db = await databaseOrThrow();
  const rows = await db.select().from(iraRiskClassifications);
  const snapshot = rows.map((row) => ({ dimension: row.dimension, code: row.code, riskType: row.riskType, level: row.level, sourceNote: row.sourceNote, updatedAt: row.updatedAt }));
  const values = { reviewedAt: new Date(), reviewedByUserId: actor.id, notes, snapshot: JSON.stringify(snapshot), classificationCount: rows.length };
  await db.insert(iraClassificationReviews).values(values);
  await db.insert(auditLogs).values({ actorUserId: actor.id, action: "IRA_CLASSIFICATION_REVIEWED", entityType: "ira_classification_review", entityId: values.reviewedAt.toISOString(), afterState: { notes, classificationCount: rows.length } });
  return values;
}

async function reviewSettings(db: Awaited<ReturnType<typeof databaseOrThrow>>) {
  const [found] = await db.select().from(operationalSettings).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD")).limit(1);
  if (found) return found;
  await db.insert(operationalSettings).values({ settingCode: "REVIEW_THRESHOLD" });
  const [created] = await db.select().from(operationalSettings).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD")).limit(1);
  return created;
}

export async function listClassificationReviews() {
  const db = await databaseOrThrow();
  const rows = await db.select({ review: iraClassificationReviews, reviewerName: users.name })
    .from(iraClassificationReviews)
    .leftJoin(users, eq(users.id, iraClassificationReviews.reviewedByUserId))
    .orderBy(desc(iraClassificationReviews.reviewedAt));
  const reviews = rows.map((row) => ({ ...row.review, reviewerName: row.reviewerName ?? null }));
  const settings = await reviewSettings(db);
  return { reviews, intervalMonths: settings?.iraClassificationReviewMonths ?? 12 };
}

export async function setClassificationReviewInterval(input: { months: number }, actor: { id: number }) {
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 36) throw new Error("Selang tinjauan harus 1 sampai 36 bulan.");
  const db = await databaseOrThrow();
  const settings = await reviewSettings(db);
  await db.update(operationalSettings).set({ iraClassificationReviewMonths: input.months }).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD"));
  await db.insert(auditLogs).values({ actorUserId: actor.id, action: "IRA_CLASSIFICATION_REVIEW_INTERVAL_SET", entityType: "operational_settings", entityId: "REVIEW_THRESHOLD", beforeState: { months: settings?.iraClassificationReviewMonths ?? 12 }, afterState: { months: input.months } });
  return { months: input.months };
}
