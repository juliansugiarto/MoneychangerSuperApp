import { describe, expect, it } from "vitest";
import { pricedRowRupiah } from "./rupiahRounding";

describe("Rupiah baris bon dibulatkan ke atas ke Rp 100", () => {
  it("angka bulat tidak berubah", () => {
    expect(pricedRowRupiah("100", 5, "16250", "1").toFixed(2)).toBe("8125000.00");
  });

  it("JPY 1.000 pada kurs 10.537 per 100 = Rp 105.370 → Rp 105.400", () => {
    expect(pricedRowRupiah("1000", 1, "10537", "100").toFixed(2)).toBe("105400.00");
  });

  it("selisih sen pun dibulatkan ke atas, tidak pernah ke bawah", () => {
    expect(pricedRowRupiah("1", 1, "16250.01", "1").toFixed(2)).toBe("16300.00");
  });
});
