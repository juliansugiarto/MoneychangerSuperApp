# Paket H — Profil transaksi dan pemantauan berkala

**Ditulis 7 September 2026**, sesudah Paket G selesai. Menutup **temuan pemeriksaan BI 10** dan sisa
**temuan 9** ("pengkinian profil nasabah dan profil transaksi").

---

## Masalah

### 1. Nasabah tidak pernah menyatakan aktivitas yang diharapkan

`customers` (`drizzle/schema.ts:117-140`) menyimpan `occupation`, `sourceOfFunds`,
`transactionPurpose`, `pepStatus`, `riskLevel`, dan `riskNotes` — seluruhnya **kualitatif**. Tidak
ada satu pun angka: tidak ada perkiraan nilai transaksi sebulan, tidak ada perkiraan frekuensi,
tidak ada daftar mata uang yang diharapkan.

Tanpa angka yang dideklarasikan, kalimat "aktivitas nasabah menyimpang dari profilnya" tidak dapat
dibuktikan maupun dibantah. Itulah yang membuat temuan 10 berdiri.

### 2. `profileMismatch` bukan perbandingan, melainkan pengecekan kategori

`assessReviewRequirement` (`server/operations.ts:219`) menghitung tiga ambang sungguhan — setara USD
per akumulasi bulanan, kas harian EDD, dan LTKT Rp 500 juta. Tetapi benderanya:

```ts
const profileMismatch = input.profileStatus === "RESTRICTED" || input.riskLevel === "HIGH";
```

Ini **bukan** perbandingan aktivitas terhadap profil. Ia membaca dua kolom kategori yang diisi
manusia dan menyebutnya "ketidaksesuaian profil". Nasabah berisiko `LOW` yang bertransaksi sepuluh
kali lipat kebiasaannya tidak akan pernah menyalakan bendera ini.

### 3. Tidak ada pekerjaan berkala, hanya dasbor

`client/src/pages/Monitoring.tsx` (131 baris) menampilkan tren harian, eksposur mata uang, dan
antrian bon yang menunggu review. Seluruhnya **atas bendera per transaksi yang sudah ada**, dan
seluruhnya bersifat "lihat saat dibuka". Tidak ada yang menjadwalkan peninjauan, tidak ada yang
mencatat bahwa peninjauan sudah dilakukan, dan tidak ada yang tahu nasabah mana yang terlewat.

Pemeriksa meminta **jejak pemantauan berkala**, bukan dasbor.

### 4. Presedennya sudah ada, untuk pegawai

`employee_profile_reviews` (`drizzle/schema.ts:1551`) sudah menyelesaikan persoalan yang sama untuk
pegawai, dan komentarnya menyatakan alasannya dengan tepat:

> Satu baris per peninjauan, bukan satu kolom "terakhir ditinjau" pada tabel pegawai, karena yang
> diminta pemeriksa adalah jejak peninjauannya beserta hasilnya, bukan sekadar tanggal terakhir.

Paket ini menerapkan bentuk yang sama pada nasabah. Enum `profileReviewOutcomes`
(`TIDAK_ADA_PERUBAHAN`, `ADA_PERUBAHAN`, `PERLU_TINDAK_LANJUT`) dipakai ulang apa adanya — dua
kosakata hasil peninjauan yang berbeda untuk persoalan yang sama hanya akan membingungkan
pemeriksanya.

---

## Yang sudah diputuskan pengguna

Diputuskan pada sesi rancangan 7 September 2026. **Seluruh angkanya keputusan pengguna, bukan
turunan analisis.**

1. **Nasabah mendeklarasikan tiga hal:** perkiraan **nilai** transaksi sebulan (Rupiah), perkiraan
   **frekuensi** sebulan (banyaknya transaksi), dan **mata uang** yang diharapkan.

2. **Ambang penyimpangan nilai: dua kali lipat.** Nasabah dianggap menyimpang bila total Rupiah
   sebulan **≥ deklarasinya × 2**.

3. **Mata uang yang tidak dideklarasikan adalah alasan penyimpangan tersendiri**, berdiri sendiri
   dari nilai.

4. **Frekuensi juga menyalakan bendera**, memakai pengali yang sama dengan nilai: menyimpang bila
   banyaknya transaksi sebulan **≥ deklarasinya × 2**. Ditegaskan pengguna 7 September 2026 sesudah
   rancangan awal sempat memperlakukannya sebagai konteks saja. Pengali yang sama sengaja dipakai
   ulang alih-alih mengarang angka kedua: satu angka kepatuhan yang dapat ditunjuk lebih baik
   daripada dua yang harus dijelaskan.

5. **Irama pemantauan berbasis risiko:** `HIGH` sebulan sekali, `MEDIUM` tiga bulan sekali, `LOW`
   setahun sekali.

6. **Tindak lanjutnya worklist Controller, dan hanya mencatat.** Sistem **tidak pernah** mengubah
   data nasabah, **tidak pernah** memblokir transaksi, dan **tidak pernah** melapor sendiri ke
   regulator — sama seperti pencocokan watchlist yang sudah ada.

