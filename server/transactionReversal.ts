import Decimal from "decimal.js";
import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import {
  bankAccountMovements,
  bankAccounts,
  cashBalanceMovements,
  cashBalances,
  cashDenominationEntries,
  exchangeTransactions,
  regulatoryReportPackages,
  stockOpnames,
  type StaffRole,
} from "../drizzle/schema";
import { operationalDateKey } from "../shared/regulatoryActionQueue";
import { applyCashMovement, databaseOrThrow, jakartaBusinessDateColumn, writeAudit } from "./operations";
import { isBookClosedOn } from "./transactionTime";

/**
 * Pembalikan bon COMPLETED (keputusan pemilik 12 November 2026; rancangan
 * `docs/superpowers/specs/2026-11-12-pembalikan-bon-design.md`).
 *
 * Yang dibalik adalah **mutasi yang benar-benar diposting** saat bon diselesaikan — kaki valas per baris,
 * kaki Rupiah tunai, dan kaki rekening bank — masing-masing dengan arah berlawanan dan rincian pecahan
 * aslinya. Dengan begitu kedua kaki tidak mungkin dibalik setengah, dan stok tidak bisa minus (pengeluaran
 * lembar lewat `applyCashMovement` menolak bila lembarnya sudah tidak ada).
 *
 * Jurnal tidak ditulis di sini: penjurnalan bon memang berjalan lewat batch Controller. Batch itu menjurnal
 * balik bon REVERSED yang jurnal aslinya sudah ada (`postExchangeReversals`), dan melewati bon REVERSED
 * yang belum pernah dijurnal.
 */
export const REVERSAL_ROLES: StaffRole[] = ["CONTROLLER", "SHAREHOLDER"];

