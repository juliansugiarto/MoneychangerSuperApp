import { describe, expect, it } from "vitest";
import { notaStatement } from "./notaStatement";

describe("pernyataan nasabah di kwitansi", () => {
  it("kwitansi jual tanpa underlying memuat pernyataan belum melebihi USD 10.000", () => {
    expect(notaStatement({ operation: "SELL", underlyingRequired: false })).toContain("saya menyatakan bahwa total pembelian valuta asing saya bulan ini belum melebihi USD 10.000");
  });

  it("kwitansi jual dengan underlying tidak meminta pernyataan di bawah ambang", () => {
    const text = notaStatement({ operation: "SELL", underlyingRequired: true });
    expect(text).not.toContain("saya menyatakan");
    expect(text).toContain("disertai dokumen pendukung.");
  });

  it("kwitansi beli (nasabah menjual valas) tidak memuat ambang pembelian", () => {
    const text = notaStatement({ operation: "BUY", underlyingRequired: false });
    expect(text).not.toContain("USD 10.000");
    expect(text).toContain("fotokopi kartu identitas");
  });
});
