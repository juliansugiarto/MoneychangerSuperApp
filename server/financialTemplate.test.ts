import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { createFinancialWorkbookTemplate } from "./financialTemplate";

describe("template workbook laporan keuangan", () => {
  it("membuat tiga form kosong tanpa angka atau contoh data keuangan", () => {
    const workbook = XLSX.read(createFinancialWorkbookTemplate(), { type: "buffer", raw: false });
    expect(workbook.SheetNames).toEqual(["Petunjuk", "B0002 Neraca", "B0003 Laba Rugi", "B0004 Ekuitas"]);
    expect(XLSX.utils.sheet_to_csv(workbook.Sheets.Petunjuk)).toContain("PETUNJUK TEMPLATE LAPORAN KEUANGAN");
    expect(XLSX.utils.sheet_to_csv(workbook.Sheets["B0002 Neraca"])).toContain("FORM B0002");
    expect(XLSX.utils.sheet_to_csv(workbook.Sheets["B0003 Laba Rugi"])).toContain("FORM B0003");
    expect(XLSX.utils.sheet_to_csv(workbook.Sheets["B0004 Ekuitas"])).toContain("FORM B0004");
    expect(XLSX.utils.sheet_to_json(workbook.Sheets["B0002 Neraca"], { header: 1 })).toHaveLength(6);
  });
});
