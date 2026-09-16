import Decimal from "decimal.js";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auditLogs, currencies, operationalRates, rateReferenceSnapshots, rateTiers, rateVolatilityAlerts } from "../drizzle/schema";
import type { BoardCellPayload } from "../shared/rateBoard";
import { deviationRejectionMessage, exceedsTolerance, rateDeviationPercent, type DeviationRow } from "../shared/rateDeviation";
import { startOfNextOperationalDay, startOfOperationalDay } from "../shared/regulatoryActionQueue";
import { findTierOverlap, matchTier, normalizeDenominationValue, OTHER_TIER_LABEL, sortTiers, type RateTierRow } from "../shared/rateTiers";
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

export type ActivationHistoryRow = { activationBatchId: string; approvedAt: Date; approvalReason: string | null };
export type ActivationBatch = { batchId: string; approvedAt: Date; rateCount: number; approvalReason: string | null };

/**
 * Riwayat dibaca dari `operational_rates.activationBatchId`, **bukan** dari `audit_logs`: jejak audit
 * adalah bukti, bukan sumber tampilan, dan layar yang membacanya akan pecah begitu bentuk jejaknya
 * berubah. Batas harinya zona operasional WIB, bukan tanggal UTC proses.
 */
export function groupTodayActivationBatches(rows: readonly ActivationHistoryRow[], now: Date): ActivationBatch[] {
  const from = startOfOperationalDay(now);
  const until = startOfNextOperationalDay(now);
  const byBatch = new Map<string, ActivationBatch>();
  for (const row of rows) {
    if (!row.activationBatchId) continue;
    const approvedAt = new Date(row.approvedAt);
    if (approvedAt < from || approvedAt >= until) continue;
    const existing = byBatch.get(row.activationBatchId);
    if (existing) { existing.rateCount += 1; continue; }
    byBatch.set(row.activationBatchId, { batchId: row.activationBatchId, approvedAt, rateCount: 1, approvalReason: row.approvalReason });
  }
  return Array.from(byBatch.values()).sort((left, right) => right.approvedAt.getTime() - left.approvedAt.getTime());
}

export type { BoardCellPayload } from "../shared/rateBoard";

export type RateBoardPayload = {
  cells: BoardCellPayload[];
  batchesToday: ActivationBatch[];
  alerts: { id: number; currencyCode: string; message: string }[];
  latestReferenceDate: Date | null;
};

/**
 * Satu kueri untuk seluruh papan: tiap valuta aktif memunculkan satu baris per kelompok aktif,
 * ditambah satu baris "Pecahan lain" untuk kurs tingkat valuta. Baris "Pecahan lain" selalu ada —
 * pecahan yang tidak masuk kelompok mana pun harus punya tempat untuk dihargai, dan baris yang hanya
 * muncul ketika kursnya sudah ada membuat kurs pertamanya mustahil diisi.
 */
