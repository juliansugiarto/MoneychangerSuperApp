# Sub-proyek 1 — Fondasi Desain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fondasi desain yang dipakai seluruh sub-proyek berikutnya — token dan aksen perusahaan, kepadatan untuk 1280–1440px, navigasi per tugas, enam pola halaman, shell baru dengan ⌘K, galeri pola, panduan bahasa, dan Playwright — tanpa membangun ulang satu pun layar modul.

**Architecture:** Token semantik di `client/src/index.css` dipetakan ke utilitas Tailwind 4 (`bg-surface`, `text-ink`, `h-row`, `px-gutter`, `bg-brand`). Aturan warna aksen murni di `shared/accentColor.ts`. Komponen pola di `client/src/components/patterns/`, shell di `client/src/components/shell/`, dan `DashboardLayout.tsx` tetap menjadi titik masuk tunggal sehingga 45 rute di `App.tsx` tidak disentuh. Halaman lama tetap dirender apa adanya di dalam shell baru.

**Tech Stack:** React 19, Tailwind CSS 4, shadcn/Radix (`components/ui`), cmdk, wouter, tRPC, Vitest 2 + Testing Library + jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-desain-ulang-antarmuka-design.md` (§2 dan §6), diperbarui oleh `docs/superpowers/specs/2026-09-13-tema-konter-tebal-dan-papan-kurs-design.md` Bagian A (Tugas 7A dan 7B).

## Status Pengerjaan

Dikerjakan satu tugas per commit. **Centang barisnya di sini setelah commit tugas itu.**

- [x] Tugas 1 — Uji komponen klien: jsdom + Testing Library
- [x] Tugas 2 — `shared/accentColor.ts`: kontras dan aksen perusahaan
- [x] Tugas 3 — Token desain, kepadatan, dan penjaga warna mentah
- [x] Tugas 4 — Navigasi dikelompokkan per tugas
- [x] Tugas 5 — Pola: kepala halaman, keadaan, ubin angka
- [x] Tugas 6 — Pola: tabel, daftar + detail, formulir, alur bertahap, laporan
- [x] Tugas 7 — Shell aplikasi baru
- [ ] Tugas 7A — Palet dan token Konter Tebal
- [ ] Tugas 7B — Gaya ulang pola dan shell Konter Tebal
- [ ] Tugas 8 — Palet perintah ⌘K dan pintasan konter
- [ ] Tugas 9 — Galeri pola `/operasional/pola`
- [ ] Tugas 10 — Panduan suara dan bahasa
- [ ] Tugas 11 — Playwright dan basis data visual `mc_t_visual`
- [ ] Tugas 12 — Verifikasi di peramban, dokumentasi, penutupan

Urutan mengikat: 1 sebelum 3, 5, 6, 7, 8; 2 sebelum 3; 3 sebelum 5–9; 4 sebelum 7 dan 8; 5 dan 6 sebelum 9; 7 sebelum 8 dan 11; 9 sebelum 11. **7A sebelum 7B; 7B sebelum 8, 9, dan 11** (ditambahkan 13 September 2026).

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`; tambah dependensi dengan `./node_modules/.bin/pnpm add -D …` (pnpm 10.4.1, sama dengan server) dan **commit `pnpm-lock.yaml`** — server memasang dengan `--frozen-lockfile`.
- Muat lingkungan sebelum uji: `export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a; export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"`.
- Perintah mutu tiap tugas: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vite build`. Baseline sebelum sub-proyek ini (12 September 2026): **`Test Files 161 passed (161)`, `Tests 1428 passed | 2 skipped (1430)`**. Sebutkan angka yang benar-benar terlihat dan jelaskan selisihnya.
- Perubahan dependensi → `./node_modules/.bin/pnpm audit --prod --audit-level=high`. **Jangan menyebut audit bersih** selama sembilan temuan SheetJS/xlsx ada.
- **Jangan menjalankan `prettier`.** Repo ini tidak berformat prettier.
- **Backend, skema, dan aturan bisnis tidak diubah di sub-proyek ini.** Tidak ada migrasi. Tidak ada prosedur tRPC baru.
- **Tidak ada layar modul yang dibangun ulang.** Halaman di `client/src/pages/` hanya boleh berubah bila tugas menyebutnya.
- Kepadatan (verbatim dari spec §2.2): teks isi **14px**, label 12px, judul halaman 20px; baris tabel **36px** (padat 32px); tombol & input **32–36px**; kepala halaman **48px**; gutter **16–20px**; padding kartu **16px**; sidebar **232px** dapat diciutkan.
- Ukuran wajib utuh: **1280×800, 1440×900, 1920×1080**.
- Bahasa layar: Indonesia sehari-hari dengan "Anda"; istilah resmi sebagai label kecil; pesan galat menyebut apa yang terjadi dan langkah berikutnya.
- Berkas yang terdaftar di `client/src/designFoundation.ts` **tidak boleh** memuat warna mentah (`#…`, `rgb(`, `oklch(`). Warna hanya lewat token.
- Palet ⌘K di sub-proyek ini **hanya membuka halaman**; pencarian rekaman ditunda ke sub-proyek 4 dan 6 (spec §2.4).
- **Tema Konter Tebal, intensitas B** (spec 2026-09-13 §A): bingkai, judul, ubin, tombol utama, kepala tabel tebal; input dan baris kerja tenang; enam palet, Marun bawaan. Kelas tebal/tenang hanya lewat `client/src/components/patterns/tebal.ts`. `.font-display` lama tidak diubah; huruf judul baru `font-heading`.
- Basis data: `moneychanger` dan `mc_t_abcvalas` untuk uji yang ada; `mc_t_visual` khusus Playwright. **Jangan pernah menyentuh produksi.** Peragaan tidak mengetik kata sandi akun uji ke formulir; masuk lewat API di fixture.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `vitest.config.ts`, `client/src/test/setup.ts` | jsdom untuk `*.test.tsx`, pembersihan RTL, `matchMedia` | 1 |
| `shared/accentColor.ts` (+ uji) | Parse heks, kontras WCAG, `resolveAccent` | 2 |
| `client/src/index.css` | Token semantik, kepadatan, utilitas tema | 3 |
| `client/src/lib/brandAccent.ts` (+ uji) | Terapkan aksen ke `--brand` | 3 |
| `client/src/designFoundation.ts`, `client/src/designFoundation.guard.test.ts` | Daftar berkas di atas fondasi + penjaga warna mentah | 3 (tumbuh 5–9) |
| `shared/backOfficeNavigation.ts`, `server/backOfficeNavigation.test.ts` | Delapan kelompok per tugas | 4 |
| `client/src/components/patterns/*` (+ uji) | Enam pola halaman | 5, 6 |
| `client/src/components/shell/*` (+ uji), `client/src/components/DashboardLayout.tsx` | Shell 48px/232px, merek, akses | 7, 7B |
| `shared/themePalettes.ts` (+ uji), `client/src/lib/utils.ts` (+ uji) | Enam palet teruji kontras; `cn` mengenal token | 7A |
| `client/src/components/patterns/tebal.ts` | Kelas tebal/tenang bersama | 7B |
| `shared/commandPalette.ts`, `client/src/components/shell/shortcuts.ts`, `CommandPalette.tsx` | ⌘K dan pintasan | 8 |
| `client/src/pages/GaleriPola.tsx`, `client/src/App.tsx` | Galeri `/operasional/pola` | 9 |
| `docs/PANDUAN-SUARA-DAN-BAHASA.md` | Panduan bahasa | 10 |
| `playwright.config.ts`, `e2e/*`, `scripts/visualDb.mjs`, `package.json` | Uji tangkapan layar | 11 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` | Letak menu baru | 12 |

---

### Task 1: Uji komponen klien — jsdom + Testing Library

**Files:**
- Modify: `vitest.config.ts`, `package.json`, `pnpm-lock.yaml`
- Create: `client/src/test/setup.ts`, `client/src/test/renderSmoke.test.tsx`

**Interfaces:**
- Consumes: —
- Produces: berkas `client/src/**/*.test.tsx` berjalan di jsdom dengan `@testing-library/react` dan `@testing-library/user-event`; berkas `*.test.ts` tetap di node.

- [x] **Step 1: Tulis uji asap yang gagal**

`client/src/test/renderSmoke.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("lingkungan uji komponen", () => {
  it("merender komponen React di jsdom", () => {
    render(<Button>Simpan</Button>);
    expect(screen.getByRole("button", { name: "Simpan" })).toBeTruthy();
  });

  it("menyediakan matchMedia untuk komponen yang membaca ukuran layar", () => {
    expect(window.matchMedia("(max-width: 767px)").matches).toBe(false);
  });
});
```

- [x] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/test/renderSmoke.test.tsx`
Expected: tidak ada berkas yang cocok (pola `include` belum memuat `.tsx`) atau `Cannot find package '@testing-library/react'`.

- [x] **Step 3: Pasang dependensi pengembangan**

```bash
./node_modules/.bin/pnpm add -D jsdom@^25 @testing-library/react@^16 @testing-library/dom@^10 @testing-library/user-event@^14
```

- [x] **Step 4: Atur Vitest**

Ganti blok `test` pada `vitest.config.ts` dan tambahkan `esbuild` di atasnya:

```ts
  // tsconfig memakai "jsx": "preserve" untuk Vite; uji membutuhkan transform JSX otomatis.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    // Hanya uji komponen (.tsx) yang berjalan di jsdom; uji server dan shared tetap di node.
    environmentMatchGlobs: [["client/src/**/*.test.tsx", "jsdom"]],
    setupFiles: ["client/src/test/setup.ts"],
    // `shared/` dan `client/src/` ikut disertakan dengan sengaja: uji yang ditulis di sana tetapi
    // tidak pernah dijalankan lebih buruk daripada tidak ada uji sama sekali — ia terlihat seperti
    // jaring pengaman padahal tidak menangkap apa pun.
    include: [
      "server/**/*.{test,spec}.ts",
      "shared/**/*.{test,spec}.ts",
      "client/src/**/*.{test,spec}.ts",
      "client/src/**/*.{test,spec}.tsx",
    ],
  },
```

`client/src/test/setup.ts`:

```ts
import { afterEach } from "vitest";

// Uji komponen berjalan di jsdom; uji server dan shared tetap di node. Pembersihan dan tiruan
// matchMedia hanya dimuat bila ada DOM, supaya ratusan berkas uji server tidak ikut memuatnya.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());

  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}
```

- [x] **Step 5: Jalankan uji asap**

Run: `./node_modules/.bin/vitest run client/src/test/renderSmoke.test.tsx`
Expected: `Tests 2 passed (2)`.

- [x] **Step 6: Perintah mutu penuh dan audit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
./node_modules/.bin/pnpm audit --prod --audit-level=high
```
Expected: `Test Files 162 passed (162)`, `Tests 1430 passed | 2 skipped (1432)` (+1 berkas, +2 uji). `tsc` dan build bersih. Audit: catat jumlah temuannya apa adanya — dependensi baru hanya `-D`, jadi `--prod` seharusnya tetap sembilan.

- [x] **Step 7: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml client/src/test/setup.ts client/src/test/renderSmoke.test.tsx
git commit -m "Uji komponen klien: jsdom dan Testing Library"
```

---

### Task 2: `shared/accentColor.ts` — kontras dan aksen perusahaan

**Files:**
- Create: `shared/accentColor.ts`, `shared/accentColor.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `PRODUCT_ACCENT = "#1D4ED8"`, `LIGHT_TEXT = "#FFFFFF"`, `DARK_TEXT = "#111827"`, `MIN_CONTRAST = 4.5`, `normalizeHexColor(value): string | null` (bentuk `#RRGGBB`), `contrastRatio(a: string, b: string): number | null`, `resolveAccent(candidate): AccentResolution` dengan `AccentResolution = { accent: string; contrast: string; ratio: number; usedFallback: boolean; reason: "INVALID" | "LOW_CONTRAST" | null }`.

- [x] **Step 1: Tulis ujinya**

`shared/accentColor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DARK_TEXT,
  LIGHT_TEXT,
  MIN_CONTRAST,
  PRODUCT_ACCENT,
  contrastRatio,
  normalizeHexColor,
  resolveAccent,
} from "./accentColor";

describe("normalizeHexColor", () => {
  it.each([
    ["#abc", "#AABBCC"],
    ["1d4ed8", "#1D4ED8"],
    [" #0F766E ", "#0F766E"],
  ])("%j → %j", (input, expected) => {
    expect(normalizeHexColor(input)).toBe(expected);
  });

  it.each(["", "merah", "#12345", "#GGGGGG", null, undefined])("menolak %j", (input) => {
    expect(normalizeHexColor(input)).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("putih lawan hitam adalah 21", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("warna yang tidak sah menghasilkan null", () => {
    expect(contrastRatio("biru", "#FFFFFF")).toBeNull();
  });
});

describe("resolveAccent", () => {
  it("aksen produk sendiri lolos AA dengan teks putih", () => {
    expect(contrastRatio(PRODUCT_ACCENT, LIGHT_TEXT)!).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("tanpa aksen perusahaan: memakai aksen produk tanpa peringatan", () => {
    expect(resolveAccent(null)).toMatchObject({ accent: PRODUCT_ACCENT, contrast: LIGHT_TEXT, usedFallback: false, reason: null });
  });

  it("aksen yang tidak sah: memakai aksen produk dan melaporkan INVALID", () => {
    expect(resolveAccent("merah")).toMatchObject({ accent: PRODUCT_ACCENT, usedFallback: true, reason: "INVALID" });
  });

  it("aksen gelap memakai teks putih", () => {
    expect(resolveAccent("#0F766E")).toMatchObject({ accent: "#0F766E", contrast: LIGHT_TEXT, usedFallback: false });
  });

  it("aksen terang memakai teks gelap", () => {
    expect(resolveAccent("#FFD60A")).toMatchObject({ accent: "#FFD60A", contrast: DARK_TEXT, usedFallback: false });
  });

  it("abu-abu tengah tidak lolos dengan teks mana pun → aksen produk, LOW_CONTRAST", () => {
    // #7A7A7A: kontras ±4,30 dengan putih dan ±4,15 dengan #111827.
    expect(resolveAccent("#7A7A7A")).toMatchObject({ accent: PRODUCT_ACCENT, usedFallback: true, reason: "LOW_CONTRAST" });
  });

  it("apa pun masukannya, pasangan yang dikembalikan selalu lolos AA", () => {
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const hex = `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
          expect(resolveAccent(hex).ratio).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      }
    }
  });
});
```

- [x] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run shared/accentColor.test.ts`
Expected: FAIL — `Failed to resolve import "./accentColor"`.

- [x] **Step 3: Tulis implementasinya**

`shared/accentColor.ts`:

```ts
/**
 * Warna aksen perusahaan — satu-satunya warna yang boleh ditentukan pembeli (spec desain ulang §2.1).
 *
 * Aksen dipakai untuk tindakan utama, butir menu aktif, dan merek; tidak pernah untuk warna status.
 * Aturannya murni supaya layar Profil Perusahaan, shell, dan uji memakai putusan yang sama persis:
 * aksen yang tidak mencapai kontras WCAG AA dengan teks mana pun diganti aksen produk.
 */

export const PRODUCT_ACCENT = "#1D4ED8";
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

function productAccent() {
  return { accent: PRODUCT_ACCENT, contrast: LIGHT_TEXT, ratio: contrastRatio(PRODUCT_ACCENT, LIGHT_TEXT)! };
}

export function resolveAccent(candidate: string | null | undefined): AccentResolution {
  const normalized = normalizeHexColor(candidate);
  if (!normalized) {
    const supplied = typeof candidate === "string" && candidate.trim() !== "";
    return { ...productAccent(), usedFallback: supplied, reason: supplied ? "INVALID" : null };
  }
  const light = contrastRatio(normalized, LIGHT_TEXT)!;
  const dark = contrastRatio(normalized, DARK_TEXT)!;
  const best = light >= dark ? { contrast: LIGHT_TEXT, ratio: light } : { contrast: DARK_TEXT, ratio: dark };
  if (best.ratio < MIN_CONTRAST) return { ...productAccent(), usedFallback: true, reason: "LOW_CONTRAST" };
  return { accent: normalized, ...best, usedFallback: false, reason: null };
}
```

- [x] **Step 4: Jalankan uji berkas ini**

Run: `./node_modules/.bin/vitest run shared/accentColor.test.ts`
Expected: seluruhnya PASS.

- [x] **Step 5: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
git add shared/accentColor.ts shared/accentColor.test.ts
git commit -m "Aturan aksen perusahaan dengan penjaga kontras WCAG AA"
```

---

### Task 3: Token desain, kepadatan, dan penjaga warna mentah

**Files:**
- Modify: `client/src/index.css` (blok `@theme inline`, `:root`, `body`)
- Create: `client/src/lib/brandAccent.ts`, `client/src/lib/brandAccent.test.tsx`, `client/src/designFoundation.ts`, `client/src/designFoundation.guard.test.ts`

**Interfaces:**
- Consumes: `resolveAccent`, `PRODUCT_ACCENT` (Tugas 2)
- Produces:
  - Utilitas Tailwind: `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `text-ink`, `text-ink-muted`, `text-ink-subtle`, `border-line`, `border-line-strong`, `bg-brand`, `text-brand-contrast`, `outline-brand`, `text-success|warning|danger|info`, `bg-success-soft|warning-soft|danger-soft|info-soft`, `h-control`, `h-control-sm`, `h-row`, `h-row-dense`, `h-header`, `px-gutter`, `text-body` (14px), `text-label` (12px), `text-title` (20px).
  - `applyBrandAccent(root: HTMLElement, candidate: string | null | undefined): AccentResolution`
  - `FOUNDATION_FILES: readonly string[]` — tugas berikutnya **menambahkan** berkasnya ke daftar ini.

- [x] **Step 1: Tulis uji penjaga dan uji aksen**

`client/src/designFoundation.guard.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_ACCENT } from "@shared/accentColor";
import { FOUNDATION_FILES } from "./designFoundation";

const root = process.cwd();
/** Warna mentah dalam bentuk apa pun. Berkas di atas fondasi hanya boleh memakai token. */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(|\bhsla?\(/;

describe("penjaga fondasi desain", () => {
  it("setiap berkas yang terdaftar benar-benar ada", () => {
    expect(FOUNDATION_FILES.filter((file) => !existsSync(join(root, file)))).toEqual([]);
  });

  it("berkas di atas fondasi tidak menulis warna mentah", () => {
    const offenders = FOUNDATION_FILES.filter((file) => RAW_COLOR.test(readFileSync(join(root, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("aksen bawaan di CSS sama dengan PRODUCT_ACCENT", () => {
    const css = readFileSync(join(root, "client/src/index.css"), "utf8").toLowerCase();
    expect(css).toContain(`--brand: ${PRODUCT_ACCENT.toLowerCase()};`);
  });
});
```

`client/src/lib/brandAccent.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { LIGHT_TEXT, PRODUCT_ACCENT } from "@shared/accentColor";
import { applyBrandAccent } from "./brandAccent";

describe("applyBrandAccent", () => {
  it("menulis aksen perusahaan yang lolos ke --brand dan --brand-contrast", () => {
    const element = document.createElement("div");
    const result = applyBrandAccent(element, "#0F766E");
    expect(element.style.getPropertyValue("--brand")).toBe("#0F766E");
    expect(element.style.getPropertyValue("--brand-contrast")).toBe(LIGHT_TEXT);
    expect(result.usedFallback).toBe(false);
  });

  it("aksen yang tidak lolos kontras diganti aksen produk", () => {
    const element = document.createElement("div");
    const result = applyBrandAccent(element, "#7A7A7A");
    expect(element.style.getPropertyValue("--brand")).toBe(PRODUCT_ACCENT);
    expect(result.reason).toBe("LOW_CONTRAST");
  });

  it("tanpa aksen: aksen produk, tanpa peringatan", () => {
    const element = document.createElement("div");
    expect(applyBrandAccent(element, null)).toMatchObject({ accent: PRODUCT_ACCENT, usedFallback: false });
  });
});
```

