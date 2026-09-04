# Paket C — Penilaian kas UKA dan penutupan periode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat akun 1-1210 Kas UKA dan 5-1300 Persediaan Akhir UKA & TC berhenti nol, dengan menilai persediaan valuta akhir periode dari hasil stock opname pada kurs tengah BI, lalu menjadikan penilaian itu syarat menutup periode.

**Architecture:** Tabel penilaian per mata uang per periode plus empat kolom penanda pada `accounting_periods` (migrasi aditif `0047`); dua fungsi murni di `shared/` — penilaian kurs tengah dan pemetaan jurnal — yang dapat diuji tanpa basis data; satu berkas server baru `server/periodClosing.ts` berisi pembacaan bukti, penulisan penilaian, dan dua fungsi posting yang idempoten lewat kunci `(sourceType, sourceReference)` yang sudah ada; gerbang baru pada `closeAccountingPeriod`; neraca beralih ke laba sejak penutupan tahunan terakhir; tiga prosedur tRPC dan satu panel pada tab Periode.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, decimal.js, Zod.

**Spec:** `docs/superpowers/specs/2026-09-04-penilaian-kas-uka-tutup-periode-design.md`

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu**, supaya sesi
berikutnya tahu harus mulai dari mana tanpa membaca seluruh riwayat.

- [x] Tugas 1 — Migrasi penilaian penutupan periode (0047)
- [x] Tugas 2 — Penilaian kurs tengah murni di `shared/`
- [x] Tugas 3 — Pemetaan jurnal penutupan dan penutup laba
- [x] Tugas 4 — `buildPeriodValuation`: bukti kuantitas dan kurs
- [x] Tugas 5 — `postPeriodClosing`: tulis penilaian dan jurnalnya
- [x] Tugas 6 — Penutup laba tahunan dan gerbang `closeAccountingPeriod`
- [x] Tugas 7 — Neraca memakai laba sejak penutupan tahunan terakhir
- [ ] Tugas 8 — Tiga prosedur tRPC
- [ ] Tugas 9 — Panel Penutupan Periode
- [ ] Tugas 10 — Skenario menyeluruh dan dokumentasi

Urutannya mengikat: 1 sebelum 4–6; 2 dan 3 sebelum 5; 5 sebelum 6; 8 sebelum 9. Tugas 7 berdiri
sendiri dan boleh dikerjakan kapan saja setelah 6. Tugas 10 terakhir.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Muat variabel lingkungan lebih dulu:
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Perintah mutu wajib sebelum tugas dianggap selesai: `./node_modules/.bin/vitest run`,
  `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vite build`.
- **Baseline sebelum paket ini, benar-benar dijalankan 4 September 2026:** `Test Files 81 passed (81)`,
  `Tests 551 passed | 2 skipped (553)`. Tugas yang menambah uji akan menaikkan angkanya — sebutkan
  angka yang benar-benar dilihat, jangan mengarang.
- `node scripts/tenant.mjs migrate-all` mencakup `moneychanger` dan `mc_t_abcvalas` lewat
  `TENANT_REGISTRY` di `.env`, dan gagal berisik bila kosong. **Jangan** menjalankan berkas `.sql`
  langsung lewat klien mysql — penanda `--> statement-breakpoint` membuat pernyataan kedua gagal.
- Jangan menerapkan migrasi ke produksi. Hanya dua basis data lokal.
- Membuat data uji di basis data lokal memerlukan izin pengguna **pada giliran itu juga**. Seluruh uji
  dalam rencana ini adalah uji Vitest atas fungsi dengan `getDb` dipalsukan, atau uji `appRouter`
  dengan modul operasinya di-mock — tidak menyentuh data nyata.
- Skrip pembersih uji tidak boleh menghapus `audit_logs`.
- Peran `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Otorisasi ditegakkan di tRPC/server.
- Uang pada baris jurnal tepat dua desimal (`AMOUNT_PATTERN`, `shared/ledger.ts:18`). `quantity` dan
  kurs berskala enam desimal; `midRatePerUnit` dua belas. Pembulatan **hanya** boleh terjadi pada
  `rupiahValue` hasil penilaian, dan itu diputuskan eksplisit di spec bagian 7.
- **IDR tidak pernah ikut dinilai.** Setiap kueri mata uang dalam paket ini menyaring `code <> 'IDR'`.
- Jangan menambah akun ke `shared/chartOfAccounts.ts`. Jangan menjurnal ke 7-1500.
- Jangan menyentuh `jakartaBusinessDate`, `submitStockOpname`, atau `getOpnameSystemCounts` selain
  membacanya.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `drizzle/schema.ts` | Tabel `periodClosingValuations`, empat kolom `accountingPeriods` | 1 |
| `drizzle/0047_*.sql` | Migrasi aditif hasil generate | 1 |
| `shared/inventoryValuation.ts` | `midClosingRate`, `valueForeignInventory` — murni | 2 |
| `shared/inventoryValuation.test.ts` | Uji kurs tengah, `quoteUnit`, pembulatan | 2 |
| `shared/journalMapping.ts` | `mapPeriodInventoryClosing`, `mapYearEndProfitClosing` | 3 |
| `server/periodClosingMapping.test.ts` | Uji tabel penuh atas kedua pemetaan | 3 |
| `server/periodClosing.ts` | `buildPeriodValuation`, `postPeriodClosing`, `postYearEndProfitClosing` | 4, 5, 6 |
| `server/periodValuation.test.ts` | Uji `buildPeriodValuation` dengan `getDb` dipalsukan | 4 |
| `server/periodClosingPosting.test.ts` | Uji `postPeriodClosing` dan idempotensinya | 5 |
| `server/ledgerOperations.ts` | Gerbang pada `closeAccountingPeriod` | 6 |
| `server/periodCloseGate.test.ts` | Uji penolakan penutupan tanpa penilaian | 6 |
| `server/financialStatements.ts` | Laba sejak penutupan tahunan terakhir | 7 |
| `server/financialStatements.test.ts` | Uji tambahan; berkas sudah ada | 7 |
| `server/routers.ts` | Tiga prosedur pada router `ledger` | 8 |
| `server/periodClosing.authorization.test.ts` | Uji otorisasi ketiga prosedur | 8 |
| `client/src/pages/BukuBesar.tsx` | Panel Penutupan Periode pada tab Periode | 9 |
| `server/periodClosingScenario.test.ts` | Skenario dua periode berurutan | 10 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku pengguna dan struktur data yang berubah | 10 |

---

### Task 1: Migrasi penilaian penutupan periode (0047)

**Files:**
- Modify: `drizzle/schema.ts` (`accountingPeriods`, ~baris 1136; tabel baru di bawahnya)
- Create: `drizzle/0047_*.sql` (hasil generate, akhiran acak dari Drizzle)

**Interfaces:**
- Consumes: —
- Produces: tabel `period_closing_valuations`, kolom `accountingPeriods.valuationPostedAt`,
  `valuationJournalEntryId`, `profitClosingPostedAt`, `profitClosingJournalEntryId`. Dipakai tugas 4–9.

- [x] **Step 1: Tambah empat kolom pada `accountingPeriods`**

Di `drizzle/schema.ts`, sisipkan sebelum `createdByUserId` pada `accountingPeriods`:

```ts
  /**
   * Penanda bahwa penilaian persediaan akhir UKA sudah dijalankan untuk periode ini.
   *
   * Ditaruh sebagai kolom, bukan disimpulkan dari ada-tidaknya baris `period_closing_valuations`:
   * outlet yang belum memegang UKA menghasilkan nol baris penilaian, dan itu keadaan sah yang tetap
   * harus bisa ditutup. Menghitung baris akan mencampur "belum dinilai" dengan "sudah dinilai,
   * hasilnya memang kosong".
   */
  valuationPostedAt: datetime("valuationPostedAt"),
  valuationJournalEntryId: int("valuationJournalEntryId"),
  /** Penanda jurnal penutup laba ke 3-2100; hanya periode yang berakhir 31 Desember mengisinya. */
  profitClosingPostedAt: datetime("profitClosingPostedAt"),
  profitClosingJournalEntryId: int("profitClosingJournalEntryId"),
