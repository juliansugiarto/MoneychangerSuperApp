/**
 * Struktur form B0002, B0003, dan B0004 sebagai data.
 *
 * Temuan pemeriksaan Bank Indonesia butir 7.1 berbunyi: penyelenggara tidak dapat menunjukkan buku
 * besar sebagai dasar penyusunan masing-masing pos laporan keuangan. Selama angka laporan diketik
 * ulang ke berkas Excel BI, temuan itu hidup kembali pada setiap penyampaian. Berkas ini menuliskan
 * tata letak ketiga form supaya buku besar dapat menghasilkan berkasnya sendiri.
 *
 * Sumbernya adalah ketiga form milik perusahaan yang ditunjukkan pengguna 7 September 2026. Yang
 * diambil hanya strukturnya — label, urutan, indentasi, kolom, dan Jumlah Record. Tidak satu pun
 * nominalnya disalin ke sini, ke uji, maupun ke dokumentasi; aturan keras CLAUDE.md.
 *
 * Daftar ini sengaja tidak dapat diubah pengguna, dengan alasan yang sama seperti bagan akun: form
 * regulator ditinjau sekali, dan kekeliruan di sini menurun ke setiap pelanggan sekaligus.
 */

export type FormCode = "B0002" | "B0003" | "B0004";

/** Sisi bertanda dari satu saldo. Form memisahkan Laba dari Rugi; buku besar tidak. */
export type ValueSide = "POSITIF" | "NEGATIF";

/** B0002 berkolom dua: aset di kiri, kewajiban dan ekuitas di kanan. */
export type FormSide = "KIRI" | "KANAN";

/**
 * Kolom nilai.
 *
 * `RINCI` dan `POKOK` adalah dua kolom angka pada B0002 dan B0003: pos yang tergabung dalam sebuah
 * subtotal ditulis menjorok pada `RINCI`, pos yang berdiri sendiri dan seluruh subtotal ditulis
 * pada `POKOK`. Kolomnya ditulis apa adanya dari formnya, bukan diturunkan dari indentasi — pada
 * B0003 "Pendapatan Pengiriman Uang" berindentasi nol tetapi tetap berada di kolom `RINCI`.
 *
 * `MODAL_DISETOR`, `LABA_DITAHAN`, dan `JUMLAH` adalah tiga kolom angka B0004.
 */
export type FormColumn = "RINCI" | "POKOK" | "MODAL_DISETOR" | "LABA_DITAHAN" | "JUMLAH";

/**
 * Pos perubahan ekuitas. B0004 tidak meminta saldo satu akun melainkan angka yang hanya laporan
 * yang tahu: saldo awal tahun, laba periode berjalan, dan dividen periode berjalan.
 */
export type EquityMeasure = "MODAL_AWAL" | "LABA_DITAHAN_AWAL" | "LABA_PERIODE" | "DIVIDEN" | "EKUITAS_LAIN";

/** Satu suku penjumlahan sebuah subtotal. `column` hanya perlu bila baris rujukannya berkolom banyak. */
export type SubtotalTerm = { key: string; column?: FormColumn; sign: 1 | -1 };

export type FormValueSource =
  /** Saldo satu akun, searah saldo normalnya. */
  | { kind: "AKUN"; code: string }
  /** Satu sisi dari saldo bertanda sebuah akun; sisi yang tidak terpakai bernilai nol. */
  | { kind: "SISI"; code: string; side: ValueSide }
  /** Pos perubahan ekuitas, dengan sisi bila formnya memisahkannya. */
  | { kind: "EKUITAS"; measure: EquityMeasure; side?: ValueSide }
  /** Dihitung dari baris lain, tidak diisi. */
  | { kind: "SUBTOTAL"; of: SubtotalTerm[] };

export type FormCell = { column: FormColumn; source: FormValueSource };

export type FormRow = {
  /** Kunci internal yang stabil. Bukan nomor baris pada berkas, dan tidak pernah tercetak. */
  key: string;
  /**
   * Label persis seperti pada formnya. `{TAHUN}` dan `{TAHUN-1}` diganti tahun buku saat menulis
   * berkas; form aslinya menuliskan salah satunya sebagai "200X-1" dan satunya lagi sebagai tahun
   * yang sudah terisi, jadi keduanya diperlakukan sama.
   */
  label: string;
  indent: 0 | 1 | 2;
  /** Hanya B0002. */
  side?: FormSide;
  /** Kosong berarti baris judul: berlabel, tanpa nilai. */
  cells: FormCell[];
  /**
   * Diisi bila baris ini memang selalu nol hari ini. Barisnya tetap ada karena formulir regulator
   * memintanya; alasannya ikut tercetak pada lembar penelusuran, bukan disembunyikan.
   */
  alwaysZeroReason?: string;
};