- [x] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/designFoundation.guard.test.ts client/src/lib/brandAccent.test.tsx`
Expected: FAIL — `./designFoundation` dan `./brandAccent` belum ada.

- [x] **Step 3: Tulis `brandAccent.ts` dan daftar fondasi**

`client/src/lib/brandAccent.ts`:

```ts
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
```

`client/src/designFoundation.ts`:

```ts
/**
 * Berkas yang sudah dibangun di atas fondasi desain (Program Desain Ulang Antarmuka).
 *
 * `designFoundation.guard.test.ts` menolak warna mentah di setiap berkas ini. Daftarnya TUMBUH per
 * tugas dan per sub-proyek: berkas lama yang belum dibangun ulang sengaja tidak terdaftar, supaya
 * penjaganya tidak memblokir pekerjaan yang belum waktunya.
 */
export const FOUNDATION_FILES: readonly string[] = [
  "client/src/lib/brandAccent.ts",
];
```

- [x] **Step 4: Tambahkan token ke `client/src/index.css`**

Di dalam `@theme inline { … }`, sesudah baris `--color-sidebar-ring: var(--sidebar-ring);`, tambahkan:

```css
  /* Fondasi desain — Program Desain Ulang, sub-proyek 1. Berkas di atas fondasi hanya memakai ini. */
  --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-surface-sunken: var(--surface-sunken);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-ink-subtle: var(--ink-subtle);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-brand: var(--brand);
  --color-brand-contrast: var(--brand-contrast);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-info: var(--info);
  --color-info-soft: var(--info-soft);
  --spacing-control: var(--control-h);
  --spacing-control-sm: var(--control-h-sm);
  --spacing-row: var(--row-h);
  --spacing-row-dense: var(--row-h-dense);
  --spacing-header: var(--header-h);
  --spacing-gutter: var(--gutter);
  --text-body: 0.875rem;
  --text-body--line-height: 1.25rem;
  --text-label: 0.75rem;
  --text-label--line-height: 1rem;
  --text-title: 1.25rem;
  --text-title--line-height: 1.75rem;
```

Di dalam `:root { … }`, sesudah baris `--radius: 0.9rem;`, tambahkan:

```css
  /* Fondasi desain: permukaan netral, satu aksen, status yang jelas, kepadatan 1280–1440px. */
  --surface: oklch(0.985 0.003 250);
  --surface-raised: oklch(1 0 0);
  --surface-sunken: oklch(0.96 0.004 250);
  --ink: oklch(0.23 0.02 256);
  --ink-muted: oklch(0.45 0.02 256);
  --ink-subtle: oklch(0.58 0.015 256);
  --line: oklch(0.91 0.006 256);
  --line-strong: oklch(0.82 0.01 256);
  --brand: #1d4ed8;
  --brand-contrast: #ffffff;
  --success: oklch(0.5 0.12 150);
  --success-soft: oklch(0.96 0.03 150);
  --warning: oklch(0.55 0.13 65);
  --warning-soft: oklch(0.97 0.04 85);
  --danger: oklch(0.53 0.19 27);
  --danger-soft: oklch(0.97 0.02 27);
  --info: oklch(0.5 0.11 250);
  --info-soft: oklch(0.96 0.02 250);
  --control-h: 2.125rem;
  --control-h-sm: 2rem;
  --row-h: 2.25rem;
  --row-h-dense: 2rem;
  --header-h: 3rem;
  --gutter: 1rem;
```

Sesudah blok `.dark { … }` (sebelum `@layer base`), tambahkan:

```css
@media (min-width: 1440px) {
  :root {
    --gutter: 1.25rem;
  }
}
```

Di `@layer base`, ubah aturan `body` menjadi:

```css
  body {
    @apply bg-background text-foreground antialiased;
    font-family: "Manrope", ui-sans-serif, system-ui, sans-serif;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
```

- [x] **Step 5: Jalankan kedua uji**

Run: `./node_modules/.bin/vitest run client/src/designFoundation.guard.test.ts client/src/lib/brandAccent.test.tsx`
Expected: seluruhnya PASS.

- [x] **Step 6: Buktikan penjaganya menangkap**

Sisipkan sementara `// #FF0000` di akhir `client/src/lib/brandAccent.ts`, jalankan uji penjaga, pastikan **gagal** dengan `expected [ 'client/src/lib/brandAccent.ts' ] to deeply equal []`, lalu hapus sisipannya dan jalankan lagi sampai lulus.

```bash
./node_modules/.bin/vitest run client/src/designFoundation.guard.test.ts
git diff --stat -- client/src/lib/brandAccent.ts   # harus kosong sesudah dikembalikan (berkas baru: pastikan isinya sama dengan Step 3)
```

- [x] **Step 7: Perintah mutu, periksa tampilan lama, commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```
Buka `http://localhost:3000/operasional` di peramban: layar lama harus tetap tampil (hanya teks isi dasar mengecil ke 14px). Bila ada halaman yang rusak, catat di laporan — jangan memperbaiki halaman lama di tugas ini.

```bash
git add client/src/index.css client/src/lib/brandAccent.ts client/src/lib/brandAccent.test.tsx client/src/designFoundation.ts client/src/designFoundation.guard.test.ts
git commit -m "Token desain, kepadatan 1280-1440px, dan penjaga warna mentah"
```

---

### Task 4: Navigasi dikelompokkan per tugas

**Files:**
- Modify: `shared/backOfficeNavigation.ts` (`backOfficeNavigationGroups`), `server/backOfficeNavigation.test.ts`

**Interfaces:**
- Consumes: —
- Produces: delapan kelompok berurutan `["Hari ini", "Transaksi", "Uang & Kurs", "Nasabah", "Risiko", "Laporan", "Kepatuhan", "Pengaturan"]`. **Seluruh 36 path dan `minimumRole`-nya tidak berubah**; fungsi `visibleBackOfficeNavigation`, `visibleBackOfficeDestinations`, `isRoleAllowed`, `backOfficeDestinations` tidak berubah.

- [x] **Step 1: Tulis uji yang gagal**

Tambahkan ke `describe("back-office navigation routes", …)` pada `server/backOfficeNavigation.test.ts`:

```ts
  it("mengelompokkan menu per tugas, dalam urutan yang disepakati", () => {
    expect(backOfficeNavigationGroups.map((group) => group.label)).toEqual([
      "Hari ini", "Transaksi", "Uang & Kurs", "Nasabah", "Risiko", "Laporan", "Kepatuhan", "Pengaturan",
    ]);
  });

  it("tidak ada tujuan yang hilang maupun bertambah saat dikelompokkan ulang", () => {
    expect(backOfficeDestinations.map((item) => item.path).sort()).toEqual(Object.keys(pageByPath).sort());
  });

  it("menaruh halaman kepatuhan dan risiko di kelompoknya sendiri", () => {
    const groupOf = (path: string) =>
      backOfficeNavigationGroups.find((group) => group.items.some((item) => (item.children ?? [item]).some((leaf) => leaf.path === path)))?.label;
    expect(groupOf("/kepatuhan/ira")).toBe("Risiko");
    expect(groupOf("/kepatuhan/klasifikasi-risiko")).toBe("Risiko");
    expect(groupOf("/operasional/pelaporan-regulator")).toBe("Kepatuhan");
    expect(groupOf("/kepatuhan/penatausahaan-dokumen")).toBe("Kepatuhan");
    expect(groupOf("/operasional/watchlist")).toBe("Nasabah");
    expect(groupOf("/operasional/checklist")).toBe("Hari ini");
  });
```

- [x] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run server/backOfficeNavigation.test.ts`
Expected: FAIL pada uji urutan kelompok (label masih "Ringkasan", "Transaksi & Nasabah", …). Uji "tidak ada tujuan yang hilang" sudah lulus — itu memang penjaga, bukan pendorong.

- [x] **Step 3: Ganti `backOfficeNavigationGroups`**

Ganti seluruh isi larik `backOfficeNavigationGroups` pada `shared/backOfficeNavigation.ts` dengan:

```ts
export const backOfficeNavigationGroups: BackOfficeNavigationGroup[] = [
  { label: "Hari ini", items: [
    { label: "Hari Ini", path: "/operasional", minimumRole: "STAFF" },
    { label: "Buka & Tutup Outlet", path: "/operasional/checklist", minimumRole: "STAFF" },
    { label: "Meja Konfirmasi", path: "/operasional/layanan", minimumRole: "STAFF" },
    { label: "Pantauan Harian", path: "/operasional/monitoring", minimumRole: "CONTROLLER" },
  ] },
  { label: "Transaksi", items: [
    { label: "Buat Transaksi", path: "/operasional/transaksi", minimumRole: "STAFF" },
    { label: "Daftar Transaksi", path: "/operasional/transaksi/daftar", minimumRole: "STAFF" },
    { label: "Catat Pengeluaran", path: "/operasional/pengeluaran", minimumRole: "STAFF" },
    { label: "Latihan (Tanpa Data Asli)", path: "/operasional/simulasi", minimumRole: "STAFF" },
  ] },
  { label: "Uang & Kurs", items: [
    { label: "Uang Kas", children: [
      { label: "Kas Awal Hari Ini", path: "/operasional/stock/kas-awal", minimumRole: "STAFF" },
      { label: "Sisa Uang Saat Ini", path: "/operasional/stock/saat-ini", minimumRole: "STAFF" },
      { label: "Hitung Fisik Uang", path: "/operasional/stock/opname", minimumRole: "STAFF" },
      { label: "Penyesuaian Brankas", path: "/operasional/stock/penyesuaian", minimumRole: "CONTROLLER" },
    ] },
    { label: "Kurs", children: [
      { label: "Kurs Hari Ini", path: "/operasional/kurs", minimumRole: "ADMIN" },
      { label: "Bandingkan Kurs", path: "/operasional/perbandingan-kurs", minimumRole: "ADMIN" },
    ] },
  ] },
  { label: "Nasabah", items: [
    { label: "Nasabah Baru", path: "/operasional/nasabah", minimumRole: "STAFF" },
    { label: "Daftar Nasabah", path: "/operasional/nasabah/daftar", minimumRole: "STAFF" },
    { label: "Cek Daftar DTTOT/DPPSPM", path: "/operasional/watchlist", minimumRole: "STAFF" },
    { label: "Keluhan Nasabah", path: "/operasional/pengaduan", minimumRole: "STAFF" },
    { label: "Tambah dari Excel", path: "/operasional/impor-nasabah", minimumRole: "CONTROLLER" },
    { label: "Pemantauan Profil", path: "/operasional/nasabah/pemantauan", minimumRole: "CONTROLLER" },
  ] },
  { label: "Risiko", items: [
    { label: "Klasifikasi Risiko", path: "/kepatuhan/klasifikasi-risiko", minimumRole: "CONTROLLER" },
    // ADMIN yang mengisi penilaian dan SHAREHOLDER yang menyetujuinya; keduanya harus melihat
    // barisnya. Halaman detailnya berparameter dan karena itu tidak menjadi tujuan sidebar.
    { label: "Penilaian Risiko (IRA)", path: "/kepatuhan/ira", minimumRole: "ADMIN" },
  ] },
  { label: "Laporan", items: [
    { label: "Laporan Transaksi", path: "/operasional/laporan", minimumRole: "CONTROLLER" },
    { label: "Buku Besar", path: "/operasional/buku-besar", minimumRole: "CONTROLLER" },
    { label: "Laporan Keuangan", path: "/operasional/laporan-keuangan", minimumRole: "CONTROLLER" },
    { label: "Aset Tetap", path: "/operasional/aset-tetap", minimumRole: "CONTROLLER" },
    { label: "Riwayat Aktivitas", path: "/operasional/audit", minimumRole: "CONTROLLER" },
  ] },
  { label: "Kepatuhan", items: [
    { label: "Laporan ke Regulator", path: "/operasional/pelaporan-regulator", minimumRole: "CONTROLLER" },
    { label: "Arsip Dokumen", path: "/operasional/arsip-dokumen", minimumRole: "CONTROLLER" },
    { label: "Penatausahaan Dokumen", path: "/kepatuhan/penatausahaan-dokumen", minimumRole: "CONTROLLER" },
    { label: "Untuk Diketahui Direksi", path: "/operasional/pengawasan-direksi", minimumRole: "CONTROLLER" },
    { label: "Status Kesiapan", path: "/operasional/kesiapan", minimumRole: "CONTROLLER" },
    { label: "Kepegawaian", path: "/operasional/kepegawaian", minimumRole: "CONTROLLER" },
  ] },
  { label: "Pengaturan", items: [
    { label: "Pengguna & Hak Akses", path: "/operasional/pengguna", minimumRole: "CONTROLLER" },
    { label: "Profil Perusahaan", path: "/operasional/profil-perusahaan", minimumRole: "CONTROLLER" },
    { label: "Langkah Persiapan Awal", path: "/operasional/go-live", minimumRole: "CONTROLLER" },
  ] },
];
```

- [x] **Step 4: Jalankan uji navigasi**

Run: `./node_modules/.bin/vitest run server/backOfficeNavigation.test.ts`
Expected: seluruhnya PASS, termasuk uji lama (`visibleToController` sama dengan `backOfficeDestinations`, anak "Uang Kas" bagi STAFF tetap tiga).

- [x] **Step 5: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
git add shared/backOfficeNavigation.ts server/backOfficeNavigation.test.ts
git commit -m "Navigasi dikelompokkan per tugas: delapan kelompok, seluruh rute dan peran tetap"
```

---

### Task 5: Pola — kepala halaman, keadaan, ubin angka

**Files:**
- Create: `client/src/components/patterns/PageHeader.tsx`, `client/src/components/patterns/PageStates.tsx`, `client/src/components/patterns/StatTile.tsx`, `client/src/components/patterns/patternsBasic.test.tsx`
- Modify: `client/src/designFoundation.ts`

**Interfaces:**
- Consumes: token Tugas 3; `Button` (`@/components/ui/button`), `Skeleton` (`@/components/ui/skeleton`)
- Produces:
  - `PageHeader({ title: string; description?: string; officialLabel?: string; actions?: ReactNode })`
  - `LoadingState({ rows?: number; label?: string })` — `role="status"`
  - `EmptyState({ title: string; nextStep: string; actionLabel?: string; onAction?: () => void })`
  - `ErrorState({ what: string; nextStep: string; onRetry?: () => void })` — `role="alert"`
  - `StatTile({ label: string; value: string; hint?: string; onOpen?: () => void })` — tombol bila `onOpen` ada

- [x] **Step 1: Tulis ujinya**

`client/src/components/patterns/patternsBasic.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "./PageHeader";
import { EmptyState, ErrorState, LoadingState } from "./PageStates";
import { StatTile } from "./StatTile";

describe("PageHeader", () => {
  it("menampilkan judul biasa dengan istilah resmi sebagai label kecil di bawahnya", () => {
    render(<PageHeader title="Seberapa berisiko usaha Anda?" officialLabel="Form A1 · Risiko inheren" description="Jawab dari data bulan ini." />);
    expect(screen.getByRole("heading", { level: 1, name: "Seberapa berisiko usaha Anda?" })).toBeTruthy();
    expect(screen.getByText("Form A1 · Risiko inheren")).toBeTruthy();
    expect(screen.getByText("Jawab dari data bulan ini.")).toBeTruthy();
  });
});

describe("keadaan halaman", () => {
  it("LoadingState diumumkan sebagai status", () => {
    render(<LoadingState label="Memuat daftar nasabah" />);
    expect(screen.getByRole("status", { name: "Memuat daftar nasabah" })).toBeTruthy();
  });

  it("EmptyState menyebut langkah berikutnya dan menjalankan tindakannya", async () => {
    const onAction = vi.fn();
    render(<EmptyState title="Belum ada kas awal hari ini" nextStep="Hitung uang di laci lalu catat sebelum melayani nasabah." actionLabel="Catat kas awal" onAction={onAction} />);
    expect(screen.getByText("Hitung uang di laci lalu catat sebelum melayani nasabah.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Catat kas awal" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("EmptyState tanpa tindakan tidak merender tombol kosong", () => {
    render(<EmptyState title="Tidak ada transaksi" nextStep="Transaksi yang dibuat hari ini akan muncul di sini." />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("ErrorState menyebut apa yang terjadi, langkah berikutnya, dan dapat dicoba lagi", async () => {
    const onRetry = vi.fn();
    render(<ErrorState what="Daftar kurs tidak dapat dimuat." nextStep="Periksa sambungan lalu coba lagi." onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Daftar kurs tidak dapat dimuat.");
    expect(alert.textContent).toContain("Periksa sambungan lalu coba lagi.");
    await userEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("StatTile", () => {
  it("menjadi tombol bila dapat dibuka", async () => {
    const onOpen = vi.fn();
    render(<StatTile label="Transaksi hari ini" value="12" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /Transaksi hari ini/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("bukan tombol bila hanya menampilkan angka", () => {
    render(<StatTile label="Kas Rupiah" value="Rp 25.000.000" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Rp 25.000.000")).toBeTruthy();
  });
});
```

- [x] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/components/patterns/patternsBasic.test.tsx`
Expected: FAIL — `./PageHeader` belum ada.

- [x] **Step 3: Tulis ketiga komponen**

`client/src/components/patterns/PageHeader.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * Kepala halaman: judul dalam bahasa sehari-hari, istilah resmi BI/PPATK sebagai label kecil di
 * bawahnya (panduan bahasa), deskripsi singkat, dan tindakan halaman di kanan.
 */
export function PageHeader({ title, description, officialLabel, actions }: {
  title: string;
  description?: string;
  officialLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
      <div className="min-w-0">
        <h1 className="text-title font-semibold text-ink">{title}</h1>
        {officialLabel ? <p className="mt-0.5 text-label text-ink-subtle">{officialLabel}</p> : null}
        {description ? <p className="mt-1 max-w-3xl text-body text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
```

`client/src/components/patterns/PageStates.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Inbox } from "lucide-react";

export function LoadingState({ rows = 3, label = "Memuat…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-row w-full" />)}
    </div>
  );
}

/** Keadaan kosong wajib menyebut langkah berikutnya — "Tidak ada data" saja tidak menolong siapa pun. */
export function EmptyState({ title, nextStep, actionLabel, onAction }: {
  title: string;
  nextStep: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface-raised px-4 py-8 text-center">
      <Inbox aria-hidden className="mx-auto size-6 text-ink-subtle" />
      <p className="mt-2 text-body font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-body text-ink-muted">{nextStep}</p>
      {actionLabel && onAction ? <Button className="mt-3 h-control" onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}

/** Pesan galat menyebut apa yang terjadi dan apa yang harus dilakukan (panduan bahasa). */
export function ErrorState({ what, nextStep, onRetry }: { what: string; nextStep: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3">
      <p className="flex items-center gap-2 text-body font-semibold text-danger">
        <AlertTriangle aria-hidden className="size-4" />
        {what}
      </p>
      <p className="mt-1 text-body text-ink-muted">{nextStep}</p>
      {onRetry ? <Button variant="outline" className="mt-2 h-control-sm" onClick={onRetry}>Coba lagi</Button> : null}
    </div>
  );
}
```

`client/src/components/patterns/StatTile.tsx`:

```tsx
export function StatTile({ label, value, hint, onOpen }: { label: string; value: string; hint?: string; onOpen?: () => void }) {
  const body = (
    <>
      <p className="text-label text-ink-muted">{label}</p>
      <p className="mt-1 text-title font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-label text-ink-subtle">{hint}</p> : null}
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} className="rounded-lg border border-line bg-surface-raised p-4 text-left hover:border-line-strong focus-visible:outline-2 focus-visible:outline-brand">
      {body}
    </button>
  ) : (
    <div className="rounded-lg border border-line bg-surface-raised p-4">{body}</div>
  );
}
```

- [x] **Step 4: Daftarkan ke fondasi**

Tambahkan ke `FOUNDATION_FILES` di `client/src/designFoundation.ts`:

```ts
  "client/src/components/patterns/PageHeader.tsx",
  "client/src/components/patterns/PageStates.tsx",
  "client/src/components/patterns/StatTile.tsx",
```

- [x] **Step 5: Jalankan uji pola dan penjaga**

Run: `./node_modules/.bin/vitest run client/src/components/patterns/patternsBasic.test.tsx client/src/designFoundation.guard.test.ts`
Expected: seluruhnya PASS.

- [x] **Step 6: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
git add client/src/components/patterns/PageHeader.tsx client/src/components/patterns/PageStates.tsx client/src/components/patterns/StatTile.tsx client/src/components/patterns/patternsBasic.test.tsx client/src/designFoundation.ts
git commit -m "Pola halaman: kepala halaman, keadaan memuat/kosong/galat, ubin angka"
```

---

### Task 6: Pola — tabel, daftar + detail, formulir, alur bertahap, laporan

**Files:**
- Create: `client/src/components/patterns/DataTable.tsx`, `ListDetailLayout.tsx`, `FormSection.tsx`, `StepFlow.tsx`, `ReportLayout.tsx`, `patternsLayout.test.tsx` (seluruhnya di `client/src/components/patterns/`)
- Modify: `client/src/designFoundation.ts`

**Interfaces:**
- Consumes: token Tugas 3; `Button`
- Produces:
  - `type Column<Row> = { key: string; header: string; cell: (row: Row) => ReactNode; align?: "left" | "right" }`
  - `DataTable<Row>({ columns: Column<Row>[]; rows: Row[]; rowKey: (row: Row) => string; onSelect?: (row: Row) => void; selectedKey?: string | null; dense?: boolean; caption?: string })`
  - `ListDetailLayout({ list: ReactNode; detail?: ReactNode; detailTitle?: string; onCloseDetail: () => void })` — `Esc` menutup detail
  - `FormSection({ number: number; title: string; description?: string; children: ReactNode })`, `StickyActions({ children: ReactNode })`
  - `type Step = { id: string; title: string }`; `StepFlow({ steps: Step[]; currentIndex: number; onStepChange: (index: number) => void; canAdvance?: boolean; nextLabel?: string; backLabel?: string; children: ReactNode })`
  - `ReportLayout({ filters?: ReactNode; summary?: ReactNode; table: ReactNode; onExport?: () => void; exportLabel?: string })`

- [x] **Step 1: Tulis ujinya**

`client/src/components/patterns/patternsLayout.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "./DataTable";
import { FormSection, StickyActions } from "./FormSection";
import { ListDetailLayout } from "./ListDetailLayout";
import { ReportLayout } from "./ReportLayout";
import { StepFlow } from "./StepFlow";

type Bon = { id: string; nomor: string; nilai: string };
const bons: Bon[] = [
  { id: "1", nomor: "FX-001", nilai: "Rp 1.500.000" },
  { id: "2", nomor: "FX-002", nilai: "Rp 250.000" },
];
const columns: Column<Bon>[] = [
  { key: "nomor", header: "Nomor bon", cell: (row) => row.nomor },
  { key: "nilai", header: "Nilai", cell: (row) => row.nilai, align: "right" },
];

describe("DataTable", () => {
  it("memilih baris dengan klik maupun Enter", async () => {
    const onSelect = vi.fn();
    render(<DataTable columns={columns} rows={bons} rowKey={(row) => row.id} onSelect={onSelect} caption="Daftar bon" />);
    await userEvent.click(screen.getByText("FX-001"));
    expect(onSelect).toHaveBeenLastCalledWith(bons[0]);
    const secondRow = screen.getByText("FX-002").closest("tr")!;
    secondRow.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith(bons[1]);
  });

  it("menandai baris terpilih dan meratakan angka ke kanan", () => {
    render(<DataTable columns={columns} rows={bons} rowKey={(row) => row.id} onSelect={() => {}} selectedKey="2" />);
    expect(screen.getByText("FX-002").closest("tr")!.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Rp 250.000").className).toContain("text-right");
  });
});

describe("ListDetailLayout", () => {
  it("Esc menutup panel detail yang terbuka", async () => {
    const onClose = vi.fn();
    render(<ListDetailLayout list={<p>daftar</p>} detail={<p>isi</p>} detailTitle="Bon FX-001" onCloseDetail={onClose} />);
    expect(screen.getByRole("complementary", { name: "Bon FX-001" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Esc tidak memanggil apa pun saat detail tertutup", async () => {
    const onClose = vi.fn();
    render(<ListDetailLayout list={<p>daftar</p>} onCloseDetail={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("StepFlow", () => {
  const steps = [
    { id: "usaha", title: "Tentang usaha Anda" },
    { id: "nasabah", title: "Nasabah, produk, wilayah" },
    { id: "hasil", title: "Hasil" },
  ];

  it("menandai langkah aktif dan mematikan Kembali pada langkah pertama", async () => {
    const onStepChange = vi.fn();
    render(<StepFlow steps={steps} currentIndex={0} onStepChange={onStepChange}><p>isi</p></StepFlow>);
    expect(screen.getByText("Tentang usaha Anda").closest("li")!.getAttribute("aria-current")).toBe("step");
    expect((screen.getByRole("button", { name: "Kembali" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it("tidak menampilkan Lanjut pada langkah terakhir, dan canAdvance=false mematikannya", () => {
    const { rerender } = render(<StepFlow steps={steps} currentIndex={2} onStepChange={() => {}}><p>isi</p></StepFlow>);
    expect(screen.queryByRole("button", { name: "Lanjut" })).toBeNull();
    rerender(<StepFlow steps={steps} currentIndex={1} onStepChange={() => {}} canAdvance={false}><p>isi</p></StepFlow>);
    expect((screen.getByRole("button", { name: "Lanjut" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("FormSection dan ReportLayout", () => {
  it("bagian formulir bernomor dan berlabel", () => {
    render(<FormSection number={2} title="Data identitas"><input aria-label="NIK" /></FormSection>);
    expect(screen.getByRole("region", { name: "2. Data identitas" })).toBeTruthy();
    render(<StickyActions><button type="button">Simpan</button></StickyActions>);
    expect(screen.getByRole("button", { name: "Simpan" })).toBeTruthy();
  });

  it("laporan menjalankan ekspor", async () => {
    const onExport = vi.fn();
    render(<ReportLayout table={<p>tabel</p>} onExport={onExport} exportLabel="Ekspor Excel" />);
    await userEvent.click(screen.getByRole("button", { name: "Ekspor Excel" }));
    expect(onExport).toHaveBeenCalledOnce();
  });
});
```

- [x] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/components/patterns/patternsLayout.test.tsx`
Expected: FAIL — `./DataTable` belum ada.

- [x] **Step 3: Tulis kelima komponen**

`client/src/components/patterns/DataTable.tsx`:

```tsx
import type { ReactNode } from "react";

export type Column<Row> = { key: string; header: string; cell: (row: Row) => ReactNode; align?: "left" | "right" };

/** Tabel padat: baris 36px (32px bila `dense`), dipilih dengan klik atau Enter, angka rata kanan. */
export function DataTable<Row>({ columns, rows, rowKey, onSelect, selectedKey = null, dense = false, caption }: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onSelect?: (row: Row) => void;
  selectedKey?: string | null;
  dense?: boolean;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
      <table className="w-full text-body">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-surface-sunken text-label text-ink-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`h-row px-3 font-medium ${column.align === "right" ? "text-right" : "text-left"}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                aria-selected={onSelect ? selected : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onClick={onSelect ? () => onSelect(row) : undefined}
                onKeyDown={onSelect ? (event) => { if (event.key === "Enter") onSelect(row); } : undefined}
                className={`border-t border-line ${dense ? "h-row-dense" : "h-row"} ${onSelect ? "cursor-pointer hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-brand" : ""} ${selected ? "bg-info-soft" : ""}`}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-3 text-ink ${column.align === "right" ? "text-right tabular-nums" : ""}`}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

`client/src/components/patterns/ListDetailLayout.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { useEffect, type ReactNode } from "react";

/** Daftar dengan panel detail di samping (≥1280px) — memilih baris tidak meninggalkan daftarnya. */
export function ListDetailLayout({ list, detail, detailTitle, onCloseDetail }: {
  list: ReactNode;
  detail?: ReactNode;
  detailTitle?: string;
  onCloseDetail: () => void;
}) {
  useEffect(() => {
    if (!detail) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseDetail(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail, onCloseDetail]);

  return (
    <div className={detail ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]" : ""}>
      <div className="min-w-0">{list}</div>
      {detail ? (
        <aside aria-label={detailTitle ?? "Detail"} className="min-w-0 rounded-lg border border-line bg-surface-raised">
          <div className="flex h-header items-center justify-between border-b border-line px-4">
            <p className="text-body font-semibold text-ink">{detailTitle}</p>
            <Button variant="ghost" size="sm" onClick={onCloseDetail}>Tutup</Button>
          </div>
          <div className="p-4">{detail}</div>
        </aside>
      ) : null}
    </div>
  );
}
```

`client/src/components/patterns/FormSection.tsx`:

```tsx
import { useId, type ReactNode } from "react";

/** Formulir satu kolom yang dibagi ke bagian bernomor. */
export function FormSection({ number, title, description, children }: {
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-b border-line py-4 last:border-b-0">
      <h2 id={headingId} className="text-body font-semibold text-ink">{number}. {title}</h2>
      {description ? <p className="mt-0.5 text-label text-ink-muted">{description}</p> : null}
      <div className="mt-3 grid max-w-2xl gap-3">{children}</div>
    </section>
  );
}

/** Tombol aksi yang menempel di bawah formulir panjang supaya "Simpan" selalu terlihat. */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-line bg-surface-raised px-gutter py-2">
      {children}
    </div>
  );
}
```

`client/src/components/patterns/StepFlow.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export type Step = { id: string; title: string };

/**
 * Alur bertahap bernomor. Tindakan akhir (mis. "Kirim untuk disetujui") disediakan isi langkah
 * terakhir sendiri, karena tiap alur menamai tindakannya berbeda.
 */
export function StepFlow({ steps, currentIndex, onStepChange, canAdvance = true, nextLabel = "Lanjut", backLabel = "Kembali", children }: {
  steps: Step[];
  currentIndex: number;
  onStepChange: (index: number) => void;
  canAdvance?: boolean;
  nextLabel?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;
  return (
    <div className="grid gap-4">
      <ol aria-label="Langkah" className="flex flex-wrap gap-2">
        {steps.map((step, index) => (
          <li
            key={step.id}
            aria-current={index === currentIndex ? "step" : undefined}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-label ${index === currentIndex ? "bg-brand text-brand-contrast" : index < currentIndex ? "text-ink" : "text-ink-subtle"}`}
          >
            <span className="tabular-nums">{index + 1}</span>
            <span>{step.title}</span>
          </li>
        ))}
      </ol>
      <div>{children}</div>
      <div className="flex justify-between gap-2 border-t border-line pt-3">
        <Button variant="outline" className="h-control" disabled={isFirst} onClick={() => onStepChange(currentIndex - 1)}>{backLabel}</Button>
        {isLast ? null : <Button className="h-control" disabled={!canAdvance} onClick={() => onStepChange(currentIndex + 1)}>{nextLabel}</Button>}
      </div>
    </div>
  );
}
```

`client/src/components/patterns/ReportLayout.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

