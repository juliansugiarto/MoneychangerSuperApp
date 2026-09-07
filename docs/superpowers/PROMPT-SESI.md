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

## Sesi berikutnya — keadaan per 7 September 2026

Paket K1, B, D, C, E, F1, F2, dan **G sudah selesai** dan diperagakan end-to-end.

**Penghalang Paket G dicabut** pada sesi yang sama: pengguna menunjukkan ketiga form terisi sebagai
tangkapan layar, dan memutuskan penomoran record pada form tidak perlu dikejar — yang harus benar
adalah angkanya jatuh pada pos yang tepat. Struktur diambil dari tangkapan layarnya; nominalnya
tidak. Enam koreksi terhadap sesi rancangan tercatat pada spec bagian "Hasil verifikasi terhadap
form asli" dan pada dua commit terkait.

**Pekerjaan berikutnya adalah sesi rancangan Paket H.** Bloknya siap tempel di bawah.

Baseline uji yang benar-benar dijalankan 7 September 2026 sesudah Paket G:
`Test Files 124 passed (124)`, `Tests 973 passed | 2 skipped (975)`.

**Basis data lokal `moneychanger` kini juga memuat data peragaan Paket G:** satu baris
`company_profile` (Sandi Pelapor placeholder `000000000`) dan satu `financial_statement_snapshots`
bersumber `"Buku besar"` tahun buku 2026. Jangan membersihkannya.

---

## Prompt siap tempel — sesi rancangan Paket H

```
Kerjakan sesi rancangan Paket H — Profil transaksi dan pemantauan berkala. Baca dulu bagian
"Aturan kerja yang berlaku untuk seluruh paket" dan bagian "Paket H" pada
docs/superpowers/ROADMAP-SISA-PEKERJAAN.md, lalu Prompt A pada docs/superpowers/PROMPT-SESI.md.

Telusuri kodenya sungguhan lebih dulu. Rujukan berkas:baris di ROADMAP ditulis 4 September 2026 dan
sebagian sudah bergeser — percayai kodenya, lalu perbarui barisnya sambil lewat.

Keluarannya dua berkas, tidak menulis kode aplikasi:
  docs/superpowers/specs/2026-XX-XX-profil-transaksi-pemantauan-design.md
  docs/superpowers/plans/2026-XX-XX-profil-transaksi-pemantauan.md
Ikuti bentuk spec dan rencana Paket F2 (2026-09-07-arus-kas-dan-calk-*).

Pertanyaan kebijakan — ambang mana yang dianggap menyimpang dari profil, seberapa sering
pemantauan berkala dijalankan, siapa yang menindaklanjuti, dan apa yang terjadi pada nasabah yang
melewatinya — TANYAKAN kepada saya, jangan ditebak. Ini menyentuh kepatuhan APU-PPT, dan menebaknya
menghasilkan alat yang tampak bekerja sementara ambangnya karangan.

Batas yang sudah pasti dan tidak perlu ditanyakan: hasilnya alat bantu penyaringan; ia tidak pernah
mengubah data nasabah, tidak pernah memblokir transaksi, dan tidak pernah melapor sendiri ke
regulator — sama seperti pencocokan watchlist yang sudah ada.

Aturan proyek sejak 5 September 2026 (CLAUDE.md, "Fitur Harus Punya Sumber Data"): jangan merancang
tampilan atau baris laporan yang tidak ada penulis datanya. Bila paket ini menuntut kolom profil
yang belum pernah diisi siapa pun, penulisnya ikut masuk rencana — atau fiturnya tidak dibangun.
Paket F2 baru saja menemui persis kasus itu dan menyelesaikannya dengan membangun penulisnya;
lihat spec F2 bagian "Masalah 2" sebagai preseden.

Baseline uji yang benar-benar dijalankan 7 September 2026 sesudah Paket G:
Test Files 124 passed (124), Tests 973 passed | 2 skipped (975). Sebutkan angka yang
benar-benar dilihat.

Satu uji diketahui flaky dan bukan bagian paket ini: server/tenantIsolation.live.test.ts >
"setiap ikatan hanya melihat database miliknya sendiri". Ia satu-satunya uji yang menyentuh dua
basis data sungguhan dan memanggil getDb tanpa retryTransientDatabaseRead. Bila gagal sendirian di
bawah beban, jalankan ulang berkas itu saja; dugaan pembungkus retry adalah petunjuk, bukan
diagnosis.

Basis data lokal moneychanger berisi data uji paket E, F1, F2, dan G yang SENGAJA DIBIARKAN untuk
dipakai paket berikutnya — jangan membersihkannya dan jangan membuatnya ulang. Rinciannya ada pada
ROADMAP di bawah bagian Paket F2 dan G.

Verifikasi visual menuntut login — saya akan login sendiri bila diminta.
```

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

### Paket H — Profil transaksi dan pemantauan berkala (sesi rancangan dulu)

Pakai **Prompt A** dengan `<PAKET>` = `H` dan `<NAMA-BERKAS>` = `profil-transaksi-pemantauan`.

### Paket I — Arsip dokumen perusahaan (sesi rancangan dulu)

Pakai **Prompt A** dengan `<PAKET>` = `I` dan `<NAMA-BERKAS>` = `arsip-dokumen-perusahaan`.

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
