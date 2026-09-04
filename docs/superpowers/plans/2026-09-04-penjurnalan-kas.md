# Paket A — Penjurnalan Kas, Setoran Modal, dan Mutasi Kas↔Bank

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat akun 1-1110 Kas Rupiah pada buku besar berhenti negatif, dengan menyediakan jalur pencatatan bagi uang yang melintasi batas usaha (setoran/penarikan modal dan pemindahan kas↔bank) lalu menjurnalnya beserta selisih hitung kas.

**Architecture:** Kategori baru pada `cash_balance_movements` dan `bank_account_movements` (migrasi aditif), dua fungsi operasi CONTROLLER yang menulis mutasi itu, pemetaan jurnal murni di `shared/journalMapping.ts`, dan dua fungsi posting di `server/ledgerPosting.ts` yang idempoten lewat kunci unik `(sourceType, sourceReference)` yang sudah ada. Kategori yang tidak dapat dipetakan tanpa menebak dikembalikan sebagai `skipped` beserta alasannya, tidak dipaksakan ke akun yang kira-kira cocok.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, decimal.js, Zod.

**Spec:** `docs/superpowers/specs/2026-09-04-penjurnalan-kas-design.md`

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu**, supaya sesi
berikutnya tahu harus mulai dari mana tanpa membaca seluruh riwayat.

- [x] Tugas 1 — Migrasi kategori mutasi (0044)
- [x] Tugas 2 — Pemetaan jurnal mutasi kas dan bank
- [x] Tugas 3 — Helper `applyCashMovement`
- [ ] Tugas 4 — `recordCapitalMovement`
- [ ] Tugas 5 — `recordCashBankTransfer`
- [ ] Tugas 6 — Posting ke buku besar
- [ ] Tugas 7 — Tab Modal & Bank
- [ ] Tugas 8 — Panel rekonsiliasi kas
- [ ] Tugas 9 — Skenario dan dokumentasi

Urutannya mengikat: 3 sebelum 4 dan 5; 2 sebelum 6. Tugas 7 dan 8 boleh ditukar.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Perintah mutu wajib sebelum tugas dianggap selesai: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vite build`.
- Muat variabel lingkungan lebih dulu: `export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a` dan `export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"`.
- Baseline sebelum paket ini: **478 uji lulus, 2 dilewati**. Tugas 6 mengganti dua uji lama; jumlahnya akan berubah dan itu disengaja.
- Peran akses `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Otorisasi ditegakkan di tRPC/server, bukan disembunyikan di UI.
- Uang pada buku besar adalah `bigint` sen. Nominal baris jurnal berupa string maksimal **dua** angka desimal (`AMOUNT_PATTERN` di `shared/ledger.ts:18`).
- Kolom `amount` pada `cash_balance_movements` dan `bank_account_movements` berskala **enam** desimal. Konversi ke dua desimal harus eksplisit dan **menolak membulatkan uang**.
- Rincian pecahan (nilai × jumlah lembar) WAJIB untuk setiap pergerakan kas fisik. Jangan membuatnya opsional.
- Jangan menerapkan migrasi ke produksi. Hanya dua basis data lokal: `moneychanger` dan `mc_t_abcvalas`.
- Jangan menerapkan berkas `.sql` langsung lewat klien mysql — penanda `--> statement-breakpoint` membuat pernyataan kedua gagal. Pakai `node scripts/tenant.mjs migrate-all`.
- Membuat data uji transaksi/kas di basis data lokal memerlukan izin pengguna pada giliran itu juga. Seluruh uji dalam rencana ini adalah uji Vitest atas fungsi dengan `getDb` yang dipalsukan — tidak menyentuh data nyata.
- Skrip pembersih uji tidak boleh menghapus `audit_logs`.
- Jangan menyentuh `jakartaBusinessDate`, `OFF_HOURS_SALE`, atau menambah akun ke bagan akun.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `drizzle/schema.ts` | Nilai enum kategori baru pada dua tabel mutasi | 1 |
| `drizzle/0044_*.sql` | Migrasi aditif hasil generate | 1 |
| `shared/journalMapping.ts` | `mapCashMovement`, `mapBankMovement` — murni, tanpa basis data | 2 |
| `server/cashJournalMapping.test.ts` | Uji tabel penuh atas kedua pemetaan | 2 |
| `server/operations.ts` | `applyCashMovement`, `recordCapitalMovement`, `recordCashBankTransfer` | 3, 4, 5 |
| `server/capitalMovement.test.ts` | Uji `recordCapitalMovement` | 4 |
| `server/cashBankTransfer.test.ts` | Uji `recordCashBankTransfer` | 5 |
| `server/routers.ts` | Tiga prosedur tRPC baru di router `cash` | 4, 5 |
| `server/ledgerPosting.ts` | `postCashMovements`, `postBankMovements` | 6 |
| `server/journalMapping.test.ts` | Ganti dua uji penjaga yang jadi usang | 6 |
| `client/src/pages/StockControl.tsx` | Tab "Modal & Bank" berisi dua tindakan | 7 |
| `client/src/pages/BukuBesar.tsx` | Panel rekonsiliasi kas | 8 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku pengguna dan struktur data yang berubah | 9 |

---

### Task 1: Migrasi kategori mutasi baru

**Files:**
- Modify: `drizzle/schema.ts:404` (kategori `cashBalanceMovements`), `drizzle/schema.ts:467` (kategori `bankAccountMovements`)
- Create: `drizzle/0044_*.sql` (hasil generate, nama akhiran acak dari Drizzle)

**Interfaces:**
- Consumes: —
- Produces: nilai enum `"CAPITAL_INJECTION" | "CAPITAL_WITHDRAWAL" | "BANK_DEPOSIT" | "BANK_WITHDRAWAL"` pada `cashBalanceMovements.category`; `"CAPITAL_INJECTION" | "CAPITAL_WITHDRAWAL" | "CASH_TRANSFER"` pada `bankAccountMovements.category`. Dipakai tugas 2–7.

- [x] **Step 1: Ubah enum kategori mutasi kas**

Di `drizzle/schema.ts`, ganti baris `category` pada `cashBalanceMovements`:

```ts
  /** Classifies why the movement exists, mainly for BI stock reporting; TRANSACTION rows keep the prior default behavior. Kategori CAPITAL_* dan BANK_* mencatat uang yang melintasi batas usaha — tanpanya setoran modal menyamar sebagai selisih hitungan kas pagi dan tidak dapat dijurnal. */
  category: mysqlEnum("category", ["OPENING", "TRANSACTION", "SAFE_DEPOSIT", "SAFE_WITHDRAWAL", "OFF_HOURS_SALE", "DENOMINATION_EXCHANGE", "CAPITAL_INJECTION", "CAPITAL_WITHDRAWAL", "BANK_DEPOSIT", "BANK_WITHDRAWAL", "OTHER"]).default("OTHER").notNull(),
```

- [x] **Step 2: Ubah enum kategori mutasi bank**

Ganti baris `category` pada `bankAccountMovements`:

```ts
  /** CASH_TRANSFER adalah sisi bank dari pemindahan kas↔bank; sengaja tidak dijurnal karena sisi kasnya sudah menjurnal pemindahan itu. */
  category: mysqlEnum("category", ["OPENING", "TRANSACTION", "ADJUSTMENT", "CAPITAL_INJECTION", "CAPITAL_WITHDRAWAL", "CASH_TRANSFER", "OTHER"]).default("OTHER").notNull(),
```

- [x] **Step 3: Hasilkan migrasi**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
./node_modules/.bin/drizzle-kit generate
```

- [x] **Step 4: Baca SQL yang dihasilkan sebelum menerapkannya**

```bash
cat drizzle/0044_*.sql
```

Harapan: hanya dua pernyataan `ALTER TABLE ... MODIFY COLUMN ... enum(...)`. **Bila ada `DROP`, `TRUNCATE`, atau perubahan kolom di luar dua `category` itu, berhenti dan laporkan** — migrasi ini harus murni aditif.

- [x] **Step 5: Terapkan ke dua basis data lokal**

```bash
export TENANT_REGISTRY="ibukota=mysql://root@127.0.0.1:3306/moneychanger;abcvalas=mysql://root@127.0.0.1:3306/mc_t_abcvalas"
node scripts/tenant.mjs migrate-all
```

- [x] **Step 6: Pastikan tipe masih bersih**

```bash
./node_modules/.bin/tsc --noEmit
```
Harapan: tanpa galat.

- [x] **Step 7: Commit**

```bash
git add drizzle/schema.ts drizzle/0044_*.sql drizzle/meta
git commit -m "Kategori mutasi untuk uang yang melintasi batas usaha (migrasi 0044)"
```

---

### Task 2: Pemetaan jurnal mutasi kas dan bank

Pemetaan murni tanpa basis data, sehingga dapat diuji sungguhan. Inilah yang menentukan setiap angka pada laporan keuangan.

**Files:**
- Modify: `shared/journalMapping.ts` (tambah di bawah `mapExpense`)
- Test: `server/cashJournalMapping.test.ts` (baru)

**Interfaces:**
- Consumes: `MappedLine`, `MappingResult`, `isSkipped` dari `shared/journalMapping.ts`.
- Produces:
  - `type CashMovementCategory = "OPENING" | "TRANSACTION" | "SAFE_DEPOSIT" | "SAFE_WITHDRAWAL" | "OFF_HOURS_SALE" | "DENOMINATION_EXCHANGE" | "CAPITAL_INJECTION" | "CAPITAL_WITHDRAWAL" | "BANK_DEPOSIT" | "BANK_WITHDRAWAL" | "OTHER"`
  - `type BankMovementCategory = "OPENING" | "TRANSACTION" | "ADJUSTMENT" | "CAPITAL_INJECTION" | "CAPITAL_WITHDRAWAL" | "CASH_TRANSFER" | "OTHER"`
  - `mapCashMovement(input: { category: CashMovementCategory; amount: string; currencyCode: string; reason: string; isFirstMovementForCurrency: boolean }): MappingResult`
  - `mapBankMovement(input: { category: BankMovementCategory; direction: "IN" | "OUT" | "ADJUSTMENT"; amount: string; currencyCode: string; reason: string }): MappingResult`
  - Konstanta: `CASH_ACCOUNT = "1-1110"`, `BANK_ACCOUNT = "1-1120"`, `PAID_IN_CAPITAL_ACCOUNT = "3-1100"`, `DIVIDEND_ACCOUNT = "3-4100"`, `CASH_VARIANCE_ACCOUNT = "7-1900"`