```

- [x] **Step 2: Tambah tabel `periodClosingValuations`**

Tepat di bawah `accountingPeriods`:

```ts
/**
 * Penilaian persediaan valuta akhir periode, satu baris per mata uang per periode.
 *
 * Setiap angka penilaian dapat diturunkan ulang dari barisnya sendiri — kuantitas beserta opname
 * yang membuktikannya, kurs beserta snapshot dan tanggal yang benar-benar dipakai. Itulah jawaban
 * atas temuan 7.1 pada tingkat baris: pos "Kas UKA" pada neraca bukan angka yang muncul entah dari
 * mana, melainkan hitungan fisik dikali kurs BI yang dapat ditunjuk.
 *
 * `opnameDate` dan `rateReferenceDate` disimpan meski sudah dapat dijangkau lewat id-nya, karena
 * keduanya boleh berbeda dari akhir periode — opname hanya terjadi saat outlet buka, dan BI tidak
 * mengumumkan kurs pada hari libur. Perbedaan itu harus terbaca tanpa menelusuri tabel lain.
 */
export const periodClosingValuations = mysqlTable("period_closing_valuations", {
  id: int("id").autoincrement().primaryKey(),
  periodId: int("periodId").notNull(),
  currencyId: int("currencyId").notNull(),
  /** Kuantitas valuta hasil hitung fisik: laci + brankas, dari `stock_opnames.physicalBalance`. */
  quantity: decimal("quantity", { precision: 24, scale: 6 }).notNull(),
  stockOpnameId: int("stockOpnameId").notNull(),
  opnameDate: date("opnameDate").notNull(),
  rateSnapshotId: int("rateSnapshotId").notNull(),
  rateReferenceDate: date("rateReferenceDate").notNull(),
  buyRate: decimal("buyRate", { precision: 24, scale: 6 }).notNull(),
  sellRate: decimal("sellRate", { precision: 24, scale: 6 }).notNull(),
  /** BI mengutip JPY per 100 unit; mengabaikan kolom ini membuat nilainya meleset seratus kali. */
  quoteUnit: decimal("quoteUnit", { precision: 18, scale: 6 }).notNull(),
  /** Kurs tengah per satu unit valuta: (buyRate + sellRate) / 2 / quoteUnit. */
  midRatePerUnit: decimal("midRatePerUnit", { precision: 24, scale: 12 }).notNull(),
  /** quantity × midRatePerUnit, dibulatkan setengah-ke-atas ke sen — lihat spec bagian 7. */
  rupiahValue: decimal("rupiahValue", { precision: 24, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("period_closing_valuations_period_currency_uq").on(table.periodId, table.currencyId),
  index("period_closing_valuations_period_idx").on(table.periodId),
]);

export type PeriodClosingValuation = typeof periodClosingValuations.$inferSelect;
```

- [x] **Step 3: Hasilkan migrasi**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
./node_modules/.bin/drizzle-kit generate
```

- [x] **Step 4: Baca SQL yang dihasilkan sebelum menerapkannya**

```bash
cat drizzle/0047_*.sql
```

Harapan: satu `CREATE TABLE period_closing_valuations`, satu atau empat `ALTER TABLE accounting_periods ADD ...`, dan dua `CREATE INDEX`/`UNIQUE`. **Bila ada `DROP`, `TRUNCATE`, `MODIFY COLUMN`, atau perubahan pada tabel selain kedua itu, berhenti dan laporkan** — migrasi ini harus murni aditif.

- [x] **Step 5: Terapkan ke dua basis data lokal**

```bash
node scripts/tenant.mjs migrate-all
```
Harapan: kedua tenant (`moneychanger`, `mc_t_abcvalas`) melaporkan migrasi diterapkan.

- [x] **Step 6: Pastikan tipe dan uji masih bersih**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```
Harapan: tanpa galat; jumlah uji masih 551 lulus, 2 dilewati.

- [x] **Step 7: Commit**

```bash
git add drizzle/schema.ts drizzle/0047_*.sql drizzle/meta
git commit -m "Tempat menyimpan penilaian persediaan akhir UKA (migrasi 0047)"
```

---

### Task 2: Penilaian kurs tengah murni di `shared/`

Fungsi murni tanpa basis data, sehingga dapat diuji sungguhan dan dipakai layar untuk menunjukkan
angka yang **sama persis** dengan yang akan dijurnal server.

**Files:**
- Create: `shared/inventoryValuation.ts`
- Test: `shared/inventoryValuation.test.ts`

**Interfaces:**
- Consumes: `decimal.js` (sudah dipakai `shared/denominationVariance.ts`).
- Produces:
  - `type ClosingRateSnapshot = { buyRate: string; sellRate: string; quoteUnit: string }`
  - `midClosingRate(snapshot: ClosingRateSnapshot): string` — Rupiah per satu unit, 12 desimal
  - `valueForeignInventory(input: ClosingRateSnapshot & { quantity: string }): { midRatePerUnit: string; rupiahValue: string }`
  - Dipakai tugas 4, 5, dan 9.

- [x] **Step 1: Tulis uji yang gagal**

Buat `shared/inventoryValuation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { midClosingRate, valueForeignInventory } from "./inventoryValuation";

const usd = { buyRate: "16200.000000", sellRate: "16400.000000", quoteUnit: "1.000000" };
/** BI mengutip JPY per 100 unit — kolom quoteUnit ada persis untuk ini. */
const jpy = { buyRate: "10800.000000", sellRate: "11000.000000", quoteUnit: "100.000000" };

describe("kurs tengah penutup", () => {
  it("mengambil titik tengah kurs beli dan jual BI", () => {
    expect(midClosingRate(usd)).toBe("16300.000000000000");
  });

  it("membagi dengan quoteUnit, sehingga JPY tidak meleset seratus kali", () => {
    expect(midClosingRate(jpy)).toBe("109.000000000000");
  });

  it("menolak quoteUnit nol atau negatif alih-alih menghasilkan tak hingga", () => {
    expect(() => midClosingRate({ ...usd, quoteUnit: "0.000000" })).toThrow(/quoteUnit/i);
    expect(() => midClosingRate({ ...usd, quoteUnit: "-1.000000" })).toThrow(/quoteUnit/i);
  });

  it("menolak kurs yang bukan angka", () => {
    expect(() => midClosingRate({ ...usd, buyRate: "" })).toThrow(/kurs/i);
  });
});

describe("penilaian persediaan valuta", () => {
  it("mengalikan kuantitas fisik dengan kurs tengah", () => {
    expect(valueForeignInventory({ ...usd, quantity: "12500.000000" })).toEqual({
      midRatePerUnit: "16300.000000000000",
      rupiahValue: "203750000.00",
    });
  });

  it("menghormati quoteUnit pada nilai akhirnya", () => {
    expect(valueForeignInventory({ ...jpy, quantity: "50000.000000" }).rupiahValue).toBe("5450000.00");
  });

  it("membulatkan setengah-ke-atas ke sen — pengukuran baru, bukan konversi uang tercatat", () => {
    // Keputusan spec bagian 7: menolak membulatkan di sini akan menggagalkan hampir setiap
    // penutupan periode, karena kuantitas dikali kurs hampir tidak pernah jatuh pas di sen.
    const result = valueForeignInventory({ buyRate: "16200.005000", sellRate: "16200.010000", quoteUnit: "1.000000", quantity: "1.000000" });
    expect(result.rupiahValue).toBe("16200.01");
  });

  it("menilai persediaan kosong sebagai nol, bukan galat", () => {
    expect(valueForeignInventory({ ...usd, quantity: "0.000000" }).rupiahValue).toBe("0.00");
  });

  it("menolak kuantitas negatif — hitungan fisik tidak pernah negatif", () => {
    expect(() => valueForeignInventory({ ...usd, quantity: "-1.000000" })).toThrow(/kuantitas/i);
  });
});
```

- [x] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run shared/inventoryValuation.test.ts
```
Harapan: GAGAL — berkas `shared/inventoryValuation.ts` belum ada.

- [x] **Step 3: Tulis implementasi**

Buat `shared/inventoryValuation.ts`:

```ts
/**
 * Penilaian persediaan valuta pada kurs penutup.
 *
 * Ditaruh di `shared/` supaya panel penutupan menampilkan angka yang **sama persis** dengan yang
 * dijurnal server — nilai persediaan yang berbeda antara layar dan buku besar adalah pertanyaan
 * pertama yang akan diajukan pemeriksa.
 *
 * Fungsi murni: tanpa basis data, tanpa tanggal, tanpa pemilihan snapshot. Yang memilih snapshot
 * mana yang dipakai adalah `server/periodClosing.ts`; di sini hanya aritmetikanya.
 */

import Decimal from "decimal.js";

export type ClosingRateSnapshot = { buyRate: string; sellRate: string; quoteUnit: string };

/** Kurs tengah disimpan lebih rinci daripada kurs sumbernya supaya nilainya dapat dihitung ulang. */
export const MID_RATE_SCALE = 12;

const decimalOrThrow = (raw: string, label: string) => {
  const value = new Decimal(raw);
  if (!value.isFinite()) throw new Error(`${label} bukan angka yang sah.`);
  return value;
};

/**
 * Kurs tengah BI per **satu** unit valuta.
 *
 * Keputusan pengguna 4 September 2026: (beli + jual) / 2, bukan kurs beli maupun kurs jual.
 * Pembagian dengan `quoteUnit` tidak boleh dilewati — BI mengutip JPY per 100 unit, dan mengabaikan
 * kolom itu membuat nilai persediaan JPY meleset seratus kali.
 */
export function midClosingRate(snapshot: ClosingRateSnapshot): string {
  const buy = decimalOrThrow(snapshot.buyRate, "Kurs beli");
  const sell = decimalOrThrow(snapshot.sellRate, "Kurs jual");
  const unit = decimalOrThrow(snapshot.quoteUnit, "quoteUnit");
  if (unit.lte(0)) throw new Error("quoteUnit harus lebih besar dari nol.");
  return buy.plus(sell).div(2).div(unit).toFixed(MID_RATE_SCALE);
}

/**
 * Nilai Rupiah persediaan valuta.
 *
 * Pembulatan setengah-ke-atas ke sen disengaja dan tercatat pada spec bagian 7: aturan "menolak
 * membulatkan uang" mengenai konversi uang yang **sudah tercatat**, sedangkan ini pengukuran baru —
 * kuantitas dikali kurs, yang hampir tidak pernah jatuh pas di sen. Selisihnya melebur ke harga
 * pokok.
 */
export function valueForeignInventory(
  input: ClosingRateSnapshot & { quantity: string },
): { midRatePerUnit: string; rupiahValue: string } {
  const quantity = decimalOrThrow(input.quantity, "Kuantitas persediaan");
  if (quantity.lt(0)) throw new Error("Kuantitas persediaan tidak boleh negatif.");
  const midRatePerUnit = midClosingRate(input);
  return {
    midRatePerUnit,
    rupiahValue: quantity.times(midRatePerUnit).toFixed(2, Decimal.ROUND_HALF_UP),
  };
}
```

- [x] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run shared/inventoryValuation.test.ts
./node_modules/.bin/tsc --noEmit
```
Harapan: seluruh uji lulus, tanpa galat tipe.

- [x] **Step 5: Commit**

```bash
git add shared/inventoryValuation.ts shared/inventoryValuation.test.ts
git commit -m "Penilaian persediaan valuta pada kurs tengah BI"
```

---

### Task 3: Pemetaan jurnal penutupan dan penutup laba

Pemetaan murni. Inilah yang menentukan setiap angka penutupan pada laporan keuangan.

**Files:**
- Modify: `shared/journalMapping.ts` (tambah di akhir berkas)
- Test: `server/periodClosingMapping.test.ts` (baru)

**Interfaces:**
- Consumes: `MappedLine`, `MappingResult`, `isSkipped`, `toLedgerAmount` (privat, sudah ada di berkas
  yang sama); `findAccount`, `isBalanceSheetAccount` dari `shared/chartOfAccounts.ts`;
  `formatAmount`, `parseAmount`, `oppositeSide` dari `shared/ledger.ts`.
- Produces:
  - `FX_INVENTORY_ACCOUNT = "1-1210"`, `OPENING_INVENTORY_ACCOUNT = "5-1100"`, `CLOSING_INVENTORY_ACCOUNT = "5-1300"`
  - `mapPeriodInventoryClosing(input: { priorClosingValue: string; closingValue: string; memo: string }): MappingResult`
  - `mapYearEndProfitClosing(input: { balances: { accountCode: string; balance: string }[]; memo: string }): MappingResult`
  - Dipakai tugas 5 dan 6.

- [x] **Step 1: Tulis uji yang gagal**

Buat `server/periodClosingMapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CHART_OF_ACCOUNTS } from "../shared/chartOfAccounts";
import { isSkipped, mapPeriodInventoryClosing, mapYearEndProfitClosing, type MappingResult } from "../shared/journalMapping";
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

describe("pemetaan jurnal penilaian persediaan", () => {
  const memo = "Penutupan periode 2026-09-01 s.d. 2026-09-30";

  it("membalik persediaan akhir periode sebelumnya sekaligus membukukan yang baru, dalam satu jurnal", () => {
    // Keputusan pengguna 2: seluruhnya jatuh di dalam periode yang ditutup, tidak ada jurnal yang
    // ditulis ke periode lain, dan idempotensinya cukup dijaga satu kunci sumber.
    expect(linesOf(mapPeriodInventoryClosing({ priorClosingValue: "180000000.00", closingValue: "203750000.00", memo }))).toEqual([
      { accountCode: "5-1100", side: "DEBIT", amount: "180000000.00", memo },
      { accountCode: "1-1210", side: "KREDIT", amount: "180000000.00", memo },
      { accountCode: "1-1210", side: "DEBIT", amount: "203750000.00", memo },
      { accountCode: "5-1300", side: "KREDIT", amount: "203750000.00", memo },
    ]);
  });

  it("menghilangkan sisi persediaan awal pada periode pertama yang dinilai", () => {
    expect(linesOf(mapPeriodInventoryClosing({ priorClosingValue: "0.00", closingValue: "203750000.00", memo }))).toEqual([
      { accountCode: "1-1210", side: "DEBIT", amount: "203750000.00", memo },
      { accountCode: "5-1300", side: "KREDIT", amount: "203750000.00", memo },
    ]);
  });

  it("menghilangkan sisi persediaan akhir bila seluruh valuta habis terjual", () => {
    expect(linesOf(mapPeriodInventoryClosing({ priorClosingValue: "180000000.00", closingValue: "0.00", memo }))).toEqual([
      { accountCode: "5-1100", side: "DEBIT", amount: "180000000.00", memo },
      { accountCode: "1-1210", side: "KREDIT", amount: "180000000.00", memo },
    ]);
  });

  it("melewati periode yang tidak punya persediaan di kedua sisi", () => {
    expect(reasonOf(mapPeriodInventoryClosing({ priorClosingValue: "0.00", closingValue: "0.00", memo }))).toMatch(/tidak ada persediaan/i);
  });

  it("menolak nilai negatif alih-alih menjurnal persediaan minus", () => {
    expect(reasonOf(mapPeriodInventoryClosing({ priorClosingValue: "0.00", closingValue: "-1.00", memo }))).toMatch(/negatif/i);
  });

  it("selalu seimbang dengan akun yang ada di bagan akun", () => {
    const lines = linesOf(mapPeriodInventoryClosing({ priorClosingValue: "1.23", closingValue: "9876543.21", memo }));
    expect(() => assertJournalIsPostable(lines)).not.toThrow();
    for (const line of lines) expect(knownCodes.has(line.accountCode)).toBe(true);
  });
});

describe("pemetaan jurnal penutup laba tahunan", () => {
  const memo = "Penutup laba tahun buku 2026";

  it("menolkan akun laba rugi dan memindahkan labanya ke laba ditahan", () => {
    const lines = linesOf(mapYearEndProfitClosing({
      memo,
      balances: [
        { accountCode: "4-1100", balance: "500000000.00" },
        { accountCode: "5-1200", balance: "430000000.00" },
        { accountCode: "6-1100", balance: "30000000.00" },
      ],
    }));
    expect(lines).toEqual([
      { accountCode: "4-1100", side: "DEBIT", amount: "500000000.00", memo },
      { accountCode: "5-1200", side: "KREDIT", amount: "430000000.00", memo },
      { accountCode: "6-1100", side: "KREDIT", amount: "30000000.00", memo },
      { accountCode: "3-2100", side: "KREDIT", amount: "40000000.00", memo },
    ]);
  });

  it("mendebit laba ditahan bila tahun itu rugi", () => {
    const lines = linesOf(mapYearEndProfitClosing({
      memo,
      balances: [{ accountCode: "4-1100", balance: "100000000.00" }, { accountCode: "6-1100", balance: "150000000.00" }],
    }));
    expect(lines.at(-1)).toEqual({ accountCode: "3-2100", side: "DEBIT", amount: "50000000.00", memo });
  });

  it("menutup akun lawan pada arah yang benar", () => {
    // 5-1300 bersaldo normal kredit dan mengurangi harga pokok; menutupnya mendebit, dan itu
    // menambah laba — bukan menguranginya.
    const lines = linesOf(mapYearEndProfitClosing({ memo, balances: [{ accountCode: "5-1300", balance: "203750000.00" }] }));
    expect(lines[0]).toEqual({ accountCode: "5-1300", side: "DEBIT", amount: "203750000.00", memo });
    expect(lines.at(-1)).toEqual({ accountCode: "3-2100", side: "KREDIT", amount: "203750000.00", memo });
  });

  it("mengabaikan akun neraca dan akun bersaldo nol", () => {
    const lines = linesOf(mapYearEndProfitClosing({
      memo,
      balances: [
        { accountCode: "1-1110", balance: "900000000.00" },
        { accountCode: "3-1100", balance: "500000000.00" },
        { accountCode: "6-1200", balance: "0.00" },
        { accountCode: "4-1100", balance: "1000000.00" },
      ],
    }));
    expect(lines.map((line) => line.accountCode)).toEqual(["4-1100", "3-2100"]);
  });

  it("melewati tahun yang tidak punya saldo laba rugi sama sekali", () => {
    expect(reasonOf(mapYearEndProfitClosing({ memo, balances: [{ accountCode: "1-1110", balance: "5.00" }] }))).toMatch(/tidak ada saldo/i);
  });

  it("menolak akun yang tidak ada pada bagan akun alih-alih menebaknya", () => {
    expect(reasonOf(mapYearEndProfitClosing({ memo, balances: [{ accountCode: "9-9999", balance: "5.00" }] }))).toMatch(/bagan akun/i);
  });

  it("selalu menghasilkan jurnal seimbang", () => {
    const lines = linesOf(mapYearEndProfitClosing({
      memo,
      balances: [
        { accountCode: "4-1100", balance: "123456789.12" },
        { accountCode: "5-1200", balance: "98765432.10" },
        { accountCode: "5-1300", balance: "1000.55" },
        { accountCode: "7-1200", balance: "250000.33" },
        { accountCode: "8-1100", balance: "1500000.00" },
      ],
    }));
    expect(() => assertJournalIsPostable(lines)).not.toThrow();
    for (const line of lines) expect(knownCodes.has(line.accountCode)).toBe(true);
  });
});
```

- [x] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/periodClosingMapping.test.ts
```
Harapan: GAGAL — kedua fungsi belum diekspor dari `shared/journalMapping.ts`.

- [x] **Step 3: Tulis implementasi**

Di `shared/journalMapping.ts`, tambahkan impor pada bagian atas berkas:

```ts
import { findAccount, isBalanceSheetAccount, RETAINED_EARNINGS_ACCOUNT_CODE } from "./chartOfAccounts";
import { formatAmount, oppositeSide, parseAmount, type JournalSide } from "./ledger";
```
(`type JournalSide` sudah diimpor; gabungkan, jangan menduplikasi barisnya.)

Lalu tambahkan di akhir berkas:

```ts
/**
 * Penutupan periode: penilaian persediaan valuta.
 *
 * Persediaan periodik berarti akun 1-1210 Kas UKA hanya bergerak di sini — `mapExchangeTransaction`
 * sengaja tidak menyentuhnya per transaksi karena itu menuntut harga pokok per lot yang sistem ini
 * tidak melacak. Satu jurnal memuat kedua sisi sekaligus (keputusan pengguna 4 September 2026):
 * membalik nilai persediaan akhir periode sebelumnya ke 5-1100, lalu membukukan nilai baru ke
 * 5-1300. Keduanya jatuh di dalam periode yang ditutup, sehingga tidak ada jurnal yang ditulis ke
 * periode lain dan idempotensinya cukup dijaga satu kunci sumber.
 */
export const FX_INVENTORY_ACCOUNT = "1-1210";
export const OPENING_INVENTORY_ACCOUNT = "5-1100";
export const CLOSING_INVENTORY_ACCOUNT = "5-1300";

export function mapPeriodInventoryClosing(input: {
  priorClosingValue: string;
  closingValue: string;
  memo: string;
}): MappingResult {
  const prior = toLedgerAmount(input.priorClosingValue);
  const closing = toLedgerAmount(input.closingValue);
  if (!prior || !closing) return { skipped: "nilai penilaian memiliki pecahan di bawah sen" };
  if (prior.negative || closing.negative) {
    return { skipped: "nilai persediaan negatif; hitungan fisik tidak pernah negatif dan angkanya harus diperiksa lebih dulu" };
  }

  const memo = input.memo.slice(0, 500);
  const lines: MappedLine[] = [];
  if (prior.amount !== "0.00") {
    lines.push({ accountCode: OPENING_INVENTORY_ACCOUNT, side: "DEBIT", amount: prior.amount, memo });
    lines.push({ accountCode: FX_INVENTORY_ACCOUNT, side: "KREDIT", amount: prior.amount, memo });
  }
  if (closing.amount !== "0.00") {
    lines.push({ accountCode: FX_INVENTORY_ACCOUNT, side: "DEBIT", amount: closing.amount, memo });
    lines.push({ accountCode: CLOSING_INVENTORY_ACCOUNT, side: "KREDIT", amount: closing.amount, memo });
  }
  if (!lines.length) return { skipped: "tidak ada persediaan UKA untuk dinilai pada periode ini" };
  return { lines };
}

/**
 * Penutup laba tahun buku ke 3-2100 Laba Ditahan.
 *
 * Hanya akhir tahun buku, bukan tiap bulan (keputusan pengguna 4 September 2026): menutup tiap bulan
 * membuat laba rugi bulanan dan laba ditahan sama-sama bergerak, dan laporan laba rugi tahunan tidak
 * lagi dapat disusun dari buku besar tanpa membaca balik jurnal penutup tiap bulan.
 *
 * Akun mana yang ditutup ditentukan `isBalanceSheetAccount`, bukan daftar kode yang ditulis ulang di
 * sini — dua daftar yang harus dijaga serempak adalah dua daftar yang akan berbeda.
 */
export function mapYearEndProfitClosing(input: {
  balances: { accountCode: string; balance: string }[];
  memo: string;
}): MappingResult {
  const memo = input.memo.slice(0, 500);
  const lines: MappedLine[] = [];
  let net = 0n; // positif berarti laba

  for (const row of input.balances) {
    const account = findAccount(row.accountCode);
    if (!account) return { skipped: `akun ${row.accountCode} tidak ada pada bagan akun` };
    if (isBalanceSheetAccount(account.type)) continue;

    const parsed = toLedgerAmount(row.balance);
    if (!parsed) return { skipped: `saldo akun ${row.accountCode} memiliki pecahan di bawah sen` };
    const magnitude = parseAmount(parsed.amount);
    if (magnitude === 0n) continue;

    // Saldo datang searah saldo normal akunnya; menolkannya berarti membukukan sisi sebaliknya.
    const naturalSide: JournalSide = account.normalBalance === "DEBIT" ? "DEBIT" : "KREDIT";
    const signed = parsed.negative ? -magnitude : magnitude;
    lines.push({
      accountCode: row.accountCode,
      side: signed > 0n ? oppositeSide(naturalSide) : naturalSide,
      amount: formatAmount(magnitude),
      memo,
    });
    // Akun bersaldo normal kredit menambah laba; yang bersaldo normal debit menguranginya. Akun
    // lawan ikut benar apa adanya: 5-1300 bersaldo normal kredit dan memang menambah laba.
    net += naturalSide === "KREDIT" ? signed : -signed;
  }

  if (!lines.length) return { skipped: "tidak ada saldo laba rugi untuk ditutup pada tahun buku ini" };
  if (net !== 0n) {
    lines.push({
      accountCode: RETAINED_EARNINGS_ACCOUNT_CODE,
      side: net > 0n ? "KREDIT" : "DEBIT",
      amount: formatAmount(net > 0n ? net : -net),
      memo,
    });
  }
  return { lines };
}
```

- [x] **Step 4: Jalankan uji, pastikan lulus**

```bash
./node_modules/.bin/vitest run server/periodClosingMapping.test.ts server/journalMapping.test.ts server/cashJournalMapping.test.ts
./node_modules/.bin/tsc --noEmit
```
Harapan: seluruh uji lulus. Uji pemetaan lama **tidak boleh** berubah — bila ada yang gagal, impor baru menabrak sesuatu; berhenti dan laporkan.

- [x] **Step 5: Commit**

```bash
git add shared/journalMapping.ts server/periodClosingMapping.test.ts
git commit -m "Pemetaan jurnal penilaian persediaan dan penutup laba tahunan"
```

---

### Task 4: `buildPeriodValuation` — bukti kuantitas dan kurs

Pembacaan saja: tidak menulis apa pun. Dipakai panel untuk **menunjukkan** angka dan penghalangnya
sebelum tombol ditekan, dan dipakai `postPeriodClosing` sebagai satu-satunya sumber angkanya —
sehingga yang dilihat pengguna dan yang dijurnal server mustahil berbeda.

**Files:**
- Create: `server/periodClosing.ts`
- Test: `server/periodValuation.test.ts`

**Interfaces:**
- Consumes: `accountingPeriods`, `currencies`, `stockOpnames`, `rateReferenceSnapshots`,
  `cashBalances`, `periodClosingValuations` dari `drizzle/schema`; `valueForeignInventory` (tugas 2);
  `getOpnameSystemCounts`, `databaseOrThrow`, `retryTransientDatabaseRead` dari `server/operations`;
  `isoDay` dari `shared/ledger`.
- Produces:
  - `type CurrencyValuationRow` dan `type PeriodValuation` (bentuk di bawah)
  - `buildPeriodValuation(periodId: number): Promise<PeriodValuation>`
  - Dipakai tugas 5, 8, 9.

- [x] **Step 1: Tulis uji yang gagal**

Buat `server/periodValuation.test.ts`. Palsukan `getDb` seperti `server/opnameSystemCounts.test.ts`,
dan mock `getOpnameSystemCounts` supaya pemeriksaan "stok memang kosong" dapat dikemudikan:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, getOpnameSystemCounts: vi.fn() };
});

