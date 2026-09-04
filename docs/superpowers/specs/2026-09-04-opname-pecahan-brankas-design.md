# Paket D — Opname menyeluruh: pecahan dan brankas

Tanggal 4 September 2026. Disetujui sebelum implementasi.

**Temuan BI 6** — *"stock opname harus mencakup seluruh persediaan termasuk brankas dan Rupiah."*
Tenggat 28 Agustus 2026, sudah lewat.

## Masalah

Opname Rupiah sendiri **sudah bisa dibuka** — IDR adalah baris `currencies` biasa, jadi bagian
temuan itu tidak perlu diperbaiki. Dua celah lain nyata, dan keduanya sudah ditelusuri langsung ke
kodenya.

### 1. Hitungan fisiknya satu angka total

`submitStockOpname` (`server/operations.ts:2890`) menerima `physicalBalance` tunggal yang **diketik
petugas**, lalu membandingkannya dengan `cash_balances.availableAmount`. Rincian pecahan tidak
pernah diminta dan tidak pernah dibandingkan.

Padahal `cash_denomination_balances` menyimpan stok pecahan berjalan yang dihitung sistem sepanjang
hari — dan `CLAUDE.md` menyatakan stok itu **sumber kebenaran operasional, bukan catatan tambahan**.
Stok itu tidak pernah punya lawan hitung fisik. Selisih komposisi (sistem 5×100rb, laci 10×50rb)
lolos tanpa suara karena totalnya sama.

Ini juga tidak konsisten dengan seluruh jalur kas fisik lain sejak paket A: kas awal, penyesuaian
brankas, setoran modal, pemindahan kas↔bank, dan kedua sisi bon semuanya **menghitung nominal dari
rincian pecahan**. Hanya opname — satu-satunya tempat uang benar-benar dihitung ulang — yang masih
menerima angka ketikan.

### 2. Brankas tidak pernah dihitung fisik

Pembanding opname adalah `cash_balances.availableAmount`, yang menurut keputusan rancangan yang
tercatat (`server/ledgerOperations.ts:735-742`) **hanya berisi laci**. Isi brankas tidak disimpan di
mana pun; ia hanya **diturunkan** dari mutasi `SAFE_DEPOSIT` dikurangi `SAFE_WITHDRAWAL`
(`getCashReconciliation`, `server/ledgerOperations.ts:763-778`).

Angka turunan itu tidak pernah diuji terhadap uang sungguhan. Bila satu setoran brankas tidak
tercatat, atau tercatat dengan pecahan yang salah, tidak ada satu pun kontrol di aplikasi ini yang
akan menemukannya — panel rekonsiliasi kas justru akan tampak **cocok**, karena ia memakai angka
turunan yang sama sebagai kebenaran.

## Yang sudah diputuskan pengguna

Ditanyakan dan dijawab pada sesi rancangan ini, 4 September 2026.

1. **Brankas menjadi kolom tambahan pada baris opname yang sama**, bukan baris tersendiri.
   `stock_opnames_date_currency_uq` (tanggal + mata uang) **tidak berubah**, migrasinya murni
   aditif, dan seluruh riwayat opname lama tetap valid tanpa pengisian mundur.
2. **Selisih komposisi pecahan yang totalnya nol tetap `VARIANCE`** dan wajib ditinjau Supervisor.
   Komposisi yang meleset berarti ada pergerakan tak tercatat, tukar pecahan yang tak dibukukan,
   atau salah hitung — total nol menyembunyikannya, dan itulah persis celah yang ditutup paket ini.
3. **Rincian pecahan wajib tanpa pengecualian, termasuk untuk opname historis.** Impor catatan lama
   tanpa rincian pecahan ditolak.
4. **Hitungan brankas dirinci per pecahan penuh**, bukan satu angka total. Uang di brankas sama
   fisiknya dengan uang di laci; mencakup brankas dengan satu angka total hanya memindahkan celah
   yang sama satu tingkat lebih dalam.

### Temuan yang mengubah ongkos keputusan 3

Keputusan 3 dipilih setelah saya menyebut risikonya memblokir impor catatan lama. Penelusuran
sesudahnya menunjukkan **risiko itu tidak ada hari ini**: `openStockOpname`
(`server/operations.ts:2883`) adalah **satu-satunya** penulis `stock_opnames` di seluruh proyek —
tidak ada skrip impor, tidak ada jalur lain — dan ia selalu menulis `isHistorical = false` (nilai
bawaan kolomnya). Pada `stock_opnames`, `isHistorical` dan `historicalSourceKey` sampai hari ini
hanya pernah **dibaca untuk dikecualikan**, tidak pernah ditulis.

Jadi keputusan 3 tidak memblokir apa pun yang ada sekarang. Ia menjadi **invarian ke depan**: bila
kelak ada importir opname historis, ia wajib membawa rincian pecahan. Konsekuensi implementasinya:
`submitStockOpname` mewajibkan rincian pecahan **tanpa cabang pengecualian `isHistorical`**, dan
spec ini mencatat bahwa cabang seperti itu tidak boleh ditambahkan belakangan.

