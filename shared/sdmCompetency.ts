/**
 * Standardisasi Kompetensi Sistem Pembayaran — pelaporan RAP01 / RAS01.
 *
 * Dasar: PADG No. 17 Tahun 2024 tanggal 19 November 2024. Laporan disampaikan triwulanan melalui
 * pelaporan.bi.go.id sebagai berkas teks berpembatas pipa. Struktur di berkas ini diambil langsung
 * dari template resmi, bukan dari ingatan: 98 sandi, delapan kolom terkirim, tanggal yyyy-mm-dd.
 */

/** Jenjang jabatan; angka terakhir pada sandi kompetensi. */
export const JOB_LEVELS = {
  1: "level direksi",
  2: "pejabat eksekutif",
  3: "penyelia",
  4: "pelaksana",
} as const;
export type JobLevel = keyof typeof JOB_LEVELS;

/** Bidang SKKNI SP; dua digit di tengah sandi. */
export const WORK_AREAS = {
  "01": "Pengelolaan Transfer Dana",
  "02": "Penatausahaan Surat Berharga Negara Milik Nasabah",
  "03": "Pengelolaan Uang Tunai",
  "04": "Pemrosesan Transaksi Pembayaran",
  "05": "Penukaran Valas dan Pembawaan Uang Kertas Asing",
  "06": "Setelmen Transaksi Tresuri",
  "07": "Setelmen Pembayaran Transaksi Trade Finance",
} as const;
export type WorkArea = keyof typeof WORK_AREAS;

/**
 * Bidang yang relevan bagi penyelenggara KUPVA BB. Template resmi memuat seluruh 98 sandi untuk
 * semua pelaku sistem pembayaran; bagi money changer hanya bidang 05 yang berlaku, sehingga layar
 * pengisian cukup menampilkan 14 baris dan bukan 98 baris yang 84 di antaranya tidak relevan.
 */
export const KUPVA_WORK_AREA: WorkArea = "05";

/**
 * Jenis sertifikasi. PBK tidak mengenal jenjang direksi — pada template, sandi PBKNK dan PBKPK
 * hanya ada untuk jenjang 2 sampai 4.
 */
export const CERTIFICATION_TYPES = {
  PBKNK: { label: (level: string, area: string) => `PBK SP SDM ${level} dalam ${area}`, levels: [2, 3, 4] as JobLevel[] },
  PBKPK: { label: (level: string, area: string) => `Pemeliharaan Sertifikat PBK SP SDM ${level} dalam ${area}`, levels: [2, 3, 4] as JobLevel[] },
  SKNK: { label: (level: string, area: string) => `sertifikasi kompetensi SDM ${level} dalam ${area}`, levels: [1, 2, 3, 4] as JobLevel[] },
  SKPK: { label: (level: string, area: string) => `Pemeliharaan Sertifikat Kompetensi SDM ${level} dalam ${area}`, levels: [1, 2, 3, 4] as JobLevel[] },
} as const;
export type CertificationType = keyof typeof CERTIFICATION_TYPES;

export type CompetencyCode = {
  code: string;
  type: CertificationType;
  area: WorkArea;
  level: JobLevel;
  /** Teks kolom keterangan pada template; tidak ikut terkirim, tetapi dipakai di layar. */
  keterangan: string;
};

/** Sandi disusun sebagai <jenis>66SPP<bidang 2 digit><jenjang 1 digit>. */
export function competencyCode(type: CertificationType, area: WorkArea, level: JobLevel): string {
  return `${type}66SPP${area}${level}`;
}

/** Seluruh sandi untuk satu bidang, urut jenis lalu jenjang — sama seperti urutan template. */
export function competencyCodesForArea(area: WorkArea): CompetencyCode[] {
  const rows: CompetencyCode[] = [];
  for (const type of Object.keys(CERTIFICATION_TYPES) as CertificationType[]) {
    for (const level of CERTIFICATION_TYPES[type].levels) {
      rows.push({
        code: competencyCode(type, area, level),
        type,
        area,
        level,
        keterangan: CERTIFICATION_TYPES[type].label(JOB_LEVELS[level], WORK_AREAS[area]),
      });
    }
  }
  return rows;
}

/**
 * Seluruh 98 sandi dengan urutan template resmi: jenis sertifikasi lebih dahulu, lalu bidang, lalu
 * jenjang — seluruh PBKNK untuk ketujuh bidang, baru PBKPK, dan seterusnya. Urutan ini penting
 * karena berkas unggahan disusun baris demi baris mengikuti template.
 */
export function allCompetencyCodes(): CompetencyCode[] {
  const rows: CompetencyCode[] = [];
  for (const type of Object.keys(CERTIFICATION_TYPES) as CertificationType[]) {
    for (const area of Object.keys(WORK_AREAS) as WorkArea[]) {
      for (const level of CERTIFICATION_TYPES[type].levels) {
        rows.push({
          code: competencyCode(type, area, level),
          type,
          area,
          level,
          keterangan: CERTIFICATION_TYPES[type].label(JOB_LEVELS[level], WORK_AREAS[area]),
        });
      }
    }
  }
  return rows;
}

