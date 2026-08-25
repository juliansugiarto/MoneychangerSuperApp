# Use Case dan Skenario Operasional

## Sistem Operasional PT Ibukota Valasindo

**Versi:** Paket operasional awal  
**Sasaran:** Staff, Admin/Supervisor, Controller/Direksi, Shareholder, dan pengembang pendukung  
**Tujuan:** Menjelaskan perilaku sistem dari sudut pekerjaan pengguna, termasuk batas keputusan manusia, bukti kerja, dan tindakan saat kondisi tidak normal.

> **Prinsip kendali:** Semua skenario memakai akun pribadi dan data kejadian nyata, kecuali skenario yang secara tegas memakai **Simulasi Aman**. Sistem tidak mengaktifkan kurs, menyetujui transaksi, atau mengirim laporan regulator secara otomatis. Data latihan, historis, atau demonstrasi tidak boleh masuk ke kas, transaksi, laporan, atau arsip produksi.

## 1. Cara Membaca Dokumen

Setiap use case menjelaskan tujuan pekerjaan, peran yang berwenang, kondisi sebelum memulai, alur utama, pengecualian yang aman, hasil yang diharapkan, dan bukti yang perlu dapat ditelusuri. Bila alur nyata perusahaan berbeda dari sistem, tahan tindakan kritis dan eskalasi ke peran yang lebih tinggi; jangan menggantikan workflow dengan catatan bebas atau transaksi tiruan.

| Kode | Skenario | Pelaku utama | Hasil yang diharapkan | Batas kendali utama |
|---|---|---|---|---|
| UC-01 | Pembukaan outlet | Staff | Checklist pembukaan dan kas awal tercatat | Tidak menandai alat/kas yang belum diperiksa. |
| UC-02 | Aktivasi kurs outlet | Admin/Supervisor | Kurs aktif setelah alasan dan keputusan manusia | Tidak ada aktivasi otomatis dari pembanding. |
| UC-03 | Pencatatan nasabah/KYC | Staff | Profil nasabah tersimpan sesuai bukti | Hindari duplikasi dan data contoh. |
| UC-04 | Bon BUY/SELL | Staff | Bon mengikuti kurs aktif dan status workflow | Simulasi tidak boleh dibuat pada layar produksi. |
| UC-05 | Review transaksi terflag | Admin/Supervisor | Keputusan review dapat ditelusuri | Tidak memintas flag atau menghapus jejak. |
| UC-06 | Kas, opname, dan penutupan | Staff dan Admin | Selisih terlihat, ditinjau, dan arsip tersedia bila lengkap | Varians tidak boleh disamarkan. |
| UC-07 | Direksi mengetahui | Controller dan Direksi | Pengakuan informasi pengawasan tercatat | Pengakuan bukan persetujuan yang memblokir operasi. |
| UC-08 | Keluhan nasabah | Staff dan Controller | Register serta hasil penyelesaian tersimpan | Mengikuti SOP dan tidak mengubah sejarah kasus final. |
| UC-09 | Snapshot keuangan B0002/B0003/B0004 | Controller | Snapshot sumber direkonsiliasi dan berjejak | Workbook hanya dari sumber internal tepercaya. |
| UC-10 | Paket pelaporan manual | Controller dan Shareholder | Maker-checker serta ekspor manual tercatat | Tidak ada submit regulator otomatis. |
| UC-11 | Simulasi operasional | Semua peran | Hasil latihan terisolasi/nonpersisten | Tidak membuat bon, kas, laporan, atau arsip produksi. |
| UC-12 | Manajemen Admin dan Staff | Shareholder | Akun kerja dibuat atau diatur secara terlacak | Sandi awal wajib diganti; sesi lama dicabut saat perubahan akses. |

## UC-01 — Pembukaan Outlet

| Elemen | Ketentuan |
|---|---|
| Tujuan | Memastikan outlet siap melayani dengan kas awal serta alat yang benar-benar telah diperiksa. |
| Pelaku | Staff; Supervisor memantau bila terdapat kendala. |
| Prasyarat | Staff memakai akun aktif sendiri; modal kerja, lampu UV, mesin hitung, dan kas fisik tersedia untuk diperiksa. |
| Pemicu | Awal hari kerja atau awal shift yang disetujui perusahaan. |
| Bukti | Checklist pembukaan tersimpan; pencatatan kas pembukaan per mata uang; catatan kendala yang tidak memuat KYC. |

