# Teks halaman publik Ibukota Valasindo

12 November 2026 (WIB). Urutan mengikuti rencana bagian halaman publik. Kolom Text berisi teks layar; kolom Note berisi arahan untuk peninjau dan pelaksana, bukan teks layar.

Diagnosis: draf baru dari fakta yang sudah diberikan. Suaranya petugas konter yang menjelaskan kurs dan persiapan datang. Sapaan kepada pembaca selalu “Anda”; “Saya” hanya untuk pilihan dan persetujuan yang diucapkan pelanggan.

Nilai dalam kurung kurawal berasal dari data sebenarnya. `{telepon}` dan `{whatsapp}` diambil dari Profil Perusahaan (untuk Ibukota Valasindo: telepon (0263) 265-500, WhatsApp sementara 0811-260-269), tidak pernah ditulis mati di kode. `{totalRupiah}` sudah mencakup “Rp” dan format angka Indonesia. `{jamPembaruan}`, `{jamBuka}`, dan `{jamTutup}` sudah mencakup “WIB”. `{tanggal}` selalu memakai tanggal WIB; pada informasi buka berikutnya, nilainya adalah tanggal buka berikutnya. Penanda dalam kurung siku adalah isi yang masih harus diambil dari profil atau pengumuman, bukan tulisan yang boleh ditayangkan.

Tidak ada janji penguncian kurs. Ketentuan kondisi uang dan pengumuman tidak diisi dengan tebakan.

**Keputusan pemilik 12 Nov 2026 (ditinjau Claude sesudah draf Codex):** stok tidak pernah ditampilkan (nasabah diajak menelepon dulu); semua kurs aktif tampil tanpa kelompok unggulan; jam Senin–Sabtu 09.00–17.00 WIB, Minggu tutup; WhatsApp ada (sementara nomor pemilik). Kalimat "petugas memastikan kurs dan pecahan" ditulis lengkap hanya di §1, batas hasil §2, dan FAQ 3; di tempat lain diringkas supaya halaman tidak mengulang kalimat yang sama.

## §0 Kedatangan

| Element | Text | Note |
|---|---|---|
| Nama | Ibukota Valasindo | Logo IV boleh menjadi unsur visual tanpa teks tambahan. |
| Memuat | Memuat kurs… | Hanya selama permintaan data berjalan; tanpa hitungan atau jam rekaan. |
| Kurs termuat | Kurs terbaru {jamPembaruan} | Hanya setelah data kurs berhasil dimuat. Tanggal lengkap tersedia di §1. |
| Belum ada kurs | Belum ada kurs | Lanjutkan ke keadaan kosong §1. |
| Gagal memuat | Kurs belum bisa dimuat. Coba muat ulang. | Jangan menahan pengunjung di layar kedatangan. |
| Tombol pemulihan | Muat ulang kurs | Meminta data kembali. |

## Kepala halaman

| Element | Text | Note |
|---|---|---|
| Nama | Ibukota Valasindo | Nama dagang. |
| Jangkar kurs | Kurs | Menuju §1. |
| Jangkar kalkulator | Hitung | Menuju §2. |
| Jangkar lokasi | Lokasi | Menuju §5. |
| Jangkar bantuan | Bantuan | Menuju §8. |
| Tautan lewati navigasi | Langsung ke kurs | Terlihat saat mendapat fokus keyboard. |
| Chip buka | Buka | Dipakai juga di §1 dan §5. Berdasarkan jadwal terstruktur dalam WIB. |
| Penjelas buka | Buka sampai {jamTutup}. | Mendampingi chip; bukan bagian chip. |
| Chip mendekati tutup | Segera tutup | 30 menit sebelum jam tutup (keputusan Claude; mudah diubah). |
| Penjelas mendekati tutup | Tutup pukul {jamTutup}. | Jangan menjanjikan pelanggan masih sempat dilayani. |
| Chip tutup | Tutup | Mendampingi salah satu penjelas berikut. |
| Buka lagi hari ini | Buka hari ini pukul {jamBuka}. | Hanya jika jadwal berikutnya masih pada tanggal WIB hari ini. |
| Buka lagi hari berikutnya | Buka {tanggal} pukul {jamBuka}. | Tanggal buka berikutnya dari jadwal, bukan selalu besok. |
| Chip jadwal belum tersedia | Jam belum tersedia | Jangan menebak Buka atau Tutup. |
| Penjelas jadwal belum tersedia | Jam buka belum tersedia. Telepon {telepon} sebelum Anda datang. | Juga dipakai jika waktu buka berikutnya belum diketahui. |
| Memuat profil | Memuat informasi outlet… | Nama tetap boleh tampil; jangan menampilkan izin atau kontak rekaan. |
| Gagal memuat profil | Informasi outlet belum bisa dimuat. Coba muat ulang. | Jangan mengganti kontak dengan nomor lain. |
| Tombol pemulihan profil | Muat ulang informasi | Berlaku pada informasi profil yang gagal dimuat. |
| Judul halaman `<title>` | Ibukota Valasindo: kurs valas Cianjur | Alternatif: Kurs valas Cianjur: Ibukota Valasindo. |
| Meta description | Cek kurs valas Ibukota Valasindo di Cianjur. Hitung perkiraan tukar, minta konfirmasi kurs, dan lihat alamat serta jam buka. | Maksimal 150 karakter. |

## §1 Kurs hari ini

