# Paket J1 — Fondasi data risiko inheren

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat sisi risiko inheren IRA **dapat dihitung sama sekali** — kosakata tertutup BI pada
nasabah, jalur distribusi pada bon, provinsi pada profil perusahaan, satu tabel klasifikasi risiko
yang dipelihara manusia, dan pembaca agregat yang mengisi Form C1 dari basis data.

**Architecture:** Kosakata dan pita sebagai konstanta murni di `shared/`; tiga kolom penulis baru
pada tabel yang sudah hidup; satu tabel klasifikasi berdimensi `dimension × code × riskType`; satu
pembaca agregat seperiode yang memakai ulang `ACCUMULATED_TRANSACTION_STATUSES` dan helper jendela
operasional Paket H.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-09-09-individual-risk-assessment-design.md`

**Rencana pasangannya:** `plans/2026-09-09-individual-risk-assessment-j2-penilaian.md` — **jangan
dikerjakan sebelum J1 selesai.** J2 tidak punya sumber data tanpa J1.

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu.**

- [x] Tugas 1 — Kosakata tertutup BI sebagai konstanta murni
- [x] Tugas 2 — Migrasi: tiga kolom nasabah/bon/profil dan dua tabel klasifikasi
- [x] Tugas 3 — Penulis klasifikasi risiko beserta gerbang peran dan auditnya
- [x] Tugas 4 — Borang nasabah: jenis nasabah, bentuk badan hukum, kategori pekerjaan
- [x] Tugas 5 — Jalur distribusi pada bon
- [x] Tugas 6 — Pembaca agregat Form C1
- [x] Tugas 7 — Halaman Klasifikasi Risiko dan Ambang

Urutannya mengikat: **1 dan 2 sebelum segalanya**; 3 sebelum 7; 4 dan 5 sebelum 6.

## Keputusan pengguna yang mengikat

Ditetapkan 9 September 2026. **Jangan menurunkannya ulang dan jangan menawarnya.** Selengkapnya di
spec bagian "Yang sudah diputuskan pengguna"; yang mengikat J1:

1. **Klasifikasi risiko satu tabel**, `dimension × code × riskType × level`, dipelihara CONTROLLER,
   tercatat pada `audit_logs`. **Bukan** kolom `isHighRisk` pada `currencies`.
2. **Ambang pita dapat disunting** CONTROLLER, dengan nilai bawaan hasil seed persis template.
3. **`occupationCategory` berdampingan dengan teks bebas.** `customers.occupation` **tidak** diubah,
   **tidak** dihapus, dan **tidak** ditebak isinya. Baris lama tetap kosong.
4. **`customerType` dan `entityLegalForm`** ditambahkan supaya parameter badan usaha punya penulis.
5. **`distributionChannel`** pada `exchange_transactions`, bawaan `KANTOR`.
6. **Tidak ada backfill otomatis.** Menebak kategori dari teks bebas adalah mengarang data nasabah.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Muat variabel lingkungan lebih dulu:
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Perintah mutu wajib: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`,
  `./node_modules/.bin/vite build`.
- **Baseline sebelum paket ini, dijalankan 9 September 2026 sesudah Paket I:**
  `Test Files 138 passed (138)`, `Tests 1119 passed | 2 skipped (1121)`. **Sebutkan angka yang
  benar-benar dilihat, jangan mengarang.**
- **Satu uji diketahui flaky dan bukan bagian paket ini:** `server/tenantIsolation.live.test.ts` >
  *"setiap ikatan hanya melihat database miliknya sendiri"*. Bila gagal sendirian di bawah beban,
  jalankan ulang berkas itu saja.
- **Migrasi hanya lewat `node scripts/tenant.mjs migrate-all`**, tidak pernah menjalankan `.sql`
  langsung. Dua basis data lokal saja: `moneychanger` dan `mc_t_abcvalas`. **Jangan menerapkan
  migrasi ke produksi.** Migrasi terakhir adalah `0052`; J1 menghasilkan `0053`.
- **Tepat satu tugas migrasi di rencana ini: Tugas 2.** Bila tugas lain ternyata menuntut perubahan
  skema, **berhenti dan laporkan** — jangan menambahkan migrasi kedua diam-diam.
