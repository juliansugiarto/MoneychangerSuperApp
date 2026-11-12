import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { cashBalances, cashDenominationBalances, currencies, users } from "../drizzle/schema";
import { getDb } from "./db";
import { ensureDevelopmentTestAccounts } from "./internalAuth";
import { ENV } from "./_core/env";
import { recordCashAdjustment } from "./operations";

/**
 * Penguncian saldo kas terhadap MySQL sungguhan (REPEATABLE READ bawaan InnoDB).
 *
 * Tiruan tabel tidak bisa membuktikan ini: kesalahannya hanya muncul bila dua transaksi basis data
 * berjalan bersamaan dan yang menunggu kunci membaca saldo dari snapshot lamanya. Memakai valuta uji
 * ISO `XTS` agar saldo valuta sungguhan di basis data pengembangan tidak tersentuh.
 */
const runnable = Boolean(process.env.DATABASE_URL);
const TEST_CODE = "XTS";

describe.skipIf(!runnable)("saldo kas di bawah penulisan bersamaan", () => {
  let currencyId = 0;
  let actorId = 0;

  beforeAll(async () => {
    ENV.cookieSecret ||= "test-session-secret-for-cash-locking-2026";
    await ensureDevelopmentTestAccounts();
    const db = (await getDb())!;
    await db.insert(currencies).values({ code: TEST_CODE, name: "Valuta uji penguncian", active: true }).onDuplicateKeyUpdate({ set: { active: true } });
    currencyId = (await db.select().from(currencies).where(eq(currencies.code, TEST_CODE)).limit(1))[0]!.id;
    actorId = (await db.select().from(users).where(eq(users.username, "test-controller")).limit(1))[0]!.id;
  }, 20000);

  async function resetBalance() {
    const db = (await getDb())!;
    await db.insert(cashBalances).values({ currencyId, availableAmount: "0.000000" }).onDuplicateKeyUpdate({ set: { availableAmount: "0.000000" } });
    await db.delete(cashDenominationBalances).where(eq(cashDenominationBalances.currencyId, currencyId));
  }

  it("lima penarikan brankas bersamaan menjumlah semuanya, tanpa ada yang tertimpa", async () => {
    await resetBalance();
    const actor = { id: actorId, role: "CONTROLLER" as const };
    await Promise.all(Array.from({ length: 5 }, (_, index) => recordCashAdjustment({
      currencyId, category: "SAFE_WITHDRAWAL", amount: "100", notes: `uji penguncian ${index}`,
      denominations: [{ value: "100", quantity: 1 }],
    }, actor)));

    const db = (await getDb())!;
    const balance = (await db.select().from(cashBalances).where(eq(cashBalances.currencyId, currencyId)).limit(1))[0]!;
    const notes = (await db.select().from(cashDenominationBalances).where(and(eq(cashDenominationBalances.currencyId, currencyId), eq(cashDenominationBalances.denominationValue, "100.000000"))).limit(1))[0];
    // Saldo agregat dan stok pecahan harus bercerita sama: 5 lembar × 100.
    expect(String(balance.availableAmount)).toBe("500.000000");
    expect(notes?.quantity).toBe(5);
  }, 30000);
});
