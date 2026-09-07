import { describe, expect, it } from "vitest";
import { buildBalanceSheet, buildEquityStatement, buildIncomeStatement, type StatementAccount } from "./financialStatements";
import { buildFormValues, cellValue, findFormValues, sideValue, type FormValueInput, type FormValues } from "./regulatoryFormValues";
import { REGULATORY_FORMS, isValueCell } from "./regulatoryForms";

/** Angka karangan, bukan pembukuan siapa pun. Satuan sen, seperti seluruh nominal buku besar. */
const juta = (value: number) => BigInt(value) * 1_000_000n;

function statements(balances: Record<string, bigint>): FormValueInput {
  const accounts: StatementAccount[] = Object.entries(balances).map(([accountCode, balance]) => ({ accountCode, balance }));
  const prior: StatementAccount[] = [];
  const incomeStatement = buildIncomeStatement(accounts, prior);
  return {
    incomeStatement,
    balanceSheet: buildBalanceSheet(accounts, prior, incomeStatement),
    equityStatement: buildEquityStatement(accounts, prior, incomeStatement),
  };
}

/** Satu tahun buku sederhana yang neracanya seimbang: aset 560 = kewajiban 10 + ekuitas 550. */
const TAHUN_SEDERHANA = {
  "1-1110": juta(300),
  "1-1210": juta(200),
  "1-1510": juta(100),
  "1-1520": juta(40),
  "2-1900": juta(10),
  "3-1100": juta(500),
  "3-2100": juta(20),
  "4-1100": juta(100),
  "5-1200": juta(60),
  "6-1100": juta(10),
};

const forms = (balances: Record<string, bigint>, fiscalYear = 2025) => buildFormValues(statements(balances), fiscalYear);
const form = (values: FormValues[], code: "B0002" | "B0003" | "B0004") => findFormValues(values, code)!;

