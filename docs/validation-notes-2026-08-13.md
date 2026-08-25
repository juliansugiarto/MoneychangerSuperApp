# Catatan Validasi V1 — 13 Agustus 2026

## Autentikasi internal

Halaman `/login` berhasil dimuat dan secara eksplisit menyatakan bahwa akses menggunakan akun internal, bukan Google/OAuth maupun akun nasabah. Form memuat bidang username dan kata sandi serta penjelasan cookie sesi httpOnly.

Upaya masuk dengan akun uji `ADMIN` / `123456` ditolak secara benar sebagai kredensial tidak valid. Pemeriksaan database kemudian menemukan bahwa rekam ADMIN historis belum mempunyai `username` maupun `passwordHash`; akun tersebut tidak boleh dipakai oleh autentikasi internal. Akun bootstrap Shareholder tersedia sebagai akun internal dengan username `shareholder` dan diwajibkan mengganti kata sandi.

## Tindak lanjut

Validasi visual berperan ADMIN ditahan sampai Controller atau Shareholder membuat akun ADMIN internal melalui alur administrasi akun yang terproteksi. Pengujian layanan dan regresi otomatis tetap mencakup batas akses, bootstrap Shareholder, perubahan kata sandi wajib, dan prosedur operasional.

## Halaman publik dan responsivitas

Halaman depan serta halaman login dirender pada desktop dan lebar ponsel. Hierarki informasi, tombol akses staf, formulir, alamat, dan nomor kontak tetap terbaca. Halaman depan menampilkan keadaan aman bahwa kurs operasional hari ini masih disiapkan ketika tidak ada kurs operasional live yang telah disetujui; halaman tidak menampilkan kurs referensi atau arsip sebagai kurs publik aktif.

## Percobaan sesi ADMIN pengembangan

Kredensial `test-admin` ditolak oleh proses pengembangan yang sedang berjalan. Pengujian endpoint terisolasi dengan rahasia yang sama telah lulus, sehingga validasi browser ditunda untuk menyelaraskan proses server dengan provisioning akun pengembangan. Tidak ada akses operasional atau perubahan data yang dilakukan melalui browser pada tahap ini.

Setelah restart proses preview dan penambahan fallback rahasia sesi khusus pengembangan, upaya browser kedua masih ditolak dengan pesan kredensial tidak valid. Pemeriksaan endpoint lokal sebelumnya membuktikan kredensial diterima hingga tahap pembentukan sesi; perbedaan ini harus diselesaikan sebelum hasil halaman Kurs, Nasabah, Laporan, dan Dashboard dapat diklaim tervalidasi.

Penyelarasan hash akun uji pada startup preview telah dikonfirmasi oleh log server, namun percobaan browser berikutnya tetap menerima respons `UNAUTHORIZED`. Oleh karena itu, belum ada klaim validasi antarmuka untuk halaman operasional berbasis sesi ADMIN.

Rahasia browser pengembangan yang terpisah telah tervalidasi melalui uji endpoint, tetapi proxy preview masih menolak kredensial yang sama. Verifikasi UI berbasis peran tetap dicatat sebagai terbuka; pemeriksaan kode, regresi, dan rekonsiliasi data tidak terdampak.

Setelah sandi awal akun `DEVELOPMENT_TEST` diselaraskan khusus untuk pengembangan, login `test-admin` berhasil pada preview. Dashboard ADMIN memuat tanpa kesalahan runtime: ringkasan operasional, checklist SOP buka/penutupan, antrian review, dan saldo kas tampil dengan status kosong yang konsisten pada lingkungan uji.

Halaman Kurs memuat sebagai ADMIN tanpa kegagalan query antrean review. Snapshot BI yang terakhir tersimpan ditampilkan bersama ambang review USD dan EDD tunai harian; pesan sumber BI yang sedang gagal tetap mempertahankan snapshot, bukan menampilkan data perkiraan. Halaman Nasabah & KYC juga memuat tanpa error query transaksi, memperlihatkan formulir KYC dan daftar kosong yang sesuai dengan data live saat ini.

Pengujian URL Laporan dengan sesi ADMIN menghasilkan halaman akses dibatasi sebagaimana dirancang. Verifikasi fungsi laporan dan arsip historis akan dilanjutkan pada sesi Controller, sesuai matriks kewenangan.

Sesi `test-controller` berhasil membuka Laporan. Query laporan dan pengaturan operasional dimuat tanpa error; rekap transaksi live untuk periode 2025-01-01 sampai 2026-08-14 tetap nol. Pada periode sama, bagian arsip historis menampilkan transaksi impor berpenanda `HIST-` beserta nasabah sumber, jenis, mata uang, kurs, dan Rupiah. Ini mengonfirmasi pemisahan tampilan arsip dari rekap live dan saldo kas.
