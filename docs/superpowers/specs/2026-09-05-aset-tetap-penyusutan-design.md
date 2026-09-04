# Paket E — Aset tetap dan penyusutan

Tanggal 5 September 2026, di atas commit `da66fb9`. Disetujui sebelum implementasi.

Baris **Penyusutan** pada form B0003 sampai hari ini tidak punya asal. Akun 1-1510 Harga Perolehan,
1-1520 Akumulasi Penyusutan, dan 6-1700 Beban Penyusutan sudah ada di bagan akun dan **isinya nol**;
`journalSourceTypes` (`drizzle/schema.ts:1215`) sudah memuat `PENYUSUTAN` yang belum dipakai siapa
pun. Paket ini memasang bagian yang hilang di tempat yang sudah disediakan.

Paket ini juga menentukan bentuk keluaran yang dibaca **paket F**: Arus Kas metode tidak langsung
menambahkan kembali penyusutan dari sini, dan bagian investasinya dibangun dari perolehan serta
pelepasan aset. Bentuk itu ditetapkan di bagian 8, bukan diserahkan ke sesi F.

## Masalah

### 1. Beban penyusutan tidak pernah ada

Modul pengeluaran (`operational_expenses`) hanya melayani biaya berulang: sewa, gaji, utilitas.
Pembelian brankas, kendaraan, atau perangkat kasir tidak punya tempat sama sekali — bukan sebagai
beban, bukan sebagai aset. Akibatnya:

- 1-1510 dan 1-1520 nol, sehingga neraca kehilangan aset yang benar-benar dipegang perusahaan.
- 6-1700 nol, sehingga laba **berlebih** setiap periode persis sebesar penyusutan yang seharusnya.
- B0003 baris Penyusutan hanya bisa diisi dengan mengetik angka dari luar aplikasi — persis
  keadaan yang temuan 7.1 permasalahkan.

### 2. Umur manfaat tidak boleh ditebak diam-diam

Aturan pajak (DJP) dan aturan akuntansi (SAK EP) berbeda, dan perbedaan itu tidak boleh dilebur:

- **DJP:** Kelompok 1/2/3/4 = 4/8/16/20 tahun; bangunan permanen 20 tahun, non-permanen 10 tahun.
  Jenis asetnya terdaftar di PMK 72/2023. Penyusutan **mulai bulan pengeluaran**.
- **SAK EP Bab 17:** umur manfaat **sebenarnya**, ditinjau tahunan.

Karena itu kelompok pajak ditawarkan sebagai **default berlabel yang dapat ditimpa**, bukan dipasang
diam-diam sebagai kebijakan akuntansi. (Fakta ini sudah diverifikasi 3 September 2026 dari naskah SAK
EP pengguna dan pajak.go.id; jangan diturunkan ulang.)

### 3. Yang sudah disediakan dan menganggur

- `PENYUSUTAN` pada `journalSourceTypes` — nol pemakai.
- Akun 1-1510, 1-1520 (akun lawan, `contra: true`), 6-1700, dan 7-1400 Laba/(Rugi) Penjualan Aset
  Tetap — keempatnya ada, keempatnya nol.
- Kunci unik `(sourceType, sourceReference)` pada `journal_entries` — pola idempotensi yang sudah
  terbukti di `server/periodClosing.ts` (paket C).
- Gerbang `closeAccountingPeriod` (`server/ledgerOperations.ts:189`) sudah punya bentuk penolakan
  yang tinggal ditambah satu, lengkap dengan urutan pesannya.

## Yang sudah diputuskan pengguna

Ditanyakan dan dijawab pada sesi rancangan ini, 5 September 2026.

1. **Garis lurus saja.** SAK EP Bab 17 mengizinkannya, B0003 hanya menyediakan satu baris Penyusutan,
   dan garis lurus adalah satu-satunya bentuk yang perlu ditambahkan kembali paket F. Kelompok pajak
   (4/8/16/20 tahun, bangunan 20/10) ditawarkan sebagai **default berlabel** yang mengisi umur
   manfaat dan dapat ditimpa per aset. Tidak ada saldo menurun; kolom `method` pun tidak dibuat,
   karena kolom kosong yang menjanjikan sesuatu lebih buruk daripada ketiadaannya.
