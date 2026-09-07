# Paket F2 — Arus Kas dan CALK

**Ditulis 7 September 2026**, sesudah Paket F1 selesai dan diperagakan end-to-end. Paket ini
melengkapi lima laporan yang SAK EP tuntut: tiga yang sudah ada ditambah Laporan Arus Kas dan
Catatan atas Laporan Keuangan.

---

## Masalah

### 1. Dua dari lima laporan belum ada

`server/financialStatements.ts` menghasilkan **tiga** laporan — Posisi Keuangan, Laba Rugi, dan
Perubahan Ekuitas — lengkap dengan kolom pembanding dari `priorRange`
(`server/financialStatements.ts:28`). SAK EP Bab 3 menuntut **lima** (memori sesi
`financial-reporting-sak-ep`, diverifikasi 3 September 2026 dari naskah pengguna). Arus Kas dan
CALK belum ada sama sekali.

Form B0002/B0003/B0004 memang tidak memintanya — dan justru itu masalahnya. Yang tidak diminta
formulir tidak akan pernah dikerjakan orang yang mengisi Excel, sementara standarnya tetap
menuntut, dan pemeriksa membaca standarnya.

### 2. Tidak ada satu pun jurnal yang membayar beban atau aset dengan kas

Ini temuan penelusuran 7 September 2026, dan ia mengubah bentuk paket ini.

| Kejadian | Jurnal hari ini | Baris kas |
|---|---|---|
| Pengeluaran operasional | Dr 6-1xxx / Cr **2-1900** (`shared/journalMapping.ts:108`) | tidak ada |
| Perolehan aset tetap | Dr 1-1510 / Cr **2-1900** (`shared/journalMapping.ts:421`) | tidak ada |
| Pelepasan aset tetap | Dr **1-1320** / … (`shared/journalMapping.ts:459`) | tidak ada |

Keduanya disengaja dan alasannya benar: modul di luar sistem kas yang mengkredit 1-1110 akan
membuat kas buku besar berbeda dari `cash_balances` — persis ketidakcocokan yang menjadi temuan
pemeriksaan 7.2/7.3. Komentar pada `shared/journalMapping.ts:104` menjanjikan lanjutannya:
*"pelunasannya dijurnal terpisah saat kas benar-benar keluar."*

**Pelunasan itu tidak pernah ditulis.** Tidak ada pemanggil yang mengurangi 2-1900 maupun
menagih 1-1320. Buku besar lokal memperlihatkannya telanjang: 2-1900 bersaldo kredit
Rp 24.000.000 sejak aset tetap didaftarkan pada paket E, dan akun 1-1110 serta 1-1120 belum
pernah bergerak satu kali pun.

Akibatnya bagi paket ini:

- **Bagian operasi** tidak akan pernah memuat pembayaran beban. Laporan yang memperlihatkan
  penerimaan penjualan tanpa satu pun pembayaran beban bukan laporan yang kurang lengkap, ia
  laporan yang menyesatkan.
- **Bagian investasi** kosong selamanya. Menyajikan jurnal `PEROLEHAN_ASET` sebagai arus kas
  berarti melaporkan uang yang tidak pernah bergerak, dan `reconciled` akan gagal secara struktural
  — bukan karena ada yang salah, melainkan karena angkanya memang bukan arus kas.

Menurut aturan proyek `CLAUDE.md` "Fitur Harus Punya Sumber Data" (5 September 2026), keadaan ini
adalah **pekerjaan yang belum selesai**, bukan keadaan sah: fitur yang menuntut data yang belum
pernah ditulis kode mana pun harus membawa penulisnya dalam paket yang sama, atau tidak dibangun.
Karena itu penulis pelunasan masuk ke dalam paket ini, sebagai empat tugas pertamanya.

### 3. Yang sudah disediakan dan menganggur

| Yang menganggur | Tempat | Untuk apa disediakan |
|---|---|---|
| `CASH_ACCOUNTS` | `shared/currencyRevaluation.ts:19` | Definisi kas dan setara kas pada paket ini |
| Jurnal `REVALUASI_KURS` per periode | ditulis paket F1 | Baris "Pengaruh perubahan kurs atas kas" |
| `journalEntryLines.currencyCode` / `foreignAmount` | `drizzle/schema.ts:1440` | Rincian kas valuta pada catatan CALK |

---

## Yang sudah diputuskan pengguna

### Diputuskan 5 September 2026 — dipakai apa adanya

