# Skema Database Proyek

**Sumber otoritatif skema:** `drizzle/schema.ts`.  
**Platform:** MySQL/TiDB melalui Drizzle ORM.  
**Prinsip:** simpan data transaksi dan kontrol dalam tipe presisi desimal, pertahankan jejak perubahan penting, dan pisahkan data demo/historis dari alur produksi.

> Dokumen ini adalah peta teknis. Skema aplikasi memakai relasi logis lewat kolom ID dan indeks; perubahan struktur harus dibuat di `drizzle/schema.ts`, menghasilkan migrasi, lalu diterapkan secara terkontrol pada database yang benar.

## Domain Entitas

| Domain | Tabel | Tanggung jawab |
|---|---|---|
| Identitas dan akses | `users` | Username, hash sandi, peran, status akun, versi sesi, dan kewajiban ganti sandi. |
| Mata uang dan kurs | `currencies`, `rate_reference_snapshots`, `operational_rates`, `market_rate_observations`, `rate_volatility_alerts`, `rate_sync_configurations`, `rate_sync_runs` | Mata uang, referensi, kurs outlet berstatus, observasi pasar, alarm, dan riwayat sinkronisasi. |
| Nasabah dan bon | `customers`, `exchange_transactions`, `exchange_transaction_lines`, `exchange_transaction_denomination_entries`, `exchange_transaction_payment_denominations`, `operational_documents`, `transaction_review_actions` | KYC, header bon (bisa berisi banyak baris mata uang), rincian pecahan valuta per baris, rincian pecahan Rupiah sisi pembayaran tunai, dokumen S3, serta keputusan review yang tidak ditimpa. |
| Kas dan outlet | `cash_balances`, `cash_balance_movements`, `cash_denomination_balances`, `stock_opnames`, `daily_operational_checklists` | Saldo per mata uang, mutasi, stok pecahan berjalan, opname fisik, dan checklist harian. |
| Konfigurasi dan layanan | `operational_settings`, `service_requests`, `public_announcements`, `consumer_complaints` | Ambang pengawasan, permintaan layanan, pengumuman, dan keluhan. |
| Audit dan pengawasan | `audit_logs`, `director_acknowledgements` | Jejak perubahan serta tugas Direksi mengetahui. |
| Pelaporan internal | `regulatory_report_packages`, `financial_statement_snapshots`, `regulatory_incident_reports` | Paket manual, snapshot B0002/B0003/B0004, dan register insidental. |

## Relasi Operasional Utama

```mermaid
erDiagram
  USERS ||--o{ EXCHANGE_TRANSACTIONS : "mencatat atau meninjau"
  CUSTOMERS ||--o{ EXCHANGE_TRANSACTIONS : "menjadi nasabah"
  CURRENCIES ||--o{ OPERATIONAL_RATES : "memiliki kurs"
  EXCHANGE_TRANSACTIONS ||--o{ EXCHANGE_TRANSACTION_LINES : "berisi baris mata uang"
  CURRENCIES ||--o{ EXCHANGE_TRANSACTION_LINES : "dipakai baris"
  CURRENCIES ||--|| CASH_BALANCES : "memiliki saldo"
  CASH_BALANCES ||--o{ CASH_BALANCE_MOVEMENTS : "memiliki mutasi"
  EXCHANGE_TRANSACTIONS ||--o{ TRANSACTION_REVIEW_ACTIONS : "memiliki keputusan"
  EXCHANGE_TRANSACTIONS ||--o{ OPERATIONAL_DOCUMENTS : "didukung dokumen"
  USERS ||--o{ AUDIT_LOGS : "melakukan tindakan"
  USERS ||--o{ REGULATORY_REPORT_PACKAGES : "membuat atau memeriksa"
```

## Kontrol Data Penting

