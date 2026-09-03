import { toast } from "sonner";

/**
 * Mencetak Surat Keputusan penunjukan penanggung jawab fungsi.
 *
 * Bentuk suratnya mengikuti SK yang sudah dipakai perusahaan, sehingga hasil cetak dapat langsung
 * ditandatangani tanpa disunting lagi. Penilaian risiko meminta SK penunjukan sebagai bukti bahwa
 * penanggung jawab benar-benar ditetapkan; surat yang dihasilkan dari data yang sama dengan yang
 * dilaporkan menutup jarak antara catatan dan buktinya.
 *
 * Memakai jendela cetak peramban seperti kwitansi transaksi — tidak ada pustaka PDF tambahan, dan
 * pengguna menyimpannya sebagai PDF lewat dialog cetak.
 */

export type SuratKeputusanInput = {
  /** Nomor surat, mis. 001/APU-PPT/IBV/2026. */
  decreeNumber: string;
  /** Sebutan jabatan pada surat, mis. "Petugas APU dan PPT". */
  roleTitle: string;
  effectiveAt: string;
  signedAt: string;
  signedCity: string;
  employee: { fullName: string; identityNumber?: string | null; address?: string | null };
  signatory: { fullName: string; position: string };
  company: { legalEntityName: string; address?: string | null; phone?: string | null; logoUrl?: string | null };
};

const escapeHtml = (value: unknown) =>
  String(value ?? "-").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);

const formatLongDate = (value: string) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";

/** Sebutan jabatan pada surat untuk tiap fungsi penanggung jawab. */
export const PIC_ROLE_TITLES: Record<string, string> = {
  INTERNAL_AUDIT: "Auditor Internal",
  MANAJEMEN_RISIKO: "Petugas Manajemen Risiko",
  APU_PPT: "Petugas APU dan PPT",
  PERLINDUNGAN_KONSUMEN: "Petugas Perlindungan Konsumen",
  NASABAH_RISIKO_TINGGI: "Petugas Penanggung Jawab Nasabah Berisiko Tinggi",
};

/** Singkatan yang dipakai pada nomor surat tiap fungsi. */
export const PIC_ROLE_DECREE_CODES: Record<string, string> = {
  INTERNAL_AUDIT: "AUDIT",
  MANAJEMEN_RISIKO: "RISK",
  APU_PPT: "APU-PPT",
  PERLINDUNGAN_KONSUMEN: "KONSUMEN",
  NASABAH_RISIKO_TINGGI: "NRT",
};

