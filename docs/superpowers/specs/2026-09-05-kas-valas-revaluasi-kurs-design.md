# Paket F1 — Kas valuta asing dan revaluasi kurs

**Ditulis 5 September 2026.** Dipisahkan dari Paket F pada sesi rancangan yang sama; lihat
"Mengapa dipisah" di bawah. Paket F2 (Arus Kas dan CALK) dibangun di atas hasil paket ini.

---

## Masalah

### 1. Rekening valuta asing tidak pernah masuk buku besar

`bank_accounts` punya `currencyId` sejak migrasi `0025`, sehingga outlet **dapat** membuka rekening
USD hari ini dan mencatat mutasinya. Tetapi `mapBankMovement` (`shared/journalMapping.ts:219`)
menolak menjurnalnya:

```ts
if (input.currencyCode.trim().toUpperCase() !== "IDR") {
  return { skipped: "rekening valuta asing belum dinilai; hanya rekening IDR yang dijurnal" };
}
```

Pesannya jujur dan sengaja — **belum**, bukan tidak. Tetapi akibatnya uang yang benar-benar ada di
rekening itu tidak muncul pada laporan posisi keuangan mana pun. Bagi pemeriksa, aset yang ada
tetapi tidak dilaporkan adalah temuan, dan alasan "modulnya belum dibuat" bukan jawaban.

### 2. Pos moneter valuta asing wajib diretranslasi pada kurs penutup

SAK EP Bab 30 (slide 245 pada dek pengguna, diverifikasi 3 September 2026): pos moneter dalam
valuta asing diukur ulang pada kurs penutup setiap akhir periode, dan selisihnya masuk laba rugi.
Saldo rekening bank valuta asing adalah pos moneter.

Ini termasuk hal yang **tidak akan pernah dikerjakan** orang yang mengisi formulir Excel — tidak ada
baris pada B0002/B0003 yang memintanya, dan tidak ada yang mengingatkan. Justru karena itu ia harus
otomatis.

### 3. Yang sudah disediakan dan menganggur

Tiga hal sudah berdiri di dalam kode tanpa satu pun penulis:

| Yang menganggur | Tempat | Untuk apa disediakan |
|---|---|---|
| `REVALUASI_KURS` | `journalSourceTypes`, `drizzle/schema.ts:1344` | Persis jurnal yang paket ini tulis |
| `7-1500 Laba/(Rugi) Selisih Kurs` | `shared/chartOfAccounts.ts`, baris B0003 | Muara selisih retranslasi |
| `1-1220 Bank UKA` | `shared/chartOfAccounts.ts`, baris B0002 | Saldo rekening valuta asing |

Menurut aturan proyek (`CLAUDE.md`, "Fitur Harus Punya Sumber Data", ditambahkan 5 September 2026),
ketiganya adalah **pekerjaan yang belum selesai**, bukan keadaan sah.

### Mengapa dipisah dari Paket F

Paket F menyusun Arus Kas, dan barisnya "Pengaruh perubahan kurs atas kas" hanya dapat berisi angka
bila retranslasi ini ada. Menggabungkan keduanya membuat Paket F menjadi paket terbesar pada peta
jalan dan mengubur perbaikan pembukuan di dalam fitur pelaporan. Preseden yang diikuti adalah
Paket K1: kekurangan yang ditemukan saat merancang paket lain, dikeluarkan menjadi paket kecil
tersendiri yang dikerjakan lebih dulu.

---

## Yang sudah diputuskan pengguna

Diputuskan pada sesi rancangan 5 September 2026 dan tidak perlu ditanyakan ulang:

1. **Kas dan setara kas** pada Arus Kas (paket F2) adalah `1-1110` + `1-1120` + `1-1220`. Kas UKA
   fisik (`1-1210`) **bukan** kas — ia persediaan, dan tetap dinilai lewat jalur Paket C.
2. **Revaluasi hanya menyentuh pos moneter**, yaitu `1-1220`. `1-1210` tidak pernah ikut
   diretranslasi di sini.
