# Paket M — Penatausahaan Dokumen dan Penghentian Penghapusan Sungguhan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghentikan satu-satunya jalur penghapusan sungguhan yang tersisa pada dokumen (`deleteCompanyDocument`) dengan mengikuti pola nonaktif-bukan-hapus milik Paket I, dan membangun pembuktian retensi Pasal 48 PBI 10/2024 bagi dokumen nasabah dan transaksi — termasuk penulis data bagi jam "berakhirnya hubungan usaha" yang selama ini tidak pernah dicatat.

**Architecture:** Empat kolom aditif (migrasi `0058`), satu berkas aturan murni `shared/documentRetention.ts` tanpa basis data, penulis `relationshipEndedAt` yang disisipkan ke `updateCustomer` dengan pola `highRiskResetValues`, dua fungsi operasi bergerbang murni di `server/companyProfileDocuments.ts` yang menggantikan `deleteCompanyDocument`, dua fungsi pembacaan di `server/documentRetentionQueries.ts`, dan satu halaman baru `PenatausahaanDokumen.tsx`. Otorisasi ditegakkan di penulis, bukan hanya di router — preseden `iraEditDenial` dan `highRiskDecisionDenial`.

**Tech Stack:** TypeScript, React, Express + tRPC, Drizzle ORM + MySQL, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-09-11-penatausahaan-dokumen-lima-tahun-design.md`

## Status Pengerjaan

Dikerjakan satu tugas per sesi. **Centang barisnya di sini setelah commit tugas itu**, supaya sesi
berikutnya tahu harus mulai dari mana tanpa membaca seluruh riwayat.

- [x] Tugas 1 — Migrasi kolom nonaktif dan `relationshipEndedAt` (0058)
- [x] Tugas 2 — `shared/documentRetention.ts` (aturan retensi murni)
- [x] Tugas 3 — Penulis `relationshipEndedAt` pada `updateCustomer`
- [x] Tugas 4 — `server/companyProfileDocuments.ts` menggantikan `deleteCompanyDocument`
- [ ] Tugas 5 — Uji penjaga: dokumen nasabah dan transaksi tidak punya jalur hapus
- [ ] Tugas 6 — Pembacaan retensi (`documentRetentionQueries.ts` + tRPC)
- [ ] Tugas 7 — Layar Profil Perusahaan: nonaktifkan dan hapus permanen
- [ ] Tugas 8 — Halaman Penatausahaan Dokumen
- [ ] Tugas 9 — Peragaan end-to-end dan dokumentasi

Urutannya mengikat: 1 sebelum semuanya; 2 sebelum 3, 6, dan 8; 4 sebelum 7; 6 sebelum 8.
Tugas 5 boleh dikerjakan kapan saja sesudah 4.

## Global Constraints

- `pnpm` tidak ada di PATH. Pakai `./node_modules/.bin/*`. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.
- Perintah mutu wajib sebelum tugas dianggap selesai: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vite build`.
- Muat variabel lingkungan lebih dulu, kalau tidak `server/internalAuth.developmentAccounts.test.ts` gagal sendirian dengan *"Database tidak tersedia"* — kegagalan lingkungan, bukan regresi:
  ```bash
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
  export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
  ```
- Baseline sebelum paket ini (dijalankan 10 September 2026 sesudah Paket L): **`Test Files 155 passed (155)`, `Tests 1357 passed | 2 skipped (1359)`**. Sebutkan angka yang benar-benar dilihat, jangan mengarang.
- `server/tenantIsolation.live.test.ts` diketahui flaky di bawah beban. Bila ia gagal sendirian, jalankan ulang berkas itu saja sebelum menyimpulkan regresi.
- Peran akses `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Otorisasi ditegakkan di tRPC/server, bukan disembunyikan di UI.
- Jangan menerapkan migrasi ke produksi. Hanya dua basis data lokal: `moneychanger` dan `mc_t_abcvalas`, lewat `node scripts/tenant.mjs migrate-all`. **Jangan** menjalankan berkas `.sql` langsung lewat klien mysql — penanda `--> statement-breakpoint` membuat pernyataan kedua gagal.
- Migrasi terakhir sebelum paket ini adalah `0057_dashing_morph.sql`; jurnal kedua basis data lokal **58**.
- **Jangan mengubah `company_documents`, `company_document_versions`, atau `server/companyDocumentArchive.ts`.** Arsip Paket I sudah benar; paket ini meniru polanya, bukan menyentuhnya.
- **Jangan menambahkan penghapus objek ke `server/storage.ts`.** Keputusan pengguna 11 September 2026: berkas yatim dibiarkan.
- **Jangan menambah helper jendela waktu keempat.** Batas hari, bulan, dan tahun operasional memakai `startOfOperationalDay` / `startOfOperationalMonth` pada `shared/regulatoryActionQueue.ts`.
- Data uji pada basis data lokal (`moneychanger`, `mc_t_abcvalas`) boleh dibuat tanpa meminta izin lebih dulu. Data uji paket sebelumnya jangan dibersihkan. `audit_logs` produksi tidak boleh dikarang atau disunting.
- Jangan menyebut `pnpm audit` bersih — sembilan temuan residual SheetJS/xlsx masih berlaku.

## Struktur Berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `drizzle/schema.ts` | Tiga kolom nonaktif pada `operationalDocuments`, `relationshipEndedAt` pada `customers` | 1 |
| `drizzle/0058_*.sql` | Migrasi aditif hasil generate | 1 |
| `shared/documentRetention.ts` | Aturan retensi murni + `relationshipEndValues` | 2 |
| `shared/documentRetention.test.ts` | Tabel penuh atas seluruh aturan di atas | 2 |
| `server/operations.ts` | Sisipan `relationshipEndValues` pada `updateCustomer` | 3 |
| `server/customerRelationshipEnd.test.ts` | Perpindahan status mengisi/mengosongkan kolomnya | 3 |
| `server/companyProfileDocuments.ts` | Dua gerbang + `deactivate…` + `purge…` | 4 |
| `server/documentOperations.ts` | Buang `deleteCompanyDocument`; saring `deactivatedAt` pada daftar | 4 |
| `server/companyProfileDocuments.test.ts` | Alasan wajib, tolak logo aktif, audit lengkap | 4 |
| `server/companyProfileDocuments.authorization.test.ts` | Peran mana boleh apa | 4 |
| `server/documentRetentionGuard.test.ts` | Dokumen `CUSTOMER`/`TRANSACTION` tidak punya jalur hapus | 5 |
| `server/documentRetentionQueries.ts` | `customerRetentionStatement`, `documentRetentionOverview` | 6 |
| `server/documentRetentionQueries.test.ts` | Pernyataan retensi per nasabah dan ringkasannya | 6 |
| `server/routers.ts` | Prosedur baru; buang `documents.deleteCompany` | 4, 6 |
| `client/src/pages/CompanyProfile.tsx` | Dialog nonaktifkan + hapus permanen + daftar nonaktif | 7 |
| `client/src/pages/PenatausahaanDokumen.tsx` | Halaman baru | 8 |
| `client/src/App.tsx`, `shared/backOfficeNavigation.ts` | Rute dan entri sidebar | 8 |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md` | Perilaku pengguna dan struktur data yang berubah | 9 |

---

### Task 1: Migrasi kolom nonaktif dan `relationshipEndedAt` (0058)

**Files:**
- Modify: `drizzle/schema.ts` (blok `operationalDocuments`, kolom `createdAt` ke bawah; blok `customers`, di dekat `profileStatus`)
- Create: `drizzle/0058_*.sql` (hasil generate, akhiran acak dari Drizzle)

**Interfaces:**
- Consumes: —
- Produces: `operationalDocuments.deactivatedAt` / `.deactivatedByUserId` / `.deactivationReason`, `customers.relationshipEndedAt`. Dipakai tugas 2–8.

- [x] **Step 1: Tambah tiga kolom nonaktif pada `operationalDocuments`**

Di `drizzle/schema.ts`, sisipkan tepat sebelum `createdAt` pada `operationalDocuments`:

```ts
  /**
   * Dinonaktifkan, bukan dihapus — pola yang sama dengan `companyDocuments` (keputusan pengguna
   * 8 September 2026). **Hanya berlaku bagi `ownerType = "COMPANY"`**: dokumen nasabah dan
   * transaksi tidak punya jalur nonaktif maupun hapus sama sekali, karena Pasal 48 PBI 10/2024
   * mewajibkan penatausahaannya.
   */
  deactivatedAt: datetime("deactivatedAt"),
  deactivatedByUserId: int("deactivatedByUserId"),
  deactivationReason: text("deactivationReason"),