1. **Kas dan setara kas = `1-1110` + `1-1120` + `1-1220`.** Kas UKA fisik (`1-1210`) bukan kas;
   ia persediaan, dinilai lewat `5-1300` pada jalur Paket C.
2. **Arus Kas mengikuti rentang tanggal bebas** yang sama dengan ketiga laporan lain, beserta
   kolom pembandingnya dari `priorRange`. Bukan tahunan, bukan per periode bulanan.
3. **CALK hibrida.** Catatan yang angkanya diketahui buku besar dibangkitkan dan tidak pernah
   diketik; kebijakan akuntansi dan sejenisnya berupa teks tersimpan. Angka tidak pernah diketik
   ulang, sehingga tidak dapat berselisih dengan laporannya.
4. **Bagian investasi bruto dan menunjuk nomor jurnalnya**, bukan diturunkan dari selisih saldo.
   Ada keranjang **"Belum terklasifikasi"** yang terlihat beserta nomor jurnalnya, dan penanda
   **`reconciled`** yang membandingkan perubahan kas hasil hitungan dengan pergerakan nyata ketiga
   akun kas. Selisih muncul sebagai peringatan, **tidak pernah** sebagai pos penyeimbang.

### Diputuskan 7 September 2026

5. **Metode langsung, diklasifikasi per jurnal kas.** Tiap jurnal yang benar-benar menyentuh
   ketiga akun kas diklasifikasi dari `sourceType` dan akun lawannya. Bukan metode tidak langsung.
6. **Penulis pelunasan masuk ke dalam Paket F2**, bukan dikeluarkan menjadi paket tersendiri.
7. **Daftar catatan CALK: delapan bangkitan dan tujuh naratif** — dirinci pada rancangan bagian 6.
8. **Teks naratif disimpan pada tabel sendiri**, berkunci `(noteKey, periodKey)`; `periodKey`
   kosong berarti berlaku terus, terisi berarti khas periode itu.
9. **Halaman baru `/operasional/laporan-keuangan`.** Kelima laporan pindah ke halaman sendiri,
   terlepas dari Buku Besar.

### Penajaman keputusan 4 yang dituntut penelusuran kode

Keputusan 4 menyebut bagian investasi "dibaca dari `sourceType` `PEROLEHAN_ASET`/`PELEPASAN_ASET`".
Jurnal kedua `sourceType` itu **tidak memuat satu pun baris kas** (lihat Masalah 2), sehingga
membacanya sebagai arus kas melaporkan uang yang tidak pernah bergerak.

Yang dipertahankan dari keputusan itu adalah maksudnya, dan seluruhnya dipertahankan: bruto bukan
neto, dari kejadian bukan dari selisih saldo, dan tiap baris menunjuk nomor jurnalnya. Yang berubah
hanya **kejadian mana** yang dibaca: **pelunasan yang menunjuk aset tetapnya**, yaitu saat uangnya
benar-benar keluar atau masuk. Perolehan yang belum dibayar tetap terlihat — sebagai catatan CALK
"transaksi nonkas", tempat SAK EP memang memintanya, bukan sebagai arus kas yang tidak terjadi.

---

## Rancangan

### 1. Skema — migrasi `0050`, aditif

**Dua kategori baru** pada `cashBalanceMovements.category` dan `bankAccountMovements.category`:

```ts
"KEWAJIBAN_DIBAYAR",   // uang keluar melunasi 2-1900
"PIUTANG_DITERIMA",    // uang masuk menagih 1-1320
```

**Tabel `ledger_settlements`** — satu baris per pelunasan, yang mengikat mutasi kas/bank ke apa
yang dilunasinya:

```ts
export const ledgerSettlements = mysqlTable("ledger_settlements", {
  id: int("id").autoincrement().primaryKey(),
  settlementDate: date("settlementDate").notNull(),
  direction: mysqlEnum("direction", ["PEMBAYARAN", "PENERIMAAN"]).notNull(),
  /** Apa yang dilunasi. Inilah yang memisahkan bagian operasi dari bagian investasi. */
  targetType: mysqlEnum("targetType", ["BEBAN", "ASET_TETAP"]).notNull(),
  expenseId: int("expenseId"),
  fixedAssetId: int("fixedAssetId"),
  amount: decimal("amount", { precision: 24, scale: 2 }).notNull(),
  /** Tepat satu dari keduanya terisi; menentukan akun kas mana yang bergerak. */
  cashMovementId: int("cashMovementId"),
  bankMovementId: int("bankMovementId"),
  notes: varchar("notes", { length: 500 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ledger_settlement_cash_movement_uq").on(table.cashMovementId),
  uniqueIndex("ledger_settlement_bank_movement_uq").on(table.bankMovementId),
  index("ledger_settlement_expense_idx").on(table.expenseId),
  index("ledger_settlement_asset_idx").on(table.fixedAssetId),
  index("ledger_settlement_date_idx").on(table.settlementDate),
]);
```

