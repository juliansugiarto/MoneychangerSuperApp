# Paket K2 — Ganti nama `PPPSM` menjadi `DPPSPM`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satu ejaan untuk daftar sanksi proliferasi di seluruh aplikasi — `DPPSPM` — tanpa
kehilangan satu pun dari 239 baris `listType = 'PPPSM'` yang ada di produksi, dan dengan penjaga
yang mencegahnya terurai kembali.

**Architecture:** Redefinisi enum tiga pernyataan yang ditulis tangan; satu commit atomik untuk
enum beserta seluruh tipe dan peta labelnya; uji penjaga yang memindai sumber dengan daftar putih
dua entri.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-09-09-ganti-nama-dppspm-design.md`

**Prasyarat:** tidak ada. Paket ini berdiri sendiri dan tidak bergantung pada paket mana pun.

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu.**

- [x] Tugas 1 — Peragaan dasar: isi kedua basis data lokal dan catat jumlah baris sebelum migrasi — **SELESAI 9 September 2026**
- [x] Tugas 2 — Migrasi `0056` dan seluruh tipe enum, satu commit atomik — **SELESAI 9 September 2026**
- [x] Tugas 3 — Sapuan prosa, pesan validasi, dan uji penjaga — **SELESAI 9 September 2026**
- [x] Tugas 4 — Dokumentasi, rollback tertulis, dan catatan antrean migrasi produksi — **SELESAI 9 September 2026**

Urutannya **mengikat seluruhnya**: 1 sebelum 2 (tanpa data, migrasinya tidak membuktikan apa pun),
2 sebelum 3 (penjaganya akan gagal selama nilai enumnya belum berganti), 4 terakhir.

## Keputusan pengguna yang mengikat

Ditetapkan 9 September 2026 sesudah angka produksi disajikan. **Jangan menurunkannya ulang dan
jangan menawarnya.**

1. **Kolom `customers.dttotPpsdmMatch` dan `dttotPpsdmNotes` TIDAK diganti nama.** Nama kolom, field
   Drizzle, skema masukan tRPC, dan muatan klien tetap apa adanya. Hanya lapisan tampilan dan
   pesannya yang diperbaiki.
2. **Nilai enum `"PPPSM"` menjadi `"DPPSPM"`** beserta migrasi datanya. Bukan `PPPSPM`, dan bukan
   mempertahankan kedua nilai.
3. **Migrasinya ditulis tangan, tiga pernyataan.** Keluaran `drizzle-kit` apa adanya menghapus
   239 baris tanpa suara.
4. **Paket ini tidak menerapkan apa pun ke produksi.**

## Angka yang mengikat — hasil pemeriksaan baca-saja produksi 9 September 2026

Jangan diturunkan ulang. Bila kelak diperiksa lagi dan angkanya berbeda, **percayai basis datanya**
dan perbarui baris ini.

| Yang diperiksa | Hasil |
|---|---|
| `COLUMN_TYPE` `listType` di produksi | `enum('DTTOT','PPPSM')` |
| `listType = 'PPPSM'` | **239** — `DPRK` 80 INDIVIDUAL + 75 ENTITY; `IR` 23 INDIVIDUAL + 61 ENTITY |
| `listType = 'DTTOT'` | 531 — `sourceLabel` null, 412 INDIVIDUAL + 119 ENTITY |
| Nasabah dengan `dttotPpsdmMatch = 1` atau catatan terisi | **0** dari 1 |
| Baris `__drizzle_migrations` produksi | **34** (`0000`–`0033`) sementara `drizzle/` berisi 56 berkas |
| `sanctions_watchlist_entries` di `moneychanger` dan `mc_t_abcvalas` | **0 baris di keduanya** |

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Muat variabel lingkungan lebih dulu:
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Perintah mutu wajib: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`,
  `./node_modules/.bin/vite build`.
- **Baseline sebelum paket ini, dijalankan 9 September 2026 sesudah Paket J2:**
  `Test Files 151 passed (151)`, `Tests 1298 passed | 2 skipped (1300)`. **Sebutkan angka yang
  benar-benar dilihat, jangan mengarang.**
- **Satu uji diketahui flaky dan bukan bagian paket ini:** `server/tenantIsolation.live.test.ts` >
  *"setiap ikatan hanya melihat database miliknya sendiri"*. Bila gagal sendirian di bawah beban,
  jalankan ulang berkas itu saja.
- **Migrasi hanya lewat `node scripts/tenant.mjs migrate-all`**, tidak pernah `.sql` langsung lewat
  klien mysql — penanda `--> statement-breakpoint` membuat pernyataan kedua gagal dan jurnalnya
  menjadi tidak konsisten. **Dua basis data lokal saja. JANGAN menerapkan migrasi ke produksi.**
- **Tepat satu tugas migrasi di rencana ini: Tugas 2.** Migrasi yang dihasilkannya adalah `0056`.
- **Tiga ejaan ini BENAR dan tidak boleh disentuh:** `PPSPM` (tindak pidananya — kode parameter IRA
  `PPSPM_1A`…`PPSPM_4A` dan `iraRiskTypes`, keduanya menjadi **kunci basis data** pada
  `ira_inherent_values`), `PPPSPM` (program pencegahannya), `DPPSPM` (nama daftarnya). **Jangan
  menjalankan cari-ganti naif atas `PPSPM`** — ia adalah substring dari `PPPSPM` dan `DPPSPM`.