3. **F1 dikerjakan sebelum F2.**
4. **Fitur harus dapat diperagakan end-to-end** dengan data yang dibuat sendiri di basis data lokal.

---

## Rancangan

### 1. Skema — migrasi `0049`, aditif

Dua kolom pada `accountingPeriods`, tepat sesudah `depreciationJournalEntryId`:

```ts
  /**
   * Penanda bahwa revaluasi kurs bulan ini sudah dijurnal.
   *
   * Kolom, bukan hitungan baris: outlet tanpa rekening valuta asing menghasilkan nol baris
   * revaluasi, dan itu keadaan sah yang tetap harus bisa ditutup. Alasan yang sama persis dengan
   * `depreciationPostedAt` pada paket E.
   */
  revaluationPostedAt: datetime("revaluationPostedAt"),
  revaluationJournalEntryId: int("revaluationJournalEntryId"),
```

Satu tabel baru, `currency_revaluations` — satu baris per `(periodId, currencyId)`:

```ts
export const currencyRevaluations = mysqlTable("currency_revaluations", {
  id: int("id").autoincrement().primaryKey(),
  periodId: int("periodId").notNull(),
  currencyId: int("currencyId").notNull(),
  /** Saldo rekening dalam valuta aslinya pada akhir periode; skala 6 seperti mutasi bank. */
  foreignBalance: decimal("foreignBalance", { precision: 24, scale: 6 }).notNull(),
  /** Nilai Rupiah yang tercatat pada 1-1220 untuk mata uang ini sebelum revaluasi. */
  carryingBefore: decimal("carryingBefore", { precision: 24, scale: 2 }).notNull(),
  /** Bukti kurs, disimpan meski dapat dijangkau lewat id-nya — alasan sama seperti paket C. */
  rateSnapshotId: int("rateSnapshotId").notNull(),
  rateReferenceDate: date("rateReferenceDate").notNull(),
  midRatePerUnit: decimal("midRatePerUnit", { precision: 30, scale: 12 }).notNull(),
  /** foreignBalance × midRatePerUnit, dibulatkan ke sen. */
  carryingAfter: decimal("carryingAfter", { precision: 24, scale: 2 }).notNull(),
  /** carryingAfter − carryingBefore. Positif = laba selisih kurs. */
  difference: decimal("difference", { precision: 24, scale: 2 }).notNull(),
  journalEntryId: int("journalEntryId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("currency_revaluation_period_currency_uq").on(table.periodId, table.currencyId),
  index("currency_revaluation_period_idx").on(table.periodId),
]);
```

Barisnya adalah **bukti yang berdiri sendiri**: pemeriksa dapat menurunkan ulang `carryingAfter`
dari `foreignBalance` dan `midRatePerUnit` tanpa membuka tabel lain, dan `rateReferenceDate`
memperlihatkan bila kurs yang dipakai mundur dari akhir periode. Pola dan alasannya sama persis
dengan `period_closing_valuations` pada Paket C.

### 2. Kurs pada sebuah tanggal — fungsi murni

Kurs tengah sudah ada: `midClosingRate` (`shared/inventoryValuation.ts:41`), (beli + jual) ÷ 2 ÷
`quoteUnit`. **Jangan menulis yang kedua.** Yang ditambahkan hanya pemilihan snapshot-nya, di
`shared/currencyRevaluation.ts`:

```ts
/** Snapshot terakhir yang tidak melewati `on`; null bila tidak ada satu pun. */
export function snapshotOnOrBefore<T extends { referenceDate: string }>(rows: T[], on: string): T | null;

/** foreignBalance × midRatePerUnit, dibulatkan setengah-ke-atas ke sen. */
export function valueMonetaryBalance(input: { foreignBalance: string; midRatePerUnit: string }): string;
```

Konvensi "mundur dari tanggal" identik dengan Paket C: BI tidak mengumumkan kurs pada Sabtu, Minggu,
dan hari libur, jadi snapshot terakhir yang tidak melewati tanggal itulah yang sah — dan tanggalnya
disimpan supaya pemunduran tidak pernah terjadi diam-diam.

