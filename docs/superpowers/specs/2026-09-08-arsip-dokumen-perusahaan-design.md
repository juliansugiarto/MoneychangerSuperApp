# Paket I — Arsip dokumen perusahaan

**Ditulis 8 September 2026**, sesudah Paket H selesai. Menutup **temuan pemeriksaan BI 3** —
dokumen perusahaan (SOP, kebijakan internal, surat-menyurat BI, notulen rapat, korespondensi
regulator) tidak memiliki tempat penyimpanan yang dapat ditunjukkan kepada pemeriksa.

---

## Masalah

### 1. Tidak ada tempat bagi dokumen yang justru diminta pemeriksa

`operational_documents` (`drizzle/schema.ts:327`) melayani empat pemilik —
`ownerType ∈ {CUSTOMER, TRANSACTION, COMPANY, EXPENSE}` — dengan sembilan jenis dokumen:
`KTP_PHOTO`, tiga jenis underlying, `UNDERLYING` lama, `COMPANY_LOGO`, `LICENSE_CERTIFICATE`,
`LICENSE_ATTACHMENT`, dan `EXPENSE_RECEIPT`.

Tidak ada satu pun yang muat untuk SOP, kebijakan internal APU-PPT, surat masuk dari Bank
Indonesia, notulen rapat direksi, atau berkas korespondensi regulator. Pemeriksa yang meminta
"tunjukkan SOP yang berlaku" hari ini dijawab dengan berkas di komputer seseorang.

### 2. Tidak ada versi, dan itu justru pertanyaan pemeriksanya

Tabelnya rata: satu baris satu berkas, tanpa nomor versi, tanpa masa berlaku, tanpa penanda
"berlaku sekarang". Pertanyaan **"SOP mana yang berlaku pada bulan yang sedang diperiksa"** tidak
dapat dijawab oleh bentuk tabel ini, dan itulah bentuk pertanyaan yang sesungguhnya diajukan
temuan 3. Mengganti berkas berarti menimpanya; berkas lamanya lenyap beserta jawabannya.

### 3. Menghapus dokumen perusahaan tidak meninggalkan jejak apa pun

`deleteCompanyDocument` (`server/documentOperations.ts:129-134`) menjalankan `DELETE` sungguhan dan
**tidak menulis satu baris audit pun**:

```ts
await db.delete(operationalDocuments).where(eq(operationalDocuments.id, documentId));
```

Pada dokumen profil perusahaan hal itu sudah cukup mengganggu. Pada arsip kepatuhan ia
menggagalkan tujuan arsipnya: berkas yang dapat lenyap tanpa jejak bernilai lebih kecil bagi
pemeriksa daripada berkas yang tidak dapat.

### 4. Tidak ada yang tahu dokumen mana yang sudah kedaluwarsa

Tidak ada kolom masa berlaku di mana pun pada jalur dokumen. SOP yang seharusnya ditinjau setahun
sekali dan surat izin yang habis masa berlakunya sama-sama tidak terlihat sampai ada yang ingat.
Paket H sudah membuktikan bentuk penyelesaiannya untuk nasabah: worklist yang **hanya mencatat**.

---

## Yang sudah diputuskan pengguna

Diputuskan pada sesi rancangan 8 September 2026. **Seluruhnya keputusan pengguna, bukan turunan
analisis kode.**

1. **Jenis dokumen adalah enum tertutup berisi enam nilai:** `SOP`, `KEBIJAKAN_INTERNAL`,
   `SURAT_BI`, `NOTULEN_RAPAT`, `KORESPONDENSI_REGULATOR`, `LAINNYA`. Tertutup agar dapat
   dikelompokkan dan dihitung untuk pemeriksa; `LAINNYA` adalah jalan keluarnya agar tidak ada
   dokumen yang tidak dapat diarsipkan. Judul wajib diisi pada setiap dokumen, sehingga `LAINNYA`
   tetap terbaca.

