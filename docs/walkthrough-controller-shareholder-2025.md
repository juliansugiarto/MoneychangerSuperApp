# Walkthrough Latihan Controller–Shareholder 2025

## Batas latihan

Walkthrough pada 24 Agustus 2026 memakai tiga workbook perusahaan: `PnL 2025.xls` untuk FORM B0003, `Balance Sheet 2025.xls` untuk FORM B0002, dan `Equity 2025.xls` untuk FORM B0004. Runner hanya membaca berkas sumber dalam memori. Tidak ada unggahan S3, akses tulis database, pembuatan snapshot, paket regulator, register insidental, mutasi kas, ataupun pengiriman ke regulator.

> Hasil ini membuktikan alur aplikasi dan pemetaan teknis. Hasil ini **bukan** persetujuan akuntansi, pernyataan kepatuhan, atau bukti laporan telah disampaikan kepada regulator.

## Hasil langkah peran

| Langkah | Peran latihan | Hasil |
|---|---|---|
| Membaca dan memetakan workbook | Controller | 25 pos B0003, 19 pos B0002, dan 14 pos B0004 terbaca. |
| Validasi tiga kelompok | Controller | Lulus tanpa error atau peringatan. |
| Menyiapkan draf | Controller | Status latihan berubah `DRAFT` → `PREPARED`. |
| Mencoba persetujuan diri sendiri | Controller | Diblokir oleh maker-checker. |
| Menyetujui setelah pemeriksaan | Shareholder berbeda | Status latihan berubah `PREPARED` → `APPROVED`. |
| Mencatat cetak/ekspor latihan | Controller | Status latihan berubah `APPROVED` → `EXPORTED`. |

## Bukti isolasi

Pemeriksaan database setelah runner selesai menunjukkan nol snapshot keuangan, nol paket regulator, nol register insidental, dan nol audit action pelaporan yang dibuat oleh walkthrough. ID snapshot dan paket produksi pada hasil runner adalah `null`, dengan jumlah penulisan produksi `0`.

## Catatan penggunaan pertama

Ketiga workbook aktual masih merupakan berkas terpisah. Fitur impor aplikasi menerima satu workbook XLSX/XLS yang memuat ketiga form. Pada penggunaan produksi pertama, Controller perlu menyatukan form yang sudah direkonsiliasi ke satu workbook atau mengisi tiga kelompok pos melalui form sebelum menyimpan snapshot. Shareholder harus memeriksa periode, sumber, angka, dan bukti sebelum memberikan persetujuan.