```

Pastikan `datetime` sudah ada pada impor `drizzle-orm/mysql-core` di berkas ini (sudah dipakai
`companyDocuments`, jadi seharusnya ada).

- [x] **Step 2: Tambah `relationshipEndedAt` pada `customers`**

Sisipkan tepat sesudah baris `profileStatus`:

```ts
  /**
   * Kapan hubungan usaha berakhir — jam Pasal 48 ayat (1) huruf a angka 1 PBI 10/2024.
   *
   * Diisi saat `profileStatus` BERPINDAH menjadi `INACTIVE`, dikosongkan saat berpindah keluar
   * darinya. Diturunkan dari `updatedAt` berarti menebak: `updatedAt` bergerak pada setiap
   * penyuntingan apa pun, termasuk yang tidak menyentuh status.
   */
  relationshipEndedAt: datetime("relationshipEndedAt"),
```

- [x] **Step 3: Hasilkan migrasi**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
./node_modules/.bin/drizzle-kit generate
```

- [x] **Step 4: Baca SQL yang dihasilkan sebelum menerapkannya**

```bash
cat drizzle/0058_*.sql
```

Harapan: hanya `ALTER TABLE ... ADD ...` untuk empat kolom itu. **Bila ada `DROP`, `MODIFY`,
`TRUNCATE`, atau tabel di luar `operational_documents` dan `customers`, berhenti dan laporkan** —
migrasi ini harus murni aditif.

- [x] **Step 5: Terapkan ke dua basis data lokal**

```bash
export TENANT_REGISTRY="ibukota=mysql://root@127.0.0.1:3306/moneychanger;abcvalas=mysql://root@127.0.0.1:3306/mc_t_abcvalas"
node scripts/tenant.mjs migrate-all
```

- [x] **Step 6: Buktikan kolomnya benar-benar ada**

```bash
mysql -uroot -h127.0.0.1 moneychanger -e "SHOW COLUMNS FROM operational_documents LIKE 'deactivated%'; SHOW COLUMNS FROM customers LIKE 'relationshipEndedAt';"
```
Harapan: tiga baris + satu baris, seluruhnya `YES` pada kolom `Null`.

- [x] **Step 7: Pastikan tipe masih bersih**

```bash
./node_modules/.bin/tsc --noEmit
```

- [x] **Step 8: Commit**

```bash
git add drizzle/schema.ts drizzle/0058_*.sql drizzle/meta
git commit -m "Kolom nonaktif dokumen dan penanda berakhirnya hubungan usaha (migrasi 0058)"
```

---

### Task 2: `shared/documentRetention.ts` — aturan retensi murni

**Files:**
- Create: `shared/documentRetention.ts`, `shared/documentRetention.test.ts`

**Interfaces:**
- Consumes: `startOfOperationalMonth` dari `shared/regulatoryActionQueue.ts`
- Produces: `customerDocumentRetention`, `transactionDocumentRetention`, `companyProfileDocumentRetention`, `relationshipEndValues`, tipe `RetentionVerdict`. Dipakai tugas 3, 6, 8.

- [x] **Step 1: Tulis berkas aturannya**

Berkas ini **tidak boleh** mengimpor apa pun dari `server/` maupun `drizzle/`. Ia murni.

