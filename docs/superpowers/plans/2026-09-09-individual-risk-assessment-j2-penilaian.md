# Paket J2 — Penilaian IRA, kuesioner KPMR, dan persetujuannya

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup temuan BI 11 — satu penilaian risiko lembaga per periode, sisi inherennya
**terhitung dari basis data**, sisi KPMR-nya kuesioner 31 pertanyaan, nilai akhirnya lewat matriks
BI, disetujui SHAREHOLDER dan terkunci sesudahnya.

**Architecture:** Seluruh aritmetika sebagai fungsi murni di `shared/individualRiskAssessment.ts`;
katalog parameter dan pertanyaan sebagai konstanta di `shared/`; empat tabel penilaian; halaman
penilaian dan kuesioner; pembekuan snapshot saat disetujui.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-09-09-individual-risk-assessment-design.md`

**Prasyarat:** `plans/2026-09-09-individual-risk-assessment-j1-fondasi-data.md` **selesai
seluruhnya.** Tanpa J1 tidak ada kosakata, tidak ada klasifikasi, dan tidak ada agregat — sisi
inherennya akan selalu nol, dan itu bukan penyelesaian.

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu.**

- [x] Tugas 1 — Aritmetika penilaian, murni dan teruji
- [x] Tugas 2 — Katalog 33 parameter risiko inheren
- [x] Tugas 3 — Katalog 31 pertanyaan KPMR
- [x] Tugas 4 — Migrasi: empat tabel penilaian
- [x] Tugas 5 — Penghitung sisi inheren dari agregat dan klasifikasi
- [x] Tugas 6 — Penulis penilaian: buat, simpan, ajukan, setujui, gantikan
- [x] Tugas 7 — Halaman penilaian: Form C1, Form A1, pernyataan struktural
- [x] Tugas 8 — Kuesioner KPMR dan halaman hasil
- [ ] Tugas 9 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

Urutannya mengikat: **1, 2, dan 3 sebelum 5**; 4 sebelum 6; 5 dan 6 sebelum 7; 7 sebelum 8;
9 terakhir.

## Keputusan pengguna yang mengikat

Ditetapkan 9 September 2026. **Jangan menurunkannya ulang dan jangan menawarnya.**

1. **Siklus tahunan ditambah pemicu manual** beserta alasan tertulis.
2. **ADMIN mengisi, SHAREHOLDER menyetujui.** Yang sudah disetujui **terkunci**; perbaikan berarti
   penilaian baru yang menggantikannya.
3. **IRA tidak pernah menulis ke `customers`** — tidak otomatis, dan tidak sebagai usulan.
4. **Nilai dibekukan sebagai snapshot saat disetujui**: nilai tiap parameter, ambang yang berlaku,
   dan klasifikasi yang dipakai.
5. **Seluruh aritmetika fungsi murni di `shared/`**, tanpa basis data dan tanpa jam.

## Angka yang mengikat — dari template BI, jangan diturunkan ulang

Dibaca 9 September 2026 dari berkas template milik pengguna. **Rumusnya diikuti apa adanya**, dua
kejanggalannya sengaja tidak diperbaiki (lihat spec Rancangan 4).

- **Skalanya terbalik: `5 = risiko Rendah`, `1 = risiko Tinggi`.**
- Bobot jenis: TPPU 0,4 · TPPT 0,3 · PPSPM 0,05 · Struktural 0,25.
- Bobot kelompok — TPPU 0,3/0,2/0,3/0,2 · TPPT 0,2/0,2/0,3/0,3 · PPSPM 0,1/0,2/0,4/0,3 ·
  Struktural: Kepemilikan 0,8, Lini Bisnis 0,2.
- Anchor predikat: 1 Tinggi · 2 Menengah ke Tinggi · 3 Menengah · 3,75 Rendah ke Menengah ·
  4,5 Rendah. Pencarian **nilai terbesar yang tidak melebihi** (`VLOOKUP(..., TRUE)`).
- KPMR: rata-rata pilar = `Σ jawaban / banyaknya jawaban bukan N/A`; nilai KPMR = **rata-rata
  sederhana** kelima pilar. **Bobot pilar 30/25/25/10/10 tidak dipakai rumusnya** — ditampilkan
  sebagai keterangan saja.
- Matriks nilai akhir (baris predikat inheren × kolom predikat KPMR):

  | | Unsat | Marginal | Fair | Satisf | Strong |
  |---|---|---|---|---|---|
  | Tinggi | 1 | 1 | 2 | 3 | 3 |
  | Menengah ke Tinggi | 1 | 2 | 2 | 3 | 4 |
  | Menengah | 2 | 2 | 3 | 4 | 4 |
  | Rendah ke Menengah | 2 | 3 | 4 | 4 | 5 |
  | Rendah | 3 | 3 | 4 | 5 | 5 |

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
  `Test Files 138 passed (138)`, `Tests 1119 passed | 2 skipped (1121)`. J1 sudah menambah uji di
  atas angka itu — **sebutkan angka yang benar-benar dilihat sesudah J1, jangan mengarang.**
- **Satu uji diketahui flaky dan bukan bagian paket ini:** `server/tenantIsolation.live.test.ts` >
  *"setiap ikatan hanya melihat database miliknya sendiri"*.
- **Migrasi hanya lewat `node scripts/tenant.mjs migrate-all`**, tidak pernah `.sql` langsung. Dua
  basis data lokal saja. **Jangan menerapkan migrasi ke produksi.** J1 menghasilkan `0053`; J2
  menghasilkan `0054`.
- **Tepat satu tugas migrasi di rencana ini: Tugas 4.**
- **Jangan menyentuh `ACCUMULATED_TRANSACTION_STATUSES`** dan **jangan menulis helper jendela waktu
  keempat**.
- **Basis data palsu pada uji wajib menyaring `where` dan menerapkan `orderBy`** — salin polanya
  dari `server/companyDocumentArchive.test.ts`; awas jebakan `StringChunk`.
- **Rute baru wajib didaftarkan pada `server/backOfficeNavigation.test.ts`.**
- **Dialog wajib `max-h-[85vh] overflow-y-auto`.**
- Peran `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`, ditegakkan di tRPC lewat fungsi `*Denial` yang
  dapat diuji.
- **Jangan menambahkan pengiriman otomatis** ke BI maupun PPATK, dan **jangan memblokir transaksi**
  atas dasar hasil penilaian.
- **Jangan menyimpan workbook aktual, data KYC nyata, atau secret** di source, fixture, log,
  screenshot, dokumentasi, maupun commit. Yang boleh masuk hanyalah **struktur** template — nama
  parameter, bobot, pita, teks pertanyaan. Angka omzet dan jumlah nasabah pada berkas milik pengguna
  adalah data operasional dan **tidak boleh** ikut, termasuk sebagai fixture uji.
- **Membuat data uji pada basis data lokal diizinkan tanpa bertanya lebih dulu.** **Data uji paket
  E, F1, F2, G, H, I, dan J1 sengaja dibiarkan — jangan dibersihkan.**

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `shared/individualRiskAssessment.ts` | Pita, bobot, predikat, matriks, rata-rata KPMR | 1 |
| `shared/individualRiskAssessment.test.ts` | Uji aritmetika termasuk kasus skala terbalik | 1 |
| `shared/iraParameterCatalogue.ts` | 33 parameter beserta bobot dan jenis pitanya | 2 |
| `shared/iraParameterCatalogue.test.ts` | Uji bobot tiap kelompok berjumlah 1 | 2 |
| `shared/iraKpmrCatalogue.ts` | 31 pertanyaan, lima pilar, keberlakuan KUPVA BB | 3 |
| `drizzle/schema.ts`, `drizzle/0054_*.sql` | Empat tabel penilaian | 4 |
| `server/iraInherentScoring.ts` | Agregat × klasifikasi × katalog → nilai parameter | 5 |
| `server/iraAssessment.ts` | Penulis penilaian, `iraApprovalDenial`, pembekuan snapshot | 6 |
| `server/iraAssessment.test.ts`, `.authorization.test.ts` | Uji penulis, kunci, dan peran | 6 |
| `client/src/pages/PenilaianRisiko.tsx`, `PenilaianRisikoDetail.tsx` | Daftar dan detail | 7 |
| `client/src/pages/PenilaianRisikoKpmr.tsx` | Kuesioner dan hasil | 8 |
| `client/src/App.tsx`, `shared/backOfficeNavigation.ts` | Rute dan menu | 7, 8 |
| `server/iraScenario.test.ts` | Skenario menyeluruh | 9 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md`, ROADMAP | Perilaku dan skema | 9 |

