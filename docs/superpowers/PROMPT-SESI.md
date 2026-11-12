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

## MULAI DI SINI — keadaan per 12 November 2026 malam, sesudah autorun (WIB)

**Izin tetap pemilik (12 Nov):** Claude boleh deploy, merge, dan menjalankan langkah server untuk menyelesaikan proyek
tanpa bertanya (memori `owner-authorizes-deploy-merge`). Cadangan sebelum setiap migrasi; bukti keluaran untuk setiap klaim.
Pengklasifikasi tetap menolak perubahan pada tumpukan **tokoemas** (Caddy) → itu satu-satunya langkah server milik pemilik.

**Produksi sekarang:** image `moneychanger-app:47fb3ff7` (= `main` = `deploy/docker-vps`), 69 migrasi, cadangan terakhir
`20261112T105416Z`. **Uji pulih LULUS di produksi** (cadangan segar `20261112T104346Z`: 73/73 tabel, migrasi 69/69,
`EXIT=0`). `main` di-fast-forward; tidak ada workflow GitHub lagi (penerapan = bundle → VPS, `docs/deployment/vps.md`).

**Gerbang lokal terakhir (pada `47fb3ff`):** `Tests 1878 passed | 6 skipped (1884)`, tsc 0, build, Playwright `59 passed`.

**Dikerjakan autorun:** pengumuman publik hanya kolom pengunjung; temuan minor M4, M6, M8, M9 (uji RED→GREEN);
`affectedRows` satu helper. **Diperiksa ulang dan ternyata SUDAH ADA** (daftar lama basi; Claude sempat salah
menyebutnya celah ke pemilik): ambang USD 10.000 hanya pembelian + `>` (`b0fd469`), pernyataan nasabah di kwitansi
(`d512d11`), alur DTTOT/DPPSPM dari surel BI (`3032a5d` dst.), tanggal nota zona profil (`b7bf632`).
**Pelajaran:** sebelum menyebut sesuatu "belum ada", cari commit/kode-nya — catatan PROMPT-SESI/memori bisa basi.

**Langkah pemilik yang tersisa (urut):**
1. ~~**Caddy permanen**~~ — **SELESAI 12 Nov 2026 18.21 WIB** (pemilik menjalankan `tokoemas-caddy-permanent.sh`: ketiga situs
   200 sebelum/sesudah, `LULUS`; Caddy kini `--config /etc/caddy/certs/Caddyfile.mc`, `mc_edge=172.30.0.254`,
   `COMPOSE_FILE=…:compose.mc-edge.yaml`). Restart Caddy biasa tidak lagi menghilangkan situs ini.
2. **Cadangan di luar VPS (R2)** — Cloudflare dashboard → R2 → *Create bucket* `ibv-backup` (lokasi Asia-Pacific) →
   bucket itu → *Settings → Object lifecycle rules* → hapus objek sesudah 35 hari → R2 *Manage API tokens* → *Create
   token* "Object Read & Write", hanya bucket `ibv-backup` → salin Access Key ID, Secret, dan Account ID ke Claude
   (atau tulis langsung ke `~/moneychanger/deploy/vps/.env`: `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY`,
   `R2_ACCOUNT_ID`, `BACKUP_REMOTE=r2:ibv-backup`). Claude lalu memasang, menjalankan cadangan, dan uji pulih dari R2.
3. **Simpan kata sandi cadangan di luar VPS** (`BACKUP_CIPHER_PASS` di `.env` VPS) ke pengelola kata sandi pemilik.
   Tanpa itu, cadangan di R2 pun tidak bisa dibuka bila VPS mati.
4. **Isi Profil Perusahaan** (telepon, alamat, nomor izin + kode KUPVA, jadwal buka, WhatsApp, peta), **buat akun staf**,
   **Kurs → Atur urutan**, aktifkan kurs pertama, kas awal, satu-dua bon di mode **Latihan** sebelum nasabah sungguhan.

**Temuan minor yang sengaja dibiarkan:** M1 (dua penyaringan serentak → dua blokir OPEN; gagal-aman), M2 (gerbang blokir
di luar transaksi bon), M3 dan M5 (spec diam/ambigu — butuh keputusan pemilik), M7 (kinerja penyaringan massal).

## Keadaan sebelumnya — 12 November 2026 sore (WIB)

**Halaman publik "Paspor & cap" SELESAI DIBANGUN di cabang `deploy/docker-vps`** (`95625dd`…`b3741cf`). Rencana `plans/2026-11-12-halaman-publik-paspor.md`: irisan 1–4 tercentang,
irisan 5 tinggal butir terakhir (pemilik melihat → deploy produksi, keputusan pemilik).

**PRODUKSI SUDAH DIPERBARUI 12 Nov ±17.30 WIB** atas perintah pemilik ("okay lanjut aja"): pemilik menjalankan bundle +
`git merge --ff-only` di VPS; cadangan `moneychanger-20261112T103024Z.sql.zst.enc` diambil sebelum migrasi; image
`moneychanger-app:00a0788`; `Migrasi tercatat: 68 (baru diterapkan: 1)`; `DEPLOY-OK`. Diperiksa Claude lewat peramban:
`/` dan `/papan` tampil (1440 dan 390, tanpa gulir mendatar, 0 galat konsol), keadaan kosong jujur (belum ada kurs,
"Jam belum tersedia", ketentuan uang umum, judul "Periksa izin dan kontak kami" karena nomor izin kosong).
Langkah VPS (scp/ssh) ditolak pengklasifikasi untuk Claude → selalu beri pemilik `!` satu baris.

**Tugas sesi berikutnya:**
1. Pemilik mengisi Profil Perusahaan produksi (di back office): Data badan usaha (telepon (0263) 265-500, alamat,
   **nomor izin + kode KUPVA**), lalu Halaman publik: **jadwal buka** (Sen–Sab 09–17, Minggu tutup), **Nomor WhatsApp**
   0811-260-269, tautan peta, ketentuan uang sendiri bila ada (kosong = 3 ketentuan umum). Lalu aktifkan kurs pertama.
2. Pertanyaan untuk pemilik (lihat bawah), lalu lanjut ke pekerjaan berikutnya di daftar "belum dirancang".

**Keadaan terukur (dijalankan sesi ini, pada `b3741cf`):**
- Vitest `Test Files 247 passed | 1 skipped (248)`, `Tests 1869 passed | 6 skipped (1875)` (naik dari 1849: uji
  openingStatus, publicRates, viewModel, useCalculation, PublicPageSection; uji Home/PublicSections lama dihapus).
- `tsc --noEmit` keluar 0; `vite build` lulus; Playwright: `59 passed (1.2m)` (gerbang penuh lokal, bukan GitHub Actions — cabang ini tanpa workflow).
- Kinerja kirim tiket (CPU 4×, `node scripts/ukur-kinerja-publik.mjs`, hanya server lokal): 59–60 fps, frame terburuk
  17–33 ms, 0 long-animation-frame > 50 ms (3 putaran).
- Migrasi terakhir `0067_jadwal_buka_ketentuan_uang` — diterapkan di `moneychanger`, `mc_t_abcvalas`, `mc_t_visual`
  **dan produksi** (68 migrasi; sesudah `0068` urutan valuta, semuanya 69).
- Peragaan end-to-end lokal (`moneychanger`): profil diisi data uji lokal (izin `KEP-UJI-LOKAL/2026`, ketentuan uang
  berawalan "Uji lokal:"), permintaan `LNY-20261112-JGVX0D` (+ beberapa "Uji Kinerja Lokal") dari tiket publik,
  kurs SAR +10 diaktifkan lewat `activateBoardDrafts` (alasan "Uji lokal halaman publik: peristiwa KURS BARU") →
  cap KURS BARU tampil. `mc_t_visual`: uji e2e mengaktifkan SGD/MYR dan membuat permintaan "Uji E2E Paspor".

**Yang dibangun (ringkas):** `company_profile.openingSchedule` + `moneyRules` dan editornya; `shared/openingStatus.ts`;
`publicContent.profile` kini juga mengirim nama badan hukum, nomor izin, kode KUPVA, jadwal, zona, ketentuan;
`activeRates` publik dipersempit + `previous` (`server/publicRatePrevious.ts`); `client/src/pages/publik/` (halaman +
`/papan`); `Home.tsx`, `pages/home/*`, `PublicServicePlanner.tsx` dihapus (kanal email permintaan ikut hilang — desain
yang disetujui hanya WhatsApp/telepon). Label "Telepon kedua" → "Nomor WhatsApp".

**Urutan valuta (diputuskan pemilik 12 Nov: "yeah okay"):** kolom `currencies.boardOrder` (migrasi `0068`) + layar Kurs →
**Atur urutan** (ADMIN+, audit `CURRENCY_BOARD_ORDER_UPDATED`); papan staf, halaman publik, `/papan`, dan pesan WhatsApp
memakai `shared/currencyOrder.ts`. Diperagakan di `moneychanger` (USD, SAR di atas). Gerbang lokal sesudahnya:
`Tests 1873 passed | 6 skipped (1879)`, tsc 0, build, Playwright `59 passed`. **Sudah di produksi** 12 Nov ±17.40 WIB:
cadangan `20261112T104004Z`, image `moneychanger-app:b81c32e`, `Migrasi tercatat: 69 (baru diterapkan: 1)`, `DEPLOY-OK`;
halaman publik diperiksa (0 galat konsol). Pemilik tinggal mengatur urutan di Kurs → Atur urutan.

### Yang tidak perlu ditemukan ulang (halaman publik)
- CSS halaman publik **dibangkitkan**: `python3 scripts/publik-css.py docs/design/halaman-publik/rujukan-paspor-v3.html
  client/src/pages/publik/paspor.css`. Jangan sunting `paspor.css` tangan; tambahan aplikasi di `paspor-app.css`.
  Keyframes berawalan `pp-` karena Tailwind juga punya `spin`/`pulse` (CSS global setelah dimuat).
- `.paspor` memakai `overflow-x: clip`, bukan `hidden` (hidden mematikan kepala yang lengket di div).
- Jam berdetak hanya di `Header`/`PapanClock`. Render seluruh halaman tiap detik = ±60 ms per frame pada CPU 4×.
- Efek gerak harus menunggu `ready` (rootRef terpasang): wadah "memuat profil" tidak memegang ref; efek sekali-jalan
  yang jalan saat itu tidak pernah jalan lagi (sampul kedatangan dulu tidak pernah tampil).
- Uji e2e publik **jangan mengaktifkan kurs USD** di `mc_t_visual`: `pembalikan.spec` membuat bon USD 16.000 tanpa
  alasan selisih; kurs USD aktif memicu penjaga ±0,5%.
- Tautan "Lihat daftar berizin" → `https://www.bi.go.id/id/layanan/informasi-perizinan/default.aspx` (diperiksa
  lewat peramban; halaman KUPVA BI sendiri menautkannya). `curl` ke bi.go.id gagal dari sandbox, pakai peramban.
- Nama valuta di DB lokal masih Inggris lama ("United Arab Emirates Dirham"); produksi memakai `shared/worldCurrencies.ts`
  (Indonesia). Tampilan diuji dengan keduanya.

**Risiko residual jujur:**
- `service_requests` tidak menyimpan pecahan/kelompok yang dipilih di tiket (hanya valuta, arah, jumlah); petugas memilih
  kurs pecahan saat konfirmasi.
- `publicContent.announcements` masih mengirim baris pengumuman utuh (termasuk id pembuat); tidak dipersempit sesi ini.
- `paspor.css` 558 baris (> ~400) karena dibangkitkan dari rujukan; disengaja.
- Peta lokasi adalah gambar ilustrasi (nama jalan dari alamat), bukan peta sungguhan — sesuai rencana bagian §5.
- Risiko terbuka dari blok sebelumnya (Caddy tokoemas belum permanen, MX lama, R2, contoh kurs partner) **tetap**.

## Keadaan sebelumnya — 12 November 2026 malam (WIB), sebelum halaman publik dibangun

**Tugas sesi berikutnya:** irisan 1 dari `docs/superpowers/plans/2026-11-12-halaman-publik-paspor.md` (jadwal buka
terstruktur + ketentuan uang beserta penulisnya di Profil Perusahaan, `shared/openingStatus.ts`), lalu irisan 2–5.
Desain yang harus ditiru persis: `DESIGN.md` (bagian Halaman publik) + `docs/design/halaman-publik/rujukan-paspor-v3.html`
(buka di peramban; disetujui pemilik "oke greate job"). Teks: `docs/superpowers/specs/2026-11-12-halaman-publik-teks.md`.

**Keadaan terukur:**
- Cabang kerja `deploy/docker-vps` (`a939134`, sudah di-push) bertumpuk di atas `fix/siap-daring` (di-push). Keduanya
  BELUM digabung ke `main` (`main` tidak lagi memicu deploy apa pun).
- Migrasi terakhir `0066`. Lokal (moneychanger, mc_t_abcvalas, mc_t_visual) dan **produksi VPS** sama-sama 67 migrasi.
- Gerbang penuh terakhir (pada `6fe6211`): `Tests 1849 passed | 6 skipped (1855)`, tsc 0, build, Playwright `59 passed`.
  Sesudahnya hanya `server/hostSplit.ts` (+3 uji, lolos) dan dokumen; gerbang penuh **belum** dijalankan ulang.
- **Produksi LIVE** sejak ±15.10 WIB: `https://ibukotavalasindo.online` (publik) dan `https://backoffice.ibukotavalasindo.online`
  (staf), image `moneychanger-app:15eba25` di VPS 187.77.148.118 `~/moneychanger/deploy/vps`. Pemilik menyelesaikan wizard
  sendiri (1 akun pemilik). Belum ada kurs aktif/nasabah/transaksi — **ini produksi: tidak ada data uji di sana.**
- Rujukan hidup tiga arah + versi akhir: artifact https://claude.ai/artifact/MXhVNvDMD4MeLdq9dRnsuW; arsip putaran di
  `~/Projects/ClaudeCode/solvinc-designer/explorations/2026-11-12-moneychanger-publik/` (BRIEF, VERDICT, varian, tangkapan).

