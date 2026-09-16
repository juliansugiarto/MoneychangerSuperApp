# Sub-proyek 1B — Papan Kurs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti halaman Kurs bertumpuk kartu dengan satu papan tempat seluruh valuta (dan kelompok pecahannya) diisi sekaligus, diaktifkan **atomik dengan alasan**, lalu dipakai mengisi harga bon secara otomatis dalam toleransi yang ditetapkan admin.

**Architecture:** Aturan murni ditaruh di `shared/` (pencocokan pecahan ke kelompok, selisih harga, bentuk baris papan) supaya dapat diuji tanpa basis data — pola yang sudah dipakai `shared/publicRates.ts` dan `shared/denominationVariance.ts`. Jalur tulis kurs dipindahkan dari `server/operations.ts` ke `server/rateBoard.ts` dengan satu transaksi basis data dan satu perencana murni (`planBoardActivation`) yang memutuskan apa yang di-RETIRE dan apa yang di-ACTIVE sebelum transaksi dibuka. Layar dibangun dari pola sub-proyek 1 (`PageHeader`, `StatTile`, `PageStates`, kelas `tebal.ts`) dan dipecah per tanggung jawab di `client/src/pages/rates/`.

**Tech Stack:** React 19, Tailwind CSS 4, shadcn/Radix, wouter, tRPC v11 + Zod, Drizzle ORM (MySQL), decimal.js, Vitest 3 + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-09-13-tema-konter-tebal-dan-papan-kurs-design.md` **Bagian B** (B1–B7). Bagian A dikerjakan di `docs/superpowers/plans/2026-09-12-fondasi-desain.md` (Tugas 7A/7B) dan sudah selesai.

## Status Pengerjaan

Dikerjakan satu tugas per commit. **Centang barisnya di sini setelah commit tugas itu.**

- [x] Tugas 1 — Skema dan migrasi aditif `0059`
- [x] Tugas 2 — `shared/rateTiers.ts`: pencocokan pecahan ke kelompok
- [x] Tugas 3 — Kelola kelompok pecahan di server (`rateTiers.save` / `rateTiers.deactivate`)
- [x] Tugas 4 — Aktivasi atomik: `planBoardActivation` dan `activateOperationalRateIds`
- [x] Tugas 5 — `rates.board`: isi papan dan riwayat batch hari ini (WIB)
- [x] Tugas 6 — `rates.saveBoardDrafts` dan `rates.activateBoard`
- [x] Tugas 7 — "Salin kurs kemarin" dan "Isi saran dari referensi BI" yang sadar kelompok
- [x] Tugas 8 — Toleransi selisih harga: pengaturan dan aturan murni
- [ ] Tugas 9 — Rujukan dan toleransi per baris pecahan pada pembuatan bon
- [ ] Tugas 10 — Label kelompok pada kurs publik, Beranda, dan Meja Konfirmasi
- [ ] Tugas 11 — Kisi papan kurs di klien (`RateBoardGrid`)
- [ ] Tugas 12 — Halaman `/operasional/kurs` yang baru
- [ ] Tugas 13 — Bon: harga terisi otomatis dari papan dan alasan selisih
- [ ] Tugas 14 — Peragaan end-to-end, verifikasi peramban, dokumentasi, penutupan

Urutan mengikat: 1 sebelum semuanya; 2 sebelum 3, 5, 9; 4 sebelum 6; 5 sebelum 6, 7, 11; 8 sebelum 9 dan 13; 9 sebelum 13; 11 sebelum 12; 12 dan 13 sebelum 14.

## Global Constraints

- `pnpm` **tidak ada di PATH**. Pakai `./node_modules/.bin/*` (`vitest`, `tsc`, `vite`, `drizzle-kit`).
- Muat lingkungan sebelum uji dan sebelum migrasi:
  `export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a; export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"`
- Perintah mutu tiap tugas: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vite build`.
- **Baseline yang benar-benar dilihat pada 16 September 2026, sebelum sub-proyek ini:** `Test Files 177 passed (177)`, `Tests 1516 passed | 2 skipped (1518)`. Sebutkan angka yang benar-benar terlihat pada keluaran, dan jelaskan setiap selisihnya.
- Dependensi **tidak bertambah** di sub-proyek ini. Bila ternyata bertambah: `./node_modules/.bin/pnpm audit --prod --audit-level=high`, dan **jangan menyebut audit bersih** selama temuan SheetJS/xlsx masih ada.
- **Jangan menjalankan `prettier`.** Repo ini tidak berformat prettier.
- **Migrasi hanya aditif**: `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`. Tidak ada `DROP`, tidak ada perubahan tipe, **tidak ada enum baru maupun redefinisi enum** (redefinisi satu langkah drizzle-kit gagal `ERROR 1265` pada `STRICT_TRANS_TABLES`). Baca SQL yang dihasilkan sebelum menerapkannya.
- Migrasi diterapkan **hanya ke dua basis data lokal** dengan `node scripts/tenant.mjs migrate-all`. **Jangan menyentuh produksi.** Nomor migrasi berikutnya adalah `0059` (terakhir: `0058_brief_proteus.sql`).
- Cadangkan sebelum migrasi dengan `mysqldump --single-transaction --set-gtid-purged=OFF` dan **buktikan pemulihannya** ke basis data sekali pakai sebelum mengandalkannya.
- **Kurs tetap diaktifkan MANUAL dengan alasan ≥ 10 karakter.** "Salin kurs kemarin" dan "Isi saran dari referensi BI" hanya membuat DRAFT; tidak ada jalur kode mana pun yang mengaktifkan kurs tanpa alasan manusia.
- Otorisasi ditegakkan di tRPC (`adminProcedure` untuk seluruh prosedur kurs baru), bukan disembunyikan di UI.
- `audit_logs` **ditulis, tidak pernah disunting**. Riwayat batch di papan dibaca dari `operational_rates.activationBatchId`, **bukan** dari `audit_logs`.
- Rincian pecahan tetap wajib pada setiap pergerakan kas fisik; kedua kaki transaksi valuta (`exchange_transaction_denomination_entries` dan `exchange_transaction_payment_denominations`) tetap wajib. Sub-proyek ini **tidak mengubah** sisi Rupiah, validasi stok JUAL, maupun `cash_denomination_balances`.
- Data uji hanya di `moneychanger` dan `mc_t_abcvalas` lokal. Data uji paket sebelumnya **jangan dibersihkan**.
- Tema Konter Tebal intensitas B: kelas tebal/tenang **hanya** lewat `client/src/components/patterns/tebal.ts`. Setiap berkas klien baru di sub-proyek ini ditambahkan ke `client/src/designFoundation.ts` dan karena itu **tidak boleh memuat warna mentah** (`#…`, `rgb(`, `oklch(`). **Pengecualian spec §A4:** kisi papan memakai garis 2px dan sorot baris + kolom — tetap lewat token.
- Kepadatan: teks isi 14px, label 12px, judul halaman 20px; **baris kisi papan 34px** (spec §B5); tombol dan input 32–36px; gutter 16–20px.
- Bahasa layar: Indonesia sehari-hari dengan "Anda"; istilah resmi sebagai label kecil; pesan galat menyebut apa yang terjadi **dan** langkah berikutnya.
- Ukuran peramban wajib utuh: **1280×800, 1440×900, 1920×1080**.
- Di luar cakupan (spec §B4): seri uang kertas lama/baru, kurs per cabang, sinkronisasi otomatis ke papan tampilan, aktivasi otomatis dari sumber mana pun, dan toleransi asimetris.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `drizzle/schema.ts` | `rateTiers` baru; kolom baru pada `operationalRates`, `exchangeTransactionDenominationEntries`, `exchangeTransactions`, `operationalSettings` | 1 |
| `drizzle/0059_*.sql`, `drizzle/meta/` | Migrasi aditif | 1 |
| `shared/rateTiers.ts` (+ `shared/rateTiers.test.ts`) | Normalisasi nilai muka, deteksi tumpang tindih, pencocokan pecahan → kelompok, urutan, label "Pecahan lain" | 2 |
| `server/rateBoard.ts` | Seluruh jalur tulis kurs: kelompok, draf papan, aktivasi atomik, penyusun isi papan | 3–7 |
| `server/rateTierWrites.test.ts` | Perencana penonaktifan kelompok | 3 |
| `server/rateBoardActivation.test.ts` | `planBoardActivation`: RETIRE per kelompok, penolakan, rollback | 4 |
| `server/rateBoardHistory.test.ts` | `groupTodayActivationBatches` pada batas hari WIB | 5 |
| `server/rateBoardDrafts.test.ts` | Penggantian draf, `buildCopyDrafts`, `buildReferenceDrafts` | 6, 7 |
| `shared/rateDeviation.ts` (+ `shared/rateDeviation.test.ts`) | Persen selisih, ambang dua arah, pesan penolakan, konstanta alasan tinjauan | 8 |
| `server/operations.ts` | `createTransaction`: rujukan dan selisih **per baris pecahan**; `updateReviewThreshold` menerima toleransi | 8, 9 |
| `server/rateDeviationReview.test.ts` | `assessDenominationDeviations` | 9 |
| `server/routers.ts` | Prosedur `rates.board`, `rates.saveBoardDrafts`, `rates.activateBoard`, `rateTiers.*`; `transactions.create` menerima `rateDeviationReason` | 3–9 |
| `shared/publicRates.ts`, `client/src/pages/Home.tsx`, `client/src/pages/ServiceDesk.tsx` | Label kelompok pada kurs publik | 10 |
| `shared/rateBoard.ts` (+ `shared/rateBoard.test.ts`) | Kunci sel, sel berubah, penyaring papan, jumlah siap aktivasi | 11 |
| `client/src/pages/rates/RateBoardGrid.tsx` (+ uji) | Kisi: sorot baris + kolom, navigasi ketik, penanda sel berubah | 11 |
| `client/src/pages/rates/RateBoardFooter.tsx` | Bilah bawah menempel: jumlah, alasan, buang draf, aktifkan | 12 |
| `client/src/pages/rates/RateTierDialog.tsx` | Kelola kelompok pecahan per valuta | 12 |
| `client/src/pages/rates/RateReferencePanel.tsx` | Bagian terlipat "Referensi & pengaturan" (pembanding, sinkronisasi BI, ambang) | 12 |
| `client/src/pages/Rates.tsx` | Halaman papan kurs; URL `/operasional/kurs` tetap | 12 |
| `client/src/designFoundation.ts` | Daftar berkas berpenjaga warna mentah, bertambah | 11, 12 |
| `client/src/pages/TransactionCreate.tsx` | Harga pecahan terisi otomatis dari papan + kolom alasan selisih | 13 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku pengguna dan struktur data yang berubah | 14 |

---

### Tugas 1: Skema dan migrasi aditif `0059`

**Files:**
- Modify: `drizzle/schema.ts` (tambah `rateTiers`; kolom baru pada `operationalRates` ±78–102, `exchangeTransactions` ±233, `exchangeTransactionDenominationEntries` ±351, `operationalSettings` ±758)
- Create: `drizzle/0059_<nama-dari-drizzle-kit>.sql` (dibangkitkan, lalu **dibaca**)
- Test: `server/rateBoardSchema.test.ts`

**Interfaces:**
- Consumes: —
- Produces: tabel `rate_tiers` dan kolom `operational_rates.rateTierId` / `.approvalReason` / `.activationBatchId`, `exchange_transaction_denomination_entries.operationalRateId` / `.referenceRateSnapshot` / `.rateDeviationPercent`, `exchange_transactions.rateDeviationReason`, `operational_settings.rateDeviationTolerancePercent`. Seluruh tugas berikutnya membaca nama kolom ini apa adanya.

- [ ] **Step 1: Cadangkan kedua basis data lokal dan buktikan pemulihannya**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"
mkdir -p /tmp/backup-0059
for DB in moneychanger mc_t_abcvalas; do
  mysqldump --single-transaction --set-gtid-purged=OFF -u root "$DB" > "/tmp/backup-0059/$DB.sql"
done
mysql -u root -e "DROP DATABASE IF EXISTS mc_restore_probe; CREATE DATABASE mc_restore_probe;"
mysql -u root mc_restore_probe < /tmp/backup-0059/moneychanger.sql
mysql -u root -e "SELECT COUNT(*) AS tabel_pulih FROM information_schema.tables WHERE table_schema='mc_restore_probe';"
mysql -u root -e "DROP DATABASE mc_restore_probe;"
```

Expected: `tabel_pulih` lebih besar dari nol. Bila pemulihannya gagal, **berhenti** — jangan menjalankan migrasi apa pun.

- [ ] **Step 2: Tulis tabel baru di `drizzle/schema.ts`**

Ditaruh tepat di bawah `operationalRates` supaya domain kurs tetap berdekatan.

```ts
/**
 * Kelompok harga pecahan dalam satu valuta, mis. USD "100" · "50" · "5–20". Money changer di
 * Indonesia lazim menghargai pecahan besar dan kecil berbeda, dan satu kurs per valuta memaksa
 * selisih itu diketik ulang pada setiap bon. Valuta tanpa kelompok aktif berperilaku persis
 * seperti sebelum tabel ini ada: satu kurs untuk semua pecahan.
 */
export const rateTiers = mysqlTable("rate_tiers", {
  id: int("id").autoincrement().primaryKey(),
  currencyId: int("currencyId").notNull(),
  /** Label yang dibaca kasir di papan dan di bon, mis. "100" atau "5–20". */
  label: varchar("label", { length: 40 }).notNull(),
  /** Larik nilai muka desimal (string) yang termasuk kelompok ini, mis. ["5.000000","10.000000","20.000000"]. Satu nilai muka tidak boleh berada di dua kelompok aktif pada valuta yang sama — ditegakkan server, bukan basis data. */
  denominationValues: json("denominationValues").$type<string[]>().notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("rate_tiers_currency_active_idx").on(table.currencyId, table.active)]);
```

Pastikan `json` sudah ada pada baris `import { … } from "drizzle-orm/mysql-core"` di berkas ini; tambahkan bila belum.

- [ ] **Step 3: Tambahkan kolom pada empat tabel yang ada**

Pada `operationalRates`, tepat sesudah `currencyId`:

```ts
  /** Kelompok pecahan yang dihargai baris ini; kosong berarti kurs tingkat valuta yang berlaku untuk pecahan mana pun yang tidak masuk kelompok. */
  rateTierId: int("rateTierId"),
```

dan sesudah `notes`:

```ts
  /** Alasan aktivasi yang diketik penyetuju, disalin ke setiap kurs dalam satu batch. Penulis data untuk riwayat hari ini di papan — riwayat tidak pernah dibaca dari audit_logs. */
  approvalReason: varchar("approvalReason", { length: 1000 }),
  /** Satu id per penekanan "Aktifkan", sama untuk seluruh kurs dalam aktivasi itu. */
  activationBatchId: varchar("activationBatchId", { length: 36 }),
```

dan pada daftar indeksnya:

```ts
  index("operational_rate_currency_tier_status_idx").on(table.currencyId, table.rateTierId, table.status),
  index("operational_rate_activation_batch_idx").on(table.activationBatchId),
```

Pada `exchangeTransactionDenominationEntries`, sesudah `agreedRate`:

```ts
  /** Kurs papan yang berlaku untuk pecahan ini saat bon disimpan — dihitung ulang di server, tidak pernah dipercaya dari klien. Kosong bila valutanya tidak punya kurs aktif. */
  operationalRateId: int("operationalRateId"),
  referenceRateSnapshot: decimal("referenceRateSnapshot", { precision: 24, scale: 6 }),
  /** |agreedRate − rujukan| / rujukan × 100. Per baris pecahan, karena pecahan dalam satu bon dapat jatuh ke kelompok harga yang berbeda. */
  rateDeviationPercent: decimal("rateDeviationPercent", { precision: 8, scale: 4 }),
```

Pada `exchangeTransactions`, sesudah `dealNotes` (atau kolom teks terdekat sebelum blok indeks):

```ts
  /** Alasan yang wajib diisi ketika ada baris pecahan berharga di luar toleransi kurs papan. */
  rateDeviationReason: varchar("rateDeviationReason", { length: 1000 }),
```

Pada `operationalSettings`, sesudah `rateShockThresholdPercent`:

```ts
  /** Batas selisih harga bon terhadap kurs papan, dua arah. Di luar batas ini kasir wajib mengisi alasan dan bonnya masuk antrean tinjauan. */
  rateDeviationTolerancePercent: decimal("rateDeviationTolerancePercent", { precision: 8, scale: 4 }).default("0.5000").notNull(),
```

- [ ] **Step 4: Bangkitkan migrasi dan BACA SQL-nya**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
./node_modules/.bin/drizzle-kit generate
cat drizzle/0059_*.sql
```

Expected: hanya `CREATE TABLE \`rate_tiers\``, `ALTER TABLE … ADD \`kolom\``, dan `CREATE INDEX`. **Bila ada `DROP`, `MODIFY`, `CHANGE`, atau statement enum, hapus berkasnya, kembalikan `drizzle/meta/`, dan perbaiki `schema.ts` — jangan menyunting SQL hasil bangkitan lalu menjalankannya.**

- [ ] **Step 5: Tulis uji bentuk skema**

```ts
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { exchangeTransactionDenominationEntries, exchangeTransactions, operationalRates, operationalSettings, rateTiers } from "../drizzle/schema";

describe("skema papan kurs", () => {
  it("kurs operasional membawa kelompok, alasan, dan id batch", () => {
    const columns = Object.keys(getTableColumns(operationalRates));
    expect(columns).toEqual(expect.arrayContaining(["rateTierId", "approvalReason", "activationBatchId"]));
  });

  it("kelompok pecahan menyimpan nilai mukanya sebagai larik", () => {
    const columns = Object.keys(getTableColumns(rateTiers));
    expect(columns).toEqual(expect.arrayContaining(["currencyId", "label", "denominationValues", "sortOrder", "active", "createdByUserId"]));
  });

  it("tiap baris pecahan bon membawa rujukan dan selisihnya sendiri", () => {
    const columns = Object.keys(getTableColumns(exchangeTransactionDenominationEntries));
    expect(columns).toEqual(expect.arrayContaining(["operationalRateId", "referenceRateSnapshot", "rateDeviationPercent"]));
  });

  it("alasan selisih ada di header bon dan toleransinya di pengaturan", () => {
    expect(Object.keys(getTableColumns(exchangeTransactions))).toContain("rateDeviationReason");
    expect(getTableColumns(operationalSettings).rateDeviationTolerancePercent.default).toBe("0.5000");
  });
});
```

- [ ] **Step 6: Jalankan uji**

Run: `./node_modules/.bin/vitest run server/rateBoardSchema.test.ts`
Expected: PASS, 4 uji.

