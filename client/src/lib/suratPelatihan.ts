import { toast } from "sonner";

/**
 * Mencetak Surat Keterangan Pelaksanaan Pelatihan Internal APU PPT beserta lampirannya.
 *
 * Bentuk suratnya mengikuti surat yang sudah dipakai perusahaan, karena surat inilah yang
 * dilampirkan pada perpanjangan izin di e-Licensing Bank Indonesia. Isinya diambil dari catatan
 * pelatihan yang sama dengan yang dipantau di halaman Kepegawaian, sehingga surat dan bukti
 * daftar hadirnya tidak pernah berbeda.
 *
 * Sama seperti Surat Keputusan penunjukan: jendela cetak peramban, tanpa pustaka PDF.
 */

export type SuratPelatihanRow = {
  fullName: string;
  position: string;
  /** Tanggal pelatihan terakhir dalam periode; kosong bila pegawai belum pernah ikut. */
  lastTrainedAt: string | null;
};

export type SuratPelatihanInput = {
  letterNumber: string;
  /** Periode pemenuhan tahunan pada badan surat, mis. "Mei 2025 - April 2026". */
  periodLabel: string;
  topics: string[];
  methods: string[];
  facilitators: string[];
  /** Rincian materi yang disesuaikan dengan jobdesk; dicetak sebagai halaman terakhir bila ada. */
  materials: string[];
  signedCity: string;
  signedAt: string;
  signatory: { fullName: string; position: string };
  company: { legalEntityName: string; address?: string | null; phone?: string | null; logoUrl?: string | null };
  rows: SuratPelatihanRow[];
};

const escapeHtml = (value: unknown) =>
  String(value ?? "-").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);

const formatLongDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";

const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** Bulan romawi untuk nomor surat: Januari -> I, Juni -> VI. */
export function romanMonth(month: number): string {
  return ROMAN_MONTHS[month - 1] ?? "I";
}

/** Usulan nomor surat mengikuti pola yang sudah dipakai: SKP-APUPPT/VI/2026/001. */
export function suggestTrainingLetterNumber(signedAt: string, sequence: number): string {
  const date = signedAt ? new Date(signedAt) : new Date();
  return `SKP-APUPPT/${romanMonth(date.getMonth() + 1)}/${date.getFullYear()}/${String(sequence).padStart(3, "0")}`;
}

/** Sebutan metode pelatihan pada surat. */
export const TRAINING_METHOD_LABELS: Record<string, string> = {
  IN_HOUSE: "In-House Training (Tatap Muka & Simulasi Kasus)",
  EKSTERNAL: "Pelatihan Eksternal (Lembaga Penyelenggara)",
  DARING: "Pelatihan Daring (Webinar / Kelas Jarak Jauh)",
};

/** Menyatukan daftar menjadi satu kalimat, tanpa mengulang isi yang sama. */
const joinUnique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join("; ") || "—";

