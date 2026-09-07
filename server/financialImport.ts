import * as XLSX from "xlsx";
import {
  REGULATORY_FORMS,
  formMatchKey,
  groupHeadingFor,
  isValueCell,
  normalizeFormLabel,
  type FormCode,
} from "../shared/regulatoryForms";
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export type ImportedFinancialRow = { code: string; label: string; value: string };
export type FinancialImportResult = { profitLossRows: ImportedFinancialRow[]; balanceSheetRows: ImportedFinancialRow[]; equityRows: ImportedFinancialRow[]; /** Pos berlabel yang tidak dikenali; dilaporkan, tidak diabaikan. */ skipped?: SkippedFormRow[]; sourceStorageKey: null; sourceFileName: string; sourceMimeType: string };
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


/* ── Tata letak form resmi ──────────────────────────────────────────────────────────────────────
 *
 * Form B0002/B0003/B0004 milik BI tidak punya kolom "Record No" yang menjadi kunci pemetaan jalur
 * lama. Ia lembar berformat dengan header *Sandi Pelapor*, *Periode*, *Nomor Form*, *Jumlah Record*,
 * dan *Jenis Periode*, lalu blok berlabel.
 *
 * Pos dikenali lewat **judul kelompok + label**, bukan label saja: B0002 memuat dua baris "Bank",
 * dan B0003 memuat dua baris "Laba" serta dua baris "Rugi (-)". Posisi kolomnya sengaja tidak
 * dipakai sebagai kunci — berkas BI dan berkas hasil ekspor aplikasi ini tidak harus meletakkan
 * angkanya pada kolom yang sama, dan yang harus cocok adalah posnya, bukan alamat selnya.
 */

export type SkippedFormRow = { form: FormCode; heading: string; label: string };

const FORM_MARKER = "Nomor Form";

type RecordTarget = { key: string; columns: string[]; label: string };

/** Pos berisi tiap form, dicari lewat pasangan judul kelompok dan labelnya. */
function recordTargets(code: FormCode) {
  const form = REGULATORY_FORMS.find((candidate) => candidate.code === code)!;
  const targets = new Map<string, RecordTarget>();
  const known = new Set<string>();

  form.rows.forEach((row, index) => {
    const heading = groupHeadingFor(form, index);
    if (row.label) known.add(formMatchKey(heading, row.label));
    if (!row.cells.some(isValueCell)) return;
    targets.set(formMatchKey(heading, row.label), {
      key: row.key,
      label: row.label,
      columns: row.cells.filter(isValueCell).map((cell) => cell.column),
    });
  });

  const headings = new Set(
    form.rows.filter((row) => row.cells.length === 0 && row.label).map((row) => normalizeFormLabel(row.label)),
  );
  return { targets, known, headings };
}

/**
 * Label yang bukan pos: judul berkas, nama ruas header, spanduk kolom, dan judul kolom B0004.
 * Semuanya ada pada form aslinya dan tidak boleh dilaporkan sebagai pos yang tidak dikenal.
 */
const CHROME_LABELS = new Set(
  [
    "Laporan Keuangan Neraca", "Laporan Keuangan Laba/Rugi", "Laporan Keuangan Perubahan Ekuitas",
    "Sandi Pelapor :", "Periode :", "Nomor Form :", "Jumlah Record :", "Jenis Periode :",
    "Tahun", "ASET", "KEWAJIBAN DAN EKUITAS",
    "Keterangan", "Modal disetor", "Laba ditahan/(akumulasi rugi)", "Jumlah",
    "Aktiva dan Pasiva seimbang !", "Simpan",
  ].map(normalizeFormLabel),
);

/** Baris pertama sesudah blok header form; di atasnya bukan pos. */
function bodyStartsAt(rows: unknown[][]) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index]!.some((cell) => normalizeFormLabel(String(cell ?? "")) === "jenis periode")) return index + 1;
  }
  return 0;
}

const isNumeric = (value: unknown) => typeof value === "number" && Number.isFinite(value);