- [x] **Step 1: Tulis uji yang gagal**

Buat `server/cashJournalMapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CHART_OF_ACCOUNTS } from "../shared/chartOfAccounts";
import { isSkipped, mapBankMovement, mapCashMovement, type MappingResult } from "../shared/journalMapping";
import { assertJournalIsPostable } from "../shared/ledger";

const linesOf = (result: MappingResult) => {
  if (isSkipped(result)) throw new Error(`tidak terpetakan: ${result.skipped}`);
  return result.lines;
};
const reasonOf = (result: MappingResult) => {
  if (!isSkipped(result)) throw new Error("seharusnya dilewati, tetapi justru terpetakan");
  return result.skipped;
};
const knownCodes = new Set(CHART_OF_ACCOUNTS.map((account) => account.code));

const kas = (over: Partial<Parameters<typeof mapCashMovement>[0]> = {}) => ({
  category: "CAPITAL_INJECTION" as const, amount: "500000000.000000", currencyCode: "IDR",
  reason: "Setoran modal awal", isFirstMovementForCurrency: false, ...over,
});

describe("pemetaan mutasi kas", () => {
  it("mencatat setoran modal sebagai penambahan kas dan modal disetor", () => {
    expect(linesOf(mapCashMovement(kas()))).toEqual([
      { accountCode: "1-1110", side: "DEBIT", amount: "500000000.00", memo: "Setoran modal awal" },
      { accountCode: "3-1100", side: "KREDIT", amount: "500000000.00", memo: "Setoran modal awal" },
    ]);
  });

  it("mencatat penarikan pemilik sebagai prive/dividen, bukan pengurangan modal disetor", () => {
    // Keputusan pengguna 4 September 2026: penarikan adalah distribusi ke pemilik, dan Modal
    // Disetor tetap utuh supaya jejak setoran modal tidak terhapus oleh penarikan.
    const lines = linesOf(mapCashMovement(kas({ category: "CAPITAL_WITHDRAWAL", amount: "10000000.000000", reason: "Penarikan pemilik" })));
    expect(lines).toEqual([
      { accountCode: "3-4100", side: "DEBIT", amount: "10000000.00", memo: "Penarikan pemilik" },
      { accountCode: "1-1110", side: "KREDIT", amount: "10000000.00", memo: "Penarikan pemilik" },
    ]);
  });

  it("memindahkan kas ke bank tanpa mengubah total aset", () => {
    expect(linesOf(mapCashMovement(kas({ category: "BANK_DEPOSIT", amount: "25000000.000000", reason: "Setor ke BCA" })))).toEqual([
      { accountCode: "1-1120", side: "DEBIT", amount: "25000000.00", memo: "Setor ke BCA" },
      { accountCode: "1-1110", side: "KREDIT", amount: "25000000.00", memo: "Setor ke BCA" },
    ]);
  });

  it("memindahkan bank ke kas dengan arah terbalik", () => {
    expect(linesOf(mapCashMovement(kas({ category: "BANK_WITHDRAWAL", amount: "25000000.000000", reason: "Tarik dari BCA" })))).toEqual([
      { accountCode: "1-1110", side: "DEBIT", amount: "25000000.00", memo: "Tarik dari BCA" },
      { accountCode: "1-1120", side: "KREDIT", amount: "25000000.00", memo: "Tarik dari BCA" },
    ]);
  });

  it("mencatat kas lebih pada pembukaan sebagai pendapatan lain-lain", () => {
    expect(linesOf(mapCashMovement(kas({ category: "OPENING", amount: "50000.000000", reason: "OPENING_CASH_2026-09-04_IDR" })))).toEqual([
      { accountCode: "1-1110", side: "DEBIT", amount: "50000.00", memo: "OPENING_CASH_2026-09-04_IDR" },
      { accountCode: "7-1900", side: "KREDIT", amount: "50000.00", memo: "OPENING_CASH_2026-09-04_IDR" },
    ]);
  });

  it("membalik arah untuk kas kurang pada pembukaan", () => {
    expect(linesOf(mapCashMovement(kas({ category: "OPENING", amount: "-50000.000000", reason: "OPENING_CASH_2026-09-04_IDR" })))).toEqual([
      { accountCode: "7-1900", side: "DEBIT", amount: "50000.00", memo: "OPENING_CASH_2026-09-04_IDR" },
      { accountCode: "1-1110", side: "KREDIT", amount: "50000.00", memo: "OPENING_CASH_2026-09-04_IDR" },
    ]);
  });

  it("menolak menjurnal kas awal pertama, karena asal uangnya belum tercatat", () => {
    // Menjurnalnya ke 7-1900 akan mencatat modal pemilik sebagai pendapatan lain-lain dan
    // menggelembungkan laba. Sistem menolak menebak justru di titik yang paling mahal.
    const reason = reasonOf(mapCashMovement(kas({ category: "OPENING", amount: "500000000.000000", isFirstMovementForCurrency: true })));
    expect(reason).toMatch(/setoran modal/i);
  });

  it("tetap menjurnal kas kurang meski itu mutasi pertama, karena bukan uang masuk tanpa asal", () => {
    expect(linesOf(mapCashMovement(kas({ category: "OPENING", amount: "-25000.000000", isFirstMovementForCurrency: true })))).toHaveLength(2);
  });

  it.each([
    ["TRANSACTION", /bon/i],
    ["SAFE_DEPOSIT", /brankas/i],
    ["SAFE_WITHDRAWAL", /brankas/i],
    ["DENOMINATION_EXCHANGE", /nol/i],
    ["OFF_HOURS_SALE", /bon/i],
    ["OTHER", /menebak/i],
  ] as const)("melewati kategori %s dengan alasan yang dapat dibaca", (category, pattern) => {
    expect(reasonOf(mapCashMovement(kas({ category })))).toMatch(pattern);
  });

  it("melewati mutasi valuta asing, karena persediaan periodik menilainya di akhir periode", () => {
    expect(reasonOf(mapCashMovement(kas({ currencyCode: "USD" })))).toMatch(/periodik|akhir periode/i);
  });

  it("melewati mutasi bernilai nol", () => {
    expect(reasonOf(mapCashMovement(kas({ category: "OPENING", amount: "0.000000" })))).toMatch(/nol|selisih/i);
  });

  it("menolak membulatkan uang alih-alih menjurnal nominal di bawah sen", () => {
    expect(reasonOf(mapCashMovement(kas({ amount: "1000.001234" })))).toMatch(/pembulatan|sen/i);
  });

  it("selalu menghasilkan jurnal seimbang dengan akun yang ada di bagan akun", () => {
    const categories = ["CAPITAL_INJECTION", "CAPITAL_WITHDRAWAL", "BANK_DEPOSIT", "BANK_WITHDRAWAL", "OPENING"] as const;
    for (const category of categories) {
      const lines = linesOf(mapCashMovement(kas({ category, amount: "1234567.890000" })));
      expect(() => assertJournalIsPostable(lines)).not.toThrow();
      for (const line of lines) expect(knownCodes.has(line.accountCode)).toBe(true);
    }
  });
});

describe("pemetaan mutasi bank", () => {
  const bank = (over: Partial<Parameters<typeof mapBankMovement>[0]> = {}) => ({
    category: "OPENING" as const, direction: "ADJUSTMENT" as const, amount: "100000000.000000",
    currencyCode: "IDR", reason: "Saldo awal rekening BCA 123", ...over,
  });

  it("mencatat saldo pembukaan rekening sebagai modal disetor", () => {
    // Berbeda dari kas: rekening bank dibuat sekali dan tidak mengenal salah hitung fisik, jadi
    // saldo pembukaannya tidak ambigu.
    expect(linesOf(mapBankMovement(bank()))).toEqual([
      { accountCode: "1-1120", side: "DEBIT", amount: "100000000.00", memo: "Saldo awal rekening BCA 123" },
      { accountCode: "3-1100", side: "KREDIT", amount: "100000000.00", memo: "Saldo awal rekening BCA 123" },
    ]);
  });

  it("mencatat setoran modal langsung ke rekening", () => {
    expect(linesOf(mapBankMovement(bank({ category: "CAPITAL_INJECTION", direction: "IN", amount: "5000000.000000", reason: "Setoran modal via transfer" })))).toEqual([
      { accountCode: "1-1120", side: "DEBIT", amount: "5000000.00", memo: "Setoran modal via transfer" },
      { accountCode: "3-1100", side: "KREDIT", amount: "5000000.00", memo: "Setoran modal via transfer" },
    ]);
  });

  it("mencatat penarikan pemilik dari rekening sebagai prive/dividen", () => {
    expect(linesOf(mapBankMovement(bank({ category: "CAPITAL_WITHDRAWAL", direction: "OUT", amount: "5000000.000000", reason: "Penarikan pemilik" })))).toEqual([
      { accountCode: "3-4100", side: "DEBIT", amount: "5000000.00", memo: "Penarikan pemilik" },
      { accountCode: "1-1120", side: "KREDIT", amount: "5000000.00", memo: "Penarikan pemilik" },
    ]);
  });

  it("melewati sisi bank dari pemindahan kas, karena sisi kasnya sudah menjurnalnya", () => {
    expect(reasonOf(mapBankMovement(bank({ category: "CASH_TRANSFER", direction: "IN" })))).toMatch(/sisi kas/i);
  });

  it.each([
    ["TRANSACTION", /bon/i],
    ["ADJUSTMENT", /menebak|bebas/i],
    ["OTHER", /menebak|bebas/i],
  ] as const)("melewati kategori bank %s dengan alasan", (category, pattern) => {
    expect(reasonOf(mapBankMovement(bank({ category, direction: "IN" })))).toMatch(pattern);
  });

  it("melewati rekening valuta asing", () => {
    expect(reasonOf(mapBankMovement(bank({ currencyCode: "USD" })))).toMatch(/valuta|IDR/i);
  });
});
```

