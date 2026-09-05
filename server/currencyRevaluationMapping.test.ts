import { describe, expect, it } from "vitest";
import { isSkipped, mapCurrencyRevaluation, type MappingResult } from "../shared/journalMapping";
import { assertJournalIsPostable } from "../shared/ledger";

const linesOf = (result: MappingResult) => {
  if (isSkipped(result)) throw new Error(`tidak terpetakan: ${result.skipped}`);
  return result.lines;
};
const reasonOf = (result: MappingResult) => (isSkipped(result) ? result.skipped : "");

describe("mapCurrencyRevaluation", () => {
  it("menjurnal laba selisih kurs ke kredit 7-1500", () => {
    // Rupiah melemah terhadap valuta yang dipegang: nilai tercatatnya naik, selisihnya laba.
    expect(linesOf(mapCurrencyRevaluation({ difference: "250000.00", month: "2026-09" }))).toEqual([
      { accountCode: "1-1220", side: "DEBIT", amount: "250000.00", memo: "Revaluasi kurs 2026-09" },
      { accountCode: "7-1500", side: "KREDIT", amount: "250000.00", memo: "Revaluasi kurs 2026-09" },
    ]);
  });

  it("menjurnal rugi selisih kurs ke debit 7-1500", () => {
    expect(linesOf(mapCurrencyRevaluation({ difference: "-180000.00", month: "2026-09" }))).toEqual([
      { accountCode: "7-1500", side: "DEBIT", amount: "180000.00", memo: "Revaluasi kurs 2026-09" },
      { accountCode: "1-1220", side: "KREDIT", amount: "180000.00", memo: "Revaluasi kurs 2026-09" },
    ]);
  });

  it("melewati bulan yang selisihnya nol", () => {
    // Kurs yang tidak bergerak adalah keadaan sah, bukan kekurangan data. Jurnal bernilai nol
    // ditolak `postJournalEntry`, jadi ia harus dilewati di sini dengan alasan yang terbaca.
    expect(reasonOf(mapCurrencyRevaluation({ difference: "0.00", month: "2026-09" })))
      .toMatch(/tidak ada selisih kurs pada 2026-09/i);
  });

  it("melewati selisih yang pecahannya di bawah sen", () => {
    expect(reasonOf(mapCurrencyRevaluation({ difference: "250000.123", month: "2026-09" })))
      .toMatch(/pecahan di bawah sen/i);
  });

  it("melewati selisih yang bukan angka", () => {
    expect(reasonOf(mapCurrencyRevaluation({ difference: "bukan angka", month: "2026-09" })))
      .toMatch(/pecahan di bawah sen/i);
  });

  it("menyebut bulannya pada memo, supaya jurnalnya dapat ditelusuri tanpa membuka tabel lain", () => {
    const lines = linesOf(mapCurrencyRevaluation({ difference: "1.00", month: "2027-01" }));
    for (const line of lines) expect(line.memo).toBe("Revaluasi kurs 2027-01");
  });

  it("menghasilkan jurnal yang lolos penjaga buku besar", () => {
    for (const difference of ["250000.00", "-180000.00", "0.01", "-0.01"]) {
      expect(() => assertJournalIsPostable(linesOf(mapCurrencyRevaluation({ difference, month: "2026-09" })))).not.toThrow();
    }
  });
});
