# V1 Validation Report — Ibukota Valasindo

## Ringkasan

Audit V1 dilakukan dengan pendekatan **use-case scenario** dan pengujian regresi. Fokusnya adalah memastikan operasi inti tidak hanya dirender di antarmuka, tetapi mengikuti aturan data, peran, audit trail, dan presisi nominal yang ditetapkan untuk back-office money changer.

> Data dummy digunakan hanya di memori proses pengujian melalui `server/v1Fixtures.ts`. Tidak ada fixture yang ditulis ke database pengguna atau data operasional.

## Hasil otomatis

| Pemeriksaan | Hasil |
| --- | --- |
| TypeScript `pnpm check` | Lulus |
| Vitest `pnpm test` | 41 tes lulus dalam 9 berkas |
| Fixture dummy terisolasi | Lulus; tidak membuat koneksi atau mutasi database produksi |
| Format dan penjumlahan Rupiah | Lulus; tidak menggunakan `Number()` atau floating point untuk nilai Rupiah pada transaksi, dashboard, dan laporan |
| Rute stock opname | Lulus; `/operasional/stock` dan alias `/operasional/stock-opname` tersedia |
| Verifikasi visual publik | Lulus pada desktop; hierarki informasi dan CTA staf dirender dengan baik |

## Matriks skenario yang diuji

| Domain | Skenario yang dibuktikan |
| --- | --- |
| Akses peran | 16 kombinasi minimum role untuk TELLER, SUPERVISOR, DIRECTOR, dan ADMIN; sesi logout tetap memakai cookie aman. |
| KYC/CDD | CIF, identitas, kelahiran, alamat, pekerjaan, sumber dana, dan tujuan transaksi harus lengkap sebelum profil dipakai. |
| Kurs | Parser kurs BI mempertahankan tanggal sumber dan basis kuotasi, termasuk kurs per 100 unit seperti JPY. |
| Transaksi | BUY/SELL menggunakan kurs snapshot dan quote unit snapshot yang tidak berubah ketika master rate berubah. |
| Review | Nilai ekuivalen terhadap ambang USD dan alasan profile mismatch menentukan kebutuhan review. |
| Lifecycle | Draft, review, approval/return/escalation, cancellation beralasan, dan completion diuji sebagai transisi yang dibatasi. |
| Kas | Dampak saldo BUY dan SELL dihitung desimal; pembaruan nyata tetap berada dalam transaksi database. |
| Stock opname | Saldo fisik `0` valid; variance dihitung dan direkonsiliasi tanpa disembunyikan. |
| Laporan | Rentang tanggal laporan transaksi dan stock opname dipakai pada query backend. |
| Ketahanan baca | Query baca penting memiliki satu retry untuk kegagalan jaringan sementara; operasi tulis tidak diulang otomatis. |

## Perbaikan yang dilakukan dari audit

1. **KYC inti diperketat.** Kontrak backend dan formulir mewajibkan data identitas serta profil minimum yang diperlukan V1.
2. **Stock opname membolehkan saldo fisik nol.** Nilai nol adalah hasil hitung fisik yang sah dan tidak lagi tertolak oleh validasi truthy.
3. **Laporan konsisten terhadap periode.** Data stock opname sekarang difilter sesuai tanggal laporan di backend.
4. **Nominal Rupiah pada UI tetap presisi.** Format dan total besar menggunakan integer minor-unit berbasis `BigInt`, bukan floating point browser.
5. **Kegagalan koneksi sementara ditangani terbatas.** Pembacaan data dapat mencoba sekali lagi; mutasi transaksi tetap gagal eksplisit agar tidak berisiko dobel posting.
6. **Rute stock opname memiliki alias eksplisit.** URL yang lebih deskriptif tidak lagi berakhir pada 404.

## Pemetaan ketahanan query baca

| Area UI | Kontrak baca | Bukti uji sukses dan gangguan database sementara |
| --- | --- | --- |
| Mata uang | `listCurrencies` | `criticalReads.test.ts` |
| Nasabah & KYC | `listCustomers` | `criticalReads.test.ts` |
| Referensi BI dan kurs operasional | `listReferenceSnapshots`, `listOperationalRates` | `criticalReads.test.ts` |
| Status sinkronisasi BI | `getRateSyncStatus` | `biRateStatus.test.ts` |
| Ambang review | `getReviewThreshold` | `reviewSettings.test.ts` dengan fallback aman |
| Antrean transaksi | `listTransactions` | `criticalReads.test.ts` |
| Kas dan stock opname | `listCashBalances`, `listStockOpnames` | `criticalReads.test.ts` |
| Dashboard | `getOperationalDashboard` | `criticalReads.test.ts` |
| Laporan periode | `getTransactionReport`, `getStockOpnameReport` | `criticalReads.test.ts` |
| Audit log | `getAuditLog` | `criticalReads.test.ts` |

> Semua kontrak baca di atas mencoba ulang tepat satu kali ketika gangguan koneksi bersifat sementara. Jalur tulis tidak pernah diulang otomatis.

## Uji penerimaan yang masih membutuhkan sesi ADMIN

Pengujian otomatis tidak boleh memakai akun staf atau menulis data dummy ke database operasional. Karena itu, berikut adalah cek singkat yang masih perlu dijalankan pada sesi ADMIN nyata:

1. Muat ulang `/operasional/nasabah` dan `/operasional/laporan` untuk memastikan tidak ada error tRPC.
2. Buat satu profil KYC dengan data lengkap, lalu pastikan field wajib tidak dapat dilewati.
3. Sinkronkan atau masukkan referensi BI, ajukan kurs operasional, lalu setujui kurs tersebut.
4. Buat satu transaksi kecil pada nasabah uji, kirim, review/approve, dan selesaikan; verifikasi saldo kas serta audit log.
5. Buka stock opname, masukkan saldo fisik `0` bila diperlukan sebagai skenario uji, lalu rekonsiliasi dan periksa laporan.

> Pratinjau otomatis sengaja tidak memiliki cookie sesi, sehingga hanya dapat memverifikasi penjaga akses dan tidak digunakan sebagai bukti fungsi layar internal yang diautentikasi.

## Batasan V1 yang disengaja

> V1 memiliki kontrol teknis untuk KYC/CDD, review threshold, audit, dan monitoring. Validasi apakah aturan tersebut sudah memenuhi seluruh kewajiban regulator dan SOP internal tetap harus dilakukan oleh penanggung jawab kepatuhan atau penasihat hukum sebelum produksi.

Pembaruan kurs BI terjadwal akan memakai Heartbeat terautentikasi pada waktu operasional yang disetujui tanpa membuat kurs operasional aktif secara otomatis. Callback hanya menerima task UID yang tersimpan pada konfigurasi BI.
