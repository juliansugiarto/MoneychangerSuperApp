# Tema Konter Tebal dan Papan Kurs

Tanggal 13 September 2026. Disetujui pengguna bagian demi bagian pada sesi rancangan; berkas ini
menunggu tinjauan pengguna sebelum rencana bertugas ditulis.

Berkas ini **memperbarui** `2026-09-12-desain-ulang-antarmuka-design.md` (selanjutnya "spec program"):
keputusan pengguna #6, §2.1 (aksen), §2.3 (tipografi), dan tabel sub-proyek §1. Bagian lain spec
program tetap berlaku.

## Mengapa

1. **Tampilan fondasi dinilai terlalu polos.** Shell Tugas 7 (abu-abu netral, satu aksen biru) dilihat
   pengguna 13 September 2026: *"kesannya korporat sekali seperti yang BI bikin (SIPUKA), jelek."*
   Empat tema berganti warna pada tata letak yang sama juga ditolak: *"semuanya terlihat sama, seperti
   buatan AI."* Yang dicari adalah **karakter**, bukan sekadar warna.
2. **Halaman Kurs tidak dapat dipakai untuk menetapkan kurs harian.** Diperiksa pada kode 13 September
   2026:
   - `client/src/pages/Rates.tsx` menumpuk ±10 kartu (status sinkronisasi, peringatan, ambang, kelola
     mata uang, referensi, pembanding pasar, form satu kurs, daftar versi, alur kerja). Setiap versi kurs
     tampil sebagai kartu besar (`rounded-2xl p-4`), sehingga daftar panjang tidak terbaca sekaligus.
   - Kurs diajukan **satu per satu** (`rates.propose`) atau dari snapshot BI (`rates.proposeLatest`);
     tidak ada papan tempat seluruh valuta diisi sekaligus.
   - `activateOperationalRates` (`server/operations.ts`) mengaktifkan dalam **perulangan di luar satu
     transaksi basis data** — bila satu gagal, sebagian kurs sudah aktif dan sebagian belum.
   - Model data **satu kurs per valuta** (`operational_rates` tanpa kelompok pecahan), padahal money
     changer di Indonesia lazim membedakan harga pecahan besar dan kecil.
   - "Hanya 7 kurs" bukan batas kode: basis data lokal memang berisi 7 valuta asing + IDR, dan hanya 1
     yang memiliki kurs aktif. Katalog `shared/worldCurrencies.ts` memuat 151 valuta.

## Keputusan pengguna (13 September 2026) — jangan ditanyakan ulang

1. **Gaya "Konter Tebal"**: huruf tebal, garis tinta tebal dengan bayangan keras, blok warna padat.
2. **Intensitas B — "bingkai tebal, kerja tenang"**: bingkai, judul, ubin angka, tombol utama, dan kartu
   ringkasan tebal; input, baris tabel, dan baris pecahan bergaris tipis; kolom yang sedang difokus
   mendapat garis tebal.
3. **Enam palet siap pakai**, semuanya ditawarkan: Marun (bawaan), Zamrud, Samudra, Terakota, Anggur,
   Arang. Pemilik boleh mengetik warna utama sendiri **hanya bila lolos penjaga kontras**.
4. **Papan kurs dibangun tepat sesudah fondasi** (sub-proyek 1B), sebelum login/penyiapan.
5. **Kurs per kelompok pecahan** (mis. USD 100 · USD 50 · USD 5–20).
6. **Harga bon: terisi otomatis dari papan, boleh diubah dalam toleransi** yang ditetapkan admin; di
   luar toleransi wajib alasan dan masuk antrean tinjauan.
7. **Papan kurs: garis lebih tegas dan sorot baris + kolom sel aktif**, supaya harga tidak salah dibaca.
8. Pendekatan penyampaian **A**: tema tanpa skema di sub-proyek 1; pemilih palet milik pemilik (dengan
   kolom basis data) di sub-proyek 2; papan kurs sebagai sub-proyek 1B dengan spec → rencana →
   implementasi sendiri.