export async function readRateBoard(now = new Date()): Promise<RateBoardPayload> {
  const db = await databaseOrThrow();
  const [currencyRows, tierRows, rateRows, referenceRows, alertRows] = await Promise.all([
    db.select().from(currencies).where(eq(currencies.active, true)).orderBy(currencies.code),
    db.select().from(rateTiers).where(eq(rateTiers.active, true)),
    db.select().from(operationalRates).where(and(eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false), inArray(operationalRates.status, ["DRAFT", "ACTIVE"]))).orderBy(desc(operationalRates.id)),
    db.select().from(rateReferenceSnapshots).where(eq(rateReferenceSnapshots.isDemo, false)).orderBy(desc(rateReferenceSnapshots.referenceDate), desc(rateReferenceSnapshots.fetchedAt)),
    db.select({ alert: rateVolatilityAlerts, currency: currencies }).from(rateVolatilityAlerts).innerJoin(currencies, eq(rateVolatilityAlerts.currencyId, currencies.id)).where(isNull(rateVolatilityAlerts.resolvedAt)),
  ]);

  const tiersByCurrency = new Map<number, RateTierRow[]>();
  for (const row of tierRows) {
    const list = tiersByCurrency.get(row.currencyId) ?? [];
    list.push({ id: row.id, currencyId: row.currencyId, label: row.label, denominationValues: (row.denominationValues ?? []) as string[], sortOrder: row.sortOrder, active: row.active });
    tiersByCurrency.set(row.currencyId, list);
  }
  const latestReferenceByCurrency = new Map<number, typeof referenceRows[number]>();
  for (const row of referenceRows) if (!latestReferenceByCurrency.has(row.currencyId)) latestReferenceByCurrency.set(row.currencyId, row);

  const key = (currencyId: number, rateTierId: number | null) => `${currencyId}:${rateTierId ?? "ALL"}`;
  const activeByKey = new Map<string, typeof rateRows[number]>();
  const draftByKey = new Map<string, typeof rateRows[number]>();
  for (const rate of rateRows) {
    const bucket = rate.status === "ACTIVE" ? activeByKey : draftByKey;
    const cellKey = key(rate.currencyId, rate.rateTierId);
    if (!bucket.has(cellKey)) bucket.set(cellKey, rate);
  }

  const cells: BoardCellPayload[] = [];
  for (const currency of currencyRows) {
    if (currency.code === "IDR") continue;
    const reference = latestReferenceByCurrency.get(currency.id);
    const tiers = sortTiers(tiersByCurrency.get(currency.id) ?? []);
    const rows: { rateTierId: number | null; tierLabel: string; sortOrder: number }[] = [
      ...tiers.map((tier) => ({ rateTierId: tier.id, tierLabel: tier.label, sortOrder: tier.sortOrder })),
      { rateTierId: null, tierLabel: OTHER_TIER_LABEL, sortOrder: 9999 },
    ];
    for (const row of rows) {
      const cellKey = key(currency.id, row.rateTierId);
      const active = activeByKey.get(cellKey);
      const draft = draftByKey.get(cellKey);
      cells.push({
        currencyId: currency.id, currencyCode: currency.code, currencyName: currency.name,
        rateTierId: row.rateTierId, tierLabel: row.tierLabel, sortOrder: row.sortOrder,
        quoteUnit: String(active?.quoteUnit ?? draft?.quoteUnit ?? reference?.quoteUnit ?? "1.000000"),
        activeRateId: active?.id ?? null, activeBuyRate: active ? String(active.buyRate) : null, activeSellRate: active ? String(active.sellRate) : null, activeEffectiveAt: active?.effectiveAt ?? null,
        draftRateId: draft?.id ?? null, draftBuyRate: draft ? String(draft.buyRate) : null, draftSellRate: draft ? String(draft.sellRate) : null,
        referenceBuyRate: reference ? String(reference.buyRate) : null, referenceSellRate: reference ? String(reference.sellRate) : null, referenceSnapshotId: reference?.id ?? null,
      });
    }
  }

  const historyRows = rateRows.filter((rate) => rate.status === "ACTIVE" && rate.approvedAt)
    .map((rate) => ({ activationBatchId: rate.activationBatchId ?? "", approvedAt: rate.approvedAt as Date, approvalReason: rate.approvalReason }));

  return {
    cells,
    batchesToday: groupTodayActivationBatches(historyRows, now),
    alerts: alertRows.map(({ alert, currency }) => ({ id: alert.id, currencyCode: currency.code, message: `Referensi ${currency.code} bergerak ${String(alert.percentageChange)}% — periksa sebelum mengaktifkan.` })),
    latestReferenceDate: referenceRows[0]?.referenceDate ?? null,
  };
}

export type BoardDraftInput = { currencyId: number; rateTierId: number | null; quoteUnit: string; buyRate: string; sellRate: string; referenceSnapshotId?: number | null };

/** Draf baru **mengganti** draf lama untuk pasangan valuta + kelompok yang sama: papan menyimpan satu niat per sel, bukan tumpukan niat. */
export function planDraftReplacement(
  existingDrafts: readonly { id: number; currencyId: number; rateTierId: number | null }[],
  inputs: readonly BoardDraftInput[],
) {
  const seen = new Set<string>();
  for (const row of inputs) {
    const key = `${row.currencyId}:${row.rateTierId ?? "ALL"}`;
    if (seen.has(key)) throw new Error("Ada dua nilai untuk sel yang sama dalam satu penyimpanan. Muat ulang papan lalu ulangi.");
    seen.add(key);
    const buy = new Decimal(row.buyRate);
    const sell = new Decimal(row.sellRate);
    if (buy.lte(0) || sell.lte(0) || new Decimal(row.quoteUnit).lte(0)) throw new Error("Kurs beli, kurs jual, dan satuan kuotasi harus lebih besar dari nol.");
    if (buy.gt(sell)) throw new Error("Kurs beli tidak boleh lebih tinggi daripada kurs jual pada sel yang sama.");
  }
  const replaceRateIds = existingDrafts.filter((draft) => seen.has(`${draft.currencyId}:${draft.rateTierId ?? "ALL"}`)).map((draft) => draft.id);
  return { replaceRateIds, inserts: [...inputs] };
}