- [x] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/cashJournalMapping.test.ts
```
Harapan: GAGAL — `mapCashMovement` dan `mapBankMovement` belum diekspor dari `shared/journalMapping.ts`.

- [x] **Step 3: Tulis implementasi**

Tambahkan di akhir `shared/journalMapping.ts`:

```ts
/**
 * Mutasi kas dan bank.
 *
 * Sebagian besar kategori sengaja **tidak** dijurnal, dan itu keputusan pokoknya: sisi kas bon
 * sudah terjurnal lewat bonnya sendiri, perpindahan laci↔brankas adalah kas yang sama pada satu
 * baris B0002, dan penukaran pecahan bernilai net nol. Menjurnalnya sekaligus akan menghitung uang
 * yang sama dua kali. Yang tersisa hanyalah uang yang benar-benar melintasi batas usaha, ditambah
 * selisih hitung fisik pada pembukaan.
 */

export const CASH_ACCOUNT = "1-1110";
export const BANK_ACCOUNT = "1-1120";
export const PAID_IN_CAPITAL_ACCOUNT = "3-1100";
/** Penarikan pemilik dicatat sebagai distribusi, bukan pengurangan setoran — keputusan pengguna 4 September 2026. */
export const DIVIDEND_ACCOUNT = "3-4100";
export const CASH_VARIANCE_ACCOUNT = "7-1900";

export type CashMovementCategory =
  | "OPENING" | "TRANSACTION" | "SAFE_DEPOSIT" | "SAFE_WITHDRAWAL" | "OFF_HOURS_SALE"
  | "DENOMINATION_EXCHANGE" | "CAPITAL_INJECTION" | "CAPITAL_WITHDRAWAL"
  | "BANK_DEPOSIT" | "BANK_WITHDRAWAL" | "OTHER";

export type BankMovementCategory =
  | "OPENING" | "TRANSACTION" | "ADJUSTMENT" | "CAPITAL_INJECTION" | "CAPITAL_WITHDRAWAL"
  | "CASH_TRANSFER" | "OTHER";

/**
 * Kolom mutasi berskala enam desimal, buku besar hanya menerima dua.
 *
 * Membulatkan diam-diam berarti menciptakan atau menghilangkan uang di dalam pembukuan. Karena itu
 * nominal dengan pecahan di bawah sen dikembalikan sebagai `null` dan dilewati beserta alasannya.
 */
function toLedgerAmount(raw: string): { amount: string; negative: boolean } | null {
  const trimmed = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const negative = trimmed.startsWith("-");
  const absolute = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ""] = absolute.split(".");
  const padded = `${fraction}00`.slice(0, 2);
  if (fraction.slice(2).replace(/0/g, "") !== "") return null;
  return { amount: `${whole}.${padded}`, negative };
}

const pair = (debit: string, credit: string, amount: string, memo: string): MappingResult => ({
  lines: [
    { accountCode: debit, side: "DEBIT", amount, memo },
    { accountCode: credit, side: "KREDIT", amount, memo },
  ],
});

export function mapCashMovement(input: {
  category: CashMovementCategory;
  amount: string;
  currencyCode: string;
  reason: string;
  /** Benar bila tidak ada mutasi lain yang lebih awal untuk mata uang ini. */
  isFirstMovementForCurrency: boolean;
}): MappingResult {
  if (input.currencyCode.trim().toUpperCase() !== "IDR") {
    return { skipped: "mutasi valuta asing tidak dinilai per mutasi; persediaan periodik menilainya di akhir periode" };
  }

  switch (input.category) {
    case "TRANSACTION":
      return { skipped: "sisi kas bon sudah terjurnal lewat bonnya sendiri" };
    case "SAFE_DEPOSIT":
    case "SAFE_WITHDRAWAL":
      return { skipped: "perpindahan laci↔brankas adalah kas yang sama; B0002 hanya punya satu baris Kas Rupiah" };
    case "DENOMINATION_EXCHANGE":
      return { skipped: "penukaran pecahan bernilai net nol" };
    case "OFF_HOURS_SALE":
      return { skipped: "penjualan di luar jam tidak menyimpan nilai Rupiah lawannya; seharusnya dicatat sebagai bon" };
    case "OTHER":
      return { skipped: "penyesuaian bercatatan bebas tidak dapat dipetakan tanpa menebak akunnya" };
  }

  const parsed = toLedgerAmount(input.amount);
  if (!parsed) return { skipped: "nominal mutasi memiliki pecahan di bawah sen; menjurnalnya menuntut pembulatan uang" };
  const memo = input.reason.slice(0, 500);
  if (parsed.amount === "0.00") return { skipped: "tidak ada selisih untuk dijurnal" };

  switch (input.category) {
    case "CAPITAL_INJECTION":
      return pair(CASH_ACCOUNT, PAID_IN_CAPITAL_ACCOUNT, parsed.amount, memo);
    case "CAPITAL_WITHDRAWAL":
      return pair(DIVIDEND_ACCOUNT, CASH_ACCOUNT, parsed.amount, memo);
    case "BANK_DEPOSIT":
      return pair(BANK_ACCOUNT, CASH_ACCOUNT, parsed.amount, memo);
    case "BANK_WITHDRAWAL":
      return pair(CASH_ACCOUNT, BANK_ACCOUNT, parsed.amount, memo);
    case "OPENING":
      // Kas awal pertama yang bertambah berarti uang muncul tanpa asal yang tercatat. Menjurnalnya
      // ke 7-1900 akan mencatat modal pemilik sebagai pendapatan lain-lain.
      if (input.isFirstMovementForCurrency && !parsed.negative) {
        return { skipped: "kas awal pertama; asal uangnya belum tercatat — catat sebagai setoran modal lebih dulu" };
      }
      return parsed.negative
        ? pair(CASH_VARIANCE_ACCOUNT, CASH_ACCOUNT, parsed.amount, memo)
        : pair(CASH_ACCOUNT, CASH_VARIANCE_ACCOUNT, parsed.amount, memo);
  }
}

export function mapBankMovement(input: {
  category: BankMovementCategory;
  direction: "IN" | "OUT" | "ADJUSTMENT";
  amount: string;
  currencyCode: string;
  reason: string;
}): MappingResult {
  if (input.currencyCode.trim().toUpperCase() !== "IDR") {
    return { skipped: "rekening valuta asing belum dinilai; hanya rekening IDR yang dijurnal" };
  }

  switch (input.category) {
    case "TRANSACTION":
      return { skipped: "sisi bank bon sudah terjurnal lewat bonnya sendiri" };
    case "CASH_TRANSFER":
      return { skipped: "pemindahan kas↔bank sudah terjurnal dari sisi kas" };
    case "ADJUSTMENT":
    case "OTHER":
      return { skipped: "penyesuaian rekening bercatatan bebas tidak dapat dipetakan tanpa menebak akunnya" };
  }

  const parsed = toLedgerAmount(input.amount);
  if (!parsed) return { skipped: "nominal mutasi memiliki pecahan di bawah sen; menjurnalnya menuntut pembulatan uang" };
  if (parsed.amount === "0.00") return { skipped: "mutasi rekening bernilai nol" };
  const memo = input.reason.slice(0, 500);

  return input.category === "CAPITAL_WITHDRAWAL"
    ? pair(DIVIDEND_ACCOUNT, BANK_ACCOUNT, parsed.amount, memo)
    : pair(BANK_ACCOUNT, PAID_IN_CAPITAL_ACCOUNT, parsed.amount, memo);
}
```

- [x] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/cashJournalMapping.test.ts
./node_modules/.bin/tsc --noEmit
```
Harapan: seluruh uji LULUS, tipe bersih.

- [x] **Step 5: Commit**

```bash
git add shared/journalMapping.ts server/cashJournalMapping.test.ts
git commit -m "Pemetaan jurnal mutasi kas dan bank, dengan alasan bagi tiap kategori yang dilewati"
```

---

### Task 3: Tarik helper `applyCashMovement`

Refactor murni. Penguncian baris, rekonsiliasi pecahan, dan delta stok saat ini inline di `recordCashAdjustment`; tugas 4 dan 5 akan menyalinnya lagi kalau tidak ditarik keluar sekarang.

**Files:**
- Modify: `server/operations.ts:2578-2612` (`recordCashAdjustment`)

**Interfaces:**
- Consumes: `reconcileDenominations` (`server/operations.ts:1639`), `applyDenominationBalanceDelta` (`:1663`), `nonNegativeOrZeroDecimal` (`:162`).
- Produces: `applyCashMovement(tx, input): Promise<{ balanceId: number; currencyCode: string; before: string; after: string; movementId: number }>` dengan `input: { currencyId: number; direction: "IN" | "OUT"; amount: Decimal; reason: string; category: string; denominationRows: { denominationValue: string; quantity: number; subtotal: string }[]; actorUserId: number }`. Dipakai tugas 4 dan 5.

- [x] **Step 1: Pastikan uji yang ada lulus sebagai jaring pengaman**

```bash
./node_modules/.bin/vitest run
```
Harapan: 478 lulus, 2 dilewati. Catat angkanya — refactor ini tidak boleh mengubahnya.

- [x] **Step 2: Tambahkan helper tepat di atas `recordCashAdjustment`**

