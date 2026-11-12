# Rencana bangun — halaman publik "Paspor & cap" ke aplikasi

Tanggal 12 Nov 2026 (WIB). Desain disetujui pemilik ("oke greate job"): `DESIGN.md` §Halaman publik + rujukan hidup
`docs/design/halaman-publik/rujukan-paspor-v3.html`. Isi/urutan: `docs/superpowers/specs/2026-11-12-halaman-publik-rencana-bagian.md`;
teks: `docs/superpowers/specs/2026-11-12-halaman-publik-teks.md`. Cabang: `deploy/docker-vps` (atau cabang baru dari sana).

Aturan yang mengikat: semua angka dari data asli (Profil Perusahaan, kurs aktif, permintaan layanan); tanpa stok;
pembulatan memakai `shared/rupiahRounding.ts` (sama dengan kasir); waktu WIB lewat helper `shared/regulatoryActionQueue`;
kurs tetap diaktifkan manual (halaman hanya membaca); tidak ada data uji di produksi.

## Irisan 1 — data baru beserta penulisnya
- [x] Migrasi `0067`: `company_profile.openingSchedule` (JSON 7 hari: buka/tutup "HH:MM" atau tutup) dan `moneyRules` (teks pendek, opsional). Baca SQL; hanya menambah kolom. *Dibangun sebagai JSON tiga butir (pecahan / kondisi / seri) mengikuti spec teks §4; diterapkan di moneychanger, mc_t_abcvalas, mc_t_visual (68 migrasi), BELUM di produksi.*
- [x] Penulis: Profil Perusahaan (layar + tRPC + validasi + audit) untuk jadwal per hari dan ketentuan uang.
- [x] `shared/openingStatus.ts`: status Buka / Segera tutup (30 menit) / Tutup + "buka lagi …" dalam WIB, dengan uji (termasuk Minggu, sebelum buka, tepat jam tutup, zona perangkat lain).
- [x] `publicContent.profile` mengirim jadwal, ketentuan, telepon, WhatsApp (telepon kedua), nomor izin, kode KUPVA.

## Irisan 2 — data kurs publik
- [x] Perubahan dibanding kurs sebelumnya (kurs RETIRED terakhir untuk valuta + kelompok pecahan yang sama); "Belum ada pembanding" bila tidak ada; uji. *`server/publicRatePrevious.ts` (ROW_NUMBER per valuta+kelompok; satuan kutipan beda = tanpa pembanding). Sekalian `activeRates` publik dipersempit: catatan/alasan aktivasi/id petugas tidak lagi keluar. Urutan papan tetap abjad kode valuta (uji lama); kelompok mengikuti `sortOrder`.*
- [x] Pembangun teks bagikan WhatsApp (4 valuta teratas urutan papan) di `shared/`, dengan uji.

## Irisan 3 — halaman publik React
- [x] Folder fitur `client/src/pages/publik/` (≤ ~400 baris per berkas): kepala, §1 kurs (meja desktop + daftar ponsel, saklar jual/beli), §2 pas naik hitung tukar, §3 tiket konfirmasi, §4 bagikan, §5 ketentuan, §6 lokasi, §7 resmi + penipuan, §8 pengumuman, §9 FAQ, kaki MRZ.
- [x] Token & gaya terlingkup halaman publik (tidak mengubah Konter Tebal back office).
- [x] Gerak: kedatangan, cap, rute pesawat (titik analitik), awan, spread terbuka, laminasi, angka bergulir — dengan aturan kinerja DESIGN.md.
- [x] Tiket konfirmasi memakai mutasi permintaan layanan yang sudah ada (bukan tiruan): nomor permintaan asli, masuk ke layar petugas.
- [x] Semua tautan/isian/aksi halaman lama tetap ada (daftar sebelum-sesudah di PR).

## Irisan 4 — `/papan` (TV outlet)
- [x] Rute publik `/papan`: papan kurs layar penuh, jam WIB, halaman bergilir, segarkan kurs berkala, cap "KURS BARU" bila kurs berubah.

## Irisan 5 — bukti dan rilis
- [x] Uji unit irisan 1–2; e2e: halaman publik di 390/1440, saklar, hitung, kirim tiket membuat `service_requests` di `mc_t_visual`, `/papan`.
- [x] Ukur kinerja (skrip rAF + long-animation-frame, CPU 4×): kirim tiket ≥ 55 fps, tanpa frame > 50 ms.
- [x] Tinjauan desain (tangkapan layar dibandingkan rujukan) + satu tinjauan adversarial.
- [ ] Gerbang penuh sekali; pemilik melihat di situs hidup sebelum diganti (deploy produksi = keputusan pemilik).