export async function saveBoardDrafts(inputs: BoardDraftInput[], actorUserId: number) {
  const db = await databaseOrThrow();
  const existing = await db.select({ id: operationalRates.id, currencyId: operationalRates.currencyId, rateTierId: operationalRates.rateTierId })
    .from(operationalRates).where(and(eq(operationalRates.status, "DRAFT"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false)));
  const plan = planDraftReplacement(existing, inputs);
  const effectiveAt = new Date();
  await db.transaction(async (tx) => {
    if (plan.replaceRateIds.length) await tx.delete(operationalRates).where(inArray(operationalRates.id, plan.replaceRateIds));
    for (const row of plan.inserts) {
      await tx.insert(operationalRates).values({
        currencyId: row.currencyId, rateTierId: row.rateTierId, referenceSnapshotId: row.referenceSnapshotId ?? null,
        quoteUnit: new Decimal(row.quoteUnit).toFixed(6), buyRate: new Decimal(row.buyRate).toFixed(6), sellRate: new Decimal(row.sellRate).toFixed(6),
        effectiveAt, status: "DRAFT", proposedByUserId: actorUserId,
      });
    }
    await tx.insert(auditLogs).values({
      actorUserId, action: "OPERATIONAL_RATE_BOARD_DRAFTED", entityType: "operational_rate_batch", entityId: effectiveAt.toISOString(),
      afterState: { savedCells: plan.inserts.length, replacedRateIds: plan.replaceRateIds },
    });
  });
  return { saved: plan.inserts.length, replaced: plan.replaceRateIds.length };
}

export async function activateBoardDrafts(input: { rateIds?: number[]; approvalReason: string }, actorUserId: number) {
  const db = await databaseOrThrow();
  const rateIds = input.rateIds?.length
    ? input.rateIds
    : (await db.select({ id: operationalRates.id }).from(operationalRates)
        .where(and(eq(operationalRates.status, "DRAFT"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false)))).map((row) => row.id);
  return activateOperationalRateIds(rateIds, actorUserId, input.approvalReason);
}

/** Membuang seluruh draf papan tanpa menyentuh satu pun kurs yang sedang aktif. */
export async function discardBoardDrafts(actorUserId: number) {
  const db = await databaseOrThrow();
  const drafts = await db.select({ id: operationalRates.id }).from(operationalRates)
    .where(and(eq(operationalRates.status, "DRAFT"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false)));
  if (!drafts.length) return { discarded: 0 };
  const ids = drafts.map((row) => row.id);
  await db.transaction(async (tx) => {
    await tx.delete(operationalRates).where(inArray(operationalRates.id, ids));
    await tx.insert(auditLogs).values({ actorUserId, action: "OPERATIONAL_RATE_DRAFTS_DISCARDED", entityType: "operational_rate_batch", entityId: new Date().toISOString(), beforeState: { rateIds: ids } });
  });
  return { discarded: ids.length };
}

/**
 * Kedua penyusun ini **tidak pernah** mengaktifkan apa pun: hasilnya masuk ke `saveBoardDrafts` dan
 * menunggu alasan manusia. Sel tanpa sumber angka dilewati, bukan diisi nol — kurs nol yang lolos ke
 * bon jauh lebih berbahaya daripada sel yang dibiarkan kosong.
 */
export function buildCopyDrafts(cells: readonly BoardCellPayload[]): BoardDraftInput[] {
  return cells.filter((cell) => cell.activeBuyRate && cell.activeSellRate).map((cell) => ({
    currencyId: cell.currencyId, rateTierId: cell.rateTierId, quoteUnit: cell.quoteUnit,
    buyRate: cell.activeBuyRate as string, sellRate: cell.activeSellRate as string,
  }));
}

