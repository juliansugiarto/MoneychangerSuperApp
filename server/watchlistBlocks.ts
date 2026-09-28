import { desc, eq, inArray } from "drizzle-orm";
import { attemptedTransactions, auditLogs, currencies, customers, watchlistBlocks, type WatchlistBlock } from "../drizzle/schema";
import { isRoleAllowed, type BackOfficeRole } from "../shared/backOfficeNavigation";
import { hasActiveBlock, shouldOpenScreeningBlock, summarizeAttemptLines, type BlockLite } from "../shared/watchlistBlock";
import { getDb } from "./db";

/**
 * Penulis `watchlist_blocks` — pemblokiran serta merta atas kecocokan DTTOT/DPPSPM (Pasal 47 ayat
 * (1) huruf d PBI 10/2024). Membuka saja; menutup adalah keputusan manusia (`resolveWatchlistBlock`).
 */

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Basis data tidak tersedia.");
  return db;
}

async function blocksOf(customerIds: number[]) {
  if (!customerIds.length) return [] as WatchlistBlock[];
  const db = await databaseOrThrow();
  return db.select().from(watchlistBlocks).where(inArray(watchlistBlocks.customerId, customerIds));
}

export async function openBlocksForScreenings(rows: { customerId: number; screeningId: number | null; matchKeys: string[] }[]): Promise<number> {
  const candidates = rows.filter((row) => row.matchKeys.length > 0);
  if (!candidates.length) return 0;
  const existing = await blocksOf(candidates.map((row) => row.customerId));
  const openedAt = new Date();
  const toInsert = candidates
    .filter((row) => shouldOpenScreeningBlock(existing.filter((block) => block.customerId === row.customerId) as BlockLite[], row.matchKeys))
    .map((row) => ({ customerId: row.customerId, openedAt, source: "PENYARINGAN" as const, screeningId: row.screeningId, matchKeys: JSON.stringify(row.matchKeys), status: "OPEN" as const }));
  if (!toInsert.length) return 0;
  const db = await databaseOrThrow();
  await db.insert(watchlistBlocks).values(toInsert);
  return toInsert.length;
}

export async function openBlockFromScreening(input: { customerId: number; screeningId: number | null; matchKeys: string[] }): Promise<boolean> {
  return (await openBlocksForScreenings([input])) > 0;
}

export async function openOfficerBlock(customerId: number): Promise<boolean> {
  const existing = await blocksOf([customerId]);
  if (hasActiveBlock(existing as BlockLite[])) return false;
  const db = await databaseOrThrow();
  await db.insert(watchlistBlocks).values({ customerId, openedAt: new Date(), source: "PETUGAS", screeningId: null, matchKeys: null, status: "OPEN" });
  return true;
}

/** Blokir yang masih menahan (OPEN/CONFIRMED) per nasabah — yang terbaru bila lebih dari satu. */
export async function activeBlockFor(customerIds: number[]): Promise<Map<number, WatchlistBlock>> {
  const result = new Map<number, WatchlistBlock>();
  for (const block of await blocksOf(customerIds)) {
    if (block.status !== "OPEN" && block.status !== "CONFIRMED") continue;
    const current = result.get(block.customerId);
    if (!current || current.id < block.id) result.set(block.customerId, block);
  }
  return result;
}

/**
 * Satu baris percobaan transaksi yang ditahan blokir — Pasal 47 ayat (1) huruf d ("termasuk
 * percobaan Transaksi"). Satu-satunya pemanggilnya `createTransaction`, sebelum bon apa pun ditulis.
 */
export async function recordAttempt(input: {
  block: WatchlistBlock; blockedParty: "NASABAH" | "KUASA"; customerId: number; representativeCustomerId: number | null;
  tellerUserId: number; operation: "BUY" | "SELL";
  lines: { currencyId: number; quoteUnit?: string; denominations: { value: string; quantity: number; rate: string }[] }[];
}): Promise<void> {
  const db = await databaseOrThrow();
  const currencyIds = Array.from(new Set((input.lines ?? []).map((line) => line.currencyId).filter((id) => Number.isInteger(id))));
  const currencyRows = currencyIds.length ? await db.select({ id: currencies.id, code: currencies.code }).from(currencies).where(inArray(currencies.id, currencyIds)) : [];
  const summary = summarizeAttemptLines(input.lines ?? [], new Map(currencyRows.map((row) => [row.id, row.code])));
  await db.insert(attemptedTransactions).values({
    blockId: input.block.id, customerId: input.customerId, representativeCustomerId: input.representativeCustomerId,
    blockedParty: input.blockedParty, tellerUserId: input.tellerUserId, attemptedAt: new Date(),
    operation: input.operation, linesSummary: JSON.stringify(summary.lines), totalIdr: summary.totalIdr,
  });
}

const MIN_NOTE = 3;
const requireNote = (value: string | null | undefined, label: string) => {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < MIN_NOTE) throw new Error(`${label} wajib diisi.`);
  return trimmed;
};

