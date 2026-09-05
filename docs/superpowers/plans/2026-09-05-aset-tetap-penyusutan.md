# Paket E — Aset tetap dan penyusutan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memberi baris Penyusutan pada B0003 sebuah asal — register aset tetap, jadwal garis lurus, jurnal perolehan/penyusutan/pelepasan yang idempoten, dan gerbang yang menolak menutup periode yang penyusutannya belum dijurnal.

**Architecture:** Tiga tabel baru plus dua kolom penanda pada `accounting_periods` dan dua nilai `journalSourceTypes` (migrasi aditif `0048`); satu fungsi jadwal murni di `shared/depreciation.ts` yang melayani aset baru maupun aset warisan dengan satu formula; tiga pemetaan jurnal murni di `shared/journalMapping.ts`; satu berkas server baru `server/fixedAssets.ts` berisi pendaftaran, penyusutan bulanan yang idempoten lewat `(sourceType, sourceReference)`, dan pelepasan; gerbang baru pada `closeAccountingPeriod` dan `postYearEndProfitClosing`; satu halaman Aset Tetap dan satu panel pada tab Periode.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, decimal.js, Zod.

**Spec:** `docs/superpowers/specs/2026-09-05-aset-tetap-penyusutan-design.md`

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu**, supaya sesi
berikutnya tahu harus mulai dari mana tanpa membaca seluruh riwayat.

- [x] Tugas 1 — Migrasi register aset tetap (0048)
- [x] Tugas 2 — Jadwal penyusutan murni di `shared/`
- [x] Tugas 3 — Tiga pemetaan jurnal aset tetap
- [x] Tugas 4 — Batas kapitalisasi dan pendaftaran aset
- [x] Tugas 5 — `buildMonthlyDepreciation`: bukti beban per aset
- [x] Tugas 6 — `postMonthlyDepreciation`: jurnal bulanan yang idempoten
- [x] Tugas 7 — Pelepasan aset
- [x] Tugas 8 — Gerbang penutupan periode dan penutup laba tahunan
- [x] Tugas 9 — Prosedur tRPC dan navigasi
- [x] Tugas 10 — Halaman Aset Tetap dan panel Penyusutan Bulanan
- [ ] Tugas 11 — Skenario menyeluruh dan dokumentasi

Urutannya mengikat: 1 sebelum 4–8; 2 dan 3 sebelum 5; 5 sebelum 6; 6 sebelum 7 dan 8;
9 sebelum 10. Tugas 11 terakhir.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Muat variabel lingkungan lebih dulu:
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Perintah mutu wajib sebelum tugas dianggap selesai: `./node_modules/.bin/vitest run`,
  `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vite build`.
- **Baseline sebelum paket ini, benar-benar dijalankan 5 September 2026 pada commit `da66fb9`:**
  `Test Files 89 passed (89)`, `Tests 618 passed | 2 skipped (620)`. Tugas yang menambah uji akan
  menaikkan angkanya — **sebutkan angka yang benar-benar dilihat, jangan mengarang.**
- `node scripts/tenant.mjs migrate-all` mencakup `moneychanger` dan `mc_t_abcvalas` lewat
  `TENANT_REGISTRY` di `.env`. **Jangan** menjalankan berkas `.sql` langsung lewat klien mysql —
  penanda `--> statement-breakpoint` membuat pernyataan kedua gagal dan jurnal
  `__drizzle_migrations` menjadi tidak konsisten.
- **Jangan menerapkan migrasi ke produksi.** Hanya dua basis data lokal.
- Membuat data uji di basis data lokal memerlukan izin pengguna **pada giliran itu juga**. Seluruh
  uji dalam rencana ini adalah uji Vitest atas fungsi dengan `getDb` dipalsukan, atau uji
  `appRouter` dengan modul operasinya di-mock — tidak menyentuh data nyata.
- Skrip pembersih uji tidak boleh menghapus `audit_logs`.
- Peran `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Otorisasi ditegakkan di tRPC/server, bukan
  disembunyikan di UI. Seluruh prosedur paket ini `controllerProcedure`.
- Uang pada baris jurnal **tepat dua desimal** (`AMOUNT_PATTERN`, `shared/ledger.ts:18`).
  Pembulatan hanya boleh terjadi pada `kumulatif(M)` di `shared/depreciation.ts` — spec bagian 9.
  Tidak ada nilai lain dalam paket ini yang dibulatkan.
- **Tanggal:** setiap nilai yang berasal dari kolom `date` dibaca lewat `calendarDay`
  (`shared/ledger.ts:214`) dan ditulis lewat `dbDate`. **Jangan memakai `isoDay` untuk itu** — ia
  memundurkan tanggal satu hari pada mesin WIB, bug paket K1 yang sudah diperbaiki. Bulan disimpan
  sebagai `varchar(7)` `"YYYY-MM"`, bukan kolom `date`, sehingga jebakan itu tidak berlaku padanya.
- **Jangan menambah akun ke `shared/chartOfAccounts.ts`.** Keempat akun yang dibutuhkan sudah ada:
  1-1510, 1-1520, 6-1700, 7-1400 (plus 1-1320 dan 2-1900 sebagai lawan).
- **Jangan menyentuh sistem kas.** Modul ini tidak pernah menulis `cash_balances`, mutasi kas,
  rincian pecahan, maupun `operational_expenses`.
- Jangan menambahkan penjadwalan otomatis. Manusia menekan tombolnya.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `drizzle/schema.ts` | `fixedAssets`, `fixedAssetDepreciationEntries`, `fixedAssetSettings`; dua kolom `accountingPeriods`; dua nilai `journalSourceTypes` | 1 |
| `drizzle/0048_*.sql` | Migrasi hasil generate | 1 |
| `shared/depreciation.ts` | `monthKey`, `addMonths`, `monthsBetween`, `depreciationSchedule`, `depreciationForMonth` — murni | 2 |
| `shared/depreciation.test.ts` | Uji formula kumulatif, aset warisan, tanah, batas umur | 2 |
| `shared/journalMapping.ts` | `mapFixedAssetAcquisition`, `mapMonthlyDepreciation`, `mapFixedAssetDisposal` | 3 |
| `server/fixedAssetMapping.test.ts` | Uji tabel penuh atas ketiga pemetaan | 3 |
| `server/fixedAssets.ts` | `getFixedAssetSettings`, `updateFixedAssetSettings`, `registerFixedAsset`, `listFixedAssets`, `buildMonthlyDepreciation`, `postMonthlyDepreciation`, `disposeFixedAsset` | 4, 5, 6, 7 |
| `server/fixedAssetRegister.test.ts` | Uji batas kapitalisasi dan pendaftaran | 4 |
| `server/monthlyDepreciation.test.ts` | Uji `buildMonthlyDepreciation` dengan `getDb` dipalsukan | 5 |
| `server/monthlyDepreciationPosting.test.ts` | Uji `postMonthlyDepreciation` dan idempotensinya | 6 |
| `server/fixedAssetDisposal.test.ts` | Uji jurnal pelepasan dan penolakan bulan tertinggal | 7 |
| `server/ledgerOperations.ts` | Gerbang pada `closeAccountingPeriod` | 8 |
| `server/periodClosing.ts` | Gerbang pada `postYearEndProfitClosing` | 8 |
| `server/depreciationGate.test.ts` | Uji kedua penolakan | 8 |
| `server/routers.ts` | Router `fixedAssets` dan dua prosedur pada router `ledger` | 9 |
| `shared/backOfficeNavigation.ts`, `client/src/App.tsx`, `server/backOfficeNavigation.test.ts` | Rute dan menu `/operasional/aset-tetap` | 9 |
| `server/fixedAssets.authorization.test.ts` | Uji otorisasi seluruh prosedur baru | 9 |
| `client/src/pages/AsetTetap.tsx` | Halaman register, pendaftaran, pelepasan | 10 |
| `client/src/pages/BukuBesar.tsx` | Panel Penyusutan Bulanan pada tab Periode | 10 |
| `server/fixedAssetScenario.test.ts` | Skenario perolehan → tiga bulan → pelepasan | 11 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku pengguna dan struktur data yang berubah | 11 |

---

### Task 1: Migrasi register aset tetap (0048)

**Files:**
- Modify: `drizzle/schema.ts` (`journalSourceTypes` ~baris 1208; `accountingPeriods` ~baris 1136; tabel baru di bawah `periodClosingValuations`)
- Create: `drizzle/0048_*.sql` (hasil generate, akhiran acak dari Drizzle)

**Interfaces:**
- Consumes: —
- Produces: tabel `fixed_assets`, `fixed_asset_depreciation_entries`, `fixed_asset_settings`; kolom
  `accountingPeriods.depreciationPostedAt` dan `.depreciationJournalEntryId`; nilai
  `journalSourceTypes` `PEROLEHAN_ASET` dan `PELEPASAN_ASET`. Dipakai tugas 4–11.

- [ ] **Step 1: Tambah dua nilai pada `journalSourceTypes`**

Di `drizzle/schema.ts`, ganti daftarnya menjadi:

```ts
export const journalSourceTypes = [
  "MANUAL",
  "SALDO_AWAL",
  "TRANSAKSI_VALUTA",
  "PENGELUARAN",
  "MUTASI_KAS",
  "MUTASI_BANK",
  "PENYUSUTAN",
  /**
   * Perolehan dan pelepasan aset tetap. Dipisahkan dari `PENYUSUTAN` karena paket F menyusun
   * bagian **investasi** Arus Kas dengan mengenali kedua kejadian ini, dan `sourceType` adalah
   * satu-satunya penanda yang tidak menebak.
   */
  "PEROLEHAN_ASET",
  "PELEPASAN_ASET",
  "REVALUASI_KURS",
  "TUTUP_PERIODE",
] as const;
```

- [ ] **Step 2: Tambah dua kolom pada `accountingPeriods`**

Sisipkan tepat sesudah `profitClosingJournalEntryId`:

```ts
  /**
   * Penanda bahwa penyusutan bulan ini sudah dijurnal.
   *
   * Kolom, bukan hitungan baris: outlet tanpa aset tersusutkan menghasilkan nol baris beban, dan
   * itu keadaan sah yang tetap harus bisa ditutup. Menghitung baris akan mencampur "belum
   * disusutkan" dengan "sudah disusutkan, hasilnya memang kosong".
   */
  depreciationPostedAt: datetime("depreciationPostedAt"),
  depreciationJournalEntryId: int("depreciationJournalEntryId"),
```

- [ ] **Step 3: Tambah tiga tabel**

Tepat di bawah `periodClosingValuations`:

```ts
export const fixedAssetCategories = [
  "TANAH",
  "BANGUNAN",
  "KENDARAAN",
  "PERALATAN_KANTOR",
  "PERANGKAT_KERAS",
  "PERANGKAT_LUNAK",
  "INVENTARIS_LAIN",
] as const;

/**
 * Kelompok penyusutan DJP. **Hanya label asal default umur manfaat**, bukan kebijakan akuntansi:
 * SAK EP Bab 17 menuntut umur manfaat sebenarnya yang ditinjau tahunan, sementara kelompok ini
 * aturan pajak (PMK 72/2023). Karena itu `usefulLifeMonths` disimpan terpisah dan dapat berbeda.
 */
export const fixedAssetTaxGroups = [
  "KELOMPOK_1",
  "KELOMPOK_2",
  "KELOMPOK_3",
  "KELOMPOK_4",
  "BANGUNAN_PERMANEN",
  "BANGUNAN_NON_PERMANEN",
  "TIDAK_DISUSUTKAN",
] as const;

/**
 * Register aset tetap.
 *
 * Baris Penyusutan pada B0003 tidak punya asal sampai tabel ini ada. Setiap beban penyusutan dapat
 * ditelusuri kembali ke satu baris di sini beserta harga perolehan, tanggal, dan umur manfaat yang
 * dipakai menghitungnya — jawaban atas temuan 7.1 pada tingkat baris.
 *
 * `acquisitionJournalEntryId` NULL menandai **aset warisan**: aset yang sudah dimiliki sebelum buku
 * besar ini dipakai, yang saldo 1-1510 dan 1-1520-nya masuk lewat jalur `SALDO_AWAL` yang sudah ada.
 * Register tidak boleh menjadi modul kedua yang menulis saldo awal.
 */
