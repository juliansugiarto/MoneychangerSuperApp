# Paket G — Ekspor B0002/B0003/B0004 dari buku besar

**Ditulis 7 September 2026**, sesudah Paket F2 selesai dan sesudah pengguna menunjukkan ketiga form
BI yang sebenarnya.

---

## Masalah

### 1. Angka sudah dihitung, tetapi tetap diketik ulang

`buildFinancialStatements` menghasilkan kelima laporan dari buku besar, dan sejak Paket F2 tiap pos
dapat ditelusuri ke jurnalnya. Untuk melapor, angka itu **masih diketik ulang** ke berkas Excel BI.
Pengetikan ulang adalah persis risiko yang dituju temuan pemeriksaan 7.1: begitu angka berpindah
lewat tangan, buku besar berhenti menjadi dasar laporan dan hanya menjadi bahan referensi.

Yang ada hari ini hanya **impor**: `parseFinancialWorkbook` membaca workbook yang disusun di luar
aplikasi (`server/financialImport.ts:23`), dan `createFinancialWorkbookTemplate` mengunduhkan
template **kosong** (`server/financialTemplate.ts:13`). Arahnya terbalik dari yang sekarang mungkin.

### 2. Importir yang ada tidak mengenali form BI yang sebenarnya

`mappedRows` memetakan baris lewat kolom **E "Record No"** yang harus berisi angka satu sampai tiga
digit (`server/financialImport.ts:23-25`). Form BI yang ditunjukkan pengguna 7 September 2026
**tidak memiliki kolom itu sama sekali**: ia lembar berformat dengan header *Sandi Pelapor*,
*Periode*, *Nomor Form*, *Jumlah Record*, dan *Jenis Periode*, lalu blok berlabel tanpa penomoran
baris yang terlihat.

Artinya template internal yang selama ini dipakai **bukan** tata letak form resminya. Selama itu
tidak diperbaiki, ekspor yang benar-benar berbentuk form BI tidak akan dapat dibaca kembali oleh
aplikasinya sendiri.

### 3. Bagan akun ternyata memang dipetakan satu-satu — dan sekarang terbukti

Menghitung sel isian pada ketiga form yang ditunjukkan pengguna menghasilkan angka yang sama persis
dengan *Jumlah Record* pada headernya, dan tiap sel punya tepat satu akun penyusun pada
`shared/chartOfAccounts.ts`:

| Form | Jumlah Record | Rincian |
|---|---|---|
| B0002 | **19** | 11 aset + 5 kewajiban + 3 ekuitas |
| B0003 | **25** | 2 pendapatan + 3 harga pokok + 1 pengiriman uang + 9 beban + 8 lain-lain + 1 pajak + 1 pajak penghasilan |
| B0004 | **7** | Saldo positif/negatif, laba/rugi, dividen, menambah/mengurangi ekuitas |

Komentar pada bagan akun berbunyi *"setiap akun di sini dipetakan langsung ke satu baris pada form
B0002/B0003/B0004"*. Paket ini menuliskan pemetaan itu sebagai data, bukan sebagai klaim di dalam
komentar.

---

## Yang sudah diputuskan pengguna

Diputuskan pada sesi rancangan 7 September 2026:

1. **Pengguna menyediakan form resminya**; penomoran dan nama pos tidak ditebak. Struktur pada spec
   ini diturunkan dari tangkapan layar ketiga form milik perusahaan.
2. **Ekspor meniru tata letak resmi sebagai `.xlsx` tanpa makro.** Tombol *Simpan* pada form BI
   adalah makro milik berkas mereka dan tidak dapat dibuat ulang oleh pustaka spreadsheet mana pun;
   berkas hasil ekspor berbentuk sama dan berisi angka yang benar, tetapi penekanan tombol resminya
   tetap dilakukan manusia pada berkas BI.
