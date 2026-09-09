/**
 * Katalog 31 pertanyaan KPMR (Kualitas Penerapan Manajemen Risiko) IRA.
 *
 * Teks pertanyaannya dibaca 9 September 2026 dari lembar `B. KPMR 2025` template BI milik pengguna,
 * kolom C, **apa adanya** — termasuk catatan dan rincian butirnya, karena penilai menjawab
 * pertanyaan yang itu, bukan ringkasannya. Kolom K–M pada template berisi jawaban dan dokumen
 * pendukung PT IBV; **tidak ada satu pun yang ikut ke sini**, juga tidak sebagai fixture uji.
 *
 * Keberlakuan dibaca dari kolom `KUPVA BB` (kolom G): kolom yang kosong berarti pertanyaan itu
 * tidak berlaku bagi KUPVA BB. Tepat satu pertanyaan berlaku demikian — yang menyangkut kegiatan
 * **transfer dana**, yang memang bukan kegiatan KUPVA BB. Pertanyaan seperti itu tampil sebagai
 * **N/A yang sudah terisi**, bukan pertanyaan kosong yang menunggu jawaban, dan `kpmrPillarAverage`
 * mengecualikannya dari penyebut.
 *
 * Skala jawabannya sama terbaliknya dengan sisi inheren: `1 unsatisfactory … 5 strong`
 * (lembar B, "Cara Pengisian"). Aritmetikanya ada di `shared/individualRiskAssessment.ts`.
 */

import { IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY } from "./individualRiskAssessment";

/**
 * Lima pilar, urut sesuai lembar B. Kosakatanya **dibaca dari** bobot pilar pada
 * `individualRiskAssessment.ts` supaya tidak ada daftar pilar kedua yang dapat berselisih —
 * bobotnya sendiri hanya keterangan layar dan tidak dipakai rumusnya (spec Rancangan 4.1).
 */
export const IRA_KPMR_PILLARS = Object.keys(
  IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY,
) as IraKpmrPillar[];
export type IraKpmrPillar = keyof typeof IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY;

/** Nama pilar sebagaimana tertulis pada lembar B, untuk judul di layar. */
export const IRA_KPMR_PILLAR_LABELS: Record<IraKpmrPillar, string> = {
  DIREKSI_KOMISARIS:
    "Tugas dan Tanggung Jawab Direksi dan Pengawasan Aktif Dewan Komisaris",
  KEBIJAKAN_PROSEDUR: "Kebijakan dan Prosedur Tertulis",
  PROSES_MANAJEMEN_RISIKO: "Proses Manajemen Risiko",
  MANAJEMEN_SDM: "Manajemen Sumber Daya Manusia",
  PENGENDALIAN_INTERNAL: "Sistem Pengendalian Internal",
};

export type IraKpmrQuestion = {
  code: string;
  pillar: IraKpmrPillar;
  /** Nomor pertanyaan di dalam pilarnya, mulai dari 1 — sama dengan penomoran template. */
  number: number;
  question: string;
  /** `false` berarti tampil sebagai N/A terisi dan dikecualikan dari rata-rata pilarnya. */
  applicableToKupvaBb: boolean;
  /**
   * Temuan pemeriksaan BI 2026 yang bersangkutan dengan pertanyaan ini.
   *
   * Gunanya bukan hiasan: layar dapat menunjukkan **pertanyaan mana yang pernah menjadi temuan**,
   * dan itu yang paling berguna bagi penggunanya saat mengisi. Kosong berarti pertanyaan itu tidak
   * pernah menjadi temuan — bukan berarti belum ditelusuri.
   */
  relatedFindings: number[];
};

