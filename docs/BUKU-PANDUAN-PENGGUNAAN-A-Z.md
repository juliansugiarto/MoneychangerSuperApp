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
3. Controller membuka **Pengaturan → Langkah Persiapan Awal** dan **Kepatuhan → Status Kesiapan** untuk memeriksa kontrol yang belum siap.
4. Admin memeriksa **Uang & Kurs → Kurs → Kurs Hari Ini** dan **Bandingkan Kurs**; pastikan daftar kurs aktif benar-benar milik outlet dan bukan data demo/historis.
5. Controller mencatat **setoran modal** pemilik lewat **Kas & Persediaan → Modal & Bank** sebelum hitungan kas pagi yang pertama diisi. Kas awal pertama untuk sebuah mata uang tidak dijurnal bila asal uangnya belum tercatat, sehingga urutan terbalik meninggalkan Kas Rupiah timpang di buku besar (lihat §5.6a).
6. Staff membuka **Buka & Tutup Outlet** dan **Kas Awal** untuk memastikan checklist serta mata uang kas dapat ditampilkan.
7. Shareholder membuka **Pelaporan Regulator** hanya untuk membaca panduan; jangan membuat paket dengan data percobaan.
8. Controller membuka **Akses Staf** dan menonaktifkan akun yang tidak digunakan atau belum diverifikasi.
9. Jika ada halaman kosong, pesan gagal memuat, atau angka yang tidak dikenal, **jangan lanjutkan transaksi**. Catat waktu, halaman, dan pesan yang tampil; lalu eskalasi ke Controller.

## 4. Peta Menu

Kelompok menu mengikuti sidebar sekarang (`shared/backOfficeNavigation.ts`): Hari ini, Transaksi, Uang
& Kurs, Nasabah, Risiko, Laporan, Kepatuhan, Pengaturan. Beberapa menu adalah anak dari induk yang
hanya mengembang (**Uang Kas**, **Kurs**) — ditulis `Kelompok → Induk → Menu`.

| Kelompok menu | Menu | Kegunaan praktis | Peran minimum |
|---|---|---|---|
| Hari ini | Hari Ini | Melihat transaksi, antrian, saldo tercatat, dan tindakan utama. | Staff |
| Hari ini | Buka & Tutup Outlet | Checklist pembukaan, penutupan, catatan serah-terima, dan arsip PDF penutupan. | Staff |
| Hari ini | Pantauan Harian | Pengawasan kondisi operasional dan tindak lanjut (dahulu "Monitoring"). | Controller |
| Hari ini | Meja Konfirmasi | Mencatat serta menindaklanjuti kebutuhan layanan — antrian permintaan layanan (dahulu menu terpisah "Permintaan Layanan"). | Staff |
| Transaksi | Buat Transaksi | Membuat bon jual/beli valuta baru, boleh berisi lebih dari satu mata uang. | Staff |
| Transaksi | Daftar Transaksi | Melihat riwayat bon per jenis (Jual/Beli), cetak ulang, ekspor CSV, kirim/batalkan bon. | Staff |
| Transaksi | Latihan (Tanpa Data Asli) | Latihan bon, guncangan kurs, penutupan, dan arsip tanpa penulisan produksi (dahulu "Simulasi Aman"). | Staff |
| Uang & Kurs → Uang Kas | Kas Awal Hari Ini | Mencatat kas pembukaan per mata uang dengan rincian pecahan wajib. Halaman ini juga memuat tab Stok Saat Ini, Stock Opname, Penyesuaian Brankas (Controller), dan Modal & Bank (Controller) — dahulu satu menu "Kas & Persediaan", kini dibuka lewat salah satu dari tiga menu di bawah ini; tab-nya tidak ganti halaman. | Staff |
| Uang & Kurs → Uang Kas | Sisa Uang Saat Ini | Melihat stok kas berjalan per mata uang dan pecahan (tab yang sama dengan Kas Awal Hari Ini). | Staff |
| Uang & Kurs → Uang Kas | Hitung Fisik Uang | Stock opname: menghitung fisik uang dan merekonsiliasi selisih (tab yang sama). | Staff |
| Uang & Kurs → Uang Kas | Penyesuaian Brankas | Penyesuaian brankas/off-hours dengan rincian pecahan wajib (tab yang sama). | Controller |
| Uang & Kurs → Kurs | Kurs Hari Ini | Memantau, menyiapkan, dan mengaktifkan kurs secara manual dengan alasan (dahulu "Kurs Operasional"). | Admin |
| Uang & Kurs → Kurs | Bandingkan Kurs | Membandingkan kurs outlet dengan referensi yang tersedia. | Admin |
| Nasabah | Nasabah Baru | Menambahkan data nasabah baru sesuai dokumen, termasuk Beneficial Owner, status PEP, dan pencocokan DTTOT/DPPSPM. | Staff |
| Nasabah | Daftar Nasabah | Mencari dan meninjau seluruh profil nasabah; ekspor data (tanpa dokumen KTP) ke CSV. | Staff |
| Nasabah | Keluhan Nasabah | Register, investigasi, hasil, dan eskalasi pengaduan konsumen. | Staff |
| Nasabah | Pemantauan Profil | Worklist nasabah yang jatuh tempo ditinjau, deklarasi profil transaksi disandingkan dengan aktivitas nyatanya, dan pencatatan hasil peninjauan. | Controller |
| Nasabah | Tambah dari Excel | Memetakan file pelanggan sesuai format yang ditetapkan (dahulu "Impor Nasabah" di kelompok Pengawasan). | Controller |
| Laporan | Laporan Transaksi | Ringkasan internal dan arsip cetak/PDF yang tersedia (dahulu "Laporan" di kelompok Pengawasan). | Controller |
| Laporan | Aset Tetap | Daftar aset tetap outlet, pendaftaran aset baru, pelepasan aset, dan batas kapitalisasi. | Controller |
| Laporan | Riwayat Aktivitas | Melihat tindakan penting yang tercatat sistem (dahulu "Jejak Audit" di kelompok Pengawasan). | Controller |
| Kepatuhan | Status Kesiapan | Kontrol harian Controller, termasuk status Paket Pelaporan (dahulu "Kesiapan Operasional" di kelompok Pengawasan). | Controller |
| Kepatuhan | Untuk Diketahui Direksi | Daftar informasi pengawasan yang perlu diakui Direksi (dahulu "Direksi Mengetahui"). | Controller |
| Kepatuhan | Laporan ke Regulator | LKU, snapshot B0002/B0003/B0004, insidental, maker-checker, dan ekspor manual (dahulu "Pelaporan Regulator"). | Controller |
| Kepatuhan | Arsip Dokumen | SOP, kebijakan internal, surat-menyurat BI, notulen rapat, dan korespondensi regulator, beserta riwayat versi dan masa berlakunya. | Controller |
| Pengaturan | Pengguna & Hak Akses | Membuat, mengatur peran, menonaktifkan, mereset sandi, atau meninjau akun. Dashboard Shareholder menyediakan pintasan khusus untuk Admin dan Staff (dahulu "Akses Staf" di kelompok Pengawasan). | Controller |
| Pengaturan | Profil Perusahaan | Nama PT, nama dagang, izin usaha, logo, dan lampiran sertifikat — tampil di kwitansi cetak. | Controller |
| Pengaturan | Langkah Persiapan Awal | Checklist kesiapan penggunaan produksi (dahulu "Mulai Go-Live" di kelompok Pengawasan). | Controller |

### Mencari halaman dengan cepat

Tekan **⌘K** (Mac) atau **Ctrl+K** (Windows), ketik sebagian nama halaman — misalnya "kas awal" atau
"IRA" — lalu tekan Enter. Hanya halaman yang boleh dibuka peran Anda yang muncul. Di luar kolom isian,
tombol **N** membuka Buat Transaksi dan **/** membuka pencarian yang sama. **N** dan **/** sengaja
tidak aktif selama sebuah kotak dialog terbuka, supaya menekannya tidak berpindah halaman dan membuang
isian dialog yang belum disimpan; ⌘K/Ctrl+K tetap berlaku di mana pun.

## 5. Alur Satu Hari Operasional

### 5.1 Pembukaan Outlet — Staff

1. Masuk ke **Buka & Tutup Outlet**.
2. Periksa empat kontrol pembukaan: modal kerja diterima, lampu UV siap, mesin hitung siap, dan kas awal sudah dicatat.
3. Buka **Kas Awal** untuk mencatat kas pembukaan per mata uang, termasuk mata uang Rupiah (modal kerja untuk membayar pembelian). Masukkan angka fisik yang benar-benar diterima beserta rincian pecahannya (wajib); jangan mengisi angka perkiraan.
4. Kembali ke checklist, centang hanya kontrol yang telah dilakukan, lalu klik **Simpan pembukaan**.
5. Bila ada alat rusak atau modal belum diterima, jangan mencentang kontrol tersebut. Tulis catatan operasional singkat tanpa nomor identitas nasabah dan beri tahu Supervisor.

### 5.2 Pemeriksaan Kurs — Admin/Supervisor

1. Buka **Uang & Kurs → Kurs → Kurs Hari Ini** dan **Bandingkan Kurs**.
2. Tinjau referensi BI/JISDOR, pasar, atau sumber yang tersedia pada sistem; periksa tanggal/waktu serta unit kutipannya.
3. Bila ada perubahan tajam, jangan langsung mengaktifkan kurs. Catat alasan, nilai pembanding, dan minta peninjauan sesuai kebijakan internal.
4. Saat keputusan kurs sudah disetujui manusia, masukkan alasan aktivasi yang jelas, lalu lakukan aktivasi manual.
5. Pastikan kurs demo, historis, atau simulasi tidak digunakan sebagai kurs operasi outlet.

### 5.3 Layanan Nasabah dan KYC — Staff

