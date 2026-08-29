# Buku Panduan Penggunaan A–Z

## Sistem Operasional PT Ibukota Valasindo

**Versi panduan:** Finalisasi operasional awal  
**Sasaran pengguna:** Staff, Admin/Supervisor, Controller/Direksi, dan Shareholder  
**Tujuan:** Menjalankan pencatatan operasional money changer secara tertib, mudah ditelusuri, dan tetap memisahkan latihan dari data produksi.

> **Prinsip utama:** Sistem membantu pencatatan, kontrol, dan jejak audit. Sistem **tidak** mengaktifkan kurs, mengirim laporan ke Bank Indonesia, atau menyetujui transaksi secara otomatis. Keputusan bisnis dan kepatuhan tetap menjadi tanggung jawab pejabat berwenang PT Ibukota Valasindo.

---

## 1. Batas Penggunaan dan Aturan Emas

Gunakan menu operasional hanya untuk aktivitas kantor yang benar-benar terjadi. Jangan memasukkan data latihan, data contoh, data historis, atau simulasi ke dalam transaksi, kas, stok opname, arsip PDF, maupun pelaporan. Untuk latihan, gunakan menu **Simulasi Aman** atau kartu latihan yang ditandai sebagai nonpersisten.

| Aturan | Yang harus dilakukan | Yang tidak boleh dilakukan |
|---|---|---|
| Data nasabah | Masukkan sesuai dokumen yang telah diperiksa petugas. | Menulis nomor identitas nasabah di catatan bebas atau menggunakan data contoh sebagai data hidup. |
| Kurs | Bandingkan referensi dan isi alasan keputusan sebelum aktivasi. | Mengaktifkan kurs otomatis atau memakai kurs tanpa pemeriksaan manusia. |
| Transaksi terflag | Teruskan untuk review sesuai peran. | Memaksa penyelesaian, menghapus jejak, atau memintas review. |
| Kas dan opname | Catat kas awal, mutasi, hitung fisik, lalu rekonsiliasi. | Menutup outlet sebelum selisih ditinjau. |
| Pelaporan regulator | Siapkan snapshot dan paket manual setelah data ditelaah. | Menekan ekspor/menyatakan terkirim ke regulator tanpa otorisasi dan kanal resmi. |
| Simulasi | Jalankan di menu/kartu latihan yang memang terisolasi. | Menyalin hasil latihan ke bon, kas, atau pelaporan produksi. |

## 2. Peran dan Batas Kewenangan

Sistem menerapkan urutan kewenangan **Staff → Admin → Controller → Shareholder**. Setiap peran di atas memperoleh akses baca/kerja peran di bawahnya, tetapi tindakan kritis tetap dibatasi oleh aturan workflow.

| Peran | Fokus utama | Contoh tindakan yang dapat dilakukan | Tindakan yang harus dipisahkan |
|---|---|---|---|
| **Staff** | Layanan loket dan pencatatan dasar | Bon transaksi, data nasabah, checklist outlet, kas/stock opname, keluhan, permintaan layanan. | Tidak mengaktifkan kurs, tidak menyetujui paket regulator. |
| **Admin / Supervisor** | Pengawasan outlet dan kurs | Seluruh tugas Staff; memantau transaksi, mengelola kurs, membandingkan referensi, meninjau transaksi terflag sesuai workflow. | Tidak menggantikan maker-checker Shareholder pada paket regulator. |
| **Controller / Direksi** | Kontrol, pelaporan internal, tata kelola | Pusat kesiapan, laporan, audit, impor nasabah, go-live, pelaporan regulator, dan pengelolaan akses. | Tidak menyetujui paket regulator yang ia sendiri siapkan. |
| **Shareholder** | Persetujuan tingkat akhir dan pengawasan | Semua menu pengawasan; menyetujui atau mengembalikan paket regulator dengan catatan. | Tidak menyetujui paket yang disiapkan sendiri. |

