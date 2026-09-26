# Sub-proyek 2 — Login, Penyiapan Awal, Kode Pemulihan, Halaman Publik, Pemilih Palet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan aplikasi layak dipasang per perusahaan: pemilik menyiapkan instalasinya sendiri lewat wizard berpenjaga kode, dapat memulihkan akunnya dengan kode sekali pakai, masuk lewat halaman yang dibatasi percobaannya, lalu mengatur palet dan halaman kurs publik dari Profil Perusahaan — tanpa bootstrap `.env` dan tanpa sisa OAuth Manus.

**Architecture:** Aturan murni di `shared/` (format kode rahasia, aturan akun, halaman publik, tampilan perusahaan) dipakai bersama server dan klien. Server mendapat modul kecil per tanggung jawab — `loginThrottle.ts`, `proxyTrust.ts`, `recoveryCodes.ts`, `installationSetup.ts`, `publicProfile.ts`, `companyPresentation.ts` — sehingga `routers.ts` hanya merangkai. Jalur tulis yang menyentuh basis data diuji **hidup** pada basis data sekali pakai `mc_uji_*` yang dimigrasikan penuh di dalam proses uji, bukan pada `moneychanger`. Layar dibangun dari pola sub-proyek 1 dan komponen berbasis props yang diuji dengan Testing Library; halaman hanya merangkai tRPC.

**Tech Stack:** React 19, Tailwind CSS 4, shadcn/Radix, wouter, tRPC v11 + Zod, Drizzle ORM (MySQL, `drizzle-orm/mysql2/migrator`), Express, Node `crypto` (scrypt), Vitest 3 + Testing Library + jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-26-login-penyiapan-halaman-publik-design.md` (rincian dan koreksi sub-proyek 2), di atas `docs/superpowers/specs/2026-09-12-desain-ulang-antarmuka-design.md` §3 dan `docs/superpowers/specs/2026-09-13-tema-konter-tebal-dan-papan-kurs-design.md` §A5. Papan kurs (sub-proyek 1B) **tidak** dirancang ulang.

## Status Pengerjaan

Dikerjakan satu tugas per commit. **Centang barisnya di sini setelah commit tugas itu.**

- [ ] Tugas 1 — Skema, migrasi aditif `0060`, isian `0061`, dan basis data visual
- [ ] Tugas 2 — Kode rahasia bersama dan perintah `tenant.mjs setup-code`
- [ ] Tugas 3 — Pembatas percobaan masuk (`server/loginThrottle.ts`)
- [ ] Tugas 4 — IP asli di balik nginx dan `auth.login` yang dibatasi
- [ ] Tugas 5 — Kode pemulihan pemilik di server
- [ ] Tugas 6 — Penyiapan awal di server (`setup.complete`)
- [ ] Tugas 7 — Profil publik dan penulis Tampilan/Halaman publik
- [ ] Tugas 8 — Buang bootstrap `.env` dan sisa OAuth Manus
- [ ] Tugas 9 — Layar masuk, pulihkan, dan ubah sandi
- [ ] Tugas 10 — Wizard `/siapkan`
- [ ] Tugas 11 — Kode pemulihan: layar, ajakan, dan menu pengguna
- [ ] Tugas 12 — Pengguna & peran
- [ ] Tugas 13 — Profil Perusahaan: Tampilan dan Halaman publik; tema dipasang shell
- [ ] Tugas 14 — Halaman depan publik
- [ ] Tugas 15 — Peragaan end-to-end, Playwright, dokumentasi, penutupan

Urutan mengikat: 1 sebelum semuanya; 2 sebelum 5 dan 6; 3 sebelum 4; 4 sebelum 5 dan 6; 5 sebelum 6 dan 11; 6 sebelum 7 (`readPublicProfile` memakai `isSetupRequired`); 6 dan 7 sebelum 9; 9 sebelum 10, 11, 14; 7 sebelum 13 dan 14; 8 boleh kapan saja sesudah 6; 1–14 sebelum 15.

## Global Constraints

- `pnpm` **tidak ada di PATH**. Pakai `./node_modules/.bin/*` (`vitest`, `tsc`, `vite`, `drizzle-kit`, `playwright`).
- Muat lingkungan sebelum uji dan sebelum migrasi:
  `export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a; export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"`
- Perintah mutu tiap tugas: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vite build`.
- **Baseline yang benar-benar dilihat pada 21 September 2026 (`884f45c`), sebelum sub-proyek ini:** `Test Files 189 passed (189)`, `Tests 1603 passed | 2 skipped (1605)`. **Sesudah rencana ini ditulis, perbaikan reviu 1B `6d4c567` menambah 3 uji (tanpa berkas baru): baseline sebenarnya 1606 lulus, jadi tambahkan 3 pada setiap ramalan "Tests … passed" di bawah; ramalan jumlah berkas tidak berubah.** Tiap tugas menyebut angka yang diharapkan; sebutkan angka yang **benar-benar terlihat** dan jelaskan setiap selisih. Jumlah "dilewati" harus tetap **2** — bila lain, yang kurang adalah env (lihat `PROMPT-SESI.md`), bukan ujinya.
- Bila satu uji gagal sendirian pada jalan penuh: **catat nama berkasnya dulu** (`./node_modules/.bin/vitest run > /tmp/claude-501/vitest.log 2>&1`) sebelum mengulang.
- Dependensi **tidak bertambah** di sub-proyek ini (`drizzle-orm/mysql2/migrator` sudah bagian dari `drizzle-orm`). Bila ternyata bertambah: `pnpm audit --prod --audit-level=high`, dan **jangan menyebut audit bersih** selama temuan SheetJS/xlsx dan `mysql2` masih ada.
- **Jangan menjalankan `prettier`.** Repo ini tidak berformat prettier.
- **Migrasi hanya aditif**: `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, dan satu `INSERT … SELECT` isian yang ditulis tangan di migrasi custom terpisah. Tidak ada `DROP`, tidak ada perubahan tipe, **tidak ada redefinisi enum**. Kolom enum **baru** (`themePalette`) boleh karena ia `ADD COLUMN`, bukan redefinisi. Baca SQL yang dihasilkan sebelum menerapkannya.
- Migrasi diterapkan **hanya ke dua basis data lokal** dengan `node scripts/tenant.mjs migrate-all`, ditambah `mc_t_visual` lewat `node scripts/visualDb.mjs`. **Jangan menyentuh produksi.** Nomor berikutnya `0060` (terakhir: `0059_cuddly_saracen.sql`). Produksi di 60 sejak 26 September 2026 (`0059` diterapkan); antreannya sesudah sub-proyek ini `0060`, `0061`.
- Cadangkan sebelum migrasi dengan `mysqldump --single-transaction --set-gtid-purged=OFF` dan **buktikan pemulihannya** ke basis data sekali pakai sebelum mengandalkannya.
- **Uji hidup yang menulis** hanya boleh ke basis data berawalan `mc_uji_` yang dibuat `server/testing/scratchDatabase.ts`. Tidak pernah `moneychanger`, `mc_t_abcvalas`, `mc_t_visual`, atau produksi.
- Otorisasi ditegakkan di tRPC. Prosedur **publik baru** hanya `auth.recover`, `setup.complete`, dan `publicContent.profile` (prosedur publik lama tetap); `shareholderProcedure` untuk `auth.regenerateRecoveryCodes`; `controllerProcedure` untuk `companyProfile.updateAppearance`/`updatePublicPage`. Aturan `users.*` yang ada **tidak berubah**.
- **Kode rahasia (kode penyiapan dan kode pemulihan) tidak pernah** ditulis ke `audit_logs`, log konsol, fixture, dokumentasi, maupun tangkapan layar. Hanya hash scrypt yang disimpan.
- `audit_logs` **ditulis, tidak pernah disunting**. Aksi baru: `INSTALLATION_SETUP_COMPLETED`, `OWNER_RECOVERY_CODES_REGENERATED`, `OWNER_RECOVERY_CODE_USED`, `COMPANY_APPEARANCE_UPDATED`, `COMPANY_PUBLIC_PAGE_UPDATED`.
- **Kolom `datetime` menyimpan jam UTC.** Skrip `.mjs` menulis waktu kedaluwarsa dengan `UTC_TIMESTAMP()`, bukan `new Date()` lewat mysql2 (yang menulis jam lokal WIB).
- Data uji hanya di `moneychanger` dan `mc_t_abcvalas` lokal. Data uji paket sebelumnya (mis. bon `E2E-PK-*`) **jangan dibersihkan**.
- Tema Konter Tebal intensitas B: kelas tebal/tenang **hanya** lewat `client/src/components/patterns/tebal.ts`. Setiap berkas klien baru atau yang dibangun ulang di sub-proyek ini ditambahkan ke `client/src/designFoundation.ts` dan karena itu **tidak boleh memuat warna mentah** (`#…`, `rgb(`, `oklch(`). Contoh swatch palet memakai `applyTheme` pada wadahnya sendiri, bukan heks.
- Kepadatan: teks isi 14px (`text-body`), label 12px (`text-label`), judul 20px (`text-title`); tombol dan input `h-control`; gutter `px-gutter`.
- Bahasa layar: Indonesia sehari-hari dengan "Anda"; pesan galat menyebut apa yang terjadi **dan** langkah berikutnya; tindakan destruktif lewat dialog yang menyebut nama bendanya.
- Ukuran peramban wajib utuh: **1280×800, 1440×900, 1920×1080**; halaman publik juga tidak terpotong pada lebar ponsel (390px).
- Di luar cakupan (spec keputusan 2 dan §"Yang sengaja tidak dikerjakan" spec program): autentikasi ulang tindakan sensitif, cara masuk SOLVINC, reset lewat email, 2FA, pembatas berbasis basis data.

## Review Focus

Lima keadaan yang tidak dijamin oleh bunyi spec tetapi paling mungkin melukai orang sungguhan. Setiap baris sudah punya uji di tugas pemiliknya.

1. **Wizard diklik dua kali / dua tab menyelesaikan penyiapan bersamaan** → tepat satu Pemegang Saham tercipta, yang kedua mendapat "sudah disiapkan". Uji: Tugas 6 Step 1, *"dua penyelesaian bersamaan hanya menghasilkan satu pemilik"*.
2. **Kode pemulihan yang sama dipakai dari dua tab bersamaan** → tepat satu berhasil. Uji: Tugas 5 Step 1, *"satu kode yang dipakai bersamaan hanya berhasil sekali"*.
3. **Kode disalin dari terminal atau kertas dengan huruf kecil, spasi, atau strip** → tetap diterima. Uji: Tugas 6 (kode penyiapan diketik `"abcd efgh ijkl"`-gaya) dan Tugas 5 (kode pemulihan huruf kecil tanpa strip).
4. **Username yang tidak ada ikut terkunci seperti yang ada** → penyerang tidak dapat membedakan akun dari perilaku penguncian. Uji: Tugas 4 Step 1, *"username yang tidak ada terkunci pada kegagalan kelima juga"*.
5. **Logo yang sudah dinonaktifkan di Profil Perusahaan** → tidak tampil lagi di halaman publik maupun login. Uji: Tugas 7 Step 5, *"logo nonaktif atau bukan COMPANY_LOGO tidak pernah dipublikasikan"*.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `shared/themePalettes.ts` | `THEME_PALETTE_IDS` sebagai tuple untuk enum skema | 1 |
| `drizzle/schema.ts` | `appInstallation`, `ownerRecoveryCodes`; kolom baru `companyProfile` | 1 |
| `drizzle/0060_*.sql`, `drizzle/0061_isi_app_installation.sql`, `drizzle/meta/` | Migrasi aditif + isian bersyarat | 1 |
| `scripts/visualDb.mjs` | `mc_t_visual` ditandai sudah disiapkan | 1 |
| `shared/secretCodes.ts` | Alfabet, pembangkitan, normalisasi, format kode penyiapan/pemulihan | 2 |
| `scripts/setupCode.mjs` (+ `.d.mts`), `scripts/tenant.mjs` | Pembangkitan, hash, dan penulisan kode penyiapan; perintah `setup-code` | 2 |
| `server/internalAuth.ts` | `hashSecret` diekspor; waktu verifikasi disamakan; aturan akun dari `shared/accountRules.ts` | 2, 4, 9 |
| `server/loginThrottle.ts` | Pembatas percobaan di memori, kunci per tenant + cakupan | 3 |
| `server/proxyTrust.ts`, `server/_core/index.ts` | `trust proxy` loopback; IP klien | 4 |
| `server/testing/scratchDatabase.ts` | Basis data `mc_uji_*` sekali pakai yang dimigrasikan penuh | 5 |
| `server/recoveryCodes.ts` | Ganti kode, hitung sisa, pulihkan akun, buat ulang | 5 |
| `server/installationSetup.ts` | Gerbang dan transaksi penyiapan | 6 |
| `shared/publicPage.ts` | Bawaan FAQ/peringatan, tautan aman, normalisasi isian halaman publik | 7 |
| `shared/companyAppearance.ts`, `shared/accentColor.ts` | Masalah tampilan (palet, warna sendiri, kontras terbaik) | 7 |
| `server/publicProfile.ts` | Profil publik berdaftar kunci tetap; logo bertanda tangan | 7 |
| `server/companyPresentation.ts` | Penulis Tampilan dan Halaman publik, beraudit | 7 |
| `server/routers.ts` | `auth.login/recover/regenerateRecoveryCodes/me`, `setup.complete`, `publicContent.profile`, `companyProfile.updateAppearance/updatePublicPage` | 4–7 |
| `server/_core/env.ts`, `server/db.ts`, `shared/const.ts`, `client/src/const.ts`, `client/src/main.tsx`, `.env.example` | Sisa bootstrap/OAuth dibuang | 8 |
| `shared/accountRules.ts` | `USERNAME_PATTERN`, `PASSWORD_MIN_LENGTH` bersama | 9 |
| `client/src/lib/useCompanyTheme.ts`, `client/src/lib/publicProfile.ts` | Pasang tema dari profil; baca profil publik | 9 |
| `client/src/pages/auth/*` | `AuthFrame`, `LoginForm`, `RecoverForm` | 9 |
| `client/src/pages/Login.tsx`, `Recover.tsx`, `ChangePassword.tsx` | Halaman masuk, pulihkan, ubah sandi | 9 |
| `client/src/pages/setup/*`, `client/src/pages/Setup.tsx` | `SetupWizard`, `RecoveryCodeSheet`, halaman `/siapkan` | 10 |
| `client/src/components/shell/RecoveryCodeNotice.tsx`, `AppSidebar.tsx`, `DashboardLayout.tsx`, `pageTitle.ts` | Ajakan kode pemulihan, menu pengguna, tema shell | 11, 13 |
| `client/src/pages/RecoveryCodes.tsx`, `client/src/pages/setup/RegenerateRecoveryCodes.tsx` | Layar buat ulang kode | 11 |
| `client/src/pages/users/*`, `client/src/pages/UserManagement.tsx` | Pengguna & peran | 12 |
| `client/src/pages/company/*`, `client/src/pages/CompanyProfile.tsx` | Tampilan, Halaman publik, penyunting FAQ | 13 |
| `client/src/pages/home/*`, `client/src/pages/Home.tsx` | Halaman depan publik | 14 |
| `client/src/App.tsx` | Rute `/pulihkan`, `/siapkan`, `/operasional/kode-pemulihan` | 9–11 |
| `client/src/designFoundation.ts` | Daftar berkas berpenjaga warna mentah, bertambah | 9–14 |
| `e2e/masuk.spec.ts` | Baseline login, pulihkan, halaman depan | 15 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md`, `docs/superpowers/PROMPT-SESI.md` | Perilaku pengguna, struktur data, serah terima | 15 |

---

### Tugas 1: Skema, migrasi aditif `0060`, isian `0061`, dan basis data visual

**Files:**
- Modify: `shared/themePalettes.ts:8` (tambah tuple id)
- Modify: `drizzle/schema.ts` — kolom baru `companyProfile` (±812–856, sebelum `logoDocumentId`); dua tabel baru tepat sesudah `companyProfile`
- Create: `drizzle/0060_<nama-dari-drizzle-kit>.sql` (dibangkitkan, lalu **dibaca**)
- Create: `drizzle/0061_isi_app_installation.sql` (custom, ditulis tangan)
- Modify: `scripts/visualDb.mjs:37-41`
- Test: `server/installationSchema.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `THEME_PALETTE_IDS: readonly ["MARUN","ZAMRUD","SAMUDRA","TERAKOTA","ANGGUR","ARANG"]`; tabel `app_installation` (`id`, `setupCompletedAt`, `setupCodeHash`, `setupCodeExpiresAt`, `updatedAt`); tabel `owner_recovery_codes` (`id`, `userId`, `codeHash`, `usedAt`, `createdAt`); kolom `company_profile.themePalette`, `.accentColor`, `.publicPageEnabled`, `.secondaryPhone`, `.openingHours`, `.mapUrl`, `.publicFaq`, `.fraudWarning`. Ekspor Drizzle `appInstallation`, `ownerRecoveryCodes`, tipe `CompanyProfile = typeof companyProfile.$inferSelect`.

- [ ] **Step 1: Cadangkan kedua basis data lokal dan buktikan pemulihannya**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"
mkdir -p /tmp/claude-501/backup-0060
for DB in moneychanger mc_t_abcvalas; do
  mysqldump --single-transaction --set-gtid-purged=OFF -u root "$DB" > "/tmp/claude-501/backup-0060/$DB.sql"
done
mysql -u root -e "DROP DATABASE IF EXISTS mc_restore_probe; CREATE DATABASE mc_restore_probe;"
mysql -u root mc_restore_probe < /tmp/claude-501/backup-0060/moneychanger.sql
mysql -u root -e "SELECT COUNT(*) AS tabel_pulih FROM information_schema.tables WHERE table_schema='mc_restore_probe';"
mysql -u root -e "DROP DATABASE mc_restore_probe;"
```

Expected: `tabel_pulih` lebih besar dari nol. Bila pemulihannya gagal, **berhenti** — jangan menjalankan migrasi apa pun.

- [ ] **Step 2: Tuple id palet di `shared/themePalettes.ts`**

Ganti baris `export type ThemePaletteId = …` (baris 8) dengan:

```ts
/** Urutan ini juga urutan nilai enum `company_profile.themePalette`. Menambah palet berarti melebarkan enum dengan pola lebar → UPDATE → sempit, bukan redefinisi satu langkah. */
export const THEME_PALETTE_IDS = ["MARUN", "ZAMRUD", "SAMUDRA", "TERAKOTA", "ANGGUR", "ARANG"] as const;
export type ThemePaletteId = (typeof THEME_PALETTE_IDS)[number];
```

- [ ] **Step 3: Kolom baru `companyProfile` di `drizzle/schema.ts`**

Tambahkan impor di blok impor `shared` bagian atas berkas:

```ts
import { THEME_PALETTE_IDS } from "../shared/themePalettes";
```

Sisipkan tepat **sebelum** `logoDocumentId: int("logoDocumentId"),` pada `companyProfile`:

```ts
  /** Palet tema Konter Tebal pilihan pemilik (spec 2026-09-13 §A5). */
  themePalette: mysqlEnum("themePalette", THEME_PALETTE_IDS).default("MARUN").notNull(),
  /** Warna utama sendiri, `#RRGGBB`. Hanya disimpan bila lolos penjaga kontras; kosong = warna utama palet. */
  accentColor: varchar("accentColor", { length: 7 }),
  /** Mati → alamat `/` langsung membuka halaman masuk staf. */
  publicPageEnabled: boolean("publicPageEnabled").default(true).notNull(),
  secondaryPhone: varchar("secondaryPhone", { length: 60 }),
  /** Teks bebas, mis. "Senin–Sabtu 08.00–17.00". */
  openingHours: varchar("openingHours", { length: 500 }),
  /** Hanya `https://`; ditegakkan `shared/publicPage.ts`. */
  mapUrl: varchar("mapUrl", { length: 500 }),
  /** Pasangan tanya-jawab halaman publik, maks. 12. Kosong = FAQ produk netral. */
  publicFaq: json("publicFaq").$type<{ question: string; answer: string }[]>(),
  /** Kosong = peringatan penipuan produk netral. */
  fraudWarning: text("fraudWarning"),
```

Sesudah penutup `companyProfile` (`});`), tambahkan:

```ts
export type CompanyProfile = typeof companyProfile.$inferSelect;

/**
 * Fakta "instalasi ini sudah disiapkan" — satu baris, id 1. Sengaja bukan kolom `company_profile`:
 * instalasi baru dan produksi yang direset belum tentu punya baris profil, dan menandai penyiapan
 * pada baris yang belum ada akan memaksa migrasi mengarang nama badan hukum (spec 2026-09-26).
 */
