# Program Desain Ulang Antarmuka — produk mandiri, bahasa manusia, fondasi desain

Tanggal 12 September 2026. Kelima bagian rancangan disetujui pengguna satu per satu pada sesi
rancangan; berkas ini menunggu tinjauan pengguna sebelum rencana bertugas sub-proyek 1 ditulis.

Program ini menggantikan **seluruh antarmuka** aplikasi. Backend, skema, dan aturan bisnis yang sudah
teruji **tetap**; yang berubah adalah layar, cara penyampaian, dan alur — ditambah kode server kecil
yang memang dituntut alur baru (wizard penyiapan, kode pemulihan, penjelasan AI).

## Masalah

### 1. Tampilan boros ruang dan tidak konsisten

Diukur 12 September 2026 pada kode, bukan dikira:

- **410 nilai warna heks berbeda** tertulis langsung di `client/src/pages` dan `client/src/components`.
  Token tema shadcn (`--primary`, `--card`, `--sidebar`, …) ada di `client/src/index.css`, tetapi
  sebagian besar halaman melewatinya. Kepadatan maupun warna aksen perusahaan tidak dapat diubah dari
  satu tempat.
- Kepala halaman **86px**, sidebar dengan kartu bantuan, padding kartu berulang (`p-4`/`p-5`,
  `rounded-2xl`) dan kartu bertumpuk di dalam kartu. Pada MacBook Air 13" (lebar efektif 1280–1440px)
  sebagian besar layar habis untuk bingkai, bukan isi.
- Kelas sisa situs publik lama (`public-*`, `ink-panel`, `glass-panel`, `landing-orb`) bercampur dengan
  kelas aplikasi.
- 42 halaman (±10.900 baris), 45 rute, delapan kelompok navigasi yang disusun per departemen.

### 2. Masuk dan penyiapan belum layak dijual sebagai aplikasi mandiri

- `ensureInitialShareholder` (`server/internalAuth.ts`) dijalankan **pada setiap start** dan membuat
  Pemegang Saham dari `INITIAL_SHAREHOLDER_USERNAME`/`_PASSWORD` di `.env` — kata sandi tersimpan
  sebagai teks di server, dan pembeli tidak punya alur penyiapan.
- Sisa OAuth Manus masih ada: `startLogin` pada `client/src/const.ts`, `getUserByOpenId` dan
  penanganan `OWNER_OPEN_ID` pada `server/db.ts`, `VITE_APP_ID` pada `server/_core/env.ts`.
- **Tidak ada pembatasan percobaan masuk** — `auth.login` (`server/routers.ts`) hanya memeriksa kata
  sandi. Tidak ada jalur pemulihan bagi pemilik yang lupa kata sandinya.
- `client/src/pages/Home.tsx` menulis mati nama, telepon, alamat Cianjur, FAQ, dan peringatan penipuan
  milik Ibukota Valasindo. Setiap pembeli akan mewarisi kontak perusahaan lain.

### 3. Klasifikasi Risiko dan IRA berbicara dalam bahasa formulir BI

Empat halaman (`KlasifikasiRisiko`, `PenilaianRisiko`, `PenilaianRisikoDetail`,
`PenilaianRisikoKpmr`, ±1.380 baris) memakai kosakata regulator sebagai judul: *"Form A1 — nilai
parameter risiko inheren"*, *"Kuesioner KPMR"*, *"pita"*, *"rujukan SRA"*. Pengguna harus sudah
memahami regulasinya untuk memakai layar yang semestinya membantunya memahami regulasi itu. Keluhan
pengguna 12 September 2026: *lebih membingungkan daripada formulir BI-nya sendiri.*

### 4. Hampir tidak ada uji di sisi klien

Satu-satunya perkakas uji adalah Vitest. Seluruh klien memiliki **satu** berkas uji
(`client/src/lib/money.test.ts`). Tidak ada Testing Library, jsdom, maupun Playwright; setiap
verifikasi visual selama ini dilakukan manual di peramban.

## Yang sudah diputuskan pengguna

