# Ruang Lingkup Operasional Terkonfirmasi — 24 Agustus 2026

Dokumen ini menerjemahkan keputusan pemilik ke dalam perilaku aplikasi. Sasaran utamanya adalah membuat proses kerja jelas bagi petugas loket, tanpa menyederhanakan kontrol yang dibutuhkan oleh Supervisor dan Direksi.

| Area | Keputusan terkonfirmasi | Perilaku aplikasi |
| --- | --- | --- |
| Persetujuan transaksi ter-flag | Supervisor dapat menyetujui, mengembalikan, atau mengeskalasi transaksi yang perlu review. | Keputusan Supervisor menyelesaikan tahap persetujuan tanpa perlu menunggu Direksi untuk transaksi normal. |
| Pengetahuan Direksi | Direksi wajib mengetahui setiap laporan atau kejadian penting yang terjadi. | Sistem menghasilkan item pengakuan Direksi untuk persetujuan transaksi ter-flag, varians opname, perubahan kurs signifikan, serta pengaduan yang selesai/eskalasi. Direksi menandai item sebagai `Diketahui`; tindakan ini tidak mengubah transaksi yang telah disetujui Supervisor. |
| Buka–tutup outlet | SOP buka dan tutup outlet menjadi alur kerja yang mudah dilacak. | Staf mencatat kesiapan alat, modal/kas awal, lalu pada penutupan mencatat opname fisik, rekonsiliasi, dan serah-terima. Status harian menunjukkan langkah yang belum selesai. |
| Kurs referensi | Referensi dapat berasal dari JISDOR, kurs transaksi BI, dan pembanding pasar seperti VIP. | BI/JISDOR diprioritaskan sebagai sumber resmi; sumber pasar lain hanya observasi indikatif. Semua kurs outlet tetap perlu persetujuan pengguna berwenang sebelum berlaku. |
| Perubahan kurs mendadak | Perubahan tajam harus terlihat sebelum memengaruhi keputusan outlet. | Sistem membandingkan snapshot baru terhadap snapshot sebelumnya dan kurs outlet aktif; perubahan melewati ambang konfigurasi menghasilkan peringatan, alasan wajib, serta item pengetahuan Direksi ketika kurs outlet diaktifkan. |
| Data awal | Impor Excel dan input manual sama-sama diperlukan. | Impor dilakukan melalui halaman terpisah dengan template, pemeriksaan kolom, pratinjau, laporan error, dan konfirmasi eksplisit. Form yang mudah tetap tersedia untuk masukan satu per satu. Data impor historis tidak boleh masuk ke alur transaksi aktif. |

## Struktur pengalaman pengguna

Area back office akan dipertahankan dalam empat kelompok agar tidak bertumpuk: **Kerja Hari Ini** untuk ringkasan dan checklist outlet; **Layani Nasabah** untuk transaksi, data nasabah, dan permintaan layanan; **Kontrol Outlet** untuk kurs, kas, stock opname, serta keluhan; dan **Pengawasan** untuk antrian review, laporan, pengakuan Direksi, audit, akses staf, serta impor data.

Untuk staf, layar utama akan memprioritaskan urutan kerja nyata: buka outlet, layani nasabah, tutup dan cocokkan kas. Fungsi pengawasan yang tidak dibutuhkan staf tidak akan muncul sebagai pilihan utama. Untuk Supervisor, antrian keputusan dan peringatan kurs ditempatkan lebih dahulu. Untuk Direksi, halaman pengawasan menyatukan seluruh item yang menunggu pengakuan tanpa mencampurkannya dengan pekerjaan kasir.

## Batas pengamanan

Sistem dapat mengingatkan, merekam, dan mengarahkan proses. Sistem tidak membuat keputusan APUPPT, tidak mengaktifkan kurs outlet otomatis, tidak mengubah data kas berdasarkan impor, dan tidak menghapus catatan transaksi atau audit yang sudah terbentuk.

## Catatan verifikasi visual

Pada 24 Agustus 2026, halaman login internal pada lingkungan pengembangan berhasil dimuat dan menampilkan pemisahan yang jelas antara area publik dengan back office. Verifikasi berikutnya dilakukan menggunakan akun uji pengembangan dengan peran pengawasan untuk memeriksa rute checklist, kurs, dan pengakuan Direksi.

Autentikasi pengembangan menggunakan akun uji `test-controller` hanya untuk verifikasi rute dan tidak menggunakan data atau kredensial operasional nyata.

Pada verifikasi rute checklist, header dan area catatan berhasil dimuat tetapi kartu pembukaan serta penutupan tidak tampak pada pratinjau awal. Tidak ada error pada konsol browser; temuan ini harus dicek kembali melalui status jaringan dan render setelah data checklist selesai dimuat.