3. **Importir diajari membaca format resmi**, mengenali baris lewat **label pos**, bukan Record No.
   Satu berkas yang sama karena itu dapat diekspor lalu diimpor kembali, dan form BI yang disusun di
   luar aplikasi pun akhirnya dapat diimpor.
4. **Isi workbook: tiga form B ditambah satu lembar penelusuran** yang memperlihatkan tiap pos
   beserta akun dan saldo penyusunnya.
5. **Ekspor juga menyimpan snapshot keuangan** bersumber buku besar, sehingga alur paket regulator
   (maker-checker) berjalan tanpa mengimpor kembali berkas yang baru saja dihasilkan sendiri.
6. **Hanya tahun buku penuh yang dapat diekspor.** Form menyatakan *Periode: Tahun* dan *Jenis
   Periode: A*; rentang lain ditolak.

**Data asli tidak masuk proyek.** Tangkapan layar yang ditunjukkan pengguna memuat pembukuan
sebenarnya tahun 2025. Yang diambil hanya strukturnya — label, urutan, jumlah record. Tidak satu pun
nominalnya disalin ke dalam kode, fixture, uji, maupun dokumentasi, sesuai aturan keras `CLAUDE.md`.

---

## Rancangan

### 1. Struktur form sebagai data murni — `shared/regulatoryForms.ts`

Tidak ada tabel baru dan tidak ada migrasi. Struktur ketiga form adalah **konstanta**, sama seperti
bagan akun, dan dengan alasan yang sama: form regulator ditinjau sekali, dan kekeliruan di sini
menurun ke setiap pelanggan sekaligus.

```ts
export type FormRowSource =
  /** Saldo satu akun, searah saldo normalnya. */
  | { kind: "AKUN"; code: string }
  /** Sisi positif atau negatif dari sebuah saldo bertanda; sisi yang tidak terpakai bernilai nol. */
  | { kind: "SISI"; code: string; side: "POSITIF" | "NEGATIF" }
  /** Jumlah beberapa baris di atasnya — dihitung, tidak diisi. */
  | { kind: "SUBTOTAL"; of: string[] }
  /** Baris berlabel tanpa nilai (judul kelompok). */
  | { kind: "JUDUL" };

export type FormRow = {
  /** Kunci internal yang stabil; bukan nomor baris pada berkas. */
  key: string;
  label: string;
  /** Kolom pada B0002: aset di kiri, kewajiban dan ekuitas di kanan. */
  column?: "KIRI" | "KANAN";
  indent: 0 | 1 | 2;
  source: FormRowSource;
};

export type RegulatoryForm = {
  code: "B0002" | "B0003" | "B0004";
  title: string;
  /** Jumlah baris ber-nilai yang wajib terisi — angka pada header form. */
  recordCount: 19 | 25 | 7;
  rows: FormRow[];
};
```

`recordCount` bukan hiasan: ia **invarian yang diuji**. Ekspor yang menghasilkan jumlah baris isian
berbeda dari angka pada header formnya sendiri adalah ekspor yang salah, dan itu harus gagal di uji,
bukan di meja pemeriksa.

### 2. Pos bersih dipecah menjadi dua baris

Form memisahkan `Laba` dari `Rugi (-)`, `Saldo Positif` dari `Saldo Negatif`, dan `Menambah Ekuitas`
dari `Mengurangi Ekuitas (-)`. Buku besar menyimpan **satu saldo bertanda**. Karena itu:

```
nilai(SISI positif, saldo)  = saldo > 0 ? saldo : 0
nilai(SISI negatif, saldo)  = saldo < 0 ? |saldo| : 0
```

Sisi negatif disajikan sebagai **bilangan positif**, karena labelnya sendiri sudah membawa tanda
kurang. Menuliskannya negatif akan menguranginya dua kali pada penjumlahan formnya.

Yang terkena: `7-1400` laba/rugi penjualan aset tetap, `7-1500` selisih kurs, `7-1900` lain-lain,
laba ditahan pada B0002, serta empat pasangan pada B0004.

### 3. Baris yang memang selalu nol, dan mengapa itu sah di sini

