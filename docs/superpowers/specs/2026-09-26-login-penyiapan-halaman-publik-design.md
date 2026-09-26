# Sub-proyek 2 — Login, penyiapan awal, kode pemulihan, halaman publik, pemilih palet

Tanggal 26 September 2026. Ketiga bagian rancangan disetujui pengguna satu per satu pada sesi
rancangan ini. Berkas ini **merinci dan mengoreksi** spec program
`2026-09-12-desain-ulang-antarmuka-design.md` §3 dan spec
`2026-09-13-tema-konter-tebal-dan-papan-kurs-design.md` §A5. Yang tidak disebut di sini tetap
mengikuti kedua spec itu.

## Keputusan pengguna 26 September 2026 — jangan ditanyakan ulang

1. **Wizard penyiapan dijaga kode penyiapan sekali pakai.** Tanpa penjaga, siapa pun yang lebih dulu
   membuka instalasi baru di internet menjadi pemiliknya. Kodenya dibuat penginstal lewat
   `node scripts/tenant.mjs setup-code <tenant>` (bukan dicetak ke log pm2, supaya tidak tertinggal di
   berkas log), berlaku 24 jam, disimpan sebagai hash.
2. **Autentikasi ulang untuk tindakan sensitif ditunda** (aktivasi kurs, persetujuan paket regulator,
   perubahan akses). Dirancang sekali bersama cara masuk SOLVINC; dicatat sebagai risiko residual.
3. **Halaman publik dengan kolom kosong:** bagian kontak, jam buka, dan peta disembunyikan; FAQ dan
   peringatan penipuan memakai teks produk netral (tanpa nama perusahaan, tanpa nomor) sampai pemilik
   mengisinya. Migrasi **tidak** menyalin teks Ibukota Valasindo ke basis data mana pun.

## Koreksi terhadap spec program

**`setupCompletedAt` tidak disimpan di `company_profile`.** Diperiksa 26 September 2026: instalasi baru
tidak memiliki baris profil sama sekali (`updateCompanyProfile` melakukan upsert; `mc_t_abcvalas` hari
ini 0 baris profil), dan produksi yang direset 11–12 September mungkin juga belum. Menandai "sudah
disiapkan" pada tabel yang barisnya belum tentu ada akan memaksa migrasi mengarang nama badan hukum.
Maka fakta itu pindah ke tabel satu baris baru **`app_installation`**.

## Rancangan

### 1. Data — migrasi `0060`, aditif saja

- **`app_installation`** (satu baris): `id`, `setupCompletedAt` (`datetime`, boleh kosong),
  `setupCodeHash` (`varchar(200)`), `setupCodeExpiresAt` (`datetime`), `updatedAt`.
  Backfill di migrasi: sisipkan satu baris dengan `setupCompletedAt = NOW()` **bila sudah ada
  Pemegang Saham** — produksi dan `moneychanger` lokal tidak pernah melihat wizard; `mc_t_abcvalas`
  (tanpa Pemegang Saham) melihatnya dan menjadi basis data peragaan.
- **`owner_recovery_codes`**: `id`, `userId`, `codeHash`, `usedAt`, `createdAt`; indeks `userId`.
- **`company_profile`** ditambah: `themePalette` (enum enam id palet, bawaan `MARUN`), `accentColor`
  (`varchar(7)`), `publicPageEnabled` (bawaan benar), `secondaryPhone` (`varchar(60)`),
  `openingHours` (`varchar(500)`), `mapUrl` (`varchar(500)`), `publicFaq` (JSON larik
  `{question, answer}`, maks. 12), `fraudWarning` (`text`).

### 2. Penyiapan

- Selama `setupCompletedAt` kosong, `publicContent.profile` mengembalikan `setupRequired = true` dan
  halaman depan serta `/login` mengarah ke **`/siapkan`** (instalasi baru belum punya akun, jadi
  setiap URL staf berakhir di `/login`).
- Langkah 0 kode penyiapan → 1 akun pemilik (nama, username, kata sandi ≥ 12) → 2 perusahaan (nama
  badan hukum, nama dagang, nomor izin) → 3 delapan kode pemulihan dengan centang wajib
  *"Saya sudah menyimpannya"*, cetak dan unduh `.txt`.
- `setup.complete` memeriksa kode penyiapan (kedaluwarsa ditolak), lalu dalam **satu transaksi**
  menulis akun Pemegang Saham, baris profil, hash kode pemulihan, `setupCompletedAt`, dan mengosongkan
  hash kode penyiapan. Sesudahnya prosedur itu menolak. Kode pemulihan hanya dikirim ke klien sekali,
  pada jawaban prosedur itu.
- **Dibuang:** `ensureInitialShareholder` dan ujinya, `INITIAL_SHAREHOLDER_*`, `VITE_APP_ID`,
  `OWNER_OPEN_ID`, `upsertUser`, `getUserByOpenId`, `startLogin`, `OAUTH_STATE_COOKIE`,
  `encodeOAuthState`. `users.openId` tetap. `ensureDevelopmentTestAccounts` tetap (hanya pengembangan).

### 3. Masuk dan pemulihan

- **Pembatas percobaan** (`server/loginThrottle.ts`, di memori proses): kunci `tenant:username` dan
  `tenant:ip`; lima kegagalan dalam 15 menit memicu jeda 30 detik yang berlipat dua sampai 15 menit;
  berhasil menghapus kunci username. Dipakai `auth.login`, `auth.recover`, `setup.complete`. Pesan
  kegagalan sama untuk username dan kata sandi yang salah; pesan terkunci menyebut sisa detiknya.
