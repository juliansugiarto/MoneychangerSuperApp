# Paket L — Jejak penyaringan nasabah dan persetujuan nasabah berisiko tinggi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi dapat membuktikan setiap nasabah disaring terhadap DTTOT/DPPSPM dan terhadap
daftar **mana**, dan nasabah berisiko tinggi tidak dapat bertransaksi sebelum SHAREHOLDER
memutuskan.

**Architecture:** Satu tabel riwayat yang tidak pernah disunting; satu penulis penyaringan dengan
tiga pemanggil; satu fungsi penolakan murni yang ditegakkan di penulis transaksi.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-09-09-penyaringan-nasabah-dan-persetujuan-risiko-tinggi-design.md`

**Prasyarat:** tidak ada. Paket K2 (nilai enum `DPPSPM`) sudah selesai dan paket ini memakainya.

## Status Pengerjaan

- [x] Tugas 1 — Migrasi `0057`: tabel riwayat penyaringan dan empat kolom keputusan — **SELESAI 9 September 2026**
- [x] Tugas 2 — Penulis penyaringan beserta pemanggil saat nasabah dibuat dan diubah — **SELESAI 9 September 2026**
- [x] Tugas 3 — Penyaringan ulang massal saat daftar diimpor — **SELESAI 9 September 2026**
- [ ] Tugas 4 — Gerbang persetujuan: fungsi penolakan murni dan penegakannya pada bon
- [ ] Tugas 5 — Halaman: riwayat penyaringan, peringatan daftar usang, kendali setujui/tolak
- [ ] Tugas 6 — Peragaan end-to-end dan dokumentasi

Urutannya mengikat: 1 sebelum semuanya; 2 sebelum 3; 4 berdiri sendiri sesudah 1; 5 sesudah 3 dan 4;
6 terakhir. **Tepat satu tugas migrasi: Tugas 1.**

## Keputusan pengguna yang mengikat

Ditetapkan 9 September 2026. **Jangan menurunkannya ulang dan jangan menawarnya.**

1. **Jejaknya tabel riwayat**, bukan kolom pada `customers`.
2. **Penyaringan otomatis di server saat simpan**, tidak pernah memblokir penyimpanan.
3. **SHAREHOLDER menyetujui/menolak, dan nasabah `HIGH` yang belum disetujui tidak dapat dipakai
   pada bon baru.** Ini pemblokiran operasional pertama di aplikasi ini, dan disengaja.
4. **Tenggat pelaporan Pasal 60 di luar lingkup** — negosiasi dengan BI sudah selesai.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Perintah mutu: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`,
  `./node_modules/.bin/vite build`.
- **Baseline sesudah Paket K3, 9 September 2026:** `Test Files 153 passed`,
  `Tests 1313 passed | 2 skipped`. Sebutkan angka yang benar-benar dilihat.
- **Uji flaky yang bukan bagian paket ini:** `server/tenantIsolation.live.test.ts`.
- **Migrasi hanya lewat `node scripts/tenant.mjs migrate-all`**, dua basis data lokal saja.
  **JANGAN menerapkan ke produksi.** Antrean migrasi produksi sudah 23.
- **Redefinisi/penambahan nilai enum:** bila kelak diperlukan, pakai pola Paket K2 — melebarkan,
  `UPDATE`, menyempitkan. Paket ini hanya **menambah** kolom dan tabel, jadi tidak terkena.
- **Otorisasi ditegakkan di penulis, bukan hanya router.** Preseden `iraEditDenial`/`iraApprovalDenial`.
- **Basis data palsu pada uji wajib menyaring `where` dan menerapkan `orderBy`** — salin dari
  `server/iraDataForm.test.ts`, bukan dari `companyDocumentArchive.test.ts`.
