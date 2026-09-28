# Butir B sebelum aplikasi desktop — pemblokiran, penginian klasifikasi, tanggal berakhir hubungan

**Tanggal:** 28 September 2026 · **Status:** disetujui pengguna per bagian dalam percakapan;
menunggu tinjauan naskah.

Menutup daftar "sisa pekerjaan sebelum aplikasi desktop" (`PROMPT-SESI.md`). Pengguna memutuskan
kelima butir B satu per satu pada 28 September 2026:

| Butir | Keputusan |
|---|---|
| B1 bentuk baru `server/tenantIsolation.live.test.ts` | **Diterima apa adanya.** Tanpa kode. Uji ikut terhapus bersama tenancy pada program desktop langkah 5. |
| B2 Temuan 3 — pemblokiran serta merta dan percobaan transaksi | **Dibangun: hentikan + catat** (Bagian B2) |
| B3 Temuan 7 — penginian berkala klasifikasi risiko | **Dibangun: klasifikasi saja**, tanpa tinjauan berkala per nasabah (Bagian B3) |
| B4 tanggal berakhir hubungan nasabah INACTIVE lama | **Dibangun: Controller mengisi** dengan sumber wajib (Bagian B4) |
| B5 harga per seri uang kertas | **Dibuang ke ROADMAP** sebagai calon sesudah pindah desktop, dibuka hanya bila toko memintanya. Cara resmi tetap: harga diketik pada bon, dalam toleransi atau dengan alasan. |

Tiga bagian di bawah berdiri sendiri; satu rencana, satu migrasi (B2 + B3; B4 tanpa migrasi).

---

## B2. Pemblokiran atas kecocokan DTTOT/DPPSPM dan pencatatan percobaan transaksi

### Dasar

Pasal 47 ayat (1) huruf d PBI 10/2024: bila ada kesamaan nama, **Pemblokiran secara serta merta dan
tanpa pemberitahuan**, dilaporkan sebagai LTKM **termasuk percobaan Transaksi**. Pasal 60 ayat (4)
huruf d: tembusan laporan pemblokiran kepada BI paling lambat **3 hari kerja**.

### Keadaan hari ini (diperiksa 28 September 2026)

- `screenCustomer`/`rescreenAllCustomers` menulis `customer_watchlist_screenings` saat nasabah dibuat,
  diubah, dan saat daftar diimpor — tetapi `createTransaction` **tidak pernah membacanya**.
- Kecocokan yang dicentang petugas (`customers.dttotPpsdmMatch`) menjadikan nasabah HIGH, dan gerbang
  `customerHighRiskDenial` **meloloskannya begitu Pemegang Saham menyetujui** (`DISETUJUI`). Ini
  bertentangan dengan Pasal 47: kecocokan nama tidak dapat disetujui lewat. **Diperbaiki di sini.**
- Transaksi yang tidak jadi tidak meninggalkan baris.
- Tidak ada kalender hari kerja (Temuan 6), jadi tenggat 3 hari kerja belum dapat dihitung benar.

### Tabel baru `watchlist_blocks` — catatan pemblokiran

Satu baris = satu pemblokiran atas **nasabah**, dibuka pada saat kecocokan, bukan di loket.

| Kolom | Isi |
|---|---|
| `customerId` | nasabah yang diblokir |
| `openedAt` | instan UTC, ditulis dari JS (bukan `DEFAULT CURRENT_TIMESTAMP`) |
| `source` | `PENYARINGAN` (otomatis) · `PETUGAS` (centang `dttotPpsdmMatch`) · `PENGISIAN_AWAL` (migrasi) |
| `screeningId` | baris penyaringan pemicu; null untuk `PETUGAS`/`PENGISIAN_AWAL` tanpa penyaringan |
| `matchKeys` | JSON larik kunci kecocokan: `listType:referenceCode`, atau `listType:nama-ternormalisasi` bila tanpa kode; null bila tidak diketahui (pengisian awal, centang petugas) |
| `status` | `OPEN` · `CONFIRMED` · `FALSE_POSITIVE` · `DICABUT` |
| `resolvedByUserId`, `resolvedAt`, `resolutionNotes` | keputusan; catatan wajib |
| `ltkmReference` | rujukan LTKM yang dilaporkan di luar aplikasi (diisi saat atau sesudah `CONFIRMED`) |
| `biCopySentAt` | tanggal tembusan ke BI (Pasal 60(4)d) |
| `revocationReference` | rujukan surat pencabutan otoritas (wajib saat `DICABUT`) |