```ts
import { DEFAULT_OPERATIONAL_TIMEZONE, startOfOperationalMonth } from "./regulatoryActionQueue";

export const CUSTOMER_DOCUMENT_RETENTION_YEARS = 5;
/** UU Dokumen Perusahaan, dirujuk Pasal 48 ayat (1) huruf b — sepuluh tahun sejak akhir tahun buku. */
export const TRANSACTION_DOCUMENT_RETENTION_YEARS = 10;
/** Aturan rumah, BUKAN Pasal 48. Keputusan pengguna 11 September 2026: dihitung sejak diunggah. */
export const COMPANY_PROFILE_DOCUMENT_RETENTION_YEARS = 5;

export type CustomerProfileStatus = "ACTIVE" | "RESTRICTED" | "INACTIVE";

export type RetentionBasis =
  | "HUBUNGAN_USAHA_BERJALAN"
  | "HUBUNGAN_USAHA_BERAKHIR"
  | "TRANSAKSI_TERAKHIR"
  | "KETIDAKSESUAIAN_PROFIL"
  | "TAHUN_BUKU_TRANSAKSI"
  | "SEJAK_DIUNGGAH";

export type RetentionVerdict = {
  basis: RetentionBasis;
  /** Instan tempat jam mulai berdetak. `null` hanya ketika basisnya HUBUNGAN_USAHA_BERJALAN. */
  basisAt: Date | null;
  /** `null` berarti belum ada tenggat: ditahan tanpa batas sampai jamnya mulai berdetak. */
  retainUntil: Date | null;
  detail: string;
};

function addYears(value: Date, years: number) {
  const result = new Date(value.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}
```

- [x] **Step 2: Tulis `customerDocumentRetention`**

Kaidahnya: selama `profileStatus` belum `INACTIVE`, hubungan usaha **masih berjalan** dan tidak ada
tenggat. Sesudahnya, jam berdetak dari instan **paling akhir** di antara tiga pemicu Pasal 48.

```ts
export type CustomerRetentionFacts = {
  profileStatus: CustomerProfileStatus;
  relationshipEndedAt: Date | null;
  /** Transaksi COMPLETED terakhir (bukan demo, bukan historis). */
  lastCompletedTransactionAt: Date | null;
  /** Peninjauan profil terakhir yang `deviationReasons`-nya tidak kosong. */
  lastDeviationReviewAt: Date | null;
};

export function customerDocumentRetention(facts: CustomerRetentionFacts): RetentionVerdict {
  if (facts.profileStatus !== "INACTIVE" || !facts.relationshipEndedAt) {
    return {
      basis: "HUBUNGAN_USAHA_BERJALAN",
      basisAt: null,
      retainUntil: null,
      detail: "Hubungan usaha masih berjalan; jam lima tahun Pasal 48 belum mulai berdetak.",
    };
  }

  // Penjelasan Pasal 48 ayat (1) huruf b: yang dipakai adalah masa retensi yang TERLAMA.
  const candidates: { basis: RetentionBasis; at: Date }[] = [
    { basis: "HUBUNGAN_USAHA_BERAKHIR", at: facts.relationshipEndedAt },
  ];
  if (facts.lastCompletedTransactionAt) candidates.push({ basis: "TRANSAKSI_TERAKHIR", at: facts.lastCompletedTransactionAt });
  if (facts.lastDeviationReviewAt) candidates.push({ basis: "KETIDAKSESUAIAN_PROFIL", at: facts.lastDeviationReviewAt });

  const winner = candidates.reduce((a, b) => (b.at.getTime() > a.at.getTime() ? b : a));
  const retainUntil = addYears(winner.at, CUSTOMER_DOCUMENT_RETENTION_YEARS);
  return { basis: winner.basis, basisAt: winner.at, retainUntil, detail: retentionDetail(winner.basis, winner.at) };
}
```

`retentionDetail` adalah fungsi kecil di berkas yang sama yang memetakan basis menjadi kalimat
Indonesia siap tampil. Jangan menaruh kalimatnya di komponen React — layar dan uji harus memakai
kalimat yang sama persis.

- [x] **Step 3: Tulis `transactionDocumentRetention`**

> **Penyimpangan dari potongan kode di bawah (disengaja):** tahun buku dibaca lewat
> `operationalDateKey(transactionAt, timeZone)`, bukan `transactionAt.getUTCFullYear()`. Bon pukul
> 00:00–06:59 WIB tanggal 1 Januari masih 31 Desember UTC; potongan aslinya memasukkannya ke tahun
> buku sebelumnya dan memajukan tenggatnya setahun. Dikunci uji "bon pukul 00:30 WIB tanggal
> 1 Januari masuk tahun buku yang baru".

```ts
/**
 * Pasal 48 ayat (1) huruf b menunjuk UU Dokumen Perusahaan, yang menghitung sepuluh tahun sejak
 * AKHIR TAHUN BUKU — bukan sejak tanggal transaksinya. Bila aturan nasabah menghasilkan tanggal
 * yang lebih jauh, yang lebih jauh itulah yang berlaku: penjelasan ayat (1) huruf b menetapkan
 * "masa retensi yang terlama" sebagai kaidahnya.
 */
export function transactionDocumentRetention(
  transactionAt: Date,
  customerVerdict: RetentionVerdict,
  timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE,
): RetentionVerdict {
  const startOfNextYear = startOfOperationalMonth(new Date(Date.UTC(transactionAt.getUTCFullYear() + 1, 0, 15)), timeZone);
  const bookYearVerdict: RetentionVerdict = {
    basis: "TAHUN_BUKU_TRANSAKSI",
    basisAt: startOfNextYear,
    retainUntil: addYears(startOfNextYear, TRANSACTION_DOCUMENT_RETENTION_YEARS),
    detail: `${TRANSACTION_DOCUMENT_RETENTION_YEARS} tahun sejak akhir tahun buku ${transactionAt.getUTCFullYear()}.`,
  };
  // Nasabah tanpa tenggat (hubungan usaha masih berjalan) selalu menang: tanpa batas lebih lama
  // daripada tanggal mana pun.
  if (!customerVerdict.retainUntil) return customerVerdict;
  return customerVerdict.retainUntil.getTime() > bookYearVerdict.retainUntil!.getTime() ? customerVerdict : bookYearVerdict;
}
```

- [x] **Step 4: Tulis `companyProfileDocumentRetention` dan `relationshipEndValues`**

