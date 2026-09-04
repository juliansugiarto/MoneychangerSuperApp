/**
 * Penutupan periode: penilaian persediaan valuta akhir periode.
 *
 * Temuan BI 7.1 menyoroti akun 1-1210 Kas UKA dan 5-1300 Persediaan Akhir UKA & TC yang berhenti
 * nol. Bagan akun memakai persediaan periodik, jadi kedua akun itu memang hanya bergerak sekali
 * setiap periode — di sini. Berkas ini menyiapkan **buktinya** lebih dulu: berapa banyak valuta yang
 * benar-benar ada menurut hitungan fisik, dan pada kurs mana ia dinilai.
 *
 * `buildPeriodValuation` tidak menulis apa pun. Panel penutupan memakainya untuk menunjukkan angka
 * beserta penghalangnya sebelum tombol ditekan, dan `postPeriodClosing` memakainya sebagai
 * satu-satunya sumber angka — sehingga yang dilihat pengguna dan yang dijurnal server mustahil
 * berbeda.
 */

import Decimal from "decimal.js";
import { and, desc, eq, gte, isNotNull, lt, lte, ne, sql } from "drizzle-orm";
import {
  accountingPeriods,
  cashBalances,
  currencies,
  periodClosingValuations,
  rateReferenceSnapshots,
  stockOpnames,
} from "../drizzle/schema";
import { valueForeignInventory } from "../shared/inventoryValuation";
import { databaseOrThrow, getOpnameSystemCounts, retryTransientDatabaseRead } from "./operations";

/**
 * Tanggal yang dikirim ke kolom `date`.
 *
 * Tengah malam **waktu lokal**, bukan UTC: mengirim `Date` tengah malam UTC dari mesin WIB
 * membuat batas rentang mundur satu hari dan baris tanggal batas hilang diam-diam. Itu bug paket
 * K1 yang sudah diperbaiki dan tidak boleh kembali.
 */
const dbDate = (value: string) => new Date(`${value}T00:00:00`);

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Hari kalender sebuah kolom `date` sebagai teks "YYYY-MM-DD".
 *
 * Sengaja **tidak** memakai `isoDay`. Driver mysql2 mengembalikan kolom `date` sebagai tengah malam
 * waktu lokal, sehingga `toISOString()` di mesin WIB memundurkannya satu hari — 30 September
 * terbaca 29 September, dan tanggal opname maupun tanggal kurs pada baris penilaian ikut meleset.
 * Membaca komponen lokalnya adalah kebalikan tepat dari `dbDate`, jadi tanggalnya pulang-pergi utuh
 * di zona waktu mana pun.
 */
