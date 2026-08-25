# Rencana Implementasi MVP — Ibukota Valasindo

**Status:** Menunggu persetujuan sebelum implementasi kode dimulai.

> **Catatan kepatuhan:** Saya bukan penasihat hukum. Rancangan ini membangun kontrol operasional untuk mendukung KYC/CDD, pemantauan transaksi, dan auditabilitas; kebijakan, threshold, retensi data, serta kecocokan terhadap regulasi yang berlaku tetap perlu diverifikasi oleh PIC kepatuhan dan penasihat hukum yang berwenang sebelum digunakan secara produksi.

## 1. Pemahaman aplikasi

Sistem ini adalah aplikasi back-office internal PT IBU KOTA VALASINDO untuk mengelola operasional jual-beli valuta asing secara terkontrol. Sistem akan menggunakan identitas pengguna dan role untuk membatasi akses teller, supervisor, director, dan administrator di antarmuka maupun backend. Master mata uang, kurs beli/jual, dan data customer KYC/CDD akan menjadi fondasi perekaman transaksi. Setiap transaksi menyimpan snapshot kurs sehingga riwayat nilai transaksi tidak berubah ketika master kurs diperbarui. Transaksi dengan nilai ekuivalen tinggi atau data profil yang belum memadai akan menghasilkan review flag untuk diperiksa manusia, bukan keputusan otomatis. Hanya transaksi yang melewati alur persetujuan dapat memperbarui saldo kas, dan pembaruan tersebut dilakukan secara atomik. Stock opname, laporan cetak, serta audit log akan menyediakan kontrol rekonsiliasi dan penelusuran perubahan.

## 2. Asumsi dan batasan MVP

| Area | Keputusan atau asumsi awal | Status |
| --- | --- | --- |
| Platform | Aplikasi memakai scaffold yang telah tersedia: React 19, TypeScript, Tailwind 4, Express, tRPC, Drizzle, dan database MySQL/TiDB terkelola. Ini menggantikan usulan SQLite/REST di dokumen awal agar konsisten dengan fondasi proyek nyata. | Dipilih dari scaffold |
| Autentikasi | Sesi menggunakan OAuth bawaan scaffold dan cookie `httpOnly`; role operasional disimpan pada user dan diperiksa dalam semua prosedur terproteksi. Tidak ada password bawaan atau token pada source code. | Direkomendasikan |
| Scope MVP | Fokus pada satu entitas perusahaan dan satu lokasi operasional; multi-cabang, integrasi bank/PPATK/BI, pembayaran daring, sinkronisasi eksternal, dan aplikasi native ditunda. | Sesuai sumber proyek |
| Ketelitian nominal | Nominal valuta, rate, dan Rupiah menggunakan tipe `DECIMAL`, tidak pernah JavaScript floating point. Usulan awal: valuta `DECIMAL(24,6)`, rate `DECIMAL(24,8)`, dan Rupiah `DECIMAL(24,2)` dengan kebijakan pembulatan yang akan dikonfirmasi. | Perlu konfirmasi kebijakan pembulatan |
| Threshold | Nilai awal review adalah ekuivalen USD 10.000, tersimpan pada tabel pengaturan dan dapat diubah ADMIN/DIRECTOR. Threshold hanya memicu pemeriksaan, bukan penilaian hukum otomatis. | Dipilih dari kebutuhan |
| Seed data | Mata uang awal dapat meliputi USD, AED, SAR, SGD, MYR, AUD, dan JPY. Tidak akan ada data KYC pelanggan nyata; setiap data contoh diberi label DEMO. | Dipilih dari sumber proyek |
| Laporan | Laporan harian, bulanan, dan stock opname dirancang untuk cetak melalui print stylesheet terlebih dahulu. Ekspor file kompleks tidak termasuk MVP. | Dipilih dari sumber proyek |

## 3. Fitur MVP