```ts
export function companyProfileDocumentRetention(createdAt: Date): RetentionVerdict {
  return {
    basis: "SEJAK_DIUNGGAH",
    basisAt: createdAt,
    retainUntil: addYears(createdAt, COMPANY_PROFILE_DOCUMENT_RETENTION_YEARS),
    detail: `Aturan rumah: ${COMPANY_PROFILE_DOCUMENT_RETENTION_YEARS} tahun sejak diunggah. Bukan kewajiban Pasal 48 — dokumen profil perusahaan bukan data Pengguna Jasa.`,
  };
}

/**
 * Meniru `highRiskResetValues` (`server/customerHighRiskApproval.ts`): hanya PERPINDAHAN yang
 * berarti. `INACTIVE → INACTIVE` sengaja tidak menyentuh apa pun — bila ia menyetel ulang, setiap
 * penyuntingan nasabah yang sudah tidak aktif akan memundurkan tenggat retensinya tanpa alasan.
 */
export function relationshipEndValues(
  previousStatus: CustomerProfileStatus,
  nextStatus: CustomerProfileStatus,
  now: Date,
) {
  if (nextStatus === "INACTIVE" && previousStatus !== "INACTIVE") return { relationshipEndedAt: now };
  if (nextStatus !== "INACTIVE" && previousStatus === "INACTIVE") return { relationshipEndedAt: null };
  return null;
}
```

- [x] **Step 5: Tulis ujinya**

`shared/documentRetention.test.ts` harus menutup, minimal:

1. `profileStatus: "ACTIVE"` → `retainUntil` `null`, basis `HUBUNGAN_USAHA_BERJALAN`.
2. `profileStatus: "INACTIVE"` dengan `relationshipEndedAt` terisi tetapi tanpa transaksi → basis `HUBUNGAN_USAHA_BERAKHIR`, `retainUntil` tepat lima tahun sesudahnya.
3. Transaksi terakhir **sesudah** `relationshipEndedAt` → basis `TRANSAKSI_TERAKHIR`.
4. Peninjauan menyimpang **sesudah** keduanya → basis `KETIDAKSESUAIAN_PROFIL`.
5. `transactionDocumentRetention` untuk transaksi 3 Maret 2024 → `retainUntil` 1 Januari 2035 WIB (akhir tahun buku 2024 + sepuluh tahun), ketika nasabahnya sudah `INACTIVE` lama.
6. **Kaidah terlama:** nasabah dengan `retainUntil` yang melampaui tanggal tahun buku → yang dikembalikan adalah putusan nasabahnya, bukan tahun bukunya.
7. Nasabah tanpa tenggat + transaksi lama → `transactionDocumentRetention` mengembalikan putusan tanpa tenggat.
8. `relationshipEndValues` untuk enam pasang perpindahan status, termasuk `INACTIVE → INACTIVE` yang harus mengembalikan `null`.

- [x] **Step 6: Jalankan uji berkas ini saja**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
./node_modules/.bin/vitest run shared/documentRetention.test.ts
```

- [x] **Step 7: Commit**

```bash
git add shared/documentRetention.ts shared/documentRetention.test.ts
git commit -m "Aturan retensi dokumen Pasal 48 sebagai fungsi murni"
```

---

### Task 3: Penulis `relationshipEndedAt` pada `updateCustomer`

**Files:**
- Modify: `server/operations.ts` (`updateCustomer`, sekitar baris 976–1030)
- Create: `server/customerRelationshipEnd.test.ts`

**Interfaces:**
- Consumes: `relationshipEndValues` dari tugas 2
- Produces: kolom `customers.relationshipEndedAt` yang benar-benar terisi. Dipakai tugas 6 dan 8.

- [x] **Step 1: Sisipkan penulisnya ke `nextValues`**

Di `server/operations.ts`, pada objek `nextValues` di dalam `updateCustomer`, tepat sesudah baris
`...(highRiskResetValues(existing.riskLevel, input.riskLevel) ?? {}),`:

```ts
    // Jam Pasal 48 ayat (1) huruf a angka 1: hanya PERPINDAHAN status yang berarti, bukan setiap
    // penyuntingan. Bentuknya sengaja sama persis dengan highRiskResetValues di atas.
    ...(relationshipEndValues(existing.profileStatus, input.profileStatus, new Date()) ?? {}),
```

Tambahkan impornya di kepala berkas:

```ts
import { relationshipEndValues } from "../shared/documentRetention";
```

- [x] **Step 2: Pastikan kolomnya ikut terekam pada audit**

Pada `beforeState` di `writeAudit` panggilan `CUSTOMER_UPDATED`, tambahkan
`relationshipEndedAt: existing.relationshipEndedAt,` di sebelah `profileStatus`. `afterState` sudah
memakai `nextValues` utuh, jadi ia ikut dengan sendirinya.

- [x] **Step 3: Tulis ujinya**

`server/customerRelationshipEnd.test.ts`, dengan `getDb` dipalsukan mengikuti bentuk
`server/customerHighRiskApproval.test.ts` yang sudah ada. Yang dijaga:

1. `ACTIVE → INACTIVE` menulis `relationshipEndedAt` bukan `null`.
2. `RESTRICTED → INACTIVE` juga menulisnya.
3. `INACTIVE → ACTIVE` menulis `relationshipEndedAt: null`.
4. `INACTIVE → INACTIVE` **tidak** menyertakan kunci `relationshipEndedAt` sama sekali pada objek
   `set()` — bukan sekadar tidak mengubahnya.
5. `ACTIVE → ACTIVE` juga tidak menyertakannya.

- [x] **Step 4: Jalankan uji berkas ini dan tetangganya**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
./node_modules/.bin/vitest run server/customerRelationshipEnd.test.ts server/customerHighRiskApproval.test.ts
```

- [x] **Step 5: Commit**

```bash
git add server/operations.ts server/customerRelationshipEnd.test.ts
git commit -m "Catat kapan hubungan usaha berakhir saat nasabah dinonaktifkan"
```

---

### Task 4: `server/companyProfileDocuments.ts` menggantikan `deleteCompanyDocument`

**Files:**
- Create: `server/companyProfileDocuments.ts`, `server/companyProfileDocuments.test.ts`, `server/companyProfileDocuments.authorization.test.ts`
- Modify: `server/documentOperations.ts` (buang `deleteCompanyDocument`, saring `deactivatedAt` pada `listCompanyDocuments`, tambah `listDeactivatedCompanyDocuments`), `server/routers.ts:810`

**Interfaces:**
- Consumes: `writeAudit` (`server/operations.ts:146`), `isRoleAllowed` (`shared/backOfficeNavigation.ts`)
- Produces: `companyProfileDocumentDeactivationDenial`, `companyProfileDocumentPurgeDenial`, `deactivateCompanyProfileDocument`, `purgeCompanyProfileDocument`. Dipakai tugas 7.

