import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { auditLogs, financialStatementSnapshots, regulatoryIncidentReports } from "../drizzle/schema";
import { getDb } from "./db";
import { createFinancialStatementSnapshot, createRegulatoryIncidentReport } from "./operations";

let selectedRow: Record<string, unknown>;
const insert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
const update = vi.fn();
const database = {
  insert,
  update,
  select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockImplementation(async () => [selectedRow]) })) })) })),
};

describe("isolasi snapshot keuangan dan laporan insidental", () => {
  beforeEach(() => { insert.mockClear(); update.mockClear(); vi.mocked(getDb).mockResolvedValue(database as never); });

  it("menulis snapshot hanya ke tabel keuangan dan audit tanpa memperbarui data operasional", async () => {
    selectedRow = { id: 21, periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"), sourceLabel: "B0002-B0004", sourceDigest: "digest" };
    await createFinancialStatementSnapshot({ periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"), sourceLabel: "B0002-B0004", profitLossRows: [{ code: "01", label: "Penjualan UKA", value: "1" }], balanceSheetRows: [{ code: "101", label: "Kas Rupiah", value: "1" }], equityRows: [{ code: "01", label: "Saldo positif", value: "1" }] }, 9);
    expect(insert.mock.calls.map(([table]) => table)).toEqual([financialStatementSnapshots, auditLogs]);
    expect(update).not.toHaveBeenCalled();
  });

  it("menulis register insidental hanya ke tabel insidental dan audit tanpa memperbarui data operasional", async () => {
    selectedRow = { id: 22, reportNumber: "INC-20260101-ABC", category: "OTHER", incidentAt: new Date("2026-01-01") };
    await createRegulatoryIncidentReport({ category: "OTHER", incidentAt: new Date("2026-01-01"), discoveredAt: new Date("2026-01-01"), title: "Gangguan operasional", description: "Kejadian aktual yang perlu diperiksa petugas." }, 9);
    expect(insert.mock.calls.map(([table]) => table)).toEqual([regulatoryIncidentReports, auditLogs]);
    expect(update).not.toHaveBeenCalled();
  });
});
