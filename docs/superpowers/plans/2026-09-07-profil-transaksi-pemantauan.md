# Paket H — Profil transaksi dan pemantauan berkala

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup temuan BI 10 dan sisa temuan 9 — nasabah mendeklarasikan aktivitas yang diharapkan, aplikasi membandingkan aktivitas nyata terhadapnya secara berkala menurut risiko, dan Controller menutup tiap peninjauan dengan jejak yang dapat ditunjukkan pemeriksa.

**Architecture:** Tiga kolom deklarasi pada `customers` beserta penulisnya di borang nasabah; tabel jejak `customer_profile_reviews` meniru `employee_profile_reviews`; penilaian penyimpangan dan irama berbasis risiko sebagai fungsi **murni** di `shared/transactionProfile.ts`; worklist Controller yang hanya mencatat.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-09-07-profil-transaksi-pemantauan-design.md`

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu.**

- [x] Tugas 1 — Penilaian penyimpangan dan irama berbasis risiko, murni dan teruji
- [x] Tugas 2 — Migrasi: tiga kolom deklarasi dan tabel `customer_profile_reviews`
- [x] Tugas 3 — Penulis deklarasi: borang nasabah, `createCustomer`, `updateCustomer`
- [x] Tugas 4 — Jendela bulanan WIB bersama dan pembacaan aktivitas nyata
- [x] Tugas 5 — Worklist pemantauan: query, otorisasi, dan batas "hanya mencatat"
- [ ] Tugas 6 — Penulis peninjauan: `recordCustomerProfileReview` beserta auditnya
- [ ] Tugas 7 — Halaman Pemantauan Profil Nasabah
- [ ] Tugas 8 — `profileMismatch` menjadi perbandingan sungguhan pada jalur transaksi
- [ ] Tugas 9 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

Urutannya mengikat: **1 dan 2 sebelum segalanya**; 3 sebelum 8 dan 9; 4 sebelum 5; 5 sebelum 6 dan
7; 6 sebelum 7; 1 dan 3 sebelum 8. Tugas 9 terakhir.

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
- **Jangan mengubah `assessReviewRequirement`** (`server/operations.ts:219`) **sebelum Tugas 8**,
  dan pada Tugas 8 hanya sebatas yang tertulis di sana.
- Batas jendela harian dan bulanan **sudah diperbaiki** 7 September 2026 di luar paket ini: ia
  memakai `startOfOperationalDay`/`startOfOperationalMonth` pada `shared/regulatoryActionQueue.ts`.
  **Pakai helper yang sama** untuk jendela bulanan pemantauan; jangan menulis yang ketiga.
- **Jangan menulis ke `customers` dari jalur pemantauan.** Satu-satunya tulisan paket ini adalah
  baris `customer_profile_reviews`.
- **Jangan menambahkan pelaporan otomatis** ke PPATK, BI, atau siapa pun.
- Peran `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Worklist dan peninjauan: **Controller ke atas**,
  ditegakkan di tRPC, bukan disembunyikan di UI.
- **Zona waktu:** hari dan bulan operasional adalah **WIB**. Pakai `jakartaBusinessDate` dan helper
  bulanan bersama dari Tugas 4; jangan memakai `getFullYear()`/`getMonth()` waktu lokal proses.
- **Data uji lokal paket E, F1, F2, dan G sengaja dibiarkan.** Jangan membersihkannya.
- **Membuat data uji pada basis data lokal (`moneychanger` dan `mc_t_abcvalas`) diizinkan pada
  tahap mana pun tanpa bertanya lebih dulu** — ditetapkan pengguna 8 September 2026 dan dicatat
  pada `CLAUDE.md`. Produksi tetap tidak boleh disentuh.
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
| `server/operations.ts` | `profileMismatch` membandingkan aktivitas terhadap profil | 8 |
| `server/profileMismatchReview.test.ts` | Uji bendera baru dan bendera lama yang tidak berubah | 8 |
| `server/customerProfileScenario.test.ts` | Skenario menyeluruh | 9 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku dan skema yang berubah | 9 |

