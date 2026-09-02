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
5. Staff membuka **Buka & Tutup Outlet** dan **Kas Awal** untuk memastikan checklist serta mata uang kas dapat ditampilkan.
6. Shareholder membuka **Pelaporan Regulator** hanya untuk membaca panduan; jangan membuat paket dengan data percobaan.
7. Controller membuka **Akses Staf** dan menonaktifkan akun yang tidak digunakan atau belum diverifikasi.
8. Jika ada halaman kosong, pesan gagal memuat, atau angka yang tidak dikenal, **jangan lanjutkan transaksi**. Catat waktu, halaman, dan pesan yang tampil; lalu eskalasi ke Controller.

## 4. Peta Menu

| Kelompok menu | Menu | Kegunaan praktis | Peran minimum |
|---|---|---|---|
| Ringkasan | Hari Ini | Melihat transaksi, antrian, saldo tercatat, dan tindakan utama. | Staff |
| Ringkasan | Monitoring | Pengawasan kondisi operasional dan tindak lanjut. | Controller |
| Layanan & Transaksi | Buat Transaksi | Membuat bon jual/beli valuta baru, boleh berisi lebih dari satu mata uang. | Staff |
| Layanan & Transaksi | Daftar Transaksi | Melihat riwayat bon per jenis (Jual/Beli), cetak ulang, ekspor CSV, kirim/batalkan bon. | Staff |
| Layanan & Transaksi | Simulasi Aman | Latihan bon, guncangan kurs, penutupan, dan arsip tanpa penulisan produksi. | Staff |
| Layanan & Transaksi | Permintaan Layanan | Mencatat serta menindaklanjuti kebutuhan layanan. | Staff |
| Layanan & Transaksi | Nasabah Baru | Menambahkan data nasabah baru sesuai dokumen, termasuk Beneficial Owner, status PEP, dan pencocokan DTTOT/PPSPM. | Staff |
| Layanan & Transaksi | Daftar Nasabah | Mencari dan meninjau seluruh profil nasabah; ekspor data (tanpa dokumen KTP) ke CSV. | Staff |
| Kontrol Outlet | Buka & Tutup Outlet | Checklist pembukaan, penutupan, catatan serah-terima, dan arsip PDF penutupan. | Staff |
| Kontrol Outlet | Kurs Operasional | Memantau, menyiapkan, dan mengaktifkan kurs secara manual dengan alasan. | Admin |
| Kontrol Outlet | Bandingkan Kurs | Membandingkan kurs outlet dengan referensi yang tersedia. | Admin |
| Kontrol Outlet | Kas & Persediaan | Satu halaman dengan tab Kas Awal / Stok Saat Ini / Stock Opname / Penyesuaian Brankas (Controller); pindah tab tanpa ganti halaman. | Staff |
| Kontrol Outlet | Keluhan Nasabah | Register, investigasi, hasil, dan eskalasi pengaduan konsumen. | Staff |
| Pengawasan | Kesiapan Operasional | Kontrol harian Controller, termasuk status Paket Pelaporan. | Controller |
| Pengawasan | Direksi Mengetahui | Daftar informasi pengawasan yang perlu diakui Direksi. | Controller |
| Pengawasan | Mulai Go-Live | Checklist kesiapan penggunaan produksi. | Controller |
| Pengawasan | Laporan | Ringkasan internal dan arsip cetak/PDF yang tersedia. | Controller |
| Pengawasan | Pelaporan Regulator | LKU, snapshot B0002/B0003/B0004, insidental, maker-checker, dan ekspor manual. | Controller |
| Pengawasan | Jejak Audit | Melihat tindakan penting yang tercatat sistem. | Controller |
| Pengawasan | Impor Nasabah | Memetakan file pelanggan sesuai format yang ditetapkan. | Controller |
| Pengawasan | Akses Staf | Membuat, mengatur peran, menonaktifkan, mereset sandi, atau meninjau akun. Dashboard Shareholder menyediakan pintasan khusus untuk Admin dan Staff. | Controller |
| Pengawasan | Profil Perusahaan | Nama PT, nama dagang, izin usaha, logo, dan lampiran sertifikat — tampil di kwitansi cetak. | Controller |

