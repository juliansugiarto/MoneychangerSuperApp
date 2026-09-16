import { and, desc, eq, inArray } from "drizzle-orm";
import { auditLogs, operationalRates, rateTiers } from "../drizzle/schema";
import { findTierOverlap, normalizeDenominationValue, sortTiers, type RateTierRow } from "../shared/rateTiers";
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
