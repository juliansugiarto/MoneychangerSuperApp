# Laporan Riset Aplikasi Money Changer Indonesia

**Untuk:** PT IBU KOTA VALASINDO  
**Disusun oleh:** Manus AI  
**Tanggal:** 13 Agustus 2026

## Ringkasan eksekutif

Riset terhadap lima situs money changer Indonesia—Dolarasia, SmartDeal, VIP Money Changer, Central Kuta Money Exchange, dan Sahabat Valas—menunjukkan bahwa pengalaman digital yang paling konsisten bukanlah checkout penukaran valas otomatis. Polanya adalah **kurs dan kalkulator untuk orientasi**, diikuti **konfirmasi manusia melalui cabang atau kanal resmi** sebelum transaksi dijalankan. [1] [2] [3] [4] [5] Pendekatan tersebut memprioritaskan kejelasan harga, ketersediaan uang fisik, validasi identitas bila perlu, dan perlindungan terhadap penipuan. Dalam konteks aplikasi Ibukota Valasindo, fondasi operasional yang lebih kompleks—kurs dengan approval, transaksi, nasabah, stock opname, pengaduan, laporan, dan audit—sudah tersedia. Karena itu, langkah yang paling bernilai bukan membuat ulang dashboard atau checkout pelanggan, melainkan menambah lapisan publik yang sederhana: **kalkulator indikatif** serta **kanal resmi yang dapat diverifikasi**. Tahap berikutnya dapat berupa **permintaan layanan terbatas** yang masuk ke antrian petugas, bukan transaksi jadi. Semua rancangan perlu dikonfirmasi oleh PIC kepatuhan dan operasional karena ringkasan PBI KUPVA BB menekankan transparansi kurs, perlindungan data, pengaduan efektif, serta kebijakan dan pencatatan penetapan kurs. [6]

> **Kesimpulan utama:** Bangun pengalaman digital sebagai jembatan yang aman dari estimasi menuju pelayanan outlet, bukan sebagai pengganti proses operasional, pemeriksaan, atau persetujuan yang sudah ada.

## Metode dan batas penelitian

Penelitian dilakukan melalui peninjauan sumber primer publik pada 13 Agustus 2026. Tinjauan mencakup halaman kurs, kalkulator, cara pemesanan, layanan pengantaran, cabang, informasi anti-penipuan, dan halaman legal bila tersedia. Dua aplikasi valas bank, BNI FX Mobile dan Jenius, digunakan sebagai **pembanding pola aplikasi digital**, bukan sebagai kompetitor KUPVA langsung, karena keduanya memiliki model izin, rekening, settlement, dan pengendalian risiko yang berbeda. [7] [8]

| Kelompok pembanding | Fokus yang diamati | Posisi dalam rekomendasi |
| --- | --- | --- |
| Money changer Indonesia | Kurs beli/jual, timestamp, kalkulator, konfirmasi cabang, kanal resmi, lokasi, edukasi, dan layanan bersyarat. | Sumber utama untuk pola pengalaman pelanggan KUPVA. |
| Aplikasi valas bank | Konfirmasi tindakan, status, notifikasi, dan histori. | Sumber sekunder untuk pola desain status; tidak untuk meniru settlement atau transaksi mandiri. |
| Bank Indonesia | Transparansi kurs, prosedur penetapan, perlindungan data, dan penanganan pengaduan. | Pagar desain dan tata kelola, bukan opini desain. |

Penelitian ini tidak menguji API, keamanan sistem pesaing, performa aplikasi mobile, biaya layanan, atau kepatuhan operasional mereka. Ketiadaan aplikasi native KUPVA yang terverifikasi dalam sampel tidak berarti tidak ada di pasar; kesimpulan hanya dibatasi pada sumber yang dapat diverifikasi dalam penelitian ini.

## Apa yang dilakukan pemain lain dengan baik

Para penyedia yang ditinjau sangat konsisten dalam menampilkan **kurs sebagai informasi keputusan, bukan janji transaksi**. SmartDeal menampilkan kalkulator dan kurs yang diberi penanda pembaruan serta catatan perlunya konfirmasi; VIP dan Sahabat Valas menampilkan waktu kurs dan peringatan bahwa nilai dapat berubah; Central Kuta juga menggunakan converter dan catatan untuk mengarahkan pelanggan kembali ke outlet bila perlu. [1] [3] [4] [5] Ini adalah praktik positif karena pelanggan mendapat gambaran nilai tanpa terjadi salah pengertian mengenai penguncian kurs.