> **Direksi mengetahui:** Pengakuan Direksi adalah bukti bahwa informasi pengawasan telah dibaca. Mekanisme ini memberi visibilitas tanpa menghambat transaksi yang telah lolos workflow operasional.

## 3. Sebelum Hari Pertama Penggunaan

Controller dan Shareholder harus melakukan pemeriksaan berikut bersama-sama sebelum data nyata dimasukkan. Lakukan pada browser desktop modern yang diperbarui, gunakan jaringan kantor yang stabil, dan pastikan tiap orang memiliki akun sendiri. Jangan berbagi username atau kata sandi.

1. Masuk menggunakan akun internal yang diberikan oleh pengelola akses.
2. Bila sistem meminta penggantian kata sandi awal, buat kata sandi baru yang hanya diketahui pemilik akun.
3. Controller membuka **Pengawasan → Mulai Go-Live** dan **Kesiapan Operasional** untuk memeriksa kontrol yang belum siap.
4. Admin memeriksa **Kontrol Outlet → Kurs Operasional** dan **Bandingkan Kurs**; pastikan daftar kurs aktif benar-benar milik outlet dan bukan data demo/historis.
5. Staff membuka **Buka & Tutup Outlet** dan **Kas & Persediaan** untuk memastikan checklist serta mata uang kas dapat ditampilkan.
6. Shareholder membuka **Pelaporan Regulator** hanya untuk membaca panduan; jangan membuat paket dengan data percobaan.
7. Controller membuka **Akses Staf** dan menonaktifkan akun yang tidak digunakan atau belum diverifikasi.
8. Jika ada halaman kosong, pesan gagal memuat, atau angka yang tidak dikenal, **jangan lanjutkan transaksi**. Catat waktu, halaman, dan pesan yang tampil; lalu eskalasi ke Controller.

## 4. Peta Menu

| Kelompok menu | Menu | Kegunaan praktis | Peran minimum |
|---|---|---|---|
| Ringkasan | Hari Ini | Melihat transaksi, antrian, saldo tercatat, dan tindakan utama. | Staff |
| Ringkasan | Monitoring | Pengawasan kondisi operasional dan tindak lanjut. | Controller |
| Layanan & Transaksi | Bon Transaksi | Membuat dan menuntaskan transaksi beli/jual valuta. | Staff |
| Layanan & Transaksi | Simulasi Aman | Latihan bon, guncangan kurs, penutupan, dan arsip tanpa penulisan produksi. | Staff |
| Layanan & Transaksi | Permintaan Layanan | Mencatat serta menindaklanjuti kebutuhan layanan. | Staff |
| Layanan & Transaksi | Nasabah Baru | Menambahkan data nasabah baru sesuai dokumen, termasuk Beneficial Owner, status PEP, dan pencocokan DTTOT/PPSPM. | Staff |
| Layanan & Transaksi | Daftar Nasabah | Mencari dan meninjau seluruh profil nasabah; ekspor data (tanpa dokumen KTP) ke CSV. | Staff |
| Kontrol Outlet | Buka & Tutup Outlet | Checklist pembukaan, penutupan, catatan serah-terima, dan arsip PDF penutupan. | Staff |
| Kontrol Outlet | Kurs Operasional | Memantau, menyiapkan, dan mengaktifkan kurs secara manual dengan alasan. | Admin |
| Kontrol Outlet | Bandingkan Kurs | Membandingkan kurs outlet dengan referensi yang tersedia. | Admin |
| Kontrol Outlet | Kas & Persediaan | Kas pembukaan, saldo, stock opname, dan rekonsiliasi. | Staff |
| Kontrol Outlet | Keluhan Nasabah | Register, investigasi, hasil, dan eskalasi pengaduan konsumen. | Staff |
| Pengawasan | Kesiapan Operasional | Kontrol harian Controller, termasuk status Paket Pelaporan. | Controller |
| Pengawasan | Direksi Mengetahui | Daftar informasi pengawasan yang perlu diakui Direksi. | Controller |
| Pengawasan | Mulai Go-Live | Checklist kesiapan penggunaan produksi. | Controller |
| Pengawasan | Laporan | Ringkasan internal dan arsip cetak/PDF yang tersedia. | Controller |
| Pengawasan | Pelaporan Regulator | LKU, snapshot B0002/B0003/B0004, insidental, maker-checker, dan ekspor manual. | Controller |
| Pengawasan | Jejak Audit | Melihat tindakan penting yang tercatat sistem. | Controller |
| Pengawasan | Impor Nasabah | Memetakan file pelanggan sesuai format yang ditetapkan. | Controller |
| Pengawasan | Akses Staf | Membuat, mengatur peran, menonaktifkan, mereset sandi, atau meninjau akun. Dashboard Shareholder menyediakan pintasan khusus untuk Admin dan Staff. | Controller |

