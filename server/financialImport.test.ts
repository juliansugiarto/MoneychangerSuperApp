import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { importFinancialSnapshotBundle, parseFinancialWorkbook, parseFinancialWorkbookBundle } from "./financialImport";

function formSheet(marker: string, code: string, label: string, value: string) {
  return XLSX.utils.aoa_to_sheet([[`FORM ${marker}`], ["", "", "", "", "Record No", "Pos Akun", "Nilai"], ["", "", "", "", code, label, value]]);
}

describe("impor spreadsheet snapshot keuangan", () => {
  it("memetakan FORM B0002, B0003, dan B0004 menjadi tiga kelompok pos", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, formSheet("B0002", "101", "Kas Rupiah", "250000000"), "Neraca");
    XLSX.utils.book_append_sheet(workbook, formSheet("B0003", "01", "Penjualan UKA", "4800199675"), "Laba Rugi");
    XLSX.utils.book_append_sheet(workbook, formSheet("B0004", "01", "Saldo positif", "250000000"), "Ekuitas");
    const parsed = parseFinancialWorkbook(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
    expect(parsed).toEqual({ profitLossRows: [{ code: "01", label: "Penjualan UKA", value: "4800199675" }], balanceSheetRows: [{ code: "101", label: "Kas Rupiah", value: "250000000" }], equityRows: [{ code: "01", label: "Saldo positif", value: "250000000" }] });
  });

  it("menolak workbook yang tidak memiliki salah satu form keuangan", () => {
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, formSheet("B0002", "101", "Kas Rupiah", "1"), "Neraca");
    expect(() => parseFinancialWorkbook(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }))).toThrow("B0003");
  });

  it("menolak payload yang bukan signature workbook sebelum parser dipanggil", async () => {
    await expect(importFinancialSnapshotBundle({
      actorUserId: 9,
      files: ["B0002", "B0003", "B0004"].map((marker) => ({ dataBase64: Buffer.from(`bukan-${marker}`).toString("base64"), originalFileName: `${marker}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize: Buffer.byteLength(`bukan-${marker}`) })),
    })).rejects.toThrow("workbook XLSX atau XLS yang valid");
  });

  it("memetakan dua kolom nilai FORM B0004 menjadi pos modal dan laba terpisah", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, formSheet("B0002", "101", "Kas Rupiah", "1"), "Neraca"); XLSX.utils.book_append_sheet(workbook, formSheet("B0003", "01", "Penjualan UKA", "1"), "Laba Rugi");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["FORM B0004"], ["", "", "", "", "Record No", "Keterangan", "Modal Disetor", "Laba Ditahan"], ["", "", "", "", "01", "Saldo positif", "250000000", "915147841"]]), "Ekuitas");
    const parsed = parseFinancialWorkbook(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
    expect(parsed.equityRows).toEqual([{ code: "01-MODAL", label: "Saldo positif — Modal disetor", value: "250000000" }, { code: "01-LABA", label: "Saldo positif — Laba ditahan/akumulasi rugi", value: "915147841" }]);
  });

  it("menggabungkan tiga workbook terpisah menjadi satu sumber B0002/B0003/B0004", () => {
    const makeBook = (sheet: XLSX.WorkSheet, name: string) => { const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, name); return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }); };
    const equity = XLSX.utils.aoa_to_sheet([["FORM B0004"], ["", "", "", "", "Record No", "Keterangan", "Modal Disetor", "Laba Ditahan"], ["", "", "", "", "01", "Saldo positif", "1", "2"]]);
    const parsed = parseFinancialWorkbookBundle([makeBook(formSheet("B0002", "101", "Kas Rupiah", "1"), "Neraca"), makeBook(formSheet("B0003", "01", "Penjualan UKA", "1"), "Laba Rugi"), makeBook(equity, "Ekuitas")]);
    expect(parsed.profitLossRows).toHaveLength(1); expect(parsed.balanceSheetRows).toHaveLength(1); expect(parsed.equityRows).toHaveLength(2);
    expect(parseFinancialWorkbook(parsed.combinedWorkbook)).toMatchObject({ profitLossRows: parsed.profitLossRows, balanceSheetRows: parsed.balanceSheetRows, equityRows: parsed.equityRows });
  });

  it("memetakan bundle tanpa menyimpan berkas sampai snapshot benar-benar disimpan", async () => {
    const makeBook = (sheet: XLSX.WorkSheet, name: string) => { const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, name); return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer; };
    const equity = XLSX.utils.aoa_to_sheet([["FORM B0004"], ["", "", "", "", "Record No", "Keterangan", "Modal Disetor", "Laba Ditahan"], ["", "", "", "", "01", "Saldo positif", "1", "2"]]);
    const toUpload = (data: Buffer, originalFileName: string) => ({ dataBase64: data.toString("base64"), originalFileName, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize: data.byteLength });
    const result = await importFinancialSnapshotBundle({ files: [toUpload(makeBook(formSheet("B0002", "101", "Kas Rupiah", "1"), "Neraca"), "b0002.xlsx"), toUpload(makeBook(formSheet("B0003", "01", "Penjualan UKA", "1"), "LabaRugi"), "b0003.xlsx"), toUpload(makeBook(equity, "Ekuitas"), "b0004.xlsx")], actorUserId: 9 });
    expect(result.sourceStorageKey).toBeNull();
    expect(result).toMatchObject({ profitLossRows: [{ code: "01" }], balanceSheetRows: [{ code: "101" }], equityRows: [{ code: "01-MODAL" }, { code: "01-LABA" }] });
  });
});
