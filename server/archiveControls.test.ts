import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reports = readFileSync(new URL("../client/src/pages/Reports.tsx", import.meta.url), "utf8");
const transactions = readFileSync(new URL("../client/src/pages/Transactions.tsx", import.meta.url), "utf8");
const guidedTransactions = readFileSync(new URL("../client/src/pages/GuidedTransactions.tsx", import.meta.url), "utf8");
const dailyChecklist = readFileSync(new URL("../client/src/pages/DailyChecklist.tsx", import.meta.url), "utf8");

describe("physical archive controls", () => {
  it("offers a printable PDF path for live reports and their outlet closing recap", () => {
    expect(reports).toContain("Ekspor PDF / cetak");
    expect(reports).toContain("Simpan sebagai PDF");
    expect(reports).toContain("window.print()");
    expect(reports).toContain("Stock opname");
  });

  it("keeps live receipt archiving separate from the training simulation", () => {
    expect(transactions).toContain("printBon");
    expect(transactions).toContain("window.print()");
    expect(guidedTransactions).toContain("Arsip bon nyata");
    expect(guidedTransactions).toContain("Hasil Simulasi Aman tidak pernah masuk daftar ini");
  });

  it("offers a dedicated printable outlet-closing archive only after the real closing checklist is complete", () => {
    expect(dailyChecklist).toContain("ARSIP RINGKASAN PENUTUPAN OUTLET");
    expect(dailyChecklist).toContain("Stock opname & rekonsiliasi");
    expect(dailyChecklist).toContain("Arsip PDF penutupan");
    expect(dailyChecklist).toContain("!closingComplete || !checklist?.closingCompletedAt");
    expect(dailyChecklist).toContain("window.print()");
  });
});
