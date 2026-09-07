# Peta Jalan Sisa Pekerjaan — PT Ibukota Valasindo

Ditulis 4 September 2026, setelah paket A selesai (`3d8b217`). **Dokumen induk sisa pekerjaan.**

Sebelas paket, tiap paket dipecah menjadi tugas sebesar **satu commit**. Dikerjakan satu tugas per
sesi. Prompt siap tempel untuk tiap tugas ada di `docs/superpowers/PROMPT-SESI.md`.

---

## Status Pengerjaan

**Centang barisnya setelah commit tugas itu**, supaya sesi berikutnya tahu harus mulai dari mana
tanpa membaca seluruh riwayat. Paket yang belum punya rencana rinci ditandai *(perlu sesi
rancangan)* — kerjakan sesi rancangannya lebih dulu, yang menghasilkan spec dan rencana bertugas.

### Paket K1 — Batas tanggal `jakartaBusinessDate`
Rencana: `plans/2026-09-04-batas-tanggal-opname-checklist.md`
- [x] Tugas 1 — Normalkan tanggal pada checklist dan opname
- [x] Tugas 2 — Uji penjaga dan dokumentasi

### Paket B — Setoran modal pada persiapan go-live
Rencana: `plans/2026-09-04-setoran-modal-persiapan-go-live.md`
- [x] Tugas 1 — Kartu "Modal disetor" dan urutan langkah go-live
- [x] Tugas 2 — Peringatan urutan pada pencatatan kas awal
- [x] Tugas 3 — Uji dan dokumentasi

### Paket D — Opname menyeluruh: pecahan dan brankas (temuan BI 6)
Spec: `specs/2026-09-04-opname-pecahan-brankas-design.md`
Rencana: `plans/2026-09-04-opname-pecahan-brankas.md`
- [x] Sesi rancangan — spec dan rencana bertugas
- [x] Tugas 1 — Skema dan migrasi aditif
- [x] Tugas 2 — Pembanding pecahan murni di `shared/`
- [x] Tugas 3 — Angka sistem per pecahan untuk laci dan brankas
- [x] Tugas 4 — `submitStockOpname` menerima pecahan dua lokasi
- [x] Tugas 5 — UI tab Stock Opname
- [x] Tugas 6 — Dokumentasi dan gerbang akhir

### Paket C — Penilaian kas UKA dan penutupan periode (temuan BI 7.1)
Spec: `specs/2026-09-04-penilaian-kas-uka-tutup-periode-design.md`
Rencana: `plans/2026-09-04-penilaian-kas-uka-tutup-periode.md`
- [x] Sesi rancangan — spec dan rencana bertugas
- [x] Tugas 1 — Migrasi penilaian penutupan periode (0047)
- [x] Tugas 2 — Penilaian kurs tengah murni di `shared/`
- [x] Tugas 3 — Pemetaan jurnal penutupan dan penutup laba
- [x] Tugas 4 — `buildPeriodValuation`: bukti kuantitas dan kurs
- [x] Tugas 5 — `postPeriodClosing`: tulis penilaian dan jurnalnya
- [x] Tugas 6 — Penutup laba tahunan dan gerbang `closeAccountingPeriod`
- [x] Tugas 7 — Neraca memakai laba sejak penutupan tahunan terakhir
- [x] Tugas 8 — Tiga prosedur tRPC
- [x] Tugas 9 — Panel Penutupan Periode
- [x] Tugas 10 — Skenario menyeluruh dan dokumentasi

### Paket E — Aset tetap dan penyusutan
Spec: `specs/2026-09-05-aset-tetap-penyusutan-design.md`
Rencana: `plans/2026-09-05-aset-tetap-penyusutan.md`
- [x] Sesi rancangan — spec dan rencana bertugas
- [x] Tugas 1 — Migrasi register aset tetap (0048)
- [x] Tugas 2 — Jadwal penyusutan murni di `shared/`
- [x] Tugas 3 — Tiga pemetaan jurnal aset tetap
- [x] Tugas 4 — Batas kapitalisasi dan pendaftaran aset
- [x] Tugas 5 — `buildMonthlyDepreciation`: bukti beban per aset
- [x] Tugas 6 — `postMonthlyDepreciation`: jurnal bulanan yang idempoten
- [x] Tugas 7 — Pelepasan aset
- [x] Tugas 8 — Gerbang penutupan periode dan penutup laba tahunan
- [x] Tugas 9 — Prosedur tRPC dan navigasi
- [x] Tugas 10 — Halaman Aset Tetap dan panel Penyusutan Bulanan
- [x] Tugas 11 — Skenario menyeluruh dan dokumentasi

### Paket F1 — Kas valuta asing dan revaluasi kurs
Spec: `specs/2026-09-05-kas-valas-revaluasi-kurs-design.md`
Rencana: `plans/2026-09-05-kas-valas-revaluasi-kurs.md`
- [x] Sesi rancangan — spec dan rencana bertugas
- [x] Tugas 1 — Migrasi revaluasi kurs (0049)
- [x] Tugas 2 — Kurs dan penilaian pos moneter murni di `shared/`
- [x] Tugas 3 — Jalur valuta asing pada `mapBankMovement`
- [x] Tugas 4 — Pemetaan `mapCurrencyRevaluation`
- [x] Tugas 5 — `postBankMovements` memasok nilai Rupiah
- [x] Tugas 6 — `buildCurrencyRevaluation`: bukti per mata uang
- [x] Tugas 7 — `postCurrencyRevaluation`: jurnal periode yang idempoten
- [x] Tugas 8 — Gerbang penutupan periode dan penutup laba tahunan
- [x] Tugas 9 — Prosedur tRPC dan panel Revaluasi Kurs
- [x] Tugas 10 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