### 3. Jurnal mutasi bank valuta asing

`mapBankMovement` kehilangan penolakan IDR-nya dan menerima satu medan tambahan:

```ts
export function mapBankMovement(input: {
  category: BankMovementCategory;
  direction: "IN" | "OUT" | "ADJUSTMENT";
  amount: string;              // dalam valuta rekening
  currencyCode: string;
  /** Nilai Rupiah mutasi ini; wajib untuk rekening non-IDR, diabaikan untuk IDR. */
  rupiahAmount?: string;
  reason: string;
}): MappingResult
```

- Rekening IDR: perilaku **tidak berubah sama sekali**, `BANK_ACCOUNT` = `1-1120`.
- Rekening valuta asing: akun banknya menjadi `1-1220`, nominalnya `rupiahAmount`.
- `rupiahAmount` kosong → `{ skipped: "kurs BI pada tanggal mutasi belum tersedia; jalankan sinkronisasi kurs lebih dulu" }`.

Nilai Rupiah dihitung di `postBankMovements` (`server/ledgerPosting.ts:227`), yang sudah
meng-`innerJoin` `currencies` dan karena itu sudah tahu mata uangnya. Ia mengambil snapshot terakhir
yang tidak melewati tanggal mutasi, mengalikannya, dan menyerahkannya ke pemetaan. Pemetaannya tetap
murni; yang membaca basis data tetap hanya lapisan server.

**Pengukuran awal pada kurs tanggal transaksi**, bukan kurs penutup — itu yang SAK EP Bab 30 minta,
dan selisih terhadap kurs penutup justru yang menjadi pekerjaan bagian 5.

### 4. Nilai tercatat `1-1220` per mata uang

`1-1220` adalah satu akun yang memuat seluruh mata uang bercampur, sementara revaluasi menuntut
angka **per mata uang**. `journal_entry_lines` tidak punya kolom mata uang, dan menambahkannya
berarti menyentuh inti buku besar untuk kebutuhan satu modul — tidak dilakukan.

`bank_account_movements` menyimpan nominal dalam **valuta aslinya saja** — tidak ada kolom Rupiah,
dan tidak boleh ditambahkan. Nilai Rupiah yang benar-benar tercatat pada `1-1220` hanya ada di baris
jurnalnya. Karena itu nilai tercatat sebuah mata uang dijumlahkan dari dua sumber yang keduanya
sudah tersedia:

```
foreignBalance(C)  = Σ foreignAmount baris 1-1220 bermata uang C (debit − kredit) sampai akhir periode
carryingBefore(C)  = Σ amount baris yang sama (debit − kredit)
                   + Σ difference revaluasi mata uang C pada periode-periode sebelumnya
```

`journal_entry_lines` **sudah** punya kolom `currencyCode` dan `foreignAmount`, dengan keterangan
"terisi bila baris ini berasal dari pergerakan valuta asing, untuk penelusuran dan revaluasi" —
disediakan sejak migrasi buku besar dan tidak pernah ada yang mengisinya. `mapBankMovement` kini
mengisinya pada baris 1-1220, sehingga inti buku besar tidak perlu kolom mata uang baru.

**Saldo valuta dan nilai tercatat wajib datang dari baris yang sama.** Mengambil saldo valuta dari
`bank_account_movements` sementara nilai Rupiahnya dari buku besar akan berselisih setiap kali ada
mutasi yang dilewati karena kursnya belum tersedia — dan selisih palsu itu akan dijurnal sebagai
laba/rugi kurs yang tidak pernah terjadi.

Baris 1-1220 **tanpa** `currencyCode` adalah jurnal revaluasi itu sendiri, yang satu untuk seluruh
mata uang dan karena itu tidak bermata uang; ia diabaikan pada penjumlahan mutasi, dan sukunya
diambil dari `currency_revaluations`. Mata uang yang belum pernah direvaluasi memakai nol.

