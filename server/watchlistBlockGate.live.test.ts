import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { attemptedTransactions, cashBalances, exchangeTransactions, watchlistBlocks } from "../drizzle/schema";
import { WATCHLIST_BLOCK_TELLER_MESSAGE } from "../shared/watchlistBlock";
import { createInternalUser } from "./db";
import { hashPassword } from "./internalAuth";
import { createCustomer, createTransaction, databaseOrThrow, ensureCurrency, recordOpeningCash, submitTransaction } from "./operations";
import { runWithTenant, type TenantBinding } from "./tenantContext";
import { createScratchDatabase } from "./testing/scratchDatabase";
import { v1Fixtures } from "./v1Fixtures";
import { lockCustomerRows, openBlocksForScreenings, openOfficerBlock } from "./watchlistBlocks";

/**
 * Gerbang pemblokiran DTTOT/DPPSPM terhadap MySQL sungguhan (temuan M1 dan M2 reviu butir B). Basis data sekali pakai
 * `mc_uji_gerbang_blokir`. Membuktikan: bon yang dibuat sebelum nasabahnya diblokir tidak dapat diselesaikan sesudahnya;
 * pembuka blokir menunggu bon yang sedang memegang kunci nasabah; dua penyaringan serentak hanya membuka satu blokir.
 */
let binding: TenantBinding;
const inTenant = <T,>(fn: () => Promise<T>) => runWithTenant(binding, fn);
let controller: { id: number; role: "CONTROLLER" };
let staff: { id: number; role: "STAFF" };
let usdId = 0;
let idrId = 0;
const customer = async (suffix: string) => (await createCustomer({ ...v1Fixtures.customer, cifNumber: `UJI-GERBANG-${suffix}`, identityNumber: `31740000000${suffix.padStart(5, "0")}`, fullName: `Nasabah Gerbang ${suffix}` } as never, controller.id)).id;

beforeAll(async () => {
  ({ binding } = await createScratchDatabase("mc_uji_gerbang_blokir"));
  await inTenant(async () => {
    const password = await hashPassword("Uji-gerbang-2026");
    controller = { id: (await createInternalUser({ username: "controller.gerbang", passwordHash: password, name: "Controller Uji", role: "CONTROLLER", mustChangePassword: false }))!.id, role: "CONTROLLER" };
    staff = { id: (await createInternalUser({ username: "kasir.gerbang", passwordHash: password, name: "Kasir Uji", role: "STAFF", mustChangePassword: false }))!.id, role: "STAFF" };
    usdId = (await ensureCurrency({ code: "USD", name: "Dolar Amerika" })).id;
    idrId = (await ensureCurrency({ code: "IDR", name: "Rupiah" })).id;
    await recordOpeningCash({ currencyId: usdId, openingAmount: "1", denominations: [{ value: "1", quantity: 1 }] }, controller);
    await recordOpeningCash({ currencyId: idrId, openingAmount: "10000000", denominations: [{ value: "100000", quantity: 100 }] }, controller);
  });
}, 180_000);

describe("gerbang blokir sampai uang berpindah", () => {
  it("bon dibuat, lalu nasabahnya diblokir: penyelesaian ditolak, kas tidak bergerak, percobaan tercatat", async () => {
    await inTenant(async () => {
      const db = await databaseOrThrow();
      const customerId = await customer("1");
      const draft = await createTransaction({
        operation: "BUY", customerId, receiptNumber: "UJI-GERBANG-1", paymentMethod: "CASH", transactionAt: new Date(),
        lines: [{ currencyId: usdId, denominations: [{ value: "100", quantity: 2, rate: "16000" }] }],
        paymentDenominations: [{ value: "100000", quantity: 32 }],
      } as never, staff.id);
      const cashBefore = await db.select().from(cashBalances);
      expect(await openOfficerBlock(customerId)).toBe(true);

      await expect(submitTransaction(draft.id, staff)).rejects.toThrow(WATCHLIST_BLOCK_TELLER_MESSAGE);
      const [row] = await db.select().from(exchangeTransactions).where(eq(exchangeTransactions.id, draft.id));
      expect(row.status).not.toBe("COMPLETED");
      expect(await db.select().from(cashBalances)).toEqual(cashBefore);
      const attempts = await db.select().from(attemptedTransactions).where(eq(attemptedTransactions.customerId, customerId));
      expect(attempts).toHaveLength(1);
      // 2 lembar × USD 100 × 16.000, atas nama kasir pemilik bon.
      expect(Number(attempts[0].totalIdr)).toBe(3_200_000);
      expect(attempts[0].tellerUserId).toBe(staff.id);
    });
  });

  it("pembuka blokir menunggu bon yang memegang kunci nasabah; bon yang menang balapan sah", async () => {
    await inTenant(async () => {
      const db = await databaseOrThrow();
      const customerId = await customer("2");
      let saleCommittedAt = 0;
      const sale = db.transaction(async (tx) => {
        await lockCustomerRows(tx, [customerId], "share");
        await new Promise((resolve) => setTimeout(resolve, 600));
        saleCommittedAt = Date.now();
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const opened = openOfficerBlock(customerId).then((result) => ({ result, at: Date.now() }));
      const [, block] = await Promise.all([sale, opened]);
      expect(block.result).toBe(true);
      expect(block.at).toBeGreaterThanOrEqual(saleCommittedAt);
    });
  });

  it("blokir yang sedang ditulis menahan penyelesaian bon; bon lalu ditolak dan kas tidak bergerak", async () => {
    await inTenant(async () => {
      const db = await databaseOrThrow();
      const customerId = await customer("4");
      const draft = await createTransaction({
        operation: "BUY", customerId, receiptNumber: "UJI-GERBANG-4", paymentMethod: "CASH", transactionAt: new Date(),
        lines: [{ currencyId: usdId, denominations: [{ value: "100", quantity: 1, rate: "16000" }] }],
        paymentDenominations: [{ value: "100000", quantity: 16 }],
      } as never, staff.id);
      const cashBefore = await db.select().from(cashBalances);
      // Pembuka blokir memegang kunci eksklusif, menulis blokirnya, menahan 600 ms, lalu commit.
      const opener = db.transaction(async (tx) => {
        await lockCustomerRows(tx, [customerId], "update");
        await tx.insert(watchlistBlocks).values({ customerId, openedAt: new Date(), source: "PETUGAS", screeningId: null, matchKeys: null, status: "OPEN" });
        await new Promise((resolve) => setTimeout(resolve, 600));
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const completion = submitTransaction(draft.id, staff).then(() => "selesai", (error: Error) => error.message);
      await opener;
      expect(await completion).toBe(WATCHLIST_BLOCK_TELLER_MESSAGE);
      expect(await db.select().from(cashBalances)).toEqual(cashBefore);
    });
  });

  it("dua penyaringan serentak atas nasabah yang sama hanya membuka satu blokir", async () => {
    await inTenant(async () => {
      const db = await databaseOrThrow();
      const customerId = await customer("3");
      const row = { customerId, screeningId: null, matchKeys: ["DTTOT:UJI-SERENTAK-001"] };
      const opened = await Promise.all([openBlocksForScreenings([row]), openBlocksForScreenings([row])]);
      expect(opened.reduce((sum, count) => sum + count, 0)).toBe(1);
      expect(await db.select().from(watchlistBlocks).where(and(eq(watchlistBlocks.customerId, customerId), eq(watchlistBlocks.status, "OPEN")))).toHaveLength(1);
    });
  });
});
