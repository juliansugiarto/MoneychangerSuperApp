# Paket F1 — Kas valuta asing dan revaluasi kurs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat rekening valuta asing benar-benar masuk buku besar — mutasinya dijurnal ke 1-1220 pada kurs tanggal mutasi, dan saldonya diretranslasi pada kurs penutup tiap akhir periode dengan selisih ke 7-1500 lewat jurnal `REVALUASI_KURS`.

**Architecture:** Satu tabel bukti `currency_revaluations` plus dua kolom penanda pada `accounting_periods` (migrasi aditif `0049`); dua fungsi murni di `shared/currencyRevaluation.ts` yang memakai ulang `midClosingRate` yang sudah ada; satu jalur valuta asing pada `mapBankMovement` dan satu pemetaan baru `mapCurrencyRevaluation` di `shared/journalMapping.ts`; satu berkas server baru `server/currencyRevaluation.ts` berisi pasangan build/post yang idempoten; gerbang baru pada `closeAccountingPeriod` dan `postYearEndProfitClosing`; satu panel pada tab Periode.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, decimal.js, Zod.

**Spec:** `docs/superpowers/specs/2026-09-05-kas-valas-revaluasi-kurs-design.md`

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu**, supaya sesi
berikutnya tahu harus mulai dari mana tanpa membaca seluruh riwayat.

- [x] Tugas 1 — Migrasi revaluasi kurs (0049)
- [ ] Tugas 2 — Kurs dan penilaian pos moneter murni di `shared/`
- [ ] Tugas 3 — Jalur valuta asing pada `mapBankMovement`
- [ ] Tugas 4 — Pemetaan `mapCurrencyRevaluation`
- [ ] Tugas 5 — `postBankMovements` memasok nilai Rupiah
- [ ] Tugas 6 — `buildCurrencyRevaluation`: bukti per mata uang
- [ ] Tugas 7 — `postCurrencyRevaluation`: jurnal periode yang idempoten
- [ ] Tugas 8 — Gerbang penutupan periode dan penutup laba tahunan
- [ ] Tugas 9 — Prosedur tRPC dan panel Revaluasi Kurs
- [ ] Tugas 10 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

Urutannya mengikat: 1 sebelum 5–9; 2 sebelum 3, 5, dan 6; 4 sebelum 7; 6 sebelum 7; 7 sebelum 8
dan 9. Tugas 10 terakhir.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Muat variabel lingkungan lebih dulu:
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Perintah mutu wajib sebelum tugas dianggap selesai: `./node_modules/.bin/vitest run`,
  `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vite build`.
- **Baseline sebelum paket ini, benar-benar dijalankan 5 September 2026 pada commit `c6a8e6b`:**
  `Test Files 98 passed (98)`, `Tests 721 passed | 2 skipped (723)`. Tugas yang menambah uji akan
  menaikkan angkanya — **sebutkan angka yang benar-benar dilihat, jangan mengarang.**
- `node scripts/tenant.mjs migrate-all` mencakup `moneychanger` dan `mc_t_abcvalas`. **Jangan**
  menjalankan berkas `.sql` langsung lewat klien mysql — penanda `--> statement-breakpoint` membuat
  pernyataan kedua gagal dan jurnal `__drizzle_migrations` menjadi tidak konsisten.
- **Jangan menerapkan migrasi ke produksi.** Hanya dua basis data lokal.
- Uji dalam rencana ini adalah uji Vitest atas fungsi murni atau atas fungsi dengan `getDb`
  dipalsukan — tidak menyentuh data nyata. **Kecuali Tugas 10**, yang memang menuntut peragaan
  end-to-end pada basis data lokal; minta izin pengguna pada giliran itu juga.
- Peran `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Seluruh prosedur paket ini `controllerProcedure`.
- Uang pada baris jurnal **tepat dua desimal** (`AMOUNT_PATTERN`, `shared/ledger.ts:18`). Pembulatan
  hanya boleh terjadi pada `valueMonetaryBalance` — spec bagian 9. Tidak ada nilai lain yang dibulatkan.
- **Tanggal:** nilai dari kolom `date` dibaca lewat `calendarDay` (`shared/ledger.ts:214`) dan ditulis
  lewat `dbDate`. **Jangan memakai `isoDay` untuk itu** — ia memundurkan tanggal satu hari pada mesin
  WIB (bug paket K1). Bulan disimpan sebagai `varchar(7)` `"YYYY-MM"`.
- **Jangan menambah akun ke `shared/chartOfAccounts.ts`.** Ketiga akun yang dibutuhkan sudah ada:
  1-1220, 7-1500, dan 1-1120 sebagai pembanding.
- **Jangan menyentuh sistem kas.** Modul ini tidak pernah menulis `cash_balances`, mutasi kas,
  rincian pecahan, maupun `operational_expenses`.
- **Jangan meretranslasi 1-1210 Kas UKA.** Ia persediaan, dinilai lewat Paket C.
- Jangan menambahkan sinkronisasi kurs otomatis maupun penjadwalan otomatis. Manusia menekan tombolnya.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `drizzle/schema.ts` | `currencyRevaluations`; dua kolom `accountingPeriods` | 1 |
| `drizzle/0049_*.sql` | Migrasi hasil generate | 1 |
| `shared/currencyRevaluation.ts` | `CASH_ACCOUNTS`, `snapshotOnOrBefore`, `valueMonetaryBalance` — murni | 2 |
| `shared/currencyRevaluation.test.ts` | Uji pemilihan snapshot dan pembulatan | 2 |
| `shared/journalMapping.ts` | Jalur valuta asing `mapBankMovement`; `mapCurrencyRevaluation` | 3, 4 |
| `server/cashJournalMapping.test.ts` | Uji jalur valuta asing | 3 |
| `server/currencyRevaluationMapping.test.ts` | Uji tabel penuh `mapCurrencyRevaluation` | 4 |
| `server/ledgerPosting.ts` | `postBankMovements` memasok `rupiahAmount` | 5 |
| `server/bankMovementPosting.test.ts` | Uji pemasokan kurs dan penghalang | 5 |
| `server/currencyRevaluation.ts` | `buildCurrencyRevaluation`, `postCurrencyRevaluation` | 6, 7 |
| `server/currencyRevaluationBuild.test.ts` | Uji bukti per mata uang | 6 |
| `server/currencyRevaluationPosting.test.ts` | Uji jurnal dan idempotensinya | 7 |
| `server/ledgerOperations.ts`, `server/periodClosing.ts` | Dua gerbang | 8 |
| `server/revaluationGate.test.ts` | Uji kedua penolakan | 8 |
| `server/routers.ts` | Dua prosedur pada router `ledger` | 9 |
| `server/currencyRevaluation.authorization.test.ts` | Uji otorisasi | 9 |
| `client/src/pages/BukuBesar.tsx` | Panel Revaluasi Kurs pada tab Periode | 9 |
| `server/currencyRevaluationScenario.test.ts` | Skenario menyeluruh | 10 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku dan struktur data yang berubah | 10 |

---

### Task 1: Migrasi revaluasi kurs (0049)

**Files:**
- Modify: `drizzle/schema.ts` (`accountingPeriods` ~baris 1136; tabel baru di bawah `fixedAssetSettings`)
- Create: `drizzle/0049_*.sql` (hasil generate, akhiran acak dari Drizzle)

**Interfaces:**
- Consumes: —
- Produces: tabel `currency_revaluations`; kolom `accountingPeriods.revaluationPostedAt` dan
  `.revaluationJournalEntryId`. Dipakai tugas 5–10.

- [ ] **Step 1: Tambah dua kolom pada `accountingPeriods`**

Sisipkan tepat sesudah `depreciationJournalEntryId`:

```ts
  /**
   * Penanda bahwa revaluasi kurs bulan ini sudah dijurnal.
   *
   * Kolom, bukan hitungan baris: outlet tanpa rekening valuta asing menghasilkan nol baris
   * revaluasi, dan itu keadaan sah yang tetap harus bisa ditutup. Menghitung baris akan mencampur
   * "belum direvaluasi" dengan "sudah direvaluasi, hasilnya memang kosong" — alasan yang sama
   * persis dengan `depreciationPostedAt`.
   */
  revaluationPostedAt: datetime("revaluationPostedAt"),
  revaluationJournalEntryId: int("revaluationJournalEntryId"),
```

- [ ] **Step 2: Tambah tabel `currency_revaluations`**

Tepat di bawah `fixedAssetSettings`:

```ts
/**
 * Bukti retranslasi pos moneter valuta asing pada akhir periode.
 *
 * SAK EP Bab 30 menuntut saldo pos moneter valuta asing diukur ulang pada kurs penutup, dengan
 * selisihnya ke laba rugi. Barisnya dibuat **berdiri sendiri**: `carryingAfter` dapat diturunkan
 * ulang dari `foreignBalance` dikali `midRatePerUnit` tanpa membuka tabel lain, dan
 * `rateReferenceDate` memperlihatkan bila kurs yang dipakai mundur dari akhir periode. Pola dan
 * alasannya sama dengan `period_closing_valuations`.
 *
 * Hanya pos **moneter**. Kas UKA fisik (1-1210) tidak pernah masuk ke sini — ia persediaan, dinilai
 * dari hitungan fisik lewat 5-1300, dan meretranslasinya di sini menghitung pergerakan kurs yang
 * sama dua kali.
 */
