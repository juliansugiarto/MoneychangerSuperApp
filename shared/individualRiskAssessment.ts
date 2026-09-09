/**
 * Aritmetika Individual Risk Assessment (IRA), murni dan tanpa basis data.
 *
 * Rumusnya disalin dari template BI `Individual Risk Assessment_Penyelenggara_KUPVA BB` milik
 * pengguna, dibaca 9 September 2026. Yang masuk ke sini hanyalah **struktur** rumusnya — bobot,
 * anchor, matriks. Angka operasional PT IBV tidak ikut, juga tidak sebagai fixture uji.
 *
 * **SKALANYA TERBALIK, dan itu ditulis besar-besar: `5 = Rendah`, `1 = Tinggi`.** Persentase
 * 0–20% bernilai **5**; 81–100% bernilai **1**. KPMR mengikuti arah yang sama
 * (`1 unsatisfactory … 5 strong`). Bila arah ini terbalik, seluruh laporan tetap rapi, tetap
 * berisi angka, dan tetap salah — karena itu ujinya menjaga arah ini lebih dulu daripada apa pun.
 *
 * Berkas ini **murni**: tanpa `getDb`, tanpa `new Date()`, tanpa impor dari `server/`. Uang dan
 * persentase memakai `Decimal`; pembulatan hanya boleh dilakukan saat menampilkan, bukan saat
 * menghitung.
 *
 * Dua kejanggalan template sengaja **diikuti apa adanya**, tidak diperbaiki diam-diam (spec
 * Rancangan 4):
 *  1. Nilai KPMR adalah `AVERAGE` biasa atas kelima pilar (`B!K46`); bobot pilar 30/25/25/10/10
 *     pada lembar `Rekap` tidak dipakai rumusnya dan di sini hanya keterangan layar.
 *  2. Risiko Struktural mengikuti lembar `A1` (dua kelompok: Kepemilikan 0,8, Lini Bisnis 0,2),
 *     bukan lembar `Rekap` yang menyebut tiga komponen. Rumus `E61` hanya menjumlahkan keduanya.
 */

import Decimal from "decimal.js";
import { IRA_DEFAULT_BAND_UPPER_BOUNDS, type IraParameterRiskType, scoreFromBand } from "./iraParameters";

/** Bobot jenis risiko pada lembar `Rekap`, dipakai `A1!F62 = SUM(F58:F61)`. Berjumlah 1. */
export const IRA_RISK_TYPE_WEIGHTS: Record<IraParameterRiskType, string> = {
  TPPU: "0.4",
  TPPT: "0.3",
  PPSPM: "0.05",
  STRUKTURAL: "0.25",
};

/**
 * Bobot kelompok di dalam tiap jenis risiko, sebagaimana kolom bobot lembar `A1`.
 *
 * TPPU/TPPT/PPSPM berkelompok 1 Produk/Jasa · 2 Jalur Distribusi · 3 Pengguna Jasa ·
 * 4 Wilayah Geografis. STRUKTURAL hanya dua: 1 Aspek Struktur Kepemilikan · 2 Lini Bisnis.
 * Kunci kelompoknya sama persis dengan ruas `group` pada `IRA_PARAMETERS`.
 */
export const IRA_GROUP_WEIGHTS: Record<IraParameterRiskType, Record<string, string>> = {
  TPPU: { "1": "0.3", "2": "0.2", "3": "0.3", "4": "0.2" },
  TPPT: { "1": "0.2", "2": "0.2", "3": "0.3", "4": "0.3" },
  PPSPM: { "1": "0.1", "2": "0.2", "3": "0.4", "4": "0.3" },
  STRUKTURAL: { "1": "0.8", "2": "0.2" },
};

/**
 * Bobot pilar KPMR pada lembar `Rekap`. **Tidak dipakai rumus mana pun** — `B!K46` adalah
 * `AVERAGE` sederhana. Disimpan agar layar dapat menampilkannya sebagai keterangan dan agar
 * ketidakterpakaiannya terlihat, bukan hilang. Lihat spec Rancangan 4.1.
 */
export const IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY = {
  DIREKSI_KOMISARIS: "0.3",
  KEBIJAKAN_PROSEDUR: "0.25",
  PROSES_MANAJEMEN_RISIKO: "0.25",
  MANAJEMEN_SDM: "0.1",
  PENGENDALIAN_INTERNAL: "0.1",
} as const;

