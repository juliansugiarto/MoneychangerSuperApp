# Paket F2 — Arus Kas dan CALK

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Melengkapi lima laporan SAK EP — menambahkan Laporan Arus Kas metode langsung dan CALK hibrida — dan, karena keduanya menuntut arus kas yang benar-benar ada, membangun penulis pelunasan kewajiban dan penerimaan piutang yang selama ini dijanjikan komentar `shared/journalMapping.ts:104` tetapi tidak pernah ditulis.

**Architecture:** Dua kategori mutasi baru (`KEWAJIBAN_DIBAYAR`, `PIUTANG_DITERIMA`) plus dua tabel (`ledger_settlements`, `financial_statement_notes`) pada migrasi aditif `0050`; dua kasus baru pada `mapCashMovement`/`mapBankMovement` sehingga jalur `MUTASI_KAS`/`MUTASI_BANK` yang sudah ada yang menjurnalkannya; satu penulis `server/settlements.ts` yang mengikuti pola `recordCapitalMovement`; klasifikasi arus kas murni di `shared/cashFlow.ts` dan penyusunnya di `server/cashFlow.ts`, keduanya masuk ke `buildFinancialStatements`; daftar catatan di `shared/financialNotes.ts` dengan angka dibangkitkan di `server/financialNotes.ts`; halaman baru `LaporanKeuangan.tsx` yang menampung kelima laporan.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, decimal.js, Zod.

**Spec:** `docs/superpowers/specs/2026-09-07-arus-kas-dan-calk-design.md`

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu**, supaya sesi
berikutnya tahu harus mulai dari mana tanpa membaca seluruh riwayat.

- [x] Tugas 1 — Migrasi pelunasan dan catatan CALK (0050)
- [x] Tugas 2 — Dua kategori pelunasan pada pemetaan kas dan bank
- [x] Tugas 3 — `recordSettlement`: penulis pelunasan beserta pecahannya
- [x] Tugas 4 — Prosedur tRPC dan panel Pelunasan pada tab Modal & Bank
- [x] Tugas 5 — `classifyCashEntry` murni di `shared/cashFlow.ts`
- [x] Tugas 6 — `buildCashFlowStatement` dan penanda `reconciled`
- [x] Tugas 7 — Arus Kas masuk `buildFinancialStatements` beserta peringatannya
- [x] Tugas 8 — Daftar catatan CALK dan panduannya di `shared/financialNotes.ts`
- [x] Tugas 9 — Catatan bangkitan dari buku besar
- [x] Tugas 10 — Penyimpanan teks naratif dan prosedurnya
- [x] Tugas 11 — Halaman Laporan Keuangan dan navigasinya
- [x] Tugas 12 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

**Tugas 1 dan 2 digabung menjadi satu commit** (7 September 2026). Menambah nilai enum pada
`drizzle/schema.ts` membuat kolomnya lebih lebar daripada `CashMovementCategory`, sehingga Tugas 1
sendirian tidak dapat lulus `tsc --noEmit` — dan tugas yang tidak dapat melewati gerbang mutunya
bukan commit yang berdiri sendiri. Cacat urutan pada rencana ini, bukan pada kodenya.

Urutannya mengikat: 1 sebelum 2–4 dan 9–10; 2 sebelum 3; 3 sebelum 4; 5 sebelum 6; 6 sebelum 7;
8 sebelum 9 dan 10; 7, 9, dan 10 sebelum 11. Tugas 12 terakhir.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Muat variabel lingkungan lebih dulu:
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Perintah mutu wajib sebelum tugas dianggap selesai: `./node_modules/.bin/vitest run`,
  `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vite build`.
- **Baseline sebelum paket ini, dijalankan 7 September 2026 sesudah Paket F1 selesai:**
  `Test Files 106 passed (106)`, `Tests 785 passed | 2 skipped (787)`. Tugas yang menambah uji akan
  menaikkan angkanya — **sebutkan angka yang benar-benar dilihat, jangan mengarang.**