| Element | Text | Note |
|---|---|---|
| Judul | Kurs hari ini | Alternatif: Cek kurs sebelum Anda datang. |
| Waktu pembaruan | Diperbarui {tanggal}, {jamPembaruan} | Tampilkan tanggal agar kurs lama tidak terbaca sebagai pembaruan hari ini. |
| Pengantar | Anda mau menukar valas? Pilih jual atau beli untuk melihat kurs yang sesuai. | “Valas” berarti uang asing; dijelaskan di bantuan §8. |
| Label saklar | Saya mau: | Sama di kalkulator. |
| Pilihan jual | Saya jual valas | Pelanggan menyerahkan valas dan menerima rupiah; memakai kurs beli perusahaan. |
| Pilihan beli | Saya beli valas | Pelanggan menerima valas dan membayar rupiah; memakai kurs jual perusahaan. |
| Penjelas pilihan jual | Anda menyerahkan valas dan menerima rupiah. | Berubah mengikuti pilihan. |
| Penjelas pilihan beli | Anda membeli valas dan membayar rupiah. | Berubah mengikuti pilihan. |
| Nama mata uang | {valuta} | Nama dan kode dari data, misalnya USD, dolar AS; bukan daftar valuta yang dijanjikan tersedia. |
| Label pecahan | Pecahan | Untuk kartu dan tabel. |
| Nilai pecahan | {jumlah} {valuta} | `{jumlah}` adalah nilai per lembar, bukan jumlah lembar. |
| Pecahan lain | Pecahan lainnya | Hanya untuk kelompok yang memang ada pada data kurs. |
| Kolom jual pelanggan | Anda jual | Subjudul kecil: “Rupiah yang Anda terima”. Jangan tampilkan “Kami beli”. |
| Kolom beli pelanggan | Anda beli | Subjudul kecil: “Rupiah yang Anda bayar”. Jangan tampilkan “Kami jual”. |
| Nilai kurs | {totalRupiah} | Nilai kurs untuk arah, pecahan, dan satuan kutipan yang bersangkutan. Jangan dibulatkan seperti total transaksi. |
| Satuan kutipan | Per {jumlah} {valuta} | `{jumlah}` adalah satuan kutipan kurs dari data, tidak selalu 1. Tampilkan dekat angka kurs. |
| Label perubahan naik | Naik | Maksimal 3 kata. Dibandingkan kurs sebelumnya untuk arah, valuta, pecahan, dan satuan yang sama. |
| Label perubahan turun | Turun | Sama; jangan mengandalkan warna atau panah saja. |
| Label perubahan tetap | Tetap | Hanya jika nilai sebelumnya tersedia dan sama. |
| Riwayat pembanding tidak ada | Belum ada pembanding | Bukan “Tetap”. |
| Penjelas perubahan | Perubahan dibanding kurs sebelumnya. | Tidak menyebut “kemarin” jika datanya bukan kemarin. |
| Keterangan tabel | Kurs valas menurut pecahan | Juga dapat menjadi caption aksesibel. |
| Kolom mata uang | Mata uang | Nama mata uang konsisten dengan kalkulator. |
| Kolom pembaruan | Diperbarui | Nilai sel: `{tanggal}, {jamPembaruan}`. |
| Catatan kurs | Kurs ini perkiraan. Petugas memastikan kurs dan pecahan yang tersedia sebelum transaksi. | Dekat angka kurs, bukan hanya di kaki halaman. |
| Catatan pecahan | Beda pecahan bisa beda kurs, misalnya USD 100 dan pecahan kecil. | Contoh menjelaskan mekanisme, bukan janji penerimaan pecahan. |
| Ajakan cek stok | Mau tukar dalam jumlah besar? Telepon dulu supaya pecahannya kami siapkan. | Keputusan pemilik: stok tidak ditampilkan. Tombol: “Telepon outlet”. |
| Memuat | Memuat kurs… | Tidak ada angka pengganti. |
| Kosong, judul | Belum ada kurs | Tidak mengklaim petugas sedang menyiapkannya. |
| Kosong, petunjuk | Telepon {telepon} untuk menanyakan kurs dan pecahan yang tersedia. | Tetap tampilkan lokasi dan kontak. |
| Gagal memuat | Kurs belum bisa dimuat. Coba muat ulang atau telepon {telepon}. | Apa yang terjadi dan tindakan berikutnya. |
| Tombol pemulihan | Muat ulang kurs | Juga untuk pembaruan yang gagal. |
| Pembaruan gagal, data lama ada | Kurs terbaru belum bisa dimuat. Muat ulang atau telepon {telepon} untuk memastikan kurs. | Pertahankan waktu pembaruan data lama yang sebenarnya. |

## §2 Hitung tukar

