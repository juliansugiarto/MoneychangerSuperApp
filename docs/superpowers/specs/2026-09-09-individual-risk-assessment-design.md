# Paket J — Individual Risk Assessment

**Temuan BI 11.** Dirancang 9 September 2026. Paket terbesar yang tersisa, dan menurut catatan sesi
**pemeriksa berjalan menyusuri IRA** — temuan 8, 9, 10, 11, dan 12 semuanya adalah pertanyaan di
dalamnya.

Rancangan ini menghasilkan **dua rencana bertugas**, bukan satu:

- `plans/2026-09-09-individual-risk-assessment-j1-fondasi-data.md` — penulis data dan klasifikasi
  risiko, tujuh tugas, migrasi `0053`.
- `plans/2026-09-09-individual-risk-assessment-j2-penilaian.md` — penilaian, kuesioner, persetujuan,
  sembilan tugas, migrasi `0054`.

Alasan pemecahannya bukan sekadar besar: aturan proyek menuntut **tepat satu tugas migrasi per
rencana**, dan paket ini butuh dua migrasi yang berbeda sifatnya. Yang pertama menyentuh tabel yang
sudah dipakai transaksi hidup (`customers`, `exchange_transactions`); yang kedua hanya menambah
tabel baru yang belum punya pembaca. Menggabungkannya berarti satu rollback yang harus membatalkan
dua hal sekaligus.

---

## Masalah

### 1. Tidak ada penilaian risiko sama sekali

Pencarian `risk assessment`, `IRA`, `KPMR`, `inheren` di seluruh repo menghasilkan nol. Tidak ada
tabel, tidak ada halaman, tidak ada perhitungan. Yang ada hanya `customers.riskLevel` — peringkat
risiko **per nasabah**, yang merupakan hal lain sama sekali. IRA adalah penilaian **lembaganya
sendiri**, satu penilaian untuk seluruh perusahaan per periode.

### 2. Sebagian besar masukan yang dituntut BI sebenarnya sudah ada di basis data — tetapi tidak dalam bentuk yang dapat dihitung

Template BI meminta persentase transaksi per mata uang, komposisi pekerjaan nasabah, komposisi bentuk
badan hukum, jumlah PEP, dan nominal transaksi dengan warga negara berisiko tinggi. Aplikasi ini
menyimpan setiap transaksi beserta mata uang dan nasabahnya sejak hari pertama. Yang belum ada
bukanlah datanya, melainkan **kosakata yang dapat dijumlahkan**:

- `customers.occupation` adalah teks bebas `varchar(160)` (`server/routers.ts:229` hanya menuntut
  `min(2)`), sementara BI memakai daftar tertutup ±23 kategori.
- `customers` sama sekali tidak dapat mewakili badan usaha. `identityType` hanya
  `KTP | PASSPORT | OTHER`; tidak ada bentuk badan hukum, tidak ada skala usaha. Parameter *"Badan
  Usaha dengan bentuk badan hukum berisiko Tinggi"* **tidak punya penulis mana pun**.
- `exchange_transactions` tidak memiliki jalur distribusi. Form C1 meminta pemisahan Kantor /
  Layanan Delivery / Online Merchant.
- Tidak ada klasifikasi risiko apa pun: tidak ada penanda mata uang berisiko, tidak ada daftar FATF,
  tidak ada daftar negara sanksi PBB, tidak ada peringkat risiko provinsi.
- `company_profile` tidak menyimpan provinsi, padahal dua parameter Wilayah Geografis bertumpu
  padanya.

### 3. Aritmetikanya mudah terbalik, dan terbaliknya tidak terlihat

Pada template BI **nilai 5 berarti risiko RENDAH** dan nilai 1 berarti risiko **TINGGI**. Predikat
berjalan dari `1 = Tinggi` sampai `4,5 = Rendah`. Naluri pemrogram justru sebaliknya — "skor tinggi
= risiko tinggi" — dan bila terbalik, seluruh laporan tetap tampil rapi, tetap berisi angka, dan
tetap salah. Inilah alasan seluruh aritmetika paket ini wajib menjadi fungsi murni teruji, bukan
angka telanjang yang tersebar di tengah kode.