---

### Task 1: Aritmetika penilaian, murni dan teruji

**Files:** Create `shared/individualRiskAssessment.ts`, `shared/individualRiskAssessment.test.ts`

**Interfaces:**
- Consumes: **tidak ada.** Tanpa `getDb`, tanpa `new Date()`, tanpa impor dari `server/`.
- Produces: `scoreFromPercentageBand`, `scoreFromPresence`, `weightedGroupScore`,
  `inherentTotalScore`, `riskPredicate`, `kpmrPillarAverage`, `kpmrScore`, `finalAssessmentValue`,
  beserta konstanta bobot, anchor, dan matriksnya.

- [x] **Step 1: Tulis uji yang gagal lebih dulu.** Yang wajib ada:

```ts
describe("aritmetika IRA", () => {
  it("0% menghasilkan 5 dan 100% menghasilkan 1 — skalanya TERBALIK", () => {});
  it("tepat pada batas pita mengambil pita yang lebih rendah risikonya", () => {});
  it("predikat memakai nilai terbesar yang tidak melebihi: 3,74 Menengah, 3,75 Rendah ke Menengah", () => {});
  it("rata-rata pilar mengecualikan N/A, bukan menghitungnya sebagai nol", () => {});
  it("pilar yang seluruhnya N/A tidak menghasilkan NaN", () => {});
  it("nilai KPMR adalah rata-rata SEDERHANA kelima pilar, bukan berbobot 30/25/25/10/10", () => {});
  it("matriks: inheren Rendah × KPMR Strong = 5; inheren Tinggi × KPMR Unsatisfactory = 1", () => {});
});
```

      **Uji pertama adalah penjaga paling penting di seluruh paket ini.** Bila skalanya terbalik,
      seluruh laporan tetap rapi, tetap berisi angka, dan tetap salah.

      **Uji keenam sengaja mengunci kejanggalan template** (spec Rancangan 4.1). Bila kelak BI
      menuntut rata-rata berbobot, uji inilah yang harus diubah lebih dulu — dengan sadar.

