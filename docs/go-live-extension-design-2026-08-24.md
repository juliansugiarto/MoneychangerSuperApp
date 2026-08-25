# Desain Ekstensi Go-Live

## Prinsip kerja

Fitur tambahan memakai data operasional yang sudah ada dan tidak membuat jalur data paralel yang sulit diaudit. Penyiapan hari pertama mengarahkan pengguna ke pencatatan kas pembukaan dan proposal kurs awal yang telah ada. Akun produksi memakai mekanisme akun internal yang sudah mewajibkan penggantian kata sandi saat login pertama. Tidak ada kredensial atau data nasabah nyata yang dimasukkan ke mode simulasi.

| Kebutuhan | Rancangan | Perlindungan utama |
|---|---|---|
| Saldo dan kurs hari pertama | Wizard Controller untuk meninjau kas pembukaan, kurs aktif, dan langkah yang belum selesai. | Wizard hanya mengarahkan ke tindakan berwenang; pencatatan tetap diaudit oleh layanan kas dan kurs. |
| Akun produksi | Daftar kesiapan peran serta pintasan ke halaman Akses Staf. | Controller/Shareholder tetap hanya dapat mendelegasikan Admin dan Staff; peran tata kelola tidak dapat dibuat dari delegasi biasa. |
| Simulasi | Kalkulator bon dan penutupan yang hanya menghitung di browser/backend tanpa menulis record database. | Semua keluaran diberi tanda **SIMULASI — TIDAK MASUK LAPORAN** dan tidak memiliki nomor bon resmi. |
| Arsip PDF | Laporan dan bon menggunakan dialog cetak browser dengan instruksi “Simpan sebagai PDF”. | Data yang dicetak berasal dari query berotorisasi dan filter periode yang terlihat; tidak ada file PDF palsu atau data contoh. |
| Selisih kurs | Dashboard membandingkan midpoint per satu unit valuta agar perbedaan basis kuotasi, termasuk JPY per 100, tidak menyesatkan. | BI, JISDOR, dan pasar tetap diberi label sumber/waktu; tidak ada nilai referensi yang mengaktifkan kurs outlet otomatis. |

## Use case utama

1. Controller membuka **Mulai Go-Live**, memastikan akun workforce tersedia, lalu membuka kas dan kurs untuk mempersiapkan hari pertama.
2. Kasir memakai **Simulasi Aman** saat pelatihan, menghitung nominal tanpa membuat bon, saldo kas, antrean review, atau laporan.
3. Controller membuka **Bandingkan Kurs** untuk membaca selisih kurs outlet terhadap referensi per valuta dan menelusuri waktu observasi sebelum membuat proposal perubahan kurs.
4. Controller memilih periode laporan lalu memakai **Ekspor PDF / cetak**. Dialog sistem operasi digunakan untuk printer fisik atau “Save as PDF”, sehingga arsip memiliki data dan periode yang tampak di halaman.

## Catatan verifikasi

Pembaruan komponen server menyebabkan sesi uji pengembangan berakhir sebagaimana desain sesi internal. Verifikasi antarmuka halaman perbandingan kurs akan dilanjutkan memakai akun uji setelah autentikasi ulang; tidak ada tindakan yang dilakukan terhadap akun produksi.

Setelah autentikasi ulang Controller pada 24 Agustus 2026, dashboard selisih kurs berhasil menampilkan tujuh kurs outlet aktif dibanding midpoint BI. Untuk USD, tabel juga menampilkan observasi JISDOR Rp17.703,000000 dan selisih outlet terhadap JISDOR sebesar +1,01%. Untuk JPY, midpoint BI dinormalisasi dari kuotasi per 100 menjadi nilai per satu unit sebelum selisih dihitung, sehingga hasil +0,66% dapat dibaca secara sebanding.

Mode Simulasi Aman juga diuji memakai nominal valuta 100, kurs 17.700, dan unit kuotasi 1. Sistem menghasilkan Rp1.770.000,00 serta menyediakan pilihan Simpan PDF / cetak latihan. Halaman secara jelas menandai hasil sebagai simulasi dan tidak menampilkan nomor bon, data nasabah, atau tindakan yang menulis saldo kas.