Tangkapan rancangan yang disetujui: `.superpowers/brainstorm/59970-1789210543/content/`
(`gaya-karakter.html` pilihan 3, `tebal-intensitas.html` pilihan B, `palet-konter-tebal.html`,
`papan-kurs.html`). Berkas itu lokal dan tidak di-commit.

## Struktur program yang diperbarui

| # | Sub-proyek | Perubahan terhadap spec program |
|---|---|---|
| 1 | Fondasi desain | **Ditambah Tugas 7A "Tema Konter Tebal"** sebelum Tugas 8. Tugas 1–7 yang sudah di-commit tidak dibatalkan. |
| **1B** | **Papan kurs** | **Baru.** Bagian B berkas ini. Bergantung pada 1. |
| 2 | Login, penyiapan awal, halaman publik | **Ditambah** pemilih palet dan warna utama sendiri pada Profil Perusahaan (Bagian A5). |
| 5 | Kas & stok | **Kurs dikeluarkan** dari cakupannya (pindah ke 1B). |

Urutan pengerjaan: **1 → 1B → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9.**

---

## Bagian A — Tema Konter Tebal (sub-proyek 1, Tugas 7A)

### A1. Enam palet

Sumber tunggal: `shared/themePalettes.ts` (data murni). Setiap palet: `paper` (latar), `ink` (teks dan
garis tebal), `brand` + `brandInk` (blok utama dan teks di atasnya), `second` + `secondInk` (blok kedua).

| id | Nama | paper | ink | brand | brandInk | second | secondInk |
|---|---|---|---|---|---|---|---|
| `MARUN` | Marun (bawaan) | `#FFF6EA` | `#1D1414` | `#7A1F2E` | `#FFF6EA` | `#F2B33D` | `#1D1414` |
| `ZAMRUD` | Zamrud | `#F1F6EE` | `#0F1D17` | `#0F5A41` | `#F1F6EE` | `#E8B923` | `#0F1D17` |
| `SAMUDRA` | Samudra | `#EEF3FB` | `#0D1726` | `#1F3A8A` | `#EEF3FB` | `#7DD3C0` | `#0D1726` |
| `TERAKOTA` | Terakota | `#FFF3E6` | `#22160F` | `#B93A0C` | `#FFF3E6` | `#8FD3C7` | `#22160F` |
| `ANGGUR` | Anggur | `#F7F1FA` | `#1C1222` | `#5B2A86` | `#F7F1FA` | `#FFD166` | `#1C1222` |
| `ARANG` | Arang | `#F2F0EA` | `#111111` | `#161616` | `#E6FF5C` | `#E6FF5C` | `#111111` |

- **Uji wajib:** setiap pasangan `brand/brandInk`, `second/secondInk`, dan `ink/paper` mencapai
  `MIN_CONTRAST` (4,5:1) menurut `contrastRatio` Tugas 2. Palet yang gagal **diperbaiki nilainya**, tidak
  dikecualikan dari uji. Hitungan tangan pada sesi rancangan (mis. Marun ±9,3; Terakota ±5,2) bukan
  pengganti uji ini.
- **Warna status tidak ikut palet.** Hijau/kuning/merah (`success`, `warning`, `danger`, `info`) sama di
  keenam palet.
- `themePalettes.ts` memang memuat heks — ia **data**, bukan berkas tampilan, dan tidak dimasukkan ke
  `FOUNDATION_FILES`. Berkas tampilan tetap hanya memakai token.

### A2. Token

Token Tugas 3 **diperluas**, tidak dihapus. Nilai bawaan di `client/src/index.css` adalah palet Marun;
uji penjaga memastikan nilainya sama dengan data `MARUN` (menggantikan pemeriksaan `--brand` biru).

- Palet: `--paper`, `--ink`, `--brand`, `--brand-contrast`, `--second`, `--second-contrast`.
  `--surface*`, `--ink-muted`, `--ink-subtle`, `--line` diturunkan dari `--paper`/`--ink` dengan
  `color-mix`, sehingga mengganti palet cukup mengganti enam variabel.