2. **Bulan perolehan disusutkan penuh.** Aset yang dibeli 17 Maret mendapat beban satu bulan penuh
   pada Maret. Ini aturan DJP (*penyusutan mulai bulan pengeluaran*), dan memilihnya berarti register
   ini sekaligus dapat dipakai sebagai catatan penyusutan fiskal. Prorata harian ditolak karena ia
   menciptakan sisa pembulatan pada bulan pertama yang harus dijatuhkan ke suatu tempat — dan tempat
   itu tidak punya alasan akuntansi, hanya alasan aritmetika.
3. **Batas kapitalisasi ada, dapat disetel, default Rp 1.000.000.** Di bawah batas, pendaftaran
   **ditolak** dengan pesan yang menunjuk modul pengeluaran (6-1900). Tanpa batas, register akan
   penuh berisi stapler dan kursi, masing-masing dengan jadwal 48 bulan. Disetel per tenant karena
   outlet yang lebih besar punya alasan sah menaikkannya.
4. **Dijurnal bulanan, lewat tombolnya sendiri, dan menjadi syarat penutupan periode.** Satu jurnal
   `PENYUSUTAN` per bulan, `sourceReference = SUSUT-YYYY-MM`, idempoten lewat kunci yang sudah ada.
   `closeAccountingPeriod` menolak periode yang penyusutannya belum dijurnal — bentuk gerbang yang
   sama persis dengan `valuationPostedAt` pada paket C. Meleburkannya ke `postPeriodClosing` ditolak
   karena jurnal penutupan lalu memuat dua hal yang tidak berhubungan di bawah satu kunci
   idempotensi; membiarkannya tanpa gerbang ditolak karena bulan yang terlupa membuat laba berlebih
   tanpa ada yang menolak.
5. **Perolehan dikredit ke 2-1900 Kewajiban Lain-Lain**, sama seperti pengeluaran. Aturan yang sudah
   tertulis pada `EXPENSE_PAYABLE_ACCOUNT` (`shared/journalMapping.ts:93`) berlaku utuh di sini:
   modul di luar sistem kas tidak boleh mengkredit 1-1110, karena kas pada buku besar lalu berbeda
   dari `cash_balances` — persis ketidakcocokan yang menjadi temuan 7.2/7.3. Pelunasannya dijurnal
   terpisah saat uangnya benar-benar keluar.
6. **Pelepasan dijurnal ke 7-1400; aset yang habis disusutkan tetap terdaftar.** Pelepasan menulis
   akumulasi keluar, harga perolehan keluar, dan selisihnya ke 7-1400. Aset yang mencapai nilai
   residu berhenti membebani dan **tetap tampil** di register — barangnya masih ada secara fisik, dan
   yang ditanyakan pemeriksa adalah asetnya, bukan nilai bukunya.
7. **Aset warisan didaftarkan beserta akumulasi penyusutan yang sudah tercatat, tanpa jurnal
   perolehan.** Saldo 1-1510 dan 1-1520 untuk aset yang sudah dimiliki sebelum buku besar ini dipakai
   masuk lewat jalur saldo awal (`SALDO_AWAL`) yang sudah ada; register tidak boleh menjadi modul
   kedua yang menulis saldo awal. Jadwalnya melanjutkan sisa bulan yang belum disusutkan.

## Rancangan

### 1. Skema — migrasi `0048`, aditif

Tiga tabel baru, dua kolom pada `accounting_periods`, dan dua nilai baru pada `journalSourceTypes`.

**`fixed_assets`** — satu baris per aset.

