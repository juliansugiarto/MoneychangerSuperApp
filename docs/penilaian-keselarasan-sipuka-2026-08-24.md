# Penilaian Keselarasan terhadap Acuan SIPUKA

## Kesimpulan

Aplikasi Ibukota Valasindo **mengikuti prinsip operasional dan informasi yang relevan** dari acuan portal Bank Indonesia untuk KUPVA, tetapi **bukan replikasi satu-banding-satu maupun sistem resmi Bank Indonesia**. Penilaian ini memakai fungsi KUPVA dan Kurs Transaksi BI yang dapat diverifikasi secara publik. Belum ditemukan dokumentasi publik yang memadai untuk memverifikasi definisi serta seluruh modul portal yang disebut pengguna sebagai SIPUKA secara spesifik.

| Area acuan | Status aplikasi | Catatan |
|---|---|---|
| Informasi kurs referensi | Selaras secara konsep | BI Transaction Rate, JISDOR, observasi pasar, waktu observasi, dan perbandingan kurs tersedia. Kurs referensi tidak mengaktifkan harga outlet otomatis. |
| Transparansi kurs outlet | Selaras | Kurs aktif publik dipisah dari kontrol harga internal dan menyajikan informasi indikatif. |
| Operasional money changer/KUPVA | Selaras dan diperluas | Bon, KYC, kas, stock opname, checklist buka-tutup, keluhan, audit log, serta approval role-based tersedia. |
| Pengawasan | Diperluas | Review transaksi, pengakuan Direksi, arsip PDF, dan pusat kesiapan merupakan kontrol internal tambahan. |
| Sistem regulator BI | Belum ada | Aplikasi tidak melakukan pendaftaran/perizinan, pengiriman pelaporan, validasi status izin, atau integrasi API resmi Bank Indonesia. |

> Aplikasi membantu proses internal PT Ibukota Valasindo. Aplikasi tidak boleh disebut sebagai SIPUKA, portal Bank Indonesia, atau bukti kepatuhan/pelaporan otomatis kepada regulator.

## Dasar pembanding

Bank Indonesia menjelaskan KUPVA sebagai kegiatan jual-beli uang kertas asing dan pembelian cek pelawat; penyelenggara KUPVA bukan bank adalah perseroan terbatas yang melakukan kegiatan tersebut. Halaman Kurs Transaksi BI menyediakan kurs harian per mata uang termasuk nilai, kurs jual, dan kurs beli.

## Rekomendasi jika keselarasan perlu ditingkatkan

1. Tambahkan direktori publik status legal internal dengan bukti izin yang diunggah dan masa berlaku yang dipantau oleh Controller; tampilkan sebagai informasi perusahaan, bukan hasil verifikasi otomatis BI.
2. Tambahkan format ekspor laporan regulator yang dapat dipetakan oleh petugas ke formulir resmi, hanya setelah format, kanal, dan otorisasi pelaporan dikonfirmasi perusahaan.
3. Jika tersedia akses dan dokumentasi resmi dari BI, rancang integrasi terpisah dengan approval manusia, jejak audit, serta uji sandbox—tanpa menyimpan kredensial di antarmuka.

## Referensi

1. [Bank Indonesia — KUPVA BB dan PTD](https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/kupva-bb-ptd/default.aspx)
2. [Bank Indonesia — Kurs Transaksi BI](https://www.bi.go.id/id/statistik/informasi-kurs/transaksi-bi/default.aspx)