export const appInstallation = mysqlTable("app_installation", {
  id: int("id").primaryKey().default(1),
  setupCompletedAt: datetime("setupCompletedAt"),
  /** Hash scrypt kode penyiapan yang dibuat `tenant.mjs setup-code`; dikosongkan begitu penyiapan selesai. */
  setupCodeHash: varchar("setupCodeHash", { length: 200 }),
  setupCodeExpiresAt: datetime("setupCodeExpiresAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Kode pemulihan sekali pakai milik Pemegang Saham — hanya hash-nya. Membuat ulang menghapus kode
 * yang belum terpakai; baris yang sudah terpakai tetap sebagai riwayat.
 */
export const ownerRecoveryCodes = mysqlTable("owner_recovery_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  codeHash: varchar("codeHash", { length: 200 }).notNull(),
  usedAt: datetime("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("owner_recovery_codes_user_idx").on(table.userId)]);
```

- [ ] **Step 4: Bangkitkan migrasi `0060` dan BACA SQL-nya**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
./node_modules/.bin/drizzle-kit generate
cat drizzle/0060_*.sql
```

Expected: hanya `CREATE TABLE \`app_installation\``, `CREATE TABLE \`owner_recovery_codes\``, delapan `ALTER TABLE \`company_profile\` ADD \`…\``, dan `CREATE INDEX`. Kolom `themePalette` muncul sebagai `ADD \`themePalette\` enum('MARUN',…) NOT NULL DEFAULT 'MARUN'` — itu kolom baru, bukan redefinisi. **Bila ada `DROP`, `MODIFY`, atau `CHANGE`, hapus berkasnya, kembalikan `drizzle/meta/`, dan perbaiki `schema.ts` — jangan menyunting SQL hasil bangkitan lalu menjalankannya.**

- [ ] **Step 5: Bangkitkan migrasi custom `0061` dan tulis isiannya**

```bash
./node_modules/.bin/drizzle-kit generate --custom --name isi_app_installation
```

Isi berkas kosong `drizzle/0061_isi_app_installation.sql` dengan:

```sql
-- Instalasi yang sudah memiliki Pemegang Saham (produksi, moneychanger lokal) dianggap sudah
-- disiapkan, sehingga wizard tidak pernah muncul di sana. Instalasi tanpa Pemegang Saham tidak
-- mendapat baris apa pun dan karena itu wajib melewati wizard berpenjaga kode penyiapan.
INSERT INTO `app_installation` (`id`, `setupCompletedAt`)
SELECT 1, UTC_TIMESTAMP() FROM DUAL
WHERE EXISTS (SELECT 1 FROM `users` WHERE `role` = 'SHAREHOLDER');
```

- [ ] **Step 6: Tulis uji bentuk skema**

`server/installationSchema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { appInstallation, companyProfile, ownerRecoveryCodes } from "../drizzle/schema";
import { THEME_PALETTES, THEME_PALETTE_IDS } from "../shared/themePalettes";

describe("skema sub-proyek 2", () => {
  it("penyiapan dan kode pemulihan hanya menyimpan hash", () => {
    expect(Object.keys(getTableColumns(appInstallation))).toEqual(expect.arrayContaining(["setupCompletedAt", "setupCodeHash", "setupCodeExpiresAt"]));
    expect(Object.keys(getTableColumns(ownerRecoveryCodes))).toEqual(expect.arrayContaining(["userId", "codeHash", "usedAt"]));
    expect(Object.keys(getTableColumns(ownerRecoveryCodes))).not.toContain("code");
  });

  it("profil perusahaan membawa palet, warna sendiri, dan isian halaman publik", () => {
    const columns = getTableColumns(companyProfile);
    expect(Object.keys(columns)).toEqual(expect.arrayContaining(["themePalette", "accentColor", "publicPageEnabled", "secondaryPhone", "openingHours", "mapUrl", "publicFaq", "fraudWarning"]));
    expect(columns.themePalette.default).toBe("MARUN");
    expect(THEME_PALETTE_IDS).toEqual(THEME_PALETTES.map((palette) => palette.id));
  });

  it("isian 0061 hanya menandai instalasi yang sudah punya Pemegang Saham", () => {
    const sql = readFileSync(new URL("../drizzle/0061_isi_app_installation.sql", import.meta.url), "utf8");
    expect(sql).toContain("WHERE EXISTS (SELECT 1 FROM `users` WHERE `role` = 'SHAREHOLDER')");
    expect(sql).toContain("UTC_TIMESTAMP()");
  });
});
```

- [ ] **Step 7: Jalankan uji**

Run: `./node_modules/.bin/vitest run server/installationSchema.test.ts`
Expected: PASS, 3 uji.

- [ ] **Step 8: Terapkan migrasi ke dua basis data lokal dan periksa isiannya**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
node scripts/tenant.mjs migrate-all
mysql -u root -e "SELECT id, setupCompletedAt FROM moneychanger.app_installation; SELECT COUNT(*) AS baris FROM mc_t_abcvalas.app_installation; SHOW COLUMNS FROM moneychanger.company_profile LIKE 'themePalette'; SELECT themePalette, publicPageEnabled FROM moneychanger.company_profile;"
```

Expected: `moneychanger.app_installation` satu baris (id 1, `setupCompletedAt` terisi, karena `test-shareholder` ada); `mc_t_abcvalas` **0 baris** (tanpa Pemegang Saham → wizard; basis data peragaan Tugas 15); profil `moneychanger` bernilai `MARUN`, `1`.

- [ ] **Step 9: Basis data visual ditandai sudah disiapkan**

Tanpa ini `mc_t_visual` yang dibuat baru tidak punya Pemegang Saham saat migrasi, sehingga seluruh baseline Playwright akan memotret wizard. Pada `scripts/visualDb.mjs`, tepat sesudah blok sisip profil (sesudah baris `console.log("Profil Perusahaan contoh disisipkan.");` dan penutup `}`-nya), tambahkan:

```js
// Basis data visual dianggap sudah disiapkan; wizard dipotret lewat uji komponen, bukan baseline.
await db.query("INSERT IGNORE INTO app_installation (id, setupCompletedAt) VALUES (1, UTC_TIMESTAMP())");
```

Run: `ADMIN_DATABASE_URL=mysql://root@127.0.0.1:3306/ node scripts/visualDb.mjs && mysql -u root -e "SELECT COUNT(*) FROM mc_t_visual.app_installation WHERE setupCompletedAt IS NOT NULL;"`
Expected: `mc_t_visual siap.` dan hitungan `1`.

- [ ] **Step 10: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: seluruhnya lolos; **`Test Files 190 passed`, `Tests 1606 passed | 2 skipped`** (+1 berkas, +3 uji).

- [ ] **Step 11: Commit**

```bash
git add shared/themePalettes.ts drizzle/schema.ts drizzle/0060_*.sql drizzle/0061_isi_app_installation.sql drizzle/meta scripts/visualDb.mjs server/installationSchema.test.ts
git commit -m "Penyiapan: skema app_installation, kode pemulihan, dan kolom halaman publik

Migrasi 0060 aditif dan 0061 isian bersyarat; rollback cukup dengan mengembalikan commit,
tabel dan kolom baru dibiarkan.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 2: Kode rahasia bersama dan perintah `tenant.mjs setup-code`

**Files:**
- Create: `shared/secretCodes.ts`
- Create: `scripts/setupCode.mjs`, `scripts/setupCode.d.mts`
- Modify: `scripts/tenant.mjs:9-13` (dokumentasi perintah), `:135-146` (cabang perintah), tambah fungsi `setupCode`
- Modify: `server/internalAuth.ts:74-83` (ekspor `hashSecret`)
- Test: `shared/secretCodes.test.ts`, `server/setupCodeScript.test.ts`

**Interfaces:**
- Consumes: tabel `app_installation` (Tugas 1).
- Produces:
  - `SECRET_CODE_ALPHABET: string` (32 huruf), `RECOVERY_CODE_COUNT = 8`, `RECOVERY_CODE_GROUPS = 2`, `SETUP_CODE_GROUPS = 3`
  - `generateSecretCode(groups: number, random?: (length: number) => Uint8Array): string` → `"XXXX-XXXX"`
  - `generateRecoveryCodes(): string[]` (8 berbeda)
  - `normalizeSecretCode(input: string, groups: number): string | null` → bentuk rapat huruf besar tanpa strip; **ini yang di-hash**
  - `formatSecretCode(compact: string): string`
  - `hashSecret(secret: string): Promise<string>` di `server/internalAuth.ts` (tanpa kebijakan panjang)
  - `scripts/setupCode.mjs`: `generateSetupCode(): string`, `hashSetupCode(code: string): Promise<string>`, `writeSetupCode(connection): Promise<string>`
  - Perintah `node scripts/tenant.mjs setup-code [kode-tenant]`

- [ ] **Step 1: Tulis uji `shared/secretCodes.test.ts` yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { RECOVERY_CODE_COUNT, SECRET_CODE_ALPHABET, SETUP_CODE_GROUPS, formatSecretCode, generateRecoveryCodes, generateSecretCode, normalizeSecretCode } from "./secretCodes";

describe("kode rahasia", () => {
  it("alfabetnya 32 huruf unik tanpa 0, O, 1, dan I", () => {
    expect(new Set(SECRET_CODE_ALPHABET).size).toBe(32);
    for (const confusing of ["0", "O", "1", "I"]) expect(SECRET_CODE_ALPHABET).not.toContain(confusing);
  });

  it("dibentuk kelompok empat huruf", () => {
    expect(generateSecretCode(2)).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(generateSecretCode(SETUP_CODE_GROUPS)).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("memetakan byte acak dengan lima bit terbawah, sehingga sebarannya seragam", () => {
    expect(generateSecretCode(1, () => Uint8Array.from([0, 31, 32, 63]))).toBe("A9A9");
  });

  it("delapan kode pemulihan, semuanya berbeda", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
  });

  it("menerima ketikan manusia: huruf kecil, spasi, dan strip di mana saja", () => {
    expect(normalizeSecretCode("abcd efgh", 2)).toBe("ABCDEFGH");
    expect(normalizeSecretCode("ab-cd-ef-gh", 2)).toBe("ABCDEFGH");
    expect(normalizeSecretCode(" abcd-efgh-jklm ", 3)).toBe("ABCDEFGHJKLM");
  });

  it("menolak panjang yang salah dan huruf di luar alfabet, lalu memformat ulang bentuk rapat", () => {
    expect(normalizeSecretCode("ABCDEFG", 2)).toBeNull();
    expect(normalizeSecretCode("ABCD0FGH", 2)).toBeNull();
    expect(formatSecretCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });
});
```

Run: `./node_modules/.bin/vitest run shared/secretCodes.test.ts`
Expected: FAIL — `Failed to resolve import "./secretCodes"`.

- [ ] **Step 2: Tulis `shared/secretCodes.ts`**

```ts
/**
 * Kode rahasia yang dibaca manusia: kode penyiapan (dari terminal server) dan kode pemulihan pemilik
 * (dicetak di kertas). Alfabet 32 huruf tanpa 0/O dan 1/I supaya tidak salah dibaca; tepat 32
 * sehingga `byte & 31` menghasilkan sebaran seragam tanpa penolakan sampel.
 *
 * Yang di-hash selalu bentuk rapat dari `normalizeSecretCode` — tanpa strip, huruf besar — supaya
 * ketikan "abcd efgh" dan "ABCD-EFGH" adalah kode yang sama.
 */
export const SECRET_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 8;
/** Kode pemulihan: XXXX-XXXX. */
export const RECOVERY_CODE_GROUPS = 2;
/** Kode penyiapan: XXXX-XXXX-XXXX. */
export const SETUP_CODE_GROUPS = 3;

type RandomBytes = (length: number) => Uint8Array;
const secureRandom: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

export function generateSecretCode(groups: number, random: RandomBytes = secureRandom): string {
  const chars = Array.from(random(groups * 4), (byte) => SECRET_CODE_ALPHABET[byte & 31]).join("");
  return formatSecretCode(chars);
}

export function generateRecoveryCodes(): string[] {
  const codes = new Set<string>();
  while (codes.size < RECOVERY_CODE_COUNT) codes.add(generateSecretCode(RECOVERY_CODE_GROUPS));
  return [...codes];
}

export function normalizeSecretCode(input: string, groups: number): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, "");
  if (compact.length !== groups * 4) return null;
  for (const char of compact) if (!SECRET_CODE_ALPHABET.includes(char)) return null;
  return compact;
}

export function formatSecretCode(compact: string): string {
  return (compact.match(/.{1,4}/g) ?? []).join("-");
}
```

Run: `./node_modules/.bin/vitest run shared/secretCodes.test.ts`
Expected: PASS, 6 uji.

- [ ] **Step 3: Ekspor `hashSecret` dari `server/internalAuth.ts`**

Ganti fungsi `hashPassword` dan `createScryptHash` (baris ±74–83) dengan:

```ts
export async function hashPassword(password: string) {
  assertPasswordPolicy(password);
  return hashSecret(password);
}

/** Hash scrypt tanpa kebijakan panjang — dipakai kata sandi, kode penyiapan, dan kode pemulihan. Formatnya dipaku `scripts/setupCode.mjs`. */
export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scryptAsync(secret, salt, 64) as Buffer;
  return `scrypt$v1$${salt}$${hash.toString("base64url")}`;
}
```

Ganti satu-satunya pemanggil lain, `ensureDevelopmentTestAccounts` (`const passwordHash = await createScryptHash(DEVELOPMENT_TEST_DEFAULT_PASSWORD);`), menjadi `await hashSecret(DEVELOPMENT_TEST_DEFAULT_PASSWORD)`.

- [ ] **Step 4: Tulis uji `server/setupCodeScript.test.ts` yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { SECRET_CODE_ALPHABET, SETUP_CODE_GROUPS, normalizeSecretCode } from "../shared/secretCodes";
import { verifyPassword } from "./internalAuth";
import { SETUP_CODE_ALPHABET, generateSetupCode, hashSetupCode } from "../scripts/setupCode.mjs";

describe("kode penyiapan dari skrip .mjs", () => {
  it("memakai alfabet dan bentuk yang sama dengan shared/secretCodes.ts", () => {
    expect(SETUP_CODE_ALPHABET).toBe(SECRET_CODE_ALPHABET);
    expect(normalizeSecretCode(generateSetupCode(), SETUP_CODE_GROUPS)).not.toBeNull();
  });

  it("hash-nya diverifikasi server atas bentuk rapat, termasuk ketikan huruf kecil berspasi", async () => {
    const code = generateSetupCode();
    const hash = await hashSetupCode(code);
    expect(hash).not.toContain(code.replace(/-/g, ""));
    expect(await verifyPassword(normalizeSecretCode(code, SETUP_CODE_GROUPS)!, hash)).toBe(true);
    expect(await verifyPassword(normalizeSecretCode(code.toLowerCase().replace(/-/g, " "), SETUP_CODE_GROUPS)!, hash)).toBe(true);
  });
});
```

Run: `./node_modules/.bin/vitest run server/setupCodeScript.test.ts`
Expected: FAIL — `Failed to resolve import "../scripts/setupCode.mjs"`.

- [ ] **Step 5: Tulis `scripts/setupCode.mjs` dan deklarasinya**

`scripts/setupCode.mjs`:

```js
/**
 * Kode penyiapan untuk wizard "Siapkan perusahaan Anda". Dibuat penginstal di server, tidak pernah
 * dicetak ke log aplikasi. Berkas .mjs tidak dapat mengimpor TypeScript, jadi alfabet dan format
 * hash di sini adalah salinan `shared/secretCodes.ts` dan `hashSecret` di `server/internalAuth.ts`;
 * `server/setupCodeScript.test.ts` memaku ketiganya supaya tidak menyimpang.
 */
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
export const SETUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateSetupCode() {
  const chars = Array.from(randomBytes(12), (byte) => SETUP_CODE_ALPHABET[byte & 31]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export async function hashSetupCode(code) {
  const compact = code.toUpperCase().replace(/[\s-]/g, "");
  const salt = randomBytes(16).toString("base64url");
  const hash = await scryptAsync(compact, salt, 64);
  return `scrypt$v1$${salt}$${hash.toString("base64url")}`;
}

/**
 * Menulis kode baru untuk basis data yang tersambung dan mengembalikannya satu kali. Menolak bila
 * penyiapan sudah selesai. Kedaluwarsa dihitung basis data dalam UTC — `new Date()` lewat mysql2
 * akan tertulis sebagai jam lokal WIB.
 */
export async function writeSetupCode(connection) {
  const [rows] = await connection.query("SELECT setupCompletedAt FROM app_installation WHERE id = 1");
  if (rows[0]?.setupCompletedAt) throw new Error("Penyiapan sudah selesai. Kode penyiapan tidak dapat dibuat lagi.");
  const code = generateSetupCode();
  const hash = await hashSetupCode(code);
  await connection.query(
    "INSERT INTO app_installation (id, setupCodeHash, setupCodeExpiresAt) VALUES (1, ?, UTC_TIMESTAMP() + INTERVAL 24 HOUR) "
      + "ON DUPLICATE KEY UPDATE setupCodeHash = ?, setupCodeExpiresAt = UTC_TIMESTAMP() + INTERVAL 24 HOUR",
    [hash, hash],
  );
  return code;
}
```

`scripts/setupCode.d.mts`:

```ts
import type { Connection } from "mysql2/promise";
export const SETUP_CODE_ALPHABET: string;
export function generateSetupCode(): string;
export function hashSetupCode(code: string): Promise<string>;
export function writeSetupCode(connection: Connection): Promise<string>;
```

Run: `./node_modules/.bin/vitest run server/setupCodeScript.test.ts`
Expected: PASS, 2 uji.

- [ ] **Step 6: Perintah `setup-code` di `scripts/tenant.mjs`**

Tambah impor di bawah impor yang ada:

```js
import { writeSetupCode } from "./setupCode.mjs";
```

Tambah baris dokumentasi di kepala berkas, sesudah `node scripts/tenant.mjs migrate-all`:

```
 *   node scripts/tenant.mjs setup-code [kode]   kode penyiapan wizard (tanpa kode: DATABASE_URL)
```

Tambah fungsi sebelum baris `const [command, argument] = …`:

```js
async function setupCode(code) {
  const registry = parseRegistry(process.env.TENANT_REGISTRY);
  const url = code ? registry.get(code) : process.env.DATABASE_URL;
  if (!url) {
    throw new Error(code
      ? `Tenant "${code}" tidak terdaftar di TENANT_REGISTRY.`
      : "DATABASE_URL belum diatur. Sebutkan kode tenant, atau atur DATABASE_URL untuk instalasi satu perusahaan.");
  }
  const connection = await createConnection({ uri: url });
  try {
    const secret = await writeSetupCode(connection);
    // Satu-satunya tempat kode ini tampil. Jangan menyalinnya ke tiket, obrolan, atau log.
    console.log(`Kode penyiapan (berlaku 24 jam, tampil sekali ini saja):\n\n  ${secret}\n`);
    console.log('Buka alamat aplikasi, lalu masukkan kode ini pada langkah pertama "Siapkan perusahaan Anda".');
  } finally {
    await connection.end();
  }
}
```

Ganti cabang perintah menjadi:

```js
  if (command === "list") await list();
  else if (command === "provision") await provision(argument);
  else if (command === "migrate-all") await migrateAll();
  else if (command === "setup-code") await setupCode(argument);
  else {
    console.log("Perintah: list | provision <kode> | migrate-all | setup-code [kode]");
    process.exitCode = 2;
  }
```

Periksa di `moneychanger` (sudah disiapkan) bahwa perintahnya menolak:
Run: `set -a; . ./.env; set +a; node scripts/tenant.mjs setup-code`
Expected: `Penyiapan sudah selesai. Kode penyiapan tidak dapat dibuat lagi.` dan kode keluar 1. **Jangan** menjalankannya ke `mc_t_abcvalas` sekarang — itu langkah peragaan Tugas 15.

- [ ] **Step 7: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 192 passed`, `Tests 1614 passed | 2 skipped`** (+2 berkas, +8 uji).

- [ ] **Step 8: Commit**

```bash
git add shared/secretCodes.ts shared/secretCodes.test.ts scripts/setupCode.mjs scripts/setupCode.d.mts scripts/tenant.mjs server/internalAuth.ts server/setupCodeScript.test.ts
git commit -m "Penyiapan: kode rahasia bersama dan perintah tenant.mjs setup-code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 3: Pembatas percobaan masuk (`server/loginThrottle.ts`)

**Files:**
- Create: `server/loginThrottle.ts`
- Test: `server/loginThrottle.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `THROTTLE_MAX_FAILURES = 5`, `THROTTLE_WINDOW_MS = 900_000`, `THROTTLE_BASE_LOCK_MS = 30_000`, `THROTTLE_MAX_LOCK_MS = 900_000`
  - `type ThrottleScope = "login" | "recover" | "setup"`
  - `throttleKeys(scope: ThrottleScope, tenantCode: string | null, username: string, ip: string): { user: string; ip: string }`
  - `createThrottle(now?: () => number): { check(keys: string[]): ThrottleDecision; recordFailure(keys: string[]): void; recordSuccess(key: string): void; reset(): void }`
  - `authThrottle` (satu instans proses)
  - `assertThrottleAllows(keys: string[]): void` — melempar `TRPCError` `TOO_MANY_REQUESTS` dengan `lockedMessage(detik)`
  - `lockedMessage(seconds: number): string`

- [ ] **Step 1: Tulis uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { THROTTLE_MAX_LOCK_MS, createThrottle, throttleKeys } from "./loginThrottle";

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

const KEYS = ["t:login:user:budi", "t:login:ip:10.0.0.1"];

describe("pembatas percobaan masuk", () => {
  it("empat kegagalan belum mengunci", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let i = 0; i < 4; i += 1) throttle.recordFailure(KEYS);
    expect(throttle.check(KEYS)).toEqual({ allowed: true });
  });

  it("kegagalan kelima mengunci 30 detik, lalu terbuka lagi", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let i = 0; i < 5; i += 1) throttle.recordFailure(KEYS);
    expect(throttle.check(KEYS)).toEqual({ allowed: false, retryAfterSeconds: 30 });
    time.advance(30_000);
    expect(throttle.check(KEYS)).toEqual({ allowed: true });
  });

  it("penguncian berikutnya berlipat dua", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let i = 0; i < 5; i += 1) throttle.recordFailure(KEYS);
    time.advance(31_000);
    for (let i = 0; i < 5; i += 1) throttle.recordFailure(KEYS);
    expect(throttle.check(KEYS)).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it("jedanya tidak pernah melebihi 15 menit", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let lock = 0; lock < 8; lock += 1) {
      for (let i = 0; i < 5; i += 1) throttle.recordFailure(KEYS);
      time.advance(THROTTLE_MAX_LOCK_MS + 1);
    }
    for (let i = 0; i < 5; i += 1) throttle.recordFailure(KEYS);
    expect(throttle.check(KEYS)).toEqual({ allowed: false, retryAfterSeconds: 900 });
  });

  it("kegagalan yang lebih tua dari 15 menit tidak dihitung", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let i = 0; i < 4; i += 1) throttle.recordFailure(KEYS);
    time.advance(16 * 60_000);
    throttle.recordFailure(KEYS);
    expect(throttle.check(KEYS)).toEqual({ allowed: true });
  });

  it("berhasil masuk menghapus hitungan username, bukan hitungan IP", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let i = 0; i < 4; i += 1) throttle.recordFailure(KEYS);
    throttle.recordSuccess(KEYS[0]);
    throttle.recordFailure(KEYS);
    expect(throttle.check([KEYS[0]])).toEqual({ allowed: true });
    expect(throttle.check(KEYS)).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });

  it("kunci dipisah per tenant dan cakupan, username tanpa beda huruf besar", () => {
    expect(throttleKeys("login", "abcvalas", " Budi ", "10.0.0.1")).toEqual({ user: "abcvalas:login:user:budi", ip: "abcvalas:login:ip:10.0.0.1" });
    expect(throttleKeys("recover", null, "budi", "10.0.0.1").user).toBe("default:recover:user:budi");
  });
});
```

Run: `./node_modules/.bin/vitest run server/loginThrottle.test.ts`
Expected: FAIL — `Failed to resolve import "./loginThrottle"`.

- [ ] **Step 2: Tulis `server/loginThrottle.ts`**

```ts
import { TRPCError } from "@trpc/server";

/**
 * Pembatas percobaan masuk, pemulihan, dan penyiapan (spec 2026-09-26 §3). Disimpan di memori proses:
 * benar selama produksi berjalan sebagai SATU proses pm2 `fork`. Bila kelak berkelompok, pembatas ini
 * harus pindah ke basis data — dicatat sebagai risiko residual.
 *
 * Kuncinya membawa kode tenant karena username hanya unik di dalam satu basis data tenant, dan
 * membawa cakupan supaya kegagalan pemulihan tidak mengunci login biasa atau sebaliknya.
 */
export const THROTTLE_MAX_FAILURES = 5;
export const THROTTLE_WINDOW_MS = 15 * 60_000;
export const THROTTLE_BASE_LOCK_MS = 30_000;
export const THROTTLE_MAX_LOCK_MS = 15 * 60_000;
/** Kunci yang diam sehari dan tidak sedang terkunci dibuang supaya peta tidak tumbuh tanpa batas. */
const IDLE_EVICT_MS = 24 * 60 * 60_000;

export type ThrottleScope = "login" | "recover" | "setup";
export type ThrottleDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };
type Entry = { failures: number[]; lockedUntil: number; lockCount: number; lastSeen: number };

export function throttleKeys(scope: ThrottleScope, tenantCode: string | null, username: string, ip: string) {
  const tenant = tenantCode ?? "default";
  return { user: `${tenant}:${scope}:user:${username.trim().toLowerCase()}`, ip: `${tenant}:${scope}:ip:${ip}` };
}

export function createThrottle(now: () => number = Date.now) {
  const entries = new Map<string, Entry>();

  function evictIdle(at: number) {
    for (const [key, entry] of entries) {
      if (at - entry.lastSeen > IDLE_EVICT_MS && entry.lockedUntil <= at) entries.delete(key);
    }
  }

  return {
    check(keys: string[]): ThrottleDecision {
      const at = now();
      const remaining = Math.max(0, ...keys.map((key) => (entries.get(key)?.lockedUntil ?? 0) - at));
      return remaining > 0 ? { allowed: false, retryAfterSeconds: Math.ceil(remaining / 1000) } : { allowed: true };
    },
    recordFailure(keys: string[]) {
      const at = now();
      evictIdle(at);
      for (const key of keys) {
        const entry = entries.get(key) ?? { failures: [], lockedUntil: 0, lockCount: 0, lastSeen: at };
        entry.lastSeen = at;
        entry.failures = entry.failures.filter((failedAt) => at - failedAt < THROTTLE_WINDOW_MS);
        entry.failures.push(at);
        if (entry.failures.length >= THROTTLE_MAX_FAILURES) {
          entry.lockCount += 1;
          entry.lockedUntil = at + Math.min(THROTTLE_BASE_LOCK_MS * 2 ** (entry.lockCount - 1), THROTTLE_MAX_LOCK_MS);
          entry.failures = [];
        }
        entries.set(key, entry);
      }
    },
    recordSuccess(key: string) {
      entries.delete(key);
    },
    reset() {
      entries.clear();
    },
  };
}

export const authThrottle = createThrottle();

export function lockedMessage(seconds: number) {
  return `Terlalu banyak percobaan yang gagal. Coba lagi dalam ${seconds} detik.`;
}

export function assertThrottleAllows(keys: string[]) {
  const decision = authThrottle.check(keys);
  if (!decision.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: lockedMessage(decision.retryAfterSeconds) });
}
```

- [ ] **Step 3: Jalankan uji**

Run: `./node_modules/.bin/vitest run server/loginThrottle.test.ts`
Expected: PASS, 7 uji.

- [ ] **Step 4: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 193 passed`, `Tests 1621 passed | 2 skipped`** (+1 berkas, +7 uji).

- [ ] **Step 5: Commit**

```bash
git add server/loginThrottle.ts server/loginThrottle.test.ts
git commit -m "Masuk: pembatas percobaan per tenant, username, dan IP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 4: IP asli di balik nginx dan `auth.login` yang dibatasi

**Files:**
- Create: `server/proxyTrust.ts`
- Modify: `server/_core/index.ts:42` (sesudah `const app = express();`)
- Modify: `server/internalAuth.ts:148-156` (`verifyInternalCredentials`: pesan dan waktu disamakan)
- Modify: `server/routers.ts:428-433` (`auth.login`)
- Test: `server/proxyTrust.test.ts`, `server/authThrottle.router.test.ts`

**Interfaces:**
- Consumes: `throttleKeys`, `authThrottle`, `assertThrottleAllows` (Tugas 3); `currentTenantCode()` dari `server/tenantContext.ts`.
- Produces: `configureProxyTrust(app: Express): void`, `clientIpOf(req: { ip?: string }): string`; `LOGIN_FAILED_MESSAGE` di `server/routers.ts` (tidak diekspor). `verifyInternalCredentials` tidak lagi melempar untuk username berformat salah — ia mengembalikan `null`.

- [ ] **Step 1: Tulis uji yang gagal**

`server/proxyTrust.test.ts`:

```ts
import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { clientIpOf, configureProxyTrust } from "./proxyTrust";

let close: (() => void) | null = null;
afterEach(() => { close?.(); close = null; });

