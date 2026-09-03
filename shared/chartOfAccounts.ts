/**
 * Bagan akun.
 *
 * Temuan pemeriksaan Bank Indonesia butir 7.1 berbunyi: penyelenggara tidak dapat menunjukkan buku
 * besar sebagai dasar penyusunan masing-masing pos dalam laporan keuangan. Karena itu setiap akun
 * di sini dipetakan langsung ke satu baris pada form B0002/B0003/B0004 — pemetaan itulah yang
 * membuat kalimat "pos laporan ini berasal dari buku besar" dapat ditunjukkan, bukan diklaim.
 *
 * Penomoran: 1 aset, 2 kewajiban, 3 ekuitas, 4 pendapatan, 5 harga pokok, 6 beban operasional,
 * 7 pendapatan/beban lain-lain, 8 pajak.
 *
 * Daftar ini sengaja tidak dapat diubah pengguna. Bagan akun produk hanya perlu ditinjau akuntan
 * satu kali; kekeliruan di sini menurun ke setiap pelanggan sekaligus, dan pelanggan berlangganan
 * justru karena tidak memiliki keahlian untuk menangkapnya.
 */

export type AccountType = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "HARGA_POKOK" | "BEBAN" | "LAIN_LAIN" | "PAJAK";
export type NormalBalance = "DEBIT" | "KREDIT";
export type ReportForm = "B0002" | "B0003" | "B0004";

export type AccountDefinition = {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  /** Akun lawan: saldo normalnya berlawanan dengan kelompoknya dan mengurangi pos induknya. */
  contra?: true;
  forms: ReportForm[];
};