## 5. Alur Satu Hari Operasional

### 5.1 Pembukaan Outlet — Staff

1. Masuk ke **Buka & Tutup Outlet**.
2. Periksa empat kontrol pembukaan: modal kerja diterima, lampu UV siap, mesin hitung siap, dan kas awal sudah dicatat.
3. Buka **Kas Awal** untuk mencatat kas pembukaan per mata uang, termasuk mata uang Rupiah (modal kerja untuk membayar pembelian). Masukkan angka fisik yang benar-benar diterima beserta rincian pecahannya (wajib); jangan mengisi angka perkiraan.
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
2. Bila belum ada, tambahkan melalui **Nasabah Baru**. Nomor CIF terisi otomatis mengikuti nomor terakhir (boleh diganti manual). Tandai "Berlaku seumur hidup" untuk identitas eKTP. Dokumen KTP dapat diunggah dalam bentuk JPG/PNG/WEBP/PDF. Gunakan kolom yang tersedia, bukan catatan bebas, untuk informasi identitas. Sejak persiapan pelaporan goAML, kolom **jenis kelamin**, **kewarganegaraan** (kode negara 2 huruf, mis. `ID`), serta **alamat terstruktur** (jenis alamat, negara, kota — provinsi/kecamatan/kode pos opsional) menjadi **wajib** untuk nasabah baru; **NPWP** opsional (isi bila nasabah memilikinya). Profil nasabah lama yang belum memiliki data ini tetap bisa dipakai, tapi sebaiknya dilengkapi lewat **Edit** sebelum dipakai untuk pelaporan.
3. Isi kolom **Beneficial Owner** bila nasabah bertindak atas nama pihak lain (mis. supir yang disuruh atasannya bertransaksi) — sistem akan membuat atau menautkan profil terpisah untuk pemilik manfaat sebenarnya.
4. Isi kolom **status PEP** (bukan PEP / nasabah adalah PEP / nasabah berhubungan dengan PEP) beserta keterangannya bila relevan.
5. Bila nama nasabah cocok dengan **Daftar DTTOT/PPSPM**, centang kolom tersebut dan isi catatan pencocokan. Profil otomatis berstatus RESTRICTED dan risiko TINGGI, dan wajib dilaporkan sebagai LTKM ke PPATK **secara manual** sesuai prosedur resmi — aplikasi ini tidak mengirim laporan otomatis ke regulator mana pun.
6. Jika data belum lengkap atau terdapat indikator risiko, ikuti instruksi sistem dan kebijakan perusahaan sebelum melanjutkan transaksi.
7. Gunakan **Permintaan Layanan** bila kebutuhan nasabah belum menjadi transaksi, agar pelayanan dapat ditindaklanjuti tanpa menciptakan bon palsu.
8. Gunakan tombol **Ekspor CSV** di Daftar Nasabah untuk keperluan pelaporan internal ringan; ekspor ini tidak menyertakan berkas dokumen KTP.
9. Klik baris nasabah di Daftar Nasabah untuk membuka popup detail. Tombol **Lihat foto identitas** menampilkan foto KTP langsung di popup (tanpa membuka tab baru) untuk berkas gambar; berkas PDF tetap perlu dibuka di tab baru. Tombol **Edit** membuka form perubahan data — setiap perubahan **wajib** disertai alasan (tercatat di jejak audit, tidak bisa dilewati).

### 5.4 Membuat Bon Transaksi — Staff

