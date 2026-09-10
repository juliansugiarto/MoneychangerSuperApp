# Paket M — Penatausahaan dokumen dan penghentian penghapusan sungguhan

Tanggal 11 September 2026. Disetujui sebelum implementasi.

Menutup **Temuan 4** pada `specs/2026-09-09-pbi-10-2024-temuan-awal.md` — dengan premis yang sudah
diperbaiki, lihat bagian pertama di bawah.

## Masalah

### 0. Premis Temuan 4 keliru, dan itu ditemukan sebelum merancang

Temuan 4 ditulis tanpa membaca batang tubuh dan penjelasan Pasal 48. Naskahnya sudah dibaca
11 September 2026 dari `PBI_102024.pdf` milik pengguna (**tidak** disalin ke repo).

**Pasal 48 ayat (1)** berpagar tegas pada CDD:

> *"**Dalam pelaksanaan customer due diligence**, Penyelenggara wajib melakukan penatausahaan
> dokumen sebagaimana dimaksud dalam **Pasal 15 ayat (5) huruf b** yang terkait dengan: a. **data
> Pengguna Jasa** dengan jangka waktu paling singkat 5 (lima) tahun sejak: 1. berakhirnya hubungan
> usaha atau Transaksi dengan Pengguna Jasa; atau 2. ditemukan ketidaksesuaian Transaksi dengan
> profil risiko Pengguna Jasa; dan b. **Transaksi keuangan Pengguna Jasa** dengan jangka waktu
> sebagaimana dimaksud dalam Undang-Undang mengenai dokumen perusahaan dan Undang-Undang mengenai
> pelindungan data pribadi."*

Ayat (2) merinci isinya: identitas Pengguna Jasa dan dokumen pendukungnya, bukti verifikasi, hasil
pemantauan dan analisis, dan **korespondensi dengan Pengguna Jasa**. Pasal 15 berada di dalam BAB IV
Customer Due Diligence.

**Penjelasannya** hampir seluruhnya "Cukup jelas", dengan satu tambahan yang justru memperberat —
penjelasan ayat (1) huruf b:

> *"Jangka waktu yang digunakan adalah jangka waktu dengan **masa retensi yang terlama**."*

Penjelasan Pasal 9, 32, dan 47 juga sudah dibaca pada kesempatan yang sama. Tidak satu pun mengubah
Temuan 1, 2, 5, atau 7 — ketiganya memperluas contoh, tidak menyempitkan kewajiban.

Akibatnya bagi Temuan 4: yang dapat dihapus `deleteCompanyDocument` **bukan dokumen Pasal 48**.
Ia hanya menyentuh `ownerType = "COMPANY"`, yaitu tiga jenis pada
`server/documentOperations.ts:17` — `COMPANY_LOGO`, `LICENSE_CERTIFICATE`, `LICENSE_ATTACHMENT`.
Logo perusahaan dan berkas izin usaha bukan data Pengguna Jasa. **Kalimat Temuan 4 bahwa "dokumen
yang wajib ditatausahakan lima tahun dapat hilang tanpa jejak" tidak berlaku bagi dokumen-dokumen
itu.**

Temuan 4 tetap temuan nyata, tetapi **derajatnya turun**: dari bersinggungan dengan kewajiban
Pasal 48 menjadi penyimpangan pola dan disiplin audit. Dan pada saat yang sama muncul pekerjaan
Pasal 48 yang **sungguhan** dan belum pernah dicatat di mana pun — lihat Masalah 2.

### 1. `deleteCompanyDocument` menyimpang dari pola yang sudah ada di repo ini

`server/documentOperations.ts:153`:

```ts
export async function deleteCompanyDocument(documentId: number) {
  const db = await databaseOrThrow();
  const document = (await db.select().from(operationalDocuments).where(and(eq(operationalDocuments.id, documentId), eq(operationalDocuments.ownerType, "COMPANY"))).limit(1))[0];
  if (!document) throw new Error("Dokumen tidak ditemukan.");
  await db.delete(operationalDocuments).where(eq(operationalDocuments.id, documentId));
}
```

Yang salah, satu per satu:

| Hal | Keadaan hari ini |
|---|---|
| Audit | **Tidak ada.** Tidak ada `writeAudit`, tidak ada baris `audit_logs`. |
| Alasan tertulis | **Tidak ada.** Tandatangannya hanya `documentId`. |
| Objek di penyimpanan | **Tertinggal.** `server/storage.ts` hanya punya `storagePut`, `storageGet`, `storageGetSignedUrl` — tidak ada penghapus objek sama sekali. Barisnya lenyap, berkasnya menjadi yatim. |
| Konfirmasi di layar | **Tidak ada.** `client/src/pages/CompanyProfile.tsx:177` dan `:185` memanggil `deleteDocument.mutate` langsung dari ikon tong sampah, tanpa dialog. |
| Rujukan yang menggantung | `company_profile.logoDocumentId` (`drizzle/schema.ts:796`) menunjuk baris ini. Menghapus logo yang sedang dipakai membuat rujukan itu menunjuk baris yang tidak ada. |

Pemanggilnya tunggal: `documents.deleteCompany` (`server/routers.ts:810`, `controllerProcedure`),
dipakai `client/src/pages/CompanyProfile.tsx:105`.

**Polanya sudah ada di repo ini dan tinggal diikuti.** Arsip dokumen perusahaan Paket I memakai
nonaktif-bukan-hapus: `company_documents.deactivatedAt` / `deactivatedByUserId` /
`deactivationReason`, dengan `deactivateCompanyDocument` (`server/companyDocumentArchive.ts:221`)
yang mewajibkan alasan dan menulis audit `COMPANY_DOCUMENT_DEACTIVATED`. Jalur lama inilah yang
menyimpang, bukan sebaliknya.

### 2. Sisi Pasal 48 yang sesungguhnya: tidak ada yang dapat menjawab "ditahan sampai kapan"

Dokumen yang benar-benar diikat Pasal 48 adalah `ownerType = "CUSTOMER"` (KTP) dan
`"TRANSACTION"` (underlying). Kabar baiknya: ditelusuri ke seluruh repo, **tidak ada satu pun
jalur penghapusannya** — tidak ada `delete(customers)`, tidak ada `delete(exchangeTransactions)`,
dan tidak ada penghapusan `operational_documents` selain jalur COMPANY di atas. Dari sisi
kelestarian, Pasal 48 sudah aman.

Yang tidak ada adalah **pembuktiannya**. Tidak ada kolom, tampilan, atau laporan yang dapat
menjawab dua pertanyaan pemeriksa:

1. *"Dokumen nasabah ini ditahan sampai kapan, dan atas dasar apa?"*
2. Pasal 48 ayat (4): *"Tunjukkan sekarang seluruh dokumen yang ditatausahakan untuk nasabah ini."*

Dan satu penghalang teknis: **jam Pasal 48 ayat (1) huruf a angka 1 tidak punya penulis data.**
"Berakhirnya hubungan usaha" paling dekat diwakili `customers.profileStatus = "INACTIVE"`, tetapi
tidak ada kolom yang mencatat **kapan** ia menjadi INACTIVE. Tanpa itu jam retensinya tidak dapat
dihitung sama sekali — dan menurunkannya dari `updatedAt` berarti menebak, karena `updatedAt`
bergerak pada setiap penyuntingan apa pun.

Dua pemicu lainnya sudah punya penulis dan tidak perlu dibangun:

| Pemicu Pasal 48 | Penulis datanya |
|---|---|
| berakhirnya **Transaksi** | `exchange_transactions.transactionAt` (status `COMPLETED`, bukan demo/historis) |
| **ketidaksesuaian** Transaksi dengan profil risiko | `customer_profile_reviews.deviationReasons` / `reviewedAt` (Paket L) |
| berakhirnya **hubungan usaha** | **belum ada** — dibangun paket ini |

Isi Pasal 48 ayat (2) juga sudah punya penulisnya masing-masing, kecuali satu:

| Ayat (2) | Sumber data |
|---|---|
| a. identitas dan dokumen pendukung | `customers` + `operational_documents` (`CUSTOMER`/`KTP_PHOTO`) |
| b. bukti verifikasi | `customer_watchlist_screenings` (Paket L) |
| c. hasil pemantauan dan analisis | `customer_profile_reviews` (Paket L) |
| d. **korespondensi dengan Pengguna Jasa** | **tidak ada.** `consumer_complaints` berkunci pada `reporterIdentityNumber` dan tidak punya `customerId`; tidak ada tabel korespondensi per nasabah. |

Baris terakhir itu **tidak dibangun sebagai baris yang selalu kosong** — aturan "Fitur Harus Punya
Sumber Data" melarangnya. Ia dinyatakan apa adanya di layar sebagai *tidak ditatausahakan di
aplikasi ini*, dan dicatat sebagai risiko residual.