export const currencyRevaluations = mysqlTable("currency_revaluations", {
  id: int("id").autoincrement().primaryKey(),
  periodId: int("periodId").notNull(),
  currencyId: int("currencyId").notNull(),
  /** Saldo rekening dalam valuta aslinya pada akhir periode; skala 6 seperti mutasi bank. */
  foreignBalance: decimal("foreignBalance", { precision: 24, scale: 6 }).notNull(),
  /** Nilai Rupiah yang tercatat pada 1-1220 untuk mata uang ini sebelum revaluasi. */
  carryingBefore: decimal("carryingBefore", { precision: 24, scale: 2 }).notNull(),
  rateSnapshotId: int("rateSnapshotId").notNull(),
  rateReferenceDate: date("rateReferenceDate").notNull(),
  midRatePerUnit: decimal("midRatePerUnit", { precision: 30, scale: 12 }).notNull(),
  /** foreignBalance × midRatePerUnit, dibulatkan ke sen. */
  carryingAfter: decimal("carryingAfter", { precision: 24, scale: 2 }).notNull(),
  /** carryingAfter − carryingBefore. Positif berarti laba selisih kurs. */
  difference: decimal("difference", { precision: 24, scale: 2 }).notNull(),
  journalEntryId: int("journalEntryId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("currency_revaluation_period_currency_uq").on(table.periodId, table.currencyId),
  index("currency_revaluation_period_idx").on(table.periodId),
]);

export type CurrencyRevaluationRecord = typeof currencyRevaluations.$inferSelect;
```

- [ ] **Step 3: Generate migrasi**

```bash
./node_modules/.bin/drizzle-kit generate
```

- [ ] **Step 4: Baca SQL-nya sebelum menerapkannya**

```bash
cat drizzle/0049_*.sql
```

Harus berisi **hanya** satu `CREATE TABLE currency_revaluations`, dua `ALTER TABLE accounting_periods
ADD COLUMN`, dan indeksnya. Bila ada `DROP` apa pun, **berhenti dan laporkan** — migrasi ini aditif.

- [ ] **Step 5: Terapkan ke dua basis data lokal**

```bash
node scripts/tenant.mjs migrate-all
```

- [ ] **Step 6: Verifikasi bacaan-saja**

```bash
mysql -uroot -h127.0.0.1 moneychanger -e "DESCRIBE currency_revaluations;"
mysql -uroot -h127.0.0.1 moneychanger -e "SHOW COLUMNS FROM accounting_periods LIKE 'revaluation%';"
```

- [ ] **Step 7: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add drizzle/schema.ts drizzle/0049_*.sql drizzle/meta
git commit -m "Migrasi register revaluasi kurs (0049)"
```

---

### Task 2: Kurs dan penilaian pos moneter murni di `shared/`

**Files:**
- Create: `shared/currencyRevaluation.ts`
- Test: `shared/currencyRevaluation.test.ts`

**Interfaces:**
- Consumes: `midClosingRate` dari `shared/inventoryValuation.ts` (sudah ada, jangan menulis ulang).
- Produces:
  - `CASH_ACCOUNTS: readonly ["1-1110", "1-1120", "1-1220"]`
  - `snapshotOnOrBefore<T extends { referenceDate: string }>(rows: T[], on: string): T | null`
  - `valueMonetaryBalance(input: { foreignBalance: string; midRatePerUnit: string }): string`

  Dipakai tugas 3, 5, 6, dan paket F2.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `shared/currencyRevaluation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CASH_ACCOUNTS, snapshotOnOrBefore, valueMonetaryBalance } from "./currencyRevaluation";

describe("snapshotOnOrBefore", () => {
  const rows = [
    { referenceDate: "2026-09-30", id: 3 },
    { referenceDate: "2026-09-28", id: 2 },
    { referenceDate: "2026-08-31", id: 1 },
  ];

  it("memilih snapshot tepat pada tanggalnya", () => {
    expect(snapshotOnOrBefore(rows, "2026-09-30")?.id).toBe(3);
  });

  it("mundur ke snapshot terakhir sebelum tanggalnya", () => {
    // BI tidak mengumumkan kurs pada Sabtu, Minggu, dan hari libur. Mundur adalah keadaan sah.
    expect(snapshotOnOrBefore(rows, "2026-09-29")?.id).toBe(2);
  });

  it("tidak pernah memakai snapshot yang melewati tanggalnya", () => {
    expect(snapshotOnOrBefore(rows, "2026-08-31")?.id).toBe(1);
    expect(snapshotOnOrBefore(rows, "2026-08-30")).toBeNull();
  });

  it("mengembalikan null bila tidak ada satu pun", () => {
    expect(snapshotOnOrBefore([], "2026-09-30")).toBeNull();
  });

  it("tidak bergantung pada urutan masukannya", () => {
    const shuffled = [rows[2], rows[0], rows[1]];
    expect(snapshotOnOrBefore(shuffled, "2026-09-29")?.id).toBe(2);
  });
});

describe("valueMonetaryBalance", () => {
  it("mengalikan saldo valuta dengan kurs tengah", () => {
    expect(valueMonetaryBalance({ foreignBalance: "1000.000000", midRatePerUnit: "16300.000000000000" }))
      .toBe("16300000.00");
  });

  it("membulatkan setengah-ke-atas ke sen", () => {
    expect(valueMonetaryBalance({ foreignBalance: "1.000000", midRatePerUnit: "16300.125000000000" }))
      .toBe("16300.13");
  });

  it("menerima saldo nol", () => {
    expect(valueMonetaryBalance({ foreignBalance: "0.000000", midRatePerUnit: "16300.000000000000" }))
      .toBe("0.00");
  });

  it("menolak masukan yang bukan angka dengan menyebut medannya", () => {
    expect(() => valueMonetaryBalance({ foreignBalance: "", midRatePerUnit: "1" }))
      .toThrow(/saldo valuta/i);
  });
});

describe("CASH_ACCOUNTS", () => {
  it("memuat kas Rupiah, bank Rupiah, dan bank valuta asing — bukan kas UKA fisik", () => {
    // 1-1210 adalah persediaan, dinilai lewat 5-1300 pada paket C. Memasukkannya ke kas akan
    // menghitung pergerakan yang sama dua kali pada Arus Kas paket F2.
    expect(CASH_ACCOUNTS).toEqual(["1-1110", "1-1120", "1-1220"]);
  });
});
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
./node_modules/.bin/vitest run shared/currencyRevaluation.test.ts
```
Diharapkan: FAIL — `Failed to resolve import "./currencyRevaluation"`.

- [ ] **Step 3: Tulis implementasi minimalnya**

Buat `shared/currencyRevaluation.ts`:

```ts
/**
 * Retranslasi pos moneter valuta asing.
 *
 * Kurs tengahnya sendiri sudah ada — `midClosingRate` di `shared/inventoryValuation.ts`, dipakai
 * penilaian persediaan paket C. Berkas ini sengaja **tidak** menulis rumus keduanya: dua salinan
 * kurs tengah yang dapat berbeda pendapat adalah persis kekeliruan yang tidak terlihat dari laporan
 * mana pun.
 */

import Decimal from "decimal.js";

/**
 * Akun yang membentuk "kas dan setara kas" pada Arus Kas (paket F2).
 *
 * 1-1210 Kas UKA **tidak** termasuk: ia persediaan yang dinilai dari hitungan fisik lewat 5-1300,
 * bukan setara kas. Memasukkannya akan menghitung pergerakan yang sama dua kali.
 */
export const CASH_ACCOUNTS = ["1-1110", "1-1120", "1-1220"] as const;

/**
 * Snapshot kurs terakhir yang **tidak melewati** `on`.
 *
 * BI tidak mengumumkan kurs pada Sabtu, Minggu, dan hari libur, sehingga kurs yang dipakai boleh
 * lebih awal daripada tanggal yang diminta. Yang tidak boleh adalah memakai kurs yang belum terbit
 * pada tanggal itu — itu menilai masa lalu dengan angka masa depan.
 */
export function snapshotOnOrBefore<T extends { referenceDate: string }>(rows: T[], on: string): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (row.referenceDate > on) continue;
    if (!best || row.referenceDate > best.referenceDate) best = row;
  }
  return best;
}

const decimalOrThrow = (raw: string, label: string): Decimal => {
  let value: Decimal;
  try {
    value = new Decimal(raw);
  } catch {
    throw new Error(`${label} "${raw}" bukan angka yang sah.`);
  }
  if (!value.isFinite()) throw new Error(`${label} "${raw}" bukan angka yang sah.`);
  return value;
};

/**
 * Nilai Rupiah sebuah saldo pos moneter.
 *
 * Pembulatan setengah-ke-atas ke sen disengaja dan tercatat pada spec bagian 9: aturan "menolak
 * membulatkan uang" mengenai konversi uang yang **sudah tercatat**, sedangkan ini pengukuran baru —
 * saldo dikali kurs, yang hampir tidak pernah jatuh pas di sen. Preseden dan alasannya sama dengan
 * `valueForeignInventory` pada paket C.
 */
export function valueMonetaryBalance(input: { foreignBalance: string; midRatePerUnit: string }): string {
  const balance = decimalOrThrow(input.foreignBalance, "Saldo valuta");
  const rate = decimalOrThrow(input.midRatePerUnit, "Kurs tengah");
  return balance.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
./node_modules/.bin/vitest run shared/currencyRevaluation.test.ts
```
Diharapkan: PASS, 10 uji.

- [ ] **Step 5: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add shared/currencyRevaluation.ts shared/currencyRevaluation.test.ts
git commit -m "Kurs dan penilaian pos moneter murni di shared/"
```

---

### Task 3: Jalur valuta asing pada `mapBankMovement`

**Files:**
- Modify: `shared/journalMapping.ts` (`mapBankMovement` ~baris 212-241)
- Test: `server/cashJournalMapping.test.ts` (tambahkan blok baru; **jangan** ubah uji IDR yang ada)

**Interfaces:**
- Consumes: —
- Produces: `mapBankMovement` menerima medan opsional `rupiahAmount: string`. Dipakai tugas 5.

- [ ] **Step 1: Tulis uji yang gagal**

Tambahkan di dalam `describe` `mapBankMovement` pada `server/cashJournalMapping.test.ts`:

```ts
  it("menjurnal rekening valuta asing ke 1-1220 memakai nilai Rupiah yang dipasok", () => {
    // Rekening bank valuta asing adalah pos moneter, bukan persediaan: nilainya masuk buku besar
    // pada kurs tanggal mutasi, lalu diretranslasi pada kurs penutup tiap akhir periode.
    expect(linesOf(mapBankMovement(bank({
      category: "CAPITAL_INJECTION", direction: "IN",
      amount: "1000.000000", currencyCode: "USD", rupiahAmount: "16300000.00",
      reason: "Setoran modal USD",
    })))).toEqual([
      { accountCode: "1-1220", side: "DEBIT", amount: "16300000.00", memo: "Setoran modal USD" },
      { accountCode: "3-1100", side: "KREDIT", amount: "16300000.00", memo: "Setoran modal USD" },
    ]);
  });

  it("memakai 1-1220 pada sisi kredit untuk penarikan pemilik dari rekening valuta asing", () => {
    expect(linesOf(mapBankMovement(bank({
      category: "CAPITAL_WITHDRAWAL", direction: "OUT",
      amount: "500.000000", currencyCode: "USD", rupiahAmount: "8150000.00",
      reason: "Penarikan pemilik USD",
    })))).toEqual([
      { accountCode: "3-4100", side: "DEBIT", amount: "8150000.00", memo: "Penarikan pemilik USD" },
      { accountCode: "1-1220", side: "KREDIT", amount: "8150000.00", memo: "Penarikan pemilik USD" },
    ]);
  });

  it("melewati mutasi valuta asing yang kursnya belum tersedia, beserta jalan keluarnya", () => {
    // Menebak kurs jauh lebih buruk daripada tidak menjurnalnya: angka yang salah di buku besar
    // tidak pernah ditinjau lagi, sedangkan baris `skipped` terlihat pada ringkasan penjurnalan.
    expect(reasonOf(mapBankMovement(bank({
      category: "CAPITAL_INJECTION", direction: "IN",
      amount: "1000.000000", currencyCode: "USD",
      reason: "Setoran modal USD",
    })))).toMatch(/kurs BI pada tanggal mutasi belum tersedia/i);
  });

  it("tidak mengubah perilaku rekening IDR meski nilai Rupiah ikut dipasok", () => {
    expect(linesOf(mapBankMovement(bank({ rupiahAmount: "999.99" })))).toEqual([
      { accountCode: "1-1120", side: "DEBIT", amount: "100000000.00", memo: "Saldo awal rekening BCA 123" },
      { accountCode: "3-1100", side: "KREDIT", amount: "100000000.00", memo: "Saldo awal rekening BCA 123" },
    ]);
  });
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
./node_modules/.bin/vitest run server/cashJournalMapping.test.ts
```
Diharapkan: FAIL — keempat uji baru gagal, tiga karena `rekening valuta asing belum dinilai`, satu
karena `rupiahAmount` bukan medan yang dikenal.

- [ ] **Step 3: Ganti penolakan IDR dengan jalur valuta asing**

Di `shared/journalMapping.ts`, ganti seluruh badan `mapBankMovement` menjadi:

```ts
export function mapBankMovement(input: {
  category: BankMovementCategory;
  direction: "IN" | "OUT" | "ADJUSTMENT";
  /** Nominal dalam valuta rekening. */
  amount: string;
  currencyCode: string;
  /**
   * Nilai Rupiah mutasi ini pada kurs tanggal mutasi. Wajib untuk rekening non-IDR; diabaikan
   * untuk rekening IDR, yang nominal Rupiahnya sudah ada pada `amount`.
   */
  rupiahAmount?: string;
  reason: string;
}): MappingResult {
  const isRupiah = input.currencyCode.trim().toUpperCase() === "IDR";

  switch (input.category) {
    case "TRANSACTION":
      return { skipped: "sisi bank bon sudah terjurnal lewat bonnya sendiri" };
    case "CASH_TRANSFER":
      return { skipped: "pemindahan kas↔bank sudah terjurnal dari sisi kas" };
    case "ADJUSTMENT":
    case "OTHER":
      return { skipped: "penyesuaian rekening bercatatan bebas tidak dapat dipetakan tanpa menebak akunnya" };
  }

  // Rekening valuta asing dinilai pada kurs tanggal mutasinya; lapisan server yang memasoknya,
  // karena pemetaan ini murni dan tidak membaca basis data. Tanpa kurs, tidak dijurnal — menebaknya
  // menaruh angka yang salah di buku besar, tempat ia tidak pernah ditinjau lagi.
  if (!isRupiah && !input.rupiahAmount) {
    return { skipped: "kurs BI pada tanggal mutasi belum tersedia; jalankan sinkronisasi kurs lebih dulu" };
  }

  const parsed = toLedgerAmount(isRupiah ? input.amount : input.rupiahAmount!);
  if (!parsed) return { skipped: "nominal mutasi memiliki pecahan di bawah sen; menjurnalnya menuntut pembulatan uang" };
  if (parsed.amount === "0.00") return { skipped: "mutasi rekening bernilai nol" };
  const memo = input.reason.slice(0, 500);
  const bankAccount = isRupiah ? BANK_ACCOUNT : FX_BANK_ACCOUNT;

  return input.category === "CAPITAL_WITHDRAWAL"
    ? pair(DIVIDEND_ACCOUNT, bankAccount, parsed.amount, memo)
    : pair(bankAccount, PAID_IN_CAPITAL_ACCOUNT, parsed.amount, memo);
}
```

Dan tambahkan konstanta akunnya di dekat `BANK_ACCOUNT` (~baris 121):

```ts
/** Rekening bank dalam valuta asing — pos moneter, diretranslasi tiap akhir periode (paket F1). */
export const FX_BANK_ACCOUNT = "1-1220";
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
./node_modules/.bin/vitest run server/cashJournalMapping.test.ts
```
Diharapkan: PASS, termasuk seluruh uji IDR lama yang tidak boleh berubah.

- [ ] **Step 5: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add shared/journalMapping.ts server/cashJournalMapping.test.ts
git commit -m "Jalur valuta asing pada pemetaan mutasi bank"
```

---

### Task 4: Pemetaan `mapCurrencyRevaluation`

**Files:**
- Modify: `shared/journalMapping.ts` (tambahkan sesudah `mapPeriodInventoryClosing`)
- Test: `server/currencyRevaluationMapping.test.ts`

**Interfaces:**
- Consumes: `FX_BANK_ACCOUNT` dari tugas 3.
- Produces: `mapCurrencyRevaluation(input: { difference: string; month: string }): MappingResult`.
  Dipakai tugas 7.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/currencyRevaluationMapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSkipped, mapCurrencyRevaluation, type MappingResult } from "../shared/journalMapping";
