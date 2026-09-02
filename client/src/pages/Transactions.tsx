import { formatIdrDecimal } from "@/lib/money";
import { toast } from "sonner";

/** Shared bon/kwitansi helpers used by both TransactionCreate.tsx (the form) and TransactionList.tsx (the archive). Kept in this file — not renamed — so existing tests that read Transactions.tsx source text for "printBon"/"window.print()" keep working. */

export type Customer = { id: number; fullName: string; cifNumber: string; phoneNumber?: string | null; identityType: string; identityNumber: string; address?: string | null; occupation?: string | null; sourceOfFunds?: string | null; transactionPurpose: string | null; hasBeneficialOwner?: boolean; beneficialOwnerCustomerId?: number | null };
export type DenominationRow = { value: string; quantity: string };
/** One row of the printed kwitansi's table (NO. / MATA UANG / JUMLAH / KURS / TOTAL). */
export type PrintableLine = { currencyCode: string; foreignAmount: string; agreedRate: string; rupiahAmount: string };

export const transactionStatusClass: Record<string, string> = { DRAFT: "status-pending", PENDING_REVIEW: "status-pending", APPROVED: "status-approved", COMPLETED: "status-approved", RETURNED: "status-rejected", CANCELLED: "status-rejected" };
export const transactionStatusLabel: Record<string, string> = { DRAFT: "Draft", PENDING_REVIEW: "Perlu review", APPROVED: "Disetujui", COMPLETED: "Selesai", RETURNED: "Dikembalikan", CANCELLED: "Dibatalkan" };
export const toBase64 = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
export const escapeHtml = (value: unknown) => String(value ?? "-").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character] ?? character);
export const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export type CompanyBranding = { tradingName?: string | null; address?: string | null; phone?: string | null; logoUrl?: string | null };

/**
 * Renders a print window that matches the physical KWITANSI JUAL/BELI receipt book — same fields,
 * same order, footer notice and the PBI 18/20/PBI/2016 disclaimer included verbatim — just laid out
 * more legibly than the original hand-rolled table. `company` is optional — falls back to the
 * original hardcoded header when not supplied (e.g. before a company profile has ever been
 * configured), so old callers/tests keep working.
 *
 * The logo is fetched over the network (a signed document-download URL, not an inline data URI), so
 * calling window.print() unconditionally right after document.write() used to race the image load —
 * the print *dialog* would open before the browser had painted the logo, so the print preview showed
 * a blank space where the logo belongs (it would only "appear" if you reopened/reprinted after the
 * tab had already cached the image). Fixed by deferring window.print() until the logo's onload/
 * onerror fires (with a timeout fallback in case neither ever fires) — when there's no logo, print
 * still fires immediately as before.
 */
