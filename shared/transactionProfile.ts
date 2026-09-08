/**
 * Profil transaksi nasabah: penilaian penyimpangan dan irama peninjauan berkala.
 *
 * Menutup temuan pemeriksaan BI 10 dan sisa temuan 9. Sebelum ini, "aktivitas nasabah menyimpang
 * dari profilnya" tidak dapat dibuktikan maupun dibantah karena nasabah tidak pernah menyatakan
 * angka apa pun — yang tersimpan hanya kolom kualitatif.
 *
 * Seluruh isi berkas ini **murni**: masuk deklarasi dan aktivitas nyata, keluar daftar alasan.
 * Tidak menyentuh basis data dan tidak membaca jam — `asOf` selalu diminta dari pemanggilnya,
 * sehingga aturannya dapat diuji tanpa basis data maupun waktu berjalan.
 */

/**
 * Ambang penyimpangan: menyimpang bila **mencapai** dua kali lipat deklarasinya.
 *
 * Keputusan pengguna 7 September 2026. Satu pengali yang sama dipakai untuk nilai maupun frekuensi
 * — satu angka kepatuhan yang dapat ditunjuk lebih baik daripada dua yang harus dijelaskan.
 */
export const PROFILE_DEVIATION_MULTIPLE = 2;

/** Irama peninjauan berbasis risiko. Keputusan pengguna 7 September 2026. */
export const PROFILE_REVIEW_INTERVAL_MONTHS_BY_RISK = {
  HIGH: 1,
  MEDIUM: 3,
  LOW: 12,
} as const;

export type CustomerRiskLevel = keyof typeof PROFILE_REVIEW_INTERVAL_MONTHS_BY_RISK;

export type ProfileDeviationReason =
  | "PROFIL_BELUM_DIDEKLARASIKAN"
  | "NILAI_BULANAN_MELEBIHI_PROFIL"
  | "FREKUENSI_BULANAN_MELEBIHI_PROFIL"
  | "MATA_UANG_TIDAK_DIDEKLARASIKAN";

/** Apa yang dinyatakan nasabah sendiri pada borang. Ketiganya boleh kosong: nasabah lama belum pernah ditanya. */
export type TransactionProfileDeclaration = {
  declaredMonthlyValueIdr?: string | number | null;
  declaredMonthlyCount?: number | null;
  declaredCurrencies?: string[] | null;
};

/** Aktivitas nyata sebulan menurut jendela bulanan WIB. */
export type MonthlyProfileActivity = {
  totalValueIdr: string | number;
  transactionCount: number;
  currencyCodes: string[];
};

export type ProfileDeviationAssessment = {
  reasons: ProfileDeviationReason[];
  /**
   * Benar bila ada penyimpangan sungguhan. `PROFIL_BELUM_DIDEKLARASIKAN` **tidak** membuatnya benar:
   * kekosongan deklarasi adalah pekerjaan yang belum dilakukan, bukan penyimpangan nasabah.
   */
  hasDeviation: boolean;
  undeclaredCurrencies: string[];
  /** Ambang yang berlaku, agar peninjau melihat angkanya, bukan hanya benderanya. Null bila tidak dideklarasikan. */
  valueThresholdIdr: number | null;
  countThreshold: number | null;
};

/**
 * Angka deklarasi yang sah, atau null.
 *
 * Nol diperlakukan sama dengan `null`: belum dideklarasikan, bukan ambang nol. `0 x 2 = 0` akan
 * membuat transaksi apa pun melewatinya, sehingga setiap nasabah berdeklarasi nol menyala selamanya.
 */