import { assertJournalIsPostable } from "../shared/ledger";

const linesOf = (result: MappingResult) => {
  if (isSkipped(result)) throw new Error(`tidak terpetakan: ${result.skipped}`);
  return result.lines;
};
const reasonOf = (result: MappingResult) => (isSkipped(result) ? result.skipped : "");

describe("mapCurrencyRevaluation", () => {
  it("menjurnal laba selisih kurs ke kredit 7-1500", () => {
    expect(linesOf(mapCurrencyRevaluation({ difference: "250000.00", month: "2026-09" }))).toEqual([
      { accountCode: "1-1220", side: "DEBIT", amount: "250000.00", memo: "Revaluasi kurs 2026-09" },
      { accountCode: "7-1500", side: "KREDIT", amount: "250000.00", memo: "Revaluasi kurs 2026-09" },
    ]);
  });

  it("menjurnal rugi selisih kurs ke debit 7-1500", () => {
    expect(linesOf(mapCurrencyRevaluation({ difference: "-180000.00", month: "2026-09" }))).toEqual([
      { accountCode: "7-1500", side: "DEBIT", amount: "180000.00", memo: "Revaluasi kurs 2026-09" },
      { accountCode: "1-1220", side: "KREDIT", amount: "180000.00", memo: "Revaluasi kurs 2026-09" },
    ]);
  });

  it("melewati bulan yang selisihnya nol", () => {
    // Kurs yang tidak bergerak adalah keadaan sah, bukan kekurangan data. Jurnal bernilai nol
    // ditolak `postJournalEntry`, jadi ia harus dilewati di sini dengan alasan yang terbaca.
    expect(reasonOf(mapCurrencyRevaluation({ difference: "0.00", month: "2026-09" })))
      .toMatch(/tidak ada selisih kurs pada 2026-09/i);
  });

  it("menolak selisih yang bukan angka dua desimal", () => {
    expect(reasonOf(mapCurrencyRevaluation({ difference: "250000.123", month: "2026-09" })))
      .toMatch(/pecahan di bawah sen/i);
  });

  it("menghasilkan jurnal yang lolos penjaga buku besar", () => {
    for (const difference of ["250000.00", "-180000.00"]) {
      expect(() => assertJournalIsPostable(linesOf(mapCurrencyRevaluation({ difference, month: "2026-09" })))).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
./node_modules/.bin/vitest run server/currencyRevaluationMapping.test.ts
```
Diharapkan: FAIL — `mapCurrencyRevaluation is not exported`.

- [ ] **Step 3: Tulis implementasinya**

Tambahkan di `shared/journalMapping.ts`:

```ts
/**
 * Retranslasi pos moneter valuta asing pada akhir periode.
 *
 * Satu jurnal untuk seluruh mata uang sekaligus, alasannya sama seperti penyusutan: jurnal kecil
 * per mata uang setiap bulan mengubur jurnal transaksi di antara derau, dan rincian per mata
 * uangnya sudah tersimpan pada `currency_revaluations` tempat ia dapat diurutkan dan dijumlahkan.
 *
 * `difference` adalah `carryingAfter − carryingBefore` seluruh mata uang. Positif berarti Rupiah
 * melemah terhadap valuta yang dipegang, sehingga nilai tercatatnya naik dan selisihnya laba.
 */
export function mapCurrencyRevaluation(input: { difference: string; month: string }): MappingResult {
  const parsed = toLedgerAmount(input.difference);
  if (!parsed) return { skipped: "selisih revaluasi memiliki pecahan di bawah sen; menjurnalnya menuntut pembulatan uang" };
  if (parsed.amount === "0.00") return { skipped: `tidak ada selisih kurs pada ${input.month}` };

  const memo = `Revaluasi kurs ${input.month}`;
  return parsed.negative
    ? pair(FX_RATE_DIFFERENCE_ACCOUNT, FX_BANK_ACCOUNT, parsed.amount, memo)
    : pair(FX_BANK_ACCOUNT, FX_RATE_DIFFERENCE_ACCOUNT, parsed.amount, memo);
}
```

Dan konstanta akunnya di dekat `FX_BANK_ACCOUNT`:

```ts
/** Muara selisih retranslasi pos moneter; baris B0003 yang sampai paket F1 tidak pernah terisi. */
export const FX_RATE_DIFFERENCE_ACCOUNT = "7-1500";
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
./node_modules/.bin/vitest run server/currencyRevaluationMapping.test.ts
```
Diharapkan: PASS, 5 uji.

- [ ] **Step 5: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add shared/journalMapping.ts server/currencyRevaluationMapping.test.ts
git commit -m "Pemetaan jurnal revaluasi kurs"
```

---

### Task 5: `postBankMovements` memasok nilai Rupiah

**Files:**
- Modify: `server/ledgerPosting.ts` (`postBankMovements`, baris 227-282)
- Test: `server/bankMovementPosting.test.ts`

**Interfaces:**
- Consumes: `snapshotOnOrBefore`, `valueMonetaryBalance` (tugas 2); `mapBankMovement` (tugas 3);
  `midClosingRate` dari `shared/inventoryValuation.ts`.
- Produces: mutasi rekening valuta asing yang benar-benar terjurnal ke 1-1220. Dipakai tugas 6.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/bankMovementPosting.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bankAccountMovements, rateReferenceSnapshots } from "../drizzle/schema";
import * as db from "./db";

vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, postJournalEntry: vi.fn() };
});
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { postJournalEntry } from "./ledgerOperations";
import { postBankMovements } from "./ledgerPosting";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

/** `getDb` dipalsukan; uji ini tidak menyentuh basis data. Kueri dibedakan lewat tabelnya. */
function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy"]) {
      thenable[method] = () => chain(rows);
    }
    return thenable as never;
  };
  const fakeDb = {
    select: vi.fn(() => ({
      from: (table: unknown) => {
        const queue = queues.get(table) ?? [];
        return chain((queue.length > 1 ? queue.shift() : queue[0]) ?? []);
      },
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

const usdMovement = {
  id: 11,
  category: "CAPITAL_INJECTION" as const,
  direction: "IN" as const,
  amount: "1000.000000",
  reason: "Setoran modal USD",
  createdAt: dbDay("2026-09-15"),
  currencyCode: "USD",
  currencyId: 2,
};

/** Kurs BI 15 Sep: beli 16.200, jual 16.400, quoteUnit 1 → tengah 16.300. */
const usdSnapshot = {
  id: 71, currencyId: 2, referenceDate: dbDay("2026-09-15"),
  buyRate: "16200.000000", sellRate: "16400.000000", quoteUnit: "1.000000",
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 501, entryNumber: "JU-202609-0011" } as never);
});

describe("postBankMovements untuk rekening valuta asing", () => {
  it("menjurnal ke 1-1220 pada kurs tengah tanggal mutasi", async () => {
    mockDb([
      { table: bankAccountMovements, results: [[usdMovement]] },
      { table: rateReferenceSnapshots, results: [[usdSnapshot]] },
    ]);

    const outcome = await postBankMovements({ from: dbDay("2026-09-01"), to: dbDay("2026-09-30") }, { id: 3 });

    expect(outcome.skipped).toEqual([]);
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.lines).toEqual([
      { accountCode: "1-1220", side: "DEBIT", amount: "16300000.00", memo: "Setoran modal USD" },
      { accountCode: "3-1100", side: "KREDIT", amount: "16300000.00", memo: "Setoran modal USD" },
    ]);
  });

  it("mundur ke kurs terakhir sebelum tanggal mutasi", async () => {
    // Mutasi pada hari Minggu memakai kurs Jumat. Mundur adalah keadaan sah; memakai kurs yang
    // belum terbit tidak.
    mockDb([
      { table: bankAccountMovements, results: [[{ ...usdMovement, createdAt: dbDay("2026-09-20") }]] },
      { table: rateReferenceSnapshots, results: [[usdSnapshot]] },
    ]);

    await postBankMovements({ from: dbDay("2026-09-01"), to: dbDay("2026-09-30") }, { id: 3 });

    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.lines[0].amount).toBe("16300000.00");
  });

  it("melewati mutasi yang seluruh kursnya terbit sesudah tanggalnya", async () => {
    mockDb([
      { table: bankAccountMovements, results: [[{ ...usdMovement, createdAt: dbDay("2026-09-10") }]] },
      { table: rateReferenceSnapshots, results: [[usdSnapshot]] },
    ]);

    const outcome = await postBankMovements({ from: dbDay("2026-09-01"), to: dbDay("2026-09-30") }, { id: 3 });

    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(outcome.skipped[0].reason).toMatch(/kurs BI pada tanggal mutasi belum tersedia/i);
  });

  it("tidak mengambil kurs untuk rekening IDR", async () => {
    mockDb([
      { table: bankAccountMovements, results: [[{ ...usdMovement, currencyCode: "IDR", currencyId: 1, amount: "5000000.000000" }]] },
      { table: rateReferenceSnapshots, results: [[]] },
    ]);

    const outcome = await postBankMovements({ from: dbDay("2026-09-01"), to: dbDay("2026-09-30") }, { id: 3 });

    expect(outcome.skipped).toEqual([]);
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.lines[0].accountCode).toBe("1-1120");
    expect(entry.lines[0].amount).toBe("5000000.00");
  });
});
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
./node_modules/.bin/vitest run server/bankMovementPosting.test.ts
```
Diharapkan: FAIL — mutasi USD dilewati karena `postBankMovements` belum memasok `rupiahAmount`.

- [ ] **Step 3: Ambil kurs dan pasok nilai Rupiahnya**

Di `server/ledgerPosting.ts`, tambahkan impor:

```ts
import { midClosingRate } from "../shared/inventoryValuation";
import { snapshotOnOrBefore, valueMonetaryBalance } from "../shared/currencyRevaluation";
import { rateReferenceSnapshots } from "../drizzle/schema";
```

Tambahkan `currencyId: bankAccounts.currencyId` pada daftar kolom `select` `postBankMovements`, lalu
sisipkan tepat sesudah kueri `rows` dan sebelum `const outcome = emptyOutcome();`:

```ts
  // Kurs hanya diambil bila ada mutasi non-IDR. Rekening Rupiah tidak pernah menyentuh tabel kurs,
  // sehingga outlet tanpa rekening valuta asing tidak membayar kueri ini sama sekali.
  const foreignRows = rows.filter((row) => row.currencyCode.trim().toUpperCase() !== "IDR");
  const snapshots = foreignRows.length
    ? await db
        .select({
          id: rateReferenceSnapshots.id,
          currencyId: rateReferenceSnapshots.currencyId,
          referenceDate: rateReferenceSnapshots.referenceDate,
          buyRate: rateReferenceSnapshots.buyRate,
          sellRate: rateReferenceSnapshots.sellRate,
          quoteUnit: rateReferenceSnapshots.quoteUnit,
        })
        .from(rateReferenceSnapshots)
        .where(
          and(
            eq(rateReferenceSnapshots.source, "BI_TRANSACTION_RATES"),
            eq(rateReferenceSnapshots.isDemo, false),
          ),
        )
    : [];

  /** Nilai Rupiah sebuah mutasi valuta asing pada kurs tengah tanggal mutasinya. */
  const rupiahValueFor = (row: (typeof rows)[number]): string | undefined => {
    if (row.currencyCode.trim().toUpperCase() === "IDR") return undefined;
    const own = snapshots
      .filter((snapshot) => snapshot.currencyId === row.currencyId)
      .map((snapshot) => ({ ...snapshot, referenceDate: calendarDay(snapshot.referenceDate) }));
    const picked = snapshotOnOrBefore(own, isoDay(row.createdAt));
    if (!picked) return undefined;
    return valueMonetaryBalance({
      foreignBalance: String(row.amount),
      midRatePerUnit: midClosingRate(picked),
    });
  };
