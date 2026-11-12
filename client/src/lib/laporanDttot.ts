import { toast } from "sonner";
import { escapePrintText } from "./printedCompany";

/**
 * Laporan atas pemberitahuan DTTOT, mengikuti format "Pedoman Pemblokiran Secara Serta Merta DTTOT" Bank Indonesia:
 * Lampiran I (Berita Acara Pemblokiran), Lampiran II (Laporan Pemblokiran), Lampiran III (Laporan Nihil).
 * Dicetak lewat jendela cetak peramban seperti surat lain; ditandatangani lalu dikirim fisik ke Densus 88 dan
 * dipindai untuk surel dan tembusan.
 */

export type DttotReportCompany = { legalName: string; address: string };
export type DttotReportSigner = { name: string; position: string };
export type DttotMatchedCustomer = {
  fullName: string; placeOfBirth?: string | null; dateOfBirth?: string | Date | null; occupation?: string | null; address?: string | null;
};

const esc = (value: unknown) => escapePrintText(String(value ?? "—"));
const ZONE = "Asia/Jakarta";

/** "Kamis, 15 Oktober 2026". */
export function longDayDate(at: Date): string {
  return at.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONE });
}

/** "11.38 WIB". */
export function clockWib(at: Date): string {
  return `${at.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONE }).replace(":", ".")} WIB`;
}

const birthDate = (value: DttotMatchedCustomer["dateOfBirth"]) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: ZONE }) : "—";

const recipient = `<p>Kepada<br>Yth. Kepala Kepolisian Negara Republik Indonesia<br>c.q. Kepala Densus 88<br>Kepolisian Negara Republik Indonesia<br>Di-<br>&nbsp;&nbsp;&nbsp;&nbsp;Jakarta</p>`;

const letterHead = (company: DttotReportCompany, input: { reportNumber: string; place: string; reportDate: Date; subject: string; attachment: string }) => `
  <div class="kop"><b>${esc(company.legalName)}</b><br>${esc(company.address)}</div>
  <table class="kepala"><tr><td>Nomor</td><td>: ${esc(input.reportNumber)}</td><td class="r">${esc(input.place)}, ${esc(longDayDate(input.reportDate).replace(/^[^,]+, /, ""))}</td></tr>
  <tr><td>Lamp</td><td>: ${esc(input.attachment)}</td><td></td></tr>
  <tr><td>Perihal</td><td>: <u>${esc(input.subject)}</u></td><td></td></tr></table>
  ${recipient}`;

const signature = (company: DttotReportCompany, signer: DttotReportSigner) =>
  `<div class="ttd"><div>${esc(company.legalName)}</div><div class="ruang"></div><div><b><u>${esc(signer.name)}</u></b></div><div>${esc(signer.position)}</div></div>`;

/** Lampiran III — Laporan Nihil atas Pemblokiran Secara Serta Merta. */
export function buildLaporanNihilHtml(input: { company: DttotReportCompany; reportNumber: string; place: string; reportDate: Date; screenedAt: Date; signer: DttotReportSigner }): string {
  return `${letterHead(input.company, { ...input, subject: "Laporan Nihil atas Pemblokiran Secara Serta Merta", attachment: "—" })}
  <p>Menunjuk Pasal 28 ayat (3) Undang-Undang Nomor 9 Tahun 2013 tentang Pencegahan dan Pemberantasan Tindak Pidana
  Pendanaan Terorisme, dengan ini kami laporkan bahwa sampai dengan ${esc(longDayDate(input.screenedAt))}, pukul
  ${esc(clockWib(input.screenedAt))} tidak terdapat kesesuaian identitas orang atau korporasi yang terdapat dalam
  <i>database</i> dengan identitas orang atau korporasi yang tercantum dalam DTTOT di penyelenggara atau NIHIL.</p>
  <p>Demikian kami sampaikan, atas perhatiannya kami ucapkan terima kasih.</p>
  ${signature(input.company, input.signer)}`;
}

