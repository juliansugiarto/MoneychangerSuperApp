/**
 * Catatan atas Laporan Keuangan.
 *
 * Delapan catatan di sini **dibangkitkan dari buku besar dan tabel buktinya**, bukan diketik.
 * Itulah yang membuat CALK mustahil berselisih dengan laporan yang disertainya: tidak ada satu pun
 * angka yang dimasukkan dua kali, dan tiap baris dapat ditelusuri ke barisnya sendiri.
 *
 * Tujuh catatan naratif tidak dibangkitkan — mereka pertimbangan manajemen, dan teksnya disimpan
 * pada `financial_statement_notes` (tugas berikutnya).
 */

import Decimal from "decimal.js";
import { and, gte, inArray, lte } from "drizzle-orm";
import {
  currencies,
  currencyRevaluations,
  fixedAssetDepreciationEntries,
  fixedAssets,
  journalEntryLines,
  operationalExpenses,
  periodClosingValuations,
  accountingPeriods,
} from "../drizzle/schema";
import { CHART_OF_ACCOUNTS, findAccount } from "../shared/chartOfAccounts";
import { CASH_ACCOUNTS } from "../shared/currencyRevaluation";
import { FINANCIAL_NOTES, type FinancialNoteDefinition } from "../shared/financialNotes";
import { priorRange } from "../shared/financialStatements";
import { calendarDay, formatAmount, isoDay } from "../shared/ledger";
import { accountBalancesFor, dbDate, loadLines } from "./ledgerOperations";
import { databaseOrThrow, retryTransientDatabaseRead } from "./operations";
import { listOutstandingSettlements } from "./settlements";

export type NoteTable = { columns: string[]; rows: string[][] };

export type GeneratedNote = FinancialNoteDefinition & {
  kind: "BANGKITAN";
  table: NoteTable;
  /** Terisi bila catatannya sendiri menemukan sesuatu yang tidak sejalan dengan laporannya. */
  warning?: string;
};

const money = (value: bigint) => formatAmount(value);
const decimalMoney = (value: string | number) => new Decimal(String(value)).toFixed(2);

const definition = (key: string) => FINANCIAL_NOTES.find((note) => note.key === key)! as FinancialNoteDefinition;

const balanceOf = (rows: { accountCode: string; balance: bigint }[], code: string) =>
  rows.find((row) => row.accountCode === code)?.balance ?? 0n;

/**
 * Delapan catatan bangkitan untuk satu rentang laporan.
 *
 * Rentang pembandingnya diturunkan lewat `priorRange` yang sama dengan keempat laporan lain —
 * catatan yang membandingkan periode dengan rentang berbeda akan membantah laporannya sendiri.
 */
export async function buildGeneratedNotes(input: { from: Date | string; to: Date | string }): Promise<GeneratedNote[]> {
  return retryTransientDatabaseRead(async () => {
    const prior = priorRange(input.from, input.to);
    const db = await databaseOrThrow();

    const [cumulative, periodNow, periodPrior, fxLines, outstanding] = await Promise.all([
      accountBalancesFor({ to: input.to }),
      accountBalancesFor({ from: input.from, to: input.to }),
      accountBalancesFor(prior),
      loadLines(undefined, input.to, "1-1220"),
      listOutstandingSettlements(),
    ]);

    const periods = await db
      .select()
      .from(accountingPeriods)
      .where(and(gte(accountingPeriods.periodEnd, dbDate(input.from)), lte(accountingPeriods.periodEnd, dbDate(input.to))));
    const periodIds = periods.map((period) => period.id);

    const [valuations, revaluations, currencyRows, assets, depreciation, expenses] = await Promise.all([
      periodIds.length ? db.select().from(periodClosingValuations).where(inArray(periodClosingValuations.periodId, periodIds)) : Promise.resolve([]),
      periodIds.length ? db.select().from(currencyRevaluations).where(inArray(currencyRevaluations.periodId, periodIds)) : Promise.resolve([]),
      db.select().from(currencies),
      db.select().from(fixedAssets),
      periodIds.length ? db.select().from(fixedAssetDepreciationEntries).where(inArray(fixedAssetDepreciationEntries.periodId, periodIds)) : Promise.resolve([]),
      db.select().from(operationalExpenses),
    ]);
    const currencyById = new Map(currencyRows.map((row) => [row.id, row.code]));

    return [
      cashNote(cumulative, fxLines),
      inventoryNote(cumulative, valuations, currencyById),
      fixedAssetNote(assets, depreciation),
      payableNote(cumulative, outstanding.payables),
      equityNote(cumulative),
      revenueExpenseNote(periodNow, periodPrior),
      fxDifferenceNote(revaluations, currencyById),
      nonCashNote(input, outstanding.payables, expenses, assets),
    ];
  });
}