- [x] **Step 2: Tulis fungsinya.** Setiap konstanta bernama beserta komentar yang menyebut sel
      asalnya pada template (`A1!F62`, `B!K46`, dan seterusnya). Tidak ada satu pun angka telanjang
      di tengah kode.

- [x] **Step 3: Uang dan persentase memakai `Decimal`**, bukan `number` mentah, sama seperti
      `foldMonthlyActivity`. Nilai akhirnya dibulatkan hanya saat ditampilkan, tidak saat dihitung.

- [x] **Step 4:** Perintah mutu, lalu commit `"Aritmetika penilaian risiko IRA, murni"`.

---

### Task 2: Katalog 33 parameter risiko inheren

**Files:** Create `shared/iraParameterCatalogue.ts`, `shared/iraParameterCatalogue.test.ts`

- [x] **Step 1:** Satu entri per parameter: `code`, `riskType`, `group`, `groupWeight`,
      `parameterWeight`, `bandType` (`PERSENTASE_LEBAR` 0-20/21-40/… · `PERSENTASE_SEMPIT`
      tidak ada/>0-1/… · `PERSENTASE_MENENGAH` 0-2/>2-4/… · `KEHADIRAN` ada/tidak ada), `source`
      (`TERHITUNG` atau `DINYATAKAN`), dan teks parameternya sebagaimana tertulis di template.

- [x] **Step 2:** Uji bahwa **bobot parameter dalam tiap kelompok berjumlah 1**, dan **bobot
      kelompok dalam tiap jenis risiko berjumlah 1**. Salin-tempel 33 baris pasti meleset di suatu
      tempat; uji inilah yang menemukannya, bukan pemeriksa BI.

- [x] **Step 3:** Uji bahwa jumlah parameter `TERHITUNG` adalah **24** dan `DINYATAKAN` adalah
      **9** — angka dari spec bagian Rancangan 6. Bila implementasinya menghasilkan angka lain,
      salah satu parameter kehilangan sumbernya dan itu harus terlihat sekarang, bukan nanti.

- [x] **Step 4:** Perintah mutu, lalu commit `"Katalog parameter risiko inheren IRA"`.

> **Dibaca dari templatenya 9 September 2026, dua penyimpangan dari sketsa di atas:**
>
> 1. **Jenis pitanya enam, bukan empat.** Selain `PERSENTASE_LEBAR`, `PERSENTASE_SEMPIT`,
>    `PERSENTASE_MENENGAH`, dan `KEHADIRAN`, lembar `A1` memuat `TINGKAT_RISIKO`
>    (`Rendah / Menengah / Tinggi` — empat parameter Wilayah Geografis, tiga tingkat, tidak dapat
>    dipaksakan menjadi kehadiran) dan `PERSENTASE_KEPEMILIKAN` (`Tidak ada / 1-99% / 100%` pada
>    `STRUKTURAL_1A`). Keduanya berupa **pilihan**, bukan batas numerik, dan karena itu
>    `IRA_BAND_DEFINITIONS` memberi tiap jenis pita `defaultUpperBounds` **atau** `choices`, tidak
>    keduanya.
> 2. **Kosakata sumbernya `HITUNG`/`NYATAKAN`**, bukan `TERHITUNG`/`DINYATAKAN` — J1 sudah
>    menetapkannya di `shared/iraParameters.ts` dan katalog ini membacanya dari sana alih-alih
>    membuat kosakata kedua. Jumlahnya tetap 24 dan 9.
>
> Katalognya **menggabung**, bukan menyalin: `code`, `label`, `group`, `riskType`, dan `source`
> datang dari `IRA_PARAMETERS`, `groupWeight` dari `IRA_GROUP_WEIGHTS`, dan hanya `parameterWeight`,
> `bandType`, serta `criterion` yang baru. Ujinya menjaga ketiga sumber itu tetap satu.

---

### Task 3: Katalog 31 pertanyaan KPMR

**Files:** Create `shared/iraKpmrCatalogue.ts`, `shared/iraKpmrCatalogue.test.ts`

- [x] **Step 1:** Lima pilar beserta pertanyaannya, teks lengkap apa adanya dari template:
      Direksi/Komisaris **7**, Kebijakan & Prosedur Tertulis **8**, Proses Manajemen Risiko **10**,
      Manajemen SDM **3**, Pengendalian Internal **3**.

- [x] **Step 2: Tandai keberlakuannya.** Template memberi kolom keberlakuan per jenis penyelenggara;
      pertanyaan yang **tidak** berlaku bagi KUPVA BB (mis. yang menyangkut transfer dana) ditandai
      `applicableToKupvaBb: false` dan tampil sebagai **N/A yang sudah terisi**, bukan pertanyaan
      kosong yang menunggu jawaban.

