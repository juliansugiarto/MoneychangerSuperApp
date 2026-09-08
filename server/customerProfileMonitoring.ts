import Decimal from "decimal.js";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { currencies, customers, exchangeTransactionLines, exchangeTransactions } from "../drizzle/schema";
import { startOfNextOperationalMonth, startOfOperationalMonth } from "../shared/regulatoryActionQueue";
import { databaseOrThrow } from "./operations";

/**
 * Pemantauan berkala profil transaksi nasabah — jendela bulanan dan pembacaan aktivitas nyata.
 *
 * Modul ini **hanya membaca**. Satu-satunya tulisan paket ini adalah baris
 * `customer_profile_reviews`, dan `customers` tidak pernah disentuh dari jalur pemantauan.
 */

/**
 * Jendela satu bulan operasional (WIB) sebagai sepasang instan: `start` inklusif, `end` eksklusif.
 *
 * Diturunkan dari `startOfOperationalMonth`/`startOfNextOperationalMonth` pada
 * `shared/regulatoryActionQueue.ts` — helper yang sama dengan yang dipakai akumulasi bulanan pada
 * jalur transaksi. Sengaja **tidak** menulis penurunan keempat: pola lama `new Date(y, m, 1)`
 * membaca jam lokal proses dan memundurkan bulannya satu langkah pada zona waktu negatif, dan tiga
 * salinan pola itulah yang menyebabkan kekeliruan yang baru diperbaiki 7 September 2026.
 */
export function operationalMonthWindow(asOf: Date): { start: Date; end: Date } {
  return { start: startOfOperationalMonth(asOf), end: startOfNextOperationalMonth(asOf) };
}

/**
 * Status transaksi yang ikut dihitung sebagai aktivitas.
 *
 * Sama persis dengan akumulasi bulanan pada jalur transaksi (`server/operations.ts`): transaksi
 * batal tidak menambah akumulasi, sisanya dihitung meski belum selesai. Dua definisi "aktivitas
 * sebulan" yang berbeda pendapat adalah kekeliruan yang tidak terlihat dari layar mana pun, jadi
 * daftar ini dikunci oleh uji — bila jalur transaksi berubah, ubah keduanya bersamaan.
 */
export const MONITORED_ACTIVITY_STATUSES = ["DRAFT", "PENDING_REVIEW", "APPROVED", "RETURNED", "COMPLETED"] as const;

/** Satu baris hasil query: satu transaksi, satu mata uang. Bon berbaris banyak menghasilkan beberapa baris. */
export type MonthlyActivityRow = {
  customerId: number;
  transactionId: number;
  rupiahAmount: string;
  currencyCode: string | null;
};

export type CustomerMonthlyActivity = {
  customerId: number;
  totalValueIdr: string;
  transactionCount: number;
  currencyCodes: string[];
};

/**
 * Melipat baris hasil query menjadi aktivitas sebulan per nasabah. Murni.
 *
 * Nilai dan banyaknya transaksi dihitung **per transaksi**, bukan per baris: `rupiahAmount` pada bon
 * berbaris banyak adalah nilai bonnya, bukan nilai barisnya, sehingga menjumlahkan baris apa adanya
 * akan menghitung bon yang sama berkali-kali dan menyalakan bendera nilai yang tidak pernah terjadi.
 * Mata uangnya justru dikumpulkan dari seluruh baris — di situlah letak gunanya.
 */
export function foldMonthlyActivity(rows: MonthlyActivityRow[]): Map<number, CustomerMonthlyActivity> {
  const totals = new Map<number, { total: Decimal; transactions: Set<number>; currencies: Set<string> }>();

  for (const row of rows) {
    let entry = totals.get(row.customerId);
    if (!entry) {
      entry = { total: new Decimal(0), transactions: new Set(), currencies: new Set() };
      totals.set(row.customerId, entry);
    }
    if (!entry.transactions.has(row.transactionId)) {
      entry.transactions.add(row.transactionId);
      entry.total = entry.total.plus(new Decimal(row.rupiahAmount));
    }
    const code = row.currencyCode?.trim().toUpperCase();
    if (code) entry.currencies.add(code);
  }

  return new Map(
    [...totals].map(([customerId, entry]) => [customerId, {
      customerId,
      totalValueIdr: entry.total.toFixed(2),
      transactionCount: entry.transactions.size,
      currencyCodes: [...entry.currencies].sort(),
    }]),
  );
}

