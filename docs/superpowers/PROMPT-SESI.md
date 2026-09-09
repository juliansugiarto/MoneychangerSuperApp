# Prompt Siap Tempel untuk Sesi Baru

Satu tugas per sesi. Salin blok yang sesuai apa adanya ke sesi Claude Code yang baru — blok-blok ini
sengaja tidak menuntut konteks percakapan sebelumnya.

Sejak 9 September 2026 sebuah hook `SessionStart` sudah menyuntikkan daftar tugas yang belum
tercentang pada awal tiap sesi, jadi blok di bawah tidak lagi perlu disalin dari sesi sebelumnya —
lihat `docs/superpowers/SETUP-PERKAKAS.md`. Untuk menutup sesi dan memperbarui berkas ini, pakai
skill `serah-terima`.

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

## Sesi berikutnya — keadaan per 9 September 2026 (sesudah Paket K3)

**Seluruh paket peta jalan asli sudah selesai:** K1, B, D, C, E, F1, F2, G, H, I, J (J1+J2), K2,
dan K3. Dua belas temuan pemeriksaan BI 2026 sudah tertutup.

**Pekerjaan berikutnya adalah Paket L**, yang lahir dari pembacaan **PBI No. 10 Tahun 2024** —
peraturan APU/PPT/PPPSPM yang berlaku dan yang belum pernah dibaca proyek ini sampai 9 September
2026. Rancangannya sudah ada; **belum ada kode yang ditulis.**

Baseline uji yang benar-benar dijalankan 9 September 2026 sesudah Paket K3:
`Test Files 153 passed (153)`, `Tests 1313 passed | 2 skipped (1315)`. `tsc --noEmit` bersih,
`vite build` sukses. Migrasi terakhir adalah **`0056`**; Paket L akan menambah `0057`.

**Satu uji diketahui flaky dan bukan bagian paket mana pun:** `server/tenantIsolation.live.test.ts`
> *"setiap ikatan hanya melihat database miliknya sendiri"*. Bila gagal sendirian di bawah beban,
jalankan ulang berkas itu saja.

### Yang tidak perlu ditemukan ulang

- **Jangan menulis helper jendela waktu yang keempat.** Batas hari, bulan, dan **tahun** operasional
  memakai `startOfOperationalDay`/`startOfOperationalMonth` pada `shared/regulatoryActionQueue.ts`.
  Batas tahun didapat dengan memanggil `startOfOperationalMonth` pada sebuah tanggal di bulan Januari
  tahun berikutnya — begitulah `getIraAssessmentDue` melakukannya, dan itu cukup.
- **Kolom `datetime` menyimpan jam UTC, kolom `date` tidak.** Membandingkan `transactionAt` terhadap
  instan absolut sudah benar apa adanya. Saat menulis fixture SQL untuk kolom `datetime`, tulis UTC.
- **Nilai kolom `date` dibaca dengan penggetah LOKAL, "hari ini" dengan zona operasional.** Pakai
  `archiveDateKey` untuk nilai kolom dan `operationalDateKey` untuk "hari ini". Jangan menyaring
  kolom `date` lewat SQL dengan `Date` tengah malam UTC.
- **Status bon yang dihitung sebagai aktivitas nasabah ada satu daftar:**
  `ACCUMULATED_TRANSACTION_STATUSES` pada `drizzle/schema.ts`. Jangan menyalinnya.
- **Borang penyuntingan nasabah wajib mengirimkan ketiga kolom deklarasi profil**; yang tidak
  dikirim akan dikosongkan. Sebaliknya, kolom kategori nasabah (`customerType`/`entityLegalForm`/
  `occupationCategory`) **dibiarkan** bila tidak dikirim — hanya `null` yang sengaja dikirim yang
  mengosongkan.
- **Gerbang peran pada rute dipisahkan menjadi fungsi `*Denial` yang dapat diuji.** Preseden
  terbaru: `iraEditDenial`/`iraApprovalDenial` (`server/iraAssessment.ts`), yang **menerima status
  dokumennya sebagai masukan** — penguncian adalah bagian dari otorisasi, dan penulisnya
  menegakkannya sekali lagi supaya pemanggil non-tRPC ikut terkena.
