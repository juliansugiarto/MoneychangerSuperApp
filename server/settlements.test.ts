import { describe, expect, it, vi } from "vitest";
import { bankAccounts, cashBalances, currencies, fixedAssets, ledgerSettlements, operationalExpenses } from "../drizzle/schema";
import * as db from "./db";
import { listOutstandingSettlements, recordSettlement } from "./settlements";

const controller = { id: 7, role: "CONTROLLER" as const };

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

const sewa = { id: 4, expenseDate: dbDay("2026-09-02"), amount: "1000000.00", description: "Sewa ruko September", category: "SEWA" };
const kendaraan = {
  id: 2, name: "Kendaraan operasional", acquisitionDate: dbDay("2026-09-01"), acquisitionCost: "24000000.00",
  acquisitionJournalEntryId: 55, status: "AKTIF", disposalDate: null, disposalProceeds: null, disposalJournalEntryId: null,
};

/**
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data.
 *
 * Fake ini merekam tulisan **beserta transaksinya**: mutasi kas yang tersimpan tanpa baris
 * `ledger_settlements` pendampingnya akan muncul sebagai arus kas "belum terklasifikasi" tanpa ada
 * yang tahu sebabnya, dan hanya transaksi yang mencegahnya — bukan urutan pemanggilan.
 */
function mockDb(options: { expenses?: unknown[]; assets?: unknown[]; settlements?: unknown[]; cash?: string; currencyCode?: string; bank?: unknown } = {}) {
  const queues = new Map<unknown, unknown[]>([
    [operationalExpenses, options.expenses ?? [sewa]],
    [fixedAssets, options.assets ?? [kendaraan]],
    [ledgerSettlements, options.settlements ?? []],
    [bankAccounts, options.bank ? [options.bank] : []],
    [currencies, [{ id: 1, code: options.currencyCode ?? "IDR", active: true }]],
    [cashBalances, [{ id: 1, currencyId: 1, availableAmount: options.cash ?? "50000000.000000" }]],
  ]);
  const transactions: { table: unknown; values: any }[][] = [];

  const chain = (rows: unknown[]): any => {
    const thenable = Promise.resolve(rows) as any;
    for (const method of ["where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy", "for"]) thenable[method] = () => chain(rows);
    return thenable;
  };
  const selectFrom = (table: unknown) => chain((queues.get(table) as unknown[]) ?? []);

  const txFor = (log: { table: unknown; values: any }[]) => ({
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => ({ from: selectFrom })),
    update: vi.fn((table: unknown) => ({ set: (values: any) => ({ where: () => { log.push({ table, values }); return Promise.resolve(); } }) })),
    insert: vi.fn((table: unknown) => ({
      values: (values: any) => {
        log.push({ table, values });
        return { $returningId: () => Promise.resolve([{ id: 31 }]), onDuplicateKeyUpdate: () => Promise.resolve(undefined) };
      },
    })),
  });

  const fakeDb = {
    select: vi.fn(() => ({ from: selectFrom })),
    insert: vi.fn(() => ({ values: () => Promise.resolve(undefined) })),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const log: { table: unknown; values: any }[] = [];
      const result = await callback(txFor(log));
      transactions.push(log);
      return result;
    }),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { transactions };
}

const pembayaranKas = {
  direction: "PEMBAYARAN" as const, targetType: "BEBAN" as const, expenseId: 4,
  amount: "400000", method: "KAS" as const, currencyId: 1,
  settlementDate: "2026-09-10", notes: "Pembayaran sewa ruko September",
  denominations: [{ value: "100000", quantity: 4 }],
};

describe("listOutstandingSettlements", () => {
  it("menghitung sisa tagihan beban sebagai nominal dikurangi pelunasannya", async () => {
    mockDb({ settlements: [{ targetType: "BEBAN", expenseId: 4, fixedAssetId: null, amount: "400000.00", direction: "PEMBAYARAN" }] });
    const { payables } = await listOutstandingSettlements();
    const beban = payables.find((row) => row.targetType === "BEBAN" && row.targetId === 4);
    expect(beban?.outstandingAmount).toBe("600000.00");
  });

  it("tidak menampilkan tagihan yang sudah lunas", async () => {
    mockDb({ settlements: [{ targetType: "BEBAN", expenseId: 4, fixedAssetId: null, amount: "1000000.00", direction: "PEMBAYARAN" }] });
    const { payables } = await listOutstandingSettlements();
    expect(payables.some((row) => row.targetType === "BEBAN" && row.targetId === 4)).toBe(false);
  });

  it("mengabaikan aset warisan, yang tidak pernah membentuk kewajiban 2-1900", async () => {
    // acquisitionJournalEntryId NULL berarti asetnya masuk lewat SALDO_AWAL, bukan lewat 2-1900.
    // Menagihkan pelunasan atasnya akan mendebit kewajiban yang tidak pernah ada.
    mockDb({ assets: [{ ...kendaraan, acquisitionJournalEntryId: null }] });
    const { payables } = await listOutstandingSettlements();
    expect(payables.some((row) => row.targetType === "ASET_TETAP")).toBe(false);
  });

  it("menampilkan hasil pelepasan yang belum ditagih sebagai piutang", async () => {
    mockDb({ assets: [{ ...kendaraan, status: "DILEPAS", disposalDate: dbDay("2026-09-20"), disposalProceeds: "2500000.00", disposalJournalEntryId: 77 }] });
    const { receivables } = await listOutstandingSettlements();
    expect(receivables[0]).toMatchObject({ targetType: "ASET_TETAP", targetId: 2, outstandingAmount: "2500000.00" });
  });
});

