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


// ---------------------------------------------------------------------------
// Menurunkan angka laporan dari catatan pegawai
// ---------------------------------------------------------------------------

/** Jenjang pada tabel pegawai, dipetakan ke angka terakhir sandi kompetensi. */
export const JOB_LEVEL_BY_NAME: Record<string, JobLevel> = {
  DIREKSI: 1,
  PEJABAT_EKSEKUTIF: 2,
  PENYELIA: 3,
  PELAKSANA: 4,
};

export type EmployeeForReport = {
  id: number;
  jobLevel: keyof typeof JOB_LEVEL_BY_NAME;
  /** Jenjang pelaporan bila berbeda dari struktur organisasi; lihat catatan pada skema. */
  competencyLevel?: keyof typeof JOB_LEVEL_BY_NAME | null;
  competencyTrack: "PBK" | "SERTIFIKASI_KOMPETENSI" | "TIDAK_WAJIB";
  employmentStatus: "AKTIF" | "NONAKTIF";
  joinedAt: string;
  endedAt?: string | null;
};

export type CertificationForReport = {
  employeeId: number;
  competencyCode: string;
  issuedAt: string;
  expiresAt?: string | null;
};

/** Jenis sertifikasi dasar untuk tiap jalur, dan jenis pemeliharaannya. */
const TRACK_BASE: Record<string, CertificationType | null> = { PBK: "PBKNK", SERTIFIKASI_KOMPETENSI: "SKNK", TIDAK_WAJIB: null };
const TRACK_MAINTENANCE: Record<string, CertificationType | null> = { PBK: "PBKPK", SERTIFIKASI_KOMPETENSI: "SKPK", TIDAK_WAJIB: null };

const employedAt = (employee: EmployeeForReport, date: string) =>
  employee.joinedAt <= date && (!employee.endedAt || employee.endedAt >= date) && employee.employmentStatus === "AKTIF";

const certificateValidAt = (certificate: CertificationForReport, date: string) =>
  certificate.issuedAt <= date && (!certificate.expiresAt || certificate.expiresAt >= date);

/**
 * Menghitung keempat angka RAP01/RAS01 dari catatan pegawai dan sertifikatnya.
 *
 * Kewajiban dibaca dari jalur kompetensi pegawai: jalur PBK menimbulkan kewajiban PBKNK, jalur
 * Sertifikasi Kompetensi menimbulkan SKNK. Kewajiban pemeliharaan (PBKPK/SKPK) hanya berlaku bagi
 * pegawai yang sudah memegang sertifikat dasarnya, karena tidak ada yang perlu dipelihara sebelum
 * sertifikat itu ada.
 *
 * `rencanaSertifikasiSDM` tidak diturunkan di sini - rencana adalah keputusan manajemen, bukan
 * fakta yang sudah terjadi, sehingga datang dari tabel rencana.
 */
export function deriveSdmCounts(input: {
  area: WorkArea;
  periodStart: string;
  periodEnd: string;
  employees: EmployeeForReport[];
  certifications: CertificationForReport[];
  plans?: Record<string, number>;
}): SdmReportRow[] {
  const { area, periodStart, periodEnd, employees, certifications, plans = {} } = input;
  const active = employees.filter((employee) => employedAt(employee, periodEnd));
  const byEmployee = new Map<number, CertificationForReport[]>();
  for (const certificate of certifications) {
    const list = byEmployee.get(certificate.employeeId) ?? [];
    list.push(certificate);
    byEmployee.set(certificate.employeeId, list);
  }

  return competencyCodesForArea(area).map((entry) => {
    const obliged = active.filter((employee) => {
      const reportingLevel = JOB_LEVEL_BY_NAME[employee.competencyLevel ?? employee.jobLevel];
      if (reportingLevel !== entry.level) return false;
      const base = TRACK_BASE[employee.competencyTrack];
      const maintenance = TRACK_MAINTENANCE[employee.competencyTrack];
      if (entry.type === base) return true;
      if (entry.type !== maintenance) return false;
      // Pemeliharaan baru menjadi kewajiban setelah sertifikat dasarnya dimiliki.
      const baseCode = base ? competencyCode(base, entry.area, entry.level) : null;
      return Boolean(baseCode && (byEmployee.get(employee.id) ?? []).some((certificate) => certificate.competencyCode === baseCode && certificate.issuedAt <= periodEnd));
    });

    const holders = obliged.filter((employee) =>
      (byEmployee.get(employee.id) ?? []).some((certificate) => certificate.competencyCode === entry.code && certificateValidAt(certificate, periodEnd)),
    );

    const realised = obliged.filter((employee) =>
      (byEmployee.get(employee.id) ?? []).some((certificate) => certificate.competencyCode === entry.code && certificate.issuedAt >= periodStart && certificate.issuedAt <= periodEnd),
    );

    return {
      ...entry,
      posisiKeseluruhanSDM: obliged.length,
      posisiSDMYangMemilikiSertifikat: holders.length,
      rencanaSertifikasiSDM: plans[entry.code] ?? 0,
      realisasiSertifikasiSDM: realised.length,
    };
  });
}

