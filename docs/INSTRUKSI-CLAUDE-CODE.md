# Handoff Claude Code untuk Pengembangan Lanjutan

Dokumen ini membantu pengembang memakai Claude Code secara aman setelah rilis operasional. File `CLAUDE.md` di akar proyek menyimpan instruksi singkat yang dibaca pada awal sesi; dokumen ini menjelaskan alur kerja dan prompt yang dapat digunakan. Claude Code mendukung instruksi proyek melalui `CLAUDE.md`, aturan bertopik, skills, dan hooks. Instruksi sebaiknya spesifik, ringkas, dan dapat diverifikasi.[1] [2]

## Mulai dengan Aman

1. Buat salinan kerja dari source code; jangan bekerja langsung pada arsip atau database produksi.
2. Siapkan `.env` secara lokal tanpa mengirim nilai rahasia ke chat, Git, tiket, atau ZIP.
3. Jalankan `pnpm install --frozen-lockfile`, lalu `pnpm test`, `pnpm check`, dan `pnpm build` sebelum mengubah kode.
4. Baca `CLAUDE.md`, `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md`, serta `docs/SKEMA-DATABASE-PROJECT.md` sebelum meminta perubahan besar.
5. Untuk perubahan lintas file, mulai dengan mode perencanaan dan minta daftar file, risiko, skenario uji, dan rollback. Praktik eksplorasi → rencana → implementasi → verifikasi direkomendasikan untuk pekerjaan kompleks.[2]

## Aturan Keras Proyek

| Area | Instruksi untuk Claude Code |
|---|---|
| Data produksi | Jangan membuat, mengisi, meniru, atau mengubah data nasabah, transaksi, kas, snapshot, maupun audit hanya untuk demo/test. |
| Simulasi | Simulasi harus tetap terisolasi; tidak boleh menulis bon, kas, laporan, arsip, atau audit produksi. |
| Kurs | Jangan membuat aktivasi kurs otomatis. Semua aktivasi membutuhkan alur dan alasan manusia yang ada. |
| Regulator | Jangan menambahkan submit otomatis ke BI/regulator tanpa format resmi, kredensial, kanal, jadwal, dan otorisasi perusahaan yang terverifikasi. |
| XLS/XLSX | Pertahankan batas 5 MB, validasi MIME/base64/signature, dan kebijakan workbook internal tepercaya yang telah dipindai antivirus. |
| Rahasia | Jangan tulis `DATABASE_URL`, JWT, kata sandi, cookie, token, atau data KYC ke source, test fixture, log, screenshot, atau dokumentasi. |
| Akses | Periksa otorisasi tRPC di server; jangan percaya pembatasan UI saja. Reset sandi/status/peran harus mencabut sesi lama. |
| Bukti kualitas | Perubahan kode harus memiliki test relevan, `pnpm check`, `pnpm build`, dan verifikasi antarmuka bila mengubah UI. |

## Struktur Instruksi yang Diperbarui

`CLAUDE.md` kini mempertahankan aturan yang harus diketahui pada setiap sesi: batas operasional, arsitektur, perintah mutu, dan kriteria rilis. Aturan yang hanya relevan saat menyentuh area tertentu dipisahkan agar konteks tetap ringkas. Pemisahan ini mengikuti rekomendasi resmi untuk memakai `CLAUDE.md` yang spesifik dan ringkas, lalu menerapkan aturan bertopik berdasarkan path.[1] [2]

| Lokasi | Diterapkan saat | Tujuan |
|---|---|---|
| `CLAUDE.md` | Setiap sesi proyek | Memberi batas data, kurs, regulator, akses, mutu, dan rilis. |
| `.claude/rules/server-and-data.md` | Membaca/mengubah `server/` atau `drizzle/` | Menjaga otorisasi tRPC, migrasi, nominal desimal, dan isolasi data. |
| `.claude/rules/client-experience.md` | Membaca/mengubah `client/src/` | Menjaga UX Staff, state antarmuka, aksesibilitas, dan verifikasi visual. |
| `.claude/rules/release-and-security.md` | Seluruh perubahan | Menentukan bukti minimum dan dokumentasi yang perlu diperbarui. |
| `CLAUDE.local.md` | Mesin pengembang sendiri | Menyimpan preferensi lokal yang tidak boleh masuk Git, seperti URL sandbox atau data uji pribadi. |

## Matriks Bukti Sebelum Menyatakan Selesai

