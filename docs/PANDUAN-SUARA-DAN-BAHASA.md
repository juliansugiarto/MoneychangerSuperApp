# Panduan Suara dan Bahasa

Berlaku untuk setiap layar yang dibangun di atas fondasi desain (Program Desain Ulang Antarmuka,
spec `docs/superpowers/specs/2026-09-12-desain-ulang-antarmuka-design.md` §2.6). Ditegakkan pada
tinjauan setiap sub-proyek. Ekspor, cetakan, dan berkas untuk regulator **tidak** tunduk pada panduan
ini — di sana istilah resmi dipakai apa adanya.

## Tujuh aturan

1. **Indonesia sehari-hari dengan "Anda".** Satu gagasan per kalimat.
2. **Judul berbentuk pertanyaan atau tugas**, bukan nama formulir.
3. **Istilah resmi BI/PPATK tetap ada, sebagai label kecil** di bawah kalimat biasa (`PageHeader.officialLabel`).
4. **Uang dalam Rupiah dengan angka tabular**; tanggal dalam zona operasional perusahaan.
5. **Pesan galat menyebut apa yang terjadi dan apa yang harus dilakukan** (`ErrorState` mewajibkan keduanya).
6. **Keadaan kosong menyebut langkah berikutnya** (`EmptyState` mewajibkan `nextStep`).
7. **Tindakan destruktif selalu lewat dialog yang menyebut nama bendanya.**

## Sebelum dan sesudah — kalimat nyata dari aplikasi

| Sebelum | Sesudah | Label resmi (bila ada) |
|---|---|---|
| Akses operasional terlindungi. | Silakan masuk dulu | — |
| Kewenangan Anda belum mencukupi. | Halaman ini bukan untuk peran Anda | — |
| Form A1 — nilai parameter risiko inheren | Seberapa berisiko nasabah, produk, dan wilayah Anda? | Form A1 · Risiko inheren |
| Kuesioner KPMR & hasil | Seberapa siap pengendalian Anda? | Kuesioner KPMR |
| Form C1 — angka yang terhitung | Tentang usaha Anda bulan ini | Form C1 |
| Ambang pita gagal dimuat. | Batas tingkat risiko tidak dapat dimuat. Muat ulang halaman; bila tetap gagal, hubungi pengelola aplikasi. | — |
| Agregat Form C1 gagal dimuat. | Ringkasan usaha tidak dapat dihitung. Periksa sambungan lalu coba lagi. | Form C1 |
| Alasan / rujukan SRA (wajib) | Mengapa Anda menilai begini? Sebutkan dasarnya. | Rujukan SRA |
| Tidak ada transaksi pada periode ini. | Tidak ada transaksi pada periode ini. Pilih periode lain di atas. | — |
| Terkunci — sudah disetujui | Sudah disetujui, tidak dapat diubah lagi | — |

## Kata yang dipakai secara konsisten

| Pakai | Jangan pakai |
|---|---|
| bon | nota, invoice (untuk transaksi valuta) |
| nasabah | Pengguna Jasa (kecuali label resmi) |
| Pemegang Saham | shareholder |
| kas awal | modal awal harian, opening cash |
| hitung fisik uang | stock opname (kecuali label resmi) |
| nonaktifkan | hapus (bila barisnya tetap tersimpan) |
