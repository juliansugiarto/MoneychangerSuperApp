# Paket D — Opname menyeluruh: pecahan dan brankas

> **Bagi pelaksana:** kerjakan satu tugas per sesi. Prompt siap tempel ada di
> `docs/superpowers/PROMPT-SESI.md`. Aturan kerja lengkap ada di
> `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md` bagian "Aturan kerja yang berlaku untuk seluruh
> paket" — patuhi seluruhnya.

**Tujuan:** stock opname akhirnya menghitung **seluruh** persediaan — laci dan brankas, per pecahan,
bukan satu angka ketikan — sehingga selisih komposisi yang totalnya nol tidak lagi lolos tanpa
suara, dan isi brankas punya lawan hitung fisik untuk pertama kalinya (temuan BI 6).

**Spec:** `docs/superpowers/specs/2026-09-04-opname-pecahan-brankas-design.md` — **baca dulu**,
terutama bagian "Yang sudah diputuskan pengguna". Empat keputusan di sana mengikat.

**Peta jalan:** `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md` bagian "Paket D".

## Status Pengerjaan

**Centang barisnya di sini setelah commit tugas itu**, dan centang juga barisnya pada Status
Pengerjaan di ROADMAP.

- [x] Tugas 1 — Skema dan migrasi aditif
- [x] Tugas 2 — Pembanding pecahan murni di `shared/`
- [x] Tugas 3 — Angka sistem per pecahan untuk laci dan brankas
- [ ] Tugas 4 — `submitStockOpname` menerima pecahan dua lokasi
- [ ] Tugas 5 — UI tab Stock Opname
- [ ] Tugas 6 — Dokumentasi dan gerbang akhir

Urutannya **mengikat seluruhnya**: 1 → 2 → 3 → 4 → 5 → 6. Tugas 4 memakai hasil 2 dan 3; tugas 5
memakai kontrak tRPC dari tugas 4.

## Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `drizzle/schema.ts` | Kolom baru + tabel `stock_opname_denominations` | 1 |
| `drizzle/0045_*.sql` | Migrasi aditif (dihasilkan) | 1 |
| `shared/denominationVariance.ts` | Pembanding pecahan murni (baru) | 2 |
| `shared/denominationVariance.test.ts` | Ujinya (baru) | 2 |
| `server/operations.ts` | Angka sistem per pecahan; `submitStockOpname`; `reconcileStockOpname` | 3, 4 |
| `server/opnameSystemCounts.test.ts` | Uji angka sistem (baru) | 3 |
| `server/opnameDenominations.test.ts` | Uji pengiriman opname (baru) | 4 |
| `server/routers.ts` | Kontrak `stockOpname.submit` | 4 |
| `client/src/pages/StockControl.tsx` | Form pecahan laci + brankas, varians per pecahan | 5 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` | §5.6 langkah 4–5 | 6 |
| `docs/SKEMA-DATABASE-PROJECT.md` | Tabel dan kolom baru | 6 |

---

### Tugas 1: Skema dan migrasi aditif

**Files:**
- Modify: `drizzle/schema.ts`
- Create: `drizzle/0045_*.sql` (dihasilkan `drizzle-kit generate`)

**Interfaces:**
- Produces: `stockOpnameDenominations`, dan empat kolom baru pada `stockOpnames` — dipakai tugas 3–5

- [x] **Langkah 1: Tambahkan kolomnya pada `stockOpnames`**

Di `drizzle/schema.ts`, pada `stockOpnames`, tepat setelah `physicalBalance`:

```ts
  /** Hasil hitung fisik laci, dijumlahkan dari rincian pecahan — tidak pernah diketik langsung. */
  physicalCounterBalance: decimal("physicalCounterBalance", { precision: 24, scale: 6 }),
  /** Hasil hitung fisik brankas, dijumlahkan dari rincian pecahan. Nol berarti "dihitung dan memang kosong". */
  physicalSafeBalance: decimal("physicalSafeBalance", { precision: 24, scale: 6 }),
  /** Isi brankas menurut sistem saat opname dikirim. NULL pada baris sebelum paket D — aritmetika variansnya lalu identik dengan perilaku lama. */
  closingSystemSafeBalance: decimal("closingSystemSafeBalance", { precision: 24, scale: 6 }),
  /** Ada pecahan yang jumlahnya meleset meski totalnya bisa saja nol. Dihitung saat pengiriman, bukan saat pemeriksaan. */
  hasDenominationVariance: boolean("hasDenominationVariance").default(false).notNull(),
