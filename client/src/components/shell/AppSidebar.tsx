import { FOCUS_RING } from "@/components/patterns/tebal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { visibleBackOfficeNavigation, type BackOfficeDestination, type BackOfficeRole } from "@shared/backOfficeNavigation";
import { ChevronRight, LogOut } from "lucide-react";
import { useState } from "react";
import { brandInitials } from "./brand";
import { iconFor, parentIconFor } from "./navigationIcons";

/** Butir aktif Konter Tebal: blok aksen bergaris tinta. Garis transparan pada keadaan biasa mencegah lompatan 2px. */
const activeItem = "border-2 border-transparent data-[active=true]:border-ink data-[active=true]:bg-brand data-[active=true]:text-brand-contrast data-[active=true]:font-bold data-[active=true]:shadow-hard";

/**
 * Induk ditandai aktif bila memuat halaman aktif. Saat terbuka, anaknya sudah membawa blok aksen, jadi
 * induk hanya menebal; pada rel ikon anaknya tidak dirender, sehingga induklah yang mendapat blok aksen.
 */
const parentItem = "border-2 border-transparent data-[active=true]:bg-transparent data-[active=true]:font-bold data-[active=true]:text-ink group-data-[collapsible=icon]:data-[active=true]:border-ink group-data-[collapsible=icon]:data-[active=true]:bg-brand group-data-[collapsible=icon]:data-[active=true]:text-brand-contrast group-data-[collapsible=icon]:data-[active=true]:shadow-hard";

export function AppSidebar({ brand, role, userName, roleLabel, currentPath, onNavigate, onLogout }: {
  brand: string;
  role: BackOfficeRole;
  userName: string;
  roleLabel: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  const groups = visibleBackOfficeNavigation(role);
  return (
    <Sidebar collapsible="icon" className="border-ink group-data-[side=left]:border-r-2">
      <SidebarHeader className="h-header justify-center border-b-2 border-ink px-2">
        <button type="button" onClick={() => onNavigate("/operasional")} className={`flex items-center gap-2 rounded-md px-1 text-left ${FOCUS_RING}`}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-brand font-heading text-label font-extrabold text-brand-contrast shadow-hard">{brandInitials(brand)}</span>
          <span className="truncate font-heading text-body font-extrabold text-ink group-data-[collapsible=icon]:hidden">{brand}</span>
        </button>
      </SidebarHeader>
      <SidebarContent className="gap-0 py-2">
        {/* shrink-0: tanpa ini kelompok diperas oleh kolom flex ketika menu lebih tinggi daripada layar
            (1280×800, peran Shareholder) dan butirnya saling menimpa alih-alih bergulir. */}
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="shrink-0 py-1">
            <SidebarGroupLabel className="h-6 text-label font-extrabold uppercase tracking-wider text-ink-subtle">{group.label}</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => item.children
                ? <NavParent key={item.label} label={item.label} childItems={item.children} currentPath={currentPath} onNavigate={onNavigate} />
                : <NavLeaf key={item.path} item={item} currentPath={currentPath} onNavigate={onNavigate} />)}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t-2 border-ink p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-control">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-second text-label font-bold text-second-contrast">{brandInitials(userName)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-ink">{userName}</span>
                <span className="block truncate text-label text-ink-subtle">{roleLabel}</span>
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onNavigate("/")}>Lihat halaman publik</DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout} className="text-danger focus:text-danger"><LogOut className="mr-2 size-4" />Keluar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavLeaf({ item, currentPath, onNavigate }: { item: BackOfficeDestination; currentPath: string; onNavigate: (path: string) => void }) {
  const Icon = iconFor(item.path);
  const isActive = currentPath === item.path;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} tooltip={item.label} aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(item.path)} className={`h-8 text-body text-ink-muted ${activeItem}`}>
        <Icon className="size-4" />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Terbuka dengan sendirinya bila memuat halaman aktif, supaya tautan langsung tidak menyembunyikan menunya. */
function NavParent({ label, childItems, currentPath, onNavigate }: {
  label: string;
  childItems: BackOfficeDestination[];
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const holdsCurrentPage = childItems.some((child) => child.path === currentPath);
  const [open, setOpen] = useState(holdsCurrentPage);
  const Icon = parentIconFor(label);
  return (
    <Collapsible open={open || holdsCurrentPage} onOpenChange={setOpen} className="group/collapsible" asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={holdsCurrentPage} tooltip={label} className={`h-8 text-body text-ink-muted ${parentItem}`}>
            <Icon className="size-4" />
            <span>{label}</span>
            <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 border-l-2 border-ink">
            {childItems.map((child) => {
              const isActive = currentPath === child.path;
              return (
                <SidebarMenuSubItem key={child.path}>
                  <SidebarMenuSubButton isActive={isActive} aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(child.path)} className={`h-7 cursor-pointer text-body text-ink-muted ${activeItem}`}>
                    <span>{child.label}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