1. Buka **Buat Transaksi** dan pilih arah transaksi beli/jual sesuai kejadian di loket. Bon **jual** hanya bisa dibuat bila stok valuta asing tsb cukup, dan bon **beli** hanya bisa dibuat bila stok modal Rupiah cukup untuk membayar nasabah (keduanya dicek terhadap kas yang sudah tercatat sistem) — bila baru saja membeli/menjual hari ini, **selesaikan** bon terkait dulu (langkah 10) sebelum membuat bon berikutnya.
2. Isi **No. Kwitansi/Bon** sesuai buku kwitansi fisik yang sedang dipakai — buku Jual dan Beli punya nomor urut terpisah, jadi No. 1 boleh muncul di kedua buku sekaligus. Nomor ini diketik manual oleh teller, bukan otomatis.
3. Cari dan pilih nasabah.
4. Tambahkan satu **baris mata uang**: ketik kode atau nama mata uang di kotak pencarian (mis. "GBP") — semua mata uang di dunia bisa dicari dan otomatis terdaftar begitu dipilih, tidak dibatasi hanya mata uang yang sudah punya kurs otomatis. **Rupiah tidak bisa dipilih sebagai baris** — Rupiah selalu sisi pembayaran (langkah 6a/6b), bukan mata uang yang ditransaksikan.
5. Isi **rincian pecahan** pada baris tsb — wajib diisi, minimal satu baris pecahan (nilai pecahan, jumlah lembar/keping, dan **harga khusus pecahan itu**). Harga ditulis manual oleh teller per kelompok pecahan, karena pecahan besar dan kecil sering dihargai berbeda: misalnya transaksi 1.000 USD dengan pecahan 100×5 seharga 17.800, pecahan 50×5 seharga 17.500, dan pecahan 10×25 seharga 17.000 — tambahkan tiga baris pecahan seperti itu di baris mata uang yang sama. Kurs referensi (bila ada) hanya ditampilkan sebagai pembanding, bukan sumber harga. Untuk transaksi **JUAL**, isi "Jumlah [mata uang] yang akan dijual" lalu tekan **Auto-isi dari stok** untuk mengisi nilai dan jumlah lembar otomatis dari stok yang benar-benar tersedia (harga tetap harus diisi manual per baris); bila komposisi belum pas, sistem menawarkan **Tukar Pecahan** yang sama seperti di sisi Rupiah.
6. Tambah baris mata uang lagi bila nasabah menukar lebih dari satu mata uang sekaligus.
6a. Bila cara bayar **Tunai**, isi juga **rincian pecahan Rupiah** yang diterima/dibayarkan (wajib, total harus sama dengan nilai Rupiah transaksi) — ini sisi Rupiah dari bon, terpisah dari rincian pecahan valuta asing di langkah 5. Transfer bank/lainnya tidak memerlukan ini karena tidak ada uang fisik yang berpindah. Untuk transaksi **BELI**, tombol **Auto-isi dari stok** mengisi rincian ini otomatis dari pecahan Rupiah yang benar-benar tersedia di kas; bila komposisi belum pas (mis. kas hanya berisi pecahan besar), sistem menawarkan **Tukar Pecahan** senilai sama persis (mis. 1×100.000 → 1×50.000+2×20.000+2×5.000, tidak ada nilai yang hilang) — konfirmasi untuk mencatatnya, lalu rincian terisi otomatis.
6b. Bila cara bayar **Transfer bank**, pilih **rekening perusahaan** yang menerima/mengirim transfer tsb (wajib) — daftar rekening dikelola Controller ke atas di tab Kas Awal. Saldo rekening bergerak otomatis saat bon diselesaikan, arah sama seperti kas (BELI: uang keluar dari rekening; JUAL: uang masuk ke rekening). Isi juga **rekening lawan transaksi** (nama bank, nomor rekening, atas nama) — untuk BELI ini rekening tujuan (milik nasabah), untuk JUAL ini rekening pengirim; **bukan** dipilih dari daftar rekening kita sendiri. Atas nama rekening ini seharusnya sama dengan nama nasabah; bila berbeda, sistem mewajibkan keterangan alasan yang otomatis tercetak di kwitansi.
7. Bila transaksi dilakukan oleh **pihak kuasa/wakil** (termasuk pemilik manfaat/BO), pilih nasabah tersebut dari pencarian nasabah terdaftar — bukan mengetik nama/identitas bebas. Bila BO nasabah utama sudah terdaftar sebagai nasabah, sistem otomatis menyarankan nasabah tersebut untuk dikonfirmasi. Bila pihak kuasa/wakil belum terdaftar, daftarkan dulu sebagai nasabah (data KYC lengkap) sebelum melanjutkan bon.
8. **Transaksi Mencurigakan (TKM)**: centang bila operator menilai transaksi/nasabah mencurigakan — daftar indikator (perilaku nasabah, profil transaksi, indikator khusus KUPVA BB) akan muncul untuk dipilih; minimal satu indikator wajib dicentang. Data ini **internal saja** — tidak pernah tercetak di kwitansi maupun ikut ekspor CSV (larangan *tipping-off*), hanya tampil sebagai lencana **TKM** di Daftar Transaksi untuk staf/supervisor. Menandai TKM otomatis memaksa transaksi masuk alur review Supervisor.
9. **Dokumen underlying**: wajib begitu transaksi mencapai/melebihi setara USD 10.000 (dihitung sistem dari kurs referensi BI, bukan pilihan staf) — sistem otomatis mewajibkannya walau kotak centang tidak dicentang manual. Wajib diisi **alasan** transaksi memerlukan underlying, dan diunggah **ketiga dokumen**: Formulir Underlying, Surat Pernyataan, dan Invoice — bon tidak bisa dikirim sebelum ketiganya tersimpan.
10. Periksa kembali total keseluruhan bon sebelum menyimpan.
11. Bila sistem menandai transaksi untuk review, jangan mencari jalan pintas. Simpan sesuai workflow dan beri Supervisor informasi yang diperlukan. Ambang review nilai setara USD (≥10.000 USD) dihitung memakai **kurs jual referensi BI** (disinkronkan harian, bukan kurs outlet sendiri) — jadi ambang ini tidak berubah hanya karena kurs jual/beli outlet disesuaikan. Bon **tunai** ≥ Rp 500 juta (per transaksi maupun akumulasi tunai nasabah tsb hari itu) mendapat lencana **LTKT** di Daftar Transaksi — pengingat visual bahwa transaksi ini wajib dilaporkan sebagai Laporan Transaksi Keuangan Tunai ke PPATK secara manual sesuai prosedur; sistem tidak mengirim laporan ini secara otomatis.
12. Buka **Daftar Transaksi** untuk melihat riwayat per jenis (tab Semua/Jual/Beli). Begitu bon disetujui (baik otomatis untuk bon berisiko rendah maupun oleh Supervisor untuk bon yang di-flag), kas dan stok pecahan **langsung terposting** — tidak perlu langkah konfirmasi tambahan. Tombol **Selesaikan** hanya muncul bila sebuah bon tertahan di status "Disetujui" (mis. stok sempat kurang saat posting otomatis) dan perlu diposting ulang secara manual. Cetak kwitansi (mengikuti format kertas resmi PT Ibukota Valasindo, termasuk teks aturan wajib di bagian bawah), cetak ulang, atau **Ekspor CSV** detail bon per jenis transaksi juga tersedia di halaman ini.
13. Jangan memasukkan transaksi latihan di halaman ini. Gunakan **Simulasi Aman** untuk berlatih.