```

Keempatnya nullable kecuali yang terakhir (punya default), sehingga baris lama tetap sah tanpa
pengisian mundur. **Jangan menyentuh `stock_opnames_date_currency_uq`** — keputusan 1 pada spec
memilih bentuk yang tidak menuntutnya.

- [x] **Langkah 2: Tambahkan tabel rincian hitungnya**

Tepat setelah blok `stockOpnames`:

```ts
/**
 * Rincian pecahan hasil hitung fisik sebuah opname, terpisah per lokasi.
 *
 * Bentuknya sengaja meniru `cash_denomination_entries` supaya pembacaannya seragam; yang berbeda
 * hanya `location`, karena satu opname menghitung dua tempat sekaligus — laci dan brankas.
 */
export const stockOpnameDenominations = mysqlTable("stock_opname_denominations", {
  id: int("id").autoincrement().primaryKey(),
  stockOpnameId: int("stockOpnameId").notNull(),
  location: mysqlEnum("location", ["COUNTER", "SAFE"]).notNull(),
  denominationValue: decimal("denominationValue", { precision: 24, scale: 6 }).notNull(),
  quantity: int("quantity").notNull(),
  /** denominationValue * quantity, disimpan berlebih supaya kueri rekonsiliasi murah. */
  subtotal: decimal("subtotal", { precision: 24, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("stock_opname_denominations_opname_location_value_uq").on(table.stockOpnameId, table.location, table.denominationValue),
  index("stock_opname_denominations_opname_idx").on(table.stockOpnameId),
]);
```

- [x] **Langkah 3: Hasilkan migrasinya dan BACA SQL-nya**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
./node_modules/.bin/drizzle-kit generate
cat drizzle/0045_*.sql
```

Periksa dengan mata sendiri sebelum menerapkan: hanya boleh ada `CREATE TABLE
stock_opname_denominations` dan `ALTER TABLE stock_opnames ADD COLUMN` (empat kali). **Bila ada
`DROP`, `MODIFY`, atau perubahan indeks apa pun — berhenti dan laporkan.** Jangan menjalankan
berkas `.sql` itu langsung lewat klien mysql; penanda `--> statement-breakpoint` membuat pernyataan
kedua gagal.

- [x] **Langkah 4: Terapkan ke dua basis data lokal**

```bash
node scripts/tenant.mjs migrate-all
```

Hanya `moneychanger` dan `mc_t_abcvalas`. **Jangan menerapkan ke produksi.**

Verifikasi bentuk akhirnya:

```bash
mysql -h 127.0.0.1 -u root moneychanger -e "SHOW COLUMNS FROM stock_opnames; SHOW CREATE TABLE stock_opname_denominations\G"
```

- [x] **Langkah 5: Gerbang mutu dan commit**

```bash
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
git add drizzle/
git commit -m "Skema opname: rincian pecahan per lokasi dan hitungan brankas"
```

---

### Tugas 2: Pembanding pecahan murni di `shared/`

**Files:**
- Create: `shared/denominationVariance.ts`, `shared/denominationVariance.test.ts`

**Interfaces:**
- Produces: `compareDenominationCounts` — dipakai tugas 4 (server) dan tugas 5 (UI)

Ditaruh di `shared/` justru supaya UI dapat menunjukkan selisihnya **sebelum** petugas mengirim,
memakai aturan yang sama persis dengan yang dipakai server saat menilai. Fungsi murni, tanpa
basis data, tanpa Drizzle.

- [x] **Langkah 1: Tulis fungsinya**

```ts
/**
 * Selisih hitung fisik terhadap catatan sistem, per nilai pecahan.
 *
 * Pecahan yang hanya ada di salah satu sisi diperlakukan sebagai nol di sisi lainnya — pecahan yang
 * ada di tangan petugas tetapi nol di sistem justru selisih yang paling penting ditemukan, dan
 * membuang sisi yang kosong akan menyembunyikannya.
 */
export type DenominationCount = { value: string; quantity: number };

export type DenominationVarianceRow = {
  value: string;
  systemQuantity: number;
  physicalQuantity: number;
  difference: number;
};

export function compareDenominationCounts(system: DenominationCount[], physical: DenominationCount[]): {
  rows: DenominationVarianceRow[];
  hasVariance: boolean;
} {
  // Dikunci pada teks bernormalisasi, bukan Number: 100000 dan 100000.000000 adalah pecahan yang
  // sama, dan membandingkannya sebagai teks mentah akan memecahnya menjadi dua baris palsu.
  const normalise = (value: string) => new Decimal(value).toFixed(6);
  const totals = new Map<string, { systemQuantity: number; physicalQuantity: number }>();
  const bump = (entries: DenominationCount[], key: "systemQuantity" | "physicalQuantity") => {
    for (const entry of entries) {
      const value = normalise(entry.value);
      const row = totals.get(value) ?? { systemQuantity: 0, physicalQuantity: 0 };
      row[key] += entry.quantity;
      totals.set(value, row);
    }
  };
  bump(system, "systemQuantity");
  bump(physical, "physicalQuantity");

  const rows = [...totals.entries()]
    .map(([value, row]) => ({ value, ...row, difference: row.physicalQuantity - row.systemQuantity }))
    .sort((a, b) => new Decimal(b.value).comparedTo(new Decimal(a.value)));
  return { rows, hasVariance: rows.some((row) => row.difference !== 0) };
}
```

Impor `Decimal` dari `decimal.js` seperti berkas `shared/` lain yang sudah ada — periksa dulu cara
`shared/ledger.ts` mengimpornya dan ikuti persis.

- [x] **Langkah 2: Ujinya**

Lima perilaku yang harus dijaga:

1. Sisi yang sama persis → `hasVariance: false`, semua `difference` nol.
2. Pecahan yang **hanya ada di fisik** → muncul sebagai baris dengan `systemQuantity: 0` dan
   `hasVariance: true`.
3. Pecahan yang **hanya ada di sistem** → muncul dengan `physicalQuantity: 0` dan
   `hasVariance: true`.
4. **Total nilai sama tetapi komposisi berbeda** (sistem 5×100000, fisik 10×50000) →
   `hasVariance: true`. Ini keputusan 2 pada spec, dan uji inilah yang menguncinya.
5. `"100000"` dan `"100000.000000"` diperlakukan sebagai pecahan yang sama, bukan dua baris.

```bash
./node_modules/.bin/vitest run shared/denominationVariance.test.ts
```

- [x] **Langkah 3: Gerbang mutu dan commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
git add shared/denominationVariance.ts shared/denominationVariance.test.ts
git commit -m "Pembanding pecahan fisik terhadap catatan sistem"
```

---

### Tugas 3: Angka sistem per pecahan untuk laci dan brankas

**Files:**
- Modify: `server/operations.ts`
- Create: `server/opnameSystemCounts.test.ts`

**Interfaces:**
- Consumes: `cash_denomination_balances`, `cash_denomination_entries`, `cash_balance_movements`
- Produces: `getOpnameSystemCounts(currencyId)` → `{ counter, safe }`, keduanya
  `DenominationCount[]` — dipakai tugas 4 dan (lewat tRPC) tugas 5

- [x] **Langkah 1: Tulis fungsinya**

Tambahkan di `server/operations.ts`, dekat `listCashDenominationBalances`
(`server/operations.ts:2438`):

```ts
/**
 * Isi laci dan isi brankas menurut sistem, per nilai pecahan — lawan hitung fisik sebuah opname.
 *
 * Laci dibaca dari stok berjalan `cash_denomination_balances`, TANPA penyaring `quantity > 0` yang
 * dipakai `listCashDenominationBalances`: pecahan yang nol di sistem tetapi ada di tangan petugas
 * adalah selisih yang paling penting ditemukan, dan menyaringnya akan menyembunyikannya.
 *
 * Brankas diturunkan, tidak disimpan: SAFE_DEPOSIT dikurangi SAFE_WITHDRAWAL atas rincian pecahan
 * tiap mutasi. Ini logika yang sama dengan total pada getCashReconciliation, hanya dipecah per
 * pecahan. OFF_HOURS_SALE sengaja tidak ikut — uang itu keluar dari laci karena terjual, bukan
 * masuk brankas.
 */
export async function getOpnameSystemCounts(currencyId: number) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const counterRows = await db.select({ value: cashDenominationBalances.denominationValue, quantity: cashDenominationBalances.quantity })
      .from(cashDenominationBalances).where(eq(cashDenominationBalances.currencyId, currencyId));

    const balance = (await db.select({ id: cashBalances.id }).from(cashBalances).where(eq(cashBalances.currencyId, currencyId)).limit(1))[0];
    const safeTotals = new Map<string, number>();
    if (balance) {
      const safeRows = await db.select({
        category: cashBalanceMovements.category,
        value: cashDenominationEntries.denominationValue,
        quantity: cashDenominationEntries.quantity,
      }).from(cashDenominationEntries)
        .innerJoin(cashBalanceMovements, eq(cashBalanceMovements.id, cashDenominationEntries.cashBalanceMovementId))
        .where(and(
          eq(cashBalanceMovements.cashBalanceId, balance.id),
          inArray(cashBalanceMovements.category, ["SAFE_DEPOSIT", "SAFE_WITHDRAWAL"]),
        ));
      for (const row of safeRows) {
        const value = new Decimal(String(row.value)).toFixed(6);
        const signed = row.category === "SAFE_DEPOSIT" ? row.quantity : -row.quantity;
        safeTotals.set(value, (safeTotals.get(value) ?? 0) + signed);
      }
    }

    return {
      counter: counterRows.map((row) => ({ value: new Decimal(String(row.value)).toFixed(6), quantity: row.quantity })),
      safe: [...safeTotals.entries()].map(([value, quantity]) => ({ value, quantity })),
    };
  });
}
```

Periksa dulu apakah `inArray` sudah diimpor di berkas itu; `server/ledgerOperations.ts` memakainya,
`server/operations.ts` mungkin belum.

- [x] **Langkah 2: Ekspos lewat tRPC**

Di `server/routers.ts`, pada router `stockOpname` (sekitar `server/routers.ts:716`):

```ts
    systemCounts: staffProcedure.input(z.object({ currencyId: z.number().int().positive() })).query(({ input }) => getOpnameSystemCounts(input.currencyId)),