export function watchlistBlockDenial(user: { role: BackOfficeRole }) {
  return isRoleAllowed(user.role, "CONTROLLER") ? null : { message: "Keputusan pemblokiran hanya untuk Controller ke atas." };
}

async function loadBlock(blockId: number) {
  const db = await databaseOrThrow();
  const [block] = await db.select().from(watchlistBlocks).where(eq(watchlistBlocks.id, blockId)).limit(1);
  if (!block) throw new Error("Pemblokiran tidak ditemukan.");
  return { db, block };
}

async function audit(db: Awaited<ReturnType<typeof databaseOrThrow>>, actorUserId: number, action: string, block: WatchlistBlock, afterState: Record<string, unknown>) {
  await db.insert(auditLogs).values({ actorUserId, action, entityType: "watchlist_block", entityId: String(block.id), beforeState: { status: block.status }, afterState });
}

export async function resolveWatchlistBlock(input: { blockId: number; decision: "CONFIRMED" | "FALSE_POSITIVE"; notes: string; ltkmReference?: string | null; biCopySentAt?: Date | null }, actor: { id: number }) {
  const notes = requireNote(input.notes, "Catatan keputusan");
  const { db, block } = await loadBlock(input.blockId);
  if (block.status !== "OPEN") throw new Error("Pemblokiran ini sudah diputuskan.");
  const resolvedAt = new Date();
  const next = { status: input.decision, resolvedByUserId: actor.id, resolvedAt, resolutionNotes: notes,
    ...(input.decision === "CONFIRMED" ? { ltkmReference: input.ltkmReference?.trim() || null, biCopySentAt: input.biCopySentAt ?? null } : {}) };
  await db.update(watchlistBlocks).set(next).where(eq(watchlistBlocks.id, block.id));
  if (input.decision === "CONFIRMED") {
    await db.update(customers).set({ dttotPpsdmMatch: true, dttotPpsdmNotes: `Dikonfirmasi pada pemblokiran #${block.id}: ${notes}` }).where(eq(customers.id, block.customerId));
  } else if (block.source === "PETUGAS") {
    await db.update(customers).set({ dttotPpsdmMatch: false, dttotPpsdmNotes: null }).where(eq(customers.id, block.customerId));
  }
  await audit(db, actor.id, input.decision === "CONFIRMED" ? "WATCHLIST_BLOCK_CONFIRMED" : "WATCHLIST_BLOCK_FALSE_POSITIVE", block, next);
  return { ...block, ...next } as WatchlistBlock;
}

export async function recordWatchlistBlockReporting(input: { blockId: number; ltkmReference: string; biCopySentAt: Date }, actor: { id: number }) {
  const ltkmReference = requireNote(input.ltkmReference, "Rujukan LTKM");
  const { db, block } = await loadBlock(input.blockId);
  if (block.status !== "CONFIRMED") throw new Error("Pelaporan hanya dicatat pada blokir yang dikonfirmasi.");
  if (input.biCopySentAt.getTime() > Date.now()) throw new Error("Tanggal tembusan tidak boleh di masa depan.");
  const next = { ltkmReference, biCopySentAt: input.biCopySentAt };
  await db.update(watchlistBlocks).set(next).where(eq(watchlistBlocks.id, block.id));
  await audit(db, actor.id, "WATCHLIST_BLOCK_REPORTED", block, next);
  return { ...block, ...next } as WatchlistBlock;
}

export async function revokeWatchlistBlock(input: { blockId: number; revocationReference: string; notes: string }, actor: { id: number }) {
  const revocationReference = requireNote(input.revocationReference, "Rujukan surat pencabutan");
  const notes = requireNote(input.notes, "Catatan");
  const { db, block } = await loadBlock(input.blockId);
  if (block.status !== "CONFIRMED") throw new Error("Hanya blokir yang dikonfirmasi yang dapat dicabut.");
  const next = { status: "DICABUT" as const, revocationReference, resolutionNotes: `${block.resolutionNotes ?? ""}\n[Dicabut] ${notes}`.trim(), resolvedByUserId: actor.id, resolvedAt: new Date() };
  await db.update(watchlistBlocks).set(next).where(eq(watchlistBlocks.id, block.id));
  await audit(db, actor.id, "WATCHLIST_BLOCK_REVOKED", block, next);
  return { ...block, ...next } as WatchlistBlock;
}

export async function listWatchlistBlocks() {
  const db = await databaseOrThrow();
  const rows = await db.select({ block: watchlistBlocks, customerName: customers.fullName, cifNumber: customers.cifNumber })
    .from(watchlistBlocks).innerJoin(customers, eq(watchlistBlocks.customerId, customers.id)).orderBy(desc(watchlistBlocks.openedAt));
  const ids = rows.map((row) => row.block.id);
  const attempts = ids.length ? await db.select().from(attemptedTransactions).where(inArray(attemptedTransactions.blockId, ids)).orderBy(desc(attemptedTransactions.attemptedAt)) : [];
  return rows.map((row) => ({ ...row.block, customerName: row.customerName, cifNumber: row.cifNumber, attempts: attempts.filter((attempt) => attempt.blockId === row.block.id) }));
}
