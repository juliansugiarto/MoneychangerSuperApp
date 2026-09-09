/**
 * 33 parameter risiko inheren IRA beserta pita bawaannya.
 *
 * Strukturnya diambil dari lembar `A1. KUPVA BB` template BI — nama parameter, pengelompokan, dan
 * pola pitanya. Angka operasional PT IBV tidak ikut.
 *
 * **Skalanya terbalik dan itu ditulis besar-besar:** `5 = Rendah`, `1 = Tinggi`. Pita 0–20% bernilai
 * 5; 81–100% bernilai 1. Penilaian sesungguhnya (J2) yang menurunkan nilai dari pita; berkas ini
 * hanya menyimpan batasnya.
 */

/** Jenis risiko yang menaungi parameternya. Struktural berdiri sendiri, di luar TPPU/TPPT/PPSPM. */
export const IRA_PARAMETER_RISK_TYPES = ["TPPU", "TPPT", "PPSPM", "STRUKTURAL"] as const;
export type IraParameterRiskType = (typeof IRA_PARAMETER_RISK_TYPES)[number];

/**
 * Dihitung dari basis data atau dinyatakan penilainya.
 *
 * Yang **dinyatakan** bukan lubang: penulisnya borang penilaian itu sendiri, dan di layar diberi
 * label agar pemeriksa tahu mana angka mesin dan mana pernyataan manusia.
 */
export type IraParameterSource = "HITUNG" | "NYATAKAN";

export type IraParameter = {
  code: string;
  riskType: IraParameterRiskType;
  /** Kelompok pada A1, mis. "1" untuk Produk/Jasa. */
  group: string;
  label: string;
  source: IraParameterSource;
};

