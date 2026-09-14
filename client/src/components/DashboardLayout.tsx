import { useAuth } from "@/_core/hooks/useAuth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { trpc } from "@/lib/trpc";
import type { BackOfficeRole } from "@shared/backOfficeNavigation";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { AccessPanel } from "./shell/AccessPanel";
import { accessStateFor } from "./shell/accessState";
import { AppHeader } from "./shell/AppHeader";
import { AppSidebar } from "./shell/AppSidebar";
import { brandName } from "./shell/brand";
import { CommandPalette } from "./shell/CommandPalette";
import { pageTitleFor } from "./shell/pageTitle";
import { useShortcuts } from "./shell/shortcuts";

function goTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const ROLE_LABELS: Record<string, string> = { STAFF: "Staf", ADMIN: "Admin", CONTROLLER: "Controller", SHAREHOLDER: "Pemegang Saham" };

/** Lebar sidebar 232px (spec desain ulang §2.2); `SidebarProvider` menggabungkan `style` di atas bawaannya. */
const SHELL_STYLE = { "--sidebar-width": "14.5rem" } as CSSProperties;

/**
 * Shell back office. Halaman yang belum dibangun ulang dirender apa adanya di area isi — itulah
 * pendekatan A yang disetujui: modul lama dan baru hidup berdampingan sampai modulnya tiba.
 */
export default function DashboardLayout({ children, minimumRole = "STAFF" }: { children: ReactNode; minimumRole?: BackOfficeRole }) {
  const { loading, user, logout } = useAuth();
  const access = accessStateFor({ loading, user }, minimumRole);
  const profile = trpc.companyProfile.get.useQuery(undefined, { enabled: access === "ALLOWED", staleTime: 5 * 60_000 });
  const [paletteOpen, setPaletteOpen] = useState(false);
  useShortcuts({
    openPalette: () => { if (access === "ALLOWED") setPaletteOpen(true); },
    newTransaction: () => { if (access === "ALLOWED") goTo("/operasional/transaksi"); },
  });

  if (access === "LOADING") return <DashboardLayoutSkeleton />;
  if (access === "SIGNED_OUT") return <AccessPanel title="Silakan masuk dulu" detail="Halaman ini hanya untuk staf. Masuk dengan akun yang diberikan pemilik usaha Anda." action="Masuk" onAction={() => goTo("/login")} />;
  if (access === "MUST_CHANGE_PASSWORD") return <AccessPanel title="Ganti kata sandi awal Anda" detail="Sebelum mulai bekerja, buat kata sandi pribadi yang hanya Anda ketahui." action="Ganti kata sandi" onAction={() => goTo("/ubah-sandi")} />;
  if (access === "FORBIDDEN") return <AccessPanel title="Halaman ini bukan untuk peran Anda" detail={`Hanya ${ROLE_LABELS[minimumRole]} ke atas yang dapat membukanya. Minta pemilik usaha meninjau akses Anda bila perlu.`} action="Kembali ke Hari Ini" onAction={() => goTo("/operasional")} />;

  const currentPath = window.location.pathname;
  const page = pageTitleFor(currentPath);
  const brand = brandName(profile.data);

  return (
    <SidebarProvider style={SHELL_STYLE}>
      <AppSidebar
        brand={brand}
        role={user!.role as BackOfficeRole}
        userName={user!.name || user!.username || "Pengguna"}
        roleLabel={ROLE_LABELS[user!.role] ?? user!.role}
        currentPath={currentPath}
        onNavigate={goTo}
        onLogout={logout}
      />
      <SidebarInset className="min-w-0 bg-surface">
        <AppHeader group={page.group} title={page.title} onOpenSearch={() => setPaletteOpen(true)} />
        <main className="min-w-0 flex-1 px-gutter py-4">{children}</main>
      </SidebarInset>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={user!.role as BackOfficeRole} onNavigate={goTo} />
    </SidebarProvider>
  );
}
