/**
 * Laporan keuangan yang disusun dari neraca saldo.
 *
 * Inilah bagian yang menutup temuan pemeriksaan 7.1 sampai 7.4: angkanya tidak diketik, melainkan
 * dihitung dari buku besar, sehingga tiap pos dapat ditelusuri kembali ke akun dan jurnalnya.
 *
 * SAK EP Bab 3 mewajibkan angka pembanding periode sebelumnya untuk setiap jumlah yang disajikan.
 * Form B0002/B0003/B0004 tidak memiliki kolomnya, tetapi standarnya tetap menuntut — jadi setiap
 * laporan di sini membawa pembandingnya sejak awal, bukan ditambahkan belakangan.
 */

import { CHART_OF_ACCOUNTS, type AccountType } from "./chartOfAccounts";
import { formatAmount } from "./ledger";

export type StatementAccount = { accountCode: string; balance: bigint };

export type StatementLine = {
  accountCode: string;
  accountName: string;
  /** Bertanda positif bila bergerak searah saldo normal akunnya. */
  amount: bigint;
  comparative: bigint;
  contra: boolean;
};

export type StatementSection = {
  title: string;
  lines: StatementLine[];
  total: bigint;
  comparativeTotal: bigint;
};

const ACCOUNT_BY_CODE = new Map(CHART_OF_ACCOUNTS.map((account) => [account.code, account]));

const balanceMap = (accounts: StatementAccount[]) => new Map(accounts.map((row) => [row.accountCode, row.balance]));

/**
 * Menyusun satu bagian laporan.
 *
 * Akun lawan (akumulasi penyusutan, dividen, persediaan akhir) **mengurangi** jumlah bagiannya.
 * Tanpa itu, akumulasi penyusutan akan menambah nilai aset tetap, bukan menguranginya.
 */
function section(
  title: string,
  codes: string[],
  current: Map<string, bigint>,
  prior: Map<string, bigint>,
): StatementSection {
  const lines: StatementLine[] = [];
  let total = 0n;
  let comparativeTotal = 0n;

  for (const code of codes) {
    const account = ACCOUNT_BY_CODE.get(code);
    if (!account) continue;
    const amount = current.get(code) ?? 0n;
    const comparative = prior.get(code) ?? 0n;
    if (amount === 0n && comparative === 0n) continue;

    const sign = account.contra ? -1n : 1n;
    total += sign * amount;
    comparativeTotal += sign * comparative;
    lines.push({ accountCode: code, accountName: account.name, amount, comparative, contra: account.contra === true });
  }
  return { title, lines, total, comparativeTotal };
}

const codesOfType = (...types: AccountType[]) =>
  CHART_OF_ACCOUNTS.filter((account) => types.includes(account.type)).map((account) => account.code);

export type IncomeStatement = {
  revenue: StatementSection;
  costOfGoods: StatementSection;
  operatingExpenses: StatementSection;
  otherItems: StatementSection;
  tax: StatementSection;
  grossProfit: bigint;
  grossProfitComparative: bigint;
  operatingProfit: bigint;
  operatingProfitComparative: bigint;
  netProfit: bigint;
  netProfitComparative: bigint;
};

/**
 * Laporan Laba Rugi (B0003).
 *
 * Harga pokok memakai persediaan periodik: Persediaan Awal + Pembelian − Persediaan Akhir. Akun
 * persediaan akhir adalah akun lawan, sehingga pengurangannya sudah tertangani `section`.
 *
 * Pendapatan/beban lain-lain dijumlahkan searah saldo normal masing-masing akun, sehingga akun
 * bersaldo normal debit (biaya administrasi bank, bunga pinjaman) otomatis mengurangi.
 */
export function buildIncomeStatement(current: StatementAccount[], prior: StatementAccount[]): IncomeStatement {
  const now = balanceMap(current);
  const before = balanceMap(prior);

  const revenue = section("Pendapatan", codesOfType("PENDAPATAN"), now, before);
  const costOfGoods = section("Harga pokok", codesOfType("HARGA_POKOK"), now, before);
  const operatingExpenses = section("Beban operasional", codesOfType("BEBAN"), now, before);
  const tax = section("Pajak", codesOfType("PAJAK"), now, before);

  // Akun lain-lain bercampur arah: yang bersaldo normal kredit menambah, yang debit mengurangi.
  const otherCodes = codesOfType("LAIN_LAIN");
  const otherLines: StatementLine[] = [];
  let otherTotal = 0n;
  let otherComparative = 0n;
  for (const code of otherCodes) {
    const account = ACCOUNT_BY_CODE.get(code)!;
    const amount = now.get(code) ?? 0n;
    const comparative = before.get(code) ?? 0n;
    if (amount === 0n && comparative === 0n) continue;
    const sign = account.normalBalance === "KREDIT" ? 1n : -1n;
    otherTotal += sign * amount;
    otherComparative += sign * comparative;
    otherLines.push({ accountCode: code, accountName: account.name, amount, comparative, contra: false });
  }
  const otherItems: StatementSection = { title: "Pendapatan/(beban) lain-lain", lines: otherLines, total: otherTotal, comparativeTotal: otherComparative };

  const grossProfit = revenue.total - costOfGoods.total;
  const grossProfitComparative = revenue.comparativeTotal - costOfGoods.comparativeTotal;
  const operatingProfit = grossProfit - operatingExpenses.total;
  const operatingProfitComparative = grossProfitComparative - operatingExpenses.comparativeTotal;
  const netProfit = operatingProfit + otherItems.total - tax.total;
  const netProfitComparative = operatingProfitComparative + otherItems.comparativeTotal - tax.comparativeTotal;

  return {
    revenue, costOfGoods, operatingExpenses, otherItems, tax,
    grossProfit, grossProfitComparative,
    operatingProfit, operatingProfitComparative,
    netProfit, netProfitComparative,
  };
}