---

## Yang sudah diputuskan pengguna

Sepuluh keputusan, diambil 9 September 2026. **Tidak boleh diturunkan ulang maupun ditawar.**

1. **Klasifikasi risiko hidup pada satu tabel** `ira_risk_classifications`, berdimensi
   `dimension × code × riskType × level`, dipelihara CONTROLLER dan tercatat pada `audit_logs`.
   Bukan kolom `isHighRisk` pada `currencies`: template menilai USD dan SGD sama-sama Tinggi untuk
   TPPU, tetapi untuk TPPT USD Tinggi sementara SGD Menengah. Klasifikasi selalu **per jenis
   risiko**, dan berlaku bagi lima dimensi sekaligus (mata uang, pekerjaan, bentuk badan hukum,
   negara, provinsi).
2. **Ambang tiap parameter dapat disunting** lewat halaman pengaturan oleh CONTROLLER, tercatat,
   dengan pita bawaan hasil seed persis seperti template. Bukan konstanta rilis: BI mengubah
   pitanya tanpa memberi tahu siapa pun.
3. **Siklus tahunan ditambah pemicu manual.** Satu penilaian per tahun buku, jatuh temponya tampil
   pada antrean tindakan regulator; CONTROLLER boleh membuka penilaian tambahan kapan saja dengan
   alasan tertulis.
4. **ADMIN mengisi, SHAREHOLDER menyetujui, dan penilaian yang sudah disetujui terkunci.**
   Perbaikan berarti penilaian baru yang menggantikannya (`supersededByAssessmentId`), bukan
   penyuntingan. Meniru arsip dokumen Paket I: menonaktifkan beserta alasan, tidak pernah menyunting
   riwayat.
5. **IRA tidak pernah menulis ke `customers`.** Ia hanya membaca dan mengusulkan. Sejalan dengan
   Paket H, yang sudah menetapkan bahwa pemantauan profil tidak pernah mengubah data nasabah — satu
   aturan, tanpa pengecualian yang perlu dijelaskan kepada pemeriksa.
6. **Penulis jenis nasabah ikut dibangun.** `customers` mendapat `customerType`
   (`INDIVIDU | BADAN_USAHA`) dan `entityLegalForm` memakai daftar tertutup BI, sehingga parameter
   badan usaha dihitung dari data nyata alih-alih selalu nol.
7. **`occupationCategory` ditambahkan berdampingan dengan teks bebas.** Kosakata tertutup BI untuk
   perhitungan; `occupation` tetap apa adanya karena kwitansi dan ekspor goAML mencetak kata-kata
   sebagaimana tertulis di KTP. Baris lama tetap kosong dan muncul pada worklist pelengkapan —
   kekosongan yang terlihat, bukan data yang dikarang.
8. **`distributionChannel` ditambahkan pada `exchange_transactions`**, bawaan `KANTOR`, diisi pada
   borang bon. Bukan asumsi 100% kantor yang diam-diam menjadi salah pada hari layanan antar dibuka.
9. **Aritmetika penilaian seluruhnya fungsi murni di `shared/`**, teruji sendiri, tanpa menyentuh
   basis data dan tanpa membaca jam.
10. **Nilai yang sudah disetujui dibekukan sebagai snapshot** — nilai tiap parameter, ambang yang
    berlaku saat itu, dan klasifikasi yang dipakai. Meniru `customer_profile_reviews.deviationReasons`:
    menghitung ulang dokumen yang sudah ditandatangani akan mengubah isinya di belakang orang yang
    menandatanganinya.

---

## Rancangan

### 1. Tiga lapis, persis seperti workbook-nya

Template BI (`Individual Risk Assessment_Penyelenggara_KUPVA BB`, dibaca 9 September 2026 dari berkas
milik pengguna) terdiri dari enam lembar. Empat di antaranya menjadi rancangan ini:

| Lembar | Isi | Menjadi |
|---|---|---|
| `C1. Form KUPVA BB` | Formulir permintaan data: omzet per mata uang, jalur distribusi, komposisi pekerjaan, badan usaha, geografis, kepemilikan | **Dihitung penuh** dari basis data (kecuali kepemilikan) |
| `A1. KUPVA BB` | 33 parameter risiko inheren beserta pita kriteria dan bobotnya | Skor diturunkan dari C1 lewat pita |
| `B. KPMR 2025` | 31 pertanyaan pada lima pilar | Kuesioner, jawaban manusia |
| `Rekap` + `Matriks & Penilaian` | Bobot dan matriks nilai akhir | Fungsi murni |

Urutannya searah: **C1 → A1 → Rekap ← KPMR**. Tidak ada lapis yang boleh dilewati, dan tidak ada
angka pada A1 yang boleh muncul tanpa asal di C1.

### 2. Skalanya terbalik, dan itu ditulis besar-besar

`5 = Rendah`, `1 = Tinggi`. Berlaku pada seluruh parameter inheren maupun pada KPMR
(`1 unsatisfactory … 5 strong`). Pita pun mengikuti: persentase **0-20% bernilai 5**, `81-100%`
bernilai 1.

Fungsi murninya menamainya secara eksplisit — `scoreFromBand`, bukan `score` — dan ujinya memuat
satu kasus yang gagal bila skalanya dibalik.

### 3. Aritmetikanya, persis seperti rumus di workbook

Diambil dari rumus aslinya, bukan dari tafsiran:

```
Nilai kelompok      = bobotKelompok × Σ(bobotParameter × nilaiParameter)
Nilai jenis risiko  = Σ nilai kelompok                      (A1!E58 = SUM(L6,L9,L13,L19))
Nilai inheren       = Σ(bobotJenis × nilaiJenis)            (A1!F62 = SUM(F58:F61))
Predikat            = VLOOKUP(nilai, anchors, TRUE)
Rata-rata pilar     = Σ jawaban / banyaknya jawaban bukan N/A   (B!K12 = SUM/COUNTA)
Nilai KPMR          = AVERAGE(kelima rata-rata pilar)           (B!K46)
Nilai akhir         = MATRIKS[predikat inheren][predikat KPMR]
Predikat akhir      = VLOOKUP(nilai akhir, anchors, TRUE)
```

**Bobot jenis risiko:** TPPU 0,4 · TPPT 0,3 · PPSPM 0,05 · Struktural 0,25.

**Bobot kelompok** (Produk / Jalur Distribusi / Pengguna Jasa / Wilayah Geografis):
TPPU 0,3 · 0,2 · 0,3 · 0,2 — TPPT 0,2 · 0,2 · 0,3 · 0,3 — PPSPM 0,1 · 0,2 · 0,4 · 0,3.
Struktural: Aspek Struktur Kepemilikan 0,8 · Lini Bisnis 0,2.

**Anchor predikat** (pencarian nilai terbesar yang tidak melebihi):

| ≥ | Predikat inheren | Predikat KPMR |
|---|---|---|
| 1 | Tinggi | Unsatisfactory |
| 2 | Menengah ke Tinggi | Marginal |
| 3 | Menengah | Fair |
| 3,75 | Rendah ke Menengah | Satisfactory |
| 4,5 | Rendah | Strong |

**Matriks nilai akhir** (baris = predikat inheren, kolom = predikat KPMR):

| | Unsatisfactory | Marginal | Fair | Satisfactory | Strong |
|---|---|---|---|---|---|
| Tinggi | 1 | 1 | 2 | 3 | 3 |
| Menengah ke Tinggi | 1 | 2 | 2 | 3 | 4 |
| Menengah | 2 | 2 | 3 | 4 | 4 |
| Rendah ke Menengah | 2 | 3 | 4 | 4 | 5 |
| Rendah | 3 | 3 | 4 | 5 | 5 |

Seluruhnya di `shared/individualRiskAssessment.ts`, murni, tanpa `getDb` dan tanpa `new Date()`.

