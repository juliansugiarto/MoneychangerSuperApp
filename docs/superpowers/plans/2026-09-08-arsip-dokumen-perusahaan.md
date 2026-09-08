# Paket I — Arsip dokumen perusahaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup temuan BI 3 — SOP, kebijakan internal, surat-menyurat BI, notulen rapat, dan korespondensi regulator punya tempat penyimpanan dengan **riwayat versi**, masa berlaku, penanggung jawab, dan worklist kedaluwarsa yang dapat ditunjukkan pemeriksa.

**Architecture:** Berkasnya tetap milik `operational_documents` (dua nilai enum baru); dua tabel baru `company_documents` dan `company_document_versions` di atasnya; penilaian masa berlaku sebagai fungsi **murni** di `shared/companyDocumentArchive.ts`; halaman Arsip Dokumen Controller yang **hanya mencatat**.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-09-08-arsip-dokumen-perusahaan-design.md`

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu.**

- [x] Tugas 1 — Penilaian masa berlaku dan worklist, murni dan teruji
- [x] Tugas 2 — Migrasi: dua nilai enum dan dua tabel arsip
- [x] Tugas 3 — Jalur unggah menerima berkas arsip, dengan gerbang Controller
- [ ] Tugas 4 — Penulis arsip: buat dokumen, ganti versi, nonaktifkan, beserta auditnya
- [ ] Tugas 5 — Pembaca arsip: daftar, riwayat versi, dan worklist
- [ ] Tugas 6 — Halaman Arsip Dokumen
- [ ] Tugas 7 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

Urutannya mengikat: **1 dan 2 sebelum segalanya**; 3 sebelum 4; 4 sebelum 5; 4 dan 5 sebelum 6.
Tugas 7 terakhir.

## Keputusan pengguna yang mengikat

Ditetapkan 8 September 2026. **Jangan menurunkannya ulang dan jangan menawarnya.**

1. Jenis dokumen: **enum tertutup enam nilai** — `SOP`, `KEBIJAKAN_INTERNAL`, `SURAT_BI`,
   `NOTULEN_RAPAT`, `KORESPONDENSI_REGULATOR`, `LAINNYA`. Judul **wajib** pada setiap dokumen.
2. Arsip menyimpan **riwayat versi penuh**. Berkas lama tetap dapat dibuka.
3. **Controller ke atas** untuk mengunggah, mengganti versi, dan menghapus. **Menghapus berarti
   menonaktifkan** — barisnya bertahan beserta pelaku, waktu, dan alasannya.
4. Dokumen **kedaluwarsa dan yang akan kedaluwarsa dalam 30 hari** muncul sebagai pekerjaan yang
   menunggu. **Hanya mencatat**, meniru worklist Paket H.
5. Dokumen Profil Perusahaan (`COMPANY_LOGO`, `LICENSE_CERTIFICATE`, `LICENSE_ATTACHMENT`)
   **tetap di tempatnya**. Tidak ada migrasi data atas baris produksi.
6. Penanggung jawab **menunjuk baris `employees`**, boleh kosong. Bukan nama bebas.
7. **Alasan perubahan wajib mulai versi kedua.** Versi pertama tidak perlu alasan.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Muat variabel lingkungan lebih dulu:
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Perintah mutu wajib: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`,
  `./node_modules/.bin/vite build`.
- **Baseline sebelum paket ini, dijalankan 8 September 2026 sesudah Paket H:**
  `Test Files 132 passed (132)`, `Tests 1049 passed | 2 skipped (1051)`. **Sebutkan angka yang
  benar-benar dilihat, jangan mengarang.**
- **Satu uji diketahui flaky dan bukan bagian paket ini:** `server/tenantIsolation.live.test.ts` >
  *"setiap ikatan hanya melihat database miliknya sendiri"*. Bila gagal sendirian di bawah beban,
  jalankan ulang berkas itu saja.
- **Migrasi hanya lewat `node scripts/tenant.mjs migrate-all`**, tidak pernah menjalankan `.sql`
  langsung — penanda `--> statement-breakpoint` membuat pernyataan kedua gagal dan jurnal
  `__drizzle_migrations` menjadi tidak konsisten. Dua basis data lokal saja: `moneychanger` dan
  `mc_t_abcvalas`. **Jangan menerapkan migrasi ke produksi.**
