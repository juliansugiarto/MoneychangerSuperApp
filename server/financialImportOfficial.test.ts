import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildBalanceSheet, buildEquityStatement, buildIncomeStatement, type StatementAccount } from "../shared/financialStatements";
import { buildFormValues, type FormValues } from "../shared/regulatoryFormValues";
import { renderFormWorkbook } from "./financialFormExport";
import { officialRows, officialSheetForm, parseFinancialWorkbook, parseFormAmount } from "./financialImport";

const juta = (value: number) => BigInt(value) * 1_000_000n;

const SALDO = {
  "1-1110": juta(300),
  "1-1120": juta(150),
  "1-1210": juta(200),
  "1-1510": juta(100),
  "1-1520": juta(40),
  "2-1900": juta(10),
  "3-1100": juta(500),
  "3-2100": juta(20),
  "4-1100": juta(100),
  "5-1200": juta(60),
  "6-1100": juta(10),
  "7-1500": -juta(5),
};

function values(balances: Record<string, bigint> = SALDO): FormValues[] {
  const accounts: StatementAccount[] = Object.entries(balances).map(([accountCode, balance]) => ({ accountCode, balance }));
  const incomeStatement = buildIncomeStatement(accounts, []);
  return buildFormValues(
    {
      incomeStatement,
      balanceSheet: buildBalanceSheet(accounts, [], incomeStatement),
      equityStatement: buildEquityStatement(accounts, [], incomeStatement),
    },
    2025,
  );
}

const book = (balances?: Record<string, bigint>) => renderFormWorkbook(values(balances), { reporterCode: "999999999", fiscalYear: 2025 });
const buffer = (workbook: XLSX.WorkBook) => XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

