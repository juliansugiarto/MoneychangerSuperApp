import { and, desc, eq, lte, sql } from "drizzle-orm";
import { journalEntries } from "../drizzle/schema";
import { CHART_OF_ACCOUNTS, findAccount, isBalanceSheetAccount } from "../shared/chartOfAccounts";
import {
  buildBalanceSheet,
  buildEquityStatement,
  buildIncomeStatement,
  priorRange,
  shiftDays,
  statementWarnings,
  type BalanceSheet,
  type EquityStatement,
  type IncomeStatement,
  type StatementAccount,
  type StatementSection,
} from "../shared/financialStatements";
import { calendarDay, formatAmount, isoDay } from "../shared/ledger";
import { buildCashFlowStatement } from "./cashFlow";
import { accountBalancesFor } from "./ledgerOperations";
import { databaseOrThrow, retryTransientDatabaseRead } from "./operations";

const money = (value: bigint) => formatAmount(value);

const renderSection = (section: StatementSection) => ({
  title: section.title,
  lines: section.lines.map((line) => ({
    accountCode: line.accountCode,
    accountName: line.accountName,
    contra: line.contra,
    amount: money(line.amount),
    comparative: money(line.comparative),
  })),
  total: money(section.total),
  comparativeTotal: money(section.comparativeTotal),
});

const renderIncome = (income: IncomeStatement) => ({
  revenue: renderSection(income.revenue),
  costOfGoods: renderSection(income.costOfGoods),
  operatingExpenses: renderSection(income.operatingExpenses),
  otherItems: renderSection(income.otherItems),
  tax: renderSection(income.tax),
  grossProfit: money(income.grossProfit),
  grossProfitComparative: money(income.grossProfitComparative),
  operatingProfit: money(income.operatingProfit),
  operatingProfitComparative: money(income.operatingProfitComparative),
  netProfit: money(income.netProfit),
  netProfitComparative: money(income.netProfitComparative),
});

const renderBalanceSheet = (sheet: BalanceSheet) => ({
  assets: renderSection(sheet.assets),
  liabilities: renderSection(sheet.liabilities),
  equity: renderSection(sheet.equity),
  currentPeriodProfit: money(sheet.currentPeriodProfit),
  currentPeriodProfitComparative: money(sheet.currentPeriodProfitComparative),
  totalEquity: money(sheet.totalEquity),
  totalEquityComparative: money(sheet.totalEquityComparative),
  totalLiabilitiesAndEquity: money(sheet.totalLiabilitiesAndEquity),
  totalLiabilitiesAndEquityComparative: money(sheet.totalLiabilitiesAndEquityComparative),
  balanced: sheet.balanced,
  difference: money(sheet.difference),
});

const renderEquity = (equity: EquityStatement) => ({
  openingCapital: money(equity.openingCapital),
  openingRetainedEarnings: money(equity.openingRetainedEarnings),
  netProfit: money(equity.netProfit),
  dividends: money(equity.dividends),
  closingEquity: money(equity.closingEquity),
  comparativeClosingEquity: money(equity.comparativeClosingEquity),
});

/**
 * Tiga laporan yang diminta form B0002, B0003, dan B0004 — disusun dari buku besar, bukan diketik.
 *
 * Dua ukuran laba dipakai dan keduanya benar pada tempatnya masing-masing:
 *
 * - Laporan laba rugi memakai **mutasi periode** — itulah arti laba sebulan.
 * - Neraca memakai laba **sejak penutup laba tahunan terakhir**. Selama penutup itu belum pernah
 *   dijalankan, "sejak penutupan terakhir" berarti sejak awal pembukuan dan angkanya persis seperti
 *   sebelum paket C: laba periode-periode sebelumnya masih berada di akun laba rugi dan belum
 *   pindah ke laba ditahan, sehingga memakai laba periode saja akan membuat neraca berselisih
 *   persis sebesar laba lampau. Setelah penutup tahunan ada, laba lampau sudah berada di 3-2100 dan
 *   membawanya lagi dari akun laba rugi akan menghitungnya dua kali.
 *
 * Batasnya dihitung terpisah untuk kolom berjalan dan kolom pembanding: neraca 31 Desember 2025
 * disusun sebelum jurnal penutupnya tertulis, dan memangkasnya dengan batas tahun 2026 akan
 * menyajikan angka pembanding yang tidak pernah ada.
 */
export async function buildFinancialStatements(input: { from: Date; to: Date }) {
  const computed = await computeFinancialStatements(input);
  return renderFinancialStatements(computed);
}

/**
 * Bentuk bertipe laporan, sebelum nominalnya dijadikan teks.
 *
 * Dipisahkan pada paket G supaya ekspor form B dapat memakai angka yang **sama persis** dengan yang
 * tampil di layar. Ekspor yang menghitung ulang saldonya sendiri akan dapat berbeda pendapat dengan
 * layar tanpa satu pun dari keduanya terlihat salah.
 */
export type ComputedFinancialStatements = Awaited<ReturnType<typeof computeFinancialStatements>>;