/** Kas dan setara kas: ketiga akunnya, ditambah saldo valuta per mata uang pada 1-1220. */
function cashNote(cumulative: { accountCode: string; balance: bigint }[], fxLines: Awaited<ReturnType<typeof loadLines>>): GeneratedNote {
  const rows = CASH_ACCOUNTS.map((code) => [code, findAccount(code)?.name ?? code, money(balanceOf(cumulative, code))]);

  const foreignByCurrency = new Map<string, Decimal>();
  for (const line of fxLines as unknown as { currencyCode: string | null; foreignAmount: string | null; side: "DEBIT" | "KREDIT" }[]) {
    if (!line.currencyCode || !line.foreignAmount) continue;
    const signed = new Decimal(line.foreignAmount).times(line.side === "DEBIT" ? 1 : -1);
    foreignByCurrency.set(line.currencyCode, (foreignByCurrency.get(line.currencyCode) ?? new Decimal(0)).plus(signed));
  }
  for (const [code, amount] of foreignByCurrency) {
    rows.push(["1-1220", `— saldo valuta ${code}`, `${amount.toFixed(2)} ${code}`]);
  }

  return {
    ...definition("KAS_DAN_SETARA_KAS"), kind: "BANGKITAN",
    table: { columns: ["Akun", "Nama", "Saldo"], rows },
  };
}

/** Persediaan UKA: hasil penilaian penutupan periode, beserta bukti kuantitas dan kursnya. */
function inventoryNote(
  cumulative: { accountCode: string; balance: bigint }[],
  valuations: any[],
  currencyById: Map<number, string>,
): GeneratedNote {
  const rows = valuations.map((row) => [
    currencyById.get(row.currencyId) ?? String(row.currencyId),
    new Decimal(String(row.quantity)).toFixed(2),
    calendarDay(row.opnameDate),
    new Decimal(String(row.midRatePerUnit)).toFixed(6),
    calendarDay(row.rateReferenceDate),
    decimalMoney(row.rupiahValue),
  ]);
  const valued = valuations.reduce((total, row) => total.plus(String(row.rupiahValue)), new Decimal(0));
  const carrying = balanceOf(cumulative, "1-1210");

  return {
    ...definition("PERSEDIAAN_UKA"), kind: "BANGKITAN",
    table: { columns: ["Mata uang", "Kuantitas", "Tanggal opname", "Kurs tengah", "Tanggal kurs", "Nilai Rupiah"], rows },
    ...(rows.length && valued.toFixed(2) !== money(carrying)
      ? { warning: `Jumlah penilaian (${valued.toFixed(2)}) berbeda dari saldo 1-1210 (${money(carrying)}). Periode setelah penilaian terakhir kemungkinan belum dinilai.` }
      : {}),
  };
}

/** Aset tetap per aset, beserta beban penyusutan yang benar-benar dijurnal pada rentang ini. */
function fixedAssetNote(assets: any[], depreciation: any[]): GeneratedNote {
  const chargeByAsset = new Map<number, Decimal>();
  for (const row of depreciation) {
    chargeByAsset.set(row.assetId, (chargeByAsset.get(row.assetId) ?? new Decimal(0)).plus(String(row.charge)));
  }
  const accumulatedByAsset = new Map<number, Decimal>();
  for (const row of depreciation) {
    const current = accumulatedByAsset.get(row.assetId);
    const candidate = new Decimal(String(row.accumulatedAfter));
    if (!current || candidate.gt(current)) accumulatedByAsset.set(row.assetId, candidate);
  }

  const rows = assets.map((asset) => {
    const accumulated = accumulatedByAsset.get(asset.id) ?? new Decimal(String(asset.openingAccumulatedDepreciation));
    return [
      asset.name,
      asset.category,
      calendarDay(asset.acquisitionDate),
      decimalMoney(asset.acquisitionCost),
      accumulated.toFixed(2),
      new Decimal(String(asset.acquisitionCost)).minus(accumulated).toFixed(2),
      asset.usefulLifeMonths ? `${asset.usefulLifeMonths} bulan` : "Tidak disusutkan",
      (chargeByAsset.get(asset.id) ?? new Decimal(0)).toFixed(2),
      asset.status === "DILEPAS" ? `Dilepas ${asset.disposalDate ? calendarDay(asset.disposalDate) : ""}`.trim() : "Aktif",
    ];
  });

  return {
    ...definition("ASET_TETAP"), kind: "BANGKITAN",
    table: { columns: ["Aset", "Kelompok", "Perolehan", "Harga perolehan", "Akumulasi", "Nilai buku", "Umur manfaat", "Beban periode", "Status"], rows },
  };
}

/**
 * Kewajiban lain-lain: rincian 2-1900 menurut asalnya.
 *
 * Jumlah sisa tagihan wajib sama dengan saldo 2-1900. Bila tidak, ada beban yang belum dijurnal
 * atau jurnal manual yang menyentuh 2-1900 tanpa lewat modulnya — dan itu harus terbaca di sini,
 * bukan disembunyikan dengan menampilkan saldo akunnya saja.
 */