- **Basis data palsu pada uji wajib ikut menyaring `where` dan menerapkan `orderBy`.** Salin dari
  `server/iraDataForm.test.ts` atau `server/iraScenario.test.ts`, **bukan** dari
  `server/companyDocumentArchive.test.ts` — versi lama itu buta terhadap `inArray`. Dua jebakannya:
  `StringChunk` pemisah juga punya `value`, dan `inArray` menaruh nilainya sebagai **larik `Param`
  telanjang**, sehingga penelusurnya wajib ikut menuruni larik.
- **Basis data palsu yang menyimpan rujukan objek akan berbohong tentang kolom `json`.** MySQL
  menserialisasi `json` saat menulis; palsunya harus menyalin nilai yang ditulis
  (`structuredClone`), sebagaimana `server/iraScenario.test.ts`. Tanpa itu, snapshot yang dibekukan
  ikut berubah ketika baris sumbernya diubah — dan ujinya lulus untuk alasan yang salah.
- **Rute baru wajib didaftarkan pada `server/backOfficeNavigation.test.ts`** bila ia menjadi tujuan
  sidebar. Rute **berparameter** (mis. `/kepatuhan/ira/:id`) bukan tujuan sidebar dan tidak masuk
  peta itu.
- **Dialog wajib memakai `max-h-[85vh] overflow-y-auto`.**
- **Bercabanglah pada `isPending`, bukan `isLoading`.** Ditambah temuan 9 September 2026:
  `QueryClient` aplikasi ini memakai bawaan, dan percobaan ulangnya dapat berstatus
  `fetchStatus: "paused"` sehingga halaman **bertahan di keadaan memuat** alih-alih menampilkan
  galat. Untuk melihat cabang error di layar, tahan percobaan ulang sekali (`retry: 0`) lalu
  kembalikan.
- **Jangan menjalankan `prettier` pada berkas proyek ini.** Repo ini tidak berformat prettier
  (44 berkas `shared/` gagal `--check`, tanpa konfigurasi); `--write` justru membuat berkas baru
  berbeda gaya dari tetangganya.
- **Kosakata dan katalog IRA sudah lengkap dan jangan diturunkan ulang:** `shared/iraVocabulary.ts`,
  `shared/iraParameters.ts`, `shared/iraParameterCatalogue.ts` (bobot, enam jenis pita, teks
  kriteria), `shared/iraKpmrCatalogue.ts` (31 pertanyaan, keberlakuan KUPVA BB, kaitan temuan),
  `shared/individualRiskAssessment.ts` dan `shared/iraAssessmentTotals.ts` (seluruh aritmetikanya).
- **Berkas dokumen dan berkas impor punya dua batas yang BERBEDA.** Dokumen
  (`server/documentOperations.ts`): **8 MB**, MIME saja. Impor XLS/XLSX: **5 MB** plus
  `assertSpreadsheetSignature`. Jangan mencampurnya.

### Risiko residual Paket J2 yang masih terbuka

Sembilan butir, tertulis lengkap di akhir
`plans/2026-09-09-individual-risk-assessment-j2-penilaian.md`. Ringkasnya: bobot pilar KPMR tidak
dipakai rumusnya; Aspek Kelembagaan tidak dibangun; seluruh klasifikasi risiko bergantung manusia
dan kode tanpa baris dibaca RENDAH; dimensi `COUNTRY` tanpa daftar FATF/PBB; `PPSPM_3C` tidak dapat
membedakan UMKM; `TPPU_4A` dan `TPPU_4B` selalu sama karena hanya ada satu provinsi gerai;
`pnpm audit --prod --audit-level=high` masih **9 temuan** (6 sedang, 3 tinggi) — **jangan menyebut
audit bersih**; migrasi **`0034`–`0055` belum diterapkan ke produksi** — jurnal produksi berisi 34
baris (`0000`–`0033`) sementara `drizzle/` berisi 56 berkas, jadi yang tertunda **dua puluh dua** —
**dua puluh tiga** sesudah Paket K2 menambahkan `0056` — bukan lima seperti tercatat di sini
sampai 9 September 2026; dan zona waktu server masih
memakai bawaan `Asia/Jakarta`, bukan `company_profile.timezone`.

### Risiko residual paket sebelumnya yang masih terbuka

- **Paket I:** unggah berkas dan tombol "Buka" belum pernah dijalankan sungguhan (`.env` lokal tanpa
  kredensial R2); `deleteCompanyDocument` lama masih `DELETE` sungguhan tanpa audit; jalur unggah
  dokumen tidak memeriksa signature; sertifikat izin pada Profil Perusahaan tanpa peringatan masa
  berlaku; `employee_certifications.documentId` dan `employee_pic_assignments.documentId` tetap
  selalu kosong.