### Paket F2 — Arus Kas dan CALK
Spec: `specs/2026-09-07-arus-kas-dan-calk-design.md`
Rencana: `plans/2026-09-07-arus-kas-dan-calk.md`
- [x] Sesi rancangan — spec dan rencana bertugas
- [x] Tugas 1 — Migrasi pelunasan dan catatan CALK (0050)
- [x] Tugas 2 — Dua kategori pelunasan pada pemetaan kas dan bank *(satu commit dengan Tugas 1)*
- [x] Tugas 3 — `recordSettlement`: penulis pelunasan beserta pecahannya
- [x] Tugas 4 — Prosedur tRPC dan panel Pelunasan pada tab Modal & Bank
- [x] Tugas 5 — `classifyCashEntry` murni di `shared/cashFlow.ts`
- [x] Tugas 6 — `buildCashFlowStatement` dan penanda `reconciled`
- [x] Tugas 7 — Arus Kas masuk `buildFinancialStatements` beserta peringatannya
- [x] Tugas 8 — Daftar catatan CALK dan panduannya di `shared/financialNotes.ts`
- [x] Tugas 9 — Catatan bangkitan dari buku besar
- [x] Tugas 10 — Penyimpanan teks naratif dan prosedurnya
- [x] Tugas 11 — Halaman Laporan Keuangan dan navigasinya
- [x] Tugas 12 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

**Data uji paket F2 pada `moneychanger` sengaja dibiarkan**, seperti data paket E dan F1: dua
setoran modal Rupiah @ Rp 100.000.000, dua beban sewa @ Rp 5.000.000 yang sudah dilunasi tunai, dan
pelunasan sebagian Rp 20.000.000 atas aset "Brankas Uji Paket E" (sisa Rp 4.000.000 di 2-1900).
Buku besar sesudahnya: 1-1110 Rp 170.000.000, 1-1220 Rp 16.300.000, 3-1100 Rp 217.636.000.

### Paket G — Ekspor B0002/B0003/B0004 dari buku besar — **SELESAI 7 September 2026**
Spec: `specs/2026-09-07-ekspor-laporan-b-form-design.md`
Rencana: `plans/2026-09-07-ekspor-laporan-b-form.md`
- [x] Sesi rancangan — spec dan rencana bertugas
- [x] **Penghalang dicabut 7 September 2026:** pengguna menunjukkan ketiga form terisi; struktur diambil dari tangkapan layarnya, nominalnya tidak
- [x] Tugas 1 — Verifikasi struktur form terhadap berkas asli, lalu `shared/regulatoryForms.ts`
- [x] Tugas 2 — Nilai tiap baris form dari laporan, murni dan teruji
- [x] Tugas 3 — Penulis workbook tiga form
- [x] Tugas 4 — Lembar penelusuran
- [x] Tugas 5 — Importir mengenali format resmi
- [x] Tugas 6 — Uji pulang-pergi ekspor → impor
- [x] Tugas 7 — Gerbang tahun buku penuh dan snapshot bersumber buku besar
- [x] Tugas 8 — Rute unduhan, otorisasi, dan tombol pada halaman Laporan Keuangan
- [x] Tugas 9 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

### Paket H — Profil transaksi dan pemantauan berkala (temuan BI 9 sisa, 10)
Spec: `specs/2026-09-07-profil-transaksi-pemantauan-design.md`
Rencana: `plans/2026-09-07-profil-transaksi-pemantauan.md`
- [x] Sesi rancangan — spec dan rencana bertugas
- [ ] Tugas 1 — Penilaian penyimpangan dan irama berbasis risiko, murni dan teruji
- [ ] Tugas 2 — Migrasi: tiga kolom deklarasi dan tabel `customer_profile_reviews`
- [ ] Tugas 3 — Penulis deklarasi: borang nasabah, `createCustomer`, `updateCustomer`
- [ ] Tugas 4 — Jendela bulanan WIB bersama dan pembacaan aktivitas nyata
- [ ] Tugas 5 — Worklist pemantauan: query, otorisasi, dan batas "hanya mencatat"
- [ ] Tugas 6 — Penulis peninjauan: `recordCustomerProfileReview` beserta auditnya
- [ ] Tugas 7 — Halaman Pemantauan Profil Nasabah
- [ ] Tugas 8 — Skenario menyeluruh, peragaan end-to-end, dan dokumentasi

**Keputusan pengguna 7 September 2026 yang mengikat:** deklarasi = nilai + frekuensi + mata uang;
ambang penyimpangan **nilai bulanan ≥ deklarasi × 2**; mata uang tak terdeklarasi alasan
tersendiri; frekuensi dideklarasikan tetapi **tidak** menyalakan bendera; irama **HIGH 1 bulan,
MEDIUM 3 bulan, LOW 12 bulan**; tindak lanjut **worklist Controller yang hanya mencatat**.

### Paket I — Arsip dokumen perusahaan (temuan BI 3)
- [ ] Sesi rancangan — tulis spec dan rencana bertugas *(perlu sesi rancangan)*

### Paket J — Individual Risk Assessment (temuan BI 11)
- [ ] Sesi rancangan — tulis spec dan rencana bertugas *(perlu sesi rancangan)*

### Paket K2 — Ganti nama PPPSM menjadi PPPSPM
- [ ] Sesi rancangan — tulis spec dan rencana bertugas *(perlu sesi rancangan)*

### Paket K3 — Pembandingan nota terhadap SE BI 18/41/DKSP
- [ ] **Menunggu pengguna:** naskah SE BI 18/41/DKSP belum ada di proyek

---

## Urutan dan ketergantungan