### 4. Dua kejanggalan pada template yang sengaja diikuti apa adanya

Ditemukan saat membaca rumusnya, dan **tidak diperbaiki diam-diam**:

1. **Bobot pilar KPMR tidak dipakai rumusnya.** Lembar `Rekap` mencantumkan 30% / 25% / 25% / 10% /
   10%, tetapi `B!K46` adalah `AVERAGE` biasa atas kelima rata-rata pilar — tanpa bobot. Rancangan
   ini **mengikuti rumusnya** (rata-rata sederhana) karena angka yang dikirim ke BI harus sama
   dengan angka yang dihasilkan berkasnya sendiri. Bobot pilar tetap ditampilkan di layar sebagai
   keterangan, dan perbedaan ini dicatat sebagai risiko residual.
2. **Lembar `Rekap` menyebut tiga komponen Risiko Struktural** (Aspek Kelembagaan 0,3, Struktur
   Kepemilikan 0,5, Lini Bisnis 0,2), sedangkan lembar `A1` hanya memuat dua (Struktur Kepemilikan
   0,8, Lini Bisnis 0,2) dan rumus `E61` hanya menjumlahkan keduanya. Yang diikuti adalah **A1**,
   karena di situlah rumusnya hidup. Aspek Kelembagaan tidak dibangun, dan ketiadaannya dicatat.

### 5. Klasifikasi risiko — satu tabel, lima dimensi

```
ira_risk_classifications
  dimension  CURRENCY | OCCUPATION | LEGAL_FORM | COUNTRY | PROVINCE
  code       kode pada dimensinya (mis. "USD", "KARYAWAN_SWASTA", "PT", "KP", "JAWA_BARAT")
  riskType   TPPU | TPPT | PPSPM
  level      TINGGI | MENENGAH | RENDAH
  sourceNote alasan/rujukan SRA — wajib diisi
  + penyunting terakhir dan waktunya
```

Kunci uniknya `(dimension, code, riskType)`. Kode yang tidak punya baris klasifikasi **dianggap
RENDAH**, dan halaman pemeliharaannya menampilkan berapa banyak kode yang belum diklasifikasikan —
kekosongan tetap terlihat, tidak diam-diam menjadi nol.

### 6. Sumber data tiap parameter, tanpa satu pun yang menggantung

33 parameter: **24 dihitung** dari basis data, **9 dinyatakan** oleh penilainya. Tidak ada parameter
yang skornya selalu nol karena sumbernya tidak ada.

| Jenis | Parameter | Sumber |
|---|---|---|
| TPPU 1a/1b | Mata uang berisiko Tinggi / Menengah | **Hitung** — omzet Rp per mata uang ÷ total, dibandingkan klasifikasi `CURRENCY` |
| TPPU 2a/2b | Jalur distribusi Tinggi / Menengah | **Hitung** — `exchange_transactions.distributionChannel` (penulis baru, J1) |
| TPPU 2c | Mitra kerja sama | **Nyatakan** — tidak ada tabel mitra; Ada/Tidak pada penilaian |
| TPPU 3a/3b | Profesi Tinggi / Menengah | **Hitung** — `customers.occupationCategory` (penulis baru, J1) |
| TPPU 3c/3d | Badan hukum Tinggi / Menengah | **Hitung** — `customers.entityLegalForm` (penulis baru, J1) |
| TPPU 3e | WN/BH negara FATF | **Hitung** — `customers.nationality` × klasifikasi `COUNTRY` |
| TPPU 4a/4b | Lokasi operasional / kantor | **Hitung** — `company_profile.province` (kolom baru, J1) × klasifikasi `PROVINCE` |
| TPPT 1a–4b (8) | Mata uang, jalur, profesi, wilayah | **Hitung** — sumber sama, klasifikasi `riskType = TPPT` |
| PPSPM 1a | Layanan berisiko tinggi | **Hitung** — klasifikasi `CURRENCY`, `riskType = PPSPM` |
| PPSPM 2a/2b | Mitra asing / mitra negara sanksi PBB | **Nyatakan** |
| PPSPM 3a | Individu dari negara sanksi PBB | **Hitung** — `nationality` × klasifikasi `COUNTRY` |
| PPSPM 3b | Profesi berisiko tinggi PPSPM | **Hitung** — `occupationCategory` |
| PPSPM 3c | Badan usaha PT non-UMKM | **Hitung** — `entityLegalForm` |
| PPSPM 4a | Transaksi dengan negara sanksi | **Hitung** — nominal Rp transaksi nasabah bernegara sanksi |
| Struktural 1a–1e (5) | Kepemilikan, PEP, nominee, WNA, struktur grup | **Nyatakan** — tidak ada tabel pemegang saham, dan tidak dibangun di paket ini |
| Struktural 2a | Lini bisnis lain | **Nyatakan** |

