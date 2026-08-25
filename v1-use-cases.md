# Matriks Validasi V1 — PT IBU KOTA VALASINDO

Dokumen ini mendefinisikan kriteria penerimaan fungsional untuk V1. Data yang dipakai oleh pengujian otomatis menggunakan penanda `TEST-V1-` dan berjalan di fixture memori atau mock terisolasi. Pengujian **tidak boleh** menulis, memodifikasi, atau menghapus data pada database operasional.

| ID | Aktor / data uji | Skenario | Hasil yang wajib dibuktikan |
| --- | --- | --- | --- |
| RBAC-01 | TELLER | Membuka transaksi, nasabah, dan stock opname. | Hanya data/aksi yang diizinkan untuk Teller tersedia. |
| RBAC-02 | SUPERVISOR | Membuka kurs dan meninjau transaksi flagged. | Dapat mengajukan atau menyetujui sesuai hak backend; tidak dapat mengubah pengaturan ADMIN. |
| RBAC-03 | DIRECTOR | Membuka laporan. | Laporan dapat dibaca; pengaturan sistem tetap dibatasi. |
| RBAC-04 | ADMIN | Membuka seluruh modul dan pengaturan ambang review. | Endpoint dan rute menerima akses sesuai peran. |
| CUR-01 | `TEST-V1-USD`, `TEST-V1-JPY` | Membuat atau menonaktifkan mata uang. | Kode mata uang unik; perubahan status menghasilkan audit log. |
| RATE-01 | Snapshot BI dummy JPY per 100 unit | Membuat proposal kurs, lalu mengaktifkannya. | Rate aktif sebelumnya pensiun; proposal menjadi ACTIVE dan audit dicatat. |
| RATE-02 | Kurs aktif USD dan JPY | Membuat transaksi. | Nilai kurs serta unit kuotasi tersimpan sebagai snapshot immutable pada transaksi. |
| KYC-01 | `TEST-V1-CIF-001` | Membuat nasabah dengan KTP, alamat, sumber dana, dan tujuan transaksi. | CIF serta identitas unik; profil dan pembuat terekam. |
| TX-01 | Nasabah risiko LOW, BUY USD | Membuat dan mengirim transaksi di bawah ambang. | DRAFT berubah ke APPROVED tanpa review; nilai Rupiah dihitung secara desimal. |
| TX-02 | Nasabah risiko HIGH atau nilai setara ≥ USD 10.000 | Mengirim transaksi. | Status menjadi PENDING_REVIEW dengan alasan review yang dapat diaudit. |
| TX-03 | SUPERVISOR/DIRECTOR | Menyetujui, mengembalikan, atau mengeskalasi transaksi flagged. | Aktor, waktu, catatan, dan tindakan review tersimpan. |
| TX-04 | Transaksi DRAFT dan COMPLETED | Membatalkan transaksi. | DRAFT dapat dibatalkan dengan alasan; COMPLETED ditolak. |
| CASH-01 | Transaksi BUY dan SELL yang disetujui | Menyelesaikan transaksi. | Saldo dan mutasi kas berubah atomik tepat satu kali per transaksi. |
| OPN-01 | Opname TEST-V1-USD | Membuka, memasukkan saldo fisik, dan merekonsiliasi. | Varians dan status RECONCILED/VARIANCE dihitung serta dicatat. |
| REP-01 | Data uji transaksi/opname | Membuka laporan dan audit log. | Hasil dibatasi periode, dapat dicetak, dan kegagalan koneksi read-only diberi satu retry. |
| RES-01 | Simulasi `EAI_AGAIN` | Membaca daftar pelanggan, transaksi, kas, kurs, dan laporan. | Query baca melakukan satu retry; operasi tulis tidak pernah diulang otomatis. |

## Batas Kelayakan V1

V1 dianggap layak untuk uji penerimaan bila seluruh skenario di atas memiliki pengujian atau bukti manual yang lulus, tidak ada operasi tulis yang diulang otomatis, kurs transaksi bersifat immutable, dan setiap pembatalan atau approval dapat ditelusuri melalui audit log. Skenario yang tergantung pada akun nyata atau koneksi database produksi tetap memerlukan konfirmasi pengguna dengan peran yang sesuai setelah uji otomatis selesai.