- **Tugas 2 menyentuh `customers` dan `exchange_transactions`, yang berisi data hidup.** Seluruh
  kolom barunya **nullable atau berbawaan**, tidak ada `NOT NULL` tanpa `DEFAULT`, dan tidak ada
  kolom lama yang berubah tipe, berganti nama, atau hilang. Rollback tertulis wajib ada di berkas
  ini **sebelum** migrasinya diterapkan.
- **Jangan menyentuh `ACCUMULATED_TRANSACTION_STATUSES`.** Ia satu daftar untuk seluruh pembacanya.
- **Jangan menulis helper jendela waktu keempat.** Batas periode memakai `startOfOperationalMonth` /
  `startOfNextOperationalMonth` (`shared/regulatoryActionQueue.ts`).
- **Kolom `datetime` menyimpan jam UTC; kolom `date` tidak.** `transactionAt` dibandingkan terhadap
  instan absolut — itu sudah benar, jangan "diperbaiki".
- **Basis data palsu pada uji wajib ikut menyaring `where` dan menerapkan `orderBy`.** Salin polanya
  dari `server/companyDocumentArchive.test.ts`. Jebakannya: `StringChunk` pemisah pada klausa Drizzle
  juga punya `value` berupa array dan harus disisihkan agar tidak merebut giliran `Param`.
