import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { recordOpeningCash } from "./operations";

/**
 * Urutan yang benar adalah setoran modal dulu, baru hitungan kas pagi yang pertama. Kas awal
 * pertama sengaja tidak dijurnal bila asal uangnya belum tercatat, jadi `recordOpeningCash`
 * memperingatkan — tetapi tetap mencatat. Menolak akan menghalangi operasional demi kerapian
 * pembukuan, dan modal bisa saja masuk lewat rekening bank.
 *
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data sama sekali.
 */
function mockDb(options: { currencyCode?: string; hasCapitalInjection?: boolean; availableAmount?: string } = {}) {
  const code = options.currencyCode ?? "IDR";
  const availableAmount = options.availableAmount ?? "0.000000";
  const inserted: { table: string; values: any }[] = [];
  const rowsFor = (rows: unknown[]) => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) });

  // Dua kueri berproyeksi `{ id }` dijalankan berurutan di dalam transaksi: mutasi OPENING hari ini
  // (harus kosong supaya pencatatannya lanjut), lalu mutasi CAPITAL_INJECTION yang dinilai di sini.
  let projectedSelects = 0;
  const fakeTx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn((projection?: unknown) => {
      if (!projection) return rowsFor([{ id: 1, currencyId: 1, code, availableAmount, active: true }]);
      projectedSelects += 1;
      if (projectedSelects === 2 && options.hasCapitalInjection) return rowsFor([{ id: 99 }]);
      return rowsFor([]);
    }),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),
    delete: vi.fn(() => ({ where: () => Promise.resolve(undefined) })),
    insert: vi.fn((table: any) => ({
      values: (values: any) => {
        inserted.push({ table: String(table?.[Symbol.for("drizzle:Name")] ?? ""), values });
        return { $returningId: () => Promise.resolve([{ id: inserted.length }]), onDuplicateKeyUpdate: () => Promise.resolve(undefined) };
      },
    })),
  };
  const fakeDb = {
    select: vi.fn(() => rowsFor([{ code }])),
    insert: vi.fn(() => ({ values: () => Promise.resolve(undefined) })),
    transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(fakeTx)),
  };
  return { getDb: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), inserted };
}

const controller = { id: 7, role: "CONTROLLER" as const };
const kasAwalRupiah = { currencyId: 1, openingAmount: "500000", denominations: [{ value: "100000", quantity: 5 }] };

describe("recordOpeningCash — urutan modal sebelum kas awal", () => {
  it("memperingatkan bila kas awal Rupiah pertama dicatat tanpa setoran modal, dan tetap mencatatnya", async () => {
    const { getDb, inserted } = mockDb();
    const result = await recordOpeningCash(kasAwalRupiah, controller);
    expect(result.capitalWarning).toMatch(/[Ss]etoran modal/);
    // Peringatan, bukan penolakan: mutasi kas awalnya tetap ditulis.
    expect(inserted.some((row) => row.values?.category === "OPENING" && row.values?.direction === "ADJUSTMENT")).toBe(true);
    expect(result.openingAmount).toBe("500000.000000");
    getDb.mockRestore();
  });

  it("tidak memperingatkan bila setoran modal sudah pernah dicatat", async () => {
    const { getDb } = mockDb({ hasCapitalInjection: true });
    const result = await recordOpeningCash(kasAwalRupiah, controller);
    expect(result.capitalWarning).toBeNull();
    getDb.mockRestore();
  });

  it("tidak pernah memperingatkan pada valuta asing, karena modalnya memang tidak dinilai per mutasi", async () => {
    for (const hasCapitalInjection of [false, true]) {
      const { getDb } = mockDb({ currencyCode: "USD", hasCapitalInjection });
      const result = await recordOpeningCash({ currencyId: 2, openingAmount: "1000", denominations: [{ value: "100", quantity: 10 }] }, controller);
      expect(result.capitalWarning).toBeNull();
      getDb.mockRestore();
    }
  });

  it("tidak memperingatkan bila saldo berjalan sudah ada — mutasi OPENING berikutnya adalah selisih hitung kas", async () => {
    const { getDb } = mockDb({ availableAmount: "250000.000000" });
    const result = await recordOpeningCash(kasAwalRupiah, controller);
    expect(result.capitalWarning).toBeNull();
    getDb.mockRestore();
  });
});