- [x] **Step 3: Kaitkan temuan pemeriksaan pada pertanyaannya.** Temuan 8 adalah pertanyaan KPT
      bertanda tangan dan pelaporan LTKM/LTKT pada pilar 1; temuan 9 adalah *"pengkinian profil
      nasabah dan profil transaksi"*; temuan 10 dan 11 ada di pilar 3; temuan 12 adalah pertanyaan
      pre-employee screening pada pilar 4. Simpan kaitannya sebagai `relatedFinding` agar layar
      dapat menunjukkan **pertanyaan mana yang pernah menjadi temuan** — itu yang paling berguna
      bagi penggunanya.

- [x] **Step 4:** Uji jumlah pertanyaan per pilar dan keunikan kodenya.

- [x] **Step 5:** Perintah mutu, lalu commit `"Katalog pertanyaan KPMR"`.

> **Dibaca dari lembar `B. KPMR 2025` 9 September 2026:**
>
> - Keberlakuan datang dari kolom `KUPVA BB` (kolom G) yang kosong, dan hasilnya **tepat satu**
>   pertanyaan tidak berlaku: `KPMR_P2_6`, KPT kegiatan **transfer dana**. Kolom itu terisi pada 30
>   pertanyaan lainnya.
> - Ruasnya `relatedFindings` (**jamak**), bukan `relatedFinding`. `KPMR_P3_6` — pengkinian profil
>   nasabah/transaksi beserta pemantauan kesesuaiannya — memang satu pertanyaan yang menjawab dua
>   temuan sekaligus (9 dan 10); memaksanya menjadi satu berarti menyembunyikan salah satunya.
> - Temuan 11 dikaitkan pada tiga pertanyaan pilar 3 yang benar-benar menuntut penilaian risiko
>   sendiri (RBA, kelengkapan faktor risiko, dan rujukan ke NRA/SRA), bukan pada seluruh pilar 3.
> - Kosakata pilarnya **dibaca dari** `IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY` supaya tidak ada daftar
>   pilar kedua. Ujinya menegakkan urutan dan kesamaannya.
> - **Jangan menjalankan `prettier` pada berkas paket ini.** Repo ini tidak berformat prettier (44
>   berkas `shared/` gagal `--check`, dan tidak ada konfigurasi), sehingga `--write` justru membuat
>   berkas baru berbeda gaya dari tetangganya. Dicoba dan dibatalkan 9 September 2026.

---

### Task 4: Migrasi — empat tabel penilaian

**Files:** Modify `drizzle/schema.ts`; Create migrasi

**Ini satu-satunya tugas migrasi di rencana ini.**

- [x] **Step 1: Tulis rencana rollback di berkas ini lebih dulu:**

      > **Rollback Tugas 4.** Keempat tabel baru di-`DROP TABLE` dalam urutan terbalik dari
      > pembuatannya; tidak ada tabel lama yang disentuh, sehingga tidak ada data lama yang hilang.
      > Baris `__drizzle_migrations` untuk `0054` dihapus pada kedua basis data lokal.

      **Rollback sebagaimana benar-benar dijalankan bila diperlukan** (ditulis 9 September 2026,
      sebelum migrasinya dibuat). Migrasi `0054` **hanya menambah** empat tabel: `ira_assessments`,
      `ira_inherent_values`, `ira_kpmr_answers`, `ira_structural_declarations`. Tidak ada
      `ALTER`, tidak ada `DROP`, dan tidak ada kolom tabel lama yang disentuh — karena itu
      pengembaliannya tidak dapat menghilangkan data mana pun yang sudah ada.

      ```sql
      -- urutan terbalik dari pembuatannya; tidak ada foreign key sehingga urutannya sebenarnya bebas
      DROP TABLE IF EXISTS `ira_structural_declarations`;
      DROP TABLE IF EXISTS `ira_kpmr_answers`;
      DROP TABLE IF EXISTS `ira_inherent_values`;
      DROP TABLE IF EXISTS `ira_assessments`;
      DELETE FROM `__drizzle_migrations` WHERE `hash` LIKE '%0054%';
      ```

      Dijalankan pada **kedua basis data lokal** (`moneychanger` dan `mc_t_abcvalas`) dan **tidak
      pernah** pada produksi — migrasi `0051`, `0052`, dan `0053` pun belum diterapkan di sana.
      Yang hilang bila dikembalikan hanyalah penilaian IRA yang dibuat sesudah migrasi ini; tidak
      ada bon, kas, nasabah, maupun jurnal yang ikut.

- [x] **Step 2: Empat tabel di `drizzle/schema.ts`:**
      `ira_assessments` (periode, status `DRAFT|MENUNGGU_PERSETUJUAN|DISETUJUI`, alasan pembukaan,
      pengaju, penyetuju, waktu persetujuan, `supersededByAssessmentId`, dan **nilai beku**: nilai
      inheren, nilai KPMR, nilai akhir beserta ketiga predikatnya);
      `ira_inherent_values` (satu baris per parameter: nilai mesin, nilai terpakai, alasan
      penyimpangan, dan angka mentah pembentuknya sebagai `json`);
      `ira_kpmr_answers` (satu baris per pertanyaan: nilai 1–5 **nullable** untuk N/A, catatan,
      rujukan dokumen);
      `ira_structural_declarations` (sembilan parameter `DINYATAKAN` beserta nilainya dan alasannya).

      **`ira_kpmr_answers.score` wajib nullable.** N/A adalah jawaban yang sah dan berbeda dari
      "belum dijawab"; bedakan keduanya dengan kolom `answered` tersendiri, jangan dengan nol.

