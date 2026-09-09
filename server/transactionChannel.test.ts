import { describe, expect, it } from "vitest";
import { IRA_DISTRIBUTION_CHANNELS } from "../shared/iraVocabulary";
import { transactionCreateInput } from "./routers";

/**
 * Jalur distribusi pada bon — sumber parameter TPPU/TPPT 2a/2b Form C1.
 *
 * Satu kolom keterangan. Tugas ini tidak menyentuh sisi pecahan valuta maupun sisi Rupiah bon.
 */

const bonTunai = {
  operation: "BUY" as const,
  customerId: 1,
  receiptNumber: "1201",
  lines: [{ currencyId: 2, denominations: [{ value: "100", quantity: 3, rate: "16000" }] }],
  paymentMethod: "CASH" as const,
  paymentDenominations: [{ value: "100000", quantity: 480 }],
  transactionAt: new Date("2026-09-09T03:00:00.000Z"),
};

describe("jalur distribusi pada bon", () => {
  it("bon tanpa pilihan tersimpan KANTOR", () => {
    const parsed = transactionCreateInput.parse(bonTunai);
    // Kasir tidak dipaksa memilih hal yang hampir selalu sama; bawaannya diputuskan di satu tempat
    // dan bukan diserahkan kepada borang, sehingga pemanggil mana pun mendapat nilai yang sama.
    expect(parsed.distributionChannel).toBe("KANTOR");
  });

  it("bon dengan LAYANAN_DELIVERY tersimpan apa adanya", () => {
    const parsed = transactionCreateInput.parse({ ...bonTunai, distributionChannel: "LAYANAN_DELIVERY" });
    expect(parsed.distributionChannel).toBe("LAYANAN_DELIVERY");
  });

  it("menerima ketiga jalur pada kosakata, tidak kurang", () => {
    for (const channel of IRA_DISTRIBUTION_CHANNELS) {
      expect(transactionCreateInput.parse({ ...bonTunai, distributionChannel: channel }).distributionChannel).toBe(channel);
    }
  });

  it("nilai di luar enum ditolak Zod", () => {
    const hasil = transactionCreateInput.safeParse({ ...bonTunai, distributionChannel: "WHATSAPP" });
    expect(hasil.success).toBe(false);
  });

  it("tidak menyentuh sisi pecahan: rincian Rupiah tetap wajib pada bon tunai", () => {
    // Penjaga terhadap tugas ini merembet ke kaki lain transaksi. Bila aturan pecahan berubah
    // karena penambahan satu kolom keterangan, yang berubah adalah hal yang salah.
    const hasil = transactionCreateInput.safeParse({ ...bonTunai, paymentDenominations: undefined, distributionChannel: "ONLINE_MERCHANT" });
    expect(hasil.success).toBe(false);
    expect(JSON.stringify(hasil.error?.issues)).toMatch(/pecahan Rupiah/i);
  });
});