- **Dua kemunculan `PPPSM` tidak boleh diganti:** `shared/iraKpmrCatalogue.ts:291` (kutipan templat
  BI) dan `drizzle/0033_pretty_killraven.sql` beserta seluruh `drizzle/meta/*.json` (riwayat migrasi
  yang membeku; hash-nya tersimpan di `__drizzle_migrations`).
- **Jangan menjalankan `prettier`** pada berkas proyek ini.
- **Membuat data uji pada basis data lokal diizinkan tanpa bertanya lebih dulu.** **Data uji paket
  E, F1, F2, G, H, I, J1, dan J2 sengaja dibiarkan — jangan dibersihkan.** Skrip pembersih uji
  jangan menghapus `audit_logs`.
- **Jangan menyimpan salinan daftar sanksi asli** di source, fixture, log, screenshot, dokumentasi,
  maupun commit. Data peragaan Tugas 1 adalah nama sintetis.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `scripts/seedWatchlistDemo.mjs` | Isi kedua basis data lokal dengan tiga lingkup sintetis; idempoten | 1 |
| `drizzle/schema.ts:467-482` | Nilai enum `listType` dan komentar tabelnya | 2 |
| `drizzle/0056_*.sql` | Melebarkan → `UPDATE` → menyempitkan, tiga pernyataan tulis tangan | 2 |
| `server/operations.ts:2310-2408` | Gabungan `"DTTOT" \| "PPPSM"` (2351, 2363) dan komentarnya | 2 |
| `server/sanctionsWatchlistImport.ts` | Gabungan (46), nilai kembalian (210), `isPppsm`, `parsePppsmSheet`, pesan galat | 2 |
| `client/src/components/WatchlistCheck.tsx:7` | Kunci `listTypeLabels` | 2 |
| `client/src/pages/SanctionsWatchlist.tsx:13-15` | Kunci `listTypeLabels`, `listTypeIcon`, `listTypeTint` | 2 |
| `server/sanctionsWatchlistImport.test.ts`, `server/sanctionsWatchlistOperations.test.ts` | Fixture dan harapan nilai enumnya | 2 |
| `server/routers.ts:302,344` · `server/operations.ts:645,809,940` | Pesan `"DTTOT/PPSPM"` → `"DTTOT/DPPSPM"` | 3 |
| `shared/sanctionsNameMatch.ts`, `client/src/pages/SanctionsWatchlist.tsx` teks kartu | Prosa dan teks UI | 3 |
| `server/sanctionsListNaming.test.ts` | **Baru.** Uji penjaga pemindai sumber | 3 |
| `docs/SKEMA-DATABASE-PROJECT.md`, `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, ROADMAP, PROMPT-SESI | Skema, perilaku pengguna, antrean migrasi produksi | 4 |

---

### Task 1: Peragaan dasar — isi kedua basis data lokal

**Files:** Create `scripts/seedWatchlistDemo.mjs`

**Mengapa tugas ini ada:** kedua basis data lokal memiliki **nol** baris
`sanctions_watchlist_entries`. Menjalankan migrasi enum di atas tabel kosong hanya membuktikan
`ALTER` tidak melempar galat — ia tidak menyentuh satu pun baris, sehingga justru **melewatkan
kegagalan yang ditakutkan**: penyuntingan senyap 239 baris menjadi `''`. Peragaan yang berhenti pada
tabel kosong belum membuktikan apa pun.

**Interfaces:**
- Consumes: `DATABASE_URL` dan `TENANT_TEST_SECONDARY_URL` dari lingkungan; `mysql2/promise`.
- Produces: baris pada `sanctions_watchlist_entries` di kedua basis data lokal, dan ringkasan
  jumlah baris per lingkup ke stdout.

- [x] **Step 1: Tulis skripnya.** Meniru gaya `scripts/tenant.mjs` (ESM, `mysql2/promise`, tanpa
      kerangka kerja). Bentuk datanya meniru produksi — tiga lingkup, kedua `entityType`:

```js
// Bentuknya meniru produksi (diperiksa baca-saja 9 September 2026): satu DTTOT tanpa sourceLabel,
// dua sub-daftar PPPSM. Namanya SINTETIS — daftar sanksi asli tidak pernah masuk ke repo ini.
const SCOPES = [
  { listType: "DTTOT",  sourceLabel: null,   individuals: 4, entities: 2, prefix: "DTTOT" },
  { listType: "PPPSM",  sourceLabel: "DPRK", individuals: 3, entities: 3, prefix: "DPRK"  },
  { listType: "PPPSM",  sourceLabel: "IR",   individuals: 2, entities: 3, prefix: "IR"    },
];
// Nama sintetis, jelas-jelas bukan orang: "Contoh Peragaan DPRK Individu 1", dst.
```

      **`listType` sengaja masih ditulis `PPPSM`** — skrip ini menyiapkan keadaan *sebelum*
      migrasi. Tugas 2 memperbaruinya menjadi `DPPSPM` sesudah migrasinya ada.

- [x] **Step 2: Buat idempoten.** Hapus lebih dulu baris yang `sourceFileName` diawali
      `peragaan-k2-`, lalu sisipkan ulang. Jangan `TRUNCATE` — tabel ini nanti akan berisi data
      impor nyata di lingkungan lain, dan kebiasaan `TRUNCATE` di skrip peragaan adalah kebiasaan
      yang salah.

- [x] **Step 3: Cetak ringkasan lingkup** dalam bentuk yang dapat disalin ke pesan commit:

```
moneychanger    DTTOT/(null) INDIVIDUAL=4 ENTITY=2 | PPPSM/DPRK INDIVIDUAL=3 ENTITY=3 | PPPSM/IR INDIVIDUAL=2 ENTITY=3
mc_t_abcvalas   (sama)
```

- [x] **Step 4: Jalankan pada kedua basis data lokal** dan **salin keluarannya ke pesan commit.**
      Angka inilah yang akan dibandingkan sesudah migrasi pada Tugas 2 — tanpa mencatatnya sekarang,
      perbandingannya nanti tidak punya pembanding.

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
node scripts/seedWatchlistDemo.mjs
```

