# Prompt Siap Tempel untuk Sesi Baru

Satu tugas per sesi. Salin blok yang sesuai apa adanya ke sesi Claude Code yang baru — blok-blok ini
sengaja tidak menuntut konteks percakapan sebelumnya.

**Cara memilih blok:**

1. Buka `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`, lihat **Status Pengerjaan**.
2. Baris pertama yang belum tercentang adalah pekerjaan berikutnya.
3. Bila barisnya bertanda *(perlu sesi rancangan)* → pakai **Prompt A** untuk paket itu.
   Bila barisnya sebuah Tugas pada rencana yang sudah ada → pakai **Prompt B**.

---

## Prompt A — Sesi rancangan (paket yang belum punya rencana)

Menghasilkan dua dokumen: spec dan rencana bertugas. **Tidak menulis kode aplikasi.**

Ganti `<PAKET>` dengan huruf paketnya (D, C, E, F, G, H, I, J, atau K2) dan `<NAMA-BERKAS>` dengan
nama berkas kebab-case yang menggambarkan paketnya.

```
Baca docs/superpowers/ROADMAP-SISA-PEKERJAAN.md bagian "Paket <PAKET>", lalu baca juga bagian
"Aturan kerja yang berlaku untuk seluruh paket" pada dokumen yang sama.

Rancang paket ini. Telusuri kodenya sungguhan lebih dulu — sketsa di ROADMAP sengaja tidak cukup
untuk langsung menulis kode, dan rujukan berkas:baris di sana ditulis 4 September 2026 dan mungkin
sudah bergeser.

Jawab dulu setiap pertanyaan pada bagian "Pertanyaan yang harus dijawab spec-nya" bila ada.
Pertanyaan yang merupakan keputusan kebijakan (akuntansi, operasional, kepatuhan) TANYAKAN kepada
saya — jangan ditebak.

Hasilkan dua berkas:

1. docs/superpowers/specs/2026-XX-XX-<NAMA-BERKAS>-design.md
   Masalah, yang sudah diputuskan pengguna, rancangan, yang sengaja tidak dikerjakan, risiko
   residual. Ikuti bentuk docs/superpowers/specs/2026-09-04-penjurnalan-kas-design.md.

2. docs/superpowers/plans/2026-XX-XX-<NAMA-BERKAS>.md
   Rencana bertugas dengan bagian "Status Pengerjaan" di atas, tabel berkas, lalu tiap tugas
   berisi langkah bernomor dengan checkbox, potongan kode konkret, perintah verifikasi, dan
   perintah commit. Satu tugas = satu commit yang berdiri sendiri beserta ujinya sendiri.
   Ikuti bentuk docs/superpowers/plans/2026-09-04-penjurnalan-kas.md.

Setelah kedua berkas jadi, perbarui Status Pengerjaan pada ROADMAP: ganti baris "Sesi rancangan"
paket ini menjadi daftar tugas hasil rancanganmu, dan tambahkan rujukan ke berkas rencananya.

JANGAN menulis kode aplikasi pada sesi ini. Commit dokumentasinya saja, lalu berhenti dan laporkan.
```

---

## Prompt B — Sesi eksekusi (mengerjakan satu tugas)

Bentuk yang sudah terbukti pada paket A. Ganti `<RENCANA>` dan `<N>`.

