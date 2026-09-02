/**
 * SIPESAT (Sistem Informasi Pengguna Jasa Terpadu, PPATK) CSV export — builds the file exactly as
 * specified in the PPATK "Buku Petunjuk Penggunaan Aplikasi SIPESAT Online v.3.1" (file naming) and
 * the PPATK-published sample data (column header/order). This module only builds a file for manual
 * upload at https://sipesat.ppatk.go.id — it never submits anything itself (per project policy, no
 * automatic regulator submission without verified credentials/authorization).
 *
 * KNOWN GAP: `customers` in this system has no dedicated corporate-customer type or NPWP field, so
 * "No.NPWP" is always left blank here even for corporate customers (e.g. "PT ..." names) — this is a
 * real limitation, not an oversight, and is surfaced in the UI/docs rather than silently guessed at.
 */

export const SIPESAT_CSV_HEADER = ["IDPJK", "Kode Nasabah", "Nama Nasabah", "Tempat Lahir", "Tanggal Lahir", "Alamat", "No.KTP", "No.Identitas Lain", "No.CIF", "No.NPWP"] as const;

export type SipesatCustomerRow = {
  id: number;
  fullName: string;
  placeOfBirth: string | null;
  dateOfBirth: string | Date | null;
  address: string;
  identityType: "KTP" | "PASSPORT" | "OTHER";
  identityNumber: string;
  cifNumber: string;
};

function csvField(value: string) {
  // Pipe-delimited per the PPATK sample — a literal pipe in source data would break columns, so strip it defensively (KTP/name/address fields never legitimately contain one).
  return value.replace(/\|/g, " ").replace(/[\r\n]+/g, " ").trim();
}

function formatBirthDate(value: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getUTCFullYear()}`;
}

export function buildSipesatCsv(idPjk: string, customers: SipesatCustomerRow[]) {
  const lines = [SIPESAT_CSV_HEADER.join("|")];
  for (const customer of customers) {
    lines.push([
      csvField(idPjk),
      String(customer.id),
      csvField(customer.fullName),
      csvField(customer.placeOfBirth ?? ""),
      formatBirthDate(customer.dateOfBirth),
      csvField(customer.address),
      customer.identityType === "KTP" ? csvField(customer.identityNumber) : "",
      customer.identityType !== "KTP" ? csvField(customer.identityNumber) : "",
      csvField(customer.cifNumber),
      "", // No.NPWP — not tracked per-customer yet, see module doc comment.
    ].join("|"));
  }
  return lines.join("\r\n") + "\r\n";
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/** File naming per the SIPESAT user manual: SIPESAT_IDPJK_IN_DDMMYYYY_NO.csv for initial data. */
export function buildSipesatInitialFileName(idPjk: string, uploadDate: Date, fileNumber = 1) {
  const dd = pad2(uploadDate.getDate());
  const mm = pad2(uploadDate.getMonth() + 1);
  return `SIPESAT_${idPjk}_IN_${dd}${mm}${uploadDate.getFullYear()}_${fileNumber}.csv`;
}

/** File naming per the SIPESAT user manual: SIPESAT_IDPJK_TW_XYYYY_DDMMYYYY_NO.csv for quarterly data, X = 1-4. */
export function buildSipesatTriwulanFileName(idPjk: string, triwulan: 1 | 2 | 3 | 4, tahun: number, uploadDate: Date, fileNumber = 1) {
  const dd = pad2(uploadDate.getDate());
  const mm = pad2(uploadDate.getMonth() + 1);
  return `SIPESAT_${idPjk}_TW_${triwulan}${tahun}_${dd}${mm}${uploadDate.getFullYear()}_${fileNumber}.csv`;
}
