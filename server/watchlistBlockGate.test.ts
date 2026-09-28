import { afterEach, describe, expect, it, vi } from "vitest";
import { attemptedTransactions, currencies, customers, exchangeTransactions, watchlistBlocks } from "../drizzle/schema";
import * as db from "./db";
import { createTransaction } from "./operations";

function chain(rows: unknown[]): any {
  const self = { from: () => self, where: () => self, orderBy: () => self, limit: () => self, innerJoin: () => self,
    then: (ok: any, ko: any) => Promise.resolve(rows).then(ok, ko) };
  return self;
}
function mockDb(rowsByTable: Map<unknown, unknown[]>) {
  const inserted: { table: unknown; values: any }[] = [];
  const fakeDb = {
    select: () => ({ from: (table: unknown) => chain(rowsByTable.get(table) ?? []) }),
    insert: (table: unknown) => ({ values: async (values: unknown) => { inserted.push({ table, values }); } }),
    transaction: vi.fn(async () => { throw new Error("bon tidak boleh sampai ke transaksi basis data"); }),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { inserted, fakeDb };
}

const customer = { id: 1, isDemo: false, isHistorical: false, profileStatus: "ACTIVE", fullName: "Abdul", riskLevel: "LOW", highRiskDecision: "BELUM" };
const input = {
  operation: "BUY" as const, customerId: 1, receiptNumber: "77",
  lines: [{ currencyId: 2, denominations: [{ value: "100", quantity: 2, rate: "16000" }] }],
  paymentMethod: "CASH" as const, transactionAt: new Date("2026-09-28T03:00:00Z"),
};
const openBlock = { id: 5, customerId: 1, status: "OPEN", matchKeys: null };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createTransaction — nasabah terblokir", () => {
  it("menolak dengan pesan netral dan mencatat percobaan, tanpa membuka transaksi bon", async () => {
    const { inserted, fakeDb } = mockDb(new Map<unknown, unknown[]>([[customers, [customer]], [watchlistBlocks, [openBlock]], [currencies, [{ id: 2, code: "USD" }]]]));
    await expect(createTransaction(input as never, 9)).rejects.toThrow("Transaksi tidak dapat diproses. Hubungi Controller. Jangan sampaikan alasannya kepada nasabah.");
    const attempt = inserted.find((row) => row.table === attemptedTransactions)!;
    expect(attempt.values).toMatchObject({ blockId: 5, customerId: 1, blockedParty: "NASABAH", tellerUserId: 9, operation: "BUY", totalIdr: "3200000.00" });
    expect(inserted.every((row) => row.table === attemptedTransactions)).toBe(true);
    expect(fakeDb.transaction).not.toHaveBeenCalled();
  });

  it("persetujuan risiko tinggi tidak meloloskan nasabah terblokir", async () => {
    const approved = { ...customer, riskLevel: "HIGH", highRiskDecision: "DISETUJUI", dttotPpsdmMatch: true };
    const { inserted } = mockDb(new Map<unknown, unknown[]>([[customers, [approved]], [watchlistBlocks, [{ ...openBlock, status: "CONFIRMED" }]], [currencies, []]]));
    await expect(createTransaction(input as never, 9)).rejects.toThrow(/Hubungi Controller/);
    expect(inserted).toHaveLength(1);
  });

  it("pihak kuasa terblokir, nasabah bersih → tetap ditolak dengan blockedParty KUASA", async () => {
    const representative = { ...customer, id: 2 };
    const rows = new Map<unknown, unknown[]>([[customers, [customer, representative]], [watchlistBlocks, [{ ...openBlock, customerId: 2 }]], [currencies, []]]);
    const { inserted } = mockDb(rows);
    await expect(createTransaction({ ...input, customerActingAs: "REPRESENTATIVE", representativeCustomerId: 2 } as never, 9)).rejects.toThrow(/Hubungi Controller/);
    expect(inserted[0].values).toMatchObject({ blockedParty: "KUASA", representativeCustomerId: 2 });
  });

  it("blokir FALSE_POSITIVE tidak menahan (galat berikutnya bukan pesan blokir)", async () => {
    mockDb(new Map<unknown, unknown[]>([[customers, [customer]], [watchlistBlocks, [{ ...openBlock, status: "FALSE_POSITIVE" }]], [exchangeTransactions, []], [currencies, []]]));
    await expect(createTransaction({ ...input, lines: [] } as never, 9)).rejects.toThrow(/minimal satu baris/);
  });

  it("penulisan percobaan gagal → bon tetap ditolak dengan pesan netral, kegagalannya ke log server", async () => {
    const { fakeDb } = mockDb(new Map<unknown, unknown[]>([[customers, [customer]], [watchlistBlocks, [openBlock]], [currencies, []]]));
    (fakeDb as { insert: unknown }).insert = () => ({ values: async () => { throw new Error("basis data tumbang"); } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createTransaction(input as never, 9)).rejects.toThrow(/Hubungi Controller/);
    expect(logged).toHaveBeenCalled();
    expect(fakeDb.transaction).not.toHaveBeenCalled();
  });
});