/**
 * Masa peralihan berakhir 31 Desember 2026 (PADG 17/2024). Sampai tanggal itu laporan memakai
 * RAP01; sesudahnya RAS01. Dipilih dari tanggal akhir periode data agar laporan triwulan terakhir
 * masa peralihan tetap memakai formulir yang benar meski disusun pada tahun berikutnya.
 */
export const MASA_PERALIHAN_ENDS = "2026-12-31";
export type SdmReportForm = "rap01" | "ras01";

export function formForPeriod(periodeData: string): SdmReportForm {
  return periodeData <= MASA_PERALIHAN_ENDS ? "rap01" : "ras01";
}

/** Akhir triwulan sebagai yyyy-mm-dd; nilai kolom periodeData. */
export function quarterEndDate(year: number, quarter: 1 | 2 | 3 | 4): string {
  const lastDay = { 1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31" }[quarter];
  return `${year}-${lastDay}`;
}

export type SdmCompetencyCounts = {
  /** SDM yang wajib mengikuti, posisi akhir periode. */
  posisiKeseluruhanSDM: number;
  /** SDM yang telah memiliki sertifikat, posisi akhir periode. */
  posisiSDMYangMemilikiSertifikat: number;
  rencanaSertifikasiSDM: number;
  realisasiSertifikasiSDM: number;
};

export type SdmReportRow = CompetencyCode & SdmCompetencyCounts;

const EMPTY_COUNTS: SdmCompetencyCounts = {
  posisiKeseluruhanSDM: 0,
  posisiSDMYangMemilikiSertifikat: 0,
  rencanaSertifikasiSDM: 0,
  realisasiSertifikasiSDM: 0,
};

/**
 * Menyusun baris laporan untuk satu bidang. Sandi tanpa data tetap dilaporkan bernilai nol —
 * template resmi memuat seluruh sandi, dan menghilangkan baris berarti laporan tidak lagi sepadan
 * dengan formulir yang diharapkan penerima.
 */
export function buildSdmReportRows(area: WorkArea, counts: Record<string, Partial<SdmCompetencyCounts>>): SdmReportRow[] {
  return competencyCodesForArea(area).map((entry) => ({ ...entry, ...EMPTY_COUNTS, ...(counts[entry.code] ?? {}) }));
}

/** Nama kolom pada baris pertama berkas, persis seperti template. */
export const SDM_TEXT_COLUMNS = [
  "idPelapor",
  "periodeLaporan",
  "periodeData",
  "rincianPemenuhanKompetensi",
  "posisiKeseluruhanSDM",
  "posisiSDMYangMemilikiSertifikat",
  "rencanaSertifikasiSDM",
  "realisasiSertifikasiSDM",
] as const;

/**
 * Berkas teks yang diunggah ke pelaporan.bi.go.id: berpembatas pipa, satu baris judul lalu satu
 * baris per sandi. Kolom keterangan sengaja tidak ikut — template hanya merangkai delapan kolom
 * pertama, dan menambahkan kolom kesembilan akan membuat berkas ditolak.
 */
export function buildSdmTextFile(input: {
  idPelapor: string;
  periodeData: string;
  rows: SdmReportRow[];
  periodeLaporan?: string;
}): string {
  const periodeLaporan = input.periodeLaporan ?? "Q";
  const lines = [SDM_TEXT_COLUMNS.join("|")];
  for (const row of input.rows) {
    lines.push([
      input.idPelapor,
      periodeLaporan,
      input.periodeData,
      row.code,
      row.posisiKeseluruhanSDM,
      row.posisiSDMYangMemilikiSertifikat,
      row.rencanaSertifikasiSDM,
      row.realisasiSertifikasiSDM,
    ].join("|"));
  }
  return lines.join("\n");
}

/**
 * Pemeriksaan yang dijalankan sebelum berkas dianggap siap diunggah. Ditolak lebih awal di layar
 * jauh lebih murah daripada ditolak penerima setelah tenggat.
 */
export function validateSdmReport(rows: SdmReportRow[]): string[] {
  const problems: string[] = [];
  for (const row of rows) {
    if (row.posisiSDMYangMemilikiSertifikat > row.posisiKeseluruhanSDM) {
      problems.push(`${row.code}: SDM bersertifikat (${row.posisiSDMYangMemilikiSertifikat}) melebihi keseluruhan SDM (${row.posisiKeseluruhanSDM}).`);
    }
    if ([row.posisiKeseluruhanSDM, row.posisiSDMYangMemilikiSertifikat, row.rencanaSertifikasiSDM, row.realisasiSertifikasiSDM].some((value) => !Number.isInteger(value) || value < 0)) {
      problems.push(`${row.code}: seluruh jumlah harus bilangan bulat tidak negatif.`);
    }
  }
  return problems;
}