import { getOpnameSystemCounts } from "./operations";
import { buildPeriodValuation } from "./periodClosing";
```

Uji yang wajib ada, masing-masing satu `it`:

1. Menilai satu mata uang dari opname terakhir di dalam periode dan snapshot BI tanggal akhir
   periode — `rows` berisi satu baris dengan `rupiahValue` yang cocok dengan `valueForeignInventory`.
2. **Mengecualikan IDR sepenuhnya**, bahkan ketika opname IDR ada dan bersaldo besar. Ini uji
   terpenting di berkas ini: memasukkan IDR menghitung kas Rupiah dua kali dan neracanya tetap
   seimbang, sehingga kekeliruannya tidak akan terlihat dari mana pun.
3. Memakai opname yang lebih awal bila tidak ada opname pada tanggal akhir periode, dan
   `opnameDate` pada hasilnya menyebut tanggal yang benar-benar dipakai.
4. Menolak mata uang yang opname terakhirnya jatuh **sebelum** awal periode → satu entri `blockers`.
5. Menolak mata uang yang opname-nya masih `OPEN` atau `SUBMITTED` → satu entri `blockers`.
6. Menerima opname berstatus `VARIANCE` — hitungan fisik yang sudah ditinjau tetap bukti.
7. Memakai snapshot BI terakhir ≤ akhir periode dan menyebut `rateReferenceDate`-nya saat akhir
   periode jatuh pada hari libur.
8. Menolak bila snapshot terakhir jatuh sebelum awal periode → `blockers` menyebut sinkronisasi BI.
9. Mata uang tanpa opname tetapi `availableAmount` nol **dan** brankas kosong: bukan penghalang,
   tidak menghasilkan baris penilaian.
10. `priorClosingValue` dibaca dari periode dinilai sebelumnya; nol bila belum pernah ada.

- [x] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/periodValuation.test.ts
```
Harapan: GAGAL — `server/periodClosing.ts` belum ada.

