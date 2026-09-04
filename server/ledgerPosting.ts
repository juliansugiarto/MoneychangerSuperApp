import { and, eq, gte, inArray, lte } from "drizzle-orm";
import {
  bankAccountMovements,
  bankAccounts,
  cashBalanceMovements,
  cashBalances,
  currencies,
  exchangeTransactions,
  journalEntries,
  operationalExpenses,
} from "../drizzle/schema";
import { isSkipped, mapBankMovement, mapCashMovement, mapExchangeTransaction, mapExpense } from "../shared/journalMapping";
import { isoDay } from "../shared/ledger";
import { databaseOrThrow, writeAudit } from "./operations";
import { postJournalEntry } from "./ledgerOperations";

/**
 * Penjurnalan otomatis dari catatan operasional.
 *
 * Dijalankan sebagai proses terpisah, bukan disisipkan ke dalam `completeTransaction`. Alasannya
 * bukan kemudahan: penyelesaian bon adalah jalur paling sensitif di sistem ini — dua sisi kas,
 * stok pecahan, dan saldo bank bergerak di dalam satu transaksi basis data — dan menambah
 * penulisan ke buku besar di sana berarti kegagalan pembukuan dapat menggagalkan penyelesaian bon
 * yang uangnya sudah berpindah tangan di meja kasir. Dipisah, pembukuan yang gagal cukup diulang.
 *
 * Idempoten lewat kunci unik `(sourceType, sourceReference)`: dijalankan ulang atas rentang yang
 * sama tidak menghasilkan jurnal ganda.
 */

export type PostingOutcome = {
  posted: { reference: string; entryNumber: string }[];
  alreadyPosted: string[];
  skipped: { reference: string; reason: string }[];
};

const emptyOutcome = (): PostingOutcome => ({ posted: [], alreadyPosted: [], skipped: [] });

const dbDate = (value: Date) => new Date(`${isoDay(value)}T00:00:00`);

type PostedSourceType = "TRANSAKSI_VALUTA" | "PENGELUARAN" | "MUTASI_KAS" | "MUTASI_BANK";

/** Rujukan sumber yang sudah pernah dijurnal, dibaca sekali di muka daripada ditabrakkan satu per satu. */
async function alreadyJournaled(sourceType: PostedSourceType, references: string[]) {
  if (!references.length) return new Set<string>();
  const db = await databaseOrThrow();
  const rows = await db
    .select({ sourceReference: journalEntries.sourceReference })
    .from(journalEntries)
    .where(and(eq(journalEntries.sourceType, sourceType), inArray(journalEntries.sourceReference, references)));
  return new Set(rows.map((row) => row.sourceReference).filter((value): value is string => Boolean(value)));
}

/**
 * Bon valuta yang sudah **selesai** — bukan yang sekadar disetujui.
 *
 * Data latihan dan data historis impor dikecualikan: keduanya bukan transaksi hidup, dan
 * memasukkannya ke buku besar akan membuat laporan keuangan memuat uang yang tidak pernah ada.
 */
export async function postExchangeTransactions(input: { from: Date; to: Date }, actor: { id: number }) {
  const db = await databaseOrThrow();
  const rows = await db
    .select()
    .from(exchangeTransactions)
    .where(
      and(
        eq(exchangeTransactions.status, "COMPLETED"),
        eq(exchangeTransactions.isDemo, false),
        eq(exchangeTransactions.isHistorical, false),
        gte(exchangeTransactions.transactionAt, dbDate(input.from)),
        lte(exchangeTransactions.transactionAt, new Date(`${isoDay(input.to)}T23:59:59`)),
      ),
    );

  const outcome = emptyOutcome();
  const done = await alreadyJournaled("TRANSAKSI_VALUTA", rows.map((row) => row.transactionNumber));

  for (const row of rows) {
    if (done.has(row.transactionNumber)) {
      outcome.alreadyPosted.push(row.transactionNumber);
      continue;
    }
    const mapped = mapExchangeTransaction({
      operation: row.operation,
      paymentMethod: row.paymentMethod,
      rupiahAmount: row.rupiahAmount,
      transactionNumber: row.transactionNumber,
    });
    if (isSkipped(mapped)) {
      outcome.skipped.push({ reference: row.transactionNumber, reason: mapped.skipped });
      continue;
    }
    const entry = await postJournalEntry(
      {
        entryDate: new Date(row.transactionAt),
        description: `${row.operation === "BUY" ? "Pembelian" : "Penjualan"} UKA — bon ${row.receiptNumber ?? row.transactionNumber}`,
        sourceType: "TRANSAKSI_VALUTA",
        sourceReference: row.transactionNumber,
        lines: mapped.lines,
      },
      actor,
    );
    outcome.posted.push({ reference: row.transactionNumber, entryNumber: entry.entryNumber });
  }
  return outcome;
}

