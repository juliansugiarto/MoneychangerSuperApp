# Paket C — Penilaian kas UKA dan penutupan periode

Tanggal 4 September 2026. Disetujui sebelum implementasi.

**Temuan BI 7.1** — penyelenggara tidak dapat menunjukkan buku besar sebagai dasar penyusunan
masing-masing pos laporan keuangan. Ini paket yang membuat neraca berhenti berselisih.

## Masalah

Empat hal sudah disiapkan dan tidak satu pun terpakai. Ini bukan pekerjaan dari nol; ini memasang
bagian terakhir pada tempat yang sudah disediakan.

### 1. Persediaan UKA tidak pernah dinilai

`mapExchangeTransaction` (`shared/journalMapping.ts:38`) memakai **persediaan periodik** dengan
sengaja: pembelian UKA masuk ke 5-1200, penjualan ke 4-1100, dan komentarnya menyatakan akun Kas UKA
(1-1210) *"baru bergerak pada akhir periode lewat persediaan akhir hasil stock opname"*.

Akhir periode itu tidak pernah tiba. Akun 1-1210 Kas UKA dan 5-1300 Persediaan Akhir UKA & TC ada di
bagan akun dan **isinya nol selamanya**. Akibatnya:

- Harga pokok berlebih persis sebesar nilai valuta yang masih ada di laci dan brankas — setiap
  pembelian dibebankan penuh, tidak ada yang dikurangkan kembali sebagai persediaan.
- Neraca kehilangan aset yang benar-benar dipegang perusahaan.
- `shared/financialStatements.ts:237` sudah menyalakan peringatan *"Persediaan UKA belum dinilai.
  Catat persediaan akhir dari hasil stock opname agar harga pokok tidak berlebih."* — peringatan yang
  sampai hari ini tidak ada cara mematikannya.

### 2. Penutupan periode hanya mengunci

`closeAccountingPeriod` (`server/ledgerOperations.ts:188`) menjalankan `verifyLedgerIntegrity` lalu
mengubah status menjadi `DITUTUP`. Tidak ada satu pun jurnal penutup, penilaian, maupun pemindahan
laba ke laba ditahan. "Menutup periode" hari ini berarti "mengunci periode".

### 3. Yang sudah disediakan dan menganggur

- `FX_REVALUATION_ACCOUNT_CODE = "7-1500"` (`shared/chartOfAccounts.ts:111`) — **nol pemanggil**.
- `RETAINED_EARNINGS_ACCOUNT_CODE = "3-2100"` (`shared/chartOfAccounts.ts:114`) — **nol pemanggil**.
- `journalSourceTypes` (`drizzle/schema.ts:1157`) sudah memuat `REVALUASI_KURS` dan `TUTUP_PERIODE`,
  keduanya belum pernah dipakai.
- `rate_reference_snapshots` (`drizzle/schema.ts:47`) menyimpan kurs BI per mata uang per
  `referenceDate` beserta `quoteUnit`.

### 4. Kuantitasnya kini ada — itu yang berubah sejak ROADMAP ditulis

Paket D sudah mendarat. `stock_opnames.physicalBalance` **kini berarti laci + brankas**, dijumlahkan
dari rincian pecahan dan tidak dapat diketik (`server/operations.ts:2993` `submitStockOpname`).
Sebelum paket D angka itu ketikan petugas yang hanya mencakup laci; menilai persediaan atasnya berarti
menilai stok yang tidak lengkap. Paket C berdiri di atas paket D justru karena itu.

## Yang sudah diputuskan pengguna

Ditanyakan dan dijawab pada sesi rancangan ini, 4 September 2026.

1. **Satu jurnal, bukan dua.** Persediaan akhir dinilai pada kurs penutup, dan selisih kursnya melebur
   ke dalam harga pokok. Memisahkan selisih kurs ke 7-1500 menuntut harga perolehan per lot
   (FIFO atau rata-rata) yang sistem ini memang tidak melacak — angka pemisahnya hanya bisa ditebak,
   dan menebak di buku besar adalah persis yang temuan 7.1 larang. **7-1500 tetap tanpa pemanggil
   setelah paket ini, dan itu disengaja.**