| Jenis perubahan | Bukti minimum | Dokumentasi yang ditinjau |
|---|---|---|
| Teks/dokumentasi | Pemeriksaan tautan, heading, dan konsistensi istilah | Panduan/use case bila berlaku. |
| UI client | `pnpm check`, screenshot/walkthrough, state loading-kosong-gagal | Panduan A–Z bila langkah pengguna berubah. |
| Server/workflow | Test sukses/penolakan peran, `pnpm test`, `pnpm check`, `pnpm build` | Use case dan guardrail operasi. |
| Skema/migrasi | Test relevan, migrasi dibaca, backup/rollback, query baca-saja pasca-migrasi | Skema database. |
| Dependensi | Test, check, build, `pnpm audit --prod --audit-level=high` | Risiko residual jika audit tidak bersih. |
| Fitur berisiko tinggi | Seluruh bukti di atas, walkthrough baca-saja, serta bukti simulasi tidak menulis produksi | Panduan A–Z, use case, dan finalisasi. |

> **Catatan workbook aktual:** Bukti walkthrough dengan workbook aktual bersifat baca-saja dan opsional. Test rutin tidak boleh gagal hanya karena berkas keuangan sumber tidak dimount pada lingkungan pengembangan/CI. Tetap pertahankan test fixture aman untuk parser, validasi signature, batas ukuran, dan isolasi produksi.

## Perintah Verifikasi

```bash
pnpm test
pnpm check
pnpm build
pnpm audit --prod --audit-level=high
```

Audit SheetJS/xlsx saat handoff ini mempunyai risiko residual pemasok yang belum memiliki patch. Jangan menyebut audit bersih bila temuan tersebut masih ada; terapkan mitigasi impor tepercaya dan input manual.

## Template Prompt yang Direkomendasikan

### Menambah fitur

```text
Baca CLAUDE.md dan dokumen operasional terlebih dahulu. Dalam mode perencanaan,
analisis fitur [NAMA FITUR] untuk PT Ibukota Valasindo. Sebutkan file terdampak,
model data, otorisasi Staff/Admin/Controller/Shareholder, dampak pada simulasi,
risiko terhadap kas/kurs/regulator, test yang perlu ditambah, dan rollback.
Jangan menulis kode sampai rencana disetujui.
```

### Memperbaiki bug

```text
Telusuri akar masalah bug berikut, bukan hanya gejalanya: [ERROR/GEJALA].
Periksa log dan test yang relevan. Tambahkan test regresi yang gagal sebelum perbaikan
jika memungkinkan. Jangan mengubah data produksi. Setelah perbaikan, jalankan test,
type-check, build, dan jelaskan bukti hasilnya.
```

### Audit keamanan

```text
Audit kode autentikasi, otorisasi tRPC, impor workbook, pelaporan regulator,
dan isolasi simulasi. Fokus pada kebocoran rahasia, privilege escalation, injection,
dan kemungkinan data latihan tertulis ke produksi. Beri temuan berdasarkan file/baris,
rencana perbaikan, test, serta risiko residual. Jangan melakukan tindakan destruktif.
```

### Optimasi UI

```text
Tinjau halaman [RUTE] untuk Staff dengan kemampuan teknis menengah/bawah.
Pertahankan pembagian fitur yang jelas, status loading/empty/error, keyboard access,
dan penjelasan tindakan kritis. Ambil screenshot sebelum dan sesudah. Jangan mengubah
workflow persetujuan, aktivasi kurs, atau pengiriman regulator.
```

## Area Pengembangan yang Layak Diprioritaskan

1. **Pemisahan bundle klien:** build saat ini memberi peringatan ukuran chunk di atas 500 KB. Tinjau lazy loading halaman besar tanpa memengaruhi kontrol akses atau alur kas.
2. **Penggantian/isolasi parser workbook:** evaluasi parser alternatif jika terdapat rilis aman; sampai itu tersedia pertahankan guard workbook dan input manual.
3. **Observability produksi:** tambahkan pemantauan error dan audit performa yang tidak mengirim data KYC/nominal sensitif ke pihak ketiga.
4. **Kesiapan regulator formal:** hanya setelah perusahaan memperoleh format, kanal, jadwal, kredensial, serta kuasa resmi tertulis.

## Pemeriksaan Instruksi Berkala

Tinjau `CLAUDE.md` dan `.claude/rules/` setelah setiap insiden, temuan code review, perubahan regulasi, atau perubahan arsitektur yang besar. Hapus aturan yang usang atau bertentangan, dan pindahkan prosedur panjang dari `CLAUDE.md` ke dokumen/rule bertopik agar instruksi inti tetap mudah dipatuhi.[1]

## Referensi

[1] [How Claude remembers your project — Claude Code Docs](https://code.claude.com/docs/en/memory)  
[2] [Best practices for Claude Code — Claude Code Docs](https://code.claude.com/docs/en/best-practices)  
[3] [Claude Code overview — Claude Code Docs](https://code.claude.com/docs/en/overview)
