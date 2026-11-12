# KupvaBB App — rancangan pembangunan ulang

12 November 2026 (WIB). Status: **rancangan, menunggu persetujuan pemilik.** Belum ada kode ditulis.
Dokumen ini dipindah ke repo baru `KupvaBB-App` sebagai dokumen pendirinya.

## 1. Maksud dan alasan

Aplikasi back office + halaman publik untuk penyelenggara **KUPVA bukan bank** (money changer berizin BI), pertama untuk
PT Ibukota Valasindo (Cianjur), lalu dapat dipasang untuk KUPVA lain (white-label, satu deployment per perusahaan).

Aplikasi ini lahir dari **pemeriksaan Bank Indonesia 29 Juni–2 Juli 2026** (12 temuan, §4). Ia bukan sekadar pencatat
transaksi, melainkan **sistem yang menutup temuan pemeriksaan BI dan tahan diperiksa ulang**. Menurut pemilik, BI akan
memeriksa setiap aplikasi yang dipakai KUPVA (lewat tim TI-nya) sebelum boleh dipakai; tidak ada pedoman tertulis, tetapi
yang terdengar: **data harus sangat aman**.

Mengapa dibangun ulang dan tidak diteruskan (`MoneychangerSuperApp`): kodenya berantakan (`server/operations.ts` 3.963
baris dengan 132 fungsi, `routers.ts` 1.529 baris, 25 berkas > 400 baris, ±49 ribu baris), dan fondasinya tipis: perubahan
uang berupa perubahan status baris, tidak ada sistem pengajuan–persetujuan, sedikit penjaga di basis data. Akibat nyata
yang ditemukan 12 Nov 2026: gerbang blokir DTTOT hanya di pembuatan bon (bon draf masih bisa diselesaikan sesudah nasabah
diblokir), dan pembatalan transaksi tanpa langkah persetujuan. **Produksi kosong** (0 nasabah, 0 transaksi, 0 kurs, 1
pengguna), jadi sekaranglah saat termurah berpindah fondasi: tidak ada data untuk dimigrasi.

Yang dibangun ulang adalah **kodenya**, bukan pengetahuannya. Seluruh aturan bisnis dan regulasi yang sudah diputuskan di
repo lama (spec, keputusan, panduan A–Z, memori, 1.882 uji) menjadi **persyaratan**; aplikasi lama tidak dipakai sebagai
sumber kode.

## 2. Sasaran, bukan sasaran, anti-sasaran

**Sasaran**
1. **Paritas penuh** dengan seluruh fitur aplikasi lama (§6), tanpa pengecualian. Pemilik: *"everything must work
   flawlessly, this is no joke."* Tidak ada peluncuran sebagian.
2. Setiap aturan regulasi **dapat ditelusuri**: aturan → sumber (PBI/PADG/SE/keputusan pemilik) → kode yang menegakkan →
   uji yang membuktikan (§8).
3. Keamanan data yang dapat dibuktikan kepada tim TI BI (§7).
4. Kode presisi dan bersih: fitur per folder, aturan di satu tempat, berkas ≤ ~400 baris, tidak ada kode mati, tidak ada
   salinan logika (aturan mesin `clean-code`).
5. Mengganti aplikasi lama di VPS setelah seluruhnya selesai dan terbukti (§10).

**Bukan sasaran (sekarang)**
- Multi-tenant bersama (SaaS satu basis data). Keputusan 12 Nov 2026: satu perusahaan per deployment.
- Aplikasi desktop/luring Windows (dicabut 12 Nov 2026).
- Pengiriman otomatis ke regulator (dilarang; laporan disiapkan, disetujui, diekspor, dikirim manual).
- Aktivasi kurs otomatis (dilarang; selalu manual dengan alasan).

**Anti-sasaran (gagal walau "jalan")**
- Satu angka uang yang dihitung dengan float, atau satu tanggal yang memakai zona waktu perangkat.
- Satu jalur yang menegakkan aturan dan jalur lain yang lupa (pelajaran gerbang blokir).
- Data nasabah (KTP, NIK) muncul di log, URL, ekspor, atau tangkapan layar.
- Fitur yang tampil tetapi tidak punya penulis datanya ("nilainya selalu nol").
- Menebak fakta regulasi, tanggal, atau kebijakan pemilik.

## 3. Pengguna dan peran

Nama peran memakai istilah perusahaan (pemilik, 12 Nov 2026):