2. **Arsip menyimpan riwayat versi penuh.** Berkas lama tetap dapat dibuka. Ini yang menentukan
   bentuk tabelnya, dan alasannya persis Masalah 2.

3. **Controller ke atas untuk seluruh tindakan** — mengunggah, mengganti versi, dan menghapus.
   **Menghapus berarti menonaktifkan**, bukan menghapus: barisnya bertahan beserta `deactivatedAt`,
   pelakunya, dan alasannya, dan berkasnya tetap dapat diambil.

4. **Dokumen kedaluwarsa muncul sebagai pekerjaan yang menunggu**, dan yang **akan** kedaluwarsa
   dalam 30 hari juga. Bentuknya meniru worklist Paket H: **hanya mencatat**, tidak pernah
   memblokir apa pun, tidak pernah mengubah dokumennya sendiri, dan tidak pernah melapor sendiri.

5. **Dokumen yang sudah ada pada Profil Perusahaan tetap di tempatnya.** `COMPANY_LOGO`,
   `LICENSE_CERTIFICATE`, dan `LICENSE_ATTACHMENT` tidak dipindahkan dan halaman Profil Perusahaan
   tidak berubah. Tidak ada migrasi data atas baris yang sudah ada di produksi.

6. **Penanggung jawab menunjuk baris pegawai** (`employees`), bukan nama bebas — akuntabilitas
   menunjuk catatan personalia yang sungguh ada, dan Kepegawaian sudah memelihara daftarnya.
   Boleh kosong bila tidak ada pegawai yang cocok.

7. **Alasan perubahan wajib mulai versi kedua.** Versi pertama tidak perlu alasan; setiap
   penggantian harus menyebutkan mengapa. Bentuknya sama dengan `recordCustomerProfileReview`
   (`server/customerProfileMonitoring.ts:326`) yang mewajibkan keterangan pada hasil selain "tidak
   ada perubahan": riwayat versi tanpa alasan menjawab "apa yang berubah" tetapi tidak pernah
   menjawab "mengapa".

---

## Rancangan

### 1. Berkasnya tetap milik `operational_documents`

`operational_documents` yang memiliki `storageKey`, pemeriksaan MIME, penulisan ke object storage
(`storagePut`), dan pengalihan unduhan `/api/operational-documents/:documentId/download`
(`server/_core/index.ts:150`). Arsip **memakainya ulang apa adanya**; menaruh `storageKey` kedua di
tabel baru berarti membangun jalur unduhan kedua beserta lubang otorisasinya sendiri.

Dua nilai enum ditambahkan, dan hanya dua:

```ts
ownerType: mysqlEnum("ownerType", ["CUSTOMER", "TRANSACTION", "COMPANY", "EXPENSE", "COMPANY_ARCHIVE"]),
documentType: mysqlEnum("documentType", [..., "COMPANY_ARCHIVE_FILE"]),
```

`COMPANY_ARCHIVE_FILE` adalah **penanda tunggal**, bukan keenam kategorinya. Kategorinya hidup di
tabel arsip. Menaruh keenamnya di `documentType` akan membuat dua sumber kebenaran atas jenis
dokumen yang sama, dan mencampur kosakata KTP/underlying dengan kosakata SOP/notulen di satu enum.

`ownerType` tersendiri, bukan `COMPANY`, disengaja: `listCompanyDocuments`
(`server/documentOperations.ts:124`) menyaring **hanya** dengan `ownerType = "COMPANY"` dan
mengembalikan seluruh barisnya ke klien, tempat halaman Profil Perusahaan baru menyaring
`documentType`. Memakai `COMPANY` akan mengirim seluruh arsip perusahaan ke halaman yang tidak
memintanya. Dengan `COMPANY_ARCHIVE`, halaman Profil Perusahaan dan query-nya **tidak berubah sama
sekali**.

### 2. Dua tabel: dokumen logis dan versinya