export const IRA_INHERENT_PREDICATES = [
  "TINGGI",
  "MENENGAH_KE_TINGGI",
  "MENENGAH",
  "RENDAH_KE_MENENGAH",
  "RENDAH",
] as const;
export type IraInherentPredicate = (typeof IRA_INHERENT_PREDICATES)[number];

export const IRA_KPMR_PREDICATES = [
  "UNSATISFACTORY",
  "MARGINAL",
  "FAIR",
  "SATISFACTORY",
  "STRONG",
] as const;
export type IraKpmrPredicate = (typeof IRA_KPMR_PREDICATES)[number];

/**
 * Anchor predikat, dicari dengan **nilai terbesar yang tidak melebihi** (`VLOOKUP(..., TRUE)`).
 * Jaraknya sengaja tidak rata — 3,75 dan 4,5 memang begitu di berkasnya.
 */
export const IRA_PREDICATE_ANCHORS: readonly {
  minimum: string;
  inherent: IraInherentPredicate;
  kpmr: IraKpmrPredicate;
}[] = [
  { minimum: "1", inherent: "TINGGI", kpmr: "UNSATISFACTORY" },
  { minimum: "2", inherent: "MENENGAH_KE_TINGGI", kpmr: "MARGINAL" },
  { minimum: "3", inherent: "MENENGAH", kpmr: "FAIR" },
  { minimum: "3.75", inherent: "RENDAH_KE_MENENGAH", kpmr: "SATISFACTORY" },
  { minimum: "4.5", inherent: "RENDAH", kpmr: "STRONG" },
];

/**
 * Matriks nilai akhir lembar `Matriks & Penilaian`: baris predikat inheren × kolom predikat KPMR.
 * Nilainya 1–5 pada skala yang sama terbaliknya.
 */
export const IRA_FINAL_VALUE_MATRIX: Record<IraInherentPredicate, Record<IraKpmrPredicate, number>> = {
  TINGGI: { UNSATISFACTORY: 1, MARGINAL: 1, FAIR: 2, SATISFACTORY: 3, STRONG: 3 },
  MENENGAH_KE_TINGGI: { UNSATISFACTORY: 1, MARGINAL: 2, FAIR: 2, SATISFACTORY: 3, STRONG: 4 },
  MENENGAH: { UNSATISFACTORY: 2, MARGINAL: 2, FAIR: 3, SATISFACTORY: 4, STRONG: 4 },
  RENDAH_KE_MENENGAH: { UNSATISFACTORY: 2, MARGINAL: 3, FAIR: 4, SATISFACTORY: 4, STRONG: 5 },
  RENDAH: { UNSATISFACTORY: 3, MARGINAL: 3, FAIR: 4, SATISFACTORY: 5, STRONG: 5 },
};

/** Batas atas tiap pita, lima buah, menaik, yang teratas `null` — tak berbatas, bukan nol. */
export type IraBandUpperBounds = readonly (string | number | null)[];

const assertBandUpperBounds = (bounds: IraBandUpperBounds) => {
  if (bounds.length !== 5) throw new Error(`Batas pita harus lima buah, bukan ${bounds.length}.`);
  if (bounds.at(-1) !== null) throw new Error("Pita teratas harus tak berbatas atas (null).");
  let previous: Decimal | null = null;
  for (const bound of bounds.slice(0, -1)) {
    if (bound === null) throw new Error("Hanya pita teratas yang boleh tak berbatas atas.");
    const value = new Decimal(bound);
    if (!value.isFinite()) throw new Error(`Batas pita tidak sah: ${bound}`);
    if (previous !== null && value.lessThanOrEqualTo(previous)) {
      throw new Error(`Batas pita harus menaik; ${bound} tidak lebih besar daripada ${previous.toString()}.`);
    }
    previous = value;
  }
};

/**
 * Nilai sebuah parameter persentase menurut pitanya.
 *
 * Batasnya **inklusif**: tepat 20% masih pita pertama, sehingga nilai tepat pada batas selalu jatuh
 * ke pita yang lebih **rendah risikonya**. Itu juga yang membuat pita sempit `tidak ada / >0-1 / …`
 * bekerja dengan batas yang sama: 0 masuk pita pertama, 0,5 masuk pita kedua.
 *
 * Persentase negatif atau bukan angka **dilempar**, tidak didiamkan menjadi pita teraman — angka
 * rusak yang menghasilkan skor 5 adalah kesalahan yang paling sulit terlihat di laporan.
 */
