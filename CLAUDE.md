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

## Fitur Harus Punya Sumber Data

- **Jangan membangun tampilan, laporan, atau baris laporan yang tidak ada penulis datanya.** Bila
  sebuah fitur menuntut data yang belum pernah ditulis kode mana pun, bangun juga penulisnya dalam
  paket yang sama — atau jangan bangun fiturnya sama sekali. "Fiturnya ada, nilainya selalu nol"
  bukan penyelesaian, dan tidak boleh dilaporkan sebagai penyelesaian.
- Enum yang tidak pernah dipakai, akun yang tidak pernah dijurnal, dan kolom yang tidak pernah diisi
  adalah **pekerjaan yang belum selesai**, bukan keadaan sah. Sebelum menyimpulkan sebuah nilai
  memang selalu kosong, telusuri rantainya sampai ke penulisnya dan sebutkan siapa yang seharusnya
  mengisinya.
- Setiap fitur baru harus dapat diperagakan **end-to-end** di basis data lokal (`moneychanger` /
  `mc_t_abcvalas`): buat datanya, jalankan alurnya, tunjukkan hasilnya di layar. Verifikasi visual
  yang berhenti pada halaman kosong belum membuktikan apa pun.
- Batas yang tetap berlaku: pembukuan produksi, data nasabah nyata, dan `audit_logs` tidak boleh
  dikarang atau disunting. Aturan "selalu buat datanya" berlaku pada lingkungan lokal dan pada
  penulis data di dalam kode — bukan pada data produksi.

## Aturan Keras Operasional

- Jangan membuat, menyuntikkan, atau mengubah data nasabah, transaksi, kas, snapshot, paket pelaporan, arsip, atau audit produksi untuk demo/test.
- **Data uji pada basis data lokal (`moneychanger` dan `mc_t_abcvalas`) boleh dibuat pada tahap mana
  pun tanpa meminta izin lebih dulu** — ditetapkan pengguna 8 September 2026. Ini justru yang
  dituntut aturan "Fitur Harus Punya Sumber Data": peragaan end-to-end tidak mungkin dilakukan tanpa
  membuat datanya. Izin ini **hanya** berlaku untuk kedua basis data lokal itu; pembukuan produksi,
  data nasabah nyata, dan `audit_logs` produksi tetap tidak boleh dikarang atau disunting. Data uji
  paket sebelumnya yang sengaja dibiarkan tetap jangan dibersihkan.
- Simulasi tidak boleh menulis bon, kas, stock opname, laporan, arsip, ataupun audit produksi.
- Kurs tetap diaktifkan manual dengan alasan yang dapat ditelusuri; jangan menambahkan aktivasi otomatis dari sumber referensi.
- Jangan menambahkan submit otomatis ke BI/regulator tanpa format resmi, kanal, jadwal, kredensial, dan otorisasi tertulis yang telah diverifikasi.
- Jangan mereset sandi, menonaktifkan akun, membuat akun, mengubah peran, mengaktifkan kurs, atau mengekspor/menyetujui paket nyata tanpa permintaan eksplisit dan alur yang berwenang.
- Jangan menyimpan secret, kata sandi, token, cookie, data KYC, atau workbook aktual di source, fixture, log, screenshot, dokumentasi, atau commit.
- Impor XLS/XLSX harus mempertahankan batas 5 MB serta validasi MIME/base64/signature. Hanya workbook internal tepercaya dan dipindai antivirus yang boleh diimpor.
- Rincian pecahan (nilai × jumlah lembar/keping) WAJIB diisi untuk setiap pergerakan kas fisik — kas awal, penyesuaian brankas/off-hours, dan kedua sisi bon (valuta asing maupun Rupiah pada transaksi tunai). Jangan membuatnya opsional; stok pecahan berjalan (`cash_denomination_balances`) adalah sumber kebenaran operasional, bukan sekadar catatan tambahan.
- Transaksi valuta selalu bergerak dua arah: sisi valuta asing (`exchange_transaction_denomination_entries`, per baris mata uang) dan sisi Rupiah pada pembayaran tunai (`exchange_transaction_payment_denominations`). Perubahan pada salah satu sisi (validasi stok, posting kas, pelaporan) wajib dicek ulang terhadap sisi lainnya — jangan hanya menyelesaikan satu kaki transaksi.
- Sebelum menganggap perubahan kas/stok/transaksi selesai, telusuri skenario operasional nyata secara eksplisit (modal awal → beli → jual di hari yang sama → tutup/opname; beli tanpa modal Rupiah cukup; jual tanpa stok valuta cukup) dan pastikan logikanya konsisten end-to-end, bukan hanya lolos linting/type-check.

## Perubahan Skema, UI, dan Rilis

- Perubahan skema harus dimulai dari `drizzle/schema.ts`, menghasilkan migrasi, membaca SQL, mengevaluasi backup/rollback, lalu menerapkan migrasi terkontrol. Jangan melakukan perubahan destruktif tanpa persetujuan eksplisit.
- UI harus memakai komponen yang ada, memiliki loading/empty/error state, fokus keyboard, teks tindakan kritis yang jelas, dan verifikasi visual untuk rute/dashboard yang berubah.
- Perbarui panduan A–Z, use case, atau skema database bila perilaku pengguna maupun struktur data berubah.
- Sebelum rilis, tampilkan bukti perintah yang dijalankan, review seluruh `todo-jp0taelo.md`, tandai tugas selesai, lalu buat checkpoint dengan ringkasan risiko residual yang jujur.