```ts
export const companyDocumentCategories = ["SOP", "KEBIJAKAN_INTERNAL", "SURAT_BI", "NOTULEN_RAPAT", "KORESPONDENSI_REGULATOR", "LAINNYA"] as const;

/** Satu dokumen perusahaan sebagai benda yang berumur panjang — SOP "Prosedur Penerimaan Nasabah" tetap dokumen yang sama walau berkasnya sudah diganti empat kali. Berkasnya sendiri ada di company_document_versions. */
export const companyDocuments = mysqlTable("company_documents", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", companyDocumentCategories).notNull(),
  title: varchar("title", { length: 250 }).notNull(),
  /** Nomor surat/SK/notulen bila ada; bukan pengganti judul. */
  referenceNumber: varchar("referenceNumber", { length: 160 }),
  /** Pegawai yang bertanggung jawab memelihara dokumen ini. Kosong bila belum ditunjuk. */
  responsibleEmployeeId: int("responsibleEmployeeId"),
  notes: text("notes"),
  /** Dinonaktifkan, bukan dihapus — keputusan pengguna 8 September 2026. Berkasnya tetap dapat diambil. */
  deactivatedAt: datetime("deactivatedAt"),
  deactivatedByUserId: int("deactivatedByUserId"),
  deactivationReason: text("deactivationReason"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("company_documents_category_idx").on(table.category, table.deactivatedAt),
  index("company_documents_responsible_idx").on(table.responsibleEmployeeId),
]);

/** Satu baris per berkas yang pernah diunggah. Versi lama tidak pernah dihapus: pertanyaan pemeriksa adalah "SOP mana yang berlaku pada periode ini", dan hanya baris yang bertahan yang dapat menjawabnya. */
export const companyDocumentVersions = mysqlTable("company_document_versions", {
  id: int("id").autoincrement().primaryKey(),
  companyDocumentId: int("companyDocumentId").notNull(),
  /** Mulai 1, naik satu setiap penggantian. Disimpan, bukan diturunkan saat dibaca. */
  versionNumber: int("versionNumber").notNull(),
  /** Baris operational_documents yang memegang berkasnya. Satu berkas hanya boleh dipakai satu versi. */
  operationalDocumentId: int("operationalDocumentId").notNull(),
  validFrom: date("validFrom").notNull(),
  /** Kosong berarti berlaku sampai diganti — bukan berarti kedaluwarsa. */
  validUntil: date("validUntil"),
  /** Wajib mulai versi kedua (keputusan pengguna 7). */
  changeReason: text("changeReason"),
  /** Diisi saat versi berikutnya diunggah. Versi berjalan adalah satu-satunya yang nilainya kosong. */
  supersededAt: datetime("supersededAt"),
  uploadedByUserId: int("uploadedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("company_document_versions_number_uq").on(table.companyDocumentId, table.versionNumber),
  uniqueIndex("company_document_versions_file_uq").on(table.operationalDocumentId),
  index("company_document_versions_current_idx").on(table.companyDocumentId, table.supersededAt),
]);
```

`supersededAt` **disimpan, tidak diturunkan**. "Versi berjalan adalah nomor tertinggi" terdengar
setara, tetapi ia menjadi salah pada saat pertama seseorang menyisipkan versi susulan bertanggal
mundur, dan kesalahannya tidak terlihat dari layar mana pun. Satu kolom kosong lebih murah daripada
aturan turunan yang harus benar di setiap pembacanya.

Nomor versi juga disimpan, dengan indeks unik `(companyDocumentId, versionNumber)`: dua unggahan
yang datang bersamaan tidak boleh menghasilkan dua "versi 3".

`operationalDocumentId` unik: satu berkas tidak boleh menjadi dua versi. Tanpa indeks itu, kekeliruan
klien yang mengirim id yang sama dua kali akan memasang berkas yang sama sebagai versi 2 dan versi 3
tanpa ada yang mengeluh.

### 3. Jalur unggah: satu nilai enum, satu gerbang peran

