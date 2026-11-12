import { and, desc, eq, inArray } from "drizzle-orm";
import { attemptedTransactions, auditLogs, currencies, customers, customerWatchlistScreenings, watchlistBlocks, type WatchlistBlock } from "../drizzle/schema";
import { isRoleAllowed, type BackOfficeRole } from "../shared/backOfficeNavigation";
import { hasActiveBlock, shouldOpenScreeningBlock, summarizeAttemptLines, WATCHLIST_BLOCK_TELLER_MESSAGE, type BlockLite } from "../shared/watchlistBlock";
import { highRiskResetValues } from "./customerHighRiskApproval";
import { getDb } from "./db";
import { affectedRows } from "./dbResult";

/**
 * Penulis `watchlist_blocks` — pemblokiran serta merta atas kecocokan DTTOT/DPPSPM (Pasal 47 ayat
 * (1) huruf d PBI 10/2024). Membuka saja; menutup adalah keputusan manusia (`resolveWatchlistBlock`).
 */

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Basis data tidak tersedia.");
  return db;
}

type Db = Awaited<ReturnType<typeof databaseOrThrow>>;
/** Basis data atau transaksi yang sedang berjalan — supaya blokir dapat ikut transaksi pemanggilnya. */
type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

async function blocksOf(customerIds: number[], executor?: Executor) {
  if (!customerIds.length) return [] as WatchlistBlock[];
  const db = executor ?? await databaseOrThrow();
  return db.select().from(watchlistBlocks).where(inArray(watchlistBlocks.customerId, customerIds));
}

/**
 * Kunci baris nasabah, urut id (urutan tetap mencegah kebuntuan). Pembuka blokir memakai "update", bon memakai "share":
 * blokir yang sedang ditulis menahan bon nasabah itu sampai selesai, dan sebaliknya — sehingga tidak ada bon yang
 * lolos di antara "diperiksa" dan "diposting" (temuan M2), dan dua penyaringan serentak tidak membuka dua blokir (M1).
 * Pembacaan blokir sesudah kunci ini dalam transaksi yang sama selalu melihat blokir yang sudah tersimpan.
 */
export async function lockCustomerRows(executor: Executor, customerIds: number[], mode: "share" | "update"): Promise<void> {
  const ids = Array.from(new Set(customerIds)).sort((a, b) => a - b);
  if (!ids.length) return;
  await executor.select({ id: customers.id }).from(customers).where(inArray(customers.id, ids)).orderBy(customers.id).for(mode);
}

export type BlockHold = { block: WatchlistBlock; party: "NASABAH" | "KUASA" };

/** Bon ditahan blokir nasabahnya sendiri lebih dulu, lalu blokir pihak kuasa/wakil. */
export function holdingBlock(active: Map<number, WatchlistBlock>, customerId: number, representativeId: number | null): BlockHold | null {
  const own = active.get(customerId);
  if (own) return { block: own, party: "NASABAH" };
  const representative = representativeId ? active.get(representativeId) : undefined;
  return representative ? { block: representative, party: "KUASA" } : null;
}

/** Dilempar dari dalam transaksi bon supaya seluruh tulisan bon dibatalkan; pemanggil mencatat percobaannya. */
export class WatchlistHoldError extends Error {
  constructor(readonly hold: BlockHold) { super(WATCHLIST_BLOCK_TELLER_MESSAGE); }
}

/** Pemeriksaan blokir di dalam transaksi bon (pembuatan dan penyelesaian), di belakang kunci baris nasabah. */
export async function assertNoBlockInTransaction(tx: Executor, customerId: number, representativeId: number | null): Promise<void> {
  const ids = representativeId ? [customerId, representativeId] : [customerId];
  await lockCustomerRows(tx, ids, "share");
  const hold = holdingBlock(await activeBlockFor(ids, tx), customerId, representativeId);
  if (hold) throw new WatchlistHoldError(hold);
}


export async function openBlocksForScreenings(rows: { customerId: number; screeningId: number | null; matchKeys: string[] }[]): Promise<number> {
  const candidates = rows.filter((row) => row.matchKeys.length > 0);
  if (!candidates.length) return 0;
  const db = await databaseOrThrow();
  return db.transaction(async (tx) => {
    const ids = candidates.map((row) => row.customerId);
    await lockCustomerRows(tx, ids, "update");
    const existing = await blocksOf(ids, tx);
    const openedAt = new Date();
    const toInsert = candidates
      .filter((row) => shouldOpenScreeningBlock(existing.filter((block) => block.customerId === row.customerId) as BlockLite[], row.matchKeys))
      .map((row) => ({ customerId: row.customerId, openedAt, source: "PENYARINGAN" as const, screeningId: row.screeningId, matchKeys: JSON.stringify(row.matchKeys), status: "OPEN" as const }));
    if (!toInsert.length) return 0;
    await tx.insert(watchlistBlocks).values(toInsert);
    return toInsert.length;
  });
}

