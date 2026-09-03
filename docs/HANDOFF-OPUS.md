# Handoff — baca ini dulu

Diperbarui 3 September 2026. Menggantikan isi sebelumnya.

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
./node_modules/.bin/vitest run          # 402 lulus, 2 dilewati
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

**20 commit belum di-push. Produksi tidak pernah disentuh sepanjang dua sesi ini** — seluruh
migrasi hanya diterapkan ke dua basis data lokal.

Selesai sesi ini:

- **Pelatihan APU PPT** (`aae8c0e`) — tab Pelatihan pada Kepegawaian, `client/src/lib/suratPelatihan.ts`
  yang mencetak Surat Keterangan Pelaksanaan Pelatihan Internal beserta lampiran rekapitulasi
  daftar hadir dan halaman materi. Diuji ujung ke ujung di peramban; cetakan diperiksa dan sesuai
  contoh perusahaan.
- **Peninjauan berkala profil pegawai** (`4db9b50`, temuan 12b) — tabel `employee_profile_reviews`,
  `shared/employeeProfileReview.ts` (tenggang 6 bulan, status TERKINI/SEGERA/TERLAMBAT), kartu pada
  tab Pegawai, ringkasan "Profil terlambat ditinjau". Migrasi 0041. Diuji ujung ke ujung.

Data uji yang tertinggal di tenant lokal `moneychanger`: satu sesi pelatihan 15 Okt 2025 dan satu
peninjauan profil 3 Sep 2026 atas pegawai "UJI PELAKSANA". Boleh dibiarkan atau dihapus.

## SEDANG DIKERJAKAN — selesaikan ini dulu

**Penyaringan calon pegawai** (temuan: perekrutan dari lingkungan keluarga tanpa penyaringan
terdokumentasi). Yang sudah ada, **belum di-commit**:

- `drizzle/schema.ts` — tabel `employeeCandidates` + `candidateDecisions`, dan tipe `EmployeeCandidate`.
- `drizzle/0042_typical_kang.sql` + snapshot, **sudah diterapkan ke dua tenant lokal** lewat `migrate-all`.

Yang belum ada:

1. **Sisi server** di `server/sdmOperations.ts` — `listCandidates`, `recordCandidate`,
   `screenCandidate`, `decideCandidate`. Saat calon dicatat, jalankan pencocokan otomatis memakai
   `searchSanctionsWatchlist` (`server/operations.ts`, sudah ada) atas namanya, lalu simpan
   `watchlistCheckedAt`, `watchlistMatchCount`, dan ringkasan namanya ke `watchlistSummary`.
   Hasil penyaringan (LULUS/TIDAK_LULUS) tetap penilaian manusia, bukan hasil pencocokan.
   Tulis jejak audit seperti `EMPLOYEE_PROFILE_REVIEWED`.
2. **Rute tRPC** pada `server/routers.ts` di dalam `sdm` — baca dengan `staffProcedure`, tulis
   dengan `controllerProcedure`, mengikuti pola `recordProfileReview` tepat di atasnya.
3. **Tab "Calon Pegawai"** pada `client/src/pages/Kepegawaian.tsx` — formulir catat calon, tabel
   calon beserta status pencocokan dan keputusannya, dan formulir perbarui hasil. Ikuti pola kartu
   "Peninjauan berkala profil pegawai" pada tab Pegawai (baris ~355).
4. **Uji** seperti `server/employeeProfileReview.test.ts`.

Yang penting dibuktikan: **calon yang tidak diterima pun tetap tersimpan**. Itulah inti temuannya;
kolom penyaringan pada tabel `employees` hanya menyimpan hasil bagi yang diterima.

## Sesudah itu

1. **Buku besar** — temuan 7.1, diminta BI secara tertulis dan prioritas utama pengguna.
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
