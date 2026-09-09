/**
 * Katalog 33 parameter risiko inheren IRA: bobot, jenis pita, dan teks kriterianya.
 *
 * Melengkapi `shared/iraParameters.ts` — kode, label, kelompok, dan sumbernya **dibaca dari sana**,
 * tidak disalin. Dua daftar berisi 33 baris yang sama akan berselisih pada suatu hari, dan
 * selisihnya tidak akan terlihat di layar mana pun; karena itu berkas ini hanya menambahkan ruas
 * yang belum ada dan menggabungkannya saat dimuat.
 *
 * Angkanya dibaca 9 September 2026 dari lembar `A1. KUPVA BB` template BI milik pengguna: kolom D
 * bobot kelompok, kolom E bobot parameter, kolom F teks kriteria, kolom G–K kriteria pita untuk
 * nilai 5, 4, 3, 2, 1. **Hanya strukturnya yang masuk ke sini** — nilai isian dan keterangan
 * operasional PT IBV pada kolom L–N tidak ikut, juga tidak sebagai fixture uji.
 *
 * **Skalanya tetap terbalik:** pita 1 (paling aman) bernilai 5, pita 5 bernilai 1. Lihat
 * `scoreFromBand` pada `shared/iraParameters.ts`.
 */

import type Decimal from "decimal.js";
import { IRA_GROUP_WEIGHTS } from "./individualRiskAssessment";
import {
  IRA_DEFAULT_BAND_UPPER_BOUNDS,
  IRA_PARAMETERS,
  type IraParameter,
  type IraParameterRiskType,
} from "./iraParameters";

/**
 * Enam bentuk pita pada lembar `A1`.
 *
 * Rancangan J2 semula menyebut empat; membaca templatnya memperlihatkan dua lagi yang tidak dapat
 * dipaksakan ke keempatnya:
 *  - `TINGKAT_RISIKO` — empat parameter Wilayah Geografis berkriteria `Rendah / Menengah / Tinggi`,
 *    tiga tingkat, bukan dua seperti kehadiran dan bukan persentase.
 *  - `PERSENTASE_KEPEMILIKAN` — `Persentase pemegang saham berbentuk Perorangan` bergradasi
 *    `Tidak ada / 1-99% / 100%`, tiga titik saja, dan dinyatakan penilainya.
 */
export const IRA_BAND_TYPES = [
  "PERSENTASE_LEBAR",
  "PERSENTASE_SEMPIT",
  "PERSENTASE_MENENGAH",
  "KEHADIRAN",
  "TINGKAT_RISIKO",
  "PERSENTASE_KEPEMILIKAN",
] as const;
export type IraBandType = (typeof IRA_BAND_TYPES)[number];

/** Pilihan bagi parameter yang pitanya bukan persentase. `bandIndex` 1 paling aman, 5 paling berisiko. */
export type IraBandChoice = { code: string; label: string; bandIndex: number };

export type IraBandDefinition = {
  /** Label kelima pita persis kolom G–K. `"-"` berarti pita itu memang tidak dipakai templatenya. */
  bandLabels: readonly [string, string, string, string, string];
  /**
   * Batas atas persen tiap pita, `null` pada pita teratas — bentuk yang diterima
   * `scoreFromPercentageBand`. Bernilai `null` seluruhnya bila parameternya berupa pilihan.
   */
  defaultUpperBounds: readonly (string | null)[] | null;
  /** Pilihan yang tersedia bila pitanya bukan persentase; `null` bila numerik. */
  choices: readonly IraBandChoice[] | null;
};