const calendarDay = (value: Date | string): string =>
  typeof value === "string"
    ? value.slice(0, 10)
    : `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

/** Hitungan fisik yang belum ditinjau bukan bukti; hanya kedua status ini yang boleh dinilai. */
const REVIEWED_OPNAME_STATUSES = new Set(["RECONCILED", "VARIANCE"]);

export type CurrencyValuationRow = {
  currencyId: number;
  currencyCode: string;
  quantity: string;
  stockOpnameId: number;
  /** Tanggal opname yang benar-benar dipakai; boleh lebih awal daripada akhir periode. */
  opnameDate: string;
  rateSnapshotId: number;
  /** Tanggal snapshot BI yang benar-benar dipakai; BI tidak mengumumkan kurs pada hari libur. */
  rateReferenceDate: string;
  buyRate: string;
  sellRate: string;
  quoteUnit: string;
  midRatePerUnit: string;
  rupiahValue: string;
};

export type PeriodValuation = {
  periodId: number;
  periodStart: string;
  periodEnd: string;
  status: "TERBUKA" | "DITUTUP";
  rows: CurrencyValuationRow[];
  blockers: { currencyCode: string; reason: string }[];
  /** Total nilai persediaan akhir periode dinilai sebelumnya — sisi 5-1100 jurnal penutupan. */
  priorClosingValue: string;
  /** Total nilai penutupan periode ini — sisi 5-1300. */
  closingValue: string;
  valuationPostedAt: Date | null;
  /** Benar bila periode ini berakhir 31 Desember. */
  isFiscalYearEnd: boolean;
  profitClosingPostedAt: Date | null;
};

/**
 * Bukti kuantitas dan kurs untuk sebuah periode, beserta apa yang menghalanginya.
 *
 * Mata uang yang tidak dapat dinilai tidak pernah ditebak angkanya: ia keluar sebagai `blockers`
 * dengan alasan yang dapat dibaca manusia, dan penutupan periode akan menolaknya (tugas 6).
 * IDR tidak pernah ikut dinilai — kas Rupiah sudah berada pada 1-1110, dan menilainya lagi pada
 * 1-1210 menghitungnya dua kali sementara neracanya tetap seimbang, sehingga kekeliruannya tidak
 * akan terlihat dari laporan mana pun.
 */
export async function buildPeriodValuation(periodId: number): Promise<PeriodValuation> {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();

    const period = (
      await db
        .select({
          id: accountingPeriods.id,
          periodStart: accountingPeriods.periodStart,
          periodEnd: accountingPeriods.periodEnd,
          status: accountingPeriods.status,
          valuationPostedAt: accountingPeriods.valuationPostedAt,
          profitClosingPostedAt: accountingPeriods.profitClosingPostedAt,
        })
        .from(accountingPeriods)
        .where(eq(accountingPeriods.id, periodId))
        .limit(1)
    )[0];
    if (!period) {
      const error = new Error(`Periode ${periodId} tidak ditemukan.`) as Error & { code?: string };
      error.code = "PERIOD_NOT_FOUND";
      throw error;
    }
    const periodStart = calendarDay(period.periodStart);
    const periodEnd = calendarDay(period.periodEnd);

    const currencyRows = await db
      .select({
        currencyId: currencies.id,
        currencyCode: currencies.code,
        availableAmount: cashBalances.availableAmount,
      })
      .from(currencies)
      .innerJoin(cashBalances, eq(cashBalances.currencyId, currencies.id))
      .where(ne(currencies.code, "IDR"));

    const opnameRows = await db
      .select({
        id: stockOpnames.id,
        currencyId: stockOpnames.currencyId,
        opnameDate: stockOpnames.opnameDate,
        physicalBalance: stockOpnames.physicalBalance,
        reconciliationStatus: stockOpnames.reconciliationStatus,
      })
      .from(stockOpnames)
      .where(
        and(
          eq(stockOpnames.isDemo, false),
          eq(stockOpnames.isHistorical, false),
          gte(stockOpnames.opnameDate, dbDate(periodStart)),
          lte(stockOpnames.opnameDate, dbDate(periodEnd)),
        ),
      )
      .orderBy(desc(stockOpnames.opnameDate));

    const rateRows = await db
      .select({
        id: rateReferenceSnapshots.id,
        currencyId: rateReferenceSnapshots.currencyId,
        referenceDate: rateReferenceSnapshots.referenceDate,
        buyRate: rateReferenceSnapshots.buyRate,
        sellRate: rateReferenceSnapshots.sellRate,
        quoteUnit: rateReferenceSnapshots.quoteUnit,
      })
      .from(rateReferenceSnapshots)
      .where(
        and(
          eq(rateReferenceSnapshots.source, "BI_TRANSACTION_RATES"),
          eq(rateReferenceSnapshots.isDemo, false),
          lte(rateReferenceSnapshots.referenceDate, dbDate(periodEnd)),
        ),
      )
      .orderBy(desc(rateReferenceSnapshots.referenceDate));

    // Kedua kueri sudah urut menurun, jadi baris pertama sebuah mata uang adalah yang terakhir.
    const latestOpname = new Map<number, (typeof opnameRows)[number]>();
    for (const row of opnameRows) if (!latestOpname.has(row.currencyId)) latestOpname.set(row.currencyId, row);
    const latestRate = new Map<number, (typeof rateRows)[number]>();
    for (const row of rateRows) if (!latestRate.has(row.currencyId)) latestRate.set(row.currencyId, row);

    const rows: CurrencyValuationRow[] = [];
    const blockers: { currencyCode: string; reason: string }[] = [];
    // Saringan IDR ditegakkan dua kali — sekali di kueri, sekali di sini. Sengaja: keliru
    // memasukkan IDR menghitung kas Rupiah dua kali sementara neracanya **tetap seimbang**,
    // sehingga tidak ada laporan yang akan memperlihatkannya, dan pengaman yang tidak dapat
    // diuji (predikat SQL) pantas didampingi pengaman yang dapat.
    const ordered = currencyRows
      .filter((currency) => currency.currencyCode !== "IDR")
      .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));

    for (const currency of ordered) {
      const opname = latestOpname.get(currency.currencyId);

      if (!opname) {
        // Mata uang yang stoknya memang kosong tidak menghalangi penutupan: tidak ada yang perlu
        // dihitung, dan menuntut opname atas nol lembar uang hanya melatih orang menekan "kirim".
        const counts = await getOpnameSystemCounts(currency.currencyId);
        const safeIsEmpty = counts.safe.every((entry) => Number(entry.quantity) === 0);
        if (new Decimal(currency.availableAmount).isZero() && safeIsEmpty) continue;
        blockers.push({
          currencyCode: currency.currencyCode,
          reason: `belum ada stock opname yang sudah ditinjau antara ${periodStart} dan ${periodEnd}`,
        });
        continue;
      }

      if (!REVIEWED_OPNAME_STATUSES.has(opname.reconciliationStatus)) {
        blockers.push({
          currencyCode: currency.currencyCode,
          reason: `opname ${calendarDay(opname.opnameDate)} masih berstatus ${opname.reconciliationStatus}; hitungan fisik yang belum ditinjau bukan bukti`,
        });
        continue;
      }
      if (opname.physicalBalance === null) {
        blockers.push({
          currencyCode: currency.currencyCode,
          reason: `opname ${calendarDay(opname.opnameDate)} tidak memuat hitungan fisik`,
        });
        continue;
      }

      const rate = latestRate.get(currency.currencyId);
      if (!rate) {
        blockers.push({
          currencyCode: currency.currencyCode,
          reason: `tidak ada kurs BI sampai ${periodEnd}; sinkronisasi kurs BI harus dijalankan lebih dulu`,
        });
        continue;
      }
      const rateReferenceDate = calendarDay(rate.referenceDate);
      if (rateReferenceDate < periodStart) {
        // Mundur ke hari libur terdekat wajar; mundur ke luar periode berarti sinkronisasinya
        // tertinggal, dan menilai persediaan pada kurs bulan lalu bukan pemunduran, melainkan
        // angka yang salah.
        blockers.push({
          currencyCode: currency.currencyCode,
          reason: `kurs BI terakhir bertanggal ${rateReferenceDate}, sebelum periode dimulai; sinkronisasi kurs BI tertinggal`,
        });
        continue;
      }

      const valued = valueForeignInventory({
        quantity: opname.physicalBalance,
        buyRate: rate.buyRate,
        sellRate: rate.sellRate,
        quoteUnit: rate.quoteUnit,
      });
      rows.push({
        currencyId: currency.currencyId,
        currencyCode: currency.currencyCode,
        quantity: opname.physicalBalance,
        stockOpnameId: opname.id,
        opnameDate: calendarDay(opname.opnameDate),
        rateSnapshotId: rate.id,
        rateReferenceDate,
        buyRate: rate.buyRate,
        sellRate: rate.sellRate,
        quoteUnit: rate.quoteUnit,
        midRatePerUnit: valued.midRatePerUnit,
        rupiahValue: valued.rupiahValue,
      });
    }

    // Persediaan awal periode ini adalah persediaan akhir periode dinilai sebelumnya. Periode yang
    // belum dinilai dilewati: nilainya bukan nol, melainkan belum diketahui, dan memakainya sebagai
    // nol akan menutupi lubang itu dengan angka yang tampak sah.
    const priorPeriod = (
      await db
        .select({ id: accountingPeriods.id })
        .from(accountingPeriods)
        .where(and(lt(accountingPeriods.periodEnd, dbDate(periodStart)), isNotNull(accountingPeriods.valuationPostedAt)))
        .orderBy(desc(accountingPeriods.periodEnd))
        .limit(1)
    )[0];

    let priorClosingValue = "0.00";
    if (priorPeriod) {
      const totals = await db
        .select({ total: sql<string | null>`SUM(${periodClosingValuations.rupiahValue})` })
        .from(periodClosingValuations)
        .where(eq(periodClosingValuations.periodId, priorPeriod.id));
      priorClosingValue = new Decimal(totals[0]?.total ?? "0").toFixed(2);
    }

    const closingValue = rows
      .reduce((total, row) => total.plus(row.rupiahValue), new Decimal(0))
      .toFixed(2);

    return {
      periodId: period.id,
      periodStart,
      periodEnd,
      status: period.status,
      rows,
      blockers,
      priorClosingValue,
      closingValue,
      valuationPostedAt: period.valuationPostedAt,
      isFiscalYearEnd: periodEnd.endsWith("-12-31"),
      profitClosingPostedAt: period.profitClosingPostedAt,
    };
  });
}
