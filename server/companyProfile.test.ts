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

function mockDb(existingRows: unknown[]) {
  const fakeDb = {
    select: vi.fn(() => makeReader(existingRows)),
    insert: vi.fn(() => ({ values: () => Promise.resolve(undefined) })),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),
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
