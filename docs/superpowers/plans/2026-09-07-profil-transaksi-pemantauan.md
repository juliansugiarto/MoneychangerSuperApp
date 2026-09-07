# Paket H — Profil transaksi dan pemantauan berkala

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup temuan BI 10 dan sisa temuan 9 — nasabah mendeklarasikan aktivitas yang diharapkan, aplikasi membandingkan aktivitas nyata terhadapnya secara berkala menurut risiko, dan Controller menutup tiap peninjauan dengan jejak yang dapat ditunjukkan pemeriksa.

**Architecture:** Tiga kolom deklarasi pada `customers` beserta penulisnya di borang nasabah; tabel jejak `customer_profile_reviews` meniru `employee_profile_reviews`; penilaian penyimpangan dan irama berbasis risiko sebagai fungsi **murni** di `shared/transactionProfile.ts`; worklist Controller yang hanya mencatat.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-09-07-profil-transaksi-pemantauan-design.md`

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu.**

- [ ] Tugas 1 — Penilaian penyimpangan dan irama berbasis risiko, murni dan teruji
- [ ] Tugas 2 — Migrasi: tiga kolom deklarasi dan tabel `customer_profile_reviews`
- [ ] Tugas 3 — Penulis deklarasi: borang nasabah, `createCustomer`, `updateCustomer`
- [ ] Tugas 4 — Jendela bulanan WIB bersama dan pembacaan aktivitas nyata
- [ ] Tugas 5 — Worklist pemantauan: query, otorisasi, dan batas "hanya mencatat"
- [ ] Tugas 6 — Penulis peninjauan: `recordCustomerProfileReview` beserta auditnya
- [ ] Tugas 7 — Halaman Pemantauan Profil Nasabah
- [ ] Tugas 8 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

Urutannya mengikat: **1 dan 2 sebelum segalanya**; 3 sebelum 8; 4 sebelum 5; 5 sebelum 6 dan 7;
6 sebelum 7. Tugas 8 terakhir.

## Keputusan pengguna yang mengikat

Ditetapkan 7 September 2026. **Jangan menurunkannya ulang dan jangan menawarnya.**

1. Deklarasi nasabah: **nilai** Rupiah sebulan, **frekuensi** sebulan, **mata uang** yang diharapkan.
2. Ambang penyimpangan nilai: **total sebulan ≥ deklarasi × 2**.
3. Mata uang tak terdeklarasi: **alasan penyimpangan tersendiri**.
4. Frekuensi: **juga menyalakan bendera**, memakai pengali yang sama — banyaknya transaksi sebulan
   **≥ deklarasi × 2**. Jangan mengarang pengali kedua.
5. Irama: **HIGH 1 bulan, MEDIUM 3 bulan, LOW 12 bulan**.
6. Tindak lanjut: **worklist Controller, hanya mencatat** — tidak pernah mengubah data nasabah,
   tidak pernah memblokir transaksi, tidak pernah melapor sendiri.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Muat variabel lingkungan lebih dulu:
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Perintah mutu wajib: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`,
  `./node_modules/.bin/vite build`.
- **Baseline sebelum paket ini, dijalankan 7 September 2026 sesudah Paket G:**
  `Test Files 124 passed (124)`, `Tests 973 passed | 2 skipped (975)`. **Sebutkan angka yang
  benar-benar dilihat, jangan mengarang.**
- **Satu uji diketahui flaky dan bukan bagian paket ini:** `server/tenantIsolation.live.test.ts` >
  *"setiap ikatan hanya melihat database miliknya sendiri"*. Bila gagal sendirian di bawah beban,
  jalankan ulang berkas itu saja.
- **Migrasi hanya lewat `node scripts/tenant.mjs migrate-all`**, tidak pernah menjalankan `.sql`
  langsung. Dua basis data lokal saja: `moneychanger` dan `mc_t_abcvalas`. **Jangan menerapkan
  migrasi ke produksi.**
- **Jangan mengubah `assessReviewRequirement`** (`server/operations.ts:219`). Spec bagian 7.
- **Jangan memperbaiki `server/operations.ts:1444`** pada paket ini. Spec bagian 5.
- **Jangan menulis ke `customers` dari jalur pemantauan.** Satu-satunya tulisan paket ini adalah
  baris `customer_profile_reviews`.