- [x] **Step 3:** `drizzle-kit generate`, **baca SQL-nya**, pastikan tidak ada `DROP` maupun
      `MODIFY` atas tabel lama.

- [x] **Step 4:** Terapkan lewat `node scripts/tenant.mjs migrate-all`. **Hanya lokal.**

- [x] **Step 5:** Perintah mutu, lalu commit `"Migrasi 0054: tabel penilaian risiko IRA"`.

> **Sebagaimana benar-benar dijalankan 9 September 2026.** Migrasi terbitnya
> `drizzle/0054_silent_jackal.sql`: empat `CREATE TABLE` dan dua `CREATE INDEX`, **nol** `DROP`,
> `ALTER`, maupun `MODIFY` — diperiksa dengan membaca SQL-nya, bukan mengandaikannya.
> `node scripts/tenant.mjs migrate-all` melaporkan `ibukota selesai` dan `abcvalas selesai`, dan
> keenam tabel `ira_*` terbukti ada pada kedua basis data lokal. Data J1 utuh sesudahnya:
> 7 klasifikasi, 5 baris ambang, 3 nasabah, 9 bon. **Produksi tidak disentuh.**
>
> Dua hal yang ditetapkan di sini dan berlaku bagi tugas berikutnya:
>
> - **`periodEnd` eksklusif**, sama seperti `readIraDataForm` yang menyaring `transactionAt` dengan
>   `gte`/`lt`. Kolomnya `datetime`, jadi isinya jam UTC — jangan diperlakukan seperti kolom `date`.
> - **Nilai beku ditambah `frozenThresholds` dan `frozenClassifications`.** Keputusan 4 menuntut
>   ambang yang berlaku dan klasifikasi yang dipakai ikut dibekukan, bukan hanya nilai parameternya;
>   tanpa keduanya angka lama dapat disalin tetapi tidak dapat ditelusuri ulang.

---

### Task 5: Penghitung sisi inheren

**Files:** Create `server/iraInherentScoring.ts`, `server/iraInherentScoring.test.ts`

> **Tiga keputusan pengguna 9 September 2026, ditanyakan sebelum menulis penghitungnya** karena
> ketiganya mengubah kode dan tidak satu pun dapat ditebak dari rencana ini:
>
> 1. **Risiko jalur distribusi dinyatakan Controller**, bukan disimpulkan aplikasi.
>    `ira_risk_classifications` mendapat dimensi keenam `DISTRIBUTION_CHANNEL` lewat migrasi
>    **`0055_keen_crystal.sql`** — satu `ALTER TABLE ... MODIFY` yang hanya **menambah** nilai enum,
>    sehingga ketujuh baris yang sudah ada tetap sah.
>    **Rollback `0055`:** kosongkan dulu baris berdimensi jalur
>    (`DELETE FROM ira_risk_classifications WHERE dimension='DISTRIBUTION_CHANNEL';`), lalu
>    `ALTER TABLE ira_risk_classifications MODIFY COLUMN dimension enum('CURRENCY','OCCUPATION','LEGAL_FORM','COUNTRY','PROVINCE') NOT NULL;`
>    dan hapus baris `__drizzle_migrations` untuk `0055`. Selama masih ada baris berdimensi jalur,
>    `MODIFY` akan gagal — itu disengaja, bukan halangan yang perlu dipaksa.
> 2. **`readIraDataForm` diperluas** dengan komposisi kewarganegaraan *nasabah*
>    (`highRiskCountryCustomers`, `nationalityDenominator`, `customersWithoutNationality`).
>    `PPSPM_3A` bertanya tentang komposisi pengguna jasa; menjawabnya dengan angka transaksi akan
>    menggeser persentasenya sebanyak nasabah yang bertransaksi berulang.
> 3. **Ambang bawaan diperbaiki sekarang, bukan ditunda.** Bawaannya kini per jenis pita
>    (`defaultBandBounds`), `bandValidationError` menerima batas **0** (pita sempit templatnya
>    berbunyi "Tidak ada"), parameter berpilihan **tidak punya ambang sama sekali** dan menolak
>    disimpan, dan halaman Ambang menampilkan kriteria templatnya alih-alih lima kotak yang tidak
>    dibaca penghitung mana pun. Sebelum ini seluruh 33 parameter memakai `20/40/60/80`, sehingga
>    layar menampilkan angka yang bukan angka yang dipakai menghitung.