- [x] **Step 3: Tulis implementasi**

Buat `server/periodClosing.ts` dengan bentuk berikut. Doc-comment-nya wajib menyebutkan **alasan**,
bukan hanya langkahnya:

```ts
export type CurrencyValuationRow = {
  currencyId: number;
  currencyCode: string;
  quantity: string;
  stockOpnameId: number;
  /** Tanggal opname yang benar-benar dipakai; boleh lebih awal daripada akhir periode. */
  opnameDate: string;
  rateSnapshotId: number;
  /** Tanggal snapshot BI yang benar-benar dipakai; BI tidak mengumumkan kurs pada hari libur. */
  rateReferenceDate: string;
  buyRate: string;
  sellRate: string;
  quoteUnit: string;
  midRatePerUnit: string;
  rupiahValue: string;
};

export type PeriodValuation = {
  periodId: number;
  periodStart: string;
  periodEnd: string;
  status: "TERBUKA" | "DITUTUP";
  rows: CurrencyValuationRow[];
  blockers: { currencyCode: string; reason: string }[];
  /** Total nilai persediaan akhir periode dinilai sebelumnya — sisi 5-1100 jurnal penutupan. */
  priorClosingValue: string;
  /** Total nilai penutupan periode ini — sisi 5-1300. */
  closingValue: string;
  valuationPostedAt: Date | null;
  /** Benar bila periode ini berakhir 31 Desember. */
  isFiscalYearEnd: boolean;
  profitClosingPostedAt: Date | null;
};

export async function buildPeriodValuation(periodId: number): Promise<PeriodValuation>;
```