| Element | Text | Note |
|---|---|---|
| Judul | Hitung tukar Anda | Alternatif: Tukar valas, berapa rupiahnya? |
| Pengantar | Pilih mata uang, pecahan, dan jumlah yang ingin Anda tukar. | Tidak menjanjikan ketersediaan uang. |
| Label saklar | Saya mau: | Sinkron dengan arah di §1. |
| Pilihan jual | Saya jual valas | Memakai kurs beli perusahaan. |
| Pilihan beli | Saya beli valas | Memakai kurs jual perusahaan. |
| Label mata uang | Mata uang | Label tetap ada meski placeholder terlihat. |
| Placeholder mata uang | Pilih mata uang | Daftar hanya dari data kurs. |
| Pilihan mata uang | {valuta} | Kode dan nama dari data. |
| Label pecahan | Pecahan uang | Harus memilih kurs untuk pecahan yang sesuai. |
| Placeholder pecahan | Pilih pecahan | Jangan otomatis menyamakan kurs pecahan besar dan kecil. |
| Pilihan pecahan | {jumlah} {valuta} | `{jumlah}` adalah nilai per lembar. |
| Bantuan pecahan | Pecahan uang bisa punya kurs berbeda. Pilih sesuai uang yang Anda jual atau beli. | Tidak menetapkan kebijakan penerimaan. |
| Label jumlah saat jual | Jumlah valas yang Anda jual | Jumlah uang asing, bukan jumlah lembar. |
| Label jumlah saat beli | Jumlah valas yang Anda beli | Jumlah uang asing, bukan jumlah lembar. |
| Placeholder jumlah | Contoh: 500 | Contoh masukan, bukan jumlah minimum. |
| Bantuan jumlah | Isi jumlah dalam {valuta}, bukan rupiah atau jumlah lembar. | Tampilkan setelah mata uang dipilih. |
| Tombol hitung | Hitung | Menghasilkan perkiraan. |
| Sedang menghitung | Menghitung… | Hanya saat perhitungan benar-benar berjalan. |
| Belum dihitung | Pilih mata uang dan pecahan, lalu isi jumlah untuk menghitung. | Keadaan awal hasil. |
| Label hasil jual | Perkiraan rupiah yang Anda terima | Jangan beri label “bayar” pada arah ini. |
| Ringkasan hasil jual | Anda jual {jumlah} {valuta}. Perkiraan Anda menerima {totalRupiah}. | `{jumlah}` adalah jumlah valas seluruhnya. |
| Label hasil beli | Perkiraan rupiah yang Anda bayar | Jangan beri label “terima” pada arah ini. |
| Ringkasan hasil beli | Anda beli {jumlah} {valuta}. Perkiraan Anda membayar {totalRupiah}. | Sama. |
| Angka hasil | {totalRupiah} | Total sudah dibulatkan ke atas ke kelipatan Rp 100, untuk kedua arah. |
| Kurs yang dipakai | Kurs per {jumlah} {valuta}: {totalRupiah} | Di baris ini jumlah adalah satuan kutipan, rupiah adalah kurs, bukan total. |
| Waktu kurs | Diperbarui {tanggal}, {jamPembaruan} | Waktu kurs yang benar-benar dipakai. |
| Catatan pembulatan | Total dibulatkan ke atas dalam kelipatan Rp 100. | Nilai yang sudah tepat kelipatan Rp 100 tidak dinaikkan lagi. |
| Batas perkiraan | Hasil ini perkiraan. Petugas memastikan kurs dan pecahan yang tersedia sebelum transaksi. | Tidak ada janji harga tetap. |
| Tombol ke formulir | Minta konfirmasi kurs | Menggantikan usulan “kunci kurs”; tidak ada penguncian kurs dalam fakta yang diberikan. |
| Kurs belum tersedia | Belum ada kurs untuk menghitung. Telepon {telepon} untuk menanyakan kurs. | Jangan menampilkan total nol. |
| Mata uang belum dipilih | Mata uang belum dipilih. Pilih mata uang yang ingin Anda tukar. | Pesan di dekat pilihan mata uang. |
| Pecahan belum dipilih | Pecahan belum dipilih. Pilih pecahan uang Anda. | Pesan di dekat pilihan pecahan. |
| Jumlah kosong | Jumlah valas belum diisi. Isi jumlah yang ingin Anda tukar. | Pesan di dekat kolom jumlah. |
| Jumlah tidak terbaca | Jumlah valas belum terbaca. Isi dengan angka, misalnya 500. | Jangan menyebut kode galat. |
| Jumlah nol atau negatif | Jumlah valas harus lebih dari 0. Periksa jumlah yang Anda isi. | Tidak menciptakan minimum transaksi. |
| Kurs pilihan tidak ada | Kurs untuk pilihan ini belum tersedia. Pilih pecahan lain atau telepon {telepon}. | Jangan diam-diam memakai kurs lain. |
| Kurs berubah | Kurs sudah berubah. Hitung ulang untuk melihat perkiraan terbaru. | Muncul jika perubahan benar-benar terdeteksi. |
| Tombol hitung ulang | Hitung ulang | Setelah kurs, arah, pecahan, atau jumlah berubah. |
| Perhitungan gagal | Perkiraan belum bisa dihitung. Coba hitung ulang atau telepon {telepon}. | Hasil yang gagal bukan Rp 0. |
| Judul formulir | Minta konfirmasi kurs | Sama dengan tombol pembukanya. |
| Pengantar formulir | Petugas kami akan menghubungi Anda untuk memastikan kursnya. | Tidak menjanjikan waktu balasan. |
| Batas formulir | Ini bukan pemesanan atau transaksi. Mengisi formulir tidak mengunci kurs. | Batas yang memang perlu diketahui pelanggan, bukan kontras pemasaran. |
| Ringkasan arah jual | Anda jual {jumlah} {valuta} | Bawa pilihan kalkulator ke formulir. |
| Ringkasan arah beli | Anda beli {jumlah} {valuta} | Sama. |
| Ringkasan pecahan | Pecahan {jumlah} {valuta} | Jumlah di sini nilai per lembar. |
| Ringkasan rupiah saat jual | Perkiraan Anda terima: {totalRupiah} | Bawa hasil pembulatan kalkulator. |
| Ringkasan rupiah saat beli | Perkiraan Anda bayar: {totalRupiah} | Sama. |
| Tombol koreksi | Ubah perhitungan | Kembali ke pilihan kalkulator. |
| Label nama | Nama Anda | Tidak meminta nomor identitas. |
| Placeholder nama | Isi nama Anda | Bukan pengganti label. |
| Label cara dihubungi | Hubungi Anda lewat | Mengganti istilah “kanal”. |
| Pilihan WhatsApp | WhatsApp | Saluran pilihan pelanggan; tidak membuktikan nomor WhatsApp outlet. |
| Pilihan telepon | Telepon | Sama. |
| Label nomor WhatsApp | Nomor WhatsApp Anda | Mengikuti pilihan saluran. |
| Placeholder WhatsApp | Isi nomor WhatsApp Anda | Tidak memakai nomor contoh milik orang. |
| Label telepon | Nomor telepon Anda | Mengikuti pilihan saluran. |
| Placeholder telepon | Isi nomor telepon Anda | Sama. |
| Bantuan kontak | Isi nomor yang bisa dipakai petugas untuk menghubungi Anda. | Tidak meminta pembayaran. |
| Pilihan email | Email | Hanya jika saluran email yang ada sekarang tetap dipertahankan. Rencana bagian hanya meminta WhatsApp/telepon. |
| Label email | Email Anda | Hanya pada saluran email. |
| Placeholder email | nama@contoh.com | Contoh format, bukan kontak perusahaan. |
| Label waktu | Rencana waktu datang (opsional) | Tidak menyebut janji temu terkonfirmasi. |
| Placeholder waktu | Pilih tanggal dan jam | Jika kontrol tanggal memerlukan petunjuk. |
| Bantuan waktu | Waktu memakai WIB. Petugas akan memastikan rencana kedatangan Anda. | Tidak mengarang hari atau jam buka. |
| Persetujuan dihubungi | Saya setuju dihubungi petugas untuk membahas permintaan ini. | Kalimat persetujuan dari sudut pelanggan. |
| Pengingat data | Jangan isi nomor KTP, nomor rekening, atau data pembayaran di formulir ini. | Jangan menambahkan kolom atau unggahan identitas. |
| Tombol permintaan | Minta konfirmasi kurs | Bukan “Kirim”. |
| Permintaan sedang diproses | Memproses permintaan… | Hanya selama permintaan berjalan. |
| Nama kosong | Nama belum diisi. Isi nama Anda agar petugas tahu siapa yang dihubungi. | Tidak menyalahkan pembaca. |
| Nama belum memenuhi panjang | Nama terlalu pendek atau panjang. Sesuaikan menjadi 3 sampai 200 karakter. | Mengikuti batas formulir saat ini; bukan aturan identitas. |
| Nomor kosong | Nomor belum diisi. Isi nomor yang bisa dihubungi. | Untuk WhatsApp/telepon. |
| Nomor tidak sesuai | Nomor belum bisa dipakai. Periksa nomor dan kode negaranya. | Untuk kegagalan pemeriksaan nomor. |
| Email kosong atau tidak sesuai | Email belum bisa dipakai. Periksa alamat email Anda. | Hanya jika saluran email dipertahankan. |
| Waktu tidak terbaca | Waktu datang belum terbaca. Pilih ulang tanggal dan jam, atau kosongkan kolom ini. | Kolom opsional. |
| Persetujuan belum dipilih | Persetujuan dihubungi belum dipilih. Centang persetujuan jika Anda ingin meminta konfirmasi kurs. | Jangan mencentang otomatis. |
| Kurs hilang saat meminta | Kurs pilihan Anda sudah tidak tersedia. Hitung ulang atau telepon {telepon}. | Tidak mengganti pilihan tanpa sepengetahuan pelanggan. |
| Gagal, dipastikan belum tersimpan | Permintaan belum tersimpan. Coba lagi atau telepon {telepon}. | Hanya jika kegagalan penyimpanan dapat dipastikan. |
| Gagal, hasil belum diketahui | Hasil permintaan belum bisa dipastikan. Telepon {telepon} sebelum Anda mencoba lagi. | Untuk koneksi putus atau jawaban tidak diterima; jangan mengklaim pasti gagal. |
| Tombol mencoba kembali | Minta konfirmasi kurs | Hanya pada kegagalan yang dipastikan belum tersimpan. |
| Berhasil, judul | Permintaan diterima | Hanya setelah ada konfirmasi penyimpanan. |
| Berhasil, nomor | Nomor permintaan: {nomorPermintaan} | Tiket permintaan, bukan bukti transaksi. |
| Berhasil, tindak lanjut | Simpan nomor ini. Petugas kami akan menghubungi Anda di jam buka. | Jangan menghapus ringkasan perhitungan setelah berhasil. |
| Berhasil, batas | Kurs dan waktu datang belum dikonfirmasi. | Tidak menampilkan “pemesanan berhasil”. |
| Tombol salin permintaan | Salin nomor permintaan | Maksimal 4 kata. |
| Nomor permintaan tersalin | Nomor permintaan tersalin. | Hanya setelah salinan berhasil. |
| Salin permintaan gagal | Nomor belum bisa disalin. Catat nomor permintaan yang tertera. | Nomor tetap terlihat. |

