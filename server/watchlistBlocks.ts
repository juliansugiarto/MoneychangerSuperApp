import { inArray } from "drizzle-orm";
import { attemptedTransactions, currencies, watchlistBlocks, type WatchlistBlock } from "../drizzle/schema";
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
