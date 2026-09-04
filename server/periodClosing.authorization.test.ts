import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./periodClosing", () => ({
  buildPeriodValuation: vi.fn(),
  postPeriodClosing: vi.fn(),
  postYearEndProfitClosing: vi.fn(),
}));

import { buildPeriodValuation, postPeriodClosing, postYearEndProfitClosing } from "./periodClosing";
import { appRouter } from "./routers";

function createCaller(role: "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER") {
  return appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user: { id: 9, role, mustChangePassword: false } as never });
}

/**
 * Otorisasi penutupan periode ditegakkan di server.
 *
 * Panel penutupan memang hanya tampil bagi Controller ke atas, tetapi menyembunyikan tombol bukan
 * otorisasi: prosedurnya dapat dipanggil langsung. Yang diuji di sini adalah penolakan pada
 * tingkat tRPC, bukan pada tingkat tampilan.
 */
describe("otorisasi penutupan periode", () => {
  beforeEach(() => {
    vi.mocked(buildPeriodValuation).mockReset();
    vi.mocked(postPeriodClosing).mockReset();
    vi.mocked(postYearEndProfitClosing).mockReset();
  });

  it("hanya membuka pratinjau penilaian bagi Controller ke atas", async () => {
    await expect(createCaller("STAFF").ledger.closingValuation({ periodId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").ledger.closingValuation({ periodId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    vi.mocked(buildPeriodValuation).mockResolvedValue({ periodId: 7, rows: [], blockers: [] } as never);
    await expect(createCaller("CONTROLLER").ledger.closingValuation({ periodId: 7 })).resolves.toMatchObject({ periodId: 7 });
    expect(buildPeriodValuation).toHaveBeenCalledWith(7);
  });

  it("hanya mengizinkan Controller ke atas menjalankan penilaiannya", async () => {
    await expect(createCaller("STAFF").ledger.postClosingValuation({ periodId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").ledger.postClosingValuation({ periodId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(postPeriodClosing).not.toHaveBeenCalled();

    vi.mocked(postPeriodClosing).mockResolvedValue({ periodId: 7, entryNumber: "JU-2026-09-0007", rows: [], skipped: null } as never);
    await expect(createCaller("CONTROLLER").ledger.postClosingValuation({ periodId: 7 })).resolves.toMatchObject({ entryNumber: "JU-2026-09-0007" });
    // Pelakunya datang dari konteks, bukan dari masukan: siapa yang menutup periode tidak boleh
    // dapat ditentukan oleh pemanggilnya.
    expect(postPeriodClosing).toHaveBeenCalledWith({ periodId: 7 }, expect.objectContaining({ id: 9, role: "CONTROLLER" }));
  });

  it("hanya mengizinkan Controller ke atas menjalankan penutup laba tahunan", async () => {
    await expect(createCaller("STAFF").ledger.postYearEndClosing({ periodId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").ledger.postYearEndClosing({ periodId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(postYearEndProfitClosing).not.toHaveBeenCalled();

    vi.mocked(postYearEndProfitClosing).mockResolvedValue({ periodId: 12, entryNumber: "JU-2026-12-0099", skipped: null } as never);
    await expect(createCaller("SHAREHOLDER").ledger.postYearEndClosing({ periodId: 12 })).resolves.toMatchObject({ entryNumber: "JU-2026-12-0099" });
    expect(postYearEndProfitClosing).toHaveBeenCalledWith({ periodId: 12 }, expect.objectContaining({ id: 9 }));
  });

  it("menolak periodId yang bukan bilangan bulat positif sebelum menyentuh operasinya", async () => {
    await expect(createCaller("CONTROLLER").ledger.postClosingValuation({ periodId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(createCaller("CONTROLLER").ledger.postClosingValuation({ periodId: -3 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(postPeriodClosing).not.toHaveBeenCalled();
  });
});
