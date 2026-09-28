import { describe, expect, it } from "vitest";
import { hasActiveBlock, matchKeyOf, shouldOpenScreeningBlock, summarizeAttemptLines, WATCHLIST_BLOCK_TELLER_MESSAGE } from "./watchlistBlock";

describe("matchKeyOf", () => {
  it("memakai referenceCode bila ada — id entri berganti setiap impor", () => {
    expect(matchKeyOf({ listType: "DTTOT", referenceCode: "IDN-001", fullName: "Abdul" })).toBe("DTTOT:IDN-001");
  });
  it("memakai nama ternormalisasi bila tanpa kode", () => {
    expect(matchKeyOf({ listType: "DPPSPM", referenceCode: null, fullName: "  Abdul   Rahman " })).toBe("DPPSPM:ABDUL RAHMAN");
  });
});

describe("shouldOpenScreeningBlock", () => {
  it("membuka bila belum ada blokir", () => {
    expect(shouldOpenScreeningBlock([], ["DTTOT:A"])).toBe(true);
  });
  it("tidak membuka bila tidak ada kunci (penyaringan nihil)", () => {
    expect(shouldOpenScreeningBlock([], [])).toBe(false);
  });
  it("tidak membuka bila sudah ada OPEN atau CONFIRMED", () => {
    expect(shouldOpenScreeningBlock([{ status: "OPEN", matchKeys: null }], ["DTTOT:A"])).toBe(false);
    expect(shouldOpenScreeningBlock([{ status: "CONFIRMED", matchKeys: "[\"DTTOT:A\"]" }], ["DTTOT:B"])).toBe(false);
  });
  it("tidak membuka ulang kunci yang sudah dinyatakan salah sasaran", () => {
    expect(shouldOpenScreeningBlock([{ status: "FALSE_POSITIVE", matchKeys: "[\"DTTOT:A\",\"DTTOT:B\"]" }], ["DTTOT:B"])).toBe(false);
  });
  it("membuka bila ada kunci BARU di luar keputusan salah sasaran", () => {
    expect(shouldOpenScreeningBlock([{ status: "FALSE_POSITIVE", matchKeys: "[\"DTTOT:A\"]" }], ["DTTOT:A", "DPPSPM:C"])).toBe(true);
  });
  it("salah sasaran tanpa kunci (pengisian awal) tidak mencakup apa pun", () => {
    expect(shouldOpenScreeningBlock([{ status: "FALSE_POSITIVE", matchKeys: null }], ["DTTOT:A"])).toBe(true);
  });
  it("DICABUT tidak menghalangi pembukaan baru", () => {
    expect(shouldOpenScreeningBlock([{ status: "DICABUT", matchKeys: "[\"DTTOT:A\"]" }], ["DTTOT:A"])).toBe(true);
  });
});

describe("hasActiveBlock", () => {
  it("OPEN dan CONFIRMED menahan; FALSE_POSITIVE dan DICABUT tidak", () => {
    expect(hasActiveBlock([{ status: "OPEN", matchKeys: null }])).toBe(true);
    expect(hasActiveBlock([{ status: "CONFIRMED", matchKeys: null }])).toBe(true);
    expect(hasActiveBlock([{ status: "FALSE_POSITIVE", matchKeys: null }, { status: "DICABUT", matchKeys: null }])).toBe(false);
  });
});

describe("summarizeAttemptLines", () => {
  it("menjumlah valas dan Rupiah per baris", () => {
    const result = summarizeAttemptLines(
      [{ currencyId: 2, denominations: [{ value: "100", quantity: 3, rate: "16000" }, { value: "50", quantity: 1, rate: "15900" }] }],
      new Map([[2, "USD"]]),
    );
    expect(result.lines).toEqual([{ currencyId: 2, currencyCode: "USD", foreignAmount: "350.00", idrAmount: "5595000.00" }]);
    expect(result.totalIdr).toBe("5595000.00");
  });
  it("membagi dengan quoteUnit seperti bon (JPY per 100)", () => {
    const result = summarizeAttemptLines([{ currencyId: 3, quoteUnit: "100", denominations: [{ value: "10000", quantity: 2, rate: "10500" }] }], new Map([[3, "JPY"]]));
    expect(result.lines[0]).toMatchObject({ foreignAmount: "20000.00", idrAmount: "2100000.00" });
  });
  it("baris cacat dicatat apa adanya dengan nol, tidak menggagalkan pencatatan", () => {
    const result = summarizeAttemptLines([{ currencyId: 9, denominations: [{ value: "abc", quantity: 1, rate: "x" }] }], new Map());
    expect(result.lines[0]).toMatchObject({ currencyId: 9, currencyCode: null, idrAmount: "0.00" });
    expect(result.totalIdr).toBe("0.00");
  });
});

it("pesan kasir netral", () => {
  expect(WATCHLIST_BLOCK_TELLER_MESSAGE).toBe("Transaksi tidak dapat diproses. Hubungi Controller. Jangan sampaikan alasannya kepada nasabah.");
});