Diambil 12 September 2026 pada sesi rancangan. **Jangan ditanyakan ulang.**

1. **Produk mandiri lebih dulu.** Dijual dan dipasang per perusahaan; setiap orang masuk secara lokal.
   Masuk lewat SOLVINC ditambahkan kelak sebagai **cara masuk tambahan**, bukan prasyarat.
2. **Halaman depan = halaman kurs publik yang dapat dikonfigurasi.** Seluruh nama, telepon, alamat, dan
   logo diambil dari Profil Perusahaan; pemilik dapat mematikannya. Login staf adalah halaman terpisah
   yang bersih.
3. **Pengguna harian:** kasir dan admin di laptop/monitor kecil 13–15", pemilik/controller di MacBook.
   Dirancang untuk **1280–1440px lebih dulu**, padat tetapi terbaca, ramah papan ketik. Ponsel hanya
   untuk melihat.
4. **Bahasa:** Indonesia sehari-hari dengan "Anda", judul berbentuk pertanyaan atau tugas; istilah
   resmi BI/PPATK tetap tampil sebagai **label abu-abu kecil** di bawah kalimat biasa. Ekspor tetap
   memakai kata-kata resmi.
5. **Pemulihan akun pemilik:** **kode pemulihan sekali pakai** yang ditampilkan saat penyiapan. Tanpa
   server email. Kata sandi staf tetap direset pemilik di dalam aplikasi.
6. **Merek:** desain produk yang **netral** (abu-abu tenang, satu aksen kuat, warna status yang jelas)
   ditambah **logo, nama, dan satu warna aksen per perusahaan** dari Profil Perusahaan.
   **Diganti 13 September 2026** oleh `2026-09-13-tema-konter-tebal-dan-papan-kurs-design.md`: gaya
   Konter Tebal dengan enam palet siap pakai dan warna utama sendiri yang lolos penjaga kontras.
7. **Penyampaian:** **modul demi modul di tempat** (pendekatan A). Rilis pertama: sistem desain + shell
   aplikasi (sub-proyek 1), lalu login + wizard penyiapan (sub-proyek 2). Sesudah itu satu modul utuh
   per sesi pada URL yang sama; modul yang belum dibangun ulang tetap tampil dengan layar lamanya di
   dalam shell baru untuk sementara.
8. **Urutan sub-proyek** pada bagian Rancangan §1 disetujui apa adanya.
9. **Penjelasan AI pada hasil IRA** ("Mengapa risiko saya Menengah?"), memakai **kunci API Anthropic
   milik pembeli sendiri**, **mati secara bawaan**. Tanpa kunci, tombolnya tidak ada.
10. **Playwright dipasang sejak sub-proyek 1** sebagai rangkaian uji tangkapan layar.

## Rancangan

### 1. Struktur program

| # | Sub-proyek | Isi | Bergantung pada |
|---|---|---|---|
| **1** | **Fondasi desain** | Panduan suara & bahasa; skala kepadatan; tipografi, token warna, aksen perusahaan; shell baru; enam pola halaman; galeri pola; Playwright | — |
| **1B** | **Papan kurs** *(ditambahkan 13 September 2026)* | Papan kurs seluruh valuta, kurs per kelompok pecahan, aktivasi atomik, toleransi harga bon — lihat `2026-09-13-tema-konter-tebal-dan-papan-kurs-design.md` Bagian B | 1 |
| **2** | **Login, penyiapan awal, halaman publik** | Wizard penyiapan, kode pemulihan, pembatasan percobaan masuk, halaman login, ganti/pulihkan kata sandi, pengguna & peran, halaman kurs publik yang dapat dikonfigurasi; buang bootstrap `.env` dan sisa OAuth | 1 |
| **3** | **Penilaian risiko berbahasa manusia** | Klasifikasi Risiko dan IRA sebagai alur terpandu; penjelasan AI | 1 |
| **4** | **Kasir & transaksi** | Alur konter: bon baru, kedua kaki transaksi dengan rincian pecahan wajib, daftar transaksi | 1 |
| **5** | **Kas & stok** | Kas awal, saldo, hitung fisik, penyesuaian brankas *(kurs pindah ke 1B, 13 September 2026)* | 1, 4 |
| **6** | **Nasabah** | Pendaftaran, profil, riwayat penyaringan, pemantauan profil | 1 |
| **7** | **Laporan & keuangan** | Buku besar, laporan keuangan, aset tetap, laporan transaksi | 1 |
| **8** | **Kepatuhan & arsip** | Laporan regulator, arsip, penatausahaan dokumen, pengawasan direksi, kesiapan, kepegawaian | 1, 3 |
| **9** | **Harian & pengaturan** | Buka/tutup outlet, meja konfirmasi, keluhan, pengeluaran, profil perusahaan, simulasi | 1, 2 |

