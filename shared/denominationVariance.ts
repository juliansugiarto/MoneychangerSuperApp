/**
 * Pembandingan hitung fisik terhadap catatan sistem, per nilai pecahan.
 *
 * Ditaruh di `shared/` supaya layar dapat menunjukkan selisihnya **sebelum** petugas mengirim,
 * memakai aturan yang sama persis dengan yang dipakai server saat menilai — petugas tidak boleh
 * terkejut oleh status varians yang baru muncul setelah pengiriman.
 *
 * Fungsi murni: tanpa basis data, tanpa Drizzle, tanpa tanggal.
 */

import Decimal from "decimal.js";

export type DenominationCount = { value: string; quantity: number };

export type DenominationVarianceRow = {
  value: string;
  systemQuantity: number;
  physicalQuantity: number;
  difference: number;
};

/**
 * Selisih hitung fisik terhadap catatan sistem, per nilai pecahan.
 *
 * Pecahan yang hanya ada di salah satu sisi diperlakukan sebagai nol di sisi lainnya — pecahan yang
 * ada di tangan petugas tetapi nol di sistem justru selisih yang paling penting ditemukan, dan
 * membuang sisi yang kosong akan menyembunyikannya.
 *
 * Total nilai yang kebetulan sama **bukan** alasan untuk menyatakan cocok: sistem 5×100.000 dan
 * laci 10×50.000 sama-sama Rp 500.000, tetapi komposisi yang meleset berarti ada pergerakan tak
 * tercatat atau tukar pecahan yang tak dibukukan. `hasVariance` sengaja menilai per pecahan, bukan
 * per total.
 */
export function compareDenominationCounts(system: DenominationCount[], physical: DenominationCount[]): {
  rows: DenominationVarianceRow[];
  hasVariance: boolean;
} {
  // Dikunci pada teks bernormalisasi, bukan Number: 100000 dan 100000.000000 adalah pecahan yang
  // sama, dan membandingkannya sebagai teks mentah akan memecahnya menjadi dua baris palsu.
  const normalise = (value: string) => new Decimal(value).toFixed(6);
  const totals = new Map<string, { systemQuantity: number; physicalQuantity: number }>();
  const bump = (entries: DenominationCount[], key: "systemQuantity" | "physicalQuantity") => {
    for (const entry of entries) {
      const value = normalise(entry.value);
      const row = totals.get(value) ?? { systemQuantity: 0, physicalQuantity: 0 };
      row[key] += entry.quantity;
      totals.set(value, row);
    }
  };
  bump(system, "systemQuantity");
  bump(physical, "physicalQuantity");

  const rows = [...totals.entries()]
    .map(([value, row]) => ({ value, ...row, difference: row.physicalQuantity - row.systemQuantity }))
    .sort((a, b) => new Decimal(b.value).comparedTo(new Decimal(a.value)));
  return { rows, hasVariance: rows.some((row) => row.difference !== 0) };
}