- [x] **Step 1: Uji lebih dulu:** agregat Form C1 palsu ditambah klasifikasi palsu menghasilkan
      nilai parameter yang diharapkan; parameter `DINYATAKAN` **tidak** dihitung di sini melainkan
      dibiarkan kosong; mata uang tanpa klasifikasi diperlakukan `RENDAH` dan **tidak** ikut
      persentase berisiko tinggi; nasabah tanpa `occupationCategory` tidak ikut penyebut dan
      jumlahnya dilaporkan.

- [x] **Step 2:** Susun fungsinya sebagai **murni juga** — masukannya agregat dan klasifikasi,
      keluarannya nilai parameter beserta angka mentahnya. Yang menyentuh basis data hanya
      pemanggilnya. Dengan begitu seluruh perhitungan kepatuhan dapat diuji tanpa MySQL.

- [x] **Step 3: Setiap nilai membawa angka mentahnya** (pembilang, penyebut, persentase, pita yang
      terpilih). Pemeriksa yang bertanya *"dari mana angka ini?"* dijawab layar, bukan dijawab
      dengan membuka kode.

- [x] **Step 4:** Perintah mutu, lalu commit `"Penghitung sisi risiko inheren"`.

> **Dua hal yang ditetapkan saat menulisnya:**
>
> - **Kosong yang terhitung selalu membawa `missingReason`.** Bila provinsi gerai belum diisi,
>   keempat parameter Wilayah Geografis bernilai kosong beserta alasannya — **bukan** RENDAH.
>   Membiarkannya jatuh ke RENDAH akan memberi nilai 5 kepada lembaga yang justru belum
>   memberitahukan lokasinya.
> - **`PPSPM_3C` mengakui batasnya di `basis`.** Skala usaha tidak tersimpan di mana pun, sehingga
>   seluruh nasabah berbentuk PT ikut terhitung termasuk yang UMKM; keterangannya ikut ke layar
>   supaya pemeriksa membaca batasnya, bukan menyangkanya angka yang persis.

---

### Task 6: Penulis penilaian

**Files:** Create `server/iraAssessment.ts`, `server/iraAssessment.test.ts`,
`server/iraAssessment.authorization.test.ts`; Modify `server/routers.ts`

- [x] **Step 1: Uji yang gagal lebih dulu**, dan uji otorisasinya terpisah:

```ts
describe("penilaian IRA", () => {
  it("ADMIN boleh mengisi dan mengajukan, tidak boleh menyetujui", () => {});
  it("SHAREHOLDER boleh menyetujui; CONTROLLER tidak", () => {});
  it("penilaian DISETUJUI menolak seluruh penyuntingan", () => {});
  it("membekukan nilai parameter, ambang, dan klasifikasi saat disetujui", () => {});
  it("nilai beku TIDAK berubah ketika klasifikasi diubah sesudahnya", () => {});
  it("penilaian pengganti menautkan supersededByAssessmentId ke pendahulunya", () => {});
  it("menolak penilaian kedua pada periode yang sama tanpa alasan tertulis", () => {});
  it("tidak pernah menulis ke tabel customers", () => {});
});
```

      **Uji kelima adalah alasan keberadaan snapshot.** Ia gagal bila implementasinya menghitung
      ulang saat membaca — kesalahan yang tidak terlihat sampai seseorang mengubah klasifikasi dan
      dokumen yang sudah ditandatangani ikut berubah di belakangnya.

      **Uji kedelapan menegakkan keputusan 3** dan meniru uji "hanya mencatat" Paket H dan Paket I.

- [x] **Step 2: `iraApprovalDenial(role)` dan `iraEditDenial(role, status)`** sebagai fungsi
      tersendiri yang dapat diuji.

- [x] **Step 3:** Penulisnya mencatat `audit_logs` pada pembuatan, pengajuan, persetujuan, dan
      penggantian.

- [x] **Step 4:** Prosedur tRPC `ira.*`.

- [x] **Step 5:** Perintah mutu, lalu commit `"Penulis penilaian risiko IRA"`.

> **Catatan pelaksanaan:**
>
> - **`ira` sudah menjadi router sejak J1** (berisi `dataForm`). Prosedur penilaian **disisipkan ke
>   dalamnya**, bukan dibuat sebagai router `ira` kedua — dua kunci bernama sama pada satu objek
>   memang ditolak `tsc`, dan itulah yang menangkapnya.
> - **`iraEditDenial` menerima statusnya sebagai masukan**, bukan hanya peran: penguncian penilaian
>   yang sudah disetujui adalah bagian dari otorisasi, dan menaruhnya di tempat lain berarti ada
>   jalur yang lupa memeriksanya. Penulisnya menegakkannya **sekali lagi** lewat `assertEditable`,
>   sehingga pemanggil mana pun terkena, bukan hanya yang lewat tRPC.
> - **`computeAssessmentTotals` murni** dan melempar bila ada parameter yang belum bernilai atau
>   pertanyaan yang belum dijawab. Penilaian setengah jadi yang tetap menghasilkan angka adalah
>   dokumen yang tampak lengkap padahal separuhnya karangan.
> - Pembacaan **tidak pernah menghitung ulang**; uji "nilai beku TIDAK berubah" memasang klasifikasi
>   hidup yang sengaja berbeda dari yang dibekukan, dan lulus justru karena pembacanya tidak
>   menyentuh klasifikasi itu.

