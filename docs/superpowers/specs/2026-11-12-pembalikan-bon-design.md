# Pembalikan bon selesai — rancangan

Tanggal 12 November 2026 (WIB). Sumber: keputusan pemilik `docs/decisions/2026-11-12-pembalikan-bon-dan-pembulatan.md`
(boleh, CONTROLLER ke atas). Masalah hari ini: bon COMPLETED tidak bisa dikoreksi; satu-satunya jalan adalah
penyesuaian kas `OTHER` yang tidak dijurnal, sehingga stok, jurnal, LKU, dan goAML bercerita berbeda.

## Rancangan

1. **Status baru `REVERSED`** (migrasi `0063`, pelebaran enum `exchange_transactions.status` — aman; tanpa
   penyempitan) + kolom `reversedByUserId`, `reversedAt`, `reversalReason`. Semua pembaca yang menyaring
   `COMPLETED` (LKU, goAML LTKT/LTKM, rekap, posting jurnal, akumulasi ambang) otomatis tidak menghitungnya lagi.
2. **`reverseTransaction(id, alasan, aktor)`** — CONTROLLER ke atas, alasan wajib, satu transaksi basis data:
   - kunci baris bon (`FOR UPDATE`), wajib `COMPLETED`, belum dibalik;
   - setiap kaki dibalik dengan arah berlawanan, memakai rincian pecahan aslinya: valas
     (`exchange_transaction_denomination_entries`), Rupiah tunai (`exchange_transaction_payment_denominations`),
     atau rekening bank; lewat `applyCashMovement`/`applyDenominationBalanceDelta`, jadi stok tidak bisa minus
     (membalik BELI butuh lembar valasnya masih ada; membalik JUAL butuh Rupiah cukup);
   - mutasi kas berkategori baru `TRANSACTION_REVERSAL` (ikut pelebaran enum) dengan rujukan bon;
   - `stock_opnames` pembelian/penjualan dikurangi bila opname hari itu masih OPEN;
   - bila bon sudah dijurnal: jurnal balik (baris ditukar) bertanggal sama dengan jurnal aslinya,
     `sourceType` sama + rujukan `…-BALIK`;
   - jejak audit di dalam transaksi yang sama.
3. **Ditolak bila**: periode buku bulan bon sudah ditutup, atau paket LKU bulan itu sudah disiapkan/disetujui
   (laporan yang sudah ke BI tidak boleh berubah diam-diam) — *usulan, menunggu pemilik*.
4. **Layar**: tombol "Batalkan transaksi selesai" di detail bon untuk CONTROLLER ke atas, dialog alasan, status
   "Dibatalkan (dibalik)" di daftar dan kwitansi.

## Skenario uji (MySQL sungguhan, `*.live.test.ts`)
Kas awal → BELI USD tunai → balik → kas USD & IDR kembali ke awal, pecahan sama; JUAL → balik; balik BELI
sesudah lembar USD-nya terjual → ditolak; balik dua kali bersamaan → hanya satu; bon transfer bank; bon sudah
dijurnal → jurnal balik seimbang; STAFF/ADMIN ditolak; periode tutup → ditolak.

## Rollback
Migrasi hanya menambah nilai enum dan kolom nullable; kode lama tetap jalan. Mundur = kembalikan kode;
nilai `REVERSED`/`TRANSACTION_REVERSAL` yang sudah tertulis tetap sah dibaca sebagai "bukan COMPLETED".
