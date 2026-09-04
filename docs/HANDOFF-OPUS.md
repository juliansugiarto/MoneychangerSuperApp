# Handoff — baca ini dulu

Diperbarui 4 September 2026. Menggantikan isi sebelumnya.

## Baca dulu, jangan diturunkan ulang dari kode

1. **`CLAUDE.md`** — aturan keras operasional dan gerbang mutu.
   `pnpm` tidak ada di PATH; pakai `./node_modules/.bin/*`. MySQL client di `/opt/homebrew/opt/mysql/bin`.
2. **Rencana produk** — https://claude.ai/code/artifact/b7f62d68-3a12-419e-b507-2e1345260a6b
   Dua belas temuan pemeriksaan BI yang dipetakan ke kode, peta 35 tabel ke lapisan tenant/cabang,
   bagan akun, sembilan fase, dan pemeriksaan silang. **Dokumen pengarah utama.**
3. Memori sesi (`~/.claude/projects/.../memory/`) — SAK EP, aturan penyusutan, struktur IRA,
   struktur RAP01/RAS01, temuan SINTA, jebakan kolom `date` MySQL. Semuanya sudah diverifikasi.

## Cara menjalankan

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run          # 478 lulus, 2 dilewati
./node_modules/.bin/vite build
```

Server pengembangan **sudah berjalan di http://localhost:3003** dan sesi peramban sudah login
sebagai Development Shareholder — pakai itu untuk verifikasi visual, jangan menyalakan yang baru.
Sandi tidak pernah diketik oleh asisten; bila sesi habis, minta pengguna yang login.

Migrasi ke seluruh tenant lokal (terakhir: `0043`):

```bash
export TENANT_REGISTRY="ibukota=mysql://root@127.0.0.1:3306/moneychanger;abcvalas=mysql://root@127.0.0.1:3306/mc_t_abcvalas"
node scripts/tenant.mjs migrate-all
```

Jangan menerapkan berkas `.sql` langsung lewat klien mysql: penanda `--> statement-breakpoint`
membuat pernyataan kedua gagal dan jurnal `__drizzle_migrations` menjadi tidak konsisten.

**Verifikasi cetakan tanpa membekukan alat uji:** render HTML-nya lewat skrip Node yang menyulih
`window.open`, buang skrip cetaknya, sajikan lewat `python3 -m http.server` (peramban menolak
`file://`), lalu ambil tangkapan layar. Memanggil `window.print()` membuka dialog bawaan yang
memblokir ekstensi peramban sampai pengguna menutupnya.

## Keadaan sekarang

**33 commit belum di-push. Produksi tidak pernah disentuh** — seluruh migrasi hanya diterapkan ke
dua basis data lokal, dan seluruh data uji sudah dihapus kembali.

Tenant lokal `moneychanger` **bersih**: tidak ada nasabah, bon, kas, kurs, pegawai, calon, maupun
jurnal. Yang tersisa hanya 42 baris `chart_of_accounts` (data acuan) dan tiga baris `audit_logs`
dari sesi 3 September.

### Selesai pada dua sesi terakhir

- **Penyaringan calon pegawai** (`dc5529e`, `372f6cf`) — tabel `employee_candidates` (migrasi
  `0042`), tab "Calon Pegawai" pada Kepegawaian. Tiga aturan yang menjaga inti temuannya: calon
  tidak dapat diterima selama penyaringannya belum LULUS, hasil akhir tanpa keterangan ditolak, dan
  calon yang tidak diterima tetap tersimpan beserta alasannya.
- **Buku besar** — fondasi (`80939f3`), antarmuka (`313632a`), penjurnalan otomatis (`d9f4789`),
  laporan keuangan (`f1a749f`). Migrasi `0043`. Halaman **Laporan → Buku Besar**
  (`/operasional/buku-besar`) dengan lima tab: Jurnal, Neraca Saldo, Buku Besar Akun,
  Laporan Keuangan, Periode.
- **Peninjauan kode** (`385e5e0`, `83682db`, `93c73d1`) — delapan temuan diperbaiki, satu ditolak
  setelah diperiksa langsung.
- **Perbaikan batas tanggal pada daftar pengeluaran** (`934419d`).

## Empat hal yang tidak boleh diturunkan ulang dari kode

1. **Uang pada buku besar adalah `bigint` sen, bukan `number`.** Karena itu `tsconfig.json` memakai
   `"target": "ES2022"`. tsc di repo ini hanya memeriksa tipe (`noEmit`), jadi keluaran build tidak
   berubah sama sekali.

