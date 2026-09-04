# Paket B — Setoran modal pada persiapan go-live

> **Bagi pelaksana:** kerjakan satu tugas per sesi. Prompt siap tempel ada di
> `docs/superpowers/PROMPT-SESI.md`. Aturan kerja lengkap ada di
> `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md` bagian "Aturan kerja yang berlaku untuk seluruh
> paket" — patuhi seluruhnya.

**Tujuan:** membuat urutan yang benar — **setor modal dulu, baru hitung kas awal** — terlihat dan
terpandu di tempat orang menyiapkan outlet, sehingga kas awal pertama tidak lagi dicatat sebelum
asal uangnya ada, dan peringatan *"Modal disetor belum tercatat pada buku besar"* padam dengan
sendirinya.

**Rancangan:** halaman persiapan go-live mendapat kartu **Modal disetor** yang membaca saldo akun
3-1100 dari buku besar, dan langkahnya dinomori ulang sehingga modal mendahului kas pembukaan.
Pencatatan kas awal Rupiah mengembalikan **peringatan** (bukan penolakan) bila belum pernah ada
setoran modal. Mekanisme pencatatannya sendiri sudah ada dari paket A — paket ini tidak menambah
satu pun jalur penulisan uang baru.

**Peta jalan:** `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md` bagian "Paket B".

## Status Pengerjaan

**Centang barisnya di sini setelah commit tugas itu**, dan centang juga baris paket B pada Status
Pengerjaan di ROADMAP.

- [x] Tugas 1 — Kartu "Modal disetor" dan urutan langkah go-live
- [x] Tugas 2 — Peringatan urutan pada pencatatan kas awal
- [x] Tugas 3 — Uji dan dokumentasi

Urutannya mengikat: 2 sebelum 3. Tugas 1 boleh dikerjakan kapan saja.

## Latar belakang

Kas awal **pertama** untuk sebuah mata uang sengaja **tidak dijurnal**. `mapCashMovement`
(`shared/journalMapping.ts`, kasus `OPENING`) mengembalikannya sebagai `skipped` dengan alasan
*"kas awal pertama; asal uangnya belum tercatat — catat sebagai setoran modal lebih dulu"*, sebab
menjurnalkannya ke 7-1900 akan mencatat modal pemilik sebagai pendapatan lain-lain dan
menggelembungkan laba.

Urutan yang benar membuat itu tidak jadi masalah: modal masuk lebih dulu (Dr 1-1110 / Cr 3-1100),
lalu hitungan kas pagi mencocokkan uang yang sama, sehingga selisih pembukaannya nol dan memang
tidak ada yang perlu dijurnal.

Masalahnya, tidak ada apa pun yang memberi tahu urutan itu di tempat orang bekerja:

- `client/src/pages/GoLiveSetup.tsx` hanya empat kartu status — Akun tim, Kas pembukaan, Kurs
  outlet, Checklist outlet — yang menautkan ke halaman lain. Tulisannya sendiri berbunyi
  *"Halaman ini tidak mengubah data secara otomatis."* Modal tidak disebut sama sekali.
- `shared/financialStatements.ts:240` memang menyalakan peringatan *"Modal disetor belum tercatat
  pada buku besar"* — tetapi peringatan itu muncul di halaman Buku Besar, yang dibuka Controller
  saat menyusun laporan, bukan saat menyiapkan outlet.

## Yang sengaja tidak dikerjakan

- **Jangan menolak `recordOpeningCash`** bila modal belum tercatat. Outlet yang melanjutkan
  pembukuan lama, atau yang modalnya masuk lewat rekening bank alih-alih kas, punya alasan sah untuk
  tidak punya mutasi `CAPITAL_INJECTION` kas. Menolak akan menghalangi operasional demi kerapian
  pembukuan — kebalikan dari prioritas yang benar.
- **Jangan membangun wizard multi-langkah baru.** Halaman yang ada sudah cukup bila urutannya benar.
- **Jangan menambah jalur penulisan uang.** Tombolnya menautkan ke tab Modal & Bank yang sudah ada.
- Jangan mengubah `GoLiveSetup` menjadi khusus Shareholder. Rutenya `minimumRole="CONTROLLER"`
  (`client/src/App.tsx:89`) dan menyiapkan outlet memang pekerjaan Controller.

## Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `client/src/pages/GoLiveSetup.tsx` | Kartu "Modal disetor", penomoran ulang langkah | 1 |
| `server/operations.ts` | Peringatan urutan pada `recordOpeningCash` | 2 |
| `client/src/pages/StockControl.tsx` | Menampilkan peringatan itu | 2 |
| `server/openingCashOrder.test.ts` | Uji peringatan urutan (baru) | 3 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` | Urutan persiapan hari pertama | 3 |

---

### Tugas 1: Kartu "Modal disetor" dan urutan langkah go-live

**Files:**
- Modify: `client/src/pages/GoLiveSetup.tsx`

**Interfaces:**
- Consumes: `trpc.ledger.accountLedger` (`server/routers.ts:569`, `controllerProcedure`) —
  mengembalikan `closingBalance` sebagai teks dua desimal
- Produces: —

- [x] **Langkah 1: Baca saldo Modal Disetor**

`buildAccountLedger` (`server/ledgerOperations.ts:687`) sudah mengembalikan `closingBalance` dengan
tanda mengikuti saldo normal akunnya — 3-1100 bersaldo normal KREDIT, jadi modal yang sudah tercatat
tampil **positif**. Tidak perlu prosedur baru.

Tambahkan di dalam komponen, di samping kueri yang sudah ada:

```tsx
  // Saldo 3-1100 langsung dari buku besar: kartu ini harus menunjukkan apa yang benar-benar
  // terjurnal, bukan apa yang ada di laci — keduanya bisa berbeda sampai penjurnalan dijalankan.
  const { data: capital } = trpc.ledger.accountLedger.useQuery({ accountCode: "3-1100" });
  const capitalRecorded = Number(capital?.closingBalance ?? "0") > 0;
```

- [x] **Langkah 2: Sisipkan kartunya sebagai langkah 2, dan nomori ulang sisanya**

Urutan kartunya menjadi: **1. Akun tim → 2. Modal disetor → 3. Kas pembukaan → 4. Kurs outlet →
5. Checklist outlet**. Ubah `xl:grid-cols-4` menjadi `xl:grid-cols-5` pada `div` pembungkusnya.

Kartu barunya, disisipkan tepat sebelum kartu "Kas pembukaan":

```tsx
<Card className="border-[#dce6f0]">
  <CardHeader>
    {capitalRecorded ? <CheckCircle2 className="size-5 text-[#3f9276]" /> : <CircleAlert className="size-5 text-amber-600" />}
    <CardTitle className="font-display mt-3 text-lg text-[#18395f]">2. Modal disetor</CardTitle>
    <CardDescription>Catat modal pemilik <strong>sebelum</strong> hitungan kas pagi yang pertama.</CardDescription>
  </CardHeader>
  <CardContent>
    <Badge className={capitalRecorded ? "status-approved" : "status-pending"}>{capitalRecorded ? "Sudah tercatat" : "Belum tercatat"}</Badge>
    <p className="mt-2 text-xs text-[#475569]">Kas awal yang pertama tidak dapat dijurnal bila asal uangnya belum tercatat — buku besar akan melewatinya beserta alasannya.</p>
    <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setLocation("/operasional/stock")}>Catat setoran modal</Button>
  </CardContent>
</Card>
```

Ubah judul kartu berikutnya menjadi `3. Kas pembukaan`, `4. Kurs outlet`, dan `5. Checklist outlet`.
Pada kartu "Kas pembukaan", ubah `CardDescription` menjadi:

```tsx
<CardDescription>Catat saldo awal per valuta — <strong>setelah</strong> modal di atas tercatat.</CardDescription>
```

- [x] **Langkah 3: Verifikasi visual**

Server pengembangan sudah berjalan di `http://localhost:3003` dan sesi peramban sudah login sebagai
Development Shareholder — pakai itu, jangan menyalakan yang baru. Buka **Langkah Persiapan Awal**,
pastikan lima kartunya tersusun rapi pada lebar desktop dan tidak berdesakan pada lebar sempit, dan
pastikan keadaan memuat serta keadaan galat kueri buku besar tidak membuat kartunya kosong tanpa
penjelasan.

