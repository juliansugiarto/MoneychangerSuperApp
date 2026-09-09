import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { getCompanyProfile, updateCompanyProfile } from "./operations";

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    limit: () => makeReader(rows),
    orderBy: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function mockDb(existingRows: unknown[], written?: Record<string, unknown>[]) {
  const catat = (values: Record<string, unknown>) => { written?.push(values); return Promise.resolve(undefined); };
  const fakeDb = {
    select: vi.fn(() => makeReader(existingRows)),
    insert: vi.fn(() => ({ values: catat })),
    update: vi.fn(() => ({ set: (values: Record<string, unknown>) => { written?.push(values); return { where: () => Promise.resolve(undefined) }; } })),
  };
  return vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

const baseInput = { legalEntityName: "PT Contoh Valasindo", tradingName: "Contoh Valasindo" };

describe("updateCompanyProfile", () => {
  it("rejects an empty legal entity name", async () => {
    const getDb = mockDb([]);
    await expect(updateCompanyProfile({ ...baseInput, legalEntityName: "  " }, { id: 1, role: "CONTROLLER" })).rejects.toThrow(/wajib diisi/);
    getDb.mockRestore();
  });

  it("rejects an empty trading name", async () => {
    const getDb = mockDb([]);
    await expect(updateCompanyProfile({ ...baseInput, tradingName: "" }, { id: 1, role: "CONTROLLER" })).rejects.toThrow(/wajib diisi/);
    getDb.mockRestore();
  });

  it("succeeds with valid names and returns a profile", async () => {
    const getDb = mockDb([{ id: 1, ...baseInput }]);
    const result = await updateCompanyProfile(baseInput, { id: 1, role: "CONTROLLER" });
    expect(result).toBeTruthy();
    getDb.mockRestore();
  });
});

describe("getCompanyProfile", () => {
  it("returns null when no profile has ever been configured", async () => {
    const getDb = mockDb([]);
    const result = await getCompanyProfile();
    expect(result).toBeNull();
    getDb.mockRestore();
  });
});

/**
 * Provinsi gerai adalah **satu-satunya** sumber parameter Wilayah Geografis TPPU/TPPT 4a/4b.
 * Kolomnya lahir pada migrasi `0053`; uji ini ada supaya ia tidak kembali menjadi kolom yang tidak
 * pernah ada yang mengisi — keadaan yang membuat kedua parameter itu selalu bernilai nol.
 */
describe("provinsi gerai pada profil perusahaan", () => {
  it("menyimpan provinsi yang dinyatakan", async () => {
    const written: Record<string, unknown>[] = [];
    const getDb = mockDb([{ id: 1 }], written);
    await updateCompanyProfile({ ...baseInput, province: "JAWA_BARAT" }, { id: 1, role: "CONTROLLER" });
    expect(written[0].province).toBe("JAWA_BARAT");
    getDb.mockRestore();
  });

  it("mengosongkannya ketika dikirim null dengan sengaja", async () => {
    const written: Record<string, unknown>[] = [];
    const getDb = mockDb([{ id: 1 }], written);
    await updateCompanyProfile({ ...baseInput, province: null }, { id: 1, role: "CONTROLLER" });
    expect(written[0].province).toBeNull();
    getDb.mockRestore();
  });

  it("membiarkannya apa adanya ketika tidak dikirim", async () => {
    const written: Record<string, unknown>[] = [];
    const getDb = mockDb([{ id: 1 }], written);
    await updateCompanyProfile(baseInput, { id: 1, role: "CONTROLLER" });
    // Borang lain pada halaman yang sama tidak mengenal ruas ini; menyertakannya sebagai null akan
    // menghapus provinsi diam-diam setiap kali logo atau zona waktu disimpan.
    expect("province" in written[0]).toBe(false);
    getDb.mockRestore();
  });
});
