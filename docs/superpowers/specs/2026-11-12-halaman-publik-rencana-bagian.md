# Halaman publik ibukotavalasindo.online — rencana bagian (sebelum desain)

Ditulis 12 November 2026 (WIB). Pemilik, sesudah melihat tiga arah gaya (papan flap / cetak uang / paspor):
"masih kurang srek semua, tapi lumayan kebayang, coba rencanain dulu sectionnya semua, kayak waktu itu bikin solvinc,
contoh kamu cuman nampilin 1 jenis sectionnya doang". Dokumen ini menetapkan **isi dan urutan** seluruh halaman;
gaya visual dipilih sesudahnya dan dibangun di atas rencana ini (pola brief "Tiga Arus" Solvinc, §0–§8).

## Siapa yang datang dan untuk apa

Pengunjung membuka situs money changer dengan satu dari lima tugas. Urutan bagian mengikuti seberapa sering tugas itu:

1. **"Kursnya berapa sekarang?"** (paling sering, dari ponsel, sering dari tautan yang dibagikan di grup WhatsApp).
2. **"Kalau saya tukar sekian, dapat/bayar berapa?"** Dua arah: menjual valas (pulang umrah/haji, pekerja migran
   dari Timur Tengah, wisatawan Timur Tengah di Puncak–Cipanas) dan membeli valas (berangkat umrah, liburan).
3. **"Bisa dilayani kapan dan di mana? Apa yang harus dibawa?"**
4. **"Tempat ini resmi? Bukan penipu?"**
5. **"Ada yang perlu saya tahu?"** (pengumuman, pertanyaan umum).

Staf hanya butuh pintu masuk kecil (bukan tombol besar di kepala halaman nasabah).

## Bagian

| § | Bagian | Tugas pengunjung | Isi | Sumber data (sudah ada?) | Momen gerak |
|---|---|---|---|---|---|
| 0 | Kedatangan (≤ 1,5 s) | — | Logo IV + "Kurs terbaru 07.40 WIB" yang benar-benar menunggu data kurs termuat | kurs aktif (ada) | Serah terima logo → papan kurs, tidak ada hitungan palsu |
| 1 | Kurs hari ini (hero) | 1 | Judul "Kurs hari ini" + jam pembaruan WIB + status **Buka/Tutup sekarang**. Saklar **"Saya mau: Jual valas / Beli valas"** yang menonjolkan kolom yang relevan (bahasa nasabah: "kami beli" = Anda jual). Semua valuta aktif (awal: AUD, CNY, EUR, GBP, HKD, JPY, MYR, SAR, SGD, USD) per pecahan. Tanpa stok; ajakan menelepon untuk memastikan pecahan tersedia. Tanda naik/turun dari kurs sebelumnya | kurs aktif + riwayat RETIRED (ada); jam buka **terstruktur (BARU)**; semua kurs aktif (tanpa unggulan, keputusan pemilik) | Angka yang baru berubah "bergulir"; penanda naik/turun menyala sekali |
| 2 | Hitung tukar | 2 | Kalkulator dua arah: "Saya punya 500 SAR → dapat Rp …" / "Saya butuh 1.000 USD → bayar Rp …"; pilihan pecahan (USD 100 vs pecahan kecil beda kurs); pembulatan ke atas Rp 100 seperti kasir. Tombol **Minta konfirmasi & kunci kurs** → formulir permintaan yang sudah ada (nama, WhatsApp/telepon, waktu datang) | kurs + `service_requests` (ada; arah BUY/SELL sudah ada) | Total menghitung berjalan; konfirmasi = "tiket" tercetak |
| 3 | Bagikan kurs | 1 | Tombol "Bagikan kurs hari ini ke WhatsApp" (teks ringkas kurs unggulan + tautan) | kurs (ada) | — |
| 4 | Ketentuan uang | 2–3 | Pecahan yang diterima, uang lusuh/cacat/coretan, seri lama (mis. USD seri sebelum 2006) — kurs beda atau ditolak | **teks ketentuan (BARU, di Profil Perusahaan)**; tanpa isi → bagian disembunyikan | — |
| 5 | Datang ke outlet | 3 | Alamat, tombol **Buka di peta**, jam buka + status sekarang, telepon/WhatsApp (bisa disalin). **Yang perlu dibawa**: KTP/paspor; pembelian valas di atas USD 10.000 sebulan wajib dokumen pendukung + NPWP (PADG 15/2026), di bawahnya menandatangani pernyataan | profil (alamat, telepon, peta, jam: ada); aturan = teks tetap dari regulasi | Peta statis (bukan iframe; dilarang di beberapa tempat) |
| 6 | Resmi & aman | 4 | "Berizin Bank Indonesia" + nomor izin + kode KUPVA, tautan ke daftar resmi KUPVA berizin di bi.go.id; peringatan penipuan; "kami hanya menghubungi lewat nomor di halaman ini" | profil (nomor izin, kode KUPVA, peringatan: ada). **Tanpa logo BI** (tidak boleh meniru lembaga) | Stempel/segel izin |
| 7 | Pengumuman | 5 | Libur, stok habis, perubahan jam | `public_announcements` (ada); kosong → tersembunyi | — |
| 8 | Pertanyaan umum | 5 | Maks. 12 tanya-jawab | profil `publicFaq` (ada) | Buka/tutup halus |
| 9 | Kaki halaman | — | Nama badan hukum, izin, alamat, kontak; tautan kecil **Masuk staf** | profil (ada) | — |
| — | `/papan` (opsional) | 1 | Mode layar TV di outlet: papan kurs layar penuh, jam WIB, berganti otomatis | kurs (ada) | Papan flap untuk angka yang berubah |

