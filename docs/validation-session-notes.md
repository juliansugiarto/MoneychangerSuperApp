# Catatan Validasi Sesi dan Antarmuka

## Validasi 13 Agustus 2026

| Skenario | Hasil | Catatan |
|---|---|---|
| Masuk dengan akun internal `test-admin` | Lulus | Akun pengembangan aktif dengan peran ADMIN dan tidak dipaksa ganti sandi. |
| Membuka form transaksi | Lulus | Form tampil sebagai bon jual/beli, menampilkan kurs aktif, kontrol underlying, dan daftar bon. |
| Mencari nasabah `Bud` | Lulus | Autocomplete menampilkan Budi Santoso dengan CIF dan nomor identitas, lalu dapat dipilih tanpa menyimpan transaksi. |
| Mencari nomor identitas `3203011207960021` | Lulus | Setelah layanan dimulai ulang untuk memuat modul pencarian multifield terbaru, autocomplete menampilkan Budi Santoso dan profil dapat dipilih tanpa menyimpan bon. |
| Berpindah dari Transaksi ke Data Nasabah | Lulus setelah perbaikan | Sesi ADMIN tetap aktif; form KYC dan daftar nasabah termuat. |
| Pemeriksaan unggah KTP | Lulus secara visual | Form KYC menyediakan unggah JPG, PNG, atau WEBP maksimum 8 MB dengan keterangan penyimpanan privat. Tidak ada berkas/data asli yang diunggah selama validasi. |
| Panduan kerja harian | Lulus | Dashboard dan navigasi menampilkan urutan buka toko, buat bon transaksi, lalu hitung kas dan stok saat penutupan. |

## Tindak lanjut teknis

Kebijakan cookie sesi internal memakai `SameSite=Lax` untuk alur yang seluruhnya same-origin. Penanganan sesi kedaluwarsa juga diarahkan ke `/login` internal, bukan ke alur OAuth lama. Pencarian multifield nama, CIF, dan nomor identitas telah dimuat ulang serta tervalidasi dengan profil KYC nyata tanpa membuat mutasi baru. Validasi Stock Opname tetap menggunakan alur aman tanpa memasukkan saldo kas atau menutup hari operasional.