- Gaya: `--frame-width: 2px`; `--shadow-hard: 3px 3px 0 var(--ink)` (ubin: `4px 4px 0`);
  `--line-quiet`: `--ink` 28%; cincin fokus: garis 2px `--ink` + bayangan 3px `--brand`.
- `PRODUCT_ACCENT` (Tugas 2) menjadi `#7A1F2E`. Uji Tugas 2 merujuk konstanta, bukan nilai, sehingga
  tetap berlaku.
- `applyBrandAccent` digeneralisasi menjadi `applyTheme(root, paletteId, customBrand)`: menulis enam
  variabel palet; `customBrand` diperiksa `resolveAccent` dan, bila gagal, `brand` palet terpilih yang
  dipakai beserta alasannya (`INVALID` / `LOW_CONTRAST`).

### A3. Tipografi

Memperbarui spec program §2.3.

- **Bricolage Grotesque** (600/800) untuk judul halaman, nama merek, dan angka besar pada ubin.
- **Manrope** tetap untuk seluruh teks isi, label, input, dan tabel. **IBM Plex Mono** tetap di tempat
  yang sudah memakainya.
- Dimuat lewat tautan Google Fonts yang sudah ada di `client/index.html` (tambah satu keluarga).
- Angka uang tetap `tabular-nums`. Skala kepadatan spec program §2.2 (14px isi, baris 36px) **tidak
  berubah**.

### A4. Intensitas B

| Tebal — garis 2px, bayangan keras, blok padat | Tenang — garis tipis `--line-quiet` |
|---|---|
| Bingkai sidebar dan butir menu aktif, bilah atas, judul `PageHeader`, `StatTile`, tombol utama, kartu ringkasan, kepala `DataTable` | Input, baris `DataTable`, `FormSection`, baris pecahan, `ErrorState`/`EmptyState` |

- Elemen yang **sedang difokus** selalu mendapat cincin fokus tebal (A2), di bagian tenang sekalipun.
- **Pengecualian: papan kurs (B5)** memakai garis kisi tebal dan sorot baris + kolom.
- Tidak ada mode gelap; tema berkomitmen pada satu tampilan per palet.

### A5. Pilihan pemilik (dikerjakan di sub-proyek 2)

Tidak dibangun di sub-proyek 1, karena pemilih tanpa penulis data melanggar aturan "Fitur Harus Punya
Sumber Data".

- Kolom baru `company_profile.themePalette` (enum enam id, bawaan `MARUN`) dan
  `company_profile.accentColor` (`varchar(7)`, boleh kosong).
- Layar Profil Perusahaan: enam palet dengan pratinjau langsung, kolom warna utama sendiri dengan
  peringatan kontras yang menyebut alasannya, simpan lewat `companyProfile.update` (CONTROLLER+).
- Shell membaca profil dan memanggil `applyTheme` saat memuat.

### A6. Dampak pada tugas sub-proyek 1

- **Tugas 7A (baru):** `themePalettes.ts` + uji; token A2; font A3; gaya ulang shell Tugas 7 dan pola
  Tugas 5–6 menurut A4. **Struktur, props, dan uji perilaku komponen tidak berubah.** Uji penjaga warna
  mentah tetap berlaku untuk seluruh berkas terdaftar.
- **Tugas 9 (galeri):** menampilkan keenam palet dengan pengalih **pratinjau** yang jelas berlabel "tidak
  disimpan" — hanya keadaan layar, bukan pengaturan.
- **Tugas 11 (Playwright):** baseline memakai Marun; satu tangkapan galeri per palet.
- **Tugas 12:** verifikasi peramban pada 1280, 1440, dan 1920 untuk ketiga rute Tugas 7 dan galeri.

### A7. Verifikasi Bagian A

`themePalettes.test.ts` (kontras, id unik, heks sah, bawaan CSS = `MARUN`); uji `applyTheme` di jsdom;
uji penjaga warna mentah; `vitest run`, `tsc --noEmit`, `vite build`; pemeriksaan peramban dengan
tangkapan layar.