describe("recordSettlement", () => {
  it("menulis mutasi kas dan baris pelunasannya di dalam satu transaksi", async () => {
    const { transactions } = mockDb();
    await recordSettlement(pembayaranKas, controller);
    expect(transactions).toHaveLength(1);
    const tables = transactions[0].map((write) => write.table);
    expect(tables).toContain(ledgerSettlements);
    const settlement = transactions[0].find((write) => write.table === ledgerSettlements)!;
    expect(settlement.values).toMatchObject({ targetType: "BEBAN", expenseId: 4, direction: "PEMBAYARAN", amount: "400000.00", cashMovementId: 31 });
  });

  it("memakai kategori KEWAJIBAN_DIBAYAR dan arah OUT untuk pembayaran", async () => {
    const { transactions } = mockDb();
    await recordSettlement(pembayaranKas, controller);
    expect(transactions[0].some((write) => write.values?.category === "KEWAJIBAN_DIBAYAR" && write.values?.direction === "OUT")).toBe(true);
  });

  it("memakai kategori PIUTANG_DITERIMA dan arah IN untuk penagihan", async () => {
    const { transactions } = mockDb({ assets: [{ ...kendaraan, status: "DILEPAS", disposalDate: dbDay("2026-09-20"), disposalProceeds: "2500000.00", disposalJournalEntryId: 77 }] });
    await recordSettlement({
      direction: "PENERIMAAN", targetType: "ASET_TETAP", fixedAssetId: 2, amount: "2500000", method: "KAS",
      currencyId: 1, settlementDate: "2026-09-21", notes: "Penerimaan hasil pelepasan kendaraan",
      denominations: [{ value: "100000", quantity: 25 }],
    }, controller);
    expect(transactions[0].some((write) => write.values?.category === "PIUTANG_DITERIMA" && write.values?.direction === "IN")).toBe(true);
  });

  it("menolak pelunasan tanpa rincian pecahan", async () => {
    mockDb();
    await expect(recordSettlement({ ...pembayaranKas, denominations: [] }, controller)).rejects.toThrow(/pecahan/i);
  });

  it("menolak rincian pecahan yang tidak sama dengan nominalnya", async () => {
    mockDb();
    await expect(recordSettlement({ ...pembayaranKas, denominations: [{ value: "100000", quantity: 3 }] }, controller)).rejects.toThrow(/tidak sama/i);
  });

  it("menolak nominal yang melebihi sisa tagihan", async () => {
    mockDb({ settlements: [{ targetType: "BEBAN", expenseId: 4, fixedAssetId: null, amount: "400000.00", direction: "PEMBAYARAN" }] });
    await expect(recordSettlement({ ...pembayaranKas, amount: "700000", denominations: [{ value: "100000", quantity: 7 }] }, controller))
      .rejects.toThrow(/sisa tagihan/i);
  });

  it("menerima pelunasan yang tepat sebesar sisa tagihan", async () => {
    mockDb({ settlements: [{ targetType: "BEBAN", expenseId: 4, fixedAssetId: null, amount: "400000.00", direction: "PEMBAYARAN" }] });
    await expect(recordSettlement({ ...pembayaranKas, amount: "600000", denominations: [{ value: "100000", quantity: 6 }] }, controller)).resolves.toBeTruthy();
  });

  it("menolak sasaran yang tidak lengkap", async () => {
    mockDb();
    await expect(recordSettlement({ ...pembayaranKas, expenseId: undefined }, controller)).rejects.toThrow(/beban/i);
    await expect(recordSettlement({ ...pembayaranKas, targetType: "ASET_TETAP", expenseId: undefined }, controller)).rejects.toThrow(/aset/i);
  });

  it("menolak catatan yang terlalu pendek untuk menjadi jejak audit", async () => {
    mockDb();
    await expect(recordSettlement({ ...pembayaranKas, notes: "abc" }, controller)).rejects.toThrow(/[Cc]atatan/);
  });

  it("menolak penagihan piutang atas beban, yang tidak pernah menjadi piutang", async () => {
    mockDb();
    await expect(recordSettlement({ ...pembayaranKas, direction: "PENERIMAAN" }, controller)).rejects.toThrow(/aset tetap/i);
  });

  it("menolak pelunasan tunai dalam valuta asing", async () => {
    // Kas fisik valuta asing adalah persediaan yang dinilai di akhir periode, bukan alat bayar.
    mockDb({ currencyCode: "USD" });
    await expect(recordSettlement(pembayaranKas, controller)).rejects.toThrow(/Rupiah/i);
  });
});