- **Rute baru wajib didaftarkan pada `server/backOfficeNavigation.test.ts`** bila menjadi tujuan sidebar.
- **Dialog wajib `max-h-[85vh] overflow-y-auto`.** **Bercabang pada `isPending`.**
- **Jangan menjalankan `prettier`.**
- **Data uji lokal boleh dibuat tanpa bertanya.** Data paket E–K2 **jangan dibersihkan.**
- **`dttotPpsdmMatch` tidak pernah diisi otomatis.** Mesin mencatat kemungkinan; manusia memutuskan.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `drizzle/schema.ts`, `drizzle/0057_*.sql` | Tabel riwayat dan empat kolom keputusan | 1 |
| `server/customerWatchlistScreening.ts` | Penulis penyaringan, satu-satunya | 2 |
| `server/customerWatchlistScreening.test.ts` | Uji penulis dengan `getDb` dipalsukan | 2 |
| `server/operations.ts` (`createCustomer`, `updateCustomer`) | Pemanggil saat simpan | 2 |
| `server/operations.ts` (`importSanctionsWatchlist`) | Penyaringan ulang massal | 3 |
| `server/customerHighRiskApproval.ts` | `customerHighRiskDenial` murni, penulis keputusan | 4 |
| `server/customerHighRiskApproval.test.ts` | Uji penolakan dan peran | 4 |
| `server/operations.ts` (`createTransaction`) | Penegakan gerbang | 4 |
| `server/routers.ts` | Prosedur `customer.screenings`, `customer.decideHighRisk` | 4, 5 |
| `client/src/pages/CustomerList.tsx` | Panel riwayat, peringatan usang, kendali setujui/tolak | 5 |
| `client/src/pages/TransactionCreate.tsx` | Menampilkan alasan penolakan | 5 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku dan skema | 6 |

---

### Task 1: Migrasi `0057`

**Files:** Modify `drizzle/schema.ts`. Create `drizzle/0057_*.sql`.

- [x] **Step 1:** Tambahkan tabel dan kolomnya pada `drizzle/schema.ts`:

```ts
/**
 * Satu baris per penyaringan, tidak pernah disunting. Baris "nihil" (matchCount 0) justru bukti
 * yang dicari pemeriksa — Pasal 47 ayat (1) huruf c PBI 10/2024 menuntut pengecekannya, bukan
 * hanya temuannya.
 */
export const customerWatchlistScreenings = mysqlTable("customer_watchlist_screenings", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  screenedAt: timestamp("screenedAt").defaultNow().notNull(),
  /** null berarti dijalankan sistem, bukan orang. */
  screenedByUserId: int("screenedByUserId"),
  trigger: mysqlEnum("trigger", ["NASABAH_DIBUAT", "NASABAH_DIUBAH", "DAFTAR_DIIMPOR", "MANUAL"]).notNull(),
  matchCount: int("matchCount").notNull(),
  summary: text("summary"),
  /**
   * `importedAt` terbaru pada saat penyaringan. Inilah yang menjawab pertanyaan sebenarnya:
   * disaring terhadap daftar yang dipegang hari ini, atau terhadap daftar yang sudah usang?
   * `null` bila belum ada daftar sama sekali saat itu.
   */
  listSnapshotAt: datetime("listSnapshotAt"),
}, (table) => [
  index("customer_watchlist_screening_customer_idx").on(table.customerId, table.screenedAt),
]);
```

      Pada `customers`, tepat sesudah `dttotPpsdmNotes`:

```ts
  /**
   * Keputusan Manajemen Senior atas nasabah berisiko tinggi — Pasal 32 ayat (5) dan (6) PBI
   * 10/2024. Disetel ulang ke BELUM setiap kali riskLevel BERPINDAH menjadi HIGH, supaya
   * persetujuan lama tidak diam-diam menaungi risiko tinggi yang timbul karena alasan baru.
   */
  highRiskDecision: mysqlEnum("highRiskDecision", ["BELUM", "DISETUJUI", "DITOLAK"]).default("BELUM").notNull(),
  highRiskDecidedByUserId: int("highRiskDecidedByUserId"),
  highRiskDecidedAt: datetime("highRiskDecidedAt"),
  highRiskDecisionNotes: text("highRiskDecisionNotes"),
```

- [x] **Step 2:** `./node_modules/.bin/drizzle-kit generate`, lalu **BACA SQL-nya**. Paket ini
      murni penambahan — `CREATE TABLE` dan empat `ADD COLUMN`. **Bila ada `MODIFY` atau `DROP`,
      berhenti dan laporkan.**

- [x] **Step 3:** Cadangkan, lalu terapkan ke dua basis data lokal saja.

```bash
mysqldump -h 127.0.0.1 -u root --single-transaction --set-gtid-purged=OFF moneychanger customers > /tmp/l-customers-before.sql
node scripts/tenant.mjs migrate-all
```

