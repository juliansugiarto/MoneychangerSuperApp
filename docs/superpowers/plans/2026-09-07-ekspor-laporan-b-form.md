# Paket G — Ekspor B0002/B0003/B0004 dari buku besar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghentikan pengetikan ulang angka laporan keuangan ke Excel — buku besar menghasilkan berkas berbentuk form B0002/B0003/B0004, aplikasi dapat membacanya kembali, dan snapshot regulatornya tertulis dari sumber yang sama.

**Architecture:** Struktur ketiga form sebagai konstanta murni di `shared/regulatoryForms.ts` (tanpa tabel dan tanpa migrasi); penulis workbook `server/financialFormExport.ts` yang membaca **hanya** keluaran `buildFinancialStatements`; jalur kedua pada `parseFinancialWorkbook` yang mengenali format resmi lewat label pos; rute unduhan pada `server/_core/index.ts` mengikuti pola template yang sudah ada; tombol pada halaman Laporan Keuangan hasil Paket F2.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, SheetJS (xlsx), Zod.

**Spec:** `docs/superpowers/specs/2026-09-07-ekspor-laporan-b-form-design.md`

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu.**

- [ ] Tugas 1 — Verifikasi struktur form terhadap berkas asli, lalu `shared/regulatoryForms.ts`
- [ ] Tugas 2 — Nilai tiap baris form dari laporan, murni dan teruji
- [ ] Tugas 3 — Penulis workbook tiga form
- [ ] Tugas 4 — Lembar penelusuran
- [ ] Tugas 5 — Importir mengenali format resmi
- [ ] Tugas 6 — Uji pulang-pergi ekspor → impor
- [ ] Tugas 7 — Gerbang tahun buku penuh dan snapshot bersumber buku besar
- [ ] Tugas 8 — Rute unduhan, otorisasi, dan tombol pada halaman Laporan Keuangan
- [ ] Tugas 9 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

Urutannya mengikat: **1 sebelum segalanya**; 2 sebelum 3 dan 4; 3 sebelum 6; 5 sebelum 6; 3 dan 7
sebelum 8. Tugas 9 terakhir.

## Prasyarat yang memblokir

**Tugas 1 tidak dapat dimulai sebelum berkas form B0002/B0003/B0004 asli ada di dalam proyek.**
Struktur pada spec diturunkan dari tangkapan layar; label yang meleset satu kata membuat importir
melewati barisnya, dan menebak label regulator dilarang aturan proyek (preseden Paket K3).

Yang dibutuhkan: satu berkas Excel form BI (boleh yang sudah terisi tahun 2025, boleh yang kosong).
Bila berkasnya memuat pembukuan asli, **angkanya tidak boleh masuk kode, uji, fixture, maupun
dokumentasi** — hanya strukturnya yang diambil, dan berkas sumbernya tidak di-commit.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Muat variabel lingkungan lebih dulu:
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Perintah mutu wajib: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`,
  `./node_modules/.bin/vite build`.
- **Baseline sebelum paket ini, dijalankan 7 September 2026 sesudah Paket F2 selesai:**
  `Test Files 115 passed (115)`, `Tests 870 passed | 2 skipped (872)`. **Sebutkan angka yang
  benar-benar dilihat, jangan mengarang.**
- **Satu uji diketahui flaky dan bukan bagian paket ini:** `server/tenantIsolation.live.test.ts` >
  *"setiap ikatan hanya melihat database miliknya sendiri"*. Bila gagal sendirian di bawah beban,
  jalankan ulang berkas itu saja; jangan memperbaikinya di sini.
- **Tidak ada migrasi pada paket ini.** Struktur form adalah konstanta, bukan tabel. Bila sebuah
  tugas terasa menuntut tabel baru, **berhenti dan laporkan** — itu tanda rancangannya bergeser.
- **Jangan mengubah `shared/chartOfAccounts.ts`.** Ketiga form memetakan akun yang sudah ada; bila
  ada baris form yang tidak punya akun, catat sebagai baris bernilai nol beserta alasannya (spec
  bagian 3), jangan menambah akun.
- **Jangan menambahkan pengiriman otomatis ke BI.** Ekspor menghasilkan berkas; manusia mengirim.
- **Jangan menyalin nominal dari berkas asli pengguna** ke kode, uji, fixture, log, tangkapan
  layar, dokumentasi, maupun commit. Uji memakai angka karangan sendiri.
- **Ekspor tidak menghitung ulang saldo.** Satu-satunya sumber angkanya adalah keluaran
  `buildFinancialStatements` — spec bagian 4.
- Peran `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Ekspor dan snapshot: Controller ke atas.
- Impor tetap mempertahankan batas 5 MB serta validasi MIME/base64/signature yang sudah ada.
- **Tanggal:** kolom `date` dibaca lewat `calendarDay`, ditulis lewat `dbDate`. Jangan memakai
  `isoDay` untuk itu (bug paket K1). Rentang dari router adalah tengah malam **UTC**.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `shared/regulatoryForms.ts` | Struktur ketiga form: baris, label, indentasi, kolom, sumber | 1 |