```

Lalu pada pemanggilan `mapBankMovement` di dalam perulangannya, tambahkan satu medan:

```ts
    const mapped = mapBankMovement({
      category: row.category,
      direction: row.direction,
      amount: String(row.amount),
      currencyCode: row.currencyCode,
      rupiahAmount: rupiahValueFor(row),
      reason: row.reason,
    });
```

Pastikan `calendarDay` dan `isoDay` sudah diimpor dari `../shared/ledger`; bila belum, tambahkan.

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
./node_modules/.bin/vitest run server/bankMovementPosting.test.ts
```
Diharapkan: PASS, 4 uji.

- [ ] **Step 5: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add server/ledgerPosting.ts server/bankMovementPosting.test.ts
git commit -m "Penjurnalan mutasi bank valuta asing pada kurs tanggal mutasi"
```

---

### Task 6: `buildCurrencyRevaluation` — bukti per mata uang

**Files:**
- Create: `server/currencyRevaluation.ts`
- Test: `server/currencyRevaluationBuild.test.ts`

**Interfaces:**
- Consumes: `currencyRevaluations` (tugas 1); `snapshotOnOrBefore`, `valueMonetaryBalance` (tugas 2);
  baris jurnal 1-1220 yang ditulis tugas 5.
- Produces:
  - `type CurrencyRevaluationRow = { currencyId: number; currencyCode: string; foreignBalance: string; carryingBefore: string; rateSnapshotId: number; rateReferenceDate: string; midRatePerUnit: string; carryingAfter: string; difference: string }`
  - `type CurrencyRevaluation = { periodId: number; periodMonth: string; periodStart: string; periodEnd: string; status: "TERBUKA" | "DITUTUP"; rows: CurrencyRevaluationRow[]; totalDifference: string; blockers: { currencyCode: string; reason: string }[]; revaluationPostedAt: Date | null }`
  - `buildCurrencyRevaluation(periodId: number): Promise<CurrencyRevaluation>`

  Dipakai tugas 7 dan 9.

- [ ] **Step 1: Tulis uji yang gagal**

**Dari mana `carryingBefore` datang.** `bank_account_movements` menyimpan nominal dalam **valuta
aslinya saja** — tidak ada kolom Rupiah, dan tidak boleh ditambahkan. Nilai Rupiah yang benar-benar
tercatat pada 1-1220 hanya ada di **baris jurnalnya**. Karena itu:

```
carryingBefore(C) = Σ baris jurnal 1-1220 (debit − kredit) milik mutasi mata uang C sampai akhir periode
                  + Σ difference revaluasi mata uang C pada periode-periode sebelumnya