```

`staffProcedure` karena yang menghitung fisik adalah Staff, dan mereka harus melihat angka
pembandingnya sebelum mengirim.

- [x] **Langkah 3: Ujinya**

Pola `getDb` dipalsukan, **jangan menyentuh basis data**. Tiru `server/openingCashOrder.test.ts`
yang membedakan kueri berurutan lewat urutan pemanggilan `select`. Empat perilaku:

1. Isi laci dikembalikan apa adanya dari `cash_denomination_balances`, **termasuk baris yang
   `quantity` nol**.
2. `SAFE_DEPOSIT` 3×100000 dan `SAFE_WITHDRAWAL` 1×100000 → brankas 2×100000.
3. Mutasi `OFF_HOURS_SALE` **tidak** mengubah isi brankas.
4. Mata uang yang belum punya baris `cash_balances` → `safe` kosong, bukan galat.

- [x] **Langkah 4: Gerbang mutu dan commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
git add server/operations.ts server/routers.ts server/opnameSystemCounts.test.ts
git commit -m "Angka sistem per pecahan untuk laci dan brankas"
```

---

### Tugas 4: `submitStockOpname` menerima pecahan dua lokasi

**Files:**
- Modify: `server/operations.ts`, `server/routers.ts`
- Create: `server/opnameDenominations.test.ts`

