import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { accountingPeriods, cashBalances, cashDenominationBalances, exchangeTransactions, journalEntries, journalEntryLines, regulatoryReportPackages } from "../drizzle/schema";
import { closeAccountingPeriod } from "./ledgerOperations";
import { ensureChartOfAccounts } from "./ledgerOperations";
import { postExchangeTransactions, reversalReference } from "./ledgerPosting";
import { createInternalUser } from "./db";
import { hashPassword } from "./internalAuth";
import { cancelTransaction, createCustomer, createTransaction, databaseOrThrow, ensureCurrency, recordOpeningCash, submitTransaction } from "./operations";
import { runWithTenant, type TenantBinding } from "./tenantContext";
import { createScratchDatabase } from "./testing/scratchDatabase";
import { reverseTransaction } from "./transactionReversal";
import { v1Fixtures } from "./v1Fixtures";

/**
 * Pembalikan bon terhadap MySQL sungguhan, lewat penulis sungguhan: kas awal → bon → selesai → dibalik.
 * Basis data sekali pakai `mc_uji_pembalikan_bon` (bukan moneychanger/abcvalas).
 */
let binding: TenantBinding;
const inTenant = <T,>(fn: () => Promise<T>) => runWithTenant(binding, fn);
let controller: { id: number; role: "CONTROLLER" };
let staff: { id: number; role: "STAFF" };
let usdId = 0;
let idrId = 0;
let customerId = 0;
let receipt = 0;

async function balances() {
  const db = await databaseOrThrow();
  const cash = await db.select().from(cashBalances);
  const notes = await db.select().from(cashDenominationBalances);
  const amount = (currencyId: number) => String(cash.find((row) => row.currencyId === currencyId)?.availableAmount ?? "0");
  const count = (currencyId: number, value: string) => notes.find((row) => row.currencyId === currencyId && Number(row.denominationValue) === Number(value))?.quantity ?? 0;
  return { amount, count };
}

async function completedBon(operation: "BUY" | "SELL", usdNotes: number, rupiahNotes: { value: string; quantity: number }[]) {
  receipt += 1;
  const created = await createTransaction({
    operation, customerId, receiptNumber: `UJI-BALIK-${receipt}`, paymentMethod: "CASH", transactionAt: new Date(),
    lines: [{ currencyId: usdId, denominations: [{ value: "100", quantity: usdNotes, rate: "16000" }] }],
    paymentDenominations: rupiahNotes,
  } as never, staff.id);
  await submitTransaction(created.id, staff);
  const db = await databaseOrThrow();
  const row = (await db.select().from(exchangeTransactions).where(eq(exchangeTransactions.id, created.id)).limit(1))[0]!;
  expect(row.status).toBe("COMPLETED");
  return row;
}

beforeAll(async () => {
  ({ binding } = await createScratchDatabase("mc_uji_pembalikan_bon"));
  await inTenant(async () => {
    const password = await hashPassword("Uji-pembalikan-2026");
    controller = { id: (await createInternalUser({ username: "controller.balik", passwordHash: password, name: "Controller Uji", role: "CONTROLLER", mustChangePassword: false }))!.id, role: "CONTROLLER" };
    staff = { id: (await createInternalUser({ username: "kasir.balik", passwordHash: password, name: "Kasir Uji", role: "STAFF", mustChangePassword: false }))!.id, role: "STAFF" };
    usdId = (await ensureCurrency({ code: "USD", name: "Dolar Amerika" })).id;
    idrId = (await ensureCurrency({ code: "IDR", name: "Rupiah" })).id;
    await recordOpeningCash({ currencyId: usdId, openingAmount: "1", denominations: [{ value: "1", quantity: 1 }] }, controller);
    await recordOpeningCash({ currencyId: idrId, openingAmount: "10000000", denominations: [{ value: "100000", quantity: 100 }] }, controller);
    customerId = (await createCustomer(v1Fixtures.customer as never, controller.id)).id;
    await ensureChartOfAccounts(controller);
  });
}, 180_000);