2. **Persediaan awal ditulis sebagai bagian penutupan, dalam satu jurnal.** Menutup periode P
   menghasilkan satu jurnal bertanggal akhir P yang memuat pembalikan nilai persediaan akhir periode
   sebelumnya ke 5-1100 sekaligus pembukuan nilai baru ke 5-1300/1-1210. Seluruhnya jatuh di dalam P,
   tidak ada jurnal yang ditulis ke periode lain, dan idempotensinya dijaga satu kunci sumber.
3. **Jurnal penutup laba ke 3-2100 hanya pada akhir tahun buku** (periode yang berakhir 31 Desember).
   Konsekuensinya: neraca berpindah dari "laba sejak awal pembukuan" ke "laba sejak penutupan tahunan
   terakhir" — `server/financialStatements.ts:88-92` ikut berubah, dan itu mendapat tugasnya sendiri.
4. **Kurs penutup adalah kurs tengah BI**, `(buyRate + sellRate) / 2` lalu dibagi `quoteUnit`.
   Mengabaikan `quoteUnit` membuat nilai JPY meleset seratus kali; BI mengutip JPY per 100 unit.
5. **Bila akhir periode jatuh pada hari libur, kurs boleh dimundurkan — tetapi tidak diam-diam.**
   Dipakai snapshot dengan `referenceDate` terakhir yang ≤ akhir periode; tanggal yang benar-benar
   dipakai disimpan pada baris penilaian dan ditampilkan pada panel serta jejak audit. Tetap menolak
   bila snapshot terakhir jatuh **sebelum awal periode** — itu berarti sinkronisasi BI tertinggal,
   bukan sekadar akhir pekan.

### Mengapa keputusan 5 menyimpang dari ROADMAP

ROADMAP menulis *"Bila snapshot untuk tanggal itu tidak ada, berhenti dan katakan — jangan
memundurkan tanggal diam-diam."* Kalimat itu benar pada maksudnya dan salah pada bentuk tegasnya:
BI tidak mengumumkan kurs pada Sabtu, Minggu, dan hari libur, sementara periode bulanan berakhir pada
tanggal kalender. 31 Mei 2026 jatuh hari Minggu; menolak tanpa syarat akan mengunci penutupan Mei
selamanya, dan jalan keluar yang tersisa — menyisipkan snapshot bertanggal itu secara manual — justru
bentuk pemunduran tanggal yang **lebih** buruk, karena tidak tercatat sebagai apa pun.

Yang dijaga kalimat ROADMAP adalah *keterlacakan*, bukan tanggalnya. Keputusan 5 menjaganya dengan
menyimpan dan menampilkan tanggal yang dipakai.

## Rancangan

### 1. Skema — migrasi `0047`, murni aditif

Tabel baru `period_closing_valuations`. Satu baris per mata uang per periode, dan **setiap angka
penilaian dapat diturunkan ulang dari barisnya sendiri** — itulah jawaban atas 7.1 pada tingkat baris.

| Kolom | Arti |
|---|---|
| `periodId`, `currencyId` | UNIQUE bersama; satu penilaian per mata uang per periode |
| `quantity` decimal(24,6) | Kuantitas valuta, dari `stock_opnames.physicalBalance` (laci + brankas) |
| `stockOpnameId`, `opnameDate` | Opname yang menjadi bukti kuantitas, beserta **tanggal sebenarnya** |
| `rateSnapshotId`, `rateReferenceDate` | Snapshot BI yang dipakai, beserta **tanggal sebenarnya** |
| `buyRate`, `sellRate`, `quoteUnit` decimal(24,6) | Dibekukan apa adanya dari snapshot |
| `midRatePerUnit` decimal(24,12) | `(buy + sell) / 2 / quoteUnit`, Rupiah per satu unit valuta |
| `rupiahValue` decimal(24,2) | `quantity × midRatePerUnit`, dibulatkan ke sen |

Empat kolom nullable pada `accounting_periods`:

| Kolom | Arti |
|---|---|
| `valuationPostedAt` datetime | Penanda "penilaian sudah dijalankan"; gerbang `closeAccountingPeriod` |
| `valuationJournalEntryId` int | Jurnal penilaian yang dihasilkan |
| `profitClosingPostedAt` datetime | Penanda jurnal penutup laba tahunan |
| `profitClosingJournalEntryId` int | Jurnal penutup laba yang dihasilkan |

