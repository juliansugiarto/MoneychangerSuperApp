import { DEFAULT_OPERATIONAL_TIMEZONE, operationalDateKey, startOfOperationalMonth } from "./regulatoryActionQueue";

/**
 * Aturan retensi dokumen sebagai fungsi murni — tanpa basis data, tanpa `server/`, tanpa `drizzle/`.
 *
 * Pasal 48 PBI 10/2024 hanya mengikat data Pengguna Jasa dan Transaksi keuangan Pengguna Jasa.
 * Dokumen profil perusahaan (logo, izin usaha) diberi aturan rumah tersendiri yang sengaja dinamai
 * demikian agar tidak pernah disajikan sebagai kewajiban Pasal 48.
 */

export const CUSTOMER_DOCUMENT_RETENTION_YEARS = 5;
/** UU Dokumen Perusahaan, dirujuk Pasal 48 ayat (1) huruf b — sepuluh tahun sejak akhir tahun buku. */
export const TRANSACTION_DOCUMENT_RETENTION_YEARS = 10;
/** Aturan rumah, BUKAN Pasal 48. Keputusan pengguna 11 September 2026: dihitung sejak diunggah. */
export const COMPANY_PROFILE_DOCUMENT_RETENTION_YEARS = 5;

export type CustomerProfileStatus = "ACTIVE" | "RESTRICTED" | "INACTIVE";

export type RetentionBasis =
  | "HUBUNGAN_USAHA_BERJALAN"
  | "HUBUNGAN_USAHA_BERAKHIR"
  | "TRANSAKSI_TERAKHIR"
  | "KETIDAKSESUAIAN_PROFIL"
  | "TAHUN_BUKU_TRANSAKSI"
  | "SEJAK_DIUNGGAH";

export type RetentionVerdict = {
  basis: RetentionBasis;
  /** Instan tempat jam mulai berdetak. `null` hanya ketika basisnya HUBUNGAN_USAHA_BERJALAN. */
  basisAt: Date | null;
  /** `null` berarti belum ada tenggat: ditahan tanpa batas sampai jamnya mulai berdetak. */
  retainUntil: Date | null;
  detail: string;
};