| Urut | Paket | Mengapa di posisi ini |
|---|---|---|
| 1 | **K1** batas tanggal | Bug laten yang menyentuh `stockOpnames.opnameDate`; diperbaiki lebih dulu agar paket D tidak dibangun di atas pencarian yang meleset |
| 2 | **B** setoran modal go-live | Kecil dan berdiri sendiri; memadamkan peringatan "Modal disetor belum tercatat" |
| 3 | **D** opname menyeluruh | Temuan BI 6, lewat tenggat; **mengubah `stock_opnames`, dan paket C membaca tabel itu** |
| 4 | **C** penilaian kas UKA | Membuat neraca seimbang — sisa langsung temuan 7.1 |
| 5 | **E** aset tetap | Memasok baris Penyusutan B0003 yang belum punya asal |
| 6 | **F1** kas valas dan revaluasi kurs | Menyelesaikan pekerjaan yang `mapBankMovement` sendiri tandai *belum*; menghidupkan `REVALUASI_KURS`, 7-1500, dan 1-1220 yang sudah disediakan tetapi menganggur |
| 7 | **F2** Arus Kas dan CALK | Arus Kas metode tidak langsung menambahkan kembali penyusutan dari E, dan barisnya "Pengaruh perubahan kurs atas kas" hanya berisi angka bila F1 sudah ada |
| 8 | **G** ekspor B-form | Diletakkan setelah C–F supaya yang diekspor sudah lengkap |
| 9 | **H** profil transaksi | Berdiri sendiri |
| 10 | **I** arsip dokumen | Berdiri sendiri |
| 11 | **J** IRA | Paling besar; sebagian sisi risiko inherennya dihitung dari data yang sudah ada |
| 12 | **K2/K3** | Kebersihan; K3 menunggu naskah SE |

**Yang mengikat hanya lima:** K1 sebelum D, D sebelum C, E sebelum F2, F1 sebelum F2, C–F2 sebelum G.
H, I, dan J berdiri sendiri dan boleh disisipkan kapan saja — dahulukan bila tekanan pemeriksaan
BI lebih mendesak daripada kerapian laporan keuangan.

---

## Aturan kerja yang berlaku untuk seluruh paket

Berlaku pada setiap tugas di dokumen ini. Sesi yang mengerjakan tugas **tidak perlu** membaca
seluruh `CLAUDE.md` lagi, tetapi harus mematuhi seluruh butir di bawah.

### Perintah mutu

`pnpm` tidak ada di PATH. Klien MySQL di `/opt/homebrew/opt/mysql/bin`.

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

Baseline saat ini (diukur 4 September 2026, setelah paket D): **551 uji lulus, 2 dilewati (81 berkas)**. Tugas yang mengganti uji lama
akan mengubah angkanya — sebutkan angka yang benar-benar dilihat, jangan mengarang.

### Batas keras

- **Jangan menerapkan migrasi ke produksi.** Hanya dua basis data lokal: `moneychanger` dan
  `mc_t_abcvalas`. Terapkan lewat `node scripts/tenant.mjs migrate-all`, **jangan** menjalankan
  berkas `.sql` langsung lewat klien mysql — penanda `--> statement-breakpoint` membuat pernyataan
  kedua gagal dan jurnal `__drizzle_migrations` menjadi tidak konsisten.
- **Jangan membuat data nasabah, transaksi, kas, atau audit produksi untuk demo/uji.** Membuat data
  uji di basis data lokal memerlukan izin pengguna **pada giliran itu juga**. Uji dalam paket-paket
  ini ditulis sebagai uji Vitest atas fungsi dengan `getDb` dipalsukan.
- **Skrip pembersih uji jangan menghapus `audit_logs`.**
- **Rincian pecahan wajib** untuk setiap pergerakan kas fisik. Jangan membuatnya opsional.
- **Transaksi valuta selalu dua sisi** — valuta asing dan Rupiah. Perubahan pada satu sisi wajib
  dicek ulang terhadap sisi lainnya.
- Otorisasi ditegakkan di tRPC/server, bukan disembunyikan di UI. Peran:
  `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`.
- Uang pada buku besar adalah `bigint` sen. Nominal baris jurnal maksimal **dua** angka desimal
  (`AMOUNT_PATTERN`, `shared/ledger.ts:18`); kolom mutasi kas/bank berskala **enam** desimal.
  Konversi harus eksplisit dan **menolak membulatkan uang** — bila presisinya tidak muat, lewati
  dan katakan mengapa.
- Yang tidak dapat dipetakan tanpa menebak dikembalikan sebagai `skipped` beserta alasan yang dapat
  dibaca manusia. **Jangan** memilih akun yang kira-kira cocok.
- Jangan menambah akun ke `shared/chartOfAccounts.ts` tanpa alasan yang tertulis di spec — bagan
  akun dipetakan satu-satu ke baris formulir B0002/B0003/B0004.
- Jangan menambahkan submit otomatis ke BI/regulator.
- Perubahan skema dimulai dari `drizzle/schema.ts`, menghasilkan migrasi, **baca SQL-nya**, lalu
  terapkan terkontrol. Jangan melakukan perubahan destruktif tanpa persetujuan eksplisit.
- Perbarui `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` dan `docs/SKEMA-DATABASE-PROJECT.md` bila perilaku
  pengguna atau struktur data berubah.

### Bentuk tiap tugas

Satu tugas = satu commit yang berdiri sendiri, dengan ujinya sendiri. Bila sebuah tugas membengkak
melebihi berkas yang disebutkan rencananya, **berhenti dan laporkan** sebelum melanjutkan.

---

# Paket K1 — Batas tanggal `jakartaBusinessDate`

**Rencana rinci sudah ada:** `plans/2026-09-04-batas-tanggal-opname-checklist.md`

## Masalah

`jakartaBusinessDate()` (`server/operations.ts:1628`) mengembalikan tengah malam **UTC**. mysql2
memformat `Date` memakai zona waktu **proses**, sehingga di mesin WIB nilai itu menjadi
`'2026-09-01 07:00:00'` saat dibandingkan dengan kolom `date` — dan `eq()` tidak pernah cocok dengan
baris yang sudah ada.