- [x] **Step 4:** Buktikan bawaan kolomnya benar dan tidak ada nasabah yang berubah statusnya:

```bash
mysql -h 127.0.0.1 -u root -N -e "SELECT highRiskDecision, COUNT(*) FROM moneychanger.customers GROUP BY 1;
SELECT COUNT(*) FROM moneychanger.customer_watchlist_screenings;"
```

      Harus: seluruh nasabah `BELUM`, tabel penyaringan kosong.

- [x] **Step 5:** Perintah mutu, lalu commit `"Migrasi riwayat penyaringan nasabah dan keputusan risiko tinggi"`.

---

### Task 2: Penulis penyaringan

**Files:** Create `server/customerWatchlistScreening.ts`, `server/customerWatchlistScreening.test.ts`.
Modify `server/operations.ts`.

**Interfaces:**
- Consumes: `searchSanctionsWatchlist` (`server/operations.ts:2373`), `getDb`.
- Produces: `screenCustomer({ customerId, fullName, trigger, screenedByUserId })`.

- [x] **Step 1: Tulis ujinya lebih dulu.** Yang wajib ada:

```ts
describe("screenCustomer", () => {
  it("menulis baris meski TIDAK ada kecocokan — nihil adalah buktinya", () => {});
  it("mencatat listSnapshotAt dari importedAt terbaru yang sedang termuat", () => {});
  it("listSnapshotAt null bila belum ada daftar sama sekali", () => {});
  it("screenedByUserId null saat dipicu sistem", () => {});
  it("TIDAK pernah menyentuh dttotPpsdmMatch", () => {});
});
```

      **Uji pertama dan kelima adalah inti paket ini.** Yang pertama karena godaan "hanya simpan
      kalau ada temuan" akan menghapus justru bukti yang dicari pemeriksa. Yang kelima karena
      penyaringan otomatis membuat pengisian otomatis kotak centang terasa masuk akal — dan itu
      melanggar aturan yang sudah berlaku sejak `shared/sanctionsNameMatch.ts`.

- [x] **Step 2:** Tulis `screenCustomer`. Ringkasannya dibatasi panjangnya dan memuat nama beserta
      skor; jangan menyimpan seluruh baris daftar sanksi.

- [x] **Step 3:** Panggil dari `createCustomer` (`operations.ts:806`) dengan
      `trigger: "NASABAH_DIBUAT"` dan dari `updateCustomer` (`:936`) dengan `"NASABAH_DIUBAH"`.
      **Kegagalan penyaringan tidak boleh menggagalkan penyimpanan nasabah** — tangkap, catat ke
      `audit_logs`, lanjutkan. Nasabah yang gagal disimpan karena daftar sanksi bermasalah adalah
      kerugian yang lebih besar daripada satu baris jejak yang hilang.

- [x] **Step 4:** Perintah mutu, commit `"Penulis penyaringan nasabah terhadap DTTOT/DPPSPM"`.

---

### Task 3: Penyaringan ulang massal saat impor

**Files:** Modify `server/operations.ts` (`importSanctionsWatchlist`), test.

- [x] **Step 1: Uji lebih dulu:**

```ts
it("menyaring ulang SELURUH nasabah aktif sesudah impor, satu baris per nasabah", () => {});
it("memakai trigger DAFTAR_DIIMPOR dan screenedByUserId null", () => {});
it("listSnapshotAt seluruh baris barunya sama dengan importedAt impor itu", () => {});
```

- [x] **Step 2:** Jalankan sesudah impor berhasil, di luar transaksi impornya — penyaringan ulang
      yang gagal tidak boleh membatalkan daftar yang sudah masuk.

- [x] **Step 3:** Perintah mutu, commit `"Penyaringan ulang nasabah setiap daftar sanksi diimpor"`.

---

### Task 4: Gerbang persetujuan

**Files:** Create `server/customerHighRiskApproval.ts`, `.test.ts`. Modify `server/operations.ts`,
`server/routers.ts`.

- [ ] **Step 1: Uji fungsi murninya lebih dulu:**