export type RegulatoryForm = {
  code: FormCode;
  title: string;
  /** Angka "Jumlah Record" pada header form: banyaknya baris berisi, bukan banyaknya sel berisi. */
  recordCount: number;
  rows: FormRow[];
};

const akun = (column: FormColumn, code: string): FormCell => ({ column, source: { kind: "AKUN", code } });
const sisi = (column: FormColumn, code: string, side: ValueSide): FormCell => ({ column, source: { kind: "SISI", code, side } });
const ekuitas = (column: FormColumn, measure: EquityMeasure, side?: ValueSide): FormCell => ({ column, source: { kind: "EKUITAS", measure, side } });
const subtotal = (column: FormColumn, of: SubtotalTerm[]): FormCell => ({ column, source: { kind: "SUBTOTAL", of } });
const plus = (key: string, column?: FormColumn): SubtotalTerm => ({ key, column, sign: 1 });
const minus = (key: string, column?: FormColumn): SubtotalTerm => ({ key, column, sign: -1 });

const EKUITAS_LAIN_BELUM_ADA =
  "Belum ada modul yang menjurnal pergerakan ekuitas selain setoran modal, laba periode, dan dividen. "
  + "Barisnya diminta form B0004, jadi ia tetap ada dan bernilai nol.";

const B0002: RegulatoryForm = {
  code: "B0002",
  title: "Laporan Keuangan Neraca",
  recordCount: 19,
  rows: [
    // ASET
    { key: "aset-kas-bank-rp", label: "Kas dan Bank dalam Rp", indent: 0, side: "KIRI", cells: [] },
    { key: "aset-kas-rp", label: "Kas", indent: 1, side: "KIRI", cells: [akun("RINCI", "1-1110")] },
    { key: "aset-bank-rp", label: "Bank", indent: 1, side: "KIRI", cells: [akun("RINCI", "1-1120")] },
    { key: "aset-kas-bank-rp-jumlah", label: "", indent: 0, side: "KIRI", cells: [subtotal("POKOK", [plus("aset-kas-rp"), plus("aset-bank-rp")])] },

    { key: "aset-kas-bank-uka", label: "Kas dan Bank dalam UKA", indent: 0, side: "KIRI", cells: [] },
    { key: "aset-kas-uka", label: "Kas dalam UKA", indent: 1, side: "KIRI", cells: [akun("RINCI", "1-1210")] },
    { key: "aset-bank-uka", label: "Bank", indent: 1, side: "KIRI", cells: [akun("RINCI", "1-1220")] },
    { key: "aset-kas-bank-uka-jumlah", label: "", indent: 0, side: "KIRI", cells: [subtotal("POKOK", [plus("aset-kas-uka"), plus("aset-bank-uka")])] },

    { key: "aset-piutang-tc", label: "Piutang TC", indent: 0, side: "KIRI", cells: [akun("POKOK", "1-1310")] },
    { key: "aset-piutang-lain", label: "Piutang Lain-Lain", indent: 0, side: "KIRI", cells: [akun("POKOK", "1-1320")] },
    { key: "aset-sewa-dimuka", label: "Sewa dibayar dimuka", indent: 0, side: "KIRI", cells: [akun("POKOK", "1-1410")] },
    { key: "aset-asuransi-dimuka", label: "Asuransi dibayar dimuka", indent: 0, side: "KIRI", cells: [akun("POKOK", "1-1420")] },

    { key: "aset-tetap", label: "Aset Tetap", indent: 0, side: "KIRI", cells: [] },
    { key: "aset-tetap-perolehan", label: "Harga Perolehan ( - )", indent: 1, side: "KIRI", cells: [akun("RINCI", "1-1510")] },
    { key: "aset-tetap-akumulasi-penyusutan", label: "Akum.Penyusutan (-/-)", indent: 1, side: "KIRI", cells: [akun("RINCI", "1-1520")] },
    { key: "aset-tetap-jumlah", label: "", indent: 0, side: "KIRI", cells: [subtotal("POKOK", [plus("aset-tetap-perolehan"), minus("aset-tetap-akumulasi-penyusutan")])] },

    { key: "aset-lain", label: "Aset Lain-lain", indent: 0, side: "KIRI", cells: [akun("POKOK", "1-1900")] },
    {
      key: "aset-jumlah",
      label: "Jumlah Aset",
      indent: 0,
      side: "KIRI",
      cells: [subtotal("POKOK", [
        plus("aset-kas-bank-rp-jumlah"), plus("aset-kas-bank-uka-jumlah"), plus("aset-piutang-tc"), plus("aset-piutang-lain"),
        plus("aset-sewa-dimuka"), plus("aset-asuransi-dimuka"), plus("aset-tetap-jumlah"), plus("aset-lain"),
      ])],
    },

    // KEWAJIBAN DAN EKUITAS
    { key: "kewajiban", label: "KEWAJIBAN", indent: 0, side: "KANAN", cells: [] },
    { key: "kewajiban-pinjaman", label: "Pinjaman yang diterima", indent: 0, side: "KANAN", cells: [] },
    { key: "kewajiban-pinjaman-rp", label: "Dalam Rupiah", indent: 1, side: "KANAN", cells: [akun("RINCI", "2-1110")] },
    { key: "kewajiban-pinjaman-uka", label: "Dalam UKA", indent: 1, side: "KANAN", cells: [akun("RINCI", "2-1120")] },
    { key: "kewajiban-pinjaman-jumlah", label: "", indent: 0, side: "KANAN", cells: [subtotal("POKOK", [plus("kewajiban-pinjaman-rp"), plus("kewajiban-pinjaman-uka")])] },

    { key: "kewajiban-hutang-sewa", label: "Hutang Sewa", indent: 0, side: "KANAN", cells: [akun("POKOK", "2-1200")] },
    { key: "kewajiban-pengiriman-uang", label: "Kewajiban Pengiriman Uang", indent: 0, side: "KANAN", cells: [akun("POKOK", "2-1300")] },
    { key: "kewajiban-lain", label: "Kewajiban Lain-Lain", indent: 0, side: "KANAN", cells: [akun("POKOK", "2-1900")] },
    {
      key: "kewajiban-jumlah",
      label: "",
      indent: 0,
      side: "KANAN",
      cells: [subtotal("POKOK", [plus("kewajiban-pinjaman-jumlah"), plus("kewajiban-hutang-sewa"), plus("kewajiban-pengiriman-uang"), plus("kewajiban-lain")])],
    },

    { key: "ekuitas", label: "EKUITAS", indent: 0, side: "KANAN", cells: [] },
    { key: "ekuitas-modal-disetor", label: "Modal Disetor", indent: 0, side: "KANAN", cells: [akun("POKOK", "3-1100")] },
    { key: "ekuitas-laba-ditahan", label: "Laba ditahan/(akum. rugi) - net", indent: 0, side: "KANAN", cells: [] },
    { key: "ekuitas-laba-ditahan-laba", label: "- Laba", indent: 1, side: "KANAN", cells: [sisi("POKOK", "3-2100", "POSITIF")] },
    { key: "ekuitas-laba-ditahan-rugi", label: "- Rugi (-/-)", indent: 1, side: "KANAN", cells: [sisi("POKOK", "3-2100", "NEGATIF")] },
    {
      key: "ekuitas-jumlah",
      label: "",
      indent: 0,
      side: "KANAN",
      cells: [subtotal("POKOK", [plus("ekuitas-modal-disetor"), plus("ekuitas-laba-ditahan-laba"), minus("ekuitas-laba-ditahan-rugi")])],
    },
    {
      key: "kewajiban-ekuitas-jumlah",
      label: "Jumlah Kewajiban dan Ekuitas",
      indent: 0,
      side: "KANAN",
      cells: [subtotal("POKOK", [plus("kewajiban-jumlah"), plus("ekuitas-jumlah")])],
    },
  ],
};

