import { describe, expect, it } from "vitest";
import { isSkipped, mapFixedAssetAcquisition, mapFixedAssetDisposal, mapMonthlyDepreciation } from "../shared/journalMapping";
import type { MappingResult } from "../shared/journalMapping";

const lines = (result: MappingResult) => (isSkipped(result) ? [] : result.lines);

describe("jurnal perolehan aset tetap", () => {
  it("mendebit harga perolehan dan mengkredit kewajiban lain-lain, bukan kas", () => {
    // Keputusan spec 5: modul di luar sistem kas tidak boleh mengkredit 1-1110, karena kas pada
    // buku besar lalu berbeda dari cash_balances — temuan 7.2/7.3.
    expect(lines(mapFixedAssetAcquisition({ cost: "24000000.00", assetName: "Brankas Chubb" }))).toEqual([
      { accountCode: "1-1510", side: "DEBIT", amount: "24000000.00", memo: "Perolehan Brankas Chubb" },
      { accountCode: "2-1900", side: "KREDIT", amount: "24000000.00", memo: "Perolehan Brankas Chubb" },
    ]);
  });

  it("melewati perolehan bernilai nol alih-alih menulis jurnal kosong", () => {
    const result = mapFixedAssetAcquisition({ cost: "0.00", assetName: "Brankas" });
    expect(isSkipped(result) && result.skipped).toMatch(/nol/i);
  });
});

describe("jurnal penyusutan bulanan", () => {
  it("mendebit beban penyusutan dan mengkredit akumulasi", () => {
    expect(lines(mapMonthlyDepreciation({ totalCharge: "1250000.00", month: "2026-03" }))).toEqual([
      { accountCode: "6-1700", side: "DEBIT", amount: "1250000.00", memo: "Penyusutan aset tetap 2026-03" },
      { accountCode: "1-1520", side: "KREDIT", amount: "1250000.00", memo: "Penyusutan aset tetap 2026-03" },
    ]);
  });

  it("melewati bulan tanpa beban — outlet tanpa aset tersusutkan tetap boleh menutup periode", () => {
    const result = mapMonthlyDepreciation({ totalCharge: "0.00", month: "2026-03" });
    expect(isSkipped(result) && result.skipped).toMatch(/tidak ada beban penyusutan/i);
  });
});

describe("jurnal pelepasan aset tetap", () => {
  it("mengkredit laba bila hasil pelepasan melebihi nilai buku", () => {
    // Perolehan 24 juta, akumulasi 18 juta, nilai buku 6 juta, dijual 8 juta → laba 2 juta.
    expect(lines(mapFixedAssetDisposal({ cost: "24000000.00", accumulated: "18000000.00", proceeds: "8000000.00", assetName: "Brankas Chubb" }))).toEqual([
      { accountCode: "1-1320", side: "DEBIT", amount: "8000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "1-1520", side: "DEBIT", amount: "18000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "1-1510", side: "KREDIT", amount: "24000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "7-1400", side: "KREDIT", amount: "2000000.00", memo: "Pelepasan Brankas Chubb" },
    ]);
  });

  it("mendebit rugi bila hasil pelepasan di bawah nilai buku", () => {
    expect(lines(mapFixedAssetDisposal({ cost: "24000000.00", accumulated: "18000000.00", proceeds: "4000000.00", assetName: "Brankas Chubb" }))).toEqual([
      { accountCode: "1-1320", side: "DEBIT", amount: "4000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "1-1520", side: "DEBIT", amount: "18000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "7-1400", side: "DEBIT", amount: "2000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "1-1510", side: "KREDIT", amount: "24000000.00", memo: "Pelepasan Brankas Chubb" },
    ]);
  });

  it("menghilangkan baris nol: penghapusan aset yang sudah habis disusutkan", () => {
    expect(lines(mapFixedAssetDisposal({ cost: "24000000.00", accumulated: "24000000.00", proceeds: "0.00", assetName: "Brankas Chubb" }))).toEqual([
      { accountCode: "1-1520", side: "DEBIT", amount: "24000000.00", memo: "Pelepasan Brankas Chubb" },
      { accountCode: "1-1510", side: "KREDIT", amount: "24000000.00", memo: "Pelepasan Brankas Chubb" },
    ]);
  });

  it("seimbang pada setiap bentuknya", () => {
    for (const proceeds of ["0.00", "4000000.00", "6000000.00", "8000000.00"]) {
      const rows = lines(mapFixedAssetDisposal({ cost: "24000000.00", accumulated: "18000000.00", proceeds, assetName: "X" }));
      const debit = rows.filter((row) => row.side === "DEBIT").reduce((sum, row) => sum + Number(row.amount), 0);
      const credit = rows.filter((row) => row.side === "KREDIT").reduce((sum, row) => sum + Number(row.amount), 0);
      expect(debit).toBe(credit);
    }
  });

  it("menolak akumulasi yang melebihi harga perolehan", () => {
    const result = mapFixedAssetDisposal({ cost: "24000000.00", accumulated: "30000000.00", proceeds: "0.00", assetName: "X" });
    expect(isSkipped(result) && result.skipped).toMatch(/akumulasi/i);
  });
});