Kepala halaman: logo + nama, jangkar **Kurs · Hitung · Lokasi · Bantuan**, chip **Buka/Tutup**. Di ponsel urutannya
sama: kurs → hitung → lokasi → resmi → pertanyaan. Semua teks lewat `ux-wording-id`.

## Data baru yang dibutuhkan (dibangun bersama penulisnya di Profil Perusahaan)

1. **Jam buka terstruktur** per hari (untuk status Buka/Tutup sekarang, WIB). Teks bebas `openingHours` tetap sebagai catatan.
2. **Ketentuan uang** (teks pendek), opsional.

## Keputusan pemilik (12 Nov 2026)

1. **Stok tidak ditampilkan.** Halaman mengajak nasabah menelepon dulu untuk memastikan ketersediaan pecahan.
2. **Valuta: semua kurs aktif ditampilkan** (tanpa "unggulan"). Daftar awal mengikuti vip.co.id (dicek 12 Nov 2026):
   AUD, CNY, EUR, GBP, HKD, JPY, MYR, SAR, SGD, USD. Valuta lain muncul otomatis begitu kursnya diaktifkan staf.
3. **Jam buka Senin–Sabtu 09.00–17.00 WIB** (Minggu tutup). Telepon **(0263) 265-500**. WhatsApp sementara
   **0811-260-269** (nomor pribadi pemilik, sampai nomor outlet dibeli). Diisi pemilik di Profil Perusahaan, bukan
   ditulis di kode.
4. **`/papan` dibuat** ("buat yang keren"): layar TV outlet, membaca kurs aktif dan memperbarui sendiri saat staf
   mengaktifkan kurs baru.
5. **Kurs tetap diedit dan diaktifkan manual.** Pemilik mengambil untung dari kurs partner yang dikirim tiap pagi.
   Usulan (belum dibangun): langkah "Isi dari kurs partner + margin" di layar Kurs Hari Ini yang hanya mengisi draf;
   aktivasi tetap manual dengan alasan (aturan keras CLAUDE.md). Otomatis penuh di kemudian hari = pemilik mengubah
   aturan itu secara sadar (ambang selisih kecil, sisanya menunggu orang, jejak "otomatis dari kurs partner").
   Menunggu: contoh kiriman kurs partner (bentuknya: WhatsApp, foto, Excel, atau surel).

## Sesudah rencana disetujui

Gaya visual dipilih ulang dengan seluruh bagian ini sebagai isi (bukan hanya papan kurs): tiga arah, masing-masing
memperlihatkan §1–§9 di 390 px dan 1280 px dengan gerak, lalu pemilik memilih atau mencampur.
