import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { recordRelationshipEnd } from "./documentRetentionQueries";
import { relationshipEndDenial } from "../shared/documentRetention";


/**
 * B4 — Controller mengisi tanggal berakhir hubungan nasabah INACTIVE lama.
 * Pembantu basis data palsu disalin dari `server/watchlistBlockDecision.test.ts`.
 */

/**
 * Pasangan kolom-nilai terikat pada klausa Drizzle — disalin dari `server/iraDataForm.test.ts`,
 * bukan dari basis data palsu yang mengabaikan `where`.
 */
function boundValues(clause: unknown): Record<string, unknown[]> {
  const pairs: Record<string, unknown[]> = {};
  let lastColumn: string | null = null;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const candidate = node as { name?: unknown; value?: unknown; queryChunks?: unknown[]; columnType?: unknown };
    if (typeof candidate.name === "string" && candidate.columnType) lastColumn = candidate.name;
    else if (lastColumn && "value" in candidate && !Array.isArray(candidate.value)) {
      (pairs[lastColumn] ??= []).push(candidate.value);
    }
    if (Array.isArray(candidate.queryChunks)) candidate.queryChunks.forEach(walk);
  };
  walk(clause);
  return pairs;
}

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    innerJoin: () => makeReader(rows),
    leftJoin: () => makeReader(rows),
    where: (clause: unknown) => {
      const pairs = boundValues(clause);
      return makeReader(rows.filter((row) => Object.entries(pairs).every(([key, values]) => {
        const record = row as Record<string, unknown>;
        if (!(key in record)) return true;
        return values.some((value) => value instanceof Date && record[key] instanceof Date ? true : record[key] === value);
      })));
    },
    orderBy: () => makeReader(rows),
    limit: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}


function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

function mockDb(rowsByTable: Record<string, unknown[]>) {
  const inserted: { table: string; values: Record<string, unknown> }[] = [];
  const updates: { table: string; set: Record<string, unknown> }[] = [];
  const affected = { value: 1 };
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => makeReader(rowsByTable[tableName(table)] ?? []) })),
    insert: vi.fn((table: unknown) => ({
      values: async (values: Record<string, unknown>) => { inserted.push({ table: tableName(table), values }); },
    })),
    update: vi.fn((table: unknown) => ({
      set: (set: Record<string, unknown>) => ({ where: async () => { updates.push({ table: tableName(table), set }); return [{ affectedRows: affected.value }]; } }),
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { inserted, updates, affected };
}

beforeEach(() => {
  vi.restoreAllMocks();
});


describe("relationshipEndDenial", () => {
  it("menolak tanggal masa depan per hari WIB", () => {
    expect(relationshipEndDenial({ dateKey: "2026-09-29", todayKey: "2026-09-28", lastTransactionDateKey: null })).toMatch(/masa depan/);
    expect(relationshipEndDenial({ dateKey: "2026-09-28", todayKey: "2026-09-28", lastTransactionDateKey: null })).toBeNull();
  });
  it("menolak tanggal sebelum transaksi selesai terakhir; hari yang sama boleh", () => {
    expect(relationshipEndDenial({ dateKey: "2026-03-01", todayKey: "2026-09-28", lastTransactionDateKey: "2026-03-02" })).toMatch(/transaksi terakhir/);
    expect(relationshipEndDenial({ dateKey: "2026-03-02", todayKey: "2026-09-28", lastTransactionDateKey: "2026-03-02" })).toBeNull();
  });
  it("menolak format tanggal yang bukan YYYY-MM-DD", () => {
    expect(relationshipEndDenial({ dateKey: "02/03/2026", todayKey: "2026-09-28", lastTransactionDateKey: null })).toMatch(/format/);
  });
});

describe("recordRelationshipEnd", () => {
  it("menulis awal hari WIB dalam UTC dan audit bersumber", async () => {
    const { updates, inserted } = mockDb({ customers: [{ id: 4, profileStatus: "INACTIVE", relationshipEndedAt: null }], exchange_transactions: [], company_profile: [{ timezone: "Asia/Jakarta" }] });
    const result = await recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-02", source: "Berkas fisik nasabah, surat penutupan 2 Maret 2026" }, { id: 3 });
    expect(result.relationshipEndedAt.toISOString()).toBe("2026-03-01T17:00:00.000Z");
    expect(updates.find((row) => row.table === "customers")!.set).toMatchObject({ relationshipEndedAt: result.relationshipEndedAt });
    expect(inserted.find((row) => row.table === "audit_logs")!.values).toMatchObject({ action: "CUSTOMER_RELATIONSHIP_END_RECORDED", reason: "Berkas fisik nasabah, surat penutupan 2 Maret 2026" });
  });
  it("transaksi terakhir 00.30 WIB (= hari sebelumnya di UTC) dibandingkan per hari WIB", async () => {
    const tables = () => ({ customers: [{ id: 4, profileStatus: "INACTIVE", relationshipEndedAt: null }], exchange_transactions: [{ transactionAt: new Date("2026-03-01T17:30:00Z") }], company_profile: [{ timezone: "Asia/Jakarta" }] });
    mockDb(tables());
    await expect(recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-01", source: "Berkas fisik" }, { id: 3 })).rejects.toThrow(/2026-03-02/);
    mockDb(tables());
    await expect(recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-02", source: "Berkas fisik" }, { id: 3 })).resolves.toMatchObject({ relationshipEndedAt: new Date("2026-03-01T17:00:00Z") });
  });
  it("menolak nasabah yang tidak INACTIVE atau sudah bertanggal, dan sumber kosong", async () => {
    mockDb({ customers: [{ id: 4, profileStatus: "ACTIVE", relationshipEndedAt: null }], exchange_transactions: [], company_profile: [] });
    await expect(recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-02", source: "berkas" }, { id: 3 })).rejects.toThrow(/INACTIVE/);
    mockDb({ customers: [{ id: 4, profileStatus: "INACTIVE", relationshipEndedAt: new Date() }], exchange_transactions: [], company_profile: [] });
    await expect(recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-02", source: "berkas" }, { id: 3 })).rejects.toThrow(/sudah/);
    await expect(recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-02", source: " " }, { id: 3 })).rejects.toThrow(/Sumber/);
  });
  it("dua penyimpanan bersamaan: yang kalah balapan ditolak tanpa audit kedua (temuan M8)", async () => {
    const { inserted, affected } = mockDb({ customers: [{ id: 4, profileStatus: "INACTIVE", relationshipEndedAt: null }], exchange_transactions: [], company_profile: [{ timezone: "Asia/Jakarta" }] });
    affected.value = 0; // penulis lain sudah mengisi tanggalnya di antara baca dan tulis
    await expect(recordRelationshipEnd({ customerId: 4, dateKey: "2026-03-02", source: "Berkas fisik" }, { id: 3 })).rejects.toThrow(/sudah tercatat/);
    expect(inserted.filter((row) => row.table === "audit_logs")).toHaveLength(0);
  });
});
