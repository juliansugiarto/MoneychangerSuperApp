# Validasi Sumber Referensi Kurs — 24 Agustus 2026

Dokumen ini mencatat sumber referensi yang akan dipakai untuk mendukung keputusan kurs outlet. **Tidak satu pun sumber di bawah ini boleh mengaktifkan kurs jual/beli outlet secara otomatis.** Kurs operasional tetap merupakan keputusan yang dicatat dan disetujui oleh pengguna berwenang.

| Sumber | Cakupan yang diverifikasi | Peran dalam aplikasi | Batas penggunaan |
| --- | --- | --- | --- |
| Bank Indonesia — JISDOR | Referensi USD/IDR harian. Halaman menunjukkan nilai tanggal 24 Agustus 2026 dan riwayat hari sebelumnya. | Cross-check utama USD/IDR dan dasar membaca arah perubahan pasar. | Bukan kurs transaksi outlet dan bukan dasar aktivasi otomatis. |
| Bank Indonesia — Kurs Transaksi | Referensi harian multi-mata uang, termasuk nilai satuan kuotasi serta kurs jual/beli. | Sumber referensi utama untuk proposal kurs operasional seluruh mata uang yang didukung. | Tetap perlu peninjauan margin, stok, dan kondisi outlet sebelum kurs diaktifkan. |
| VIP Money Changer | Halaman publik menampilkan Bid/Ask beberapa mata uang, bertanda "For indication only" dan menyatakan kurs transaksi dapat berubah karena fluktuasi pasar. | Pembanding pasar yang bersifat indikatif dan dapat dicatat sebagai observasi eksternal. | Tidak akan digunakan untuk mengisi atau mengaktifkan kurs outlet secara otomatis. Data dikonfirmasi manusia dan direkam bersama waktu serta URL sumber. |

## Keputusan implementasi

Aplikasi akan menyimpan **snapshot sumber**, waktu pengambilan, jenis sumber, dan hasil pembandingan terhadap kurs outlet yang masih aktif. JISDOR akan diperlakukan sebagai pembanding USD/IDR, sementara kurs transaksi BI menjadi referensi multi-mata uang. Observasi sumber pasar lain seperti VIP akan dipisahkan sebagai referensi eksternal yang disetujui petugas, karena halaman tersebut tidak menawarkan kontrak harga atau jalur integrasi resmi yang diverifikasi.

Perubahan besar antara referensi terbaru dan kurs outlet, atau perubahan besar dibanding snapshot sebelumnya, akan menghasilkan **peringatan perubahan mendadak**. Peringatan bersifat pengingat dan bukti kontrol; ia tidak dapat mengubah harga outlet, menyetujui bon, atau mengambil keputusan kepatuhan secara otomatis.

## Referensi

1. [Bank Indonesia — JISDOR](https://www.bi.go.id/en/statistik/informasi-kurs/jisdor/default.aspx)
2. [Bank Indonesia — Kurs Transaksi](https://www.bi.go.id/en/statistik/informasi-kurs/transaksi-bi/default.aspx)
3. [VIP Money Changer — Kurs indikatif](https://www.vip.co.id/en)
