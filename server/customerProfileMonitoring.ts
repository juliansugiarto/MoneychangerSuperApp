import Decimal from "decimal.js";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { ACCUMULATED_TRANSACTION_STATUSES, auditLogs, currencies, customerProfileReviews, customers, exchangeTransactionLines, exchangeTransactions, profileReviewOutcomes } from "../drizzle/schema";
import { startOfNextOperationalMonth, startOfOperationalMonth } from "../shared/regulatoryActionQueue";
import {
  assessProfileDeviation,
  isProfileReviewDue,
  profileReviewIntervalMonths,
  type CustomerRiskLevel,
  type ProfileDeviationReason,
} from "../shared/transactionProfile";
import { databaseOrThrow, writeAudit } from "./operations";

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
 * Bukan salinan: ini daftar yang **sama** dengan yang dipakai akumulasi harian dan bulanan pada
 * jalur transaksi, diambil dari `drizzle/schema.ts`. Dua definisi "aktivitas sebulan" yang berbeda
 * pendapat adalah kekeliruan yang tidak terlihat dari layar mana pun.
 */
export const MONITORED_ACTIVITY_STATUSES = ACCUMULATED_TRANSACTION_STATUSES;

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

/** Nasabah sebagaimana dibutuhkan worklist; sengaja sesempit itu agar mudah diuji tanpa basis data. */
export type MonitoringCustomer = {
  id: number;
  cifNumber: string;
  fullName: string;
  riskLevel: CustomerRiskLevel;
  declaredMonthlyValueIdr: string | null;
  declaredMonthlyCount: number | null;
  declaredCurrencies: string[] | null;
};

export type LastProfileReview = { customerId: number; reviewedAt: Date; outcome: string };

export type MonitoringWorklistRow = {
  customerId: number;
  cifNumber: string;
  fullName: string;
  riskLevel: CustomerRiskLevel;
  intervalMonths: number;
  lastReviewedAt: Date | null;
  lastOutcome: string | null;
  neverReviewed: boolean;
  declaration: { declaredMonthlyValueIdr: string | null; declaredMonthlyCount: number | null; declaredCurrencies: string[] | null };
  activity: CustomerMonthlyActivity;
  reasons: ProfileDeviationReason[];
  hasDeviation: boolean;
  undeclaredCurrencies: string[];
  valueThresholdIdr: number | null;
  countThreshold: number | null;
};

/** Nasabah yang tidak bertransaksi bulan ini tetap dinilai — aktivitasnya nol, bukan tidak ada. */
const emptyActivity = (customerId: number): CustomerMonthlyActivity => ({ customerId, totalValueIdr: "0.00", transactionCount: 0, currencyCodes: [] });

/**
 * Menyusun worklist dari bahan yang sudah dibaca. Murni.
 *
 * Hanya nasabah yang **jatuh tempo ditinjau** yang muncul; iramanya mengikuti risiko, dan nasabah
 * yang belum pernah ditinjau selalu jatuh tempo. Penyimpangan tidak memajukan jadwal: nasabah yang
 * baru saja ditinjau tidak muncul lagi sampai iramanya jatuh tempo berikutnya, sebab peninjauannya
 * memang baru saja dilakukan seseorang.
 *
 * Urutannya: yang menyimpang lebih dulu, lalu yang paling lama tidak ditinjau — nasabah yang belum
 * pernah ditinjau dianggap paling lama.
 */
export function buildMonitoringWorklist(input: {
  customers: MonitoringCustomer[];
  lastReviews: Map<number, LastProfileReview>;
  activity: Map<number, CustomerMonthlyActivity>;
  asOf: Date;
}): MonitoringWorklistRow[] {
  const rows: MonitoringWorklistRow[] = [];

  for (const customer of input.customers) {
    const lastReview = input.lastReviews.get(customer.id) ?? null;
    if (!isProfileReviewDue(lastReview?.reviewedAt ?? null, customer.riskLevel, input.asOf)) continue;

    const activity = input.activity.get(customer.id) ?? emptyActivity(customer.id);
    const declaration = {
      declaredMonthlyValueIdr: customer.declaredMonthlyValueIdr,
      declaredMonthlyCount: customer.declaredMonthlyCount,
      declaredCurrencies: customer.declaredCurrencies,
    };
    const assessment = assessProfileDeviation(declaration, activity);

    rows.push({
      customerId: customer.id,
      cifNumber: customer.cifNumber,
      fullName: customer.fullName,
      riskLevel: customer.riskLevel,
      intervalMonths: profileReviewIntervalMonths(customer.riskLevel),
      lastReviewedAt: lastReview?.reviewedAt ?? null,
      lastOutcome: lastReview?.outcome ?? null,
      neverReviewed: !lastReview,
      declaration,
      activity,
      reasons: assessment.reasons,
      hasDeviation: assessment.hasDeviation,
      undeclaredCurrencies: assessment.undeclaredCurrencies,
      valueThresholdIdr: assessment.valueThresholdIdr,
      countThreshold: assessment.countThreshold,
    });
  }

  return rows.sort((a, b) => {
    if (a.hasDeviation !== b.hasDeviation) return a.hasDeviation ? -1 : 1;
    const aReviewed = a.lastReviewedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const bReviewed = b.lastReviewedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (aReviewed !== bReviewed) return aReviewed - bReviewed;
    return a.customerId - b.customerId;
  });
}

/**
 * Worklist pemantauan pada `asOf`: nasabah yang jatuh tempo ditinjau beserta penilaiannya.
 *
 * **Hanya membaca.** Tidak menyentuh `customers`, tidak menyentuh transaksi, tidak membuat paket
 * regulator — dan itu diuji, bukan sekadar dijanjikan komentar ini.
 */