**Alur utama.** Staff membuka menu **Buka & Tutup Outlet**, memeriksa modal kerja, lampu UV, dan mesin hitung sesuai keadaan sebenarnya. Staff kemudian membuka **Kas & Persediaan** dan mencatat kas pembukaan per mata uang dari hitungan fisik. Setelah kembali ke checklist, Staff mencentang hanya langkah yang telah selesai lalu menyimpan pembukaan.

**Pengecualian dan eskalasi.** Jika alat rusak, modal belum diterima, atau kas belum dapat dihitung, Staff tidak mencentang langkah terkait. Staff menulis catatan operasional singkat tanpa identitas nasabah dan menghubungi Supervisor. Tidak ada transaksi loket yang boleh dipaksa berjalan hanya agar checklist terlihat lengkap.

**Hasil akhir.** Tanggal bisnis memiliki checklist pembukaan yang dapat ditelusuri. Kondisi belum siap tetap terlihat sebagai pekerjaan terbuka untuk pengawasan.

## UC-02 — Aktivasi Kurs Outlet

| Elemen | Ketentuan |
|---|---|
| Tujuan | Menetapkan kurs outlet melalui keputusan manusia yang memiliki alasan serta pembanding yang jelas. |
| Pelaku | Admin/Supervisor. |
| Prasyarat | Referensi BI/JISDOR/pasar atau sumber sah tersedia untuk ditelaah; pihak berwenang memahami unit kutip dan waktu observasi. |
| Pemicu | Pembukaan hari, perubahan kondisi pasar, atau evaluasi kurs sesuai kebijakan internal. |
| Bukti | Kurs aktif, alasan aktivasi, pembanding, waktu observasi, dan jejak tindakan. |

**Alur utama.** Admin membuka **Kurs Operasional** dan **Bandingkan Kurs**, kemudian membandingkan nilai referensi beserta waktu dan unitnya. Bila keputusan manusia telah dibuat, Admin memasukkan alasan aktivasi yang spesifik dan melakukan aktivasi manual. Kurs aktif kemudian dapat dipakai oleh bon produksi sesuai workflow.

**Pengecualian dan eskalasi.** Bila terjadi guncangan kurs, nilai pembanding tidak mutakhir, atau terdapat perbedaan unit kutip, Admin tidak mengaktifkan kurs terburu-buru. Nilai tersebut dicatat sebagai bahan peninjauan dan dievaluasi bersama atasan sesuai kebijakan perusahaan. Referensi tidak pernah boleh disalin otomatis menjadi kurs outlet.

**Hasil akhir.** Hanya kurs keputusan manusia yang aktif. Kurs demo, historis, dan simulasi tidak digunakan dalam operasi outlet.

## UC-03 — Pencatatan Nasabah dan KYC

| Elemen | Ketentuan |
|---|---|
| Tujuan | Menyediakan profil nasabah yang benar untuk layanan tanpa menduplikasi atau memindahkan identitas ke catatan bebas. |
| Pelaku | Staff. |
| Prasyarat | Dokumen pendukung telah diperiksa sesuai SOP; Staff menggunakan akun pribadi. |
| Pemicu | Nasabah baru datang atau informasi nasabah perlu diperbarui melalui dasar dokumen yang sah. |
| Bukti | Profil nasabah, perubahan data yang dapat ditelusuri, dan status workflow yang berlaku. |

**Alur utama.** Staff lebih dahulu mencari nasabah pada menu **Nasabah**. Jika profil sudah ada, Staff meninjau informasi yang relevan dan memperbarui hanya berdasarkan dokumen yang sah. Jika tidak ada, Staff membuat profil baru melalui kolom terstruktur sistem. Informasi yang diperlukan untuk proses berikutnya harus tetap berada pada kolom yang disediakan.

**Pengecualian dan eskalasi.** Bila bukti identitas belum memadai, terdapat indikator risiko, atau ditemukan dugaan duplikasi, Staff menghentikan pembuatan/kelanjutan proses sesuai SOP dan mengeskalasi ke Supervisor. Staff tidak membuat profil contoh, tidak memakai profil orang lain, dan tidak menulis nomor identitas pada kolom catatan umum.

