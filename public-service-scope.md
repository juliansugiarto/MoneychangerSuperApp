# Batas Layanan Publik

Pengalaman pelanggan yang ditambahkan pada rilis ini adalah kanal informasi dan **permintaan konfirmasi**, bukan mekanisme transaksi atau pembayaran. Kurs pada beranda tetap indikatif dan memakai data kurs operasional aktif yang telah disetujui. Sistem tidak akan mengubah kurs, kas, stok, ledger, transaksi, atau data KYC dari permintaan yang dibuat pelanggan.

| Area | Keputusan implementasi |
| --- | --- |
| Kalkulator | Menghitung estimasi Rupiah menggunakan kurs aktif dan unit kuotasi. Setiap hasil menampilkan waktu efektif kurs serta disclosure bahwa petugas outlet mengonfirmasi harga/ketersediaan akhir. |
| Kanal resmi | Menampilkan alamat outlet dan nomor telepon yang telah tersedia pada beranda proyek. Jam layanan tidak direkayasa; pelanggan diarahkan untuk mengonfirmasi jadwal melalui kanal resmi. |
| Permintaan layanan | Hanya menangkap nama, kontak, mata uang, arah transaksi, nominal indikatif, waktu pilihan, dan persetujuan untuk dihubungi. Tidak menangkap dokumen identitas, nomor identitas, sumber dana, pembayaran, atau KYC. |
| Lifecycle | `BARU` → `MENUNGGU_VERIFIKASI` → `KURS_DIKONFIRMASI` → `SIAP_DILAYANI`; permintaan dapat `KEDALUWARSA` atau `DIBATALKAN`. Status tidak menciptakan transaksi dan tidak memengaruhi kas atau stok. |
| Pengumuman | Hanya konten yang dibuat serta diterbitkan oleh petugas berwenang yang muncul di area publik. Tidak ada pengumuman contoh atau klaim layanan yang direkayasa. |
| FAQ | Berisi penjelasan umum tentang kurs indikatif, konfirmasi outlet, kanal resmi, persiapan sebelum datang, dan pengaduan. FAQ tidak memberikan opini hukum atau menjanjikan hasil transaksi. |

## Otorisasi

Permintaan publik dapat dibuat tanpa akun. Antrian dan pembaruan status hanya dapat diakses petugas yang telah masuk. Pengumuman dikelola oleh peran Admin atau di atasnya. Setiap pembuatan dan perubahan status dicatat pada audit log aplikasi.
