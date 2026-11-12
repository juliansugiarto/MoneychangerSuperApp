import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { createCustomer, updateCustomer } from "./operations";
import { listWatchlistBlocks, recordWatchlistBlockReporting, resolveWatchlistBlock, revokeWatchlistBlock } from "./watchlistBlocks";

/**
 * Temuan reviu akhir butir B: keputusan serentak, centang petugas tanpa blokir, keputusan CONFIRMED
 * yang tidak menyelaraskan profil risiko, centang yang dicabut STAFF sesudah CONFIRMED, dan ringkasan
 * penyaringan pemicu pada register.
 */

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    innerJoin: () => makeReader(rows),
    leftJoin: () => makeReader(rows),
    where: () => makeReader(rows),
    orderBy: () => makeReader(rows),
    // Pembacaan berkunci (`FOR SHARE/UPDATE`) baris nasabah sebelum blokir dibaca/ditulis.
    for: () => makeReader(rows),
    limit: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

type Write = { via: "db" | "tx"; table: string; values: Record<string, unknown> };

function mockDb(options: { rows: Record<string, unknown[]>; affectedRows?: Record<string, number>; failInsertInto?: string }) {
  const inserted: Write[] = [];
  const updates: Write[] = [];
  const build = (via: "db" | "tx"): Record<string, unknown> => ({
    select: vi.fn(() => ({ from: (table: unknown) => makeReader(options.rows[tableName(table)] ?? []) })),
    insert: vi.fn((table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        if (options.failInsertInto === tableName(table)) throw new Error("basis data tumbang");
        inserted.push({ via, table: tableName(table), values });
        return [{ insertId: 1 }];
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push({ via, table: tableName(table), values });
          return [{ affectedRows: options.affectedRows?.[tableName(table)] ?? 1 }];
        },
      }),
    })),
  });
  const fakeDb = build("db");
  const fakeTx = build("tx");
  fakeDb.transaction = vi.fn((run: (tx: unknown) => Promise<unknown>) => run(fakeTx));
  fakeTx.transaction = vi.fn((run: (tx: unknown) => Promise<unknown>) => run(fakeTx));
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { inserted, updates };
}

const customer = {
  id: 1, cifNumber: "TEST-CIF-0001", fullName: "Nasabah Lama", phoneNumber: "081100000000", identityType: "KTP" as const, identityNumber: "1234",
  identityExpiryDate: null, placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), gender: "MALE" as const, nationality: "ID",
  address: "Jl. Lama", addressType: "RUMAH" as const, addressCountry: "ID", addressProvince: null, addressCity: "Jakarta",
  addressDistrict: null, addressPostalCode: null, npwp: null, occupation: "Pegawai",
  sourceOfFunds: "Gaji", transactionPurpose: "Liburan", profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const, riskNotes: null,
  pepStatus: "NONE" as const, pepDetails: null, dttotPpsdmMatch: false, dttotPpsdmNotes: null, isDemo: false, isHistorical: false,
  declaredMonthlyValueIdr: null, declaredMonthlyCount: null, declaredCurrencies: null,
  customerType: null, entityLegalForm: null, occupationCategory: null, highRiskDecision: "BELUM",
};

const updateInput = {
  customerId: 1, changeReason: "Pembaruan data nasabah",
  fullName: "Nasabah Lama", phoneNumber: "081100000000", identityType: "KTP" as const, identityNumber: "1234",
  placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), gender: "MALE" as const, nationality: "ID",
  address: "Jl. Baru", addressType: "RUMAH" as const, addressCountry: "ID", addressCity: "Jakarta",
  occupation: "Pegawai", sourceOfFunds: "Gaji", transactionPurpose: "Liburan",
  profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const, pepStatus: "NONE" as const, dttotPpsdmMatch: false,
};

const commonRows = { currencies: [{ id: 1, code: "USD", name: "Dolar", active: true }], sanctions_watchlist_entries: [] };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("I1 — keputusan serentak atas blokir yang sama", () => {
  it("konfirmasi yang kalah balapan (0 baris berubah) ditolak dan tidak menyentuh nasabah maupun audit", async () => {
    const { inserted, updates } = mockDb({
      rows: { watchlist_blocks: [{ id: 5, customerId: 1, status: "OPEN", matchKeys: null, source: "PENYARINGAN" }], customers: [customer] },
      affectedRows: { watchlist_blocks: 0 },
    });
    await expect(resolveWatchlistBlock({ blockId: 5, decision: "FALSE_POSITIVE", notes: "Beda tanggal lahir" }, { id: 3 })).rejects.toThrow(/sudah diputuskan/);
    expect(updates.filter((row) => row.table === "customers")).toHaveLength(0);
    expect(inserted.filter((row) => row.table === "audit_logs")).toHaveLength(0);
  });
  it("pencabutan dan pencatatan pelaporan yang kalah balapan juga ditolak", async () => {
    const rows = { watchlist_blocks: [{ id: 5, customerId: 1, status: "CONFIRMED", matchKeys: null, source: "PENYARINGAN", resolutionNotes: null }], customers: [customer] };
    mockDb({ rows, affectedRows: { watchlist_blocks: 0 } });
    await expect(revokeWatchlistBlock({ blockId: 5, revocationReference: "S-1/2026", notes: "dicabut otoritas" }, { id: 3 })).rejects.toThrow(/berubah/);
    mockDb({ rows, affectedRows: { watchlist_blocks: 0 } });
    await expect(recordWatchlistBlockReporting({ blockId: 5, ltkmReference: "LTKM-1", biCopySentAt: new Date("2026-09-01T00:00:00Z") }, { id: 3 })).rejects.toThrow(/berubah/);
  });
  it("keputusan, profil nasabah, dan audit ditulis dalam satu transaksi basis data", async () => {
    const { inserted, updates } = mockDb({ rows: { watchlist_blocks: [{ id: 5, customerId: 1, status: "OPEN", matchKeys: null, source: "PENYARINGAN" }], customers: [customer] } });
    await resolveWatchlistBlock({ blockId: 5, decision: "CONFIRMED", notes: "Identitas cocok" }, { id: 3 });
    expect([...updates, ...inserted].every((row) => row.via === "tx")).toBe(true);
  });
});

