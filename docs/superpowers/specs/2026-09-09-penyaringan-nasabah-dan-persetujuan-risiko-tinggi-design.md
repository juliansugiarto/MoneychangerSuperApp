# Paket L — Jejak penyaringan nasabah dan persetujuan nasabah berisiko tinggi

**Dirancang 9 September 2026.** Menutup Temuan 1 dan 2 pada
`2026-09-09-pbi-10-2024-temuan-awal.md`. Dasarnya **PBI No. 10 Tahun 2024**, peraturan APU, PPT, dan
PPPSPM yang berlaku dan menyebut KUPVA lima kali.

Paket ini **menambahkan tindakan memblokir untuk pertama kalinya** ke dalam aplikasi yang selama ini
sengaja tidak pernah memblokir apa pun. Itu keputusan sadar pengguna, bukan konsekuensi yang
kebetulan; alasannya ditulis di bawah supaya sesi berikutnya tidak "memperbaikinya".

---

## Masalah

### 1. Tidak ada bukti bahwa nasabah pernah disaring

**Pasal 47 ayat (1) huruf c** mewajibkan pengecekan kesamaan nama calon Pengguna Jasa dan Pengguna
Jasa terhadap DTTOT dan DPPSPM. **Huruf b** mewajibkan daftarnya ditatausahakan dan **dikinikan**.

Yang ada pada `customers` hanyalah `dttotPpsdmMatch` (boolean) dan `dttotPpsdmNotes`: **hasil** yang
dicentang manusia, bukan **jejak** bahwa pengecekannya dilakukan. Halaman Cek Watchlist adalah alat
bantu yang tidak menulis apa pun ke profil nasabah.

Akibatnya nasabah yang tidak pernah dicek dan nasabah yang dicek lalu bersih **terlihat identik**
di basis data. Pemeriksa yang meminta bukti penyaringan tidak akan mendapat jawaban.

Asimetri yang membuat ini janggal: `employees` dan `employee_candidates` **punya** jejaknya —
`screenedAt`, `watchlistCheckedAt`, `watchlistMatchCount`, `watchlistSummary`. Aplikasi ini dapat
membuktikan telah menyaring pelamar kerja, tetapi tidak dapat membuktikan telah menyaring nasabah,
padahal kewajiban Pasal 47 justru tentang nasabah.

### 2. `riskLevel = HIGH` tidak memutuskan apa pun

**Pasal 32 ayat (5)** mewajibkan penunjukan Manajemen Senior yang bertanggung jawab atas hubungan
usaha dengan nasabah berisiko tinggi, dan **ayat (6)** menuntut Manajemen Senior itu **memberikan
persetujuan atau penolakan**, serta **memutuskan meneruskan atau menghentikan** hubungan usaha.

Hari ini `customers.riskLevel = "HIGH"` hanya sebuah nilai kolom. Ia memunculkan alasan pemantauan
`RISIKO_NASABAH_TINGGI` (`server/operations.ts:308`) dan menandai profil tidak sesuai — tetapi tidak
ada alur menyetujui atau menolak, tidak ada catatan siapa yang memutuskan, dan tidak ada yang
menghalangi hubungan usaha berjalan tanpa keputusan itu.

`director_acknowledgements` **tidak dapat dipakai ulang.** Komentar di atasnya menyatakan maksudnya
sendiri: *"A Director knowledge task is distinct from approval and cannot block a completed
operational decision."* Ia dirancang sebagai pengetahuan, bukan persetujuan — persis kebalikan dari
yang dituntut Pasal 32 ayat (6).

---

## Yang sudah diputuskan pengguna

Diambil 9 September 2026. **Jangan diturunkan ulang dan jangan ditawar.**

