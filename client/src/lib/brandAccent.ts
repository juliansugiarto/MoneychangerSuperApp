import { resolveAccent, type AccentResolution } from "@shared/accentColor";

/**
 * Menerapkan aksen perusahaan ke token `--brand`. Aksen yang ditolak `resolveAccent` diganti aksen
 * produk; pemanggil menerima putusannya supaya layar Profil Perusahaan dapat menjelaskan alasannya.
 */
export function applyBrandAccent(root: HTMLElement, candidate: string | null | undefined): AccentResolution {
  const resolution = resolveAccent(candidate);
  root.style.setProperty("--brand", resolution.accent);
  root.style.setProperty("--brand-contrast", resolution.contrast);
  return resolution;
}