describe("nilai baris form dari laporan keuangan", () => {
  it("mengisi ketiga form dengan jumlah baris berisi seperti Jumlah Record-nya", () => {
    const values = forms(TAHUN_SEDERHANA);
    for (const item of values) {
      const structure = REGULATORY_FORMS.find((candidate) => candidate.code === item.code)!;
      const filled = item.rows.filter((row) => structure.rows.find((candidate) => candidate.key === row.key)!.cells.some(isValueCell));
      expect(filled, item.code).toHaveLength(item.recordCount);
    }
  });

  it("menaruh saldo akun apa adanya, termasuk akun lawan sebagai bilangan positif", () => {
    const b0002 = form(forms(TAHUN_SEDERHANA), "B0002");
    expect(cellValue(b0002, "aset-kas-rp")).toBe(juta(300));
    expect(cellValue(b0002, "aset-kas-uka")).toBe(juta(200));
    expect(cellValue(b0002, "aset-tetap-perolehan")).toBe(juta(100));
    expect(cellValue(b0002, "aset-tetap-akumulasi-penyusutan")).toBe(juta(40));
    expect(cellValue(b0002, "aset-tetap-jumlah")).toBe(juta(60));
  });

  it("menyeimbangkan Jumlah Aset dengan Jumlah Kewajiban dan Ekuitas", () => {
    const b0002 = form(forms(TAHUN_SEDERHANA), "B0002");
    expect(cellValue(b0002, "aset-jumlah")).toBe(juta(560));
    expect(cellValue(b0002, "kewajiban-ekuitas-jumlah")).toBe(juta(560));
  });

  it("menyajikan laba ditahan B0002 sebagai laba ditahan AKHIR, bukan saldo 3-2100 saja", () => {
    const b0002 = form(forms(TAHUN_SEDERHANA), "B0002");
    // 3-2100 bersaldo 20; laba periode 30 belum ditutup ke sana. Form meminta 50, dan hanya dengan
    // 50 neracanya seimbang.
    expect(cellValue(b0002, "ekuitas-laba-ditahan-laba")).toBe(juta(50));
    expect(cellValue(b0002, "ekuitas-laba-ditahan-rugi")).toBe(0n);
    expect(cellValue(b0002, "ekuitas-jumlah")).toBe(juta(550));
  });

  it("memindahkan saldo negatif ke baris Rugi sebagai bilangan positif", () => {
    const merugi = { ...TAHUN_SEDERHANA, "3-2100": juta(20), "6-1100": juta(600) };
    const b0002 = form(forms(merugi), "B0002");
    // Laba ditahan akhir = 20 + (100 - 60 - 600) = -540.
    expect(cellValue(b0002, "ekuitas-laba-ditahan-laba")).toBe(0n);
    expect(cellValue(b0002, "ekuitas-laba-ditahan-rugi")).toBe(juta(540));
    expect(cellValue(b0002, "ekuitas-jumlah")).toBe(juta(500) - juta(540));
  });

  it("memecah rugi selisih kurs ke baris Rugi (-) dan menyisakan baris Laba nol", () => {
    const b0003 = form(forms({ ...TAHUN_SEDERHANA, "7-1500": -juta(5) }), "B0003");
    expect(cellValue(b0003, "selisih-kurs-laba")).toBe(0n);
    expect(cellValue(b0003, "selisih-kurs-rugi")).toBe(juta(5));
    expect(cellValue(b0003, "lain-lain-jumlah")).toBe(-juta(5));
  });

  it("memecah laba selisih kurs ke baris Laba dan menyisakan baris Rugi nol", () => {
    const b0003 = form(forms({ ...TAHUN_SEDERHANA, "7-1500": juta(5) }), "B0003");
    expect(cellValue(b0003, "selisih-kurs-laba")).toBe(juta(5));
    expect(cellValue(b0003, "selisih-kurs-rugi")).toBe(0n);
    expect(cellValue(b0003, "lain-lain-jumlah")).toBe(juta(5));
  });

  it("menurunkan laba bersih B0003 lewat subtotal, dan hasilnya sama dengan laporan laba rugi", () => {
    const input = statements({ ...TAHUN_SEDERHANA, "7-1500": -juta(5), "8-1100": juta(2) });
    const b0003 = form(buildFormValues(input, 2025), "B0003");
    expect(cellValue(b0003, "pendapatan-operasional-jumlah")).toBe(juta(100));
    expect(cellValue(b0003, "hpp-jumlah")).toBe(juta(60));
    expect(cellValue(b0003, "laba-kotor-uka-tc")).toBe(juta(40));
    expect(cellValue(b0003, "beban-operasional-jumlah")).toBe(juta(10));
    expect(cellValue(b0003, "laba-operasional-bersih")).toBe(juta(30));
    expect(cellValue(b0003, "laba-sebelum-pajak")).toBe(juta(25));
    expect(cellValue(b0003, "laba-bersih")).toBe(input.incomeStatement.netProfit);
    expect(cellValue(b0003, "laba-bersih")).toBe(juta(23));
  });

  it("menjumlahkan subtotal dari baris yang ditunjuknya, bukan menghitung ulang dari akun", () => {
    const b0003 = form(forms(TAHUN_SEDERHANA), "B0003");
    const beban = b0003.rows.find((row) => row.key === "beban-operasional-jumlah")!;
    const trace = beban.cells[0]!.trace;
    expect(trace.kind).toBe("SUBTOTAL");
    if (trace.kind !== "SUBTOTAL") throw new Error("bukan subtotal");
    expect(trace.terms).toHaveLength(9);
    expect(trace.terms.reduce((total, term) => total + BigInt(term.sign) * term.value, 0n)).toBe(beban.cells[0]!.value);
  });

  it("menurunkan saldo akhir B0004 dari saldo awal, laba periode, dan dividen", () => {
    const b0004 = form(forms({ ...TAHUN_SEDERHANA, "3-4100": juta(7) }), "B0004");
    expect(cellValue(b0004, "saldo-awal-positif", "MODAL_DISETOR")).toBe(juta(500));
    expect(cellValue(b0004, "saldo-awal-positif", "LABA_DITAHAN")).toBe(juta(20));
    expect(cellValue(b0004, "saldo-awal-negatif", "LABA_DITAHAN")).toBe(0n);
    expect(cellValue(b0004, "saldo-awal", "JUMLAH")).toBe(juta(520));
    expect(cellValue(b0004, "laba-periode-laba")).toBe(juta(30));
    expect(cellValue(b0004, "laba-periode-rugi")).toBe(0n);
    expect(cellValue(b0004, "dividen", "LABA_DITAHAN")).toBe(juta(7));
    expect(cellValue(b0004, "saldo-akhir", "MODAL_DISETOR")).toBe(juta(500));
    expect(cellValue(b0004, "saldo-akhir", "LABA_DITAHAN")).toBe(juta(43));
    expect(cellValue(b0004, "saldo-akhir", "JUMLAH")).toBe(juta(543));
  });

  it("menutup B0004 pada angka yang sama dengan ekuitas B0002", () => {
    const values = forms({ ...TAHUN_SEDERHANA, "3-4100": juta(7) });
    expect(cellValue(form(values, "B0004"), "saldo-akhir", "JUMLAH")).toBe(cellValue(form(values, "B0002"), "ekuitas-jumlah"));
  });

  it("memberi baris Lain-lain B0004 nilai nol beserta alasannya", () => {
    const b0004 = form(forms(TAHUN_SEDERHANA), "B0004");
    for (const key of ["ekuitas-lain-menambah", "ekuitas-lain-mengurangi"]) {
      const row = b0004.rows.find((candidate) => candidate.key === key)!;
      expect(row.cells[0]!.value).toBe(0n);
      expect(row.alwaysZeroReason).toContain("Belum ada modul");
    }
    expect(cellValue(b0004, "ekuitas-lain", "JUMLAH")).toBe(0n);
  });

  it("memberi tahun buku pada label saldo B0004", () => {
    const b0004 = form(forms(TAHUN_SEDERHANA, 2025), "B0004");
    expect(b0004.rows.find((row) => row.key === "saldo-awal")!.label).toBe("Saldo per tgl 31 Des 2024 (net)");
    expect(b0004.rows.find((row) => row.key === "saldo-akhir")!.label).toBe("Saldo per tanggal 31 Des 2025");
  });

  it("mencatat akun penyusun tiap sel pada penelusurannya", () => {
    const b0002 = form(forms(TAHUN_SEDERHANA), "B0002");
    const kas = b0002.rows.find((row) => row.key === "aset-kas-rp")!.cells[0]!.trace;
    expect(kas).toEqual({ kind: "AKUN", code: "1-1110", accountName: "Kas Rupiah", balance: juta(300) });

    const rugi = b0002.rows.find((row) => row.key === "ekuitas-laba-ditahan-rugi")!.cells[0]!.trace;
    expect(rugi.kind === "EKUITAS" && rugi.used).toBe(false);
    expect(rugi.kind === "EKUITAS" && rugi.accounts).toEqual(["3-2100", "3-4100"]);
  });
});

describe("pemecahan sisi", () => {
  it("menyajikan kedua sisi sebagai bilangan positif dan menolkan sisi yang tidak terpakai", () => {
    expect(sideValue(juta(9), "POSITIF")).toBe(juta(9));
    expect(sideValue(juta(9), "NEGATIF")).toBe(0n);
    expect(sideValue(-juta(9), "POSITIF")).toBe(0n);
    expect(sideValue(-juta(9), "NEGATIF")).toBe(juta(9));
    expect(sideValue(0n, "POSITIF")).toBe(0n);
    expect(sideValue(0n, "NEGATIF")).toBe(0n);
  });
});