1. **Jejak penyaringan berupa tabel riwayat**, bukan kolom pada `customers`. Alasannya Pasal 47 ayat
   (1) huruf b: daftarnya wajib dikinikan, sehingga setiap impor baru menuntut penyaringan ulang.
   Satu stempel waktu pada baris nasabah akan tertimpa dan menghapus bukti bahwa penyaringan
   ulangnya terjadi.
2. **Penyaringan berjalan otomatis di server saat nasabah disimpan.** Tidak pernah memblokir
   penyimpanan; hasilnya dicatat baik cocok maupun tidak. Borang yang menolak menyimpan adalah
   tekanan yang justru melahirkan data karangan.
3. **SHAREHOLDER menyetujui atau menolak nasabah berisiko tinggi, dan nasabah `HIGH` yang belum
   disetujui TIDAK DAPAT dipakai pada bon baru.** Ini satu-satunya pilihan yang benar-benar
   melaksanakan *"memutuskan meneruskan atau menghentikan hubungan usaha"*.

---

## Rancangan

### 1. Migrasi `0057` — satu tabel baru, empat kolom baru

`customer_watchlist_screenings`, satu baris per penyaringan dan **tidak pernah disunting**:

| Kolom | Isi |
|---|---|
| `customerId` | nasabah yang disaring |
| `screenedAt` | kapan |
| `screenedByUserId` | siapa; **null berarti otomatis** |
| `trigger` | `NASABAH_DIBUAT` · `NASABAH_DIUBAH` · `DAFTAR_DIIMPOR` · `MANUAL` |
| `matchCount` | banyaknya kemungkinan kecocokan |
| `summary` | ringkasan nama dan skor, `null` bila nihil |
| `listSnapshotAt` | `importedAt` terbaru pada saat penyaringan |

`listSnapshotAt` adalah kolom yang membuat tabel ini menjawab pertanyaan yang sebenarnya: **apakah
nasabah ini disaring terhadap daftar yang dipegang hari ini, atau terhadap daftar yang sudah usang?**
Tanpanya, "pernah disaring" tidak berarti apa-apa setelah daftarnya diperbarui.

`customers` mendapat empat kolom keputusan: `highRiskDecision`
(`BELUM` · `DISETUJUI` · `DITOLAK`, bawaan `BELUM`), `highRiskDecidedByUserId`,
`highRiskDecidedAt`, `highRiskDecisionNotes`.

**Tidak ada tabel riwayat keputusan.** Setiap keputusan sudah ditulis ke `audit_logs`, dan itulah
riwayat yang dipakai proyek ini. Menambah tabel kedua berarti dua sumber kebenaran untuk satu fakta.

**Aturan setel ulang:** setiap kali `riskLevel` **berpindah menjadi** `HIGH`, `highRiskDecision`
kembali ke `BELUM`. Tanpa aturan ini, persetujuan lama diam-diam menaungi nasabah yang menjadi
berisiko tinggi karena alasan yang sama sekali baru.

**Aman diterapkan:** produksi memuat **satu** nasabah berstatus `LOW` (diperiksa baca-saja
9 September 2026). Tidak ada satu pun nasabah yang terblokir pada hari penerapannya.

### 2. Penyaringan berjalan sendiri

`server/customerWatchlistScreening.ts`. Satu penulis, tiga pemanggil:

- `createCustomer` dan `updateCustomer` menyaring lalu menulis barisnya — **selalu**, cocok maupun
  tidak. Baris "nihil" justru bukti yang dicari pemeriksa.
- `importSanctionsWatchlist` menyaring **ulang seluruh nasabah aktif** terhadap daftar yang baru
  masuk, dengan `trigger = DAFTAR_DIIMPOR`.

Pemanggil ketiga itulah yang membuat jejaknya bermakna: ia mengubah *"disaring bulan Maret"* menjadi
*"disaring terhadap daftar yang kita pegang sekarang"* — yaitu bunyi Pasal 47 ayat (1) huruf b dan c
bila dibaca bersama.

