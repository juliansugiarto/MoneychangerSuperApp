/**
 * Peragaan butir B pada basis data LOKAL — pemblokiran DTTOT/DPPSPM, percobaan transaksi, tinjauan
 * klasifikasi risiko, dan tanggal berakhir hubungan.
 *
 * Melengkapi peragaan lewat layar: setiap langkah memanggil penulis yang sesungguhnya (bukan SQL
 * tulisan tangan) memakai baris pengguna `test-*` apa adanya. Satu-satunya yang disisipkan langsung
 * adalah entri daftar sanksi sintetis — sama dengan hasil impor, yang memang menghapus lalu
 * menyisipkan ulang — lalu penyaringan ulang dijalankan persis seperti sesudah impor.
 *
 * Jalankan:
 *   ./node_modules/.bin/tsx scripts/peragaanButirB.mts hitung
 *   ./node_modules/.bin/tsx scripts/peragaanButirB.mts entri-uji "<nama persis nasabah>"
 *   ./node_modules/.bin/tsx scripts/peragaanButirB.mts saring
 *   ./node_modules/.bin/tsx scripts/peragaanButirB.mts bon <customerId> [representativeCustomerId]
 *   ./node_modules/.bin/tsx scripts/peragaanButirB.mts putus <blockId> CONFIRMED|FALSE_POSITIVE "<catatan>"
 *   ./node_modules/.bin/tsx scripts/peragaanButirB.mts lapor <blockId> "<rujukan LTKM>" <YYYY-MM-DD>
 *   ./node_modules/.bin/tsx scripts/peragaanButirB.mts klasifikasi-isi
 *   ./node_modules/.bin/tsx scripts/peragaanButirB.mts berakhir <customerId> <YYYY-MM-DD> "<sumber>"
 */
import { count, eq, sql } from "drizzle-orm";
import {
  attemptedTransactions,
  cashDenominationBalances,
  exchangeTransactionDenominationEntries,
  exchangeTransactionPaymentDenominations,
  exchangeTransactions,
  sanctionsWatchlistEntries,
  users,
  watchlistBlocks,
} from "../drizzle/schema";
import { rescreenAllCustomers } from "../server/customerWatchlistScreening";
import { getDb } from "../server/db";
import { recordRelationshipEnd } from "../server/documentRetentionQueries";
import { listUnclassifiedCodes } from "../server/iraClassificationReview";
import { classifyRisk } from "../server/iraRiskClassification";
import { createTransaction } from "../server/operations";
import { recordWatchlistBlockReporting, resolveWatchlistBlock } from "../server/watchlistBlocks";
import { startOfOperationalDay } from "../shared/regulatoryActionQueue";

if (process.env.NODE_ENV === "production") throw new Error("Peragaan ini hanya untuk basis data lokal.");

const SOURCE_FILE = "peragaan-butir-b.xlsx";

async function db() {
  const database = await getDb();
  if (!database) throw new Error("Basis data tidak tersedia.");
  return database;
}

async function userId(username: string) {
  const [row] = await (await db()).select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (!row) throw new Error(`Pengguna ${username} tidak ada.`);
  return row.id;
}

async function hitung() {
  const database = await db();
  const one = async (table: Parameters<typeof database.select>[0] extends never ? never : any) => (await database.select({ n: count() }).from(table))[0].n;
  const [cashTotal] = await database.select({ total: sql<string>`COALESCE(SUM(${cashDenominationBalances.quantity}), 0)` }).from(cashDenominationBalances);
  console.log(JSON.stringify({
    exchange_transactions: await one(exchangeTransactions),
    denomination_entries: await one(exchangeTransactionDenominationEntries),
    payment_denominations: await one(exchangeTransactionPaymentDenominations),
    cash_denomination_quantity_total: String(cashTotal.total),
    attempted_transactions: await one(attemptedTransactions),
    watchlist_blocks: await one(watchlistBlocks),
  }));
  const blocks = await database.select().from(watchlistBlocks);
  for (const block of blocks) console.log(`  blokir #${block.id} nasabah ${block.customerId} ${block.source} ${block.status} kunci=${block.matchKeys ?? "—"}`);
}

async function entriUji(fullName: string) {
  const database = await db();
  await database.delete(sanctionsWatchlistEntries).where(eq(sanctionsWatchlistEntries.sourceFileName, SOURCE_FILE));
  await database.insert(sanctionsWatchlistEntries).values({
    listType: "DTTOT", sourceLabel: null, entityType: "INDIVIDUAL", referenceCode: "UJI-B2-001", fullName,
    sourceFileName: SOURCE_FILE, importedByUserId: await userId("test-controller"), importedAt: new Date(),
  });
  console.log(`Entri DTTOT sintetis UJI-B2-001 "${fullName}" disisipkan.`);
}

async function bon(customerId: number, representativeCustomerId?: number) {
  try {
    await createTransaction({
      operation: "BUY", customerId, receiptNumber: `UJI-B2-${Date.now()}`,
      lines: [{ currencyId: 7, denominations: [{ value: "100", quantity: 5, rate: "16250" }] }],
      paymentMethod: "CASH", transactionAt: new Date(),
      ...(representativeCustomerId ? { customerActingAs: "REPRESENTATIVE" as const, representativeCustomerId } : {}),
    } as never, await userId("test-staff"));
    console.log("Bon diterima (tidak ditahan).");
  } catch (error) {
    console.log(`Bon ditolak: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function klasifikasiIsi() {
  const missing = await listUnclassifiedCodes();
  console.log(`Belum diklasifikasi sebelum: ${missing.length}`);
  const actor = { id: await userId("test-controller") };
  for (const item of missing) {
    await classifyRisk({ dimension: item.dimension as never, code: item.code, riskType: item.riskType as never, level: "RENDAH", sourceNote: "Data uji lokal peragaan butir B" }, actor);
  }
  console.log(`Belum diklasifikasi sesudah: ${(await listUnclassifiedCodes()).length}`);
}

const [command, ...args] = process.argv.slice(2);
const controller = async () => ({ id: await userId("test-controller") });

if (command === "hitung") await hitung();
else if (command === "entri-uji") await entriUji(args[0]);
else if (command === "saring") console.log(JSON.stringify(await rescreenAllCustomers()));
else if (command === "bon") await bon(Number(args[0]), args[1] ? Number(args[1]) : undefined);
else if (command === "putus") console.log(JSON.stringify(await resolveWatchlistBlock({ blockId: Number(args[0]), decision: args[1] as "CONFIRMED" | "FALSE_POSITIVE", notes: args[2] }, await controller())));
else if (command === "lapor") console.log(JSON.stringify(await recordWatchlistBlockReporting({ blockId: Number(args[0]), ltkmReference: args[1], biCopySentAt: startOfOperationalDay(new Date(`${args[2]}T12:00:00Z`)) }, await controller())));
else if (command === "klasifikasi-isi") await klasifikasiIsi();
else if (command === "berakhir") console.log(JSON.stringify(await recordRelationshipEnd({ customerId: Number(args[0]), dateKey: args[1], source: args[2] }, await controller())));
else console.log("Perintah tidak dikenal. Lihat komentar di kepala berkas.");
process.exit(0);