export const IRA_BAND_DEFINITIONS: Record<IraBandType, IraBandDefinition> = {
  /** `0-20% / 21-40% / 41-60% / 61-80% / 81-100%` — pita yang di-seed J1. */
  PERSENTASE_LEBAR: {
    bandLabels: ["0-20%", "21-40%", "41-60%", "61-80%", "81-100%"],
    defaultUpperBounds: IRA_DEFAULT_BAND_UPPER_BOUNDS,
    choices: null,
  },
  /** `Tidak ada / >0-1% / >1-2% / >2-3% / >3%`. Batas 0 membuat "tidak ada" tepat berarti nol. */
  PERSENTASE_SEMPIT: {
    bandLabels: ["Tidak ada", ">0-1%", ">1-2%", ">2-3%", ">3%"],
    defaultUpperBounds: ["0.00", "1.00", "2.00", "3.00", null],
    choices: null,
  },
  /** `0-2% / >2-4% / >4-5% / >5-6% / >6%`. */
  PERSENTASE_MENENGAH: {
    bandLabels: ["0-2%", ">2-4%", ">4-5%", ">5-6%", ">6%"],
    defaultUpperBounds: ["2.00", "4.00", "5.00", "6.00", null],
    choices: null,
  },
  /** `Tidak ada / - / - / - / Ada`. Ada berarti risiko tertinggi. */
  KEHADIRAN: {
    bandLabels: ["Tidak ada", "-", "-", "-", "Ada"],
    defaultUpperBounds: null,
    choices: [
      { code: "TIDAK_ADA", label: "Tidak ada", bandIndex: 1 },
      { code: "ADA", label: "Ada", bandIndex: 5 },
    ],
  },
  /** `Rendah / - / Menengah / - / Tinggi`, memakai peringkat SRA pada `ira_risk_classifications`. */
  TINGKAT_RISIKO: {
    bandLabels: ["Rendah", "-", "Menengah", "-", "Tinggi"],
    defaultUpperBounds: null,
    choices: [
      { code: "RENDAH", label: "Rendah", bandIndex: 1 },
      { code: "MENENGAH", label: "Menengah", bandIndex: 3 },
      { code: "TINGGI", label: "Tinggi", bandIndex: 5 },
    ],
  },
  /** `Tidak ada / - / 1-99% / - / 100%` — gradasi kepemilikan perorangan. */
  PERSENTASE_KEPEMILIKAN: {
    bandLabels: ["Tidak ada", "-", "1-99%", "-", "100%"],
    defaultUpperBounds: null,
    choices: [
      { code: "TIDAK_ADA", label: "Tidak ada", bandIndex: 1 },
      { code: "SEBAGIAN", label: "1-99%", bandIndex: 3 },
      { code: "SELURUHNYA", label: "100%", bandIndex: 5 },
    ],
  },
};

export const bandDefinition = (bandType: IraBandType): IraBandDefinition => IRA_BAND_DEFINITIONS[bandType];

/** Ruas yang hanya ada di sini; sisanya digabungkan dari `IRA_PARAMETERS`. */
type IraParameterDetail = { parameterWeight: string; bandType: IraBandType; criterion: string };

/**
 * Bobot parameter (kolom E) dan kriterianya (kolom F), berkunci kode parameter.
 *
 * Kolom D pada baris parameter berisi sisa isian penilai, bukan bobot — bobot kelompok hanya ada
 * pada baris kelompoknya dan tinggal di `IRA_GROUP_WEIGHTS`.
 */