export const fixedAssets = mysqlTable("fixed_assets", {
  id: int("id").autoincrement().primaryKey(),
  /** Nomor inventaris fisik yang tertempel di asetnya; boleh kosong, unik bila diisi. */
  assetCode: varchar("assetCode", { length: 60 }),
  name: varchar("name", { length: 200 }).notNull(),
  category: mysqlEnum("category", fixedAssetCategories).notNull(),
  taxGroup: mysqlEnum("taxGroup", fixedAssetTaxGroups),
  acquisitionDate: date("acquisitionDate").notNull(),
  acquisitionCost: decimal("acquisitionCost", { precision: 24, scale: 2 }).notNull(),
  residualValue: decimal("residualValue", { precision: 24, scale: 2 }).default("0.00").notNull(),
  /** NULL berarti tidak disusutkan. Tanah, dan hanya tanah, secara sah tidak pernah menyusut. */
  usefulLifeMonths: int("usefulLifeMonths"),
  /** Bulan pertama yang boleh dijurnal sistem, "YYYY-MM". Sengaja bukan kolom `date`. */
  firstJournalMonth: varchar("firstJournalMonth", { length: 7 }).notNull(),
  /** Akumulasi yang sudah tercatat sebelum `firstJournalMonth`; nol untuk aset yang baru dibeli. */
  openingAccumulatedDepreciation: decimal("openingAccumulatedDepreciation", { precision: 24, scale: 2 }).default("0.00").notNull(),
  /** NULL menandai aset warisan — lihat keterangan tabel. */
  acquisitionJournalEntryId: int("acquisitionJournalEntryId"),
  status: mysqlEnum("status", ["AKTIF", "DILEPAS"]).default("AKTIF").notNull(),
  disposalDate: date("disposalDate"),
  disposalProceeds: decimal("disposalProceeds", { precision: 24, scale: 2 }),
  disposalJournalEntryId: int("disposalJournalEntryId"),
  disposalNotes: text("disposalNotes"),
  notes: text("notes"),
  recordedByUserId: int("recordedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("fixed_assets_code_uq").on(table.assetCode),
  index("fixed_assets_status_idx").on(table.status, table.acquisitionDate),
  index("fixed_assets_category_idx").on(table.category),
]);

export type FixedAsset = typeof fixedAssets.$inferSelect;

/**
 * Beban penyusutan per aset per bulan yang **benar-benar dijurnal**.
 *
 * Bukan jadwal teoretis: baris hanya ada untuk bulan yang jurnalnya sudah ditulis. Pelepasan
 * membaca akumulasi dari sini, bukan dari jadwalnya, karena bulan yang belum dijurnal belum pernah
 * menyentuh 1-1520 — mengeluarkan lebih banyak daripada yang pernah masuk membuat neracanya tetap
 * seimbang sementara angkanya salah.
 */
export const fixedAssetDepreciationEntries = mysqlTable("fixed_asset_depreciation_entries", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  /** "YYYY-MM". */
  periodMonth: varchar("periodMonth", { length: 7 }).notNull(),
  periodId: int("periodId").notNull(),
  charge: decimal("charge", { precision: 24, scale: 2 }).notNull(),
  accumulatedAfter: decimal("accumulatedAfter", { precision: 24, scale: 2 }).notNull(),
  carryingAfter: decimal("carryingAfter", { precision: 24, scale: 2 }).notNull(),
  journalEntryId: int("journalEntryId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("fixed_asset_depreciation_asset_month_uq").on(table.assetId, table.periodMonth),
  index("fixed_asset_depreciation_month_idx").on(table.periodMonth),
  index("fixed_asset_depreciation_period_idx").on(table.periodId),
]);

/**
 * Kebijakan akuntansi aset tetap. Satu baris, `id = 1`.
 *
 * Sengaja **bukan** kolom pada `operational_settings`: tabel itu menyatakan dirinya "configurable
 * compliance thresholds" dan dibaca `adminProcedure`, sementara batas kapitalisasi menentukan apa
 * yang masuk neraca dan apa yang masuk laba rugi — itu keputusan Controller.
 */
export const fixedAssetSettings = mysqlTable("fixed_asset_settings", {
  id: int("id").autoincrement().primaryKey(),
  capitalisationThresholdIdr: decimal("capitalisationThresholdIdr", { precision: 24, scale: 2 }).default("1000000.00").notNull(),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

- [ ] **Step 4: Hasilkan migrasi**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
./node_modules/.bin/drizzle-kit generate
```

- [ ] **Step 5: Baca SQL yang dihasilkan sebelum menerapkannya**

```bash
cat drizzle/0048_*.sql
```

Harapan: tiga `CREATE TABLE`, dua `ALTER TABLE accounting_periods ADD`, beberapa
`CREATE INDEX`/`UNIQUE INDEX`, dan **satu** `ALTER TABLE journal_entries MODIFY COLUMN sourceType
enum(...)`. Pada `MODIFY COLUMN` itu, hitung nilainya: harus **sebelas** nilai, memuat seluruh
sembilan nilai lama tanpa kecuali ditambah `PEROLEHAN_ASET` dan `PELEPASAN_ASET`.

**Bila ada `DROP`, `TRUNCATE`, `MODIFY COLUMN` pada tabel selain `journal_entries`, atau satu saja
nilai enum lama yang hilang — berhenti dan laporkan.**

- [ ] **Step 6: Terapkan ke dua basis data lokal**

```bash
node scripts/tenant.mjs migrate-all
```
Harapan: kedua tenant (`moneychanger`, `mc_t_abcvalas`) melaporkan migrasi diterapkan.

- [ ] **Step 7: Pastikan tipe dan uji masih bersih**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```
Harapan: tanpa galat; masih 618 lulus, 2 dilewati, 89 berkas.

- [ ] **Step 8: Commit**

```bash
git add drizzle/schema.ts drizzle/0048_*.sql drizzle/meta
git commit -m "Register aset tetap dan penanda penyusutan periode (migrasi 0048)"
```

---

### Task 2: Jadwal penyusutan murni di `shared/`

Fungsi murni tanpa basis data, sehingga dapat diuji sungguhan dan dipakai layar untuk menunjukkan
angka yang **sama persis** dengan yang akan dijurnal server.

**Files:**
- Create: `shared/depreciation.ts`
- Test: `shared/depreciation.test.ts`

**Interfaces:**
- Consumes: `decimal.js` (sudah dipakai `shared/inventoryValuation.ts`).
- Produces:
  - `type DepreciationInput = { acquisitionMonth: string; firstJournalMonth: string; acquisitionCost: string; residualValue: string; usefulLifeMonths: number | null; openingAccumulatedDepreciation: string }`
  - `type DepreciationRow = { month: string; charge: string; accumulated: string; carrying: string }`
  - `monthKey(value: Date | string): string` — `"YYYY-MM"` dari tanggal kolom `date`
  - `addMonths(month: string, count: number): string`
  - `monthsBetween(from: string, to: string): number` — selisih bulan, `to − from`
  - `depreciationSchedule(input: DepreciationInput): DepreciationRow[]`
  - `depreciationForMonth(input: DepreciationInput, month: string): string`
  - Dipakai tugas 5, 6, 7, dan 10.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `shared/depreciation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addMonths, depreciationForMonth, depreciationSchedule, monthKey, monthsBetween } from "./depreciation";

/** Brankas Rp 24.000.000, kelompok 1 (4 tahun = 48 bulan), dibeli 17 Maret 2026. */
const brankas = {
  acquisitionMonth: "2026-03",
  firstJournalMonth: "2026-03",
  acquisitionCost: "24000000.00",
  residualValue: "0.00",
  usefulLifeMonths: 48,
  openingAccumulatedDepreciation: "0.00",
};

describe("aritmetika bulan", () => {
  it("membaca bulan dari kolom date tanpa memundurkan tanggalnya", () => {
    // Tengah malam lokal, bentuk yang benar-benar keluar dari mysql2 pada mesin WIB.
    expect(monthKey(new Date("2026-03-01T00:00:00"))).toBe("2026-03");
    expect(monthKey("2026-12-31")).toBe("2026-12");
  });

  it("menambah bulan melintasi pergantian tahun", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-02", -3)).toBe("2025-11");
  });

  it("menghitung selisih bulan", () => {
    expect(monthsBetween("2026-03", "2026-03")).toBe(0);
    expect(monthsBetween("2026-03", "2027-03")).toBe(12);
    expect(monthsBetween("2027-03", "2026-03")).toBe(-12);
  });
});

describe("jadwal penyusutan garis lurus", () => {
  it("menyusutkan bulan perolehan secara penuh — aturan DJP, keputusan spec 2", () => {
    expect(depreciationForMonth(brankas, "2026-03")).toBe("500000.00");
  });

  it("tidak membebani bulan sebelum perolehan", () => {
    expect(depreciationForMonth(brankas, "2026-02")).toBe("0.00");
  });

  it("berhenti membebani setelah umur manfaat habis", () => {
    // Bulan ke-48 adalah Februari 2030; Maret 2030 sudah di luar umur manfaat.
    expect(depreciationForMonth(brankas, "2030-02")).toBe("500000.00");
    expect(depreciationForMonth(brankas, "2030-03")).toBe("0.00");
  });

  it("menghasilkan tepat sebanyak umur manfaat baris", () => {
    expect(depreciationSchedule(brankas)).toHaveLength(48);
  });

  it("menjumlah tepat sama dengan dasar penyusutan — tidak ada sen yang hilang", () => {
    // Angka yang sengaja tidak habis dibagi: 10.000.000 / 48 = 208.333,333...
    const asset = { ...brankas, acquisitionCost: "10000000.00" };
    const rows = depreciationSchedule(asset);
    const total = rows.reduce((sum, row) => sum + Math.round(Number(row.charge) * 100), 0);
    expect(total).toBe(1_000_000_000);
    expect(rows[rows.length - 1].accumulated).toBe("10000000.00");
    expect(rows[rows.length - 1].carrying).toBe("0.00");
  });

  it("menyebar sisa pembulatan, tidak menumpuknya di bulan terakhir", () => {
    const rows = depreciationSchedule({ ...brankas, acquisitionCost: "10000000.00" });
    const charges = new Set(rows.map((row) => row.charge));
    // Hanya dua nilai yang boleh muncul, dan keduanya berselisih satu sen.
    expect(charges.size).toBe(2);
    expect([...charges].sort()).toEqual(["208333.33", "208333.34"]);
  });

  it("mengurangkan nilai residu dari dasar penyusutan", () => {
    const kendaraan = { ...brankas, acquisitionCost: "240000000.00", residualValue: "24000000.00", usefulLifeMonths: 96 };
    expect(depreciationForMonth(kendaraan, "2026-03")).toBe("2250000.00");
    const rows = depreciationSchedule(kendaraan);
    expect(rows[rows.length - 1].carrying).toBe("24000000.00");
  });

  it("tidak menyusutkan tanah — usefulLifeMonths NULL", () => {
    const tanah = { ...brankas, usefulLifeMonths: null, acquisitionCost: "500000000.00" };
    expect(depreciationSchedule(tanah)).toEqual([]);
    expect(depreciationForMonth(tanah, "2026-03")).toBe("0.00");
  });
});

describe("aset warisan", () => {
  /** Dibeli Maret 2024, buku besar ini dipakai mulai September 2026; 30 bulan sudah lewat. */
  const warisan = {
    acquisitionMonth: "2024-03",
    firstJournalMonth: "2026-09",
    acquisitionCost: "24000000.00",
    residualValue: "0.00",
    usefulLifeMonths: 48,
    openingAccumulatedDepreciation: "15000000.00",
  };

  it("melanjutkan sisa bulan, bukan memulai ulang", () => {
    expect(depreciationSchedule(warisan)).toHaveLength(18);
  });

  it("membagi sisa dasar penyusutan atas sisa bulan", () => {
    // (24.000.000 − 15.000.000) / 18 = 500.000
    expect(depreciationForMonth(warisan, "2026-09")).toBe("500000.00");
  });

  it("berakhir tepat pada nilai residu, memperhitungkan akumulasi yang dibawa", () => {
    const rows = depreciationSchedule(warisan);
    expect(rows[rows.length - 1].accumulated).toBe("24000000.00");
    expect(rows[rows.length - 1].carrying).toBe("0.00");
  });

  it("tidak menghidupkan kembali penyusutan aset yang umurnya sudah habis", () => {
    const habis = { ...warisan, firstJournalMonth: "2028-09", openingAccumulatedDepreciation: "24000000.00" };
    expect(depreciationSchedule(habis)).toEqual([]);
  });

  it("menolak akumulasi awal yang melebihi dasar penyusutan", () => {
    const salah = { ...warisan, openingAccumulatedDepreciation: "30000000.00" };
    expect(() => depreciationSchedule(salah)).toThrow(/akumulasi/i);
  });

  it("menolak bulan jurnal pertama yang mendahului bulan perolehan", () => {
    const salah = { ...warisan, firstJournalMonth: "2024-01" };
    expect(() => depreciationSchedule(salah)).toThrow(/bulan/i);
  });
});

describe("penolakan masukan yang tidak masuk akal", () => {
  it("menolak harga perolehan negatif", () => {
    expect(() => depreciationSchedule({ ...brankas, acquisitionCost: "-1.00" })).toThrow(/perolehan/i);
  });

  it("menolak nilai residu melebihi harga perolehan", () => {
    expect(() => depreciationSchedule({ ...brankas, residualValue: "30000000.00" })).toThrow(/residu/i);
  });

  it("menolak umur manfaat nol atau negatif", () => {
    expect(() => depreciationSchedule({ ...brankas, usefulLifeMonths: 0 })).toThrow(/umur manfaat/i);
    expect(() => depreciationSchedule({ ...brankas, usefulLifeMonths: -12 })).toThrow(/umur manfaat/i);
  });

  it("menolak bulan yang bukan YYYY-MM", () => {
    expect(() => addMonths("2026-3", 1)).toThrow(/YYYY-MM/);
  });
});
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run shared/depreciation.test.ts
```
Harapan: GAGAL — berkas `shared/depreciation.ts` belum ada.

- [ ] **Step 3: Tulis implementasi**

Buat `shared/depreciation.ts`:

```ts
/**
 * Jadwal penyusutan garis lurus.
 *
 * Ditaruh di `shared/` supaya panel penyusutan menampilkan angka yang **sama persis** dengan yang
 * dijurnal server — beban yang berbeda antara layar dan buku besar adalah pertanyaan pertama yang
 * akan diajukan pemeriksa.
 *
 * Satu formula melayani aset baru maupun aset warisan. Aset baru hanyalah kasus khusus dengan
 * akumulasi awal nol dan bulan jurnal pertama sama dengan bulan perolehan; tidak ada cabang kedua,
 * dan karena itu tidak ada cabang kedua yang bisa salah sendirian.
 *
 * Pembulatan dilakukan pada **kumulatif**, bukan pada beban bulanan. Membulatkan
 * `dasar / sisaBulan` lalu menumpuknya meleset sampai beberapa rupiah sepanjang 240 bulan, dan
 * sisanya harus ditambal ke bulan terakhir tanpa alasan akuntansi. Selisih kumulatif membuat jumlah
 * seluruh beban **tepat** sama dengan dasar penyusutan, dengan tiap bulan berselisih paling banyak
 * satu sen dari bagian ratanya. Ini satu-satunya tempat pembulatan diizinkan dalam paket E
 * (spec bagian 9).
 */

import Decimal from "decimal.js";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type DepreciationInput = {
  /** Bulan perolehan, "YYYY-MM". Bulan ini disusutkan penuh — aturan DJP, keputusan spec 2. */
  acquisitionMonth: string;
  /** Bulan pertama yang boleh dijurnal sistem; sama dengan `acquisitionMonth` untuk aset baru. */
  firstJournalMonth: string;
  acquisitionCost: string;
  residualValue: string;
  /** NULL berarti tidak disusutkan — tanah. */
  usefulLifeMonths: number | null;
  openingAccumulatedDepreciation: string;
};

export type DepreciationRow = { month: string; charge: string; accumulated: string; carrying: string };

const assertMonth = (value: string) => {
  if (!MONTH_PATTERN.test(value)) throw new Error(`Bulan "${value}" harus berbentuk YYYY-MM.`);
  return value;
};

/**
 * Bulan sebuah tanggal kolom `date`.
 *
 * Memakai bagian tanggal waktu **lokal**, bukan `toISOString()`: mysql2 mengembalikan kolom `date`
 * sebagai tengah malam waktu proses, dan `toISOString()` di mesin WIB memundurkannya satu hari —
 * bug paket K1. Tanggal 1 setiap bulan adalah tepat kasus yang salah bulan bila keliru.
 */
export const monthKey = (value: Date | string): string => {
  if (typeof value === "string") return assertMonth(value.slice(0, 7));
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  return assertMonth(`${year}-${month}`);
};

export const addMonths = (month: string, count: number): string => {
  assertMonth(month);
  const [year, index] = month.split("-").map(Number);
  const total = year * 12 + (index - 1) + count;
  return `${Math.floor(total / 12)}-${`${(total % 12) + 1}`.padStart(2, "0")}`;
};

export const monthsBetween = (from: string, to: string): number => {
  assertMonth(from);
  assertMonth(to);
  const [fromYear, fromIndex] = from.split("-").map(Number);
  const [toYear, toIndex] = to.split("-").map(Number);
  return (toYear * 12 + toIndex) - (fromYear * 12 + fromIndex);
};

const money = (value: string, label: string): Decimal => {
  const parsed = new Decimal(value);
  if (!parsed.isFinite()) throw new Error(`${label} "${value}" bukan angka yang sah.`);
  return parsed;
};

/** Dasar dan sisa bulan yang benar-benar dipakai — dipisahkan supaya kedua fungsi publik sepakat. */
function basis(input: DepreciationInput) {
  assertMonth(input.acquisitionMonth);
  assertMonth(input.firstJournalMonth);
  if (monthsBetween(input.acquisitionMonth, input.firstJournalMonth) < 0) {
    throw new Error("Bulan jurnal pertama tidak boleh mendahului bulan perolehan.");
  }

  const cost = money(input.acquisitionCost, "Harga perolehan");
  if (cost.lessThan(0)) throw new Error("Harga perolehan tidak boleh negatif.");
  const residual = money(input.residualValue, "Nilai residu");
  if (residual.lessThan(0)) throw new Error("Nilai residu tidak boleh negatif.");
  if (residual.greaterThan(cost)) throw new Error("Nilai residu tidak boleh melebihi harga perolehan.");

  const opening = money(input.openingAccumulatedDepreciation, "Akumulasi penyusutan awal");
  if (opening.lessThan(0)) throw new Error("Akumulasi penyusutan awal tidak boleh negatif.");
  if (opening.greaterThan(cost.minus(residual))) {
    throw new Error("Akumulasi penyusutan awal melebihi dasar penyusutan; periksa data aset warisan.");
  }

  if (input.usefulLifeMonths === null) return null;
  if (!Number.isInteger(input.usefulLifeMonths) || input.usefulLifeMonths <= 0) {
    throw new Error("Umur manfaat harus bilangan bulat bulan yang lebih besar dari nol.");
  }

  const elapsed = monthsBetween(input.acquisitionMonth, input.firstJournalMonth);
  const remainingMonths = input.usefulLifeMonths - elapsed;
  if (remainingMonths <= 0) return null;

  const remainingBase = cost.minus(residual).minus(opening);
  if (remainingBase.lessThanOrEqualTo(0)) return null;

  return { cost, residual, opening, remainingBase, remainingMonths };
}

const cumulative = (remainingBase: Decimal, remainingMonths: number, n: number): Decimal =>
  remainingBase.times(Math.min(Math.max(n, 0), remainingMonths)).dividedBy(remainingMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function depreciationSchedule(input: DepreciationInput): DepreciationRow[] {
  const state = basis(input);
  if (!state) return [];

  const rows: DepreciationRow[] = [];
  for (let n = 1; n <= state.remainingMonths; n += 1) {
    const charge = cumulative(state.remainingBase, state.remainingMonths, n)
      .minus(cumulative(state.remainingBase, state.remainingMonths, n - 1));
    const accumulated = state.opening.plus(cumulative(state.remainingBase, state.remainingMonths, n));
    rows.push({
      month: addMonths(input.firstJournalMonth, n - 1),
      charge: charge.toFixed(2),
      accumulated: accumulated.toFixed(2),
      carrying: state.cost.minus(accumulated).toFixed(2),
    });
  }
  return rows;
}

export function depreciationForMonth(input: DepreciationInput, month: string): string {
  assertMonth(month);
  const state = basis(input);
  if (!state) return "0.00";
  const n = monthsBetween(input.firstJournalMonth, month) + 1;
  if (n < 1 || n > state.remainingMonths) return "0.00";
  return cumulative(state.remainingBase, state.remainingMonths, n)
    .minus(cumulative(state.remainingBase, state.remainingMonths, n - 1))
    .toFixed(2);
}
```

- [ ] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run shared/depreciation.test.ts
```
Harapan: seluruh uji lulus.

- [ ] **Step 5: Perintah mutu**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```
Harapan: bersih; jumlah uji naik dari 618. Sebutkan angka yang benar-benar terlihat.

- [ ] **Step 6: Commit**

```bash
git add shared/depreciation.ts shared/depreciation.test.ts
git commit -m "Jadwal penyusutan garis lurus untuk aset baru dan aset warisan"
```

---

### Task 3: Tiga pemetaan jurnal aset tetap

**Files:**
- Modify: `shared/journalMapping.ts` (di bawah `mapYearEndProfitClosing`)
- Test: `server/fixedAssetMapping.test.ts`

**Interfaces:**
- Consumes: `MappingResult`, `isSkipped`, `EXPENSE_PAYABLE_ACCOUNT` dari `shared/journalMapping.ts`.
- Produces:
  - `FIXED_ASSET_COST_ACCOUNT = "1-1510"`, `ACCUMULATED_DEPRECIATION_ACCOUNT = "1-1520"`,
    `DEPRECIATION_EXPENSE_ACCOUNT = "6-1700"`, `ASSET_DISPOSAL_ACCOUNT = "7-1400"`,
    `OTHER_RECEIVABLE_ACCOUNT = "1-1320"`
  - `mapFixedAssetAcquisition(input: { cost: string; assetName: string }): MappingResult`
  - `mapMonthlyDepreciation(input: { totalCharge: string; month: string }): MappingResult`
  - `mapFixedAssetDisposal(input: { cost: string; accumulated: string; proceeds: string; assetName: string }): MappingResult`
  - Dipakai tugas 4, 6, dan 7.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/fixedAssetMapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSkipped, mapFixedAssetAcquisition, mapFixedAssetDisposal, mapMonthlyDepreciation } from "../shared/journalMapping";

const lines = (result: ReturnType<typeof mapFixedAssetAcquisition>) => (isSkipped(result) ? [] : result.lines);

describe("jurnal perolehan aset tetap", () => {
  it("mendebit harga perolehan dan mengkredit kewajiban lain-lain, bukan kas", () => {
    // Keputusan spec 5: modul di luar sistem kas tidak boleh mengkredit 1-1110, karena kas pada
    // buku besar lalu berbeda dari cash_balances — temuan 7.2/7.3.
    expect(lines(mapFixedAssetAcquisition({ cost: "24000000.00", assetName: "Brankas Chubb" }))).toEqual([
      { accountCode: "1-1510", side: "DEBIT", amount: "24000000.00", memo: "Perolehan Brankas Chubb" },
      { accountCode: "2-1900", side: "KREDIT", amount: "24000000.00", memo: "Perolehan Brankas Chubb" },
    ]);
  });

  it("melewati perolehan bernilai nol alih-alih menulis jurnal kosong", () => {
    const result = mapFixedAssetAcquisition({ cost: "0.00", assetName: "Brankas" });
    expect(isSkipped(result) && result.skipped).toMatch(/nol/i);
  });
});

describe("jurnal penyusutan bulanan", () => {
  it("mendebit beban penyusutan dan mengkredit akumulasi", () => {
    expect(lines(mapMonthlyDepreciation({ totalCharge: "1250000.00", month: "2026-03" }))).toEqual([
      { accountCode: "6-1700", side: "DEBIT", amount: "1250000.00", memo: "Penyusutan aset tetap 2026-03" },
      { accountCode: "1-1520", side: "KREDIT", amount: "1250000.00", memo: "Penyusutan aset tetap 2026-03" },
    ]);
  });

  it("melewati bulan tanpa beban — outlet tanpa aset tersusutkan tetap boleh menutup periode", () => {
    const result = mapMonthlyDepreciation({ totalCharge: "0.00", month: "2026-03" });
    expect(isSkipped(result) && result.skipped).toMatch(/tidak ada beban penyusutan/i);
  });
});

describe("jurnal pelepasan aset tetap", () => {
  it("mengkredit laba bila hasil pelepasan melebihi nilai buku", () => {
    // Perolehan 24 juta, akumulasi 18 juta, nilai buku 6 juta, dijual 8 juta → laba 2 juta.
    expect(lines(mapFixedAssetDisposal({ cost: "24000000.00", accumulated: "18000000.00", proceeds: "8000000.00", assetName: "Brankas Chubb" }))).toEqual([
      { accountCode: "1-1320", side: "DEBIT", amount: "8000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "1-1520", side: "DEBIT", amount: "18000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "1-1510", side: "KREDIT", amount: "24000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "7-1400", side: "KREDIT", amount: "2000000.00", memo: "Pelepasan Brankas Chubb" },
    ]);
  });

  it("mendebit rugi bila hasil pelepasan di bawah nilai buku", () => {
    expect(lines(mapFixedAssetDisposal({ cost: "24000000.00", accumulated: "18000000.00", proceeds: "4000000.00", assetName: "Brankas Chubb" }))).toEqual([
      { accountCode: "1-1320", side: "DEBIT", amount: "4000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "1-1520", side: "DEBIT", amount: "18000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "7-1400", side: "DEBIT", amount: "2000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "1-1510", side: "KREDIT", amount: "24000000.00", memo: "Pelepasan Brankas Chubb" },
    ]);
  });

  it("menghilangkan baris nol: penghapusan aset yang sudah habis disusutkan", () => {
    expect(lines(mapFixedAssetDisposal({ cost: "24000000.00", accumulated: "24000000.00", proceeds: "0.00", assetName: "Brankas Chubb" }))).toEqual([
      { accountCode: "1-1520", side: "DEBIT", amount: "24000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "1-1510", side: "KREDIT", amount: "24000000.00", memo: "Pelepasan Brankas Chubb" },
    ]);
  });

  it("seimbang pada setiap bentuknya", () => {
    for (const proceeds of ["0.00", "4000000.00", "6000000.00", "8000000.00"]) {
      const rows = lines(mapFixedAssetDisposal({ cost: "24000000.00", accumulated: "18000000.00", proceeds, assetName: "X" }));
      const debit = rows.filter((row) => row.side === "DEBIT").reduce((sum, row) => sum + Number(row.amount), 0);
      const credit = rows.filter((row) => row.side === "KREDIT").reduce((sum, row) => sum + Number(row.amount), 0);
      expect(debit).toBe(credit);
    }
  });

  it("menolak akumulasi yang melebihi harga perolehan", () => {
    const result = mapFixedAssetDisposal({ cost: "24000000.00", accumulated: "30000000.00", proceeds: "0.00", assetName: "X" });
    expect(isSkipped(result) && result.skipped).toMatch(/akumulasi/i);
  });
});
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/fixedAssetMapping.test.ts
```
Harapan: GAGAL — ketiga fungsi belum diekspor.

- [ ] **Step 3: Tulis implementasi**

Tambahkan di akhir `shared/journalMapping.ts`:

```ts
export const FIXED_ASSET_COST_ACCOUNT = "1-1510";
export const ACCUMULATED_DEPRECIATION_ACCOUNT = "1-1520";
export const DEPRECIATION_EXPENSE_ACCOUNT = "6-1700";
export const ASSET_DISPOSAL_ACCOUNT = "7-1400";
export const OTHER_RECEIVABLE_ACCOUNT = "1-1320";

/**
 * Perolehan aset tetap.
 *
 * Dikredit ke 2-1900, bukan ke kas, dengan alasan yang sama persis seperti `mapExpense`: modul di
 * luar sistem kas yang mengkredit 1-1110 membuat kas pada buku besar berbeda dari `cash_balances`.
 * Pelunasannya dijurnal terpisah saat uangnya benar-benar keluar.
 */
export function mapFixedAssetAcquisition(input: { cost: string; assetName: string }): MappingResult {
  if (Number(input.cost) <= 0) return { skipped: "harga perolehan nol" };
  const memo = `Perolehan ${input.assetName}`.slice(0, 500);
  return {
    lines: [
      { accountCode: FIXED_ASSET_COST_ACCOUNT, side: "DEBIT", amount: input.cost, memo },
      { accountCode: EXPENSE_PAYABLE_ACCOUNT, side: "KREDIT", amount: input.cost, memo },
    ],
  };
}

/**
 * Penyusutan satu bulan untuk **seluruh** aset sekaligus.
 *
 * Satu jurnal, bukan satu per aset: empat puluh jurnal kecil setiap bulan akan mengubur jurnal
 * transaksi di antara derau. Rincian per asetnya ada di `fixed_asset_depreciation_entries`, tempat
 * ia dapat diurutkan dan dijumlahkan.
 */
export function mapMonthlyDepreciation(input: { totalCharge: string; month: string }): MappingResult {
  if (Number(input.totalCharge) <= 0) return { skipped: `tidak ada beban penyusutan pada ${input.month}` };
  const memo = `Penyusutan aset tetap ${input.month}`;
  return {
    lines: [
      { accountCode: DEPRECIATION_EXPENSE_ACCOUNT, side: "DEBIT", amount: input.totalCharge, memo },
      { accountCode: ACCUMULATED_DEPRECIATION_ACCOUNT, side: "KREDIT", amount: input.totalCharge, memo },
    ],
  };
}

/**
 * Pelepasan aset tetap.
 *
 * `accumulated` wajib berupa akumulasi yang **benar-benar tercatat** — akumulasi awal ditambah baris
 * `fixed_asset_depreciation_entries` — bukan angka teoretis dari jadwalnya. Bulan yang belum
 * dijurnal belum pernah menyentuh 1-1520; mengeluarkan lebih banyak daripada yang pernah masuk
 * membuat neracanya tetap seimbang sementara angkanya salah, dan kekeliruan seperti itu tidak
 * terlihat dari laporan mana pun.
 */
export function mapFixedAssetDisposal(input: {
  cost: string;
  accumulated: string;
  proceeds: string;
  assetName: string;
}): MappingResult {
  const cost = Number(input.cost);
  const accumulated = Number(input.accumulated);
  const proceeds = Number(input.proceeds);
  if (cost <= 0) return { skipped: "harga perolehan nol" };
  if (accumulated < 0) return { skipped: "akumulasi penyusutan negatif" };
  if (accumulated > cost) return { skipped: "akumulasi penyusutan melebihi harga perolehan" };
  if (proceeds < 0) return { skipped: "hasil pelepasan negatif" };

  const memo = `Pelepasan ${input.assetName}`.slice(0, 500);
  const carrying = cost - accumulated;
  const gain = proceeds - carrying;

  const debits: MappedLine[] = [];
  const credits: MappedLine[] = [];
  if (proceeds > 0) debits.push({ accountCode: OTHER_RECEIVABLE_ACCOUNT, side: "DEBIT", amount: input.proceeds, memo });
  if (accumulated > 0) debits.push({ accountCode: ACCUMULATED_DEPRECIATION_ACCOUNT, side: "DEBIT", amount: input.accumulated, memo });
  if (gain < 0) debits.push({ accountCode: ASSET_DISPOSAL_ACCOUNT, side: "DEBIT", amount: Math.abs(gain).toFixed(2), memo });
  credits.push({ accountCode: FIXED_ASSET_COST_ACCOUNT, side: "KREDIT", amount: input.cost, memo });
  if (gain > 0) credits.push({ accountCode: ASSET_DISPOSAL_ACCOUNT, side: "KREDIT", amount: gain.toFixed(2), memo });

  return { lines: [...debits, ...credits] };
}
```

- [ ] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/fixedAssetMapping.test.ts
```
Harapan: seluruh uji lulus.

- [ ] **Step 5: Perintah mutu**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

- [ ] **Step 6: Commit**

```bash
git add shared/journalMapping.ts server/fixedAssetMapping.test.ts
git commit -m "Pemetaan jurnal perolehan, penyusutan, dan pelepasan aset tetap"
```

---

### Task 4: Batas kapitalisasi dan pendaftaran aset

**Files:**
- Create: `server/fixedAssets.ts`
- Test: `server/fixedAssetRegister.test.ts`

**Interfaces:**
- Consumes: `fixedAssets`, `fixedAssetSettings`, `accountingPeriods` (`drizzle/schema.ts`);
  `monthKey` (`shared/depreciation.ts`); `mapFixedAssetAcquisition`, `isSkipped`
  (`shared/journalMapping.ts`); `postJournalEntry` (`server/ledgerOperations.ts`);
  `databaseOrThrow`, `writeAudit`, `retryTransientDatabaseRead` (`server/operations.ts`).
- Produces:
  - `TAX_GROUP_USEFUL_LIFE_MONTHS: Record<FixedAssetTaxGroup, number | null>`
  - `getFixedAssetSettings(): Promise<{ capitalisationThresholdIdr: string }>`
  - `updateFixedAssetSettings(input: { capitalisationThresholdIdr: string }, actor: { id: number })`
  - `registerFixedAsset(input: { assetCode?: string; name: string; category: FixedAssetCategory; taxGroup?: FixedAssetTaxGroup; acquisitionDate: string; acquisitionCost: string; residualValue?: string; usefulLifeMonths: number | null; firstJournalMonth?: string; openingAccumulatedDepreciation?: string; notes?: string }, actor: { id: number }): Promise<{ id: number; entryNumber: string | null }>` — `acquisitionDate` berbentuk `"YYYY-MM-DD"`, diubah server lewat `dbDate`
  - `listFixedAssets(): Promise<FixedAssetRow[]>` dengan
    `FixedAssetRow = { id, assetCode, name, category, taxGroup, acquisitionDate, acquisitionCost, residualValue, usefulLifeMonths, firstJournalMonth, openingAccumulatedDepreciation, accumulated, carrying, status, disposalDate, disposalProceeds, isLegacy }`
  - Dipakai tugas 5, 7, 9, 10.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/fixedAssetRegister.test.ts`. Pakai pola pemalsuan `getDb` yang sudah dipakai
`server/periodValuation.test.ts` — baca berkas itu lebih dulu dan tiru bentuknya persis.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const postJournalEntry = vi.fn();
const writeAudit = vi.fn();

vi.mock("./ledgerOperations", () => ({ postJournalEntry }));
vi.mock("./operations", async () => {
  const actual = await vi.importActual<typeof import("./operations")>("./operations");
  return { ...actual, writeAudit, databaseOrThrow: () => db, retryTransientDatabaseRead: (fn: () => unknown) => fn() };
});

let db: any;
let state: { assets: any[]; settings: any[]; periods: any[] };

/**
 * Basis data palsu seminimal mungkin: hanya bentuk pemanggilan yang benar-benar dipakai
 * `server/fixedAssets.ts`. Menirukan Drizzle seutuhnya akan menguji tiruannya, bukan kodenya.
 */
beforeEach(() => {
  state = {
    assets: [],
    settings: [{ id: 1, capitalisationThresholdIdr: "1000000.00" }],
    periods: [{ id: 7, periodStart: new Date("2026-03-01T00:00:00"), periodEnd: new Date("2026-03-31T00:00:00"), status: "TERBUKA" }],
  };
  db = {
    select: () => ({ from: (table: any) => ({ where: () => ({ limit: () => rowsFor(table) }), limit: () => rowsFor(table) }) }),
    insert: () => ({ values: (value: any) => { state.assets.push({ id: state.assets.length + 1, ...value }); return { $returningId: () => [{ id: state.assets.length }] }; } }),
    update: () => ({ set: () => ({ where: () => undefined }) }),
  };
  postJournalEntry.mockReset().mockResolvedValue({ id: 91, entryNumber: "JU-202603-0004" });
  writeAudit.mockReset().mockResolvedValue(undefined);
});

const rowsFor = (table: any) => (table?.[Symbol.for("drizzle:Name")] === "fixed_asset_settings" ? state.settings : table?.[Symbol.for("drizzle:Name")] === "accounting_periods" ? state.periods : state.assets);

const baseInput = {
  name: "Brankas Chubb",
  category: "PERALATAN_KANTOR" as const,
  taxGroup: "KELOMPOK_1" as const,
  acquisitionDate: "2026-03-17",
  acquisitionCost: "24000000.00",
  residualValue: "0.00",
  usefulLifeMonths: 48,
};

describe("batas kapitalisasi", () => {
  it("menolak aset di bawah batas dan menunjuk modul pengeluaran", async () => {
    const { registerFixedAsset } = await import("./fixedAssets");
    await expect(registerFixedAsset({ ...baseInput, acquisitionCost: "750000.00" }, { id: 3 }))
      .rejects.toThrow(/batas kapitalisasi|Catat Pengeluaran/i);
  });

  it("menerima aset tepat pada batas", async () => {
    const { registerFixedAsset } = await import("./fixedAssets");
    await expect(registerFixedAsset({ ...baseInput, acquisitionCost: "1000000.00" }, { id: 3 })).resolves.toBeTruthy();
  });

  it("mengecualikan tanah dari batas", async () => {
    const { registerFixedAsset } = await import("./fixedAssets");
    await expect(registerFixedAsset({ ...baseInput, category: "TANAH", usefulLifeMonths: null, acquisitionCost: "500000.00" }, { id: 3 })).resolves.toBeTruthy();
  });
});

describe("pendaftaran aset baru", () => {
  it("menjurnal perolehan ke 1-1510 lawan 2-1900 bersumber PEROLEHAN_ASET", async () => {
    const { registerFixedAsset } = await import("./fixedAssets");
    await registerFixedAsset(baseInput, { id: 3 });
    const [entry] = postJournalEntry.mock.calls[0];
    expect(entry.sourceType).toBe("PEROLEHAN_ASET");
    expect(entry.sourceReference).toMatch(/^ASET-\d+$/);
    expect(entry.lines.map((line: any) => line.accountCode)).toEqual(["1-1510", "2-1900"]);
  });

  it("menyusutkan mulai bulan perolehan", async () => {
    const { registerFixedAsset } = await import("./fixedAssets");
    await registerFixedAsset(baseInput, { id: 3 });
    expect(state.assets[0].firstJournalMonth).toBe("2026-03");
    expect(state.assets[0].openingAccumulatedDepreciation).toBe("0.00");
  });

  it("menolak tanah yang diberi umur manfaat", async () => {
    const { registerFixedAsset } = await import("./fixedAssets");
    await expect(registerFixedAsset({ ...baseInput, category: "TANAH", usefulLifeMonths: 48 }, { id: 3 }))
      .rejects.toThrow(/tanah/i);
  });

  it("menolak pendaftaran yang jurnalnya jatuh pada periode tertutup, menunjuk jalur aset warisan", async () => {
    state.periods[0].status = "DITUTUP";
    const { registerFixedAsset } = await import("./fixedAssets");
    await expect(registerFixedAsset(baseInput, { id: 3 })).rejects.toThrow(/sudah ditutup|aset warisan/i);
  });
});

describe("pendaftaran aset warisan", () => {
  const legacyInput = {
    ...baseInput,
    acquisitionDate: "2024-03-05",
    firstJournalMonth: "2026-09",
    openingAccumulatedDepreciation: "15000000.00",
  };

  it("tidak menulis jurnal perolehan", async () => {
    const { registerFixedAsset } = await import("./fixedAssets");
    await registerFixedAsset(legacyInput, { id: 3 });
    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(state.assets[0].acquisitionJournalEntryId).toBeNull();
  });

  it("menolak akumulasi awal yang melebihi dasar penyusutan", async () => {
    const { registerFixedAsset } = await import("./fixedAssets");
    await expect(registerFixedAsset({ ...legacyInput, openingAccumulatedDepreciation: "30000000.00" }, { id: 3 }))
      .rejects.toThrow(/akumulasi/i);
  });

  it("menolak bulan jurnal pertama yang mendahului bulan perolehan", async () => {
    const { registerFixedAsset } = await import("./fixedAssets");
    await expect(registerFixedAsset({ ...legacyInput, firstJournalMonth: "2024-01" }, { id: 3 }))
      .rejects.toThrow(/bulan/i);
  });
});

describe("default umur manfaat kelompok pajak", () => {
  it("memetakan kelompok DJP ke bulan, dan tetap dapat ditimpa", async () => {
    const { TAX_GROUP_USEFUL_LIFE_MONTHS } = await import("./fixedAssets");
    expect(TAX_GROUP_USEFUL_LIFE_MONTHS).toEqual({
      KELOMPOK_1: 48,
      KELOMPOK_2: 96,
      KELOMPOK_3: 192,
      KELOMPOK_4: 240,
      BANGUNAN_PERMANEN: 240,
      BANGUNAN_NON_PERMANEN: 120,
      TIDAK_DISUSUTKAN: null,
    });
  });

  it("memakai umur manfaat yang diberikan, bukan default kelompoknya", async () => {
    const { registerFixedAsset } = await import("./fixedAssets");
    await registerFixedAsset({ ...baseInput, usefulLifeMonths: 60 }, { id: 3 });
    expect(state.assets[0].usefulLifeMonths).toBe(60);
  });
});
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/fixedAssetRegister.test.ts
```
Harapan: GAGAL — `server/fixedAssets.ts` belum ada.

- [ ] **Step 3: Tulis implementasi**

Buat `server/fixedAssets.ts` berisi:

- Komentar berkas yang menjelaskan bahwa modul ini tidak pernah menyentuh sistem kas, dan bahwa
  kelompok pajak hanyalah default berlabel (SAK EP Bab 17 menuntut umur manfaat sebenarnya).
- `const dbDate = (value: string) => new Date(`${value}T00:00:00`)` — **salin komentarnya dari
  `server/periodClosing.ts:33-39`**, alasannya berlaku sama persis; jangan menciptakan yang baru.
- `TAX_GROUP_USEFUL_LIFE_MONTHS` sesuai uji Step 1, dengan komentar yang menyebut PMK 72/2023 dan
  menegaskan bahwa nilainya hanya mengisi form, tidak mengunci `usefulLifeMonths`.
- `getFixedAssetSettings()` — membaca baris `id = 1`; bila belum ada, menyisipkannya dengan default
  `"1000000.00"` lalu mengembalikannya. Pola yang sama dengan `reviewThresholds`
  (`server/operations.ts:1138`).
- `updateFixedAssetSettings(input, actor)` — memvalidasi `> 0`, menulis, dan
  `writeAudit({ action: "FIXED_ASSET_SETTINGS_UPDATED", entityType: "fixed_asset_settings", entityId: "1", beforeState, afterState })`.
- `registerFixedAsset(input, actor)`:
  1. Normalkan: `acquisitionMonth = monthKey(input.acquisitionDate)`;
     `firstJournalMonth = input.firstJournalMonth ?? acquisitionMonth`;
     `openingAccumulatedDepreciation = input.openingAccumulatedDepreciation ?? "0.00"`;
     `isLegacy = firstJournalMonth !== acquisitionMonth || Number(opening) > 0`.
  2. Tolak `category === "TANAH"` dengan `usefulLifeMonths` bukan null
     (*"Tanah tidak disusutkan; kosongkan umur manfaatnya."*), dan sebaliknya tolak kategori selain
     `TANAH` dengan `usefulLifeMonths` null.
  3. Batas kapitalisasi: kecuali `category === "TANAH"`, tolak
     `Number(acquisitionCost) < Number(capitalisationThresholdIdr)` dengan pesan yang menyebut
     angka batasnya dan menunjuk **Catat Pengeluaran**.
  4. Validasi jadwal dengan memanggil `depreciationSchedule(...)` sekali dan membiarkan galatnya
     naik apa adanya — pesan galat `shared/depreciation.ts` sudah menyebut sebabnya, dan menuliskan
     ulang validasinya di sini berarti dua salinan aturan yang sama.
  5. Sisipkan baris `fixed_assets` dengan `acquisitionDate: dbDate(input.acquisitionDate)`.
  6. Bila **bukan** aset warisan: `mapFixedAssetAcquisition`, lalu `postJournalEntry` dengan
     `sourceType: "PEROLEHAN_ASET"`, `sourceReference: `ASET-${id}``,
     `entryDate: dbDate(input.acquisitionDate)`; simpan `acquisitionJournalEntryId`. Periode yang
     sudah ditutup ditolak **di muka** dengan pesan yang menunjuk jalur aset warisan, karena
     `postJournalEntry` menolaknya tanpa menyebut jalan keluarnya.
  7. `writeAudit({ action: "FIXED_ASSET_REGISTERED", entityType: "fixed_assets", entityId: String(id), afterState })`.
- `listFixedAssets()` — menggabungkan `fixed_assets` dengan jumlah
  `fixed_asset_depreciation_entries.charge` per aset; `accumulated = openingAccumulatedDepreciation +
  jumlah itu`, `carrying = acquisitionCost − accumulated`; `acquisitionDate` dan `disposalDate`
  dikembalikan lewat **`calendarDay`**, `isLegacy = acquisitionJournalEntryId === null`.

- [ ] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/fixedAssetRegister.test.ts
```

- [ ] **Step 5: Perintah mutu**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

- [ ] **Step 6: Commit**

```bash
git add server/fixedAssets.ts server/fixedAssetRegister.test.ts
git commit -m "Pendaftaran aset tetap dengan batas kapitalisasi dan jalur aset warisan"
```

---

### Task 5: `buildMonthlyDepreciation` — bukti beban per aset

Fungsi baca saja. Panel memakainya untuk menunjukkan angka beserta penghalangnya sebelum tombol
ditekan, dan tugas 6 memakainya sebagai **satu-satunya** sumber angka — sehingga yang dilihat
pengguna dan yang dijurnal server mustahil berbeda. Ini pola `buildPeriodValuation` paket C;
baca `server/periodClosing.ts:84-290` lebih dulu.

**Files:**
- Modify: `server/fixedAssets.ts`
- Test: `server/monthlyDepreciation.test.ts`

**Interfaces:**
- Consumes: `depreciationForMonth`, `monthKey` (`shared/depreciation.ts`); `fixedAssets`,
  `fixedAssetDepreciationEntries`, `accountingPeriods`.
- Produces:
  - `type AssetDepreciationRow = { assetId: number; assetCode: string | null; assetName: string; category: string; charge: string; accumulatedAfter: string; carryingAfter: string }`
  - `type MonthlyDepreciation = { periodId: number; periodMonth: string; periodStart: string; periodEnd: string; status: "TERBUKA" | "DITUTUP"; rows: AssetDepreciationRow[]; totalCharge: string; blockers: { assetName: string; reason: string }[]; depreciationPostedAt: Date | null }`
  - `buildMonthlyDepreciation(periodId: number): Promise<MonthlyDepreciation>`
  - Dipakai tugas 6, 8, 9, 10.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/monthlyDepreciation.test.ts`, memalsukan `getDb` dengan pola yang sama seperti tugas 4:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMonthlyDepreciation } from "./fixedAssets";
// Pemalsuan `getDb`, `writeAudit`, dan `retryTransientDatabaseRead` sama persis seperti tugas 4;
// `state` memuat `assets`, `entries`, dan `periods`. Baca `server/periodValuation.test.ts` lebih
// dulu dan tiru bentuknya, jangan menciptakan pemalsuan ketiga.

describe("buildMonthlyDepreciation", () => {
  it("menghitung beban tiap aset aktif untuk bulan periode itu", async () => {
    // Dua aset: brankas 24.000.000/48 bulan mulai 2026-03, kendaraan 240.000.000/96 bulan mulai 2026-01.
    const result = await buildMonthlyDepreciation(7); // periode Maret 2026
    expect(result.periodMonth).toBe("2026-03");
    expect(result.rows.map((row) => [row.assetName, row.charge])).toEqual([
      ["Brankas Chubb", "500000.00"],
      ["Kendaraan Operasional", "2500000.00"],
    ]);
    expect(result.totalCharge).toBe("3000000.00");
  });

  it("menghitung akumulasi sesudahnya dari baris yang sudah dijurnal, bukan dari jadwalnya", async () => {
    // Brankas sudah punya satu baris Maret senilai 500.000; April harus berakumulasi 1.000.000.
    const result = await buildMonthlyDepreciation(8); // periode April 2026
    expect(result.rows[0].accumulatedAfter).toBe("1000000.00");
    expect(result.rows[0].carryingAfter).toBe("23000000.00");
  });

  it("melewati aset yang belum diperoleh pada bulan itu", async () => {
    const result = await buildMonthlyDepreciation(6); // periode Februari 2026, brankas belum ada
    expect(result.rows.map((row) => row.assetName)).not.toContain("Brankas Chubb");
  });

  it("melewati tanah tanpa menjadikannya penghalang", async () => {
    const result = await buildMonthlyDepreciation(7);
    expect(result.rows.map((row) => row.assetName)).not.toContain("Tanah Outlet");
    expect(result.blockers).toEqual([]);
  });

  it("melewati aset yang habis disusutkan tanpa galat — asetnya tetap terdaftar", async () => {
    const result = await buildMonthlyDepreciation(60); // jauh setelah umur manfaat brankas
    expect(result.rows.map((row) => row.assetName)).not.toContain("Brankas Chubb");
  });

  it("melewati aset yang sudah dilepas sebelum bulan itu", async () => {
    const result = await buildMonthlyDepreciation(9);
    expect(result.rows.map((row) => row.assetName)).not.toContain("Kendaraan Operasional");
  });

  it("mengembalikan aset yang bulan itu sudah dijurnal sebagai penghalang, bukan barisnya", async () => {
    state.entries.push({ assetId: 1, periodMonth: "2026-03", charge: "500000.00" });
    const result = await buildMonthlyDepreciation(7);
    expect(result.rows.map((row) => row.assetName)).not.toContain("Brankas Chubb");
    expect(result.blockers).toEqual([
      { assetName: "Brankas Chubb", reason: "penyusutan bulan 2026-03 sudah dijurnal" },
    ]);
  });

  it("menolak periode yang tidak ada", async () => {
    await expect(buildMonthlyDepreciation(999)).rejects.toThrow(/tidak ditemukan/i);
  });

  it("menyatakan total nol untuk outlet tanpa aset tersusutkan, bukan galat", async () => {
    const result = await buildMonthlyDepreciation(5);
    expect(result.rows).toEqual([]);
    expect(result.totalCharge).toBe("0.00");
    expect(result.blockers).toEqual([]);
  });
});
```

Tiap uji menyiapkan keadaannya sendiri lewat `state` pada `beforeEach`, tidak mewarisi keadaan dari
uji sebelumnya — uji yang bergantung pada urutan menjadi tidak terbaca begitu satu di antaranya
gagal.

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/monthlyDepreciation.test.ts
```
Harapan: GAGAL — `buildMonthlyDepreciation` belum diekspor.

- [ ] **Step 3: Tulis implementasi**

Tambahkan `buildMonthlyDepreciation(periodId)` ke `server/fixedAssets.ts`:

1. Baca periode; bila tidak ada, lempar galat dengan `code = "PERIOD_NOT_FOUND"` — bentuk yang sama
   dengan `buildPeriodValuation`.
2. `periodMonth = monthKey(period.periodStart)`; `periodStart`/`periodEnd` lewat `calendarDay`.
3. Baca seluruh `fixed_assets` beserta jumlah `charge`-nya sampai bulan **sebelum** `periodMonth`.
4. Untuk tiap aset: lewati bila `usefulLifeMonths` null, bila `status = DILEPAS` dan
   `monthKey(disposalDate) < periodMonth`, atau bila `depreciationForMonth(...) === "0.00"`.
   Aset yang sudah punya baris pada `periodMonth` menjadi **blocker** dengan alasan
   *"penyusutan bulan {periodMonth} sudah dijurnal"* — bukan baris, supaya menjalankannya ulang tidak
   pernah menjurnal dua kali.
5. `accumulatedAfter = openingAccumulatedDepreciation + jumlah sampai bulan sebelumnya + charge`;
   `carryingAfter = acquisitionCost − accumulatedAfter`.
6. `totalCharge` dijumlahkan dengan `Decimal`, dikembalikan `toFixed(2)`.

- [ ] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/monthlyDepreciation.test.ts
```

- [ ] **Step 5: Perintah mutu**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

- [ ] **Step 6: Commit**

```bash
git add server/fixedAssets.ts server/monthlyDepreciation.test.ts
git commit -m "Bukti beban penyusutan per aset untuk sebuah periode"
```

---

### Task 6: `postMonthlyDepreciation` — jurnal bulanan yang idempoten

**Files:**
- Modify: `server/fixedAssets.ts`
- Test: `server/monthlyDepreciationPosting.test.ts`

**Interfaces:**
- Consumes: `buildMonthlyDepreciation` (tugas 5), `mapMonthlyDepreciation` (tugas 3),
  `postJournalEntry`, `journalEntries`.
- Produces:
  - `monthlyDepreciationSourceReference(periodMonth: string): string` → `SUSUT-YYYY-MM`
  - `postMonthlyDepreciation(input: { periodId: number }, actor: { id: number }): Promise<{ periodId: number; entryNumber: string | null; rows: AssetDepreciationRow[]; skipped: string | null }>`
  - Mengisi `accountingPeriods.depreciationPostedAt` dan `.depreciationJournalEntryId`.
  - Dipakai tugas 7, 8, 9, 10.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/monthlyDepreciationPosting.test.ts`:

```ts
describe("postMonthlyDepreciation", () => {
  it("menulis satu jurnal untuk seluruh aset, bersumber PENYUSUTAN", async () => {
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    const [entry] = postJournalEntry.mock.calls[0];
    expect(entry.sourceType).toBe("PENYUSUTAN");
    expect(entry.sourceReference).toBe("SUSUT-2026-03");
    expect(entry.lines).toEqual([
      { accountCode: "6-1700", side: "DEBIT", amount: "3000000.00", memo: "Penyusutan aset tetap 2026-03" },
      { accountCode: "1-1520", side: "KREDIT", amount: "3000000.00", memo: "Penyusutan aset tetap 2026-03" },
    ]);
  });

  it("bertanggal hari terakhir bulan itu", async () => {
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    const [entry] = postJournalEntry.mock.calls[0];
    // Tengah malam lokal 31 Maret 2026 — dbDate, bukan tengah malam UTC.
    expect(entry.entryDate).toEqual(new Date("2026-03-31T00:00:00"));
  });

  it("menulis satu baris rincian per aset", async () => {
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    expect(state.entries.map((row: any) => [row.assetId, row.periodMonth, row.charge])).toEqual([
      [1, "2026-03", "500000.00"],
      [2, "2026-03", "2500000.00"],
    ]);
  });

  it("menandai periodenya sudah disusutkan", async () => {
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    expect(state.periods[0].depreciationPostedAt).toBeInstanceOf(Date);
    expect(state.periods[0].depreciationJournalEntryId).toBe(91);
  });

  it("menolak dijalankan dua kali", async () => {
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    await expect(postMonthlyDepreciation({ periodId: 7 }, { id: 3 })).rejects.toThrow(/sudah dijalankan/i);
    expect(postJournalEntry).toHaveBeenCalledTimes(1);
  });

  it("memakai ulang jurnal yang sudah tertulis bila percobaan sebelumnya gagal setelah menjurnal", async () => {
    // Kunci (sourceType, sourceReference) sudah memuat SUSUT-2026-03, tetapi penanda periodenya kosong.
    state.journals.push({ id: 91, entryNumber: "JU-202603-0004", sourceType: "PENYUSUTAN", sourceReference: "SUSUT-2026-03" });
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(state.periods[0].depreciationJournalEntryId).toBe(91);
  });

  it("menandai periode yang bebannya nol sudah disusutkan, tanpa menulis jurnal", async () => {
    const result = await postMonthlyDepreciation({ periodId: 5 }, { id: 3 });
    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(result.skipped).toMatch(/tidak ada beban penyusutan/i);
    expect(state.periods.find((row: any) => row.id === 5).depreciationPostedAt).toBeInstanceOf(Date);
  });

  it("menolak periode yang sudah ditutup", async () => {
    state.periods[0].status = "DITUTUP";
    await expect(postMonthlyDepreciation({ periodId: 7 }, { id: 3 })).rejects.toThrow(/sudah ditutup/i);
  });

  it("membatalkan seluruhnya bila ada satu penghalang", async () => {
    state.entries.push({ assetId: 1, periodMonth: "2026-03", charge: "500000.00" });
    await expect(postMonthlyDepreciation({ periodId: 7 }, { id: 3 })).rejects.toThrow(/sudah dijurnal/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("menulis jejak audit berisi total dan rincian per aset", async () => {
    await postMonthlyDepreciation({ periodId: 7 }, { id: 3 });
    const [audit] = writeAudit.mock.calls[0];
    expect(audit.action).toBe("MONTHLY_DEPRECIATION_POSTED");
    expect(audit.afterState.totalCharge).toBe("3000000.00");
    expect(audit.afterState.assets).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/monthlyDepreciationPosting.test.ts
```

- [ ] **Step 3: Tulis implementasi**

Tambahkan ke `server/fixedAssets.ts`, mengikuti `postPeriodClosing`
(`server/periodClosing.ts:314-415`) langkah demi langkah — pola itu sudah terbukti dan menyimpang
darinya hanya menambah bentuk kegagalan baru:

```ts
export const monthlyDepreciationSourceReference = (periodMonth: string) => `SUSUT-${periodMonth}`;
```

1. `const plan = await buildMonthlyDepreciation(input.periodId)`.
2. Tolak `plan.status === "DITUTUP"`; tolak `plan.depreciationPostedAt` yang sudah terisi
   (*"...balik jurnalnya lebih dulu bila angkanya perlu diperbaiki"*); tolak `plan.blockers.length`
   dengan menyebut asetnya. **Penyusutan tidak pernah berjalan sebagian** — buku besar yang
   setengah disusutkan jauh lebih sulit ditelusuri daripada yang belum disusutkan sama sekali.
3. `mapMonthlyDepreciation({ totalCharge: plan.totalCharge, month: plan.periodMonth })`.
4. Bila tidak `skipped`: cari jurnal yang sudah ada pada
   `(sourceType = "PENYUSUTAN", sourceReference)` dan pakai ulang bila ada; jika tidak,
   `postJournalEntry` dengan `entryDate: dbDate(plan.periodEnd)`.
5. Dalam satu `db.transaction`: sisipkan baris `fixed_asset_depreciation_entries` untuk tiap
   `plan.rows` (dengan `periodId`, `periodMonth`, `journalEntryId`), lalu perbarui
   `accountingPeriods` dengan `depreciationPostedAt` dan `depreciationJournalEntryId`. Keduanya
   harus jatuh bersama, dengan alasan yang sama seperti `postPeriodClosing`: baris tanpa penanda
   membuat penyusutan tampak belum berjalan padahal jurnalnya sudah ada; penanda tanpa baris membuat
   beban 6-1700 kehilangan bukti barisnya.
6. `writeAudit({ action: "MONTHLY_DEPRECIATION_POSTED", entityType: "accounting_periods", entityId: String(periodId), afterState: { periodMonth, entryNumber, totalCharge, assets: [...] }, reason: skipped ?? null })`.

- [ ] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/monthlyDepreciationPosting.test.ts
```

- [ ] **Step 5: Perintah mutu**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

- [ ] **Step 6: Commit**

```bash
git add server/fixedAssets.ts server/monthlyDepreciationPosting.test.ts
git commit -m "Jurnal penyusutan bulanan yang idempoten lewat kunci sumber"
```

---

### Task 7: Pelepasan aset

**Files:**
- Modify: `server/fixedAssets.ts`
- Test: `server/fixedAssetDisposal.test.ts`

**Interfaces:**
- Consumes: `mapFixedAssetDisposal` (tugas 3), `depreciationForMonth`, `monthKey`,
  `fixedAssetDepreciationEntries`, `postJournalEntry`.
- Produces:
  - `disposeFixedAsset(input: { assetId: number; disposalDate: string; proceeds: string; notes?: string }, actor: { id: number }): Promise<{ assetId: number; entryNumber: string; gainLoss: string }>`
  - Dipakai tugas 9, 10, 11.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/fixedAssetDisposal.test.ts`:

```ts
describe("disposeFixedAsset", () => {
  it("memakai akumulasi yang benar-benar tercatat, bukan jadwal teoretisnya", async () => {
    // Brankas: opening 0, tiga baris dijurnal @500.000 → akumulasi 1.500.000, meski jadwalnya
    // sudah sampai bulan keenam. Memakai jadwal akan mengeluarkan dari 1-1520 lebih banyak
    // daripada yang pernah masuk.
    await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "0.00" }, { id: 3 });
    const [entry] = postJournalEntry.mock.calls[0];
    const accumulated = entry.lines.find((line: any) => line.accountCode === "1-1520");
    expect(accumulated.amount).toBe("1500000.00");
  });

  it("menjurnal laba ke 7-1400 bersumber PELEPASAN_ASET", async () => {
    const result = await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "24000000.00" }, { id: 3 });
    const [entry] = postJournalEntry.mock.calls[0];
    expect(entry.sourceType).toBe("PELEPASAN_ASET");
    expect(entry.sourceReference).toBe("LEPAS-1");
    expect(entry.entryDate).toEqual(new Date("2026-05-31T00:00:00"));
    // Nilai buku 24.000.000 − 1.500.000 = 22.500.000; hasil 24.000.000 → laba 1.500.000.
    expect(result.gainLoss).toBe("1500000.00");
    expect(entry.lines).toContainEqual(expect.objectContaining({ accountCode: "7-1400", side: "KREDIT", amount: "1500000.00" }));
  });

  it("menandai asetnya DILEPAS beserta tanggal, hasil, dan jurnalnya", async () => {
    await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "1000000.00", notes: "Dijual ke rekanan" }, { id: 3 });
    const asset = state.assets.find((row: any) => row.id === 1);
    expect(asset.status).toBe("DILEPAS");
    expect(asset.disposalProceeds).toBe("1000000.00");
    expect(asset.disposalJournalEntryId).toBe(92);
    expect(asset.disposalNotes).toBe("Dijual ke rekanan");
  });

  it("menolak aset yang penyusutannya belum dijurnal sampai bulan pelepasan, menyebut bulannya", async () => {
    // Baris hanya sampai Maret, pelepasan Mei → April dan Mei tertinggal.
    await expect(disposeFixedAsset({ assetId: 2, disposalDate: "2026-05-31", proceeds: "0.00" }, { id: 3 }))
      .rejects.toThrow(/2026-04/);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("menerima tanah tanpa menuntut baris penyusutan apa pun", async () => {
    await expect(disposeFixedAsset({ assetId: 3, disposalDate: "2026-05-31", proceeds: "600000000.00" }, { id: 3 })).resolves.toBeTruthy();
  });

  it("menolak aset yang sudah dilepas", async () => {
    await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "0.00" }, { id: 3 });
    await expect(disposeFixedAsset({ assetId: 1, disposalDate: "2026-06-30", proceeds: "0.00" }, { id: 3 }))
      .rejects.toThrow(/sudah dilepas/i);
  });

  it("menolak tanggal pelepasan yang mendahului tanggal perolehan", async () => {
    await expect(disposeFixedAsset({ assetId: 1, disposalDate: "2025-01-01", proceeds: "0.00" }, { id: 3 }))
      .rejects.toThrow(/perolehan/i);
  });

  it("menolak pelepasan yang jurnalnya jatuh pada periode tertutup", async () => {
    state.periods.find((row: any) => row.id === 9).status = "DITUTUP";
    await expect(disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "0.00" }, { id: 3 }))
      .rejects.toThrow(/ditutup/i);
  });

  it("menulis jejak audit berisi nilai buku dan laba/ruginya", async () => {
    await disposeFixedAsset({ assetId: 1, disposalDate: "2026-05-31", proceeds: "24000000.00" }, { id: 3 });
    const [audit] = writeAudit.mock.calls[0];
    expect(audit.action).toBe("FIXED_ASSET_DISPOSED");
    expect(audit.afterState.carryingAmount).toBe("22500000.00");
    expect(audit.afterState.gainLoss).toBe("1500000.00");
  });
});
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/fixedAssetDisposal.test.ts
```

- [ ] **Step 3: Tulis implementasi**

Tambahkan `disposeFixedAsset(input, actor)` ke `server/fixedAssets.ts`:

1. Baca asetnya; tolak bila tidak ada atau `status === "DILEPAS"`.
2. Tolak `disposalDate` yang mendahului `acquisitionDate` (keduanya lewat `calendarDay`).
3. **Bulan yang tertinggal:** untuk aset yang `usefulLifeMonths` bukan null, kumpulkan setiap bulan
   dari `firstJournalMonth` sampai `monthKey(disposalDate)` yang `depreciationForMonth(...)`-nya
   bukan `"0.00"` tetapi belum punya baris `fixed_asset_depreciation_entries`. Bila ada, tolak dan
   sebut bulan-bulannya. Alasannya ada di spec bagian 5: akumulasi yang dijurnal keluar harus sama
   dengan yang pernah masuk.
4. `accumulated = openingAccumulatedDepreciation + jumlah seluruh charge`.
5. `mapFixedAssetDisposal({ cost, accumulated, proceeds, assetName })`; bila `skipped`, lempar
   galat berisi alasannya — pelepasan yang tidak dapat dipetakan tidak boleh diam-diam berhasil.
6. `postJournalEntry` dengan `sourceType: "PELEPASAN_ASET"`,
   `sourceReference: `LEPAS-${assetId}``, `entryDate: dbDate(disposalDate)`.
7. Perbarui asetnya: `status`, `disposalDate: dbDate(...)`, `disposalProceeds`,
   `disposalJournalEntryId`, `disposalNotes`.
8. `writeAudit({ action: "FIXED_ASSET_DISPOSED", entityType: "fixed_assets", entityId: String(assetId), beforeState: { status: "AKTIF" }, afterState: { disposalDate, proceeds, accumulated, carryingAmount, gainLoss, entryNumber } })`.

- [ ] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/fixedAssetDisposal.test.ts
```

- [ ] **Step 5: Perintah mutu**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

- [ ] **Step 6: Commit**

```bash
git add server/fixedAssets.ts server/fixedAssetDisposal.test.ts
git commit -m "Pelepasan aset tetap dengan laba/rugi ke 7-1400"
```

---

### Task 8: Gerbang penutupan periode dan penutup laba tahunan

**Files:**
- Modify: `server/ledgerOperations.ts:189-232` (`closeAccountingPeriod`)
- Modify: `server/periodClosing.ts` (`postYearEndProfitClosing`)
- Test: `server/depreciationGate.test.ts`

**Interfaces:**
- Consumes: `accountingPeriods.depreciationPostedAt` (tugas 1), `monthKey` (tugas 2).
- Produces: dua penolakan baru. Dipakai tugas 10 (panel mematikan tombolnya) dan 11.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/depreciationGate.test.ts`:

```ts
describe("closeAccountingPeriod menuntut penyusutan", () => {
  it("menolak periode yang penyusutannya belum dijurnal", async () => {
    await expect(closeAccountingPeriod({ periodId: 7 }, { id: 3 }))
      .rejects.toThrow(/penyusutan aset tetap belum dijurnal/i);
  });

  it("mendahulukan pesan jurnal tidak utuh daripada pesan penyusutan", async () => {
    // Jurnal yang tidak utuh adalah masalah yang lebih besar, dan pesannyalah yang harus sampai
    // lebih dulu — urutan yang sama seperti gerbang penilaian paket C.
    integrity.problems = [{ entryNumber: "JU-202603-0001", problem: "tidak seimbang" }];
    await expect(closeAccountingPeriod({ periodId: 7 }, { id: 3 })).rejects.toThrow(/tidak utuh/i);
  });

  it("memeriksa penyusutan sebelum penilaian persediaan", async () => {
    // Penyusutan mengubah laba periode itu; penilaian tidak bergantung padanya.
    state.periods[0].depreciationPostedAt = null;
    state.periods[0].valuationPostedAt = null;
    await expect(closeAccountingPeriod({ periodId: 7 }, { id: 3 })).rejects.toThrow(/penyusutan/i);
  });

  it("meloloskan periode yang penyusutan dan penilaiannya sudah dijalankan", async () => {
    state.periods[0].depreciationPostedAt = new Date();
    state.periods[0].valuationPostedAt = new Date();
    await expect(closeAccountingPeriod({ periodId: 7 }, { id: 3 })).resolves.toEqual({ id: 7 });
  });
});

describe("postYearEndProfitClosing menuntut dua belas bulan penyusutan", () => {
  it("menolak dan menyebut bulan yang penyusutannya belum dijurnal", async () => {
    // Januari–November sudah, Desember belum.
    await expect(postYearEndProfitClosing({ periodId: 12 }, { id: 3 }))
      .rejects.toThrow(/2026-12/);
  });

  it("menyebut seluruh bulan yang tertinggal, bukan hanya yang pertama", async () => {
    await expect(postYearEndProfitClosing({ periodId: 12 }, { id: 3 }))
      .rejects.toThrow(/2026-07.*2026-12|2026-12.*2026-07/s);
  });

  it("meloloskan tahun yang seluruh bulannya sudah disusutkan", async () => {
    for (const period of state.periods) period.depreciationPostedAt = new Date();
    await expect(postYearEndProfitClosing({ periodId: 12 }, { id: 3 })).resolves.toBeTruthy();
  });
});
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/depreciationGate.test.ts
```

- [ ] **Step 3: Tulis implementasi**

Di `server/ledgerOperations.ts`, sisipkan **sebelum** blok `if (!period.valuationPostedAt)`:

```ts
  // Penyusutan lebih dulu daripada penilaian: ia mengubah laba periode ini, sementara penilaian
  // persediaan tidak bergantung padanya. Bulan yang terlupa membuat laba berlebih persis sebesar
  // penyusutan yang tidak pernah dibebankan, dan tidak ada satu pun laporan yang menolaknya.
  if (!period.depreciationPostedAt) {
    throw new Error(
      "Periode tidak dapat ditutup: penyusutan aset tetap belum dijurnal. Jalankan penyusutan bulanan pada panel Periode lebih dulu.",
    );
  }
```

Di `server/periodClosing.ts`, di dalam `postYearEndProfitClosing` **sebelum** jurnalnya ditulis:
baca seluruh `accounting_periods` yang `periodEnd`-nya jatuh di dalam tahun buku itu, kumpulkan yang
`depreciationPostedAt`-nya kosong, dan bila ada, tolak dengan menyebut seluruh bulannya
(`monthKey(periodStart)`, diurutkan). Komentar yang menyertainya: penutup laba menolkan 6-1700;
menutupnya sebelum bebannya lengkap memindahkan angka yang salah ke 3-2100, dan 3-2100 tidak pernah
ditinjau lagi.

- [ ] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/depreciationGate.test.ts
```

- [ ] **Step 5: Perintah mutu**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```
Uji lama pada `server/periodCloseGate.test.ts` dan `server/periodClosingScenario.test.ts` mungkin
ikut gagal karena gerbang baru ini. **Perbaiki ujinya dengan mengisi `depreciationPostedAt`, bukan
dengan melonggarkan gerbangnya.**

- [ ] **Step 6: Commit**

```bash
git add server/ledgerOperations.ts server/periodClosing.ts server/depreciationGate.test.ts server/periodCloseGate.test.ts server/periodClosingScenario.test.ts
git commit -m "Penutupan periode menolak bulan yang penyusutannya belum dijurnal"
```

---

### Task 9: Prosedur tRPC dan navigasi

**Files:**
- Modify: `server/routers.ts` (router `ledger` ~baris 513; router baru `fixedAssets`)
- Modify: `shared/backOfficeNavigation.ts:65-70` (grup **Laporan**)
- Modify: `client/src/App.tsx:87` (dekat rute Buku Besar)
- Modify: `server/backOfficeNavigation.test.ts:28` (peta rute → komponen)
- Test: `server/fixedAssets.authorization.test.ts`

**Interfaces:**
- Consumes: seluruh fungsi `server/fixedAssets.ts` dari tugas 4–7.
- Produces: `trpc.fixedAssets.list`, `.register`, `.dispose`, `.settings`, `.updateSettings`;
  `trpc.ledger.monthlyDepreciation`, `.postMonthlyDepreciation`. Dipakai tugas 10.

- [ ] **Step 1: Tulis uji otorisasi yang gagal**

Buat `server/fixedAssets.authorization.test.ts`, meniru `server/periodClosing.authorization.test.ts`
persis — baca berkas itu lebih dulu:

```ts
describe("otorisasi aset tetap", () => {
  it.each([
    ["fixedAssets.list", "query"],
    ["fixedAssets.register", "mutation"],
    ["fixedAssets.dispose", "mutation"],
    ["fixedAssets.settings", "query"],
    ["fixedAssets.updateSettings", "mutation"],
    ["ledger.monthlyDepreciation", "query"],
    ["ledger.postMonthlyDepreciation", "mutation"],
  ])("menolak STAFF dan ADMIN pada %s", async (path) => {
    await expect(callAs("STAFF", path)).rejects.toThrow(/FORBIDDEN|UNAUTHORIZED/);
    await expect(callAs("ADMIN", path)).rejects.toThrow(/FORBIDDEN|UNAUTHORIZED/);
  });

  it("mengizinkan CONTROLLER dan SHAREHOLDER", async () => {
    await expect(callAs("CONTROLLER", "fixedAssets.list")).resolves.toBeDefined();
    await expect(callAs("SHAREHOLDER", "fixedAssets.list")).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/fixedAssets.authorization.test.ts
```

- [ ] **Step 3: Tambahkan prosedurnya**

Di `server/routers.ts`, di dalam router `ledger` tepat di bawah `postYearEndClosing`:

```ts
    /**
     * Penyusutan bulanan. Dibaca dan dijalankan Controller ke atas, sama seperti seluruh router ini.
     * Diletakkan pada router `ledger`, bukan `fixedAssets`, karena yang dilakukan orang di sana
     * adalah menutup bulan — dan penyusutan adalah langkah pertamanya.
     */
    monthlyDepreciation: controllerProcedure
      .input(z.object({ periodId: z.number().int().positive() }))
      .query(({ input }) => buildMonthlyDepreciation(input.periodId)),
    postMonthlyDepreciation: controllerProcedure
      .input(z.object({ periodId: z.number().int().positive() }))
      .mutation(({ input, ctx }) => postMonthlyDepreciation(input, ctx.user)),
```

Dan router baru di sebelah `ledger`:

```ts
  fixedAssets: router({
    list: controllerProcedure.query(() => listFixedAssets()),
    settings: controllerProcedure.query(() => getFixedAssetSettings()),
    updateSettings: controllerProcedure
      .input(z.object({ capitalisationThresholdIdr: decimalString }))
      .mutation(({ input, ctx }) => updateFixedAssetSettings(input, ctx.user)),
    register: controllerProcedure
      .input(z.object({
        assetCode: z.string().trim().max(60).optional(),
        name: z.string().trim().min(1).max(200),
        category: z.enum(fixedAssetCategories),
        taxGroup: z.enum(fixedAssetTaxGroups).optional(),
        acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        acquisitionCost: decimalString,
        residualValue: decimalString.optional(),
        usefulLifeMonths: z.number().int().positive().max(600).nullable(),
        firstJournalMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        openingAccumulatedDepreciation: decimalString.optional(),
        notes: z.string().trim().max(2000).optional(),
      }))
      .mutation(({ input, ctx }) => registerFixedAsset(input, ctx.user)),
    dispose: controllerProcedure
      .input(z.object({
        assetId: z.number().int().positive(),
        disposalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        proceeds: decimalString,
        notes: z.string().trim().max(2000).optional(),
      }))
      .mutation(({ input, ctx }) => disposeFixedAsset(input, ctx.user)),
  }),
```

Tanggal dikirim sebagai `"YYYY-MM-DD"`, **bukan** `z.coerce.date()`: `coerce` menghasilkan tengah
malam UTC, dan mengirimnya ke kolom `date` dari mesin WIB memundurkan tanggalnya satu hari. Server
mengubahnya lewat `dbDate` sendiri.

- [ ] **Step 4: Daftarkan halaman dan rutenya**

Tiga berkas, ketiganya wajib — uji navigasi akan gagal berisik bila salah satu terlewat:

`shared/backOfficeNavigation.ts`, di grup **Laporan** tepat di bawah Buku Besar:
```ts
    { label: "Aset Tetap", path: "/operasional/aset-tetap", minimumRole: "CONTROLLER" },
```

`client/src/App.tsx`, di bawah rute Buku Besar:
```tsx
      <Route path="/operasional/aset-tetap"><OperationsRoute minimumRole="CONTROLLER" page={<AsetTetap />} /></Route>
```
beserta importnya. Halamannya sendiri dibuat tugas 10; untuk sementara buat
`client/src/pages/AsetTetap.tsx` berisi kerangka kosong yang menampilkan judul dan daftar aset dari
`trpc.fixedAssets.list.useQuery()` saja — halaman yang belum ada membuat `vite build` gagal.

`server/backOfficeNavigation.test.ts`, pada peta rute:
```ts
  "/operasional/aset-tetap": "AsetTetap",
```

- [ ] **Step 5: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/fixedAssets.authorization.test.ts server/backOfficeNavigation.test.ts
```

- [ ] **Step 6: Perintah mutu**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/vite build
```

- [ ] **Step 7: Commit**

```bash
git add server/routers.ts server/fixedAssets.authorization.test.ts shared/backOfficeNavigation.ts client/src/App.tsx client/src/pages/AsetTetap.tsx server/backOfficeNavigation.test.ts
git commit -m "Prosedur tRPC aset tetap dan rute halaman Aset Tetap"
```

---

### Task 10: Halaman Aset Tetap dan panel Penyusutan Bulanan

**Files:**
- Modify: `client/src/pages/AsetTetap.tsx` (kerangka dari tugas 9)
- Modify: `client/src/pages/BukuBesar.tsx` (`PeriodRow`, ~baris 730-788)

**Interfaces:**
- Consumes: `trpc.fixedAssets.*` dan `trpc.ledger.monthlyDepreciation` / `.postMonthlyDepreciation`
  dari tugas 9. Default umur manfaat per kelompok pajak disalin sebagai konstanta klien di
  `AsetTetap.tsx` — nilainya mengisi sebuah medan form dan tidak pernah dibaca server, sehingga
  mengambilnya lewat prosedur hanya menambah satu permintaan tanpa menambah kebenaran.
- Produces: —

- [ ] **Step 1: Isi halaman Aset Tetap**

Pakai komponen yang sudah ada (`Card`, `Table`, `Dialog`, `Button`, `Input`, `Select`,
`sonner` toast) mengikuti `client/src/pages/ExpenseEntry.tsx` dan `BukuBesar.tsx`. Isinya:

- **Tabel register:** nomor inventaris, nama, kategori, tanggal perolehan, harga perolehan,
  akumulasi, nilai buku, status. Aset `DILEPAS` ditandai dan tetap tampil. Aset yang habis
  disusutkan tetap tampil dengan nilai buku sebesar nilai residunya — keputusan spec 6.
- **Loading, empty, dan error state** wajib ada ketiganya: `isLoading` → skeleton,
  daftar kosong → ajakan mendaftarkan aset pertama beserta penjelasan batas kapitalisasi,
  `isError` → pesan galat beserta tombol coba lagi.
- **Form pendaftaran** dalam `Dialog`: memilih kelompok pajak **mengisi** umur manfaat dari
  konstanta klien, dan medannya tetap dapat diubah — labelnya menyebut *"Default kelompok pajak
  (PMK 72/2023). SAK EP menuntut umur manfaat sebenarnya; ubah bila berbeda."* Memilih kategori
  `TANAH` mengosongkan dan menonaktifkan umur manfaat.
- **Bagian aset warisan** pada form yang sama, terbuka lewat satu sakelar: bulan jurnal pertama dan
  akumulasi penyusutan yang sudah tercatat, dengan keterangan bahwa saldo 1-1510/1-1520-nya masuk
  lewat jalur saldo awal dan **tidak** dijurnal dari sini.
- **Tindakan pelepasan** dalam `Dialog`: tanggal, hasil pelepasan, catatan, dan **pratinjau
  laba/rugi** yang dihitung di klien dari nilai buku yang ditampilkan tabel — sebelum tombol
  ditekan. Teks tombolnya jelas: *"Lepaskan aset dan jurnalkan"*, bukan *"Simpan"*.
- **Batas kapitalisasi** ditampilkan dan dapat diubah dari kartu tersendiri, dengan keterangan
  bahwa perubahannya menentukan apa yang masuk neraca dan apa yang masuk laba rugi.
- Fokus keyboard: setiap `Dialog` mengembalikan fokus ke tombol pemicunya saat ditutup — pola yang
  sudah dipakai dialog lain di proyek ini.

- [ ] **Step 2: Tambahkan panel Penyusutan Bulanan pada tab Periode**

Di dalam `PeriodRow` pada `client/src/pages/BukuBesar.tsx`, **di atas** panel Penutupan Periode —
urutan di layar mengikuti urutan gerbangnya:

- `trpc.ledger.monthlyDepreciation.useQuery({ periodId })`.
- Tabel per aset: nama, kategori, beban bulan itu, akumulasi sesudahnya, nilai buku sesudahnya.
- Total beban, dan daftar penghalang beserta alasannya per aset.
- Tombol *"Jurnalkan penyusutan bulan ini"*, mati bila periodenya `DITUTUP`, bila
  `depreciationPostedAt` sudah terisi, atau bila ada penghalang. Bila sudah dijurnal, tampilkan
  tanggal penjurnalannya dan nomor jurnalnya, bukan tombol.
- Bulan tanpa beban tetap menampilkan tombolnya, dengan keterangan bahwa menjalankannya akan
  menandai bulan ini sudah disusutkan tanpa menulis jurnal — itu keadaan sah bagi outlet tanpa
  aset tersusutkan, dan gerbangnya tetap menuntutnya.

- [ ] **Step 3: Verifikasi visual**

Wajib untuk rute yang berubah. Jalankan aplikasi lalu buka `/operasional/aset-tetap` dan tab
**Periode** pada `/operasional/buku-besar`; periksa ketiga keadaan (loading, kosong, galat) dan
kedua panel. **Jangan membuat data uji pada basis data lokal tanpa izin pengguna pada giliran itu
juga** — bila data yang ada belum cukup untuk memperlihatkan sebuah keadaan, minta izinnya lebih
dulu, atau perlihatkan keadaan kosongnya apa adanya dan katakan mana yang belum terlihat.

- [ ] **Step 4: Perintah mutu**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/vite build
```

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AsetTetap.tsx client/src/pages/BukuBesar.tsx
git commit -m "Halaman Aset Tetap dan panel Penyusutan Bulanan pada tab Periode"
```

---

### Task 11: Skenario menyeluruh dan dokumentasi

**Files:**
- Create: `server/fixedAssetScenario.test.ts`
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`
- Modify: `docs/SKEMA-DATABASE-PROJECT.md`
- Modify: `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md` (centang seluruh baris paket E)

**Interfaces:**
- Consumes: seluruh paket.
- Produces: —

- [ ] **Step 1: Tulis skenario menyeluruh**

Buat `server/fixedAssetScenario.test.ts` — satu berkas, satu cerita, seluruhnya dengan `getDb`
dipalsukan:

```ts
describe("perolehan → tiga bulan penyusutan → pelepasan", () => {
  it("menjalankan seluruh alurnya dan berakhir seimbang", async () => {
    // 1. Daftarkan brankas Rp 24.000.000, kelompok 1, 17 Maret 2026.
    //    → jurnal PEROLEHAN_ASET: Dr 1-1510 24.000.000 / Cr 2-1900 24.000.000
    // 2. Jurnalkan penyusutan Maret, April, Mei — masing-masing 500.000.
    //    → tiga jurnal PENYUSUTAN, SUSUT-2026-03/04/05
    //    → 6-1700 bersaldo 1.500.000; 1-1520 bersaldo 1.500.000
    // 3. Lepaskan 31 Mei 2026 dengan hasil Rp 23.000.000.
    //    → nilai buku 22.500.000; laba 500.000
    //    → jurnal PELEPASAN_ASET: Dr 1-1320 23.000.000, Dr 1-1520 1.500.000,
    //      Cr 1-1510 24.000.000, Cr 7-1400 500.000
    // 4. Setelah pelepasan, 1-1510 dan 1-1520 kembali nol.
  });

  it("menolak menutup Maret sebelum penyusutannya dijurnal, lalu meloloskannya sesudah", async () => {
    // Gerbang tugas 8, diperiksa di dalam alur yang sama, bukan sendirian.
  });

  it("aset warisan melanjutkan sisa bulannya dan berakhir tepat pada nilai residu", async () => {
    // Perolehan Maret 2024, jurnal pertama September 2026, akumulasi awal 15.000.000.
    // 18 bulan × 500.000 = 9.000.000; akumulasi akhir 24.000.000, nilai buku 0.
  });

  it("dua kali menjalankan penyusutan bulan yang sama tidak pernah menghasilkan jurnal ganda", async () => {
    // Kunci (PENYUSUTAN, SUSUT-2026-03).
  });
});
```

Isi seluruh komentar itu menjadi kode yang benar-benar berjalan. Skenario yang hanya berisi komentar
bukan uji.

- [ ] **Step 2: Jalankan skenario**

```bash
./node_modules/.bin/vitest run server/fixedAssetScenario.test.ts
```

- [ ] **Step 3: Perbarui panduan A–Z**

Di `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, tambahkan bagian **Aset Tetap dan Penyusutan** yang
memuat, dengan bahasa yang dipakai orang di outlet, bukan bahasa kode:

- Apa yang masuk register dan apa yang masuk Catat Pengeluaran, beserta batas Rp 1.000.000 dan cara
  mengubahnya.
- Kelompok pajak hanya mengisi umur manfaat dan boleh diubah; SAK EP menuntut umur manfaat
  sebenarnya, ditinjau tahunan.
- Aset yang dibeli tengah bulan disusutkan penuh pada bulan itu.
- Cara mendaftarkan aset yang sudah dimiliki sebelum aplikasi ini dipakai.
- Urutan menutup bulan yang sekarang berlaku: **penyusutan → penilaian persediaan → tutup periode**,
  dan bahwa periode menolak ditutup bila penyusutannya terlewat.
- Cara melepas aset, dan bahwa penyusutan bulan-bulan sebelumnya harus sudah dijurnal lebih dulu.
- Bahwa perolehan dan hasil pelepasan **tidak** menyentuh kas: keduanya lewat Kewajiban Lain-Lain
  dan Piutang Lain-Lain, dan pelunasannya dicatat terpisah.

- [ ] **Step 4: Perbarui skema database**

Di `docs/SKEMA-DATABASE-PROJECT.md`, tambahkan `fixed_assets`,
`fixed_asset_depreciation_entries`, dan `fixed_asset_settings` beserta kolom dan kunci uniknya; dua
kolom baru `accounting_periods`; dan dua nilai baru `journalSourceTypes` beserta alasan
keberadaannya (paket F membaca keduanya untuk bagian investasi Arus Kas).

- [ ] **Step 5: Centang ROADMAP**

Di `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`, centang seluruh baris Paket E.

- [ ] **Step 6: Perintah mutu penuh**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
```
Sebutkan angka uji yang benar-benar terlihat, dibandingkan baseline 618 lulus / 2 dilewati / 89
berkas.

- [ ] **Step 7: Commit**

```bash
git add server/fixedAssetScenario.test.ts docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md docs/SKEMA-DATABASE-PROJECT.md docs/superpowers/ROADMAP-SISA-PEKERJAAN.md
git commit -m "Skenario aset tetap menyeluruh dan dokumentasi paket E"
```