| Kolom | Arti |
|---|---|
| `assetCode` varchar(60) | Nomor inventaris fisik; boleh kosong, unik bila diisi |
| `name` varchar(200) | Nama aset sebagaimana dikenali orang di outlet |
| `category` enum | `TANAH`, `BANGUNAN`, `KENDARAAN`, `PERALATAN_KANTOR`, `PERANGKAT_KERAS`, `PERANGKAT_LUNAK`, `INVENTARIS_LAIN` — kelas aset untuk pengungkapan CALK paket F |
| `taxGroup` enum nullable | `KELOMPOK_1..4`, `BANGUNAN_PERMANEN`, `BANGUNAN_NON_PERMANEN`, `TIDAK_DISUSUTKAN`; hanya label asal default |
| `acquisitionDate` date | Tanggal perolehan; kolom `date`, karena itu **wajib** lewat `calendarDay`/`dbDate` |
| `acquisitionCost` decimal(24,2) | Harga perolehan |
| `residualValue` decimal(24,2) default `0.00` | Nilai residu; dasar penyusutan = perolehan − residu |
| `usefulLifeMonths` int **nullable** | Umur manfaat dalam bulan. **NULL berarti tidak disusutkan** — tanah, dan hanya tanah, secara sah tidak pernah menyusut |
| `firstJournalMonth` varchar(7) | Bulan pertama yang boleh dijurnal sistem, `"YYYY-MM"` |
| `openingAccumulatedDepreciation` decimal(24,2) default `0.00` | Akumulasi yang sudah tercatat sebelum `firstJournalMonth`; nol untuk aset baru |
| `acquisitionJournalEntryId` int nullable | Jurnal perolehan; **NULL menandai aset warisan** — keputusan 7 |
| `status` enum | `AKTIF`, `DILEPAS` |
| `disposalDate` date nullable, `disposalProceeds` decimal(24,2) nullable, `disposalJournalEntryId` int nullable, `disposalNotes` text | Terisi hanya pada pelepasan |
| `notes` text, `recordedByUserId` int, `createdAt`, `updatedAt` | |

**`fixed_asset_depreciation_entries`** — satu baris per aset per bulan yang **benar-benar dijurnal**.

| Kolom | Arti |
|---|---|
| `assetId`, `periodMonth` varchar(7) | UNIQUE bersama |
| `periodId` int | Periode pembukuan bulan itu |
| `charge` decimal(24,2) | Beban bulan itu |
| `accumulatedAfter`, `carryingAfter` decimal(24,2) | Akumulasi dan nilai buku sesudahnya |
| `journalEntryId` int | Jurnal bulanan yang memuatnya |
| `createdAt` | |

Tabel ini adalah jawaban 7.1 pada tingkat baris: beban 6-1700 sebesar sekian pada Maret bukan angka
yang muncul entah dari mana, melainkan jumlah baris-baris yang masing-masing menyebut asetnya.

**`fixed_asset_settings`** — singleton (`id = 1`), berisi `capitalisationThresholdIdr` decimal(24,2)
default `1000000.00`, `updatedByUserId`, `updatedAt`.

Batas ini **tidak** dititipkan ke `operational_settings`: tabel itu menyatakan dirinya *"configurable
compliance thresholds"* dan dibaca `adminProcedure`, sementara batas kapitalisasi adalah kebijakan
akuntansi yang dibaca `controllerProcedure`. Menaruhnya di sana berarti seorang Admin dapat mengubah
angka yang menentukan isi neraca.

**`accounting_periods`** mendapat dua kolom nullable, sebangun dengan paket C:
`depreciationPostedAt` datetime dan `depreciationJournalEntryId` int. Penanda ditaruh sebagai kolom,
bukan disimpulkan dari ada-tidaknya baris — outlet tanpa aset tetap menghasilkan nol baris beban,
dan itu keadaan sah yang tetap harus bisa ditutup.

**`journalSourceTypes`** bertambah `PEROLEHAN_ASET` dan `PELEPASAN_ASET`. Ini satu-satunya bagian
migrasi yang bukan `ADD`: MySQL memperluas enum lewat `MODIFY COLUMN`. Diterima **dengan syarat SQL
yang dihasilkan dibaca lebih dulu** dan terbukti hanya menambah dua nilai tanpa menghilangkan satu
pun yang lama. Alasan menambahkannya, dan bukan menumpang pada `PENYUSUTAN` atau `MANUAL`: paket F
menyusun bagian **investasi** Arus Kas dengan mengenali kedua jenis kejadian ini, dan mengenalinya
lewat `sourceType` adalah satu-satunya cara yang tidak menebak. `PENYUSUTAN` tetap dipakai apa adanya
untuk jurnal bulanannya, sebagaimana yang sudah tersedia.

