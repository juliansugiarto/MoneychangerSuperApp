import { and, desc, eq } from "drizzle-orm";
import { customers, customerWatchlistScreenings, sanctionsWatchlistEntries, users } from "../drizzle/schema";
import { isScreeningStale } from "../shared/customerHighRisk";
import { findBestNameMatch, MATCH_THRESHOLD } from "../shared/sanctionsNameMatch";
import { getDb } from "./db";

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

export type SanctionsWatchlistMatch = {
  id: number; listType: "DTTOT" | "DPPSPM"; sourceLabel: string | null; entityType: "INDIVIDUAL" | "ENTITY";
  referenceCode: string | null; fullName: string; matchedOn: string; score: number;
  dateOfBirth: string | null; placeOfBirth: string | null; nationality: string | null; address: string | null; description: string | null;
};

/** Baris daftar sanksi seperlunya bagi pencocokan — bentuknya, bukan tabelnya, yang dituntut. */
export type WatchlistEntryForMatching = {
  id: number; listType: "DTTOT" | "DPPSPM"; sourceLabel: string | null; entityType: "INDIVIDUAL" | "ENTITY";
  referenceCode: string | null; fullName: string; aliases: string | null;
  dateOfBirth: string | null; placeOfBirth: string | null; nationality: string | null; address: string | null; description: string | null;
};

/**
 * Pencocokan satu nama terhadap entri yang sedang termuat — murni, dan **satu-satunya** definisi
 * "cocok" di aplikasi ini.
 *
 * Baik pencarian manual (`searchSanctionsWatchlist`) maupun penyaringan otomatis memanggil fungsi
 * ini. Dua definisi kecocokan yang berbeda pendapat adalah kekeliruan yang tidak terlihat dari
 * layar mana pun: jejak penyaringan akan mengatakan "nihil" atas nama yang justru ditemukan
 * petugas lewat kotak pencarian.
 *
 * Hasilnya lengkap dan terurut menurun; pembatasan banyaknya untuk layar dilakukan pemanggilnya,
 * supaya `matchCount` pada jejak tetap jumlah yang sebenarnya.
 */