**Hasil akhir.** Profil yang digunakan dalam layanan memiliki asal dokumen dan tidak tercampur dengan data uji atau data bebas.

## UC-04 — Membuat Bon BUY/SELL

| Elemen | Ketentuan |
|---|---|
| Tujuan | Mencatat transaksi valuta nyata dengan kurs, nasabah, nilai, dan metode pembayaran yang tepat. |
| Pelaku | Staff. |
| Prasyarat | Nasabah dan kurs aktif telah tersedia; peristiwa transaksi benar-benar terjadi di outlet. |
| Pemicu | Nasabah mengonfirmasi transaksi beli atau jual valuta. |
| Bukti | Bon produksi, status workflow, nilai yang dihitung sistem, dan arsip PDF bila status mengizinkan. |

**Alur utama.** Staff membuka **Bon Transaksi**, memilih arah BUY/SELL, nasabah, mata uang, kurs aktif, jumlah valuta, dan metode pembayaran sesuai bukti nyata. Staff memeriksa unit kutip serta nominal Rupiah sebelum menyimpan. Bila transaksi memenuhi syarat penyelesaian, Staff menggunakan arsip/cetak PDF yang tersedia setelah seluruh informasi benar.

**Pengecualian dan eskalasi.** Bila sistem menandai transaksi untuk review, Staff tidak mencari jalan pintas dan tidak mengubah data agar flag hilang. Staff menyimpan sesuai workflow lalu memberi informasi yang diperlukan kepada Supervisor. Jika transaksi belum terjadi atau hanya digunakan untuk latihan, Staff wajib pindah ke **Simulasi Aman**.

**Hasil akhir.** Bon produksi hanya mencerminkan transaksi nyata; transaksi terflag menunggu penanganan sesuai peran.

## UC-05 — Review Transaksi Terflag

| Elemen | Ketentuan |
|---|---|
| Tujuan | Menilai transaksi yang perlu perhatian dengan keputusan dan alasan yang tetap dapat diaudit. |
| Pelaku | Admin/Supervisor. |
| Prasyarat | Transaksi berada pada antrian review dan informasi pendukung tersedia. |
| Pemicu | Sistem atau petugas menandai transaksi sesuai aturan kerja. |
| Bukti | Status review, alasan keputusan, catatan yang diperlukan, serta jejak audit. |

**Alur utama.** Admin membuka ringkasan atau monitoring untuk melihat antrian. Admin meninjau alasan flag, data transaksi, kurs, serta bukti pendukung sesuai kebijakan. Admin kemudian memakai tindakan workflow yang tersedia untuk menyetujui, mengembalikan, atau menindaklanjuti transaksi.

**Pengecualian dan eskalasi.** Jika bukti tidak cukup, Admin tidak menyetujui hanya untuk mempercepat layanan. Jika perlu koreksi, gunakan jalur koreksi/pembatalan yang disediakan sebelum status selesai. Direksi dapat memperoleh informasi melalui mekanisme **Direksi Mengetahui**, tetapi informasi tersebut tidak boleh menghambat transaksi yang telah lolos approval operasional.

**Hasil akhir.** Setiap keputusan review dapat ditelusuri; jejak flag tidak dihapus agar transaksi tampak bersih.

## UC-06 — Kas, Stock Opname, dan Penutupan Outlet

| Elemen | Ketentuan |
|---|---|
| Tujuan | Menutup hari kerja berdasarkan hitungan fisik, rekonsiliasi, dan serah-terima nyata. |
| Pelaku | Staff; Admin/Supervisor meninjau varians. |
| Prasyarat | Kas pembukaan telah dicatat; mutasi hari berasal dari bon produksi yang sesuai. |
| Pemicu | Mendekati akhir layanan outlet atau akhir shift sesuai kebijakan internal. |
| Bukti | Stock opname, varians, checklist penutupan, catatan serah-terima, dan arsip PDF bila kontrol lengkap. |

