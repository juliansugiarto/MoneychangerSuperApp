# Validasi Manajemen Pengguna Shareholder

**Tanggal validasi:** 25 Agustus 2026  
**Ruang lingkup:** Kartu manajemen pengguna pada dashboard Shareholder dan alur menuju halaman Akses Staf.

## Hasil

Walkthrough menggunakan akun Shareholder pengembangan membuktikan dashboard menampilkan bagian **Manajemen pengguna** yang hanya tersedia untuk Shareholder. Bagian tersebut menunjukkan jumlah akun Admin, Staff, dan akun nonaktif, serta menyediakan tindakan cepat **Buat akun Admin**, **Buat akun Staff**, dan **Kelola seluruh akun**.

Tindakan **Buat akun Admin** diverifikasi membuka `/operasional/pengguna?role=ADMIN` dengan pilihan peran **Supervisor / Admin** telah terisi. Tidak ada akun baru, perubahan peran, penonaktifan, ataupun reset sandi yang dijalankan selama walkthrough.

| Area verifikasi | Hasil | Catatan |
|---|---|---|
| Visibilitas dashboard | Lulus | Bagian hanya dirender untuk peran `SHAREHOLDER`. |
| Aksi cepat Admin | Lulus | Membuka formulir dengan peran Admin terpilih. |
| Aksi cepat Staff | Tercakup uji regresi | Membuka formulir dengan peran Staff sebagai parameter aman. |
| Kontrol akses backend | Tetap | Pembuatan, status, peran, dan reset sandi masih tunduk pada prosedur tRPC berotorisasi. |
| Data produksi | Tidak berubah | Verifikasi hanya membaca data dan menavigasi antarmuka. |

## Regresi teknis

Perintah `pnpm test && pnpm check` lulus dengan **41 berkas / 152 tes**. Build produksi `pnpm build` juga lulus. Build menampilkan peringatan ukuran chunk klien di atas 500 KB; peringatan ini tidak menghentikan build dan belum mengubah perilaku aplikasi.