---

### Task 1: Penilaian penyimpangan dan irama berbasis risiko, murni dan teruji

**Files:** Create `shared/transactionProfile.ts`, `shared/transactionProfile.test.ts`

**Interfaces:**
- Consumes: tidak ada. Fungsi murni; tidak menyentuh basis data dan tidak membaca jam.
- Produces: `PROFILE_DEVIATION_MULTIPLE`, `assessProfileDeviation`, `profileReviewIntervalMonths`, `isProfileReviewDue`.

- [x] **Step 1: Tulis uji yang gagal** — sisi batasnya yang paling mudah salah:

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

- [x] **Step 2: Tulis fungsinya.** Murni. Ambang sebagai konstanta bernama
      `PROFILE_DEVIATION_MULTIPLE = 2` beserta komentar yang menyebut tanggal keputusan penggunanya.
- [x] **Step 3: Irama** — `HIGH` 1, `MEDIUM` 3, `LOW` 12 bulan. Nasabah yang belum pernah ditinjau
      **selalu** jatuh tempo. Uji ketiga peran risiko dan kasus "belum pernah ditinjau".
- [x] **Step 4:** Perintah mutu, lalu commit `"Penilaian penyimpangan profil transaksi"`.

---

### Task 2: Migrasi — tiga kolom deklarasi dan tabel jejak peninjauan

**Files:** Modify `drizzle/schema.ts`; Create migrasi

- [x] **Step 1: Tulis skemanya di `drizzle/schema.ts` lebih dulu**, jangan menulis SQL sendiri.
      Tiga kolom **nullable** pada `customers` (spec bagian 1) dan tabel `customer_profile_reviews`
      (spec bagian 2) yang **memakai ulang** `profileReviewOutcomes`.
- [x] **Step 2: `./node_modules/.bin/drizzle-kit generate`**, lalu **baca SQL-nya**. Pastikan
      seluruhnya aditif: tidak ada `DROP`, tidak ada `NOT NULL` tanpa nilai bawaan pada tabel berisi.
- [x] **Step 3: Catat rencana rollback** pada berkas rencana ini sebelum menerapkan — tiga
      `ALTER TABLE customers DROP COLUMN` dan satu `DROP TABLE`. Aditif, jadi rollbacknya aman;
      tetap tuliskan.

**Migrasi yang dihasilkan:** `drizzle/0051_chilly_nicolaos.sql`. SQL-nya dibaca sebelum diterapkan
dan seluruhnya aditif: satu `CREATE TABLE customer_profile_reviews`, tiga `ADD COLUMN` yang semuanya
**nullable tanpa nilai bawaan**, dan satu `CREATE INDEX` pada tabel baru itu. Tidak ada `DROP`,
tidak ada `NOT NULL` pada `customers` yang sudah berisi baris nyata, dan tidak ada kolom lama yang
disentuh.

**Rencana rollback** (dicatat 8 September 2026, sebelum migrasi diterapkan). Dijalankan pada tiap
basis data yang menerima migrasi ini — lokal `moneychanger` dan `mc_t_abcvalas`:

```sql
DROP TABLE IF EXISTS `customer_profile_reviews`;
ALTER TABLE `customers` DROP COLUMN `declaredCurrencies`;
ALTER TABLE `customers` DROP COLUMN `declaredMonthlyCount`;
ALTER TABLE `customers` DROP COLUMN `declaredMonthlyValueIdr`;
```

Sesudah itu hapus baris `0051` dari `drizzle/meta/_journal.json`, berkas `drizzle/0051_*.sql`, dan
`drizzle/meta/0051_snapshot.json`, lalu kembalikan `drizzle/schema.ts`.

**Yang hilang bila rollback dijalankan:** deklarasi profil yang sudah diisi nasabah dan seluruh
jejak `customer_profile_reviews`. Kolom lama `customers` tidak tersentuh, jadi data nasabah yang
sudah ada aman. Ambil cadangan kedua basis data lokal lebih dulu bila sudah ada deklarasi terisi.
- [x] **Step 4: Terapkan** dengan `node scripts/tenant.mjs migrate-all`. **Jangan** menjalankan
      `.sql` langsung. Periksa kedua basis data lokal menerima migrasinya.