Kepercayaan dibangun melalui rincian konkret, bukan sekadar klaim “terpercaya”. Dolarasia menggabungkan pernyataan otorisasi, pencarian cabang, kanal bantuan, artikel anti-penipuan, dan layanan yang diberi syarat eksplisit. [2] VIP dan Sahabat Valas secara tegas menyebut kanal pembayaran atau WhatsApp resmi. [3] [5] Pola tersebut relevan karena modus penipuan sering terjadi tepat pada titik kontak dan pembayaran, sehingga informasi resmi harus tampil dekat dengan tindakan pelanggan.

Layanan yang lebih kompleks juga dijelaskan dengan batas yang nyata. Halaman pengantaran Dolarasia menyebut ambang transaksi, area layanan, batas waktu pemesanan, dan identitas kurir terverifikasi; prosesnya tetap meminta konfirmasi kurs dan identitas, bukan menawarkan delivery tanpa syarat. [2] Ini menunjukkan bahwa digitalisasi yang baik tidak menyembunyikan keterbatasan operasional, melainkan membuatnya mudah dipahami sebelum pelanggan berharap terlalu jauh.

| Praktik positif | Contoh dalam sampel | Alasan berguna untuk pelanggan |
| --- | --- | --- |
| Kurs beli/jual dengan waktu pembaruan dan unit | SmartDeal, VIP, Central Kuta, Sahabat Valas. [1] [3] [4] [5] | Memudahkan perbandingan dan memperjelas kapan informasi terakhir berlaku. |
| Kalkulator/konverter indikatif | SmartDeal dan Central Kuta. [1] [4] | Mengurangi pertanyaan sederhana tanpa mengikat kurs sebelum petugas mengonfirmasi. |
| Konfirmasi manusia dan jalur cabang | SmartDeal dan Dolarasia. [1] [2] | Menangani perubahan kurs, ketersediaan banknote, dan dokumen secara terkendali. |
| Kanal resmi dan anti-penipuan spesifik | SmartDeal, VIP, Sahabat Valas. [1] [3] [5] | Mengurangi risiko pelanggan menghubungi nomor/rekening yang salah. |
| Syarat layanan yang eksplisit | Dolarasia. [2] | Mengelola ekspektasi terkait area, cutoff, nominal, dan keamanan pengantaran. |
| Status, konfirmasi, serta histori | BNI FX Mobile dan Jenius, sebagai pembanding bank. [7] [8] | Menurunkan ketidakpastian dalam perjalanan layanan dan memudahkan penelusuran. |

## Kesenjangan yang relevan di Ibukota Valasindo

Beranda proyek saat ini sudah berada pada arah yang tepat: ia menampilkan kurs operasional aktif, unit kuotasi, waktu efektif, dan pernyataan bahwa kurs/ketersediaan dikonfirmasi oleh outlet. Sisi internal juga sudah memiliki kontrol kurs berbasis referensi BI, proposal/aktivasi, audit, transaksi, nasabah, pengaduan, stock opname, laporan, serta manajemen pengguna. Dengan fondasi tersebut, menyalin tabel kurs atau dashboard kompetitor secara terpisah akan menciptakan sumber data ganda dan meningkatkan risiko inkonsistensi.

Kesenjangan utama bukan pada pencatatan transaksi, tetapi pada pengalaman **sebelum** pelanggan datang ke outlet. Saat ini pelanggan dapat melihat kurs, namun belum memiliki kalkulator indikatif, titik kontak publik yang dirancang sebagai kanal resmi, FAQ anti-penipuan yang eksplisit, atau cara mengirim minat layanan secara terbatas dan dapat ditangani petugas. Keempat titik itu dapat menambah nilai tanpa menduplikasi sistem back-office.

| Area | Kondisi proyek saat ini | Rekomendasi | Mengapa tidak redundan |
| --- | --- | --- | --- |
| Kurs publik | Kurs aktif dan disclaimer sudah tampil. | Tambahkan label freshness/sumber yang lebih jelas pada komponen yang sama; jangan buat tabel master baru. | Memperkuat transparansi tanpa menyalin data kurs. |
| Estimasi nilai | Belum ada. | Tambahkan kalkulator indikatif read-only. | Mengonsumsi `activeRates`; tidak menyimpan transaksi atau data nasabah. |
| Kontak dan trust | Alamat/kontak tampil sebagai teks; CTA publik berfokus pada informasi dan akses staf. | Tambahkan blok kanal resmi, jam layanan, peta, dan peringatan anti-penipuan yang disetujui perusahaan. | Menambah lapisan komunikasi pelanggan, bukan fungsi operasional yang sudah ada. |
| Permintaan calon pelanggan | Belum ada. | Buat antrian permintaan layanan ringan yang ditangani staf. | Terpisah dari transaksi final, KYC, dan ledger. |
| Pengaduan | Modul internal sudah tersedia. | Tampilkan tautan publik yang terarah ke prosedur pengaduan resmi bila kebijakan menyetujui. | Memanfaatkan proses yang ada alih-alih membangun sistem pengaduan lain. |