- **Rute baru wajib didaftarkan pada `server/backOfficeNavigation.test.ts`.**
- **Dialog wajib `max-h-[85vh] overflow-y-auto`.**
- Peran `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Klasifikasi risiko dan ambang: **CONTROLLER ke
  atas**, ditegakkan di tRPC lewat fungsi `*Denial` yang dapat diuji — preseden
  `financialFormExportDenial` (`server/financialFormExport.ts`) dan `operationalDocumentUploadDenial`
  (`server/documentOperations.ts`).
- **Jangan menyimpan workbook aktual, data KYC nyata, atau secret** di source, fixture, log,
  screenshot, dokumentasi, maupun commit. Yang boleh masuk repo dari template BI hanyalah
  **strukturnya** — nama parameter, bobot, pita, teks pertanyaan. Angka omzet dan jumlah nasabah
  pada template adalah data operasional PT IBV dan **tidak boleh** ikut.
- **Membuat data uji pada basis data lokal diizinkan tanpa bertanya lebih dulu.** Produksi tidak
  boleh disentuh. **Data uji paket E, F1, F2, G, H, dan I sengaja dibiarkan — jangan dibersihkan.**
- **Jangan menambahkan pengiriman otomatis** ke BI, PPATK, atau siapa pun.
- **IRA tidak pernah menulis ke `customers`.** J1 menambah kolom yang diisi **petugas lewat borang
  nasabah**; tidak ada jalur kepatuhan mana pun yang menulis ke sana.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `shared/iraVocabulary.ts` | Kategori pekerjaan, bentuk badan hukum, jalur distribusi, provinsi | 1 |
| `shared/iraVocabulary.test.ts` | Keunikan kode dan kelengkapan label | 1 |
| `drizzle/schema.ts` | Tiga kolom baru, `iraRiskClassifications`, `iraParameterThresholds` | 2 |
| `drizzle/0053_*.sql`, `drizzle/meta/*` | Migrasi hasil `drizzle-kit generate` | 2 |
| `server/iraRiskClassification.ts` | Penulis dan pembaca klasifikasi, `iraClassificationDenial` | 3 |
| `server/iraRiskClassification.test.ts` | Uji penulis, audit, dan penolakan peran | 3 |
| `server/operations.ts`, `server/routers.ts` | Kolom baru pada jalur buat/sunting nasabah dan bon | 4, 5 |
| `server/customerCategory.test.ts` | Uji borang nasabah mengirim ketiga kolom baru | 4 |
| `server/transactionChannel.test.ts` | Uji jalur distribusi tersimpan dan bawaannya | 5 |
| `client/src/pages/Customers.tsx`, `CustomerList.tsx` | Ruas jenis nasabah dan kategori pekerjaan | 4 |
| `client/src/pages/Transactions.tsx` | Ruas jalur distribusi | 5 |
| `server/iraDataForm.ts` | Pembaca agregat Form C1 | 6 |
| `server/iraDataForm.test.ts` | Uji agregat, bon berbaris banyak, dan penyebut | 6 |
| `client/src/pages/KlasifikasiRisiko.tsx` | Halaman pemeliharaan klasifikasi dan ambang | 7 |
| `client/src/App.tsx`, `shared/backOfficeNavigation.ts` | Rute dan menu | 7 |

---

### Task 1: Kosakata tertutup BI sebagai konstanta murni

**Files:** Create `shared/iraVocabulary.ts`, `shared/iraVocabulary.test.ts`

**Interfaces:**
- Consumes: tidak ada. Murni, tanpa basis data, tanpa jam.
- Produces: `IRA_OCCUPATION_CATEGORIES`, `IRA_LEGAL_FORMS`, `IRA_DISTRIBUTION_CHANNELS`,
  `IRA_PROVINCES`, beserta label Indonesianya.

- [x] **Step 1: Salin kosakatanya dari lembar `C1. Form KUPVA BB`** — **daftarnya, bukan angkanya.**
      Kategori pekerjaan persis seperti tertulis di template, termasuk yang bernilai nol di berkas
      milik pengguna: Pejabat Negara, Wirausaha/Wiraswasta, Karyawan Swasta, PNS/ASN (termasuk
      pensiunan), Profesi Keuangan Lainnya, Profesional, Pengurus dan Pegawai BUMN/BUMD/BUMS/BUMDes,
      Ibu Rumah Tangga, TNI, Polri, Pelajar/Mahasiswa, Pengurus atau Pegawai Yayasan/Perkumpulan,
      Artis/Content Creator/Influencer, Pengajar, Pengurus/Pegawai/Relawan Ormas atau LSM, Sopir,
      Asisten Rumah Tangga, Buruh, Tenaga Keamanan, Atlet, Pemuka/Tokoh Agama, Pengurus Partai
      Politik, dan `LAINNYA` untuk yang tidak masuk daftar.

      **`LAINNYA` bukan tempat pembuangan.** Ia kategori tersendiri yang ikut dihitung dan terlihat
      di layar, bukan cara menyembunyikan nasabah yang belum dikategorikan — yang belum
      dikategorikan tetap `null`.

- [x] **Step 2: Bentuk badan hukum**, juga dari C1: `PT` (termasuk BUMN/BUMD/BUMS),
      `PERUSAHAAN_PERSEORANGAN` (termasuk UMKM per PP 7/2021), `SOCIAL_ENTERPRISE`, `CV`, `FIRMA`,
      `PERSEKUTUAN_PERDATA`, `KOPERASI`, `YAYASAN`, `PERKUMPULAN`, `ORMAS_TERDAFTAR`,
      `ORMAS_TIDAK_TERDAFTAR`.

      **`PT` dan `PERUSAHAAN_PERSEORANGAN` sengaja terpisah** — parameter PPSPM 3c menanyakan PT
      **non-UMKM**, jadi menggabungkan keduanya membuat parameter itu tidak mungkin dihitung.

- [x] **Step 3: Jalur distribusi** `KANTOR`, `LAYANAN_DELIVERY`, `ONLINE_MERCHANT`, dan **34
      provinsi** sebagai kode kebab-uppercase.

- [x] **Step 4: Uji** bahwa tiap daftar berkode unik, tiap kode punya label, dan tidak ada label
      kembar. Uji ini murah dan menangkap salin-tempel yang meleset — kesalahan paling mungkin pada
      tugas yang isinya memang menyalin.

- [x] **Step 5:** Perintah mutu, lalu commit `"Kosakata tertutup BI untuk penilaian risiko"`.

---

### Task 2: Migrasi — tiga kolom nasabah/bon/profil dan dua tabel klasifikasi

**Files:** Modify `drizzle/schema.ts`; Create migrasi

**Ini satu-satunya tugas migrasi di rencana ini.**

- [x] **Step 1: Tulis rencana rollback di berkas ini lebih dulu**, sebelum menyentuh apa pun:

      > **Rollback Tugas 2.** Dua tabel baru di-`DROP TABLE`; lima kolom baru di-`DROP COLUMN`.
      > Seluruhnya nullable atau berbawaan dan belum punya pembaca di luar paket ini, sehingga
      > menjatuhkannya mengembalikan keadaan sebelum migrasi tanpa kehilangan data lama. Baris
      > `__drizzle_migrations` untuk `0053` dihapus pada kedua basis data lokal. Sebelum menerapkan:
      > `mysqldump moneychanger customers exchange_transactions company_profile > <scratchpad>/pre-0053.sql`.

#### Rollback Tugas 2 — tertulis sebelum migrasi diterapkan

Lima kolom baru dan dua tabel baru. Seluruh kolom baru nullable atau berbawaan, tidak ada kolom
lama yang berubah tipe/nama/hilang, dan belum ada pembaca di luar paket ini — sehingga
menjatuhkannya mengembalikan keadaan sebelum migrasi tanpa kehilangan data lama.

**Cadangan sebelum menerapkan** (kedua basis data lokal, ke scratchpad sesi, bukan ke repo):

```bash
mysqldump --no-tablespaces moneychanger customers exchange_transactions company_profile \
  > "$SCRATCH/pre-0053-moneychanger.sql"
mysqldump --no-tablespaces mc_t_abcvalas customers exchange_transactions company_profile \
  > "$SCRATCH/pre-0053-mc_t_abcvalas.sql"
```

**Membatalkan** — jalankan pada `moneychanger` dan `mc_t_abcvalas`:

```sql
DROP TABLE IF EXISTS `ira_parameter_thresholds`;
DROP TABLE IF EXISTS `ira_risk_classifications`;
ALTER TABLE `customers` DROP COLUMN `customerType`, DROP COLUMN `entityLegalForm`, DROP COLUMN `occupationCategory`;
ALTER TABLE `exchange_transactions` DROP COLUMN `distributionChannel`;
ALTER TABLE `company_profile` DROP COLUMN `province`;
DELETE FROM `__drizzle_migrations` WHERE `hash` = '<hash baris 0053>';
```

Migrasinya terbit sebagai `drizzle/0053_spooky_thunderball.sql`. Lalu `git revert` commit Tugas 2 agar `drizzle/schema.ts`, `drizzle/0053_*.sql`, dan
`drizzle/meta/*` kembali sejalan dengan basis datanya. Yang hilang saat rollback hanyalah nilai
yang ditulis sesudah migrasi (kategori nasabah yang telanjur diisi petugas dan baris klasifikasi);
tidak ada data pra-migrasi yang tersentuh.

- [x] **Step 2: Tulis skemanya di `drizzle/schema.ts`**, jangan menulis SQL sendiri.

```ts
// customers — tiga kolom, seluruhnya nullable
customerType: mysqlEnum("customerType", ["INDIVIDU", "BADAN_USAHA"]),
entityLegalForm: mysqlEnum("entityLegalForm", IRA_LEGAL_FORM_VALUES),
/** Kategori pekerjaan menurut kosakata tertutup BI (Form C1). Berdampingan dengan `occupation`
 *  yang tetap memuat kata-kata sebagaimana tertulis pada KTP — kwitansi dan ekspor goAML
 *  mencetak yang itu. Kosong pada nasabah lama dan itu disengaja: menebaknya dari teks bebas
 *  berarti mengarang data nasabah. Yang kosong muncul pada worklist pelengkapan. */
