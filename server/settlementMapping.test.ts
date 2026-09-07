import { describe, expect, it } from "vitest";
import { CHART_OF_ACCOUNTS } from "../shared/chartOfAccounts";
import { isSkipped, mapBankMovement, mapCashMovement, type MappingResult } from "../shared/journalMapping";
import { assertJournalIsPostable } from "../shared/ledger";

const linesOf = (result: MappingResult) => {
  if (isSkipped(result)) throw new Error(`tidak terpetakan: ${result.skipped}`);
  return result.lines;
};
const reasonOf = (result: MappingResult) => {
  if (!isSkipped(result)) throw new Error("seharusnya dilewati, tetapi justru terpetakan");
  return result.skipped;
};
const knownCodes = new Set(CHART_OF_ACCOUNTS.map((account) => account.code));

const kas = (over: Partial<Parameters<typeof mapCashMovement>[0]> = {}) => ({
  category: "KEWAJIBAN_DIBAYAR" as const, amount: "1000000.000000", currencyCode: "IDR",
  reason: "KEWAJIBAN_DIBAYAR: sewa Agustus", isFirstMovementForCurrency: false, ...over,
});

const bank = (over: Partial<Parameters<typeof mapBankMovement>[0]> = {}) => ({
  category: "KEWAJIBAN_DIBAYAR" as const, direction: "OUT" as const, amount: "1000000.000000",
  currencyCode: "IDR", reason: "KEWAJIBAN_DIBAYAR: sewa Agustus", ...over,
});

/**
 * Pelunasan adalah sisi kas yang dijanjikan komentar `mapExpense` sejak paket A tetapi tidak pernah
 * ditulis sampai paket F2. Jurnalnya sengaja sama untuk beban maupun aset tetap — yang membedakan
 * bagian operasi dari bagian investasi adalah baris `ledger_settlements`, bukan akun lawannya.
 */
describe("pemetaan pelunasan lewat kas", () => {
  it("membayar kewajiban dengan mendebit 2-1900 dan mengkredit kas", () => {
    expect(linesOf(mapCashMovement(kas()))).toEqual([
      { accountCode: "2-1900", side: "DEBIT", amount: "1000000.00", memo: "KEWAJIBAN_DIBAYAR: sewa Agustus" },
      { accountCode: "1-1110", side: "KREDIT", amount: "1000000.00", memo: "KEWAJIBAN_DIBAYAR: sewa Agustus" },
    ]);
  });

  it("menerima piutang dengan mendebit kas dan mengkredit 1-1320", () => {
    const lines = linesOf(mapCashMovement(kas({ category: "PIUTANG_DITERIMA", amount: "2500000.000000", reason: "PIUTANG_DITERIMA: hasil pelepasan kendaraan" })));
    expect(lines).toEqual([
      { accountCode: "1-1110", side: "DEBIT", amount: "2500000.00", memo: "PIUTANG_DITERIMA: hasil pelepasan kendaraan" },
      { accountCode: "1-1320", side: "KREDIT", amount: "2500000.00", memo: "PIUTANG_DITERIMA: hasil pelepasan kendaraan" },
    ]);
  });

  it("menghasilkan jurnal yang seimbang dan berakun dikenal", () => {
    for (const category of ["KEWAJIBAN_DIBAYAR", "PIUTANG_DITERIMA"] as const) {
      const lines = linesOf(mapCashMovement(kas({ category })));
      for (const line of lines) expect(knownCodes.has(line.accountCode)).toBe(true);
      expect(() => assertJournalIsPostable(lines)).not.toThrow();
    }
  });

  it("menolak pelunasan dari kas valuta asing", () => {
    // Kas fisik valuta asing adalah persediaan yang dinilai di akhir periode, bukan alat bayar.
    expect(reasonOf(mapCashMovement(kas({ currencyCode: "USD" })))).toContain("valuta asing");
  });

  it("melewati nominal yang berpecahan di bawah sen", () => {
    expect(reasonOf(mapCashMovement(kas({ amount: "1000000.000001" })))).toContain("sen");
  });

  it("melewati pelunasan bernilai nol", () => {
    expect(reasonOf(mapCashMovement(kas({ amount: "0.000000" })))).toContain("tidak ada selisih");
  });
});

describe("pemetaan pelunasan lewat rekening", () => {
  it("rekening Rupiah memakai 1-1120", () => {
    expect(linesOf(mapBankMovement(bank()))).toEqual([
      { accountCode: "2-1900", side: "DEBIT", amount: "1000000.00", memo: "KEWAJIBAN_DIBAYAR: sewa Agustus" },
      { accountCode: "1-1120", side: "KREDIT", amount: "1000000.00", memo: "KEWAJIBAN_DIBAYAR: sewa Agustus" },
    ]);
  });

  it("penerimaan piutang lewat rekening Rupiah mendebit 1-1120", () => {
    expect(linesOf(mapBankMovement(bank({ category: "PIUTANG_DITERIMA", direction: "IN" })))).toEqual([
      { accountCode: "1-1120", side: "DEBIT", amount: "1000000.00", memo: "KEWAJIBAN_DIBAYAR: sewa Agustus" },
      { accountCode: "1-1320", side: "KREDIT", amount: "1000000.00", memo: "KEWAJIBAN_DIBAYAR: sewa Agustus" },
    ]);
  });

  it("rekening valuta asing memakai 1-1220 dan nilai Rupiah yang dipasok server", () => {
    const lines = linesOf(mapBankMovement(bank({ currencyCode: "USD", amount: "100.000000", rupiahAmount: "1630000.000000" })));
    expect(lines).toEqual([
      { accountCode: "2-1900", side: "DEBIT", amount: "1630000.00", memo: "KEWAJIBAN_DIBAYAR: sewa Agustus" },
      { accountCode: "1-1220", side: "KREDIT", amount: "1630000.00", memo: "KEWAJIBAN_DIBAYAR: sewa Agustus", currencyCode: "USD", foreignAmount: "100.000000" },
    ]);
  });

  it("menandai baris 1-1220 pada penerimaan piutang valuta asing juga", () => {
    // Revaluasi paket F1 membaca kembali penanda ini untuk mengetahui saldo valuta per mata uang;
    // pelunasan yang lupa menandainya membuat saldo valuta dan nilai tercatatnya berselisih.
    const lines = linesOf(mapBankMovement(bank({ category: "PIUTANG_DITERIMA", direction: "IN", currencyCode: "USD", amount: "100.000000", rupiahAmount: "1630000.000000" })));
    expect(lines[0]).toMatchObject({ accountCode: "1-1220", side: "DEBIT", currencyCode: "USD", foreignAmount: "100.000000" });
    expect(lines[1]).toMatchObject({ accountCode: "1-1320", side: "KREDIT" });
  });

  it("melewati rekening valuta asing yang kursnya belum ada, tanpa menebak", () => {
    expect(reasonOf(mapBankMovement(bank({ currencyCode: "USD", amount: "100.000000" })))).toContain("kurs BI");
  });
});