- **IP asli:** `app.set("trust proxy", "loopback")` di `server/_core/index.ts` — tanpa itu setiap
  permintaan lewat nginx ber-IP `127.0.0.1` dan satu penyerang mengunci semua orang.
- **Kode pemulihan:** delapan kode `XXXX-XXXX` dari alfabet tanpa 0/O/1/I, hash scrypt. `auth.recover`
  (publik, hanya Pemegang Saham): username + kode + kata sandi baru → kode hangus, `sessionVersion`
  naik, audit `OWNER_RECOVERY_CODE_USED`, langsung masuk. `auth.regenerateRecoveryCodes` (Pemegang
  Saham, wajib kata sandi saat ini) membatalkan seluruh kode lama; audit
  `OWNER_RECOVERY_CODES_REGENERATED`. Kode tidak pernah ditulis ke audit maupun log.
- `auth.me` memuat `recoveryCodesRemaining` bagi Pemegang Saham; shell menampilkan ajakan
  **"Buat kode pemulihan"** bila 0 (pemilik produksi hari ini) atau ≤ 2.

### 4. Layar

Seluruhnya di atas pola sub-proyek 1 dan tema Konter Tebal, dengan keadaan memuat/kosong/galat dan
fokus papan ketik.

- `/login`: logo dan nama dagang dari `publicContent.profile`, **daftar cara masuk** (hari ini satu),
  tautan "Lupa kata sandi?".
- `/pulihkan`, `/siapkan`, `/ubah-sandi` (gaya baru, perilaku sama), `/operasional/kode-pemulihan`
  (Pemegang Saham).
- `/operasional/pengguna` "Pengguna & peran": daftar + panel detail; reset kata sandi lewat dialog,
  bukan `window.prompt`. Aturan server tidak berubah.
- Profil Perusahaan: dua bagian baru sebagai komponen tersendiri — **"Tampilan"** (enam palet dengan
  pratinjau, warna utama sendiri dengan alasan penolakan dan rasio kontras) dan **"Halaman publik"**
  (sakelar, telepon kedua, jam buka, peta, penyunting FAQ, peringatan penipuan). Disimpan lewat
  `companyProfile.updateAppearance` dan `companyProfile.updatePublicPage` (CONTROLLER+, diaudit;
  server memeriksa ulang kontras). Sisa layar tetap lama sampai sub-proyek 9.
- Halaman depan `/`: dibangun ulang bertema palet perusahaan; tabel kurs berlabel kelompok,
  `PublicServicePlanner`, dan pengumuman tetap. `publicPageEnabled = false` → `/` ke `/login`.
- `applyTheme` dipanggil shell (dari `companyProfile.get`) dan oleh halaman publik/login/wizard (dari
  `publicContent.profile`).

### 5. `publicContent.profile`

Prosedur publik dengan **daftar kunci tetap** yang dipaku uji: `tradingName`, `address`, `phone`,
`secondaryPhone`, `openingHours`, `mapUrl`, `publicFaq`, `fraudWarning`, `themePalette`,
`accentColor`, `publicPageEnabled`, `logoUrl` (URL bertanda tangan berumur pendek, hanya untuk dokumen
`COMPANY_LOGO`), `setupRequired`. Nomor izin, NPWP, kode BI/PPATK/goAML, dan email **tidak pernah**
keluar.

## Verifikasi

- Vitest: jadwal jeda pembatas; format, hash, dan sekali-pakai kode pemulihan; transaksi wizard dan
  penolakan sesudah selesai; kedaluwarsa kode penyiapan; daftar kunci profil publik; resolusi IP;
  penjaga simbol yang dibuang. Uji komponen untuk langkah wizard, penyunting FAQ, pemilih palet.
- **Peragaan end-to-end** di `mc_t_abcvalas`: `setup-code` → wizard → masuk → pulihkan dengan kode →
  isi halaman publik dan palet → `/` pada 1280/1440/1920. Di `moneychanger`: ajakan pemilik → buat
  ulang kode.
- Baseline Playwright untuk login, wizard, dan halaman depan.
- `vitest run`, `tsc --noEmit`, `vite build`; migrasi dibaca SQL-nya dan dicadangkan dengan
  `--single-transaction --set-gtid-purged=OFF` serta dibuktikan pemulihannya.

## Rollback

Kode lama tidak membaca tabel dan kolom baru; mengembalikan commit cukup. **Kecuali:** kode lama
membutuhkan `INITIAL_SHAREHOLDER_*` hanya bila belum ada Pemegang Saham, jadi rollback aman pada
instalasi yang sudah disiapkan. Tabel dan kolom baru dibiarkan tanpa `DROP`.

## Risiko residual

1. Pembatas di memori proses hanya benar selama produksi satu proses pm2 `fork`.
2. Autentikasi ulang tindakan sensitif belum ada (keputusan 2).
3. Produksi membutuhkan `0059` dan `0060`, pemiliknya harus membuat kode pemulihan, baris
   `INITIAL_SHAREHOLDER_*` harus dihapus dari `.env` produksi, dan kolom halaman publik harus diisi —
   sampai itu, halaman depan produksi tampil tanpa nomor telepon.
4. Kode penyiapan menuntut akses shell ke server; penginstal tanpa akses shell tidak dapat menyiapkan.
5. Kehilangan seluruh kode pemulihan **dan** kata sandi pemilik tidak dapat dipulihkan dari aplikasi;
   jalan satu-satunya akses basis data langsung.
