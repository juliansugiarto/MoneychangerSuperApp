import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { backOfficeDestinations, isRoleAllowed, visibleBackOfficeNavigation } from "../shared/backOfficeNavigation";

const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

const pageByPath: Record<string, string> = {
  "/operasional": "OperationsDashboard",
  "/operasional/checklist": "DailyChecklist",
  "/operasional/monitoring": "Monitoring",
  "/operasional/kesiapan": "OperationalReadiness",
  "/operasional/transaksi": "GuidedTransactions",
  "/operasional/transaksi/daftar": "TransactionList",
  "/operasional/simulasi": "SafeSimulation",
  "/operasional/layanan": "ServiceDesk",
  "/operasional/nasabah": "Customers",
  "/operasional/nasabah/daftar": "CustomerList",
  "/operasional/kurs": "Rates",
  "/operasional/perbandingan-kurs": "RateComparison",
  "/operasional/stock": "StockOpname",
  "/operasional/pengaduan": "ConsumerComplaints",
  "/operasional/laporan": "Reports",
  "/operasional/pelaporan-regulator": "RegulatoryReporting",
  "/operasional/audit": "AuditLog",
  "/operasional/pengguna": "UserManagement",
  "/operasional/pengawasan-direksi": "DirectorAcknowledgements",
  "/operasional/go-live": "GoLiveSetup",
  "/operasional/impor-nasabah": "CustomerImport",
};

describe("back-office navigation routes", () => {
  it("registers every destination exposed by the grouped sidebar with its required role", () => {
    for (const destination of backOfficeDestinations) {
      const expectedRoute = destination.minimumRole === "STAFF"
        ? `path="${destination.path}"><OperationsRoute page=`
        : `path="${destination.path}"><OperationsRoute minimumRole="${destination.minimumRole}" page=`;
      expect(appSource).toContain(expectedRoute);
    }
  });

  it("shows each sidebar item only to roles that meet its minimum authority", () => {
    const visibleToStaff = visibleBackOfficeNavigation("STAFF").flatMap((group) => group.items).map((item) => item.path);
    const visibleToAdmin = visibleBackOfficeNavigation("ADMIN").flatMap((group) => group.items).map((item) => item.path);
    const visibleToController = visibleBackOfficeNavigation("CONTROLLER").flatMap((group) => group.items).map((item) => item.path);

    expect(visibleToStaff).not.toContain("/operasional/kurs");
    expect(visibleToStaff).not.toContain("/operasional/monitoring");
    expect(visibleToStaff).not.toContain("/operasional/kesiapan");
    expect(visibleToAdmin).toContain("/operasional/kurs");
    expect(visibleToAdmin).not.toContain("/operasional/kesiapan");
    expect(visibleToAdmin).not.toContain("/operasional/laporan");
    expect(visibleToAdmin).not.toContain("/operasional/pelaporan-regulator");
    expect(visibleToController).toContain("/operasional/kesiapan");
    expect(visibleToController).toContain("/operasional/pelaporan-regulator");
    expect(visibleToController).toEqual(backOfficeDestinations.map((item) => item.path));
    expect(isRoleAllowed("STAFF", "CONTROLLER")).toBe(false);
    expect(isRoleAllowed("CONTROLLER", "ADMIN")).toBe(true);
  });

  it("maps every sidebar destination to its intended operational page", () => {
    for (const destination of backOfficeDestinations) {
      const page = pageByPath[destination.path];
      expect(page).toBeDefined();
      const expectedRoute = destination.minimumRole === "STAFF"
        ? `<Route path="${destination.path}"><OperationsRoute page={<${page} />} /></Route>`
        : `<Route path="${destination.path}"><OperationsRoute minimumRole="${destination.minimumRole}" page={<${page} />} /></Route>`;
      expect(appSource).toContain(expectedRoute);
    }
  });
});
