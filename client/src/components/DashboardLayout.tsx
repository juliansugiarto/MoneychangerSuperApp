import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { ArrowLeftRight, BadgeDollarSign, Banknote, BookOpenCheck, Building2, ChartNoAxesCombined, ChevronRight, ClipboardCheck, ClipboardList, FileSearch, Gauge, Landmark, LayoutDashboard, LogOut, MessageSquareWarning, MessagesSquare, Receipt, Rocket, ShieldAlert, ShieldCheck, ShieldQuestion, UsersRound, Vault, Wallet } from "lucide-react";
import { useState } from "react";
import { backOfficeNavigationGroups, isRoleAllowed, visibleBackOfficeNavigation, type BackOfficeRole } from "@shared/backOfficeNavigation";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const navigationIcons: Record<string, typeof LayoutDashboard> = {
  "/operasional": LayoutDashboard,
  "/operasional/monitoring": Gauge,
  "/operasional/transaksi": ArrowLeftRight,
  "/operasional/transaksi/daftar": ClipboardList,
  "/operasional/nasabah": UsersRound,
  "/operasional/nasabah/daftar": ClipboardList,
  "/operasional/impor-nasabah": FileSearch,
  "/operasional/simulasi": ShieldQuestion,
  "/operasional/stock": Wallet,
  "/operasional/stock/kas-awal": Banknote,
  "/operasional/stock/saat-ini": Wallet,
  "/operasional/stock/opname": ClipboardCheck,
  "/operasional/stock-opname": ClipboardCheck,
  "/operasional/stock/penyesuaian": Vault,
  "/operasional/kurs": BadgeDollarSign,
  "/operasional/perbandingan-kurs": ChartNoAxesCombined,
  "/operasional/pengeluaran": Receipt,
  "/operasional/checklist": ClipboardCheck,
  "/operasional/layanan": MessagesSquare,
  "/operasional/pengaduan": MessageSquareWarning,
  "/operasional/watchlist": ShieldAlert,
  "/operasional/laporan": ChartNoAxesCombined,
  "/operasional/pelaporan-regulator": Landmark,
  "/operasional/audit": FileSearch,
  "/operasional/kesiapan": ShieldCheck,
  "/operasional/pengawasan-direksi": ShieldCheck,
  "/operasional/pengguna": UsersRound,
  "/operasional/profil-perusahaan": Building2,
  "/operasional/go-live": Rocket,
};

/** Parents only expand, so they are keyed by label rather than by a path they do not have. */
const parentIcons: Record<string, typeof LayoutDashboard> = {
  "Nasabah": UsersRound,
  "Uang Kas": Wallet,
  "Kurs": BadgeDollarSign,
};

const iconFor = (path: string) => navigationIcons[path] ?? LayoutDashboard;

/**
 * Header eyebrow + title are derived from the sidebar tree instead of a parallel hand-kept map, so
 * a renamed or regrouped menu entry can never leave the page header showing a stale name.
 */
const pageTitles: Record<string, { eyebrow: string; title: string }> = (() => {
  const titles: Record<string, { eyebrow: string; title: string }> = {};
  for (const group of backOfficeNavigationGroups) {
    for (const item of group.items) {
      for (const leaf of item.children ?? [item]) {
        titles[leaf.path] = { eyebrow: group.label, title: leaf.label };
      }
    }
  }
  // Routes that are reachable but deliberately absent from the sidebar.
  titles["/operasional/stock"] = { eyebrow: "Uang & Kurs", title: "Uang kas" };
  titles["/operasional/stock-opname"] = { eyebrow: "Uang & Kurs", title: "Hitung fisik uang" };
  return titles;
})();

function goTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function roleLabel(role?: string) {
  const labels: Record<string, string> = { STAFF: "Staff", ADMIN: "Admin", CONTROLLER: "Controller", SHAREHOLDER: "Shareholder" };
  return labels[role ?? ""] ?? "Staf operasional";
}