---

## Rancangan

### 1. Tiga kolom deklarasi pada `customers`

```ts
/** Perkiraan nilai transaksi sebulan yang dinyatakan nasabah sendiri. */
declaredMonthlyValueIdr: decimal("declaredMonthlyValueIdr", { precision: 24, scale: 2 }),
/** Perkiraan banyaknya transaksi sebulan. Konteks bagi peninjau; tidak menyalakan bendera. */
declaredMonthlyCount: int("declaredMonthlyCount"),
/** Kode mata uang yang diharapkan, misalnya ["USD","SGD"]. */
declaredCurrencies: json("declaredCurrencies"),
```

Ketiganya **nullable**, dan itu disengaja: seluruh nasabah yang sudah ada belum pernah
mendeklarasikan apa pun. Nasabah tanpa deklarasi **tidak dapat menyimpang** — ia justru muncul di
worklist dengan alasan `PROFIL_BELUM_DIDEKLARASIKAN`. Kekosongan itu temuannya sendiri, dan
menyembunyikannya di balik nilai bawaan nol akan mengarang deklarasi atas nama nasabah.

**Penulisnya ikut dibangun**, sesuai aturan `CLAUDE.md` "Fitur Harus Punya Sumber Data": borang
nasabah pada `client/src/pages/Customers.tsx` menambahkan ketiga isian, dan `createCustomer` serta
`updateCustomer` (`server/operations.ts:695`, `:813`) menyimpannya. Tanpa itu kolomnya akan selamanya
kosong dan worklistnya akan selamanya berbunyi "belum dideklarasikan" — fitur yang tampak ada dengan
nilai yang selalu sama, persis yang dilarang aturan itu.

### 2. Tabel jejak peninjauan — `customer_profile_reviews`

Meniru `employee_profile_reviews` baris demi baris, memakai ulang `profileReviewOutcomes`:

```ts
export const customerProfileReviews = mysqlTable("customer_profile_reviews", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  reviewedAt: datetime("reviewedAt").notNull(),
  outcome: mysqlEnum("outcome", profileReviewOutcomes).notNull(),
  /** Wajib diisi bila hasilnya bukan "tidak ada perubahan". */
  notes: text("notes"),
  /** Alasan penyimpangan yang terlihat saat peninjauan, dibekukan apa adanya. */
  deviationReasons: json("deviationReasons"),
  reviewedByUserId: int("reviewedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("customer_profile_reviews_customer_idx").on(table.customerId, table.reviewedAt)]);
```

`deviationReasons` dibekukan pada barisnya, tidak dihitung ulang saat dibaca: peninjauan adalah
pernyataan tentang **apa yang terlihat saat itu**, dan menghitungnya ulang enam bulan kemudian akan
mengubah isi catatan yang sudah ditandatangani seseorang.

### 3. Penilaian penyimpangan — `shared/transactionProfile.ts`, murni

```ts
/** Keputusan pengguna 7 September 2026: menyimpang bila mencapai dua kali lipat deklarasinya. */
export const PROFILE_DEVIATION_MULTIPLE = 2;

export type ProfileDeviationReason =
  | "PROFIL_BELUM_DIDEKLARASIKAN"
  | "NILAI_BULANAN_MELEBIHI_PROFIL"
  | "FREKUENSI_BULANAN_MELEBIHI_PROFIL"
  | "MATA_UANG_TIDAK_DIDEKLARASIKAN";
```

Nilai dan frekuensi dinilai **terpisah dan berdiri sendiri**: nasabah dapat menyimpang pada
frekuensinya saja — banyak transaksi kecil yang totalnya masih wajar — dan itu justru bentuk
pemecahan transaksi yang paling perlu terlihat.

Fungsinya **murni**: masuk deklarasi dan aktivitas nyata, keluar daftar alasan. Tidak menyentuh
basis data, tidak membaca jam. Ambangnya konstanta bernama, bukan angka telanjang di tengah kode —
angka kepatuhan harus dapat ditunjuk dan diubah di satu tempat.

Deklarasi nol maupun `null` diperlakukan sama pada **kedua** ukuran: belum dideklarasikan, bukan
ambang nol. `0 × 2 = 0` akan membuat transaksi apa pun melewatinya.

### 4. Irama berbasis risiko — murni dan teruji

```
HIGH   → 1 bulan
MEDIUM → 3 bulan
LOW    → 12 bulan
```

`isProfileReviewDue(lastReviewedAt, riskLevel, asOf)`. Nasabah yang **belum pernah** ditinjau selalu
jatuh tempo — itu keadaan awal seluruh basis nasabah hari ini, dan menyembunyikannya akan membuat
worklist kosong pada hari pertama sekaligus salah.

### 5. Jendela bulanan memakai satu helper WIB, bukan salinan ketiga

Akumulasi bulanan yang sudah ada dibangun begini (`server/operations.ts:1444`):