/** Laporan: filter dan ekspor di atas, angka ringkas, lalu tabelnya. */
export function ReportLayout({ filters, summary, table, onExport, exportLabel = "Ekspor" }: {
  filters?: ReactNode;
  summary?: ReactNode;
  table: ReactNode;
  onExport?: () => void;
  exportLabel?: string;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">{filters}</div>
        {onExport ? <Button variant="outline" className="h-control" onClick={onExport}>{exportLabel}</Button> : null}
      </div>
      {summary ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary}</div> : null}
      {table}
    </div>
  );
}
```

- [x] **Step 4: Daftarkan ke fondasi**

Tambahkan ke `FOUNDATION_FILES`:

```ts
  "client/src/components/patterns/DataTable.tsx",
  "client/src/components/patterns/ListDetailLayout.tsx",
  "client/src/components/patterns/FormSection.tsx",
  "client/src/components/patterns/StepFlow.tsx",
  "client/src/components/patterns/ReportLayout.tsx",
```

- [x] **Step 5: Jalankan uji pola dan penjaga**

Run: `./node_modules/.bin/vitest run client/src/components/patterns/patternsLayout.test.tsx client/src/designFoundation.guard.test.ts`
Expected: seluruhnya PASS. Bila `getByRole("region", { name: "2. Data identitas" })` tidak menemukan bagian, pastikan `aria-labelledby` menunjuk `id` judulnya — `<section>` hanya menjadi *region* bila berlabel.

- [x] **Step 6: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
git add client/src/components/patterns/DataTable.tsx client/src/components/patterns/ListDetailLayout.tsx client/src/components/patterns/FormSection.tsx client/src/components/patterns/StepFlow.tsx client/src/components/patterns/ReportLayout.tsx client/src/components/patterns/patternsLayout.test.tsx client/src/designFoundation.ts
git commit -m "Pola halaman: tabel padat, daftar dengan detail, formulir, alur bertahap, laporan"
```

---

### Task 7: Shell aplikasi baru

**Files:**
- Create (seluruhnya di `client/src/components/shell/`): `accessState.ts`, `accessState.test.ts`, `brand.ts`, `brand.test.ts`, `pageTitle.ts`, `pageTitle.test.ts`, `navigationIcons.ts`, `AccessPanel.tsx`, `AppHeader.tsx`, `AppHeader.test.tsx`, `AppSidebar.tsx`
- Modify: `client/src/components/DashboardLayout.tsx` (ditulis ulang; ekspor bawaan dan props tetap), `client/src/designFoundation.ts`

**Interfaces:**
- Consumes: `backOfficeNavigationGroups`, `visibleBackOfficeNavigation`, `isRoleAllowed`, `BackOfficeRole` (Tugas 4); token (Tugas 3); `useAuth()` → `{ loading, user, logout }`; `trpc.companyProfile.get` (staff) → baris profil atau `null`
- Produces:
  - `type AccessState = "LOADING" | "SIGNED_OUT" | "MUST_CHANGE_PASSWORD" | "FORBIDDEN" | "ALLOWED"`; `accessStateFor(input: { loading: boolean; user: { role: string; mustChangePassword?: boolean | null } | null | undefined }, minimumRole: BackOfficeRole): AccessState`
  - `PRODUCT_NAME = "Aplikasi Valuta"`; `brandName(profile: { tradingName?: string | null; legalEntityName?: string | null } | null | undefined): string`; `brandInitials(name: string): string`
  - `pageTitleFor(path: string): { group: string; title: string }`
  - `iconFor(path: string): LucideIcon`, `parentIconFor(label: string): LucideIcon`
  - `AppHeader({ group: string; title: string; onOpenSearch: () => void })`
  - `AppSidebar({ brand: string; role: BackOfficeRole; userName: string; roleLabel: string; currentPath: string; onNavigate: (path: string) => void; onLogout: () => void })`
  - `DashboardLayout({ children, minimumRole })` — tanda tangan sama dengan hari ini; Tugas 8 menambahkan palet ke dalamnya.

- [x] **Step 1: Tulis uji fungsi murni**

`client/src/components/shell/accessState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { accessStateFor } from "./accessState";

describe("accessStateFor", () => {
  it.each([
    [{ loading: true, user: null }, "STAFF", "LOADING"],
    [{ loading: false, user: null }, "STAFF", "SIGNED_OUT"],
    [{ loading: false, user: { role: "SHAREHOLDER", mustChangePassword: true } }, "STAFF", "MUST_CHANGE_PASSWORD"],
    [{ loading: false, user: { role: "STAFF" } }, "CONTROLLER", "FORBIDDEN"],
    [{ loading: false, user: { role: "CONTROLLER", mustChangePassword: false } }, "CONTROLLER", "ALLOWED"],
    [{ loading: false, user: { role: "SHAREHOLDER" } }, "ADMIN", "ALLOWED"],
  ] as const)("%j pada %s → %s", (input, minimumRole, expected) => {
    expect(accessStateFor(input, minimumRole)).toBe(expected);
  });
});
```

`client/src/components/shell/brand.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME, brandInitials, brandName } from "./brand";

describe("merek pada shell", () => {
  it("memakai nama dagang, lalu nama badan hukum, lalu nama produk", () => {
    expect(brandName({ tradingName: "Valas Sentosa", legalEntityName: "PT Valas Sentosa Abadi" })).toBe("Valas Sentosa");
    expect(brandName({ tradingName: "  ", legalEntityName: "PT Valas Sentosa Abadi" })).toBe("PT Valas Sentosa Abadi");
    expect(brandName(null)).toBe(PRODUCT_NAME);
  });

  it("inisial dua huruf, melewati kata badan hukum", () => {
    expect(brandInitials("PT Ibukota Valasindo")).toBe("IV");
    expect(brandInitials("Valas Sentosa Abadi")).toBe("VS");
    expect(brandInitials("Rupiah")).toBe("RU");
  });
});
```

`client/src/components/shell/pageTitle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { backOfficeDestinations } from "@shared/backOfficeNavigation";
import { pageTitleFor } from "./pageTitle";

describe("pageTitleFor", () => {
  it("setiap tujuan sidebar punya judul dan kelompok dari pohon navigasi", () => {
    for (const destination of backOfficeDestinations) {
      expect(pageTitleFor(destination.path).title).toBe(destination.label);
    }
    expect(pageTitleFor("/kepatuhan/ira").group).toBe("Risiko");
  });

  it("rute di luar sidebar mendapat judul yang masuk akal", () => {
    expect(pageTitleFor("/operasional/pola")).toEqual({ group: "Pengaturan", title: "Galeri pola" });
    expect(pageTitleFor("/operasional/tidak-ada").title).toBe("Back office");
  });
});
```

- [x] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/components/shell`
Expected: FAIL — modul belum ada.

- [x] **Step 3: Tulis fungsi murninya**

`client/src/components/shell/accessState.ts`:

```ts
import { isRoleAllowed, type BackOfficeRole } from "@shared/backOfficeNavigation";

export type AccessState = "LOADING" | "SIGNED_OUT" | "MUST_CHANGE_PASSWORD" | "FORBIDDEN" | "ALLOWED";

/** Urutan pemeriksaannya sama dengan shell lama; server tetap penegak otorisasi yang sesungguhnya. */
export function accessStateFor(
  input: { loading: boolean; user: { role: string; mustChangePassword?: boolean | null } | null | undefined },
  minimumRole: BackOfficeRole,
): AccessState {
  if (input.loading) return "LOADING";
  if (!input.user) return "SIGNED_OUT";
  if (input.user.mustChangePassword) return "MUST_CHANGE_PASSWORD";
  if (!isRoleAllowed(input.user.role as BackOfficeRole, minimumRole)) return "FORBIDDEN";
  return "ALLOWED";
}
```

`client/src/components/shell/brand.ts`:

```ts
/** Nama produk bila Profil Perusahaan belum diisi — shell tidak lagi menulis mati nama satu perusahaan. */
export const PRODUCT_NAME = "Aplikasi Valuta";

const LEGAL_FORM_WORDS = new Set(["PT", "CV", "TBK", "PT.", "CV."]);

export function brandName(profile: { tradingName?: string | null; legalEntityName?: string | null } | null | undefined): string {
  const trading = profile?.tradingName?.trim();
  if (trading) return trading;
  const legal = profile?.legalEntityName?.trim();
  return legal || PRODUCT_NAME;
}

export function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => !LEGAL_FORM_WORDS.has(word.toUpperCase()));
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (words[0] ?? name).slice(0, 2).toUpperCase();
}
```

`client/src/components/shell/pageTitle.ts`:

```ts
import { backOfficeNavigationGroups } from "@shared/backOfficeNavigation";

/**
 * Kelompok dan judul diturunkan dari pohon sidebar, supaya menu yang diganti nama tidak pernah
 * meninggalkan kepala halaman dengan nama lama.
 */
