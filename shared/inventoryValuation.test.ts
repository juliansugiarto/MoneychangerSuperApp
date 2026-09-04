import { describe, expect, it } from "vitest";
import { midClosingRate, valueForeignInventory } from "./inventoryValuation";

const usd = { buyRate: "16200.000000", sellRate: "16400.000000", quoteUnit: "1.000000" };
/** BI mengutip JPY per 100 unit — kolom quoteUnit ada persis untuk ini. */
const jpy = { buyRate: "10800.000000", sellRate: "11000.000000", quoteUnit: "100.000000" };

describe("kurs tengah penutup", () => {
  it("mengambil titik tengah kurs beli dan jual BI", () => {
    expect(midClosingRate(usd)).toBe("16300.000000000000");
  });

  it("membagi dengan quoteUnit, sehingga JPY tidak meleset seratus kali", () => {
    expect(midClosingRate(jpy)).toBe("109.000000000000");
  });

  it("menolak quoteUnit nol atau negatif alih-alih menghasilkan tak hingga", () => {
    expect(() => midClosingRate({ ...usd, quoteUnit: "0.000000" })).toThrow(/quoteUnit/i);
    expect(() => midClosingRate({ ...usd, quoteUnit: "-1.000000" })).toThrow(/quoteUnit/i);
  });

  it("menolak kurs yang bukan angka", () => {
    expect(() => midClosingRate({ ...usd, buyRate: "" })).toThrow(/kurs/i);
  });
});

describe("penilaian persediaan valuta", () => {
  it("mengalikan kuantitas fisik dengan kurs tengah", () => {
    expect(valueForeignInventory({ ...usd, quantity: "12500.000000" })).toEqual({
      midRatePerUnit: "16300.000000000000",
      rupiahValue: "203750000.00",
    });
  });

  it("menghormati quoteUnit pada nilai akhirnya", () => {
    expect(valueForeignInventory({ ...jpy, quantity: "50000.000000" }).rupiahValue).toBe("5450000.00");
  });

  it("membulatkan setengah-ke-atas ke sen — pengukuran baru, bukan konversi uang tercatat", () => {
    // Keputusan spec bagian 7: menolak membulatkan di sini akan menggagalkan hampir setiap
    // penutupan periode, karena kuantitas dikali kurs hampir tidak pernah jatuh pas di sen.
    const result = valueForeignInventory({ buyRate: "16200.005000", sellRate: "16200.010000", quoteUnit: "1.000000", quantity: "1.000000" });
    expect(result.rupiahValue).toBe("16200.01");
  });

  it("menilai persediaan kosong sebagai nol, bukan galat", () => {
    expect(valueForeignInventory({ ...usd, quantity: "0.000000" }).rupiahValue).toBe("0.00");
  });

  it("menolak kuantitas negatif — hitungan fisik tidak pernah negatif", () => {
    expect(() => valueForeignInventory({ ...usd, quantity: "-1.000000" })).toThrow(/kuantitas/i);
  });
});
