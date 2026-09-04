import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { getOpnameSystemCounts } from "./operations";

/**
 * Angka sistem yang menjadi lawan hitung fisik sebuah opname: isi laci dari stok berjalan, dan isi
 * brankas yang diturunkan dari mutasi SAFE_DEPOSIT dikurangi SAFE_WITHDRAWAL.
 *
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data sama sekali. Tiga kueri dijalankan
 * berurutan — stok pecahan laci, baris `cash_balances`, lalu rincian pecahan mutasi brankas — dan
 * dibedakan lewat urutan pemanggilan `select`, sama seperti `openingCashOrder.test.ts`.
 */
function mockDb(options: {
  counterRows?: { value: string; quantity: number }[];
  hasCashBalance?: boolean;
  safeRows?: { category: string; value: string; quantity: number }[];
} = {}) {
  const counterRows = options.counterRows ?? [];
  const safeRows = options.safeRows ?? [];
  const hasCashBalance = options.hasCashBalance ?? true;

  let selects = 0;
  // `where()` harus sekaligus dapat di-await (kueri 1 dan 3) dan punya `.limit()` (kueri 2).
  const resolvesTo = (rows: unknown[]) => Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) });
  const chainFor = (rows: unknown[]) => ({
    from: () => ({
      innerJoin: () => ({ where: () => resolvesTo(rows) }),
      where: () => resolvesTo(rows),
    }),
  });

  const fakeDb = {
    select: vi.fn(() => {
      selects += 1;
      if (selects === 1) return chainFor(counterRows);
      if (selects === 2) return chainFor(hasCashBalance ? [{ id: 42 }] : []);
      return chainFor(safeRows);
    }),
  };
  return vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

describe("getOpnameSystemCounts", () => {
  it("mengembalikan isi laci apa adanya, termasuk pecahan yang jumlahnya nol", async () => {
    // Justru pecahan nol inilah yang tidak boleh disaring: nol di sistem tetapi ada di tangan
    // petugas adalah temuan, dan `listCashDenominationBalances` yang menyaring `quantity > 0`
    // sengaja tidak dipakai di sini.
    const getDb = mockDb({
      counterRows: [{ value: "100000.000000", quantity: 5 }, { value: "50000.000000", quantity: 0 }],
    });

    const result = await getOpnameSystemCounts(1);

    expect(result.counter).toEqual([
      { value: "100000.000000", quantity: 5 },
      { value: "50000.000000", quantity: 0 },
    ]);
    getDb.mockRestore();
  });

  it("menurunkan isi brankas dari SAFE_DEPOSIT dikurangi SAFE_WITHDRAWAL", async () => {
    const getDb = mockDb({
      safeRows: [
        { category: "SAFE_DEPOSIT", value: "100000.000000", quantity: 3 },
        { category: "SAFE_WITHDRAWAL", value: "100000.000000", quantity: 1 },
      ],
    });

    const result = await getOpnameSystemCounts(1);

    expect(result.safe).toEqual([{ value: "100000.000000", quantity: 2 }]);
    getDb.mockRestore();
  });

  it("tidak menghitung OFF_HOURS_SALE sebagai isi brankas", async () => {
    // Kueri brankas menyaring kategorinya di basis data, jadi baris OFF_HOURS_SALE tidak pernah
    // sampai ke sini. Yang diuji: bila toh ia lolos, ia tidak boleh menambah isi brankas.
    const getDb = mockDb({
      safeRows: [
        { category: "SAFE_DEPOSIT", value: "100000.000000", quantity: 2 },
        { category: "OFF_HOURS_SALE", value: "100000.000000", quantity: 7 },
      ],
    });

    const result = await getOpnameSystemCounts(1);

    expect(result.safe).toEqual([{ value: "100000.000000", quantity: 2 }]);
    getDb.mockRestore();
  });

  it("mengembalikan brankas kosong, bukan galat, untuk mata uang yang belum punya baris cash_balances", async () => {
    const getDb = mockDb({
      counterRows: [{ value: "100000.000000", quantity: 1 }],
      hasCashBalance: false,
      safeRows: [{ category: "SAFE_DEPOSIT", value: "100000.000000", quantity: 9 }],
    });

    const result = await getOpnameSystemCounts(99);

    expect(result.safe).toEqual([]);
    expect(result.counter).toHaveLength(1);
    getDb.mockRestore();
  });

  it("menormalkan penulisan nilai pecahan sehingga tidak pecah menjadi dua baris", async () => {
    const getDb = mockDb({
      counterRows: [{ value: "100000", quantity: 4 }],
      safeRows: [
        { category: "SAFE_DEPOSIT", value: "100000", quantity: 3 },
        { category: "SAFE_DEPOSIT", value: "100000.000000", quantity: 2 },
      ],
    });

    const result = await getOpnameSystemCounts(1);

    expect(result.counter).toEqual([{ value: "100000.000000", quantity: 4 }]);
    expect(result.safe).toEqual([{ value: "100000.000000", quantity: 5 }]);
    getDb.mockRestore();
  });
});
