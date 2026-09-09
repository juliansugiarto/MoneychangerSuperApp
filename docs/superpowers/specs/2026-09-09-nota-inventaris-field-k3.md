# Paket K3 — Inventaris field nota (separuh yang tidak menunggu naskah)

**Ditulis 9 September 2026.** Paket K3 adalah pembandingan nota terhadap **SE BI 18/41/DKSP**, dan
naskahnya **belum ada di proyek** — dicari ulang hari ini: `18/41`, `DKSP`, `SE BI`, dan
`Surat Edaran` di seluruh repo hanya menemukan **SE BI 18/42/DKSP**, surat edaran yang *berbeda*
(Laporan Kegiatan Usaha), dirujuk `docs/regulatory-reporting-design-2026-08-24.md`. Rujukan regulasi
satu-satunya pada nota tetap **PBI No. 18/20/PBI/2016**.

Aturan proyek melarang menebak skema regulator, jadi pembandingannya tidak dapat dimulai. Yang
**dapat** dikerjakan tanpa naskahnya adalah separuh yang tidak bergantung padanya: mencatat apa yang
nota cetak hari ini, supaya begitu naskahnya tiba pekerjaannya tinggal satu kali pembandingan
berdampingan.

Sumbernya `printBon()` — `client/src/pages/Transactions.tsx:41` dan seterusnya.

## Yang dicetak nota hari ini

**Identitas penyelenggara** (hasil perbaikan temuan pemeriksaan 4; dijaga
`server/notaKupvaIdentity.test.ts`)

| Field | Sumber |
|---|---|
| Nama badan hukum | `company.legalEntityName` |
| Nama dagang | `company.tradeName`, sebagai keterangan di bawahnya |
| Kode KUPVA | `company.kupvaCode` |
| Nomor izin | `company.licenseNumber` |
| Alamat | `company.address` |
| Telepon | `company.phone` |
| Logo | `logoImg` |

**Identitas transaksi dan nasabah**

| Field | Keterangan |
|---|---|
| Nomor nota | `transaction.receiptNumber` |
| Jenis transaksi | `typeCode` (beli/jual) |
| Nama nasabah | |
| No. KTP/Paspor | |
| No. HP | |
| Alamat | |
| Diwakili oleh | Bila bertransaksi lewat kuasa |
| Sumber Dana | |
| Tujuan Transaksi | `transactionPurposeSnapshot` |

**Rincian nilai**

| Field | Keterangan |
|---|---|
| Mata Uang, Kurs, Jumlah | Per baris mata uang |
| Pecahan, Lembar | Rincian pecahan per baris |
| Jumlah (Rupiah) per baris | `formatIdrDecimal(line.rupiahAmount)` |
| Jumlah Total | |
| Cara Bayar | Tunai atau transfer |
| Rekening pengirim/tujuan | Hanya pada pembayaran non-tunai |

**Penutup**

| Field | Keterangan |
|---|---|
| Teller | Nama petugas |
| Tanda tangan kedua pihak | Nasabah dan Teller |
| Disclaimer PBI 18/20/PBI/2016 | Dicetak apa adanya |

## Yang dibutuhkan dari pengguna sebelum K3 dapat dimulai

Naskah **SE BI 18/41/DKSP**, atau setidaknya **daftar field wajib nota** menurut surat edaran itu.
Bentuk apa pun cukup — PDF, salinan tempel, atau foto halamannya — asalkan berasal dari naskah
resmi, bukan ingatan.

Sesudah naskahnya ada, kerjanya tinggal: bandingkan daftar di atas terhadap daftar wajibnya, tambah
field yang kurang beserta ujinya, dan perbarui `server/notaKupvaIdentity.test.ts` agar menjaga
field baru itu juga.

**Jangan menebak daftarnya.** Nota yang tampak lengkap tetapi tidak sesuai ketentuan adalah persis
temuan yang sedang ditutup, dan menebaknya membuat temuan itu tampak selesai padahal tidak.