- **Satu uji diketahui flaky dan bukan bagian paket ini:** `server/tenantIsolation.live.test.ts` >
  *"setiap ikatan hanya melihat database miliknya sendiri"*. Ia satu-satunya uji yang menyentuh dua
  basis data sungguhan dan memanggil `getDb` tanpa `retryTransientDatabaseRead`. Bila ia gagal
  sendirian di bawah beban, jalankan ulang berkas itu saja sebelum menyimpulkan apa pun; jangan
  memperbaikinya di dalam paket ini. Dugaan pembungkus retry adalah **petunjuk, bukan diagnosis**.
- `node scripts/tenant.mjs migrate-all` mencakup `moneychanger` dan `mc_t_abcvalas`. **Jangan**
  menjalankan berkas `.sql` langsung lewat klien mysql — penanda `--> statement-breakpoint` membuat
  pernyataan kedua gagal dan jurnal `__drizzle_migrations` menjadi tidak konsisten.
- **Jangan menerapkan migrasi ke produksi.** Hanya dua basis data lokal.
- Uji dalam rencana ini adalah uji Vitest atas fungsi murni atau atas fungsi dengan `getDb`
  dipalsukan. **Kecuali Tugas 12**, yang menuntut peragaan end-to-end pada basis data lokal.
- **Data uji paket E dan F1 pada `moneychanger` sengaja dibiarkan** untuk dipakai paket ini: aset
  tetap perolehan Rp 24.000.000 (akumulasi Rp 500.000), dua rekening USD, 1-1220 Rp 16.300.000,
  7-1500 Rp 1.336.000, tujuh snapshot kurs BI asli, dan Periode 16 (September 2026) masih terbuka
  dengan penyusutan, revaluasi, dan penilaian sudah dijurnal. **Jangan membersihkannya dan jangan
  membuatnya ulang.**
- Peran `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Seluruh prosedur paket ini `controllerProcedure`.
- Uang pada baris jurnal **tepat dua desimal**; kolom mutasi kas/bank berskala enam. **Tidak ada
  satu pun pembulatan baru dalam paket ini** — spec bagian 9.
- **Rincian pecahan wajib** untuk jalur kas pada `recordSettlement`. Jangan membuatnya opsional.
- **Tanggal:** kolom `date` dibaca lewat `calendarDay` dan ditulis lewat `dbDate`. **Jangan memakai
  `isoDay`** untuk itu — ia memundurkan tanggal satu hari pada mesin WIB (bug paket K1).
- **Jangan menambah akun ke `shared/chartOfAccounts.ts`** dan **jangan menambah nilai
  `journalSourceTypes`.** Keduanya tidak diperlukan; spec bagian 1 menjelaskan mengapa.
- Jurnal `MANUAL` tidak pernah diklasifikasi ke bagian arus kas mana pun.
- Jangan menuliskan teks kebijakan akuntansi contoh ke dalam basis data. Catatan naratif kosong
  sampai manusia mengetiknya.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `drizzle/schema.ts` | Dua kategori enum; `ledgerSettlements`; `financialStatementNotes` | 1 |
| `drizzle/0050_*.sql` | Migrasi hasil generate | 1 |
| `shared/journalMapping.ts` | Kasus `KEWAJIBAN_DIBAYAR` dan `PIUTANG_DITERIMA` | 2 |
| `server/settlementMapping.test.ts` | Uji tabel penuh kedua kategori, kas dan bank | 2 |
| `server/settlements.ts` | `recordSettlement`, `listOutstandingPayables` | 3 |
| `server/settlements.test.ts` | Uji pecahan wajib, sisa tagihan, dua sisi satu transaksi | 3 |
| `server/routers.ts` | Tiga prosedur pada router `cash`/`ledger` | 4, 10, 11 |
| `server/settlements.authorization.test.ts` | Uji otorisasi | 4 |
| `client/src/pages/StockControl.tsx` | Panel Pelunasan pada tab Modal & Bank | 4 |
| `shared/cashFlow.ts` | `classifyCashEntry`, tipe bagian — murni | 5 |
| `shared/cashFlow.test.ts` | Uji tabel penuh klasifikasi | 5 |
| `server/cashFlow.ts` | `buildCashFlowStatement`, `reconciled` | 6 |
| `server/cashFlow.test.ts` | Uji penyusunan dan rekonsiliasi | 6 |
| `shared/financialStatements.ts` | `priorRange` dipindahkan ke sini; peringatan arus kas | 7 |
| `server/financialStatements.ts` | Medan `cashFlowStatement` pada keluarannya | 7 |
| `server/financialStatements.test.ts` | Uji medan baru dan pembandingnya | 7 |
| `shared/financialNotes.ts` | Daftar 15 catatan: kunci, judul, sifat, panduan | 8 |
| `shared/financialNotes.test.ts` | Uji keutuhan daftar | 8 |
| `server/financialNotes.ts` | Delapan catatan bangkitan; pemilihan teks naratif | 9, 10 |
| `server/financialNotes.test.ts` | Uji angka bangkitan dan pemeriksaan 2-1900 | 9 |
| `server/financialNotesText.test.ts` | Uji pemilihan `(noteKey, periodKey)` dan penyuntingan | 10 |
| `client/src/pages/LaporanKeuangan.tsx` | Halaman baru berisi kelima laporan dan CALK | 11 |
| `client/src/pages/BukuBesar.tsx` | Tab Laporan Keuangan dipindahkan keluar | 11 |
| `shared/backOfficeNavigation.ts`, `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx` | Rute, menu, ikon | 11 |
| `server/backOfficeNavigation.test.ts` | `pageByPath` bertambah | 11 |
| `server/cashFlowScenario.test.ts` | Skenario menyeluruh | 12 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku dan struktur data yang berubah | 12 |

---

### Task 1: Migrasi pelunasan dan catatan CALK (0050)

**Files:**
- Modify: `drizzle/schema.ts` (`cashBalanceMovements` ~baris 394, `bankAccountMovements` ~baris 459, tabel baru di bawah `currencyRevaluations` ~baris 1348)
- Create: `drizzle/0050_*.sql` (hasil generate, akhiran acak dari Drizzle)

**Interfaces:**
- Consumes: —
- Produces: dua nilai enum kategori; tabel `ledger_settlements` dan `financial_statement_notes`.
  Dipakai tugas 2–4 dan 9–11.

- [x] **Step 1: Tambah dua kategori pada kedua tabel mutasi**

Pada `cashBalanceMovements.category` dan `bankAccountMovements.category`, tambahkan di akhir daftar
— **sebelum** `"OTHER"` tidak perlu, urutan enum MySQL tidak bermakna di sini, tetapi menambah di
akhir membuat diff migrasinya kecil:

```ts
  "KEWAJIBAN_DIBAYAR", "PIUTANG_DITERIMA",