Aturan yang harus ditegakkan implementasinya, seluruhnya sudah diputuskan pada spec:

- Mata uang yang diperiksa: seluruh `currencies` dengan `code <> 'IDR'` yang punya baris
  `cash_balances`. IDR **tidak pernah** ikut.
- Kuantitas: `stock_opnames` dengan `currencyId` itu, `isDemo = false`, `isHistorical = false`,
  `reconciliationStatus IN ('RECONCILED','VARIANCE')`, `opnameDate` antara `periodStart` dan
  `periodEnd`, diurutkan `opnameDate` menurun, ambil satu. `physicalBalance` NULL → penghalang.
- Kurs: `rate_reference_snapshots` dengan `source = 'BI_TRANSACTION_RATES'`, `isDemo = false`,
  `referenceDate <= periodEnd`, urut menurun, ambil satu. Bila `referenceDate < periodStart` →
  penghalang yang menyebut sinkronisasi BI tertinggal.
- Tanpa opname tetapi `availableAmount` nol dan `getOpnameSystemCounts(currencyId).safe` seluruhnya
  nol → lewati tanpa penghalang dan tanpa baris.
- Tanggal dikirim ke basis data lewat pola `dbDate` yang sudah ada
  (`new Date(\`${isoDay(value)}T00:00:00\`)`) — **jangan** mengirim `Date` tengah malam UTC ke kolom
  `date`; itu bug paket K1 yang sudah diperbaiki dan tidak boleh kembali.