## §3 Bagikan kurs

| Element | Text | Note |
|---|---|---|
| Judul | Bagikan kurs hari ini | Tidak perlu kalimat pengantar tambahan. |
| Tombol WhatsApp | Bagikan ke WhatsApp | Maksimal 4 kata. |
| Bantuan | Pesan berisi kurs utama hari ini dan tautan halaman ini. | Tidak mengklaim pesan sudah terkirim hanya karena WhatsApp terbuka. |
| Sedang menyiapkan | Menyiapkan pesan… | Hanya selama pesan disiapkan. |
| Pesan WhatsApp lengkap | Kurs Ibukota Valasindo, {tanggal} pukul {jamPembaruan}<br>{valuta} per {jumlah} {valuta}: Anda jual {totalRupiah}; Anda beli {totalRupiah}.<br>{valuta} per {jumlah} {valuta}: Anda jual {totalRupiah}; Anda beli {totalRupiah}.<br>{valuta} per {jumlah} {valuta}: Anda jual {totalRupiah}; Anda beli {totalRupiah}.<br>{valuta} per {jumlah} {valuta}: Anda jual {totalRupiah}; Anda beli {totalRupiah}.<br>Kurs perkiraan. Cek yang terbaru: https://ibukotavalasindo.online | Maksimal 6 baris; setiap `<br>` menjadi baris baru. Baris 2–5: empat valuta teratas urutan papan kurs (tanpa kelompok unggulan; keputusan pemilik); `{valuta}` mencakup keterangan pecahan agar tidak ambigu. Hilangkan baris yang tidak ada datanya. Dua nilai rupiah pada setiap baris berbeda: pertama kurs pelanggan menjual, kedua kurs pelanggan membeli. `{jumlah}` adalah satuan kutipan, bukan nominal transaksi. |
| Kurs belum tersedia | Belum ada kurs untuk dibagikan. Telepon {telepon} untuk menanyakan kurs. | Jangan menyiapkan pesan dengan angka kosong. |
| Pesan gagal disiapkan | Pesan belum bisa disiapkan. Coba lagi atau salin tautan halaman ini. | Tautan tersedia terpisah. |
| WhatsApp gagal dibuka | WhatsApp belum bisa dibuka. Salin tautan untuk Anda bagikan sendiri. | Hanya jika kegagalan dapat diketahui. |
| Tombol pemulihan pesan | Siapkan ulang pesan | Menghasilkan pesan lagi. |
| Tombol salin tautan | Salin tautan | Pilihan cadangan. |
| Tautan | https://ibukotavalasindo.online | Tetap terlihat jika salin otomatis gagal. |
| Tautan tersalin | Tautan tersalin. | Tidak berarti sudah dibagikan. |
| Salin tautan gagal | Tautan belum bisa disalin. Tekan lama tautan, lalu pilih salin. | Untuk ponsel; tautan harus tetap dapat dipilih. |

