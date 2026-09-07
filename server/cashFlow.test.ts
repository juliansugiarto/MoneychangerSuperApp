import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, loadLines: vi.fn(), accountBalancesFor: vi.fn() };
});

import { buildCashFlowStatement } from "./cashFlow";
import * as db from "./db";
import { accountBalancesFor, loadLines } from "./ledgerOperations";

type LineInput = { entryId: number; entryNumber: string; sourceType: string; sourceReference: string | null; accountCode: string; side: "DEBIT" | "KREDIT"; amount: string };

const line = (over: Partial<LineInput> & Pick<LineInput, "entryId" | "accountCode" | "side" | "amount">): LineInput => ({
  entryNumber: `JU-202609-${String(over.entryId).padStart(4, "0")}`,
  sourceType: "MUTASI_KAS", sourceReference: null, ...over,
});

/** Bon jual UKA Rp 5.000.000 tunai: kas masuk, 4-1100 sebagai lawannya. */
const jualUka = [
  line({ entryId: 1, sourceType: "TRANSAKSI_VALUTA", sourceReference: "BON-1", accountCode: "1-1110", side: "DEBIT", amount: "5000000.00" }),
  line({ entryId: 1, sourceType: "TRANSAKSI_VALUTA", sourceReference: "BON-1", accountCode: "4-1100", side: "KREDIT", amount: "5000000.00" }),
];

/** Pelunasan beban Rp 1.000.000 tunai lewat mutasi kas 31. */
const bayarBeban = [
  line({ entryId: 2, sourceReference: "KAS-31", accountCode: "2-1900", side: "DEBIT", amount: "1000000.00" }),
  line({ entryId: 2, sourceReference: "KAS-31", accountCode: "1-1110", side: "KREDIT", amount: "1000000.00" }),
];

/** Pelunasan aset tetap Rp 24.000.000 tunai lewat mutasi kas 32. */
const bayarAset = [
  line({ entryId: 3, sourceReference: "KAS-32", accountCode: "2-1900", side: "DEBIT", amount: "24000000.00" }),
  line({ entryId: 3, sourceReference: "KAS-32", accountCode: "1-1110", side: "KREDIT", amount: "24000000.00" }),
];

/** Setor kas ke rekening: dua akun kas bergerak, jumlahnya tidak berubah. */
const setorKeBank = [
  line({ entryId: 4, sourceReference: "KAS-33", accountCode: "1-1120", side: "DEBIT", amount: "2000000.00" }),
  line({ entryId: 4, sourceReference: "KAS-33", accountCode: "1-1110", side: "KREDIT", amount: "2000000.00" }),
];

const settlementRows = [
  { targetType: "BEBAN", cashMovementId: 31, bankMovementId: null },
  { targetType: "ASET_TETAP", cashMovementId: 32, bankMovementId: null },
];

function mockDb(rows: unknown[] = settlementRows) {
  const chain = (result: unknown[]): any => {
    const thenable = Promise.resolve(result) as any;
    for (const method of ["where", "orderBy", "limit"]) thenable[method] = () => chain(result);
    return thenable;
  };
  vi.spyOn(db, "getDb").mockResolvedValue({ select: () => ({ from: () => chain(rows) }) } as never);
}

const range = { from: new Date("2026-09-01T00:00:00"), to: new Date("2026-09-30T00:00:00") };

/** Saldo kas: sebelum periode nol, sesudahnya sesuai jurnal yang dipakai tiap uji. */
const balances = (opening: string, closing: string) => {
  vi.mocked(accountBalancesFor)
    .mockResolvedValueOnce([{ accountCode: "1-1110", balance: BigInt(opening) }])
    .mockResolvedValueOnce([{ accountCode: "1-1110", balance: BigInt(closing) }]);
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(loadLines).mockReset();
  vi.mocked(accountBalancesFor).mockReset();
});