| Prioritas | Modul | Fitur | Role utama | Kriteria selesai |
| --- | --- | --- | --- | --- |
| Wajib | Akses dan user | Role TELLER, SUPERVISOR, DIRECTOR, ADMIN; session `httpOnly`; pemeriksaan role di setiap prosedur backend | Semua; ADMIN mengelola role | Akses yang tidak sah ditolak backend dan navigasi hanya menampilkan fungsi yang diizinkan |
| Wajib | Mata uang dan kurs | Mata uang aktif/nonaktif, kurs BUY/SELL, tanggal efektif, status, riwayat perubahan, pembuat/pengubah | ADMIN; kurs dapat dilihat role terkait | Kurs aktif dapat dipilih; kurs historis tidak diubah dan transaksi mempertahankan snapshot |
| Wajib | Customer KYC/CDD | CIF, identitas, lahir, alamat, pekerjaan, sumber dana, tujuan transaksi, status profil, tanggal pengkinian, serta catatan risiko | TELLER input; SUPERVISOR/ADMIN kelola | Customer tervalidasi dan status kelengkapan profil terlihat sebelum transaksi |
| Wajib | Transaksi | BUY/SELL, nomor unik, customer, teller, mata uang, nominal valuta, kurs snapshot, nilai Rupiah, metode bayar, status, pembatalan beralasan | TELLER buat; SUPERVISOR/DIRECTOR review | Tidak memakai float; status lifecycle terkendali; transaksi selesai tidak dapat dihapus |
| Wajib | Review dan approval | Flag nilai threshold/profil, status review, alasan, catatan reviewer, approval atau return, identitas dan waktu reviewer | SUPERVISOR, DIRECTOR | Flag terbentuk konsisten; seluruh aksi review tercatat |
| Wajib | Kas dan stock opname | Saldo per mata uang, mutasi yang terikat transaksi, opname harian, fisik, selisih, rekonsiliasi, catatan variance | TELLER input; SUPERVISOR review | Transaksi approved memutakhirkan saldo atomik; variance tampak jelas |
| Wajib | Dashboard dan laporan | Ringkasan transaksi hari ini, pending review, saldo kas, peringatan variance, laporan harian/bulanan dan stock opname dengan mode cetak | Role sesuai hak akses | Data dashboard konsisten dengan sumber transaksi dan laporan siap cetak |
| Wajib | Audit log | Log perubahan master, transaksi, approval, pembatalan, kas, opname, dan pengaturan penting | ADMIN/DIRECTOR lihat; sistem menulis | Aktor, waktu, aksi, entitas, dan perubahan relevan dapat ditelusuri |
| Ditunda | Integrasi eksternal | Bank, PPATK/BI, pembayaran daring, sinkronisasi cloud, keputusan berbasis AI | — | Tidak termasuk MVP |
| Ditunda | Organisasi lanjutan | Multi-cabang, workflow lintas cabang, serta ekspor PDF/Excel kompleks | — | Tidak termasuk MVP |

## 4. Rekomendasi arsitektur

Antarmuka menggunakan React dan Tailwind dengan pola dashboard internal ber-sidebar. Identitas visual mengikuti kwitansi sumber: **navy/royal blue** sebagai warna utama, **hijau** untuk aksi/status positif, latar terang, serta bentuk watermark geometris halus. Navigasi mencakup Dashboard, Transaksi, Customer, Kurs, Kas, Stock Opname, Laporan, Review, Audit Log, dan Pengaturan; item akan difilter berdasarkan role.

Backend menggunakan tRPC yang telah tersedia, bukan REST baru. Setiap tRPC procedure menerima konteks pengguna yang dibuat dari cookie sesi `httpOnly`, lalu mewajibkan helper role seperti `tellerProcedure`, `supervisorProcedure`, `directorProcedure`, dan `adminProcedure`. Validasi input dilakukan dengan Zod di server; antarmuka hanya menambahkan validasi untuk pengalaman pengguna dan tidak menjadi sumber kebenaran.

Database memakai Drizzle dan MySQL/TiDB yang disediakan scaffold. Struktur akan menjaga foreign key, indeks pencarian, timestamp UTC, serta `DECIMAL` untuk semua nilai keuangan. Operasi yang menyetujui transaksi dan mengubah saldo kas akan dijalankan dalam database transaction dengan mekanisme pengaman terhadap pemrosesan ulang. Catatan perubahan bisnis akan dicatat melalui service audit log agar log tidak tersebar atau mudah terlewat.