const IRA_PARAMETER_DETAILS: Record<string, IraParameterDetail> = {
  TPPU_1A: { parameterWeight: "0.7", bandType: "PERSENTASE_LEBAR", criterion: "Persentase transaksi melibatkan mata uang berisiko Tinggi menurut SRA" },
  TPPU_1B: { parameterWeight: "0.3", bandType: "PERSENTASE_LEBAR", criterion: "Persentase transaksi melibatkan mata uang berisiko Menengah menurut SRA" },
  TPPU_2A: { parameterWeight: "0.6", bandType: "PERSENTASE_LEBAR", criterion: "Persentase transaksi melalui jalur distribusi berisiko Tinggi menurut SRA dari total transaksi" },
  TPPU_2B: { parameterWeight: "0.3", bandType: "PERSENTASE_LEBAR", criterion: "Persentase transaksi melalui jalur distribusi berisiko Menengah menurut SRA dari total transaksi" },
  TPPU_2C: { parameterWeight: "0.1", bandType: "KEHADIRAN", criterion: "Ada/Tidak ada mitra kerja sama berupa hotel atau badan usaha penyedia layanan akomodasi lainnya, gerai, dan/atau pihak selain KUPVA BB yang melayani transaksi di perbatasan" },
  TPPU_3A: { parameterWeight: "0.35", bandType: "PERSENTASE_SEMPIT", criterion: "Persentase pengguna jasa individu dengan profesi berisiko Tinggi TPPU menurut SRA dari seluruh pengguna jasa" },
  TPPU_3B: { parameterWeight: "0.1", bandType: "PERSENTASE_MENENGAH", criterion: "Persentase pengguna jasa individu dengan profesi berisiko Menengah TPPU menurut SRA dari seluruh pengguna jasa" },
  TPPU_3C: { parameterWeight: "0.35", bandType: "PERSENTASE_SEMPIT", criterion: "Persentase pengguna jasa badan usaha dengan bentuk badan hukum berisiko Tinggi menurut SRA dari seluruh pengguna jasa" },
  TPPU_3D: { parameterWeight: "0.1", bandType: "PERSENTASE_MENENGAH", criterion: "Persentase pengguna jasa badan usaha dengan bentuk badan hukum berisiko Menengah menurut SRA dari seluruh pengguna jasa" },
  TPPU_3E: { parameterWeight: "0.1", bandType: "KEHADIRAN", criterion: 'Ada/tidak transaksi melibatkan WN High Risk Countries menurut "Black" and "Grey" list FATF dari seluruh transaksi' },
  TPPU_4A: { parameterWeight: "0.5", bandType: "TINGKAT_RISIKO", criterion: "Tingkat risiko TPPU lokasi operasional utama Penyelenggara KUPVA BB sesuai SRA" },
  TPPU_4B: { parameterWeight: "0.5", bandType: "TINGKAT_RISIKO", criterion: "Lokasi kantor pusat atau cabang dengan Risiko TPPU paling tinggi Sesuai SRA" },

  TPPT_1A: { parameterWeight: "0.7", bandType: "PERSENTASE_LEBAR", criterion: "Persentase transaksi melibatkan mata uang berisiko Tinggi TPPT menurut SRA" },
  TPPT_1B: { parameterWeight: "0.3", bandType: "PERSENTASE_LEBAR", criterion: "Persentase transaksi melibatkan mata uang berisiko Menengah TPPT menurut SRA" },
  TPPT_2A: { parameterWeight: "0.7", bandType: "PERSENTASE_LEBAR", criterion: "Persentase transaksi melalui jalur distribusi berisiko Tinggi TPPT menurut SRA dari total transaksi" },
  TPPT_2B: { parameterWeight: "0.3", bandType: "PERSENTASE_LEBAR", criterion: "Persentase transaksi melalui jalur distribusi berisiko Menengah TPPT menurut SRA dari total transaksi" },
  TPPT_3A: { parameterWeight: "0.7", bandType: "PERSENTASE_SEMPIT", criterion: "Persentase pengguna jasa individu dengan profesi berisiko Tinggi TPPT menurut SRA dari seluruh pengguna jasa" },
  TPPT_3B: { parameterWeight: "0.3", bandType: "PERSENTASE_MENENGAH", criterion: "Persentase pengguna jasa individu dengan profesi berisiko Menengah TPPT menurut SRA dari seluruh pengguna jasa" },
  TPPT_4A: { parameterWeight: "0.5", bandType: "TINGKAT_RISIKO", criterion: "Tingkat risiko TPPT lokasi operasional utama KUPVA BB sesuai SRA" },
  TPPT_4B: { parameterWeight: "0.5", bandType: "TINGKAT_RISIKO", criterion: "Lokasi cabang dengan Risiko TPPT paling tinggi Sesuai SRA" },

  PPSPM_1A: { parameterWeight: "1", bandType: "PERSENTASE_LEBAR", criterion: "Persentase menggunakan layanan berisiko tinggi PPSPM menurut SRA" },
  PPSPM_2A: { parameterWeight: "0.4", bandType: "KEHADIRAN", criterion: "Ada/Tidak mitra kerja sama dari negara asing" },
  PPSPM_2B: { parameterWeight: "0.6", bandType: "KEHADIRAN", criterion: "Ada/Tidak mitra yang berasal dari negara yang terkena sanksi Dewan Keamanan PBB terkait PPSPM" },
  PPSPM_3A: { parameterWeight: "0.5", bandType: "PERSENTASE_SEMPIT", criterion: "Persentase pengguna jasa Individu yang berasal dari negara yang terkena sanksi Dewan Keamanan PBB terkait PPSPM" },
  PPSPM_3B: { parameterWeight: "0.25", bandType: "PERSENTASE_SEMPIT", criterion: "Persentase pengguna jasa individu dengan profesi Pengurus/Pegawai LSM/ organisasi tidak berbadan hukum lainnya, PEPs (diplomat asing) serta Pengusaha/Wiraswasta yang melakukan ekspor impor khususnya terkait industri yang memproduksi dual-use goods" },
  PPSPM_3C: { parameterWeight: "0.25", bandType: "PERSENTASE_SEMPIT", criterion: "Persentase pengguna jasa Badan Usaha Perusahaan Non UMKM berbentuk Perseroan Terbatas" },
  PPSPM_4A: { parameterWeight: "1", bandType: "PERSENTASE_SEMPIT", criterion: "Persentase transaksi melibatkan WNA dari negara yang terkena sanksi Dewan Keamanan PBB terkait PPSPM dari total transaksi" },

  STRUKTURAL_1A: { parameterWeight: "0.2", bandType: "PERSENTASE_KEPEMILIKAN", criterion: "Persentase pemegang saham berbentuk Perorangan" },
  STRUKTURAL_1B: { parameterWeight: "0.2", bandType: "KEHADIRAN", criterion: "Pemilik atau Pengendali Perusahaan adalah PEP" },
  STRUKTURAL_1C: { parameterWeight: "0.2", bandType: "KEHADIRAN", criterion: "Pemilik atau Pengendali Perusahaan adalah nominee dan/atau trust" },
  STRUKTURAL_1D: { parameterWeight: "0.2", bandType: "KEHADIRAN", criterion: "Pemilik atau Pengendali Perusahaan adalah WN atau BH negara berisiko tinggi" },
  STRUKTURAL_1E: { parameterWeight: "0.2", bandType: "KEHADIRAN", criterion: "Entitas merupakan bagian dari Grup dan/atau memiliki struktur korporasi kompleks" },
  STRUKTURAL_2A: { parameterWeight: "1", bandType: "KEHADIRAN", criterion: "Ada/Tidak lini bisnis lain selain penukaran valuta asing" },
};