- **Paket H:** mata uang tak terdeklarasi tidak dinilai di jalur kasir; ambang penyimpangan berlaku
  atas akumulasi sebulan; keadaan error halaman Pemantauan Profil belum pernah dilihat di layar.
- **Paket J1:** borang bon belum pernah disimpan sungguhan lewat browser dengan jalur distribusi
  terpilih.

### Keadaan basis data lokal

`moneychanger` memuat data peragaan paket E, F1, F2, G, H, I, J1, dan J2. **Jangan
membersihkannya.**

Data Paket J2 (9 September 2026), **jangan dibersihkan**:

- `ira_assessments` — tiga penilaian: **#1** periode 1 Jan – 31 Des 2026 berstatus **DISETUJUI** dan
  terkunci (inheren 4,3160 · Rendah ke Menengah; KPMR 4,0000 · Satisfactory; akhir 4), **#2**
  periode 2025 berstatus DRAFT (memperagakan keterlambatan tahunan pada Status Kesiapan), dan **#3**
  penilaian pengganti #1 berstatus DRAFT.
- `ira_inherent_values` — 33 baris untuk penilaian #1; `ira_kpmr_answers` — 31 baris, satu di
  antaranya N/A.
- `ira_risk_classifications` masih tujuh baris dari J1; belum ada satu pun baris berdimensi
  `DISTRIBUTION_CHANNEL`, sehingga keempat parameter Jalur Distribusi terbaca RENDAH.

**Membuat data uji pada basis data lokal diizinkan pada tahap mana pun tanpa bertanya lebih dulu.**
Produksi tetap tidak boleh disentuh.

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

### Paket J — Individual Risk Assessment (16 tugas, dua rencana) — **SELESAI 9 September 2026**

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

**J1 — Fondasi data risiko inheren** (7 tugas, migrasi `0053`) — **SELESAI 9 September 2026.**
Kosakata, migrasi, penulis klasifikasi, kategori nasabah, jalur distribusi bon, pembaca agregat
Form C1, dan halaman `/kepatuhan/klasifikasi-risiko` seluruhnya hidup dan diperagakan end-to-end.

**J2 — Penilaian, kuesioner, dan persetujuan** (9 tugas, migrasi `0054` dan `0055`) — **SELESAI
9 September 2026.** Aritmetika murni, katalog 33 parameter dan 31 pertanyaan, empat tabel
penilaian, penghitung sisi inheren, penulis beserta pembekuan snapshot, halaman penilaian,
kuesioner KPMR dengan matriks bergambar, dan skenario menyeluruh — seluruhnya diperagakan
end-to-end pada basis data lokal sampai penilaian disetujui, terkunci, dan digantikan.
Risiko residualnya tertulis lengkap di akhir `plans/2026-09-09-individual-risk-assessment-j2-penilaian.md`.

Blok prompt di bawah ini disimpan untuk rujukan; seluruh tugasnya sudah tercentang:

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

### Paket K2 — Ganti nama PPPSM menjadi `DPPSPM` (4 tugas) — **SELESAI 9 September 2026**

Spec `specs/2026-09-09-ganti-nama-dppspm-design.md`, rencana `plans/2026-09-09-ganti-nama-dppspm.md`
(keempat tugas tercentang, memuat prosedur rollback `0056` yang belum pernah dijalankan).

Yang perlu diketahui sesi berikutnya, **jangan diturunkan ulang**:

- **Empat ejaan hidup berdampingan dan tiga di antaranya BENAR.** `PPSPM` menamai tindak pidananya
  (kode parameter IRA `PPSPM_1A`…`PPSPM_4A` dan `iraRiskTypes` adalah **kunci basis data** pada
  `ira_inherent_values`), `PPPSPM` menamai program pencegahannya, `DPPSPM` menamai daftarnya.
  **Jangan pernah menjalankan cari-ganti naif atas `PPSPM`** — ia substring dari dua lainnya.
  Penjaganya `server/sanctionsListNaming.test.ts`.