### 5.5 Review Transaksi Terflag — Admin/Controller/Shareholder

1. Buka **Pusat Kendali Outlet** (halaman awal setelah login). Transaksi berstatus "PERLU REVIEW" muncul di kartu **Worklist**, lengkap dengan lencana **TKM** bila transaksi tersebut ditandai mencurigakan. Staff biasa hanya melihat lencana "Menunggu Supervisor" di baris ini — tombol tindakan hanya tampil untuk Admin ke atas.
   - **Maker-checker**: pembuat (maker) sebuah transaksi tidak bisa menjadi peninjau (checker) transaksi itu sendiri, walau perannya Admin/Controller. Baris tersebut menampilkan lencana "Transaksi Anda sendiri" alih-alih tombol Tinjau, dan server menolak upaya review-nya juga (bukan hanya disembunyikan di UI). **Hanya Shareholder** yang boleh melewati aturan ini — mis. saat tidak ada peninjau lain yang tersedia.
2. Klik **Tinjau** pada transaksi yang ingin diputuskan. Sebuah jendela terbuka menampilkan: nomor kwitansi, jenis transaksi, nama nasabah, nilai Rupiah, rincian tiap baris mata uang (nominal dan kurs), alasan transaksi masuk antrian review (termasuk alasan ambang underlying bila ada), dan — bila transaksi ditandai TKM — daftar indikator kecurigaan beserta keterangan tambahan yang dipilih staf saat transaksi dibuat.
3. Isi **catatan keputusan** (wajib, minimal 3 karakter) yang menjelaskan pertimbangan Anda, lalu pilih salah satu tindakan:
   - **Setujui** — transaksi langsung diposting: kas dan stok pecahan terpotong/bertambah otomatis.
   - **Kembalikan ke teller** — transaksi dikirim balik ke status yang bisa diperbaiki dan dikirim ulang oleh staf.
   - **Eskalasi** — menandai transaksi perlu perhatian lebih lanjut (mis. ke Direktur/Shareholder) tanpa memposting maupun mengembalikannya.