- [x] **Step 1: Tulis kedua gerbangnya**

Bentuknya meniru `server/customerHighRiskApproval.ts:34` baris demi baris.

```ts
type GateUser = { role: string; mustChangePassword: boolean };
type Denial = { status: 403; message: string } | null;

/** Menonaktifkan: CONTROLLER ke atas, sama seperti ambang mengunggahnya. */
export function companyProfileDocumentDeactivationDenial(user: GateUser): Denial {
  if (user.mustChangePassword) return { status: 403, message: "Ganti kata sandi terlebih dahulu sebelum menonaktifkan dokumen." };
  if (!isRoleAllowed(user.role as BackOfficeRole, "CONTROLLER")) {
    return { status: 403, message: "Hanya Controller ke atas yang dapat menonaktifkan dokumen profil perusahaan." };
  }
  return null;
}

/**
 * Menghapus permanen: **hanya SHAREHOLDER**, Controller sekalipun tidak. Keputusan pengguna
 * 11 September 2026 — jalur ini ada untuk berkas salah unggah yang memuat data pribadi pihak lain,
 * bukan untuk kerapian.
 */
export function companyProfileDocumentPurgeDenial(user: GateUser): Denial {
  if (user.mustChangePassword) return { status: 403, message: "Ganti kata sandi terlebih dahulu sebelum menghapus dokumen." };
  if (!isRoleAllowed(user.role as BackOfficeRole, "SHAREHOLDER")) {
    return { status: 403, message: "Hanya Pemegang Saham yang dapat menghapus permanen dokumen profil perusahaan." };
  }
  return null;
}
```

- [x] **Step 2: Tulis penjaga bersama yang dipakai kedua fungsi**

```ts
async function loadPurgeableDocument(db: Db, documentId: number) {
  const [document] = await db.select().from(operationalDocuments)
    .where(eq(operationalDocuments.id, documentId)).limit(1);
  if (!document) throw new Error("Dokumen tidak ditemukan.");
  if (document.ownerType !== "COMPANY") {
    throw new Error("Hanya dokumen profil perusahaan yang dapat dinonaktifkan atau dihapus. Dokumen nasabah dan transaksi wajib ditatausahakan (Pasal 48 PBI 10/2024).");
  }
  const [profile] = await db.select({ logoDocumentId: companyProfile.logoDocumentId }).from(companyProfile).limit(1);
  if (profile?.logoDocumentId === documentId) {
    throw new Error("Logo yang sedang dipakai tidak dapat dinonaktifkan atau dihapus. Ganti logonya lebih dulu.");
  }
  return document;
}
```

- [x] **Step 3: Tulis `deactivateCompanyProfileDocument`**

Bentuknya meniru `deactivateCompanyDocument` (`server/companyDocumentArchive.ts:221`).

```ts
export async function deactivateCompanyProfileDocument(
  input: { documentId: number; reason: string },
  actor: { id: number },
) {
  const reason = input.reason?.trim();
  if (!reason) throw new Error("Alasan penonaktifan wajib diisi.");

  const db = await databaseOrThrow();
  const document = await loadPurgeableDocument(db, input.documentId);
  if (document.deactivatedAt) throw new Error("Dokumen sudah nonaktif.");

  const deactivatedAt = new Date();
  await db.update(operationalDocuments)
    .set({ deactivatedAt, deactivatedByUserId: actor.id, deactivationReason: reason })
    .where(eq(operationalDocuments.id, input.documentId));

  await writeAudit({
    actorUserId: actor.id,
    action: "COMPANY_PROFILE_DOCUMENT_DEACTIVATED",
    entityType: "operational_documents",
    entityId: String(input.documentId),
    reason,
    beforeState: { originalFileName: document.originalFileName, documentType: document.documentType, deactivatedAt: null },
    afterState: { deactivatedAt, deactivatedByUserId: actor.id },
  });
}
```

- [x] **Step 4: Tulis `purgeCompanyProfileDocument`**

Auditnya ditulis **sebelum** `DELETE`, dan memuat metadata lengkap berkasnya — sesudah barisnya
lenyap, `audit_logs` adalah satu-satunya tempat jejaknya bisa hidup.

```ts
export async function purgeCompanyProfileDocument(
  input: { documentId: number; reason: string },
  actor: { id: number },
) {
  const reason = input.reason?.trim();
  if (!reason) throw new Error("Alasan penghapusan permanen wajib diisi.");

  const db = await databaseOrThrow();
  const document = await loadPurgeableDocument(db, input.documentId);

  await writeAudit({
    actorUserId: actor.id,
    action: "COMPANY_PROFILE_DOCUMENT_PURGED",
    entityType: "operational_documents",
    entityId: String(input.documentId),
    reason,
    beforeState: {
      documentType: document.documentType, originalFileName: document.originalFileName,
      storageKey: document.storageKey, mimeType: document.mimeType, byteSize: document.byteSize,
      uploadedByUserId: document.uploadedByUserId, createdAt: document.createdAt,
      deactivatedAt: document.deactivatedAt,
    },
    // Jujur, bukan kosmetik: `server/storage.ts` tidak punya penghapus objek, jadi berkasnya tertinggal.
    metadata: { storageObjectRetained: true },
  });

  await db.delete(operationalDocuments).where(eq(operationalDocuments.id, input.documentId));
}
```

- [x] **Step 5: Buang `deleteCompanyDocument` dan saring daftarnya**

Di `server/documentOperations.ts`: hapus fungsi `deleteCompanyDocument` seluruhnya, lalu ubah
`listCompanyDocuments` menjadi menyaring yang aktif dan tambahkan saudaranya:

```ts
export async function listCompanyDocuments() {
  const db = await databaseOrThrow();
  return db.select().from(operationalDocuments)
    .where(and(eq(operationalDocuments.ownerType, "COMPANY"), isNull(operationalDocuments.deactivatedAt)))
    .orderBy(desc(operationalDocuments.createdAt));
}

/** Dokumen yang sudah dinonaktifkan, beserta alasan dan pelakunya. Arsip yang lenyap dari layar sama saja dengan yang dihapus. */
export async function listDeactivatedCompanyDocuments() {
  const db = await databaseOrThrow();
  return db.select().from(operationalDocuments)
    .where(and(eq(operationalDocuments.ownerType, "COMPANY"), isNotNull(operationalDocuments.deactivatedAt)))
    .orderBy(desc(operationalDocuments.deactivatedAt));
}
```