## 5. Rancangan data inti

| Entitas | Fungsi dan field inti |
| --- | --- |
| `users` | Memperluas user bawaan dengan role operasional `TELLER`, `SUPERVISOR`, `DIRECTOR`, `ADMIN`, status aktif, serta metadata session bawaan. Password tidak disimpan karena sesi memakai OAuth scaffold. |
| `currencies` | Menyimpan `code`, `name`, `isActive`, `decimalScale`, dan metadata audit. Kode mata uang unik dan tidak di-hardcode di UI. |
| `exchangeRates` | Riwayat kurs `BUY`/`SELL`: currency, rate decimal, effective date/time, status aktif, dibuat/diubah oleh user, dan alasan perubahan. Rate yang terkait transaksi tidak dapat dihapus secara sembarang. |
| `customers` | Menyimpan CIF, nama, jenis/nomor identitas, tempat/tanggal lahir, alamat, pekerjaan/jabatan/perusahaan, sumber dana, tujuan transaksi, status profil, tanggal pengkinian, dan catatan risiko. |
| `transactions` | Menyimpan nomor unik, waktu transaksi UTC, customer, teller, BUY/SELL, currency, foreign amount decimal, `rateSnapshot`, `rupiahAmount`, metode bayar, customer reference snapshot, status, status review, serta metadata pembatalan. |
| `reviewFlags` | Menyimpan transaksi, tipe/alasannya, status `NOT_REVIEWED`/`NEEDS_REVIEW`/`REVIEWED`/`ESCALATED`, catatan reviewer, reviewer, dan waktu review. |
| `approvals` | Riwayat aksi supervisor/director untuk transaksi: aksi approve/return/cancel, aktor, waktu, alasan, dan state sebelum/sesudah. |
| `cashBalances` | Saldo per currency dan lokasi/entitas operasional MVP, bernilai decimal serta memiliki waktu pembaruan terakhir. Perubahan berasal dari mutasi yang tervalidasi. |
| `cashMovements` | Buku besar mutasi kas immutable dari transaksi approved, penyesuaian yang disetujui, dan koreksi sah. Menjadi dasar perhitungan saldo/opname. |
| `stockOpnames` | Header opname harian: tanggal, currency, opening system, buy, sell, adjustment, closing system, physical count, variance, status rekonsiliasi, teller, reviewer, dan catatan selisih. |
| `settings` | Pengaturan tunggal atau key-value terkontrol, termasuk threshold ekuivalen USD, aturan pembulatan yang disetujui, dan parameter operasional yang dapat diubah role berwenang. |
| `auditLogs` | Jejak append-only untuk aksi penting: aktor, aksi, entitas, ID entitas, ringkasan perubahan yang aman, timestamp, serta alasan bila diperlukan. Data KYC sensitif tidak akan ditulis lengkap ke log. |

## 6. Alur bisnis utama

Pengguna melakukan sign-in melalui autentikasi scaffold, kemudian backend mengambil role dari user aktif sebelum menjalankan procedure. Teller dapat membuat atau memilih customer dan melengkapi KYC/CDD yang diperlukan. Saat teller mencatat transaksi, backend memilih rate aktif dan langsung menyimpannya sebagai snapshot bersama nominal valuta dan hasil nilai Rupiah dari operasi decimal.

Backend membandingkan transaksi terhadap threshold pada `settings` dan aturan kelengkapan/profil yang disepakati. Jika diperlukan, sistem membuat review flag dengan alasan eksplisit dan mengalihkan transaksi ke `PENDING_REVIEW`. Supervisor atau director mencatat keputusan approve atau return beserta waktu dan catatan; setiap aksi masuk ke approval history dan audit log.

Ketika transaksi disetujui untuk diselesaikan, backend menjalankan satu database transaction untuk memvalidasi status terkini, menambahkan cash movement, memperbarui cash balance currency bersangkutan, menandai status transaksi `COMPLETED`, dan menulis audit log. Pembatalan transaksi hanya tersedia melalui tindakan beralasan yang dicatat; catatan historis tidak dihapus. Pada stock opname, sistem mengambil saldo sistem dari ledger, teller mencatat saldo fisik, lalu supervisor dapat merekonsiliasi atau mengembalikan data untuk koreksi.