## Rancangan

### 1. Skema — satu tabel baru dan tiga kolom, murni aditif

Migrasi `0045`. Tidak ada yang di-drop, tidak ada indeks yang diubah, tidak ada kolom yang berubah
tipe.

Kolom baru pada `stock_opnames`, semuanya **nullable** supaya baris lama tetap sah apa adanya:

| Kolom | Arti |
|---|---|
| `physicalCounterBalance` decimal(24,6) | Hasil hitung fisik **laci**, dijumlahkan dari pecahan |
| `physicalSafeBalance` decimal(24,6) | Hasil hitung fisik **brankas**, dijumlahkan dari pecahan |
| `closingSystemSafeBalance` decimal(24,6) | Isi brankas menurut sistem saat opname dikirim |
| `hasDenominationVariance` boolean, default `false` | Ada pecahan yang komposisinya meleset |

Tabel baru `stock_opname_denominations`:

```
id, stockOpnameId, location ENUM('COUNTER','SAFE'),
denominationValue decimal(24,6), quantity int, subtotal decimal(24,6), createdAt
UNIQUE(stockOpnameId, location, denominationValue)
INDEX(stockOpnameId)
```

Bentuknya sengaja meniru `cash_denomination_entries` (`drizzle/schema.ts`) supaya pembacaannya
seragam. Yang berbeda hanya `location`, karena satu opname menghitung dua tempat.

**Arti kolom lama tidak digeser.** `closingSystemBalance` tetap berarti **laci saja**, persis
seperti sekarang. Yang berubah hanya arti `physicalBalance`, yang kini **total laci + brankas** —
dan `variance` menjadi:

```
variance = physicalBalance − (closingSystemBalance + COALESCE(closingSystemSafeBalance, 0))
```

Pada baris lama `closingSystemSafeBalance` bernilai NULL sehingga aritmetikanya **identik dengan
hari ini**. Tidak ada angka riwayat yang berubah maknanya secara diam-diam.

### 2. Sisi sistem: dari mana angka pembandingnya diambil

Dua tempat, dan keduanya sudah ada — paket ini **tidak** menambah penyimpanan stok berjalan baru.

**Laci per pecahan** — `cash_denomination_balances`, dibaca langsung.

> Jebakan yang harus dihindari: `listCashDenominationBalances` (`server/operations.ts:2438`)
> menyaring `quantity > 0`. Untuk pembandingan opname penyaring itu **tidak boleh dipakai** —
> pecahan yang ada di tangan petugas tetapi nol di sistem justru selisih yang paling penting
> ditemukan. Pembandingnya membaca tanpa penyaring dan memperlakukan pecahan yang tidak ada sebagai
> nol di kedua arah.

**Brankas per pecahan** — **diturunkan**, tidak disimpan: jumlah `cash_denomination_entries` dari
mutasi berkategori `SAFE_DEPOSIT` dikurangi yang berkategori `SAFE_WITHDRAWAL`, pada saldo kas mata
uang itu. Ini persis logika total yang sudah dipakai `getCashReconciliation`
(`server/ledgerOperations.ts:763-778`), hanya dipecah per pecahan.

Diturunkan, bukan disimpan, dengan alasan yang disengaja: stok berjalan kedua yang harus dijaga
serempak adalah sumber ketidakcocokan baru, dan brankas bergerak jauh lebih jarang daripada laci.
`OFF_HOURS_SALE` **tidak** ikut dihitung — uang itu keluar dari laci karena terjual, bukan masuk
brankas; ini juga sudah menjadi perilaku `getCashReconciliation` hari ini.

### 3. Aturan varians

Tiga hal dinilai, dan **ketiganya** dapat menyalakan `VARIANCE`:

1. `variance` total ≠ 0.
2. Ada pecahan **laci** yang jumlah fisiknya ≠ jumlah sistem.
3. Ada pecahan **brankas** yang jumlah fisiknya ≠ jumlah sistem.

Nomor 2 dan 3 diringkas ke satu kolom `hasDenominationVariance` yang dihitung **saat pengiriman**,
bukan saat pemeriksaan — supaya keputusan Supervisor tidak bergantung pada stok berjalan yang sudah
bergerak sejak opname dikirim.

`reconcileStockOpname` (`server/operations.ts:2905`) menjadi:

```ts
const hasVariance = !new Decimal(String(opname.variance ?? "0")).isZero() || opname.hasDenominationVariance;
```

Butir "Direksi Mengetahui" (`createDirectorKnowledgeItem`) yang sudah ada ikut menyala untuk selisih
komposisi, dengan detail yang menyebutkan pecahan mana yang meleset — bukan hanya angka total, yang
untuk kasus ini justru nol dan menyesatkan bila berdiri sendiri.

### 4. Nominal dihitung dari pecahan, tidak diketik

