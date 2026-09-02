import * as XLSX from "xlsx";
import { splitAliasNames } from "../shared/sanctionsNameMatch";

/**
 * Parses PPATK/DK PBB public sanctions-list workbooks (DTTOT, PPPSM) into normalized entries ready
 * for `sanctions_watchlist_entries`. Two known shapes, auto-detected from the header row rather than
 * assumed from the file name (file names are just opaque export timestamps):
 *
 *  - DTTOT: one sheet, mixed Orang/Korporasi, columns Nama/Deskripsi/Terduga/Kode Densus/
 *    Tempat Lahir/Tanggal Lahir/WN atau Asal Negara/Alamat. Entity type comes from the "Terduga"
 *    column per row. Aliases aren't a separate column — they're embedded in the name field itself
 *    ("X alias Y alias Z"), so they're split out of `fullName` with `splitAliasNames`.
 *  - PPPSM: two sheets per country/regime sub-list (Orang = individuals, Entitas = corporate/other),
 *    columns Referensi/Nama/[Gelar/Pekerjaan for Orang]/Tanggal Lahir/Tempat Lahir/"Alias N" columns
 *    (variable count)/Kewarganegaraan/Nomor Paspor/Nomor Identitas/"Alamat"[" N"] (variable
 *    count)/Informasi Lain. The very first data row is a section-title marker ("ORANG ATAU
 *    INDIVIDUAL" / "KORPORASI ATAU ENTITAS") that must be skipped, not imported as a record.
 *    `sourceLabel` (e.g. "DPRK", "IR") is derived from the alpha prefix of `Referensi` codes
 *    (DPRKi.001 / IRe.003, ...) so each country/regime sub-list can be re-imported independently
 *    without wiping the others — PPPSM is a family of lists, not one file.
 *
 * A workbook that matches neither shape, or whose PPPSM reference-code prefixes are inconsistent
 * across rows, is rejected with a specific error rather than guessed at.
 */

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export type ParsedSanctionsEntry = {
  entityType: "INDIVIDUAL" | "ENTITY";
  referenceCode: string | null;
  fullName: string;
  aliases: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  identityNumbers: string | null;
  address: string | null;
  description: string | null;
};

export type ParsedSanctionsWorkbook = {
  listType: "DTTOT" | "PPPSM";
  sourceLabel: string | null;
  entries: ParsedSanctionsEntry[];
};

const SECTION_MARKERS = new Set(["ORANG ATAU INDIVIDUAL", "KORPORASI ATAU ENTITAS"]);

function cleanValue(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || text.toUpperCase() === "NA") return null;
  return text;
}

function cleanFileName(value: string) {
  const cleaned = value.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 180);
  return cleaned || "daftar-watchlist";
}

function decodeBase64(value: string) {
  const encoded = value.replace(/^data:[^;]+;base64,/, "").trim();
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Berkas impor tidak valid.");
  const data = Buffer.from(encoded, "base64");
  if (!data.length || data.length > MAX_IMPORT_BYTES) throw new Error("Ukuran berkas impor harus antara 1 byte dan 5 MB.");
  return data;
}

function assertSpreadsheetSignature(data: Buffer) {
  const isXlsxZip = data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && (data[2] === 0x03 || data[2] === 0x05 || data[2] === 0x07) && (data[3] === 0x04 || data[3] === 0x06 || data[3] === 0x08);
  const isLegacyXls = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (!isXlsxZip && !isLegacyXls) throw new Error("Berkas impor harus merupakan workbook XLSX atau XLS yang valid.");
}

function headerIndex(header: string[], name: string) {
  const index = header.findIndex((cell) => cell.trim().toLowerCase() === name.toLowerCase());
  return index === -1 ? null : index;
}

function multiColumnIndices(header: string[], prefix: string) {
  return header.map((cell, index) => ({ cell: cell.trim().toLowerCase(), index })).filter(({ cell }) => cell.startsWith(prefix.toLowerCase())).map(({ index }) => index);
}

function joinNonEmpty(values: (string | null)[]) {
  const filtered = values.filter((value): value is string => Boolean(value));
  return filtered.length ? filtered.join("\n") : null;
}

