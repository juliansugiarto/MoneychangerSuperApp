# Butir B sebelum desktop — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (eksekusi langsung oleh
> sesi, **tanpa subagen** — keputusan pengguna 28 September 2026). Langkah memakai kotak centang.

**Goal:** Pemblokiran atas kecocokan DTTOT/DPPSPM beserta catatan percobaan transaksi (B2), tinjauan
berkala klasifikasi risiko IRA (B3), dan pengisian tanggal berakhir hubungan nasabah INACTIVE lama
oleh Controller (B4).

**Architecture:** Aturan murni di `shared/` (dipakai server dan layar), penulis data di modul server
tersendiri (`server/watchlistBlocks.ts`, `server/iraClassificationReview.ts`), gerbang di
`createTransaction`, satu migrasi `0062` hanya-tambah plus pengisian awal. Otorisasi di tRPC
(`controllerProcedure`) **dan** fungsi `*Denial` yang dapat diuji tanpa tRPC.

**Tech Stack:** TypeScript, Drizzle/MySQL, tRPC, React, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-butir-b-sebelum-desktop-design.md`

## Status Pengerjaan

- [x] Tugas 1 — Skema dan migrasi `0062`
- [x] Tugas 2 — Aturan murni pemblokiran
- [x] Tugas 3 — Penulis blokir: penyaringan dan centang petugas
- [x] Tugas 4 — Gerbang bon dan pencatatan percobaan
- [x] Tugas 5 — Keputusan atas blokir dan router
- [x] Tugas 6 — Register Pemblokiran dan Kesiapan Operasional
- [x] Tugas 7 — Aturan murni tinjauan klasifikasi
- [x] Tugas 8 — Pengesahan tinjauan, selang, dan layarnya
- [x] Tugas 9 — B4 tanggal berakhir hubungan
- [x] Tugas 10 — Peragaan end-to-end, dokumentasi, perintah mutu

## Global Constraints

- `pnpm` tidak ada: `./node_modules/.bin/{vitest,tsc,vite,drizzle-kit,playwright}`; klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Env uji: `set -a; . ./.env; set +a; export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"` — "dilewati" harus **2**.
- Baseline: `Test Files 224 passed (224)`, `Tests 1734 passed | 2 skipped (1736)`.
- Migrasi hanya ke `moneychanger` dan `mc_t_abcvalas` lewat `node scripts/tenant.mjs migrate-all`; **tidak ke produksi**.
- Instan waktu ditulis dari JS (`new Date()`), bukan `DEFAULT CURRENT_TIMESTAMP`.
- Hari/batas tanggal memakai zona operasional (`startOfOperationalDay`, `operationalDateKey` dari `shared/regulatoryActionQueue.ts`), bukan waktu lokal runtime.
- Pesan kasir untuk nasabah terblokir persis: `Transaksi tidak dapat diproses. Hubungi Controller. Jangan sampaikan alasannya kepada nasabah.`
- Penolakan bon terblokir terjadi **sebelum** bon, kas, pecahan kedua kaki, jurnal, atau stok ditulis.
- `customers.dttotPpsdmMatch` tidak pernah diubah penyaringan otomatis.
- Keputusan blokir, tinjauan klasifikasi, dan tanggal berakhir: CONTROLLER ke atas; catatan/sumber wajib (≥ 3 karakter sesudah trim); setiap keputusan menulis `audit_logs`.
- Isi repo berbahasa Indonesia; tidak menjalankan prettier.

## Review Focus

1. **Impor daftar menghapus-lalu-menyisipkan entri** → id entri berganti; kunci kecocokan harus `listType:referenceCode` / nama ternormalisasi, sehingga FALSE_POSITIVE tidak terbuka ulang tiap impor. Diuji di Tugas 2.
2. **Pihak kuasa/wakil terblokir sementara nasabahnya bersih** → bon tetap ditolak, `blockedParty = KUASA`. Diuji di Tugas 4.
3. **Nasabah berisiko tinggi yang sudah DISETUJUI lalu cocok daftar** → tetap ditolak (gerbang blokir sebelum gerbang risiko tinggi). Diuji di Tugas 4.
4. **Penyaringan ulang massal atas ribuan nasabah** → blokir hanya dibuka untuk yang cocok, dibaca sekali, tidak per nasabah per kueri. Diuji di Tugas 3.
5. **Transaksi terakhir pukul 00.30 WIB (= hari sebelumnya di UTC)** → validasi "bukan masa depan" dan "tidak sebelum transaksi terakhir" dibandingkan per hari WIB, bukan per instan UTC; tanggal yang sama dengan hari transaksi terakhir sah. Diuji di Tugas 9 (`relationshipEndDenial` menerima kunci hari WIB).
6. **Penulisan percobaan gagal (basis data tumbang sesaat)** → bon tetap ditolak dengan pesan netral, kegagalan tercatat di log server. Uji tambahan di Tugas 4: `insert` palsu yang melempar → `createTransaction` tetap `rejects.toThrow(/Hubungi Controller/)`.

---

### Tugas 1: Skema dan migrasi `0062`

**Files:**
- Modify: `drizzle/schema.ts` (sesudah `customerWatchlistScreenings`; sesudah `iraRiskClassifications`; kolom di `operationalSettings`)
- Create: `drizzle/0062_*.sql` (hasil `drizzle-kit generate`), lalu tambahkan pengisian awal ke berkas yang sama di bawah penanda `--> statement-breakpoint`
- Test: `server/butirBSchema.test.ts`

**Interfaces — Produces:** `watchlistBlocks`, `attemptedTransactions`, `iraClassificationReviews`, `operationalSettings.iraClassificationReviewMonths`; tipe `WatchlistBlock`, `AttemptedTransaction`, `IraClassificationReview`; konstanta `watchlistBlockStatuses`, `watchlistBlockSources`.

- [x] **Step 1: Uji skema yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { attemptedTransactions, iraClassificationReviews, operationalSettings, watchlistBlocks, watchlistBlockStatuses } from "../drizzle/schema";

describe("skema butir B", () => {
  it("watchlist_blocks memuat kolom keputusan dan pelaporan", () => {
    const columns = Object.keys(getTableColumns(watchlistBlocks));
    for (const name of ["customerId", "openedAt", "source", "screeningId", "matchKeys", "status", "resolvedByUserId", "resolvedAt", "resolutionNotes", "ltkmReference", "biCopySentAt", "revocationReference"]) {
      expect(columns).toContain(name);
    }
    expect(watchlistBlockStatuses).toEqual(["OPEN", "CONFIRMED", "FALSE_POSITIVE", "DICABUT"]);
  });
  it("attempted_transactions menyimpan ringkasan, bukan bon", () => {
    const columns = Object.keys(getTableColumns(attemptedTransactions));
    for (const name of ["blockId", "customerId", "representativeCustomerId", "blockedParty", "tellerUserId", "attemptedAt", "operation", "linesSummary", "totalIdr"]) {
      expect(columns).toContain(name);
    }
  });
  it("ira_classification_reviews menyimpan snapshot dan selang ada di operational_settings", () => {
    expect(Object.keys(getTableColumns(iraClassificationReviews))).toEqual(expect.arrayContaining(["reviewedAt", "reviewedByUserId", "notes", "snapshot", "classificationCount"]));
    expect(Object.keys(getTableColumns(operationalSettings))).toContain("iraClassificationReviewMonths");
  });
});
```

- [x] **Step 2:** `./node_modules/.bin/vitest run server/butirBSchema.test.ts` → FAIL (ekspor tidak ada).

- [x] **Step 3: Tambahkan ke `drizzle/schema.ts`**

Sesudah `customerWatchlistScreenings`:

```ts
export const watchlistBlockStatuses = ["OPEN", "CONFIRMED", "FALSE_POSITIVE", "DICABUT"] as const;
export const watchlistBlockSources = ["PENYARINGAN", "PETUGAS", "PENGISIAN_AWAL"] as const;

/**
 * Pemblokiran serta merta atas kecocokan DTTOT/DPPSPM — Pasal 47 ayat (1) huruf d PBI 10/2024.
 *
 * Dibuka pada saat kecocokan (penyaringan atau centang petugas), bukan di loket; hanya manusia
 * (CONTROLLER ke atas) yang menutupnya. `matchKeys` memakai `listType:referenceCode` atau nama
 * ternormalisasi, **bukan** id entri — impor daftar menghapus lalu menyisipkan ulang entri.
 */
export const watchlistBlocks = mysqlTable("watchlist_blocks", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  openedAt: datetime("openedAt").notNull(),
  source: mysqlEnum("source", watchlistBlockSources).notNull(),
  screeningId: int("screeningId"),
  /** JSON larik string; null bila kuncinya tidak diketahui (pengisian awal, centang petugas). */
  matchKeys: text("matchKeys"),
  status: mysqlEnum("status", watchlistBlockStatuses).default("OPEN").notNull(),
  resolvedByUserId: int("resolvedByUserId"),
  resolvedAt: datetime("resolvedAt"),
  resolutionNotes: text("resolutionNotes"),
  ltkmReference: varchar("ltkmReference", { length: 200 }),
  biCopySentAt: datetime("biCopySentAt"),
  revocationReference: varchar("revocationReference", { length: 200 }),
}, (table) => [
  index("watchlist_blocks_customer_idx").on(table.customerId, table.status),
  index("watchlist_blocks_status_idx").on(table.status, table.openedAt),
]);

/** Percobaan transaksi yang ditahan pemblokiran — satu-satunya penulisnya `createTransaction`. */
export const attemptedTransactions = mysqlTable("attempted_transactions", {
  id: int("id").autoincrement().primaryKey(),
  blockId: int("blockId").notNull(),
  customerId: int("customerId").notNull(),
  representativeCustomerId: int("representativeCustomerId"),
  blockedParty: mysqlEnum("blockedParty", ["NASABAH", "KUASA"]).notNull(),
  tellerUserId: int("tellerUserId").notNull(),
  attemptedAt: datetime("attemptedAt").notNull(),
  operation: mysqlEnum("operation", ["BUY", "SELL"]).notNull(),
  /** JSON: [{ currencyId, currencyCode, foreignAmount, rate, idrAmount }] dari masukan bon. */
  linesSummary: text("linesSummary").notNull(),
  totalIdr: decimal("totalIdr", { precision: 24, scale: 2 }).notNull(),
}, (table) => [
  index("attempted_transactions_block_idx").on(table.blockId, table.attemptedAt),
]);

export type WatchlistBlock = typeof watchlistBlocks.$inferSelect;
export type AttemptedTransaction = typeof attemptedTransactions.$inferSelect;
```

Sesudah `iraRiskClassifications`:

```ts
/**
 * Pengesahan berkala atas seluruh klasifikasi risiko — Pasal 9 ayat (6) PBI 10/2024. Hanya
 * ditambah, tidak pernah diubah. `snapshot` adalah bukti bagi otoritas: isi tabel saat disahkan.
 */
export const iraClassificationReviews = mysqlTable("ira_classification_reviews", {
  id: int("id").autoincrement().primaryKey(),
  reviewedAt: datetime("reviewedAt").notNull(),
  reviewedByUserId: int("reviewedByUserId").notNull(),
  notes: text("notes").notNull(),
  snapshot: longtext("snapshot").notNull(),
  classificationCount: int("classificationCount").notNull(),
}, (table) => [index("ira_classification_reviews_at_idx").on(table.reviewedAt)]);

export type IraClassificationReview = typeof iraClassificationReviews.$inferSelect;
```

Di `operationalSettings`, sesudah `rateDeviationTolerancePercent`:

```ts
  /** Selang tinjauan klasifikasi risiko IRA, bulan (1–36). */
  iraClassificationReviewMonths: int("iraClassificationReviewMonths").default(12).notNull(),