**Kunci kecocokan memakai `referenceCode`/nama, bukan `sanctions_watchlist_entries.id`**: impor daftar
menghapus lalu menyisipkan ulang entri, sehingga id berganti setiap impor.

**Aturan pembukaan** (satu fungsi murni di `shared/`):
- Penyaringan dengan `matchCount > 0` membuka blokir `OPEN` **kecuali** nasabah sudah punya blokir
  `OPEN` atau `CONFIRMED`, **atau** seluruh kunci kecocokan barunya sudah tercakup oleh blokir
  `FALSE_POSITIVE` sebelumnya. Blokir `FALSE_POSITIVE` dengan `matchKeys` null tidak mencakup apa pun
  (jadi blokir hasil pengisian awal yang dinyatakan salah sasaran akan terbuka sekali lagi pada impor
  berikutnya, kali itu dengan kuncinya).
- Centang `dttotPpsdmMatch` dari false ke true membuka blokir `OPEN` sumber `PETUGAS` kecuali sudah ada
  `OPEN`/`CONFIRMED`.
- Penyaringan nihil **tidak** menutup blokir apa pun — hanya manusia yang menutup.
- `customers.dttotPpsdmMatch` tetap tidak disentuh penyaringan otomatis (prinsip
  `customerWatchlistScreening.ts`); ia diset `true` hanya oleh keputusan `CONFIRMED`.

**Pengisian awal (migrasi):** `INSERT … SELECT` membuka blokir `OPEN` sumber `PENGISIAN_AWAL` bagi
setiap nasabah non-demo non-historis yang `dttotPpsdmMatch = true` atau penyaringan terakhirnya
`matchCount > 0`. Tanpa ini kecocokan yang sudah ada hari ini tidak pernah terblokir.

**Keputusan** (CONTROLLER ke atas, ditegakkan di tRPC; catatan wajib; setiap keputusan diaudit):
- `OPEN → CONFIRMED`: kecocokan nyata. `dttotPpsdmMatch` diset true (dengan catatan). Blokir permanen.
  `ltkmReference` dan `biCopySentAt` boleh diisi saat itu atau sesudahnya (aksi terpisah
  "Catat pelaporan"), karena LTKM dan tembusan dikirim di luar aplikasi.
- `OPEN → FALSE_POSITIVE`: bukan orang yang sama. Nasabah lepas untuk kunci-kunci itu saja.
- `CONFIRMED → DICABUT`: hanya dengan `revocationReference` (surat pencabutan otoritas).
- Tidak ada jalan lain keluar dari `CONFIRMED`; keputusan risiko tinggi tidak menyentuhnya.

### Tabel baru `attempted_transactions` — percobaan transaksi

| Kolom | Isi |
|---|---|
| `blockId` | blokir yang menahan |
| `customerId`, `representativeCustomerId` | pihak bon |
| `blockedParty` | `NASABAH` · `KUASA` — pihak mana yang terblokir |
| `tellerUserId`, `attemptedAt` | siapa dan kapan (instan UTC dari JS) |
| `operation` | `BUY` · `SELL` |
| `linesSummary` | JSON: per baris kode valuta, jumlah valas, jumlah Rupiah — dari masukan bon (kurs tidak disimpan per baris karena satu baris dapat memuat beberapa kurs per pecahan; kurs rata-rata terbaca dari kedua jumlah) |
| `totalIdr` | decimal |

**Penulisnya satu:** `createTransaction`. Urutan gerbang: nasabah ada → aktif → **blokir** →
risiko tinggi → sisanya. Bila nasabah atau pihak kuasa/wakil punya blokir `OPEN`/`CONFIRMED`,
server menulis satu baris percobaan (di luar transaksi basis data bon, supaya tetap tersimpan
walau bon ditolak) lalu melempar galat. **Tidak ada** bon, kas, pecahan (kedua kaki), jurnal, atau
stok yang ditulis — penolakan terjadi sebelum semuanya. Jumlah Rupiah dihitung dari masukan baris
apa adanya; bila masukan baris cacat, percobaan tetap dicatat dengan baris yang dapat dibaca dan
`totalIdr` dari baris yang sahih.

