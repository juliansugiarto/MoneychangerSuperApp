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

const activeItem = "data-[active=true]:bg-brand data-[active=true]:text-brand-contrast data-[active=true]:font-semibold";

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
    <Sidebar collapsible="icon" className="border-r border-line bg-surface-raised">
      <SidebarHeader className="h-header justify-center border-b border-line px-2">
        <button type="button" onClick={() => onNavigate("/operasional")} className="flex items-center gap-2 rounded-md px-1 text-left">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-label font-bold text-brand-contrast">{brandInitials(brand)}</span>
          <span className="truncate text-body font-semibold text-ink group-data-[collapsible=icon]:hidden">{brand}</span>
        </button>
      </SidebarHeader>
      <SidebarContent className="gap-0 py-2">
        {/* shrink-0: tanpa ini kelompok diperas oleh kolom flex ketika menu lebih tinggi daripada layar
            (1280×800, peran Shareholder) dan butirnya saling menimpa alih-alih bergulir. */}
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="shrink-0 py-1">
            <SidebarGroupLabel className="h-6 text-label text-ink-subtle">{group.label}</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => item.children
                ? <NavParent key={item.label} label={item.label} childItems={item.children} currentPath={currentPath} onNavigate={onNavigate} />
                : <NavLeaf key={item.path} item={item} currentPath={currentPath} onNavigate={onNavigate} />)}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-line p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-control">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-label font-semibold text-ink">{brandInitials(userName)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{userName}</span>
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
          <SidebarMenuButton tooltip={label} className="h-8 text-body text-ink-muted">
            <Icon className="size-4" />
            <span>{label}</span>
            <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 border-line">
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
