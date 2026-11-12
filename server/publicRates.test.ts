import { describe, expect, it } from "vitest";
import { buildRateShareText, latestPublicRateEffectiveAt, rateChange, sortPublicRates, type PublicRateRow } from "../shared/publicRates";

const rates: PublicRateRow[] = [
  { currency: { id: 2, code: "USD", name: "Dolar Amerika Serikat" }, tier: null, rate: { id: 2, buyRate: "16000", sellRate: "16100", quoteUnit: "1", effectiveAt: new Date("2026-08-19T03:00:00.000Z") } },
  { currency: { id: 1, code: "AUD", name: "Dolar Australia" }, tier: null, rate: { id: 1, buyRate: "10200", sellRate: "10300", quoteUnit: "1", effectiveAt: new Date("2026-08-19T02:00:00.000Z") } },
  { currency: { id: 3, code: "JPY", name: "Yen Jepang" }, tier: null, rate: { id: 3, buyRate: "105", sellRate: "108", quoteUnit: "100", effectiveAt: new Date("2026-08-19T04:00:00.000Z") } },
];

describe("public rate transparency", () => {
  it("keeps every active row and orders the board by currency code", () => {
    const ordered = sortPublicRates(rates);

    expect(ordered).toHaveLength(3);
    expect(ordered.map((item) => item.currency.code)).toEqual(["AUD", "JPY", "USD"]);
    expect(rates.map((item) => item.currency.code)).toEqual(["USD", "AUD", "JPY"]);
  });

  it("uses the newest effective timestamp for the public update label", () => {
    expect(latestPublicRateEffectiveAt(rates)?.toISOString()).toBe("2026-08-19T04:00:00.000Z");
    expect(latestPublicRateEffectiveAt([])).toBeNull();
  });

  it("menampilkan kelompok pecahan di bawah valutanya, berurutan", () => {
    const withTiers: PublicRateRow[] = [
      { currency: { id: 2, code: "USD", name: "Dolar Amerika Serikat" }, tier: null, rate: { id: 5, buyRate: "16000", sellRate: "16100", quoteUnit: "1", effectiveAt: new Date("2026-09-16T02:00:00.000Z") } },
      { currency: { id: 2, code: "USD", name: "Dolar Amerika Serikat" }, tier: { id: 1, label: "100" }, rate: { id: 6, buyRate: "16290", sellRate: "16400", quoteUnit: "1", effectiveAt: new Date("2026-09-16T02:00:00.000Z") } },
      { currency: { id: 1, code: "AUD", name: "Dolar Australia" }, tier: null, rate: { id: 7, buyRate: "10200", sellRate: "10300", quoteUnit: "1", effectiveAt: new Date("2026-09-16T02:00:00.000Z") } },
    ];
    expect(sortPublicRates(withTiers).map((row) => `${row.currency.code} ${row.tier?.label ?? "-"}`)).toEqual(["AUD -", "USD 100", "USD -"]);
  });
});

describe("perubahan kurs dan pesan WhatsApp (halaman publik 12 Nov 2026)", () => {
  const at = new Date("2026-11-12T02:15:00.000Z"); // 09.15 WIB
  const row = (code: string, id: number, buy: string, sell: string, previous: PublicRateRow["previous"], tier: PublicRateRow["tier"] = null, quoteUnit = "1"): PublicRateRow =>
    ({ currency: { id, code, name: code }, tier, previous, rate: { id: id * 10 + (tier?.id ?? 0), buyRate: buy, sellRate: sell, quoteUnit, effectiveAt: at } });

  it("dibanding kurs sebelumnya per arah pelanggan; tanpa pembanding bukan 'Tetap'", () => {
    const usd = row("USD", 1, "16310.000000", "16420.000000", { buyRate: "16280.000000", sellRate: "16420.000000" });
    expect(rateChange(usd, "SELL")).toEqual({ kind: "up", amount: "30" });
    expect(rateChange(usd, "BUY")).toEqual({ kind: "flat", amount: "0" });
    expect(rateChange({ ...usd, previous: { buyRate: "16320", sellRate: "16500.5" } }, "BUY")).toEqual({ kind: "down", amount: "80.5" });
    expect(rateChange({ ...usd, previous: null }, "SELL")).toEqual({ kind: "none", amount: "0" });
  });

  it("kelompok pecahan diurut menurut sortOrder, bukan abjad", () => {
    const rows = [row("USD", 1, "1", "1", null, { id: 3, label: "5–20", sortOrder: 2 }), row("USD", 1, "1", "1", null, { id: 2, label: "50", sortOrder: 1 }), row("USD", 1, "1", "1", null, { id: 1, label: "100", sortOrder: 0 })];
    expect(sortPublicRates(rows).map((item) => item.tier?.label)).toEqual(["100", "50", "5–20"]);
  });

  it("pesan: judul + empat valuta teratas urutan papan (satu baris per valuta) + tautan", () => {
    const rows = [
      row("USD", 6, "16310", "16420", null, { id: 1, label: "100", sortOrder: 0 }),
      row("USD", 6, "16100", "16380", null, { id: 2, label: "5–20", sortOrder: 1 }),
      row("SAR", 5, "4320", "4390", null),
      row("JPY", 4, "10650", "10900", null, null, "100.000000"),
      row("EUR", 3, "18900", "19150", null),
      row("AUD", 1, "10650", "10850", null),
    ];
    expect(buildRateShareText(rows, { tradingName: "Ibukota Valasindo", url: "https://ibukotavalasindo.online" })).toBe([
      "Kurs Ibukota Valasindo, 12 November 2026 pukul 09.15 WIB",
      "AUD per 1 AUD: Anda jual Rp 10.650; Anda beli Rp 10.850.",
      "EUR per 1 EUR: Anda jual Rp 18.900; Anda beli Rp 19.150.",
      "JPY per 100 JPY: Anda jual Rp 10.650; Anda beli Rp 10.900.",
      "SAR per 1 SAR: Anda jual Rp 4.320; Anda beli Rp 4.390.",
      "Kurs perkiraan. Cek yang terbaru: https://ibukotavalasindo.online",
    ].join("\n"));
    expect(buildRateShareText([], { tradingName: "X", url: "https://x" })).toBeNull();
  });
});