export async function openBlockFromScreening(input: { customerId: number; screeningId: number | null; matchKeys: string[] }): Promise<boolean> {
  return (await openBlocksForScreenings([input])) > 0;
}

/**
 * Blokir atas centang petugas. `executor` diisi transaksi penyimpanan nasabah: centang yang tersimpan
 * tanpa blokirnya adalah nasabah bercentang yang tetap dapat bertransaksi.
 */
export async function openOfficerBlock(customerId: number, executor?: Executor): Promise<boolean> {
  const open = async (tx: Executor) => {
    await lockCustomerRows(tx, [customerId], "update");
    if (hasActiveBlock(await blocksOf([customerId], tx) as BlockLite[])) return false;
    await tx.insert(watchlistBlocks).values({ customerId, openedAt: new Date(), source: "PETUGAS", screeningId: null, matchKeys: null, status: "OPEN" });
    return true;
  };
  return executor ? open(executor) : (await databaseOrThrow()).transaction(open);
}

/** Blokir yang masih menahan (OPEN/CONFIRMED) per nasabah — yang terbaru bila lebih dari satu. */
export async function activeBlockFor(customerIds: number[], executor?: Executor): Promise<Map<number, WatchlistBlock>> {
  const result = new Map<number, WatchlistBlock>();
  for (const block of await blocksOf(customerIds, executor)) {
    if (block.status !== "OPEN" && block.status !== "CONFIRMED") continue;
    const current = result.get(block.customerId);
    if (!current || current.id < block.id) result.set(block.customerId, block);
  }
  return result;
}

/**
 * Satu baris percobaan transaksi yang ditahan blokir — Pasal 47 ayat (1) huruf d ("termasuk
 * percobaan Transaksi"). Dipanggil `createTransaction` dan `completeTransaction` sesudah bonnya ditolak.
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

/** Apakah nasabah punya blokir yang sudah dikonfirmasi — centangnya tidak boleh dicabut selama itu. */
export async function hasConfirmedBlock(customerId: number): Promise<boolean> {
  return (await blocksOf([customerId])).some((block) => block.status === "CONFIRMED");
}

/**
 * Menulis keputusan hanya bila status blokir masih `expected`. Dua Controller yang memutuskan blokir
 * yang sama bersamaan: yang kalah mendapati 0 baris berubah dan ditolak, sehingga keputusan yang
 * menang (mis. CONFIRMED) tidak pernah tertimpa diam-diam.
 */
async function updateIfStatus(tx: Executor, block: WatchlistBlock, expected: WatchlistBlock["status"], next: Partial<WatchlistBlock>, message: string) {
  const result = await tx.update(watchlistBlocks).set(next).where(and(eq(watchlistBlocks.id, block.id), eq(watchlistBlocks.status, expected)));
  if (affectedRows(result) !== 1) throw new Error(message);
}

async function audit(db: Executor, actorUserId: number, action: string, block: WatchlistBlock, afterState: Record<string, unknown>) {
  await db.insert(auditLogs).values({ actorUserId, action, entityType: "watchlist_block", entityId: String(block.id), beforeState: { status: block.status }, afterState });
}