function parseDttotSheet(rows: unknown[][]): ParsedSanctionsEntry[] {
  const header = rows[0].map((cell) => String(cell ?? ""));
  const nameIndex = headerIndex(header, "Nama");
  const descriptionIndex = headerIndex(header, "Deskripsi");
  const typeIndex = headerIndex(header, "Terduga");
  const referenceIndex = headerIndex(header, "Kode Densus");
  const placeOfBirthIndex = headerIndex(header, "Tempat Lahir");
  const dateOfBirthIndex = headerIndex(header, "Tanggal Lahir");
  const nationalityIndex = headerIndex(header, "WN/Asal Negara") ?? headerIndex(header, "WN atau Asal Negara");
  const addressIndex = headerIndex(header, "Alamat");
  if (nameIndex === null || typeIndex === null || referenceIndex === null) throw new Error("Struktur berkas DTTOT tidak dikenali — kolom Nama/Terduga/Kode Densus wajib ada.");

  const entries: ParsedSanctionsEntry[] = [];
  for (const row of rows.slice(1)) {
    const rawName = cleanValue(row[nameIndex]);
    if (!rawName) continue;
    const [fullName, ...aliasNames] = splitAliasNames(rawName);
    const typeValue = cleanValue(row[typeIndex])?.toUpperCase() ?? "";
    entries.push({
      entityType: typeValue.startsWith("KORPORASI") ? "ENTITY" : "INDIVIDUAL",
      referenceCode: cleanValue(row[referenceIndex]),
      fullName,
      aliases: aliasNames.length ? aliasNames.join("\n") : null,
      dateOfBirth: dateOfBirthIndex !== null ? cleanValue(row[dateOfBirthIndex]) : null,
      placeOfBirth: placeOfBirthIndex !== null ? cleanValue(row[placeOfBirthIndex]) : null,
      nationality: nationalityIndex !== null ? cleanValue(row[nationalityIndex]) : null,
      identityNumbers: null,
      address: addressIndex !== null ? cleanValue(row[addressIndex]) : null,
      description: descriptionIndex !== null ? cleanValue(row[descriptionIndex]) : null,
    });
  }
  return entries;
}

function parsePppsmSheet(rows: unknown[][], entityType: "INDIVIDUAL" | "ENTITY"): ParsedSanctionsEntry[] {
  const header = rows[0].map((cell) => String(cell ?? ""));
  const referenceIndex = headerIndex(header, "Referensi");
  const nameIndex = headerIndex(header, "Nama");
  const dateOfBirthIndex = headerIndex(header, "Tanggal Lahir");
  const placeOfBirthIndex = headerIndex(header, "Tempat Lahir");
  const nationalityIndex = headerIndex(header, "Kewarganegaraan");
  const passportIndex = headerIndex(header, "Nomor Paspor");
  const identityIndex = headerIndex(header, "Nomor Identitas");
  const infoIndex = headerIndex(header, "Informasi Lain");
  const aliasIndices = multiColumnIndices(header, "Alias");
  const addressIndices = multiColumnIndices(header, "Alamat");
  if (referenceIndex === null || nameIndex === null) throw new Error("Struktur berkas PPPSM tidak dikenali — kolom Referensi/Nama wajib ada.");

  const entries: ParsedSanctionsEntry[] = [];
  for (const row of rows.slice(1)) {
    const referenceCode = cleanValue(row[referenceIndex]);
    const fullName = cleanValue(row[nameIndex]);
    if (!referenceCode && !fullName) continue;
    if (!fullName && referenceCode && SECTION_MARKERS.has(referenceCode.toUpperCase())) continue;
    if (!fullName) continue;
    const aliases = joinNonEmpty(aliasIndices.map((index) => cleanValue(row[index])));
    const address = joinNonEmpty(addressIndices.map((index) => cleanValue(row[index])));
    const identityNumbers = joinNonEmpty([
      passportIndex !== null ? (cleanValue(row[passportIndex]) ? `Paspor: ${cleanValue(row[passportIndex])}` : null) : null,
      identityIndex !== null ? (cleanValue(row[identityIndex]) ? `Identitas: ${cleanValue(row[identityIndex])}` : null) : null,
    ]);
    entries.push({
      entityType,
      referenceCode,
      fullName,
      aliases,
      dateOfBirth: dateOfBirthIndex !== null ? cleanValue(row[dateOfBirthIndex]) : null,
      placeOfBirth: placeOfBirthIndex !== null ? cleanValue(row[placeOfBirthIndex]) : null,
      nationality: nationalityIndex !== null ? cleanValue(row[nationalityIndex]) : null,
      identityNumbers,
      address,
      description: infoIndex !== null ? cleanValue(row[infoIndex]) : null,
    });
  }
  return entries;
}

