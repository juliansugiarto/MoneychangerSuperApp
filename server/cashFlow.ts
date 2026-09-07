/**
 * Laporan Arus Kas — metode langsung, disusun dari jurnal yang benar-benar menyentuh kas.
 *
 * Kas dan setara kas adalah `CASH_ACCOUNTS` = 1-1110 + 1-1120 + 1-1220 (keputusan pengguna
 * 5 September 2026). Kas UKA fisik 1-1210 **bukan** kas: ia persediaan yang dinilai lewat 5-1300,
 * dan memasukkannya akan menghitung pergerakan yang sama dua kali.
 *
 * Penanda `reconciled` sengaja membandingkan **dua jalur yang berbeda**: perubahan saldo ketiga
 * akun kas di satu sisi, dan jumlah seluruh bagian hasil klasifikasi tiap jurnal di sisi lain.
 * Menurunkan keduanya dari satu sumber akan membuat penanda ini selalu benar, dan penanda yang
 * tidak pernah salah tidak memberi tahu apa pun.
 */

import { and, gte, inArray, lte } from "drizzle-orm";
import { ledgerSettlements } from "../drizzle/schema";
import { classifyCashEntry, type CashFlowSection, type SettlementTarget } from "../shared/cashFlow";
import { CASH_ACCOUNTS } from "../shared/currencyRevaluation";
import { formatAmount, isoDay, parseAmount } from "../shared/ledger";
import { accountBalancesFor, dbDate, loadLines } from "./ledgerOperations";
import { databaseOrThrow, retryTransientDatabaseRead } from "./operations";

export type CashFlowLine = {
  label: string;
  amount: string;
  /** Nomor jurnal yang membentuk baris ini — inilah yang membuat pos dapat ditunjukkan asalnya. */
  entryNumbers: string[];
  /** Terisi hanya pada keranjang "belum terklasifikasi". */
  reason?: string;
};

export type CashFlowSectionView = { title: string; lines: CashFlowLine[]; total: string };

const SECTION_TITLES: Record<Exclude<CashFlowSection, "INTERNAL">, string> = {
  OPERASI: "Arus kas dari aktivitas operasi",
  INVESTASI: "Arus kas dari aktivitas investasi",
  PENDANAAN: "Arus kas dari aktivitas pendanaan",
  PENGARUH_KURS: "Pengaruh perubahan kurs atas kas dan setara kas",
  BELUM_TERKLASIFIKASI: "Belum terklasifikasi",
};

const isCashAccount = (code: string) => (CASH_ACCOUNTS as readonly string[]).includes(code);

const sumCash = (rows: { accountCode: string; balance: bigint }[]) =>
  rows.filter((row) => isCashAccount(row.accountCode)).reduce((total, row) => total + row.balance, 0n);

/**
 * Sasaran pelunasan per jurnal.
 *
 * Jurnal pelunasan bersumber `MUTASI_KAS`/`MUTASI_BANK` dengan rujukan `KAS-{id}`/`BANK-{id}`
 * (`server/ledgerPosting.ts`), dan baris `ledger_settlements` menyimpan id mutasi yang sama. Itulah
 * satu-satunya penghubung antara jurnal dan apa yang dilunasinya — akun lawannya sendiri (2-1900)
 * tidak membedakan beban dari aset tetap.
 */
async function settlementTargets(from: Date | string, to: Date | string) {
  const db = await databaseOrThrow();
  const rows = await db
    .select()
    .from(ledgerSettlements)
    .where(and(gte(ledgerSettlements.settlementDate, dbDate(from)), lte(ledgerSettlements.settlementDate, dbDate(to))));

  const byReference = new Map<string, SettlementTarget>();
  for (const row of rows) {
    if (row.cashMovementId) byReference.set(`MUTASI_KAS:KAS-${row.cashMovementId}`, row.targetType as SettlementTarget);
    if (row.bankMovementId) byReference.set(`MUTASI_BANK:BANK-${row.bankMovementId}`, row.targetType as SettlementTarget);
  }
  return byReference;
}

