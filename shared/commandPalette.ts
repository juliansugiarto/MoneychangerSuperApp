import { visibleBackOfficeNavigation, type BackOfficeRole } from "./backOfficeNavigation";

export type PaletteEntry = { path: string; label: string; group: string };

/**
 * Halaman yang boleh dibuka lewat ⌘K oleh sebuah peran, dalam urutan sidebar. Diturunkan dari pohon
 * navigasi yang sama dengan sidebar, sehingga palet tidak pernah menawarkan halaman yang ditolak.
 */
export function paletteEntries(role: BackOfficeRole): PaletteEntry[] {
  return visibleBackOfficeNavigation(role).flatMap((group) =>
    group.items.flatMap((item) => (item.children ?? [item]).map((leaf) => ({ path: leaf.path, label: leaf.label, group: group.label }))),
  );
}
