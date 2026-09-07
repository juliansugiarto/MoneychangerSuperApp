/**
 * Nilai tiap baris form B0002/B0003/B0004, dihitung dari laporan keuangan.
 *
 * Fungsi di sini **murni**: ia tidak menyentuh basis data dan tidak memanggil `accountBalancesFor`.
 * Satu-satunya sumber angkanya adalah laporan yang sudah disusun `buildFinancialStatements` — yang
 * sama persis dengan yang tampil di layar. Dua jalur perhitungan yang dapat berbeda pendapat adalah
 * kekeliruan yang justru tidak terlihat dari berkas hasilnya.
 */

import { findAccount } from "./chartOfAccounts";
import type { BalanceSheet, EquityStatement, IncomeStatement } from "./financialStatements";
import {
  EQUITY_MEASURE_ACCOUNTS,
  REGULATORY_FORMS,
  isValueCell,
  recordRows,
  renderFormLabel,
  type EquityMeasure,
  type FormCell,
  type FormCode,
  type FormColumn,
  type FormRow,
  type RegulatoryForm,
  type ValueSide,
} from "./regulatoryForms";

export type FormValueInput = {
  balanceSheet: BalanceSheet;
  incomeStatement: IncomeStatement;
  equityStatement: EquityStatement;
};

/** Dari mana satu sel mendapat angkanya — yang dicetak pada lembar penelusuran. */
export type FormValueTrace =
  | { kind: "AKUN"; code: string; accountName: string; balance: bigint }
  | { kind: "SISI"; code: string; accountName: string; balance: bigint; side: ValueSide; used: boolean }
  | { kind: "EKUITAS"; measure: EquityMeasure; accounts: string[]; amount: bigint; side?: ValueSide; used: boolean }
  | { kind: "SUBTOTAL"; terms: { key: string; column: FormColumn; sign: 1 | -1; value: bigint }[] };

export type FormCellValue = { column: FormColumn; value: bigint; trace: FormValueTrace };

export type FormRowValue = {
  key: string;
  /** Label yang sudah bertahun buku. */
  label: string;
  indent: 0 | 1 | 2;
  side?: "KIRI" | "KANAN";
  cells: FormCellValue[];
  alwaysZeroReason?: string;
};

export type FormValues = {
  code: FormCode;
  title: string;
  recordCount: number;
  fiscalYear: number;
  rows: FormRowValue[];
};

/**
 * Sisi bertanda sebuah saldo, disajikan sebagai bilangan positif.
 *
 * Labelnya sendiri sudah membawa tanda kurang — "Rugi (-)", "Akum.Penyusutan (-/-)" — jadi
 * menuliskannya negatif akan menguranginya dua kali pada penjumlahan formnya.
 */
export const sideValue = (balance: bigint, side: ValueSide) =>
  side === "POSITIF" ? (balance > 0n ? balance : 0n) : balance < 0n ? -balance : 0n;

/** Saldo tiap akun menurut laporan, bukan menurut buku besar yang dibaca ulang. */
function balancesFromStatements(input: FormValueInput) {
  const balances = new Map<string, bigint>();
  const sections = [
    input.balanceSheet.assets,
    input.balanceSheet.liabilities,
    input.balanceSheet.equity,
    input.incomeStatement.revenue,
    input.incomeStatement.costOfGoods,
    input.incomeStatement.operatingExpenses,
    input.incomeStatement.otherItems,
    input.incomeStatement.tax,
  ];
  // `section` membuang akun yang bersaldo nol pada kedua periode, jadi akun yang tidak muncul di
  // sini memang bernilai nol — bukan tanda ada yang hilang.
  for (const item of sections) for (const line of item.lines) balances.set(line.accountCode, line.amount);
  return balances;
}

/**
 * Pos perubahan ekuitas.
 *
 * `LABA_DITAHAN_AKHIR` adalah laba ditahan seperti yang diminta B0002: saldo `3-2100` ditambah laba
 * periode berjalan dan dikurangi dividen. Diambil dari `closingEquity` dikurangi modal disetor agar
 * angkanya persis sama dengan yang membuat neraca seimbang.
 */
function equityMeasure(measure: EquityMeasure, equity: EquityStatement): bigint {
  switch (measure) {
    case "MODAL_AWAL":
      return equity.openingCapital;
    case "LABA_DITAHAN_AWAL":
      return equity.openingRetainedEarnings;
    case "LABA_DITAHAN_AKHIR":
      return equity.closingEquity - equity.openingCapital;
    case "LABA_PERIODE":
      return equity.netProfit;
    case "DIVIDEN":
      return equity.dividends;
    case "EKUITAS_LAIN":
      return 0n;
  }
}

