# Audit Penggunaan dan Simulasi Kontrol

## Snapshot penggunaan

Audit baca-saja pada 24 Agustus 2026 menemukan 7 kurs outlet aktif, 2 transaksi live, 1 nasabah live, 1 saldo kas tercatat, dan 1 stock opname live yang masih terbuka/menunggu rekonsiliasi. Tidak ada transaksi live berstatus selesai, transaksi menunggu review, maupun paket regulator yang telah dibuat pada saat audit.

> Status ini adalah snapshot penggunaan, bukan penilaian kepatuhan atau kesimpulan bahwa suatu laporan wajib/tidak wajib disampaikan.

## Dampak operasional

| Temuan | Kontrol yang diterapkan | Tindakan pengguna |
|---|---|---|
| Transaksi belum selesai | Snapshot LKU menghitung hanya bon live berstatus `COMPLETED`. | Selesaikan alur bon dan review yang memang sah sebelum membuat paket LKU. |
| Stock opname terbuka | Pusat Kesiapan tetap menampilkan item pengawasan/rekonsiliasi. | Selesaikan hitung fisik dan review varians sesuai kewenangan. |
| Pelaporan regulator belum memiliki paket | Pusat Pelaporan dapat membuat draf LKU manual dari snapshot live. | Pastikan periode dan isi paket diperiksa sebelum disiapkan. |
| Risiko persetujuan diri sendiri | Maker-checker memblokir pembuat paket menyetujui paketnya sendiri. | Shareholder lain melakukan pemeriksaan dan persetujuan. |

## Simulasi A–Z yang dijalankan

Regresi terfokus menjalankan 56 pengujian pada 10 berkas uji untuk kalkulasi bon, guncangan kurs, rekonsiliasi kas, checklist, pengawasan, isolasi demo/historis, arsip cetak, navigasi, otorisasi, dan snapshot LKU. Uji tambahan juga membuktikan Controller dapat mencatat ekspor manual, Shareholder saja yang dapat menyetujui, serta Staff tidak dapat membuka pratinjau paket. Semua lulus. Pemeriksaan TypeScript juga lulus.

Kontrol kritis yang dibuktikan meliputi: hasil simulasi tidak menciptakan nomor bon atau data produksi; demo dan historis tidak masuk laporan live; snapshot LKU mengabaikan transaksi yang tidak selesai, demo, serta historis; period lock menahan paket aktif kedua untuk jenis dan periode yang sama; dan persetujuan paket ditahan jika maker sama dengan checker.

## Pemeriksaan antarmuka

Halaman Pelaporan Regulator telah diperiksa pada viewport desktop dan seluler untuk rute yang terlindungi. Pada kedua ukuran layar, akses tanpa autentikasi menampilkan panel masuk yang utuh, dapat dibaca, dan tidak memaparkan data operasional. Verifikasi tindakan di dalam halaman dilindungi pula oleh uji kontrak role-based; walkthrough visual dengan akun Controller/Shareholder perlu dilakukan kembali pada sesi yang memiliki login aktif sebelum penggunaan operasional pertama.

## Batas sistem

Pusat Pelaporan Regulator hanya membuat paket manual siap diperiksa/dicetak. Sistem tidak mengirim data ke Bank Indonesia, PPATK, atau regulator lain; tidak menyatakan pelaporan telah diterima; dan tidak mengotomatisasi penilaian apakah kejadian termasuk laporan wajib.

Verifikasi sumber publik mengonfirmasi bahwa laporan berkala mencakup LKU dan laporan keuangan, serta terdapat laporan insidental. Namun, pengguna aplikasi harus tetap memperoleh format, jadwal, akun pelapor, dan otorisasi penyampaian terbaru dari Bank Indonesia; informasi itu tidak dapat disimpulkan aman dari data aplikasi atau portal publik.