/** Awal triwulan sebagai yyyy-mm-dd, pasangan quarterEndDate. */
export function quarterStartDate(year: number, quarter: 1 | 2 | 3 | 4): string {
  const firstDay = { 1: "01-01", 2: "04-01", 3: "07-01", 4: "10-01" }[quarter];
  return `${year}-${firstDay}`;
}


// ---------------------------------------------------------------------------
// Nomor sertifikat dan jenjang KKNI
// ---------------------------------------------------------------------------

/**
 * Jenjang kualifikasi KKNI yang tercetak pada sertifikat PBK, dipetakan ke jenjang jabatan.
 *
 * Perhatikan bahwa penomorannya BERBEDA dari angka terakhir sandi kompetensi. Sertifikat menuliskan
 * "Jenjang Kualifikasi PENYELIA (5)" sedangkan sandi laporan memakai angka 3 untuk penyelia.
 * Menyamakan keduanya akan memasukkan sertifikat ke sandi yang salah.
 */
export const KKNI_LEVELS: Record<number, JobLevel> = {
  4: 4, // PELAKSANA (4) -> sandi berakhiran 4
  5: 3, // PENYELIA (5) -> sandi berakhiran 3
  6: 2, // PEJABAT EKSEKUTIF (6) -> sandi berakhiran 2
};

export type ParsedCertificateNumber = {
  area: WorkArea;
  kkniLevel: number;
  level: JobLevel;
  issuedOn: string;
  institution: string;
  sequence: string;
};

/**
 * Membaca nomor sertifikat LPK, misalnya `SPPUR - 05 - 04 - 09122024 - LPKLPPI - 0000637`:
 * SPPUR, bidang, jenjang KKNI, tanggal DDMMYYYY, lembaga, nomor urut. Dipakai untuk menentukan
 * sandi kompetensi yang tepat dari nomor yang tertera, alih-alih menebaknya dari jabatan pegawai.
 */
export function parseCertificateNumber(raw: string): ParsedCertificateNumber | null {
  const parts = raw.split("-").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 6 || parts[0].toUpperCase() !== "SPPUR") return null;
  const [, area, kkni, date, institution, sequence] = parts;
  if (!(area in WORK_AREAS)) return null;
  const kkniLevel = Number(kkni);
  const level = KKNI_LEVELS[kkniLevel];
  if (!level) return null;
  if (!/^\d{8}$/.test(date)) return null;
  const issuedOn = `${date.slice(4, 8)}-${date.slice(2, 4)}-${date.slice(0, 2)}`;
  return { area: area as WorkArea, kkniLevel, level, issuedOn, institution, sequence };
}

/** Sandi kompetensi yang sesuai dengan sebuah nomor sertifikat PBK. */
export function competencyCodeFromCertificate(raw: string, type: CertificationType = "PBKNK"): string | null {
  const parsed = parseCertificateNumber(raw);
  if (!parsed) return null;
  if (!CERTIFICATION_TYPES[type].levels.includes(parsed.level)) return null;
  return competencyCode(type, parsed.area, parsed.level);
}

/**
 * Memeriksa kecocokan antara nomor sertifikat dan sandi yang dipilih. Ketidakcocokan dikembalikan
 * sebagai pesan, bukan dilempar, agar layar dapat memperingatkan tanpa menghalangi pencatatan
 * sertifikat yang penomorannya tidak mengikuti pola LPK.
 */
export function certificateNumberMismatch(raw: string | null | undefined, chosenCode: string): string | null {
  if (!raw?.trim()) return null;
  const parsed = parseCertificateNumber(raw);
  if (!parsed) return null;
  const suffix = chosenCode.slice(-3);
  const expected = `${parsed.area}${parsed.level}`;
  if (suffix !== expected) {
    return `Nomor sertifikat menunjuk bidang ${parsed.area} jenjang KKNI ${parsed.kkniLevel}, sedangkan sandi ${chosenCode} berlaku untuk ${suffix.slice(0, 2)} jenjang ${suffix.slice(2)}.`;
  }
  return null;
}


// ---------------------------------------------------------------------------
// Laporan realisasi (Lampiran X/XI bagian B.II dan B.IV)
// ---------------------------------------------------------------------------