export function buildReferenceDrafts(cells: readonly BoardCellPayload[]): BoardDraftInput[] {
  return cells.filter((cell) => cell.referenceBuyRate && cell.referenceSellRate).map((cell) => ({
    currencyId: cell.currencyId, rateTierId: cell.rateTierId, quoteUnit: cell.quoteUnit,
    buyRate: cell.referenceBuyRate as string, sellRate: cell.referenceSellRate as string, referenceSnapshotId: cell.referenceSnapshotId,
  }));
}

export async function copyActiveRatesToDrafts(actorUserId: number) {
  const board = await readRateBoard();
  const drafts = buildCopyDrafts(board.cells);
  if (!drafts.length) throw new Error("Belum ada kurs aktif yang dapat disalin. Isi kurs hari ini secara manual atau pakai saran dari referensi BI.");
  return saveBoardDrafts(drafts, actorUserId);
}

export async function suggestDraftsFromReference(actorUserId: number) {
  const board = await readRateBoard();
  const drafts = buildReferenceDrafts(board.cells);
  if (!drafts.length) throw new Error("Belum ada snapshot BI tersimpan. Jalankan sinkronisasi referensi lebih dahulu.");
  return saveBoardDrafts(drafts, actorUserId);
}

export type ActiveRateForPricing = { id: number; currencyId: number; rateTierId: number | null; buyRate: string; sellRate: string; quoteUnit: string };
export type PricedEntry = { currencyId: number; currencyCode: string; denominationValue: string; agreedRate: string };
export type DenominationReference = { operationalRateId: number | null; referenceRateSnapshot: string | null; rateDeviationPercent: string | null };

/**
 * Rujukan dicari **per pecahan**, bukan per valuta: satu bon dapat memuat USD 100 (kelompok "100") dan
 * USD 10 (kelompok "5–20"), dan kedua baris itu berhak atas kurs papannya masing-masing. Pecahan yang
 * tidak masuk kelompok mana pun memakai kurs tingkat valuta bila ada.
 */
export function resolveDenominationReference(entry: PricedEntry, operation: "BUY" | "SELL", tiers: readonly RateTierRow[], activeRates: readonly ActiveRateForPricing[]): DenominationReference {
  const value = normalizeDenominationValue(entry.denominationValue);
  const tier = matchTier(tiers, value);
  const forCurrency = activeRates.filter((rate) => rate.currencyId === entry.currencyId);
  const rate = (tier ? forCurrency.find((row) => row.rateTierId === tier.id) : undefined)
    ?? forCurrency.find((row) => row.rateTierId === null)
    ?? null;
  if (!rate) return { operationalRateId: null, referenceRateSnapshot: null, rateDeviationPercent: null };
  const reference = operation === "BUY" ? rate.buyRate : rate.sellRate;
  return { operationalRateId: rate.id, referenceRateSnapshot: reference, rateDeviationPercent: rateDeviationPercent(entry.agreedRate, reference) };
}

/**
 * Dihitung di server pada saat simpan, tidak pernah dipercaya dari klien: kurs dapat diaktifkan
 * antara bon dibuka dan bon disimpan, dan yang berlaku adalah kurs saat simpan.
 */
export function assessDenominationDeviations(input: {
  entries: readonly PricedEntry[];
  operation: "BUY" | "SELL";
  tiersByCurrency: Map<number, RateTierRow[]>;
  activeRates: readonly ActiveRateForPricing[];
  tolerancePercent: string;
  reason: string | null;
}) {
  const references: DenominationReference[] = [];
  const exceeding: DeviationRow[] = [];
  for (const entry of input.entries) {
    const reference = resolveDenominationReference(entry, input.operation, input.tiersByCurrency.get(entry.currencyId) ?? [], input.activeRates);
    references.push(reference);
    if (reference.referenceRateSnapshot && exceedsTolerance(reference.rateDeviationPercent, input.tolerancePercent)) {
      exceeding.push({
        currencyCode: entry.currencyCode, denominationValue: entry.denominationValue,
        agreedRate: entry.agreedRate, referenceRate: reference.referenceRateSnapshot,
        deviationPercent: reference.rateDeviationPercent as string,
      });
    }
  }
  const reason = input.reason?.trim() ?? "";
  if (exceeding.length && reason.length < ACTIVATION_REASON_MIN_LENGTH) throw new Error(deviationRejectionMessage(exceeding, input.tolerancePercent));
  return { references, exceeding, requiresReview: exceeding.length > 0 };
}
