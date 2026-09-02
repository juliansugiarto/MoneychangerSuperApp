import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { importSanctionsWatchlist, listSanctionsWatchlistSummary, searchSanctionsWatchlist } from "./operations";

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    limit: () => makeReader(rows),
    orderBy: () => Promise.resolve(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function dttotWorkbookBase64(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { base64: buffer.toString("base64"), byteSize: buffer.byteLength };
}

describe("importSanctionsWatchlist", () => {
  function mockImportDb() {
    const deleted: unknown[] = [];
    const inserted: unknown[] = [];
    const fakeTx = {
      delete: vi.fn(() => ({ where: (condition: unknown) => { deleted.push(condition); return Promise.resolve(); } })),
      insert: vi.fn(() => ({ values: (values: unknown) => { inserted.push(values); return Promise.resolve(); } })),
    };
    const fakeDb = { transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(fakeTx)) };
    return { getDb: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), inserted };
  }

  const dttotHeader = ["Nama", "Deskripsi", "Terduga", "Kode Densus", "Tempat Lahir", "Tanggal Lahir", "WN/Asal Negara", "Alamat"];

  it("parses a valid workbook and replaces the matching (listType, sourceLabel) scope in one transaction", async () => {
    const { base64, byteSize } = dttotWorkbookBase64([
      dttotHeader,
      ["Contoh Orang Uji alias Nama Alias Uji", "- keterangan", "Orang", "TEST-001", "Kota Uji", "01/01/1980", "Indonesia", "Jalan Uji"],
    ]);
    const { getDb, inserted } = mockImportDb();
    const result = await importSanctionsWatchlist({ dataBase64: base64, originalFileName: "dttot-uji.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize, actorUserId: 1 });
    getDb.mockRestore();
    expect(result.listType).toBe("DTTOT");
    expect(result.sourceLabel).toBeNull();
    expect(result.recordCount).toBe(1);
    expect(inserted).toHaveLength(2); // watchlist entries insert + audit log insert
    const entriesInsert = inserted[0] as { fullName: string; sourceFileName: string }[];
    expect(entriesInsert[0].fullName).toBe("Contoh Orang Uji");
    expect(entriesInsert[0].sourceFileName).toBe("dttot-uji.xlsx");
  });

  it("rejects a non-spreadsheet MIME type before ever touching the database", async () => {
    const { getDb } = mockImportDb();
    await expect(importSanctionsWatchlist({ dataBase64: Buffer.from("x").toString("base64"), originalFileName: "f.xlsx", mimeType: "text/plain", byteSize: 1, actorUserId: 1 })).rejects.toThrow(/XLSX atau XLS/);
    getDb.mockRestore();
  });
});

describe("listSanctionsWatchlistSummary", () => {
  it("groups raw entry rows into one summary row per (listType, sourceLabel) scope with a record count", async () => {
    const rows = [
      { listType: "DTTOT" as const, sourceLabel: null, sourceFileName: "dttot.xlsx", importedByUserId: 1, importedAt: new Date("2026-08-19") },
      { listType: "DTTOT" as const, sourceLabel: null, sourceFileName: "dttot.xlsx", importedByUserId: 1, importedAt: new Date("2026-08-19") },
      { listType: "PPPSM" as const, sourceLabel: "DPRK", sourceFileName: "dprk.xlsx", importedByUserId: 2, importedAt: new Date("2024-12-24") },
    ];
    const fakeDb = { select: vi.fn(() => makeReader(rows)) };
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
    const summary = await listSanctionsWatchlistSummary();
    getDb.mockRestore();
    expect(summary).toEqual([
      { listType: "DTTOT", sourceLabel: null, sourceFileName: "dttot.xlsx", importedByUserId: 1, importedAt: rows[0].importedAt, recordCount: 2 },
      { listType: "PPPSM", sourceLabel: "DPRK", sourceFileName: "dprk.xlsx", importedByUserId: 2, importedAt: rows[2].importedAt, recordCount: 1 },
    ]);
  });
});

describe("searchSanctionsWatchlist", () => {
  const entries = [
    { id: 1, listType: "DTTOT" as const, sourceLabel: null, entityType: "INDIVIDUAL" as const, referenceCode: "TEST-001", fullName: "Budi Santoso", aliases: "Budi S\nSi Budi", dateOfBirth: null, placeOfBirth: null, nationality: null, address: null, description: null },
    { id: 2, listType: "PPPSM" as const, sourceLabel: "DPRK", entityType: "ENTITY" as const, referenceCode: "DPRKe.001", fullName: "Yayasan Tidak Terkait", aliases: null, dateOfBirth: null, placeOfBirth: null, nationality: null, address: null, description: null },
  ];

  function mockSearchDb() {
    const fakeDb = { select: vi.fn(() => makeReader(entries)) };
    return vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  }

  it("rejects a query shorter than 3 characters", async () => {
    await expect(searchSanctionsWatchlist({ query: "ab" })).rejects.toThrow(/minimal 3 karakter/);
  });

  it("returns a scored match for a name close to a watchlist entry's alias, above threshold", async () => {
    const getDb = mockSearchDb();
    const results = await searchSanctionsWatchlist({ query: "Budi Santoso" });
    getDb.mockRestore();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
    expect(results[0].matchedOn).toBe("Budi Santoso");
    expect(results[0].score).toBe(1);
  });

  it("excludes entries scoring below the match threshold", async () => {
    const getDb = mockSearchDb();
    const results = await searchSanctionsWatchlist({ query: "Zzz Completely Unrelated Name" });
    getDb.mockRestore();
    expect(results).toEqual([]);
  });

  it("sorts multiple matches by descending score", async () => {
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue({ select: vi.fn(() => makeReader([
      { id: 1, listType: "DTTOT" as const, sourceLabel: null, entityType: "INDIVIDUAL" as const, referenceCode: "A", fullName: "Ahmad Yusuf Setiawan", aliases: null, dateOfBirth: null, placeOfBirth: null, nationality: null, address: null, description: null },
      { id: 2, listType: "DTTOT" as const, sourceLabel: null, entityType: "INDIVIDUAL" as const, referenceCode: "B", fullName: "Ahmad Yusuf", aliases: null, dateOfBirth: null, placeOfBirth: null, nationality: null, address: null, description: null },
    ]) ) } as never);
    const results = await searchSanctionsWatchlist({ query: "Ahmad Yusuf" });
    getDb.mockRestore();
    expect(results.map((r) => r.id)).toEqual([2, 1]);
  });
});