**Pesan kepada kasir** (netral, sesuai "tanpa pemberitahuan"):
*"Transaksi tidak dapat diproses. Hubungi Controller. Jangan sampaikan alasannya kepada nasabah."*
Layar bon **tidak** memperingatkan lebih awal saat nasabah dipilih — sengaja, supaya percobaan
tercatat dengan rinciannya (disetujui pengguna).

### Layar dan antrean

- **Register Pemblokiran** (CONTROLLER ke atas): daftar blokir per status, percobaan yang tertaut,
  ringkasan penyaringan pemicu, dan aksi keputusan. Keadaan muat/kosong/galat; teks tindakan kritis
  jelas.
- **Kesiapan Operasional** (pola `getIraAssessmentDue` di `shared/regulatoryActionQueue.ts`): dua
  butir — blokir `OPEN` yang belum diputuskan, dan blokir `CONFIRMED` tanpa `biCopySentAt`.
  Tenggat **tidak dihitung**; tampil "diblokir <tanggal WIB> — tembusan BI paling lambat 3 hari
  kerja" sampai kalender hari kerja (Temuan 6) ada.

### Skenario gagal yang harus tertangani

- Impor daftar baru saat nasabah sedang di loket: blokir terbuka pada penyaringan ulang; bon
  berikutnya ditolak dan dicatat.
- Pihak kuasa/wakil yang terblokir, nasabahnya tidak: tetap ditolak, `blockedParty = KUASA`.
- Nasabah demo/historis: tidak disaring ulang, tidak diblokir (sama dengan penyaringan hari ini).
- Penulisan percobaan gagal: bon tetap ditolak (galat penulisan dicatat ke log server, bukan
  ditelan menjadi keberhasilan).

---

## B3. Penginian berkala klasifikasi risiko IRA

### Dasar

Pasal 9 ayat (6) PBI 10/2024: hasil manajemen risiko **dikinikan berkala**, **didokumentasikan**, dan
punya **mekanisme penyediaan informasi bagi otoritas**. Risiko residual J2 nomor 3: tabel
`ira_risk_classifications` kosong saat dipasang dan kode tanpa baris dibaca RENDAH diam-diam.

### Rancangan

- **Tabel baru `ira_classification_reviews`** (hanya tambah, tidak pernah diubah):
  `reviewedAt` (UTC dari JS), `reviewedByUserId`, `notes` (wajib), `snapshot` (JSON seluruh baris
  klasifikasi saat itu: dimensi, kode, jenis risiko, tingkat, `sourceNote`, `updatedAt`),
  `classificationCount`. Tinjauan tanpa perubahan tetap tercatat — justru itu buktinya.
- **Tinjauan = pengesahan atas seluruh tabel**, bukan per baris. Perubahan tetap lewat `classifyRisk`
  yang sudah ada; lalu Controller menandatangani "Tinjauan selesai".
- **Kode belum diklasifikasi** (fungsi murni): semesta kode × tiga jenis risiko, dikurangi baris yang
  ada. Semesta: valuta aktif (CURRENCY); kosakata `shared/iraVocabulary.ts` untuk OCCUPATION,
  LEGAL_FORM, PROVINCE, DISTRIBUTION_CHANNEL; untuk COUNTRY hanya kode negara yang **benar-benar dipakai** pada `customers.nationality`
  nasabah (tidak ada daftar tertutup). Ditampilkan di layar klasifikasi IRA dan layar tinjauan:
  *"N kode belum diklasifikasi — saat ini dibaca RENDAH"*. **Tinjauan tidak dapat ditandatangani
  selama N > 0** (ditegakkan di server). Rumus IRA **tidak berubah** — `classificationLevel` tetap
  membaca RENDAH; yang berubah hanya ketiadaannya kini terlihat dan menghalangi pengesahan.
