# Daring, satu perusahaan per instalasi, siap white-label

Tanggal: 12 November 2026 (WIB). Diputuskan pemilik di chat.

## Keputusan

1. **Arah aplikasi desktop Windows (26 September 2026) dicabut seluruhnya.** Aplikasi berjalan daring.
2. **Model seperti tokoemas-superapp:** satu money changer = satu deployment + satu basis data sendiri.
   PT Ibukota Valasindo adalah pengguna pertama (produksi sudah di VPS).
3. **Dapat di-white-label untuk money changer lain:** identitas perusahaan (nama, logo, palet/warna utama,
   halaman kurs publik, kop dokumen) adalah **data pengaturan per perusahaan**, bukan konstanta di kode.
   Menjual ke perusahaan lain = deployment baru + basis data baru + wizard penyiapan, tanpa mengubah kode.
4. **Bukan SaaS multi-tenant bersama** (keputusan 3 September: `solvinc_platform`, login pemilik SOLVINC,
   `mc_t_<kode>` dalam satu server) — tidak dikerjakan.

## Akibat teknis (keputusan Claude)

- `server/tenantContext.ts` + `server/tenantRegistry.ts` bawaannya `single` dan tidak mengganggu. Strategi
  `subdomain`, `scripts/tenant.mjs`, dan `tenantIsolation.live.test.ts` menjadi kandidat pembersihan kecil;
  tidak mendesak.
- Wizard penyiapan (`/siapkan`, sub-proyek 2) dan pemilih palet sudah menjadi fondasi white-label.
  Audit mencari sisa nama/identitas "Ibukota Valasindo" yang masih tertanam di kode.
- Langkah berikut: audit kualitas (uji penuh, alur berisiko), lalu "V2 di tempat" modul demi modul —
  bukan tulis ulang dari nol.