## §4 Ketentuan uang

| Element | Text | Note |
|---|---|---|
| Judul | Pecahan dan kondisi uang | Alternatif: Periksa uang sebelum Anda datang. |
| Pengantar | Beda pecahan bisa beda kurs. Pastikan pecahan uang Anda dengan petugas sebelum transaksi. | Hanya tampil bersama ketentuan yang sudah diisi perusahaan. |
| Ketentuan pecahan | [Ketentuan pecahan dari Profil Perusahaan] | Isi faktual wajib dari perusahaan. Jangan menebak daftar pecahan yang diterima. |
| Ketentuan kondisi | [Ketentuan kondisi uang dari Profil Perusahaan] | Jangan mengarang penerimaan, potongan kurs, atau penolakan uang lusuh, cacat, dan bercoret. |
| Ketentuan seri | [Ketentuan seri uang dari Profil Perusahaan] | Jangan menetapkan batas tahun seri, termasuk USD sebelum 2006, tanpa isi profil yang disetujui. |
| Arahkan pertanyaan | Belum yakin dengan kondisi uang Anda? Telepon {telepon} sebelum datang. | Tidak meminta foto identitas atau pembayaran. |
| Tombol kontak | Telepon outlet | Membuka panggilan ke nomor yang ditampilkan. |
| Kosong | Ketentuan umum `DEFAULT_MONEY_RULES` (`shared/publicPage.ts`) | Keputusan pemilik 12 Nov 2026 ("isi dulu dengan yang umum"): tiga kalimat "bisa …" tanpa janji atas nama outlet; isi profil menggantikannya. |
| Memuat atau gagal | Tidak ditampilkan | Arahan saja: gunakan keadaan profil di kepala halaman; jangan membuat kebijakan pengganti. |

## §5 Datang ke outlet

