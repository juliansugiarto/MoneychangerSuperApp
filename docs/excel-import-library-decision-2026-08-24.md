# Keputusan Pustaka Impor Excel — 24 Agustus 2026

Untuk layar impor yang memerlukan pratinjau dan validasi sebelum data diproses, aplikasi akan memakai **`read-excel-file`**. Pustaka ini mendukung pembacaan `.xlsx` di browser dan Node.js, serta memetakan baris ke JSON berdasarkan skema sehingga kolom yang salah atau nilai yang tidak valid dapat diberi tahu sebelum pengiriman ke server.

| Kandidat | Kekuatan | Keputusan |
| --- | --- | --- |
| [SheetJS Community Edition](https://github.com/SheetJS/sheetjs) | Pustaka spreadsheet berpengalaman dengan cakupan format luas dan lisensi Apache-2.0. | Tidak dipilih untuk alur awal karena kebutuhan utama aplikasi adalah validasi data yang ketat, bukan manipulasi workbook kompleks. |
| [read-excel-file](https://github.com/catamphetamine/read-excel-file) | Mendukung pembacaan XLSX di browser/Node dan parsing ke JSON dengan skema kolom. Dokumentasi serta aktivitas repository terkini mendukung kebutuhan validasi awal. | Dipilih untuk pratinjau file, pemeriksaan header, pemetaan kolom, dan error per baris sebelum konfirmasi impor. |

File impor hanya dibaca untuk membuat pratinjau dan daftar error. Server tetap memvalidasi ulang setiap baris yang boleh diproses. File yang berisi data historis tidak boleh membuat transaksi live, memperbarui kas, atau melewati kontrol audit.