describe("membalik bon selesai", () => {
  it("BELI tunai lalu dibalik: kas valas, kas Rupiah, dan lembar kembali persis ke keadaan awal", async () => {
    await inTenant(async () => {
      const before = await balances();
      const bon = await completedBon("BUY", 2, [{ value: "100000", quantity: 32 }]);
      const during = await balances();
      expect(during.count(usdId, "100")).toBe(before.count(usdId, "100") + 2);
      expect(during.count(idrId, "100000")).toBe(before.count(idrId, "100000") - 32);

      await expect(reverseTransaction(bon.id, "salah input jumlah lembar", staff as never)).rejects.toThrow(/Controller/);
      const reversed = await reverseTransaction(bon.id, "salah input jumlah lembar", controller);
      expect(reversed.status).toBe("REVERSED");

      const after = await balances();
      expect(after.amount(usdId)).toBe(before.amount(usdId));
      expect(after.amount(idrId)).toBe(before.amount(idrId));
      expect(after.count(usdId, "100")).toBe(before.count(usdId, "100"));
      expect(after.count(idrId, "100000")).toBe(before.count(idrId, "100000"));

      await expect(reverseTransaction(bon.id, "salah input jumlah lembar", controller)).rejects.toThrow(/sudah dibalik/);
      // Bon yang sudah dibalik tidak bisa "dibatalkan" lewat API: itu akan menimpa status dan menghapus jurnal baliknya.
      await expect(cancelTransaction(bon.id, "coba batalkan", controller)).rejects.toThrow(/dibalik/);
    });
  }, 60_000);

  it("menolak membalik BELI bila lembar valasnya sudah terjual lagi", async () => {
    await inTenant(async () => {
      const buy = await completedBon("BUY", 2, [{ value: "100000", quantity: 32 }]);
      await completedBon("SELL", 2, [{ value: "100000", quantity: 32 }]);
      const before = await balances();
      await expect(reverseTransaction(buy.id, "salah input jumlah lembar", controller)).rejects.toThrow(/tidak cukup|melebihi saldo/);
      const after = await balances();
      expect(after.amount(idrId)).toBe(before.amount(idrId));
      const db = await databaseOrThrow();
      expect((await db.select().from(exchangeTransactions).where(eq(exchangeTransactions.id, buy.id)).limit(1))[0]!.status).toBe("COMPLETED");
    });
  }, 60_000);

  it("dua pembalikan bersamaan atas bon yang sama: hanya satu yang berhasil", async () => {
    await inTenant(async () => {
      const before = await balances();
      const bon = await completedBon("BUY", 1, [{ value: "100000", quantity: 16 }]);
      const results = await Promise.allSettled([1, 2].map(() => reverseTransaction(bon.id, "pembalikan ganda bersamaan", controller)));
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const after = await balances();
      expect(after.amount(idrId)).toBe(before.amount(idrId));
      expect(after.count(usdId, "100")).toBe(before.count(usdId, "100"));
    });
  }, 60_000);

  it("bon yang sudah dijurnal: batch menulis jurnal balik yang seimbang; bon yang dibalik sebelum dijurnal tidak dijurnal sama sekali", async () => {
    await inTenant(async () => {
      const today = new Date();
      const window = { from: today, to: today };
      const journaled = await completedBon("BUY", 1, [{ value: "100000", quantity: 16 }]);
      const first = await postExchangeTransactions(window, controller);
      expect(first, JSON.stringify(first)).toMatchObject({ posted: expect.arrayContaining([expect.objectContaining({ reference: journaled.transactionNumber })]) });

      await reverseTransaction(journaled.id, "salah pilih nasabah pada bon", controller);
      const db0 = await databaseOrThrow();
      const [period] = await db0.select().from(accountingPeriods).limit(1);
      await expect(closeAccountingPeriod({ periodId: period!.id }, controller)).rejects.toThrow(/belum dijurnal baliknya/);
      const neverJournaled = await completedBon("BUY", 1, [{ value: "100000", quantity: 16 }]);
      await reverseTransaction(neverJournaled.id, "salah pilih nasabah pada bon", controller);

      const second = await postExchangeTransactions(window, controller);
      expect(second.posted.map((entry) => entry.reference)).toEqual([reversalReference(journaled.transactionNumber)]);
      expect(second.skipped.map((entry) => entry.reference)).toContain(neverJournaled.transactionNumber);

      const db = await databaseOrThrow();
      const [original] = await db.select().from(journalEntries).where(eq(journalEntries.sourceReference, journaled.transactionNumber));
      const [reversal] = await db.select().from(journalEntries).where(eq(journalEntries.sourceReference, reversalReference(journaled.transactionNumber)));
      const originalLines = await db.select().from(journalEntryLines).where(eq(journalEntryLines.entryId, original!.id));
      const reversalLines = await db.select().from(journalEntryLines).where(eq(journalEntryLines.entryId, reversal!.id));
      // Setiap akun asli kembali ke nol: jumlah sama, sisi berlawanan.
      for (const line of originalLines) {
        expect(reversalLines.find((other) => other.accountCode === line.accountCode && other.amount === line.amount && other.side !== line.side)).toBeTruthy();
      }
      expect(String(reversal!.entryDate)).toBe(String(original!.entryDate));

      const third = await postExchangeTransactions(window, controller);
      expect(third.posted).toHaveLength(0);
    });
  }, 60_000);

  it("menolak membalik bila buku bulannya sudah ditutup atau LKU periodenya sudah ada", async () => {
    await inTenant(async () => {
      const db = await databaseOrThrow();
      const bon = await completedBon("BUY", 1, [{ value: "100000", quantity: 16 }]);

      const [period] = await db.select().from(accountingPeriods).limit(1);
      await db.update(accountingPeriods).set({ status: "DITUTUP" }).where(eq(accountingPeriods.id, period!.id));
      await expect(reverseTransaction(bon.id, "salah input jumlah lembar", controller)).rejects.toThrow(/sudah ditutup/);
      await db.update(accountingPeriods).set({ status: "TERBUKA" }).where(eq(accountingPeriods.id, period!.id));

      const dayStart = new Date(Date.now() - 86_400_000);
      await db.insert(regulatoryReportPackages).values({
        packageNumber: `REG-LKU-UJI-${Date.now()}`, reportType: "LKU", status: "PREPARED", periodStart: dayStart, periodEnd: new Date(Date.now() + 86_400_000),
        dataSnapshot: {}, validationSummary: {}, sourceDigest: "uji", createdByUserId: controller.id,
      });
      await expect(reverseTransaction(bon.id, "salah input jumlah lembar", controller)).rejects.toThrow(/LKU/);
      expect((await db.select().from(exchangeTransactions).where(eq(exchangeTransactions.id, bon.id)).limit(1))[0]!.status).toBe("COMPLETED");
    });
  }, 60_000);
});
