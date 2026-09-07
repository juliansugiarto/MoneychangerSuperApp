import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, loadLines: vi.fn(), accountBalancesFor: vi.fn() };
});

import { isSkipped, mapBankMovement, mapCashMovement, mapCurrencyRevaluation, mapExchangeTransaction, type MappingResult } from "../shared/journalMapping";
import { parseAmount } from "../shared/ledger";
import { buildCashFlowStatement } from "./cashFlow";
import * as db from "./db";
import { accountBalancesFor, loadLines } from "./ledgerOperations";

/**
 * Skenario satu periode utuh, dari pemetaan jurnal sampai Laporan Arus Kas.
 *
 * Jurnalnya **tidak diketik** di dalam uji ini: ia dihasilkan pemetaan yang sungguhan dipakai
 * produksi, lalu diumpankan ke penyusun Arus Kas. Itulah yang diuji — bahwa apa yang ditulis
 * pemetaan dan apa yang dibaca penyusun benar-benar bertemu. Uji yang mengetik jurnalnya sendiri
 * akan tetap hijau sekalipun keduanya sudah berbeda pendapat.
 */

let nextEntryId = 0;
const linesOf = (result: MappingResult) => {
  if (isSkipped(result)) throw new Error(`tidak terpetakan: ${result.skipped}`);
  return result.lines;
};

/** Menjadikan hasil pemetaan baris jurnal seperti yang dibaca `loadLines`. */
const journal = (sourceType: string, sourceReference: string | null, result: MappingResult) => {
  const entryId = ++nextEntryId;
  return linesOf(result).map((line) => ({
    entryId,
    entryNumber: `JU-202609-${String(entryId).padStart(4, "0")}`,
    sourceType,
    sourceReference,
    accountCode: line.accountCode,
    side: line.side,
    amount: line.amount,
  }));
};

const settlements = [
  { targetType: "BEBAN", cashMovementId: 41, bankMovementId: null },
  { targetType: "ASET_TETAP", cashMovementId: 42, bankMovementId: null },
  { targetType: "ASET_TETAP", cashMovementId: 43, bankMovementId: null },
];

function mockDb(rows: unknown[] = settlements) {
  const chain = (result: unknown[]): any => {
    const thenable = Promise.resolve(result) as any;
    for (const method of ["where", "innerJoin", "orderBy", "limit"]) thenable[method] = () => chain(result);
    return thenable;
  };
  vi.spyOn(db, "getDb").mockResolvedValue({ select: () => ({ from: () => chain(rows) }) } as never);
}

const range = { from: new Date("2026-09-01T00:00:00"), to: new Date("2026-09-30T00:00:00") };

/**
 * Satu periode September 2026 yang lengkap:
 * modal masuk → beli dan jual UKA → beban dibayar → aset dibayar → hasil pelepasan ditagih →
 * setor kas ke bank → revaluasi kurs.
 */
function septemberJournals() {
  nextEntryId = 0;
  const kas = (over: Partial<Parameters<typeof mapCashMovement>[0]>) => mapCashMovement({
    category: "OPENING", amount: "0", currencyCode: "IDR", reason: "x", isFirstMovementForCurrency: false, ...over,
  } as Parameters<typeof mapCashMovement>[0]);

  return [
    ...journal("MUTASI_KAS", "KAS-40", kas({ category: "CAPITAL_INJECTION", amount: "100000000.000000", reason: "Setoran modal Rupiah" })),
    ...journal("TRANSAKSI_VALUTA", "BON-1", mapExchangeTransaction({ operation: "BUY", paymentMethod: "CASH", rupiahAmount: "30000000.00", transactionNumber: "BON-1" })),
    ...journal("TRANSAKSI_VALUTA", "BON-2", mapExchangeTransaction({ operation: "SELL", paymentMethod: "CASH", rupiahAmount: "35000000.00", transactionNumber: "BON-2" })),
    ...journal("MUTASI_KAS", "KAS-41", kas({ category: "KEWAJIBAN_DIBAYAR", amount: "5000000.000000", reason: "Pelunasan sewa" })),
    ...journal("MUTASI_KAS", "KAS-42", kas({ category: "KEWAJIBAN_DIBAYAR", amount: "24000000.000000", reason: "Pelunasan kendaraan" })),
    ...journal("MUTASI_KAS", "KAS-43", kas({ category: "PIUTANG_DITERIMA", amount: "2500000.000000", reason: "Hasil pelepasan kendaraan lama" })),
    ...journal("MUTASI_KAS", "KAS-44", kas({ category: "BANK_DEPOSIT", amount: "10000000.000000", reason: "Setor kas ke rekening" })),
    ...journal("REVALUASI_KURS", "REVAL-2026-09", mapCurrencyRevaluation({ difference: "-1336000.00", month: "2026-09" })),
  ];
}

/** Jumlah delta kas seluruh jurnal — dipakai sebagai saldo akhir supaya `reconciled` bermakna. */
const cashDeltaOf = (lines: ReturnType<typeof septemberJournals>) =>
  lines
    .filter((line) => ["1-1110", "1-1120", "1-1220"].includes(line.accountCode))
    .reduce((total, line) => total + (line.side === "DEBIT" ? parseAmount(line.amount) : -parseAmount(line.amount)), 0n);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(loadLines).mockReset();
  vi.mocked(accountBalancesFor).mockReset();
});

