import { customerWatchlistScreenings, sanctionsWatchlistEntries } from "../drizzle/schema";
import { getDb } from "./db";
import { searchSanctionsWatchlist, type SanctionsWatchlistMatch } from "./operations";

/**
 * Penulis jejak penyaringan nasabah terhadap DTTOT/DPPSPM — satu-satunya penulis
 * `customer_watchlist_screenings`.
 *
 * Dua hal yang menentukan gunanya modul ini, dan keduanya mudah tergerus:
 *
 * 1. **Baris nihil tetap ditulis.** Godaan "hanya simpan kalau ada temuan" menghapus justru bukti
 *    yang dicari pemeriksa: Pasal 47 ayat (1) huruf c PBI 10/2024 menuntut pengecekannya, bukan
 *    hanya temuannya. Nasabah tanpa satu pun baris penyaringan berarti belum pernah disaring.
 * 2. **`customers.dttotPpsdmMatch` tidak pernah disentuh dari sini.** Penyaringan otomatis membuat
 *    pengisian otomatis kotak centang itu terasa masuk akal, dan itu melanggar aturan yang berlaku
 *    sejak `shared/sanctionsNameMatch.ts`: mesin mencatat kemungkinan, manusia yang memutuskan.
 */

export type ScreeningTrigger = "NASABAH_DIBUAT" | "NASABAH_DIUBAH" | "DAFTAR_DIIMPOR" | "MANUAL";

/** Ringkasan disimpan sebagai petunjuk, bukan salinan daftar sanksi. */
export const SCREENING_SUMMARY_MAX_LENGTH = 500;

/** Panjang minimal nama yang dapat disaring — sama dengan ambang `searchSanctionsWatchlist`. */
const MIN_SCREENABLE_NAME_LENGTH = 3;

const TOO_SHORT_SUMMARY = "Nama nasabah terlalu pendek untuk disaring (minimal 3 karakter); tidak ada pencocokan yang dijalankan.";

export type ScreeningResult = {
  customerId: number;
  trigger: ScreeningTrigger;
  matchCount: number;
  summary: string | null;
  listSnapshotAt: Date | null;
};

/**
 * Ringkasan pendek: daftar mana, nama pada daftarnya, dan skornya. Alamat, tanggal lahir, dan
 * uraian entri sanksi sengaja tidak ikut — jejak ini menunjuk ke barisnya, bukan menyalinnya, dan
 * salinan data daftar yang berumur panjang justru menjadi beban tersendiri.
 */
export function summarizeScreeningMatches(matches: SanctionsWatchlistMatch[]): string | null {
  if (!matches.length) return null;

  const parts: string[] = [];
  let length = 0;
  for (const match of matches) {
    const part = `${match.listType} ${match.fullName} (${match.score.toFixed(2)})`;
    const remainder = matches.length - parts.length - 1;
    const tail = remainder > 0 ? `; dan ${remainder} lainnya` : "";
    // Ditambah hanya bila potongannya beserta ekor "dan N lainnya" masih muat, supaya batasnya
    // tidak pernah dilanggar dan ekornya tidak pernah terpotong separuh.
    const nextLength = length + (parts.length ? 2 : 0) + part.length + tail.length;
    if (parts.length && nextLength > SCREENING_SUMMARY_MAX_LENGTH) break;
    parts.push(part);
    length += (parts.length > 1 ? 2 : 0) + part.length;
  }

  const sisa = matches.length - parts.length;
  const summary = parts.join("; ") + (sisa > 0 ? `; dan ${sisa} lainnya` : "");
  return summary.slice(0, SCREENING_SUMMARY_MAX_LENGTH);
}

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Basis data tidak tersedia.");
  return db;
}

/**
 * `importedAt` terbaru yang sedang termuat, atau `null` bila belum ada daftar sama sekali.
 *
 * Maksimumnya dihitung di sini, bukan lewat `ORDER BY ... LIMIT 1`, supaya nilainya berasal dari
 * kumpulan baris yang sama dengan yang barusan dicocokkan.
 */
export function latestImportedAt(rows: { importedAt: Date | null }[]): Date | null {
  let latest: Date | null = null;
  for (const row of rows) {
    if (!row.importedAt) continue;
    if (!latest || row.importedAt.getTime() > latest.getTime()) latest = row.importedAt;
  }
  return latest;
}

/**
 * Menyaring satu nasabah dan menulis satu baris riwayat. Selalu menulis, apa pun hasilnya.
 *
 * `screenedByUserId` `null` berarti dijalankan sistem (impor daftar), bukan orang.
 */
export async function screenCustomer(input: {
  customerId: number;
  fullName: string;
  trigger: ScreeningTrigger;
  screenedByUserId: number | null;
}): Promise<ScreeningResult> {
  const db = await databaseOrThrow();
  const fullName = input.fullName.trim();

  const entries = await db.select({ importedAt: sanctionsWatchlistEntries.importedAt }).from(sanctionsWatchlistEntries);
  const listSnapshotAt = latestImportedAt(entries);

  let matches: SanctionsWatchlistMatch[] = [];
  let summary: string | null;
  if (fullName.length < MIN_SCREENABLE_NAME_LENGTH) {
    // Namanya tidak dapat dicocokkan, tetapi barisnya tetap ditulis dengan alasannya — "tidak ada
    // baris" dan "disaring, nihil" adalah dua keadaan yang berbeda bagi pemeriksa.
    summary = TOO_SHORT_SUMMARY;
  } else {
    matches = await searchSanctionsWatchlist({ query: fullName });
    summary = summarizeScreeningMatches(matches);
  }

  const result: ScreeningResult = {
    customerId: input.customerId,
    trigger: input.trigger,
    matchCount: matches.length,
    summary,
    listSnapshotAt,
  };

  await db.insert(customerWatchlistScreenings).values({
    customerId: result.customerId,
    screenedByUserId: input.screenedByUserId,
    trigger: result.trigger,
    matchCount: result.matchCount,
    summary: result.summary,
    listSnapshotAt: result.listSnapshotAt,
  });

  return result;
}
