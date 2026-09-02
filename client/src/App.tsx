import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";

// Every operational page loads on demand, split into its own chunk — none of these are needed for
// the public landing page or login, so there's no reason to ship them in the main bundle upfront.
const NotFound = lazy(() => import("@/pages/NotFound"));
const OperationsDashboard = lazy(() => import("./pages/OperationsDashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerList = lazy(() => import("./pages/CustomerList"));
const Rates = lazy(() => import("./pages/Rates"));
const GuidedTransactions = lazy(() => import("./pages/GuidedTransactions"));
const TransactionList = lazy(() => import("./pages/TransactionList"));
const StockControl = lazy(() => import("./pages/StockControl"));
const Reports = lazy(() => import("./pages/Reports"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const ConsumerComplaints = lazy(() => import("./pages/ConsumerComplaints"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const ServiceDesk = lazy(() => import("./pages/ServiceDesk"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const DailyChecklist = lazy(() => import("./pages/DailyChecklist"));
const DirectorAcknowledgements = lazy(() => import("./pages/DirectorAcknowledgements"));
const CustomerImport = lazy(() => import("./pages/CustomerImport"));
const GoLiveSetup = lazy(() => import("./pages/GoLiveSetup"));
const RateComparison = lazy(() => import("./pages/RateComparison"));
const SafeSimulation = lazy(() => import("./pages/SafeSimulation"));
const OperationalReadiness = lazy(() => import("./pages/OperationalReadiness"));
const RegulatoryReporting = lazy(() => import("./pages/RegulatoryReporting"));
const CompanyProfile = lazy(() => import("./pages/CompanyProfile"));
const ExpenseEntry = lazy(() => import("./pages/ExpenseEntry"));

function RouteLoading() {
  return <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#475569]">Memuat halaman…</div>;
}

function OperationsRoute({ page, minimumRole = "STAFF" }: { page: React.ReactNode; minimumRole?: "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER" }) {
  return (
    <DashboardLayout minimumRole={minimumRole}>
      {page}
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/ubah-sandi" component={ChangePassword} />
      <Route path="/operasional"><OperationsRoute page={<OperationsDashboard />} /></Route>
      <Route path="/operasional/checklist"><OperationsRoute page={<DailyChecklist />} /></Route>
      <Route path="/operasional/monitoring"><OperationsRoute minimumRole="CONTROLLER" page={<Monitoring />} /></Route>
      <Route path="/operasional/transaksi"><OperationsRoute page={<GuidedTransactions />} /></Route>
      <Route path="/operasional/transaksi/daftar"><OperationsRoute page={<TransactionList />} /></Route>
      <Route path="/operasional/simulasi"><OperationsRoute page={<SafeSimulation />} /></Route>
      <Route path="/operasional/kesiapan"><OperationsRoute minimumRole="CONTROLLER" page={<OperationalReadiness />} /></Route>
      <Route path="/operasional/kurs"><OperationsRoute minimumRole="ADMIN" page={<Rates />} /></Route>
      <Route path="/operasional/perbandingan-kurs"><OperationsRoute minimumRole="ADMIN" page={<RateComparison />} /></Route>
      <Route path="/operasional/nasabah"><OperationsRoute page={<Customers />} /></Route>
      <Route path="/operasional/nasabah/daftar"><OperationsRoute page={<CustomerList />} /></Route>
      <Route path="/operasional/pengaduan"><OperationsRoute page={<ConsumerComplaints />} /></Route>
      <Route path="/operasional/layanan"><OperationsRoute page={<ServiceDesk />} /></Route>
      <Route path="/operasional/stock"><OperationsRoute page={<StockControl />} /></Route>
      <Route path="/operasional/stock/kas-awal"><OperationsRoute page={<StockControl />} /></Route>
      <Route path="/operasional/stock/saat-ini"><OperationsRoute page={<StockControl />} /></Route>
      <Route path="/operasional/stock/opname"><OperationsRoute page={<StockControl />} /></Route>
      <Route path="/operasional/stock-opname"><OperationsRoute page={<StockControl />} /></Route>
      <Route path="/operasional/stock/penyesuaian"><OperationsRoute page={<StockControl />} /></Route>
      <Route path="/operasional/laporan"><OperationsRoute minimumRole="CONTROLLER" page={<Reports />} /></Route>
      <Route path="/operasional/pelaporan-regulator"><OperationsRoute minimumRole="CONTROLLER" page={<RegulatoryReporting />} /></Route>
      <Route path="/operasional/audit"><OperationsRoute minimumRole="CONTROLLER" page={<AuditLog />} /></Route>
      <Route path="/operasional/pengguna"><OperationsRoute minimumRole="CONTROLLER" page={<UserManagement />} /></Route>
      <Route path="/operasional/profil-perusahaan"><OperationsRoute minimumRole="CONTROLLER" page={<CompanyProfile />} /></Route>
      <Route path="/operasional/pengeluaran"><OperationsRoute page={<ExpenseEntry />} /></Route>
      <Route path="/operasional/pengawasan-direksi"><OperationsRoute minimumRole="CONTROLLER" page={<DirectorAcknowledgements />} /></Route>
      <Route path="/operasional/go-live"><OperationsRoute minimumRole="CONTROLLER" page={<GoLiveSetup />} /></Route>
      <Route path="/operasional/impor-nasabah"><OperationsRoute minimumRole="CONTROLLER" page={<CustomerImport />} /></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Suspense fallback={<RouteLoading />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