- [x] **Step 5:** Perintah mutu, lalu commit `"Kolom profil transaksi dan jejak peninjauan nasabah"`.

---

### Task 3: Penulis deklarasi — borang nasabah dan operasinya

**Files:** Modify `client/src/pages/Customers.tsx`, `server/operations.ts`, `server/routers.ts`

Aturan `CLAUDE.md` "Fitur Harus Punya Sumber Data": **kolomnya tidak boleh ada tanpa penulisnya.**

- [x] **Step 1: Uji yang gagal** — `createCustomer` menyimpan ketiga nilainya; `updateCustomer`
      mengubahnya dan **mencatat perubahannya pada audit** seperti kolom profil lain; deklarasi
      kosong tetap boleh disimpan (nasabah lama).
- [x] **Step 2: Skema Zod** — nilai Rupiah desimal non-negatif, frekuensi bilangan bulat
      non-negatif, mata uang array kode yang **sudah ada pada tabel mata uang**; kode tak dikenal
      ditolak dengan pesannya, bukan disimpan diam-diam.
- [x] **Step 3: Tiga isian pada borang nasabah**, dengan label yang menyatakan bahwa ini
      **pernyataan nasabah**, bukan batas yang ditegakkan sistem. Loading/empty/error state dan
      fokus keyboard mengikuti isian yang sudah ada di halaman itu.
- [x] **Step 4: Verifikasi visual** borang nasabah, memakai data uji lokal yang dibuat sendiri.
      Login tetap dilakukan pengguna; minta pada giliran itu.

**Temuan saat verifikasi visual:** borang penyuntingan `client/src/pages/CustomerList.tsx` mengirim
`...editForm` yang belum memuat ketiga kolom deklarasi, sehingga menyunting kolom apa pun akan
**menghapus deklarasi nasabah** tanpa terlihat. Diperbaiki dalam tugas ini: borang penyuntingan kini
membawa dan mengirimkan ketiganya, dan tampilan rinciannya menampilkannya ("Belum dideklarasikan"
bila kosong). Kontraknya dikunci pada `server/customerProfileDeclaration.test.ts`.
- [x] **Step 5:** Perintah mutu, lalu commit `"Deklarasi profil transaksi pada borang nasabah"`.

---

### Task 4: Jendela bulanan WIB bersama dan pembacaan aktivitas nyata

**Files:** Create `server/customerProfileMonitoring.ts`, `server/customerProfileMonitoring.test.ts`

- [x] **Step 1: Uji yang gagal** — jendela bulan WIB benar pada tiga zona waktu proses: UTC, WIB
      (GMT+7), dan **satu zona negatif** (mis. `America/New_York`). Zona negatiflah yang
      menjatuhkan pola `new Date(y, m, 1)` yang dipakai `operations.ts:1444`.
- [x] **Step 2: Tulis satu helper bersama** untuk jendela bulanan, diturunkan dari
      `jakartaBusinessDate`, dan pakai **hanya** helper itu di paket ini. Jangan menyalin pola
      lamanya. Jangan menyentuh baris 1444.
- [x] **Step 3: Baca aktivitas nyata** per nasabah untuk satu bulan WIB: total Rupiah, banyaknya
      transaksi, dan himpunan kode mata uang. Ikuti **persis** penyaringan yang sudah dipakai
      akumulasi bulanan (`operations.ts:1446-1454`): status `DRAFT`/`PENDING_REVIEW`/`APPROVED`/
      `RETURNED`/`COMPLETED`, `isDemo: false`, `isHistorical: false`. Dua definisi "aktivitas
      sebulan" yang berbeda pendapat adalah kekeliruan yang tidak terlihat dari layar mana pun.
- [x] **Step 4:** Perintah mutu, lalu commit `"Jendela bulanan WIB dan aktivitas nyata nasabah"`.

