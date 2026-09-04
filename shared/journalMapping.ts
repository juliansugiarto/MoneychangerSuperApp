/**
 * Pemetaan catatan operasional menjadi baris jurnal.
 *
 * Dipisahkan dari basis data supaya dapat diuji sungguhan: pemetaan inilah yang menentukan setiap
 * angka pada laporan keuangan, dan kekeliruan di sini menghasilkan buku besar yang salah dengan
 * percaya diri — lebih buruk daripada tidak ada buku besar sama sekali.
 *
 * Yang tidak dapat dipetakan tanpa menebak sengaja dikembalikan sebagai `skipped` beserta
 * alasannya, bukan dipaksakan ke akun yang kira-kira cocok.
 */

import type { ExpenseCategory } from "./expenseCategories";
import { findAccount, isBalanceSheetAccount, RETAINED_EARNINGS_ACCOUNT_CODE } from "./chartOfAccounts";
import { formatAmount, oppositeSide, parseAmount, type JournalSide } from "./ledger";

export type MappedLine = { accountCode: string; side: JournalSide; amount: string; memo?: string };
export type MappingResult = { lines: MappedLine[] } | { skipped: string };

export const isSkipped = (result: MappingResult): result is { skipped: string } => "skipped" in result;

/** Akun kas/bank Rupiah menurut cara pembayaran bon. */
const RUPIAH_ACCOUNT_BY_PAYMENT: Record<string, string> = {
  CASH: "1-1110",
  BANK_TRANSFER: "1-1120",
};

/**
 * Transaksi valuta.
 *
 * Bagan akun memakai persediaan periodik — B0003 disusun dari Persediaan Awal + Pembelian −
 * Persediaan Akhir, bukan dari harga pokok per transaksi. Karena itu pembelian UKA masuk ke
 * 5-1200 dan penjualan ke 4-1100; akun Kas UKA (1-1210) baru bergerak pada akhir periode lewat
 * persediaan akhir hasil stock opname. Menjurnalnya per transaksi akan menuntut harga pokok per
 * lot (FIFO atau rata-rata) yang sistem ini memang tidak melacak.
 *
 * Nominalnya adalah sisi Rupiah bon, bukan nominal valutanya: buku besar dinyatakan dalam mata
 * uang fungsional.
 */
export function mapExchangeTransaction(input: {
  operation: "BUY" | "SELL";
  paymentMethod: string;
  rupiahAmount: string;
  transactionNumber: string;
}): MappingResult {
  const rupiahAccount = RUPIAH_ACCOUNT_BY_PAYMENT[input.paymentMethod];
  if (!rupiahAccount) {
    // "OTHER" tidak menyebutkan uangnya lewat mana; menebaknya kas atau bank sama-sama salah.
    return { skipped: `cara pembayaran ${input.paymentMethod} belum punya akun kas/bank yang pasti` };
  }
  if (Number(input.rupiahAmount) <= 0) return { skipped: "nilai Rupiah bon nol" };

  const memo = input.transactionNumber;
  return input.operation === "BUY"
    ? {
        lines: [
          { accountCode: "5-1200", side: "DEBIT", amount: input.rupiahAmount, memo },
          { accountCode: rupiahAccount, side: "KREDIT", amount: input.rupiahAmount, memo },
        ],
      }
    : {
        lines: [
          { accountCode: rupiahAccount, side: "DEBIT", amount: input.rupiahAmount, memo },
          { accountCode: "4-1100", side: "KREDIT", amount: input.rupiahAmount, memo },
        ],
      };
}

/**
 * Kategori pengeluaran ke baris beban B0003.
 *
 * Tiga kategori tidak punya baris sendiri pada B0003 dan jatuh ke "Lain-lain" — bukan karena
 * dianggap remeh, melainkan karena formulir resminya memang hanya menyediakan sembilan baris.
 */
export const EXPENSE_ACCOUNT_BY_CATEGORY: Record<ExpenseCategory, string> = {
  SEWA: "6-1200",
  GAJI: "6-1100",
  UTILITAS: "6-1400",
  PEMASARAN: "6-1300",
  PEMELIHARAAN: "6-1600",
  PERLENGKAPAN_OPERASIONAL: "6-1900",
  IZIN_DAN_PAJAK: "6-1900",
  LAINNYA: "6-1900",
};

