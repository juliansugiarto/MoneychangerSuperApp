/**
 * Enam palet siap pakai tema Konter Tebal (spec 2026-09-13 §A1). Data murni: layar hanya membaca token
 * CSS yang diisi `applyTheme`, bukan heks ini, sehingga berkas ini sengaja tidak masuk `FOUNDATION_FILES`.
 * Setiap pasangan dijaga AA oleh `themePalettes.test.ts`; palet yang gagal diperbaiki nilainya.
 */
export type ThemePaletteId = "MARUN" | "ZAMRUD" | "SAMUDRA" | "TERAKOTA" | "ANGGUR" | "ARANG";

export type ThemePalette = {
  id: ThemePaletteId;
  name: string;
  /** Latar halaman. */
  paper: string;
  /** Teks dan garis tebal. */
  ink: string;
  /** Blok utama: tombol utama, butir menu aktif, ubin pertama. */
  brand: string;
  brandInk: string;
  /** Blok kedua: ubin kedua. */
  second: string;
  secondInk: string;
};

export const THEME_PALETTES: readonly ThemePalette[] = [
  { id: "MARUN", name: "Marun", paper: "#FFF6EA", ink: "#1D1414", brand: "#7A1F2E", brandInk: "#FFF6EA", second: "#F2B33D", secondInk: "#1D1414" },
  { id: "ZAMRUD", name: "Zamrud", paper: "#F1F6EE", ink: "#0F1D17", brand: "#0F5A41", brandInk: "#F1F6EE", second: "#E8B923", secondInk: "#0F1D17" },
  { id: "SAMUDRA", name: "Samudra", paper: "#EEF3FB", ink: "#0D1726", brand: "#1F3A8A", brandInk: "#EEF3FB", second: "#7DD3C0", secondInk: "#0D1726" },
  { id: "TERAKOTA", name: "Terakota", paper: "#FFF3E6", ink: "#22160F", brand: "#B93A0C", brandInk: "#FFF3E6", second: "#8FD3C7", secondInk: "#22160F" },
  { id: "ANGGUR", name: "Anggur", paper: "#F7F1FA", ink: "#1C1222", brand: "#5B2A86", brandInk: "#F7F1FA", second: "#FFD166", secondInk: "#1C1222" },
  { id: "ARANG", name: "Arang", paper: "#F2F0EA", ink: "#111111", brand: "#161616", brandInk: "#E6FF5C", second: "#E6FF5C", secondInk: "#111111" },
];

export const DEFAULT_PALETTE_ID: ThemePaletteId = "MARUN";

export function paletteById(id: string | null | undefined): ThemePalette {
  return THEME_PALETTES.find((palette) => palette.id === id) ?? THEME_PALETTES[0];
}