const BEBAN_OPERASIONAL: { key: string; label: string; code: string }[] = [
  { key: "beban-gaji", label: "Gaji, Upah, dan Tunjangan", code: "6-1100" },
  { key: "beban-sewa", label: "Sewa", code: "6-1200" },
  { key: "beban-iklan", label: "Iklan dan promosi", code: "6-1300" },
  { key: "beban-utilitas", label: "Air, Listrik, dan Telepon", code: "6-1400" },
  { key: "beban-transportasi", label: "Transportasi dan Perjalanan", code: "6-1500" },
  { key: "beban-pemeliharaan-kendaraan", label: "Pemeliharaan kendaraan", code: "6-1600" },
  { key: "beban-penyusutan", label: "Penyusutan Asset Tetap", code: "6-1700" },
  { key: "beban-asuransi", label: "Asuransi", code: "6-1800" },
  { key: "beban-lain", label: "Lain-lain", code: "6-1900" },
];

const B0003: RegulatoryForm = {
  code: "B0003",
  title: "Laporan Keuangan Laba/Rugi",
  recordCount: 25,
  rows: [
    { key: "pendapatan-beban-operasional", label: "Pendapatan dan Beban Operasional", indent: 0, cells: [] },

    { key: "pendapatan-operasional", label: "Pendapatan Operasional", indent: 0, cells: [] },
    { key: "penjualan-uka", label: "Penjualan UKA", indent: 2, cells: [akun("RINCI", "4-1100")] },
    { key: "pencairan-tc", label: "Pencairan TC", indent: 2, cells: [akun("RINCI", "4-1200")] },
    { key: "pendapatan-operasional-jumlah", label: "", indent: 0, cells: [subtotal("POKOK", [plus("penjualan-uka"), plus("pencairan-tc")])] },

    { key: "harga-pokok-penjualan", label: "Harga Pokok Penjualan", indent: 0, cells: [] },
    { key: "hpp-saldo-awal", label: "Saldo Awal UKA dan TC", indent: 2, cells: [akun("RINCI", "5-1100")] },
    { key: "hpp-pembelian", label: "Pembelian UKA dan TC", indent: 2, cells: [akun("RINCI", "5-1200")] },
    { key: "hpp-saldo-akhir", label: "Saldo Akhir UKA dan TC (-)", indent: 2, cells: [akun("RINCI", "5-1300")] },
    { key: "hpp-jumlah", label: "", indent: 0, cells: [subtotal("POKOK", [plus("hpp-saldo-awal"), plus("hpp-pembelian"), minus("hpp-saldo-akhir")])] },

    { key: "laba-kotor-uka-tc", label: "Pendapatan/(Rugi) Operasional Kotor UKA-TC", indent: 0, cells: [subtotal("POKOK", [plus("pendapatan-operasional-jumlah"), minus("hpp-jumlah")])] },
    { key: "pendapatan-pengiriman-uang", label: "Pendapatan Pengiriman Uang", indent: 0, cells: [akun("RINCI", "4-2100")] },
    { key: "laba-kotor", label: "Pendapatan/(Rugi) Operasional Kotor", indent: 0, cells: [subtotal("POKOK", [plus("laba-kotor-uka-tc"), plus("pendapatan-pengiriman-uang")])] },

    { key: "beban-operasional", label: "Beban Operasional", indent: 0, cells: [] },
    ...BEBAN_OPERASIONAL.map((beban): FormRow => ({ key: beban.key, label: beban.label, indent: 2, cells: [akun("RINCI", beban.code)] })),
    { key: "beban-operasional-jumlah", label: "", indent: 0, cells: [subtotal("POKOK", BEBAN_OPERASIONAL.map((beban) => plus(beban.key)))] },

    { key: "laba-operasional-bersih", label: "Pendapatan/(Rugi) Operasional Bersih", indent: 0, cells: [subtotal("POKOK", [plus("laba-kotor"), minus("beban-operasional-jumlah")])] },

    { key: "lain-lain", label: "Pendapatan/(Beban) Lain-lain", indent: 0, cells: [] },
    { key: "pendapatan-bunga-bank", label: "Pendapatan Bunga Bank", indent: 2, cells: [akun("RINCI", "7-1100")] },
    { key: "biaya-administrasi-bank", label: "Biaya Administrasi Bank (-)", indent: 2, cells: [akun("RINCI", "7-1200")] },
    { key: "biaya-bunga-pinjaman", label: "Biaya Bunga Pinjaman (-)", indent: 2, cells: [akun("RINCI", "7-1300")] },

    { key: "jual-aset-tetap", label: "Laba/(Rugi) Penjualan Aset Tetap (net)", indent: 2, cells: [] },
    { key: "jual-aset-tetap-laba", label: "Laba", indent: 2, cells: [sisi("RINCI", "7-1400", "POSITIF")] },
    { key: "jual-aset-tetap-rugi", label: "Rugi (-)", indent: 2, cells: [sisi("RINCI", "7-1400", "NEGATIF")] },

    { key: "selisih-kurs", label: "Laba/(Rugi) Selisih Kurs (net)", indent: 2, cells: [] },
    { key: "selisih-kurs-laba", label: "Laba", indent: 2, cells: [sisi("RINCI", "7-1500", "POSITIF")] },
    { key: "selisih-kurs-rugi", label: "Rugi (-)", indent: 2, cells: [sisi("RINCI", "7-1500", "NEGATIF")] },

    { key: "lain-lain-net", label: "Lain-Lain", indent: 2, cells: [] },
    { key: "lain-lain-pendapatan", label: "Pendapatan", indent: 2, cells: [sisi("RINCI", "7-1900", "POSITIF")] },
    { key: "lain-lain-beban", label: "Beban (-)", indent: 2, cells: [sisi("RINCI", "7-1900", "NEGATIF")] },

    {
      key: "lain-lain-jumlah",
      label: "",
      indent: 0,
      cells: [subtotal("POKOK", [
        plus("pendapatan-bunga-bank"), minus("biaya-administrasi-bank"), minus("biaya-bunga-pinjaman"),
        plus("jual-aset-tetap-laba"), minus("jual-aset-tetap-rugi"),
        plus("selisih-kurs-laba"), minus("selisih-kurs-rugi"),
        plus("lain-lain-pendapatan"), minus("lain-lain-beban"),
      ])],
    },

    { key: "laba-sebelum-pajak", label: "Laba/(Rugi) Sebelum Pajak Penghasilan", indent: 0, cells: [subtotal("POKOK", [plus("laba-operasional-bersih"), plus("lain-lain-jumlah")])] },
    { key: "taksiran-pajak-penghasilan", label: "Taksiran Pajak Penghasilan (-)", indent: 0, cells: [akun("RINCI", "8-1100")] },
    { key: "laba-bersih", label: "Laba/(Rugi) Bersih", indent: 0, cells: [subtotal("POKOK", [plus("laba-sebelum-pajak"), minus("taksiran-pajak-penghasilan")])] },
  ],
};