Kedua indeks unik itu yang mencegah satu mutasi kas dihitung dua kali sebagai pelunasan. MySQL
mengizinkan banyak NULL menembus indeks unik, sehingga sisi yang tidak dipakai tidak saling
menghalangi — pola yang sama dengan `cash_balance_transaction_line_movement_uq`.

**Tabel `financial_statement_notes`** — teks naratif CALK:

```ts
export const financialStatementNotes = mysqlTable("financial_statement_notes", {
  id: int("id").autoincrement().primaryKey(),
  noteKey: varchar("noteKey", { length: 60 }).notNull(),
  /**
   * "YYYY-MM" bulan akhir laporan, atau NULL untuk teks yang berlaku terus. Kebijakan akuntansi
   * tidak berganti tiap bulan; peristiwa setelah periode pelaporan justru selalu berganti.
   */
  periodKey: varchar("periodKey", { length: 7 }),
  bodyText: text("bodyText").notNull(),
  updatedByUserId: int("updatedByUserId").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("financial_note_key_period_uq").on(table.noteKey, table.periodKey)]);
```

**Tidak ada nilai `journalSourceTypes` baru dan tidak ada akun baru pada bagan akun.** Ini hasil
pemeriksaan ulang 7 September 2026: pelunasan **adalah** mutasi kas, sehingga ia dijurnal oleh
jalur `MUTASI_KAS`/`MUTASI_BANK` yang sudah ada dan idempotensinya sudah dijaga
`(sourceType, sourceReference)` dengan rujukan `KAS-{id}` / `BANK-{id}`
(`server/ledgerPosting.ts:179,297`). Rancangan awal sesi ini sempat menambahkan dua `sourceType`
dan satu poster baru; keduanya ternyata tidak diperlukan.

### 2. Jurnal pelunasan — dua kasus pada pemetaan yang sudah ada

`mapCashMovement` dan `mapBankMovement` menerima kedua kategori baru:

```
KEWAJIBAN_DIBAYAR  → Dr 2-1900 / Cr {1-1110 | 1-1120 | 1-1220}
PIUTANG_DITERIMA   → Dr {1-1110 | 1-1120 | 1-1220} / Cr 1-1320
```

Pemetaannya **tidak perlu tahu** apakah yang dilunasi beban atau aset tetap — jurnalnya sama
persis untuk keduanya, dan 2-1900 memang satu akun. Yang membedakan operasi dari investasi adalah
baris `ledger_settlements`, dan itu dibaca kemudian oleh penyusun Arus Kas. Pemetaan tetap murni.

Rekening valuta asing memakai jalur `rupiahAmount` yang sudah dibangun paket F1; tanpa kurs,
mutasinya dilewati beralasan, bukan ditebak.

### 3. `recordSettlement` — penulis yang selama ini hilang

Di `server/settlements.ts`, mengikuti pola `recordCapitalMovement`
(`server/operations.ts:2745`) baris demi baris:

```ts
export async function recordSettlement(
  input: {
    direction: "PEMBAYARAN" | "PENERIMAAN";
    targetType: "BEBAN" | "ASET_TETAP";
    expenseId?: number;
    fixedAssetId?: number;
    amount: string;
    method: "KAS" | "BANK";
    currencyId?: number;      // wajib untuk KAS
    bankAccountId?: number;   // wajib untuk BANK
    settlementDate: string;   // "YYYY-MM-DD"
    notes: string;
    denominations: DenominationEntryInput[];  // wajib untuk KAS
  },
  actor: { id: number; role: StaffRole },
)
```

Yang ditegakkan, dan mengapa:

- **Rincian pecahan wajib untuk jalur kas.** Aturan keras `CLAUDE.md`: setiap pergerakan kas fisik
  mengisi pecahannya, dan `cash_denomination_balances` adalah sumber kebenaran operasional.
  Divalidasi lewat `reconcileDenominations` yang sudah ada, sama seperti setoran modal.