**Kotak centang petugas tidak disentuh.** `dttotPpsdmMatch` tetap penilaian manusia dan tidak pernah
diisi otomatis — aturan yang sudah berlaku sejak `shared/sanctionsNameMatch.ts` ditulis, dan yang
tidak berubah hanya karena penyaringannya kini otomatis. Mesin mencatat kemungkinan; manusia
memutuskan.

### 3. Gerbang persetujuan

`customerHighRiskDenial(customer, actorRole)` — fungsi **murni**, meniru
`iraEditDenial`/`iraApprovalDenial` (Paket J2), mengembalikan alasan yang terbaca manusia atau
`null`.

`createTransaction` (`server/operations.ts:1447`) menolak bon bila nasabahnya `HIGH` dan
keputusannya bukan `DISETUJUI`, dengan pesan yang menyebut **siapa** yang berwenang menyetujui.
Ditegakkan **di penulisnya**, bukan hanya di router, supaya pemanggil non-tRPC ikut terkena —
aturan otorisasi proyek ini.

### 4. Halaman

Detail nasabah mendapat panel riwayat penyaringan — kapan, oleh siapa atau otomatis, berapa
kemungkinan kecocokan — beserta **peringatan bila `listSnapshotAt` lebih tua daripada impor
terakhir**. Kendali setujui/tolak muncul hanya bagi SHAREHOLDER. Borang transaksi menampilkan alasan
penolakan apa adanya, bukan galat generik.

---

## Yang sengaja tidak dikerjakan

- **Kotak centang `dttotPpsdmMatch` tidak diisi otomatis** — lihat Rancangan 2.
- **Nama kolom `dttotPpsdm*` tetap tidak diganti** (keputusan Paket K2).
- **Tidak ada jalur membuka kembali `DITOLAK`** selain mengubah `riskLevel`. Penolakan **adalah**
  keputusan menghentikan hubungan usaha; menyediakan tombol "batalkan penolakan" akan membuatnya
  menjadi saran belaka.
- **Tidak ada pemblokiran serta merta atas kecocokan DTTOT/DPPSPM** (Pasal 47 ayat 1 huruf d) dan
  **tidak ada pencatatan percobaan transaksi.** Itu Temuan 3, menunggu keputusan pengguna, dan
  menuntut penulis data yang belum ada.
- **Tidak ada laporan ke Polri maupun PPATK.** Tenggat pelaporan Pasal 60 **dikeluarkan dari
  lingkup atas keputusan pengguna 9 September 2026** — negosiasi dengan BI sudah selesai.

---

## Risiko residual

1. **Nasabah berisiko tinggi tidak dapat bertransaksi bila SHAREHOLDER tidak dapat dihubungi.** Itu
   memang maksud Pasal 32 ayat (6), tetapi biayanya nyata pada hari Sabtu. Tidak ada jalur darurat,
   dan itu disengaja.
2. **Penyaringan ulang massal menulis satu baris per nasabah setiap impor.** Pada volume sekarang
   (satu nasabah di produksi) tidak berarti apa-apa; pada puluhan ribu nasabah ia harus menjadi
   pekerjaan latar. Ambang itu belum ada, dan belum perlu ada.
3. **Pencocokan tetap fuzzy dengan ambang 0,6.** Paket ini menambah jejak, bukan ketepatan. False
   positive dan false negative tetap ada — Pasal 47 ayat (1) huruf e menuntut mitigasinya, dan yang
   ada baru ambang beserta keputusan manusia.
4. **`listSnapshotAt` menandai keusangan, tetapi tidak ada yang memaksa penyaringan ulang** selain
   impor berikutnya. Bila daftar tidak pernah diimpor lagi, tidak ada yang mengeluh.
5. **Penjelasan pasal demi pasal PBI 10/2024 belum dibaca** untuk Pasal 32 dan 47. Penjelasan sering
   menyempitkan bunyi pasalnya; bila ternyata berbeda, rancangan ini yang menyesuaikan.