```

Baris jurnal dikenali lewat `sourceType = "MUTASI_BANK"` dan `sourceReference = "BANK-{movementId}"`,
lalu `movementId` dipetakan ke mata uangnya lewat `bank_account_movements`. Tidak ada yang ditebak,
dan inti buku besar tidak perlu kolom mata uang.

Buat `server/currencyRevaluationBuild.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountingPeriods,
  bankAccountMovements,
  currencyRevaluations,
  journalEntryLines,
  rateReferenceSnapshots,
} from "../drizzle/schema";
import * as db from "./db";

vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { buildCurrencyRevaluation } from "./currencyRevaluation";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy"]) {
      thenable[method] = () => chain(rows);
    }
    return thenable as never;
  };
  const fakeDb = {
    select: vi.fn(() => ({
      from: (table: unknown) => {
        const queue = queues.get(table) ?? [];
        return chain((queue.length > 1 ? queue.shift() : queue[0]) ?? []);
      },
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

const september = {
  id: 16,
  periodStart: dbDay("2026-09-01"),
  periodEnd: dbDay("2026-09-30"),
  status: "TERBUKA" as const,
  revaluationPostedAt: null,
};

/** USD 1.000 masuk 15 Sep. Nominalnya hanya dalam valuta; Rupiahnya ada di baris jurnalnya. */
const usdMovements = [
  { id: 11, currencyId: 2, currencyCode: "USD", direction: "IN" as const, amount: "1000.000000", createdAt: dbDay("2026-09-15") },
];

/** Baris jurnal 1-1220 milik BANK-11: Rp 16.300.000 pada kurs tengah tanggal mutasi. */
const usdLines = [
  { sourceReference: "BANK-11", accountCode: "1-1220", side: "DEBIT" as const, amount: "16300000.00" },
];

/** Kurs penutup 30 Sep: tengah 16.500 → nilai baru Rp 16.500.000, selisih +200.000. */
const closingSnapshot = {
  id: 80, currencyId: 2, referenceDate: dbDay("2026-09-30"),
  buyRate: "16400.000000", sellRate: "16600.000000", quoteUnit: "1.000000",
};

const scenario = (options: {
  period?: unknown; movements?: unknown[]; lines?: unknown[]; snapshots?: unknown[]; prior?: unknown[];
} = {}) =>
  mockDb([
    { table: accountingPeriods, results: [[options.period ?? september]] },
    { table: bankAccountMovements, results: [options.movements ?? usdMovements] },
    { table: journalEntryLines, results: [options.lines ?? usdLines] },
    { table: rateReferenceSnapshots, results: [options.snapshots ?? [closingSnapshot]] },
    { table: currencyRevaluations, results: [options.prior ?? []] },
  ]);

beforeEach(() => vi.restoreAllMocks());

describe("buildCurrencyRevaluation", () => {
  it("menghitung selisih antara nilai tercatat dan nilai pada kurs penutup", async () => {
    scenario();
    const plan = await buildCurrencyRevaluation(16);

    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({
      currencyCode: "USD",
      foreignBalance: "1000.000000",
      carryingBefore: "16300000.00",
      midRatePerUnit: "16500.000000000000",
      carryingAfter: "16500000.00",
      difference: "200000.00",
    });
    expect(plan.totalDifference).toBe("200000.00");
  });

  it("membaca nilai tercatat dari baris jurnalnya, bukan dari nominal valutanya", async () => {
    // `bank_account_movements` tidak menyimpan Rupiah sama sekali. Menghitung ulang dari nominal
    // valuta dikali kurs hari ini akan melewatkan selisih kurs yang justru sedang dicari.
    scenario({ lines: [
      { sourceReference: "BANK-11", accountCode: "1-1220", side: "DEBIT" as const, amount: "16000000.00" },
    ] });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows[0].carryingBefore).toBe("16000000.00");
    expect(plan.rows[0].difference).toBe("500000.00");
  });

  it("mengurangi baris kredit dari nilai tercatat", async () => {
    scenario({
      movements: [
        ...usdMovements,
        { id: 12, currencyId: 2, currencyCode: "USD", direction: "OUT" as const, amount: "400.000000", createdAt: dbDay("2026-09-20") },
      ],
      lines: [
        ...usdLines,
        { sourceReference: "BANK-12", accountCode: "1-1220", side: "KREDIT" as const, amount: "6520000.00" },
      ],
    });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows[0].foreignBalance).toBe("600.000000");
    expect(plan.rows[0].carryingBefore).toBe("9780000.00");
  });

  it("menyimpan bukti kurs yang dipakai beserta tanggalnya", async () => {
    scenario();
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows[0].rateSnapshotId).toBe(80);
    expect(plan.rows[0].rateReferenceDate).toBe("2026-09-30");
  });

  it("menambahkan selisih revaluasi periode sebelumnya ke nilai tercatat", async () => {
    // Revaluasi Agustus sudah menaikkan 1-1220 sebesar 100.000; nilai tercatat September harus
    // memperhitungkannya, atau selisih yang sama akan dijurnal dua kali.
    scenario({ prior: [{ currencyId: 2, periodId: 15, difference: "100000.00" }] });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows[0].carryingBefore).toBe("16400000.00");
    expect(plan.rows[0].difference).toBe("100000.00");
  });

  it("melewati mata uang yang saldonya nol tanpa menjadikannya penghalang", async () => {
    // Rekening yang sudah dikosongkan bukan kekurangan data.
    scenario({
      movements: [
        ...usdMovements,
        { id: 12, currencyId: 2, currencyCode: "USD", direction: "OUT" as const, amount: "1000.000000", createdAt: dbDay("2026-09-20") },
      ],
      lines: [
        ...usdLines,
        { sourceReference: "BANK-12", accountCode: "1-1220", side: "KREDIT" as const, amount: "16300000.00" },
      ],
    });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows).toEqual([]);
    expect(plan.blockers).toEqual([]);
  });

  it("menjadikan mata uang tanpa kurs sampai akhir periode sebagai penghalang beralasan", async () => {
    scenario({ snapshots: [] });
    const plan = await buildCurrencyRevaluation(16);
    expect(plan.rows).toEqual([]);
    expect(plan.blockers).toEqual([
      { currencyCode: "USD", reason: "tidak ada kurs BI sampai 2026-09-30" },
    ]);
  });

  it("melempar galat bernama bila periodenya tidak ada", async () => {
    mockDb([{ table: accountingPeriods, results: [[]] }]);
    await expect(buildCurrencyRevaluation(999)).rejects.toThrow(/tidak ditemukan/i);
  });
});
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
./node_modules/.bin/vitest run server/currencyRevaluationBuild.test.ts
```
Diharapkan: FAIL — `Failed to resolve import "./currencyRevaluation"`.

- [ ] **Step 3: Tulis `buildCurrencyRevaluation`**

Buat `server/currencyRevaluation.ts`. Ia membaca periode, mutasi bank valuta asing sampai akhir
periode (di-join ke `bankAccounts` → `currencies`), snapshot kurs, dan baris revaluasi terakhir tiap
mata uang; lalu untuk tiap mata uang menghitung `foreignBalance` (IN dikurangi OUT, `ADJUSTMENT`
mengikuti tanda nominalnya), `carryingBefore`, kurs penutup, `carryingAfter`, dan `difference`.
Mata uang bersaldo nol dilewati tanpa baris dan tanpa penghalang; mata uang bersaldo tetapi tanpa
snapshot menjadi penghalang. Struktur, nama, dan komentarnya mengikuti `buildMonthlyDepreciation`
(`server/fixedAssets.ts`) — **baca fungsi itu lebih dulu dan tiru bentuknya**, termasuk pembungkus
`retryTransientDatabaseRead` dan galat bernama `PERIOD_NOT_FOUND`.

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
./node_modules/.bin/vitest run server/currencyRevaluationBuild.test.ts
```
Diharapkan: PASS, 8 uji.