/** Inisial badan hukum untuk nomor surat: "PT Ibu Kota Valasindo" -> "IKV". */
export function companyInitials(legalEntityName: string): string {
  const words = legalEntityName.replace(/^PT\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("").slice(0, 4) || "SK";
}

/** Usulan nomor surat mengikuti pola yang sudah dipakai: 001/APU-PPT/IBV/2026. */
export function suggestDecreeNumber(picRole: string, legalEntityName: string, sequence: number, year: number): string {
  return `${String(sequence).padStart(3, "0")}/${PIC_ROLE_DECREE_CODES[picRole] ?? "SK"}/${companyInitials(legalEntityName)}/${year}`;
}

export function printSuratKeputusan(input: SuratKeputusanInput) {
  const win = window.open("", "_blank");
  if (!win) return toast.error("Izinkan pop-up browser untuk mencetak atau menyimpan surat sebagai PDF.");

  const hasLogo = Boolean(input.company.logoUrl);
  // Logo diambil lewat jaringan, jadi cetak ditunda sampai gambarnya selesai dimuat — bila tidak,
  // dialog cetak terbuka sebelum logo tergambar dan kop surat tercetak kosong.
  const logo = hasLogo
    ? `<img class="logo" src="${escapeHtml(input.company.logoUrl)}" alt="" onload="window.__skPrint()" onerror="window.__skPrint()">`
    : "";
  const printScript = hasLogo
    ? `<script>var p=false;window.__skPrint=function(){if(p)return;p=true;window.print();};setTimeout(window.__skPrint,1500);</script>`
    : `<script>window.print()</script>`;

  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(input.decreeNumber)}</title><style>
    @page { size: A4; margin: 20mm 22mm; }
    * { box-sizing: border-box; }
    /* Lebar dibatasi agar pratinjau di layar sudah berbentuk halaman; saat dicetak, marjin @page
       yang berlaku sehingga pembatas ini dilepas. */
    body { font-family: "Times New Roman", Times, serif; color: #111; font-size: 12pt; line-height: 1.5; margin: 0 auto; max-width: 190mm; padding: 14mm; background: #fff; }
    @media print { body { max-width: none; margin: 0; padding: 0; } }
    .kop { display: flex; align-items: flex-start; gap: 14px; padding-bottom: 8px; }
    .kop .logo { height: 46px; width: auto; object-fit: contain; }
    .kop .alamat { font-size: 10pt; line-height: 1.35; }
    .kop .nama { font-weight: bold; font-size: 12pt; }
    hr.rule { border: 0; border-top: 2px solid #111; margin: 0 0 26px; }
    .judul { text-align: center; margin-bottom: 22px; }
    .judul .t { font-weight: bold; letter-spacing: .04em; }
    .judul .no { font-weight: bold; }
    p { margin: 0 0 12px; text-align: justify; }
    table.identitas { margin: 16px 0 18px; border-collapse: collapse; }
    table.identitas td { padding: 2px 0; vertical-align: top; }
    table.identitas td.label { width: 90px; }
    table.identitas td.sep { width: 14px; }
    .ttd { margin-top: 34px; display: flex; justify-content: flex-end; }
    .ttd .blok { text-align: center; min-width: 240px; }
    .ttd .ruang { height: 74px; }
    .ttd .nama { font-weight: bold; }
    @media print { body { -webkit-print-color-adjust: exact; } }
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
      <div class="t">SURAT KEPUTUSAN</div>
      <div class="no">No: ${escapeHtml(input.decreeNumber)}</div>
    </div>

    <p>Berdasarkan kebijakan manajemen ${escapeHtml(input.company.legalEntityName)} dalam rangka pelaksanaan
    Kegiatan Usaha Penukaran Valuta Asing Bukan Bank (KUPVA BB), dengan ini ditetapkan bahwa:</p>

    <table class="identitas">
      <tr><td class="label">Nama</td><td class="sep">:</td><td>${escapeHtml(input.employee.fullName)}</td></tr>
      <tr><td class="label">No. KTP</td><td class="sep">:</td><td>${escapeHtml(input.employee.identityNumber)}</td></tr>
      <tr><td class="label">Alamat</td><td class="sep">:</td><td>${escapeHtml(input.employee.address)}</td></tr>
    </table>

    <p>Telah secara resmi ditunjuk menjadi <strong>${escapeHtml(input.roleTitle)}</strong> ${escapeHtml(input.company.legalEntityName)}
    berlaku sejak tanggal ${escapeHtml(formatLongDate(input.effectiveAt))}. Surat keputusan ini berlaku selama menjadi pegawai
    ${escapeHtml(input.company.legalEntityName)}.</p>

    <p>Segala hak dan kewajiban lainnya akan diatur sebagaimana tercantum dalam ketentuan maupun peraturan
    perusahaan yang berlaku.</p>

    <div class="ttd">
      <div class="blok">
        <div>${escapeHtml(input.signedCity)}, ${escapeHtml(formatLongDate(input.signedAt))}</div>
        <div class="ruang"></div>
        <div class="nama">${escapeHtml(input.signatory.fullName)}</div>
        <div>${escapeHtml(input.signatory.position)}</div>
      </div>
    </div>
  ${printScript}</body></html>`);
  win.document.close();
}