1. Cari nasabah di menu **Daftar Nasabah** (ketik nama atau NIK/nomor identitas, hasil langsung tersaring) sebelum membuat data baru untuk menghindari duplikasi.
2. Bila belum ada, tambahkan melalui **Nasabah Baru**. Nomor CIF terisi otomatis mengikuti nomor terakhir (boleh diganti manual). Tandai "Berlaku seumur hidup" untuk identitas eKTP. Dokumen KTP dapat diunggah dalam bentuk JPG/PNG/WEBP/PDF. Gunakan kolom yang tersedia, bukan catatan bebas, untuk informasi identitas. Sejak persiapan pelaporan goAML, kolom **jenis kelamin**, **kewarganegaraan** (kode negara 2 huruf, mis. `ID`), serta **alamat terstruktur** (jenis alamat, negara, kota — provinsi/kecamatan/kode pos opsional) menjadi **wajib** untuk nasabah baru; **NPWP** opsional (isi bila nasabah memilikinya). Profil nasabah lama yang belum memiliki data ini tetap bisa dipakai, tapi sebaiknya dilengkapi lewat **Edit** sebelum dipakai untuk pelaporan.
2a. Isi bagian **Kategori menurut Bank Indonesia**. Pilih **jenis nasabah** lebih dulu: untuk **Perorangan** muncul **kategori pekerjaan** (23 kategori tertutup Form C1), untuk **Badan usaha** muncul **bentuk badan hukum** (11 bentuk). Kategori ini **berdampingan** dengan kolom **Pekerjaan** di atasnya, tidak menggantikannya — kwitansi dan pelaporan goAML tetap mencetak kata-kata sebagaimana tertulis pada identitas. Kategori pekerjaan **boleh dikosongkan** bila belum jelas; nasabah yang belum berkategori muncul dengan penanda **"Kategori BI belum diisi"** di Daftar Nasabah dan ikut dilaporkan sebagai jumlah nasabah belum berkategori pada agregat Form C1. Jangan menebak kategori dari tulisan bebas di kolom Pekerjaan — kategori yang dikarang membuat komposisi profesi yang dilaporkan ke BI menjadi salah. Berbeda dari deklarasi aktivitas (§6.3), kategori yang **tidak diubah tidak akan terhapus** saat profil disunting untuk alasan lain.
3. Isi kolom **Beneficial Owner** bila nasabah bertindak atas nama pihak lain (mis. supir yang disuruh atasannya bertransaksi) — sistem akan membuat atau menautkan profil terpisah untuk pemilik manfaat sebenarnya.
4. Isi kolom **status PEP** (bukan PEP / nasabah adalah PEP / nasabah berhubungan dengan PEP) beserta keterangannya bila relevan.
5. Bila nama nasabah cocok dengan **Daftar DTTOT/DPPSPM**, centang kolom tersebut dan isi catatan pencocokan. Profil otomatis berstatus RESTRICTED dan risiko TINGGI, dan wajib dilaporkan sebagai LTKM ke PPATK **secara manual** sesuai prosedur resmi — aplikasi ini tidak mengirim laporan otomatis ke regulator mana pun. Gunakan tombol **"Cek sekarang di DTTOT/DPPSPM"** di bawah kolom ini (atau halaman **Nasabah → Cek Daftar DTTOT/DPPSPM**, §5.10) untuk membantu pencarian nama secara otomatis sebelum mencentang — ini murni **alat bantu penyaringan**; keputusan mencentang dan mengisi catatan tetap manual oleh petugas.
5a. **Jejak penyaringan berjalan sendiri.** Setiap kali profil nasabah disimpan — baik dibuat maupun disunting — sistem menyaring namanya terhadap DTTOT/DPPSPM dan menulis satu baris riwayat, **termasuk ketika hasilnya nihil**: yang dituntut pemeriksa adalah bukti bahwa pengecekannya dijalankan, bukan hanya temuannya. Penyaringan tidak pernah menahan penyimpanan data nasabah, dan **tidak pernah** mencentang kolom Cocok DTTOT/DPPSPM sendiri. Setiap kali daftar sanksi diimpor ulang (§5.10), seluruh nasabah aktif disaring ulang otomatis.

5b. **Panel "Riwayat penyaringan DTTOT/DPPSPM"** pada popup detail nasabah (§9) menampilkan waktu, pemicu (nasabah dibuat/diubah, daftar diimpor, atau diminta petugas), siapa yang menjalankannya atau "Otomatis (sistem)", banyaknya kemungkinan cocok, dan **versi daftar** yang dipakai. Tiga keadaan dibedakan: *Belum pernah disaring*, peringatan **daftar sudah lebih baru daripada penyaringan terakhir**, dan mutakhir. Tombol **"Saring ulang sekarang"** menjalankan penyaringan atas permintaan — pakai tombol ini, jangan menyunting data KYC hanya untuk memicu penyaringan.

5c. **Nasabah berisiko TINGGI wajib diputuskan Pemegang Saham sebelum dapat bertransaksi** (Pasal 32 ayat (5) dan (6) PBI 10/2024). Selama keputusannya **Belum** — atau bila **Ditolak** — bon baru atas nama nasabah itu **ditolak sistem**, dan borang transaksi menampilkan alasannya. Kendali **"Setujui — nasabah dapat bertransaksi"** dan **"Tolak — hentikan hubungan usaha"** hanya muncul bagi Pemegang Saham pada panel yang sama, dan wajib disertai alasan tertulis yang masuk jejak audit. Aturan yang sama berlaku atas pihak kuasa/wakil pada bon. Bila tingkat risiko nasabah **berpindah menjadi TINGGI**, keputusan lama otomatis kembali ke **Belum** — persetujuan yang dulu diberikan atas alasan lain tidak menaungi risiko baru. Menyunting nasabah yang memang sudah TINGGI **tidak** mencabut persetujuannya.

6. Jika data belum lengkap atau terdapat indikator risiko, ikuti instruksi sistem dan kebijakan perusahaan sebelum melanjutkan transaksi.
7. Gunakan **Hari ini → Meja Konfirmasi** (antrean permintaan layanan) bila kebutuhan nasabah belum menjadi transaksi, agar pelayanan dapat ditindaklanjuti tanpa menciptakan bon palsu.
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
6c. Pilih **jalur distribusi** — bagaimana bon ini dilayani: **Kantor/gerai** (bawaan, terpilih lebih dulu), **Layanan delivery**, atau **Online/merchant**. Biarkan apa adanya bila nasabah datang ke gerai. Kolom ini menjadi sumber parameter jalur distribusi pada penilaian risiko (§6.4); ia **tidak** memengaruhi kas, stok, maupun rincian pecahan.
7. Bila transaksi dilakukan oleh **pihak kuasa/wakil** (termasuk pemilik manfaat/BO), pilih nasabah tersebut dari pencarian nasabah terdaftar — bukan mengetik nama/identitas bebas. Bila BO nasabah utama sudah terdaftar sebagai nasabah, sistem otomatis menyarankan nasabah tersebut untuk dikonfirmasi. Bila pihak kuasa/wakil belum terdaftar, daftarkan dulu sebagai nasabah (data KYC lengkap) sebelum melanjutkan bon.
8. **Transaksi Mencurigakan (TKM)**: centang bila operator menilai transaksi/nasabah mencurigakan — daftar indikator (perilaku nasabah, profil transaksi, indikator khusus KUPVA BB) akan muncul untuk dipilih; minimal satu indikator wajib dicentang. Data ini **internal saja** — tidak pernah tercetak di kwitansi maupun ikut ekspor CSV (larangan *tipping-off*), hanya tampil sebagai lencana **TKM** di Daftar Transaksi untuk staf/supervisor. Menandai TKM otomatis memaksa transaksi masuk alur review Supervisor.
9. **Dokumen underlying**: wajib begitu transaksi mencapai/melebihi setara USD 10.000 (dihitung sistem dari kurs referensi BI, bukan pilihan staf) — sistem otomatis mewajibkannya walau kotak centang tidak dicentang manual. Wajib diisi **alasan** transaksi memerlukan underlying, dan diunggah **ketiga dokumen**: Formulir Underlying, Surat Pernyataan, dan Invoice — bon tidak bisa dikirim sebelum ketiganya tersimpan.
10. Periksa kembali total keseluruhan bon sebelum menyimpan.
11. Bila sistem menandai transaksi untuk review, jangan mencari jalan pintas. Simpan sesuai workflow dan beri Supervisor informasi yang diperlukan. Ambang review nilai setara USD (≥10.000 USD) dihitung memakai **kurs jual referensi BI** (disinkronkan harian, bukan kurs outlet sendiri) — jadi ambang ini tidak berubah hanya karena kurs jual/beli outlet disesuaikan. Bon **tunai** ≥ Rp 500 juta (per transaksi maupun akumulasi tunai nasabah tsb hari itu) mendapat lencana **LTKT** di Daftar Transaksi — pengingat visual bahwa transaksi ini wajib dilaporkan sebagai Laporan Transaksi Keuangan Tunai ke PPATK secara manual sesuai prosedur; sistem tidak mengirim laporan ini secara otomatis.
12. Buka **Daftar Transaksi** untuk melihat riwayat per jenis (tab Semua/Jual/Beli). Begitu bon disetujui (baik otomatis untuk bon berisiko rendah maupun oleh Supervisor untuk bon yang di-flag), kas dan stok pecahan **langsung terposting** — tidak perlu langkah konfirmasi tambahan. Tombol **Selesaikan** hanya muncul bila sebuah bon tertahan di status "Disetujui" (mis. stok sempat kurang saat posting otomatis) dan perlu diposting ulang secara manual. Cetak kwitansi (mengikuti format kertas resmi PT Ibukota Valasindo, termasuk teks aturan wajib di bagian bawah), cetak ulang, atau **Ekspor CSV** detail bon per jenis transaksi juga tersedia di halaman ini.
13. Jangan memasukkan transaksi latihan di halaman ini. Gunakan **Transaksi → Latihan (Tanpa Data Asli)** untuk berlatih.

### 5.5 Review Transaksi Terflag — Admin/Controller/Shareholder

1. Buka **Hari ini → Hari Ini** (halaman awal setelah login). Transaksi berstatus "PERLU REVIEW" muncul di kartu **Worklist**, lengkap dengan lencana **TKM** bila transaksi tersebut ditandai mencurigakan. Staff biasa hanya melihat lencana "Menunggu Supervisor" di baris ini — tombol tindakan hanya tampil untuk Admin ke atas.
   - **Maker-checker**: pembuat (maker) sebuah transaksi tidak bisa menjadi peninjau (checker) transaksi itu sendiri, walau perannya Admin/Controller. Baris tersebut menampilkan lencana "Transaksi Anda sendiri" alih-alih tombol Tinjau, dan server menolak upaya review-nya juga (bukan hanya disembunyikan di UI). **Hanya Shareholder** yang boleh melewati aturan ini — mis. saat tidak ada peninjau lain yang tersedia.
2. Klik **Tinjau** pada transaksi yang ingin diputuskan. Sebuah jendela terbuka menampilkan: nomor kwitansi, jenis transaksi, nama nasabah, nilai Rupiah, rincian tiap baris mata uang (nominal dan kurs), alasan transaksi masuk antrian review (termasuk alasan ambang underlying bila ada), dan — bila transaksi ditandai TKM — daftar indikator kecurigaan beserta keterangan tambahan yang dipilih staf saat transaksi dibuat.
3. Isi **catatan keputusan** (wajib, minimal 3 karakter) yang menjelaskan pertimbangan Anda, lalu pilih salah satu tindakan:
   - **Setujui** — transaksi langsung diposting: kas dan stok pecahan terpotong/bertambah otomatis.
   - **Kembalikan ke teller** — transaksi dikirim balik ke status yang bisa diperbaiki dan dikirim ulang oleh staf.
   - **Eskalasi** — menandai transaksi perlu perhatian lebih lanjut (mis. ke Direktur/Shareholder) tanpa memposting maupun mengembalikannya.
4. Data indikator TKM dan keterangannya bersifat **internal** — tidak pernah tercetak di kwitansi maupun ikut ke ekspor CSV (larangan tipping-off ke nasabah tetap berlaku).
5. Jangan menghapus jejak agar transaksi tampak bersih. Setiap keputusan review (siapa, kapan, catatan, tindakan) tercatat dan dapat ditelusuri.

### 5.6 Kas, Persediaan, dan Stock Opname — Staff dan Supervisor

Menu ini adalah **satu halaman** ("Kas & Persediaan") dengan tab di dalamnya — **Kas Awal**, **Stok Saat Ini**, **Stock Opname**, **Penyesuaian Brankas**, dan **Modal & Bank** (dua terakhir khusus Controller ke atas). Pindah tab tidak berpindah halaman; setiap tab tetap menampilkan konteksnya secara penuh.