- **Tepat satu tugas migrasi di paket ini: Tugas 2.** Bila tugas lain ternyata menuntut perubahan
  skema, **berhenti dan laporkan** — jangan menambahkan migrasi kedua diam-diam.
- **Batas impor 5 MB dan `assertSpreadsheetSignature` tidak disentuh** (`server/financialImport.ts:10,22`;
  `server/sanctionsWatchlistImport.ts:26,72`). Itu jalur impor XLS/XLSX, bukan jalur dokumen. Jalur
  dokumen tetap `MAX_DOCUMENT_BYTES = 8 MB` dengan pemeriksaan MIME
  (`server/documentOperations.ts:6,49`); **jangan menurunkan, menaikkan, maupun melonggarkan salah
  satu dari keduanya.**
- **Jangan mengubah halaman Profil Perusahaan** (`client/src/pages/CompanyProfile.tsx`) maupun
  `listCompanyDocuments`/`deleteCompanyDocument`. `ownerType` arsip yang tersendiri dipilih justru
  agar keduanya tidak perlu berubah — bila ternyata harus, **berhenti dan laporkan**.
- **Zona waktu:** hari operasional adalah **WIB**. Pakai `startOfOperationalDay`
  (`shared/regulatoryActionQueue.ts:87`) beserta `company_profile.timezone`. **Jangan menulis helper
  hari operasional keempat**, dan jangan memakai `getFullYear()`/`getMonth()` waktu lokal proses
  untuk menurunkan "hari ini".
- **Jangan menyaring kolom `date` lewat SQL dengan `Date` tengah malam UTC** — itu menjatuhkan baris
  pada batasnya di mesin WIB. Baca barisnya, nilai statusnya di JavaScript sebagai kunci `YYYY-MM-DD`.
