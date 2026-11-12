# Audit kualitas sebelum daring — 12 November 2026 (WIB)

Tujuan: menjawab "tulis ulang V2 dari nol atau rapikan di tempat?" dengan bukti. Dua peninjau baca-saja
(alur uang/stok; akses/keamanan) + pemeriksaan Claude. Temuan kritis dicek ulang Claude di kode.

## Kesehatan umum

- Uji: `Test Files 233 passed | 1 skipped (234)`, `Tests 1789 passed | 6 skipped (1795)`, 17 dtk
  (perlu `.env` dimuat: `set -a; . ./.env; set +a`). Lewatan tambahan = `tenantIsolation.live.test.ts`.
- `tsc --noEmit` keluar 0; `vite build` lulus.
- Tidak ada identitas perusahaan tertanam di kode (siap white-label). Sisa perkakas Manus di build
  dibuang di cabang `chore/buang-sisa-manus` (`3be51cf`).
- Kelemahan struktur: `server/operations.ts` 3.854 baris, `routers.ts` 1.496, `BukuBesar.tsx` 1.240,
  `Kepegawaian.tsx` 1.160. Uji operasi memakai tiruan tabel; **tidak ada uji MySQL sungguhan untuk
  penguncian/konkurensi/stok negatif**; E2E hanya `fondasi` + `masuk`.

**Putusan: rapikan di tempat (V2 di tempat), bukan tulis ulang.** Kedua peninjau menilai "fixable in
place, not rotten"; seluruh temuan kritis adalah perbaikan lokal puluhan baris.

## Wajib sebelum daring (urut)

| # | Temuan | Bukti | Status |
|---|---|---|---|
| U1 | Saldo `cash_balances` bisa hilang-tulis: baris dikunci `FOR UPDATE` tetapi dibaca ulang dengan SELECT biasa (snapshot REPEATABLE READ) | `operations.ts:2141-2142`, pola sama ±2941, ±3001 | **DIPERBAIKI** `7fd0ee0` (+ kebuntuan pool karena `writeAudit`) |
| U2 | Stok per pecahan hanya dicek saat draf, di luar transaksi; penyelesaian tidak cek ulang; kuantitas bisa negatif | `assertSufficientStock` ±2015, `applyDenominationBalanceDelta` 2001, `schema.ts` ±714 | **DIPERBAIKI** `e1fbdce` |
| K1 | Pembatas login/pemulihan/penyiapan tembus lewat batching tRPC | `_core/index.ts:166`, `routers.ts:444-461` | **DIPERBAIKI** `4f7143b` |
| K2 | STAFF dapat mengunduh dokumen apa pun per id (KTP, arsip perusahaan khusus Controller) | `documentOperations.ts:179-184`, `routers.ts:915`, `_core/index.ts:155` | **DIPERBAIKI** `16c6722` |
| K3 | Akun uji `123456` hanya ditolak bila `NODE_ENV` tepat `production`; `JWT_SECRET` kosong jatuh ke acak | `_core/env.ts:4`, `internalAuth.ts` | **DIPERBAIKI** `17bc07e` |
| K4 | Tanpa header keamanan (CSP/frame-ancestors/HSTS/nosniff) | `server/` | **DIPERBAIKI** `feaa31b` (tanpa `script-src`, lihat bawah) |
| U3 | Batal vs selesai berpacu: `cancelTransaction` tanpa `WHERE status` | ±1885 | **DIPERBAIKI** `3553d40` |
| U4 | Tanggal jurnal memakai hari lokal server (UTC), bukan WIB | `ledgerPosting.ts:40`, `shared/ledger.ts:214` | **DIPERBAIKI** `43b1e2c` |
| U5 | `transactionAt` dari klien tanpa batas; loop posting tanpa try/catch → batch setengah jalan | `routers.ts:413`, `ledgerPosting.ts:80-106` | **DIPERBAIKI** `43b1e2c` |

## Temuan tambahan selama perbaikan

- **Kebuntuan pool sambungan** (terbukti uji live): `writeAudit` di dalam transaksi meminta sambungan kedua dari
  pool 4; lima penulisan kas bersamaan menggantung ±50 dtk lalu gagal. Diperbaiki bersama U1.
- Sisa Manus: komponen `Map.tsx` (proksi `forge.butterfly-effect.dev`) dan `ManusDialog.tsx` mati → dibuang `572c5b1`.
- `<title>` menulis mati "Ibukota Valasindo" → kini dari Profil Perusahaan (`feaa31b`).
- **Belum:** CSP `script-src` menunggu jendela cetak surat/lampiran berhenti memakai skrip sebaris
  (`client/src/lib/surat*.ts`, `lampiran*.ts`).

## Fitur operasional yang belum ada (keputusan pemilik)

- **Bon COMPLETED tidak bisa dibalik** — koreksi hanya lewat penyesuaian kas `OTHER` yang tidak dijurnal.
- **Kembalian & pembulatan Rupiah**: pecahan Rupiah harus sama persis dengan total bon; mis. JPY 1000 @
  10.537/100 = Rp 105.370 tidak bisa dibayar tunai; kembalian tidak bisa dicatat.

## Minor (dicatat, belum dikerjakan)

Gerakan kas bon berkategori `OTHER` (seharusnya TRANSACTION); kaki Rupiah tidak memperbarui
`stock_opnames`; `writeAudit` di sambungan terpisah; `customers.list` tanpa halaman dan semua kolom untuk
STAFF; data SDM terbuka untuk STAFF; body parser 50 MB global sebelum autentikasi; unggah dokumen percaya
MIME klien; rahasia cron dibandingkan `!==`; beberapa persetujuan memakai `protectedProcedure`
(melewati gerbang ganti sandi); `serviceRequests.create` dan `changePassword` tanpa pembatas.

## Yang terbukti kokoh

Decimal.js + `decimal(24,6)`; quoteUnit; penyelesaian bon memposting kedua kaki dalam satu transaksi;
jurnal seimbang dan periode tertutup dijaga; posting idempoten; peran terpusat dan teruji; scrypt +
perbandingan waktu-konstan; sesi berversi; penyiapan tidak bisa diulang; impor XLS 5 MB + tanda tangan;
tanpa `sql.raw`; tanpa rahasia ter-commit.

## Catatan rilis

`main` lokal 57 commit di depan `origin/main`; **push ke `main` = deploy produksi otomatis**
(`deploy.yml` → `deploy.sh`: cadangan, migrasi `0060`–`0062`, build, restart). Jangan push `main` tanpa
perintah pemilik. Produksi yang dibangun sebelum `3be51cf` masih memuat skrip runtime Manus.
