import { describe, expect, it, vi } from "vitest";

vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, accountBalancesFor: vi.fn() };
});

import {
  buildBalanceSheet,
  buildEquityStatement,
  buildIncomeStatement,
  statementWarnings,
  type StatementAccount,
} from "../shared/financialStatements";
import { journalEntries } from "../drizzle/schema";
import { formatAmount, parseAmount } from "../shared/ledger";
import * as db from "./db";
import { buildFinancialStatements } from "./financialStatements";
import { accountBalancesFor } from "./ledgerOperations";

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

/**
 * Neraca setelah penutup laba tahunan ada.
 *
 * `accountBalancesFor` dan `getDb` dipalsukan; tidak ada basis data yang disentuh. Yang diuji bukan
 * aritmetika laporannya — itu sudah diuji di atas — melainkan **rentang mana** yang dipakai untuk
 * akun laba rugi pada neraca.
 */
describe("neraca dan penutup laba tahunan", () => {
  const kumulatif = at({ "1-1110": "140000000.00", "3-1100": "100000000.00", "4-1100": "40000000.00" });

  /** Satu pemanggilan `accountBalancesFor`, dikenali dari batas rentangnya. */
  const rangeKey = (input: { from?: Date | string; to?: Date | string }) =>
    `${input.from ? isoDayOf(input.from) : "-"}..${input.to ? isoDayOf(input.to) : "-"}`;
  const isoDayOf = (value: Date | string) => (typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10));

  function setup(options: { balances: Record<string, StatementAccount[]>; closings: unknown[][] }) {
    const queue = [...options.closings];
    const chain = (rows: unknown[]): never => {
      const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
      for (const method of ["where", "innerJoin", "orderBy", "limit"]) thenable[method] = () => chain(rows);
      return thenable as never;
    };
    // Antrean `closings` hanya menjawab pembacaan `journal_entries`. Sejak paket F2,
    // `buildFinancialStatements` ikut menyusun Arus Kas, yang membaca baris jurnal dan pelunasan —
    // menjawab keduanya dari antrean yang sama akan menggeser urutannya dan membuat uji ini
    // menguji hal lain tanpa terlihat.
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue({
      select: () => ({
        from: (table: unknown) =>
          table === journalEntries
            ? chain((queue.length > 1 ? queue.shift() : queue[0]) ?? [])
            : chain([]),
      }),
    } as never);
    const balances = vi.mocked(accountBalancesFor);
    balances.mockReset();
    balances.mockImplementation(async (input) => options.balances[rangeKey(input)] ?? kosong);
    return { getDb, balances };
  }

  const range = { from: new Date("2026-06-01T00:00:00Z"), to: new Date("2026-06-30T00:00:00Z") };

  it("tidak menggerakkan satu angka pun selama belum pernah ada penutup laba", async () => {
    const { getDb } = setup({
      closings: [[]],
      balances: { "-..2026-06-30": kumulatif, "-..2026-05-31": kumulatif },
    });

    const result = await buildFinancialStatements(range);

    // Laba sejak awal pembukuan, persis seperti sebelum paket C.
    expect(result.balanceSheet.currentPeriodProfit).toBe("40000000.00");
    expect(result.balanceSheet.balanced).toBe(true);
    getDb.mockRestore();
  });

  it("memakai laba sejak penutup laba terakhir, bukan sejak awal pembukuan", async () => {
    // Kumulatif masih memuat laba 2025 pada 4-1100; yang boleh tampil pada neraca 2026 hanyalah
    // laba sejak 1 Januari 2026, karena laba 2025 sudah berpindah ke 3-2100.
    const { getDb, balances } = setup({
      closings: [[{ entryDate: new Date("2025-12-31T00:00:00") }]],
      balances: {
        "-..2026-06-30": at({ "1-1110": "140000000.00", "3-1100": "100000000.00", "3-2100": "25000000.00", "4-1100": "40000000.00" }),
        "2026-01-01..2026-06-30": at({ "4-1100": "15000000.00" }),
        "-..2026-05-31": kosong,
      },
    });

    const result = await buildFinancialStatements(range);

    expect(balances).toHaveBeenCalledWith({ from: "2026-01-01", to: range.to });
    expect(result.balanceSheet.currentPeriodProfit).toBe("15000000.00");
    // 140jt aset = 100jt modal + 25jt laba ditahan + 15jt laba berjalan.
    expect(result.balanceSheet.balanced).toBe(true);
    getDb.mockRestore();
  });

  it("kolom pembanding memakai batasnya sendiri, bukan batas periode berjalan", async () => {
    // Pembanding berakhir 31 Mei 2026 — sesudah penutup laba 2025, jadi ia pun dibatasi sejak
    // 1 Januari 2026. Menyamakannya dengan batas periode berjalan akan menyajikan angka
    // pembanding yang tidak pernah ada.
    const { getDb, balances } = setup({
      closings: [[{ entryDate: new Date("2025-12-31T00:00:00") }]],
      balances: {},
    });

    await buildFinancialStatements(range);

    expect(balances).toHaveBeenCalledWith({ from: "2026-01-01", to: "2026-05-31" });
    getDb.mockRestore();
  });

  it("membiarkan pembanding memakai laba sejak awal pembukuan bila penutupnya belum ada saat itu", async () => {
    // Neraca 31 Desember 2025 disusun sebelum jurnal penutupnya tertulis; laba 2025 masih berada
    // di akun laba rugi, dan memangkasnya akan membuat neraca itu berselisih.
    const { getDb, balances } = setup({
      closings: [[{ entryDate: new Date("2025-12-31T00:00:00") }], []],
      balances: {},
    });

    await buildFinancialStatements(range);

    expect(balances).toHaveBeenCalledWith({ to: "2026-05-31" });
    expect(balances).not.toHaveBeenCalledWith({ from: "2026-01-01", to: "2026-05-31" });
    getDb.mockRestore();
  });

  /**
   * Arus Kas menyatu dengan ketiga laporan lain, bukan laporan terpisah dengan rentangnya sendiri.
   * Rentang pembandingnya wajib sama persis: dua salinan aturan rentang yang dapat berbeda pendapat
   * adalah kekeliruan yang tidak terlihat dari laporan mana pun.
   */
  it("membawa Arus Kas beserta pembandingnya pada rentang yang sama dengan ketiga laporan lain", async () => {
    const { getDb } = setup({ closings: [[]], balances: {} });

    const result = await buildFinancialStatements(range);

    expect(result.cashFlowStatement.period).toEqual({ from: "2026-06-01", to: "2026-06-30" });
    expect(result.cashFlowComparative.period).toEqual(result.comparativePeriod);
    getDb.mockRestore();
  });

  it("memperingatkan bahwa beban dan aset tercatat tetapi belum ada yang dibayar", async () => {
    // Persis keadaan basis data lokal sesudah paket E: 2-1900 berisi Rp 24.000.000 sementara kas
    // Rupiah belum pernah bergerak sekali pun.
    const { getDb } = setup({
      closings: [[]],
      balances: { "2026-06-01..2026-06-30": at({ "2-1900": "24000000.00" }) },
    });

    const result = await buildFinancialStatements(range);

    expect(result.warnings.some((warning) => warning.includes("belum ada yang dibayar"))).toBe(true);
    getDb.mockRestore();
  });
});

