import * as XLSX from "xlsx";
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export type ImportedFinancialRow = { code: string; label: string; value: string };
export type FinancialImportResult = { profitLossRows: ImportedFinancialRow[]; balanceSheetRows: ImportedFinancialRow[]; equityRows: ImportedFinancialRow[]; sourceStorageKey: null; sourceFileName: string; sourceMimeType: string };
type ImportFile = { dataBase64: string; originalFileName: string; mimeType: string; byteSize: number };

function cleanFileName(value: string) { const cleaned = value.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 180); return cleaned || "snapshot-keuangan"; }
function decodeBase64(value: string) { const encoded = value.replace(/^data:[^;]+;base64,/, "").trim(); if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Berkas impor tidak valid."); const data = Buffer.from(encoded, "base64"); if (!data.length || data.length > MAX_IMPORT_BYTES) throw new Error("Ukuran berkas impor harus antara 1 byte dan 5 MB."); return data; }
function assertSpreadsheetSignature(data: Buffer) {
  const isXlsxZip = data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && (data[2] === 0x03 || data[2] === 0x05 || data[2] === 0x07) && (data[3] === 0x04 || data[3] === 0x06 || data[3] === 0x08);
  const isLegacyXls = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (!isXlsxZip && !isLegacyXls) throw new Error("Berkas impor harus merupakan workbook XLSX atau XLS yang valid.");
}
function normalizedValue(value: unknown) { const raw = String(value ?? "").trim().replace(/\s/g, ""); if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) return raw.replace(/,/g, ""); return raw; }
function mappedRows(sheet: XLSX.WorkSheet, expectedTitle: string) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }); const found = new Map<string, ImportedFinancialRow>();
  for (const row of rows) {
    const code = String(row[4] ?? "").trim(); const label = String(row[5] ?? "").trim(); const value = normalizedValue(row[6]); const retainedEarnings = normalizedValue(row[7]);
    if (!code || !label || !/^\d{1,3}$/.test(code)) continue;
    if (expectedTitle.includes("B0004") && retainedEarnings) {
      if (value) found.set(`${code}-MODAL`, { code: `${code}-MODAL`, label: `${label} — Modal disetor`, value });
      found.set(`${code}-LABA`, { code: `${code}-LABA`, label: `${label} — Laba ditahan/akumulasi rugi`, value: retainedEarnings });
      continue;
    }
    if (value) found.set(code, { code, label, value });
  }
  if (!found.size) throw new Error(`Tidak menemukan pos ${expectedTitle}. Gunakan layout FORM B0002/B0003/B0004 dengan kolom Record No, Pos Akun, dan Nilai.`);
  return Array.from(found.values());
}

function findSheet(workbook: XLSX.WorkBook, marker: "B0002" | "B0003" | "B0004") {
  const worksheet = workbook.SheetNames.map((name) => workbook.Sheets[name]).find((sheet) => XLSX.utils.sheet_to_csv(sheet).includes(marker));
  if (!worksheet) throw new Error(`FORM ${marker} tidak ditemukan pada berkas. Impor membutuhkan B0002, B0003, dan B0004 dalam satu berkas.`);
  return worksheet;
}

export function parseFinancialWorkbook(data: Buffer) {
  assertSpreadsheetSignature(data);
  let workbook: XLSX.WorkBook; try { workbook = XLSX.read(data, { type: "buffer", raw: false }); } catch { throw new Error("Berkas spreadsheet tidak dapat dibaca."); }
  return {
    profitLossRows: mappedRows(findSheet(workbook, "B0003"), "laba rugi B0003"),
    balanceSheetRows: mappedRows(findSheet(workbook, "B0002"), "neraca B0002"),
    equityRows: mappedRows(findSheet(workbook, "B0004"), "perubahan ekuitas B0004"),
  };
}

export function parseFinancialWorkbookBundle(files: Buffer[]) {
  const forms: Partial<Record<"B0002" | "B0003" | "B0004", XLSX.WorkSheet>> = {};
  for (const data of files) {
    assertSpreadsheetSignature(data);
    let workbook: XLSX.WorkBook; try { workbook = XLSX.read(data, { type: "buffer", raw: false }); } catch { throw new Error("Salah satu workbook tidak dapat dibaca."); }
    for (const marker of ["B0002", "B0003", "B0004"] as const) {
      const sheet = workbook.SheetNames.map((name) => workbook.Sheets[name]).find((candidate) => XLSX.utils.sheet_to_csv(candidate).includes(marker));
      if (sheet) {
        if (forms[marker]) throw new Error(`FORM ${marker} ditemukan lebih dari satu kali. Pilih satu sumber untuk setiap form.`);
        forms[marker] = sheet;
      }
    }
  }
  if (!forms.B0002 || !forms.B0003 || !forms.B0004) throw new Error("Tiga workbook harus bersama-sama memuat FORM B0002, B0003, dan B0004.");
  const profitLossRows = mappedRows(forms.B0003, "laba rugi B0003"); const balanceSheetRows = mappedRows(forms.B0002, "neraca B0002"); const equityRows = mappedRows(forms.B0004, "perubahan ekuitas B0004");
  const combined = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(combined, forms.B0002, "B0002"); XLSX.utils.book_append_sheet(combined, forms.B0003, "B0003"); XLSX.utils.book_append_sheet(combined, forms.B0004, "B0004");
  return { profitLossRows, balanceSheetRows, equityRows, combinedWorkbook: XLSX.write(combined, { type: "buffer", bookType: "xlsx" }) as Buffer };
}

function decodedUpload(input: ImportFile) {
  if (!ACCEPTED_MIME_TYPES.has(input.mimeType)) throw new Error("Format impor harus XLSX atau XLS karena tiga FORM harus berada dalam satu workbook.");
  const data = decodeBase64(input.dataBase64); if (data.byteLength !== input.byteSize) throw new Error("Ukuran berkas impor tidak konsisten.");
  return data;
}

export async function importFinancialSnapshotFile(input: { dataBase64: string; originalFileName: string; mimeType: string; byteSize: number; actorUserId: number }): Promise<FinancialImportResult> {
  const data = decodedUpload(input);
  const { profitLossRows, balanceSheetRows, equityRows } = parseFinancialWorkbook(data);
  const sourceFileName = cleanFileName(input.originalFileName);
  return { profitLossRows, balanceSheetRows, equityRows, sourceStorageKey: null, sourceFileName, sourceMimeType: input.mimeType };
}

export async function importFinancialSnapshotBundle(input: { files: ImportFile[]; actorUserId: number }): Promise<FinancialImportResult> {
  if (input.files.length !== 3) throw new Error("Pilih tepat tiga workbook: B0002, B0003, dan B0004.");
  const sourceFiles = input.files.map((file) => ({ name: cleanFileName(file.originalFileName), data: decodedUpload(file) }));
  const { profitLossRows, balanceSheetRows, equityRows, combinedWorkbook } = parseFinancialWorkbookBundle(sourceFiles.map((file) => file.data));
  const sourceFileName = `Gabungan-${sourceFiles.map((file) => file.name.replace(/\.[^.]+$/, "")).join("-")}.xlsx`;
  void combinedWorkbook;
  return { profitLossRows, balanceSheetRows, equityRows, sourceStorageKey: null, sourceFileName, sourceMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}