### 2. Jadwal penyusutan — fungsi murni di `shared/`

Satu formula melayani aset baru maupun aset warisan, dan itu yang membuatnya layak dipercaya:

```
dasar        = acquisitionCost − residualValue − openingAccumulatedDepreciation
sudahLewat   = jumlah bulan dari acquisitionDate sampai firstJournalMonth, tidak termasuk
sisaBulan    = usefulLifeMonths − sudahLewat
n(M)         = urutan bulan M dihitung dari firstJournalMonth, mulai 1; 0 bila M lebih awal
k(M)         = min(max(n(M), 0), sisaBulan)
kumulatif(M) = bulat_setengah_ke_atas(dasar × k(M) / sisaBulan, 2 desimal)
beban(M)     = kumulatif(M) − kumulatif(M − 1)
```

Aset baru adalah kasus khusus dengan `openingAccumulatedDepreciation = 0` dan `firstJournalMonth`
sama dengan bulan perolehan, sehingga `sisaBulan = usefulLifeMonths`. Tidak ada cabang kedua.

Sifat yang dituju, dan yang diuji satu per satu:

- Jumlah seluruh beban **tepat** sama dengan `dasar` — tidak ada sen yang hilang maupun tercipta.
  Ini alasan memakai selisih kumulatif alih-alih membulatkan `dasar / sisaBulan` lalu menumpuknya:
  yang terakhir meleset sampai beberapa rupiah sepanjang 240 bulan, dan sisanya harus ditambal ke
  bulan terakhir tanpa alasan akuntansi.
- Tiap beban bulanan berselisih paling banyak satu sen dari bagian ratanya.
- `usefulLifeMonths` NULL → seluruh beban `0.00`; tanah tidak menyusut dan tidak menghasilkan baris.
- `sisaBulan ≤ 0` → seluruh beban `0.00`; aset warisan yang umur manfaatnya sudah habis sebelum buku
  besar ini dipakai tidak menghidupkan kembali penyusutan.
- Bulan setelah umur manfaat habis → `0.00`, bukan galat. Asetnya tetap di register (keputusan 6).
- `openingAccumulatedDepreciation` melebihi `acquisitionCost − residualValue` → **ditolak**, bukan
  dijepit ke nol: angka itu berarti data warisannya salah, dan menerimanya diam-diam berarti
  menyusutkan aset melewati nilai residunya.

### 3. Jurnal perolehan

```
Dr 1-1510 Aset Tetap — Harga Perolehan     harga perolehan
  Cr 2-1900 Kewajiban Lain-Lain            harga perolehan
```

`sourceType = PEROLEHAN_ASET`, `sourceReference = ASET-{assetId}`, bertanggal `acquisitionDate`.
Tidak ditulis untuk aset warisan (keputusan 7) — barisnya tetap masuk register dengan
`acquisitionJournalEntryId` NULL.

Pendaftaran yang jurnal perolehannya akan jatuh pada periode yang **sudah ditutup** ditolak, dengan
pesan yang menunjuk jalur aset warisan. `postJournalEntry` sudah menolaknya sendiri
(`server/ledgerOperations.ts:337`), tetapi penolakan di muka menyebut jalan keluarnya.

### 4. Jurnal penyusutan bulanan

Satu jurnal untuk seluruh aset pada bulan itu — bukan satu jurnal per aset:

```
Dr 6-1700 Penyusutan Aset Tetap     jumlah seluruh beban bulan itu
  Cr 1-1520 Akumulasi Penyusutan    jumlah seluruh beban bulan itu
```

`sourceType = PENYUSUTAN`, `sourceReference = SUSUT-YYYY-MM`, bertanggal **hari terakhir bulan itu**.
Empat puluh jurnal kecil setiap bulan akan mengubur jurnal transaksi di antara derau; rincian per
asetnya justru lebih terbaca pada `fixed_asset_depreciation_entries`, tempat ia dapat diurutkan dan
dijumlahkan.