- [ ] **Step 7: Terapkan migrasi ke dua basis data lokal**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
node scripts/tenant.mjs migrate-all
mysql -u root -e "SHOW COLUMNS FROM moneychanger.operational_rates LIKE 'rateTierId'; SHOW COLUMNS FROM mc_t_abcvalas.operational_rates LIKE 'activationBatchId'; SHOW TABLES FROM moneychanger LIKE 'rate_tiers';"
```

Expected: ketiga kueri mengembalikan satu baris.

- [ ] **Step 8: Catat jalur rollback-nya**

Kode lama tidak membaca satu pun kolom baru, sehingga **mengembalikan commit sudah cukup** untuk aplikasinya. Tabel dan kolom baru **dibiarkan** (tanpa `DROP`) kecuali pengguna menyetujui penghapusannya — menjatuhkan kolom yang sudah terisi adalah kehilangan data, bukan pembatalan. Tulis kalimat ini pada pesan commit tugas ini.

- [ ] **Step 9: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: seluruhnya lolos; jumlah uji 1516 + 4 = **1520 lulus**. Bila angkanya berbeda, sebutkan angka yang terlihat dan telusuri selisihnya sebelum lanjut.

- [ ] **Step 10: Commit**

```bash
git add drizzle/schema.ts drizzle/0059_*.sql drizzle/meta server/rateBoardSchema.test.ts
git commit -m "Papan kurs: skema kelompok pecahan, batch aktivasi, dan toleransi selisih

Migrasi 0059 aditif; rollback cukup dengan mengembalikan commit, tabel dan kolom baru dibiarkan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 2: `shared/rateTiers.ts` — pencocokan pecahan ke kelompok

**Files:**
- Create: `shared/rateTiers.ts`
- Test: `shared/rateTiers.test.ts`

**Interfaces:**
- Consumes: kolom `rate_tiers` dari Tugas 1.
- Produces:
  - `type RateTierRow = { id: number; currencyId: number; label: string; denominationValues: string[]; sortOrder: number; active: boolean }`
  - `normalizeDenominationValue(value: string | number): string`
  - `sortTiers(tiers: readonly RateTierRow[]): RateTierRow[]`
  - `findTierOverlap(tiers: readonly RateTierRow[]): { value: string; labels: [string, string] } | null`
  - `matchTier(tiers: readonly RateTierRow[], denominationValue: string | number): RateTierRow | null`
  - `const OTHER_TIER_LABEL = "Pecahan lain"`
  - `tierDisplayLabel(tier: RateTierRow | null): string`

- [ ] **Step 1: Tulis uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { OTHER_TIER_LABEL, findTierOverlap, matchTier, normalizeDenominationValue, sortTiers, tierDisplayLabel, type RateTierRow } from "./rateTiers";

const tier = (id: number, label: string, values: string[], sortOrder = 0, active = true): RateTierRow =>
  ({ id, currencyId: 1, label, denominationValues: values, sortOrder, active });

const USD = [tier(2, "5–20", ["5", "10", "20"], 2), tier(1, "100", ["100"], 1), tier(3, "50", ["50"], 3, false)];

describe("nilai muka pecahan", () => {
  it("dinormalkan ke enam desimal supaya \"100\" dan 100 adalah pecahan yang sama", () => {
    expect(normalizeDenominationValue("100")).toBe("100.000000");
    expect(normalizeDenominationValue(100)).toBe("100.000000");
    expect(normalizeDenominationValue("0.50")).toBe("0.500000");
  });
});

describe("urutan kelompok", () => {
  it("mengikuti sortOrder lalu label, tanpa mengubah larik masukan", () => {
    const ordered = sortTiers(USD);
    expect(ordered.map((row) => row.label)).toEqual(["100", "5–20", "50"]);
    expect(USD.map((row) => row.label)).toEqual(["5–20", "100", "50"]);
  });
});

describe("pencocokan pecahan ke kelompok", () => {
  it("mengembalikan kelompok aktif yang memuat nilai mukanya", () => {
    expect(matchTier(USD, "10")?.label).toBe("5–20");
    expect(matchTier(USD, 100)?.label).toBe("100");
  });

  it("mengabaikan kelompok nonaktif — pecahannya jatuh ke kurs tingkat valuta", () => {
    expect(matchTier(USD, "50")).toBeNull();
  });

  it("mengembalikan null untuk pecahan yang tidak masuk kelompok mana pun", () => {
    expect(matchTier(USD, "2")).toBeNull();
    expect(tierDisplayLabel(null)).toBe(OTHER_TIER_LABEL);
  });

  it("valuta tanpa kelompok aktif berperilaku seperti satu kurs untuk semua pecahan", () => {
    expect(matchTier([], "100")).toBeNull();
  });
});

