import { and, eq, gte, lte } from "drizzle-orm";
import { accountingPeriods } from "../drizzle/schema";
import { operationalDateKey } from "../shared/regulatoryActionQueue";
import { getDb } from "./db";

/** Selisih jam perangkat kasir yang masih diterima; lebih dari ini dianggap waktu masa depan. */
export const TRANSACTION_CLOCK_SKEW_MS = 15 * 60_000;

/**
 * Waktu bon datang dari perangkat kasir. Dua hal yang pasti salah ditolak di server:
 * waktu di masa depan, dan tanggal pada bulan yang sudah tutup buku (jurnalnya tidak akan pernah bisa
 * diposting, dan batch penjurnalan dulu berhenti di tengah karenanya). Seberapa jauh bon boleh dicatat
 * mundur di dalam periode terbuka adalah kebijakan usaha dan sengaja tidak dibatasi di sini.
 */
export async function assertTransactionTimeAllowed(transactionAt: Date, now: Date = new Date()) {
  if (Number.isNaN(transactionAt.getTime())) throw new Error("Waktu bon tidak valid.");
  if (transactionAt.getTime() - now.getTime() > TRANSACTION_CLOCK_SKEW_MS) {
    throw new Error("Waktu bon ada di masa depan. Periksa jam di perangkat ini.");
  }
  const dateKey = operationalDateKey(transactionAt);
  if (await isBookClosedOn(dateKey)) throw new Error(`Buku tanggal ${dateKey} sudah ditutup. Bon untuk tanggal itu tidak bisa dibuat.`);
}

/** Apakah hari usaha `dateKey` (YYYY-MM-DD, WIB) berada di periode buku yang sudah ditutup. */
export async function isBookClosedOn(dateKey: string, executor?: { select: any }) {
  const db = executor ?? await getDb();
  if (!db) throw new Error("Database tidak tersedia. Coba ulangi tindakan ini.");
  // Kolom `date` dibandingkan dengan string YYYY-MM-DD: tidak bergantung pada zona waktu proses.
  const closed: unknown[] = await db.select({ id: accountingPeriods.id }).from(accountingPeriods)
    .where(and(eq(accountingPeriods.status, "DITUTUP"), lte(accountingPeriods.periodStart, dateKey as never), gte(accountingPeriods.periodEnd, dateKey as never)))
    .limit(1);
  return closed.length > 0;
}