**Alur utama.** Staff membuka **Kas & Persediaan**, menghitung fisik per mata uang, dan mengirim stock opname. Sistem menampilkan perbandingan terhadap catatan. Staff dan Supervisor meninjau varians sebelum kembali ke **Buka & Tutup Outlet** untuk menyelesaikan langkah serah-terima, penguncian brankas, rekonsiliasi, serta checklist penutupan. Bila seluruh syarat lengkap, arsip PDF penutupan dapat digunakan untuk arsip perusahaan.

**Pengecualian dan eskalasi.** Jika ada selisih, Staff tidak menyesuaikan angka fisik agar sama dengan sistem. Hitung ulang dengan saksi bila diperlukan, cocokkan mutasi, catat kondisi aman, dan eskalasi ke Supervisor/Direksi sesuai kebijakan pengawasan. Checklist tetap tidak lengkap bila kondisi nyata belum selesai.

**Hasil akhir.** Penutupan merepresentasikan keadaan fisik dan status rekonsiliasi yang sesungguhnya, bukan sekadar daftar centang.

## UC-07 — Direksi Mengetahui

| Elemen | Ketentuan |
|---|---|
| Tujuan | Memberikan visibilitas kepada Direksi atas informasi pengawasan tanpa menambahkan hambatan pada approval operasional yang sudah selesai. |
| Pelaku | Controller dan Direksi. |
| Prasyarat | Informasi pengawasan tersedia pada daftar pengakuan. |
| Pemicu | Informasi/review yang ditetapkan workflow muncul sebagai perlu diketahui. |
| Bukti | Pengakuan Direksi beserta waktu dan konteks informasi. |

**Alur utama.** Controller memantau menu **Direksi Mengetahui** dan memastikan informasi yang relevan memiliki konteks. Direksi membuka daftar, membaca informasi, lalu memberikan pengakuan melalui tindakan yang tersedia.

**Pengecualian dan eskalasi.** Pengakuan bukan pengganti investigasi, penyesuaian kas, atau persetujuan transaksi. Bila Direksi menemukan masalah, tindak lanjut dilakukan melalui jalur pengawasan/koreksi yang relevan; jangan mengubah pengakuan untuk menyamarkan peristiwa.

**Hasil akhir.** Informasi penting memiliki bukti keterbacaan Direksi tanpa memblokir transaksi yang sudah disetujui Supervisor.

## UC-08 — Keluhan Nasabah

| Elemen | Ketentuan |
|---|---|
| Tujuan | Mencatat, meninjau, dan menyelesaikan pengaduan melalui register yang dapat ditelusuri. |
| Pelaku | Staff; Controller untuk pengawasan/eskalasi. |
| Prasyarat | Keluhan diterima dari nasabah atau kanal perusahaan yang sah. |
| Pemicu | Nasabah menyampaikan pengaduan. |
| Bukti | Register keluhan, status, catatan hasil, dan dasar eskalasi. |

**Alur utama.** Staff membuka **Keluhan Nasabah**, mencatat tanggal, kontak, pokok keluhan, dan bukti sesuai formulir perusahaan. Status bergerak sesuai workflow dari diterima ke peninjauan, lalu hasil atau eskalasi. Controller meninjau kasus yang membutuhkan tindak lanjut lebih lanjut.

**Pengecualian dan eskalasi.** Jangan memakai register keluhan untuk menyimpan data KYC berlebih atau catatan yang tidak relevan. Kasus final tidak dibuka kembali untuk mengubah sejarah. Bila terdapat peristiwa baru, buat catatan baru sesuai prosedur.

**Hasil akhir.** Perusahaan memiliki register dan jejak penyelesaian yang konsisten dengan SOP internal.

## UC-09 — Snapshot Keuangan B0002/B0003/B0004

| Elemen | Ketentuan |
|---|---|
| Tujuan | Menyiapkan snapshot keuangan internal melalui input manual atau pemetaan workbook yang terkendali. |
| Pelaku | Controller; Shareholder memeriksa. |
| Prasyarat | Periode, sumber internal, dan form/template yang relevan telah ditelaah. |
| Pemicu | Persiapan laporan internal/regulator sesuai siklus perusahaan. |
| Bukti | Snapshot tersimpan, sumber, periode, status, dan jejak audit. |