- [x] **Step 5: Verifikasi.**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
mysql -h 127.0.0.1 -u root -N -e "SELECT 'moneychanger', listType, IFNULL(sourceLabel,'(null)'), entityType, COUNT(*) FROM moneychanger.sanctions_watchlist_entries GROUP BY 2,3,4 ORDER BY 2,3,4;"
mysql -h 127.0.0.1 -u root -N -e "SELECT 'abcvalas', listType, IFNULL(sourceLabel,'(null)'), entityType, COUNT(*) FROM mc_t_abcvalas.sanctions_watchlist_entries GROUP BY 2,3,4 ORDER BY 2,3,4;"
```

- [x] **Step 6: Commit.**

```bash
git add scripts/seedWatchlistDemo.mjs
git commit -m "Skrip peragaan daftar sanksi untuk basis data lokal"
```

**Hasil nyata, 9 September 2026** — inilah pembanding untuk Tugas 2 Step 6:

```
moneychanger    DTTOT/(null) INDIVIDUAL=4 ENTITY=2 | PPPSM/DPRK INDIVIDUAL=3 ENTITY=3 | PPPSM/IR INDIVIDUAL=2 ENTITY=3
mc_t_abcvalas   (sama persis; 17 baris per basis data)
```

**Dua hal ditambahkan di luar rencana semula, keduanya penjaga:**

1. **`assertLocal`** menolak host maupun nama basis data yang bukan `moneychanger`/`mc_t_abcvalas`
   di `127.0.0.1`. Skrip ini membaca `DATABASE_URL`; tanpa penjaga, satu variabel lingkungan yang
   salah menulis data peragaan ke produksi. Diuji negatif: host `10.0.0.9` ditolak, keluar dengan
   status 1.
2. **Skripnya memeriksa jumlah barisnya sendiri** dan gagal bila tidak sesuai `SCOPES`. Skrip yang
   hanya mencetak apa yang kebetulan ada di tabel tidak dapat menjadi pembanding bagi migrasi.
   Diuji negatif: satu baris pengganggu disisipkan, skrip gagal dengan status 1 dan menyebut
   selisihnya; baris itu lalu dihapus.

`importedByUserId` memakai pengguna CONTROLLER/SHAREHOLDER pertama (id 2 pada `moneychanger`);
`mc_t_abcvalas` belum punya pengguna sama sekali sehingga memakai 1 — disebutkan di keluarannya,
tidak didiamkan. Tabel ini tidak punya foreign key ke `users`.

---

### Task 2: Migrasi `0056` dan seluruh tipe enum, satu commit atomik

**Files:** Modify `drizzle/schema.ts`, `server/operations.ts`, `server/sanctionsWatchlistImport.ts`,
`client/src/components/WatchlistCheck.tsx`, `client/src/pages/SanctionsWatchlist.tsx`,
`server/sanctionsWatchlistImport.test.ts`, `server/sanctionsWatchlistOperations.test.ts`,
`scripts/seedWatchlistDemo.mjs`. Create `drizzle/0056_*.sql` dan snapshot `drizzle/meta/0056_*.json`.

**Mengapa satu commit:** nilai enum itu hidup serentak di skema, di dua gabungan tipe TypeScript,
dan di tiga peta label berkunci-string. Memecahnya meninggalkan `tsc --noEmit` merah di tengah
riwayat, atau lebih buruk — peta label yang kuncinya tidak lagi cocok dengan nilai basis data,
sehingga daftarnya tampil tanpa label **dan tanpa galat.**

- [x] **Step 1: Ubah skemanya.** `drizzle/schema.ts:477`:

```ts
listType: mysqlEnum("listType", ["DTTOT", "DPPSPM"]).notNull(),
```

      Perbarui pula komentar tabel di atasnya (`:467-469`) dan komentar `aliases` (`:482`).
      Kepanjangannya ditulis sekali di komentar itu: **D**aftar **P**endanaan **P**roliferasi
      **S**enjata **P**emusnah **M**assal — sejajar dengan `DTTOT` yang juga sebuah *Daftar*.

- [x] **Step 2: Hasilkan migrasinya, lalu BACA SQL-nya.**

```bash
./node_modules/.bin/drizzle-kit generate
cat drizzle/0056_*.sql
```

      Yang dihasilkan akan berupa **satu** pernyataan `MODIFY COLUMN … enum('DTTOT','DPPSPM')`.
      **Jangan menerapkannya.** Diukur 9 September 2026 di atas salinan sekali-pakai:

      - Dengan `STRICT_TRANS_TABLES` — **yang dipakai lokal maupun produksi** — pernyataan itu
        **gagal**: `ERROR 1265 Data truncated for column 'listType' at row 7`, tanpa mengubah apa
        pun. DDL MySQL tidak transaksional, jadi `0056` berhenti dengan galat dan barisnya tidak
        masuk `__drizzle_migrations`; rilisnya tertahan.
      - Tanpa mode ketat, ia hanya memberi *warning* dan setiap baris berjenis lama menjadi `''` —
        11 dari 17 baris uji, senyap.

      Migrasi yang benar tidak boleh bergantung pada `sql_mode` sama sekali.

- [x] **Step 3: Ganti isi berkas `.sql` itu dengan tiga pernyataan berpenanda.** Persis seperti ini,
      termasuk penandanya:

```sql
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','PPPSM','DPPSPM') NOT NULL;--> statement-breakpoint
UPDATE `sanctions_watchlist_entries` SET `listType` = 'DPPSPM' WHERE `listType` = 'PPPSM';--> statement-breakpoint
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','DPPSPM') NOT NULL;
```

      Melebarkan lebih dulu membuat setiap baris tetap sah pada setiap langkahnya. Snapshot
      `drizzle/meta/0056_*.json` hasil `generate` **dibiarkan apa adanya** — ia menggambarkan
      keadaan akhir, dan keadaan akhirnya memang `enum('DTTOT','DPPSPM')`.

- [x] **Step 4: Ambil cadangan sebelum menerapkan.**

`--set-gtid-purged=OFF` **wajib**: tanpanya berkasnya menyertakan `SET @@GLOBAL.GTID_PURGED` dan
**menolak dipulihkan** ke server yang sama (`ERROR 3546`) — yang tersimpan bukan cadangan,
melainkan berkas yang tampak seperti cadangan.

```bash
mysqldump -h 127.0.0.1 -u root --single-transaction --set-gtid-purged=OFF moneychanger sanctions_watchlist_entries > /tmp/k2-watchlist-moneychanger-before.sql
mysqldump -h 127.0.0.1 -u root --single-transaction --set-gtid-purged=OFF mc_t_abcvalas sanctions_watchlist_entries > /tmp/k2-watchlist-abcvalas-before.sql
# Buktikan cadangannya benar-benar dapat dipulihkan sebelum melangkah:
mysql -h 127.0.0.1 -u root -e "DROP DATABASE IF EXISTS mc_k2_scratch; CREATE DATABASE mc_k2_scratch;"
mysql -h 127.0.0.1 -u root mc_k2_scratch < /tmp/k2-watchlist-moneychanger-before.sql && echo "cadangan dapat dipulihkan"
mysql -h 127.0.0.1 -u root -e "DROP DATABASE mc_k2_scratch;"
```

- [x] **Step 5: Terapkan ke DUA basis data lokal saja.**

```bash
node scripts/tenant.mjs migrate-all
```

- [x] **Step 6: Buktikan tidak ada baris yang hilang atau menjadi `''`.** Ini verifikasi inti
      seluruh paket:

```bash
mysql -h 127.0.0.1 -u root -N -e "SELECT 'moneychanger', listType, IFNULL(sourceLabel,'(null)'), entityType, COUNT(*) FROM moneychanger.sanctions_watchlist_entries GROUP BY 2,3,4 ORDER BY 2,3,4;
SELECT 'sisa_kosong', COUNT(*) FROM moneychanger.sanctions_watchlist_entries WHERE listType = '';
SELECT 'abcvalas', listType, IFNULL(sourceLabel,'(null)'), entityType, COUNT(*) FROM mc_t_abcvalas.sanctions_watchlist_entries GROUP BY 2,3,4 ORDER BY 2,3,4;
SELECT 'enum_baru', COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='moneychanger' AND TABLE_NAME='sanctions_watchlist_entries' AND COLUMN_NAME='listType';"
```

      **Yang harus terlihat:** jumlah per lingkup **identik** dengan Tugas 1 Step 4, dengan
      `PPPSM` berganti menjadi `DPPSPM`; `sisa_kosong` = **0**; `enum_baru` =
      `enum('DTTOT','DPPSPM')`. Bila `sisa_kosong` bukan nol, **berhenti**, pulihkan dari cadangan
      Step 4, dan laporkan.

- [x] **Step 7: Ganti seluruh tipe dan peta labelnya.** Tepat di tempat-tempat ini:

```ts
// server/operations.ts:2351, 2363 — dan server/sanctionsWatchlistImport.ts:46, 210
listType: "DTTOT" | "DPPSPM";

