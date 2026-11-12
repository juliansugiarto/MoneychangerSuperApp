import { and, eq, ne } from "drizzle-orm";
import { currencies } from "../drizzle/schema";
import { checkCurrencyOrder } from "../shared/currencyOrder";
import { databaseOrThrow, writeAudit } from "./operations";

/**
 * Penulis urutan papan (layar Kurs → "Atur urutan", ADMIN ke atas). Menerima daftar lengkap valuta aktif selain IDR
 * dalam urutan baru; urutan 1..n ditulis dalam satu transaksi, lalu dicatat di audit sesudahnya (audit tidak boleh
 * memakai sambungan kedua di dalam transaksi permintaan).
 */
export async function reorderCurrencies(currencyIds: number[], actorUserId: number) {
  const db = await databaseOrThrow();
  const active = await db.select({ id: currencies.id, code: currencies.code, boardOrder: currencies.boardOrder })
    .from(currencies).where(and(eq(currencies.active, true), ne(currencies.code, "IDR")));
  const checked = checkCurrencyOrder(currencyIds, active.map((row) => row.id));
  if (!checked.ok) throw new Error(checked.error);
  await db.transaction(async (tx) => {
    for (const [index, id] of currencyIds.entries()) await tx.update(currencies).set({ boardOrder: index + 1 }).where(eq(currencies.id, id));
  });
  const codeById = new Map(active.map((row) => [row.id, row.code]));
  const before = [...active].sort((a, b) => (a.boardOrder ?? 1e9) - (b.boardOrder ?? 1e9) || a.code.localeCompare(b.code)).map((row) => row.code);
  await writeAudit({ actorUserId, action: "CURRENCY_BOARD_ORDER_UPDATED", entityType: "currency", entityId: "board-order", beforeState: { order: before }, afterState: { order: currencyIds.map((id) => codeById.get(id)) } });
  return { saved: currencyIds.length };
}