| Kontrol | Implementasi skema | Konsekuensi operasi |
|---|---|---|
| Presisi uang | `decimal(24, 6)` untuk valuta/rate, `decimal(24, 2)` untuk Rupiah bon | Jangan mengonversi nilai uang menjadi `float`. |
| Snapshot bon | Nilai kurs dan KYC disalin ke `exchange_transactions` | Riwayat bon tetap dapat dibaca bila profil/kurs berubah. |
| Bon multi-mata uang | `exchange_transaction_lines` — satu baris per mata uang/harga per bon (mirip tabel di kertas kwitansi fisik). `exchange_transactions.currencyId`/`foreignAmount`/`rateSnapshot`/`operationalRateId`/`quoteUnitSnapshot` nullable dan hanya terisi pada bon lama (sebelum fitur ini); `rupiahAmount` di header tetap terisi sebagai total seluruh baris. | Bon baru selalu dibaca lewat `exchange_transaction_lines`; kode yang membaca bon lama tetap jalan lewat kolom header lama (tidak dimigrasikan). |
| Harga per pecahan | `exchange_transaction_denomination_entries.agreedRate` wajib diisi per baris pecahan (mis. USD 100-an vs USD 10-an boleh beda harga dalam satu baris mata uang); `exchange_transaction_lines.agreedRate`/`foreignAmount`/`rupiahAmount` adalah **hasil hitung** (rata-rata tertimbang/total) dari pecahan tsb, bukan input langsung. `operationalRateId`/`referenceRateSnapshot` di baris hanya pembanding opsional. | Mata uang tanpa kurs otomatis tetap bisa dipakai transaksi; harga sesungguhnya selalu bersumber dari pecahan. |
| Mata uang dunia | Tabel `currencies` tidak lagi dibatasi ke mata uang yang disinkronkan BI/JISDOR — staf bisa mendaftarkan mata uang apa pun (termasuk IDR) lewat pencarian ISO 4217 di form, yang memanggil `ensureCurrency` (idempotent, tidak menyentuh kurs) | GBP, IDR, atau mata uang lain otomatis tersedia begitu pernah dipilih sekali; tidak perlu menunggu Admin membuatnya lebih dulu di Kurs Operasional. |
| Nomor kwitansi fisik | `exchange_transactions.receiptNumber` + unique index `(operation, receiptNumber)` | Bon Jual dan Bon Beli punya urutan nomor terpisah (No. 1 boleh ada di keduanya); `transactionNumber` sistem tetap ada terpisah untuk audit. |
| Stok pecahan berjalan | `cash_denomination_balances` (unik per `currencyId`+`denominationValue`) diperbarui otomatis oleh kas awal (reset ke hitungan yang dideklarasikan), penyesuaian, dan bon yang **diselesaikan** (bukan sekadar disetujui) — lihat `resetDenominationBalances`/`applyDenominationBalanceDelta` di `server/operations.ts` | "Stok pecahan saat ini" di Kas & Persediaan selalu mencerminkan kondisi sebenarnya tanpa perlu menjumlah ulang seluruh riwayat mutasi. |
| Validasi stok sebelum jual | `createTransaction` menolak bon JUAL bila `cashBalances`/`cashDenominationBalances` mata uang tsb tidak mencukupi kebutuhan seluruh baris (dicek terhadap saldo saat ini, bukan draft lain yang belum selesai) | Tidak bisa membuat bon jual untuk mata uang yang belum (atau belum selesai) dibeli; pembelian dan penjualan mata uang yang sama di hari yang sama tetap bisa asalkan pembelian **diselesaikan** dulu. |
| Dua sisi transaksi tunai | `exchange_transaction_payment_denominations` menyimpan rincian pecahan Rupiah sisi pembayaran (wajib diisi bila `paymentMethod` CASH, direkonsiliasi terhadap `rupiahAmount` total bon). Saat bon **diselesaikan**, sisi ini diposting ke `cashBalances`/`cashDenominationBalances` untuk mata uang IDR dengan arah **berlawanan** dari sisi valuta asing (BELI: Rupiah keluar, valuta asing masuk; JUAL: Rupiah masuk, valuta asing keluar). | Stok Rupiah ikut berubah pada setiap bon tunai, bukan hanya stok valuta asing; bon BELI ditolak di `createTransaction` bila stok Rupiah tidak cukup untuk membayar nasabah. Transfer bank/lainnya tidak menyentuh stok fisik sama sekali. |
| Pecahan wajib di semua pergerakan kas | `recordOpeningCash`/`recordCashAdjustment` menolak permintaan tanpa `denominations` (tidak lagi opsional) | Kas awal dan penyesuaian brankas/off-hours selalu punya rincian pecahan; stok pecahan berjalan tidak pernah "bolong" karena input opsional yang dilewati. |
| Auto-isi & tukar pecahan | `suggestDenominationBreakdown` mengusulkan kombinasi pecahan nyata dari `cash_denomination_balances` saat ini (bounded knapsack, tidak pernah melebihi stok); bila komposisi belum pas, `suggestDenominationExchange`/`recordDenominationExchange` mencatat pertukaran pecahan senilai sama persis (mis. 1×100.000 → 1×50.000+2×20.000+2×5.000) lewat kategori baru `cash_balance_movements.category = 'DENOMINATION_EXCHANGE'` (migrasi `0024`) | `cashBalances.availableAmount` tidak pernah berubah oleh pertukaran (nilai total sama); hanya komposisi `cash_denomination_balances` yang bergerak, tetap tercatat sebagai dua movement (OUT lalu IN) beserta audit log, bukan tulisan senyap ke stok. |
| Pihak kuasa/wakil | `exchange_transactions.representativeCustomerId` merujuk nasabah terdaftar; `representativeName`/`representativeIdentityNumber` adalah snapshot otomatis dari nasabah tsb | Kuasa/wakil (termasuk BO) wajib didaftarkan sebagai nasabah sebelum dipilih di bon; tidak ada lagi input nama/identitas bebas. |
| Rincian pecahan | `exchange_transaction_denomination_entries` menyimpan nilai pecahan × jumlah lembar/keping per baris bon (`transactionLineId`), wajib rekonsiliasi dengan nominal valuta baris tsb bila diisi | Data pecahan tersedia untuk pelaporan stok fisik; tidak dicetak di kwitansi (kertas fisik hanya menampilkan ringkasan per baris). |
| Data latihan | Flag `isDemo` pada transaksi, nasabah, kurs, dan opname | Query produksi wajib mengecualikan data demo. |
| Data historis | Flag `isHistorical` dan `historicalSourceKey` | Catatan impor tidak dapat dipakai sebagai transaksi hidup. |
| Dokumen | Hanya metadata dan `storageKey` di `operational_documents` | Bytes dokumen berada di object storage, bukan kolom database. |
| Audit | `audit_logs` memakai before/after state JSON | Jangan menghapus bukti untuk memperbaiki tampilan. |
| Sesi | `sessionVersion` pada `users` | Reset sandi, perubahan peran/status mencabut sesi lama. |

