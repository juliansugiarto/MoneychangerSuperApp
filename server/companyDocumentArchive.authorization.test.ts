import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./companyDocumentArchive", () => ({
  createCompanyDocument: vi.fn(),
  addCompanyDocumentVersion: vi.fn(),
  deactivateCompanyDocument: vi.fn(),
  listCompanyArchiveDocuments: vi.fn(),
  listCompanyArchiveVersions: vi.fn(),
  companyArchiveWorklist: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { addCompanyDocumentVersion, createCompanyDocument, deactivateCompanyDocument } from "./companyDocumentArchive";
import { appRouter } from "./routers";

/**
 * Otorisasi arsip dokumen perusahaan, dan batas "hanya mencatat".
 *
 * Menyembunyikan menunya bukan otorisasi: prosedurnya dapat dipanggil langsung.
 */
function createCaller(role: "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER", mustChangePassword = false) {
  return appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user: { id: 9, role, mustChangePassword } as never });
}

const dokumenInput = {
  category: "SOP" as const,
  title: "Prosedur Penerimaan Nasabah",
  operationalDocumentId: 41,
  validFrom: new Date(2026, 8, 1),
};

describe("otorisasi arsip dokumen perusahaan", () => {
  beforeEach(() => {
    vi.mocked(createCompanyDocument).mockReset().mockResolvedValue({ id: 1 } as never);
    vi.mocked(addCompanyDocumentVersion).mockReset().mockResolvedValue({ id: 2 } as never);
    vi.mocked(deactivateCompanyDocument).mockReset().mockResolvedValue(undefined as never);
  });

  it("menolak STAFF dan ADMIN membuat dokumen", async () => {
    for (const role of ["STAFF", "ADMIN"] as const) {
      await expect(createCaller(role).companyArchive.create(dokumenInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(createCompanyDocument).not.toHaveBeenCalled();
  });

  it("menolak STAFF dan ADMIN mengganti versi", async () => {
    const input = { companyDocumentId: 7, operationalDocumentId: 42, validFrom: new Date(2027, 0, 1), changeReason: "revisi berkala" };
    for (const role of ["STAFF", "ADMIN"] as const) {
      await expect(createCaller(role).companyArchive.addVersion(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(addCompanyDocumentVersion).not.toHaveBeenCalled();
  });

  it("menolak STAFF dan ADMIN menonaktifkan dokumen", async () => {
    for (const role of ["STAFF", "ADMIN"] as const) {
      await expect(createCaller(role).companyArchive.deactivate({ companyDocumentId: 7, reason: "digantikan" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(deactivateCompanyDocument).not.toHaveBeenCalled();
  });

  it("menerima Controller dan Shareholder", async () => {
    await expect(createCaller("CONTROLLER").companyArchive.create(dokumenInput)).resolves.toEqual({ id: 1 });
    await expect(createCaller("SHAREHOLDER").companyArchive.create(dokumenInput)).resolves.toEqual({ id: 1 });
  });

  it("meneruskan pelakunya dari sesi, bukan dari masukan klien", async () => {
    // Pelaku yang boleh dikirim klien adalah pelaku yang dapat dipalsukan klien.
    await createCaller("CONTROLLER").companyArchive.create({ ...dokumenInput, createdByUserId: 999 } as never);
    expect(createCompanyDocument).toHaveBeenCalledWith(expect.not.objectContaining({ createdByUserId: 999 }), expect.objectContaining({ id: 9 }));
  });
});

describe("batas masukan arsip dokumen", () => {
  beforeEach(() => {
    vi.mocked(createCompanyDocument).mockReset().mockResolvedValue({ id: 1 } as never);
    vi.mocked(addCompanyDocumentVersion).mockReset().mockResolvedValue({ id: 2 } as never);
    vi.mocked(deactivateCompanyDocument).mockReset().mockResolvedValue(undefined as never);
  });

  it("menolak kategori di luar keenam nilai yang ditetapkan", async () => {
    await expect(createCaller("CONTROLLER").companyArchive.create({ ...dokumenInput, category: "MEMO_INTERNAL" } as never)).rejects.toBeTruthy();
    expect(createCompanyDocument).not.toHaveBeenCalled();
  });

  it("menolak judul kosong", async () => {
    await expect(createCaller("CONTROLLER").companyArchive.create({ ...dokumenInput, title: "  " })).rejects.toBeTruthy();
  });

  it("menolak penggantian versi tanpa alasan perubahan", async () => {
    const input = { companyDocumentId: 7, operationalDocumentId: 42, validFrom: new Date(2027, 0, 1), changeReason: "  " };
    await expect(createCaller("CONTROLLER").companyArchive.addVersion(input)).rejects.toBeTruthy();
    expect(addCompanyDocumentVersion).not.toHaveBeenCalled();
  });

  it("menolak penonaktifan tanpa alasan", async () => {
    await expect(createCaller("CONTROLLER").companyArchive.deactivate({ companyDocumentId: 7, reason: "" })).rejects.toBeTruthy();
    expect(deactivateCompanyDocument).not.toHaveBeenCalled();
  });

  it("menerima validUntil kosong sebagai berlaku sampai diganti", async () => {
    await expect(createCaller("CONTROLLER").companyArchive.create({ ...dokumenInput, validUntil: null })).resolves.toEqual({ id: 1 });
  });
});

describe("arsip tidak menyediakan penghapusan", () => {
  it("tidak punya prosedur delete — menghapus berarti menonaktifkan", () => {
    // Keputusan pengguna 3, dikunci pada bentuk API-nya sendiri: prosedur yang tidak ada tidak
    // dapat dipanggil siapa pun, termasuk oleh klien yang keliru ditulis kemudian.
    const procedures = Object.keys((appRouter._def.procedures ?? {}) as Record<string, unknown>)
      .filter((name) => name.startsWith("companyArchive."));
    expect(procedures).not.toContain("companyArchive.delete");
    expect(procedures).not.toContain("companyArchive.remove");
    expect(procedures.length).toBeGreaterThan(0);
  });
});