2. **Tanggal dikirim ke MySQL sebagai tengah malam waktu lokal hari yang dimaksud** (`dbDate` di
   `server/ledgerOperations.ts`, `dateColumnBound` di `server/operations.ts`). Mengirim `Date`
   tengah malam UTC membuat pembandingnya menjadi `entryDate >= '2026-09-01 07:00:00'` di GMT+7,
   dan jurnal tanggal 1 hilang dari laporan bulannya sendiri. Aritmetika bulan selalu atas teks
   `YYYY-MM-DD` (`isoDay`/`monthStartIso`/`monthEndIso` di `shared/ledger.ts`), tidak pernah atas
   getter UTC sebuah tanggal tengah malam lokal. Normalisasi dilakukan **sekali**, di `loadLines` —
   menormalkannya dua kali memundurkan batasnya satu hari.

   **Yang ditolak, jangan "diperbaiki" lagi:** peninjauan kode sempat menyimpulkan kolom `date`
   kembali sebagai `Date` tengah malam **lokal**. Diperiksa langsung terhadap basis data: nilainya
   kembali sebagai tengah malam **UTC** (`2026-09-01T00:00:00.000Z` pada mesin GMT+7), jadi
   `toISOString()` saat membaca sudah benar. Yang perlu dinormalkan hanya arah kirim.

   **Yang belum diperbaiki:** perbandingan `eq()` atas kolom `date` yang memakai
   `jakartaBusinessDate` — `dailyOperationalChecklists.businessDate` dan `stockOpnames.opnameDate`
   (`server/operations.ts` baris ~1733, ~1817, ~2716). `jakartaBusinessDate` mengembalikan tengah
   malam UTC: benar di produksi yang berjalan pada UTC, meleset tujuh jam di mesin pengembangan
   WIB, sehingga pencarian checklist/opname hari berjalan tidak menemukan baris yang sudah ada dan
   berisiko menyisipkan duplikat. Sengaja tidak disentuh: mengubah `jakartaBusinessDate` mengubah
   perilaku tutup buku, opname, dan checklist sekaligus, jadi perlu rencana tersendiri.

3. **Penjurnalan otomatis dijalankan terpisah, bukan di dalam `completeTransaction`.** Penyelesaian
   bon memindahkan dua sisi kas, stok pecahan, dan saldo bank dalam satu transaksi basis data;
   menambahkan penulisan buku besar di sana berarti kegagalan pembukuan dapat menggagalkan
   penyelesaian bon yang uangnya sudah berpindah tangan di meja kasir. Ada uji yang menjaganya
   (`server/journalMapping.test.ts`, "tidak disisipkan ke dalam penyelesaian bon").

4. **Pemetaan akuntansinya sudah diputuskan, jangan ditebak ulang:**
   - Persediaan **periodik** sesuai struktur B0003. BELI menjadi Dr 5-1200 Pembelian UKA;
     JUAL menjadi Cr 4-1100 Penjualan UKA; sisi Rupiahnya ke 1-1110 (CASH) atau 1-1120
     (BANK_TRANSFER). `paymentMethod = OTHER` dilewati beserta alasannya. Akun 1-1210 Kas UKA baru
     bergerak di akhir periode lewat persediaan akhir hasil opname, karena harga pokok per lot
     memang tidak dilacak sistem ini.
   - Pengeluaran dikredit ke **2-1900 Kewajiban Lain-Lain**, bukan ke kas — keputusan pengguna
     3 September. Modul pengeluaran sengaja tidak menyentuh `cash_balances`, jadi mengkredit kas
     akan membuat buku besar berbeda dari stok kas, persis temuan 7.2/7.3.
   - Neraca memakai laba **sejak awal pembukuan**; laporan laba rugi memakai **mutasi periode**.
     Keduanya benar pada tempatnya; menyamakannya membuat neraca berselisih sebesar laba lampau.

## Yang harus dikerjakan berikutnya

