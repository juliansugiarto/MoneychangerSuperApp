import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { rescreenAllCustomers, screenCustomer } from "./customerWatchlistScreening";
import { openBlockFromScreening, openOfficerBlock, resolveWatchlistBlock } from "./watchlistBlocks";

/**
 * Penulis `watchlist_blocks`. Pembantu basis data palsu disalin dari
 * `server/customerWatchlistScreening.test.ts`; `values` berupa larik dicatat per baris.
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

type Inserted = { table: string; values: Record<string, unknown> };

function mockDb(rowsByTable: Record<string, unknown[]>) {
  const inserted: Inserted[] = [];
  const updated: string[] = [];
  const selected: string[] = [];
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => { selected.push(tableName(table)); return makeReader(rowsByTable[tableName(table)] ?? []); } })),
    insert: vi.fn((table: unknown) => ({
      values: async (values: Record<string, unknown> | Record<string, unknown>[]) => {
        for (const row of Array.isArray(values) ? values : [values]) inserted.push({ table: tableName(table), values: row });
      },
    })),
    update: vi.fn((table: unknown) => {
      updated.push(tableName(table));
    }),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { inserted, updated, selected };
}

/** Satu baris daftar sanksi yang lengkap seperlunya bagi `searchSanctionsWatchlist`. */
function entriDaftar(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1, listType: "DTTOT", sourceLabel: "DTTOT 2026", entityType: "INDIVIDUAL", referenceCode: "IDN-001",
    fullName: "ABDUL RAHMAN SALEH", aliases: null, dateOfBirth: null, placeOfBirth: null, nationality: null,
    address: null, description: null, sourceFileName: "dttot.xlsx", importedByUserId: 1,
    importedAt: new Date("2026-09-01T03:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("openBlockFromScreening", () => {
  it("membuka blokir OPEN bersumber PENYARINGAN dengan kuncinya", async () => {
    const { inserted } = mockDb({ watchlist_blocks: [] });
    expect(await openBlockFromScreening({ customerId: 7, screeningId: 40, matchKeys: ["DTTOT:IDN-001"] })).toBe(true);
    const row = inserted.find((entry) => entry.table === "watchlist_blocks")!;
    expect(row.values).toMatchObject({ customerId: 7, screeningId: 40, source: "PENYARINGAN", status: "OPEN", matchKeys: "[\"DTTOT:IDN-001\"]" });
    expect(row.values.openedAt).toBeInstanceOf(Date);
  });
  it("tidak membuka kedua kalinya selama blokir masih OPEN", async () => {
    const { inserted } = mockDb({ watchlist_blocks: [{ id: 1, customerId: 7, status: "OPEN", matchKeys: null }] });
    expect(await openBlockFromScreening({ customerId: 7, screeningId: 41, matchKeys: ["DTTOT:IDN-001"] })).toBe(false);
    expect(inserted.filter((entry) => entry.table === "watchlist_blocks")).toHaveLength(0);
  });
});

describe("openOfficerBlock", () => {
  it("membuka blokir PETUGAS tanpa kunci", async () => {
    const { inserted } = mockDb({ watchlist_blocks: [] });
    expect(await openOfficerBlock(9)).toBe(true);
    expect(inserted[0].values).toMatchObject({ customerId: 9, source: "PETUGAS", status: "OPEN", matchKeys: null, screeningId: null });
  });
});

describe("screenCustomer membuka blokir", () => {
  it("penyaringan dengan kecocokan membuka blokir; nihil tidak", async () => {
    const { inserted } = mockDb({ sanctions_watchlist_entries: [entriDaftar()], watchlist_blocks: [] });
    await screenCustomer({ customerId: 7, fullName: "ABDUL RAHMAN SALEH", trigger: "NASABAH_DIBUAT", screenedByUserId: 3 });
    expect(inserted.filter((entry) => entry.table === "watchlist_blocks")).toHaveLength(1);
    const second = mockDb({ sanctions_watchlist_entries: [entriDaftar()], watchlist_blocks: [] });
    await screenCustomer({ customerId: 8, fullName: "BUDI SANTOSO WIJAYA", trigger: "NASABAH_DIBUAT", screenedByUserId: 3 });
    expect(second.inserted.filter((entry) => entry.table === "watchlist_blocks")).toHaveLength(0);
  });
});

describe("rescreenAllCustomers membuka blokir hanya bagi yang cocok", () => {
  it("dua nasabah, satu cocok → satu blokir, blokir dibaca sekali", async () => {
    const { inserted, selected } = mockDb({
      sanctions_watchlist_entries: [entriDaftar()],
      customers: [{ id: 7, fullName: "ABDUL RAHMAN SALEH" }, { id: 8, fullName: "BUDI SANTOSO WIJAYA" }],
      watchlist_blocks: [],
      customer_watchlist_screenings: [],
    });
    await rescreenAllCustomers();
    const blocks = inserted.filter((entry) => entry.table === "watchlist_blocks");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].values).toMatchObject({ customerId: 7 });
    expect(selected.filter((table) => table === "watchlist_blocks")).toHaveLength(1);
  });
});

describe("resolveWatchlistBlock", () => {
  it("menolak tanggal tembusan BI di masa depan sebelum menyentuh basis data (temuan M4)", async () => {
    const getDb = vi.spyOn(db, "getDb");
    const tomorrow = new Date(Date.now() + 86_400_000);
    await expect(resolveWatchlistBlock({ blockId: 1, decision: "CONFIRMED", notes: "Cocok dengan daftar.", biCopySentAt: tomorrow }, { id: 1 })).rejects.toThrow("Tanggal tembusan tidak boleh di masa depan.");
    expect(getDb).not.toHaveBeenCalled();
    getDb.mockRestore();
  });
});
