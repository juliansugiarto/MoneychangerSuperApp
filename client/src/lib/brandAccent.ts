import { resolveAccent, type AccentResolution } from "@shared/accentColor";
import { paletteById, type ThemePalette } from "@shared/themePalettes";

/**
 * Menerapkan palet tema dan warna utama pilihan pemilik ke token CSS sebuah wadah (`document.documentElement`
 * untuk aplikasi, atau wadah pratinjau di galeri). Warna utama yang ditolak `resolveAccent` diganti warna
 * utama palet terpilih; pemanggil menerima putusannya supaya layar Profil Perusahaan (sub-proyek 2) dapat
 * menjelaskan alasannya. `data-tema` membuat `index.css` menghitung ulang token turunan pada wadah itu.
 */
export function applyTheme(root: HTMLElement, paletteId: string | null | undefined, customBrand?: string | null): { palette: ThemePalette; brand: AccentResolution } {
  const palette = paletteById(paletteId);
  const brand = resolveAccent(customBrand, { accent: palette.brand, contrast: palette.brandInk });
  root.style.setProperty("--paper", palette.paper);
  root.style.setProperty("--ink", palette.ink);
  root.style.setProperty("--brand", brand.accent);
  root.style.setProperty("--brand-contrast", brand.contrast);
  root.style.setProperty("--second", palette.second);
  root.style.setProperty("--second-contrast", palette.secondInk);
  root.setAttribute("data-tema", palette.id);
  return { palette, brand };
}