## 5. Alur Satu Hari Operasional

### 5.1 Pembukaan Outlet — Staff

1. Masuk ke **Buka & Tutup Outlet**.
2. Periksa empat kontrol pembukaan: modal kerja diterima, lampu UV siap, mesin hitung siap, dan kas awal sudah dicatat.
3. Buka **Kas & Persediaan** untuk mencatat kas pembukaan per mata uang. Masukkan angka fisik yang benar-benar diterima; jangan mengisi angka perkiraan.
4. Kembali ke checklist, centang hanya kontrol yang telah dilakukan, lalu klik **Simpan pembukaan**.
5. Bila ada alat rusak atau modal belum diterima, jangan mencentang kontrol tersebut. Tulis catatan operasional singkat tanpa nomor identitas nasabah dan beri tahu Supervisor.

### 5.2 Pemeriksaan Kurs — Admin/Supervisor

1. Buka **Kurs Operasional** dan **Bandingkan Kurs**.
2. Tinjau referensi BI/JISDOR, pasar, atau sumber yang tersedia pada sistem; periksa tanggal/waktu serta unit kutipannya.
3. Bila ada perubahan tajam, jangan langsung mengaktifkan kurs. Catat alasan, nilai pembanding, dan minta peninjauan sesuai kebijakan internal.
4. Saat keputusan kurs sudah disetujui manusia, masukkan alasan aktivasi yang jelas, lalu lakukan aktivasi manual.
5. Pastikan kurs demo, historis, atau simulasi tidak digunakan sebagai kurs operasi outlet.

### 5.3 Layanan Nasabah dan KYC — Staff

1. Cari nasabah di menu **Daftar Nasabah** (ketik nama atau NIK/nomor identitas, hasil langsung tersaring) sebelum membuat data baru untuk menghindari duplikasi.
2. Bila belum ada, tambahkan melalui **Nasabah Baru**. Nomor CIF terisi otomatis mengikuti nomor terakhir (boleh diganti manual). Tandai "Berlaku seumur hidup" untuk identitas eKTP. Dokumen KTP dapat diunggah dalam bentuk JPG/PNG/WEBP/PDF. Gunakan kolom yang tersedia, bukan catatan bebas, untuk informasi identitas.
3. Isi kolom **Beneficial Owner** bila nasabah bertindak atas nama pihak lain (mis. supir yang disuruh atasannya bertransaksi) — sistem akan membuat atau menautkan profil terpisah untuk pemilik manfaat sebenarnya.
4. Isi kolom **status PEP** (bukan PEP / nasabah adalah PEP / nasabah berhubungan dengan PEP) beserta keterangannya bila relevan.
5. Bila nama nasabah cocok dengan **Daftar DTTOT/PPSPM**, centang kolom tersebut dan isi catatan pencocokan. Profil otomatis berstatus RESTRICTED dan risiko TINGGI, dan wajib dilaporkan sebagai LTKM ke PPATK **secara manual** sesuai prosedur resmi — aplikasi ini tidak mengirim laporan otomatis ke regulator mana pun.
6. Jika data belum lengkap atau terdapat indikator risiko, ikuti instruksi sistem dan kebijakan perusahaan sebelum melanjutkan transaksi.
7. Gunakan **Permintaan Layanan** bila kebutuhan nasabah belum menjadi transaksi, agar pelayanan dapat ditindaklanjuti tanpa menciptakan bon palsu.
8. Gunakan tombol **Ekspor CSV** di Daftar Nasabah untuk keperluan pelaporan internal ringan; ekspor ini tidak menyertakan berkas dokumen KTP.