## Yang sudah diputuskan pengguna

Empat keputusan, diambil 11 September 2026 sesudah premis Masalah 0 disampaikan.

1. **Cakupan: keduanya.** Paket ini memperbaiki jalur hapus *dan* membangun pembuktian retensi
   Pasal 48. Menutup salah satunya saja berarti menutup temuan yang derajatnya sudah turun sambil
   membiarkan kewajiban yang sesungguhnya tetap terbuka.
2. **Dokumen `ownerType = "COMPANY"`: nonaktif sebagai jalur normal, penghapusan permanen tetap
   tersedia tetapi hanya untuk SHAREHOLDER.** Alasannya berkas salah unggah yang memuat data
   pribadi pihak lain — keadaan yang benar-benar menuntut berkasnya lenyap, bukan sekadar
   disembunyikan. Alasan tertulis wajib pada kedua jalur, dan audit wajib pada kedua jalur.
   CONTROLLER tetap boleh menonaktifkan; CONTROLLER **tidak** boleh menghapus permanen.
3. **Jam retensi dokumen perusahaan dihitung sejak diunggah** (`createdAt`). Bukan sejak
   dinonaktifkan. Ini aturan rumah, bukan Pasal 48 — dan spec ini menyebutnya begitu di layar.
4. **Berkas yatim yang sudah terlanjur ada di penyimpanan dibiarkan.** Tidak ada pendataan, tidak
   ada pembersihan. Dicatat sebagai risiko residual. Paket ini hanya mencegah yatim **baru**.

## Rancangan

### 1. Skema — migrasi `0058`, murni aditif

Dua tabel, empat kolom, tidak ada perubahan destruktif dan tidak ada perubahan enum.

`operational_documents` bertambah tiga kolom, meniru bentuk `company_documents` apa adanya:

```ts
  /** Dinonaktifkan, bukan dihapus — pola yang sama dengan `companyDocuments` (keputusan pengguna 8 September 2026). Hanya berlaku bagi ownerType COMPANY; dokumen nasabah dan transaksi tidak punya jalur nonaktif maupun hapus. */
  deactivatedAt: datetime("deactivatedAt"),
  deactivatedByUserId: int("deactivatedByUserId"),
  deactivationReason: text("deactivationReason"),
```

`customers` bertambah satu kolom:

```ts
  /**
   * Kapan hubungan usaha berakhir — jam Pasal 48 ayat (1) huruf a angka 1 PBI 10/2024.
   *
   * Diisi saat `profileStatus` BERPINDAH menjadi `INACTIVE`, dikosongkan saat ia berpindah keluar
   * dari `INACTIVE`. Diturunkan dari `updatedAt` berarti menebak: `updatedAt` bergerak pada setiap
   * penyuntingan apa pun, termasuk yang tidak menyentuh status.
   */
  relationshipEndedAt: datetime("relationshipEndedAt"),
```

Nol baris `ownerType = "COMPANY"` di basis data lokal (tujuh baris `COMPANY_ARCHIVE`), jadi tidak
ada data yang perlu disesuaikan. Kolom nullable, baris lama tetap sah.

### 2. `shared/documentRetention.ts` — fungsi murni, tanpa basis data

Satu berkas berisi aturan retensi dan tidak ada yang lain. Alasannya sama dengan
`shared/customerHighRisk.ts` pada Paket L: aturan yang hidup di dalam handler adalah aturan yang
cepat atau lambat berbeda antara layar dan penulisnya.

```ts
export const CUSTOMER_DOCUMENT_RETENTION_YEARS = 5;
export const TRANSACTION_DOCUMENT_RETENTION_YEARS = 10;
export const COMPANY_PROFILE_DOCUMENT_RETENTION_YEARS = 5;

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
  /** Kalimat siap tampil, mis. "5 tahun sejak transaksi terakhir 3 Maret 2024". */
  detail: string;
};
```

**Aturan dokumen nasabah** (`customerDocumentRetention`). Selama `profileStatus` belum `INACTIVE`,
hubungan usaha dianggap **masih berjalan**: `retainUntil` bernilai `null` dan basisnya
`HUBUNGAN_USAHA_BERJALAN`. Ini pembacaan yang paling panjang, dan itu disengaja — penjelasan
Pasal 48 ayat (1) huruf b menetapkan "masa retensi yang terlama" sebagai kaidahnya, dan retensi yang
kepanjangan tidak melanggar apa pun sedangkan yang kependekan melanggar.