const B0004: RegulatoryForm = {
  code: "B0004",
  title: "Laporan Keuangan Perubahan Ekuitas",
  recordCount: 7,
  rows: [
    {
      key: "saldo-awal",
      label: "Saldo per tgl 31 Des {TAHUN-1} (net)",
      indent: 0,
      cells: [subtotal("JUMLAH", [
        plus("saldo-awal-positif", "MODAL_DISETOR"), plus("saldo-awal-positif", "LABA_DITAHAN"), minus("saldo-awal-negatif", "LABA_DITAHAN"),
      ])],
    },
    {
      key: "saldo-awal-positif",
      label: "- Saldo Positif",
      indent: 1,
      cells: [ekuitas("MODAL_DISETOR", "MODAL_AWAL"), ekuitas("LABA_DITAHAN", "LABA_DITAHAN_AWAL", "POSITIF")],
    },
    { key: "saldo-awal-negatif", label: "- Saldo Negatif", indent: 1, cells: [ekuitas("LABA_DITAHAN", "LABA_DITAHAN_AWAL", "NEGATIF")] },

    {
      key: "laba-periode",
      label: "Laba/(Rugi) periode berjalan (net)",
      indent: 0,
      cells: [subtotal("JUMLAH", [plus("laba-periode-laba"), minus("laba-periode-rugi")])],
    },
    { key: "laba-periode-laba", label: "- Laba", indent: 1, cells: [ekuitas("LABA_DITAHAN", "LABA_PERIODE", "POSITIF")] },
    { key: "laba-periode-rugi", label: "- Rugi (-)", indent: 1, cells: [ekuitas("LABA_DITAHAN", "LABA_PERIODE", "NEGATIF")] },

    {
      key: "dividen",
      label: "Pembagian dividen (-/-)",
      indent: 0,
      cells: [ekuitas("LABA_DITAHAN", "DIVIDEN"), subtotal("JUMLAH", [minus("dividen", "LABA_DITAHAN")])],
    },

    {
      key: "ekuitas-lain",
      label: "Lain-lain (net)",
      indent: 0,
      cells: [subtotal("JUMLAH", [plus("ekuitas-lain-menambah"), minus("ekuitas-lain-mengurangi")])],
    },
    {
      key: "ekuitas-lain-menambah",
      label: "- Menambah Ekuitas",
      indent: 1,
      cells: [ekuitas("LABA_DITAHAN", "EKUITAS_LAIN", "POSITIF")],
      alwaysZeroReason: EKUITAS_LAIN_BELUM_ADA,
    },
    {
      key: "ekuitas-lain-mengurangi",
      label: "- Mengurangi Ekuitas (-)",
      indent: 1,
      cells: [ekuitas("LABA_DITAHAN", "EKUITAS_LAIN", "NEGATIF")],
      alwaysZeroReason: EKUITAS_LAIN_BELUM_ADA,
    },

    {
      key: "saldo-akhir",
      label: "Saldo per tanggal 31 Des {TAHUN}",
      indent: 0,
      cells: [
        subtotal("MODAL_DISETOR", [plus("saldo-awal-positif", "MODAL_DISETOR")]),
        subtotal("LABA_DITAHAN", [
          plus("saldo-awal-positif", "LABA_DITAHAN"), minus("saldo-awal-negatif", "LABA_DITAHAN"),
          plus("laba-periode-laba"), minus("laba-periode-rugi"),
          minus("dividen", "LABA_DITAHAN"),
          plus("ekuitas-lain-menambah"), minus("ekuitas-lain-mengurangi"),
        ]),
        subtotal("JUMLAH", [plus("saldo-akhir", "MODAL_DISETOR"), plus("saldo-akhir", "LABA_DITAHAN")]),
      ],
    },
  ],
};

