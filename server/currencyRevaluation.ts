/**
 * Retranslasi pos moneter valuta asing pada akhir periode.
 *
 * SAK EP Bab 30 menuntut saldo pos moneter dalam valuta asing diukur ulang pada kurs penutup setiap
 * akhir periode, dengan selisihnya ke laba rugi. Ini termasuk hal yang tidak akan pernah dikerjakan
 * orang yang mengisi formulir Excel — tidak ada baris pada B0002/B0003 yang memintanya, dan tidak
 * ada yang mengingatkan. Justru karena itu ia otomatis.
 *
 * Yang diretranslasi **hanya** 1-1220 Bank UKA. Kas UKA fisik (1-1210) adalah persediaan yang
 * dinilai dari hitungan fisik lewat 5-1300 pada paket C; meretranslasinya juga akan menghitung
 * pergerakan kurs yang sama dua kali sementara neracanya tetap seimbang — kekeliruan yang tidak
 * terlihat dari laporan mana pun.
 */

import Decimal from "decimal.js";
import { and, eq, lte, sql } from "drizzle-orm";
import {
  accountingPeriods,
  currencies,
  currencyRevaluations,
  journalEntries,
  journalEntryLines,
  rateReferenceSnapshots,
} from "../drizzle/schema";
import { snapshotOnOrBefore, valueMonetaryBalance } from "../shared/currencyRevaluation";
import { midClosingRate } from "../shared/inventoryValuation";
import { FX_BANK_ACCOUNT } from "../shared/journalMapping";
import { calendarDay } from "../shared/ledger";
import { monthKey } from "../shared/depreciation";
import { databaseOrThrow, retryTransientDatabaseRead } from "./operations";

/**
 * Tanggal yang dikirim ke kolom `date`.
 *
 * Tengah malam **waktu lokal**, bukan UTC: mengirim `Date` tengah malam UTC dari mesin WIB membuat
 * batas rentang mundur satu hari dan baris tanggal batas hilang diam-diam. Bug paket K1 yang sudah
 * diperbaiki dan tidak boleh kembali.
 */
const dbDate = (value: string) => new Date(`${value}T00:00:00`);

export type CurrencyRevaluationRow = {
  currencyId: number;
  currencyCode: string;
  foreignBalance: string;
  carryingBefore: string;
  rateSnapshotId: number;
  rateReferenceDate: string;
  midRatePerUnit: string;
  carryingAfter: string;
  difference: string;
};

export type CurrencyRevaluation = {
  periodId: number;
  /** "YYYY-MM" bulan periode itu. */
  periodMonth: string;
  periodStart: string;
  periodEnd: string;
  status: "TERBUKA" | "DITUTUP";
  rows: CurrencyRevaluationRow[];
  totalDifference: string;
  blockers: { currencyCode: string; reason: string }[];
  revaluationPostedAt: Date | null;
};

/**
 * Selisih retranslasi sebuah periode beserta apa yang menghalanginya. **Tidak menulis apa pun.**
 *
 * Panel memakainya untuk menunjukkan angka sebelum tombol ditekan, dan `postCurrencyRevaluation`
 * memakainya sebagai satu-satunya sumber angka — sehingga yang dilihat pengguna dan yang dijurnal
 * server mustahil berbeda. Pola yang sama dengan `buildPeriodValuation` dan
 * `buildMonthlyDepreciation`.
 *
 * Saldo valuta **dan** nilai tercatat Rupiah keduanya dibaca dari baris jurnal 1-1220 yang sama.
 * Mengambil saldo valuta dari `bank_account_movements` sementara nilai Rupiahnya dari buku besar
 * akan berselisih setiap kali ada mutasi yang dilewati karena kursnya belum tersedia — dan selisih
 * palsu itu akan dijurnal sebagai laba/rugi kurs yang tidak pernah terjadi.
 */