- **Nominal tidak melebihi sisa tagihan.** Sisa = nominal beban atau harga perolehan aset dikurangi
  jumlah pelunasan yang sudah tercatat. Pelunasan sebagian diperbolehkan; pelunasan berlebih
  ditolak, karena membayar lebih daripada yang terutang berarti salah satu dari keduanya salah.
- **Kedua sisi dalam satu transaksi basis data**, kas beserta stok pecahannya dan baris
  `ledger_settlements`, lewat `applyCashMovement` yang sudah ada. Kas yang berkurang tanpa baris
  pelunasannya akan muncul sebagai arus kas "belum terklasifikasi" tanpa ada yang tahu sebabnya.
- **Jejak audit** `SETTLEMENT_RECORDED`, seperti seluruh penulis kas lain.

Pelunasan **tidak** langsung menjurnal. Ia menulis mutasi kas, dan `postOperationsToLedger` atas
rentang tanggal yang dipilih manusia yang menjurnalkannya — persis seperti setoran modal dan
pemindahan kas↔bank hari ini. Satu jalur penjurnalan, bukan dua.

### 4. Penyusun Arus Kas

**Fungsi murni `shared/cashFlow.ts`.** Masukannya baris jurnal yang sudah dibaca server; ia tidak
menyentuh basis data.

```ts
export type CashFlowSection = "OPERASI" | "INVESTASI" | "PENDANAAN" | "PENGARUH_KURS" | "INTERNAL" | "BELUM_TERKLASIFIKASI";

export function classifyCashEntry(input: {
  sourceType: JournalSourceType;
  cashDelta: bigint;                 // Σ baris pada CASH_ACCOUNTS, debit − kredit
  counterpartAccounts: string[];     // akun bukan-kas pada jurnal yang sama
  settlementTarget: "BEBAN" | "ASET_TETAP" | null;   // dari ledger_settlements
}): { section: CashFlowSection; label: string; reason?: string };
```

Aturannya, dan alasan tiap barisnya:

| Keadaan | Bagian | Baris |
|---|---|---|
| `cashDelta === 0n` | `INTERNAL` | Pemindahan antar kas dan setara kas — tidak berpengaruh |
| `TRANSAKSI_VALUTA`, lawan `5-1200` | Operasi | Pembayaran pembelian UKA dan TC |
| `TRANSAKSI_VALUTA`, lawan `4-1100` | Operasi | Penerimaan penjualan UKA |
| `MUTASI_KAS`/`MUTASI_BANK`, lawan `2-1900`, target `BEBAN` | Operasi | Pembayaran beban operasional |
| `MUTASI_KAS`/`MUTASI_BANK`, lawan `2-1900`, target `ASET_TETAP` | **Investasi** | Perolehan aset tetap |
| `MUTASI_KAS`/`MUTASI_BANK`, lawan `1-1320`, target `ASET_TETAP` | **Investasi** | Hasil pelepasan aset tetap |
| `MUTASI_KAS`/`MUTASI_BANK`, lawan `3-1100` | Pendanaan | Setoran modal |
| `MUTASI_KAS`/`MUTASI_BANK`, lawan `3-4100` | Pendanaan | Penarikan pemilik |
| `MUTASI_KAS`, lawan `7-1900` | Operasi | Selisih hitungan kas |
| `REVALUASI_KURS`, lawan `7-1500` | `PENGARUH_KURS` | Pengaruh perubahan kurs atas kas |
| lawan `2-1900`/`1-1320` **tanpa** baris pelunasan | `BELUM_TERKLASIFIKASI` | "pelunasan tanpa catatan sasaran" |
| `SALDO_AWAL` | `BELUM_TERKLASIFIKASI` | "jurnal saldo awal bukan arus kas periode ini" |
| `MANUAL`, atau lawan lebih dari satu bagian | `BELUM_TERKLASIFIKASI` | akun lawannya disebutkan |

Dua hal yang sengaja **tidak** ditebak. Jurnal yang akun lawannya jatuh ke lebih dari satu bagian
tidak dibagi rata — ia utuh masuk keranjang beserta alasannya, karena membagi arus kas menurut
perkiraan adalah mengarang angka. Dan `MANUAL` tidak pernah diklasifikasi: jurnal manual dapat
berisi apa saja, dan menebaknya sekali saja sudah cukup untuk membuat seluruh laporan tidak dapat
dipercaya.