4. Data indikator TKM dan keterangannya bersifat **internal** — tidak pernah tercetak di kwitansi maupun ikut ke ekspor CSV (larangan tipping-off ke nasabah tetap berlaku).
5. Jangan menghapus jejak agar transaksi tampak bersih. Setiap keputusan review (siapa, kapan, catatan, tindakan) tercatat dan dapat ditelusuri.

### 5.6 Kas, Persediaan, dan Stock Opname — Staff dan Supervisor

Menu ini adalah **satu halaman** ("Kas & Persediaan") dengan tab di dalamnya — **Kas Awal**, **Stok Saat Ini**, **Stock Opname**, dan **Penyesuaian Brankas** (khusus Controller ke atas). Pindah tab tidak berpindah halaman; setiap tab tetap menampilkan konteksnya secara penuh.

1. Buka tab **Kas Awal** terlebih dahulu, **termasuk rincian pecahan** (wajib) — ini stok fisik awal per pecahan yang jadi acuan sistem sepanjang hari. Cari mata uang lewat kotak pencarian, **termasuk IDR** untuk modal kerja Rupiah (dibutuhkan agar bon beli bisa diselesaikan — sistem menolak bon beli bila modal Rupiah tidak cukup) — tidak dibatasi ke mata uang yang sudah disinkronkan otomatis. Nilai pecahan dipilih dari daftar pecahan asli mata uang tersebut (bukan diketik bebas), supaya angka seperti "IDR 131.250.000, 1 lembar" tidak mungkin masuk sebagai pecahan.
1a. Di tab yang sama juga tersedia **Rekening Bank Perusahaan** — Controller ke atas dapat menambahkan rekening (nama bank, nama pemilik, nomor rekening, saldo awal), mengedit datanya, menonaktifkannya, atau mencatat penyesuaian saldo manual (mis. biaya bank). Staff hanya bisa melihat daftar dan memilihnya saat membuat bon Transfer Bank (§5.4 langkah 6b) — tidak bisa menambah/mengubah rekening.
2. Selama hari berjalan, kas dan stok pecahan **kedua sisi** (valuta asing dan Rupiah untuk pembayaran tunai) bergerak otomatis begitu bon **disetujui** — posting kas/stok sekarang langsung terjadi saat persetujuan, tidak perlu tombol "Selesaikan" terpisah lagi (lihat §5.4). Jangan melakukan pembukuan paralel tanpa rekonsiliasi. Buka tab **Stok Saat Ini** untuk melihat angka sistem berjalan per pecahan (kategori IDR mencakup kas fisik maupun saldo rekening bank secara terpisah); **cek fisik hanya perlu dilakukan sekali saat mau tutup**, bukan sepanjang hari.
3. Setor/ambil dari brankas atau penjualan luar jam kerja dicatat lewat tab **Penyesuaian Brankas** — rincian pecahan wajib diisi di sini juga.
4. Menjelang tutup, buka tab **Stock Opname**, masukkan hitungan fisik per mata uang (bandingkan dengan rincian pecahan di tab Stok Saat Ini), lalu kirim hasil hitung.
5. Telaah varians yang tampil. Varians memerlukan peninjauan Supervisor; Direksi harus memperoleh informasi pengawasan sesuai workflow.
6. Jangan menyembunyikan selisih dengan mengubah angka fisik agar sama dengan sistem.