Akibatnya pencarian checklist dan opname hari berjalan tidak menemukan baris yang sudah ada, lalu
mencoba menyisipkan duplikat. Tidak terlihat di produksi (jam server `Etc/UTC`), hanya di mesin
pengembangan. Komentar di fungsi itu sendiri mencatat putaran sebelumnya dari bug yang sama —
"diperbaiki" dengan memindahkan siang ke tengah malam, yang hanya memperkecil selisihnya dari 19 jam
menjadi 7 jam.

Titik yang terkena, semuanya `eq()` atas kolom `date`:

| Berkas | Baris | Kolom |
|---|---|---|
| `server/operations.ts` | ~1732 (`getDailyOperationalChecklist`) | `dailyOperationalChecklists.businessDate` |
| `server/operations.ts` | ~2844 (`openStockOpname`) | `stockOpnames.opnameDate` |
| `server/operations.ts` | ~1798 (`completeTransaction`) | dipakai sebagai `opnameDate` |

## Yang dipakai

Pola yang sudah terbukti, jangan menciptakan yang baru: `dbDate` (`server/ledgerOperations.ts:57`)
dan `dateColumnBound` (`server/operations.ts:2317`), keduanya
`new Date(\`${isoDay(value)}T00:00:00\`)` — tengah malam **lokal** hari kalender yang dimaksud,
benar di kedua zona waktu.

## Yang sengaja tidak dikerjakan

Jangan mengubah perilaku `jakartaBusinessDate` sendiri untuk pemanggil yang **bukan** kolom `date`
(mis. `getOperationalDashboard` yang memakainya sebagai batas `datetime`). Mengubah fungsinya
menyentuh tutup buku, opname, dan checklist sekaligus.

## Risiko residual

Bila kelak ada pemanggil baru yang mengirim hasil `jakartaBusinessDate()` mentah ke kolom `date`,
bug ini kembali tanpa suara. Uji penjaga pada Tugas 2 ada untuk itu.

---

# Paket B — Setoran modal pada persiapan go-live

**Rencana rinci sudah ada:** `plans/2026-09-04-setoran-modal-persiapan-go-live.md`

## Masalah

`client/src/pages/GoLiveSetup.tsx` ternyata bukan wizard: ia hanya empat kartu status yang menautkan
ke halaman lain, dan tulisannya sendiri berbunyi *"Halaman ini tidak mengubah data secara
otomatis."* Modal disetor tidak pernah disebut sama sekali.

Padahal urutan yang benar menentukan apakah buku besarnya masuk akal. Kas awal **pertama** untuk
sebuah mata uang sengaja tidak dijurnal — bila uangnya belum pernah dicatat asalnya, menjurnalnya
berarti mencatat uang yang muncul entah dari mana (lihat paket A, `mapCashMovement` kasus
`OPENING`). Operator yang mencatat hitungan kas pagi lebih dulu akan mendapati Kas Rupiah timpang
sampai modalnya dicatat manual.

`shared/financialStatements.ts:240` sudah menyalakan peringatan *"Modal disetor belum tercatat pada
buku besar"* — tetapi peringatan itu muncul di halaman Buku Besar, bukan di tempat orang menyiapkan
outlet.

## Ruang lingkup

Menuntun urutannya, bukan memaksanya. Mekanisme pencatatannya sudah ada dari paket A
(`recordCapitalMovement`, tab **Modal & Bank**); paket ini hanya membuat urutannya tidak perlu
diingat sendiri.

## Yang sengaja tidak dikerjakan

- **Jangan menolak** `recordOpeningCash` bila modal belum dicatat. Outlet yang melanjutkan pembukuan
  lama, atau yang modalnya masuk lewat rekening bank, punya alasan sah untuk tidak punya
  `CAPITAL_INJECTION` kas. Peringatan, bukan penolakan.
- Jangan membangun wizard multi-langkah baru. Halaman yang ada sudah cukup bila urutannya benar.

---

# Paket D — Opname menyeluruh: pecahan dan brankas

**Temuan BI 6** — *"stock opname harus mencakup seluruh persediaan termasuk brankas dan Rupiah."*
Tenggat 28 Agustus 2026, **sudah lewat**.

## Keadaan sekarang

Sudah benar:
- Opname per mata uang, dan IDR adalah baris `currencies` biasa
  (`server/operations.ts:1384` `ensureCurrency({ code: "IDR" })`), jadi opname Rupiah **sudah bisa
  dibuka** — bagian ini tidak perlu diperbaiki.

Belum benar, dua celah nyata:
1. **Hitungan fisiknya satu angka total.** `submitStockOpname` (`server/operations.ts:2856`)
   menerima `physicalBalance` tunggal. `cash_denomination_balances` hanya stok berjalan yang
   dihitung sistem, tidak pernah dijadikan lawan hitung fisik. Jadi opname tidak pernah memverifikasi
   pecahan — padahal `CLAUDE.md` menyatakan stok pecahan berjalan adalah sumber kebenaran
   operasional.
2. **Brankas tidak pernah dihitung fisik.** Pembandingnya `cash_balances.availableAmount`, yang
   menurut keputusan rancangan yang tercatat (`server/ledgerOperations.ts:737-741`) **hanya berisi
   laci**. Isi brankas hanya diturunkan dari mutasi `SAFE_DEPOSIT`/`SAFE_WITHDRAWAL`
   (`reconcileCash`, `shared/ledger.ts:203-207`) — sebuah angka yang tidak pernah diuji terhadap
   uang sungguhan.

## Sketsa ruang lingkup

- Migrasi aditif: tabel rincian pecahan hasil hitung opname, dan tempat menyimpan hitungan brankas
  terpisah dari hitungan laci.
- `submitStockOpname` menerima rincian pecahan; `physicalBalance` **dihitung dari pecahan**, bukan
  diketik — sama seperti setiap jalur kas fisik lain sejak paket A.
- Varians dilaporkan per pecahan, bukan hanya total: selisih total nol dengan komposisi pecahan yang
  salah tetap masalah operasional.
