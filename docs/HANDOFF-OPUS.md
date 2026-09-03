# Handoff — baca ini dulu

Diperbarui 3 September 2026 (sesi kedua hari itu). Menggantikan isi sebelumnya.

## Baca dulu, jangan diturunkan ulang dari kode

1. **`CLAUDE.md`** — aturan keras operasional dan gerbang mutu.
   `pnpm` tidak ada di PATH; pakai `./node_modules/.bin/*`. MySQL client di `/opt/homebrew/opt/mysql/bin`.
2. **Rencana produk** — https://claude.ai/code/artifact/b7f62d68-3a12-419e-b507-2e1345260a6b
   Dua belas temuan pemeriksaan BI yang dipetakan ke kode, peta 35 tabel ke lapisan tenant/cabang,
   bagan akun, fase, dan pemeriksaan silang. **Dokumen pengarah utama.**
3. Memori sesi (`~/.claude/projects/.../memory/`) — SAK EP, aturan penyusutan, struktur IRA,
   struktur RAP01/RAS01, temuan SINTA. Semuanya sudah diverifikasi dari dokumen asli.

## Cara menjalankan

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run          # 445 lulus, 2 dilewati
./node_modules/.bin/vite build
```

Server pengembangan **sudah berjalan di http://localhost:3003** dan sesi peramban sudah login
sebagai Development Shareholder — pakai itu untuk verifikasi visual, jangan menyalakan yang baru.
Sandi tidak pernah diketik oleh asisten; bila sesi habis, minta pengguna yang login.

Migrasi ke seluruh tenant lokal:

```bash
export TENANT_REGISTRY="ibukota=mysql://root@127.0.0.1:3306/moneychanger;abcvalas=mysql://root@127.0.0.1:3306/mc_t_abcvalas"
node scripts/tenant.mjs migrate-all
```

Jangan menerapkan berkas `.sql` langsung lewat klien mysql: penanda
`--> statement-breakpoint` membuat pernyataan kedua gagal, dan jurnal `__drizzle_migrations`
menjadi tidak konsisten. Lewat `migrate-all` saja.

**Verifikasi cetakan tanpa membekukan alat uji:** render HTML-nya lewat skrip Node yang menyulih
`window.open`, buang skrip cetaknya (`html.replace(/<script>[\s\S]*?<\/script>/g, "")`), sajikan
lewat `python3 -m http.server` (peramban menolak `file://`), lalu ambil tangkapan layar. Memanggil
`window.print()` membuka dialog bawaan yang memblokir ekstensi peramban sampai pengguna menutupnya.

## Keadaan sekarang

**23 commit belum di-push. Produksi tidak pernah disentuh** — seluruh migrasi hanya diterapkan ke
dua basis data lokal.

Selesai sesi ini:

- **Penyaringan calon pegawai** (`dc5529e` skema, `372f6cf` sisanya) — `employee_candidates`
  (migrasi `0042`), `server/sdmOperations.ts`, rute `sdm.*`, tab "Calon Pegawai" pada Kepegawaian,
  `server/employeeCandidate.test.ts`. Tiga aturan yang menjaga inti temuannya, ketiganya dibuktikan
  di peramban: calon tidak dapat diterima selama penyaringannya belum LULUS, hasil akhir tanpa
  keterangan ditolak, dan calon yang tidak diterima tetap tampil beserta alasannya. Pencocokan
  DTTOT/DPPSPM berjalan otomatis dan diulang tiap penyaringan disimpan; tampilan membedakan "belum
  dicocokkan" dari "nihil".
- **Fondasi buku besar** (`80939f3`, temuan 7.1) — `chart_of_accounts`, `accounting_periods`,
  `journal_entries`, `journal_entry_lines` (migrasi `0043`, murni penambahan);
  `shared/chartOfAccounts.ts` (42 akun, tiap akun terpetakan ke baris B0002/B0003/B0004),
  `shared/ledger.ts` (aritmetika sen memakai `bigint`), `server/ledgerOperations.ts`, rute
  `ledger.*`, dan halaman **Buku Besar** (`/operasional/buku-besar`, Laporan → Buku Besar) dengan
  empat tab: Jurnal, Neraca Saldo, Buku Besar Akun, Periode. Diuji ujung ke ujung di peramban.
- **Peninjauan kode atas keduanya** (`385e5e0`) — delapan temuan diperbaiki, satu ditolak setelah
  diperiksa langsung. Yang paling berarti: neraca saldo kini kumulatif (memuat saldo awal, jadi
  layak menjadi isian B0002), penjaga tutup periode diganti `verifyLedgerIntegrity` yang benar-benar
  dapat gagal, dan penyaringan ulang tidak lagi menghapus bukti kecocokan daftar sanksi.

**Yang ditolak, jangan "diperbaiki" lagi:** kolom `date` kembali dari Drizzle sebagai `Date` tengah
malam **UTC** (diperiksa: `2026-09-01T00:00:00.000Z` pada mesin GMT+7), jadi `toISOString()` saat
membaca sudah benar. Yang perlu dinormalkan hanya arah kirim.