```

(Periksa `longtext` sudah diimpor dari `drizzle-orm/mysql-core`; bila belum, tambahkan.)

- [x] **Step 4:** `./node_modules/.bin/vitest run server/butirBSchema.test.ts` → PASS.

- [x] **Step 5: Hasilkan migrasi dan tambahkan pengisian awal**

Run: `./node_modules/.bin/drizzle-kit generate --name butir_b_pemblokiran_tinjauan`
Baca SQL-nya: harus hanya `CREATE TABLE` ×3, `ALTER TABLE operational_settings ADD`, dan `CREATE INDEX`. Lalu tambahkan di akhir berkas:

```sql
--> statement-breakpoint
-- Pengisian awal: kecocokan yang sudah ada sebelum 0062 wajib terblokir sejak migrasi ini.
INSERT INTO `watchlist_blocks` (`customerId`, `openedAt`, `source`, `screeningId`, `matchKeys`, `status`)
SELECT c.`id`, UTC_TIMESTAMP(), 'PENGISIAN_AWAL', s.`id`, NULL, 'OPEN'
FROM `customers` c
LEFT JOIN `customer_watchlist_screenings` s ON s.`id` = (
  SELECT s2.`id` FROM `customer_watchlist_screenings` s2 WHERE s2.`customerId` = c.`id` ORDER BY s2.`screenedAt` DESC, s2.`id` DESC LIMIT 1
)
WHERE c.`isDemo` = false AND c.`isHistorical` = false
  AND (c.`dttotPpsdmMatch` = true OR s.`matchCount` > 0);
```

- [x] **Step 6: Terapkan ke kedua basis data lokal dan periksa**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
node scripts/tenant.mjs migrate-all
for d in moneychanger mc_t_abcvalas; do mysql -uroot -N $d -e "SHOW TABLES LIKE 'watchlist_blocks'; SELECT COUNT(*) FROM watchlist_blocks; SHOW COLUMNS FROM operational_settings LIKE 'iraClassificationReviewMonths';"; done
```
Expected: tabel ada di keduanya, hitungan blokir = jumlah nasabah cocok (catat angkanya), kolom ada.

- [x] **Step 7: Commit** — `git add drizzle server/butirBSchema.test.ts && git commit -m "Skema butir B: pemblokiran, percobaan transaksi, tinjauan klasifikasi (0062)"`

---

### Tugas 2: Aturan murni pemblokiran (`shared/watchlistBlock.ts`)

**Files:** Create `shared/watchlistBlock.ts`, Test `shared/watchlistBlock.test.ts`

**Interfaces — Produces:**
- `WATCHLIST_BLOCK_TELLER_MESSAGE: string`
- `matchKeyOf(match: { listType: string; referenceCode: string | null; fullName: string }): string`
- `type BlockLite = { status: "OPEN" | "CONFIRMED" | "FALSE_POSITIVE" | "DICABUT"; matchKeys: string | null }`
- `shouldOpenScreeningBlock(existing: BlockLite[], newKeys: string[]): boolean`
- `hasActiveBlock(existing: BlockLite[]): boolean`
- `summarizeAttemptLines(lines: { currencyId: number; denominations: { value: string; quantity: number; rate: string }[] }[], codeById: Map<number, string>): { lines: AttemptLineSummary[]; totalIdr: string }`

- [x] **Step 1: Uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { hasActiveBlock, matchKeyOf, shouldOpenScreeningBlock, summarizeAttemptLines, WATCHLIST_BLOCK_TELLER_MESSAGE } from "./watchlistBlock";

describe("matchKeyOf", () => {
  it("memakai referenceCode bila ada — id entri berganti setiap impor", () => {
    expect(matchKeyOf({ listType: "DTTOT", referenceCode: "IDN-001", fullName: "Abdul" })).toBe("DTTOT:IDN-001");
  });
  it("memakai nama ternormalisasi bila tanpa kode", () => {
    expect(matchKeyOf({ listType: "DPPSPM", referenceCode: null, fullName: "  Abdul   Rahman " })).toBe("DPPSPM:ABDUL RAHMAN");
  });
});

describe("shouldOpenScreeningBlock", () => {
  it("membuka bila belum ada blokir", () => {
    expect(shouldOpenScreeningBlock([], ["DTTOT:A"])).toBe(true);
  });
  it("tidak membuka bila tidak ada kunci (penyaringan nihil)", () => {
    expect(shouldOpenScreeningBlock([], [])).toBe(false);
  });
  it("tidak membuka bila sudah ada OPEN atau CONFIRMED", () => {
    expect(shouldOpenScreeningBlock([{ status: "OPEN", matchKeys: null }], ["DTTOT:A"])).toBe(false);
    expect(shouldOpenScreeningBlock([{ status: "CONFIRMED", matchKeys: "[\"DTTOT:A\"]" }], ["DTTOT:B"])).toBe(false);
  });
  it("tidak membuka ulang kunci yang sudah dinyatakan salah sasaran", () => {
    expect(shouldOpenScreeningBlock([{ status: "FALSE_POSITIVE", matchKeys: "[\"DTTOT:A\",\"DTTOT:B\"]" }], ["DTTOT:B"])).toBe(false);
  });
  it("membuka bila ada kunci BARU di luar keputusan salah sasaran", () => {
    expect(shouldOpenScreeningBlock([{ status: "FALSE_POSITIVE", matchKeys: "[\"DTTOT:A\"]" }], ["DTTOT:A", "DPPSPM:C"])).toBe(true);
  });
  it("salah sasaran tanpa kunci (pengisian awal) tidak mencakup apa pun", () => {
    expect(shouldOpenScreeningBlock([{ status: "FALSE_POSITIVE", matchKeys: null }], ["DTTOT:A"])).toBe(true);
  });
  it("DICABUT tidak menghalangi pembukaan baru", () => {
    expect(shouldOpenScreeningBlock([{ status: "DICABUT", matchKeys: "[\"DTTOT:A\"]" }], ["DTTOT:A"])).toBe(true);
  });
});

describe("hasActiveBlock", () => {
  it("OPEN dan CONFIRMED menahan; FALSE_POSITIVE dan DICABUT tidak", () => {
    expect(hasActiveBlock([{ status: "OPEN", matchKeys: null }])).toBe(true);
    expect(hasActiveBlock([{ status: "CONFIRMED", matchKeys: null }])).toBe(true);
    expect(hasActiveBlock([{ status: "FALSE_POSITIVE", matchKeys: null }, { status: "DICABUT", matchKeys: null }])).toBe(false);
  });
});

describe("summarizeAttemptLines", () => {
  it("menjumlah valas dan Rupiah per baris", () => {
    const result = summarizeAttemptLines(
      [{ currencyId: 2, denominations: [{ value: "100", quantity: 3, rate: "16000" }, { value: "50", quantity: 1, rate: "15900" }] }],
      new Map([[2, "USD"]]),
    );
    expect(result.lines).toEqual([{ currencyId: 2, currencyCode: "USD", foreignAmount: "350.00", idrAmount: "5595000.00" }]);
    expect(result.totalIdr).toBe("5595000.00");
  });
  it("baris cacat dicatat apa adanya dengan nol, tidak menggagalkan pencatatan", () => {
    const result = summarizeAttemptLines([{ currencyId: 9, denominations: [{ value: "abc", quantity: 1, rate: "x" }] }], new Map());
    expect(result.lines[0]).toMatchObject({ currencyId: 9, currencyCode: null, idrAmount: "0.00" });
    expect(result.totalIdr).toBe("0.00");
  });
});

it("pesan kasir netral", () => {
  expect(WATCHLIST_BLOCK_TELLER_MESSAGE).toBe("Transaksi tidak dapat diproses. Hubungi Controller. Jangan sampaikan alasannya kepada nasabah.");
});
```

- [x] **Step 2:** `./node_modules/.bin/vitest run shared/watchlistBlock.test.ts` → FAIL.

- [x] **Step 3: Implementasi**

```ts
/**
 * Aturan pemblokiran atas kecocokan DTTOT/DPPSPM — Pasal 47 ayat (1) huruf d PBI 10/2024.
 *
 * Tinggal di `shared/` karena server (penulis blokir, gerbang bon) dan layar Register Pemblokiran
 * wajib sepakat tentang kapan blokir terbuka dan apa yang menahan bon.
 */

/** "Tanpa pemberitahuan": kasir tidak diberi alasan yang dapat terucap kepada nasabah. */
export const WATCHLIST_BLOCK_TELLER_MESSAGE = "Transaksi tidak dapat diproses. Hubungi Controller. Jangan sampaikan alasannya kepada nasabah.";

export type WatchlistBlockStatus = "OPEN" | "CONFIRMED" | "FALSE_POSITIVE" | "DICABUT";
export type BlockLite = { status: WatchlistBlockStatus; matchKeys: string | null };

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();

/** Kunci kecocokan yang bertahan melewati impor ulang — id entri tidak. */
export function matchKeyOf(match: { listType: string; referenceCode: string | null; fullName: string }): string {
  const reference = match.referenceCode?.trim();
  return `${match.listType}:${reference ? reference : normalizeName(match.fullName)}`;
}

