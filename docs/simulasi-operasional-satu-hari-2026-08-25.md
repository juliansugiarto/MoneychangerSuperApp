# Simulasi Operasional Satu Hari — Terisolasi

## Status dan batas simulasi

Simulasi ini memakai workbook aktual PT Ibukota Valasindo hanya sebagai **bahan baca-saja di memori**. Tidak ada nilai keuangan sensitif, identitas nasabah, atau rincian transaksi yang disalin ke aplikasi, dokumen hasil, maupun keluaran pengguna. Tidak ada transaksi, kas, stok opname, snapshot laporan keuangan, paket regulator, register insidental, arsip, notifikasi, atau pengiriman eksternal yang dibuat.

> Hasil ini adalah bukti kesiapan alur dan guardrail aplikasi, bukan pembuktian transaksi aktual, pelaporan regulator, atau rekonsiliasi akuntansi perusahaan.

## Bahan aktual yang diperiksa

| Bahan sumber | Perlakuan simulasi | Hasil aman |
|---|---|---|
| `Balance Sheet 2025.xls`, `PnL 2025.xls`, `Equity 2025.xls` | Dipetakan bersama dalam memori sebagai B0002/B0003/B0004 | Parser menemukan masing-masing 19, 25, dan 14 pos; tidak ada snapshot atau paket dibuat. |
| `Rekap Transaksi 2026.xlsx` | Diperiksa hanya untuk keberadaan lembar data operasional | Struktur workbook terbaca; nilai dan identitas tidak diekspor. |
| `Rekap Stok Bulanan.xlsx` | Diperiksa hanya untuk keberadaan lembar stok | Struktur workbook terbaca; nilai stok tidak diekspor. |

## Walkthrough satu hari

| Tahap | Peran | Aksi yang diuji | Hasil |
|---|---|---|---|
| Awal hari | Staff | Membuka ruang Simulasi Aman dan menghitung bon latihan | Hasil ditandai simulasi; tidak memiliki nomor bon atau nasabah produksi. |
| Pengawasan kurs | Staff/Supervisor | Menguji perubahan kurs terhadap ambang review | Sistem meminta review manusia; tidak mengajukan maupun mengaktifkan kurs outlet. |
| Penutupan kas | Staff | Membandingkan saldo sistem dan fisik pada latihan | Status rekonsiliasi latihan terbentuk tanpa stock opname atau mutasi kas. |
| Arsip | Staff | Memeriksa kelayakan arsip latihan | Status siap cetak latihan terbentuk tanpa arsip operasional. |
| Akses Supervisor | Admin | Memeriksa batas akses halaman Controller | Guard akses aktif; halaman Controller tidak terbuka untuk Admin. |
| Pengawasan Controller/Direksi | Controller | Membuka Pusat Kesiapan dan Direksi Mengetahui | Status dibaca tanpa aksi perubahan; tidak ada laporan Direksi menunggu pengakuan. |
| Tata kelola Shareholder | Shareholder | Membuka Pusat Pelaporan Regulator dan kartu latihan review | Workflow maker-checker, pengingat, serta batas pengiriman manual terlihat; tidak ada paket dibuat, disetujui, atau diekspor. |

## Verifikasi isolasi

Pemeriksaan basis data setelah seluruh walkthrough menunjukkan nol penulisan dalam dua jam terakhir untuk transaksi valuta, mutasi kas, snapshot laporan keuangan, paket regulator, register insidental, dokumen operasional, dan audit log produksi. Pengujian otomatis lengkap juga lulus: **40 berkas uji dan 146 pengujian**.

## Batas penggunaan berikutnya

Pada hari operasional nyata, Staff harus memakai data nasabah dan kurs yang telah disetujui di modul produksi, Supervisor menyetujui item ter-flag hanya setelah bukti lengkap, Controller meninjau kesiapan dan laporan, serta Shareholder melakukan pemeriksaan maker-checker bila paket benar-benar dibuat. Pengiriman ke regulator tetap manual dan tetap tidak tersedia dari aplikasi hingga format, kanal, jadwal, kredensial, serta otoritas PT IBV diverifikasi.
