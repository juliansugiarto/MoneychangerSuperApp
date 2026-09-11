/**
 * Peragaan Paket M pada basis data lokal — penatausahaan dokumen.
 *
 * Melengkapi peragaan lewat layar untuk bagian yang tidak dapat dijalankan lewat layar di mesin ini:
 * akun Controller tidak masuk di peramban peragaan, sehingga penolakan hapus permanen oleh
 * Controller dibuktikan dengan memanggil penulis yang sesungguhnya memakai baris pengguna
 * `test-controller` apa adanya. Tidak ada yang ditulis kecuali lewat penulis itu sendiri.
 *
 * Jalankan:
 *   ./node_modules/.bin/tsx scripts/peragaanPaketM.mts pernyataan <customerId>
 *   ./node_modules/.bin/tsx scripts/peragaanPaketM.mts tolak-controller <documentId>
 *   ./node_modules/.bin/tsx scripts/peragaanPaketM.mts audit
 */
import { desc, eq, like } from "drizzle-orm";
import { auditLogs, operationalDocuments, users } from "../drizzle/schema";
import { purgeCompanyProfileDocument } from "../server/companyProfileDocuments";
import { getDb } from "../server/db";
import { customerRetentionStatement, documentRetentionOverview } from "../server/documentRetentionQueries";

if (process.env.NODE_ENV === "production") throw new Error("Peragaan ini hanya untuk basis data lokal.");

const tanggal = (value: Date | null | undefined) =>
  value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value) + " WIB" : "—";
/** Khusus tenggat: `null` berarti ditahan tanpa batas, bukan tanggal yang kosong. */
const tenggat = (value: Date | null | undefined) => (value ? tanggal(value) : "tanpa batas");

async function pernyataan(customerId: number) {
  const statement = await customerRetentionStatement(customerId);
  console.log(`Nasabah ${statement.customer.fullName} (${statement.customer.cifNumber}) · ${statement.customer.profileStatus}`);
  console.log(`  relationshipEndedAt   : ${tanggal(statement.customer.relationshipEndedAt)}`);
  console.log(`  transaksi selesai akhir: ${tanggal(statement.facts.lastCompletedTransactionAt)}`);
  console.log(`  putusan nasabah       : ${statement.customerVerdict.basis} · ditahan sampai ${tenggat(statement.customerVerdict.retainUntil)}`);
  console.log(`                          ${statement.customerVerdict.detail}`);
  for (const row of statement.customerDocuments) console.log(`  dokumen nasabah #${row.id} ${row.documentType}: ${row.verdict.basis} · ${tenggat(row.verdict.retainUntil)}`);
  for (const row of statement.transactionDocuments) console.log(`  dokumen bon ${row.transactionNumber} #${row.id} ${row.documentType}: ${row.verdict.basis} · ${tenggat(row.verdict.retainUntil)} · ${row.verdict.detail}`);
  console.log(`  korespondensi         : tersedia=${statement.korespondensi.tersedia}`);
  const overview = await documentRetentionOverview();
  console.log("Ringkasan:", JSON.stringify(overview.customers), JSON.stringify(overview.companyProfileDocuments));
}

async function tolakController(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data lokal tidak tersedia.");
  const [controller] = await db.select({ id: users.id, role: users.role, mustChangePassword: users.mustChangePassword })
    .from(users).where(eq(users.username, "test-controller")).limit(1);
  if (!controller) throw new Error("Akun test-controller tidak ditemukan.");
  console.log(`Controller #${controller.id} role=${controller.role} mencoba menghapus permanen dokumen #${documentId}…`);
  try {
    await purgeCompanyProfileDocument({ documentId, reason: "percobaan peragaan oleh Controller" }, controller);
    console.log("  TIDAK DITOLAK — ini cacat.");
    process.exitCode = 1;
  } catch (error) {
    console.log(`  ditolak: ${error instanceof Error ? error.message : String(error)}`);
  }
  const [still] = await db.select({ id: operationalDocuments.id }).from(operationalDocuments).where(eq(operationalDocuments.id, documentId)).limit(1);
  console.log(`  baris dokumen masih ada: ${still ? "ya" : "TIDAK"}`);
}

async function audit() {
  const db = await getDb();
  if (!db) throw new Error("Basis data lokal tidak tersedia.");
  const rows = await db.select({ id: auditLogs.id, action: auditLogs.action, entityId: auditLogs.entityId, actorUserId: auditLogs.actorUserId, reason: auditLogs.reason, beforeState: auditLogs.beforeState, metadata: auditLogs.metadata })
    .from(auditLogs).where(like(auditLogs.action, "COMPANY_PROFILE_DOCUMENT%")).orderBy(desc(auditLogs.id)).limit(5);
  for (const row of rows) {
    const before = (row.beforeState ?? {}) as Record<string, unknown>;
    console.log(`#${row.id} ${row.action} dokumen ${row.entityId} oleh #${row.actorUserId} · alasan: ${row.reason} · storageKey: ${before.storageKey ?? "—"} · metadata: ${JSON.stringify(row.metadata)}`);
  }
}

const [mode, arg] = process.argv.slice(2);
if (mode === "pernyataan") await pernyataan(Number(arg));
else if (mode === "tolak-controller") await tolakController(Number(arg));
else if (mode === "audit") await audit();
else throw new Error("Mode: pernyataan <customerId> | tolak-controller <documentId> | audit");
process.exit();