- [ ] **Step 5: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add server/currencyRevaluation.ts server/currencyRevaluationBuild.test.ts
git commit -m "buildCurrencyRevaluation: bukti retranslasi per mata uang"
```

---

### Task 7: `postCurrencyRevaluation` — jurnal periode yang idempoten

**Files:**
- Modify: `server/currencyRevaluation.ts`
- Test: `server/currencyRevaluationPosting.test.ts`

**Interfaces:**
- Consumes: `buildCurrencyRevaluation` (tugas 6); `mapCurrencyRevaluation` (tugas 4).
- Produces:
  - `currencyRevaluationSourceReference(periodMonth: string): string` → `` `REVAL-${periodMonth}` ``
  - `postCurrencyRevaluation(input: { periodId: number }, actor: { id: number }): Promise<{ periodId: number; entryNumber: string | null; rows: CurrencyRevaluationRow[]; skipped: string | null }>`

  Dipakai tugas 8 dan 9.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/currencyRevaluationPosting.test.ts`. Fake-nya merekam **tulisannya beserta
transaksinya**, bentuk yang sama dengan `server/monthlyDepreciationPosting.test.ts`: baris bukti
yang tersimpan tanpa penanda periodenya terlihat seperti revaluasi yang belum berjalan padahal
jurnalnya sudah ada, dan itu hanya dapat dicegah oleh transaksi, bukan oleh urutan pemanggilan.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountingPeriods,
  bankAccountMovements,
  currencyRevaluations,
  journalEntries,
  journalEntryLines,
  rateReferenceSnapshots,
} from "../drizzle/schema";
import * as db from "./db";

vi.mock("./ledgerOperations", () => ({ postJournalEntry: vi.fn() }));
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { postJournalEntry } from "./ledgerOperations";
import { writeAudit } from "./operations";
import { postCurrencyRevaluation } from "./currencyRevaluation";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

type Write = { op: "insert" | "update"; table: unknown; values?: unknown };

function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const transactions: Write[][] = [];

  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy"]) {
      thenable[method] = () => chain(rows);
    }
    return thenable as never;
  };
  const select = () => ({
    from: (table: unknown) => {
      const queue = queues.get(table) ?? [];
      return chain((queue.length > 1 ? queue.shift() : queue[0]) ?? []);
    },
  });

  const writerFor = (log: Write[]) => ({
    insert: (table: unknown) => ({
      values: (values: unknown) => { log.push({ op: "insert", table, values }); return Promise.resolve(); },
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: () => { log.push({ op: "update", table, values }); return Promise.resolve(); },
      }),
    }),
  });

  const fakeDb = {
    select: vi.fn(select),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const log: Write[] = [];
      const result = await callback(writerFor(log));
      transactions.push(log);
      return result;
    }),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { transactions };
}

const september = {
  id: 16,
  periodStart: dbDay("2026-09-01"),
  periodEnd: dbDay("2026-09-30"),
  status: "TERBUKA" as const,
  revaluationPostedAt: null,
};

/** USD 1.000 masuk 15 Sep; nilai Rupiahnya ada pada baris jurnalnya, bukan pada mutasinya. */
const usdMovements = [
  { id: 11, currencyId: 2, currencyCode: "USD", direction: "IN" as const, amount: "1000.000000", createdAt: dbDay("2026-09-15") },
];
const usdLines = [
  { sourceReference: "BANK-11", accountCode: "1-1220", side: "DEBIT" as const, amount: "16300000.00" },
];

/** Kurs penutup 30 Sep: tengah 16.500 → nilai baru Rp 16.500.000, selisih +200.000. */
const closingSnapshot = {
  id: 80, currencyId: 2, referenceDate: dbDay("2026-09-30"),
  buyRate: "16400.000000", sellRate: "16600.000000", quoteUnit: "1.000000",
};

const scenario = (options: {
  period?: unknown; movements?: unknown[]; lines?: unknown[]; snapshots?: unknown[]; prior?: unknown[]; journals?: unknown[];
} = {}) =>
  mockDb([
    { table: accountingPeriods, results: [[options.period ?? september]] },
    { table: bankAccountMovements, results: [options.movements ?? usdMovements] },
    { table: journalEntryLines, results: [options.lines ?? usdLines] },
    { table: rateReferenceSnapshots, results: [options.snapshots ?? [closingSnapshot]] },
    { table: currencyRevaluations, results: [options.prior ?? []] },
    { table: journalEntries, results: [options.journals ?? []] },
  ]);

const writesTo = (transactions: Write[][], table: unknown) =>
  transactions.flat().filter((write) => write.table === table);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 91, entryNumber: "JU-202609-0012" } as never);
  vi.mocked(writeAudit).mockReset().mockResolvedValue(undefined as never);
});

describe("postCurrencyRevaluation", () => {
  it("menulis satu jurnal REVALUASI_KURS bersumber REVAL-2026-09", async () => {
    scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.sourceType).toBe("REVALUASI_KURS");
    expect(entry.sourceReference).toBe("REVAL-2026-09");
    expect(entry.lines).toEqual([
      { accountCode: "1-1220", side: "DEBIT", amount: "200000.00", memo: "Revaluasi kurs 2026-09" },
      { accountCode: "7-1500", side: "KREDIT", amount: "200000.00", memo: "Revaluasi kurs 2026-09" },
    ]);
  });

  it("bertanggal hari terakhir bulan itu, tengah malam lokal", async () => {
    scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.entryDate).toEqual(dbDay("2026-09-30"));
  });

  it("menulis satu baris bukti per mata uang", async () => {
    const { transactions } = scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    const inserted = writesTo(transactions, currencyRevaluations)[0]?.values as Record<string, unknown>[];
    expect(inserted.map((row) => [row.currencyId, row.carryingBefore, row.carryingAfter, row.difference, row.journalEntryId]))
      .toEqual([[2, "16300000.00", "16500000.00", "200000.00", 91]]);
  });

  it("menandai periodenya sudah direvaluasi di dalam transaksi yang sama", async () => {
    const { transactions } = scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].map((write) => write.table)).toEqual([currencyRevaluations, accountingPeriods]);
    const marker = transactions[0][1].values as Record<string, unknown>;
    expect(marker.revaluationPostedAt).toBeInstanceOf(Date);
    expect(marker.revaluationJournalEntryId).toBe(91);
  });

  it("menolak dijalankan dua kali", async () => {
    scenario({ period: { ...september, revaluationPostedAt: new Date("2026-10-01T08:00:00") } });
    await expect(postCurrencyRevaluation({ periodId: 16 }, { id: 3 })).rejects.toThrow(/sudah dijalankan/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("memakai ulang jurnal yang sudah tertulis bila percobaan sebelumnya gagal setelah menjurnal", async () => {
    // Kunci (REVALUASI_KURS, REVAL-2026-09) sudah terisi tetapi penanda periodenya kosong. Menulis
    // jurnal kedua hanya akan menabrak kunci unik dan mengunci bulan itu selamanya.
    const { transactions } = scenario({ journals: [{ id: 91, entryNumber: "JU-202609-0012" }] });
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    expect(postJournalEntry).not.toHaveBeenCalled();
    const marker = writesTo(transactions, accountingPeriods)[0]?.values as Record<string, unknown>;
    expect(marker.revaluationJournalEntryId).toBe(91);
  });

  it("menandai periode yang selisihnya nol sudah direvaluasi, tanpa menulis jurnal", async () => {
    // Kurs yang tidak bergerak adalah keadaan sah yang tetap harus bisa ditutup.
    const { transactions } = scenario({ movements: [], lines: [] });
    const result = await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(result.skipped).toMatch(/tidak ada selisih kurs/i);
    const marker = writesTo(transactions, accountingPeriods)[0]?.values as Record<string, unknown>;
    expect(marker.revaluationPostedAt).toBeInstanceOf(Date);
    expect(marker.revaluationJournalEntryId).toBeNull();
  });

  it("menolak periode yang sudah ditutup", async () => {
    scenario({ period: { ...september, status: "DITUTUP" } });
    await expect(postCurrencyRevaluation({ periodId: 16 }, { id: 3 })).rejects.toThrow(/sudah ditutup/i);
  });

  it("membatalkan seluruhnya bila ada satu penghalang", async () => {
    // Revaluasi tidak pernah berjalan sebagian: buku besar yang setengah diretranslasi jauh lebih
    // sulit ditelusuri daripada yang belum diretranslasi sama sekali.
    scenario({ snapshots: [] });
    await expect(postCurrencyRevaluation({ periodId: 16 }, { id: 3 })).rejects.toThrow(/tidak ada kurs BI/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("menulis jejak audit berisi total dan rincian per mata uang", async () => {
    scenario();
    await postCurrencyRevaluation({ periodId: 16 }, { id: 3 });
    const [audit] = vi.mocked(writeAudit).mock.calls[0];
    expect(audit.action).toBe("CURRENCY_REVALUATION_POSTED");
    expect(audit.entityType).toBe("accounting_periods");
    expect((audit.afterState as Record<string, unknown>).totalDifference).toBe("200000.00");
    expect((audit.afterState as Record<string, unknown>).currencies).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
./node_modules/.bin/vitest run server/currencyRevaluationPosting.test.ts
```
Diharapkan: FAIL — `postCurrencyRevaluation is not exported`.

- [ ] **Step 3: Tulis `postCurrencyRevaluation`**

Tiru `postMonthlyDepreciation` (`server/fixedAssets.ts`) baris demi baris — **baca fungsi itu lebih
dulu**. Perbedaannya hanya: tabel buktinya `currencyRevaluations`, pemetaannya
`mapCurrencyRevaluation({ difference: plan.totalDifference, month: plan.periodMonth })`, `sourceType`
`REVALUASI_KURS`, `sourceReference` `REVAL-{bulan}`, penanda periodenya `revaluationPostedAt` dan
`revaluationJournalEntryId`, dan aksi auditnya `CURRENCY_REVALUATION_POSTED`.

Yang **wajib** ikut ditiru dan tidak boleh disederhanakan:
- angka tidak dihitung ulang — seluruhnya dari `buildCurrencyRevaluation`;
- penolakan periode `DITUTUP` dan periode yang sudah direvaluasi;
- satu penghalang membatalkan seluruhnya;
- pencarian jurnal `(REVALUASI_KURS, REVAL-{bulan})` yang sudah ada sebelum menulis yang baru;
- baris bukti dan penanda periodenya ditulis di dalam **satu** `db.transaction`.

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
./node_modules/.bin/vitest run server/currencyRevaluationPosting.test.ts
```
Diharapkan: PASS, 10 uji.

- [ ] **Step 5: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add server/currencyRevaluation.ts server/currencyRevaluationPosting.test.ts
git commit -m "postCurrencyRevaluation: jurnal revaluasi bulanan yang idempoten"
```

---

### Task 8: Gerbang penutupan periode dan penutup laba tahunan

**Files:**
- Modify: `server/ledgerOperations.ts` (`closeAccountingPeriod`, sesudah gerbang penyusutan ~baris 215)
- Modify: `server/periodClosing.ts` (`postYearEndProfitClosing`)
- Test: `server/revaluationGate.test.ts`

**Interfaces:**
- Consumes: kolom `revaluationPostedAt` (tugas 1).
- Produces: penutupan periode yang menolak revaluasi yang terlewat.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/revaluationGate.test.ts`. Bentuk fake-nya sama dengan `server/depreciationGate.test.ts`
— `closeAccountingPeriod` yang asli ikut diuji, jadi `./ledgerOperations` hanya ditambal pada dua
fungsi yang dipanggil `periodClosing.ts`, bukan diganti seluruhnya.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountingPeriods,
  cashBalances,
  currencies,
  currencyRevaluations,
  journalEntries,
  journalEntryLines,
  periodClosingValuations,
  rateReferenceSnapshots,
  stockOpnames,
} from "../drizzle/schema";
import * as db from "./db";

vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, postJournalEntry: vi.fn(), accountBalancesFor: vi.fn() };
});
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn(), getOpnameSystemCounts: vi.fn() };
});

import { accountBalancesFor, closeAccountingPeriod, postJournalEntry } from "./ledgerOperations";
import { postYearEndProfitClosing } from "./periodClosing";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

type Write = { op: "update" | "insert" | "delete"; table: unknown; values?: unknown };

function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const writes: Write[] = [];
  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "orderBy", "limit"]) thenable[method] = () => chain(rows);
    return thenable as never;
  };
  const rowsFor = (table: unknown) => {
    const queue = queues.get(table) ?? [];
    return (queue.length > 1 ? queue.shift() : queue[0]) ?? [];
  };
  const writer = {
    delete: (table: unknown) => ({ where: () => { writes.push({ op: "delete", table }); return Promise.resolve(); } }),
    insert: (table: unknown) => ({ values: (values: unknown) => { writes.push({ op: "insert", table, values }); return Promise.resolve(); } }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({ where: () => { writes.push({ op: "update", table, values }); return Promise.resolve(); } }),
    }),
  };
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => chain(rowsFor(table)) })),
    ...writer,
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(writer)),
  };
  return { spy: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), writes };
}