```

Perbarui komentar kolomnya: *"Kategori `KEWAJIBAN_DIBAYAR`/`PIUTANG_DITERIMA` mencatat uang yang
benar-benar keluar melunasi 2-1900 atau masuk menagih 1-1320 — sisi kas yang sebelumnya dijanjikan
`mapExpense` tetapi tidak pernah ditulis. Baris `ledger_settlements` yang menyebut apa yang
dilunasi."*

- [x] **Step 2: Tambah tabel `ledger_settlements`**

Salin bentuknya dari spec bagian 1 apa adanya, termasuk komentarnya. Yang tidak boleh hilang: dua
indeks unik pada `cashMovementId` dan `bankMovementId` — itu yang mencegah satu mutasi kas dihitung
dua kali sebagai pelunasan.

- [x] **Step 3: Tambah tabel `financial_statement_notes`**

Salin dari spec bagian 1. `periodKey` **boleh NULL** dan itu bermakna: teks yang berlaku terus.
Indeks uniknya `(noteKey, periodKey)`.

- [x] **Step 4: Generate migrasi dan baca SQL-nya**

```bash
./node_modules/.bin/drizzle-kit generate
cat drizzle/0050_*.sql
```

Yang wajib diperiksa sebelum melanjutkan: pernyataan `ALTER TABLE … MODIFY` atas kedua kolom enum
**tidak boleh** menghilangkan satu pun nilai lama, dan tidak boleh ada satu pun `DROP`.

- [x] **Step 5: Terapkan ke dua basis data lokal**

```bash
node scripts/tenant.mjs migrate-all
mysql -uroot -h127.0.0.1 moneychanger -e "SHOW COLUMNS FROM cash_balance_movements LIKE 'category'; SHOW CREATE TABLE ledger_settlements\G"
```

- [x] **Step 6: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add drizzle/schema.ts drizzle/0050_*.sql drizzle/meta
git commit -m "Migrasi pelunasan kewajiban dan catatan CALK (0050)"
```