async function ipSeenBy(trustProxy: boolean) {
  const app = express();
  if (trustProxy) configureProxyTrust(app);
  app.get("/ip", (req, res) => { res.send(clientIpOf(req)); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  close = () => server.close();
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}/ip`, { headers: { "X-Forwarded-For": "203.0.113.9" } });
  return response.text();
}

describe("IP klien di balik nginx", () => {
  it("mempercayai X-Forwarded-For dari nginx di mesin yang sama", async () => {
    expect(await ipSeenBy(true)).toBe("203.0.113.9");
  });

  it("tanpa pengaturan itu setiap permintaan terlihat dari loopback — satu penyerang akan mengunci semua orang", async () => {
    expect(await ipSeenBy(false)).not.toBe("203.0.113.9");
  });

  it("permintaan tanpa IP (pemanggil uji) memakai kunci 'unknown'", () => {
    expect(clientIpOf({})).toBe("unknown");
  });
});
```

`server/authThrottle.router.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { ensureDevelopmentTestAccounts } from "./internalAuth";
import { authThrottle } from "./loginThrottle";
import { appRouter } from "./routers";

const caller = (ip: string) => appRouter.createCaller({
  req: { headers: {}, ip } as never,
  res: { cookie: () => undefined, clearCookie: () => undefined } as never,
  user: null,
});

beforeAll(async () => {
  ENV.cookieSecret ||= "test-session-secret-for-login-throttle-2026";
  await ensureDevelopmentTestAccounts();
}, 20000);
beforeEach(() => authThrottle.reset());

describe("auth.login dibatasi", () => {
  it("kegagalan kelima mengunci, bahkan untuk kata sandi yang benar sesudahnya", async () => {
    const login = caller("198.51.100.7").auth.login;
    for (let i = 0; i < 5; i += 1) await expect(login({ username: "test-staff", password: "salah-salah" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(login({ username: "test-staff", password: "123456" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: expect.stringContaining("30 detik") });
  }, 20000);

  it("username yang tidak ada, kata sandi salah, dan format username salah mendapat pesan yang sama", async () => {
    const login = caller("198.51.100.8").auth.login;
    const messages = await Promise.all([
      login({ username: "tidak-ada-orangnya", password: "apa-saja" }).catch((error) => error.message),
      login({ username: "test-staff", password: "salah-salah" }).catch((error) => error.message),
      login({ username: "Ada Spasi", password: "apa-saja" }).catch((error) => error.message),
    ]);
    expect(new Set(messages)).toEqual(new Set(["Username atau kata sandi tidak valid."]));
  }, 20000);

  it("username yang tidak ada terkunci pada kegagalan kelima juga", async () => {
    const login = caller("198.51.100.9").auth.login;
    for (let i = 0; i < 5; i += 1) await expect(login({ username: "hantu", password: "apa-saja" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(login({ username: "hantu", password: "apa-saja" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  }, 20000);

  it("berhasil masuk menghapus hitungan username", async () => {
    const login = caller("198.51.100.10").auth.login;
    for (let i = 0; i < 4; i += 1) await expect(login({ username: "test-admin", password: "salah-salah" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(login({ username: "test-admin", password: "123456" })).resolves.toMatchObject({ username: "test-admin" });
    // Tanpa penghapusan, hitungan username sudah 4 dan kegagalan berikutnya akan mengunci.
    const fromElsewhere = caller("198.51.100.11").auth.login;
    for (let i = 0; i < 4; i += 1) await expect(fromElsewhere({ username: "test-admin", password: "salah-salah" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller("198.51.100.12").auth.login({ username: "test-admin", password: "123456" })).resolves.toMatchObject({ username: "test-admin" });
  }, 20000);
});
```

Run: `./node_modules/.bin/vitest run server/proxyTrust.test.ts server/authThrottle.router.test.ts`
Expected: FAIL — `./proxyTrust` tidak ada; uji router gagal karena login belum dibatasi dan format username menghasilkan pesan lain.

- [ ] **Step 2: Tulis `server/proxyTrust.ts`**

```ts
import type { Express } from "express";

/**
 * nginx berjalan di mesin yang sama dan meneruskan alamat asli lewat X-Forwarded-For. Hanya peer
 * loopback yang dipercaya: header itu dari siapa pun yang lain adalah karangan. Tanpa ini setiap
 * permintaan ber-IP 127.0.0.1 dan pembatas percobaan per IP mengunci semua orang sekaligus.
 */
export function configureProxyTrust(app: Express) {
  app.set("trust proxy", "loopback");
}

export function clientIpOf(req: { ip?: string }): string {
  return req.ip || "unknown";
}
```

Pada `server/_core/index.ts`, tambah impor `import { configureProxyTrust } from "../proxyTrust";` dan panggil tepat sesudah `const app = express();`:

```ts
  configureProxyTrust(app);
```

Ini perubahan `server/_core` yang dituntut spec §3 (IP asli); dicatat di pesan commit.

- [ ] **Step 3: Samakan pesan dan waktu `verifyInternalCredentials`**

Ganti fungsi `verifyInternalCredentials` di `server/internalAuth.ts` dengan:

```ts
let timingDummyHash: Promise<string> | null = null;

/**
 * Username yang tidak ada, berformat salah, atau nonaktif tetap menjalankan satu scrypt atas hash
 * tiruan, supaya lamanya jawaban tidak membocorkan akun mana yang ada.
 */
export async function verifyInternalCredentials(username: string, password: string) {
  let normalized: string | null = null;
  try {
    normalized = validateUsername(username);
  } catch {
    normalized = null;
  }
  const user = normalized ? await getInternalUserByUsername(normalized) : undefined;
  if (!user || user.accountStatus !== "ACTIVE" || !user.passwordHash || (ENV.isProduction && isDevelopmentTestAccount(user))) {
    timingDummyHash ??= hashSecret(randomBytes(16).toString("base64url"));
    await verifyPassword(password, await timingDummyHash);
    return null;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  await touchLastSignedIn(user.id);
  return user;
}
```

- [ ] **Step 4: Batasi `auth.login` di `server/routers.ts`**

Tambah impor:

```ts
import { assertThrottleAllows, authThrottle, throttleKeys } from "./loginThrottle";
import { clientIpOf } from "./proxyTrust";
import { currentTenantCode } from "./tenantContext";
```

Tambah konstanta di dekat `decimalString`:

```ts
const LOGIN_FAILED_MESSAGE = "Username atau kata sandi tidak valid.";
```

Ganti prosedur `login`:

```ts
    login: publicProcedure.input(z.object({ username: z.string().trim(), password: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      const keys = throttleKeys("login", currentTenantCode(), input.username, clientIpOf(ctx.req));
      assertThrottleAllows([keys.user, keys.ip]);
      const user = await verifyInternalCredentials(input.username, input.password);
      if (!user) {
        authThrottle.recordFailure([keys.user, keys.ip]);
        throw new TRPCError({ code: "UNAUTHORIZED", message: LOGIN_FAILED_MESSAGE });
      }
      authThrottle.recordSuccess(keys.user);
      await setInternalSession(ctx, user);
      return safeUser(user);
    }),
```

- [ ] **Step 5: Jalankan uji**

Run: `./node_modules/.bin/vitest run server/proxyTrust.test.ts server/authThrottle.router.test.ts server/internalAuth.developmentAccounts.test.ts server/internalAuth.bootstrap.test.ts`
Expected: PASS — 3 + 4 uji baru, ditambah uji akun pengembangan dan bootstrap lama tetap lulus.

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 195 passed`, `Tests 1628 passed | 2 skipped`** (+2 berkas, +7 uji).

- [ ] **Step 7: Commit**

```bash
git add server/proxyTrust.ts server/proxyTrust.test.ts server/_core/index.ts server/internalAuth.ts server/routers.ts server/authThrottle.router.test.ts
git commit -m "Masuk: IP asli di balik nginx, login dibatasi, pesan dan waktu gagal disamakan

server/_core/index.ts disentuh satu baris: trust proxy loopback, dituntut spec 2026-09-26 §3.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Tugas 5: Kode pemulihan pemilik di server

**Files:**
- Create: `server/testing/scratchDatabase.ts`
- Create: `server/recoveryCodes.ts`
- Modify: `server/routers.ts:427` (`auth.me`), dan tambah `auth.recover`, `auth.regenerateRecoveryCodes` di router `auth` (±428–447)
- Test: `server/ownerRecovery.live.test.ts`

**Interfaces:**
- Consumes: `ownerRecoveryCodes`, `users`, `auditLogs` (Tugas 1); `generateRecoveryCodes`, `normalizeSecretCode`, `RECOVERY_CODE_GROUPS` (Tugas 2); `hashSecret`, `hashPassword`, `verifyPassword`, `validateUsername`, `assertPasswordPolicy` (`server/internalAuth.ts`); `throttleKeys`, `authThrottle`, `assertThrottleAllows`, `clientIpOf` (Tugas 3–4).
- Produces:
  - `createScratchDatabase(name: \`mc_uji_${string}\`): Promise<{ binding: TenantBinding; url: string }>`
  - `type DbTransaction` (tipe `tx` Drizzle)
  - `replaceRecoveryCodes(tx: DbTransaction, userId: number): Promise<string[]>`
  - `countRemainingRecoveryCodes(userId: number): Promise<number>`
  - `regenerateRecoveryCodes(user: User, currentPassword: string): Promise<string[]>`
  - `recoverOwnerAccount(input: { username: string; code: string; newPassword: string }): Promise<User | null>`
  - Prosedur `auth.recover` (publik), `auth.regenerateRecoveryCodes` (`shareholderProcedure`), dan `auth.me` yang kini memuat `recoveryCodesRemaining: number | null`.

- [ ] **Step 1: Tulis uji hidup yang gagal**

`server/ownerRecovery.live.test.ts` — satu berkas, uji berjalan **berurutan** dan saling bergantung keadaan:

```ts
import { createConnection } from "mysql2/promise";
import { beforeAll, describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { createInternalUser, getInternalUserById, getInternalUserByUsername } from "./db";
import { hashPassword, verifyPassword } from "./internalAuth";
import { countRemainingRecoveryCodes, recoverOwnerAccount, regenerateRecoveryCodes } from "./recoveryCodes";
import { appRouter } from "./routers";
import { runWithTenant, type TenantBinding } from "./tenantContext";
import { createScratchDatabase } from "./testing/scratchDatabase";

let binding: TenantBinding;
let url: string;
let ownerId: number;
let codes: string[] = [];
const OWNER_PASSWORD = "Pemilik-lama-2026";
const NEW_PASSWORD = "Pemilik-baru-2026";

const inTenant = <T,>(fn: () => Promise<T>) => runWithTenant(binding, fn);
const owner = () => inTenant(async () => (await getInternalUserById(ownerId))!);
const remaining = () => inTenant(() => countRemainingRecoveryCodes(ownerId));

async function rows(query: string) {
  const connection = await createConnection({ uri: url });
  try {
    const [result] = await connection.query(query);
    return result as Record<string, unknown>[];
  } finally {
    await connection.end();
  }
}

beforeAll(async () => {
  ({ binding, url } = await createScratchDatabase("mc_uji_pemulihan"));
  await inTenant(async () => {
    const created = await createInternalUser({ username: "pemilik", passwordHash: await hashPassword(OWNER_PASSWORD), name: "Pemilik Uji", role: "SHAREHOLDER", mustChangePassword: false });
    ownerId = created!.id;
    await createInternalUser({ username: "kasir", passwordHash: await hashPassword("Kasir-uji-2026"), name: "Kasir Uji", role: "STAFF", mustChangePassword: false });
  });
}, 180_000);

describe("kode pemulihan pemilik", () => {
  it("membuat ulang menolak kata sandi saat ini yang salah dan tidak membuat kode", async () => {
    await expect(inTenant(async () => regenerateRecoveryCodes(await owner(), "bukan-sandinya"))).rejects.toThrow("Kata sandi saat ini tidak cocok");
    expect(await remaining()).toBe(0);
  });

  it("delapan kode baru; tabel dan audit hanya melihat hash", async () => {
    codes = await inTenant(async () => regenerateRecoveryCodes(await owner(), OWNER_PASSWORD));
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const stored = JSON.stringify(await rows("SELECT codeHash FROM owner_recovery_codes"));
    const audit = JSON.stringify(await rows("SELECT action, afterState FROM audit_logs"));
    for (const code of codes) {
      expect(stored).not.toContain(code.replace("-", ""));
      expect(audit).not.toContain(code.replace("-", ""));
    }
    expect(audit).toContain("OWNER_RECOVERY_CODES_REGENERATED");
    expect(await remaining()).toBe(8);
  });

  it("kode yang diketik huruf kecil tanpa strip memulihkan akun dan mencabut sesi lama", async () => {
    const before = await owner();
    const recovered = await inTenant(() => recoverOwnerAccount({ username: "PEMILIK", code: codes[0].toLowerCase().replace("-", ""), newPassword: NEW_PASSWORD }));
    expect(recovered?.sessionVersion).toBe(before.sessionVersion + 1);
    expect(recovered?.mustChangePassword).toBe(false);
    expect(await verifyPassword(NEW_PASSWORD, recovered!.passwordHash)).toBe(true);
    expect(await remaining()).toBe(7);
    expect(JSON.stringify(await rows("SELECT action FROM audit_logs"))).toContain("OWNER_RECOVERY_CODE_USED");
  });

  it("kode yang sama tidak berlaku dua kali", async () => {
    expect(await inTenant(() => recoverOwnerAccount({ username: "pemilik", code: codes[0], newPassword: NEW_PASSWORD }))).toBeNull();
  });

  it("satu kode yang dipakai bersamaan hanya berhasil sekali", async () => {
    const attempts = await inTenant(() => Promise.all([1, 2].map(() => recoverOwnerAccount({ username: "pemilik", code: codes[1], newPassword: NEW_PASSWORD }))));
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(await remaining()).toBe(6);
  });

  it("akun selain Pemegang Saham tidak dapat dipulihkan", async () => {
    expect(await inTenant(() => recoverOwnerAccount({ username: "kasir", code: codes[2], newPassword: NEW_PASSWORD }))).toBeNull();
    expect(await remaining()).toBe(6);
  });

  it("membuat ulang membatalkan kode lama yang belum terpakai", async () => {
    await inTenant(async () => regenerateRecoveryCodes(await owner(), NEW_PASSWORD));
    expect(await inTenant(() => recoverOwnerAccount({ username: "pemilik", code: codes[3], newPassword: "Pemilik-lain-2026" }))).toBeNull();
    expect(await remaining()).toBe(8);
  });

  it("auth.me melaporkan sisa kode hanya untuk Pemegang Saham", async () => {
    const meFor = (user: User) => inTenant(() => appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user }).auth.me());
    expect((await meFor(await owner()))?.recoveryCodesRemaining).toBe(8);
    const kasir = await inTenant(async () => (await getInternalUserByUsername("kasir"))!);
    expect((await meFor(kasir))?.recoveryCodesRemaining).toBeNull();
  });
});
```

Run: `./node_modules/.bin/vitest run server/ownerRecovery.live.test.ts`
Expected: FAIL — `./testing/scratchDatabase` dan `./recoveryCodes` tidak ada.

- [ ] **Step 2: Tulis `server/testing/scratchDatabase.ts`**

```ts
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createConnection } from "mysql2/promise";
import type { TenantBinding } from "../tenantContext";

/**
 * Basis data sekali pakai untuk uji hidup yang MENULIS — tidak pernah `moneychanger`,
 * `mc_t_abcvalas`, `mc_t_visual`, atau produksi. Namanya wajib berawalan `mc_uji_` supaya
 * `DROP DATABASE` di sini tidak dapat mengenai basis data lain. Dibuat ulang tiap jalan dan
 * dibiarkan sesudahnya untuk diperiksa; seluruh migrasi diterapkan di dalam proses, jadi
 * skemanya persis skema yang akan dipasang.
 */
export async function createScratchDatabase(name: `mc_uji_${string}`): Promise<{ binding: TenantBinding; url: string }> {
  if (!/^mc_uji_[a-z_]+$/.test(name)) throw new Error(`Nama basis data uji harus berawalan mc_uji_: ${name}`);
  if (process.env.NODE_ENV === "production") throw new Error("Basis data uji hanya untuk mesin lokal.");
  const admin = process.env.ADMIN_DATABASE_URL || "mysql://root@127.0.0.1:3306/";
  const connection = await createConnection({ uri: admin });
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await connection.end();
  }
  const target = new URL(admin);
  target.pathname = `/${name}`;
  const url = target.toString();
  const migrationConnection = await createConnection({ uri: url });
  try {
    await migrate(drizzle(migrationConnection), { migrationsFolder: "drizzle" });
  } finally {
    await migrationConnection.end();
  }
  return { binding: { kind: "resolved", tenantCode: name, databaseUrl: url }, url };
}
```

- [ ] **Step 3: Tulis `server/recoveryCodes.ts`**

```ts
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { auditLogs, ownerRecoveryCodes, users, type User } from "../drizzle/schema";
import { RECOVERY_CODE_GROUPS, generateRecoveryCodes, normalizeSecretCode } from "../shared/secretCodes";
import { ENV } from "./_core/env";
import { getInternalUserById, getInternalUserByUsername } from "./db";
import { assertPasswordPolicy, hashPassword, hashSecret, validateUsername, verifyPassword } from "./internalAuth";
import { databaseOrThrow } from "./operations";

type Database = Awaited<ReturnType<typeof databaseOrThrow>>;
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Menghapus kode pemilik yang belum terpakai lalu menyimpan hash delapan kode baru. Kode mentahnya
 * dikembalikan satu kali ini saja — tidak disimpan, tidak dicatat. Baris yang sudah terpakai tetap
 * sebagai riwayat.
 */
export async function replaceRecoveryCodes(tx: DbTransaction, userId: number): Promise<string[]> {
  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((code) => hashSecret(normalizeSecretCode(code, RECOVERY_CODE_GROUPS)!)));
  await tx.delete(ownerRecoveryCodes).where(and(eq(ownerRecoveryCodes.userId, userId), isNull(ownerRecoveryCodes.usedAt)));
  await tx.insert(ownerRecoveryCodes).values(hashes.map((codeHash) => ({ userId, codeHash })));
  return codes;
}

export async function countRemainingRecoveryCodes(userId: number): Promise<number> {
  const db = await databaseOrThrow();
  const [row] = await db.select({ total: count() }).from(ownerRecoveryCodes).where(and(eq(ownerRecoveryCodes.userId, userId), isNull(ownerRecoveryCodes.usedAt)));
  return Number(row?.total ?? 0);
}

export async function regenerateRecoveryCodes(user: User, currentPassword: string): Promise<string[]> {
  if (user.role !== "SHAREHOLDER") throw new Error("Hanya Pemegang Saham yang memiliki kode pemulihan.");
  if (!await verifyPassword(currentPassword, user.passwordHash)) throw new Error("Kata sandi saat ini tidak cocok. Kode lama Anda tetap berlaku.");
  const db = await databaseOrThrow();
  return db.transaction(async (tx) => {
    const codes = await replaceRecoveryCodes(tx, user.id);
    await tx.insert(auditLogs).values({ actorUserId: user.id, action: "OWNER_RECOVERY_CODES_REGENERATED", entityType: "user", entityId: String(user.id), afterState: { codeCount: codes.length, unusedCodesRevoked: true } });
    return codes;
  });
}

/**
 * Pemulihan akun pemilik dengan satu kode sekali pakai. `null` untuk setiap kegagalan — pemanggil
 * menampilkan satu pesan yang sama supaya username yang ada tidak dapat ditebak. Kode dikunci
 * `FOR UPDATE` di dalam transaksi, sehingga dua tab yang memakai kode yang sama bersamaan hanya
 * berhasil satu.
 */
export async function recoverOwnerAccount(input: { username: string; code: string; newPassword: string }): Promise<User | null> {
  assertPasswordPolicy(input.newPassword);
  let username: string;
  try {
    username = validateUsername(input.username);
  } catch {
    return null;
  }
  const compact = normalizeSecretCode(input.code, RECOVERY_CODE_GROUPS);
  if (!compact) return null;
  const user = await getInternalUserByUsername(username);
  if (!user || user.role !== "SHAREHOLDER" || user.accountStatus !== "ACTIVE" || (ENV.isProduction && user.loginMethod === "DEVELOPMENT_TEST")) return null;

  const db = await databaseOrThrow();
  const unused = await db.select().from(ownerRecoveryCodes).where(and(eq(ownerRecoveryCodes.userId, user.id), isNull(ownerRecoveryCodes.usedAt)));
  let matchedId: number | null = null;
  for (const row of unused) {
    if (await verifyPassword(compact, row.codeHash)) {
      matchedId = row.id;
      break;
    }
  }
  if (matchedId === null) return null;
  const codeId = matchedId;

  const passwordHash = await hashPassword(input.newPassword);
  const consumed = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(ownerRecoveryCodes).where(eq(ownerRecoveryCodes.id, codeId)).for("update");
    if (!locked || locked.usedAt) return false;
    await tx.update(ownerRecoveryCodes).set({ usedAt: new Date() }).where(eq(ownerRecoveryCodes.id, codeId));
    await tx.update(users).set({ passwordHash, mustChangePassword: false, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, user.id));
    await tx.insert(auditLogs).values({ actorUserId: user.id, action: "OWNER_RECOVERY_CODE_USED", entityType: "user", entityId: String(user.id), afterState: { recoveryCodeId: codeId, sessionsRevoked: true } });
    return true;
  });
  return consumed ? (await getInternalUserById(user.id)) ?? null : null;
}
```

- [ ] **Step 4: Prosedur di `server/routers.ts`**

Tambah impor:

```ts
import { countRemainingRecoveryCodes, recoverOwnerAccount, regenerateRecoveryCodes } from "./recoveryCodes";
```

Tambah konstanta di dekat `LOGIN_FAILED_MESSAGE`:

```ts
const RECOVERY_FAILED_MESSAGE = "Username atau kode pemulihan tidak cocok, atau kode itu sudah pernah dipakai.";
```

Ganti `me` dan tambahkan dua prosedur di router `auth`:

```ts
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      return { ...safeUser(ctx.user), recoveryCodesRemaining: ctx.user.role === "SHAREHOLDER" ? await countRemainingRecoveryCodes(ctx.user.id) : null };
    }),
    recover: publicProcedure.input(z.object({ username: z.string().trim(), code: z.string().trim().min(1).max(40), newPassword: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      const keys = throttleKeys("recover", currentTenantCode(), input.username, clientIpOf(ctx.req));
      assertThrottleAllows([keys.user, keys.ip]);
      const user = await recoverOwnerAccount(input);
      if (!user) {
        authThrottle.recordFailure([keys.user, keys.ip]);
        throw new TRPCError({ code: "UNAUTHORIZED", message: RECOVERY_FAILED_MESSAGE });
      }
      authThrottle.recordSuccess(keys.user);
      await setInternalSession(ctx, user);
      return safeUser(user);
    }),
    regenerateRecoveryCodes: shareholderProcedure.input(z.object({ currentPassword: z.string().min(1) })).mutation(async ({ input, ctx }) => ({
      codes: await regenerateRecoveryCodes(ctx.user, input.currentPassword),
    })),
```

Kata sandi baru di bawah 12 karakter tetap melempar pesan kebijakan dari `assertPasswordPolicy` **sebelum** kode diperiksa — itu bukan kegagalan pemulihan dan tidak dihitung pembatas.

- [ ] **Step 5: Jalankan uji**

Run: `./node_modules/.bin/vitest run server/ownerRecovery.live.test.ts`
Expected: PASS, 8 uji. Bila `migrate` gagal karena `ADMIN_DATABASE_URL` tidak berhak `CREATE DATABASE`, jalankan dengan `ADMIN_DATABASE_URL=mysql://root@127.0.0.1:3306/` — jangan melewati ujinya.

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 196 passed`, `Tests 1636 passed | 2 skipped`** (+1 berkas, +8 uji).

- [ ] **Step 7: Commit**

```bash
git add server/testing/scratchDatabase.ts server/recoveryCodes.ts server/routers.ts server/ownerRecovery.live.test.ts
git commit -m "Pemulihan: kode sekali pakai pemilik, pulihkan akun, buat ulang, sisa kode di auth.me

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 6: Penyiapan awal di server (`setup.complete`)

**Files:**
- Create: `server/installationSetup.ts`
- Modify: `server/routers.ts` — router `setup` baru di bawah router `auth`
- Test: `server/installationSetup.live.test.ts`

**Interfaces:**
- Consumes: `appInstallation`, `companyProfile`, `users`, `auditLogs` (Tugas 1); `normalizeSecretCode`, `SETUP_CODE_GROUPS` (Tugas 2); `writeSetupCode` dari `scripts/setupCode.mjs` (uji); `replaceRecoveryCodes`, `createScratchDatabase` (Tugas 5); pembatas (Tugas 3–4).
- Produces:
  - `readInstallation(): Promise<{ setupCompletedAt: Date | null; setupCodeHash: string | null; setupCodeExpiresAt: Date | null } | null>`
  - `isSetupRequired(): Promise<boolean>`
  - `setupGate(state, now: Date): string | null`
  - `class SetupRefusal extends Error { countsAsFailure: boolean }`
  - `type SetupInput = { setupCode: string; owner: { name: string; username: string; password: string }; company: { legalEntityName: string; tradingName: string; licenseNumber?: string } }`
  - `completeInstallationSetup(input: SetupInput, now?: Date): Promise<{ user: User; recoveryCodes: string[] }>`
  - Prosedur `setup.complete` (publik) → `{ user, recoveryCodes }` dan menyetel cookie sesi pemilik baru.

- [ ] **Step 1: Tulis uji hidup yang gagal**

`server/installationSetup.live.test.ts` — berurutan dan saling bergantung keadaan:

```ts
import { createConnection } from "mysql2/promise";
import { beforeAll, describe, expect, it } from "vitest";
import { writeSetupCode } from "../scripts/setupCode.mjs";
import { SetupRefusal, completeInstallationSetup, isSetupRequired, readInstallation, type SetupInput } from "./installationSetup";
import { runWithTenant, type TenantBinding } from "./tenantContext";
import { createScratchDatabase } from "./testing/scratchDatabase";

let binding: TenantBinding;
let url: string;
let setupCode = "";
let winnerCodes: string[] = [];

const inTenant = <T,>(fn: () => Promise<T>) => runWithTenant(binding, fn);
const input = (code: string, overrides: Partial<SetupInput> = {}): SetupInput => ({
  setupCode: code,
  owner: { name: "Pemilik ABC", username: "pemilik.abc", password: "Pemilik-abc-2026" },
  company: { legalEntityName: "PT ABC Valas", tradingName: "ABC Valas", licenseNumber: "KUPVA-001" },
  ...overrides,
});

async function sql(query: string) {
  const connection = await createConnection({ uri: url });
  try {
    const [result] = await connection.query(query);
    return result as Record<string, unknown>[];
  } finally {
    await connection.end();
  }
}
const countOf = async (table: string) => Number((await sql(`SELECT COUNT(*) AS n FROM ${table}`))[0].n);
async function freshSetupCode() {
  const connection = await createConnection({ uri: url });
  try { return await writeSetupCode(connection); } finally { await connection.end(); }
}

beforeAll(async () => {
  ({ binding, url } = await createScratchDatabase("mc_uji_penyiapan"));
}, 180_000);

describe("penyiapan awal", () => {
  it("instalasi baru tanpa Pemegang Saham belum disiapkan — isian 0061 tidak menandainya", async () => {
    expect(await inTenant(() => readInstallation())).toBeNull();
    expect(await inTenant(() => isSetupRequired())).toBe(true);
  });

  it("tanpa kode penyiapan, wizard ditolak dengan langkah berikutnya", async () => {
    await expect(inTenant(() => completeInstallationSetup(input("AAAA-BBBB-CCCC")))).rejects.toThrow("Kode penyiapan belum dibuat");
  });

  it("kode yang kedaluwarsa ditolak", async () => {
    setupCode = await freshSetupCode();
    await sql("UPDATE app_installation SET setupCodeExpiresAt = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE id = 1");
    await expect(inTenant(() => completeInstallationSetup(input(setupCode)))).rejects.toThrow("kedaluwarsa");
  });

  it("kode yang salah ditolak, dihitung pembatas, dan tidak menulis apa pun", async () => {
    setupCode = await freshSetupCode();
    const error = await inTenant(() => completeInstallationSetup(input("ZZZZ-ZZZZ-ZZZZ"))).catch((caught) => caught);
    expect(error).toBeInstanceOf(SetupRefusal);
    expect(error.message).toContain("salah");
    expect(error.countsAsFailure).toBe(true);
    expect(await countOf("users")).toBe(0);
  });

  it("kegagalan di tengah transaksi membatalkan seluruhnya", async () => {
    // Nama badan hukum 250 karakter ditolak MySQL (varchar 200, STRICT) SESUDAH akun disisipkan.
    await expect(inTenant(() => completeInstallationSetup(input(setupCode, { company: { legalEntityName: "x".repeat(250), tradingName: "ABC Valas" } })))).rejects.toThrow();
    expect(await countOf("users")).toBe(0);
    expect(await countOf("company_profile")).toBe(0);
    expect(await countOf("owner_recovery_codes")).toBe(0);
    expect((await sql("SELECT setupCompletedAt FROM app_installation WHERE id = 1"))[0].setupCompletedAt).toBeNull();
  });

  it("dua penyelesaian bersamaan hanya menghasilkan satu pemilik; kode boleh diketik huruf kecil berspasi", async () => {
    const typed = setupCode.toLowerCase().replace(/-/g, " ");
    const results = await inTenant(() => Promise.allSettled([
      completeInstallationSetup(input(typed)),
      completeInstallationSetup(input(typed, { owner: { name: "Pemilik Kedua", username: "pemilik.dua", password: "Pemilik-dua-2026" } })),
    ]));
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    winnerCodes = (fulfilled[0] as PromiseFulfilledResult<{ recoveryCodes: string[] }>).value.recoveryCodes;
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.message).toContain("sudah disiapkan");
    expect(Number((await sql("SELECT COUNT(*) AS n FROM users WHERE role = 'SHAREHOLDER'"))[0].n)).toBe(1);
  });

  it("penyiapan yang berhasil menulis akun, profil, kode, dan tanda selesai sekaligus", async () => {
    const [owner] = await sql("SELECT role, mustChangePassword, openId FROM users");
    expect(owner).toMatchObject({ role: "SHAREHOLDER", mustChangePassword: 0 });
    expect(String(owner.openId)).toMatch(/^local:pemilik\.(abc|dua)$/);
    expect((await sql("SELECT legalEntityName, tradingName, licenseNumber FROM company_profile"))[0]).toMatchObject({ legalEntityName: "PT ABC Valas", tradingName: "ABC Valas", licenseNumber: "KUPVA-001" });
    expect(await countOf("owner_recovery_codes")).toBe(8);
    const [installation] = await sql("SELECT setupCompletedAt, setupCodeHash FROM app_installation WHERE id = 1");
    expect(installation.setupCompletedAt).not.toBeNull();
    expect(installation.setupCodeHash).toBeNull();
    const audit = JSON.stringify(await sql("SELECT action, afterState FROM audit_logs"));
    expect(audit).toContain("INSTALLATION_SETUP_COMPLETED");
    for (const code of winnerCodes) expect(audit).not.toContain(code.replace("-", ""));
    expect(await inTenant(() => isSetupRequired())).toBe(false);
  });

  it("penyiapan kedua ditolak tanpa dihitung sebagai tebakan kode", async () => {
    const error = await inTenant(() => completeInstallationSetup(input(setupCode))).catch((caught) => caught);
    expect(error.message).toContain("sudah disiapkan");
    expect(error.countsAsFailure).toBe(false);
  });

  it("perintah setup-code menolak instalasi yang sudah disiapkan", async () => {
    await expect(freshSetupCode()).rejects.toThrow("Penyiapan sudah selesai");
  });
});
```

Run: `./node_modules/.bin/vitest run server/installationSetup.live.test.ts`
Expected: FAIL — `./installationSetup` tidak ada.

- [ ] **Step 2: Tulis `server/installationSetup.ts`**

```ts
import { eq } from "drizzle-orm";
import { appInstallation, auditLogs, companyProfile, users, type User } from "../drizzle/schema";
import { SETUP_CODE_GROUPS, normalizeSecretCode } from "../shared/secretCodes";
import { getInternalUserById } from "./db";
import { assertPasswordPolicy, hashPassword, validateUsername, verifyPassword } from "./internalAuth";
import { databaseOrThrow } from "./operations";
import { replaceRecoveryCodes } from "./recoveryCodes";

type InstallationState = { setupCompletedAt: Date | null; setupCodeHash: string | null; setupCodeExpiresAt: Date | null };

export type SetupInput = {
  setupCode: string;
  owner: { name: string; username: string; password: string };
  company: { legalEntityName: string; tradingName: string; licenseNumber?: string };
};

/** Penolakan yang pesannya boleh ditampilkan apa adanya. Hanya kode yang salah dihitung pembatas percobaan. */
export class SetupRefusal extends Error {
  constructor(message: string, readonly countsAsFailure = false) {
    super(message);
    this.name = "SetupRefusal";
  }
}

const WRONG_SETUP_CODE = "Kode penyiapan salah. Periksa lagi kode yang tampil di terminal server; huruf kecil dan spasi tidak masalah.";

export async function readInstallation(): Promise<InstallationState | null> {
  const db = await databaseOrThrow();
  const [row] = await db.select().from(appInstallation).where(eq(appInstallation.id, 1)).limit(1);
  return row ?? null;
}

export async function isSetupRequired(): Promise<boolean> {
  return !(await readInstallation())?.setupCompletedAt;
}

/** Murni: keadaan instalasi → pesan penolakan, atau `null` bila boleh lanjut memeriksa kodenya. */
export function setupGate(state: InstallationState | null, now: Date): string | null {
  if (state?.setupCompletedAt) return "Perusahaan ini sudah disiapkan. Masuk dengan akun pemilik.";
  if (!state?.setupCodeHash || !state.setupCodeExpiresAt) {
    return "Kode penyiapan belum dibuat. Jalankan `node scripts/tenant.mjs setup-code` di server, lalu masukkan kodenya di sini.";
  }
  if (state.setupCodeExpiresAt.getTime() <= now.getTime()) return "Kode penyiapan sudah kedaluwarsa (berlaku 24 jam). Buat kode baru di server.";
  return null;
}

/**
 * Menulis akun Pemegang Saham, profil perusahaan, kode pemulihan, dan tanda selesai dalam SATU
 * transaksi. Baris `app_installation` dikunci `FOR UPDATE` lebih dulu, sehingga dua penyelesaian
 * bersamaan berurutan dan yang kedua melihat "sudah disiapkan". Panjang kolom sengaja tidak
 * diperiksa di sini (zod di router yang memeriksanya) — uji hidup memakai itu untuk membuktikan
 * rollback.
 */
export async function completeInstallationSetup(input: SetupInput, now = new Date()): Promise<{ user: User; recoveryCodes: string[] }> {
  const username = validateUsername(input.owner.username);
  assertPasswordPolicy(input.owner.password);
  const name = input.owner.name.trim();
  const legalEntityName = input.company.legalEntityName.trim();
  const tradingName = input.company.tradingName.trim();
  if (name.length < 3) throw new SetupRefusal("Nama pemilik minimal 3 karakter.");
  if (!legalEntityName || !tradingName) throw new SetupRefusal("Nama badan hukum dan nama dagang wajib diisi.");
  const compact = normalizeSecretCode(input.setupCode, SETUP_CODE_GROUPS);
  const passwordHash = await hashPassword(input.owner.password);

  const db = await databaseOrThrow();
  const outcome = await db.transaction(async (tx) => {
    const [state] = await tx.select().from(appInstallation).where(eq(appInstallation.id, 1)).for("update");
    const refusal = setupGate(state ?? null, now);
    if (refusal) throw new SetupRefusal(refusal);
    if (!compact || !await verifyPassword(compact, state!.setupCodeHash)) throw new SetupRefusal(WRONG_SETUP_CODE, true);

    const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (taken) throw new SetupRefusal(`Username "${username}" sudah dipakai. Pilih username lain.`);

    const [{ id: userId }] = await tx.insert(users).values({
      openId: `local:${username}`, username, passwordHash, name, loginMethod: "INTERNAL", role: "SHAREHOLDER",
      accountStatus: "ACTIVE", mustChangePassword: false, sessionVersion: 0, lastSignedIn: now,
    }).$returningId();

    const company = { legalEntityName, tradingName, licenseNumber: input.company.licenseNumber?.trim() || null, updatedByUserId: userId };
    const [profile] = await tx.select({ id: companyProfile.id }).from(companyProfile).orderBy(companyProfile.id).limit(1);
    if (profile) await tx.update(companyProfile).set(company).where(eq(companyProfile.id, profile.id));
    else await tx.insert(companyProfile).values(company);

    const recoveryCodes = await replaceRecoveryCodes(tx, userId);
    await tx.update(appInstallation).set({ setupCompletedAt: now, setupCodeHash: null, setupCodeExpiresAt: null }).where(eq(appInstallation.id, 1));
    await tx.insert(auditLogs).values({
      actorUserId: userId, action: "INSTALLATION_SETUP_COMPLETED", entityType: "app_installation", entityId: "1",
      afterState: { ownerUsername: username, legalEntityName, tradingName, recoveryCodeCount: recoveryCodes.length },
    });
    return { userId, recoveryCodes };
  });

  const user = await getInternalUserById(outcome.userId);
  if (!user) throw new Error("Akun pemilik tidak terbaca sesudah penyiapan.");
  return { user, recoveryCodes: outcome.recoveryCodes };
}
```

- [ ] **Step 3: Router `setup` di `server/routers.ts`**

Tambah impor:

```ts
import { SetupRefusal, completeInstallationSetup } from "./installationSetup";
```

Tambahkan tepat sesudah penutup router `auth`:

```ts
  setup: router({
    complete: publicProcedure.input(z.object({
      setupCode: z.string().trim().min(1).max(40),
      owner: z.object({ name: z.string().trim().min(3).max(200), username: z.string().trim(), password: z.string().min(1) }),
      company: z.object({ legalEntityName: z.string().trim().min(1).max(200), tradingName: z.string().trim().min(1).max(200), licenseNumber: z.string().trim().max(80).optional() }),
    })).mutation(async ({ input, ctx }) => {
      // Username pemilik belum ada; tebakan kode dibatasi per IP saja.
      const keys = throttleKeys("setup", currentTenantCode(), "installation", clientIpOf(ctx.req));
      assertThrottleAllows([keys.ip]);
      try {
        const result = await completeInstallationSetup(input);
        authThrottle.recordSuccess(keys.ip);
        await setInternalSession(ctx, result.user);
        return { user: safeUser(result.user), recoveryCodes: result.recoveryCodes };
      } catch (error) {
        if (error instanceof SetupRefusal) {
          if (error.countsAsFailure) authThrottle.recordFailure([keys.ip]);
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),
  }),
```

- [ ] **Step 4: Jalankan uji**

Run: `./node_modules/.bin/vitest run server/installationSetup.live.test.ts`
Expected: PASS, 9 uji.

- [ ] **Step 5: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 197 passed`, `Tests 1645 passed | 2 skipped`** (+1 berkas, +9 uji).

- [ ] **Step 6: Commit**

```bash
git add server/installationSetup.ts server/routers.ts server/installationSetup.live.test.ts
git commit -m "Penyiapan: setup.complete atomik berpenjaga kode penyiapan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 7: Profil publik dan penulis Tampilan/Halaman publik

**Files:**
- Create: `shared/publicPage.ts`, `shared/companyAppearance.ts`
- Modify: `shared/accentColor.ts` (tambah `bestTextContrast` di akhir berkas)
- Create: `server/publicProfile.ts`, `server/companyPresentation.ts`
- Modify: `server/routers.ts` — `publicContent.profile` (±528–530), `companyProfile.updateAppearance` / `updatePublicPage` (±1181–1203)
- Test: `shared/publicPage.test.ts`, `shared/companyAppearance.test.ts`, `server/publicProfile.test.ts`

**Interfaces:**
- Consumes: kolom `companyProfile` baru dan `CompanyProfile` (Tugas 1); `isSetupRequired` (Tugas 6); `getCompanyProfile`, `writeAudit`, `databaseOrThrow` (`server/operations.ts`); `storageGetSignedUrl` (`server/storage.ts`).
- Produces:
  - `shared/publicPage.ts`: `type PublicFaqItem = { question: string; answer: string }`, `PUBLIC_FAQ_LIMIT = 12`, `DEFAULT_PUBLIC_FAQ`, `DEFAULT_FRAUD_WARNING`, `publicFaqOrDefault(faq)`, `fraudWarningOrDefault(text)`, `isSafeMapUrl(value)`, `telHref(phone)`, `hasContactSection(profile)`, `type PublicPageInput`, `type PublicPageValues`, `normalizePublicPage(input): { ok: true; values } | { ok: false; error }`
  - `shared/companyAppearance.ts`: `type AppearanceInput = { themePalette: string; accentColor: string | null }`, `checkAppearance(input): { ok: true; values: { themePalette: ThemePaletteId; accentColor: string | null } } | { ok: false; error: string }`
  - `shared/accentColor.ts`: `bestTextContrast(color: string): number | null`
  - `server/publicProfile.ts`: `PUBLIC_PROFILE_KEYS`, `type PublicProfile`, `toPublicProfile(row, logoUrl, setupRequired)`, `isPublicLogo(document)`, `readPublicProfile(deps?)`
  - `server/companyPresentation.ts`: `updateCompanyAppearance(input, actor)`, `updateCompanyPublicPage(input, actor)`
  - Prosedur `publicContent.profile` (publik), `companyProfile.updateAppearance`, `companyProfile.updatePublicPage` (CONTROLLER+)

- [ ] **Step 1: Tulis uji `shared/publicPage.test.ts` yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_FRAUD_WARNING, DEFAULT_PUBLIC_FAQ, fraudWarningOrDefault, hasContactSection, isSafeMapUrl, normalizePublicPage, publicFaqOrDefault, telHref } from "./publicPage";

const base = { publicPageEnabled: true, publicFaq: [] };

describe("isian halaman publik", () => {
  it("FAQ kosong, null, atau berisi baris kosong memakai FAQ produk netral", () => {
    expect(publicFaqOrDefault(null)).toBe(DEFAULT_PUBLIC_FAQ);
    expect(publicFaqOrDefault([{ question: " ", answer: "x" }])).toBe(DEFAULT_PUBLIC_FAQ);
    expect(JSON.stringify(DEFAULT_PUBLIC_FAQ)).not.toMatch(/\d{3}|Valasindo|Cianjur/);
  });

  it("FAQ milik perusahaan dipakai apa adanya", () => {
    const own = [{ question: "Buka hari Minggu?", answer: "Tidak." }];
    expect(publicFaqOrDefault(own)).toEqual(own);
  });

  it("peringatan penipuan kosong memakai teks produk netral", () => {
    expect(fraudWarningOrDefault("  ")).toBe(DEFAULT_FRAUD_WARNING);
    expect(fraudWarningOrDefault("Hati-hati.")).toBe("Hati-hati.");
  });

  it("tautan peta hanya https", () => {
    expect(isSafeMapUrl("https://maps.app.goo.gl/abc")).toBe(true);
    expect(isSafeMapUrl("http://maps.example/abc")).toBe(false);
    expect(isSafeMapUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMapUrl("bukan tautan")).toBe(false);
  });

  it("nomor telepon menjadi tautan tel: tanpa spasi dan strip", () => {
    expect(telHref("+62 263-265500")).toBe("tel:+62263265500");
  });

  it("bagian kontak hilang bila seluruh isiannya kosong", () => {
    expect(hasContactSection({ address: " ", phone: null, secondaryPhone: "", openingHours: null, mapUrl: null })).toBe(false);
    expect(hasContactSection({ phone: "+62 21 555" })).toBe(true);
  });

  it("isian kosong disimpan sebagai null dan teks dipangkas", () => {
    const result = normalizePublicPage({ ...base, secondaryPhone: "  ", openingHours: " Senin–Sabtu ", mapUrl: "", fraudWarning: "", publicFaq: [{ question: " Q ", answer: " A " }] });
    expect(result).toEqual({ ok: true, values: { publicPageEnabled: true, secondaryPhone: null, openingHours: "Senin–Sabtu", mapUrl: null, fraudWarning: null, publicFaq: [{ question: "Q", answer: "A" }] } });
  });

  it("menolak peta non-https, lebih dari 12 pertanyaan, dan pertanyaan tanpa jawaban", () => {
    expect(normalizePublicPage({ ...base, mapUrl: "http://maps.example" })).toMatchObject({ ok: false, error: expect.stringContaining("https://") });
    const thirteen = Array.from({ length: 13 }, (_, index) => ({ question: `Q${index}`, answer: "A" }));
    expect(normalizePublicPage({ ...base, publicFaq: thirteen })).toMatchObject({ ok: false, error: expect.stringContaining("12") });
    expect(normalizePublicPage({ ...base, publicFaq: [{ question: "Q", answer: "A" }, { question: "Q2", answer: " " }] })).toMatchObject({ ok: false, error: expect.stringContaining("ke-2") });
  });
});
```

Run: `./node_modules/.bin/vitest run shared/publicPage.test.ts`
Expected: FAIL — `./publicPage` tidak ada.

- [ ] **Step 2: Tulis `shared/publicPage.ts`**

```ts
/**
 * Isian halaman kurs publik (spec 2026-09-26 §4–§5). Bagian yang kosong disembunyikan; FAQ dan
 * peringatan penipuan memakai teks produk netral — tanpa nama perusahaan, tanpa nomor — sampai
 * pemilik mengisinya. Tidak ada teks milik perusahaan mana pun yang ditulis mati di sini.
 */
export type PublicFaqItem = { question: string; answer: string };

export const PUBLIC_FAQ_LIMIT = 12;

export const DEFAULT_PUBLIC_FAQ: readonly PublicFaqItem[] = [
  { question: "Apakah kurs di halaman ini sudah terkunci?", answer: "Belum. Kurs bersifat indikatif; petugas mengonfirmasi kurs dan ketersediaan sebelum transaksi dilakukan." },
  { question: "Apakah formulir permintaan merupakan transaksi?", answer: "Tidak. Formulir hanya membantu kami memahami kebutuhan awal Anda. Formulir tidak mengunci kurs, tidak meminta data identitas, dan tidak meminta pembayaran." },
  { question: "Apa yang perlu dibawa ke outlet?", answer: "Siapkan kebutuhan mata uang dan nominal Anda. Petugas akan memberi arahan mengenai informasi yang diperlukan sesuai prosedur layanan." },
];

export const DEFAULT_FRAUD_WARNING = "Waspada penipuan. Konfirmasi ulang lewat kontak resmi di halaman ini sebelum menindaklanjuti informasi yang mengatasnamakan kami.";

export function publicFaqOrDefault(faq: readonly PublicFaqItem[] | null | undefined): readonly PublicFaqItem[] {
  const filled = (faq ?? []).filter((item) => item.question.trim() && item.answer.trim());
  return filled.length ? filled : DEFAULT_PUBLIC_FAQ;
}

export function fraudWarningOrDefault(text: string | null | undefined): string {
  return text?.trim() || DEFAULT_FRAUD_WARNING;
}

export function isSafeMapUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

type ContactFields = { address?: string | null; phone?: string | null; secondaryPhone?: string | null; openingHours?: string | null; mapUrl?: string | null };

export function hasContactSection(profile: ContactFields): boolean {
  return [profile.address, profile.phone, profile.secondaryPhone, profile.openingHours, profile.mapUrl].some((value) => Boolean(value?.trim()));
}

export type PublicPageInput = {
  publicPageEnabled: boolean;
  secondaryPhone?: string | null;
  openingHours?: string | null;
  mapUrl?: string | null;
  publicFaq: PublicFaqItem[];
  fraudWarning?: string | null;
};

export type PublicPageValues = {
  publicPageEnabled: boolean;
  secondaryPhone: string | null;
  openingHours: string | null;
  mapUrl: string | null;
  publicFaq: PublicFaqItem[] | null;
  fraudWarning: string | null;
};

const blankToNull = (value: string | null | undefined) => value?.trim() || null;

/** Dipakai layar (untuk menonaktifkan "Simpan" dan menyebut alasannya) dan server (penegak sesungguhnya). */
export function normalizePublicPage(input: PublicPageInput): { ok: true; values: PublicPageValues } | { ok: false; error: string } {
  const mapUrl = blankToNull(input.mapUrl);
  if (mapUrl && !isSafeMapUrl(mapUrl)) return { ok: false, error: "Tautan peta harus diawali https://, mis. tautan bagikan dari Google Maps." };
  if (input.publicFaq.length > PUBLIC_FAQ_LIMIT) return { ok: false, error: `Paling banyak ${PUBLIC_FAQ_LIMIT} pertanyaan. Hapus yang kurang penting.` };
  const faq = input.publicFaq.map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }));
  const incomplete = faq.findIndex((item) => !item.question || !item.answer);
  if (incomplete >= 0) return { ok: false, error: `Pertanyaan ke-${incomplete + 1} belum lengkap. Isi pertanyaan dan jawabannya, atau hapus barisnya.` };
  return {
    ok: true,
    values: {
      publicPageEnabled: input.publicPageEnabled,
      secondaryPhone: blankToNull(input.secondaryPhone),
      openingHours: blankToNull(input.openingHours),
      mapUrl,
      publicFaq: faq.length ? faq : null,
      fraudWarning: blankToNull(input.fraudWarning),
    },
  };
}
```

Run: `./node_modules/.bin/vitest run shared/publicPage.test.ts`
Expected: PASS, 8 uji.

- [ ] **Step 3: Tulis uji `shared/companyAppearance.test.ts` yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { checkAppearance } from "./companyAppearance";

describe("tampilan perusahaan", () => {
  it("palet di luar keenam palet ditolak", () => {
    expect(checkAppearance({ themePalette: "NEON", accentColor: null })).toMatchObject({ ok: false, error: expect.stringContaining("tidak dikenal") });
  });

  it("warna sendiri yang kosong berarti warna utama palet", () => {
    expect(checkAppearance({ themePalette: "ZAMRUD", accentColor: "  " })).toEqual({ ok: true, values: { themePalette: "ZAMRUD", accentColor: null } });
  });

  it("teks yang bukan kode warna ditolak dengan contoh", () => {
    expect(checkAppearance({ themePalette: "MARUN", accentColor: "merah" })).toMatchObject({ ok: false, error: expect.stringContaining("bukan kode warna") });
  });

  it("warna kurang kontras ditolak dengan rasio terbaiknya; yang lolos disimpan huruf besar", () => {
    expect(checkAppearance({ themePalette: "MARUN", accentColor: "#777777" })).toMatchObject({ ok: false, error: expect.stringContaining("4,48:1") });
    expect(checkAppearance({ themePalette: "MARUN", accentColor: "#0f5a41" })).toEqual({ ok: true, values: { themePalette: "MARUN", accentColor: "#0F5A41" } });
  });
});
```