export function scoreFromPercentageBand(
  percentage: Decimal.Value,
  upperBounds: IraBandUpperBounds = IRA_DEFAULT_BAND_UPPER_BOUNDS,
): number {
  assertBandUpperBounds(upperBounds);
  let value: Decimal;
  try {
    value = new Decimal(percentage);
  } catch {
    throw new Error(`Persentase tidak sah: ${String(percentage)}`);
  }
  if (!value.isFinite() || value.isNegative()) throw new Error(`Persentase tidak sah: ${String(percentage)}`);
  for (const [index, bound] of upperBounds.entries()) {
    if (bound === null || value.lessThanOrEqualTo(bound)) return scoreFromBand(index + 1);
  }
  return scoreFromBand(upperBounds.length);
}

/**
 * Nilai parameter berpita kehadiran (`ada` / `tidak ada`).
 *
 * **Ada berarti risiko tinggi**, yaitu 1 pada skala terbalik; tidak ada berarti 5.
 */
export function scoreFromPresence(present: boolean): number {
  return present ? scoreFromBand(5) : scoreFromBand(1);
}

/** Satu parameter di dalam sebuah kelompok: bobotnya dan nilainya (1–5). */
export type IraWeightedParameter = { weight: Decimal.Value; score: Decimal.Value };

/**
 * Nilai satu kelompok: `bobotKelompok × Σ(bobotParameter × nilaiParameter)` (mis. `A1!L6`).
 *
 * Bobot parameter di dalam kelompoknya wajib berjumlah 1. Kelompok yang bobotnya tidak genap
 * menghasilkan nilai jenis risiko yang diam-diam terlalu rendah atau terlalu tinggi, dan tidak ada
 * satu pun angka di layar yang akan memperlihatkannya.
 */
export function weightedGroupScore(groupWeight: Decimal.Value, parameters: IraWeightedParameter[]): Decimal {
  if (parameters.length === 0) throw new Error("Kelompok tanpa satu pun parameter tidak dapat dinilai.");
  let weightTotal = new Decimal(0);
  let weighted = new Decimal(0);
  for (const parameter of parameters) {
    const weight = new Decimal(parameter.weight);
    const score = new Decimal(parameter.score);
    if (!weight.isFinite() || weight.isNegative()) throw new Error(`Bobot parameter tidak sah: ${String(parameter.weight)}`);
    if (!score.isFinite() || score.lessThan(1) || score.greaterThan(5)) {
      throw new Error(`Nilai parameter harus 1 sampai 5, bukan ${String(parameter.score)}.`);
    }
    weightTotal = weightTotal.plus(weight);
    weighted = weighted.plus(weight.times(score));
  }
  if (!weightTotal.equals(1)) {
    throw new Error(`Bobot parameter dalam satu kelompok harus berjumlah 1, bukan ${weightTotal.toString()}.`);
  }
  return new Decimal(groupWeight).times(weighted);
}

/** Nilai satu jenis risiko: jumlah nilai kelompoknya (`A1!E58 = SUM(L6,L9,L13,L19)`). */
export function riskTypeScore(groupScores: Decimal.Value[]): Decimal {
  if (groupScores.length === 0) throw new Error("Jenis risiko tanpa satu pun kelompok tidak dapat dinilai.");
  return groupScores.reduce<Decimal>((total, score) => total.plus(new Decimal(score)), new Decimal(0));
}

/**
 * Nilai risiko inheren: `Σ(bobotJenis × nilaiJenis)` (`A1!F62 = SUM(F58:F61)`).
 *
 * Masukannya nilai kelompok yang **sudah berbobot kelompok** (keluaran `weightedGroupScore`).
 * Keempat jenis risiko wajib ada; yang tidak dikirim **dilempar**, tidak diperlakukan sebagai nol —
 * jenis risiko yang hilang menurunkan nilai inheren tanpa jejak dan membuat lembaganya tampak lebih
 * berisiko daripada keadaannya, atau sebaliknya.
 */
export function inherentTotalScore(groupScoresByRiskType: Record<IraParameterRiskType, Decimal.Value[]>): Decimal {
  let total = new Decimal(0);
  for (const [riskType, weight] of Object.entries(IRA_RISK_TYPE_WEIGHTS) as [IraParameterRiskType, string][]) {
    const groupScores = groupScoresByRiskType[riskType];
    if (!groupScores) throw new Error(`Nilai kelompok jenis risiko ${riskType} tidak dikirim.`);
    total = total.plus(new Decimal(weight).times(riskTypeScore(groupScores)));
  }
  return total;
}