Tambahkan `isNull`, `isNotNull` pada impor `drizzle-orm`.

- [x] **Step 6: Ganti prosedur tRPC**

Di `server/routers.ts`, buang baris `deleteCompany` (`:810`) dan gantikan dengan tiga prosedur.
Gerbangnya dipanggil **di dalam** prosedurnya juga, bukan hanya diandalkan dari `*Procedure` —
preseden Paket J2 dan L: gerbang peran di router menjaga layar, penulisnya yang menjaga data.

```ts
    deactivateCompany: controllerProcedure
      .input(z.object({ documentId: z.number().int().positive(), reason: z.string().min(5) }))
      .mutation(({ input, ctx }) => deactivateCompanyProfileDocument(input, { id: ctx.user.id })),
    purgeCompany: shareholderProcedure
      .input(z.object({ documentId: z.number().int().positive(), reason: z.string().min(5) }))
      .mutation(({ input, ctx }) => purgeCompanyProfileDocument(input, { id: ctx.user.id })),
    forCompanyDeactivated: controllerProcedure.query(() => listDeactivatedCompanyDocuments()),
```

Sesuaikan bentuk `ctx.user` dengan yang benar-benar dipakai prosedur lain di berkas itu — baca
`decideHighRisk` (`server/routers.ts:791`) sebagai contoh yang paling dekat.

- [x] **Step 7: Tulis uji perilakunya**

`server/companyProfileDocuments.test.ts`, `getDb` dipalsukan:

1. Alasan kosong / hanya spasi ditolak, pada kedua fungsi.
2. Dokumen `ownerType = "CUSTOMER"` ditolak dengan pesan yang menyebut Pasal 48.
3. Dokumen yang sedang dipakai sebagai `logoDocumentId` ditolak, pada kedua fungsi.
4. Menonaktifkan dokumen yang sudah nonaktif ditolak.
5. Nonaktif berhasil → `set()` memuat ketiga kolomnya dan satu baris audit `COMPANY_PROFILE_DOCUMENT_DEACTIVATED` tertulis.
6. Purge berhasil → audit ditulis **sebelum** `delete`, `beforeState` memuat `storageKey`, dan `metadata.storageObjectRetained` bernilai `true`.

- [x] **Step 8: Tulis uji otorisasinya**

`server/companyProfileDocuments.authorization.test.ts` — tabel peran murni atas kedua gerbang:

| Peran | `mustChangePassword` | Nonaktif | Hapus permanen |
|---|---|---|---|
| STAFF | false | ditolak | ditolak |
| ADMIN | false | ditolak | ditolak |
| CONTROLLER | false | **boleh** | ditolak |
| SHAREHOLDER | false | **boleh** | **boleh** |
| SHAREHOLDER | true | ditolak | ditolak |

- [x] **Step 9: Jalankan seluruh uji**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
```

Uji lama yang menyebut `deleteCompanyDocument` akan gagal dan **itu disengaja** — perbarui atau
buang uji itu, dan sebutkan perubahan jumlahnya pada laporan.

- [x] **Step 10: Commit**

```bash
git add server/companyProfileDocuments.ts server/companyProfileDocuments.test.ts server/companyProfileDocuments.authorization.test.ts server/documentOperations.ts server/routers.ts
git commit -m "Nonaktifkan dokumen profil perusahaan; hapus permanen hanya untuk Pemegang Saham"
```

---

### Task 5: Uji penjaga — dokumen nasabah dan transaksi tidak punya jalur hapus

**Files:**
- Create: `server/documentRetentionGuard.test.ts`

**Interfaces:**
- Consumes: sumber `server/` sebagai teks
- Produces: — (uji penjaga murni)

Inilah uji yang benar-benar mengunci sisi Pasal 48. Tanpa ia, paket berikutnya dapat menambahkan
jalur hapus baru tanpa ada yang mengeluh.

- [ ] **Step 1: Tulis penjaganya**

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pasal 48 PBI 10/2024 mewajibkan penatausahaan dokumen Pengguna Jasa. Satu-satunya penghapusan
 * baris `operational_documents` yang boleh ada di repo ini adalah `purgeCompanyProfileDocument`,
 * yang berpagar `ownerType = "COMPANY"` dan hanya dapat dijalankan SHAREHOLDER.
 */
describe("penjaga penatausahaan dokumen", () => {
  it("hanya companyProfileDocuments.ts yang menghapus baris operational_documents", () => {
    const dir = join(process.cwd(), "server");
    const offenders = readdirSync(dir)
      .filter((name) => name.endsWith(".ts") && !name.includes(".test."))
      .filter((name) => name !== "companyProfileDocuments.ts")
      .filter((name) => /delete\(\s*operationalDocuments\s*\)/.test(readFileSync(join(dir, name), "utf8")));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Buktikan penjaganya benar-benar menangkap**

Sisipkan sementara `db.delete(operationalDocuments)` ke `server/documentOperations.ts`, jalankan
ujinya, pastikan ia **gagal**, lalu kembalikan berkasnya. Penjaga yang tidak pernah dibuktikan
menangkap adalah penjaga yang belum tentu menangkap.

```bash
./node_modules/.bin/vitest run server/documentRetentionGuard.test.ts
git diff --stat   # harus kosong sesudah dikembalikan
```

- [ ] **Step 3: Commit**

```bash
git add server/documentRetentionGuard.test.ts
git commit -m "Uji penjaga: dokumen nasabah dan transaksi tidak punya jalur hapus"
```

---

### Task 6: Pembacaan retensi dan prosedur tRPC-nya

**Files:**
- Create: `server/documentRetentionQueries.ts`, `server/documentRetentionQueries.test.ts`
- Modify: `server/routers.ts`

**Interfaces:**
- Consumes: aturan dari tugas 2, kolom dari tugas 1 dan 3
- Produces: `customerRetentionStatement`, `documentRetentionOverview`, dan prosedur `documents.retentionStatement` / `documents.retentionOverview`. Dipakai tugas 8.

- [ ] **Step 1: Tulis `customerRetentionStatement`**

Menjawab Pasal 48 ayat (4) untuk satu nasabah dalam satu panggilan. Bacaannya:

- `customers` — identitas, `profileStatus`, `relationshipEndedAt`
- transaksi `COMPLETED` terakhir: `exchangeTransactions` dengan `status = "COMPLETED"`, `isDemo = false`, `isHistorical = false`, urut `transactionAt` menurun, `limit(1)`
- peninjauan menyimpang terakhir: `customerProfileReviews` yang `deviationReasons`-nya tidak kosong, urut `reviewedAt` menurun
- dokumen `ownerType = "CUSTOMER"` milik nasabah itu, masing-masing dengan `customerDocumentRetention`
- dokumen `ownerType = "TRANSACTION"` per bon, masing-masing dengan `transactionDocumentRetention`
- jumlah baris `customerWatchlistScreenings` dan `customerProfileReviews`

Kembalikan juga baris korespondensi **apa adanya**, bukan angka nol:

```ts
    korespondensi: {
      tersedia: false as const,
      keterangan: "Korespondensi dengan nasabah (Pasal 48 ayat (2) huruf d) tidak ditatausahakan di aplikasi ini. Pengaduan konsumen berkunci pada nomor identitas pelapor, bukan pada nasabah.",
    },