`PENGARUH_KURS` bukan arus kas. Selisih retranslasi mengubah jumlah kas tanpa ada uang yang
bergerak, sehingga SAK EP Bab 30 memintanya disajikan terpisah dari ketiga bagian — persis seperti
yang sudah dicatat spec F1 bagian 8.

**Server `server/cashFlow.ts`.** Membaca baris jurnal pada rentangnya, menjumlahkan per jurnal,
mengambil target pelunasan dari `ledger_settlements`, lalu memanggil fungsi murni di atas. Saldo
kas awal dan akhir dihitung terpisah lewat `accountBalancesFor({ to })` atas ketiga akun.

```
reconciled = (kasAkhir − kasAwal) === operasi + investasi + pendanaan + pengaruhKurs + belumTerklasifikasi
```

Kedua sisi sengaja dihitung lewat **dua jalur berbeda** — kiri dari saldo akun, kanan dari
klasifikasi tiap jurnal. Menurunkan keduanya dari satu sumber akan membuat penanda ini selalu benar
dan karena itu tidak berguna.

Keluarannya masuk ke `buildFinancialStatements` sebagai medan `cashFlowStatement` beserta
pembandingnya, supaya kelima laporan memakai satu perhitungan rentang dan satu `priorRange`.
`priorRange` yang sekarang privat (`server/financialStatements.ts:28`) dipindahkan ke
`shared/financialStatements.ts` agar dapat dipakai bersama; perilakunya tidak berubah dan uji yang
ada menjaganya.

### 5. Peringatan Arus Kas

Ditambahkan ke `statementWarnings`, dengan nada yang sama seperti yang sudah ada — memberi tahu apa
yang harus dikerjakan, bukan sekadar menyatakan ada yang salah:

- Keranjang "Belum terklasifikasi" tidak kosong → sebutkan jumlah jurnal dan nomornya.
- `reconciled` salah → sebutkan selisihnya dan minta buku besarnya diperiksa lebih dulu.
- Saldo `2-1900` bertambah sementara tidak ada satu pun pelunasan pada rentang itu → *"Beban dan
  perolehan aset tercatat tetapi belum ada yang dibayar. Catat pelunasannya agar Arus Kas
  memperlihatkan pengeluaran yang sebenarnya."*

### 6. CALK — delapan catatan bangkitan dan tujuh naratif

Kuncinya didaftarkan di `shared/financialNotes.ts` beserta judul, sifat, dan panduan isinya.

**Bangkitan dari buku besar — tidak pernah diketik:**

| `noteKey` | Isi | Sumber |
|---|---|---|
| `KAS_DAN_SETARA_KAS` | Rincian 1-1110, 1-1120, 1-1220; saldo valuta per mata uang | Saldo akun; `journalEntryLines.currencyCode`/`foreignAmount` |
| `PERSEDIAAN_UKA` | Nilai 1-1210, kuantitas dan kurs yang dipakai | `period_closing_valuations` (paket C) |
| `ASET_TETAP` | Per aset: perolehan, akumulasi, nilai buku, umur manfaat, mutasi periode | `fixed_assets`, `fixed_asset_depreciation_entries` (paket E) |
| `KEWAJIBAN_LAIN_LAIN` | Rincian 2-1900: dari beban atau aset, sisa terutang, umurnya | `ledger_settlements`, `operational_expenses`, `fixed_assets` |
| `EKUITAS` | 3-1100, 3-2100, 3-4100, laba berjalan | Saldo akun |
| `PENDAPATAN_DAN_BEBAN` | Rincian tiap akun 4/5/6/7/8 beserta pembandingnya | Saldo akun |
| `SELISIH_KURS` | Per mata uang: saldo, kurs, tanggal kurs, selisih | `currency_revaluations` (paket F1) |
| `TRANSAKSI_NONKAS` | Perolehan aset dan beban yang belum dibayar tunai pada periode ini | `ledger_settlements` dibandingkan jurnal asalnya |

`KEWAJIBAN_LAIN_LAIN` membawa pemeriksaannya sendiri: jumlah sisa terutang harus sama dengan saldo
2-1900. Bila tidak, itu peringatan — ada beban yang belum dijurnal, atau ada jurnal manual yang
menyentuh 2-1900 tanpa lewat modulnya.

**Naratif, tersimpan sebagai teks:**

