/**
 * Kelas gaya Konter Tebal, intensitas B (spec 2026-09-13 §A4): bingkai, judul, ubin, dan tombol utama
 * tebal; input dan baris kerja tenang. Satu tempat supaya "tebal" dan "tenang" tidak ditulis berbeda di
 * tiap pola. Seluruhnya token — tanpa warna mentah. Aman dikirim lewat `className` komponen shadcn karena
 * `cn` sudah mengenal token fondasi (Tugas 7A).
 */

/** Tombol utama: blok aksen, garis tinta, bayangan keras; ditekan menggeser bayangan. */
export const BOLD_BUTTON =
  "h-control rounded-[0.625rem] border-2 border-ink bg-brand px-3 font-bold text-brand-contrast shadow-hard hover:bg-brand active:translate-x-px active:translate-y-px active:shadow-none focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Tombol kedua: garis tinta tanpa blok warna. */
export const OUTLINE_BUTTON =
  "h-control rounded-[0.625rem] border-2 border-ink bg-surface-raised px-3 font-semibold text-ink shadow-none hover:bg-surface-sunken focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * Input dan wadah kerja yang tenang; garisnya memakai `--ink-subtle` supaya kontras batas ≥3:1
 * (WCAG 1.4.11) — `--line-quiet` terukur cuma 2.01:1 terhadap latar halaman. Saat difokus mendapat
 * garis tinta dan bayangan aksen.
 */
export const QUIET_FIELD =
  "rounded-lg border-[1.5px] border-ink-subtle bg-surface-raised shadow-none focus-visible:border-2 focus-visible:border-ink focus-visible:shadow-focus focus-visible:ring-0";

/** Cincin fokus untuk elemen tebal yang dapat diklik (ubin, baris). */
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