Penanda ditaruh sebagai kolom, **bukan** disimpulkan dari ada-tidaknya baris
`period_closing_valuations`: outlet yang belum memegang UKA sama sekali menghasilkan nol baris
penilaian, dan itu keadaan sah yang tetap harus bisa ditutup. Menghitung baris akan mencampur
"belum dinilai" dengan "sudah dinilai, hasilnya memang kosong".

### 2. Dari mana setiap angka diambil

| Angka | Sumber | Bila tidak ada |
|---|---|---|
| Kuantitas UKA | `stock_opnames` berstatus `RECONCILED` atau `VARIANCE`, `opnameDate` terakhir **di dalam periode**, `physicalBalance` | Tolak, sebut mata uangnya |
| Kurs penutup | `rate_reference_snapshots` `referenceDate` terakhir ≤ akhir periode, `source = BI_TRANSACTION_RATES`, `isDemo = false` | Tolak bila yang terakhir jatuh sebelum awal periode |

**IDR dikecualikan tanpa syarat.** 1-1210 adalah Kas UKA; kas Rupiah sudah ada pada 1-1110 lewat
`mapCashMovement`. Memasukkan opname Rupiah ke penilaian akan menghitung kas yang sama dua kali —
kesalahan paling mahal yang dapat dibuat paket ini, dan yang paling mudah tidak terlihat karena
neraca tetap seimbang.

**Status `OPEN` dan `SUBMITTED` ditolak.** Hitungan yang belum ditinjau Supervisor bukan bukti;
menilai aset di atasnya berarti mengangkat hitungan mentah menjadi angka laporan keuangan.
`VARIANCE` **diterima** — opname bervarians tetap hitungan fisik yang sudah ditinjau, dan justru
di situlah angka fisiknya lebih dipercaya daripada angka sistem.

**Mengapa kuantitas boleh memakai opname yang lebih awal, sementara kurs harus yang terakhir
tersedia.** Keduanya "yang terakhir sebelum batas", tetapi alasannya berbeda dan pantas ditulis:
kurs untuk sebuah tanggal memang diumumkan BI dan hanya absen pada hari libur; opname adalah kejadian
fisik yang hanya terjadi bila outlet buka dan petugas menghitung. Karena itu batas bawah keduanya
berbeda — opname wajib jatuh **di dalam periode yang dinilai** (opname bulan lalu bukan bukti tentang
stok akhir bulan ini), kurs cukup tidak lebih tua daripada awal periode.

**Mata uang tanpa opname tetapi juga tanpa stok** bukan penghalang. Bila `cash_balances.availableAmount`
nol **dan** isi brankas turunannya nol, kuantitasnya nol, tidak ada baris penilaian yang ditulis, dan
penutupan berjalan. Isi brankas dibaca lewat `getOpnameSystemCounts` (`server/operations.ts:2473`)
yang sudah ada — bukan lewat kueri baru, supaya definisi "isi brankas" tetap satu.

### 3. Jurnal penilaian

Satu jurnal, `sourceType = TUTUP_PERIODE`, `sourceReference = TUTUP-{periodId}`, bertanggal akhir
periode. Idempoten lewat `journal_entries_source_uq` yang sudah ada.

```
Dr 5-1100 Persediaan Awal UKA & TC        nilai persediaan akhir periode sebelumnya
  Cr 1-1210 Kas UKA                       nilai persediaan akhir periode sebelumnya
Dr 1-1210 Kas UKA                         nilai penutupan periode ini
  Cr 5-1300 Persediaan Akhir UKA & TC     nilai penutupan periode ini
```

Kedua pasang seimbang sendiri-sendiri, sehingga jurnalnya seimbang berapa pun nilainya. Baris dengan
nilai nol dihilangkan; bila keduanya nol, pemetaannya mengembalikan `skipped` beserta alasannya dan
tidak ada jurnal yang ditulis — tetapi `valuationPostedAt` **tetap** diisi, karena penilaiannya
memang sudah dijalankan dan hasilnya kosong.

"Nilai persediaan akhir periode sebelumnya" dibaca dari `period_closing_valuations` periode dengan
`periodEnd` terbesar yang lebih kecil daripada `periodStart` periode ini **dan** yang
`valuationPostedAt`-nya terisi. Periode pertama yang pernah dinilai tidak punya pendahulu, sehingga
sisi 5-1100-nya nol — benar, karena memang belum ada persediaan awal yang tercatat.

