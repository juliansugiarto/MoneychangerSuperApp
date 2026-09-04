import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { submitStockOpname } from "./operations";

/**
 * Stock opname menghitung dua tempat sekaligus dan nominalnya dihitung dari rincian pecahan, tidak
 * diketik. Yang dikunci di sini adalah aturan yang mengikat dari spec: laci wajib, brankas boleh
 * kosong tetapi tetap dibandingkan, dan komposisi yang meleset menyalakan varians meski totalnya nol.
 *
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data sama sekali.
 */
type SafeMovement = { category: string; value: string; quantity: number };

function mockDb(options: {
  counterStock?: { value: string; quantity: number }[];
  safeMovements?: SafeMovement[];
  availableAmount?: string;
  currencyCode?: string;
} = {}) {
  const counterStock = options.counterStock ?? [];
  const safeMovements = options.safeMovements ?? [];
  const availableAmount = options.availableAmount ?? "0.000000";
  const code = options.currencyCode ?? "IDR";

  const opname = {
    id: 11,
    currencyId: 1,
    opnameDate: new Date("2026-09-04T00:00:00.000Z"),
    tellerUserId: 5,
    reconciliationStatus: "OPEN",
    closingSystemBalance: availableAmount,
    isDemo: false,
    isHistorical: false,
  };

  const updates: any[] = [];
  const inserted: { table: string; values: any }[] = [];

  const resolvesTo = (rows: unknown[]) => Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) });
  const chainFor = (rows: unknown[]) => ({
    from: () => ({
      innerJoin: () => ({ where: () => resolvesTo(rows) }),
      where: () => Object.assign(resolvesTo(rows), { orderBy: () => Promise.resolve(rows) }),
    }),
  });

  // Kueri dijalankan berurutan: baris opname, baris mata uang, stok pecahan laci, baris
  // cash_balances (untuk brankas), rincian pecahan mutasi brankas, lalu cash_balances lagi
  // untuk saldo laci. Dibedakan lewat urutan pemanggilan `select`.
  let selects = 0;
  const fakeDb = {
    select: vi.fn(() => {
      selects += 1;
      if (selects === 1) return chainFor([opname]);
      if (selects === 2) return chainFor([{ code }]);
      if (selects === 3) return chainFor(counterStock);
      if (selects === 4) return chainFor([{ id: 42 }]);
      if (selects === 5) return chainFor(safeMovements);
      return chainFor([{ availableAmount }]);
    }),
    insert: vi.fn(() => ({ values: () => Promise.resolve(undefined) })),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
      const tx = {
        update: vi.fn(() => ({ set: (values: any) => { updates.push(values); return { where: () => Promise.resolve(undefined) }; } })),
        delete: vi.fn(() => ({ where: () => Promise.resolve(undefined) })),
        insert: vi.fn((table: any) => ({
          values: (values: any) => {
            inserted.push({ table: String(table?.[Symbol.for("drizzle:Name")] ?? ""), values });
            return Promise.resolve(undefined);
          },
        })),
      };
      return callback(tx);
    }),
  };
  return { getDb: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), updates, inserted };
}

const teller = { id: 5, role: "STAFF" as const };
const denominationRowsSaved = (inserted: { values: any }[]) => inserted.flatMap((entry) => (Array.isArray(entry.values) ? entry.values : [entry.values]));