Parameter yang **dinyatakan** bukan lubang: penulisnya adalah borang penilaian itu sendiri, nilainya
tersimpan pada baris penilaian, ikut dibekukan saat disetujui, dan di layar diberi label
*"dinyatakan penilai"* agar pemeriksa tahu mana angka mesin dan mana pernyataan manusia.

### 7. Pembaca agregat — satu periode, seluruh lembaga

Paket H sudah membangun `readMonthlyCustomerActivity` (`server/customerProfileMonitoring.ts`):
aktivitas **satu nasabah, satu bulan**. IRA menanyakan hal yang berbeda — komposisi **seluruh
lembaga selama satu periode penilaian**. Karena itu pembacanya baru, tetapi ia **memakai ulang**,
bukan menurunkan ulang:

- `ACCUMULATED_TRANSACTION_STATUSES` dari `drizzle/schema.ts` — daftar status yang sama.
- `startOfOperationalMonth` / `startOfNextOperationalMonth` dari `shared/regulatoryActionQueue.ts`
  untuk batas periodenya. **Tidak ada penurunan jendela waktu keempat.**
- Pola dua query yang sama seperti Paket H: `currencyId` pada bon lama bermata uang tunggal, dan
  `exchange_transaction_lines` pada bon berbaris banyak. Membaca salah satunya saja membuat mata
  uang pada bon berbaris banyak hilang dari persentase.
- Penyaringan `isDemo` / `isHistorical` pada bon **dan** nasabahnya, sama persis.

Batasnya berupa instan absolut terhadap `transactionAt`, dan itu benar: kolom `datetime` menyimpan
jam UTC. Jangan "memperbaikinya" seperti batas kolom `date`.

### 8. Halaman dan alurnya

Empat rute, seluruhnya `minimumRole: "CONTROLLER"` kecuali persetujuan, dan seluruhnya wajib
didaftarkan pada `shared/backOfficeNavigation.ts` beserta `server/backOfficeNavigation.test.ts` —
ujinya gagal sampai rutenya ditambahkan.

| Rute | Isi |
|---|---|
| `/kepatuhan/klasifikasi-risiko` | Pemeliharaan `ira_risk_classifications` dan ambang pita |
| `/kepatuhan/ira` | Daftar penilaian, tombol buka penilaian baru |
| `/kepatuhan/ira/:id` | Form C1 (terhitung), Form A1 (skor + penyimpangan manual beserta alasan), pernyataan struktural |
| `/kepatuhan/ira/:id/kpmr` | Kuesioner 31 pertanyaan, lima pilar, jawaban 1–5 atau N/A |

Alurnya: `DRAFT` → `MENUNGGU_PERSETUJUAN` → `DISETUJUI`. ADMIN mengisi dan mengajukan; SHAREHOLDER
menyetujui; saat disetujui seluruh nilai dibekukan dan barisnya terkunci. Penilaian `DISETUJUI` yang
keliru digantikan penilaian baru, tidak pernah disunting.

Otorisasi ditegakkan pada prosedur tRPC lewat fungsi `*Denial` yang dapat diuji — dua preseden yang
sudah ada: `financialFormExportDenial` dan `operationalDocumentUploadDenial`. Gerbang yang hanya
hidup di dalam handler tidak pernah dibuktikan uji mana pun.