- UI tab Stock Opname mengikuti pola form pecahan yang sudah ada di tab Kas Awal dan Modal & Bank.

## Pertanyaan yang harus dijawab spec-nya

- Apakah brankas menjadi baris opname tersendiri, atau kolom tambahan pada baris yang sama? Ini
  menentukan apakah `stock_opnames_date_currency_uq` perlu berubah.
- Apakah selisih pecahan yang totalnya nol menghasilkan status `VARIANCE`? (Menurut saya ya, tetapi
  itu keputusan operasional, bukan teknis.)
- Bagaimana opname historis (`isHistorical`) yang tidak punya rincian pecahan diperlakukan.

## Yang sengaja tidak dikerjakan

Jangan menambahkan akun "Kas di Brankas" ke bagan akun — B0002 hanya menyediakan satu baris kas.

---

# Paket C — Penilaian kas UKA dan penutupan periode

**Temuan BI 7.1.** Ini yang membuat neraca berhenti berselisih.

## Keadaan sekarang

- Akun 1-1210 Kas UKA dan 5-1300 Persediaan Akhir UKA & TC ada di bagan akun, **isinya nol**.
- `shared/chartOfAccounts.ts:111` sudah menamai `FX_REVALUATION_ACCOUNT_CODE = "7-1500"` dengan
  komentar merujuk SAK EP Bab 30, *"agar jurnal revaluasi tidak menebak kodenya sendiri"* — dan
  **tidak ada satu pun pemanggil**.
- `shared/financialStatements.ts:237` sudah menyalakan *"Persediaan UKA belum dinilai. Catat
  persediaan akhir dari hasil stock opname agar harga pokok tidak berlebih."*
- `closeAccountingPeriod` (`server/ledgerOperations.ts:188`) **hanya mengunci** periode setelah
  `verifyLedgerIntegrity`. Tidak menulis satu pun jurnal penutup, revaluasi, maupun pemindahan laba
  ke laba ditahan.
- `journalSourceTypes` (`drizzle/schema.ts:1120`) **sudah memuat** `REVALUASI_KURS` dan
  `TUTUP_PERIODE` yang belum dipakai siapa pun. Paket ini mendarat di tempat yang sudah disediakan.
- Sumber kurs penutup sudah ada: `rate_reference_snapshots` menyimpan kurs BI per mata uang per
  `referenceDate`, lengkap dengan `quoteUnit` (BI mengutip JPY per 100 unit — **hormati kolom ini**,
  mengabaikannya membuat nilai JPY meleset seratus kali).

## Sketsa ruang lingkup

- Fungsi murni memilih kurs penutup per mata uang per tanggal dari `rate_reference_snapshots`.
  **Bila snapshot untuk tanggal itu tidak ada, berhenti dan katakan** — jangan memundurkan tanggal
  diam-diam, dan jangan memakai kurs outlet sebagai pengganti.
- Fungsi murni menghitung nilai Rupiah persediaan akhir UKA dari hasil opname paket D.
- Migrasi: tempat menyimpan kurs dan nilai yang **benar-benar dipakai** setiap penutupan, supaya
  angkanya dapat ditelusuri kembali dan penjurnalannya idempoten.
- Pemetaan jurnal murni di `shared/journalMapping.ts`, mengikuti pola paket A.
- `postPeriodClosing` di `server/ledgerPosting.ts`, idempoten lewat `(sourceType, sourceReference)`.
- `closeAccountingPeriod` menolak menutup periode yang penilaiannya belum dijalankan.
- Panel penutupan periode pada halaman Buku Besar.

## Pertanyaan yang harus dijawab spec-nya — **sudah dijawab**

Ketiganya ditanyakan dan dijawab pengguna pada sesi rancangan 4 September 2026, ditambah dua
pertanyaan yang muncul saat penelusuran kode (kurs mana yang dipakai, dan apa yang benar bila akhir
periode jatuh pada hari libur). **Jawabannya ada di
`specs/2026-09-04-penilaian-kas-uka-tutup-periode-design.md` bagian "Yang sudah diputuskan
pengguna" — baca di sana, bukan di sini.** Ringkasnya: satu jurnal (7-1500 tetap tanpa pemanggil),
persediaan awal ditulis sebagai bagian penutupan dalam jurnal yang sama, dan penutup laba ke 3-2100
hanya pada akhir tahun buku.

Pertanyaan aslinya disimpan di bawah karena alasannya masih menjelaskan mengapa keputusannya begitu:

- Di bawah persediaan **periodik**, apakah revaluasi kurs (7-1500) dan penilaian persediaan akhir
  (5-1300) adalah dua jurnal terpisah atau satu? Menilai stok fisik pada kurs penutup sudah
  memasukkan selisih kursnya ke dalam harga pokok; memisahkannya menuntut harga perolehan per lot
  yang **sistem ini memang tidak melacak**.
- Persediaan **awal** (5-1100) periode berikutnya: dibalik dari 1-1210 pada awal periode, atau
  ditulis sebagai bagian penutupan?
- Jurnal penutup laba rugi ke Laba Ditahan (3-2100) — akhir tahun buku saja, atau tiap periode?
  Kode yang ada sekarang sengaja memakai laba **sejak awal pembukuan** pada neraca justru karena
  jurnal penutup belum ada (`server/financialStatements.ts:88-92`); mengubah ini mengubah dua
  laporan sekaligus.

## Risiko residual

Bagan akun masih perlu ditinjau seorang akuntan satu kali. Paket ini bersandar penuh padanya.

---

# Paket E — Aset tetap dan penyusutan

## Keadaan sekarang

Akun 1-1510 Harga Perolehan, 1-1520 Akumulasi Penyusutan, dan 6-1700 Beban Penyusutan ada;
**isinya nol**. Tidak ada tabel, halaman, maupun perhitungan. `journalSourceTypes` sudah memuat
`PENYUSUTAN` yang belum dipakai. Baris Penyusutan pada B0003 karena itu tidak punya asal.

