import Decimal from "decimal.js";

/**
 * Pecahan Rupiah terkecil yang dipakai kasir. Total yang tidak habis dibagi angka ini tidak bisa
 * dibayar tunai pas, jadi dibulatkan ke atas (keputusan pemilik 12 November 2026; satuan lain bila
 * pemilik memintanya).
 */
export const RUPIAH_ROUNDING_STEP = 100;

/**
 * Rupiah satu baris pecahan bon: nilai × lembar × kurs ÷ satuan kuotasi, dibulatkan KE ATAS ke
 * kelipatan Rp 100. Dibulatkan per baris, bukan per bon, supaya total baris, total bon, baris LKU,
 * dan rincian pecahan Rupiah yang dihitung kasir selalu menjumlah ke angka yang sama.
 * Dipakai server (penentu) dan layar kasir (pratinjau) agar keduanya tidak pernah berbeda.
 */
export function pricedRowRupiah(value: Decimal.Value, quantity: Decimal.Value, rate: Decimal.Value, quoteUnit: Decimal.Value): Decimal {
  const exact = new Decimal(value).times(quantity).times(rate).div(quoteUnit);
  return exact.div(RUPIAH_ROUNDING_STEP).ceil().times(RUPIAH_ROUNDING_STEP);
}
