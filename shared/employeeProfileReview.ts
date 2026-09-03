/**
 * Peninjauan berkala profil pegawai.
 *
 * Pemeriksaan menemukan profil pegawai tidak pernah dikinikan setelah perekrutan. Aplikasi KUPVA
 * milik Bank Indonesia memakai tenggang enam bulan, dan tenggang itu dipakai di sini agar jadwal
 * yang ditunjukkan aplikasi ini tidak lebih longgar daripada acuan yang sudah ada.
 *
 * Perhitungannya sengaja dipisah dari basis data: tanggal jatuh tempo dan status keterlambatan
 * adalah aturan, bukan data, sehingga dapat diuji tanpa menyentuh basis data mana pun.
 */

export const PROFILE_REVIEW_INTERVAL_MONTHS = 6;

/** Ambang "segera jatuh tempo" — cukup awal untuk dijadwalkan, tidak terlalu awal sampai jadi bising. */
export const PROFILE_REVIEW_WARNING_DAYS = 30;

export type ProfileReviewStatus = "TERKINI" | "SEGERA" | "TERLAMBAT";

const DAY_MS = 86_400_000;

/** Tanggal saja, tanpa jam, agar perbandingan tidak bergeser oleh selisih zona waktu. */
const atStartOfDay = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

/**
 * Jatuh tempo peninjauan berikutnya: enam bulan setelah tanggal acuan.
 *
 * Tanggal yang tidak ada pada bulan tujuan dimundurkan ke hari terakhir bulan itu — 31 Agustus
 * ditinjau lagi paling lambat 28/29 Februari, bukan melompat ke 2 atau 3 Maret.
 */
export function nextReviewDueAt(baseline: Date): Date {
  const start = atStartOfDay(baseline);
  const targetMonth = start.getUTCMonth() + PROFILE_REVIEW_INTERVAL_MONTHS;
  const lastDayOfTargetMonth = new Date(Date.UTC(start.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(start.getUTCFullYear(), targetMonth, Math.min(start.getUTCDate(), lastDayOfTargetMonth)));
}

/**
 * Status peninjauan seorang pegawai.
 *
 * Pegawai yang belum pernah ditinjau dihitung dari tanggal masuk, bukan dianggap terkini —
 * justru merekalah temuan pemeriksaan, dan menganggapnya aman akan menyembunyikan temuan itu.
 */
export function profileReviewStatus(input: { joinedAt: Date; lastReviewedAt?: Date | null; now?: Date }): {
  dueAt: Date;
  status: ProfileReviewStatus;
  daysUntilDue: number;
  neverReviewed: boolean;
} {
  const now = atStartOfDay(input.now ?? new Date());
  const baseline = input.lastReviewedAt ?? input.joinedAt;
  const dueAt = nextReviewDueAt(baseline);
  const daysUntilDue = Math.round((dueAt.getTime() - now.getTime()) / DAY_MS);
  const status: ProfileReviewStatus = daysUntilDue < 0 ? "TERLAMBAT" : daysUntilDue <= PROFILE_REVIEW_WARNING_DAYS ? "SEGERA" : "TERKINI";
  return { dueAt, status, daysUntilDue, neverReviewed: !input.lastReviewedAt };
}

export const PROFILE_REVIEW_OUTCOME_LABELS: Record<string, string> = {
  TIDAK_ADA_PERUBAHAN: "Tidak ada perubahan",
  ADA_PERUBAHAN: "Ada perubahan data",
  PERLU_TINDAK_LANJUT: "Perlu tindak lanjut",
};
