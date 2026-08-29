import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import OperationsDashboard from "./pages/OperationsDashboard";
import Customers from "./pages/Customers";
import CustomerList from "./pages/CustomerList";
import Rates from "./pages/Rates";
import GuidedTransactions from "./pages/GuidedTransactions";
import StockOpname from "./pages/StockOpname";
import Reports from "./pages/Reports";
import AuditLog from "./pages/AuditLog";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import ConsumerComplaints from "./pages/ConsumerComplaints";
import UserManagement from "./pages/UserManagement";
import ServiceDesk from "./pages/ServiceDesk";
import Monitoring from "./pages/Monitoring";
import DailyChecklist from "./pages/DailyChecklist";
import DirectorAcknowledgements from "./pages/DirectorAcknowledgements";
import CustomerImport from "./pages/CustomerImport";
import GoLiveSetup from "./pages/GoLiveSetup";
import RateComparison from "./pages/RateComparison";
import SafeSimulation from "./pages/SafeSimulation";
import OperationalReadiness from "./pages/OperationalReadiness";
import RegulatoryReporting from "./pages/RegulatoryReporting";

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
      <Route path="/operasional/simulasi"><OperationsRoute page={<SafeSimulation />} /></Route>
      <Route path="/operasional/kesiapan"><OperationsRoute minimumRole="CONTROLLER" page={<OperationalReadiness />} /></Route>
      <Route path="/operasional/kurs"><OperationsRoute minimumRole="ADMIN" page={<Rates />} /></Route>
      <Route path="/operasional/perbandingan-kurs"><OperationsRoute minimumRole="ADMIN" page={<RateComparison />} /></Route>
      <Route path="/operasional/nasabah"><OperationsRoute page={<Customers />} /></Route>
      <Route path="/operasional/nasabah/daftar"><OperationsRoute page={<CustomerList />} /></Route>
      <Route path="/operasional/pengaduan"><OperationsRoute page={<ConsumerComplaints />} /></Route>
      <Route path="/operasional/layanan"><OperationsRoute page={<ServiceDesk />} /></Route>
      <Route path="/operasional/stock"><OperationsRoute page={<StockOpname />} /></Route>
      <Route path="/operasional/stock-opname"><OperationsRoute page={<StockOpname />} /></Route>
      <Route path="/operasional/laporan"><OperationsRoute minimumRole="CONTROLLER" page={<Reports />} /></Route>
      <Route path="/operasional/pelaporan-regulator"><OperationsRoute minimumRole="CONTROLLER" page={<RegulatoryReporting />} /></Route>
      <Route path="/operasional/audit"><OperationsRoute minimumRole="CONTROLLER" page={<AuditLog />} /></Route>
      <Route path="/operasional/pengguna"><OperationsRoute minimumRole="CONTROLLER" page={<UserManagement />} /></Route>
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
