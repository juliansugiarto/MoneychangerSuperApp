# Sesi Basis Data Selalu UTC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setiap sambungan basis data aplikasi berjalan dengan zona sesi UTC, dan server menolak menyala bila tidak, sehingga mesin ber-zona apa pun menyimpan dan membaca waktu persis seperti produksi.

**Architecture:** Satu modul kecil `server/utcSession.ts` memuat perintah sesi dan penjaganya. `server/db.ts` memasang perintah itu pada setiap sambungan baru pool; `server/testing/scratchDatabase.ts` memasangnya pada sambungan migrasi; `server/_core/index.ts` memanggil penjaga sebelum pekerjaan basis data pertama. Tidak ada migrasi, tidak ada perubahan zona proses Node, tidak ada opsi `timezone` mysql2.

**Tech Stack:** Node, mysql2 3.24.4 (API callback untuk pool, `mysql2/promise` untuk uji), Drizzle ORM 0.45.2, Vitest 3, MySQL lokal.

**Spec:** `docs/superpowers/specs/2026-09-26-zona-waktu-utc-design.md`

## Status Pengerjaan

- [x] Tugas 1 — Sesi UTC pada setiap sambungan dan penjaga saat menyala
- [ ] Tugas 2 — Bukti produksi (baca-saja), dokumentasi, serah terima

## Global Constraints

- `pnpm` tidak ada di PATH; pakai `./node_modules/.bin/*`. Muat lingkungan sebelum uji:
  `export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a; export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"`
- Baseline sebelum rencana ini (26 September 2026, `e5e6827`): `Test Files 221 passed (221)`, `Tests 1726 passed | 2 skipped (1728)`.
- Perintah sesinya persis `SET time_zone = '+00:00'` (spec §Keputusan). Bentuk offset dipakai, bukan `'UTC'`, karena bentuk bernama menuntut tabel zona waktu MySQL yang tidak selalu terpasang (MariaDB portabel di Windows).
- **Jangan** menambahkan opsi `timezone` pada `createPool`/`createConnection` dan **jangan** mengubah `process.env.TZ` (spec §Koreksi): penolong kolom `date` bergantung pada perilaku bawaan mysql2.
- Uji hidup yang menulis hanya ke basis data `mc_uji_*` dari `server/testing/scratchDatabase.ts`.
- Produksi hanya dibaca (`SELECT`), lewat akun `claude_readonly` sesuai catatan memori *local-dev-and-db-access*. Tidak ada penerapan.
- Jangan menjalankan `prettier`. Bahasa isi repo Indonesia.

## Review Focus

1. **Sambungan yang dibuka pool belakangan** (pool bertambah saat beban naik) juga harus UTC, bukan hanya sambungan pertama. Uji: Tugas 1 Step 1, *"setiap sambungan pool — bukan hanya yang pertama — bersesi UTC"*.
2. **Mesin pengembangan ber-zona WIB** adalah tempat kesalahannya nyata; uji dijalankan di sana tanpa `TZ=UTC`. Uji: Tugas 1 Step 1, *"waktu bawaan now() terbaca sebagai sekarang"*.
3. **Server yang tersambung ke basis data ber-sesi bukan UTC** harus berhenti dengan pesan yang jelas, bukan menulis waktu bergeser diam-diam. Uji: Tugas 1 Step 1, *"penjaga menolak sesi +07:00"*.
4. **Kolom `date`** (pengeluaran, buku besar, opname) tidak boleh bergeser satu hari akibat perubahan ini. Dijaga uji `date` yang sudah ada di suite penuh (Tugas 1 Step 7); tidak ada kode `date` yang diubah.
5. **Instalasi tanpa `DATABASE_URL`** (hanya `TENANT_REGISTRY`) tidak boleh gagal menyala karena penjaga. Tugas 1 Step 5: penjaga hanya berjalan bila `getDb()` mengembalikan basis data.

---

### Tugas 1: Sesi UTC pada setiap sambungan dan penjaga saat menyala