1. Buka tab **Kas Awal** terlebih dahulu, **termasuk rincian pecahan** (wajib) — ini stok fisik awal per pecahan yang jadi acuan sistem sepanjang hari. Cari mata uang lewat kotak pencarian, **termasuk IDR** untuk modal kerja Rupiah (dibutuhkan agar bon beli bisa diselesaikan — sistem menolak bon beli bila modal Rupiah tidak cukup) — tidak dibatasi ke mata uang yang sudah disinkronkan otomatis. Nilai pecahan dipilih dari daftar pecahan asli mata uang tersebut (bukan diketik bebas), supaya angka seperti "IDR 131.250.000, 1 lembar" tidak mungkin masuk sebagai pecahan. **Pada hari pertama, catat setoran modal lebih dulu lewat tab Modal & Bank** (§5.6a); bila urutannya terbalik, sistem memunculkan peringatan pada kas awal Rupiah pertama — pencatatannya tetap berhasil, tetapi mutasi itu tidak akan dijurnal ke buku besar sampai modalnya dicatat.
1a. Di tab yang sama juga tersedia **Rekening Bank Perusahaan** — Controller ke atas dapat menambahkan rekening (nama bank, nama pemilik, nomor rekening, saldo awal), mengedit datanya, menonaktifkannya, atau mencatat penyesuaian saldo manual (mis. biaya bank). Staff hanya bisa melihat daftar dan memilihnya saat membuat bon Transfer Bank (§5.4 langkah 6b) — tidak bisa menambah/mengubah rekening.
2. Selama hari berjalan, kas dan stok pecahan **kedua sisi** (valuta asing dan Rupiah untuk pembayaran tunai) bergerak otomatis begitu bon **disetujui** — posting kas/stok sekarang langsung terjadi saat persetujuan, tidak perlu tombol "Selesaikan" terpisah lagi (lihat §5.4). Jangan melakukan pembukuan paralel tanpa rekonsiliasi. Buka tab **Stok Saat Ini** untuk melihat angka sistem berjalan per pecahan (kategori IDR mencakup kas fisik maupun saldo rekening bank secara terpisah); **cek fisik hanya perlu dilakukan sekali saat mau tutup**, bukan sepanjang hari.
3. Setor/ambil dari brankas atau penjualan luar jam kerja dicatat lewat tab **Penyesuaian Brankas** — rincian pecahan wajib diisi di sini juga.
3a. Setoran/penarikan modal pemilik dan pemindahan kas ke/dari rekening bank **tidak** dicatat di sini, melainkan di tab **Modal & Bank** (lihat §5.6a) — hanya kategori itulah yang dapat dijurnal ke buku besar.
4. Menjelang tutup, buka tab **Stock Opname** dan hitung uangnya **per pecahan untuk dua tempat sekaligus — laci dan brankas**. Nominalnya dijumlahkan dari rincian itu; tidak ada lagi angka yang diketik. Rincian **laci wajib** diisi. Brankas yang memang kosong **tetap harus dinyatakan kosong** (biarkan daftarnya tanpa baris) — itu berbeda artinya dari "tidak dihitung", dan brankas yang menurut sistem berisi akan langsung menyalakan varians. Layar menampilkan selisih per pecahan terhadap angka sistem **sebelum** dikirim; selisih bukan galat, dan hasil hitung tetap boleh dikirim.
5. Telaah varians yang tampil. Varians memerlukan peninjauan Supervisor; Direksi harus memperoleh informasi pengawasan sesuai workflow. **Selisih komposisi pecahan yang totalnya nol tetap memerlukan peninjauan** — komposisi yang meleset berarti ada pergerakan tak tercatat, tukar pecahan yang tak dibukukan, atau salah hitung, dan total yang kebetulan cocok justru menyembunyikannya.
6. Jangan menyembunyikan selisih dengan mengubah angka fisik agar sama dengan sistem.

### 5.6a Modal dan Pemindahan Kas ke Bank — Controller ke atas

Tab **Modal & Bank** di halaman "Kas & Persediaan" mencatat uang yang **melintasi batas usaha** — uang pemilik yang masuk atau keluar, dan kas fisik yang berpindah ke/dari rekening bank perusahaan. Tanpa tab ini, uang pemilik menyamar sebagai selisih hitungan kas pagi dan buku besar tidak bisa menjurnalnya, sehingga akun 1-1110 Kas Rupiah berjalan negatif meski uangnya nyata ada di laci.

**Urutan yang benar pada hari pertama: catat setoran modal lebih dulu, baru isi hitungan kas pagi.**

Alasannya: kas awal **pertama** untuk sebuah mata uang tidak dijurnal — kalau uangnya belum pernah dicatat asalnya, menjurnalnya berarti mencatat uang yang muncul entah dari mana (dan menjadikannya "pendapatan lain-lain" akan salah besar). Buku besar akan menyebutkan alasan itu apa adanya pada daftar "dilewati": *"kas awal pertama; asal uangnya belum tercatat — catat sebagai setoran modal lebih dulu"*. Bila urutannya benar — modal masuk dulu, lalu hitungan kas pagi mencocokkan uang yang sama — selisih pembukaannya nol dan tidak ada yang perlu dijurnal.

1. **Setoran modal (uang pemilik masuk).** Pilih mata uang, arah **Masuk**, isi nominal, alasan (minimal 5 karakter, dipakai sebagai memo jurnal), dan **rincian pecahan yang wajib**. Jurnalnya: debit 1-1110 Kas Rupiah, kredit 3-1100 Modal Disetor.
2. **Penarikan pemilik (uang pemilik keluar).** Arah **Keluar**, isian sama. Jurnalnya: debit 3-4100 **Prive/Dividen**, kredit 1-1110 Kas Rupiah — **bukan** pengurangan Modal Disetor. Modal Disetor mencerminkan setoran resmi pemegang saham dan hanya berubah lewat keputusan korporasi; pengambilan uang sehari-hari oleh pemilik adalah distribusi, bukan pembatalan setoran.
3. **Kas → Bank (setor ke rekening).** Pilih rekening bank perusahaan, arah **Ke Bank**, nominal, alasan, dan rincian pecahan uang yang dibawa ke bank. Satu tindakan ini menulis **dua sisi sekaligus**: kas fisik berkurang dan saldo rekening bertambah. Jurnalnya: debit 1-1120 Bank, kredit 1-1110 Kas Rupiah.
4. **Bank → Kas (tarik tunai untuk modal kerja).** Arah **Ke Kas**, rincian pecahan diisi sesuai uang yang diterima dari bank. Jurnalnya kebalikannya: debit 1-1110 Kas Rupiah, kredit 1-1120 Bank.
5. Sisi bank dari pemindahan ini **tidak dijurnal ulang** dari mutasi rekeningnya, supaya uangnya tidak terhitung dua kali. Hanya rekening **IDR** yang dijurnal; rekening valuta asing tidak dinilai per mutasi.
6. Semua tindakan di tab ini hanya untuk **Controller ke atas**, tercatat di jejak audit, dan tidak bisa dihapus. Bila salah catat, buat entri koreksi berlawanan arah dengan alasan yang jelas.
7. Hasilnya dapat diperiksa lewat panel **rekonsiliasi kas** di halaman Buku Besar: panel itu membandingkan saldo 1-1110 pada buku besar dengan kas Rupiah operasional yang benar-benar ada, dan mendaftar mutasi yang dilewati beserta alasannya. Selisih yang tersisa hampir selalu berarti ada uang yang berpindah tanpa dicatat lewat tab ini.

### 5.7 Penutupan Outlet — Staff dan Supervisor

1. Pastikan layanan selesai dan stock opname sudah ditinjau.
2. Kembali ke **Buka & Tutup Outlet**. Selesaikan opname fisik, rekonsiliasi kas, serah-terima uang, dan penguncian brankas berdasarkan kejadian nyata.
3. Simpan checklist penutupan. Bila seluruh langkah lengkap, tombol **Arsip PDF penutupan** dapat digunakan untuk arsip fisik/digital perusahaan.
4. Catatan operasional boleh berisi informasi serah-terima yang diperlukan, tetapi tidak boleh berisi nomor identitas nasabah.
5. Supervisor memeriksa varians dan tindakan terbuka sebelum hari operasional ditutup.

### 5.8 Profil Perusahaan — Controller ke atas

1. Buka **Pengaturan → Profil Perusahaan**. Isi nama PT (badan hukum), nama moneychanger (dagang), nomor izin usaha KUPVA, Kode KUPVA, NPWP, NIB, alamat, telepon, email, dan website. Nama PT dan nama moneychanger wajib diisi, sisanya opsional.
2. **Sandi pelapor BI (SINTA)** bersifat sensitif — hanya untuk referensi internal, tidak pernah ditampilkan di kwitansi maupun layar publik manapun.
3. Unggah **logo** (JPG/PNG/WEBP, maksimal 8 MB) — tampil otomatis di kwitansi cetak begitu tersimpan.
4. Unggah **sertifikat izin usaha** (scan/foto) dan **lampiran izin lainnya** (bisa lebih dari satu file) untuk arsip digital perusahaan.
   - Dokumen yang tidak berlaku lagi **dinonaktifkan, bukan dihapus**: tombol **Nonaktifkan** (Controller ke atas) membuka dialog dengan **alasan wajib** (minimal lima karakter). Dokumennya pindah ke kartu **Dokumen nonaktif** di bawah halaman, beserta tanggal, siapa yang menonaktifkan, dan alasannya — barisnya tetap tersimpan dan tercatat di log audit.
   - **Hapus permanen** hanya tersedia bagi **Pemegang Saham**, dan hanya untuk berkas salah unggah — misalnya yang memuat data pribadi pihak lain. Baris metadatanya lenyap dan tidak dapat dikembalikan; **berkasnya sendiri tetap tertinggal di penyimpanan**. Sebelum barisnya dihapus, log audit mencatat metadata lengkapnya (nama berkas, `storageKey`, ukuran, pengunggah, alasan).
   - Logo yang sedang dipakai tidak dapat dinonaktifkan maupun dihapus; ganti logonya lebih dulu.
   - Tidak ada lagi tombol tong sampah satu klik. Kedua tindakan selalu lewat dialog.
5. Nama moneychanger, alamat, dan telepon di sini otomatis dipakai di kwitansi cetak (menggantikan header baku bila sudah diisi).

### 5.9 Pencatatan Pengeluaran — Staff ke atas

1. Buka **Transaksi → Catat Pengeluaran**. Halaman ini adalah log pengeluaran operasional sederhana (sewa, gaji, utilitas, perlengkapan, pemasaran, pemeliharaan, izin/pajak, lainnya) untuk pelaporan keuangan internal — **sepenuhnya terpisah** dari sistem transaksi valuta dan kas: mencatat pengeluaran di sini tidak pernah menyentuh saldo kas, stok pecahan, atau rekening bank.
2. Isi tanggal, kategori, nominal (Rp), dan deskripsi; catatan tambahan dan bukti pengeluaran (foto/scan struk, JPG/PNG/WEBP/PDF, maksimal 8 MB) bersifat opsional dan bisa ditambahkan kapan saja setelah entri tersimpan.
3. Setiap entri bersifat **permanen** (tidak dapat diedit atau dihapus) untuk menjaga jejak audit. Bila salah catat, tambahkan entri koreksi baru dengan keterangan yang jelas menjelaskan koreksinya — jangan mengandalkan edit/hapus yang memang sengaja tidak disediakan.
4. Riwayat pengeluaran menampilkan total bulan berjalan dan daftar seluruh entri, terbaru di atas.

