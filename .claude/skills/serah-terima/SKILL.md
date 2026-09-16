---
name: serah-terima
description: Use at the end of a work session to regenerate the handoff block in docs/superpowers/PROMPT-SESI.md from real state — test counts actually run, latest migration, tasks checked off, new residual risks. Use when the user says "serah terima", "tutup sesi", "handoff", "update PROMPT-SESI", or asks to record where this session ended so the next session can continue without copying anything.
---

# Serah Terima Sesi

Menulis ulang blok keadaan pada `docs/superpowers/PROMPT-SESI.md` supaya sesi berikutnya dapat
melanjutkan **tanpa menyalin apa pun dari percakapan ini**.

Berkas itu adalah satu-satunya ingatan lintas sesi proyek ini. Bila ia tidak akurat, sesi
berikutnya akan bekerja di atas premis yang salah — itu sudah pernah terjadi (blok K3 pada commit
`3f85dd2` premisnya salah dan harus diganti).

## Aturan yang tidak boleh dilanggar

- **Angka harus dari keluaran perintah yang benar-benar dijalankan pada sesi ini.** Jangan menyalin
  angka dari blok lama. Bila perintahnya tidak dijalankan, tulis bahwa ia tidak dijalankan.
- **Jangan mencentang tugas yang tidak dikerjakan.** Checkbox pada berkas rencana adalah sumber
  kebenaran; blok ini hanya merangkumnya.
- **Risiko residual ditulis jujur, termasuk yang memalukan.** Blok ini gunanya memperingatkan, bukan
  melaporkan keberhasilan.
- **Jangan menghapus catatan "jangan diturunkan ulang" milik paket lama.** Itu justru bagian yang
  paling mahal untuk ditemukan ulang.
- **Prompt sesi berikutnya tidak boleh diberikan sebelum yang dirujuknya masuk git.** Prompt yang
  menyuruh sesi berikutnya membaca sebuah rencana, sementara rencana itu masih `??` pada
  `git status`, adalah prompt yang menunjuk ke berkas yang dapat hilang tanpa jejak. Ditetapkan
  pengguna 16 September 2026, sesudah `plans/2026-09-16-papan-kurs.md` menganggur di luar git
  sepanjang sesi perancangannya dan baru ketahuan pada serah terima berikutnya.

## Langkah

1. **Kumpulkan keadaan yang terukur** — jalankan, jangan diingat:
   ```bash
   git log --oneline -8
   git status --short
   ls drizzle/*.sql | tail -3                      # migrasi terakhir
   ./node_modules/.bin/vitest run 2>&1 | tail -5   # hanya bila belum dijalankan sesi ini
   ```
   Bila `vitest` sudah dijalankan sesi ini, pakai angka itu — jangan menjalankannya lagi.

2. **Baca status tiap rencana** yang tersentuh sesi ini:
   ```bash
   awk '/^## +Status Pengerjaan/{i=1;next} i&&/^## /{exit} i&&/^- \[/{print}' docs/superpowers/plans/<rencana>.md
   ```

3. **Perbarui `docs/superpowers/PROMPT-SESI.md`:**
   - Ganti judul dan isi bagian `## Sesi berikutnya — keadaan per <tanggal>` dengan keadaan hari ini.
   - Perbarui baseline uji, nomor migrasi terakhir, dan antrean migrasi produksi.
   - Tambahkan ke `### Yang tidak perlu ditemukan ulang` setiap jebakan yang **memakan waktu** sesi
     ini. Kriterianya satu: apakah sesi berikutnya akan membuang waktu yang sama tanpa catatan ini?
     Jangan menambahkan hal yang sudah jelas dari kode.
   - Perbarui blok paket yang dikerjakan: tandai SELESAI beserta tanggalnya, atau sebutkan tugas
     berikutnya.
   - Perbarui `### Pekerjaan yang sudah teridentifikasi tetapi belum dirancang` bila sesi ini
     menemukan pekerjaan baru.

4. **Perbarui `docs/superpowers/ROADMAP-SISA-PEKERJAAN.md`** bila Status Pengerjaan paket berubah.

5. **Bila perilaku pengguna atau struktur data berubah**, perbarui juga
   `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` dan/atau `docs/SKEMA-DATABASE-PROJECT.md` — ini tuntutan
   `CLAUDE.md`, bukan pilihan.

6. **Sapu artefak yang belum terlacak, lalu commit semuanya.** Jalankan
   `git status --porcelain --untracked-files=all` dan periksa satu per satu:

   | Yang muncul | Tindakan |
   |---|---|
   | Rencana (`docs/superpowers/plans/*.md`) atau spec yang belum terlacak | **Wajib ikut di-commit.** Sesi berikutnya membacanya sebagai perintah, dan hook `SessionStart` membaca centangnya. |
   | Dokumen proyek lain yang disunting sesi ini | Ikut di-commit. |
   | Keadaan kerja agen sementara | Harus tertutup `.gitignore`. Bila ia masih muncul sebagai `??`, tambal `.gitignore`-nya sekarang, jangan dibiarkan jadi derau permanen. |

   Derau `??` yang dibiarkan menahun adalah sebabnya berkas penting bisa ikut tersembunyi di
   tengahnya tanpa ada yang sadar. Sesudah langkah ini, `git status` harus bersih.

7. **Tunjukkan diff-nya kepada pengguna sebelum commit.** Blok ini yang akan dibaca sesi berikutnya
   sebagai kebenaran; ia harus dibaca manusia dulu.

8. **Commit** dengan pesan berbentuk `PROMPT-SESI: keadaan sesudah <Paket/Tugas>`.

9. **Barulah berikan prompt sesi berikutnya** — sesudah `git status` bersih, tidak sebelumnya.

## Yang tidak dikerjakan skill ini

- Tidak menjalankan `pnpm build` atau `tsc` hanya untuk mengisi blok. Bila tidak dijalankan, tulis
  bahwa tidak dijalankan.
- Tidak menyentuh basis data.
- Tidak mencentang checkbox apa pun pada berkas rencana.