```

- [ ] **Step 2: Tulis `documentRetentionOverview`**

```ts
export async function documentRetentionOverview({ asOf = new Date() }: { asOf?: Date } = {}) {
  // Jumlah nasabah yang hubungan usahanya sudah berakhir, berapa yang tenggat retensinya sudah
  // lewat, dan berapa dokumen profil perusahaan yang lewat aturan rumah lima tahun.
  //
  // Yang sudah lewat tenggat TIDAK dihapus dan tidak diusulkan dihapus: Pasal 48 menetapkan batas
  // PALING SINGKAT, dan ayat (6) justru membolehkan lebih lama.
}
```

- [ ] **Step 3: Daftarkan prosedurnya**

```ts
    retentionStatement: controllerProcedure
      .input(z.object({ customerId: z.number().int().positive() }))
      .query(({ input }) => customerRetentionStatement(input.customerId)),
    retentionOverview: controllerProcedure.query(() => documentRetentionOverview()),
```

- [ ] **Step 4: Tulis ujinya**

`server/documentRetentionQueries.test.ts`, `getDb` dipalsukan:

1. Nasabah `ACTIVE` → seluruh dokumennya `retainUntil: null`.
2. Nasabah `INACTIVE` dengan transaksi lama → dokumen `CUSTOMER` memakai jam nasabah, dokumen `TRANSACTION` memakai tahun buku.
3. Nasabah tanpa dokumen sama sekali → daftar kosong, **bukan** galat, dan baris korespondensinya tetap muncul dengan `tersedia: false`.
4. `documentRetentionOverview` menghitung yang lewat tenggat dengan `asOf` yang disuntikkan, bukan `new Date()` di dalam.

- [ ] **Step 5: Jalankan uji dan tipe**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
./node_modules/.bin/vitest run server/documentRetentionQueries.test.ts
./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add server/documentRetentionQueries.ts server/documentRetentionQueries.test.ts server/routers.ts
git commit -m "Pernyataan retensi per nasabah dan ringkasan penatausahaan"
```

---

### Task 7: Layar Profil Perusahaan — nonaktifkan dan hapus permanen

**Files:**
- Modify: `client/src/pages/CompanyProfile.tsx` (baris 105 mutasi, 177 dan 185 daftar dokumen)

**Interfaces:**
- Consumes: `documents.deactivateCompany`, `documents.purgeCompany`, `documents.forCompanyDeactivated` dari tugas 4
- Produces: —

- [ ] **Step 1: Ganti mutasinya**

Buang `deleteDocument` (`:105`). Gantikan dengan dua mutasi, masing-masing meng-invalidate
`documents.forCompany` **dan** `documents.forCompanyDeactivated`.

- [ ] **Step 2: Ganti kedua ikon tong sampah**

Pada `:177` (sertifikat) dan `:185` (lampiran), ganti tombol tong sampah yang memanggil
`mutate` langsung menjadi dua tombol yang membuka dialog. **Tidak ada tindakan destruktif tanpa
dialog** — keadaan hari ini, yang menghapus dari satu klik ikon, adalah bagian dari temuannya.

- *Nonaktifkan* — `Textarea` alasan, wajib minimal 5 karakter, tombol utama dimatikan selama alasan kosong.
- *Hapus permanen* — dialog terpisah, hanya dirender bila `user.role === "SHAREHOLDER"`, teks
  tindakannya jelas: `"Hapus permanen"`, dan berisi kalimat *"Baris metadatanya lenyap dan tidak
  dapat dikembalikan. Berkasnya sendiri tetap tertinggal di penyimpanan."* — karena memang begitu.

Fokus keyboard mengikuti komponen `Dialog` yang sudah dipakai halaman lain; jangan menulis dialog
sendiri.

- [ ] **Step 3: Tambah bagian dokumen nonaktif**

Satu `Card` di bawah daftar lampiran: nama berkas, tanggal nonaktif, alasan, dan siapa yang
menonaktifkan. Empty state: *"Belum ada dokumen yang dinonaktifkan."* Bagian ini hanya dirender
bagi CONTROLLER ke atas.

- [ ] **Step 4: Verifikasi visual**

Jalankan server dev, buka `/operasional/profil-perusahaan` sebagai CONTROLLER lalu sebagai
SHAREHOLDER. Buktikan:

1. CONTROLLER melihat *Nonaktifkan* tetapi **tidak** melihat *Hapus permanen*.
2. SHAREHOLDER melihat keduanya.
3. Menonaktifkan tanpa alasan tidak dapat dikirim.
4. Dokumen yang dinonaktifkan pindah dari daftar atas ke bagian nonaktif.

Tugas 9 yang menyiapkan datanya bila belum ada dokumen `COMPANY` sama sekali — basis data lokal
memuat **nol** baris `ownerType = "COMPANY"`. Bila demikian, unggah satu berkas uji lebih dulu
lewat layarnya sendiri.