// client/src/components/WatchlistCheck.tsx:7
const listTypeLabels: Record<string, string> = { DTTOT: "DTTOT", DPPSPM: "DPPSPM" };

// client/src/pages/SanctionsWatchlist.tsx:13-15
const listTypeLabels: Record<string, string> = { DTTOT: "DTTOT (Terduga Teroris)", DPPSPM: "DPPSPM (Proliferasi Senjata Pemusnah Massal)" };
const listTypeIcon: Record<string, typeof ShieldAlert> = { DTTOT: ShieldAlert, DPPSPM: Radiation };
const listTypeTint: Record<string, string> = { DTTOT: "bg-rose-100 text-rose-700", DPPSPM: "bg-amber-100 text-amber-700" };
```

      Ikut berganti nama demi konsistensi, meski tidak mengubah perilaku:
      `isPppsm` → `isDppspm` (`sanctionsWatchlistImport.ts:199,200,206`) dan
      `parsePppsmSheet` → `parseDppspmSheet` (`:126,206`).

- [x] **Step 8: Perbarui fixture dan harapan ujinya.**
      `server/sanctionsWatchlistImport.test.ts:52-89` (`pppsmOrangHeader` → `dppspmOrangHeader`,
      `pppsmEntitasHeader` → `dppspmEntitasHeader`, harapan `:70`) dan
      `server/sanctionsWatchlistOperations.test.ts:67,75,83`. Perbarui juga `SCOPES` pada
      `scripts/seedWatchlistDemo.mjs` menjadi `DPPSPM`, supaya menjalankannya ulang tidak
      mengembalikan nilai lama.

- [x] **Step 9: Tambahkan satu uji baru** pada `server/sanctionsWatchlistImport.test.ts` yang
      menegakkan nilai enumnya, bukan sekadar mengikutinya:

```ts
it("menghasilkan listType DPPSPM — bukan PPPSM maupun PPPSPM", () => {
  // PPSPM menamai tindak pidananya, PPPSPM menamai program pencegahannya. Yang disimpan tabel ini
  // adalah DAFTAR penetapannya, sejajar dengan DTTOT — sebagaimana templat BI memasangkan keduanya
  // pada shared/iraKpmrCatalogue.ts:183.
  expect(result.listType).toBe("DPPSPM");
});
```

- [x] **Step 10: Verifikasi dan commit.** Bila `vite build` atau `tsc` masih menyebut `PPPSM`,
      ada kunci peta label yang terlewat.

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add drizzle/ server/ client/ scripts/
git commit -m "Nilai daftar sanksi PPPSM menjadi DPPSPM beserta migrasi datanya"
```

