# Pemetaan Bon Transaksi Sumber

Sumber utama: `KWITANSI IBUKOTA VALASINDO.pdf`, dokumen proyek bersama, halaman tunggal yang memuat **Kwitansi Jual** dan **Kwitansi Beli**.

| Bagian formulir | Field yang harus tersedia pada Draft Transaksi / cetak |
|---|---|
| Identitas bon | Nomor bon, tanggal, jenis transaksi (jual atau beli) |
| Identitas nasabah | Nama, nomor KTP/Paspor, nomor HP, alamat |
| Keperluan transaksi | Sumber dana dan tujuan transaksi |
| Detail valuta | Nomor baris, mata uang, jumlah valuta, kurs, total nilai konversi |
| Ringkasan | Jumlah total / total amount |
| Pernyataan | Pemberitahuan penukaran uang, ketentuan pengisian untuk nominal ekuivalen USD 10.000 atau lebih, serta persetujuan ketelitian nominal |
| Pengesahan | Area Teller dan Nasabah untuk tanda tangan |

Dokumen cetak aplikasi harus menggunakan istilah tersebut, memisahkan versi **Jual** dan **Beli**, serta tidak menampilkan foto KTP atau dokumen underlying pada bon.

## Parameter Dokumen dan Pengawasan

Sumber tambahan: `FORM PARAMETER LTKT DAN LTKM.pdf`.

| Kebutuhan operasional | Data/form yang perlu didukung |
|---|---|
| LTKT transaksi tunai | Nomor bon sebagai referensi, tanggal transaksi, identitas lengkap nasabah, kewarganegaraan, pekerjaan/bidang usaha, sumber dana, valuta, nominal valuta, kurs, dan nilai Rupiah |
| Pihak yang bertindak | Indikator transaksi sendiri atau kuasa, serta identitas dan hubungan kuasa bila ada |
| Underlying | Dokumen pendukung transaksi yang diunggah dengan jenis dokumen, nomor/keterangan, dan catatan verifikasi staf |
| LTKM | Indikator serta narasi harus tetap menjadi telaah manusia oleh peran berwenang; aplikasi hanya menyimpan data dan jejak audit, bukan membuat penetapan otomatis |

Ambang LTKT yang tercantum pada formulir sumber adalah transaksi tunai setara atau lebih dari **Rp500 juta** dalam satu hari kerja. Implementasi akan memperlakukannya sebagai indikator pengawasan dan kebutuhan kelengkapan data, bukan pengiriman laporan otomatis.
