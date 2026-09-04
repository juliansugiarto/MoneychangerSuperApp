# Paket K1 — Batas tanggal pada checklist harian dan stock opname

> **Bagi pelaksana:** kerjakan satu tugas per sesi. Prompt siap tempel ada di
> `docs/superpowers/PROMPT-SESI.md`. Aturan kerja lengkap ada di
> `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md` bagian "Aturan kerja yang berlaku untuk seluruh
> paket" — patuhi seluruhnya.

**Tujuan:** menghentikan pencarian checklist dan opname hari berjalan yang meleset tujuh jam di
mesin pengembangan WIB, sehingga baris yang sudah ada tidak lagi tak terlihat dan penyisipan
duplikat tidak lagi mungkin.

**Rancangan:** satu pembungkus tipis, `jakartaBusinessDateColumn()`, yang menormalkan hari usaha
Jakarta menjadi tengah malam **lokal** sebelum dikirim ke kolom `date`. Tiga titik `eq()` dan satu
batas `gte()` beralih memakainya. `jakartaBusinessDate()` sendiri **tidak diubah** — pemanggil lain
memakainya sebagai batas `datetime` dan sudah benar.

**Peta jalan:** `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md` bagian "Paket K1".

## Status Pengerjaan

**Centang barisnya di sini setelah commit tugas itu**, dan centang juga baris paket K1 pada Status
Pengerjaan di ROADMAP.

- [x] Tugas 1 — Normalkan tanggal yang dikirim ke kolom `date`
- [ ] Tugas 2 — Uji penjaga dan dokumentasi

Urutannya mengikat: 1 sebelum 2.

## Latar belakang yang tidak boleh diturunkan ulang dari kode

mysql2 memformat sebuah `Date` memakai zona waktu **proses**, bukan UTC. `jakartaBusinessDate()`
(`server/operations.ts:1628`) mengembalikan tengah malam **UTC**, sehingga di mesin WIB nilainya
menjadi `'2026-09-01 07:00:00'` ketika dibandingkan dengan kolom `date`:

- `eq(kolom, hari)` **tidak pernah** cocok dengan baris yang sudah ada.
- `gte(kolom, dari)` menyingkirkan baris yang jatuh tepat pada batas bawahnya.

Tidak terlihat di produksi karena jam servernya `Etc/UTC` — di sana tengah malam UTC diformat
sebagai `00:00:00` dan semuanya benar. Hanya salah di mesin pengembangan pengguna.

Komentar di dalam `jakartaBusinessDate` sendiri mencatat putaran sebelumnya dari bug yang sama,
"diperbaiki" dengan memindahkan tengah hari ke tengah malam — yang hanya memperkecil selisihnya dari
19 jam menjadi 7 jam, tidak menghilangkannya.

Pola yang benar sudah terbukti dua kali di repo ini: `dbDate` (`server/ledgerOperations.ts:57`) dan
`dateColumnBound` (`server/operations.ts:2317`), keduanya tengah malam **lokal** hari kalender yang
dimaksud — benar di kedua zona waktu.

> **Normalisasi hanya boleh dilakukan SEKALI.** `dateColumnBound` membaca komponen **UTC**
> masukannya (`toISOString().slice(0, 10)`). Memberinya `Date` yang sudah tengah malam lokal akan
> **memundurkan tanggalnya satu hari** di mesin WIB. Karena itu `jakartaBusinessDateColumn`
> membungkus `jakartaBusinessDate` — jangan pernah membungkus hasilnya lagi.

## Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `server/operations.ts` | `jakartaBusinessDateColumn`, empat titik pemakaian | 1 |
| `server/businessDateColumn.test.ts` | Uji penjaga invarian tanggal (baru) | 2 |
| `docs/SKEMA-DATABASE-PROJECT.md`, `docs/HANDOFF-OPUS.md` | Catat bahwa butir ini selesai | 2 |

---

### Tugas 1: Normalkan tanggal yang dikirim ke kolom `date`

**Files:**
- Modify: `server/operations.ts`

**Interfaces:**
- Consumes: `jakartaBusinessDate` (`server/operations.ts:1628`), `dateColumnBound` (baris 2317)
- Produces: `jakartaBusinessDateColumn(date?)` — dipakai tugas 2

- [x] **Langkah 1: Pindahkan `dateColumnBound` ke dekat `jakartaBusinessDate`**

`dateColumnBound` sekarang berada di baris 2317, jauh di bawah pemanggil pertamanya yang baru.
Ia sebuah `const` arrow, jadi terkena *temporal dead zone* bila dipanggil saat modul dimuat —
walaupun pada praktiknya hanya dipanggil saat permintaan berjalan. Pindahkan supaya urutannya jujur
dan kedua helper tanggal duduk berdampingan.

Potong baris ini dari posisinya sekarang (tepat di atas `listExpenses`):

```ts
const dateColumnBound = (value: Date) => new Date(`${value.toISOString().slice(0, 10)}T00:00:00`);
```

Sisipkan tepat **setelah** blok `jakartaBusinessDate` (setelah baris 1634), beserta komentar yang
menjelaskan mengapa ia ada dan mengapa hanya boleh dipakai sekali:

```ts
/**
 * Tengah malam **lokal** hari kalender yang dimaksud, untuk dikirim ke kolom `date`.
 *
 * mysql2 memformat `Date` memakai zona waktu proses, bukan UTC. Tengah malam UTC karena itu menjadi
 * `'2026-09-01 07:00:00'` di mesin WIB, sehingga `eq()` tidak pernah cocok dengan baris yang sudah
 * ada dan `gte()` menyingkirkan baris yang jatuh tepat pada batasnya. Tengah malam lokal benar di
 * kedua zona waktu.
 *
 * Membaca komponen **UTC** masukannya, jadi hanya boleh diterapkan **sekali**: memberinya `Date`
 * yang sudah tengah malam lokal memundurkan tanggalnya satu hari.
 */
const dateColumnBound = (value: Date) => new Date(`${value.toISOString().slice(0, 10)}T00:00:00`);

/**
 * Hari usaha Jakarta dalam bentuk yang aman dikirim ke kolom `date`.
 *
 * Dipakai setiap kali hari usaha menjadi **nilai kolom `date`** — bukan batas `datetime`. Pemanggil
 * `jakartaBusinessDate()` yang lain sengaja dibiarkan apa adanya.
 */
export function jakartaBusinessDateColumn(date = new Date()) {
  return dateColumnBound(jakartaBusinessDate(date));
}
```

- [x] **Langkah 2: Checklist operasional harian**

Di `getDailyOperationalChecklist` (sekitar baris 1732), ganti:

```ts
  const businessDate = jakartaBusinessDate();
```

menjadi:

```ts
  // Nilai ini menjadi isi kolom `date`, jadi harus tengah malam lokal — lihat jakartaBusinessDateColumn.
  const businessDate = jakartaBusinessDateColumn();
```

Nilai yang sama dipakai untuk `eq(...)` **dan** untuk `insert(...).values({ businessDate })`, jadi
satu penggantian ini memperbaiki pencarian sekaligus penyisipannya.

- [x] **Langkah 3: Opname yang dibuka dari penyelesaian bon**

Di `completeTransaction` (sekitar baris 1798), ganti:

```ts
    const opnameDate = jakartaBusinessDate();
```

menjadi:

```ts
    const opnameDate = jakartaBusinessDateColumn();
```

- [x] **Langkah 4: `openStockOpname`**

Sekitar baris 2844, penggantian yang sama:

```ts
  const opnameDate = jakartaBusinessDateColumn();
```

Perhatikan bahwa `opnameDate` di sini dipakai tiga kali — dua `eq()` dan satu `insert` — sehingga
penjaga "opname hari ini sudah ada" akhirnya benar-benar menemukan baris yang sudah ada, alih-alih
menabrak kunci unik `stock_opnames_date_currency_uq`.

- [x] **Langkah 5: Batas rentang pada laporan opname**

`getStockOpnameReport` (sekitar baris 2999) menerima `from`/`to` dari `z.coerce.date()`
(`server/routers.ts:733`), yang menghasilkan tengah malam UTC — bug yang sama pada batas bawahnya.
Bungkus kedua batasnya:

```ts
    const rows = await db.select({ opname: stockOpnames, currency: currencies }).from(stockOpnames).innerJoin(currencies, eq(stockOpnames.currencyId, currencies.id)).where(and(gte(stockOpnames.opnameDate, dateColumnBound(input.from)), lt(stockOpnames.opnameDate, dateColumnBound(input.to)), eq(stockOpnames.isDemo, false), eq(stockOpnames.isHistorical, false))).orderBy(desc(stockOpnames.opnameDate), currencies.code);
```

- [x] **Langkah 6: Pastikan tidak ada pemanggil `date` lain yang terlewat**

```bash
grep -n "jakartaBusinessDate()" server/*.ts | grep -v "\.test\."
```

Yang tersisa boleh memakai `jakartaBusinessDate()` **hanya** bila nilainya dipakai sebagai batas
`datetime` atau untuk membentuk teks, bukan sebagai nilai kolom `date`. Pada saat rencana ini
ditulis yang tersisa adalah `openingCashMovementReason` (baris 1720, membentuk teks alasan) dan
`getOperationalDashboard` (baris 2895, batas `datetime`). Keduanya benar apa adanya — **jangan
diubah**. Bila ada pemanggil baru, periksa kolom tujuannya lebih dulu.

- [x] **Langkah 7: Gerbang mutu**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

Harapan: bersih, dan jumlah ujinya masih **522 lulus, 2 dilewati**. Laporkan angka yang benar-benar
dilihat.

- [x] **Langkah 8: Commit**

```bash
git add server/operations.ts
git commit -m "Kirim hari usaha ke kolom date sebagai tengah malam lokal"
```

---

### Tugas 2: Uji penjaga dan dokumentasi

**Files:**
- Create: `server/businessDateColumn.test.ts`
- Modify: `docs/SKEMA-DATABASE-PROJECT.md`, `docs/HANDOFF-OPUS.md`

**Interfaces:**
- Consumes: `jakartaBusinessDateColumn`, `jakartaBusinessDate` dari tugas 1
- Produces: —

