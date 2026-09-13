import { describe, expect, it } from "vitest";
import { cn } from "./utils";

// Diperiksa 13 September 2026 pada tailwind-merge 3.3.1: tanpa perluasan, `text-body` dianggap warna dan
// dibuang, sedangkan `h-9 h-control` dan `shadow-xs shadow-hard` sama-sama dipertahankan.
describe("cn mengenal token fondasi desain", () => {
  it.each([
    ["text-body text-ink-muted", "text-body text-ink-muted"],
    ["text-label text-brand-contrast", "text-label text-brand-contrast"],
    ["text-sm text-body", "text-body"],
    ["h-9 h-control", "h-control"],
    ["px-4 px-gutter", "px-gutter"],
    ["shadow-xs shadow-hard", "shadow-hard"],
  ])("%s → %s", (input, expected) => {
    expect(cn(input)).toBe(expected);
  });
});