---

### Task 2: Dua kategori pelunasan pada pemetaan kas dan bank

**Files:**
- Modify: `shared/journalMapping.ts` (`CashMovementCategory` ~baris 144, `mapCashMovement` ~baris 178, `BankMovementCategory` ~baris 149, `mapBankMovement` ~baris 230)
- Test: `server/settlementMapping.test.ts`

**Interfaces:**
- Consumes: `EXPENSE_PAYABLE_ACCOUNT`, `OTHER_RECEIVABLE_ACCOUNT`, `CASH_ACCOUNT`, `BANK_ACCOUNT`, `FX_BANK_ACCOUNT` — semuanya sudah ada.
- Produces: jurnal pelunasan. Dipakai tugas 3, 6, dan 12.

- [x] **Step 1: Tulis uji yang gagal**

`server/settlementMapping.test.ts`, tabel penuh:

```ts
import { describe, expect, it } from "vitest";
import { isSkipped, mapBankMovement, mapCashMovement } from "../shared/journalMapping";

describe("mapCashMovement — pelunasan", () => {
  it("membayar kewajiban: Dr 2-1900 / Cr 1-1110", () => {
    const result = mapCashMovement({
      category: "KEWAJIBAN_DIBAYAR", amount: "1000000.000000", currencyCode: "IDR",
      reason: "KEWAJIBAN_DIBAYAR: sewa Agustus", isFirstMovementForCurrency: false,
    });
    expect(isSkipped(result)).toBe(false);
    if (isSkipped(result)) return;
    expect(result.lines).toEqual([
      { accountCode: "2-1900", side: "DEBIT", amount: "1000000.00", memo: expect.any(String) },
      { accountCode: "1-1110", side: "KREDIT", amount: "1000000.00", memo: expect.any(String) },
    ]);
  });

  it("menerima piutang: Dr 1-1110 / Cr 1-1320", () => { /* … */ });

  it("menolak pelunasan kas valuta asing", () => {
    // Kas fisik valuta asing adalah persediaan, dinilai di akhir periode — bukan alat bayar.
    const result = mapCashMovement({
      category: "KEWAJIBAN_DIBAYAR", amount: "100.000000", currencyCode: "USD",
      reason: "x", isFirstMovementForCurrency: false,
    });
    expect(isSkipped(result)).toBe(true);
  });

  it("melewati nominal berpecahan di bawah sen", () => { /* … */ });
});

describe("mapBankMovement — pelunasan", () => {
  it("rekening Rupiah memakai 1-1120", () => { /* … */ });

  it("rekening valuta asing memakai 1-1220 dan nilai Rupiahnya", () => {
    // Jalur rupiahAmount dari paket F1 dipakai apa adanya.
  });

  it("tanpa rupiahAmount, rekening valuta asing dilewati beralasan kurs", () => { /* … */ });

  it("menandai baris 1-1220 dengan currencyCode dan foreignAmount", () => { /* … */ });
});
```

- [x] **Step 2: Tambahkan kedua kategori pada kedua tipe**

`CashMovementCategory` dan `BankMovementCategory` masing-masing bertambah
`"KEWAJIBAN_DIBAYAR" | "PIUTANG_DITERIMA"`.

- [x] **Step 3: Tangani keduanya pada `mapCashMovement`**

Sesudah blok `switch` yang melewati kategori, sebelum `switch` yang memetakan:

```ts
    case "KEWAJIBAN_DIBAYAR":
      return pair(EXPENSE_PAYABLE_ACCOUNT, CASH_ACCOUNT, parsed.amount, memo);
    case "PIUTANG_DITERIMA":
      return pair(CASH_ACCOUNT, OTHER_RECEIVABLE_ACCOUNT, parsed.amount, memo);
```

Penjaga IDR di kepala fungsi sudah menolak kas valuta asing, dan itu benar: kas fisik valuta asing
adalah persediaan, bukan alat bayar.