- Urutan pengerjaan: **1 → 1B → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9** (1B ditambahkan 13 September 2026). Konter (4) didahulukan di antara modul
  karena paling sering dipakai.
- **Setiap sub-proyek punya spec → rencana → implementasi sendiri**, ditulis pada awal sesinya. Berkas
  ini hanya merinci sub-proyek 1 sampai level yang cukup untuk rencana bertugas; sub-proyek 2 dan 3
  dirinci sampai level keputusan, sisanya hanya cakupan.
- **Yang tidak berubah di sub-proyek mana pun:** rincian pecahan wajib pada setiap pergerakan kas fisik;
  kedua kaki transaksi valuta; `audit_logs`; otorisasi ditegakkan di server; kurs diaktifkan manual
  dengan alasan; perhitungan IRA dan ekspor BI.

### 2. Sub-proyek 1 — Fondasi desain

#### 2.1 Token sebagai satu-satunya sumber keputusan visual

> **Diperbarui 13 September 2026:** aksen tunggal diganti enam palet Konter Tebal — lihat
> `2026-09-13-tema-konter-tebal-dan-papan-kurs-design.md` Bagian A1–A2.

- Token semantik pada `client/src/index.css`: permukaan (`surface`, `surface-raised`, `surface-sunken`),
  teks (`text`, `text-muted`, `text-subtle`), garis (`border`, `border-strong`), **aksen**
  (`accent`, `accent-contrast`), status (`success`, `warning`, `danger`, `info`, masing-masing dengan
  pasangan latar lembutnya), dan kepadatan (`space-*`, `radius-*`, `control-h-*`, `row-h-*`). Token
  shadcn yang sudah ada dipetakan ke token ini, bukan dihapus, supaya komponen `components/ui` tetap
  bekerja.
- **Aksen perusahaan** adalah satu token yang diisi saat aplikasi dimuat dari Profil Perusahaan (kolom
  `accentColor` ditambahkan pada sub-proyek 2; sub-proyek 1 memakai aksen produk). Aksen hanya dipakai
  untuk tindakan utama, butir menu aktif, dan elemen merek — **tidak pernah** untuk warna status.
- **Penjaga kontras:** fungsi murni `shared/accentColor.ts` menghitung rasio kontras WCAG antara aksen
  dan teks di atasnya. Di bawah AA (4,5:1) aplikasi memakai aksen produk dan mencatat peringatan di
  layar Profil Perusahaan.
- **Larangan heks mentah** hanya berlaku bagi berkas yang sudah dibangun ulang di atas fondasi ini.
  Daftar berkas yang dijaga tumbuh modul demi modul (lihat §6.2), supaya layar lama tidak memblokir.

#### 2.2 Skala kepadatan untuk 1280–1440px

| Elemen | Hari ini | Fondasi |
|---|---|---|
| Teks isi | 14–16px bercampur | **14px**; label 12px; judul halaman 20px |
| Baris tabel | ±52–56px | **36px** (padat 32px untuk tabel besar) |
| Tombol & input | 40–44px | **32–36px** |
| Kepala halaman | 86px | **48px** |
| Gutter halaman | 24–40px | **16–20px** |
| Padding kartu | 16–24px, bertumpuk | **16px**, kartu hanya bila pengelompokan membantu |
| Sidebar | lebar tetap + kartu bantuan | **232px**, dapat diciutkan ke ikon |

