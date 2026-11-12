import { useEffect } from "react";
import type { Identity } from "./viewModel";

const FONT_HREF = "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap";

/** Huruf Archivo + IBM Plex Mono hanya dimuat di halaman publik; back office memakai hurufnya sendiri. */
function ensureFonts() {
  if (document.querySelector(`link[data-paspor-fonts]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  link.dataset.pasporFonts = "1";
  document.head.appendChild(link);
}

/** Judul tab, deskripsi, dan kelas `html` halaman publik (spec teks §Kepala halaman); dipulihkan saat keluar. */
export function usePublicDocument(identity: Identity, mode: "page" | "papan" = "page") {
  const { name, city } = identity;
  useEffect(() => {
    ensureFonts();
    const html = document.documentElement;
    const previousTitle = document.title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    const previousDescription = meta.content;
    html.classList.add("paspor-html");
    document.title = mode === "papan" ? `Papan kurs: ${name}` : `${name}: kurs valas${city ? ` ${city}` : ""}`;
    meta.content = `Cek kurs valas ${name}${city ? ` di ${city}` : ""}. Hitung perkiraan tukar, minta konfirmasi kurs, dan lihat alamat serta jam buka.`;
    return () => {
      html.classList.remove("paspor-html");
      document.title = previousTitle;
      if (created) meta?.remove(); else if (meta) meta.content = previousDescription;
    };
  }, [name, city, mode]);
}
