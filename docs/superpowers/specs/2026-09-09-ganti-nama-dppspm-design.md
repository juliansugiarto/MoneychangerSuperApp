# Paket K2 — Ganti nama `PPPSM` menjadi `DPPSPM`

**Kebersihan penamaan, bukan temuan BI.** Dirancang 9 September 2026, sesudah Paket J selesai.

Judul paket ini pada ROADMAP berbunyi *"Ganti nama PPPSM menjadi PPPSPM"*. **Sasarannya berubah
saat perancangan**: yang benar adalah `DPPSPM`, bukan `PPPSPM`. Alasannya di bagian Masalah 2.
Berkas rencananya karena itu bernama `plans/2026-09-09-ganti-nama-dppspm.md`.

Rencananya **empat tugas**, satu di antaranya migrasi.

---

## Masalah

### 1. Penamaannya salah, dan tidak konsisten dengan dirinya sendiri

Ada **lima** ejaan berbeda hidup berdampingan di repo ini. Dua di antaranya salah, tiga benar:

| Ejaan | Kemunculan | Kepanjangan | Vonis |
|---|---|---|---|
| `PPPSM` | 49 pada 10 berkas | — (tidak mengeja apa pun) | **Salah.** Sasaran paket ini. |
| `Ppsdm` (`dttotPpsdmMatch`/`Notes` dan pemanggilnya) | 74 pada 10 berkas | PPSDM = Pengembangan Sumber Daya Manusia | **Salah** — akronim kepegawaian, sama sekali bukan domainnya. |
| `PPSPM` | ±90 (kode parameter IRA, `iraRiskTypes`) | Pendanaan Proliferasi Senjata Pemusnah Massal | **Benar.** Nama tindak pidananya. Jangan disentuh. |
| `PPPSPM` | 25 (katalog KPMR, pelatihan SDM) | Pencegahan Pendanaan Proliferasi Senjata Pemusnah Massal | **Benar.** Nama program pencegahannya. Jangan disentuh. |
| `DPPSPM` | 5 | Daftar Pendanaan Proliferasi Senjata Pemusnah Massal | **Benar.** Nama daftarnya. Jangan disentuh — dan lihat Masalah 2. |

Ketidakkonsistenannya bahkan terjadi di dalam satu alur yang sama: skema menulis `PPPSM`
(`drizzle/schema.ts:477`), teks UI menulis `PPPSM` (`SanctionsWatchlist.tsx:13`), sementara pesan
validasi untuk kolom nasabah yang sama menulis `PPSPM` — **15 kemunculan** `"DTTOT/PPSPM"`,
termasuk `server/routers.ts:302,344` dan `server/operations.ts:645,809,940`. Petugas yang mencentang
kotak melihat satu ejaan; petugas yang gagal validasi melihat ejaan lain.

### 2. Nilai enum yang benar adalah `DPPSPM`, bukan `PPPSPM`

ROADMAP menulis `PPPSPM` pada 4 September. Perancangan ini menolaknya, atas dua alasan:

1. **Templat BI sendiri memasangkannya dengan DTTOT.** `shared/iraKpmrCatalogue.ts:183` adalah
   kutipan apa adanya dari lembar B: *"Apakah Penyelenggara memiliki KPT yang lengkap mengenai
   penanganan **DTTOT dan DPPSPM**? … menatausahakan dan mengkinikan **DTTOT dan DPPSPM** secara
   berkala …"*. Kutipan itu bukan tafsiran kita; itu kata-kata regulatornya.
2. **Nilai saudaranya sudah `DTTOT`** — *Daftar* Terduga Teroris dan Organisasi Teroris.
   `sanctions_watchlist_entries` adalah tabel **daftar penetapan**, bukan tabel program pencegahan.
   Memasangkan `DTTOT` dengan `PPPSPM` berarti satu kolom enum yang satu nilainya menamai sebuah
   daftar dan nilai lainnya menamai sebuah program.

`PPPSPM` tidak salah sebagai akronim; ia hanya menamai hal yang lain, dan sudah dipakai dengan benar
untuk hal itu di 25 tempat. Memakainya di sini akan menciptakan ejaan keenam yang bertabrakan makna.

### 3. Perubahannya menyentuh 239 baris produksi — ini bukan kosmetik

Diperiksa **baca-saja** pada produksi 9 September 2026
(`ssh deploy@187.53.128.14`, akun `claude_readonly`, hanya `SELECT`):