## 7. Rancangan halaman dan hak akses

| Halaman | Tujuan | Data utama | Role akses |
| --- | --- | --- | --- |
| Dashboard | Memantau aktivitas hari ini, pending review, kas, dan variance | KPI transaksi, saldo kas, daftar perhatian | Semua sesuai data yang diizinkan |
| Transaksi baru | Merekam BUY/SELL dengan snapshot rate | Customer, rate aktif, perhitungan decimal, review indikator | TELLER, SUPERVISOR, ADMIN |
| Daftar transaksi | Menelusuri, memfilter, melihat detail, dan meminta pembatalan | Status, review, nilai, teller, audit trail ringkas | TELLER hanya miliknya; SUPERVISOR/DIRECTOR/ADMIN sesuai kewenangan |
| Review transaksi | Memproses flag dan approval/return | Flag, profil customer, catatan, approval history | SUPERVISOR, DIRECTOR, ADMIN terbatas |
| Customer | Mengelola data KYC/CDD dan status kelengkapan | CIF dan profil customer | TELLER, SUPERVISOR, ADMIN |
| Mata uang dan kurs | Mengelola daftar currency serta riwayat rate | Currency, buy/sell rate, effective time, history | ADMIN; baca sesuai kebutuhan operasional |
| Kas | Memantau saldo dan mutasi per currency | Saldo, buku mutasi, transaksi terkait | TELLER baca/input terbatas; SUPERVISOR/DIRECTOR/ADMIN sesuai kewenangan |
| Stock opname | Input dan review rekonsiliasi harian | Sistem, fisik, variance, catatan | TELLER input; SUPERVISOR review; DIRECTOR/ADMIN lihat |
| Laporan | Mencetak laporan transaksi dan opname | Filter periode/currency/status dan hasil cetak | SUPERVISOR, DIRECTOR, ADMIN |
| Audit log dan pengaturan | Menelusuri perubahan dan mengatur parameter | Audit entries, threshold, user role | DIRECTOR/ADMIN sesuai batasan |

## 8. Kontrak backend awal

| Domain | Procedure utama | Proteksi dan validasi |
| --- | --- | --- |
| Authz | `auth.me`, helper role procedure | Sesi `httpOnly`; setiap aksi bisnis wajib `protectedProcedure` + role check |
| Currency | `currency.list`, `currency.create`, `currency.updateStatus` | ADMIN untuk mutasi; code unik dan valid |
| Rate | `rate.list`, `rate.create`, `rate.activate`, `rate.history` | ADMIN untuk mutasi; rate decimal positif, currency aktif, waktu efektif valid |
| Customer | `customer.list`, `customer.get`, `customer.create`, `customer.update` | TELLER/SUPERVISOR/ADMIN; validasi CIF dan field KYC sensitif |
| Transaction | `transaction.quote`, `transaction.createDraft`, `transaction.submit`, `transaction.list`, `transaction.get`, `transaction.cancel` | TELLER sesuai kepemilikan; decimal string tervalidasi; snapshot dibuat server; cancel memerlukan alasan |
| Review | `review.listPending`, `review.decide`, `review.escalate` | SUPERVISOR/DIRECTOR; keputusan, catatan, dan state transition tervalidasi |
| Cash | `cash.listBalances`, `cash.listMovements` | Akses berbasis role; mutasi tidak dibuat langsung dari klien |
| Opname | `stockOpname.list`, `stockOpname.create`, `stockOpname.submit`, `stockOpname.reconcile` | Teller input; supervisor reconcile; nilai decimal dan tanggal valid |
| Reporting | `report.transactions`, `report.stockOpnames`, `report.dashboard` | Filter tervalidasi dan pembatasan data per role |
| Settings/Audit | `settings.get`, `settings.update`, `audit.list` | DIRECTOR/ADMIN untuk perubahan; audit akan tersimpan oleh service internal |

## 9. Rencana implementasi bertahap