export type BalanceSheet = {
  assets: StatementSection;
  liabilities: StatementSection;
  equity: StatementSection;
  /** Laba periode berjalan yang belum ditutup ke laba ditahan. */
  currentPeriodProfit: bigint;
  currentPeriodProfitComparative: bigint;
  totalEquity: bigint;
  totalEquityComparative: bigint;
  totalLiabilitiesAndEquity: bigint;
  totalLiabilitiesAndEquityComparative: bigint;
  balanced: boolean;
  difference: bigint;
};

/**
 * Laporan Posisi Keuangan (B0002).
 *
 * Laba periode berjalan dimasukkan ke ekuitas, bukan diabaikan: selama jurnal penutup belum
 * dijalankan, laba rugi masih berada di akunnya sendiri, dan neraca hanya akan seimbang bila laba
 * itu diperhitungkan sebagai penambah ekuitas. Neraca yang tidak seimbang berarti ada yang salah
 * pada buku besarnya, dan itu harus terlihat — bukan ditutup dengan pos penyeimbang.
 */
export function buildBalanceSheet(
  current: StatementAccount[],
  prior: StatementAccount[],
  income: IncomeStatement,
): BalanceSheet {
  const now = balanceMap(current);
  const before = balanceMap(prior);

  const assets = section("Aset", codesOfType("ASET"), now, before);
  const liabilities = section("Kewajiban", codesOfType("KEWAJIBAN"), now, before);
  const equity = section("Ekuitas", codesOfType("EKUITAS"), now, before);

  const totalEquity = equity.total + income.netProfit;
  const totalEquityComparative = equity.comparativeTotal + income.netProfitComparative;
  const totalLiabilitiesAndEquity = liabilities.total + totalEquity;
  const totalLiabilitiesAndEquityComparative = liabilities.comparativeTotal + totalEquityComparative;
  const difference = assets.total - totalLiabilitiesAndEquity;

  return {
    assets, liabilities, equity,
    currentPeriodProfit: income.netProfit,
    currentPeriodProfitComparative: income.netProfitComparative,
    totalEquity, totalEquityComparative,
    totalLiabilitiesAndEquity, totalLiabilitiesAndEquityComparative,
    balanced: difference === 0n,
    difference,
  };
}

export type EquityStatement = {
  openingCapital: bigint;
  openingRetainedEarnings: bigint;
  netProfit: bigint;
  dividends: bigint;
  closingEquity: bigint;
  comparativeClosingEquity: bigint;
};

/**
 * Laporan Perubahan Ekuitas (B0004).
 *
 * Modal disetor pada Akta menjadi angka pembuka; laba periode menambah, dividen mengurangi.
 * Dividen adalah akun lawan bersaldo debit, sehingga saldonya positif berarti pembagian.
 */
export function buildEquityStatement(
  current: StatementAccount[],
  prior: StatementAccount[],
  income: IncomeStatement,
): EquityStatement {
  const now = balanceMap(current);
  const before = balanceMap(prior);
  const at = (map: Map<string, bigint>, code: string) => map.get(code) ?? 0n;

  const openingCapital = at(now, "3-1100");
  const openingRetainedEarnings = at(now, "3-2100");
  const dividends = at(now, "3-4100");
  const closingEquity = openingCapital + openingRetainedEarnings + income.netProfit - dividends;
  const comparativeClosingEquity =
    at(before, "3-1100") + at(before, "3-2100") + income.netProfitComparative - at(before, "3-4100");

  return { openingCapital, openingRetainedEarnings, netProfit: income.netProfit, dividends, closingEquity, comparativeClosingEquity };
}

/**
 * Hal-hal yang membuat angka laporan belum layak dipakai.
 *
 * Disajikan sebagai peringatan, bukan disembunyikan atau ditambal pos penyeimbang: laporan yang
 * terlihat rapi padahal dasarnya belum lengkap justru lebih berbahaya di hadapan pemeriksa.
 */
export function statementWarnings(balanceSheet: BalanceSheet, current: StatementAccount[]): string[] {
  const warnings: string[] = [];
  const now = balanceMap(current);

  if (!balanceSheet.balanced) {
    warnings.push(`Neraca belum seimbang — selisih ${formatAmount(balanceSheet.difference)}. Periksa buku besarnya sebelum angka ini dipakai.`);
  }
  if ((now.get("1-1110") ?? 0n) < 0n) {
    warnings.push("Kas Rupiah bersaldo negatif. Saldo awal kas kemungkinan belum dicatat sebagai jurnal.");
  }
  if ((now.get("1-1210") ?? 0n) === 0n && (now.get("5-1200") ?? 0n) > 0n) {
    warnings.push("Persediaan UKA belum dinilai. Catat persediaan akhir dari hasil stock opname agar harga pokok tidak berlebih.");
  }
  if ((now.get("3-1100") ?? 0n) === 0n) {
    warnings.push("Modal disetor belum tercatat pada buku besar.");
  }
  return warnings;
}
