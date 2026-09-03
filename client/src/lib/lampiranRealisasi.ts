import { toast } from "sonner";

/**
 * Mencetak Laporan Realisasi Kepemilikan dan Pemeliharaan Sertifikat (Lampiran X/XI PADG No. 17
 * Tahun 2024, bagian B.II untuk PBK dan B.IV untuk Sertifikasi Kompetensi).
 *
 * Formulirnya satu baris per Bidang SKKNI dengan kolom terbagi menurut jenjang, ditutup baris Total,
 * Akumulasi Realisasi, dan persentasenya. Hanya bagian B.IV memiliki kolom Direksi — jumlah kolom
 * karena itu mengikuti data, bukan dipatok.
 */

export type RealisasiColumn = {
  label: string;
  totalSdm: number;
  rencanaBase: number;
  rencanaMaintenance: number;
  realisasiBase: number;
  realisasiMaintenance: number;
  akumulasi: number;
};

export type LampiranRealisasiInput = {
  section: string;
  title: string;
  bidang: string;
  lampiran: "X" | "XI";
  year: number;
  quarter: number;
  columns: RealisasiColumn[];
  totalSdm: number;
  totalAkumulasi: number;
  persentaseAkumulasi: number;
  realisasiDanaSertifikasi: number;
  realisasiDanaPemeliharaan: number;
  company: { legalEntityName: string };
  signatory: { fullName: string; position: string };
  signedCity: string;
  signedAt: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "-").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);