/**
 * Aktivitas nyata setiap nasabah pada bulan operasional yang memuat `asOf`.
 *
 * Mata uangnya diambil dari dua tempat sekaligus: kolom `currencyId` pada bon lama bermata uang
 * tunggal, dan `exchange_transaction_lines` pada bon berbaris banyak yang kolom itu kosong.
 * Membaca salah satunya saja akan membuat mata uang tak terdeklarasi pada bon berbaris banyak
 * tidak pernah terlihat.
 *
 * Nasabah `isDemo`/`isHistorical` tidak ikut: yang pertama data latihan, yang kedua lawan transaksi
 * pembukuan lama yang tidak pernah dipakai transaksi hidup.
 *
 * Batasnya berupa instan absolut, dan itu benar: kolom `datetime` seperti `transactionAt` disimpan
 * Drizzle sebagai jam **UTC** (dibuktikan round-trip 8 September 2026 pada mesin WIB — instan
 * 19:00 UTC tersimpan `19:00:00` dan terbaca kembali sebagai instan yang sama), berbeda dari kolom
 * `date` yang diformat mysql2 memakai zona proses. Jangan "memperbaiki" batas ini seperti batas
 * kolom `date`; keduanya akan justru menggeser jendelanya.
 */
export async function readMonthlyCustomerActivity(asOf: Date): Promise<Map<number, CustomerMonthlyActivity>> {
  const { start, end } = operationalMonthWindow(asOf);
  const db = await databaseOrThrow();

  const legacyCurrencies = db
    .select({
      customerId: exchangeTransactions.customerId,
      transactionId: exchangeTransactions.id,
      rupiahAmount: exchangeTransactions.rupiahAmount,
      currencyCode: currencies.code,
    })
    .from(exchangeTransactions)
    .innerJoin(customers, eq(exchangeTransactions.customerId, customers.id))
    .leftJoin(currencies, eq(exchangeTransactions.currencyId, currencies.id))
    .where(and(
      gte(exchangeTransactions.transactionAt, start),
      lt(exchangeTransactions.transactionAt, end),
      inArray(exchangeTransactions.status, [...MONITORED_ACTIVITY_STATUSES]),
      eq(exchangeTransactions.isDemo, false),
      eq(exchangeTransactions.isHistorical, false),
      eq(customers.isDemo, false),
      eq(customers.isHistorical, false),
    ));

  const lineCurrencies = db
    .select({
      customerId: exchangeTransactions.customerId,
      transactionId: exchangeTransactions.id,
      rupiahAmount: exchangeTransactions.rupiahAmount,
      currencyCode: currencies.code,
    })
    .from(exchangeTransactions)
    .innerJoin(customers, eq(exchangeTransactions.customerId, customers.id))
    .innerJoin(exchangeTransactionLines, eq(exchangeTransactionLines.transactionId, exchangeTransactions.id))
    .innerJoin(currencies, eq(exchangeTransactionLines.currencyId, currencies.id))
    .where(and(
      gte(exchangeTransactions.transactionAt, start),
      lt(exchangeTransactions.transactionAt, end),
      inArray(exchangeTransactions.status, [...MONITORED_ACTIVITY_STATUSES]),
      eq(exchangeTransactions.isDemo, false),
      eq(exchangeTransactions.isHistorical, false),
      eq(customers.isDemo, false),
      eq(customers.isHistorical, false),
    ));

  const [legacyRows, lineRows] = await Promise.all([legacyCurrencies, lineCurrencies]);
  return foldMonthlyActivity([...legacyRows, ...lineRows]);
}