---

## Bagian B — Papan kurs (sub-proyek 1B)

### B1. Data — satu migrasi aditif

Tidak ada kolom yang dihapus atau diubah tipenya.

- **Tabel baru `rate_tiers`**: `id`, `currencyId`, `label` (`varchar(40)`, mis. "100", "5–20"),
  `denominationValues` (JSON larik nilai muka desimal), `sortOrder`, `active`, `createdByUserId`,
  `createdAt`, `updatedAt`. Indeks `(currencyId, active)`.
  - Server menolak nilai muka yang berada di **dua kelompok aktif** pada valuta yang sama.
  - Valuta tanpa kelompok aktif berperilaku seperti hari ini: satu kurs untuk semua pecahan.
  - Nilai muka yang tidak masuk kelompok mana pun memakai kurs tingkat valuta (`rateTierId` kosong) bila
    ada; papan menampilkannya sebagai baris "Pecahan lain".
- **`operational_rates`**: tambah `rateTierId` (boleh kosong = seluruh valuta), `approvalReason`
  (`varchar(1000)`), `activationBatchId` (`varchar(36)`). Indeks `(currencyId, rateTierId, status)`.
  Kedua kolom terakhir adalah **penulis data** untuk riwayat hari ini di papan; riwayat tidak dibaca
  dari `audit_logs`.
- **`exchange_transaction_denomination_entries`**: tambah `operationalRateId`, `referenceRateSnapshot`,
  `rateDeviationPercent` — rujukan per baris pecahan, karena pecahan dalam satu bon dapat jatuh ke
  kelompok berbeda.
- **`exchange_transactions`**: tambah `rateDeviationReason` (`varchar(1000)`).
- **`operational_settings`**: tambah `rateDeviationTolerancePercent` (`decimal(8,4)`, bawaan `0.5000`).

### B2. Server

- `rates.board` (ADMIN+): valuta aktif, kelompoknya, kurs aktif, draf, referensi BI terbaru, dan riwayat
  aktivasi hari ini (per `activationBatchId`, hari menurut zona operasional WIB).
- `rates.saveBoardDrafts` (ADMIN+): menyimpan banyak sel sekaligus sebagai DRAFT. Draf baru **mengganti**
  draf lama untuk pasangan valuta + kelompok yang sama.
- `rates.activateBoard` (ADMIN+): alasan ≥ 10 karakter; **satu transaksi basis data**; untuk setiap draf,
  kurs ACTIVE dengan **valuta + kelompok yang sama** menjadi RETIRED; seluruh draf menjadi ACTIVE dengan
  `approvalReason` dan satu `activationBatchId`; satu baris `audit_logs` per kurs. Satu kegagalan
  membatalkan seluruhnya, dan galatnya menyebut valuta + kelompok yang gagal.
- `activateOperationalRates` lama diganti implementasi atomik yang sama; `rates.activate` tunggal
  memanggilnya dengan satu id.
- **"Salin kurs kemarin"** membuat draf dari kurs yang sedang aktif. **"Isi saran dari referensi BI"**
  (`proposeLatest` yang sadar kelompok) membuat draf dari snapshot BI untuk setiap kelompok. **Keduanya
  tidak pernah mengaktifkan** — aturan aktivasi manual dengan alasan tetap.
- `rateTiers.save` / `rateTiers.deactivate` (ADMIN+). Menonaktifkan kelompok yang memiliki kurs ACTIVE
  mewajibkan alasan dan me-RETIRE kurs itu dalam transaksi yang sama.
- Pengaturan toleransi ikut `settings.updateReviewThreshold` (ADMIN+, pola yang ada).
- `listPublicActiveRates` mengembalikan label kelompok; halaman publik (`Home.tsx`) dan Meja Konfirmasi
  (`ServiceDesk.tsx`) menampilkan kelompok di bawah valutanya.

### B3. Harga bon dan toleransi