```ts
/**
 * Satu pergerakan kas fisik: kunci baris saldo, geser saldo, tulis mutasi, dan gerakkan stok pecahan.
 *
 * Ditarik keluar karena tiga pemanggil (penyesuaian, setoran modal, pemindahan kas↔bank) menuntut
 * urutan yang sama persis. Menyalinnya berarti tiga salinan logika kas fisik yang harus dijaga
 * serempak, dan stok pecahan berjalan adalah sumber kebenaran operasional — bukan catatan tambahan.
 */
async function applyCashMovement(
  tx: any,
  input: {
    currencyId: number;
    direction: "IN" | "OUT";
    amount: Decimal;
    reason: string;
    category: string;
    denominationRows: { denominationValue: string; quantity: number; subtotal: string }[];
    actorUserId: number;
  },
) {
  const currency = (await tx.select().from(currencies).where(and(eq(currencies.id, input.currencyId), eq(currencies.active, true))).limit(1))[0];
  if (!currency) throw new Error("Mata uang aktif tidak ditemukan.");
  await tx.execute(sql`SELECT ${cashBalances.id} FROM ${cashBalances} WHERE ${cashBalances.currencyId} = ${input.currencyId} FOR UPDATE`);
  const balance = (await tx.select().from(cashBalances).where(eq(cashBalances.currencyId, input.currencyId)).limit(1))[0];
  if (!balance) throw new Error("Saldo kas belum ada. Catat kas awal terlebih dahulu.");

  const before = new Decimal(String(balance.availableAmount));
  if (input.direction === "OUT" && before.lt(input.amount)) throw new Error("Jumlah melebihi saldo kas yang tersedia.");
  const after = input.direction === "OUT" ? before.minus(input.amount) : before.plus(input.amount);
  await tx.update(cashBalances).set({ availableAmount: after.toFixed(6) }).where(eq(cashBalances.id, balance.id));

  const [movement] = await tx.insert(cashBalanceMovements).values({
    cashBalanceId: balance.id, direction: input.direction, amount: input.amount.toFixed(6),
    reason: input.reason.slice(0, 255), category: input.category as never, createdByUserId: input.actorUserId,
  }).$returningId();
  if (input.denominationRows.length && movement) {
    await tx.insert(cashDenominationEntries).values(input.denominationRows.map((row) => ({ ...row, cashBalanceMovementId: movement.id })));
    await applyDenominationBalanceDelta(tx, input.currencyId, input.denominationRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })), input.direction === "IN" ? 1 : -1);
  }
  return { balanceId: balance.id, currencyCode: currency.code, before: before.toFixed(6), after: after.toFixed(6), movementId: movement?.id ?? 0 };
}
```

- [x] **Step 3: Ganti isi `db.transaction` pada `recordCashAdjustment` agar memakai helper**

```ts
  return db.transaction(async (tx) => {
    const applied = await applyCashMovement(tx, {
      currencyId: input.currencyId, direction, amount, category: input.category,
      reason: `${input.category}: ${notes}`, denominationRows, actorUserId: actor.id,
    });
    await writeAudit({ actorUserId: actor.id, action: "CASH_ADJUSTMENT_RECORDED", entityType: "cash_balance", entityId: String(applied.balanceId), beforeState: { availableAmount: applied.before }, afterState: { availableAmount: applied.after, currency: applied.currencyCode }, reason: notes, metadata: { category: input.category, direction, amount: amount.toFixed(6), denominationCount: denominationRows.length } });
    return { balanceId: applied.balanceId, currencyCode: applied.currencyCode, beforeAmount: applied.before, afterAmount: applied.after, direction, category: input.category };
  });
```

- [x] **Step 4: Jalankan seluruh uji — perilaku tidak boleh berubah**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
```
Harapan: **angka lulus persis sama dengan Step 1**. Bila ada yang gagal, refactor mengubah perilaku — perbaiki, jangan ubah ujinya.

- [x] **Step 5: Commit**

```bash
git add server/operations.ts
git commit -m "Tarik applyCashMovement dari recordCashAdjustment tanpa mengubah perilaku"
```

---

### Task 4: `recordCapitalMovement`

**Files:**
- Modify: `server/operations.ts` (di bawah `recordCashAdjustment`), `server/routers.ts:684` (router `cash`)
- Test: `server/capitalMovement.test.ts` (baru)

**Interfaces:**
- Consumes: `applyCashMovement` (tugas 3), `reconcileDenominations`, `nonNegativeOrZeroDecimal`.
- Produces: `recordCapitalMovement(input: { currencyId: number; direction: "IN" | "OUT"; amount: string; notes: string; denominations: DenominationEntryInput[] }, actor: { id: number; role: StaffRole }): Promise<{ balanceId: number; currencyCode: string; beforeAmount: string; afterAmount: string; direction: "IN" | "OUT" }>`; prosedur tRPC `cash.recordCapitalMovement`.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/capitalMovement.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { recordCapitalMovement } from "./operations";

function mockDb(currencyCode = "IDR", availableAmount = "0.000000") {
  const inserted: { values: any }[] = [];
  const fakeTx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, currencyId: 1, code: currencyCode, availableAmount, active: true }]) }) }) })),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),
    insert: vi.fn(() => ({ values: (values: any) => { inserted.push({ values }); return { $returningId: () => Promise.resolve([{ id: inserted.length }]) }; } })),
  };
  const fakeDb = {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ code: currencyCode }]) }) }) })),
    transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(fakeTx)),
  };
  return { getDb: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), inserted };
}

const controller = { id: 7, role: "CONTROLLER" as const };
const setoran = {
  currencyId: 1, direction: "IN" as const, amount: "500000000",
  notes: "Setoran modal awal dari pemilik",
  denominations: [{ value: "100000", quantity: 5000 }],
};

describe("recordCapitalMovement", () => {
  it("mencatat setoran modal sebagai mutasi berkategori CAPITAL_INJECTION", async () => {
    const { getDb, inserted } = mockDb();
    await recordCapitalMovement(setoran, controller);
    expect(inserted.some((row) => row.values?.category === "CAPITAL_INJECTION" && row.values?.direction === "IN")).toBe(true);
    getDb.mockRestore();
  });

  it("menolak setoran modal dalam valuta asing, karena menjurnalnya menuntut kurs", async () => {
    const { getDb } = mockDb("USD");
    await expect(recordCapitalMovement({ ...setoran, denominations: [{ value: "100", quantity: 10 }], amount: "1000" }, controller))
      .rejects.toThrow(/Rupiah/i);
    getDb.mockRestore();
  });

  it("menolak tanpa rincian pecahan, karena stok pecahan adalah sumber kebenaran operasional", async () => {
    const { getDb } = mockDb();
    await expect(recordCapitalMovement({ ...setoran, denominations: [] }, controller)).rejects.toThrow(/pecahan/i);
    getDb.mockRestore();
  });

  it("menolak rincian pecahan yang tidak sama dengan nominalnya", async () => {
    const { getDb } = mockDb();
    await expect(recordCapitalMovement({ ...setoran, denominations: [{ value: "100000", quantity: 1 }] }, controller)).rejects.toThrow(/tidak sama/i);
    getDb.mockRestore();
  });

  it("menolak catatan yang terlalu pendek untuk menjadi jejak audit", async () => {
    const { getDb } = mockDb();
    await expect(recordCapitalMovement({ ...setoran, notes: "abc" }, controller)).rejects.toThrow(/[Cc]atatan/);
    getDb.mockRestore();
  });

  it("menolak penarikan yang melebihi saldo kas tersedia", async () => {
    const { getDb } = mockDb("IDR", "1000000.000000");
    await expect(recordCapitalMovement({ ...setoran, direction: "OUT" }, controller)).rejects.toThrow(/melebihi saldo/i);
    getDb.mockRestore();
  });
});
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/capitalMovement.test.ts
```
Harapan: GAGAL — `recordCapitalMovement` belum ada.

- [ ] **Step 3: Tulis implementasi di `server/operations.ts`**

```ts
/**
 * Uang yang melintasi batas usaha: setoran modal pemilik dan penarikannya.
 *
 * Sebelum ini tidak ada jalur untuk mencatatnya sama sekali, sehingga modal yang masuk terpaksa
 * menyamar sebagai kenaikan hitungan kas pagi — dan buku besar tidak punya apa pun untuk dijurnal.
 * CONTROLLER ke atas: uang yang melintasi batas usaha bukan keputusan kasir.
 */
export async function recordCapitalMovement(
  input: { currencyId: number; direction: "IN" | "OUT"; amount: string; notes: string; denominations: DenominationEntryInput[] },
  actor: { id: number; role: StaffRole },
) {
  const amount = nonNegativeOrZeroDecimal(input.amount, "Jumlah modal");
  if (amount.lte(0)) throw new Error("Jumlah modal harus lebih besar dari nol.");
  const notes = input.notes.trim();
  if (notes.length < 5) throw new Error("Catatan wajib diisi (minimal 5 karakter) untuk jejak audit.");
  if (!input.denominations?.length) throw new Error("Rincian pecahan wajib diisi untuk setoran/penarikan modal.");

  const db = await databaseOrThrow();
  const currency = (await db.select({ code: currencies.code }).from(currencies).where(eq(currencies.id, input.currencyId)).limit(1))[0];
  if (!currency) throw new Error("Mata uang tidak ditemukan.");
  // Setoran modal dalam valuta asing menuntut kurs yang tidak tersimpan pada tabel mutasi;
  // menebaknya akan membuat nilai Modal Disetor salah sejak awal.
  if (currency.code.trim().toUpperCase() !== "IDR") throw new Error("Setoran dan penarikan modal hanya dapat dicatat dalam Rupiah.");
  const denominationRows = reconcileDenominations(input.denominations, amount, currency.code);

  const category = input.direction === "IN" ? "CAPITAL_INJECTION" : "CAPITAL_WITHDRAWAL";
  return db.transaction(async (tx) => {
    const applied = await applyCashMovement(tx, {
      currencyId: input.currencyId, direction: input.direction, amount, category,
      reason: `${category}: ${notes}`, denominationRows, actorUserId: actor.id,
    });
    await writeAudit({ actorUserId: actor.id, action: "CAPITAL_MOVEMENT_RECORDED", entityType: "cash_balance", entityId: String(applied.balanceId), beforeState: { availableAmount: applied.before }, afterState: { availableAmount: applied.after, currency: applied.currencyCode }, reason: notes, metadata: { category, direction: input.direction, amount: amount.toFixed(6), denominationCount: denominationRows.length } });
    return { balanceId: applied.balanceId, currencyCode: applied.currencyCode, beforeAmount: applied.before, afterAmount: applied.after, direction: input.direction };
  });
}
```

- [ ] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/capitalMovement.test.ts
```
Harapan: LULUS.

- [ ] **Step 5: Ekspos lewat tRPC**

Tambahkan `recordCapitalMovement` ke daftar impor di `server/routers.ts:68`, lalu tambahkan prosedur di dalam router `cash` (setelah `recordAdjustment`):

```ts
    recordCapitalMovement: controllerProcedure.input(z.object({
      currencyId: z.number().int().positive(),
      direction: z.enum(["IN", "OUT"]),
      amount: decimalString,
      notes: z.string().trim().min(5).max(500),
      denominations: z.array(z.object({ value: decimalString, quantity: z.number().int().positive() })).min(1, "Rincian pecahan wajib diisi untuk setoran/penarikan modal.").max(50),
    })).mutation(({ input, ctx }) => recordCapitalMovement(input, ctx.user)),
