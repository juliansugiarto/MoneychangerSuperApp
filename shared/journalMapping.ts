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
import type { JournalSide } from "./ledger";

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
