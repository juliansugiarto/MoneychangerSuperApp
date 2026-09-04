# Paket A — Penjurnalan kas, setoran modal, dan mutasi kas↔bank

Tanggal 4 September 2026. Disetujui sebelum implementasi.

## Masalah

Akun 1-1110 Kas Rupiah pada buku besar tampil **negatif** di outlet yang lebih banyak membeli
daripada menjual.

Sebab yang terlihat: hanya sisi kas bon yang terjurnal. Sebab yang sebenarnya, setelah menelusuri
setiap jalur yang menyentuh `cash_balances` dan `bank_accounts`, lebih dalam dari itu.

Jalur yang ada hari ini:

| Jalur | Fungsi |
|---|---|
| Bon valuta | `completeTransaction` |
| Deklarasi hitungan pagi | `recordOpeningCash` (`server/operations.ts:2548`) |
| Brankas, luar jam, lain-lain | `recordCashAdjustment` (`server/operations.ts:2578`) |
| Saldo pembukaan rekening | `createBankAccount` (`server/operations.ts:2341`) |
| Tukar pecahan | `recordDenominationExchange` |

**Tidak satu pun berarti "pemilik menyetor modal", "pemilik menarik uang", atau "kas disetor ke
bank / ditarik dari bank".** Padahal outlet yang lebih banyak membeli daripada menjual pasti
menarik Rupiah dari bank untuk mengisi laci. Satu-satunya cara mencatatnya hari ini adalah dengan
menaikkan hitungan kas pagi — sehingga uang modal masuk **menyamar sebagai selisih hitungan**.

Karena itu Kas Rupiah negatif bukan karena mutasi kas belum dijurnal, melainkan karena pemasukan
modalnya tidak punya tempat untuk dicatat, sehingga tidak ada yang bisa dijurnal.

## Yang sudah diputuskan pengguna

1. **Buku besar mulai dari nol.** Tidak ada pembukuan lama yang dilanjutkan — tidak perlu layar
   migrasi saldo awal, tidak perlu mengisi Laba Ditahan atau aset tetap lama.
2. **Penarikan uang oleh pemilik dicatat sebagai Prive/Dividen (3-4100)**, akun lawan ekuitas —
   bukan sebagai pengurangan Modal Disetor.
3. **Dikerjakan lebih dulu di antara tiga paket.** Paket B (form data awal perusahaan saat login
   pertama shareholder) dan paket C (revaluasi/penutupan kas UKA) menyusul, masing-masing dengan
   spec sendiri. B memanggil mekanisme setoran modal dari A; C mengisi 1-1210 dan 5-1300.

## Rancangan

### 1. Skema — hanya nilai enum, tidak ada kolom baru

Migrasi `0044`, murni aditif dan tidak destruktif.

`cash_balance_movements.category` bertambah:
`CAPITAL_INJECTION`, `CAPITAL_WITHDRAWAL`, `BANK_DEPOSIT`, `BANK_WITHDRAWAL`.

`bank_account_movements.category` bertambah:
`CAPITAL_INJECTION`, `CAPITAL_WITHDRAWAL`, `CASH_TRANSFER`.

**Pemindahan kas↔bank menulis dua baris mutasi, tetapi hanya dijurnal dari sisi kas.** Sisi banknya
berkategori `CASH_TRANSFER` dan sengaja dilewati dengan alasan "sudah terjurnal lewat sisi kas".
Ini pola yang sama dengan `TRANSACTION` di sisi kas, dan menghindarkan kolom penghubung antar tabel.

### 2. Lapisan operasi

Dua fungsi baru di `server/operations.ts`, keduanya **CONTROLLER ke atas** — uang yang melintasi
batas usaha bukan keputusan kasir.

**`recordCapitalMovement({ currencyId, direction: "IN" | "OUT", amount, notes, denominations })`**

Setoran dan penarikan modal. **Rupiah saja**; mata uang lain ditolak dengan pesan jelas, karena
menjurnalnya menuntut kurs yang tidak tersedia di tabel mutasi. Rincian pecahan wajib, sesuai
aturan keras `CLAUDE.md`. Penarikan ditolak bila melebihi saldo kas tersedia.

**`recordCashBankTransfer({ currencyId, bankAccountId, direction: "TO_BANK" | "TO_CASH", amount, notes, denominations })`**

Satu `db.transaction` yang menggerakkan `cashBalances` dan `bankAccounts` sekaligus, menulis dua
baris mutasi, memperbarui stok pecahan, dan satu baris audit. Menolak: mata uang rekening tidak
cocok dengan mata uang kas, saldo sisi asal kurang, rincian pecahan tidak rekonsiliasi.

**Perbaikan terarah.** Penguncian baris `FOR UPDATE`, rekonsiliasi pecahan, dan delta stok pecahan
saat ini tertulis inline di `recordCashAdjustment`. Menyalinnya dua kali lagi akan melahirkan tiga
salinan logika kas fisik yang harus dijaga serempak. Karena itu bagian itu ditarik menjadi helper
`applyCashMovement(tx, { currencyId, direction, amount, reason, category, denominations, actor })`,
lalu `recordCashAdjustment` ikut memakainya. Perilakunya tidak berubah; uji yang ada menjaganya.