export const IRA_PARAMETERS: IraParameter[] = [
  { code: "TPPU_1A", riskType: "TPPU", group: "1", label: "Mata uang berisiko tinggi", source: "HITUNG" },
  { code: "TPPU_1B", riskType: "TPPU", group: "1", label: "Mata uang berisiko menengah", source: "HITUNG" },
  { code: "TPPU_2A", riskType: "TPPU", group: "2", label: "Jalur distribusi berisiko tinggi", source: "HITUNG" },
  { code: "TPPU_2B", riskType: "TPPU", group: "2", label: "Jalur distribusi berisiko menengah", source: "HITUNG" },
  { code: "TPPU_2C", riskType: "TPPU", group: "2", label: "Mitra kerja sama", source: "NYATAKAN" },
  { code: "TPPU_3A", riskType: "TPPU", group: "3", label: "Profesi nasabah berisiko tinggi", source: "HITUNG" },
  { code: "TPPU_3B", riskType: "TPPU", group: "3", label: "Profesi nasabah berisiko menengah", source: "HITUNG" },
  { code: "TPPU_3C", riskType: "TPPU", group: "3", label: "Badan hukum berisiko tinggi", source: "HITUNG" },
  { code: "TPPU_3D", riskType: "TPPU", group: "3", label: "Badan hukum berisiko menengah", source: "HITUNG" },
  { code: "TPPU_3E", riskType: "TPPU", group: "3", label: "Warga negara / badan hukum negara FATF", source: "HITUNG" },
  { code: "TPPU_4A", riskType: "TPPU", group: "4", label: "Lokasi operasional berisiko", source: "HITUNG" },
  { code: "TPPU_4B", riskType: "TPPU", group: "4", label: "Lokasi kantor berisiko", source: "HITUNG" },

  { code: "TPPT_1A", riskType: "TPPT", group: "1", label: "Mata uang berisiko tinggi", source: "HITUNG" },
  { code: "TPPT_1B", riskType: "TPPT", group: "1", label: "Mata uang berisiko menengah", source: "HITUNG" },
  { code: "TPPT_2A", riskType: "TPPT", group: "2", label: "Jalur distribusi berisiko tinggi", source: "HITUNG" },
  { code: "TPPT_2B", riskType: "TPPT", group: "2", label: "Jalur distribusi berisiko menengah", source: "HITUNG" },
  { code: "TPPT_3A", riskType: "TPPT", group: "3", label: "Profesi nasabah berisiko tinggi", source: "HITUNG" },
  { code: "TPPT_3B", riskType: "TPPT", group: "3", label: "Profesi nasabah berisiko menengah", source: "HITUNG" },
  { code: "TPPT_4A", riskType: "TPPT", group: "4", label: "Lokasi operasional berisiko", source: "HITUNG" },
  { code: "TPPT_4B", riskType: "TPPT", group: "4", label: "Lokasi kantor berisiko", source: "HITUNG" },

  { code: "PPSPM_1A", riskType: "PPSPM", group: "1", label: "Layanan berisiko tinggi", source: "HITUNG" },
  { code: "PPSPM_2A", riskType: "PPSPM", group: "2", label: "Mitra kerja sama asing", source: "NYATAKAN" },
  { code: "PPSPM_2B", riskType: "PPSPM", group: "2", label: "Mitra kerja sama negara sanksi PBB", source: "NYATAKAN" },
  { code: "PPSPM_3A", riskType: "PPSPM", group: "3", label: "Individu dari negara sanksi PBB", source: "HITUNG" },
  { code: "PPSPM_3B", riskType: "PPSPM", group: "3", label: "Profesi berisiko tinggi PPSPM", source: "HITUNG" },
  { code: "PPSPM_3C", riskType: "PPSPM", group: "3", label: "Badan usaha PT non-UMKM", source: "HITUNG" },
  { code: "PPSPM_4A", riskType: "PPSPM", group: "4", label: "Transaksi dengan negara sanksi PBB", source: "HITUNG" },

  { code: "STRUKTURAL_1A", riskType: "STRUKTURAL", group: "1", label: "Struktur kepemilikan", source: "NYATAKAN" },
  { code: "STRUKTURAL_1B", riskType: "STRUKTURAL", group: "1", label: "Pemilik/pengurus berstatus PEP", source: "NYATAKAN" },
  { code: "STRUKTURAL_1C", riskType: "STRUKTURAL", group: "1", label: "Kepemilikan nominee", source: "NYATAKAN" },
  { code: "STRUKTURAL_1D", riskType: "STRUKTURAL", group: "1", label: "Pemilik/pengurus warga negara asing", source: "NYATAKAN" },
  { code: "STRUKTURAL_1E", riskType: "STRUKTURAL", group: "1", label: "Struktur grup usaha", source: "NYATAKAN" },
  { code: "STRUKTURAL_2A", riskType: "STRUKTURAL", group: "2", label: "Lini bisnis lain", source: "NYATAKAN" },
];

export const IRA_PARAMETER_CODES = IRA_PARAMETERS.map((parameter) => parameter.code);

/** Lima pita tiap parameter; indeksnya 1 sampai 5, dari pita terendah ke tertinggi. */
export const IRA_BAND_INDEXES = [1, 2, 3, 4, 5] as const;

/**
 * Batas atas pita bawaan, dalam persen, hasil seed persis template: `0–20, 21–40, 41–60, 61–80,
 * 81–100`. Pita teratas `null` — tak berbatas atas, bukan nol.
 *
 * Bukan konstanta rilis: BI mengubah pitanya tanpa memberi tahu siapa pun, sehingga nilai ini hanya
 * bawaan yang dapat disunting CONTROLLER dan dikembalikan kapan saja.
 */
export const IRA_DEFAULT_BAND_UPPER_BOUNDS: (string | null)[] = ["20.00", "40.00", "60.00", "80.00", null];

/** Nilai parameter menurut pitanya. **Skalanya terbalik**: pita 1 (0–20%) bernilai 5, pita 5 bernilai 1. */
export function scoreFromBand(bandIndex: number): number {
  if (!Number.isInteger(bandIndex) || bandIndex < 1 || bandIndex > 5) throw new Error(`Indeks pita tidak sah: ${bandIndex}`);
  return 6 - bandIndex;
}
