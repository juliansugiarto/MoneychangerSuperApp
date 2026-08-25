import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return {
    ...actual,
    getRegulatoryReportingReadiness: vi.fn(),
    listRegulatoryReportPackages: vi.fn(),
    createRegulatoryLkuDraft: vi.fn(),
    prepareRegulatoryReportPackage: vi.fn(),
    approveRegulatoryReportPackage: vi.fn(),
    returnRegulatoryReportPackage: vi.fn(),
    setRegulatoryReportManualDeadline: vi.fn(),
    markRegulatoryReportExported: vi.fn(),
    listFinancialStatementSnapshots: vi.fn(),
    createFinancialStatementSnapshot: vi.fn(),
    createRegulatoryIncidentReport: vi.fn(),
    approveRegulatoryIncidentReport: vi.fn(),
  };
});

import { approveRegulatoryIncidentReport, approveRegulatoryReportPackage, createFinancialStatementSnapshot, createRegulatoryIncidentReport, getRegulatoryReportingReadiness, markRegulatoryReportExported, returnRegulatoryReportPackage, setRegulatoryReportManualDeadline } from "./operations";
import { appRouter } from "./routers";

function createCaller(role: "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER") {
  return appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user: { id: 9, role, mustChangePassword: false } as never });
}

describe("otorisasi pusat pelaporan regulator", () => {
  beforeEach(() => { vi.mocked(getRegulatoryReportingReadiness).mockReset(); vi.mocked(approveRegulatoryReportPackage).mockReset(); vi.mocked(returnRegulatoryReportPackage).mockReset(); vi.mocked(setRegulatoryReportManualDeadline).mockReset(); vi.mocked(markRegulatoryReportExported).mockReset(); vi.mocked(createFinancialStatementSnapshot).mockReset(); vi.mocked(createRegulatoryIncidentReport).mockReset(); vi.mocked(approveRegulatoryIncidentReport).mockReset(); });

  it("memberikan pratinjau hanya kepada Controller atau peran di atasnya", async () => {
    vi.mocked(getRegulatoryReportingReadiness).mockResolvedValue({ lku: {}, financialReadiness: {}, incidentalReadiness: {} } as never);
    await expect(createCaller("STAFF").regulatoryReports.readiness({ from: new Date("2026-08-01"), to: new Date("2026-09-01") })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("CONTROLLER").regulatoryReports.readiness({ from: new Date("2026-08-01"), to: new Date("2026-09-01") })).resolves.toMatchObject({ lku: {} });
  });

  it("membatasi persetujuan hanya kepada Shareholder", async () => {
    await expect(createCaller("CONTROLLER").regulatoryReports.approve({ packageId: 4 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(approveRegulatoryReportPackage).mockResolvedValue({ id: 4, status: "APPROVED" } as never);
    await expect(createCaller("SHAREHOLDER").regulatoryReports.approve({ packageId: 4, notes: "Sudah diperiksa" })).resolves.toMatchObject({ status: "APPROVED" });
  });

  it("membatasi pengembalian kepada Shareholder dan tenggat manual kepada Controller atau Shareholder", async () => {
    await expect(createCaller("CONTROLLER").regulatoryReports.returnForRevision({ packageId: 4, notes: "Periksa ulang sumber." })).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(returnRegulatoryReportPackage).mockResolvedValue({ id: 4, status: "RETURNED" } as never);
    await expect(createCaller("SHAREHOLDER").regulatoryReports.returnForRevision({ packageId: 4, notes: "Periksa ulang sumber." })).resolves.toMatchObject({ status: "RETURNED" });
    expect(returnRegulatoryReportPackage).toHaveBeenCalledWith(4, 9, "Periksa ulang sumber.");

    const dueAt = new Date("2026-08-31T23:59:59.000Z");
    await expect(createCaller("ADMIN").regulatoryReports.setManualDeadline({ packageId: 4, dueAt, notes: "Menunggu rekonsiliasi." })).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(setRegulatoryReportManualDeadline).mockResolvedValue({ id: 4, manualDueAt: dueAt } as never);
    await expect(createCaller("CONTROLLER").regulatoryReports.setManualDeadline({ packageId: 4, dueAt, notes: "Menunggu rekonsiliasi." })).resolves.toMatchObject({ id: 4 });
    expect(setRegulatoryReportManualDeadline).toHaveBeenCalledWith({ packageId: 4, dueAt, notes: "Menunggu rekonsiliasi." }, 9);
  });

  it("memungkinkan Controller mencatat ekspor manual tanpa mengirim ke regulator", async () => {
    vi.mocked(markRegulatoryReportExported).mockResolvedValue({ id: 4, status: "EXPORTED" } as never);
    await expect(createCaller("CONTROLLER").regulatoryReports.markExported({ packageId: 4 })).resolves.toMatchObject({ status: "EXPORTED" });
    expect(markRegulatoryReportExported).toHaveBeenCalledWith(4, 9);
  });

  it("membatasi snapshot keuangan dan draf insidental kepada Controller", async () => {
    const financialInput = { periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-12-31"), sourceLabel: "Trial balance", profitLossRows: [{ code: "01", label: "Penjualan", value: "1" }], balanceSheetRows: [{ code: "101", label: "Kas", value: "1" }], equityRows: [{ code: "01", label: "Modal", value: "1" }] };
    await expect(createCaller("ADMIN").regulatoryReports.financialSnapshots.create(financialInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(createFinancialStatementSnapshot).mockResolvedValue({ id: 3 } as never);
    await expect(createCaller("CONTROLLER").regulatoryReports.financialSnapshots.create(financialInput)).resolves.toMatchObject({ id: 3 });
    vi.mocked(createRegulatoryIncidentReport).mockResolvedValue({ id: 6, status: "DRAFT" } as never);
    await expect(createCaller("CONTROLLER").regulatoryReports.incidents.create({ category: "OTHER", incidentAt: new Date("2026-08-24"), discoveredAt: new Date("2026-08-24"), title: "Gangguan operasional", description: "Uraian gangguan operasional yang perlu ditinjau." })).resolves.toMatchObject({ status: "DRAFT" });
  });

  it("membatasi persetujuan laporan insidental kepada Shareholder", async () => {
    await expect(createCaller("CONTROLLER").regulatoryReports.incidents.approve({ incidentId: 6 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(approveRegulatoryIncidentReport).mockResolvedValue({ id: 6, status: "APPROVED" } as never);
    await expect(createCaller("SHAREHOLDER").regulatoryReports.incidents.approve({ incidentId: 6 })).resolves.toMatchObject({ status: "APPROVED" });
  });
});