- [x] **Langkah 4: Gerbang mutu**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

- [x] **Langkah 5: Commit**

```bash
git add client/src/pages/GoLiveSetup.tsx
git commit -m "Modal disetor menjadi langkah persiapan tersendiri sebelum kas awal"
```

---

### Tugas 2: Peringatan urutan pada pencatatan kas awal

**Files:**
- Modify: `server/operations.ts`, `client/src/pages/StockControl.tsx`

**Interfaces:**
- Consumes: `cashBalanceMovements.category`, nilai `CAPITAL_INJECTION` dari paket A
- Produces: `recordOpeningCash` mengembalikan `capitalWarning: string | null` — dipakai tugas 3

- [x] **Langkah 1: Kembalikan peringatan dari `recordOpeningCash`**

Di dalam transaksi `recordOpeningCash` (`server/operations.ts:2548`), setelah baris saldo dikunci
dan **sebelum** `writeAudit`, tambahkan pemeriksaannya. Peringatan hanya berlaku untuk Rupiah:
mutasi valuta asing memang tidak dinilai per mutasi.

```ts
    // Kas awal pertama untuk sebuah mata uang sengaja tidak dijurnal — asal uangnya belum tercatat.
    // Diberi tahu di sini, di tempat orang mencatatnya, bukan hanya di peringatan laporan keuangan.
    // Peringatan, bukan penolakan: modal bisa saja masuk lewat rekening bank, atau outlet ini
    // melanjutkan pembukuan lama. Menghalangi operasional demi kerapian pembukuan bukan urutan
    // prioritas yang benar.
    let capitalWarning: string | null = null;
    if (currency.code.trim().toUpperCase() === "IDR" && before.isZero()) {
      const capital = (await tx.select({ id: cashBalanceMovements.id }).from(cashBalanceMovements)
        .where(and(eq(cashBalanceMovements.cashBalanceId, balance.id), eq(cashBalanceMovements.category, "CAPITAL_INJECTION")))
        .limit(1))[0];
      if (!capital) {
        capitalWarning = "Setoran modal belum pernah dicatat, sehingga kas awal Rupiah ini tidak akan dijurnal ke buku besar. Catat setoran modal lewat tab Modal & Bank, lalu jalankan penjurnalan.";
      }
    }
```

Sertakan pada nilai kembalinya:

```ts
    return { balanceId: balance.id, currencyCode: currency.code, beforeAmount: before.toFixed(6), openingAmount: declaredAmount.toFixed(6), capitalWarning };
```

Sertakan juga pada `metadata` `writeAudit` sebagai `capitalWarning: Boolean(capitalWarning)`, supaya
jejak auditnya mencatat bahwa peringatan itu memang dimunculkan.

> Syarat `before.isZero()` disengaja: peringatan hanya relevan pada hitungan kas **pertama**. Setelah
> saldo berjalan ada, mutasi `OPENING` berikutnya dijurnal sebagai selisih hitung kas dan tidak
> memerlukan modal apa pun.

- [x] **Langkah 2: Tampilkan peringatannya**

Di `client/src/pages/StockControl.tsx`, pada `onSuccess` mutasi `opening` (sekitar baris 73):

```tsx
    onSuccess: ({ currencyCode, openingAmount: amount, capitalWarning }) => {
      toast.success(`Kas awal ${currencyCode} sebesar ${formatPlainAmount(amount)} berhasil dicatat, termasuk rincian pecahannya.`);
      if (capitalWarning) toast.warning(capitalWarning, { duration: 12000 });
      setOpeningAmount(""); setOpeningNotes(""); setDenominations([emptyRow()]); setSelectedCurrency(null);
      utils.cash.balances.invalidate(); utils.cash.denominationBalances.invalidate(); utils.dashboard.overview.invalidate();
    },
```