Hari ini harga otoritatif ada pada **setiap baris pecahan** (`agreedRate` diketik kasir); kurs aktif
dicari **per valuta** dan hanya disimpan sebagai rujukan (`server/operations.ts`, penyiapan baris).

- **Klien** mengisi `agreedRate` tiap baris pecahan dari kurs kelompok yang memuat nilai mukanya, lalu
  kurs tingkat valuta; BELI memakai `buyRate`, JUAL memakai `sellRate`. Data papan di klien disegarkan
  saat form difokus.
- **Server** menghitung ulang rujukan pada saat simpan (bukan mempercayai klien) dan
  `rateDeviationPercent = |agreedRate − rujukan| / rujukan × 100` per baris.
- Bila ada baris di atas toleransi:
  - tanpa `rateDeviationReason` (≥ 10 karakter) → ditolak dengan pesan yang menyebut valuta, pecahan,
    harga papan, dan batasnya, mis. *"Harga USD 100 berbeda 1,2% dari kurs papan 16.290 (batas ±0,5%).
    Isi alasan selisih harga atau pakai kurs papan."*;
  - dengan alasan → bon tersimpan, `requiresReview` benar, dan `SELISIH_KURS_MELEBIHI_TOLERANSI`
    ditambahkan ke `reviewReason` lewat daftar alasan yang sudah ada.
- Toleransi berlaku **dua arah** (lebih mahal maupun lebih murah). Asimetri ditunda sampai ada kebutuhan.
- Valuta tanpa kurs aktif: tetap seperti hari ini (tanpa rujukan, tanpa pemeriksaan toleransi).
- **Tidak berubah:** sisi Rupiah (`exchange_transaction_payment_denominations`), validasi stok pecahan
  untuk JUAL, dan `cash_denomination_balances`.

### B4. Di luar cakupan

- **Seri uang kertas (lama/baru).** Tidak tercatat di skema mana pun; menambahkannya mengubah
  `cash_denomination_balances`, sumber kebenaran kas. Sampai diputuskan tersendiri, selisih harga karena
  seri diketik pada bon — dalam toleransi atau dengan alasan.
- Kurs per cabang (belum ada cabang), sinkronisasi otomatis ke papan tampilan/TV, dan aktivasi otomatis
  dari referensi mana pun.

### B5. Layar papan kurs (`/operasional/kurs`)

Dibangun dari pola sub-proyek 1 dengan tema Bagian A. Mengganti `Rates.tsx`; URL tetap.

- **Kepala:** judul "Kurs berapa hari ini?"; tombol "Salin kurs kemarin", "Isi saran dari referensi
  BI", "+ Tambah valuta" (dari katalog 151 valuta).
- **Tiga ubin:** berlaku sekarang (nama batch, waktu, jumlah kurs, penyetuju); belum diaktifkan (jumlah
  dan daftar singkat); perlu perhatian (peringatan perubahan kurs yang ada).
- **Riwayat hari ini:** satu baris per batch — waktu, jumlah kurs, alasan.
- **Kisi kurs:** kolom Valuta · Kelompok · Referensi BI · Beli · Jual · Selisih · Status; baris 34px;
  baris kelompok di bawah valutanya. **Garis kisi 2px** dan **sorot baris + kolom sel aktif**. Sel
  berubah berlatar kuning dengan nilai lama dicoret. Tab/Shift+Tab dan ↑↓ pindah sel, Enter menyimpan
  draf. Penyaring: Semua · Berubah · Tanpa kurs; pencarian kode/nama valuta.
- **Bilah bawah menempel:** jumlah kurs siap diaktifkan, kolom alasan, "Buang draf", "Aktifkan N kurs".
- Kelola kelompok pecahan per valuta lewat dialog. Pembanding pasar, sinkronisasi BI, dan ambang
  dipindah ke bagian terlipat "Referensi & pengaturan" di bawah kisi, bukan dibuang.
- Keadaan memuat/kosong/galat memakai `PageStates` dengan langkah berikutnya.

### B6. Skenario yang wajib ditelusuri