export function buildFormValues(input: FormValueInput, fiscalYear: number): FormValues[] {
  const balances = balancesFromStatements(input);
  return REGULATORY_FORMS.map((form) => buildOneForm(form, input, balances, fiscalYear));
}

export const findFormValues = (values: FormValues[], code: FormCode) =>
  values.find((form) => form.code === code) ?? null;

/** Nilai satu sel pada satu form, dicari lewat kunci baris dan kolomnya. */
export function cellValue(form: FormValues, key: string, column?: FormColumn): bigint {
  const row = form.rows.find((candidate) => candidate.key === key);
  if (!row) throw new Error(`Baris ${key} tidak ada pada form ${form.code}.`);
  const cell = column ? row.cells.find((candidate) => candidate.column === column) : row.cells[0];
  if (!cell) throw new Error(`Baris ${key} pada form ${form.code} tidak punya kolom ${column ?? "nilai"}.`);
  return cell.value;
}

function buildOneForm(
  form: RegulatoryForm,
  input: FormValueInput,
  balances: Map<string, bigint>,
  fiscalYear: number,
): FormValues {
  const byKey = new Map(form.rows.map((row) => [row.key, row]));
  const computed = new Map<string, FormCellValue>();
  const node = (key: string, column: FormColumn) => `${key}:${column}`;

  const cellOf = (row: FormRow, cell: FormCell, trail: string[]): FormCellValue => {
    const id = node(row.key, cell.column);
    const done = computed.get(id);
    if (done) return done;
    if (trail.includes(id)) throw new Error(`Lingkaran perhitungan pada ${form.code}: ${[...trail, id].join(" -> ")}`);

    const resolved = resolve(row, cell, [...trail, id]);
    computed.set(id, resolved);
    return resolved;
  };

  const resolve = (row: FormRow, cell: FormCell, trail: string[]): FormCellValue => {
    const source = cell.source;

    if (source.kind === "AKUN") {
      const balance = balances.get(source.code) ?? 0n;
      const account = findAccount(source.code);
      return {
        column: cell.column,
        value: balance,
        trace: { kind: "AKUN", code: source.code, accountName: account?.name ?? source.code, balance },
      };
    }

    if (source.kind === "SISI") {
      const balance = balances.get(source.code) ?? 0n;
      const account = findAccount(source.code);
      const value = sideValue(balance, source.side);
      return {
        column: cell.column,
        value,
        trace: {
          kind: "SISI",
          code: source.code,
          accountName: account?.name ?? source.code,
          balance,
          side: source.side,
          used: value !== 0n,
        },
      };
    }

    if (source.kind === "EKUITAS") {
      const amount = equityMeasure(source.measure, input.equityStatement);
      const value = source.side ? sideValue(amount, source.side) : amount;
      return {
        column: cell.column,
        value,
        trace: {
          kind: "EKUITAS",
          measure: source.measure,
          accounts: EQUITY_MEASURE_ACCOUNTS[source.measure],
          amount,
          side: source.side,
          used: value !== 0n,
        },
      };
    }

    const terms = source.of.map((term) => {
      const target = byKey.get(term.key);
      if (!target) throw new Error(`Baris ${term.key} tidak ada pada form ${form.code}.`);
      const column = term.column ?? target.cells[0]?.column;
      const targetCell = target.cells.find((candidate) => candidate.column === column);
      if (!targetCell) throw new Error(`Baris ${term.key} pada form ${form.code} tidak punya kolom ${column}.`);
      return { key: term.key, column: targetCell.column, sign: term.sign, value: cellOf(target, targetCell, trail).value };
    });

    return {
      column: cell.column,
      value: terms.reduce((total, term) => total + BigInt(term.sign) * term.value, 0n),
      trace: { kind: "SUBTOTAL", terms },
    };
  };

  const rows = form.rows.map((row): FormRowValue => ({
    key: row.key,
    label: renderFormLabel(row.label, fiscalYear),
    indent: row.indent,
    side: row.side,
    alwaysZeroReason: row.alwaysZeroReason,
    cells: row.cells.map((cell) => cellOf(row, cell, [])),
  }));

  // Invarian yang sama dengan header formnya sendiri; bila berbeda, berkasnya salah bentuk.
  const filled = rows.filter((row) => form.rows.find((candidate) => candidate.key === row.key)!.cells.some(isValueCell));
  if (filled.length !== recordRows(form).length) {
    throw new Error(`Jumlah baris berisi ${form.code} tidak sama dengan Jumlah Record ${form.recordCount}.`);
  }

  return { code: form.code, title: form.title, recordCount: form.recordCount, fiscalYear, rows };
}