### 5.4 Membuat Bon Transaksi — Staff

1. Buka **Bon Transaksi** dan pilih arah transaksi beli/jual sesuai kejadian di loket.
2. Pilih nasabah, mata uang, kurs yang berlaku, jumlah valuta, serta metode pembayaran sesuai bukti aktual.
3. Periksa kembali nominal Rupiah, unit kutip, dan jumlah valuta sebelum menyimpan.
4. Bila sistem menandai transaksi untuk review, jangan mencari jalan pintas. Simpan sesuai workflow dan beri Supervisor informasi yang diperlukan.
5. Cetak atau simpan PDF bon hanya setelah informasi bon telah benar dan status transaksi mengizinkan.
6. Jangan memasukkan transaksi latihan di halaman ini. Gunakan **Simulasi Aman** untuk berlatih.

### 5.5 Review Transaksi Terflag — Admin/Supervisor

1. Buka ringkasan atau monitoring untuk melihat antrian review.
2. Tinjau alasan flag, data nasabah, nilai, kurs, dan informasi pendukung sesuai kebijakan internal.
3. Setujui atau tindak lanjuti hanya bila bukti memadai. Bila perlu koreksi, gunakan jalur pengembalian atau pembatalan yang disediakan sebelum transaksi selesai.
4. Jangan menghapus jejak agar transaksi tampak bersih. Keputusan dan perubahan harus dapat ditelusuri.

### 5.6 Kas, Persediaan, dan Stock Opname — Staff dan Supervisor

1. Catat kas pembukaan terlebih dahulu.
2. Selama hari berjalan, gunakan bon transaksi yang selesai sebagai dasar mutasi; jangan melakukan pembukuan paralel tanpa rekonsiliasi.
3. Menjelang tutup, masuk ke **Kas & Persediaan**, masukkan hitungan fisik per mata uang, lalu kirim stock opname.
4. Telaah varians yang tampil. Varians memerlukan peninjauan Supervisor; Direksi harus memperoleh informasi pengawasan sesuai workflow.
5. Jangan menyembunyikan selisih dengan mengubah angka fisik agar sama dengan sistem.

### 5.7 Penutupan Outlet — Staff dan Supervisor

1. Pastikan layanan selesai dan stock opname sudah ditinjau.
2. Kembali ke **Buka & Tutup Outlet**. Selesaikan opname fisik, rekonsiliasi kas, serah-terima uang, dan penguncian brankas berdasarkan kejadian nyata.
3. Simpan checklist penutupan. Bila seluruh langkah lengkap, tombol **Arsip PDF penutupan** dapat digunakan untuk arsip fisik/digital perusahaan.
4. Catatan operasional boleh berisi informasi serah-terima yang diperlukan, tetapi tidak boleh berisi nomor identitas nasabah.
5. Supervisor memeriksa varians dan tindakan terbuka sebelum hari operasional ditutup.

## 6. Pelaporan dan Pengawasan

### 6.1 Kesiapan Operasional — Controller

Buka **Kesiapan Operasional** pada awal dan akhir hari. Gunakan halaman ini untuk melihat kontrol kas, kurs, transaksi, dan **Paket Pelaporan**. Status tindakan hanya merupakan pengingat visual; Controller tetap harus membuka halaman sumber dan memeriksa penyebabnya.

### 6.2 Direksi Mengetahui

