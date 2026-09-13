import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `tailwind-merge` tidak mengenal token fondasi desain. Tanpa perluasan ini `text-body` dianggap warna
 * dan dibuang bila bertemu `text-ink`, sementara `h-9 h-control` dan `shadow-xs shadow-hard` sama-sama
 * dipertahankan sehingga urutan CSS yang menentukan (diperiksa 13 September 2026, v3.3.1).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["body", "label", "title"],
      shadow: ["hard", "tile", "focus"],
      spacing: ["control", "control-sm", "row", "row-dense", "header", "gutter"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