```
Baca docs/superpowers/plans/<RENCANA>.md.
Kerjakan HANYA Tugas <N>, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

---

## Sesi berikutnya — keadaan per 9 September 2026

Paket K1, B, D, C, E, F1, F2, **G**, **H**, dan **I sudah selesai** dan diperagakan end-to-end.
**Pekerjaan berikutnya adalah Tugas 1 Paket J1** — rancangan Paket J selesai 9 September 2026, bloknya di bawah.

Baseline uji yang benar-benar dijalankan 9 September 2026 sesudah Paket I:
`Test Files 138 passed (138)`, `Tests 1119 passed | 2 skipped (1121)`. `tsc --noEmit` bersih,
`vite build` sukses.

**Satu uji diketahui flaky dan bukan bagian paket mana pun:** `server/tenantIsolation.live.test.ts`
> *"setiap ikatan hanya melihat database miliknya sendiri"*. Bila gagal sendirian di bawah beban,
jalankan ulang berkas itu saja.

### Yang tidak perlu ditemukan ulang

- **Jangan menulis helper jendela waktu yang keempat.** Batas hari dan bulan operasional memakai
  `startOfOperationalDay`/`startOfOperationalMonth` pada `shared/regulatoryActionQueue.ts`.
- **Kolom `datetime` menyimpan jam UTC, kolom `date` tidak.** Drizzle menserialisasi `datetime`
  sebagai string UTC sendiri, sementara kolom `date` diformat mysql2 memakai zona proses.
  Dibuktikan round-trip 8 September 2026. Membandingkan `transactionAt` terhadap instan absolut
  sudah benar apa adanya — jangan "memperbaikinya" seperti batas kolom `date`. Saat menulis fixture
  SQL untuk kolom `datetime`, tulis UTC, bukan WIB.
- **Status bon yang dihitung sebagai aktivitas nasabah ada satu daftar:**
  `ACCUMULATED_TRANSACTION_STATUSES` pada `drizzle/schema.ts`. Jangan menyalinnya. Daftar
  pengecualian LKU pada `operations.ts` berbeda isi dan berbeda arti — jangan digabung.
- **Borang penyuntingan nasabah wajib mengirimkan ketiga kolom deklarasi profil**
  (`declaredMonthlyValueIdr`, `declaredMonthlyCount`, `declaredCurrencies`). Yang tidak dikirim akan
  **dikosongkan**; itu disengaja, dan sudah pernah menjadi bug yang tertangkap hanya karena borangnya
  dibuka sungguhan di browser.
- **Nilai kolom `date` dibaca dengan penggetah LOKAL, "hari ini" dengan zona operasional.** Driver
  membangun nilai kolom `date` sebagai tengah malam waktu lokal proses, sehingga
  `toISOString().slice(0, 10)` atasnya memundurkan tanggalnya satu hari di WIB. Pakai
  `archiveDateKey` (`shared/companyDocumentArchive.ts`) untuk nilai kolom, dan `operationalDateKey`
  (`shared/regulatoryActionQueue.ts`) untuk "hari ini". **Jangan menyaring kolom `date` lewat SQL
  dengan `Date` tengah malam UTC** — itu menjatuhkan baris tepat pada batasnya.
- **Gerbang peran pada rute Express dipisahkan menjadi fungsi `*Denial` yang dapat diuji.** Dua
  preseden: `financialFormExportDenial` (`server/financialFormExport.ts:413`) dan
  `operationalDocumentUploadDenial` (`server/documentOperations.ts`). Otorisasi yang hanya hidup di
  dalam handler tidak pernah dibuktikan uji mana pun.
- **Basis data palsu pada uji wajib ikut menyaring `where` dan menerapkan `orderBy`.** Palsu yang
  mengabaikan keduanya membuat uji lulus karena kebetulan atau gagal karena kekeliruan palsunya
  sendiri. Polanya sudah ada di `server/companyDocumentArchive.test.ts` dan
  `server/companyDocumentArchiveScenario.test.ts` — **salin dari sana**. Jebakannya: `StringChunk`
  pemisah pada klausa Drizzle juga punya `value` (berupa array), dan harus disisihkan agar tidak
  merebut giliran `Param` yang sesungguhnya.
- **Rute baru wajib didaftarkan pada `server/backOfficeNavigation.test.ts`**, yang memetakan tiap
  tujuan sidebar ke nama halamannya. Ujinya gagal sampai rutenya ditambahkan.
- **Dialog wajib memakai `max-h-[85vh] overflow-y-auto`.** Tanpa itu, borang yang lebih tinggi
  daripada viewport menyembunyikan tombol tindakannya dan yang menggulir justru halaman di
  belakangnya — cacat yang tidak pernah muncul pada uji maupun `tsc`.
- **Berkas dokumen dan berkas impor punya dua batas yang BERBEDA.** Jalur dokumen
  (`server/documentOperations.ts`): **8 MB**, MIME saja, **tanpa** pemeriksaan signature. Jalur
  impor XLS/XLSX (`server/financialImport.ts`, `server/sanctionsWatchlistImport.ts`): **5 MB** plus
  `assertSpreadsheetSignature`. Jangan mencampurnya, dan jangan melonggarkan salah satunya.

### Risiko residual Paket I yang masih terbuka

1. **Unggah berkas dan tombol "Buka" belum pernah dijalankan sungguhan.** `.env` lokal tidak memuat
   kredensial R2, sehingga `storagePut` melempar galat di mesin ini. Baris `operational_documents`
   untuk peragaan disisipkan lewat SQL; seluruh alur di hilirnya sudah dijalankan lewat penulis yang
   sesungguhnya, tetapi kedua ujung jalur berkasnya masih belum terbukti di lingkungan mana pun.
2. **`deleteCompanyDocument` lama masih `DELETE` sungguhan tanpa audit**
   (`server/documentOperations.ts`). Ia melayani halaman Profil Perusahaan dan sengaja tidak
   disentuh Paket I.
3. **Jalur unggah dokumen tidak memeriksa signature** untuk PDF/JPG/PNG/WEBP — MIME saja. Keadaan
   yang sudah berlaku sebelum Paket I; menutupnya menyentuh unggahan KTP, underlying, dan struk,
   jadi pantas menjadi paketnya sendiri.
4. **Sertifikat izin pada Profil Perusahaan tidak mendapat peringatan masa berlaku** — akibat
   keputusan pengguna bahwa dokumen Profil Perusahaan tetap di tempatnya.
5. **Zona waktu server memakai bawaan `Asia/Jakarta`, bukan `company_profile.timezone`.** Tidak ada
   satu pun pemanggil di server yang membaca kolom itu. Tenant yang menyetel WITA atau WIT mendapat
   batas hari WIB di seluruh aplikasi — satu perbaikan menyeluruh, bukan tambalan di satu modul.
6. **`employee_certifications.documentId` dan `employee_pic_assignments.documentId` tetap selalu
   kosong** — tidak ada `ownerType` pegawai dan tidak ada layar yang mengunggahnya. Pekerjaan yang
   belum selesai pada jalur Kepegawaian, bukan keadaan sah.

### Risiko residual Paket H yang masih terbuka

1. Mata uang tak terdeklarasi **tidak** dinilai di jalur kasir — hanya nilai dan frekuensi. Ia
   terlihat di worklist pemantauan.
2. Ambang penyimpangan berlaku atas akumulasi **sebulan**, sehingga sesudah seorang nasabah
   melewatinya, transaksi berikutnya pada bulan itu ikut masuk review sampai bulan berganti.
3. Keadaan **error** halaman Pemantauan Profil belum pernah dilihat di layar.
4. `pnpm audit --prod --audit-level=high` masih melaporkan **9 temuan** (6 sedang, 3 tinggi):
   residual `xlsx`/SheetJS ditambah `mysql2 <3.22.0`. **Jangan menyebut audit bersih.**

### Keadaan basis data lokal

`moneychanger` memuat data peragaan paket E, F1, F2, G, H, dan I. **Jangan membersihkannya.**

Data Paket H: dua nasabah (`CIF-000001` berdeklarasi Rp 25.000.000 / 4 / USD+SGD, `CIF-000002`
tanpa deklarasi), bon `FX-UJI-T4-*` dan `UJI-T8-0001`, serta satu baris `customer_profile_reviews`.

Data Paket I: enam dokumen arsip pada `company_documents` (satu berversi dua, satu nonaktif), tujuh
baris `operational_documents` ber-`ownerType` `COMPANY_ARCHIVE`, dan satu pegawai
**"Sari Kepatuhan"** pada `employees` — pegawai itu satu-satunya baris `employees` di basis data
lokal, jadi Paket J yang menyentuh SDM akan menemukannya.

**Membuat data uji pada basis data lokal diizinkan pada tahap mana pun tanpa bertanya lebih dulu**
(ditetapkan pengguna 8 September 2026, tercatat di `CLAUDE.md`). Produksi tetap tidak boleh
disentuh — **migrasi `0051` dan `0052` belum diterapkan ke produksi.**

---

## Prompt jadi, urut sesuai peta jalan

Tinggal salin. Kerjakan dari atas ke bawah; lewati yang barisnya sudah tercentang di ROADMAP.

### Paket K1 — Batas tanggal (2 tugas)

```
Baca docs/superpowers/plans/2026-09-04-batas-tanggal-opname-checklist.md.
Kerjakan HANYA Tugas 1, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