`uploadOperationalDocument` (`server/documentOperations.ts:54`) menerima `COMPANY_ARCHIVE_FILE`
dengan aturan yang sama tegasnya dengan jenis lain: **tidak boleh** terhubung ke `customerId`,
`transactionId`, maupun `expenseId`. Jalur REST `POST /api/operational-documents`
(`server/_core/index.ts:59`) menambahkannya ke gerbang `CONTROLLER` yang sudah menjaga dokumen
perusahaan (`_core/index.ts:63`) — dan itu adalah keputusan 3 yang ditegakkan **di server**, bukan
disembunyikan di UI.

Unggahnya dua langkah: berkas ke REST, lalu metadatanya lewat tRPC. Konsekuensinya jujur: bila
langkah kedua gagal, tertinggal satu baris `operational_documents` tanpa versi yang menunjuknya.
Baris itu tidak muncul di halaman mana pun dan tidak dapat diunduh dari arsip. Itu **risiko residual
yang diterima**, bukan yang disembunyikan — lihat bagian risiko.

**Batas keamanan impor tidak disentuh.** `MAX_IMPORT_BYTES = 5 MB` dan `assertSpreadsheetSignature`
(`server/financialImport.ts:10,22`; `server/sanctionsWatchlistImport.ts:26,72`) melayani impor
XLS/XLSX dan tetap berlaku apa adanya. Arsip memakai jalur dokumen, yang batasnya `8 MB` dengan
pemeriksaan MIME (`server/documentOperations.ts:6,49`). Keduanya batas yang berbeda untuk jalur yang
berbeda, dan paket ini tidak mengubah satu pun dari keduanya.

### 4. Penilaian masa berlaku — `shared/companyDocumentArchive.ts`, murni

```ts
/** Keputusan pengguna 8 September 2026: dokumen yang akan kedaluwarsa dalam 30 hari sudah menjadi pekerjaan yang menunggu. */
export const ARCHIVE_EXPIRY_WARNING_DAYS = 30;

export type ArchiveValidityStatus = "BERLAKU" | "AKAN_KEDALUWARSA" | "KEDALUWARSA" | "BELUM_BERLAKU";
export type ArchiveWorklistReason = "KEDALUWARSA" | "AKAN_KEDALUWARSA" | "TIDAK_ADA_VERSI_BERLAKU";
```

Fungsinya murni: masuk `validFrom`/`validUntil` dan tanggal acuan, keluar statusnya. Tidak menyentuh
basis data dan tidak membaca jam sendiri.

`TIDAK_ADA_VERSI_BERLAKU` bukan hiasan. Versi baru **langsung** menggantikan pendahulunya saat
diunggah, sedangkan `validFrom`-nya boleh jatuh di masa depan — SOP memang biasa ditandatangani
sebelum berlaku. Akibatnya arsip dapat berada pada keadaan "tidak ada versi yang berlaku hari ini",
dan keadaan itu harus terlihat sebagai pekerjaan, bukan tersembunyi di balik status hijau.

`BELUM_ADA_VERSI` tidak ada dalam daftar karena tidak dapat terjadi: dokumen dibuat bersama versi
pertamanya dalam satu transaksi.

### 5. Perbandingan tanggal dilakukan di JavaScript, bukan di SQL

`validFrom` dan `validUntil` adalah kolom `date`. Menyaringnya dengan `Date` tengah malam UTC di
dalam `WHERE` **menjatuhkan baris pada batasnya** di mesin WIB — kekeliruan yang sudah pernah
ditemui proyek ini dan dicatat. Karena itu arsip dibaca utuh (tabelnya berukuran puluhan baris,
bukan jutaan) dan status masa berlakunya dinilai fungsi murni yang membandingkan **kunci tanggal
`YYYY-MM-DD`**, bukan instant.