Run: `./node_modules/.bin/vitest run shared/companyAppearance.test.ts`
Expected: FAIL — `./companyAppearance` tidak ada.

- [ ] **Step 4: Tulis `bestTextContrast` dan `shared/companyAppearance.ts`**

Tambahkan di akhir `shared/accentColor.ts`:

```ts
/** Kontras terbaik warna ini terhadap teks terang atau gelap — angka yang disebut layar saat menolak warna. Keputusannya sama dengan `resolveAccent`. */
export function bestTextContrast(color: string): number | null {
  const light = contrastRatio(color, LIGHT_TEXT);
  const dark = contrastRatio(color, DARK_TEXT);
  return light === null || dark === null ? null : Math.max(light, dark);
}
```

`shared/companyAppearance.ts`:

```ts
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
```

`shared/companyAppearance.ts` memuat contoh heks hanya di teks pesan; ia **data aturan**, bukan berkas tampilan, dan tidak masuk `FOUNDATION_FILES`.

Run: `./node_modules/.bin/vitest run shared/companyAppearance.test.ts shared/accentColor.test.ts`
Expected: PASS — 4 uji baru, uji `accentColor` lama tetap lulus.

- [ ] **Step 5: Tulis uji `server/publicProfile.test.ts` yang gagal**

```ts
import { describe, expect, it } from "vitest";
import type { CompanyProfile } from "../drizzle/schema";
import { PUBLIC_PROFILE_KEYS, isPublicLogo, readPublicProfile, toPublicProfile } from "./publicProfile";

const row = {
  id: 1, legalEntityName: "PT Rahasia Tbk", tradingName: "Valas Terang", licenseNumber: "IZIN-778899", kupvaCode: "KUPVA-5566",
  npwp: "01.234.567.8-999.000", nib: "NIB-4455", biReporterCode: "SANDI-BI-7788", sipesatIdPjk: "PJK-3344", goamlRentityId: 99887,
  goamlReportingUserCode: "GOAML-USER-1", address: "Jl. Uji 1", province: "JAWA_BARAT", phone: "+62 21 555", email: "rahasia@contoh.test",
  website: null, baseCurrencyCode: "IDR", timezone: "Asia/Jakarta", themePalette: "ZAMRUD", accentColor: null, publicPageEnabled: true,
  secondaryPhone: null, openingHours: "Senin–Sabtu 08.00–17.00", mapUrl: "https://maps.example/abc", publicFaq: null, fraudWarning: null,
  logoDocumentId: 5, updatedByUserId: 1, updatedAt: new Date(), createdAt: new Date(),
} as CompanyProfile;

describe("profil publik", () => {
  it("hanya kunci yang dipaku; izin, NPWP, kode BI/PPATK/goAML, dan email tidak pernah keluar", () => {
    const output = toPublicProfile(row, null, false);
    expect(Object.keys(output).sort()).toEqual([...PUBLIC_PROFILE_KEYS].sort());
    const json = JSON.stringify(output);
    for (const secret of ["IZIN-778899", "KUPVA-5566", "01.234.567.8-999.000", "NIB-4455", "SANDI-BI-7788", "PJK-3344", "99887", "GOAML-USER-1", "rahasia@contoh.test", "PT Rahasia Tbk"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("instalasi tanpa profil memakai bawaan produk", () => {
    expect(toPublicProfile(null, null, true)).toMatchObject({ tradingName: null, themePalette: "MARUN", publicPageEnabled: true, publicFaq: null, setupRequired: true });
  });

  it("peta tersimpan yang bukan https dibuang; nama dagang kosong jatuh ke nama badan hukum", () => {
    const output = toPublicProfile({ ...row, tradingName: " ", mapUrl: "javascript:alert(1)" } as CompanyProfile, null, false);
    expect(output.mapUrl).toBeNull();
    expect(output.tradingName).toBe("PT Rahasia Tbk");
  });

  it("logo yang gagal ditandatangani tidak menjatuhkan halaman publik", async () => {
    const output = await readPublicProfile({ getProfile: async () => row, setupRequired: async () => false, logoUrl: async () => { throw new Error("R2 belum diatur"); } });
    expect(output.logoUrl).toBeNull();
    expect(output.tradingName).toBe("Valas Terang");
  });

  it("logo nonaktif atau bukan COMPANY_LOGO tidak pernah dipublikasikan", () => {
    expect(isPublicLogo({ documentType: "COMPANY_LOGO", deactivatedAt: null })).toBe(true);
    expect(isPublicLogo({ documentType: "COMPANY_LOGO", deactivatedAt: new Date() })).toBe(false);
    expect(isPublicLogo({ documentType: "LICENSE_CERTIFICATE", deactivatedAt: null })).toBe(false);
    expect(isPublicLogo(undefined)).toBe(false);
  });
});
```

Catatan: uji pertama sengaja menaruh nama badan hukum di daftar rahasia — bila nama dagang terisi, nama PT tidak boleh ikut keluar.

Run: `./node_modules/.bin/vitest run server/publicProfile.test.ts`
Expected: FAIL — `./publicProfile` tidak ada.

- [ ] **Step 6: Tulis `server/publicProfile.ts`**

```ts
import { eq } from "drizzle-orm";
import { operationalDocuments, type CompanyProfile } from "../drizzle/schema";
import { isSafeMapUrl, type PublicFaqItem } from "../shared/publicPage";
import { DEFAULT_PALETTE_ID } from "../shared/themePalettes";
import { isSetupRequired } from "./installationSetup";
import { databaseOrThrow, getCompanyProfile } from "./operations";
import { storageGetSignedUrl } from "./storage";

/**
 * Satu-satunya jalan data Profil Perusahaan ke pengunjung tanpa akun. Daftar kuncinya dipaku uji;
 * menambah kunci berarti mengubah uji itu dengan sadar. Nomor izin, NPWP, kode BI/PPATK/goAML, dan
 * email tidak pernah keluar lewat sini.
 */
export const PUBLIC_PROFILE_KEYS = [
  "tradingName", "address", "phone", "secondaryPhone", "openingHours", "mapUrl", "publicFaq", "fraudWarning",
  "themePalette", "accentColor", "publicPageEnabled", "logoUrl", "setupRequired",
] as const;

export type PublicProfile = {
  tradingName: string | null;
  address: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  openingHours: string | null;
  mapUrl: string | null;
  publicFaq: PublicFaqItem[] | null;
  fraudWarning: string | null;
  themePalette: string;
  accentColor: string | null;
  publicPageEnabled: boolean;
  logoUrl: string | null;
  setupRequired: boolean;
};

export function toPublicProfile(row: CompanyProfile | null, logoUrl: string | null, setupRequired: boolean): PublicProfile {
  return {
    tradingName: row?.tradingName?.trim() || row?.legalEntityName?.trim() || null,
    address: row?.address ?? null,
    phone: row?.phone ?? null,
    secondaryPhone: row?.secondaryPhone ?? null,
    openingHours: row?.openingHours ?? null,
    mapUrl: row?.mapUrl && isSafeMapUrl(row.mapUrl) ? row.mapUrl : null,
    publicFaq: row?.publicFaq ?? null,
    fraudWarning: row?.fraudWarning ?? null,
    themePalette: row?.themePalette ?? DEFAULT_PALETTE_ID,
    accentColor: row?.accentColor ?? null,
    publicPageEnabled: row?.publicPageEnabled ?? true,
    logoUrl,
    setupRequired,
  };
}

export function isPublicLogo(document: { documentType: string; deactivatedAt: Date | null } | undefined): boolean {
  return Boolean(document && document.documentType === "COMPANY_LOGO" && !document.deactivatedAt);
}

async function publicLogoUrl(documentId: number | null): Promise<string | null> {
  if (!documentId) return null;
  const db = await databaseOrThrow();
  const [document] = await db.select({
    documentType: operationalDocuments.documentType,
    deactivatedAt: operationalDocuments.deactivatedAt,
    storageKey: operationalDocuments.storageKey,
  }).from(operationalDocuments).where(eq(operationalDocuments.id, documentId)).limit(1);
  if (!isPublicLogo(document)) return null;
  return storageGetSignedUrl(document.storageKey);
}

export async function readPublicProfile(deps: {
  getProfile: () => Promise<CompanyProfile | null>;
  setupRequired: () => Promise<boolean>;
  logoUrl: (documentId: number | null) => Promise<string | null>;
} = { getProfile: getCompanyProfile, setupRequired: isSetupRequired, logoUrl: publicLogoUrl }): Promise<PublicProfile> {
  const [row, setupRequired] = await Promise.all([deps.getProfile(), deps.setupRequired()]);
  // Penyimpanan berkas yang belum diatur (lokal) atau sedang gangguan tidak boleh menjatuhkan halaman kurs.
  const logoUrl = await deps.logoUrl(row?.logoDocumentId ?? null).catch(() => null);
  return toPublicProfile(row, logoUrl, setupRequired);
}
```

Run: `./node_modules/.bin/vitest run server/publicProfile.test.ts`
Expected: PASS, 5 uji.

- [ ] **Step 7: Tulis `server/companyPresentation.ts`**

```ts
import { eq } from "drizzle-orm";
import { companyProfile } from "../drizzle/schema";
import { checkAppearance, type AppearanceInput } from "../shared/companyAppearance";
import { normalizePublicPage, type PublicPageInput } from "../shared/publicPage";
import { databaseOrThrow, getCompanyProfile, writeAudit } from "./operations";

/**
 * Penulis bagian "Tampilan" dan "Halaman publik" Profil Perusahaan. Terpisah dari
 * `updateCompanyProfile` supaya menyimpan satu bagian tidak pernah menimpa bagian lain, dan supaya
 * aturan yang sama dengan layar (`shared/`) ditegakkan ulang di server.
 */
const PROFILE_MISSING = "Profil perusahaan belum ada. Isi dan simpan Data badan usaha lebih dulu.";

async function existingProfileId(): Promise<number | null> {
  const db = await databaseOrThrow();
  const [row] = await db.select({ id: companyProfile.id }).from(companyProfile).orderBy(companyProfile.id).limit(1);
  return row?.id ?? null;
}

export async function updateCompanyAppearance(input: AppearanceInput, actor: { id: number }) {
  const checked = checkAppearance(input);
  if (!checked.ok) throw new Error(checked.error);
  const id = await existingProfileId();
  if (id === null) throw new Error(PROFILE_MISSING);
  const db = await databaseOrThrow();
  await db.update(companyProfile).set({ ...checked.values, updatedByUserId: actor.id }).where(eq(companyProfile.id, id));
  await writeAudit({ actorUserId: actor.id, action: "COMPANY_APPEARANCE_UPDATED", entityType: "company_profile", entityId: String(id), afterState: checked.values });
  return getCompanyProfile();
}

export async function updateCompanyPublicPage(input: PublicPageInput, actor: { id: number }) {
  const normalized = normalizePublicPage(input);
  if (!normalized.ok) throw new Error(normalized.error);
  const id = await existingProfileId();
  if (id === null) throw new Error(PROFILE_MISSING);
  const db = await databaseOrThrow();
  await db.update(companyProfile).set({ ...normalized.values, updatedByUserId: actor.id }).where(eq(companyProfile.id, id));
  await writeAudit({ actorUserId: actor.id, action: "COMPANY_PUBLIC_PAGE_UPDATED", entityType: "company_profile", entityId: String(id), afterState: normalized.values });
  return getCompanyProfile();
}
```

- [ ] **Step 8: Prosedur di `server/routers.ts`**

Tambah impor:

```ts
import { readPublicProfile } from "./publicProfile";
import { updateCompanyAppearance, updateCompanyPublicPage } from "./companyPresentation";
import { PUBLIC_FAQ_LIMIT } from "../shared/publicPage";
```

Router `publicContent` menjadi:

```ts
  publicContent: router({
    announcements: publicProcedure.query(() => listPublicAnnouncements()),
    profile: publicProcedure.query(() => readPublicProfile()),
  }),
```

Di router `companyProfile`, sesudah `update`:

```ts
    updateAppearance: controllerProcedure.input(z.object({
      themePalette: z.string().trim().max(16),
      accentColor: z.string().trim().max(16).nullable(),
    })).mutation(({ input, ctx }) => updateCompanyAppearance(input, ctx.user)),
    updatePublicPage: controllerProcedure.input(z.object({
      publicPageEnabled: z.boolean(),
      secondaryPhone: z.string().trim().max(60).nullable(),
      openingHours: z.string().trim().max(500).nullable(),
      mapUrl: z.string().trim().max(500).nullable(),
      publicFaq: z.array(z.object({ question: z.string().max(200), answer: z.string().max(1000) })).max(PUBLIC_FAQ_LIMIT + 1),
      fraudWarning: z.string().trim().max(1000).nullable(),
    })).mutation(({ input, ctx }) => updateCompanyPublicPage(input, ctx.user)),
```

`max(PUBLIC_FAQ_LIMIT + 1)` disengaja: 13 butir sampai ke `normalizePublicPage` dan mendapat pesan berbahasa manusia; di atas itu zod menolak muatan yang jelas bukan dari layar.

- [ ] **Step 9: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 200 passed`, `Tests 1662 passed | 2 skipped`** (+3 berkas, +17 uji).

- [ ] **Step 10: Commit**

```bash
git add shared/publicPage.ts shared/publicPage.test.ts shared/companyAppearance.ts shared/companyAppearance.test.ts shared/accentColor.ts server/publicProfile.ts server/publicProfile.test.ts server/companyPresentation.ts server/routers.ts
git commit -m "Halaman publik: profil publik berkunci tetap, penulis Tampilan dan Halaman publik

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 8: Buang bootstrap `.env` dan sisa OAuth Manus

**Files:**
- Modify: `server/internalAuth.ts:159-175` (hapus `ensureInitialShareholder`), `:9` (impor)
- Delete: `server/internalAuth.bootstrap.test.ts`
- Modify: `server/_core/index.ts:6,56` (impor dan panggilan)
- Modify: `server/_core/env.ts:2,5-8`
- Modify: `server/db.ts:4,65-133,150-155` (hapus `upsertUser`, `getUserByOpenId`, `hasShareholder`)
- Delete: `client/src/const.ts`
- Modify: `shared/const.ts:7-37` (hapus blok OAuth)
- Modify: `client/src/main.tsx:2,19-21,49-68`
- Modify: `.env.example:26-28,42-45`
- Modify: `client/src/pages/UserManagement.tsx` (kalimat "Shareholder pertama dibuat melalui bootstrap aman…") — **hanya bila Tugas 12 belum dikerjakan**; Tugas 12 menulis ulang berkas itu.
- Test: `server/legacyAuthRemoval.test.ts`

**Interfaces:**
- Consumes: `completeInstallationSetup` (Tugas 6) — penggantinya harus sudah ada sebelum bootstrap dibuang.
- Produces: tidak ada simbol baru. `ENV` kehilangan `appId`, `ownerOpenId`, `initialShareholderUsername`, `initialShareholderPassword`.

- [ ] **Step 1: Tulis uji penjaga yang gagal**

`server/legacyAuthRemoval.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("bootstrap .env dan OAuth Manus sudah dibuang", () => {
  it("tidak ada simbol sisa di kode server, shared, maupun klien", () => {
    const files = ["server/internalAuth.ts", "server/_core/index.ts", "server/_core/env.ts", "server/db.ts", "shared/const.ts", "client/src/main.tsx"];
    const forbidden = ["ensureInitialShareholder", "INITIAL_SHAREHOLDER", "initialShareholder", "OWNER_OPEN_ID", "ownerOpenId", "VITE_APP_ID", "upsertUser", "getUserByOpenId", "OAUTH_STATE_COOKIE", "encodeOAuthState", "manus-cookie", "startLogin"];
    for (const file of files) {
      const source = read(file);
      for (const symbol of forbidden) expect(source, `${symbol} masih ada di ${file}`).not.toContain(symbol);
    }
    expect(existsSync(new URL("../client/src/const.ts", import.meta.url))).toBe(false);
  });

  it(".env.example tidak lagi meminta kata sandi pemilik", () => {
    const example = read(".env.example");
    expect(example).not.toContain("INITIAL_SHAREHOLDER");
    expect(example).toContain("tenant.mjs setup-code");
  });
});
```

Run: `./node_modules/.bin/vitest run server/legacyAuthRemoval.test.ts`
Expected: FAIL — simbol masih ada.

- [ ] **Step 2: Buang bootstrap di server**

1. `server/internalAuth.ts`: hapus seluruh fungsi `ensureInitialShareholder` beserta komentar JSDoc di atasnya; ubah baris impor `./db` menjadi
   `import { createInternalUser, getInternalUserById, getInternalUserByUsername, touchLastSignedIn, updateInternalUserPassword } from "./db";`
2. `git rm server/internalAuth.bootstrap.test.ts`
3. `server/_core/index.ts`: impor menjadi `import { ensureDevelopmentTestAccounts } from "../internalAuth";` dan hapus baris `if (await ensureInitialShareholder()) console.log("[Auth] Initial Shareholder account provisioned.");`. Ini perubahan `server/_core` yang dituntut spec §2 ("Dibuang").
4. `server/_core/env.ts`: hapus baris `appId`, komentar `// Legacy: …`, `ownerOpenId`, `initialShareholderUsername`, `initialShareholderPassword`.
5. `server/db.ts`: hapus `upsertUser`, `getUserByOpenId`, dan `hasShareholder`; ubah impor skema menjadi `import { users } from "../drizzle/schema";` bila `InsertUser` tidak dipakai lagi (periksa dengan `grep -n InsertUser server/db.ts`).

- [ ] **Step 3: Buang sisa OAuth di klien dan shared**

1. `git rm client/src/const.ts` (tidak ada yang mengimpor `@/const`; periksa dengan `grep -rn '"@/const"' client/src` — harus kosong).
2. `shared/const.ts`: hapus semuanya mulai komentar `// One-time nonce cookie …` sampai akhir berkas (`OAUTH_STATE_COOKIE`, `OAuthState`, `encodeOAuthState`, `decodeOAuthState`). Sisakan lima konstanta pertama.
3. `client/src/main.tsx`: ubah impor menjadi `import { UNAUTHED_ERR_MSG } from '@shared/const';`; ganti tiga baris komentar Manus di `redirectToLoginIfUnauthorized` dengan
   `// Sesi habis atau dicabut: kosongkan data dan kembali ke halaman masuk internal.`;
   hapus seluruh opsi `headers() { … }` pada `httpBatchLink` (server tidak pernah membaca header Bearer; sesi hanya dari cookie httpOnly).

- [ ] **Step 4: `.env.example`**