```
Baca docs/superpowers/plans/2026-09-04-batas-tanggal-opname-checklist.md.
Kerjakan HANYA Tugas 2, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

### Paket B — Setoran modal pada persiapan go-live (3 tugas)

```
Baca docs/superpowers/plans/2026-09-04-setoran-modal-persiapan-go-live.md.
Kerjakan HANYA Tugas 1, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

```
Baca docs/superpowers/plans/2026-09-04-setoran-modal-persiapan-go-live.md.
Kerjakan HANYA Tugas 2, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

```
Baca docs/superpowers/plans/2026-09-04-setoran-modal-persiapan-go-live.md.
Kerjakan HANYA Tugas 3, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

### Paket D — Opname menyeluruh: pecahan dan brankas (6 tugas)

Sesi rancangannya sudah selesai; spec dan rencananya ada. Pakai **Prompt B**, ganti `<N>` dengan
nomor tugas pertama yang belum tercentang di ROADMAP.

```
Baca docs/superpowers/plans/2026-09-04-opname-pecahan-brankas.md.
Baca juga docs/superpowers/specs/2026-09-04-opname-pecahan-brankas-design.md
bagian "Yang sudah diputuskan pengguna" — empat keputusan di sana mengikat.
Kerjakan HANYA Tugas <N>, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

### Paket C — Penilaian kas UKA dan penutupan periode (sesi rancangan dulu)

```
Baca docs/superpowers/ROADMAP-SISA-PEKERJAAN.md bagian "Paket C", lalu baca juga bagian
"Aturan kerja yang berlaku untuk seluruh paket" pada dokumen yang sama. Baca juga spec paket A
(docs/superpowers/specs/2026-09-04-penjurnalan-kas-design.md) — paket ini melanjutkannya.

