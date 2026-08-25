# Rancangan Pusat Pelaporan Regulator — Fase Aman

## Dasar regulasi dan ruang lingkup

SEBI 18/42/DKSP menyebut Laporan Kegiatan Usaha (LKU), laporan keuangan, dan laporan insidental sebagai kelompok laporan KUPVA Bukan Bank. Portal Integrasi Pelaporan BI dapat diakses oleh pelapor terdaftar, tetapi tidak ada spesifikasi API publik yang telah diverifikasi untuk pengiriman aplikasi-ke-aplikasi. Fase ini karena itu hanya menghasilkan **paket manual siap unggah**, bukan pengiriman ke regulator.

Verifikasi ulang sumber publik pada 24 Agustus 2026 mengonfirmasi kategori LKU, laporan keuangan, dan laporan insidental. Sumber tersebut tidak memuat kredensial pelapor PT IBV, template/metadata yang disahkan untuk periode berjalan, jadwal spesifik perusahaan, atau spesifikasi pengiriman aplikasi-ke-aplikasi. Karena itu, modul tidak menyediakan pengiriman otomatis. Petugas berwenang harus memperoleh ketentuan tersebut melalui kanal resmi BI sebelum pengiriman dapat dirancang.

## Sumber data aktual

| Paket | Sumber di aplikasi | Cakupan otomatis | Batas yang ditampilkan |
|---|---|---|---|
| LKU jual/beli UKA | Bon transaksi live, mata uang, kurs snapshot, nominal valas, nilai Rupiah, status | Agregat beli/jual per mata uang serta total transaksi selesai pada periode | Cek Pelawat tidak dimodelkan; data draft, dibatalkan, simulasi, dan historis tidak dimasukkan. |
| Laporan keuangan | Belum ada buku besar/GL produksi pada aplikasi | Pemeriksaan kesiapan dan daftar komponen yang wajib disediakan | Neraca, laba rugi, dan perubahan ekuitas tidak akan dihitung dari kas/bon semata. |
| Laporan insidental | Audit log, acknowledgement, transaksi, pengaduan, kurs, dan kas | Daftar kejadian yang perlu dipilah petugas | Narasi, kategori, dan keputusan apakah wajib lapor tidak otomatis dibuat. |

## Kontrol paket

1. Controller dapat membuat snapshot paket untuk rentang waktu eksplisit. Sistem menghitung hanya data live dan menyimpan hash ringkasan.
2. Controller menyiapkan paket setelah memeriksa peringatan validasi. Paket yang disiapkan tidak dapat diubah tanpa membuat draf baru.
3. Shareholder yang **bukan pembuat paket** menyetujui paket. Persetujuan mengunci snapshot dan mencatat waktu, pelaku, serta catatan pada jejak audit.
4. Paket yang telah disetujui dapat diekspor/cetak sebagai bahan unggah manual. Aplikasi tidak memiliki tombol kirim atau kredensial Bank Indonesia pada fase ini.

## Lanjutan: sumber keuangan dan laporan insidental

Dokumen perusahaan yang tersedia memperlihatkan struktur **FORM B0002** (neraca), **FORM B0003** (laba/rugi), dan **FORM B0004** (perubahan ekuitas) untuk periode 2025. Sistem tidak akan menarik angka tersebut dari bon, saldo kas, atau simulasi. Sebagai gantinya, Controller memasukkan snapshot yang sudah direkonsiliasi, dengan periode, referensi sumber, tiga kelompok angka, pemeriksaan kelengkapan, hash, dan jejak audit.

Snapshot keuangan kemudian dapat dibuat menjadi paket `FINANCIAL_READINESS` pada alur maker-checker yang sama. Paket hanya dapat mewakili satu snapshot yang telah ditetapkan untuk periode tersebut. Ini menjaga agar versi angka yang diperiksa tidak berubah saat data operasi bergerak.

Laporan insidental akan menggunakan register terpisah berisi kategori, tanggal kejadian, judul, uraian, referensi bukti internal, tindakan awal, dan status kerja. Sistem membantu mengelola bukti dan persetujuan; sistem tidak menentukan bahwa suatu kejadian wajib dilaporkan, tidak menyusun narasi regulator otomatis, dan tidak mengirimkan data keluar.