**Hasil nyata, 9 September 2026.** Migrasinya `0056_young_zzzax.sql`. Jumlah per lingkup **identik**
dengan pembanding Tugas 1, `PPPSM` berganti menjadi `DPPSPM`, `sisa_kosong` = 0 pada kedua basis
data, `enum_baru` = `enum('DTTOT','DPPSPM')`. Uji: 151 berkas, **1299 lulus** (naik satu dari
baseline 1298), 2 dilewati; `tsc` bersih; `vite build` sukses.

**Satu perubahan perilaku yang tidak terduga pada rancangan — dan terlihat pengguna.**
`listSanctionsWatchlistSummary` (`server/operations.ts:2358`) mengurutkan menurut
`listType.localeCompare(...)`. Secara alfabetis `PPPSM` jatuh **sesudah** `DTTOT`, sedangkan
`DPPSPM` jatuh **sebelumnya**. Halaman Cek Watchlist karena itu kini menampilkan daftar
proliferasi lebih dahulu. Ini ditemukan oleh uji yang gagal, bukan oleh pembacaan rancangan —
`server/sanctionsWatchlistOperations.test.ts` kini mengunci urutan barunya beserta alasannya,
supaya perubahan itu tercatat sebagai keputusan, bukan sebagai kejutan berikutnya.

Satu fixture nyaris lolos: `{ id: 2, listType: "PPPSM" as const, … }` pada blok
`searchSanctionsWatchlist` tidak cocok dengan pola penggantian yang dipakai untuk baris lainnya,
**dan `tsc` tidak mengeluhkannya** karena larik itu tidak pernah diadu dengan tipe enumnya. Ia
tertangkap hanya karena berkasnya dibaca ulang. Uji penjaga pada Tugas 3 ada justru untuk kelas
kesalahan ini.

---

### Task 3: Sapuan prosa, pesan validasi, dan uji penjaga

**Files:** Modify `server/routers.ts`, `server/operations.ts`, `shared/sanctionsNameMatch.ts`,
`client/src/pages/SanctionsWatchlist.tsx`, `client/src/components/WatchlistCheck.tsx`,
`server/sanctionsWatchlistImport.ts`. Create `server/sanctionsListNaming.test.ts`.