Rancang paket ini. Telusuri kodenya sungguhan lebih dulu.

PENTING: bagian "Pertanyaan yang harus dijawab spec-nya" pada paket C adalah keputusan KEBIJAKAN
AKUNTANSI, bukan detail implementasi. TANYAKAN semuanya kepada saya sebelum menulis rancangan.
Jangan menebak satu pun. Buku besar yang salah dengan percaya diri lebih buruk daripada tidak ada
buku besar.

Hasilkan dua berkas:

1. docs/superpowers/specs/2026-XX-XX-penilaian-kas-uka-design.md
2. docs/superpowers/plans/2026-XX-XX-penilaian-kas-uka.md

Ikuti bentuk spec dan rencana paket A. Setelah kedua berkas jadi, perbarui Status Pengerjaan pada
ROADMAP.

JANGAN menulis kode aplikasi pada sesi ini. Commit dokumentasinya saja, lalu berhenti dan laporkan.
```

### Paket E — Aset tetap dan penyusutan (sesi rancangan dulu)

Pakai **Prompt A** dengan `<PAKET>` = `E` dan `<NAMA-BERKAS>` = `aset-tetap-penyusutan`.
Tambahkan baris ini di akhir prompt:

```
Fakta SAK EP dan kelompok pajak DJP pada bagian "Fakta yang sudah diverifikasi" di ROADMAP sudah
diverifikasi dari naskah aslinya — pakai apa adanya, jangan diturunkan ulang atau dicari lagi.
```

### Paket F1 — Kas valuta asing dan revaluasi kurs — **SELESAI 7 September 2026**

Spec `specs/2026-09-05-kas-valas-revaluasi-kurs-design.md`, rencana
`plans/2026-09-05-kas-valas-revaluasi-kurs.md`. Seluruh sepuluh tugasnya sudah dikerjakan dan
diperagakan end-to-end pada basis data lokal.

### Paket F2 — Arus Kas dan CALK (12 tugas)

Sesi rancangannya selesai 7 September 2026; spec `specs/2026-09-07-arus-kas-dan-calk-design.md`
dan rencana `plans/2026-09-07-arus-kas-dan-calk.md` sudah ada. Pakai **Prompt B**, ganti `<N>`
dengan nomor tugas pertama yang belum tercentang di ROADMAP:

```
Baca docs/superpowers/plans/2026-09-07-arus-kas-dan-calk.md.
Kerjakan HANYA Tugas <N>, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

