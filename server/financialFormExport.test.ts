import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildBalanceSheet, buildEquityStatement, buildIncomeStatement, type StatementAccount } from "../shared/financialStatements";
import { buildFormValues, type FormValues } from "../shared/regulatoryFormValues";
import { MissingReporterCodeError, filledRows, renderFormWorkbook, rupiah } from "./financialFormExport";

/** Angka karangan dalam sen, bukan pembukuan siapa pun. */
const juta = (value: number) => BigInt(value) * 1_000_000n;

const SALDO = {
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

const workbook = (balances?: Record<string, bigint>) => renderFormWorkbook(values(balances), { reporterCode: "999999999", fiscalYear: 2025 });
const grid = (sheet: XLSX.WorkSheet) => XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: true });
const at = (rows: unknown[][], row: number, column: number) => rows[row]?.[column] ?? null;

describe("penulis workbook form", () => {
  it("menulis tiga sheet, satu per form", () => {
    expect(workbook().SheetNames).toEqual(["B0002 Neraca", "B0003 Laba Rugi", "B0004 Ekuitas"]);
  });

  it("menulis header yang sama dengan form aslinya pada setiap sheet", () => {
    const book = workbook();
    const expected: [string, string, number][] = [
      ["B0002 Neraca", "B0002", 19],
      ["B0003 Laba Rugi", "B0003", 25],
      ["B0004 Ekuitas", "B0004", 7],
    ];
    for (const [sheetName, code, records] of expected) {
      const rows = grid(book.Sheets[sheetName]!);
      expect(at(rows, 1, 0), sheetName).toBe("Sandi Pelapor :");
      expect(at(rows, 1, 1), sheetName).toBe("999999999");
      expect(at(rows, 2, 0), sheetName).toBe("Periode :");
      expect(at(rows, 2, 1), sheetName).toBe("Tahun");
      expect(at(rows, 3, 1), sheetName).toBe(2025);

      const flat = rows.flat().map((cell) => String(cell));
      expect(flat, sheetName).toContain("Nomor Form :");
      expect(flat, sheetName).toContain(code);
      expect(flat, sheetName).toContain("Jumlah Record :");
      expect(flat, sheetName).toContain(String(records));
      expect(flat, sheetName).toContain("Jenis Periode :");
      expect(rows[3]!.at(-1), `${sheetName} Jenis Periode`).toBe("A");
    }
  });

  it("menolak menulis berkas tanpa Sandi Pelapor, bukan menulis header kosong", () => {
    expect(() => renderFormWorkbook(values(), { reporterCode: "   ", fiscalYear: 2025 })).toThrow(MissingReporterCodeError);
    expect(() => renderFormWorkbook(values(), { reporterCode: "", fiscalYear: 2025 })).toThrow(/Sandi Pelapor/);
  });

  it("menaruh aset di kolom kiri dan kewajiban serta ekuitas di kolom kanan pada B0002", () => {
    const rows = grid(workbook().Sheets["B0002 Neraca"]!);
    const labelsKiri = rows.map((row) => String(row[0] ?? "").trim());
    const labelsKanan = rows.map((row) => String(row[4] ?? "").trim());

    expect(labelsKiri).toContain("ASET");
    expect(labelsKiri).toContain("Jumlah Aset");
    expect(labelsKiri).not.toContain("KEWAJIBAN");

    expect(labelsKanan).toContain("KEWAJIBAN DAN EKUITAS");
    expect(labelsKanan).toContain("EKUITAS");
    expect(labelsKanan).toContain("Jumlah Kewajiban dan Ekuitas");
    expect(labelsKanan).not.toContain("Jumlah Aset");
  });

  it("menulis nominal sebagai angka rupiah, bukan teks dan bukan sen", () => {
    const rows = grid(workbook().Sheets["B0002 Neraca"]!);
    const kas = rows.find((row) => String(row[0] ?? "").trim() === "Kas")!;
    expect(kas[1]).toBe(3_000_000);
    expect(typeof kas[1]).toBe("number");
  });

  it("menyeimbangkan Jumlah Aset dan Jumlah Kewajiban dan Ekuitas pada berkasnya", () => {
    const rows = grid(workbook().Sheets["B0002 Neraca"]!);
    const aset = rows.find((row) => String(row[0] ?? "").trim() === "Jumlah Aset")!;
    const pasiva = rows.find((row) => String(row[4] ?? "").trim() === "Jumlah Kewajiban dan Ekuitas")!;
    expect(aset[2]).toBe(pasiva[6]);
    expect(aset[2]).toBe(5_600_000);
  });

  it("menulis tiga kolom nilai pada B0004 dan satu baris yang mengisi dua di antaranya", () => {
    const rows = grid(workbook({ ...SALDO, "3-4100": juta(7) }).Sheets["B0004 Ekuitas"]!);
    const heading = rows.find((row) => String(row[0] ?? "") === "Keterangan")!;
    expect(heading.slice(0, 4)).toEqual(["Keterangan", "Modal disetor", "Laba ditahan/(akumulasi rugi)", "Jumlah"]);

    const positif = rows.find((row) => String(row[0] ?? "").trim() === "- Saldo Positif")!;
    expect(positif[1]).toBe(5_000_000);
    expect(positif[2]).toBe(200_000);

    const akhir = rows.find((row) => String(row[0] ?? "").trim() === "Saldo per tanggal 31 Des 2025")!;
    expect(akhir[3]).toBe(Number(akhir[1]) + Number(akhir[2]));
  });

  it("mencetak sebanyak Jumlah Record baris berisi pada setiap sheet", () => {
    const book = workbook();
    for (const form of values()) {
      expect(filledRows(form), form.code).toHaveLength(form.recordCount);
    }
    expect(book.SheetNames).toHaveLength(3);
  });

  it("tidak memasang tombol Simpan milik form BI dan tidak menyebut pengiriman otomatis", () => {
    const book = workbook();
    for (const name of book.SheetNames) {
      const text = XLSX.utils.sheet_to_csv(book.Sheets[name]!);
      expect(text).not.toContain("Simpan");
    }
  });
});

describe("nominal sen ke rupiah", () => {
  it("membagi seratus dan mempertahankan dua desimal", () => {
    expect(rupiah(123_456n)).toBe(1234.56);
    expect(rupiah(-500n)).toBe(-5);
    expect(rupiah(0n)).toBe(0);
  });

  it("menolak nominal yang melewati batas aman angka JavaScript", () => {
    expect(() => rupiah(9_007_199_254_740_992n)).toThrow(/terlalu besar/);
  });
});