describe("buildCashFlowStatement", () => {
  it("menempatkan bon, pelunasan beban, dan pelunasan aset pada bagian yang benar", async () => {
    mockDb();
    vi.mocked(loadLines).mockResolvedValue([...jualUka, ...bayarBeban, ...bayarAset] as never);
    balances("0", "-2000000000");

    const result = await buildCashFlowStatement(range);
    expect(result.operating.lines).toEqual([
      { label: "Penerimaan penjualan UKA", amount: "5000000.00", entryNumbers: ["JU-202609-0001"] },
      { label: "Pembayaran beban operasional", amount: "-1000000.00", entryNumbers: ["JU-202609-0002"] },
    ]);
    expect(result.investing.lines).toEqual([
      { label: "Perolehan aset tetap", amount: "-24000000.00", entryNumbers: ["JU-202609-0003"] },
    ]);
    expect(result.reconciled).toBe(true);
  });

  it("mengeluarkan pemindahan kas ke rekening dari seluruh bagian", async () => {
    mockDb([]);
    vi.mocked(loadLines).mockResolvedValue(setorKeBank as never);
    balances("500000000", "500000000");

    const result = await buildCashFlowStatement(range);
    expect(result.netChange).toBe("0.00");
    expect(result.operating.lines).toHaveLength(0);
    expect(result.unclassified.lines).toHaveLength(0);
    expect(result.reconciled).toBe(true);
  });

  it("menyajikan revaluasi kurs sebagai penyeimbang tersendiri", async () => {
    mockDb([]);
    vi.mocked(loadLines).mockResolvedValue([
      line({ entryId: 5, sourceType: "REVALUASI_KURS", sourceReference: "REVAL-2026-09", accountCode: "7-1500", side: "DEBIT", amount: "1336000.00" }),
      line({ entryId: 5, sourceType: "REVALUASI_KURS", sourceReference: "REVAL-2026-09", accountCode: "1-1220", side: "KREDIT", amount: "1336000.00" }),
    ] as never);
    balances("1763600000", "1630000000");

    const result = await buildCashFlowStatement(range);
    expect(result.rateEffect.total).toBe("-1336000.00");
    expect(result.operating.total).toBe("0.00");
    expect(result.reconciled).toBe(true);
  });

  it("menandai jurnal manual sebagai belum terklasifikasi, lengkap dengan nomor jurnalnya", async () => {
    mockDb([]);
    vi.mocked(loadLines).mockResolvedValue([
      line({ entryId: 6, sourceType: "MANUAL", accountCode: "1-1110", side: "DEBIT", amount: "750000.00" }),
      line({ entryId: 6, sourceType: "MANUAL", accountCode: "7-1900", side: "KREDIT", amount: "750000.00" }),
    ] as never);
    balances("0", "75000000");

    const result = await buildCashFlowStatement(range);
    expect(result.unclassified.total).toBe("750000.00");
    expect(result.unclassified.lines[0].entryNumbers).toEqual(["JU-202609-0006"]);
    expect(result.unclassified.lines[0].reason).toMatch(/manual/i);
  });

  it("menandai reconciled salah ketika saldo kas bergerak tanpa jurnal yang menjelaskannya", async () => {
    // Kedua sisi dihitung lewat jalur berbeda: kiri dari saldo akun, kanan dari klasifikasi jurnal.
    // Bila keduanya diturunkan dari satu sumber, penanda ini selalu benar dan tidak berguna.
    mockDb([]);
    vi.mocked(loadLines).mockResolvedValue(jualUka as never);
    balances("0", "900000000");

    const result = await buildCashFlowStatement(range);
    expect(result.netChange).toBe("5000000.00");
    expect(result.actualChange).toBe("9000000.00");
    expect(result.reconciled).toBe(false);
    expect(result.difference).toBe("4000000.00");
  });

  it("menempatkan pelunasan yang kehilangan baris sasarannya di keranjang, bukan di bagian operasi", async () => {
    mockDb([]);
    vi.mocked(loadLines).mockResolvedValue(bayarBeban as never);
    balances("0", "-100000000");

    const result = await buildCashFlowStatement(range);
    expect(result.operating.lines).toHaveLength(0);
    expect(result.unclassified.lines[0].reason).toMatch(/tanpa catatan sasaran/);
  });
});