Data uji yang tertinggal di tenant lokal `moneychanger`: satu sesi pelatihan 15 Okt 2025, satu
peninjauan profil, dan satu calon "UJI CALON PELAMAR" beserta penyaringan dan keputusannya. Jurnal
uji sudah dihapus; 42 baris `chart_of_accounts` yang tersemai adalah data acuan, bukan data uji.

## Dua hal yang tidak boleh diturunkan ulang dari kode

1. **Uang pada buku besar adalah `bigint` sen, bukan `number`.** Karena itu `tsconfig.json` kini
   memakai `"target": "ES2022"`. tsc di repo ini hanya memeriksa tipe (`noEmit`), jadi keluaran
   build tidak berubah sama sekali.
2. **Tanggal dikirim ke MySQL sebagai tengah malam waktu lokal hari yang dimaksud** (`dbDate` di
   `server/ledgerOperations.ts`). Mengirim `Date` tengah malam UTC membuat pembandingnya menjadi
   `entryDate >= '2026-09-01 07:00:00'` di GMT+7, dan jurnal tanggal 1 hilang dari laporan bulannya
   sendiri. Aritmetika bulan selalu atas teks `YYYY-MM-DD` (`isoDay`/`monthStartIso`/`monthEndIso`
   di `shared/ledger.ts`), tidak pernah atas getter UTC sebuah tanggal tengah malam lokal.

   **Kesalahan ini bergantung zona waktu proses, dan itulah sebabnya tidak pernah tertangkap.**
   `jakartaBusinessDate` (`server/operations.ts`) mengembalikan tengah malam UTC: benar di produksi
   yang berjalan pada UTC, meleset tujuh jam di setiap mesin pengembangan WIB. `dbDate`/
   `dateColumnBound` benar pada keduanya.

   `listExpenses` memakai pola lama itu dan **sudah diperbaiki** (`dateColumnBound`), dibuktikan
   dengan probe: sebelumnya pengeluaran bertanggal 1 September hilang dari rentang 1–30 September,
   sesudahnya kedua batas ikut terbaca.

   **Yang belum diperbaiki:** perbandingan `eq()` atas kolom `date` yang memakai
   `jakartaBusinessDate` — `dailyOperationalChecklists.businessDate` dan `stockOpnames.opnameDate`
   (`server/operations.ts` baris ~1733, ~1817, ~2716). Di mesin WIB, pencarian checklist/opname hari
   berjalan tidak menemukan baris yang sudah ada, sehingga berisiko menyisipkan duplikat — komentar
   di `jakartaBusinessDate` menunjukkan gejala ini pernah muncul sekali dan "diperbaiki" dengan
   memindahkan tengah hari ke tengah malam, yang hanya memperkecil selisihnya. Sengaja tidak
   disentuh di sesi ini: menyentuh `jakartaBusinessDate` mengubah perilaku tutup buku, opname, dan
   checklist sekaligus, jadi perlu rencana tersendiri lebih dulu.

## Sesudah itu

Fase buku besar mengikuti rencana produk (artefak pada tautan di atas). Fase 03 selesai; sisanya:

1. **Fase 01 dimensi cabang**, lalu **fase 04 penjurnalan otomatis** dari transaksi valuta,
   pengeluaran, dan mutasi kas/bank. Urutan ini penting: penjurnalan otomatis membaca tepat
   tabel-tabel yang diubah oleh cabang, dan dibalik urutannya fase itu ditulis dua kali.
   Kunci unik `(sourceType, sourceReference)` sudah disiapkan supaya proses itu idempoten dan sudah
   dibuktikan menolak penjurnalan sumber yang sama dua kali.
2. Temuan 3 (arsip dokumen), 6 (stock opname termasuk Rupiah), 10 (pemantauan berbasis profil).
3. IRA — perlu tabel penilaian SRA.
4. Perbaiki penamaan `dttotPpsdmMatch` / "PPPSM" menjadi **DPPSPM/PPPSPM**.

## Aturan kerja

- Verifikasi klaim regulasi ke naskah aslinya. Hampir setiap dokumen yang diberikan pengguna
  mengoreksi sebuah asumsi — urutan sandi, jenjang KKNI, kolom Direksi, ambang bulanan.
- Jangan menebak skema; minta contoh berkas nyata.
- **Jangan push atau deploy tanpa persetujuan pada giliran itu juga.** Jangan menerapkan migrasi ke
  produksi tanpa permintaan eksplisit pada giliran itu juga.
- Jangan menaruh nama pegawai, NIK, atau data nasabah pada commit, dokumen, log, maupun tangkapan layar.
- Perubahan belum selesai tanpa `vitest`, `tsc --noEmit`, `vite build`, dan verifikasi visual untuk
  rute yang berubah.

## Yang masih menggantung

- **Ambang underlying bulanan** (commit `3fb0e98`) mengubah perilaku harian: kasir kini diminta
  dokumen pendukung bagi nasabah yang akumulasi sebulannya melewati USD 10.000. Logikanya diuji,
  tetapi kuerinya belum pernah diuji terhadap transaksi nyata — tidak ada uji di repo ini yang
  membuat transaksi utuh. Layak dicoba dengan data sungguhan sebelum masuk produksi.
- Data transaksi uji di produksi masih menunggu dihapus oleh pengguna.