### 9. Penilai boleh menyimpang dari angka mesin, dengan alasan

Setiap parameter terhitung menampilkan nilai mesinnya beserta angka mentah pembentuknya. Penilai
boleh menggantinya, tetapi hanya dengan alasan tertulis, dan keduanya — nilai mesin dan nilai yang
dipakai — sama-sama tersimpan. Pemeriksa yang bertanya *"dari mana angka ini?"* mendapat jawaban
lengkap, termasuk ketika jawabannya *"penilai tidak setuju dengan mesin, ini alasannya"*.

---

## Yang sengaja tidak dikerjakan

- **Tidak ada pengiriman otomatis ke BI maupun PPATK.** Hasilnya dilihat di layar dan dicetak;
  tidak ada kanal, tidak ada kredensial, tidak ada jadwal.
- **Tidak ada ekspor XLSX ke bentuk template aslinya.** Temuan `xlsx`/SheetJS pada `pnpm audit`
  masih terbuka, dan menulis workbook bukan syarat ditutupnya temuan 11. Bila kelak dibutuhkan, ia
  paketnya sendiri.
- **Tidak ada tabel pemegang saham maupun tabel mitra kerja sama.** Keduanya dinyatakan pada
  penilaian. Membangunnya berarti dua modul baru yang tidak diminta temuan mana pun.
- **Tidak ada Aspek Kelembagaan** pada Risiko Struktural — lembar `A1` tidak memilikinya dan
  rumusnya tidak memakainya.
- **IRA tidak mengusulkan perubahan `riskLevel` nasabah.** Bahkan sebagai usulan pun tidak: keputusan
  5 menutup jalur itu seluruhnya untuk paket ini.
- **Backfill `occupationCategory` dan `customerType` tidak dilakukan otomatis.** Baris lama tetap
  kosong dan muncul pada worklist. Menebak kategori dari teks bebas adalah mengarang data nasabah.
- **Tidak ada penjadwalan otomatis** yang membuat penilaian sendiri saat tahun berganti. Jatuh
  temponya tampil di antrean; manusia yang membukanya.

---

## Risiko residual

1. **Bobot pilar KPMR tidak dipakai** (lihat Rancangan 4.1). Bila BI kelak menuntut rata-rata
   berbobot, rumusnya berubah — karena itu rata-ratanya berupa fungsi murni tersendiri yang mudah
   diganti, dan ujinya memuat kedua angkanya.
2. **Aspek Kelembagaan tidak ada.** Bila pemeriksa menanyakannya, jawabannya adalah lembar A1 pada
   template yang dipakai memang tidak memuatnya.
3. **Klasifikasi risiko diisi manusia.** Bila SRA berubah dan tidak ada yang memperbaruinya, seluruh
   sisi inheren menjadi usang tanpa keluhan apa pun. Halaman pemeliharaannya menampilkan tanggal
   pembaruan terakhir, tetapi tidak ada yang memaksa siapa pun menyentuhnya.
4. **Nasabah lama tanpa `occupationCategory` mengecilkan penyebutnya.** Persentase profesi dihitung
   atas nasabah yang berkategori saja, dan layarnya menyebutkan berapa banyak yang belum
   berkategori. Angka yang terlihat lengkap padahal sebagian nasabah belum terisi adalah kekeliruan
   yang paling mungkin lolos dari paket ini.
5. **Provinsi cabang dinyatakan, bukan dari tabel cabang.** Aplikasi ini masih satu outlet; tidak
   ada tabel cabang di mana pun.
6. **`pnpm audit --prod --audit-level=high` masih 9 temuan** (6 sedang, 3 tinggi): residual
   `xlsx`/SheetJS ditambah `mysql2 <3.22.0`. Paket ini tidak menambah dependensi dan tidak
   memperbaikinya. **Jangan menyebut audit bersih.**
7. **Migrasi `0051` dan `0052` belum diterapkan ke produksi.** Paket ini menambah `0053` dan `0054`;
   antreannya menjadi empat.