"Hari ini" diturunkan dari `startOfOperationalDay` pada `shared/regulatoryActionQueue.ts:87` beserta
zona waktu operasional pada `company_profile.timezone` — helper yang sudah ada. **Jangan menulis
helper hari operasional keempat.** Nilai kolom `date` yang dikembalikan driver dibaca dengan
penggetah waktu lokal, karena driver-lah yang membangunnya sebagai tengah malam lokal; hanya "hari
ini" yang diturunkan lewat zona operasional. Kedua sisinya menjadi kunci `YYYY-MM-DD` sebelum
dibandingkan, dan itu diuji pada tiga zona waktu proses — UTC, WIB, dan satu zona negatif —
mengikuti cara Paket H menguji jendela bulanannya.

### 6. Penulisnya ikut dibangun, seluruhnya

Aturan `CLAUDE.md` "Fitur Harus Punya Sumber Data" berlaku penuh, dan paket ini tidak menambahkan
satu kolom pun yang tidak ada penulisnya:

| Kolom | Penulisnya |
|---|---|
| `companyDocuments.*` | Borang "Dokumen baru" pada halaman Arsip Dokumen → `createCompanyDocument` |
| `companyDocumentVersions.*` (versi 1) | Borang yang sama, dalam satu transaksi |
| `companyDocumentVersions.*` (versi ≥ 2) | Borang "Ganti versi" → `addCompanyDocumentVersion` |
| `supersededAt` | `addCompanyDocumentVersion`, pada versi sebelumnya |
| `deactivatedAt`, `deactivatedByUserId`, `deactivationReason` | Tindakan "Nonaktifkan" → `deactivateCompanyDocument` |
| `operational_documents` baris arsip | Jalur REST yang sudah ada, dengan `COMPANY_ARCHIVE_FILE` |

### 7. Halaman Arsip Dokumen, dan worklist yang hanya mencatat

Satu halaman `/operasional/arsip-dokumen`, Controller ke atas, ditegakkan di tRPC. Isinya: worklist
di atas (kedaluwarsa, akan kedaluwarsa, tidak ada versi berlaku), lalu daftar dokumen berkelompok
menurut kategori, dan riwayat versi yang dapat dibuka per dokumen — setiap versi lama tetap dapat
diunduh lewat jalur unduhan yang sudah ada.

Yang **tidak** dilakukannya, dan diuji bahwa tidak dilakukannya:

- tidak menulis ke `operational_documents` selain lewat jalur unggah yang sudah ada;
- tidak menyentuh `company_profile`, `employees`, nasabah, transaksi, kas, maupun buku besar;
- tidak menghapus baris mana pun — `deactivateCompanyDocument` hanya mengisi tiga kolom;
- tidak membuat paket regulator, arsip pelaporan, maupun ekspor.

Setiap penulisan menulis baris `audit_logs` lewat `writeAudit` (`server/operations.ts:143`):
`COMPANY_DOCUMENT_CREATED`, `COMPANY_DOCUMENT_VERSION_ADDED`, `COMPANY_DOCUMENT_DEACTIVATED`. Itu
sekaligus menutup Masalah 3 untuk arsip — walaupun `deleteCompanyDocument` yang lama tetap seperti
adanya, karena ia bukan bagian paket ini.

---

## Yang sengaja tidak dikerjakan

- **Dokumen Profil Perusahaan tidak dipindahkan** (keputusan 5). Akibat yang harus diketahui:
  sertifikat izin **tidak** ikut mendapat worklist masa berlaku, padahal izin KUPVA memang habis
  masa berlakunya. Pengguna ditawari dua varian yang menutupnya dan memilih tidak mengambilnya
  sekarang.
- **`deleteCompanyDocument` yang lama tidak diperbaiki.** Ia tetap `DELETE` sungguhan tanpa audit
  (Masalah 3). Memperbaikinya mengubah perilaku halaman Profil Perusahaan yang di luar lingkup
  paket ini; dicatat, tidak disentuh.
- **Tidak ada pemeriksaan signature (magic byte) untuk PDF/JPG/PNG/WEBP.** Jalur dokumen memeriksa
  MIME saja, dan itu keadaan yang sudah berlaku sebelum paket ini. Menambahkannya adalah perubahan
  atas jalur unggah **seluruh** dokumen — KTP, underlying, struk — dan pantas menjadi paketnya
  sendiri, bukan efek samping paket arsip.