```

- [ ] **Step 6: Pastikan tipe dan seluruh uji bersih**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

- [ ] **Step 7: Commit**

```bash
git add server/operations.ts server/routers.ts server/capitalMovement.test.ts
git commit -m "Catat setoran dan penarikan modal sebagai mutasi kas bertipe sendiri"
```

---

### Task 5: `recordCashBankTransfer`

**Files:**
- Modify: `server/operations.ts` (di bawah `recordCapitalMovement`), `server/routers.ts` (router `cash`)
- Test: `server/cashBankTransfer.test.ts` (baru)

**Interfaces:**
- Consumes: `applyCashMovement` (tugas 3), `bankAccounts`, `bankAccountMovements` dari `drizzle/schema`.
- Produces: `recordCashBankTransfer(input: { currencyId: number; bankAccountId: number; direction: "TO_BANK" | "TO_CASH"; amount: string; notes: string; denominations: DenominationEntryInput[] }, actor: { id: number; role: StaffRole }): Promise<{ balanceId: number; bankAccountId: number; currencyCode: string; cashAfter: string; bankAfter: string; direction: "TO_BANK" | "TO_CASH" }>`; prosedur tRPC `cash.recordBankTransfer`.

- [ ] **Step 1: Tulis uji yang gagal**

Buat `server/cashBankTransfer.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { recordCashBankTransfer } from "./operations";

function mockDb(opts: { currencyCode?: string; cashAmount?: string; bankCurrencyId?: number; bankAmount?: string } = {}) {
  const { currencyCode = "IDR", cashAmount = "100000000.000000", bankCurrencyId = 1, bankAmount = "50000000.000000" } = opts;
  const inserted: { values: any }[] = [];
  const updates: any[] = [];
  const fakeTx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn((fields: Record<string, unknown> = {}) => ({
      from: (table: any) => ({
        where: () => ({ limit: () => {
          const name = String(table?.[Symbol.for("drizzle:Name")] ?? "");
          if (name === "bank_accounts") return Promise.resolve([{ id: 9, currencyId: bankCurrencyId, availableAmount: bankAmount, active: true }]);
          if (name === "currencies") return Promise.resolve([{ id: 1, code: currencyCode, active: true }]);
          return Promise.resolve([{ id: 1, currencyId: 1, availableAmount: cashAmount }]);
        } }),
      }),
    })),
    update: vi.fn(() => ({ set: (values: any) => { updates.push(values); return { where: () => Promise.resolve(undefined) }; } })),
    insert: vi.fn(() => ({ values: (values: any) => { inserted.push({ values }); return { $returningId: () => Promise.resolve([{ id: inserted.length }]) }; } })),
  };
  const fakeDb = {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ code: currencyCode }]) }) }) })),
    transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(fakeTx)),
  };
  return { getDb: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), inserted, updates };
}

const controller = { id: 7, role: "CONTROLLER" as const };
const setor = {
  currencyId: 1, bankAccountId: 9, direction: "TO_BANK" as const, amount: "25000000",
  notes: "Setor kas berlebih ke rekening BCA",
  denominations: [{ value: "100000", quantity: 250 }],
};

describe("recordCashBankTransfer", () => {
  it("menggerakkan kedua sisi: mutasi kas BANK_DEPOSIT dan mutasi bank CASH_TRANSFER", async () => {
    const { getDb, inserted } = mockDb();
    await recordCashBankTransfer(setor, controller);
    expect(inserted.some((row) => row.values?.category === "BANK_DEPOSIT" && row.values?.direction === "OUT")).toBe(true);
    expect(inserted.some((row) => row.values?.category === "CASH_TRANSFER" && row.values?.direction === "IN")).toBe(true);
    getDb.mockRestore();
  });

  it("membalik kedua arah saat menarik dari bank ke kas", async () => {
    const { getDb, inserted } = mockDb();
    await recordCashBankTransfer({ ...setor, direction: "TO_CASH" }, controller);
    expect(inserted.some((row) => row.values?.category === "BANK_WITHDRAWAL" && row.values?.direction === "IN")).toBe(true);
    expect(inserted.some((row) => row.values?.category === "CASH_TRANSFER" && row.values?.direction === "OUT")).toBe(true);
    getDb.mockRestore();
  });

  it("menolak rekening yang mata uangnya berbeda dari kas", async () => {
    const { getDb } = mockDb({ bankCurrencyId: 2 });
    await expect(recordCashBankTransfer(setor, controller)).rejects.toThrow(/mata uang/i);
    getDb.mockRestore();
  });

  it("menolak setoran yang melebihi kas tersedia", async () => {
    const { getDb } = mockDb({ cashAmount: "1000000.000000" });
    await expect(recordCashBankTransfer(setor, controller)).rejects.toThrow(/melebihi saldo/i);
    getDb.mockRestore();
  });

  it("menolak penarikan yang melebihi saldo rekening", async () => {
    const { getDb } = mockDb({ bankAmount: "1000000.000000" });
    await expect(recordCashBankTransfer({ ...setor, direction: "TO_CASH" }, controller)).rejects.toThrow(/melebihi saldo rekening/i);
    getDb.mockRestore();
  });

  it("menolak tanpa rincian pecahan", async () => {
    const { getDb } = mockDb();
    await expect(recordCashBankTransfer({ ...setor, denominations: [] }, controller)).rejects.toThrow(/pecahan/i);
    getDb.mockRestore();
  });
});
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/cashBankTransfer.test.ts
```
Harapan: GAGAL — `recordCashBankTransfer` belum ada.

- [ ] **Step 3: Tulis implementasi**

```ts
/**
 * Pemindahan uang antara laci dan rekening perusahaan.
 *
 * Kedua sisi bergerak dalam satu transaksi basis data: kas fisik beserta stok pecahannya, dan
 * saldo rekening. Hanya sisi kas yang dijurnal; sisi banknya berkategori `CASH_TRANSFER` yang
 * sengaja dilewati pemetaan, supaya uang yang sama tidak terhitung dua kali.
 */