export async function listCustomerProfileMonitoring(input: { asOf?: Date } = {}): Promise<MonitoringWorklistRow[]> {
  const asOf = input.asOf ?? new Date();
  const db = await databaseOrThrow();

  const customerRows = await db
    .select({
      id: customers.id,
      cifNumber: customers.cifNumber,
      fullName: customers.fullName,
      riskLevel: customers.riskLevel,
      declaredMonthlyValueIdr: customers.declaredMonthlyValueIdr,
      declaredMonthlyCount: customers.declaredMonthlyCount,
      declaredCurrencies: customers.declaredCurrencies,
    })
    .from(customers)
    .where(and(eq(customers.isDemo, false), eq(customers.isHistorical, false)));

  // Peninjauan terakhir per nasabah: baris terbaru menurut reviewedAt, dipakai untuk irama jatuh tempo.
  const reviewRows = await db
    .select({
      customerId: customerProfileReviews.customerId,
      reviewedAt: customerProfileReviews.reviewedAt,
      outcome: customerProfileReviews.outcome,
    })
    .from(customerProfileReviews)
    .orderBy(customerProfileReviews.customerId, customerProfileReviews.reviewedAt);

  const lastReviews = new Map<number, LastProfileReview>();
  for (const row of reviewRows) {
    const previous = lastReviews.get(row.customerId);
    if (!previous || row.reviewedAt.getTime() >= previous.reviewedAt.getTime()) {
      lastReviews.set(row.customerId, { customerId: row.customerId, reviewedAt: row.reviewedAt, outcome: row.outcome });
    }
  }

  return buildMonitoringWorklist({
    customers: customerRows as MonitoringCustomer[],
    lastReviews,
    activity: await readMonthlyCustomerActivity(asOf),
    asOf,
  });
}

export type ProfileReviewOutcome = (typeof profileReviewOutcomes)[number];

/**
 * Mencatat satu peninjauan profil nasabah. **Satu-satunya tulisan paket ini.**
 *
 * Yang ditulisnya hanya satu baris `customer_profile_reviews` beserta jejak auditnya. `customers`
 * tidak tersentuh: peninjauan adalah catatan tentang nasabah, bukan perubahan atas nasabah, dan
 * keputusan pengguna 7 September 2026 menegaskan pemantauan ini hanya mencatat.
 *
 * Dua hal sengaja **tidak** diambil dari pemanggil:
 *
 * - `deviationReasons` dinilai ulang di sini dari deklarasi dan aktivitas nyata, lalu dibekukan apa
 *   adanya pada barisnya. Membekukan angka yang dikirim klien berarti mempercayai layar; menghitung
 *   ulang saat dibaca berarti mengubah isi catatan yang sudah ditandatangani seseorang. Yang benar
 *   adalah menilai sekali, di server, pada saat peninjauannya dicatat.
 * - `reviewedAt` adalah waktu pencatatannya, bukan tanggal yang boleh diketik. Tanggal mundur akan
 *   menggeser jatuh tempo berikutnya tanpa siapa pun melihatnya.
 */
export async function recordCustomerProfileReview(
  input: { customerId: number; outcome: ProfileReviewOutcome; notes?: string },
  actor: { id: number },
) {
  const notes = input.notes?.trim() || null;
  // Hasil selain "tidak ada perubahan" tanpa keterangan tidak dapat ditindaklanjuti siapa pun,
  // dan pada berkas pemeriksaan hanya akan terbaca sebagai peninjauan yang tidak selesai.
  if (input.outcome !== "TIDAK_ADA_PERUBAHAN" && !notes) {
    throw new Error("Jelaskan perubahan atau tindak lanjut yang ditemukan pada peninjauan ini.");
  }

  const db = await databaseOrThrow();
  const [customer] = await db
    .select({
      id: customers.id,
      cifNumber: customers.cifNumber,
      declaredMonthlyValueIdr: customers.declaredMonthlyValueIdr,
      declaredMonthlyCount: customers.declaredMonthlyCount,
      declaredCurrencies: customers.declaredCurrencies,
    })
    .from(customers)
    .where(and(eq(customers.id, input.customerId), eq(customers.isDemo, false), eq(customers.isHistorical, false)))
    .limit(1);
  if (!customer) throw new Error("Nasabah tidak ditemukan.");

  const reviewedAt = new Date();
  const activity = (await readMonthlyCustomerActivity(reviewedAt)).get(input.customerId)
    ?? { customerId: input.customerId, totalValueIdr: "0.00", transactionCount: 0, currencyCodes: [] };
  const assessment = assessProfileDeviation(
    {
      declaredMonthlyValueIdr: customer.declaredMonthlyValueIdr,
      declaredMonthlyCount: customer.declaredMonthlyCount,
      declaredCurrencies: customer.declaredCurrencies as string[] | null,
    },
    activity,
  );

  const [review] = await db.insert(customerProfileReviews).values({
    customerId: input.customerId,
    reviewedAt,
    outcome: input.outcome,
    notes,
    deviationReasons: assessment.reasons,
    reviewedByUserId: actor.id,
  }).$returningId();

  await writeAudit({
    actorUserId: actor.id,
    action: "CUSTOMER_PROFILE_REVIEWED",
    entityType: "customer_profile_reviews",
    entityId: String(review.id),
    afterState: {
      customerId: input.customerId,
      reviewedAt,
      outcome: input.outcome,
      deviationReasons: assessment.reasons,
    },
  });

  return review;
}

/** Riwayat peninjauan seorang nasabah, terbaru lebih dulu. */
export async function listCustomerProfileReviews(customerId: number) {
  const db = await databaseOrThrow();
  return db
    .select()
    .from(customerProfileReviews)
    .where(eq(customerProfileReviews.customerId, customerId))
    .orderBy(desc(customerProfileReviews.reviewedAt));
}