- **`DPPSPM` dikonfirmasi PBI No. 10 Tahun 2024 Pasal 1 angka 8**, yang mendefinisikan singkatan itu
  secara harfiah dan memasangkannya dengan `DTTOT` (17 kemunculan masing-masing; `PPPSM` nol).
  Naskahnya ada pada berkas pengguna `PBI_102024.pdf`, belum masuk proyek. Peraturan ini juga
  ketentuan APU/PPT/PPPSPM yang **berlaku sekarang** dan menyebut KUPVA — layak dibaca utuh bila
  ada paket kepatuhan berikutnya.
- **Dua kemunculan `PPPSM` sengaja tetap ada:** kutipan templat BI pada
  `shared/iraKpmrCatalogue.ts:291` dan berkas penjaganya sendiri. Riwayat migrasi
  (`drizzle/0033*.sql`, `drizzle/meta/*.json`) juga tidak pernah disunting.
- **Kolom `customers.dttotPpsdmMatch`/`dttotPpsdmNotes` tetap salah eja, sengaja.** Nol baris
  memakainya. Komentar penambatnya ada di `drizzle/schema.ts`.
- **Redefinisi enum satu langkah hasil `drizzle-kit` tidak dapat dipakai.** Di bawah
  `STRICT_TRANS_TABLES` — dipakai lokal maupun produksi — ia gagal dengan `ERROR 1265`; tanpa mode
  ketat ia menyunting baris menjadi `''` secara senyap. Pola yang benar: melebarkan enum →
  `UPDATE` → menyempitkan, ditulis tangan dengan `--> statement-breakpoint`. **Pakai ulang pola ini
  untuk setiap penggantian nilai enum berikutnya.**
- **`mysqldump` di mesin ini menghasilkan berkas yang menolak dipulihkan** (`ERROR 3546`) kecuali
  dipanggil dengan `--single-transaction --set-gtid-purged=OFF`. Buktikan pemulihannya sebelum
  mengandalkan cadangan apa pun.
- **Urutan halaman Cek Watchlist berubah:** `DPPSPM` jatuh sebelum `DTTOT` secara alfabetis,
  sehingga daftar proliferasi kini tampil lebih dahulu. Dikunci uji beserta alasannya.
- **Basis data lokal kini berisi 17 baris peragaan** per basis data, dibuat
  `scripts/seedWatchlistDemo.mjs` (idempoten, menolak host/basis data non-lokal). **Jangan
  dibersihkan.**

### Paket K3 — Nota terhadap SE BI **18/42**/DKSP — **SELESAI 9 September 2026**

Spec `specs/2026-09-09-nota-terhadap-se-bi-1842-design.md`.

**Dasar hukumnya bukan 18/41.** Naskah 18/41 dibaca dan ternyata mengatur *Penyelenggaraan
Pemrosesan Transaksi Pembayaran* — nol kemunculan `KUPVA`. Yang mengatur nota adalah **SE BI
18/42/DKSP huruf G angka 1**, tujuh field wajib, di bawah bagian **perlindungan konsumen**. Surat
temuan BI sendiri menulis 18/41; itu kemungkinan salah ketik di surat temuannya, dan **jangan
diperbaiki tanpa bertanya.**

Lima dari tujuh sudah terpenuhi sebelumnya. Yang kurang huruf d dan e — arah pembayaran hanya
tersirat dari kode `BNB`/`BNS`. Kini dicetak harfiah. Penjaga `server/notaSeBi1842.test.ts`.

**Risiko residual:** tanggal nota masih diformat `toLocaleDateString` dengan zona waktu **peramban**,
padahal tanggal adalah field wajib huruf b dan proyek ini sudah punya zona operasionalnya sendiri.

---

### Paket L — Jejak penyaringan nasabah dan persetujuan risiko tinggi (6 tugas) — **PEKERJAAN BERIKUTNYA**

**Rancangan selesai 9 September 2026, kode belum ditulis sama sekali.**
Spec `specs/2026-09-09-penyaringan-nasabah-dan-persetujuan-risiko-tinggi-design.md`,
rencana `plans/2026-09-09-penyaringan-nasabah-dan-persetujuan-risiko-tinggi.md`.

Menutup Temuan 1 dan 2 pada `specs/2026-09-09-pbi-10-2024-temuan-awal.md`.

**Yang harus diketahui sebelum menyentuhnya:**

- **Paket ini menambahkan tindakan MEMBLOKIR untuk pertama kalinya.** Nasabah `riskLevel = HIGH`
  yang belum disetujui SHAREHOLDER tidak dapat dipakai pada bon baru. Seluruh aplikasi lain sengaja
  hanya mencatat dan memperingatkan; `director_acknowledgements` bahkan menyatakan dirinya *tidak
  boleh* memblokir. **Ini keputusan sadar pengguna, bukan kekeliruan — jangan "diperbaiki".**