- [x] **Step 4: Tangani keduanya pada `mapBankMovement`**

Sesudah `bankAccount` ditentukan, dan **sebelum** penandaan `currencyCode`/`foreignAmount` supaya
baris 1-1220 tetap ikut ditandai:

```ts
  const mapped = input.category === "KEWAJIBAN_DIBAYAR"
    ? pair(EXPENSE_PAYABLE_ACCOUNT, bankAccount, parsed.amount, memo)
    : input.category === "PIUTANG_DITERIMA"
      ? pair(bankAccount, OTHER_RECEIVABLE_ACCOUNT, parsed.amount, memo)
      : input.category === "CAPITAL_WITHDRAWAL"
        ? pair(DIVIDEND_ACCOUNT, bankAccount, parsed.amount, memo)
        : pair(bankAccount, PAID_IN_CAPITAL_ACCOUNT, parsed.amount, memo);
```

- [x] **Step 5: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add shared/journalMapping.ts server/settlementMapping.test.ts
git commit -m "Pemetaan jurnal pelunasan kewajiban dan penerimaan piutang"
```

---

### Task 3: `recordSettlement` — penulis pelunasan beserta pecahannya

**Files:**
- Create: `server/settlements.ts`
- Test: `server/settlements.test.ts`

**Interfaces:**
- Consumes: `applyCashMovement`, `reconcileDenominations`, `writeAudit`, `dbDate` — semuanya sudah ada di `server/operations.ts`.
- Produces: `recordSettlement`, `listOutstandingSettlements`. Dipakai tugas 4, 9, dan 12.

**Dua penyimpangan dari rencana, 7 September 2026.** Namanya `listOutstandingSettlements`, bukan
`listOutstandingPayables`: ia mengembalikan sisa tagihan **dan** sisa piutang hasil pelepasan, dan
nama lama menyembunyikan separuh isinya. Dan `server/operations.ts` ikut disunting untuk
meng-`export` `applyCashMovement`, `reconcileDenominations`, serta `nonNegativeOrZeroDecimal`
(begitu pula `dbDate` pada `server/ledgerOperations.ts`) — menyalin ketiganya akan membuat jalur
kas kedua yang dapat berbeda pendapat dengan yang pertama.

- [x] **Step 1: Tulis uji yang gagal**

`server/settlements.test.ts` dengan `getDb` dipalsukan, menegakkan:

```
- menolak jalur kas tanpa rincian pecahan
- menolak nominal melebihi sisa tagihan (beban Rp 1jt yang sudah dibayar Rp 400rb menolak Rp 700rb)
- menerima pelunasan sebagian, sisa tagihannya berkurang
- menulis mutasi kas dan baris ledger_settlements dalam satu transaksi
- menolak targetType ASET_TETAP tanpa fixedAssetId, dan BEBAN tanpa expenseId
- menulis audit SETTLEMENT_RECORDED
- listOutstandingPayables menjumlahkan beban dan aset yang belum lunas
```

- [x] **Step 2: Tulis `listOutstandingPayables`**

Sisa tagihan = nominal asal − Σ pelunasan yang sudah tercatat, untuk `operational_expenses` dan
`fixed_assets`. Sertakan tanggal asalnya supaya panel dapat menampilkan umurnya, dan sertakan
`journalEntryId` bila jurnal asalnya sudah ada.

- [x] **Step 3: Tulis `recordSettlement`**

Ikuti `recordCapitalMovement` (`server/operations.ts:2745`) baris demi baris: validasi nominal,
catatan minimal 5 karakter, pecahan wajib untuk jalur kas, `reconcileDenominations`, lalu
`db.transaction` yang memanggil `applyCashMovement` (atau memperbarui `bankAccounts` +
`bankAccountMovements` untuk jalur bank), menyisipkan baris `ledger_settlements` yang menunjuk id
mutasinya, dan menulis auditnya.

Kategori mutasinya `KEWAJIBAN_DIBAYAR` untuk `PEMBAYARAN` dan `PIUTANG_DITERIMA` untuk `PENERIMAAN`;
arahnya `OUT` dan `IN`.

**Jangan menjurnal di sini.** Penjurnalannya lewat `postOperationsToLedger` atas rentang tanggal
yang dipilih manusia, sama seperti setoran modal — spec bagian 3.

- [x] **Step 4: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add server/settlements.ts server/settlements.test.ts
git commit -m "recordSettlement: pelunasan kewajiban dan penerimaan piutang beserta pecahannya"
```