**Files:**
- Create: `server/utcSession.ts`
- Modify: `server/db.ts:25-35` (`poolFor`)
- Modify: `server/testing/scratchDatabase.ts:27-32` (sambungan migrasi)
- Modify: `server/_core/index.ts` (impor, dan satu panggilan tepat sebelum `ensureDevelopmentTestAccounts`)
- Test: `server/utcSession.live.test.ts`

**Interfaces:**
- Produces:
  - `UTC_SESSION_SQL = "SET time_zone = '+00:00'"`
  - `applyUtcSession(connection: { query(sql: string, callback: (error: Error | null) => void): unknown }): void` — untuk event `connection` pool callback mysql2
  - `assertUtcSession(db: { execute(query: SQL): Promise<unknown> }): Promise<void>` — melempar `Error` berisi `"bukan UTC"` bila `TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW())` ≠ 0

- [x] **Step 1: Tulis uji hidup yang gagal**

`server/utcSession.live.test.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createConnection } from "mysql2/promise";
import { beforeAll, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { createInternalUser, getDb, getInternalUserByUsername } from "./db";
import { runWithTenant, type TenantBinding } from "./tenantContext";
import { createScratchDatabase } from "./testing/scratchDatabase";
import { assertUtcSession } from "./utcSession";

let binding: TenantBinding;
let url: string;
const inTenant = <T,>(fn: () => Promise<T>) => runWithTenant(binding, fn);
const firstRow = (result: unknown) => (result as unknown as Array<Array<Record<string, unknown>>>)[0][0];

beforeAll(async () => {
  ({ binding, url } = await createScratchDatabase("mc_uji_zona_waktu"));
  await inTenant(() => createInternalUser({ username: "uji.zona", passwordHash: "x", name: "Uji Zona", role: "STAFF", mustChangePassword: false }));
}, 180_000);

describe("sesi basis data selalu UTC", () => {
  it("waktu bawaan now() terbaca sebagai sekarang, bukan bergeser zona mesin", async () => {
    const user = await inTenant(async () => (await getInternalUserByUsername("uji.zona"))!);
    expect(Math.abs(user.createdAt.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("timestamp yang ditulis Drizzle terbaca kembali sebagai instan yang sama dengan bawaan now()", async () => {
    const at = new Date(Math.floor(Date.now() / 1000) * 1000);
    await inTenant(async () => {
      const db = (await getDb())!;
      await db.update(users).set({ lastSignedIn: at }).where(eq(users.username, "uji.zona"));
    });
    const user = await inTenant(async () => (await getInternalUserByUsername("uji.zona"))!);
    expect(user.lastSignedIn.getTime()).toBe(at.getTime());
    expect(Math.abs(user.lastSignedIn.getTime() - user.createdAt.getTime())).toBeLessThan(60_000);
  });

  it("setiap sambungan pool — bukan hanya yang pertama — bersesi UTC", async () => {
    const zones = await inTenant(async () => {
      const db = (await getDb())!;
      // Lebih banyak kueri serentak daripada ukuran pool (4) memaksa pool membuka sambungan baru.
      return Promise.all(Array.from({ length: 8 }, () => db.execute(sql`SELECT @@session.time_zone AS zone, SLEEP(0.05) AS s`)));
    });
    expect(new Set(zones.map((result) => firstRow(result).zone))).toEqual(new Set(["+00:00"]));
  });

  it("penjaga menerima sesi pool dan menolak sesi +07:00 dengan pesan yang jelas", async () => {
    await inTenant(async () => { await assertUtcSession((await getDb())!); });
    const connection = await createConnection({ uri: url });
    try {
      await connection.query("SET time_zone = '+07:00'");
      await expect(assertUtcSession(drizzle(connection))).rejects.toThrow("bukan UTC");
    } finally {
      await connection.end();
    }
  });
});
```

- [x] **Step 2: Jalankan dan lihat gagal**