Peringatannya diberi durasi lebih panjang daripada toast biasa karena isinya menuntut tindakan, dan
tidak boleh hilang sebelum sempat dibaca. Bila `toast.warning` tidak tersedia pada versi Sonner yang
dipakai, gunakan `toast` biasa dengan ikon peringatan — **jangan** memakai `toast.error`, karena
pencatatannya sendiri berhasil.

- [x] **Langkah 3: Gerbang mutu dan commit**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
git add server/operations.ts client/src/pages/StockControl.tsx
git commit -m "Peringatkan bila kas awal Rupiah dicatat sebelum setoran modal"
```

---

### Tugas 3: Uji dan dokumentasi

**Files:**
- Create: `server/openingCashOrder.test.ts`
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`

**Interfaces:**
- Consumes: `capitalWarning` dari tugas 2
- Produces: —

- [x] **Langkah 1: Tulis ujinya**

Ikuti pola `getDb` yang dipalsukan seperti pada `server/capitalMovement.test.ts` — **jangan
menyentuh basis data**. Tiga perilaku yang harus dijaga:

1. Kas awal Rupiah pertama **tanpa** mutasi `CAPITAL_INJECTION` mengembalikan `capitalWarning` yang
   tidak kosong, **dan tetap mencatat kas awalnya** (pencatatannya berhasil, bukan ditolak).
2. Kas awal Rupiah pertama **dengan** mutasi `CAPITAL_INJECTION` yang sudah ada mengembalikan
   `capitalWarning: null`.
3. Kas awal **valuta asing** tidak pernah memunculkan peringatan, berapa pun keadaan modalnya.

Buka `server/capitalMovement.test.ts` lebih dulu dan tiru cara berkas itu memalsukan `getDb`,
termasuk cara `tx.select(...).from(...).where(...).limit(...)` dirantai — menyalin bentuk yang sudah
ada jauh lebih cepat daripada menyusun ulang tiruannya.

- [x] **Langkah 2: Jalankan dan pastikan lulus**

```bash
./node_modules/.bin/vitest run server/openingCashOrder.test.ts
```

- [x] **Langkah 3: Perbarui panduan A–Z**

Panduan sudah memuat §5.6a "Modal dan Pemindahan Kas ke Bank" yang menjelaskan urutan modal sebelum
kas awal. Yang perlu ditambahkan adalah **rujukan silang di tempat orang membaca lebih dulu**:

- Di **§3 "Sebelum Hari Pertama Penggunaan"**, tambahkan langkah "catat setoran modal" sebelum
  langkah kas awal, dengan satu kalimat alasan dan rujukan ke §5.6a.
- Di **§5.6 langkah 1** (tab Kas Awal), tambahkan satu kalimat: pada hari pertama, catat setoran
  modal lebih dulu lewat tab Modal & Bank — sistem akan memperingatkan bila urutannya terbalik,
  dan pencatatannya tetap berhasil.
- Di **§12 Checklist Harian Ringkas**, bagian Pembukaan, tambahkan butir modal untuk hari pertama.

- [x] **Langkah 4: Gerbang mutu**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

Laporkan jumlah uji yang benar-benar dilihat.

- [x] **Langkah 5: Commit, lalu centang Status Pengerjaan**

```bash
git add server/openingCashOrder.test.ts docs/
git commit -m "Uji urutan modal sebelum kas awal dan perbarui panduan"
```

Setelah commit, centang ketiga tugas pada Status Pengerjaan di berkas ini **dan** baris paket B pada
`docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`.

---

## Catatan bagi pelaksana

- Peringatan, **bukan** penolakan. Bila muncul dorongan menjadikannya penolakan, baca ulang bagian
  "Yang sengaja tidak dikerjakan".
- Kartu modal membaca **buku besar**, bukan mutasi kas. Keduanya bisa berbeda sampai penjurnalan
  dijalankan, dan yang dinilai kartu ini adalah apakah modalnya sudah masuk laporan keuangan.
- Bila sebuah tugas membengkak melebihi berkas yang disebutkan, berhenti dan laporkan.