export const REGULATORY_FORMS: RegulatoryForm[] = [B0002, B0003, B0004];

const BY_CODE = new Map(REGULATORY_FORMS.map((form) => [form.code, form]));

export const findRegulatoryForm = (code: FormCode) => BY_CODE.get(code) ?? null;

/** Sel yang harus diisi dari buku besar; subtotal tidak termasuk karena ia dihitung. */
export const isValueCell = (cell: FormCell) => cell.source.kind !== "SUBTOTAL";

/** Baris yang dihitung sebagai satu Record pada header form: baris berisi, bukan sel berisi. */
export const recordRows = (form: RegulatoryForm) => form.rows.filter((row) => row.cells.some(isValueCell));

/** Label dengan `{TAHUN}` dan `{TAHUN-1}` yang sudah diganti tahun buku. */
export const renderFormLabel = (label: string, fiscalYear: number) =>
  label.replaceAll("{TAHUN-1}", String(fiscalYear - 1)).replaceAll("{TAHUN}", String(fiscalYear));

/**
 * Judul kelompok terdekat di atas sebuah baris, pada sisi lembar yang sama.
 *
 * Label pos **tidak unik**: B0002 memuat dua baris "Bank", dan B0003 memuat dua baris "Laba" serta
 * dua baris "Rugi (-)". Mencocokkan berkas impor lewat label saja karena itu akan menabrakkan
 * baris-baris itu satu sama lain. Judul kelompoknya yang membedakan, dan pasangan judul+label
 * inilah kunci yang dipakai importir.
 */
export function groupHeadingFor(form: RegulatoryForm, index: number): string {
  const row = form.rows[index]!;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = form.rows[cursor]!;
    if (candidate.side !== row.side) continue;
    if (candidate.cells.length === 0 && candidate.label) return candidate.label;
  }
  return "";
}

/** Kunci pencocokan importir: judul kelompok dan label pos, dinormalkan. */
export const formMatchKey = (heading: string, label: string) => `${normalizeFormLabel(heading)}|${normalizeFormLabel(label)}`;

/**
 * Normalisasi label form.
 *
 * Penanda tanda kurang (`(-)`, `(-/-)`, `( - )`), penanda `(net)`, angka tahun, dan spasi ganda
 * dibuang: form aslinya menulis "Saldo per tgl 31 Des 200X-1 (net)" pada satu baris dan tahun yang
 * sudah terisi pada baris lain, dan keduanya harus dikenali sebagai pos yang sama.
 */
export function normalizeFormLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/\{tahun(-1)?\}/g, " ")
    .replace(/\d+x(-\d+)?/g, " ")
    .replace(/\(\s*-\s*(\/\s*-\s*)?\)/g, " ")
    .replace(/\(net\)/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim();
}