function payableNote(cumulative: { accountCode: string; balance: bigint }[], payables: Awaited<ReturnType<typeof listOutstandingSettlements>>["payables"]): GeneratedNote {
  const rows = payables.map((row) => [
    row.targetType === "BEBAN" ? "Beban" : "Aset tetap",
    row.label,
    row.originDate,
    row.originalAmount,
    row.settledAmount,
    row.outstandingAmount,
  ]);
  const total = payables.reduce((sum, row) => sum.plus(row.outstandingAmount), new Decimal(0));
  const carrying = balanceOf(cumulative, "2-1900");

  return {
    ...definition("KEWAJIBAN_LAIN_LAIN"), kind: "BANGKITAN",
    table: { columns: ["Asal", "Keterangan", "Tanggal", "Nilai asal", "Sudah dilunasi", "Sisa terutang"], rows },
    ...(total.toFixed(2) !== money(carrying)
      ? { warning: `Jumlah sisa terutang (${total.toFixed(2)}) berbeda dari saldo 2-1900 (${money(carrying)}). Ada beban yang belum dijurnal, atau jurnal yang menyentuh 2-1900 di luar modulnya.` }
      : {}),
  };
}

function equityNote(cumulative: { accountCode: string; balance: bigint }[]): GeneratedNote {
  const rows = ["3-1100", "3-2100", "3-4100"].map((code) => [code, findAccount(code)?.name ?? code, money(balanceOf(cumulative, code))]);
  return {
    ...definition("EKUITAS"), kind: "BANGKITAN",
    table: { columns: ["Akun", "Nama", "Saldo"], rows },
  };
}

function revenueExpenseNote(
  periodNow: { accountCode: string; balance: bigint }[],
  periodPrior: { accountCode: string; balance: bigint }[],
): GeneratedNote {
  const rows = CHART_OF_ACCOUNTS
    .filter((account) => ["PENDAPATAN", "HARGA_POKOK", "BEBAN", "LAIN_LAIN", "PAJAK"].includes(account.type))
    .map((account) => ({ account, now: balanceOf(periodNow, account.code), before: balanceOf(periodPrior, account.code) }))
    .filter((row) => row.now !== 0n || row.before !== 0n)
    .map((row) => [row.account.code, row.account.name, money(row.now), money(row.before)]);

  return {
    ...definition("PENDAPATAN_DAN_BEBAN"), kind: "BANGKITAN",
    table: { columns: ["Akun", "Nama", "Periode berjalan", "Pembanding"], rows },
  };
}

function fxDifferenceNote(revaluations: any[], currencyById: Map<number, string>): GeneratedNote {
  const rows = revaluations.map((row) => [
    currencyById.get(row.currencyId) ?? String(row.currencyId),
    new Decimal(String(row.foreignBalance)).toFixed(2),
    new Decimal(String(row.midRatePerUnit)).toFixed(6),
    calendarDay(row.rateReferenceDate),
    decimalMoney(row.carryingBefore),
    decimalMoney(row.carryingAfter),
    decimalMoney(row.difference),
  ]);
  return {
    ...definition("SELISIH_KURS"), kind: "BANGKITAN",
    table: { columns: ["Mata uang", "Saldo valuta", "Kurs tengah", "Tanggal kurs", "Nilai sebelum", "Nilai sesudah", "Selisih"], rows },
  };
}

/**
 * Transaksi nonkas: perolehan aset dan beban yang tercatat pada rentang ini tetapi belum dibayar.
 *
 * SAK EP mengeluarkannya dari Laporan Arus Kas dan memintanya diungkapkan — inilah tempatnya, dan
 * inilah yang membuat perolehan aset Rp 24.000.000 lewat 2-1900 tetap terlihat meski tidak pernah
 * menjadi arus kas.
 */
function nonCashNote(
  input: { from: Date | string; to: Date | string },
  payables: Awaited<ReturnType<typeof listOutstandingSettlements>>["payables"],
  expenses: any[],
  assets: any[],
): GeneratedNote {
  const from = isoDay(input.from);
  const to = isoDay(input.to);
  const withinRange = (date: string) => date >= from && date <= to;

  const originDates = new Map<string, string>();
  for (const row of expenses) originDates.set(`BEBAN:${row.id}`, calendarDay(row.expenseDate));
  for (const row of assets) originDates.set(`ASET_TETAP:${row.id}`, calendarDay(row.acquisitionDate));

  const rows = payables
    .filter((row) => withinRange(originDates.get(`${row.targetType}:${row.targetId}`) ?? ""))
    .map((row) => [
      row.targetType === "BEBAN" ? "Beban belum dibayar" : "Perolehan aset tetap lewat kewajiban",
      row.label,
      row.originDate,
      row.outstandingAmount,
    ]);

  return {
    ...definition("TRANSAKSI_NONKAS"), kind: "BANGKITAN",
    table: { columns: ["Jenis", "Keterangan", "Tanggal", "Nilai belum dibayar"], rows },
  };
}