Controller membuka **Direksi Mengetahui** untuk melihat informasi yang perlu diakui Direksi. Direksi mengakui setelah membaca konteksnya. Pengakuan tidak menggantikan investigasi, persetujuan transaksi, atau koreksi kas.

### 6.3 Laporan Internal dan Jejak Audit

Gunakan **Laporan** untuk melihat ringkasan yang disediakan dan **Jejak Audit** untuk menelusuri tindakan penting. Bila terjadi perbedaan, jangan mengubah data untuk mengejar tampilan laporan. Cocokkan bon, kas, stock opname, dan audit log; lalu eskalasi sesuai struktur perusahaan.

## 7. Pelaporan Regulator Internal

Halaman **Pelaporan Regulator** adalah pusat persiapan internal. Halaman ini tidak terhubung untuk submit otomatis ke Bank Indonesia atau regulator lain.

| Tahap | Pembuat | Pemeriksa | Aturan penting |
|---|---|---|---|
| LKU dari transaksi hidup | Controller | Shareholder | Hanya transaksi produksi `COMPLETED` yang diperhitungkan. Data demo, historis, simulasi, draf, atau transaksi batal tidak masuk. |
| Snapshot B0002/B0003/B0004 | Controller | Shareholder | Gunakan input manual atau template; periksa pos sebelum simpan snapshot. |
| Bundle tiga workbook | Controller | Shareholder | Pemetaan dilakukan di memori; tidak menyimpan file, snapshot, atau paket sebelum tombol simpan snapshot ditekan. |
| Paket laporan | Controller | Shareholder | Status bergerak manual: `DRAFT → PREPARED → APPROVED → EXPORTED`. |
| Pengembalian paket | Shareholder | Controller | Catatan wajib. Controller memperbaiki sumber dan membuat draf baru; jejak paket lama tidak dihapus. |
| Tenggat dan prioritas | Controller / Shareholder | Controller / Shareholder | Label `TERLAMBAT`, `HARI INI`, atau `MENDATANG` hanya pengingat layar; tidak mengirim notifikasi dan tidak mengubah status. |
| Laporan insidental | Controller | Shareholder | Gunakan register dan catatan yang lengkap; tidak ada pengiriman eksternal otomatis. |

### 7.1 Cara Menggunakan Template Keuangan

1. Unduh template kosong dari halaman Pelaporan Regulator.
2. Isi hanya form yang relevan: **B0002 Neraca**, **B0003 Laba Rugi**, dan **B0004 Ekuitas**.
3. Jangan mengubah marker FORM, kode pos, atau struktur kolom yang menjadi dasar pemetaan.
4. Controller dapat memetakan satu workbook atau memilih tiga workbook terpisah.
5. Periksa hasil pemetaan di layar, koreksi sumber bila ada pos salah, lalu simpan snapshot hanya setelah angka ditelaah.
6. Buat paket, siapkan untuk review, lalu biarkan Shareholder yang berbeda dari pembuat menyetujui atau mengembalikan paket.

### 7.2 Batas Keamanan Impor Workbook

Impor workbook dibatasi untuk Controller/Shareholder, berukuran maksimal 5 MB, hanya menerima signature XLSX/XLS yang benar, dan tidak menyimpan bundle pemetaan sebelum snapshot disimpan. Audit dependency produksi pada finalisasi ini menyisakan dua temuan berprioritas tinggi pada parser SheetJS `xlsx` yang digunakan untuk **prototype pollution** dan **regular-expression denial of service (ReDoS)**; auditor paket tidak menyediakan versi perbaikan untuk jalur ini. Karena itu, impor hanya boleh memakai workbook yang berasal dari sumber internal tepercaya, disimpan di perangkat kerja perusahaan, telah diperiksa antivirus, dan benar-benar diperlukan. Jangan membuka atau mengimpor workbook dari email/sumber tidak dikenal. Bila sumber belum tepercaya, gunakan input manual dan minta Controller memverifikasi data sumber terlebih dahulu.

## 8. Keluhan Nasabah