- **Jangan menambahkan pelaporan otomatis** ke PPATK, BI, atau siapa pun.
- Peran `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Worklist dan peninjauan: **Controller ke atas**,
  ditegakkan di tRPC, bukan disembunyikan di UI.
- **Zona waktu:** hari dan bulan operasional adalah **WIB**. Pakai `jakartaBusinessDate` dan helper
  bulanan bersama dari Tugas 4; jangan memakai `getFullYear()`/`getMonth()` waktu lokal proses.
- **Data uji lokal paket E, F1, F2, dan G sengaja dibiarkan.** Jangan membersihkannya.
- Nasabah nyata, transaksi nyata, dan `audit_logs` produksi tidak boleh dikarang atau disunting.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `shared/transactionProfile.ts` | Penilaian penyimpangan, irama berbasis risiko, konstanta ambang | 1 |
| `shared/transactionProfile.test.ts` | Uji ambang, sisi batas, dan irama | 1 |
| `drizzle/schema.ts` | Tiga kolom `customers` dan tabel `customer_profile_reviews` | 2 |
| `drizzle/migrations/*` | Migrasi hasil `drizzle-kit generate` | 2 |
| `client/src/pages/Customers.tsx` | Tiga isian deklarasi pada borang nasabah | 3 |
| `server/operations.ts` | `createCustomer`/`updateCustomer` menyimpan deklarasi | 3 |
| `server/routers.ts` | Skema Zod deklarasi; prosedur worklist dan peninjauan | 3, 5, 6 |
| `server/customerProfileMonitoring.ts` | Jendela bulanan WIB, aktivitas nyata, worklist, penulis peninjauan | 4, 5, 6 |
| `server/customerProfileMonitoring.test.ts` | Uji jendela bulanan dan worklist | 4, 5 |
| `server/customerProfileMonitoring.authorization.test.ts` | Uji otorisasi dan batas "hanya mencatat" | 5, 6 |
| `client/src/pages/PemantauanProfil.tsx` | Halaman worklist Controller | 7 |
| `client/src/App.tsx`, `shared/backOfficeNavigation.ts` | Rute dan menu | 7 |
| `server/customerProfileScenario.test.ts` | Skenario menyeluruh | 8 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku dan skema yang berubah | 8 |

---

### Task 1: Penilaian penyimpangan dan irama berbasis risiko, murni dan teruji

**Files:** Create `shared/transactionProfile.ts`, `shared/transactionProfile.test.ts`

**Interfaces:**
- Consumes: tidak ada. Fungsi murni; tidak menyentuh basis data dan tidak membaca jam.
- Produces: `PROFILE_DEVIATION_MULTIPLE`, `assessProfileDeviation`, `profileReviewIntervalMonths`, `isProfileReviewDue`.

- [ ] **Step 1: Tulis uji yang gagal** — sisi batasnya yang paling mudah salah:

```ts
describe("penyimpangan profil transaksi", () => {
  it("menyalakan bendera tepat pada dua kali lipat, bukan sesudahnya", () => {
    // deklarasi 10jt, aktual 20jt → menyimpang; aktual 19,99jt → tidak.
  });
  it("tidak pernah menyimpang bila deklarasinya belum ada, melainkan PROFIL_BELUM_DIDEKLARASIKAN", () => {});
  it("menyebut mata uang tak terdeklarasi sebagai alasan tersendiri", () => {});
  it("menyalakan bendera frekuensi pada dua kali lipat deklarasi transaksinya", () => {});
  it("menyalakan frekuensi sendirian ketika nilainya masih wajar", () => {
    // Banyak transaksi kecil: totalnya di bawah ambang, jumlahnya dua kali lipat.
    // Inilah bentuk pemecahan transaksi yang paling perlu terlihat.
  });
  it("memperlakukan deklarasi nol sebagai belum dideklarasikan pada kedua ukuran", () => {});
});
```

**Deklarasi nol adalah jebakannya:** `0 × 2 = 0`, sehingga transaksi apa pun akan melewatinya dan
setiap nasabah berdeklarasi nol menyala selamanya. Perlakukan nol dan `null` sama-sama sebagai
**belum dideklarasikan**, pada **nilai maupun frekuensi**.

**Nilai dan frekuensi dinilai terpisah**, masing-masing dengan `PROFILE_DEVIATION_MULTIPLE` yang
sama. Keduanya dapat menyala sendiri-sendiri, dan menyalanya frekuensi sendirian adalah kasus yang
paling berarti — itu bentuk pemecahan transaksi.

- [ ] **Step 2: Tulis fungsinya.** Murni. Ambang sebagai konstanta bernama
      `PROFILE_DEVIATION_MULTIPLE = 2` beserta komentar yang menyebut tanggal keputusan penggunanya.
- [ ] **Step 3: Irama** — `HIGH` 1, `MEDIUM` 3, `LOW` 12 bulan. Nasabah yang belum pernah ditinjau
      **selalu** jatuh tempo. Uji ketiga peran risiko dan kasus "belum pernah ditinjau".
- [ ] **Step 4:** Perintah mutu, lalu commit `"Penilaian penyimpangan profil transaksi"`.

---

### Task 2: Migrasi — tiga kolom deklarasi dan tabel jejak peninjauan

**Files:** Modify `drizzle/schema.ts`; Create migrasi

- [ ] **Step 1: Tulis skemanya di `drizzle/schema.ts` lebih dulu**, jangan menulis SQL sendiri.
      Tiga kolom **nullable** pada `customers` (spec bagian 1) dan tabel `customer_profile_reviews`
      (spec bagian 2) yang **memakai ulang** `profileReviewOutcomes`.
- [ ] **Step 2: `./node_modules/.bin/drizzle-kit generate`**, lalu **baca SQL-nya**. Pastikan
      seluruhnya aditif: tidak ada `DROP`, tidak ada `NOT NULL` tanpa nilai bawaan pada tabel berisi.
- [ ] **Step 3: Catat rencana rollback** pada berkas rencana ini sebelum menerapkan — tiga
      `ALTER TABLE customers DROP COLUMN` dan satu `DROP TABLE`. Aditif, jadi rollbacknya aman;
      tetap tuliskan.
- [ ] **Step 4: Terapkan** dengan `node scripts/tenant.mjs migrate-all`. **Jangan** menjalankan
      `.sql` langsung. Periksa kedua basis data lokal menerima migrasinya.
- [ ] **Step 5:** Perintah mutu, lalu commit `"Kolom profil transaksi dan jejak peninjauan nasabah"`.

---

### Task 3: Penulis deklarasi — borang nasabah dan operasinya

**Files:** Modify `client/src/pages/Customers.tsx`, `server/operations.ts`, `server/routers.ts`

Aturan `CLAUDE.md` "Fitur Harus Punya Sumber Data": **kolomnya tidak boleh ada tanpa penulisnya.**

- [ ] **Step 1: Uji yang gagal** — `createCustomer` menyimpan ketiga nilainya; `updateCustomer`
      mengubahnya dan **mencatat perubahannya pada audit** seperti kolom profil lain; deklarasi
      kosong tetap boleh disimpan (nasabah lama).
- [ ] **Step 2: Skema Zod** — nilai Rupiah desimal non-negatif, frekuensi bilangan bulat
      non-negatif, mata uang array kode yang **sudah ada pada tabel mata uang**; kode tak dikenal
      ditolak dengan pesannya, bukan disimpan diam-diam.
- [ ] **Step 3: Tiga isian pada borang nasabah**, dengan label yang menyatakan bahwa ini
      **pernyataan nasabah**, bukan batas yang ditegakkan sistem. Loading/empty/error state dan
      fokus keyboard mengikuti isian yang sudah ada di halaman itu.
- [ ] **Step 4: Verifikasi visual** borang nasabah. Login dilakukan pengguna; minta pada giliran itu.
- [ ] **Step 5:** Perintah mutu, lalu commit `"Deklarasi profil transaksi pada borang nasabah"`.

---

### Task 4: Jendela bulanan WIB bersama dan pembacaan aktivitas nyata

**Files:** Create `server/customerProfileMonitoring.ts`, `server/customerProfileMonitoring.test.ts`

- [ ] **Step 1: Uji yang gagal** — jendela bulan WIB benar pada tiga zona waktu proses: UTC, WIB
      (GMT+7), dan **satu zona negatif** (mis. `America/New_York`). Zona negatiflah yang
      menjatuhkan pola `new Date(y, m, 1)` yang dipakai `operations.ts:1444`.
- [ ] **Step 2: Tulis satu helper bersama** untuk jendela bulanan, diturunkan dari
      `jakartaBusinessDate`, dan pakai **hanya** helper itu di paket ini. Jangan menyalin pola
      lamanya. Jangan menyentuh baris 1444.
- [ ] **Step 3: Baca aktivitas nyata** per nasabah untuk satu bulan WIB: total Rupiah, banyaknya
      transaksi, dan himpunan kode mata uang. Ikuti **persis** penyaringan yang sudah dipakai
      akumulasi bulanan (`operations.ts:1446-1454`): status `DRAFT`/`PENDING_REVIEW`/`APPROVED`/
      `RETURNED`/`COMPLETED`, `isDemo: false`, `isHistorical: false`. Dua definisi "aktivitas
      sebulan" yang berbeda pendapat adalah kekeliruan yang tidak terlihat dari layar mana pun.
- [ ] **Step 4:** Perintah mutu, lalu commit `"Jendela bulanan WIB dan aktivitas nyata nasabah"`.

---

### Task 5: Worklist pemantauan — query, otorisasi, dan batas "hanya mencatat"

**Files:** Modify `server/customerProfileMonitoring.ts`, `server/routers.ts`; Test `server/customerProfileMonitoring.authorization.test.ts`

- [ ] **Step 1: Uji otorisasi** — STAFF dan ADMIN ditolak `FORBIDDEN`; `mustChangePassword` ditolak;
      Controller dan Shareholder diterima. Polanya mengikuti
      `server/currencyRevaluation.authorization.test.ts`.
- [ ] **Step 2: Uji batas** — memanggil worklist **tidak menyisipkan maupun memperbarui apa pun**.
      Pola `server/financialReporting.isolation.test.ts`: rekam `insert`/`update` yang dipanggil dan
      harapkan keduanya kosong.
- [ ] **Step 3: `listCustomerProfileMonitoring({ asOf })`** — nasabah jatuh tempo beserta alasan
      penyimpangan dan konteks frekuensinya. Nasabah `isDemo`/`isHistorical` **tidak** ikut.
- [ ] **Step 4:** Perintah mutu, lalu commit `"Worklist pemantauan profil nasabah"`.

---

### Task 6: Penulis peninjauan beserta auditnya

**Files:** Modify `server/customerProfileMonitoring.ts`, `server/routers.ts`

- [ ] **Step 1: Uji yang gagal** — peninjauan tersimpan beserta `deviationReasons` yang **dibekukan
      apa adanya**; `notes` **wajib** bila `outcome` bukan `TIDAK_ADA_PERUBAHAN`; audit tertulis;
      dan `customers` **tidak** tersentuh (bandingkan barisnya sebelum dan sesudah).
- [ ] **Step 2: Tulis `recordCustomerProfileReview`.** Ikuti bentuk `sdmOperations.ts:529`.
- [ ] **Step 3:** Perintah mutu, lalu commit `"Pencatatan peninjauan profil nasabah"`.

---

### Task 7: Halaman Pemantauan Profil Nasabah

**Files:** Create `client/src/pages/PemantauanProfil.tsx`; Modify `client/src/App.tsx`, `shared/backOfficeNavigation.ts`

- [ ] **Step 1: Halaman worklist** — nasabah jatuh tempo, alasan penyimpangannya, deklarasi
      berdampingan dengan aktual, dan riwayat peninjauan terakhirnya. Loading/empty/error state,
      fokus keyboard, teks tindakan yang jelas.
- [ ] **Step 2: Kosong berarti kosong** — bila tidak ada yang jatuh tempo, katakan itu; jangan
      menampilkan tabel kosong tanpa penjelasan.
- [ ] **Step 3: Keterangan batas pada halamannya** — alat bantu penyaringan; tidak mengubah data
      nasabah, tidak memblokir transaksi, tidak melapor ke regulator.
- [ ] **Step 4: Verifikasi visual** halaman dan rutenya, termasuk keadaan kosong. Login dilakukan
      pengguna; minta pada giliran itu.
- [ ] **Step 5:** Perintah mutu, lalu commit `"Halaman pemantauan profil nasabah"`.

---

### Task 8: Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

**Files:** Create `server/customerProfileScenario.test.ts`; Modify panduan A–Z, skema database, ROADMAP

- [ ] **Step 1: Skenario menyeluruh** dari data karangan: nasabah mendeklarasikan profil →
      bertransaksi di bawah ambang → tidak muncul → bertransaksi mencapai dua kali lipat → muncul
      beserta alasannya → Controller menutup peninjauan → tidak muncul lagi sampai iramanya jatuh
      tempo berikutnya.
- [ ] **Step 2: Skenario sisi batas** — nasabah tanpa deklarasi muncul sebagai
      `PROFIL_BELUM_DIDEKLARASIKAN`; nasabah `LOW` yang baru ditinjau tidak muncul selama dua belas
      bulan; mata uang tak terdeklarasi muncul sendirian tanpa penyimpangan nilai; dan **frekuensi
      menyimpang sendirian** — banyak transaksi kecil yang totalnya masih di bawah ambang nilai.
- [ ] **Step 3: Peragaan end-to-end** pada `moneychanger` memakai data yang sudah ada.
      **Minta izin pengguna pada giliran itu** sebelum menulis data uji apa pun. Perlihatkan juga
      keadaan hari pertama apa adanya: seluruh nasabah lama jatuh tempo dan belum berdeklarasi.
- [ ] **Step 4: Perbarui dokumentasi** — panduan A–Z (cara mendeklarasikan profil, cara kerja
      worklist, dan apa yang aplikasi **tidak** lakukan), skema database (tiga kolom dan tabel
      baru beserta migrasinya), dan ROADMAP.
- [ ] **Step 5:** Perintah mutu, sebutkan angka uji yang benar-benar dilihat, lalu commit
      `"Skenario pemantauan profil menyeluruh, peragaan, dan dokumentasi"`.
