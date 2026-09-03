import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { exchangeTransactions, journalEntries, operationalExpenses } from "../drizzle/schema";
import { isSkipped, mapExchangeTransaction, mapExpense } from "../shared/journalMapping";
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

/** Rujukan sumber yang sudah pernah dijurnal, dibaca sekali di muka daripada ditabrakkan satu per satu. */
async function alreadyJournaled(sourceType: "TRANSAKSI_VALUTA" | "PENGELUARAN", references: string[]) {
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
 * Menjurnal seluruh sumber yang sudah terpetakan pada satu rentang tanggal.
 *
 * Mutasi kas dan bank belum termasuk. Kategorinya — setor brankas, tarik brankas, penjualan di
 * luar jam, dan selisih kas awal — masing-masing menuntut keputusan kebijakan tersendiri, dan
 * sisi kas bon sudah terjurnal lewat bonnya sendiri sehingga menjurnal mutasinya sekaligus akan
 * menghitung uang yang sama dua kali.
 */
export async function postOperationsToLedger(input: { from: Date; to: Date }, actor: { id: number }) {
  if (input.from > input.to) throw new Error("Tanggal mulai tidak boleh melewati tanggal akhir.");

  const transactions = await postExchangeTransactions(input, actor);
  const expenses = await postExpenses(input, actor);

  const summary = {
    from: isoDay(input.from),
    to: isoDay(input.to),
    transactions,
    expenses,
    postedCount: transactions.posted.length + expenses.posted.length,
    alreadyPostedCount: transactions.alreadyPosted.length + expenses.alreadyPosted.length,
    skippedCount: transactions.skipped.length + expenses.skipped.length,
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
