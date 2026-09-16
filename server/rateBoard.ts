import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auditLogs, currencies, operationalRates, rateTiers } from "../drizzle/schema";
import { findTierOverlap, normalizeDenominationValue, OTHER_TIER_LABEL, sortTiers, type RateTierRow } from "../shared/rateTiers";
import { databaseOrThrow, writeAudit } from "./operations";

export const ACTIVATION_REASON_MIN_LENGTH = 10;

export type TierSaveInput = { tierId?: number; currencyId: number; label: string; denominationValues: string[]; sortOrder: number };

/**
 * Menolak satu nilai muka berada di dua kelompok aktif pada valuta yang sama. Ditegakkan di sini dan
 * bukan di basis data: aturannya menyangkut isi JSON, dan constraint MySQL tidak dapat menyatakannya.
 */
export function assertTierSaveValid(existing: readonly RateTierRow[], input: TierSaveInput): RateTierRow[] {
  const values = Array.from(new Set(input.denominationValues.map(normalizeDenominationValue)));
  if (!values.length) throw new Error("Kelompok pecahan harus memuat minimal satu nilai pecahan.");
  const candidate: RateTierRow = { id: input.tierId ?? -1, currencyId: input.currencyId, label: input.label.trim(), denominationValues: values, sortOrder: input.sortOrder, active: true };
  const next = [...existing.filter((tier) => tier.id !== candidate.id), candidate];
  const overlap = findTierOverlap(next);
  if (overlap) {
    throw new Error(`Pecahan ${overlap.value} sudah masuk kelompok "${overlap.labels[0]}"; satu pecahan tidak boleh berada di dua kelompok aktif (bentrok dengan "${overlap.labels[1]}"). Keluarkan pecahan itu dari salah satu kelompok lebih dahulu.`);
  }
  return sortTiers(next);
}

/** Menonaktifkan kelompok berarti mencabut harganya juga — kurs yang menggantung tanpa kelompok tidak pernah dapat dibaca ulang oleh siapa pun. */
export function planTierDeactivation(input: { tierLabel: string; activeRateIds: number[]; reason: string }) {
  const reason = input.reason.trim();
  if (input.activeRateIds.length && reason.length < ACTIVATION_REASON_MIN_LENGTH) {
    throw new Error(`Kelompok "${input.tierLabel}" masih memiliki kurs aktif. Isi alasan minimal ${ACTIVATION_REASON_MIN_LENGTH} karakter — kurs itu akan ikut dinonaktifkan.`);
  }
  return { retireRateIds: [...input.activeRateIds], reason: input.activeRateIds.length ? reason : input.reason.trim() };
}

async function readTiers(db: Awaited<ReturnType<typeof databaseOrThrow>>, currencyId: number): Promise<RateTierRow[]> {
  const rows = await db.select().from(rateTiers).where(eq(rateTiers.currencyId, currencyId));
  return rows.map((row) => ({ id: row.id, currencyId: row.currencyId, label: row.label, denominationValues: (row.denominationValues ?? []) as string[], sortOrder: row.sortOrder, active: row.active }));
}

export async function saveRateTier(input: TierSaveInput, actorUserId: number) {
  const db = await databaseOrThrow();
  const existing = await readTiers(db, input.currencyId);
  assertTierSaveValid(existing, input);
  const values = Array.from(new Set(input.denominationValues.map(normalizeDenominationValue)));
  if (input.tierId) {
    await db.update(rateTiers).set({ label: input.label.trim(), denominationValues: values, sortOrder: input.sortOrder, active: true }).where(eq(rateTiers.id, input.tierId));
    await writeAudit({ actorUserId, action: "RATE_TIER_UPDATED", entityType: "rate_tier", entityId: String(input.tierId), afterState: { label: input.label.trim(), denominationValues: values } });
    return { tierId: input.tierId };
  }
  await db.insert(rateTiers).values({ currencyId: input.currencyId, label: input.label.trim(), denominationValues: values, sortOrder: input.sortOrder, createdByUserId: actorUserId });
  const created = (await db.select({ id: rateTiers.id }).from(rateTiers).where(eq(rateTiers.currencyId, input.currencyId)).orderBy(desc(rateTiers.id)).limit(1))[0];
  if (!created) throw new Error("Kelompok pecahan tidak dapat disimpan.");
  await writeAudit({ actorUserId, action: "RATE_TIER_CREATED", entityType: "rate_tier", entityId: String(created.id), afterState: { currencyId: input.currencyId, label: input.label.trim(), denominationValues: values } });
  return { tierId: created.id };
}