const posted = new Date("2026-10-01T03:00:00Z");

const september = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  periodStart: dbDay("2026-09-01"),
  periodEnd: dbDay("2026-09-30"),
  status: "TERBUKA" as const,
  depreciationPostedAt: posted,
  revaluationPostedAt: posted,
  valuationPostedAt: posted,
  profitClosingPostedAt: null,
  ...overrides,
});

const december = (overrides: Record<string, unknown> = {}) => ({
  ...september(),
  id: 12,
  periodStart: dbDay("2026-12-01"),
  periodEnd: dbDay("2026-12-31"),
  ...overrides,
});

/** Dua belas bulan 2026, seluruhnya sudah direvaluasi kecuali yang disebut `missing`. */
const twelveMonths = (missing: string[] = []) =>
  Array.from({ length: 12 }, (_, index) => {
    const month = `${index + 1}`.padStart(2, "0");
    return {
      periodStart: dbDay(`2026-${month}-01`),
      depreciationPostedAt: posted,
      revaluationPostedAt: missing.includes(`2026-${month}`) ? null : posted,
    };
  });

const reads = (periods: unknown[][]) => [
  { table: accountingPeriods, results: periods },
  { table: journalEntries, results: [[]] },
  { table: journalEntryLines, results: [[]] },
  { table: currencies, results: [[]] },
  { table: currencyRevaluations, results: [[]] },
  { table: stockOpnames, results: [[]] },
  { table: rateReferenceSnapshots, results: [[]] },
  { table: periodClosingValuations, results: [[]] },
  { table: cashBalances, results: [[]] },
];

const actor = { id: 42 };

beforeEach(() => {
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 4100, entryNumber: "JU-2026-12-0099" } as never);
  vi.mocked(accountBalancesFor).mockReset().mockResolvedValue([]);
});

