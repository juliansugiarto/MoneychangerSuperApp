# PT Ibukota Valasindo — Instruksi Proyek

## Mulai Sesi

Baca `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` dan `docs/SKEMA-DATABASE-PROJECT.md` sebelum mengubah workflow operasional, data, akses, kurs, kas, atau pelaporan. Untuk perubahan lintas modul atau berdampak tinggi, jelaskan rencana, file terdampak, skenario gagal, bukti uji, dan rollback sebelum menulis kode.

## Perintah Mutu

```bash
pnpm test
pnpm check
pnpm build
```

Perubahan kode tidak selesai tanpa test Vitest yang relevan, pemeriksaan tipe, dan build. Jika mengubah dependensi, jalankan juga `pnpm audit --prod --audit-level=high`; jangan menyebut audit bersih selama temuan residual SheetJS/xlsx masih ada.

## Arsitektur dan Batas

- Frontend React/TypeScript berada di `client/src/`; backend Express/tRPC di `server/`; skema Drizzle/MySQL di `drizzle/schema.ts`.
- Peran akses adalah `STAFF < ADMIN < CONTROLLER < SHAREHOLDER`. Otorisasi harus ditegakkan di tRPC/server, bukan hanya disembunyikan di UI.
- Gunakan `trpc.*.useQuery/useMutation`; jangan menambahkan wrapper `fetch`/Axios pada client.
- Jangan mengubah `server/_core` tanpa kebutuhan infrastruktur yang telah dianalisis.
- Gunakan dokumentasi `docs/INSTRUKSI-CLAUDE-CODE.md` untuk prompt, handoff, dan prioritas pengembangan.

## Aturan Keras Operasional

- Jangan membuat, menyuntikkan, atau mengubah data nasabah, transaksi, kas, snapshot, paket pelaporan, arsip, atau audit produksi untuk demo/test.
- Simulasi tidak boleh menulis bon, kas, stock opname, laporan, arsip, ataupun audit produksi.
- Kurs tetap diaktifkan manual dengan alasan yang dapat ditelusuri; jangan menambahkan aktivasi otomatis dari sumber referensi.
- Jangan menambahkan submit otomatis ke BI/regulator tanpa format resmi, kanal, jadwal, kredensial, dan otorisasi tertulis yang telah diverifikasi.
- Jangan mereset sandi, menonaktifkan akun, membuat akun, mengubah peran, mengaktifkan kurs, atau mengekspor/menyetujui paket nyata tanpa permintaan eksplisit dan alur yang berwenang.
- Jangan menyimpan secret, kata sandi, token, cookie, data KYC, atau workbook aktual di source, fixture, log, screenshot, dokumentasi, atau commit.
- Impor XLS/XLSX harus mempertahankan batas 5 MB serta validasi MIME/base64/signature. Hanya workbook internal tepercaya dan dipindai antivirus yang boleh diimpor.

## Perubahan Skema, UI, dan Rilis

- Perubahan skema harus dimulai dari `drizzle/schema.ts`, menghasilkan migrasi, membaca SQL, mengevaluasi backup/rollback, lalu menerapkan migrasi terkontrol. Jangan melakukan perubahan destruktif tanpa persetujuan eksplisit.
- UI harus memakai komponen yang ada, memiliki loading/empty/error state, fokus keyboard, teks tindakan kritis yang jelas, dan verifikasi visual untuk rute/dashboard yang berubah.
- Perbarui panduan A–Z, use case, atau skema database bila perilaku pengguna maupun struktur data berubah.
- Sebelum rilis, tampilkan bukti perintah yang dijalankan, review seluruh `todo-jp0taelo.md`, tandai tugas selesai, lalu buat checkpoint dengan ringkasan risiko residual yang jujur.