## Rekomendasi prioritas

### Prioritas 1 — Kalkulator kurs indikatif dan pusat kanal resmi

Kalkulator sebaiknya tampil di bawah/di dekat kurs aktif dengan input mata uang, arah **beli** atau **jual**, nominal, unit kuotasi, dan hasil estimasi Rupiah. Hasil harus menampilkan waktu kurs efektif dan peringatan tetap bahwa harga serta ketersediaan akan dikonfirmasi outlet. Kalkulator tidak perlu meminta nama, nomor telepon, KTP, atau membuat transaksi. Dengan batas ini, fitur meniru manfaat SmartDeal/Central Kuta tanpa menggeser kontrol transaksi ke publik. [1] [4]

Pada halaman yang sama, tambahkan pusat kanal resmi: alamat outlet, jam layanan, tautan peta, telepon/WhatsApp yang dapat ditekan, dan peringatan bahwa perusahaan hanya berkomunikasi melalui kanal yang ditetapkan. Konten rekening atau prosedur pembayaran hanya boleh dipublikasikan setelah disetujui pejabat berwenang dan ditinjau berkala. Praktik ini mengambil kejelasan dari VIP dan Sahabat Valas tanpa mengklaim bentuk layanan yang belum disiapkan. [3] [5]

### Prioritas 2 — Permintaan layanan terkontrol, bukan checkout

Setelah kanal resmi dan kalkulator stabil, tambahkan tombol **“Minta konfirmasi kurs & ketersediaan”**. Formulirnya cukup meminta mata uang, arah beli/jual, kisaran nominal, preferensi waktu, kanal kontak pilihan, dan persetujuan untuk dihubungi. Jangan meminta foto identitas, nomor KTP, sumber dana, atau data KYC lengkap pada titik ini. Petugas kemudian memverifikasi ketersediaan dan aturan yang berlaku, lalu memasukkan/menghubungkan transaksi formal di area operasional.

State permintaan harus jelas dan dibatasi masa berlaku: `BARU`, `MENUNGGU_VERIFIKASI`, `KURS_DIKONFIRMASI`, `SIAP_DILAYANI`, `KEDALUWARSA`, atau `DIBATALKAN`. Status `KURS_DIKONFIRMASI` memerlukan waktu kedaluwarsa dan identitas petugas; ia bukan transaksi selesai dan tidak boleh secara otomatis mengubah kas, stock, atau ledger. Pola ini mengadopsi manfaat status dan histori dari aplikasi bank secara proporsional, sambil menjaga pemisahan transaksi KUPVA yang sudah ada. [7] [8]

### Prioritas 3 — FAQ kepatuhan dan pengumuman operasional yang disetujui

Buat halaman FAQ singkat yang menjawab cara membaca kurs, alasan kurs bisa berubah, cara memverifikasi kanal resmi, dokumen yang mungkin diminta, jam layanan, dan prosedur pengaduan. Tambahkan area pengumuman untuk perubahan jam operasional atau informasi layanan yang telah disetujui. Dolarasia dan Central Kuta memperlihatkan nilai dari edukasi/tips dan pengumuman, tetapi konten Ibukota Valasindo harus ditulis ulang dari SOP serta diperiksa PIC kepatuhan; jangan menyalin klaim maupun teks pihak lain. [2] [4]

| Urutan | Inisiatif | Hasil pengguna | Prasyarat persetujuan |
| --- | --- | --- | --- |
| 1 | Kalkulator indikatif dan disclosure kurs | Pelanggan memahami perkiraan nilai tanpa salah mengira kurs terkunci. | Narasi disclaimer, pembulatan, dan sumber kurs disetujui. |
| 1 | Kanal resmi dan informasi outlet | Pelanggan mudah memverifikasi kontak/lokasi yang benar. | Kontak, jam, peta, serta teks anti-penipuan resmi disahkan. |
| 2 | Permintaan konfirmasi kurs/ketersediaan | Permintaan pelanggan tercatat dan petugas dapat merespons dengan status yang jelas. | SOP follow-up, waktu respons, consent kontak, dan otorisasi staf. |
| 3 | FAQ dan pengumuman publik | Pertanyaan rutin berkurang dan pelanggan mendapat informasi konsisten. | Kepemilikan konten serta alur review kepatuhan. |