**Alur utama.** Controller mengunduh template kosong jika diperlukan lalu mengisi B0002 Neraca, B0003 Laba Rugi, dan B0004 Ekuitas tanpa mengubah marker atau struktur pemetaan. Untuk workbook, Controller memilih berkas internal yang telah dipindai antivirus, maksimal 5 MB, dan berformat valid. Sistem memetakan hasil di memori; Controller memeriksa pos sebelum secara eksplisit menyimpan snapshot.

**Pengecualian dan eskalasi.** Jika file ditolak, sumber tidak jelas, signature tidak benar, atau pos tidak cocok, Controller tidak mengganti ekstensi dan tidak mencoba mengimpor ulang berulang kali. Gunakan input manual untuk sumber tepercaya yang telah diverifikasi atau eskalasi sebelum melanjutkan. Bundle belum menjadi snapshot/paket sampai tindakan simpan dilakukan.

**Hasil akhir.** Snapshot disimpan hanya setelah review manusia dan tetap terpisah dari transaksi harian.

## UC-10 — Paket Pelaporan Manual dan Maker-Checker

| Elemen | Ketentuan |
|---|---|
| Tujuan | Menyiapkan paket pelaporan internal dengan pemisahan pembuat, pemeriksa, serta ekspor yang tetap manual. |
| Pelaku | Controller sebagai pembuat; Shareholder lain sebagai pemeriksa. |
| Prasyarat | Snapshot/sumber telah ditelaah; periode dan tenggat manual ditetapkan bila relevan. |
| Pemicu | Paket perlu disiapkan untuk review atau ekspor internal. |
| Bukti | Paket, status, catatan review/pengembalian, tenggat, prioritas, dan audit trail. |

**Alur utama.** Controller membuat paket dari sumber yang sudah diperiksa dan mengubah status secara manual dari `DRAFT` ke `PREPARED`. Shareholder yang berbeda membuka paket, menelaah sumber, lalu menyetujui atau mengembalikan dengan catatan yang wajib. Setelah persetujuan sesuai workflow, pihak berwenang dapat melakukan ekspor/cetak manual sehingga paket berstatus `EXPORTED`.

**Pengecualian dan eskalasi.** Pembuat paket tidak boleh menyetujui paket sendiri. Bila paket dikembalikan, Controller membaca catatan, memperbaiki sumber, dan membuat draf baru; paket lama tidak dihapus. Label tenggat `TERLAMBAT`, `HARI INI`, atau `MENDATANG` hanya pengingat layar. Status ekspor tidak membuktikan kirim ke Bank Indonesia atau regulator mana pun.

**Hasil akhir.** Maker-checker dan ekspor internal terlacak tanpa koneksi submit eksternal otomatis.

## UC-11 — Simulasi Operasional Aman

| Elemen | Ketentuan |
|---|---|
| Tujuan | Melatih alur bon, guncangan kurs, penutupan, arsip, dan review tanpa memengaruhi produksi. |
| Pelaku | Staff, Admin/Supervisor, Controller, Direksi, dan Shareholder sesuai latihan. |
| Prasyarat | Pengguna memahami bahwa latihan tidak mewakili transaksi nyata dan memakai menu/kartu simulasi. |
| Pemicu | Pelatihan awal, dry-run, atau evaluasi proses. |
| Bukti | Hasil layar bertanda simulasi; tidak ada bon, kas, laporan, arsip resmi, snapshot, paket, atau audit produksi baru. |

**Alur utama.** Pengguna membuka **Simulasi Aman** atau kartu latihan yang tersedia. Latihan dapat memasukkan nilai aman untuk memahami perhitungan quote, dampak guncangan kurs, status penutupan, atau pengembalian paket. Hasil digunakan hanya untuk diskusi/pelatihan dan berada di memori sesuai desain.

**Pengecualian dan eskalasi.** Hasil latihan tidak boleh disalin ke form produksi atau dipakai sebagai bukti. Setelah latihan, pengguna memuat ulang halaman atau keluar sesi untuk menghapus kondisi nonpersisten. Bila ada indikasi hasil latihan muncul pada daftar produksi, hentikan penggunaan dan eskalasi sebagai insiden.

**Hasil akhir.** Pengguna dapat berlatih alur aman tanpa mengubah saldo, transaksi, pelaporan, maupun arsip perusahaan.

## UC-12 — Manajemen Admin dan Staff