Run: `./node_modules/.bin/vitest run server/utcSession.live.test.ts`
Expected: FAIL — `Failed to load url ./utcSession`. Sesudah Step 3 dibuat tetapi **sebelum** Step 4, jalankan lagi: uji pertama dan ketiga gagal pada Mac ber-zona WIB (selisih ± 25 200 000 ms; zona `SYSTEM`). Bila uji pertama lulus sebelum Step 4, zona sistem MySQL mesin ini ternyata UTC — catat, dan pastikan uji ketiga tetap gagal.

- [x] **Step 3: Tulis `server/utcSession.ts`**

```ts
import { sql, type SQL } from "drizzle-orm";

/**
 * Zona sesi basis data aplikasi (spec 2026-09-26 zona waktu UTC). Drizzle menulis dan membaca kolom
 * `timestamp` sebagai teks UTC, sedangkan MySQL menafsirkan teks itu menurut zona SESI; bawaan `now()`
 * adalah instan sungguhan. Tanpa sesi UTC keduanya berselisih sebesar zona mesin basis data — tujuh
 * jam di laptop WIB. Bentuk offset dipakai karena bentuk bernama menuntut tabel zona MySQL.
 */
export const UTC_SESSION_SQL = "SET time_zone = '+00:00'";

/** Untuk event `connection` pool callback mysql2: berjalan sebelum kueri apa pun di sambungan itu. */
export function applyUtcSession(connection: { query(sql: string, callback: (error: Error | null) => void): unknown }) {
  connection.query(UTC_SESSION_SQL, (error) => {
    if (error) console.error("[Database] Gagal menyetel zona sesi UTC:", error.message);
  });
}

/** Menolak menyala bila sesi basis data bukan UTC — lebih baik berhenti daripada menyimpan waktu bergeser. */
export async function assertUtcSession(db: { execute(query: SQL): Promise<unknown> }) {
  const result = await db.execute(sql`SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS offsetMinutes`);
  const offset = Number((result as unknown as Array<Array<{ offsetMinutes: number | string }>>)[0][0].offsetMinutes);
  if (offset !== 0) {
    throw new Error(`Zona sesi basis data bukan UTC (selisih ${offset} menit). Waktu akan tersimpan bergeser; periksa "${UTC_SESSION_SQL}" pada sambungan atau default-time-zone server basis data.`);
  }
}
```

- [x] **Step 4: Pasang pada pool dan sambungan migrasi**

`server/db.ts` — tambah impor `import { applyUtcSession } from "./utcSession";` dan ganti isi `try` di `poolFor`:

```ts
  try {
    const pool = createPool({ uri: databaseUrl, connectionLimit: CONNECTIONS_PER_TENANT });
    // Setiap sambungan baru — termasuk yang dibuka pool belakangan — bersesi UTC sebelum dipakai.
    pool.on("connection", applyUtcSession);
    const created = drizzle(pool);
    _pools.set(databaseUrl, created);
    return created;
  } catch (error) {
```

`server/testing/scratchDatabase.ts` — tambah impor `import { UTC_SESSION_SQL } from "../utcSession";` dan sesudah `const migrationConnection = await createConnection({ uri: url });` tambahkan baris pertama di dalam `try`:

```ts
    await migrationConnection.query(UTC_SESSION_SQL);
```

- [x] **Step 5: Penjaga saat menyala**

`server/_core/index.ts` — tambah impor `import { getDb } from "../db";` (bila belum ada) dan `import { assertUtcSession } from "../utcSession";`. Tepat **sebelum** baris `if (await ensureDevelopmentTestAccounts()) …`:

```ts
  // Sebelum pekerjaan basis data pertama: sesi yang bukan UTC menyimpan waktu bergeser diam-diam.
  const startupDb = await getDb();
  if (startupDb) await assertUtcSession(startupDb);
```

- [x] **Step 6: Jalankan uji**

Run: `./node_modules/.bin/vitest run server/utcSession.live.test.ts server/ownerRecovery.live.test.ts server/installationSetup.live.test.ts server/customerWatchlistScreening`
Expected: PASS — 4 uji baru, uji hidup lama tetap lulus.

- [x] **Step 7: Perintah mutu**