**Menunggu pemilik / risiko terbuka:**
1. Caddy tokoemas belum permanen: situs money changer hidup lewat `docker network connect` + `caddy reload` dengan
   `certs/Caddyfile.mc`. Restart kontainer Caddy biasa menghilangkan situs ini sampai reload diulang. Permanen = salin
   `deploy/vps/tokoemas-caddy-override.yaml` → `/opt/tokoemas/deploy/vps/compose.mc-edge.yaml`, tambah ke `COMPOSE_FILE`,
   `docker compose up -d --force-recreate caddy` **sesudah toko tutup** (pemilik yang menjalankan; pengklasifikasi menolak).
2. MX lama ibukotavalasindo.online menunjuk server mati; hapus + SPF `-all` + DMARC hanya bila pemilik bilang "hapus MX".
3. R2 (bucket dokumen + bucket cadangan, token terpisah) belum ada → cadangan hanya lokal 7 malam di VPS.
4. Contoh kiriman kurs partner pagi (WA/foto/Excel/surel) untuk langkah "isi draf dari kurs partner + margin" — belum diterima.
5. Profil Perusahaan produksi: pemilik diminta mengisi telepon (0263) 265-500, telepon kedua 0811-260-269, jam buka.

## Sesi berikutnya — keadaan per 12 November 2026 (arah desktop DICABUT; aplikasi tetap daring)

**Keputusan pengguna 12 November 2026 — jangan ditanyakan ulang:** seluruh arah "aplikasi desktop
luring Windows" (26 September 2026: paket portabel, satu PC server per toko, lisensi hibrida, ekspor
cabang bertanda tangan, pembersihan tenancy/R2/halaman publik) **DICABUT**. Aplikasi berjalan
**daring**, seperti tokoemas-superapp. Kode tenancy, R2, dan halaman publik dipertahankan.
Bentuknya (diputuskan hari yang sama): **satu perusahaan per deployment seperti tokoemas, siap
white-label** — lihat `docs/decisions/2026-11-12-daring-satu-perusahaan-white-label.md`. Langkah berikut:
audit kualitas, lalu "V2 di tempat" modul demi modul (bukan tulis ulang dari nol). Riwayat di bawah ini dibiarkan apa adanya;
setiap rujukan "sebelum/sesudah desktop" kini hanya berarti urutan waktu.

**Daftar "sisa pekerjaan sebelum aplikasi desktop" — SELURUHNYA SELESAI/DIPUTUSKAN:**

| Butir | Keadaan |
|---|---|
| A1–A6 | **SELESAI** 26 September (lihat riwayat git `c7dfcb8`…`7822f80`) |
| B1 bentuk baru uji isolasi tenant | **Diterima** apa adanya; terhapus bersama tenancy pada langkah 5 |
| B2 Temuan 3 — pemblokiran + percobaan transaksi | **SELESAI 28 September** `2e0691e`…`edcc276`, perbaikan reviu `42caa90` |
| B3 Temuan 7 — tinjauan berkala klasifikasi | **SELESAI 28 September** `b3e24b9`, `9c3645a` |
| B4 tanggal berakhir nasabah INACTIVE lama | **SELESAI 28 September** `57d1009` (tanpa migrasi) |
| B5 harga per seri uang kertas | Dibuang ke ROADMAP (calon sesudah desktop); cara resmi di Panduan A–Z §5.4 langkah 5a |
| C sub-proyek 3–9, produksi `0060`–`0062`, GitHub Action penerapan | **sengaja sesudah pindah** |

**Rencana:** `plans/2026-09-28-butir-b-sebelum-desktop.md` — **10 dari 10 tugas tercentang**,
dieksekusi langsung oleh sesi (tanpa subagen), satu commit per tugas, lalu satu reviu akhir segar
(model opus): 0 kritis, 5 penting (semua diperbaiki `42caa90` dengan uji RED→GREEN), 9 minor ditunda
(di bawah). Keenam butir Review Focus rencana dinyatakan LULUS oleh peninjau.

**Baseline uji (dijalankan 28 September sesudah `42caa90`):** `Test Files 234 passed (234)`,
`Tests 1793 passed | 2 skipped (1795)` — +10 berkas, +59 uji terhadap 1734, semuanya milik butir B.
`tsc --noEmit` keluar 0; `vite build` lulus. **Playwright `55 passed (1.0m)`** dijalankan pada
`6ad0dc6` (sebelum perbaikan reviu; perbaikan itu hanya menambah satu kotak ringkasan di
`Pemblokiran.tsx`, diperiksa mata). Migrasi terakhir **`0062`**, hanya di `moneychanger` dan
`mc_t_abcvalas`. **Antrean produksi: `0059`–`0062` belum diterapkan** (produksi di 60 migrasi).

**Peragaan end-to-end di `moneychanger` (28 September) — data uji yang sengaja ditinggalkan:**
- Blokir #1 nasabah 11 CONFIRMED + LTKM `LTKM-UJI/2026/001` + tembusan 28 Sep; 1 percobaan (USD 500).
- Blokir #2 nasabah 12 FALSE_POSITIVE (diputuskan lewat layar); blokir #4 nasabah 8 FALSE_POSITIVE
  (kunci `DTTOT:UJI-B2-001`), 1 percobaan KUASA (nasabah 10 dengan kuasa 8).
- Entri DTTOT sintetis `UJI-B2-001` (`sourceFileName = peragaan-butir-b.xlsx`) masih di daftar.
- 230 klasifikasi uji RENDAH bersumber "Data uji lokal peragaan butir B"; satu tinjauan disahkan
  (237 baris). Nasabah 9 dijadikan INACTIVE dan diisi tanggal berakhir 15 Agustus 2026 lewat layar.
- Skrip `scripts/peragaanButirB.mts` (subperintah `hitung`, `entri-uji`, `saring`, `bon`, `putus`,
  `lapor`, `klasifikasi-isi`, `berakhir`) memanggil penulis sungguhan; pakai untuk peragaan ulang.

**Keputusan rancangan butir B yang tidak boleh ditanyakan ulang:** blokir dibuka saat kecocokan,
ditutup hanya CONTROLLER ke atas; layar bon sengaja tidak memperingatkan lebih awal; tenggat 3 hari
kerja tidak dihitung (menunggu Temuan 6); tinjauan klasifikasi = pengesahan seluruh tabel dengan
snapshot; rumus IRA tidak berubah.

**Keputusan yang diambil sesi eksekusi (jangan "dikembalikan"):**
1. Ringkasan percobaan membagi dengan `quoteUnit` baris seperti bon (tanpa itu JPY per 100 tercatat
   100 kali lipat); kurs per baris tidak disimpan (spec diperbarui).
2. Id penyaringan sesudah penyaringan massal = id terbesar per nasabah, bukan `screenedAt = ?`
   (kolom TIMESTAMP tanpa pecahan detik tidak pernah sama dengan instan JS bermilidetik).
3. Semesta negara klasifikasi tidak memuat nasabah demo; pengisian tanggal berakhir menolak nasabah
   demo/historis.
4. Keputusan CONFIRMED menjadikan nasabah HIGH/RESTRICTED (INACTIVE tetap) dan keputusan risiko
   tinggi kembali BELUM — sama dengan centang saat nasabah dibuat (temuan reviu I3).
5. Centang DTTOT/DPPSPM tidak dapat dicabut lewat Edit nasabah selama ada blokir CONFIRMED (I4).
6. Kecocokan pada **pemilik manfaat** tidak menahan bon nasabahnya — spec hanya menyebut nasabah dan
   kuasa/wakil. Bila ini keliru, nasabah ber-BO cocok tetap bertransaksi sampai Controller bertindak.
7. Hitungan "N/9 KONTROL SIAP" pada Kesiapan Operasional kini dihitung dari kartunya (sebelumnya
   kartu IRA pun tidak pernah terhitung).

**Sembilan temuan minor reviu akhir yang DITUNDA (belum dikerjakan):**
- M1 dua penyaringan serentak dapat membuka dua blokir OPEN untuk satu nasabah (gagal-aman).
- M2 gerbang blokir di luar transaksi basis data bon — jendela satu bon.
- M3 FALSE_POSITIVE atas blokir PENGISIAN_AWAL membiarkan centang lama `dttotPpsdmMatch` (spec diam).
- ~~M4 `biCopySentAt` saat konfirmasi tanpa periksa masa depan di server~~ — **SELESAI 12 Nov 2026** (uji RED→GREEN).
- M5 tinjauan klasifikasi jatuh tempo pada hari jatuh temponya; spec berbunyi sehari sesudahnya.
- ~~M6 kartu Kesiapan menampilkan "hanya terlihat oleh Controller" untuk galat apa pun~~ — **SELESAI 12 Nov 2026** (hanya FORBIDDEN).
- M7 penyaringan massal membaca seluruh riwayat penyaringan nasabah cocok hanya demi id terbesar.
- ~~M8 `recordRelationshipEnd` periksa-lalu-tulis tidak atomik~~ — **SELESAI 12 Nov 2026** (tulis bersyarat + `affectedRows`, uji balapan).
- ~~M9 `referenceCode` tidak dinormalkan pada kunci kecocokan~~ — **SELESAI 12 Nov 2026**: huruf besar tanpa spasi; kunci lama
  berhuruf kecil yang tersimpan dibesarkan saat dibaca (`parseMatchKeys`), keputusan FALSE_POSITIVE lama tetap dikenali.

**Paket "Siap daring" SELESAI 12 November** di cabang `fix/siap-daring` (11 commit di atas `main`, sudah
di-push; BELUM digabung): U1–U5 dan K1–K4 audit diperbaiki + kebuntuan pool `writeAudit`, sisa Manus,
judul tab white-label, kirim/tinjau bersyarat status, pelunasan ganda. Gerbang penuh pada `43b1e2c`:
`Test Files 240 passed | 1 skipped (241)`, `Tests 1819 passed | 6 skipped (1825)`, tsc 0, build lulus,
Playwright `55 passed`; sesudah `6c2fc8f` (server saja): `Tests 1821 passed | 6 skipped (1827)`, tsc 0.
Uji suite memerlukan `.env` dimuat (`set -a; . ./.env; set +a`).

**Server lama 187.53.128.14 MATI** (kunci host SSH berganti; produksinya kosong: 0 nasabah/bon/kurs).
Rumah baru: VPS tokoemas 187.77.148.118 (4 vCPU, 15 GB, ±12 GB bebas) sebagai tumpukan Docker sendiri di
belakang Caddy tokoemas; `ibukotavalasindo.online` masih menunjuk IP lama. **Push `main` memicu
`deploy.yml` ke server mati** — tulis ulang deploy sebelum menggabung.

**Keputusan 12 November** (`docs/decisions/2026-11-12-pembalikan-bon-dan-pembulatan.md`): pembalikan bon
COMPLETED oleh CONTROLLER ke atas; tanpa fitur kembalian, total sulit dibulatkan ke atas (bawaan Rp 100).
**Celah regulasi (diperiksa ulang 12 November, termasuk surel BI di kotak masuk pemilik):** — **SEMUANYA SUDAH DIBANGUN 12 Nov**
(diperiksa di kode + uji malam itu): (a) `b0fd469`, (b) `d512d11`, (c) `3032a5d`/`b57603f`/`ba7bdb1`, DPPSPM `0707109`, (d) `ba7bdb1`.
Daftar di bawah ini riwayat, bukan pekerjaan terbuka.
(a) ambang underlying **sudah USD 10.000** di aplikasi (benar, PADG 15/2026 sejak 1 Jul 2026), TETAPI akumulasi
bulanan di `createTransaction` menjumlah BELI dan JUAL — aturan hanya menghitung pembelian valas oleh nasabah
(operasi SELL kita); juga "di atas" ambang = `>` bukan `>=`;
(b) surat pernyataan nasabah "pembelian bulan ini belum melebihi ambang" untuk pembelian di bawah ambang belum ada;
(c) alur DTTOT per surel BI (±tiap 1–3 bulan): buat Laporan Nihil / Berita Acara Pemblokiran / Berita Acara
Pembukaan Pemblokiran dari formulir BI, LTKM ≤ 3 hari kerja bila cocok, dan catat 4 pengiriman (fisik + surel
Densus 88, tembusan PPATK, tembusan pengawas BI, unggah MS Forms BI) — aplikasi baru punya saring + blokir;
(d) uji pengimpor DTTOT terhadap daftar terbaru BI (P-25, Oktober 2026). Rincian: memori `kupva-regulation-2026`.

**Selesai 12 November (sore), cabang `fix/siap-daring`:** ambang underlying hanya pembelian nasabah & `>`
USD 10.000 (`b0fd469`); kalimat kwitansi (`d512d11`); pembulatan Rp 100 (`f74f07c`); pembalikan bon + migrasi
`0063` (`4d598d5`, perbaikan reviu `fb7de4b`); panduan & skema (`13b7436`). Gerbang sesudah `fb7de4b`:
`Tests 1834 passed | 6 skipped (1840)`, tsc 0, build, Playwright `56 passed`. Migrasi `0063` hanya di
moneychanger, mc_t_abcvalas, mc_t_visual.

**Laporan DTTOT ke Densus 88 SELESAI 12 November** (`3032a5d`, migrasi `0064`): Kepatuhan > Laporan DTTOT —
catat surel BI, saring, cetak Laporan Nihil / Laporan Pemblokiran + Berita Acara (format Lampiran I–III Pedoman
BI), lima pengiriman. Gerbang: `Tests 1840 passed | 6 skipped (1846)`, tsc 0, build, Playwright `57 passed`.
Lampiran surel BI 15 Okt 2026 diunduh lewat Chrome atas permintaan pemilik (~/Downloads): pengimpor terbukti pada
daftar P-25 (530 entri, cocok persis dengan berkas), dan Laporan + Berita Acara Pembukaan Pemblokiran dibangun dari
formulir "Lamp 2" (lihat rancangan DTTOT bagian "lampiran BI diunduh"). Daftar P-25 asli kini termuat di DB lokal
`moneychanger` (menggantikan 7 entri DTTOT uji). Gerbang sesudah `ba7bdb1`: `Tests 1846 passed | 6 skipped (1852)`, tsc 0, build,
Playwright `58 passed`.
**Penyesuaian surat (12 Nov sore, migrasi `0065`):** bentuk surat disamakan dengan laporan nihil pemilik 20 April
2026 dan surat penghapusan 2020 (Google Drive pemilik): rujukan surat Densus + tanggal + perihal, alamat Trunojoyo,
tembusan BI + PPATK, kota dari isian. Laporan penghapusan nihil ditolak selama ada blokir OPEN yang namanya sudah
tidak ada di daftar. `0065` hanya di moneychanger, mc_t_abcvalas, mc_t_visual. Gerbang: `Tests 1844 passed | 6 skipped (1850)` (+4 uji DTTOT baru), tsc 0, build; spec Playwright `laporanDttot` lolos.