const declaredAmount = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const actualAmount = (value: string | number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeCurrency = (code: string) => code.trim().toUpperCase();

/**
 * Menilai aktivitas sebulan terhadap deklarasi nasabah.
 *
 * Nilai, frekuensi, dan mata uang dinilai **terpisah dan berdiri sendiri**. Menyalanya frekuensi
 * sendirian adalah kasus yang paling berarti: banyak transaksi kecil yang totalnya masih wajar
 * adalah bentuk pemecahan transaksi.
 *
 * Ukuran yang tidak dideklarasikan tidak dinilai — ia tidak bisa dilanggar. Bila **tidak satu pun**
 * dari ketiganya dideklarasikan, hasilnya `PROFIL_BELUM_DIDEKLARASIKAN` seorang diri.
 */
export function assessProfileDeviation(
  declaration: TransactionProfileDeclaration,
  activity: MonthlyProfileActivity,
): ProfileDeviationAssessment {
  const declaredValue = declaredAmount(declaration.declaredMonthlyValueIdr);
  const declaredCount = declaredAmount(declaration.declaredMonthlyCount);
  const declaredCurrencies = (declaration.declaredCurrencies ?? []).map(normalizeCurrency).filter((code) => code.length > 0);

  const valueThresholdIdr = declaredValue === null ? null : declaredValue * PROFILE_DEVIATION_MULTIPLE;
  const countThreshold = declaredCount === null ? null : declaredCount * PROFILE_DEVIATION_MULTIPLE;

  if (declaredValue === null && declaredCount === null && declaredCurrencies.length === 0) {
    return {
      reasons: ["PROFIL_BELUM_DIDEKLARASIKAN"],
      hasDeviation: false,
      undeclaredCurrencies: [],
      valueThresholdIdr: null,
      countThreshold: null,
    };
  }

  const reasons: ProfileDeviationReason[] = [];

  if (valueThresholdIdr !== null && actualAmount(activity.totalValueIdr) >= valueThresholdIdr) {
    reasons.push("NILAI_BULANAN_MELEBIHI_PROFIL");
  }

  if (countThreshold !== null && activity.transactionCount >= countThreshold) {
    reasons.push("FREKUENSI_BULANAN_MELEBIHI_PROFIL");
  }

  const undeclaredCurrencies =
    declaredCurrencies.length === 0
      ? []
      : Array.from(new Set(activity.currencyCodes.map(normalizeCurrency).filter((code) => code.length > 0))).filter(
          (code) => !declaredCurrencies.includes(code),
        );

  if (undeclaredCurrencies.length > 0) reasons.push("MATA_UANG_TIDAK_DIDEKLARASIKAN");

  return { reasons, hasDeviation: reasons.length > 0, undeclaredCurrencies, valueThresholdIdr, countThreshold };
}

/** Selang peninjauan dalam bulan menurut peringkat risiko nasabah. */
export function profileReviewIntervalMonths(riskLevel: CustomerRiskLevel): number {
  return PROFILE_REVIEW_INTERVAL_MONTHS_BY_RISK[riskLevel];
}

/**
 * Jatuh tempo peninjauan berikutnya: sekian bulan setelah peninjauan terakhir.
 *
 * Tanggal yang tidak ada pada bulan tujuan dimundurkan ke hari terakhir bulan itu — ditinjau
 * 31 Januari dengan irama sebulan jatuh tempo 28/29 Februari, bukan melompat ke 2 atau 3 Maret.
 * Bentuknya mengikuti `nextReviewDueAt` pada `shared/employeeProfileReview.ts`.
 */
export function nextProfileReviewDueAt(lastReviewedAt: Date, riskLevel: CustomerRiskLevel): Date {
  const months = profileReviewIntervalMonths(riskLevel);
  const year = lastReviewedAt.getUTCFullYear();
  const targetMonth = lastReviewedAt.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, targetMonth, Math.min(lastReviewedAt.getUTCDate(), lastDayOfTargetMonth)));
}

/**
 * Apakah nasabah jatuh tempo ditinjau pada `asOf`.
 *
 * Nasabah yang **belum pernah** ditinjau selalu jatuh tempo: itu keadaan awal seluruh basis nasabah
 * hari ini, dan menyembunyikannya akan membuat worklist kosong pada hari pertama sekaligus salah.
 */
export function isProfileReviewDue(
  lastReviewedAt: Date | null | undefined,
  riskLevel: CustomerRiskLevel,
  asOf: Date,
): boolean {
  if (!lastReviewedAt) return true;
  return asOf.getTime() >= nextProfileReviewDueAt(lastReviewedAt, riskLevel).getTime();
}