- [x] **Step 1: Tulis uji penjaganya lebih dulu — ia harus GAGAL sekarang.** Meniru
      `server/notaKupvaIdentity.test.ts`, yang sudah menegakkan temuan BI 4 dengan cara yang sama.

```ts
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Menjaga satu ejaan untuk daftar sanksi proliferasi. Tiga ejaan BENAR dan tidak dijaga di sini:
 *   PPSPM  — tindak pidananya (kode parameter IRA, iraRiskTypes; kunci basis data)
 *   PPPSPM — program pencegahannya (APU PPT PPPSPM)
 *   DPPSPM — daftarnya, yang disimpan sanctions_watchlist_entries
 * Yang dijaga adalah PPPSM, yang tidak mengeja apa pun, dan "DTTOT/PPSPM" yang salah pasang.
 */
const ALLOWED_PPPSM = [
  // Kutipan APA ADANYA dari templat BI (pertanyaan KPMR_P4_3). Templatnya sendiri salah eja di
  // tengah kalimat yang empat kali menulis PPPSPM dengan benar. Menggantinya = memalsukan kutipan.
  "shared/iraKpmrCatalogue.ts",
  // Berkas ini sendiri — ia HARUS menyebut ejaan yang dilarangnya untuk dapat melarangnya.
  "server/sanctionsListNaming.test.ts",
];

/** Seluruh .ts/.tsx di bawah `dir`, rekursif, melewati node_modules dan dist. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "dist" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("ejaan daftar sanksi proliferasi", () => {
  it("tidak ada lagi PPPSM di sumber, kecuali kutipan templat BI", () => {
    const offenders = [...sourceFiles("server"), ...sourceFiles("shared"), ...sourceFiles("client/src"), "drizzle/schema.ts"]
      .filter((f) => !ALLOWED_PPPSM.some((a) => f.endsWith(a)))
      .filter((f) => readFileSync(f, "utf8").includes("PPPSM"));
    expect(offenders).toEqual([]);
  });

  it("kutipan KPMR_P4_3 masih utuh — penjaganya tidak boleh memancing orang memalsukan kutipan", () => {
    expect(readFileSync("shared/iraKpmrCatalogue.ts", "utf8")).toContain("tipologi TPPU, TPPT, dan PPPSM");
  });

  it("tidak ada lagi pesan DTTOT/PPSPM — pasangan daftarnya adalah DTTOT/DPPSPM", () => {
    const offenders = [...sourceFiles("server"), ...sourceFiles("shared"), ...sourceFiles("client/src")]
      .filter((f) => !f.endsWith("server/sanctionsListNaming.test.ts"))
      .filter((f) => readFileSync(f, "utf8").includes("DTTOT/PPSPM"));
    expect(offenders).toEqual([]);
  });

  it("riwayat migrasi tidak ikut disunting", () => {
    // 0033 MEMBUAT tabel ini dengan enum('DTTOT','PPPSM'). Hash-nya tersimpan di
    // __drizzle_migrations, termasuk di produksi. Menyuntingnya merusak jurnalnya selamanya.
    expect(readFileSync("drizzle/0033_pretty_killraven.sql", "utf8")).toContain("enum('DTTOT','PPPSM')");
  });
});
```

      **Berkas ujinya masuk daftar putihnya sendiri** — ia wajib menyebut ejaan yang dilarangnya
      untuk dapat melarangnya. Tanpa itu, uji pertama gagal atas berkasnya sendiri sejak menit
      pertama.

      **Uji keempat sengaja menegakkan yang TIDAK boleh berubah**, bukan yang berubah. Tanpanya,
      sesi berikutnya yang menjalankan sapuan cari-ganti akan "merapikan" `drizzle/` dan baru
      ketahuan saat migrasi produksi gagal.

- [x] **Step 2: Perbaiki 15 kemunculan `"DTTOT/PPSPM"`** menjadi `"DTTOT/DPPSPM"` — di antaranya
      `server/routers.ts:302,344` dan `server/operations.ts:645,809,940`. Ini adalah separuh
      ketidakkonsistenan yang dikeluhkan spec: petugas yang mencentang kotak dan petugas yang gagal
      validasi selama ini melihat dua ejaan berbeda untuk hal yang sama.

      **Nama kolom `dttotPpsdmMatch`/`dttotPpsdmNotes` TIDAK ikut berubah** (keputusan pengguna 1) —
      yang berubah hanya teks pesannya, bukan `path: ["dttotPpsdmNotes"]`.

- [x] **Step 3: Sapu prosa dan teks UI** yang tersisa: `shared/sanctionsNameMatch.ts:2,7,106`,
      `server/operations.ts:2310,2315,2316,2369,2405,2408`,
      `server/sanctionsWatchlistImport.ts:5,13,20,22,138,173,181,200,208`,
      `client/src/components/WatchlistCheck.tsx:10,11,25`,
      `client/src/pages/SanctionsWatchlist.tsx:68,106,127`.

      Teks yang dilihat pengguna dan **pesan galat impor** ikut berubah — pesan galat adalah teks
      yang paling sering dibaca petugas, dan membiarkannya berbeda dari label di layar adalah
      persis ketidakkonsistenan yang sedang ditutup.