`submitStockOpname` tidak lagi menerima `physicalBalance`. Ia menerima dua daftar pecahan dan
menghitung sendiri:

```
physicalCounterBalance = Σ(nilai × jumlah) pecahan laci
physicalSafeBalance    = Σ(nilai × jumlah) pecahan brankas
physicalBalance        = physicalCounterBalance + physicalSafeBalance
```

Sama seperti setiap jalur kas fisik lain sejak paket A. Validasi nilai pecahan memakai
`assertKnownDenomination` (`server/operations.ts:51`) yang sudah ada, sehingga "IDR 131.250.000 ×
1 lembar" mustahil masuk lewat opname sebagaimana ia sudah mustahil lewat kas awal.

Daftar pecahan **laci wajib** tidak kosong. Daftar **brankas boleh kosong** — outlet yang brankasnya
memang kosong harus bisa menyatakan itu, dan pernyataan "brankas kosong" berbeda dari "brankas tidak
dihitung": yang pertama menghasilkan `physicalSafeBalance = 0` dan tetap dibandingkan dengan sistem
(sehingga brankas yang menurut sistem berisi akan langsung menyalakan varians), yang kedua tidak ada
lagi sebagai pilihan.

### 5. UI

Tab **Stock Opname** (`client/src/pages/StockControl.tsx:285-297`) mengikuti pola form pecahan yang
sudah terbukti di tab Kas Awal pada berkas yang sama, termasuk `DenominationValueInput`
(`client/src/components/DenominationValueInput.tsx`) yang mengunci nilai pecahan ke daftar pecahan
asli mata uang itu.

Dua blok, **Laci** dan **Brankas**, masing-masing dengan barisnya sendiri dan subtotal berjalan.
Total keduanya ditampilkan di atas tombol kirim, di samping angka sistem, sehingga petugas melihat
selisihnya **sebelum** mengirim.

Setelah dikirim, rincian varians ditampilkan **per pecahan** — bukan hanya total — dengan tanda
untuk pecahan yang berbeda. Menampilkan hanya total akan menyembunyikan tepat kasus yang keputusan 2
memutuskan tidak boleh disembunyikan.

## Yang sengaja tidak dikerjakan

- **Jangan menambahkan akun "Kas di Brankas" ke bagan akun.** B0002 hanya menyediakan satu baris
  kas; brankas adalah lokasi fisik, bukan akun.
- **Jangan menjurnal selisih opname secara otomatis.** Opname hari ini tidak menyentuh
  `cash_balances` sama sekali, dan paket ini mempertahankannya. Menulis penyesuaian kas dari hasil
  hitung adalah keputusan operasional tersendiri (siapa yang berwenang, dengan persetujuan siapa)
  yang belum ditanyakan kepada pengguna — lihat Risiko residual.
- **Jangan membuat tabel stok berjalan untuk brankas.** Isinya diturunkan dari mutasi yang sudah
  ada; stok berjalan kedua berarti dua sumber kebenaran yang harus dijaga serempak.
- **Jangan mengubah `stock_opnames_date_currency_uq`.** Keputusan 1 memilih bentuk yang tidak
  menuntutnya.
- **Jangan mengubah arti `closingSystemBalance`.** Ia tetap laci saja; brankas mendapat kolomnya
  sendiri.
- **Jangan menambahkan cabang pengecualian `isHistorical`** pada kewajiban rincian pecahan.

## Risiko residual

- **Selisih opname masih tidak memperbaiki apa pun secara otomatis.** Setelah paket ini, selisih
  komposisi pecahan akan **terlihat** dan tertahan di status `VARIANCE`, tetapi stok pecahan
  berjalan tetap memakai angka sistem sampai seseorang mencatat penyesuaian manual lewat tab
  Penyesuaian Brankas. Aplikasi menemukan masalahnya; menutupnya masih pekerjaan manusia. Ini
  disengaja untuk paket ini, dan pantas menjadi paket tersendiri bila pengguna menginginkannya.
- **Isi brankas tetap angka turunan.** Setelah paket ini ia akhirnya punya lawan hitung fisik pada
  hari opname, tetapi di antara dua opname ia masih hanya sebaik mutasi `SAFE_DEPOSIT`/
  `SAFE_WITHDRAWAL` yang dicatat.
- **Beban hitung petugas bertambah nyata.** Menghitung brankas per pecahan setiap kali opname lebih
  lama daripada menulis satu angka. Itu memang yang diminta temuan BI 6, tetapi bila di lapangan
  terasa berat, yang benar adalah mengubah **frekuensi** opname brankas lewat keputusan operasional
  tertulis — bukan menurunkan rinciannya menjadi satu angka lagi.
- **Mata uang tanpa daftar pecahan baku** (`CURRENCY_DENOMINATIONS`, `shared/currencyDenominations.ts`)
  jatuh ke isian bebas dengan peringatan, sama seperti jalur kas lain. Validasi nilainya tetap
  bergantung pada ketelitian petugas.