| Element | Text | Note |
|---|---|---|
| Judul | Datang ke outlet | Alternatif: Alamat dan jam buka. |
| Label alamat | Alamat | Alamat lengkap tetap berupa teks, bukan hanya gambar peta. |
| Alamat | Jl. Mangunsarkoro No. 35, Solokpandan, Cianjur | Fakta yang diberikan. |
| Keterangan peta | Lokasi Ibukota Valasindo di Cianjur | Untuk gambar peta jika membutuhkan teks alternatif. |
| Tombol peta | Buka di peta | Pakai tautan peta dari profil; jangan menebak tautan lokasi. |
| Peta gagal dimuat | Peta belum bisa dimuat. Gunakan alamat di atas atau pilih Buka di peta. | Alamat dan tombol tetap tersedia. |
| Label jam | Jam buka | Nilai jadwal dari profil terstruktur. |
| Baris jadwal | Senin–Sabtu: 09.00–17.00 WIB · Minggu: Tutup | Dari jadwal terstruktur Profil Perusahaan (keputusan pemilik 12 Nov 2026); ditulis sebagai rentang hari, bukan tujuh baris. |
| Hari tanpa layanan | Tutup | Hanya jika jadwal hari itu memang menyatakan tutup. |
| Status sekarang | Buka / Segera tutup / Tutup | Masing-masing satu varian chip, memakai penjelas yang sama persis dengan kepala halaman. |
| Jadwal belum tersedia | Jam buka belum tersedia. Telepon {telepon} sebelum Anda datang. | Bukan klaim tutup. |
| Label telepon | Telepon | Nomor kantor. |
| Nomor telepon | {telepon} | Sumber: fakta yang diberikan dan profil perusahaan. |
| Tombol panggilan | Telepon outlet | Nomor tujuan harus terlihat. |
| Tombol salin telepon | Salin nomor | Berlaku per nomor yang bersangkutan. |
| Label WhatsApp | WhatsApp | Tampil bila Profil Perusahaan berisi nomor WhatsApp. |
| Nomor WhatsApp | {whatsapp} | Sementara 0811-260-269 (keputusan pemilik). |
| Tombol WhatsApp | Chat di WhatsApp | Membuka WhatsApp; tidak ada pesan terkirim otomatis. |
| Nomor tersalin | Nomor tersalin. | Hanya setelah salin berhasil. |
| Salin nomor gagal | Nomor belum bisa disalin. Tekan lama nomor di atas, lalu pilih salin. | Nomor harus dapat dipilih. |
| Panggilan gagal dibuka | Panggilan belum bisa dibuka. Hubungi {telepon} dari telepon Anda. | Hanya jika kegagalan diketahui. |
| WhatsApp gagal dibuka | WhatsApp belum bisa dibuka. Salin nomor yang tertera untuk menghubungi outlet. | Nomor WhatsApp tetap terlihat. |
| Subjudul persiapan | Yang perlu Anda bawa | Maksimal 6 kata. |
| Identitas | Bawa KTP atau paspor Anda. | Tidak meminta nomor atau foto identitas lewat formulir publik. |
| Subjudul pembelian besar | Pembelian di atas USD 10.000 | Batas dihitung per orang per bulan, termasuk nilai setara dalam valuta lain. |
| Dokumen tambahan | Jika total pembelian valas Anda melebihi USD 10.000 atau setaranya dalam sebulan, bawa dokumen pendukung dan NPWP. | Tidak menambahkan daftar dokumen yang belum diberikan. |
| Subjudul pembelian sampai batas | Pembelian sampai USD 10.000 | Mencakup tepat USD 10.000 atau setaranya. |
| Pernyataan pelanggan | Jika total pembelian valas Anda sampai USD 10.000 atau setaranya dalam sebulan, Anda menandatangani pernyataan. Pernyataan ini menyebut pembelian bulan itu belum melewati batas tersebut. | Jangan menyebut pelanggan bebas persyaratan; identitas tetap diperlukan. |
| Dasar perhitungan batas | Batas dihitung per orang per bulan. Aturan berlaku sejak 1 Juli 2026. | Fakta regulasi dari brief; tidak berlaku sebagai batas penjualan valas oleh pelanggan. |
| Pertanyaan dokumen | Untuk memastikan dokumen yang perlu dibawa, telepon {telepon}. | Tidak mengarang jenis dokumen pendukung. |

## §6 Resmi dan aman

| Element | Text | Note |
|---|---|---|
| Judul | Berizin Bank Indonesia | Alternatif: Periksa izin dan kontak kami. |
| Badan hukum | PT Ibukota Valasindo | Bukan nama atau logo lembaga pemberi izin. |
| Penjelas izin | PT Ibukota Valasindo berizin Bank Indonesia sebagai penukar valuta asing bukan bank. | Tidak menyebut simpanan dijamin atau layanan bank. |
| Label nomor izin | Nomor izin | Nilai dari profil perusahaan. |
| Nomor izin | {nomorIzin} | Jangan menayangkan placeholder mentah jika data belum tersedia. |
| Label kode | Kode KUPVA | Singkatan resmi tetap dipakai pada rincian izin. |
| Kode | {kodeKupva} | Nilai dari profil perusahaan. |
| Tombol daftar resmi | Lihat daftar berizin | Tujuan: halaman daftar resmi KUPVA di bi.go.id. URL tepat perlu diverifikasi Claude sebelum dipasang. |
| Pengantar daftar | Periksa nama perusahaan di daftar penukar valas berizin Bank Indonesia. | Tidak mengklaim tautan telah diverifikasi dalam tugas menulis ini. |
| Rincian izin belum termuat | Rincian izin belum bisa dimuat. Muat ulang informasi atau periksa daftar resmi Bank Indonesia. | Jangan mengganti nomor izin dengan angka contoh. |
| Tombol pemulihan | Muat ulang informasi | Sama dengan keadaan profil. |
| Subjudul penipuan | Periksa nomor yang menghubungi Anda | Maksimal 6 kata. |
| Peringatan nomor | Kami hanya menghubungi Anda dari nomor yang tercantum di halaman ini. | Tidak mengklaim kanal lain milik perusahaan. |
| Peringatan transfer | Kami tidak pernah meminta transfer lewat chat pribadi. | Tepat pada fakta yang diberikan; tidak diperluas menjadi kebijakan semua pembayaran. |
| Langkah jika ragu | Jika ada permintaan transfer lewat chat pribadi, jangan transfer. Telepon {telepon} untuk memastikan. | Tindakan konkret, tanpa klaim layanan pelaporan khusus. |
| Tombol memastikan | Telepon outlet | Menuju nomor yang ditampilkan. Tanpa logo BI. |

## §7 Pengumuman

| Element | Text | Note |
|---|---|---|
| Judul | Pengumuman outlet | Tampil jika ada pengumuman aktif. |
| Judul pengumuman | [Judul pengumuman aktif] | Dari penulis data pengumuman, bukan judul libur atau stok yang dikarang. Batasi judul publik maksimal 6 kata saat ditulis. |
| Isi pengumuman | [Isi pengumuman aktif] | Pertahankan fakta dan tanggal yang ditulis petugas. Libur, stok habis, dan perubahan jam hanya ditayangkan jika memang diumumkan. |
| Tanggal pengumuman | {tanggal} | Hanya jika tanggal pengumuman tersedia; bukan tanggal hari ini sebagai pengganti. |
| Memuat | Memuat pengumuman… | Tidak membuat kartu pengumuman contoh. |
| Gagal memuat | Pengumuman belum bisa dimuat. Muat ulang atau telepon {telepon} sebelum datang. | Keadaan gagal berbeda dari kosong. |
| Tombol pemulihan | Muat ulang pengumuman | Mengambil pengumuman kembali. |
| Kosong | Tidak ditampilkan | Arahan saja: seluruh bagian disembunyikan; jangan tayangkan teks ini. |

