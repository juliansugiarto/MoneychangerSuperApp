# Finalisasi Operasional — Pemeriksaan Rilis Awal

**Tanggal pemeriksaan:** 25 Agustus 2026  
**Lingkup:** Back office PT Ibukota Valasindo, termasuk transaksi, kurs, kas, checklist, pengawasan, pelaporan internal, dan akses peran.

## Status Rilis

Rilis telah melalui pemeriksaan tipe, regresi otomatis, walkthrough terisolasi lintas peran, dan verifikasi tampilan kontrol akses. Perbaikan terakhir menyelaraskan tanggal bisnis checklist dengan kolom `DATE` basis data; akibatnya checklist pembukaan dan penutupan yang sudah ada kembali terbaca tanpa mencoba membuat row duplikat saat beberapa permintaan terjadi berdekatan.

| Area | Hasil pemeriksaan | Status |
|---|---|---|
| TypeScript | `pnpm check` lulus setelah pembaruan dependency dan perbaikan checklist. | Lulus |
| Regresi otomatis | 40 berkas uji, 150 pengujian lulus. | Lulus |
| Build produksi | `pnpm build` selesai; bundle server dan klien berhasil dihasilkan. | Lulus |
| Smoke test HTTP | Halaman back office merespons `200`; endpoint checklist tanpa sesi ditolak `401`. | Lulus |
| Simulasi satu hari | Staff, Supervisor/Admin, Controller/Direksi, dan Shareholder diuji pada jalur terisolasi. | Lulus |
| Isolasi produksi | Simulasi tidak membuat transaksi, kas, laporan, paket regulator, register, arsip, atau audit produksi baru. | Lulus |
| Checklist harian | Halaman memuat langkah pembukaan dan penutupan dari row bisnis saat ini. | Lulus |
| Akses peran | Rute tanpa sesi menampilkan guard login; operasi kritis tetap memakai peran minimum dan maker-checker. | Lulus |
| Regulator | Tidak ada submit, token, maupun pengiriman otomatis ke Bank Indonesia/regulator lain. | Terbatas dengan sengaja |

## Pembaruan Keamanan yang Telah Diterapkan

Paket yang memiliki jalur pembaruan aman telah diperbarui: AWS SDK, tRPC, nanoid, Drizzle ORM, Axios, Express, dan Recharts. Komponen showcase chat yang tidak dirutekan juga telah dihapus bersama dependensi `streamdown`/Mermaid yang tidak diperlukan aplikasi produksi. Import workbook kini memeriksa batas ukuran, MIME, base64, dan signature XLSX/XLS sebelum parser dijalankan; bundle tetap tidak disimpan sebelum snapshot benar-benar disimpan secara eksplisit.

## Risiko Residual yang Harus Dipahami

Audit produksi terakhir masih melaporkan **3 temuan** dari `xlsx`/SheetJS: **2 high** dan **1 moderate**. Kedua temuan high yang tidak memiliki patch pemasok adalah prototype pollution dan regular-expression denial of service (ReDoS). Ini bukan error aplikasi yang dapat ditutup dengan pembaruan versi karena auditor paket belum menyediakan versi perbaikan jalur tersebut.

> **Keputusan operasional:** Impor XLS/XLSX dibatasi bagi Controller/Shareholder, maksimal 5 MB, wajib memiliki signature spreadsheet yang benar, dan hanya boleh memakai sumber internal tepercaya yang telah diperiksa antivirus. File dari email, aplikasi pesan, flashdisk, atau sumber yang tidak dapat diverifikasi **tidak boleh diimpor**. Gunakan input manual bila sumber belum dipercaya.

## Kriteria Go / Tunda

| Keputusan | Kondisi |
|---|---|
| **Boleh mulai operasional** | Akun pribadi sudah aktif, kurs outlet diperiksa manual, kas fisik pembukaan sudah dicatat, checklist pembukaan selesai, dan tidak ada tindakan kritis merah pada Kesiapan Operasional. |
| **Tunda transaksi/kurs** | Kurs belum ditinjau, kas awal belum jelas, data nasabah tidak cukup, transaksi ditandai review, atau halaman sistem menampilkan error yang belum dipahami. |
| **Tunda impor workbook** | File bukan dari sumber internal tepercaya, melebihi 5 MB, signature/format ditolak, struktur FORM B0002/B0003/B0004 tidak sesuai, atau antivirus memberi peringatan. |
| **Tunda paket regulator** | Snapshot/angka belum ditelaah, periode salah, catatan pengembalian belum ditangani, atau maker dan approver adalah orang yang sama. |

## Tindakan Wajib Hari Pertama

1. **Controller dan Shareholder** memeriksa akun, peran, dan reset kata sandi awal untuk setiap pengguna nyata.
2. **Admin/Supervisor** meninjau kurs aktif, sumber referensi, alasan aktivasi terakhir, serta kondisi anomali pasar sebelum layanan dibuka.
3. **Staff** menghitung kas fisik, mencatat kas pembukaan per mata uang, memeriksa lampu UV/mesin hitung, lalu menyimpan checklist pembukaan.
4. **Tim** memilih dua akun perusahaan berbeda untuk menjalankan dry-run prosedural tanpa membuat bon transaksi fiktif di produksi.
5. **Supervisor** menyepakati jalur eskalasi yang dapat dihubungi untuk transaksi terflag, varians kas, kurs ekstrem, keluhan konsumen, dan kendala sistem.
6. **Controller** menyimpan salinan Buku Panduan Penggunaan A–Z di perangkat kerja yang dapat diakses tim.
7. **Shareholder** menegaskan bahwa pelaporan regulator masih bersifat persiapan internal; ekspor bukan bukti pengiriman eksternal.

## Penutup

Rilis ini siap dipakai sebagai aplikasi operasional internal dengan guardrail yang telah diuji. Kesiapan tidak menghapus tanggung jawab pengguna untuk memeriksa kas fisik, kurs, dokumen nasabah, dan otorisasi. Setiap error baru, hasil tidak wajar, atau ketidakcocokan angka harus dihentikan pada titik aman dan dieskalasikan—bukan ditutupi dengan catatan atau transaksi pengganti.

Build produksi memberi peringatan ukuran bundle klien utama di atas 500 kB setelah minifikasi. Peringatan tersebut tidak menghentikan build atau fungsi aplikasi, tetapi Controller sebaiknya melakukan pengujian koneksi kantor pada hari pertama dan melaporkan pemuatan yang lambat agar pemisahan bundle dapat dijadwalkan sebagai penguatan berikutnya.