`Lain-lain (net)` pada B0004 — *Menambah Ekuitas* dan *Mengurangi Ekuitas* — tidak punya akun
penyusun pada bagan akun hari ini, sehingga nilainya selalu nol.

Ini **tidak** melanggar aturan "Fitur Harus Punya Sumber Data". Aturan itu melarang membangun baris
laporan yang penulisnya tidak ada **pada laporan buatan kita sendiri**; di sini barisnya ditentukan
formulir regulator, dan menghilangkannya akan membuat berkasnya tidak berbentuk form B0004 lagi.
Barisnya tetap ada, bernilai nol, dan alasannya dicatat pada lembar penelusuran — bukan disembunyikan.

### 4. Penulis workbook — `server/financialFormExport.ts`

Satu sheet per form ditambah satu lembar penelusuran. Tiap sheet memuat header yang sama dengan
form aslinya:

```
Sandi Pelapor   : company_profile.biReporterCode
Periode         : Tahun / <tahun buku>
Nomor Form      : B0002 | B0003 | B0004
Jumlah Record   : 19 | 25 | 7
Jenis Periode   : A
```

`biReporterCode` kosong adalah **penghalang beralasan**, bukan berkas berheader kosong: berkas
laporan tanpa sandi pelapor tidak dapat dipakai, dan mengetahuinya saat mengunduh jauh lebih murah
daripada mengetahuinya di hadapan pemeriksa.

Angkanya diambil dari `buildFinancialStatements` — **satu sumber**, yang sama dengan yang tampil di
layar. Ekspor tidak boleh menghitung ulang saldo dari `accountBalancesFor` sendiri: dua jalur
perhitungan yang dapat berbeda pendapat adalah kekeliruan yang justru tidak terlihat dari berkas
hasilnya.

### 5. Lembar penelusuran

Satu sheet `Penelusuran`, satu baris per pos berisi: kode form, label pos, akun penyusunnya, saldo
akun itu, dan nilai yang masuk ke form. Untuk baris `SISI`, disebutkan saldo bertandanya dan sisi
mana yang terpakai. Untuk baris yang selalu nol, disebutkan alasannya.

Inilah jawaban atas temuan 7.1 di dalam satu berkas: pemeriksa dapat menunjuk sebuah pos pada form
dan langsung melihat akun yang menyusunnya, tanpa membuka aplikasi.

### 6. Importir mengenali dua tata letak

`parseFinancialWorkbook` bercabang di depan:

- Sheet memuat penanda `Nomor Form` beserta `B0002/B0003/B0004` → **jalur format resmi**, memetakan
  baris lewat **label pos** yang dinormalkan (huruf kecil, tanpa spasi ganda, tanpa tanda kurung
  penanda seperti `(-)` dan `(-/-)`), dicocokkan dengan `FormRow.label`.
- Selain itu → **jalur Record No yang sudah ada**, tidak berubah sama sekali.

Label yang tidak dikenali dikembalikan sebagai baris yang dilewati **beserta labelnya**, bukan
diabaikan diam-diam. Berkas resmi yang labelnya berubah karena revisi form akan terlihat sebagai
daftar pos yang tidak dikenali — dan itu memang yang harus terjadi.

### 7. Gerbang tahun buku penuh

Ekspor menolak rentang yang bukan 1 Januari–31 Desember satu tahun yang sama, dengan pesan yang
menyebut tahun terdekat yang dapat diekspor. Alasannya tertulis pada form: *Jenis Periode: A*.

Laporan bulanan tetap dapat dibaca di layar seperti sebelumnya; yang dibatasi hanya berkas ekspornya.

### 8. Snapshot bersumber buku besar

Sesudah workbook tersusun, ekspor memanggil `createFinancialStatementSnapshot`
(`server/operations.ts:3333`) dengan `sourceLabel` **"Buku besar"** dan `sourceReference` berisi
tahun bukunya. Baris snapshot memakai `{ code, label, value }` yang sudah ada — `code` diisi kunci
baris form, bukan kode akun, supaya paket regulator membaca pos yang sama dengan yang tercetak.