- [x] **Step 4: Tambahkan komentar penambat** di atas kolom `dttotPpsdmMatch`
      (`drizzle/schema.ts:154-156`), karena pengenalnya sengaja dibiarkan salah:

```ts
/**
 * Kecocokan dengan DTTOT / DPPSPM. **Nama kolomnya salah eja** — `Ppsdm` adalah akronim
 * kepegawaian, bukan proliferasi. Sengaja tidak diganti (Paket K2, keputusan pengguna 9 September
 * 2026): nol baris memakainya, sehingga penggantian nama menyentuh skema masukan tRPC dan muatan
 * klien demi hasil yang murni kosmetik. Yang dimaksud adalah DPPSPM.
 */
```

- [x] **Step 5: Verifikasi dan commit.**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
grep -rn "PPPSM\|DTTOT/PPSPM" --include='*.ts' --include='*.tsx' server shared client drizzle/schema.ts
# Yang tersisa HANYA shared/iraKpmrCatalogue.ts:291 dan berkas uji penjaganya sendiri.
git add server/ shared/ client/ drizzle/schema.ts
git commit -m "Satu ejaan DPPSPM pada prosa dan pesan, dengan uji penjaganya"
```

**Hasil nyata, 9 September 2026.** Penjaganya `server/sanctionsListNaming.test.ts`, enam uji.
Sesudah sapuan, satu-satunya berkas sumber yang masih memuat `PPPSM` adalah kedua berkas daftar
putihnya. Uji: 152 berkas, **1305 lulus**, 2 dilewati; `tsc` bersih; `vite build` sukses.

Penjaganya **diuji negatif**: satu baris `PPPSM` disisipkan ke `shared/sanctionsNameMatch.ts`,
ujinya gagal dan menyebut berkasnya; baris itu lalu dibuang.

**Dua uji tambahan di luar rencana semula, keduanya menutup cara penjaga ini gagal diam-diam:**

1. **"memindai berkas sumber dalam jumlah yang masuk akal"** — bila `sourceFiles` salah jalur, ia
   mengembalikan larik kosong dan **seluruh uji lainnya lulus tanpa memeriksa apa pun.** Penjaga
   yang selalu hijau lebih berbahaya daripada tidak ada penjaga.
2. **"kode parameter IRA tidak ikut tersapu"** — mengunci `PPSPM_1A`, `PPSPM_4A`, dan
   `iraRiskTypes`. `PPSPM` adalah substring dari `PPPSPM` maupun `DPPSPM`, jadi sapuan cari-ganti
   naif berikutnya akan merusak kunci basis data pada `ira_inherent_values`.

**Sapuan `perl -pi -e s{PPPSM}{DPPSPM}g` merusak dua hal yang ditulisnya sendiri**, dan keduanya
hanya tertangkap karena uji dijalankan:

- Penegasan negatif `not.toContain("PPPSM")` pada Tugas 2 berubah menjadi `not.toContain("DPPSPM")`
  — yang jelas dilanggar nilainya sendiri. Penegasan itu **dihapus**, bukan diperbaiki: ejaan pada
  sumber sudah dijaga berkas penjaga, dan menuliskan literal terlarang di sana justru menuntut
  daftar putih tambahan.
- Komentar urutan pada `sanctionsWatchlistOperations.test.ts` berubah menjadi kalimat yang
  membandingkan `DPPSPM` dengan dirinya sendiri. Ditulis ulang tanpa literal terlarangnya.

Pelajarannya ditulis di sini supaya tidak diulang: **sapuan buta atas berkas uji akan menyunting
penegasan, bukan hanya prosa.**

---

### Task 4: Dokumentasi, rollback tertulis, dan antrean migrasi produksi

**Files:** Modify `docs/SKEMA-DATABASE-PROJECT.md`, `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`,
`docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`, `docs/superpowers/PROMPT-SESI.md`.

- [x] **Step 1: `SKEMA-DATABASE-PROJECT.md`** — nilai enum `sanctions_watchlist_entries.listType`
      menjadi `DTTOT | DPPSPM`, beserta catatan bahwa `customers.dttotPpsdm*` salah eja dengan
      sengaja dan yang dimaksud adalah DPPSPM.

- [x] **Step 2: `BUKU-PANDUAN-PENGGUNAAN-A-Z.md`** — teks yang dilihat pengguna pada halaman Cek
      Watchlist dan borang nasabah.

- [x] **Step 3: Tulis prosedur rollback** di bagian akhir rencana ini (bukan di dokumen terpisah,
      supaya terbaca oleh sesi yang menjalankan migrasinya):

```sql
-- 1. Cadangkan lebih dulu:  mysqldump <db> sanctions_watchlist_entries > backup.sql
-- 2. Kebalikan persis dari 0056:
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','PPPSM','DPPSPM') NOT NULL;
UPDATE `sanctions_watchlist_entries` SET `listType` = 'PPPSM' WHERE `listType` = 'DPPSPM';
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','PPPSM') NOT NULL;
-- 3. Hapus baris 0056 dari __drizzle_migrations.
-- 4. git revert commit Tugas 2 dan Tugas 3.
```

- [x] **Step 4: Perbarui angka antrean migrasi produksi pada `PROMPT-SESI.md` menjadi 23.**
      Koreksi besarnya **sudah dilakukan pada sesi rancangan 9 September 2026** — bagian "Risiko
      residual Paket J2" dahulu menyebut `0051`–`0055`, sementara jurnal produksi berisi 34 baris
      sehingga yang tertunda adalah `0034`–`0055`, **dua puluh dua**. Yang tersisa di sini hanyalah
      menambahkan `0056` sehingga antreannya menjadi **dua puluh tiga**.

- [x] **Step 5: Centang seluruh baris Status Pengerjaan** pada rencana ini dan pada bagian Paket K2
      di ROADMAP.

- [x] **Step 6: Verifikasi dan commit.**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add docs/
git commit -m "Dokumentasi Paket K2 dan koreksi antrean migrasi produksi"
```