### Kontrol yang diterapkan

| Komponen | Kontrol |
|---|---|
| Snapshot keuangan | Controller memasukkan pos dalam format `kode | nama pos | nilai`; sistem menolak nilai bukan desimal, kode ganda, dan kelompok B0002/B0003/B0004 yang kosong. |
| Impor workbook | Controller atau Shareholder dapat mengimpor XLSX/XLS sampai 5 MB yang memuat FORM B0002, B0003, dan B0004. Berkas sumber disimpan terkelola, pos dipetakan untuk pemeriksaan sebelum snapshot disimpan, dan CSV tidak dipakai karena tiga form membutuhkan workbook. |
| Bundle tiga workbook | Bila B0002, B0003, dan B0004 tersedia sebagai tiga workbook terpisah, Controller atau Shareholder dapat memilih ketiganya sekaligus. Sistem menolak form ganda atau form yang kurang dan memetakan pos dalam memori untuk pemeriksaan. Tidak ada berkas sumber, snapshot, atau paket yang disimpan sampai pengguna menekan simpan snapshot. |
| Paket keuangan | Snapshot tervalidasi dapat menjadi `FINANCIAL_READINESS` dan mengikuti period lock serta maker-checker paket regulator. |
| Register insidental | Controller membuat draf kejadian berbukti; Controller menyiapkan; Shareholder yang berbeda menyetujui; cetak/ekspor hanya mencatat paket manual. |
| Isolasi | Snapshot keuangan dan register insidental tidak mengubah bon, kurs, saldo kas, stock opname, ataupun data simulasi. |

Regresi terakhir menjalankan 36 berkas uji dan 133 pengujian. Cakupan baru membuktikan parser workbook B0002/B0003/B0004, validasi tiga kelompok laporan keuangan, penolakan kode/nilai tidak sah, isolasi dari tabel transaksi dan kas, workflow insidental maker-checker, serta batas peran Controller/Shareholder.

Rute Pelaporan Regulator juga diperiksa pada viewport desktop dan seluler dalam kondisi tanpa autentikasi; kontrol akses tidak mengekspos data pelaporan. Kontrak alur dan otorisasi diuji otomatis. Pada walkthrough visual terautentikasi pengembangan, Controller memeriksa Pusat Kesiapan, indikator Paket Pelaporan, pilihan tiga workbook, panduan peran, serta unduhan template; Shareholder memeriksa akses pelaporan dan panduan maker-checker. Tidak ada aksi simpan, siapkan, setujui, atau ekspor yang dijalankan.

Layar pelaporan menyediakan urutan kerja ringkas untuk Controller dan Shareholder. Controller memilih sumber, memeriksa pos serta periode, menyimpan snapshot, membuat draf, dan menyiapkan paket. Shareholder yang berbeda memeriksa sumber serta angka sebelum persetujuan. Ekspor tetap hanya menghasilkan paket manual; tidak ada pengiriman regulator. Regresi terakhir menjalankan 36 berkas uji dan 136 pengujian, termasuk pemetaan bundle tiga workbook tanpa storage key sebelum snapshot disimpan.

Template workbook kosong FORM B0002, B0003, dan B0004 dapat diunduh oleh Controller atau Shareholder terautentikasi. Template hanya memuat penanda form serta kolom; template tidak mengandung angka contoh atau data keuangan. Layar juga menunjukkan pengingat di tempat untuk jumlah paket `DRAFT` dan `PREPARED`. Pengingat ini tidak mengirim notifikasi, tidak membuat tugas eksternal, dan tidak mengirim data regulator.

Pusat Kesiapan Operasional untuk Controller turut menampilkan kontrol keenam, yaitu Paket Pelaporan. Kontrol ini menampilkan jumlah draf dan paket `PREPARED`, lalu menautkan pengguna ke Pusat Pelaporan Regulator. Kontrol bernilai siap hanya bila tidak ada paket yang menunggu tindak lanjut dan pembacaan data berhasil; pengingat tetap bersifat baca-saja dan tidak mengubah paket. Aturan status siap, perlu tindakan, dan sumber tidak tersedia telah diuji; regresi terakhir menjalankan 38 berkas uji dan 139 pengujian.