describe("tumpang tindih kelompok", () => {
  it("menemukan nilai muka yang berada di dua kelompok aktif", () => {
    const overlap = findTierOverlap([tier(1, "100", ["100", "50"], 1), tier(2, "50", ["50"], 2)]);
    expect(overlap).toEqual({ value: "50.000000", labels: ["100", "50"] });
  });

  it("tidak mempersoalkan tumpang tindih dengan kelompok nonaktif", () => {
    expect(findTierOverlap([tier(1, "100", ["100"], 1), tier(2, "lama", ["100"], 2, false)])).toBeNull();
  });

  it("tidak mempersoalkan nilai muka berulang di dalam satu kelompok yang sama", () => {
    expect(findTierOverlap([tier(1, "100", ["100", "100"], 1)])).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run shared/rateTiers.test.ts`
Expected: FAIL — `Failed to resolve import "./rateTiers"`.

- [ ] **Step 3: Tulis implementasinya**

```ts
import Decimal from "decimal.js";

/**
 * Kelompok harga pecahan dalam satu valuta (mis. USD "100" · "5–20"). Aturannya murni dan berdiri di
 * `shared/` supaya server, papan kurs, dan formulir bon memakai pencocokan yang **sama persis** —
 * harga pecahan yang berbeda pendapat antara layar dan basis data adalah kekeliruan yang tidak akan
 * terlihat dari laporan mana pun.
 */
export type RateTierRow = {
  id: number;
  currencyId: number;
  label: string;
  denominationValues: string[];
  sortOrder: number;
  active: boolean;
};

/** Label baris papan untuk pecahan yang tidak masuk kelompok mana pun. */
export const OTHER_TIER_LABEL = "Pecahan lain";

/** Enam desimal, sama dengan `denominationValue` pada basis data, supaya "100" dan 100 adalah kunci yang sama. */
export function normalizeDenominationValue(value: string | number): string {
  return new Decimal(String(value)).toFixed(6);
}

export function sortTiers(tiers: readonly RateTierRow[]): RateTierRow[] {
  return [...tiers].sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "id"));
}

/** Nilai muka pertama yang dimiliki dua kelompok **aktif** sekaligus; null bila tidak ada. */
export function findTierOverlap(tiers: readonly RateTierRow[]): { value: string; labels: [string, string] } | null {
  const owner = new Map<string, string>();
  for (const tier of sortTiers(tiers)) {
    if (!tier.active) continue;
    for (const raw of new Set(tier.denominationValues)) {
      const value = normalizeDenominationValue(raw);
      const existing = owner.get(value);
      if (existing && existing !== tier.label) return { value, labels: [existing, tier.label] };
      owner.set(value, tier.label);
    }
  }
  return null;
}

/** Kelompok aktif yang memuat nilai muka ini, atau null — dan null berarti kurs tingkat valuta yang berlaku. */
export function matchTier(tiers: readonly RateTierRow[], denominationValue: string | number): RateTierRow | null {
  const value = normalizeDenominationValue(denominationValue);
  return sortTiers(tiers).find((tier) => tier.active && tier.denominationValues.some((candidate) => normalizeDenominationValue(candidate) === value)) ?? null;
}

export function tierDisplayLabel(tier: RateTierRow | null): string {
  return tier ? tier.label : OTHER_TIER_LABEL;
}
```

- [ ] **Step 4: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run shared/rateTiers.test.ts`
Expected: PASS, 9 uji.

- [ ] **Step 5: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1529 lulus** (1520 + 9). Sebutkan angka yang benar-benar terlihat.

- [ ] **Step 6: Commit**

```bash
git add shared/rateTiers.ts shared/rateTiers.test.ts
git commit -m "Papan kurs: pencocokan pecahan ke kelompok harga

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 3: Kelola kelompok pecahan di server

**Files:**
- Create: `server/rateBoard.ts`
- Create: `server/rateTierWrites.test.ts`
- Modify: `server/routers.ts` (router `rateTiers` baru, dipasang bersebelahan dengan router `rates` ±476–491)

**Interfaces:**
- Consumes: `RateTierRow`, `findTierOverlap`, `normalizeDenominationValue`, `sortTiers` (Tugas 2); `rateTiers`, `operationalRates` (Tugas 1); `databaseOrThrow`, `writeAudit` dari `server/operations.ts`.
- Produces:
  - `type TierSaveInput = { tierId?: number; currencyId: number; label: string; denominationValues: string[]; sortOrder: number }`
  - `assertTierSaveValid(existing: readonly RateTierRow[], input: TierSaveInput): RateTierRow[]` — melempar bila tumpang tindih; mengembalikan daftar kelompok sesudah perubahan.
  - `planTierDeactivation(input: { tierLabel: string; activeRateIds: number[]; reason: string }): { retireRateIds: number[]; reason: string }` — melempar bila ada kurs ACTIVE tanpa alasan ≥ 10 karakter.
  - `saveRateTier(input: TierSaveInput, actorUserId: number)` dan `deactivateRateTier(input: { tierId: number; reason: string }, actorUserId: number)`.

- [ ] **Step 1: Tulis uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { assertTierSaveValid, planTierDeactivation } from "./rateBoard";
import type { RateTierRow } from "../shared/rateTiers";

const tier = (id: number, label: string, values: string[], sortOrder = id, active = true): RateTierRow =>
  ({ id, currencyId: 1, label, denominationValues: values, sortOrder, active });

describe("menyimpan kelompok pecahan", () => {
  it("menolak nilai muka yang sudah dimiliki kelompok aktif lain dan menyebut kedua labelnya", () => {
    expect(() => assertTierSaveValid([tier(1, "100", ["100"])], { currencyId: 1, label: "besar", denominationValues: ["100", "50"], sortOrder: 2 }))
      .toThrow(/100(\.0+)?.*(100|besar).*(100|besar)/);
  });

  it("menerima perubahan pada kelompok yang sama tanpa menganggapnya tumpang tindih dengan dirinya", () => {
    const next = assertTierSaveValid([tier(1, "100", ["100"])], { tierId: 1, currencyId: 1, label: "100", denominationValues: ["100"], sortOrder: 1 });
    expect(next).toHaveLength(1);
    expect(next[0].denominationValues).toEqual(["100.000000"]);
  });

  it("menormalkan nilai muka dan membuang duplikat di dalam satu kelompok", () => {
    const next = assertTierSaveValid([], { currencyId: 1, label: "5–20", denominationValues: ["5", "10", "10", "20"], sortOrder: 1 });
    expect(next[0].denominationValues).toEqual(["5.000000", "10.000000", "20.000000"]);
  });

  it("menolak kelompok tanpa satu pun nilai muka", () => {
    expect(() => assertTierSaveValid([], { currencyId: 1, label: "kosong", denominationValues: [], sortOrder: 1 }))
      .toThrow(/minimal satu nilai pecahan/i);
  });
});

describe("menonaktifkan kelompok pecahan", () => {
  it("mewajibkan alasan ketika kelompoknya masih memiliki kurs aktif", () => {
    expect(() => planTierDeactivation({ tierLabel: "100", activeRateIds: [7], reason: "salah" }))
      .toThrow(/alasan.*10 karakter/i);
  });

  it("me-RETIRE kurs aktif kelompok itu dalam rencana yang sama", () => {
    expect(planTierDeactivation({ tierLabel: "100", activeRateIds: [7, 9], reason: "Kelompok 100 digabung ke kelompok besar." }))
      .toEqual({ retireRateIds: [7, 9], reason: "Kelompok 100 digabung ke kelompok besar." });
  });

  it("tidak menuntut alasan bila kelompoknya belum pernah punya kurs aktif", () => {
    expect(planTierDeactivation({ tierLabel: "50", activeRateIds: [], reason: "" })).toEqual({ retireRateIds: [], reason: "" });
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run server/rateTierWrites.test.ts`
Expected: FAIL — `Failed to resolve import "./rateBoard"`.

- [ ] **Step 3: Tulis `server/rateBoard.ts`**

```ts
import { and, eq, inArray } from "drizzle-orm";
import { auditLogs, operationalRates, rateTiers } from "../drizzle/schema";
import { findTierOverlap, normalizeDenominationValue, sortTiers, type RateTierRow } from "../shared/rateTiers";
import { databaseOrThrow } from "./operations";

export const ACTIVATION_REASON_MIN_LENGTH = 10;

export type TierSaveInput = { tierId?: number; currencyId: number; label: string; denominationValues: string[]; sortOrder: number };

/**
 * Menolak satu nilai muka berada di dua kelompok aktif pada valuta yang sama. Ditegakkan di sini dan
 * bukan di basis data: aturannya menyangkut isi JSON, dan constraint MySQL tidak dapat menyatakannya.
 */
export function assertTierSaveValid(existing: readonly RateTierRow[], input: TierSaveInput): RateTierRow[] {
  const values = Array.from(new Set(input.denominationValues.map(normalizeDenominationValue)));
  if (!values.length) throw new Error("Kelompok pecahan harus memuat minimal satu nilai pecahan.");
  const candidate: RateTierRow = { id: input.tierId ?? -1, currencyId: input.currencyId, label: input.label.trim(), denominationValues: values, sortOrder: input.sortOrder, active: true };
  const next = [...existing.filter((tier) => tier.id !== candidate.id), candidate];
  const overlap = findTierOverlap(next);
  if (overlap) {
    throw new Error(`Pecahan ${overlap.value} sudah masuk kelompok "${overlap.labels[0]}"; satu pecahan tidak boleh berada di dua kelompok aktif (bentrok dengan "${overlap.labels[1]}"). Keluarkan pecahan itu dari salah satu kelompok lebih dahulu.`);
  }
  return sortTiers(next);
}

/** Menonaktifkan kelompok berarti mencabut harganya juga — kurs yang menggantung tanpa kelompok tidak pernah dapat dibaca ulang oleh siapa pun. */
export function planTierDeactivation(input: { tierLabel: string; activeRateIds: number[]; reason: string }) {
  const reason = input.reason.trim();
  if (input.activeRateIds.length && reason.length < ACTIVATION_REASON_MIN_LENGTH) {
    throw new Error(`Kelompok "${input.tierLabel}" masih memiliki kurs aktif. Isi alasan minimal ${ACTIVATION_REASON_MIN_LENGTH} karakter — kurs itu akan ikut dinonaktifkan.`);
  }
  return { retireRateIds: [...input.activeRateIds], reason: input.activeRateIds.length ? reason : input.reason.trim() };
}

async function readTiers(db: Awaited<ReturnType<typeof databaseOrThrow>>, currencyId: number): Promise<RateTierRow[]> {
  const rows = await db.select().from(rateTiers).where(eq(rateTiers.currencyId, currencyId));
  return rows.map((row) => ({ id: row.id, currencyId: row.currencyId, label: row.label, denominationValues: (row.denominationValues ?? []) as string[], sortOrder: row.sortOrder, active: row.active }));
}

export async function saveRateTier(input: TierSaveInput, actorUserId: number) {
  const db = await databaseOrThrow();
  const existing = await readTiers(db, input.currencyId);
  assertTierSaveValid(existing, input);
  const values = Array.from(new Set(input.denominationValues.map(normalizeDenominationValue)));
  if (input.tierId) {
    await db.update(rateTiers).set({ label: input.label.trim(), denominationValues: values, sortOrder: input.sortOrder, active: true }).where(eq(rateTiers.id, input.tierId));
    await writeTierAudit(actorUserId, "RATE_TIER_UPDATED", input.tierId, { label: input.label.trim(), denominationValues: values });
    return { tierId: input.tierId };
  }
  await db.insert(rateTiers).values({ currencyId: input.currencyId, label: input.label.trim(), denominationValues: values, sortOrder: input.sortOrder, createdByUserId: actorUserId });
  const created = (await db.select({ id: rateTiers.id }).from(rateTiers).where(eq(rateTiers.currencyId, input.currencyId)).orderBy(desc(rateTiers.id)).limit(1))[0];
  if (!created) throw new Error("Kelompok pecahan tidak dapat disimpan.");
  await writeTierAudit(actorUserId, "RATE_TIER_CREATED", created.id, { currencyId: input.currencyId, label: input.label.trim(), denominationValues: values });
  return { tierId: created.id };
}

export async function deactivateRateTier(input: { tierId: number; reason: string }, actorUserId: number) {
  const db = await databaseOrThrow();
  const tier = (await db.select().from(rateTiers).where(eq(rateTiers.id, input.tierId)).limit(1))[0];
  if (!tier) throw new Error("Kelompok pecahan tidak ditemukan.");
  const activeRates = await db.select({ id: operationalRates.id }).from(operationalRates)
    .where(and(eq(operationalRates.rateTierId, input.tierId), eq(operationalRates.status, "ACTIVE"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false)));
  const plan = planTierDeactivation({ tierLabel: tier.label, activeRateIds: activeRates.map((row) => row.id), reason: input.reason });
  await db.transaction(async (tx) => {
    await tx.update(rateTiers).set({ active: false }).where(eq(rateTiers.id, input.tierId));
    if (plan.retireRateIds.length) await tx.update(operationalRates).set({ status: "RETIRED" }).where(inArray(operationalRates.id, plan.retireRateIds));
    await tx.insert(auditLogs).values({ actorUserId, action: "RATE_TIER_DEACTIVATED", entityType: "rate_tier", entityId: String(input.tierId), beforeState: { active: true }, afterState: { active: false, retiredRateIds: plan.retireRateIds }, reason: plan.reason || null });
  });
  return { tierId: input.tierId, retiredRateIds: plan.retireRateIds };
}

async function writeTierAudit(actorUserId: number, action: string, tierId: number, afterState: Record<string, unknown>) {
  const { writeAudit } = await import("./operations");
  await writeAudit({ actorUserId, action, entityType: "rate_tier", entityId: String(tierId), afterState });
}
```

Tambahkan `desc` pada impor `drizzle-orm` berkas ini.

- [ ] **Step 4: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run server/rateTierWrites.test.ts`
Expected: PASS, 7 uji.

- [ ] **Step 5: Pasang router `rateTiers`**

Di `server/routers.ts`, tambahkan impor `import { deactivateRateTier, saveRateTier } from "./rateBoard";` lalu router baru tepat sesudah blok `rates: router({ … }),`:

```ts
  rateTiers: router({
    save: adminProcedure.input(z.object({
      tierId: z.number().int().positive().optional(),
      currencyId: z.number().int().positive(),
      label: z.string().trim().min(1).max(40),
      denominationValues: z.array(decimalString).min(1).max(40),
      sortOrder: z.number().int().min(0).max(999).default(0),
    })).mutation(({ input, ctx }) => saveRateTier(input, ctx.user.id)),
    deactivate: adminProcedure.input(z.object({
      tierId: z.number().int().positive(),
      reason: z.string().trim().max(1000).default(""),
    })).mutation(({ input, ctx }) => deactivateRateTier(input, ctx.user.id)),
  }),
```

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1536 lulus** (1529 + 7).

- [ ] **Step 7: Commit**

```bash
git add server/rateBoard.ts server/rateTierWrites.test.ts server/routers.ts
git commit -m "Papan kurs: kelola kelompok pecahan dengan penolakan tumpang tindih

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 4: Aktivasi atomik

Mengganti `activateOperationalRates` lama (`server/operations.ts:1306`) yang memanggil `activateOperationalRate` **dalam perulangan di luar satu transaksi**: bila kurs ketiga gagal, dua kurs pertama sudah aktif dan papan menjadi separuh benar.

**Files:**
- Modify: `server/rateBoard.ts`
- Modify: `server/operations.ts:1289-1311` (`activateOperationalRate`, `activateOperationalRates`)
- Test: `server/rateBoardActivation.test.ts`

**Interfaces:**
- Consumes: `ACTIVATION_REASON_MIN_LENGTH` (Tugas 3).
- Produces:
  - `type ActivationDraft = { id: number; currencyId: number; currencyCode: string; rateTierId: number | null; tierLabel: string; status: "DRAFT" | "ACTIVE" | "RETIRED"; isDemo: boolean; isHistorical: boolean }`
  - `type ActivationPlan = { activateRateIds: number[]; retireKeys: { currencyId: number; rateTierId: number | null }[]; batchId: string }`
  - `planBoardActivation(drafts: readonly ActivationDraft[], reason: string, batchId: string): ActivationPlan`
  - `activateOperationalRateIds(rateIds: number[], actorUserId: number, approvalReason: string): Promise<{ activated: number; batchId: string; rateIds: number[] }>`

- [ ] **Step 1: Tulis uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { planBoardActivation, type ActivationDraft } from "./rateBoard";

const draft = (id: number, currencyId: number, rateTierId: number | null, over: Partial<ActivationDraft> = {}): ActivationDraft => ({
  id, currencyId, currencyCode: currencyId === 1 ? "USD" : "SGD", rateTierId, tierLabel: rateTierId ? String(rateTierId) : "Pecahan lain",
  status: "DRAFT", isDemo: false, isHistorical: false, ...over,
});

const ALASAN = "Kurs pagi 16 September, mengikuti pergerakan referensi BI.";

describe("rencana aktivasi papan", () => {
  it("mengaktifkan seluruh draf dan me-RETIRE tepat pasangan valuta + kelompok yang sama", () => {
    const plan = planBoardActivation([draft(11, 1, 5), draft(12, 1, 6), draft(13, 2, null)], ALASAN, "batch-pagi");
    expect(plan.activateRateIds).toEqual([11, 12, 13]);
    expect(plan.retireKeys).toEqual([
      { currencyId: 1, rateTierId: 5 },
      { currencyId: 1, rateTierId: 6 },
      { currencyId: 2, rateTierId: null },
    ]);
    expect(plan.batchId).toBe("batch-pagi");
  });

  it("tidak menyentuh kurs tingkat valuta ketika hanya kelompok yang diubah", () => {
    const plan = planBoardActivation([draft(11, 1, 5)], ALASAN, "batch-siang");
    expect(plan.retireKeys).toEqual([{ currencyId: 1, rateTierId: 5 }]);
  });

  it("menolak alasan yang lebih pendek dari sepuluh karakter", () => {
    expect(() => planBoardActivation([draft(11, 1, null)], "naik", "b")).toThrow(/10 karakter/);
  });

  it("menolak seluruh batch ketika satu draf tidak berstatus DRAFT, dan menyebut valuta serta kelompoknya", () => {
    expect(() => planBoardActivation([draft(11, 1, 5), draft(12, 1, 6, { status: "RETIRED", tierLabel: "50" }), draft(13, 2, null)], ALASAN, "b"))
      .toThrow(/USD.*50/);
  });

  it("menolak draf demo atau historis", () => {
    expect(() => planBoardActivation([draft(11, 1, null, { isDemo: true })], ALASAN, "b")).toThrow(/demo atau historis/i);
    expect(() => planBoardActivation([draft(11, 1, null, { isHistorical: true })], ALASAN, "b")).toThrow(/demo atau historis/i);
  });

  it("menolak dua draf untuk pasangan valuta + kelompok yang sama dalam satu batch", () => {
    expect(() => planBoardActivation([draft(11, 1, 5), draft(12, 1, 5)], ALASAN, "b")).toThrow(/dua draf/i);
  });

  it("menolak batch kosong", () => {
    expect(() => planBoardActivation([], ALASAN, "b")).toThrow(/setidaknya satu/i);
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run server/rateBoardActivation.test.ts`
Expected: FAIL — `planBoardActivation is not a function`.

- [ ] **Step 3: Tambahkan perencana ke `server/rateBoard.ts`**

```ts
export type ActivationDraft = {
  id: number; currencyId: number; currencyCode: string; rateTierId: number | null; tierLabel: string;
  status: "DRAFT" | "ACTIVE" | "RETIRED"; isDemo: boolean; isHistorical: boolean;
};
export type ActivationPlan = { activateRateIds: number[]; retireKeys: { currencyId: number; rateTierId: number | null }[]; batchId: string };

const activationKey = (currencyId: number, rateTierId: number | null) => `${currencyId}:${rateTierId ?? "ALL"}`;

/**
 * Seluruh keputusan aktivasi diambil **sebelum** transaksi dibuka, sehingga kegagalan apa pun terjadi
 * saat belum ada satu baris pun yang berubah. Satu draf rusak membatalkan seluruh batch, dan galatnya
 * menyebut valuta serta kelompok yang gagal — "aktivasi gagal" tanpa baris yang disebut memaksa
 * operator menebak kurs mana yang harus diperbaiki.
 */
export function planBoardActivation(drafts: readonly ActivationDraft[], reason: string, batchId: string): ActivationPlan {
  const trimmed = reason.trim();
  if (trimmed.length < ACTIVATION_REASON_MIN_LENGTH) throw new Error(`Alasan aktivasi kurs minimal ${ACTIVATION_REASON_MIN_LENGTH} karakter.`);
  if (!drafts.length) throw new Error("Pilih setidaknya satu proposal kurs untuk diaktifkan.");
  const seen = new Set<string>();
  for (const draft of drafts) {
    const where = `${draft.currencyCode} · ${draft.tierLabel}`;
    if (draft.status !== "DRAFT") throw new Error(`Kurs ${where} tidak lagi berstatus DRAFT, jadi tidak ada satu pun kurs dalam aktivasi ini yang diaktifkan. Muat ulang papan lalu ulangi.`);
    if (draft.isDemo || draft.isHistorical) throw new Error(`Kurs ${where} adalah kurs demo atau historis dan tidak dapat diaktifkan pada operasi live.`);
    const key = activationKey(draft.currencyId, draft.rateTierId);
    if (seen.has(key)) throw new Error(`Ada dua draf untuk ${where} dalam satu aktivasi. Buang salah satunya lalu ulangi.`);
    seen.add(key);
  }
  return {
    activateRateIds: drafts.map((draft) => draft.id),
    retireKeys: drafts.map((draft) => ({ currencyId: draft.currencyId, rateTierId: draft.rateTierId })),
    batchId,
  };
}
```

- [ ] **Step 4: Tulis pelaksana transaksionalnya di `server/rateBoard.ts`**

```ts
import { nanoid } from "nanoid";
import { currencies } from "../drizzle/schema";
import { isNull } from "drizzle-orm";

/**
 * Satu transaksi basis data untuk seluruh batch. Menggantikan perulangan lama di `operations.ts`
 * yang dapat berhenti di tengah dan meninggalkan papan separuh aktif.
 */
export async function activateOperationalRateIds(rateIds: number[], actorUserId: number, approvalReason: string) {
  const uniqueIds = Array.from(new Set(rateIds));
  const db = await databaseOrThrow();
  const rows = uniqueIds.length
    ? await db.select({ rate: operationalRates, currency: currencies, tier: rateTiers })
        .from(operationalRates)
        .innerJoin(currencies, eq(operationalRates.currencyId, currencies.id))
        .leftJoin(rateTiers, eq(operationalRates.rateTierId, rateTiers.id))
        .where(inArray(operationalRates.id, uniqueIds))
    : [];
  if (rows.length !== uniqueIds.length) throw new Error("Sebagian proposal kurs tidak ditemukan. Muat ulang papan lalu ulangi.");
  const drafts: ActivationDraft[] = rows.map(({ rate, currency, tier }) => ({
    id: rate.id, currencyId: rate.currencyId, currencyCode: currency.code, rateTierId: rate.rateTierId,
    tierLabel: tier?.label ?? OTHER_TIER_LABEL, status: rate.status, isDemo: rate.isDemo, isHistorical: rate.isHistorical,
  }));
  const batchId = nanoid(21);
  const plan = planBoardActivation(drafts, approvalReason, batchId);
  const reason = approvalReason.trim();
  const activatedAt = new Date();
  await db.transaction(async (tx) => {
    for (const key of plan.retireKeys) {
      await tx.update(operationalRates).set({ status: "RETIRED" }).where(and(
        eq(operationalRates.currencyId, key.currencyId),
        key.rateTierId === null ? isNull(operationalRates.rateTierId) : eq(operationalRates.rateTierId, key.rateTierId),
        eq(operationalRates.status, "ACTIVE"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false),
      ));
    }
    await tx.update(operationalRates)
      .set({ status: "ACTIVE", approvedByUserId: actorUserId, approvedAt: activatedAt, approvalReason: reason, activationBatchId: batchId })
      .where(inArray(operationalRates.id, plan.activateRateIds));
    for (const draft of drafts) {
      await tx.insert(auditLogs).values({
        actorUserId, action: "OPERATIONAL_RATE_ACTIVATED", entityType: "operational_rate", entityId: String(draft.id),
        beforeState: { status: "DRAFT" }, afterState: { status: "ACTIVE", approvedAt: activatedAt, activationBatchId: batchId, rateTierId: draft.rateTierId }, reason,
      });
    }
  });
  return { activated: plan.activateRateIds.length, batchId, rateIds: plan.activateRateIds };
}
```

Tambahkan `OTHER_TIER_LABEL` pada impor `../shared/rateTiers`.

- [ ] **Step 5: Arahkan jalur lama ke pelaksana baru**

Di `server/operations.ts`, ganti badan `activateOperationalRate` dan `activateOperationalRates` (baris ±1289–1311) sehingga keduanya memanggil pelaksana yang sama — satu-satunya jalur aktivasi di seluruh aplikasi:

```ts
/** Aktivasi tunggal adalah batch beranggota satu; tidak ada jalur aktivasi kedua yang dapat berselisih aturannya. */
export async function activateOperationalRate(rateId: number, actorUserId: number, approvalReason: string) {
  const { activateOperationalRateIds } = await import("./rateBoard");
  const result = await activateOperationalRateIds([rateId], actorUserId, approvalReason);
  const db = await databaseOrThrow();
  return (await db.select().from(operationalRates).where(eq(operationalRates.id, rateId)).limit(1))[0] ?? result;
}

export async function activateOperationalRates(rateIds: number[], actorUserId: number, approvalReason: string) {
  const { activateOperationalRateIds } = await import("./rateBoard");
  return activateOperationalRateIds(rateIds, actorUserId, approvalReason);
}
```

Impor dinamis dipakai supaya `operations.ts` dan `rateBoard.ts` tidak saling mengimpor di tingkat modul.

- [ ] **Step 6: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run server/rateBoardActivation.test.ts server/rates.errorMapping.test.ts`
Expected: PASS, 7 + 5 uji.

- [ ] **Step 7: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1543 lulus** (1536 + 7).

- [ ] **Step 8: Commit**

```bash
git add server/rateBoard.ts server/rateBoardActivation.test.ts server/operations.ts
git commit -m "Papan kurs: aktivasi atomik per valuta dan kelompok

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 5: `rates.board` — isi papan dan riwayat batch hari ini

**Files:**
- Modify: `server/rateBoard.ts`
- Modify: `server/routers.ts` (tambah `board` pada router `rates`)
- Test: `server/rateBoardHistory.test.ts`

**Interfaces:**
- Consumes: `startOfOperationalDay`, `startOfNextOperationalDay` dari `shared/regulatoryActionQueue` (zona operasional WIB, sudah teruji di `shared/operationalWindow.test.ts`); `sortTiers`, `OTHER_TIER_LABEL`.
- Produces:
  - `type ActivationHistoryRow = { activationBatchId: string; approvedAt: Date; approvalReason: string | null }`
  - `type ActivationBatch = { batchId: string; approvedAt: Date; rateCount: number; approvalReason: string | null }`
  - `groupTodayActivationBatches(rows: readonly ActivationHistoryRow[], now: Date): ActivationBatch[]`
  - `readRateBoard(): Promise<RateBoardPayload>` dengan (Tugas 11 **memindahkan** `BoardCellPayload` ke `shared/rateBoard.ts` dan berkas ini mengekspornya ulang, supaya bentuk baris papan hanya ditulis sekali)
    `type RateBoardPayload = { cells: BoardCellPayload[]; batchesToday: ActivationBatch[]; alerts: { id: number; currencyCode: string; message: string }[]; latestReferenceDate: Date | null }`
    dan `type BoardCellPayload = { currencyId; currencyCode; currencyName; rateTierId: number | null; tierLabel: string; sortOrder: number; quoteUnit: string; activeRateId: number | null; activeBuyRate: string | null; activeSellRate: string | null; activeEffectiveAt: Date | null; draftRateId: number | null; draftBuyRate: string | null; draftSellRate: string | null; referenceBuyRate: string | null; referenceSellRate: string | null; referenceSnapshotId: number | null }`.
    Tugas 11 dan 12 membaca nama-nama ini apa adanya.

- [ ] **Step 1: Tulis uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { groupTodayActivationBatches } from "./rateBoard";

// 16 September 2026 pukul 09:15 WIB dan 14:40 WIB, dinyatakan sebagai instan UTC supaya ujinya
// benar pada mesin WIB maupun server UTC.
const PAGI = new Date("2026-09-16T02:15:00Z");
const SIANG = new Date("2026-09-16T07:40:00Z");
// 15 September pukul 23:30 WIB — hari operasional kemarin, walau tanggal UTC-nya masih 15.
const SEMALAM = new Date("2026-09-15T16:30:00Z");
const SEKARANG = new Date("2026-09-16T08:00:00Z");

const row = (batchId: string, approvedAt: Date, approvalReason: string | null = "Kurs pagi mengikuti referensi BI.") =>
  ({ activationBatchId: batchId, approvedAt, approvalReason });

describe("riwayat aktivasi hari ini", () => {
  it("mengelompokkan per batch dan menghitung jumlah kursnya", () => {
    const batches = groupTodayActivationBatches([row("pagi", PAGI), row("pagi", PAGI), row("siang", SIANG)], SEKARANG);
    expect(batches).toEqual([
      { batchId: "siang", approvedAt: SIANG, rateCount: 1, approvalReason: "Kurs pagi mengikuti referensi BI." },
      { batchId: "pagi", approvedAt: PAGI, rateCount: 2, approvalReason: "Kurs pagi mengikuti referensi BI." },
    ]);
  });

  it("membuang aktivasi hari operasional kemarin walau tanggal UTC-nya sama", () => {
    expect(groupTodayActivationBatches([row("semalam", SEMALAM)], SEKARANG)).toEqual([]);
  });

  it("mengabaikan kurs yang belum pernah diaktifkan lewat papan", () => {
    expect(groupTodayActivationBatches([{ activationBatchId: "", approvedAt: PAGI, approvalReason: null }], SEKARANG)).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run server/rateBoardHistory.test.ts`
Expected: FAIL — `groupTodayActivationBatches is not a function`.

- [ ] **Step 3: Tulis pengelompoknya**

```ts
import { startOfNextOperationalDay, startOfOperationalDay } from "../shared/regulatoryActionQueue";

export type ActivationHistoryRow = { activationBatchId: string; approvedAt: Date; approvalReason: string | null };
export type ActivationBatch = { batchId: string; approvedAt: Date; rateCount: number; approvalReason: string | null };

/**
 * Riwayat dibaca dari `operational_rates.activationBatchId`, **bukan** dari `audit_logs`: jejak audit
 * adalah bukti, bukan sumber tampilan, dan layar yang membacanya akan pecah begitu bentuk jejaknya
 * berubah. Batas harinya zona operasional WIB, bukan tanggal UTC proses.
 */
export function groupTodayActivationBatches(rows: readonly ActivationHistoryRow[], now: Date): ActivationBatch[] {
  const from = startOfOperationalDay(now);
  const until = startOfNextOperationalDay(now);
  const byBatch = new Map<string, ActivationBatch>();
  for (const row of rows) {
    if (!row.activationBatchId) continue;
    const approvedAt = new Date(row.approvedAt);
    if (approvedAt < from || approvedAt >= until) continue;
    const existing = byBatch.get(row.activationBatchId);
    if (existing) { existing.rateCount += 1; continue; }
    byBatch.set(row.activationBatchId, { batchId: row.activationBatchId, approvedAt, rateCount: 1, approvalReason: row.approvalReason });
  }
  return Array.from(byBatch.values()).sort((left, right) => right.approvedAt.getTime() - left.approvedAt.getTime());
}
```

- [ ] **Step 4: Tulis `readRateBoard`**

```ts
/**
 * Satu kueri untuk seluruh papan: tiap valuta aktif memunculkan satu baris per kelompok aktif,
 * ditambah satu baris "Pecahan lain" untuk kurs tingkat valuta. Baris "Pecahan lain" selalu ada —
 * pecahan yang tidak masuk kelompok mana pun harus punya tempat untuk dihargai, dan baris yang hanya
 * muncul ketika kursnya sudah ada membuat kurs pertamanya mustahil diisi.
 */
export async function readRateBoard(now = new Date()): Promise<RateBoardPayload> {
  const db = await databaseOrThrow();
  const [currencyRows, tierRows, rateRows, referenceRows, alertRows] = await Promise.all([
    db.select().from(currencies).where(eq(currencies.active, true)).orderBy(currencies.code),
    db.select().from(rateTiers).where(eq(rateTiers.active, true)),
    db.select().from(operationalRates).where(and(eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false), inArray(operationalRates.status, ["DRAFT", "ACTIVE"]))).orderBy(desc(operationalRates.id)),
    db.select().from(rateReferenceSnapshots).where(eq(rateReferenceSnapshots.isDemo, false)).orderBy(desc(rateReferenceSnapshots.referenceDate), desc(rateReferenceSnapshots.fetchedAt)),
    db.select({ alert: rateVolatilityAlerts, currency: currencies }).from(rateVolatilityAlerts).innerJoin(currencies, eq(rateVolatilityAlerts.currencyId, currencies.id)).where(isNull(rateVolatilityAlerts.resolvedAt)),
  ]);

  const tiersByCurrency = new Map<number, RateTierRow[]>();
  for (const row of tierRows) {
    const list = tiersByCurrency.get(row.currencyId) ?? [];
    list.push({ id: row.id, currencyId: row.currencyId, label: row.label, denominationValues: (row.denominationValues ?? []) as string[], sortOrder: row.sortOrder, active: row.active });
    tiersByCurrency.set(row.currencyId, list);
  }
  const latestReferenceByCurrency = new Map<number, typeof referenceRows[number]>();
  for (const row of referenceRows) if (!latestReferenceByCurrency.has(row.currencyId)) latestReferenceByCurrency.set(row.currencyId, row);

  const key = (currencyId: number, rateTierId: number | null) => `${currencyId}:${rateTierId ?? "ALL"}`;
  const activeByKey = new Map<string, typeof rateRows[number]>();
  const draftByKey = new Map<string, typeof rateRows[number]>();
  for (const rate of rateRows) {
    const bucket = rate.status === "ACTIVE" ? activeByKey : draftByKey;
    const cellKey = key(rate.currencyId, rate.rateTierId);
    if (!bucket.has(cellKey)) bucket.set(cellKey, rate);
  }

  const cells: BoardCellPayload[] = [];
  for (const currency of currencyRows) {
    if (currency.code === "IDR") continue;
    const reference = latestReferenceByCurrency.get(currency.id);
    const tiers = sortTiers(tiersByCurrency.get(currency.id) ?? []);
    const rows: { rateTierId: number | null; tierLabel: string; sortOrder: number }[] = [
      ...tiers.map((tier) => ({ rateTierId: tier.id, tierLabel: tier.label, sortOrder: tier.sortOrder })),
      { rateTierId: null, tierLabel: OTHER_TIER_LABEL, sortOrder: 9999 },
    ];
    for (const row of rows) {
      const cellKey = key(currency.id, row.rateTierId);
      const active = activeByKey.get(cellKey);
      const draft = draftByKey.get(cellKey);
      cells.push({
        currencyId: currency.id, currencyCode: currency.code, currencyName: currency.name,
        rateTierId: row.rateTierId, tierLabel: row.tierLabel, sortOrder: row.sortOrder,
        quoteUnit: String(active?.quoteUnit ?? draft?.quoteUnit ?? reference?.quoteUnit ?? "1.000000"),
        activeRateId: active?.id ?? null, activeBuyRate: active ? String(active.buyRate) : null, activeSellRate: active ? String(active.sellRate) : null, activeEffectiveAt: active?.effectiveAt ?? null,
        draftRateId: draft?.id ?? null, draftBuyRate: draft ? String(draft.buyRate) : null, draftSellRate: draft ? String(draft.sellRate) : null,
        referenceBuyRate: reference ? String(reference.buyRate) : null, referenceSellRate: reference ? String(reference.sellRate) : null, referenceSnapshotId: reference?.id ?? null,
      });
    }
  }

  const historyRows = rateRows.filter((rate) => rate.status === "ACTIVE" && rate.approvedAt)
    .map((rate) => ({ activationBatchId: rate.activationBatchId ?? "", approvedAt: rate.approvedAt as Date, approvalReason: rate.approvalReason }));

  return {
    cells,
    batchesToday: groupTodayActivationBatches(historyRows, now),
    alerts: alertRows.map(({ alert, currency }) => ({ id: alert.id, currencyCode: currency.code, message: `Referensi ${currency.code} bergerak ${String(alert.changePercent)}% — periksa sebelum mengaktifkan.` })),
    latestReferenceDate: referenceRows[0]?.referenceDate ?? null,
  };
}
```

Tambahkan `rateReferenceSnapshots` dan `rateVolatilityAlerts` pada impor skema. Bila nama kolom persentase pada `rateVolatilityAlerts` berbeda, pakai nama yang benar-benar ada di `drizzle/schema.ts` — jangan menambah kolom untuk mencocokkan kalimat ini.

- [ ] **Step 5: Pasang prosedurnya**

Di `server/routers.ts`, tambahkan `import { readRateBoard } from "./rateBoard";` dan satu baris di dalam `rates: router({ … })`:

```ts
    board: adminProcedure.query(() => readRateBoard()),
```

- [ ] **Step 6: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run server/rateBoardHistory.test.ts`
Expected: PASS, 3 uji.

- [ ] **Step 7: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1546 lulus** (1543 + 3).

- [ ] **Step 8: Commit**

```bash
git add server/rateBoard.ts server/rateBoardHistory.test.ts server/routers.ts
git commit -m "Papan kurs: isi papan dan riwayat aktivasi hari ini menurut WIB

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 6: `rates.saveBoardDrafts` dan `rates.activateBoard`

**Files:**
- Modify: `server/rateBoard.ts`
- Modify: `server/routers.ts`
- Test: `server/rateBoardDrafts.test.ts`

**Interfaces:**
- Consumes: `planBoardActivation`, `activateOperationalRateIds` (Tugas 4); `readRateBoard` (Tugas 5).
- Produces:
  - `type BoardDraftInput = { currencyId: number; rateTierId: number | null; quoteUnit: string; buyRate: string; sellRate: string; referenceSnapshotId?: number | null }`
  - `planDraftReplacement(existingDrafts: readonly { id: number; currencyId: number; rateTierId: number | null }[], inputs: readonly BoardDraftInput[]): { replaceRateIds: number[]; inserts: BoardDraftInput[] }`
  - `saveBoardDrafts(inputs: BoardDraftInput[], actorUserId: number): Promise<{ saved: number; replaced: number }>`
  - `activateBoardDrafts(input: { rateIds?: number[]; approvalReason: string }, actorUserId: number)` — tanpa `rateIds`, seluruh DRAFT papan diaktifkan.

- [ ] **Step 1: Tulis uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { planDraftReplacement, type BoardDraftInput } from "./rateBoard";

const input = (currencyId: number, rateTierId: number | null, buyRate: string): BoardDraftInput =>
  ({ currencyId, rateTierId, quoteUnit: "1.000000", buyRate, sellRate: "16400.000000" });

describe("menyimpan draf papan", () => {
  it("mengganti draf lama pada pasangan valuta + kelompok yang sama", () => {
    const plan = planDraftReplacement([{ id: 31, currencyId: 1, rateTierId: 5 }], [input(1, 5, "16290")]);
    expect(plan.replaceRateIds).toEqual([31]);
    expect(plan.inserts).toHaveLength(1);
  });

  it("membiarkan draf kelompok lain pada valuta yang sama", () => {
    const plan = planDraftReplacement([{ id: 31, currencyId: 1, rateTierId: 5 }, { id: 32, currencyId: 1, rateTierId: 6 }], [input(1, 6, "16250")]);
    expect(plan.replaceRateIds).toEqual([32]);
  });

  it("membedakan kurs tingkat valuta dari kelompok mana pun", () => {
    const plan = planDraftReplacement([{ id: 31, currencyId: 1, rateTierId: null }], [input(1, 5, "16290")]);
    expect(plan.replaceRateIds).toEqual([]);
    expect(plan.inserts).toEqual([input(1, 5, "16290")]);
  });

  it("menolak kurs beli yang lebih tinggi daripada kurs jual", () => {
    expect(() => planDraftReplacement([], [{ currencyId: 1, rateTierId: null, quoteUnit: "1.000000", buyRate: "16500", sellRate: "16400" }]))
      .toThrow(/beli.*jual/i);
  });

  it("menolak kurs nol atau negatif", () => {
    expect(() => planDraftReplacement([], [{ currencyId: 1, rateTierId: null, quoteUnit: "1.000000", buyRate: "0", sellRate: "16400" }]))
      .toThrow(/lebih besar dari nol/i);
  });

  it("menolak dua sel untuk pasangan valuta + kelompok yang sama dalam satu penyimpanan", () => {
    expect(() => planDraftReplacement([], [input(1, 5, "16290"), input(1, 5, "16295")])).toThrow(/dua nilai/i);
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run server/rateBoardDrafts.test.ts`
Expected: FAIL — `planDraftReplacement is not a function`.

- [ ] **Step 3: Tulis perencana dan penulisnya**

```ts
import Decimal from "decimal.js";

export type BoardDraftInput = { currencyId: number; rateTierId: number | null; quoteUnit: string; buyRate: string; sellRate: string; referenceSnapshotId?: number | null };

/** Draf baru **mengganti** draf lama untuk pasangan valuta + kelompok yang sama: papan menyimpan satu niat per sel, bukan tumpukan niat. */
export function planDraftReplacement(
  existingDrafts: readonly { id: number; currencyId: number; rateTierId: number | null }[],
  inputs: readonly BoardDraftInput[],
) {
  const seen = new Set<string>();
  for (const row of inputs) {
    const key = `${row.currencyId}:${row.rateTierId ?? "ALL"}`;
    if (seen.has(key)) throw new Error("Ada dua nilai untuk sel yang sama dalam satu penyimpanan. Muat ulang papan lalu ulangi.");
    seen.add(key);
    const buy = new Decimal(row.buyRate);
    const sell = new Decimal(row.sellRate);
    if (buy.lte(0) || sell.lte(0) || new Decimal(row.quoteUnit).lte(0)) throw new Error("Kurs beli, kurs jual, dan satuan kuotasi harus lebih besar dari nol.");
    if (buy.gt(sell)) throw new Error("Kurs beli tidak boleh lebih tinggi daripada kurs jual pada sel yang sama.");
  }
  const replaceRateIds = existingDrafts.filter((draft) => seen.has(`${draft.currencyId}:${draft.rateTierId ?? "ALL"}`)).map((draft) => draft.id);
  return { replaceRateIds, inserts: [...inputs] };
}

export async function saveBoardDrafts(inputs: BoardDraftInput[], actorUserId: number) {
  const db = await databaseOrThrow();
  const existing = await db.select({ id: operationalRates.id, currencyId: operationalRates.currencyId, rateTierId: operationalRates.rateTierId })
    .from(operationalRates).where(and(eq(operationalRates.status, "DRAFT"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false)));
  const plan = planDraftReplacement(existing, inputs);
  const effectiveAt = new Date();
  await db.transaction(async (tx) => {
    if (plan.replaceRateIds.length) await tx.delete(operationalRates).where(inArray(operationalRates.id, plan.replaceRateIds));
    for (const row of plan.inserts) {
      await tx.insert(operationalRates).values({
        currencyId: row.currencyId, rateTierId: row.rateTierId, referenceSnapshotId: row.referenceSnapshotId ?? null,
        quoteUnit: new Decimal(row.quoteUnit).toFixed(6), buyRate: new Decimal(row.buyRate).toFixed(6), sellRate: new Decimal(row.sellRate).toFixed(6),
        effectiveAt, status: "DRAFT", proposedByUserId: actorUserId,
      });
    }
    await tx.insert(auditLogs).values({
      actorUserId, action: "OPERATIONAL_RATE_BOARD_DRAFTED", entityType: "operational_rate_batch", entityId: effectiveAt.toISOString(),
      afterState: { savedCells: plan.inserts.length, replacedRateIds: plan.replaceRateIds },
    });
  });
  return { saved: plan.inserts.length, replaced: plan.replaceRateIds.length };
}

export async function activateBoardDrafts(input: { rateIds?: number[]; approvalReason: string }, actorUserId: number) {
  const db = await databaseOrThrow();
  const rateIds = input.rateIds?.length
    ? input.rateIds
    : (await db.select({ id: operationalRates.id }).from(operationalRates)
        .where(and(eq(operationalRates.status, "DRAFT"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false)))).map((row) => row.id);
  return activateOperationalRateIds(rateIds, actorUserId, input.approvalReason);
}

/** Membuang seluruh draf papan tanpa menyentuh satu pun kurs yang sedang aktif. */
export async function discardBoardDrafts(actorUserId: number) {
  const db = await databaseOrThrow();
  const drafts = await db.select({ id: operationalRates.id }).from(operationalRates)
    .where(and(eq(operationalRates.status, "DRAFT"), eq(operationalRates.isDemo, false), eq(operationalRates.isHistorical, false)));
  if (!drafts.length) return { discarded: 0 };
  const ids = drafts.map((row) => row.id);
  await db.transaction(async (tx) => {
    await tx.delete(operationalRates).where(inArray(operationalRates.id, ids));
    await tx.insert(auditLogs).values({ actorUserId, action: "OPERATIONAL_RATE_DRAFTS_DISCARDED", entityType: "operational_rate_batch", entityId: new Date().toISOString(), beforeState: { rateIds: ids } });
  });
  return { discarded: ids.length };
}
```

Tambahkan `desc` dan `inArray` pada impor `drizzle-orm` bila belum ada.

- [ ] **Step 4: Pasang tiga prosedurnya**

Di dalam `rates: router({ … })` pada `server/routers.ts`:

```ts
    saveBoardDrafts: adminProcedure.input(z.object({
      cells: z.array(z.object({
        currencyId: z.number().int().positive(),
        rateTierId: z.number().int().positive().nullable().default(null),
        quoteUnit: decimalString.default("1"),
        buyRate: decimalString,
        sellRate: decimalString,
        referenceSnapshotId: z.number().int().positive().nullable().optional(),
      })).min(1).max(400),
    })).mutation(({ input, ctx }) => saveBoardDrafts(input.cells, ctx.user.id)),
    activateBoard: adminProcedure.input(z.object({
      rateIds: z.array(z.number().int().positive()).max(400).optional(),
      approvalReason: z.string().trim().min(10).max(1000),
    })).mutation(({ input, ctx }) => activateBoardDrafts(input, ctx.user.id)),
    discardBoardDrafts: adminProcedure.mutation(({ ctx }) => discardBoardDrafts(ctx.user.id)),
```

- [ ] **Step 5: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run server/rateBoardDrafts.test.ts`
Expected: PASS, 6 uji.

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1552 lulus** (1546 + 6).

- [ ] **Step 7: Commit**

```bash
git add server/rateBoard.ts server/rateBoardDrafts.test.ts server/routers.ts
git commit -m "Papan kurs: simpan draf sekaligus, aktifkan dengan alasan, buang draf

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 7: "Salin kurs kemarin" dan "Isi saran dari referensi BI"

Keduanya **hanya membuat DRAFT**. Tidak ada jalur di tugas ini yang mengubah status menjadi ACTIVE — aturan aktivasi manual dengan alasan tetap berlaku sepenuhnya.

**Files:**
- Modify: `server/rateBoard.ts`
- Modify: `server/routers.ts`
- Modify: `server/rateBoardDrafts.test.ts`

**Interfaces:**
- Consumes: `BoardCellPayload` (Tugas 5), `BoardDraftInput` (Tugas 6).
- Produces:
  - `buildCopyDrafts(cells: readonly BoardCellPayload[]): BoardDraftInput[]`
  - `buildReferenceDrafts(cells: readonly BoardCellPayload[]): BoardDraftInput[]`
  - Prosedur `rates.copyActiveToDrafts` dan `rates.suggestFromReference` (ADMIN+), keduanya mengembalikan `{ saved: number; replaced: number }`.

- [ ] **Step 1: Tambahkan uji yang gagal ke `server/rateBoardDrafts.test.ts`**

```ts
import { buildCopyDrafts, buildReferenceDrafts, type BoardCellPayload } from "./rateBoard";

const cell = (over: Partial<BoardCellPayload> = {}): BoardCellPayload => ({
  currencyId: 1, currencyCode: "USD", currencyName: "Dolar Amerika Serikat", rateTierId: null, tierLabel: "Pecahan lain", sortOrder: 9999,
  quoteUnit: "1.000000", activeRateId: null, activeBuyRate: null, activeSellRate: null, activeEffectiveAt: null,
  draftRateId: null, draftBuyRate: null, draftSellRate: null,
  referenceBuyRate: null, referenceSellRate: null, referenceSnapshotId: null, ...over,
});

describe("salin kurs kemarin", () => {
  it("membuat draf dari kurs yang sedang aktif, per kelompok", () => {
    const drafts = buildCopyDrafts([
      cell({ rateTierId: 5, tierLabel: "100", activeRateId: 21, activeBuyRate: "16290.000000", activeSellRate: "16400.000000" }),
      cell({ rateTierId: 6, tierLabel: "5–20", activeRateId: 22, activeBuyRate: "16100.000000", activeSellRate: "16300.000000" }),
    ]);
    expect(drafts).toEqual([
      { currencyId: 1, rateTierId: 5, quoteUnit: "1.000000", buyRate: "16290.000000", sellRate: "16400.000000" },
      { currencyId: 1, rateTierId: 6, quoteUnit: "1.000000", buyRate: "16100.000000", sellRate: "16300.000000" },
    ]);
  });

  it("melewati sel yang belum punya kurs aktif alih-alih mengarang nol", () => {
    expect(buildCopyDrafts([cell()])).toEqual([]);
  });
});

describe("saran dari referensi BI", () => {
  it("membuat draf untuk setiap kelompok dari snapshot valutanya", () => {
    const drafts = buildReferenceDrafts([
      cell({ rateTierId: 5, tierLabel: "100", referenceBuyRate: "16200.000000", referenceSellRate: "16360.000000", referenceSnapshotId: 9 }),
      cell({ rateTierId: null, referenceBuyRate: "16200.000000", referenceSellRate: "16360.000000", referenceSnapshotId: 9 }),
    ]);
    expect(drafts.map((row) => row.rateTierId)).toEqual([5, null]);
    expect(drafts[0]).toEqual({ currencyId: 1, rateTierId: 5, quoteUnit: "1.000000", buyRate: "16200.000000", sellRate: "16360.000000", referenceSnapshotId: 9 });
  });

  it("melewati valuta yang belum punya snapshot BI", () => {
    expect(buildReferenceDrafts([cell()])).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run server/rateBoardDrafts.test.ts`
Expected: FAIL — `buildCopyDrafts is not a function`.

- [ ] **Step 3: Tulis kedua penyusun draf**

```ts
/**
 * Kedua penyusun ini **tidak pernah** mengaktifkan apa pun: hasilnya masuk ke `saveBoardDrafts` dan
 * menunggu alasan manusia. Sel tanpa sumber angka dilewati, bukan diisi nol — kurs nol yang lolos ke
 * bon jauh lebih berbahaya daripada sel yang dibiarkan kosong.
 */
export function buildCopyDrafts(cells: readonly BoardCellPayload[]): BoardDraftInput[] {
  return cells.filter((cell) => cell.activeBuyRate && cell.activeSellRate).map((cell) => ({
    currencyId: cell.currencyId, rateTierId: cell.rateTierId, quoteUnit: cell.quoteUnit,
    buyRate: cell.activeBuyRate as string, sellRate: cell.activeSellRate as string,
  }));
}

export function buildReferenceDrafts(cells: readonly BoardCellPayload[]): BoardDraftInput[] {
  return cells.filter((cell) => cell.referenceBuyRate && cell.referenceSellRate).map((cell) => ({
    currencyId: cell.currencyId, rateTierId: cell.rateTierId, quoteUnit: cell.quoteUnit,
    buyRate: cell.referenceBuyRate as string, sellRate: cell.referenceSellRate as string, referenceSnapshotId: cell.referenceSnapshotId,
  }));
}

export async function copyActiveRatesToDrafts(actorUserId: number) {
  const board = await readRateBoard();
  const drafts = buildCopyDrafts(board.cells);
  if (!drafts.length) throw new Error("Belum ada kurs aktif yang dapat disalin. Isi kurs hari ini secara manual atau pakai saran dari referensi BI.");
  return saveBoardDrafts(drafts, actorUserId);
}

export async function suggestDraftsFromReference(actorUserId: number) {
  const board = await readRateBoard();
  const drafts = buildReferenceDrafts(board.cells);
  if (!drafts.length) throw new Error("Belum ada snapshot BI tersimpan. Jalankan sinkronisasi referensi lebih dahulu.");
  return saveBoardDrafts(drafts, actorUserId);
}
```

- [ ] **Step 4: Pasang prosedurnya**

Di dalam `rates: router({ … })`:

```ts
    copyActiveToDrafts: adminProcedure.mutation(({ ctx }) => copyActiveRatesToDrafts(ctx.user.id)),
    suggestFromReference: adminProcedure.mutation(({ ctx }) => suggestDraftsFromReference(ctx.user.id)),
```

`rates.proposeLatest` yang lama **tetap ada** dan tidak diubah: ia dipakai layar lain dan menghapusnya bukan bagian tugas ini.

- [ ] **Step 5: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run server/rateBoardDrafts.test.ts`
Expected: PASS, 10 uji (6 dari Tugas 6 + 4 baru).

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1556 lulus** (1552 + 4).

- [ ] **Step 7: Commit**

```bash
git add server/rateBoard.ts server/rateBoardDrafts.test.ts server/routers.ts
git commit -m "Papan kurs: salin kurs aktif dan saran referensi BI sebagai draf

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 8: Toleransi selisih harga

**Files:**
- Create: `shared/rateDeviation.ts`
- Test: `shared/rateDeviation.test.ts`
- Modify: `server/operations.ts` (`getReviewThreshold` ±1329, `updateReviewThreshold` ±1342, dan konstanta bawaan ±68)
- Modify: `server/routers.ts` (`settings.updateReviewThreshold`)

**Interfaces:**
- Consumes: kolom `operational_settings.rateDeviationTolerancePercent` (Tugas 1).
- Produces:
  - `const RATE_DEVIATION_REVIEW_REASON = "SELISIH_KURS_MELEBIHI_TOLERANSI"`
  - `const DEFAULT_RATE_DEVIATION_TOLERANCE_PERCENT = "0.5000"`
  - `rateDeviationPercent(agreedRate: string, referenceRate: string | null): string | null`
  - `exceedsTolerance(deviationPercent: string | null, tolerancePercent: string): boolean`
  - `type DeviationRow = { currencyCode: string; denominationValue: string; agreedRate: string; referenceRate: string; deviationPercent: string }`
  - `deviationRejectionMessage(rows: readonly DeviationRow[], tolerancePercent: string): string`
  - `getReviewThreshold()` mengembalikan `rateDeviationTolerancePercent` juga; `updateReviewThreshold(...)` menerimanya sebagai argumen opsional keempat.

- [ ] **Step 1: Tulis uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { RATE_DEVIATION_REVIEW_REASON, deviationRejectionMessage, exceedsTolerance, rateDeviationPercent } from "./rateDeviation";

describe("persen selisih harga", () => {
  it("dihitung sebagai selisih mutlak terhadap kurs papan", () => {
    expect(rateDeviationPercent("16485", "16290")).toBe("1.1970");
    expect(rateDeviationPercent("16095", "16290")).toBe("1.1970");
  });

  it("bernilai nol ketika harganya sama persis dengan papan", () => {
    expect(rateDeviationPercent("16290", "16290")).toBe("0.0000");
  });

  it("tidak dapat dihitung tanpa kurs papan — valuta tanpa kurs aktif tetap seperti sebelumnya", () => {
    expect(rateDeviationPercent("16290", null)).toBeNull();
    expect(rateDeviationPercent("16290", "0")).toBeNull();
  });
});

describe("ambang toleransi", () => {
  it("berlaku dua arah dan hanya melampaui batas ketika benar-benar lebih besar", () => {
    expect(exceedsTolerance("1.1970", "0.5000")).toBe(true);
    expect(exceedsTolerance("0.5000", "0.5000")).toBe(false);
    expect(exceedsTolerance("0.4999", "0.5000")).toBe(false);
  });

  it("tidak pernah menyalakan tinjauan ketika selisihnya tidak dapat dihitung", () => {
    expect(exceedsTolerance(null, "0.5000")).toBe(false);
  });
});

describe("pesan penolakan", () => {
  it("menyebut valuta, pecahan, harga papan, dan batasnya", () => {
    const message = deviationRejectionMessage([
      { currencyCode: "USD", denominationValue: "100.000000", agreedRate: "16485.000000", referenceRate: "16290.000000", deviationPercent: "1.1970" },
    ], "0.5000");
    expect(message).toContain("USD 100");
    expect(message).toContain("1,2%");
    expect(message).toContain("16.290");
    expect(message).toContain("0,5%");
    expect(message).toContain("Isi alasan selisih harga atau pakai kurs papan.");
  });

  it("menyebut setiap baris yang melampaui batas, bukan hanya yang pertama", () => {
    const message = deviationRejectionMessage([
      { currencyCode: "USD", denominationValue: "100.000000", agreedRate: "16485", referenceRate: "16290", deviationPercent: "1.1970" },
      { currencyCode: "SGD", denominationValue: "50.000000", agreedRate: "12000", referenceRate: "12500", deviationPercent: "4.0000" },
    ], "0.5000");
    expect(message).toContain("USD 100");
    expect(message).toContain("SGD 50");
  });
});

describe("alasan tinjauan", () => {
  it("memakai kode yang sama dengan daftar alasan yang sudah ada", () => {
    expect(RATE_DEVIATION_REVIEW_REASON).toBe("SELISIH_KURS_MELEBIHI_TOLERANSI");
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run shared/rateDeviation.test.ts`
Expected: FAIL — `Failed to resolve import "./rateDeviation"`.

- [ ] **Step 3: Tulis `shared/rateDeviation.ts`**

```ts
import Decimal from "decimal.js";

/** Kode alasan tinjauan; ditambahkan ke `reviewReason` lewat daftar alasan yang sudah ada di `assessTransactionRisk`. */
export const RATE_DEVIATION_REVIEW_REASON = "SELISIH_KURS_MELEBIHI_TOLERANSI";
export const DEFAULT_RATE_DEVIATION_TOLERANCE_PERCENT = "0.5000";

export type DeviationRow = { currencyCode: string; denominationValue: string; agreedRate: string; referenceRate: string; deviationPercent: string };

/** |harga − rujukan| / rujukan × 100, empat desimal. Null berarti tidak ada rujukan — bukan nol. */
export function rateDeviationPercent(agreedRate: string, referenceRate: string | null): string | null {
  if (!referenceRate) return null;
  const reference = new Decimal(referenceRate);
  if (!reference.gt(0)) return null;
  return new Decimal(agreedRate).minus(reference).abs().div(reference).times(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

/** Toleransi berlaku dua arah — lebih mahal maupun lebih murah. Asimetri ditunda sampai ada kebutuhan (spec §B3). */
export function exceedsTolerance(deviationPercent: string | null, tolerancePercent: string): boolean {
  if (deviationPercent === null) return false;
  return new Decimal(deviationPercent).gt(new Decimal(tolerancePercent));
}

const idr = (value: string) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value));
const percent = (value: string) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Number(value));
const faceValue = (value: string) => new Decimal(value).toDecimalPlaces(2).toString();

/** Pesan galat menyebut apa yang terjadi **dan** langkah berikutnya — panduan bahasa sub-proyek 1. */
export function deviationRejectionMessage(rows: readonly DeviationRow[], tolerancePercent: string): string {
  const sentences = rows.map((row) =>
    `Harga ${row.currencyCode} ${faceValue(row.denominationValue)} berbeda ${percent(row.deviationPercent)}% dari kurs papan ${idr(row.referenceRate)} (batas ±${percent(tolerancePercent)}%).`);
  return `${sentences.join(" ")} Isi alasan selisih harga atau pakai kurs papan.`;
}
```

- [ ] **Step 4: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run shared/rateDeviation.test.ts`
Expected: PASS, 8 uji.

- [ ] **Step 5: Sambungkan toleransi ke pengaturan**

Di `server/operations.ts`, tambahkan konstanta di dekat `DEFAULT_RATE_SHOCK_THRESHOLD_PERCENT` (±68):

```ts
const DEFAULT_RATE_DEVIATION_TOLERANCE = DEFAULT_RATE_DEVIATION_TOLERANCE_PERCENT;
```

(dengan `import { DEFAULT_RATE_DEVIATION_TOLERANCE_PERCENT } from "../shared/rateDeviation";`)

`getReviewThreshold` menambahkan satu field pada **kedua** cabangnya — jalur normal dan jalur fallback saat basis data tidak tersedia:

```ts
      rateDeviationTolerancePercent: found?.rateDeviationTolerancePercent ?? DEFAULT_RATE_DEVIATION_TOLERANCE,
```

`updateReviewThreshold` menerima argumen opsional keempat `rateDeviationTolerancePercent?: string`, menormalkannya dengan pola yang sama seperti `rateShockThresholdPercent` (`new Decimal(value)` harus `> 0` dan `<= 100`, disimpan `toFixed(4)`), memasukkannya ke `set({ … })` dan ke kedua sisi `writeAudit`.

Di `server/routers.ts`, `settings.updateReviewThreshold` menerima satu field lagi:

```ts
    updateReviewThreshold: adminProcedure.input(z.object({ reviewThresholdUsd: decimalString, eddCashDailyThresholdIdr: decimalString.optional(), rateShockThresholdPercent: decimalString.optional(), rateDeviationTolerancePercent: decimalString.optional() })).mutation(({ input, ctx }) => updateReviewThreshold(input.reviewThresholdUsd, ctx.user.id, input.eddCashDailyThresholdIdr, input.rateShockThresholdPercent, input.rateDeviationTolerancePercent)),
```

- [ ] **Step 6: Perbarui uji ambang yang ada**

`server/reviewSettings.test.ts` memeriksa objek fallback secara utuh dengan `toEqual`; tambahkan field barunya:

```ts
    await expect(getReviewThreshold()).resolves.toEqual({
      reviewThresholdUsd: "10000.00",
      eddCashDailyThresholdIdr: "100000000.00",
      rateShockThresholdPercent: "1.5000",
      rateDeviationTolerancePercent: "0.5000",
      isFallback: true,
    });
```

- [ ] **Step 7: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1564 lulus** (1556 + 8). Uji `reviewSettings` tetap 1 uji — ia diperbarui, bukan ditambah.

- [ ] **Step 8: Commit**

```bash
git add shared/rateDeviation.ts shared/rateDeviation.test.ts server/operations.ts server/routers.ts server/reviewSettings.test.ts
git commit -m "Papan kurs: toleransi selisih harga bon sebagai pengaturan admin

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 9: Rujukan dan toleransi per baris pecahan

Hari ini `createTransaction` (`server/operations.ts:1535-1551`) mencari kurs aktif **per valuta** dan menyimpannya hanya di `exchange_transaction_lines`. Tugas ini memindahkan rujukan itu ke **setiap baris pecahan**, karena pecahan dalam satu bon dapat jatuh ke kelompok harga yang berbeda.

Yang **tidak** berubah: sisi Rupiah (`exchange_transaction_payment_denominations`), validasi stok pecahan untuk JUAL, `cash_denomination_balances`, dan `exchange_transaction_lines.agreedRate` yang tetap rata-rata tertimbang hasil hitung.

**Files:**
- Modify: `server/rateBoard.ts`
- Modify: `server/operations.ts` (±1535–1560 penyiapan baris, ±1690–1760 penulisan bon, `CreateTransactionInput`)
- Modify: `server/routers.ts` (`transactions.create` menerima `rateDeviationReason`)
- Test: `server/rateDeviationReview.test.ts`

**Interfaces:**
- Consumes: `matchTier`, `normalizeDenominationValue` (Tugas 2); `rateDeviationPercent`, `exceedsTolerance`, `deviationRejectionMessage`, `RATE_DEVIATION_REVIEW_REASON` (Tugas 8).
- Produces:
  - `type ActiveRateForPricing = { id: number; currencyId: number; rateTierId: number | null; buyRate: string; sellRate: string; quoteUnit: string }`
  - `type PricedEntry = { currencyId: number; currencyCode: string; denominationValue: string; agreedRate: string }`
  - `type DenominationReference = { operationalRateId: number | null; referenceRateSnapshot: string | null; rateDeviationPercent: string | null }`
  - `resolveDenominationReference(entry: PricedEntry, operation: "BUY" | "SELL", tiers: readonly RateTierRow[], activeRates: readonly ActiveRateForPricing[]): DenominationReference`
  - `assessDenominationDeviations(input: { entries: readonly PricedEntry[]; operation: "BUY" | "SELL"; tiersByCurrency: Map<number, RateTierRow[]>; activeRates: readonly ActiveRateForPricing[]; tolerancePercent: string; reason: string | null }): { references: DenominationReference[]; exceeding: DeviationRow[]; requiresReview: boolean }`
  - `CreateTransactionInput.rateDeviationReason?: string`

- [ ] **Step 1: Tulis uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { assessDenominationDeviations, resolveDenominationReference, type ActiveRateForPricing, type PricedEntry } from "./rateBoard";
import { RATE_DEVIATION_REVIEW_REASON } from "../shared/rateDeviation";
import type { RateTierRow } from "../shared/rateTiers";

const TIERS: RateTierRow[] = [
  { id: 5, currencyId: 1, label: "100", denominationValues: ["100"], sortOrder: 1, active: true },
  { id: 6, currencyId: 1, label: "5–20", denominationValues: ["5", "10", "20"], sortOrder: 2, active: true },
];
const RATES: ActiveRateForPricing[] = [
  { id: 21, currencyId: 1, rateTierId: 5, buyRate: "16290.000000", sellRate: "16400.000000", quoteUnit: "1.000000" },
  { id: 22, currencyId: 1, rateTierId: 6, buyRate: "16100.000000", sellRate: "16250.000000", quoteUnit: "1.000000" },
  { id: 23, currencyId: 1, rateTierId: null, buyRate: "16000.000000", sellRate: "16200.000000", quoteUnit: "1.000000" },
];
const entry = (denominationValue: string, agreedRate: string): PricedEntry => ({ currencyId: 1, currencyCode: "USD", denominationValue, agreedRate });
const ALASAN = "Nasabah lama, harga disepakati manajer konter.";

describe("rujukan per baris pecahan", () => {
  it("memakai kurs kelompok yang memuat nilai mukanya", () => {
    expect(resolveDenominationReference(entry("100.000000", "16290"), "BUY", TIERS, RATES))
      .toEqual({ operationalRateId: 21, referenceRateSnapshot: "16290.000000", rateDeviationPercent: "0.0000" });
  });

  it("memakai kurs jual untuk bon JUAL dan kurs beli untuk bon BELI", () => {
    expect(resolveDenominationReference(entry("100.000000", "16400"), "SELL", TIERS, RATES).referenceRateSnapshot).toBe("16400.000000");
    expect(resolveDenominationReference(entry("100.000000", "16290"), "BUY", TIERS, RATES).referenceRateSnapshot).toBe("16290.000000");
  });

  it("jatuh ke kurs tingkat valuta untuk pecahan tanpa kelompok", () => {
    expect(resolveDenominationReference(entry("2.000000", "16000"), "BUY", TIERS, RATES).operationalRateId).toBe(23);
  });

  it("tanpa kurs aktif, baris pecahan tidak membawa rujukan maupun selisih", () => {
    expect(resolveDenominationReference(entry("100.000000", "16290"), "BUY", TIERS, []))
      .toEqual({ operationalRateId: null, referenceRateSnapshot: null, rateDeviationPercent: null });
  });

  it("satu bon dapat membawa dua rujukan berbeda untuk dua pecahan", () => {
    const seratus = resolveDenominationReference(entry("100.000000", "16290"), "BUY", TIERS, RATES);
    const sepuluh = resolveDenominationReference(entry("10.000000", "16100"), "BUY", TIERS, RATES);
    expect([seratus.operationalRateId, sepuluh.operationalRateId]).toEqual([21, 22]);
  });
});

describe("toleransi selisih pada bon", () => {
  const tiersByCurrency = new Map([[1, TIERS]]);

  it("menerima harga di dalam toleransi tanpa menyalakan tinjauan", () => {
    const result = assessDenominationDeviations({ entries: [entry("100.000000", "16290")], operation: "BUY", tiersByCurrency, activeRates: RATES, tolerancePercent: "0.5000", reason: null });
    expect(result.exceeding).toEqual([]);
    expect(result.requiresReview).toBe(false);
  });

  it("menolak harga di luar toleransi ketika alasannya kosong, menyebut valuta dan pecahannya", () => {
    expect(() => assessDenominationDeviations({ entries: [entry("100.000000", "16485")], operation: "BUY", tiersByCurrency, activeRates: RATES, tolerancePercent: "0.5000", reason: null }))
      .toThrow(/USD 100.*16\.290.*Isi alasan selisih harga/s);
  });

  it("menolak alasan yang lebih pendek dari sepuluh karakter", () => {
    expect(() => assessDenominationDeviations({ entries: [entry("100.000000", "16485")], operation: "BUY", tiersByCurrency, activeRates: RATES, tolerancePercent: "0.5000", reason: "beda" }))
      .toThrow(/Isi alasan selisih harga/);
  });

  it("menerima harga di luar toleransi dengan alasan, dan menandainya untuk tinjauan", () => {
    const result = assessDenominationDeviations({ entries: [entry("100.000000", "16485")], operation: "BUY", tiersByCurrency, activeRates: RATES, tolerancePercent: "0.5000", reason: ALASAN });
    expect(result.requiresReview).toBe(true);
    expect(result.exceeding).toHaveLength(1);
    expect(result.exceeding[0].deviationPercent).toBe("1.1970");
  });

  it("tidak memeriksa toleransi untuk valuta tanpa kurs aktif", () => {
    const result = assessDenominationDeviations({ entries: [entry("100.000000", "99999")], operation: "BUY", tiersByCurrency, activeRates: [], tolerancePercent: "0.5000", reason: null });
    expect(result.requiresReview).toBe(false);
    expect(result.references[0].rateDeviationPercent).toBeNull();
  });

  it("menyalakan alasan tinjauan yang sama dengan yang dibaca antrean", () => {
    expect(RATE_DEVIATION_REVIEW_REASON).toBe("SELISIH_KURS_MELEBIHI_TOLERANSI");
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run server/rateDeviationReview.test.ts`
Expected: FAIL — `resolveDenominationReference is not a function`.

- [ ] **Step 3: Tulis kedua fungsi murni di `server/rateBoard.ts`**

```ts
import { deviationRejectionMessage, exceedsTolerance, rateDeviationPercent, type DeviationRow } from "../shared/rateDeviation";
import { matchTier, normalizeDenominationValue } from "../shared/rateTiers";
// `ACTIVATION_REASON_MIN_LENGTH` sudah dideklarasikan di berkas ini (Tugas 3); alasan aktivasi kurs
// dan alasan selisih harga sengaja memakai batas panjang yang sama.

export type ActiveRateForPricing = { id: number; currencyId: number; rateTierId: number | null; buyRate: string; sellRate: string; quoteUnit: string };
export type PricedEntry = { currencyId: number; currencyCode: string; denominationValue: string; agreedRate: string };
export type DenominationReference = { operationalRateId: number | null; referenceRateSnapshot: string | null; rateDeviationPercent: string | null };

/**
 * Rujukan dicari **per pecahan**, bukan per valuta: satu bon dapat memuat USD 100 (kelompok "100") dan
 * USD 10 (kelompok "5–20"), dan kedua baris itu berhak atas kurs papannya masing-masing. Pecahan yang
 * tidak masuk kelompok mana pun memakai kurs tingkat valuta bila ada.
 */
export function resolveDenominationReference(entry: PricedEntry, operation: "BUY" | "SELL", tiers: readonly RateTierRow[], activeRates: readonly ActiveRateForPricing[]): DenominationReference {
  const value = normalizeDenominationValue(entry.denominationValue);
  const tier = matchTier(tiers, value);
  const forCurrency = activeRates.filter((rate) => rate.currencyId === entry.currencyId);
  const rate = (tier ? forCurrency.find((row) => row.rateTierId === tier.id) : undefined)
    ?? forCurrency.find((row) => row.rateTierId === null)
    ?? null;
  if (!rate) return { operationalRateId: null, referenceRateSnapshot: null, rateDeviationPercent: null };
  const reference = operation === "BUY" ? rate.buyRate : rate.sellRate;
  return { operationalRateId: rate.id, referenceRateSnapshot: reference, rateDeviationPercent: rateDeviationPercent(entry.agreedRate, reference) };
}

/**
 * Dihitung di server pada saat simpan, tidak pernah dipercaya dari klien: kurs dapat diaktifkan
 * antara bon dibuka dan bon disimpan, dan yang berlaku adalah kurs saat simpan.
 */
export function assessDenominationDeviations(input: {
  entries: readonly PricedEntry[];
  operation: "BUY" | "SELL";
  tiersByCurrency: Map<number, RateTierRow[]>;
  activeRates: readonly ActiveRateForPricing[];
  tolerancePercent: string;
  reason: string | null;
}) {
  const references: DenominationReference[] = [];
  const exceeding: DeviationRow[] = [];
  for (const entry of input.entries) {
    const reference = resolveDenominationReference(entry, input.operation, input.tiersByCurrency.get(entry.currencyId) ?? [], input.activeRates);
    references.push(reference);
    if (reference.referenceRateSnapshot && exceedsTolerance(reference.rateDeviationPercent, input.tolerancePercent)) {
      exceeding.push({
        currencyCode: entry.currencyCode, denominationValue: entry.denominationValue,
        agreedRate: entry.agreedRate, referenceRate: reference.referenceRateSnapshot,
        deviationPercent: reference.rateDeviationPercent as string,
      });
    }
  }
  const reason = input.reason?.trim() ?? "";
  if (exceeding.length && reason.length < ACTIVATION_REASON_MIN_LENGTH) throw new Error(deviationRejectionMessage(exceeding, input.tolerancePercent));
  return { references, exceeding, requiresReview: exceeding.length > 0 };
}
```

- [ ] **Step 4: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run server/rateDeviationReview.test.ts`
Expected: PASS, 12 uji.

- [ ] **Step 5: Sambungkan ke `createTransaction`**

Di `server/operations.ts`:

1. `CreateTransactionInput` menerima `rateDeviationReason?: string`.
2. Pada penyiapan baris (±1535), selain `activeRatesByCurrency` yang sudah ada, baca kelompok aktif dan seluruh kurs ACTIVE **beserta `rateTierId`-nya**, lalu simpan `tiersByCurrency: Map<number, RateTierRow[]>` dan `activeRates: ActiveRateForPricing[]`.
3. Sesudah `preparedLines` tersusun, kumpulkan seluruh baris pecahannya menjadi `PricedEntry[]` (memakai `currencyById` untuk `currencyCode`), baca toleransi lewat `getReviewThreshold()`, lalu:

```ts
    const { assessDenominationDeviations } = await import("./rateBoard");
    const { rateDeviationTolerancePercent } = await getReviewThreshold();
    const deviation = assessDenominationDeviations({
      entries: pricedEntries, operation: input.operation, tiersByCurrency, activeRates,
      tolerancePercent: rateDeviationTolerancePercent, reason: input.rateDeviationReason ?? null,
    });
```

4. `requiresReview` dan `reviewReason` (±1690) memasukkan hasilnya lewat daftar alasan yang sudah ada — **tanpa menulis ulang aturan `assessTransactionRisk`**:

```ts
  const requiresReview = assessment.requiresReview || Boolean(input.isSuspiciousTransaction) || deviation.requiresReview;
  const reviewReason = [
    assessment.reviewReason,
    input.isSuspiciousTransaction ? "TRANSAKSI_MENCURIGAKAN_TKM" : null,
    deviation.requiresReview ? RATE_DEVIATION_REVIEW_REASON : null,
  ].filter(Boolean).join("; ") || null;
```

5. Header bon menyimpan `rateDeviationReason: deviation.requiresReview ? (input.rateDeviationReason?.trim() ?? null) : null`.
6. Penulisan baris pecahan (±1743) menyertakan `operationalRateId`, `referenceRateSnapshot`, dan `rateDeviationPercent` dari `deviation.references` **pada urutan yang sama** dengan `pricedEntries`. Susun `pricedEntries` dan barisnya dari satu perulangan yang sama supaya indeksnya tidak dapat bergeser.
7. `writeAudit` pada pembuatan bon (±1759) menambahkan `rateDeviationCount: deviation.exceeding.length`.

Di `server/routers.ts`, input `transactions.create` menerima:

```ts
      rateDeviationReason: z.string().trim().max(1000).optional(),
```

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1576 lulus** (1564 + 12). Uji bon yang sudah ada (`server/createTransactionValidation.test.ts`, `server/operations.test.ts`, `server/v1UseCases.test.ts`) harus tetap lulus tanpa disunting: bon tanpa kurs aktif tidak melewati pemeriksaan toleransi. Bila ada yang gagal, perbaiki implementasinya — **jangan melonggarkan ujinya**.

- [ ] **Step 7: Commit**

```bash
git add server/rateBoard.ts server/rateDeviationReview.test.ts server/operations.ts server/routers.ts
git commit -m "Papan kurs: rujukan dan toleransi selisih per baris pecahan bon

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 10: Label kelompok pada kurs publik

**Files:**
- Modify: `shared/publicRates.ts`
- Modify: `server/operations.ts` (`listPublicActiveRates` ±1221, `selectPublicActiveRateRows` ±1210)
- Modify: `client/src/pages/Home.tsx` (±103), `client/src/pages/ServiceDesk.tsx` (±82)
- Test: `server/publicRates.test.ts`

**Interfaces:**
- Consumes: `OTHER_TIER_LABEL` (Tugas 2).
- Produces: `PublicRateRow` bertambah `tier: { id: number; label: string } | null`; `sortPublicRates` mengurutkan valuta lalu kelompok.

- [ ] **Step 1: Tambahkan uji yang gagal ke `server/publicRates.test.ts`**

```ts
it("menampilkan kelompok pecahan di bawah valutanya, berurutan", () => {
  const withTiers: PublicRateRow[] = [
    { currency: { id: 2, code: "USD", name: "Dolar Amerika Serikat" }, tier: null, rate: { id: 5, buyRate: "16000", sellRate: "16100", quoteUnit: "1", effectiveAt: new Date("2026-09-16T02:00:00.000Z") } },
    { currency: { id: 2, code: "USD", name: "Dolar Amerika Serikat" }, tier: { id: 1, label: "100" }, rate: { id: 6, buyRate: "16290", sellRate: "16400", quoteUnit: "1", effectiveAt: new Date("2026-09-16T02:00:00.000Z") } },
    { currency: { id: 1, code: "AUD", name: "Dolar Australia" }, tier: null, rate: { id: 7, buyRate: "10200", sellRate: "10300", quoteUnit: "1", effectiveAt: new Date("2026-09-16T02:00:00.000Z") } },
  ];
  expect(sortPublicRates(withTiers).map((row) => `${row.currency.code} ${row.tier?.label ?? "-"}`)).toEqual(["AUD -", "USD 100", "USD -"]);
});
```

Baris `PublicRateRow` yang sudah ada di berkas uji ini perlu `tier: null` supaya tetap sesuai tipenya.

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run server/publicRates.test.ts`
Expected: FAIL — urutannya `["AUD -", "USD -", "USD 100"]` atau galat tipe pada `tier`.

- [ ] **Step 3: Perbarui `shared/publicRates.ts`**

```ts
export type PublicRateRow = {
  rate: { id: number; buyRate: string; sellRate: string; quoteUnit: string; effectiveAt: Date };
  currency: { id: number; code: string; name: string };
  /** Kelompok pecahan yang dihargai baris ini; null berarti kurs tingkat valuta. */
  tier: { id: number; label: string } | null;
};

/** Valuta menaik menurut kode; di dalamnya kelompok lebih dahulu daripada baris tingkat valuta, sehingga "Pecahan lain" selalu menjadi baris penutup valutanya. */
export function sortPublicRates(rates: readonly PublicRateRow[]): PublicRateRow[] {
  return [...rates].sort((left, right) =>
    left.currency.code.localeCompare(right.currency.code)
    || Number(left.tier === null) - Number(right.tier === null)
    || (left.tier?.label ?? "").localeCompare(right.tier?.label ?? "", "id"));
}
```

- [ ] **Step 4: Perbarui `listPublicActiveRates`**

`selectPublicActiveRateRows` saat ini menyimpan satu baris per `currencyId` (`seen.has(rate.currencyId)`). Ganti kuncinya menjadi pasangan valuta + kelompok supaya kelompok tidak saling membuang:

```ts
    const key = `${rate.currencyId}:${rate.rateTierId ?? "ALL"}`;
    if (seen.has(key)) return false;
    seen.add(key);
```

dan tipe generiknya bertambah `rateTierId: number | null`. `listPublicActiveRates` menambahkan `leftJoin(rateTiers, eq(operationalRates.rateTierId, rateTiers.id))` dan mengembalikan `tier: tier ? { id: tier.id, label: tier.label } : null` pada setiap baris.

- [ ] **Step 5: Tampilkan kelompoknya di dua layar**

`client/src/pages/Home.tsx`: pada sel nama valuta, tambahkan label kelompok di bawah kodenya — `{row.tier ? row.tier.label : "Pecahan lain"}` — dengan kelas yang sudah dipakai baris itu. **Jangan menambah warna mentah baru**; halaman ini belum dibangun ulang, jadi pakai kelas yang sudah ada di barisnya.

`client/src/pages/ServiceDesk.tsx`: `rateOptions` sudah menyaring per valuta; label pilihannya menjadi `` `${rate.tier?.label ?? "Pecahan lain"} — beli ${rate.rate.buyRate} / jual ${rate.rate.sellRate}` `` supaya petugas tidak memilih kelompok yang salah.

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1577 lulus** (1576 + 1).

- [ ] **Step 7: Commit**

```bash
git add shared/publicRates.ts server/operations.ts server/publicRates.test.ts client/src/pages/Home.tsx client/src/pages/ServiceDesk.tsx
git commit -m "Papan kurs: kelompok pecahan tampil di kurs publik dan Meja Konfirmasi

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 11: Kisi papan kurs di klien

**Files:**
- Create: `shared/rateBoard.ts`, `shared/rateBoard.test.ts`
- Create: `client/src/pages/rates/RateBoardGrid.tsx`
- Test: `client/src/pages/rates/RateBoardGrid.test.tsx`
- Modify: `client/src/designFoundation.ts`

**Interfaces:**
- Consumes: `BoardCellPayload` (Tugas 5); kelas `QUIET_FIELD`, `FOCUS_RING` dari `client/src/components/patterns/tebal.ts`.
- Produces:
  - `type BoardEdits = Record<string, { buyRate?: string; sellRate?: string }>` (kunci `cellKey`)
  - `cellKey(cell: { currencyId: number; rateTierId: number | null }): string`
  - `editedValue(cell: BoardCellPayload, edits: BoardEdits, field: "buyRate" | "sellRate"): string`
  - `cellChanged(cell: BoardCellPayload, edits: BoardEdits): boolean`
  - `type BoardFilter = "SEMUA" | "BERUBAH" | "TANPA_KURS"`
  - `filterBoardCells(cells: readonly BoardCellPayload[], filter: BoardFilter, query: string, edits: BoardEdits): BoardCellPayload[]`
  - `pendingCells(cells: readonly BoardCellPayload[], edits: BoardEdits): BoardCellPayload[]`
  - `<RateBoardGrid cells edits onEdit onCommit />`

- [ ] **Step 1: Tulis uji `shared/rateBoard.test.ts` yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { cellChanged, cellKey, editedValue, filterBoardCells, pendingCells, type BoardEdits } from "./rateBoard";
import type { BoardCellPayload } from "./rateBoard";

const cell = (over: Partial<BoardCellPayload> = {}): BoardCellPayload => ({
  currencyId: 1, currencyCode: "USD", currencyName: "Dolar Amerika Serikat", rateTierId: null, tierLabel: "Pecahan lain", sortOrder: 9999,
  quoteUnit: "1.000000", activeRateId: 21, activeBuyRate: "16290.000000", activeSellRate: "16400.000000", activeEffectiveAt: new Date("2026-09-16T02:00:00Z"),
  draftRateId: null, draftBuyRate: null, draftSellRate: null,
  referenceBuyRate: "16200.000000", referenceSellRate: "16360.000000", referenceSnapshotId: 9, ...over,
});

describe("kunci sel", () => {
  it("membedakan kelompok dari kurs tingkat valuta", () => {
    expect(cellKey({ currencyId: 1, rateTierId: null })).toBe("1:ALL");
    expect(cellKey({ currencyId: 1, rateTierId: 5 })).toBe("1:5");
  });
});

describe("nilai sel", () => {
  it("menampilkan suntingan bila ada, lalu draf, lalu kurs aktif", () => {
    const aktif = cell();
    expect(editedValue(aktif, {}, "buyRate")).toBe("16290.000000");
    expect(editedValue(cell({ draftBuyRate: "16310.000000" }), {}, "buyRate")).toBe("16310.000000");
    expect(editedValue(aktif, { "1:ALL": { buyRate: "16350" } }, "buyRate")).toBe("16350");
  });

  it("sel tanpa kurs sama sekali kosong, bukan nol", () => {
    expect(editedValue(cell({ activeBuyRate: null, activeSellRate: null, activeRateId: null }), {}, "buyRate")).toBe("");
  });
});

describe("sel berubah", () => {
  it("berubah ketika suntingannya berbeda dari kurs aktif", () => {
    expect(cellChanged(cell(), { "1:ALL": { buyRate: "16350" } })).toBe(true);
    expect(cellChanged(cell(), { "1:ALL": { buyRate: "16290.000000" } })).toBe(false);
  });

  it("draf tersimpan yang berbeda dari kurs aktif juga dihitung berubah", () => {
    expect(cellChanged(cell({ draftRateId: 31, draftBuyRate: "16310.000000", draftSellRate: "16400.000000" }), {})).toBe(true);
  });
});

describe("penyaring papan", () => {
  const cells = [cell(), cell({ currencyId: 2, currencyCode: "SGD", currencyName: "Dolar Singapura", activeRateId: null, activeBuyRate: null, activeSellRate: null })];

  it("Semua menampilkan seluruh baris", () => {
    expect(filterBoardCells(cells, "SEMUA", "", {})).toHaveLength(2);
  });

  it("Berubah hanya menampilkan sel yang disunting atau berdraf", () => {
    expect(filterBoardCells(cells, "BERUBAH", "", { "1:ALL": { buyRate: "16350" } }).map((row) => row.currencyCode)).toEqual(["USD"]);
  });

  it("Tanpa kurs hanya menampilkan sel yang belum punya kurs aktif", () => {
    expect(filterBoardCells(cells, "TANPA_KURS", "", {}).map((row) => row.currencyCode)).toEqual(["SGD"]);
  });

  it("pencarian cocok pada kode maupun nama valuta, tanpa peduli huruf besar-kecil", () => {
    expect(filterBoardCells(cells, "SEMUA", "singapura", {}).map((row) => row.currencyCode)).toEqual(["SGD"]);
    expect(filterBoardCells(cells, "SEMUA", "usd", {}).map((row) => row.currencyCode)).toEqual(["USD"]);
  });
});

describe("sel siap diaktifkan", () => {
  it("hanya menghitung sel yang benar-benar berubah", () => {
    const edits: BoardEdits = { "1:ALL": { buyRate: "16350" } };
    expect(pendingCells([cell(), cell({ currencyId: 2, currencyCode: "SGD" })], edits)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run shared/rateBoard.test.ts`
Expected: FAIL — `Failed to resolve import "./rateBoard"`.

- [ ] **Step 3: Tulis `shared/rateBoard.ts`**

`BoardCellPayload` dipindahkan ke berkas ini dan `server/rateBoard.ts` mengimpornya (`export type { BoardCellPayload } from "../shared/rateBoard";`), supaya bentuk baris papan hanya ditulis satu kali.

```ts
export type BoardCellPayload = {
  currencyId: number; currencyCode: string; currencyName: string;
  rateTierId: number | null; tierLabel: string; sortOrder: number; quoteUnit: string;
  activeRateId: number | null; activeBuyRate: string | null; activeSellRate: string | null; activeEffectiveAt: Date | null;
  draftRateId: number | null; draftBuyRate: string | null; draftSellRate: string | null;
  referenceBuyRate: string | null; referenceSellRate: string | null; referenceSnapshotId: number | null;
};
export type RateField = "buyRate" | "sellRate";
export type BoardEdits = Record<string, Partial<Record<RateField, string>>>;
export type BoardFilter = "SEMUA" | "BERUBAH" | "TANPA_KURS";

export function cellKey(cell: { currencyId: number; rateTierId: number | null }): string {
  return `${cell.currencyId}:${cell.rateTierId ?? "ALL"}`;
}

const savedValue = (cell: BoardCellPayload, field: RateField) =>
  (field === "buyRate" ? cell.draftBuyRate ?? cell.activeBuyRate : cell.draftSellRate ?? cell.activeSellRate) ?? "";

/** Suntingan di layar menang atas draf tersimpan, draf menang atas kurs aktif. Sel tanpa sumber apa pun tetap kosong — nol adalah harga, dan harga yang dikarang lebih buruk daripada sel kosong. */
export function editedValue(cell: BoardCellPayload, edits: BoardEdits, field: RateField): string {
  return edits[cellKey(cell)]?.[field] ?? savedValue(cell, field);
}

const sameNumber = (left: string, right: string) => left !== "" && right !== "" && Number(left) === Number(right);

export function cellChanged(cell: BoardCellPayload, edits: BoardEdits): boolean {
  return (["buyRate", "sellRate"] as RateField[]).some((field) => {
    const next = editedValue(cell, edits, field);
    const active = (field === "buyRate" ? cell.activeBuyRate : cell.activeSellRate) ?? "";
    if (next === "") return false;
    return !sameNumber(next, active);
  });
}

export function filterBoardCells(cells: readonly BoardCellPayload[], filter: BoardFilter, query: string, edits: BoardEdits): BoardCellPayload[] {
  const needle = query.trim().toLowerCase();
  return cells.filter((cell) => {
    if (needle && !`${cell.currencyCode} ${cell.currencyName}`.toLowerCase().includes(needle)) return false;
    if (filter === "BERUBAH") return cellChanged(cell, edits);
    if (filter === "TANPA_KURS") return cell.activeRateId === null;
    return true;
  });
}

export function pendingCells(cells: readonly BoardCellPayload[], edits: BoardEdits): BoardCellPayload[] {
  return cells.filter((cell) => cellChanged(cell, edits));
}
```

- [ ] **Step 4: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run shared/rateBoard.test.ts`
Expected: PASS, 10 uji.

- [ ] **Step 5: Tulis uji komponen yang gagal**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RateBoardGrid } from "./RateBoardGrid";
import type { BoardCellPayload } from "@shared/rateBoard";

const cell = (over: Partial<BoardCellPayload> = {}): BoardCellPayload => ({
  currencyId: 1, currencyCode: "USD", currencyName: "Dolar Amerika Serikat", rateTierId: 5, tierLabel: "100", sortOrder: 1,
  quoteUnit: "1.000000", activeRateId: 21, activeBuyRate: "16290.000000", activeSellRate: "16400.000000", activeEffectiveAt: new Date("2026-09-16T02:00:00Z"),
  draftRateId: null, draftBuyRate: null, draftSellRate: null,
  referenceBuyRate: "16200.000000", referenceSellRate: "16360.000000", referenceSnapshotId: 9, ...over,
});
const CELLS = [cell(), cell({ rateTierId: 6, tierLabel: "5–20", sortOrder: 2, activeBuyRate: "16100.000000", activeSellRate: "16250.000000" })];

describe("kisi papan kurs", () => {
  it("menampilkan satu baris per kelompok dengan kolom yang disepakati", () => {
    render(<RateBoardGrid cells={CELLS} edits={{}} onEdit={vi.fn()} onCommit={vi.fn()} />);
    for (const header of ["Valuta", "Kelompok", "Referensi BI", "Beli", "Jual", "Selisih", "Status"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeTruthy();
    }
    expect(screen.getByText("5–20")).toBeTruthy();
  });

  it("menyorot baris dan kolom sel yang sedang difokus", async () => {
    render(<RateBoardGrid cells={CELLS} edits={{}} onEdit={vi.fn()} onCommit={vi.fn()} />);
    const input = screen.getByLabelText("Kurs beli USD 100");
    await userEvent.click(input);
    expect(input.closest("tr")?.getAttribute("data-sorot")).toBe("baris");
    expect(input.closest("td")?.getAttribute("data-sorot")).toBe("sel");
  });

  it("menandai sel yang berubah dan menampilkan nilai lamanya dicoret", () => {
    render(<RateBoardGrid cells={CELLS} edits={{ "1:5": { buyRate: "16350" } }} onEdit={vi.fn()} onCommit={vi.fn()} />);
    const input = screen.getByLabelText("Kurs beli USD 100");
    expect(input.closest("td")?.getAttribute("data-berubah")).toBe("ya");
    expect(screen.getByText("16290", { selector: "del, del *" })).toBeTruthy();
  });

  it("↓ memindahkan fokus ke sel kolom yang sama pada baris berikutnya", async () => {
    render(<RateBoardGrid cells={CELLS} edits={{}} onEdit={vi.fn()} onCommit={vi.fn()} />);
    const atas = screen.getByLabelText("Kurs beli USD 100");
    atas.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByLabelText("Kurs beli USD 5–20"));
  });

  it("Enter menyimpan draf sel yang sedang disunting", async () => {
    const onCommit = vi.fn();
    render(<RateBoardGrid cells={CELLS} edits={{ "1:5": { buyRate: "16350" } }} onEdit={vi.fn()} onCommit={onCommit} />);
    screen.getByLabelText("Kurs beli USD 100").focus();
    await userEvent.keyboard("{Enter}");
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("meneruskan setiap ketikan ke onEdit dengan kunci selnya", async () => {
    const onEdit = vi.fn();
    render(<RateBoardGrid cells={CELLS} edits={{}} onEdit={onEdit} onCommit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Kurs jual USD 100"), "7");
    expect(onEdit).toHaveBeenCalledWith("1:5", "sellRate", expect.stringContaining("7"));
  });
});
```

- [ ] **Step 6: Jalankan uji komponen untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/pages/rates/RateBoardGrid.test.tsx`
Expected: FAIL — `Failed to resolve import "./RateBoardGrid"`.

- [ ] **Step 7: Tulis `RateBoardGrid.tsx`**

Poin yang mengikat: kepala kisi tebal (`bg-ink text-paper`), **garis kisi 2px** `border-2 border-ink` pada `<table>` dan setiap `<td>` (pengecualian intensitas B pada spec §A4), tinggi baris 34px, angka `tabular-nums`, sorot baris + kolom lewat atribut `data-sorot`, sel berubah `data-berubah="ya"` berlatar `bg-warning-soft` dengan nilai lama di dalam `<del>`, dan navigasi `ArrowUp`/`ArrowDown`/`Enter`. Tab dan Shift+Tab dibiarkan pada perilaku bawaan peramban — urutan DOM-nya sudah kiri-ke-kanan per baris.

```tsx
import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { QUIET_FIELD } from "@/components/patterns/tebal";
import { cellChanged, cellKey, editedValue, type BoardCellPayload, type BoardEdits, type RateField } from "@shared/rateBoard";

const FIELDS: RateField[] = ["buyRate", "sellRate"];
const fieldLabel = (field: RateField) => (field === "buyRate" ? "Kurs beli" : "Kurs jual");
const angka = (value: string | null) => (value ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value)) : "—");

/**
 * Kisi harga: garis tebal dan sorot baris + kolom supaya harga tidak salah dibaca (keputusan pengguna
 * #7). Ini satu-satunya tempat di aplikasi yang memakai garis kisi tebal — intensitas B menenangkan
 * baris tabel, dan papan kurs adalah pengecualiannya yang disebut spec §A4.
 */
export function RateBoardGrid({ cells, edits, onEdit, onCommit }: {
  cells: readonly BoardCellPayload[];
  edits: BoardEdits;
  onEdit: (key: string, field: RateField, value: string) => void;
  onCommit: () => void;
}) {
  const [focus, setFocus] = useState<{ row: number; field: RateField } | null>(null);
  const inputId = (key: string, field: RateField) => `sel-${key}-${field}`;

  const move = (event: KeyboardEvent<HTMLInputElement>, row: number, field: RateField) => {
    if (event.key === "Enter") { event.preventDefault(); onCommit(); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const next = event.key === "ArrowDown" ? row + 1 : row - 1;
    const target = cells[next];
    if (!target) return;
    event.preventDefault();
    document.getElementById(inputId(cellKey(target), field))?.focus();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-2 border-ink text-body">
        <caption className="sr-only">Kurs beli dan jual per valuta dan kelompok pecahan</caption>
        <thead className="bg-ink text-label text-paper">
          <tr>
            {["Valuta", "Kelompok", "Referensi BI", "Beli", "Jual", "Selisih", "Status"].map((header, index) => (
              <th key={header} scope="col" className={`h-[34px] border-2 border-ink px-3 font-bold uppercase tracking-wide ${index >= 2 && index <= 5 ? "text-right" : "text-left"}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((cell, row) => {
            const key = cellKey(cell);
            const changed = cellChanged(cell, edits);
            const highlighted = focus?.row === row;
            return (
              <tr key={key} data-sorot={highlighted ? "baris" : undefined} className={`h-[34px] ${highlighted ? "bg-second/20" : ""}`}>
                <th scope="row" className="border-2 border-ink px-3 text-left font-bold text-ink">{cell.currencyCode}</th>
                <td className="border-2 border-ink px-3 text-ink-muted">{cell.tierLabel}</td>
                <td className="border-2 border-ink px-3 text-right tabular-nums text-ink-muted">{angka(cell.referenceBuyRate)} / {angka(cell.referenceSellRate)}</td>
                {FIELDS.map((field) => {
                  const active = field === "buyRate" ? cell.activeBuyRate : cell.activeSellRate;
                  const value = editedValue(cell, edits, field);
                  const cellChangedHere = value !== "" && active !== null && Number(value) !== Number(active);
                  return (
                    <td key={field} data-sorot={focus?.row === row && focus.field === field ? "sel" : undefined} data-berubah={cellChangedHere ? "ya" : undefined}
                        className={`border-2 border-ink px-2 text-right ${cellChangedHere ? "bg-warning-soft" : ""} ${focus?.field === field ? "outline outline-2 -outline-offset-2 outline-ink" : ""}`}>
                      <Input
                        id={inputId(key, field)} aria-label={`${fieldLabel(field)} ${cell.currencyCode} ${cell.tierLabel}`}
                        inputMode="decimal" value={value} className={`${QUIET_FIELD} h-control-sm text-right tabular-nums`}
                        onFocus={() => setFocus({ row, field })} onBlur={() => setFocus(null)}
                        onKeyDown={(event) => move(event, row, field)}
                        onChange={(event) => onEdit(key, field, event.target.value)}
                      />
                      {cellChangedHere ? <del className="mt-0.5 block text-label text-ink-subtle">{angka(active)}</del> : null}
                    </td>
                  );
                })}
                <td className="border-2 border-ink px-3 text-right tabular-nums text-ink-muted">{selisihLabel(cell, edits)}</td>
                <td className="border-2 border-ink px-3 font-semibold text-ink">{cell.activeRateId ? (changed ? "Berubah" : "Berlaku") : "Belum ada kurs"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

`selisihLabel(cell, edits)` adalah pembantu lokal di berkas ini: bila `cell.referenceBuyRate` ada dan sel beli terisi, kembalikan persen selisih terhadap referensi BI memakai `rateDeviationPercent` dari `@shared/rateDeviation` dengan format `id-ID` satu desimal; selain itu `"—"`.

- [ ] **Step 8: Jalankan uji komponen sampai lulus**

Run: `./node_modules/.bin/vitest run client/src/pages/rates/RateBoardGrid.test.tsx`
Expected: PASS, 6 uji.

- [ ] **Step 9: Daftarkan berkas baru pada penjaga warna mentah**

Tambahkan ke `client/src/designFoundation.ts`:

```ts
  "client/src/pages/rates/RateBoardGrid.tsx",
```

- [ ] **Step 10: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1593 lulus** (1577 + 10 + 6). Penjaga `designFoundation.guard.test.ts` tetap lulus — bila ia gagal, ada warna mentah di kisi; ganti dengan token.

- [ ] **Step 11: Commit**

```bash
git add shared/rateBoard.ts shared/rateBoard.test.ts client/src/pages/rates/RateBoardGrid.tsx client/src/pages/rates/RateBoardGrid.test.tsx client/src/designFoundation.ts server/rateBoard.ts
git commit -m "Papan kurs: kisi harga dengan sorot baris dan kolom

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 12: Halaman `/operasional/kurs` yang baru

Mengganti isi `client/src/pages/Rates.tsx` (±10 kartu bertumpuk). **URL dan rute di `App.tsx:77` tidak berubah.** Pembanding pasar, sinkronisasi BI, dan ambang **dipindahkan**, bukan dibuang.

**Files:**
- Create: `client/src/pages/rates/RateBoardFooter.tsx`, `client/src/pages/rates/RateTierDialog.tsx`, `client/src/pages/rates/RateReferencePanel.tsx`
- Test: `client/src/pages/rates/RateBoardFooter.test.tsx`
- Modify: `client/src/pages/Rates.tsx`, `client/src/designFoundation.ts`

**Interfaces:**
- Consumes: `trpc.rates.board`, `trpc.rates.saveBoardDrafts`, `trpc.rates.activateBoard`, `trpc.rates.discardBoardDrafts`, `trpc.rates.copyActiveToDrafts`, `trpc.rates.suggestFromReference`, `trpc.rateTiers.save`, `trpc.rateTiers.deactivate`, `trpc.currencies.ensure`, `trpc.rates.comparison`, `trpc.rates.syncStatus`, `trpc.rates.syncNow`, `trpc.settings.reviewThreshold`, `trpc.settings.updateReviewThreshold`; `filterBoardCells`, `pendingCells`, `cellKey` (Tugas 11); `PageHeader`, `StatTile`, `LoadingState`/`EmptyState`/`ErrorState`, `BOLD_BUTTON`/`OUTLINE_BUTTON`/`QUIET_FIELD`; `operationalActionError` dari `@/lib/rateActionError`.
- Produces: `<RateBoardFooter pendingCount reason onReasonChange onDiscard onActivate isPending />`, `<RateTierDialog currencyId currencyCode tiers open onOpenChange />`, `<RateReferencePanel />`.

- [ ] **Step 1: Tulis uji bilah bawah yang gagal**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RateBoardFooter } from "./RateBoardFooter";

describe("bilah aktivasi", () => {
  it("menyebut jumlah kurs yang siap diaktifkan", () => {
    render(<RateBoardFooter pendingCount={26} reason="" onReasonChange={vi.fn()} onDiscard={vi.fn()} onActivate={vi.fn()} isPending={false} />);
    expect(screen.getByRole("button", { name: "Aktifkan 26 kurs" })).toBeTruthy();
  });

  it("menonaktifkan tombol sampai alasannya mencapai sepuluh karakter", async () => {
    const onActivate = vi.fn();
    const { rerender } = render(<RateBoardFooter pendingCount={3} reason="naik" onReasonChange={vi.fn()} onDiscard={vi.fn()} onActivate={onActivate} isPending={false} />);
    expect(screen.getByRole("button", { name: "Aktifkan 3 kurs" }).hasAttribute("disabled")).toBe(true);
    rerender(<RateBoardFooter pendingCount={3} reason="Kurs pagi mengikuti referensi BI." onReasonChange={vi.fn()} onDiscard={vi.fn()} onActivate={onActivate} isPending={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Aktifkan 3 kurs" }));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("tidak muncul sama sekali ketika belum ada yang berubah", () => {
    const { container } = render(<RateBoardFooter pendingCount={0} reason="" onReasonChange={vi.fn()} onDiscard={vi.fn()} onActivate={vi.fn()} isPending={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("membuang draf lewat tombolnya sendiri", async () => {
    const onDiscard = vi.fn();
    render(<RateBoardFooter pendingCount={2} reason="" onReasonChange={vi.fn()} onDiscard={onDiscard} onActivate={vi.fn()} isPending={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Buang draf" }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/pages/rates/RateBoardFooter.test.tsx`
Expected: FAIL — `Failed to resolve import "./RateBoardFooter"`.

- [ ] **Step 3: Tulis `RateBoardFooter.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";

const MIN_ALASAN = 10;

/** Bilah menempel di bawah papan. Aktivasi kurs selalu menuntut alasan yang dapat ditelusuri — tombolnya mati sampai alasannya cukup panjang, dan itu aturan operasional, bukan sekadar validasi formulir. */
export function RateBoardFooter({ pendingCount, reason, onReasonChange, onDiscard, onActivate, isPending }: {
  pendingCount: number; reason: string; onReasonChange: (value: string) => void;
  onDiscard: () => void; onActivate: () => void; isPending: boolean;
}) {
  if (!pendingCount) return null;
  const tooShort = reason.trim().length < MIN_ALASAN;
  return (
    <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-end gap-3 border-t-2 border-ink bg-surface-raised px-gutter py-3 shadow-hard">
      <p className="font-heading text-body font-extrabold text-ink">{pendingCount} kurs siap diaktifkan</p>
      <div className="min-w-64 flex-1">
        <label className="text-label font-bold uppercase tracking-wide text-ink-muted" htmlFor="alasan-aktivasi">Alasan aktivasi</label>
        <Textarea id="alasan-aktivasi" rows={2} value={reason} onChange={(event) => onReasonChange(event.target.value)}
          className={`${QUIET_FIELD} mt-1`} placeholder="Mis. Kurs pagi 16 September, mengikuti pergerakan referensi BI." />
        {tooShort ? <p className="mt-1 text-label text-ink-muted">Isi alasan minimal {MIN_ALASAN} karakter — alasan ini tersimpan pada setiap kurs yang diaktifkan.</p> : null}
      </div>
      <Button variant="outline" className={OUTLINE_BUTTON} onClick={onDiscard} disabled={isPending}>Buang draf</Button>
      <Button className={BOLD_BUTTON} onClick={onActivate} disabled={tooShort || isPending}>Aktifkan {pendingCount} kurs</Button>
    </div>
  );
}
```

- [ ] **Step 4: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run client/src/pages/rates/RateBoardFooter.test.tsx`
Expected: PASS, 4 uji.

- [ ] **Step 5: Tulis `RateTierDialog.tsx`**

Dialog per valuta memakai `Dialog` dari `@/components/ui/dialog`: daftar kelompok aktif (label, nilai muka, tombol "Nonaktifkan"), formulir tambah/ubah (label, nilai muka dipilih dari `CURRENCY_DENOMINATIONS[kode]` sebagai kotak centang, urutan), dan kotak alasan yang **muncul hanya** ketika kelompok yang dinonaktifkan masih punya kurs aktif. Tombol simpan memanggil `trpc.rateTiers.save`, nonaktifkan memanggil `trpc.rateTiers.deactivate`, keduanya membatalkan `utils.rates.board.invalidate()`. Galat ditampilkan lewat `toast.error(operationalActionError(error))` — pola yang sudah dipakai `Rates.tsx` hari ini.

- [ ] **Step 6: Tulis `RateReferencePanel.tsx`**

`Collapsible` dari `@/components/ui/collapsible`, judul "Referensi & pengaturan", tertutup secara bawaan. Isinya **dipindahkan apa adanya** dari `Rates.tsx` lama: status sinkronisasi BI + tombol "Sinkronkan sekarang" (`rates.syncNow`), tabel `rates.comparison`, formulir observasi pasar (`rates.recordObservation`), peringatan volatilitas (`rates.volatilityAlerts` + `rates.resolveVolatilityAlert`), dan formulir ambang — sekarang dengan satu kolom tambahan **"Toleransi selisih harga bon (%)"** yang menulis `rateDeviationTolerancePercent`.

- [ ] **Step 7: Tulis ulang `client/src/pages/Rates.tsx`**

Susunan dari atas ke bawah, memakai pola sub-proyek 1:

1. `<PageHeader title="Kurs berapa hari ini?" officialLabel="Kurs operasional" description="Isi seluruh kurs sekaligus, lalu aktifkan dengan alasan." actions={…} />` dengan tiga tombol: "Salin kurs kemarin" (`rates.copyActiveToDrafts`), "Isi saran dari referensi BI" (`rates.suggestFromReference`), "+ Tambah valuta" (`CurrencyPicker` + `trpc.currencies.ensure`, katalog 151 valuta di `shared/worldCurrencies.ts`).
2. Tiga `<StatTile>`: **Berlaku sekarang** (`tone="brand"`, nilai = jumlah kurs aktif, hint = waktu batch terakhir dan penyetujunya), **Belum diaktifkan** (`tone="second"`, nilai = `pendingCells(...).length`), **Perlu perhatian** (nilai = `board.alerts.length`).
3. **Riwayat hari ini**: `<DataTable>` dari `board.batchesToday` — kolom Waktu, Jumlah kurs, Alasan. Kosong → `<EmptyState title="Belum ada aktivasi kurs hari ini" nextStep="Isi kursnya di papan bawah, lalu aktifkan dengan alasan." />`.
4. Penyaring: tiga tombol "Semua · Berubah · Tanpa kurs" (`BoardFilter`) dan satu `Input` pencarian kode/nama valuta.
5. `<RateBoardGrid cells={filterBoardCells(board.cells, filter, query, edits)} … />`. `onEdit` menulis state `edits`; `onCommit` memanggil `rates.saveBoardDrafts` dengan hasil `pendingCells` dan mengosongkan `edits` pada keberhasilan.
6. `<RateBoardFooter pendingCount={pendingCells(board.cells, edits).length} … />` — `onActivate` memanggil `rates.activateBoard`, lalu `utils.rates.board.invalidate()` dan `utils.rates.activeRates.invalidate()`.
7. `<RateReferencePanel />`.

Keadaan halaman: `isLoading` → `<LoadingState rows={6} label="Memuat papan kurs" />`; `isError` → `<ErrorState what="Papan kurs tidak dapat dimuat." nextStep="Periksa sambungan lalu coba lagi." onRetry={refetch} />`; papan tanpa satu pun valuta → `<EmptyState title="Belum ada valuta aktif" nextStep="Tambahkan valuta lebih dahulu lewat tombol + Tambah valuta." />`.

- [ ] **Step 8: Daftarkan berkas baru pada penjaga warna mentah**

Tambahkan ke `client/src/designFoundation.ts`:

```ts
  "client/src/pages/rates/RateBoardFooter.tsx",
  "client/src/pages/rates/RateTierDialog.tsx",
  "client/src/pages/rates/RateReferencePanel.tsx",
  "client/src/pages/Rates.tsx",
```

- [ ] **Step 9: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1597 lulus** (1593 + 4). `designFoundation.guard.test.ts` menolak warna mentah pada keempat berkas baru — bila gagal, ganti dengan token.

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/Rates.tsx client/src/pages/rates client/src/designFoundation.ts
git commit -m "Papan kurs: satu layar untuk mengisi dan mengaktifkan kurs harian

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 13: Bon — harga terisi otomatis dari papan dan alasan selisih

**Files:**
- Modify: `client/src/pages/TransactionCreate.tsx` (`referenceRateFor` ±40, baris pecahan ±363–380, `payload` ±289)
- Test: `client/src/pages/rates/tierPricing.test.ts`

**Interfaces:**
- Consumes: `trpc.rates.board` (Tugas 5), `matchTier` (Tugas 2), `rateDeviationPercent`/`exceedsTolerance` (Tugas 8), `trpc.settings.reviewThreshold`.
- Produces: `suggestDenominationRate(board: { cells: BoardCellPayload[] }, tiers: RateTierRow[], currencyId: number, operation: "BUY" | "SELL", denominationValue: string): string | null` di `client/src/pages/rates/tierPricing.ts`.

- [ ] **Step 1: Tulis uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { suggestDenominationRate } from "./tierPricing";
import type { BoardCellPayload } from "@shared/rateBoard";
import type { RateTierRow } from "@shared/rateTiers";

const TIERS: RateTierRow[] = [{ id: 5, currencyId: 1, label: "100", denominationValues: ["100"], sortOrder: 1, active: true }];
const cell = (rateTierId: number | null, buy: string, sell: string): BoardCellPayload => ({
  currencyId: 1, currencyCode: "USD", currencyName: "Dolar Amerika Serikat", rateTierId, tierLabel: rateTierId ? "100" : "Pecahan lain", sortOrder: 1,
  quoteUnit: "1.000000", activeRateId: rateTierId ?? 99, activeBuyRate: buy, activeSellRate: sell, activeEffectiveAt: new Date(),
  draftRateId: null, draftBuyRate: null, draftSellRate: null, referenceBuyRate: null, referenceSellRate: null, referenceSnapshotId: null,
});
const CELLS = [cell(5, "16290.000000", "16400.000000"), cell(null, "16000.000000", "16200.000000")];

describe("harga pecahan dari papan", () => {
  it("BELI memakai kurs beli kelompok yang memuat pecahannya", () => {
    expect(suggestDenominationRate({ cells: CELLS }, TIERS, 1, "BUY", "100")).toBe("16290.000000");
  });

  it("JUAL memakai kurs jual kelompok itu", () => {
    expect(suggestDenominationRate({ cells: CELLS }, TIERS, 1, "SELL", "100")).toBe("16400.000000");
  });

  it("pecahan tanpa kelompok jatuh ke kurs tingkat valuta", () => {
    expect(suggestDenominationRate({ cells: CELLS }, TIERS, 1, "BUY", "10")).toBe("16000.000000");
  });

  it("valuta tanpa kurs aktif tidak diisi sama sekali", () => {
    expect(suggestDenominationRate({ cells: [] }, TIERS, 1, "BUY", "100")).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `./node_modules/.bin/vitest run client/src/pages/rates/tierPricing.test.ts`
Expected: FAIL — `Failed to resolve import "./tierPricing"`.

- [ ] **Step 3: Tulis `client/src/pages/rates/tierPricing.ts`**

```ts
import { matchTier, type RateTierRow } from "@shared/rateTiers";
import { cellKey, type BoardCellPayload } from "@shared/rateBoard";

/**
 * Harga yang **diusulkan** ke kasir, bukan harga otoritatif: server menghitung ulang rujukannya saat
 * simpan (kurs dapat berubah di antaranya). Null berarti tidak ada kurs papan — kolomnya dibiarkan
 * kosong supaya kasir mengetiknya sendiri, persis seperti sebelum papan ada.
 */
export function suggestDenominationRate(
  board: { cells: readonly BoardCellPayload[] },
  tiers: readonly RateTierRow[],
  currencyId: number,
  operation: "BUY" | "SELL",
  denominationValue: string,
): string | null {
  const tier = matchTier(tiers.filter((row) => row.currencyId === currencyId), denominationValue);
  const wanted = cellKey({ currencyId, rateTierId: tier?.id ?? null });
  const fallback = cellKey({ currencyId, rateTierId: null });
  const cell = board.cells.find((row) => cellKey(row) === wanted && row.activeRateId)
    ?? board.cells.find((row) => cellKey(row) === fallback && row.activeRateId);
  if (!cell) return null;
  return operation === "BUY" ? cell.activeBuyRate : cell.activeSellRate;
}
```

`rateTiers` belum ikut pada muatan `rates.board`; tambahkan `tiers: RateTierRow[]` ke `RateBoardPayload` di `readRateBoard` (kelompok aktif yang sudah dibaca di sana) sehingga klien tidak perlu kueri kedua.

- [ ] **Step 4: Jalankan uji sampai lulus**

Run: `./node_modules/.bin/vitest run client/src/pages/rates/tierPricing.test.ts`
Expected: PASS, 4 uji.

- [ ] **Step 5: Sambungkan ke formulir bon**

Di `client/src/pages/TransactionCreate.tsx`:

1. Ganti `trpc.rates.listOperational` menjadi `trpc.rates.board` dengan `refetchOnWindowFocus: true` — data papan disegarkan saat formulir difokus (spec §B3).
2. Setiap kali nilai pecahan sebuah baris berubah dan kolom harganya masih kosong, isi dengan `suggestDenominationRate(board, board.tiers, line.currency.id, operation, row.value)`. **Harga yang sudah diketik kasir tidak pernah ditimpa.**
3. Di bawah tiap baris pecahan, tampilkan selisihnya terhadap papan memakai `rateDeviationPercent`; bila `exceedsTolerance(..., tolerance)` benar, beri penanda `text-warning` dan kalimat "Di luar toleransi ±X% — isi alasan selisih harga di bawah."
4. Kolom **"Alasan selisih harga"** (`Textarea`) muncul hanya ketika ada minimal satu baris di luar toleransi, dan dikirim sebagai `rateDeviationReason` pada `payload`.
5. Tombol kirim tetap aktif; **penolakan tetap milik server** — klien tidak boleh menjadi satu-satunya penjaga. Galat server ditampilkan apa adanya lewat `toast.error(...)`, karena pesannya sudah menyebut valuta, pecahan, harga papan, dan batasnya.
6. `usdOutletRate` (±127) yang mencari kurs USD aktif dibaca ulang dari `board.cells` — pakai sel kurs tingkat valuta USD (`rateTierId === null`), lalu sel USD mana pun yang aktif bila tidak ada.

- [ ] **Step 6: Perintah mutu**

Run: `./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
Expected: **1601 lulus** (1597 + 4).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/TransactionCreate.tsx client/src/pages/rates/tierPricing.ts client/src/pages/rates/tierPricing.test.ts server/rateBoard.ts
git commit -m "Bon: harga pecahan terisi dari papan kurs dengan alasan selisih

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 14: Peragaan end-to-end, verifikasi peramban, dokumentasi, penutupan

Verifikasi visual yang berhenti pada halaman kosong belum membuktikan apa pun. Kedelapan skenario spec §B6 diperagakan di basis data lokal `moneychanger` — membuat data uji di sana diizinkan tanpa meminta izin lebih dulu.

**Files:**
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` (§5.2 Pemeriksaan Kurs ±108–114, tabel menu ±72–73, langkah bon ±141)
- Modify: `docs/SKEMA-DATABASE-PROJECT.md` (baris domain kurs ±14, baris "Harga per pecahan" ±57)
- Modify: `docs/superpowers/plans/2026-09-16-papan-kurs.md` (centang seluruh tugas)
- Modify: `todo-jp0taelo.md`

- [ ] **Step 1: Siapkan data peragaan di `moneychanger`**

Jalankan aplikasi lokal, masuk sebagai ADMIN, lalu **lewat layar** (bukan SQL): buka `/operasional/kurs`, tambahkan valuta USD bila belum ada, dan buat tiga kelompok USD lewat dialog kelompok — "100" (nilai 100), "50" (nilai 50), "5–20" (nilai 5, 10, 20).

- [ ] **Step 2: Skenario 1 dan 2 — pagi dan siang**

1. Tekan "Salin kurs kemarin" (atau "Isi saran dari referensi BI" bila belum ada kurs aktif), ubah 5 sel, isi alasan, tekan "Aktifkan N kurs".
2. Periksa: `SELECT activationBatchId, COUNT(*) FROM operational_rates WHERE status='ACTIVE' GROUP BY activationBatchId;` — seluruh kurs pagi berada dalam **satu** batch.
3. Ubah tiga kelompok USD saja, aktifkan lagi dengan alasan berbeda.
4. Periksa: kurs USD tingkat valuta dan valuta lain **tidak** berubah statusnya; hanya ketiga kelompok itu yang RETIRED/ACTIVE.

- [ ] **Step 3: Skenario 3 dan 4 — kegagalan tidak boleh separuh**

1. Buat tiga draf, lalu di sesi kedua aktifkan salah satunya sehingga draf ketiga tidak lagi DRAFT. Tekan "Aktifkan" pada papan pertama.
2. Harapan: galat menyebut **valuta dan kelompok** yang gagal, dan `SELECT COUNT(*) FROM operational_rates WHERE status='ACTIVE' AND activationBatchId=…` menunjukkan **tidak ada** kurs baru yang aktif dari batch itu.
3. Di dialog kelompok, coba masukkan nilai muka 100 ke dua kelompok USD sekaligus. Harapan: ditolak dengan pesan yang menyebut kedua label kelompoknya.

- [ ] **Step 4: Skenario 5, 6, dan 8 — bon**

1. Buat bon JUAL USD 100 × 5 dengan harga persis kurs papan. Harapan: tersimpan tanpa tinjauan; sisi Rupiah dan stok pecahan bergerak seperti sebelumnya (periksa `cash_denomination_balances` sebelum dan sesudah).
2. Buat bon BELI USD dengan harga 1,2% dari papan **tanpa** alasan. Harapan: ditolak, pesannya menyebut valuta, pecahan, harga papan, dan batasnya.
3. Ulangi dengan alasan ≥ 10 karakter. Harapan: tersimpan, `requiresReview = 1`, dan `reviewReason` memuat `SELISIH_KURS_MELEBIHI_TOLERANSI`; bonnya terlihat di antrean tinjauan.
4. Buat satu bon yang memuat USD 100 (kelompok "100") **dan** USD 10 (tanpa kelompok). Periksa `SELECT denominationValue, operationalRateId, referenceRateSnapshot, rateDeviationPercent FROM exchange_transaction_denomination_entries WHERE transactionId = …` — kedua baris membawa `operationalRateId` yang **berbeda**.

- [ ] **Step 5: Skenario 7 — kurs berubah di tengah**

Buka formulir bon, lalu di tab kedua aktifkan kurs baru untuk valuta itu, lalu simpan bon dari tab pertama. Harapan: `referenceRateSnapshot` pada baris pecahannya adalah kurs yang aktif **saat simpan**, bukan kurs yang terlihat saat formulir dibuka.

- [ ] **Step 6: Verifikasi peramban pada tiga ukuran**

Pada 1280×800, 1440×900, dan 1920×1080, buka `/operasional/kurs` dan ambil tangkapan layar tiap ukuran. Periksa: tidak ada gulir mendatar yang tidak disengaja, bilah bawah tetap menempel, sorot baris + kolom terlihat saat sel difokus, Tab/Shift+Tab dan ↑↓ berpindah sel, dan `h1` halaman terbaca "Kurs berapa hari ini?". Periksa juga tiga keadaan: memuat, kosong, dan galat.

- [ ] **Step 7: Perbarui panduan A–Z**

- §5.2 **Pemeriksaan Kurs** ditulis ulang mengikuti alur papan: buka Kurs Hari Ini → salin kurs kemarin atau isi saran referensi BI → ubah sel yang perlu → isi alasan → Aktifkan N kurs. Kalimat "kurs diaktifkan manual dengan alasan" **tetap**, dan tambahkan bahwa satu aktivasi berlaku serentak: bila satu kurs gagal, tidak ada yang aktif.
- Tambahkan penjelasan **kelompok pecahan**: satu valuta boleh punya beberapa harga (mis. USD 100 · 50 · 5–20), pecahan di luar kelompok mana pun memakai kurs "Pecahan lain".
- Langkah bon (±141) diperbarui: harga tiap baris pecahan kini **terisi otomatis** dari papan sesuai kelompoknya, boleh diubah dalam toleransi yang ditetapkan Admin; di luar toleransi wajib mengisi alasan dan bonnya masuk antrean tinjauan.
- Tabel menu (±72) tetap menunjuk "Kurs Hari Ini"; deskripsinya diperbarui menjadi papan seluruh valuta.

- [ ] **Step 8: Perbarui skema database**

Pada baris domain "Mata uang dan kurs" tambahkan `rate_tiers`. Tambahkan satu baris keputusan yang menjelaskan: kelompok pecahan sebagai JSON nilai muka dengan larangan tumpang tindih **ditegakkan server**; `activationBatchId` sebagai penulis data riwayat papan (bukan `audit_logs`); rujukan dan `rateDeviationPercent` yang pindah ke baris pecahan karena satu bon dapat menyentuh beberapa kelompok harga; dan `rateDeviationTolerancePercent` pada `operational_settings`. Perbarui juga baris "Harga per pecahan" (±57) yang hari ini menyebut `operationalRateId`/`referenceRateSnapshot` hanya ada di baris.

- [ ] **Step 9: Perintah mutu terakhir dan review todo**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a; export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
```

Expected: **1601 lulus | 2 dilewati**. Sebutkan angka yang benar-benar terlihat; bila berbeda dari 1601, jelaskan selisihnya sebelum menutup. Lalu baca seluruh `todo-jp0taelo.md`, tandai butir yang benar-benar selesai di sub-proyek ini, dan **jangan** menandai butir yang hanya tersentuh sebagian.

- [ ] **Step 10: Commit penutup**

```bash
git add docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md docs/SKEMA-DATABASE-PROJECT.md docs/superpowers/plans/2026-09-16-papan-kurs.md todo-jp0taelo.md
git commit -m "Papan kurs: peragaan end-to-end, panduan A-Z, dan skema database

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Risiko Residual yang Dibawa Rencana Ini

1. **`exchange_transaction_lines.agreedRate` tetap rata-rata tertimbang.** Bon yang memuat dua kelompok harga dalam satu valuta menghasilkan satu baris dengan kurs rata-rata; harga sesungguhnya tetap hanya ada di baris pecahan. Kwitansi cetak belum menyebut kelompoknya — perubahan cetakan berada di luar cakupan ini.
2. **Seri uang kertas (lama/baru) belum dapat dihargai** (spec §B4). Selisih harga karena seri tetap diketik pada bon, dalam toleransi atau dengan alasan.
3. **Toleransi berlaku dua arah dengan satu angka untuk seluruh valuta.** Outlet yang ingin batas berbeda per valuta belum terlayani.
4. **Bon lama tidak memiliki rujukan per pecahan.** Kolom barunya kosong pada baris yang ditulis sebelum migrasi `0059`; laporan apa pun yang membacanya harus memperlakukan NULL sebagai "tidak diketahui", bukan nol.
5. **Papan membaca kurs ACTIVE tanpa menyaring `effectiveAt`.** `listPublicActiveRates` menyaring `effectiveAt <= now`, papan tidak — kurs bertanggal maju akan terlihat sebagai "Berlaku" di papan sebelum tampil di halaman publik. Dibiarkan karena aktivasi selalu menyetel `effectiveAt` saat draf dibuat; bila penjadwalan kurs dibangun kelak, ini yang pertama harus diperbaiki.
6. **Migrasi produksi tetap menumpuk.** `0059` diterapkan hanya ke dua basis data lokal; antrean migrasi produksi adalah pekerjaan tersendiri yang belum direncanakan.