**Interfaces:**
- Consumes: `compareDenominationCounts` (tugas 2), `getOpnameSystemCounts` (tugas 3)
- Produces: kontrak `stockOpname.submit` yang baru — dipakai tugas 5

- [ ] **Langkah 1: Ubah tanda tangan dan perhitungannya**

`submitStockOpname` (`server/operations.ts:2890`) **tidak lagi menerima `physicalBalance`**. Ia
menerima dua daftar pecahan dan menghitung sendiri:

```ts
export async function submitStockOpname(
  input: { stockOpnameId: number; counterDenominations: DenominationEntryInput[]; safeDenominations: DenominationEntryInput[]; varianceNotes?: string },
  actor: { id: number; role: StaffRole },
) {
```

Aturan yang mengikat, dari spec:

- Daftar **laci wajib** tidak kosong — `throw new Error("Rincian pecahan laci wajib diisi untuk stock opname.")`.
- Daftar **brankas boleh kosong**; kosong berarti "dihitung dan memang kosong", dan tetap
  dibandingkan dengan sistem. **Jangan** melewati pembandingan brankas ketika daftarnya kosong.
- **Tanpa cabang pengecualian `isHistorical`.** Lihat "Temuan yang mengubah ongkos keputusan 3" pada
  spec — cabang seperti itu tidak boleh ditambahkan, sekarang maupun nanti.