function addYears(value: Date, years: number) {
  const result = new Date(value.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

/**
 * Kalimat siap tampil untuk tiap basis nasabah. Ditaruh di sini, bukan di komponen React, agar
 * layar dan uji memakai kalimat yang sama persis.
 */
function retentionDetail(basis: RetentionBasis, at: Date, timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE): string {
  const tanggal = operationalDateKey(at, timeZone);
  const years = CUSTOMER_DOCUMENT_RETENTION_YEARS;
  switch (basis) {
    case "HUBUNGAN_USAHA_BERAKHIR":
      return `${years} tahun sejak hubungan usaha berakhir (${tanggal}).`;
    case "TRANSAKSI_TERAKHIR":
      return `${years} tahun sejak transaksi terakhir (${tanggal}), yang jatuh sesudah hubungan usaha berakhir.`;
    case "KETIDAKSESUAIAN_PROFIL":
      return `${years} tahun sejak ketidaksesuaian profil terakhir ditemukan (${tanggal}).`;
    default:
      return `${years} tahun sejak ${tanggal}.`;
  }
}

export type CustomerRetentionFacts = {
  profileStatus: CustomerProfileStatus;
  relationshipEndedAt: Date | null;
  /** Transaksi COMPLETED terakhir (bukan demo, bukan historis). */
  lastCompletedTransactionAt: Date | null;
  /** Peninjauan profil terakhir yang `deviationReasons`-nya tidak kosong. */
  lastDeviationReviewAt: Date | null;
};

/**
 * Selama `profileStatus` belum `INACTIVE`, hubungan usaha masih berjalan dan tidak ada tenggat.
 * Sesudahnya jam berdetak dari instan PALING AKHIR di antara tiga pemicu Pasal 48.
 *
 * `INACTIVE` tanpa `relationshipEndedAt` (baris yang dinonaktifkan sebelum migrasi 0058) juga
 * diperlakukan sebagai belum berdetak: menebak jamnya dari `updatedAt` justru bisa memajukan
 * tenggat, dan tenggat yang terlalu cepat adalah satu-satunya kekeliruan yang tidak boleh terjadi.
 */
export function customerDocumentRetention(facts: CustomerRetentionFacts): RetentionVerdict {
  if (facts.profileStatus !== "INACTIVE" || !facts.relationshipEndedAt) {
    return {
      basis: "HUBUNGAN_USAHA_BERJALAN",
      basisAt: null,
      retainUntil: null,
      detail: "Hubungan usaha masih berjalan; jam lima tahun Pasal 48 belum mulai berdetak.",
    };
  }

  // Penjelasan Pasal 48 ayat (1) huruf b: yang dipakai adalah masa retensi yang TERLAMA.
  const candidates: { basis: RetentionBasis; at: Date }[] = [
    { basis: "HUBUNGAN_USAHA_BERAKHIR", at: facts.relationshipEndedAt },
  ];
  if (facts.lastCompletedTransactionAt) candidates.push({ basis: "TRANSAKSI_TERAKHIR", at: facts.lastCompletedTransactionAt });
  if (facts.lastDeviationReviewAt) candidates.push({ basis: "KETIDAKSESUAIAN_PROFIL", at: facts.lastDeviationReviewAt });

  const winner = candidates.reduce((a, b) => (b.at.getTime() > a.at.getTime() ? b : a));
  const retainUntil = addYears(winner.at, CUSTOMER_DOCUMENT_RETENTION_YEARS);
  return { basis: winner.basis, basisAt: winner.at, retainUntil, detail: retentionDetail(winner.basis, winner.at) };
}

/**
 * Pasal 48 ayat (1) huruf b menunjuk UU Dokumen Perusahaan, yang menghitung sepuluh tahun sejak
 * AKHIR TAHUN BUKU — bukan sejak tanggal transaksinya. Bila aturan nasabah menghasilkan tanggal
 * yang lebih jauh, yang lebih jauh itulah yang berlaku: penjelasan ayat (1) huruf b menetapkan
 * "masa retensi yang terlama" sebagai kaidahnya.
 *
 * Tahun bukunya dibaca di zona operasional, bukan lewat `getUTCFullYear()`: bon pukul 00:30 WIB
 * tanggal 1 Januari masih jatuh pada 31 Desember UTC, dan membacanya lewat UTC memasukkannya ke
 * tahun buku sebelumnya — tenggatnya maju setahun.
 */
export function transactionDocumentRetention(
  transactionAt: Date,
  customerVerdict: RetentionVerdict,
  timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE,
): RetentionVerdict {
  const bookYear = Number(operationalDateKey(transactionAt, timeZone).slice(0, 4));
  const startOfNextYear = startOfOperationalMonth(new Date(Date.UTC(bookYear + 1, 0, 15)), timeZone);
  const bookYearRetainUntil = addYears(startOfNextYear, TRANSACTION_DOCUMENT_RETENTION_YEARS);
  const bookYearVerdict: RetentionVerdict = {
    basis: "TAHUN_BUKU_TRANSAKSI",
    basisAt: startOfNextYear,
    retainUntil: bookYearRetainUntil,
    detail: `${TRANSACTION_DOCUMENT_RETENTION_YEARS} tahun sejak akhir tahun buku ${bookYear}.`,
  };
  // Nasabah tanpa tenggat (hubungan usaha masih berjalan) selalu menang: tanpa batas lebih lama
  // daripada tanggal mana pun.
  if (!customerVerdict.retainUntil) return customerVerdict;
  return customerVerdict.retainUntil.getTime() > bookYearRetainUntil.getTime() ? customerVerdict : bookYearVerdict;
}

export function companyProfileDocumentRetention(createdAt: Date): RetentionVerdict {
  return {
    basis: "SEJAK_DIUNGGAH",
    basisAt: createdAt,
    retainUntil: addYears(createdAt, COMPANY_PROFILE_DOCUMENT_RETENTION_YEARS),
    detail: `Aturan rumah: ${COMPANY_PROFILE_DOCUMENT_RETENTION_YEARS} tahun sejak diunggah. Bukan kewajiban Pasal 48 — dokumen profil perusahaan bukan data Pengguna Jasa.`,
  };
}

/**
 * Meniru `highRiskResetValues` (`server/customerHighRiskApproval.ts`): hanya PERPINDAHAN yang
 * berarti. `INACTIVE → INACTIVE` sengaja tidak menyentuh apa pun — bila ia menyetel ulang, setiap
 * penyuntingan nasabah yang sudah tidak aktif akan memundurkan tenggat retensinya tanpa alasan.
 */
export function relationshipEndValues(
  previousStatus: CustomerProfileStatus,
  nextStatus: CustomerProfileStatus,
  now: Date,
) {
  if (nextStatus === "INACTIVE" && previousStatus !== "INACTIVE") return { relationshipEndedAt: now };
  if (nextStatus !== "INACTIVE" && previousStatus === "INACTIVE") return { relationshipEndedAt: null };
  return null;
}