const rupiah = (value: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(value))}`;
const romanQuarter = (quarter: number) => ["", "I", "II", "III", "IV"][quarter] ?? String(quarter);
const formatLongDate = (value: string) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";

export function printLampiranRealisasi(input: LampiranRealisasiInput) {
  const win = window.open("", "_blank");
  if (!win) return toast.error("Izinkan pop-up browser untuk mencetak atau menyimpan laporan sebagai PDF.");

  const span = input.columns.length;
  const levelHeads = input.columns.map((column) => `<th class="n">${escapeHtml(column.label)}</th>`).join("");
  const cells = (pick: (column: RealisasiColumn) => number) =>
    input.columns.map((column) => `<td class="n">${pick(column)}</td>`).join("");

  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Lampiran ${escapeHtml(input.lampiran)} ${escapeHtml(input.section)} — Tw ${romanQuarter(input.quarter)} ${input.year}</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 9.5pt; margin: 0 auto; max-width: 272mm; padding: 10mm; background: #fff; }
    @media print { body { max-width: none; margin: 0; padding: 0; } }
    .kop { font-weight: bold; font-size: 10pt; line-height: 1.45; margin-bottom: 14px; }
    h1 { font-size: 11pt; text-align: center; margin: 0 0 10px; text-transform: uppercase; }
    .meta div { margin-bottom: 2px; }
    .sect { font-weight: bold; margin: 8px 0 4px; }
    /* Bagian B.IV memuat dua puluh kolom. Lebar kolom angka dipatok sempit dan judulnya dibiarkan
       membungkus, supaya seluruh kolom muat pada satu halaman A4 mendatar — bila dibiarkan
       melebar, kolom paling kanan terpotong saat dicetak dan laporannya tidak lengkap. */
    .scroll { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 7pt; margin-top: 4px; }
    th, td { border: 1px solid #111; padding: 3px 2px; vertical-align: middle; word-wrap: break-word; }
    th { text-align: center; font-weight: bold; font-size: 6.5pt; line-height: 1.2; }
    td.n, th.n { text-align: center; width: 34px; }
    td.money { font-size: 7pt; width: 62px; }
    td.bidang { font-size: 7pt; width: 70px; }
    td.idx { width: 20px; text-align: center; }
    tr.total td, tr.akum td, tr.pct td { font-weight: bold; }
    .catatan { margin-top: 12px; font-size: 8pt; line-height: 1.5; }
    .ttd { margin-top: 22px; display: flex; justify-content: flex-end; }
    .ttd .blok { text-align: center; min-width: 250px; }
    .ttd .ruang { height: 66px; }
    .ttd .nama { font-weight: bold; }
  </style></head><body>
    <div class="kop">Lampiran ${escapeHtml(input.lampiran)}<br>
      Peraturan Anggota Dewan Gubernur, Nomor 17 Tahun 2024, Tanggal 19 November 2024 Tentang<br>
      Pelaksanaan Standarisasi Kompetensi Di Bidang Sistem Pembayaran</div>

    <h1>Laporan Realisasi Kepemilikan dan Pemeliharaan ${escapeHtml(input.title)}</h1>

    <div class="meta">
      <div>Periode Laporan : Triwulan ${romanQuarter(input.quarter)} Tahun ${input.year}</div>
      <div>Nama Pelaku SKSP : ${escapeHtml(input.company.legalEntityName)}</div>
    </div>
    <div class="sect">${escapeHtml(input.section)}</div>

    <div class="scroll"><table>
      <thead>
        <tr>
          <th rowspan="3" class="idx">No.</th>
          <th rowspan="3">Total Realisasi Penggunaan Dana ${escapeHtml(input.title)} Tahun Berjalan <sup>1)</sup></th>
          <th rowspan="3">Total Realisasi Penggunaan Dana Pemeliharaan ${escapeHtml(input.title)} Tahun Berjalan <sup>2)</sup></th>
          <th rowspan="3">Bidang SKKNI SP <sup>3)</sup></th>
          <th colspan="${span}" rowspan="2">Total SDM <sup>4)</sup></th>
          <th colspan="${span * 2}">Rencana Pemenuhan Kepemilikan ${escapeHtml(input.title)}</th>
          <th colspan="${span * 2}">Realisasi Pemenuhan Kepemilikan ${escapeHtml(input.title)}</th>
        </tr>
        <tr>
          <th colspan="${span}">Rencana <sup>5)</sup></th>
          <th colspan="${span}">Rencana Pemeliharaan <sup>6)</sup></th>
          <th colspan="${span}">Realisasi <sup>7)</sup></th>
          <th colspan="${span}">Realisasi Pemeliharaan <sup>8)</sup></th>
        </tr>
        <tr>${levelHeads}${levelHeads}${levelHeads}${levelHeads}${levelHeads}</tr>
      </thead>
      <tbody>
        <tr>
          <td class="idx">1</td>
          <td class="money">${rupiah(input.realisasiDanaSertifikasi)}</td>
          <td class="money">${rupiah(input.realisasiDanaPemeliharaan)}</td>
          <td class="bidang">${escapeHtml(input.bidang)}</td>
          ${cells((column) => column.totalSdm)}
          ${cells((column) => column.rencanaBase)}
          ${cells((column) => column.rencanaMaintenance)}
          ${cells((column) => column.realisasiBase)}
          ${cells((column) => column.realisasiMaintenance)}
        </tr>
        <tr class="total">
          <td colspan="4">Total</td>
          ${cells((column) => column.totalSdm)}
          ${cells((column) => column.rencanaBase)}
          ${cells((column) => column.rencanaMaintenance)}
          ${cells((column) => column.realisasiBase)}
          ${cells((column) => column.realisasiMaintenance)}
        </tr>
        <tr class="akum">
          <td colspan="4">Akumulasi Realisasi <sup>9)</sup></td>
          <td class="n" colspan="${span * 5}">${input.totalAkumulasi} dari ${input.totalSdm} SDM</td>
        </tr>
        <tr class="pct">
          <td colspan="4">% <sup>10)</sup></td>
          <td class="n" colspan="${span * 5}">${input.persentaseAkumulasi.toLocaleString("id-ID")}%</td>
        </tr>
      </tbody>
    </table></div>

    <div class="catatan">
      1) Realisasi penggunaan dana ${escapeHtml(input.title.toLowerCase())} periode pelaporan 1 tahun berjalan (dalam rupiah penuh).<br>
      2) Realisasi penggunaan dana pemeliharaan ${escapeHtml(input.title.toLowerCase())} periode pelaporan 1 tahun berjalan (dalam rupiah penuh).<br>
      3) Sesuai kegiatan operasional yang dilakukan Pelaku SK SP menurut SKKNI Bidang Sistem Pembayaran.<br>
      4) Jumlah SDM yang wajib memiliki ${escapeHtml(input.title.toLowerCase())}, termasuk yang wajib mengikuti pemeliharaannya.<br>
      9) Akumulasi jumlah SDM yang telah memperoleh sertifikat sampai dengan periode pelaporan.<br>
      10) Persentase akumulasi realisasi SDM yang telah memperoleh sertifikat.
      ${input.lampiran === "XI" ? "<br><strong>*Masa Peralihan s.d 31 Desember 2026</strong>" : ""}
    </div>

    <div class="ttd">
      <div class="blok">
        <div>${escapeHtml(input.signedCity)}, ${escapeHtml(formatLongDate(input.signedAt))}</div>
        <div>${escapeHtml(input.company.legalEntityName)}</div>
        <div class="ruang"></div>
        <div class="nama">${escapeHtml(input.signatory.fullName)}</div>
        <div>${escapeHtml(input.signatory.position)}</div>
      </div>
    </div>
  <script>window.print()</script></body></html>`);
  win.document.close();
}