const titles = new Map<string, { group: string; title: string }>();
for (const group of backOfficeNavigationGroups) {
  for (const item of group.items) {
    for (const leaf of item.children ?? [item]) titles.set(leaf.path, { group: group.label, title: leaf.label });
  }
}
// Rute yang dapat dibuka tetapi sengaja tidak ada di sidebar.
titles.set("/operasional/stock", { group: "Uang & Kurs", title: "Uang kas" });
titles.set("/operasional/stock-opname", { group: "Uang & Kurs", title: "Hitung fisik uang" });
titles.set("/operasional/pola", { group: "Pengaturan", title: "Galeri pola" });

export function pageTitleFor(path: string): { group: string; title: string } {
  return titles.get(path) ?? { group: "Operasional", title: "Back office" };
}
```

- [x] **Step 4: Jalankan uji fungsi murni**

Run: `./node_modules/.bin/vitest run client/src/components/shell`
Expected: ketiga berkas PASS.

- [x] **Step 5: Tulis uji kepala halaman**

`client/src/components/shell/AppHeader.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("menampilkan kelompok dan judul, dan tombol cari membuka palet", async () => {
    const onOpenSearch = vi.fn();
    render(<SidebarProvider><AppHeader group="Uang & Kurs" title="Kas Awal Hari Ini" onOpenSearch={onOpenSearch} /></SidebarProvider>);
    // Kepala shell bukan heading: h1 milik PageHeader halaman, supaya tiap halaman hanya punya satu h1.
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Kas Awal Hari Ini").getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Uang & Kurs")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Cari halaman/ }));
    expect(onOpenSearch).toHaveBeenCalledOnce();
  });
});
```

Run: `./node_modules/.bin/vitest run client/src/components/shell/AppHeader.test.tsx`
Expected: FAIL — `./AppHeader` belum ada.

- [x] **Step 6: Tulis ikon, panel akses, kepala halaman, dan sidebar**

`client/src/components/shell/navigationIcons.ts`:

```ts
import {
  ArrowLeftRight, BadgeDollarSign, Banknote, BookOpenText, Building2, ChartNoAxesCombined, ClipboardCheck,
  ClipboardList, FileArchive, FileSearch, FileText, Gauge, Landmark, LayoutDashboard, MessageSquareWarning,
  MessagesSquare, Receipt, Rocket, Scale, ShieldAlert, ShieldCheck, ShieldQuestion, UserPlus, UsersRound,
  Vault, Wallet, type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "/operasional": LayoutDashboard,
  "/operasional/checklist": ClipboardCheck,
  "/operasional/layanan": MessagesSquare,
  "/operasional/monitoring": Gauge,
  "/operasional/transaksi": ArrowLeftRight,
  "/operasional/transaksi/daftar": ClipboardList,
  "/operasional/pengeluaran": Receipt,
  "/operasional/simulasi": ShieldQuestion,
  "/operasional/stock/kas-awal": Banknote,
  "/operasional/stock/saat-ini": Wallet,
  "/operasional/stock/opname": ClipboardCheck,
  "/operasional/stock/penyesuaian": Vault,
  "/operasional/kurs": BadgeDollarSign,
  "/operasional/perbandingan-kurs": ChartNoAxesCombined,
  "/operasional/nasabah": UserPlus,
  "/operasional/nasabah/daftar": UsersRound,
  "/operasional/watchlist": ShieldAlert,
  "/operasional/pengaduan": MessageSquareWarning,
  "/operasional/impor-nasabah": FileSearch,
  "/operasional/nasabah/pemantauan": Gauge,
  "/kepatuhan/klasifikasi-risiko": Scale,
  "/kepatuhan/ira": ShieldCheck,
  "/operasional/laporan": ChartNoAxesCombined,
  "/operasional/buku-besar": BookOpenText,
  "/operasional/laporan-keuangan": FileText,
  "/operasional/aset-tetap": Building2,
  "/operasional/audit": FileSearch,
  "/operasional/pelaporan-regulator": Landmark,
  "/operasional/arsip-dokumen": FileArchive,
  "/kepatuhan/penatausahaan-dokumen": FileArchive,
  "/operasional/pengawasan-direksi": ShieldCheck,
  "/operasional/kesiapan": ShieldCheck,
  "/operasional/kepegawaian": UsersRound,
  "/operasional/pengguna": UsersRound,
  "/operasional/profil-perusahaan": Building2,
  "/operasional/go-live": Rocket,
};

const parentIcons: Record<string, LucideIcon> = { "Uang Kas": Wallet, Kurs: BadgeDollarSign };

export const iconFor = (path: string): LucideIcon => icons[path] ?? LayoutDashboard;
export const parentIconFor = (label: string): LucideIcon => parentIcons[label] ?? LayoutDashboard;
```

`client/src/components/shell/AccessPanel.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { LockKeyhole } from "lucide-react";

/** Satu panel untuk belum masuk, wajib ganti sandi, dan kewenangan kurang. */
export function AccessPanel({ title, detail, action, onAction }: { title: string; detail: string; action: string; onAction: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface-raised p-6 text-center">
        <LockKeyhole aria-hidden className="mx-auto size-6 text-ink-subtle" />
        <h1 className="mt-3 text-title font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-body text-ink-muted">{detail}</p>
        <Button onClick={onAction} className="mt-5 h-control w-full bg-brand text-brand-contrast hover:bg-brand/90">{action}</Button>
      </div>
    </div>
  );
}
```

`client/src/components/shell/AppHeader.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search } from "lucide-react";

/**
 * Kepala 48px: pemicu sidebar, kelompok › judul, dan pencarian ⌘K. Judulnya bukan heading — h1
 * milik `PageHeader` halaman. Slot pengalih perusahaan (spec §2.4) sengaja belum dirender sampai
 * multi-perusahaan benar-benar ada.
 */
export function AppHeader({ group, title, onOpenSearch }: { group: string; title: string; onOpenSearch: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-header items-center gap-3 border-b border-line bg-surface-raised px-gutter">
      <SidebarTrigger className="size-8 text-ink-muted" />
      <nav aria-label="Jejak" className="flex min-w-0 items-center gap-1.5 text-body">
        <span className="shrink-0 text-ink-subtle">{group}</span>
        <span aria-hidden className="text-ink-subtle">›</span>
        <span aria-current="page" className="truncate font-semibold text-ink">{title}</span>
      </nav>
      <Button type="button" variant="outline" onClick={onOpenSearch} className="ml-auto h-control-sm gap-2 border-line text-ink-muted">
        <Search aria-hidden className="size-4" />
        <span>Cari halaman</span>
        <kbd className="rounded border border-line px-1 text-label text-ink-subtle">⌘K</kbd>
      </Button>
    </header>
  );
}
```

`client/src/components/shell/AppSidebar.tsx`:

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { visibleBackOfficeNavigation, type BackOfficeDestination, type BackOfficeRole } from "@shared/backOfficeNavigation";
import { ChevronRight, LogOut } from "lucide-react";
import { useState } from "react";
import { brandInitials } from "./brand";
import { iconFor, parentIconFor } from "./navigationIcons";

const activeItem = "data-[active=true]:bg-brand data-[active=true]:text-brand-contrast data-[active=true]:font-semibold";

export function AppSidebar({ brand, role, userName, roleLabel, currentPath, onNavigate, onLogout }: {
  brand: string;
  role: BackOfficeRole;
  userName: string;
  roleLabel: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  const groups = visibleBackOfficeNavigation(role);
  return (
    <Sidebar collapsible="icon" className="border-r border-line bg-surface-raised">
      <SidebarHeader className="h-header justify-center border-b border-line px-2">
        <button type="button" onClick={() => onNavigate("/operasional")} className="flex items-center gap-2 rounded-md px-1 text-left">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-label font-bold text-brand-contrast">{brandInitials(brand)}</span>
          <span className="truncate text-body font-semibold text-ink group-data-[collapsible=icon]:hidden">{brand}</span>
        </button>
      </SidebarHeader>
      <SidebarContent className="gap-0 py-2">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="h-6 text-label text-ink-subtle">{group.label}</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => item.children
                ? <NavParent key={item.label} label={item.label} childItems={item.children} currentPath={currentPath} onNavigate={onNavigate} />
                : <NavLeaf key={item.path} item={item} currentPath={currentPath} onNavigate={onNavigate} />)}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-line p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-control">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-label font-semibold text-ink">{brandInitials(userName)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{userName}</span>
                <span className="block truncate text-label text-ink-subtle">{roleLabel}</span>
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onNavigate("/")}>Lihat halaman publik</DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout} className="text-danger focus:text-danger"><LogOut className="mr-2 size-4" />Keluar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavLeaf({ item, currentPath, onNavigate }: { item: BackOfficeDestination; currentPath: string; onNavigate: (path: string) => void }) {
  const Icon = iconFor(item.path);
  const isActive = currentPath === item.path;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} tooltip={item.label} aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(item.path)} className={`h-8 text-body text-ink-muted ${activeItem}`}>
        <Icon className="size-4" />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Terbuka dengan sendirinya bila memuat halaman aktif, supaya tautan langsung tidak menyembunyikan menunya. */
function NavParent({ label, childItems, currentPath, onNavigate }: {
  label: string;
  childItems: BackOfficeDestination[];
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const holdsCurrentPage = childItems.some((child) => child.path === currentPath);
  const [open, setOpen] = useState(holdsCurrentPage);
  const Icon = parentIconFor(label);
  return (
    <Collapsible open={open || holdsCurrentPage} onOpenChange={setOpen} className="group/collapsible" asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={label} className="h-8 text-body text-ink-muted">
            <Icon className="size-4" />
            <span>{label}</span>
            <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 border-line">
            {childItems.map((child) => {
              const isActive = currentPath === child.path;
              return (
                <SidebarMenuSubItem key={child.path}>
                  <SidebarMenuSubButton isActive={isActive} aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(child.path)} className={`h-7 cursor-pointer text-body text-ink-muted ${activeItem}`}>
                    <span>{child.label}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
```

- [x] **Step 7: Tulis ulang `client/src/components/DashboardLayout.tsx`**

Ganti seluruh isinya dengan:

```tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { trpc } from "@/lib/trpc";
import type { BackOfficeRole } from "@shared/backOfficeNavigation";
import type { CSSProperties, ReactNode } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { AccessPanel } from "./shell/AccessPanel";
import { accessStateFor } from "./shell/accessState";
import { AppHeader } from "./shell/AppHeader";
import { AppSidebar } from "./shell/AppSidebar";
import { brandName } from "./shell/brand";
import { pageTitleFor } from "./shell/pageTitle";

function goTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const ROLE_LABELS: Record<string, string> = { STAFF: "Staf", ADMIN: "Admin", CONTROLLER: "Controller", SHAREHOLDER: "Pemegang Saham" };

/** Lebar sidebar 232px (spec desain ulang §2.2); `SidebarProvider` menggabungkan `style` di atas bawaannya. */
const SHELL_STYLE = { "--sidebar-width": "14.5rem" } as CSSProperties;

/**
 * Shell back office. Halaman yang belum dibangun ulang dirender apa adanya di area isi — itulah
 * pendekatan A yang disetujui: modul lama dan baru hidup berdampingan sampai modulnya tiba.
 */
export default function DashboardLayout({ children, minimumRole = "STAFF" }: { children: ReactNode; minimumRole?: BackOfficeRole }) {
  const { loading, user, logout } = useAuth();
  const access = accessStateFor({ loading, user }, minimumRole);
  const profile = trpc.companyProfile.get.useQuery(undefined, { enabled: access === "ALLOWED", staleTime: 5 * 60_000 });

  if (access === "LOADING") return <DashboardLayoutSkeleton />;
  if (access === "SIGNED_OUT") return <AccessPanel title="Silakan masuk dulu" detail="Halaman ini hanya untuk staf. Masuk dengan akun yang diberikan pemilik usaha Anda." action="Masuk" onAction={() => goTo("/login")} />;
  if (access === "MUST_CHANGE_PASSWORD") return <AccessPanel title="Ganti kata sandi awal Anda" detail="Sebelum mulai bekerja, buat kata sandi pribadi yang hanya Anda ketahui." action="Ganti kata sandi" onAction={() => goTo("/ubah-sandi")} />;
  if (access === "FORBIDDEN") return <AccessPanel title="Halaman ini bukan untuk peran Anda" detail={`Hanya ${ROLE_LABELS[minimumRole]} ke atas yang dapat membukanya. Minta pemilik usaha meninjau akses Anda bila perlu.`} action="Kembali ke Hari Ini" onAction={() => goTo("/operasional")} />;

  const currentPath = window.location.pathname;
  const page = pageTitleFor(currentPath);
  const brand = brandName(profile.data);

  return (
    <SidebarProvider style={SHELL_STYLE}>
      <AppSidebar
        brand={brand}
        role={user!.role as BackOfficeRole}
        userName={user!.name || user!.username || "Pengguna"}
        roleLabel={ROLE_LABELS[user!.role] ?? user!.role}
        currentPath={currentPath}
        onNavigate={goTo}
        onLogout={logout}
      />
      <SidebarInset className="min-w-0 bg-surface">
        <AppHeader group={page.group} title={page.title} onOpenSearch={() => {}} />
        <main className="min-w-0 flex-1 px-gutter py-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

`auth.me` mengembalikan `username` (`safeUser` di `server/routers.ts`), jadi `user!.name || user!.username` aman dipakai.

- [x] **Step 8: Daftarkan ke fondasi, jalankan uji**

Tambahkan ke `FOUNDATION_FILES`:

```ts
  "client/src/components/DashboardLayout.tsx",
  "client/src/components/shell/accessState.ts",
  "client/src/components/shell/brand.ts",
  "client/src/components/shell/pageTitle.ts",
  "client/src/components/shell/navigationIcons.ts",
  "client/src/components/shell/AccessPanel.tsx",
  "client/src/components/shell/AppHeader.tsx",
  "client/src/components/shell/AppSidebar.tsx",
```

Run: `./node_modules/.bin/vitest run client/src/components/shell client/src/designFoundation.guard.test.ts server/backOfficeNavigation.test.ts`
Expected: seluruhnya PASS.

- [x] **Step 9: Perintah mutu dan periksa di peramban**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

Buka `http://localhost:3000/operasional`, `/operasional/stock/kas-awal`, dan `/kepatuhan/ira` (peramban yang sudah masuk) pada lebar 1280px: kepala 48px, sidebar 232px dengan delapan kelompok, butir aktif beraksen, sidebar dapat diciutkan, isi halaman lama tampil utuh tanpa terpotong. Tangkap layarnya.

- [x] **Step 10: Commit**

```bash
git add client/src/components/DashboardLayout.tsx client/src/components/shell client/src/designFoundation.ts
git commit -m "Shell aplikasi baru: kepala 48px, sidebar 232px per tugas, merek dari Profil Perusahaan"
```

---

### Task 7A: Palet dan token Konter Tebal

Ditambahkan 13 September 2026 dari `docs/superpowers/specs/2026-09-13-tema-konter-tebal-dan-papan-kurs-design.md` Bagian A1–A3. Tidak ada perubahan skema.

**Files:**
- Create: `client/src/lib/utils.test.ts`, `shared/themePalettes.ts`, `shared/themePalettes.test.ts`
- Modify: `client/src/lib/utils.ts`, `shared/accentColor.ts`, `shared/accentColor.test.ts`, `client/src/lib/brandAccent.ts`, `client/src/lib/brandAccent.test.tsx`, `client/src/designFoundation.guard.test.ts`, `client/src/index.css`, `client/index.html`

**Interfaces:**
- Consumes: `normalizeHexColor`, `contrastRatio`, `resolveAccent`, `MIN_CONTRAST`, `LIGHT_TEXT`, `DARK_TEXT` (Tugas 2); token Tugas 3
- Produces:
  - `cn(...)` mengenal `text-body|label|title`, `shadow-hard|tile|focus`, dan spasi `control|control-sm|row|row-dense|header|gutter`
  - `type ThemePaletteId = "MARUN" | "ZAMRUD" | "SAMUDRA" | "TERAKOTA" | "ANGGUR" | "ARANG"`; `type ThemePalette = { id; name; paper; ink; brand; brandInk; second; secondInk }`; `THEME_PALETTES: readonly ThemePalette[]`; `DEFAULT_PALETTE_ID = "MARUN"`; `paletteById(id: string | null | undefined): ThemePalette`
  - `PRODUCT_ACCENT = "#7A1F2E"`; `resolveAccent(candidate, fallback?: { accent: string; contrast: string })`
  - `applyTheme(root: HTMLElement, paletteId: string | null | undefined, customBrand?: string | null): { palette: ThemePalette; brand: AccentResolution }` — **menggantikan** `applyBrandAccent`; menulis `--paper --ink --brand --brand-contrast --second --second-contrast` dan atribut `data-tema`
  - Utilitas Tailwind: `bg-paper`, `bg-second`, `text-second-contrast`, `border-line-quiet`, `shadow-hard`, `shadow-tile`, `shadow-focus`, `font-heading`

- [ ] **Step 1: Tulis uji yang gagal**

`client/src/lib/utils.test.ts`:

```ts
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
```

`shared/themePalettes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MIN_CONTRAST, PRODUCT_ACCENT, contrastRatio, normalizeHexColor } from "./accentColor";
import { DEFAULT_PALETTE_ID, THEME_PALETTES, paletteById } from "./themePalettes";

describe("palet tema Konter Tebal", () => {
  it("enam palet berurutan dengan Marun sebagai bawaan dan aksen produk", () => {
    expect(THEME_PALETTES.map((palette) => palette.id)).toEqual(["MARUN", "ZAMRUD", "SAMUDRA", "TERAKOTA", "ANGGUR", "ARANG"]);
    expect(DEFAULT_PALETTE_ID).toBe("MARUN");
    expect(paletteById(DEFAULT_PALETTE_ID).brand).toBe(PRODUCT_ACCENT);
  });

  it.each(THEME_PALETTES.map((palette) => [palette.id, palette] as const))("%s: heks sah dan setiap pasangan lolos AA", (_id, palette) => {
    for (const value of [palette.paper, palette.ink, palette.brand, palette.brandInk, palette.second, palette.secondInk]) {
      expect(normalizeHexColor(value)).toBe(value);
    }
    expect(contrastRatio(palette.ink, palette.paper)!).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(palette.brandInk, palette.brand)!).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(palette.secondInk, palette.second)!).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("id yang tidak dikenal atau kosong jatuh ke palet bawaan", () => {
    expect(paletteById("TIDAK-ADA").id).toBe("MARUN");
    expect(paletteById(null).id).toBe("MARUN");
  });
});
```

Tambahkan di akhir `describe("resolveAccent", …)` pada `shared/accentColor.test.ts`:

```ts
  it("pasangan pengganti dapat ditentukan pemanggil (warna utama palet terpilih)", () => {
    const zamrud = { accent: "#0F5A41", contrast: "#F1F6EE" };
    expect(resolveAccent("#7A7A7A", zamrud)).toMatchObject({ accent: "#0F5A41", contrast: "#F1F6EE", usedFallback: true, reason: "LOW_CONTRAST" });
    expect(resolveAccent(null, zamrud)).toMatchObject({ accent: "#0F5A41", contrast: "#F1F6EE", usedFallback: false, reason: null });
  });
```