export async function recordCashBankTransfer(
  input: { currencyId: number; bankAccountId: number; direction: "TO_BANK" | "TO_CASH"; amount: string; notes: string; denominations: DenominationEntryInput[] },
  actor: { id: number; role: StaffRole },
) {
  const amount = nonNegativeOrZeroDecimal(input.amount, "Jumlah pemindahan");
  if (amount.lte(0)) throw new Error("Jumlah pemindahan harus lebih besar dari nol.");
  const notes = input.notes.trim();
  if (notes.length < 5) throw new Error("Catatan wajib diisi (minimal 5 karakter) untuk jejak audit.");
  if (!input.denominations?.length) throw new Error("Rincian pecahan wajib diisi untuk pemindahan kas ke/dari bank.");

  const db = await databaseOrThrow();
  const currencyForValidation = (await db.select({ code: currencies.code }).from(currencies).where(eq(currencies.id, input.currencyId)).limit(1))[0];
  if (!currencyForValidation) throw new Error("Mata uang tidak ditemukan.");
  const denominationRows = reconcileDenominations(input.denominations, amount, currencyForValidation.code);

  const toBank = input.direction === "TO_BANK";
  const cashCategory = toBank ? "BANK_DEPOSIT" : "BANK_WITHDRAWAL";

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT ${bankAccounts.id} FROM ${bankAccounts} WHERE ${bankAccounts.id} = ${input.bankAccountId} FOR UPDATE`);
    const account = (await tx.select().from(bankAccounts).where(eq(bankAccounts.id, input.bankAccountId)).limit(1))[0];
    if (!account) throw new Error("Rekening bank tidak ditemukan.");
    if (account.currencyId !== input.currencyId) throw new Error("Mata uang rekening berbeda dari mata uang kas yang dipindahkan.");

    const bankBefore = new Decimal(String(account.availableAmount));
    if (!toBank && bankBefore.lt(amount)) throw new Error("Jumlah penarikan melebihi saldo rekening yang tersedia.");
    const bankAfter = toBank ? bankBefore.plus(amount) : bankBefore.minus(amount);

    const applied = await applyCashMovement(tx, {
      currencyId: input.currencyId, direction: toBank ? "OUT" : "IN", amount, category: cashCategory,
      reason: `${cashCategory}: ${notes}`, denominationRows, actorUserId: actor.id,
    });

    await tx.update(bankAccounts).set({ availableAmount: bankAfter.toFixed(6) }).where(eq(bankAccounts.id, account.id));
    await tx.insert(bankAccountMovements).values({
      bankAccountId: account.id, direction: toBank ? "IN" : "OUT", amount: amount.toFixed(6),
      reason: `CASH_TRANSFER: ${notes}`.slice(0, 255), category: "CASH_TRANSFER", createdByUserId: actor.id,
    });

    await writeAudit({ actorUserId: actor.id, action: "CASH_BANK_TRANSFER_RECORDED", entityType: "cash_balance", entityId: String(applied.balanceId), beforeState: { cash: applied.before, bank: bankBefore.toFixed(6) }, afterState: { cash: applied.after, bank: bankAfter.toFixed(6), currency: applied.currencyCode }, reason: notes, metadata: { direction: input.direction, bankAccountId: account.id, amount: amount.toFixed(6), denominationCount: denominationRows.length } });

    return { balanceId: applied.balanceId, bankAccountId: account.id, currencyCode: applied.currencyCode, cashAfter: applied.after, bankAfter: bankAfter.toFixed(6), direction: input.direction };
  });
}
```

- [ ] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/cashBankTransfer.test.ts
```
Harapan: LULUS. Bila palsu `select` tidak membedakan tabel dengan benar, sesuaikan pengenal tabel pada palsu itu — jangan melonggarkan asersinya.

- [ ] **Step 5: Ekspos lewat tRPC**

Impor `recordCashBankTransfer` di `server/routers.ts`, lalu tambahkan di router `cash`:

```ts
    recordBankTransfer: controllerProcedure.input(z.object({
      currencyId: z.number().int().positive(),
      bankAccountId: z.number().int().positive(),
      direction: z.enum(["TO_BANK", "TO_CASH"]),
      amount: decimalString,
      notes: z.string().trim().min(5).max(500),
      denominations: z.array(z.object({ value: decimalString, quantity: z.number().int().positive() })).min(1, "Rincian pecahan wajib diisi untuk pemindahan kas.").max(50),
    })).mutation(({ input, ctx }) => recordCashBankTransfer(input, ctx.user)),
```

- [ ] **Step 6: Pastikan tipe dan seluruh uji bersih**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

- [ ] **Step 7: Commit**

```bash
git add server/operations.ts server/routers.ts server/cashBankTransfer.test.ts
git commit -m "Pemindahan kas ke dan dari rekening bank dalam satu transaksi dua sisi"
```

---

### Task 6: Posting mutasi kas dan bank ke buku besar

**Files:**
- Modify: `server/ledgerPosting.ts`, `server/journalMapping.test.ts:124-155` (ganti dua uji penjaga yang menjadi usang)

**Interfaces:**
- Consumes: `mapCashMovement`, `mapBankMovement` (tugas 2); `postJournalEntry` (`server/ledgerOperations.ts:375`); `alreadyJournaled` (`server/ledgerPosting.ts:34`, perlu diperluas tipenya).
- Produces: `postCashMovements(input: { from: Date; to: Date }, actor: { id: number }): Promise<PostingOutcome>`, `postBankMovements(...)` dengan bentuk sama; keduanya masuk ke ringkasan `postOperationsToLedger`.

- [ ] **Step 1: Ganti dua uji penjaga yang menjadi usang**

`server/journalMapping.test.ts:149` saat ini menjaga agar mutasi kas **tidak** dijurnal. Penjaga itu sudah selesai tugasnya. Ganti blok uji tersebut dengan penjaga baru yang menjaga hal yang masih benar:

```ts
  it("menjurnal mutasi kas dan bank tanpa menghitung ulang sisi kas bon", () => {
    // Sisi kas bon sudah terjurnal lewat bonnya sendiri; kategori TRANSACTION karena itu wajib
    // tetap dilewati oleh pemetaan, bukan ikut dijurnal dari tabel mutasi.
    expect(source).toContain("cashBalanceMovements");
    expect(source).toContain("bankAccountMovements");
    const mapping = readFileSync(new URL("../shared/journalMapping.ts", import.meta.url), "utf8");
    expect(mapping).toContain("sisi kas bon sudah terjurnal lewat bonnya sendiri");
    expect(mapping).toContain("pemindahan kas↔bank sudah terjurnal dari sisi kas");
  });
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/journalMapping.test.ts
```
Harapan: GAGAL — `ledgerPosting.ts` belum menyebut `cashBalanceMovements`.

- [ ] **Step 3: Perluas `alreadyJournaled` agar menerima seluruh tipe sumber**

Di `server/ledgerPosting.ts`, ganti tanda tangannya:

```ts
type PostedSourceType = "TRANSAKSI_VALUTA" | "PENGELUARAN" | "MUTASI_KAS" | "MUTASI_BANK";

async function alreadyJournaled(sourceType: PostedSourceType, references: string[]) {
```

- [ ] **Step 4: Tambahkan kedua fungsi posting**

```ts
/**
 * Mutasi kas.
 *
 * Kebanyakan kategori sengaja dilewati — lihat `mapCashMovement`. Penanda "mutasi pertama untuk
 * mata uang ini" dihitung di sini, bukan di pemetaan, supaya pemetaannya tetap murni dan dapat
 * diuji tanpa basis data.
 */
export async function postCashMovements(input: { from: Date; to: Date }, actor: { id: number }) {
  const db = await databaseOrThrow();
  const rows = await db
    .select({
      id: cashBalanceMovements.id,
      cashBalanceId: cashBalanceMovements.cashBalanceId,
      category: cashBalanceMovements.category,
      amount: cashBalanceMovements.amount,
      reason: cashBalanceMovements.reason,
      createdAt: cashBalanceMovements.createdAt,
      currencyCode: currencies.code,
    })
    .from(cashBalanceMovements)
    .innerJoin(cashBalances, eq(cashBalances.id, cashBalanceMovements.cashBalanceId))
    .innerJoin(currencies, eq(currencies.id, cashBalances.currencyId))
    .where(and(gte(cashBalanceMovements.createdAt, dbDate(input.from)), lte(cashBalanceMovements.createdAt, new Date(`${isoDay(input.to)}T23:59:59`))))
    .orderBy(cashBalanceMovements.id);

  const outcome = emptyOutcome();
  const done = await alreadyJournaled("MUTASI_KAS", rows.map((row) => `KAS-${row.id}`));

  // Satu kueri per saldo kas yang tersentuh, bukan per mutasi.
  const firstMovementIdByBalance = new Map<number, number>();
  for (const balanceId of new Set(rows.map((row) => row.cashBalanceId))) {
    const earliest = await db
      .select({ id: cashBalanceMovements.id })
      .from(cashBalanceMovements)
      .where(eq(cashBalanceMovements.cashBalanceId, balanceId))
      .orderBy(cashBalanceMovements.id)
      .limit(1);
    if (earliest[0]) firstMovementIdByBalance.set(balanceId, earliest[0].id);
  }

  for (const row of rows) {
    const reference = `KAS-${row.id}`;
    if (done.has(reference)) {
      outcome.alreadyPosted.push(reference);
      continue;
    }
    const mapped = mapCashMovement({
      category: row.category,
      amount: String(row.amount),
      currencyCode: row.currencyCode,
      reason: row.reason,
      isFirstMovementForCurrency: firstMovementIdByBalance.get(row.cashBalanceId) === row.id,
    });
    if (isSkipped(mapped)) {
      outcome.skipped.push({ reference, reason: mapped.skipped });
      continue;
    }
    const entry = await postJournalEntry(
      { entryDate: new Date(row.createdAt), description: `Mutasi kas — ${row.reason}`.slice(0, 500), sourceType: "MUTASI_KAS", sourceReference: reference, lines: mapped.lines },
      actor,
    );
    outcome.posted.push({ reference, entryNumber: entry.entryNumber });
  }
  return outcome;
}

export async function postBankMovements(input: { from: Date; to: Date }, actor: { id: number }) {
  const db = await databaseOrThrow();
  const rows = await db
    .select({
      id: bankAccountMovements.id,
      category: bankAccountMovements.category,
      direction: bankAccountMovements.direction,
      amount: bankAccountMovements.amount,
      reason: bankAccountMovements.reason,
      createdAt: bankAccountMovements.createdAt,
      currencyCode: currencies.code,
    })
    .from(bankAccountMovements)
    .innerJoin(bankAccounts, eq(bankAccounts.id, bankAccountMovements.bankAccountId))
    .innerJoin(currencies, eq(currencies.id, bankAccounts.currencyId))
    .where(and(gte(bankAccountMovements.createdAt, dbDate(input.from)), lte(bankAccountMovements.createdAt, new Date(`${isoDay(input.to)}T23:59:59`))))
    .orderBy(bankAccountMovements.id);

  const outcome = emptyOutcome();
  const done = await alreadyJournaled("MUTASI_BANK", rows.map((row) => `BANK-${row.id}`));

  for (const row of rows) {
    const reference = `BANK-${row.id}`;
    if (done.has(reference)) {
      outcome.alreadyPosted.push(reference);
      continue;
    }
    const mapped = mapBankMovement({ category: row.category, direction: row.direction, amount: String(row.amount), currencyCode: row.currencyCode, reason: row.reason });
    if (isSkipped(mapped)) {
      outcome.skipped.push({ reference, reason: mapped.skipped });
      continue;
    }
    const entry = await postJournalEntry(
      { entryDate: new Date(row.createdAt), description: `Mutasi bank — ${row.reason}`.slice(0, 500), sourceType: "MUTASI_BANK", sourceReference: reference, lines: mapped.lines },
      actor,
    );
    outcome.posted.push({ reference, entryNumber: entry.entryNumber });
  }
  return outcome;
}
```

Perbarui impor di puncak berkas:

```ts
import { bankAccountMovements, bankAccounts, cashBalanceMovements, cashBalances, currencies, exchangeTransactions, journalEntries, operationalExpenses } from "../drizzle/schema";
import { isSkipped, mapBankMovement, mapCashMovement, mapExchangeTransaction, mapExpense } from "../shared/journalMapping";
```

- [ ] **Step 5: Sambungkan ke `postOperationsToLedger`**

Ganti isi fungsinya, dan **hapus paragraf komentar lama** yang menyatakan mutasi kas belum termasuk:

```ts
/**
 * Menjurnal seluruh sumber yang sudah terpetakan pada satu rentang tanggal.
 *
 * Idempoten: dijalankan ulang atas rentang yang sama menghasilkan `alreadyPosted`, bukan jurnal
 * ganda. Kategori mutasi yang sengaja tidak dijurnal dikembalikan pada `skipped` beserta alasannya,
 * supaya operator dapat melihat apa yang tidak masuk buku besar dan mengapa.
 */
export async function postOperationsToLedger(input: { from: Date; to: Date }, actor: { id: number }) {
  if (input.from > input.to) throw new Error("Tanggal mulai tidak boleh melewati tanggal akhir.");

  const transactions = await postExchangeTransactions(input, actor);
  const expenses = await postExpenses(input, actor);
  const cashMovements = await postCashMovements(input, actor);
  const bankMovements = await postBankMovements(input, actor);
  const parts = [transactions, expenses, cashMovements, bankMovements];

  const summary = {
    from: isoDay(input.from),
    to: isoDay(input.to),
    transactions,
    expenses,
    cashMovements,
    bankMovements,
    postedCount: parts.reduce((total, part) => total + part.posted.length, 0),
    alreadyPostedCount: parts.reduce((total, part) => total + part.alreadyPosted.length, 0),
    skippedCount: parts.reduce((total, part) => total + part.skipped.length, 0),
  };

  await writeAudit({
    actorUserId: actor.id,
    action: "LEDGER_AUTO_POSTED",
    entityType: "journal_entries",
    entityId: "*",
    afterState: { from: summary.from, to: summary.to, posted: summary.postedCount, alreadyPosted: summary.alreadyPostedCount, skipped: summary.skippedCount },
  });
  return summary;
}
```

- [ ] **Step 6: Uji idempotensi posting**

Tambahkan ke `server/cashJournalMapping.test.ts`. Jurnal yang sudah pernah ditulis harus dilaporkan sebagai `alreadyPosted`, bukan ditulis ulang — kalau tidak, menekan tombol jurnalkan dua kali akan menggandakan seluruh kas.

```ts
import { postCashMovements } from "./ledgerPosting";
import * as db from "./db";
import * as ledgerOperations from "./ledgerOperations";

describe("idempotensi posting mutasi kas", () => {
  it("melaporkan mutasi yang sudah pernah dijurnal sebagai alreadyPosted, tanpa menulis ulang", async () => {
    const movement = { id: 11, cashBalanceId: 1, category: "CAPITAL_INJECTION", amount: "500000000.000000", reason: "Setoran modal", createdAt: new Date("2026-09-04T03:00:00Z"), currencyCode: "IDR" };
    const chain = (rows: unknown[]): any => ({
      from: () => chain(rows), innerJoin: () => chain(rows), where: () => chain(rows),
      orderBy: () => chain(rows), limit: () => Promise.resolve(rows),
      then: (ok: any, err: any) => Promise.resolve(rows).then(ok, err),
    });
    const fakeDb = {
      select: vi.fn((fields: Record<string, unknown>) => {
        if ("sourceReference" in fields) return chain([{ sourceReference: "KAS-11" }]); // sudah pernah dijurnal
        if (Object.keys(fields).length === 1) return chain([{ id: 11 }]);              // mutasi paling awal
        return chain([movement]);
      }),
    };
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
    const post = vi.spyOn(ledgerOperations, "postJournalEntry");

    const outcome = await postCashMovements({ from: new Date("2026-09-01"), to: new Date("2026-09-30") }, { id: 1 });

    expect(outcome.alreadyPosted).toEqual(["KAS-11"]);
    expect(outcome.posted).toEqual([]);
    expect(post).not.toHaveBeenCalled();
    getDb.mockRestore();
    post.mockRestore();
  });
});
```

Tambahkan `vi` ke impor `vitest` di berkas itu. Bila `postJournalEntry` tidak dapat dimata-matai karena dipanggil sebagai binding langsung, ubah asersi terakhir menjadi memeriksa bahwa tidak ada `insert` yang terjadi — **jangan** menghapus asersinya.

- [ ] **Step 7: Jalankan seluruh uji dan tipe**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit
```
Harapan: LULUS. Bila ada uji lain yang mengandalkan bentuk `summary` lama, perbarui uji itu — bidang lama (`transactions`, `expenses`) sengaja dipertahankan agar tidak pecah.

- [ ] **Step 8: Commit**

```bash
git add server/ledgerPosting.ts server/journalMapping.test.ts server/cashJournalMapping.test.ts
git commit -m "Jurnalkan mutasi kas dan bank, dan ganti penjaga uji yang sudah usang"
```

---

### Task 7: Tab "Modal & Bank" pada Kendali Stok

**Files:**
- Modify: `client/src/pages/StockControl.tsx` (tambah panel dan tab; ikuti bentuk `PenyesuaianPanel` di `:298`)

**Interfaces:**
- Consumes: `trpc.cash.recordCapitalMovement` (tugas 4), `trpc.cash.recordBankTransfer` (tugas 5), `trpc.cash.balances`, `trpc.bankAccounts.list`.
- Produces: tab `"modal-bank"` pada `initialTab()` dan daftar tab.

- [ ] **Step 1: Tambahkan nilai tab baru**

Di `client/src/pages/StockControl.tsx:21`, perluas tipe kembalian `initialTab()` menjadi `"kas-awal" | "saat-ini" | "opname" | "penyesuaian" | "modal-bank"`, dan tambahkan `TabsTrigger` berlabel **"Modal & Bank"** pada daftar tab di `StockControl()`.

- [ ] **Step 2: Tulis panelnya**

Tambahkan komponen `ModalBankPanel` mengikuti bentuk `PenyesuaianPanel` (`:298`) — gunakan `emptyRow`, `addRow`, `updateRow`, `removeRow` yang sudah ada di berkas itu. Panel berisi dua kartu:

**Kartu "Setoran & Penarikan Modal"** — pilihan mata uang (kunci ke IDR, karena server menolak selainnya, dengan teks penjelas), pilihan arah (`IN` = "Setoran modal pemilik", `OUT` = "Penarikan pemilik (prive/dividen)"), nominal, catatan minimal 5 karakter, dan tabel rincian pecahan. Tombol kirim memanggil:

```tsx
  const capital = trpc.cash.recordCapitalMovement.useMutation({
    onSuccess: () => { toast.success("Pergerakan modal tercatat. Jurnalkan lewat Buku Besar untuk memasukkannya ke laporan."); resetForm(); refreshAll(); },
    onError: (error) => toast.error(error.message),
  });
```

**Kartu "Pindah Kas ↔ Bank"** — pilihan rekening dari `trpc.bankAccounts.list`, arah (`TO_BANK` = "Setor kas ke rekening", `TO_CASH` = "Tarik dari rekening ke kas"), nominal, catatan, dan rincian pecahan. Tombol kirim memanggil `trpc.cash.recordBankTransfer.useMutation` dengan pola `onSuccess`/`onError` yang sama.

Kedua kartu wajib memiliki state loading (tombol `disabled={mutation.isPending}`), state kosong (bila belum ada rekening bank: "Belum ada rekening bank. Tambahkan lebih dulu di tab Rekening Bank."), dan menampilkan galat lewat `toast.error`.

- [ ] **Step 3: Sembunyikan dari peran di bawah CONTROLLER**

Panel hanya dirender bila peran pengguna `CONTROLLER` atau `SHAREHOLDER`, mengikuti cara panel lain di berkas ini membaca peran. **Ini hanya kenyamanan tampilan** — otorisasi sebenarnya sudah ditegakkan `controllerProcedure` di tugas 4 dan 5.

- [ ] **Step 4: Pastikan tipe dan build bersih**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
```

- [ ] **Step 5: Verifikasi visual**

Server pengembangan sudah berjalan di http://localhost:3003 dan sesi peramban sudah login sebagai Development Shareholder — pakai itu, jangan menyalakan yang baru. Buka `/operasional/stock`, pilih tab **Modal & Bank**, dan ambil tangkapan layar kedua kartu. **Jangan mengirim formulirnya** — menulis data kas memerlukan izin pengguna pada giliran itu juga.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/StockControl.tsx
git commit -m "Tab Modal & Bank untuk setoran modal dan pemindahan kas ke rekening"
```

---

### Task 8: Panel rekonsiliasi kas pada Buku Besar

Karena `SAFE_DEPOSIT` mengurangi `cash_balances.availableAmount` tetapi sengaja tidak mengurangi buku besar, kedua angka berbeda sebesar isi brankas. Selisih yang tidak terlihat persis melahirkan kembali temuan pemeriksaan 7.2/7.3.

**Files:**
- Modify: `client/src/pages/BukuBesar.tsx`, `server/ledgerOperations.ts` (query ringkasan), `server/routers.ts` (router `ledger`)

**Interfaces:**
- Consumes: `trialBalance`/pembacaan saldo akun yang sudah ada di `server/ledgerOperations.ts`; `cashBalances`.
- Produces: `getCashReconciliation(input: { asOf: Date }): Promise<{ ledgerCashIdr: string; operationalCashIdr: string; safeBalanceIdr: string; difference: string; reconciled: boolean }>`; prosedur tRPC `ledger.cashReconciliation`.

- [ ] **Step 1: Tulis uji yang gagal**

Tambahkan ke `server/ledger.test.ts`:

```ts
describe("rekonsiliasi kas buku besar terhadap kas operasional", () => {
  it("menyatakan cocok ketika selisihnya persis sebesar isi brankas", () => {
    // 1-1110 pada buku besar memuat seluruh kas milik sendiri; cash_balances hanya memuat laci.
    // Selisih keduanya karena itu harus sama dengan akumulasi SAFE_DEPOSIT dikurangi SAFE_WITHDRAWAL.
    expect(reconcileCash({ ledgerCashIdr: "150000000.00", operationalCashIdr: "100000000.00", safeBalanceIdr: "50000000.00" }))
      .toEqual({ difference: "0.00", reconciled: true });
  });

  it("menunjukkan selisih yang tidak dapat dijelaskan brankas", () => {
    expect(reconcileCash({ ledgerCashIdr: "150000000.00", operationalCashIdr: "100000000.00", safeBalanceIdr: "40000000.00" }))
      .toEqual({ difference: "10000000.00", reconciled: false });
  });
});
```

Tambahkan fungsi murni ke `shared/ledger.ts` agar dapat diuji tanpa basis data:

```ts
/** Selisih yang tersisa setelah isi brankas diperhitungkan; nol berarti buku besar dan kas operasional cocok. */
export function reconcileCash(input: { ledgerCashIdr: string; operationalCashIdr: string; safeBalanceIdr: string }) {
  const difference = parseAmount(input.ledgerCashIdr) - parseAmount(input.operationalCashIdr) - parseAmount(input.safeBalanceIdr);
  return { difference: formatAmount(difference), reconciled: difference === 0n };
}
```

- [ ] **Step 2: Jalankan uji, pastikan gagal, lalu lulus**

```bash
./node_modules/.bin/vitest run server/ledger.test.ts
```
Harapan: GAGAL sebelum fungsi ditambahkan, LULUS sesudahnya.

- [ ] **Step 3: Tambahkan `getCashReconciliation` di `server/ledgerOperations.ts`**

```ts
/**
 * Selisih buku besar terhadap kas operasional, dan penjelasannya.
 *
 * 1-1110 memuat seluruh kas Rupiah milik sendiri, sementara `cash_balances.availableAmount` hanya
 * memuat laci — perpindahan ke brankas sengaja tidak dijurnal karena B0002 hanya punya satu baris
 * kas. Selisih keduanya karena itu harus persis sebesar isi brankas. Ditampilkan supaya selisihnya
 * dapat **ditunjukkan**, bukan sekadar ada.
 */
export async function getCashReconciliation(input: { asOf: Date }) {
  const db = await databaseOrThrow();
  const upperBound = new Date(`${isoDay(input.asOf)}T23:59:59`);

  const ledgerRows = await db
    .select({ side: journalEntryLines.side, amount: journalEntryLines.amount })
    .from(journalEntryLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalEntryLines.entryId))
    .where(and(eq(journalEntryLines.accountCode, CASH_ACCOUNT), lte(journalEntries.entryDate, dbDate(input.asOf))));
  let ledgerCents = 0n;
  for (const row of ledgerRows) ledgerCents += row.side === "DEBIT" ? parseAmount(String(row.amount)) : -parseAmount(String(row.amount));

  const balanceRow = (await db
    .select({ id: cashBalances.id, availableAmount: cashBalances.availableAmount })
    .from(cashBalances)
    .innerJoin(currencies, eq(currencies.id, cashBalances.currencyId))
    .where(eq(currencies.code, "IDR"))
    .limit(1))[0];
  const operationalCents = balanceRow ? parseAmount(new Decimal(String(balanceRow.availableAmount)).toFixed(2)) : 0n;

  let safeCents = 0n;
  if (balanceRow) {
    const safeRows = await db
      .select({ category: cashBalanceMovements.category, amount: cashBalanceMovements.amount })
      .from(cashBalanceMovements)
      .where(and(
        eq(cashBalanceMovements.cashBalanceId, balanceRow.id),
        inArray(cashBalanceMovements.category, ["SAFE_DEPOSIT", "SAFE_WITHDRAWAL"]),
        lte(cashBalanceMovements.createdAt, upperBound),
      ));
    for (const row of safeRows) {
      const cents = parseAmount(new Decimal(String(row.amount)).toFixed(2));
      safeCents += row.category === "SAFE_DEPOSIT" ? cents : -cents;
    }
  }

  const ledgerCashIdr = formatAmount(ledgerCents);
  const operationalCashIdr = formatAmount(operationalCents);
  const safeBalanceIdr = formatAmount(safeCents);
  return { ledgerCashIdr, operationalCashIdr, safeBalanceIdr, ...reconcileCash({ ledgerCashIdr, operationalCashIdr, safeBalanceIdr }) };
}
```

Sesuaikan nama kolom `journalEntryLines` (`entryId`, `accountCode`, `side`, `amount`) dengan yang benar-benar ada di `drizzle/schema.ts` sebelum menulis — periksa, jangan menebak. Tambahkan `CASH_ACCOUNT`, `reconcileCash`, `parseAmount`, `formatAmount`, dan `inArray` ke impor berkas ini.

- [ ] **Step 4: Ekspos lewat tRPC**

Tambahkan di router `ledger` (`server/routers.ts:508`):

```ts
    cashReconciliation: staffProcedure.input(z.object({ asOf: z.date() })).query(({ input }) => getCashReconciliation(input)),
```

- [ ] **Step 5: Tampilkan pada tab Laporan Keuangan di `BukuBesar.tsx`**

Panel menampilkan empat angka berlabel jelas — Kas Rupiah (buku besar), Kas operasional, Saldo brankas, Selisih — dan satu kalimat penjelas ketika `reconciled` bernilai benar: "Selisih kas buku besar terhadap kas operasional seluruhnya dijelaskan oleh saldo brankas." Ketika bernilai salah, tampilkan peringatan bahwa ada selisih yang belum dapat dijelaskan. Sertakan loading dan error state.

- [ ] **Step 6: Pastikan tipe, uji, dan build bersih**

```bash
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
```

- [ ] **Step 7: Verifikasi visual**

Buka `/operasional/buku-besar`, tab Laporan Keuangan, ambil tangkapan layar panel rekonsiliasi.

- [ ] **Step 8: Commit**

```bash
git add shared/ledger.ts server/ledger.test.ts server/ledgerOperations.ts server/routers.ts client/src/pages/BukuBesar.tsx
git commit -m "Panel rekonsiliasi kas: tunjukkan selisih buku besar terhadap kas operasional"
```

---

### Task 9: Skenario operasional utuh dan pembaruan dokumentasi

**Files:**
- Test: `server/cashLedgerScenario.test.ts` (baru)
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md`, `docs/HANDOFF-OPUS.md`

**Interfaces:**
- Consumes: seluruh keluaran tugas 2–6.
- Produces: —

- [ ] **Step 1: Tulis uji skenario**

Buat `server/cashLedgerScenario.test.ts`. Uji ini murni atas pemetaan — ia merangkai satu hari operasional dan memastikan buku besarnya masuk akal, tanpa menyentuh basis data:

```ts
import { describe, expect, it } from "vitest";
import { isSkipped, mapCashMovement, mapExchangeTransaction, type MappingResult } from "../shared/journalMapping";
import { formatAmount, parseAmount } from "../shared/ledger";

/** Saldo satu akun dari serangkaian hasil pemetaan. */
function balanceOf(code: string, results: MappingResult[]) {
  let cents = 0n;
  for (const result of results) {
    if (isSkipped(result)) continue;
    for (const line of result.lines) {
      if (line.accountCode !== code) continue;
      cents += line.side === "DEBIT" ? parseAmount(line.amount) : -parseAmount(line.amount);
    }
  }
  return formatAmount(cents);
}

describe("satu hari operasional: setor modal, kas awal, beli, jual", () => {
  it("meninggalkan Kas Rupiah positif dan sama dengan uang yang benar-benar ada", () => {
    // Urutan yang benar: modal masuk lebih dulu, baru hitungan kas pagi — sehingga selisih
    // pembukaannya nol dan tidak ada uang yang muncul tanpa asal.
    const results = [
      mapCashMovement({ category: "CAPITAL_INJECTION", amount: "500000000.000000", currencyCode: "IDR", reason: "Setoran modal awal", isFirstMovementForCurrency: false }),
      mapCashMovement({ category: "OPENING", amount: "0.000000", currencyCode: "IDR", reason: "Kas awal", isFirstMovementForCurrency: false }),
      mapExchangeTransaction({ operation: "BUY", paymentMethod: "CASH", rupiahAmount: "150000000.00", transactionNumber: "FX-1" }),
      mapExchangeTransaction({ operation: "SELL", paymentMethod: "CASH", rupiahAmount: "160000000.00", transactionNumber: "FX-2" }),
    ];
    // 500.000.000 − 150.000.000 + 160.000.000
    expect(balanceOf("1-1110", results)).toBe("510000000.00");
    expect(balanceOf("3-1100", results)).toBe("-500000000.00"); // kredit, saldo normal ekuitas
  });

  it("membuat Kas Rupiah negatif bila modalnya tidak pernah dicatat — inilah gejala yang diperbaiki paket ini", () => {
    const tanpaModal = [
      mapExchangeTransaction({ operation: "BUY", paymentMethod: "CASH", rupiahAmount: "150000000.00", transactionNumber: "FX-1" }),
    ];
    expect(balanceOf("1-1110", tanpaModal)).toBe("-150000000.00");
  });

  it("tidak menghitung uang bon dua kali ketika mutasi kas bon ikut diproses", () => {
    const results = [
      mapExchangeTransaction({ operation: "BUY", paymentMethod: "CASH", rupiahAmount: "150000000.00", transactionNumber: "FX-1" }),
      mapCashMovement({ category: "TRANSACTION", amount: "150000000.000000", currencyCode: "IDR", reason: "TRANSACTION_BUY_FX-1_IDR", isFirstMovementForCurrency: false }),
    ];
    expect(balanceOf("1-1110", results)).toBe("-150000000.00");
  });
});
```

- [ ] **Step 2: Jalankan dan pastikan lulus**

```bash
./node_modules/.bin/vitest run server/cashLedgerScenario.test.ts
```

- [ ] **Step 3: Perbarui panduan A–Z**

Di `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, tambahkan bagian **"Modal dan pemindahan kas ke bank"** pada bab kas/stok. Wajib memuat urutan yang benar dan alasannya: **catat setoran modal lebih dulu, baru hitungan kas pagi** — kalau dibalik, kas awal pertama tidak akan dijurnal dan buku besar akan memberi tahu alasannya. Sebutkan pula bahwa penarikan pemilik masuk sebagai Prive/Dividen, bukan pengurangan Modal Disetor.

- [ ] **Step 4: Perbarui skema database**

Di `docs/SKEMA-DATABASE-PROJECT.md`, perbarui daftar nilai `category` pada `cash_balance_movements` dan `bank_account_movements`, dengan satu kalimat per kategori baru tentang bagaimana ia dijurnal.

- [ ] **Step 5: Perbarui handoff**

Di `docs/HANDOFF-OPUS.md`, pindahkan butir 1 "Yang harus dikerjakan berikutnya" ke bagian selesai, dan catat paket B dan C sebagai prioritas berikutnya beserta rujukan ke spec-nya.

- [ ] **Step 6: Jalankan seluruh gerbang mutu**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```
Harapan: seluruhnya bersih. Laporkan jumlah uji sebenarnya — jangan menyebut angka yang tidak dilihat.

- [ ] **Step 7: Commit**

```bash
git add server/cashLedgerScenario.test.ts docs/
git commit -m "Uji skenario satu hari operasional dan perbarui dokumentasi kas"
```

---

## Catatan bagi pelaksana

- **Jangan** mengubah `jakartaBusinessDate`, menyentuh `OFF_HOURS_SALE`, atau menambah akun ke `shared/chartOfAccounts.ts`. Ketiganya di luar paket ini dan tercatat alasannya di spec.
- Bila sebuah kategori ternyata tidak dapat dipetakan tanpa menebak, kembalikan `skipped` beserta alasan yang dapat dibaca manusia. **Jangan** memilih akun yang kira-kira cocok — buku besar yang salah dengan percaya diri lebih buruk daripada tidak ada buku besar.
- Nominal uang tidak pernah dibulatkan diam-diam. Bila presisinya tidak muat, lewati dan katakan mengapa.
- Setiap tugas berakhir dengan commit yang berdiri sendiri. Bila sebuah tugas membengkak melebihi berkas yang disebutkan, berhenti dan laporkan sebelum melanjutkan.
