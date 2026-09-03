# Handoff — baca ini dulu

Diperbarui 3 September 2026, menjelang pemadatan konteks. Menggantikan isi sebelumnya.

## Baca dulu, jangan diturunkan ulang dari kode

1. **`CLAUDE.md`** — aturan keras operasional dan gerbang mutu.
   `pnpm` tidak ada di PATH; pakai `./node_modules/.bin/*`. MySQL client di `/opt/homebrew/opt/mysql/bin`.
2. **Rencana produk** — https://claude.ai/code/artifact/b7f62d68-3a12-419e-b507-2e1345260a6b
   Memuat dua belas temuan pemeriksaan BI yang dipetakan ke kode, peta 35 tabel ke lapisan
   tenant/cabang, bagan akun, fase, dan pemeriksaan silang. **Dokumen pengarah utama.**
3. Memori sesi (`~/.claude/projects/.../memory/`) — SAK EP, aturan penyusutan, struktur IRA,
   struktur RAP01/RAS01, temuan SINTA. Semuanya sudah diverifikasi dari dokumen asli.

## Cara menjalankan

```bash
export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; set -a; . ./.env; set +a
export TENANT_TEST_SECONDARY_URL="mysql://root@127.0.0.1:3306/mc_t_abcvalas"
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run          # 375 lulus
./node_modules/.bin/vite build
nohup ./node_modules/.bin/tsx watch server/_core/index.ts > /tmp/dev.log 2>&1 &
```

Login pengembangan: `test-shareholder` / `123456` (**minta pengguna yang mengetik sandi**).
Migrasi ke seluruh tenant lokal: `node scripts/tenant.mjs migrate-all` dengan `TENANT_REGISTRY` diisi.

**Verifikasi cetakan tanpa membekukan alat uji:** render di iframe memakai kode yang sama, tetapi
buang dulu skrip cetaknya — `html.replace(/<script>[\s\S]*?<\/script>/g, "")`. Memanggil
`window.print()` membuka dialog bawaan yang memblokir ekstensi peramban sampai pengguna menutupnya.

## Yang sudah selesai sesi ini (17 commit, belum di-push)

- **Menu bertingkat** bahasa sehari-hari, satu nama per halaman (23 halaman), zona waktu operasional.
- **Fase 00 multi-tenant**: `tenantContext.ts` (AsyncLocalStorage), `tenantRegistry.ts`, `getDb()`
  gagal-tertutup, middleware mendahului seluruh rute, kolam koneksi 4 per tenant,
  `scripts/tenant.mjs`, uji isolasi terhadap dua database sungguhan.
- **Nota** memuat identitas penyelenggara, kode KUPVA, nomor izin, kode BNS/BNB, pecahan dan lembar.
- **Bagian SDM lengkap**: pegawai (Perjanjian Kerja, penyaringan), sertifikat (penguraian nomor
  KKNI), penunjukan PIC + cetak SK, RAP01/RAS01 + berkas pipa, Lampiran rencana, Lampiran realisasi
  B.II/B.IV.
- **Ambang underlying** kini atas akumulasi sebulan per nasabah, bukan per transaksi.

## Yang sedang dikerjakan — SELESAIKAN INI DULU

**Pelatihan APU PPT** (commit `8466987`). Sisi server dan skema sudah selesai:
`apu_training_sessions`, `apu_training_attendance` (migrasi 0040, sudah diterapkan lokal),
`listTrainingSessions`, `recordTrainingSession`, `buildTrainingRecap`, dan rute tRPC
`sdm.trainingSessions` / `sdm.trainingRecap` / `sdm.recordTraining`.

Yang belum ada:
1. Tab **Pelatihan** pada `client/src/pages/Kepegawaian.tsx` — formulir sesi (tanggal, topik,
   metode, pemateri, materi, pilih peserta) dan daftar rekapitulasi.
2. `client/src/lib/suratPelatihan.ts` — cetak **Surat Keterangan Pelaksanaan Pelatihan Internal**
   mengikuti berkas contoh `~/Downloads/Pelatihan APUPPT Pegawai 2025-2026.docx`:
   nomor `SKP-APUPPT/{bulan romawi}/{tahun}/{urut}`, kalimat "Yang bertanda tangan di bawah ini,
   Direksi …", baris Topik/Metode/Pemateri, penutup yang menyebut e-Licensing Bank Indonesia,
   lalu **LAMPIRAN: REKAPITULASI DAFTAR HADIR DAN EVALUASI** berisi No./Nama/Jabatan/Tanggal.
   Ikuti pola `suratKeputusan.ts` — jendela cetak peramban, tanpa pustaka PDF.
3. Ujinya, seperti `server/suratKeputusan.test.ts`.

## Sesudah itu, urutan yang sudah disepakati

1. **Pemantauan profil pegawai berkala** — temuan 12(b); perlu tanggal jatuh tempo dan penanda
   terlambat, seperti aturan ≤6 bulan pada SINTA.
2. **Penyaringan calon pegawai** — tabel kecil (nama, identitas, cek DTTOT memakai
   `shared/sanctionsNameMatch.ts`, hasil, diterima/tidak, tautan ke pegawai bila diterima).
   Bukan sistem rekrutmen; temuan menyebut rekrutmen selama ini dari lingkungan keluarga, sehingga
   yang perlu dibuktikan adalah calon yang **tidak** diterima pun disaring.
3. **Buku besar** — temuan 7.1, yang diminta BI secara tertulis dan prioritas utama pengguna.

## Aturan kerja

- Verifikasi klaim regulasi ke naskah aslinya. Setiap dokumen yang diberikan pengguna sesi ini
  mengoreksi sebuah asumsi — urutan sandi, jenjang KKNI, kolom Direksi, ambang bulanan.
- Jangan menebak skema; minta contoh berkas nyata.
- **Jangan push atau deploy tanpa persetujuan pada giliran itu juga.** Produksi belum tersentuh
  sama sekali sepanjang sesi ini; seluruh migrasi hanya diterapkan ke basis data lokal.
- Jangan menaruh nama pegawai, NIK, atau data nasabah pada commit, dokumen, maupun log.