Ganti blok akun Shareholder awal (baris ±26–28) dengan:

```
# Akun pemilik TIDAK dibuat dari .env. Pada instalasi baru jalankan di server:
#   node scripts/tenant.mjs setup-code
# lalu buka alamat aplikasi dan masukkan kode itu pada wizard "Siapkan perusahaan Anda".
```

Hapus blok `# --- Opsional / legacy …`, `VITE_APP_ID=`, dan `OWNER_OPEN_ID=` di akhir berkas.

- [ ] **Step 5: Jalankan uji**

Run: `./node_modules/.bin/vitest run server/legacyAuthRemoval.test.ts server/internalAuth.developmentAccounts.test.ts`
Expected: PASS — 2 uji penjaga, uji akun pengembangan tetap lulus.

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 200 passed`, `Tests 1662 passed | 2 skipped`** — berkas dan uji **tidak bertambah**: `internalAuth.bootstrap.test.ts` (1 berkas, 2 uji) dibuang, `legacyAuthRemoval.test.ts` (1 berkas, 2 uji) ditambah.

- [ ] **Step 7: Commit**

```bash
git add -A server/internalAuth.ts server/internalAuth.bootstrap.test.ts server/_core/index.ts server/_core/env.ts server/db.ts client/src/const.ts shared/const.ts client/src/main.tsx .env.example server/legacyAuthRemoval.test.ts
git commit -m "Masuk: buang bootstrap INITIAL_SHAREHOLDER dan sisa OAuth Manus

Pemilik kini dibuat lewat wizard berpenjaga kode penyiapan. Rollback aman pada instalasi yang
sudah disiapkan; server/_core disentuh untuk membuang panggilan dan kunci env yang dituntut spec.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Tugas 9: Layar masuk, pulihkan, dan ubah sandi

**Files:**
- Create: `shared/accountRules.ts`
- Modify: `server/internalAuth.ts:13-14` (konstanta pindah ke `shared/accountRules.ts`)
- Create: `client/src/lib/useCompanyTheme.ts`, `client/src/lib/publicProfile.ts`
- Create: `client/src/pages/auth/AuthFrame.tsx`, `client/src/pages/auth/LoginForm.tsx`, `client/src/pages/auth/RecoverForm.tsx`
- Modify (tulis ulang): `client/src/pages/Login.tsx`, `client/src/pages/ChangePassword.tsx`
- Create: `client/src/pages/Recover.tsx`
- Modify: `client/src/App.tsx:10` (impor lazy) dan `:65-67` (rute `/pulihkan`)
- Modify: `client/src/designFoundation.ts` (tambah berkas)
- Test: `client/src/lib/useCompanyTheme.test.tsx`, `client/src/pages/auth/LoginForm.test.tsx`, `client/src/pages/auth/RecoverForm.test.tsx`

**Interfaces:**
- Consumes: `publicContent.profile` → `PublicProfile` (Tugas 7); `auth.login`, `auth.recover` (Tugas 4–5); `applyTheme` (`client/src/lib/brandAccent.ts`); `brandName`, `brandInitials`, `PRODUCT_NAME` (`client/src/components/shell/brand.ts`); `normalizeSecretCode`, `formatSecretCode`, `RECOVERY_CODE_GROUPS` (Tugas 2).
- Produces:
  - `USERNAME_PATTERN`, `PASSWORD_MIN_LENGTH`, `normalizeUsernameInput(value)` di `shared/accountRules.ts`
  - `useCompanyTheme(source: { themePalette?: string | null; accentColor?: string | null } | null | undefined): void`
  - `usePublicProfile()` → hasil `trpc.publicContent.profile.useQuery` yang sekaligus memasang palet
  - `AuthFrame({ brand, logoUrl, title, description?, width?: "narrow" | "wide", children })`
  - `SIGN_IN_METHODS`, `LoginForm({ onSubmit, isPending, errorMessage })`
  - `RecoverForm({ onSubmit, isPending, errorMessage })` → `onSubmit({ username, code: "XXXX-XXXX", newPassword })`

- [ ] **Step 1: Tulis uji yang gagal**

`client/src/lib/useCompanyTheme.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCompanyTheme } from "./useCompanyTheme";

describe("useCompanyTheme", () => {
  it("memasang palet pilihan perusahaan ke dokumen", () => {
    renderHook(() => useCompanyTheme({ themePalette: "ZAMRUD", accentColor: null }));
    expect(document.documentElement.style.getPropertyValue("--brand")).toBe("#0F5A41");
    expect(document.documentElement.getAttribute("data-tema")).toBe("ZAMRUD");
  });
});
```

`client/src/pages/auth/LoginForm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

describe("formulir masuk", () => {
  it("menampilkan daftar cara masuk — hari ini satu, kelak SOLVINC menyusul di daftar yang sama", () => {
    render(<LoginForm onSubmit={vi.fn()} isPending={false} errorMessage={null} />);
    expect(screen.getByRole("list", { name: "Cara masuk" }).textContent).toContain("Username & kata sandi");
  });

  it("tombol Masuk baru aktif sesudah keduanya diisi, dan username dikirim tanpa spasi", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} isPending={false} errorMessage={null} />);
    const button = screen.getByRole("button", { name: "Masuk" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Username"), "  budi.kasir ");
    await userEvent.type(screen.getByLabelText("Kata sandi"), "rahasia-sekali");
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith({ username: "budi.kasir", password: "rahasia-sekali" });
  });

  it("pesan galat dibacakan pembaca layar", () => {
    render(<LoginForm onSubmit={vi.fn()} isPending={false} errorMessage="Terlalu banyak percobaan yang gagal. Coba lagi dalam 30 detik." />);
    expect(screen.getByRole("alert").textContent).toContain("30 detik");
  });
});
```

`client/src/pages/auth/RecoverForm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecoverForm } from "./RecoverForm";

async function fill(code: string, password: string, confirmation = password) {
  await userEvent.type(screen.getByLabelText("Username pemilik"), "pemilik");
  await userEvent.type(screen.getByLabelText("Kode pemulihan"), code);
  await userEvent.type(screen.getByLabelText("Kata sandi baru"), password);
  await userEvent.type(screen.getByLabelText("Ulangi kata sandi baru"), confirmation);
}

describe("formulir pulihkan akun pemilik", () => {
  it("kode berformat salah menampilkan petunjuk dan menahan tombol", async () => {
    render(<RecoverForm onSubmit={vi.fn()} isPending={false} errorMessage={null} />);
    await fill("abc", "Kata-sandi-baru-1");
    expect(screen.getByText(/8 huruf atau angka/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pulihkan akun" }).hasAttribute("disabled")).toBe(true);
  });

  it("kata sandi di bawah 12 karakter atau tidak sama menahan tombol", async () => {
    render(<RecoverForm onSubmit={vi.fn()} isPending={false} errorMessage={null} />);
    await fill("ABCD-EFGH", "pendek", "pendek");
    expect(screen.getByRole("button", { name: "Pulihkan akun" }).hasAttribute("disabled")).toBe(true);
  });

  it("kode diketik huruf kecil berspasi dikirim dalam bentuk baku", async () => {
    const onSubmit = vi.fn();
    render(<RecoverForm onSubmit={onSubmit} isPending={false} errorMessage={null} />);
    await fill("abcd efgh", "Kata-sandi-baru-1");
    await userEvent.click(screen.getByRole("button", { name: "Pulihkan akun" }));
    expect(onSubmit).toHaveBeenCalledWith({ username: "pemilik", code: "ABCD-EFGH", newPassword: "Kata-sandi-baru-1" });
  });
});
```

Run: `./node_modules/.bin/vitest run client/src/lib/useCompanyTheme.test.tsx client/src/pages/auth`
Expected: FAIL — modul belum ada.

- [ ] **Step 2: `shared/accountRules.ts` dan pemakaiannya di server**

```ts
/** Aturan akun yang sama untuk server (penegak) dan layar (petunjuk sebelum dikirim). */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,48}$/;
export const PASSWORD_MIN_LENGTH = 12;

export function normalizeUsernameInput(value: string) {
  return value.trim().toLowerCase();
}
```

Di `server/internalAuth.ts`, hapus baris `const PASSWORD_MIN_LENGTH = 12;` dan `const USERNAME_PATTERN = …;`, lalu tambahkan
`import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN } from "../shared/accountRules";`. Perilaku tidak berubah.

- [ ] **Step 3: `useCompanyTheme` dan `usePublicProfile`**

`client/src/lib/useCompanyTheme.ts`:

```ts
import { useEffect } from "react";
import { applyTheme } from "./brandAccent";

type ThemeSource = { themePalette?: string | null; accentColor?: string | null } | null | undefined;

/**
 * Memasang palet perusahaan ke `document.documentElement`. Selama sumbernya belum dimuat, tema bawaan
 * di `index.css` (Marun) tetap berlaku — tidak ada kedipan ke warna lain.
 */
export function useCompanyTheme(source: ThemeSource) {
  const palette = source?.themePalette;
  const accent = source?.accentColor ?? null;
  useEffect(() => {
    if (palette === undefined) return;
    applyTheme(document.documentElement, palette, accent);
  }, [palette, accent]);
}
```

`client/src/lib/publicProfile.ts`:

```ts
import { trpc } from "./trpc";
import { useCompanyTheme } from "./useCompanyTheme";

/** Profil publik untuk layar tanpa akun (halaman depan, masuk, pulihkan, wizard), sekaligus memasang palet perusahaan. */
export function usePublicProfile() {
  const query = trpc.publicContent.profile.useQuery(undefined, { staleTime: 5 * 60_000, retry: 1 });
  useCompanyTheme(query.data);
  return query;
}
```

- [ ] **Step 4: `AuthFrame`, `LoginForm`, `RecoverForm`**

`client/src/pages/auth/AuthFrame.tsx`:

```tsx
import { brandInitials } from "@/components/shell/brand";
import type { ReactNode } from "react";

/**
 * Bingkai layar tanpa akun: logo dan nama dagang dari Profil Perusahaan, satu kartu tebal, tidak ada
 * yang lain (spec program §3.3). `wide` untuk wizard penyiapan.
 */
export function AuthFrame({ brand, logoUrl, title, description, width = "narrow", children }: {
  brand: string;
  logoUrl: string | null;
  title: string;
  description?: string;
  width?: "narrow" | "wide";
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-8">
      <div className={`w-full ${width === "wide" ? "max-w-2xl" : "max-w-sm"}`}>
        <div className="mb-4 flex items-center gap-2">
          {logoUrl
            ? <img src={logoUrl} alt="" className="size-9 rounded-lg border-2 border-ink bg-surface-raised object-contain" />
            : <span aria-hidden className="flex size-9 items-center justify-center rounded-lg border-2 border-ink bg-brand font-heading text-label font-extrabold text-brand-contrast shadow-hard">{brandInitials(brand)}</span>}
          <span className="font-heading text-body font-extrabold text-ink">{brand}</span>
        </div>
        <section className="rounded-[0.75rem] border-2 border-ink bg-surface-raised p-4 shadow-tile">
          <h1 className="font-heading text-title font-extrabold tracking-tight text-ink">{title}</h1>
          {description ? <p className="mt-1 text-body text-ink-muted">{description}</p> : null}
          <div className="mt-4">{children}</div>
        </section>
      </div>
    </main>
  );
}
```

`client/src/pages/auth/LoginForm.tsx`:

```tsx
import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, type FormEvent } from "react";

/** Daftar cara masuk (spec program §3.5). "Masuk dengan SOLVINC" kelak ditambahkan di sini tanpa menyentuh sesi maupun peran. */
export const SIGN_IN_METHODS = [{ id: "PASSWORD", label: "Username & kata sandi" }] as const;

export function LoginForm({ onSubmit, isPending, errorMessage }: {
  onSubmit: (values: { username: string; password: string }) => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const ready = username.trim() !== "" && password !== "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready) onSubmit({ username: username.trim(), password });
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <ul aria-label="Cara masuk" className="flex flex-wrap gap-2">
        {SIGN_IN_METHODS.map((method) => (
          <li key={method.id} className="rounded-md border-2 border-ink bg-second px-2 py-0.5 text-label font-bold text-second-contrast">{method.label}</li>
        ))}
      </ul>
      <div className="grid gap-1">
        <Label htmlFor="username">Username</Label>
        <Input id="username" autoComplete="username" className={QUIET_FIELD} value={username} onChange={(event) => setUsername(event.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="password">Kata sandi</Label>
        <Input id="password" type="password" autoComplete="current-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      {errorMessage ? <p role="alert" className="rounded-md border-[1.5px] border-danger bg-danger-soft px-2 py-1 text-body text-ink">{errorMessage}</p> : null}
      <Button type="submit" className={`w-full ${BOLD_BUTTON}`} disabled={!ready || isPending}>{isPending ? "Memeriksa…" : "Masuk"}</Button>
      <a href="/pulihkan" className="text-center text-label font-semibold text-ink underline underline-offset-4">Lupa kata sandi pemilik?</a>
      <p className="text-center text-label text-ink-subtle">Staf yang lupa kata sandi: minta pemilik atau Controller mereset akun Anda.</p>
    </form>
  );
}
```

`client/src/pages/auth/RecoverForm.tsx`:

```tsx
import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@shared/accountRules";
import { RECOVERY_CODE_GROUPS, formatSecretCode, normalizeSecretCode } from "@shared/secretCodes";
import { useState, type FormEvent } from "react";

export function RecoverForm({ onSubmit, isPending, errorMessage }: {
  onSubmit: (values: { username: string; code: string; newPassword: string }) => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const compact = normalizeSecretCode(code, RECOVERY_CODE_GROUPS);
  const passwordOk = password.length >= PASSWORD_MIN_LENGTH;
  const matchOk = confirmation !== "" && confirmation === password;
  const ready = username.trim() !== "" && compact !== null && passwordOk && matchOk;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready) onSubmit({ username: username.trim(), code: formatSecretCode(compact!), newPassword: password });
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="recover-username">Username pemilik</Label>
        <Input id="recover-username" autoComplete="username" className={QUIET_FIELD} value={username} onChange={(event) => setUsername(event.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="recover-code">Kode pemulihan</Label>
        <Input id="recover-code" autoComplete="one-time-code" placeholder="XXXX-XXXX" className={`${QUIET_FIELD} font-mono uppercase`} value={code} onChange={(event) => setCode(event.target.value)} />
        {code !== "" && compact === null
          ? <p className="text-label text-danger">Kode pemulihan terdiri dari 8 huruf atau angka, mis. ABCD-EFGH. Huruf kecil dan spasi tidak masalah.</p>
          : <p className="text-label text-ink-subtle">Satu dari delapan kode yang Anda simpan saat penyiapan. Setiap kode hanya berlaku sekali.</p>}
      </div>
      <div className="grid gap-1">
        <Label htmlFor="recover-password">Kata sandi baru</Label>
        <Input id="recover-password" type="password" autoComplete="new-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
        <p className={`text-label ${password === "" || passwordOk ? "text-ink-subtle" : "text-danger"}`}>Minimal {PASSWORD_MIN_LENGTH} karakter{password !== "" && !passwordOk ? ` (saat ini ${password.length}).` : "."}</p>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="recover-confirmation">Ulangi kata sandi baru</Label>
        <Input id="recover-confirmation" type="password" autoComplete="new-password" className={QUIET_FIELD} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        {confirmation !== "" && !matchOk ? <p className="text-label text-danger">Belum sama dengan kata sandi baru.</p> : null}
      </div>
      {errorMessage ? <p role="alert" className="rounded-md border-[1.5px] border-danger bg-danger-soft px-2 py-1 text-body text-ink">{errorMessage}</p> : null}
      <Button type="submit" className={`w-full ${BOLD_BUTTON}`} disabled={!ready || isPending}>{isPending ? "Memulihkan…" : "Pulihkan akun"}</Button>
      <a href="/login" className="text-center text-label font-semibold text-ink underline underline-offset-4">Kembali ke halaman masuk</a>
    </form>
  );
}
```

Run: `./node_modules/.bin/vitest run client/src/lib/useCompanyTheme.test.tsx client/src/pages/auth`
Expected: PASS, 1 + 3 + 3 uji.

- [ ] **Step 5: Halaman `Login`, `Recover`, `ChangePassword`**

`client/src/pages/Login.tsx` (tulis ulang seluruhnya):

```tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { brandName } from "@/components/shell/brand";
import { usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { AuthFrame } from "./auth/AuthFrame";
import { LoginForm } from "./auth/LoginForm";

export default function Login() {
  const { user, loading } = useAuth();
  const profile = usePublicProfile();
  const [error, setError] = useState<string | null>(null);
  const login = trpc.auth.login.useMutation({
    onSuccess: (account) => window.location.assign(account.mustChangePassword ? "/ubah-sandi" : "/operasional"),
    onError: (failure) => setError(failure.message),
  });

  useEffect(() => {
    if (!loading && user) window.location.assign(user.mustChangePassword ? "/ubah-sandi" : "/operasional");
  }, [loading, user]);
  useEffect(() => {
    if (profile.data?.setupRequired) window.location.assign("/siapkan");
  }, [profile.data?.setupRequired]);

  return (
    <AuthFrame brand={brandName({ tradingName: profile.data?.tradingName })} logoUrl={profile.data?.logoUrl ?? null} title="Masuk" description="Pakai akun yang diberikan pemilik usaha Anda.">
      <LoginForm onSubmit={(values) => { setError(null); login.mutate(values); }} isPending={login.isPending} errorMessage={error} />
    </AuthFrame>
  );
}
```

`client/src/pages/Recover.tsx`:

```tsx
import { brandName } from "@/components/shell/brand";
import { usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { AuthFrame } from "./auth/AuthFrame";
import { RecoverForm } from "./auth/RecoverForm";

export default function Recover() {
  const profile = usePublicProfile();
  const [error, setError] = useState<string | null>(null);
  const recover = trpc.auth.recover.useMutation({
    onSuccess: () => {
      toast.success("Akun dipulihkan. Kode yang Anda pakai kini hangus — buat kode baru dari menu pengguna bila sisanya menipis.");
      window.location.assign("/operasional");
    },
    onError: (failure) => setError(failure.message),
  });
  return (
    <AuthFrame brand={brandName({ tradingName: profile.data?.tradingName })} logoUrl={profile.data?.logoUrl ?? null} title="Pulihkan akun pemilik" description="Hanya untuk Pemegang Saham. Seluruh sesi lama akun ini akan keluar.">
      <RecoverForm onSubmit={(values) => { setError(null); recover.mutate(values); }} isPending={recover.isPending} errorMessage={error} />
    </AuthFrame>
  );
}
```

`client/src/pages/ChangePassword.tsx` (tulis ulang seluruhnya; perilaku sama dengan versi lama):

```tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { brandName } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MIN_LENGTH } from "@shared/accountRules";
import { useEffect, useState, type FormEvent } from "react";
import { AuthFrame } from "./auth/AuthFrame";

export default function ChangePassword() {
  const { user, loading, refresh, logout } = useAuth();
  const profile = usePublicProfile();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const change = trpc.auth.changePassword.useMutation({
    onSuccess: async () => { await refresh(); window.location.assign("/operasional"); },
    onError: (failure) => setError(failure.message),
  });
  useEffect(() => { if (!loading && !user) window.location.assign("/login"); }, [loading, user]);
  const lengthOk = newPassword.length >= PASSWORD_MIN_LENGTH;
  const matchOk = confirmation !== "" && newPassword === confirmation;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lengthOk || !matchOk) return;
    setError(null);
    change.mutate({ currentPassword, newPassword });
  }

  return (
    <AuthFrame brand={brandName({ tradingName: profile.data?.tradingName })} logoUrl={profile.data?.logoUrl ?? null} title="Ganti kata sandi Anda" description="Akun baru atau akun yang direset wajib memakai kata sandi pribadi sebelum mulai bekerja.">
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid gap-1">
          <Label htmlFor="current-password">Kata sandi saat ini</Label>
          <Input id="current-password" type="password" autoComplete="current-password" className={QUIET_FIELD} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="new-password">Kata sandi baru</Label>
          <Input id="new-password" type="password" autoComplete="new-password" className={QUIET_FIELD} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          <p className={`text-label ${newPassword === "" || lengthOk ? "text-ink-subtle" : "text-danger"}`}>{lengthOk ? "Panjangnya sudah cukup." : `Minimal ${PASSWORD_MIN_LENGTH} karakter${newPassword ? ` (saat ini ${newPassword.length})` : ""}.`}</p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="confirmation">Ulangi kata sandi baru</Label>
          <Input id="confirmation" type="password" autoComplete="new-password" className={QUIET_FIELD} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
          {confirmation !== "" && !matchOk ? <p className="text-label text-danger">Belum sama dengan kata sandi baru.</p> : null}
        </div>
        {error ? <p role="alert" className="rounded-md border-[1.5px] border-danger bg-danger-soft px-2 py-1 text-body text-ink">{error}</p> : null}
        <Button type="submit" className={`w-full ${BOLD_BUTTON}`} disabled={change.isPending || !lengthOk || !matchOk}>{change.isPending ? "Menyimpan…" : "Simpan kata sandi baru"}</Button>
        <Button type="button" variant="outline" className={`w-full ${OUTLINE_BUTTON}`} onClick={logout}>Keluar</Button>
      </form>
    </AuthFrame>
  );
}
```

- [ ] **Step 6: Rute `/pulihkan` dan penjaga warna mentah**

Di `client/src/App.tsx`, tambah di daftar lazy: `const Recover = lazy(() => import("./pages/Recover"));` dan sesudah `<Route path="/ubah-sandi" component={ChangePassword} />`:

```tsx
      <Route path="/pulihkan" component={Recover} />
```

Tambahkan ke `FOUNDATION_FILES` di `client/src/designFoundation.ts`:

```ts
  "client/src/lib/useCompanyTheme.ts",
  "client/src/lib/publicProfile.ts",
  "client/src/pages/auth/AuthFrame.tsx",
  "client/src/pages/auth/LoginForm.tsx",
  "client/src/pages/auth/RecoverForm.tsx",
  "client/src/pages/Login.tsx",
  "client/src/pages/Recover.tsx",
  "client/src/pages/ChangePassword.tsx",
```

- [ ] **Step 7: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 203 passed`, `Tests 1669 passed | 2 skipped`** (+3 berkas, +7 uji); `designFoundation.guard.test.ts` tetap lulus dengan delapan berkas baru di daftarnya.

- [ ] **Step 8: Periksa di peramban**

Jalankan server pengembangan (`./node_modules/.bin/tsx server/_core/index.ts` dengan `.env` termuat), buka `/login` dan `/pulihkan` pada lebar 1280, 1440, dan 1920: kartu di tengah, logo/inisial dan nama dagang `moneychanger` tampil, Tab berpindah Username → Kata sandi → Masuk → tautan, tanpa gulir mendatar. Coba masuk dengan kata sandi salah lima kali dengan `test-staff` → pesan "Coba lagi dalam 30 detik." tampil sebagai `alert`. **Jangan mengetik kata sandi akun mana pun selain akun uji pengembangan**; bila perlu masuk sebagai pemilik sungguhan, minta pengguna melakukannya.

- [ ] **Step 9: Commit**

```bash
git add shared/accountRules.ts server/internalAuth.ts client/src/lib/useCompanyTheme.ts client/src/lib/useCompanyTheme.test.tsx client/src/lib/publicProfile.ts client/src/pages/auth client/src/pages/Login.tsx client/src/pages/Recover.tsx client/src/pages/ChangePassword.tsx client/src/App.tsx client/src/designFoundation.ts
git commit -m "Masuk: layar masuk, pulihkan akun pemilik, dan ubah sandi bertema perusahaan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 10: Wizard `/siapkan`

**Files:**
- Create: `client/src/pages/setup/RecoveryCodeSheet.tsx`
- Create: `client/src/pages/setup/SetupWizard.tsx`
- Create: `client/src/pages/Setup.tsx`
- Modify: `client/src/App.tsx` (lazy `Setup`, rute `/siapkan`)
- Modify: `client/src/designFoundation.ts`
- Test: `client/src/pages/setup/RecoveryCodeSheet.test.tsx`, `client/src/pages/setup/SetupWizard.test.tsx`

**Interfaces:**
- Consumes: `setup.complete` → `{ user, recoveryCodes: string[] }` (Tugas 6); `StepFlow`, `FormSection` (pola); `USERNAME_PATTERN`, `PASSWORD_MIN_LENGTH`, `normalizeUsernameInput` (Tugas 9); `normalizeSecretCode`, `formatSecretCode`, `SETUP_CODE_GROUPS` (Tugas 2); `AuthFrame`, `usePublicProfile` (Tugas 9).
- Produces:
  - `recoveryCodesText(brand: string, codes: string[], generatedAt: Date): string`
  - `RecoveryCodeSheet({ brand, codes, continueLabel, onContinue })`
  - `type SetupPayload = { setupCode: string; owner: { name: string; username: string; password: string }; company: { legalEntityName: string; tradingName: string; licenseNumber?: string } }`
  - `SetupWizard({ onComplete: (payload: SetupPayload) => Promise<{ recoveryCodes: string[] }>; errorMessage: string | null; isPending: boolean; brand: string; onFinish: () => void })`

- [ ] **Step 1: Tulis uji yang gagal**

`client/src/pages/setup/RecoveryCodeSheet.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecoveryCodeSheet, recoveryCodesText } from "./RecoveryCodeSheet";

const CODES = ["ABCD-EFGH", "JKLM-NPQR", "STUV-WXYZ", "2345-6789", "AB23-CD45", "EF67-GH89", "JK23-LM45", "NP67-QR89"];

describe("lembar kode pemulihan", () => {
  it("berkas unduhan memuat nama usaha, kedelapan kode, dan peringatan sekali pakai", () => {
    const text = recoveryCodesText("ABC Valas", CODES, new Date("2026-09-26T03:00:00Z"));
    expect(text).toContain("ABC Valas");
    for (const code of CODES) expect(text).toContain(code);
    expect(text).toContain("hanya berlaku sekali");
  });

  it("tombol lanjut baru aktif sesudah pemilik mencentang sudah menyimpannya", async () => {
    const onContinue = vi.fn();
    render(<RecoveryCodeSheet brand="ABC Valas" codes={CODES} continueLabel="Masuk ke aplikasi" onContinue={onContinue} />);
    const button = screen.getByRole("button", { name: "Masuk ke aplikasi" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: "Saya sudah menyimpannya" }));
    await userEvent.click(button);
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
```

`client/src/pages/setup/SetupWizard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SetupWizard } from "./SetupWizard";

const next = () => screen.getByRole("button", { name: "Lanjut" });

function renderWizard(onComplete = vi.fn().mockResolvedValue({ recoveryCodes: ["ABCD-EFGH", "JKLM-NPQR", "STUV-WXYZ", "2345-6789", "AB23-CD45", "EF67-GH89", "JK23-LM45", "NP67-QR89"] })) {
  render(<SetupWizard onComplete={onComplete} errorMessage={null} isPending={false} brand="Aplikasi Valuta" onFinish={vi.fn()} />);
  return onComplete;
}

async function passCodeAndOwner(password = "Pemilik-abc-2026", confirmation = password) {
  await userEvent.type(screen.getByLabelText("Kode penyiapan"), "abcd efgh jklm");
  await userEvent.click(next());
  await userEvent.type(screen.getByLabelText("Nama Anda"), "Pemilik ABC");
  await userEvent.type(screen.getByLabelText("Username"), " Pemilik.ABC ");
  await userEvent.type(screen.getByLabelText("Kata sandi"), password);
  await userEvent.type(screen.getByLabelText("Ulangi kata sandi"), confirmation);
}

describe("wizard penyiapan", () => {
  it("langkah kode baru dapat dilewati sesudah kode berformat benar diketik", async () => {
    renderWizard();
    expect(next().hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Kode penyiapan"), "abcd");
    expect(next().hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Kode penyiapan"), "-efgh-jklm");
    expect(next().hasAttribute("disabled")).toBe(false);
  });

  it("akun pemilik menahan kata sandi pendek dan konfirmasi yang tidak sama", async () => {
    renderWizard();
    await passCodeAndOwner("pendek", "pendek");
    expect(next().hasAttribute("disabled")).toBe(true);
  });

  it("langkah perusahaan mengirim muatan baku: kode diformat, username huruf kecil tanpa spasi", async () => {
    const onComplete = renderWizard();
    await passCodeAndOwner();
    await userEvent.click(next());
    const submit = screen.getByRole("button", { name: "Siapkan perusahaan" });
    expect(submit.hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Nama badan hukum"), "PT ABC Valas");
    await userEvent.type(screen.getByLabelText("Nama dagang"), "ABC Valas");
    await userEvent.click(submit);
    expect(onComplete).toHaveBeenCalledWith({
      setupCode: "ABCD-EFGH-JKLM",
      owner: { name: "Pemilik ABC", username: "pemilik.abc", password: "Pemilik-abc-2026" },
      company: { legalEntityName: "PT ABC Valas", tradingName: "ABC Valas", licenseNumber: undefined },
    });
  });

  it("sesudah berhasil, kedelapan kode pemulihan tampil sebagai langkah terakhir", async () => {
    renderWizard();
    await passCodeAndOwner();
    await userEvent.click(next());
    await userEvent.type(screen.getByLabelText("Nama badan hukum"), "PT ABC Valas");
    await userEvent.type(screen.getByLabelText("Nama dagang"), "ABC Valas");
    await userEvent.click(screen.getByRole("button", { name: "Siapkan perusahaan" }));
    expect(await screen.findByText("NP67-QR89")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Simpan kode pemulihan Anda/ })).toBeTruthy();
  });
});
```

Run: `./node_modules/.bin/vitest run client/src/pages/setup`
Expected: FAIL — modul belum ada.

- [ ] **Step 2: `RecoveryCodeSheet`**

`client/src/pages/setup/RecoveryCodeSheet.tsx`:

```tsx
import { BOLD_BUTTON, OUTLINE_BUTTON } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useId, useState } from "react";

export function recoveryCodesText(brand: string, codes: string[], generatedAt: Date): string {
  const stamp = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(generatedAt);
  return [
    `Kode pemulihan pemilik — ${brand}`,
    `Dibuat ${stamp} WIB`,
    "",
    ...codes.map((code, index) => `${index + 1}. ${code}`),
    "",
    "Setiap kode hanya berlaku sekali. Simpan di tempat terkunci, terpisah dari kata sandi.",
    "Membuat kode baru dari aplikasi membatalkan seluruh kode di lembar ini.",
  ].join("\n");
}

/**
 * Satu-satunya saat kode pemulihan tampil. Server tidak menyimpan kode mentahnya, jadi lembar ini
 * menahan pemilik sampai ia menyatakan sudah menyimpannya.
 */
export function RecoveryCodeSheet({ brand, codes, continueLabel, onContinue }: {
  brand: string;
  codes: string[];
  continueLabel: string;
  onContinue: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const checkboxId = useId();

  function download() {
    const blob = new Blob([recoveryCodesText(brand, codes, new Date())], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kode-pemulihan-pemilik.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-3">
      <p className="text-body text-ink-muted">Pakai salah satu kode ini bila Anda lupa kata sandi pemilik. Setiap kode hanya berlaku sekali, dan halaman ini tidak dapat dibuka lagi.</p>
      <ol aria-label="Kode pemulihan" className="grid grid-cols-2 gap-2 rounded-lg border-2 border-ink bg-paper p-3 font-mono text-body font-bold tabular-nums text-ink sm:grid-cols-4">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={() => window.print()}>Cetak</Button>
        <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={download}>Unduh .txt</Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={checkboxId} checked={saved} onCheckedChange={(value) => setSaved(value === true)} />
        <Label htmlFor={checkboxId}>Saya sudah menyimpannya</Label>
      </div>
      <Button type="button" className={BOLD_BUTTON} disabled={!saved} onClick={onContinue}>{continueLabel}</Button>
    </div>
  );
}
```

- [ ] **Step 3: `SetupWizard`**

`client/src/pages/setup/SetupWizard.tsx`:

```tsx
import { FormSection } from "@/components/patterns/FormSection";
import { StepFlow, type Step } from "@/components/patterns/StepFlow";
import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN, normalizeUsernameInput } from "@shared/accountRules";
import { SETUP_CODE_GROUPS, formatSecretCode, normalizeSecretCode } from "@shared/secretCodes";
import { useState, type ReactNode } from "react";
import { RecoveryCodeSheet } from "./RecoveryCodeSheet";

export type SetupPayload = {
  setupCode: string;
  owner: { name: string; username: string; password: string };
  company: { legalEntityName: string; tradingName: string; licenseNumber?: string };
};

const STEPS: Step[] = [
  { id: "kode", title: "Kode penyiapan" },
  { id: "pemilik", title: "Akun pemilik" },
  { id: "perusahaan", title: "Perusahaan" },
];

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-label text-danger">{error}</p> : hint ? <p className="text-label text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

/**
 * "Siapkan perusahaan Anda" (spec 2026-09-26 §2). Tiga langkah bernomor, lalu lembar kode pemulihan
 * sebagai langkah keempat yang hanya muncul sesudah server menyelesaikan penyiapan dalam satu
 * transaksi. Aturan di sini hanya petunjuk; server tetap penegaknya.
 */
export function SetupWizard({ onComplete, errorMessage, isPending, brand, onFinish }: {
  onComplete: (payload: SetupPayload) => Promise<{ recoveryCodes: string[] }>;
  errorMessage: string | null;
  isPending: boolean;
  brand: string;
  onFinish: () => void;
}) {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [legalEntityName, setLegalEntityName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const compactCode = normalizeSecretCode(code, SETUP_CODE_GROUPS);
  const normalizedUsername = normalizeUsernameInput(username);
  const usernameOk = USERNAME_PATTERN.test(normalizedUsername);
  const passwordOk = password.length >= PASSWORD_MIN_LENGTH;
  const matchOk = confirmation !== "" && confirmation === password;
  const ownerOk = name.trim().length >= 3 && usernameOk && passwordOk && matchOk;
  const companyOk = legalEntityName.trim() !== "" && tradingName.trim() !== "";
  const canAdvance = step === 0 ? compactCode !== null : step === 1 ? ownerOk : false;

  async function submit() {
    const result = await onComplete({
      setupCode: formatSecretCode(compactCode!),
      owner: { name: name.trim(), username: normalizedUsername, password },
      company: { legalEntityName: legalEntityName.trim(), tradingName: tradingName.trim(), licenseNumber: licenseNumber.trim() || undefined },
    });
    setRecoveryCodes(result.recoveryCodes);
  }

  if (recoveryCodes) {
    return (
      <section aria-labelledby="langkah-kode-pemulihan" className="grid gap-2">
        <h2 id="langkah-kode-pemulihan" className="text-body font-bold text-ink">4. Simpan kode pemulihan Anda</h2>
        <RecoveryCodeSheet brand={tradingName.trim() || brand} codes={recoveryCodes} continueLabel="Masuk ke aplikasi" onContinue={onFinish} />
      </section>
    );
  }

  return (
    <StepFlow steps={STEPS} currentIndex={step} onStepChange={setStep} canAdvance={canAdvance}>
      {step === 0 ? (
        <FormSection number={1} title="Masukkan kode penyiapan" description="Kode ini dibuat di server dengan perintah node scripts/tenant.mjs setup-code dan berlaku 24 jam.">
          <Field id="setup-code" label="Kode penyiapan" hint="Dua belas huruf atau angka, mis. ABCD-EFGH-JKLM. Huruf kecil dan spasi tidak masalah." error={code !== "" && compactCode === null ? "Kode belum lengkap atau memuat huruf yang tidak dipakai (0, O, 1, I)." : null}>
            <Input id="setup-code" autoComplete="one-time-code" className={`${QUIET_FIELD} font-mono uppercase`} value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
        </FormSection>
      ) : null}
      {step === 1 ? (
        <FormSection number={2} title="Buat akun pemilik" description="Akun ini berperan Pemegang Saham dan satu-satunya yang dapat membuat akun Controller.">
          <Field id="owner-name" label="Nama Anda">
            <Input id="owner-name" autoComplete="name" className={QUIET_FIELD} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field id="owner-username" label="Username" hint="3–48 karakter: huruf kecil, angka, titik, garis bawah, atau strip." error={username !== "" && !usernameOk ? "Username hanya boleh huruf kecil, angka, titik, garis bawah, atau strip (3–48 karakter)." : null}>
            <Input id="owner-username" autoComplete="username" className={QUIET_FIELD} value={username} onChange={(event) => setUsername(event.target.value)} />
          </Field>
          <Field id="owner-password" label="Kata sandi" hint={`Minimal ${PASSWORD_MIN_LENGTH} karakter.`} error={password !== "" && !passwordOk ? `Minimal ${PASSWORD_MIN_LENGTH} karakter (saat ini ${password.length}).` : null}>
            <Input id="owner-password" type="password" autoComplete="new-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Field id="owner-confirmation" label="Ulangi kata sandi" error={confirmation !== "" && !matchOk ? "Belum sama dengan kata sandi." : null}>
            <Input id="owner-confirmation" type="password" autoComplete="new-password" className={QUIET_FIELD} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </Field>
        </FormSection>
      ) : null}
      {step === 2 ? (
        <FormSection number={3} title="Tentang perusahaan Anda" description="Nama tampil di kwitansi, halaman masuk, dan halaman kurs publik. Sisanya dapat dilengkapi nanti di Profil Perusahaan.">
          <Field id="legal-name" label="Nama badan hukum" hint="Mis. PT Contoh Valuta Nusantara.">
            <Input id="legal-name" className={QUIET_FIELD} value={legalEntityName} onChange={(event) => setLegalEntityName(event.target.value)} />
          </Field>
          <Field id="trading-name" label="Nama dagang" hint="Nama yang dikenal nasabah.">
            <Input id="trading-name" className={QUIET_FIELD} value={tradingName} onChange={(event) => setTradingName(event.target.value)} />
          </Field>
          <Field id="license-number" label="Nomor izin KUPVA (boleh nanti)">
            <Input id="license-number" className={QUIET_FIELD} value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} />
          </Field>
          {errorMessage ? <p role="alert" className="rounded-md border-[1.5px] border-danger bg-danger-soft px-2 py-1 text-body text-ink">{errorMessage}</p> : null}
          <Button type="button" className={BOLD_BUTTON} disabled={!companyOk || isPending} onClick={() => { void submit().catch(() => undefined); }}>
            {isPending ? "Menyiapkan…" : "Siapkan perusahaan"}
          </Button>
        </FormSection>
      ) : null}
    </StepFlow>
  );
}
```

`submit().catch(() => undefined)` disengaja: galatnya sudah ditampilkan lewat `errorMessage` dari halaman; tanpa `catch` penolakan menjadi *unhandled rejection* di konsol.

Run: `./node_modules/.bin/vitest run client/src/pages/setup`
Expected: PASS, 2 + 4 uji.

- [ ] **Step 4: Halaman `/siapkan`**

`client/src/pages/Setup.tsx`:

```tsx
import { LoadingState, ErrorState } from "@/components/patterns/PageStates";
import { BOLD_BUTTON } from "@/components/patterns/tebal";
import { brandName } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { AuthFrame } from "./auth/AuthFrame";
import { SetupWizard } from "./setup/SetupWizard";

export default function Setup() {
  const profile = usePublicProfile();
  const [error, setError] = useState<string | null>(null);
  // Sesudah berhasil, profil publik akan berkata "sudah disiapkan"; wizard tetap tampil sampai pemilik
  // menyimpan kodenya.
  const [started, setStarted] = useState(false);
  const complete = trpc.setup.complete.useMutation({ onError: (failure) => setError(failure.message) });
  const brand = brandName({ tradingName: profile.data?.tradingName });

  if (profile.isLoading) return <main className="grid min-h-screen place-items-center bg-paper px-4"><div className="w-full max-w-2xl"><LoadingState label="Memeriksa keadaan instalasi…" /></div></main>;
  if (profile.isError) {
    return <main className="grid min-h-screen place-items-center bg-paper px-4"><div className="w-full max-w-2xl"><ErrorState what="Keadaan instalasi tidak dapat dibaca." nextStep="Pastikan server dan basis data berjalan, lalu coba lagi." onRetry={() => profile.refetch()} /></div></main>;
  }
  if (!started && profile.data && !profile.data.setupRequired) {
    return (
      <AuthFrame brand={brand} logoUrl={profile.data.logoUrl} title="Perusahaan ini sudah disiapkan" description="Masuk dengan akun pemilik atau akun yang diberikan pemilik.">
        <Button className={`w-full ${BOLD_BUTTON}`} onClick={() => window.location.assign("/login")}>Ke halaman masuk</Button>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame brand={brand} logoUrl={profile.data?.logoUrl ?? null} title="Siapkan perusahaan Anda" description="Sekali saja, untuk pemilik usaha. Butuh sekitar tiga menit." width="wide">
      <SetupWizard
        brand={brand}
        isPending={complete.isPending}
        errorMessage={error}
        onComplete={async (payload) => {
          setError(null);
          setStarted(true);
          const result = await complete.mutateAsync(payload);
          return { recoveryCodes: result.recoveryCodes };
        }}
        onFinish={() => window.location.assign("/operasional")}
      />
    </AuthFrame>
  );
}
```

Di `client/src/App.tsx`: `const Setup = lazy(() => import("./pages/Setup"));` dan rute `<Route path="/siapkan" component={Setup} />` di bawah `/pulihkan`.

Tambahkan ke `FOUNDATION_FILES`:

```ts
  "client/src/pages/setup/RecoveryCodeSheet.tsx",
  "client/src/pages/setup/SetupWizard.tsx",
  "client/src/pages/Setup.tsx",
```

- [ ] **Step 5: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 205 passed`, `Tests 1675 passed | 2 skipped`** (+2 berkas, +6 uji).

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/setup client/src/pages/Setup.tsx client/src/App.tsx client/src/designFoundation.ts
git commit -m "Penyiapan: wizard /siapkan dan lembar kode pemulihan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 11: Kode pemulihan — layar, ajakan, dan menu pengguna

**Files:**
- Create: `client/src/components/shell/RecoveryCodeNotice.tsx`
- Create: `client/src/pages/setup/RegenerateRecoveryCodes.tsx`
- Create: `client/src/pages/RecoveryCodes.tsx`
- Modify: `client/src/components/shell/AppSidebar.tsx:23-31` (prop dan `userMenuItems`), `:66-68` (butir menu)
- Modify: `client/src/components/DashboardLayout.tsx:48-66` (ajakan dan prop menu)
- Modify: `client/src/components/shell/pageTitle.ts:16` (judul rute)
- Modify: `client/src/App.tsx` (lazy `RecoveryCodes`, rute `/operasional/kode-pemulihan` SHAREHOLDER)
- Modify: `client/src/designFoundation.ts`
- Test: `client/src/components/shell/RecoveryCodeNotice.test.tsx`, `client/src/pages/setup/RegenerateRecoveryCodes.test.tsx`, `client/src/components/shell/AppSidebar.test.tsx` (+1 uji)

**Interfaces:**
- Consumes: `auth.me.recoveryCodesRemaining` dan `auth.regenerateRecoveryCodes` (Tugas 5); `RecoveryCodeSheet` (Tugas 10).
- Produces:
  - `RECOVERY_CODE_LOW_WATERMARK = 2`, `RecoveryCodeNotice({ role, remaining, onOpen })`
  - `userMenuItems(role: BackOfficeRole): { label: string; path: string }[]` diekspor dari `AppSidebar.tsx`
  - `RegenerateRecoveryCodes({ brand, codes, errorMessage, isPending, onRegenerate, onDone })`

- [ ] **Step 1: Tulis uji yang gagal**

`client/src/components/shell/RecoveryCodeNotice.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecoveryCodeNotice } from "./RecoveryCodeNotice";

