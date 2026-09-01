import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { updateCustomer } from "./operations";

const existingCustomer = {
  id: 1, cifNumber: "CIF-0001", fullName: "Nasabah Lama", phoneNumber: "0811", identityType: "KTP" as const, identityNumber: "1234",
  identityExpiryDate: null, placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), address: "Jl. Lama", occupation: "Pegawai",
  sourceOfFunds: "Gaji", transactionPurpose: "Liburan", profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const, riskNotes: null,
  pepStatus: "NONE" as const, pepDetails: null, dttotPpsdmMatch: false, dttotPpsdmNotes: null, isDemo: false, isHistorical: false,
};

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    limit: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function mockDb() {
  const fakeDb = {
    select: vi.fn(() => makeReader([existingCustomer])),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),
    insert: vi.fn(() => ({ values: () => Promise.resolve(undefined) })),
  };
  return vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

const baseInput = {
  customerId: 1, fullName: "Nasabah Baru", phoneNumber: "0812", identityType: "KTP" as const, identityNumber: "5678",
  placeOfBirth: "Bandung", dateOfBirth: new Date("1990-01-01"), address: "Jl. Baru", occupation: "Wiraswasta",
  sourceOfFunds: "Usaha", transactionPurpose: "Bisnis", profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const,
  pepStatus: "NONE" as const, dttotPpsdmMatch: false,
};

describe("updateCustomer", () => {
  it("rejects a change with no reason", async () => {
    const getDb = mockDb();
    await expect(updateCustomer({ ...baseInput, changeReason: "" }, { id: 1, role: "STAFF" })).rejects.toThrow(/Alasan perubahan/);
    getDb.mockRestore();
  });

  it("rejects a change reason shorter than 5 characters", async () => {
    const getDb = mockDb();
    await expect(updateCustomer({ ...baseInput, changeReason: "abc" }, { id: 1, role: "STAFF" })).rejects.toThrow(/Alasan perubahan/);
    getDb.mockRestore();
  });

  it("requires PEP details when pepStatus is not NONE, even with a valid reason", async () => {
    const getDb = mockDb();
    await expect(updateCustomer({ ...baseInput, pepStatus: "SELF", changeReason: "koreksi status PEP" }, { id: 1, role: "STAFF" })).rejects.toThrow(/PEP/);
    getDb.mockRestore();
  });

  it("requires DTTOT notes when dttotPpsdmMatch is true", async () => {
    const getDb = mockDb();
    await expect(updateCustomer({ ...baseInput, dttotPpsdmMatch: true, changeReason: "tandai kecocokan DTTOT" }, { id: 1, role: "STAFF" })).rejects.toThrow(/DTTOT/);
    getDb.mockRestore();
  });

  it("succeeds with a valid reason and returns the updated profile", async () => {
    const getDb = mockDb();
    const result = await updateCustomer({ ...baseInput, changeReason: "koreksi data sesuai konfirmasi nasabah" }, { id: 7, role: "STAFF" });
    expect(result).toBeTruthy();
    getDb.mockRestore();
  });
});