---

### Task 4: Prosedur tRPC dan panel Pelunasan pada tab Modal & Bank

**Files:**
- Modify: `server/routers.ts` (router `cash`, dekat `recordCapitalMovement` ~baris 780)
- Modify: `client/src/pages/StockControl.tsx` (tab `modal-bank`)
- Test: `server/settlements.authorization.test.ts`

**Interfaces:**
- Consumes: `recordSettlement`, `listOutstandingPayables`.
- Produces: `cash.outstandingPayables`, `cash.recordSettlement`. Dipakai UI dan tugas 12.

- [x] **Step 1: Uji otorisasi lebih dulu** — STAFF dan ADMIN ditolak, CONTROLLER diterima.
- [x] **Step 2: Dua prosedur `controllerProcedure`.** Tanggal dikirim sebagai `"YYYY-MM-DD"`,
      **bukan** `z.coerce.date()` — alasannya tercatat pada komentar router `fixedAssets`.
- [x] **Step 3: Panel "Pelunasan Kewajiban"** di bawah panel Modal & Bank yang sudah ada: daftar
      tagihan terutang beserta umurnya, pilih satu, isi nominal (default sisa penuh), pilih kas atau
      rekening, lalu form pecahan yang sudah ada bila kas. Keadaan kosong berbunyi *"Tidak ada
      kewajiban terutang."*, bukan tabel kosong tanpa keterangan.
- [x] **Step 4:** Perintah mutu, lalu commit `"Prosedur dan panel pelunasan kewajiban"`.

---

### Task 5: `classifyCashEntry` murni di `shared/cashFlow.ts`

**Files:**
- Create: `shared/cashFlow.ts`
- Test: `shared/cashFlow.test.ts`

**Interfaces:**
- Consumes: `CASH_ACCOUNTS` dari `shared/currencyRevaluation.ts`.
- Produces: `CashFlowSection`, `classifyCashEntry`. Dipakai tugas 6.

- [x] **Step 1: Tulis uji tabel penuh yang gagal** — satu kasus untuk setiap baris tabel pada spec
      bagian 4, ditambah tiga yang paling mudah salah:
      - jurnal berdelta nol (setor kas ke bank) menjadi `INTERNAL`, bukan dua arus yang saling meniadakan;
      - jurnal berlawan dua bagian sekaligus masuk `BELUM_TERKLASIFIKASI` **utuh**, tidak dibagi;
      - `MANUAL` tidak pernah diklasifikasi meski akun lawannya kebetulan cocok.
- [x] **Step 2: Tulis fungsinya.** Urutan pemeriksaan: delta nol → `sourceType` `MANUAL`/`SALDO_AWAL`
      → `REVALUASI_KURS` → pemetaan akun lawan → keranjang. Tiap keranjang membawa `reason` yang
      dapat dibaca manusia.
- [x] **Step 3:** Perintah mutu, lalu commit `"Klasifikasi arus kas murni per jurnal"`.

---

### Task 6: `buildCashFlowStatement` dan penanda `reconciled`

**Files:**
- Create: `server/cashFlow.ts`
- Test: `server/cashFlow.test.ts`

**Interfaces:**
- Consumes: `classifyCashEntry`, `accountBalancesFor`, baris jurnal beserta `sourceType`-nya, `ledger_settlements`.
- Produces: `buildCashFlowStatement(input: { from: Date; to: Date })`. Dipakai tugas 7.

- [x] **Step 1: Tulis uji yang gagal** — termasuk yang ini, yang menjaga seluruh gunanya penanda:

```ts
it("menandai reconciled salah ketika ada jurnal kas yang tidak terklasifikasi", async () => {
  // Kedua sisi dihitung lewat jalur berbeda: kiri dari saldo akun, kanan dari klasifikasi jurnal.
  // Bila keduanya diturunkan dari satu sumber, penanda ini selalu benar dan tidak berguna.
});
```