Bila jumlah bebannya nol — outlet tanpa aset tersusutkan — pemetaannya mengembalikan `skipped`
beserta alasannya dan tidak ada jurnal yang ditulis, tetapi `depreciationPostedAt` **tetap** diisi.
Penyusutan memang sudah dijalankan; hasilnya yang kosong. Ini pola yang sama persis dengan
`postPeriodClosing`.

Bulan yang periodenya sudah ditutup ditolak. Bulan yang periodenya belum ada dibuat lewat
`ensureAccountingPeriod` yang sudah ada.

### 5. Jurnal pelepasan

```
Dr 1-1320 Piutang Lain-Lain            hasil pelepasan          (bila > 0)
Dr 1-1520 Akumulasi Penyusutan         akumulasi tercatat
  Cr 1-1510 Aset Tetap — Harga Perolehan  harga perolehan
  Cr 7-1400 Laba/(Rugi) Penjualan Aset Tetap   laba             (bila hasil > nilai buku)
Dr 7-1400 Laba/(Rugi) Penjualan Aset Tetap     rugi             (bila hasil < nilai buku)
```

`sourceType = PELEPASAN_ASET`, `sourceReference = LEPAS-{assetId}`, bertanggal `disposalDate`.
Hasil pelepasan masuk ke 1-1320 Piutang Lain-Lain, bukan ke kas, dengan alasan yang sama seperti
keputusan 5: uang tunai hanya bergerak lewat sistem kas. Pelunasannya dijurnal terpisah.

**Akumulasi yang dipakai adalah yang benar-benar tercatat** — `openingAccumulatedDepreciation`
ditambah seluruh baris `fixed_asset_depreciation_entries` aset itu — bukan angka teoretis dari
jadwalnya. Bulan yang belum dijurnal belum pernah menyentuh 1-1520; memakai jadwalnya akan
mengeluarkan dari 1-1520 lebih banyak daripada yang pernah masuk, dan neracanya tetap seimbang
sehingga kekeliruannya tidak terlihat dari laporan mana pun.

Karena itu pelepasan **menolak** aset yang penyusutannya belum dijurnal sampai dengan bulan
pelepasan, dan menyebut bulan mana yang tertinggal.

### 6. Batas kapitalisasi

Ditegakkan di `registerFixedAsset` pada server, bukan di form. Harga perolehan di bawah
`capitalisationThresholdIdr` ditolak dengan pesan yang menyebut angka batasnya dan menunjuk modul
Catat Pengeluaran. Perubahan batasnya `controllerProcedure` dan tercatat di jejak audit — ia
menentukan apa yang masuk neraca dan apa yang masuk laba rugi.

Aset kategori `TANAH` dikecualikan dari batas: tanah tidak pernah di bawahnya, dan mengujinya hanya
menambah cabang yang tidak pernah benar.

### 7. Gerbang pada penutupan

Dua penolakan baru, keduanya di tempat yang sudah punya bentuknya:

- `closeAccountingPeriod` menolak periode yang `depreciationPostedAt`-nya kosong. Diperiksa
  **setelah** keutuhan jurnal dan **sebelum** penilaian persediaan: penyusutan lebih dulu karena ia
  mengubah laba periode itu, sementara penilaian tidak bergantung padanya.
- `postYearEndProfitClosing` menolak bila ada bulan di dalam tahun buku itu yang penyusutannya belum
  dijurnal, dan menyebut bulan-bulannya. Penutup laba menolkan 6-1700; menutupnya sebelum bebannya
  lengkap memindahkan angka yang salah ke 3-2100, dan 3-2100 tidak pernah ditinjau lagi.

Penilaian persediaan (`postPeriodClosing`) sengaja **tidak** dibuat bergantung pada penyusutan.
Keduanya tidak saling menentukan angkanya, dan menautkannya hanya akan membuat urutan tombol pada
panel terasa sewenang-wenang.

### 8. Bentuk keluaran yang dibaca paket F

Ditetapkan di sini supaya sesi F tidak menurunkannya ulang:

| Yang dibutuhkan F | Dibaca dari |
|---|---|
| Penyusutan yang ditambahkan kembali (non-kas) | Mutasi akun **6-1700** di dalam periode, lewat `accountBalancesFor` |
| Arus keluar investasi — perolehan aset | Jurnal `sourceType = PEROLEHAN_ASET` di dalam periode, sisi debit 1-1510 |
| Arus masuk investasi — hasil pelepasan | Jurnal `sourceType = PELEPASAN_ASET` di dalam periode, sisi debit 1-1320 |
| Laba/rugi pelepasan yang harus dikeluarkan dari arus operasi | Mutasi akun **7-1400** di dalam periode |

**Buku besar yang menjadi sumbernya, bukan `fixed_asset_depreciation_entries`.** Keduanya sama
angkanya menurut konstruksi, tetapi Arus Kas harus dapat direkonsiliasi terhadap laporan lain, dan
laporan lain dibangun dari buku besar. Tabel rinciannya adalah **bukti**, bukan sumber.

Perolehan yang dikredit ke 2-1900 berarti kasnya belum bergerak pada saat perolehan. Arus keluar
investasi yang sebenarnya baru terjadi saat pelunasan — F harus menanganinya sebagai perubahan
kewajiban, bukan sebagai arus keluar pada tanggal perolehan. Ini konsekuensi langsung keputusan 5
dan pantas dicatat sekarang, saat alasannya masih segar.

### 9. Pembulatan — satu tempat, disebut eksplisit

Aturan keras proyek berbunyi "menolak membulatkan uang". Ia mengenai **konversi uang yang sudah
tercatat** dari enam desimal ke dua; di sana pembulatan menciptakan atau melenyapkan uang yang sudah
ada di pembukuan.

Penyusutan bukan konversi; ia pembagian sebuah nilai perolehan ke sejumlah bulan, dan hasil baginya
hampir tidak pernah jatuh pas di sen. Pembulatan karena itu diizinkan **hanya** pada `kumulatif(M)`
di bagian 2, setengah ke atas, dua desimal — dan justru karena dilakukan pada kumulatif, jumlah
seluruh bebannya tetap **tepat** sama dengan dasar penyusutan. Tidak ada sen yang menguap; yang
berbeda hanyalah pembagiannya antar bulan, paling banyak satu sen.

Seluruh baris jurnal tetap tepat dua desimal sebagaimana `AMOUNT_PATTERN` (`shared/ledger.ts:18`)
menuntut. Tidak ada nilai lain dalam paket ini yang dibulatkan.

### 10. Halaman Aset Tetap dan panel penyusutan

Halaman baru `/operasional/aset-tetap`, `minimumRole` **CONTROLLER**, di grup **Laporan** pada
`shared/backOfficeNavigation.ts` bersama Buku Besar — angkanya angka laporan keuangan, bukan
informasi operasional harian. Menambahkannya menyentuh tiga berkas sekaligus
(`shared/backOfficeNavigation.ts`, `client/src/App.tsx`, dan peta pada
`server/backOfficeNavigation.test.ts`); uji navigasi yang sudah ada akan gagal berisik bila salah
satunya terlewat, dan itu memang gunanya.

Isinya: daftar aset dengan harga perolehan, akumulasi, nilai buku, dan status; form pendaftaran
dengan kelompok pajak yang **mengisi** umur manfaat dan meninggalkannya dapat diubah; form aset
warisan; tindakan pelepasan dengan hasil pelepasan dan pratinjau laba/ruginya sebelum tombol ditekan.

Penyusutan bulanan dijalankan dari **tab Periode halaman Buku Besar**, di dalam `PeriodRow` yang
sudah memuat panel penutupan paket C — bukan dari halaman aset. Yang dilakukan orang di sana adalah
menutup bulan, dan penyusutan adalah langkah pertamanya. Panelnya menampilkan tabel per aset beserta
bebannya sebelum tombol dapat ditekan, dan tombolnya mati bila periodenya sudah ditutup.

Endpoint yang dipakainya, disebutkan supaya tidak terulang kelalaian rencana paket D:
`trpc.fixedAssets.list.useQuery()`, `trpc.fixedAssets.register.useMutation()`,
`trpc.fixedAssets.dispose.useMutation()`, `trpc.fixedAssets.settings.useQuery()`,
`trpc.fixedAssets.updateSettings.useMutation()`, `trpc.ledger.monthlyDepreciation.useQuery({ periodId })`,
dan `trpc.ledger.postMonthlyDepreciation.useMutation()`. Seluruhnya `controllerProcedure`.

