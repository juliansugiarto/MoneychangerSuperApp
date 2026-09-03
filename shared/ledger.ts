/**
 * Aritmetika dan aturan pembukuan berpasangan.
 *
 * Dipisahkan dari basis data dengan sengaja: keseimbangan jurnal, arah saldo tiap jenis akun, dan
 * penyusunan neraca saldo adalah aturan, bukan data — sehingga dapat diuji sungguhan tanpa
 * menyentuh basis data mana pun.
 *
 * Seluruh nominal buku besar dinyatakan dalam Rupiah (mata uang fungsional) dua angka desimal, dan
 * dihitung sebagai bilangan bulat sen memakai `bigint`. Menjumlahkan uang dengan `number` akan
 * menghasilkan neraca saldo yang selisih beberapa sen setelah ribuan baris — persis jenis
 * ketidakcocokan yang membuat buku besar tidak dapat dipertanggungjawabkan kepada pemeriksa.
 */

import { type AccountType, isBalanceSheetAccount, type NormalBalance } from "./chartOfAccounts";

export type JournalSide = "DEBIT" | "KREDIT";

const AMOUNT_PATTERN = /^-?\d{1,18}(\.\d{1,2})?$/;

/** Mengubah nominal desimal (maksimal dua angka di belakang koma) menjadi bilangan bulat sen. */
export function parseAmount(value: string): bigint {
  const trimmed = value.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new Error(`Nominal "${value}" bukan angka Rupiah yang sah (maksimal dua angka desimal).`);
  }
  const negative = trimmed.startsWith("-");
  const [whole, fraction = ""] = (negative ? trimmed.slice(1) : trimmed).split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