export async function reverseTransaction(transactionId: number, reason: string, actor: { id: number; role: StaffRole }) {
  if (!REVERSAL_ROLES.includes(actor.role)) throw new Error("Hanya Controller atau pemilik yang bisa membalik transaksi selesai.");
  const note = reason.trim();
  if (note.length < 10) throw new Error("Tulis alasan pembalikan (minimal 10 karakter) untuk jejak audit.");

  const db = await databaseOrThrow();
  const preview = (await db.select().from(exchangeTransactions).where(eq(exchangeTransactions.id, transactionId)).limit(1))[0];
  if (!preview || preview.isDemo || preview.isHistorical) throw new Error("Transaksi tidak ditemukan.");
  await assertPeriodStillOpen(new Date(preview.transactionAt));

  return db.transaction(async (tx) => {
    // Bon dikunci lebih dulu, urutan kunci sama dengan penyelesaian: pembalikan ganda bersamaan menunggu,
    // lalu melihat status REVERSED dan ditolak.
    const transaction = (await tx.select().from(exchangeTransactions).where(eq(exchangeTransactions.id, transactionId)).limit(1).for("update"))[0];
    if (!transaction) throw new Error("Transaksi tidak ditemukan.");
    if (transaction.status === "REVERSED") throw new Error("Transaksi ini sudah dibalik.");
    if (transaction.status !== "COMPLETED") throw new Error("Hanya transaksi yang sudah selesai yang bisa dibalik. Yang belum selesai cukup dibatalkan.");

    const label = transaction.receiptNumber ?? transaction.transactionNumber;
    const reversalReason = `PEMBALIKAN ${label}: ${note}`;

    const cashMovements = await tx.select({ movement: cashBalanceMovements, currencyId: cashBalances.currencyId })
      .from(cashBalanceMovements).innerJoin(cashBalances, eq(cashBalanceMovements.cashBalanceId, cashBalances.id))
      // Mutasi bon lama tersimpan berkategori bawaan OTHER, yang baru TRANSACTION; pengenalnya adalah transactionId.
      .where(eq(cashBalanceMovements.transactionId, transaction.id))
      .orderBy(asc(cashBalanceMovements.id));
    const originalCash = cashMovements.filter(({ movement }) => movement.direction !== "ADJUSTMENT" && !movement.reason.startsWith("PEMBALIKAN"));
    const entries = originalCash.length
      ? await tx.select().from(cashDenominationEntries).where(inArray(cashDenominationEntries.cashBalanceMovementId, originalCash.map(({ movement }) => movement.id)))
      : [];

    const reversedCash: { currencyId: number; before: string; after: string }[] = [];
    for (const { movement, currencyId } of originalCash) {
      const direction = movement.direction === "IN" ? "OUT" as const : "IN" as const;
      const denominationRows = entries.filter((entry) => entry.cashBalanceMovementId === movement.id)
        .map((entry) => ({ denominationValue: String(entry.denominationValue), quantity: entry.quantity, subtotal: String(entry.subtotal) }));
      const applied = await applyCashMovement(tx, {
        currencyId, direction, amount: new Decimal(String(movement.amount)), category: "TRANSACTION",
        reason: reversalReason, denominationRows, actorUserId: actor.id, transactionId: transaction.id,
      });
      reversedCash.push({ currencyId, before: applied.before, after: applied.after });
      // Kaki valas per baris menambah pembelian/penjualan opname hari penyelesaiannya; kurangi lagi selama
      // opname itu masih terbuka. Opname yang sudah ditutup tidak disunting — mutasi baliknya terlihat sendiri.
      if (movement.transactionLineId != null) await undoOpnameTally(tx, transaction.operation, currencyId, movement.createdAt, String(movement.amount));
    }

    const bankLegs = await tx.select().from(bankAccountMovements)
      .where(and(eq(bankAccountMovements.transactionId, transaction.id), eq(bankAccountMovements.category, "TRANSACTION")))
      .orderBy(asc(bankAccountMovements.id));
    let reversedBank: { bankAccountId: number; before: string; after: string } | null = null;
    for (const leg of bankLegs.filter((row) => !row.reason.startsWith("PEMBALIKAN"))) {
      const account = (await tx.select().from(bankAccounts).where(eq(bankAccounts.id, leg.bankAccountId)).limit(1).for("update"))[0];
      if (!account) throw new Error("Rekening bank transaksi ini tidak ditemukan.");
      const direction = leg.direction === "IN" ? "OUT" as const : "IN" as const;
      const amount = new Decimal(String(leg.amount));
      const before = new Decimal(String(account.availableAmount));
      if (direction === "OUT" && before.lt(amount)) throw new Error("Saldo rekening tidak cukup untuk mengembalikan dana transaksi ini.");
      const after = direction === "OUT" ? before.minus(amount) : before.plus(amount);
      await tx.update(bankAccounts).set({ availableAmount: after.toFixed(6) }).where(eq(bankAccounts.id, account.id));
      await tx.insert(bankAccountMovements).values({
        bankAccountId: account.id, transactionId: transaction.id, transactionLineId: null, direction, amount: amount.toFixed(6),
        reason: reversalReason.slice(0, 255), category: "TRANSACTION", createdByUserId: actor.id,
      });
      reversedBank = { bankAccountId: account.id, before: before.toFixed(6), after: after.toFixed(6) };
    }

    const reversedAt = new Date();
    const updated = await tx.update(exchangeTransactions)
      .set({ status: "REVERSED", reversedByUserId: actor.id, reversedAt, reversalReason: note })
      .where(and(eq(exchangeTransactions.id, transaction.id), eq(exchangeTransactions.status, "COMPLETED")));
    if (Number((updated as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0) !== 1) throw new Error("Transaksi ini baru saja berubah status. Muat ulang lalu periksa lagi.");

    await writeAudit({
      actorUserId: actor.id, action: "TRANSACTION_REVERSED", entityType: "exchange_transaction", entityId: String(transaction.id),
      beforeState: { status: "COMPLETED" }, afterState: { status: "REVERSED", reversedCash, reversedBank }, reason: note,
      metadata: { transactionNumber: transaction.transactionNumber, cashLegs: originalCash.length, bankLegs: bankLegs.length },
    }, tx);
    return { ...transaction, status: "REVERSED" as const, reversedAt, reversedByUserId: actor.id, reversalReason: note, reversedCash, reversedBank };
  });
}

/** Buku bulannya harus masih terbuka dan LKU yang memuat tanggal bon belum disiapkan (keputusan pemilik 12 Nov 2026). */
async function assertPeriodStillOpen(transactionAt: Date) {
  const dateKey = operationalDateKey(transactionAt);
  if (await isBookClosedOn(dateKey)) throw new Error(`Buku tanggal ${dateKey} sudah ditutup, jadi transaksinya tidak bisa dibalik.`);
  const db = await databaseOrThrow();
  const lku = await db.select({ id: regulatoryReportPackages.id }).from(regulatoryReportPackages).where(and(
    eq(regulatoryReportPackages.reportType, "LKU"),
    inArray(regulatoryReportPackages.status, ["PREPARED", "APPROVED", "EXPORTED"]),
    lte(regulatoryReportPackages.periodStart, transactionAt),
    gt(regulatoryReportPackages.periodEnd, transactionAt),
  )).limit(1);
  if (lku.length) throw new Error("Laporan LKU periode transaksi ini sudah disiapkan, jadi transaksinya tidak bisa dibalik.");
}

async function undoOpnameTally(tx: any, operation: "BUY" | "SELL", currencyId: number, completedAt: Date, amount: string) {
  const opnameDate = jakartaBusinessDateColumn(new Date(completedAt));
  const column = operation === "BUY" ? stockOpnames.purchases : stockOpnames.sales;
  await tx.update(stockOpnames).set(operation === "BUY" ? { purchases: sql`${column} - ${amount}` } : { sales: sql`${column} - ${amount}` })
    .where(and(eq(stockOpnames.opnameDate, opnameDate), eq(stockOpnames.currencyId, currencyId), eq(stockOpnames.reconciliationStatus, "OPEN"), eq(stockOpnames.isDemo, false), eq(stockOpnames.isHistorical, false)));
}