**Menghitung ulang dari nominal valuta dikali kurs hari ini adalah kekeliruan yang menggoda:** ia
membuat `carryingBefore` selalu sama dengan `carryingAfter`, sehingga selisihnya selalu nol dan
seluruh modul ini diam-diam tidak melakukan apa pun.

### 5. Jurnal revaluasi periode

Satu jurnal untuk seluruh mata uang sekaligus, alasannya sama seperti penyusutan: empat puluh jurnal
kecil setiap bulan mengubur jurnal transaksi di antara derau, dan rincian per mata uangnya sudah ada
di `currency_revaluations`.

```
sourceType      REVALUASI_KURS
sourceReference REVAL-{YYYY-MM}
entryDate       akhir periode
total > 0  → Dr 1-1220 / Cr 7-1500     (laba selisih kurs)
total < 0  → Dr 7-1500 / Cr 1-1220     (rugi selisih kurs)
total = 0  → skipped: "tidak ada selisih kurs pada {bulan}"
```

Pemetaannya `mapCurrencyRevaluation` di `shared/journalMapping.ts`, murni dan teruji tabel penuh.

Operasinya di `server/currencyRevaluation.ts` mengikuti pasangan yang sudah terbukti pada paket C
dan E — `buildCurrencyRevaluation` menghitung dan **tidak menulis apa pun**, `postCurrencyRevaluation`
memakai angka dari fungsi itu sebagai satu-satunya sumber, sehingga yang dilihat pengguna pada panel
dan yang dijurnal server mustahil berbeda. Idempotensinya dijaga `(sourceType, sourceReference)`,
penanda periodenya ditulis di dalam transaksi yang sama dengan baris rinciannya, dan percobaan yang
gagal sesudah menjurnal memakai ulang jurnalnya alih-alih menulis yang kedua.

### 6. Gerbang pada penutupan periode

`closeAccountingPeriod` menolak periode yang `revaluationPostedAt`-nya kosong, disisipkan **di antara**
gerbang penyusutan dan gerbang penilaian persediaan:

```
keutuhan jurnal → penyusutan → revaluasi kurs → penilaian persediaan → (Desember: penutup laba) → kunci
```

Alasan urutannya: penyusutan dan revaluasi sama-sama mengubah laba periode dan tidak bergantung satu
sama lain, sedangkan penilaian persediaan membaca hasil opname yang tidak terpengaruh keduanya.
Menaruh revaluasi sesudah penyusutan menjaga pesan yang lebih mendasar sampai lebih dulu.

`postYearEndProfitClosing` juga menuntut dua belas bulan revaluasi, dengan alasan yang sama seperti
penyusutan: penutup laba menolkan 7-1500, dan menutupnya sebelum selisihnya lengkap memindahkan
angka yang salah ke 3-2100 — tempat yang tidak pernah ditinjau lagi.

### 7. Panel Revaluasi Kurs

Pada tab **Periode** halaman Buku Besar, tepat di bawah panel Penyusutan dan di atas panel
Penilaian, mengikuti urutan gerbangnya. Per mata uang: saldo valuta, kurs tengah BI, tanggal kurs
yang dipakai (bertanda "Mundur dari akhir periode" bila lebih awal), nilai tercatat sebelum, nilai
sesudah, dan selisihnya. Di bawahnya total selisih dan tombol **Jurnalkan revaluasi bulan ini**.

Penghalang ditampilkan sebagai daftar beralasan, bukan tombol yang mati tanpa keterangan — mata uang
yang tidak punya snapshot kurs sampai akhir periode adalah penghalang, dan jalan keluarnya
(sinkronisasi kurs BI) disebutkan.

### 8. Bentuk keluaran yang dibaca paket F2

Paket F2 membutuhkan dua hal dari paket ini, dan keduanya disediakan sebagai keluaran yang stabil:

- `CASH_ACCOUNTS = ["1-1110", "1-1120", "1-1220"]`, diekspor dari `shared/currencyRevaluation.ts`.
- Jurnal `REVALUASI_KURS` per periode, yang menjadi baris **"Pengaruh perubahan kurs atas kas"** —
  selisih retranslasi bukan arus kas, sehingga ia harus dikeluarkan dari bagian operasi dan
  disajikan sebagai penyeimbang tersendiri.

