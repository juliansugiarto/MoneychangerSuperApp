import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./customerProfileMonitoring", () => ({
  listCustomerProfileMonitoring: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { listCustomerProfileMonitoring } from "./customerProfileMonitoring";
import { appRouter } from "./routers";

/**
 * Otorisasi dan batas worklist pemantauan profil.
 *
 * Menyembunyikan menunya bukan otorisasi: prosedurnya dapat dipanggil langsung. Worklist ini
 * memperlihatkan seluruh basis nasabah beserta perkiraan aktivitas dan penilaian penyimpangannya —
 * bacaan pengawasan, bukan bacaan kasir.
 */
function createCaller(role: "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER", mustChangePassword = false) {
  return appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user: { id: 9, role, mustChangePassword } as never });
}

describe("otorisasi worklist pemantauan profil", () => {
  beforeEach(() => {
    vi.mocked(listCustomerProfileMonitoring).mockReset();
    vi.mocked(listCustomerProfileMonitoring).mockResolvedValue([] as never);
  });

  it("menolak STAFF dan ADMIN", async () => {
    await expect(createCaller("STAFF").customerProfileMonitoring.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").customerProfileMonitoring.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listCustomerProfileMonitoring).not.toHaveBeenCalled();
  });

  it("menerima Controller dan Shareholder", async () => {
    await expect(createCaller("CONTROLLER").customerProfileMonitoring.list({})).resolves.toEqual([]);
    await expect(createCaller("SHAREHOLDER").customerProfileMonitoring.list({})).resolves.toEqual([]);
  });

  it("menolak pengguna yang wajib mengganti kata sandi awal", async () => {
    await expect(createCaller("CONTROLLER", true).customerProfileMonitoring.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listCustomerProfileMonitoring).not.toHaveBeenCalled();
  });
});