| Tahap | Tujuan | File/folder utama | Pengujian dan kriteria selesai |
| --- | --- | --- | --- |
| 1 | Menetapkan rencana dan inventaris scaffold | `implementation-plan.md`, `todo.md` | Kebutuhan disetujui dan keputusan terbuka ditetapkan |
| 2 | Menyusun shell aplikasi, tema, dan navigasi internal | `client/src/App.tsx`, `client/src/index.css`, `client/src/pages/*`, evaluasi `DashboardLayout.tsx` | Rute dan layout responsif dapat dibuka; navigasi sesuai role placeholder |
| 3 | Menambahkan skema data, peran, authz helper, dan audit service | `drizzle/schema.ts`, migration, `server/db.ts`, `server/routers.ts`, test server | Migrasi diterapkan; role backend dan audit dasar diuji |
| 4 | Mengimplementasikan master currency/rate/customer dan UI terkait | router/domain files, page master data, tests | Validasi server, history rate, KYC profile, dan akses role diuji |
| 5 | Mengimplementasikan transaksi BUY/SELL, review flags, approval, dan cash ledger atomik | router transaksi/review, database helpers, pages, tests | Snapshot immutable, lifecycle, cancellation audit, dan cash update atomik diuji |
| 6 | Mengimplementasikan stock opname, dashboard, laporan cetak, serta audit viewer | page dashboard/kas/opname/report/audit, print CSS, tests | Variance tampak, laporan dapat dicetak, dashboard konsisten |
| 7 | Verifikasi UI, regresi, dan checkpoint pertama | Vitest, preview desktop/mobile, `todo.md` | Test lulus, UI ditinjau, dan daftar kerja seluruhnya akurat |

## 10. Keamanan dan integritas data

Sesi aplikasi mengikuti mekanisme cookie `httpOnly` dari scaffold; source code tidak akan menyimpan password, token, atau API key. Otorisasi akan dilakukan pada setiap procedure backend, bukan hanya menyembunyikan tombol. Input akan divalidasi dengan Zod dan database diakses melalui Drizzle/parameterized query. Informasi identitas pelanggan hanya dikembalikan pada halaman yang berhak dan tidak akan dicantumkan secara lengkap dalam error response maupun audit log.

Nilai keuangan menggunakan `DECIMAL` di database dan string decimal tervalidasi saat diterima oleh backend. Snapshot rate dan nilai transaksi diperlakukan sebagai immutable setelah record tercipta; pembetulan dilakukan melalui pembatalan/rekam transaksi baru yang tertaut dan beralasan. Approval penyelesaian menggunakan transaksi database untuk menghindari saldo kas berubah sebagian. Pengaturan threshold hanya dapat diubah oleh role berwenang dan perubahannya diaudit. Backup dan retensi data produksi memerlukan prosedur operasional terpisah yang perlu ditentukan pemilik sistem sebelum go-live.

## 11. Keputusan yang perlu dikonfirmasi

1. Apakah kita memakai **OAuth bawaan scaffold** sebagai login internal pada MVP, dengan ADMIN menetapkan role pengguna setelah akun pertama kali masuk? Ini adalah pilihan yang paling selaras dengan fondasi proyek dan tetap memakai cookie `httpOnly`.
2. Apa kebijakan pembulatan resmi untuk perhitungan Rupiah: dibulatkan ke **rupiah penuh**, dua digit desimal, atau mengikuti aturan berbeda per mata uang/transaksi?
3. Apakah SUPERVISOR boleh menyelesaikan seluruh transaksi `NEEDS_REVIEW`, sementara DIRECTOR hanya menangani `ESCALATED`/variance tertentu, atau DIRECTOR harus ikut menyetujui setiap transaksi di atas threshold?
4. Untuk rule profil mismatch di MVP, apakah sistem cukup memeriksa data wajib belum lengkap dan profil belum diperbarui, atau ada indikator internal lain yang ingin langsung diterapkan?
5. Apakah alamat dan nomor telepon pada kwitansi akan digunakan sebagai identitas operasional di tampilan/laporan cetak, dan apakah ada file logo resmi terpisah yang dapat digunakan?