Ganti seluruh isi `client/src/lib/brandAccent.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { DARK_TEXT, LIGHT_TEXT } from "@shared/accentColor";
import { paletteById } from "@shared/themePalettes";
import { applyTheme } from "./brandAccent";

describe("applyTheme", () => {
  it("menulis keenam variabel palet terpilih dan menandai wadahnya", () => {
    const element = document.createElement("div");
    const zamrud = paletteById("ZAMRUD");
    applyTheme(element, "ZAMRUD");
    expect(element.style.getPropertyValue("--paper")).toBe(zamrud.paper);
    expect(element.style.getPropertyValue("--ink")).toBe(zamrud.ink);
    expect(element.style.getPropertyValue("--brand")).toBe(zamrud.brand);
    expect(element.style.getPropertyValue("--brand-contrast")).toBe(zamrud.brandInk);
    expect(element.style.getPropertyValue("--second")).toBe(zamrud.second);
    expect(element.style.getPropertyValue("--second-contrast")).toBe(zamrud.secondInk);
    expect(element.getAttribute("data-tema")).toBe("ZAMRUD");
  });

  it("warna utama sendiri yang lolos kontras menggantikan warna utama palet", () => {
    const element = document.createElement("div");
    const result = applyTheme(element, "MARUN", "#0F766E");
    expect(element.style.getPropertyValue("--brand")).toBe("#0F766E");
    expect(element.style.getPropertyValue("--brand-contrast")).toBe(LIGHT_TEXT);
    expect(result.brand.usedFallback).toBe(false);
  });

  it("warna utama sendiri yang gagal kontras diganti warna utama palet terpilih, beserta alasannya", () => {
    const element = document.createElement("div");
    const result = applyTheme(element, "SAMUDRA", "#7A7A7A");
    expect(element.style.getPropertyValue("--brand")).toBe(paletteById("SAMUDRA").brand);
    expect(element.style.getPropertyValue("--brand-contrast")).toBe(paletteById("SAMUDRA").brandInk);
    expect(result.brand.reason).toBe("LOW_CONTRAST");
  });

  it("warna utama sendiri yang terang memakai teks gelap", () => {
    const element = document.createElement("div");
    applyTheme(element, null, "#FFD60A");
    expect(element.style.getPropertyValue("--brand-contrast")).toBe(DARK_TEXT);
  });
});
```

Pada `client/src/designFoundation.guard.test.ts`, tambahkan impor sesudah baris `import { PRODUCT_ACCENT } from "@shared/accentColor";`:

```ts
import { DEFAULT_PALETTE_ID, paletteById } from "@shared/themePalettes";
```

dan tambahkan uji terakhir di dalam `describe("penjaga fondasi desain", …)`:

```ts
  it("nilai palet bawaan di CSS sama dengan palet MARUN", () => {
    const css = readFileSync(join(root, "client/src/index.css"), "utf8").toLowerCase();
    const marun = paletteById(DEFAULT_PALETTE_ID);
    const expected = [["--paper", marun.paper], ["--ink", marun.ink], ["--brand", marun.brand], ["--brand-contrast", marun.brandInk], ["--second", marun.second], ["--second-contrast", marun.secondInk]];
    for (const [token, value] of expected) {
      expect(css, token).toContain(`${token}: ${value.toLowerCase()};`);
    }
  });
```

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/lib/utils.test.ts shared/themePalettes.test.ts shared/accentColor.test.ts client/src/lib/brandAccent.test.tsx client/src/designFoundation.guard.test.ts`
Expected: FAIL — setidaknya lima dari enam kasus `cn` gagal (pada 13 September 2026 `text-body`/`text-label` dibuang, sedangkan `text-sm text-body`, `h-9 h-control`, dan `shadow-xs shadow-hard` dipertahankan berdua); `./themePalettes` belum ada (dua berkas); `applyTheme` belum ada; uji pengganti `resolveAccent` gagal karena argumen kedua diabaikan. Sebutkan jumlah kegagalan yang benar-benar terlihat.

- [ ] **Step 3: Perluas `cn`**

Ganti seluruh isi `client/src/lib/utils.ts`:

```ts
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
```

- [ ] **Step 4: Tulis palet dan perbarui aksen**

`shared/themePalettes.ts`:

```ts
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
```

Pada `shared/accentColor.ts`, ganti `export const PRODUCT_ACCENT = "#1D4ED8";` dengan:

```ts
/** Warna utama palet MARUN — aksen produk bila perusahaan belum memilih apa pun (spec 2026-09-13 §A2). */
export const PRODUCT_ACCENT = "#7A1F2E";
```

lalu ganti fungsi `productAccent` dan `resolveAccent` dengan:

```ts
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
```

Ganti seluruh isi `client/src/lib/brandAccent.ts`:

```ts
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
```

- [ ] **Step 5: Token CSS dan font**

Di `client/src/index.css`, dalam `@theme inline { … }`, sesudah baris `--color-info-soft: var(--info-soft);`, tambahkan:

```css
  /* Tema Konter Tebal (spec 2026-09-13 §A2–A3). */
  --color-paper: var(--paper);
  --color-second: var(--second);
  --color-second-contrast: var(--second-contrast);
  --color-line-quiet: var(--line-quiet);
  --shadow-hard: 3px 3px 0 var(--ink);
  --shadow-tile: 4px 4px 0 var(--ink);
  --shadow-focus: 3px 3px 0 var(--brand);
  --font-heading: "Bricolage Grotesque", "Manrope", ui-sans-serif, system-ui, sans-serif;
```

Dalam `:root { … }`, ganti `--sidebar: var(--surface-raised);` dengan `--sidebar: var(--paper);` dan `--sidebar-border: var(--line);` dengan `--sidebar-border: var(--ink);`. Lalu ganti blok berikut:

```css
  /* Fondasi desain: permukaan netral, satu aksen, status yang jelas, kepadatan 1280–1440px. */
  --surface: oklch(0.985 0.003 250);
  --surface-raised: oklch(1 0 0);
  --surface-sunken: oklch(0.96 0.004 250);
  --ink: oklch(0.23 0.02 256);
  --ink-muted: oklch(0.45 0.02 256);
  --ink-subtle: oklch(0.58 0.015 256);
  --line: oklch(0.91 0.006 256);
  --line-strong: oklch(0.82 0.01 256);
  --brand: #1d4ed8;
  --brand-contrast: #ffffff;
```

dengan:

```css
  /* Tema Konter Tebal (spec 2026-09-13 §A1–A2). Keenam variabel palet diganti `applyTheme`; nilai di sini
     palet MARUN dan dijaga `designFoundation.guard.test.ts`. Token turunannya ada di blok `[data-tema]`. */
  --paper: #fff6ea;
  --ink: #1d1414;
  --brand: #7a1f2e;
  --brand-contrast: #fff6ea;
  --second: #f2b33d;
  --second-contrast: #1d1414;
```

Sesudah penutup blok `:root { … }` (sebelum `.dark {`), sisipkan:

```css
/* Token turunan palet. Dideklarasikan juga pada `[data-tema]` supaya wadah yang diberi palet lain lewat
   `applyTheme` menghitung ulang permukaan dan garisnya dari palet wadah itu — variabel yang dihitung di
   :root tidak ikut berubah ketika `--paper` ditimpa pada elemen di bawahnya. */
:root,
[data-tema] {
  --surface: var(--paper);
  --surface-raised: color-mix(in oklab, var(--paper) 30%, white);
  --surface-sunken: color-mix(in oklab, var(--ink) 6%, var(--paper));
  --ink-muted: color-mix(in oklab, var(--ink) 78%, var(--paper));
  --ink-subtle: color-mix(in oklab, var(--ink) 64%, var(--paper));
  --line: color-mix(in oklab, var(--ink) 14%, var(--paper));
  --line-quiet: color-mix(in oklab, var(--ink) 28%, var(--paper));
  --line-strong: var(--ink);
}
```

**Jangan** mengubah `.font-display` — 38 berkas halaman lama memakainya; huruf judul baru bernama `font-heading`.

Di `client/index.html`, ganti `https://fonts.googleapis.com/css2?family=IBM+Plex+Mono` dengan `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Mono` (sisa URL tetap).

- [ ] **Step 6: Jalankan uji berkas ini**

Run: perintah Step 2.
Expected: seluruhnya PASS. Bila satu palet gagal AA, **perbaiki nilainya** di `themePalettes.ts` (dan di tabel spec §A1), jangan melonggarkan uji.

- [ ] **Step 7: Perintah mutu, periksa di peramban, commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
grep -o -- "--paper:#fff6ea\|--line-quiet:[^;]*\|Bricolage" dist/public/assets/*.css client/index.html | sort -u
```

Expected: +2 berkas uji, +17 uji dibanding Tugas 7 (6 `cn` + 8 palet + 1 aksen + 1 `applyTheme` + 1 penjaga); sebutkan angka yang benar-benar terlihat. Buka `http://localhost:3000/operasional` pada 1280×800: shell kini berlatar krem dengan butir menu aktif marun dan teks tinta gelap, halaman lama tetap utuh. Tangkap layarnya. `applyTheme` belum dipanggil aplikasi — pemanggilnya datang di sub-proyek 2 (Profil Perusahaan), jadi seluruh pembeli memakai Marun sampai itu.

```bash
git add client/src/lib/utils.ts client/src/lib/utils.test.ts shared/themePalettes.ts shared/themePalettes.test.ts shared/accentColor.ts shared/accentColor.test.ts client/src/lib/brandAccent.ts client/src/lib/brandAccent.test.tsx client/src/designFoundation.guard.test.ts client/src/index.css client/index.html
git commit -m "Tema Konter Tebal: enam palet teruji kontras, token, font judul, cn mengenal token"
```

---

### Task 7B: Gaya ulang pola dan shell Konter Tebal

Spec 2026-09-13 Bagian A4 (intensitas B). **Struktur dan uji perilaku komponen tidak berubah**; satu-satunya tambahan props adalah `StatTile.tone` opsional (bawaan `"plain"`), untuk blok warna padat.

**Files:**
- Create: `client/src/components/patterns/tebal.ts`, `client/src/components/shell/AppSidebar.test.tsx`
- Modify: `client/src/components/patterns/{PageHeader,PageStates,StatTile,DataTable,ListDetailLayout,FormSection,StepFlow,ReportLayout}.tsx`, `client/src/components/shell/{AppHeader,AppSidebar,AccessPanel}.tsx`, `client/src/designFoundation.ts`

**Interfaces:**
- Consumes: `cn` yang sudah diperluas dan utilitas Tugas 7A
- Produces:
  - `BOLD_BUTTON`, `OUTLINE_BUTTON`, `QUIET_FIELD`, `FOCUS_RING` (string kelas) dari `client/src/components/patterns/tebal.ts`
  - `StatTile({ label, value, hint?, onOpen?, tone?: "plain" | "brand" | "second" })`
  - Butir induk sidebar ber-`data-active="true"` bila memuat halaman aktif; hanya pada mode ikon ia mendapat blok aksen.

- [ ] **Step 1: Tulis uji sidebar yang gagal**

`client/src/components/shell/AppSidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

function renderSidebar(currentPath: string, open: boolean) {
  return render(
    <SidebarProvider defaultOpen={open}>
      <AppSidebar brand="Contoh Valuta" role="SHAREHOLDER" userName="Uji" roleLabel="Pemegang Saham" currentPath={currentPath} onNavigate={() => {}} onLogout={() => {}} />
    </SidebarProvider>,
  );
}

const buttonLabelled = (label: string) => screen.getAllByRole("button").find((button) => button.textContent?.trim() === label)!;

describe("AppSidebar", () => {
  it("induk yang memuat halaman aktif ditandai aktif, supaya rel ikon tetap menunjukkan posisi", () => {
    renderSidebar("/operasional/stock/kas-awal", false);
    expect(buttonLabelled("Uang Kas").getAttribute("data-active")).toBe("true");
    expect(buttonLabelled("Kurs").getAttribute("data-active")).toBe("false");
  });

  it("butir daun aktif memakai aria-current", () => {
    renderSidebar("/kepatuhan/ira", true);
    expect(buttonLabelled("Penilaian Risiko (IRA)").getAttribute("aria-current")).toBe("page");
  });
});
```

Diperiksa 13 September 2026 dengan uji sementara: `AppSidebar` dapat dirender di jsdom dalam `SidebarProvider`, dan induk "Uang Kas" pada `/operasional/stock/kas-awal` saat ini ber-`data-active="false"`.

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/components/shell/AppSidebar.test.tsx`
Expected: uji pertama FAIL (`expected 'false' to be 'true'`); uji kedua PASS.

- [ ] **Step 3: Tulis kelas bersama**

`client/src/components/patterns/tebal.ts`:

```ts
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

/** Input dan wadah kerja yang tenang; saat difokus mendapat garis tinta dan bayangan aksen. */
export const QUIET_FIELD =
  "rounded-lg border-[1.5px] border-line-quiet bg-surface-raised shadow-none focus-visible:border-2 focus-visible:border-ink focus-visible:shadow-focus focus-visible:ring-0";

/** Cincin fokus untuk elemen tebal yang dapat diklik (ubin, baris). */
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
```

Tambahkan `"client/src/components/patterns/tebal.ts",` ke `FOUNDATION_FILES`.

- [ ] **Step 4: Gaya ulang pola**

Ganti seluruh isi setiap berkas berikut.

`client/src/components/patterns/PageHeader.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * Kepala halaman: judul dalam bahasa sehari-hari, istilah resmi BI/PPATK sebagai label kecil di bawahnya
 * (panduan bahasa), deskripsi singkat, dan tindakan halaman di kanan. Huruf judul Konter Tebal pada
 * ukuran judul 20px spec program §2.2.
 */
export function PageHeader({ title, description, officialLabel, actions }: {
  title: string;
  description?: string;
  officialLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
      <div className="min-w-0">
        <h1 className="font-heading text-title font-extrabold tracking-tight text-ink">{title}</h1>
        {officialLabel ? <p className="mt-0.5 text-label font-semibold text-ink-subtle">{officialLabel}</p> : null}
        {description ? <p className="mt-1 max-w-3xl text-body text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
```

`client/src/components/patterns/PageStates.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Inbox } from "lucide-react";
import { BOLD_BUTTON, OUTLINE_BUTTON } from "./tebal";

export function LoadingState({ rows = 3, label = "Memuat…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-row w-full rounded-lg bg-surface-sunken" />)}
    </div>
  );
}

/** Keadaan kosong wajib menyebut langkah berikutnya — "Tidak ada data" saja tidak menolong siapa pun. */
export function EmptyState({ title, nextStep, actionLabel, onAction }: {
  title: string;
  nextStep: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-[0.75rem] border-[1.5px] border-dashed border-line-quiet bg-surface-raised px-4 py-8 text-center">
      <Inbox aria-hidden className="mx-auto size-6 text-ink-subtle" />
      <p className="mt-2 text-body font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-body text-ink-muted">{nextStep}</p>
      {actionLabel && onAction ? <Button className={`mt-3 ${BOLD_BUTTON}`} onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}

/** Pesan galat menyebut apa yang terjadi dan apa yang harus dilakukan (panduan bahasa). */
export function ErrorState({ what, nextStep, onRetry }: { what: string; nextStep: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-[0.75rem] border-[1.5px] border-danger/40 bg-danger-soft px-4 py-3">
      <p className="flex items-center gap-2 text-body font-bold text-danger">
        <AlertTriangle aria-hidden className="size-4" />
        {what}
      </p>
      <p className="mt-1 text-body text-ink-muted">{nextStep}</p>
      {onRetry ? <Button variant="outline" className={`mt-2 ${OUTLINE_BUTTON} h-control-sm`} onClick={onRetry}>Coba lagi</Button> : null}
    </div>
  );
}
```

`client/src/components/patterns/StatTile.tsx`:

```tsx
import { FOCUS_RING } from "./tebal";

const TONES = {
  plain: "bg-surface-raised text-ink",
  brand: "bg-brand text-brand-contrast",
  second: "bg-second text-second-contrast",
} as const;

/** Ubin angka Konter Tebal: blok bergaris tinta dengan bayangan keras. `tone` memilih blok utama, kedua, atau polos. */
export function StatTile({ label, value, hint, onOpen, tone = "plain" }: {
  label: string;
  value: string;
  hint?: string;
  onOpen?: () => void;
  tone?: keyof typeof TONES;
}) {
  const body = (
    <>
      <p className="text-label font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 font-heading text-2xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-label font-semibold opacity-80">{hint}</p> : null}
    </>
  );
  const frame = `rounded-[0.75rem] border-2 border-ink p-3 shadow-tile ${TONES[tone]}`;
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`${frame} text-left transition-transform hover:-translate-x-px hover:-translate-y-px motion-reduce:transition-none ${FOCUS_RING}`}>
      {body}
    </button>
  ) : (
    <div className={frame}>{body}</div>
  );
}
```

`client/src/components/patterns/DataTable.tsx`:

```tsx
import type { ReactNode } from "react";

export type Column<Row> = { key: string; header: string; cell: (row: Row) => ReactNode; align?: "left" | "right" };

/**
 * Tabel padat: kepala tebal (blok tinta), baris tenang 36px (32px bila `dense`), dipilih dengan klik atau
 * Enter, angka rata kanan.
 */
export function DataTable<Row>({ columns, rows, rowKey, onSelect, selectedKey = null, dense = false, caption }: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onSelect?: (row: Row) => void;
  selectedKey?: string | null;
  dense?: boolean;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-[0.75rem] border-[1.5px] border-line-quiet bg-surface-raised">
      <table className="w-full text-body">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-ink text-label text-paper">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`h-row px-3 font-bold uppercase tracking-wide ${column.align === "right" ? "text-right" : "text-left"}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                aria-selected={onSelect ? selected : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onClick={onSelect ? () => onSelect(row) : undefined}
                onKeyDown={onSelect ? (event) => { if (event.key === "Enter") onSelect(row); } : undefined}
                className={`border-t border-line ${dense ? "h-row-dense" : "h-row"} ${onSelect ? "cursor-pointer hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink" : ""} ${selected ? "bg-second/30 font-semibold" : ""}`}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-3 text-ink ${column.align === "right" ? "text-right tabular-nums" : ""}`}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

`client/src/components/patterns/ListDetailLayout.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { useEffect, type ReactNode } from "react";
import { OUTLINE_BUTTON } from "./tebal";

/** Daftar dengan panel detail di samping (≥1280px) — memilih baris tidak meninggalkan daftarnya. */
export function ListDetailLayout({ list, detail, detailTitle, onCloseDetail }: {
  list: ReactNode;
  detail?: ReactNode;
  detailTitle?: string;
  onCloseDetail: () => void;
}) {
  useEffect(() => {
    if (!detail) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseDetail(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail, onCloseDetail]);

  return (
    <div className={detail ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]" : ""}>
      <div className="min-w-0">{list}</div>
      {detail ? (
        <aside aria-label={detailTitle ?? "Detail"} className="min-w-0 rounded-[0.75rem] border-2 border-ink bg-surface-raised shadow-tile">
          <div className="flex h-header items-center justify-between border-b-2 border-ink px-4">
            <p className="font-heading text-body font-extrabold text-ink">{detailTitle}</p>
            <Button variant="outline" size="sm" className={`${OUTLINE_BUTTON} h-control-sm`} onClick={onCloseDetail}>Tutup</Button>
          </div>
          <div className="p-4">{detail}</div>
        </aside>
      ) : null}
    </div>
  );
}
```

`client/src/components/patterns/FormSection.tsx`:

```tsx
import { useId, type ReactNode } from "react";

/**
 * Formulir satu kolom yang dibagi ke bagian bernomor. Bagian kerja: garis tipis (spec 2026-09-13 §A4).
 * Titik tak terlihat menjaga nama aksesibel "2. Data identitas" sementara nomornya tampil sebagai lencana.
 */
export function FormSection({ number, title, description, children }: {
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-b border-line py-4 last:border-b-0">
      <h2 id={headingId} className="flex items-center gap-2 text-body font-bold text-ink">
        <span className="inline-grid size-5 place-items-center rounded-md bg-ink text-label font-extrabold tabular-nums text-paper">{number}</span>
        <span className="sr-only">.</span> {title}
      </h2>
      {description ? <p className="mt-0.5 text-label text-ink-muted">{description}</p> : null}
      <div className="mt-3 grid max-w-2xl gap-3">{children}</div>
    </section>
  );
}

/** Tombol aksi yang menempel di bawah formulir panjang supaya "Simpan" selalu terlihat. */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t-2 border-ink bg-paper px-gutter py-2">
      {children}
    </div>
  );
}
```

`client/src/components/patterns/StepFlow.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { BOLD_BUTTON, OUTLINE_BUTTON } from "./tebal";

export type Step = { id: string; title: string };

/**
 * Alur bertahap bernomor. Tindakan akhir (mis. "Kirim untuk disetujui") disediakan isi langkah terakhir
 * sendiri, karena tiap alur menamai tindakannya berbeda.
 */
