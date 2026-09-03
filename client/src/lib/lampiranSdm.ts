import { toast } from "sonner";

/**
 * Mencetak Laporan Rencana Pemenuhan Kepemilikan dan Pemeliharaan Sertifikat PBK Sistem Pembayaran
 * (Lampiran X / XI PADG No. 17 Tahun 2024).
 *
 * Lampiran XI berlaku selama masa peralihan sampai 31 Desember 2026, Lampiran X sesudahnya; yang
 * dipakai dipilih dari tahun laporan, bukan dari tanggal penyusunan, agar laporan tahun terakhir
 * masa peralihan tetap memakai formulir yang benar meski disusun pada tahun berikutnya.
 */

export type LampiranRow = {
  label: string;
  totalSdm: number;
  rencanaPbk: number[];
  rencanaPemeliharaan: number[];
};

export type LampiranSdmInput = {
  year: number;
  lampiran: "X" | "XI";
  bidang: string;
  rows: LampiranRow[];
  totalDanaPbk: number;
  totalDanaPemeliharaan: number;
  company: { legalEntityName: string; address?: string | null };
  signatory: { fullName: string; position: string };
  signedCity: string;
  signedAt: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "-").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);

const rupiah = (value: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(value))}`;

const formatLongDate = (value: string) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";

export function printLampiranSdm(input: LampiranSdmInput) {
  const win = window.open("", "_blank");
  if (!win) return toast.error("Izinkan pop-up browser untuk mencetak atau menyimpan lampiran sebagai PDF.");

  const quarterHeads = ["Tw I", "Tw II", "Tw III", "Tw IV"];
  const body = input.rows.map((row) => `<tr>
      <td class="lvl">${escapeHtml(row.label)}</td>
      <td class="n">${row.totalSdm}</td>
      ${row.rencanaPbk.map((value) => `<td class="n">${value}</td>`).join("")}
      ${row.rencanaPemeliharaan.map((value) => `<td class="n">${value}</td>`).join("")}
    </tr>`).join("");

  const totals = input.rows.reduce(
    (accumulator, row) => ({
      totalSdm: accumulator.totalSdm + row.totalSdm,
      pbk: accumulator.pbk.map((value, index) => value + row.rencanaPbk[index]),
      maintenance: accumulator.maintenance.map((value, index) => value + row.rencanaPemeliharaan[index]),
    }),
    { totalSdm: 0, pbk: [0, 0, 0, 0], maintenance: [0, 0, 0, 0] },
  );

  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Lampiran ${escapeHtml(input.lampiran)} — ${input.year}</title><style>
    @page { size: A4 landscape; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: "Times New Roman", Times, serif; color: #111; font-size: 11pt; margin: 0 auto; max-width: 265mm; padding: 12mm; background: #fff; }
    @media print { body { max-width: none; margin: 0; padding: 0; } }
    .lampiran { text-align: right; font-size: 10pt; margin-bottom: 10px; line-height: 1.4; }
    h1 { font-size: 12pt; text-align: center; margin: 0 0 4px; text-transform: uppercase; line-height: 1.4; }
    .tahun { text-align: center; margin-bottom: 4px; }
    .pelaku { margin: 14px 0 6px; }
    .dana { margin: 10px 0 14px; }
    .dana div { margin-bottom: 3px; }
    table { border-collapse: collapse; width: 100%; font-size: 10pt; }
    th, td { border: 1px solid #111; padding: 5px 6px; }
    th { text-align: center; font-weight: bold; }
    td.n { text-align: center; }
    td.lvl { white-space: nowrap; }
    tr.total td { font-weight: bold; }
    .ttd { margin-top: 26px; display: flex; justify-content: flex-end; }
    .ttd .blok { text-align: center; min-width: 240px; }
    .ttd .ruang { height: 70px; }
    .ttd .nama { font-weight: bold; }
  </style></head><body>
    <div class="lampiran">LAMPIRAN ${escapeHtml(input.lampiran)}<br>PERATURAN ANGGOTA DEWAN GUBERNUR NOMOR 17 TAHUN 2024<br>TANGGAL 19 NOVEMBER 2024</div>

    <h1>Laporan Rencana Pemenuhan Kepemilikan dan Pemeliharaan Sertifikat PBK Sistem Pembayaran
    serta Rencana Penyediaan Dana${input.lampiran === "XI" ? " (Masa Peralihan s.d 31 Desember 2026)" : " (Untuk Seluruh SDM Pelaku SK SP yang Wajib Memiliki)"}</h1>
    <p class="tahun">TAHUN ${input.year}</p>

    <p class="pelaku">Nama Pelaku SK SP: <strong>${escapeHtml(input.company.legalEntityName)}</strong></p>

    <div class="dana">
      <div>Total Rencana Penyediaan Dana PBK Sistem Pembayaran Tahun Berikutnya: <strong>${rupiah(input.totalDanaPbk)}</strong></div>
      <div>Total Rencana Penyediaan Dana Pemeliharaan Sertifikat PBK Sistem Pembayaran Tahun Berikutnya: <strong>${rupiah(input.totalDanaPemeliharaan)}</strong></div>
    </div>

    <table>
      <thead>
        <tr>
          <th rowspan="2">Bidang SKKNI SP<br>${escapeHtml(input.bidang)}</th>
          <th rowspan="2">Total SDM</th>
          <th colspan="4">Rencana PBK Sistem Pembayaran</th>
          <th colspan="4">Rencana Pemeliharaan Sertifikat PBK</th>
        </tr>
        <tr>${quarterHeads.concat(quarterHeads).map((head) => `<th>${head}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${body}
        <tr class="total">
          <td class="lvl">Total</td>
          <td class="n">${totals.totalSdm}</td>
          ${totals.pbk.map((value) => `<td class="n">${value}</td>`).join("")}
          ${totals.maintenance.map((value) => `<td class="n">${value}</td>`).join("")}
        </tr>
      </tbody>
    </table>

    <div class="ttd">
      <div class="blok">
        <div>${escapeHtml(input.signedCity)}, ${escapeHtml(formatLongDate(input.signedAt))}</div>
        <div class="ruang"></div>
        <div class="nama">${escapeHtml(input.signatory.fullName)}</div>
        <div>${escapeHtml(input.signatory.position)}</div>
      </div>
    </div>
  <script>window.print()</script></body></html>`);
  win.document.close();
}