- Nilai pecahan divalidasi lewat `assertKnownDenomination` yang sudah ada. Pakai ulang pola
  `reconcileDenominations` (`server/operations.ts:1664`), tetapi **tanpa** pemeriksaan "sama dengan
  total yang diketik" — di sini pecahannya justru **sumber** totalnya, tidak ada angka ketikan untuk
  dicocokkan. Bila menuntut fungsi terpisah, tulis `denominationRowsFrom(entries, currencyCode)`
  di samping `reconcileDenominations` dan biarkan `reconcileDenominations` memanggilnya, supaya
  validasi nilainya hanya ada satu salinan.

Perhitungannya:

```ts
    const counterPhysical = counterRows.reduce((sum, row) => sum.plus(row.subtotal), new Decimal(0));
    const safePhysical = safeRows.reduce((sum, row) => sum.plus(row.subtotal), new Decimal(0));
    const physical = counterPhysical.plus(safePhysical);
    const systemCounts = await getOpnameSystemCounts(opname.currencyId);
    const counterVariance = compareDenominationCounts(systemCounts.counter, counterRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })));
    const safeVariance = compareDenominationCounts(systemCounts.safe, safeRows.map((row) => ({ value: row.denominationValue, quantity: row.quantity })));
    const hasDenominationVariance = counterVariance.hasVariance || safeVariance.hasVariance;
    const systemSafe = systemCounts.safe.reduce((sum, row) => sum.plus(new Decimal(row.value).times(row.quantity)), new Decimal(0));
    const variance = new Decimal(calculateStockVariance(physical.toFixed(6), systemBalance.plus(systemSafe).toFixed(6)));
```

`systemBalance` tetap dibaca dari `cash_balances.availableAmount` seperti sekarang — **artinya tidak
berubah, tetap laci saja**; brankas ditambahkan terpisah di atas.

Simpan `physicalCounterBalance`, `physicalSafeBalance`, `closingSystemSafeBalance`,
`hasDenominationVariance`, dan sisipkan barisnya ke `stock_opname_denominations` dengan `location`
yang sesuai. Seluruhnya di dalam **satu transaksi** — opname yang tersimpan setengah lebih buruk
daripada opname yang gagal.

`writeAudit` mendapat tambahan `metadata`: `counterDenominationCount`, `safeDenominationCount`,
`hasDenominationVariance`.

- [ ] **Langkah 2: `reconcileStockOpname` ikut menilai komposisi**

`server/operations.ts:2905`:

```ts
  const hasVariance = !new Decimal(String(opname.variance ?? "0")).isZero() || opname.hasDenominationVariance;
```