- [x] **Step 2: Baca baris jurnalnya**, jumlahkan delta kas per jurnal, ambil target pelunasan dari
      `ledger_settlements` lewat `KAS-{id}`/`BANK-{id}` pada `sourceReference`.
- [x] **Step 3: Susun bagiannya**, saldo kas awal dan akhir dari `accountBalancesFor({ to })` atas
      ketiga akun, lalu hitung `reconciled`.
- [x] **Step 4:** Perintah mutu, lalu commit `"buildCashFlowStatement beserta rekonsiliasinya"`.

---

### Task 7: Arus Kas masuk `buildFinancialStatements` beserta peringatannya

**Files:**
- Modify: `shared/financialStatements.ts` (`priorRange` pindah ke sini; `statementWarnings` bertambah)
- Modify: `server/financialStatements.ts`
- Test: `server/financialStatements.test.ts`

- [x] **Step 1: Pindahkan `priorRange`** dari `server/financialStatements.ts:28` ke
      `shared/financialStatements.ts` apa adanya, beserta komentarnya. Perilakunya tidak berubah;
      uji yang ada menjaganya.
- [x] **Step 2: Tambahkan `cashFlowStatement`** beserta pembandingnya ke keluaran
      `buildFinancialStatements`, memakai rentang yang sudah dihitung di sana.
- [x] **Step 3: Tiga peringatan baru** pada `statementWarnings` — spec bagian 5, termasuk peringatan
      2-1900 bertambah tanpa satu pun pelunasan.
- [x] **Step 4:** Perintah mutu, lalu commit `"Arus Kas menyatu dengan ketiga laporan lain"`.

---

### Task 8: Daftar catatan CALK dan panduannya

**Files:**
- Create: `shared/financialNotes.ts`
- Test: `shared/financialNotes.test.ts`

- [x] **Step 1: Tulis daftarnya** — 15 catatan, tiap satu membawa `key`, `title`, `kind`
      (`"BANGKITAN" | "NARATIF"`), `guidance` (apa yang SAK EP minta pada catatan itu), dan urutan
      penyajiannya. Isinya persis daftar pada spec bagian 6.
- [x] **Step 2: Uji keutuhannya** — kunci unik, urutan tidak berlubang, tiap catatan naratif punya
      `guidance` yang tidak kosong, dan **tidak ada satu pun teks contoh** yang ikut terbawa.
- [x] **Step 3:** Perintah mutu, lalu commit `"Daftar catatan CALK beserta panduan isinya"`.

---

### Task 9: Catatan bangkitan dari buku besar

**Files:**
- Create: `server/financialNotes.ts`
- Test: `server/financialNotes.test.ts`

- [x] **Step 1: Tulis uji yang gagal**, termasuk pemeriksaan silang `KEWAJIBAN_LAIN_LAIN`: jumlah
      sisa terutang harus sama dengan saldo 2-1900, dan bila tidak, catatannya membawa peringatan —
      bukan diam-diam menampilkan angka yang berbeda dari neracanya.
- [x] **Step 2: Bangkitkan kedelapan catatan** dari sumber yang disebut spec bagian 6. Angka
      diambil dari buku besar dan tabel bukti yang sudah ada; **tidak ada satu pun yang diketik.**
- [x] **Step 3:** Perintah mutu, lalu commit `"Delapan catatan CALK yang dibangkitkan buku besar"`.

---

### Task 10: Penyimpanan teks naratif dan prosedurnya

**Files:**
- Modify: `server/financialNotes.ts`, `server/routers.ts`
- Test: `server/financialNotesText.test.ts`

- [x] **Step 1: Uji pemilihan teks** — `(noteKey, periodKey)` menang atas `(noteKey, NULL)`; tanpa
      keduanya catatannya kosong dan masuk daftar peringatan "CALK belum lengkap".
- [x] **Step 2: `getFinancialNotes` dan `saveFinancialNoteText`**, keduanya
      `controllerProcedure`, dengan audit `FINANCIAL_NOTE_UPDATED` yang menyimpan teks sebelum dan
      sesudahnya.
- [x] **Step 3:** Perintah mutu, lalu commit `"Teks naratif CALK: penyimpanan, pemilihan, dan audit"`.

---