describe("I3 — CONFIRMED menyelaraskan profil risiko seperti centang saat nasabah dibuat", () => {
  it("nasabah LOW/ACTIVE menjadi HIGH/RESTRICTED dan keputusan risiko tinggi kembali BELUM", async () => {
    const { updates } = mockDb({ rows: { watchlist_blocks: [{ id: 5, customerId: 1, status: "OPEN", matchKeys: null, source: "PENYARINGAN" }], customers: [{ ...customer, highRiskDecision: "DISETUJUI" }] } });
    await resolveWatchlistBlock({ blockId: 5, decision: "CONFIRMED", notes: "Identitas cocok" }, { id: 3 });
    expect(updates.find((row) => row.table === "customers")!.values).toMatchObject({ dttotPpsdmMatch: true, riskLevel: "HIGH", profileStatus: "RESTRICTED", highRiskDecision: "BELUM" });
  });
  it("nasabah INACTIVE tetap INACTIVE", async () => {
    const { updates } = mockDb({ rows: { watchlist_blocks: [{ id: 5, customerId: 1, status: "OPEN", matchKeys: null, source: "PENYARINGAN" }], customers: [{ ...customer, profileStatus: "INACTIVE" }] } });
    await resolveWatchlistBlock({ blockId: 5, decision: "CONFIRMED", notes: "Identitas cocok" }, { id: 3 });
    expect(updates.find((row) => row.table === "customers")!.values).toMatchObject({ riskLevel: "HIGH", profileStatus: "INACTIVE" });
  });
});

describe("I2 — centang petugas tidak boleh tersimpan tanpa blokir", () => {
  it("updateCustomer: blokir gagal dibuka → centang tidak tersimpan (nasabah tidak diubah)", async () => {
    const { updates } = mockDb({ rows: { ...commonRows, customers: [customer], watchlist_blocks: [] }, failInsertInto: "watchlist_blocks" });
    await expect(updateCustomer({ ...updateInput, dttotPpsdmMatch: true, dttotPpsdmNotes: "Cocok entri DTTOT" } as never, { id: 5, role: "STAFF" })).rejects.toThrow();
    expect(updates.filter((row) => row.table === "customers")).toHaveLength(0);
  });
  it("createCustomer: blokir petugas dibuka di dalam transaksi pembuatan nasabah", async () => {
    const { inserted } = mockDb({ rows: { ...commonRows, customers: [customer], watchlist_blocks: [] } });
    const { v1Fixtures } = await import("./v1Fixtures");
    await createCustomer({ ...v1Fixtures.customer, dttotPpsdmMatch: true, dttotPpsdmNotes: "Cocok entri DTTOT" } as never, 3);
    const block = inserted.find((row) => row.table === "watchlist_blocks");
    expect(block).toMatchObject({ via: "tx", values: { source: "PETUGAS", status: "OPEN" } });
  });
});

describe("I4 — centang tidak dapat dicabut selama ada blokir CONFIRMED", () => {
  it("STAFF menghapus centang nasabah yang blokirnya dikonfirmasi → ditolak", async () => {
    const flagged = { ...customer, dttotPpsdmMatch: true, dttotPpsdmNotes: "Dikonfirmasi" };
    const { updates } = mockDb({ rows: { ...commonRows, customers: [flagged], watchlist_blocks: [{ id: 5, customerId: 1, status: "CONFIRMED", matchKeys: null }] } });
    await expect(updateCustomer({ ...updateInput, dttotPpsdmMatch: false } as never, { id: 5, role: "STAFF" })).rejects.toThrow(/dikonfirmasi/);
    expect(updates.filter((row) => row.table === "customers")).toHaveLength(0);
  });
});

describe("I5 — register memuat ringkasan penyaringan pemicu", () => {
  it("listWatchlistBlocks mengembalikan ringkasan dan jumlah kecocokan penyaringan pemicunya", async () => {
    mockDb({ rows: { watchlist_blocks: [{ block: { id: 5, customerId: 1, status: "OPEN", screeningId: 19 }, customerName: "Nasabah", cifNumber: "CIF-1", screeningSummary: "DTTOT ABDUL (0.97)", screeningMatchCount: 1 }], attempted_transactions: [] } });
    const [row] = await listWatchlistBlocks();
    expect(row).toMatchObject({ id: 5, screeningSummary: "DTTOT ABDUL (0.97)", screeningMatchCount: 1 });
  });
});