### 5.10 Cek Watchlist DTTOT/DPPSPM — Staff ke atas (impor: Controller ke atas)

1. Buka **Nasabah → Cek Daftar DTTOT/DPPSPM** untuk mencocokkan nama secara fuzzy (toleran typo/urutan kata) terhadap Daftar Terduga Teroris dan Organisasi Teroris (DTTOT) dan Daftar Pendanaan Proliferasi Senjata Pemusnah Massal (DPPSPM) — data resmi PPATK/DK PBB. Tombol "Cek sekarang di DTTOT/DPPSPM" pada formulir Tambah/Edit Nasabah (§5.3) menjalankan pencarian yang sama secara inline.
2. **Ini murni alat bantu penyaringan** — hasil pencarian tidak pernah menandai nasabah secara otomatis. Petugas tetap wajib memeriksa setiap kandidat kecocokan secara manual (nama, tanggal lahir, kewarganegaraan, alamat) sebelum mencentang kolom Cocok DTTOT/DPPSPM di profil nasabah dan mengisi catatannya.
3. Halaman menampilkan daftar yang **sedang dimuat** (DTTOT dan setiap sub-daftar DPPSPM seperti DPRK/Iran, jumlah entri, sumber berkas, serta kapan dan oleh siapa terakhir diimpor) — periksa tanggal impor untuk menilai seberapa terkini datanya sebelum mengandalkan hasil pencarian.
4. **Controller/Shareholder** dapat mengimpor atau memperbarui daftar dengan mengunggah workbook resmi PPATK/DK PBB (XLSX/XLS, maksimal 5 MB). Sistem mendeteksi otomatis jenis berkas (DTTOT atau DPPSPM) dan, untuk DPPSPM, sumbernya (dari pola kode referensi seperti `DPRKi.001`/`IRe.003`) dari struktur kolom — tidak perlu memilih jenis secara manual. Mengunggah ulang daftar DTTOT menggantikan **seluruh** entri DTTOT lama; mengunggah DPPSPM untuk satu sumber (mis. DPRK) hanya menggantikan entri sumber tersebut, sub-daftar DPPSPM lain (mis. Iran) tidak terpengaruh.
5. **Batasan yang perlu diketahui**: skor kecocokan adalah kesamaan nama berbasis kata (bukan pencocokan biometrik/dokumen), sehingga bisa saja melewatkan variasi ejaan ekstrem atau memunculkan nama yang mirip tapi bukan orang yang sama — selalu verifikasi detail lengkap kandidat, jangan hanya mengandalkan skor persentase. Aplikasi ini tidak menarik pembaruan daftar secara otomatis dari sumber mana pun; perbarui secara berkala mengikuti rilis resmi PPATK.
6. **Pemadanan Massal Watchlist SIPENDAR** (kartu di bagian bawah halaman yang sama): Watchlist SIPENDAR (diatur Peraturan PPATK Nomor 11 Tahun 2021) adalah daftar terpisah dari DTTOT/DPPSPM — diunduh langsung dari portal SIPENDAR (login VPN) sebagai Excel/XML, **bukan** berkas yang bisa diimpor otomatis di aplikasi ini karena format kolom ekspornya belum terverifikasi terhadap contoh nyata. PPATK mewajibkan setiap nama pada watchlist dipadankan terhadap **seluruh basis data nasabah**, dengan ambang kemiripan diserahkan pada penilaian PJK sendiri (tidak ada persentase baku dari PPATK).
   - Tempelkan nama-nama dari watchlist yang diunduh ke kotak teks (satu nama per baris; boleh tambahkan catatan setelah koma, mis. nomor identitas dari watchlist, untuk referensi saja — tidak memengaruhi skor). Maksimal 500 nama per pemeriksaan.
   - Sistem mencocokkan setiap nama terhadap seluruh nasabah aktif (bukan data latihan/arsip) memakai mesin pencocokan yang sama dengan DTTOT/DPPSPM, menampilkan hingga 10 kandidat nasabah teratas per nama watchlist beserta skornya.
   - **Menemukan kecocokan di sini bukan berarti wajib memblokir nasabah atau melapor LTKM secara otomatis** (Pasal 19 Peraturan PPATK Nomor 11 Tahun 2021) — petugas tetap menilai setiap kandidat secara manual sebelum bertindak.
   - Proses "pengayaan" (submit hasil pemadanan) tetap dilakukan langsung di portal SIPENDAR milik PPATK sesuai prosedur resmi — aplikasi ini **tidak pernah** mengirim data ke SIPENDAR maupun menyimpan daftar nama yang ditempel (dihitung sekali pakai, tidak persisten).

## 6. Pelaporan dan Pengawasan

### 6.1 Kesiapan Operasional — Controller

Buka **Kesiapan Operasional** pada awal dan akhir hari. Gunakan halaman ini untuk melihat kontrol kas, kurs, transaksi, dan **Paket Pelaporan**. Status tindakan hanya merupakan pengingat visual; Controller tetap harus membuka halaman sumber dan memeriksa penyebabnya.

### 6.2 Direksi Mengetahui

Controller membuka **Direksi Mengetahui** untuk melihat informasi yang perlu diakui Direksi. Direksi mengakui setelah membaca konteksnya. Pengakuan tidak menggantikan investigasi, persetujuan transaksi, atau koreksi kas.

### 6.3 Pemantauan Profil Nasabah — Controller

**Apa yang dideklarasikan nasabah.** Pada borang **Nasabah Baru** (dan pada Edit di **Daftar
Nasabah**) terdapat bagian *Perkiraan aktivitas menurut nasabah*: perkiraan **nilai** transaksi
sebulan dalam Rupiah, perkiraan **banyaknya** transaksi sebulan, dan **mata uang** yang diharapkan.
Ketiganya adalah **pernyataan nasabah sendiri**, bukan batas yang ditegakkan sistem, dan boleh
dikosongkan bila nasabah belum dapat memperkirakan. Tanyakan apa adanya; jangan mengisikan angka
atas nama nasabah, sebab angka karangan akan membuat seluruh penilaian di bawah ini tidak berarti.

> **Penting saat mengedit nasabah:** ketiga isian itu ikut terkirim setiap kali profil disimpan.
> Bila Anda mengosongkannya, deklarasinya benar-benar terhapus. Biarkan terisi apa adanya kecuali
> nasabah memang menyatakan angka baru.

**Kapan nasabah muncul untuk ditinjau.** Buka **Pemantauan Profil**. Iramanya mengikuti peringkat
risiko nasabah: risiko **tinggi sebulan sekali**, **menengah tiga bulan sekali**, **rendah setahun
sekali**. Nasabah yang **belum pernah ditinjau selalu** jatuh tempo — pada hari pertama pemakaian,
seluruh nasabah lama akan muncul, dan itu memang keadaan yang sebenarnya.

**Apa yang ditunjukkan halaman itu.** Untuk tiap nasabah, deklarasinya disandingkan dengan aktivitas
nyatanya pada bulan berjalan, beserta ambang yang berlaku, sehingga peninjau melihat angkanya dan
bukan hanya benderanya. Alasan penyimpangan yang mungkin muncul:

| Alasan | Artinya |
|---|---|
| Belum mendeklarasikan profil | Nasabah belum pernah ditanya perkiraan aktivitasnya. Ini pekerjaan yang belum dilakukan, bukan pelanggaran nasabah. |
| Nilai sebulan mencapai dua kali lipat deklarasi | Total Rupiah sebulan berjalan mencapai **dua kali** angka yang dinyatakan nasabah. |
| Frekuensi sebulan mencapai dua kali lipat deklarasi | Banyaknya transaksi sebulan mencapai **dua kali** perkiraan nasabah. Bendera ini dapat menyala sendirian ketika nilainya masih wajar — bentuk pemecahan transaksi yang paling perlu terlihat. |
| Memakai mata uang di luar deklarasi | Ada mata uang yang ditransaksikan tetapi tidak disebut dalam deklarasi. Kode mata uangnya disebutkan. |

**Menutup peninjauan.** Tekan **Catat peninjauan**, pilih hasilnya, dan isi keterangan. Keterangan
**wajib** diisi bila hasilnya bukan "tidak ada perubahan" — peninjauan tanpa keterangan tidak dapat
ditindaklanjuti siapa pun dan pada berkas pemeriksaan hanya terbaca sebagai peninjauan yang tidak
selesai. Alasan penyimpangan yang terlihat saat itu ikut **dibekukan** pada catatannya, sehingga
isinya tidak berubah bila aktivitas nasabah berubah kemudian.

Sesudah ditutup, nasabahnya tidak muncul lagi sampai iramanya jatuh tempo berikutnya — meski
aktivitasnya masih menyimpang. Peninjauannya memang baru saja dilakukan seseorang.

**Yang halaman ini tidak lakukan.** Ia **tidak** mengubah data nasabah, **tidak** memblokir
transaksi, dan **tidak** mengirim laporan apa pun ke PPATK maupun Bank Indonesia. Sama seperti
pencocokan DTTOT/DPPSPM, ini alat bantu penyaringan — pelaporan tetap dilakukan petugas secara manual
sesuai prosedur resmi.

**Hubungannya dengan kasir.** Transaksi yang membuat akumulasi sebulan nasabah menyimpang dari
profilnya **dialirkan ke review**, sama seperti ambang setara USD 10.000 yang sudah ada; transaksinya
tidak diblokir. Nasabah yang **belum** berdeklarasi tidak menyalakannya di kasir — kekosongan itu
urusan worklist ini, bukan urusan kasir. Perlu diketahui: ambangnya berlaku atas akumulasi
**sebulan**, sehingga begitu seorang nasabah melewatinya, transaksi berikutnya pada bulan itu ikut
masuk review sampai bulan berganti.

### 6.4 Laporan Internal dan Jejak Audit

Gunakan **Laporan** untuk melihat ringkasan yang disediakan dan **Jejak Audit** untuk menelusuri tindakan penting. Bila terjadi perbedaan, jangan mengubah data untuk mengejar tampilan laporan. Cocokkan bon, kas, stock opname, dan audit log; lalu eskalasi sesuai struktur perusahaan.