export function parseMatchKeys(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function hasActiveBlock(existing: BlockLite[]): boolean {
  return existing.some((block) => block.status === "OPEN" || block.status === "CONFIRMED");
}

/**
 * Apakah penyaringan dengan kunci `newKeys` membuka blokir baru. Penyaringan nihil tidak pernah
 * membuka (dan tidak pernah menutup) apa pun; blokir yang masih menahan tidak digandakan; kunci yang
 * sudah diputuskan salah sasaran tidak membuka ulang.
 */
export function shouldOpenScreeningBlock(existing: BlockLite[], newKeys: string[]): boolean {
  if (!newKeys.length) return false;
  if (hasActiveBlock(existing)) return false;
  const cleared = new Set(existing.filter((block) => block.status === "FALSE_POSITIVE").flatMap((block) => parseMatchKeys(block.matchKeys)));
  return newKeys.some((key) => !cleared.has(key));
}

export type AttemptLineSummary = { currencyId: number; currencyCode: string | null; foreignAmount: string; idrAmount: string };

const toCents = (value: number) => (Number.isFinite(value) ? Math.round(value * 100) : 0);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

/**
 * Ringkasan percobaan dari masukan bon apa adanya. Baris cacat tetap tercatat dengan nol — gagal
 * mencatat percobaan karena masukannya cacat berarti justru percobaan itulah yang hilang.
 */
export function summarizeAttemptLines(
  lines: { currencyId: number; denominations: { value: string; quantity: number; rate: string }[] }[],
  codeById: Map<number, string>,
): { lines: AttemptLineSummary[]; totalIdr: string } {
  let totalCents = 0;
  const summaries = lines.map((line) => {
    let foreignCents = 0;
    let idrCents = 0;
    for (const denomination of line.denominations ?? []) {
      const foreign = Number(denomination.value) * Number(denomination.quantity);
      foreignCents += toCents(foreign);
      idrCents += toCents(foreign * Number(denomination.rate));
    }
    totalCents += idrCents;
    return { currencyId: line.currencyId, currencyCode: codeById.get(line.currencyId) ?? null, foreignAmount: fromCents(foreignCents), idrAmount: fromCents(idrCents) };
  });
  return { lines: summaries, totalIdr: fromCents(totalCents) };
}
```

Catatan: uji `summarizeAttemptLines` memakai `toEqual` tanpa `rate`; ringkasan tidak menyimpan kurs per baris karena satu baris bisa punya beberapa kurs per pecahan — **ubah spec** kolom `linesSummary` menjadi "kode valuta, jumlah valas, jumlah Rupiah" pada commit tugas ini (kurs tetap dapat dibaca dari jumlah).

- [ ] **Step 4:** `./node_modules/.bin/vitest run shared/watchlistBlock.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add shared/watchlistBlock.* docs/superpowers/specs/2026-09-28-butir-b-sebelum-desktop-design.md && git commit -m "Aturan murni pemblokiran DTTOT/DPPSPM"`

---

### Tugas 3: Penulis blokir dan kaitannya ke penyaringan serta centang petugas

**Files:**
- Create: `server/watchlistBlocks.ts`
- Modify: `server/customerWatchlistScreening.ts` (`screenCustomer`, `rescreenAllCustomers`), `server/operations.ts` (`createCustomer` sesudah insert, `updateCustomer` sesudah update)
- Test: `server/watchlistBlocks.test.ts`

**Interfaces:**
- Consumes: `matchKeyOf`, `shouldOpenScreeningBlock`, `hasActiveBlock` (Tugas 2); `watchlistBlocks` (Tugas 1).
- Produces:
  - `openBlockFromScreening(input: { customerId: number; screeningId: number | null; matchKeys: string[] }): Promise<boolean>`
  - `openBlocksForScreenings(rows: { customerId: number; screeningId: number | null; matchKeys: string[] }[]): Promise<number>`
  - `openOfficerBlock(customerId: number): Promise<boolean>`
  - `activeBlockFor(customerIds: number[]): Promise<Map<number, WatchlistBlock>>`

- [x] **Step 1: Uji yang gagal** — memakai pola `mockDb`/`makeReader` yang disalin dari `server/customerWatchlistScreening.test.ts` (salin fungsi `boundValues`, `makeReader`, `tableName`, `mockDb` apa adanya ke berkas uji ini; `mockDb` menangkap `inserted`).

```ts
describe("openBlockFromScreening", () => {
  it("membuka blokir OPEN bersumber PENYARINGAN dengan kuncinya", async () => {
    const { inserted } = mockDb({ watchlist_blocks: [] });
    expect(await openBlockFromScreening({ customerId: 7, screeningId: 40, matchKeys: ["DTTOT:IDN-001"] })).toBe(true);
    const row = inserted.find((entry) => entry.table === "watchlist_blocks")!;
    expect(row.values).toMatchObject({ customerId: 7, screeningId: 40, source: "PENYARINGAN", status: "OPEN", matchKeys: "[\"DTTOT:IDN-001\"]" });
    expect(row.values.openedAt).toBeInstanceOf(Date);
  });
  it("tidak membuka kedua kalinya selama blokir masih OPEN", async () => {
    const { inserted } = mockDb({ watchlist_blocks: [{ id: 1, customerId: 7, status: "OPEN", matchKeys: null }] });
    expect(await openBlockFromScreening({ customerId: 7, screeningId: 41, matchKeys: ["DTTOT:IDN-001"] })).toBe(false);
    expect(inserted.filter((entry) => entry.table === "watchlist_blocks")).toHaveLength(0);
  });
});

describe("openOfficerBlock", () => {
  it("membuka blokir PETUGAS tanpa kunci", async () => {
    const { inserted } = mockDb({ watchlist_blocks: [] });
    expect(await openOfficerBlock(9)).toBe(true);
    expect(inserted[0].values).toMatchObject({ customerId: 9, source: "PETUGAS", status: "OPEN", matchKeys: null, screeningId: null });
  });
});

describe("screenCustomer membuka blokir", () => {
  it("penyaringan dengan kecocokan membuka blokir; nihil tidak", async () => {
    const { inserted } = mockDb({ sanctions_watchlist_entries: [entriDaftar()], watchlist_blocks: [] });
    await screenCustomer({ customerId: 7, fullName: "ABDUL RAHMAN SALEH", trigger: "NASABAH_DIBUAT", screenedByUserId: 3 });
    expect(inserted.filter((entry) => entry.table === "watchlist_blocks")).toHaveLength(1);
    const second = mockDb({ sanctions_watchlist_entries: [entriDaftar()], watchlist_blocks: [] });
    await screenCustomer({ customerId: 8, fullName: "BUDI SANTOSO WIJAYA", trigger: "NASABAH_DIBUAT", screenedByUserId: 3 });
    expect(second.inserted.filter((entry) => entry.table === "watchlist_blocks")).toHaveLength(0);
  });
});

describe("rescreenAllCustomers membuka blokir hanya bagi yang cocok", () => {
  it("dua nasabah, satu cocok → satu blokir, blokir dibaca sekali", async () => {
    const { inserted } = mockDb({
      sanctions_watchlist_entries: [entriDaftar()],
      customers: [{ id: 7, fullName: "ABDUL RAHMAN SALEH" }, { id: 8, fullName: "BUDI SANTOSO WIJAYA" }],
      watchlist_blocks: [],
      customer_watchlist_screenings: [],
    });
    await rescreenAllCustomers();
    const blocks = inserted.filter((entry) => entry.table === "watchlist_blocks");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].values).toMatchObject({ customerId: 7 });
  });
});
```

(`mockDb` pada uji ini mengembalikan `values` yang mendukung larik: dorong satu entri `inserted` per baris bila `values` berupa larik.)

- [x] **Step 2:** `./node_modules/.bin/vitest run server/watchlistBlocks.test.ts` → FAIL.

- [x] **Step 3: `server/watchlistBlocks.ts`**

```ts
import { and, eq, inArray } from "drizzle-orm";
import { watchlistBlocks, type WatchlistBlock } from "../drizzle/schema";
import { hasActiveBlock, shouldOpenScreeningBlock, type BlockLite } from "../shared/watchlistBlock";
import { getDb } from "./db";

/**
 * Penulis `watchlist_blocks` — pemblokiran serta merta atas kecocokan DTTOT/DPPSPM (Pasal 47 ayat
 * (1) huruf d PBI 10/2024). Membuka saja; menutup adalah keputusan manusia (`resolveWatchlistBlock`).
 */

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Basis data tidak tersedia.");
  return db;
}

async function blocksOf(customerIds: number[]) {
  if (!customerIds.length) return [] as WatchlistBlock[];
  const db = await databaseOrThrow();
  return db.select().from(watchlistBlocks).where(inArray(watchlistBlocks.customerId, customerIds));
}

export async function openBlocksForScreenings(rows: { customerId: number; screeningId: number | null; matchKeys: string[] }[]): Promise<number> {
  const candidates = rows.filter((row) => row.matchKeys.length > 0);
  if (!candidates.length) return 0;
  const existing = await blocksOf(candidates.map((row) => row.customerId));
  const openedAt = new Date();
  const toInsert = candidates
    .filter((row) => shouldOpenScreeningBlock(existing.filter((block) => block.customerId === row.customerId) as BlockLite[], row.matchKeys))
    .map((row) => ({ customerId: row.customerId, openedAt, source: "PENYARINGAN" as const, screeningId: row.screeningId, matchKeys: JSON.stringify(row.matchKeys), status: "OPEN" as const }));
  if (!toInsert.length) return 0;
  const db = await databaseOrThrow();
  await db.insert(watchlistBlocks).values(toInsert);
  return toInsert.length;
}

export async function openBlockFromScreening(input: { customerId: number; screeningId: number | null; matchKeys: string[] }): Promise<boolean> {
  return (await openBlocksForScreenings([input])) > 0;
}

export async function openOfficerBlock(customerId: number): Promise<boolean> {
  const existing = await blocksOf([customerId]);
  if (hasActiveBlock(existing as BlockLite[])) return false;
  const db = await databaseOrThrow();
  await db.insert(watchlistBlocks).values({ customerId, openedAt: new Date(), source: "PETUGAS", screeningId: null, matchKeys: null, status: "OPEN" });
  return true;
}

/** Blokir yang masih menahan (OPEN/CONFIRMED) per nasabah — yang terbaru bila lebih dari satu. */
export async function activeBlockFor(customerIds: number[]): Promise<Map<number, WatchlistBlock>> {
  const result = new Map<number, WatchlistBlock>();
  for (const block of await blocksOf(customerIds)) {
    if (block.status !== "OPEN" && block.status !== "CONFIRMED") continue;
    const current = result.get(block.customerId);
    if (!current || current.id < block.id) result.set(block.customerId, block);
  }
  return result;
}
```

- [x] **Step 4: Kaitkan ke `screenCustomer`** — ganti `await db.insert(customerWatchlistScreenings).values({...})` dengan:

```ts
  const insertResult = await db.insert(customerWatchlistScreenings).values({ /* isi yang sama */ });
  // mysql2 mengembalikan [ResultSetHeader]; basis data palsu uji tidak — id penyaringan boleh null.
  const screeningId = Number((insertResult as unknown as [{ insertId?: number }] | undefined)?.[0]?.insertId) || null;
  await openBlockFromScreening({ customerId: result.customerId, screeningId, matchKeys: matches.map(matchKeyOf) });
```

dan di `rescreenAllCustomers`, simpan kunci per baris (`matchKeys: matches.map(matchKeyOf)` pada objek sementara, dibuang sebelum insert), lalu sesudah loop insert:

```ts
  const matched = keyed.filter((row) => row.matchKeys.length > 0);
  if (matched.length) {
    const screeningRows = await db.select({ id: customerWatchlistScreenings.id, customerId: customerWatchlistScreenings.customerId })
      .from(customerWatchlistScreenings)
      .where(and(inArray(customerWatchlistScreenings.customerId, matched.map((row) => row.customerId)), eq(customerWatchlistScreenings.screenedAt, screenedAt)));
    const idByCustomer = new Map(screeningRows.map((row) => [row.customerId, row.id]));
    await openBlocksForScreenings(matched.map((row) => ({ customerId: row.customerId, screeningId: idByCustomer.get(row.customerId) ?? null, matchKeys: row.matchKeys })));
  }
```

Tambahkan impor `inArray` dan `matchKeyOf`, `openBlockFromScreening`, `openBlocksForScreenings`.

- [x] **Step 5: Kaitkan ke centang petugas** — di `server/operations.ts`:
  - `createCustomer`, tepat sebelum `await screenCustomerAfterSave(created, ...)`: `if (created.dttotPpsdmMatch) await openOfficerBlock(created.id);`
  - `updateCustomer`, tepat sebelum `await screenCustomerAfterSave(updated, ...)`: `if (!existing.dttotPpsdmMatch && updated.dttotPpsdmMatch) await openOfficerBlock(updated.id);`

- [x] **Step 6:** `./node_modules/.bin/vitest run server/watchlistBlocks.test.ts server/customerWatchlistScreening.test.ts server/customerUpdate.test.ts server/customerRelationshipEnd.test.ts` → PASS (uji lama yang memalsukan `getDb` tanpa tabel `watchlist_blocks` membaca `[]` — tetap lulus).
- [x] **Step 7: Commit** — `"Blokir dibuka oleh penyaringan dan centang petugas"`

---

### Tugas 4: Gerbang bon dan pencatatan percobaan

**Files:** Modify `server/operations.ts` (`createTransaction`), Modify `server/watchlistBlocks.ts` (tambah `recordAttempt`), Test `server/watchlistBlockGate.test.ts`

**Interfaces — Produces:** `recordAttempt(input: { block: WatchlistBlock; blockedParty: "NASABAH" | "KUASA"; customerId: number; representativeCustomerId: number | null; tellerUserId: number; operation: "BUY" | "SELL"; lines: CreateTransactionInput["lines"] }): Promise<void>`

- [x] **Step 1: Uji yang gagal** — pola `mockTopLevelDb` dari `server/createTransactionValidation.test.ts`, diperluas dengan `insert` yang mencatat:

```ts
import { describe, expect, it, vi } from "vitest";
import { attemptedTransactions, currencies, customers, exchangeTransactions, watchlistBlocks } from "../drizzle/schema";
import * as db from "./db";
import { createTransaction } from "./operations";