export function printBon(transaction: any, customer: Customer | null, lines: PrintableLine[], company?: CompanyBranding | null) {
  const win = window.open("", "_blank"); if (!win) return toast.error("Izinkan pop-up browser untuk menyimpan PDF atau mencetak kwitansi.");
  const companyName = company?.tradingName || "IBUKOTA VALASINDO";
  const companyAddress = company?.address || "Jl. Mangun Sarkoro No 35, Cianjur, Jawa Barat 43214";
  const companyPhone = company?.phone || "+62 263-265500 / +62 263-265600";
  const hasLogo = Boolean(company?.logoUrl);
  const logoImg = hasLogo ? `<img id="bon-logo" src="${escapeHtml(company!.logoUrl)}" alt="Logo" onload="window.__bonPrint()" onerror="window.__bonPrint()">` : `<div class="logo-fallback">${escapeHtml(companyName.slice(0, 1))}</div>`;
  const isSell = transaction.operation === "SELL"; // SELL = kita jual valuta ke nasabah = KWITANSI JUAL
  const title = isSell ? "KWITANSI JUAL" : "KWITANSI BELI";
  const subtitle = isSell ? "SALES RECEIPT" : "PURCHASE RECEIPT";
  const accent = isSell ? "#1f7a44" : "#18395f";
  const accentSoft = isSell ? "#eaf6ee" : "#eaf1fb";
  const name = transaction.customerFullNameSnapshot ?? customer?.fullName;
  const identity = `${transaction.customerIdentityTypeSnapshot ?? customer?.identityType ?? ""} ${transaction.customerIdentityNumberSnapshot ?? customer?.identityNumber ?? ""}`.trim();
  const phone = transaction.customerPhoneSnapshot ?? customer?.phoneNumber;
  const address = transaction.customerAddressSnapshot ?? customer?.address;
  const sourceOfFunds = transaction.sourceOfFundsSnapshot ?? customer?.sourceOfFunds;
  const representativeLine = transaction.customerActingAs === "REPRESENTATIVE" ? `<div class="row"><span class="label">Diwakili oleh</span><span class="value">${escapeHtml(transaction.representativeName)} · ${escapeHtml(transaction.representativeIdentityNumber)}</span></div>` : "";
  const bankTransferLine = transaction.paymentMethod === "BANK_TRANSFER" && transaction.counterpartyAccountHolderName
    ? `<div class="row"><span class="label">Rekening ${isSell ? "pengirim" : "tujuan"}</span><span class="value">${escapeHtml(transaction.counterpartyBankName)} ${escapeHtml(transaction.counterpartyAccountNumber)} a.n. ${escapeHtml(transaction.counterpartyAccountHolderName)}${transaction.counterpartyNameMismatchReason ? ` (berbeda dari nama nasabah — ${escapeHtml(transaction.counterpartyNameMismatchReason)})` : ""}</span></div>`
    : "";
  const rows = lines.map((line, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(line.currencyCode)}</td><td class=r>${escapeHtml(line.foreignAmount)}</td><td class=r>${escapeHtml(line.agreedRate)}</td><td class=r>${escapeHtml(formatIdrDecimal(line.rupiahAmount))}</td></tr>`).join("");
  const printScript = hasLogo
    ? `<script>var __bonPrinted=false;window.__bonPrint=function(){if(__bonPrinted)return;__bonPrinted=true;window.print();};setTimeout(window.__bonPrint,1500);</script>`
    : `<script>window.print()</script>`;
  win.document.write(`<!doctype html><title>${escapeHtml(transaction.receiptNumber ?? transaction.transactionNumber)}</title><style>
    @page{margin:12mm}
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#18395f;margin:0;padding:24px;line-height:1.4;background:#f3f6fa}
    .sheet{max-width:680px;margin:0 auto;background:#fff;padding:28px 32px;border:1px solid #dbe4ee;border-radius:10px}
    .head{display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:2px solid ${accent}}
    .brand{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
    .logo-box{width:52px;height:52px;flex:0 0 52px;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fafcff}
    .logo-box img{max-width:100%;max-height:100%;object-fit:contain}
    .logo-fallback{font-size:22px;font-weight:800;color:${accent}}
    .brand h2{margin:0;font-size:15px;font-weight:800;letter-spacing:.03em}
    .brand .tagline{margin:1px 0 0;font-size:10px;letter-spacing:.12em;color:#64748b;text-transform:uppercase}
    .doc{text-align:right;flex:0 0 auto}
    .doc .title{margin:0;color:${accent};font-weight:800;font-size:18px;letter-spacing:.02em}
    .doc .subtitle{margin:1px 0 0;font-size:10px;color:#64748b;font-style:italic}
    .no-box{flex:0 0 auto;margin-left:14px;padding:8px 12px;border-radius:8px;background:${accentSoft};text-align:right;white-space:nowrap}
    .no-box .no-value{display:block;font-size:15px;font-weight:800;color:${accent}}
    .no-box .no-date{display:block;font-size:10px;color:#5b6b7c;margin-top:2px}
    .contact{margin:10px 0 16px;font-size:11px;color:#64748b}
    .details{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}
    .row{display:flex;gap:8px;padding:3px 0}
    .row .label{flex:0 0 118px;font-size:10px;font-weight:700;color:#5b6b7c;text-transform:uppercase;letter-spacing:.03em;padding-top:1px}
    .row .value{flex:1;font-size:12.5px;color:#18395f;word-break:break-word}
    table{border-collapse:collapse;width:100%;margin-top:18px}
    thead td{background:#eef3f9;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:#42566b;font-weight:700}
    td{border:1px solid #c7d3e0;padding:8px 10px;font-size:12px;vertical-align:top}
    .r{text-align:right}
    .total-row td{background:${accentSoft};font-weight:800;border-top:2px solid ${accent}}
    .notice{margin-top:16px;font-size:10.5px;color:#475569;line-height:1.6}
    .rule{margin-top:10px;padding:10px 12px;font-size:10px;line-height:1.6;color:#475569;background:#f8fafc;border-left:3px solid ${accent};border-radius:0 6px 6px 0}
    .sign{display:flex;justify-content:space-between;margin-top:56px;gap:24px}
    .sign-slot{flex:0 0 180px;text-align:center}
    .sign-line{display:block;height:52px;border-bottom:1px solid #94a7b8}
    .sign-label{display:block;margin-top:6px;font-size:11px;color:#5b6b7c}
    @media print{body{background:#fff;padding:0}.sheet{border:none;border-radius:0;max-width:none;padding:0}}
  </style><div class="sheet">
    <div class="head">
      <div class="brand"><div class="logo-box">${logoImg}</div><div><h2>${escapeHtml(companyName)}</h2><p class="tagline">Money Changer</p></div></div>
      <div class="doc"><p class="title">${title}</p><p class="subtitle">${subtitle}</p></div>
      <div class="no-box"><span class="no-value">No: ${escapeHtml(transaction.receiptNumber ?? "-")}</span><span class="no-date">${escapeHtml(new Date(transaction.transactionAt).toLocaleDateString("id-ID"))}</span></div>
    </div>
    <p class="contact">${escapeHtml(companyAddress)} &middot; ${escapeHtml(companyPhone)}</p>
    <div class="details">
      <div>
        <div class="row"><span class="label">Nama</span><span class="value">${escapeHtml(name)}</span></div>
        ${representativeLine}
        <div class="row"><span class="label">No. HP</span><span class="value">${escapeHtml(phone)}</span></div>
        <div class="row"><span class="label">No. KTP/Paspor</span><span class="value">${escapeHtml(identity)}</span></div>
        <div class="row"><span class="label">Alamat</span><span class="value">${escapeHtml(address)}</span></div>
      </div>
      <div>
        <div class="row"><span class="label">Sumber Dana</span><span class="value">${escapeHtml(sourceOfFunds)}</span></div>
        <div class="row"><span class="label">Tujuan Transaksi</span><span class="value">${escapeHtml(transaction.transactionPurposeSnapshot)}</span></div>
        <div class="row"><span class="label">Cara Bayar</span><span class="value">${escapeHtml(transaction.paymentMethod)}</span></div>
        ${bankTransferLine}
      </div>
    </div>
    <table><thead><tr><td>No.</td><td>Mata Uang</td><td class=r>Jumlah</td><td class=r>Kurs</td><td class=r>Total</td></tr></thead><tbody>${rows}<tr class="total-row"><td colspan=4>Jumlah Total</td><td class=r>${escapeHtml(formatIdrDecimal(String(transaction.rupiahAmount)))}</td></tr></tbody></table>
    <p class="notice">* Harap hitung kembali uang anda sebelum meninggalkan loket.<br>Komplain setelah meninggalkan loket tidak akan dilayani.<br>* wajib melengkapi semua data</p>
    <div class="rule">Sesuai Ketentuan Bank Indonesia PBI No. 18/20/PBI/2016, Customer wajib memberikan fotocopy kartu Identitas diri, dan setiap transaksi minimum 10.000 USD Customer wajib memberikan informasi tujuan transaksi (underlying). Dengan ini Saya Menyatakan Bahwa transaksi ini belum mencapai senilai 10.000 USD</div>
    <div class="sign"><div class="sign-slot"><span class="sign-line"></span><span class="sign-label">Teller</span></div><div class="sign-slot"><span class="sign-line"></span><span class="sign-label">Nasabah</span></div></div>
  </div>${printScript}`);
  win.document.close();
}