describe("mengenali tata letak form resmi", () => {
  it("mengenali sheet resmi lewat penanda Nomor Form dan nomor formnya", () => {
    const workbook = book();
    expect(officialSheetForm(workbook.Sheets["B0002 Neraca"]!)).toBe("B0002");
    expect(officialSheetForm(workbook.Sheets["B0003 Laba Rugi"]!)).toBe("B0003");
    expect(officialSheetForm(workbook.Sheets["B0004 Ekuitas"]!)).toBe("B0004");
  });

  it("tidak mengenali sheet ber-Record No sebagai form resmi", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["FORM B0002"], ["", "", "", "", "Record No", "Pos Akun", "Nilai"], ["", "", "", "", "101", "Kas Rupiah", "1"]]);
    expect(officialSheetForm(sheet)).toBeNull();
  });

  it("membaca sebanyak Jumlah Record pos dari setiap sheet resmi", () => {
    const workbook = book();
    expect(officialRows(workbook.Sheets["B0002 Neraca"]!, "B0002").rows).toHaveLength(19);
    expect(officialRows(workbook.Sheets["B0003 Laba Rugi"]!, "B0003").rows).toHaveLength(25);
    // B0004 memuat tujuh baris, salah satunya mengisi dua kolom sekaligus.
    expect(officialRows(workbook.Sheets["B0004 Ekuitas"]!, "B0004").rows).toHaveLength(8);
  });

  it("membedakan dua baris berlabel sama lewat judul kelompoknya", () => {
    const { rows } = officialRows(book().Sheets["B0002 Neraca"]!, "B0002");
    const bankRp = rows.find((row) => row.code === "aset-bank-rp")!;
    const bankUka = rows.find((row) => row.code === "aset-bank-uka")!;
    expect(bankRp.value).toBe("1500000.00");
    expect(bankUka.value).toBe("0.00");
  });

  it("membedakan dua baris Laba pada B0003 lewat judul kelompoknya", () => {
    const { rows } = officialRows(book().Sheets["B0003 Laba Rugi"]!, "B0003");
    expect(rows.find((row) => row.code === "selisih-kurs-rugi")!.value).toBe("50000.00");
    expect(rows.find((row) => row.code === "selisih-kurs-laba")!.value).toBe("0.00");
    expect(rows.find((row) => row.code === "jual-aset-tetap-rugi")!.value).toBe("0.00");
  });

  it("membaca baris B0004 yang mengisi dua kolom sebagai dua pos", () => {
    const { rows } = officialRows(book().Sheets["B0004 Ekuitas"]!, "B0004");
    expect(rows.find((row) => row.code === "saldo-awal-positif:MODAL_DISETOR")!.value).toBe("5000000.00");
    expect(rows.find((row) => row.code === "saldo-awal-positif:LABA_DITAHAN")!.value).toBe("200000.00");
    expect(rows.find((row) => row.code === "saldo-awal-negatif")!.value).toBe("0.00");
  });

  it("tidak melaporkan judul kelompok maupun subtotal sebagai pos tidak dikenal", () => {
    for (const [sheet, code] of [["B0002 Neraca", "B0002"], ["B0003 Laba Rugi", "B0003"], ["B0004 Ekuitas", "B0004"]] as const) {
      expect(officialRows(book().Sheets[sheet]!, code).skipped, code).toEqual([]);
    }
  });

  it("mengembalikan pos yang labelnya diubah manusia beserta labelnya, bukan mengabaikannya", () => {
    const workbook = book();
    const sheet = workbook.Sheets["B0003 Laba Rugi"]!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
    for (const row of rows) {
      if (String(row[0] ?? "").trim() === "Penjualan UKA") row[0] = "        Penjualan Valas Asing";
    }
    const diubah = XLSX.utils.aoa_to_sheet(rows);

    const result = officialRows(diubah, "B0003");
    expect(result.rows).toHaveLength(24);
    expect(result.skipped).toEqual([{ form: "B0003", heading: "Pendapatan Operasional", label: "Penjualan Valas Asing" }]);
  });

  it("membaca berkas hasil ekspornya sendiri lewat parseFinancialWorkbook", () => {
    const parsed = parseFinancialWorkbook(buffer(book()));
    expect(parsed.balanceSheetRows).toHaveLength(19);
    expect(parsed.profitLossRows).toHaveLength(25);
    expect(parsed.equityRows).toHaveLength(8);
    expect(parsed.skipped).toEqual([]);
  });

  it("menolak sheet resmi yang tidak memuat satu pun pos dikenal", () => {
    const kosong = XLSX.utils.aoa_to_sheet([["Laporan Keuangan Neraca"], ["Sandi Pelapor :", "1", "", "", "Nomor Form :", "B0002"], ["Entah apa", 1]]);
    expect(() => officialRows(kosong, "B0002")).toThrow(/tidak menemukan satu pun pos/i);
  });
});

describe("nominal berformat Indonesia", () => {
  it("membaca angka apa adanya", () => {
    expect(parseFormAmount(1234.56)).toBe(1234.56);
    expect(parseFormAmount(0)).toBe(0);
  });

  it("membaca teks berformat rupiah dengan titik ribuan dan koma desimal", () => {
    expect(parseFormAmount("Rp. 1.492.483.446,00")).toBe(1_492_483_446);
    expect(parseFormAmount("Rp 500.000.000")).toBe(500_000_000);
    expect(parseFormAmount("1.234,50")).toBe(1234.5);
  });

  it("membaca tanda kurang dan tanda kurung sebagai bilangan negatif", () => {
    expect(parseFormAmount("-1.000")).toBe(-1000);
    expect(parseFormAmount("(2.500,25)")).toBe(-2500.25);
  });

  it("mengembalikan null untuk sel yang bukan nominal", () => {
    expect(parseFormAmount(null)).toBeNull();
    expect(parseFormAmount("")).toBeNull();
    expect(parseFormAmount("Kas Rupiah")).toBeNull();
    expect(parseFormAmount("Tahun")).toBeNull();
  });
});