- **Tidak ada persetujuan berjenjang.** Dokumen diunggah Controller dan berlaku; tidak ada alur
  "menunggu persetujuan Direksi". Pemeriksa meminta arsip, bukan alur kerja.
- **Tidak ada pencarian isi berkas, OCR, maupun tanda tangan elektronik.**
- **Tidak ada penghapusan berkas dari object storage.** Menonaktifkan dokumen menyisakan berkasnya;
  itu memang yang dikehendaki arsip retensi.
- **Tidak ada jenis dokumen milik pegawai.** `employee_certifications.documentId` dan
  `employee_pic_assignments.documentId` (`drizzle/schema.ts:1002`; `server/sdmOperations.ts:145,163`)
  menerima id dokumen, tetapi tidak ada `ownerType` pegawai dan tidak ada layar yang mengunggahnya —
  **keduanya selalu kosong hari ini**. Itu pekerjaan yang belum selesai menurut aturan "Fitur Harus
  Punya Sumber Data", tetapi ia milik jalur Kepegawaian, bukan arsip perusahaan. Dicatat agar tidak
  disimpulkan sebagai keadaan sah.
- **Tidak ada pengiriman otomatis ke BI atau regulator mana pun.**

---

## Risiko residual

- **Unggahan yatim.** Unggahnya dua langkah (berkas lewat REST, metadata lewat tRPC). Bila langkah
  kedua gagal, tertinggal baris `operational_documents` tanpa versi yang menunjuknya: memakan ruang
  penyimpanan, tidak terlihat di halaman mana pun, tidak dapat diunduh dari arsip. Tidak ada
  penyapunya di paket ini. Menyatukannya menjadi satu langkah menuntut perombakan jalur unggah yang
  dipakai empat layar lain.
- **Ambang peringatan 30 hari adalah pilihan kebijakan, bukan temuan analisis.** Ia terlalu pendek
  bagi dokumen yang penggantiannya menuntut rapat direksi, dan terlalu panjang bagi surat yang
  berlaku dua minggu. Ia konstanta bernama di satu tempat justru agar dapat diubah tanpa berburu.
- **Sertifikat izin tidak mendapat peringatan masa berlaku** — akibat langsung keputusan 5. Bila
  izin KUPVA hampir habis, arsip ini tidak akan mengatakannya.
- **`validUntil` diisi manusia dan tidak diverifikasi terhadap apa pun.** Dokumen yang tanggalnya
  tidak diisi tidak akan pernah muncul di worklist. Kekosongan itu sah menurut rancangan ("berlaku
  sampai diganti"), sehingga worklist yang sunyi **tidak** membuktikan seluruh dokumen masih
  berlaku. Halaman harus menampilkan banyaknya dokumen tanpa `validUntil` apa adanya, bukan
  menyembunyikannya.
- **Versi baru langsung menggantikan pendahulunya**, walau `validFrom`-nya di masa depan. Itu
  disengaja dan terlihat sebagai `TIDAK_ADA_VERSI_BERLAKU`, tetapi berarti arsip dapat berada pada
  keadaan tanpa dokumen berlaku selama beberapa hari — keadaan yang benar dan harus terlihat, bukan
  keadaan yang nyaman.
- **Penanggung jawab boleh kosong**, dan pada basis data yang belum punya baris `employees` ia akan
  kosong pada seluruh dokumen. Itu terlihat apa adanya di halaman, bukan disamarkan.
- **`pnpm audit --prod --audit-level=high` tetap melaporkan 9 temuan** (residual SheetJS/`xlsx`
  ditambah `mysql2 <3.22.0`). Paket ini tidak mengubah dependensi; auditnya **belum** bersih dan
  tidak boleh disebut bersih.
- **Migrasi `0051` (Paket H) belum diterapkan ke produksi.** Migrasi paket ini akan menjadi yang
  kedua dalam antrean itu.
