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

/** "15 Oktober 2026". */
export function longDate(at: Date): string {
  return at.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: ZONE });
}

const birthDate = (value: DttotMatchedCustomer["dateOfBirth"]) => (value ? longDate(new Date(value)) : "—");

export type DttotNoticeKind = "PENCANTUMAN" | "PERPANJANGAN" | "PENGHAPUSAN";
/** Surat Densus 88 yang dirujuk di kalimat pembuka. `date` = tanggal surat (bukan tanggal surel BI), boleh kosong. */
export type DttotPoliceLetter = { number: string; date?: Date | null; kind: DttotNoticeKind };

/** Perihal surat Densus menurut jenisnya, seperti tertulis di surat-surat yang pernah diterima. */
export function policeLetterSubject(kind: DttotNoticeKind): string {
  return kind === "PENGHAPUSAN"
    ? "Pemberitahuan Penghapusan Identitas Orang dan Entitas dari Daftar Terduga Teroris dan Organisasi Teroris dan Permohonan Buka Blokir"
    : "Bantuan untuk Melakukan Pemblokiran terhadap Dana yang Dimiliki oleh Terduga Teroris dan Organisasi Teroris";
}

const policeReference = (letter: DttotPoliceLetter) =>
  `Kepala Kepolisian Negara Republik Indonesia No. ${esc(letter.number)}${letter.date ? ` tanggal ${esc(longDate(letter.date))}` : ""} perihal ${esc(policeLetterSubject(letter.kind))}`;

// Alamat dan tembusan mengikuti surat yang sudah pernah diterima Densus (Laporan Nihil 20 April 2026).
const recipient = `<p>Kepada Yth.<br>Kepala Kepolisian Negara Republik Indonesia<br>c.q. Kepala Densus 88 Kepolisian Negara Republik Indonesia<br>Jalan Trunojoyo No. 3, Kebayoran Baru<br>Jakarta 12110</p><p>Dengan hormat,</p>`;

const copies = `<div class="tembusan">Tembusan Yth.:<ol><li>Kepala Kantor Perwakilan Bank Indonesia yang mewilayahi</li><li>Kepala Pusat Pelaporan dan Analisis Transaksi Keuangan (PPATK)</li></ol></div>`;

type LetterInput = { company: DttotReportCompany; reportNumber: string; place: string; reportDate: Date; signer: DttotReportSigner; police: DttotPoliceLetter };

const letterHead = (input: LetterInput, subject: string, attachment: string) => `
  <div class="kop"><b>${esc(input.company.legalName)}</b><br>${esc(input.company.address)}</div>
  <p class="r">${esc(input.place)}, ${esc(longDate(input.reportDate))}</p>
  <table class="kepala"><tr><td>Nomor</td><td>: ${esc(input.reportNumber)}</td></tr>
  <tr><td>Lamp</td><td>: ${esc(attachment)}</td></tr>
  <tr><td>Perihal</td><td>: <u>${esc(subject)}</u></td></tr></table>
  ${recipient}`;

const signature = (company: DttotReportCompany, signer: DttotReportSigner) =>
  `<div class="ttd"><div>Hormat kami,</div><div>${esc(company.legalName)}</div><div class="ruang"></div><div><b><u>${esc(signer.name)}</u></b></div><div>${esc(signer.position)}</div></div>`;

const closing = (input: LetterInput) => `<p>Demikian kami sampaikan, atas perhatiannya kami ucapkan terima kasih.</p>
  ${signature(input.company, input.signer)}${copies}`;

const asOf = (at: Date) => `${esc(longDayDate(at))} pukul ${esc(clockWib(at))}`;

/** Lampiran III — Laporan Nihil atas Pemblokiran Secara Serta Merta (pencantuman/perpanjangan). */
export function buildLaporanNihilHtml(input: LetterInput & { screenedAt: Date }): string {
  return `${letterHead(input, "Laporan Nihil atas Pemblokiran/Penolakan Transaksi Secara Serta Merta", "—")}
  <p>Merujuk Surat ${policeReference(input.police)}, dengan ini kami laporkan bahwa sampai dengan ${asOf(input.screenedAt)} tidak
  terdapat kesesuaian identitas orang atau korporasi yang terdapat dalam <i>database</i> dengan identitas orang atau korporasi
  yang tercantum dalam Daftar Terduga Teroris dan Organisasi Teroris di penyelenggara atau NIHIL.</p>
  ${closing(input)}`;
}

