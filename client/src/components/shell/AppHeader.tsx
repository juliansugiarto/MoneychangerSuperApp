import { OUTLINE_BUTTON } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search } from "lucide-react";

/**
 * Kepala 48px: pemicu sidebar, kelompok › judul, dan pencarian ⌘K. Judulnya bukan heading — h1 milik
 * `PageHeader` halaman. Slot pengalih perusahaan (spec §2.4) sengaja belum dirender sampai
 * multi-perusahaan benar-benar ada.
 */
export function AppHeader({ group, title, onOpenSearch }: { group: string; title: string; onOpenSearch: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-header items-center gap-3 border-b-2 border-ink bg-paper px-gutter">
      <SidebarTrigger className="size-8 rounded-lg text-ink hover:bg-surface-sunken" />
      <nav aria-label="Jejak" className="flex min-w-0 items-center gap-1.5 text-body">
        <span className="shrink-0 font-semibold text-ink-subtle">{group}</span>
        <span aria-hidden className="text-ink-subtle">›</span>
        <span aria-current="page" className="truncate font-bold text-ink">{title}</span>
      </nav>
      <Button type="button" variant="outline" onClick={onOpenSearch} className={`ml-auto ${OUTLINE_BUTTON} h-control-sm gap-2 text-ink-muted`}>
        <Search aria-hidden className="size-4" />
        <span>Cari halaman</span>
        <kbd className="rounded border border-line-quiet px-1 text-label text-ink-subtle">⌘K</kbd>
      </Button>
    </header>
  );
}
