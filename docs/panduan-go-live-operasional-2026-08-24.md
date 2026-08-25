# Panduan Go-Live Operasional Ibukota Valasindo

## Tujuan penggunaan

Aplikasi ini memisahkan pekerjaan **kasir**, **Supervisor**, dan **Direksi/Controller** agar layanan di loket tetap cepat, sementara jejak pengawasan, kepatuhan, dan audit tidak tercampur dengan proses transaksi. Data kurs referensi, kurs outlet, kas, transaksi, dan pengakuan laporan merupakan bagian yang berbeda; staf tidak boleh menggunakan data referensi sebagai harga transaksi sebelum kurs outlet yang sesuai aktif.

## Peran dan tanggung jawab

| Peran | Fokus pekerjaan | Batas penting |
|---|---|---|
| **Staff/Kasir** | Mencari atau membuat profil KYC, membuat bon, mencetak bon, serta mengirim bon ke alur persetujuan. | Tidak mengaktifkan kurs outlet dan tidak menyelesaikan review transaksi berisiko. |
| **Supervisor/Admin** | Meninjau transaksi ter-flag, kurs, kas, stock opname, dan checklist outlet. | Persetujuan ter-flag harus didukung data yang lengkap; jangan mengesampingkan peringatan sistem. |
| **Controller/Direksi** | Memantau laporan penting, varians kas, perubahan kurs material, hasil pengaduan, dan persetujuan ter-flag. | Pengakuan Direksi tidak menghambat layanan yang sudah disetujui Supervisor, tetapi harus diselesaikan sebagai bukti mengetahui. |
| **Shareholder** | Mengawasi secara tingkat tinggi serta pengaturan akses yang diperlukan. | Gunakan akses hanya untuk fungsi pengawasan dan tata kelola. |

## Urutan kerja harian

Pada awal hari, petugas membuka menu **Buka & Tutup Outlet**. Selesaikan tahap modal kerja, lampu UV, mesin hitung, dan pencatatan kas awal. Apabila suatu alat atau modal belum siap, tulis catatan singkat yang relevan dan beritahukan Supervisor sebelum melayani nasabah. Jangan menulis nomor identitas nasabah di kolom catatan operasional.

Selanjutnya, Supervisor atau peran yang berwenang membuka menu **Kurs Operasional**. Perbarui referensi BI dan JISDOR bila sumber tersedia, lalu bandingkan dengan observasi pasar yang telah diperiksa—misalnya VIP atau sumber lain. JISDOR adalah nilai referensi USD/IDR yang dipublikasikan Bank Indonesia, bukan harga otomatis untuk transaksi di outlet.[1] Ajukan kurs outlet sebagai proposal, tinjau margin serta kecukupan kas, isi alasan aktivasi, lalu centang konfirmasi. Sistem menyimpan alasan tersebut pada jejak audit dan tidak akan mengaktifkan kurs outlet hanya karena nilai referensi berubah.

Saat melayani nasabah, kasir mengikuti blok **Panduan Kasir** di atas form bon. Pertama, cari nasabah dengan nama, CIF, atau identitas; buat profil KYC bila belum ada. Kedua, pilih kurs aktif dan isi nominal, tujuan, cara pembayaran, serta data kuasa/underlying apabila diminta. Ketiga, simpan sebagai draft, cetak bon untuk tanda tangan, dan kirim ke alur persetujuan. Bon yang membutuhkan review tidak boleh dipaksakan selesai dari layar kasir.

Di akhir hari, lakukan hitung fisik melalui **Kas & Persediaan**, kirim stock opname, lalu lengkapi bagian penutupan pada checklist. Varians harus ditinjau Supervisor. Serah-terima uang dan status brankas dicatat pada checklist sebelum outlet dinyatakan tutup.

## Pusat kesiapan dan ruang latihan

Controller dapat membuka **Kesiapan Operasional** untuk memprioritaskan tindak lanjut harian pada lima kontrol: kurs dan pembanding referensi, kas pembukaan, checklist pembukaan, antrian pengawasan, serta arsip penutupan. Halaman ini hanya membaca status dan mengarahkan pengguna ke modul berwenang; halaman ini tidak dapat menyetujui transaksi, mengaktifkan kurs, atau mengubah kas.

Gunakan **Simulasi Aman** untuk melatih hitung bon, variasi hasil rekonsiliasi kas, guncangan kurs terhadap ambang review, dan kelayakan arsip penutupan. Hasil selalu bertanda simulasi dan dapat dicetak sebagai latihan. Tidak satu pun hasil latihan membuat nomor bon, nasabah, kurs aktif, saldo kas, stock opname, laporan, atau arsip produksi. Keputusan atas peringatan guncangan kurs tetap harus dilakukan manusia pada alur kurs operasional.

## Pengawasan dan pelaporan

Menu **Direksi Mengetahui** digunakan untuk laporan yang telah diputus di tingkat Supervisor namun harus diketahui Direksi, termasuk transaksi ter-flag yang disetujui, varians kas, peringatan perubahan kurs, serta hasil akhir pengaduan. Direksi membaca ringkasan dan bukti relevan, lalu menandai laporan sebagai diketahui. Hal ini merupakan pengakuan pengawasan, bukan persetujuan ulang terhadap transaksi.

Jika kurs referensi berubah material, aplikasi menampilkan peringatan berdasarkan ambang yang dapat diatur oleh peran berwenang. Jangan menutup peringatan hanya karena harga pasar bergerak cepat. Catat alasan bisnis, periksa pembanding pasar, dan aktifkan kurs outlet baru hanya setelah konfirmasi eksplisit.

## Impor data nasabah

Menu **Impor Nasabah** hanya digunakan oleh peran pengawasan. Unduh template CSV, isi kolom sesuai urutan, dan gunakan tanggal `YYYY-MM-DD`. Unggah file Excel untuk pratinjau; sistem akan menampilkan header yang salah dan error per baris sebelum data dikirim. Maksimal 300 nasabah dapat diimpor per file. CIF atau identitas yang sudah ada ditolak agar profil aktif tidak tertimpa. Untuk satu nasabah atau koreksi kecil, gunakan form input biasa agar perubahan lebih mudah ditelusuri.

## Pemeriksaan sebelum go-live

| Pemeriksaan | Dilakukan oleh | Bukti yang perlu tersedia |
|---|---|---|
| Akun Staff, Supervisor, Controller, dan Shareholder telah dibuat sesuai jabatan. | Controller/Shareholder | Daftar akses dan hak peran. |
| Saldo kas awal per valuta telah dimasukkan. | Supervisor | Pencatatan kas awal dan checklist pembukaan. |
| Kurs outlet aktif telah ditinjau, disertai alasan aktivasi. | Supervisor/Admin | Proposal, alasan audit, dan kurs aktif pada layar kurs. |
| Koneksi printer bon diuji. | Kasir/Supervisor | Bon uji internal tanpa data nasabah nyata bila diperlukan. |
| Prosedur pengaduan, APUPPT, dan eskalasi Direksi dipahami staf. | Controller | Bukti briefing/pelatihan sesuai prosedur internal. |

> **Catatan:** Aplikasi membantu pencatatan, kontrol akses, dan jejak audit. Keputusan kepatuhan, penilaian kewajaran transaksi, serta kewajiban pelaporan tetap berada pada pejabat perusahaan yang berwenang dan prosedur internal yang berlaku.

## Referensi

[1] [Bank Indonesia — JISDOR](https://www.bi.go.id/en/statistik/informasi-kurs/jisdor/default.aspx)