```ts
describe("customerHighRiskDenial", () => {
  it("nasabah LOW/MEDIUM tidak pernah tertolak apa pun keputusannya", () => {});
  it("nasabah HIGH berkeputusan BELUM tertolak, pesannya menyebut SHAREHOLDER", () => {});
  it("nasabah HIGH berkeputusan DITOLAK tertolak", () => {});
  it("nasabah HIGH berkeputusan DISETUJUI lolos", () => {});
});
describe("decideHighRisk", () => {
  it("hanya SHAREHOLDER yang boleh memutuskan", () => {});
  it("menolak keputusan tanpa alasan tertulis", () => {});
  it("menulis audit_logs beserta keputusan sebelum dan sesudahnya", () => {});
});
```

- [ ] **Step 2:** Tegakkan pada `createTransaction` (`operations.ts:1447`), **di penulisnya**.

- [ ] **Step 3:** Terapkan aturan setel ulang pada `updateCustomer`: bila `riskLevel` berpindah
      **menjadi** `HIGH` dari nilai lain, setel `highRiskDecision` kembali ke `BELUM` beserta
      pengosongan tiga kolom penyertanya. Ujinya wajib memuat kasus `HIGH → HIGH` yang **tidak**
      menyetel ulang.

- [ ] **Step 4:** Perintah mutu, commit `"Persetujuan SHAREHOLDER untuk nasabah berisiko tinggi"`.

---

### Task 5: Halaman

**Files:** Modify `client/src/pages/CustomerList.tsx`, `client/src/pages/TransactionCreate.tsx`,
`server/routers.ts`.

- [ ] **Step 1:** Panel riwayat penyaringan pada detail nasabah: waktu, pemicu, oleh siapa
      (atau "otomatis"), banyaknya kemungkinan kecocokan. Keadaan kosong berbunyi jelas —
      *"Belum pernah disaring"* — bukan tabel kosong tanpa keterangan.

- [ ] **Step 2:** **Peringatan daftar usang** bila `listSnapshotAt` penyaringan terakhir lebih tua
      daripada `importedAt` terbaru. Inilah yang membedakan panel ini dari hiasan.

- [ ] **Step 3:** Kendali setujui/tolak, **hanya tampil bagi SHAREHOLDER** dan hanya bila
      `riskLevel = HIGH`. Wajib beralasan tertulis. Teks tombolnya menyebut akibatnya:
      *"Setujui — nasabah dapat bertransaksi"* dan *"Tolak — hentikan hubungan usaha"*.

- [ ] **Step 4:** Borang transaksi menampilkan alasan penolakan apa adanya beserta jalan keluarnya,
      bukan galat generik.

- [ ] **Step 5:** Perintah mutu, commit `"Halaman riwayat penyaringan dan keputusan risiko tinggi"`.

---

### Task 6: Peragaan end-to-end dan dokumentasi

- [ ] **Step 1:** Peragakan di basis data lokal, **di layar**, seluruh rantainya:
      buat nasabah → baris penyaringan otomatis muncul → impor ulang daftar → baris kedua muncul
      dengan `listSnapshotAt` baru → naikkan `riskLevel` ke `HIGH` → bon **ditolak** → SHAREHOLDER
      menyetujui → bon **berhasil**. Peragaan yang berhenti sebelum penolakan belum membuktikan apa
      pun.
- [ ] **Step 2:** Perbarui `BUKU-PANDUAN-PENGGUNAAN-A-Z.md` dan `SKEMA-DATABASE-PROJECT.md`.
- [ ] **Step 3:** Centang Status Pengerjaan di sini dan pada ROADMAP; salin risiko residual.
- [ ] **Step 4:** Perintah mutu, commit `"Peragaan dan dokumentasi Paket L"`.

---

## Risiko residual sesudah paket ini

1. Nasabah berisiko tinggi tidak dapat bertransaksi bila SHAREHOLDER tidak dapat dihubungi. Tidak
   ada jalur darurat, dan itu disengaja.
2. Penyaringan ulang massal menulis satu baris per nasabah setiap impor; pada puluhan ribu nasabah
   ia harus menjadi pekerjaan latar.
3. Pencocokan tetap fuzzy berambang 0,6. Paket ini menambah jejak, bukan ketepatan.
4. Tidak ada yang memaksa penyaringan ulang selain impor berikutnya.
5. Penjelasan pasal demi pasal PBI 10/2024 untuk Pasal 32 dan 47 belum dibaca.
6. Temuan 3 (pemblokiran serta merta dan percobaan transaksi) dan Temuan 4 (`deleteCompanyDocument`)
   tetap terbuka.
