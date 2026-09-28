import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { resolveWatchlistBlock, revokeWatchlistBlock, watchlistBlockDenial } from "./watchlistBlocks";

/**
 * Keputusan atas pemblokiran — CONTROLLER ke atas, catatan wajib, setiap keputusan diaudit.
 * Pembantu klausa disalin dari `server/customerWatchlistScreening.test.ts`.
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
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => makeReader(rowsByTable[tableName(table)] ?? []) })),
    insert: vi.fn((table: unknown) => ({
      values: async (values: Record<string, unknown>) => { inserted.push({ table: tableName(table), values }); },
    })),
    update: vi.fn((table: unknown) => ({
      set: (set: Record<string, unknown>) => ({ where: async () => { updates.push({ table: tableName(table), set }); } }),
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { inserted, updates };
}

beforeEach(() => {
  vi.restoreAllMocks();
});


describe("watchlistBlockDenial", () => {
  it("hanya CONTROLLER ke atas", () => {
    expect(watchlistBlockDenial({ role: "ADMIN" })).not.toBeNull();
    expect(watchlistBlockDenial({ role: "CONTROLLER" })).toBeNull();
    expect(watchlistBlockDenial({ role: "SHAREHOLDER" })).toBeNull();
  });
});

describe("resolveWatchlistBlock", () => {
  it("CONFIRMED menyetel dttotPpsdmMatch dan menulis audit", async () => {
    const { updates, inserted } = mockDb({ watchlist_blocks: [{ id: 5, customerId: 1, status: "OPEN", matchKeys: null, source: "PENYARINGAN" }], customers: [{ id: 1, dttotPpsdmMatch: false, dttotPpsdmNotes: null }] });
    await resolveWatchlistBlock({ blockId: 5, decision: "CONFIRMED", notes: "Tanggal lahir dan NIK sama dengan entri IDN-001" }, { id: 3 });
    expect(updates.find((row) => row.table === "watchlist_blocks")!.set).toMatchObject({ status: "CONFIRMED", resolvedByUserId: 3 });
    expect(updates.find((row) => row.table === "customers")!.set).toMatchObject({ dttotPpsdmMatch: true });
    expect(inserted.find((row) => row.table === "audit_logs")!.values).toMatchObject({ action: "WATCHLIST_BLOCK_CONFIRMED", entityType: "watchlist_block", entityId: "5" });
  });
  it("FALSE_POSITIVE blokir PETUGAS membersihkan centangnya", async () => {
    const { updates } = mockDb({ watchlist_blocks: [{ id: 6, customerId: 1, status: "OPEN", matchKeys: null, source: "PETUGAS" }], customers: [{ id: 1, dttotPpsdmMatch: true, dttotPpsdmNotes: "x" }] });
    await resolveWatchlistBlock({ blockId: 6, decision: "FALSE_POSITIVE", notes: "Beda tanggal lahir" }, { id: 3 });
    expect(updates.find((row) => row.table === "customers")!.set).toMatchObject({ dttotPpsdmMatch: false });
  });
  it("menolak catatan kosong dan blokir yang sudah diputuskan", async () => {
    mockDb({ watchlist_blocks: [{ id: 5, customerId: 1, status: "CONFIRMED", matchKeys: null, source: "PENYARINGAN" }], customers: [] });
    await expect(resolveWatchlistBlock({ blockId: 5, decision: "FALSE_POSITIVE", notes: "   " }, { id: 3 })).rejects.toThrow(/Catatan/);
    await expect(resolveWatchlistBlock({ blockId: 5, decision: "FALSE_POSITIVE", notes: "alasan cukup" }, { id: 3 })).rejects.toThrow(/sudah diputuskan/);
  });
});

describe("revokeWatchlistBlock", () => {
  it("hanya dari CONFIRMED dan wajib rujukan surat", async () => {
    mockDb({ watchlist_blocks: [{ id: 5, customerId: 1, status: "OPEN", matchKeys: null }], customers: [] });
    await expect(revokeWatchlistBlock({ blockId: 5, revocationReference: "S-1/2026", notes: "dicabut" }, { id: 3 })).rejects.toThrow(/Hanya blokir yang dikonfirmasi/);
  });
});
