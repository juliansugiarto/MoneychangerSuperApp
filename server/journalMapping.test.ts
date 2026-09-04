import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHART_OF_ACCOUNTS } from "../shared/chartOfAccounts";
import { EXPENSE_CATEGORIES } from "../shared/expenseCategories";
import {
  EXPENSE_ACCOUNT_BY_CATEGORY,
  EXPENSE_PAYABLE_ACCOUNT,
  isSkipped,
  mapExchangeTransaction,
  mapExpense,
  type MappingResult,
} from "../shared/journalMapping";
import { assertJournalIsPostable, formatAmount } from "../shared/ledger";

const linesOf = (result: MappingResult) => {
  if (isSkipped(result)) throw new Error(`tidak terpetakan: ${result.skipped}`);
  return result.lines;
};

const knownCodes = new Set(CHART_OF_ACCOUNTS.map((account) => account.code));

describe("pemetaan transaksi valuta", () => {
  const beliTunai = { operation: "BUY" as const, paymentMethod: "CASH", rupiahAmount: "15000000.00", transactionNumber: "FX-1" };
  const jualTunai = { operation: "SELL" as const, paymentMethod: "CASH", rupiahAmount: "16000000.00", transactionNumber: "FX-2" };

  it("mencatat pembelian UKA sebagai pembelian persediaan, bukan penambahan kas UKA", () => {
    // Bagan akun memakai persediaan periodik: B0003 disusun dari Persediaan Awal + Pembelian −
    // Persediaan Akhir. Menjurnalnya ke 1-1210 Kas UKA menuntut harga pokok per lot yang sistem
    // ini tidak melacak, dan akan membuat B0003 tidak dapat disusun dari buku besar.
    const lines = linesOf(mapExchangeTransaction(beliTunai));
    expect(lines).toEqual([
      { accountCode: "5-1200", side: "DEBIT", amount: "15000000.00", memo: "FX-1" },
      { accountCode: "1-1110", side: "KREDIT", amount: "15000000.00", memo: "FX-1" },
    ]);
  });

  it("mencatat penjualan UKA sebagai pendapatan dan kas masuk", () => {
    const lines = linesOf(mapExchangeTransaction(jualTunai));
    expect(lines).toEqual([
      { accountCode: "1-1110", side: "DEBIT", amount: "16000000.00", memo: "FX-2" },
      { accountCode: "4-1100", side: "KREDIT", amount: "16000000.00", memo: "FX-2" },
    ]);
  });

  it("mengarahkan bon transfer bank ke rekening bank, bukan ke kas", () => {
    expect(linesOf(mapExchangeTransaction({ ...beliTunai, paymentMethod: "BANK_TRANSFER" }))[1].accountCode).toBe("1-1120");
    expect(linesOf(mapExchangeTransaction({ ...jualTunai, paymentMethod: "BANK_TRANSFER" }))[0].accountCode).toBe("1-1120");
  });

  it("melewatkan cara pembayaran yang tidak menyebutkan uangnya lewat mana", () => {
    // Menebaknya kas atau bank sama-sama salah, dan salahnya tidak akan terlihat pada laporan.
    const result = mapExchangeTransaction({ ...beliTunai, paymentMethod: "OTHER" });
    expect(isSkipped(result)).toBe(true);
    if (isSkipped(result)) expect(result.skipped).toMatch(/belum punya akun kas\/bank/);
  });

  it("melewatkan bon bernilai nol", () => {
    expect(isSkipped(mapExchangeTransaction({ ...beliTunai, rupiahAmount: "0.00" }))).toBe(true);
  });

  it("menghasilkan jurnal yang lolos aturan penyimpanan", () => {
    for (const input of [beliTunai, jualTunai]) {
      const summary = assertJournalIsPostable(linesOf(mapExchangeTransaction(input)));
      expect(summary.balanced).toBe(true);
      expect(formatAmount(summary.totalDebit)).toBe(input.rupiahAmount);
    }
  });

  it("memakai akun yang benar-benar ada pada bagan akun", () => {
    for (const input of [beliTunai, jualTunai, { ...beliTunai, paymentMethod: "BANK_TRANSFER" }]) {
      for (const line of linesOf(mapExchangeTransaction(input))) {
        expect(knownCodes.has(line.accountCode), `akun ${line.accountCode} tidak ada`).toBe(true);
      }
    }
  });
});

