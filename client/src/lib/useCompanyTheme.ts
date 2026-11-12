import { useEffect } from "react";
import { documentTitle } from "@/components/shell/brand";
import { applyTheme } from "./brandAccent";

type ThemeSource = { themePalette?: string | null; accentColor?: string | null; tradingName?: string | null; legalEntityName?: string | null } | null | undefined;

/**
 * Memasang palet perusahaan ke `document.documentElement`. Selama sumbernya belum dimuat, tema bawaan
 * di `index.css` (Marun) tetap berlaku — tidak ada kedipan ke warna lain. Judul tab ikut nama usahanya.
 */
export function useCompanyTheme(source: ThemeSource) {
  const palette = source?.themePalette;
  const accent = source?.accentColor ?? null;
  useEffect(() => {
    if (palette === undefined) return;
    applyTheme(document.documentElement, palette, accent);
  }, [palette, accent]);
  const title = source ? documentTitle(source) : null;
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