### 5.7 Penutupan Outlet — Staff dan Supervisor

1. Pastikan layanan selesai dan stock opname sudah ditinjau.
2. Kembali ke **Buka & Tutup Outlet**. Selesaikan opname fisik, rekonsiliasi kas, serah-terima uang, dan penguncian brankas berdasarkan kejadian nyata.
3. Simpan checklist penutupan. Bila seluruh langkah lengkap, tombol **Arsip PDF penutupan** dapat digunakan untuk arsip fisik/digital perusahaan.
4. Catatan operasional boleh berisi informasi serah-terima yang diperlukan, tetapi tidak boleh berisi nomor identitas nasabah.
5. Supervisor memeriksa varians dan tindakan terbuka sebelum hari operasional ditutup.

### 5.8 Profil Perusahaan — Controller ke atas

1. Buka **Pengawasan → Profil Perusahaan**. Isi nama PT (badan hukum), nama moneychanger (dagang), nomor izin usaha KUPVA, Kode KUPVA, NPWP, NIB, alamat, telepon, email, dan website. Nama PT dan nama moneychanger wajib diisi, sisanya opsional.
2. **Sandi pelapor BI (SINTA)** bersifat sensitif — hanya untuk referensi internal, tidak pernah ditampilkan di kwitansi maupun layar publik manapun.
3. Unggah **logo** (JPG/PNG/WEBP, maksimal 8 MB) — tampil otomatis di kwitansi cetak begitu tersimpan.
4. Unggah **sertifikat izin usaha** (scan/foto) dan **lampiran izin lainnya** (bisa lebih dari satu file) untuk arsip digital perusahaan.
5. Nama moneychanger, alamat, dan telepon di sini otomatis dipakai di kwitansi cetak (menggantikan header baku bila sudah diisi).

### 5.9 Pencatatan Pengeluaran — Staff ke atas

1. Buka **Kontrol Outlet → Pencatatan Pengeluaran**. Halaman ini adalah log pengeluaran operasional sederhana (sewa, gaji, utilitas, perlengkapan, pemasaran, pemeliharaan, izin/pajak, lainnya) untuk pelaporan keuangan internal — **sepenuhnya terpisah** dari sistem transaksi valuta dan kas: mencatat pengeluaran di sini tidak pernah menyentuh saldo kas, stok pecahan, atau rekening bank.
2. Isi tanggal, kategori, nominal (Rp), dan deskripsi; catatan tambahan dan bukti pengeluaran (foto/scan struk, JPG/PNG/WEBP/PDF, maksimal 8 MB) bersifat opsional dan bisa ditambahkan kapan saja setelah entri tersimpan.
3. Setiap entri bersifat **permanen** (tidak dapat diedit atau dihapus) untuk menjaga jejak audit. Bila salah catat, tambahkan entri koreksi baru dengan keterangan yang jelas menjelaskan koreksinya — jangan mengandalkan edit/hapus yang memang sengaja tidak disediakan.
4. Riwayat pengeluaran menampilkan total bulan berjalan dan daftar seluruh entri, terbaru di atas.

## 6. Pelaporan dan Pengawasan

### 6.1 Kesiapan Operasional — Controller

Buka **Kesiapan Operasional** pada awal dan akhir hari. Gunakan halaman ini untuk melihat kontrol kas, kurs, transaksi, dan **Paket Pelaporan**. Status tindakan hanya merupakan pengingat visual; Controller tetap harus membuka halaman sumber dan memeriksa penyebabnya.

### 6.2 Direksi Mengetahui

Controller membuka **Direksi Mengetahui** untuk melihat informasi yang perlu diakui Direksi. Direksi mengakui setelah membaca konteksnya. Pengakuan tidak menggantikan investigasi, persetujuan transaksi, atau koreksi kas.