export function printSuratPelatihan(input: SuratPelatihanInput) {
  const win = window.open("", "_blank");
  if (!win) return toast.error("Izinkan pop-up browser untuk mencetak atau menyimpan surat sebagai PDF.");

  const hasLogo = Boolean(input.company.logoUrl);
  // Logo diambil lewat jaringan; cetak ditunda sampai gambarnya termuat agar kop tidak kosong.
  const logo = hasLogo
    ? `<img class="logo" src="${escapeHtml(input.company.logoUrl)}" alt="" onload="window.__skPrint()" onerror="window.__skPrint()">`
    : "";
  const printScript = hasLogo
    ? `<script>var p=false;window.__skPrint=function(){if(p)return;p=true;window.print();};setTimeout(window.__skPrint,1500);</script>`
    : `<script>window.print()</script>`;

  const attendance = input.rows
    .map((row, index) => `<tr>
      <td class="num">${index + 1}.</td>
      <td>${escapeHtml(row.fullName)}</td>
      <td>${escapeHtml(row.position)}</td>
      <td>${row.lastTrainedAt ? escapeHtml(formatLongDate(row.lastTrainedAt)) : '<span class="belum">Belum mengikuti</span>'}</td>
    </tr>`)
    .join("");

  const materials = input.materials.length
    ? `<div class="halaman">
        <div class="sub">MATERI PELATIHAN YANG DISESUAIKAN DENGAN JOBDESK PERUSAHAAN</div>
        <ul>${input.materials.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>`
    : "";

  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(input.letterNumber)}</title><style>
    @page { size: A4; margin: 20mm 22mm; }
    * { box-sizing: border-box; }
    body { font-family: "Times New Roman", Times, serif; color: #111; font-size: 12pt; line-height: 1.5; margin: 0 auto; max-width: 190mm; padding: 14mm; background: #fff; }
    @media print { body { max-width: none; margin: 0; padding: 0; -webkit-print-color-adjust: exact; } }
    .kop { display: flex; align-items: flex-start; gap: 14px; padding-bottom: 8px; }
    .kop .logo { height: 46px; width: auto; object-fit: contain; }
    .kop .alamat { font-size: 10pt; line-height: 1.35; }
    .kop .nama { font-weight: bold; font-size: 12pt; }
    hr.rule { border: 0; border-top: 2px solid #111; margin: 0 0 26px; }
    .judul { text-align: center; margin-bottom: 22px; }
    .judul .t { font-weight: bold; letter-spacing: .04em; }
    .judul .no { font-weight: bold; }
    p { margin: 0 0 12px; text-align: justify; }
    table.rincian { margin: 14px 0 16px; border-collapse: collapse; width: 100%; }
    table.rincian td { padding: 3px 0; vertical-align: top; }
    table.rincian td.label { width: 150px; font-weight: bold; }
    table.rincian td.sep { width: 14px; }
    .ttd { margin-top: 34px; display: flex; justify-content: flex-end; }
    .ttd .blok { text-align: center; min-width: 240px; }
    .ttd .ruang { height: 74px; }
    .ttd .nama { font-weight: bold; }
    .halaman { page-break-before: always; margin-top: 28px; }
    @media print { .halaman { margin-top: 0; } }
    .sub { font-weight: bold; text-align: center; margin-bottom: 4px; }
    .periode { text-align: center; margin-bottom: 16px; }
    table.hadir { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11pt; }
    table.hadir th, table.hadir td { border: 1px solid #111; padding: 5px 7px; vertical-align: top; word-wrap: break-word; }
    table.hadir th { background: #eee; text-align: left; }
    table.hadir td.num, table.hadir th.num { width: 46px; text-align: center; }
    table.hadir th:nth-child(4), table.hadir td:nth-child(4) { width: 130px; }
    .belum { font-style: italic; }
    ul { margin: 0; padding-left: 18px; }
    li { margin-bottom: 8px; text-align: justify; }
  </style></head><body>
    <div class="kop">
      ${logo}
      <div class="alamat">
        <div class="nama">${escapeHtml(input.company.legalEntityName)}</div>
        <div>${escapeHtml(input.company.address)}</div>
        ${input.company.phone ? `<div>Tlp. ${escapeHtml(input.company.phone)}</div>` : ""}
      </div>
    </div>
    <hr class="rule">

    <div class="judul">
      <div class="t">SURAT KETERANGAN PELAKSANAAN PELATIHAN INTERNAL</div>
      <div class="no">Nomor: ${escapeHtml(input.letterNumber)}</div>
    </div>

    <p>Yang bertanda tangan di bawah ini, Direksi ${escapeHtml(input.company.legalEntityName)}, dengan ini menerangkan
    bahwa perusahaan telah melaksanakan kegiatan Pelatihan Penyegaran (Refresher Training) Anti Pencucian Uang dan
    Pencegahan Pendanaan Terorisme (APU-PPT) bagi seluruh jajaran pegawai untuk pemenuhan periode tahunan
    (${escapeHtml(input.periodLabel)}), yang diselenggarakan secara berkala pada:</p>

    <table class="rincian">
      <tr><td class="label">Topik Pelatihan</td><td class="sep">:</td><td>${escapeHtml(joinUnique(input.topics))}</td></tr>
      <tr><td class="label">Metode Pelatihan</td><td class="sep">:</td><td>${escapeHtml(joinUnique(input.methods))}</td></tr>
      <tr><td class="label">Pemateri / Fasilitator</td><td class="sep">:</td><td>${escapeHtml(joinUnique(input.facilitators))}</td></tr>
    </table>

    <p>Demikian surat keterangan ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagai dokumen pendukung
    perpanjangan izin operasional KUPVA BB pada sistem e-Licensing Bank Indonesia.</p>

    <div class="ttd">
      <div class="blok">
        <div>${escapeHtml(input.signedCity)}, ${escapeHtml(formatLongDate(input.signedAt))}</div>
        <div>${escapeHtml(input.company.legalEntityName)}</div>
        <div class="ruang"></div>
        <div class="nama">( ${escapeHtml(input.signatory.fullName)} )</div>
        <div>${escapeHtml(input.signatory.position)}</div>
      </div>
    </div>

    <div class="halaman">
      <div class="sub">LAMPIRAN: REKAPITULASI DAFTAR HADIR DAN EVALUASI</div>
      <div class="periode">PERIODE: ${escapeHtml(input.periodLabel)}</div>
      <table class="hadir">
        <thead><tr><th class="num">No.</th><th>Nama Pegawai</th><th>Jabatan / Posisi</th><th>Tanggal Pelatihan</th></tr></thead>
        <tbody>${attendance}</tbody>
      </table>
    </div>
    ${materials}
  ${printScript}</body></html>`);
  win.document.close();
}