export async function buildCashFlowStatement(input: { from: Date | string; to: Date | string }) {
  return retryTransientDatabaseRead(async () => {
    const dayBefore = new Date(new Date(`${isoDay(input.from)}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);

    const [lines, targets, openingBalances, closingBalances] = await Promise.all([
      loadLines(input.from, input.to),
      // Pelunasan dicari melewati rentangnya, karena baris pelunasan dan jurnalnya boleh berbeda
      // tanggal: mutasi 30 September yang dijurnal 1 Oktober tetap harus ketemu sasarannya.
      settlementTargets(new Date(`${isoDay(input.from)}T00:00:00`), input.to),
      accountBalancesFor({ to: dayBefore }),
      accountBalancesFor({ to: input.to }),
    ]);

    type Entry = { entryNumber: string; sourceType: string; cashDelta: bigint; counterparts: string[]; reference: string | null };
    const entries = new Map<number, Entry>();
    for (const line of lines) {
      const entry = entries.get(line.entryId) ?? {
        entryNumber: line.entryNumber, sourceType: String(line.sourceType), cashDelta: 0n,
        counterparts: [], reference: line.sourceReference ?? null,
      };
      const amount = parseAmount(line.amount);
      if (isCashAccount(line.accountCode)) entry.cashDelta += line.side === "DEBIT" ? amount : -amount;
      else entry.counterparts.push(line.accountCode);
      entries.set(line.entryId, entry);
    }

    const buckets = new Map<CashFlowSection, Map<string, CashFlowLine & { cents: bigint }>>();
    for (const entry of entries.values()) {
      const classification = classifyCashEntry({
        sourceType: entry.sourceType,
        cashDelta: entry.cashDelta,
        counterpartAccounts: entry.counterparts,
        settlementTarget: targets.get(`${entry.sourceType}:${entry.reference ?? ""}`) ?? null,
      });
      if (classification.section === "INTERNAL") continue;

      const bucket = buckets.get(classification.section) ?? new Map();
      const existing = bucket.get(classification.label) ?? { label: classification.label, amount: "0.00", entryNumbers: [], cents: 0n, reason: classification.reason };
      existing.cents += entry.cashDelta;
      existing.entryNumbers.push(entry.entryNumber);
      bucket.set(classification.label, existing);
      buckets.set(classification.section, bucket);
    }

    const view = (section: Exclude<CashFlowSection, "INTERNAL">): CashFlowSectionView => {
      const rows = [...(buckets.get(section)?.values() ?? [])];
      const total = rows.reduce((sum, row) => sum + row.cents, 0n);
      return {
        title: SECTION_TITLES[section],
        lines: rows.map((row) => ({ label: row.label, amount: formatAmount(row.cents), entryNumbers: row.entryNumbers, ...(row.reason ? { reason: row.reason } : {}) })),
        total: formatAmount(total),
      };
    };
    const totalOf = (section: Exclude<CashFlowSection, "INTERNAL">) =>
      [...(buckets.get(section)?.values() ?? [])].reduce((sum, row) => sum + row.cents, 0n);

    const openingCash = sumCash(openingBalances);
    const closingCash = sumCash(closingBalances);
    const classifiedChange = totalOf("OPERASI") + totalOf("INVESTASI") + totalOf("PENDANAAN") + totalOf("PENGARUH_KURS") + totalOf("BELUM_TERKLASIFIKASI");
    const difference = closingCash - openingCash - classifiedChange;

    return {
      period: { from: isoDay(input.from), to: isoDay(input.to) },
      openingCash: formatAmount(openingCash),
      closingCash: formatAmount(closingCash),
      operating: view("OPERASI"),
      investing: view("INVESTASI"),
      financing: view("PENDANAAN"),
      rateEffect: view("PENGARUH_KURS"),
      unclassified: view("BELUM_TERKLASIFIKASI"),
      netChange: formatAmount(classifiedChange),
      /** Perubahan saldo ketiga akun kas — dihitung lewat jalur yang berbeda dari `netChange`. */
      actualChange: formatAmount(closingCash - openingCash),
      reconciled: difference === 0n,
      difference: formatAmount(difference),
    };
  });
}