## §8 Pertanyaan umum

| Element | Text | Note |
|---|---|---|
| Judul | Pertanyaan umum | Maksimal 12 tanya-jawab; draf ini berisi 10. |
| Pertanyaan 1 | Apa itu valas? | Pertanyaan singkat, bukan judul pemasaran. |
| Jawaban 1 | Valas adalah uang asing, misalnya dolar AS atau riyal Saudi. Anda bisa melihat kursnya di bagian Kurs. | Contoh mata uang dari brief; daftar kurs aktual tetap mengikuti data. |
| Pertanyaan 2 | Saya jual atau beli valas? | Maksimal 6 kata. |
| Jawaban 2 | Pilih “Saya jual valas” jika Anda menyerahkan uang asing dan menerima rupiah. Pilih “Saya beli valas” jika Anda membayar rupiah untuk mendapat uang asing. | Tidak memaksa pelanggan menerjemahkan sudut pandang perusahaan. |
| Pertanyaan 3 | Apakah kurs di sini sudah pasti? | Maksimal 6 kata. |
| Jawaban 3 | Kurs di halaman ini masih perkiraan. Petugas memastikan kurs dan pecahan yang tersedia sebelum transaksi. | Tanpa janji kurs dikunci. |
| Pertanyaan 4 | Kenapa beda pecahan beda kurs? | Maksimal 6 kata. |
| Jawaban 4 | Kurs bisa berbeda menurut pecahan uang, misalnya USD 100 dan pecahan kecil. Pilih pecahan yang sesuai saat menghitung, lalu pastikan kursnya dengan petugas. | Tidak mengarang alasan pasar atau kebijakan kondisi uang. |
| Pertanyaan 5 | Bagaimana total rupiah dibulatkan? | Maksimal 6 kata. |
| Jawaban 5 | Total rupiah dibulatkan ke atas dalam kelipatan Rp 100. Aturan ini berlaku saat Anda menjual maupun membeli valas. | Nilai tepat kelipatan tidak dinaikkan lagi. |
| Pertanyaan 6 | Apa yang perlu saya bawa? | Pertanyaan dari sudut pelanggan. |
| Jawaban 6 | Bawa KTP atau paspor Anda. Jika total pembelian valas Anda melebihi USD 10.000 atau setaranya per bulan, bawa juga dokumen pendukung dan NPWP. | Batas per orang; rincian di §5. |
| Pertanyaan 7 | Bagaimana pembelian sampai USD 10.000? | Mencakup tepat pada batas. |
| Jawaban 7 | Anda menandatangani pernyataan bahwa pembelian valas Anda pada bulan itu belum melebihi USD 10.000 atau setaranya. Batas dihitung per orang per bulan. Bawa KTP atau paspor Anda. | Tidak mengubah batas menjadi per transaksi atau per hari. |
| Pertanyaan 8 | Apakah formulir ini memesan valas? | Maksimal 6 kata. |
| Jawaban 8 | Formulir ini hanya untuk meminta konfirmasi kurs dan pecahan yang tersedia. Ini bukan pemesanan atau transaksi. Petugas akan menghubungi Anda; kurs belum dikunci. | Tidak ada janji stok disisihkan atau waktu kunjungan disetujui. |
| Pertanyaan 9 | Kapan dan di mana saya datang? | Maksimal 6 kata. |
| Jawaban 9 | Kami di Jl. Mangunsarkoro No. 35, Solokpandan, Cianjur. Buka Senin–Sabtu, 09.00–17.00 WIB. Minggu tutup. | Tidak mengarang jam operasional. |
| Pertanyaan 10 | Bagaimana memastikan kontak perusahaan? | Maksimal 6 kata. |
| Jawaban 10 | Cocokkan nomor yang menghubungi Anda dengan nomor di halaman ini. Kami tidak pernah meminta transfer lewat chat pribadi. Jika ragu, telepon {telepon}. | Hanya klaim penipuan yang diberikan. |
| Tombol buka jawaban | Buka jawaban | Label aksesibel jika tombol ikon memerlukannya; pertanyaan tetap menjadi label utama. |
| Tombol tutup jawaban | Tutup jawaban | Sama. |
| Memuat | Memuat pertanyaan umum… | Jika FAQ diambil bersama profil, tidak perlu indikator ganda. |
| Gagal memuat | Pertanyaan umum belum bisa dimuat. Muat ulang atau telepon {telepon} untuk bertanya. | Jangan menyamakan gagal dengan kosong. |
| Tombol pemulihan | Muat ulang pertanyaan | Maksimal 4 kata. |
| Kosong, judul | Belum ada pertanyaan umum | Hanya bila tidak memakai draf FAQ di atas. |
| Kosong, petunjuk | Untuk menanyakan kurs atau persiapan datang, telepon {telepon}. | Memberi tindakan berikutnya. |
| Tombol bantuan | Telepon outlet | Nomor tujuan sama dengan §5. |

## §9 Kaki halaman

| Element | Text | Note |
|---|---|---|
| Nama dagang | Ibukota Valasindo | Konsisten dengan kepala halaman. |
| Badan hukum | PT Ibukota Valasindo | Tanpa riwayat, penghargaan, atau ulasan rekaan. |
| Izin | Penukar valuta asing bukan bank berizin Bank Indonesia. | Tanpa logo BI. |
| Rincian izin | Nomor izin: {nomorIzin} | Nilai aktual dari profil. |
| Rincian KUPVA | Kode KUPVA: {kodeKupva} | Nilai aktual dari profil. |
| Alamat | Jl. Mangunsarkoro No. 35, Solokpandan, Cianjur | Sama dengan §5. |
| Telepon | Telepon: {telepon} | Nomor dapat dipilih dan ditelepon. |
| Tombol salin | Salin nomor | Pakai keadaan sukses/gagal salin nomor dari §5. |
| Pengingat kurs | Kurs di halaman ini perkiraan. | Tidak perlu menambah slogan penutup. |
| Tautan staf | Masuk staf | Tautan kecil ke `/login`; bukan tombol utama kepala halaman. |