## Yang sebaiknya **tidak** dibangun saat ini

Tidak disarankan membangun checkout valas mandiri, tombol “bayar sekarang”, penguncian kurs otomatis tanpa verifikasi staf, upload KYC lengkap pada halaman publik, pengantaran/reservasi stok, atau aplikasi native pelanggan. Tidak satu pun diperlukan untuk memvalidasi pengalaman awal, dan masing-masing menambah risiko settlement, ketersediaan banknote, perlindungan data, fraud, serta rekonsiliasi. Layanan pengantaran hanya layak dievaluasi setelah SOP, cakupan wilayah, ketentuan nominal, keselamatan kurir, alokasi stok, pembatalan, dan kontrol persetujuan telah ditetapkan secara tertulis—sejalan dengan pelajaran transparansi bersyarat dari Dolarasia. [2]

Aplikasi native juga belum perlu. Beranda responsif dengan kalkulator dan permintaan layanan akan menguji kebutuhan pelanggan dengan biaya dan risiko lebih rendah. Jika volume penggunaan kemudian membuktikan kebutuhan notifikasi atau akses berulang, PWA dapat dievaluasi sebelum membuat aplikasi Android/iOS penuh.

## Pagar tata kelola dan indikator keberhasilan

PBI KUPVA BB yang dirujuk Bank Indonesia merangkum kewajiban untuk memiliki kebijakan/prosedur penetapan kurs, menggunakan dasar yang dapat dipertanggungjawabkan secara konsisten, membuat catatan penetapan kurs, menyampaikan informasi kurs secara transparan, melindungi data/informasi nasabah, dan menangani pengaduan secara efektif. [6] Rekomendasi ini dirancang agar selaras dengan prinsip tersebut, tetapi bukan opini hukum. Ketentuan internal, ambang transaksi, retensi data, teks disclosure, serta proses KYC/EDD perlu ditetapkan atau divalidasi oleh PIC kepatuhan dan penasihat yang berwenang sebelum implementasi produksi.

| Indikator | Definisi yang disarankan | Tujuan pengukuran |
| --- | --- | --- |
| Kejelasan kurs | Proporsi sesi kalkulator yang melihat disclaimer dan waktu efektif kurs. | Menguji apakah informasi penting terbaca sebelum pelanggan menghubungi outlet. |
| Konversi layanan | Rasio permintaan terverifikasi terhadap permintaan baru. | Mengukur kualitas calon pelanggan, bukan sekadar jumlah form masuk. |
| Respons petugas | Median waktu dari `BARU` hingga `KURS_DIKONFIRMASI` atau `DIBATALKAN`. | Menjaga pengalaman pelanggan dan beban tim tetap terkendali. |
| Ketepatan operasional | Jumlah permintaan yang harus dibatalkan karena kurs/ketersediaan tidak sesuai. | Menilai kualitas sinkronisasi informasi publik dan kapasitas outlet. |
| Keamanan kanal | Jumlah laporan terkait kontak/rekening palsu serta penyelesaiannya. | Mengukur efektivitas pusat kanal resmi dan edukasi anti-penipuan. |

## Keputusan yang diminta

Mohon konfirmasi dua keputusan sebelum kode fitur pelanggan ditambahkan. Pertama, setujui atau koreksi daftar kontak, jam operasional, alamat/peta, dan pernyataan anti-penipuan yang dapat dipublikasikan. Kedua, putuskan apakah fase berikutnya dibatasi pada **kalkulator + kanal resmi**, atau juga mencakup **permintaan konfirmasi kurs & ketersediaan** dengan SOP respons petugas. Setelah itu, implementasi dapat dirancang agar tetap memakai sumber kurs aktif dan kontrol operasional yang sudah ada.

## Referensi

[1]: https://smartdeal.co.id/ "SmartDeal Money Changer — beranda"
[2]: https://dolarasia.com/ "Dolarasia — beranda dan layanan pengiriman"
[3]: https://www.vip.co.id/ "VIP Money Changer — beranda"
[4]: https://www.centralkutabali.com/ "Central Kuta Money Exchange — beranda"
[5]: https://sahabatvalas.com/ "PT Sahabat Valas — beranda"
[6]: https://www.bi.go.id/id/publikasi/peraturan/Pages/pbi_182016.aspx "PBI 18/20/PBI/2016 — Kegiatan Usaha Penukaran Valuta Asing Bukan Bank"
[7]: https://www.bni.co.id/id-id/individu/lainnya/jasa-jasa/fx-mobile "BNI FX Mobile"
[8]: https://www.jenius.com/app/kartu/mata-uang-asing "Jenius — Mata Uang Asing"