export type IraParameterCatalogueEntry = IraParameter &
  IraParameterDetail & {
    /** Bobot kelompoknya, dibaca dari `IRA_GROUP_WEIGHTS` — bukan salinan kedua. */
    groupWeight: string;
  };

/** 33 entri, urut sama persis dengan lembar `A1` dan dengan `IRA_PARAMETERS`. */
export const IRA_PARAMETER_CATALOGUE: IraParameterCatalogueEntry[] = IRA_PARAMETERS.map((parameter) => {
  const detail = IRA_PARAMETER_DETAILS[parameter.code];
  if (!detail) throw new Error(`Parameter ${parameter.code} belum punya bobot dan jenis pita.`);
  const groupWeight = IRA_GROUP_WEIGHTS[parameter.riskType][parameter.group];
  if (!groupWeight) throw new Error(`Kelompok ${parameter.riskType}/${parameter.group} tidak punya bobot.`);
  return { ...parameter, ...detail, groupWeight };
});

const BY_CODE = new Map(IRA_PARAMETER_CATALOGUE.map((entry) => [entry.code, entry]));

/** Entri satu parameter. Kode tak dikenal **dilempar** — parameter yang hilang tidak boleh bernilai nol diam-diam. */
export function catalogueEntry(code: string): IraParameterCatalogueEntry {
  const entry = BY_CODE.get(code);
  if (!entry) throw new Error(`Parameter IRA tidak dikenal: ${code}`);
  return entry;
}

/** Parameter satu kelompok, urut templatenya. */
export function parametersOfGroup(riskType: IraParameterRiskType, group: string): IraParameterCatalogueEntry[] {
  return IRA_PARAMETER_CATALOGUE.filter((entry) => entry.riskType === riskType && entry.group === group);
}

/** Bobot parameter sebagai nilai yang siap dipakai `weightedGroupScore`. */
export const parameterWeightOf = (code: string): Decimal.Value => catalogueEntry(code).parameterWeight;
