import { describe, expect, it } from "vitest";
import { nextRegulatoryReportStatus, validateFinancialStatementSnapshot } from "./operations";

const validInput = {
  profitLossRows: [{ code: "01", label: "Penjualan UKA", value: "4800199675" }],
  balanceSheetRows: [{ code: "101", label: "Kas Rupiah", value: "250000000" }],
  equityRows: [{ code: "01", label: "Saldo positif", value: "250000000" }],
};

describe("snapshot laporan keuangan terkendali", () => {
  it("menerima tiga kelompok pos keuangan yang lengkap dengan nilai desimal sah", () => {
    expect(validateFinancialStatementSnapshot(validInput)).toMatchObject({ valid: true, errors: [], counts: { profitLoss: 1, balanceSheet: 1, equity: 1 } });
  });

  it("menolak kode ganda dan nilai bukan desimal agar snapshot tidak terbentuk", () => {
    const result = validateFinancialStatementSnapshot({ ...validInput, profitLossRows: [{ code: "01", label: "Penjualan", value: "12,000" }, { code: "01", label: "Penjualan lain", value: "0" }] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("kode pos ganda");
    expect(result.errors.join(" ")).toContain("nilai tidak valid");
  });

  it("menahan alur laporan insidental sampai maker dan checker berbeda menyelesaikan workflow", () => {
    const prepared = nextRegulatoryReportStatus({ action: "PREPARE", currentStatus: "DRAFT", actorUserId: 3 });
    expect(() => nextRegulatoryReportStatus({ action: "APPROVE", currentStatus: prepared, preparedByUserId: 3, actorUserId: 3 })).toThrow("tidak dapat menyetujui");
    const approved = nextRegulatoryReportStatus({ action: "APPROVE", currentStatus: prepared, preparedByUserId: 3, actorUserId: 8 });
    expect(nextRegulatoryReportStatus({ action: "EXPORT", currentStatus: approved, actorUserId: 3 })).toBe("EXPORTED");
  });
});
