/**
 * Penulis berkas ekspor form B0002/B0003/B0004.
 *
 * Menutup lingkaran temuan pemeriksaan 7.1: angka laporan tidak lagi diketik ulang ke Excel BI,
 * melainkan ditulis dari buku besar yang sama dengan yang tampil di layar.
 *
 * Berkasnya **meniru** tata letak form resmi, bukan menyalin koordinat selnya. Ia juga tidak
 * memiliki tombol *Simpan* milik form BI — tombol itu makro milik berkas mereka, dan menulis ulang
 * berkas ber-makro lewat pustaka spreadsheet kerap merusak makronya. Penekanan tombol resminya
 * tetap dilakukan manusia pada berkas BI, dan aplikasi ini tidak pernah mengirim apa pun ke
 * regulator.
 */

import * as XLSX from "xlsx";
import {
  REGULATORY_FORMS,
  isValueCell,
  type EquityMeasure,
  type FormCode,
  type FormColumn,
  type RegulatoryForm,
} from "../shared/regulatoryForms";
import type { FormRowValue, FormValues } from "../shared/regulatoryFormValues";

export type FormWorkbookHeader = {
  /** `company_profile.biReporterCode`. Kosong ditolak, bukan dibiarkan kosong pada berkasnya. */
  reporterCode: string;
  fiscalYear: number;
};

export class MissingReporterCodeError extends Error {
  constructor() {
    super("Sandi Pelapor belum diisi pada Profil Perusahaan. Berkas laporan tanpa sandi pelapor tidak dapat dipakai BI.");
    this.name = "MissingReporterCodeError";
  }
}

/** Rupiah dari nominal buku besar yang tersimpan dalam sen. */
export function rupiah(cents: bigint): number {
  if (cents > 9_007_199_254_740_991n || cents < -9_007_199_254_740_991n) {
    throw new Error(`Nominal ${cents} terlalu besar untuk ditulis ke berkas Excel.`);
  }
  return Number(cents) / 100;
}

const indented = (row: FormRowValue) => (row.label ? `${"    ".repeat(row.indent)}${row.label}` : "");

/** Tata letak kolom tiap form: kolom nilai mana menempati kolom berkas yang mana. */
const LAYOUT: Record<FormCode, { columns: FormColumn[]; width: number }> = {
  // A label kiri, B/C nilai kiri, D pemisah, E label kanan, F/G nilai kanan.
  B0002: { columns: ["RINCI", "POKOK"], width: 7 },
  B0003: { columns: ["RINCI", "POKOK"], width: 3 },
  B0004: { columns: ["MODAL_DISETOR", "LABA_DITAHAN", "JUMLAH"], width: 4 },
};

const sideOffset = (form: FormCode, row: FormRowValue) => (form === "B0002" && row.side === "KANAN" ? 4 : 0);

function columnIndex(form: FormCode, row: FormRowValue, column: FormColumn) {
  const layout = LAYOUT[form];
  const within = layout.columns.indexOf(column);
  if (within < 0) throw new Error(`Kolom ${column} tidak dikenal pada ${form}.`);
  return sideOffset(form, row) + 1 + within;
}

const HEADINGS: Record<FormCode, [number, string][]> = {
  B0002: [[0, "ASET"], [4, "KEWAJIBAN DAN EKUITAS"]],
  B0003: [],
  B0004: [[0, "Keterangan"], [1, "Modal disetor"], [2, "Laba ditahan/(akumulasi rugi)"], [3, "Jumlah"]],
};

/**
 * Header yang sama dengan form aslinya. Blok kanannya — Nomor Form, Jumlah Record, Jenis Periode —
 * diletakkan pada kolom sesudah tabelnya, seperti pada berkas BI.
 */
function headerRows(values: FormValues, header: FormWorkbookHeader): unknown[][] {
  const layout = LAYOUT[values.code];
  const right = layout.width + 1;
  const rows: unknown[][] = [];

  const put = (cells: [number, unknown][]) => {
    const row: unknown[] = [];
    for (const [index, value] of cells) row[index] = value;
    rows.push(row);
  };

  put([[1, values.title]]);
  put([[0, "Sandi Pelapor :"], [1, header.reporterCode], [right, "Nomor Form :"], [right + 1, values.code]]);
  put([[0, "Periode :"], [1, "Tahun"], [right, "Jumlah Record :"], [right + 1, values.recordCount]]);
  put([[1, header.fiscalYear], [right, "Jenis Periode :"], [right + 1, "A"]]);
  put([]);
  return rows;
}

/**
 * Satu sheet per form.
 *
 * B0002 berkolom dua: baris sisi kiri dan sisi kanan ditulis berdampingan, masing-masing pada
 * urutannya sendiri, sehingga tinggi sheet-nya adalah sisi yang paling panjang.
 */