function chain(rows: unknown[]): any {
  const self = { from: () => self, where: () => self, orderBy: () => self, limit: () => self, innerJoin: () => self,
    then: (ok: any, ko: any) => Promise.resolve(rows).then(ok, ko) };
  return self;
}
function mockDb(rowsByTable: Map<unknown, unknown[]>) {
  const inserted: { table: unknown; values: any }[] = [];
  const fakeDb = {
    select: () => ({ from: (table: unknown) => chain(rowsByTable.get(table) ?? []) }),
    insert: (table: unknown) => ({ values: async (values: unknown) => { inserted.push({ table, values }); } }),
    transaction: vi.fn(async () => { throw new Error("bon tidak boleh sampai ke transaksi basis data"); }),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { inserted, fakeDb };
}

const customer = { id: 1, isDemo: false, isHistorical: false, profileStatus: "ACTIVE", fullName: "Abdul", riskLevel: "LOW", highRiskDecision: "BELUM" };
const input = {
  operation: "BUY" as const, customerId: 1, receiptNumber: "77",
  lines: [{ currencyId: 2, denominations: [{ value: "100", quantity: 2, rate: "16000" }] }],
  paymentMethod: "CASH" as const, transactionAt: new Date("2026-09-28T03:00:00Z"),
};
const openBlock = { id: 5, customerId: 1, status: "OPEN", matchKeys: null };

describe("createTransaction — nasabah terblokir", () => {
  it("menolak dengan pesan netral dan mencatat percobaan, tanpa membuka transaksi bon", async () => {
    const { inserted, fakeDb } = mockDb(new Map<unknown, unknown[]>([[customers, [customer]], [watchlistBlocks, [openBlock]], [currencies, [{ id: 2, code: "USD" }]]]));
    await expect(createTransaction(input as never, 9)).rejects.toThrow("Transaksi tidak dapat diproses. Hubungi Controller. Jangan sampaikan alasannya kepada nasabah.");
    const attempt = inserted.find((row) => row.table === attemptedTransactions)!;
    expect(attempt.values).toMatchObject({ blockId: 5, customerId: 1, blockedParty: "NASABAH", tellerUserId: 9, operation: "BUY", totalIdr: "3200000.00" });
    expect(inserted.every((row) => row.table === attemptedTransactions)).toBe(true);
    expect(fakeDb.transaction).not.toHaveBeenCalled();
  });

  it("persetujuan risiko tinggi tidak meloloskan nasabah terblokir", async () => {
    const approved = { ...customer, riskLevel: "HIGH", highRiskDecision: "DISETUJUI", dttotPpsdmMatch: true };
    const { inserted } = mockDb(new Map<unknown, unknown[]>([[customers, [approved]], [watchlistBlocks, [{ ...openBlock, status: "CONFIRMED" }]], [currencies, []]]));
    await expect(createTransaction(input as never, 9)).rejects.toThrow(/Hubungi Controller/);
    expect(inserted).toHaveLength(1);
  });

  it("pihak kuasa terblokir, nasabah bersih → tetap ditolak dengan blockedParty KUASA", async () => {
    const representative = { ...customer, id: 2 };
    const rows = new Map<unknown, unknown[]>([[customers, [customer, representative]], [watchlistBlocks, [{ ...openBlock, customerId: 2 }]], [currencies, []]]);
    const { inserted } = mockDb(rows);
    await expect(createTransaction({ ...input, customerActingAs: "REPRESENTATIVE", representativeCustomerId: 2 } as never, 9)).rejects.toThrow(/Hubungi Controller/);
    expect(inserted[0].values).toMatchObject({ blockedParty: "KUASA", representativeCustomerId: 2 });
  });

  it("blokir FALSE_POSITIVE tidak menahan (galat berikutnya bukan pesan blokir)", async () => {
    mockDb(new Map<unknown, unknown[]>([[customers, [customer]], [watchlistBlocks, [{ ...openBlock, status: "FALSE_POSITIVE" }]], [exchangeTransactions, []], [currencies, []]]));
    await expect(createTransaction({ ...input, lines: [] } as never, 9)).rejects.toThrow(/minimal satu baris/);
  });
});
```

Catatan: `chain(...).where` pada mock ini mengabaikan klausa; baris kuasa dipilih lewat `representativeCustomerId`. Bila mock `customers` mengembalikan kedua baris untuk pemilihan nasabah utama, `[0]` = nasabah — urutan larik di atas sudah benar.

- [x] **Step 2:** `./node_modules/.bin/vitest run server/watchlistBlockGate.test.ts` → FAIL.

- [x] **Step 3: `recordAttempt` di `server/watchlistBlocks.ts`**

```ts
export async function recordAttempt(input: {
  block: WatchlistBlock; blockedParty: "NASABAH" | "KUASA"; customerId: number; representativeCustomerId: number | null;
  tellerUserId: number; operation: "BUY" | "SELL";
  lines: { currencyId: number; denominations: { value: string; quantity: number; rate: string }[] }[];
}): Promise<void> {
  const db = await databaseOrThrow();
  const currencyIds = Array.from(new Set((input.lines ?? []).map((line) => line.currencyId).filter((id) => Number.isInteger(id))));
  const currencyRows = currencyIds.length ? await db.select({ id: currencies.id, code: currencies.code }).from(currencies).where(inArray(currencies.id, currencyIds)) : [];
  const summary = summarizeAttemptLines(input.lines ?? [], new Map(currencyRows.map((row) => [row.id, row.code])));
  await db.insert(attemptedTransactions).values({
    blockId: input.block.id, customerId: input.customerId, representativeCustomerId: input.representativeCustomerId,
    blockedParty: input.blockedParty, tellerUserId: input.tellerUserId, attemptedAt: new Date(),
    operation: input.operation, linesSummary: JSON.stringify(summary.lines), totalIdr: summary.totalIdr,
  });
}
```

- [x] **Step 4: Gerbang di `createTransaction`** — tepat sesudah `if (customer.profileStatus === "INACTIVE") ...` dan **sebelum** `customerHighRiskDenial`:

```ts
  // Pemblokiran serta merta — Pasal 47 ayat (1) huruf d PBI 10/2024. Diperiksa sebelum gerbang
  // risiko tinggi: persetujuan Pemegang Saham tidak dapat meloloskan kecocokan nama. Percobaannya
  // dicatat lebih dulu, di luar transaksi basis data bon, supaya tetap ada walau bon ditolak.
  const representativeId = input.customerActingAs === "REPRESENTATIVE" ? input.representativeCustomerId ?? null : null;
  const activeBlocks = await activeBlockFor(representativeId ? [customer.id, representativeId] : [customer.id]);
  const heldBy = activeBlocks.get(customer.id) ? { block: activeBlocks.get(customer.id)!, party: "NASABAH" as const }
    : representativeId && activeBlocks.get(representativeId) ? { block: activeBlocks.get(representativeId)!, party: "KUASA" as const } : null;
  if (heldBy) {
    try {
      await recordAttempt({ block: heldBy.block, blockedParty: heldBy.party, customerId: customer.id, representativeCustomerId: representativeId, tellerUserId, operation: input.operation, lines: input.lines ?? [] });
    } catch (error) {
      console.error("[pemblokiran] percobaan transaksi gagal dicatat", error);
    }
    throw new Error(WATCHLIST_BLOCK_TELLER_MESSAGE);
  }
```

Impor `activeBlockFor`, `recordAttempt` dari `./watchlistBlocks` dan `WATCHLIST_BLOCK_TELLER_MESSAGE` dari `../shared/watchlistBlock`.

- [x] **Step 5:** `./node_modules/.bin/vitest run server/watchlistBlockGate.test.ts server/createTransactionValidation.test.ts` lalu seluruh berkas yang memanggil `createTransaction` (`grep -l createTransaction server/*.test.ts`) → PASS.
- [x] **Step 6: Commit** — `"Bon nasabah terblokir ditolak netral dan percobaannya dicatat"`

---

### Tugas 5: Keputusan atas blokir, register, dan router

**Files:** Modify `server/watchlistBlocks.ts`, Modify `server/routers.ts` (router `watchlistBlocks`), Test `server/watchlistBlockDecision.test.ts`

**Interfaces — Produces:**
- `watchlistBlockDenial(user: { role: BackOfficeRole }): { message: string } | null`
- `resolveWatchlistBlock(input: { blockId: number; decision: "CONFIRMED" | "FALSE_POSITIVE"; notes: string; ltkmReference?: string | null; biCopySentAt?: Date | null }, actor: { id: number }): Promise<WatchlistBlock>`
- `recordWatchlistBlockReporting(input: { blockId: number; ltkmReference: string; biCopySentAt: Date }, actor: { id: number }): Promise<WatchlistBlock>`
- `revokeWatchlistBlock(input: { blockId: number; revocationReference: string; notes: string }, actor: { id: number }): Promise<WatchlistBlock>`
- `listWatchlistBlocks(): Promise<Array<WatchlistBlock & { customerName: string; cifNumber: string | null; attempts: AttemptedTransaction[] }>>`
- tRPC: `watchlistBlocks.list` (query), `.resolve`, `.recordReporting`, `.revoke` (mutation) — semuanya `controllerProcedure` + `watchlistBlockDenial`.

- [x] **Step 1: Uji yang gagal**

```ts
describe("watchlistBlockDenial", () => {
  it("hanya CONTROLLER ke atas", () => {
    expect(watchlistBlockDenial({ role: "ADMIN" })).not.toBeNull();
    expect(watchlistBlockDenial({ role: "CONTROLLER" })).toBeNull();
    expect(watchlistBlockDenial({ role: "SHAREHOLDER" })).toBeNull();
  });
});

describe("resolveWatchlistBlock", () => {
  it("CONFIRMED menyetel dttotPpsdmMatch dan menulis audit", async () => {
    const { updates, inserted } = mockDb({ watchlist_blocks: [{ id: 5, customerId: 1, status: "OPEN", matchKeys: null, source: "PENYARINGAN" }], customers: [{ id: 1, dttotPpsdmMatch: false, dttotPpsdmNotes: null }] });
    await resolveWatchlistBlock({ blockId: 5, decision: "CONFIRMED", notes: "Tanggal lahir dan NIK sama dengan entri IDN-001" }, { id: 3 });
    expect(updates.find((row) => row.table === "watchlist_blocks")!.set).toMatchObject({ status: "CONFIRMED", resolvedByUserId: 3 });
    expect(updates.find((row) => row.table === "customers")!.set).toMatchObject({ dttotPpsdmMatch: true });
    expect(inserted.find((row) => row.table === "audit_logs")!.values).toMatchObject({ action: "WATCHLIST_BLOCK_CONFIRMED", entityType: "watchlist_block", entityId: "5" });
  });
  it("FALSE_POSITIVE blokir PETUGAS membersihkan centangnya", async () => {
    const { updates } = mockDb({ watchlist_blocks: [{ id: 6, customerId: 1, status: "OPEN", matchKeys: null, source: "PETUGAS" }], customers: [{ id: 1, dttotPpsdmMatch: true, dttotPpsdmNotes: "x" }] });
    await resolveWatchlistBlock({ blockId: 6, decision: "FALSE_POSITIVE", notes: "Beda tanggal lahir" }, { id: 3 });
    expect(updates.find((row) => row.table === "customers")!.set).toMatchObject({ dttotPpsdmMatch: false });
  });
  it("menolak catatan kosong dan blokir yang sudah diputuskan", async () => {
    mockDb({ watchlist_blocks: [{ id: 5, customerId: 1, status: "CONFIRMED", matchKeys: null, source: "PENYARINGAN" }], customers: [] });
    await expect(resolveWatchlistBlock({ blockId: 5, decision: "FALSE_POSITIVE", notes: "   " }, { id: 3 })).rejects.toThrow(/Catatan/);
    await expect(resolveWatchlistBlock({ blockId: 5, decision: "FALSE_POSITIVE", notes: "alasan cukup" }, { id: 3 })).rejects.toThrow(/sudah diputuskan/);
  });
});

describe("revokeWatchlistBlock", () => {
  it("hanya dari CONFIRMED dan wajib rujukan surat", async () => {
    mockDb({ watchlist_blocks: [{ id: 5, customerId: 1, status: "OPEN", matchKeys: null }], customers: [] });
    await expect(revokeWatchlistBlock({ blockId: 5, revocationReference: "S-1/2026", notes: "dicabut" }, { id: 3 })).rejects.toThrow(/Hanya blokir yang dikonfirmasi/);
  });
});
```

(`mockDb` di sini mencatat `updates: { table, set }[]` dari `update(table).set(values).where()`.)

- [x] **Step 2:** `./node_modules/.bin/vitest run server/watchlistBlockDecision.test.ts` → FAIL.

- [x] **Step 3: Implementasi di `server/watchlistBlocks.ts`**

```ts
const MIN_NOTE = 3;
const requireNote = (value: string | null | undefined, label: string) => {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < MIN_NOTE) throw new Error(`${label} wajib diisi.`);
  return trimmed;
};

export function watchlistBlockDenial(user: { role: BackOfficeRole }) {
  return isRoleAllowed(user.role, "CONTROLLER") ? null : { message: "Keputusan pemblokiran hanya untuk Controller ke atas." };
}

async function loadBlock(blockId: number) {
  const db = await databaseOrThrow();
  const [block] = await db.select().from(watchlistBlocks).where(eq(watchlistBlocks.id, blockId)).limit(1);
  if (!block) throw new Error("Pemblokiran tidak ditemukan.");
  return { db, block };
}

async function audit(db: Awaited<ReturnType<typeof databaseOrThrow>>, actorUserId: number, action: string, block: WatchlistBlock, afterState: Record<string, unknown>) {
  await db.insert(auditLogs).values({ actorUserId, action, entityType: "watchlist_block", entityId: String(block.id), beforeState: { status: block.status }, afterState });
}

export async function resolveWatchlistBlock(input: { blockId: number; decision: "CONFIRMED" | "FALSE_POSITIVE"; notes: string; ltkmReference?: string | null; biCopySentAt?: Date | null }, actor: { id: number }) {
  const notes = requireNote(input.notes, "Catatan keputusan");
  const { db, block } = await loadBlock(input.blockId);
  if (block.status !== "OPEN") throw new Error("Pemblokiran ini sudah diputuskan.");
  const resolvedAt = new Date();
  const next = { status: input.decision, resolvedByUserId: actor.id, resolvedAt, resolutionNotes: notes,
    ...(input.decision === "CONFIRMED" ? { ltkmReference: input.ltkmReference?.trim() || null, biCopySentAt: input.biCopySentAt ?? null } : {}) };
  await db.update(watchlistBlocks).set(next).where(eq(watchlistBlocks.id, block.id));
  if (input.decision === "CONFIRMED") {
    await db.update(customers).set({ dttotPpsdmMatch: true, dttotPpsdmNotes: `Dikonfirmasi pada pemblokiran #${block.id}: ${notes}` }).where(eq(customers.id, block.customerId));
  } else if (block.source === "PETUGAS") {
    await db.update(customers).set({ dttotPpsdmMatch: false, dttotPpsdmNotes: null }).where(eq(customers.id, block.customerId));
  }
  await audit(db, actor.id, input.decision === "CONFIRMED" ? "WATCHLIST_BLOCK_CONFIRMED" : "WATCHLIST_BLOCK_FALSE_POSITIVE", block, next);
  return { ...block, ...next } as WatchlistBlock;
}

export async function recordWatchlistBlockReporting(input: { blockId: number; ltkmReference: string; biCopySentAt: Date }, actor: { id: number }) {
  const ltkmReference = requireNote(input.ltkmReference, "Rujukan LTKM");
  const { db, block } = await loadBlock(input.blockId);
  if (block.status !== "CONFIRMED") throw new Error("Pelaporan hanya dicatat pada blokir yang dikonfirmasi.");
  if (input.biCopySentAt.getTime() > Date.now()) throw new Error("Tanggal tembusan tidak boleh di masa depan.");
  const next = { ltkmReference, biCopySentAt: input.biCopySentAt };
  await db.update(watchlistBlocks).set(next).where(eq(watchlistBlocks.id, block.id));
  await audit(db, actor.id, "WATCHLIST_BLOCK_REPORTED", block, next);
  return { ...block, ...next } as WatchlistBlock;
}

export async function revokeWatchlistBlock(input: { blockId: number; revocationReference: string; notes: string }, actor: { id: number }) {
  const revocationReference = requireNote(input.revocationReference, "Rujukan surat pencabutan");
  const notes = requireNote(input.notes, "Catatan");
  const { db, block } = await loadBlock(input.blockId);
  if (block.status !== "CONFIRMED") throw new Error("Hanya blokir yang dikonfirmasi yang dapat dicabut.");
  const next = { status: "DICABUT" as const, revocationReference, resolutionNotes: `${block.resolutionNotes ?? ""}\n[Dicabut] ${notes}`.trim(), resolvedByUserId: actor.id, resolvedAt: new Date() };
  await db.update(watchlistBlocks).set(next).where(eq(watchlistBlocks.id, block.id));
  await audit(db, actor.id, "WATCHLIST_BLOCK_REVOKED", block, next);
  return { ...block, ...next } as WatchlistBlock;
}

export async function listWatchlistBlocks() {
  const db = await databaseOrThrow();
  const rows = await db.select({ block: watchlistBlocks, customerName: customers.fullName, cifNumber: customers.cifNumber })
    .from(watchlistBlocks).innerJoin(customers, eq(watchlistBlocks.customerId, customers.id)).orderBy(desc(watchlistBlocks.openedAt));
  const ids = rows.map((row) => row.block.id);
  const attempts = ids.length ? await db.select().from(attemptedTransactions).where(inArray(attemptedTransactions.blockId, ids)).orderBy(desc(attemptedTransactions.attemptedAt)) : [];
  return rows.map((row) => ({ ...row.block, customerName: row.customerName, cifNumber: row.cifNumber, attempts: attempts.filter((attempt) => attempt.blockId === row.block.id) }));
}
```

Impor tambahan: `desc` dari drizzle-orm; `attemptedTransactions`, `auditLogs`, `currencies`, `customers` dari skema; `isRoleAllowed`, `BackOfficeRole` dari `../shared/backOfficeNavigation`; `summarizeAttemptLines` dari `../shared/watchlistBlock`.

- [x] **Step 4: Router** — di `server/routers.ts`, sesudah `sanctionsWatchlist`:

```ts
  /** Pemblokiran atas kecocokan DTTOT/DPPSPM — Pasal 47 ayat (1) huruf d PBI 10/2024. */
  watchlistBlocks: router({
    list: controllerProcedure.query(({ ctx }) => {
      const denial = watchlistBlockDenial(ctx.user);
      if (denial) throw new TRPCError({ code: "FORBIDDEN", message: denial.message });
      return listWatchlistBlocks();
    }),
    resolve: controllerProcedure
      .input(z.object({ blockId: z.number().int().positive(), decision: z.enum(["CONFIRMED", "FALSE_POSITIVE"]), notes: z.string().trim().min(3).max(2000), ltkmReference: z.string().trim().max(200).nullish(), biCopySentAt: z.coerce.date().nullish() }))
      .mutation(({ input, ctx }) => {
        const denial = watchlistBlockDenial(ctx.user);
        if (denial) throw new TRPCError({ code: "FORBIDDEN", message: denial.message });
        return resolveWatchlistBlock(input, ctx.user);
      }),
    recordReporting: controllerProcedure
      .input(z.object({ blockId: z.number().int().positive(), ltkmReference: z.string().trim().min(3).max(200), biCopySentAt: z.coerce.date() }))
      .mutation(({ input, ctx }) => {
        const denial = watchlistBlockDenial(ctx.user);
        if (denial) throw new TRPCError({ code: "FORBIDDEN", message: denial.message });
        return recordWatchlistBlockReporting(input, ctx.user);
      }),
    revoke: controllerProcedure
      .input(z.object({ blockId: z.number().int().positive(), revocationReference: z.string().trim().min(3).max(200), notes: z.string().trim().min(3).max(2000) }))
      .mutation(({ input, ctx }) => {
        const denial = watchlistBlockDenial(ctx.user);
        if (denial) throw new TRPCError({ code: "FORBIDDEN", message: denial.message });
        return revokeWatchlistBlock(input, ctx.user);
      }),
  }),
```

- [x] **Step 5:** `./node_modules/.bin/vitest run server/watchlistBlockDecision.test.ts && ./node_modules/.bin/tsc --noEmit` → PASS / keluar 0.
- [x] **Step 6: Commit** — `"Keputusan pemblokiran: konfirmasi, salah sasaran, pelaporan, pencabutan"`

---

### Tugas 6: Layar Register Pemblokiran dan butir Kesiapan Operasional

**Files:**
- Create: `client/src/pages/Pemblokiran.tsx`
- Modify: `client/src/App.tsx` (lazy + `<Route path="/kepatuhan/pemblokiran">` dengan `minimumRole="CONTROLLER"`), `shared/backOfficeNavigation.ts` (grup "Risiko": `{ label: "Pemblokiran", path: "/kepatuhan/pemblokiran", minimumRole: "CONTROLLER" }`), `shared/regulatoryActionQueue.ts` (`getWatchlistBlockActions`), `client/src/pages/OperationalReadiness.tsx`
- Test: `shared/watchlistBlockActions.test.ts`; `server/backOfficeNavigation.test.ts` diperbarui bila menghitung jumlah item

**Interfaces — Produces:** `getWatchlistBlockActions(blocks: { status: string; openedAt: Date | string; biCopySentAt: Date | string | null }[], timeZone?: string): { openCount: number; unreportedCount: number; oldestOpenDateKey: string | null; ready: boolean; detail: string }`

- [x] **Step 1: Uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { getWatchlistBlockActions } from "./regulatoryActionQueue";

describe("getWatchlistBlockActions", () => {
  it("siap bila tidak ada OPEN dan setiap CONFIRMED sudah ditembuskan", () => {
    expect(getWatchlistBlockActions([{ status: "FALSE_POSITIVE", openedAt: "2026-09-01T00:00:00Z", biCopySentAt: null }]).ready).toBe(true);
  });
  it("menghitung OPEN dan CONFIRMED tanpa tembusan; tenggat tidak dihitung", () => {
    const result = getWatchlistBlockActions([
      { status: "OPEN", openedAt: "2026-09-27T18:00:00Z", biCopySentAt: null },
      { status: "CONFIRMED", openedAt: "2026-09-20T03:00:00Z", biCopySentAt: null },
    ], "Asia/Jakarta");
    expect(result).toMatchObject({ openCount: 1, unreportedCount: 1, oldestOpenDateKey: "2026-09-28", ready: false });
    expect(result.detail).toContain("3 hari kerja");
  });
});
```

- [x] **Step 2:** `./node_modules/.bin/vitest run shared/watchlistBlockActions.test.ts` → FAIL.

- [x] **Step 3: `getWatchlistBlockActions`** di `shared/regulatoryActionQueue.ts`:

```ts
/**
 * Butir pemblokiran pada Kesiapan Operasional. Tenggat tembusan BI (Pasal 60 ayat (4) huruf d)
 * **tidak dihitung**: 3 hari kerja menuntut kalender hari libur yang belum ada (Temuan 6), dan
 * tenggat yang ditebak dari hari kalender tampak lebih longgar daripada kenyataannya.
 */
export function getWatchlistBlockActions(
  blocks: { status: string; openedAt: Date | string; biCopySentAt: Date | string | null }[],
  timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE,
) {
  const open = blocks.filter((block) => block.status === "OPEN");
  const unreported = blocks.filter((block) => block.status === "CONFIRMED" && !block.biCopySentAt);
  const oldest = open.map((block) => new Date(block.openedAt)).sort((a, b) => a.getTime() - b.getTime())[0];
  const oldestOpenDateKey = oldest ? operationalDateKey(oldest, timeZone) : null;
  const ready = open.length === 0 && unreported.length === 0;
  const parts: string[] = [];
  if (open.length) parts.push(`${open.length} pemblokiran menunggu keputusan (tertua ${oldestOpenDateKey})`);
  if (unreported.length) parts.push(`${unreported.length} pemblokiran dikonfirmasi belum ditembuskan ke BI`);
  const detail = ready ? "Tidak ada pemblokiran yang menunggu tindakan." : `${parts.join("; ")}. Tembusan BI paling lambat 3 hari kerja sejak pemblokiran.`;
  return { openCount: open.length, unreportedCount: unreported.length, oldestOpenDateKey, ready, detail };
}
```

- [x] **Step 4: `client/src/pages/Pemblokiran.tsx`** — halaman dengan pola `KlasifikasiRisiko.tsx` (Card, Badge, Dialog, Textarea, Input, Skeleton, `toast`):
  - `trpc.watchlistBlocks.list.useQuery()`; keadaan muat (`Skeleton`), galat (kartu merah "Register pemblokiran belum dapat dimuat" + tombol Coba lagi), kosong ("Belum ada pemblokiran. Blokir terbuka otomatis saat penyaringan menemukan kecocokan DTTOT/DPPSPM.").
  - Tab status: Menunggu keputusan (OPEN) · Dikonfirmasi · Salah sasaran · Dicabut; tiap baris: nasabah + CIF, dibuka (tanggal WIB), sumber, kunci kecocokan, jumlah percobaan; bagian yang dapat dibuka menampilkan percobaan (waktu, BUY/SELL, per valuta jumlah valas dan Rupiah, total).
  - Aksi OPEN: tombol **"Konfirmasi kecocokan"** dan **"Nyatakan salah sasaran"** membuka Dialog dengan `Textarea` catatan wajib; konfirmasi juga punya Input opsional rujukan LTKM dan tanggal tembusan.
  - Aksi CONFIRMED: **"Catat pelaporan LTKM/tembusan BI"** (rujukan + tanggal) dan **"Catat pencabutan oleh otoritas"** (rujukan surat + catatan).
  - Tiap mutasi: `onSuccess` → `toast.success`, `utils.watchlistBlocks.list.invalidate()`; `onError` → `toast.error(error.message)`; tombol `disabled` selama `isPending`.
  - Teks pembuka: "Pemblokiran serta merta atas kecocokan nama DTTOT/DPPSPM (Pasal 47 ayat (1) huruf d PBI 10/2024). Aplikasi tidak mengirim LTKM atau tembusan; yang dicatat di sini rujukannya."

- [x] **Step 5: Kesiapan Operasional** — di `OperationalReadiness.tsx` tambahkan `const blocks = trpc.watchlistBlocks.list.useQuery(undefined, { retry: false });`, `const blockActions = getWatchlistBlockActions(blocks.data ?? [], companyTimezone);`, dan kontrol baru:

```ts
    { label: "Pemblokiran DTTOT/DPPSPM", detail: blocks.isError ? "Status pemblokiran hanya terlihat oleh Controller ke atas." : blockActions.detail, ready: blockActions.ready, loading: blocks.isPending, unavailable: blocks.isError, icon: ShieldCheck, action: "Buka pemblokiran", path: "/kepatuhan/pemblokiran" },
```

- [x] **Step 6:** `./node_modules/.bin/vitest run shared/watchlistBlockActions.test.ts server/backOfficeNavigation.test.ts && ./node_modules/.bin/tsc --noEmit` → PASS / 0.
- [x] **Step 7: Commit** — `"Register Pemblokiran dan butirnya di Kesiapan Operasional"`

---

### Tugas 7: Aturan murni tinjauan klasifikasi (`shared/iraClassificationReview.ts`)

**Files:** Create `shared/iraClassificationReview.ts`, Test `shared/iraClassificationReview.test.ts`

**Interfaces — Produces:**
- `unclassifiedCodes(input: { currencyCodes: string[]; countryCodes: string[]; rows: { dimension: string; code: string; riskType: string }[] }): { dimension: string; code: string; riskType: string }[]`
- `getIraClassificationReviewDue(lastReviewedAt: Date | string | null, intervalMonths: number, now?: Date, timeZone?: string): { due: boolean; dueDateKey: string | null; detail: string }`

- [x] **Step 1: Uji yang gagal**

```ts
import { describe, expect, it } from "vitest";
import { getIraClassificationReviewDue, unclassifiedCodes } from "./iraClassificationReview";
import { IRA_DISTRIBUTION_CHANNELS, IRA_LEGAL_FORMS, IRA_OCCUPATION_CATEGORIES, IRA_PROVINCE_LABELS } from "./iraVocabulary";

describe("unclassifiedCodes", () => {
  const closedCount = (IRA_OCCUPATION_CATEGORIES.length + IRA_LEGAL_FORMS.length + Object.keys(IRA_PROVINCE_LABELS).length + IRA_DISTRIBUTION_CHANNELS.length) * 3;
  it("semesta kosong-klasifikasi = kosakata tertutup + valuta + negara nasabah, × 3 jenis risiko", () => {
    expect(unclassifiedCodes({ currencyCodes: ["USD"], countryCodes: ["SG"], rows: [] })).toHaveLength(closedCount + 3 + 3);
  });
  it("baris yang ada mengurangi per jenis risiko", () => {
    const result = unclassifiedCodes({ currencyCodes: ["USD"], countryCodes: [], rows: [{ dimension: "CURRENCY", code: "USD", riskType: "TPPU" }] });
    expect(result.filter((item) => item.dimension === "CURRENCY").map((item) => item.riskType)).toEqual(["TPPT", "PPSPM"]);
  });
  it("IDR dan kode negara kosong tidak ikut semesta; duplikat dilebur", () => {
    const result = unclassifiedCodes({ currencyCodes: ["IDR", "USD", "USD"], countryCodes: ["", "sg", "SG"], rows: [] });
    expect(result.filter((item) => item.dimension === "CURRENCY")).toHaveLength(3);
    expect(result.filter((item) => item.dimension === "COUNTRY").map((item) => item.code)).toEqual(["SG", "SG", "SG"]);
  });
});

describe("getIraClassificationReviewDue", () => {
  it("belum pernah ditinjau → jatuh tempo", () => {
    expect(getIraClassificationReviewDue(null, 12, new Date("2026-09-28T03:00:00Z"))).toMatchObject({ due: true, dueDateKey: null });
  });
  it("tepat 12 bulan kemudian jatuh tempo pada hari yang sama (WIB)", () => {
    // Ditinjau 30 Sep 2025 01.00 WIB (= 29 Sep 18.00 UTC) → jatuh tempo 30 Sep 2026 WIB.
    const last = new Date("2025-09-29T18:00:00Z");
    expect(getIraClassificationReviewDue(last, 12, new Date("2026-09-29T16:59:00Z"), "Asia/Jakarta")).toMatchObject({ due: false, dueDateKey: "2026-09-30" });
    expect(getIraClassificationReviewDue(last, 12, new Date("2026-09-29T17:00:00Z"), "Asia/Jakarta")).toMatchObject({ due: true });
  });
  it("31 Januari + 1 bulan → akhir Februari, bukan Maret", () => {
    expect(getIraClassificationReviewDue(new Date("2026-01-31T05:00:00Z"), 1, new Date("2026-02-01T00:00:00Z"), "Asia/Jakarta").dueDateKey).toBe("2026-02-28");
  });
});
```

- [x] **Step 2:** `./node_modules/.bin/vitest run shared/iraClassificationReview.test.ts` → FAIL.

- [x] **Step 3: Implementasi**

```ts
import { DEFAULT_OPERATIONAL_TIMEZONE, operationalDateKey } from "./regulatoryActionQueue";
import { IRA_DISTRIBUTION_CHANNELS, IRA_LEGAL_FORMS, IRA_OCCUPATION_CATEGORIES, IRA_PROVINCE_LABELS } from "./iraVocabulary";

/**
 * Tinjauan berkala klasifikasi risiko IRA — Pasal 9 ayat (6) PBI 10/2024. Satu definisi "belum
 * diklasifikasi" untuk layar dan untuk server yang menolak pengesahan selama masih ada.
 */

const RISK_TYPES = ["TPPU", "TPPT", "PPSPM"] as const;
export type ClassificationKey = { dimension: string; code: string; riskType: string };

export function unclassifiedCodes(input: { currencyCodes: string[]; countryCodes: string[]; rows: ClassificationKey[] }): ClassificationKey[] {
  const clean = (values: string[]) => Array.from(new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean)));
  const universe: { dimension: string; codes: string[] }[] = [
    { dimension: "CURRENCY", codes: clean(input.currencyCodes).filter((code) => code !== "IDR") },
    { dimension: "OCCUPATION", codes: [...IRA_OCCUPATION_CATEGORIES] },
    { dimension: "LEGAL_FORM", codes: [...IRA_LEGAL_FORMS] },
    { dimension: "COUNTRY", codes: clean(input.countryCodes) },
    { dimension: "PROVINCE", codes: Object.keys(IRA_PROVINCE_LABELS) },
    { dimension: "DISTRIBUTION_CHANNEL", codes: [...IRA_DISTRIBUTION_CHANNELS] },
  ];
  const present = new Set(input.rows.map((row) => `${row.dimension}|${row.code}|${row.riskType}`));
  return universe.flatMap(({ dimension, codes }) => codes.flatMap((code) =>
    RISK_TYPES.filter((riskType) => !present.has(`${dimension}|${code}|${riskType}`)).map((riskType) => ({ dimension, code, riskType }))));
}

/** Tambah bulan pada tanggal kalender "YYYY-MM-DD", dijepit ke akhir bulan. */
function addMonthsToDateKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function getIraClassificationReviewDue(lastReviewedAt: Date | string | null, intervalMonths: number, now = new Date(), timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE) {
  if (!lastReviewedAt) return { due: true, dueDateKey: null, detail: "Klasifikasi risiko belum pernah ditinjau dan disahkan." };
  const dueDateKey = addMonthsToDateKey(operationalDateKey(new Date(lastReviewedAt), timeZone), intervalMonths);
  const todayKey = operationalDateKey(now, timeZone);
  const due = todayKey >= dueDateKey;
  return { due, dueDateKey, detail: due ? `Tinjauan klasifikasi risiko jatuh tempo sejak ${dueDateKey}.` : `Tinjauan berikutnya ${dueDateKey}.` };
}
```

- [x] **Step 4:** PASS. **Step 5: Commit** — `"Aturan murni tinjauan klasifikasi risiko"`

---

### Tugas 8: Pengesahan tinjauan, selang, dan layarnya

**Files:**
- Create: `server/iraClassificationReview.ts`
- Modify: `server/routers.ts` (`iraClassification.reviews`, `.review`, `.unclassified`, `.setReviewInterval`), `client/src/pages/KlasifikasiRisiko.tsx`, `client/src/pages/OperationalReadiness.tsx`
- Test: `server/iraClassificationReview.test.ts`

**Interfaces — Produces:**
- `listUnclassifiedCodes(): Promise<ClassificationKey[]>`
- `signClassificationReview(input: { notes: string }, actor: { id: number }): Promise<IraClassificationReview>`
- `listClassificationReviews(): Promise<{ reviews: IraClassificationReview[]; intervalMonths: number }>`
- `setClassificationReviewInterval(input: { months: number }, actor: { id: number }): Promise<{ months: number }>`

- [x] **Step 1: Uji yang gagal** (pola `mockDb` Tugas 3/5)

```ts
describe("signClassificationReview", () => {
  it("menolak selama masih ada kode belum diklasifikasi", async () => {
    mockDb({ ira_risk_classifications: [], currencies: [{ code: "USD", active: true }], customers: [] });
    await expect(signClassificationReview({ notes: "Tinjauan tahunan" }, { id: 3 })).rejects.toThrow(/belum diklasifikasi/);
  });
  it("mengesahkan dengan snapshot seluruh baris dan menulis audit", async () => {
    const rows = fullClassificationRows(); // helper di berkas uji: seluruh semesta × 3 untuk USD, tanpa negara
    const { inserted } = mockDb({ ira_risk_classifications: rows, currencies: [{ code: "USD", active: true }], customers: [] });
    await signClassificationReview({ notes: "Tidak ada perubahan SRA" }, { id: 3 });
    const review = inserted.find((row) => row.table === "ira_classification_reviews")!;
    expect(review.values).toMatchObject({ reviewedByUserId: 3, notes: "Tidak ada perubahan SRA", classificationCount: rows.length });
    expect(JSON.parse(review.values.snapshot as string)).toHaveLength(rows.length);
    expect(inserted.some((row) => row.table === "audit_logs" && row.values.action === "IRA_CLASSIFICATION_REVIEWED")).toBe(true);
  });
  it("catatan kosong ditolak", async () => {
    mockDb({ ira_risk_classifications: [], currencies: [], customers: [] });
    await expect(signClassificationReview({ notes: "  " }, { id: 3 })).rejects.toThrow(/Catatan/);
  });
});

describe("setClassificationReviewInterval", () => {
  it("hanya 1–36 bulan", async () => {
    mockDb({ operational_settings: [{ settingCode: "REVIEW_THRESHOLD" }] });
    await expect(setClassificationReviewInterval({ months: 0 }, { id: 3 })).rejects.toThrow(/1 sampai 36/);
    await expect(setClassificationReviewInterval({ months: 37 }, { id: 3 })).rejects.toThrow(/1 sampai 36/);
  });
});
```

`fullClassificationRows()` dibangun dari `IRA_OCCUPATION_CATEGORIES`, `IRA_LEGAL_FORMS`, `Object.keys(IRA_PROVINCE_LABELS)`, `IRA_DISTRIBUTION_CHANNELS`, dan `["USD"]` × `["TPPU","TPPT","PPSPM"]`, masing-masing `{ dimension, code, riskType, level: "RENDAH", sourceNote: "SRA 2026", updatedAt: new Date() }`.

- [x] **Step 2:** FAIL.

- [x] **Step 3: `server/iraClassificationReview.ts`**

```ts
import { desc, eq, isNotNull } from "drizzle-orm";
import { auditLogs, currencies, customers, iraClassificationReviews, iraRiskClassifications, operationalSettings } from "../drizzle/schema";
import { unclassifiedCodes } from "../shared/iraClassificationReview";
import { getDb } from "./db";

/** Pengesahan berkala klasifikasi risiko — Pasal 9 ayat (6) PBI 10/2024. */

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Basis data tidak tersedia.");
  return db;
}

export async function listUnclassifiedCodes() {
  const db = await databaseOrThrow();
  const [rows, currencyRows, countryRows] = await Promise.all([
    db.select({ dimension: iraRiskClassifications.dimension, code: iraRiskClassifications.code, riskType: iraRiskClassifications.riskType }).from(iraRiskClassifications),
    db.select({ code: currencies.code }).from(currencies).where(eq(currencies.active, true)),
    db.select({ nationality: customers.nationality }).from(customers).where(isNotNull(customers.nationality)),
  ]);
  return unclassifiedCodes({ currencyCodes: currencyRows.map((row) => row.code), countryCodes: countryRows.map((row) => row.nationality ?? ""), rows });
}

export async function signClassificationReview(input: { notes: string }, actor: { id: number }) {
  const notes = input.notes?.trim() ?? "";
  if (notes.length < 3) throw new Error("Catatan tinjauan wajib diisi.");
  const missing = await listUnclassifiedCodes();
  if (missing.length) throw new Error(`${missing.length} kode belum diklasifikasi — klasifikasikan dahulu sebelum mengesahkan tinjauan.`);
  const db = await databaseOrThrow();
  const rows = await db.select().from(iraRiskClassifications);
  const snapshot = rows.map((row) => ({ dimension: row.dimension, code: row.code, riskType: row.riskType, level: row.level, sourceNote: row.sourceNote, updatedAt: row.updatedAt }));
  const values = { reviewedAt: new Date(), reviewedByUserId: actor.id, notes, snapshot: JSON.stringify(snapshot), classificationCount: rows.length };
  await db.insert(iraClassificationReviews).values(values);
  await db.insert(auditLogs).values({ actorUserId: actor.id, action: "IRA_CLASSIFICATION_REVIEWED", entityType: "ira_classification_review", entityId: values.reviewedAt.toISOString(), afterState: { notes, classificationCount: rows.length } });
  return values;
}

async function reviewSettings(db: Awaited<ReturnType<typeof databaseOrThrow>>) {
  const [found] = await db.select().from(operationalSettings).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD")).limit(1);
  if (found) return found;
  await db.insert(operationalSettings).values({ settingCode: "REVIEW_THRESHOLD" });
  const [created] = await db.select().from(operationalSettings).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD")).limit(1);
  return created;
}

export async function listClassificationReviews() {
  const db = await databaseOrThrow();
  const reviews = await db.select().from(iraClassificationReviews).orderBy(desc(iraClassificationReviews.reviewedAt));
  const settings = await reviewSettings(db);
  return { reviews, intervalMonths: settings?.iraClassificationReviewMonths ?? 12 };
}

export async function setClassificationReviewInterval(input: { months: number }, actor: { id: number }) {
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 36) throw new Error("Selang tinjauan harus 1 sampai 36 bulan.");
  const db = await databaseOrThrow();
  const settings = await reviewSettings(db);
  await db.update(operationalSettings).set({ iraClassificationReviewMonths: input.months }).where(eq(operationalSettings.settingCode, "REVIEW_THRESHOLD"));
  await db.insert(auditLogs).values({ actorUserId: actor.id, action: "IRA_CLASSIFICATION_REVIEW_INTERVAL_SET", entityType: "operational_settings", entityId: "REVIEW_THRESHOLD", beforeState: { months: settings?.iraClassificationReviewMonths ?? 12 }, afterState: { months: input.months } });
  return { months: input.months };
}
```

- [x] **Step 4: Router** — di `iraClassification: router({...})` tambahkan (semuanya memeriksa `iraClassificationDenial` seperti `list`):

```ts
    unclassified: controllerProcedure.query(({ ctx }) => { const denial = iraClassificationDenial(ctx.user); if (denial) throw new TRPCError({ code: "FORBIDDEN", message: denial.message }); return listUnclassifiedCodes(); }),
    reviews: controllerProcedure.query(({ ctx }) => { const denial = iraClassificationDenial(ctx.user); if (denial) throw new TRPCError({ code: "FORBIDDEN", message: denial.message }); return listClassificationReviews(); }),
    review: controllerProcedure.input(z.object({ notes: z.string().trim().min(3).max(2000) })).mutation(({ input, ctx }) => { const denial = iraClassificationDenial(ctx.user); if (denial) throw new TRPCError({ code: "FORBIDDEN", message: denial.message }); return signClassificationReview(input, ctx.user); }),
    setReviewInterval: controllerProcedure.input(z.object({ months: z.number().int().min(1).max(36) })).mutation(({ input, ctx }) => { const denial = iraClassificationDenial(ctx.user); if (denial) throw new TRPCError({ code: "FORBIDDEN", message: denial.message }); return setClassificationReviewInterval(input, ctx.user); }),
```

- [x] **Step 5: Layar `KlasifikasiRisiko.tsx`** — kartu baru "Tinjauan berkala" di atas pemilih dimensi:
  - `trpc.iraClassification.unclassified.useQuery()` dan `.reviews.useQuery()`; tampilkan *"N kode belum diklasifikasi — saat ini dibaca RENDAH"* (N dari server, per dimensi dikelompokkan), tinjauan terakhir (tanggal WIB, peninjau id, catatan), dan "Tinjauan berikutnya …" dari `getIraClassificationReviewDue`.
  - Tombol **"Sahkan tinjauan klasifikasi"** membuka Dialog dengan `Textarea` catatan; `disabled` bila N > 0 dengan keterangan alasannya. Mutasi `review` → `toast`, invalidasi `reviews` dan `unclassified`.
  - Input selang (bulan, 1–36) + tombol **"Simpan selang"**.
  - Riwayat tinjauan: tabel ringkas; tiap baris punya tombol **"Unduh snapshot (JSON)"** yang membuat `Blob` dari `review.snapshot` dan mengunduh `klasifikasi-risiko-<tanggal>.json`.
  - Setelah `setClassification` berhasil, invalidasi juga `unclassified`.
  - Negara: kode dari server `unclassified` (dimensi COUNTRY) ikut ditampilkan pada `codesFor("COUNTRY")` supaya negara nasabah yang belum diklasifikasi dapat dipilih.

- [x] **Step 6: Kesiapan Operasional** — `const classificationReviews = trpc.iraClassification.reviews.useQuery(undefined, { retry: false });`, `const reviewDue = getIraClassificationReviewDue(classificationReviews.data?.reviews[0]?.reviewedAt ?? null, classificationReviews.data?.intervalMonths ?? 12, new Date(), companyTimezone);` dan kontrol `{ label: "Tinjauan klasifikasi risiko", detail: classificationReviews.isError ? "Status tinjauan hanya terlihat oleh Controller ke atas." : reviewDue.detail, ready: !reviewDue.due, loading: classificationReviews.isPending, unavailable: classificationReviews.isError, icon: ShieldCheck, action: "Buka klasifikasi", path: "/kepatuhan/klasifikasi-risiko" }`.

- [x] **Step 7:** `./node_modules/.bin/vitest run server/iraClassificationReview.test.ts shared/iraClassificationReview.test.ts && ./node_modules/.bin/tsc --noEmit` → PASS / 0.
- [x] **Step 8: Commit** — `"Tinjauan berkala klasifikasi risiko: pengesahan bersnapshot, selang, jatuh tempo"`

---

### Tugas 9: B4 — Controller mengisi tanggal berakhir hubungan

**Files:**
- Modify: `server/documentRetentionQueries.ts` (overview mengembalikan `inactiveWithoutEndDateCustomers`), Create fungsi `recordRelationshipEnd` di `server/documentRetentionQueries.ts`, Modify `server/routers.ts` (`recordRelationshipEnd` di router yang memuat `retentionOverview`), `client/src/pages/PenatausahaanDokumen.tsx`
- Test: `server/relationshipEndRecord.test.ts`

**Interfaces — Produces:**
- `relationshipEndDenial(input: { dateKey: string; todayKey: string; lastTransactionDateKey: string | null }): string | null` (murni, diekspor dari `shared/documentRetention.ts`)
- `recordRelationshipEnd(input: { customerId: number; dateKey: string; source: string }, actor: { id: number }): Promise<{ relationshipEndedAt: Date }>`
- overview: `customers.inactiveWithoutEndDateCustomers: { id: number; fullName: string; cifNumber: string | null }[]`

- [x] **Step 1: Uji yang gagal**

```ts
import { relationshipEndDenial } from "../shared/documentRetention";

describe("relationshipEndDenial", () => {
  it("menolak tanggal masa depan per hari WIB", () => {
    expect(relationshipEndDenial({ dateKey: "2026-09-29", todayKey: "2026-09-28", lastTransactionDateKey: null })).toMatch(/masa depan/);
    expect(relationshipEndDenial({ dateKey: "2026-09-28", todayKey: "2026-09-28", lastTransactionDateKey: null })).toBeNull();
  });
  it("menolak tanggal sebelum transaksi selesai terakhir; hari yang sama boleh", () => {
    expect(relationshipEndDenial({ dateKey: "2026-03-01", todayKey: "2026-09-28", lastTransactionDateKey: "2026-03-02" })).toMatch(/transaksi terakhir/);
    expect(relationshipEndDenial({ dateKey: "2026-03-02", todayKey: "2026-09-28", lastTransactionDateKey: "2026-03-02" })).toBeNull();
  });
  it("menolak format tanggal yang bukan YYYY-MM-DD", () => {
    expect(relationshipEndDenial({ dateKey: "02/03/2026", todayKey: "2026-09-28", lastTransactionDateKey: null })).toMatch(/format/);
  });
});

describe("recordRelationshipEnd", () => {
  it("menulis awal hari WIB dalam UTC dan audit bersumber", async () => {
    const { updates, inserted } = mockDb({ customers: [{ id: 4, profileStatus: "INACTIVE", relationshipEndedAt: null }], exchange_transactions: [], company_profile: [{ timezone: "Asia/Jakarta" }] });
    const result = await recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-02", source: "Berkas fisik nasabah, surat penutupan 2 Maret 2026" }, { id: 3 });
    expect(result.relationshipEndedAt.toISOString()).toBe("2026-03-01T17:00:00.000Z");
    expect(updates.find((row) => row.table === "customers")!.set).toMatchObject({ relationshipEndedAt: result.relationshipEndedAt });
    expect(inserted.find((row) => row.table === "audit_logs")!.values).toMatchObject({ action: "CUSTOMER_RELATIONSHIP_END_RECORDED", reason: "Berkas fisik nasabah, surat penutupan 2 Maret 2026" });
  });
  it("menolak nasabah yang tidak INACTIVE atau sudah bertanggal, dan sumber kosong", async () => {
    mockDb({ customers: [{ id: 4, profileStatus: "ACTIVE", relationshipEndedAt: null }], exchange_transactions: [], company_profile: [] });
    await expect(recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-02", source: "berkas" }, { id: 3 })).rejects.toThrow(/INACTIVE/);
    mockDb({ customers: [{ id: 4, profileStatus: "INACTIVE", relationshipEndedAt: new Date() }], exchange_transactions: [], company_profile: [] });
    await expect(recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-02", source: "berkas" }, { id: 3 })).rejects.toThrow(/sudah/);
    await expect(recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-02", source: " " }, { id: 3 })).rejects.toThrow(/Sumber/);
  });
});
```

(Periksa nama kolom alasan pada `auditLogs` — `writeAudit` memakai `reason`; bila kolomnya bernama lain, sesuaikan uji dengan nama sebenarnya.)

- [x] **Step 2:** FAIL.

- [x] **Step 3: `relationshipEndDenial`** di `shared/documentRetention.ts`:

```ts
/** Validasi tanggal berakhir hubungan yang diisi Controller — dibandingkan per hari operasional. */
export function relationshipEndDenial(input: { dateKey: string; todayKey: string; lastTransactionDateKey: string | null }): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)) return "Tanggal harus berformat YYYY-MM-DD.";
  if (input.dateKey > input.todayKey) return "Tanggal berakhir hubungan tidak boleh di masa depan.";
  if (input.lastTransactionDateKey && input.dateKey < input.lastTransactionDateKey) return `Tanggal berakhir tidak boleh sebelum transaksi terakhir nasabah (${input.lastTransactionDateKey}).`;
  return null;
}
```

- [x] **Step 4: `recordRelationshipEnd`** di `server/documentRetentionQueries.ts`:

```ts
/**
 * Mengisi `relationshipEndedAt` bagi nasabah INACTIVE yang dinonaktifkan sebelum migrasi 0058.
 * Tidak pernah otomatis — tanggalnya berasal dari sumber yang disebut Controller dan disimpan di
 * audit. Sampai diisi, nasabahnya tanpa jam retensi: disimpan tanpa batas.
 */
export async function recordRelationshipEnd(input: { customerId: number; dateKey: string; source: string }, actor: { id: number }) {
  const source = input.source?.trim() ?? "";
  if (source.length < 3) throw new Error("Sumber tanggal berakhir wajib diisi.");
  const db = await databaseOrThrow();
  const [customer] = await db.select({ id: customers.id, profileStatus: customers.profileStatus, relationshipEndedAt: customers.relationshipEndedAt }).from(customers).where(eq(customers.id, input.customerId)).limit(1);
  if (!customer) throw new Error("Nasabah tidak ditemukan.");
  if (customer.profileStatus !== "INACTIVE") throw new Error("Hanya nasabah INACTIVE yang dapat diisi tanggal berakhir hubungannya.");
  if (customer.relationshipEndedAt) throw new Error("Tanggal berakhir hubungan nasabah ini sudah tercatat.");
  const timeZone = await operationalTimeZone(db);
  const transactions = await db.select({ transactionAt: exchangeTransactions.transactionAt }).from(exchangeTransactions)
    .where(and(eq(exchangeTransactions.customerId, input.customerId), eq(exchangeTransactions.status, "COMPLETED"), eq(exchangeTransactions.isDemo, false)));
  const lastAt = latest(transactions.map((row) => row.transactionAt));
  const denial = relationshipEndDenial({ dateKey: input.dateKey, todayKey: operationalDateKey(new Date(), timeZone), lastTransactionDateKey: lastAt ? operationalDateKey(lastAt, timeZone) : null });
  if (denial) throw new Error(denial);
  // Tengah hari UTC pada tanggal itu jatuh di hari kalender yang sama untuk zona mana pun dalam daftar.
  const relationshipEndedAt = startOfOperationalDay(new Date(`${input.dateKey}T12:00:00Z`), timeZone);
  await db.update(customers).set({ relationshipEndedAt }).where(eq(customers.id, input.customerId));
  await db.insert(auditLogs).values({ actorUserId: actor.id, action: "CUSTOMER_RELATIONSHIP_END_RECORDED", entityType: "customer", entityId: String(input.customerId), beforeState: { relationshipEndedAt: null }, afterState: { relationshipEndedAt }, reason: source });
  return { relationshipEndedAt };
}
```

Impor `startOfOperationalDay`, `operationalDateKey` dari `../shared/regulatoryActionQueue`, `relationshipEndDenial` dari `../shared/documentRetention`, `auditLogs` dari skema. `latest` sudah ada di berkas.

- [x] **Step 5: Overview** — pilih juga `fullName`, `cifNumber` pada `customerRows`, dan tambahkan ke hasil:

```ts
      inactiveWithoutEndDateCustomers: customerRows.filter((row) => row.profileStatus === "INACTIVE" && !row.relationshipEndedAt).map((row) => ({ id: row.id, fullName: row.fullName, cifNumber: row.cifNumber })),
```

- [x] **Step 6: Router** — di router yang memuat `retentionOverview`:

```ts
    recordRelationshipEnd: controllerProcedure
      .input(z.object({ customerId: z.number().int().positive(), dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), source: z.string().trim().min(3).max(1000) }))
      .mutation(({ input, ctx }) => recordRelationshipEnd(input, ctx.user)),
```

- [x] **Step 7: Layar** — di `PenatausahaanDokumen.tsx`, kartu *Tidak aktif tanpa tanggal berakhir* menampilkan daftar `inactiveWithoutEndDateCustomers` (nama + CIF) bila tidak kosong; tiap baris tombol **"Isi tanggal berakhir"** membuka Dialog: `Input type="date"` (maks hari ini), `Textarea` sumber wajib, keterangan "Tanggal ini memulai jam simpan 5 tahun (Pasal 48 ayat (1) huruf a angka 1). Isi hanya dari sumber yang dapat ditunjukkan." Mutasi → `toast`, invalidasi overview. Keadaan kosong tetap kalimat yang ada.

- [x] **Step 8:** `./node_modules/.bin/vitest run server/relationshipEndRecord.test.ts server/documentRetentionQueries.test.ts shared/documentRetention.test.ts && ./node_modules/.bin/tsc --noEmit` → PASS / 0.
- [x] **Step 9: Commit** — `"Controller mengisi tanggal berakhir hubungan nasabah INACTIVE lama, bersumber dan teraudit"`

---

### Tugas 10: Peragaan end-to-end, dokumentasi, dan perintah mutu

**Files:** `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md`, `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`, `docs/superpowers/specs/2026-09-09-pbi-10-2024-temuan-awal.md` (tandai Temuan 3 dan 7 dirancang/selesai), Playwright galeri/rute bila ada spec yang menangkap rute baru.

- [x] **Step 1: Peragaan di `moneychanger`** (server `./node_modules/.bin/tsx watch server/_core/index.ts`, pengguna masuk sendiri — Claude tidak mengetik sandi):
  1. Impor daftar uji DTTOT kecil (`scripts/seedWatchlistDemo.mjs` bila sesuai, atau workbook uji buatan sendiri di scratchpad) berisi nama yang sama dengan satu nasabah uji lokal.
  2. Periksa `SELECT id,customerId,source,status,matchKeys FROM watchlist_blocks` → blokir OPEN untuk nasabah itu.
  3. Buat bon untuk nasabah itu di layar → pesan netral; `attempted_transactions` bertambah satu, `exchange_transactions`/`cash_denomination_balances` tidak berubah (bandingkan hitungan sebelum-sesudah).
  4. Register Pemblokiran: percobaan tampil; nyatakan salah sasaran → bon berikutnya lolos gerbang blokir. Ulangi dengan nasabah kedua → konfirmasi → catat pelaporan → Kesiapan Operasional berubah.
  5. Klasifikasi Risiko: N > 0 → tombol sahkan nonaktif; isi seluruh kode → sahkan → riwayat + unduh snapshot; Kesiapan Operasional "Tinjauan berikutnya …".
  6. Nasabah uji INACTIVE dengan `relationshipEndedAt` dikosongkan lewat SQL lokal → muncul di kartu → isi tanggal + sumber → kartu kosong, audit tercatat.
  Tangkapan layar tiap langkah disimpan di scratchpad (bukan di repo).
- [x] **Step 2: Dokumentasi** — Panduan A–Z: bagian Pemblokiran (alur, pesan kasir, keputusan, apa yang tidak dikirim aplikasi), Tinjauan klasifikasi, pengisian tanggal berakhir, dan **cara resmi harga seri uang kertas** (B5: harga diketik pada bon dalam toleransi atau dengan alasan). Skema: tiga tabel, satu kolom, migrasi `0062`. ROADMAP: B5 sebagai calon sesudah desktop; B1 diterima. Temuan awal: Temuan 3 dan 7 → selesai dengan rujukan rencana ini.
- [x] **Step 3: Perintah mutu**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run > "$SCRATCH/vitest-butir-b.log" 2>&1; tail -6 "$SCRATCH/vitest-butir-b.log"
./node_modules/.bin/tsc --noEmit; echo "tsc exit $?"
./node_modules/.bin/vite build 2>&1 | tail -3
caffeinate -dimsu ./node_modules/.bin/playwright test 2>&1 | tail -5
```
Expected: seluruh berkas lulus, "dilewati" 2; sebutkan angka baru dan selisihnya terhadap 1734.
- [x] **Step 4: Commit** — `"Butir B: peragaan end-to-end, panduan A-Z, skema, ROADMAP"`