export async function buildCurrencyRevaluation(periodId: number): Promise<CurrencyRevaluation> {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();

    const period = (
      await db
        .select({
          id: accountingPeriods.id,
          periodStart: accountingPeriods.periodStart,
          periodEnd: accountingPeriods.periodEnd,
          status: accountingPeriods.status,
          revaluationPostedAt: accountingPeriods.revaluationPostedAt,
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

    const periodMonth = monthKey(period.periodStart);
    const periodEnd = calendarDay(period.periodEnd);

    // Seluruh baris 1-1220 sampai akhir periode. Baris tanpa `currencyCode` adalah jurnal revaluasi
    // itu sendiri — ia satu jurnal untuk seluruh mata uang dan karena itu tidak bermata uang;
    // menghitungnya sebagai mutasi akan menggandakan selisih yang sudah pernah dijurnal.
    const lines = await db
      .select({
        currencyCode: journalEntryLines.currencyCode,
        side: journalEntryLines.side,
        amount: journalEntryLines.amount,
        foreignAmount: journalEntryLines.foreignAmount,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalEntryLines.entryId))
      .where(
        and(
          eq(journalEntryLines.accountCode, FX_BANK_ACCOUNT),
          lte(journalEntries.entryDate, dbDate(periodEnd)),
        ),
      );

    const currencyRows = await db.select({ id: currencies.id, code: currencies.code }).from(currencies);
    const idByCode = new Map(currencyRows.map((row) => [row.code.toUpperCase(), row.id]));

    const snapshots = await db
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
        ),
      );

    // Selisih yang sudah pernah dijurnal pada periode-periode sebelumnya. Jurnal revaluasinya tidak
    // bermata uang, jadi sukunya diambil dari tabel buktinya.
    const priorRows = await db
      .select({ currencyId: currencyRevaluations.currencyId, difference: currencyRevaluations.difference })
      .from(currencyRevaluations)
      .where(sql`${currencyRevaluations.periodId} <> ${periodId}`);

    const priorByCurrency = new Map<number, Decimal>();
    for (const row of priorRows) {
      priorByCurrency.set(row.currencyId, (priorByCurrency.get(row.currencyId) ?? new Decimal(0)).plus(row.difference));
    }

    type Running = { foreign: Decimal; rupiah: Decimal };
    const running = new Map<string, Running>();
    for (const line of lines) {
      if (!line.currencyCode) continue;
      const code = line.currencyCode.toUpperCase();
      const entry = running.get(code) ?? { foreign: new Decimal(0), rupiah: new Decimal(0) };
      const sign = line.side === "DEBIT" ? 1 : -1;
      entry.foreign = entry.foreign.plus(new Decimal(line.foreignAmount ?? "0").times(sign));
      entry.rupiah = entry.rupiah.plus(new Decimal(line.amount).times(sign));
      running.set(code, entry);
    }

    const rows: CurrencyRevaluationRow[] = [];
    const blockers: { currencyCode: string; reason: string }[] = [];
    let totalDifference = new Decimal(0);

    for (const [code, entry] of [...running.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      // Rekening yang sudah dikosongkan bukan kekurangan data — ia tidak boleh muncul sebagai
      // penghalang yang menahan penutupan periode.
      if (entry.foreign.isZero()) continue;

      const currencyId = idByCode.get(code);
      if (!currencyId) {
        blockers.push({ currencyCode: code, reason: "mata uang tidak terdaftar pada tabel currencies" });
        continue;
      }

      const own = snapshots
        .filter((snapshot) => snapshot.currencyId === currencyId)
        .map((snapshot) => ({ ...snapshot, referenceDate: calendarDay(snapshot.referenceDate) }));
      const picked = snapshotOnOrBefore(own, periodEnd);
      if (!picked) {
        blockers.push({ currencyCode: code, reason: `tidak ada kurs BI sampai ${periodEnd}` });
        continue;
      }

      const midRatePerUnit = midClosingRate(picked);
      const carryingBefore = entry.rupiah.plus(priorByCurrency.get(currencyId) ?? 0).toFixed(2);
      const foreignBalance = entry.foreign.toFixed(6);
      const carryingAfter = valueMonetaryBalance({ foreignBalance, midRatePerUnit });
      const difference = new Decimal(carryingAfter).minus(carryingBefore).toFixed(2);

      rows.push({
        currencyId,
        currencyCode: code,
        foreignBalance,
        carryingBefore,
        rateSnapshotId: picked.id,
        rateReferenceDate: picked.referenceDate,
        midRatePerUnit,
        carryingAfter,
        difference,
      });
      totalDifference = totalDifference.plus(difference);
    }

    return {
      periodId,
      periodMonth,
      periodStart: calendarDay(period.periodStart),
      periodEnd,
      status: period.status,
      rows,
      totalDifference: totalDifference.toFixed(2),
      blockers,
      revaluationPostedAt: period.revaluationPostedAt,
    };
  });
}