| Yang diperiksa | Hasil |
|---|---|
| `COLUMN_TYPE` kolom `listType` | `enum('DTTOT','PPPSM')` |
| Baris `listType = 'PPPSM'` | **239** — `DPRK` 80 INDIVIDUAL + 75 ENTITY, `IR` 23 INDIVIDUAL + 61 ENTITY |
| Baris `listType = 'DTTOT'` | 531 — `sourceLabel` null, 412 INDIVIDUAL + 119 ENTITY |
| Impor terakhir | 2 September 2026 |
| Nasabah dengan `dttotPpsdmMatch = 1` atau catatan terisi | **0** dari 1 nasabah |
| Baris `__drizzle_migrations` | **34** (id 1–34) |

Dua hal penting dari tabel itu.

**Pertama, redefinisi enum satu langkah akan menghapus 239 baris tanpa suara.** `drizzle-kit`
menghasilkan satu pernyataan `MODIFY COLUMN listType enum('DTTOT','DPPSPM') NOT NULL`. MySQL
menyunting nilai enum yang tidak lagi sah menjadi string kosong `''` — dan karena kolomnya `NOT
NULL` dan `''` bukan `NULL`, tidak ada satu pun batasan yang menolaknya. Daftar sanksi yang dipakai
menyaring nasabah akan menjadi 239 baris tak berjenis, dan halamannya tetap tampil rapi.

**Kedua, `dttotPpsdmMatch` tidak punya utang data sama sekali.** Nol baris memakainya. Itulah yang
membuat keputusan pengguna nomor 1 di bawah murah: yang tersisa hanyalah pengenal yang salah baca,
bukan data yang perlu dipindahkan.

### 4. Produksi tertinggal 22 migrasi, bukan lima

`docs/superpowers/PROMPT-SESI.md` menyebut migrasi `0051`–`0055` belum diterapkan ke produksi.
Jurnal produksi menunjukkan angka yang lebih besar: **34 baris**, yaitu `0000`–`0033`, sementara
`drizzle/` berisi **56 berkas** `.sql`. Yang tertunda adalah **`0034`–`0055`, dua puluh dua
migrasi** — dan migrasi paket ini akan berbaris di belakang seluruhnya.

Kebetulan yang membantu: `0033_pretty_killraven.sql` adalah migrasi yang **membuat**
`sanctions_watchlist_entries`. Jadi produksi memiliki tabel ini justru pada migrasi terakhir yang
pernah diterapkannya.

---

## Yang sudah diputuskan pengguna

Diambil 9 September 2026 sesudah angka produksi di atas disajikan. **Jangan diturunkan ulang dan
jangan ditawar.**

1. **Kolom `customers.dttotPpsdmMatch` dan `dttotPpsdmNotes` TIDAK diganti nama.** Nama kolom,
   nama field Drizzle, skema masukan tRPC (`server/routers.ts:289-290,333-334`), dan muatan yang
   dikirim klien (`client/src/pages/Customers.tsx:136-137`) tetap apa adanya. Yang diperbaiki hanya
   lapisan tampilan dan pesannya. Alasannya: nol baris memakainya, sehingga penggantian nama tidak
   membayar apa pun, sementara mengubah skema masukan tRPC adalah perubahan antarmuka yang menuntut
   urutan rilis klien-server yang benar demi hasil yang murni kosmetik.
2. **Nilai enum `"PPPSM"` menjadi `"DPPSPM"`, beserta migrasi datanya.** Bukan `PPPSPM`
   (lihat Masalah 2), dan bukan pula mempertahankan kedua nilai — anggota enum yang tidak pernah
   ditulis adalah pekerjaan yang belum selesai menurut `CLAUDE.md`, bukan keadaan sah.
3. **Migrasinya ditulis tangan, tiga pernyataan, bukan hasil `drizzle-kit` apa adanya.**
   Melebarkan → `UPDATE` → menyempitkan. Lihat Rancangan 2.
4. **Paket ini tidak menerapkan apa pun ke produksi.** Migrasinya hanya diterapkan ke `moneychanger`
   dan `mc_t_abcvalas`. Penerapan ke produksi adalah pekerjaan tersendiri yang harus menuntaskan
   22 migrasi yang tertunda lebih dulu.

---

## Rancangan

### 1. Peragaan lebih dulu, karena basis data lokal kosong