**Catatan Tugas 4.** Dua hal yang ditemukan saat memverifikasi query-nya terhadap basis data lokal:

1. **Bon berbaris banyak.** `rupiahAmount` pada bon berbaris banyak adalah nilai **bonnya**, bukan
   nilai barisnya, dan mata uangnya ada di `exchange_transaction_lines` (kolom `currencyId` pada
   bonnya kosong). Menjumlahkan hasil join apa adanya menghitung bon yang sama berkali-kali;
   membaca kolom lamanya saja membuat mata uang tak terdeklarasi pada bon berbaris banyak tidak
   pernah terlihat. `foldMonthlyActivity` menghitung nilai per **transaksi** dan mengumpulkan mata
   uang dari seluruh baris.
2. **Daftar statusnya kini satu**, bukan dua yang disalin: `ACCUMULATED_TRANSACTION_STATUSES` pada
   `drizzle/schema.ts` dipakai akumulasi harian dan bulanan pada jalur transaksi maupun pemantauan
   profil. Ditaruh di skema, bukan di salah satu modul, agar tidak ada impor melingkar —
   `customerProfileMonitoring.ts` mengimpor `databaseOrThrow` dari `operations.ts`.
3. **`transactionAt` tersimpan sebagai jam UTC**, bukan WIB — Drizzle menserialisasi kolom
   `datetime` sebagai string UTC, berbeda dari kolom `date` yang diformat mysql2 memakai zona
   proses. Dibuktikan round-trip lewat penulis aplikasinya sendiri. Batas instan dari
   `startOfOperationalMonth` karena itu sudah benar apa adanya.

**Data uji lokal Tugas 4 (`FX-UJI-T4-*` pada `moneychanger`) sengaja dibiarkan** untuk Tugas 5, 7,
dan 9: tujuh bon pada nasabah `CIF-000001`, termasuk kedua sisi batas bulan dan satu bon
berbaris banyak. Aktivitas September 2026-nya: Rp 17.000.000, 4 transaksi, USD+SGD+JPY.

---

### Task 5: Worklist pemantauan — query, otorisasi, dan batas "hanya mencatat"

**Files:** Modify `server/customerProfileMonitoring.ts`, `server/routers.ts`; Test `server/customerProfileMonitoring.authorization.test.ts`

- [x] **Step 1: Uji otorisasi** — STAFF dan ADMIN ditolak `FORBIDDEN`; `mustChangePassword` ditolak;
      Controller dan Shareholder diterima. Polanya mengikuti
      `server/currencyRevaluation.authorization.test.ts`.
- [x] **Step 2: Uji batas** — memanggil worklist **tidak menyisipkan maupun memperbarui apa pun**.
      Pola `server/financialReporting.isolation.test.ts`: rekam `insert`/`update` yang dipanggil dan
      harapkan keduanya kosong.
- [x] **Step 3: `listCustomerProfileMonitoring({ asOf })`** — nasabah jatuh tempo beserta alasan
      penyimpangan dan konteks frekuensinya. Nasabah `isDemo`/`isHistorical` **tidak** ikut.
- [x] **Step 4:** Perintah mutu, lalu commit `"Worklist pemantauan profil nasabah"`.

**Catatan Tugas 5.** Uji batasnya ditaruh pada berkas tersendiri
(`server/customerProfileMonitoring.isolation.test.ts`) mengikuti pola `financialReporting.isolation`,
karena berkas otorisasinya memalsukan modul pemantauan itu sendiri sehingga tidak dapat sekaligus
menguji tulisannya. Batasnya juga diperiksa terhadap basis data lokal: snapshot `customers`,
`audit_logs`, `customer_profile_reviews`, dan `exchange_transactions` sebelum dan sesudah worklist
dibaca identik.

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
- [ ] **Step 4: Verifikasi visual** halaman dan rutenya, termasuk keadaan kosong, memakai data uji
      lokal yang dibuat sendiri. Login tetap dilakukan pengguna; minta pada giliran itu.
- [ ] **Step 5:** Perintah mutu, lalu commit `"Halaman pemantauan profil nasabah"`.

---

