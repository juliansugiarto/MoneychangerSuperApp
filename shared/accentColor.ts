/**
 * Warna aksen perusahaan — satu-satunya warna yang boleh ditentukan pembeli (spec desain ulang §2.1).
 *
 * Aksen dipakai untuk tindakan utama, butir menu aktif, dan merek; tidak pernah untuk warna status.
 * Aturannya murni supaya layar Profil Perusahaan, shell, dan uji memakai putusan yang sama persis:
 * aksen yang tidak mencapai kontras WCAG AA dengan teks mana pun diganti aksen produk.
 */

/** Warna utama palet MARUN — aksen produk bila perusahaan belum memilih apa pun (spec 2026-09-13 §A2). */
export const PRODUCT_ACCENT = "#7A1F2E";
export const LIGHT_TEXT = "#FFFFFF";
export const DARK_TEXT = "#111827";
/** WCAG 2.1 AA untuk teks normal. */
export const MIN_CONTRAST = 4.5;

type Rgb = { r: number; g: number; b: number };

export type AccentResolution = {
  accent: string;
  contrast: string;
  ratio: number;
  /** `true` hanya bila pembeli memberi aksen yang ditolak — bukan saat aksen memang belum diisi. */
  usedFallback: boolean;
  reason: "INVALID" | "LOW_CONTRAST" | null;
};

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? match[1].split("").map((digit) => digit + digit).join("") : match[1];
  return `#${digits.toUpperCase()}`;
}

function toRgb(hex: string): Rgb {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

function linearChannel(value: number) {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }: Rgb) {
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

export function contrastRatio(a: string, b: string): number | null {
  const first = normalizeHexColor(a);
  const second = normalizeHexColor(b);
  if (!first || !second) return null;
  const [lighter, darker] = [relativeLuminance(toRgb(first)), relativeLuminance(toRgb(second))].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

type AccentPair = { accent: string; contrast: string };

const PRODUCT_PAIR: AccentPair = { accent: PRODUCT_ACCENT, contrast: LIGHT_TEXT };

function withRatio(pair: AccentPair) {
  return { ...pair, ratio: contrastRatio(pair.accent, pair.contrast)! };
}

/**
 * `fallback` dipakai bila kandidat kosong atau ditolak. Bawaannya aksen produk; tema mengirim warna utama
 * palet terpilih supaya penolakan tidak melompat ke palet lain.
 */
export function resolveAccent(candidate: string | null | undefined, fallback: AccentPair = PRODUCT_PAIR): AccentResolution {
  const normalized = normalizeHexColor(candidate);
  if (!normalized) {
    const supplied = typeof candidate === "string" && candidate.trim() !== "";
    return { ...withRatio(fallback), usedFallback: supplied, reason: supplied ? "INVALID" : null };
  }
  const light = contrastRatio(normalized, LIGHT_TEXT)!;
  const dark = contrastRatio(normalized, DARK_TEXT)!;
  const best = light >= dark ? { contrast: LIGHT_TEXT, ratio: light } : { contrast: DARK_TEXT, ratio: dark };
  if (best.ratio < MIN_CONTRAST) return { ...withRatio(fallback), usedFallback: true, reason: "LOW_CONTRAST" };
  return { accent: normalized, ...best, usedFallback: false, reason: null };
}