| Elemen | Ketentuan |
|---|---|
| Tujuan | Mengelola akses kerja Admin/Staff dengan peran, status, dan sesi yang dapat dikendalikan. |
| Pelaku | Shareholder. |
| Prasyarat | Shareholder memakai akun pribadi, telah mengganti sandi awal bila diwajibkan, dan memiliki dasar kebutuhan akses. |
| Pemicu | Pegawai baru, perubahan tugas, offboarding, atau pemulihan akses yang berwenang. |
| Bukti | Akun, peran, status, kewajiban ganti sandi, dan jejak perubahan akses. |

**Alur utama.** Shareholder membuka dashboard **Hari Ini** dan menggunakan bagian **Manajemen pengguna**. Tombol **Buat akun Admin** atau **Buat akun Staff** membuka formulir dengan peran awal yang tepat. Shareholder mengisi identitas kerja, username unik, dan sandi sementara minimal 12 karakter melalui kanal aman. Pengguna wajib mengganti sandi saat login pertama.

**Perubahan akses.** Dari daftar akun, Shareholder dapat meninjau status, mengubah peran antara Admin dan Staff, menonaktifkan akun, atau mereset sandi akun kerja. Setiap reset sandi, penonaktifan, dan perubahan peran harus mencabut sesi aktif akun yang terdampak.

**Pengecualian dan eskalasi.** Controller hanya dibuat melalui kewenangan Shareholder; Controller dan Shareholder tidak boleh didelegasikan menjadi Admin/Staff melalui kontrol biasa. Jangan memakai satu akun Shareholder untuk kerja harian, dan jangan membagikan sandi sementara di saluran yang tidak aman.

**Hasil akhir.** Akses Admin/Staff sesuai kebutuhan kerja, dapat ditelusuri, dan dapat dihentikan saat tidak lagi diperlukan.

## 2. Skenario Lintas Peran Satu Hari

| Tahap | Peran | Aktivitas | Keputusan manusia yang wajib | Bukti yang diharapkan |
|---|---|---|---|---|
| Buka | Staff | Checklist pembukaan dan kas awal | Kondisi alat/kas benar-benar diperiksa | Checklist dan kas awal. |
| Kurs | Admin | Tinjau pembanding dan aktivasi | Alasan serta kelayakan kurs | Kurs aktif dan audit. |
| Loket | Staff | KYC dan bon nyata | Validitas data serta nominal | Nasabah/bon sesuai workflow. |
| Pengawasan | Admin | Review transaksi terflag | Setuju, koreksi, atau tindak lanjut | Status review dan alasan. |
| Tutup | Staff/Admin | Opname dan rekonsiliasi | Penanganan varians serta serah-terima | Opname, checklist, arsip bila lengkap. |
| Tata kelola | Controller/Direksi | Kesiapan dan informasi pengawasan | Pengakuan serta tindak lanjut | Pengakuan dan catatan pengawasan. |
| Pelaporan | Controller/Shareholder | Snapshot/paket manual bila diperlukan | Maker-checker dan keputusan ekspor | Paket/audit, tanpa submit regulator otomatis. |

## 3. Kriteria Penerimaan Operasional

Skenario dianggap berjalan benar bila pengguna hanya melakukan tindakan yang sesuai kewenangan, setiap keputusan kritis memiliki alasan atau workflow, dan data simulasi tidak muncul pada keluaran produksi. Kegagalan halaman, status kosong yang tidak diharapkan, nilai tidak dikenal, atau indikasi data latihan di produksi harus diperlakukan sebagai alasan untuk menghentikan tindakan kritis dan melakukan eskalasi, bukan sebagai alasan untuk mengulang klik atau memasukkan data pengganti.

## 4. Batas Dokumen

Dokumen ini adalah panduan use case internal. Dokumen tidak menggantikan SOP perusahaan, pelatihan APUPPT, keputusan Direksi/Shareholder, ketentuan regulator, maupun penilaian hukum/kepatuhan profesional. Pengiriman pelaporan regulator tidak diaktifkan otomatis dan hanya dapat dipertimbangkan setelah PT Ibukota Valasindo memperoleh format, kanal, jadwal, kredensial, dan otorisasi resmi yang diverifikasi.