- `priorClosingValue`: `SUM(rupiahValue)` dari `period_closing_valuations` milik periode dengan
  `periodEnd` terbesar yang `< periodStart` **dan** `valuationPostedAt IS NOT NULL`.

- [x] **Step 4: Jalankan uji dan gerbang mutu**

```bash
./node_modules/.bin/vitest run server/periodValuation.test.ts
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```
Harapan: seluruh uji lulus.

- [x] **Step 5: Commit**

```bash
git add server/periodClosing.ts server/periodValuation.test.ts
git commit -m "Bukti kuantitas dan kurs penutup untuk penilaian persediaan UKA"
```

---

### Task 5: `postPeriodClosing` — tulis penilaian dan jurnalnya

**Files:**
- Modify: `server/periodClosing.ts`
- Test: `server/periodClosingPosting.test.ts` (baru)

**Interfaces:**
- Consumes: `buildPeriodValuation` (tugas 4), `mapPeriodInventoryClosing` (tugas 3),
  `postJournalEntry` dari `server/ledgerOperations`, `writeAudit` dari `server/operations`.
- Produces: `postPeriodClosing(input: { periodId: number }, actor: { id: number }): Promise<{ periodId: number; entryNumber: string | null; rows: CurrencyValuationRow[]; skipped: string | null }>`.
  Dipakai tugas 8.

- [x] **Step 1: Tulis uji yang gagal**

Buat `server/periodClosingPosting.test.ts` dengan `buildPeriodValuation` dan `postJournalEntry`
di-mock. Uji yang wajib ada:

1. Menolak periode yang sudah `DITUTUP`.
2. Menolak bila `blockers` tidak kosong, dan pesannya menyebut mata uang beserta alasannya —
   penutupan tidak boleh berjalan sebagian.
3. Menulis satu baris `period_closing_valuations` per mata uang, lalu satu jurnal `TUTUP_PERIODE`
   dengan `sourceReference = "TUTUP-{periodId}"` bertanggal akhir periode.
4. **Mengisi `valuationPostedAt` meski jurnalnya `skipped`** karena kedua sisi nol — penilaian sudah
   dijalankan dan hasilnya memang kosong; tanpa ini periode tanpa UKA tidak akan pernah dapat
   ditutup.
5. Idempoten: dijalankan dua kali tidak menghasilkan jurnal kedua. Kunci uniknya sudah ada; yang
   diuji adalah pesan galatnya terbaca manusia, bukan SQL mentah.
6. Baris penilaian dan jurnal ditulis dalam **satu** transaksi basis data — penilaian yang tersimpan
   tanpa jurnalnya terlihat seperti penutupan yang sah padahal bukan.
7. Menulis `writeAudit` dengan aksi `PERIOD_CLOSING_VALUATION_POSTED` beserta nilai per mata uang.

- [x] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/periodClosingPosting.test.ts
```

- [x] **Step 3: Tulis implementasi**

Kerangkanya:

```ts
export async function postPeriodClosing(input: { periodId: number }, actor: { id: number }) {
  const valuation = await buildPeriodValuation(input.periodId);
  if (valuation.status === "DITUTUP") throw new Error("Periode ini sudah ditutup; penilaiannya tidak dapat diulang.");
  if (valuation.valuationPostedAt) throw new Error("Penilaian periode ini sudah dijalankan.");
  if (valuation.blockers.length) {
    const detail = valuation.blockers.map((blocker) => `${blocker.currencyCode} (${blocker.reason})`).join(", ");
    throw new Error(`Penilaian tidak dapat dijalankan: ${detail}.`);
  }

  const memo = `Penutupan periode ${valuation.periodStart} s.d. ${valuation.periodEnd}`;
  const mapped = mapPeriodInventoryClosing({
    priorClosingValue: valuation.priorClosingValue,
    closingValue: valuation.closingValue,
    memo,
  });
  // Jurnal ditulis lebih dulu supaya id-nya dapat disimpan pada `accounting_periods`; bila
  // pemetaannya `skipped`, penilaiannya tetap tercatat dan periodenya tetap dapat ditutup.
  const entry = isSkipped(mapped)
    ? null
    : await postJournalEntry({ entryDate: new Date(`${valuation.periodEnd}T00:00:00`), description: memo, sourceType: "TUTUP_PERIODE", sourceReference: `TUTUP-${input.periodId}`, lines: mapped.lines }, actor);
  // ... lalu satu transaksi: hapus baris penilaian lama periode ini, sisipkan yang baru, dan isi
  // valuationPostedAt beserta valuationJournalEntryId.
}
```

- [x] **Step 4: Jalankan uji dan gerbang mutu**

```bash
./node_modules/.bin/vitest run server/periodClosingPosting.test.ts
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

- [x] **Step 5: Commit**

```bash
git add server/periodClosing.ts server/periodClosingPosting.test.ts
git commit -m "Penilaian persediaan akhir UKA dijurnal saat penutupan periode"
```

---

### Task 6: Penutup laba tahunan dan gerbang `closeAccountingPeriod`

**Files:**
- Modify: `server/periodClosing.ts`, `server/ledgerOperations.ts` (`closeAccountingPeriod`, ~baris 188)
- Test: `server/periodCloseGate.test.ts` (baru)

**Interfaces:**
- Consumes: `mapYearEndProfitClosing` (tugas 3), `accountBalancesFor` dari `server/ledgerOperations`.
- Produces: `postYearEndProfitClosing(input: { periodId: number }, actor: { id: number })`; dua
  penolakan baru pada `closeAccountingPeriod`. Dipakai tugas 8.

- [x] **Step 1: Tulis uji yang gagal**

Buat `server/periodCloseGate.test.ts`. Uji yang wajib ada:

1. `closeAccountingPeriod` menolak periode yang `valuationPostedAt`-nya kosong, dan pesannya menyebut
   penilaian persediaan.
2. Periode berakhir 31 Desember dan `profitClosingPostedAt` kosong → ditolak.
3. Periode bukan Desember dengan `valuationPostedAt` terisi → **lulus** seperti sebelumnya
   (`verifyLedgerIntegrity` tetap berjalan lebih dulu; urutannya jangan dibalik).