export default function DashboardLayout({ children, minimumRole = "STAFF" }: { children: React.ReactNode; minimumRole?: BackOfficeRole }) {
  const { loading, user, logout } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) return <AccessPanel title="Akses operasional terlindungi." detail="Masuk untuk mengelola transaksi valuta, data nasabah, kas, dan pengawasan. Area ini tidak tersedia bagi pengunjung." action="Masuk sebagai staf" onAction={() => goTo("/login")} />;
  if (user.mustChangePassword) return <AccessPanel title="Ganti kata sandi awal Anda." detail="Sebelum memakai back office, Anda wajib menetapkan kata sandi pribadi yang memenuhi ketentuan keamanan." action="Ganti kata sandi" onAction={() => goTo("/ubah-sandi")} />;
  if (!isRoleAllowed(user.role as BackOfficeRole, minimumRole)) return <AccessPanel title="Kewenangan Anda belum mencukupi." detail={`Halaman ini hanya tersedia untuk ${roleLabel(minimumRole).toLowerCase()} atau peran di atasnya. Hubungi administrator bila akses Anda perlu ditinjau.`} action="Kembali ke ringkasan" onAction={() => goTo("/operasional")} />;

  const currentPath = window.location.pathname;
  const page = pageTitles[currentPath] ?? { eyebrow: "Operasional", title: "Ibukota Valasindo" };
  const visibleGroups = visibleBackOfficeNavigation(user.role as BackOfficeRole);

  return <SidebarProvider>
    <div className="flex min-h-screen w-full bg-[#f4f6fb] text-[#243552]">
      <Sidebar collapsible="icon" className="border-r-0 bg-[#182947] text-white">
        <SidebarHeader className="h-[86px] justify-center border-b border-white/10 px-3">
          <button onClick={() => goTo("/operasional")} className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.06] group-data-[collapsible=icon]:justify-center">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#d7ec75] font-display text-sm text-[#162642] shadow-[0_3px_0_#90a94e]">IV</span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden"><span className="font-display block truncate text-sm text-white">Ibukota Valasindo</span><span className="mt-0.5 block text-[10px] font-bold tracking-[0.15em] text-[#b6c6e2] uppercase">Back office</span></span>
          </button>
        </SidebarHeader>

        <SidebarContent className="px-2 py-4">
          {visibleGroups.map((group) => (
            <section className="mb-5" key={group.label}>
              <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.14em] text-[#9fb2d2] uppercase group-data-[collapsible=icon]:hidden">{group.label}</p>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => item.children
                  ? <NavParent key={item.label} label={item.label} childItems={item.children} currentPath={currentPath} />
                  : <NavLeaf key={item.path} label={item.label} path={item.path} currentPath={currentPath} />)}
              </SidebarMenu>
            </section>
          ))}
          <div className="mx-2 mt-2 rounded-2xl border border-white/10 bg-white/[0.055] p-3 group-data-[collapsible=icon]:hidden"><BookOpenCheck className="size-4 text-[#d7ec75]" /><p className="mt-3 text-xs font-semibold text-white">Urutan kerja harian</p><p className="mt-1 text-[11px] leading-4 text-[#b9c9e3]">Catat kas awal, layani transaksi, kemudian cocokkan persediaan sebelum penutupan.</p></div>
        </SidebarContent>

        <SidebarFooter className="border-t border-white/10 p-3">
          <DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[#d7ec75] group-data-[collapsible=icon]:justify-center"><Avatar className="size-9 shrink-0 border border-white/10 bg-white/10"><AvatarFallback className="bg-[#41577e] text-xs font-bold text-white">{user.name?.charAt(0).toUpperCase() ?? "IV"}</AvatarFallback></Avatar><span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><span className="block truncate text-sm font-semibold text-white">{user.name || "Staf Ibukota"}</span><span className="mt-0.5 block truncate text-[11px] text-[#b9c9e3]">{roleLabel(user.role)}</span></span></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem onClick={() => goTo("/")} className="cursor-pointer">Lihat situs publik</DropdownMenuItem><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 size-4" />Keluar</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#f4f6fb]">
        <BackOfficeHeader eyebrow={page.eyebrow} title={page.title} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </div>
  </SidebarProvider>;
}

const leafClasses = "h-11 rounded-xl px-3 text-[#cdd9ec] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d7ec75] focus-visible:ring-offset-0 data-[active=true]:bg-[#d7ec75] data-[active=true]:font-bold data-[active=true]:text-[#162642] data-[active=true]:shadow-sm";