describe("pemetaan pengeluaran", () => {
  it("mencatat pengeluaran sebagai kewajiban, bukan pengurang kas", () => {
    // Modul pengeluaran sengaja tidak menyentuh cash_balances. Mengkredit Kas Rupiah akan membuat
    // kas di buku besar berbeda dari stok kas sebenarnya — persis temuan 7.2/7.3.
    const lines = linesOf(mapExpense({ category: "SEWA", amount: "12000000.00", description: "Sewa kantor September" }));
    expect(lines).toEqual([
      { accountCode: "6-1200", side: "DEBIT", amount: "12000000.00", memo: "Sewa kantor September" },
      { accountCode: EXPENSE_PAYABLE_ACCOUNT, side: "KREDIT", amount: "12000000.00", memo: "Sewa kantor September" },
    ]);
    expect(EXPENSE_PAYABLE_ACCOUNT).toBe("2-1900");
  });

  it("memetakan setiap kategori pengeluaran ke akun beban yang ada", () => {
    for (const category of EXPENSE_CATEGORIES) {
      const accountCode = EXPENSE_ACCOUNT_BY_CATEGORY[category];
      expect(accountCode, `kategori ${category} belum terpetakan`).toBeDefined();
      expect(knownCodes.has(accountCode), `akun ${accountCode} tidak ada pada bagan akun`).toBe(true);
      expect(accountCode.startsWith("6-"), `kategori ${category} tidak masuk beban operasional`).toBe(true);
    }
  });

  it("menempatkan kategori tanpa baris B0003 sendiri ke Lain-lain", () => {
    // B0003 hanya menyediakan sembilan baris beban; tiga kategori memang tidak punya rumahnya.
    expect(EXPENSE_ACCOUNT_BY_CATEGORY.PERLENGKAPAN_OPERASIONAL).toBe("6-1900");
    expect(EXPENSE_ACCOUNT_BY_CATEGORY.IZIN_DAN_PAJAK).toBe("6-1900");
    expect(EXPENSE_ACCOUNT_BY_CATEGORY.LAINNYA).toBe("6-1900");
  });

  it("memotong keterangan panjang agar muat pada kolom memo", () => {
    const lines = linesOf(mapExpense({ category: "LAINNYA", amount: "1000.00", description: "x".repeat(900) }));
    expect(lines[0].memo).toHaveLength(500);
  });

  it("melewatkan pengeluaran bernilai nol", () => {
    expect(isSkipped(mapExpense({ category: "SEWA", amount: "0.00", description: "kosong" }))).toBe(true);
  });

  it("menghasilkan jurnal yang lolos aturan penyimpanan", () => {
    for (const category of EXPENSE_CATEGORIES) {
      const summary = assertJournalIsPostable(linesOf(mapExpense({ category, amount: "250000.50", description: category })));
      expect(summary.balanced).toBe(true);
    }
  });
});

describe("penjurnalan otomatis", () => {
  const source = readFileSync(new URL("./ledgerPosting.ts", import.meta.url), "utf8");

  it("hanya menjurnal bon yang sudah selesai, bukan yang baru disetujui", () => {
    expect(source).toContain('eq(exchangeTransactions.status, "COMPLETED")');
  });

  it("mengecualikan data latihan dan data historis dari buku besar", () => {
    // Keduanya bukan transaksi hidup; memasukkannya membuat laporan memuat uang yang tak pernah ada.
    expect(source).toContain("eq(exchangeTransactions.isDemo, false)");
    expect(source).toContain("eq(exchangeTransactions.isHistorical, false)");
  });

  it("memeriksa lebih dahulu sumber yang sudah pernah dijurnal", () => {
    expect(source).toContain("alreadyJournaled");
    expect(source).toContain("outcome.alreadyPosted.push");
  });

  it("tidak disisipkan ke dalam penyelesaian bon", () => {
    // Penyelesaian bon memindahkan uang di meja kasir; kegagalan pembukuan tidak boleh
    // menggagalkannya. Dipisah, pembukuan yang gagal cukup diulang.
    const operations = readFileSync(new URL("./operations.ts", import.meta.url), "utf8");
    expect(operations).not.toContain("postOperationsToLedger");
    expect(operations).not.toContain("postExchangeTransactions");
  });

  it("menjurnal mutasi kas dan bank tanpa menghitung ulang sisi kas bon", () => {
    // Sisi kas bon sudah terjurnal lewat bonnya sendiri; kategori TRANSACTION karena itu wajib
    // tetap dilewati oleh pemetaan, bukan ikut dijurnal dari tabel mutasi.
    expect(source).toContain("cashBalanceMovements");
    expect(source).toContain("bankAccountMovements");
    const mapping = readFileSync(new URL("../shared/journalMapping.ts", import.meta.url), "utf8");
    expect(mapping).toContain("sisi kas bon sudah terjurnal lewat bonnya sendiri");
    expect(mapping).toContain("pemindahan kas↔bank sudah terjurnal dari sisi kas");
  });
});
