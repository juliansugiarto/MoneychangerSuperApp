# Pengerasan zona waktu — sesi basis data selalu UTC

Tanggal 26 September 2026. Butir **A3** daftar "selesaikan sisa sebelum pindah ke aplikasi desktop"
yang disetujui pengguna. Pendekatan A disetujui pengguna pada hari yang sama; rincian di bawah
mempersempitnya (lihat "Koreksi terhadap pendekatan A").

## Masalah

Skema memuat **94 kolom `timestamp … DEFAULT (now())`** dan 32 kolom `ON UPDATE CURRENT_TIMESTAMP`.
Sambungan basis data (`server/db.ts`, `createPool`) tidak menetapkan zona waktu, sehingga sesi MySQL
memakai zona sistem mesin basis data.

Drizzle menulis dan membaca kolom `timestamp` sebagai teks UTC (`toISOString`, dibaca dengan akhiran
`+0000`). MySQL menafsirkan teks itu menurut **zona sesi**. Akibatnya:

- **Produksi hari ini benar** hanya karena mesinnya `Etc/UTC`, sehingga zona sesi = UTC.
- **Pada mesin ber-zona WIB** — laptop Windows pemilik, sasaran aplikasi desktop — tulisan Drizzle dan
  bacaan Drizzle bergeser bersama (konsisten satu sama lain), tetapi nilai bawaan `now()` adalah
  instan yang benar. Keduanya berselisih **tujuh jam** di tabel yang sama. Gejala ini sudah pernah
  terlihat: riwayat penyaringan Paket L "tujuh jam di masa depan" (10 September 2026), yang diakali
  per penulis di `server/customerWatchlistScreening.ts`.

## Keputusan

**Setiap sambungan basis data aplikasi menjalankan `SET time_zone = '+00:00'`**, dan server **menolak
menyala** bila sesinya ternyata bukan UTC. Dengan itu setiap mesin, apa pun zona sistemnya, berperilaku
persis seperti produksi hari ini — lingkungan tempat 1726 uji dan seluruh peragaan dibuktikan.

### Koreksi terhadap pendekatan A (yang disetujui di obrolan)

Pendekatan A di obrolan juga menyebut **menyetel zona proses Node ke UTC**. Sesudah membaca kodenya,
itu **tidak diperlukan dan tidak dikerjakan**:

- Kolom `timestamp` dan `datetime` ditulis Drizzle sebagai teks UTC sendiri — zona proses tidak ikut.
- Kolom `date` dikirim sebagai `Date` yang diformat mysql2 menurut zona proses, dan penolongnya
  (`dateColumnBound` di `server/operations.ts`, `dbDate` di `server/ledgerOperations.ts`) sengaja
  dibentuk **benar di kedua zona** (catatan memori *mysql-date-column-bounds*). Opsi mysql2
  `timezone: "Z"` justru **merusak** penolong itu (tengah malam lokal WIB terkirim sebagai tanggal
  sebelumnya), jadi opsi itu juga tidak dipakai.
- Tampilan sudah memformat tanggal dengan zona operasional perusahaan secara eksplisit.

Satu-satunya yang bergantung pada zona mesin adalah **zona sesi MySQL**, maka hanya itu yang dipaku.

## Rancangan

1. **`server/db.ts`** — `poolFor` memasang `pool.on("connection", …)` yang menjalankan
   `SET time_zone = '+00:00'` pada setiap sambungan baru, sebelum sambungan itu dipakai kueri apa pun.
   Satu fungsi bernama `applyUtcSession(connection)` dipakai juga oleh penyambung lain di bawah.
2. **`server/testing/scratchDatabase.ts`** — sambungan migrasinya ikut `applyUtcSession`, supaya uji
   hidup berjalan di bawah keadaan yang sama dengan server.
3. **Penjaga saat menyala** — `assertUtcSession(db)` membaca `SELECT @@session.time_zone,
   TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW())`. Bila selisihnya bukan 0, server berhenti dengan
   pesan: zona sesi basis data bukan UTC, waktu akan tersimpan bergeser. Dipanggil di
   `server/_core/index.ts` sebelum `listen`, hanya bila `DATABASE_URL` terisi. Ini perubahan
   `server/_core` yang dituntut butir A3.
4. **Skrip `.mjs`** yang menulis waktu (`tenant.mjs setup-code`) sudah memakai `UTC_TIMESTAMP()` ke kolom
   `datetime` — tidak bergantung zona sesi, tidak diubah. Skrip impor historis (`scripts/import*.mjs`,
   `verify*.mjs`) **tidak disentuh** dan dicatat sebagai risiko residual.
5. **Aplikasi desktop (kelak)** — MariaDB/MySQL bawaan dinyalakan dengan `default-time-zone='+00:00'`.
   Itu bagian rancangan paket desktop, bukan tugas ini; penjaga di butir 3 akan menangkapnya bila lupa.

## Data yang sudah ada

- **Produksi:** zona sistemnya UTC, jadi zona sesinya sudah UTC — **tidak ada yang bergeser.** Rencana
  wajib membuktikannya dengan kueri baca-saja `SELECT @@global.time_zone, @@system_time_zone` sebelum
  menganggapnya benar.
- **Basis data lokal** (`moneychanger`, `mc_t_abcvalas`, `mc_t_visual`): baris `timestamp` yang ditulis
  Drizzle di bawah sesi WIB akan terbaca **tujuh jam lebih awal** sesudah perubahan ini; baris yang
  diisi bawaan `now()` justru menjadi benar. Ini data uji lokal; **tidak dikoreksi**, dan dicatat.
  Kolom `datetime` dan `date` tidak terpengaruh.

## Uji

Semua di basis data sekali pakai `mc_uji_*`, dijalankan pada Mac ber-zona WIB — mesin tempat
kesalahannya nyata:

1. Baris yang `createdAt`-nya diisi bawaan `now()` (akun lewat `createInternalUser`) terbaca dalam
   selisih 60 detik dari `Date.now()`. **Gagal sebelum perubahan** (selisih tujuh jam).
2. `timestamp` yang ditulis Drizzle secara eksplisit (`lastSignedIn`) terbaca kembali sebagai instan
   yang sama, dan sama dengan nilai bawaan `now()` baris yang sama bila ditulis bersamaan.
3. `assertUtcSession` menolak sambungan yang sengaja di-`SET time_zone = '+07:00'` dan menerima sesi
   dari `poolFor`.
4. Seluruh suite, `tsc`, `vite build`, Playwright tetap lulus; jumlah "dilewati" tetap 2.

## Rollback

Mengembalikan commit cukup; tidak ada migrasi. Data yang ditulis selama perubahan berlaku tersimpan
sebagai UTC sungguhan — dibaca benar oleh kode lama di produksi (sesi UTC).

## Risiko residual

1. Skrip impor dan verifikasi historis `.mjs` tidak dipaku; bila dijalankan dari mesin WIB terhadap
   kolom `timestamp`, waktu bisa bergeser. Hari ini tidak ada yang menjalankannya.
2. Stempel waktu lokal lama pada basis data pengembangan tercampur (lihat "Data yang sudah ada").