- Peran `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Seluruh jalur arsip: **Controller ke atas**,
  ditegakkan di tRPC dan di jalur REST, bukan disembunyikan di UI.
- **Jangan menyimpan dokumen KYC nyata, workbook aktual, secret, token, atau cookie** di source,
  fixture, log, screenshot, dokumentasi, maupun commit. Berkas uji dibuat sendiri di tempat
  (mis. buffer PDF/PNG kecil bikinan sendiri), bukan disalin dari berkas nyata.
- **Membuat data uji pada basis data lokal (`moneychanger` dan `mc_t_abcvalas`) diizinkan pada tahap
  mana pun tanpa bertanya lebih dulu** — ditetapkan pengguna 8 September 2026 dan dicatat pada
  `CLAUDE.md`. Produksi tetap tidak boleh disentuh.
- **Data uji lokal paket E, F1, F2, G, dan H sengaja dibiarkan.** Jangan membersihkannya.
- **Jangan menambahkan pengiriman otomatis** ke BI, PPATK, atau siapa pun.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `shared/companyDocumentArchive.ts` | Status masa berlaku, alasan worklist, konstanta 30 hari | 1 |
| `shared/companyDocumentArchive.test.ts` | Uji sisi batas dan tiga zona waktu proses | 1 |
| `drizzle/schema.ts` | Dua nilai enum, `companyDocuments`, `companyDocumentVersions` | 2 |
| `drizzle/0052_*.sql`, `drizzle/meta/*` | Migrasi hasil `drizzle-kit generate` | 2 |
| `server/documentOperations.ts` | `COMPANY_ARCHIVE_FILE` pada jalur unggah | 3 |
| `server/_core/index.ts` | Gerbang `CONTROLLER` untuk berkas arsip | 3 |
| `server/documentOperations.archive.test.ts` | Uji jalur unggah dan penolakannya | 3 |
| `server/companyDocumentArchive.ts` | Penulis: buat, ganti versi, nonaktifkan; pembaca: daftar dan worklist | 4, 5 |
| `server/companyDocumentArchive.test.ts` | Uji penulis, nomor versi, dan `supersededAt` | 4 |
| `server/companyDocumentArchive.authorization.test.ts` | Uji otorisasi dan batas "hanya mencatat" | 4 |
| `server/companyDocumentArchive.worklist.test.ts` | Uji daftar, riwayat versi, dan worklist | 5 |
| `server/routers.ts` | Skema Zod dan prosedur `companyArchive.*` | 4, 5 |
| `client/src/pages/ArsipDokumen.tsx` | Halaman arsip beserta worklist-nya | 6 |
| `client/src/App.tsx`, `shared/backOfficeNavigation.ts` | Rute dan menu | 6 |
| `server/companyDocumentArchiveScenario.test.ts` | Skenario menyeluruh | 7 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md`, ROADMAP | Perilaku dan skema yang berubah | 7 |

---

### Task 1: Penilaian masa berlaku dan worklist, murni dan teruji

**Files:** Create `shared/companyDocumentArchive.ts`, `shared/companyDocumentArchive.test.ts`

**Interfaces:**
- Consumes: `startOfOperationalDay` dari `shared/regulatoryActionQueue.ts`. Tidak menyentuh basis data.
- Produces: `ARCHIVE_EXPIRY_WARNING_DAYS`, `companyDocumentCategoryLabels`, `archiveDateKey`, `assessArchiveValidity`, `archiveWorklistReason`.

- [x] **Step 1: Tulis uji yang gagal** — sisi batasnya yang paling mudah salah:

```ts
describe("masa berlaku dokumen arsip", () => {
  it("dokumen yang berakhir hari ini masih BERLAKU, bukan KEDALUWARSA", () => {});
  it("KEDALUWARSA sejak hari sesudah validUntil", () => {});
  it("AKAN_KEDALUWARSA tepat pada hari ke-30, dan BERLAKU pada hari ke-31", () => {});
  it("validUntil kosong berarti BERLAKU selamanya, bukan kedaluwarsa", () => {});
  it("validFrom di masa depan menghasilkan BELUM_BERLAKU dan alasan TIDAK_ADA_VERSI_BERLAKU", () => {});
  it("menghasilkan kunci tanggal yang sama pada zona proses UTC, WIB, dan America/New_York", () => {});
});
```

**Sisi batasnya adalah "hari ini".** `validUntil` adalah tanggal **terakhir** dokumen berlaku, bukan
tanggal pertama ia tidak berlaku. Dokumen yang berakhir hari ini masih berlaku hari ini.

**Jebakan zona waktu.** Nilai kolom `date` dibangun driver sebagai **tengah malam waktu lokal
proses**, sehingga kuncinya diambil dengan penggetah lokal (`getFullYear`/`getMonth`/`getDate`).
Sebaliknya "hari ini" diturunkan lewat `startOfOperationalDay` beserta zona operasional. Mencampur
keduanya — misalnya memakai `toISOString().slice(0, 10)` pada nilai kolom `date` — memundurkan
tanggal satu hari di WIB. Uji ketiga zona proses itu yang menangkapnya.

- [x] **Step 2: Tulis fungsinya.** Murni. `ARCHIVE_EXPIRY_WARNING_DAYS = 30` sebagai konstanta
      bernama beserta komentar yang menyebut tanggal keputusan penggunanya. Selisih hari dihitung
      atas kunci tanggal, bukan atas selisih milidetik — 24 jam bukan satu hari pada zona ber-DST.
- [x] **Step 3: `archiveWorklistReason`** mengembalikan `KEDALUWARSA`, `AKAN_KEDALUWARSA`,
      `TIDAK_ADA_VERSI_BERLAKU`, atau `null`. Dokumen **nonaktif tidak pernah** menghasilkan alasan;
      uji hal itu di sini, jangan menyerahkannya ke pemanggil.
- [x] **Step 4:** Perintah mutu, lalu commit `"Penilaian masa berlaku dokumen arsip"`.

**Catatan Tugas 1.** Dua hal yang bergeser dari rencana:

1. **"Hari ini" memakai `operationalDateKey` yang ditambahkan ke `shared/regulatoryActionQueue.ts`**,
   bukan helper baru di berkas arsip. Ia dibangun di atas `operationalParts` yang sudah dipakai
   seluruh helper hari operasional di sana, sehingga tidak ada aturan zona waktu kedua yang harus
   ikut benar — itu maksud larangan "jangan menulis helper keempat", dan menaruhnya di berkas arsip
   justru akan melanggarnya.
2. **Dokumen yang berakhir hari ini berstatus `AKAN_KEDALUWARSA`, bukan `BERLAKU`.** Uji yang
   ditulis lebih dulu memasang harapan yang keliru: sisa nol hari tetap berada di dalam jendela
   peringatan 30 hari. Yang benar-benar diuji tetap sisi batasnya — ia **belum** kedaluwarsa pada
   hari terakhirnya sendiri.

---

### Task 2: Migrasi — dua nilai enum dan dua tabel arsip

**Files:** Modify `drizzle/schema.ts`; Create migrasi

**Ini satu-satunya tugas migrasi di paket ini.**

- [x] **Step 1: Tulis skemanya di `drizzle/schema.ts` lebih dulu**, jangan menulis SQL sendiri.
      Tambahkan `"COMPANY_ARCHIVE"` pada `ownerType` dan `"COMPANY_ARCHIVE_FILE"` pada
      `documentType` (`drizzle/schema.ts:329-331`) — **menambah nilai di ujung**, tidak menyusun
      ulang dan tidak menghapus satu pun nilai lama, termasuk `UNDERLYING` yang usang. Lalu kedua
      tabel arsip persis seperti spec bagian 2.

```ts
export const companyDocumentCategories = ["SOP", "KEBIJAKAN_INTERNAL", "SURAT_BI", "NOTULEN_RAPAT", "KORESPONDENSI_REGULATOR", "LAINNYA"] as const;
```

- [x] **Step 2: `./node_modules/.bin/drizzle-kit generate`**, lalu **baca SQL-nya sebelum
      menerapkan**. Yang harus dipastikan:
      - dua `CREATE TABLE` beserta indeksnya;
      - `MODIFY COLUMN` pada `operational_documents` yang hanya **menambah** nilai enum — bila SQL
        yang dihasilkan menghapus atau menyusun ulang nilai lama, **berhenti dan laporkan**;
      - tidak ada `DROP`, tidak ada `NOT NULL` tanpa nilai bawaan pada tabel yang sudah berisi baris.
- [x] **Step 3: Tulis rencana rollback di berkas ini, sebelum menerapkan.**

**Migrasi yang dihasilkan:** `drizzle/0052_spicy_skreet.sql`. SQL-nya dibaca sebelum diterapkan dan
seluruhnya aditif: dua `CREATE TABLE` (`company_documents`, `company_document_versions`), tiga
`CREATE INDEX` pada tabel baru itu, dan dua `MODIFY COLUMN` pada `operational_documents` yang
**hanya menambahkan satu nilai di ujung** — kesembilan nilai `documentType` lama dan keempat nilai
`ownerType` lama tetap ada pada urutan yang sama. Tidak ada `DROP`, tidak ada `NOT NULL` baru pada
tabel yang sudah berisi baris, dan tidak ada kolom lama yang disentuh.

**Rencana rollback** (dicatat 8 September 2026, **sebelum** migrasi diterapkan). Dijalankan pada
tiap basis data yang menerima migrasi ini — lokal `moneychanger` dan `mc_t_abcvalas`:

```sql
DROP TABLE IF EXISTS `company_document_versions`;
DROP TABLE IF EXISTS `company_documents`;

-- Kembalikan kedua enum ke nilai lamanya. Periksa dulu tidak ada baris yang memakainya; MySQL
-- mengubah nilai enum yang tidak lagi sah menjadi string kosong tanpa mengeluh, dan berkas yang
-- kehilangan ownerType-nya menjadi baris yatim yang tidak dapat dipulihkan.
--   SELECT COUNT(*) FROM operational_documents WHERE ownerType = 'COMPANY_ARCHIVE';
-- Bila hasilnya 0:
ALTER TABLE `operational_documents`
  MODIFY COLUMN `ownerType` enum('CUSTOMER','TRANSACTION','COMPANY','EXPENSE') NOT NULL;
ALTER TABLE `operational_documents`
  MODIFY COLUMN `documentType` enum('KTP_PHOTO','UNDERLYING','UNDERLYING_FORM','UNDERLYING_STATEMENT','UNDERLYING_INVOICE','COMPANY_LOGO','LICENSE_CERTIFICATE','LICENSE_ATTACHMENT','EXPENSE_RECEIPT') NOT NULL;
```

Bila hasil hitungannya **bukan** 0, hapus dulu baris arsipnya (atau batalkan rollback-nya) —
membiarkan `MODIFY COLUMN` berjalan atas baris yang memakai nilai baru akan mengosongkan kolomnya
diam-diam.

Sesudah itu hapus baris `0052` dari `drizzle/meta/_journal.json`, berkas `drizzle/0052_*.sql`, dan
`drizzle/meta/0052_snapshot.json`, lalu kembalikan `drizzle/schema.ts`.

**Yang hilang bila rollback dijalankan:** seluruh dokumen arsip beserta riwayat versinya, dan baris
`operational_documents` ber-`ownerType` `COMPANY_ARCHIVE` yang harus dihapus lebih dulu. Berkasnya
sendiri tetap ada di object storage tetapi menjadi tak tertunjuk. Tabel dan kolom lama tidak
tersentuh. Ambil cadangan kedua basis data lokal lebih dulu bila arsipnya sudah terisi.

- [x] **Step 4: Terapkan** dengan `node scripts/tenant.mjs migrate-all`. **Jangan** menjalankan
      `.sql` langsung. Periksa kedua basis data lokal menerima migrasinya. **Jangan menerapkan ke
      produksi** — migrasi `0051` Paket H pun belum diterapkan di sana.
- [x] **Step 5:** Perintah mutu, lalu commit `"Tabel arsip dokumen perusahaan"`.

**Diterapkan 8 September 2026** lewat `node scripts/tenant.mjs migrate-all`: kedua tenant lokal
(`ibukota` → `moneychanger`, `abcvalas` → `mc_t_abcvalas`) selesai dan berada pada versi skema yang
sama. Diperiksa langsung ke basis datanya: kedua tabel ada dan `ownerType` kini memuat
`COMPANY_ARCHIVE`. **Produksi tidak disentuh.**

---

### Task 3: Jalur unggah menerima berkas arsip, dengan gerbang Controller

**Files:** Modify `server/documentOperations.ts`, `server/_core/index.ts`; Create `server/documentOperations.archive.test.ts`

- [x] **Step 1: Uji yang gagal** — `COMPANY_ARCHIVE_FILE` menghasilkan baris ber-`ownerType`
      `COMPANY_ARCHIVE`; ia **ditolak** bila dikirim bersama `customerId`, `transactionId`, atau
      `expenseId`; MIME di luar JPG/PNG/WEBP/PDF ditolak; berkas di atas 8 MB ditolak. Berkas ujinya
      **dibuat sendiri di dalam uji** (buffer kecil), bukan disalin dari dokumen nyata.
- [x] **Step 2: Tambahkan jenisnya** pada `OperationalDocumentType` dan pada cabang validasi
      `uploadOperationalDocument` (`server/documentOperations.ts:14,57-65`). Jalur penyimpanannya
      `operasional/arsip-perusahaan/...`, sejajar dengan `perusahaan` yang sudah ada.

**Hati-hati pada `COMPANY_DOCUMENT_TYPES`** (`documentOperations.ts:15`). Himpunan itu memutuskan
`ownerType: "COMPANY"`. Berkas arsip **tidak boleh** masuk ke dalamnya, karena `ownerType`-nya harus
`COMPANY_ARCHIVE` — kalau tidak, seluruh arsip akan ikut terkirim ke halaman Profil Perusahaan lewat
`listCompanyDocuments`. Tambahkan cabangnya sendiri, jangan menumpang himpunan itu.

- [x] **Step 3: Gerbang peran di REST.** `server/_core/index.ts:63` sudah menahan dokumen perusahaan
      pada `CONTROLLER`. Tambahkan `COMPANY_ARCHIVE_FILE` ke daftar yang sama. Uji bahwa `STAFF` dan
      `ADMIN` ditolak `403` — otorisasi ditegakkan di server, bukan di UI.
- [x] **Step 4: Uji bahwa `listCompanyDocuments` tidak berubah** — berkas arsip yang sudah diunggah
      **tidak** muncul di hasilnya. Itu satu-satunya bukti bahwa halaman Profil Perusahaan aman.
- [x] **Step 5:** Perintah mutu, lalu commit `"Jalur unggah berkas arsip perusahaan"`.

**Catatan Tugas 3.** Gerbang perannya **dipindahkan keluar dari handler Express** menjadi
`operationalDocumentUploadDenial` pada `server/documentOperations.ts`, mengikuti preseden
`financialFormExportDenial` (`server/financialFormExport.ts:413`). Alasannya sederhana: rencana
meminta gerbangnya diuji, dan otorisasi yang hanya hidup di dalam handler tidak dapat diuji tanpa
menjalankan seluruh aplikasinya. Pemindahan itu sekaligus menutup satu perilaku yang sebelumnya
tidak pernah diuji sama sekali — bahwa ketiga jenis dokumen profil perusahaan menolak `STAFF`.

---

### Task 4: Penulis arsip — buat dokumen, ganti versi, nonaktifkan

**Files:** Create `server/companyDocumentArchive.ts`, `server/companyDocumentArchive.test.ts`, `server/companyDocumentArchive.authorization.test.ts`; Modify `server/routers.ts`

**Interfaces:**
- Consumes: `writeAudit` (`server/operations.ts:143`), tabel Tugas 2, berkas hasil Tugas 3.
- Produces: `createCompanyDocument`, `addCompanyDocumentVersion`, `deactivateCompanyDocument`, prosedur `companyArchive.*`.

- [ ] **Step 1: Uji yang gagal** — kontraknya:

```ts
describe("penulis arsip dokumen", () => {
  it("membuat dokumen beserta versi 1 dalam satu transaksi", () => {});
  it("menolak berkas yang bukan ownerType COMPANY_ARCHIVE", () => {});
  it("menolak berkas yang sudah dipakai versi lain", () => {});
  it("versi kedua menaikkan nomor dan mengisi supersededAt versi sebelumnya", () => {});
  it("menolak versi kedua tanpa alasan perubahan, dan menerima versi pertama tanpa alasan", () => {});
  it("menolak menambah versi pada dokumen yang sudah nonaktif", () => {});
  it("menonaktifkan mengisi tiga kolom dan tidak menghapus baris mana pun", () => {});
  it("menolak menonaktifkan tanpa alasan", () => {});
});
```

- [ ] **Step 2: `createCompanyDocument`** — dokumen dan versi 1 **dalam satu transaksi**. Bila
      versinya gagal ditulis, dokumennya tidak boleh tertinggal: dokumen tanpa versi adalah keadaan
      yang spec-nya nyatakan tidak dapat terjadi, dan pembaca worklist bergantung pada itu.
      Validasi: berkasnya ada, `ownerType`-nya `COMPANY_ARCHIVE`, belum dipakai versi lain, dan
      `responsibleEmployeeId` (bila diisi) menunjuk pegawai yang ada.
- [ ] **Step 3: `addCompanyDocumentVersion`** — juga satu transaksi: isi `supersededAt` versi
      berjalan **dan** sisipkan versi baru bersama-sama. Nomor versinya diturunkan dari nomor
      tertinggi yang ada; indeks unik `(companyDocumentId, versionNumber)` adalah jaring
      pengamannya, bukan pengganti pemeriksaannya. Alasan perubahan **wajib** di sini
      (keputusan 7).
- [ ] **Step 4: `deactivateCompanyDocument`** — mengisi `deactivatedAt`, `deactivatedByUserId`,
      `deactivationReason`. **Tidak ada `DELETE` di seluruh berkas ini**; uji itu secara eksplisit
      dengan menghitung baris sebelum dan sesudah.
- [ ] **Step 5: Audit** — `COMPANY_DOCUMENT_CREATED`, `COMPANY_DOCUMENT_VERSION_ADDED`,
      `COMPANY_DOCUMENT_DEACTIVATED` lewat `writeAudit`. Uji bahwa ketiganya benar-benar tertulis.
- [ ] **Step 6: Prosedur tRPC** `companyArchive.create`, `.addVersion`, `.deactivate` sebagai
      `controllerProcedure`, dengan skema Zod: kategori dari enum, judul wajib tidak kosong,
      `validFrom` wajib, `validUntil` opsional dan **tidak boleh mendahului** `validFrom`.
- [ ] **Step 7: Uji otorisasi dan batas "hanya mencatat"** pada berkas terpisah — `STAFF` dan
      `ADMIN` ditolak; dan tidak ada tulisan ke `company_profile`, `employees`, `customers`,
      `exchange_transactions`, kas, maupun buku besar.
- [ ] **Step 8:** Perintah mutu, lalu commit `"Penulis arsip dokumen perusahaan"`.

---

### Task 5: Pembaca arsip — daftar, riwayat versi, dan worklist

**Files:** Modify `server/companyDocumentArchive.ts`, `server/routers.ts`; Create `server/companyDocumentArchive.worklist.test.ts`

- [ ] **Step 1: Uji yang gagal** — dokumen kedaluwarsa muncul di worklist; yang berakhir 30 hari
      lagi muncul; yang berakhir 31 hari lagi tidak; yang `validUntil`-nya kosong tidak; dokumen
      **nonaktif tidak pernah muncul**; dokumen yang versi berjalannya `validFrom` di masa depan
      muncul sebagai `TIDAK_ADA_VERSI_BERLAKU`.
- [ ] **Step 2: `listCompanyDocuments` arsip** — nama fungsinya **jangan** bentrok dengan
      `listCompanyDocuments` yang sudah ada di `documentOperations.ts`; pakai
      `listCompanyArchiveDocuments`. Kembalikan dokumen beserta versi berjalannya, banyaknya versi,
      nama penanggung jawab, dan status masa berlakunya dari Tugas 1.
- [ ] **Step 3: Jangan menyaring `validUntil` di SQL.** Baca barisnya, nilai statusnya di
      JavaScript. Alasannya ada di Global Constraints, dan ia sudah pernah menggigit proyek ini.
      "Hari ini" dari `startOfOperationalDay` beserta `company_profile.timezone`, bukan dari zona
      proses.
- [ ] **Step 4: `listCompanyArchiveVersions(companyDocumentId)`** — seluruh versi, terbaru dahulu,
      masing-masing dengan `operationalDocumentId`-nya agar halaman dapat memakai jalur unduhan yang
      sudah ada. **Versi lama tetap dapat diunduh**; itu keputusan 2, dan ujilah bahwa ia benar.
- [ ] **Step 5: Hitung dokumen tanpa `validUntil`** dan kembalikan angkanya. Worklist yang sunyi
      tidak boleh terbaca sebagai "semua dokumen berlaku" ketika sebabnya adalah tanggal yang tidak
      pernah diisi — spec menyebutnya sebagai risiko residual dan halaman harus menampilkannya.
- [ ] **Step 6: Prosedur tRPC** `companyArchive.list`, `.versions`, `.worklist` sebagai
      `controllerProcedure`.
- [ ] **Step 7:** Perintah mutu, lalu commit `"Pembaca dan worklist arsip dokumen"`.

---

### Task 6: Halaman Arsip Dokumen

**Files:** Create `client/src/pages/ArsipDokumen.tsx`; Modify `client/src/App.tsx`, `shared/backOfficeNavigation.ts`

- [ ] **Step 1: Rute dan menu** — `/operasional/arsip-dokumen`, `minimumRole: "CONTROLLER"`, di
      grup **Pengawasan** bersama Kepegawaian dan Status Kesiapan. Pakai `OperationsRoute` seperti
      halaman lain (`client/src/App.tsx:86,96`).
- [ ] **Step 2: Worklist di atas halaman** — kedaluwarsa, akan kedaluwarsa, tidak ada versi
      berlaku, masing-masing dengan alasannya terbaca manusia. Di bawahnya, keterangan banyaknya
      dokumen tanpa tanggal berakhir apa adanya (Tugas 5 Step 5).
- [ ] **Step 3: Daftar dokumen berkelompok kategori**, dengan versi berjalan, masa berlakunya,
      penanggung jawabnya, dan tombol membuka riwayat versi. Setiap versi punya tombol unduh yang
      memakai `/api/operational-documents/:documentId/download` yang sudah ada — pola `viewDocument`
      pada `client/src/pages/CompanyProfile.tsx:107` sudah menunjukkan caranya; ikuti, jangan
      membuat pola ketiga.
- [ ] **Step 4: Borang unggah** — dua langkah: `POST /api/operational-documents` dengan
      `documentType: "COMPANY_ARCHIVE_FILE"`, lalu `trpc.companyArchive.create`/`.addVersion`
      dengan id yang dikembalikannya. Pakai pola `uploadDocument` pada `CompanyProfile.tsx:53`;
      seluruh pembacaan lain tetap lewat `trpc.*.useQuery/useMutation`, jangan menambah pembungkus
      `fetch` baru.
- [ ] **Step 5: Keadaan wajib** — loading, kosong, dan error; fokus keyboard; teks tindakan kritis
      yang jelas. Tombol nonaktifkan harus mengatakan **"Nonaktifkan"**, bukan "Hapus", dan
      meminta alasan — dokumennya memang tidak dihapus, dan label yang berbohong tentang itu lebih
      buruk daripada tidak ada label.
- [ ] **Step 6: Verifikasi visual** pada `moneychanger` dengan data uji yang dibuat sendiri
      (diizinkan pengguna 8 September 2026): sebuah SOP dengan dua versi, satu dokumen kedaluwarsa,
      satu yang akan kedaluwarsa, satu tanpa tanggal berakhir. Login tetap dilakukan pengguna;
      minta pada giliran itu. **Halaman kosong belum membuktikan apa pun** — perlihatkan
      worklist-nya terisi.
- [ ] **Step 7:** Perintah mutu, lalu commit `"Halaman arsip dokumen perusahaan"`.

---

### Task 7: Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

**Files:** Create `server/companyDocumentArchiveScenario.test.ts`; Modify panduan A–Z, skema database, ROADMAP

- [ ] **Step 1: Skenario menyeluruh** dari data karangan: SOP diunggah versi 1 → muncul sebagai
      berlaku → mendekati `validUntil` → muncul di worklist sebagai akan kedaluwarsa → versi 2
      diunggah dengan alasan perubahan → versi 1 `supersededAt` terisi tetapi **masih dapat
      diunduh** → dokumen keluar dari worklist → dinonaktifkan dengan alasan → hilang dari worklist
      dan dari daftar aktif, **barisnya tetap ada**.
- [ ] **Step 2: Skenario sisi batas** — dokumen yang berakhir hari ini masih berlaku; dokumen tanpa
      `validUntil` tidak pernah muncul di worklist tetapi ikut terhitung pada angka "tanpa tanggal
      berakhir"; versi bertanggal berlaku di masa depan meninggalkan `TIDAK_ADA_VERSI_BERLAKU`.
- [ ] **Step 3: Peragaan end-to-end** pada `moneychanger`, membuat data uji yang diperlukan
      langsung. Perlihatkan hasilnya di layar: worklist terisi, riwayat versi terbuka, versi lama
      terunduh.
- [ ] **Step 4: Perbarui dokumentasi** — panduan A–Z (cara mengarsipkan dokumen, cara mengganti
      versi, arti nonaktif, cara kerja worklist, dan apa yang aplikasi **tidak** lakukan),
      `docs/SKEMA-DATABASE-PROJECT.md` (dua tabel dan dua nilai enum baru beserta migrasinya), dan
      ROADMAP (centang Paket I).
- [ ] **Step 5:** Perintah mutu, sebutkan angka uji yang benar-benar dilihat, lalu commit
      `"Skenario arsip dokumen menyeluruh, peragaan, dan dokumentasi"`.

---

## Penutup Paket I

Diisi saat paket selesai: perintah mutu terakhir yang **benar-benar dijalankan**, angka uji yang
benar-benar dilihat, dan risiko residual yang jujur — termasuk yang sudah diketahui sejak sesi
rancangan:

1. **Unggahan yatim** bila langkah kedua unggah gagal; tidak ada penyapunya.
2. **Sertifikat izin pada Profil Perusahaan tidak mendapat peringatan masa berlaku** (keputusan 5).
3. **`deleteCompanyDocument` lama tetap `DELETE` tanpa audit**; tidak disentuh paket ini.
4. **Jalur dokumen tidak memeriksa signature** untuk PDF/JPG/PNG/WEBP; keadaan yang sudah berlaku
   sebelumnya, pantas menjadi paketnya sendiri.
5. **`employee_certifications.documentId` dan `employee_pic_assignments.documentId` tetap selalu
   kosong** — pekerjaan yang belum selesai pada jalur Kepegawaian, bukan keadaan sah.
6. **`pnpm audit --prod --audit-level=high` tetap 9 temuan**; jangan menyebut audit bersih.
7. **Migrasi `0051` dan `0052` belum diterapkan ke produksi.**