---

### Task 7: Halaman penilaian

**Files:** Create `client/src/pages/PenilaianRisiko.tsx`, `PenilaianRisikoDetail.tsx`;
Modify `client/src/App.tsx`, `shared/backOfficeNavigation.ts`, `server/backOfficeNavigation.test.ts`

- [x] **Step 1:** Daftarkan `/kepatuhan/ira` dan `/kepatuhan/ira/:id` pada navigasi **dan** pada
      `server/backOfficeNavigation.test.ts`.

- [x] **Step 2:** Detailnya bertiga bagian: **Form C1** (angka terhitung, dengan hitungan nasabah
      belum berkategori tampil jujur di atas), **Form A1** (nilai mesin, nilai terpakai, tombol
      menyimpang beserta alasan wajib), dan **pernyataan struktural** (sembilan parameter
      `DINYATAKAN`, berlabel *"dinyatakan penilai"*).

- [x] **Step 3:** Penilaian `DISETUJUI` tampil **hanya-baca seluruhnya**, dengan tombol "buat
      penilaian pengganti" — bukan tombol sunting yang menolak saat diklik.

- [x] **Step 4:** Keadaan loading, kosong, dan **error** ketiganya dilihat di layar sungguhan.

- [x] **Step 5:** Perintah mutu, lalu commit `"Halaman penilaian risiko IRA"`.

> **Diperagakan di browser 9 September 2026** pada basis data lokal, penilaian `#1` periode
> 1 Jan – 31 Des 2026: Form C1 membaca 8 bon dan omzet Rp 219.800.000 (USD 95,91% · SGD 2,73% ·
> JPY 1,36%), Form A1 memberi `TPPU_1A = 1` dengan basis *"216800000.00 dari 219800000.00 =
> 98,64%"*, lalu **Ajukan → Setujui** menghasilkan nilai beku inheren **4,3160 · Rendah ke
> Menengah**, KPMR **4,0000 · Satisfactory**, dan nilai akhir **4 · Rendah ke Menengah** — sesuai
> matriksnya. `frozenThresholds` berisi 33 baris, `frozenClassifications` 7 baris, dan `audit_logs`
> memuat ketiga jejaknya (CREATED, SUBMITTED, APPROVED).
>
> **Dua hal yang hanya terlihat karena dibuka di layar:**
>
> 1. **Borang sempat mengarang nilai.** Parameter `NYATAKAN` yang belum dinyatakan ikut terkirim
>    bernilai 5 karena tombol simpannya memakai `score ?? 5`. Itu memberi nilai **teraman** kepada
>    parameter yang justru belum dinilai siapa pun. Sekarang parameter tanpa nilai **tidak dikirim**,
>    nilai parameter `NYATAKAN` diturunkan dari pilihan pernyataannya, dan layar menghitung berapa
>    yang belum bernilai (*"9 parameter belum bernilai"*) sebelum penilaiannya diajukan.
> 2. **Keadaan error tidak muncul dengan sendirinya.** `QueryClient` aplikasi ini memakai bawaan,
>    dan percobaan ulangnya berstatus `fetchStatus: "paused"`, sehingga halaman **bertahan di
>    keadaan memuat** alih-alih menampilkan galat — persis alasan bercabang pada `isPending` dan
>    bukan `isLoading`. Cabang error-nya dibuktikan dengan menahan percobaan ulang satu kali
>    (`retry: 0`, dikembalikan sesudahnya) dan membuka `/kepatuhan/ira/9999`: *"Penilaian gagal
>    dimuat. Penilaian 9999 tidak ditemukan."* beserta tombol **Coba lagi**.
>
> `readInherentMachineScores` ditambahkan pada `server/iraAssessment.ts` sebagai **satu-satunya
> pemanggil** `scoreInherentParameters` — tanpa itu penghitung Tugas 5 tidak punya pemanggil sama
> sekali, dan halamannya tidak akan punya angka mesin.

---

### Task 8: Kuesioner KPMR dan halaman hasil

**Files:** Create `client/src/pages/PenilaianRisikoKpmr.tsx`; Modify `client/src/App.tsx`,
`shared/backOfficeNavigation.ts`, `server/backOfficeNavigation.test.ts`, `shared/regulatoryActionQueue.ts`

- [x] **Step 1:** Kuesioner lima pilar, jawaban 1–5 atau **N/A**, dengan catatan dan rujukan
      dokumen. Pertanyaan yang pernah menjadi temuan pemeriksaan diberi penanda (Tugas 3 Step 3).

- [x] **Step 2:** Rata-rata tiap pilar tampil hidup di sampingnya, beserta **berapa pertanyaan yang
      ikut dihitung** — angka pembagi harus terlihat, karena N/A yang mengubahnya tidak kelihatan
      dari hasilnya saja.

- [x] **Step 3:** Bagian hasil: nilai inheren, nilai KPMR, matriks dengan **sel terpilih ditandai**,
      dan nilai akhir beserta predikatnya. Matriksnya digambar, bukan sekadar disebutkan — itu
      bentuk yang dikenali pemeriksa.