export function StepFlow({ steps, currentIndex, onStepChange, canAdvance = true, nextLabel = "Lanjut", backLabel = "Kembali", children }: {
  steps: Step[];
  currentIndex: number;
  onStepChange: (index: number) => void;
  canAdvance?: boolean;
  nextLabel?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;
  return (
    <div className="grid gap-4">
      <ol aria-label="Langkah" className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const tone = index === currentIndex
            ? "border-ink bg-brand text-brand-contrast shadow-hard"
            : index < currentIndex ? "border-transparent text-ink" : "border-transparent text-ink-subtle";
          return (
            <li key={step.id} aria-current={index === currentIndex ? "step" : undefined} className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1 text-label font-bold ${tone}`}>
              <span className="tabular-nums">{index + 1}</span>
              <span>{step.title}</span>
            </li>
          );
        })}
      </ol>
      <div>{children}</div>
      <div className="flex justify-between gap-2 border-t border-line pt-3">
        <Button variant="outline" className={OUTLINE_BUTTON} disabled={isFirst} onClick={() => onStepChange(currentIndex - 1)}>{backLabel}</Button>
        {isLast ? null : <Button className={BOLD_BUTTON} disabled={!canAdvance} onClick={() => onStepChange(currentIndex + 1)}>{nextLabel}</Button>}
      </div>
    </div>
  );
}
```

`client/src/components/patterns/ReportLayout.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { OUTLINE_BUTTON } from "./tebal";

/** Laporan: filter dan ekspor di atas, angka ringkas, lalu tabelnya. */
export function ReportLayout({ filters, summary, table, onExport, exportLabel = "Ekspor" }: {
  filters?: ReactNode;
  summary?: ReactNode;
  table: ReactNode;
  onExport?: () => void;
  exportLabel?: string;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">{filters}</div>
        {onExport ? <Button variant="outline" className={OUTLINE_BUTTON} onClick={onExport}>{exportLabel}</Button> : null}
      </div>
      {summary ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary}</div> : null}
      {table}
    </div>
  );
}
```

- [ ] **Step 5: Gaya ulang shell**

`client/src/components/shell/AppHeader.tsx`:

```tsx
import { OUTLINE_BUTTON } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search } from "lucide-react";

/**
 * Kepala 48px: pemicu sidebar, kelompok › judul, dan pencarian ⌘K. Judulnya bukan heading — h1 milik
 * `PageHeader` halaman. Slot pengalih perusahaan (spec §2.4) sengaja belum dirender sampai
 * multi-perusahaan benar-benar ada.
 */
export function AppHeader({ group, title, onOpenSearch }: { group: string; title: string; onOpenSearch: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-header items-center gap-3 border-b-2 border-ink bg-paper px-gutter">
      <SidebarTrigger className="size-8 rounded-lg text-ink hover:bg-surface-sunken" />
      <nav aria-label="Jejak" className="flex min-w-0 items-center gap-1.5 text-body">
        <span className="shrink-0 font-semibold text-ink-subtle">{group}</span>
        <span aria-hidden className="text-ink-subtle">›</span>
        <span aria-current="page" className="truncate font-bold text-ink">{title}</span>
      </nav>
      <Button type="button" variant="outline" onClick={onOpenSearch} className={`ml-auto ${OUTLINE_BUTTON} h-control-sm gap-2 text-ink-muted`}>
        <Search aria-hidden className="size-4" />
        <span>Cari halaman</span>
        <kbd className="rounded border border-line-quiet px-1 text-label text-ink-subtle">⌘K</kbd>
      </Button>
    </header>
  );
}
```

`client/src/components/shell/AccessPanel.tsx`:

```tsx
import { BOLD_BUTTON } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { LockKeyhole } from "lucide-react";

/** Satu panel untuk belum masuk, wajib ganti sandi, dan kewenangan kurang. */
export function AccessPanel({ title, detail, action, onAction }: { title: string; detail: string; action: string; onAction: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-[0.75rem] border-2 border-ink bg-surface-raised p-6 text-center shadow-tile">
        <LockKeyhole aria-hidden className="mx-auto size-6 text-ink" />
        <h1 className="mt-3 font-heading text-title font-extrabold text-ink">{title}</h1>
        <p className="mt-2 text-body text-ink-muted">{detail}</p>
        <Button onClick={onAction} className={`mt-5 w-full ${BOLD_BUTTON}`}>{action}</Button>
      </div>
    </div>
  );
}
```

`client/src/components/shell/AppSidebar.tsx`:

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { visibleBackOfficeNavigation, type BackOfficeDestination, type BackOfficeRole } from "@shared/backOfficeNavigation";
import { ChevronRight, LogOut } from "lucide-react";
import { useState } from "react";
import { brandInitials } from "./brand";
import { iconFor, parentIconFor } from "./navigationIcons";

/** Butir aktif Konter Tebal: blok aksen bergaris tinta. Garis transparan pada keadaan biasa mencegah lompatan 2px. */
const activeItem = "border-2 border-transparent data-[active=true]:border-ink data-[active=true]:bg-brand data-[active=true]:text-brand-contrast data-[active=true]:font-bold data-[active=true]:shadow-hard";

/**
 * Induk ditandai aktif bila memuat halaman aktif. Saat terbuka, anaknya sudah membawa blok aksen, jadi
 * induk hanya menebal; pada rel ikon anaknya tidak dirender, sehingga induklah yang mendapat blok aksen.
 */
const parentItem = "border-2 border-transparent data-[active=true]:bg-transparent data-[active=true]:font-bold data-[active=true]:text-ink group-data-[collapsible=icon]:data-[active=true]:border-ink group-data-[collapsible=icon]:data-[active=true]:bg-brand group-data-[collapsible=icon]:data-[active=true]:text-brand-contrast group-data-[collapsible=icon]:data-[active=true]:shadow-hard";

export function AppSidebar({ brand, role, userName, roleLabel, currentPath, onNavigate, onLogout }: {
  brand: string;
  role: BackOfficeRole;
  userName: string;
  roleLabel: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  const groups = visibleBackOfficeNavigation(role);
  return (
    <Sidebar collapsible="icon" className="border-ink group-data-[side=left]:border-r-2">
      <SidebarHeader className="h-header justify-center border-b-2 border-ink px-2">
        <button type="button" onClick={() => onNavigate("/operasional")} className="flex items-center gap-2 rounded-md px-1 text-left">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-brand font-heading text-label font-extrabold text-brand-contrast shadow-hard">{brandInitials(brand)}</span>
          <span className="truncate font-heading text-body font-extrabold text-ink group-data-[collapsible=icon]:hidden">{brand}</span>
        </button>
      </SidebarHeader>
      <SidebarContent className="gap-0 py-2">
        {/* shrink-0: tanpa ini kelompok diperas oleh kolom flex ketika menu lebih tinggi daripada layar
            (1280×800, peran Shareholder) dan butirnya saling menimpa alih-alih bergulir. */}
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="shrink-0 py-1">
            <SidebarGroupLabel className="h-6 text-label font-extrabold uppercase tracking-wider text-ink-subtle">{group.label}</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => item.children
                ? <NavParent key={item.label} label={item.label} childItems={item.children} currentPath={currentPath} onNavigate={onNavigate} />
                : <NavLeaf key={item.path} item={item} currentPath={currentPath} onNavigate={onNavigate} />)}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t-2 border-ink p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-control">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-second text-label font-bold text-second-contrast">{brandInitials(userName)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-ink">{userName}</span>
                <span className="block truncate text-label text-ink-subtle">{roleLabel}</span>
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onNavigate("/")}>Lihat halaman publik</DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout} className="text-danger focus:text-danger"><LogOut className="mr-2 size-4" />Keluar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavLeaf({ item, currentPath, onNavigate }: { item: BackOfficeDestination; currentPath: string; onNavigate: (path: string) => void }) {
  const Icon = iconFor(item.path);
  const isActive = currentPath === item.path;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} tooltip={item.label} aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(item.path)} className={`h-8 text-body text-ink-muted ${activeItem}`}>
        <Icon className="size-4" />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Terbuka dengan sendirinya bila memuat halaman aktif, supaya tautan langsung tidak menyembunyikan menunya. */
function NavParent({ label, childItems, currentPath, onNavigate }: {
  label: string;
  childItems: BackOfficeDestination[];
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const holdsCurrentPage = childItems.some((child) => child.path === currentPath);
  const [open, setOpen] = useState(holdsCurrentPage);
  const Icon = parentIconFor(label);
  return (
    <Collapsible open={open || holdsCurrentPage} onOpenChange={setOpen} className="group/collapsible" asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={holdsCurrentPage} tooltip={label} className={`h-8 text-body text-ink-muted ${parentItem}`}>
            <Icon className="size-4" />
            <span>{label}</span>
            <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 border-l-2 border-ink">
            {childItems.map((child) => {
              const isActive = currentPath === child.path;
              return (
                <SidebarMenuSubItem key={child.path}>
                  <SidebarMenuSubButton isActive={isActive} aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(child.path)} className={`h-7 cursor-pointer text-body text-ink-muted ${activeItem}`}>
                    <span>{child.label}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
```

- [ ] **Step 6: Jalankan uji pola, shell, dan penjaga**

Run: `./node_modules/.bin/vitest run client/src/components/patterns client/src/components/shell client/src/designFoundation.guard.test.ts client/src/lib`
Expected: seluruhnya PASS — uji perilaku Tugas 5–7 tanpa perubahan, dua uji sidebar baru, penjaga warna mentah (termasuk `tebal.ts`).

- [ ] **Step 7: Perintah mutu dan periksa di peramban**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
for c in "font-heading" "shadow-hard" "shadow-tile" "bg-second" "border-line-quiet" "bg-paper"; do printf "%-18s %s\n" "$c" "$(grep -c -- "$c" dist/public/assets/*.css)"; done
```

Expected: +1 berkas, +2 uji dibanding Tugas 7A; setiap utilitas di atas bernilai 1 (CSS terkecil satu baris). Sebutkan angka yang terlihat.

Di peramban yang sudah masuk sebagai Pemegang Saham, buka `/operasional`, `/operasional/stock/kas-awal`, dan `/kepatuhan/ira` pada **1280×800, 1440×900, 1920×1080**. Ukur dengan JavaScript, bukan dikira: tinggi `header` 48; lebar `[data-slot="sidebar-container"]` 232 dan `borderRightWidth` `2px`; tidak ada `[data-slot="sidebar-group"]` yang tingginya lebih kecil dari `scrollHeight`; latar butir aktif `rgb(122, 31, 46)`; tidak ada gulir mendatar tingkat halaman. Ciutkan sidebar di `/operasional/stock/kas-awal`: induk "Uang Kas" berlatar `rgb(122, 31, 46)`. Periksa keenam palet dengan menimpa variabel di konsol (`const p = {…}; for (const [k, v] of Object.entries(p)) document.documentElement.style.setProperty(k, v)` memakai nilai tabel spec §A1) dan tangkap layarnya — lalu muat ulang halaman supaya kembali ke Marun. Tab dari awal halaman: setiap elemen fokus bergaris tinta terlihat.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/patterns client/src/components/shell client/src/designFoundation.ts
git commit -m "Konter Tebal: gaya ulang pola dan shell, induk sidebar menandai halaman aktif pada rel ikon"
```

---

### Task 8: Palet perintah ⌘K dan pintasan konter

**Files:**
- Create: `shared/commandPalette.ts`, `shared/commandPalette.test.ts`, `client/src/components/shell/shortcuts.ts`, `client/src/components/shell/shortcuts.test.tsx`, `client/src/components/shell/CommandPalette.tsx`
- Modify: `client/src/components/DashboardLayout.tsx`, `client/src/designFoundation.ts`

**Interfaces:**
- Consumes: `visibleBackOfficeNavigation`, `BackOfficeRole` (Tugas 4); `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem` (`@/components/ui/command` — `CommandDialog` meneruskan props ke `Dialog`, bukan ke cmdk, jadi **penyaringan diserahkan ke cmdk** lewat `value` tiap butir); `DashboardLayout` (Tugas 7)
- Produces:
  - `type PaletteEntry = { path: string; label: string; group: string }`; `paletteEntries(role: BackOfficeRole): PaletteEntry[]`
  - `isTypingTarget(target: EventTarget | null): boolean`; `type ShortcutAction = "openPalette" | "newTransaction"`; `shortcutFor(event): ShortcutAction | null`; `useShortcuts(handlers: Record<ShortcutAction, () => void>): void`
  - `CommandPalette({ open: boolean; onOpenChange: (open: boolean) => void; role: BackOfficeRole; onNavigate: (path: string) => void })`

Catatan cakupan: palet **hanya membuka halaman** (spec §2.4). `Esc` membatalkan lewat perilaku bawaan dialog Radix; tidak ada penangan tambahan.

- [ ] **Step 1: Tulis ujinya**

`shared/commandPalette.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { backOfficeDestinations } from "./backOfficeNavigation";
import { paletteEntries } from "./commandPalette";

describe("paletteEntries", () => {
  it("CONTROLLER melihat seluruh tujuan sidebar, masing-masing dengan kelompoknya", () => {
    const entries = paletteEntries("CONTROLLER");
    expect(entries.map((entry) => entry.path)).toEqual(backOfficeDestinations.map((item) => item.path));
    expect(entries.find((entry) => entry.path === "/operasional/stock/kas-awal")).toEqual({
      path: "/operasional/stock/kas-awal", label: "Kas Awal Hari Ini", group: "Uang & Kurs",
    });
  });

  it("STAFF tidak ditawari halaman di atas kewenangannya", () => {
    const paths = paletteEntries("STAFF").map((entry) => entry.path);
    expect(paths).toContain("/operasional/transaksi");
    expect(paths).not.toContain("/operasional/kurs");
    expect(paths).not.toContain("/operasional/buku-besar");
    expect(paths).not.toContain("/kepatuhan/ira");
  });

  it("ADMIN mendapat IRA dan kurs, tetapi tidak laporan keuangan", () => {
    const paths = paletteEntries("ADMIN").map((entry) => entry.path);
    expect(paths).toContain("/kepatuhan/ira");
    expect(paths).toContain("/operasional/kurs");
    expect(paths).not.toContain("/operasional/laporan-keuangan");
  });
});
```

`client/src/components/shell/shortcuts.test.tsx`:

```tsx
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isTypingTarget, shortcutFor, useShortcuts } from "./shortcuts";

const key = (init: Partial<KeyboardEvent> & { key: string }, target: EventTarget | null = document.body) =>
  ({ metaKey: false, ctrlKey: false, altKey: false, ...init, target }) as KeyboardEvent;

describe("shortcutFor", () => {
  it("⌘K dan Ctrl+K membuka palet, bahkan saat mengetik", () => {
    const input = document.createElement("input");
    expect(shortcutFor(key({ key: "k", metaKey: true }, input))).toBe("openPalette");
    expect(shortcutFor(key({ key: "K", ctrlKey: true }))).toBe("openPalette");
  });

  it("N membuat bon baru dan / membuka palet — kecuali saat mengetik", () => {
    expect(shortcutFor(key({ key: "n" }))).toBe("newTransaction");
    expect(shortcutFor(key({ key: "/" }))).toBe("openPalette");
    const textarea = document.createElement("textarea");
    expect(shortcutFor(key({ key: "n" }, textarea))).toBeNull();
    expect(shortcutFor(key({ key: "/" }, textarea))).toBeNull();
  });

  it("kombinasi dengan tombol pengubah lain tidak dicuri", () => {
    expect(shortcutFor(key({ key: "n", ctrlKey: true }))).toBeNull();
    expect(shortcutFor(key({ key: "n", altKey: true }))).toBeNull();
  });

  it("isTypingTarget mengenali input, select, dan contenteditable", () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    document.body.appendChild(editable);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    editable.remove();
  });
});

describe("useShortcuts", () => {
  it("memanggil penangan yang sesuai dari keydown di window", () => {
    const openPalette = vi.fn();
    const newTransaction = vi.fn();
    function Probe() { useShortcuts({ openPalette, newTransaction }); return null; }
    render(<Probe />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.keyDown(window, { key: "n" });
    expect(openPalette).toHaveBeenCalledOnce();
    expect(newTransaction).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run shared/commandPalette.test.ts client/src/components/shell/shortcuts.test.tsx`
Expected: FAIL — kedua modul belum ada.

- [ ] **Step 3: Tulis implementasinya**

`shared/commandPalette.ts`:

```ts
import { visibleBackOfficeNavigation, type BackOfficeRole } from "./backOfficeNavigation";

export type PaletteEntry = { path: string; label: string; group: string };

/**
 * Halaman yang boleh dibuka lewat ⌘K oleh sebuah peran, dalam urutan sidebar. Diturunkan dari pohon
 * navigasi yang sama dengan sidebar, sehingga palet tidak pernah menawarkan halaman yang ditolak.
 */
export function paletteEntries(role: BackOfficeRole): PaletteEntry[] {
  return visibleBackOfficeNavigation(role).flatMap((group) =>
    group.items.flatMap((item) => (item.children ?? [item]).map((leaf) => ({ path: leaf.path, label: leaf.label, group: group.label }))),
  );
}
```

`client/src/components/shell/shortcuts.ts`:

```ts
import { useEffect, useRef } from "react";

export type ShortcutAction = "openPalette" | "newTransaction";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/** ⌘K/Ctrl+K berlaku di mana pun; N dan / hanya di luar kolom isian, supaya tidak mencuri ketikan. */
export function shortcutFor(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target">): ShortcutAction | null {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") return "openPalette";
  if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return null;
  if (event.key === "n" || event.key === "N") return "newTransaction";
  if (event.key === "/") return "openPalette";
  return null;
}

export function useShortcuts(handlers: Record<ShortcutAction, () => void>) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = shortcutFor(event);
      if (!action) return;
      event.preventDefault();
      latest.current[action]();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
```

`client/src/components/shell/CommandPalette.tsx`:

```tsx
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { paletteEntries } from "@shared/commandPalette";
import type { BackOfficeRole } from "@shared/backOfficeNavigation";
import { useMemo } from "react";
import { iconFor } from "./navigationIcons";

/** ⌘K: membuka halaman mana pun yang diizinkan peran. Penyaringan diserahkan ke cmdk lewat `value`. */
export function CommandPalette({ open, onOpenChange, role, onNavigate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: BackOfficeRole;
  onNavigate: (path: string) => void;
}) {
  const entries = useMemo(() => paletteEntries(role), [role]);
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Buka halaman" description="Ketik nama halaman atau kelompoknya.">
      <CommandInput placeholder="Cari halaman… mis. kas awal, kurs, IRA" />
      <CommandList>
        <CommandEmpty>Tidak ada halaman yang cocok. Coba kata lain, misalnya “kurs” atau “nasabah”.</CommandEmpty>
        <CommandGroup heading="Halaman">
          {entries.map((entry) => {
            const Icon = iconFor(entry.path);
            return (
              <CommandItem
                key={entry.path}
                value={`${entry.label} ${entry.group}`}
                onSelect={() => { onOpenChange(false); onNavigate(entry.path); }}
              >
                <Icon className="size-4 text-ink-subtle" />
                <span className="text-body text-ink">{entry.label}</span>
                <span className="ml-auto text-label text-ink-subtle">{entry.group}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 4: Jalankan uji**

Run: `./node_modules/.bin/vitest run shared/commandPalette.test.ts client/src/components/shell/shortcuts.test.tsx`
Expected: seluruhnya PASS.

- [ ] **Step 5: Pasang palet dan pintasan di shell**

Di `client/src/components/DashboardLayout.tsx`:

1. Tambah impor:

```tsx
import { useState } from "react";
import { CommandPalette } from "./shell/CommandPalette";
import { useShortcuts } from "./shell/shortcuts";
```

   (baris `import type { CSSProperties, ReactNode } from "react";` dibiarkan apa adanya).

2. Tepat sesudah baris `const profile = trpc.companyProfile.get.useQuery(…);` tambahkan (hook harus dipanggil sebelum `return` bersyarat mana pun):

```tsx
  const [paletteOpen, setPaletteOpen] = useState(false);
  useShortcuts({
    openPalette: () => { if (access === "ALLOWED") setPaletteOpen(true); },
    newTransaction: () => { if (access === "ALLOWED") goTo("/operasional/transaksi"); },
  });
```

3. Ganti `<AppHeader … onOpenSearch={() => {}} />` dengan `onOpenSearch={() => setPaletteOpen(true)}`.

4. Sesudah `</SidebarInset>` dan sebelum `</SidebarProvider>`, tambahkan:

```tsx
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={user!.role as BackOfficeRole} onNavigate={goTo} />
```

Tambahkan ke `FOUNDATION_FILES`:

```ts
  "client/src/components/shell/shortcuts.ts",
  "client/src/components/shell/CommandPalette.tsx",
```

- [ ] **Step 6: Perintah mutu dan periksa di peramban**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

Di `http://localhost:3000/operasional`: ⌘K membuka palet, mengetik "kas awal" menyisakan *Kas Awal Hari Ini*, Enter membuka halamannya, Esc menutup palet; `N` di luar kolom isian membuka Buat Transaksi; `N` di dalam kolom isian mengetik huruf n.

- [ ] **Step 7: Commit**

```bash
git add shared/commandPalette.ts shared/commandPalette.test.ts client/src/components/shell/shortcuts.ts client/src/components/shell/shortcuts.test.tsx client/src/components/shell/CommandPalette.tsx client/src/components/DashboardLayout.tsx client/src/designFoundation.ts
git commit -m "Palet perintah ⌘K dan pintasan konter N dan /"
```

---

### Task 9: Galeri pola `/operasional/pola`

**Files:**
- Create: `client/src/pages/GaleriPola.tsx`, `client/src/pages/GaleriPola.test.tsx`
- Modify: `client/src/App.tsx` (impor lazy + rute), `client/src/designFoundation.ts`

**Interfaces:**
- Consumes: seluruh pola Tugas 5 dan 6; token Tugas 3; `OperationsRoute` di `App.tsx`
- Produces: rute `/operasional/pola` (CONTROLLER ke atas, **tidak** di sidebar); halaman berisi bagian ber-`id` tetap yang dipotret Playwright di Tugas 11: `token`, `palet`, `kepala-halaman`, `keadaan`, `ubin`, `tabel`, `daftar-detail`, `formulir`, `alur`, `laporan`. Bagian `palet` memuat pratinjau keenam palet (spec 2026-09-13 §A6) dengan tombol radio berlabel nama palet dan wadah `data-testid="pratinjau-palet"`; pilihannya **tidak disimpan**.
- Consumes (tambahan Tugas 7A–7B): `THEME_PALETTES`, `applyTheme`, `BOLD_BUTTON`, `OUTLINE_BUTTON`, `QUIET_FIELD`, `StatTile.tone`

- [ ] **Step 1: Tulis ujinya**

`client/src/pages/GaleriPola.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { paletteById } from "@shared/themePalettes";
import GaleriPola from "./GaleriPola";

describe("GaleriPola", () => {
  it("memuat setiap pola dan setiap keadaan dengan data contoh statis", () => {
    const { container } = render(<GaleriPola />);
    for (const id of ["token", "palet", "kepala-halaman", "keadaan", "ubin", "tabel", "daftar-detail", "formulir", "alur", "laporan"]) {
      expect(container.querySelector(`section#${id}`), `bagian #${id}`).not.toBeNull();
    }
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("memilih baris contoh membuka panel detail, dan alur dapat maju", async () => {
    const { container } = render(<GaleriPola />);
    // Bon contoh muncul di tiga tabel galeri; klik yang berada di bagian daftar + detail.
    const bagian = container.querySelector("section#daftar-detail") as HTMLElement;
    await userEvent.click(within(bagian).getByText("FX-2026-0914-001"));
    expect(screen.getByRole("complementary", { name: "Bon FX-2026-0914-001" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(screen.getByText("Nasabah, produk, wilayah").closest("li")!.getAttribute("aria-current")).toBe("step");
  });

  it("pratinjau palet menerapkan palet terpilih hanya pada wadahnya", async () => {
    render(<GaleriPola />);
    await userEvent.click(screen.getByRole("radio", { name: "Zamrud" }));
    const wadah = screen.getByTestId("pratinjau-palet");
    expect(wadah.style.getPropertyValue("--brand")).toBe(paletteById("ZAMRUD").brand);
    expect(wadah.getAttribute("data-tema")).toBe("ZAMRUD");
    expect(document.documentElement.style.getPropertyValue("--brand")).toBe("");
  });
});
```

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/pages/GaleriPola.test.tsx`
Expected: FAIL — `./GaleriPola` belum ada.

- [ ] **Step 3: Tulis halamannya**

`client/src/pages/GaleriPola.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/patterns/DataTable";
import { FormSection, StickyActions } from "@/components/patterns/FormSection";
import { ListDetailLayout } from "@/components/patterns/ListDetailLayout";
import { PageHeader } from "@/components/patterns/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/PageStates";
import { ReportLayout } from "@/components/patterns/ReportLayout";
import { StatTile } from "@/components/patterns/StatTile";
import { StepFlow } from "@/components/patterns/StepFlow";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { applyTheme } from "@/lib/brandAccent";
import { THEME_PALETTES } from "@shared/themePalettes";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Galeri pola — satu halaman yang memperlihatkan setiap token, pola, dan keadaan dengan data contoh
 * statis. Tidak memanggil server sama sekali, sehingga tampilannya stabil untuk dipotret Playwright.
 */

type ContohBon = { id: string; nomor: string; nasabah: string; valuta: string; nilai: string };

const bonContoh: ContohBon[] = [
  { id: "1", nomor: "FX-2026-0914-001", nasabah: "Budi Santoso", valuta: "USD", nilai: "Rp 15.820.000" },
  { id: "2", nomor: "FX-2026-0914-002", nasabah: "Sari Wulandari", valuta: "SGD", nilai: "Rp 4.150.500" },
  { id: "3", nomor: "FX-2026-0914-003", nasabah: "PT Maju Bersama", valuta: "EUR", nilai: "Rp 52.300.000" },
];

const kolomBon: Column<ContohBon>[] = [
  { key: "nomor", header: "Nomor bon", cell: (row) => row.nomor },
  { key: "nasabah", header: "Nasabah", cell: (row) => row.nasabah },
  { key: "valuta", header: "Valuta", cell: (row) => row.valuta },
  { key: "nilai", header: "Nilai Rupiah", cell: (row) => row.nilai, align: "right" },
];

const langkahContoh = [
  { id: "usaha", title: "Tentang usaha Anda" },
  { id: "nasabah", title: "Nasabah, produk, wilayah" },
  { id: "pengendalian", title: "Seberapa siap pengendalian Anda" },
  { id: "hasil", title: "Hasil" },
];

const swatches = [
  ["bg-paper", "Kertas"], ["bg-surface-raised", "Permukaan terangkat"], ["bg-surface-sunken", "Permukaan cekung"], ["bg-ink", "Tinta"],
  ["bg-brand", "Warna utama"], ["bg-second", "Warna kedua"], ["bg-success", "Berhasil"], ["bg-warning", "Perlu perhatian"], ["bg-danger", "Bahaya"], ["bg-info", "Informasi"],
] as const;

/** Pratinjau palet di dalam wadahnya sendiri; tidak menyentuh tema aplikasi dan tidak disimpan. */
function PratinjauPalet() {
  const wadah = useRef<HTMLDivElement>(null);
  const [paletId, setPaletId] = useState<string>(THEME_PALETTES[0].id);
  useEffect(() => {
    if (wadah.current) applyTheme(wadah.current, paletId);
  }, [paletId]);
  return (
    <div>
      <p className="mb-2 text-label font-semibold text-ink-subtle">Pratinjau — tidak disimpan. Pemilik memilih paletnya di Profil Perusahaan.</p>
      <div role="radiogroup" aria-label="Palet" className="mb-3 flex flex-wrap gap-2">
        {THEME_PALETTES.map((palet) => (
          <button key={palet.id} type="button" role="radio" aria-checked={palet.id === paletId} onClick={() => setPaletId(palet.id)} className={palet.id === paletId ? BOLD_BUTTON : OUTLINE_BUTTON}>
            {palet.name}
          </button>
        ))}
      </div>
      <div ref={wadah} data-testid="pratinjau-palet" className="rounded-[0.75rem] border-2 border-ink bg-paper p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Jumlah bon" value="12" tone="brand" />
          <StatTile label="Pembelian" value="Rp 18,4 jt" tone="second" />
          <StatTile label="Penjualan" value="Rp 6,6 jt" />
        </div>
        <div className="mt-3 flex gap-2">
          <Button className={BOLD_BUTTON}>+ Bon baru</Button>
          <Button variant="outline" className={OUTLINE_BUTTON}>Batal</Button>
        </div>
      </div>
    </div>
  );
}

function Bagian({ id, judul, children }: { id: string; judul: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-judul`} className="border-t border-line py-6 first:border-t-0">
      <h2 id={`${id}-judul`} className="mb-3 text-label font-semibold uppercase tracking-wide text-ink-subtle">{judul}</h2>
      {children}
    </section>
  );
}

export default function GaleriPola() {
  const [terpilih, setTerpilih] = useState<ContohBon | null>(null);
  const [langkah, setLangkah] = useState(0);

  return (
    <div className="max-w-6xl">
      <PageHeader title="Galeri pola" description="Setiap layar baru disusun dari pola di halaman ini. Data di sini contoh, bukan data usaha Anda." />

      <Bagian id="token" judul="Token warna dan teks">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {swatches.map(([kelas, nama]) => (
            <div key={kelas} className="overflow-hidden rounded-lg border border-line">
              <div className={`h-10 ${kelas}`} />
              <p className="px-2 py-1 text-label text-ink-muted">{nama}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-title font-semibold text-ink">Judul halaman 20px</p>
        <p className="text-body text-ink">Teks isi 14px — untuk hampir semua kalimat.</p>
        <p className="text-label text-ink-subtle">Label 12px · istilah resmi seperti “Form A1 · TPPU 2A”</p>
      </Bagian>

      <Bagian id="palet" judul="Palet tema">
        <PratinjauPalet />
      </Bagian>

      <Bagian id="kepala-halaman" judul="Kepala halaman">
        <PageHeader
          title="Seberapa berisiko nasabah Anda?"
          officialLabel="Form A1 · Parameter risiko inheren"
          description="Kami sudah mengisi angka yang terhitung dari data bulan ini. Periksa dan koreksi bila perlu."
          actions={<Button className={BOLD_BUTTON}>Simpan draf</Button>}
        />
      </Bagian>

      <Bagian id="keadaan" judul="Keadaan: memuat, kosong, galat">
        <div className="grid gap-3 lg:grid-cols-3">
          <LoadingState label="Memuat contoh daftar" />
          <EmptyState title="Belum ada kas awal hari ini" nextStep="Hitung uang di laci lalu catat sebelum melayani nasabah." actionLabel="Catat kas awal" onAction={() => {}} />
          <ErrorState what="Daftar kurs tidak dapat dimuat." nextStep="Periksa sambungan internet, lalu coba lagi." onRetry={() => {}} />
        </div>
      </Bagian>

      <Bagian id="ubin" judul="Ubin angka">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Transaksi hari ini" value="12" hint="3 menunggu tinjauan" onOpen={() => {}} tone="brand" />
          <StatTile label="Kas Rupiah" value="Rp 25.000.000" tone="second" />
          <StatTile label="Stok USD" value="$ 4.200" hint="Per 09.00 WIB" />
          <StatTile label="Nasabah berisiko tinggi" value="2" hint="Menunggu keputusan Pemegang Saham" onOpen={() => {}} />
        </div>
      </Bagian>

      <Bagian id="tabel" judul="Tabel padat">
        <DataTable columns={kolomBon} rows={bonContoh} rowKey={(row) => row.id} caption="Contoh daftar bon" />
      </Bagian>

      <Bagian id="daftar-detail" judul="Daftar dengan panel detail">
        <ListDetailLayout
          list={<DataTable columns={kolomBon} rows={bonContoh} rowKey={(row) => row.id} onSelect={setTerpilih} selectedKey={terpilih?.id ?? null} caption="Pilih bon untuk melihat detail" />}
          detail={terpilih ? <dl className="grid gap-2 text-body"><div><dt className="text-label text-ink-subtle">Nasabah</dt><dd className="text-ink">{terpilih.nasabah}</dd></div><div><dt className="text-label text-ink-subtle">Nilai Rupiah</dt><dd className="tabular-nums text-ink">{terpilih.nilai}</dd></div></dl> : undefined}
          detailTitle={terpilih ? `Bon ${terpilih.nomor}` : undefined}
          onCloseDetail={() => setTerpilih(null)}
        />
      </Bagian>

      <Bagian id="formulir" judul="Formulir bernomor">
        <div className="rounded-lg border border-line bg-surface-raised">
          <div className="px-gutter">
            <FormSection number={1} title="Identitas nasabah" description="Sesuai dokumen identitas yang ditunjukkan.">
              <div className="grid gap-1"><Label htmlFor="contoh-nama">Nama lengkap</Label><Input id="contoh-nama" className={`h-control ${QUIET_FIELD}`} defaultValue="Budi Santoso" /></div>
              <div className="grid gap-1"><Label htmlFor="contoh-nik">NIK</Label><Input id="contoh-nik" className={`h-control ${QUIET_FIELD}`} defaultValue="3203xxxxxxxxxxxx" /></div>
            </FormSection>
            <FormSection number={2} title="Tujuan transaksi">
              <div className="grid gap-1"><Label htmlFor="contoh-tujuan">Untuk apa valuta ini?</Label><Input id="contoh-tujuan" className={`h-control ${QUIET_FIELD}`} defaultValue="Perjalanan ibadah" /></div>
            </FormSection>
          </div>
          <StickyActions><Button variant="outline" className={OUTLINE_BUTTON}>Batal</Button><Button className={BOLD_BUTTON}>Simpan nasabah</Button></StickyActions>
        </div>
      </Bagian>

      <Bagian id="alur" judul="Alur bertahap">
        <StepFlow steps={langkahContoh} currentIndex={langkah} onStepChange={setLangkah}>
          <p className="text-body text-ink-muted">Isi langkah “{langkahContoh[langkah].title}” tampil di sini.</p>
          {langkah === langkahContoh.length - 1 ? <Button className={`mt-3 ${BOLD_BUTTON}`}>Kirim untuk disetujui</Button> : null}
        </StepFlow>
      </Bagian>

      <Bagian id="laporan" judul="Laporan">
        <ReportLayout
          filters={<div className="grid gap-1"><Label htmlFor="contoh-periode">Periode</Label><Input id="contoh-periode" className={`h-control w-44 ${QUIET_FIELD}`} defaultValue="September 2026" /></div>}
          summary={<><StatTile label="Jumlah bon" value="318" tone="brand" /><StatTile label="Nilai beli" value="Rp 1,92 M" /><StatTile label="Nilai jual" value="Rp 2,04 M" /><StatTile label="Selisih kurs" value="Rp 118 jt" /></>}
          table={<DataTable columns={kolomBon} rows={bonContoh} rowKey={(row) => row.id} dense caption="Contoh laporan transaksi" />}
          onExport={() => {}}
          exportLabel="Ekspor Excel"
        />
      </Bagian>
    </div>
  );
}
```

- [ ] **Step 4: Daftarkan rutenya**

Di `client/src/App.tsx`, sesudah baris `const PenatausahaanDokumen = lazy(() => import("./pages/PenatausahaanDokumen"));` tambahkan:

```tsx
const GaleriPola = lazy(() => import("./pages/GaleriPola"));
```

Sesudah baris rute `/kepatuhan/penatausahaan-dokumen`, tambahkan:

```tsx
      <Route path="/operasional/pola"><OperationsRoute minimumRole="CONTROLLER" page={<GaleriPola />} /></Route>
```

Tambahkan `"client/src/pages/GaleriPola.tsx",` ke `FOUNDATION_FILES`.

- [ ] **Step 5: Jalankan uji**

Run: `./node_modules/.bin/vitest run client/src/pages/GaleriPola.test.tsx client/src/designFoundation.guard.test.ts server/backOfficeNavigation.test.ts`
Expected: seluruhnya PASS (galeri bukan tujuan sidebar, jadi peta navigasi tidak berubah).

- [ ] **Step 6: Perintah mutu, periksa ketiga ukuran, commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

Buka `http://localhost:3000/operasional/pola` pada lebar 1280, 1440, dan 1920: tidak ada yang terpotong atau menggulir mendatar di luar tabel; panel detail muncul di samping pada ≥1280px.

```bash
git add client/src/pages/GaleriPola.tsx client/src/pages/GaleriPola.test.tsx client/src/App.tsx client/src/designFoundation.ts
git commit -m "Galeri pola /operasional/pola untuk seluruh token, pola, dan keadaan"
```

---

### Task 10: Panduan suara dan bahasa

**Files:**
- Create: `docs/PANDUAN-SUARA-DAN-BAHASA.md`

**Interfaces:**
- Consumes: spec §2.6; kalimat nyata dari aplikasi hari ini
- Produces: rujukan tertulis yang dipakai tinjauan setiap sub-proyek berikutnya.

- [ ] **Step 1: Tulis panduannya**

`docs/PANDUAN-SUARA-DAN-BAHASA.md` memuat bagian berikut, dengan isi persis seperti di bawah (boleh menambah contoh, tidak boleh mengurangi aturan):

```markdown
# Panduan Suara dan Bahasa

Berlaku untuk setiap layar yang dibangun di atas fondasi desain (Program Desain Ulang Antarmuka,
spec `docs/superpowers/specs/2026-09-12-desain-ulang-antarmuka-design.md` §2.6). Ditegakkan pada
tinjauan setiap sub-proyek. Ekspor, cetakan, dan berkas untuk regulator **tidak** tunduk pada panduan
ini — di sana istilah resmi dipakai apa adanya.

## Tujuh aturan

1. **Indonesia sehari-hari dengan "Anda".** Satu gagasan per kalimat.
2. **Judul berbentuk pertanyaan atau tugas**, bukan nama formulir.
3. **Istilah resmi BI/PPATK tetap ada, sebagai label kecil** di bawah kalimat biasa (`PageHeader.officialLabel`).
4. **Uang dalam Rupiah dengan angka tabular**; tanggal dalam zona operasional perusahaan.
5. **Pesan galat menyebut apa yang terjadi dan apa yang harus dilakukan** (`ErrorState` mewajibkan keduanya).
6. **Keadaan kosong menyebut langkah berikutnya** (`EmptyState` mewajibkan `nextStep`).
7. **Tindakan destruktif selalu lewat dialog yang menyebut nama bendanya.**

## Sebelum dan sesudah — kalimat nyata dari aplikasi

| Sebelum | Sesudah | Label resmi (bila ada) |
|---|---|---|
| Akses operasional terlindungi. | Silakan masuk dulu | — |
| Kewenangan Anda belum mencukupi. | Halaman ini bukan untuk peran Anda | — |
| Form A1 — nilai parameter risiko inheren | Seberapa berisiko nasabah, produk, dan wilayah Anda? | Form A1 · Risiko inheren |
| Kuesioner KPMR & hasil | Seberapa siap pengendalian Anda? | Kuesioner KPMR |
| Form C1 — angka yang terhitung | Tentang usaha Anda bulan ini | Form C1 |
| Ambang pita gagal dimuat. | Batas tingkat risiko tidak dapat dimuat. Muat ulang halaman; bila tetap gagal, hubungi pengelola aplikasi. | — |
| Agregat Form C1 gagal dimuat. | Ringkasan usaha tidak dapat dihitung. Periksa sambungan lalu coba lagi. | Form C1 |
| Alasan / rujukan SRA (wajib) | Mengapa Anda menilai begini? Sebutkan dasarnya. | Rujukan SRA |
| Tidak ada transaksi pada periode ini. | Tidak ada transaksi pada periode ini. Pilih periode lain di atas. | — |
| Terkunci — sudah disetujui | Sudah disetujui, tidak dapat diubah lagi | — |

## Kata yang dipakai secara konsisten

| Pakai | Jangan pakai |
|---|---|
| bon | nota, invoice (untuk transaksi valuta) |
| nasabah | Pengguna Jasa (kecuali label resmi) |
| Pemegang Saham | shareholder |
| kas awal | modal awal harian, opening cash |
| hitung fisik uang | stock opname (kecuali label resmi) |
| nonaktifkan | hapus (bila barisnya tetap tersimpan) |
```

- [ ] **Step 2: Periksa silang dengan kode**

Pastikan setiap kalimat "Sebelum" benar-benar ada di kode (bila tidak, ganti dengan kalimat nyata lain dan sebutkan berkasnya):

```bash
for s in "Akses operasional terlindungi." "Kewenangan Anda belum mencukupi." "Ambang pita gagal dimuat." "Agregat Form C1 gagal dimuat." "Terkunci — sudah disetujui" "Tidak ada transaksi pada periode ini."; do printf "%-40s %s\n" "$s" "$(git grep -l -F "$s" -- client/src | head -1)"; done
```

Catatan: dua kalimat pertama berasal dari `DashboardLayout.tsx` lama; sesudah Tugas 7 keduanya hanya ada di riwayat git (`git log -S`), dan itu cukup sebagai bukti.

- [ ] **Step 3: Commit**

```bash
git add docs/PANDUAN-SUARA-DAN-BAHASA.md
git commit -m "Panduan suara dan bahasa untuk layar di atas fondasi desain"
```

---

### Task 11: Playwright dan basis data visual `mc_t_visual`

**Files:**
- Create: `playwright.config.ts`, `e2e/fixtures.ts`, `e2e/fondasi.spec.ts`, `scripts/visualDb.mjs`, `e2e/__screenshots__/` (baseline hasil Step 6)
- Modify: `package.json` (dependensi `-D` + skrip), `pnpm-lock.yaml`, `.gitignore`

**Interfaces:**
- Consumes: galeri `/operasional/pola` dengan `id` bagian tetap (Tugas 9); shell (Tugas 7–8); `scripts/tenant.mjs provision <kode>` (butuh `ADMIN_DATABASE_URL`, menolak menimpa basis data yang sudah ada); akun uji lokal `test-controller` yang dibuat server sendiri bila `NODE_ENV` bukan produksi (`ensureDevelopmentTestAccounts`); tRPC di `/api/trpc` dengan transformer superjson
- Produces: `./node_modules/.bin/pnpm test:visual` dan `test:visual:update`; baseline tangkapan layar galeri dan shell pada 1280×800, 1440×900, 1920×1080.

- [ ] **Step 1: Pasang Playwright**

```bash
./node_modules/.bin/pnpm add -D @playwright/test@^1
./node_modules/.bin/playwright install chromium
```

Tambahkan ke `package.json` bagian `scripts`:

```json
    "visual:db": "node scripts/visualDb.mjs",
    "test:visual": "playwright test",
    "test:visual:update": "playwright test --update-snapshots"
```

Tambahkan ke `.gitignore`:

```
test-results/
playwright-report/
e2e/.auth/
```

- [ ] **Step 2: Siapkan basis data visual**

`scripts/visualDb.mjs`:

```js
#!/usr/bin/env node
/**
 * Basis data khusus uji tangkapan layar: `mc_t_visual`. Tidak pernah `moneychanger`, tidak pernah
 * produksi. Dibuat lewat `tenant.mjs provision` (membuat basis data dan menerapkan seluruh migrasi),
 * lalu diisi satu baris Profil Perusahaan dengan nama tetap supaya merek pada shell stabil.
 *
 * Aman diulang: basis data yang sudah ada tidak dibuat ulang, dan profilnya hanya disisipkan bila kosong.
 *
 *   ADMIN_DATABASE_URL=mysql://root@127.0.0.1:3306/ node scripts/visualDb.mjs
 */
import { createConnection } from "mysql2/promise";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const DATABASE = "mc_t_visual";
const admin = process.env.ADMIN_DATABASE_URL ?? "mysql://root@127.0.0.1:3306/";
if (process.env.NODE_ENV === "production") throw new Error("Basis data visual hanya untuk mesin lokal.");

const connection = await createConnection({ uri: admin });
const [rows] = await connection.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?", [DATABASE]);
await connection.end();

if (!rows.length) {
  const { stdout } = await run("node", ["scripts/tenant.mjs", "provision", "visual"], { env: { ...process.env, ADMIN_DATABASE_URL: admin } });
  process.stdout.write(stdout);
} else {
  console.log(`${DATABASE} sudah ada — migrasi yang tertunda diterapkan.`);
  const url = new URL(admin);
  url.pathname = `/${DATABASE}`;
  await run("./node_modules/.bin/drizzle-kit", ["migrate"], { env: { ...process.env, DATABASE_URL: url.toString() } });
}

const url = new URL(admin);
url.pathname = `/${DATABASE}`;
const db = await createConnection({ uri: url.toString() });
const [profiles] = await db.query("SELECT id FROM company_profile LIMIT 1");
if (!profiles.length) {
  await db.query("INSERT INTO company_profile (legalEntityName, tradingName, timezone) VALUES (?, ?, ?)", ["PT Contoh Valuta Nusantara", "Contoh Valuta", "Asia/Jakarta"]);
  console.log("Profil Perusahaan contoh disisipkan.");
}
await db.end();
console.log(`${DATABASE} siap.`);
```

Run:

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"
ADMIN_DATABASE_URL=mysql://root@127.0.0.1:3306/ ./node_modules/.bin/pnpm visual:db
mysql -uroot -h127.0.0.1 mc_t_visual -N -e "SELECT COUNT(*) FROM __drizzle_migrations; SELECT tradingName FROM company_profile;"
```
Expected: jumlah migrasi sama dengan jumlah berkas `drizzle/*.sql` (59 pada 12 September 2026), dan `Contoh Valuta`. Kolom wajib tanpa nilai bawaan pada `company_profile` hanya `legalEntityName` dan `tradingName` (diperiksa pada `drizzle/schema.ts` 12 September 2026; `timezone` berbawaan `Asia/Jakarta`), jadi `INSERT` di atas lengkap.

- [ ] **Step 3: Tulis konfigurasi dan fixture**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Uji tangkapan layar fondasi desain. Server dijalankan sendiri terhadap `mc_t_visual` pada port
 * 3100, tidak memakai server pengembangan di 3000 maupun basis data `moneychanger`.
 */
export default defineConfig({
  testDir: "e2e",
  snapshotPathTemplate: "e2e/__screenshots__/{testFilePath}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" } },
  use: { baseURL, locale: "id-ID", timezoneId: "Asia/Jakarta", ...devices["Desktop Chrome"] },
  webServer: {
    command: "./node_modules/.bin/tsx server/_core/index.ts",
    url: `${baseURL}/api/trpc/auth.me`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "development",
      PORT: String(PORT),
      DATABASE_URL: "mysql://root@127.0.0.1:3306/mc_t_visual",
      TENANT_REGISTRY: "",
    },
  },
});
```

`e2e/fixtures.ts`:

```ts
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Masuk lewat prosedur `auth.login`, bukan dengan mengetik di formulir. Akun `test-controller`
 * dibuat server pengembangan sendiri dan ditolak di produksi; kata sandinya adalah konstanta
 * pengembangan di `server/internalAuth.ts`, dan basis datanya `mc_t_visual`.
 */
export const test = base.extend<{ signedInPage: Page }>({
  signedInPage: async ({ page, baseURL }, use) => {
    const response = await page.request.post(`${baseURL}/api/trpc/auth.login?batch=1`, {
      data: { 0: { json: { username: "test-controller", password: "123456" } } },
    });
    expect(response.ok(), `login gagal: ${response.status()}`).toBe(true);
    await page.clock.setFixedTime(new Date("2026-09-14T09:00:00+07:00"));
    await use(page);
  },
});

export { expect };

export const VIEWPORTS = [
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;
```

`e2e/fondasi.spec.ts`:

```ts
import { VIEWPORTS, expect, test } from "./fixtures";

const SECTIONS = ["token", "palet", "kepala-halaman", "keadaan", "ubin", "tabel", "daftar-detail", "formulir", "alur", "laporan"];
const PALETTES = ["Marun", "Zamrud", "Samudra", "Terakota", "Anggur", "Arang"];

for (const viewport of VIEWPORTS) {
  test.describe(`fondasi desain @ ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("shell: kepala 48px, sidebar, dan tanpa gulir mendatar", async ({ signedInPage: page }) => {
      await page.goto("/operasional/pola");
      await expect(page.getByRole("heading", { level: 1, name: "Galeri pola" })).toBeVisible();
      const header = page.locator("header").first();
      expect((await header.boundingBox())!.height).toBe(48);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page).toHaveScreenshot(`shell-${viewport.name}.png`);
    });

    for (const id of SECTIONS) {
      test(`galeri: #${id}`, async ({ signedInPage: page }) => {
        await page.goto("/operasional/pola");
        const section = page.locator(`section#${id}`);
        await section.scrollIntoViewIfNeeded();
        await expect(section).toHaveScreenshot(`${id}-${viewport.name}.png`);
      });
    }

    test("⌘K membuka palet dan menemukan halaman", async ({ signedInPage: page }) => {
      await page.goto("/operasional/pola");
      await page.keyboard.press("ControlOrMeta+k");
      await page.keyboard.type("kas awal");
      await expect(page.getByRole("option", { name: /Kas Awal Hari Ini/ })).toBeVisible();
    });
  });
}

// Satu tangkapan per palet pada ukuran terkecil yang wajib (spec 2026-09-13 §A6).
test.describe("palet tema @ 1280x800", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const name of PALETTES) {
    test(`palet: ${name}`, async ({ signedInPage: page }) => {
      await page.goto("/operasional/pola");
      const section = page.locator("section#palet");
      await section.scrollIntoViewIfNeeded();
      await section.getByRole("radio", { name }).click();
      await expect(section).toHaveScreenshot(`palet-${name.toLowerCase()}-1280x800.png`);
    });
  }
});
```

- [ ] **Step 4: Jalankan pertama kali tanpa baseline**

Run: `./node_modules/.bin/pnpm test:visual`
Expected: uji perilaku (kepala 48px, tanpa gulir mendatar, palet) PASS; uji tangkapan layar gagal dengan *"A snapshot doesn't exist"* — memang belum ada baseline.

Bila server gagal menyala: pastikan port 3100 kosong (`lsof -nP -iTCP:3100 -sTCP:LISTEN`) dan `mc_t_visual` sudah disiapkan (Step 2). Bila login gagal 401, pastikan `NODE_ENV=development` sampai ke proses server (akun uji hanya dibuat di luar produksi).

- [ ] **Step 5: Buat baseline dan periksa dengan mata**

Run: `./node_modules/.bin/pnpm test:visual:update`
Buka beberapa berkas di `e2e/__screenshots__/` (mis. `shell-1280x800.png`, `daftar-detail-1440x900.png`) dan pastikan tampilannya benar sebelum dijadikan baseline — **baseline yang salah akan menjaga kesalahan itu.**

- [ ] **Step 6: Jalankan ulang tanpa perubahan**

Run: `./node_modules/.bin/pnpm test:visual`
Expected: seluruhnya PASS (3 ukuran × 12 uji = 36 uji, ditambah 6 uji palet pada 1280×800 = 42 uji).

- [ ] **Step 7: Perintah mutu, audit, commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
./node_modules/.bin/pnpm audit --prod --audit-level=high
```
Vitest tidak memuat `e2e/` (pola `include` hanya `server/`, `shared/`, `client/src/`); `tsc` tidak memeriksa `e2e/` karena `tsconfig.json` hanya memuat `client/src`, `shared`, `server` — Playwright memeriksa tipenya sendiri saat berjalan.

```bash
git add playwright.config.ts e2e/fixtures.ts e2e/fondasi.spec.ts e2e/__screenshots__ scripts/visualDb.mjs package.json pnpm-lock.yaml .gitignore
git commit -m "Playwright: uji tangkapan layar fondasi desain pada 1280, 1440, dan 1920px"
```

---

### Task 12: Verifikasi di peramban, dokumentasi, penutupan

**Files:**
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/superpowers/plans/2026-09-12-fondasi-desain.md` (Status Pengerjaan), `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`

**Interfaces:**
- Consumes: seluruh tugas sebelumnya
- Produces: bukti bahwa fondasinya berjalan di aplikasi sungguhan, dan panduan pengguna yang menyebut letak menu baru.

- [ ] **Step 1: Telusuri layar lama di dalam shell baru**

Server pengembangan di `http://localhost:3000` dengan peramban yang sudah masuk sebagai Pemegang Saham. Pada lebar **1280×800** buka minimal satu halaman dari setiap kelompok: `/operasional`, `/operasional/transaksi`, `/operasional/stock/kas-awal`, `/operasional/nasabah/daftar`, `/kepatuhan/ira`, `/operasional/buku-besar`, `/kepatuhan/penatausahaan-dokumen`, `/operasional/profil-perusahaan`. Untuk tiap halaman pastikan: isi lama tampil utuh, tidak ada gulir mendatar di tingkat halaman, kepala halaman menyebut kelompok › judul yang benar, butir sidebar aktif beraksen. Ulangi dua halaman terberat (`/operasional/buku-besar`, `/operasional/stock/kas-awal`) pada 1440×900 dan 1920×1080. Tangkap layarnya.

Periksa juga **fokus papan ketik**: tekan Tab dari awal halaman melalui sidebar, tombol *Cari halaman*, dan isi halaman — setiap elemen yang terfokus harus bercincin terlihat, dan urutannya mengikuti urutan baca. Buka ⌘K, pilih halaman dengan panah dan Enter, tutup dengan Esc; fokus kembali ke halaman.

Catat setiap halaman lama yang **rusak** oleh token atau shell baru (bukan yang sekadar bergaya lama) sebagai temuan di laporan. Perbaikan yang wajib dilakukan di tugas ini hanya yang membuat halaman lama tidak dapat dipakai; sisanya milik sub-proyek modulnya.

- [ ] **Step 2: Periksa keadaan akses**

Keluar, buka `/operasional` → panel *Silakan masuk dulu*. Pastikan tombol *Masuk* membawa ke `/login`. (Keadaan *Halaman ini bukan untuk peran Anda* dan *Ganti kata sandi awal Anda* dijaga `accessState.test.ts`; tidak perlu mengetik kata sandi akun uji untuk membuktikannya di layar.)

- [ ] **Step 3: Periksa tipografi yang sudah diputuskan (spec 2026-09-13 §A3)**

Tipografi **tidak lagi diputuskan di tugas ini**: Bricolage Grotesque untuk judul dan angka besar, Manrope untuk isi. Di `/operasional/pola` pada 1280×800, jalankan `document.fonts.check('800 20px "Bricolage Grotesque"')` dan `document.fonts.check('14px Manrope')` di konsol — keduanya harus `true`. Matikan jaringan di DevTools lalu muat ulang: halaman tetap terbaca dengan fallback sistem (risiko residual font). Tulis satu kalimat di `docs/PANDUAN-SUARA-DAN-BAHASA.md` bagian akhir: "Tipografi: Bricolage Grotesque untuk judul dan angka besar, Manrope untuk isi — diputuskan pengguna 13 September 2026 (spec tema Konter Tebal §A3)."

- [ ] **Step 4: Perbarui panduan A–Z**

Cari rujukan letak menu lama:

```bash
grep -n "Pengawasan →\|Kontrol Outlet →\|Ringkasan →\|Transaksi & Nasabah →\|Kegiatan Harian →" docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md
```

Ganti setiap rujukan dengan kelompok baru dari Tugas 4 (mis. `Pengawasan → Profil Perusahaan` → `Pengaturan → Profil Perusahaan`; `Pengawasan → Penatausahaan Dokumen` → `Kepatuhan → Penatausahaan Dokumen`; `Kontrol Outlet → Pencatatan Pengeluaran` → `Transaksi → Catat Pengeluaran`; `Kontrol Outlet → Cek Watchlist DTTOT/DPPSPM` → `Nasabah → Cek Daftar DTTOT/DPPSPM`). Tambahkan satu subbagian singkat di bagian navigasi umum panduan:

```markdown
### Mencari halaman dengan cepat

Tekan **⌘K** (Mac) atau **Ctrl+K** (Windows), ketik sebagian nama halaman — misalnya "kas awal" atau
"IRA" — lalu tekan Enter. Hanya halaman yang boleh dibuka peran Anda yang muncul. Di luar kolom isian,
tombol **N** membuka Buat Transaksi dan **/** membuka pencarian yang sama.
```

- [ ] **Step 5: Perintah mutu penuh, baca keluarannya**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
./node_modules/.bin/pnpm test:visual
./node_modules/.bin/pnpm audit --prod --audit-level=high
```

Sebutkan angka yang benar-benar terlihat dan selisihnya terhadap baseline `1428 passed | 2 skipped` (161 berkas). Perkiraan dari rencana ini: +1 berkas/+2 uji (Tugas 1), +1/+18 (Tugas 2), +2/+6 (Tugas 3), +0/+3 (Tugas 4), +1/+7 (Tugas 5), +1/+8 (Tugas 6), +4/+11 (Tugas 7), +2/+17 (Tugas 7A), +1/+2 (Tugas 7B), +2/+8 (Tugas 8), +1/+3 (Tugas 9) — angka sebenarnya yang berlaku, bukan perkiraan ini. Jangan menyebut audit bersih.

- [ ] **Step 6: Centang dan commit**

Centang Tugas 12 dan pastikan Tugas 1–11 sudah tercentang di Status Pengerjaan rencana ini; centang *Sub-proyek 1 — Fondasi desain* pada `ROADMAP-SISA-PEKERJAAN.md` bagian Program Desain Ulang Antarmuka.

```bash
git add docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md docs/PANDUAN-SUARA-DAN-BAHASA.md client/src/index.css e2e/__screenshots__ docs/superpowers/plans/2026-09-12-fondasi-desain.md docs/superpowers/ROADMAP-SISA-PEKERJAAN.md
git commit -m "Verifikasi dan dokumentasi sub-proyek 1: fondasi desain"
```

- [ ] **Step 7: Penerapan (hanya bila pengguna memintanya pada giliran itu)**

Penerapan ke produksi **tidak** otomatis bagian tugas ini. Bila diminta: `deploy.sh` dijalankan manual di server (GitHub Action masih gagal di langkah SSH), cadangan diambil lebih dulu oleh skripnya, lalu periksa jumlah migrasi tetap 59, `pm2` `online`, dan `/operasional` serta `/operasional/pola` menjawab 200.

---

## Risiko residual yang diketahui sebelum mulai

1. **Halaman lama tampil di dalam shell baru dengan gaya lamanya.** Warna heks mentahnya (±410 nilai) tetap sampai modulnya dibangun ulang; itu disengaja (pendekatan A).
2. **Teks isi dasar turun ke 14px** untuk seluruh halaman, termasuk yang lama. Halaman yang menulis ukurannya sendiri tidak terpengaruh; yang mengandalkan bawaan akan sedikit lebih kecil.
3. **Palet ⌘K belum mencari rekaman** — ditunda ke sub-proyek 4 dan 6 (spec §2.4).
4. **Baseline Playwright bergantung pada font dan versi Chromium lokal**; diperbarui dengan sadar lewat `test:visual:update`, tidak di CI.
5. **Palet dan warna utama perusahaan belum dapat dipilih** — kolom `themePalette` dan `accentColor` baru ada di sub-proyek 2 (spec 2026-09-13 §A5). Sampai itu, `applyTheme` hanya dipanggil pratinjau galeri dan seluruh pembeli memakai palet Marun.
6. **Kontras `--ink-subtle` diturunkan dengan `color-mix`** dan tidak diuji otomatis seperti pasangan palet; diperiksa di peramban pada Tugas 7B dan 12.
7. **Halaman lama tanpa `h1`** (`/operasional`, `/operasional/stock/kas-awal`, `/kepatuhan/ira`, ditemukan pada verifikasi Tugas 7) — tertutup ketika tiap modul memakai `PageHeader`.
