# Rancangan Pusat Kesiapan dan Simulasi Aman

## Tujuan

Pusat ini membantu Supervisor melihat apakah outlet siap beroperasi tanpa harus berpindah-pindah halaman. Semua indikator hanya membaca data produksi yang telah ada. Tidak ada tombol pada halaman ini yang membuat transaksi, mengaktifkan kurs, mengubah kas, atau menyelesaikan checklist.

## Indikator kesiapan

| Area | Kondisi siap | Jika belum siap | Tujuan tindakan |
|---|---|---|---|
| Kurs outlet | Terdapat kurs aktif dan pembanding referensi tersedia | Kurs aktif atau pembanding belum tersedia | Kurs Operasional / Bandingkan Kurs |
| Kas | Minimal satu saldo kas tercatat | Kas pembukaan belum dicatat | Kas & Persediaan |
| Pembukaan | Semua checklist pembukaan tersimpan | Ada langkah/peralatan yang belum diselesaikan | Buka & Tutup Outlet |
| Pengawasan | Tidak ada review transaksi maupun pengakuan Direksi terbuka | Ada item yang membutuhkan penanganan | Monitoring / Direksi Mengetahui |
| Arsip penutupan | Checklist tutup selesai serta dapat dibuatkan PDF | Penutupan belum disimpan | Buka & Tutup Outlet |

## Rangkaian simulasi aman

| Skenario | Input pengguna | Hasil | Proteksi |
|---|---|---|---|
| Perhitungan bon | Nominal, kurs, unit kuotasi | Nilai Rupiah latihan | Tidak membuat nasabah, bon, atau saldo kas |
| Guncangan kurs | Nilai referensi, harga usulan, ambang persen | Selisih dan status normal/perlu review | Tidak membuat observasi atau mengaktifkan kurs |
| Penutupan kas | Saldo sistem dan hitung fisik | Varians serta status latihan | Tidak membuat stock opname atau rekonsiliasi |
| Kelayakan arsip | Status checklist dan stock opname latihan | Siap/belum siap cetak latihan | Tidak membuat dokumen operasional |

Setiap keluaran simulasi membawa penanda `isSimulation: true` dan diuji agar tidak muncul pada daftar bon, laporan, atau arsip produksi.