- [ ] **Step 5: Build dan commit**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add client/src/pages/CompanyProfile.tsx
git commit -m "Layar profil perusahaan: nonaktifkan berdialog, hapus permanen hanya Pemegang Saham"
```

---

### Task 8: Halaman Penatausahaan Dokumen

**Files:**
- Create: `client/src/pages/PenatausahaanDokumen.tsx`
- Modify: `client/src/App.tsx`, `shared/backOfficeNavigation.ts:78`

**Interfaces:**
- Consumes: `documents.retentionOverview`, `documents.retentionStatement` dari tugas 6
- Produces: rute `/kepatuhan/penatausahaan-dokumen`

- [ ] **Step 1: Tulis halamannya**

Dua bagian:

1. **Ringkasan** dari `retentionOverview` — nasabah dengan hubungan usaha berakhir, yang tenggat
   retensinya lewat, dokumen perusahaan yang lewat aturan rumah. Setiap kartu menyebut dasar
   hukumnya di bawah angkanya; pemeriksa tidak boleh perlu menebak.
2. **Pernyataan per nasabah** — pemilih nasabah, lalu tabel dokumen dengan kolom *Dokumen*,
   *Dasar retensi*, *Ditahan sampai*. Kalimat dasarnya diambil dari `verdict.detail`, bukan disusun
   ulang di komponen.

Baris korespondensi ditampilkan sebagai keterangan *tidak ditatausahakan di aplikasi ini* —
**bukan** angka nol. Loading, empty, dan error state wajib ada ketiganya.

- [ ] **Step 2: Daftarkan rutenya**

`client/src/App.tsx`, mengikuti bentuk `PemantauanProfil` (`:31` dan `:106`):

```tsx
const PenatausahaanDokumen = lazy(() => import("./pages/PenatausahaanDokumen"));
// …
<Route path="/kepatuhan/penatausahaan-dokumen"><OperationsRoute minimumRole="CONTROLLER" page={<PenatausahaanDokumen />} /></Route>
```

`shared/backOfficeNavigation.ts`, di kelompok **Pengawasan**, tepat sesudah *Arsip Dokumen*:

```ts
      { label: "Penatausahaan Dokumen", path: "/kepatuhan/penatausahaan-dokumen", minimumRole: "CONTROLLER" },
```

- [ ] **Step 3: Verifikasi visual**

Buka halamannya. **Halaman kosong belum membuktikan apa pun** — bila tidak ada nasabah `INACTIVE`
sama sekali di basis data lokal, tugas 9 yang menyiapkannya; kerjakan tugas 9 lebih dulu bila
perlu, lalu kembali dan tangkap layarnya.

- [ ] **Step 4: Build dan commit**

```bash
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build
git add client/src/pages/PenatausahaanDokumen.tsx client/src/App.tsx shared/backOfficeNavigation.ts
git commit -m "Halaman penatausahaan dokumen untuk pemeriksa"
```

---

### Task 9: Peragaan end-to-end dan dokumentasi

**Files:**
- Modify: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md`

**Interfaces:**
- Consumes: seluruh tugas sebelumnya
- Produces: bukti bahwa paketnya berjalan sungguhan

- [ ] **Step 1: Siapkan data uji lokal**

Diizinkan tanpa meminta izin lebih dulu pada `moneychanger` dan `mc_t_abcvalas`. **Jangan**
membersihkan data uji paket sebelumnya.

Yang dibutuhkan: satu nasabah uji yang pernah bertransaksi lalu ditandai `INACTIVE` lewat layarnya
sendiri (bukan `UPDATE` langsung — yang diuji justru penulisnya), dan dua dokumen profil perusahaan
yang diunggah lewat layarnya sendiri.

- [ ] **Step 2: Telusuri skenario nyata dari ujung ke ujung**

1. Nasabah baru → unggah KTP → transaksi selesai → halaman Penatausahaan menunjukkan
   *hubungan usaha masih berjalan*, tanpa tenggat.
2. Nasabah itu ditandai `INACTIVE` → `relationshipEndedAt` terisi → halaman menunjukkan tenggat
   lima tahun, dan basisnya menyebut transaksi terakhir bila transaksinya lebih akhir.
3. Nasabah itu diaktifkan kembali → tenggatnya hilang lagi.
4. Dokumen perusahaan dinonaktifkan CONTROLLER dengan alasan → hilang dari daftar atas, muncul di
   daftar nonaktif, satu baris `audit_logs` bertambah.
5. SHAREHOLDER menghapus permanen satu dokumen → barisnya lenyap, `audit_logs`-nya memuat
   `storageKey` dan `storageObjectRetained: true`.
6. CONTROLLER mencoba menghapus permanen → ditolak 403 dengan pesan yang benar.

Buktikan langkah 4 dan 5 dari basis data, bukan dari layar saja:

```bash
mysql -uroot -h127.0.0.1 moneychanger -e "SELECT action, entityId, reason, JSON_EXTRACT(metadata,'\$.storageObjectRetained') FROM audit_logs WHERE action LIKE 'COMPANY_PROFILE_DOCUMENT%' ORDER BY id DESC LIMIT 5;"
```

- [ ] **Step 3: Perbarui panduan A–Z**

Tambahkan bagian penatausahaan dokumen: apa arti nonaktif, siapa yang boleh menghapus permanen dan
mengapa hanya dia, apa arti "ditahan sampai" pada halaman baru, dan kalimat tegas bahwa aplikasi ini
**tidak** menghapus dokumen nasabah maupun transaksi.

- [ ] **Step 4: Perbarui skema database**

Empat kolom baru pada `docs/SKEMA-DATABASE-PROJECT.md`, beserta alasan `relationshipEndedAt` tidak
diturunkan dari `updatedAt`.

- [ ] **Step 5: Perintah mutu penuh, dan baca keluarannya**

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

Sebutkan angka uji yang **benar-benar dilihat**, dan jelaskan selisihnya terhadap baseline
`1357 passed | 2 skipped`. Jangan menyebut `pnpm audit` bersih.

- [ ] **Step 6: Commit**

```bash
git add docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md docs/SKEMA-DATABASE-PROJECT.md
git commit -m "Peragaan dan dokumentasi Paket M"
```
