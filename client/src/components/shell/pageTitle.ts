import { backOfficeNavigationGroups } from "@shared/backOfficeNavigation";

/**
 * Kelompok dan judul diturunkan dari pohon sidebar, supaya menu yang diganti nama tidak pernah
 * meninggalkan kepala halaman dengan nama lama.
 */
const titles = new Map<string, { group: string; title: string }>();
for (const group of backOfficeNavigationGroups) {
  for (const item of group.items) {
    for (const leaf of item.children ?? [item]) titles.set(leaf.path, { group: group.label, title: leaf.label });
  }
}
// Rute yang dapat dibuka tetapi sengaja tidak ada di sidebar.
titles.set("/operasional/stock", { group: "Uang & Kurs", title: "Uang kas" });
titles.set("/operasional/stock-opname", { group: "Uang & Kurs", title: "Hitung fisik uang" });
titles.set("/operasional/pola", { group: "Pengaturan", title: "Galeri pola" });

export function pageTitleFor(path: string): { group: string; title: string } {
  return titles.get(path) ?? { group: "Operasional", title: "Back office" };
}
