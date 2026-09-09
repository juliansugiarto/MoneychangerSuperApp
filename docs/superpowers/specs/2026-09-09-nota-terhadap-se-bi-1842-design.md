# Paket K3 — Nota terhadap SE BI 18/42/DKSP

**Dikerjakan 9 September 2026.** Naskahnya diberikan pengguna (`SE_184216.pdf`) dan dibaca hari itu
juga; naskahnya **tidak** disalin ke repo.

**Dasar hukumnya bukan SE 18/41/DKSP**, sebagaimana tertulis pada ROADMAP sejak 4 September. Naskah
18/41 sempat diberikan lebih dulu dan ternyata mengatur Penyelenggaraan Pemrosesan Transaksi
Pembayaran — nol kemunculan `KUPVA`. Yang benar adalah **SE BI No. 18/42/DKSP tentang Kegiatan Usaha
Penukaran Valuta Asing Bukan Bank** (30 Desember 2016), pelaksana PBI 18/20/PBI/2016 — peraturan
yang sudah dikutip nota sebagai *disclaimer* sejak dahulu.

---

## Yang diminta SE

**Huruf G angka 1.** Berada di bawah bagian **perlindungan konsumen**, bukan pelaporan. Ukurannya
karena itu adalah apa yang dapat dibaca Nasabah pada kertasnya, bukan apa yang tersimpan di basis
data.

> Penyelenggara harus memberikan bukti transaksi, tanda terima, atau slip transaksi kepada Nasabah
> yang **paling sedikit** memuat informasi:
> a. nama dan alamat Penyelenggara; b. tanggal transaksi; c. nomor serial bukti transaksi;
> d. jumlah nominal dan jenis mata uang yang dibayarkan **oleh** Nasabah; e. jumlah nominal dan jenis
> mata uang yang dibayarkan **kepada** Nasabah; f. kurs atau nilai tukar; dan g. nama dan tanda
> tangan Penyelenggara dan Nasabah.

*"Paling sedikit"* — daftar ini lantai, bukan langit-langit. Field lain boleh dan memang ada.

## Pembandingan berdampingan

| | Diminta SE | Keadaan sebelum paket ini | Vonis |
|---|---|---|---|
| a | Nama dan alamat Penyelenggara | `legalEntityName`, `address`, ditambah kode KUPVA, nomor izin, telepon, logo | **Sudah** — melebihi |
| b | Tanggal transaksi | `transactionAt` diformat `id-ID` | **Sudah** (lihat Risiko residual 1) |
| c | Nomor serial bukti transaksi | `receiptNumber` | **Sudah** |
| d | Nominal + mata uang dibayarkan **oleh** Nasabah | Nominalnya tercetak; **arahnya tersirat** dari kode `BNB`/`BNS` | **Kurang** — diperbaiki |
| e | Nominal + mata uang dibayarkan **kepada** Nasabah | Sama | **Kurang** — diperbaiki |
| f | Kurs | Kolom `Kurs` per baris mata uang | **Sudah** |
| g | Nama dan tanda tangan Penyelenggara dan Nasabah | Nama badan hukum, nama Teller, blok tanda tangan kedua pihak | **Sudah** |

**Lima dari tujuh sudah terpenuhi sebelum paket ini.** Nota memang sudah pernah diperbaiki sekali
untuk temuan pemeriksaan 4, dan perbaikan itu menutup huruf a dan g.

## Satu kekurangan, dan mengapa ia benar-benar kekurangan

Huruf d dan e menuntut **dua informasi yang berbeda**: yang dibayarkan *oleh* Nasabah, dan yang
dibayarkan *kepada* Nasabah. Kedua nominalnya memang selalu tercetak — sisi valuta asing pada tabel,
sisi Rupiah pada Jumlah Total. Yang tidak tercetak adalah **arahnya**.

Sebelum paket ini, arah itu hanya dapat disimpulkan dari kode `BNB`/`BNS` dan subtitle berbahasa
Inggris *PURCHASE RECEIPT* / *SALES RECEIPT*. Menyimpulkan bukan membaca, dan kewajiban ini berdiri
di bagian perlindungan konsumen: Nasabah tidak dapat diminta mengetahui bahwa `BNB` berarti
pembelian.

Godaan untuk menyebut ini "sudah sesuai, angkanya kan ada" harus ditolak. Temuan pemeriksaan 4
berbunyi *nota belum memenuhi standar* — persis kelas kekurangan seperti ini.

## Yang dikerjakan

Penambahan **label**, tanpa aritmetika baru dan tanpa mengubah satu pun angka:

- Baris keterangan di atas tabel valuta: *"Valuta asing — dibayarkan **kepada**/**oleh** Nasabah"*.
- Baris total menjadi *"Jumlah Total (Rupiah) — dibayarkan **oleh**/**kepada** Nasabah"*.

Keduanya berlawanan arah dan diturunkan dari `isSell` yang sudah ada. Pada pembelian (`BNB`) valuta
asing datang **dari** Nasabah dan Rupiah mengalir **kepada**-nya; pada penjualan (`BNS`) sebaliknya.

Menghitung ulang jumlah per mata uang sengaja **tidak** dilakukan: nominalnya sudah tercetak, dan
menjumlahkan uang di lapisan tampilan adalah tempat paling buruk untuk membuat kesalahan
pembulatan.

Penjaganya `server/notaSeBi1842.test.ts`, delapan uji, satu per huruf ditambah dua: satu memastikan
kedua arahnya berlawanan, satu lagi memastikan field yang **melebihi** daftar SE tidak ikut terbuang
ketika seseorang kelak "merapikan nota agar sesuai SE".

## Yang sengaja tidak dikerjakan

- **Dua kewajiban lain pada huruf G tidak disentuh** — menyediakan uang layak beserta pecahan sesuai
  kebutuhan (angka 2), dan memberikan informasi ciri keaslian uang lewat pengumuman/brosur/leaflet
  (angka 3). Keduanya kewajiban **operasional gerai**, bukan perangkat lunak.
- **Pengumuman tata cara pengaduan Nasabah** (huruf F angka 5, di gedung kantor dan/atau website)
  juga di luar aplikasi ini.
- **Sisa SE 18/42 belum dibaca terhadap kode.** Paket ini menjawab satu pertanyaan yang sudah
  dirumuskan ROADMAP — daftar field nota — bukan seluruh surat edarannya.

## Risiko residual

1. **Tanggal nota memakai zona waktu peramban.** `toLocaleDateString("id-ID")` diformat di mesin
   yang mencetak, sementara `transactionAt` disimpan UTC. Di Jakarta hasilnya benar; pada peramban
   berzona lain, transaksi menjelang tengah malam WIB dapat tercetak mundur satu hari — dan tanggal
   adalah field wajib huruf b. Proyek ini sudah punya zona operasionalnya sendiri
   (`startOfOperationalDay`); nota belum memakainya.
2. **Uji penjaganya membaca sumber, bukan hasil cetak.** Ia membuktikan kalimatnya ada di kode,
   bukan bahwa ia muncul di kertas. Sama seperti `notaKupvaIdentity.test.ts`, dan keterbatasan yang
   sama.
3. **Sisa SE 18/42 dan sisa PBI 18/20 belum dibandingkan.** Lihat pula
   `2026-09-09-pbi-10-2024-temuan-awal.md`: empat temuan APU/PPT/PPPSPM yang masih terbuka.