```ts
const monthStart = new Date(businessDate.getFullYear(), businessDate.getMonth(), 1);
```

`businessDate` berasal dari `jakartaBusinessDate`, yang mengembalikan **tengah malam UTC**
(`server/operations.ts:1631`) — lalu dibaca dengan penggetah **waktu lokal proses**. Pada server
produksi (UTC) dan pada mesin pengembangan WIB keduanya kebetulan menghasilkan bulan yang benar;
pada zona waktu **negatif** ia memundurkan bulan satu langkah.

Paket ini **tidak memperbaiki baris itu** — ia bukan temuan paket ini dan menyentuhnya berarti
mengubah jalur transaksi. Yang dilakukan: jendela bulanan pemantauan memakai **satu helper bersama
yang diuji**, bukan salinan ketiga dari pola yang sama, dan ujinya menyebut zona waktu negatif
secara eksplisit. Temuan pada baris 1444 dicatat di sini agar tidak hilang.

### 6. Worklist Controller — hanya mencatat

`listCustomerProfileMonitoring({ asOf })` mengembalikan nasabah yang **jatuh tempo ditinjau**,
beserta alasan penyimpangan yang terlihat saat itu dan konteks frekuensinya. Halaman barunya
Controller ke atas, ditegakkan di tRPC.

Yang **tidak** dilakukannya, dan diuji bahwa tidak dilakukannya:

- tidak menulis ke `customers` — `riskLevel`, `profileStatus`, dan `riskNotes` tidak tersentuh;
- tidak menyentuh `exchange_transactions` maupun statusnya;
- tidak membuat paket regulator, arsip, maupun ekspor.

Satu-satunya tulisannya adalah baris `customer_profile_reviews` saat Controller menutup peninjauan.

### 7. Jalur transaksi sengaja tidak disentuh

`assessReviewRequirement` **tidak diubah** pada paket ini, meski `profileMismatch` di dalamnya
memang lemah (Masalah 2). Alasannya keputusan 6: menyalurkan penyimpangan profil ke sana akan
membuat transaksi berpindah ke `PENDING_REVIEW`, dan itu bukan "hanya mencatat" — itu mengubah alur
kerja kasir. Bila kelak diinginkan, ia perubahan kecil di atas fungsi murni yang paket ini bangun.

---

## Yang sengaja tidak dikerjakan

- **Tidak ada penilaian risiko otomatis.** Worklist mengusulkan tidak ada apa pun terhadap
  `riskLevel`; Controller yang menilai. Itu Paket J (IRA), bukan paket ini.
- **Tidak ada pemblokiran transaksi.** Alat bantu penyaringan, sama seperti pencocokan watchlist.
- **Tidak ada pelaporan otomatis ke PPATK maupun BI.** Penyimpangan profil bukan LTKM; yang menilai
  kecurigaan adalah manusia.
- **`assessReviewRequirement` tidak diubah** — bagian 7.
- **Baris `operations.ts:1444` tidak diperbaiki** — bagian 5.

---

## Risiko residual

- **Ambang dua kali lipat adalah pilihan kebijakan, bukan temuan analisis.** Ia dapat terlalu
  longgar bagi nasabah bernilai deklarasi kecil: nasabah yang mendeklarasikan Rp 1 juta dan
  bertransaksi Rp 3 juta akan muncul di worklist setiap bulan tanpa arti. Pengguna ditawari varian
  "persentase dengan lantai Rupiah" dan tidak memilihnya. Bila worklist ternyata berisik, lantai
  itulah penyetel pertamanya.
- **Satu pengali dipakai untuk dua ukuran yang berperilaku berbeda.** Nilai Rupiah bergerak halus;
  banyaknya transaksi bergerak dalam bilangan bulat kecil. Nasabah yang mendeklarasikan satu
  transaksi sebulan menyimpang begitu ia bertransaksi dua kali — sering kali tanpa arti apa pun.
  Deklarasi frekuensi yang kecil karena itu akan menjadi sumber kebisingan pertama pada worklist,
  dan lantai minimum pada frekuensi adalah penyetel pertamanya bila itu terjadi.
- **Deklarasi diisi nasabah sendiri.** Ia pernyataan, bukan fakta terverifikasi. Nilainya terletak
  pada perbandingannya dari waktu ke waktu, bukan pada kebenarannya saat diucapkan.
- **Seluruh nasabah lama akan jatuh tempo pada hari pertama** dan muncul dengan
  `PROFIL_BELUM_DIDEKLARASIKAN`. Itu benar dan memang harus terlihat, tetapi worklist hari pertama
  akan sepanjang daftar nasabah. Peragaan harus memperlihatkan hal ini apa adanya, bukan menyaringnya.
- **`operations.ts:1444` membaca `Date` tengah malam UTC dengan penggetah lokal.** Benar pada
  produksi UTC dan pada mesin WIB, salah pada zona waktu negatif. Tercatat, tidak diperbaiki di sini.