Begitu `relationshipEndedAt` terisi, jamnya adalah **yang paling akhir** di antara tiga instan:
`relationshipEndedAt`, transaksi `COMPLETED` terakhir, dan peninjauan profil terakhir yang
`deviationReasons`-nya tidak kosong. `retainUntil` adalah instan itu ditambah lima tahun, dan
`basis` menyebut instan mana yang menang.

**Aturan dokumen transaksi** (`transactionDocumentRetention`). Pasal 48 ayat (1) huruf b menunjuk
UU Dokumen Perusahaan, yang menghitung sepuluh tahun **sejak akhir tahun buku**. Jadi
`basisAt` adalah akhir tahun operasional `transactionAt` dan `retainUntil` sepuluh tahun sesudahnya.
Bila aturan nasabahnya menghasilkan tanggal yang **lebih jauh**, yang lebih jauh itulah yang
dipakai — kaidah "masa retensi yang terlama" dari penjelasannya, ditegakkan di dalam fungsi.

Batas tahun operasional memakai `startOfOperationalMonth` pada `shared/regulatoryActionQueue.ts`
persis seperti `getIraAssessmentDue` — **tidak ada helper jendela waktu keempat.**

**Aturan dokumen perusahaan** (`companyProfileDocumentRetention`). `createdAt` ditambah lima tahun,
basis `SEJAK_DIUNGGAH`. Layarnya menyebut ini **aturan rumah**, bukan Pasal 48, dan spec ini
menuntut kalimat itu benar-benar ada di layar: menyandarkan retensi logo pada Pasal 48 adalah
persis kekeliruan yang melahirkan Temuan 4.

### 3. Penulis `relationshipEndedAt`

Fungsi murni di `shared/documentRetention.ts`, meniru `highRiskResetValues`
(`server/customerHighRiskApproval.ts:59`) baris demi baris:

```ts
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

`INACTIVE → INACTIVE` tidak menyentuh apa pun: bila ia menyetel ulang, setiap penyuntingan nasabah
yang sudah tidak aktif akan memundurkan tenggat retensinya dan memperpanjangnya tanpa alasan.

Disebarkan dari `updateCustomer` (`server/operations.ts:976`) lewat `nextValues`, tepat di sebelah
`highRiskResetValues` yang sudah ada di sana. `createCustomer` tidak perlu disentuh: nasabah baru
tidak pernah lahir dalam keadaan `INACTIVE`.

### 4. Lapisan operasi — `server/companyProfileDocuments.ts` (berkas baru)

`deleteCompanyDocument` **dibuang**, digantikan dua fungsi dan dua gerbang. Berkas baru dan bukan
tambahan pada `documentOperations.ts`, supaya gerbangnya dapat diuji terpisah dari unggahan.

**Gerbang, murni, tanpa basis data** — preseden `highRiskDecisionDenial`:

```ts
export function companyProfileDocumentDeactivationDenial(user: GateUser): Denial
// CONTROLLER ke atas; pesan: "Hanya Controller ke atas yang dapat menonaktifkan dokumen profil perusahaan."