## Fakta yang sudah diverifikasi — jangan diturunkan ulang

Dari memori sesi `financial-reporting-sak-ep` (diverifikasi 3 September 2026 dari naskah SAK EP
pengguna dan pajak.go.id):

- Kelompok DJP: Kelompok 1/2/3/4 = 4/8/16/20 tahun; bangunan permanen 20 tahun, non-permanen 10.
  Jenis aset terdaftar di PMK 72/2023. Penyusutan **mulai bulan pengeluaran**.
- Itu aturan **pajak**. SAK EP Bab 17 menuntut umur manfaat **sebenarnya**, ditinjau tahunan.
- Karena itu: tawarkan kelompok pajak sebagai **default berlabel yang dapat ditimpa**, jangan
  memasangnya diam-diam sebagai kebijakan akuntansi.

## Sketsa ruang lingkup

Register aset (perolehan, tanggal, kelompok, umur manfaat, nilai residu), jadwal penyusutan garis
lurus, `postDepreciation` bersumber `PENYUSUTAN` dan idempoten per aset per bulan, halaman register.

---

# Paket F1 — Kas valuta asing dan revaluasi kurs

**Rencana rinci sudah ada:** `specs/2026-09-05-kas-valas-revaluasi-kurs-design.md` dan
`plans/2026-09-05-kas-valas-revaluasi-kurs.md`.

Dipisahkan dari Paket F pada sesi rancangan 5 September 2026, dengan preseden Paket K1: kekurangan
yang ditemukan saat merancang paket lain, dikeluarkan menjadi paket kecil tersendiri yang dikerjakan
lebih dulu.

Outlet dapat membuka rekening USD hari ini, tetapi `mapBankMovement` menolak menjurnalnya —
*"rekening valuta asing belum dinilai"*. Uang yang benar-benar ada karena itu tidak muncul pada
laporan mana pun. Paket ini menjurnal mutasinya ke 1-1220 pada kurs tanggal mutasi, lalu
meretranslasi saldonya pada kurs penutup tiap akhir periode dengan selisih ke 7-1500 — yang SAK EP
Bab 30 wajibkan dan tidak akan pernah dikerjakan orang yang mengisi formulir Excel.

Menghidupkan tiga hal yang sudah disediakan tetapi menganggur: nilai `REVALUASI_KURS`, akun 7-1500,
dan akun 1-1220.

---

# Paket F2 — Arus Kas dan CALK

## Keadaan sekarang

`server/financialStatements.ts` menghasilkan **tiga** laporan — Posisi Keuangan, Laba Rugi,
Perubahan Ekuitas — sudah lengkap dengan kolom pembanding periode sebelumnya
(`priorRange`, baris 27-30), yang menurut SAK EP Bab 3 memang wajib.

SAK EP menuntut **lima**. Arus Kas dan CALK belum ada sama sekali.

## Yang sudah diputuskan pada sesi rancangan 5 September 2026

- **Kas dan setara kas** = `1-1110` + `1-1120` + `1-1220`. Kas UKA fisik (`1-1210`) **bukan** kas —
  ia persediaan, dinilai lewat jalur Paket C.
- **Arus Kas mengikuti rentang tanggal bebas** yang sama dengan ketiga laporan lain, beserta kolom
  pembandingnya dari `priorRange`. Bukan tahunan, bukan per periode bulanan.
- **CALK hibrida:** catatan yang angkanya diketahui buku besar (rincian aset tetap, kas, ekuitas,
  beban) dibangkitkan dan tidak pernah diketik; catatan yang memang pertimbangan (kebijakan
  akuntansi, dasar penyusunan, peristiwa setelah periode, pihak berelasi) berupa teks tersimpan.
  Angka tidak pernah diketik ulang, sehingga tidak dapat berselisih dengan laporannya.
- **Bagian investasi dibaca dari `sourceType`,** bukan dari selisih saldo: `PEROLEHAN_ASET` dan
  `PELEPASAN_ASET` disajikan bruto, sesuai SAK EP, dan tiap barisnya menunjuk nomor jurnalnya.
- **Ada keranjang "Belum terklasifikasi" yang terlihat,** beserta nomor jurnalnya, dan penanda
  `reconciled` yang membandingkan perubahan kas hasil hitungan dengan pergerakan nyata
  `1-1110`+`1-1120`+`1-1220`. Selisih muncul sebagai peringatan, tidak pernah sebagai pos penyeimbang.

## Yang diputuskan pada sesi rancangan 7 September 2026

**Rencana rinci sudah ada:** `specs/2026-09-07-arus-kas-dan-calk-design.md` dan
`plans/2026-09-07-arus-kas-dan-calk.md`. Ringkasnya:

- **Metode langsung**, diklasifikasi per jurnal yang benar-benar menyentuh ketiga akun kas.
- **Delapan catatan CALK bangkitan dan tujuh naratif**; teks naratif pada tabel
  `financial_statement_notes` berkunci `(noteKey, periodKey)`, `periodKey` kosong berarti berlaku
  terus. Tidak ada teks contoh yang diisikan otomatis.
- **Halaman baru `/operasional/laporan-keuangan`** menampung kelima laporan; Buku Besar tetap
  memuat pekerjaan pembukuannya.

## Yang ditemukan penelusuran kode dan mengubah bentuk paketnya

**Tidak ada satu pun jurnal yang membayar beban atau aset dengan kas.** `mapExpense` dan
`mapFixedAssetAcquisition` sama-sama mengkredit 2-1900, `mapFixedAssetDisposal` mendebit 1-1320,
dan pelunasan yang dijanjikan komentar `shared/journalMapping.ts:104` tidak pernah ditulis. Buku
besar lokal memperlihatkannya: 2-1900 bersaldo Rp 24.000.000 sejak paket E, sementara 1-1110 dan
1-1120 belum pernah bergerak.