## /papan Papan kurs outlet

| Element | Text | Note |
|---|---|---|
| Judul halaman `<title>` | Papan kurs: Ibukota Valasindo | Mode opsional, belum menjadi keputusan peluncuran. |
| Nama | Ibukota Valasindo | Tidak mengganti identitas perusahaan dengan BI. |
| Judul | Kurs hari ini | Maksimal 6 kata. |
| Tanggal | {tanggal} | Tanggal WIB sebenarnya. |
| Label jam berjalan | Waktu WIB | Berbeda dari waktu pembaruan kurs. |
| Jam berjalan | [Jam WIB saat ini] | Penanda kerja: brief belum memberi nama placeholder untuk jam berjalan. Jangan memakai `{jamPembaruan}` sebagai jam berjalan. |
| Pembaruan kurs | Kurs diperbarui {tanggal}, {jamPembaruan} | Waktu dari data kurs, bukan jam perangkat. |
| Kolom mata uang | Mata uang | Daftar berganti otomatis jika ada lebih dari satu halaman. |
| Nama mata uang | {valuta} | Dari data kurs. |
| Kolom pecahan | Pecahan | Tidak menggabungkan kurs pecahan berbeda. |
| Nilai pecahan | {jumlah} {valuta} | Nilai per lembar. |
| Kolom pelanggan menjual | Anda jual valas | Memakai kurs beli perusahaan. |
| Kolom pelanggan membeli | Anda beli valas | Memakai kurs jual perusahaan. |
| Nilai kurs | {totalRupiah} | Nilai kutipan kurs, bukan total transaksi. |
| Satuan kurs | Per {jumlah} {valuta} | Nilai unit dari data kurs; tidak diasumsikan 1. |
| Penanda naik | Naik | Dibandingkan kurs sebelumnya yang sesuai. |
| Penanda turun | Turun | Sama. |
| Penanda tetap | Tetap | Hanya jika pembanding tersedia. |
| Pembanding tidak tersedia | Belum ada pembanding | Tidak ditampilkan sebagai “Tetap”. |
| Catatan | Kurs perkiraan. Tanyakan petugas untuk kurs pasti. | Tetap terbaca saat halaman berganti; pendek karena dibaca dari jauh. |
| Memuat | Memuat kurs… | Tidak ada angka bergulir palsu saat data belum datang. |
| Kosong, judul | Belum ada kurs | Jangan menampilkan kurs nol. |
| Kosong, petunjuk | Tanyakan kurs kepada petugas outlet. | Tindakan sesuai konteks layar TV di outlet. |
| Gagal memuat | Kurs belum bisa dimuat. Muat ulang atau tanyakan kepada petugas outlet. | Pada layar lama, waktu pembaruan sebenarnya tetap terlihat. |
| Pembaruan gagal | Kurs terbaru belum bisa dimuat. Tanyakan kurs kepada petugas outlet. | Jangan membuat waktu pembaruan baru. |
| Tombol pemulihan | Muat ulang kurs | Untuk pengendali layar. |
| Tombol layar penuh | Buka layar penuh | Jika ada kontrol layar penuh. |
| Tombol keluar layar penuh | Keluar layar penuh | Maksimal 4 kata. |
| Tombol kembali | Buka halaman utama | Menuju halaman publik biasa. |

## Pemeriksaan sendiri (Codex)

1. Mencari A1/A4/A5: kontras pemasaran, ancang-ancang, dan bantahan rekaan dibuang; batas formulir dipertahankan karena menjawab risiko salah paham nyata.
2. Mencari B6/B8/C11/C15: tidak memakai tiga pujian beruntun, tanda pisah dekoratif, kata kebesaran, atau klaim “terpercaya”.
3. Mencari G1–G8/H: daftar “tanpa”, ekor tempelan, tanya-jawab dramatis, penutup slogan, dan bahasa surat diganti tindakan serta fakta konter.
4. Memeriksa sapaan dan arah: hanya “Anda” untuk pembaca; “Saya” untuk pilihan pelanggan; tombol menyebut hasil; jual/beli selalu dari sisi pelanggan.
5. Belum pasti: ketentuan uang, pengumuman, nomor WhatsApp, jam buka, ambang “Segera tutup”, URL daftar BI, saluran email, dan nama placeholder jam berjalan menunggu data atau keputusan; tidak diisi dengan tebakan.

## Tinjauan Claude (12 Nov 2026)

Draf Codex dipakai hampir utuh: fakta terjaga, arah jual/beli dari sisi nasabah, pesan galat lengkap (apa terjadi +
apa dilakukan), dan "kunci kurs" dibuang dengan alasan benar. Diubah Claude: (1) nomor telepon ditulis mati di
23 tempat → `{telepon}` dari profil (aplikasi white-label); (2) keputusan pemilik 12 Nov (tanpa stok, tanpa unggulan,
jam buka, WhatsApp) menggantikan catatan "belum diputuskan"; (3) kalimat "petugas memastikan kurs dan pecahan yang
tersedia" muncul ±8 kali → dipertahankan di 3 tempat, sisanya diringkas; (4) kolom kurs "Anda jual / Anda beli"
diberi subjudul rupiah yang diterima/dibayar; (5) pesan WhatsApp dibuat seperti kabar kurs, bukan surat.