`INFORMASI_UMUM` · `DASAR_PENYUSUNAN` · `KEBIJAKAN_AKUNTANSI` · `PERTIMBANGAN_DAN_ESTIMASI` ·
`PIHAK_BERELASI` · `PERISTIWA_SETELAH_PERIODE` · `PERIKATAN_DAN_KONTINJENSI`

`INFORMASI_UMUM` hibrida di dalam dirinya sendiri: nama badan hukum, nomor izin, NPWP, dan alamat
dibangkitkan dari `company_profile`; kegiatan usaha dan riwayat pendiriannya diketik.

**Tidak ada teks contoh yang diisikan otomatis.** Tiap kunci membawa `guidance` statis yang
menjelaskan apa yang SAK EP minta pada catatan itu, dan bodinya kosong sampai manusia mengisinya.
Menuliskan kebijakan akuntansi outlet atas namanya sendiri adalah mengarang pernyataan yang
ditandatangani manajemen — dan pemeriksa membaca CALK justru untuk mengetahui apa yang benar-benar
diputuskan manajemen. Catatan yang masih kosong muncul sebagai peringatan *"CALK belum lengkap: N
catatan naratif belum diisi"*, bukan sebagai halaman rapi yang tidak berisi apa-apa.

Pemilihan teks saat menyusun: cari `(noteKey, periodKey = bulan akhir laporan)`, bila tidak ada
pakai `(noteKey, NULL)`. Kebijakan akuntansi karena itu cukup ditulis sekali, sementara peristiwa
setelah periode dapat berbeda tiap bulan tanpa menimpa yang lama — dan laporan periode lampau tetap
menampilkan teks yang berlaku baginya.

### 7. Halaman Laporan Keuangan

Halaman baru `client/src/pages/LaporanKeuangan.tsx` pada `/operasional/laporan-keuangan`, peran
CONTROLLER. Isi tab **Laporan Keuangan** dan kartu **Rekonsiliasi Kas Rupiah** dipindahkan apa
adanya dari `BukuBesar.tsx` (baris 622–776), ditambah dua kartu baru: Arus Kas dan CALK.

Yang ikut berubah, dan wajib ikut dalam tugas yang sama: `shared/backOfficeNavigation.ts` (baris
menu di bawah "Buku Besar"), `client/src/App.tsx`, ikon pada `DashboardLayout.tsx`, dan peta
`pageByPath` pada `server/backOfficeNavigation.test.ts` — uji itu memang ada untuk menangkap
halaman yang terpasang setengah.

Kartu CALK: tiap catatan sebuah bagian yang dapat dilipat. Catatan bangkitan menampilkan tabelnya
dan bertanda "Dibangkitkan dari buku besar", tanpa medan yang dapat disunting. Catatan naratif
menampilkan teksnya beserta tombol sunting, panduan isinya, dan tanda apakah teks yang dipakai
berlaku terus atau khas periode ini.

Buku Besar tetap memuat Jurnal, Neraca Saldo, Buku Besar Akun, dan Periode — pekerjaan pembukuan.
Halaman baru memuat hasilnya. Pemisahan itu juga yang membuat tab Laporan Keuangan berhenti
menjadi tab terpanjang pada aplikasi.

### 8. Otorisasi

Seluruh prosedur pembacaan laporan `controllerProcedure`, sama seperti `ledger.statements` hari
ini. Penyuntingan teks CALK juga `controllerProcedure`: ia pernyataan yang menyertai laporan
keuangan, bukan catatan operasional. `recordSettlement` `controllerProcedure`, sama seperti
`recordCapitalMovement` — uang yang keluar dari kas melintasi batas usaha.

### 9. Pembulatan

**Tidak ada.** Seluruh angka paket ini adalah penjumlahan `bigint` sen atas baris jurnal yang sudah
dua desimal. Satu-satunya pembulatan pada rantai ini terjadi di `valueMonetaryBalance` milik paket
F1, dan paket ini hanya membaca hasilnya.

### 10. Peragaan end-to-end

Paket ini tidak selesai sebelum diperagakan pada basis data lokal `moneychanger`, yang sudah berisi
data uji paket E dan F1 yang sengaja ditinggalkan: aset tetap perolehan Rp 24.000.000 dengan
akumulasi Rp 500.000, dua rekening USD, 1-1220 Rp 16.300.000, 7-1500 Rp 1.336.000, tujuh snapshot
kurs BI asli, dan Periode 16 (September 2026) masih terbuka.

