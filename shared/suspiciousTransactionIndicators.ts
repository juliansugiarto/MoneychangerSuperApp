/**
 * Curated TKM (Transaksi Keuangan Mencurigakan / suspicious transaction) indicators, per PPATK
 * guidance for KUPVA BB. Used both to render the checklist in TransactionCreate.tsx and to validate
 * server-side (never trust the client's list alone) — the same defense-in-depth pattern as
 * shared/currencyDenominations.ts.
 */
export type SuspiciousIndicatorCategory = {
  label: string;
  indicators: { code: string; label: string; description: string }[];
};

export const SUSPICIOUS_TRANSACTION_INDICATOR_CATEGORIES: SuspiciousIndicatorCategory[] = [
  {
    label: "Indikator Berdasarkan Perilaku Nasabah (Customer Behavior)",
    indicators: [
      { code: "MENOLAK_IDENTIFIKASI", label: "Menolak Identifikasi", description: "Nasabah enggan memberikan kartu identitas (KTP/Paspor) atau dokumen pendukung usaha yang sah." },
      { code: "DATA_PALSU", label: "Memberikan Data Palsu", description: "Informasi pekerjaan, alamat, atau nomor telepon yang diberikan tidak dapat diverifikasi atau fiktif." },
      { code: "GUGUP_MEMAKSA", label: "Gugup atau Memaksa", description: "Nasabah tampak sangat cemas, terburu-buru, atau mencoba menyuap/membujuk petugas agar transaksi tidak dicatat." },
      { code: "DIDAMPINGI_PIHAK_KETIGA", label: "Didampingi Pihak Ketiga", description: "Transaksi dilakukan oleh seseorang yang tampak dikendalikan atau diinstruksikan oleh orang lain di dekatnya." },
    ],
  },
  {
    label: "Indikator Berdasarkan Profil dan Transaksi (Transaction Profile)",
    indicators: [
      { code: "KETIDAKSESUAIAN_PROFIL", label: "Ketidaksesuaian Profil", description: "Nilai transaksi melonjak drastis, tidak sebanding dengan estimasi penghasilan atau jenis pekerjaan nasabah." },
      { code: "REKENING_DORMANT", label: "Aktivitas Rekening Dormant", description: "Rekening yang sudah lama pasif tiba-tiba menerima atau mengirimkan dana dalam jumlah sangat besar." },
      { code: "TANPA_TUJUAN_EKONOMI", label: "Transaksi Tanpa Tujuan Ekonomi", description: "Perpindahan dana antar-rekening atau penukaran valas yang kompleks tanpa alasan bisnis yang logis." },
      { code: "FREKUENSI_TINGGI", label: "Frekuensi Tinggi Aliran Dana", description: "Rekening menerima banyak transferan kecil lalu langsung ditarik tunai atau ditransfer keluar dalam jumlah total yang besar (pass-through account)." },
    ],
  },
  {
    label: "Indikator Khusus KUPVA BB (Money Changer) & Transfer Dana",
    indicators: [
      { code: "PECAHAN_TRANSAKSI", label: "Pecahan Transaksi (Structuring/Smurfing)", description: "Melakukan penukaran valas berulang kali dalam waktu berdekatan dengan nominal di bawah batas pelaporan tunai Rp100 juta." },
      { code: "MATA_UANG_TIDAK_LAZIM", label: "Mata Uang Tidak Lazim", description: "Menukarkan mata uang asing dari negara-negara berisiko tinggi (high-risk jurisdictions) tanpa dokumen perjalanan atau bisnis yang jelas." },
      { code: "PENGGUNAAN_BANYAK_NAMA", label: "Penggunaan Banyak Nama", description: "Memakai nama anggota keluarga atau kurir yang berbeda-beda untuk melakukan penukaran valas atau pengiriman uang demi menyembunyikan identitas asli pemilik dana (beneficial owner)." },
    ],
  },
];

export const ALL_SUSPICIOUS_INDICATOR_CODES = new Set(
  SUSPICIOUS_TRANSACTION_INDICATOR_CATEGORIES.flatMap((category) => category.indicators.map((indicator) => indicator.code)),
);

export function isKnownSuspiciousIndicatorCode(code: string) {
  return ALL_SUSPICIOUS_INDICATOR_CODES.has(code);
}