### 3. Pemetaan jurnal

`mapCashMovement` dan `mapBankMovement` di `shared/journalMapping.ts`, mengikuti kontrak
`MappingResult` yang sudah ada: yang tidak dapat dipetakan tanpa menebak dikembalikan sebagai
`skipped` beserta alasannya, bukan dipaksakan ke akun yang kira-kira cocok.

#### Mutasi kas

| Kategori | Jurnal |
|---|---|
| `CAPITAL_INJECTION` | Dr 1-1110 Kas Rupiah / Cr 3-1100 Modal Disetor |
| `CAPITAL_WITHDRAWAL` | Dr 3-4100 Dividen / Cr 1-1110 Kas Rupiah |
| `BANK_DEPOSIT` | Dr 1-1120 Bank Rupiah / Cr 1-1110 Kas Rupiah |
| `BANK_WITHDRAWAL` | Dr 1-1110 Kas Rupiah / Cr 1-1120 Bank Rupiah |
| `OPENING`, selisih ≠ 0 | Selisih hitung fisik ke 7-1900; arahnya mengikuti tanda selisih |
| `OPENING`, selisih = 0 | Lewati — tidak ada selisih |
| `OPENING`, mutasi pertama mata uang itu dan positif | **Lewati** — lihat di bawah |
| `TRANSACTION` | Lewati — sisi kas bon sudah terjurnal lewat bonnya |
| `SAFE_DEPOSIT`, `SAFE_WITHDRAWAL` | Lewati — B0002 hanya punya satu baris Kas Rupiah |
| `DENOMINATION_EXCHANGE` | Lewati — pasangan OUT+IN bernilai sama, net nol |
| `OFF_HOURS_SALE` | Lewati — tidak ada nilai Rupiah lawannya; seharusnya dicatat sebagai bon |
| `OTHER` | Lewati — catatan teks bebas, tidak dapat dipetakan tanpa menebak |
| mata uang ≠ IDR | Lewati — persediaan periodik; masuk lewat opname akhir periode (paket C) |

**Kas awal pertama sengaja ditolak, bukan ditebak.** Bila operator mencatat kas awal Rp 500 juta
sebelum mencatat setoran modalnya, seluruh Rp 500 juta itu akan jatuh ke 7-1900 sebagai pendapatan
lain-lain dan menggelembungkan laba. Karena itu mutasi `OPENING` yang merupakan mutasi **pertama**
untuk mata uang tersebut dan bernilai positif tidak dijurnal, melainkan dilewati dengan alasan:
*"kas awal pertama; asal uangnya belum tercatat — catat sebagai setoran modal lebih dulu."*

Urutan yang benar — setor modal dulu, baru hitung kas awal — membuat selisih pembukaannya nol dan
terlewati dengan wajar. Paket B menjadikan urutan itu tidak perlu diingat sendiri oleh operator.

#### Mutasi bank

| Kategori | Jurnal |
|---|---|
| `OPENING` | Dr 1-1120 Bank Rupiah / Cr 3-1100 Modal Disetor |
| `CAPITAL_INJECTION` | Dr 1-1120 Bank Rupiah / Cr 3-1100 Modal Disetor |
| `CAPITAL_WITHDRAWAL` | Dr 3-4100 Dividen / Cr 1-1120 Bank Rupiah |
| `CASH_TRANSFER` | Lewati — sudah terjurnal lewat sisi kas |
| `TRANSACTION` | Lewati — sudah terjurnal lewat bonnya |
| `ADJUSTMENT`, `OTHER` | Lewati — catatan teks bebas |
| mata uang ≠ IDR | Lewati |

`OPENING` bank diperlakukan berbeda dari `OPENING` kas, dan itu disengaja: rekening bank hanya
dibuat sekali dan tidak mengenal salah hitung fisik, sehingga saldo pembukaannya tidak ambigu. Di
bawah "mulai dari nol" itu pasti uang yang dibawa masuk pemilik. Perlakuan ini juga menghindarkan
perubahan pada UI rekening yang sudah ada.

### 4. Lapisan posting

Di `server/ledgerPosting.ts`, mengikuti bentuk `postExchangeTransactions` dan `postExpenses`:

- `postCashMovements` — `sourceType` `MUTASI_KAS`, rujukan `KAS-<id>`
- `postBankMovements` — `sourceType` `MUTASI_BANK`, rujukan `BANK-<id>`

Keduanya disambungkan ke `postOperationsToLedger` dan ikut dalam ringkasan auditnya. Idempoten
lewat kunci unik `(sourceType, sourceReference)` yang sudah ada, jadi menjalankan ulang rentang
yang sama tidak menghasilkan jurnal ganda.