---

## Prosedur rollback migrasi `0056`

Ditulis sebelum migrasinya dijalankan, dan **belum pernah dijalankan** — 239 baris produksi belum
tersentuh karena paket ini tidak menyentuh produksi sama sekali.

```bash
# 1. Cadangkan lebih dulu. --set-gtid-purged=OFF WAJIB: tanpanya berkasnya menyertakan
#    SET @@GLOBAL.GTID_PURGED dan MENOLAK dipulihkan ke server yang sama (ERROR 3546).
mysqldump -h <host> -u <user> -p --single-transaction --set-gtid-purged=OFF <db> sanctions_watchlist_entries > k2-rollback-before.sql

# 2. Buktikan cadangannya benar-benar dapat dipulihkan SEBELUM melangkah.
mysql -h <host> -u <user> -p -e "DROP DATABASE IF EXISTS mc_k2_scratch; CREATE DATABASE mc_k2_scratch;"
mysql -h <host> -u <user> -p mc_k2_scratch < k2-rollback-before.sql && echo "cadangan dapat dipulihkan"
mysql -h <host> -u <user> -p -e "DROP DATABASE mc_k2_scratch;"
```

```sql
-- 3. Kebalikan persis dari 0056, tiga langkah, urutannya mengikat.
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','PPPSM','DPPSPM') NOT NULL;
UPDATE `sanctions_watchlist_entries` SET `listType` = 'PPPSM' WHERE `listType` = 'DPPSPM';
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','PPPSM') NOT NULL;

-- 4. Periksa: tidak boleh ada baris berjenis kosong, dan jumlah per lingkup harus utuh.
SELECT listType, IFNULL(sourceLabel,'(null)'), entityType, COUNT(*) FROM `sanctions_watchlist_entries` GROUP BY 1,2,3 ORDER BY 1,2,3;
SELECT COUNT(*) AS sisa_kosong FROM `sanctions_watchlist_entries` WHERE `listType` = '';

-- 5. Hapus baris 0056 dari jurnal migrasinya.
DELETE FROM `__drizzle_migrations` WHERE `hash` = (SELECT hash FROM (SELECT hash FROM `__drizzle_migrations` ORDER BY id DESC LIMIT 1) t);
```

```bash
# 6. Kembalikan kodenya. Ketiga commit-nya berdiri sendiri dan dapat di-revert terpisah,
#    tetapi Tugas 3 harus lebih dulu daripada Tugas 2 — penjaganya melarang ejaan yang
#    dikembalikan Tugas 2.
git revert <commit Tugas 3> <commit Tugas 2>
```

**Yang membuat rollback ini aman:** langkah 3 melebarkan enum lebih dulu, persis seperti migrasinya,
sehingga setiap baris tetap sah pada setiap langkah dan hasilnya tidak bergantung pada `sql_mode`.

---

## Risiko residual sesudah paket ini

Salin ke ROADMAP saat menutup paket.

1. **Pengenal `dttotPpsdmMatch`/`dttotPpsdmNotes` tetap salah eja** — sengaja, keputusan pengguna 1.
   Peredamnya hanya komentar Drizzle pada Tugas 3 Step 4.
2. **Migrasinya belum pernah dijalankan di atas 239 baris sungguhan.** Peragaan lokal memakai
   ±20 baris sintetis berbentuk sama. Yang belum terbukti adalah waktunya, bukan kebenarannya.
3. **Antrean migrasi produksi menjadi 23** (`0034`–`0056`). Menerapkannya adalah pekerjaan
   tersendiri yang harus direncanakan sendiri.
4. **Kutipan `PPPSM` pada `KPMR_P4_3` akan selalu tampak seperti bug** bagi sesi berikutnya. Daftar
   putih pada uji penjaga beserta komentarnya adalah satu-satunya yang menahannya.
5. **`pnpm audit --prod --audit-level=high` masih 9 temuan** (6 sedang, 3 tinggi). Paket ini tidak
   menambah dependensi dan tidak memperbaikinya. **Jangan menyebut audit bersih.**