Paket berstatus `PREPARED` kini dapat dikembalikan oleh Shareholder yang berbeda dari pembuat/penyiap, dengan catatan pengembalian wajib. Status `RETURNED` menjadi jejak review; Controller tidak dapat mengubah snapshot secara otomatis dan harus memperbaiki sumber lalu membuat draf paket baru. Period lock tidak menahan paket yang dikembalikan, sehingga koreksi draf dapat dibuat untuk periode yang sama tanpa menghapus jejak paket terdahulu.

Controller atau Shareholder dapat menetapkan atau menghapus tenggat manual pada draf, paket siap diperiksa, atau paket dikembalikan dengan alasan wajib. Tenggat hanya menghasilkan label dan indikator terlambat di layar. Fitur ini tidak menjadwalkan pekerjaan, tidak mengirim notifikasi, tidak mengubah status, dan tidak mengirim data ke regulator. Pengembalian dan tenggat hanya menulis tabel paket regulator serta audit log; tidak menyentuh transaksi, kas, stock opname, snapshot keuangan, atau register insidental. Regresi terbaru menjalankan 39 berkas uji dan 143 pengujian; verifikasi database setelah uji tetap menunjukkan nol snapshot keuangan, nol paket regulator, dan nol register insidental.

Indikator prioritas paket ditampilkan jelas sebagai `PERLU PERBAIKAN` untuk paket yang dikembalikan serta `TERLAMBAT`, `HARI INI`, atau `MENDATANG` untuk tenggat manual. Indikator tersebut adalah klasifikasi tampilan dari status dan waktu tenggat saat halaman dibuka; tidak membuat prioritas persisten, tidak mengubah status, dan tidak memicu notifikasi.

Kartu **Latihan review paket terisolasi** tersedia untuk walkthrough awal. Sebagai Controller pengembangan, pengguna dapat menyimpan atau menghapus tenggat latihan; sebagai Shareholder pengembangan, pengguna dapat mengembalikan latihan dengan catatan wajib. Kartu hanya berada di memori browser dan hilang saat halaman dimuat ulang atau sesi berubah. Walkthrough menunjukkan toast sukses tenggat dan pengembalian latihan, serta indikator `HARI INI` dan `PERLU PERBAIKAN`; pemeriksaan database sesudahnya membuktikan nol snapshot keuangan, nol paket, nol register insidental, dan nol audit tindakan pelaporan yang dibuat dari latihan.

Sesudah walkthrough pengembangan, pemeriksaan database tetap menunjukkan nol snapshot keuangan, nol paket regulator, dan nol register insidental. Pada penggunaan pertama oleh akun perusahaan, Controller dan Shareholder tetap harus mengunduh template dari sesi nyata serta memeriksa indikator berdasarkan paket aktual. Pemeriksaan tersebut tidak boleh menekan simpan, persetujuan, atau ekspor kecuali setelah angka dan otorisasi benar-benar ditelaah.

## Pemetaan awal LKU

| Elemen LKU | Field aplikasi |
|---|---|
| Periode | `transactionAt` dalam zona bisnis Jakarta |
| Jual/beli UKA | `operation` (`SELL`/`BUY`) |
| Mata uang | `currencies.code` |
| Nominal UKA | `foreignAmount` |
| Kurs | `rateSnapshot` dan `quoteUnitSnapshot` |
| Nilai Rupiah | `rupiahAmount` |
| Bukti penelusuran | `transactionNumber`, status, audit log |

## Referensi

1. [SEBI 18/42/DKSP — Kegiatan Usaha Penukaran Valuta Asing Bukan Bank](https://www.bi.go.id/id/publikasi/peraturan/Pages/SE_184216.aspx)
2. [Portal Integrasi Pelaporan Bank Indonesia](https://pelaporan.bi.go.id/)
