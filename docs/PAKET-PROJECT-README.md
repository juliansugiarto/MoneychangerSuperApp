# Paket Proyek PT Ibukota Valasindo

Paket ini adalah handoff teknis dan operasional untuk aplikasi internal money changer PT Ibukota Valasindo. Tujuannya adalah memberi tim pemilik dan pengembang berikutnya satu sumber yang tertata untuk memahami kode, batas operasional, dokumentasi, dan cara memverifikasi perubahan.

> Paket ini **bukan** cadangan data produksi, salinan kredensial, atau bukti kepatuhan regulator. Data nasabah, data kas, workbook keuangan aktual, session cookie, secret lingkungan, dan dokumentasi identitas tidak disertakan.

## Isi Paket

| Lokasi | Isi | Kegunaan |
|---|---|---|
| `source/` | Kode sumber aplikasi React, Express, tRPC, Drizzle, dan test | Pengembangan, audit, serta build ulang. |
| `documentation/` | Panduan A–Z, use case, skema database, catatan finalisasi, dan handoff Claude Code | Operasional dan pengembangan berkelanjutan. |
| `documentation/BUKU-PANDUAN-PENGGUNAAN-A-Z.pdf` | Buku panduan yang siap dibaca/cetak | Pelatihan pengguna Staff sampai Shareholder. |
| `documentation/USE-CASE-SCENARIOS.pdf` | Skenario use case yang siap dibaca/cetak | Referensi alur, pengecualian, bukti, dan batas kontrol. |
| `documentation/VALIDASI-PDF-DOKUMEN-2026-08-25.md` | Bukti kompilasi, pemeriksaan, dan review visual PDF | Audit mutu dokumen handoff. |
| `verification/` | Ringkasan test, build, dan checksum paket | Pemeriksaan integritas handoff. |
| `README.md` | Petunjuk cepat paket | Titik mulai penerima paket. |

## Berkas yang Sengaja Tidak Disertakan

`node_modules/`, hasil build `dist/`, log runtime, cache, folder `.git/`, variabel lingkungan, dan data/arsip operasional tidak dimasukkan. Dependensi dapat dibuat kembali dengan `pnpm install --frozen-lockfile`; build dapat dibuat kembali dengan `pnpm build`. Penghilangan ini mengurangi ukuran paket dan mencegah perpindahan rahasia atau data produksi secara tidak terkendali.

## Menjalankan Salinan Kode

Gunakan Node.js 22 dan pnpm yang kompatibel dengan `package.json`. Buat file `.env` hanya di lingkungan aman; jangan pernah memasukkan nilainya ke source control atau tiket dukungan.

```bash
cd source
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
pnpm dev
```

Database produksi harus menggunakan koneksi TLS sesuai kebijakan perusahaan. Sebelum menjalankan terhadap data nyata, baca `documentation/BUKU-PANDUAN-PENGGUNAAN-A-Z.pdf`, `documentation/USE-CASE-SCENARIOS.pdf`, `documentation/SKEMA-DATABASE-PROJECT.md`, dan `documentation/INSTRUKSI-CLAUDE-CODE.md`.

## Batas Penting

Kurs outlet tetap diaktifkan manual oleh manusia dengan alasan yang dapat ditelusuri. Pelaporan regulator hanya menghasilkan paket dan ekspor manual; aplikasi tidak memiliki pengiriman otomatis ke Bank Indonesia atau regulator lain. Data simulasi, demo, dan historis tidak boleh masuk ke kas, bon, laporan, ataupun arsip produksi.