- [x] **Step 4: Jatuh tempo tahunan pada antrean tindakan regulator.** Pakai helper jendela
      operasional yang sudah ada; **jangan menulis helper keempat**, dan jangan membuat penilaian
      secara otomatis saat tahun berganti.

- [x] **Step 5:** Perintah mutu, lalu commit `"Kuesioner KPMR dan hasil penilaian"`.

> **Satu keputusan rancangan yang muncul saat mengerjakannya:** halaman kuesioner harus menampilkan
> nilai akhir **sebelum** penilaiannya disetujui, sedangkan rumusnya hidup di `server/`. Menyalin
> rumusnya ke klien berarti dua salinan yang pasti berselisih — dan selisihnya baru terlihat ketika
> pemeriksa membandingkan layar dengan dokumen yang sudah ditandatangani. Karena itu
> `computeAssessmentTotals` **dipindahkan ke `shared/iraAssessmentTotals.ts`**; server mengekspornya
> ulang sehingga ujinya tidak berubah, dan layar memakai fungsi yang sama persis dengan yang
> membekukan nilai.
>
> **Jatuh temponya tidak mengarang tenggat regulator.** `getIraAssessmentDue` menyatakan satu hal
> saja: tiap tahun kalender operasional membutuhkan satu penilaian `DISETUJUI`, dan sebuah tahun
> *terlambat* begitu tahun itu berakhir tanpa persetujuan. Batas tahunnya memakai
> `startOfOperationalMonth` yang sudah ada — 1 Januari 00.00 di zona operasional adalah awal bulan
> Januari — sehingga **tidak ada helper jendela keempat**. Penilaian yang sudah digantikan tidak
> lagi dihitung sebagai disetujui, dan tidak ada satu pun penilaian yang dibuat otomatis.
>
> **Diperagakan di layar 9 September 2026:** penilaian `#2` (2025, kosong) menampilkan *"Nilai akhir
> belum dapat dihitung — Parameter TPPU_1A belum bernilai"* beserta *"31 pertanyaan KPMR belum
> dijawab"*; penilaian `#1` menggambar matriksnya dengan sel **Rendah ke Menengah × Satisfactory =
> 4** ditandai; pilar Kebijakan dan Prosedur menampilkan *"Rata-rata pilar: 4.0000 dari 7 jawaban
> yang ikut dihitung, 8 pertanyaan"* — pembaginya terlihat, dan N/A transfer dana memang tidak ikut;
> pertanyaan yang pernah menjadi temuan bertanda *"Temuan pemeriksaan 8"*. Halaman Status Kesiapan
> menampilkan kartu **Penilaian risiko (IRA) — PERLU TINDAKAN — "Penilaian 2025 belum disetujui
> padahal tahunnya sudah berakhir."**
>
> Rutenya `/kepatuhan/ira/:id/kpmr` berparameter, jadi **bukan** tujuan sidebar dan tidak menyentuh
> `server/backOfficeNavigation.test.ts`; jalan masuknya tombol pada halaman penilaian.

---

### Task 9: Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

**Files:** Create `server/iraScenario.test.ts`; Modify dokumentasi

- [ ] **Step 1: Satu uji skenario** yang menempuh seluruh jalurnya: klasifikasi diisi → nasabah
      berkategori dibuat → bon dibuat pada beberapa mata uang → agregat dibaca → sisi inheren
      dihitung → KPMR dijawab termasuk satu N/A → diajukan → disetujui → nilainya beku → klasifikasi
      diubah → **nilai bekunya tidak berubah** → penilaian pengganti dibuat.

- [ ] **Step 2: Peragakan end-to-end di basis data lokal `moneychanger`.** Buat datanya, jalankan
      alurnya, **tunjukkan hasilnya di layar**: halaman penilaian berisi angka, matriks dengan sel
      tertandai, dan nilai akhir. Verifikasi visual yang berhenti pada halaman kosong belum
      membuktikan apa pun.

      Data uji paket sebelumnya sengaja dibiarkan; nasabah `CIF-000001` dan `CIF-000002` serta bon
      `FX-UJI-T4-*` sudah ada dan boleh dipakai sebagai bahan agregat, tetapi **jangan diubah**.

- [ ] **Step 3: Perbarui dokumentasi** — `docs/SKEMA-DATABASE-PROJECT.md` (empat tabel baru),
      `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` (alur penilaian, siapa mengisi, siapa menyetujui, arti
      skala terbalik), dan ROADMAP (centang Paket J).

- [ ] **Step 4: Laporkan risiko residual dengan jujur**, termasuk yang sudah diketahui: bobot pilar
      KPMR tidak dipakai, Aspek Kelembagaan tidak ada, klasifikasi bergantung manusia, nasabah lama
      belum berkategori, `pnpm audit` masih 9 temuan, dan migrasi `0051`–`0054` belum diterapkan ke
      produksi.

- [ ] **Step 5:** Perintah mutu, lalu commit `"Skenario penilaian risiko menyeluruh dan dokumentasi"`.

## Penutup J2

Sesudah Tugas 9: centang Paket J pada ROADMAP, lalu buat checkpoint beserta ringkasan risiko
residual yang jujur.
