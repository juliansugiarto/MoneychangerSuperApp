# Inventarisasi Fitur SIPUKA

## Catatan Akses Awal

Pada 19 Agustus 2026, halaman `https://app.sipuka.id/` dapat dijangkau dari lingkungan peninjauan, tetapi antarmukanya belum menampilkan elemen autentikasi maupun navigasi pada pemuatan awal. Belum ada interaksi atau perubahan data dilakukan pada situs sumber. Inventarisasi berikutnya akan menggunakan pemeriksaan non-destruktif untuk mengidentifikasi penyebab pemuatan dan, setelah antarmuka tersedia, mendokumentasikan modul, peran, masukan, keluaran, serta aturan validasi yang terlihat.

Setelah aplikasi selesai memuat, titik masuk berpindah ke `/login`. Halaman autentikasi menampilkan identitas siPUKA, latar bertema pelaporan valuta, kolom **Nama Pengguna** dan **Kata Sandi**, kontrol menampilkan/menyembunyikan kata sandi, opsi **Ingat saya di perangkat ini**, tindakan **Masuk** dan **Lupa kata sandi?**, serta informasi dukungan. Mekanisme autentikasi memanfaatkan rute layanan untuk penyegaran sesi, verifikasi captcha pada login, identitas merek, dan media halaman login.

Kredensial yang disediakan telah dimasukkan dan proses autentikasi dimulai. Pada tahap ini, tombol masuk menampilkan status sementara **Memproses…**; peninjauan berikutnya akan memastikan hasil autentikasi sebelum membuka modul aplikasi.

## Dashboard dan Navigasi Admin PUKA

Autentikasi berhasil dan membuka **Beranda Admin PUKA**. Beranda menyediakan pemilih sumber data, periode, tanggal, dan cakupan cabang; kartu ringkasan transaksi harian dan periode berjalan; indikator kurs USD; sinyal threshold, TKT, TKM, dan PEP; aksi cepat administrasi; ringkasan multi-cabang; serta visualisasi tren transaksi, nilai transaksi, dan mata uang. Data pada dashboard akan diperlakukan hanya sebagai indikator rancangan, bukan sebagai data untuk disalin ke IBV.

| Kelompok menu | Modul yang teramati |
| --- | --- |
| Beranda | Beranda Admin PUKA; Monitoring Cabang |
| Transaksi | Transaksi; Penjualan (BNS); Pembelian (BNB); Import Transaksi; Worklist Review; Transaksi Terhapus |
| Operasional | Kurs Valas; Stok Valas |
| Data Master | Data Nasabah; PUKA & Cabang; Profil PUKA; User PUKA |
| Laporan | Laporan Transaksi; Rekap Transaksi; Laporan Kurs; Transaksi Underlying; Metode Pembayaran; Laporan TKT; Laporan TKM; Pelaporan SIPESAT; Transaksi per Pecahan; Transaksi Konsolidasi |
| Pengaturan dan bantuan | Pengaturan Invoice; User Manual |
| Master Data | Wilayah |

## Monitoring Cabang

Modul **Monitoring Cabang** adalah konsol supervisi untuk seluruh cabang. Modul ini menyediakan peralihan sumber data live atau demo, penyaring periode, tanggal, cabang, dan jenis transaksi, serta tindakan untuk menerapkan penyaring dan menyegarkan data. Rancangan analitiknya mencakup ringkasan transaksi, nominal, nasabah, threshold, TKT, pertumbuhan, nilai rata-rata, dan rasio transaksi threshold; peringkat cabang; komposisi transaksi; perbandingan threshold dengan normal; tren 30 hari; tabel status monitoring berisiko; serta daftar cabang yang perlu perhatian. Replika IBV perlu menyediakan pola filter, metrik ringkasan, indikator risiko yang dapat ditelusuri, dan visualisasi tren, dengan data IBV sendiri serta kebijakan akses internal.

## Area Transaksi

Menu utama **Transaksi** membuka rute daftar gabungan jual/beli. Pada lingkungan peninjauan ini, konten modul masih berada dalam status **Memuat modul…** setelah penantian ulang, sehingga field, filter, tabel, dan tindakan detail belum dapat dipastikan dari antarmuka tanpa melakukan tindakan tulis. Keluarga fungsinya tetap teridentifikasi dari navigasi sebagai daftar gabungan transaksi, entri **Penjualan (BNS)** dan **Pembelian (BNB)** yang terpisah, impor, antrian review, serta arsip transaksi terhapus. Replika IBV akan memanfaatkan alur transaksi tunggal, perhitungan snapshot kurs, peninjauan berjenjang, dan audit trail yang sudah ada; pemisahan tampilan menurut jenis dan status akan dianalisis sebagai perluasan antarmuka yang aman.