Karena itu bagian operasi tidak akan pernah memuat pembayaran beban dan bagian investasi kosong
selamanya. Menurut aturan `CLAUDE.md` "Fitur Harus Punya Sumber Data", penulis pelunasan masuk ke
dalam paket ini sebagai empat tugas pertamanya — bukan dikeluarkan menjadi paket tersendiri.

Keputusan 4 karena itu dipertajam, bukan diubah: bagian investasi tetap bruto, tetap dari kejadian
dan bukan selisih saldo, tetap menunjuk nomor jurnalnya — tetapi kejadian yang dibaca adalah
**pelunasan yang menunjuk aset tetapnya**, saat uangnya benar-benar bergerak. Perolehan yang belum
dibayar disajikan sebagai catatan CALK "transaksi nonkas", bukan sebagai arus kas yang tidak
terjadi. Alasan lengkapnya pada spec bagian "Penajaman keputusan 4".

---

# Paket G — Ekspor B0002/B0003/B0004 dari buku besar

## Keadaan sekarang

Hanya **impor** yang ada. `server/financialImport.ts` mem-parsing workbook B0002/B0003/B0004 yang
disusun **di luar** aplikasi, dan `server/financialTemplate.ts` mengunduhkan template **kosong**.

Akibatnya buku besar sudah menghitung seluruh angkanya, tetapi untuk melapor angka itu masih harus
diketik ulang ke Excel. Itu justru mengembalikan risiko yang dituju temuan 7.1.

## Yang diputuskan pada sesi rancangan 7 September 2026

**Rencana rinci sudah ada:** `specs/2026-09-07-ekspor-laporan-b-form-design.md` dan
`plans/2026-09-07-ekspor-laporan-b-form.md`. Ringkasnya:

- **Ekspor meniru tata letak form resmi** sebagai `.xlsx` tanpa makro — tombol *Simpan* pada form BI
  adalah makro milik berkas mereka dan tidak dapat dibuat ulang.
- **Importir diajari membaca format resmi** lewat label pos, bukan Record No, sehingga berkas yang
  sama dapat diekspor lalu diimpor kembali.
- **Isi: tiga form B ditambah lembar penelusuran** pos → akun → saldo.
- **Ekspor juga menulis snapshot** bersumber buku besar, menutup lingkaran impor→snapshot→paket.
- **Hanya tahun buku penuh** yang dapat diekspor (*Jenis Periode: A* pada formnya).

## Yang ditemukan sesi rancangan dan mengubah bentuk paketnya

Pengguna menunjukkan ketiga form BI yang sebenarnya, dan **tata letaknya berbeda dari template
internal yang selama ini dipakai**: tidak ada kolom *Record No* yang justru menjadi kunci pemetaan
`parseFinancialWorkbook`. Form resminya berkolom dua pada B0002, memisahkan `Laba` dari `Rugi (-)`
pada pos bersih, dan menyatakan *Jumlah Record* 19/25/7 pada headernya.

Jumlah record itu **cocok persis** dengan bagan akun: 19 = 11 aset + 5 kewajiban + 3 ekuitas,
25 = seluruh baris laba rugi, 7 = baris perubahan ekuitas. Komentar bagan akun yang berbunyi
"dipetakan langsung ke satu baris pada form" karena itu terbukti, dan paket ini menuliskan pemetaan
itu sebagai data.

## Batas

Tetap **tidak ada pengiriman otomatis** ke BI. Ekspor menghasilkan berkas; manusia yang mengirim.
Nominal dari berkas asli perusahaan tidak boleh masuk kode, uji, fixture, maupun dokumentasi —
hanya strukturnya yang diambil.

---

# Paket H — Profil transaksi dan pemantauan berkala

**Temuan BI 10**, dan sisa **temuan 9** ("pengkinian profil nasabah dan profil transaksi").

## Keadaan sekarang

`customers` (`drizzle/schema.ts:117-133`) punya `occupation`, `sourceOfFunds`,
`transactionPurpose`, `riskLevel`, `riskNotes` — **tidak ada perkiraan volume, frekuensi, atau
nilai transaksi yang dideklarasikan nasabah**.

`assessReviewRequirement` (`server/operations.ts:219`) memeriksa ambang setara USD per transaksi dan
akumulasi bulanan, ambang EDD kas harian, dan ambang LTKT Rp 500 juta. Bendera `profileMismatch`
(baris 260) hanya `profileStatus === "RESTRICTED" || riskLevel === "HIGH"` — **pengecekan kategori
statis, bukan perbandingan aktivitas nyata terhadap profil yang dideklarasikan.**

`client/src/pages/Monitoring.tsx` adalah dasbor atas bendera yang sama, bukan pekerjaan berkala.

## Sketsa ruang lingkup

Kolom profil transaksi yang dideklarasikan pada `customers`, plus perbandingan berkala antara
aktivitas nyata dan profil itu, plus worklist tindak lanjutnya. Hasilnya **alat bantu penyaringan** —
tidak pernah mengubah data nasabah atau memicu tindakan otomatis, sama seperti pencocokan watchlist.

---

# Paket I — Arsip dokumen perusahaan

**Temuan BI 3.**

## Keadaan sekarang

`operational_documents` (`drizzle/schema.ts:296`) hanya melayani
`ownerType ∈ {CUSTOMER, TRANSACTION, COMPANY, EXPENSE}` dengan `documentType` terbatas pada KTP,
underlying, logo, sertifikat/lampiran izin, dan struk pengeluaran.

Tidak ada tempat untuk SOP, kebijakan internal, surat-menyurat BI, notulen rapat, atau berkas
korespondensi regulator. Tidak ada halaman arsip.

## Sketsa ruang lingkup