function NavLeaf({ label, path, currentPath }: { label: string; path: string; currentPath: string }) {
  const Icon = iconFor(path);
  const isActive = currentPath === path;
  return <SidebarMenuItem>
    <SidebarMenuButton isActive={isActive} tooltip={label} aria-current={isActive ? "page" : undefined} onClick={() => goTo(path)} className={leafClasses}>
      <Icon className="size-[18px]" /><span className="text-[14px] font-medium">{label}</span>
    </SidebarMenuButton>
  </SidebarMenuItem>;
}

/**
 * Expands by default when one of its children is the current page, so a deep link never lands the
 * user on a page whose sidebar entry is hidden inside a collapsed section.
 */
function NavParent({ label, childItems, currentPath }: { label: string; childItems: { label: string; path: string }[]; currentPath: string }) {
  const holdsCurrentPage = childItems.some((child) => child.path === currentPath);
  const [open, setOpen] = useState(holdsCurrentPage);
  const Icon = parentIcons[label] ?? LayoutDashboard;

  return <Collapsible open={open || holdsCurrentPage} onOpenChange={setOpen} className="group/collapsible" asChild>
    <SidebarMenuItem>
      <CollapsibleTrigger asChild>
        {/* Marked active while it holds the current page so the collapsed icon rail — where the
            active child is not rendered at all — still shows the user where they are. */}
        <SidebarMenuButton isActive={holdsCurrentPage} tooltip={label} className={leafClasses}>
          <Icon className="size-[18px]" />
          <span className="text-[14px] font-medium">{label}</span>
          <ChevronRight className="ml-auto size-4 transition-transform duration-200 motion-reduce:transition-none group-data-[state=open]/collapsible:rotate-90" />
        </SidebarMenuButton>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub className="mx-3 gap-1 border-white/12 px-0">
          {childItems.map((child) => {
            const isActive = currentPath === child.path;
            return <SidebarMenuSubItem key={child.path}>
              <SidebarMenuSubButton isActive={isActive} aria-current={isActive ? "page" : undefined} onClick={() => goTo(child.path)} className="h-10 cursor-pointer rounded-lg text-[#c3d1e8] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d7ec75] data-[active=true]:bg-[#d7ec75] data-[active=true]:font-bold data-[active=true]:text-[#162642]">
                <span className="text-[14px] font-medium">{child.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>;
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </SidebarMenuItem>
  </Collapsible>;
}

function AccessPanel({ title, detail, action, onAction }: { title: string; detail: string; action: string; onAction: () => void }) {
  return <div className="ink-panel min-h-screen px-4 py-12"><div className="mx-auto flex min-h-[70vh] max-w-md items-center"><div className="w-full rounded-[1.5rem] border border-white/12 bg-white/[0.07] p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-10"><span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#d7ec75] text-[#172744]"><Landmark className="size-6" /></span><p className="mt-6 text-xs font-bold tracking-[0.18em] text-[#d7ec75] uppercase">Back office</p><h1 className="mt-3 font-display text-3xl tracking-tight text-white">{title}</h1><p className="mt-4 text-sm leading-6 text-[#cfdaeb]">{detail}</p><Button onClick={onAction} size="lg" className="press-scale mt-8 w-full bg-[#d7ec75] font-extrabold text-[#172744] hover:bg-[#ecf9aa]">{action}</Button></div></div></div>;
}

function BackOfficeHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  const isMobile = useIsMobile();
  return <header className="sticky top-0 z-30 flex h-[72px] items-center border-b border-[#dce2ec] bg-[#f4f6fb]/88 px-4 backdrop-blur-xl sm:px-6 lg:px-8"><div className="flex items-center gap-3"><SidebarTrigger className="size-9 rounded-xl border border-[#d9e0ec] bg-white text-[#324a74] hover:bg-[#eef2fb]" /><div><p className="text-[11px] font-semibold tracking-wide text-[#75839a]">{isMobile ? "Area staf" : eyebrow}</p><p className="font-display text-sm tracking-tight text-[#263a5b]">{title}</p></div></div><div className="ml-auto hidden items-center gap-2 rounded-full border border-[#d9e0ec] bg-white px-3 py-1.5 sm:flex"><ShieldCheck className="size-3.5 text-[#63995c]" /><span className="text-xs font-semibold text-[#53637c]">Akses berbasis peran</span></div></header>;
}
