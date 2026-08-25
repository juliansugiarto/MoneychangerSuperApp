# Handoff Proyek — PT Ibukota Valasindo

## Mulai di Sini

Paket ini adalah satu handoff teknis dan operasional untuk aplikasi internal money changer PT Ibukota Valasindo. Buka `documentation/BUKU-PANDUAN-PENGGUNAAN-A-Z.pdf` untuk pelatihan pengguna dan `documentation/USE-CASE-SCENARIOS.pdf` untuk memahami alur, pengecualian, bukti, serta batas kontrol setiap proses.

| Folder | Isi dan tujuan |
|---|---|
| `source/` | Salinan kode aplikasi, test, aturan Claude Code, dan dokumentasi source-controlled yang dapat dibangun ulang. |
| `documentation/` | Dua PDF siap baca/cetak, sumber Markdown, skema database, inventaris, finalisasi, dan instruksi pengembangan lanjutan. |
| `verification/` | Bukti validasi PDF, status regresi/build, dan daftar pengecualian keamanan. |
| `SHA256SUMS.txt` | Checksum integritas berkas paket setelah diekstrak. |

## Menjalankan Salinan Kode

```bash
cd source
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
pnpm dev
```

Jangan menghubungkan salinan ini langsung ke database produksi sebelum konfigurasi, akses, backup, dan SOP ditinjau. Tidak ada secret, credential, cookie, data nasabah, transaksi, kas, log, atau workbook keuangan aktual di dalam ZIP.

## Batas Operasional

Kurs outlet tetap memerlukan keputusan manusia dan alasan yang dapat ditelusuri. Pelaporan regulator hanya menghasilkan persiapan serta ekspor manual, bukan pengiriman otomatis. Simulasi harus terisolasi dari seluruh data dan arsip produksi. Lihat kedua PDF untuk urutan kerja dan batas yang lengkap.