export function companyProfileDocumentPurgeDenial(user: GateUser): Denial
// SHAREHOLDER saja; pesan: "Hanya Pemegang Saham yang dapat menghapus permanen dokumen profil perusahaan."
```

**`deactivateCompanyProfileDocument({ documentId, reason }, actor)`** — alasan wajib (`trim()`
tidak boleh kosong), menolak dokumen yang sudah nonaktif, menolak dokumen yang sedang dipakai
sebagai `company_profile.logoDocumentId`, menulis audit `COMPANY_PROFILE_DOCUMENT_DEACTIVATED`.

**`purgeCompanyProfileDocument({ documentId, reason }, actor)`** — alasan wajib, menolak dokumen
yang sedang dipakai sebagai logo, lalu `DELETE` sungguhan. Auditnya ditulis **sebelum** barisnya
lenyap dan memuat seluruh metadata berkasnya:

```ts
await writeAudit({
  actorUserId: actor.id,
  action: "COMPANY_PROFILE_DOCUMENT_PURGED",
  entityType: "operational_documents",
  entityId: String(documentId),
  reason,
  beforeState: {
    documentType: document.documentType, originalFileName: document.originalFileName,
    storageKey: document.storageKey, mimeType: document.mimeType, byteSize: document.byteSize,
    uploadedByUserId: document.uploadedByUserId, createdAt: document.createdAt,
  },
  // Jujur, bukan kosmetik: `server/storage.ts` tidak punya penghapus objek, jadi berkasnya memang tertinggal.
  metadata: { storageObjectRetained: true },
});
```

Keduanya menolak `ownerType` selain `"COMPANY"` dengan pesan yang menyebut alasannya — dokumen
nasabah dan transaksi tidak punya jalur nonaktif maupun hapus, dan pesan itulah yang menjelaskannya
kepada siapa pun yang mencoba.

`listCompanyDocuments` menyaring `deactivatedAt IS NULL` untuk daftar berjalannya, dan mendapat
saudara `listDeactivatedCompanyDocuments` untuk daftar nonaktifnya. Logo yang sedang dipakai tetap
ditemukan `CompanyProfile.tsx:37` karena logo aktif memang tidak pernah dapat dinonaktifkan.

### 5. Lapisan pembacaan retensi — `server/documentRetentionQueries.ts` (berkas baru)

**`customerRetentionStatement(customerId)`** menjawab pertanyaan Pasal 48 ayat (4) untuk satu
nasabah dalam satu panggilan: identitas, dokumen `CUSTOMER` beserta `retainUntil`-nya, dokumen
`TRANSACTION` per bon beserta `retainUntil`-nya, jumlah baris `customer_watchlist_screenings` dan
`customer_profile_reviews`, dan satu baris tetap untuk korespondensi yang berbunyi *"tidak
ditatausahakan di aplikasi ini"* — bukan angka nol.

**`documentRetentionOverview({ asOf })`** untuk layar pengawasan: berapa nasabah yang hubungan
usahanya sudah berakhir, berapa yang jam retensinya sudah lewat (dan karena itu **boleh** dihapus,
walau aplikasi ini tetap tidak menghapusnya), dan berapa dokumen perusahaan yang lewat aturan rumah
lima tahun.

Keduanya CONTROLLER ke atas.

### 6. Antarmuka

**`client/src/pages/CompanyProfile.tsx`** — ikon tong sampah tanpa konfirmasi diganti dua tindakan:

- *Nonaktifkan* — dialog dengan isian alasan wajib, tampil bagi CONTROLLER ke atas.
- *Hapus permanen* — dialog terpisah bernada tegas yang menyebut berkas tetap tertinggal di
  penyimpanan, isian alasan wajib, **hanya tampil bagi SHAREHOLDER**.

Ditambah satu bagian *Dokumen nonaktif* yang mendaftar yang sudah dinonaktifkan beserta alasan dan
pelakunya — arsip yang isinya lenyap dari layar sama saja dengan yang dihapus.

**`client/src/pages/PenatausahaanDokumen.tsx`** (halaman baru), rute
`/kepatuhan/penatausahaan-dokumen`, `minimumRole: "CONTROLLER"`, terdaftar pada
`shared/backOfficeNavigation.ts` di kelompok **Pengawasan** bersebelahan dengan *Arsip Dokumen*.
Isinya ringkasan `documentRetentionOverview` dan pencarian nasabah yang membuka
`customerRetentionStatement`. Punya loading/empty/error state, dan kalimat pembuka yang menyebut
dasar hukum tiap kolom supaya pemeriksa tidak perlu menebak.

### 7. Pengujian

| Berkas | Yang dijaga |
|---|---|
| `shared/documentRetention.test.ts` | Tabel penuh atas ketiga aturan retensi dan `relationshipEndValues`; termasuk kaidah "terlama menang" saat aturan nasabah melampaui sepuluh tahun tahun buku |
| `server/companyProfileDocuments.test.ts` | Alasan wajib, tolak nonaktif ganda, tolak logo aktif, audit tertulis pada kedua jalur, metadata purge lengkap |
| `server/companyProfileDocuments.authorization.test.ts` | CONTROLLER boleh nonaktif tetapi **tidak** boleh purge; SHAREHOLDER boleh keduanya; STAFF/ADMIN tidak boleh apa pun; `mustChangePassword` menolak lebih dulu |
| `server/documentRetentionGuard.test.ts` | **Uji penjaga:** tidak ada jalur mana pun yang menghapus `operational_documents` ber-`ownerType` `CUSTOMER` atau `TRANSACTION`. Ini yang mengunci sisi Pasal 48. |
| `server/customerRelationshipEnd.test.ts` | `updateCustomer` mengisi dan mengosongkan `relationshipEndedAt` pada perpindahan status, dan tidak menyentuhnya pada `INACTIVE → INACTIVE` |

Seluruhnya uji Vitest atas fungsi dengan `getDb` dipalsukan, sesuai aturan kerja paket.

## Yang sengaja tidak dikerjakan di paket ini

- **Korespondensi dengan Pengguna Jasa (Pasal 48 ayat (2) huruf d).** Tidak ada penulis datanya,
  dan membangun barisnya sebagai nilai yang selalu kosong justru dilarang aturan proyek.
  Menyediakannya menuntut tabel korespondensi per nasabah dan alur yang mengisinya — paket
  tersendiri, bukan sisipan di sini.
- **Pendataan dan pembersihan berkas yatim** yang sudah terlanjur ada. Keputusan pengguna
  11 September 2026. Konsekuensinya: `server/storage.ts` tetap tidak punya penghapus objek, dan
  paket ini sengaja tidak menambahkannya.
- **Penghapusan otomatis dokumen yang sudah lewat masa retensinya.** Pasal 48 menetapkan batas
  **paling singkat**, bukan batas paling lama, dan ayat (6) justru membolehkan lebih lama. Aplikasi
  ini menampilkan tenggatnya dan tidak menghapus apa pun.
- **`company_documents` (arsip Paket I) tidak disentuh sama sekali.** Ia sudah benar.
- **Kalender hari kerja (Temuan 6) dan antrean tenggat pelaporan (Temuan 5)** tetap belum
  dikerjakan. Retensi dihitung dalam tahun kalender, bukan hari kerja, jadi paket ini tidak
  terhalang olehnya.

## Risiko residual

1. **Berkas yatim lama tetap ada di penyimpanan dan tidak ada yang tahu berapa banyak.** Setiap
   pemanggilan `deleteCompanyDocument` sebelum paket ini meninggalkan objek tanpa baris, tanpa
   audit, dan karena itu tanpa cara menghitungnya kembali. Basis data lokal memuat nol baris
   `ownerType = "COMPANY"` — tidak dapat disimpulkan apakah itu berarti tidak pernah ada, atau
   pernah ada dan sudah terhapus.
2. **`purgeCompanyProfileDocument` tetap meninggalkan objek di penyimpanan.** Auditnya jujur
   menyebutnya lewat `storageObjectRetained: true`, tetapi bagi berkas salah unggah yang memuat data
   pribadi pihak lain — justru alasan jalur ini dibuat — berkasnya secara teknis **masih dapat
   diambil** oleh siapa pun yang memegang `storageKey`-nya dari `audit_logs`. Menutup celah ini
   menuntut penghapus objek di `server/storage.ts`, yang keputusan pengguna 11 September 2026
   memilih untuk tidak dibangun sekarang.
3. **"Berakhirnya hubungan usaha" bergantung sepenuhnya pada manusia menandai nasabah `INACTIVE`.**
   Bila tidak ada yang menandainya, jam retensi tidak pernah mulai berdetak dan seluruh nasabah
   tampak ditahan tanpa batas. Itu arah yang aman bagi kepatuhan, tetapi membuat angka pada layar
   pengawasan tidak berarti apa-apa. Sama bentuknya dengan risiko residual Paket J2 nomor 3.
4. **Retensi dokumen perusahaan lima tahun sejak diunggah adalah aturan rumah, bukan kewajiban.**
   Bila kelak ternyata ada ketentuan lain yang mengaturnya — PBI KUPVA BB, UU Dokumen Perusahaan —
   angka lima tahun ini harus diperiksa ulang terhadap ketentuan itu, dan mungkin salah.
5. **Sepuluh tahun UU Dokumen Perusahaan dan sisi UU PDP belum dibaca dari naskahnya.** Angka
   sepuluh tahun diambil dari rujukan Pasal 48 ayat (1) huruf b, bukan dari membaca UU 8/1997
   maupun UU PDP langsung. Penjelasannya menuntut "masa retensi yang terlama" di antara keduanya,
   dan sisi PDP-nya **belum terverifikasi sama sekali**.
6. **Ini bukan pernyataan kepatuhan.** Paket ini menutup satu temuan dari satu pembacaan satu
   peraturan. Temuan 3, 5, 6, dan 7 pada `2026-09-09-pbi-10-2024-temuan-awal.md` tetap terbuka.