/** Lampiran II (Laporan Pemblokiran) + Lampiran I (Berita Acara) satu halaman per nasabah yang cocok. */
export function buildLaporanPemblokiranHtml(input: {
  company: DttotReportCompany; reportNumber: string; place: string; reportDate: Date; blockedAt: Date; signer: DttotReportSigner;
  witness: DttotReportSigner; biLetter: string; listNumber: string; matched: DttotMatchedCustomer[];
}): string {
  const names = input.matched.map((row) => row.fullName).join(", ");
  const cover = `${letterHead(input.company, { ...input, subject: "Laporan Pemblokiran Secara Serta Merta", attachment: `${input.matched.length} berkas berita acara` })}
  <p>Menunjuk Pasal 28 ayat (3) Undang-Undang Nomor 9 Tahun 2013 tentang Pencegahan dan Pemberantasan Tindak Pidana
  Pendanaan Terorisme, dengan ini kami laporkan bahwa pada hari ${esc(longDayDate(input.blockedAt))}, pukul
  ${esc(clockWib(input.blockedAt))} telah dilakukan pemblokiran secara serta merta seluruh rekening atau aset/dana atas
  nama ${esc(names)}, sebagaimana berita acara terlampir.</p>
  <p>Demikian kami sampaikan, atas perhatiannya kami ucapkan terima kasih.</p>
  ${signature(input.company, input.signer)}`;
  const minutes = input.matched.map((row) => `<div class="halaman">
    <div class="kop"><b>${esc(input.company.legalName)}</b><br>${esc(input.company.address)}</div>
    <h3>BERITA ACARA PEMBLOKIRAN SECARA SERTA MERTA</h3>
    <p>Yang bertandatangan di bawah ini:</p>
    <table class="isi"><tr><td>Nama</td><td>: ${esc(input.signer.name)}</td></tr><tr><td>Jabatan</td><td>: ${esc(input.signer.position)}</td></tr><tr><td>Alamat</td><td>: ${esc(input.company.address)}</td></tr></table>
    <p>dalam hal ini bertindak untuk dan atas nama ${esc(input.company.legalName)}, dengan ini menyatakan bahwa pada hari ini
    ${esc(longDayDate(input.blockedAt))}, pukul ${esc(clockWib(input.blockedAt))} telah melakukan pemblokiran secara serta merta
    berdasarkan surat permintaan Bank Indonesia ${esc(input.biLetter)} atas DTTOT Nomor ${esc(input.listNumber)} di hadapan saksi:</p>
    <table class="isi"><tr><td>Nama</td><td>: ${esc(input.witness.name)}</td></tr><tr><td>Jabatan</td><td>: ${esc(input.witness.position)}</td></tr></table>
    <p>terhadap rekening/aset/Dana yang dimiliki atau dikuasai oleh Pengguna Jasa sebagai berikut:</p>
    <table class="isi"><tr><td>Nama</td><td>: ${esc(row.fullName)}</td></tr><tr><td>Tempat, Tanggal Lahir</td><td>: ${esc(row.placeOfBirth)}, ${esc(birthDate(row.dateOfBirth))}</td></tr>
    <tr><td>Pekerjaan</td><td>: ${esc(row.occupation)}</td></tr><tr><td>Alamat</td><td>: ${esc(row.address)}</td></tr>
    <tr><td>Nomor rekening</td><td>: — (KUPVA tidak memegang rekening nasabah)</td></tr><tr><td>Saldo Terakhir/Nilai Aset</td><td>: —</td></tr>
    <tr><td>Jenis dan identitas aset</td><td>: Seluruh transaksi penukaran valuta asing atas nama Pengguna Jasa ditolak</td></tr></table>
    <p>Demikian Berita Acara ini dibuat rangkap 1 (satu) dan dibuatkan 1 (satu) salinan.</p>
    <div class="dua"><div>Yang melakukan<br>Pemblokiran secara serta merta,<div class="ruang"></div><b>${esc(input.signer.name)}</b><br>${esc(input.signer.position)}</div>
    <div>Saksi:<div class="ruang"></div><b>${esc(input.witness.name)}</b><br>${esc(input.witness.position)}</div></div></div>`).join("");
  return cover + minutes;
}

const STYLE = `@page { size: A4; margin: 20mm 22mm; } body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; max-width: 180mm; margin: 0 auto; }
  .kop { border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 18px; } table.kepala { width: 100%; } table.kepala td { padding: 0 8px 0 0; vertical-align: top; white-space: nowrap; } td.r { text-align: right; width: 100%; }
  p { text-align: justify; } table.isi td { padding: 1px 6px 1px 0; vertical-align: top; } table.isi td:first-child { width: 180px; }
  .ttd { margin: 28px 0 0 auto; width: 260px; text-align: center; } .ruang { height: 70px; } h3 { text-align: center; }
  .halaman { page-break-before: always; } .dua { display: flex; justify-content: space-between; margin-top: 28px; } .dua > div { width: 45%; }`;

/** Membuka jendela cetak; `body` dibangun oleh salah satu pembangun di atas. */
export function printDttotReport(title: string, body: string) {
  const win = window.open("", "_blank");
  if (!win) return toast.error("Izinkan pop-up browser untuk mencetak atau menyimpan laporan sebagai PDF.");
  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}<script>window.print()</script></body></html>`);
  win.document.close();
}