Alurnya: bayar sebagian aset tetap Rp 24.000.000 dari kas, catat dan bayar sebuah beban, jurnalkan
rentangnya, lalu buka Arus Kas — bagian investasi memuat pembayaran asetnya, bagian operasi memuat
pembayaran bebannya, bagian pendanaan memuat setoran modal USD dari paket F1, baris pengaruh kurs
memuat −Rp 1.336.000, dan `reconciled` bernilai benar. CALK memperlihatkan kedelapan catatan
bangkitannya berisi angka nyata.

Catatan: kas Rupiah lokal saat ini belum pernah bergerak, sehingga peragaan membutuhkan modal
Rupiah dicatat lebih dulu lewat jalur yang sudah ada (setoran modal pada tab Modal & Bank). Itu
memang urutan yang benar dan sudah dituntut Paket B.

---

## Yang sengaja tidak dikerjakan

- **Metode tidak langsung tidak disediakan sebagai pilihan kedua.** Dua penyusunan yang harus
  selalu sepakat adalah dua tempat yang dapat berselisih; bila kelak diminta pemeriksa,
  rekonsiliasi laba bersih → arus kas operasi ditambahkan sebagai catatan, bukan sebagai laporan
  tandingan.
- **Tidak ada pos penyeimbang.** Selisih `reconciled` selalu peringatan. Angka penyeimbang membuat
  laporan tampak benar justru pada saat pembukuannya salah.
- **Tidak ada klasifikasi otomatis untuk jurnal `MANUAL`.** Ia selalu masuk keranjang terlihat.
- **Pelunasan tidak menjurnal sendiri.** Ia menulis mutasi kas; penjurnalannya tetap lewat
  `postOperationsToLedger` atas rentang yang dipilih manusia.
- **Tidak ada pelunasan massal ("bayar semua tagihan").** Tiap pembayaran adalah uang fisik yang
  keluar beserta pecahannya; tombol yang membayar sepuluh tagihan sekaligus akan mengarang sepuluh
  rincian pecahan.
- **Tidak ada ekspor CALK ke PDF/XLSX pada paket ini.** Paket G yang menangani ekspor, dan
  menempelkannya di sini akan membangun dua jalur ekspor yang berbeda.
- **Piutang usaha dan kewajiban selain 2-1900/1-1320 tidak dilunasi lewat jalur ini.** Akun-akun
  itu belum punya modul yang menuliskannya; menambahkan pelunasan untuk saldo yang tidak pernah
  terbentuk akan membuat fitur tanpa sumber data — kesalahan yang sama yang paket ini perbaiki.

---

## Risiko residual

- **Beban dan aset yang tercatat sebelum paket ini tidak punya pelunasan.** Saldo 2-1900 lokal
  Rp 24.000.000 sudah menjadi contohnya. Pelunasannya harus dicatat manusia dengan tanggal
  sebenarnya; bila tanggal itu jatuh pada periode yang sudah ditutup, jurnalnya akan ditolak dan
  keputusannya (jurnal susulan pada periode terbuka, atau membuka kembali periodenya) tetap milik
  manusia. Paket ini tidak memutuskannya sendiri.
- **Kas fisik yang dibayarkan tanpa lewat modul ini** tetap mungkin, dan akan muncul sebagai mutasi
  kas berkategori `OTHER` yang tidak dijurnal — terlihat pada `skipped`, tetapi tidak pada Arus Kas.
- **`ledger_settlements` menunjuk beban dan aset, bukan baris jurnalnya.** Bila sebuah jurnal beban
  dibalik sesudah pelunasannya tercatat, baris pelunasannya tetap ada dan sisa tagihannya menjadi
  negatif. Uji pembalik jurnal ada untuk menampakkannya, tetapi perbaikannya manual.
- **Teks CALK yang tidak pernah diisi membuat laporan tidak lengkap secara standar.** Peringatannya
  ada, tetapi tidak ada yang memaksa. Memaksa berarti memblokir penyusunan laporan karena sebuah
  paragraf belum diketik, dan itu lebih buruk.
- **Bagan akun masih perlu ditinjau seorang akuntan satu kali**, sama seperti sejak Paket C. Paket
  ini bersandar penuh padanya, dan bagian investasi bersandar pada pemetaan 2-1900 → aset tetap
  yang benar hanya sejauh baris `ledger_settlements`-nya diisi benar.