describe("peringatan arus kas", () => {
  const seimbang = buildBalanceSheet(kosong, kosong, buildIncomeStatement(kosong, kosong));

  it("menyebutkan nomor jurnal yang belum terklasifikasi", () => {
    const warnings = statementWarnings(seimbang, kosong, {
      reconciled: true, difference: "0.00",
      unclassifiedEntryNumbers: ["JU-202609-0006", "JU-202609-0007"],
      payableGrewUnpaid: false,
    });
    expect(warnings.some((warning) => warning.includes("JU-202609-0006"))).toBe(true);
  });

  it("menyebutkan selisih rekonsiliasi sebagai peringatan, bukan menutupnya", () => {
    const warnings = statementWarnings(seimbang, kosong, {
      reconciled: false, difference: "4000000.00", unclassifiedEntryNumbers: [], payableGrewUnpaid: false,
    });
    expect(warnings.some((warning) => warning.includes("4000000.00") && warning.includes("penyeimbang"))).toBe(true);
  });

  it("diam ketika arus kasnya utuh", () => {
    const warnings = statementWarnings(seimbang, kosong, {
      reconciled: true, difference: "0.00", unclassifiedEntryNumbers: [], payableGrewUnpaid: false,
    });
    expect(warnings.filter((warning) => warning.includes("Arus Kas"))).toHaveLength(0);
  });
});
