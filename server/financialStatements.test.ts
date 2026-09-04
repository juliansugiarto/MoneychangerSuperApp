import { describe, expect, it } from "vitest";
import {
  buildBalanceSheet,
  buildEquityStatement,
  buildIncomeStatement,
  statementWarnings,
  type StatementAccount,
} from "../shared/financialStatements";
import { formatAmount, parseAmount } from "../shared/ledger";

/** Saldo searah saldo normal akunnya, seperti yang dihasilkan `accountBalancesFor`. */
const at = (entries: Record<string, string>): StatementAccount[] =>
  Object.entries(entries).map(([accountCode, amount]) => ({ accountCode, balance: parseAmount(amount) }));

const kosong: StatementAccount[] = [];

describe("laporan laba rugi", () => {
  const periode = at({
    "4-1100": "80500000.00", // Penjualan UKA
    "5-1200": "158000000.00", // Pembelian UKA
    "5-1300": "95000000.00", // Persediaan akhir (akun lawan)
    "6-1200": "12000000.00", // Sewa
    "6-1100": "20000000.00", // Gaji
    "7-1200": "150000.00", // Biaya administrasi bank (saldo normal debit)
    "7-1100": "500000.00", // Pendapatan bunga bank (saldo normal kredit)
    "8-1100": "1000000.00", // Pajak
  });

  it("menghitung harga pokok dengan persediaan periodik", () => {
    // Persediaan Awal + Pembelian − Persediaan Akhir. Persediaan akhir adalah akun lawan, jadi
    // ia mengurangi; tanpa itu harga pokok akan berlebih sebesar seluruh persediaan yang tersisa.
    const income = buildIncomeStatement(periode, kosong);
    expect(formatAmount(income.costOfGoods.total)).toBe("63000000.00");
    expect(formatAmount(income.grossProfit)).toBe("17500000.00");
  });

  it("mengurangi beban operasional dari laba kotor", () => {
    const income = buildIncomeStatement(periode, kosong);
    expect(formatAmount(income.operatingExpenses.total)).toBe("32000000.00");
    expect(formatAmount(income.operatingProfit)).toBe("-14500000.00");
  });

  it("menjumlahkan pos lain-lain menurut arah saldo normal masing-masing akun", () => {
    // Pendapatan bunga menambah, biaya administrasi bank mengurangi — keduanya berada pada
    // kelompok yang sama, jadi menjumlahkannya begitu saja akan salah tanda.
    const income = buildIncomeStatement(periode, kosong);
    expect(formatAmount(income.otherItems.total)).toBe("350000.00");
  });

  it("menghasilkan laba bersih setelah pos lain-lain dan pajak", () => {
    const income = buildIncomeStatement(periode, kosong);
    expect(formatAmount(income.netProfit)).toBe("-15150000.00");
  });

  it("membawa angka pembanding periode sebelumnya", () => {
    // SAK EP Bab 3 mewajibkan pembanding untuk setiap jumlah yang disajikan.
    const income = buildIncomeStatement(at({ "4-1100": "10000000.00" }), at({ "4-1100": "8000000.00" }));
    expect(formatAmount(income.revenue.total)).toBe("10000000.00");
    expect(formatAmount(income.revenue.comparativeTotal)).toBe("8000000.00");
  });

  it("tidak menampilkan akun yang tidak bersaldo pada kedua periode", () => {
    const income = buildIncomeStatement(at({ "4-1100": "10000000.00" }), kosong);
    expect(income.operatingExpenses.lines).toHaveLength(0);
    expect(income.revenue.lines.map((line) => line.accountCode)).toEqual(["4-1100"]);
  });
});

