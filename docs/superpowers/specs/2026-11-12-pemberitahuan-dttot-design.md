# Pemberitahuan DTTOT dari BI — laporan nihil / berita acara dan jejak pengiriman

Tanggal 12 November 2026 (WIB). Sumber: surel BI (DKSP, Kelompok APU PPT) yang diteruskan pemilik — 15 Okt 2026
(pencantuman/perpanjangan R/21/X/2026, P-25; penghapusan R/20/X/2026), 7 Jul 2026 (tata cara pengiriman) — dan
"Pedoman Pemblokiran Secara Serta Merta DTTOT" BI (Lampiran I Berita Acara, II Laporan Pemblokiran, III Laporan Nihil).

## Masalah
Tiap 1–3 bulan BI meneruskan surat Densus 88 + daftar DTTOT terbaru. Aplikasi sudah bisa impor daftar, menyaring,
dan memblokir, tetapi laporan nihil/berita acara dan lima pengirimannya masih dikerjakan pemilik dengan tangan.

## Rancangan
- Tabel `dttot_notices` (migrasi `0064`): jenis (PENCANTUMAN/PERPANJANGAN/PENGHAPUSAN), nomor surat Densus, nomor
  lampiran DTTOT, tanggal diterima; hasil penyaringan (waktu, jumlah nasabah disaring, jumlah cocok DTTOT); nomor
  surat laporan kita, penanda tangan; lima waktu pengiriman (fisik Densus 88, surel dttot.report.4@gmail.com,
  tembusan PPATK dttot.report@ppatk.go.id, tembusan pengawas BI, unggah formulir BI); catatan.
- "Saring sekarang" memakai `rescreenAllCustomers` (blokir otomatis tetap seperti sekarang) lalu menghitung
  kecocokan khusus daftar DTTOT dan menyimpannya pada pemberitahuan itu.
- Cetak: cocok 0 → Laporan Nihil (Lampiran III); cocok > 0 → Laporan Pemblokiran (Lampiran II) + Berita Acara per
  nasabah (Lampiran I, saksi diisi saat cetak; rekening/saldo "—" karena KUPVA tidak memegang rekening nasabah).
- Controller ke atas. Tenggat LTKM 3 hari kerja **hanya disebut**, tidak dihitung (keputusan butir B: menunggu
  Temuan 6 / kalender hari kerja).

## Sengaja belum
- Berita Acara **Pembukaan** Pemblokiran (penghapusan dari DTTOT) — formulirnya hanya ada di lampiran surel BI;
  dibangun setelah pemilik menyerahkan berkasnya. Daftar DPPSPM (laporan ke PPATK) — menyusul dengan pola sama.
