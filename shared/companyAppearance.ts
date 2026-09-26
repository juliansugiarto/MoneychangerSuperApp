import { MIN_CONTRAST, bestTextContrast, normalizeHexColor } from "./accentColor";
import { THEME_PALETTE_IDS, type ThemePaletteId } from "./themePalettes";

/**
 * Palet dan warna utama sendiri pilihan pemilik (spec 2026-09-13 §A5). Satu aturan untuk layar
 * Profil Perusahaan dan server; warna yang tidak mencapai 4,5:1 dengan teks terang maupun gelap
 * TIDAK disimpan — layar menyebut rasio terbaiknya supaya pemilik tahu seberapa jauh kurangnya.
 */
export type AppearanceInput = { themePalette: string; accentColor: string | null };
export type AppearanceResult =
  | { ok: true; values: { themePalette: ThemePaletteId; accentColor: string | null } }
  | { ok: false; error: string };

const formatRatio = (ratio: number) => ratio.toFixed(2).replace(".", ",");

export function checkAppearance(input: AppearanceInput): AppearanceResult {
  if (!(THEME_PALETTE_IDS as readonly string[]).includes(input.themePalette)) {
    return { ok: false, error: "Palet itu tidak dikenal. Pilih salah satu dari enam palet." };
  }
  const themePalette = input.themePalette as ThemePaletteId;
  const raw = input.accentColor?.trim() ?? "";
  if (!raw) return { ok: true, values: { themePalette, accentColor: null } };
  const hex = normalizeHexColor(raw);
  if (!hex) return { ok: false, error: `"${raw}" bukan kode warna. Tulis kode heks enam digit, mis. #7A1F2E.` };
  const ratio = bestTextContrast(hex)!;
  if (ratio < MIN_CONTRAST) {
    return { ok: false, error: `Warna ${hex} kurang kontras dengan teks di atasnya (terbaik ${formatRatio(ratio)}:1, minimal 4,5:1). Pilih warna yang lebih gelap atau lebih terang.` };
  }
  return { ok: true, values: { themePalette, accentColor: hex } };
}
