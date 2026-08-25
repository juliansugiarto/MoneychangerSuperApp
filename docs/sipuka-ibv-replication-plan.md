# Pemetaan SIPUKA ke IBV dan Prioritas Replika

## Ringkasan Keputusan

SIPUKA yang diamati menggunakan pola back-office PUKA dengan kelompok modul transaksi, kurs dan stok, data master, pelaporan, pengaturan, serta analitik lintas cabang. Pada IBV, fondasi operasi inti—nasabah/KYC, kurs ber-snapshot, bon jual-beli, peninjauan, stok, laporan, pengaduan, layanan, hak akses, dan jejak audit—sudah tersedia. Replika tidak menyalin data, identitas visual, kredensial, atau logika tertutup sistem sumber. Sebaliknya, implementasi akan mengadopsi **pola kerja** yang relevan sambil mempertahankan kontrol IBV yang telah divalidasi: status immutable untuk kurs transaksi, transaksi berjenjang, pemisahan data historis, dan audit perubahan.[1] [2]

| Tingkat | Keputusan | Alasan |
| --- | --- | --- |
| **P0** | Monitoring operasional dengan filter periode, arah transaksi, metrik, dan keadaan kosong nyata. | Ini adalah celah antarmuka paling relevan terhadap Beranda/Monitoring Cabang SIPUKA, tetapi dapat dibangun dari data IBV yang telah ada tanpa skema cabang palsu. |
| **P0** | Navigasi menuju modul transaksi, kurs, nasabah, stok, laporan, audit, pengguna, pengaduan, dan layanan. | Kemampuan operasional tersebut telah tersedia di kontrak IBV dan akan diposisikan lebih jelas sebagai konsol back-office. |
| **P1** | Pemisahan tampilan BNS/BNB, worklist review, dan peringatan screening pada monitoring. | IBV sudah menyimpan arah transaksi, status review, underlying, dan alasan review; penyajian agregat akan menambah keterbacaan tanpa mengubah proses persetujuan. |
| **P2** | Pelaporan kepatuhan khusus, multi-cabang, impor, invoice, wilayah, dan manual in-app yang lengkap. | Menu SIPUKA mengindikasikan keluarga fungsi tersebut, namun detail modul tidak terobservasi pada sesi baca-saja dan model data IBV saat ini adalah satu organisasi/outlet. Implementasi memerlukan keputusan bisnis, skema, dan pengujian tersendiri. |

## Matriks Cakupan

| Kelompok SIPUKA | Fungsi teramati | Status IBV saat ini | Tindakan replika |
| --- | --- | --- | --- |
| Beranda | Ringkasan transaksi, filter waktu/sumber, aksi cepat, status screening, tren, dan keadaan kosong. | `OperationsDashboard` memiliki ringkasan hari ini, antrian review, saldo, variance, dan checklist. | Tambahkan Monitoring Operasional berbasis periode dengan metrik dan tren yang dihitung dari transaksi IBV. |
| Monitoring Cabang | Filter sumber/periode/tanggal/cabang/jenis serta peringkat dan sinyal risiko. | Tidak ada model cabang; data transaksi dan review tersedia. | Replika sebagai **Monitoring Operasional satu outlet**. Jangan memalsukan peringkat cabang atau data demo. |
| Transaksi | Daftar gabungan, BNS, BNB, impor, worklist review, dan arsip transaksi terhapus. | Form bon jual/beli, daftar status, draft, submit, cancel, review, selesai, dan audit telah ada. | Tampilkan indikator BNS/BNB dan worklist pada monitoring; impor dan arsip penghapusan menunggu rancangan retention/data migration. |
| Kurs dan stok | Pengelolaan kurs valas dan stok valas. | Snapshot referensi, proposal/aktivasi kurs, saldo, opening cash, stock opname, variance, dan rekonsiliasi tersedia. | Pertahankan proses kurs/stok IBV; tambahkan jalan pintas dan status pada konsol monitoring. |
| Nasabah | Data Nasabah. | KYC dengan CIF, identitas, kedaluwarsa dokumen, risiko, sumber dana, dan tujuan tersedia. | Gunakan halaman nasabah IBV; jangan menyederhanakan validasi KYC untuk mengejar kesamaan tampilan. |
| Struktur organisasi | PUKA & Cabang, Profil PUKA, User PUKA, Wilayah. | Manajemen user internal tersedia; entitas cabang/wilayah belum dimodelkan. | Tunda sampai struktur organisasi dan segregasi data disepakati. |
| Laporan | Transaksi, rekap, kurs, underlying, pembayaran, TKT/TKM, SIPESAT, pecahan, konsolidasi. | Laporan transaksi, opname, historis, dan audit tersedia. | Pertahankan laporan yang memiliki data sumber IBV; kepatuhan/pelaporan regulator khusus memerlukan definisi dan sumber data yang disetujui. |
| Pengaturan | Invoice. | Ambang review/EDD tersedia. | Tunda nomor invoice/pengaturan dokumen sampai kebutuhan bisnis ditetapkan. |
| Bantuan | User Manual. | Dokumen operasi proyek tersedia, belum dipaparkan di aplikasi. | P2: rancang panduan kontekstual berbasis SOP; jangan menerbitkan klaim regulasi yang belum disetujui. |