export function formatAmount(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export type JournalLineInput = { accountCode: string; side: JournalSide; amount: string };

export type JournalBalance = {
  totalDebit: bigint;
  totalCredit: bigint;
  difference: bigint;
  balanced: boolean;
};

/**
 * Menjumlahkan sisi debit dan kredit sebuah jurnal.
 *
 * Baris bernominal nol ditolak: baris tanpa nilai tidak menyatakan apa pun, tetapi membuat jurnal
 * terlihat lebih panjang daripada isinya saat dibaca pemeriksa.
 */
export function summariseJournal(lines: JournalLineInput[]): JournalBalance {
  let totalDebit = 0n;
  let totalCredit = 0n;
  for (const line of lines) {
    const amount = parseAmount(line.amount);
    if (amount <= 0n) throw new Error("Setiap baris jurnal harus bernominal lebih besar dari nol.");
    if (line.side === "DEBIT") totalDebit += amount;
    else totalCredit += amount;
  }
  const difference = totalDebit - totalCredit;
  return { totalDebit, totalCredit, difference, balanced: difference === 0n };
}

/**
 * Memeriksa sebuah jurnal sebelum disimpan.
 *
 * Jurnal berkaki tunggal ditolak terpisah dari ketidakseimbangan supaya pesannya jelas: satu baris
 * bernilai nol pada sisi lawan akan "seimbang" secara aritmetika padahal bukan jurnal berpasangan.
 */
export function assertJournalIsPostable(lines: JournalLineInput[]): JournalBalance {
  if (lines.length < 2) throw new Error("Jurnal harus memiliki minimal dua baris: satu debit dan satu kredit.");
  const summary = summariseJournal(lines);
  if (!summary.balanced) {
    throw new Error(
      `Jurnal tidak seimbang: debit ${formatAmount(summary.totalDebit)} berbeda ${formatAmount(summary.difference)} dari kredit ${formatAmount(summary.totalCredit)}.`,
    );
  }
  if (summary.totalDebit === 0n) throw new Error("Jurnal tidak boleh bernilai nol seluruhnya.");
  return summary;
}

/** Sisi lawan sebuah baris — dipakai jurnal balik, satu-satunya cara mengoreksi jurnal terkunci. */
export const oppositeSide = (side: JournalSide): JournalSide => (side === "DEBIT" ? "KREDIT" : "DEBIT");

/**
 * Saldo akun searah saldo normalnya: positif berarti bergerak seperti seharusnya.
 *
 * Akun lawan (akumulasi penyusutan, dividen, persediaan akhir) memakai aturan yang sama — saldo
 * normalnya sudah dinyatakan berlawanan pada bagan akun, sehingga tidak perlu perlakuan khusus.
 */
export function accountBalance(normalBalance: NormalBalance, totalDebit: bigint, totalCredit: bigint): bigint {
  return normalBalance === "DEBIT" ? totalDebit - totalCredit : totalCredit - totalDebit;
}

export type TrialBalanceLineInput = { accountCode: string; side: JournalSide; amount: bigint };

export type TrialBalanceRow = {
  accountCode: string;
  /** Saldo sebelum periode, bertanda debit-positif. */
  openingBalance: bigint;
  /** Mutasi di dalam periode. */
  totalDebit: bigint;
  totalCredit: bigint;
  /** Saldo akhir ditempatkan pada satu sisi saja, seperti neraca saldo di atas kertas. */
  debitBalance: bigint;
  creditBalance: bigint;
};

export type TrialBalance = {
  rows: TrialBalanceRow[];
  totalDebit: bigint;
  totalCredit: bigint;
  balanced: boolean;
};

const netByAccount = (lines: TrialBalanceLineInput[]) => {
  const totals = new Map<string, { debit: bigint; credit: bigint }>();
  for (const line of lines) {
    const entry = totals.get(line.accountCode) ?? { debit: 0n, credit: 0n };
    if (line.side === "DEBIT") entry.debit += line.amount;
    else entry.credit += line.amount;
    totals.set(line.accountCode, entry);
  }
  return totals;
};

/**
 * Neraca saldo: dasar penyusunan tiap pos laporan keuangan.
 *
 * Saldo akhir dihitung kumulatif — mutasi di dalam periode ditambahkan ke saldo sebelum periode.
 * Tanpa saldo awal, akun neraca hanya menunjukkan pergerakan sebulan: modal disetor bulan lalu
 * lenyap dari neraca bulan ini, dan angkanya tidak dapat dipakai sebagai isian B0002.
 *
 * Saldo awal diikutkan untuk **seluruh** akun, bukan hanya akun neraca. Menyaringnya ke akun neraca
 * saja membuat jumlah kedua sisi berselisih persis sebesar laba periode-periode sebelumnya, karena
 * jurnal penutup yang memindahkan laba rugi ke laba ditahan belum ada. Selama jurnal penutup belum
 * dibangun, akun laba rugi terbaca sejak awal pembukuan — dan itu jujur, bukan tersembunyi.
 *
 * Akun tanpa saldo awal maupun mutasi sengaja tidak muncul.
 */
export function buildTrialBalance(
  lines: TrialBalanceLineInput[],
  openingLines: TrialBalanceLineInput[] = [],
): TrialBalance {
  const movements = netByAccount(lines);
  const openings = netByAccount(openingLines);

  const rows: TrialBalanceRow[] = [...new Set([...openings.keys(), ...movements.keys()])]
    .map((accountCode) => {
      const opening = openings.get(accountCode) ?? { debit: 0n, credit: 0n };
      const movement = movements.get(accountCode) ?? { debit: 0n, credit: 0n };
      const openingBalance = opening.debit - opening.credit;
      const net = openingBalance + movement.debit - movement.credit;
      return {
        accountCode,
        openingBalance,
        totalDebit: movement.debit,
        totalCredit: movement.credit,
        debitBalance: net > 0n ? net : 0n,
        creditBalance: net < 0n ? -net : 0n,
      };
    })
    .filter((row) => row.openingBalance !== 0n || row.totalDebit !== 0n || row.totalCredit !== 0n)
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const totalDebit = rows.reduce((sum, row) => sum + row.debitBalance, 0n);
  const totalCredit = rows.reduce((sum, row) => sum + row.creditBalance, 0n);
  return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

/**
 * Saldo awal periode berikutnya untuk sebuah akun.
 *
 * Akun neraca membawa saldonya; akun laba rugi dimulai dari nol karena hasilnya sudah ditutup ke
 * laba ditahan. Tanpa pembedaan ini, beban bulan lalu akan terus tampil pada laporan bulan ini.
 */
export function carryForwardBalance(type: AccountType, closingBalance: bigint): bigint {
  return isBalanceSheetAccount(type) ? closingBalance : 0n;
}

/**
 * Hari kalender sebuah tanggal sebagai teks "YYYY-MM-DD".
 *
 * Tanggal buku besar adalah hari, bukan saat. Seluruh aritmetika periode dikerjakan atas teks ini
 * dan tidak pernah atas getter waktu sebuah `Date`: mencampur keduanya membuat 1 September jatuh ke
 * periode Agustus pada proses yang berjalan di zona waktu berbeda dari penyimpanannya.
 */
export const isoDay = (value: Date | string): string =>
  typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);

export const monthStartIso = (value: Date | string): string => `${isoDay(value).slice(0, 7)}-01`;

/** Hari terakhir bulan tersebut, termasuk 29 Februari pada tahun kabisat. */
export const monthEndIso = (value: Date | string): string => {
  const [year, month] = isoDay(value).split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
};
