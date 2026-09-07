import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildBalanceSheet, buildEquityStatement, buildIncomeStatement, type StatementAccount } from "../shared/financialStatements";
import { buildFormValues, cellValue, findFormValues, type FormValues } from "../shared/regulatoryFormValues";
import { MissingReporterCodeError, assertFullFiscalYear, renderFormWorkbook, snapshotRows } from "./financialFormExport";
import { officialRows, parseFinancialWorkbook } from "./financialImport";
import { validateFinancialStatementSnapshot } from "./operations";

/**
 * Satu tahun buku penuh, dari buku besar sampai paket regulator.
 *
 * Seluruh angka di sini karangan sendiri; tidak satu pun berasal dari pembukuan perusahaan.
 */

const juta = (value: number) => BigInt(value) * 1_000_000n;

/** Tahun buku yang lengkap: kas, bank, valas, aset tetap, kewajiban, modal, laba, dan pajak. */
const TAHUN_PENUH = {
  "1-1110": juta(170),
  "1-1120": juta(45),
  "1-1210": juta(210),
  "1-1220": juta(16),
  "1-1510": juta(24),
  "1-1520": juta(2),
  "2-1900": juta(4),
  "3-1100": juta(390),
  "3-2100": juta(30),
  "3-4100": juta(5),
  "4-1100": juta(480),
  "4-2100": juta(3),
  "5-1100": juta(8),
  "5-1200": juta(380),
  "5-1300": juta(9),
  "6-1100": juta(36),
  "6-1400": juta(15),
  "6-1700": juta(2),
  "7-1100": juta(1),
  "7-1200": juta(1),
  "7-1500": -juta(4),
  "8-1100": juta(3),
};

function values(balances: Record<string, bigint>, year = 2026): FormValues[] {
  const accounts: StatementAccount[] = Object.entries(balances).map(([accountCode, balance]) => ({ accountCode, balance }));
  const incomeStatement = buildIncomeStatement(accounts, []);
  return buildFormValues(
    {
      incomeStatement,
      balanceSheet: buildBalanceSheet(accounts, [], incomeStatement),
      equityStatement: buildEquityStatement(accounts, [], incomeStatement),
    },
    year,
  );
}

const exported = (balances = TAHUN_PENUH) => {
  const written = values(balances);
  const workbook = renderFormWorkbook(written, { reporterCode: "000000000", fiscalYear: 2026 });
  return { written, workbook, buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer };
};

describe("skenario satu tahun buku penuh", () => {
  it("mengisi ketiga sheet sebanyak Jumlah Record masing-masing", () => {
    const { buffer } = exported();
    const parsed = parseFinancialWorkbook(buffer);
    expect(parsed.balanceSheetRows).toHaveLength(19);
    expect(parsed.profitLossRows).toHaveLength(25);
    expect(parsed.equityRows).toHaveLength(8);
    expect(parsed.skipped).toEqual([]);
  });

  it("menutup neraca: Jumlah Aset sama dengan Jumlah Kewajiban dan Ekuitas", () => {
    const b0002 = findFormValues(values(TAHUN_PENUH), "B0002")!;
    expect(cellValue(b0002, "aset-jumlah")).toBe(cellValue(b0002, "kewajiban-ekuitas-jumlah"));
  });

  it("menutup B0004 pada angka yang sama dengan ekuitas B0002", () => {
    const written = values(TAHUN_PENUH);
    expect(cellValue(findFormValues(written, "B0004")!, "saldo-akhir", "JUMLAH")).toBe(
      cellValue(findFormValues(written, "B0002")!, "ekuitas-jumlah"),
    );
  });

  it("menurunkan laba bersih B0003 yang sama dengan laba periode pada B0004", () => {
    const written = values(TAHUN_PENUH);
    const bersih = cellValue(findFormValues(written, "B0003")!, "laba-bersih");
    const b0004 = findFormValues(written, "B0004")!;
    expect(cellValue(b0004, "laba-periode-laba") - cellValue(b0004, "laba-periode-rugi")).toBe(bersih);
  });

  it("menghasilkan snapshot yang lolos validasi penyimpannya", () => {
    const written = values(TAHUN_PENUH);
    const payload = {
      balanceSheetRows: snapshotRows(findFormValues(written, "B0002")!),
      profitLossRows: snapshotRows(findFormValues(written, "B0003")!),
      equityRows: snapshotRows(findFormValues(written, "B0004")!),
    };
    const summary = validateFinancialStatementSnapshot(payload);
    expect(summary.errors).toEqual([]);
    expect(summary.valid).toBe(true);
    // Paket regulator hanya dapat dibuat dari snapshot yang lolos validasi tanpa galat.
    expect(summary.counts).toEqual({ profitLoss: 25, balanceSheet: 19, equity: 8 });
  });

  it("tidak memperingatkan pendapatan utama hilang pada snapshot bersumber buku besar", () => {
    const written = values(TAHUN_PENUH);
    const summary = validateFinancialStatementSnapshot({
      balanceSheetRows: snapshotRows(findFormValues(written, "B0002")!),
      profitLossRows: snapshotRows(findFormValues(written, "B0003")!),
      equityRows: snapshotRows(findFormValues(written, "B0004")!),
    });
    expect(summary.warnings).toEqual([]);
  });

  it("mengembalikan nilai tiap pos apa adanya sesudah diimpor kembali", () => {
    const { written, buffer } = exported();
    const parsed = parseFinancialWorkbook(buffer);
    const neraca = new Map(parsed.balanceSheetRows.map((row) => [row.code, Number(row.value)]));
    const b0002 = findFormValues(written, "B0002")!;

    for (const key of ["aset-kas-rp", "aset-bank-rp", "aset-kas-uka", "aset-tetap-akumulasi-penyusutan", "kewajiban-lain", "ekuitas-modal-disetor"]) {
      expect(neraca.get(key), key).toBe(Number(cellValue(b0002, key)) / 100);
    }
  });
});

describe("skenario yang gagal dengan benar", () => {
  it("menolak menulis berkas tanpa Sandi Pelapor", () => {
    expect(() => renderFormWorkbook(values(TAHUN_PENUH), { reporterCode: "", fiscalYear: 2026 })).toThrow(MissingReporterCodeError);
  });

  it("menolak rentang yang bukan tahun buku penuh", () => {
    expect(() => assertFullFiscalYear(new Date("2026-01-01T00:00:00Z"), new Date("2026-11-30T00:00:00Z"))).toThrow(/bukan tahun penuh/);
  });

  it("melaporkan pos yang labelnya diubah manusia, bukan menelannya diam-diam", () => {
    const { workbook } = exported();
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["B0002 Neraca"]!, { header: 1, defval: null, raw: true });
    for (const row of rows) {
      if (String(row[0] ?? "").trim() === "Piutang TC") row[0] = "Piutang Traveller Cheque";
    }

    const diubah = officialRows(XLSX.utils.aoa_to_sheet(rows), "B0002");
    expect(diubah.rows).toHaveLength(18);
    expect(diubah.skipped).toHaveLength(1);
    expect(diubah.skipped[0]).toMatchObject({ form: "B0002", label: "Piutang Traveller Cheque" });
  });

  it("tetap menghasilkan berkas berbentuk form meski buku besarnya kosong", () => {
    const { buffer } = exported({});
    const parsed = parseFinancialWorkbook(buffer);
    expect(parsed.balanceSheetRows).toHaveLength(19);
    expect(parsed.balanceSheetRows.every((row) => Number(row.value) === 0)).toBe(true);
    expect(parsed.skipped).toEqual([]);
  });
});