occupationCategory: mysqlEnum("occupationCategory", IRA_OCCUPATION_CATEGORY_VALUES),

// exchange_transactions
distributionChannel: mysqlEnum("distributionChannel", ["KANTOR", "LAYANAN_DELIVERY", "ONLINE_MERCHANT"])
  .default("KANTOR").notNull(),

// company_profile
province: varchar("province", { length: 60 }),
```

- [x] **Step 3: Dua tabel baru.** `ira_risk_classifications` dengan indeks unik
      `(dimension, code, riskType)` dan `sourceNote` **wajib** — klasifikasi tanpa alasan adalah
      angka tanpa asal. `ira_parameter_thresholds` menyimpan pita per parameter:
      `parameterCode`, `bandIndex` (1–5), `upperBoundPercent` nullable (null = tak berbatas atas),
      beserta penyunting terakhir.

      Keduanya memuat `updatedByUserId` dan `updatedAt`; halaman pemeliharaannya menampilkan
      kapan terakhir disentuh, karena klasifikasi usang adalah risiko residual yang sudah dicatat.

- [x] **Step 4: Hasilkan migrasinya** dengan `./node_modules/.bin/drizzle-kit generate`, lalu
      **baca SQL-nya sungguhan.** Yang dicari: tidak ada `DROP`, tidak ada `MODIFY` atas kolom lama,
      dan `distributionChannel` benar-benar terbit dengan `DEFAULT 'KANTOR'` — tanpa bawaan, MySQL
      akan menolak menambah kolom `NOT NULL` pada tabel yang sudah berisi baris.

- [x] **Step 5: Terapkan** dengan `node scripts/tenant.mjs migrate-all`. **Hanya lokal.** Lalu
      periksa dengan `DESCRIBE` bahwa bon lama mendapat `KANTOR` dan bukan string kosong.

- [x] **Step 6:** Perintah mutu, lalu commit `"Migrasi 0053: kosakata nasabah, jalur distribusi, klasifikasi risiko"`.

---

### Task 3: Penulis klasifikasi risiko beserta gerbang peran dan auditnya

**Files:** Create `server/iraRiskClassification.ts`, `server/iraRiskClassification.test.ts`;
Modify `server/routers.ts`

- [x] **Step 1: Tulis uji yang gagal lebih dulu.**

```ts
describe("klasifikasi risiko", () => {
  it("menolak STAFF dan ADMIN, menerima CONTROLLER dan SHAREHOLDER", () => {});
  it("menolak sourceNote kosong", () => {});
  it("menimpa klasifikasi yang sama (dimension, code, riskType) alih-alih menggandakannya", () => {});
  it("USD boleh TINGGI untuk TPPU dan MENENGAH untuk TPPT sekaligus", () => {});
  it("menulis audit_logs berisi nilai lama dan nilai baru", () => {});
  it("kode tanpa baris klasifikasi terbaca sebagai RENDAH, bukan undefined", () => {});
});
```

      Uji keempat adalah alasan keberadaan tabel ini — bila implementasinya diam-diam menyatukan
      jenis risiko, uji itulah yang jatuh.

- [x] **Step 2: `iraClassificationDenial(role)`** sebagai fungsi tersendiri yang mengembalikan
      alasan penolakan atau `null`, meniru `financialFormExportDenial`. **Jangan** menaruh gerbangnya
      di dalam handler: otorisasi yang hanya hidup di sana tidak pernah dibuktikan uji mana pun.

- [x] **Step 3: `classifyRisk`** menulis satu baris dengan `ON DUPLICATE KEY UPDATE`, mencatat nilai
      lama dan baru ke `audit_logs`.

- [x] **Step 4: `readClassifications`** mengembalikan `Map` berkunci `dimension|code|riskType`,
      beserta fungsi murni `classificationLevel(map, dimension, code, riskType)` yang
      **mengembalikan `RENDAH` untuk yang tidak ada**. Ketiadaan yang berperilaku seperti `RENDAH`
      harus ditulis satu kali di sini, bukan diulang setiap pemanggil.

- [x] **Step 5:** Prosedur tRPC `iraClassification.list` dan `.set` dengan skema Zod.

- [x] **Step 6:** Perintah mutu, lalu commit `"Penulis klasifikasi risiko IRA"`.

---

### Task 4: Borang nasabah — jenis nasabah, bentuk badan hukum, kategori pekerjaan

**Files:** Modify `server/operations.ts`, `server/routers.ts`, `client/src/pages/Customers.tsx`,
`client/src/pages/CustomerList.tsx`; Create `server/customerCategory.test.ts`

- [x] **Step 1: Tulis uji yang gagal lebih dulu**, dengan jebakan Paket H di depan mata:

```ts
describe("kategori nasabah pada borang", () => {
  it("menyimpan customerType, entityLegalForm, dan occupationCategory saat dibuat", () => {});
  it("menuntut entityLegalForm ketika customerType BADAN_USAHA", () => {});
  it("menolak entityLegalForm ketika customerType INDIVIDU", () => {});
  it("penyuntingan yang tidak mengirim occupationCategory TIDAK mengosongkannya", () => {});
  it("occupation teks bebas tetap tersimpan apa adanya", () => {});
});
```

      **Uji keempat adalah inti tugas ini.** Ketiga kolom deklarasi profil Paket H berperilaku
      sebaliknya — yang tidak dikirim akan dikosongkan, dan itu disengaja di sana karena borangnya
      selalu mengirim ketiganya. Kolom kategori **tidak** boleh mengikuti pola itu: nasabah lama
      yang disunting karena alasan lain tidak boleh kehilangan kategorinya. Bila pilihannya membuat
      kedua kolom berperilaku berbeda pada satu borang, **berhenti dan laporkan** — perbedaan
      perilaku pada borang yang sama adalah bug yang menunggu.

- [x] **Step 2:** Skema Zod pada `server/routers.ts` (`customerCreateInput` sekitar baris 229 dan
      `customerUpdateInput` sekitar 272), dengan `superRefine` untuk kaitan
      `customerType` ↔ `entityLegalForm`.

- [x] **Step 3:** Ruas borangnya di `Customers.tsx` — pilihan jenis nasabah lebih dulu, bentuk badan
      hukum muncul hanya bila `BADAN_USAHA`, kategori pekerjaan hanya bila `INDIVIDU`. Dialognya
      wajib `max-h-[85vh] overflow-y-auto`.

- [x] **Step 4:** `CustomerList.tsx` menampilkan penanda "kategori belum diisi" pada nasabah yang
      `occupationCategory`-nya kosong. Kekosongan yang terlihat, bukan yang diam.

- [x] **Step 5: Buka borangnya sungguhan di browser** dan simpan seorang nasabah badan usaha serta
      seorang perorangan. Bug pengosongan kolom deklarasi Paket H hanya tertangkap karena borangnya
      benar-benar dibuka; `tsc` dan Vitest sama-sama meloloskannya.

- [x] **Step 6:** Perintah mutu, lalu commit `"Jenis nasabah dan kategori pekerjaan pada borang"`.

---

### Task 5: Jalur distribusi pada bon

**Files:** Modify `server/operations.ts`, `server/routers.ts`, `client/src/pages/Transactions.tsx`;
Create `server/transactionChannel.test.ts`

- [x] **Step 1: Uji lebih dulu:** bon baru tanpa pilihan tersimpan `KANTOR`; bon dengan
      `LAYANAN_DELIVERY` tersimpan apa adanya; nilai di luar enum ditolak Zod.

- [x] **Step 2:** Tambahkan ruasnya pada jalur pembuatan bon dan pada borangnya. Bawaannya `KANTOR`
      dan terpilih lebih dulu — petugas kasir tidak boleh dipaksa memilih hal yang hampir selalu
      sama.

- [x] **Step 3: Jangan menyentuh sisi pecahan maupun sisi Rupiah bon.** Tugas ini menambah satu
      kolom keterangan; bila ia mulai menyentuh validasi stok atau posting kas, **berhenti dan
      laporkan**.

- [x] **Step 4:** Perintah mutu, lalu commit `"Jalur distribusi pada bon"`.

---

### Task 6: Pembaca agregat Form C1

**Files:** Create `server/iraDataForm.ts`, `server/iraDataForm.test.ts`

**Interfaces:**
- Consumes: `ACCUMULATED_TRANSACTION_STATUSES` (`drizzle/schema.ts`), `startOfOperationalMonth` /
  `startOfNextOperationalMonth` (`shared/regulatoryActionQueue.ts`), `shared/iraVocabulary.ts`.
- Produces: `readIraDataForm(periodStart, periodEnd)` → omzet Rp per mata uang, komposisi jalur
  distribusi, komposisi kategori pekerjaan, komposisi bentuk badan hukum, jumlah PEP, nominal
  transaksi nasabah bernegara FATF/sanksi PBB, beserta **jumlah nasabah yang belum berkategori**.

- [x] **Step 1: Tulis uji yang gagal lebih dulu.** Lima di antaranya wajib:

```ts
describe("agregat Form C1", () => {
  it("menjumlahkan omzet per mata uang dari bon berbaris banyak tanpa menggandakan bonnya", () => {});
  it("membaca mata uang dari currencyId pada bon lama DAN dari lines pada bon berbaris banyak", () => {});
  it("mengecualikan bon CANCELLED, isDemo, dan isHistorical", () => {});
  it("melaporkan jumlah nasabah tanpa occupationCategory alih-alih diam-diam mengecilkan penyebut", () => {});
  it("persentase pekerjaan dihitung atas nasabah berkategori saja, dan itu dinyatakan hasilnya", () => {});
});
```

      **Jebakan bon berbaris banyak.** `exchange_transactions.rupiahAmount` adalah nilai **bonnya**,
      bukan nilai barisnya; menjumlahkan hasil join baris apa adanya menghitung bon yang sama
      berkali-kali. Omzet **per mata uang** justru harus datang dari
      `exchange_transaction_lines.rupiahAmount`, sementara **jumlah bon** dari bonnya. Ini kekeliruan
      yang sama yang sudah pernah terjadi pada `foldMonthlyActivity` Paket H — lihat komentarnya.

- [x] **Step 2: Pisahkan lipatan murni dari querynya**, persis seperti Paket H memisahkan
      `foldMonthlyActivity` dari `readMonthlyCustomerActivity`. Yang murni diuji tanpa basis data;
      yang menyentuh basis data diuji dengan palsu yang **menyaring `where` dan menerapkan
      `orderBy`**.

- [x] **Step 3: Jangan menulis pembaca bulanan kedua.** Bila tugas ini mulai menghitung aktivitas
      **per nasabah per bulan**, itu pertanyaan Paket H dan jawabannya sudah ada di
      `server/customerProfileMonitoring.ts` — pakai yang itu. Yang dibangun di sini adalah komposisi
      **seluruh lembaga selama satu periode**, pertanyaan yang berbeda.

- [x] **Step 4:** Prosedur tRPC `ira.dataForm` dengan gerbang CONTROLLER.

- [x] **Step 5:** Perintah mutu, lalu commit `"Pembaca agregat Form C1"`.

---

### Task 7: Halaman Klasifikasi Risiko dan Ambang

**Files:** Create `client/src/pages/KlasifikasiRisiko.tsx`; Modify `client/src/App.tsx`,
`shared/backOfficeNavigation.ts`, `server/backOfficeNavigation.test.ts`

- [x] **Step 1:** Daftarkan rute `/kepatuhan/klasifikasi-risiko` (`minimumRole: "CONTROLLER"`) pada
      `shared/backOfficeNavigation.ts` **dan** pada `server/backOfficeNavigation.test.ts`. Ujinya
      gagal sampai keduanya ada.

- [x] **Step 2:** Halamannya: satu tab per dimensi, tiap baris memuat kode, label, dan tiga pilihan
      tingkat (TPPU/TPPT/PPSPM), plus `sourceNote` wajib. Kode yang belum diklasifikasikan
      **ditampilkan lebih dulu** beserta hitungannya — itu pekerjaan yang menunggu, bukan
      keadaan sah.

- [x] **Step 3:** Bagian ambang pita: 33 parameter, tiap parameter lima pita, dengan tombol
      "kembalikan ke nilai template". Menampilkan kapan terakhir disunting dan oleh siapa.

- [x] **Step 4:** Keadaan loading, kosong, dan **error** ketiganya dilihat di layar. Keadaan error
      halaman Pemantauan Profil Paket H belum pernah dilihat sungguhan dan itu tercatat sebagai
      risiko residual — jangan mengulanginya di sini.

- [x] **Step 5: Peragakan di basis data lokal:** klasifikasikan USD (TPPU TINGGI, TPPT TINGGI,
      PPSPM TINGGI) dan SGD (TPPU TINGGI, TPPT MENENGAH, PPSPM TINGGI), lalu tunjukkan hasilnya di
      layar. Verifikasi visual yang berhenti pada halaman kosong belum membuktikan apa pun.

- [x] **Step 6:** Perbarui `docs/SKEMA-DATABASE-PROJECT.md` (lima kolom dan dua tabel baru) dan
      `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` (ruas borang nasabah dan bon yang berubah).

- [x] **Step 7:** Perintah mutu, lalu commit `"Halaman klasifikasi risiko dan ambang IRA"`.

## Penutup J1

Sesudah Tugas 7: centang barisnya di ROADMAP, lalu **berhenti**. J2 adalah sesi tersendiri.