`sourceDigest` yang sudah ada membuat ekspor kedua atas tahun yang sama dan angka yang sama gagal
menyisipkan baris kembar — dan itu perilaku yang benar: snapshot yang identik bukan snapshot baru.
Bila angkanya **berubah**, digestnya berbeda dan snapshot barunya tersimpan, sehingga riwayat
perubahannya utuh.

### 9. Rute unduhan dan tombol

Rute `GET /api/financial-form-export?year=YYYY` pada `server/_core/index.ts`, mengikuti pola
`/api/financial-snapshot-template` yang sudah ada: `authenticateInternalRequest`, gerbang peran
Controller/Shareholder, `Content-Disposition` dengan nama berkas yang menyebut tahunnya.

Tombolnya pada halaman **Laporan Keuangan** yang dibangun Paket F2, di samping rentang tanggalnya,
beserta keterangan bahwa berkasnya tidak dikirim ke BI oleh aplikasi.

### 10. Uji pulang-pergi

Ekspor → `parseFinancialWorkbook` → bandingkan nilai tiap pos dengan keluaran
`buildFinancialStatements`. Ini satu-satunya bukti bahwa penulis dan pembaca memakai tata letak yang
sama; tanpa uji ini, keduanya dapat berpisah diam-diam dan baru ketahuan saat sebuah berkas ditolak
regulator.

---

## Yang sengaja tidak dikerjakan

- **Tidak ada pengiriman otomatis ke BI.** Ekspor menghasilkan berkas; manusia yang mengirim.
  Aturan keras `CLAUDE.md`, dan tidak berubah oleh paket ini.
- **Makro tidak dibuat ulang.** Berkas hasil ekspor tidak memiliki tombol *Simpan* milik form BI.
  Menulis ulang berkas ber-makro lewat pustaka spreadsheet kerap merusak makronya, dan berkas
  laporan yang tombolnya mati lebih berbahaya daripada berkas yang jelas-jelas tidak punya tombol.
- **Arus Kas dan CALK tidak ikut diekspor.** Keduanya tidak punya form B, dan menaruhnya di berkas
  yang sama akan mengaburkan mana yang diminta regulator dan mana yang tidak.
- **Template kosong yang sudah ada tidak dihapus.** Ia tetap berguna bagi outlet yang pembukuannya
  belum masuk aplikasi ini.
- **Tidak ada pemetaan akun yang dapat diubah pengguna.** Bagan akun dan struktur form sama-sama
  konstanta yang ditinjau sekali.

---

## Risiko residual

- **Struktur form pada spec ini diturunkan dari tangkapan layar, bukan dari berkasnya.** Tugas 1
  wajib memverifikasinya terhadap berkas asli yang disediakan pengguna sebelum kode lain
  dibangun di atasnya. Label yang meleset satu kata akan membuat importir melewati barisnya.
- **Form BI dapat direvisi.** Struktur berada di satu berkas dan `recordCount` diuji, sehingga
  revisinya terlihat sebagai uji yang gagal — tetapi tetap menuntut manusia membaca form barunya.
- **`Lain-lain (net)` pada B0004 selalu nol** sampai ada modul yang menuliskannya. Bila kelak
  outlet benar-benar punya pergerakan ekuitas lain, barisnya sudah ada tetapi sumbernya belum.
- **Snapshot bersumber buku besar dan snapshot hasil impor kini hidup berdampingan.** Keduanya
  dapat memuat tahun yang sama dengan angka berbeda bila pembukuan luar dan buku besar tidak
  sejalan. Itu keadaan yang harus terlihat, dan `sourceLabel` membedakannya — tetapi tidak ada yang
  mencegahnya.
- **Bagan akun masih perlu ditinjau seorang akuntan satu kali**, sama seperti sejak Paket C.
