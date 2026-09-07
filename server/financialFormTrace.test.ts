import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildBalanceSheet, buildEquityStatement, buildIncomeStatement, type StatementAccount } from "../shared/financialStatements";
import { buildFormValues, type FormValues } from "../shared/regulatoryFormValues";
import { filledRows, renderFormWorkbook, renderTraceSheet } from "./financialFormExport";

const juta = (value: number) => BigInt(value) * 1_000_000n;

const SALDO = {
  "1-1110": juta(300),
  "1-1510": juta(100),
  "1-1520": juta(40),
  "3-1100": juta(500),
  "3-2100": juta(20),
  "4-1100": juta(100),
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

type Baris = { form: string; pos: string; kolom: string; sumber: string; akun: string; nama: string; saldo: number; nilai: number; keterangan: string };

function trace(balances?: Record<string, bigint>): Baris[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(renderTraceSheet(values(balances)), { header: 1, defval: null });
  const header = rows.findIndex((row) => row[0] === "Form");
  return rows.slice(header + 1).map((row) => ({
    form: String(row[0]), pos: String(row[1]), kolom: String(row[2]), sumber: String(row[3]),
    akun: String(row[4]), nama: String(row[5]), saldo: Number(row[6]), nilai: Number(row[7]),
    keterangan: String(row[8] ?? ""),
  }));
}

describe("lembar penelusuran", () => {
  it("ikut ditulis pada workbook, sesudah ketiga form", () => {
    const book = renderFormWorkbook(values(), { reporterCode: "999999999", fiscalYear: 2025 });
    expect(book.SheetNames).toEqual(["B0002 Neraca", "B0003 Laba Rugi", "B0004 Ekuitas", "Penelusuran"]);
  });

  it("memuat satu baris untuk setiap sel berisi pada ketiga form", () => {
    // Baris `Pembagian dividen (-/-)` pada B0004 membawa satu sel nilai dan satu sel Jumlah yang
    // dihitung; hanya sel nilainya yang punya akun untuk ditelusuri.
    const expected = values().reduce(
      (total, form) =>
        total + filledRows(form).reduce((count, row) => count + row.cells.filter((cell) => cell.trace.kind !== "SUBTOTAL").length, 0),
      0,
    );
    expect(trace()).toHaveLength(expected);
  });

  it("menyebut akun penyusun beserta saldonya untuk pos bersaldo akun", () => {
    const kas = trace().find((row) => row.form === "B0002" && row.pos === "Kas")!;
    expect(kas.sumber).toBe("Saldo akun");
    expect(kas.akun).toBe("1-1110");
    expect(kas.nama).toBe("Kas Rupiah");
    expect(kas.saldo).toBe(3_000_000);
    expect(kas.nilai).toBe(3_000_000);
  });

  it("menyebut saldo bertanda dan sisi mana yang terpakai pada baris pecahan", () => {
    const baris = trace().filter((row) => row.form === "B0003" && row.akun === "7-1500");
    expect(baris).toHaveLength(2);

    const rugi = baris.find((row) => row.sumber === "Sisi negatif")!;
    expect(rugi.saldo).toBe(-50_000);
    expect(rugi.nilai).toBe(50_000);
    expect(rugi.keterangan).toContain("jatuh pada sisi ini");

    const laba = baris.find((row) => row.sumber === "Sisi positif")!;
    expect(laba.nilai).toBe(0);
    expect(laba.keterangan).toContain("jatuh pada sisi lain");
  });

  it("menjelaskan dari mana laba ditahan akhir B0002 berasal", () => {
    const laba = trace().find((row) => row.form === "B0002" && row.pos === "- Laba")!;
    expect(laba.sumber).toBe("Pos ekuitas");
    expect(laba.akun).toBe("3-2100, 3-4100");
    expect(laba.nama).toContain("laba periode - dividen");
  });

  it("menyebutkan alasan pada baris yang memang selalu nol", () => {
    const menambah = trace().find((row) => row.form === "B0004" && row.pos === "- Menambah Ekuitas")!;
    expect(menambah.nilai).toBe(0);
    expect(menambah.keterangan).toContain("Belum ada modul");
  });

  it("mencantumkan kolom pada baris B0004 yang mengisi dua kolom sekaligus", () => {
    const positif = trace().filter((row) => row.form === "B0004" && row.pos === "- Saldo Positif");
    expect(positif.map((row) => row.kolom).sort()).toEqual(["LABA_DITAHAN", "MODAL_DISETOR"]);
  });

  it("tidak menulis baris untuk subtotal — subtotal dihitung, bukan bersumber akun", () => {
    expect(trace().some((row) => row.pos === "Jumlah Aset")).toBe(false);
    expect(trace().some((row) => row.pos.startsWith("Laba/(Rugi) Bersih"))).toBe(false);
  });

  it("menyatakan bahwa berkasnya tidak dikirim ke BI oleh aplikasi", () => {
    const text = XLSX.utils.sheet_to_csv(renderTraceSheet(values()));
    expect(text).toContain("tidak dikirim ke Bank Indonesia oleh aplikasi");
  });
});
