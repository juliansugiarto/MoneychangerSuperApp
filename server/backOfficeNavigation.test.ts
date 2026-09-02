import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { backOfficeDestinations, backOfficeNavigationGroups, isRoleAllowed, visibleBackOfficeDestinations, visibleBackOfficeNavigation } from "../shared/backOfficeNavigation";

const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

const pageByPath: Record<string, string> = {
  "/operasional": "OperationsDashboard",
  "/operasional/monitoring": "Monitoring",
  "/operasional/transaksi": "GuidedTransactions",
  "/operasional/transaksi/daftar": "TransactionList",
  "/operasional/nasabah": "Customers",
  "/operasional/nasabah/daftar": "CustomerList",
  "/operasional/impor-nasabah": "CustomerImport",
  "/operasional/simulasi": "SafeSimulation",
  "/operasional/stock/kas-awal": "StockControl",
  "/operasional/stock/saat-ini": "StockControl",
  "/operasional/stock/opname": "StockControl",
  "/operasional/stock/penyesuaian": "StockControl",
  "/operasional/kurs": "Rates",
  "/operasional/perbandingan-kurs": "RateComparison",
  "/operasional/pengeluaran": "ExpenseEntry",
  "/operasional/checklist": "DailyChecklist",
  "/operasional/layanan": "ServiceDesk",
  "/operasional/pengaduan": "ConsumerComplaints",
  "/operasional/watchlist": "SanctionsWatchlist",
  "/operasional/laporan": "Reports",
  "/operasional/pelaporan-regulator": "RegulatoryReporting",
  "/operasional/audit": "AuditLog",
  "/operasional/kesiapan": "OperationalReadiness",
  "/operasional/pengawasan-direksi": "DirectorAcknowledgements",
  "/operasional/pengguna": "UserManagement",
  "/operasional/profil-perusahaan": "CompanyProfile",
  "/operasional/go-live": "GoLiveSetup",
};

const routeFor = (path: string, minimumRole: string, page: string) =>
  minimumRole === "STAFF"
    ? `<Route path="${path}"><OperationsRoute page={<${page} />} /></Route>`
    : `<Route path="${path}"><OperationsRoute minimumRole="${minimumRole}" page={<${page} />} /></Route>`;

describe("back-office navigation routes", () => {
  it("registers every destination exposed by the grouped sidebar with its required role", () => {
    for (const destination of backOfficeDestinations) {
      const page = pageByPath[destination.path];
      expect(page, `no page mapped for ${destination.path}`).toBeDefined();
      expect(appSource).toContain(routeFor(destination.path, destination.minimumRole, page));
    }
  });

  it("keeps every sidebar row either a leaf or a parent, never both", () => {
    for (const group of backOfficeNavigationGroups) {
      for (const item of group.items) {
        expect(Boolean(item.path) !== Boolean(item.children), `${item.label} must be a leaf or a parent`).toBe(true);
        if (item.children) expect(item.children.length).toBeGreaterThan(0);
      }
    }
  });

  it("shows each sidebar item only to roles that meet its minimum authority", () => {
    const visibleToStaff = visibleBackOfficeDestinations("STAFF");
    const visibleToAdmin = visibleBackOfficeDestinations("ADMIN");
    const visibleToController = visibleBackOfficeDestinations("CONTROLLER");

    expect(visibleToStaff).not.toContain("/operasional/kurs");
    expect(visibleToStaff).not.toContain("/operasional/monitoring");
    expect(visibleToStaff).not.toContain("/operasional/kesiapan");
    expect(visibleToStaff).not.toContain("/operasional/impor-nasabah");
    expect(visibleToStaff).not.toContain("/operasional/stock/penyesuaian");
    expect(visibleToStaff).toContain("/operasional/stock/kas-awal");
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

  it("hides a parent entirely once none of its children are permitted", () => {
    const staffRows = visibleBackOfficeNavigation("STAFF").flatMap((group) => group.items);
    expect(staffRows.map((item) => item.label)).not.toContain("Kurs");

    const staffCash = staffRows.find((item) => item.label === "Uang Kas");
    expect(staffCash?.children?.map((child) => child.path)).toEqual([
      "/operasional/stock/kas-awal",
      "/operasional/stock/saat-ini",
      "/operasional/stock/opname",
    ]);
  });

  it("maps every sidebar destination to its intended operational page", () => {
    for (const destination of backOfficeDestinations) {
      const page = pageByPath[destination.path];
      expect(page).toBeDefined();
      expect(appSource).toContain(routeFor(destination.path, destination.minimumRole, page));
    }
  });
});