### 9. Pembulatan — satu tempat, disebut eksplisit

Hanya `valueMonetaryBalance` yang membulatkan: saldo valuta dikali kurs hampir tidak pernah jatuh pas
di sen. Ini **pengukuran baru**, bukan konversi uang yang sudah tercatat, sehingga tidak melanggar
aturan "menolak membulatkan uang" — alasan dan preseden yang sama persis dengan `valueForeignInventory`
pada Paket C. Tidak ada nilai lain dalam paket ini yang dibulatkan.

### 10. Peragaan end-to-end

Paket ini tidak dianggap selesai sebelum diperagakan pada basis data lokal `moneychanger`:
satu rekening USD, beberapa mutasi pada tanggal yang punya snapshot kurs BI, penjurnalan mutasi,
lalu revaluasi akhir periode — dengan `1-1220` dan `7-1500` memuat angka nyata di layar. Aturan
`CLAUDE.md` "Fitur Harus Punya Sumber Data".

---

## Yang sengaja tidak dikerjakan

- **`1-1210` Kas UKA tidak diretranslasi.** Ia persediaan, dinilai dari hitungan fisik lewat
  `5-1300` pada Paket C. Meretranslasinya di sini menghitung pergerakan kurs yang sama dua kali,
  dan neracanya akan tetap seimbang sementara angkanya salah — kekeliruan yang tidak terlihat dari
  laporan mana pun.
- **Piutang dan kewajiban valuta asing tidak diretranslasi.** Keduanya pos moneter dan secara
  standar memang wajib, tetapi tidak ada satu pun kolom mata uang pada `1-1310`/`1-1320`/`2-1900`
  hari ini. Menebak mata uangnya lebih buruk daripada tidak mengerjakannya; bila kelak kolomnya ada,
  paket ini sudah menyediakan bentuk barisnya.
- **Tidak ada sinkronisasi kurs otomatis yang ditambahkan.** Kurs tetap datang dari mekanisme yang
  sudah ada, dan tanggal tanpa snapshot menjadi penghalang beralasan, bukan angka yang ditebak.
- **Tidak ada penjadwalan otomatis.** Manusia menekan tombolnya, seperti penyusutan dan penilaian.

---

## Risiko residual

- **Mutasi bank valuta asing yang tercatat sebelum paket ini** tidak pernah dijurnal, karena
  `mapBankMovement` melewatinya. Setelah paket ini terpasang, menjalankan ulang penjurnalan atas
  rentang tanggal lama akan menjurnalnya sekarang — dengan kurs tanggal mutasinya, yang benar, tetapi
  masuk ke periode yang mungkin sudah ditutup dan karena itu akan ditolak. Outlet yang sudah
  memakai rekening valuta asing perlu keputusan manusia: jurnal susulan bertanggal periode terbuka,
  atau membuka kembali periodenya. Paket ini **tidak** memutuskannya sendiri.
- **Kurs tanggal mutasi memakai snapshot terakhir yang tidak melewati tanggal itu.** Untuk mutasi
  pada hari libur panjang, kursnya bisa mundur beberapa hari. Tanggalnya tersimpan, tetapi
  selisihnya tetap nyata dan akan muncul sebagai selisih kurs pada revaluasi berikutnya.
- **`bank_accounts` tidak menyimpan saldo**; saldo valuta diturunkan dari penjumlahan
  `bank_account_movements`. Bila ada mutasi yang tercatat di luar aplikasi, saldo valuta dan nilai
  tercatat Rupiah akan berselisih tanpa ada yang menolaknya.
- **Satu rekening per mata uang belum dijamin.** Bila ada dua rekening USD, keduanya dijumlahkan
  menjadi satu baris revaluasi. Itu benar secara akuntansi, tetapi rinciannya per rekening hilang
  dari baris buktinya.