export async function resolveWatchlistBlock(input: { blockId: number; decision: "CONFIRMED" | "FALSE_POSITIVE"; notes: string; ltkmReference?: string | null; biCopySentAt?: Date | null }, actor: { id: number }) {
  const notes = requireNote(input.notes, "Catatan keputusan");
  // Sama dengan recordWatchlistBlockReporting: layar membatasi lewat `max`, server yang menegakkan (temuan M4).
  if (input.biCopySentAt && input.biCopySentAt.getTime() > Date.now()) throw new Error("Tanggal tembusan tidak boleh di masa depan.");
  const { db, block } = await loadBlock(input.blockId);
  if (block.status !== "OPEN") throw new Error("Pemblokiran ini sudah diputuskan.");
  const resolvedAt = new Date();
  const next = { status: input.decision, resolvedByUserId: actor.id, resolvedAt, resolutionNotes: notes,
    ...(input.decision === "CONFIRMED" ? { ltkmReference: input.ltkmReference?.trim() || null, biCopySentAt: input.biCopySentAt ?? null } : {}) };
  await db.transaction(async (tx) => {
    await updateIfStatus(tx, block, "OPEN", next, "Pemblokiran ini sudah diputuskan.");
    if (input.decision === "CONFIRMED") {
      // Sama dengan centang saat nasabah dibuat: kecocokan yang dikonfirmasi berarti HIGH dan
      // RESTRICTED (nasabah INACTIVE tetap INACTIVE), dan persetujuan risiko tinggi lama tidak
      // menaunginya.
      const [customer] = await tx.select({ riskLevel: customers.riskLevel, profileStatus: customers.profileStatus }).from(customers).where(eq(customers.id, block.customerId)).limit(1);
      await tx.update(customers).set({
        dttotPpsdmMatch: true,
        dttotPpsdmNotes: `Dikonfirmasi pada pemblokiran #${block.id}: ${notes}`,
        riskLevel: "HIGH",
        profileStatus: customer?.profileStatus === "INACTIVE" ? "INACTIVE" : "RESTRICTED",
        ...(customer ? highRiskResetValues(customer.riskLevel, "HIGH") ?? {} : {}),
      }).where(eq(customers.id, block.customerId));
    } else if (block.source === "PETUGAS") {
      await tx.update(customers).set({ dttotPpsdmMatch: false, dttotPpsdmNotes: null }).where(eq(customers.id, block.customerId));
    }
    await audit(tx, actor.id, input.decision === "CONFIRMED" ? "WATCHLIST_BLOCK_CONFIRMED" : "WATCHLIST_BLOCK_FALSE_POSITIVE", block, next);
  });
  return { ...block, ...next } as WatchlistBlock;
}

export async function recordWatchlistBlockReporting(input: { blockId: number; ltkmReference: string; biCopySentAt: Date }, actor: { id: number }) {
  const ltkmReference = requireNote(input.ltkmReference, "Rujukan LTKM");
  const { db, block } = await loadBlock(input.blockId);
  if (block.status !== "CONFIRMED") throw new Error("Pelaporan hanya dicatat pada blokir yang dikonfirmasi.");
  if (input.biCopySentAt.getTime() > Date.now()) throw new Error("Tanggal tembusan tidak boleh di masa depan.");
  const next = { ltkmReference, biCopySentAt: input.biCopySentAt };
  await db.transaction(async (tx) => {
    await updateIfStatus(tx, block, "CONFIRMED", next, "Status pemblokiran sudah berubah; muat ulang register.");
    await audit(tx, actor.id, "WATCHLIST_BLOCK_REPORTED", block, next);
  });
  return { ...block, ...next } as WatchlistBlock;
}

export async function revokeWatchlistBlock(input: { blockId: number; revocationReference: string; notes: string }, actor: { id: number }) {
  const revocationReference = requireNote(input.revocationReference, "Rujukan surat pencabutan");
  const notes = requireNote(input.notes, "Catatan");
  const { db, block } = await loadBlock(input.blockId);
  if (block.status !== "CONFIRMED") throw new Error("Hanya blokir yang dikonfirmasi yang dapat dicabut.");
  const next = { status: "DICABUT" as const, revocationReference, resolutionNotes: `${block.resolutionNotes ?? ""}\n[Dicabut] ${notes}`.trim(), resolvedByUserId: actor.id, resolvedAt: new Date() };
  await db.transaction(async (tx) => {
    await updateIfStatus(tx, block, "CONFIRMED", next, "Status pemblokiran sudah berubah; muat ulang register.");
    await audit(tx, actor.id, "WATCHLIST_BLOCK_REVOKED", block, next);
  });
  return { ...block, ...next } as WatchlistBlock;
}

export async function listWatchlistBlocks() {
  const db = await databaseOrThrow();
  const rows = await db.select({
    block: watchlistBlocks, customerName: customers.fullName, cifNumber: customers.cifNumber,
    // Ringkasan penyaringan pemicu: nama pada daftar dan skornya — bahan Controller memutuskan.
    screeningSummary: customerWatchlistScreenings.summary, screeningMatchCount: customerWatchlistScreenings.matchCount,
  })
    .from(watchlistBlocks).innerJoin(customers, eq(watchlistBlocks.customerId, customers.id))
    .leftJoin(customerWatchlistScreenings, eq(customerWatchlistScreenings.id, watchlistBlocks.screeningId))
    .orderBy(desc(watchlistBlocks.openedAt));
  const ids = rows.map((row) => row.block.id);
  const attempts = ids.length ? await db.select().from(attemptedTransactions).where(inArray(attemptedTransactions.blockId, ids)).orderBy(desc(attemptedTransactions.attemptedAt)) : [];
  return rows.map((row) => ({ ...row.block, customerName: row.customerName, cifNumber: row.cifNumber, screeningSummary: row.screeningSummary ?? null, screeningMatchCount: row.screeningMatchCount ?? null, attempts: attempts.filter((attempt) => attempt.blockId === row.block.id) }));
}