- **Selang** kolom baru `operational_settings.iraClassificationReviewMonths` (bawaan 12, 1–36),
  diubah CONTROLLER ke atas.
- **Jatuh tempo** (fungsi murni di `shared/regulatoryActionQueue.ts`, zona operasional): belum pernah
  ditinjau, atau `reviewedAt` terakhir + selang bulan < awal hari operasional ini. Tampil di Kesiapan
  Operasional sebagai *"Tinjauan klasifikasi risiko jatuh tempo"*.
- **Penyediaan bagi otoritas:** riwayat tinjauan dapat dibuka dan snapshot tiap tinjauan dapat
  diunduh sebagai JSON/CSV dari layar yang sama.

---

## B4. Tanggal berakhir hubungan bagi nasabah INACTIVE lama

- Kartu *Tidak aktif tanpa tanggal berakhir* (`PenatausahaanDokumen.tsx`, hitungan dari
  `documentRetentionQueries.ts`) menjadi daftar nasabah dengan aksi **"Isi tanggal berakhir"**
  (CONTROLLER ke atas).
- Masukan: tanggal (hari WIB) dan **sumber** wajib (mis. "berkas fisik nasabah, surat penutupan …").
- Server menulis hanya bila `profileStatus = INACTIVE` dan `relationshipEndedAt` masih null. Tanggal
  tidak boleh di masa depan dan tidak boleh sebelum transaksi selesai terakhir nasabah itu (hari WIB).
  Disimpan sebagai awal hari operasional (WIB) dalam UTC — lihat memori batas kolom tanggal MySQL.
- Sumber disimpan di `audit_logs` (`CUSTOMER_RELATIONSHIP_END_RECORDED`, before/after). **Tanpa
  migrasi.** Tidak pernah diisi otomatis; sampai diisi, nasabah tetap tanpa jam retensi (arah yang
  aman: disimpan tanpa batas).
- Hitungan lokal 28 September 2026: **0** di kedua basis data lokal; produksi direset dan dimigrasi
  sampai `0058` pada 12 September, jadi kemungkinan besar nol juga (pembacaan produksi tidak
  dijalankan sesi ini). Penulis ini juga melayani impor data lama ke instalasi desktop kelak.

---

## Migrasi

Satu migrasi `0062`: tabel `watchlist_blocks` + pengisian awal, tabel `attempted_transactions`, tabel
`ira_classification_reviews`, kolom `operational_settings.iraClassificationReviewMonths`. Hanya
tambahan; tidak ada perubahan destruktif. Diterapkan ke `moneychanger` dan `mc_t_abcvalas` lewat
`node scripts/tenant.mjs migrate-all`. **Tidak diterapkan ke produksi** (antrean produksi menjadi
`0059`–`0062`). Rollback lokal: drop ketiga tabel dan kolom.

## Bukti uji

- Vitest: fungsi murni pembukaan blokir (kunci, cakupan FALSE_POSITIVE, null), gerbang bon (blokir
  sebelum risiko tinggi; `DISETUJUI` tidak meloloskan), `createTransaction` menulis percobaan dan tidak
  menulis kas/pecahan/bon, keputusan per peran; semesta kode belum diklasifikasi, penolakan
  pengesahan saat N > 0, jatuh tempo lintas batas bulan WIB; validasi B4.
- Peragaan end-to-end di `moneychanger`: impor daftar uji → nasabah cocok → bon ditolak → percobaan
  tampil → putuskan FALSE_POSITIVE dan CONFIRMED; tinjauan klasifikasi dari N > 0 sampai
  ditandatangani; nasabah INACTIVE tanpa tanggal diisi dari kartu.
- `vitest run`, `tsc --noEmit`, `vite build`; Playwright untuk rute yang berubah.
- Panduan A–Z dan `SKEMA-DATABASE-PROJECT.md` diperbarui.

## Di luar cakupan

- Kalender hari kerja (Temuan 6) dan penghitungan tenggat 3 hari kerja.
- Pengiriman LTKM/tembusan ke PPATK/BI — tetap di luar aplikasi; aplikasi hanya mencatat rujukannya.
- Tinjauan berkala risiko per nasabah.
- Harga per seri uang kertas (B5, dibuang ke ROADMAP).