export async function deactivateRateTier(input: { tierId: number; reason: string }, actorUserId: number) {
  const db = await databaseOrThrow();
  const tier = (await db.select().from(rateTiers).where(eq(rateTiers.id, input.tierId)).limit(1))[0];
  if (!tier) throw new Error("Kelompok pecahan tidak ditemukan.");
  const activeRates = await db.select({ id: operationalRates.id }).from(operationalRates)
    .where(and(eq(operationalRates.rateTierId, input.tierId), eq(operationalRates.status, "ACTIVE"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false)));
  const plan = planTierDeactivation({ tierLabel: tier.label, activeRateIds: activeRates.map((row) => row.id), reason: input.reason });
  await db.transaction(async (tx) => {
    await tx.update(rateTiers).set({ active: false }).where(eq(rateTiers.id, input.tierId));
    if (plan.retireRateIds.length) await tx.update(operationalRates).set({ status: "RETIRED" }).where(inArray(operationalRates.id, plan.retireRateIds));
    await tx.insert(auditLogs).values({ actorUserId, action: "RATE_TIER_DEACTIVATED", entityType: "rate_tier", entityId: String(input.tierId), beforeState: { active: true }, afterState: { active: false, retiredRateIds: plan.retireRateIds }, reason: plan.reason || null });
  });
  return { tierId: input.tierId, retiredRateIds: plan.retireRateIds };
}

export type ActivationDraft = {
  id: number; currencyId: number; currencyCode: string; rateTierId: number | null; tierLabel: string;
  status: "DRAFT" | "ACTIVE" | "RETIRED"; isDemo: boolean; isHistorical: boolean;
};
export type ActivationPlan = { activateRateIds: number[]; retireKeys: { currencyId: number; rateTierId: number | null }[]; batchId: string };

const activationKey = (currencyId: number, rateTierId: number | null) => `${currencyId}:${rateTierId ?? "ALL"}`;

/**
 * Seluruh keputusan aktivasi diambil **sebelum** transaksi dibuka, sehingga kegagalan apa pun terjadi
 * saat belum ada satu baris pun yang berubah. Satu draf rusak membatalkan seluruh batch, dan galatnya
 * menyebut valuta serta kelompok yang gagal — "aktivasi gagal" tanpa baris yang disebut memaksa
 * operator menebak kurs mana yang harus diperbaiki.
 */
export function planBoardActivation(drafts: readonly ActivationDraft[], reason: string, batchId: string): ActivationPlan {
  const trimmed = reason.trim();
  if (trimmed.length < ACTIVATION_REASON_MIN_LENGTH) throw new Error(`Alasan aktivasi kurs minimal ${ACTIVATION_REASON_MIN_LENGTH} karakter.`);
  if (!drafts.length) throw new Error("Pilih setidaknya satu proposal kurs untuk diaktifkan.");
  const seen = new Set<string>();
  for (const draft of drafts) {
    const where = `${draft.currencyCode} · ${draft.tierLabel}`;
    if (draft.status !== "DRAFT") throw new Error(`Kurs ${where} tidak lagi berstatus DRAFT, jadi tidak ada satu pun kurs dalam aktivasi ini yang diaktifkan. Muat ulang papan lalu ulangi.`);
    if (draft.isDemo || draft.isHistorical) throw new Error(`Kurs ${where} adalah kurs demo atau historis dan tidak dapat diaktifkan pada operasi live.`);
    const key = activationKey(draft.currencyId, draft.rateTierId);
    if (seen.has(key)) throw new Error(`Ada dua draf untuk ${where} dalam satu aktivasi. Buang salah satunya lalu ulangi.`);
    seen.add(key);
  }
  return {
    activateRateIds: drafts.map((draft) => draft.id),
    retireKeys: drafts.map((draft) => ({ currencyId: draft.currencyId, rateTierId: draft.rateTierId })),
    batchId,
  };
}

