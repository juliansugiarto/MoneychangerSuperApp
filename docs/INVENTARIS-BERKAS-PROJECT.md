# Inventaris Berkas Proyek dan Paket Handoff

Dokumen ini adalah peta berkas utama. Inventaris tidak memuat data produksi, rahasia lingkungan, atau daftar penuh dependensi pihak ketiga.

## Kode dan Konfigurasi

| Lokasi | Fungsi |
|---|---|
| `client/src/` | Antarmuka React, halaman back office, dan komponen UI. |
| `server/` | Router tRPC, autentikasi internal, operasi money changer, parser workbook, dan test. |
| `drizzle/schema.ts` | Definisi skema MySQL/TiDB yang menjadi sumber kebenaran. |
| `shared/` | Konstanta serta kontrak navigasi/peran lintas frontend-backend. |
| `scripts/` | Skrip dukungan pengembangan yang disimpan di source. |
| `package.json` dan `pnpm-lock.yaml` | Perintah build/test dan versi dependensi reproducible. |
| `CLAUDE.md` | Instruksi ringkas untuk sesi Claude Code pada proyek ini. |
| `.claude/rules/` | Aturan Claude Code bertopik untuk server/data, UI, serta keamanan/rilis. |

## Dokumentasi Operasional dan Handoff

| Berkas | Fungsi |
|---|---|
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` | Panduan kerja lengkap untuk seluruh peran. |
| `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.pdf` | Versi PDF komprehensif panduan A–Z yang siap baca/cetak. |
| `docs/USE-CASE-SCENARIOS.md` | Skenario inti, aktor, hasil, dan batas kontrol. |
| `docs/USE-CASE-SCENARIOS.pdf` | Versi PDF komprehensif skenario use case, pengecualian, dan bukti kontrol. |
| `docs/VALIDASI-PDF-DOKUMEN-2026-08-25.md` | Hasil kompilasi, verifikasi, dan review visual kedua PDF. |
| `docs/SKEMA-DATABASE-PROJECT.md` | Peta entitas, status workflow, dan prosedur perubahan skema. |
| `docs/INSTRUKSI-CLAUDE-CODE.md` | Handoff pengembangan dan prompt aman untuk Claude Code. |
| `docs/finalisasi-operasional-2026-08-25.md` | Status rilis, hasil validasi, serta risiko residual. |
| `docs/validasi-manajemen-pengguna-shareholder-2026-08-25.md` | Bukti validasi kartu manajemen pengguna Shareholder. |
| `docs/INVENTARIS-BERKAS-PROJECT.md` | Dokumen ini. |

## Isi ZIP yang Dibagikan

| Lokasi dalam ZIP | Isi |
|---|---|
| `source/` | Salinan kode dan dokumentasi yang dapat dibangun ulang tanpa `node_modules`, `dist`, log, secret, maupun data produksi. |
| `documentation/` | Salinan dokumen handoff yang dipilih, termasuk `BUKU-PANDUAN-PENGGUNAAN-A-Z.pdf` dan `USE-CASE-SCENARIOS.pdf`. |
| `verification/VALIDATION-SUMMARY.md` | Status test/build/PDF serta risiko residual SheetJS. |
| `verification/EXCLUSIONS.md` | Daftar artefak yang sengaja tidak ikut demi keamanan. |
| `SHA256SUMS.txt` | Checksum SHA-256 berkas paket untuk pemeriksaan setelah ekstraksi. |

> Folder `node_modules/`, build `dist/`, `.git/`, `.manus-logs/`, konfigurasi lingkungan, dan seluruh data operasional tidak disertakan. Bangun ulang dependensi dari lockfile; jangan memindahkan kredensial atau salinan database melalui paket ini.