## Prinsip Implementasi

Monitoring tidak boleh mengubah data ketika pengguna memperbarui filter atau grafik. Semua aksi yang memiliki dampak, seperti mengirim bon, menyetujui review, mengaktifkan kurs, merekonsiliasi stok, atau mengelola akun, harus tetap memanggil prosedur yang memiliki izin backend. Hak Controller akan digunakan untuk layar monitoring lintas proses; staf tetap memperoleh alur kasir yang sudah ada. Setiap statistik akan menghitung hanya data IBV yang terdaftar dan, jika tidak ada data, menampilkan keadaan kosong eksplisit.[1]

Metrik BNS dan BNB pada konsol akan dibentuk dari `operation` transaksi IBV, bukan dari data baru: **BUY** berarti bon beli valuta (nasabah menjual valuta) dan **SELL** berarti bon jual valuta (nasabah membeli valuta). Rasio review memakai transaksi yang `requiresReview`, sedangkan antrian review menggunakan status `PENDING_REVIEW`. Konvensi ini konsisten dengan alur transaksi dan kriteria penerimaan IBV.[1] [2]

## Cakupan Iterasi Ini

Iterasi ini mengimplementasikan halaman **Monitoring Operasional** untuk Controller. Halaman tersebut memakai laporan transaksi yang ada dan menambahkan filter rentang tanggal serta arah transaksi, kartu metrik transaksi/nilai/nasabah/review, daftar transaksi terkini, komposisi mata uang, tren harian, dan navigasi aman ke modul operasional yang ada. Tidak ada data demo, seed, maupun testimoni yang akan dibuat. Tidak ada otomatisasi, sinkronisasi eksternal baru, atau pelaporan regulator yang akan ditambahkan dalam iterasi ini.

## Verifikasi Iterasi

Pemeriksaan TypeScript dan seluruh rangkaian unit test proyek dijalankan setelah implementasi; hasilnya **26 berkas test dan 91 test lulus**. Pengujian baru menegaskan tiga perilaku penting: keadaan kosong menghasilkan nol tanpa metrik rekaan, nominal bon beli/jual dihitung dalam minor-unit agar presisi terjaga, dan filter arah transaksi mempertahankan sinyal review dari catatan asli. Rute `/operasional/monitoring` juga telah diperiksa pada pratinjau proyek: akses tanpa sesi menampilkan pengaman area staf dan tidak membocorkan data monitoring.

Dalam kondisi aplikasi, navigasi menu Monitoring dibatasi untuk peran Controller pada antarmuka dan prosedur laporan dilindungi kembali di backend. Halaman menunjukkan state memuat sebelum statistik dihitung, state gangguan dengan tombol coba lagi ketika laporan gagal dibaca, dan state kosong hanya setelah respons laporan berhasil tanpa transaksi. Pemeriksaan tampilan data berisi memerlukan sesi Controller aktif serta data transaksi non-historis pada lingkungan pengguna; halaman sengaja tidak menyuntikkan transaksi contoh demi memenuhi prinsip tidak menggunakan data operasional fiktif.[2]

## Referensi

[1]: ./sipuka-feature-inventory.md "Inventarisasi fitur SIPUKA — hasil peninjauan baca-saja"
[2]: ../v1-use-cases.md "Matriks Validasi V1 — PT IBU KOTA VALASINDO"
