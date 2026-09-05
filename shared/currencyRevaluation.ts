/**
 * Retranslasi pos moneter valuta asing.
 *
 * Kurs tengahnya sendiri sudah ada — `midClosingRate` di `shared/inventoryValuation.ts`, dipakai
 * penilaian persediaan paket C. Berkas ini sengaja **tidak** menulis rumus keduanya: dua salinan
 * kurs tengah yang dapat berbeda pendapat adalah persis kekeliruan yang tidak terlihat dari laporan
 * mana pun.
 */

import Decimal from "decimal.js";

/**
 * Akun yang membentuk "kas dan setara kas" pada Arus Kas (paket F2).
 *
 * 1-1210 Kas UKA **tidak** termasuk: ia persediaan yang dinilai dari hitungan fisik lewat 5-1300,
 * bukan setara kas. Uang kertas valuta asing yang dipegang untuk dijual kembali adalah barang
 * dagangan; memasukkannya ke kas akan menghitung pergerakan yang sama dua kali.
 */
export const CASH_ACCOUNTS = ["1-1110", "1-1120", "1-1220"] as const;

/**
 * Snapshot kurs terakhir yang **tidak melewati** `on`.
 *
 * BI tidak mengumumkan kurs pada Sabtu, Minggu, dan hari libur, sehingga kurs yang dipakai boleh
 * lebih awal daripada tanggal yang diminta — keadaan sah, dan tanggalnya disimpan supaya
 * pemundurannya tidak pernah terjadi diam-diam. Yang tidak boleh adalah memakai kurs yang belum
 * terbit pada tanggal itu: itu menilai masa lalu dengan angka masa depan.
 *
 * Tanggal dibandingkan sebagai string `YYYY-MM-DD`, yang urutan leksikografisnya sama dengan urutan
 * kronologisnya — dan karena itu kebal terhadap zona waktu, tidak seperti membandingkan `Date`.
 */
export function snapshotOnOrBefore<T extends { referenceDate: string }>(rows: T[], on: string): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (row.referenceDate > on) continue;
    if (!best || row.referenceDate > best.referenceDate) best = row;
  }
  return best;
}

/**
 * `new Decimal("")` melempar galat pustaka yang tidak menyebut medan mana yang salah. Konstruksinya
 * dibungkus supaya pesan yang sampai ke pengguna menunjuk medannya sendiri.
 */
const decimalOrThrow = (raw: string, label: string): Decimal => {
  let value: Decimal;
  try {
    value = new Decimal(raw);
  } catch {
    throw new Error(`${label} "${raw}" bukan angka yang sah.`);
  }
  if (!value.isFinite()) throw new Error(`${label} "${raw}" bukan angka yang sah.`);
  return value;
};

/**
 * Nilai Rupiah sebuah saldo pos moneter.
 *
 * Pembulatan setengah-ke-atas ke sen disengaja dan tercatat pada spec bagian 9: aturan "menolak
 * membulatkan uang" mengenai konversi uang yang **sudah tercatat**, sedangkan ini pengukuran baru —
 * saldo dikali kurs, yang hampir tidak pernah jatuh pas di sen. Preseden dan alasannya sama dengan
 * `valueForeignInventory` pada paket C.
 */
export function valueMonetaryBalance(input: { foreignBalance: string; midRatePerUnit: string }): string {
  const balance = decimalOrThrow(input.foreignBalance, "Saldo valuta");
  const rate = decimalOrThrow(input.midRatePerUnit, "Kurs tengah");
  return balance.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