Run: `./node_modules/.bin/vitest run > /tmp/claude-501/vitest-utc.log 2>&1; tail -5 /tmp/claude-501/vitest-utc.log; ./node_modules/.bin/tsc --noEmit; ./node_modules/.bin/vite build`
Expected: `Test Files 222 passed (222)`, `Tests 1730 passed | 2 skipped (1732)` (+1 berkas, +4 uji); `tsc` tanpa keluaran; build `✓ built`. Bila uji lama yang membandingkan stempel `timestamp` basis data lokal gagal, itu data lama yang ditulis di bawah sesi WIB (spec §Data yang sudah ada) — sebutkan nama berkasnya dan jangan memperbaiki datanya.

- [x] **Step 8: Periksa server menyala**

Jalankan `PORT=3300 ./node_modules/.bin/tsx server/_core/index.ts` di latar dengan `.env` termuat; Expected: `Server running on http://localhost:3300/` tanpa galat zona. Hentikan.

- [x] **Step 9: Commit**

```bash
git add server/utcSession.ts server/utcSession.live.test.ts server/db.ts server/testing/scratchDatabase.ts server/_core/index.ts docs/superpowers/plans/2026-09-26-zona-waktu-utc.md
git commit -m "Basis data: setiap sambungan bersesi UTC, server menolak menyala bila tidak

server/_core/index.ts disentuh satu panggilan penjaga, dituntut spec zona waktu UTC.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tugas 2: Bukti produksi (baca-saja), dokumentasi, serah terima

**Files:**
- Modify: `docs/SKEMA-DATABASE-PROJECT.md` (baris kontrol baru "Zona waktu sesi")
- Modify: `docs/superpowers/PROMPT-SESI.md` (hapus butir 7 "Kolom `defaultNow()`…" dari pekerjaan belum dirancang; catat selesai)

**Interfaces:**
- Consumes: `UTC_SESSION_SQL`, `assertUtcSession` (Tugas 1).

- [ ] **Step 1: Bukti produksi, baca-saja**

```bash
ssh deploy@187.53.128.14 "mysql --defaults-file=\$HOME/.claude-readonly.cnf -e 'SELECT @@global.time_zone, @@system_time_zone, TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS selisih'"
```

Expected: `SYSTEM`, `UTC`, `0`. Bila selisihnya bukan 0, **berhenti dan laporkan**: premis spec §Data yang sudah ada salah dan produksi perlu keputusan pengguna sebelum kode ini diterapkan. Bila SSH ditolak, catat bahwa bukti tidak dapat diambil — jangan menganggapnya benar.

- [ ] **Step 2: Dokumentasi skema**

Tambahkan baris pada tabel "Kontrol Data Penting" di `docs/SKEMA-DATABASE-PROJECT.md`:

```
| Zona waktu sesi | Setiap sambungan pool menjalankan `SET time_zone = '+00:00'` (`server/utcSession.ts`, dipasang `server/db.ts`); `server/_core/index.ts` menolak menyala bila `TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW())` ≠ 0 | Kolom `timestamp` (94 berbawaan `now()`) tersimpan dan terbaca sebagai UTC sungguhan di mesin ber-zona apa pun, termasuk laptop WIB. Zona proses Node dan opsi `timezone` mysql2 **sengaja tidak** diubah: penolong kolom `date` (`dateColumnBound`, `dbDate`) bergantung pada perilaku bawaan. Stempel lama di basis data pengembangan yang ditulis di bawah sesi WIB terbaca tujuh jam lebih awal; tidak dikoreksi. |
```

- [ ] **Step 3: Perintah mutu dan centang**

Run: `./node_modules/.bin/vitest run 2>&1 | tail -4`
Expected: angka sama dengan Tugas 1 Step 7. Centang kedua baris Status Pengerjaan dan seluruh langkah.

- [ ] **Step 4: Commit**

```bash
git add docs/SKEMA-DATABASE-PROJECT.md docs/superpowers/PROMPT-SESI.md docs/superpowers/plans/2026-09-26-zona-waktu-utc.md
git commit -m "Zona waktu UTC: bukti produksi baca-saja dan dokumentasi skema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
