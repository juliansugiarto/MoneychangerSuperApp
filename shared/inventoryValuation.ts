/**
 * Penilaian persediaan valuta pada kurs penutup.
 *
 * Ditaruh di `shared/` supaya panel penutupan menampilkan angka yang **sama persis** dengan yang
 * dijurnal server — nilai persediaan yang berbeda antara layar dan buku besar adalah pertanyaan
 * pertama yang akan diajukan pemeriksa.
 *
 * Fungsi murni: tanpa basis data, tanpa tanggal, tanpa pemilihan snapshot. Yang memilih snapshot
 * mana yang dipakai adalah `server/periodClosing.ts`; di sini hanya aritmetikanya.
 */

import Decimal from "decimal.js";

export type ClosingRateSnapshot = { buyRate: string; sellRate: string; quoteUnit: string };

/** Kurs tengah disimpan lebih rinci daripada kurs sumbernya supaya nilainya dapat dihitung ulang. */
export const MID_RATE_SCALE = 12;

/**
 * `new Decimal("")` melempar galat pustaka yang tidak menyebut kolom mana yang salah. Konstruksinya
 * dibungkus supaya pesan yang sampai ke pengguna menunjuk kursnya sendiri.
 */
const decimalOrThrow = (raw: string, label: string) => {
  let value: Decimal;
  try {
    value = new Decimal(raw);
  } catch {
    throw new Error(`${label} bukan angka yang sah.`);
  }
  if (!value.isFinite()) throw new Error(`${label} bukan angka yang sah.`);
  return value;
};

/**
 * Kurs tengah BI per **satu** unit valuta.
 *
 * Keputusan pengguna 4 September 2026: (beli + jual) / 2, bukan kurs beli maupun kurs jual.
 * Pembagian dengan `quoteUnit` tidak boleh dilewati — BI mengutip JPY per 100 unit, dan mengabaikan
 * kolom itu membuat nilai persediaan JPY meleset seratus kali.
 */
export function midClosingRate(snapshot: ClosingRateSnapshot): string {
  const buy = decimalOrThrow(snapshot.buyRate, "Kurs beli");
  const sell = decimalOrThrow(snapshot.sellRate, "Kurs jual");
  const unit = decimalOrThrow(snapshot.quoteUnit, "quoteUnit");
  if (unit.lte(0)) throw new Error("quoteUnit harus lebih besar dari nol.");
  return buy.plus(sell).div(2).div(unit).toFixed(MID_RATE_SCALE);
}

/**
 * Nilai Rupiah persediaan valuta.
 *
 * Pembulatan setengah-ke-atas ke sen disengaja dan tercatat pada spec bagian 7: aturan "menolak
 * membulatkan uang" mengenai konversi uang yang **sudah tercatat**, sedangkan ini pengukuran baru —
 * kuantitas dikali kurs, yang hampir tidak pernah jatuh pas di sen. Selisihnya melebur ke harga
 * pokok.
 */
export function valueForeignInventory(
  input: ClosingRateSnapshot & { quantity: string },
): { midRatePerUnit: string; rupiahValue: string } {
  const quantity = decimalOrThrow(input.quantity, "Kuantitas persediaan");
  if (quantity.lt(0)) throw new Error("Kuantitas persediaan tidak boleh negatif.");
  const midRatePerUnit = midClosingRate(input);
  return {
    midRatePerUnit,
    rupiahValue: quantity.times(midRatePerUnit).toFixed(2, Decimal.ROUND_HALF_UP),
  };
}