Sesi uji pada pratinjau berakhir setelah pemuatan ulang lingkungan pengembangan. Hal ini tidak mengubah data aplikasi; autentikasi ulang akun uji diperlukan untuk melanjutkan verifikasi tampilan internal.

Autentikasi ulang akun uji Controller telah dimulai pada sesi pratinjau berikutnya untuk memverifikasi perbaikan kartu checklist.

Setelah row checklist harian terkonfirmasi tersedia di database dan sesi Controller berhasil dibuat kembali, kartu checklist masih tidak terlihat pada pratinjau. Penelusuran berikutnya difokuskan pada kegagalan render klien atau respons query yang tidak tampil di konsol biasa.

Pemeriksaan DOM pada 24 Agustus 2026 mengonfirmasi kedua kartu checklist beserta seluruh teks, checkbox, dan tombol telah dirender dengan `visibility: visible`, `opacity: 1`, serta ukuran/layout normal. Ketidakterlihatan pada gambar pratinjau merupakan artefak tangkapan visual, bukan kegagalan komponen aplikasi.

Halaman pengakuan Direksi berhasil menampilkan keadaan kosong yang menjelaskan sumber laporan yang akan masuk. Halaman impor nasabah juga berhasil menampilkan alur dua langkah: siapkan file/template lalu tinjau hasil validasi sebelum konfirmasi impor. Keduanya hanya terlihat oleh peran Controller pada verifikasi akun uji.

Halaman kurs berhasil memuat kurs transaksi BI untuk tujuh valuta, kontrol ambang perubahan kurs, formulir observasi pembanding seperti VIP, serta panel referensi multi-sumber. Kurs outlet lama tetap tampil sebagai versi aktif/retired terpisah dari referensi. Pada verifikasi ini, JISDOR belum tercatat karena parser sumber resmi perlu disesuaikan dengan format halaman yang sedang diterima.

Sinkronisasi manual referensi dijalankan pada lingkungan pengembangan. Snapshot kurs BI tetap tersedia dan tidak ada kurs outlet yang diaktifkan melalui tindakan ini. Observasi JISDOR belum muncul setelah proses selesai sehingga log server akan ditinjau sebelum penyerahan.

Verifikasi langsung JISDOR kemudian berhasil merekam observasi USD/IDR tanggal 24 Agustus 2026 sebesar **Rp17.703,00** (beli dan jual sebagai nilai referensi tengah), lengkap dengan URL dan hash sumber resmi BI. Catatan observasi menegaskan bahwa nilai ini tidak mengaktifkan kurs outlet otomatis. Untuk ketahanan sumber, JISDOR juga tersedia sebagai sinkronisasi terpisah di dalam proses pembaruan BI.

Aktivasi kurs outlet kini membutuhkan alasan keputusan minimal 10 karakter dan checkbox konfirmasi bahwa referensi, margin, serta kecukupan kas telah ditinjau. Alasan disimpan pada jejak audit. Halaman bon juga memperoleh panduan tiga langkah agar kasir mengikuti urutan KYC, kurs/nominal, lalu cetak-kirim. Tampilan halaman publik serta login telah ditinjau pada viewport 375×812 dan tetap terbaca tanpa elemen yang saling menumpuk.

Verifikasi akhir area internal menggunakan akun uji Controller dilanjutkan setelah komponen server diperbarui, sehingga sesi pengembangan memerlukan autentikasi ulang.

Autentikasi ulang berhasil dan dashboard Controller kembali memuat navigasi terpisah untuk layanan transaksi, kontrol outlet, serta pengawasan.

Pada verifikasi layar kurs setelah query selesai, tabel referensi multi-sumber menampilkan **JISDOR · USD · 17.703,000000** dengan waktu 24 Agustus 2026. Panel aktivasi juga menampilkan textarea alasan dan checkbox konfirmasi sebelum aksi aktivasi dapat dijalankan. Sumber kurs transaksi BI sedang mengalami timeout terpisah; UI menampilkan status perlu ditinjau dan mempertahankan snapshot sebelumnya, sedangkan observasi JISDOR yang telah tersimpan tetap tersedia.

Halaman bon transaksi telah diverifikasi dengan akun Controller. Panduan kasir tiga langkah muncul di atas form: cari nasabah/KYC, pilih kurs dan nominal, lalu simpan–cetak–kirim. Form lengkap dan daftar status bon tetap berada di bawah panduan, sehingga kontrol kepatuhan tidak dihilangkan.

Verifikasi responsif dilakukan pada 24 Agustus 2026. Area publik dan panel akses back-office telah ditangkap pada viewport 375×812 dan dapat dibaca tanpa tumpang tindih. Tinjauan kode layout back-office mengonfirmasi sidebar menggunakan komponen responsif: pada perangkat seluler sidebar berubah menjadi drawer (`Sheet`), sedangkan sidebar tetap hanya tampil pada breakpoint desktop `md`; header juga menyederhanakan label area staf pada layar kecil.