Dan detail `createDirectorKnowledgeItem` menyebutkan komposisinya bila itu penyebabnya — selisih
komposisi yang totalnya nol akan tampil sebagai "selisih 0.000000" bila detailnya tidak diperbaiki,
dan itu justru menyesatkan Direksi.

- [ ] **Langkah 3: Kontrak tRPC**

`server/routers.ts:719` menjadi:

```ts
    submit: staffProcedure.input(z.object({
      stockOpnameId: z.number().int().positive(),
      counterDenominations: z.array(z.object({ value: decimalString, quantity: z.number().int().positive() })).min(1),
      safeDenominations: z.array(z.object({ value: decimalString, quantity: z.number().int().positive() })).default([]),
      varianceNotes: z.string().trim().max(1000).optional(),
    })).mutation(({ input, ctx }) => submitStockOpname(input, ctx.user)),
```

Periksa bentuk `DenominationEntryInput` yang sudah dipakai `cash.recordOpening` di berkas yang sama
dan **ikuti persis** — jangan membuat bentuk kedua untuk hal yang sama.

- [ ] **Langkah 4: Ujinya**

`getDb` dipalsukan. Lima perilaku:

1. Pecahan laci cocok, brankas kosong dan sistem juga kosong → `variance` nol,
   `hasDenominationVariance: false`.
2. **Total sama, komposisi berbeda** → `variance` nol tetapi `hasDenominationVariance: true`.
   Inilah uji inti paket ini.
3. Brankas berisi menurut sistem tetapi daftar fisiknya kosong → varians menyala (bukan dilewati).
4. Daftar laci kosong → ditolak dengan pesan yang menyebut "pecahan laci".
5. Nilai pecahan yang bukan pecahan IDR yang dikenal → ditolak lewat `assertKnownDenomination`.

- [ ] **Langkah 5: Gerbang mutu dan commit**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
git add server/operations.ts server/routers.ts server/opnameDenominations.test.ts
git commit -m "Stock opname menghitung laci dan brankas dari rincian pecahan"
```

---

### Tugas 5: UI tab Stock Opname

**Files:**
- Modify: `client/src/pages/StockControl.tsx`

**Interfaces:**
- Consumes: `stockOpname.submit` (tugas 4), `stockOpname.systemCounts` (tugas 3),
  `compareDenominationCounts` (tugas 2)

- [ ] **Langkah 1: Ganti isian tunggal dengan dua blok pecahan**

`StockOpnamePanel` (`client/src/pages/StockControl.tsx:285-297`) hari ini hanya punya satu `Input`
"Kas fisik saat tutup". Ganti dengan dua blok — **Laci** dan **Brankas** — mengikuti pola form
pecahan tab Kas Awal pada berkas yang sama, termasuk `DenominationValueInput`
(`client/src/components/DenominationValueInput.tsx`) yang mengunci nilainya ke pecahan asli mata
uang itu.

Jangan menyalin logika barisnya dua kali. Tarik keluar satu komponen dalam berkas ini, mis.
`<DenominationRows currencyCode rows onChange />`, dan pakai dua kali. Bila ternyata tab Kas Awal
dapat memakai komponen yang sama tanpa memaksakan bentuknya — pakai ulang; bila memaksa, biarkan
dan catat alasannya.

- [ ] **Langkah 2: Tunjukkan selisihnya sebelum dikirim**

Panggil `trpc.stockOpname.systemCounts.useQuery({ currencyId })` untuk baris opname yang sedang
dihitung, lalu tampilkan hasil `compareDenominationCounts` **per pecahan** di atas tombol kirim:
jumlah sistem, jumlah fisik, selisih. Pecahan yang selisihnya bukan nol diberi tanda.

Inilah alasan pembandingnya ditaruh di `shared/` pada tugas 2 — layar dan server menilai dengan
aturan yang sama persis, sehingga petugas tidak pernah terkejut oleh status yang muncul setelah
mengirim.

Tombol kirim tetap aktif meski ada selisih. **Selisih bukan galat** — menemukan selisih justru
tujuan opname; yang tidak boleh adalah selisih yang tidak terlihat.

- [ ] **Langkah 3: Tampilkan varians per pecahan setelah dikirim**

Pada baris opname berstatus `SUBMITTED`/`VARIANCE`, tampilkan rincian pecahan yang meleset, bukan
hanya angka total. Untuk opname lama yang tidak punya rincian (`physicalCounterBalance` NULL),
tampilkan apa adanya: "rincian pecahan tidak tersedia — dicatat sebelum opname per pecahan
diberlakukan". Jangan menampilkan nol seolah-olah itu hasil hitung.

- [ ] **Langkah 4: Verifikasi visual**

Server pengembangan di `http://localhost:3003`, sesi peramban sudah login sebagai Development
Shareholder — pakai itu, jangan menyalakan yang baru. Buka **Kas & Persediaan → Stock Opname** dan
periksa: keadaan memuat, keadaan galat kueri `systemCounts`, opname lama tanpa rincian, dan lebar
sempit. Jangan membuat data uji di basis data lokal tanpa izin pengguna pada giliran itu juga.

