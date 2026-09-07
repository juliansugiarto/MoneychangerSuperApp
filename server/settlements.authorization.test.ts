import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./settlements", () => ({
  listOutstandingSettlements: vi.fn(),
  recordSettlement: vi.fn(),
}));

import { appRouter } from "./routers";
import { listOutstandingSettlements, recordSettlement } from "./settlements";

function createCaller(role: "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER") {
  return appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user: { id: 9, role, mustChangePassword: false } as never });
}

const pembayaran = {
  direction: "PEMBAYARAN" as const, targetType: "BEBAN" as const, expenseId: 4,
  amount: "400000", method: "KAS" as const, currencyId: 1,
  settlementDate: "2026-09-10", notes: "Pembayaran sewa ruko September",
  denominations: [{ value: "100000", quantity: 4 }],
};

/**
 * Otorisasi pelunasan ditegakkan di server.
 *
 * Panelnya memang hanya tampil bagi Controller ke atas, tetapi menyembunyikan panel bukan
 * otorisasi. Pelunasan mengeluarkan uang dari laci dan mendebit kewajiban sekaligus — keduanya
 * angka laporan keuangan, dan peran yang sama dengan setoran modal berlaku di sini.
 */
describe("otorisasi pelunasan kewajiban", () => {
  beforeEach(() => {
    vi.mocked(listOutstandingSettlements).mockReset();
    vi.mocked(recordSettlement).mockReset();
  });

  it("hanya membuka daftar tagihan bagi Controller ke atas", async () => {
    await expect(createCaller("STAFF").cash.outstandingSettlements()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").cash.outstandingSettlements()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listOutstandingSettlements).not.toHaveBeenCalled();

    vi.mocked(listOutstandingSettlements).mockResolvedValue({ payables: [], receivables: [] } as never);
    await expect(createCaller("CONTROLLER").cash.outstandingSettlements()).resolves.toBeTruthy();
    await expect(createCaller("SHAREHOLDER").cash.outstandingSettlements()).resolves.toBeTruthy();
  });

  it("hanya mengizinkan Controller ke atas mencatat pelunasan", async () => {
    await expect(createCaller("STAFF").cash.recordSettlement(pembayaran)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").cash.recordSettlement(pembayaran)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(recordSettlement).not.toHaveBeenCalled();

    vi.mocked(recordSettlement).mockResolvedValue({ targetType: "BEBAN", targetId: 4, amount: "400000.00", outstandingAfter: "600000.00" } as never);
    await expect(createCaller("CONTROLLER").cash.recordSettlement(pembayaran)).resolves.toBeTruthy();
  });

  it("menolak tanggal yang bukan YYYY-MM-DD sebelum menyentuh basis data", async () => {
    // `z.coerce.date()` menghasilkan tengah malam UTC dan memundurkan tanggalnya satu hari pada
    // mesin WIB — bug paket K1. Tanggal karena itu dikirim sebagai string, seperti router aset tetap.
    await expect(createCaller("CONTROLLER").cash.recordSettlement({ ...pembayaran, settlementDate: "10-09-2026" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(recordSettlement).not.toHaveBeenCalled();
  });

  it("menolak pelunasan tunai tanpa rincian pecahan sebelum menyentuh basis data", async () => {
    await expect(createCaller("CONTROLLER").cash.recordSettlement({ ...pembayaran, denominations: [] }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(recordSettlement).not.toHaveBeenCalled();
  });
});
