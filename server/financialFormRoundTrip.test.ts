import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildBalanceSheet, buildEquityStatement, buildIncomeStatement, type StatementAccount } from "../shared/financialStatements";
import { buildFormValues, type FormValues } from "../shared/regulatoryFormValues";
import { REGULATORY_FORMS, isValueCell } from "../shared/regulatoryForms";
import { filledRows, renderFormWorkbook, rupiah } from "./financialFormExport";
import { parseFinancialWorkbook, type ImportedFinancialRow } from "./financialImport";

/**
 * Bukti bahwa penulis dan pembaca memakai tata letak yang sama.
 *
 * Tanpa uji ini keduanya dapat berpisah diam-diam, dan berpisahnya baru ketahuan saat sebuah berkas
 * ditolak regulator. Seluruh angka di sini karangan sendiri.
 */

const juta = (value: number) => BigInt(value) * 1_000_000n;

function values(balances: Record<string, bigint>): FormValues[] {
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

function roundTrip(balances: Record<string, bigint>) {
  const written = values(balances);
  const workbook = renderFormWorkbook(written, { reporterCode: "999999999", fiscalYear: 2025 });
  const parsed = parseFinancialWorkbook(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer);
  return { written, parsed };
}

/** Nilai yang ditulis, dikunci sama seperti yang dikembalikan importir. */
function expectedByCode(written: FormValues[]) {
  const expected = new Map<string, number>();
  for (const form of written) {
    const structure = REGULATORY_FORMS.find((candidate) => candidate.code === form.code)!;
    for (const row of filledRows(form)) {
      const cells = row.cells.filter((cell, index) => isValueCell(structure.rows.find((candidate) => candidate.key === row.key)!.cells[index]!));
      for (const cell of cells) {
        expected.set(cells.length > 1 ? `${row.key}:${cell.column}` : row.key, rupiah(cell.value));
      }
    }
  }
  return expected;
}

const asNumbers = (rows: ImportedFinancialRow[]) => new Map(rows.map((row) => [row.code, Number(row.value)]));

const SEDERHANA = {
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

describe("pulang-pergi ekspor lalu impor", () => {
  it("mengembalikan nilai tiap pos persis seperti yang ditulis", () => {
    const { written, parsed } = roundTrip(SEDERHANA);
    const expected = expectedByCode(written);
    const actual = new Map([...asNumbers(parsed.balanceSheetRows), ...asNumbers(parsed.profitLossRows), ...asNumbers(parsed.equityRows)]);

    expect(actual.size).toBe(expected.size);
    for (const [code, value] of expected) {
      expect(actual.get(code), `pos ${code}`).toBe(value);
    }
  });

  it("mengembalikan sebanyak Jumlah Record pos untuk tiap form", () => {
    const { parsed } = roundTrip(SEDERHANA);
    expect(parsed.balanceSheetRows).toHaveLength(19);
    expect(parsed.profitLossRows).toHaveLength(25);
    // Tujuh baris B0004, salah satunya mengisi dua kolom.
    expect(parsed.equityRows).toHaveLength(8);
    expect(parsed.skipped).toEqual([]);
  });

  it("tidak kehilangan pos bernilai nol dalam penulisan maupun pembacaan", () => {
    const { parsed } = roundTrip(SEDERHANA);
    const nol = asNumbers(parsed.profitLossRows);
    expect(nol.get("pencairan-tc")).toBe(0);
    expect(nol.get("beban-asuransi")).toBe(0);
    expect(nol.get("jual-aset-tetap-laba")).toBe(0);
    expect(nol.get("taksiran-pajak-penghasilan")).toBe(0);
  });

  it("mempertahankan pos bertanda negatif sebagai bilangan positif pada sisinya", () => {
    const { written, parsed } = roundTrip({ ...SEDERHANA, "7-1500": -juta(5), "7-1400": juta(3) });
    const expected = expectedByCode(written);
    const actual = asNumbers(parsed.profitLossRows);

    expect(actual.get("selisih-kurs-rugi")).toBe(50_000);
    expect(actual.get("selisih-kurs-laba")).toBe(0);
    expect(actual.get("jual-aset-tetap-laba")).toBe(30_000);
    expect(actual.get("jual-aset-tetap-rugi")).toBe(0);
    for (const code of ["selisih-kurs-rugi", "selisih-kurs-laba", "jual-aset-tetap-laba", "jual-aset-tetap-rugi"]) {
      expect(actual.get(code), code).toBe(expected.get(code));
    }
  });

  it("mempertahankan tahun buku yang merugi, termasuk laba ditahan negatif", () => {
    const { written, parsed } = roundTrip({ ...SEDERHANA, "6-1100": juta(900) });
    const expected = expectedByCode(written);
    const neraca = asNumbers(parsed.balanceSheetRows);

    expect(neraca.get("ekuitas-laba-ditahan-laba")).toBe(0);
    expect(neraca.get("ekuitas-laba-ditahan-rugi")).toBeGreaterThan(0);
    expect(neraca.get("ekuitas-laba-ditahan-rugi")).toBe(expected.get("ekuitas-laba-ditahan-rugi"));

    const ekuitas = asNumbers(parsed.equityRows);
    expect(ekuitas.get("laba-periode-laba")).toBe(0);
    expect(ekuitas.get("laba-periode-rugi")).toBe(expected.get("laba-periode-rugi"));
  });

  it("mempertahankan dua kolom B0004 pada baris yang mengisi keduanya", () => {
    const { written, parsed } = roundTrip({ ...SEDERHANA, "3-4100": juta(7) });
    const expected = expectedByCode(written);
    const ekuitas = asNumbers(parsed.equityRows);

    expect(ekuitas.get("saldo-awal-positif:MODAL_DISETOR")).toBe(expected.get("saldo-awal-positif:MODAL_DISETOR"));
    expect(ekuitas.get("saldo-awal-positif:LABA_DITAHAN")).toBe(expected.get("saldo-awal-positif:LABA_DITAHAN"));
    expect(ekuitas.get("dividen")).toBe(70_000);
  });

  it("mempertahankan nominal berdesimal, bukan membulatkannya ke rupiah penuh", () => {
    const { parsed } = roundTrip({ ...SEDERHANA, "1-1110": juta(300) + 57n });
    expect(asNumbers(parsed.balanceSheetRows).get("aset-kas-rp")).toBe(3_000_000.57);
  });
});
