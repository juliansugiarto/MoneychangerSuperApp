/**
 * Jadwal penyusutan garis lurus.
 *
 * Ditaruh di `shared/` supaya panel penyusutan menampilkan angka yang **sama persis** dengan yang
 * dijurnal server — beban yang berbeda antara layar dan buku besar adalah pertanyaan pertama yang
 * akan diajukan pemeriksa.
 *
 * Satu formula melayani aset baru maupun aset warisan. Aset baru hanyalah kasus khusus dengan
 * akumulasi awal nol dan bulan jurnal pertama sama dengan bulan perolehan; tidak ada cabang kedua,
 * dan karena itu tidak ada cabang kedua yang bisa salah sendirian.
 *
 * Pembulatan dilakukan pada **kumulatif**, bukan pada beban bulanan. Membulatkan
 * `dasar / sisaBulan` lalu menumpuknya meleset sampai beberapa rupiah sepanjang 240 bulan, dan
 * sisanya harus ditambal ke bulan terakhir tanpa alasan akuntansi. Selisih kumulatif membuat jumlah
 * seluruh beban **tepat** sama dengan dasar penyusutan, dengan tiap bulan berselisih paling banyak
 * satu sen dari bagian ratanya. Ini satu-satunya tempat pembulatan diizinkan dalam paket E
 * (spec bagian 9).
 */

import Decimal from "decimal.js";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type DepreciationInput = {
  /** Bulan perolehan, "YYYY-MM". Bulan ini disusutkan penuh — aturan DJP, keputusan spec 2. */
  acquisitionMonth: string;
  /** Bulan pertama yang boleh dijurnal sistem; sama dengan `acquisitionMonth` untuk aset baru. */
  firstJournalMonth: string;
  acquisitionCost: string;
  residualValue: string;
  /** NULL berarti tidak disusutkan — tanah. */
  usefulLifeMonths: number | null;
  openingAccumulatedDepreciation: string;
};

export type DepreciationRow = { month: string; charge: string; accumulated: string; carrying: string };

const assertMonth = (value: string) => {
  if (!MONTH_PATTERN.test(value)) throw new Error(`Bulan "${value}" harus berbentuk YYYY-MM.`);
  return value;
};

/**
 * Bulan sebuah tanggal kolom `date`.
 *
 * Memakai bagian tanggal waktu **lokal**, bukan `toISOString()`: mysql2 mengembalikan kolom `date`
 * sebagai tengah malam waktu proses, dan `toISOString()` di mesin WIB memundurkannya satu hari —
 * bug paket K1. Tanggal 1 setiap bulan adalah tepat kasus yang salah bulan bila keliru.
 */
export const monthKey = (value: Date | string): string => {
  if (typeof value === "string") return assertMonth(value.slice(0, 7));
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  return assertMonth(`${year}-${month}`);
};

export const addMonths = (month: string, count: number): string => {
  assertMonth(month);
  const [year, index] = month.split("-").map(Number);
  const total = year * 12 + (index - 1) + count;
  return `${Math.floor(total / 12)}-${`${(total % 12) + 1}`.padStart(2, "0")}`;
};

export const monthsBetween = (from: string, to: string): number => {
  assertMonth(from);
  assertMonth(to);
  const [fromYear, fromIndex] = from.split("-").map(Number);
  const [toYear, toIndex] = to.split("-").map(Number);
  return (toYear * 12 + toIndex) - (fromYear * 12 + fromIndex);
};

const money = (value: string, label: string): Decimal => {
  let parsed: Decimal;
  try {
    parsed = new Decimal(value);
  } catch {
    throw new Error(`${label} "${value}" bukan angka yang sah.`);
  }
  if (!parsed.isFinite()) throw new Error(`${label} "${value}" bukan angka yang sah.`);
  return parsed;
};

/**
 * Dasar dan sisa bulan yang benar-benar dipakai.
 *
 * Dipisahkan supaya `depreciationSchedule` dan `depreciationForMonth` mustahil berbeda pendapat:
 * keduanya menolak masukan yang sama dan menghitung dari angka yang sama. Mengembalikan `null`
 * berarti "sah, tetapi tidak menghasilkan beban apa pun" — tanah, dan aset warisan yang umur
 * manfaatnya sudah habis sebelum buku besar ini dipakai.
 */
function basis(input: DepreciationInput) {
  assertMonth(input.acquisitionMonth);
  assertMonth(input.firstJournalMonth);
  if (monthsBetween(input.acquisitionMonth, input.firstJournalMonth) < 0) {
    throw new Error("Bulan jurnal pertama tidak boleh mendahului bulan perolehan.");
  }

  const cost = money(input.acquisitionCost, "Harga perolehan");
  if (cost.lessThan(0)) throw new Error("Harga perolehan tidak boleh negatif.");
  const residual = money(input.residualValue, "Nilai residu");
  if (residual.lessThan(0)) throw new Error("Nilai residu tidak boleh negatif.");
  if (residual.greaterThan(cost)) throw new Error("Nilai residu tidak boleh melebihi harga perolehan.");

  const opening = money(input.openingAccumulatedDepreciation, "Akumulasi penyusutan awal");
  if (opening.lessThan(0)) throw new Error("Akumulasi penyusutan awal tidak boleh negatif.");
  if (opening.greaterThan(cost.minus(residual))) {
    throw new Error("Akumulasi penyusutan awal melebihi dasar penyusutan; periksa data aset warisan.");
  }

  if (input.usefulLifeMonths === null) return null;
  if (!Number.isInteger(input.usefulLifeMonths) || input.usefulLifeMonths <= 0) {
    throw new Error("Umur manfaat harus bilangan bulat bulan yang lebih besar dari nol.");
  }

  const elapsed = monthsBetween(input.acquisitionMonth, input.firstJournalMonth);
  const remainingMonths = input.usefulLifeMonths - elapsed;
  if (remainingMonths <= 0) return null;

  const remainingBase = cost.minus(residual).minus(opening);
  if (remainingBase.lessThanOrEqualTo(0)) return null;

  return { cost, residual, opening, remainingBase, remainingMonths };
}

const cumulative = (remainingBase: Decimal, remainingMonths: number, n: number): Decimal =>
  remainingBase
    .times(Math.min(Math.max(n, 0), remainingMonths))
    .dividedBy(remainingMonths)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function depreciationSchedule(input: DepreciationInput): DepreciationRow[] {
  const state = basis(input);
  if (!state) return [];

  const rows: DepreciationRow[] = [];
  for (let n = 1; n <= state.remainingMonths; n += 1) {
    const charge = cumulative(state.remainingBase, state.remainingMonths, n)
      .minus(cumulative(state.remainingBase, state.remainingMonths, n - 1));
    const accumulated = state.opening.plus(cumulative(state.remainingBase, state.remainingMonths, n));
    rows.push({
      month: addMonths(input.firstJournalMonth, n - 1),
      charge: charge.toFixed(2),
      accumulated: accumulated.toFixed(2),
      carrying: state.cost.minus(accumulated).toFixed(2),
    });
  }
  return rows;
}

export function depreciationForMonth(input: DepreciationInput, month: string): string {
  assertMonth(month);
  const state = basis(input);
  if (!state) return "0.00";
  const n = monthsBetween(input.firstJournalMonth, month) + 1;
  if (n < 1 || n > state.remainingMonths) return "0.00";
  return cumulative(state.remainingBase, state.remainingMonths, n)
    .minus(cumulative(state.remainingBase, state.remainingMonths, n - 1))
    .toFixed(2);
}