describe("submitStockOpname — pecahan laci dan brankas", () => {
  it("menyatakan cocok ketika laci sesuai dan brankas sama-sama kosong", async () => {
    const { getDb, updates } = mockDb({
      counterStock: [{ value: "100000.000000", quantity: 5 }],
      availableAmount: "500000.000000",
    });

    const result = await submitStockOpname(
      { stockOpnameId: 11, counterDenominations: [{ value: "100000", quantity: 5 }], safeDenominations: [] },
      teller,
    );

    expect(result.variance).toBe("0.000000");
    expect(result.hasDenominationVariance).toBe(false);
    expect(result.physicalCounterBalance).toBe("500000.000000");
    expect(result.physicalSafeBalance).toBe("0.000000");
    expect(updates[0].reconciliationStatus).toBe("SUBMITTED");
    getDb.mockRestore();
  });

  it("menyalakan varians komposisi meski total nilainya sama persis", async () => {
    // Inti paket ini: sistem 5x100.000 dan laci 10x50.000 sama-sama Rp 500.000, dan sebelumnya
    // selisih seperti ini lolos tanpa suara karena hanya totalnya yang dibandingkan.
    const { getDb } = mockDb({
      counterStock: [{ value: "100000.000000", quantity: 5 }],
      availableAmount: "500000.000000",
    });

    const result = await submitStockOpname(
      { stockOpnameId: 11, counterDenominations: [{ value: "50000", quantity: 10 }], safeDenominations: [] },
      teller,
    );

    expect(result.variance).toBe("0.000000");
    expect(result.hasDenominationVariance).toBe(true);
    getDb.mockRestore();
  });

  it("tetap membandingkan brankas ketika daftar fisiknya kosong — 'kosong' bukan 'tidak dihitung'", async () => {
    const { getDb, inserted } = mockDb({
      counterStock: [{ value: "100000.000000", quantity: 5 }],
      safeMovements: [{ category: "SAFE_DEPOSIT", value: "100000.000000", quantity: 2 }],
      availableAmount: "500000.000000",
    });

    const result = await submitStockOpname(
      { stockOpnameId: 11, counterDenominations: [{ value: "100000", quantity: 5 }], safeDenominations: [] },
      teller,
    );

    expect(result.hasDenominationVariance).toBe(true);
    // Brankas menurut sistem berisi Rp 200.000 tetapi tidak ditemukan saat dihitung.
    expect(result.variance).toBe("-200000.000000");
    expect(result.closingSystemSafeBalance).toBe("200000.000000");

    // Barisnya tetap ditulis meski fisiknya nol, supaya terbaca sebagai "sistem 2, fisik 0".
    const safeRow = denominationRowsSaved(inserted).find((row) => row.location === "SAFE");
    expect(safeRow).toMatchObject({ denominationValue: "100000.000000", quantity: 0, systemQuantity: 2 });
    getDb.mockRestore();
  });

  it("membekukan angka sistem per pecahan pada baris rinciannya", async () => {
    const { getDb, inserted } = mockDb({
      counterStock: [{ value: "100000.000000", quantity: 5 }, { value: "50000.000000", quantity: 0 }],
      availableAmount: "500000.000000",
    });

    await submitStockOpname(
      { stockOpnameId: 11, counterDenominations: [{ value: "100000", quantity: 4 }, { value: "50000", quantity: 2 }], safeDenominations: [] },
      teller,
    );

    const rows = denominationRowsSaved(inserted);
    expect(rows.find((row) => row.denominationValue === "100000.000000")).toMatchObject({ quantity: 4, systemQuantity: 5, subtotal: "400000.000000" });
    expect(rows.find((row) => row.denominationValue === "50000.000000")).toMatchObject({ quantity: 2, systemQuantity: 0, subtotal: "100000.000000" });
    getDb.mockRestore();
  });

  it("menolak pengiriman tanpa rincian pecahan laci", async () => {
    const { getDb } = mockDb();

    await expect(submitStockOpname(
      { stockOpnameId: 11, counterDenominations: [], safeDenominations: [{ value: "100000", quantity: 1 }] },
      teller,
    )).rejects.toThrow(/pecahan laci/i);
    getDb.mockRestore();
  });

  it("menolak nilai yang bukan pecahan Rupiah yang dikenal", async () => {
    const { getDb } = mockDb({ counterStock: [], availableAmount: "0.000000" });

    await expect(submitStockOpname(
      { stockOpnameId: 11, counterDenominations: [{ value: "131250000", quantity: 1 }], safeDenominations: [] },
      teller,
    )).rejects.toThrow(/bukan pecahan IDR yang dikenal/i);
    getDb.mockRestore();
  });

  it("menolak pengiriman oleh Staff lain", async () => {
    const { getDb } = mockDb();

    await expect(submitStockOpname(
      { stockOpnameId: 11, counterDenominations: [{ value: "100000", quantity: 1 }], safeDenominations: [] },
      { id: 6, role: "STAFF" },
    )).rejects.toThrow(/miliknya sendiri/i);
    getDb.mockRestore();
  });
});