/** Nominal dari sel teks berformat Indonesia, misalnya "Rp. 1.492.483.446,00". */
export function parseFormAmount(value: unknown): number | null {
  if (isNumeric(value)) return value as number;
  const text = String(value ?? "").replace(/rp\.?/i, "").replace(/\s/g, "").trim();
  if (!text || !/[\d]/.test(text)) return null;
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  const digits = text.replace(/^[-(]|\)$/g, "");
  if (!/^[\d.,]+$/.test(digits)) return null;
  // Koma memisahkan desimal pada form Indonesia; titik memisahkan ribuan.
  const normalized = digits.includes(",") ? digits.replace(/\./g, "").replace(",", ".") : digits.replace(/\.(?=\d{3}\b)/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/** Kolom tempat sisi kanan B0002 dimulai, dibaca dari judul "KEWAJIBAN DAN EKUITAS". */
function rightSideAt(rows: unknown[][]) {
  for (const row of rows) {
    for (let index = 0; index < row.length; index += 1) {
      if (normalizeFormLabel(String(row[index] ?? "")) === "kewajiban dan ekuitas") return index;
    }
  }
  return null;
}

/** Kolom nilai B0004, dibaca dari baris judulnya sehingga lebar berkas boleh berbeda. */
function equityColumns(rows: unknown[][]) {
  const wanted: Record<string, string> = {
    "modal disetor": "MODAL_DISETOR",
    "laba ditahan akumulasi rugi": "LABA_DITAHAN",
    jumlah: "JUMLAH",
  };
  for (const row of rows) {
    const found = new Map<string, number>();
    for (let index = 0; index < row.length; index += 1) {
      const column = wanted[normalizeFormLabel(String(row[index] ?? ""))];
      if (column && !found.has(column)) found.set(column, index);
    }
    if (found.size >= 2) return found;
  }
  return new Map<string, number>();
}

export function officialSheetForm(sheet: XLSX.WorkSheet): FormCode | null {
  const text = XLSX.utils.sheet_to_csv(sheet);
  if (!text.includes(FORM_MARKER)) return null;
  for (const code of ["B0002", "B0003", "B0004"] as const) if (text.includes(code)) return code;
  return null;
}

/**
 * Membaca satu sheet berformat resmi.
 *
 * Label yang tidak dikenali dikembalikan **beserta labelnya**, bukan diabaikan diam-diam: form yang
 * direvisi BI akan terlihat sebagai daftar pos yang tidak dikenal, dan itu memang yang harus
 * terjadi. Judul kelompok dan baris subtotal bukan pos berisi, jadi keduanya dilewati tanpa
 * dilaporkan.
 */
export function officialRows(sheet: XLSX.WorkSheet, code: FormCode) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
  const { targets, known, headings } = recordTargets(code);
  const found = new Map<string, ImportedFinancialRow>();
  const skipped: SkippedFormRow[] = [];

  const from = bodyStartsAt(rows);
  const split = code === "B0002" ? rightSideAt(rows) : null;
  const columns = code === "B0004" ? equityColumns(rows) : new Map<string, number>();
  const heading = new Map<number, string>();

  const readHalf = (row: unknown[], from: number, to: number, half: number) => {
    let labelAt = -1;
    for (let index = from; index < to && index < row.length; index += 1) {
      const cell = row[index];
      if (typeof cell === "string" && cell.trim()) { labelAt = index; break; }
    }
    if (labelAt < 0) return;

    const label = String(row[labelAt]).trim();
    const normalized = normalizeFormLabel(label);
    if (!normalized) return;

    const target = targets.get(formMatchKey(heading.get(half) ?? "", label));
    if (!target) {
      if (CHROME_LABELS.has(normalized)) return;
      if (headings.has(normalized)) heading.set(half, label);
      else if (!known.has(formMatchKey(heading.get(half) ?? "", label))) skipped.push({ form: code, heading: heading.get(half) ?? "", label });
      return;
    }

    if (code === "B0004" && columns.size) {
      for (const column of target.columns) {
        const at = columns.get(column);
        const amount = at === undefined ? null : parseFormAmount(row[at]);
        if (amount === null) continue;
        const key = target.columns.length > 1 ? `${target.key}:${column}` : target.key;
        found.set(key, { code: key, label: target.label, value: amount.toFixed(2) });
      }
      return;
    }

    for (let index = labelAt + 1; index < to && index < row.length; index += 1) {
      const amount = parseFormAmount(row[index]);
      if (amount === null) continue;
      found.set(target.key, { code: target.key, label: target.label, value: amount.toFixed(2) });
      return;
    }
  };

  for (const row of rows.slice(from)) {
    if (split === null) readHalf(row, 0, row.length, 0);
    else {
      readHalf(row, 0, split, 0);
      readHalf(row, split, row.length, 1);
    }
  }

  if (!found.size) throw new Error(`Tidak menemukan satu pun pos pada FORM ${code}. Pastikan berkasnya berformat form BI.`);
  return { rows: Array.from(found.values()), skipped };
}

function findSheet(workbook: XLSX.WorkBook, marker: "B0002" | "B0003" | "B0004") {
  const worksheet = workbook.SheetNames.map((name) => workbook.Sheets[name]).find((sheet) => XLSX.utils.sheet_to_csv(sheet).includes(marker));
  if (!worksheet) throw new Error(`FORM ${marker} tidak ditemukan pada berkas. Impor membutuhkan B0002, B0003, dan B0004 dalam satu berkas.`);
  return worksheet;
}

/**
 * Membaca workbook laporan keuangan, dua tata letak sekaligus.
 *
 * Bercabang di depan: sheet yang memuat penanda "Nomor Form" dibaca sebagai **form resmi** lewat
 * judul kelompok dan label pos; selain itu jalur **Record No** yang sudah ada dipakai apa adanya.
 * Berkas yang selama ini dapat diimpor karena itu tetap terbaca persis seperti sebelumnya.
 */
export function parseFinancialWorkbook(data: Buffer) {
  assertSpreadsheetSignature(data);
  let workbook: XLSX.WorkBook; try { workbook = XLSX.read(data, { type: "buffer", raw: false }); } catch { throw new Error("Berkas spreadsheet tidak dapat dibaca."); }

  const skipped: SkippedFormRow[] = [];
  const readForm = (code: FormCode, expectedTitle: string) => {
    const sheet = findSheet(workbook, code);
    if (officialSheetForm(sheet) !== code) return mappedRows(sheet, expectedTitle);
    const official = officialRows(sheet, code);
    skipped.push(...official.skipped);
    return official.rows;
  };

  return {
    profitLossRows: readForm("B0003", "laba rugi B0003"),
    balanceSheetRows: readForm("B0002", "neraca B0002"),
    equityRows: readForm("B0004", "perubahan ekuitas B0004"),
    skipped,
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
  const { profitLossRows, balanceSheetRows, equityRows, skipped } = parseFinancialWorkbook(data);
  const sourceFileName = cleanFileName(input.originalFileName);
  return { profitLossRows, balanceSheetRows, equityRows, skipped, sourceStorageKey: null, sourceFileName, sourceMimeType: input.mimeType };
}

export async function importFinancialSnapshotBundle(input: { files: ImportFile[]; actorUserId: number }): Promise<FinancialImportResult> {
  if (input.files.length !== 3) throw new Error("Pilih tepat tiga workbook: B0002, B0003, dan B0004.");
  const sourceFiles = input.files.map((file) => ({ name: cleanFileName(file.originalFileName), data: decodedUpload(file) }));
  const { profitLossRows, balanceSheetRows, equityRows, combinedWorkbook } = parseFinancialWorkbookBundle(sourceFiles.map((file) => file.data));
  const sourceFileName = `Gabungan-${sourceFiles.map((file) => file.name.replace(/\.[^.]+$/, "")).join("-")}.xlsx`;
  void combinedWorkbook;
  return { profitLossRows, balanceSheetRows, equityRows, sourceStorageKey: null, sourceFileName, sourceMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}