| Peran di aplikasi | Arti | Padanan aplikasi lama (dugaan Claude, untuk paritas hak) |
|---|---|---|
| **Pelaksana** | teller di konter | STAFF |
| **Penyelia** | supervisor, mengawasi konter dan meninjau bon | ADMIN |
| **Direksi** | menyetujui laporan dan semua berkas pelaporan/perusahaan | CONTROLLER |
| **Komisaris** | pengawas; persetujuan tertinggi | SHAREHOLDER |

Matriks hak per tindakan diturunkan dari aplikasi lama (inventaris `routers.ts`), lalu diperiksa ulang pemilik. Aturan
yang tetap: maker ≠ checker pada bon; Direksi menyiapkan paket regulator, Komisaris lain menyetujui; hanya Komisaris yang
membuat Direksi; persetujuan nasabah risiko tinggi oleh Komisaris.

## 4. Temuan pemeriksaan BI sebagai uji penerimaan

Sumber: Matriks Hasil Pemeriksaan 2 Juli 2026 (artifact pemetaan sesi 3 Sep 2026). Setiap baris menjadi uji penerimaan
eksplisit (layar + aturan + uji).

| No | Temuan | Ditutup oleh |
|---|---|---|
| 1 | Alamat NIB / KBLI tidak sesuai | bukan perangkat lunak |
| 2 | Tidak ada dokumen kepegawaian, rekrutmen, pemantauan profil pegawai | modul SDM: pegawai, kontrak, telaah profil 6 bulanan |
| 3 | Dokumen perusahaan tidak ditatausahakan | arsip dokumen berversi + retensi |
| 4 | Nota tidak sesuai standar / tanpa identitas KUPVA | nota per SE BI 18/42 G.1, identitas dari profil |
| 5 | Catatan internal ≠ LKPBU | LKU dihasilkan dari buku besar |
| 6 | Opname hanya UKA yang ditransaksikan, tanpa brankas dan Rupiah | opname semua valuta + Rupiah, laci + brankas, per pecahan |
| 7.1 | Tidak ada buku besar sebagai dasar pos laporan keuangan | buku besar berpasangan, laporan dihasilkan darinya |
| 7.2–7.4 | Kas bank, kas UKA, modal disetor salah | pemeriksaan silang terhadap rekening koran, LKU, akta |
| 8 | Kebijakan APU-PPT belum ditandatangani; pelaporan LTKM/LTKT ke Direksi–Komisaris tak terdokumentasi | "Untuk Diketahui Direksi" + jejak pelaporan |
| 9 | Data nasabah tanpa profil transaksi, pekerjaan, tujuan, sumber dana, PEP | KYC lengkap + profil yang dinyatakan |
| 10 | Tidak ada pemantauan profil transaksi berkala | pemantauan profil (bulanan/3 bulan/tahunan per risiko) |
| 11 | Penilaian risiko TPPU/TPPT tak terdokumentasi | IRA + klasifikasi risiko |
| 12 | Tidak ada penyaringan calon pegawai dan pemantauan profil pegawai | kandidat disaring daftar terduga + telaah profil |

## 5. Alur harian (pemilik, 12 Nov 2026)

1. **Pagi — cek stok otomatis.** Stok pembuka = hasil hitung penutupan kemarin; Pelaksana mengonfirmasi atau mencatat
   selisih (bukan menghitung ulang dari nol). *Dugaan Claude, perlu konfirmasi:* konfirmasi per valuta, bukan per pecahan.