- [ ] **Langkah 1: Tulis uji penjaga**

Ujinya harus lulus di zona waktu mana pun — termasuk mesin CI yang berjalan UTC — jadi asersinya
atas **komponen lokal** hasilnya, bukan atas `toISOString()`.

Buat `server/businessDateColumn.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { jakartaBusinessDate, jakartaBusinessDateColumn } from "./operations";

/** Tanggal sebagaimana mysql2 akan memformatnya: komponen waktu LOKAL proses. */
function asMysqlDate(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

describe("hari usaha Jakarta sebagai nilai kolom date", () => {
  it("mengirim hari kalender Jakarta, bukan hari UTC-nya", () => {
    // 20:00 UTC adalah pukul 03:00 keesokan harinya di Jakarta.
    const instant = new Date("2026-09-01T20:00:00Z");
    expect(asMysqlDate(jakartaBusinessDateColumn(instant))).toBe("2026-09-02");
  });

  it("tetap benar pada tengah malam Jakarta, batas yang paling mudah meleset", () => {
    // 17:00 UTC adalah tepat tengah malam awal 2 September di Jakarta.
    expect(asMysqlDate(jakartaBusinessDateColumn(new Date("2026-09-01T17:00:00Z")))).toBe("2026-09-02");
    // Satu detik sebelumnya masih 1 September.
    expect(asMysqlDate(jakartaBusinessDateColumn(new Date("2026-09-01T16:59:59Z")))).toBe("2026-09-01");
  });

  it("membiarkan jakartaBusinessDate tetap tengah malam UTC bagi pemanggil datetime", () => {
    // Pemanggil seperti getOperationalDashboard memakainya sebagai batas datetime dan sudah benar.
    // Mengubahnya akan menggeser batas dasbor, tutup buku, dan checklist sekaligus.
    expect(jakartaBusinessDate(new Date("2026-09-01T20:00:00Z")).toISOString()).toBe("2026-09-02T00:00:00.000Z");
  });
});
```

- [ ] **Langkah 2: Jalankan dan pastikan lulus**

```bash
./node_modules/.bin/vitest run server/businessDateColumn.test.ts
```

Bila `jakartaBusinessDateColumn` belum diekspor, ekspor dari `server/operations.ts` — tugas 1
langkah 1 sudah menuliskannya sebagai `export function`.

- [ ] **Langkah 3: Perbarui skema database**

Di `docs/SKEMA-DATABASE-PROJECT.md`, pada bagian "Kontrol Data Penting", tambahkan satu baris
tabel yang menjelaskan aturannya sekali untuk seluruh proyek:

| Kontrol | Implementasi skema | Konsekuensi operasi |
|---|---|---|
| Nilai kolom `date` | `dateColumnBound`/`jakartaBusinessDateColumn` (`server/operations.ts`) dan `dbDate` (`server/ledgerOperations.ts`) menormalkan tanggal menjadi tengah malam **lokal** sebelum dikirim | mysql2 memformat `Date` memakai zona waktu proses, jadi tengah malam UTC menjadi `'... 07:00:00'` di mesin WIB — `eq()` tidak pernah cocok dengan baris yang sudah ada dan `gte()` menyingkirkan baris pada batas bawahnya. Benar di produksi (jam server UTC), salah hanya di mesin pengembangan, sehingga bug jenis ini lolos tanpa suara. Normalisasi dilakukan **sekali**; menerapkannya dua kali memundurkan tanggalnya satu hari. |

- [ ] **Langkah 4: Perbarui handoff**

Di `docs/HANDOFF-OPUS.md` butir 2 bagian "Empat hal yang tidak boleh diturunkan ulang dari kode",
sub-bagian **"Yang belum diperbaiki"** menyebut `dailyOperationalChecklists.businessDate` dan
`stockOpnames.opnameDate` sebagai masih bermasalah. Ganti menjadi catatan bahwa keduanya sudah
diperbaiki lewat `jakartaBusinessDateColumn`, dan bahwa `jakartaBusinessDate` sendiri sengaja
dibiarkan mengembalikan tengah malam UTC untuk pemanggil `datetime`.

- [ ] **Langkah 5: Gerbang mutu**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

Harapan: bersih, dengan **tiga uji tambahan** dibanding baseline.

- [ ] **Langkah 6: Commit, lalu centang Status Pengerjaan**

```bash
git add server/businessDateColumn.test.ts docs/
git commit -m "Uji penjaga batas tanggal hari usaha dan catat aturannya"
```

Setelah commit, centang kedua tugas pada Status Pengerjaan di berkas ini **dan** baris paket K1 pada
`docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`.

---

## Catatan bagi pelaksana

- **Jangan mengubah `jakartaBusinessDate` sendiri.** Fungsinya benar untuk pemanggil `datetime`;
  mengubahnya menyentuh dasbor operasional, tutup buku, opname, dan checklist sekaligus.
- **Jangan menormalkan dua kali.** `dateColumnBound` membaca komponen UTC masukannya.
- Uji dalam paket ini murni atas fungsi — tidak menyentuh basis data, dan tidak memerlukan izin data
  uji.