**Laporan DPPSPM ke PPATK SELESAI** (migrasi `0066`, layar yang sama "Laporan DTTOT & DPPSPM"; bentuk dari laporan nihil
pemilik 22 April 2025). Berita acara DPPSPM belum punya contoh resmi PPATK (lihat rancangan). Gerbang sesudah `0707109`: `Tests 1848 passed | 6 skipped
(1854)`, tsc 0, build, Playwright `59 passed`. Migrasi `0066` hanya di tiga DB lokal.

**Paket Docker untuk VPS tokoemas SELESAI di cabang `deploy/docker-vps`** (bertumpuk di atas `fix/siap-daring`):
`Dockerfile`, `deploy/vps/` (compose MySQL 8.4 + `web` + cadangan terenkripsi harian + uji pulih), `scripts/migrate.mjs`
(migrator drizzle-orm tanpa drizzle-kit), `TRUST_PROXY`, Vite dimuat malas. Gladi di Mac lulus (lihat
`docs/deployment/vps.md` §Gladi). `deploy.sh` + `deploy.yml` (pm2, server mati) dihapus — push ke `main` tidak lagi deploy.
**LIVE 12 Nov 2026 (±15.10 WIB)** dari cabang `deploy/docker-vps` (`bd2cb4f`+) di VPS tokoemas, `~/moneychanger`:
`https://ibukotavalasindo.online` (publik, kurs nasabah) dan `https://backoffice.ibukotavalasindo.online` (staf).
Pemilik menyelesaikan wizard penyiapan sendiri (1 akun pemilik, perusahaan "Ibukota Valasindo"); 67 migrasi; belum ada
kurs aktif, nasabah, maupun transaksi. Cloudflare & Caddy: lihat `docs/deployment/vps.md`.
**Desain halaman publik DISETUJUI 12 Nov ("oke greate job"):** arah "Paspor & cap" (C), dicatat di `DESIGN.md` +
rujukan hidup `docs/design/halaman-publik/rujukan-paspor-v3.html` (artifact https://claude.ai/artifact/MXhVNvDMD4MeLdq9dRnsuW).
Rencana bangun: `docs/superpowers/plans/2026-11-12-halaman-publik-paspor.md` (irisan 1–5, belum dimulai).
**Belum:** (a) Caddy tokoemas permanen (override `compose.mc-edge.yaml` + `--force-recreate caddy`, SESUDAH toko tutup;
sampai itu restart Caddy biasa menghilangkan situs money changer); (b) MX lama ke server mati (tanya pemilik); (c) R2
dokumen + cadangan (cadangan sementara hanya lokal 7 malam); (d) desain ulang halaman publik (solvinc-design).

**Berikutnya (urut, diperbarui 12 Nov malam):** (1) halaman publik Paspor & cap ke aplikasi (rencana
`2026-11-12-halaman-publik-paspor.md`, irisan 1–5); (2) langkah "kurs partner + margin" (draf saja, aktivasi tetap manual);
(3) uji coba berdampingan dengan staf; (4) penyederhanaan layar Kasir & transaksi (sub-proyek 4); (5) CSP `script-src`.

---

### Catatan penutupan Sub-proyek 2 (SELESAI, 15 dari 15 tugas)

**Sub-proyek 2 (login, penyiapan awal, kode pemulihan, halaman kurs publik, pemilih palet)
DIKERJAKAN 26 September 2026** — satu sesi langsung, tanpa subagen, satu commit per tugas:
`f790379` (T1 skema + `0060`/`0061`), `e2daa9b` (T2 kode rahasia + `setup-code`), `103f812` (T3
pembatas), `13f38f7` (T4 IP asli + login dibatasi), `2d718fa` (T5 kode pemulihan), `6bfdc92` (T6
`setup.complete`), `fe0384c` (T7 profil publik + penulis), `7492cc9` (T8 buang bootstrap/OAuth),
`88caa21` (T9 layar masuk/pulihkan/ubah sandi), `ee20162` (T10 wizard), `746b2dd` (T11 ajakan + menu),
`07c25de` (T12 pengguna & peran), `476f2e9` (T13 Tampilan + Halaman publik), `8d06e7f` (T14 halaman
depan), `ca315b2` (T15 sebagian: peragaan, Playwright, dokumentasi), `b856c0b` (perbaikan reviu akhir).
Rencana: `plans/2026-09-26-login-penyiapan-halaman-publik.md` — **15 dari 15 tugas tercentang.**
Tugas 15 Step 3 diperagakan **pengguna sendiri** di `moneychanger` (port 3000) sebagai
`test-shareholder`: ajakan "belum punya kode pemulihan" tampil, 8 kode dibuat (17:03), pemulihan
dengan satu kode berhasil (17:07, `OWNER_RECOVERY_CODE_USED`), kode dibuat ulang (17:08), ajakan hilang,
menu pengguna memuat "Kode pemulihan". Menu Controller tanpa butir itu dibuktikan uji
`userMenuItems`, bukan mata (pengguna tidak memegang sandi `test-controller`).
**Catatan dari percobaan pengguna:** ia mula-mula mengetik peran (`SHAREHOLDER`) pada kolom "Username
pemilik" dan mendapat pesan gagal yang sama dengan kode salah — disengaja (tidak membocorkan akun),
tetapi labelnya membingungkan; petunjuk "nama yang Anda ketik saat masuk" belum ditambahkan.

**Sesudah pemeriksaan pengguna, pola `ListDetailLayout` diubah (`0d1a039`)**: panel detail kini
`Sheet` Radix mengambang dari kanan, bukan kolom kedua kisi — pengguna menilai panel samping
"mixed with div … destroying the layout". Berlaku untuk Pengguna & peran dan Galeri pola; Esc di dialog
yang dibuka dari panel hanya menutup dialog itu. Diperiksa Playwright tanpa kepala pada 1280 dan 1920:
lebar tabel tidak berubah saat baris dipilih.

**Tugas berikutnya: Sub-proyek 3** (penilaian risiko berbahasa manusia + penjelasan AI) — belum punya
spec maupun rencana; mulai dengan Prompt A. Sebelum itu pengguna perlu meninjau penyimpangan 4 di bawah
dan memutuskan penerapan produksi `0060`/`0061`.

**Tujuh penyimpangan dari rencana yang sengaja diambil — jangan "dikembalikan":**
1. `server/shareholderDashboardUserManagement.test.ts` memaku ekspresi lama `UserManagement.tsx`
   (rencana tidak menyebutnya); pakuannya diganti ke `initialRole = requestedRole === "ADMIN" ? "ADMIN" : "STAFF"`,
   perilaku sama.
2. `PublicPageSection` `onSave` bertipe `Required<PublicPageInput>` (zod `updatePublicPage` menuntut
   `string | null`, bukan opsional).
3. Uji `PublicRateTable` mengharapkan **`Rp 16,290`** (koma), bukan `16.290`: `formatIdrDecimal` proyek
   sengaja memakai pemisah koma di seluruh aplikasi. Pemformatnya tidak diubah.
4. **`server/tenantIsolation.live.test.ts` diubah bentuknya.** Ia menuntut `mc_t_abcvalas` tanpa akun;
   rencana justru menjadikannya basis data peragaan wizard. Data peragaan tidak dihapus; uji kini
   memaku `SELECT DATABASE()` per ikatan dan hitungan = sambungan langsung. Dibuktikan tetap gagal
   bila kedua URL menunjuk database yang sama. **Pengguna belum meninjau perubahan ini.**
5. Halaman depan tergulir mendatar **206 px pada lebar 390** (kolom grid `main` ber-`min-width: auto`,
   tabel `min-w-[36rem]` melebarkannya). `main` kini `grid-cols-1`. Uji Playwright 390 **tidak dapat**
   menangkapnya karena `mc_t_visual` tanpa kurs aktif; buktinya peragaan port 3200.
6. `PublicPageSection` semula dipasang ulang dengan kunci `updatedAt` — menyimpan Tampilan atau Data
   badan usaha **membuang isian halaman publik yang belum disimpan**. Kini `publicPageKey` (isian
   halaman publik tersimpan saja), +2 uji (reviu akhir, `b856c0b`).
7. Peragaan peramban dijalankan dengan **skrip Playwright tanpa kepala** (ekstensi Chrome terputus di
   tengah sesi); kurs uji diaktifkan lewat prosedur papan kurs (`rates.saveBoardDrafts` →
   `rates.activateBoard`, alasan ≥ 10 karakter) sebagai `pemilik.abc`, bukan klik di kisi.

**Peragaan end-to-end di `mc_t_abcvalas` (port 3200) SUDAH dijalankan:** `/` → `/siapkan`; kode
penyiapan diketik huruf kecil berspasi diterima; wizard → 8 kode, unduhan `.txt` memuat kedelapannya
dan nama usaha (berkasnya dihapus); `/operasional` tanpa ajakan (sisa 8); `/siapkan` lagi → "sudah
disiapkan"; `setup-code` lagi ditolak (keluar 1). `/pulihkan` dengan kode 1 → masuk; kode yang sama
lagi ditolak. Enam kata sandi salah → "Coba lagi dalam 30 detik." sebagai `alert`. Zamrud dipilih,
`#777777` ditolak menyebut **4,48:1**, shell langsung Zamrud. Halaman publik diisi (telepon kedua,
jam buka, peta, 2 FAQ, peringatan) dan satu kurs USD uji diaktifkan; `/` pada 1280/1440/1920/390:
judul "Kurs ABC Valas hari ini", tautan `tel:` keduanya, FAQ dan peringatan milik perusahaan, luapan
**0** (sesudah perbaikan 5). Sakelar publik mati → `/` membuka `/login`; dinyalakan lagi. SQL:
`setupCompletedAt` terisi, `setupCodeHash` NULL, sisa kode 7, audit `INSTALLATION_SETUP_COMPLETED` 1,
`OWNER_RECOVERY_CODE_USED` 1, `COMPANY_APPEARANCE_UPDATED` 1, `COMPANY_PUBLIC_PAGE_UPDATED` 3.
**Data peragaan ini sengaja ditinggalkan** (akun `pemilik.abc`, profil "PT ABC Valas Uji", kurs USD
16.200/16.290) — jangan dibersihkan. Kata sandi uji `pemilik.abc` **tidak** dicatat di repo; bila
perlu masuk lagi, pakai `/pulihkan` dengan satu dari tujuh kode sisa, atau reset lewat basis data lokal.
`mc_t_abcvalas` kini juga berisi akun pengembangan `test-*` (dibuat server pengembangan port 3200).

**Keputusan pengguna 26 September 2026 — jangan ditanyakan ulang:**
1. Wizard penyiapan dijaga **kode penyiapan sekali pakai** dari `node scripts/tenant.mjs setup-code`
   (bukan dari log pm2), berlaku 24 jam, disimpan hash.
2. **Autentikasi ulang tindakan sensitif ditunda** — dirancang bersama cara masuk SOLVINC.
3. Halaman publik: bagian kontak/jam/peta yang kosong **disembunyikan**; FAQ dan peringatan penipuan
   memakai teks produk netral. Migrasi **tidak** menyalin teks Ibukota Valasindo ke basis data mana pun.
4. Eksekusi **langsung oleh sesi, tanpa subagen** (Prompt B / superpowers:executing-plans).

**Koreksi terhadap spec program yang sudah dikunci di rencana — jangan "dikembalikan":**
`setupCompletedAt` **tidak** di `company_profile` melainkan tabel satu baris baru `app_installation`,
karena instalasi baru (dan mungkin produksi sesudah reset) **tidak punya baris profil** — diperiksa:
`mc_t_abcvalas` 0 baris profil, 0 Pemegang Saham. `setupRequired` dibaca dari
`publicContent.profile`, bukan `auth.me`. Langkah wizard **tidak** dipotret Playwright karena
`mc_t_visual` harus ditandai sudah disiapkan.


**Seluruh paket peta jalan asli sudah selesai:** K1, B, D, C, E, F1, F2, G, H, I, J (J1+J2), K2,
K3, L, dan **M**. Dua belas temuan pemeriksaan BI 2026 sudah tertutup; pada
`specs/2026-09-09-pbi-10-2024-temuan-awal.md` (PBI No. 10 Tahun 2024) Temuan 1 dan 2 tertutup oleh
Paket L, dan **Temuan 4 tertutup oleh Paket M** dengan premis yang sudah dikoreksi.

**Sub-proyek 1 (Fondasi Desain) selesai 16 September 2026.** Spec program
`specs/2026-09-12-desain-ulang-antarmuka-design.md` **diperbarui** oleh
`specs/2026-09-13-tema-konter-tebal-dan-papan-kurs-design.md` (`8250e87`).

**Sub-proyek 1B (Papan Kurs) SELESAI 21 September 2026** — seluruh 14 tugas tercentang pada
`plans/2026-09-16-papan-kurs.md`, satu commit per tugas, dikerjakan langsung tanpa subagen.
Tugas 1–4 (`2f70aa3`, `5f01e5f`, `28855c9`, `dde48d0`) pada sesi 16 September; Tugas 5–14 pada sesi
ini: `7cbdea5` (rates.board + riwayat WIB), `1da0680` (simpan/aktifkan/buang draf), `b677415`
(salin kurs & saran BI), `6acb039` (toleransi sebagai pengaturan), `a41fcb9` (rujukan per baris
pecahan), `fb6f9f0` (label kelompok pada kurs publik), `d7aa640` (kisi papan), `0d92b02` (halaman
`/operasional/kurs`), `5f25cf1` (harga bon dari papan), `884f45c` (peragaan + dokumentasi).

**Empat penyimpangan dari rencana yang sengaja diambil — jangan "dikembalikan" ke bunyi rencana:**

1. **`rates.pricing` (`staffProcedure`) ditambahkan**, tidak ada di rencana. Rencana menyuruh
   formulir bon membaca `rates.board` (ADMIN) dan `settings.reviewThreshold` (ADMIN); kasir STAFF
   akan melihat papan kosong dan harga tidak pernah terisi. `readBoardPricing`/`pricingCells` di
   `server/rateBoard.ts` mengembalikan **hanya kurs berlaku** (draf dan referensi BI dikosongkan,
   bukan sekadar disembunyikan di layar) ditambah kelompok dan toleransi.
2. **Satuan kuotasi disamakan di dua tempat.** Kurs papan boleh per 100 unit (JPY dari BI begitu),
   sementara baris bon selalu per 1 unit dan formulirnya tidak punya kolom untuk mengubahnya.
   `suggestDenominationRate` (klien) dan `resolveDenominationReference` (server) mengalikan
   `× satuan baris ÷ satuan papan`. Tanpa ini harga JPY terisi **100× salah** dan selisihnya ~99%.
3. **Dua angka pada rencana memang salah hitung, bukan kodenya:** 195/16290 × 100 = **1,1971%**
   (rencana menulis 1,1970) dan nilai lama yang dicoret pada kisi tampil **`16.290`** dalam format
   id-ID (rencana menulis `16290`). Ujinya disesuaikan ke angka yang benar, kodenya tidak.
4. **Riwayat hari ini membaca kurs berstatus apa pun** yang `approvedAt`-nya hari ini, bukan hanya
   yang masih ACTIVE. Ketahuan saat peragaan: batch pagi menyusut 10 → 7 begitu kurs siang
   menggantikan sebagiannya. `approvedAt` kolom `datetime` (jam UTC), jadi dibandingkan langsung
   terhadap `startOfOperationalDay` tanpa normalisasi.

**Peragaan end-to-end kedelapan skenario spec §B6 SUDAH dijalankan** pada `moneychanger` lokal
(21 September, pengguna masuk sendiri sebagai Pemegang Saham; Claude tidak pernah mengetik sandi
pengembangan). Kelompok USD 100 · 50 · 5–20 dibuat lewat dialog; aktivasi pagi satu batch 10 kurs;
aktivasi siang hanya menyentuh kelompoknya; aktivasi basi ditolak **utuh** dengan pesan menyebut
"USD · 5–20"; tumpang tindih pecahan ditolak menyebut kedua label; bon JUAL tepat kurs papan lolos
tanpa tanda tinjauan dan **kedua kaki kas bergerak**; bon 1,29% dari papan ditolak tanpa alasan,
tersimpan dengan alasan dan bertanda `SELISIH_KURS_MELEBIHI_TOLERANSI`; satu bon memuat dua rujukan
berbeda (USD 100 → kelompok, USD 1 → Pecahan lain); kurs yang diaktifkan di tengah pengisian membuat
`referenceRateSnapshot` mengikuti **kurs saat simpan**. Bon uji `E2E-PK-B01`–`B04` dan `E2E-PK-J01`
**sengaja ditinggalkan** — jangan dibersihkan.

**Verifikasi peramban** pada lebar **1280, 1440, dan 1920**: tanpa gulir mendatar, judul
"Kurs berapa hari ini?", ↑/↓ dan Tab/Shift+Tab berpindah sel, sorot baris + kolom terlihat, keadaan
kosong penyaring "Berubah" benar, panel "Referensi & pengaturan" memuat keenam bagiannya, konsol
bersih. **Tingginya tidak pernah mencapai 800/900/1080** — panel peramban memotong viewport ke
**603 px**; keadaan memuat dan galat halaman juga **tidak pernah dipicu** di peramban.

**Aturan kurs yang tetap berlaku dan sudah ditegakkan kode:** aktivasi **manual** dengan alasan
**≥ 10 karakter**, diperiksa **sebelum kueri apa pun**. Tidak ada satu pun jalur kode yang
mengaktifkan kurs tanpa alasan manusia. RETIRE-nya **per pasangan (valuta, kelompok)**: mengubah
harga satu kelompok tidak mencabut kurs tingkat valuta.

**Keputusan pengguna 13 September 2026 — jangan ditanyakan ulang** (lengkapnya di spec 2026-09-13):
tampilan netral abu-abu ditolak (*"korporat sekali seperti SIPUKA"*; empat tema berganti warna pada
tata letak yang sama juga ditolak: *"semuanya terlihat sama, seperti buatan AI"*); gaya **Konter
Tebal** intensitas **B**; **enam palet** siap pakai (Marun bawaan, Zamrud, Samudra, Terakota, Anggur,
Arang) ditambah warna utama sendiri **hanya bila lolos kontras** — pemilihnya dibangun di
**sub-proyek 2** bersama kolom `themePalette`/`accentColor`. Urutan program **1 → 1B → 2 → … → 9**;
kurs sudah keluar dari sub-proyek 5 dan selesai di 1B.

**Biaya subagen jauh lebih besar daripada perkiraan pengguna** (16 September: *"can we stop using
agent because its burnt token so much?"*). **Kerjakan langsung, tanpa subagen**, kecuali pengguna
meminta sebaliknya. Seluruh 14 tugas dikerjakan begitu dan memang cukup.

**Reviu akhir cabang Fondasi Desain TIDAK pernah selesai** (reviewer mati karena batas pemakaian
mingguan). Yang **belum** diperiksa siapa pun secara menyeluruh: mutu kode Fondasi Desain Tugas 1–7
dan pemeriksaan arsitektur/keamanan lintas berkas.

**Sub-proyek 1B DIREVIU KODE 26 September 2026** (oleh sesi langsung, fokus jalur tulis server dan
formulir bon; bukan reviu arsitektur/keamanan menyeluruh). Satu temuan diperbaiki, empat dibiarkan:
1. **DIPERBAIKI `6d4c567`:** `activateOperationalRateIds` memeriksa status DRAFT *sebelum* transaksi;
   draf yang dibuang/diganti/diaktifkan admin lain di antaranya membuat kurs lama di-RETIRE sementara
   aktivasi mengenai nol baris — valuta tertinggal tanpa kurs berlaku. Kini dibaca ulang
   `FOR UPDATE` di dalam transaksi (`assertDraftsStillPending`), +3 uji.
2. **Terbuka:** formulir bon menilai toleransi dari `rates.pricing` yang mungkin basi; bila server
   (kurs saat simpan) menemukan selisih yang tidak terlihat klien, bon ditolak tetapi kolom alasan
   tidak muncul sampai jendela difokus ulang. Perbaikan kecil: `invalidate` `rates.pricing` saat
   `transactions.create` gagal.
3. **Terbuka:** `saveRateTier` dengan `tierId` tidak memeriksa bahwa kelompok itu milik `currencyId`
   masukan, sehingga pemeriksaan tumpang tindih dijalankan terhadap valuta yang salah (ADMIN saja).
4. **Terbuka:** draf milik kelompok yang dinonaktifkan tetap DRAFT dan tidak terlihat di papan;
   "Buang draf" ikut menghitungnya. `activateBoard` tanpa `rateIds` akan mengaktifkannya (UI selalu
   mengirim `rateIds`).
5. **Terbuka:** `saveRateTier` membaca id kelompok baru lewat "id terbesar untuk valuta itu", bukan
   `$returningId()` — dapat salah pada dua penyimpanan bersamaan.

**Prompt untuk sesi berikutnya — merancang sub-proyek 3:** pakai **Prompt A** di atas dengan
paket = "Sub-proyek 3 — Penilaian risiko berbahasa manusia + penjelasan AI" (spec program
`specs/2026-09-12-desain-ulang-antarmuka-design.md`). Baseline uji:
`Test Files 215 passed (215)`, `Tests 1706 passed | 2 skipped (1708)`.

**Produksi DITERAPKAN 26 September 2026 atas permintaan pengguna: kode `6d4c567`, 60 migrasi
(`0059` masuk), papan kurs 1B kini live.** Urutan: cadangan
`backups/sebelum-0059-20260926-083910.sql.gz` di server **dibuktikan dapat dipulihkan** (66 tabel →
66 tabel, 59 migrasi, 1 pengguna; dipulihkan ke `mc_restore_probe` lokal lalu dihapus — aman karena
produksi berisi 0 nasabah, 0 transaksi, 0 kurs), lalu `bash deploy.sh` (cadangan sendiri, pull,
migrate, build, restart). Diukur sesudahnya: jurnal **60**, tabel `rate_tiers` ada, 4 kolom baru ada,
pm2 `online`, `/`, `/login`, `/operasional/kurs`, `rates.activeRates` menjawab **200**. Baris
`ECONNREFUSED` di `ibv-backoffice-error.log` bertanggal 11 September (reset), bukan dari penerapan ini.
`appuser` produksi hanya berhak atas `moneychanger` dan `sudo` meminta sandi, jadi **bukti pemulihan
tidak dapat dijalankan di server** — hanya lokal. Produksi berisi **0 baris `company_profile`**
(premis `app_installation` sub-proyek 2 terbukti). Antrean migrasi produksi kini **`0060`, `0061`**
— sub-proyek 2 sudah membuatnya, **belum diterapkan**. Keadaan produksi sebelum hari ini:

**Produksi sudah diterapkan dan direset (11–12 September 2026).** Seluruh tabel produksi dihapus atas
permintaan pengguna ("FRESHSTART"), lalu `deploy.sh` dijalankan manual: produksi kini `724de6b`,
**59 migrasi** (diukur sesudah penerapan), `pm2` `online`, `https://ibukotavalasindo.online` menjawab
200. Cadangan sebelum reset: `backups/sebelum-reset-20260911-125637.sql.gz` di server (36 tabel,
*Dump completed*; **pemulihannya tidak dapat dibuktikan** — lihat jebakan di bawah). Pemegang Saham
awal dibuat dari `INITIAL_SHAREHOLDER_*` dan pengguna sudah berhasil masuk. **Masih milik pengguna:**
impor ulang daftar DTTOT/DPPSPM, mengisi ulang Profil Perusahaan, menghapus baris
`INITIAL_SHAREHOLDER_PASSWORD` dari `.env` produksi, dan mencabut aturan izin
`Bash(ssh -o BatchMode=yes -o ConnectTimeout=10 deploy@187.53.128.14:*)`. Temuan 3 tetap menunggu
keputusan pengguna.

**Baseline uji terakhir yang benar-benar dijalankan: 26 September 2026 pada `0d1a039`** (dengan
`.env` dan `TENANT_TEST_SECONDARY_URL` termuat): `Test Files 215 passed (215)`,
`Tests 1706 passed | 2 skipped (1708)`, tanpa `FAIL` (+1 uji pola panel mengambang; sebelumnya
1705 pada `b856c0b`); `tsc --noEmit` keluar 0 tanpa keluaran;
`vite build` `✓ built`. Selisih terhadap baseline sesi (189 / 1606): **+26 berkas, +99 uji** —
+97 persis ramalan rencana (1603 → 1700) ditambah +2 uji `publicPageKey` dari reviu akhir; Tugas 8
membuang `internalAuth.bootstrap.test.ts` (1 berkas, 2 uji) dan menambah `legacyAuthRemoval.test.ts`
(1 berkas, 2 uji). Tiap tugas mendarat tepat di ramalan+3. **Playwright dijalankan** (juga sesudah
`0d1a039`): `55 passed`
(42 `fondasi.spec.ts` tanpa perubahan baseline + 13 `masuk.spec.ts`, 12 baseline baru yang sudah
dilihat). `pnpm audit` **tidak dijalankan** — dependensi tidak bertambah.

**Baseline sebelum sub-proyek 2, pada `f7b3406`:** `189 passed`, `1603 passed | 2 skipped`
(1606 sesudah `6d4c567`).

**Baseline uji terakhir yang benar-benar dijalankan, pada `884f45c`** (21 September 2026, dengan
`.env` dan `TENANT_TEST_SECONDARY_URL` termuat): `Test Files 189 passed (189)`,
`Tests 1603 passed | 2 skipped (1605)`. Selisih terhadap baseline `dde48d0`
(`181` berkas / `1543 lulus | 2 dilewati`) adalah **+8 berkas, +60 uji**, seluruhnya dari sub-proyek
1B Tugas 5–13: `server/rateBoardHistory.test.ts` (+3), `server/rateBoardDrafts.test.ts` (+11, tiga
tugas menambahinya), `shared/rateDeviation.test.ts` (+8), `server/rateDeviationReview.test.ts` (+12),
`shared/rateBoard.test.ts` (+10), `client/src/pages/rates/RateBoardGrid.test.tsx` (+6),
`client/src/pages/rates/RateBoardFooter.test.tsx` (+4), `client/src/pages/rates/tierPricing.test.ts`
(+5), ditambah satu uji baru pada `server/publicRates.test.ts`. Tidak ada uji lama yang dibuang;
`server/reviewSettings.test.ts` **disunting** (bukan ditambah) untuk kolom toleransi baru.
**Rencana meramalkan 1601** — selisih +2 adalah −1 salah hitung rencana pada Tugas 9 (kodenya memuat
11 uji, teksnya menulis 12) dan +3 uji yang tidak ada di rencana (dua uji satuan kuotasi JPY,
satu uji `pricingCells`). `./node_modules/.bin/tsc --noEmit` **keluar 0 tanpa keluaran** dan
`./node_modules/.bin/vite build` **`✓ built in 3.78s`** pada jalan yang sama.

**Playwright `test:visual` TIDAK dijalankan sesi ini** (42 lulus terakhir pada `a62562f`) — padahal
sub-proyek 1B **mengganti isi `client/src/pages/Rates.tsx` seluruhnya**. Bila ada snapshot visual
yang menyentuh halaman Kurs, ia hampir pasti perlu diperbarui; itu belum diperiksa siapa pun.

`pnpm audit --prod --audit-level=high` **tidak dijalankan sesi ini** — dependensi tidak bertambah di
sub-proyek 1B. Hasil terakhir (15 September): **9 kerentanan (3 tinggi, 6 sedang)**, termasuk
`xlsx`/SheetJS yang sudah dikenal dan **satu temuan tinggi pada `mysql2`** (GHSA-3f6p-5ww8-9rcr,
lewat `drizzle-orm@0.45.2 > mysql2@3.15.1`; terpatch `>=3.22.0`) — menaikkannya menyentuh backend,
jadi ditunda ke paket tersendiri. **Jangan menyebut audit bersih.**

**Migrasi terakhir kini `0061`** (`0060_stiff_joystick.sql` aditif: `app_installation`,
`owner_recovery_codes`, delapan kolom `company_profile`; `0061_isi_app_installation.sql` isian
bersyarat hanya bila sudah ada Pemegang Saham). Diukur 26 September: `ls drizzle/*.sql` = **62**,
jurnal `moneychanger` = **62**, `mc_t_abcvalas` = **62**, `mc_t_visual` = **62**; cadangan sebelum
migrasi di `/tmp/claude-501/backup-0060/` dipulihkan ke basis data sekali pakai (67 → 67 tabel).
Rollback `0060`/`0061`: mengembalikan commit cukup; tabel dan kolom baru dibiarkan tanpa `DROP`.
Sebelumnya: **`0059`** (`0059_cuddly_saracen.sql`, 1B Tugas 1) — **sub-proyek 1B Tugas 5–14
tidak menambah migrasi satu pun**, seluruhnya memakai kolom yang sudah ada. Diukur 16 September
sesudah penerapan: `ls drizzle/*.sql` = **60 berkas**, jurnal `moneychanger` = **60**, jurnal
`mc_t_abcvalas` = **60**. **Jurnal produksi 60 sejak 26 September 2026.** **Rollback `0059`: mengembalikan commit sudah
cukup** untuk aplikasinya; tabel dan kolom baru **dibiarkan** tanpa `DROP` kecuali pengguna
menyetujui penghapusannya.

**Uji wajib dijalankan dengan `.env` termuat.** Tanpa itu
`server/internalAuth.developmentAccounts.test.ts` gagal sendirian dengan *"Database tidak
tersedia"* — kegagalan lingkungan, bukan regresi. **Gejala kedua yang mudah disalahartikan:** tanpa
`TENANT_TEST_SECONDARY_URL`, empat uji `server/tenantIsolation.live.test.ts` **dilewati diam-diam**
(`describe.skipIf`), sehingga jumlah "dilewati" menjadi 6 tanpa satu pun kegagalan. Bila jumlah
"dilewati" bukan **2**, yang kurang adalah env, bukan ujinya:
```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
```

**Satu uji diketahui flaky dan bukan bagian paket mana pun:** `server/tenantIsolation.live.test.ts`
> *"setiap ikatan hanya melihat database miliknya sendiri"*. Bila gagal sendirian di bawah beban,
jalankan ulang berkas itu saja. (Sejak 26 September ia tidak lagi menuntut `mc_t_abcvalas` kosong —
kegagalan dua uji sekaligus dengan `expected N to be 0` berarti versi lamanya kembali.)

**Kegagalan flaky KEDUA yang tidak dapat direproduksi (16 September 2026, sub-proyek 1B Tugas 3).**
Satu jalan penuh menunjukkan `1 failed | 1535 passed | 2 skipped`; nama berkasnya **hilang dari
buffer sebelum sempat dicatat**. **Diburu khusus pada `dde48d0` dengan lima jalan penuh berturut-turut
yang seluruh keluarannya ditulis ke berkas log** (`/tmp/claude-501/flaky-1..5.log`): kelimanya
`1543 passed | 2 skipped`, tanpa satu pun `FAIL`. Ditambah empat jalan penuh lain sepanjang sesi,
**sembilan jalan bersih berturut-turut** sesudah kejadian itu. Jadi ia **tidak tertutup, hanya tidak
terulang** — mungkin `tenantIsolation.live` di atas, mungkin bukan.
Bila sesi berikutnya melihat satu kegagalan tunggal pada jalan penuh, **catat nama berkasnya dahulu**
(`vitest run > berkas.log 2>&1`) sebelum mengulang; mengulang lebih dahulu menghapus satu-satunya
bukti, dan itulah sebabnya kejadian pertama tidak pernah teridentifikasi.

### Yang tidak perlu ditemukan ulang

- **DNS penyedia internet pemilik (202.158.3.6) menyadap port 53 dan menyimpan NXDOMAIN 30 menit** (SOA min 1800). Jangan
  mencari nama host sebelum rekamannya dibuat; periksa lewat DoH: `curl -H 'accept: application/dns-json'
  'https://cloudflare-dns.com/dns-query?name=<host>&type=A'`, lalu `curl --resolve <host>:443:<ip-cloudflare>`.
- **Pengklasifikasi mode otomatis menolak** reload Caddy tokoemas produksi dan penghapusan rekaman DNS yang tidak diminta
  eksplisit. Jangan mencari jalan memutar: berikan perintah `!` kepada pemilik, atau tunggu kalimat pemilik yang memintanya.
- **Gmail MCP tidak bisa mengunduh lampiran.** Pemilik mengizinkan unduh lewat Claude in Chrome (lampiran surel BI, laporan
  lama di folder Terkirim). Surat-surat lama pemilik (DTTOT nihil, penghapusan 2020) ada di Google Drive (cari judul "DTTOT").
- **Daftar KUPVA berizin BI:** `https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/kupva-bb-ptd/default.aspx`
  (WebFetch ke bi.go.id gagal jabat tangan TLS; pakai pencarian dengan `allowed_domains`).
- **Rute SVG mengikuti gulir:** jangan `getPointAtLength` berulang (apalagi dari ResizeObserver body) — dulu membekukan
  kirim formulir 850 ms (CPU 4x). Hitung titik dari segmen. Juga tanpa `filter` pada pembungkus elemen beranimasi; cap
  ber-filter SVG di lapisan sendiri. Ukur dengan rAF + `long-animation-frame` (skrip contoh di arsip solvinc-designer).
- **Berkas HTML pendukung artifact** (bukan halaman utama) wajib `<!doctype html>` + charset + viewport sendiri; tanpa itu
  mode quirks dan tata letak ponsel rusak. Server lokal `python3 -m http.server` tidak mengirim charset → teks rusak "Â·"
  kecuali ada `<meta charset>`.
- **Gladi Docker di Mac:** VM Docker 2 GB → mysqld dibunuh OOM bila dua MySQL + Postgres proyek lain jalan; pakai
  `MYSQL_BUFFER_POOL=256M`/`MYSQL_MEM_LIMIT=768m`. Uji pulih menunggu MySQL lewat TCP (`-h 127.0.0.1`), bukan soket.

- **Playwright yang "macet" 15–17 menit adalah Mac yang tidur**, bukan kode — jalankan
  `caffeinate -dimsu ./node_modules/.bin/playwright test`. Bila Playwright gagal seketika dengan
  `browserType.launch: Executable doesn't exist … chromium_headless_shell-1243`, peramban
  Playwright-nya hilang dari `~/Library/Caches/ms-playwright`: `./node_modules/.bin/playwright install chromium`
  (± 280 MB, minta izin pengguna dulu). Itu bukan kegagalan uji — jangan dilaporkan sebagai lulus.
- **Akibat A6:** nama penerbit/audiens sesi berganti, jadi setiap sesi yang sedang berjalan berakhir
  sekali — termasuk produksi bila kelak diterapkan.
- **Server pengembangan yang dijalankan `tsx server/_core/index.ts` (tanpa `watch`) tidak memuat
  ulang perubahan server** — hentikan dan jalankan lagi sebelum verifikasi layar, atau pakai `tsx watch`.
- **Klik tetikus Claude-in-Chrome kadang tidak sampai ke React pada tab baru** (tombol menyala
  tetapi state tidak berubah, tanpa galat konsol). Sebelum menyimpulkan ada bug, uji dengan
  `element.click()` lewat `javascript_tool`; pada 28 September aplikasinya benar, alatnya yang tidak.
  `Input type="date"` juga tidak menerima ketikan — isi dengan `form_input` nilai `YYYY-MM-DD`.
- **Celah id pada tabel yang diisi migrasi `INSERT … SELECT`** (mis. `watchlist_blocks` langsung
  lompat ke #4) adalah InnoDB memesan blok id — bukan baris yang terhapus.
- **Kolom TIMESTAMP (`audit_logs.createdAt`) tampil dalam WIB di klien `mysql`, kolom DATETIME dalam
  UTC** — dua baris yang ditulis bersamaan tampak berselisih 7 jam. Itu cara tampil, bukan salah tulis.

- **Uji hidup yang MENULIS memakai `server/testing/scratchDatabase.ts`** (`mc_uji_*`, dibuat ulang dan
  dimigrasikan penuh tiap jalan, dibiarkan sesudahnya). Contoh: `ownerRecovery.live.test.ts`,
  `installationSetup.live.test.ts`. Jangan menulis ke `moneychanger`/`mc_t_abcvalas` dari uji.
- **`mc_t_abcvalas` bukan lagi basis data kosong.** Sejak peragaan sub-proyek 2 ia punya akun,
  profil, kurs, dan tanda "sudah disiapkan". Uji apa pun yang mengandaikannya kosong salah premis.
- **`mc_t_visual` tidak punya kurs aktif**, jadi baseline Playwright halaman depan memotret keadaan
  kosong; masalah tata letak tabel kurs (mis. luapan di 390) harus diperiksa di basis data berisi kurs.
- **Label `<FormSection>` menamai `section`-nya dengan judul yang sama dengan label input** di wizard;
  `getByLabel` Playwright bertabrakan (strict mode). Batasi ke `input, textarea`.
- **Server pengembangan (`NODE_ENV=development`) membuat akun `test-*` di basis data mana pun yang ia
  buka**, termasuk `mc_t_abcvalas` bila dijalankan dengan `DATABASE_URL` itu.
- **Ekstensi Claude di Chrome dapat terputus di tengah sesi**; skrip Playwright tanpa kepala
  (`@playwright/test` → `chromium.launch()`) adalah jalan cadangan yang terbukti untuk peragaan.
- **Jendela Chrome di mesin ini tertahan 1440 lebar** oleh ukuran layar — 1920 hanya dapat
  diperiksa lewat Playwright.
- **Skrip `task-start`/`task-done` superpowers mencari judul `### Task N`**; rencana proyek ini
  berbahasa Indonesia (`### Tugas N`), jadi keduanya gagal — baca bagian rencananya langsung.

- **Instalasi baru tidak punya baris `company_profile`.** `updateCompanyProfile` meng-upsert; fakta apa
  pun yang harus ada sejak awal instalasi tidak boleh ditaruh di tabel itu (alasan `app_installation`).
- **Express tanpa `trust proxy`:** di belakang nginx setiap `req.ip` bernilai loopback. Pembatas atau
  log per IP apa pun tidak berarti sampai `configureProxyTrust` (sub-proyek 2 Tugas 4) terpasang.
- **Dasbor Pemegang Saham membuka `/operasional/pengguna?role=ADMIN|STAFF`**
  (`OperationsDashboard.tsx:162`). Layar Pengguna yang dibangun ulang wajib tetap membaca parameter itu.
- **`client/src/main.tsx` mengirim header Bearer dari `sessionStorage["manus-cookie"]` yang tidak pernah
  dibaca server** — sesi hanya dari cookie httpOnly. Sisa Manus; dibuang di sub-proyek 2 Tugas 8.
- **`mc_t_visual` yang dibuat baru tidak punya Pemegang Saham saat migrasi**, jadi sesudah `0061` ia
  akan menampilkan wizard ke seluruh baseline. `scripts/visualDb.mjs` harus menandainya sudah disiapkan.
- **Log uji selalu ditulis ke berkas** (`vitest run > /tmp/claude-501/….log 2>&1`) supaya kegagalan
  tunggal yang flaky dapat dinamai sebelum diulang.

- **Kasir (STAFF) tidak dapat membaca `rates.board` maupun `settings.reviewThreshold`** — keduanya
  `adminProcedure`. Formulir bon membaca `rates.pricing` (`staffProcedure`). Setiap fitur baru yang
  ingin memperlihatkan kurs kepada kasir menempel di sana, bukan di papan.
- **Kurs papan boleh dikuotasi per 100 unit (JPY), baris bon selalu per 1.** Satuan disamakan di
  `suggestDenominationRate` dan `resolveDenominationReference`. Setiap pembaca kurs baru wajib
  memeriksa satuannya; lupa memeriksa berarti salah 100×, bukan salah sedikit.
- **Riwayat papan dibaca dari `operational_rates.activationBatchId`, tanpa menyaring status.**
  Menyaring `status='ACTIVE'` membuat batch pagi menyusut begitu kurs siang menggantikannya — itu
  bukan hal yang terlihat dari kode, hanya dari peragaan dua aktivasi dalam satu hari.
- **Dialog kelompok pecahan hanya menawarkan pecahan dari `CURRENCY_DENOMINATIONS`** — valuta yang
  belum ada di katalog itu tidak dapat dikelompokkan sama sekali; layarnya mengatakan begitu.
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
- **Aktivasi kurs hanya punya SATU jalur:** `activateOperationalRateIds` di `server/rateBoard.ts`.
  `activateOperationalRate` dan `activateOperationalRates` pada `server/operations.ts` sekarang
  cuma pembungkusnya (lewat impor dinamis, supaya kedua modul tidak saling mengimpor di tingkat
  modul). Jangan menambahkan jalur aktivasi kedua — aturannya akan berselisih diam-diam. Seluruh
  keputusannya diambil `planBoardActivation` **sebelum** transaksi dibuka, dan alasan ≥ 10 karakter
  diperiksa **sebelum kueri apa pun**: `server/operations.test.ts` menuntut galat "alasan terlalu
  pendek" muncul walau kurs yang dirujuk tidak ada.
- **Mengecualikan satu anak dari direktori yang diabaikan menuntut pola `/*`, bukan nama direktori.**
  `.claude/skills/` diikuti `!.claude/skills/serah-terima/` **tidak bekerja** — git tidak menuruni
  direktori yang sudah diabaikan, jadi negasinya tidak pernah dievaluasi. Yang benar
  `.claude/skills/*`. Diperiksa dengan `git check-ignore -v <berkas>`; skill pihak ketiga tetap
  diabaikan karena semuanya symlink, dan `serah-terima` satu-satunya direktori sungguhan di sana.
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
- **Checkbox `Status Pengerjaan` pernah tertinggal di belakang pekerjaannya.** Diperiksa
  9 September 2026: Paket F2 Tugas 11 dan Paket K2 Tugas 4 tercatat belum tercentang padahal
  keduanya sudah selesai — langkah-langkahnya sendiri sudah tercentang, kodenya ada, dan
  commit-nya (`f747077`, `4a4e299`) ada. **Bila dokumen dan kode berbeda, percayai kode dan
  riwayat commit**, lalu perbaiki dokumennya. Sebuah hook `SessionStart`
  (`~/.claude/hooks/next-task.sh`, lihat `SETUP-PERKAKAS.md`) kini menyapu seluruh rencana pada
  awal tiap sesi, jadi ketertinggalan seperti ini muncul sendiri tanpa dicari.
- **`DEFAULT CURRENT_TIMESTAMP` menyimpan jam dinding mesin, bukan instan UTC.** Ditemukan
  10 September 2026 lewat peragaan Paket L, tidak oleh satu uji pun: satu baris berisi `screenedAt`
  (bawaan MySQL) **23:24 WIB** dan `listSnapshotAt` (ditulis dari JS) **16:24 UTC** — instan yang
  sama, dua kesepakatan berbeda. Dibaca kembali sebagai UTC, layar memperlihatkan peristiwa **tujuh
  jam di masa depan**. `customer_watchlist_screenings.screenedAt` sudah diperbaiki dengan menulis
  waktunya dari penulisnya. **`audit_logs.createdAt`, `customers.createdAt`, dan seluruh kolom
  `defaultNow()` lain BELUM** — Daftar Nasabah hari ini menampilkan "Dibuat 11 Sep 2026" untuk
  nasabah yang dibuat 10 September. Benar di produksi (server UTC), salah di pengembangan. Penulis
  baru: **tulis waktunya sendiri**, jangan mengandalkan bawaan kolom.
- **`DialogContent` adalah `grid`, jadi anaknya ber-`min-width: auto`.** Panel apa pun yang memuat
  tabel ber-`min-w-[...]` akan **melebarkan dialognya** dan memotong isi di tepi kanan — tombolnya
  ikut terpotong dan tidak dapat dibaca. Obatnya `min-w-0` pada pembungkus panel. Ini tidak
  tertangkap `tsc` maupun `vite build`; hanya terlihat di layar (Paket L Tugas 6).
- **Berkas dokumen dan berkas impor punya dua batas yang BERBEDA.** Dokumen
  (`server/documentOperations.ts`): **8 MB**, MIME saja. Impor XLS/XLSX: **5 MB** plus
  `assertSpreadsheetSignature`. Jangan mencampurnya.
- **`customers.search` hanya memuat nasabah `ACTIVE`** — ia milik borang transaksi. Pemilih nasabah
  yang harus menemukan nasabah **tidak aktif** (mis. halaman Penatausahaan Dokumen) memakai
  `customers.list` dan menyaring di klien. Ditemukan Paket M Tugas 8.
- **Unggah dokumen lewat layar SELALU gagal di mesin lokal** (*"Storage config missing: set
  R2_ACCOUNT_ID…"*) — `.env` lokal tanpa kredensial R2, dan itu disengaja. Jangan mencoba
  memperbaikinya dan jangan membuat kredensial. Untuk peragaan, sisipkan baris `operational_documents`
  lewat SQL sebagai pengganti unggahan (preseden Paket I dan M), lalu jalankan seluruh alur di
  hilirnya lewat layar dan penulis sesungguhnya.
- **`echo ===` di zsh memutus perintah berikutnya** (`=` di awal kata adalah ekspansi perintah zsh:
  *"== not found"*). Pakai `echo "---"` sebagai pemisah keluaran.
- **Klik pada tab peramban yang tidak aktif tidak mendarat.** Tombol yang di-*find* dan diklik lewat
  `ref` pada tab latar tampak ter-hover, tetapi dialognya tidak terbuka. Kerjakan satu tab sampai
  selesai, jangan dua tab bersamaan — mengetik di satu tab sementara tab lain diklik juga berisiko
  salah sasaran.
- **Peragaan tidak mengetik kata sandi akun uji.** Peramban biasanya sudah masuk sebagai
  *Development Shareholder*. Bukti perilaku peran lain (mis. Controller ditolak) diambil dengan
  memanggil penulis sesungguhnya memakai baris `users` asli — pola `scripts/peragaanPaketM.mts
  tolak-controller`; tampilan layar peran lain butuh pengguna yang masuk sendiri.
- **Penerapan produksi dilakukan manual; push ke `main` TIDAK menerapkan apa pun.** GitHub Action-nya
  gagal di langkah SSH sejak awal. Cara yang terbukti 12 September 2026: `ssh deploy@187.53.128.14`,
  `cd /var/www/ibukotavalasindo && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 nohup ./deploy.sh > backups/deploy-<cap-waktu>.log 2>&1 &`,
  lalu ikuti lognya. `nohup` wajib — SSH yang putus di tengah migrasi tidak boleh membunuh prosesnya.
  pm2 berjalan dari `/var/www/ibukotavalasindo` dengan nama `ibv-backoffice`, satu proses `fork`.
- **Pengklasifikasi izin menolak perintah yang mengubah produksi** (menjalankan `deploy.sh`, `mysqldump`
  dengan kredensial aplikasi) meski pengguna sudah setuju di percakapan; akses baca `claude_readonly`
  tetap lolos. Yang membuka blokir hanya aturan izin eksplisit yang ditambahkan pengguna lewat
  `/permissions`. Jangan mencoba mengakalinya; minta pengguna.
- **Cadangan produksi tidak dapat dibuktikan dapat dipulihkan di server.** `appuser` hanya punya hak
  pada `moneychanger.*` — tidak dapat membuat basis data coba. Memulihkan ke Mac lokal menyalin data
  nasabah produksi dan tidak boleh. Bukti yang tersedia: `gzip -t`, jumlah `CREATE TABLE`, dan baris
  penutup *Dump completed*. `deploy.sh` kini memakai `--single-transaction --set-gtid-purged=OFF` dan
  berhenti bila dump tidak memuat tabel padahal basis datanya bertabel.
- **Berkas rencana yang sangat panjang wajib ditulis bertahap** (tulis kepala + beberapa tugas, lalu
  tambahkan sisanya per potongan). Menulisnya dalam satu keluaran pernah terpotong batas token keluaran
  12 September 2026.
- **`tailwind-merge` tidak mengenal token fondasi — `cn` sudah diperluas, dan token baru wajib ikut
  didaftarkan.** Diperiksa 13 September 2026 pada v3.3.1: tanpa perluasan, `text-body`/`text-label`
  dianggap **warna** dan dibuang bila bertemu `text-ink`, sedangkan `h-9 h-control` dan
  `shadow-xs shadow-hard` dipertahankan berdua sehingga urutan CSS yang menentukan. Perluasannya ada di
  `client/src/lib/utils.ts` (`extendTailwindMerge`, tema `text`/`shadow`/`spacing`) dan dijaga
  `client/src/lib/utils.test.ts`. Menambah ukuran teks, bayangan, atau spasi bernama baru di
  `@theme` **tanpa** mendaftarkannya di sana akan membuat kelasnya hilang diam-diam saat dilewatkan ke
  komponen shadcn.
- **`.font-display` dipakai 38 berkas halaman lama** (Manrope 800). Jangan mengubahnya; huruf judul
  Konter Tebal (Bricolage Grotesque) bernama **`font-heading`**.
- **Lapisan dalam `Sidebar` shadcn memakai `bg-sidebar` sendiri**, dan laci ponselnya tidak menerima
  `className`. Mewarnai sidebar lewat kelas pada `AppSidebar` saja tidak cukup — token `--sidebar*` di
  `:root` sudah dipetakan ke token fondasi (`--sidebar: var(--paper)`, `--sidebar-border: var(--ink)`).
  **`SidebarGroup` wajib `shrink-0`**: tanpanya, bila menu lebih tinggi daripada layar (1280×800,
  Pemegang Saham), kelompok diperas kolom flex dan butirnya saling menimpa alih-alih bergulir.
- **Token turunan palet dideklarasikan pada `:root, [data-tema]`.** Variabel yang dihitung di `:root`
  (mis. `--surface-raised: color-mix(… var(--paper) …)`) tidak ikut berubah bila `--paper` ditimpa
  pada elemen di bawahnya; `applyTheme` karena itu memberi atribut `data-tema` pada wadahnya.
- **`--line-quiet` hanya 2,01:1 terhadap latar** (diukur di peramban, Marun) — cukup untuk garis
  pemisah, **tidak** untuk batas kolom isian (WCAG 1.4.11 menuntut 3:1). `QUIET_FIELD` karena itu memakai
  `border-ink-subtle` (6,06:1). `--ink` 16,88:1, `--ink-muted` 9,67:1.
- **Tiga batas perkakas peramban yang menghabiskan waktu verifikasi:** (1) tombol **Tab** yang dikirim
  ekstensi Chrome **tidak memindahkan fokus** — `activeElement` tetap `BODY`; cincin fokus diperiksa
  dengan menekan Tab sungguhan atau lewat Playwright. (2) **Transisi CSS tidak maju di tab latar**:
  pengukuran `getComputedStyle` sesudah menciutkan sidebar dapat membaca keadaan awal transisi (opacity
  1, lebar 232) dan screenshot dapat menangkapnya di tengah jalan — ukur ulang sesudah screenshot/zoom
  mengaktifkan tab. (3) **`resize_window` tidak dapat melebihi layar fisik**: 1440×900 dan 1920×1080
  tetap terbaca 1280×659; ukuran itu diverifikasi Playwright (Tugas 11), bukan peramban ini.
- **Sesi pengendali tidak boleh mengetik kata sandi untuk masuk**, termasuk akun uji lokal. Bila
  peramban keluar, minta pengguna masuk sendiri; token dan panel akses tetap dapat diperiksa tanpa masuk.
- **"Hanya 7 kurs" bukan batas kode.** Basis data lokal `moneychanger` memuat 8 valuta (7 asing + IDR),
  hanya 1 berkurs aktif; katalog `shared/worldCurrencies.ts` memuat 151 valuta. Masalah halaman Kurs
  ada pada susunannya (±10 kartu, satu kurs per kartu, aktivasi tidak atomik) — lihat spec 2026-09-13
  Bagian B.
- **Tab Chrome yang tidak di depan tidak merender.** Lewat ekstensi Chrome, `document.visibilityState`
  bisa tetap `hidden` walau jendelanya terlihat: gulir tidak maju, animasi keluar dialog Radix tertahan
  (elemen bertahan di DOM dengan `data-state=closed`), dan tangkapan layar mengembalikan gambar basi.
  Pengukuran tata letak (`getBoundingClientRect`, `getComputedStyle`) tetap benar. Beri tunggu **8 detik**
  sesudah `navigate` sebelum mengukur, dan jangan menyimpulkan cacat dari tangkapan layar yang basi.
- **`browser_batch` dengan 8 halaman sekaligus habis waktu.** Dua halaman per batch aman.
- **Tombol `Tab` dan `Escape` dari ekstensi tidak selalu sampai.** Sesudah `navigate`, `Tab` kerap
  meninggalkan fokus di `BODY`; memanggil `element.focus()` lewat `javascript_tool` lalu menekan `Tab`
  berhasil. `type` maupun `key` juga tidak menyisipkan karakter ke input React yang terkendali.
- **`git` bisa mati total karena lisensi Xcode.** 16 September seluruh perintah `git` (dan `python3`)
  gagal dengan *"You have not agreed to the Xcode license agreements"* karena `xcode-select -p`
  menunjuk `/Applications/Xcode.app`. Perbaikannya butuh sudo pengguna:
  `sudo xcode-select -s /Library/Developer/CommandLineTools` atau `sudo xcodebuild -license`.
  `node` tetap jalan, jadi skrip pemeriksaan tulis dengan `node -e`, bukan `python3`.
- **Mockup sesi rancangan tersimpan lokal** di `.superpowers/brainstorm/59970-1789210543/content/`
  (`gaya-karakter.html` pilihan 3, `tebal-intensitas.html` pilihan B, `palet-konter-tebal.html`,
  `papan-kurs.html`) — rujukan visual yang disetujui pengguna. Sejak 16 September 2026 seluruh
  `.superpowers/` masuk `.gitignore`, jadi berkas ini **tidak ada cadangannya di git**; bila mesin ini
  hilang, mockup-nya ikut hilang dan yang tersisa hanya keputusan tertulis di spec.

### Risiko residual Sub-proyek 2 yang masih terbuka

1. Pembatas percobaan di memori proses — benar hanya selama produksi satu proses pm2 `fork`; petanya
   dapat tumbuh oleh serangan tersebar sampai pembersihan 24 jam.
2. Autentikasi ulang tindakan sensitif belum ada (keputusan pengguna 26 September 2026).
3. **Produksi belum disentuh.** Antrean `0060`, `0061`. Sesudah penerapan: pemilik produksi wajib
   membuat kode pemulihan (ajakan muncul sendiri), baris `INITIAL_SHAREHOLDER_*` dihapus dari `.env`
   produksi (kodenya tidak lagi membacanya), dan kolom halaman publik diisi — sampai itu halaman depan
   produksi **tanpa nomor telepon** (sebelumnya ditulis mati).
4. Kode penyiapan menuntut akses shell ke server.
5. Kehilangan seluruh kode pemulihan **dan** kata sandi pemilik hanya dapat dipulihkan lewat akses
   basis data langsung.
6. Kelas CSS situs publik lama `public-shell`, `ink-panel`, `section-kicker` kini tanpa pemakai
   (`public-grid` masih dipakai tiga layar); definisinya masih di `index.css`.
7. `PublicServicePlanner` dan sisa layar Profil Perusahaan masih bergaya lama sampai sub-proyek 9.
8. **Reviu akhir sub-proyek 2 adalah reviu-sendiri oleh penulisnya** (pengguna meminta tanpa
   subagen) — lebih lemah daripada peninjau segar. Sub-proyek 1B juga hanya direviu sesi langsung.
9. Temuan reviu yang ditunda (minor): `auth.recover` tidak menyamakan waktu untuk username bukan
   Pemegang Saham (username pemilik dapat ditebak dari lamanya jawaban); `ResetPasswordDialog` tidak
   mengosongkan isian sesudah reset berhasil (membuka dialog untuk akun lain membawa kata sandi
   sementara sebelumnya); `CreateUserForm` mengosongkan isian sebelum server menjawab; kolom "Per"
   tabel kurs publik menampilkan `1.000000` mentah; placeholder "Warna utama sendiri" ikut huruf besar;
   label "Username pemilik" di `/pulihkan` tidak menjelaskan bahwa yang diminta nama masuk, bukan peran;
   nama produk "Aplikasi Valuta" berkedip sesaat di `/login` sebelum profil termuat.
10. Langkah wizard sendiri tidak dipotret Playwright (penyimpangan sadar dari spec §Verifikasi);
    dibuktikan uji komponen dan peragaan.

### Risiko residual Sub-proyek 1B (SELESAI) yang masih terbuka

1. **Penyaring "Berubah" tidak menampilkan draf yang nilainya sama dengan kurs berlaku.**
   `cellChanged` membandingkan terhadap kurs aktif, jadi draf hasil **"Salin kurs kemarin"** tidak
   pernah muncul di penyaring itu — padahal ikut diaktifkan. Ubin "Belum diaktifkan" dan bilah bawah
   memakai hitungan yang berbeda (`readyCells` pada `Rates.tsx`: berubah **atau** punya draf), justru
   supaya tombol salin tidak menghasilkan papan yang terlihat kosong. Dua definisi ini hidup
   berdampingan dengan sengaja; jangan menyatukannya tanpa memutuskan mana yang benar.
2. **Kolom kurs pada kisi menampilkan nilai mentah basis data** (`16310.000000`). Kolom Referensi BI
   dan nilai lama yang dicoret sudah berformat id-ID, kotak isiannya belum — mengubahnya berarti
   memformat sambil diketik, dan itu belum dirancang.
3. **Rujukan tingkat baris valuta (`exchange_transaction_lines.referenceRateSnapshot`) tidak
   disesuaikan satuan kuotasinya.** Hanya baris pecahan yang disesuaikan. Nilai baris itu kini
   mendahulukan kurs tanpa kelompok supaya tidak acak, tetapi **tidak ada layar yang menampilkannya**;
   bila kelak ditampilkan, JPY akan terbaca 100× lebih besar.
4. **`exchange_transaction_lines.agreedRate` tetap rata-rata tertimbang** (risiko yang dibawa
   rencana): bon dengan dua kelompok harga dalam satu valuta menghasilkan satu baris berkurs rata-rata,
   dan **kwitansi cetak belum menyebut kelompoknya**.
5. **Papan membaca kurs ACTIVE tanpa menyaring `effectiveAt`**, sementara `listPublicActiveRates`
   menyaringnya. Kurs bertanggal maju akan terlihat "Berlaku" di papan sebelum tampil di halaman
   publik. Aman selama aktivasi selalu menyetel `effectiveAt` saat draf dibuat; **perbaiki ini lebih
   dahulu** bila penjadwalan kurs dibangun.
6. **Toleransi satu angka untuk seluruh valuta, dua arah** (spec §B4). Batas berbeda per valuta dan
   toleransi asimetris belum terlayani.
7. **Bon lama tidak punya rujukan per pecahan.** Kolom `operationalRateId`/`referenceRateSnapshot`/
   `rateDeviationPercent` kosong pada baris yang ditulis sebelum `0059`. Laporan mana pun yang
   membacanya wajib memperlakukan NULL sebagai "tidak diketahui", bukan nol.
8. **`saveRateTier` membaca baris yang baru disisipkan dengan `ORDER BY id DESC LIMIT 1`**, bukan
   dari id yang dikembalikan penyisipannya. Beban nyatanya satu admin per papan, jadi dibiarkan —
   tetapi jangan menyalin polanya ke jalur yang lebih ramai.
9. **Belum ada uji yang membuktikan aktivasi berguling balik** ketika satu pernyataan di tengah
   transaksi gagal. Penolakan sebelum transaksi dibuka **sudah** dibuktikan pada MySQL lewat peragaan
   (dua draf tetap DRAFT, tidak ada kurs baru aktif).
10. **Seri uang kertas (lama/baru) tetap di luar cakupan** — lihat butir 10 pada daftar pekerjaan
    yang belum dirancang.
11. **Sisi Rupiah bon tidak diubah sama sekali** oleh sub-proyek ini: `rateDeviationPercent` hanya
    ada di sisi valuta asing. Peragaan membuktikan kedua kaki tetap bergerak seperti sebelumnya
    (IDR 100k −163 lembar pada BELI, +82 lembar pada JUAL).

### Risiko residual Fondasi Desain (Tugas 1–12) yang masih terbuka

Daftar lengkapnya (13 butir, dua di antaranya sudah dicoret) ada di akhir
`plans/2026-09-12-fondasi-desain.md`. Yang paling mudah menggigit sesi berikutnya:

- ~~`N` dan `/` aktif saat dialog terbuka (butir 13)~~ dan ~~tombol merek tanpa `FOCUS_RING`
  (butir 11)~~ — **keduanya selesai 16 September 2026** (`f53a04c`); rinciannya di blok keadaan di atas.
  Yang **belum** terbukti: perilaku dialog itu belum dilihat di peramban sungguhan, baru di jsdom.
- **Halaman lama tanpa `h1`**: `/operasional`, `/operasional/stock/kas-awal`, `/kepatuhan/ira`
  (dan kemungkinan lainnya) sejak kepala shell berhenti menjadi heading. Tertutup ketika tiap modul
  memakai `PageHeader`.
- **1440×900 dan 1920×1080 hanya terbukti lewat baseline Playwright**, bukan peramban manual — layar
  fisik mesin ini membatasi jendela di 1351px. Fallback font luring belum pernah diuji.
- **Pengembalian fokus sesudah `Esc` pada palet ⌘K belum terbukti di peramban** (butir 10);
  `data-state=closed` terbukti, animasi keluarnya tertahan di tab tersembunyi.
- **Kontras turunan hanya diukur untuk Marun.** Pasangan palet diuji otomatis untuk keenam palet,
  tetapi `--ink-subtle`/`--ink-muted` hasil `color-mix` pada lima palet lain belum diukur.
- **Halaman lama tampil dengan gaya lamanya di dalam shell Konter Tebal** (mis. tab navy dan kartu
  bayangan lembut di Kas Awal) — campuran gaya yang disengaja sampai modulnya dibangun ulang.
- **Font dari Google Fonts** membutuhkan internet; tanpa sambungan, peramban memakai fallback sistem.
  Baseline Playwright juga bergantung pada font yang sudah ter-cache (bisa goyah di mesin bersih).
- **Implementer subagen tidak mencentang langkah rencana**; pengendali mencentangnya sesudah reviu.
  Periksa ulang checkbox sesudah setiap tugas.
- **Mutu kode Tugas 1–7 tidak pernah ditinjau siapa pun** (dikerjakan langsung sebelum SDD), dan reviu
  akhir lintas cabang tidak pernah selesai — lihat blok keadaan di atas untuk tiga pemeriksaan
  tertarget yang menggantikannya.

### Risiko residual Paket J2 yang masih terbuka

Sembilan butir, tertulis lengkap di akhir
`plans/2026-09-09-individual-risk-assessment-j2-penilaian.md`. Ringkasnya: bobot pilar KPMR tidak
dipakai rumusnya; Aspek Kelembagaan tidak dibangun; seluruh klasifikasi risiko bergantung manusia
dan kode tanpa baris dibaca RENDAH; dimensi `COUNTRY` tanpa daftar FATF/PBB; `PPSPM_3C` tidak dapat
membedakan UMKM; `TPPU_4A` dan `TPPU_4B` selalu sama karena hanya ada satu provinsi gerai;
`pnpm audit --prod --audit-level=high` masih **9 temuan** (6 sedang, 3 tinggi) — **jangan menyebut
audit bersih**; migrasi **`0000`–`0058` sudah diterapkan ke produksi** pada 12 September 2026 atas
basis data yang direset (jurnal produksi 59 = berkas 59); dan
zona waktu server masih memakai bawaan `Asia/Jakarta`, bukan `company_profile.timezone`.

### Risiko residual paket sebelumnya yang masih terbuka

- **Paket I:** unggah berkas dan tombol "Buka" belum pernah dijalankan sungguhan (`.env` lokal tanpa
  kredensial R2); jalur unggah dokumen tidak memeriksa signature; sertifikat izin pada Profil Perusahaan tanpa peringatan masa
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

Data Paket M (11 September 2026), **jangan dibersihkan**:

- `operational_documents` id **8–12**, seluruhnya ber-`notes` *"Data uji peragaan Paket M"* dan
  disisipkan lewat SQL (R2 tidak ada): **8** sertifikat izin `COMPANY` aktif, **9** lampiran izin
  `COMPANY` **nonaktif** (lewat layar), **11** `KTP_PHOTO` nasabah 8, **12** `UNDERLYING_INVOICE` bon
  20 (`FX-UJI-T4-0006`). Id **10** sudah **dihapus permanen** lewat layar — barisnya memang tidak ada.
- Nasabah **8 / CIF-000001** dinonaktifkan lalu diaktifkan kembali lewat layar; kini `ACTIVE` dengan
  `relationshipEndedAt` `NULL`.
- `audit_logs` **#193–#196**: dua `CUSTOMER_UPDATED` (perpindahan status), satu
  `COMPANY_PROFILE_DOCUMENT_DEACTIVATED`, satu `COMPANY_PROFILE_DOCUMENT_PURGED`.

Data sub-proyek 1B (21 September 2026), **jangan dibersihkan**:

- `rate_tiers` USD: **100** (urutan 1), **50** (urutan 2), **5–20** (urutan 3, memuat 5/10/20) —
  dibuat lewat dialog kelompok, bukan SQL.
- `operational_rates`: sepuluh kurs berlaku untuk AED, AUD, JPY, MYR, SAR, SGD, dan empat baris USD
  (tiga kelompok + Pecahan lain), tersebar pada **empat batch aktivasi** hari itu beserta alasannya;
  beberapa baris USD lama berstatus RETIRED dari aktivasi kedua dan ketiga.
- Bon uji **`E2E-PK-B01`** (BELI, selesai, kedua kaki kas bergerak), **`E2E-PK-J01`** (JUAL, selesai),
  **`E2E-PK-B02`** (di luar toleransi dengan alasan; **menunggu tinjauan**, sengaja dibiarkan),
  **`E2E-PK-B03`** (dua rujukan berbeda dalam satu bon), **`E2E-PK-B04`** (kurs berubah saat bon
  diisi). Seluruhnya atas nasabah uji **8** dan bertanda `E2E-PK-` pada nomor kwitansinya.
- Stok kas lokal ikut berubah karenanya: IDR pecahan 100.000 dan 10.000, serta USD pecahan 100.

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

### Paket L — Jejak penyaringan nasabah dan persetujuan risiko tinggi (6 tugas) — **SELESAI 10 September 2026**

Enam tugas, lima commit: `4c44b22` (migrasi `0057`), `a4beb78` (penulis penyaringan), `bffedbe`
(penyaringan ulang massal), `ea78bf2` (gerbang persetujuan), `acd7a94` (halaman), `b2c3a90`
(peragaan dan dokumentasi). Menutup Temuan 1 dan 2 pada
`specs/2026-09-09-pbi-10-2024-temuan-awal.md`.

**Yang sekarang berdiri:**

- `customer_watchlist_screenings` — satu baris per penyaringan, tidak pernah disunting. Penulis
  tunggalnya `server/customerWatchlistScreening.ts`. Empat pemicu, semuanya sudah ada penulisnya:
  `NASABAH_DIBUAT`/`NASABAH_DIUBAH` (dari `createCustomer`/`updateCustomer`; profil pemilik manfaat
  yang baru dibuat ikut disaring), `DAFTAR_DIIMPOR` (seluruh nasabah aktif, sesudah impor daftar,
  **di luar transaksi impornya**), dan `MANUAL` (tombol "Saring ulang sekarang" pada profil nasabah).
- Pencocokan nama kini **satu fungsi murni**, `matchWatchlistEntries` — dipakai kotak pencarian
  manual maupun penyaringan otomatis. Pemotongan 25 hasil milik kotak pencarian saja, sehingga
  `matchCount` pada jejak adalah jumlah sebenarnya.
- Gerbang risiko tinggi: `customerHighRiskDenial` murni di **`shared/customerHighRisk.ts`** —
  dipakai borang transaksi untuk memperingatkan *dan* `createTransaction` untuk menolak, dengan
  kalimat yang sama persis. Berlaku atas nasabah transaksi **dan** pihak kuasa/wakilnya.
- `decideHighRisk` (SHAREHOLDER saja, wajib beralasan, hanya atas nasabah `HIGH`), dan aturan setel
  ulang ke `BELUM` **hanya** bila `riskLevel` berpindah **menjadi** `HIGH`.
- Panel riwayat pada profil nasabah membedakan tiga keadaan: belum pernah disaring, daftar usang,
  mutakhir. Sudah diverifikasi di layar 10 September 2026 sebagai Pemegang Saham.
- Peragaan menyeluruhnya dapat diulang: `./node_modules/.bin/tsx scripts/peragaanPaketL.mts`
  (basis data lokal saja).

**Yang tidak boleh diturunkan ulang:**

- **Paket ini menambahkan tindakan MEMBLOKIR untuk pertama kalinya.** Nasabah `riskLevel = HIGH`
  yang belum disetujui SHAREHOLDER tidak dapat dipakai pada bon baru. Seluruh aplikasi lain sengaja
  hanya mencatat dan memperingatkan; `director_acknowledgements` bahkan menyatakan dirinya *tidak
  boleh* memblokir. **Ini keputusan sadar pengguna, bukan kekeliruan — jangan "diperbaiki".**
- **`dttotPpsdmMatch` tidak pernah diisi otomatis**, meski penyaringannya otomatis. Mesin mencatat
  kemungkinan; manusia memutuskan. Ada ujinya sendiri.
- **Baris penyaringan ditulis MESKI nihil.** Baris nihil itulah buktinya. "Simpan hanya bila ada
  temuan" adalah optimasi yang justru menghapus yang dicari pemeriksa.
- **Kegagalan penyaringan tidak pernah menggagalkan penyimpanan nasabah**, dan penyaringan ulang
  yang gagal tidak membatalkan daftar yang sudah diimpor. Keduanya dicatat ke `audit_logs`
  (`CUSTOMER_SCREENING_FAILED`, `CUSTOMER_RESCREENING_FAILED`).
- **Tenggat pelaporan Pasal 60 DI LUAR LINGKUP** atas keputusan pengguna 9 September 2026 —
  negosiasi dengan BI sudah selesai. Jangan membangun antrean tenggat, dan jangan membangun kalender
  hari kerja untuk itu.

**Risiko residual yang jujur harus disebut** (lengkapnya delapan butir di
`ROADMAP-SISA-PEKERJAAN.md`):

1. **Peringatan daftar usang belum pernah terlihat di layar.** Ia hanya muncul bila penyaringan
   ulang sesudah impor tidak menjangkau seorang nasabah — yaitu sesudah kegagalan yang tercatat.
   Aturannya diuji sebagai fungsi murni; cabang tampilannya baru lewat pemeriksaan tipe dan build.
2. Penyaringan ulang massal berjalan **di dalam permintaan HTTP impor**. Pada puluhan ribu nasabah
   ia harus menjadi pekerjaan latar.
3. Ambang fuzzy 0,6 tidak berubah. Peragaan menghasilkan **12 kemungkinan cocok** untuk satu nama
   karena seluruh data peragaan berawalan "Contoh Peragaan".
4. Nasabah berisiko tinggi tidak dapat bertransaksi bila Pemegang Saham tidak dapat dihubungi.
   Tidak ada jalur darurat, dan itu disengaja.
5. Kolom `defaultNow()` selain `screenedAt` masih menyimpan jam dinding mesin — lihat
   `### Yang tidak perlu ditemukan ulang`.

**Data uji lokal yang ditinggalkan sengaja** (jangan dibersihkan): CIF-000004, CIF-000005
(disetujui, tiga baris riwayat), CIF-000006 (`HIGH`/`BELUM`, dipakai memperagakan bon tertahan),
dan bon `L-*`.

---

### Paket M — Penatausahaan dokumen dan penghentian penghapusan sungguhan (9 tugas) — **SELESAI 11 September 2026**

Spec `specs/2026-09-11-penatausahaan-dokumen-lima-tahun-design.md` · rencana
`plans/2026-09-11-penatausahaan-dokumen-lima-tahun.md`. Sembilan commit: `afe5109` (migrasi `0058`),
`ffa7ab6` (aturan retensi), `533fbac` (penulis `relationshipEndedAt`), `5c42208` (nonaktif/purge),
`c44228a` (penjaga), `19e2a87` (pembacaan retensi), `697b073` (layar Profil Perusahaan), `f562410`
(halaman), `dc1e909` (peragaan dan dokumentasi). Menutup Temuan 4.

**Yang sekarang berdiri:**

- `shared/documentRetention.ts` — aturan Pasal 48 murni: nasabah 5 tahun sejak yang **terakhir** di
  antara berakhirnya hubungan usaha, transaksi COMPLETED terakhir, dan ketidaksesuaian profil;
  dokumen/bon transaksi 10 tahun sejak **akhir tahun buku**, kalah oleh tenggat nasabah yang lebih
  jauh; dokumen profil perusahaan aturan rumah 5 tahun sejak diunggah (**bukan** Pasal 48).
- `customers.relationshipEndedAt` ditulis `updateCustomer` lewat `relationshipEndValues`, pola
  `highRiskResetValues`: hanya pada perpindahan status.
- `server/companyProfileDocuments.ts` menggantikan `deleteCompanyDocument`: nonaktif (CONTROLLER+,
  alasan wajib) dan hapus permanen (SHAREHOLDER saja; audit berisi metadata lengkap ditulis
  **sebelum** `DELETE`; objek penyimpanannya dibiarkan). Gerbang di router **dan** di penulis.
- `server/documentRetentionGuard.test.ts` — satu-satunya `delete(operationalDocuments)` yang boleh
  ada di `server/`. **Dibuktikan menangkap** dengan sisipan sementara.
- `server/documentRetentionQueries.ts` + `documents.retentionStatement`/`retentionOverview`
  (CONTROLLER+), dan halaman `/kepatuhan/penatausahaan-dokumen` (sidebar Pengawasan).
- Peragaan dapat diulang sebagian: `./node_modules/.bin/tsx scripts/peragaanPaketM.mts
  pernyataan <customerId> | tolak-controller <documentId> | audit` (basis data lokal saja).

**Yang tidak boleh diturunkan ulang:**

- **Premis Temuan 4 sudah dikoreksi** — Pasal 48 hanya mengikat data Pengguna Jasa dan
  transaksinya; logo dan izin usaha bukan dokumen Pasal 48. Penjelasan Pasal 9, 32, 47, dan 48 sudah
  dibaca dari `PBI_102024.pdf` milik pengguna.
- **Empat keputusan pengguna 11 September 2026** (tertulis di spec): cakupan jalur hapus + retensi;
  `COMPANY` dinonaktifkan dan hapus permanen hanya SHAREHOLDER; jam dokumen perusahaan sejak
  diunggah; berkas yatim dibiarkan — `server/storage.ts` **sengaja** tanpa penghapus objek.
- **Yang lewat tenggat TIDAK dihapus dan tidak diusulkan dihapus** — Pasal 48 batas paling singkat,
  ayat (6) membolehkan lebih lama. Jangan menambah tombol "bersihkan".
- **Tahun buku dibaca di zona operasional** (`operationalDateKey`), bukan `getUTCFullYear()` seperti
  potongan rencana aslinya — bon 00:00–06:59 WIB tanggal 1 Januari semula jatuh ke tahun sebelumnya.
- **`INACTIVE` tanpa `relationshipEndedAt` diperlakukan belum berdetak**, bukan ditebak dari
  `updatedAt`. Tenggat yang terlalu cepat adalah satu-satunya kekeliruan yang tidak boleh terjadi.
- **Korespondensi ditulis "tidak ditatausahakan di aplikasi ini"**, bukan angka nol.

**Risiko residual yang jujur harus disebut:**

1. **Tampilan CONTROLLER di Profil Perusahaan belum pernah dilihat di layar** (tombol *Hapus
   permanen* seharusnya tidak ada). Dijaga uji otorisasi, gerbang penulis, dan skrip peragaan
   terhadap baris `test-controller` asli — tetapi layarnya belum.
2. **Unggah dokumen dan tombol "Lihat" belum pernah dijalankan sungguhan** di lingkungan mana pun
   (warisan Paket I; R2 lokal tidak ada).
3. **Nasabah yang sudah `INACTIVE` sebelum migrasi `0058` tidak punya jam retensi** sampai diaktifkan
   dan dinonaktifkan kembali. Tidak ada pengisian mundur; itu keputusan yang belum diambil.
4. Nasabah baru dengan KTP → bon selesai tidak diperagakan dari nol; peragaan memakai CIF-000001
   yang sudah bertransaksi, dan dokumen underlying lewat SQL.
5. `documentRetentionOverview` membaca seluruh transaksi COMPLETED milik nasabah tidak aktif ke memori
   untuk mencari yang terakhir. Wajar untuk skala satu gerai; perlu agregasi SQL bila datanya besar.
6. Migrasi `0058` **sudah diterapkan ke produksi** pada penerapan 12 September 2026.

---

### Pekerjaan yang sudah teridentifikasi tetapi belum dirancang

Urut sesuai usul pada `specs/2026-09-09-pbi-10-2024-temuan-awal.md`:

1. ~~**Temuan 4 — `deleteCompanyDocument`**~~ — **SELESAI 11 September 2026 sebagai Paket M.**
2. **Temuan 3 — pemblokiran serta merta dan pencatatan percobaan transaksi** (Pasal 47 ayat 1
   huruf d). **DIRANCANG 28 September 2026** — rencana `plans/2026-09-28-butir-b-sebelum-desktop.md` Tugas 1–6. ~~Menunggu keputusan pengguna~~, dan menuntut penulis data yang belum ada sama sekali.
3. **Temuan 7 — penginian berkala klasifikasi risiko** (Pasal 9 ayat 6) — menaikkan risiko residual
   Paket J2 nomor 3 menjadi kewajiban. **DIRANCANG 28 September 2026** — rencana butir B Tugas 7–8
   (klasifikasi saja; tinjauan berkala per nasabah tidak dibangun).
4. ~~**Tanggal nota memakai zona waktu peramban**~~ — **SELESAI** (`b7bf632`, `client/src/pages/transactions/notaDate.ts`: zona Profil Perusahaan; diperiksa 12 Nov 2026).
5. **Penjelasan Pasal 9, 32, 47, dan 48 PBI 10/2024 sudah dibaca** (sesi rancangan Paket M,
   11 September 2026); tidak satu pun mengubah Temuan 1, 2, 5, atau 7. Penjelasan pasal lain belum
   dibaca — **baca penjelasannya sebelum temuan mana pun menjadi rencana.**
6. **BAB VI dan BAB IX–XI PBI 10/2024 belum dibaca terhadap kode.**
7. ~~**Kolom `defaultNow()` menyimpan jam dinding mesin basis data**~~ — **SELESAI 26 September 2026**
   (`67eaf99`): setiap sambungan bersesi UTC dan server menolak menyala bila tidak; spec
   `specs/2026-09-26-zona-waktu-utc-design.md`, rencana `plans/2026-09-26-zona-waktu-utc.md`.
8. **DIPUTUSKAN 28 September 2026: Controller mengisi dengan sumber wajib** (rencana butir B Tugas 9;
   tidak pernah diisi otomatis). **Pengisian mundur `customers.relationshipEndedAt`** bagi nasabah yang sudah `INACTIVE` sebelum
   migrasi `0058` (ditemukan Paket M). Sampai itu diputuskan, nasabah tersebut tanpa jam retensi dan
   tampil pada kartu *Tidak aktif tanpa tanggal berakhir*. **Butuh keputusan pengguna**: tanggal
   mana yang sah dipakai — menebak dari `updatedAt` sudah ditolak.
9. ~~**GitHub Action penerapan tidak pernah berhasil**~~ — **TUNTAS 12 Nov 2026**: `deploy.yml` dihapus di `6fe6211`; `main` di-fast-forward ke `3ce8aec` tanpa run baru. Penerapan = bundle + VPS (`docs/deployment/vps.md`). — setiap run (`1be46a0`, `85aee5a`, `724de6b`)
   gagal dalam hitungan detik di langkah *Deploy over SSH*, sebelum `deploy.sh` berjalan. Kemungkinan
   rahasia `SSH_*`/`DEPLOY_PATH` pada environment `production` belum benar atau firewall menolak
   GitHub. Log galatnya hanya terlihat oleh pemilik repo di tab Actions. Sampai diperbaiki, setiap
   push ke `main` menghasilkan satu run gagal dan penerapan dilakukan manual.
10. **DIBUANG ke ROADMAP 28 September 2026** (calon sesudah desktop, dibuka hanya bila toko memintanya).
    **Harga per seri uang kertas (lama/baru)** — dikeluarkan dari sub-proyek 1B (spec 2026-09-13 §B4).
    Seri tidak tercatat di skema mana pun; menambahkannya mengubah `cash_denomination_balances`, sumber
    kebenaran kas. Sampai diputuskan, selisih harga karena seri diketik pada bon dalam toleransi atau
    dengan alasan. **Butuh keputusan pengguna** sebelum dirancang.

**Antrean migrasi produksi = 1 (`0059`)** per 21 September 2026: berkas 60, jurnal produksi masih 59.
Sebelum `0059` antreannya kosong (jurnal 59 = berkas 59 sejak penerapan 12 September 2026). Migrasi
berikutnya ikut penerapan manual `deploy.sh`, dan tetap tidak boleh diterapkan tanpa permintaan
eksplisit pada giliran itu. Hook `~/.claude/hooks/aturan-keras.sh` dahulu menyuntikkan angka basi
("antrean 23, `0034`-`0056`") ke setiap prompt bertopik migrasi; **sudah diperbaiki 16 September 2026**
dan wajib ikut diperbarui setiap kali antrean berubah.

---

## Bila sesuatu tidak sesuai

- **Rujukan berkas:baris meleset** — percayai kodenya, bukan dokumennya, lalu perbarui barisnya
  sambil lewat.
- **Sebuah tugas membengkak melebihi berkas yang disebutkan** — berhenti dan laporkan sebelum
  melanjutkan. Jangan meneruskan diam-diam.
- **Sebuah keputusan kebijakan muncul di tengah eksekusi** — berhenti dan tanyakan. Kembalikan
  `skipped` beserta alasannya lebih baik daripada menebak.
- **Jumlah uji berubah** — sebutkan angka yang benar-benar dilihat, dan jelaskan mengapa berubah.