Nilai `documentType` baru (dan mungkin `ownerType`) plus halaman Arsip Dokumen dengan versi,
tanggal berlaku, dan penanggung jawab. Batas keamanan impor yang sudah ada — ukuran, MIME, signature
— tetap berlaku apa adanya.

---

# Paket J — Individual Risk Assessment

**Temuan BI 11.** Paket terbesar, dan menurut catatan sesi **pemeriksa berjalan menyusuri IRA** —
temuan 8, 9, 10, 11, dan 12 semuanya adalah pertanyaan di dalamnya.

## Fakta yang sudah diverifikasi — jangan diturunkan ulang

Dari memori sesi `ira-and-sdm-reporting`, dibaca 3 September 2026 dari template BI milik pengguna:

- **Istilah:** yang dibangun adalah **IRA** — penilaian oleh lembaganya sendiri. **SRA** adalah
  sumber peringkat risiko **eksternal** (Sectoral Risk Assessment nasional) yang menjadi masukannya.
- **Bobot risiko inheren dan struktural:** TPPU 40%, TPPT 30%, PPSPM 5%, Risiko Struktural 25%.
- **Pilar KPMR:** Direksi/Komisaris 30%, Kebijakan & Prosedur Tertulis 25%, Proses Manajemen Risiko
  25%, Manajemen SDM 10%, Sistem Pengendalian Internal 10%.
- Penilaian KPMR berskala 1–5 (1 *unsatisfactory* … 5 *strong*); rata-rata per pilar
  **mengecualikan N/A**; KPMR = rata-rata pilar. Nilai akhir menggabungkan sisi inheren dan
  struktural dengan KPMR lewat matriks. Predikat berjalan Rendah → Tinggi.
- **Sebagian besar masukan risiko inheren dapat dihitung dari data yang sudah dimiliki aplikasi** —
  persentase transaksi pada mata uang berisiko tinggi, pekerjaan nasabah berisiko tinggi,
  kewarganegaraan pada daftar hitam/abu-abu FATF, nasabah PT non-UMKM, risiko lokasi cabang. Hanya
  kuesioner KPMR yang menuntut jawaban manusia. **Menghitung sisi inheren secara otomatis adalah
  pembeda yang kuat.**

## Sketsa ruang lingkup

Tabel penilaian beserta faktor, skor, dan siklusnya; perhitungan sisi inheren dari data; kuesioner
KPMR; matriks nilai akhir; halaman dan alur persetujuannya.

---

# Paket K2 — Ganti nama PPPSM menjadi PPPSPM

## Masalah

Penamaannya salah **dan tidak konsisten dengan dirinya sendiri**: skema menulis `PPPSM`, sebagian
teks UI dan pesan validasi menulis `PPSPM`. Yang benar merujuk Pendanaan Proliferasi Senjata
Pemusnah Massal.

## Ukurannya

Bukan sekadar ganti nama pengenal:
- `customers.dttotPpsdmMatch` dan `customers.dttotPpsdmNotes` (`drizzle/schema.ts:128-129`) adalah
  **kolom MySQL yang sudah termigrasi**.
- `listType` pada tabel watchlist menyimpan **nilai enum** `"PPPSM"` — data yang sudah tersimpan,
  jadi perlu redefinisi enum **dan** migrasi data.
- ~10 berkas, ~50 titik panggil: `server/operations.ts`, `server/routers.ts`,
  `server/sanctionsWatchlistImport.ts`, `shared/sanctionsNameMatch.ts`,
  `client/src/pages/CustomerList.tsx`, `Customers.tsx`, `SanctionsWatchlist.tsx`, plus ujinya.

Karena menyentuh kolom dan nilai enum yang sudah ada isinya, ini **perubahan berisiko** yang perlu
rencana rollback tertulis meski hasil akhirnya hanya kosmetik.

---

# Paket K3 — Pembandingan nota terhadap SE BI 18/41/DKSP

**Menunggu pengguna.** Naskah SE BI 18/41/DKSP tidak ada di proyek.

## Keadaan sekarang

`printBon()` (`client/src/pages/Transactions.tsx:41`) sudah diperbaiki sekali untuk temuan 4 —
komentarnya menyebut *"the nota did not show the identity of the penyelenggara KUPVA BB"* — dan
sekarang mencetak nama badan hukum, nama dagang, Kode KUPVA, nomor izin, alamat, telepon, logo,
identitas nasabah, sumber dana, tujuan transaksi, tabel per pecahan berikut kursnya, dan tanda
tangan kedua pihak.

Tetapi rujukan regulasi satu-satunya di kwitansi adalah **PBI No. 18/20/PBI/2016**. Pencarian
`"18/41"`, `"SE BI"`, `"DKSP"` di seluruh repo menghasilkan **nol**. Jadi tidak ada bukti nota
pernah dibandingkan terhadap daftar field SE BI 18/41/DKSP secara sistematis.

## Yang dibutuhkan dari pengguna

Naskah SE BI 18/41/DKSP, atau setidaknya daftar field wajibnya. Sesuai aturan proyek: **jangan
menebak skema; minta contoh berkas nyata.** Setelah naskahnya ada, kerjanya adalah pembandingan
berdampingan satu kali, lalu menambahkan field yang kurang berikut ujinya.

---

## Catatan bagi pelaksana

- Rujukan `berkas:baris` di dokumen ini benar pada 4 September 2026 (`3d8b217`). Bila kodenya sudah
  bergeser, **percayai kodenya, bukan dokumen ini** — dan perbarui barisnya sambil lewat.
- Alasan setiap keputusan sengaja ikut ditulis, bukan hanya langkahnya, supaya sesi yang menemukan
  keadaan berbeda tahu apa yang sedang dilindungi dan boleh menyesuaikan caranya.
- Nominal uang tidak pernah dibulatkan diam-diam. Bila presisinya tidak muat, lewati dan katakan
  mengapa.
- Buku besar yang salah dengan percaya diri lebih buruk daripada tidak ada buku besar.