/**
 * Akun lawan pengeluaran.
 *
 * Modul pengeluaran sengaja tidak pernah menyentuh kas (lihat `CLAUDE.md`), sehingga mengkredit Kas
 * Rupiah akan membuat kas pada buku besar berbeda dari `cash_balances` — persis jenis
 * ketidakcocokan yang menjadi temuan pemeriksaan 7.2/7.3. Pengeluaran karena itu dicatat sebagai
 * kewajiban lebih dahulu; pelunasannya dijurnal terpisah saat kas benar-benar keluar.
 */
export const EXPENSE_PAYABLE_ACCOUNT = "2-1900";

export function mapExpense(input: { category: ExpenseCategory; amount: string; description: string }): MappingResult {
  const accountCode = EXPENSE_ACCOUNT_BY_CATEGORY[input.category];
  if (!accountCode) return { skipped: `kategori ${input.category} belum terpetakan ke akun beban` };
  if (Number(input.amount) <= 0) return { skipped: "nominal pengeluaran nol" };

  const memo = input.description.slice(0, 500);
  return {
    lines: [
      { accountCode, side: "DEBIT", amount: input.amount, memo },
      { accountCode: EXPENSE_PAYABLE_ACCOUNT, side: "KREDIT", amount: input.amount, memo },
    ],
  };
}


/**
 * Mutasi kas dan bank.
 *
 * Sebagian besar kategori sengaja **tidak** dijurnal, dan itu keputusan pokoknya: sisi kas bon
 * sudah terjurnal lewat bonnya sendiri, perpindahan laci↔brankas adalah kas yang sama pada satu
 * baris B0002, dan penukaran pecahan bernilai net nol. Menjurnalnya sekaligus akan menghitung uang
 * yang sama dua kali. Yang tersisa hanyalah uang yang benar-benar melintasi batas usaha, ditambah
 * selisih hitung fisik pada pembukaan.
 */

export const CASH_ACCOUNT = "1-1110";
export const BANK_ACCOUNT = "1-1120";
export const PAID_IN_CAPITAL_ACCOUNT = "3-1100";
/** Penarikan pemilik dicatat sebagai distribusi, bukan pengurangan setoran — keputusan pengguna 4 September 2026. */
export const DIVIDEND_ACCOUNT = "3-4100";
export const CASH_VARIANCE_ACCOUNT = "7-1900";

export type CashMovementCategory =
  | "OPENING" | "TRANSACTION" | "SAFE_DEPOSIT" | "SAFE_WITHDRAWAL" | "OFF_HOURS_SALE"
  | "DENOMINATION_EXCHANGE" | "CAPITAL_INJECTION" | "CAPITAL_WITHDRAWAL"
  | "BANK_DEPOSIT" | "BANK_WITHDRAWAL" | "OTHER";

export type BankMovementCategory =
  | "OPENING" | "TRANSACTION" | "ADJUSTMENT" | "CAPITAL_INJECTION" | "CAPITAL_WITHDRAWAL"
  | "CASH_TRANSFER" | "OTHER";

/**
 * Kolom mutasi berskala enam desimal, buku besar hanya menerima dua.
 *
 * Membulatkan diam-diam berarti menciptakan atau menghilangkan uang di dalam pembukuan. Karena itu
 * nominal dengan pecahan di bawah sen dikembalikan sebagai `null` dan dilewati beserta alasannya.
 */
function toLedgerAmount(raw: string): { amount: string; negative: boolean } | null {
  const trimmed = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const negative = trimmed.startsWith("-");
  const absolute = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ""] = absolute.split(".");
  const padded = `${fraction}00`.slice(0, 2);
  if (fraction.slice(2).replace(/0/g, "") !== "") return null;
  return { amount: `${whole}.${padded}`, negative };
}

const pair = (debit: string, credit: string, amount: string, memo: string): MappingResult => ({
  lines: [
    { accountCode: debit, side: "DEBIT", amount, memo },
    { accountCode: credit, side: "KREDIT", amount, memo },
  ],
});

