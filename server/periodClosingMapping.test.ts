import { describe, expect, it } from "vitest";
import { CHART_OF_ACCOUNTS } from "../shared/chartOfAccounts";
import { isSkipped, mapPeriodInventoryClosing, mapYearEndProfitClosing, type MappingResult } from "../shared/journalMapping";
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

describe("pemetaan jurnal penilaian persediaan", () => {
  const memo = "Penutupan periode 2026-09-01 s.d. 2026-09-30";

  it("membalik persediaan akhir periode sebelumnya sekaligus membukukan yang baru, dalam satu jurnal", () => {
    // Keputusan pengguna 2: seluruhnya jatuh di dalam periode yang ditutup, tidak ada jurnal yang
    // ditulis ke periode lain, dan idempotensinya cukup dijaga satu kunci sumber.
    expect(linesOf(mapPeriodInventoryClosing({ priorClosingValue: "180000000.00", closingValue: "203750000.00", memo }))).toEqual([
      { accountCode: "5-1100", side: "DEBIT", amount: "180000000.00", memo },
      { accountCode: "1-1210", side: "KREDIT", amount: "180000000.00", memo },
      { accountCode: "1-1210", side: "DEBIT", amount: "203750000.00", memo },
      { accountCode: "5-1300", side: "KREDIT", amount: "203750000.00", memo },
    ]);
  });

  it("menghilangkan sisi persediaan awal pada periode pertama yang dinilai", () => {
    expect(linesOf(mapPeriodInventoryClosing({ priorClosingValue: "0.00", closingValue: "203750000.00", memo }))).toEqual([
      { accountCode: "1-1210", side: "DEBIT", amount: "203750000.00", memo },
      { accountCode: "5-1300", side: "KREDIT", amount: "203750000.00", memo },
    ]);
  });

  it("menghilangkan sisi persediaan akhir bila seluruh valuta habis terjual", () => {
    expect(linesOf(mapPeriodInventoryClosing({ priorClosingValue: "180000000.00", closingValue: "0.00", memo }))).toEqual([
      { accountCode: "5-1100", side: "DEBIT", amount: "180000000.00", memo },
      { accountCode: "1-1210", side: "KREDIT", amount: "180000000.00", memo },
    ]);
  });

  it("melewati periode yang tidak punya persediaan di kedua sisi", () => {
    expect(reasonOf(mapPeriodInventoryClosing({ priorClosingValue: "0.00", closingValue: "0.00", memo }))).toMatch(/tidak ada persediaan/i);
  });

  it("menolak nilai negatif alih-alih menjurnal persediaan minus", () => {
    expect(reasonOf(mapPeriodInventoryClosing({ priorClosingValue: "0.00", closingValue: "-1.00", memo }))).toMatch(/negatif/i);
  });

  it("selalu seimbang dengan akun yang ada di bagan akun", () => {
    const lines = linesOf(mapPeriodInventoryClosing({ priorClosingValue: "1.23", closingValue: "9876543.21", memo }));
    expect(() => assertJournalIsPostable(lines)).not.toThrow();
    for (const line of lines) expect(knownCodes.has(line.accountCode)).toBe(true);
  });
});

describe("pemetaan jurnal penutup laba tahunan", () => {
  const memo = "Penutup laba tahun buku 2026";

  it("menolkan akun laba rugi dan memindahkan labanya ke laba ditahan", () => {
    const lines = linesOf(mapYearEndProfitClosing({
      memo,
      balances: [
        { accountCode: "4-1100", balance: "500000000.00" },
        { accountCode: "5-1200", balance: "430000000.00" },
        { accountCode: "6-1100", balance: "30000000.00" },
      ],
    }));
    expect(lines).toEqual([
      { accountCode: "4-1100", side: "DEBIT", amount: "500000000.00", memo },
      { accountCode: "5-1200", side: "KREDIT", amount: "430000000.00", memo },
      { accountCode: "6-1100", side: "KREDIT", amount: "30000000.00", memo },
      { accountCode: "3-2100", side: "KREDIT", amount: "40000000.00", memo },
    ]);
  });

  it("mendebit laba ditahan bila tahun itu rugi", () => {
    const lines = linesOf(mapYearEndProfitClosing({
      memo,
      balances: [{ accountCode: "4-1100", balance: "100000000.00" }, { accountCode: "6-1100", balance: "150000000.00" }],
    }));
    expect(lines.at(-1)).toEqual({ accountCode: "3-2100", side: "DEBIT", amount: "50000000.00", memo });
  });

  it("menutup akun lawan pada arah yang benar", () => {
    // 5-1300 bersaldo normal kredit dan mengurangi harga pokok; menutupnya mendebit, dan itu
    // menambah laba — bukan menguranginya.
    const lines = linesOf(mapYearEndProfitClosing({ memo, balances: [{ accountCode: "5-1300", balance: "203750000.00" }] }));
    expect(lines[0]).toEqual({ accountCode: "5-1300", side: "DEBIT", amount: "203750000.00", memo });
    expect(lines.at(-1)).toEqual({ accountCode: "3-2100", side: "KREDIT", amount: "203750000.00", memo });
  });

  it("mengabaikan akun neraca dan akun bersaldo nol", () => {
    const lines = linesOf(mapYearEndProfitClosing({
      memo,
      balances: [
        { accountCode: "1-1110", balance: "900000000.00" },
        { accountCode: "3-1100", balance: "500000000.00" },
        { accountCode: "6-1200", balance: "0.00" },
        { accountCode: "4-1100", balance: "1000000.00" },
      ],
    }));
    expect(lines.map((line) => line.accountCode)).toEqual(["4-1100", "3-2100"]);
  });

  it("melewati tahun yang tidak punya saldo laba rugi sama sekali", () => {
    expect(reasonOf(mapYearEndProfitClosing({ memo, balances: [{ accountCode: "1-1110", balance: "5.00" }] }))).toMatch(/tidak ada saldo/i);
  });

  it("menolak akun yang tidak ada pada bagan akun alih-alih menebaknya", () => {
    expect(reasonOf(mapYearEndProfitClosing({ memo, balances: [{ accountCode: "9-9999", balance: "5.00" }] }))).toMatch(/bagan akun/i);
  });

  it("selalu menghasilkan jurnal seimbang", () => {
    const lines = linesOf(mapYearEndProfitClosing({
      memo,
      balances: [
        { accountCode: "4-1100", balance: "123456789.12" },
        { accountCode: "5-1200", balance: "98765432.10" },
        { accountCode: "5-1300", balance: "1000.55" },
        { accountCode: "7-1200", balance: "250000.33" },
        { accountCode: "8-1100", balance: "1500000.00" },
      ],
    }));
    expect(() => assertJournalIsPostable(lines)).not.toThrow();
    for (const line of lines) expect(knownCodes.has(line.accountCode)).toBe(true);
  });
});