/**
 * Satu transaksi basis data untuk seluruh batch. Menggantikan perulangan lama di `operations.ts`
 * yang dapat berhenti di tengah dan meninggalkan papan separuh aktif.
 */
export async function activateOperationalRateIds(rateIds: number[], actorUserId: number, approvalReason: string) {
  // Alasan diperiksa sebelum kueri apa pun: pemeriksaan termurah lebih dahulu, dan pesannya tetap
  // menyebut alasan yang kurang panjang alih-alih tersamar oleh galat "proposal tidak ditemukan".
  if (approvalReason.trim().length < ACTIVATION_REASON_MIN_LENGTH) throw new Error(`Alasan aktivasi kurs minimal ${ACTIVATION_REASON_MIN_LENGTH} karakter.`);
  const uniqueIds = Array.from(new Set(rateIds));
  const db = await databaseOrThrow();
  const rows = uniqueIds.length
    ? await db.select({ rate: operationalRates, currency: currencies, tier: rateTiers })
        .from(operationalRates)
        .innerJoin(currencies, eq(operationalRates.currencyId, currencies.id))
        .leftJoin(rateTiers, eq(operationalRates.rateTierId, rateTiers.id))
        .where(inArray(operationalRates.id, uniqueIds))
    : [];
  if (rows.length !== uniqueIds.length) throw new Error("Sebagian proposal kurs tidak ditemukan. Muat ulang papan lalu ulangi.");
  const drafts: ActivationDraft[] = rows.map(({ rate, currency, tier }) => ({
    id: rate.id, currencyId: rate.currencyId, currencyCode: currency.code, rateTierId: rate.rateTierId,
    tierLabel: tier?.label ?? OTHER_TIER_LABEL, status: rate.status, isDemo: rate.isDemo, isHistorical: rate.isHistorical,
  }));
  const batchId = nanoid(21);
  const plan = planBoardActivation(drafts, approvalReason, batchId);
  const reason = approvalReason.trim();
  const activatedAt = new Date();
  await db.transaction(async (tx) => {
    for (const key of plan.retireKeys) {
      await tx.update(operationalRates).set({ status: "RETIRED" }).where(and(
        eq(operationalRates.currencyId, key.currencyId),
        key.rateTierId === null ? isNull(operationalRates.rateTierId) : eq(operationalRates.rateTierId, key.rateTierId),
        eq(operationalRates.status, "ACTIVE"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false),
      ));
    }
    await tx.update(operationalRates)
      .set({ status: "ACTIVE", approvedByUserId: actorUserId, approvedAt: activatedAt, approvalReason: reason, activationBatchId: batchId })
      .where(inArray(operationalRates.id, plan.activateRateIds));
    for (const draft of drafts) {
      await tx.insert(auditLogs).values({
        actorUserId, action: "OPERATIONAL_RATE_ACTIVATED", entityType: "operational_rate", entityId: String(draft.id),
        beforeState: { status: "DRAFT" }, afterState: { status: "ACTIVE", approvedAt: activatedAt, activationBatchId: batchId, rateTierId: draft.rateTierId }, reason,
      });
    }
  });
  return { activated: plan.activateRateIds.length, batchId, rateIds: plan.activateRateIds };
}