export async function computeFinancialStatements(input: { from: Date; to: Date }) {
  if (input.from > input.to) throw new Error("Tanggal mulai tidak boleh melewati tanggal akhir.");

  return retryTransientDatabaseRead(async () => {
    const prior = priorRange(input.from, input.to);
    const dayBefore = shiftDays(input.from, -1);

    const db = await databaseOrThrow();
    const [closingNow, closingPrior] = await Promise.all([
      lastProfitClosingDate(db, input.to),
      lastProfitClosingDate(db, dayBefore),
    ]);

    const [periodNow, periodPrior, cumulativeNow, cumulativePrior, sinceClosingNow, sinceClosingPrior] = await Promise.all([
      accountBalancesFor({ from: input.from, to: input.to }),
      accountBalancesFor(prior),
      accountBalancesFor({ to: input.to }),
      accountBalancesFor({ to: dayBefore }),
      closingNow ? accountBalancesFor({ from: shiftDays(closingNow, 1), to: input.to }) : null,
      closingPrior ? accountBalancesFor({ from: shiftDays(closingPrior, 1), to: dayBefore }) : null,
    ]);

    const sheetNow = sinceClosingNow ? mergeForBalanceSheet(cumulativeNow, sinceClosingNow) : cumulativeNow;
    const sheetPrior = sinceClosingPrior ? mergeForBalanceSheet(cumulativePrior, sinceClosingPrior) : cumulativePrior;

    const [cashFlow, cashFlowPrior] = await Promise.all([
      buildCashFlowStatement({ from: input.from, to: input.to }),
      buildCashFlowStatement(prior),
    ]);

    const income = buildIncomeStatement(periodNow, periodPrior);
    const cumulativeIncome = buildIncomeStatement(sheetNow, sheetPrior);
    const balanceSheet = buildBalanceSheet(sheetNow, sheetPrior, cumulativeIncome);
    const equity = buildEquityStatement(sheetNow, sheetPrior, cumulativeIncome);

    return {
      period: { from: isoDay(input.from), to: isoDay(input.to) },
      comparativePeriod: prior,
      income,
      balanceSheet,
      equity,
      cashFlowStatement: cashFlow,
      cashFlowComparative: cashFlowPrior,
      warnings: statementWarnings(balanceSheet, sheetNow, {
        reconciled: cashFlow.reconciled,
        difference: cashFlow.difference,
        unclassifiedEntryNumbers: cashFlow.unclassified.lines.flatMap((line) => line.entryNumbers),
        // 2-1900 bertambah pada periode ini sementara tidak ada satu pun pelunasan yang dijurnal:
        // beban dan aset tercatat, tetapi uangnya belum pernah keluar.
        payableGrewUnpaid:
          (periodNow.find((row) => row.accountCode === "2-1900")?.balance ?? 0n) > 0n
          && cashFlow.operating.lines.every((line) => line.label !== "Pembayaran beban operasional")
          && cashFlow.investing.lines.length === 0,
      }),
      /** Akun yang punya saldo tetapi belum terpetakan ke form mana pun — seharusnya tidak pernah ada. */
      unmappedAccounts: unmapped(cumulativeNow),
    };
  });
}

function renderFinancialStatements(computed: ComputedFinancialStatements) {
  const { income, balanceSheet, equity, ...rest } = computed;
  return {
    ...rest,
    incomeStatement: renderIncome(income),
    balanceSheet: renderBalanceSheet(balanceSheet),
    equityStatement: renderEquity(equity),
  };
}

function unmapped(accounts: StatementAccount[]) {
  const mapped = new Set(CHART_OF_ACCOUNTS.filter((account) => account.forms.length).map((account) => account.code));
  return accounts.filter((row) => row.balance !== 0n && !mapped.has(row.accountCode)).map((row) => row.accountCode);
}

/** Tanggal jurnal penutup laba terakhir yang tidak melewati batas ini, bila sudah pernah ada. */
async function lastProfitClosingDate(db: Awaited<ReturnType<typeof databaseOrThrow>>, to: Date | string) {
  const [row] = await db
    .select({ entryDate: journalEntries.entryDate })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.sourceType, "TUTUP_PERIODE"),
        sql`${journalEntries.sourceReference} LIKE 'TUTUP-LABA-%'`,
        lte(journalEntries.entryDate, new Date(`${isoDay(to)}T00:00:00`)),
      ),
    )
    .orderBy(desc(journalEntries.entryDate))
    .limit(1);
  return row ? calendarDay(row.entryDate) : null;
}

/**
 * Saldo untuk neraca: akun neraca kumulatif sejak awal pembukuan, akun laba rugi hanya sejak
 * penutupan tahunan terakhir.
 *
 * Pada buku besar yang utuh keduanya sudah sama — jurnal penutup itulah yang menolkan akun laba
 * rugi. Penggabungan ini menjaga neraca tetap benar ketika keduanya **tidak** sama, misalnya
 * sesudah sebuah jurnal penutup dibalik: memakai kumulatif di situ akan menghitung laba lampau dua
 * kali, sekali pada 3-2100 dan sekali lagi pada akun laba ruginya.
 */
function mergeForBalanceSheet(cumulative: StatementAccount[], sinceClosing: StatementAccount[]): StatementAccount[] {
  const sinceMap = new Map(sinceClosing.map((row) => [row.accountCode, row.balance]));
  const seen = new Set<string>();
  const merged = cumulative.map((row) => {
    seen.add(row.accountCode);
    const account = findAccount(row.accountCode);
    if (account && isBalanceSheetAccount(account.type)) return row;
    return { accountCode: row.accountCode, balance: sinceMap.get(row.accountCode) ?? 0n };
  });
  for (const row of sinceClosing) if (!seen.has(row.accountCode)) merged.push(row);
  return merged;
}