function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }).filter((row) => row.some((cell) => cleanValue(cell) !== null));
}

/** Extracts the alpha prefix shared by every PPPSM reference code in a sheet (e.g. "DPRKi.001"/"DPRKe.002" → "DPRK"), or throws if the sheet mixes codes from more than one sub-list. */
function commonReferencePrefix(entries: ParsedSanctionsEntry[]): string {
  const prefixes = new Set<string>();
  for (const entry of entries) {
    if (!entry.referenceCode) continue;
    const match = entry.referenceCode.match(/^([A-Za-z]+)[ie]\./);
    if (match) prefixes.add(match[1].toUpperCase());
  }
  if (prefixes.size !== 1) throw new Error(`Berkas PPPSM harus berisi satu sumber daftar per unggahan (ditemukan ${prefixes.size} pola kode referensi berbeda) — pisahkan per sumber sebelum mengimpor.`);
  return Array.from(prefixes)[0];
}

export function parseSanctionsWatchlistWorkbook(data: Buffer): ParsedSanctionsWorkbook {
  assertSpreadsheetSignature(data);
  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(data, { type: "buffer", raw: false }); } catch { throw new Error("Berkas spreadsheet tidak dapat dibaca."); }
  const sheets = workbook.SheetNames.map((name) => ({ name, rows: sheetRows(workbook.Sheets[name]) })).filter((sheet) => sheet.rows.length > 0);
  if (!sheets.length) throw new Error("Berkas tidak berisi data yang dapat dibaca.");

  const firstHeader = sheets[0].rows[0].map((cell) => String(cell ?? "").trim());
  const isDttot = firstHeader.some((cell) => cell === "Kode Densus") && firstHeader.some((cell) => cell === "Terduga");
  if (isDttot) {
    if (sheets.length > 1) throw new Error("Berkas DTTOT seharusnya hanya memiliki satu lembar data.");
    return { listType: "DTTOT", sourceLabel: null, entries: parseDttotSheet(sheets[0].rows) };
  }

  const isPppsm = firstHeader.some((cell) => cell === "Referensi") && firstHeader.some((cell) => cell === "Nama");
  if (!isPppsm) throw new Error("Struktur berkas tidak dikenali sebagai daftar DTTOT maupun PPPSM. Periksa apakah berkas ini sesuai format resmi PPATK/DK PBB.");

  const entries: ParsedSanctionsEntry[] = [];
  for (const sheet of sheets) {
    const header = sheet.rows[0].map((cell) => String(cell ?? "").trim());
    const isIndividualSheet = header.some((cell) => cell === "Gelar" || cell === "Pekerjaan");
    entries.push(...parsePppsmSheet(sheet.rows, isIndividualSheet ? "INDIVIDUAL" : "ENTITY"));
  }
  if (!entries.length) throw new Error("Berkas PPPSM tidak berisi baris data yang dapat diimpor.");
  const sourceLabel = commonReferencePrefix(entries);
  return { listType: "PPPSM", sourceLabel, entries };
}

export function decodeSanctionsWatchlistUpload(input: { dataBase64: string; mimeType: string; byteSize: number }) {
  if (!ACCEPTED_MIME_TYPES.has(input.mimeType)) throw new Error("Format impor harus XLSX atau XLS.");
  const data = decodeBase64(input.dataBase64);
  if (data.byteLength !== input.byteSize) throw new Error("Ukuran berkas impor tidak konsisten.");
  return data;
}

export { cleanFileName as cleanSanctionsWatchlistFileName };
