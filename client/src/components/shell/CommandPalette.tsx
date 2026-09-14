import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { paletteEntries } from "@shared/commandPalette";
import type { BackOfficeRole } from "@shared/backOfficeNavigation";
import { useMemo } from "react";
import { iconFor } from "./navigationIcons";

/** ⌘K: membuka halaman mana pun yang diizinkan peran. Penyaringan diserahkan ke cmdk lewat `value`. */
export function CommandPalette({ open, onOpenChange, role, onNavigate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: BackOfficeRole;
  onNavigate: (path: string) => void;
}) {
  const entries = useMemo(() => paletteEntries(role), [role]);
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Buka halaman" description="Ketik nama halaman atau kelompoknya.">
      <CommandInput placeholder="Cari halaman… mis. kas awal, kurs, IRA" />
      <CommandList>
        <CommandEmpty>Tidak ada halaman yang cocok. Coba kata lain, misalnya “kurs” atau “nasabah”.</CommandEmpty>
        <CommandGroup heading="Halaman">
          {entries.map((entry) => {
            const Icon = iconFor(entry.path);
            return (
              <CommandItem
                key={entry.path}
                value={`${entry.label} ${entry.group}`}
                onSelect={() => { onOpenChange(false); onNavigate(entry.path); }}
              >
                <Icon className="size-4 text-ink-subtle" />
                <span className="text-body text-ink">{entry.label}</span>
                <span className="ml-auto text-label text-ink-subtle">{entry.group}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