`moneychanger` dan `mc_t_abcvalas` sama-sama memiliki **nol** baris `sanctions_watchlist_entries`,
dan **nol** nasabah ber-`dttotPpsdmMatch`. Menjalankan migrasi di atas tabel kosong membuktikan
bahwa `ALTER` berhasil dan tidak membuktikan apa pun tentang 239 baris produksi. Peragaan yang
berhenti pada tabel kosong belum membuktikan apa pun.

Karena itu **Tugas 1 mengisi lokal lebih dulu**, dengan bentuk yang meniru produksi: tiga lingkup
(`DTTOT`/null, `PPPSM`/`DPRK`, `PPPSM`/`IR`) dan kedua `entityType`. Isinya **nama sintetis**, bukan
salinan daftar sanksi asli — yang perlu ditiru adalah bentuk dan sebaran lingkupnya, bukan orangnya.

Ujinya bukan "migrasinya jalan", melainkan **jumlah baris per lingkup sebelum dan sesudah migrasi
identik, dan tidak ada satu pun baris berjenis `''`**. Itulah tepatnya kegagalan yang ditakutkan.

### 2. Migrasi tiga pernyataan, dibaca sebelum diterapkan

`drizzle/schema.ts:477` menjadi `mysqlEnum("listType", ["DTTOT", "DPPSPM"])`, lalu migrasinya
**dihasilkan, dibaca, dan isinya diganti** dengan tiga pernyataan berpenanda
`--> statement-breakpoint`:

```sql
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','PPPSM','DPPSPM') NOT NULL;--> statement-breakpoint
UPDATE `sanctions_watchlist_entries` SET `listType` = 'DPPSPM' WHERE `listType` = 'PPPSM';--> statement-breakpoint
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','DPPSPM') NOT NULL;
```

Melebarkan lebih dulu membuat setiap baris tetap sah pada setiap langkahnya. Yang dihasilkan
`drizzle-kit` hanya pernyataan ketiga; menerapkannya sendirian adalah kehilangan data yang
dijelaskan pada Masalah 3.

Indeks `sanctions_watchlist_entries_scope_idx` berada di atas `(listType, sourceLabel)` dan terbangun
ulang sendiri oleh `MODIFY`; tidak ada langkah indeks terpisah.

### 3. Satu commit untuk enum dan seluruh tipenya

Nilai enum hidup di lima tempat sekaligus di TypeScript, bukan hanya di skema:

| Berkas | Bentuknya |
|---|---|
| `drizzle/schema.ts:477` | `mysqlEnum("listType", […])` |
| `server/operations.ts:2351,2363` | gabungan `"DTTOT" \| "PPPSM"` |
| `server/sanctionsWatchlistImport.ts:46,210` | gabungan yang sama dan nilai kembaliannya |
| `client/src/components/WatchlistCheck.tsx:7` | kunci `listTypeLabels` |
| `client/src/pages/SanctionsWatchlist.tsx:13,14,15` | kunci `listTypeLabels`, `listTypeIcon`, `listTypeTint` |

Memecahnya menjadi beberapa commit meninggalkan `tsc --noEmit` merah di tengah riwayat, atau lebih
buruk: peta label yang kuncinya tidak lagi cocok dengan nilai basis data, sehingga daftar tampil
tanpa label dan tanpa galat. Karena itu **satu commit** memuat migrasi, skema, seluruh tipe, seluruh
peta label, dan ujinya.

### 4. Uji penjaga yang membaca sumbernya sendiri

Sapuan sekali jalan akan kembali terurai. Penjaganya adalah uji Vitest yang memindai sumber untuk
`PPPSM` — meniru `server/notaKupvaIdentity.test.ts`, yang sudah menegakkan temuan BI 4 dengan cara
yang sama.

Daftar putihnya **tepat dua**, dan keduanya wajib disebutkan alasannya di dalam ujinya:

1. **`shared/iraKpmrCatalogue.ts:291`** — teks pertanyaan `KPMR_P4_3`, kutipan apa adanya dari
   templat BI yang di dalam kalimatnya sendiri memang tertulis `PPPSM`
   (*"tipologi TPPU, TPPT, dan PPPSM"*, di antara empat kemunculan `PPPSPM` yang benar pada kalimat
   yang sama). Menggantinya berarti memalsukan kutipan.