export async function postExpenses(input: { from: Date; to: Date }, actor: { id: number }) {
  const db = await databaseOrThrow();
  const rows = await db
    .select()
    .from(operationalExpenses)
    .where(and(gte(operationalExpenses.expenseDate, dbDate(input.from)), lte(operationalExpenses.expenseDate, dbDate(input.to))));

  const outcome = emptyOutcome();
  const references = rows.map((row) => `EXP-${row.id}`);
  const done = await alreadyJournaled("PENGELUARAN", references);

  for (const row of rows) {
    const reference = `EXP-${row.id}`;
    if (done.has(reference)) {
      outcome.alreadyPosted.push(reference);
      continue;
    }
    const mapped = mapExpense({ category: row.category, amount: row.amount, description: row.description });
    if (isSkipped(mapped)) {
      outcome.skipped.push({ reference, reason: mapped.skipped });
      continue;
    }
    const entry = await postJournalEntry(
      {
        entryDate: new Date(row.expenseDate),
        description: `Pengeluaran — ${row.description}`,
        sourceType: "PENGELUARAN",
        sourceReference: reference,
        lines: mapped.lines,
      },
      actor,
    );
    outcome.posted.push({ reference, entryNumber: entry.entryNumber });
  }
  return outcome;
}

/**
 * Mutasi kas.
 *
 * Kebanyakan kategori sengaja dilewati — lihat `mapCashMovement`. Penanda "mutasi pertama untuk
 * mata uang ini" dihitung di sini, bukan di pemetaan, supaya pemetaannya tetap murni dan dapat
 * diuji tanpa basis data.
 */
export async function postCashMovements(input: { from: Date; to: Date }, actor: { id: number }) {
  const db = await databaseOrThrow();
  const rows = await db
    .select({
      id: cashBalanceMovements.id,
      cashBalanceId: cashBalanceMovements.cashBalanceId,
      category: cashBalanceMovements.category,
      amount: cashBalanceMovements.amount,
      reason: cashBalanceMovements.reason,
      createdAt: cashBalanceMovements.createdAt,
      currencyCode: currencies.code,
    })
    .from(cashBalanceMovements)
    .innerJoin(cashBalances, eq(cashBalances.id, cashBalanceMovements.cashBalanceId))
    .innerJoin(currencies, eq(currencies.id, cashBalances.currencyId))
    .where(
      and(
        gte(cashBalanceMovements.createdAt, dbDate(input.from)),
        lte(cashBalanceMovements.createdAt, new Date(`${isoDay(input.to)}T23:59:59`)),
      ),
    )
    .orderBy(cashBalanceMovements.id);

  const outcome = emptyOutcome();
  const done = await alreadyJournaled("MUTASI_KAS", rows.map((row) => `KAS-${row.id}`));

  // Satu kueri per saldo kas yang tersentuh, bukan per mutasi.
  const firstMovementIdByBalance = new Map<number, number>();
  for (const balanceId of new Set(rows.map((row) => row.cashBalanceId))) {
    const earliest = await db
      .select({ id: cashBalanceMovements.id })
      .from(cashBalanceMovements)
      .where(eq(cashBalanceMovements.cashBalanceId, balanceId))
      .orderBy(cashBalanceMovements.id)
      .limit(1);
    if (earliest[0]) firstMovementIdByBalance.set(balanceId, earliest[0].id);
  }

  for (const row of rows) {
    const reference = `KAS-${row.id}`;
    if (done.has(reference)) {
      outcome.alreadyPosted.push(reference);
      continue;
    }
    const mapped = mapCashMovement({
      category: row.category,
      amount: String(row.amount),
      currencyCode: row.currencyCode,
      reason: row.reason,
      isFirstMovementForCurrency: firstMovementIdByBalance.get(row.cashBalanceId) === row.id,
    });
    if (isSkipped(mapped)) {
      outcome.skipped.push({ reference, reason: mapped.skipped });
      continue;
    }
    const entry = await postJournalEntry(
      {
        entryDate: new Date(row.createdAt),
        description: `Mutasi kas — ${row.reason}`.slice(0, 500),
        sourceType: "MUTASI_KAS",
        sourceReference: reference,
        lines: mapped.lines,
      },
      actor,
    );
    outcome.posted.push({ reference, entryNumber: entry.entryNumber });
  }
  return outcome;
}