| `shared/regulatoryForms.test.ts` | Uji keutuhan struktur dan `recordCount` 19/25/7 | 1 |
| `shared/regulatoryFormValues.ts` | `buildFormValues(statements)` — murni, memecah pos bersih | 2 |
| `shared/regulatoryFormValues.test.ts` | Uji pemecahan tanda dan subtotal | 2 |
| `server/financialFormExport.ts` | Penulis workbook: header, tata letak, subtotal | 3, 4 |
| `server/financialFormExport.test.ts` | Uji header, jumlah record, dan tata letak | 3 |
| `server/financialFormTrace.test.ts` | Uji lembar penelusuran | 4 |
| `server/financialImport.ts` | Jalur kedua: mengenali format resmi lewat label | 5 |
| `server/financialImportOfficial.test.ts` | Uji pengenalan label dan pos tidak dikenal | 5 |
| `server/financialFormRoundTrip.test.ts` | Ekspor → impor → nilai identik | 6 |
| `server/financialFormSnapshot.test.ts` | Gerbang tahun buku dan snapshot buku besar | 7 |
| `server/_core/index.ts` | Rute `GET /api/financial-form-export` | 8 |
| `server/financialFormExport.authorization.test.ts` | Uji otorisasi rute | 8 |
| `client/src/pages/LaporanKeuangan.tsx` | Tombol unduh beserta keterangannya | 8 |
| `server/financialFormScenario.test.ts` | Skenario satu tahun buku penuh | 9 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku yang berubah | 9 |

---

### Task 1: Verifikasi struktur form terhadap berkas asli, lalu `shared/regulatoryForms.ts`

**Files:**
- Create: `shared/regulatoryForms.ts`
- Test: `shared/regulatoryForms.test.ts`

**Interfaces:**
- Consumes: berkas form asli dari pengguna; `shared/chartOfAccounts.ts`.
- Produces: `REGULATORY_FORMS`, tipe `FormRow`/`FormRowSource`. Dipakai seluruh tugas berikutnya.

- [ ] **Step 1: Baca berkas aslinya, jangan percaya spec**

```bash
./node_modules/.bin/tsx -e 'import * as XLSX from "xlsx"; const wb = XLSX.readFile(process.argv[1]!); for (const name of wb.SheetNames) { console.log("=== " + name); console.log(XLSX.utils.sheet_to_csv(wb.Sheets[name]).slice(0, 4000)); }' <path-berkas>
```

Cocokkan label, urutan, indentasi, dan *Jumlah Record* dengan tabel pada spec bagian 1. **Setiap
perbedaan dimenangkan berkasnya**, dan spec diperbarui sambil lewat.

- [ ] **Step 2: Tulis uji yang gagal**

```ts
describe("struktur form regulator", () => {
  it("memiliki jumlah baris isian yang sama dengan Jumlah Record pada headernya", () => {
    for (const form of REGULATORY_FORMS) {
      const isian = form.rows.filter((row) => row.source.kind === "AKUN" || row.source.kind === "SISI");
      expect(isian).toHaveLength(form.recordCount);
    }
  });

  it("hanya menunjuk akun yang ada pada bagan akun", () => { /* findAccount(code) !== null */ });
  it("tidak punya kunci baris ganda", () => { /* … */ });
  it("subtotal hanya menunjuk baris yang berada di atasnya", () => { /* … */ });
  it("memberi setiap baris B0002 sebuah kolom kiri atau kanan", () => { /* … */ });
});
```