export function matchWatchlistEntries(query: string, entries: WatchlistEntryForMatching[]): SanctionsWatchlistMatch[] {
  const results: SanctionsWatchlistMatch[] = [];
  for (const entry of entries) {
    const candidateNames = [entry.fullName, ...(entry.aliases ? entry.aliases.split("\n") : [])];
    const best = findBestNameMatch(query, candidateNames);
    if (best && best.score >= MATCH_THRESHOLD) {
      results.push({
        id: entry.id, listType: entry.listType, sourceLabel: entry.sourceLabel, entityType: entry.entityType, referenceCode: entry.referenceCode,
        fullName: entry.fullName, matchedOn: best.name, score: best.score,
        dateOfBirth: entry.dateOfBirth, placeOfBirth: entry.placeOfBirth, nationality: entry.nationality, address: entry.address, description: entry.description,
      });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

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

  // Sekali baca: daftar yang dicocokkan dan daftar yang menentukan `listSnapshotAt` wajib kumpulan
  // baris yang sama, kalau tidak jejaknya menunjuk ke daftar yang bukan dipakainya.
  const entries = await db.select().from(sanctionsWatchlistEntries);
  const listSnapshotAt = latestImportedAt(entries);

  let matches: SanctionsWatchlistMatch[] = [];
  let summary: string | null;
  if (fullName.length < MIN_SCREENABLE_NAME_LENGTH) {
    // Namanya tidak dapat dicocokkan, tetapi barisnya tetap ditulis dengan alasannya — "tidak ada
    // baris" dan "disaring, nihil" adalah dua keadaan yang berbeda bagi pemeriksa.
    summary = TOO_SHORT_SUMMARY;
  } else {
    matches = matchWatchlistEntries(fullName, entries);
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
    // Waktunya ditetapkan di sini, bukan diserahkan kepada `DEFAULT CURRENT_TIMESTAMP`. MySQL
    // mengisi bawaan itu dari jam sesi basis data — pada mesin pengembangan WIB ia menyimpan jam
    // dinding setempat, sedangkan `listSnapshotAt` ditulis dari JS sebagai instan UTC. Dua
    // kesepakatan waktu di dalam satu baris membuat panel riwayat memperlihatkan penyaringan yang
    // seolah terjadi tujuh jam di masa depan.
    screenedAt: new Date(),
    customerId: result.customerId,
    screenedByUserId: input.screenedByUserId,
    trigger: result.trigger,
    matchCount: result.matchCount,
    summary: result.summary,
    listSnapshotAt: result.listSnapshotAt,
  });

  return result;
}

/** Sekali tulis maksimal sekian baris, supaya satu impor tidak menjadi satu pernyataan raksasa. */
const RESCREEN_INSERT_CHUNK = 500;

/**
 * Menyaring ulang seluruh nasabah aktif terhadap daftar yang sedang termuat — satu baris per
 * nasabah, dijalankan sistem.
 *
 * Daftarnya dibaca **sekali** untuk seluruh nasabah, bukan sekali per nasabah: pencocokannya toh
 * berlangsung di memori, dan membaca ulang seluruh entri sebanyak jumlah nasabah adalah beban yang
 * tidak membeli apa pun. Nasabah demo dan historis dilewati, sama seperti pemadanan SIPENDAR.
 */
export async function rescreenAllCustomers(): Promise<{ customerCount: number; listSnapshotAt: Date | null }> {
  const db = await databaseOrThrow();
  const entries = await db.select().from(sanctionsWatchlistEntries);
  const listSnapshotAt = latestImportedAt(entries);
  const liveCustomers = await db.select({ id: customers.id, fullName: customers.fullName })
    .from(customers).where(and(eq(customers.isDemo, false), eq(customers.isHistorical, false)));

  // Satu waktu untuk seluruh baris impor ini: mereka memang satu peristiwa.
  const screenedAt = new Date();
  const rows = liveCustomers.map((customer) => {
    const fullName = customer.fullName?.trim() ?? "";
    const matches = fullName.length < MIN_SCREENABLE_NAME_LENGTH ? [] : matchWatchlistEntries(fullName, entries);
    return {
      screenedAt,
      customerId: customer.id,
      screenedByUserId: null,
      trigger: "DAFTAR_DIIMPOR" as const,
      matchCount: matches.length,
      summary: fullName.length < MIN_SCREENABLE_NAME_LENGTH ? TOO_SHORT_SUMMARY : summarizeScreeningMatches(matches),
      listSnapshotAt,
    };
  });

  for (let index = 0; index < rows.length; index += RESCREEN_INSERT_CHUNK) {
    await db.insert(customerWatchlistScreenings).values(rows.slice(index, index + RESCREEN_INSERT_CHUNK));
  }

  return { customerCount: rows.length, listSnapshotAt };
}

/** Riwayat yang ditampilkan pada profil nasabah; secukupnya untuk dibaca, bukan seluruh umur nasabah. */
const SCREENING_HISTORY_LIMIT = 25;

/**
 * Riwayat penyaringan satu nasabah beserta jawaban atas pertanyaan yang sebenarnya: apakah
 * penyaringan terakhirnya masih berlaku terhadap daftar yang dipegang hari ini.
 *
 * Keusangan dihitung di server, bukan di layar: bila layar yang menghitungnya, layar kedua yang
 * kelak menampilkan hal yang sama akan menghitungnya sedikit berbeda.
 */
export async function listCustomerScreenings(customerId: number) {
  const db = await databaseOrThrow();
  const rows = await db.select({
    id: customerWatchlistScreenings.id,
    screenedAt: customerWatchlistScreenings.screenedAt,
    trigger: customerWatchlistScreenings.trigger,
    matchCount: customerWatchlistScreenings.matchCount,
    summary: customerWatchlistScreenings.summary,
    listSnapshotAt: customerWatchlistScreenings.listSnapshotAt,
    screenedByUserId: customerWatchlistScreenings.screenedByUserId,
    screenedByName: users.name,
  })
    .from(customerWatchlistScreenings)
    .leftJoin(users, eq(users.id, customerWatchlistScreenings.screenedByUserId))
    .where(eq(customerWatchlistScreenings.customerId, customerId))
    .orderBy(desc(customerWatchlistScreenings.screenedAt))
    .limit(SCREENING_HISTORY_LIMIT);

  const entries = await db.select({ importedAt: sanctionsWatchlistEntries.importedAt }).from(sanctionsWatchlistEntries);
  const latestImportAt = latestImportedAt(entries);
  const latest = rows[0] ?? null;

  return {
    screenings: rows,
    latestImportAt,
    lastScreenedAt: latest?.screenedAt ?? null,
    // Nasabah yang belum pernah disaring sama sekali bukan "usang" melainkan "belum pernah";
    // layarnya membedakan keduanya karena tindakan yang dituntut memang berbeda.
    isStale: latest ? isScreeningStale(latest.listSnapshotAt, latestImportAt) : false,
    neverScreened: rows.length === 0,
  };
}

/**
 * Penyaringan ulang atas permintaan petugas — satu-satunya penulis pemicu `MANUAL`.
 *
 * Inilah jalan keluar dari peringatan "daftar usang" pada profil nasabah: tanpa ini, satu-satunya
 * cara menyaring ulang seorang nasabah adalah menyunting profilnya, dan menyunting data KYC hanya
 * demi memicu penyaringan adalah jejak audit yang menyesatkan.
 */
export async function rescreenCustomerNow(customerId: number, actorUserId: number) {
  const db = await databaseOrThrow();
  const [row] = await db.select({ id: customers.id, fullName: customers.fullName }).from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.isDemo, false), eq(customers.isHistorical, false))).limit(1);
  if (!row) throw new Error("Nasabah tidak ditemukan.");
  return screenCustomer({ customerId: row.id, fullName: row.fullName, trigger: "MANUAL", screenedByUserId: actorUserId });
}
