import { describe, expect, it } from "vitest";
import { isSkipped, mapCashMovement, mapExchangeTransaction, type MappingResult } from "../shared/journalMapping";
import { formatAmount, parseAmount } from "../shared/ledger";

/** Saldo satu akun dari serangkaian hasil pemetaan. */
function balanceOf(code: string, results: MappingResult[]) {
  let cents = 0n;
  for (const result of results) {
    if (isSkipped(result)) continue;
    for (const line of result.lines) {
      if (line.accountCode !== code) continue;
      cents += line.side === "DEBIT" ? parseAmount(line.amount) : -parseAmount(line.amount);
    }
  }
  return formatAmount(cents);
}

describe("satu hari operasional: setor modal, kas awal, beli, jual", () => {
  it("meninggalkan Kas Rupiah positif dan sama dengan uang yang benar-benar ada", () => {
    // Urutan yang benar: modal masuk lebih dulu, baru hitungan kas pagi — sehingga selisih
    // pembukaannya nol dan tidak ada uang yang muncul tanpa asal.
    const results = [
      mapCashMovement({ category: "CAPITAL_INJECTION", amount: "500000000.000000", currencyCode: "IDR", reason: "Setoran modal awal", isFirstMovementForCurrency: false }),
      mapCashMovement({ category: "OPENING", amount: "0.000000", currencyCode: "IDR", reason: "Kas awal", isFirstMovementForCurrency: false }),
      mapExchangeTransaction({ operation: "BUY", paymentMethod: "CASH", rupiahAmount: "150000000.00", transactionNumber: "FX-1" }),
      mapExchangeTransaction({ operation: "SELL", paymentMethod: "CASH", rupiahAmount: "160000000.00", transactionNumber: "FX-2" }),
    ];
    // 500.000.000 − 150.000.000 + 160.000.000
    expect(balanceOf("1-1110", results)).toBe("510000000.00");
    expect(balanceOf("3-1100", results)).toBe("-500000000.00"); // kredit, saldo normal ekuitas
  });

  it("membuat Kas Rupiah negatif bila modalnya tidak pernah dicatat — inilah gejala yang diperbaiki paket ini", () => {
    const tanpaModal = [
      mapExchangeTransaction({ operation: "BUY", paymentMethod: "CASH", rupiahAmount: "150000000.00", transactionNumber: "FX-1" }),
    ];
    expect(balanceOf("1-1110", tanpaModal)).toBe("-150000000.00");
  });

  it("tidak menghitung uang bon dua kali ketika mutasi kas bon ikut diproses", () => {
    const results = [
      mapExchangeTransaction({ operation: "BUY", paymentMethod: "CASH", rupiahAmount: "150000000.00", transactionNumber: "FX-1" }),
      mapCashMovement({ category: "TRANSACTION", amount: "150000000.000000", currencyCode: "IDR", reason: "TRANSACTION_BUY_FX-1_IDR", isFirstMovementForCurrency: false }),
    ];
    expect(balanceOf("1-1110", results)).toBe("-150000000.00");
  });
});