2. **`drizzle/0033_pretty_killraven.sql` dan `drizzle/meta/*.json`** — riwayat migrasi yang
   membeku. `drizzle-kit` menyimpan hash tiap berkas `.sql` di `__drizzle_migrations`; menyuntingnya
   membuat jurnal produksi maupun lokal tidak konsisten selamanya. Snapshot lama juga tidak disunting
   — snapshot baru yang lahir bersama migrasi baru.

Ujinya sekaligus menegakkan hal kedua yang lebih mudah lolos: **tidak boleh ada lagi `"DTTOT/PPSPM"`
di sumber**, karena 15 kemunculannya adalah separuh dari ketidakkonsistenan yang dikeluhkan Masalah 1.

### 5. Rollback ditulis sebelum migrasinya dijalankan

Meski hasil akhirnya kosmetik, jalannya melewati 239 baris. Urutan pengembaliannya adalah kebalikan
persisnya, dan didahului cadangan:

```sql
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','PPPSM','DPPSPM') NOT NULL;
UPDATE `sanctions_watchlist_entries` SET `listType` = 'PPPSM' WHERE `listType` = 'DPPSPM';
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','PPPSM') NOT NULL;
```

disertai penghapusan barisnya dari `__drizzle_migrations` dan pengembalian kode. Cadangannya adalah
`mysqldump` satu tabel, diambil sebelum langkah pertama.

---

## Yang sengaja tidak dikerjakan

- **Kolom `dttotPpsdmMatch`/`dttotPpsdmNotes` tidak diganti nama** — keputusan pengguna 1. Pengenal
  yang salah baca tetap tinggal di skema, tRPC, dan klien.
- **`PPSPM` dan `PPPSPM` tidak disentuh.** Keduanya benar untuk hal yang mereka namai. Sapuan
  cari-ganti yang naif akan merusak seluruh kode parameter IRA (`PPSPM_1A` … `PPSPM_4A`) dan
  `iraRiskTypes`, yang menjadi kunci basis data pada `ira_inherent_values`.
- **Tidak ada penerapan ke produksi** — keputusan pengguna 4.
- **Migrasi `0034`–`0055` tidak ikut diselesaikan.** Menemukan bahwa produksi tertinggal 22 migrasi
  adalah hasil sampingan paket ini, bukan tugasnya.
- **Tidak ada perubahan pada pengurai impor.** Deteksi bentuk workbook (`isPppsm`,
  `parsePppsmSheet`) memakai header kolom `Referensi`/`Nama`, bukan nama daftarnya; penggantian
  nama tidak menyentuh logikanya. Pengenal lokalnya ikut berganti nama demi konsistensi, bukan demi
  perilaku.
- **Tidak ada impor ulang daftar sanksi.** Baris yang ada dimigrasi apa adanya. Mengunduh ulang
  daftar dari PPATK/DK PBB adalah pekerjaan operasional, bukan pekerjaan penggantian nama.

---

## Risiko residual

1. **Pengenal `dttotPpsdm*` tetap salah baca.** Pengembang berikutnya yang membaca `Ppsdm` akan
   mengira kolom kepegawaian. Yang meredamnya hanya komentar Drizzle di atas kolomnya; tidak ada
   yang memaksa siapa pun membacanya.
2. **Migrasinya belum pernah dijalankan di atas 239 baris sungguhan.** Peragaan lokal memakai data
   sintetis dengan bentuk yang sama, bukan data produksi. Yang belum terbukti adalah waktunya
   (`ALTER` di atas tabel 770 baris — sepele) dan bukan kebenarannya.
3. **Antrean migrasi produksi menjadi 23.** Semakin panjang antrean, semakin besar peluang salah
   satunya bentrok. Paket ini memperpanjangnya satu.
4. **Uji penjaga memindai sumber, bukan hasil bundel.** Berkas baru yang dibuat sesudahnya ikut
   terpindai karena penjaganya menyapu direktori, tetapi berkas di luar `server/`, `shared/`,
   `client/src/`, dan `drizzle/schema.ts` tidak.
5. **Kutipan `PPPSM` pada `KPMR_P4_3` akan selalu tampak seperti bug.** Sesi berikutnya yang
   membacanya akan tergoda "memperbaikinya". Daftar putih pada uji penjaga beserta komentarnya
   adalah satu-satunya yang menahan hal itu.
6. **`pnpm audit --prod --audit-level=high` masih 9 temuan** (6 sedang, 3 tinggi). Paket ini tidak
   menambah dependensi dan tidak memperbaikinya. **Jangan menyebut audit bersih.**
