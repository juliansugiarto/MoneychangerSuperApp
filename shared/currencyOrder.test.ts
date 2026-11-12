import { describe, expect, it } from "vitest";
import { checkCurrencyOrder, compareCurrencyOrder } from "./currencyOrder";
import { buildRateShareText, sortPublicRates, type PublicRateRow } from "./publicRates";

describe("urutan papan valuta", () => {
  it("yang berurut lebih dulu; tanpa urutan menyusul menurut abjad kode", () => {
    const list = [{ code: "AUD" }, { code: "SAR", boardOrder: 2 }, { code: "EUR", boardOrder: null }, { code: "USD", boardOrder: 1 }];
    expect([...list].sort(compareCurrencyOrder).map((item) => item.code)).toEqual(["USD", "SAR", "AUD", "EUR"]);
  });

  it("penjaga: daftar lengkap valuta aktif, tanpa ganda, tanpa id asing", () => {
    expect(checkCurrencyOrder([2, 1, 3], [1, 2, 3])).toEqual({ ok: true });
    expect(checkCurrencyOrder([1, 1, 3], [1, 2, 3])).toMatchObject({ ok: false, error: expect.stringContaining("dua kali") });
    expect(checkCurrencyOrder([1, 2], [1, 2, 3])).toMatchObject({ ok: false, error: expect.stringContaining("berubah") });
    expect(checkCurrencyOrder([1, 2, 9], [1, 2, 3])).toMatchObject({ ok: false });
  });

  it("halaman publik dan pesan WhatsApp mengikuti urutan pemilik", () => {
    const at = new Date("2026-11-12T02:15:00Z");
    const row = (code: string, id: number, boardOrder: number | null): PublicRateRow => ({ currency: { id, code, name: code, boardOrder }, tier: null, previous: null, rate: { id, buyRate: "100", sellRate: "110", quoteUnit: "1", effectiveAt: at } });
    const rows = [row("AUD", 1, null), row("EUR", 2, null), row("SAR", 3, 2), row("USD", 4, 1), row("GBP", 5, null)];
    expect(sortPublicRates(rows).map((item) => item.currency.code)).toEqual(["USD", "SAR", "AUD", "EUR", "GBP"]);
    const lines = buildRateShareText(rows, { tradingName: "X", url: "https://x" })!.split("\n");
    expect(lines.slice(1, 5).map((line) => line.split(" ")[0])).toEqual(["USD", "SAR", "AUD", "EUR"]);
  });
});