/** 31 pertanyaan, urut sesuai lembar B. */
export const IRA_KPMR_QUESTIONS: IraKpmrQuestion[] = [

  // Pilar 1 — Tugas dan Tanggung Jawab Direksi dan Pengawasan Aktif Dewan Komisaris (7 pertanyaan)
  {
    code: "KPMR_P1_1",
    pillar: "DIREKSI_KOMISARIS",
    number: 1,
    applicableToKupvaBb: true,
    relatedFindings: [8],
    question: "Apakah Direksi telah menetapkan Kebijakan dan Prosedur Tertulis (KPT) APU PPT PPPSPM dengan ketentuan dan perundang-undangan yang berlaku serta disetujui oleh Dewan Komisaris?",
  },
  {
    code: "KPMR_P1_2",
    pillar: "DIREKSI_KOMISARIS",
    number: 2,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah terdapat laporan yang disampaikan kepada Direksi untuk memastikan bahwa KPT APU PPT PPPSPM telah diterapkan secara efektif?",
  },
  {
    code: "KPMR_P1_3",
    pillar: "DIREKSI_KOMISARIS",
    number: 3,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Direksi melakukan pengkinian KPT APU PPT PPPSPM sesuai dengan ketentuan terkini?",
  },
  {
    code: "KPMR_P1_4",
    pillar: "DIREKSI_KOMISARIS",
    number: 4,
    applicableToKupvaBb: true,
    relatedFindings: [8],
    question: "Apakah Direksi telah memastikan bahwa pelaporan LTKM, LTKT, LTKL dan laporan lainnya ke PPATK telah dilaksanakan sesuai ketentuan?",
  },
  {
    code: "KPMR_P1_5",
    pillar: "DIREKSI_KOMISARIS",
    number: 5,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Direksi memastikan bahwa seluruh pegawai telah memperoleh pengetahuan dan/atau pelatihan mengenai penerapan APU PPT PPPSPM?",
  },
  {
    code: "KPMR_P1_6",
    pillar: "DIREKSI_KOMISARIS",
    number: 6,
    applicableToKupvaBb: true,
    relatedFindings: [9],
    question: "Apakah Direksi memastikan pengkinian profil nasabah dan profil transaksi nasabah?",
  },
  {
    code: "KPMR_P1_7",
    pillar: "DIREKSI_KOMISARIS",
    number: 7,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Dewan Komisaris telah mengawasi pelaksanaan tugas dan tanggung jawab Direksi terhadap penerapan APU PPT PPPSPM?",
  },

  // Pilar 2 — Kebijakan dan Prosedur Tertulis (8 pertanyaan)
  {
    code: "KPMR_P2_1",
    pillar: "KEBIJAKAN_PROSEDUR",
    number: 1,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara telah memiliki, melaksanakan, dan mengembangkan KPT terkait APU PPT PPPSPM?",
  },
  {
    code: "KPMR_P2_2",
    pillar: "KEBIJAKAN_PROSEDUR",
    number: 2,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara memantau, mengevaluasi, dan meningkatkan efektivitas penerapan KPT APU PPT PPPSPM?",
  },
  {
    code: "KPMR_P2_3",
    pillar: "KEBIJAKAN_PROSEDUR",
    number: 3,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara memiliki KPT yang lengkap mengenai Customer Due Diligence (CDD)? KPT mencakup secara umum: a. pembukaan hubungan usaha dengan Pengguna Jasa; b. identifikasi dan verifikasi identitas Pengguna Jasa dan Beneficial Owner apabila ada; c. penentuan profil risiko dan pengelompokan Pengguna Jasa ke dalam tingkat risiko rendah, sedang, atau tinggi; d. pemantauan terhadap Transaksi dengan memperhatikan profil Pengguna Jasa; dan e. penolakan pembukaan hubungan usaha, pelaksanaan Transaksi, dan penutupan hubungan usaha. Cakupan Khusus terkait CDD Sederhana: a. dasar penentuan calon Pengguna Jasa, Pengguna Jasa, atau Beneficial Owner yang termasuk kategori berisiko rendah; dan b. tata cara penerapan customer due diligence sederhana. Cakupan Khusus terkait EDD: a. dasar penentuan calon Pengguna Jasa, Pengguna Jasa, atau Beneficial Owner yang termasuk kategori berisiko tinggi; dan b. prosedur enhanced due diligence. Cakupan Khusus terkait CDD terhadap PEP: a. dasar penentuan calon Pengguna Jasa, Pengguna Jasa, atau Beneficial Owner yang termasuk dalam kategori PEP; dan b. tata cara penerapan customer due diligence sebagaimana dimaksud pada ayat (1) dan langkah tambahan sebagaimana dimaksud pada ayat (2). Catatan: Ketentuan identifikasi, verifikasi, pemantauan dan pemahaman maksud dan tujuan Trasaksi/hubungan usaha dalam rangka CDD atau EDD terhadap Calon Pengguna Jasa, Pengguna Jasa, dan Beneficial Owner (BO) mengacu pada PBI APU PPT PPPSPM Pasal 15 s.d. 35.",
  },
  {
    code: "KPMR_P2_4",
    pillar: "KEBIJAKAN_PROSEDUR",
    number: 4,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara memiliki KPT yang lengkap mengenai pengelolaan data, informasi, dan dokumen? KPT mencakup: a. penginian data, informasi, dan dokumen Pengguna Jasa dan/atau Beneficial Owner dari Transaksi; dan b. penyediaan data, informasi, dan dokumen untuk kepentingan internal, seperti unit kepatuhan, unit audit internal, dan unit bisnis lain maupun eksternal seperti Bank Indonesia, PPATK, penegak hukum, dan otoritas yang berwenang. Catatan: penatausahaan dokumen terkait data Pengguna Jasa selama jangka waktu paling singkat 5 (lima) tahun.",
  },
  {
    code: "KPMR_P2_5",
    pillar: "KEBIJAKAN_PROSEDUR",
    number: 5,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara memiliki KPT yang lengkap mengenai pelaporan transaksi mencurigakan dan laporan lainnya? KPT mencakup: a. identifikasi, analisis, investigasi, dan pelaporan transaksi Keuangan Mencurigakan; b. pelaporan lainnya sesuai dengan ketentuan perundang undangan antara lain laporan Transaksi keuangan tunai dan laporan Transfer Dana dari dan ke luar negeri; dan c. pengamanan data dan kerahasiaan laporan tersebut. Catatan: kebijakan menjaga kerahasiaan informasi dalam pelaksanaan CDD memperhatikan ketentuan anti-tipping off.",
  },
  {
    code: "KPMR_P2_6",
    pillar: "KEBIJAKAN_PROSEDUR",
    number: 6,
    applicableToKupvaBb: false,
    relatedFindings: [],
    question: "Bagi Penyelenggara yang menyelenggarakan kegiatan transfer dana, apakah memiliki KPT yang lengkap mengenai Transfer Dana? KPT mencakup: a. Penerimaan dan/atau penerusan Transfer Dana; b. Penelitian kelengkapan informasi dalam Transfer Dana dan tindak lanjutnya; dan c. penyerahan dana kepada penerima.",
  },
  {
    code: "KPMR_P2_7",
    pillar: "KEBIJAKAN_PROSEDUR",
    number: 7,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Bagi Penyelenggara yang merupakan kelompok usaha, apakah memiliki KPT yang lengkap mengenai penerapan APU PPT PPPSPM terhadap Kelompok Usaha? KPT mencakup: a. pertukaran informasi antar perusahaan induk, perusahaan anak, dan/atau kantor cabang; b. perolehan data dan informasi dari perusahaan anak dan/atau kantor cabang bagi fungsi audit internal dan/atau unit kerja APU, PPT, dan PPPSPM; c. pengamanan kerahasiaan data dan informasi; dan d. penerapan langkah terbaik dalam rangka pengendalian risiko untuk penerapan APU, PPT, dan PPPSPM dalam hal terdapat perbedaan standar penerapan APU, PPT, dan PPPSPM.",
  },
  {
    code: "KPMR_P2_8",
    pillar: "KEBIJAKAN_PROSEDUR",
    number: 8,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara memiliki KPT yang lengkap mengenai penanganan DTTOT dan DPPSPM? KPT mencakup: a. mengidentifikasi, menilai, memahami, dan memitigasi risiko termasuk atas potensi pelanggaran dan penghindaran sanksi (sanction evasion) yang dilakukan calon penggunan jasan dan pengguna jasa; b. menatausahakan dan mengkinikan DTTOT dan DPPSPM secara berkala sesuai dengan ketentuan; c. melakukan pengecekan kesamaan nama dan informasi lainnya dari calon Pengguna Jasa dan Pengguna Jasa dengan DTTOT dan DPPSPM; d. melakukan pemblokiran serta merta dan melaporkannya sebagai LTKM, apabila terdapat kesamaan; dan e. melakukan mitigasi atas risiko false positive atau false negative.",
  },

  // Pilar 3 — Proses Manajemen Risiko (10 pertanyaan)
  {
    code: "KPMR_P3_1",
    pillar: "PROSES_MANAJEMEN_RISIKO",
    number: 1,
    applicableToKupvaBb: true,
    relatedFindings: [11],
    question: "Apakah Penyelenggara telah menerapkan APU PPT PPPSPM dengan cara mengidentifikasi, menilai, dan memahami proses manajemen risiko (termasuk aspek pengendalian dan mitigasi) sesuai dengan pedoman Risk Based Approach (RBA) untuk Penyelenggara? Catatan: Proses manajemen risiko diterapkan terhadap calon pengguna jasa, pengguna jasa, negara atau area geografis, produk atau jasa dan transakasi, dan jaringan distribusi.",
  },
  {
    code: "KPMR_P3_2",
    pillar: "PROSES_MANAJEMEN_RISIKO",
    number: 2,
    applicableToKupvaBb: true,
    relatedFindings: [11],
    question: "Apakah identifikasi dan penilaian risiko Penyelenggara telah meliputi seluruh faktor risiko dengan memadai? Faktor risiko: a. risiko calon Pengguna Jasa dan Pengguna Jasa; b. risiko negara atau area geografis; c. risiko produk atau jasa dan Transaksi; dan/atau d. risiko jaringan distribusi",
  },
  {
    code: "KPMR_P3_3",
    pillar: "PROSES_MANAJEMEN_RISIKO",
    number: 3,
    applicableToKupvaBb: true,
    relatedFindings: [11],
    question: "Apakah Penyelenggara telah mengacu pada hasil identifikasi dan penilaian risiko oleh otoritas yang berwenang serta dokumen dan informasi terkait lainnya? Catatan: Hasil identifikasi dan penilaian risiko oleh otoritas yang berwenang antara lain berupa national risk assessment (NRA) dan sectoral risk assesment (SRA).",
  },
  {
    code: "KPMR_P3_4",
    pillar: "PROSES_MANAJEMEN_RISIKO",
    number: 4,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Dalam hal penyelenggara menilai risiko yang dihadapi dalam kegiatan usahanya semakin meningkat, apakah Penyelanggara telah melakukan peningkatan pengendalian dan mitigasi risiko TPPU, TPPT, dan PPSPM?",
  },
  {
    code: "KPMR_P3_5",
    pillar: "PROSES_MANAJEMEN_RISIKO",
    number: 5,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara: a. melakukan pengkinian secara berkala; b. mendokumentasikan; dan c. memiliki mekanisme penyediaan informasi yang memadai bagi otoritas yang berwenang.",
  },
  {
    code: "KPMR_P3_6",
    pillar: "PROSES_MANAJEMEN_RISIKO",
    number: 6,
    applicableToKupvaBb: true,
    relatedFindings: [9, 10],
    question: "Apakah Penyelenggara telah melakukan pengkinian secara berkala terhadap profil nasabah dan profil transaksi, serta melakukan pemantauan kesesuaian transaksi terhadap profil? Catatan: Penyelenggara yang memiliki skala usaha dan layanan yang kompleks wajib memiliki sistem untuk melakukan pemantauan secara efektif",
  },
  {
    code: "KPMR_P3_7",
    pillar: "PROSES_MANAJEMEN_RISIKO",
    number: 7,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara telah menunjuk Manajemen Senior yang bertanggung jawab dalam pelaksanaan hubungan usaha dan/atau Transaksi dengan calon Pengguna Jasa, Pengguna Jasa, atau Beneficial Owner yang termasuk kategori berisiko tinggi?",
  },
  {
    code: "KPMR_P3_8",
    pillar: "PROSES_MANAJEMEN_RISIKO",
    number: 8,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara telah menatausahakan Daftar Pengguna Jasa yang mendapat perlakuan EDD?",
  },
  {
    code: "KPMR_P3_9",
    pillar: "PROSES_MANAJEMEN_RISIKO",
    number: 9,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara telah melakukan EDD dan langkah pencegahan (countermeasures) yang proporsional dan memadai terhadap risiko dari hubungan usaha dan/atau Transaksi dengan calon Pengguna Jasa dan/atau Pengguna Jasa, yang berasal dari negara berisiko tinggi yang dipublikasikan oleh FATF?",
  },
  {
    code: "KPMR_P3_10",
    pillar: "PROSES_MANAJEMEN_RISIKO",
    number: 10,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara melakukan identifikasi, penilaian dan mitigasi risiko PU dan PT sebelum melakukan pengembangan produk baru dan/atau menggunakan teknologi baru?",
  },

  // Pilar 4 — Manajemen Sumber Daya Manusia (3 pertanyaan)
  {
    code: "KPMR_P4_1",
    pillar: "MANAJEMEN_SDM",
    number: 1,
    applicableToKupvaBb: true,
    relatedFindings: [12],
    question: "Apakah Penyelenggara melakukan proses penyaringan penerimaan pegawai yang terkait penerapan APU PPT PPPSPM (pre-employee screening) secara efektif? Catatan: Pegawai yang terkait penerapan APU, PPT, dan PPPSPM antara lain unit kerja khusus, frontliner, auditor internal, kurir Penyelenggara KUPVA BBB yang melakukan pembawaan uang kertas asing, dan/atau pegawai lainnya yang terpapar risiko TPPU, TPPT, dan PPSPM.",
  },
  {
    code: "KPMR_P4_2",
    pillar: "MANAJEMEN_SDM",
    number: 2,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara melakukan proses Know Your Employee (KYE) yang menghasilkan profil pegawai yang terkait penerapan APU PPT PPPSPM dan melakukan pemantauan serta pengkinian profil pegawai dimaksud secara berkala? Catatan: Pemantauan melalui pengenalan latar belakang, karakter, perilaku, dan gaya hidup pegawai.",
  },
  {
    code: "KPMR_P4_3",
    pillar: "MANAJEMEN_SDM",
    number: 3,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara melakukan pelatihan dan peningkatanan pemahaman (awareness) mengenai APU, PPT, dan PPPSPM terhadap pegawai yang terkait penerapan APU PPT PPPSPM secara berkesinambungan? Materi memuat antara lain: a. Penerapan ketentuan peraturan perundang-undangan yang terkait dengan APU, PPT, dan PPPSPM; b. teknik, metode, dan tipologi TPPU, TPPT, dan PPPSM; dan c. kebijakan dan prosedur penerapan APU, PPT, dan PPPSPM serta peran dan tanggung jawab pegawai dalam mencegah TPPU, TPPT, dan PPSPM.",
  },

  // Pilar 5 — Sistem Pengendalian Internal (3 pertanyaan)
  {
    code: "KPMR_P5_1",
    pillar: "PENGENDALIAN_INTERNAL",
    number: 1,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara telah membentuk unit kerja, penetapan fungsi dan/atau menunjuk Manajemen senior yang bertanggung jawab khusus untuk penerapan APU PPT PPPSPM? Catatan: Manajemen senior dapat ditunjuk dalam hal penyelenggara memiliki skala usaha yang kecil, teknologi yang digunakan sederhana dan/atau tingkat resiko TPPU, TPPT, dan PPSPM yang rendah.",
  },
  {
    code: "KPMR_P5_2",
    pillar: "PENGENDALIAN_INTERNAL",
    number: 2,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah Penyelenggara telah melakukan pemisahan wewenang dan tanggung jawab antara pihak yang melaksanakan fungsi audit dengan unit bisnis?",
  },
  {
    code: "KPMR_P5_3",
    pillar: "PENGENDALIAN_INTERNAL",
    number: 3,
    applicableToKupvaBb: true,
    relatedFindings: [],
    question: "Apakah telah dilakukan audit independen (Internal/eksternal) secara berkala untuk menguji kepatuhan dan efektivitas penerapan APU PPT dan PPPSPM? Cakupan audit a.l. pengujian terhadap: a. kecukupan kebijakan dan prosedur pengelolaan dan mitigasi risiko; b. efektivitas pelaksanaan kebijakan dan prosedur; c. kualitas parameter yang diterapkan untuk mengidentifikasi risiko; dan d. efektivitas pelaksanaan kebijakan dan prosedur manajemen sumber daya manusia.",
  },
];

export const IRA_KPMR_QUESTION_COUNT_BY_PILLAR: Record<IraKpmrPillar, number> = IRA_KPMR_PILLARS.reduce(
  (counts, pillar) => ({ ...counts, [pillar]: IRA_KPMR_QUESTIONS.filter((question) => question.pillar === pillar).length }),
  {} as Record<IraKpmrPillar, number>,
);

const BY_CODE = new Map(IRA_KPMR_QUESTIONS.map((question) => [question.code, question]));

/** Satu pertanyaan. Kode tak dikenal **dilempar** — pertanyaan yang hilang tidak boleh diam-diam menjadi N/A. */
export function kpmrQuestion(code: string): IraKpmrQuestion {
  const question = BY_CODE.get(code);
  if (!question) throw new Error(`Pertanyaan KPMR tidak dikenal: ${code}`);
  return question;
}

/** Pertanyaan satu pilar, urut nomornya. */
export function questionsOfPillar(pillar: IraKpmrPillar): IraKpmrQuestion[] {
  return IRA_KPMR_QUESTIONS.filter((question) => question.pillar === pillar);
}