**Rekap keuangan transaksi** (kartu di bagian atas halaman **Laporan**, Controller ke atas): pilih preset **Hari ini**/**Bulan ini** atau rentang tanggal bebas, lalu lihat:
- Jumlah transaksi **Selesai**, turnover total, total beli dan total jual (Rupiah) untuk periode tsb — hanya bon yang sudah terposting ke kas/stok yang dihitung (DRAFT/PENDING_REVIEW/APPROVED/RETURNED/CANCELLED tidak masuk hitungan).
- **Estimasi margin kotor** per mata uang dan totalnya, dihitung dengan metode **rata-rata tertimbang**: kurs jual rata-rata dikurangi kurs beli rata-rata, dikalikan volume yang lebih kecil di antara total beli/jual mata uang tsb pada periode itu. Ini **bukan** perhitungan laba akuntansi penuh berbasis FIFO (sistem belum melacak lot valuta mana yang terjual dari pembelian mana) — perlakukan sebagai indikasi kasar, bukan angka final untuk laporan keuangan resmi.

### 6.5 Penutupan Periode Pembukuan — Controller ke atas

Buka **Buku Besar → Periode**. Setiap periode terbuka punya tombol **Penutupan periode**; menekannya membuka tiga panel berurutan — **Penyusutan aset tetap**, lalu **Revaluasi kurs**, lalu penilaian persediaan akhir UKA. Urutannya mengikat dan tidak dapat dilompati:

1. **Jalankan penyusutan bulan itu lebih dulu** (§6.6). Selama penyusutan belum dijurnal, tombol tutup periode menolak dengan pesan “penyusutan aset tetap belum dijurnal”. Outlet yang belum punya satu pun aset tetap tetap harus menekan tombolnya — hasilnya nol beban, dan itu keadaan sah yang tetap perlu dicatat sudah diperiksa.
2. **Jalankan revaluasi kurs** (§6.7). Saldo rekening bank valuta asing diukur ulang pada kurs tengah BI akhir periode. Outlet tanpa rekening valuta asing tetap harus menekan tombolnya — hasilnya nol selisih, dan itu keadaan sah yang tetap perlu dicatat sudah diperiksa.
3. **Stock opname akhir bulan sudah ditinjau** (§5.6 langkah 4–5). Penilaian hanya menerima opname berstatus **RECONCILED** atau **VARIANCE** — hitungan fisik yang belum ditinjau bukan bukti. Opname yang masih OPEN atau SUBMITTED akan muncul sebagai penghalang.
4. **Jalankan penilaian.** Panel menampilkan, per mata uang: kuantitas hasil hitung fisik, tanggal opname yang dipakai, kurs tengah BI, tanggal kurs yang dipakai, dan nilai Rupiahnya. Di bawahnya tertera **Persediaan awal (5-1100)** dan **Persediaan akhir (5-1300)** — itulah angka yang akan dijurnal, terlihat **sebelum** tombolnya ditekan. Kurs tengah adalah (kurs beli + kurs jual) ÷ 2, dibagi satuan kuotasi BI (JPY dikutip per 100 unit).
5. **Khusus periode yang berakhir 31 Desember:** tombol **Jurnal penutup laba tahunan** muncul setelah penilaian dijalankan. Ia memindahkan seluruh saldo laba rugi tahun itu ke 3-2100 Laba Ditahan. Wajib dijalankan sebelum periodenya dapat ditutup, dan ia sendiri menolak berjalan bila ada bulan sepanjang tahun itu yang penyusutan **atau** revaluasi kursnya belum dijurnal — pesannya menyebut bulan-bulannya satu per satu.
6. **Tutup periode.** Tombolnya tetap tidak aktif selama penyusutan, revaluasi kurs, atau penilaian belum dijalankan, dan pada Desember selama penutup labanya belum dijalankan. Keterangan pada tombolnya menyebut langkah mana yang masih kurang.

**Tanggal opname atau tanggal kurs yang berbeda dari akhir periode diberi tanda "Mundur dari akhir periode".** Itu keadaan sah, bukan kekeliruan: outlet tidak menghitung uang pada hari tutup, dan BI tidak mengumumkan kurs pada Sabtu, Minggu, dan hari libur. Yang dipakai adalah opname terakhir di dalam periode dan snapshot kurs terakhir yang tidak melewati akhir periode. Tanggal yang benar-benar dipakai disimpan pada baris penilaian dan jejak audit, sehingga pemeriksa dapat menunjuknya — pemunduran tanggal tidak pernah terjadi diam-diam.

**Bila muncul penghalang,** tombol penilaian tidak aktif dan daftar penghalang menyebut mata uang beserta alasannya. Penutupan **tidak pernah berjalan sebagian** — satu penghalang membatalkan seluruhnya, karena buku besar yang setengah tertutup jauh lebih sulit ditelusuri daripada yang belum ditutup. Yang harus dilakukan:

| Penghalang | Tindakan |
|---|---|
| Belum ada stock opname yang sudah ditinjau di dalam periode | Lakukan opname untuk mata uang itu (§5.6), lalu minta Supervisor meninjaunya |
| Opname masih berstatus OPEN atau SUBMITTED | Minta peninjauan opname tersebut |
| Opname tidak memuat hitungan fisik | Ulangi opname beserta rincian pecahannya |
| Tidak ada kurs BI sampai akhir periode, atau kurs terakhir jatuh sebelum periode dimulai | Jalankan sinkronisasi kurs BI lebih dulu; jangan menyisipkan snapshot bertanggal manual |

Mata uang yang stoknya memang nol — laci kosong dan brankas kosong — dilewati tanpa penghalang dan tanpa baris penilaian. IDR tidak pernah ikut dinilai: kas Rupiah sudah tercatat pada 1-1110, dan menilainya lagi pada 1-1210 akan menghitungnya dua kali sementara neracanya tetap seimbang.

Penilaian yang sudah dijalankan **tidak dapat diulang**. Bila angkanya perlu diperbaiki, catat jurnal baliknya lebih dulu seperti koreksi jurnal lainnya.

### 6.6 Aset Tetap dan Penyusutan — Controller ke atas

Buka **Aset Tetap**. Halaman ini memuat daftar aset outlet beserta harga perolehan, akumulasi penyusutan, dan nilai bukunya; tombol **Daftarkan aset**; tombol **Lepaskan** pada tiap aset yang masih aktif; dan kartu **Batas kapitalisasi**.

**Mana yang masuk register, mana yang masuk Catat Pengeluaran.** Barang yang dipakai lebih dari satu tahun dan harganya **Rp 1.000.000 atau lebih** didaftarkan di sini, lalu dibebankan sedikit demi sedikit tiap bulan. Yang di bawah itu — kalkulator, gunting, tinta printer — dicatat lewat **Catat Pengeluaran** dan habis pada bulan itu juga. Bila harganya di bawah batas, form pendaftaran menolak dan menyebut angkanya.

Batasnya dapat diubah pada kartu **Batas kapitalisasi** di halaman yang sama, oleh Controller ke atas. Ubah hanya bila kebijakan perusahaannya memang berubah, dan sebutkan alasannya kepada Direksi — perubahan tercatat di **Jejak Audit**. Batas yang baru berlaku untuk pendaftaran berikutnya; aset yang sudah terdaftar tidak ikut berubah.

**Kelompok pajak hanya mengisi umur manfaat.** Memilih *Kelompok 1 — 4 tahun* mengisi kolom umur manfaat menjadi 48 bulan, dan setelah itu **angkanya boleh diubah**. Kelompok pajak adalah aturan Direktorat Jenderal Pajak; yang dipakai buku besar adalah umur manfaat **sebenarnya** menurut penilaian perusahaan, yang menurut SAK EP Bab 17 harus ditinjau setiap tahun. Bila brankas yang menurut pajak berumur empat tahun ternyata dipakai delapan tahun, isi 96 dan catat alasannya pada kolom Catatan. Tanah dipilih dengan kategori **Tanah** dan tidak pernah disusutkan.

**Aset yang dibeli tengah bulan disusutkan penuh pada bulan itu.** Brankas Rp 24.000.000 berumur 48 bulan yang dibeli 17 Maret tetap dibebani 500.000 untuk bulan Maret, bukan setengahnya. Tidak ada perhitungan harian.

**Aset yang sudah dimiliki sebelum aplikasi ini dipakai** didaftarkan dengan menyalakan penanda **Aset warisan** pada form. Isi tanggal perolehan yang sebenarnya (boleh bertahun-tahun lalu), harga perolehan aslinya, lalu dua kolom tambahan: **Bulan jurnal pertama** — bulan pertama yang akan dijurnal oleh aplikasi ini, biasanya bulan berjalan — dan **Akumulasi penyusutan sampai saat itu**, diambil dari pembukuan lama. Aplikasi menghitung sisa bulannya sendiri dari tanggal perolehan, sehingga asetnya berakhir tepat pada nilai residu, tidak lebih cepat dan tidak lebih lambat. Aset warisan **tidak** dijurnal perolehannya — saldo 1-1510 dan 1-1520-nya sudah masuk lewat saldo awal, dan menjurnalnya lagi akan menghitungnya dua kali. Barisnya diberi tanda **Warisan** pada daftar.

**Menjurnal penyusutan bulanan** dilakukan dari **Buku Besar → Periode**, panel **Penyusutan aset tetap**. Panel menampilkan beban tiap aset, akumulasi, dan nilai buku setelahnya — semuanya terlihat **sebelum** tombolnya ditekan, dan angka itulah yang persis dijurnal. Satu jurnal untuk seluruh aset: Penyusutan Aset Tetap (6-1700) di debit, Akumulasi Penyusutan (1-1520) di kredit. Rincian per asetnya tersimpan dan dapat ditunjuk kepada pemeriksa.

Penyusutan sebuah bulan **tidak dapat dijalankan dua kali**. Bila angkanya perlu diperbaiki, catat jurnal baliknya lebih dulu seperti koreksi jurnal lainnya. Menekan tombolnya berkali-kali tidak pernah menghasilkan jurnal ganda.

**Melepas aset** — dijual, dihibahkan, atau dibuang — dilakukan dengan tombol **Lepaskan**. Isi tanggal pelepasan dan hasil pelepasannya (isi nol untuk penghapusan tanpa hasil). Selisih antara hasil dan nilai bukunya masuk ke Laba/(Rugi) Penjualan Aset Tetap (7-1400). Syaratnya: **penyusutan seluruh bulan sampai dengan bulan pelepasan harus sudah dijurnal lebih dulu**. Bila belum, pelepasan ditolak dan pesannya menyebut bulan-bulan yang tertinggal — jalankan penyusutan bulan-bulan itu, lalu ulangi. Aset yang dilepas tetap ada di daftar dengan tanda **Dilepas** beserta tanggalnya; ia tidak pernah dihapus.

**Perolehan dan hasil pelepasan tidak menyentuh kas.** Membeli brankas mendebit Aset Tetap — Harga Perolehan (1-1510) dan mengkredit **Kewajiban Lain-Lain (2-1900)**; melepasnya mendebit **Piutang Lain-Lain (1-1320)**. Uangnya sendiri dicatat terpisah saat benar-benar bergerak — lewat **Catat Pengeluaran** untuk pembayarannya, atau lewat penerimaan bank untuk hasil penjualannya. Alasannya: kas pada buku besar harus selalu sama dengan kas yang dihitung di laci dan brankas, dan modul di luar sistem kas yang menyentuh 1-1110 akan membuat keduanya berbeda tanpa ketahuan. Jangan mencatat pembelian aset sebagai pengeluaran biasa **dan** mendaftarkannya di sini — itu menghitungnya dua kali.


### 6.7 Rekening Valuta Asing dan Revaluasi Kurs — Controller ke atas

**Rekening bank dalam mata uang asing kini masuk pembukuan.** Sebelumnya rekening USD boleh dibuat dan mutasinya boleh dicatat, tetapi tidak pernah masuk buku besar — uang yang benar-benar ada tidak muncul di laporan mana pun. Sekarang setiap mutasinya dinilai ke Rupiah dan dicatat pada **Bank UKA (1-1220)**.

**Nilai Rupiahnya dipakai kurs tengah BI pada tanggal mutasi itu**, bukan kurs hari ini. Kalau di tanggal itu BI tidak mengumumkan kurs — Sabtu, Minggu, hari libur — dipakai kurs hari kerja terakhir sebelumnya.

**Kalau belum ada kurs BI sama sekali sampai tanggal mutasi, mutasinya tidak dijurnal.** Ia muncul pada ringkasan penjurnalan sebagai dilewati, dengan alasannya. Jalan keluarnya adalah menjalankan sinkronisasi kurs BI lebih dulu, lalu mengulang penjurnalannya. **Jangan mengarang kurs** supaya angkanya masuk — kurs karangan di buku besar tidak pernah ditinjau lagi.

**Apa itu revaluasi akhir bulan.** Uang USD 1.000 di rekening tetap USD 1.000 sepanjang bulan, tetapi nilainya dalam Rupiah berubah mengikuti kurs. Kalau dicatat Rp 16.300.000 pada 15 September dan kurs akhir September menjadi 16.500, nilainya sekarang Rp 16.500.000. Selisih Rp 200.000 itu harus tercatat — itulah yang dilakukan tombol **Jurnalkan revaluasi bulan ini** pada panel Revaluasi Kurs di **Buku Besar → Periode**.

Selisihnya masuk **Laba/(Rugi) Selisih Kurs (7-1500)**. Kalau kurs naik, laba; kalau turun, rugi.

**Selisih ini bukan uang yang masuk atau keluar.** Tidak ada Rupiah yang berpindah; yang berubah hanya nilai catatan atas uang yang sudah ada. Jangan mencarinya di kas atau di rekening.

**Uang tunai UKA di laci dan brankas tidak ikut direvaluasi di sini.** Ia dinilai lewat stock opname pada langkah penilaian persediaan (§6.5). Merevaluasinya di dua tempat akan menghitung pergerakan kurs yang sama dua kali, dan neracanya akan tetap terlihat seimbang meski angkanya salah — kekeliruan yang tidak akan terlihat dari laporan mana pun.

**Panel menunjukkan angkanya sebelum tombolnya ditekan:** per mata uang — saldo valutanya, kurs tengah BI, tanggal kurs yang dipakai, nilai yang tercatat sekarang, nilai sesudahnya, dan selisihnya. Tanggal kurs yang lebih awal daripada akhir periode diberi tanda **"Mundur dari akhir periode"**; itu keadaan sah, dan tanggal yang benar-benar dipakai tersimpan supaya pemeriksa dapat menunjuknya.

**Kalau ada penghalang,** tombolnya tidak aktif dan penghalangnya disebut beserta mata uangnya — biasanya karena belum ada kurs BI sampai akhir periode itu. Revaluasi **tidak pernah berjalan sebagian**.

**Revaluasi sebuah bulan tidak dapat diulang.** Bila angkanya perlu diperbaiki, catat jurnal baliknya lebih dulu seperti koreksi jurnal lainnya. Menekan tombolnya berkali-kali tidak pernah menghasilkan jurnal ganda.


### 6.8 Membayar Tagihan dan Menagih Piutang — Controller ke atas

**Beban dan pembelian aset tetap sengaja tidak langsung mengurangi kas.** Waktu Anda mencatat pengeluaran atau mendaftarkan aset tetap, yang tercatat adalah **kewajiban** (2-1900) — bukan uang keluar. Itu disengaja: modul-modul itu tidak menyentuh laci, sehingga kas di buku besar tidak pernah berbeda dari kas yang benar-benar dihitung petugas.

**Uangnya baru keluar ketika Anda mencatat pelunasannya**, di **Kas & Persediaan → Modal & Bank → Pelunasan kewajiban & penagihan piutang**.

Cara memakainya:

1. Pilih tagihan dari daftar. Tiap baris menyebut asalnya (beban atau aset tetap), tanggalnya, nilai asalnya, yang sudah dibayar, dan sisanya.
2. Isi jumlahnya — terisi otomatis sebesar sisa penuh. **Pembayaran sebagian boleh**; membayar lebih dari sisanya ditolak.
3. Pilih dibayar lewat **kas fisik** atau **rekening perusahaan**.
4. Kalau lewat kas, **isi rincian pecahannya** seperti setiap pergerakan uang fisik lain. Total pecahannya harus sama persis dengan jumlah di atas.
5. Isi tanggal pelunasan dan catatannya, lalu **Catat pelunasan**.

**Pelunasan belum masuk laporan sampai dijurnalkan.** Sama seperti setoran modal dan pemindahan kas ke bank: jalankan penjurnalan pada **Buku Besar → Jurnal** atas rentang tanggal yang memuat tanggal pelunasannya.

**Kalau daftarnya kosong,** memang tidak ada yang terutang — bukan berarti panelnya rusak.

**Penagihan piutang** hanya muncul untuk hasil pelepasan aset tetap yang belum diterima uangnya. Beban tidak pernah menjadi piutang.

**Kenapa ini penting.** Selama pelunasannya tidak pernah dicatat, Laporan Arus Kas tidak akan memperlihatkan satu pun pembayaran beban maupun pembelian aset — dan halaman Laporan Keuangan akan menyalakan peringatan *"Beban dan perolehan aset tercatat tetapi belum ada yang dibayar."*

### 6.9 Laporan Arus Kas dan CALK — Controller ke atas

Kelima laporan keuangan sekarang berada di halamannya sendiri: **Laporan → Laporan Keuangan**. Buku Besar tetap memuat pekerjaan pembukuannya (jurnal, neraca saldo, buku besar akun, penutupan periode); halaman ini memuat hasilnya.

**Rentangnya bebas**, sama seperti sebelumnya, dan kolom pembandingnya rentang sepanjang itu yang berakhir sehari sebelum rentang ini mulai.

#### Membaca Laporan Arus Kas

**Kas dan setara kas** di sini berarti tiga akun: Kas Rupiah (1-1110), Bank Rupiah (1-1120), dan Bank UKA (1-1220). **Uang kertas asing di laci tidak termasuk** — ia persediaan barang dagangan, bukan kas, dan dinilai lewat stock opname (§6.5).

Bagiannya:

- **Operasi** — penerimaan penjualan UKA, pembayaran pembelian UKA, pembayaran beban, dan selisih hitungan kas.
- **Investasi** — pembayaran perolehan aset tetap dan hasil pelepasannya, disajikan **bruto**: keduanya muncul sebagai baris sendiri, tidak saling dikurangkan.
- **Pendanaan** — setoran modal dan penarikan pemilik.
- **Pengaruh perubahan kurs** — selisih revaluasi (§6.7). Ini bukan uang yang bergerak, karena itu ia berdiri sendiri di luar ketiga bagian.

**Setor kas ke rekening tidak muncul di mana pun**, dan itu benar: uang yang sama berpindah tempat, jumlah kas dan setara kasnya tidak berubah.

**Tiap baris menyebut nomor jurnalnya.** Itulah yang membuat pos laporan dapat ditunjukkan asalnya kepada pemeriksa.

**Keranjang "Belum terklasifikasi"** memuat jurnal kas yang bagiannya tidak dapat dipastikan tanpa menebak — jurnal manual, jurnal saldo awal, atau pelunasan yang kehilangan catatan sasarannya. Nomor jurnalnya disebut beserta alasannya. **Keranjang yang terisi bukan kerusakan; ia daftar pekerjaan.**

**Lencana rekonsiliasi** membandingkan arus kas hasil hitungan dengan pergerakan nyata ketiga akun kas. Kalau berbeda, selisihnya ditampilkan sebagai angka. **Selisihnya tidak pernah ditutup dengan pos penyeimbang** — laporan yang terlihat rapi padahal dasarnya belum lengkap justru lebih berbahaya di hadapan pemeriksa.

#### Mengisi CALK

CALK berisi lima belas catatan dan bekerja dua cara:

- **Delapan catatan dibangkitkan dari buku besar** — kas dan setara kas, persediaan UKA, aset tetap per aset, rincian kewajiban lain-lain, ekuitas, rincian pendapatan dan beban, selisih kurs, dan transaksi nonkas. Angkanya **tidak dapat diketik**, sehingga tidak pernah dapat berselisih dengan laporannya.
- **Tujuh catatan ditulis sendiri** — informasi umum, dasar penyusunan, kebijakan akuntansi, pertimbangan dan estimasi, pihak berelasi, peristiwa setelah periode pelaporan, serta perikatan dan kontinjensi.

Tiap catatan naratif membawa **panduan** tentang apa yang harus ada di dalamnya. **Tidak ada teks contoh yang diisikan otomatis**, dan itu disengaja: yang tertulis di CALK adalah pernyataan manajemen, dan mengarangnya berarti menandatanganinya atas nama Anda.

Saat menyimpan, ada pilihan **"Khusus periode ini"**. Kosongkan untuk teks yang berlaku terus — kebijakan akuntansi jarang berubah. Centang untuk teks yang memang khas periode itu, misalnya peristiwa setelah periode pelaporan. Laporan periode lama akan tetap menampilkan teks yang berlaku baginya.

**Catatan yang belum diisi muncul sebagai peringatan**, bukan sebagai penghalang. Laporan tetap dapat disusun; tetapi CALK yang kosong berarti laporannya belum lengkap menurut SAK EP.

### 6.10 Ekspor form B0002/B0003/B0004 — Controller ke atas

Selama ini angka laporan keuangan **diketik ulang** ke berkas Excel BI. Pengetikan ulang itulah risiko yang dituju temuan pemeriksaan 7.1: begitu angka berpindah lewat tangan, buku besar berhenti menjadi dasar laporan. Sekarang berkasnya dihasilkan aplikasi.

**Cara mengekspor.** Pada halaman **Laporan → Laporan Keuangan**, atur rentangnya ke **1 Januari sampai 31 Desember tahun yang sama**, lalu tekan **"Ekspor form B0002–B0004 tahun ⟨tahun⟩"** di samping rentangnya.

**Hanya tahun buku penuh yang dapat diekspor.** Rentang lain membuat tombolnya mati beserta alasannya. Alasannya tertulis pada formnya sendiri: *Periode: Tahun* dan *Jenis Periode: A*. Laporan bulanan tetap dapat dibaca di layar seperti biasa; yang dibatasi hanya berkas ekspornya.

**Sandi Pelapor wajib terisi lebih dulu** pada **Pengaturan → Profil Perusahaan**. Tanpa itu ekspor berhenti dengan alasannya, dan itu disengaja: berkas laporan tanpa sandi pelapor tidak dapat dipakai BI, dan mengetahuinya saat mengunduh jauh lebih murah daripada mengetahuinya di hadapan pemeriksa.

**Isi berkasnya** empat lembar:

- **B0002 Neraca**, **B0003 Laba Rugi**, dan **B0004 Ekuitas** — bertata letak sama dengan form resminya, berheader *Sandi Pelapor*, *Periode*, *Nomor Form*, *Jumlah Record*, dan *Jenis Periode*.
- **Penelusuran** — satu baris untuk tiap pos berisi, menyebut akun penyusunnya, saldo buku besarnya, dan nilai yang masuk ke form. Inilah jawaban temuan 7.1 di dalam satu berkas: pemeriksa dapat menunjuk sebuah pos dan langsung melihat akunnya, tanpa membuka aplikasi ini.

**Yang aplikasi tidak lakukan.** Berkas hasil ekspor **tidak dikirim ke Bank Indonesia** oleh aplikasi, dan ia **tidak memiliki tombol *Simpan*** milik form BI — tombol itu makro milik berkas mereka. Alurnya tetap: unduh, periksa, salin angkanya ke berkas resmi BI, lalu tekan tombol resminya sendiri.

**Beberapa baris memang selalu nol.** *Lain-lain (net)* pada B0004 — *Menambah Ekuitas* dan *Mengurangi Ekuitas* — belum punya modul yang menjurnalnya. Barisnya tetap ada karena form memintanya, dan alasannya tercetak pada lembar Penelusuran, bukan disembunyikan.

**Setiap ekspor menuliskan snapshot** bersumber **"Buku besar"** untuk tahun itu, sehingga paket regulator (§7) dapat dibuat tanpa mengimpor kembali berkas yang baru saja dihasilkan sendiri. Mengekspor dua kali dengan angka yang sama **tidak** menambah snapshot kedua; kalau angkanya berubah, snapshot barunya tersimpan sehingga riwayatnya utuh.

**Berkasnya dapat diimpor kembali.** Impor snapshot (§7) sekarang mengenali dua tata letak: form resmi seperti ini, dan berkas ber-kolom *Record No* yang selama ini dipakai. Pos dikenali lewat **judul kelompok dan label**-nya. Kalau seseorang mengubah label sebuah pos, pos itu dilaporkan sebagai **tidak dikenal beserta labelnya** — bukan diabaikan diam-diam.


### 6.4 Klasifikasi Risiko dan Ambang Pita — Controller

Buka **Risiko › Klasifikasi Risiko**. Halaman ini **tidak menilai apa pun** — ia menyimpan
keputusan manusia beserta rujukannya, yang kemudian dipakai penilaian risiko individual (IRA).

**Klasifikasi risiko inheren.** Enam dimensi dalam bentuk tab: mata uang, kategori pekerjaan,
bentuk badan hukum, negara, provinsi, dan **jalur distribusi**. Klik satu baris untuk menetapkan tingkatnya pada
**TPPU**, **TPPT**, dan **PPSPM** sekaligus. Ketiganya boleh berbeda — USD dapat berisiko Tinggi
untuk TPPU dan Menengah untuk TPPT, dan itu memang yang dinilai SRA. **Alasan atau rujukan SRA
wajib diisi**; klasifikasi tanpa rujukan adalah angka tanpa asal, dan pemeriksa menanyakan
dasarnya. Nilai lama dan nilai baru tercatat pada jejak audit.

Dimensi **Negara** tidak punya daftar tertutup: ketikkan kode ISO dua huruf (mis. `IR`) pada kotak
di atas tabel lalu tekan **Klasifikasikan**. Negara ditambahkan mengikuti daftar FATF dan sanksi
PBB yang berlaku, bukan didaftarkan seluruhnya di muka.

**Kode yang belum diklasifikasikan ditampilkan lebih dulu** beserta hitungannya. Perhatikan
hitungan itu: kode tanpa klasifikasi **dibaca penilaian sebagai Rendah**, dan bacaan itu hanya sah
bila seseorang benar-benar memutuskannya — bukan karena barisnya belum sempat diisi.

**Ambang pita parameter.** 33 parameter Form A1, masing-masing lima pita. **Skalanya terbalik**:
pita terendah bernilai **5 = Rendah**, pita teratas bernilai **1 = Tinggi**. Pita teratas selalu
tanpa batas atas.

Bentuk pitanya **tidak sama untuk semua parameter**, dan yang ditampilkan adalah bentuk yang
benar-benar dipakai menghitung: pita lebar `0-20% / 21-40% / …` untuk parameter omzet dan jalur
distribusi, pita sempit `Tidak ada / >0-1% / …` untuk parameter pengguna jasa berisiko tinggi, pita
menengah `0-2% / >2-4% / …` untuk yang berisiko menengah. Dua belas parameter **tidak berpita
persentase sama sekali** — kehadiran (*Ada / Tidak ada*), tingkat risiko wilayah (*Rendah /
Menengah / Tinggi*), dan gradasi kepemilikan (*Tidak ada / 1-99% / 100%*); barisnya menampilkan
kriteria templatnya, bukan kotak angka, karena tidak ada ambang yang dibaca penghitung mana pun. Ubah angkanya lalu klik di luar kotak untuk menyimpan; tombol
**Template** mengembalikan satu parameter ke nilai bawaan template BI. Kolom *Terakhir* menunjukkan
"bawaan template" bila parameter itu belum pernah disunting, atau waktu penyuntingan terakhir bila
sudah. Ambang boleh disunting karena BI mengubah pitanya tanpa memberi tahu siapa pun; setiap
perubahan tercatat pada jejak audit, sebab ambang yang bergeser mengubah nilai setiap parameter
sesudahnya.


### 6.5 Penilaian Risiko Lembaga (IRA) — Admin mengisi, Pemegang Saham menyetujui

Buka **Risiko › Penilaian Risiko (IRA)**. Satu penilaian untuk satu periode, umumnya satu tahun
buku. Akhir periode bersifat **eksklusif**: untuk menilai tahun 2026 penuh, isi 1 Januari 2026
sampai 1 Januari 2027.

**Skalanya terbalik, dan ini yang paling sering salah dibaca: 5 berarti risiko RENDAH, 1 berarti
risiko TINGGI.** Berlaku pada seluruh parameter maupun pada kuesioner KPMR
(`1 unsatisfactory … 5 strong`). Angka besar adalah kabar baik.

**Siapa mengerjakan apa.** Admin ke atas membuat dan mengisi penilaian; **hanya Pemegang Saham yang
dapat menyetujui** — Controller sekalipun tidak. Penilaian yang sudah disetujui **terkunci
seluruhnya**: bila ada yang perlu diperbaiki, tekan **Buat penilaian pengganti** beserta alasannya.
Penilaian lama tetap tersimpan dan ditandai *digantikan*, tidak pernah dihapus.

**Halaman penilaian bertiga bagian.**

1. **Form C1 — angka yang terhitung.** Komposisi lembaga selama periode itu, dibaca langsung dari
   basis data: jumlah bon, omzet per mata uang beserta porsinya, dan komposisi nasabah. Tiga kotak
   di atasnya menampilkan berapa nasabah yang **belum** berjenis, belum berkategori pekerjaan, dan
   belum berkewarganegaraan. Perhatikan ketiganya: persentase pada Form A1 dihitung atas nasabah
   yang **sudah** berkategori, sehingga angka yang tampak kecil bisa jadi kecil hanya karena
   penyebutnya belum lengkap.
2. **Form A1 — nilai parameter risiko inheren.** 24 parameter dihitung sendiri oleh aplikasi dari
   Form C1 dan klasifikasi SRA; angka mesinnya ditampilkan beserta **asalnya** (mis. *"216.800.000
   dari 219.800.000 = 98,64%"*). Penilai boleh menyimpang dari angka mesin, tetapi **alasannya
   wajib diisi** — ketidaksetujuan yang tidak tertulis tidak dapat dibedakan dari salah ketik.
   Parameter yang belum bernilai dihitung dan ditampilkan; penilaian tidak dapat disetujui sebelum
   ke-33 parameter terisi.
3. **Pernyataan struktural.** Sembilan parameter yang tidak dapat dihitung dari basis data —
   kepemilikan, PEP, nominee, pemilik warga negara asing, struktur grup, mitra kerja sama, dan lini
   bisnis lain. Pilih pernyataannya dan **isi dasarnya**; nilai parameternya mengikuti pilihan itu.

**Kuesioner KPMR dan hasil.** Tombol **Kuesioner KPMR & hasil** membuka 31 pertanyaan pada lima
pilar. Jawabannya 1–5, atau **N/A** untuk pertanyaan yang tidak berlaku bagi KUPVA BB — satu
pertanyaan tentang kegiatan transfer dana memang begitu, dan menjawab N/A **tidak** menurunkan
nilai pilarnya. Di samping tiap pilar tertulis rata-ratanya **beserta berapa jawaban yang ikut
dihitung**; perhatikan angka itu, karena N/A mengubah pembagi tanpa mengubah tampilan rata-ratanya.
Pertanyaan yang pernah menjadi temuan pemeriksaan diberi penanda temuannya.

Bagian hasil menggambar **matriks Bank Indonesia** — baris predikat risiko inheren, kolom predikat
KPMR — dengan sel yang terpilih ditandai. Selama masih ada parameter atau pertanyaan yang belum
terisi, yang ditampilkan adalah apa yang masih kurang, bukan angka sementara.

**Alur persetujuan.** Isi Form A1 → isi pernyataan struktural → jawab kuesioner KPMR → **Ajukan** →
Pemegang Saham menekan **Setujui**. Saat disetujui, aplikasi membekukan nilai tiap parameter,
**ambang yang berlaku saat itu**, dan **klasifikasi yang dipakai saat itu**. Klasifikasi yang diubah
sesudahnya tidak mengubah penilaian yang sudah ditandatangani.

**Siklus tahunan.** Halaman **Status Kesiapan** menampilkan kartu *Penilaian risiko (IRA)*: sebuah
tahun terhitung terlambat begitu tahun itu berakhir tanpa penilaian yang disetujui. Aplikasi
**tidak pernah membuat penilaian sendiri** saat tahun berganti — yang dilakukannya hanya
memberitahu.


## 7. Pelaporan Regulator Internal

Halaman **Pelaporan Regulator** adalah pusat persiapan internal. Halaman ini tidak terhubung untuk submit otomatis ke Bank Indonesia atau regulator lain.

| Tahap | Pembuat | Pemeriksa | Aturan penting |
|---|---|---|---|
| LKU dari transaksi hidup | Controller | Shareholder | Hanya transaksi produksi `COMPLETED` yang diperhitungkan. Data demo, historis, simulasi, draf, atau transaksi batal tidak masuk. |
| Snapshot B0002/B0003/B0004 | Controller | Shareholder | Gunakan ekspor dari buku besar (§6.10), input manual, atau template; periksa pos sebelum simpan snapshot. |
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
5. **Batasan yang perlu diketahui**: kolom **No.NPWP** pada file yang dihasilkan **selalu kosong** karena sistem ini belum membedakan nasabah perorangan vs. korporasi (NPWP nasabah kini tersimpan di profil, tapi kolom SIPESAT ini secara spesifik untuk NPWP Korporasi per Pasal 7 — belum dipetakan otomatis). Isi manual di file sebelum unggah bila ada nasabah korporasi yang perlu dilaporkan.

### 7.4 Ekspor LTKT goAML (XML) — Controller ke atas

Kartu **Ekspor LTKT goAML (XML)** di halaman Pelaporan Regulator membangun file XML LTKT (Laporan Transaksi Keuangan Tunai) siap unggah manual ke goAML — **tidak pernah** mengirim data secara otomatis dari aplikasi ini.

1. Isi **ID Entitas Pelapor goAML (rentity_id)** dan **Kode User Pelapor goAML** di **Profil Perusahaan** terlebih dahulu (angka/kode dari registrasi goAML, berbeda dari IDPJK SIPESAT maupun sandi pelapor BI). Tombol ekspor tidak aktif sampai keduanya terisi.
2. Pilih rentang tanggal dan **arah kas**: **Kas Masuk** (LTKTM — bon Jual, nasabah membayar Rupiah ke outlet) atau **Kas Keluar** (LTKTK — bon Beli, outlet membayar Rupiah ke nasabah).
3. Klik **Unduh XML**. Hanya bon **tunai** berstatus **Selesai** yang memenuhi ambang LTKT (≥ Rp500 juta) yang diikutsertakan. Bon multi-mata uang dipecah menjadi beberapa baris transaksi XML (satu per baris mata uang), ditandai akhiran `-L1`, `-L2`, dst pada nomor transaksinya.
4. Bila ada bon yang profil nasabahnya belum lengkap (jenis kelamin/kewarganegaraan/alamat terstruktur belum diisi), bon tsb **dilewati** dan namanya ditampilkan di pesan galat — lengkapi profil nasabah tsb lewat Edit, lalu ulangi ekspor.
5. **Batasan yang perlu diketahui**: bon dengan `Cara bayar` **Transfer Bank** belum didukung ekspor ini — goAML mewajibkan kode institusi/SWIFT rekening lawan yang belum dicatat sistem untuk bank counterparty. Hanya transaksi tunai yang bisa diekspor untuk saat ini.
6. Unggah file yang dihasilkan secara manual melalui aplikasi goAML sesuai prosedur yang berlaku di perusahaan.

### 7.5 Ekspor LTKM goAML (XML) — Controller ke atas

Kartu **Ekspor LTKM goAML (XML)** di halaman Pelaporan Regulator membangun file XML LTKM (Laporan Transaksi Keuangan Mencurigakan) siap unggah manual ke goAML — **tidak pernah** mengirim data secara otomatis dari aplikasi ini.

1. Membutuhkan konfigurasi **rentity_id** dan **Kode User Pelapor goAML** yang sama dengan LTKT (lihat §7.4).
2. Cakupan: bon **tunai** berstatus **Selesai** yang ditandai **mencurigakan** lewat checklist TKM saat pembuatan bon — kedua arah kas (Beli maupun Jual) diikutsertakan, tidak seperti LTKT yang dipisah per arah.
3. **Wajib pilih sendiri kode indikator goAML** (`report_indicator_type`, mis. `POLA-001`, `TEROR-003`, `TUNDA-002`) dari daftar pencarian di kartu ekspor. Daftar ini adalah **codebook resmi goAML yang terpisah** dari checklist TKM internal aplikasi — sistem **tidak** memetakan otomatis dari checklist TKM ke kode ini karena tidak ada korespondensi yang dapat diandalkan. Petugas kepatuhan yang menilai indikator mana yang berlaku untuk setiap laporan.
4. Kolom **Alasan / narasi** (opsional) dikirim sebagai elemen `<reason>` pada XML — isi ringkasan mengapa transaksi dianggap mencurigakan bila diperlukan untuk audit trail internal.
5. Bon multi-mata uang dipecah menjadi beberapa baris transaksi XML (satu per baris mata uang), ditandai akhiran `-L1`, `-L2`, dst — sama seperti LTKT.
6. Bila ada bon yang profil nasabahnya belum lengkap, bon tsb **dilewati** dan namanya ditampilkan di pesan galat — lengkapi profil nasabah tsb lewat Edit, lalu ulangi ekspor.
7. **Batasan yang perlu diketahui**: sama seperti LTKT, bon dengan `Cara bayar` **Transfer Bank** belum didukung; report_code yang dihasilkan selalu `LTKM` — varian `LTKMP` (percobaan) dan `LTKMT` (terorisme) belum didukung dan harus dilaporkan lewat kanal lain bila berlaku.
8. Unggah file yang dihasilkan secara manual melalui aplikasi goAML sesuai prosedur yang berlaku di perusahaan.

## 7A. Arsip Dokumen Perusahaan

Menutup temuan pemeriksaan BI 3. Menu **Kepatuhan → Arsip Dokumen**, Controller ke atas.

### Apa yang disimpan di sini

Enam jenis dokumen, dan daftarnya tertutup: **SOP**, **kebijakan internal**, **surat-menyurat Bank
Indonesia**, **notulen rapat**, **korespondensi regulator**, dan **lainnya**. Judul wajib diisi pada
setiap dokumen, termasuk yang berjenis "lainnya", supaya tetap terbaca oleh siapa pun yang mencarinya.

Logo, sertifikat izin, dan lampirannya **tetap di halaman Profil Perusahaan**, tidak dipindahkan ke
sini.

### Mengarsipkan dokumen baru

1. Tekan **Arsipkan dokumen**.
2. Pilih jenisnya, isi judul, dan nomor surat/SK bila ada.
3. Tunjuk **penanggung jawab** dari daftar pegawai — orang yang bertanggung jawab memelihara dokumen
   itu. Boleh dikosongkan bila belum ditunjuk.
4. Isi **mulai berlaku**. **Berakhir** boleh dikosongkan; kosong berarti berlaku sampai diganti,
   bukan berarti kedaluwarsa.
5. Pilih berkasnya: PDF, JPG, PNG, atau WEBP, paling besar 8 MB. **Hanya berkas internal tepercaya
   yang sudah dipindai antivirus.**

### Mengganti versi

Tekan **Ganti versi** pada dokumennya. Versi baru wajib disertai **alasan perubahan** — riwayat versi
tanpa alasan menjawab "apa yang berubah" tetapi tidak pernah menjawab "mengapa", dan pertanyaan kedua
itulah yang diajukan pemeriksa.

**Versi lama tidak dihapus.** Ia tetap tercatat pada **Riwayat versi** dan tetap dapat dibuka, supaya
pertanyaan "dokumen mana yang berlaku pada periode yang diperiksa" dapat dijawab.

Satu hal yang perlu diketahui: versi baru **langsung menggantikan** pendahulunya begitu disimpan,
walaupun tanggal mulai berlakunya masih di kemudian hari. Bila itu terjadi, dokumennya muncul pada
daftar **Perlu ditindaklanjuti** dengan keterangan "tidak ada versi yang berlaku hari ini" sampai
tanggal itu tiba. Itu memang keadaan yang sebenarnya, dan sengaja diperlihatkan.

### Daftar "Perlu ditindaklanjuti"

Memuat tiga hal: dokumen yang masa berlakunya **sudah terlampaui**, yang **berakhir dalam 30 hari
atau kurang**, dan yang **tidak punya versi berlaku hari ini**.

Daftar ini **hanya mencatat**. Ia tidak memblokir apa pun, tidak mengubah dokumennya, dan tidak
mengirim laporan apa pun ke Bank Indonesia maupun PPATK. Penggantian dokumen tetap dikerjakan manusia.

**Daftar yang kosong bukan bukti seluruh dokumen masih berlaku.** Dokumen tanpa tanggal berakhir tidak
akan pernah muncul di sana, dan banyaknya dokumen semacam itu ditulis apa adanya di bawah daftarnya.

### Menonaktifkan dokumen

Tombolnya bernama **Nonaktifkan**, bukan Hapus, dan itu disengaja: **dokumennya tidak dihapus**.
Barisnya tetap ada beserta siapa yang menonaktifkan, kapan, dan **alasannya — yang wajib diisi**.
Berkasnya beserta seluruh riwayat versinya tetap tersimpan dan tetap dapat dibuka dari bagian
**Nonaktif** di bawah daftar.

Arsip yang isinya dapat lenyap tanpa jejak bernilai lebih kecil bagi pemeriksa daripada arsip yang
tidak dapat.

### Siapa yang boleh apa

Mengunggah, mengganti versi, menonaktifkan, dan **membacanya** — seluruhnya **Controller ke atas**.
Staff dan Admin tidak dapat membuka halaman ini maupun memanggil prosedurnya: arsip memuat
surat-menyurat regulator dan notulen rapat, yang merupakan bacaan pengawasan dan bukan bacaan kasir.

## 7B. Penatausahaan Dokumen — Controller ke atas

Buka **Kepatuhan → Penatausahaan Dokumen**. Halaman ini menjawab pertanyaan pemeriksa tentang
**Pasal 48 PBI 10/2024**: berapa lama dokumen dan catatan nasabah wajib ditatausahakan, dihitung dari
data yang benar-benar tercatat. Halaman ini **hanya membaca**.

**Aplikasi ini tidak menghapus dokumen nasabah maupun transaksi — tidak ada tombol untuk itu, di
halaman mana pun.** Satu-satunya penghapusan dokumen yang ada adalah hapus permanen dokumen profil
perusahaan oleh Pemegang Saham (§5.8), karena logo dan izin usaha bukan data Pengguna Jasa.

### Ringkasan

Empat kartu, masing-masing dengan dasar hukumnya di bawah angkanya:

- **Hubungan usaha berjalan** — nasabah Aktif atau Dibatasi. Jam lima tahun belum berdetak.
- **Hubungan usaha berakhir** — nasabah Nonaktif, beserta berapa yang **tenggatnya sudah lewat**.
  Yang lewat tenggat **tidak dihapus dan tidak diusulkan dihapus**: Pasal 48 menetapkan batas
  *paling singkat*, dan ayat (6) membolehkan penatausahaan lebih lama.
- **Tidak aktif tanpa tanggal berakhir** — nasabah yang dinonaktifkan sebelum tanggal berakhirnya
  hubungan usaha mulai dicatat (11 September 2026). Jamnya diperlakukan **belum berdetak**, bukan
  ditebak dari tanggal penyuntingan terakhir — tenggat yang terlalu cepat adalah kekeliruan yang tidak
  boleh terjadi.
- **Dokumen profil perusahaan** — aturan rumah lima tahun sejak diunggah, **bukan** kewajiban Pasal 48.

### Pernyataan per nasabah

Cari nasabah dengan nama atau CIF — **termasuk yang tidak aktif**. Pernyataannya memuat:

- **Data nasabah ditahan sampai** — lima tahun sejak peristiwa **paling akhir** di antara berakhirnya
  hubungan usaha, transaksi selesai terakhir, dan ketidaksesuaian profil terakhir (penjelasan
  Pasal 48 ayat (1) huruf b: masa retensi yang **terlama**). Selama hubungan usaha masih berjalan,
  kolomnya bertuliskan *Tanpa batas — hubungan usaha masih berjalan*.
- **Dokumen** (foto identitas dan dokumen underlying) dan **Catatan transaksi (bon)**, masing-masing
  dengan *Dasar retensi* dan *Ditahan sampai*. Dokumen dan bon transaksi ditahan sepuluh tahun sejak
  **akhir tahun buku** transaksinya (UU Dokumen Perusahaan, dirujuk Pasal 48 ayat (1) huruf b) — kecuali
  tenggat nasabahnya lebih jauh, maka yang lebih jauh itulah yang berlaku. Tahun buku dibaca pada zona
  waktu operasional perusahaan (§5.8), jadi bon pukul 00.30 tanggal 1 Januari masuk tahun buku yang baru.
- **Catatan yang ikut ditatausahakan** — jumlah penyaringan daftar pantau dan peninjauan profil.
- **Korespondensi** — ditulis apa adanya: *tidak ditatausahakan di aplikasi ini*. Pengaduan konsumen
  berkunci pada nomor identitas pelapor, bukan pada nasabah. Ini bukan angka nol.

### Kapan tanggal berakhirnya hubungan usaha tercatat

Tanggalnya diisi **saat status nasabah berpindah menjadi Nonaktif** lewat **Edit** di Daftar Nasabah
(§5.3), dan dikosongkan kembali bila nasabah diaktifkan lagi. Menyunting nasabah yang sudah Nonaktif
tanpa mengubah statusnya **tidak** memundurkan tanggalnya. Perubahannya tercatat di log audit
`CUSTOMER_UPDATED`, sebelum dan sesudahnya.

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
- [ ] **Hari pertama saja:** setoran modal pemilik telah dicatat di Modal & Bank sebelum kas awal.
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
- [ ] Isi brankas ikut dihitung per pecahan, dan brankas yang kosong dinyatakan kosong.
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