Wizard Mulai Go-Live berhasil menampilkan empat langkah terpisah untuk akun tim, kas pembukaan, kurs outlet, dan checklist. Setiap langkah mengarahkan pengguna ke halaman tindakan yang telah memiliki audit trail, bukan melakukan perubahan otomatis. Halaman Laporan juga berhasil menampilkan tombol **Ekspor PDF / cetak**, instruksi memilih “Simpan sebagai PDF” atau printer fisik, serta rekap transaksi dan stock opname sesuai rentang yang dipilih.

Regresi penuh setelah implementasi selesai pada 24 Agustus 2026: **29 berkas pengujian dan 104 pengujian lulus**, disertai pemeriksaan TypeScript tanpa kesalahan. Cakupan baru meliputi perhitungan simulasi tanpa penulisan data, normalisasi midpoint JPY per 100, selisih persentase kurs, dan pendaftaran semua rute sidebar berdasarkan peran.

Pembaruan endpoint provisioning memutar ulang sesi pengembangan, sehingga halaman bon kembali meminta autentikasi akun uji. Perilaku ini sesuai dengan kontrol sesi internal dan tidak berkaitan dengan data bon atau saldo kas.

Autentikasi ulang menggunakan akun Controller khusus pengembangan berhasil dilakukan sebelum pemeriksaan akhir arsip bon. Tidak ada pembuatan akun, transaksi, atau perubahan saldo selama sesi verifikasi ini.

Halaman Bon Transaksi berhasil menampilkan panduan langkah ketiga “Simpan, arsip, kirim” beserta instruksi bahwa ikon printer membuka arsip bon operasional untuk Simpan sebagai PDF atau cetak fisik. Daftar bon nyata pada lingkungan uji tetap terpisah dari Simulasi Aman dan menampilkan tombol ikon printer untuk setiap bon.

Regresi akhir setelah melengkapi provisioning dan arsip menghasilkan **30 berkas pengujian dan 107 pengujian lulus**, dengan pemeriksaan TypeScript tanpa kesalahan. Pengujian baru membuktikan bahwa hanya Shareholder dapat membuat Controller, serta kontrol ekspor arsip tersedia pada laporan/stock opname dan bon produksi tetap terpisah dari hasil simulasi.

Arsip PDF penutupan outlet kini tersedia pada kartu checklist penutupan setelah seluruh item ditandai lengkap dan status penutupan telah tersimpan. Arsip memuat checklist, stock opname, saldo sistem, hitung fisik, varians, status rekonsiliasi, catatan operasional, serta kolom tanda tangan. Regresi final setelah penambahan ini menghasilkan **30 berkas pengujian dan 109 pengujian lulus**, disertai pemeriksaan TypeScript tanpa kesalahan. Pengujian simulasi memanggil route Staff tanpa akses database dan memastikan keluaran tidak memiliki nomor bon maupun ID produksi.

Uji integrasi isolasi simulasi kemudian menjalankan route simulasi, membaca daftar bon Staff serta laporan transaksi produksi melalui query baca yang sama, dan membuktikan hanya catatan produksi awal yang tetap ada. Tidak ada `isSimulation`, nomor bon baru, maupun ID produksi yang muncul pada daftar atau laporan. Regresi penuh terakhir menghasilkan **30 berkas pengujian dan 110 pengujian lulus**, dengan pemeriksaan TypeScript tanpa kesalahan.

Uji arsip cetak juga membuat keluaran bon produksi setelah route simulasi dipanggil. Dokumen memuat nomor bon dan nominal produksi yang diharapkan, serta tidak memuat nominal hasil simulasi maupun penanda `isSimulation`. Regresi penuh terakhir menghasilkan **30 berkas pengujian dan 111 pengujian lulus**, disertai pemeriksaan TypeScript tanpa kesalahan.
