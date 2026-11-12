# Pembalikan bon selesai & pembulatan Rupiah

Tanggal: 12 November 2026 (WIB). Diputuskan pemilik di chat.

1. **Bon COMPLETED boleh dibalik, hanya oleh CONTROLLER ke atas.** Pembalikan harus membalik kedua kaki
   (valuta asing + Rupiah tunai/bank), stok pecahan, dan jurnalnya, dengan alasan dan jejak audit — bukan
   penyesuaian kas `OTHER` yang tidak dijurnal. Belum dibangun.
2. **Tidak ada fitur kembalian.** Kurs transaksi selalu angka bulat sehingga total Rupiah selalu bisa dibayar
   tunai pas. Bila sesekali hasilnya sulit dibayar, **dibulatkan ke atas**. Bawaan teknis: ke pecahan Rupiah
   terkecil yang dikenal aplikasi (Rp 100) — satuan lain (mis. Rp 1.000) bila pemilik meminta.