/**
 * Jalur pelaporan pada lampiran realisasi. Keduanya berbentuk sama tetapi tidak sama isinya:
 * bagian B.II melaporkan sertifikat PBK, bagian B.IV melaporkan Sertifikasi Kompetensi — dan hanya
 * B.IV yang memiliki kolom Direksi, karena hanya sandi SKNK/SKPK yang mengenal jenjang itu.
 */
export const REALISASI_SECTIONS = {
  PBK: { section: "B.II", base: "PBKNK", maintenance: "PBKPK", title: "Sertifikat PBK Sistem Pembayaran" },
  KOMPETENSI: { section: "B.IV", base: "SKNK", maintenance: "SKPK", title: "Sertifikat Kompetensi Sistem Pembayaran" },
} as const;
export type RealisasiTrack = keyof typeof REALISASI_SECTIONS;

export type RealisasiLevelColumn = {
  level: JobLevel;
  label: string;
  totalSdm: number;
  rencanaBase: number;
  rencanaMaintenance: number;
  realisasiBase: number;
  realisasiMaintenance: number;
  /** SDM yang telah memiliki sertifikat dasar sampai dengan akhir periode. */
  akumulasi: number;
};

export type RealisasiReport = {
  track: RealisasiTrack;
  section: string;
  title: string;
  bidang: string;
  periodStart: string;
  periodEnd: string;
  lampiran: "X" | "XI";
  columns: RealisasiLevelColumn[];
  totalSdm: number;
  totalAkumulasi: number;
  /** Persentase akumulasi terhadap seluruh SDM yang wajib; kolom 10 pada formulir. */
  persentaseAkumulasi: number;
};

const LEVEL_LABELS: Record<JobLevel, string> = { 1: "Direksi", 2: "Pejabat Eksekutif", 3: "Penyelia", 4: "Pelaksana" };

/**
 * Menyusun satu baris laporan realisasi untuk bidang KUPVA, terpecah per jenjang.
 *
 * Bentuk formulirnya satu baris per bidang dengan kolom terbagi menurut jenjang — bukan satu baris
 * per sandi seperti RAP01/RAS01. Angkanya diturunkan dari catatan yang sama, sehingga laporan
 * realisasi dan laporan triwulanan tidak dapat saling bertentangan.
 */
export function buildRealisasiReport(input: {
  track: RealisasiTrack;
  area: WorkArea;
  periodStart: string;
  periodEnd: string;
  employees: EmployeeForReport[];
  certifications: CertificationForReport[];
  plans?: Record<string, number>;
}): RealisasiReport {
  const { track, area, periodStart, periodEnd, employees, certifications, plans = {} } = input;
  const spec = REALISASI_SECTIONS[track];
  // Urutan kolom mengikuti formulir: jenjang terendah lebih dahulu.
  const levels = (CERTIFICATION_TYPES[spec.base as CertificationType].levels as JobLevel[]).slice().sort((a, b) => b - a);

  const rows = deriveSdmCounts({ area, periodStart, periodEnd, employees, certifications, plans });
  const at = (type: string, level: JobLevel) => rows.find((row) => row.code === competencyCode(type as CertificationType, area, level));

  const columns: RealisasiLevelColumn[] = levels.map((level) => {
    const base = at(spec.base, level);
    const maintenance = at(spec.maintenance, level);
    return {
      level,
      label: LEVEL_LABELS[level],
      totalSdm: base?.posisiKeseluruhanSDM ?? 0,
      rencanaBase: base?.rencanaSertifikasiSDM ?? 0,
      rencanaMaintenance: maintenance?.rencanaSertifikasiSDM ?? 0,
      realisasiBase: base?.realisasiSertifikasiSDM ?? 0,
      realisasiMaintenance: maintenance?.realisasiSertifikasiSDM ?? 0,
      akumulasi: base?.posisiSDMYangMemilikiSertifikat ?? 0,
    };
  });

  const totalSdm = columns.reduce((sum, column) => sum + column.totalSdm, 0);
  const totalAkumulasi = columns.reduce((sum, column) => sum + column.akumulasi, 0);

  return {
    track,
    section: spec.section,
    title: spec.title,
    bidang: WORK_AREAS[area],
    periodStart,
    periodEnd,
    lampiran: formForPeriod(periodEnd) === "rap01" ? "XI" : "X",
    columns,
    totalSdm,
    totalAkumulasi,
    // Nol dibagi nol tidak dilaporkan sebagai NaN; belum ada kewajiban berarti nol persen.
    persentaseAkumulasi: totalSdm ? Math.round((totalAkumulasi / totalSdm) * 1000) / 10 : 0,
  };
}
