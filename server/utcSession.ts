import { sql, type SQL } from "drizzle-orm";

/**
 * Zona sesi basis data aplikasi (spec 2026-09-26 zona waktu UTC). Drizzle menulis dan membaca kolom
 * `timestamp` sebagai teks UTC, sedangkan MySQL menafsirkan teks itu menurut zona SESI; bawaan `now()`
 * adalah instan sungguhan. Tanpa sesi UTC keduanya berselisih sebesar zona mesin basis data — tujuh
 * jam di laptop WIB. Bentuk offset dipakai karena bentuk bernama menuntut tabel zona MySQL.
 */
export const UTC_SESSION_SQL = "SET time_zone = '+00:00'";

/** Untuk event `connection` pool callback mysql2: berjalan sebelum kueri apa pun di sambungan itu. */
export function applyUtcSession(connection: { query(sql: string, callback: (error: Error | null) => void): unknown }) {
  connection.query(UTC_SESSION_SQL, (error) => {
    if (error) console.error("[Database] Gagal menyetel zona sesi UTC:", error.message);
  });
}

/** Menolak menyala bila sesi basis data bukan UTC — lebih baik berhenti daripada menyimpan waktu bergeser. */
export async function assertUtcSession(db: { execute(query: SQL): Promise<unknown> }) {
  const result = await db.execute(sql`SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS offsetMinutes`);
  const offset = Number((result as unknown as Array<Array<{ offsetMinutes: number | string }>>)[0][0].offsetMinutes);
  if (offset !== 0) {
    throw new Error(`Zona sesi basis data bukan UTC (selisih ${offset} menit). Waktu akan tersimpan bergeser; periksa "${UTC_SESSION_SQL}" pada sambungan atau default-time-zone server basis data.`);
  }
}