## Yang sengaja tidak dikerjakan

- **Jangan menambah akun ke bagan akun.** Keempat akun yang dibutuhkan sudah ada. 6-1700 adalah satu
  baris B0003 dan tetap satu baris; penyusutan per kelas aset diungkapkan di CALK (paket F), bukan
  dipecah menjadi akun.
- **Jangan menambah metode selain garis lurus.** Keputusan 1.
- **Jangan menyentuh sistem kas.** Perolehan dan pelepasan bertemu kas hanya lewat 2-1900 dan 1-1320.
  Modul ini tidak pernah menulis `cash_balances`, mutasi kas, maupun rincian pecahan.
- **Jangan membuat penyusutan berjalan otomatis** — tanpa cron, tanpa penjadwalan. Manusia menekan
  tombolnya, sama seperti `postOperations` dan `postPeriodClosing`.
- **Jangan menambah `ownerType` atau `documentType` pada `operational_documents`** untuk faktur
  pembelian aset. Arsip dokumen adalah paket I dan punya rancangannya sendiri; menambahkan setengahnya
  di sini akan didahului keputusan paket itu.
- **Jangan menilai ulang aset tetap (model revaluasi).** SAK EP mengizinkannya sebagai pilihan
  kebijakan; memilihnya menuntut penilai independen dan surplus revaluasi pada ekuitas. Model biaya,
  dan hanya model biaya.
- **Jangan menangani penurunan nilai (impairment).** Kejadiannya jarang pada aset outlet penukaran
  valuta, dan penanganannya menuntut estimasi nilai terpulihkan yang tidak ada sumbernya di sistem
  ini. Bila terjadi, jurnal manual.
- **Jangan mengubah arti `operational_expenses`.** Aset tetap adalah modul terpisah; pengeluaran
  tetap menjadi biaya berulang.

## Risiko residual

- **Bagan akun masih perlu ditinjau seorang akuntan satu kali.** Sama seperti paket C, paket ini
  bersandar penuh padanya. Risiko yang sudah dicatat ROADMAP dan tidak dikurangi di sini.
- **Umur manfaat yang diisi salah tidak dapat ditangkap sistem.** Kelompok pajak ditawarkan sebagai
  default justru untuk memperkecil kemungkinannya, tetapi SAK EP menuntut umur manfaat sebenarnya —
  dan tidak ada di dalam aplikasi ini yang tahu berapa lama sebuah brankas akan dipakai. Peninjauan
  tahunan yang dituntut Bab 17 tetap pekerjaan manusia; paket ini tidak menyediakan alur
  perubahannya, sehingga umur manfaat yang berubah menuntut pendaftaran ulang dan jurnal koreksi.
- **Jurnal penyusutan yang dibalik tidak mengosongkan `depreciationPostedAt`.** Persis keterbatasan
  yang sudah tercatat pada paket C untuk `valuationPostedAt`, dengan sebab yang sama:
  `reverseJournalEntry` tidak tahu penanda mana yang menggantung padanya. Bulan yang jurnalnya
  dibalik akan tetap tampak "sudah disusutkan", dan menjalankannya ulang menuntut langkah manual.
  Bila ini sering terjadi, ia pantas menjadi pekerjaan tersendiri — untuk kedua penanda sekaligus.
- **Aset warisan hanya sebaik angka yang diketikkan.** `openingAccumulatedDepreciation` tidak dapat
  diperiksa terhadap apa pun; ia diminta karena tidak ada sumber lain, dan diterima apa adanya
  selama tidak melebihi dasar penyusutan.
- **Perolehan yang mengendap di 2-1900.** Bila pelunasannya tidak pernah dijurnal, kewajiban itu
  tinggal di neraca selamanya. Ini konsekuensi keputusan 5 dan berlaku sama bagi modul pengeluaran
  yang sudah ada; paket ini tidak memperburuknya, tetapi juga tidak menyelesaikannya.