export function mapCashMovement(input: {
  category: CashMovementCategory;
  amount: string;
  currencyCode: string;
  reason: string;
  /** Benar bila tidak ada mutasi lain yang lebih awal untuk mata uang ini. */
  isFirstMovementForCurrency: boolean;
}): MappingResult {
  if (input.currencyCode.trim().toUpperCase() !== "IDR") {
    return { skipped: "mutasi valuta asing tidak dinilai per mutasi; persediaan periodik menilainya di akhir periode" };
  }

  switch (input.category) {
    case "TRANSACTION":
      return { skipped: "sisi kas bon sudah terjurnal lewat bonnya sendiri" };
    case "SAFE_DEPOSIT":
    case "SAFE_WITHDRAWAL":
      return { skipped: "perpindahan laci↔brankas adalah kas yang sama; B0002 hanya punya satu baris Kas Rupiah" };
    case "DENOMINATION_EXCHANGE":
      return { skipped: "penukaran pecahan bernilai net nol" };
    case "OFF_HOURS_SALE":
      return { skipped: "penjualan di luar jam tidak menyimpan nilai Rupiah lawannya; seharusnya dicatat sebagai bon" };
    case "OTHER":
      return { skipped: "penyesuaian bercatatan bebas tidak dapat dipetakan tanpa menebak akunnya" };
  }

  const parsed = toLedgerAmount(input.amount);
  if (!parsed) return { skipped: "nominal mutasi memiliki pecahan di bawah sen; menjurnalnya menuntut pembulatan uang" };
  const memo = input.reason.slice(0, 500);
  if (parsed.amount === "0.00") return { skipped: "tidak ada selisih untuk dijurnal" };

  switch (input.category) {
    case "CAPITAL_INJECTION":
      return pair(CASH_ACCOUNT, PAID_IN_CAPITAL_ACCOUNT, parsed.amount, memo);
    case "CAPITAL_WITHDRAWAL":
      return pair(DIVIDEND_ACCOUNT, CASH_ACCOUNT, parsed.amount, memo);
    case "BANK_DEPOSIT":
      return pair(BANK_ACCOUNT, CASH_ACCOUNT, parsed.amount, memo);
    case "BANK_WITHDRAWAL":
      return pair(CASH_ACCOUNT, BANK_ACCOUNT, parsed.amount, memo);
    case "OPENING":
      // Kas awal pertama yang bertambah berarti uang muncul tanpa asal yang tercatat. Menjurnalnya
      // ke 7-1900 akan mencatat modal pemilik sebagai pendapatan lain-lain.
      if (input.isFirstMovementForCurrency && !parsed.negative) {
        return { skipped: "kas awal pertama; asal uangnya belum tercatat — catat sebagai setoran modal lebih dulu" };
      }
      return parsed.negative
        ? pair(CASH_VARIANCE_ACCOUNT, CASH_ACCOUNT, parsed.amount, memo)
        : pair(CASH_ACCOUNT, CASH_VARIANCE_ACCOUNT, parsed.amount, memo);
  }
}

export function mapBankMovement(input: {
  category: BankMovementCategory;
  direction: "IN" | "OUT" | "ADJUSTMENT";
  amount: string;
  currencyCode: string;
  reason: string;
}): MappingResult {
  if (input.currencyCode.trim().toUpperCase() !== "IDR") {
    return { skipped: "rekening valuta asing belum dinilai; hanya rekening IDR yang dijurnal" };
  }

  switch (input.category) {
    case "TRANSACTION":
      return { skipped: "sisi bank bon sudah terjurnal lewat bonnya sendiri" };
    case "CASH_TRANSFER":
      return { skipped: "pemindahan kas↔bank sudah terjurnal dari sisi kas" };
    case "ADJUSTMENT":
    case "OTHER":
      return { skipped: "penyesuaian rekening bercatatan bebas tidak dapat dipetakan tanpa menebak akunnya" };
  }

  const parsed = toLedgerAmount(input.amount);
  if (!parsed) return { skipped: "nominal mutasi memiliki pecahan di bawah sen; menjurnalnya menuntut pembulatan uang" };
  if (parsed.amount === "0.00") return { skipped: "mutasi rekening bernilai nol" };
  const memo = input.reason.slice(0, 500);

  return input.category === "CAPITAL_WITHDRAWAL"
    ? pair(DIVIDEND_ACCOUNT, BANK_ACCOUNT, parsed.amount, memo)
    : pair(BANK_ACCOUNT, PAID_IN_CAPITAL_ACCOUNT, parsed.amount, memo);
}

/**
 * Penutupan periode: penilaian persediaan valuta.
 *
 * Persediaan periodik berarti akun 1-1210 Kas UKA hanya bergerak di sini — `mapExchangeTransaction`
 * sengaja tidak menyentuhnya per transaksi karena itu menuntut harga pokok per lot yang sistem ini
 * tidak melacak. Satu jurnal memuat kedua sisi sekaligus (keputusan pengguna 4 September 2026):
 * membalik nilai persediaan akhir periode sebelumnya ke 5-1100, lalu membukukan nilai baru ke
 * 5-1300. Keduanya jatuh di dalam periode yang ditutup, sehingga tidak ada jurnal yang ditulis ke
 * periode lain dan idempotensinya cukup dijaga satu kunci sumber.
 */