- Kisi spasi 4px. Daftar dan tabel diletakkan di halaman, **tidak** di dalam kartu bertumpuk.
- Harus utuh di **1280×800** (MacBook Air 13"), **1440×900**, dan **1920×1080**; pada lebar ponsel,
  layar hanya-lihat tidak boleh terpotong, tetapi alur konter tidak dirancang untuk ponsel.

#### 2.3 Tipografi

> **Diperbarui 13 September 2026:** Bricolage Grotesque untuk judul dan angka besar, Manrope untuk isi —
> lihat `2026-09-13-tema-konter-tebal-dan-papan-kurs-design.md` Bagian A3.

Satu keluarga sans untuk UI dengan dua ketebalan, ditambah angka tabular untuk uang
(`font-variant-numeric: tabular-nums`). Manrope tetap kecuali perbandingan visual pada sesi fondasi
menunjukkan keluarga yang lebih rapat lebih terbaca pada 14px; keputusan itu diambil dengan tangkapan
layar berdampingan, bukan selera.

#### 2.4 Shell aplikasi

- **Bilah atas 48px:** judul halaman dan jejak (breadcrumb), slot pengalih perusahaan (kosong sampai
  multi-perusahaan ada), tombol pencarian, menu pengguna.
- **Sidebar dikelompokkan per tugas:** *Hari ini · Transaksi · Uang & Kurs · Nasabah · Risiko ·
  Laporan · Kepatuhan · Pengaturan.* Pemetaan 45 rute lama ke kelompok baru ditulis di rencana
  sub-proyek 1; `shared/backOfficeNavigation.ts` tetap satu-satunya sumber menu dan
  `server/backOfficeNavigation.test.ts` tetap menjaganya.
- **Palet perintah ⌘K / Ctrl+K:** membuka halaman mana pun yang diizinkan peran pengguna. Tidak ada
  prosedur pencarian baru di sub-proyek 1.
  **Pencarian rekaman (nomor bon, CIF/nama nasabah) ditunda ke sub-proyek 4 dan 6** — diperiksa
  12 September 2026: `CustomerList.tsx` dan `TransactionList.tsx` tidak membaca parameter URL apa pun,
  sehingga hasil pencarian dari palet tidak dapat membuka rekamannya. Kedua daftar itu dibangun ulang
  di sub-proyek 4 dan 6, dan saat itulah palet mendapat hasil rekaman yang benar-benar dapat dibuka.
- **Pintasan konter:** `N` bon baru, `/` cari, `Esc` batal. Tidak aktif ketika fokus ada di input.
- **Merek pada shell** (logo dan nama) diambil dari Profil Perusahaan, bukan "IV / Ibukota Valasindo"
  yang ditulis mati.
- **Layar lama di dalam shell baru:** seluruh halaman yang belum dibangun ulang tetap dirender tanpa
  diubah di dalam area isi shell baru. Tidak ada halaman yang hilang atau berpindah URL.

#### 2.5 Enam pola halaman

Setiap modul berikutnya **disusun dari pola ini**, tidak menciptakan tata letak per halaman:

1. **Daftar + panel detail** — tabel padat dengan filter di atas; memilih baris membuka detail di panel
   samping tanpa meninggalkan daftar.
2. **Formulir** — satu kolom, bagian bernomor, tombol aksi menempel di bawah, validasi di samping kolom.
3. **Alur bertahap** — langkah bernomor dengan kemajuan; setiap langkah dapat disimpan sebagai draf.
4. **Laporan** — filter, angka ringkas, tabel, ekspor.
5. **Dasbor** — ubin angka dengan tautan ke daftar yang membentuk angka itu.
6. **Keadaan** — memuat, kosong, galat. Setiap keadaan kosong dan galat menyebut **langkah berikutnya**
   dalam kalimat biasa, bukan hanya "Tidak ada data".

Komponen polanya tinggal di `client/src/components/patterns/`, di atas `components/ui` yang sudah ada.

#### 2.6 Panduan suara dan bahasa

Berkas `docs/PANDUAN-SUARA-DAN-BAHASA.md`, ditegakkan pada tinjauan setiap sub-proyek:

- Indonesia sehari-hari dengan "Anda"; satu gagasan per kalimat.
- Judul berbentuk pertanyaan atau tugas ("Seberapa sering nasabah Anda bertransaksi tunai besar?",
  "Catat kas awal hari ini"), bukan nama formulir.
- Istilah resmi BI/PPATK tampil sebagai label abu-abu kecil di bawah kalimat biasa
  ("Form A1 · TPPU 2A"). Ekspor dan cetakan memakai istilah resmi.
- Uang dalam format Rupiah dengan angka tabular; tanggal dalam zona operasional perusahaan.
- Pesan galat menyebut **apa yang terjadi, mengapa, dan apa yang harus dilakukan**.
- Tindakan destruktif selalu lewat dialog yang menyebut nama benda yang akan terkena.
- Contoh sebelum/sesudah untuk sepuluh kalimat nyata dari aplikasi hari ini dimuat di panduan itu.

#### 2.7 Galeri pola

Rute `/operasional/pola` (CONTROLLER ke atas, tidak masuk sidebar) menampilkan setiap token, setiap
pola, dan setiap keadaan dengan data contoh statis. Galeri inilah yang dipotret Playwright sebagai
baseline fondasi.

#### 2.8 Yang diserahkan sub-proyek 1

Token dan penjaga kontras; shell baru dengan seluruh halaman lama tetap berfungsi di dalamnya; palet
perintah dan pintasan; enam komponen pola; galeri pola; panduan suara dan bahasa; Playwright dengan
basis data visualnya (§6.3). **Tidak ada layar modul yang dibangun ulang di sub-proyek 1.**

### 3. Sub-proyek 2 — Login, penyiapan awal, halaman publik

#### 3.1 "Sudah disiapkan" adalah satu fakta tersimpan

- Kolom baru **`company_profile.setupCompletedAt`** (`company_profile` memang satu baris;
  `operational_settings` tidak cocok karena berkolom ambang bertipe tetap, bukan kunci-nilai).
- Selama kolomnya kosong, setiap URL staf menampilkan wizard **"Siapkan perusahaan Anda"**:
  1. Akun pemilik — nama, username, kata sandi (kebijakan kata sandi yang sudah ada).
  2. Perusahaan — nama badan hukum, nama dagang, nomor izin.
  3. **Delapan kode pemulihan** untuk dicetak atau diunduh, dengan centang wajib
     *"Saya sudah menyimpannya"*.
- Menyelesaikan wizard menulis akun, profil, dan `setupCompletedAt` **dalam satu transaksi basis data**.
  Sesudahnya prosedur penyiapan menolak dijalankan lagi, dan wizard tidak pernah muncul.
- **Instalasi produksi yang sudah ada** sudah memiliki Pemegang Saham (dibuat 12 September 2026 dari
  `.env`). Migrasinya mengisi `setupCompletedAt` bila Pemegang Saham sudah ada, sehingga produksi
  tidak pernah melihat wizard; pemiliknya mendapat ajakan **"Buat kode pemulihan"** saat masuk berikutnya.
- **Dibuang:** `ensureInitialShareholder`, `INITIAL_SHAREHOLDER_*`, `startLogin` Manus,
  `getUserByOpenId`, penanganan `OWNER_OPEN_ID`/`VITE_APP_ID`. Kolom `users.openId` **tetap** —
  komentar skemanya menyatakan ia disimpan untuk kesinambungan audit, dan akun internal memakai
  `local:<username>`.

#### 3.2 Kode pemulihan

- Tabel baru `owner_recovery_codes`: hanya **hash** kode, `usedAt`, `createdAt`, `userId`. Setiap kode
  berlaku sekali.
- Tautan **"Lupa kata sandi?"** di halaman login: username + satu kode pemulihan + kata sandi baru.
  Berhasil → kode itu hangus, `sessionVersion` pemilik dinaikkan sehingga seluruh sesi lama keluar.
- Hanya untuk Pemegang Saham. Membuat ulang kode (dari menu pengguna) membatalkan seluruh kode lama.
- Setiap pemakaian dan pembuatan ulang tercatat di `audit_logs`, tanpa pernah menyimpan kodenya.

#### 3.3 Keamanan masuk

- Pembatasan percobaan masuk dan pemulihan per username **dan** per alamat IP, dengan jeda yang
  memanjang sesudah kegagalan berulang. Disimpan di memori proses: produksi berjalan sebagai satu
  proses pm2 `fork`; bila kelak berjalan berkelompok, pembatas harus pindah ke basis data (dicatat
  sebagai risiko residual).
- Pesan kegagalan sama untuk username yang salah dan kata sandi yang salah.
- Sesi tetap cookie dengan pemeriksaan `sessionVersion` di server. Autentikasi ulang untuk tindakan
  sensitif mengikuti keputusan SOLVINC 3 September 2026.
- **Halaman login:** logo dan nama perusahaan, dua kolom, tautan pemulihan — tidak ada yang lain.

#### 3.4 Halaman kurs publik yang dapat dikonfigurasi

- `Home.tsx` berhenti menulis mati apa pun. Nama, logo, alamat, telepon, tautan peta, jam buka, FAQ,
  dan peringatan penipuan diambil dari Profil Perusahaan.
- Kolom baru pada `company_profile`: `publicPageEnabled`, `accentColor`, `secondaryPhone`,
  `openingHours`, `mapUrl`, `publicFaq` (JSON pasangan tanya-jawab), `fraudWarning`.
- `publicPageEnabled = false` → `/` langsung ke halaman login.
- Kurs aktif dan pengumuman tetap memakai prosedur publik yang sudah ada
  (`rates.activeRates`, `publicContent.announcements`).

#### 3.5 Celah untuk SOLVINC

Halaman login menampilkan **daftar cara masuk** — hari ini hanya "username & kata sandi". Kelak
"Masuk dengan SOLVINC" ditambahkan ke daftar itu tanpa menyentuh wizard, sesi, maupun peran. Tidak ada
kode khusus SOLVINC yang dibangun sekarang.

### 4. Sub-proyek 3 — Penilaian risiko berbahasa manusia

Dirinci sampai level keputusan; spec lengkapnya ditulis pada awal sesi sub-proyek 3.

#### 4.1 Lima prinsip

1. **Bertanya, bukan memberi label.** Setiap nilai risiko inheren menjadi pertanyaan dalam bahasa
   usaha dengan contoh dari data perusahaan sendiri ("Berapa banyak nasabah Anda yang pekerjaannya
   berisiko tinggi? Bulan ini: 3 dari 120 nasabah."), dengan label "TPPU 2A · Form A1" kecil di bawahnya.
2. **Aplikasi menjawab lebih dulu bila bisa.** Nilai yang terhitung dari basis data tampil sudah terisi,
   dengan tautan *"dari mana angka ini?"*; manusia mengonfirmasi atau mengoreksi.
3. **Alur terpandu lima langkah menggantikan empat halaman:** Tentang usaha Anda (Form C1) → Nasabah,
   produk, wilayah (inheren) → Seberapa siap pengendalian Anda (KPMR — 31 pertanyaan dikelompokkan ke
   ±6 topik, jawaban ya/sebagian/tidak dijelaskan) → Hasil ("Risiko Anda: Rendah ke Menengah" beserta
   paragraf penggeraknya) → Kirim untuk disetujui.
4. **Klasifikasi Risiko menjadi daftar keputusan kecil** ("Mata uang mana yang Anda anggap berisiko
   tinggi, dan mengapa?"). Alasan wajib dan jejak audit tetap.
5. **Angka dan ekspor tidak berubah.** `shared/individualRiskAssessment.ts`,
   `shared/iraAssessmentTotals.ts`, penguncian persetujuan, dan ekspor BI tetap. Uji membuktikan total
   tidak bergeser.

#### 4.2 Penjelasan AI pada langkah Hasil

- Tombol **"Mengapa risiko saya {tingkat}?"** hanya pada langkah Hasil.
- **Kunci API Anthropic milik pembeli**, dimasukkan pemilik di Pengaturan, **mati secara bawaan**.
  Kunci disimpan **terenkripsi** dengan kunci server dari variabel lingkungan baru
  `SETTINGS_ENCRYPTION_KEY` (tidak disimpan di basis data); kunci API tidak pernah ditampilkan lagi
  sesudah disimpan. Tanpa `SETTINGS_ENCRYPTION_KEY` fitur ini tidak dapat diaktifkan.
- **Yang dikirim hanya angka tersimpan penilaian itu:** 33 nilai inheren, skor KPMR, total dan ambang
  pita, agregat Form C1. **Tidak pernah** nama nasabah, nomor identitas, maupun data KYC apa pun.
  Daftar kolom yang boleh keluar dipaku oleh uji (§6.2).
- Jawabannya wajib menyebut angka yang dipakainya dan berlabel **"Penjelasan otomatis — bukan pendapat
  kepatuhan"**. Ia tidak mengubah penilaian dan tidak dapat menyetujui apa pun.
- Setiap tanya-jawab disimpan bersama penilaiannya dan tercatat di `audit_logs`, supaya pemeriksa dapat
  melihat apa yang disampaikan kepada pemilik.
- SDK Anthropic ditambahkan sebagai dependensi baru di sub-proyek 3. **Pilihan model dan cara
  pemakaian API diambil dari rujukan Claude API pada sesi itu**, bukan dari ingatan.
- Tanpa kunci terkonfigurasi, tombolnya tidak dirender dan tidak ada yang lain berubah.

### 5. Sub-proyek 4–9 — cakupan

Masing-masing dirancang pada sesinya sendiri memakai pola §2.5 dan panduan §2.6. Batas yang mengikat:

- **4 Kasir & 5 Kas/stok:** sebelum dianggap selesai, skenario nyata ditelusuri di peramban — modal awal
  → beli → jual pada hari yang sama → tutup/hitung fisik; beli tanpa modal Rupiah cukup; jual tanpa stok
  valuta cukup — dengan kedua kaki transaksi dan seluruh rincian pecahan diperiksa.
- **6 Nasabah:** pemilih nasabah yang harus menemukan nasabah tidak aktif memakai `customers.list`,
  bukan `customers.search` (yang hanya memuat `ACTIVE`).
- **8 Kepatuhan:** memakai hasil bahasa sub-proyek 3 untuk seluruh istilah APU-PPT.
- **9 Pengaturan:** layar Profil Perusahaan memuat kolom publik §3.4 dan kunci AI §4.2.

### 6. Pengujian

#### 6.1 Gerbang yang tetap

`vitest run`, `tsc --noEmit`, dan `vite build` pada setiap tugas, dengan `.env` termuat. Angka uji yang
disebut adalah yang benar-benar terlihat.

#### 6.2 Uji penjaga berbasis pemindaian berkas

Seperti `server/documentRetentionGuard.test.ts`:

- **Tanpa heks mentah** pada berkas yang terdaftar sebagai "sudah di atas fondasi". Daftarnya tumbuh
  per sub-proyek; berkas lama tidak memblokir.
- **Kontras aksen** — tabel kasus atas `shared/accentColor.ts`.
- **Muatan AI** (sub-proyek 3) — uji memaku daftar kolom persis yang dikirim ke Anthropic dan gagal bila
  kolom nama, nomor identitas, atau KYC lain muncul.

#### 6.3 Uji komponen dan Playwright

- **Testing Library + jsdom** (dependensi pengembangan baru) untuk komponen pola dan logika wizard.
- **Playwright** (`@playwright/test`, dependensi pengembangan baru; Chromium sudah tersedia di mesin
  lokal):
  - Basis data khusus **`mc_t_visual`**, dibuat dengan `node scripts/tenant.mjs provision visual`,
    diisi data tetap oleh skrip seed yang dapat diulang. **Tidak pernah** `moneychanger`.
  - Jam dibekukan (`page.clock`), wilayah yang berubah (kurs, cap waktu) disamarkan.
  - Masuk lewat fixture yang memanggil prosedur login dengan akun uji lokal, bukan mengetik di formulir.
  - Baseline pada **1280×800, 1440×900, 1920×1080**. Sub-proyek 1 memotret galeri pola dan shell;
    setiap sub-proyek berikutnya menambah baseline layar yang dibangunnya.
  - Dijalankan lokal. Tidak di CI sampai GitHub Action penerapan diperbaiki.
- Perubahan dependensi menjalankan `pnpm audit --prod --audit-level=high`; **jangan menyebut audit
  bersih** selama sembilan temuan SheetJS/xlsx masih ada.

#### 6.4 Verifikasi di peramban

Setiap rute yang berubah diperiksa di peramban pada ketiga ukuran, termasuk fokus papan ketik dan
keadaan memuat/kosong/galat, dengan data uji lokal dibuat lebih dulu. Halaman kosong bukan bukti.

#### 6.5 Penerapan per sub-proyek

`deploy.sh` dijalankan manual di server (GitHub Action masih gagal di langkah SSH), dengan cadangan
lebih dulu. Setiap sub-proyek ditutup dengan pemeriksaan produksi: jumlah migrasi, aplikasi `online`,
rute yang berubah menjawab 200.

## Yang sengaja tidak dikerjakan di program ini

- **SaaS multi-perusahaan dengan halaman pemasaran, pendaftaran, dan tagihan.** Diputuskan produk
  mandiri lebih dulu.
- **Pemesanan valuta daring oleh nasabah** — butuh backend reservasi dan penguncian kurs; sub-proyek
  tersendiri bila kelak diminta.
- **Dwibahasa ID/EN** dan **tema penuh per perusahaan** — hanya logo, nama, dan satu aksen.
- **Reset kata sandi lewat email** dan **2FA/TOTP** — pemulihan memakai kode sekali pakai.
- **Gateway SOLVINC** — hanya celah daftar cara masuk (§3.5).
- **Parameter risiko baru, Aspek Kelembagaan, daftar negara FATF/PBB** — tetap risiko residual Paket J2.
- **Layar konter untuk tablet atau ponsel.**
- **Playwright di CI** sampai penerapan otomatis berfungsi.

## Risiko residual

1. **Layar lama dan baru hidup berdampingan** selama program berjalan. Pengguna akan melihat dua gaya
   sampai sub-proyek 9 selesai; itulah harga pendekatan A yang disetujui.
2. **GitHub Action penerapan gagal di langkah SSH** sejak 2 September 2026 dan belum diperbaiki; setiap
   push ke `main` menghasilkan satu run gagal. Perbaikannya pekerjaan kecil tersendiri di luar program.
3. **Produksi baru saja direset** (tabel dihapus 11 September 2026, penerapan dan akun Pemegang Saham
   baru 12 September 2026). Daftar DTTOT/DPPSPM harus diimpor ulang dan Profil
   Perusahaan diisi ulang oleh pengguna; `INITIAL_SHAREHOLDER_PASSWORD` masih ada di `.env` produksi
   sampai sub-proyek 2 membuangnya dan pengguna menghapusnya.
4. **Pembatas percobaan masuk di memori proses** hanya benar selama produksi berjalan satu proses.
5. **`SETTINGS_ENCRYPTION_KEY` yang hilang** membuat kunci AI tersimpan tidak dapat dibaca; pemilik harus
   memasukkan kunci ulang. Tidak ada data bisnis yang terkena.
6. **Baseline tangkapan layar rapuh** terhadap perubahan font sistem dan versi Chromium; baseline
   diperbarui secara sadar, bukan otomatis.
7. **Tiga dependensi baru** (Testing Library, Playwright, SDK Anthropic) menambah permukaan audit.
8. **Versi Node lokal 24.19 vs produksi 24.20** — sama mayornya; dicatat karena Playwright dan build
   berjalan di lokal.
