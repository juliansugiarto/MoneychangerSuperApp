import { describe, expect, it } from "vitest";
import type { PublicRateRow } from "@shared/publicRates";
import { barcodeBars, changeLabel, estimateTotal, faqItems, identityFrom, mrz, parseAmount, toRateViews, whatsappHref } from "./viewModel";

const at = new Date("2026-11-12T02:15:00Z");
const row = (code: string, id: number, buy: string, sell: string, tier: PublicRateRow["tier"] = null, quoteUnit = "1.000000", previous: PublicRateRow["previous"] = null): PublicRateRow =>
  ({ currency: { id, code, name: code }, tier, previous, rate: { id: id * 10 + (tier?.id ?? 0), buyRate: buy, sellRate: sell, quoteUnit, effectiveAt: at } });

describe("baris kurs halaman publik", () => {
  it("pecahan: kelompok, pecahan lainnya, semua pecahan, dan satuan per 100", () => {
    const views = toRateViews([
      row("USD", 1, "16100", "16380"),
      row("USD", 1, "16310", "16420", { id: 1, label: "100", sortOrder: 0 }, "1.000000", { buyRate: "16280", sellRate: "16420" }),
      row("JPY", 2, "10650", "10900", null, "100.000000"),
      row("SAR", 3, "4320.5", "4390"),
    ]);
    expect(views.map((view) => [view.code, view.den, view.mden, view.unitText])).toEqual([
      ["JPY", "Semua pecahan", "per 100", "Per 100 JPY"],
      ["SAR", "Semua pecahan", "semua", "Per 1 SAR"],
      ["USD", "100 USD", "100", "Per 1 USD"],
      ["USD", "Pecahan lainnya", "lainnya", "Per 1 USD"],
    ]);
    expect(views[2]).toMatchObject({ jual: 16310, beli: 16420 });
    expect(changeLabel(views[2].chg.jual)).toEqual({ k: "up", t: "Naik 30" });
    expect(changeLabel(views[2].chg.beli)).toEqual({ k: "flat", t: "Tetap" });
    expect(changeLabel(views[0].chg.jual)).toEqual({ k: "none", t: "Belum ada pembanding" });
  });

  it("total memakai pembulatan kasir: ke atas kelipatan Rp 100, kurs per satuan kutipan", () => {
    const [jpy, sar] = toRateViews([row("JPY", 2, "10650", "10900", null, "100.000000"), row("SAR", 3, "4320.5", "4390")]);
    expect(estimateTotal(sar, "jual", "3")).toBe(13000); // 12.961,5 → 13.000
    expect(estimateTotal(sar, "beli", "500")).toBe(2195000); // tepat kelipatan, tidak dinaikkan
    expect(estimateTotal(jpy, "jual", "10000")).toBe(1065000);
  });
});

describe("jumlah valas", () => {
  it("menerima format Indonesia dan menolak yang tidak terbaca", () => {
    expect(parseAmount("1.500")).toEqual({ value: "1500" });
    expect(parseAmount("1.500,5")).toEqual({ value: "1500.5" });
    expect(parseAmount("500,25")).toEqual({ value: "500.25" });
    expect(parseAmount("500.25")).toEqual({ value: "500.25" });
    expect(parseAmount(" ")).toEqual({ error: "empty" });
    expect(parseAmount("-5")).toEqual({ error: "neg" });
    expect(parseAmount("0")).toEqual({ error: "neg" });
    expect(parseAmount("lima")).toEqual({ error: "nan" });
  });
});

describe("identitas dari profil", () => {
  it("kota dan jalan diturunkan dari alamat; tanpa alamat tidak ditebak", () => {
    expect(identityFrom({ tradingName: "Ibukota Valasindo", address: "Jl. Mangunsarkoro No. 35, Solokpandan, Cianjur" })).toEqual({ name: "Ibukota Valasindo", initials: "IV", city: "Cianjur", street: "Jl. Mangunsarkoro" });
    expect(identityFrom({ tradingName: "Valas Terang", address: null })).toMatchObject({ city: null, street: null });
  });

  it("MRZ, WhatsApp, dan kode batang", () => {
    expect(mrz("Ibukota Valasindo")).toBe("IBUKOTA<VALASINDO");
    expect(mrz("Senin–Sabtu: 09.00–17.00 WIB")).toBe("SENIN<SABTU<09<00<17<00<WIB");
    expect(whatsappHref("0811-260-269")).toBe("https://wa.me/62811260269");
    expect(whatsappHref("+62 811 260 269")).toBe("https://wa.me/62811260269");
    expect(whatsappHref(null)).toBeNull();
    expect(barcodeBars("12").bars.length).toBe(4);
  });
});

describe("pertanyaan umum", () => {
  it("bawaan + jawaban lokasi dan kontak dari profil; FAQ sendiri menggantikan semuanya", () => {
    const day = { open: "09:00", close: "17:00" };
    const items = faqItems(null, { address: "Jl. Mangunsarkoro No. 35, Solokpandan, Cianjur", openingSchedule: [day, day, day, day, day, day, null], timezone: "Asia/Jakarta", phone: "(0263) 265-500" });
    expect(items).toHaveLength(10);
    expect(items[8].answer).toBe("Kami di Jl. Mangunsarkoro No. 35, Solokpandan, Cianjur. Buka Senin–Sabtu, 09.00–17.00 WIB. Minggu tutup.");
    expect(items[9].answer).toContain("telepon (0263) 265-500.");
    expect(faqItems(null, {})).toHaveLength(8);
    expect(faqItems([{ question: "Q", answer: "A" }], { phone: "1" })).toEqual([{ question: "Q", answer: "A" }]);
  });
});