Empat tugas pertamanya membangun penulis pelunasan kewajiban — sisi kas yang selama ini dijanjikan
komentar `shared/journalMapping.ts:104` tetapi tidak pernah ditulis. Tanpa itu bagian operasi dan
investasi Arus Kas tidak punya sumber data.

### Paket G — Ekspor B0002/B0003/B0004 (9 tugas) — **SELESAI 7 September 2026**

Spec `specs/2026-09-07-ekspor-laporan-b-form-design.md`, rencana
`plans/2026-09-07-ekspor-laporan-b-form.md`. Seluruh sembilan tugasnya sudah dikerjakan dan
diperagakan end-to-end pada basis data lokal: ekspor tahun buku penuh dari buku besar, lembar
penelusuran pos ke akun, importir yang mengenali tata letak resmi, dan snapshot bersumber buku
besar yang tidak menggandakan dirinya.

### Paket H — Profil transaksi dan pemantauan berkala (9 tugas) — **SELESAI 8 September 2026**

Sesi rancangannya selesai 7 September 2026; spec `specs/2026-09-07-profil-transaksi-pemantauan-design.md`
dan rencana `plans/2026-09-07-profil-transaksi-pemantauan.md` sudah ada, beserta enam keputusan
kebijakan pengguna yang mengikat. Pakai **Prompt B**, ganti `<N>` dengan nomor tugas pertama yang
belum tercentang di ROADMAP:

```
Baca docs/superpowers/plans/2026-09-07-profil-transaksi-pemantauan.md.
Baca juga bagian "Keputusan pengguna yang mengikat" pada berkas itu — enam keputusan di sana
tidak boleh diturunkan ulang maupun ditawar.
Kerjakan HANYA Tugas <N>, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

### Paket I — Arsip dokumen perusahaan (7 tugas) — **SELESAI 9 September 2026**

Spec `specs/2026-09-08-arsip-dokumen-perusahaan-design.md`, rencana
`plans/2026-09-08-arsip-dokumen-perusahaan.md`, beserta tujuh keputusan kebijakan pengguna. Seluruh
tujuh tugasnya sudah dikerjakan dan diperagakan end-to-end: enam jenis dokumen pada enum tertutup,
riwayat versi penuh dengan versi lama tetap dapat dibuka, penghapusan yang sesungguhnya
penonaktifan beserta alasannya, dan worklist masa berlaku dengan peringatan 30 hari. Migrasi `0052`.

### Paket J — Individual Risk Assessment (16 tugas, dua rencana)

Sesi rancangannya selesai 9 September 2026 sesudah membaca template BI aslinya. Spec
`specs/2026-09-09-individual-risk-assessment-design.md`; dua rencana, **dikerjakan berurutan** —
J2 tidak punya sumber data tanpa J1.

**Empat hal yang mengikat dan tidak boleh diturunkan ulang:**

- **Skalanya terbalik: `5 = risiko Rendah`, `1 = risiko Tinggi`.**
- **Nilai KPMR adalah rata-rata sederhana kelima pilar**, bukan berbobot — begitulah rumus di
  berkasnya, dan itu disengaja diikuti.
- 24 dari 33 parameter **terhitung** dari basis data; 9 **dinyatakan** penilai. Tidak ada parameter
  yang skornya selalu nol karena sumbernya tidak ada.
- **IRA tidak pernah menulis ke `customers`**, sejalan dengan Paket H.

**J1 — Fondasi data risiko inheren** (7 tugas, migrasi `0053`). Ganti `<N>`:

```
Baca docs/superpowers/plans/2026-09-09-individual-risk-assessment-j1-fondasi-data.md.
Baca juga bagian "Keputusan pengguna yang mengikat" pada berkas itu — enam keputusan di sana
tidak boleh diturunkan ulang maupun ditawar.
Kerjakan HANYA Tugas <N>, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

**J2 — Penilaian, kuesioner, dan persetujuan** (9 tugas, migrasi `0054`). **Jangan dimulai sebelum
seluruh tugas J1 tercentang.** Ganti `<N>`:

```
Baca docs/superpowers/plans/2026-09-09-individual-risk-assessment-j2-penilaian.md.
Baca juga bagian "Keputusan pengguna yang mengikat" dan bagian "Angka yang mengikat — dari
template BI" pada berkas itu. Bobot, anchor predikat, dan matriks nilai akhir di sana sudah
dibaca langsung dari template BI milik pengguna — pakai apa adanya, jangan diturunkan ulang
dan jangan dicari lagi.
Kerjakan HANYA Tugas <N>, ikuti langkahnya berurutan.
Centang setiap langkah di berkas rencana setelah selesai,
lalu centang barisnya di bagian Status Pengerjaan.
Jangan mengerjakan tugas lain. Berhenti dan laporkan setelah commit.
```

### Paket K2 — Ganti nama PPPSM menjadi PPPSPM (sesi rancangan dulu)

Pakai **Prompt A** dengan `<PAKET>` = `K2` dan `<NAMA-BERKAS>` = `ganti-nama-pppspm`.
Tambahkan baris ini di akhir prompt:

```
Ini menyentuh dua kolom MySQL dan satu nilai enum yang SUDAH ADA ISINYA, jadi rencananya wajib
memuat langkah backup dan rollback tertulis meski hasil akhirnya hanya kosmetik.
```

### Paket K3 — Nota terhadap SE BI 18/41/DKSP

**Menunggu naskah SE BI 18/41/DKSP.** Jangan mulai sebelum naskah atau daftar field wajibnya
tersedia di proyek — aturan proyek melarang menebak skema regulator.

---

## Bila sesuatu tidak sesuai

- **Rujukan berkas:baris meleset** — percayai kodenya, bukan dokumennya, lalu perbarui barisnya
  sambil lewat.
- **Sebuah tugas membengkak melebihi berkas yang disebutkan** — berhenti dan laporkan sebelum
  melanjutkan. Jangan meneruskan diam-diam.
- **Sebuah keputusan kebijakan muncul di tengah eksekusi** — berhenti dan tanyakan. Kembalikan
  `skipped` beserta alasannya lebih baik daripada menebak.
- **Jumlah uji berubah** — sebutkan angka yang benar-benar dilihat, dan jelaskan mengapa berubah.
