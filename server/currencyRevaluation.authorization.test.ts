import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./currencyRevaluation", () => ({
  buildCurrencyRevaluation: vi.fn(),
  postCurrencyRevaluation: vi.fn(),
}));

import { buildCurrencyRevaluation, postCurrencyRevaluation } from "./currencyRevaluation";
import { appRouter } from "./routers";

function createCaller(role: "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER") {
  return appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user: { id: 9, role, mustChangePassword: false } as never });
}

/**
 * Otorisasi revaluasi kurs ditegakkan di server.
 *
 * Panelnya memang hanya tampil bagi Controller ke atas, tetapi menyembunyikan panel bukan
 * otorisasi: prosedurnya dapat dipanggil langsung. Menjurnalkan revaluasi mengubah 1-1220 dan
 * 7-1500 sekaligus membuka kunci penutupan periode — keduanya angka laporan keuangan.
 */
describe("otorisasi revaluasi kurs", () => {
  beforeEach(() => {
    vi.mocked(buildCurrencyRevaluation).mockReset();
    vi.mocked(postCurrencyRevaluation).mockReset();
  });

  it("hanya membuka hitungan revaluasi bagi Controller ke atas", async () => {
    await expect(createCaller("STAFF").ledger.currencyRevaluation({ periodId: 16 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").ledger.currencyRevaluation({ periodId: 16 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(buildCurrencyRevaluation).not.toHaveBeenCalled();

    vi.mocked(buildCurrencyRevaluation).mockResolvedValue({ rows: [], blockers: [] } as never);
    await expect(createCaller("CONTROLLER").ledger.currencyRevaluation({ periodId: 16 })).resolves.toBeTruthy();
    await expect(createCaller("SHAREHOLDER").ledger.currencyRevaluation({ periodId: 16 })).resolves.toBeTruthy();
  });

  it("hanya mengizinkan Controller ke atas menjurnalkan revaluasi", async () => {
    await expect(createCaller("STAFF").ledger.postCurrencyRevaluation({ periodId: 16 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").ledger.postCurrencyRevaluation({ periodId: 16 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(postCurrencyRevaluation).not.toHaveBeenCalled();

    vi.mocked(postCurrencyRevaluation).mockResolvedValue({ periodId: 16, entryNumber: null, rows: [], skipped: null } as never);
    await expect(createCaller("CONTROLLER").ledger.postCurrencyRevaluation({ periodId: 16 })).resolves.toBeTruthy();
    await expect(createCaller("SHAREHOLDER").ledger.postCurrencyRevaluation({ periodId: 16 })).resolves.toBeTruthy();
  });

  it("meneruskan aktor yang menjalankannya ke jejak audit", async () => {
    vi.mocked(postCurrencyRevaluation).mockResolvedValue({ periodId: 16, entryNumber: null, rows: [], skipped: null } as never);
    await createCaller("CONTROLLER").ledger.postCurrencyRevaluation({ periodId: 16 });
    expect(postCurrencyRevaluation).toHaveBeenCalledWith({ periodId: 16 }, expect.objectContaining({ id: 9, role: "CONTROLLER" }));
  });

  it("menolak periodId yang bukan bilangan bulat positif", async () => {
    await expect(createCaller("CONTROLLER").ledger.currencyRevaluation({ periodId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(createCaller("CONTROLLER").ledger.postCurrencyRevaluation({ periodId: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