describe("ajakan kode pemulihan", () => {
  it("tidak tampil untuk peran lain, sisa yang cukup, atau data yang belum dimuat", () => {
    const { container, rerender } = render(<RecoveryCodeNotice role="CONTROLLER" remaining={0} onOpen={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    rerender(<RecoveryCodeNotice role="SHAREHOLDER" remaining={3} onOpen={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    rerender(<RecoveryCodeNotice role="SHAREHOLDER" remaining={null} onOpen={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("pemilik tanpa kode — pemilik produksi hari ini — diajak membuatnya", async () => {
    const onOpen = vi.fn();
    render(<RecoveryCodeNotice role="SHAREHOLDER" remaining={0} onOpen={onOpen} />);
    expect(screen.getByRole("status").textContent).toContain("belum punya kode pemulihan");
    await userEvent.click(screen.getByRole("button", { name: "Buat kode pemulihan" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("sisa satu atau dua kode menyebut jumlahnya", () => {
    render(<RecoveryCodeNotice role="SHAREHOLDER" remaining={2} onOpen={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("Tinggal 2 kode pemulihan");
  });
});
```

`client/src/pages/setup/RegenerateRecoveryCodes.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RegenerateRecoveryCodes } from "./RegenerateRecoveryCodes";

describe("buat ulang kode pemulihan", () => {
  it("meminta kata sandi saat ini dan memperingatkan bahwa kode lama batal", async () => {
    const onRegenerate = vi.fn();
    render(<RegenerateRecoveryCodes brand="ABC Valas" codes={null} errorMessage={null} isPending={false} onRegenerate={onRegenerate} onDone={vi.fn()} />);
    expect(screen.getByText(/seluruh kode lama yang belum terpakai batal/)).toBeTruthy();
    const button = screen.getByRole("button", { name: "Buat 8 kode baru" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Kata sandi saat ini"), "Pemilik-abc-2026");
    await userEvent.click(button);
    expect(onRegenerate).toHaveBeenCalledWith("Pemilik-abc-2026");
  });

  it("sesudah berhasil menampilkan lembar kode, bukan formulir lagi", () => {
    render(<RegenerateRecoveryCodes brand="ABC Valas" codes={["ABCD-EFGH", "JKLM-NPQR", "STUV-WXYZ", "2345-6789", "AB23-CD45", "EF67-GH89", "JK23-LM45", "NP67-QR89"]} errorMessage={null} isPending={false} onRegenerate={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByText("NP67-QR89")).toBeTruthy();
    expect(screen.queryByLabelText("Kata sandi saat ini")).toBeNull();
  });
});
```

Tambahkan di akhir blok `describe("AppSidebar", …)` pada `client/src/components/shell/AppSidebar.test.tsx` (dan tambahkan `userMenuItems` ke impor `./AppSidebar`):

```tsx
  it("menu pengguna memuat Kode pemulihan hanya untuk Pemegang Saham", () => {
    expect(userMenuItems("SHAREHOLDER").map((item) => item.path)).toContain("/operasional/kode-pemulihan");
    expect(userMenuItems("CONTROLLER").map((item) => item.path)).not.toContain("/operasional/kode-pemulihan");
  });
```

Run: `./node_modules/.bin/vitest run client/src/components/shell client/src/pages/setup/RegenerateRecoveryCodes.test.tsx`
Expected: FAIL — `RecoveryCodeNotice`, `RegenerateRecoveryCodes`, dan `userMenuItems` belum ada.

- [ ] **Step 2: `RecoveryCodeNotice`**

```tsx
import { BOLD_BUTTON } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import type { BackOfficeRole } from "@shared/backOfficeNavigation";

/** Pada jumlah ini atau kurang, pemilik diajak membuat kode baru sebelum habis. */
export const RECOVERY_CODE_LOW_WATERMARK = 2;

/**
 * Ajakan di atas isi shell. Pemilik produksi dibuat dari .env sebelum sub-proyek 2 dan karena itu
 * belum punya kode sama sekali; ajakan inilah jalan satu-satunya ia mendapatkannya.
 */
export function RecoveryCodeNotice({ role, remaining, onOpen }: { role: BackOfficeRole; remaining: number | null; onOpen: () => void }) {
  if (role !== "SHAREHOLDER" || remaining === null || remaining > RECOVERY_CODE_LOW_WATERMARK) return null;
  const message = remaining === 0
    ? "Anda belum punya kode pemulihan. Tanpanya, kata sandi pemilik yang terlupa tidak dapat dipulihkan dari aplikasi."
    : `Tinggal ${remaining} kode pemulihan. Buat yang baru sebelum habis.`;
  return (
    <div role="status" className="mx-gutter mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-ink bg-warning-soft px-3 py-2">
      <p className="text-body font-semibold text-ink">{message}</p>
      <Button className={BOLD_BUTTON} onClick={onOpen}>Buat kode pemulihan</Button>
    </div>
  );
}
```

- [ ] **Step 3: `RegenerateRecoveryCodes` dan halamannya**

`client/src/pages/setup/RegenerateRecoveryCodes.tsx`:

```tsx
import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, type FormEvent } from "react";
import { RecoveryCodeSheet } from "./RecoveryCodeSheet";

export function RegenerateRecoveryCodes({ brand, codes, errorMessage, isPending, onRegenerate, onDone }: {
  brand: string;
  codes: string[] | null;
  errorMessage: string | null;
  isPending: boolean;
  onRegenerate: (currentPassword: string) => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  if (codes) return <RecoveryCodeSheet brand={brand} codes={codes} continueLabel="Selesai" onContinue={onDone} />;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password) onRegenerate(password);
  }

  return (
    <form onSubmit={submit} className="grid max-w-md gap-3">
      <p className="text-body text-ink-muted">Delapan kode baru akan dibuat, dan seluruh kode lama yang belum terpakai batal saat itu juga. Simpan lembar barunya sebelum menutup halaman.</p>
      <div className="grid gap-1">
        <Label htmlFor="regenerate-password">Kata sandi saat ini</Label>
        <Input id="regenerate-password" type="password" autoComplete="current-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      {errorMessage ? <p role="alert" className="rounded-md border-[1.5px] border-danger bg-danger-soft px-2 py-1 text-body text-ink">{errorMessage}</p> : null}
      <Button type="submit" className={BOLD_BUTTON} disabled={!password || isPending}>{isPending ? "Membuat…" : "Buat 8 kode baru"}</Button>
    </form>
  );
}
```

`client/src/pages/RecoveryCodes.tsx`:

```tsx
import { PageHeader } from "@/components/patterns/PageHeader";
import { brandName } from "@/components/shell/brand";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { RegenerateRecoveryCodes } from "./setup/RegenerateRecoveryCodes";

export default function RecoveryCodes() {
  const utils = trpc.useUtils();
  const profile = trpc.companyProfile.get.useQuery();
  const me = trpc.auth.me.useQuery();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const regenerate = trpc.auth.regenerateRecoveryCodes.useMutation({
    onSuccess: (result) => { setCodes(result.codes); void utils.auth.me.invalidate(); },
    onError: (failure) => setError(failure.message),
  });
  const remaining = me.data?.recoveryCodesRemaining;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Kode pemulihan pemilik"
        description={codes ? undefined : remaining === null || remaining === undefined ? undefined : `Sisa kode yang belum terpakai: ${remaining} dari 8.`}
      />
      <RegenerateRecoveryCodes
        brand={brandName(profile.data)}
        codes={codes}
        errorMessage={error}
        isPending={regenerate.isPending}
        onRegenerate={(currentPassword) => { setError(null); regenerate.mutate({ currentPassword }); }}
        onDone={() => window.location.assign("/operasional")}
      />
    </div>
  );
}
```

- [ ] **Step 4: Menu pengguna, ajakan di shell, judul, rute**

Di `client/src/components/shell/AppSidebar.tsx`, tambahkan sebelum `export function AppSidebar`:

```tsx
/** Butir menu pengguna. "Kode pemulihan" hanya bagi Pemegang Saham — rutenya sengaja tidak masuk sidebar. */
export function userMenuItems(role: BackOfficeRole): { label: string; path: string }[] {
  const items = [{ label: "Lihat halaman publik", path: "/" }];
  if (role === "SHAREHOLDER") items.push({ label: "Kode pemulihan", path: "/operasional/kode-pemulihan" });
  return items;
}
```

dan ganti butir `<DropdownMenuItem onClick={() => onNavigate("/")}>Lihat halaman publik</DropdownMenuItem>` dengan:

```tsx
            {userMenuItems(role).map((item) => <DropdownMenuItem key={item.path} onClick={() => onNavigate(item.path)}>{item.label}</DropdownMenuItem>)}
```

Di `client/src/components/DashboardLayout.tsx`, tambah impor `import { RecoveryCodeNotice } from "./shell/RecoveryCodeNotice";` dan sisipkan tepat sesudah `<AppHeader … />`:

```tsx
        <RecoveryCodeNotice role={user!.role as BackOfficeRole} remaining={user!.recoveryCodesRemaining ?? null} onOpen={() => goTo("/operasional/kode-pemulihan")} />
```

Di `client/src/components/shell/pageTitle.ts`, tambahkan di bawah baris `/operasional/pola`:

```ts
titles.set("/operasional/kode-pemulihan", { group: "Pengaturan", title: "Kode pemulihan" });
```

Di `client/src/App.tsx`: `const RecoveryCodes = lazy(() => import("./pages/RecoveryCodes"));` dan rute

```tsx
      <Route path="/operasional/kode-pemulihan"><OperationsRoute minimumRole="SHAREHOLDER" page={<RecoveryCodes />} /></Route>
```

Tambahkan ke `FOUNDATION_FILES`:

```ts
  "client/src/components/shell/RecoveryCodeNotice.tsx",
  "client/src/pages/setup/RegenerateRecoveryCodes.tsx",
  "client/src/pages/RecoveryCodes.tsx",
```

- [ ] **Step 5: Jalankan uji**

Run: `./node_modules/.bin/vitest run client/src/components/shell client/src/pages/setup server/backOfficeNavigation.test.ts`
Expected: PASS — 3 + 2 + 1 uji baru; uji navigasi tetap lulus (rute baru tidak ada di sidebar, jadi tidak perlu dipetakan di `pageByPath`).

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 207 passed`, `Tests 1681 passed | 2 skipped`** (+2 berkas, +6 uji).

- [ ] **Step 7: Commit**

```bash
git add client/src/components/shell/RecoveryCodeNotice.tsx client/src/components/shell/RecoveryCodeNotice.test.tsx client/src/pages/setup/RegenerateRecoveryCodes.tsx client/src/pages/setup/RegenerateRecoveryCodes.test.tsx client/src/pages/RecoveryCodes.tsx client/src/components/shell/AppSidebar.tsx client/src/components/shell/AppSidebar.test.tsx client/src/components/DashboardLayout.tsx client/src/components/shell/pageTitle.ts client/src/App.tsx client/src/designFoundation.ts
git commit -m "Pemulihan: layar buat ulang kode, ajakan pemilik, dan menu pengguna

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 12: Pengguna & peran

**Files:**
- Create: `client/src/pages/users/accounts.ts`, `client/src/pages/users/CreateUserForm.tsx`, `client/src/pages/users/ResetPasswordDialog.tsx`, `client/src/pages/users/UserDetail.tsx`
- Modify (tulis ulang): `client/src/pages/UserManagement.tsx`
- Modify: `client/src/designFoundation.ts`
- Test: `client/src/pages/users/CreateUserForm.test.tsx`, `client/src/pages/users/ResetPasswordDialog.test.tsx`, `client/src/pages/users/UserDetail.test.tsx`

**Interfaces:**
- Consumes: `users.list`, `users.create`, `users.setRole`, `users.setStatus`, `users.resetPassword` (tidak berubah); `DataTable`, `ListDetailLayout`, `PageHeader`, `FormSection`, `LoadingState`, `EmptyState`, `ErrorState` (pola); `PASSWORD_MIN_LENGTH`, `USERNAME_PATTERN`, `normalizeUsernameInput` (Tugas 9).
- Produces:
  - `type InternalAccount = { id: number; username: string | null; name: string | null; role: string; accountStatus: string; mustChangePassword: boolean; lastSignedIn: string | Date | null }`
  - `ROLE_LABELS`, `isWorkforceAccount(account)`, `accountDisplayName(account)`
  - `CreateUserForm({ isShareholder, isPending, onSubmit, initialRole? })`
  - `ResetPasswordDialog({ accountName, open, onOpenChange, isPending, onConfirm })`
  - `UserDetail({ account, onRoleChange, onSuspend, onActivate, onResetPassword })`

- [ ] **Step 1: Tulis uji yang gagal**

`client/src/pages/users/CreateUserForm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateUserForm } from "./CreateUserForm";

describe("buat akun", () => {
  it("peran Controller hanya ditawarkan kepada Pemegang Saham", () => {
    const { rerender } = render(<CreateUserForm isShareholder={false} isPending={false} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("option", { name: "Controller" })).toBeNull();
    rerender(<CreateUserForm isShareholder isPending={false} onSubmit={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Controller" })).toBeTruthy();
  });

  it("kata sandi awal di bawah 12 karakter menahan tombol; yang sah dikirim dengan username baku", async () => {
    const onSubmit = vi.fn();
    render(<CreateUserForm isShareholder={false} isPending={false} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Nama"), "Budi Kasir");
    await userEvent.type(screen.getByLabelText("Username"), " Budi.Kasir ");
    await userEvent.type(screen.getByLabelText("Kata sandi awal"), "pendek");
    const button = screen.getByRole("button", { name: "Buat akun" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Kata sandi awal"), "-cukup-panjang");
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith({ name: "Budi Kasir", username: "budi.kasir", password: "pendek-cukup-panjang", role: "STAFF" });
  });
});
```

`client/src/pages/users/ResetPasswordDialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

describe("reset kata sandi", () => {
  it("judulnya menyebut nama akun dan tombolnya menunggu kata sandi yang sah dan sama", async () => {
    render(<ResetPasswordDialog accountName="Budi Kasir" open onOpenChange={vi.fn()} isPending={false} onConfirm={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Reset kata sandi Budi Kasir?" })).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Kata sandi sementara"), "Sementara-2026");
    await userEvent.type(screen.getByLabelText("Ulangi kata sandi sementara"), "Sementara-2027");
    expect(screen.getByRole("button", { name: "Reset kata sandi" }).hasAttribute("disabled")).toBe(true);
  });

  it("mengirim kata sandi sementara bila keduanya sama", async () => {
    const onConfirm = vi.fn();
    render(<ResetPasswordDialog accountName="Budi Kasir" open onOpenChange={vi.fn()} isPending={false} onConfirm={onConfirm} />);
    await userEvent.type(screen.getByLabelText("Kata sandi sementara"), "Sementara-2026");
    await userEvent.type(screen.getByLabelText("Ulangi kata sandi sementara"), "Sementara-2026");
    await userEvent.click(screen.getByRole("button", { name: "Reset kata sandi" }));
    expect(onConfirm).toHaveBeenCalledWith("Sementara-2026");
  });
});
```

`client/src/pages/users/UserDetail.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserDetail } from "./UserDetail";

const base = { id: 7, username: "budi.kasir", name: "Budi Kasir", role: "STAFF", accountStatus: "ACTIVE", mustChangePassword: false, lastSignedIn: null };
const handlers = () => ({ onRoleChange: vi.fn(), onSuspend: vi.fn(), onActivate: vi.fn(), onResetPassword: vi.fn() });

describe("detail akun", () => {
  it("akun tata kelola tidak dapat diubah dari layar ini", () => {
    render(<UserDetail account={{ ...base, role: "CONTROLLER" }} {...handlers()} />);
    expect(screen.getByText(/dilindungi/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nonaktifkan" })).toBeNull();
  });

  it("menonaktifkan meminta konfirmasi yang menyebut nama akunnya", async () => {
    const actions = handlers();
    render(<UserDetail account={base} {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: "Nonaktifkan" }));
    expect(screen.getByRole("heading", { name: "Nonaktifkan Budi Kasir?" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Ya, nonaktifkan" }));
    expect(actions.onSuspend).toHaveBeenCalledOnce();
  });
});
```

Run: `./node_modules/.bin/vitest run client/src/pages/users`
Expected: FAIL — modul belum ada.

- [ ] **Step 2: `accounts.ts`, `CreateUserForm`, `ResetPasswordDialog`, `UserDetail`**

`client/src/pages/users/accounts.ts`:

```ts
export type InternalAccount = {
  id: number;
  username: string | null;
  name: string | null;
  role: string;
  accountStatus: string;
  mustChangePassword: boolean;
  lastSignedIn: string | Date | null;
};

export const ROLE_LABELS: Record<string, string> = { SHAREHOLDER: "Pemegang Saham", CONTROLLER: "Controller", ADMIN: "Admin", STAFF: "Staf" };

/** Hanya Admin dan Staf yang dapat dikelola lewat delegasi; aturan yang sama ditegakkan `assertWorkforceAccount` di server. */
export function isWorkforceAccount(account: Pick<InternalAccount, "role">) {
  return account.role === "ADMIN" || account.role === "STAFF";
}

export function accountDisplayName(account: Pick<InternalAccount, "name" | "username">) {
  return account.name?.trim() || account.username || "Akun tanpa nama";
}
```

`client/src/pages/users/CreateUserForm.tsx`:

```tsx
import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN, normalizeUsernameInput } from "@shared/accountRules";
import { useState, type FormEvent } from "react";

type CreatableRole = "STAFF" | "ADMIN" | "CONTROLLER";

export function CreateUserForm({ isShareholder, isPending, onSubmit, initialRole = "STAFF" }: {
  isShareholder: boolean;
  isPending: boolean;
  /** Pintasan dasbor Pemegang Saham membuka layar ini dengan `?role=ADMIN` atau `?role=STAFF`. */
  initialRole?: "STAFF" | "ADMIN";
  onSubmit: (values: { name: string; username: string; password: string; role: CreatableRole }) => void;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreatableRole>(initialRole);
  const normalized = normalizeUsernameInput(username);
  const ready = name.trim().length >= 3 && USERNAME_PATTERN.test(normalized) && password.length >= PASSWORD_MIN_LENGTH;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    onSubmit({ name: name.trim(), username: normalized, password, role });
    setName(""); setUsername(""); setPassword("");
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="new-user-name">Nama</Label>
        <Input id="new-user-name" className={QUIET_FIELD} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="new-user-username">Username</Label>
        <Input id="new-user-username" className={QUIET_FIELD} placeholder="nama.pengguna" value={username} onChange={(event) => setUsername(event.target.value)} />
        {username !== "" && !USERNAME_PATTERN.test(normalized) ? <p className="text-label text-danger">Huruf kecil, angka, titik, garis bawah, atau strip; 3–48 karakter.</p> : null}
      </div>
      <div className="grid gap-1">
        <Label htmlFor="new-user-password">Kata sandi awal</Label>
        <Input id="new-user-password" type="password" autoComplete="new-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
        <p className="text-label text-ink-subtle">Minimal {PASSWORD_MIN_LENGTH} karakter. Pengguna wajib menggantinya saat pertama masuk.</p>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="new-user-role">Peran</Label>
        <select id="new-user-role" className={`h-control px-2 text-body text-ink ${QUIET_FIELD}`} value={role} onChange={(event) => setRole(event.target.value as CreatableRole)}>
          <option value="STAFF">Staf</option>
          <option value="ADMIN">Admin</option>
          {isShareholder ? <option value="CONTROLLER">Controller</option> : null}
        </select>
        <p className="text-label text-ink-subtle">Admin mengelola kurs dan persetujuan; Staf mencatat operasional. Controller hanya dapat dibuat Pemegang Saham.</p>
      </div>
      <Button type="submit" className={BOLD_BUTTON} disabled={!ready || isPending}>{isPending ? "Membuat…" : "Buat akun"}</Button>
    </form>
  );
}
```

`client/src/pages/users/ResetPasswordDialog.tsx`:

```tsx
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@shared/accountRules";
import { useState } from "react";

/** Pengganti `window.prompt`: kata sandi sementara diketik dua kali, tidak pernah tampil di layar. */
export function ResetPasswordDialog({ accountName, open, onOpenChange, isPending, onConfirm }: {
  accountName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: (newPassword: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const ready = password.length >= PASSWORD_MIN_LENGTH && password === confirmation;
  const close = (next: boolean) => { if (!next) { setPassword(""); setConfirmation(""); } onOpenChange(next); };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset kata sandi {accountName}?</DialogTitle>
          <DialogDescription>Seluruh sesi akun ini langsung keluar, dan pengguna wajib mengganti kata sandi sementara ini saat masuk.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="reset-password">Kata sandi sementara</Label>
            <Input id="reset-password" type="password" autoComplete="new-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
            <p className="text-label text-ink-subtle">Minimal {PASSWORD_MIN_LENGTH} karakter. Sampaikan langsung kepada penggunanya, bukan lewat obrolan grup.</p>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="reset-confirmation">Ulangi kata sandi sementara</Label>
            <Input id="reset-confirmation" type="password" autoComplete="new-password" className={QUIET_FIELD} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className={OUTLINE_BUTTON} onClick={() => close(false)}>Batal</Button>
          <Button className={BOLD_BUTTON} disabled={!ready || isPending} onClick={() => onConfirm(password)}>{isPending ? "Mereset…" : "Reset kata sandi"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`client/src/pages/users/UserDetail.tsx`:

```tsx
import { OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, accountDisplayName, isWorkforceAccount, type InternalAccount } from "./accounts";

export function UserDetail({ account, onRoleChange, onSuspend, onActivate, onResetPassword }: {
  account: InternalAccount;
  onRoleChange: (role: "ADMIN" | "STAFF") => void;
  onSuspend: () => void;
  onActivate: () => void;
  onResetPassword: () => void;
}) {
  const name = accountDisplayName(account);
  const lastSignedIn = account.lastSignedIn ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(account.lastSignedIn)) : "belum pernah masuk";
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-body">
        <dt className="text-ink-muted">Username</dt><dd className="font-semibold text-ink">@{account.username}</dd>
        <dt className="text-ink-muted">Peran</dt><dd className="text-ink">{ROLE_LABELS[account.role] ?? account.role}</dd>
        <dt className="text-ink-muted">Status</dt><dd className="text-ink">{account.accountStatus === "ACTIVE" ? "Aktif" : "Nonaktif"}{account.mustChangePassword ? " · wajib ganti kata sandi" : ""}</dd>
        <dt className="text-ink-muted">Terakhir masuk</dt><dd className="text-ink">{lastSignedIn}</dd>
      </dl>
      {!isWorkforceAccount(account) ? (
        <p className="rounded-md border-[1.5px] border-line bg-surface-sunken px-2 py-1 text-label text-ink-muted">Akun tata kelola (Controller dan Pemegang Saham) dilindungi dan tidak dapat diubah dari layar ini.</p>
      ) : (
        <>
          <div className="grid gap-1">
            <Label htmlFor={`role-${account.id}`}>Ubah peran</Label>
            <select id={`role-${account.id}`} className={`h-control px-2 text-body text-ink ${QUIET_FIELD}`} value={account.role} onChange={(event) => onRoleChange(event.target.value as "ADMIN" | "STAFF")}>
              <option value="STAFF">Staf</option>
              <option value="ADMIN">Admin</option>
            </select>
            <p className="text-label text-ink-subtle">Mengubah peran langsung mengeluarkan seluruh sesi akun ini.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className={OUTLINE_BUTTON} onClick={onResetPassword}>Reset kata sandi</Button>
            {account.accountStatus === "ACTIVE" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" className={`${OUTLINE_BUTTON} text-danger`}>Nonaktifkan</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Nonaktifkan {name}?</AlertDialogTitle>
                    <AlertDialogDescription>Akun ini tidak dapat masuk lagi dan seluruh sesinya — termasuk di perangkat lain — langsung dicabut. Dapat diaktifkan kembali kapan saja.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction className="bg-danger text-paper hover:bg-danger" onClick={onSuspend}>Ya, nonaktifkan</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <Button variant="outline" className={OUTLINE_BUTTON} onClick={onActivate}>Aktifkan lagi</Button>}
          </div>
        </>
      )}
    </div>
  );
}
```

Run: `./node_modules/.bin/vitest run client/src/pages/users`
Expected: PASS, 2 + 2 + 2 uji.

- [ ] **Step 3: Tulis ulang `client/src/pages/UserManagement.tsx`**

```tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { DataTable, type Column } from "@/components/patterns/DataTable";
import { FormSection } from "@/components/patterns/FormSection";
import { ListDetailLayout } from "@/components/patterns/ListDetailLayout";
import { PageHeader } from "@/components/patterns/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/PageStates";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { ROLE_LABELS, accountDisplayName, type InternalAccount } from "./users/accounts";
import { CreateUserForm } from "./users/CreateUserForm";
import { ResetPasswordDialog } from "./users/ResetPasswordDialog";
import { UserDetail } from "./users/UserDetail";

const columns: Column<InternalAccount>[] = [
  { key: "nama", header: "Nama", cell: (account) => accountDisplayName(account) },
  { key: "username", header: "Username", cell: (account) => `@${account.username}` },
  { key: "peran", header: "Peran", cell: (account) => ROLE_LABELS[account.role] ?? account.role },
  { key: "status", header: "Status", cell: (account) => (account.accountStatus === "ACTIVE" ? "Aktif" : "Nonaktif") },
];

export default function UserManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const accounts = trpc.users.list.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const refresh = () => utils.users.list.invalidate();
  const create = trpc.users.create.useMutation({ onSuccess: () => { toast.success("Akun dibuat. Pengguna wajib mengganti kata sandi saat pertama masuk."); void refresh(); }, onError: (error) => toast.error(error.message) });
  const setRole = trpc.users.setRole.useMutation({ onSuccess: () => { toast.success("Peran diubah dan sesi akun dicabut."); void refresh(); }, onError: (error) => toast.error(error.message) });
  const setStatus = trpc.users.setStatus.useMutation({ onSuccess: () => { toast.success("Status akun diubah dan sesinya dicabut."); void refresh(); }, onError: (error) => toast.error(error.message) });
  const resetPassword = trpc.users.resetPassword.useMutation({ onSuccess: () => { setResetOpen(false); toast.success("Kata sandi direset. Pengguna wajib menggantinya saat masuk."); void refresh(); }, onError: (error) => toast.error(error.message) });
  const selected = accounts.data?.find((account) => account.id === selectedId) ?? null;
  const requestedRole = new URLSearchParams(window.location.search).get("role");
  const initialRole = requestedRole === "ADMIN" ? "ADMIN" : "STAFF";

  const list = accounts.isLoading ? <LoadingState label="Memuat akun…" />
    : accounts.isError ? <ErrorState what="Daftar akun tidak dapat dimuat." nextStep="Periksa sambungan, lalu coba lagi." onRetry={() => accounts.refetch()} />
    : !accounts.data?.length ? <EmptyState title="Belum ada akun lain" nextStep="Buat akun Staf atau Admin pertama dengan formulir di bawah." />
    : <DataTable caption="Akun internal" columns={columns} rows={accounts.data} rowKey={(account) => String(account.id)} selectedKey={selectedId === null ? null : String(selectedId)} onSelect={(account) => setSelectedId(account.id)} />;

  return (
    <div>
      <PageHeader title="Siapa saja yang boleh masuk?" description="Buat akun, atur peran, nonaktifkan, atau reset kata sandi. Setiap perubahan langsung mencabut sesi akun yang dituju." />
      <ListDetailLayout
        list={list}
        detailTitle={selected ? accountDisplayName(selected) : undefined}
        onCloseDetail={() => setSelectedId(null)}
        detail={selected ? (
          <UserDetail
            account={selected}
            onRoleChange={(role) => setRole.mutate({ userId: selected.id, role })}
            onSuspend={() => setStatus.mutate({ userId: selected.id, accountStatus: "SUSPENDED" })}
            onActivate={() => setStatus.mutate({ userId: selected.id, accountStatus: "ACTIVE" })}
            onResetPassword={() => setResetOpen(true)}
          />
        ) : undefined}
      />
      <FormSection number={1} title="Buat akun baru" description="Pemegang Saham dapat membuat Controller; Controller dapat membuat Admin dan Staf.">
        <CreateUserForm isShareholder={user?.role === "SHAREHOLDER"} initialRole={initialRole} isPending={create.isPending} onSubmit={(values) => create.mutate(values)} />
      </FormSection>
      {selected ? <ResetPasswordDialog accountName={accountDisplayName(selected)} open={resetOpen} onOpenChange={setResetOpen} isPending={resetPassword.isPending} onConfirm={(newPassword) => resetPassword.mutate({ userId: selected.id, newPassword })} /> : null}
    </div>
  );
}
```

Prosedur `users.*` di server **tidak diubah**. Parameter `?role=ADMIN|STAFF` tetap dihormati karena pintasan "Buat akun Admin/Staff" di `client/src/pages/OperationsDashboard.tsx:162` memakainya.

Tambahkan ke `FOUNDATION_FILES`:

```ts
  "client/src/pages/users/accounts.ts",
  "client/src/pages/users/CreateUserForm.tsx",
  "client/src/pages/users/ResetPasswordDialog.tsx",
  "client/src/pages/users/UserDetail.tsx",
  "client/src/pages/UserManagement.tsx",
```

- [ ] **Step 4: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 210 passed`, `Tests 1687 passed | 2 skipped`** (+3 berkas, +6 uji).

- [ ] **Step 5: Periksa di peramban**

**Minta pengguna masuk sendiri** sebagai Controller atau Pemegang Saham di `moneychanger` (Claude tidak mengetik kata sandi akun pengembangan), lalu buka `/operasional/pengguna` pada 1280/1440/1920: tabel akun, memilih baris membuka panel detail, `Esc` menutupnya, dialog reset menyebut nama akun, akun Controller menampilkan catatan "dilindungi". Buat satu akun Staf uji `uji.sp2.staf` (data uji lokal diizinkan) dan reset kata sandinya lewat dialog.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/users client/src/pages/UserManagement.tsx client/src/designFoundation.ts
git commit -m "Pengguna & peran: daftar + panel detail, reset lewat dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Tugas 13: Profil Perusahaan — Tampilan dan Halaman publik; tema dipasang shell

**Files:**
- Create: `client/src/pages/company/AppearanceSection.tsx`, `client/src/pages/company/FaqEditor.tsx`, `client/src/pages/company/PublicPageSection.tsx`
- Modify: `client/src/pages/CompanyProfile.tsx` — impor, dua mutasi (±baris 62), dan dua bagian tepat **sebelum** kartu Logo (`<CardTitle …>Logo</CardTitle>`, ±baris 228)
- Modify: `client/src/components/DashboardLayout.tsx:34` (pasang tema dari profil)
- Modify: `client/src/designFoundation.ts`
- Test: `client/src/pages/company/AppearanceSection.test.tsx`, `client/src/pages/company/FaqEditor.test.tsx`, `client/src/pages/company/PublicPageSection.test.tsx`

**Interfaces:**
- Consumes: `checkAppearance` (Tugas 7), `normalizePublicPage`, `PUBLIC_FAQ_LIMIT`, `DEFAULT_PUBLIC_FAQ`, `DEFAULT_FRAUD_WARNING`, `PublicFaqItem`, `PublicPageInput` (Tugas 7); `companyProfile.updateAppearance`/`updatePublicPage` (Tugas 7); `useCompanyTheme` (Tugas 9); `applyTheme`, `THEME_PALETTES`.
- Produces:
  - `AppearanceSection({ initialPalette, initialAccent, isPending, onSave })` → `onSave({ themePalette, accentColor })`
  - `FaqEditor({ items, onChange })`
  - `PublicPageSection({ initial, isPending, onSave })` → `onSave(PublicPageInput)` dengan nilai yang sudah dinormalkan

- [ ] **Step 1: Tulis uji yang gagal**

`client/src/pages/company/AppearanceSection.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppearanceSection } from "./AppearanceSection";

describe("bagian Tampilan", () => {
  it("menawarkan keenam palet", () => {
    render(<AppearanceSection initialPalette="MARUN" initialAccent={null} isPending={false} onSave={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("radio", { name: "Marun" }).getAttribute("aria-checked")).toBe("true");
  });

  it("warna sendiri yang kurang kontras disebut rasionya dan tidak dapat disimpan", async () => {
    render(<AppearanceSection initialPalette="MARUN" initialAccent={null} isPending={false} onSave={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Warna utama sendiri"), "#777777");
    expect(screen.getByText(/4,48:1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan tampilan" }).hasAttribute("disabled")).toBe(true);
  });

  it("memilih palet lalu menyimpan mengirim palet itu tanpa warna sendiri", async () => {
    const onSave = vi.fn();
    render(<AppearanceSection initialPalette="MARUN" initialAccent={null} isPending={false} onSave={onSave} />);
    await userEvent.click(screen.getByRole("radio", { name: "Zamrud" }));
    await userEvent.click(screen.getByRole("button", { name: "Simpan tampilan" }));
    expect(onSave).toHaveBeenCalledWith({ themePalette: "ZAMRUD", accentColor: null });
  });
});
```

`client/src/pages/company/FaqEditor.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { PublicFaqItem } from "@shared/publicPage";
import { FaqEditor } from "./FaqEditor";

function Harness({ initial }: { initial: PublicFaqItem[] }) {
  const [items, setItems] = useState(initial);
  return <FaqEditor items={items} onChange={setItems} />;
}

describe("penyunting FAQ", () => {
  it("menambah pasangan tanya-jawab kosong", async () => {
    render(<Harness initial={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Tambah pertanyaan" }));
    expect(screen.getByLabelText("Pertanyaan 1")).toBeTruthy();
    expect(screen.getByLabelText("Jawaban 1")).toBeTruthy();
  });

  it("berhenti menambah pada 12 pertanyaan", () => {
    render(<Harness initial={Array.from({ length: 12 }, (_, index) => ({ question: `Q${index}`, answer: "A" }))} />);
    expect(screen.getByRole("button", { name: "Tambah pertanyaan" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Batas 12 pertanyaan/)).toBeTruthy();
  });

  it("menurunkan pertanyaan menukar urutannya", async () => {
    render(<Harness initial={[{ question: "Satu", answer: "A" }, { question: "Dua", answer: "B" }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Turunkan pertanyaan 1" }));
    expect((screen.getByLabelText("Pertanyaan 1") as HTMLInputElement).value).toBe("Dua");
  });
});
```

`client/src/pages/company/PublicPageSection.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PublicPageSection } from "./PublicPageSection";

const initial = { publicPageEnabled: true, secondaryPhone: null, openingHours: null, mapUrl: null, publicFaq: null, fraudWarning: null };

describe("bagian Halaman publik", () => {
  it("mematikan halaman publik menjelaskan akibatnya", async () => {
    render(<PublicPageSection initial={initial} isPending={false} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole("switch", { name: "Tampilkan halaman kurs publik" }));
    expect(screen.getByText(/langsung membuka halaman masuk staf/)).toBeTruthy();
  });

  it("tautan peta http ditolak dengan alasannya; yang https dikirim", async () => {
    const onSave = vi.fn();
    render(<PublicPageSection initial={initial} isPending={false} onSave={onSave} />);
    const map = screen.getByLabelText("Tautan peta");
    await userEvent.type(map, "http://maps.example/abc");
    expect(screen.getByText(/harus diawali https:\/\//)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan halaman publik" }).hasAttribute("disabled")).toBe(true);
    await userEvent.clear(map);
    await userEvent.type(map, "https://maps.app.goo.gl/abc");
    await userEvent.click(screen.getByRole("button", { name: "Simpan halaman publik" }));
    expect(onSave).toHaveBeenCalledWith({ publicPageEnabled: true, secondaryPhone: null, openingHours: null, mapUrl: "https://maps.app.goo.gl/abc", publicFaq: [], fraudWarning: null });
  });
});
```

Run: `./node_modules/.bin/vitest run client/src/pages/company`
Expected: FAIL — modul belum ada.

- [ ] **Step 2: `AppearanceSection`**

```tsx
import { StatTile } from "@/components/patterns/StatTile";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyTheme } from "@/lib/brandAccent";
import { checkAppearance } from "@shared/companyAppearance";
import { THEME_PALETTES } from "@shared/themePalettes";
import { useEffect, useRef, useState } from "react";

/** Contoh warna satu palet — `applyTheme` pada wadahnya sendiri, supaya berkas ini tidak memuat heks. */
function PaletteSwatch({ paletteId }: { paletteId: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (ref.current) applyTheme(ref.current, paletteId); }, [paletteId]);
  return (
    <span ref={ref} aria-hidden className="flex overflow-hidden rounded-md border-2 border-ink">
      <span className="size-4 bg-paper" /><span className="size-4 bg-brand" /><span className="size-4 bg-second" />
    </span>
  );
}

export function AppearanceSection({ initialPalette, initialAccent, isPending, onSave }: {
  initialPalette: string;
  initialAccent: string | null;
  isPending: boolean;
  onSave: (values: { themePalette: string; accentColor: string | null }) => void;
}) {
  const [palette, setPalette] = useState(initialPalette);
  const [accent, setAccent] = useState(initialAccent ?? "");
  const preview = useRef<HTMLDivElement>(null);
  const result = checkAppearance({ themePalette: palette, accentColor: accent });
  const previewAccent = result.ok ? result.values.accentColor : null;
  useEffect(() => { if (preview.current) applyTheme(preview.current, palette, previewAccent); }, [palette, previewAccent]);

  return (
    <section aria-labelledby="bagian-tampilan" className="rounded-[0.75rem] border-2 border-ink bg-surface-raised p-4">
      <h2 id="bagian-tampilan" className="font-heading text-body font-extrabold text-ink">Tampilan</h2>
      <p className="mt-0.5 text-label text-ink-muted">Dipakai seluruh aplikasi, halaman masuk, dan halaman kurs publik.</p>
      <div role="radiogroup" aria-label="Palet" className="mt-3 flex flex-wrap gap-2">
        {THEME_PALETTES.map((option) => (
          <button key={option.id} type="button" role="radio" aria-checked={option.id === palette} onClick={() => setPalette(option.id)} className={`inline-flex items-center gap-2 ${option.id === palette ? BOLD_BUTTON : OUTLINE_BUTTON}`}>
            <PaletteSwatch paletteId={option.id} />
            {option.name}
          </button>
        ))}
      </div>
      <div className="mt-3 grid max-w-sm gap-1">
        <Label htmlFor="accent-color">Warna utama sendiri</Label>
        <Input id="accent-color" placeholder="Kosongkan untuk memakai warna palet" className={`${QUIET_FIELD} font-mono uppercase`} value={accent} onChange={(event) => setAccent(event.target.value)} />
        {result.ok
          ? <p className="text-label text-ink-subtle">Opsional. Hanya warna yang cukup kontras dengan teks di atasnya (minimal 4,5:1) yang dapat disimpan.</p>
          : <p className="text-label text-danger">{result.error}</p>}
      </div>
      <div ref={preview} data-testid="pratinjau-tampilan" className="mt-3 grid gap-3 rounded-[0.75rem] border-2 border-ink bg-paper p-3 sm:grid-cols-[1fr_auto]">
        <StatTile label="Bon hari ini" value="12" tone="brand" />
        <div className="flex items-end"><Button type="button" className={BOLD_BUTTON} tabIndex={-1}>+ Bon baru</Button></div>
      </div>
      <Button type="button" className={`mt-3 ${BOLD_BUTTON}`} disabled={!result.ok || isPending} onClick={() => { if (result.ok) onSave(result.values); }}>
        {isPending ? "Menyimpan…" : "Simpan tampilan"}
      </Button>
    </section>
  );
}
```

- [ ] **Step 3: `FaqEditor`**

```tsx
import { OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PUBLIC_FAQ, PUBLIC_FAQ_LIMIT, type PublicFaqItem } from "@shared/publicPage";

export function FaqEditor({ items, onChange }: { items: PublicFaqItem[]; onChange: (items: PublicFaqItem[]) => void }) {
  const update = (index: number, patch: Partial<PublicFaqItem>) => onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const atLimit = items.length >= PUBLIC_FAQ_LIMIT;

  return (
    <div className="grid gap-2">
      {items.length === 0 ? <p className="text-label text-ink-subtle">Belum ada pertanyaan sendiri — halaman publik memakai {DEFAULT_PUBLIC_FAQ.length} pertanyaan umum bawaan.</p> : null}
      <ol className="grid gap-2">
        {items.map((item, index) => (
          <li key={index} className="grid gap-1 rounded-lg border-[1.5px] border-line bg-surface-raised p-2">
            <Label htmlFor={`faq-question-${index}`}>Pertanyaan {index + 1}</Label>
            <Input id={`faq-question-${index}`} maxLength={200} className={QUIET_FIELD} value={item.question} onChange={(event) => update(index, { question: event.target.value })} />
            <Label htmlFor={`faq-answer-${index}`}>Jawaban {index + 1}</Label>
            <Textarea id={`faq-answer-${index}`} maxLength={1000} rows={2} className={QUIET_FIELD} value={item.answer} onChange={(event) => update(index, { answer: event.target.value })} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className={`${OUTLINE_BUTTON} h-control-sm`} aria-label={`Naikkan pertanyaan ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>Naik</Button>
              <Button type="button" size="sm" variant="outline" className={`${OUTLINE_BUTTON} h-control-sm`} aria-label={`Turunkan pertanyaan ${index + 1}`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>Turun</Button>
              <Button type="button" size="sm" variant="outline" className={`${OUTLINE_BUTTON} h-control-sm text-danger`} aria-label={`Hapus pertanyaan ${index + 1}`} onClick={() => onChange(items.filter((_, position) => position !== index))}>Hapus</Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" className={OUTLINE_BUTTON} disabled={atLimit} onClick={() => onChange([...items, { question: "", answer: "" }])}>Tambah pertanyaan</Button>
        {atLimit ? <p className="text-label text-ink-subtle">Batas {PUBLIC_FAQ_LIMIT} pertanyaan tercapai.</p> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `PublicPageSection`**

```tsx
import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_FRAUD_WARNING, normalizePublicPage, type PublicFaqItem, type PublicPageInput } from "@shared/publicPage";
import { useState } from "react";
import { FaqEditor } from "./FaqEditor";

type Initial = {
  publicPageEnabled: boolean;
  secondaryPhone: string | null;
  openingHours: string | null;
  mapUrl: string | null;
  publicFaq: PublicFaqItem[] | null;
  fraudWarning: string | null;
};

export function PublicPageSection({ initial, isPending, onSave }: { initial: Initial; isPending: boolean; onSave: (values: PublicPageInput) => void }) {
  const [enabled, setEnabled] = useState(initial.publicPageEnabled);
  const [secondaryPhone, setSecondaryPhone] = useState(initial.secondaryPhone ?? "");
  const [openingHours, setOpeningHours] = useState(initial.openingHours ?? "");
  const [mapUrl, setMapUrl] = useState(initial.mapUrl ?? "");
  const [faq, setFaq] = useState<PublicFaqItem[]>(initial.publicFaq ?? []);
  const [fraudWarning, setFraudWarning] = useState(initial.fraudWarning ?? "");
  const result = normalizePublicPage({ publicPageEnabled: enabled, secondaryPhone, openingHours, mapUrl, publicFaq: faq, fraudWarning });

  return (
    <section aria-labelledby="bagian-halaman-publik" className="rounded-[0.75rem] border-2 border-ink bg-surface-raised p-4">
      <h2 id="bagian-halaman-publik" className="font-heading text-body font-extrabold text-ink">Halaman publik</h2>
      <p className="mt-0.5 text-label text-ink-muted">Halaman kurs di alamat utama aplikasi. Alamat dan telepon utama diambil dari Data badan usaha di atas; bagian yang kosong tidak ditampilkan.</p>
      <div className="mt-3 flex items-center gap-2">
        <Switch id="public-page-enabled" checked={enabled} onCheckedChange={setEnabled} />
        <Label htmlFor="public-page-enabled">Tampilkan halaman kurs publik</Label>
      </div>
      {!enabled ? <p className="mt-1 text-label text-ink-muted">Selama mati, alamat / langsung membuka halaman masuk staf.</p> : null}
      <div className="mt-3 grid max-w-2xl gap-3">
        <div className="grid gap-1">
          <Label htmlFor="secondary-phone">Telepon kedua</Label>
          <Input id="secondary-phone" className={QUIET_FIELD} value={secondaryPhone} onChange={(event) => setSecondaryPhone(event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="opening-hours">Jam buka</Label>
          <Input id="opening-hours" placeholder="Mis. Senin–Sabtu 08.00–17.00" className={QUIET_FIELD} value={openingHours} onChange={(event) => setOpeningHours(event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="map-url">Tautan peta</Label>
          <Input id="map-url" placeholder="https://maps.app.goo.gl/…" className={QUIET_FIELD} value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="fraud-warning">Peringatan penipuan</Label>
          <Textarea id="fraud-warning" rows={2} placeholder={DEFAULT_FRAUD_WARNING} className={QUIET_FIELD} value={fraudWarning} onChange={(event) => setFraudWarning(event.target.value)} />
          <p className="text-label text-ink-subtle">Kosongkan untuk memakai kalimat bawaan di atas.</p>
        </div>
        <div className="grid gap-1">
          <p className="text-body font-bold text-ink">Pertanyaan umum</p>
          <FaqEditor items={faq} onChange={setFaq} />
        </div>
        {!result.ok ? <p role="alert" className="text-label text-danger">{result.error}</p> : null}
        <Button type="button" className={BOLD_BUTTON} disabled={!result.ok || isPending} onClick={() => { if (result.ok) onSave({ ...result.values, publicFaq: result.values.publicFaq ?? [] }); }}>
          {isPending ? "Menyimpan…" : "Simpan halaman publik"}
        </Button>
      </div>
    </section>
  );
}
```

Run: `./node_modules/.bin/vitest run client/src/pages/company`
Expected: PASS, 3 + 3 + 2 uji.

- [ ] **Step 5: Rangkai di `CompanyProfile.tsx` dan pasang tema di shell**

Di `client/src/pages/CompanyProfile.tsx`, tambah impor:

```tsx
import { AppearanceSection } from "./company/AppearanceSection";
import { PublicPageSection } from "./company/PublicPageSection";
```

Tambah dua mutasi di bawah mutasi `update` yang ada:

```tsx
  const refreshPresentation = () => { void utils.companyProfile.get.invalidate(); void utils.publicContent.profile.invalidate(); };
  const updateAppearance = trpc.companyProfile.updateAppearance.useMutation({
    onSuccess: () => { toast.success("Tampilan disimpan."); refreshPresentation(); },
    onError: (error) => toast.error(error.message),
  });
  const updatePublicPage = trpc.companyProfile.updatePublicPage.useMutation({
    onSuccess: () => { toast.success("Halaman publik disimpan."); refreshPresentation(); },
    onError: (error) => toast.error(error.message),
  });
```

Sisipkan tepat sebelum kartu Logo:

```tsx
    {profile ? (
      <>
        <AppearanceSection key={`${profile.themePalette}:${profile.accentColor ?? ""}`} initialPalette={profile.themePalette} initialAccent={profile.accentColor} isPending={updateAppearance.isPending} onSave={(values) => updateAppearance.mutate(values)} />
        <PublicPageSection key={String(profile.updatedAt)} initial={profile} isPending={updatePublicPage.isPending} onSave={(values) => updatePublicPage.mutate(values)} />
      </>
    ) : (
      <p className="rounded-md border border-dashed px-3 py-2 text-sm">Simpan Data badan usaha lebih dulu; Tampilan dan Halaman publik disimpan pada profil yang sama.</p>
    )}
```

`CompanyProfile.tsx` sendiri **tetap layar lama** (sub-proyek 9) dan tidak masuk `FOUNDATION_FILES`.

Di `client/src/components/DashboardLayout.tsx`, tambah impor `import { useCompanyTheme } from "@/lib/useCompanyTheme";` dan tepat di bawah baris `const profile = trpc.companyProfile.get.useQuery(…)`:

```tsx
  useCompanyTheme(profile.data);
```

Tambahkan ke `FOUNDATION_FILES`:

```ts
  "client/src/pages/company/AppearanceSection.tsx",
  "client/src/pages/company/FaqEditor.tsx",
  "client/src/pages/company/PublicPageSection.tsx",
```

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 213 passed`, `Tests 1695 passed | 2 skipped`** (+3 berkas, +8 uji).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/company client/src/pages/CompanyProfile.tsx client/src/components/DashboardLayout.tsx client/src/designFoundation.ts
git commit -m "Profil Perusahaan: pemilih palet, warna utama sendiri, dan isian halaman publik

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 14: Halaman depan publik

**Files:**
- Create: `client/src/pages/home/PublicRateTable.tsx`, `client/src/pages/home/PublicSections.tsx`
- Modify (tulis ulang): `client/src/pages/Home.tsx`
- Modify: `client/src/designFoundation.ts`
- Test: `client/src/pages/home/PublicRateTable.test.tsx`, `client/src/pages/home/PublicSections.test.tsx`

**Interfaces:**
- Consumes: `usePublicProfile` (Tugas 9); `rates.activeRates` → `PublicRateRow[]`, `sortPublicRates`, `latestPublicRateEffectiveAt` (`shared/publicRates.ts`); `OTHER_TIER_LABEL` (`shared/rateTiers.ts`); `publicFaqOrDefault`, `fraudWarningOrDefault`, `hasContactSection`, `telHref` (Tugas 7); `formatIdrDecimal` (`client/src/lib/money.ts`); `PublicServicePlanner` (tetap); `LoadingState`, `EmptyState`, `ErrorState`.
- Produces: `PublicRateTable({ rates, isLoading, isError, onRetry })`, `PublicContactSection({ profile })`, `PublicFaqSection({ faq })`, `FraudNotice({ text })`, `AnnouncementsSection({ items })`.

- [ ] **Step 1: Tulis uji yang gagal**

`client/src/pages/home/PublicRateTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicRateTable } from "./PublicRateTable";

describe("tabel kurs publik", () => {
  it("baris tingkat valuta berlabel Pecahan lain dengan harga berformat Rupiah", () => {
    render(<PublicRateTable isLoading={false} isError={false} onRetry={vi.fn()} rates={[{ rate: { id: 1, buyRate: "16200.000000", sellRate: "16290.000000", quoteUnit: "1", effectiveAt: new Date("2026-09-26T01:00:00Z") }, currency: { id: 1, code: "USD", name: "Dolar Amerika" }, tier: null }]} />);
    const row = screen.getByRole("row", { name: /USD/ });
    expect(row.textContent).toContain("Pecahan lain");
    expect(row.textContent).toContain("16.290");
  });
});
```

`client/src/pages/home/PublicSections.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_FRAUD_WARNING, DEFAULT_PUBLIC_FAQ } from "@shared/publicPage";
import { FraudNotice, PublicContactSection, PublicFaqSection } from "./PublicSections";

describe("bagian halaman publik", () => {
  it("bagian kontak tidak dirender sama sekali bila kosong", () => {
    const { container } = render(<PublicContactSection profile={{ address: null, phone: " ", secondaryPhone: null, openingHours: null, mapUrl: null }} />);
    expect(container.firstChild).toBeNull();
  });

  it("nomor telepon menjadi tautan panggilan", () => {
    render(<PublicContactSection profile={{ address: null, phone: "+62 263-265500", secondaryPhone: null, openingHours: null, mapUrl: null }} />);
    expect(screen.getByRole("link", { name: "+62 263-265500" }).getAttribute("href")).toBe("tel:+62263265500");
  });

  it("FAQ kosong memakai pertanyaan umum bawaan", () => {
    render(<PublicFaqSection faq={null} />);
    expect(screen.getByText(DEFAULT_PUBLIC_FAQ[0].question)).toBeTruthy();
  });

  it("peringatan penipuan kosong memakai kalimat bawaan", () => {
    render(<FraudNotice text={null} />);
    expect(screen.getByText(DEFAULT_FRAUD_WARNING)).toBeTruthy();
  });
});
```

Run: `./node_modules/.bin/vitest run client/src/pages/home`
Expected: FAIL — modul belum ada.

- [ ] **Step 2: `PublicRateTable`**

```tsx
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/PageStates";
import { formatIdrDecimal } from "@/lib/money";
import { sortPublicRates, type PublicRateRow } from "@shared/publicRates";
import { OTHER_TIER_LABEL } from "@shared/rateTiers";

const effectiveFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function PublicRateTable({ rates, isLoading, isError, onRetry }: { rates: PublicRateRow[]; isLoading: boolean; isError: boolean; onRetry: () => void }) {
  if (isLoading) return <LoadingState rows={5} label="Memuat kurs…" />;
  if (isError) return <ErrorState what="Kurs belum dapat dimuat." nextStep="Tidak ada harga yang ditampilkan sebagai pengganti. Coba lagi sebentar lagi." onRetry={onRetry} />;
  if (!rates.length) return <EmptyState title="Belum ada kurs aktif" nextStep="Kurs hari ini sedang disiapkan. Hubungi outlet untuk memastikan kebutuhan valuta Anda." />;
  return (
    <div className="overflow-x-auto rounded-[0.75rem] border-2 border-ink bg-surface-raised">
      <table className="w-full min-w-[36rem] text-body">
        <caption className="sr-only">Kurs operasional aktif</caption>
        <thead className="border-b-2 border-ink bg-surface-sunken text-label font-extrabold uppercase tracking-wider text-ink-subtle">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">Mata uang</th>
            <th scope="col" className="px-3 py-2 text-right">Kami beli</th>
            <th scope="col" className="px-3 py-2 text-right">Kami jual</th>
            <th scope="col" className="px-3 py-2 text-right">Per</th>
            <th scope="col" className="px-3 py-2 text-left">Berlaku</th>
          </tr>
        </thead>
        <tbody>
          {sortPublicRates(rates).map(({ rate, currency, tier }) => (
            <tr key={rate.id} className="h-row border-b border-line last:border-b-0">
              <th scope="row" className="px-3 py-1.5 text-left font-normal">
                <span className="font-bold text-ink">{currency.code}</span> <span className="text-ink-muted">{currency.name}</span>
                <span className="block text-label text-ink-subtle">{tier ? tier.label : OTHER_TIER_LABEL}</span>
              </th>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{formatIdrDecimal(rate.buyRate)}</td>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{formatIdrDecimal(rate.sellRate)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-ink-muted">{rate.quoteUnit}</td>
              <td className="px-3 py-1.5 text-label text-ink-muted">{effectiveFormat.format(new Date(rate.effectiveAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: `PublicSections`**

```tsx
import { OUTLINE_BUTTON } from "@/components/patterns/tebal";
import { fraudWarningOrDefault, hasContactSection, publicFaqOrDefault, telHref, type PublicFaqItem } from "@shared/publicPage";

type ContactProfile = { address?: string | null; phone?: string | null; secondaryPhone?: string | null; openingHours?: string | null; mapUrl?: string | null };

export function PublicContactSection({ profile }: { profile: ContactProfile }) {
  if (!hasContactSection(profile)) return null;
  const phones = [profile.phone, profile.secondaryPhone].map((phone) => phone?.trim()).filter(Boolean) as string[];
  return (
    <section aria-labelledby="kontak" className="rounded-[0.75rem] border-2 border-ink bg-surface-raised p-4 shadow-tile">
      <h2 id="kontak" className="font-heading text-body font-extrabold text-ink">Hubungi dan kunjungi kami</h2>
      <dl className="mt-2 grid gap-2 text-body sm:grid-cols-[9rem_1fr]">
        {profile.address?.trim() ? <><dt className="text-ink-muted">Alamat</dt><dd className="whitespace-pre-line text-ink">{profile.address}</dd></> : null}
        {phones.length ? <><dt className="text-ink-muted">Telepon</dt><dd className="flex flex-wrap gap-x-3">{phones.map((phone) => <a key={phone} href={telHref(phone)} className="font-semibold text-ink underline underline-offset-4">{phone}</a>)}</dd></> : null}
        {profile.openingHours?.trim() ? <><dt className="text-ink-muted">Jam buka</dt><dd className="text-ink">{profile.openingHours}</dd></> : null}
      </dl>
      {profile.mapUrl ? <a href={profile.mapUrl} target="_blank" rel="noreferrer" className={`mt-3 inline-flex items-center ${OUTLINE_BUTTON}`}>Buka peta</a> : null}
    </section>
  );
}

export function FraudNotice({ text }: { text: string | null | undefined }) {
  return <p role="note" className="rounded-lg border-2 border-ink bg-warning-soft px-3 py-2 text-body font-semibold text-ink">{fraudWarningOrDefault(text)}</p>;
}

export function PublicFaqSection({ faq }: { faq: readonly PublicFaqItem[] | null | undefined }) {
  return (
    <section aria-labelledby="faq">
      <h2 id="faq" className="font-heading text-body font-extrabold text-ink">Pertanyaan umum</h2>
      <div className="mt-2 grid gap-2">
        {publicFaqOrDefault(faq).map((item) => (
          <details key={item.question} className="rounded-lg border-[1.5px] border-line bg-surface-raised px-3 py-2">
            <summary className="cursor-pointer text-body font-semibold text-ink">{item.question}</summary>
            <p className="mt-1 text-body text-ink-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function AnnouncementsSection({ items }: { items: { id: number; title: string; content: string }[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="pengumuman">
      <h2 id="pengumuman" className="font-heading text-body font-extrabold text-ink">Pengumuman</h2>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-lg border-[1.5px] border-line bg-surface-raised p-3">
            <h3 className="text-body font-bold text-ink">{item.title}</h3>
            <p className="mt-1 whitespace-pre-line text-body text-ink-muted">{item.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

Run: `./node_modules/.bin/vitest run client/src/pages/home`
Expected: PASS, 1 + 4 uji.

- [ ] **Step 4: Tulis ulang `client/src/pages/Home.tsx`**

```tsx
import { PublicServicePlanner } from "@/components/PublicServicePlanner";
import { OUTLINE_BUTTON } from "@/components/patterns/tebal";
import { brandInitials, brandName } from "@/components/shell/brand";
import { usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { latestPublicRateEffectiveAt, sortPublicRates } from "@shared/publicRates";
import { useEffect, useMemo } from "react";
import { PublicRateTable } from "./home/PublicRateTable";
import { AnnouncementsSection, FraudNotice, PublicContactSection, PublicFaqSection } from "./home/PublicSections";

const updatedFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

/**
 * Halaman kurs publik. Tidak ada nama, telepon, alamat, maupun FAQ yang ditulis mati: semuanya dari
 * Profil Perusahaan lewat `publicContent.profile`, bagian kosong disembunyikan (spec 2026-09-26 §4).
 */
export default function Home() {
  const profile = usePublicProfile();
  const rates = trpc.rates.activeRates.useQuery();
  const announcements = trpc.publicContent.announcements.useQuery();
  const sorted = useMemo(() => sortPublicRates(rates.data ?? []), [rates.data]);
  const latest = useMemo(() => latestPublicRateEffectiveAt(sorted), [sorted]);
  const data = profile.data;

  useEffect(() => {
    if (!data) return;
    if (data.setupRequired) window.location.assign("/siapkan");
    else if (!data.publicPageEnabled) window.location.assign("/login");
  }, [data]);

  if (profile.isLoading || data?.setupRequired || data?.publicPageEnabled === false) return <main aria-busy="true" className="min-h-screen bg-paper" />;
  const brand = brandName({ tradingName: data?.tradingName });

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b-2 border-ink bg-surface-raised">
        <div className="mx-auto flex h-header max-w-5xl items-center justify-between gap-3 px-gutter">
          <span className="flex min-w-0 items-center gap-2">
            {data?.logoUrl
              ? <img src={data.logoUrl} alt="" className="size-8 rounded-lg border-2 border-ink bg-surface-raised object-contain" />
              : <span aria-hidden className="flex size-8 items-center justify-center rounded-lg border-2 border-ink bg-brand font-heading text-label font-extrabold text-brand-contrast shadow-hard">{brandInitials(brand)}</span>}
            <span className="truncate font-heading text-body font-extrabold">{brand}</span>
          </span>
          <a href="/login" className={`inline-flex shrink-0 items-center ${OUTLINE_BUTTON}`}>Masuk staf</a>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 px-gutter py-6">
        <section aria-labelledby="kurs-hari-ini">
          <h1 id="kurs-hari-ini" className="font-heading text-title font-extrabold tracking-tight">Kurs {brand} hari ini</h1>
          <p className="mt-1 text-body text-ink-muted">{latest ? `Diperbarui ${updatedFormat.format(latest)} WIB. ` : ""}Kurs bersifat indikatif; petugas mengonfirmasi harga dan ketersediaan sebelum transaksi.</p>
          <div className="mt-3"><PublicRateTable rates={rates.data ?? []} isLoading={rates.isLoading} isError={rates.isError} onRetry={() => rates.refetch()} /></div>
        </section>
        {sorted.length ? (
          <section aria-labelledby="rencana">
            <h2 id="rencana" className="font-heading text-body font-extrabold">Rencanakan kunjungan Anda</h2>
            <p className="mt-0.5 text-body text-ink-muted">Perkirakan kebutuhan Anda, lalu minta konfirmasi. Ini bukan pemesanan maupun transaksi.</p>
            <div className="mt-2"><PublicServicePlanner rates={sorted} /></div>
          </section>
        ) : null}
        <AnnouncementsSection items={announcements.data ?? []} />
        <PublicContactSection profile={data ?? {}} />
        <FraudNotice text={data?.fraudWarning} />
        <PublicFaqSection faq={data?.publicFaq} />
      </main>
      <footer className="border-t-2 border-ink px-gutter py-4 text-center text-label text-ink-subtle">{brand}</footer>
    </div>
  );
}
```

`PublicServicePlanner` tetap berkas lama bergaya sendiri (tidak masuk daftar penjaga) — ia dibangun ulang bersama sub-proyek 9 (Meja Konfirmasi). Kelas lama `public-shell`, `ink-panel`, `public-grid`, `section-kicker` berhenti dipakai halaman ini; periksa dengan `grep -rn "public-shell\|ink-panel\|public-grid\|section-kicker" client/src --include=*.tsx`. Bila tidak ada pemakai lain, **catat** di risiko residual; definisinya di `index.css` tidak dihapus di tugas ini.

Tambahkan ke `FOUNDATION_FILES`:

```ts
  "client/src/pages/home/PublicRateTable.tsx",
  "client/src/pages/home/PublicSections.tsx",
  "client/src/pages/Home.tsx",
```

- [ ] **Step 5: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **`Test Files 215 passed`, `Tests 1700 passed | 2 skipped`** (+2 berkas, +5 uji).

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/home client/src/pages/Home.tsx client/src/designFoundation.ts
git commit -m "Halaman publik: kurs, kontak, FAQ, dan peringatan dari Profil Perusahaan

Tidak ada lagi nama, telepon, alamat, maupun FAQ satu perusahaan yang ditulis mati.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 15: Peragaan end-to-end, Playwright, dokumentasi, penutupan

**Files:**
- Create: `e2e/masuk.spec.ts` (+ baseline di `e2e/__screenshots__/masuk.spec.ts/`)
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` (§3, §4 tabel menu baris Pengguna & Profil Perusahaan, §5.8, subbagian baru masuk/pulihkan)
- Modify: `docs/SKEMA-DATABASE-PROJECT.md` (`app_installation`, `owner_recovery_codes`, kolom `company_profile`, migrasi `0060`/`0061`)
- Modify: `docs/superpowers/plans/2026-09-26-login-penyiapan-halaman-publik.md` (centang Status Pengerjaan)
- Modify: `docs/superpowers/PROMPT-SESI.md` (lewat skill `serah-terima`)

**Interfaces:**
- Consumes: seluruh tugas sebelumnya.
- Produces: bukti peragaan, baseline visual, dokumentasi, serah terima.

- [ ] **Step 1: Peragaan penyiapan di `mc_t_abcvalas`**

`mc_t_abcvalas` tidak punya Pemegang Saham, jadi migrasi `0061` tidak menandainya (Tugas 1 Step 8). Seluruh data di bawah adalah **data uji lokal**, yang diizinkan tanpa bertanya; kata sandi uji dan kode yang tampil **tidak** ditulis ke dokumen, commit, maupun tangkapan layar.

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
DATABASE_URL=mysql://root@127.0.0.1:3306/mc_t_abcvalas node scripts/tenant.mjs setup-code
PORT=3200 DATABASE_URL=mysql://root@127.0.0.1:3306/mc_t_abcvalas TENANT_REGISTRY= ./node_modules/.bin/tsx server/_core/index.ts   # jalankan di latar
```

Di peramban, `http://localhost:3200/`:
1. `/` mengarah ke `/siapkan`. Langkah 1: ketik kodenya **huruf kecil dengan spasi** → Lanjut aktif.
2. Langkah 2: pemilik `pemilik.abc`, kata sandi uji ≥ 12 karakter. Langkah 3: "PT ABC Valas Uji", "ABC Valas".
3. Langkah 4 menampilkan delapan kode; unduh `.txt` (buka, pastikan delapan kode ada, lalu hapus berkasnya); centang → "Masuk ke aplikasi" → `/operasional` tanpa ajakan kode pemulihan (sisa 8).
4. Buka `/siapkan` lagi → "Perusahaan ini sudah disiapkan". Jalankan lagi `setup-code` → ditolak "Penyiapan sudah selesai".

Bukti SQL:

```bash
mysql -u root mc_t_abcvalas -e "SELECT setupCompletedAt, setupCodeHash FROM app_installation; SELECT username, role, mustChangePassword FROM users WHERE role='SHAREHOLDER'; SELECT COUNT(*) sisa FROM owner_recovery_codes WHERE usedAt IS NULL; SELECT action FROM audit_logs WHERE action IN ('INSTALLATION_SETUP_COMPLETED') ;"
```

Expected: `setupCompletedAt` terisi, `setupCodeHash` NULL; satu baris `pemilik.abc` (plus `test-shareholder` bila server pengembangan pernah membuatnya — itu akun pengembangan, bukan hasil wizard); sisa 8; satu `INSTALLATION_SETUP_COMPLETED`.

- [ ] **Step 2: Peragaan pemulihan, pembatas, tampilan, dan halaman publik**

1. Keluar. `/pulihkan`: `pemilik.abc` + satu kode dari berkas yang tadi dibaca + kata sandi baru → masuk ke `/operasional`. Pakai kode yang sama sekali lagi → "…sudah pernah dipakai". SQL: sisa 7, satu `OWNER_RECOVERY_CODE_USED`.
2. Keluar. Lima kali kata sandi salah untuk `pemilik.abc` → percobaan keenam menampilkan "Coba lagi dalam 30 detik." sebagai `alert`.
3. Masuk, buka Profil Perusahaan: pilih **Zamrud**, ketik `#777777` → pesan menyebut **4,48:1** dan tombol tertahan; kosongkan, simpan. Isi telepon di Data badan usaha, lalu Halaman publik: telepon kedua, jam buka, tautan peta `https://…`, dua FAQ, peringatan penipuan; simpan. Shell langsung berwarna Zamrud.
4. Keluar, buka `/` pada **1280×800, 1440×900, 1920×1080, dan 390 lebar**: judul "Kurs ABC Valas hari ini", warna Zamrud, bagian kontak dengan tautan `tel:`, FAQ milik perusahaan, peringatan milik perusahaan, tanpa gulir mendatar. Keadaan kosong tabel kurs ("Belum ada kurs aktif") tampil bila `mc_t_abcvalas` belum punya kurs aktif — **aktifkan satu kurs uji** lewat papan kurs (alasan ≥ 10 karakter) supaya tabelnya terlihat berisi.
5. Matikan "Tampilkan halaman kurs publik" → `/` membuka `/login`. Nyalakan lagi.
6. Hentikan server port 3200.

- [ ] **Step 3: Peragaan ajakan pemilik di `moneychanger`**

`test-shareholder` di `moneychanger` belum punya kode pemulihan — sama dengan pemilik produksi sesudah penerapan. **Minta pengguna masuk sendiri** sebagai Pemegang Saham (Claude tidak mengetik kata sandi akun pengembangan). Harapan: ajakan "Anda belum punya kode pemulihan…" tampil di atas isi; "Buat kode pemulihan" → `/operasional/kode-pemulihan` → kata sandi saat ini → delapan kode → "Selesai" → ajakan hilang. Menu pengguna memuat "Kode pemulihan"; untuk Controller tidak.

- [ ] **Step 4: Baseline Playwright**

`e2e/masuk.spec.ts`:

```ts
import { VIEWPORTS, expect, test } from "./fixtures";

for (const viewport of VIEWPORTS) {
  test.describe(`masuk dan halaman publik @ ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("halaman masuk", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1, name: "Masuk" })).toBeVisible();
      await expect(page).toHaveScreenshot(`login-${viewport.name}.png`);
    });

    test("pulihkan akun pemilik", async ({ page }) => {
      await page.goto("/pulihkan");
      await expect(page.getByRole("heading", { level: 1, name: "Pulihkan akun pemilik" })).toBeVisible();
      await expect(page).toHaveScreenshot(`pulihkan-${viewport.name}.png`);
    });

    test("wizard pada instalasi yang sudah disiapkan", async ({ page }) => {
      await page.goto("/siapkan");
      await expect(page.getByRole("heading", { level: 1, name: "Perusahaan ini sudah disiapkan" })).toBeVisible();
      await expect(page).toHaveScreenshot(`siapkan-selesai-${viewport.name}.png`);
    });

    test("halaman depan tanpa gulir mendatar", async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-09-14T09:00:00+07:00"));
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("hari ini");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page).toHaveScreenshot(`beranda-${viewport.name}.png`, { fullPage: true, mask: [page.locator("table"), page.getByText(/Diperbarui/)] });
    });
  });
}

test.describe("halaman depan @ ponsel 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("tidak terpotong mendatar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("hari ini");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
```

```bash
ADMIN_DATABASE_URL=mysql://root@127.0.0.1:3306/ node scripts/visualDb.mjs
./node_modules/.bin/playwright test e2e/masuk.spec.ts --update-snapshots
./node_modules/.bin/playwright test
```

Expected: jalan pertama membuat 12 baseline baru; jalan kedua **55 lulus** (42 `fondasi.spec.ts` + 13 `masuk.spec.ts`). Langkah-langkah wizard sendiri **tidak** dipotret: `mc_t_visual` sengaja sudah disiapkan (Tugas 1 Step 9) supaya baseline shell tidak berubah menjadi wizard; wizard dibuktikan uji komponen Tugas 10 dan peragaan Step 1 — penyimpangan sadar dari bunyi spec §Verifikasi, catat di serah terima. **Lihat** setiap tangkapan baru sebelum di-commit — bukan hanya jumlah lulusnya. Bila `fondasi.spec.ts` gagal, **jangan** memperbarui baselinenya otomatis: `test-controller` tidak melihat ajakan kode pemulihan dan palet `mc_t_visual` tetap Marun, jadi selisih apa pun adalah temuan yang harus diterangkan dulu.

- [ ] **Step 5: Dokumentasi**

`docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`:
- §3 "Sebelum Hari Pertama Penggunaan": instalasi baru — penginstal menjalankan `node scripts/tenant.mjs setup-code` di server; pemilik membuka alamat aplikasi, mengisi wizard tiga langkah, lalu **mencetak atau mengunduh delapan kode pemulihan** dan menyimpannya terpisah dari kata sandi. Instalasi yang sudah berjalan tidak melihat wizard; pemiliknya diajak membuat kode pemulihan saat masuk.
- Subbagian baru "Masuk, lupa kata sandi, dan kode pemulihan": lima kegagalan mengunci sementara (30 detik, berlipat sampai 15 menit); pemilik yang lupa kata sandi memakai `/pulihkan` dengan satu kode; staf yang lupa meminta pemilik/Controller mereset; membuat ulang kode membatalkan kode lama.
- §4 tabel menu: baris "Pengguna & Hak Akses" (daftar + panel detail, reset lewat dialog) dan "Profil Perusahaan" (tambah: Tampilan dan Halaman publik).
- §5.8: bagian Tampilan (enam palet, warna utama sendiri hanya bila kontras ≥ 4,5:1) dan Halaman publik (sakelar, telepon kedua, jam buka, peta `https://`, FAQ maks. 12, peringatan penipuan; bagian kosong disembunyikan).

`docs/SKEMA-DATABASE-PROJECT.md`: tabel `app_installation` dan `owner_recovery_codes` (kolom, arti, "hanya hash"), delapan kolom baru `company_profile`, migrasi `0060` (aditif) dan `0061` (isian bersyarat: hanya instalasi yang sudah punya Pemegang Saham).

- [ ] **Step 6: Perintah mutu akhir**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a; export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run > /tmp/claude-501/vitest-sp2.log 2>&1; tail -5 /tmp/claude-501/vitest-sp2.log
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
ls drizzle/*.sql | wc -l
mysql -u root -e "SELECT COUNT(*) FROM moneychanger.__drizzle_migrations; SELECT COUNT(*) FROM mc_t_abcvalas.__drizzle_migrations;"
```

Expected: **`Test Files 215 passed (215)`, `Tests 1700 passed | 2 skipped (1702)`** — +26 berkas dan +97 uji terhadap baseline 189/1603, dirinci per tugas di atas; `tsc` keluar 0 tanpa keluaran; build `✓ built`; **62 berkas SQL**, jurnal kedua basis data lokal **62**. Sebutkan angka yang benar-benar terlihat; setiap selisih diterangkan.

- [ ] **Step 7: Centang, serah terima, commit**

Centang seluruh baris Status Pengerjaan di rencana ini. Jalankan skill **`serah-terima`** untuk menulis ulang blok keadaan di `docs/superpowers/PROMPT-SESI.md` dari keadaan nyata, termasuk **risiko residual sub-proyek 2**:

1. Pembatas percobaan di memori proses — benar hanya selama produksi satu proses pm2 `fork`.
2. Autentikasi ulang tindakan sensitif belum ada (keputusan pengguna 26 September 2026).
3. **Produksi belum disentuh.** Antrean migrasinya `0059`, `0060`, `0061`. Sesudah penerapan: pemilik produksi wajib membuat kode pemulihan (ajakan muncul sendiri), baris `INITIAL_SHAREHOLDER_*` dihapus dari `.env` produksi, dan kolom halaman publik diisi — sampai itu halaman depan produksi **tanpa nomor telepon** (sebelumnya ditulis mati).
4. Kode penyiapan menuntut akses shell ke server.
5. Kehilangan seluruh kode pemulihan **dan** kata sandi pemilik hanya dapat dipulihkan lewat akses basis data langsung.
6. Kelas CSS situs publik lama (`public-shell`, `ink-panel`, …) tidak lagi dipakai halaman depan; definisinya masih di `index.css` (hasil periksa Tugas 14 Step 4).
7. `PublicServicePlanner` dan sisa layar Profil Perusahaan masih bergaya lama sampai sub-proyek 9.
8. Sub-proyek 1B dan sub-proyek 2 **belum direviu kode** oleh siapa pun; hanya uji, perintah mutu, dan peragaan.

```bash
git add e2e/masuk.spec.ts e2e/__screenshots__/masuk.spec.ts docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md docs/SKEMA-DATABASE-PROJECT.md docs/superpowers/plans/2026-09-26-login-penyiapan-halaman-publik.md docs/superpowers/PROMPT-SESI.md
git commit -m "Sub-proyek 2: peragaan end-to-end, baseline Playwright, panduan A-Z, dan skema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Penerapan ke produksi **bukan** bagian tugas ini: ia pekerjaan tersendiri dengan cadangan terbukti, `deploy.sh` manual, dan tinjauan `todo-jp0taelo.md` sesuai aturan rilis `CLAUDE.md`.
