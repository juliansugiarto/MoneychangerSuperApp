import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { parseFinancialWorkbookBundle } from "./financialImport";
import { getDb } from "./db";
import { simulateArchiveReadiness, simulateClosing, simulateExchange, simulateRateShock } from "./simulation";

const sourceDirectory = "/home/ubuntu/projects/ptibv-5b85b43f";
const source = (name: string) => readFileSync(`${sourceDirectory}/${name}`);
const actualWorkbookFiles = [
  "Balance Sheet 2025.xls",
  "PnL 2025.xls",
  "Equity 2025.xls",
  "Rekap Transaksi 2026.xlsx",
  "Rekap Stok Bulanan.xlsx",
] as const;
const hasActualWorkbookEvidence = actualWorkbookFiles.every((fileName) => existsSync(`${sourceDirectory}/${fileName}`));
const actualWorkbookIt = hasActualWorkbookEvidence ? it : it.skip;

function populatedSheetCount(fileName: string) {
  const workbook = XLSX.read(source(fileName), { type: "buffer", raw: false });
  return workbook.SheetNames.filter((name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "" }).length > 0).length;
}

describe("simulasi satu hari operasional dengan bahan aktual", () => {
  beforeEach(() => vi.mocked(getDb).mockReset());

  actualWorkbookIt("memetakan workbook laporan keuangan aktual hanya di memori tanpa membuat snapshot atau paket", () => {
    const result = parseFinancialWorkbookBundle([
      source("Balance Sheet 2025.xls"),
      source("PnL 2025.xls"),
      source("Equity 2025.xls"),
    ]);

    expect(result.balanceSheetRows).toHaveLength(19);
    expect(result.profitLossRows).toHaveLength(25);
    expect(result.equityRows).toHaveLength(14);
    expect(result.combinedWorkbook.byteLength).toBeGreaterThan(0);
    expect(getDb).not.toHaveBeenCalled();
  });

  actualWorkbookIt("memakai workbook transaksi dan stok aktual hanya sebagai bukti struktur operasi tanpa membaca nilai ke keluaran", () => {
    expect(populatedSheetCount("Rekap Transaksi 2026.xlsx")).toBeGreaterThan(0);
    expect(populatedSheetCount("Rekap Stok Bulanan.xlsx")).toBeGreaterThan(0);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("menjalankan urutan latihan Staff–Supervisor–Controller–Shareholder–Direksi tanpa nomor bon, kas, atau arsip produksi", () => {
    const staffBon = simulateExchange({ foreignAmount: "100", rate: "17700", quoteUnit: "1" });
    const supervisorShock = simulateRateShock({ referenceRate: "17700", proposedRate: "18100", reviewThresholdPercent: "2" });
    const controllerClosing = simulateClosing({ systemBalance: "500", physicalBalance: "495.5" });
    const controllerArchiveBlocked = simulateArchiveReadiness({ closingChecklistComplete: true, stockOpnameReconciled: false });
    const directorArchiveReady = simulateArchiveReadiness({ closingChecklistComplete: true, stockOpnameReconciled: true });

    expect(staffBon).toMatchObject({ isSimulation: true, rupiahAmount: "1770000.00" });
    expect(staffBon).not.toHaveProperty("transactionNumber");
    expect(supervisorShock).toMatchObject({ isSimulation: true, reviewRequired: true, recommendation: "PERLU_REVIEW_MANUSIA" });
    expect(controllerClosing).toMatchObject({ isSimulation: true, reconciliationStatus: "PERLU_DITINJAU" });
    expect(controllerArchiveBlocked).toMatchObject({ isSimulation: true, readyToArchive: false });
    expect(directorArchiveReady).toMatchObject({ isSimulation: true, readyToArchive: true });
    expect(getDb).not.toHaveBeenCalled();
  });
});