/**
 * Mutasi rekening bank.
 *
 * Sisi bank dari pemindahan kas↔bank sengaja dilewati: sisi kasnya sudah menjurnal pemindahan itu,
 * dan menjurnal keduanya akan menghitung uang yang sama dua kali.
 */
export async function postBankMovements(input: { from: Date; to: Date }, actor: { id: number }) {
  const db = await databaseOrThrow();
  const rows = await db
    .select({
      id: bankAccountMovements.id,
      category: bankAccountMovements.category,
      direction: bankAccountMovements.direction,
      amount: bankAccountMovements.amount,
      reason: bankAccountMovements.reason,
      createdAt: bankAccountMovements.createdAt,
      currencyCode: currencies.code,
    })
    .from(bankAccountMovements)
    .innerJoin(bankAccounts, eq(bankAccounts.id, bankAccountMovements.bankAccountId))
    .innerJoin(currencies, eq(currencies.id, bankAccounts.currencyId))
    .where(
      and(
        gte(bankAccountMovements.createdAt, dbDate(input.from)),
        lte(bankAccountMovements.createdAt, new Date(`${isoDay(input.to)}T23:59:59`)),
      ),
    )
    .orderBy(bankAccountMovements.id);

  const outcome = emptyOutcome();
  const done = await alreadyJournaled("MUTASI_BANK", rows.map((row) => `BANK-${row.id}`));

  for (const row of rows) {
    const reference = `BANK-${row.id}`;
    if (done.has(reference)) {
      outcome.alreadyPosted.push(reference);
      continue;
    }
    const mapped = mapBankMovement({
      category: row.category,
      direction: row.direction,
      amount: String(row.amount),
      currencyCode: row.currencyCode,
      reason: row.reason,
    });
    if (isSkipped(mapped)) {
      outcome.skipped.push({ reference, reason: mapped.skipped });
      continue;
    }
    const entry = await postJournalEntry(
      {
        entryDate: new Date(row.createdAt),
        description: `Mutasi bank — ${row.reason}`.slice(0, 500),
        sourceType: "MUTASI_BANK",
        sourceReference: reference,
        lines: mapped.lines,
      },
      actor,
    );
    outcome.posted.push({ reference, entryNumber: entry.entryNumber });
  }
  return outcome;
}

/**
 * Menjurnal seluruh sumber yang sudah terpetakan pada satu rentang tanggal.
 *
 * Idempoten: dijalankan ulang atas rentang yang sama menghasilkan `alreadyPosted`, bukan jurnal
 * ganda. Kategori mutasi yang sengaja tidak dijurnal dikembalikan pada `skipped` beserta alasannya,
 * supaya operator dapat melihat apa yang tidak masuk buku besar dan mengapa.
 */
export async function postOperationsToLedger(input: { from: Date; to: Date }, actor: { id: number }) {
  if (input.from > input.to) throw new Error("Tanggal mulai tidak boleh melewati tanggal akhir.");

  const transactions = await postExchangeTransactions(input, actor);
  const expenses = await postExpenses(input, actor);
  const cashMovements = await postCashMovements(input, actor);
  const bankMovements = await postBankMovements(input, actor);
  const parts = [transactions, expenses, cashMovements, bankMovements];

  const summary = {
    from: isoDay(input.from),
    to: isoDay(input.to),
    transactions,
    expenses,
    cashMovements,
    bankMovements,
    postedCount: parts.reduce((total, part) => total + part.posted.length, 0),
    alreadyPostedCount: parts.reduce((total, part) => total + part.alreadyPosted.length, 0),
    skippedCount: parts.reduce((total, part) => total + part.skipped.length, 0),
  };

  await writeAudit({
    actorUserId: actor.id,
    action: "LEDGER_AUTO_POSTED",
    entityType: "journal_entries",
    entityId: "*",
    afterState: {
      from: summary.from,
      to: summary.to,
      posted: summary.postedCount,
      alreadyPosted: summary.alreadyPostedCount,
      skipped: summary.skippedCount,
    },
  });
  return summary;
}
