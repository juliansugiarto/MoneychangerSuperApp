# Handoff — baca ini dulu

Diperbarui 3 September 2026. Menggantikan isi sebelumnya yang sudah usang.

## Baca dulu, jangan diturunkan ulang dari kode

1. **`CLAUDE.md`** — aturan keras operasional dan gerbang mutu (`pnpm test && pnpm check && pnpm build`).
   Catatan: `pnpm` tidak ada di PATH mesin ini; pakai `./node_modules/.bin/*` langsung.
2. **Rencana produk** — https://claude.ai/code/artifact/b7f62d68-3a12-419e-b507-2e1345260a6b
   Berisi dua belas temuan pemeriksaan BI yang dipetakan ke kode, peta 35 tabel ke lapisan
   tenant/cabang, bagan akun, sembilan fase, dan pemeriksaan silang. **Ini dokumen pengarah utama.**
3. `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` dan `docs/SKEMA-DATABASE-PROJECT.md` untuk perilaku
   pengguna dan alasan struktur data.

## Keputusan yang sudah diambil (jangan dibuka ulang tanpa alasan baru)

- Produk ini dijual berlangganan lewat **SOLVINC.ID**; aplikasi money changer adalah salah satu
  produknya. Empat lapisan: `solvinc_platform`, `mc_reference`, `mc_t_<kode>`, dan kolom `branchId`.
- **Satu database per tenant**, bukan kolom `tenantId`. Alasannya ada di rencana.
- **Cabang adalah kolom di dalam database tenant**, bukan database terpisah.
- Hanya **pemilik usaha** yang punya akun SOLVINC (serah-terima token); staf masuk langsung ke
  aplikasi. Langganan berhenti: data disimpan 5 tahun, pemilik dapat memilih mode baca-saja.
- **MySQL dipertahankan**, bukan pindah ke Supabase. Alasan ada di riwayat percakapan: RLS tidak
  dibutuhkan pada model satu database per tenant, dan biaya port 223 query tidak sebanding.
- Akuntan opsional bagi pelanggan, tetapi **bagan akun produk perlu ditinjau akuntan satu kali**.

## Yang sudah selesai (7 commit belum di-push)

- Menu bertingkat dengan bahasa sehari-hari, satu nama per halaman (23 halaman), zona waktu
  operasional dapat dipilih di Profil Perusahaan, sesi pengembangan tidak putus tiap hot reload.
- **Fase 00 multi-tenant**: `server/tenantContext.ts` (AsyncLocalStorage), `server/tenantRegistry.ts`,
  `getDb()` yang memilih koneksi per tenant dan **gagal tertutup**, middleware mendahului seluruh
  rute, kolam koneksi dibatasi 4 per tenant.
- `scripts/tenant.mjs` — `list`, `provision <kode>`, `migrate-all`.
- Uji isolasi terhadap dua database sungguhan (`tenantIsolation.live.test.ts`), lewat sendiri bila
  `TENANT_TEST_SECONDARY_URL` tidak diatur. **315 uji lulus**, tsc dan build bersih.

## Rencana besok

1. **Tangkap format nota SINTA.** Aplikasi Bank Indonesia di https://app.sipuka.id (akun demo ada
   pada pengguna; **minta pengguna yang memasukkan sandi**, Claude tidak mengisi formulir sandi).
   Buat nasabah uji — SINTA mewajibkan unggah satu dokumen identitas, jadi siapkan berkas gambar
   sederhana — lalu satu transaksi penjualan, lalu cetak notanya. Nota itu penerapan resmi BI atas
   SE BI 18/41/DKSP dan menjadi acuan untuk **temuan 4**. Jangan tekan Escape saat modal terbuka;
   modalnya tertutup dan isian hilang.
2. **Fase 01 — dimensi cabang.** Tabel `branches`, kolom `branchId` pada tujuh tabel, dan empat
   indeks unik disusun ulang (`cash_balances_currency_uq`, `cash_denomination_balances_currency_value_uq`,
   `stock_opnames_date_currency_uq`, `daily_operational_checklist_date_uq`). Harus mendahului buku
   besar karena penjurnalan otomatis membaca tepat tabel-tabel itu.
3. **Fase 02–03 — fondasi buku besar.** Menjawab temuan 7.1 secara langsung.

Pekerjaan kecil bernilai tinggi yang bisa disisipkan kapan saja: aturan pengkinian profil nasabah
≤6 bulan, daftar pekerjaan terkendali yang menurunkan status PEP, kewajiban unggah dokumen
identitas, dan penomoran halaman pada daftar (jejak audit kini terpotong di 100 baris).

## Cara kerja yang diminta pengguna

- Verifikasi klaim regulasi ke naskah aslinya, jangan dari ingatan. Naskah SAK EP dan aturan
  penyusutan DJP sudah dibaca; ringkasannya tersimpan di memori.
- Jangan menebak skema; minta contoh berkas nyata.
- Konfirmasi lingkup sebelum perubahan lintas modul, dan **jangan pernah push atau deploy tanpa
  persetujuan pada giliran itu juga**.
- Jangan menyentuh produksi. Migrasi dijalankan di basis data lokal lebih dahulu.