export const FX_INVENTORY_ACCOUNT = "1-1210";
export const OPENING_INVENTORY_ACCOUNT = "5-1100";
export const CLOSING_INVENTORY_ACCOUNT = "5-1300";

export function mapPeriodInventoryClosing(input: {
  priorClosingValue: string;
  closingValue: string;
  memo: string;
}): MappingResult {
  const prior = toLedgerAmount(input.priorClosingValue);
  const closing = toLedgerAmount(input.closingValue);
  if (!prior || !closing) return { skipped: "nilai penilaian memiliki pecahan di bawah sen" };
  if (prior.negative || closing.negative) {
    return { skipped: "nilai persediaan negatif; hitungan fisik tidak pernah negatif dan angkanya harus diperiksa lebih dulu" };
  }

  const memo = input.memo.slice(0, 500);
  const lines: MappedLine[] = [];
  if (prior.amount !== "0.00") {
    lines.push({ accountCode: OPENING_INVENTORY_ACCOUNT, side: "DEBIT", amount: prior.amount, memo });
    lines.push({ accountCode: FX_INVENTORY_ACCOUNT, side: "KREDIT", amount: prior.amount, memo });
  }
  if (closing.amount !== "0.00") {
    lines.push({ accountCode: FX_INVENTORY_ACCOUNT, side: "DEBIT", amount: closing.amount, memo });
    lines.push({ accountCode: CLOSING_INVENTORY_ACCOUNT, side: "KREDIT", amount: closing.amount, memo });
  }
  if (!lines.length) return { skipped: "tidak ada persediaan UKA untuk dinilai pada periode ini" };
  return { lines };
}

/**
 * Penutup laba tahun buku ke 3-2100 Laba Ditahan.
 *
 * Hanya akhir tahun buku, bukan tiap bulan (keputusan pengguna 4 September 2026): menutup tiap bulan
 * membuat laba rugi bulanan dan laba ditahan sama-sama bergerak, dan laporan laba rugi tahunan tidak
 * lagi dapat disusun dari buku besar tanpa membaca balik jurnal penutup tiap bulan.
 *
 * Akun mana yang ditutup ditentukan `isBalanceSheetAccount`, bukan daftar kode yang ditulis ulang di
 * sini — dua daftar yang harus dijaga serempak adalah dua daftar yang akan berbeda.
 */
export function mapYearEndProfitClosing(input: {
  balances: { accountCode: string; balance: string }[];
  memo: string;
}): MappingResult {
  const memo = input.memo.slice(0, 500);
  const lines: MappedLine[] = [];
  let net = 0n; // positif berarti laba

  for (const row of input.balances) {
    const account = findAccount(row.accountCode);
    if (!account) return { skipped: `akun ${row.accountCode} tidak ada pada bagan akun` };
    if (isBalanceSheetAccount(account.type)) continue;

    const parsed = toLedgerAmount(row.balance);
    if (!parsed) return { skipped: `saldo akun ${row.accountCode} memiliki pecahan di bawah sen` };
    const magnitude = parseAmount(parsed.amount);
    if (magnitude === 0n) continue;

    // Saldo datang searah saldo normal akunnya; menolkannya berarti membukukan sisi sebaliknya.
    const naturalSide: JournalSide = account.normalBalance === "DEBIT" ? "DEBIT" : "KREDIT";
    const signed = parsed.negative ? -magnitude : magnitude;
    lines.push({
      accountCode: row.accountCode,
      side: signed > 0n ? oppositeSide(naturalSide) : naturalSide,
      amount: formatAmount(magnitude),
      memo,
    });
    // Akun bersaldo normal kredit menambah laba; yang bersaldo normal debit menguranginya. Akun
    // lawan ikut benar apa adanya: 5-1300 bersaldo normal kredit dan memang menambah laba.
    net += naturalSide === "KREDIT" ? signed : -signed;
  }

  if (!lines.length) return { skipped: "tidak ada saldo laba rugi untuk ditutup pada tahun buku ini" };
  if (net !== 0n) {
    lines.push({
      accountCode: RETAINED_EARNINGS_ACCOUNT_CODE,
      side: net > 0n ? "KREDIT" : "DEBIT",
      amount: formatAmount(net > 0n ? net : -net),
      memo,
    });
  }
  return { lines };
}