### Task 8: `profileMismatch` menjadi perbandingan sungguhan pada jalur transaksi

**Files:** Modify `server/operations.ts`; Test `server/profileMismatchReview.test.ts`

Menutup temuan yang dicatat spec bagian 2: hari ini `profileMismatch` berbunyi
`profileStatus === "RESTRICTED" || riskLevel === "HIGH"` — dua kolom kategori yang diisi manusia,
bukan perbandingan aktivitas terhadap profil. Nasabah `LOW` yang bertransaksi sepuluh kali lipat
kebiasaannya tidak pernah menyalakannya.

**Batas yang disetujui pengguna 7 September 2026:** transaksi yang menyimpang **dialirkan ke
review**, sama seperti ambang setara USD yang sudah ada. Ia **tidak memblokir** transaksi dan tidak
mengubah data nasabah. Bila ini terasa mengubah alur kasir lebih jauh dari yang dikehendaki,
**berhenti dan laporkan** sebelum melanjutkan.

- [ ] **Step 1: Uji yang gagal** — nasabah `LOW` berprofil terdeklarasi yang akumulasi bulanannya
      mencapai dua kali lipat menyalakan review beserta alasannya; nasabah yang sama di bawah ambang
      tidak; nasabah **tanpa deklarasi** tidak menyalakannya (kekosongan bukan penyimpangan pada
      jalur transaksi — ia urusan worklist, bukan urusan kasir).
- [ ] **Step 2: Uji bahwa bendera lama tidak berubah** — `RESTRICTED` dan `HIGH` tetap menyalakan
      review persis seperti sebelumnya, dan ketiga ambang yang sudah ada
      (`underlyingMonthlyThreshold.test.ts`) tetap hijau tanpa disunting.
- [ ] **Step 3: Alirkan `assessProfileDeviation`** dari Tugas 1 ke dalam `assessReviewRequirement`,
      menambah alasan `AKTIVITAS_MENYIMPANG_DARI_PROFIL`. Fungsi murni Tugas 1 **dipakai apa
      adanya**; jangan menyalin aturannya ke dalam `operations.ts`.
- [ ] **Step 4:** Perintah mutu, lalu commit `"Ketidaksesuaian profil menjadi perbandingan sungguhan"`.

---

### Task 9: Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

**Files:** Create `server/customerProfileScenario.test.ts`; Modify panduan A–Z, skema database, ROADMAP

- [ ] **Step 1: Skenario menyeluruh** dari data karangan: nasabah mendeklarasikan profil →
      bertransaksi di bawah ambang → tidak muncul → bertransaksi mencapai dua kali lipat → muncul
      beserta alasannya → Controller menutup peninjauan → tidak muncul lagi sampai iramanya jatuh
      tempo berikutnya.
- [ ] **Step 2: Skenario sisi batas** — nasabah tanpa deklarasi muncul sebagai
      `PROFIL_BELUM_DIDEKLARASIKAN`; nasabah `LOW` yang baru ditinjau tidak muncul selama dua belas
      bulan; mata uang tak terdeklarasi muncul sendirian tanpa penyimpangan nilai; dan **frekuensi
      menyimpang sendirian** — banyak transaksi kecil yang totalnya masih di bawah ambang nilai.
- [ ] **Step 3: Peragaan end-to-end** pada `moneychanger`, membuat data uji yang diperlukan
      langsung (diizinkan pengguna 8 September 2026). Perlihatkan juga keadaan hari pertama apa
      adanya: nasabah tanpa deklarasi jatuh tempo dan belum berdeklarasi.
- [ ] **Step 4: Perbarui dokumentasi** — panduan A–Z (cara mendeklarasikan profil, cara kerja
      worklist, dan apa yang aplikasi **tidak** lakukan), skema database (tiga kolom dan tabel
      baru beserta migrasinya), dan ROADMAP.
- [ ] **Step 5:** Perintah mutu, sebutkan angka uji yang benar-benar dilihat, lalu commit
      `"Skenario pemantauan profil menyeluruh, peragaan, dan dokumentasi"`.