/** Anchor terbesar yang tidak melebihi nilainya, seperti `VLOOKUP(..., TRUE)`. */
const predicateAnchor = (value: Decimal.Value) => {
  const score = new Decimal(value);
  if (!score.isFinite()) throw new Error(`Nilai penilaian tidak sah: ${String(value)}`);
  let matched = IRA_PREDICATE_ANCHORS[0];
  for (const anchor of IRA_PREDICATE_ANCHORS) {
    if (score.greaterThanOrEqualTo(anchor.minimum)) matched = anchor;
  }
  return matched;
};

/**
 * Predikat risiko inheren. Nilai di bawah 1 tidak mungkin muncul dari rumusnya — bila tetap muncul
 * ia dibaca sebagai `TINGGI`, bukan dilempar, agar penilaian yang datanya cacat tetap terlihat
 * sebagai risiko tertinggi dan bukan menghilang.
 */
export function riskPredicate(value: Decimal.Value): IraInherentPredicate {
  return predicateAnchor(value).inherent;
}

/** Predikat KPMR, memakai anchor yang sama persis dengan predikat inheren. */
export function kpmrPredicate(value: Decimal.Value): IraKpmrPredicate {
  return predicateAnchor(value).kpmr;
}

/** Jawaban satu pertanyaan KPMR: 1–5, atau `null` untuk N/A (tidak berlaku bagi KUPVA BB). */
export type IraKpmrAnswer = number | null;

/**
 * Rata-rata satu pilar: `Σ jawaban / banyaknya jawaban bukan N/A` (`B!K12 = SUM/COUNTA`).
 *
 * N/A **dikecualikan dari penyebut**, tidak dihitung sebagai nol — pertanyaan yang tidak berlaku
 * bagi KUPVA BB tidak boleh menurunkan nilai pilarnya. Pilar yang seluruhnya N/A mengembalikan
 * `null`, bukan `NaN` maupun 0.
 */
export function kpmrPillarAverage(answers: IraKpmrAnswer[]): Decimal | null {
  let total = new Decimal(0);
  let answered = 0;
  for (const answer of answers) {
    if (answer === null) continue;
    if (!Number.isInteger(answer) || answer < 1 || answer > 5) {
      throw new Error(`Jawaban KPMR harus 1 sampai 5 atau N/A, bukan ${String(answer)}.`);
    }
    total = total.plus(answer);
    answered += 1;
  }
  if (answered === 0) return null;
  return total.dividedBy(answered);
}

/**
 * Nilai KPMR: **rata-rata sederhana** kelima rata-rata pilar (`B!K46 = AVERAGE`).
 *
 * Bobot pilar 30/25/25/10/10 pada lembar `Rekap` sengaja **tidak** dipakai — lihat
 * `IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY` dan spec Rancangan 4.1. Bila kelak BI menuntut rata-rata
 * berbobot, uji "rata-rata SEDERHANA" pada berkas uji berkas ini yang harus diubah lebih dulu,
 * dengan sadar.
 *
 * Pilar tanpa satu pun jawaban (`null`) dikecualikan, sama seperti `AVERAGE` melewati sel kosong.
 */
export function kpmrScore(pillarAverages: (Decimal | null)[]): Decimal | null {
  const scored = pillarAverages.filter((average): average is Decimal => average !== null);
  if (scored.length === 0) return null;
  return scored.reduce<Decimal>((total, average) => total.plus(average), new Decimal(0)).dividedBy(scored.length);
}

/** Nilai akhir dari matriks: baris predikat inheren, kolom predikat KPMR. */
export function finalAssessmentValue(inherent: IraInherentPredicate, kpmr: IraKpmrPredicate): number {
  const row = IRA_FINAL_VALUE_MATRIX[inherent];
  if (!row) throw new Error(`Predikat inheren tidak dikenal: ${inherent}`);
  const value = row[kpmr];
  if (value === undefined) throw new Error(`Predikat KPMR tidak dikenal: ${kpmr}`);
  return value;
}

/** Predikat akhir dari nilai akhir, memakai anchor yang sama (`VLOOKUP(..., TRUE)`). */
export function finalPredicate(value: Decimal.Value): IraInherentPredicate {
  return riskPredicate(value);
}