- [ ] **Langkah 5: Gerbang mutu dan commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
git add client/src/pages/StockControl.tsx
git commit -m "Tab Stock Opname menghitung pecahan laci dan brankas"
```

---

### Tugas 6: Dokumentasi dan gerbang akhir

**Files:**
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md`

- [ ] **Langkah 1: Panduan A–Z**

- **§5.6 langkah 4** (tab Stock Opname): hitungan fisik kini dirinci per pecahan untuk **laci dan
  brankas**, dan nominalnya dihitung dari rincian itu — tidak ada lagi angka yang diketik. Brankas
  yang memang kosong tetap harus dinyatakan kosong.
- **§5.6 langkah 5** (telaah varians): selisih komposisi pecahan yang totalnya nol **tetap**
  memerlukan peninjauan Supervisor, dengan satu kalimat alasannya.
- **§12 Checklist Harian Ringkas**, bagian Penutupan: butir hitung brankas per pecahan.

- [ ] **Langkah 2: Skema database**

Tambahkan `stock_opname_denominations` dan empat kolom baru `stock_opnames` ke
`docs/SKEMA-DATABASE-PROJECT.md`, mengikuti bentuk tabel lain di sana. Sebutkan bahwa
`closingSystemBalance` tetap berarti **laci saja** dan brankas punya kolomnya sendiri — itu justru
yang paling mudah salah dibaca kelak.

- [ ] **Langkah 3: Gerbang akhir**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

Laporkan jumlah uji yang benar-benar dilihat.

- [ ] **Langkah 4: Commit, lalu centang Status Pengerjaan**

```bash
git add docs/
git commit -m "Dokumentasikan opname per pecahan untuk laci dan brankas"
```

Setelah commit, centang keenam tugas pada Status Pengerjaan di berkas ini **dan** baris paket D pada
`docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`.

---

## Catatan bagi pelaksana

- **Selisih komposisi yang totalnya nol tetap `VARIANCE`.** Bila muncul dorongan "totalnya kan
  cocok, biarkan saja" — baca ulang keputusan 2 pada spec. Itu keputusan pengguna, bukan detail
  teknis yang boleh disederhanakan.
- **Jangan menyaring `quantity > 0`** saat membaca stok pecahan sistem untuk pembandingan. Pecahan
  yang nol di sistem tetapi ada di tangan petugas adalah temuan, bukan derau.
- **Jangan menjurnal atau memperbaiki selisih opname secara otomatis.** Paket ini membuat selisihnya
  terlihat; menutupnya masih pekerjaan manusia lewat tab Penyesuaian Brankas. Lihat "Yang sengaja
  tidak dikerjakan".
- **`closingSystemBalance` tetap laci saja.** Menggeser artinya akan mengubah makna riwayat opname
  yang sudah ada tanpa suara.
- Bila sebuah tugas membengkak melebihi berkas yang disebutkan, berhenti dan laporkan.
