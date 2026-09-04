import { CHART_OF_ACCOUNTS } from "../shared/chartOfAccounts";
import {
  buildBalanceSheet,
  buildEquityStatement,
  buildIncomeStatement,
  statementWarnings,
  type BalanceSheet,
  type EquityStatement,
  type IncomeStatement,
  type StatementAccount,
  type StatementSection,
} from "../shared/financialStatements";
import { formatAmount, isoDay } from "../shared/ledger";
import { accountBalancesFor } from "./ledgerOperations";
import { retryTransientDatabaseRead } from "./operations";

const DAY_MS = 86_400_000;

const asUtcDay = (value: Date | string) => new Date(`${isoDay(value)}T00:00:00Z`);
const shiftDays = (value: Date | string, days: number) => new Date(asUtcDay(value).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Periode pembanding: rentang sepanjang periode berjalan yang berakhir sehari sebelum periode itu
 * mulai. SAK EP Bab 3 mewajibkan angka pembanding untuk setiap jumlah yang disajikan, dan
 * membandingkan sebulan dengan setahun akan menyesatkan pembacanya.
 */
function priorRange(from: Date | string, to: Date | string) {
  const days = Math.round((asUtcDay(to).getTime() - asUtcDay(from).getTime()) / DAY_MS) + 1;
  return { from: shiftDays(from, -days), to: shiftDays(from, -1) };
}

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
 * - Neraca memakai laba **sejak awal pembukuan**, karena selama jurnal penutup belum dijalankan
 *   laba periode-periode sebelumnya masih berada di akun laba rugi dan belum pindah ke laba
 *   ditahan. Memakai laba periode saja akan membuat neraca berselisih persis sebesar laba lampau.
 */
export async function buildFinancialStatements(input: { from: Date; to: Date }) {
  if (input.from > input.to) throw new Error("Tanggal mulai tidak boleh melewati tanggal akhir.");

  return retryTransientDatabaseRead(async () => {
    const prior = priorRange(input.from, input.to);
    const dayBefore = shiftDays(input.from, -1);

    const [periodNow, periodPrior, cumulativeNow, cumulativePrior] = await Promise.all([
      accountBalancesFor({ from: input.from, to: input.to }),
      accountBalancesFor(prior),
      accountBalancesFor({ to: input.to }),
      accountBalancesFor({ to: dayBefore }),
    ]);

    const income = buildIncomeStatement(periodNow, periodPrior);
    const cumulativeIncome = buildIncomeStatement(cumulativeNow, cumulativePrior);
    const balanceSheet = buildBalanceSheet(cumulativeNow, cumulativePrior, cumulativeIncome);
    const equity = buildEquityStatement(cumulativeNow, cumulativePrior, cumulativeIncome);

    return {
      period: { from: isoDay(input.from), to: isoDay(input.to) },
      comparativePeriod: prior,
      incomeStatement: renderIncome(income),
      balanceSheet: renderBalanceSheet(balanceSheet),
      equityStatement: renderEquity(equity),
      warnings: statementWarnings(balanceSheet, cumulativeNow),
      /** Akun yang punya saldo tetapi belum terpetakan ke form mana pun — seharusnya tidak pernah ada. */
      unmappedAccounts: unmapped(cumulativeNow),
    };
  });
}

function unmapped(accounts: StatementAccount[]) {
  const mapped = new Set(CHART_OF_ACCOUNTS.filter((account) => account.forms.length).map((account) => account.code));
  return accounts.filter((row) => row.balance !== 0n && !mapped.has(row.accountCode)).map((row) => row.accountCode);
}