1. **Penjurnalan kas awal dan mutasi kas.** Penghalang terbesar sebelum laporan keuangan layak
   dipakai. Sekarang akun Kas Rupiah hanya memuat pergerakan dari bon, sehingga tampil negatif pada
   outlet yang lebih banyak membeli daripada menjual; sudah dijelaskan di layar dan dijaga
   peringatan, tetapi tetap harus diselesaikan. Perlu keputusan kebijakan **per kategori**, dan
   masing-masing berbeda:
   - `OPENING` — `cash_balance_movements` mencatat **selisih**, bukan seluruh saldo; kemungkinan
     besar ini selisih kas lebih/kurang ke 7-1900.
   - `SAFE_DEPOSIT` / `SAFE_WITHDRAWAL` — perpindahan brankas dan laci; keduanya kas milik sendiri,
     jadi seharusnya **tidak** mengubah total kas sama sekali.
   - `OFF_HOURS_SALE` — sebenarnya penjualan, seharusnya dicatat sebagai bon.
   - `DENOMINATION_EXCHANGE` — netnya nol, lewati.
   - Kategori `TRANSACTION` **jangan** dijurnal: sisi kas bon sudah terjurnal lewat bonnya sendiri,
     dan menjurnalnya lagi menghitung uang yang sama dua kali.
   - Mutasi kas valuta asing tidak punya nilai Rupiah pada tabelnya; di bawah model periodik memang
     tidak perlu dijurnal per mutasi.
2. **Fase 01 dimensi cabang**, lalu melengkapi fase 04 dengan `branchId`. Kolomnya sudah disediakan
   nullable pada `journal_entries` dan `journal_entry_lines` supaya jurnal tidak ditulis ulang;
   yang tersisa hanya meneruskannya dari tabel sumber.
3. **Fase 05** — register aset tetap dan penyusutan (memasok baris Penyusutan B0003 yang selama ini
   tidak punya asal), amortisasi biaya dibayar dimuka, dan **revaluasi kas UKA memakai kurs
   penutup** yang dituntut SAK EP Bab 30.
4. **Fase 07 dan 08** — Arus Kas, CALK, paket audit, lalu ekspor ke tata letak B0002/B0003/B0004
   memakai pola validasi `server/financialImport.ts`. Tidak ada pengiriman otomatis ke regulator.
5. Temuan 3 (arsip dokumen), 6 (stock opname termasuk Rupiah), 10 (pemantauan berbasis profil).
6. IRA — perlu tabel penilaian SRA.
7. Perbaiki penamaan `dttotPpsdmMatch` / "PPPSM" menjadi **DPPSPM/PPPSPM**.

## Aturan kerja

- Verifikasi klaim regulasi ke naskah aslinya. Hampir setiap dokumen yang diberikan pengguna
  mengoreksi sebuah asumsi — urutan sandi, jenjang KKNI, kolom Direksi, ambang bulanan.
- Jangan menebak skema; minta contoh berkas nyata.
- **Jangan push atau deploy tanpa persetujuan pada giliran itu juga.** Jangan menerapkan migrasi ke
  produksi tanpa permintaan eksplisit pada giliran itu juga.
- Jangan menaruh nama pegawai, NIK, atau data nasabah pada commit, dokumen, log, maupun tangkapan layar.
- Perubahan belum selesai tanpa `vitest`, `tsc --noEmit`, `vite build`, dan verifikasi visual untuk
  rute yang berubah.
- **Membuat data uji transaksi atau kas di basis data lokal perlu izin pengguna pada giliran itu.**
  Izin pernah diberikan 3 September untuk menguji penjurnalan bon; izin itu tidak berlaku lagi.
- **Skrip pembersih uji jangan menghapus `audit_logs`.** Sebuah skrip pernah menghapus 36 baris
  audit milik probe-probe lain di sesi yang sama. Hapus baris datanya saja; jejak auditnya biarkan.

## Yang masih menggantung

- **Kas awal dan mutasi kas belum dijurnal** — lihat butir 1 di atas. Akibatnya Kas Rupiah pada
  buku besar tampil negatif bila saldo awal belum dicatat sebagai jurnal manual.
- **Ambang underlying bulanan** (commit `3fb0e98`) mengubah perilaku harian: kasir diminta dokumen
  pendukung bagi nasabah yang akumulasi sebulannya melewati USD 10.000. Logikanya diuji, kuerinya
  belum pernah diuji terhadap transaksi nyata.
- **Bagan akun perlu ditinjau seorang akuntan satu kali.** Kekeliruan di sana menurun ke setiap
  pelanggan sekaligus, dan menurut definisinya tidak ada pelanggan yang mampu menangkapnya.
- Data transaksi uji di produksi masih menunggu dihapus oleh pengguna.