4. `postYearEndProfitClosing` menolak periode yang tidak berakhir 31 Desember.
5. `postYearEndProfitClosing` menolak bila `valuationPostedAt` masih kosong — persediaan akhir
   Desember ikut menentukan labanya, jadi urutannya mengikat.
6. Jurnalnya bersumber `TUTUP_PERIODE` dengan `sourceReference = "TUTUP-LABA-{tahun}"` dan saldo yang
   ditutup diambil dari `accountBalancesFor` sejak penutupan tahunan sebelumnya.

- [x] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/periodCloseGate.test.ts
```

- [x] **Step 3: Tulis implementasi**

Di `server/ledgerOperations.ts`, **setelah** blok `verifyLedgerIntegrity` yang sudah ada di
`closeAccountingPeriod`:

```ts
  // Mengunci tanpa menilai adalah keadaan yang berlaku sampai paket C, dan justru itu yang membuat
  // 1-1210 Kas UKA nol selamanya. Penilaian karena itu menjadi syarat, bukan anjuran.
  if (!period.valuationPostedAt) {
    throw new Error("Periode tidak dapat ditutup: penilaian persediaan akhir UKA belum dijalankan. Jalankan penilaian pada panel Penutupan Periode lebih dulu.");
  }
  if (isoDay(period.periodEnd).slice(5) === "12-31" && !period.profitClosingPostedAt) {
    throw new Error("Periode Desember tidak dapat ditutup: jurnal penutup laba ke Laba Ditahan belum dijalankan.");
  }
```

`postYearEndProfitClosing` di `server/periodClosing.ts` mengikuti bentuk `postPeriodClosing`, dengan
saldo diambil `accountBalancesFor({ from: <hari setelah penutupan tahunan sebelumnya>, to: periodEnd })`
dan diubah menjadi string dua desimal lewat `formatAmount`.

- [x] **Step 4: Jalankan uji dan gerbang mutu**

```bash
./node_modules/.bin/vitest run server/periodCloseGate.test.ts server/ledger.test.ts
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```
Harapan: `server/ledger.test.ts` yang sudah ada mungkin memakai `closeAccountingPeriod` tanpa
penilaian. **Bila gagal, itu bukan kejutan** — perbarui ujinya agar menyiapkan `valuationPostedAt`,
dan sebutkan perubahan jumlah ujinya pada pesan commit.

- [x] **Step 5: Commit**

```bash
git add server/periodClosing.ts server/ledgerOperations.ts server/periodCloseGate.test.ts server/ledger.test.ts
git commit -m "Penutup laba tahunan dan syarat penilaian sebelum periode dikunci"
```

---

### Task 7: Neraca memakai laba sejak penutupan tahunan terakhir

Berdiri sendiri, dan **tidak menggerakkan satu pun angka** sampai penutupan tahunan pertama benar-benar
dijalankan — itulah yang membuatnya dapat dirilis dan diuji tanpa menunggu 31 Desember.

**Files:**
- Modify: `server/financialStatements.ts` (`buildFinancialStatements`, baris 94)
- Test: `server/financialStatements.test.ts` (sudah ada; tambahkan)

**Interfaces:**
- Consumes: `journalEntries` dari `drizzle/schema`; `isBalanceSheetAccount`, `findAccount` dari
  `shared/chartOfAccounts`.
- Produces: perilaku baru `buildFinancialStatements`; bentuk keluarannya **tidak berubah**.

- [x] **Step 1: Tulis uji yang gagal**

Tambahkan pada `server/financialStatements.test.ts`:

1. Tanpa jurnal penutup laba, neraca **identik** dengan hari ini — laba sejak awal pembukuan.
2. Dengan jurnal penutup laba bertanggal 31 Desember 2025, neraca 2026 memakai laba sejak 1 Januari
   2026, dan 3-2100 sudah memuat laba tahun-tahun sebelumnya sehingga neracanya tetap seimbang.
3. Kolom pembanding memakai batasnya sendiri, bukan batas periode berjalan.

- [x] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/financialStatements.test.ts
```

- [x] **Step 3: Tulis implementasi**

Perbarui komentar pada `buildFinancialStatements` — komentar lama menyatakan neraca memakai laba
sejak awal pembukuan **karena jurnal penutup belum ada**, dan alasan itu kini gugur untuk tahun yang
sudah ditutup. Lalu:

```ts
/** Tanggal jurnal penutup laba terakhir yang tidak melewati batas ini, bila sudah pernah ada. */
async function lastProfitClosingDate(db: Awaited<ReturnType<typeof databaseOrThrow>>, to: Date | string) {
  const [row] = await db
    .select({ entryDate: journalEntries.entryDate })
    .from(journalEntries)
    .where(and(
      eq(journalEntries.sourceType, "TUTUP_PERIODE"),
      sql`${journalEntries.sourceReference} LIKE 'TUTUP-LABA-%'`,
      lte(journalEntries.entryDate, new Date(`${isoDay(to)}T00:00:00`)),
    ))
    .orderBy(desc(journalEntries.entryDate))
    .limit(1);
  return row ? isoDay(row.entryDate) : null;
}

/**
 * Saldo untuk neraca: akun neraca kumulatif sejak awal pembukuan, akun laba rugi hanya sejak
 * penutupan tahunan terakhir. Selama belum pernah ada penutupan tahunan, keduanya identik dan
 * angkanya persis seperti sebelum paket C.
 */
function mergeForBalanceSheet(cumulative: StatementAccount[], sinceClosing: StatementAccount[]): StatementAccount[] {
  const sinceMap = new Map(sinceClosing.map((row) => [row.accountCode, row.balance]));
  const seen = new Set<string>();
  const merged = cumulative.map((row) => {
    seen.add(row.accountCode);
    const account = findAccount(row.accountCode);
    if (account && isBalanceSheetAccount(account.type)) return row;
    return { accountCode: row.accountCode, balance: sinceMap.get(row.accountCode) ?? 0n };
  });
  for (const row of sinceClosing) if (!seen.has(row.accountCode)) merged.push(row);
  return merged;
}
```

Pemakaiannya: hitung `lastProfitClosingDate` untuk `input.to` dan untuk `dayBefore`, ambil
`accountBalancesFor({ from: <hari setelah tanggal itu>, to })` bila ada, lalu gabungkan dengan
`cumulativeNow`/`cumulativePrior` sebelum diserahkan ke `buildBalanceSheet` dan `buildEquityStatement`.
Laporan laba rugi periode (`periodNow`, `periodPrior`) **tidak berubah** — ia sudah memakai mutasi
periode.

- [x] **Step 4: Jalankan uji dan gerbang mutu**