describe("closeAccountingPeriod menuntut revaluasi kurs", () => {
  it("menolak periode yang revaluasinya belum dijurnal", async () => {
    const { spy, writes } = mockDb(reads([[september({ revaluationPostedAt: null })]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/revaluasi kurs belum dijurnal/i);
    expect(writes).toEqual([]);
    spy.mockRestore();
  });

  it("memeriksa penyusutan sebelum revaluasi", async () => {
    // Keduanya kosong: pesan penyusutanlah yang lebih dulu sampai, karena ia langkah pertama pada
    // urutan tutup bulan yang tertulis di panduan.
    const { spy } = mockDb(reads([[september({ depreciationPostedAt: null, revaluationPostedAt: null })]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/penyusutan/i);
    spy.mockRestore();
  });

  it("memeriksa revaluasi sebelum penilaian persediaan", async () => {
    // Revaluasi mengubah laba periode ini; penilaian persediaan tidak bergantung padanya.
    const { spy } = mockDb(reads([[september({ revaluationPostedAt: null, valuationPostedAt: null })]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/revaluasi kurs/i);
    spy.mockRestore();
  });

  it("meloloskan periode yang ketiganya sudah dijalankan", async () => {
    const { spy, writes } = mockDb(reads([[september()]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).resolves.toEqual({ id: 9 });
    expect(writes).toEqual([
      expect.objectContaining({ table: accountingPeriods, values: expect.objectContaining({ status: "DITUTUP" }) }),
    ]);
    spy.mockRestore();
  });
});

describe("postYearEndProfitClosing menuntut dua belas bulan revaluasi", () => {
  it("menolak dan menyebut bulan yang revaluasinya belum dijurnal", async () => {
    const { spy } = mockDb(reads([[december()], [], twelveMonths(["2026-12"]), []]));

    await expect(postYearEndProfitClosing({ periodId: 12 }, actor)).rejects.toThrow(/2026-12/);
    expect(postJournalEntry).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("menyebut seluruh bulan yang tertinggal, bukan hanya yang pertama", async () => {
    const { spy } = mockDb(reads([[december()], [], twelveMonths(["2026-07", "2026-12"]), []]));

    const error = await postYearEndProfitClosing({ periodId: 12 }, actor).catch((caught: Error) => caught);
    expect((error as Error).message).toMatch(/2026-07/);
    expect((error as Error).message).toMatch(/2026-12/);
    spy.mockRestore();
  });

  it("meloloskan tahun yang seluruh bulannya sudah direvaluasi", async () => {
    const { spy } = mockDb(reads([[december()], [], twelveMonths(), []]));

    await expect(postYearEndProfitClosing({ periodId: 12 }, actor)).resolves.toBeTruthy();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
./node_modules/.bin/vitest run server/revaluationGate.test.ts
```
Diharapkan: FAIL — periode yang revaluasinya kosong tetap tertutup.

- [ ] **Step 3: Tambahkan gerbang pada `closeAccountingPeriod`**

Sisipkan **tepat di antara** gerbang penyusutan dan gerbang penilaian:

```ts
  // Revaluasi sesudah penyusutan, sebelum penilaian persediaan. Keduanya sama-sama mengubah laba
  // periode ini dan tidak bergantung satu sama lain, sedangkan penilaian persediaan membaca hasil
  // opname yang tidak terpengaruh keduanya. Bulan yang terlupa membuat saldo rekening valuta asing
  // tetap pada kurs lama, dan tidak ada satu pun laporan yang menolaknya.
  if (!period.revaluationPostedAt) {
    throw new Error(
      "Periode tidak dapat ditutup: revaluasi kurs belum dijurnal. Jalankan revaluasi kurs pada panel Periode lebih dulu.",
    );
  }
```

- [ ] **Step 4: Tambahkan gerbang pada `postYearEndProfitClosing`**

Di `server/periodClosing.ts`, di sebelah pemeriksaan dua belas bulan penyusutan yang sudah ada,
tambahkan pemeriksaan yang sama untuk `revaluationPostedAt`, dengan pesan yang menyebut seluruh
bulan yang tertinggal. Alasannya ditulis sebagai komentar:

```ts
  // Penutup laba menolkan 7-1500; menutupnya sebelum selisih kursnya lengkap memindahkan angka yang
  // salah ke 3-2100, dan 3-2100 tidak pernah ditinjau lagi.
```

- [ ] **Step 5: Jalankan uji dan pastikan lulus**

```bash
./node_modules/.bin/vitest run server/revaluationGate.test.ts server/depreciationGate.test.ts server/periodCloseGate.test.ts
```
Diharapkan: PASS seluruhnya — gerbang lama tidak boleh rusak.

- [ ] **Step 6: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add server/ledgerOperations.ts server/periodClosing.ts server/revaluationGate.test.ts
git commit -m "Penutupan periode menolak bulan yang revaluasi kursnya belum dijurnal"
```

---

### Task 9: Prosedur tRPC dan panel Revaluasi Kurs

**Files:**
- Modify: `server/routers.ts` (router `ledger`, sesudah `postMonthlyDepreciation` ~baris 560)
- Modify: `client/src/pages/BukuBesar.tsx` (panel baru di antara `MonthlyDepreciationPanel` dan `PeriodClosingPanel`)
- Test: `server/currencyRevaluation.authorization.test.ts`

**Interfaces:**
- Consumes: `buildCurrencyRevaluation`, `postCurrencyRevaluation` (tugas 6, 7).
- Produces: `trpc.ledger.currencyRevaluation` (query) dan `trpc.ledger.postCurrencyRevaluation` (mutation).

- [ ] **Step 1: Tulis uji otorisasi yang gagal**

Buat `server/currencyRevaluation.authorization.test.ts` dengan meniru
`server/fixedAssets.authorization.test.ts`. Wajib memuat: STAFF ditolak, ADMIN ditolak, CONTROLLER
diizinkan, SHAREHOLDER diizinkan — untuk **kedua** prosedur.

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
./node_modules/.bin/vitest run server/currencyRevaluation.authorization.test.ts
```
Diharapkan: FAIL — prosedurnya belum ada.

- [ ] **Step 3: Tambahkan dua prosedur**

Di `server/routers.ts`, di dalam router `ledger`, tepat sesudah `postMonthlyDepreciation`:

```ts
    /**
     * Revaluasi kurs bulanan. Diletakkan pada router `ledger` bersama penyusutan, dengan alasan
     * yang sama: yang dilakukan orang di tab Periode adalah menutup bulan, dan revaluasi adalah
     * langkah kedua — sesudah penyusutan, sebelum penilaian persediaan.
     */
    currencyRevaluation: controllerProcedure
      .input(z.object({ periodId: z.number().int().positive() }))
      .query(({ input }) => buildCurrencyRevaluation(input.periodId)),
    postCurrencyRevaluation: controllerProcedure
      .input(z.object({ periodId: z.number().int().positive() }))
      .mutation(({ input, ctx }) => postCurrencyRevaluation(input, ctx.user)),
```

Beserta impornya dari `./currencyRevaluation`.

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
./node_modules/.bin/vitest run server/currencyRevaluation.authorization.test.ts
```
Diharapkan: PASS.

- [ ] **Step 5: Tambahkan panel Revaluasi Kurs**

Di `client/src/pages/BukuBesar.tsx`, tambahkan `CurrencyRevaluationPanel` yang meniru
`MonthlyDepreciationPanel` (~baris 944) persis — **baca komponen itu lebih dulu**. Ia dirender di
antara `MonthlyDepreciationPanel` dan `PeriodClosingPanel`, mengikuti urutan gerbangnya. Kolom
tabelnya: Mata uang, Saldo valuta, Kurs tengah, Tanggal kurs, Nilai tercatat, Nilai sesudah,
Selisih. Tanggal kurs yang lebih awal daripada akhir periode diberi tanda "Mundur dari akhir
periode", seperti pada panel penilaian. Wajib punya keadaan memuat, galat, kosong, dan daftar
penghalang beralasan.

Tombol **Tutup periode** juga menerima syarat ketiga: `disabled` bila `inspected && !revalued`,
dengan `title` `"Jurnalkan revaluasi kurs bulan ini lebih dulu."`.

- [ ] **Step 6: Perintah mutu dan commit**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add server/routers.ts server/currencyRevaluation.authorization.test.ts client/src/pages/BukuBesar.tsx
git commit -m "Prosedur tRPC revaluasi kurs dan panelnya pada tab Periode"
```

---

### Task 10: Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

**Files:**
- Create: `server/currencyRevaluationScenario.test.ts`
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`
- Modify: `docs/SKEMA-DATABASE-PROJECT.md`
- Modify: `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md` (centang seluruh baris Paket F1)

**Interfaces:**
- Consumes: seluruh paket.
- Produces: —

- [ ] **Step 1: Tulis skenario menyeluruh**

Buat `server/currencyRevaluationScenario.test.ts` dengan meniru `server/fixedAssetScenario.test.ts` —
satu buku besar palsu yang **menyimpan** apa yang ditulis padanya, sehingga tulisan satu langkah
menjadi bacaan langkah berikutnya. Cerita yang wajib berjalan:

1. Setoran modal USD 1.000 pada 15 September 2026, kurs tengah 16.300 → jurnal `MUTASI_BANK`
   Dr 1-1220 16.300.000 / Cr 3-1100 16.300.000.
2. Revaluasi 30 September pada kurs tengah 16.500 → jurnal `REVALUASI_KURS` `REVAL-2026-09`,
   Dr 1-1220 200.000 / Cr 7-1500 200.000.
3. Saldo 1-1220 menjadi 16.500.000 — persis USD 1.000 × 16.500, dapat diturunkan ulang.
4. September menolak ditutup sebelum revaluasinya dijurnal, lalu lolos sesudahnya.
5. Kurs yang **turun** pada periode berikutnya menghasilkan rugi ke debit 7-1500.
6. Menjalankan revaluasi bulan yang sama dua kali tidak pernah menghasilkan jurnal ganda.

Isi seluruhnya menjadi kode yang benar-benar berjalan.

- [ ] **Step 2: Jalankan skenario**

```bash
./node_modules/.bin/vitest run server/currencyRevaluationScenario.test.ts
```

- [ ] **Step 3: Peragaan end-to-end pada basis data lokal**

**Minta izin pengguna pada giliran itu juga** sebelum membuat data. Lalu, sebagai SHAREHOLDER atau
CONTROLLER di `http://127.0.0.1:3000`:

1. Buat satu rekening bank USD pada tab **Modal & Bank** halaman Kas & Persediaan.
2. Catat setoran modal USD pada tanggal yang punya snapshot kurs BI.
3. Jalankan penjurnalan operasi pada tab Periode untuk rentang tanggal itu.
4. Buka panel **Revaluasi Kurs** dan jurnalkan revaluasinya.
5. Buktikan pada tab **Neraca Saldo** bahwa 1-1220 dan 7-1500 memuat angka nyata, dan sertakan
   tangkapan layarnya.

Aturan `CLAUDE.md` "Fitur Harus Punya Sumber Data": paket ini tidak selesai selama ketiga hal yang
dihidupkannya masih nol di layar.

- [ ] **Step 4: Perbarui panduan A–Z**

Tambahkan bagian **Rekening Valuta Asing dan Revaluasi Kurs** dengan bahasa orang di outlet, memuat:
- Bahwa rekening bank valuta asing kini masuk pembukuan, dan mutasinya dinilai pada kurs BI tanggal
  mutasi.
- Bahwa mutasi pada tanggal tanpa kurs BI tidak dijurnal, dan jalan keluarnya adalah sinkronisasi
  kurs — bukan mengarang kurs.
- Apa itu revaluasi akhir bulan, mengapa saldo yang tidak bergerak tetap berubah nilainya, dan bahwa
  selisihnya bukan uang yang masuk atau keluar.
- **Urutan tutup bulan yang kini berlaku: penyusutan → revaluasi kurs → penilaian persediaan → tutup
  periode**, dan bahwa periode menolak ditutup bila revaluasinya terlewat.
- Bahwa uang tunai UKA di laci **tidak** ikut direvaluasi di sini — ia dinilai lewat stock opname.

Perbarui juga §6.4 langkah-langkahnya dan peta menu bila perlu.

- [ ] **Step 5: Perbarui skema database**

Di `docs/SKEMA-DATABASE-PROJECT.md`, tambahkan `currency_revaluations` beserta kolom dan kunci
uniknya, dua kolom baru `accounting_periods`, dan catatan bahwa `REVALUASI_KURS`, 7-1500, dan 1-1220
kini punya penulisnya.

- [ ] **Step 6: Centang ROADMAP**

Centang seluruh baris Paket F1 di `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`.

- [ ] **Step 7: Perintah mutu penuh dan commit**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
```
Sebutkan angka uji yang benar-benar terlihat, dibandingkan baseline 721 lulus / 2 dilewati / 98 berkas.

```bash
git add server/currencyRevaluationScenario.test.ts docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md docs/SKEMA-DATABASE-PROJECT.md docs/superpowers/ROADMAP-SISA-PEKERJAAN.md
git commit -m "Skenario revaluasi kurs menyeluruh dan dokumentasi paket F1"
```