- **Aman diterapkan:** produksi memuat satu nasabah berstatus `LOW` (diperiksa baca-saja
  9 September 2026), jadi tidak ada yang terblokir pada hari penerapannya.
- **`dttotPpsdmMatch` tidak pernah diisi otomatis**, meski penyaringannya kini otomatis. Mesin
  mencatat kemungkinan; manusia memutuskan. Ada ujinya sendiri.
- **Baris penyaringan ditulis MESKI nihil.** Baris nihil itulah buktinya. "Simpan hanya bila ada
  temuan" adalah optimasi yang justru menghapus yang dicari pemeriksa.
- **Tenggat pelaporan Pasal 60 DI LUAR LINGKUP** atas keputusan pengguna 9 September 2026 —
  negosiasi dengan BI sudah selesai. Jangan membangun antrean tenggat, dan jangan membangun kalender
  hari kerja untuk itu.

```
Baca docs/superpowers/plans/2026-09-09-penyaringan-nasabah-dan-persetujuan-risiko-tinggi.md
beserta spec yang dirujuknya, lalu bagian "Aturan kerja yang berlaku untuk seluruh paket" pada
docs/superpowers/ROADMAP-SISA-PEKERJAAN.md.

Kerjakan Tugas <N> saja, satu commit yang berdiri sendiri beserta ujinya. Patuhi "Global
Constraints" pada rencana itu — terutama: migrasi hanya ke dua basis data lokal dan tidak pernah
ke produksi; otorisasi ditegakkan di penulis, bukan hanya router; dttotPpsdmMatch tidak pernah
diisi otomatis; dan baris penyaringan ditulis meski nihil.

Jangan menurunkan ulang tiga keputusan pengguna yang tertulis di rencana itu. Bila menemukan
keadaan yang berbeda dari yang tertulis, percayai kodenya, katakan apa yang berbeda, lalu
perbarui dokumennya sambil lewat.
```

---

### Pekerjaan yang sudah teridentifikasi tetapi belum dirancang

Urut sesuai usul pada `specs/2026-09-09-pbi-10-2024-temuan-awal.md`:

1. **Temuan 4 — `deleteCompanyDocument` masih `DELETE` sungguhan tanpa audit**, sementara Pasal 48
   PBI 10/2024 menuntut penatausahaan paling singkat **5 tahun**. Sudah tercatat sebagai risiko
   residual Paket I; derajatnya naik dari kerapian menjadi kewajiban.
2. **Temuan 3 — pemblokiran serta merta dan pencatatan percobaan transaksi** (Pasal 47 ayat 1
   huruf d). **Menunggu keputusan pengguna**, dan menuntut penulis data yang belum ada sama sekali.
3. **Temuan 7 — penginian berkala klasifikasi risiko** (Pasal 9 ayat 6) — menaikkan risiko residual
   Paket J2 nomor 3 menjadi kewajiban.
4. **Tanggal nota memakai zona waktu peramban** (risiko residual Paket K3).
5. **Penjelasan pasal demi pasal PBI 10/2024 belum dibaca** untuk Pasal 9, 32, 47, dan 48.
   Penjelasan sering menyempitkan bunyi pasalnya; **baca sebelum temuan mana pun menjadi rencana.**
6. **BAB VI dan BAB IX–XI PBI 10/2024 belum dibaca terhadap kode.**

**Antrean migrasi produksi kini 23** (`0034`–`0056`). Menerapkannya pekerjaan tersendiri yang belum
direncanakan, dan tidak boleh dimulai tanpa permintaan eksplisit.

---

## Bila sesuatu tidak sesuai

- **Rujukan berkas:baris meleset** — percayai kodenya, bukan dokumennya, lalu perbarui barisnya
  sambil lewat.
- **Sebuah tugas membengkak melebihi berkas yang disebutkan** — berhenti dan laporkan sebelum
  melanjutkan. Jangan meneruskan diam-diam.
- **Sebuah keputusan kebijakan muncul di tengah eksekusi** — berhenti dan tanyakan. Kembalikan
  `skipped` beserta alasannya lebih baik daripada menebak.
- **Jumlah uji berubah** — sebutkan angka yang benar-benar dilihat, dan jelaskan mengapa berubah.
