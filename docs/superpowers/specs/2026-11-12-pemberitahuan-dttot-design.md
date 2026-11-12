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

## Penyesuaian 12 November 2026 (sore)
Surat disamakan dengan laporan yang benar-benar pernah dikirim pemilik dan diterima Densus (Drive: "DTTOT 20 April
2026.docx", "Penghapusan dari DTTOT & Buka Blokir 2020.docx"): pembuka "Merujuk Surat Kepala Kepolisian … No. …
tanggal … perihal …", alamat Jalan Trunojoyo No. 3 Kebayoran Baru Jakarta 12110, "Hormat kami", tembusan Kepala
Kantor Perwakilan BI (+ PPATK, sesuai tata cara 7 Jul 2026), kota kepala surat dari isian (bukan "Jakarta" tetap).
Migrasi `0065`: `policeLetterDate`, `reportPlace`. Penghapusan → laporan nihil penghapusan, ditolak selama ada blokir
OPEN yang namanya sudah tidak ada di daftar (`staleOpenBlockCount`).

## Penyesuaian 12 November 2026 (lampiran BI diunduh)
- `DTTOT OKTOBER.xlsx` (P-25): pengimpor membaca 530 entri (411 Orang, 119 Korporasi, sama persis dengan kolom
  "Terduga"), 530 kode unik, 450 beralias; impor ke `moneychanger` 0,16 detik. Satu salah ketik di daftar resmi
  (ELQ-069 "…(JAK-A) aliasJUND AL KHALIFA") kini terpisah juga (`splitAliasNames`).
- Formulir "Lamp 2" BI → Laporan Pembukaan Pemblokiran + Berita Acara Pembukaan Pemblokiran per nasabah. Sumber
  datanya blokir `DICABUT` yang rujukan pencabutannya memuat nomor surat Densus pemberitahuan. Tembusan surat hanya
  Kepala Kantor Perwakilan BI (seperti formulir); PPATK lewat surel. Perihal surat penghapusan mengikuti formulir.

## Sengaja belum
- Daftar DPPSPM (laporan ke PPATK) menyusul dengan pola sama.