describe("laporan posisi keuangan", () => {
  // Modal 500 juta disetor tunai, lalu beli UKA 158 juta tunai dan jual 80,5 juta tunai.
  const kumulatif = at({
    "1-1110": "422500000.00",
    "3-1100": "500000000.00",
    "4-1100": "80500000.00",
    "5-1200": "158000000.00",
  });

  it("seimbang bila laba berjalan diperhitungkan sebagai penambah ekuitas", () => {
    // Selama jurnal penutup belum ada, laba masih berada di akun laba rugi. Mengabaikannya
    // membuat neraca berselisih persis sebesar laba itu.
    const income = buildIncomeStatement(kumulatif, kosong);
    const sheet = buildBalanceSheet(kumulatif, kosong, income);
    expect(formatAmount(sheet.assets.total)).toBe("422500000.00");
    expect(formatAmount(sheet.currentPeriodProfit)).toBe("-77500000.00");
    expect(formatAmount(sheet.totalEquity)).toBe("422500000.00");
    expect(sheet.balanced).toBe(true);
    expect(sheet.difference).toBe(0n);
  });

  it("memperlakukan akumulasi penyusutan sebagai pengurang aset", () => {
    const dengan = at({ "1-1510": "100000000.00", "1-1520": "25000000.00", "3-1100": "75000000.00" });
    const income = buildIncomeStatement(dengan, kosong);
    const sheet = buildBalanceSheet(dengan, kosong, income);
    expect(formatAmount(sheet.assets.total)).toBe("75000000.00");
    expect(sheet.balanced).toBe(true);
  });

  it("menyatakan selisih apa adanya bila buku besarnya tidak seimbang", () => {
    // Neraca yang tidak seimbang berarti ada yang salah; menutupinya dengan pos penyeimbang
    // justru menyembunyikan kesalahan yang harus terlihat.
    const pincang = at({ "1-1110": "100000000.00", "3-1100": "90000000.00" });
    const income = buildIncomeStatement(pincang, kosong);
    const sheet = buildBalanceSheet(pincang, kosong, income);
    expect(sheet.balanced).toBe(false);
    expect(formatAmount(sheet.difference)).toBe("10000000.00");
  });
});

describe("laporan perubahan ekuitas", () => {
  it("menjumlahkan modal, laba ditahan, dan laba berjalan lalu mengurangi dividen", () => {
    const saldo = at({
      "3-1100": "500000000.00",
      "3-2100": "40000000.00",
      "3-4100": "15000000.00",
      "4-1100": "30000000.00",
    });
    const income = buildIncomeStatement(saldo, kosong);
    const equity = buildEquityStatement(saldo, kosong, income);
    expect(formatAmount(equity.openingCapital)).toBe("500000000.00");
    expect(formatAmount(equity.netProfit)).toBe("30000000.00");
    expect(formatAmount(equity.dividends)).toBe("15000000.00");
    expect(formatAmount(equity.closingEquity)).toBe("555000000.00");
  });
});

describe("peringatan kelayakan angka", () => {
  const warn = (entries: Record<string, string>) => {
    const saldo = at(entries);
    const income = buildIncomeStatement(saldo, kosong);
    return statementWarnings(buildBalanceSheet(saldo, kosong, income), saldo);
  };

  it("memperingatkan kas negatif karena saldo awal belum dicatat", () => {
    expect(warn({ "1-1110": "-7750000.00", "3-1100": "1.00" }).some((text) => text.includes("Kas Rupiah bersaldo negatif"))).toBe(true);
  });

  it("memperingatkan persediaan UKA yang belum dinilai", () => {
    expect(warn({ "5-1200": "158000000.00", "3-1100": "1.00" }).some((text) => text.includes("Persediaan UKA belum dinilai"))).toBe(true);
  });

  it("memperingatkan modal disetor yang belum tercatat", () => {
    expect(warn({ "1-1110": "1000.00" }).some((text) => text.includes("Modal disetor belum tercatat"))).toBe(true);
  });

  it("memperingatkan neraca yang belum seimbang beserta selisihnya", () => {
    expect(warn({ "1-1110": "100000000.00", "3-1100": "90000000.00" }).some((text) => text.includes("belum seimbang"))).toBe(true);
  });

  it("tidak memperingatkan apa pun pada buku besar yang lengkap dan seimbang", () => {
    expect(warn({ "1-1110": "422500000.00", "1-1210": "77500000.00", "3-1100": "500000000.00" })).toEqual([]);
  });
});