2. **Kas awal** untuk jual-beli valas, dan semua pemasukan/pengeluaran lain dicatat.
3. **Kurs dari mitra + margin.** Mitra (Smartdeal Puncak) mengirim "HARGA PEMBUKAAN" tiap pagi (gambar WhatsApp ±40
   valuta, beli/jual, sebagian per pecahan: SAR500/100/50/10/5/1 dengan beli sama dan jual berbeda; SGD dan "SGDB";
   valuta kecil berdesimal: JPY 112,5, KRW 11,86, VND 0,56) dan juga di `https://smartdeal.co.id/rates/puncak`.
   Kurs kita: **beli = beli mitra − X%**, **jual = jual mitra + Y%**, persentase diatur pemilik di sistem (pemilik: "nanti
   klo sm sistem bisa di set bro persennya"). Aplikasi mengisi **draf**; aktivasi tetap manual dengan alasan.
4. **Transaksi** sepanjang hari.
5. **Penutupan.** Hitung fisik semua valuta + Rupiah per pecahan (laci + brankas); sistem menghitung seharusnya (kas awal
   + beli − jual + pemasukan − pengeluaran) dan menampilkan selisih per valuta. "Kas harus akur, simple seperti dagang
   biasa." *Dugaan Claude:* selisih ≠ 0 wajib dilihat Penyelia dengan alasan sebelum hari ditutup.

## 6. Cakupan: paritas penuh

Inventaris diperiksa satu per satu dari menu (36 layar), 36 modul server, dan dokumen cetak aplikasi lama (12 Nov 2026).
Rincian aturan per modul: inventaris persyaratan (lampiran A, dibuat dari panduan A–Z, spec, keputusan, memori).

1. **Operasional harian:** beranda hari ini; checklist buka/tutup outlet + PDF penutupan; meja konfirmasi (permintaan
   layanan dari halaman publik); pantauan harian; catat pengeluaran (+ bukti ≤ 8 MB); mode latihan tanpa data asli
   (transaksi, penutupan, guncangan kurs, kesiapan arsip).
2. **Transaksi (bon):** multi-valuta; dua kaki + rincian pecahan wajib; nomor kwitansi manual unik per arah; transfer
   bank (rekening kita + rekening lawan, alasan bila nama berbeda); kanal KANTOR/DELIVERY/ONLINE; underlying bila
   pembelian valas nasabah sebulan **> USD 10.000** (kurs jual referensi BI, akumulatif, hanya pembelian); pernyataan
   nasabah di nota bila ≤ ambang; tanda TKM (internal, tanpa tipping-off); toleransi kurs ±0,5% + alasan; EDD tunai harian
   ≥ Rp 100 jt; lencana LTKT tunai ≥ Rp 500 jt; tinjauan Penyelia (setujui/kembalikan/eskalasi, maker ≠ checker);
   batal (belum selesai) dan **pembatalan berpersetujuan** (sudah selesai; lihat §9 keputusan terbuka); nota SE BI 18/42.
3. **Kas & kurs:** kas awal; sisa uang per pecahan; hitung fisik (laci+brankas, kosong dinyatakan); penyesuaian brankas;
   tukar pecahan; modal masuk/prive; kas↔bank; rekening bank; pelunasan; papan kurs per kelompok pecahan, satuan
   kutipan (JPY per 100), referensi BI + sinkron harian, perbandingan + pengamatan pasar, peringatan volatilitas (1,5%),
   aktivasi manual beralasan, urutan papan; **kurs mitra + margin → draf** (baru).
4. **Nasabah & APU-PPT:** KYC (identitas unik per jenis+nomor, CIF, kebangsaan ISO-2, alamat terstruktur, kategori
   pekerjaan 23 / bentuk badan 11, PEP, pemilik manfaat, kuasa terdaftar); setiap ubah beralasan; impor Excel (≤ 5 MB,
   tanda tangan berkas); ekspor CSV tanpa KTP; risiko tinggi → persetujuan Komisaris (tanpa jalan pintas); profil yang
   dinyatakan + penyimpangan (×2 nilai/frekuensi, valuta tak dinyatakan → tinjauan, tidak memblokir); pemantauan profil
   berkala; keluhan konsumen (→ LAPS BI); retensi Pasal 48 (tanpa tombol hapus).
5. **Daftar terduga:** impor DTTOT/DPPSPM (ganti seluruh / per sumber); cari; penyaringan otomatis (ambang 0,6, hanya
   bantuan); **blokir serta-merta sampai uang berpindah** (bon dan penyelesaian, di belakang kunci; percobaan dicatat);
   putusan CONFIRMED / FALSE_POSITIVE / DICABUT; pemberitahuan BI → Laporan Nihil / Pemblokiran / Berita Acara /
   Pembukaan, 5 langkah pengiriman (DPPSPM 4); cek nama SIPENDAR (≤ 500 nama, tidak disimpan).
6. **Risiko:** IRA (33 parameter, 31 pertanyaan KPMR, bobot 40/30/5/25, skala terbalik, disetujui Komisaris, terkunci);
   klasifikasi risiko per dimensi + tinjauan berkala (bawaan 12 bulan).
7. **SDM:** pegawai + berakhirnya hubungan kerja; sertifikasi + pemeliharaan; penunjukan PIC APU-PPT; kode kompetensi;
   rencana pelatihan tahunan; sesi pelatihan internal + rekap + daftar hadir; **Surat Keterangan Pelaksanaan Pelatihan
   (SKP-APUPPT)** untuk e-Licensing BI; **Surat Keputusan penunjukan**; **Lampiran X/XI PADG 17/2024 realisasi
   sertifikat (Pelaku SKSP)**; laporan RAP01/RAS01 triwulanan (teks berpemisah); telaah profil pegawai 6 bulanan;
   penyaringan calon pegawai.
8. **Keuangan:** bagan akun (dipetakan ke B0002/B0003/B0004); jurnal berpasangan, periode, tutup bulan/tahun; penyusutan
   (garis lurus, bulan penuh, kapitalisasi Rp 1 jt); revaluasi valas (kurs tengah BI); penilaian persediaan UKA dari
   opname; aset tetap; laporan keuangan SAK EP (5 laporan, komparatif, CALK); laporan & rekap transaksi; riwayat.
9. **Pelaporan & arsip:** paket regulator DRAFT→PREPARED→APPROVED→EXPORTED (LKU bulanan tgl 15, laporan keuangan
   tahunan akhir April, SIPESAT, goAML LTKT/LTKM XML, register insidental); arsip dokumen berversi; penatausahaan +
   retensi; Untuk Diketahui Direksi; status kesiapan; riwayat aktivitas.
10. **Pengaturan & publik:** pengguna & peran; wizard pemasangan + kode pemulihan; profil perusahaan (identitas, palet,
    halaman publik, jadwal buka, ketentuan uang); pengumuman; halaman publik "Paspor & cap" + `/papan`.

Batas cakupan dari keputusan lama tetap berlaku (lampiran A §10–11), mis. tenggat Pasal 60 tidak dibangun; dividen nol
menurut kebijakan; pencocokan BO tidak memblokir nasabah (ditandai "bila keliru", §9).

## 7. Keamanan data (untuk tim TI BI)

Tidak ada pedoman BI tertulis; tolok ukur yang dipakai: **OWASP ASVS level 2**, UU PDP No. 27/2022 untuk data pribadi
nasabah, dan praktik yang sudah berjalan di tokoemas.

- **Akses:** akun per orang, peran ditegakkan di server dan di basis data (RLS + peran basis data terpisah:
  migrator / aplikasi / platform). Direksi dan Komisaris masuk dengan passkey; persetujuan sensitif meminta konfirmasi
  passkey segar. Pelaksana/Penyelia: PIN + perangkat terdaftar (pola tokoemas) atau sandi ≥ 12 karakter (diputuskan di
  rencana). Penguncian percobaan masuk.
- **Enkripsi:** HTTPS saja; basis data dan cadangan terenkripsi; berkas KTP/dokumen di penyimpanan terenkripsi, tautan
  bertanda tangan berumur pendek.
- **Data pribadi:** NIK/KTP tidak pernah di log, URL, pesan galat, ekspor CSV, atau telemetri; akses berkas KTP tercatat.
- **Jejak:** setiap perubahan mencatat siapa–kapan–sebelum–sesudah; uang, stok, dan persetujuan append-only (koreksi =
  baris baru tertaut); pemeriksaan integritas malam membangun ulang saldo dari riwayat dan melaporkan selisih.
- **Cadangan:** terenkripsi, di luar server (R2), uji pulih berkala dengan bukti tersimpan.
- **Bukti:** dokumen keamanan (arsitektur, matriks akses, enkripsi, cadangan, penanganan insiden), tinjauan keamanan
  independen + uji penetrasi sebelum peluncuran, peta persyaratan→uji.
- **Lokasi data:** belum diketahui di mana fisik VPS (Hostinger) dan bucket R2 berada; UU PDP dan kemungkinan preferensi
  BI terhadap data di Indonesia → diperiksa sebelum peluncuran (§9).

## 8. Fondasi teknis (keputusan Claude, berdasar survei tokoemas 12 Nov 2026)

Dibangun di atas platform tokoemas-superapp yang sudah berproduksi, **disalin dan disesuaikan ke repo baru** (bukan
paket bersama):

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 + shadcn; tRPC 11 + Zod; **PostgreSQL** (raw `pg`,
  migrasi SQL maju-saja + `scripts/lint-migrations.ts`); better-auth (passkey + PIN); Vitest (unit + integrasi pada
  Postgres sungguhan lewat basis data templat) + fast-check; Playwright; Node 22; npm.
- Pola: tabel peristiwa append-only + `*_current` diisi trigger + `replay.ts` per fitur + pemeriksaan integritas malam;
  penjaga invarian di SQL (trigger, SQLSTATE bernama); sistem pengajuan–persetujuan (permintaan → putusan → periksa ulang
  di bawah kunci → kedaluwarsa); uang `bigint` dalam satuan terkecil, satu modul pembulatan; helper zona waktu toko;
  laci kas + pecahan; lint `no-float-money`, `no-fixed-timezone`, token warna, rahasia.
- Folder fitur: `router.ts`, `service.ts`, `rules.ts` (murni), `definitions.ts`, `queries.ts`, `errors.ts`,
  `approvals.ts`, `replay.ts`, `ui/` (+ `messages.ts` lewat `ux-wording-id`), uji integrasi.
- Titik awal valas: `src/features/fx/` tokoemas (beli/jual valas, satuan minor, kurs per unit, persetujuan, penjaga).
- **Tidak disalin:** seluruh domain emas (barang, kadar, berat, buyback, gadai, servis, rak, lebur, cuci, katalog, dll.),
  enum sumber kas dan jenis persetujuan khas emas (dibangun ulang untuk valas).
- Desain UI: `DESIGN.md` baru (back office) via `/design-consultation` dari merek Solvinc; halaman publik "Paspor & cap"
  dipindah dari repo lama (sudah disetujui).
- Gerbang mutu lokal (aturan pemilik: bukan GitHub Actions): uji penuh + build + E2E sekali per PR; satu tinjauan
  adversarial per PR berisiko (uang/stok/keamanan/penjaga DB).

## 9. Keputusan terbuka (milik pemilik — dijawab sebelum rencana)

1. **Pembatalan bon selesai:** tetap langsung oleh Direksi dengan alasan (aplikasi lama), atau pengajuan Pelaksana →
   persetujuan Direksi/Komisaris (pola tokoemas)? Batas hari yang sama atau kapan saja selama buku belum ditutup?
2. **Alasan pembatalan:** daftar baku (salah barang/harga/nasabah batal/lainnya) seperti tokoemas, atau teks bebas?
3. **Margin kurs mitra:** persentase per valuta, terpisah beli dan jual? Hasilnya dibulatkan (mis. ke Rp 5/10)? Untuk
   valuta per pecahan (SAR500/100/…) margin sama atau per pecahan?
4. **Mengambil kurs mitra:** dibaca otomatis dari `smartdeal.co.id/rates/puncak` (perlu diperiksa halamannya dan izin
   mitra) atau diketik/ditempel?
5. **Lokasi data:** VPS sekarang (lokasi fisik belum diperiksa) atau server di Indonesia?
6. **Temuan minor lama yang butuh keputusan:** pencocokan pemilik manfaat memblokir nasabah atau tidak; harga per seri
   uang kertas; M3/M5 (spec lama ambigu).
7. **Masuk Pelaksana/Penyelia:** PIN + perangkat terdaftar (tokoemas) atau sandi?

## 10. Peralihan ke VPS

Aplikasi lama tetap berjalan (halaman publik + back office kosong) dan **tidak mendapat fitur baru** sejak keputusan ini.
Aplikasi baru dipasang berdampingan di VPS (tumpukan Docker sendiri, Postgres sendiri) dengan alamat uji, diperiksa
pemilik, lalu `ibukotavalasindo.online` dan `backoffice.` dipindah ke aplikasi baru dalam satu langkah. Data produksi lama
kosong, sehingga tidak ada migrasi data; profil perusahaan diisi ulang lewat wizard. Cadangan dan uji pulih Postgres
(pgBackRest → R2, pola tokoemas) aktif sebelum peralihan. Aplikasi lama dimatikan sesudah pemilik menyetujui.

## 11. Yang diserahkan kepada pembangun (Claude)

Struktur tabel, nama, pembagian irisan dan urutan, pustaka di dalam fondasi tokoemas, bentuk uji. Prinsip urutan irisan:
fondasi platform → pengguna & peran → nasabah/KYC → kurs (+ mitra) → kas & pecahan → bon dua kaki → tinjauan/batal →
daftar terduga & blokir → penutupan & opname → buku besar & laporan keuangan → paket regulator → SDM → risiko (IRA) →
arsip & retensi → halaman publik → keamanan & dokumen untuk BI → uji penerimaan 12 temuan → peralihan.

## Lampiran A — sumber persyaratan

- Inventaris aturan per modul (12 Nov 2026), dari: `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, `docs/SKEMA-DATABASE-PROJECT.md`,
  `docs/decisions/*.md`, `docs/superpowers/specs/*.md`, `docs/superpowers/PROMPT-SESI.md`, memori proyek
  (`kupva-regulation-2026`, `ira-and-sdm-reporting`, `financial-reporting-sak-ep`, `reversal-and-rounding`,
  `no-dividend-policy`, `bi-exam-findings-2026`).
- Temuan BI: artifact `b7f62d68-3a12-419e-b507-2e1345260a6b` (pemetaan 3 Sep 2026).
- Fondasi: survei `tokoemas-superapp` (12 Nov 2026), `docs/specs/2026-10-02-epic-tokoemas-superapp.md` K1–K30,
  `docs/agents/codex-lessons.md`.