Submodul **Penjualan (BNS)** juga berhasil dibuka pada rute sendiri, tetapi tetap berada pada status **Memuat modul…** selama peninjauan baca-saja. Temuan yang dapat dipastikan adalah pola desainnya: modul penjualan dipisahkan dari daftar gabungan dan pembelian, sementara detail formulirnya belum dapat diobservasi. Tidak ada data transaksi yang dibuat atau diubah.

## Operasional: Kurs Valas

Rute **Kurs Valas** tersedia sebagai modul operasional mandiri. Sama seperti beberapa modul transaksi, kontennya tidak selesai dimuat dalam sesi ini sehingga tabel kurs, periode efektif, dan tindakan administrasinya tidak dapat diobservasi secara detail. Pada IBV, kemampuan yang relevan sudah tersedia dan lebih terlindungi: pengambilan snapshot referensi BI, proposal harga operasional berversi, aktivasi kurs terkontrol, dasar kuotasi mata uang, serta ambang review/EDD. Replika akan mengutamakan transparansi status kurs aktif, pemisahan data referensi dan kurs operasional, dan jejak audit; tidak akan menyalin kredensial, data, atau logika tertutup SIPUKA.

## Batas Observasi Sesi

Antarmuka SIPUKA memuat dashboard Beranda dan Monitoring Cabang beserta permintaan ringkasannya. Namun beberapa halaman lain yang dibuka dari menu mendapatkan sumber modul terpisah dan tetap menampilkan **Memuat modul…** pada sesi peninjauan ini. Untuk menjaga integritas data sumber, peninjauan tidak akan mencoba memicu submit, unggahan, persetujuan, penghapusan, atau perubahan pengaturan guna memaksa modul tersebut. Inventarisasi fungsi yang tidak dapat dimuat akan didasarkan pada label navigasi, struktur rute, dan cakupan operasional yang dapat diverifikasi dari antarmuka, lalu ditandai sebagai perlu klarifikasi UI lebih lanjut.

## Beranda Admin PUKA

Beranda Admin PUKA adalah dashboard analitik multi-cabang. Halaman ini memuat pemilih sumber data live, periode, tanggal, cakupan cabang, dan tindakan refresh. Konten analitiknya terbagi menjadi informasi transaksi, analisis transaksi, aksi cepat admin, serta ringkasan multi-cabang. Keluaran yang terlihat mencakup tabel performa cabang menurut volume, nilai jual dan beli; transaksi terbanyak; tren jumlah dan nilai transaksi 30 hari; tren lima mata uang utama; komposisi dan peringkat nilai mata uang; analisis sepuluh mata uang terbesar dengan pemisahan BNS/BNB; screening threshold/underlying; aktivitas admin; pengumuman; dan berita terbaru. Ketika data tidak tersedia, dashboard memakai keadaan kosong eksplisit, bukan angka perkiraan.

Untuk IBV, prinsip yang relevan adalah filter waktu yang stabil, metrik yang dapat dilacak ke data transaksi, keadaan kosong yang jujur, pemisahan sumber data live dan historis, serta papan pantau screening. Cakupan cabang, berita, dan pengumuman akan diperlakukan sebagai perluasan terpisah agar tidak mengaburkan operasi satu outlet dan pemisahan data historis yang telah ditetapkan.

## Data Master: Nasabah

Rute **Data Nasabah** tersedia untuk profil nasabah, tetapi modul tidak menyelesaikan pemuatan dalam sesi baca-saja. Karena itu, field, kemungkinan tindakan perubahan, dan rincian penyaringan tidak dinyatakan sebagai fakta yang terobservasi. Untuk replika IBV, fondasi yang telah ada mencakup CIF, identitas, tanggal kedaluwarsa dokumen, kontak, alamat, pekerjaan, sumber dana, tujuan transaksi, tingkat risiko, serta pemisahan profil historis dan data latihan. Pemetaan yang aman adalah menampilkan daftar dan pencarian nasabah berbasis peran tanpa menambahkan atau mengubah data hanya untuk tujuan peninjauan.

## Bantuan: User Manual

SIPUKA menyediakan rute **User Manual** pada kelompok Bantuan. Modul tidak menyelesaikan pemuatan pada sesi ini, sehingga isi atau media bantuannya belum dapat diklaim sebagai terobservasi. Ketersediaan fitur bantuan tetap dicatat sebagai kebutuhan adopsi yang perlu direplikasi secara proporsional melalui panduan kontekstual di aplikasi IBV dan dokumentasi operasional yang sudah ada.

## Batasan Peninjauan

Seluruh peninjauan dilakukan dalam mode baca-saja. Tidak ada data, konfigurasi, transaksi, maupun pengajuan pada sistem sumber yang akan dibuat, diubah, dihapus, atau dikirimkan.