Tanggal jurnal diambil dari `createdAt` mutasi. Batas rentang memakai pola `dbDate` yang sudah ada
(`server/ledgerPosting.ts:29`) — tengah malam waktu lokal hari yang dimaksud, bukan tengah malam
UTC. Lihat catatan tanggal MySQL di `docs/HANDOFF-OPUS.md`.

Penanda "mutasi pertama untuk mata uang ini" dihitung di lapisan posting dengan satu kueri murah
per saldo kas (adakah baris `cash_balance_movements` yang lebih awal untuk `cashBalanceId` itu),
lalu diteruskan ke `mapCashMovement`. Pemetaannya sendiri tetap murni dan dapat diuji tanpa basis
data.

### 5. Antarmuka

**`client/src/pages/StockControl.tsx`** — dua tindakan baru dengan komponen rincian pecahan yang
sudah ada: "Setoran / Penarikan Modal" dan "Pindah Kas ↔ Bank". Keduanya hanya tampil bagi
CONTROLLER ke atas, dengan otorisasi tetap ditegakkan di tRPC, bukan sekadar disembunyikan di UI.
Wajib memiliki loading, empty, dan error state, serta teks tindakan yang jelas.

**`client/src/pages/BukuBesar.tsx`** — panel rekonsiliasi kas.

Panel ini wajib ada, bukan tambahan kosmetik. Karena `SAFE_DEPOSIT` mengurangi
`cash_balances.availableAmount` tetapi sengaja tidak mengurangi buku besar, kedua angka itu akan
berbeda sebesar isi brankas. Selisih yang tidak terlihat persis melahirkan kembali temuan
pemeriksaan 7.2/7.3. Panelnya menampilkan saldo 1-1110 pada buku besar, kas operasional menurut
`cash_balances`, dan selisihnya yang diturunkan dari mutasi `SAFE_*` — sehingga selisihnya dapat
**ditunjukkan**, bukan sekadar ada.

### 6. Pengujian

- **Pemetaan** (`shared/journalMapping.test.ts` atau berkas baru): tabel penuh setiap kategori ×
  arah, memastikan akun yang tepat, Dr = Cr pada setiap hasil, dan setiap `skipped` membawa alasan
  yang dapat dibaca manusia. Termasuk kasus kas awal pertama dan selisih pembukaan bertanda negatif.
- **`recordCashBankTransfer`**: kedua sisi bergerak bersama; mata uang rekening tidak cocok
  ditolak; saldo asal kurang ditolak; pecahan tidak rekonsiliasi ditolak; kegagalan di tengah
  membatalkan kedua sisi.
- **`recordCapitalMovement`**: hanya IDR; hanya CONTROLLER ke atas; pecahan wajib; penarikan
  melebihi saldo ditolak.
- **Idempotensi posting**: dijalankan dua kali atas rentang yang sama menghasilkan `alreadyPosted`,
  bukan jurnal ganda.
- **Skenario operasional utuh** sesuai `CLAUDE.md`: setor modal → kas awal → beli → jual → opname.
  Asersi akhir: saldo 1-1110 pada buku besar sama dengan kas operasional ditambah isi brankas.

Membuat data uji transaksi atau kas di basis data lokal memerlukan izin pengguna pada giliran itu
juga. Uji di atas ditulis sebagai uji Vitest atas fungsi, bukan atas data produksi.

## Yang sengaja tidak dikerjakan di paket ini

- **`jakartaBusinessDate`** pada `dailyOperationalChecklists.businessDate` dan
  `stockOpnames.opnameDate` — mengubahnya menyentuh tutup buku, opname, dan checklist sekaligus,
  jadi memerlukan rencana tersendiri. Lihat `docs/HANDOFF-OPUS.md`.
- **`OFF_HOURS_SALE`** — tabelnya tidak menyimpan nilai Rupiah, kurs, maupun lawan transaksi,
  sehingga tidak dapat dijurnal tanpa mengarang. Ini cacat produk: penjualan di luar jam seharusnya
  dicatat sebagai bon. Dicatat sebagai temuan terpisah, tidak ditambal di sini.
- **Akun "Kas di Brankas"** — B0002 hanya menyediakan satu baris kas, dan bagan akun sengaja
  dipetakan satu-satu ke baris formulir.
- **Setoran modal dalam valuta asing** — memerlukan kebijakan kurs yang menjadi bahasan paket C.

## Risiko residual

- Saldo 1-1110 pada buku besar akan berbeda dari `cash_balances.availableAmount` sebesar isi
  brankas. Ini konsekuensi rancangan yang disengaja, dan panel rekonsiliasi membuatnya dapat
  dijelaskan. Bila selisihnya kelak perlu dihapus, jalannya adalah menyatukan definisi kas
  operasional, bukan menambah akun.
- Neraca belum akan seimbang sampai paket C mengisi 1-1210 Kas UKA. Kas Rupiah sudah benar setelah
  paket A, tetapi persediaan valutanya belum bernilai.
- Bagan akun masih perlu ditinjau seorang akuntan satu kali. Kekeliruan di sana menurun ke setiap
  pelanggan sekaligus.