### Task 11: Halaman Laporan Keuangan dan navigasinya

**Files:**
- Create: `client/src/pages/LaporanKeuangan.tsx`
- Modify: `client/src/pages/BukuBesar.tsx`, `shared/backOfficeNavigation.ts`, `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx`, `server/routers.ts`
- Test: `server/backOfficeNavigation.test.ts`

- [x] **Step 1: Pindahkan tab Laporan Keuangan** (`BukuBesar.tsx` baris 622–776, termasuk kartu
      Rekonsiliasi Kas Rupiah) ke halaman baru **apa adanya**. Jangan menulis ulang kartunya sambil
      memindahkan — perubahan tampilan dan perpindahan berkas dalam satu commit membuat keduanya
      tidak dapat ditinjau.
- [x] **Step 2: Dua kartu baru** — Arus Kas (empat bagian, keranjang "Belum terklasifikasi" beserta
      nomor jurnalnya, dan penanda `reconciled` bergaya sama dengan lencana neraca seimbang) dan
      CALK (bagian yang dapat dilipat; naratif punya tombol sunting dan panduannya, bangkitan tidak).
- [x] **Step 3: Rute, menu, ikon, dan `pageByPath`.** Uji navigasi akan gagal bila salah satunya
      tertinggal — itu memang gunanya.
- [x] **Step 4: Verifikasi visual** — dijalankan 7 September 2026 pada `localhost:3000` sesudah
      pengguna login. Arus Kas, CALK, dan Buku Besar yang kehilangan tabnya terlihat benar.
      Satu cacat ditemukan dan diperbaiki: nominal pada tabel CALK tampil mentah, kini memakai
      `moneyColumns`. kedua kartu baru dan halaman lama yang kehilangan tabnya.
      Login dilakukan pengguna sendiri; mintalah pada giliran itu.
- [x] **Step 5:** Perintah mutu, lalu commit `"Halaman Laporan Keuangan: lima laporan dan CALK"`.

---

### Task 12: Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

**Files:**
- Create: `server/cashFlowScenario.test.ts`
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md`, `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`

- [x] **Step 1: Skenario satu periode utuh** sebagai uji: modal masuk → beli dan jual UKA → beban
      dicatat dan dibayar sebagian → aset dibeli dan dibayar → aset dilepas dan uangnya ditagih →
      revaluasi kurs → Arus Kas tersusun, `reconciled` benar, keranjang kosong.
- [x] **Step 2: Skenario yang gagal dengan benar** — jurnal manual menyentuh kas, dan pelunasan
      tanpa baris sasaran: keduanya muncul di keranjang beserta nomor jurnalnya, dan tidak ada satu
      pun angka yang dipaksa seimbang.
- [x] **Step 3: Peragaan end-to-end** — dijalankan 7 September 2026 dengan izin pengguna pada
      giliran itu juga, seluruhnya lewat jalur kode produksi (tidak ada satu pun `INSERT` langsung):
      setoran modal Rupiah → beban dicatat → beban dilunasi tunai → aset paket E dilunasi sebagian
      → `postOperationsToLedger` → laporan. Hasilnya: bagian operasi −Rp 10.000.000, investasi
      −Rp 20.000.000, pendanaan +Rp 217.636.000, pengaruh kurs −Rp 1.336.000, keranjang **kosong**,
      `reconciled: true`, `difference: "0.00"`, dan kedelapan catatan CALK bangkitan berisi angka.
      Penjaga kelebihan bayar terbukti pada data nyata: percobaan kedua atas aset yang sama ditolak
      *"melebihi sisa tagihan (4000000.00)"*. pada `moneychanger` sesuai spec bagian 10. **Minta izin
      pengguna pada giliran itu juga** sebelum menulis data uji apa pun.
- [x] **Step 4: Perbarui dokumentasi** — panduan A–Z (cara membayar tagihan, cara membaca Arus Kas,
      cara mengisi CALK), skema database (tiga perubahan tabel), dan ROADMAP (centang tugasnya).
- [x] **Step 5:** Perintah mutu, sebutkan angka uji yang benar-benar dilihat, lalu commit
      `"Skenario arus kas menyeluruh, peragaan, dan dokumentasi"`.