describe("skenario arus kas satu periode", () => {
  it("menempatkan setiap kejadian pada bagiannya, dan rekonsiliasinya utuh", async () => {
    const lines = septemberJournals();
    mockDb();
    vi.mocked(loadLines).mockResolvedValue(lines as never);
    vi.mocked(accountBalancesFor)
      .mockResolvedValueOnce([{ accountCode: "1-1110", balance: 0n }])
      .mockResolvedValueOnce([{ accountCode: "1-1110", balance: cashDeltaOf(lines) }]);

    const result = await buildCashFlowStatement(range);

    // Operasi: jual 35jt masuk, beli 30jt keluar, sewa 5jt keluar.
    expect(result.operating.total).toBe("0.00");
    // Investasi bruto: bayar aset 24jt keluar, hasil pelepasan 2,5jt masuk — tidak dinetokan.
    expect(result.investing.lines.map((line) => [line.label, line.amount])).toEqual([
      ["Perolehan aset tetap", "-24000000.00"],
      ["Hasil pelepasan aset tetap", "2500000.00"],
    ]);
    expect(result.financing.total).toBe("100000000.00");
    expect(result.rateEffect.total).toBe("-1336000.00");
    expect(result.unclassified.lines).toHaveLength(0);
    expect(result.reconciled).toBe(true);
  });

  it("tidak menghitung setor kas ke rekening sebagai arus kas", async () => {
    // Uang yang sama berpindah tempat; jumlah kas dan setara kas tidak berubah.
    const lines = septemberJournals();
    mockDb();
    vi.mocked(loadLines).mockResolvedValue(lines as never);
    vi.mocked(accountBalancesFor)
      .mockResolvedValueOnce([{ accountCode: "1-1110", balance: 0n }])
      .mockResolvedValueOnce([{ accountCode: "1-1110", balance: cashDeltaOf(lines) }]);

    const result = await buildCashFlowStatement(range);
    const semuaBaris = [...result.operating.lines, ...result.investing.lines, ...result.financing.lines, ...result.unclassified.lines];
    expect(semuaBaris.some((line) => line.label.includes("Pemindahan"))).toBe(false);
  });

  it("memunculkan pelunasan yang kehilangan baris sasarannya di keranjang, tanpa memaksa angkanya seimbang", async () => {
    const lines = septemberJournals();
    mockDb([]); // tidak ada satu pun baris ledger_settlements
    vi.mocked(loadLines).mockResolvedValue(lines as never);
    vi.mocked(accountBalancesFor)
      .mockResolvedValueOnce([{ accountCode: "1-1110", balance: 0n }])
      .mockResolvedValueOnce([{ accountCode: "1-1110", balance: cashDeltaOf(lines) }]);

    const result = await buildCashFlowStatement(range);

    expect(result.investing.lines).toHaveLength(0);
    expect(result.unclassified.lines).toHaveLength(2);
    expect(result.unclassified.lines.every((line) => line.reason?.includes("tanpa catatan sasaran"))).toBe(true);
    // Keranjangnya ikut dijumlahkan, sehingga rekonsiliasinya tetap utuh — yang hilang adalah
    // klasifikasinya, bukan uangnya.
    expect(result.reconciled).toBe(true);
  });

  it("menampakkan jurnal manual yang menyentuh kas, bukan menyerapnya diam-diam", async () => {
    const lines = [
      ...septemberJournals(),
      { entryId: 99, entryNumber: "JU-202609-0099", sourceType: "MANUAL", sourceReference: null, accountCode: "1-1110", side: "DEBIT" as const, amount: "750000.00" },
      { entryId: 99, entryNumber: "JU-202609-0099", sourceType: "MANUAL", sourceReference: null, accountCode: "7-1900", side: "KREDIT" as const, amount: "750000.00" },
    ];
    mockDb();
    vi.mocked(loadLines).mockResolvedValue(lines as never);
    vi.mocked(accountBalancesFor)
      .mockResolvedValueOnce([{ accountCode: "1-1110", balance: 0n }])
      .mockResolvedValueOnce([{ accountCode: "1-1110", balance: cashDeltaOf(lines as never) }]);

    const result = await buildCashFlowStatement(range);
    expect(result.unclassified.lines[0].entryNumbers).toEqual(["JU-202609-0099"]);
    expect(result.reconciled).toBe(true);
  });

  it("menandai selisih ketika kas bergerak tanpa jurnal yang menjelaskannya", async () => {
    const lines = septemberJournals();
    mockDb();
    vi.mocked(loadLines).mockResolvedValue(lines as never);
    vi.mocked(accountBalancesFor)
      .mockResolvedValueOnce([{ accountCode: "1-1110", balance: 0n }])
      .mockResolvedValueOnce([{ accountCode: "1-1110", balance: cashDeltaOf(lines) + 1_000_000n }]);

    const result = await buildCashFlowStatement(range);
    expect(result.reconciled).toBe(false);
    expect(result.difference).toBe("10000.00");
  });
});