/** Laporan atas pemberitahuan penghapusan bila tidak ada blokir yang perlu dibuka. */
export function buildLaporanPenghapusanNihilHtml(input: LetterInput & { screenedAt: Date }): string {
  return `${letterHead(input, "Laporan atas Penghapusan Identitas dari Daftar Terduga Teroris dan Organisasi Teroris", "—")}
  <p>Merujuk Surat ${policeReference(input.police)}, dengan ini kami laporkan bahwa sampai dengan ${asOf(input.screenedAt)} tidak
  terdapat rekening, aset, atau dana yang kami blokir atas nama orang atau korporasi yang dihapus dari Daftar Terduga Teroris
  dan Organisasi Teroris, sehingga tidak ada pemblokiran yang perlu dibuka (NIHIL).</p>
  ${closing(input)}`;
}

/** Lampiran II (Laporan Pemblokiran) + Lampiran I (Berita Acara) satu halaman per nasabah yang cocok. */
export function buildLaporanPemblokiranHtml(input: LetterInput & { blockedAt: Date; witness: DttotReportSigner; listNumber: string; matched: DttotMatchedCustomer[] }): string {
  const names = input.matched.map((row) => row.fullName).join(", ");
  const cover = `${letterHead(input, "Laporan Pemblokiran Secara Serta Merta", `${input.matched.length} berkas berita acara`)}
  <p>Merujuk Surat ${policeReference(input.police)}, dan menunjuk Pasal 28 ayat (3) Undang-Undang Nomor 9 Tahun 2013 tentang
  Pencegahan dan Pemberantasan Tindak Pidana Pendanaan Terorisme, dengan ini kami laporkan bahwa pada hari ${asOf(input.blockedAt)}
  telah dilakukan pemblokiran secara serta merta seluruh rekening atau aset/dana atas nama ${esc(names)}, sebagaimana berita
  acara terlampir.</p>
  ${closing(input)}`;
  const minutes = input.matched.map((row) => `<div class="halaman">
    <div class="kop"><b>${esc(input.company.legalName)}</b><br>${esc(input.company.address)}</div>
    <h3>BERITA ACARA PEMBLOKIRAN SECARA SERTA MERTA</h3>
    <p>Yang bertandatangan di bawah ini:</p>
    <table class="isi"><tr><td>Nama</td><td>: ${esc(input.signer.name)}</td></tr><tr><td>Jabatan</td><td>: ${esc(input.signer.position)}</td></tr><tr><td>Alamat</td><td>: ${esc(input.company.address)}</td></tr></table>
    <p>dalam hal ini bertindak untuk dan atas nama ${esc(input.company.legalName)}, dengan ini menyatakan bahwa pada hari ini
    ${asOf(input.blockedAt)} telah melakukan pemblokiran secara serta merta berdasarkan Surat ${policeReference(input.police)}
    atas DTTOT Nomor ${esc(input.listNumber)} di hadapan saksi:</p>
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

/** Kota untuk kepala surat bila belum pernah diisi: bagian terakhir alamat perusahaan ("… Solokpandan. Cianjur" → "Cianjur"). */
export function placeFromAddress(address: string): string {
  const last = address.split(/[.,\n]/).map((part) => part.trim()).filter(Boolean).pop() ?? "";
  return last.replace(/\s*\d{5}$/, "").replace(/^(kota|kab\.?|kabupaten)\s+/i, "");
}

const STYLE = `@page { size: A4; margin: 20mm 22mm; } body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; max-width: 180mm; margin: 0 auto; }
  .kop { border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 18px; } table.kepala td { padding: 0 8px 0 0; vertical-align: top; } table.kepala td:first-child { white-space: nowrap; } p.r { text-align: right; }
  p { text-align: left; overflow-wrap: anywhere; } table.isi td { padding: 1px 6px 1px 0; vertical-align: top; } table.isi td:first-child { width: 180px; }
  .ttd { margin: 28px 0 0 auto; width: 260px; text-align: center; } .ruang { height: 70px; } h3 { text-align: center; } .tembusan { margin-top: 28px; font-size: 11pt; } .tembusan ol { margin: 2px 0 0 18px; padding: 0; }
  .halaman { page-break-before: always; } .dua { display: flex; justify-content: space-between; margin-top: 28px; } .dua > div { width: 45%; }`;

/** Membuka jendela cetak; `body` dibangun oleh salah satu pembangun di atas. */
export function printDttotReport(title: string, body: string) {
  const win = window.open("", "_blank");
  if (!win) return toast.error("Izinkan pop-up browser untuk mencetak atau menyimpan laporan sebagai PDF.");
  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}<script>window.print()</script></body></html>`);
  win.document.close();
}