1. Pagi: salin kurs kemarin → ubah 5 sel → aktifkan dengan alasan → 26 kurs ACTIVE dalam satu batch.
2. Siang: ubah 3 kelompok USD → aktifkan → hanya ketiganya RETIRED/ACTIVE; kurs USD tingkat valuta dan
   valuta lain tidak tersentuh.
3. Aktivasi 3 draf dengan satu draf rusak → **tidak ada** yang aktif; galat menyebut barisnya.
4. Nilai muka yang sama dimasukkan ke dua kelompok USD → ditolak.
5. Bon JUAL USD 100 × 5 pada kurs papan → tersimpan tanpa tinjauan; Rupiah dan stok bergerak seperti hari
   ini.
6. Bon BELI USD dengan harga 1,2% dari papan, tanpa alasan → ditolak; dengan alasan → masuk antrean
   tinjauan dengan `SELISIH_KURS_MELEBIHI_TOLERANSI`.
7. Kurs diaktifkan antara bon dibuka dan disimpan → server memakai kurs yang aktif saat simpan.
8. Bon memuat USD 100 (kelompok "100") dan USD 10 (tanpa kelompok, jatuh ke kurs valuta) → tiap baris
   pecahan membawa rujukannya sendiri.

### B7. Verifikasi Bagian B

- **Uji server:** pencocokan pecahan ke kelompok, penolakan tumpang tindih, RETIRE per kelompok,
  rollback atomik, penolakan dan jalur tinjauan toleransi, zona WIB untuk "hari ini".
- **Uji komponen:** navigasi papan ketik, sorot baris + kolom, penanda sel berubah, bilah alasan
  menonaktifkan tombol sampai ≥ 10 karakter.
- **Peragaan end-to-end** di `moneychanger` lokal: buat kelompok USD, aktivasi pagi, perubahan siang,
  satu bon dalam toleransi dan satu di luar, lalu tunjukkan di antrean tinjauan.
- `vitest run`, `tsc --noEmit`, `vite build`; `pnpm audit --prod` hanya bila dependensi berubah.
- **Migrasi:** baca SQL yang dihasilkan, pastikan hanya `CREATE TABLE`/`ADD COLUMN`/`CREATE INDEX`,
  cadangkan dengan `--single-transaction --set-gtid-purged=OFF` dan buktikan pemulihannya sebelum
  diterapkan.
- **Rollback:** kode lama tidak membaca kolom baru; mengembalikan commit cukup untuk aplikasi. Kolom
  dan tabel baru dibiarkan (tanpa `DROP`) kecuali pengguna menyetujui penghapusan.

---

## Aturan yang tidak berubah

Rincian pecahan wajib pada setiap pergerakan kas fisik; kedua kaki transaksi valuta; kurs diaktifkan
**manual dengan alasan yang dapat ditelusuri**; `audit_logs` tidak disunting; otorisasi ditegakkan di
server; data uji hanya di `moneychanger` dan `mc_t_abcvalas` lokal.

## Risiko residual

1. **Kontras Tebal pada layar lama.** Halaman yang belum dibangun ulang tetap memakai heks sendiri di
   dalam shell bertema; campuran gaya berlangsung sampai modulnya tiba (pendekatan A spec program).
2. **Halaman lama tanpa `h1`.** Ditemukan pada verifikasi Tugas 7: `/operasional`,
   `/operasional/stock/kas-awal`, dan `/kepatuhan/ira` tidak memiliki `h1` sesudah kepala shell berhenti
   menjadi heading. Tertutup ketika tiap modul memakai `PageHeader`.
3. **Sidebar diciutkan tidak menandai induk.** Pada mode ikon, butir induk (mis. "Uang Kas") tidak
   menandai halaman aktif di dalamnya — regresi kecil dari shell lama, diperbaiki di Tugas 7A.
4. **Seri uang kertas** belum dapat dihargai otomatis (B4).
5. **Font dari Google Fonts** membutuhkan internet; tanpa sambungan, peramban memakai fallback sistem.
