import Decimal from "decimal.js";

/** Kode alasan tinjauan; ditambahkan ke `reviewReason` lewat daftar alasan yang sudah ada di `assessTransactionRisk`. */
export const RATE_DEVIATION_REVIEW_REASON = "SELISIH_KURS_MELEBIHI_TOLERANSI";
export const DEFAULT_RATE_DEVIATION_TOLERANCE_PERCENT = "0.5000";

export type DeviationRow = { currencyCode: string; denominationValue: string; agreedRate: string; referenceRate: string; deviationPercent: string };

/** |harga − rujukan| / rujukan × 100, empat desimal. Null berarti tidak ada rujukan — bukan nol. */
export function rateDeviationPercent(agreedRate: string, referenceRate: string | null): string | null {
  if (!referenceRate) return null;
  const reference = new Decimal(referenceRate);
  if (!reference.gt(0)) return null;
  return new Decimal(agreedRate).minus(reference).abs().div(reference).times(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

/** Toleransi berlaku dua arah — lebih mahal maupun lebih murah. Asimetri ditunda sampai ada kebutuhan (spec §B3). */
export function exceedsTolerance(deviationPercent: string | null, tolerancePercent: string): boolean {
  if (deviationPercent === null) return false;
  return new Decimal(deviationPercent).gt(new Decimal(tolerancePercent));
}

const idr = (value: string) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value));
const percent = (value: string) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Number(value));
const faceValue = (value: string) => new Decimal(value).toDecimalPlaces(2).toString();

/** Pesan galat menyebut apa yang terjadi **dan** langkah berikutnya — panduan bahasa sub-proyek 1. */
export function deviationRejectionMessage(rows: readonly DeviationRow[], tolerancePercent: string): string {
  const sentences = rows.map((row) =>
    `Harga ${row.currencyCode} ${faceValue(row.denominationValue)} berbeda ${percent(row.deviationPercent)}% dari kurs papan ${idr(row.referenceRate)} (batas ±${percent(tolerancePercent)}%).`);
  return `${sentences.join(" ")} Isi alasan selisih harga atau pakai kurs papan.`;
}
