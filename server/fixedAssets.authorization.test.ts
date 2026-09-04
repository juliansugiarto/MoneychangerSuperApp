import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./fixedAssets", () => ({
  listFixedAssets: vi.fn(),
  getFixedAssetSettings: vi.fn(),
  updateFixedAssetSettings: vi.fn(),
  registerFixedAsset: vi.fn(),
  disposeFixedAsset: vi.fn(),
  buildMonthlyDepreciation: vi.fn(),
  postMonthlyDepreciation: vi.fn(),
}));

import {
  buildMonthlyDepreciation,
  disposeFixedAsset,
  getFixedAssetSettings,
  listFixedAssets,
  postMonthlyDepreciation,
  registerFixedAsset,
  updateFixedAssetSettings,
} from "./fixedAssets";
import { appRouter } from "./routers";

function createCaller(role: "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER") {
  return appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user: { id: 9, role, mustChangePassword: false } as never });
}

const registerInput = {
  name: "Brankas Chubb",
  category: "PERALATAN_KANTOR" as const,
  acquisitionDate: "2026-03-17",
  acquisitionCost: "24000000.00",
  usefulLifeMonths: 48,
};

/**
 * Otorisasi aset tetap ditegakkan di server.
 *
 * Halaman Aset Tetap memang hanya tampil bagi Controller ke atas, tetapi menyembunyikan menu bukan
 * otorisasi: prosedurnya dapat dipanggil langsung. Angkanya angka laporan keuangan — harga
 * perolehan menentukan isi neraca, dan batas kapitalisasi menentukan apa yang masuk ke sana.
 */
describe("otorisasi register aset tetap", () => {
  beforeEach(() => {
    for (const fn of [listFixedAssets, getFixedAssetSettings, updateFixedAssetSettings, registerFixedAsset, disposeFixedAsset, buildMonthlyDepreciation, postMonthlyDepreciation]) {
      vi.mocked(fn).mockReset();
    }
  });

  it("hanya membuka daftar aset bagi Controller ke atas", async () => {
    await expect(createCaller("STAFF").fixedAssets.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").fixedAssets.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listFixedAssets).not.toHaveBeenCalled();

    vi.mocked(listFixedAssets).mockResolvedValue([] as never);
    await expect(createCaller("CONTROLLER").fixedAssets.list()).resolves.toEqual([]);
    await expect(createCaller("SHAREHOLDER").fixedAssets.list()).resolves.toEqual([]);
  });

  it("hanya mengizinkan Controller ke atas mendaftarkan aset", async () => {
    await expect(createCaller("STAFF").fixedAssets.register(registerInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").fixedAssets.register(registerInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(registerFixedAsset).not.toHaveBeenCalled();

    vi.mocked(registerFixedAsset).mockResolvedValue({ id: 1, entryNumber: "JU-202603-0004" } as never);
    await expect(createCaller("CONTROLLER").fixedAssets.register(registerInput)).resolves.toMatchObject({ id: 1 });
    // Pelakunya datang dari konteks, bukan dari masukan: siapa yang mendaftarkan aset tidak boleh
    // dapat ditentukan oleh pemanggilnya.
    expect(registerFixedAsset).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Brankas Chubb" }),
      expect.objectContaining({ id: 9, role: "CONTROLLER" }),
    );
  });

  it("hanya mengizinkan Controller ke atas melepas aset", async () => {
    const input = { assetId: 1, disposalDate: "2026-05-31", proceeds: "1000000.00" };
    await expect(createCaller("STAFF").fixedAssets.dispose(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").fixedAssets.dispose(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(disposeFixedAsset).not.toHaveBeenCalled();

    vi.mocked(disposeFixedAsset).mockResolvedValue({ assetId: 1, entryNumber: "JU-202605-0007", gainLoss: "0.00" } as never);
    await expect(createCaller("CONTROLLER").fixedAssets.dispose(input)).resolves.toMatchObject({ assetId: 1 });
  });

  it("hanya mengizinkan Controller ke atas membaca dan mengubah batas kapitalisasi", async () => {
    await expect(createCaller("STAFF").fixedAssets.settings()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").fixedAssets.settings()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").fixedAssets.updateSettings({ capitalisationThresholdIdr: "5000000.00" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateFixedAssetSettings).not.toHaveBeenCalled();

    vi.mocked(getFixedAssetSettings).mockResolvedValue({ capitalisationThresholdIdr: "1000000.00" } as never);
    await expect(createCaller("CONTROLLER").fixedAssets.settings()).resolves.toMatchObject({ capitalisationThresholdIdr: "1000000.00" });
  });

  it("hanya membuka pratinjau penyusutan bulanan bagi Controller ke atas", async () => {
    await expect(createCaller("STAFF").ledger.monthlyDepreciation({ periodId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").ledger.monthlyDepreciation({ periodId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    vi.mocked(buildMonthlyDepreciation).mockResolvedValue({ periodId: 7, rows: [], blockers: [] } as never);
    await expect(createCaller("CONTROLLER").ledger.monthlyDepreciation({ periodId: 7 })).resolves.toMatchObject({ periodId: 7 });
    expect(buildMonthlyDepreciation).toHaveBeenCalledWith(7);
  });

  it("hanya mengizinkan Controller ke atas menjurnal penyusutan bulanan", async () => {
    await expect(createCaller("STAFF").ledger.postMonthlyDepreciation({ periodId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").ledger.postMonthlyDepreciation({ periodId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(postMonthlyDepreciation).not.toHaveBeenCalled();

    vi.mocked(postMonthlyDepreciation).mockResolvedValue({ periodId: 7, entryNumber: "JU-202603-0009", rows: [], skipped: null } as never);
    await expect(createCaller("SHAREHOLDER").ledger.postMonthlyDepreciation({ periodId: 7 })).resolves.toMatchObject({ entryNumber: "JU-202603-0009" });
    expect(postMonthlyDepreciation).toHaveBeenCalledWith({ periodId: 7 }, expect.objectContaining({ id: 9 }));
  });

  it("menolak masukan yang tidak sah sebelum menyentuh operasinya", async () => {
    const caller = createCaller("CONTROLLER");
    await expect(caller.ledger.postMonthlyDepreciation({ periodId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // Tanggal dikirim sebagai "YYYY-MM-DD", bukan Date: `z.coerce.date()` menghasilkan tengah malam
    // UTC, dan mengirimnya ke kolom `date` dari mesin WIB memundurkan tanggalnya satu hari.
    await expect(caller.fixedAssets.register({ ...registerInput, acquisitionDate: "17-03-2026" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.fixedAssets.register({ ...registerInput, firstJournalMonth: "2026-3" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(registerFixedAsset).not.toHaveBeenCalled();
    expect(postMonthlyDepreciation).not.toHaveBeenCalled();
  });
});