### 4. Jurnal penutup laba akhir tahun

Jurnal terpisah, `sourceType = TUTUP_PERIODE`, `sourceReference = TUTUP-LABA-{tahun}`, bertanggal
31 Desember. Hanya untuk periode yang berakhir 31 Desember; dijalankan **setelah** jurnal penilaian
periode itu, karena persediaan akhir Desember ikut menentukan labanya.

Seluruh akun bukan-neraca (`PENDAPATAN`, `HARGA_POKOK`, `BEBAN`, `LAIN_LAIN`, `PAJAK`) yang bersaldo
dinolkan dengan membukukannya pada sisi berlawanan dari saldo normalnya, dan selisihnya jatuh ke
3-2100 Laba Ditahan. Akun lawan ikut tertangani apa adanya: 5-1300 bersaldo normal kredit, sehingga
menutupnya mendebit — dan itu memang arah yang benar.

`isBalanceSheetAccount` (`shared/chartOfAccounts.ts`) yang sudah ada menentukan mana yang ditutup,
sehingga daftar akun laba rugi tidak ditulis dua kali di dua tempat.

### 5. Gerbang pada `closeAccountingPeriod`

Setelah `verifyLedgerIntegrity` yang sudah ada, dua penolakan baru:

- `valuationPostedAt` kosong → tolak, sebut bahwa penilaian persediaan belum dijalankan.
- Periode berakhir 31 Desember dan `profitClosingPostedAt` kosong → tolak.

Mengunci tanpa menilai adalah persis keadaan hari ini, dan gerbang inilah yang membuatnya tidak
mungkin lagi terjadi tanpa disadari.

### 6. Neraca memakai laba sejak penutupan tahunan terakhir

`server/financialStatements.ts:88-92` hari ini memakai laba **sejak awal pembukuan** pada neraca,
dengan alasan yang ditulis di komentarnya: jurnal penutup belum ada, jadi laba tahun-tahun lalu masih
duduk di akun laba rugi. Setelah keputusan 3 alasan itu gugur untuk tahun yang sudah ditutup.

Bentuk barunya: saldo akun **neraca** tetap kumulatif sejak awal pembukuan; saldo akun **laba rugi**
dihitung sejak hari setelah jurnal penutup laba terakhir yang bertanggal ≤ batas laporan. Bila belum
pernah ada jurnal penutup laba, kedua angka itu identik dan **perilakunya persis seperti hari ini** —
perubahan ini tidak menggerakkan satu pun angka sampai penutupan tahunan pertama benar-benar
dijalankan. Itu disengaja: ia dapat dirilis dan diuji tanpa menunggu 31 Desember.

Kolom pembanding periode sebelumnya mendapat perlakuan yang sama terhadap batasnya sendiri.

### 7. Pembulatan nilai penilaian — penyimpangan yang disengaja

`rupiahValue` dibulatkan setengah-ke-atas ke sen. Aturan keras proyek berbunyi "menolak membulatkan
uang", dan itu mengenai **konversi uang yang sudah tercatat** dari enam desimal ke dua: di sana
pembulatan menciptakan atau melenyapkan uang yang sudah ada di pembukuan.

Penilaian bukan konversi; ia pengukuran baru — kuantitas dikali kurs, dan hasil kalinya hampir tidak
pernah jatuh pas di sen. Menolak membulatkan berarti hampir setiap penutupan periode gagal. Selisih
pembulatannya, paling banyak setengah sen per mata uang per periode, melebur ke harga pokok.

Yang **tidak** dilonggarkan: `quantity` tetap enam desimal apa adanya, `midRatePerUnit` disimpan dua
belas desimal supaya nilainya dapat dihitung ulang, dan seluruh baris jurnal tetap tepat dua desimal
sebagaimana `AMOUNT_PATTERN` (`shared/ledger.ts:18`) menuntut.

### 8. Panel Penutupan Periode

Pada tab **Periode** halaman Buku Besar (`client/src/pages/BukuBesar.tsx:730`), di dalam `PeriodRow`
yang sudah ada. Tiga hal ditampilkan sebelum tombol apa pun dapat ditekan:

- Tabel per mata uang: kuantitas, tanggal opname yang dipakai, kurs tengah, tanggal kurs yang dipakai,
  nilai Rupiah. Tanggal opname dan tanggal kurs yang **berbeda** dari akhir periode ditandai — itulah
  bentuk konkret dari keputusan 5.
- Daftar penghalang beserta alasannya, per mata uang.
- Nilai persediaan awal dan akhir yang akan dijurnal, sebelum dijurnal.

Endpoint yang dipakainya, disebutkan supaya tidak terulang kelalaian rencana paket D:
`trpc.ledger.closingValuation.useQuery({ periodId })` untuk seluruh isi tabel dan penghalangnya,
`trpc.ledger.postClosingValuation.useMutation()` dan `trpc.ledger.postYearEndClosing.useMutation()`
untuk kedua tombolnya. Ketiganya `controllerProcedure`, sama seperti seluruh router `ledger`.

## Yang sengaja tidak dikerjakan

- **Jangan menjurnal ke 7-1500.** Keputusan 1. Akun dan konstantanya tetap ada; yang tidak ada adalah
  pemanggilnya. Bila kelak harga perolehan per lot dilacak, jurnal revaluasi terpisah menjadi mungkin
  — dan hanya pada saat itu.
- **Jangan menilai rekening bank valuta asing (1-1220).** `mapBankMovement`
  (`shared/journalMapping.ts:211`) melewati seluruh rekening bukan-IDR, sehingga 1-1220 selalu nol
  dan tidak ada yang perlu dinilai. Menambahkan penilaiannya sekarang berarti menilai akun kosong.
- **Jangan menjurnal selisih opname.** Tetap seperti paket D: opname menemukan selisih, manusia yang
  menutupnya. Penilaian memakai angka **fisik**, jadi selisih yang belum ditindaklanjuti tetap
  tercermin pada nilai persediaan — tetapi tidak menghasilkan jurnal penyesuaian tersendiri.
- **Jangan membuat penutupan berjalan otomatis.** Penutupan periode dijalankan manusia lewat panel,
  sama seperti penjurnalan otomatis yang sudah ada (`postOperations`).
- **Jangan menambah akun ke bagan akun.** Seluruh akun yang dibutuhkan paket ini sudah ada.
- **Jangan mengubah arti `stock_opnames.physicalBalance`.** Paket C membacanya, tidak menulisnya.
- **Jangan menyentuh `jakartaBusinessDate`.** Tanggal periode datang dari kolom `date`
  `accounting_periods` dan sudah melewati `dbDate`.

## Risiko residual

- **Bagan akun masih perlu ditinjau seorang akuntan satu kali.** Paket ini bersandar penuh padanya:
  ia memindahkan uang antar akun yang pemetaannya belum pernah diperiksa dari luar. Ini risiko yang
  sudah dicatat ROADMAP dan paket ini tidak menguranginya.
- **Kuantitas hanya sebaik disiplin opname.** Bila opname terakhir dalam sebuah bulan jatuh tanggal
  20, persediaan akhir bulan itu dinilai atas hitungan tanggal 20 — tercatat dan ditampilkan, tetapi
  tetap sepuluh hari lebih tua. Yang benar adalah disiplin opname akhir bulan, bukan pelonggaran di
  kode.
- **Kurs tengah bukan nilai realisasi.** Outlet menjual valutanya ke bank pada kurs beli, yang lebih
  rendah. Persediaan akhir karena itu sedikit lebih tinggi daripada nilai yang akan benar-benar
  diterima. Ini pilihan yang lazim dan sudah diputuskan (keputusan 4), bukan kekeliruan — tetapi
  perlu diketahui bila kelak ada pertanyaan tentang kehati-hatian penilaian.
- **Penutupan yang salah harus dibalik lewat jurnal balik.** `reverseJournalEntry` sudah ada dan
  bekerja, tetapi `valuationPostedAt` tidak ikut dikosongkan olehnya — periode yang penilaiannya
  dibalik akan tetap tampak "sudah dinilai". Membuka kembali periode lalu menilai ulang menuntut
  langkah manual. Ini tidak diselesaikan paket ini; bila sering terjadi, ia pantas menjadi pekerjaan
  tersendiri.
- **Selisih pembulatan penilaian melebur ke harga pokok.** Nilainya paling banyak setengah sen per
  mata uang per periode, tetapi ia memang tidak dapat ditelusuri sebagai pos tersendiri.