export const CHART_OF_ACCOUNTS: AccountDefinition[] = [
  // Aset
  { code: "1-1110", name: "Kas Rupiah", type: "ASET", normalBalance: "DEBIT", forms: ["B0002"] },
  { code: "1-1120", name: "Bank Rupiah", type: "ASET", normalBalance: "DEBIT", forms: ["B0002"] },
  { code: "1-1210", name: "Kas UKA", type: "ASET", normalBalance: "DEBIT", forms: ["B0002"] },
  { code: "1-1220", name: "Bank UKA", type: "ASET", normalBalance: "DEBIT", forms: ["B0002"] },
  { code: "1-1310", name: "Piutang TC", type: "ASET", normalBalance: "DEBIT", forms: ["B0002"] },
  { code: "1-1320", name: "Piutang Lain-Lain", type: "ASET", normalBalance: "DEBIT", forms: ["B0002"] },
  { code: "1-1410", name: "Sewa Dibayar Dimuka", type: "ASET", normalBalance: "DEBIT", forms: ["B0002"] },
  { code: "1-1420", name: "Asuransi Dibayar Dimuka", type: "ASET", normalBalance: "DEBIT", forms: ["B0002"] },
  { code: "1-1510", name: "Aset Tetap — Harga Perolehan", type: "ASET", normalBalance: "DEBIT", forms: ["B0002"] },
  { code: "1-1520", name: "Akumulasi Penyusutan", type: "ASET", normalBalance: "KREDIT", contra: true, forms: ["B0002"] },
  { code: "1-1900", name: "Aset Lain-lain", type: "ASET", normalBalance: "DEBIT", forms: ["B0002"] },

  // Kewajiban
  { code: "2-1110", name: "Pinjaman Diterima — Rupiah", type: "KEWAJIBAN", normalBalance: "KREDIT", forms: ["B0002"] },
  { code: "2-1120", name: "Pinjaman Diterima — UKA", type: "KEWAJIBAN", normalBalance: "KREDIT", forms: ["B0002"] },
  { code: "2-1200", name: "Hutang Sewa", type: "KEWAJIBAN", normalBalance: "KREDIT", forms: ["B0002"] },
  { code: "2-1300", name: "Kewajiban Pengiriman Uang", type: "KEWAJIBAN", normalBalance: "KREDIT", forms: ["B0002"] },
  { code: "2-1900", name: "Kewajiban Lain-Lain", type: "KEWAJIBAN", normalBalance: "KREDIT", forms: ["B0002"] },

  // Ekuitas
  { code: "3-1100", name: "Modal Disetor", type: "EKUITAS", normalBalance: "KREDIT", forms: ["B0002", "B0004"] },
  { code: "3-2100", name: "Laba Ditahan", type: "EKUITAS", normalBalance: "KREDIT", forms: ["B0002", "B0004"] },
  { code: "3-3100", name: "Laba/(Rugi) Periode Berjalan", type: "EKUITAS", normalBalance: "KREDIT", forms: ["B0004"] },
  { code: "3-4100", name: "Dividen", type: "EKUITAS", normalBalance: "DEBIT", contra: true, forms: ["B0004"] },

  // Pendapatan dan harga pokok
  { code: "4-1100", name: "Penjualan UKA", type: "PENDAPATAN", normalBalance: "KREDIT", forms: ["B0003"] },
  { code: "4-1200", name: "Pencairan TC", type: "PENDAPATAN", normalBalance: "KREDIT", forms: ["B0003"] },
  { code: "4-2100", name: "Pendapatan Pengiriman Uang", type: "PENDAPATAN", normalBalance: "KREDIT", forms: ["B0003"] },
  { code: "5-1100", name: "Persediaan Awal UKA & TC", type: "HARGA_POKOK", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "5-1200", name: "Pembelian UKA & TC", type: "HARGA_POKOK", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "5-1300", name: "Persediaan Akhir UKA & TC", type: "HARGA_POKOK", normalBalance: "KREDIT", contra: true, forms: ["B0003"] },

  // Beban operasional — persis sembilan baris B0003, tidak lebih dan tidak kurang
  { code: "6-1100", name: "Gaji, Upah, dan Tunjangan", type: "BEBAN", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "6-1200", name: "Sewa", type: "BEBAN", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "6-1300", name: "Iklan dan Promosi", type: "BEBAN", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "6-1400", name: "Air, Listrik, dan Telepon", type: "BEBAN", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "6-1500", name: "Transportasi dan Perjalanan", type: "BEBAN", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "6-1600", name: "Pemeliharaan Kendaraan", type: "BEBAN", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "6-1700", name: "Penyusutan Aset Tetap", type: "BEBAN", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "6-1800", name: "Asuransi", type: "BEBAN", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "6-1900", name: "Lain-lain", type: "BEBAN", normalBalance: "DEBIT", forms: ["B0003"] },

  // Pendapatan/beban lain-lain dan pajak
  { code: "7-1100", name: "Pendapatan Bunga Bank", type: "LAIN_LAIN", normalBalance: "KREDIT", forms: ["B0003"] },
  { code: "7-1200", name: "Biaya Administrasi Bank", type: "LAIN_LAIN", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "7-1300", name: "Biaya Bunga Pinjaman", type: "LAIN_LAIN", normalBalance: "DEBIT", forms: ["B0003"] },
  { code: "7-1400", name: "Laba/(Rugi) Penjualan Aset Tetap", type: "LAIN_LAIN", normalBalance: "KREDIT", forms: ["B0003"] },
  { code: "7-1500", name: "Laba/(Rugi) Selisih Kurs", type: "LAIN_LAIN", normalBalance: "KREDIT", forms: ["B0003"] },
  { code: "7-1900", name: "Pendapatan/(Beban) Lain-Lain", type: "LAIN_LAIN", normalBalance: "KREDIT", forms: ["B0003"] },
  { code: "8-1100", name: "Taksiran Pajak Penghasilan", type: "PAJAK", normalBalance: "DEBIT", forms: ["B0003"] },
];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASET: "Aset",
  KEWAJIBAN: "Kewajiban",
  EKUITAS: "Ekuitas",
  PENDAPATAN: "Pendapatan",
  HARGA_POKOK: "Harga pokok",
  BEBAN: "Beban operasional",
  LAIN_LAIN: "Pendapatan/beban lain-lain",
  PAJAK: "Pajak",
};

/** Akun neraca tetap terbawa antar periode; akun laba rugi ditutup ke laba ditahan. */
export const BALANCE_SHEET_TYPES: AccountType[] = ["ASET", "KEWAJIBAN", "EKUITAS"];

export const isBalanceSheetAccount = (type: AccountType) => BALANCE_SHEET_TYPES.includes(type);

const BY_CODE = new Map(CHART_OF_ACCOUNTS.map((account) => [account.code, account]));

export const findAccount = (code: string) => BY_CODE.get(code) ?? null;

/**
 * Kode akun yang dipakai untuk mencatat selisih penjabaran kas valuta asing pada akhir periode
 * (SAK EP Bab 30). Dinamai di sini agar jurnal revaluasi tidak menebak kodenya sendiri.
 */
export const FX_REVALUATION_ACCOUNT_CODE = "7-1500";

/** Akun tempat laba rugi periode berjalan ditutup pada akhir tahun buku. */
export const RETAINED_EARNINGS_ACCOUNT_CODE = "3-2100";