```bash
./node_modules/.bin/vitest run server/financialStatements.test.ts server/financialReporting.test.ts
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

- [x] **Step 5: Commit**

```bash
git add server/financialStatements.ts server/financialStatements.test.ts
git commit -m "Neraca memakai laba sejak penutupan tahunan terakhir"
```

---

### Task 8: Tiga prosedur tRPC

**Files:**
- Modify: `server/routers.ts` (router `ledger`, baris 512)
- Test: `server/periodClosing.authorization.test.ts` (baru)

**Interfaces:**
- Consumes: `buildPeriodValuation`, `postPeriodClosing`, `postYearEndProfitClosing` dari
  `server/periodClosing`.
- Produces:
  - `ledger.closingValuation` — `controllerProcedure.input({ periodId })`, query
  - `ledger.postClosingValuation` — `controllerProcedure.input({ periodId })`, mutation
  - `ledger.postYearEndClosing` — `controllerProcedure.input({ periodId })`, mutation
  - **Dipakai tugas 9**; tugas 9 tidak boleh memanggil endpoint lain.

- [ ] **Step 1: Tulis uji otorisasi yang gagal**

Buat `server/periodClosing.authorization.test.ts` mengikuti pola
`server/regulatoryReporting.authorization.test.ts`: `vi.mock("./periodClosing", ...)`, `appRouter.createCaller`,
lalu pastikan `STAFF` dan `ADMIN` mendapat `FORBIDDEN` pada ketiga prosedur sementara `CONTROLLER`
lolos. Otorisasi ditegakkan di server, bukan disembunyikan di UI.

- [ ] **Step 2: Jalankan uji, pastikan gagal**

```bash
./node_modules/.bin/vitest run server/periodClosing.authorization.test.ts
```

- [ ] **Step 3: Tulis implementasi**

Di `server/routers.ts`, di dalam `ledger: router({ ... })`, tepat di bawah `reopenPeriod`:

```ts
    /**
     * Penutupan periode. Dibaca dan dijalankan Controller ke atas, sama seperti seluruh router ini —
     * angkanya angka laporan keuangan, bukan informasi operasional harian.
     */
    closingValuation: controllerProcedure
      .input(z.object({ periodId: z.number().int().positive() }))
      .query(({ input }) => buildPeriodValuation(input.periodId)),
    postClosingValuation: controllerProcedure
      .input(z.object({ periodId: z.number().int().positive() }))
      .mutation(({ input, ctx }) => postPeriodClosing(input, ctx.user)),
    postYearEndClosing: controllerProcedure
      .input(z.object({ periodId: z.number().int().positive() }))
      .mutation(({ input, ctx }) => postYearEndProfitClosing(input, ctx.user)),
```

- [ ] **Step 4: Jalankan uji dan gerbang mutu**

```bash
./node_modules/.bin/vitest run server/periodClosing.authorization.test.ts
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

- [ ] **Step 5: Commit**

```bash
git add server/routers.ts server/periodClosing.authorization.test.ts
git commit -m "Prosedur tRPC penilaian dan penutupan periode"
```

---

### Task 9: Panel Penutupan Periode

**Files:**
- Modify: `client/src/pages/BukuBesar.tsx` (`PeriodRow`, baris 763; tab Periode, baris 730)

**Interfaces:**
- Consumes — **inilah endpoint yang menyediakan datanya, disebutkan supaya tidak terulang kelalaian
  rencana paket D**:
  - `trpc.ledger.closingValuation.useQuery({ periodId })` → seluruh isi tabel, `blockers`,
    `priorClosingValue`, `closingValue`, `valuationPostedAt`, `isFiscalYearEnd`,
    `profitClosingPostedAt`
  - `trpc.ledger.postClosingValuation.useMutation()` → tombol "Jalankan penilaian"
  - `trpc.ledger.postYearEndClosing.useMutation()` → tombol "Jurnal penutup laba tahunan", hanya
    tampil bila `isFiscalYearEnd`
  - Tombol "Tutup periode" yang sudah ada tetap memakai `trpc.ledger.closePeriod`
- Produces: tampilan saja; tidak ada tipe baru.

- [ ] **Step 1: Muat penilaian per baris periode**

`closingValuation` dipanggil **per periode**, dan hanya untuk periode yang sedang dibuka detailnya —
memanggilnya untuk seluruh baris sekaligus berarti satu kueri per periode setiap kali tab dibuka.
Tambahkan state "periode yang sedang diperiksa" pada komponen induk, dan `enabled` pada query-nya.

- [ ] **Step 2: Tabel per mata uang**

Kolom: Mata uang, Kuantitas, Tanggal opname, Kurs tengah, Tanggal kurs, Nilai Rupiah. Tanggal opname
dan tanggal kurs yang **berbeda** dari akhir periode diberi tanda beserta keterangan singkat — itulah
bentuk konkret keputusan 5 pada spec, dan menyembunyikannya mengembalikan pemunduran tanggal diam-diam
yang keputusan itu justru tolak.

- [ ] **Step 3: Daftar penghalang**

`blockers` ditampilkan sebagai daftar per mata uang beserta alasannya, dan tombol "Jalankan penilaian"
dinonaktifkan selama daftar itu tidak kosong. Wajib ada keadaan memuat, kosong, dan galat.

- [ ] **Step 4: Ringkasan yang akan dijurnal**

Di atas tombol: "Persediaan awal (5-1100)" = `priorClosingValue` dan "Persediaan akhir (5-1300)" =
`closingValue`, sehingga angkanya terlihat **sebelum** dijurnal.

- [ ] **Step 5: Tombol dan urutannya**

Tombol "Tutup periode" yang sudah ada dinonaktifkan selama `valuationPostedAt` kosong, dengan
keterangan singkat mengapa — pengguna tidak boleh menemukan syaratnya lewat pesan galat. Untuk
periode Desember, tombol penutup laba muncul di antara keduanya.

- [ ] **Step 6: Verifikasi visual**

```bash
./node_modules/.bin/vite build
```
Lalu jalankan aplikasi, buka **Buku Besar → Periode**, dan periksa dengan mata: tabel terisi, tanggal
yang berbeda tertandai, tombol tertutup saat ada penghalang, fokus keyboard berjalan pada tombol
barunya. Sertakan tangkapan layar pada laporan tugas ini.

- [ ] **Step 7: Gerbang mutu dan commit**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/vite build
git add client/src/pages/BukuBesar.tsx
git commit -m "Panel Penutupan Periode pada tab Periode Buku Besar"
```

---

### Task 10: Skenario menyeluruh dan dokumentasi

**Files:**
- Create: `server/periodClosingScenario.test.ts`
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md`,
  `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md` (centang tugas), `todo-jp0taelo.md`

**Interfaces:**
- Consumes: seluruh tugas sebelumnya.
- Produces: bukti bahwa dua periode berurutan tersambung dengan benar.

- [ ] **Step 1: Skenario dua periode berurutan**

Uji Vitest atas fungsi, dengan `getDb` dipalsukan — **jangan** membuat data di basis data lokal.
Yang harus dibuktikan:

1. Periode pertama: tidak ada persediaan awal, persediaan akhir dinilai, 1-1210 terisi.
2. Periode kedua: nilai periode pertama muncul sebagai 5-1100, nilai baru sebagai 5-1300, dan
   1-1210 berakhir pada nilai periode kedua saja — bukan menumpuk.
3. Beli lalu jual habis dalam satu periode: persediaan akhir nol, jurnalnya hanya berisi sisi
   persediaan awal, dan periodenya tetap dapat ditutup.
4. Menutup Desember tanpa penutup laba ditolak; setelah penutup laba dijalankan, 3-2100 memuat laba
   tahun itu dan neraca tetap seimbang.

- [ ] **Step 2: Perbarui panduan A–Z**

Tambahkan langkah penutupan periode: urutannya (opname akhir bulan → penilaian → penutup laba bila
Desember → tutup periode), arti kolom tanggal opname/kurs yang berbeda, dan apa yang harus dilakukan
bila muncul penghalang.

- [ ] **Step 3: Perbarui skema database**

Tabel `period_closing_valuations` dan empat kolom baru `accounting_periods`, beserta alasan kolom
penanda dipisahkan dari baris penilaian.

- [ ] **Step 4: Gerbang akhir**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
```
Sebutkan jumlah uji yang **benar-benar dilihat** pada laporan; baseline sebelum paket ini 551 lulus,
2 dilewati, 81 berkas.

- [ ] **Step 5: Tinjau `todo-jp0taelo.md` dan centang ROADMAP**

Centang seluruh Tugas 1–10 Paket C pada `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`, dan tandai
butir yang selesai pada `todo-jp0taelo.md`.

- [ ] **Step 6: Commit**

```bash
git add server/periodClosingScenario.test.ts docs todo-jp0taelo.md
git commit -m "Skenario penutupan dua periode dan dokumentasi penilaian UKA"
```