export function renderFormSheet(values: FormValues, header: FormWorkbookHeader): XLSX.WorkSheet {
  const rows: unknown[][] = headerRows(values, header);
  const layout = LAYOUT[values.code];

  const headings = HEADINGS[values.code];
  if (headings.length) {
    const row: unknown[] = [];
    for (const [index, label] of headings) row[index] = label;
    rows.push(row);
    rows.push([]);
  }

  const write = (target: unknown[], row: FormRowValue) => {
    target[sideOffset(values.code, row)] = indented(row);
    for (const cell of row.cells) target[columnIndex(values.code, row, cell.column)] = rupiah(cell.value);
  };

  if (values.code === "B0002") {
    const left = values.rows.filter((row) => row.side === "KIRI");
    const right = values.rows.filter((row) => row.side === "KANAN");
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      const row: unknown[] = [];
      if (left[index]) write(row, left[index]!);
      if (right[index]) write(row, right[index]!);
      rows.push(row);
    }
  } else {
    for (const row of values.rows) {
      const target: unknown[] = [];
      write(target, row);
      rows.push(target);
    }
  }

  return XLSX.utils.aoa_to_sheet(rows.map((row) => Array.from({ length: layout.width + 3 }, (_, index) => row[index] ?? null)));
}

/**
 * Lembar penelusuran: satu baris per pos berisi, beserta akun penyusun dan saldonya.
 *
 * Inilah jawaban temuan 7.1 di dalam satu berkas. Pemeriksa dapat menunjuk sebuah pos pada form dan
 * langsung melihat akun yang menyusunnya, tanpa membuka aplikasi ini dan tanpa mempercayai klaim
 * siapa pun. Baris yang memang selalu nol menyebutkan alasannya, bukan disembunyikan.
 */
export function renderTraceSheet(values: FormValues[]): XLSX.WorkSheet {
  const rows: unknown[][] = [
    ["PENELUSURAN POS LAPORAN KE AKUN BUKU BESAR"],
    ["Setiap pos berisi pada ketiga form, beserta akun penyusun dan saldonya pada buku besar."],
    ["Berkas ini tidak dikirim ke Bank Indonesia oleh aplikasi."],
    [],
    ["Form", "Pos", "Kolom", "Sumber", "Akun", "Nama akun", "Saldo buku besar (Rp)", "Nilai pada form (Rp)", "Keterangan"],
  ];

  for (const form of values) {
    for (const row of filledRows(form)) {
      for (const cell of row.cells) {
        const trace = cell.trace;
        if (trace.kind === "SUBTOTAL") continue;

        const shared = [form.code, row.label.trim(), cell.column];
        const value = rupiah(cell.value);
        const note = row.alwaysZeroReason ?? "";

        if (trace.kind === "AKUN") {
          rows.push([...shared, "Saldo akun", trace.code, trace.accountName, rupiah(trace.balance), value, note]);
          continue;
        }
        if (trace.kind === "SISI") {
          rows.push([
            ...shared,
            `Sisi ${trace.side.toLowerCase()}`,
            trace.code,
            trace.accountName,
            rupiah(trace.balance),
            value,
            note || (trace.used
              ? `Saldo bertanda ${rupiah(trace.balance)} jatuh pada sisi ini.`
              : `Saldo bertanda ${rupiah(trace.balance)} jatuh pada sisi lain, jadi baris ini nol.`),
          ]);
          continue;
        }
        rows.push([
          ...shared,
          "Pos ekuitas",
          trace.accounts.join(", ") || "—",
          EQUITY_MEASURE_LABELS[trace.measure],
          rupiah(trace.amount),
          value,
          note || (trace.side && !trace.used
            ? `Pos bertanda ${rupiah(trace.amount)} jatuh pada sisi lain, jadi baris ini nol.`
            : ""),
        ]);
      }
    }
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

const EQUITY_MEASURE_LABELS: Record<EquityMeasure, string> = {
  MODAL_AWAL: "Modal disetor",
  LABA_DITAHAN_AWAL: "Laba ditahan awal periode",
  LABA_DITAHAN_AKHIR: "Laba ditahan akhir (3-2100 + laba periode - dividen)",
  LABA_PERIODE: "Laba/(rugi) periode berjalan",
  DIVIDEN: "Pembagian dividen",
  EKUITAS_LAIN: "Perubahan ekuitas lain-lain",
};

const SHEET_NAMES: Record<FormCode, string> = {
  B0002: "B0002 Neraca",
  B0003: "B0003 Laba Rugi",
  B0004: "B0004 Ekuitas",
};

export function renderFormWorkbook(values: FormValues[], header: FormWorkbookHeader): XLSX.WorkBook {
  if (!header.reporterCode.trim()) throw new MissingReporterCodeError();

  const workbook = XLSX.utils.book_new();
  for (const code of ["B0002", "B0003", "B0004"] as const) {
    const form = values.find((candidate) => candidate.code === code);
    if (!form) throw new Error(`Nilai form ${code} tidak tersedia.`);
    XLSX.utils.book_append_sheet(workbook, renderFormSheet(form, header), SHEET_NAMES[code]);
  }
  XLSX.utils.book_append_sheet(workbook, renderTraceSheet(values), "Penelusuran");
  return workbook;
}

/** Baris berisi sebuah form, untuk uji dan untuk lembar penelusuran. */
export function filledRows(values: FormValues) {
  const structure: RegulatoryForm = REGULATORY_FORMS.find((candidate) => candidate.code === values.code)!;
  return values.rows.filter((row) => structure.rows.find((candidate) => candidate.key === row.key)!.cells.some(isValueCell));
}