1. Buka **Keluhan Nasabah** saat menerima pengaduan.
2. Catat tanggal, kontak, pokok keluhan, dan bukti sesuai formulir perusahaan.
3. Ubah status secara berurutan: diterima, dalam peninjauan, lalu hasil/eskalasi sesuai pemeriksaan.
4. Hasil penyelesaian atau eskalasi harus memiliki uraian tertulis.
5. Jangan membuka kembali kasus final untuk mengubah sejarah. Bila muncul kejadian baru, buat catatan baru sesuai prosedur internal.

## 9. Impor Nasabah

Controller menggunakan **Impor Nasabah** untuk data yang telah dibersihkan dan disetujui. Siapkan salinan kerja, periksa kolom yang dipetakan, dan uji pada batch kecil terlebih dahulu. Jangan mengimpor data ganda, file tanpa asal-usul, atau data yang belum memiliki dasar dokumen. Setelah impor, lakukan pemeriksaan jumlah dan pencarian beberapa sampel; jangan menganggap impor benar hanya karena file berhasil dibaca.

## 10. Simulasi Aman dan Latihan

Menu **Simulasi Aman** dirancang untuk latihan bon, guncangan kurs, penutupan, dan kelayakan arsip. Kartu latihan pada Pelaporan Regulator juga memungkinkan Controller/Shareholder melatih tenggat dan pengembalian paket di memori browser.

> Hasil latihan tidak boleh digunakan sebagai bukti transaksi, bukti kas, laporan keuangan, paket regulator, maupun keputusan kurs. Jika latihan telah selesai, muat ulang halaman atau keluar sesi untuk menghapus kondisi latihan yang hanya berada di memori.

### 10.1 Manajemen Pengguna dari Dashboard Shareholder

Dashboard Shareholder memiliki bagian **Manajemen pengguna** untuk memudahkan pengelolaan akun **Admin** dan **Staff** tanpa mencari menu terlebih dahulu. Bagian ini menampilkan jumlah Admin, Staff, dan akun nonaktif; angka tersebut adalah ringkasan akses, bukan ukuran kinerja pegawai.

1. Masuk memakai akun Shareholder pribadi. Jika sandi baru direset, selesaikan perubahan sandi wajib terlebih dahulu.
2. Dari **Hari Ini**, gunakan **Buat akun Admin** atau **Buat akun Staff**. Halaman **Akses Staf** terbuka dengan peran yang dipilih sudah terisi.
3. Isi nama, username unik, dan sandi sementara minimal 12 karakter. Sampaikan sandi sementara melalui kanal internal yang aman.
4. Akun baru wajib mengganti sandi sendiri pada login pertama sebelum dapat membuka back office.
5. Gunakan **Kelola seluruh akun** untuk meninjau status, mengubah peran antara Admin dan Staff, menonaktifkan akun, atau mereset sandi akun kerja.
6. Penonaktifan, perubahan peran, dan reset sandi mencabut sesi aktif akun yang dituju. Jangan mengubah akses hanya karena pergantian shift tanpa konfirmasi Controller/Shareholder.

> Peran tata kelola dilindungi. Controller hanya dapat dibuat oleh Shareholder; akun Controller dan Shareholder tidak dapat diubah menjadi Admin atau Staff melalui kontrol delegasi biasa. Jangan pernah memakai atau membagikan akun Shareholder untuk kerja harian.

## 11. Penanganan Kendala

