import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { updateCustomer } from "./operations";

/**
 * Penulis `customers.relationshipEndedAt` — jam Pasal 48 ayat (1) huruf a angka 1 PBI 10/2024.
 *
 * Yang dijaga bukan fungsi murninya (itu tugas `shared/documentRetention.test.ts`), melainkan bahwa
 * `updateCustomer` benar-benar mengirimkannya ke `set()`: hanya pada PERPINDAHAN status, dan tanpa
 * menyertakan kuncinya sama sekali ketika statusnya tidak berpindah.
 */

type Status = "ACTIVE" | "RESTRICTED" | "INACTIVE";

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    orderBy: () => makeReader(rows),
    limit: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

const endedEarlier = new Date("2025-02-01T03:00:00Z");

function existingCustomer(profileStatus: Status) {
  return {
    id: 1, cifNumber: "CIF-0001", fullName: "Nasabah Lama", phoneNumber: "0811", identityType: "KTP" as const, identityNumber: "1234",
    identityExpiryDate: null, placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), gender: "MALE" as const, nationality: "ID",
    address: "Jl. Lama", addressType: "RUMAH" as const, addressCountry: "ID", addressProvince: null, addressCity: "Jakarta", addressDistrict: null, addressPostalCode: null, npwp: null,
    occupation: "Pegawai", sourceOfFunds: "Gaji", transactionPurpose: "Liburan", profileStatus, riskLevel: "LOW" as const, riskNotes: null,
    pepStatus: "NONE" as const, pepDetails: null, dttotPpsdmMatch: false, dttotPpsdmNotes: null, isDemo: false, isHistorical: false,
    relationshipEndedAt: profileStatus === "INACTIVE" ? endedEarlier : null,
  };
}

function mockDb(customer: Record<string, unknown>) {
  const customerSets: Record<string, unknown>[] = [];
  const inserted: { table: string; values: Record<string, unknown> }[] = [];
  const fakeDb = {
    select: vi.fn(() => makeReader([customer])),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        if (tableName(table) === "customers") customerSets.push(values);
        return { where: () => Promise.resolve(undefined) };
      },
    })),
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserted.push({ table: tableName(table), values });
        return Promise.resolve(undefined);
      },
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { customerSets, inserted };
}

const baseInput = {
  customerId: 1, fullName: "Nasabah Lama", phoneNumber: "0811", identityType: "KTP" as const, identityNumber: "1234",
  placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), gender: "MALE" as const, nationality: "ID",
  address: "Jl. Lama", addressType: "RUMAH" as const, addressCountry: "ID", addressCity: "Jakarta", occupation: "Pegawai",
  sourceOfFunds: "Gaji", transactionPurpose: "Liburan", riskLevel: "LOW" as const,
  pepStatus: "NONE" as const, dttotPpsdmMatch: false, changeReason: "perubahan status hubungan usaha",
};

async function runUpdate(previousStatus: Status, nextStatus: Status) {
  const recorded = mockDb(existingCustomer(previousStatus));
  await updateCustomer({ ...baseInput, profileStatus: nextStatus }, { id: 7, role: "ADMIN" });
  expect(recorded.customerSets).toHaveLength(1);
  return { set: recorded.customerSets[0], inserted: recorded.inserted };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("updateCustomer menulis relationshipEndedAt", () => {
  it.each<Status>(["ACTIVE", "RESTRICTED"])("%s → INACTIVE mengisi relationshipEndedAt dengan saat penyimpanan", async (previousStatus) => {
    const before = Date.now();
    const { set } = await runUpdate(previousStatus, "INACTIVE");
    const after = Date.now();
    expect(set.relationshipEndedAt).toBeInstanceOf(Date);
    const at = (set.relationshipEndedAt as Date).getTime();
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(after);
  });

  it.each<Status>(["ACTIVE", "RESTRICTED"])("INACTIVE → %s mengosongkan relationshipEndedAt", async (nextStatus) => {
    const { set } = await runUpdate("INACTIVE", nextStatus);
    expect(set).toHaveProperty("relationshipEndedAt", null);
  });

  it("INACTIVE → INACTIVE tidak menyertakan kunci relationshipEndedAt sama sekali", async () => {
    // Menyetel ulang di sini akan memundurkan tenggat retensi pada setiap penyuntingan nasabah yang
    // sudah tidak aktif — mengirim nilai lamanya pun tetap keliru, karena kuncinya tidak boleh ada.
    const { set } = await runUpdate("INACTIVE", "INACTIVE");
    expect(Object.prototype.hasOwnProperty.call(set, "relationshipEndedAt")).toBe(false);
  });

  it.each<[Status, Status]>([
    ["ACTIVE", "ACTIVE"],
    ["ACTIVE", "RESTRICTED"],
    ["RESTRICTED", "ACTIVE"],
  ])("%s → %s tidak menyertakan kunci relationshipEndedAt", async (previousStatus, nextStatus) => {
    const { set } = await runUpdate(previousStatus, nextStatus);
    expect(Object.prototype.hasOwnProperty.call(set, "relationshipEndedAt")).toBe(false);
  });

  it("audit CUSTOMER_UPDATED merekam relationshipEndedAt sebelum dan sesudahnya", async () => {
    const { inserted } = await runUpdate("INACTIVE", "ACTIVE");
    const audit = inserted.find((row) => row.table === "audit_logs" && row.values.action === "CUSTOMER_UPDATED");
    expect(audit).toBeTruthy();
    expect((audit!.values.beforeState as Record<string, unknown>).relationshipEndedAt).toEqual(endedEarlier);
    expect(audit!.values.afterState).toHaveProperty("relationshipEndedAt", null);
  });
});