### 6.3 Laporan Internal dan Jejak Audit

Gunakan **Laporan** untuk melihat ringkasan yang disediakan dan **Jejak Audit** untuk menelusuri tindakan penting. Bila terjadi perbedaan, jangan mengubah data untuk mengejar tampilan laporan. Cocokkan bon, kas, stock opname, dan audit log; lalu eskalasi sesuai struktur perusahaan.

**Rekap keuangan transaksi** (kartu di bagian atas halaman **Laporan**, Controller ke atas): pilih preset **Hari ini**/**Bulan ini** atau rentang tanggal bebas, lalu lihat:
- Jumlah transaksi **Selesai**, turnover total, total beli dan total jual (Rupiah) untuk periode tsb — hanya bon yang sudah terposting ke kas/stok yang dihitung (DRAFT/PENDING_REVIEW/APPROVED/RETURNED/CANCELLED tidak masuk hitungan).
- **Estimasi margin kotor** per mata uang dan totalnya, dihitung dengan metode **rata-rata tertimbang**: kurs jual rata-rata dikurangi kurs beli rata-rata, dikalikan volume yang lebih kecil di antara total beli/jual mata uang tsb pada periode itu. Ini **bukan** perhitungan laba akuntansi penuh berbasis FIFO (sistem belum melacak lot valuta mana yang terjual dari pembelian mana) — perlakukan sebagai indikasi kasar, bukan angka final untuk laporan keuangan resmi.

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

### 7.3 Ekspor Data Pengguna Jasa (SIPESAT) — Controller ke atas

Kartu **Ekspor data pengguna jasa (SIPESAT)** di halaman Pelaporan Regulator membangun file CSV siap unggah manual ke `sipesat.ppatk.go.id` — **tidak pernah** mengirim data ke PPATK secara otomatis dari aplikasi ini.

1. Isi **ID PJK SIPESAT** di **Profil Perusahaan** terlebih dahulu (nomor ini terlihat di pojok kanan atas halaman SIPESAT setelah login, berbeda dari NPWP/nomor izin KUPVA). Tombol ekspor tidak aktif sampai field ini terisi.
2. Pilih jenis: **Data Initial** (laporan pertama kali, mencakup **seluruh** nasabah live termasuk yang sudah tidak aktif/ditutup — Pasal 13 Peraturan Kepala PPATK Nomor PER-02/1.02/PPATK/02/2014) atau **Data Triwulan** (pilih triwulan dan tahun; mencakup **hanya nasabah baru** yang tercatat pada periode tsb, Pasal 12 huruf b — bukan nasabah lama yang sekadar diperbarui datanya).
3. Klik **Unduh CSV** — file otomatis dinamai sesuai konvensi resmi SIPESAT (`SIPESAT_<IDPJK>_IN_<DDMMYYYY>_1.csv` untuk initial, `SIPESAT_<IDPJK>_TW_<Triwulan><Tahun>_<DDMMYYYY>_1.csv` untuk triwulan). Ganti angka nomor urut di akhir nama file secara manual bila mengunggah lebih dari satu berkas untuk periode yang sama.
4. Login ke `sipesat.ppatk.go.id` dengan akun goAML PJK, buka menu **Upload → Upload Baru**, pilih jenis data yang sesuai, dan unggah file yang sudah diunduh — jangan mengubah nama file yang sudah dihasilkan. Batas waktu unggah Data Triwulan: tanggal **15 bulan berikutnya** setelah akhir triwulan (mundur ke hari kerja berikutnya bila jatuh pada akhir pekan/libur nasional — Pasal 14).
5. **Batasan yang perlu diketahui**: kolom **No.NPWP** pada file yang dihasilkan **selalu kosong** karena sistem ini belum membedakan nasabah perorangan vs. korporasi dan belum menyimpan NPWP per nasabah — padahal Pasal 7 mewajibkan NPWP untuk nasabah berbentuk Korporasi. Isi manual di file sebelum unggah bila ada nasabah korporasi yang perlu dilaporkan.

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