| Kondisi | Tindakan pertama | Eskalasi |
|---|---|---|
| Halaman tidak memuat atau kosong | Segarkan halaman sekali, lalu masuk ulang bila sesi berakhir. Jangan mengklik simpan berulang-ulang. | Controller mencatat waktu, halaman, dan pesan error. |
| Nilai bon/kurs salah sebelum selesai | Jangan selesaikan transaksi. Periksa input dan gunakan jalur koreksi/pembatalan yang diizinkan. | Supervisor bila transaksi terflag atau sudah masuk review. |
| Varians kas | Ulangi hitung fisik dengan saksi dan cocokkan mutasi. Jangan menyesuaikan angka agar terlihat cocok. | Supervisor, lalu Direksi sesuai pengawasan. |
| Checklist tidak lengkap | Biarkan langkah tidak dicentang dan isi catatan operasional yang aman. | Supervisor sebelum transaksi/penutupan berlanjut. |
| Paket regulator dikembalikan | Baca catatan Shareholder, koreksi sumber, lalu buat draf baru. | Shareholder bila catatan atau dasar koreksi tidak jelas. |
| File XLS/XLSX ditolak | Pastikan file asli, kecil dari 5 MB, dan berformat/form yang benar. Jangan mencoba mengganti ekstensi file biasa menjadi `.xlsx`. | Controller; gunakan input manual bila sumber belum dapat dipercaya. |
| Lupa kata sandi / akun tidak tepat | Jangan memakai akun orang lain. | Controller atau Shareholder melakukan pengelolaan akses. |

## 12. Checklist Harian Ringkas untuk Dicetak

### Pembukaan

- [ ] Akun pribadi sudah digunakan dan sesi sebelumnya sudah ditutup.
- [ ] Kas awal per mata uang telah dicatat dari hitungan fisik.
- [ ] Lampu UV dan mesin hitung telah diperiksa.
- [ ] Checklist pembukaan telah disimpan.
- [ ] Kurs outlet telah diperiksa manusia dan setiap aktivasi memiliki alasan.

### Selama Operasional

- [ ] Nasabah dicari terlebih dahulu untuk mencegah duplikasi.
- [ ] Bon dibuat dari transaksi nyata, bukan latihan.
- [ ] Transaksi terflag diteruskan ke review.
- [ ] Selisih/kendala dicatat tanpa data identitas nasabah di catatan bebas.
- [ ] Supervisor memantau antrian dan kondisi kurs sesuai jadwal internal.

### Penutupan

- [ ] Stock opname fisik selesai untuk mata uang terkait.
- [ ] Varians ditinjau, bukan disembunyikan.
- [ ] Checklist penutupan disimpan setelah serah-terima dan penguncian brankas benar-benar selesai.
- [ ] Arsip PDF penutupan dicetak/disimpan sesuai kebijakan arsip perusahaan.
- [ ] Controller memeriksa Kesiapan Operasional, Direksi Mengetahui, dan Paket Pelaporan bila relevan.

## 13. Tindakan Wajib Sebelum Layanan Produksi Pertama

1. Shareholder dan Controller memastikan akun produksi individual, peran, serta kata sandi awal telah diperiksa.
2. Admin memeriksa kurs aktif, sumber referensi, dan alasan aktivasi terakhir.
3. Staff melakukan pembukaan outlet menggunakan kas fisik yang benar-benar tersedia.
4. Controller melakukan satu dry-run proses dengan dua akun perusahaan berbeda, tanpa memasukkan transaksi tiruan ke produksi.
5. Tim menyetujui jalur eskalasi: siapa yang dihubungi untuk varians kas, transaksi terflag, keluhan, kurs ekstrem, dan kendala sistem.
6. Workbook impor hanya berasal dari sumber perusahaan tepercaya sampai parser alternatif yang bebas dari temuan pemasok tersedia.

## 14. Penutup

Sistem akan paling berguna bila setiap pengguna mengikuti urutan kerja dan menjaga batas data. Kesalahan input harus diperbaiki melalui workflow yang tersedia, bukan dengan membuat catatan pengganti atau menghapus sejarah. Bila ada keraguan, tahan tindakan kritis, simpan bukti yang tersedia, dan eskalasi ke peran di atasnya.

**Dokumen ini adalah panduan operasional internal.** Panduan tidak menggantikan SOP perusahaan, ketentuan regulator, otorisasi Direksi/Shareholder, atau verifikasi hukum dan kepatuhan yang berlaku.