- [ ] **Step 3: Tulis strukturnya**, mengikuti bentuk pada spec bagian 1. Beri komentar pada baris
      yang tidak punya akun penyusun, menyebut mengapa ia tetap ada (spec bagian 3).

- [ ] **Step 4: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add shared/regulatoryForms.ts shared/regulatoryForms.test.ts docs/superpowers/specs/2026-09-07-ekspor-laporan-b-form-design.md
git commit -m "Struktur form B0002/B0003/B0004 sebagai data"
```

---

### Task 2: Nilai tiap baris form dari laporan, murni dan teruji

**Files:**
- Create: `shared/regulatoryFormValues.ts`, `shared/regulatoryFormValues.test.ts`

**Interfaces:**
- Consumes: `REGULATORY_FORMS`; keluaran `buildFinancialStatements`.
- Produces: `buildFormValues(input): { formCode, rows: { key, label, value, indent, column, trace }[] }`.

- [ ] **Step 1: Uji yang gagal** — tiga yang paling mudah salah:
      - saldo positif mengisi baris `Laba` dan menyisakan `Rugi (-)` nol;
      - saldo negatif mengisi baris `Rugi (-)` sebagai **bilangan positif**, bukan negatif;
      - subtotal sama dengan jumlah baris yang ditunjuknya, bukan dihitung ulang dari akun.
- [ ] **Step 2: Tulis fungsinya.** Murni; tidak menyentuh basis data dan tidak memanggil
      `accountBalancesFor`. Tiap baris membawa `trace` berisi kode akun dan saldo bertandanya.
- [ ] **Step 3:** Perintah mutu, lalu commit `"Nilai baris form dari laporan keuangan"`.

---

### Task 3: Penulis workbook tiga form

**Files:**
- Create: `server/financialFormExport.ts`, `server/financialFormExport.test.ts`

- [ ] **Step 1: Uji yang gagal** — header memuat sandi pelapor, tahun, nomor form, jumlah record,
      dan `Jenis Periode: A`; B0002 menaruh aset di kolom kiri dan kewajiban/ekuitas di kanan;
      jumlah baris isian tiap sheet sama dengan `recordCount`.
- [ ] **Step 2: `biReporterCode` kosong menjadi penghalang beralasan**, bukan header kosong.
- [ ] **Step 3: Tulis penulisnya** dengan `XLSX.utils.aoa_to_sheet`, mengikuti pola
      `createFinancialWorkbookTemplate`. Angkanya **hanya** dari keluaran `buildFinancialStatements`.
- [ ] **Step 4:** Perintah mutu, lalu commit `"Penulis workbook form B0002/B0003/B0004"`.

---

### Task 4: Lembar penelusuran

**Files:** Modify `server/financialFormExport.ts`; Test `server/financialFormTrace.test.ts`

- [ ] **Step 1: Uji yang gagal** — tiap pos berisi muncul satu baris beserta akun dan saldonya;
      baris `SISI` menyebut saldo bertandanya dan sisi mana yang terpakai; baris yang selalu nol
      menyebut alasannya.
- [ ] **Step 2: Tulis sheet `Penelusuran`.**
- [ ] **Step 3:** Perintah mutu, lalu commit `"Lembar penelusuran pos ke akun pada ekspor"`.

---

### Task 5: Importir mengenali format resmi

**Files:** Modify `server/financialImport.ts`; Test `server/financialImportOfficial.test.ts`

- [ ] **Step 1: Uji yang gagal** — berkas berformat resmi terbaca lewat label; berkas ber-Record No
      **tetap terbaca persis seperti sebelumnya** (uji lama tidak boleh berubah); label yang tidak
      dikenal dikembalikan sebagai daftar pos yang dilewati beserta labelnya, bukan diabaikan.
- [ ] **Step 2: Normalkan label** — huruf kecil, spasi tunggal, tanpa `(-)`, `(-/-)`, `(net)`.
      Normalisasinya fungsi murni tersendiri supaya dapat diuji tanpa workbook.
- [ ] **Step 3: Bercabang di depan** pada penanda `Nomor Form`; jalur lama tidak disentuh.
- [ ] **Step 4:** Perintah mutu, lalu commit `"Impor mengenali tata letak form resmi"`.

---

### Task 6: Uji pulang-pergi ekspor → impor

**Files:** Create `server/financialFormRoundTrip.test.ts`

- [ ] **Step 1:** Susun laporan dari saldo karangan, ekspor, lalu `parseFinancialWorkbook` atas
      buffer hasilnya, lalu bandingkan **nilai tiap pos** dengan keluaran `buildFinancialStatements`.
- [ ] **Step 2:** Sertakan kasus bertanda negatif dan kasus nol — keduanya yang paling mungkin
      hilang dalam penulisan dan pembacaan.
- [ ] **Step 3:** Perintah mutu, lalu commit `"Uji pulang-pergi ekspor dan impor form"`.

---

### Task 7: Gerbang tahun buku penuh dan snapshot bersumber buku besar

**Files:** Modify `server/financialFormExport.ts`; Test `server/financialFormSnapshot.test.ts`

- [ ] **Step 1: Uji yang gagal** — rentang selain 1 Januari–31 Desember ditolak beserta pesan yang
      menyebut tahun terdekat; ekspor menulis satu snapshot bersumber `"Buku besar"`; ekspor kedua
      atas angka yang sama tidak menghasilkan snapshot kembar (`sourceDigest`); angka yang berubah
      menghasilkan snapshot baru.
- [ ] **Step 2: Panggil `createFinancialStatementSnapshot`** dengan `code` berisi kunci baris form.
- [ ] **Step 3:** Perintah mutu, lalu commit `"Gerbang tahun buku dan snapshot bersumber buku besar"`.

---

### Task 8: Rute unduhan, otorisasi, dan tombol

**Files:** Modify `server/_core/index.ts`, `client/src/pages/LaporanKeuangan.tsx`; Test `server/financialFormExport.authorization.test.ts`

- [ ] **Step 1: Uji otorisasi** — STAFF dan ADMIN ditolak; `mustChangePassword` ditolak; Controller
      dan Shareholder diterima. Pola dan pesannya mengikuti `/api/financial-snapshot-template`.
- [ ] **Step 2: Rute `GET /api/financial-form-export?year=YYYY`** dengan `Content-Disposition`
      bernama tahunnya.
- [ ] **Step 3: Tombol pada halaman Laporan Keuangan**, dengan keterangan bahwa berkasnya **tidak**
      dikirim ke BI oleh aplikasi, dan tombolnya mati beralasan bila rentangnya bukan tahun penuh.
- [ ] **Step 4: Verifikasi visual** rute dan tombolnya. Login dilakukan pengguna; minta pada
      giliran itu.
- [ ] **Step 5:** Perintah mutu, lalu commit `"Unduhan ekspor form dan tombolnya"`.

---

### Task 9: Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

**Files:** Create `server/financialFormScenario.test.ts`; Modify panduan A–Z, skema database, ROADMAP

- [ ] **Step 1: Skenario satu tahun buku penuh** dari saldo karangan: ekspor → ketiga sheet terisi
      sesuai `recordCount` → impor kembali → snapshot tertulis → paket regulator dapat dibuat.
- [ ] **Step 2: Skenario yang gagal dengan benar** — sandi pelapor kosong, rentang bukan tahun
      penuh, dan label form yang diubah manusia.
- [ ] **Step 3: Peragaan end-to-end** pada `moneychanger` memakai data paket E/F1/F2 yang sudah ada.
      **Minta izin pengguna pada giliran itu juga** sebelum menulis data uji apa pun.
- [ ] **Step 4: Perbarui dokumentasi** — panduan A–Z (cara mengekspor dan apa yang tidak dilakukan
      aplikasi), skema database (tidak ada tabel baru; sebut struktur form sebagai konstanta), dan
      ROADMAP.
- [ ] **Step 5:** Perintah mutu, sebutkan angka uji yang benar-benar dilihat, lalu commit
      `"Skenario ekspor form menyeluruh, peragaan, dan dokumentasi"`.
