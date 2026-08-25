# Arsitektur Pengalaman Baru IBV

## Arah Desain

Pembangunan ulang menempatkan **transparansi kurs** sebagai elemen utama front office dan **pengambilan tindakan operasional** sebagai elemen utama back office. Sistem visual menggunakan pasangan navy tinta, putih hangat, abu kebiruan, dan aksen hijau-lime terbatas. Kontras dan spacing digunakan untuk membedakan informasi publik, keputusan penting, dan status proses tanpa mengandalkan dekorasi berlebih.

> Prinsip UX yang digunakan: detail yang tidak mengganggu namun konsisten, motion yang disengaja, dan komponen yang memberi respons langsung pada tindakan pengguna.[1]

| Permukaan | Struktur utama | Keputusan UX |
| --- | --- | --- |
| Front office | Header ringkas, ringkasan kurs, **tabel seluruh kurs aktif**, estimator, permintaan layanan, lokasi, FAQ. | Tabel tidak disembunyikan di balik filter, tab, atau CTA. Seluruh mata uang aktif ditampilkan berurutan dan menyertakan kurs beli, kurs jual, unit kutip, serta waktu efektif. |
| Back office | Sidebar berkelompok, bar konteks, ringkasan hari ini, kartu tindakan cepat, worklist, kontrol kas/stok, dan status risiko. | Mengadopsi pola kerja SIPUKA—memprioritaskan daftar tindakan dan status—tanpa meniru tampilan, merek, data, ataupun kode SIPUKA. |
| Motion | Transisi panel dan feedback tombol. | Hanya `transform` dan `opacity`, durasi 160–240 ms, easing responsif, tombol dengan press feedback, serta menghormati `prefers-reduced-motion`.[1] |
| Navigasi | Rute publik tetap ringkas; menu back office dikelompokkan sebagai Ringkasan, Transaksi, Data & Persediaan, dan Pengawasan. | Peran menentukan visibilitas menu; rute tetap melakukan pemeriksaan akses di shell dan backend. |

## Kontrak Transparansi Kurs

Tabel kurs menggunakan prosedur publik `rates.activeRates`, bukan data contoh. Ketika data sedang dimuat, area tabel menunjukkan skeleton; ketika respons gagal, pengunjung melihat pemberitahuan dan tombol coba lagi; ketika tidak ada kurs aktif, halaman menampilkan status eksplisit. Estimator dan formulir permintaan hanya muncul sebagai pelengkap setelah tabel, sehingga tidak pernah menggantikan pengungkapan kurs.

## Kontrak Back Office

Home back office menggunakan `dashboard.overview` yang telah dilindungi. Kartu ringkasan, antrian review, saldo kas, variance opname, dan daftar transaksi hari ini hanya berasal dari respons tersebut. Setiap tindakan tetap menggunakan mutation yang ada dan menampilkan keadaan pending/error. Tidak ada modul cabang, impor, regulator, atau angka performa baru yang direkayasa.

## Verifikasi Visual

Pemeriksaan desktop memperlihatkan hierarki yang menempatkan tabel seluruh kurs di depan estimator dan formulir layanan. Kurs dapat dibaca per mata uang, kurs beli/jual, unit, serta waktu efektif. Pemeriksaan pada lebar 375 px mempertahankan seluruh tabel melalui kontainer yang dapat digeser horizontal; tidak ada mata uang yang dihilangkan pada breakpoint kecil. Area estimator, kontak, lokasi, FAQ, dan footer tetap mengalir dalam satu kolom tanpa elemen terpotong.

Pemeriksaan akhir desktop mengonfirmasi estimator menggunakan palet navy yang sama dengan hero, outlet, dan back office. Rute `/operasional` tanpa sesi menampilkan gerbang akses dengan pesan terbatas, tombol masuk, dan tanpa paparan data internal. Isi konsol, worklist, serta navigasi berkelompok bergantung pada sesi peran yang sah dan telah dilindungi pada komponen layout.

## Referensi

[1]: ./emilkowalski-ux-principles.md "Prinsip UX emil-design-eng untuk Redesign IBV"