## Status Workflow Utama

| Objek | Status yang tersedia | Catatan |
|---|---|---|
| Bon | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `COMPLETED`, `RETURNED`, `CANCELLED` | Hanya bon hidup `COMPLETED` dipakai LKU internal. |
| Stock opname | `OPEN`, `SUBMITTED`, `RECONCILED`, `VARIANCE` | Varians harus terlihat untuk review. |
| Paket pelaporan | `DRAFT`, `PREPARED`, `RETURNED`, `APPROVED`, `EXPORTED` | `EXPORTED` bukan bukti pengiriman regulator. |
| Insidental | `DRAFT`, `PREPARED`, `APPROVED`, `EXPORTED` | Kewajiban lapor tetap keputusan manusia. |
| Keluhan | `OPEN`, `IN_REVIEW`, `RESOLVED`, `ESCALATED_LAPS_BI` | Hasil penyelesaian perlu narasi dan penanggung jawab. |

## Prosedur Perubahan Skema

1. Ubah `drizzle/schema.ts` dan perbarui/ tulis test yang relevan.
2. Jalankan generator migrasi sesuai konfigurasi proyek, lalu **baca** SQL migrasi sebelum menerapkannya.
3. Terapkan migrasi hanya sekali pada lingkungan yang benar, setelah backup dan pemeriksaan dependensi.
4. Verifikasi tabel/indeks baru dengan query baca-saja.
5. Jalankan `pnpm test`, `pnpm check`, dan `pnpm build` sebelum rilis.

Jangan menjatuhkan tabel, menghapus audit, atau mengubah tipe nominal pada lingkungan produksi tanpa rencana rollback dan persetujuan perusahaan.
