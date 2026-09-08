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

## Sesi berikutnya — keadaan per 8 September 2026

Paket K1, B, D, C, E, F1, F2, **G**, dan **H sudah selesai** dan diperagakan end-to-end.
**Pekerjaan berikutnya adalah sesi rancangan Paket I** — bloknya di bawah.

Baseline uji yang benar-benar dijalankan 8 September 2026 sesudah Paket H:
`Test Files 132 passed (132)`, `Tests 1049 passed | 2 skipped (1051)`. `tsc --noEmit` bersih,
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

### Risiko residual Paket H yang masih terbuka

1. Mata uang tak terdeklarasi **tidak** dinilai di jalur kasir — hanya nilai dan frekuensi. Ia
   terlihat di worklist pemantauan.
2. Ambang penyimpangan berlaku atas akumulasi **sebulan**, sehingga sesudah seorang nasabah
   melewatinya, transaksi berikutnya pada bulan itu ikut masuk review sampai bulan berganti.
3. Keadaan **error** halaman Pemantauan Profil belum pernah dilihat di layar.
4. `pnpm audit --prod --audit-level=high` masih melaporkan **9 temuan** (6 sedang, 3 tinggi):
   residual `xlsx`/SheetJS ditambah `mysql2 <3.22.0`. **Jangan menyebut audit bersih.**

### Keadaan basis data lokal

`moneychanger` memuat data peragaan paket E, F1, F2, G, dan H. **Jangan membersihkannya.**
Data Paket H: dua nasabah (`CIF-000001` berdeklarasi Rp 25.000.000 / 4 / USD+SGD, `CIF-000002`
tanpa deklarasi), bon `FX-UJI-T4-*` dan `UJI-T8-0001`, serta satu baris `customer_profile_reviews`.
**Membuat data uji pada basis data lokal diizinkan pada tahap mana pun tanpa bertanya lebih dulu**
(ditetapkan pengguna 8 September 2026, tercatat di `CLAUDE.md`). Produksi tetap tidak boleh
disentuh — **migrasi `0051` belum diterapkan ke produksi.**

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

### Paket I — Arsip dokumen perusahaan (sesi rancangan dulu) — **PEKERJAAN BERIKUTNYA**

Blok lengkap di bawah, sudah termasuk isian Prompt A. Salin apa adanya.

```
Baca docs/superpowers/ROADMAP-SISA-PEKERJAAN.md bagian "Paket I", lalu baca juga bagian
"Aturan kerja yang berlaku untuk seluruh paket" pada dokumen yang sama.

Rancang paket ini. Telusuri kodenya sungguhan lebih dulu — sketsa di ROADMAP sengaja tidak cukup
untuk langsung menulis kode, dan rujukan berkas:baris di sana ditulis 4 September 2026 dan mungkin
sudah bergeser. Yang wajib dibaca sungguhan sebelum merancang: tabel operational_documents di
drizzle/schema.ts, seluruh penulis dan pembacanya (rute unggah REST, halaman Profil Perusahaan,
lampiran pengeluaran), serta batas keamanan impor yang sudah berlaku — ukuran 5 MB, validasi
MIME/base64/signature.

Jawab dulu setiap pertanyaan pada bagian "Pertanyaan yang harus dijawab spec-nya" bila ada.
Pertanyaan yang merupakan keputusan kebijakan (akuntansi, operasional, kepatuhan) TANYAKAN kepada
saya — jangan ditebak. Untuk paket ini, yang hampir pasti keputusan saya dan bukan turunan analisis:

- Jenis dokumen apa saja yang harus punya tempat (SOP, kebijakan internal, surat-menyurat BI,
  notulen rapat, korespondensi regulator, lainnya) — dan apakah daftarnya enum tertutup atau bebas.
- Apakah arsip menyimpan RIWAYAT VERSI (berkas lama tetap dapat dibuka) atau hanya versi berlaku.
  Ini menentukan bentuk tabelnya, jadi tanyakan sebelum menulis rencana.
- Siapa yang boleh mengunggah, mengganti versi, dan menghapus; dan apakah menghapus benar-benar
  menghapus atau hanya menonaktifkan.
- Apakah dokumen kedaluwarsa (tanggal berlaku terlampaui) perlu muncul sebagai tindakan yang
  menunggu, seperti worklist pemantauan profil pada Paket H.

Hormati batas yang sudah ada dan jangan menawarnya: batas 5 MB serta validasi
MIME/base64/signature impor tetap berlaku apa adanya; hanya berkas internal tepercaya yang boleh
diunggah; dan jangan menyimpan dokumen KYC nyata, workbook aktual, atau secret di source, fixture,
maupun commit.

Aturan CLAUDE.md "Fitur Harus Punya Sumber Data" berlaku penuh: bila rancanganmu menuntut kolom
atau status baru, penulisnya harus ikut dirancang dalam paket yang sama. Halaman arsip yang selalu
kosong bukan penyelesaian.

Hasilkan dua berkas:

1. docs/superpowers/specs/2026-09-08-arsip-dokumen-perusahaan-design.md
   Masalah, yang sudah diputuskan pengguna, rancangan, yang sengaja tidak dikerjakan, risiko
   residual. Ikuti bentuk docs/superpowers/specs/2026-09-07-profil-transaksi-pemantauan-design.md.

2. docs/superpowers/plans/2026-09-08-arsip-dokumen-perusahaan.md
   Rencana bertugas dengan bagian "Status Pengerjaan" di atas, bagian "Keputusan pengguna yang
   mengikat", tabel berkas, lalu tiap tugas berisi langkah bernomor dengan checkbox, potongan kode
   konkret, perintah verifikasi, dan perintah commit. Satu tugas = satu commit yang berdiri sendiri
   beserta ujinya sendiri. Ikuti bentuk
   docs/superpowers/plans/2026-09-07-profil-transaksi-pemantauan.md — termasuk bagian
   "Global Constraints" yang menyebut baseline uji, uji flaky yang diketahui, dan aturan migrasi.

Bila paket ini butuh migrasi, rencanakan tepat SATU tugas migrasi, dan tugas itu wajib memuat:
baca SQL hasil drizzle-kit generate sebelum menerapkan, tulis rencana rollback di berkas rencana
sebelum menerapkan, dan terapkan hanya lewat `node scripts/tenant.mjs migrate-all`. Jangan pernah
menjalankan .sql langsung, dan jangan menerapkan migrasi ke produksi.

Baseline uji yang benar-benar dijalankan 8 September 2026 sesudah Paket H:
Test Files 132 passed (132), Tests 1049 passed | 2 skipped (1051). Pakai angka ini pada
"Global Constraints" rencanamu; jangan mengarang angka lain.

JANGAN menulis kode aplikasi pada sesi ini. Commit dokumentasinya saja, lalu berhenti dan laporkan.
```

### Paket J — Individual Risk Assessment (sesi rancangan dulu)

Pakai **Prompt A** dengan `<PAKET>` = `J` dan `<NAMA-BERKAS>` = `individual-risk-assessment`.
Tambahkan baris ini di akhir prompt:

```
Bobot IRA, pilar KPMR, dan skala penilaiannya pada bagian "Fakta yang sudah diverifikasi" di
ROADMAP sudah dibaca langsung dari template BI milik saya — pakai apa adanya, jangan diturunkan
ulang. Rancang juga bagian mana dari sisi risiko inheren yang dapat dihitung otomatis dari data
yang sudah dimiliki aplikasi.
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
