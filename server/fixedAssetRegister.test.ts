import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountingPeriods, fixedAssetSettings, fixedAssets } from "../drizzle/schema";
import * as db from "./db";

vi.mock("./ledgerOperations", () => ({ postJournalEntry: vi.fn() }));
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { postJournalEntry } from "./ledgerOperations";
import { writeAudit } from "./operations";
import { TAX_GROUP_USEFUL_LIFE_MONTHS, registerFixedAsset } from "./fixedAssets";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

type Write = { op: "insert" | "update"; table: unknown; values?: unknown };

/**
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data.
 *
 * Bentuknya sama seperti `periodClosingPosting.test.ts`: kueri dibedakan lewat **tabel** yang
 * diberikan ke `from()`, bukan lewat urutan pemanggilan, karena urutan kueri `registerFixedAsset`
 * bergantung pada cabang — periode hanya dibaca bila jurnal perolehannya akan ditulis.
 */
function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const writes: Write[] = [];
  let nextId = 0;

  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy"]) {
      thenable[method] = () => chain(rows);
    }
    return thenable as never;
  };

  const fakeDb = {
    select: vi.fn(() => ({
      from: (table: unknown) => {
        const queue = queues.get(table) ?? [];
        return chain((queue.length > 1 ? queue.shift() : queue[0]) ?? []);
      },
    })),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        nextId += 1;
        writes.push({ op: "insert", table, values });
        return { $returningId: () => Promise.resolve([{ id: nextId }]) };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: unknown) => ({
        where: () => {
          writes.push({ op: "update", table, values });
          return Promise.resolve();
        },
      }),
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { writes };
}

const settingsRow = { id: 1, capitalisationThresholdIdr: "1000000.00" };
const openPeriod = { id: 7, periodStart: dbDay("2026-03-01"), periodEnd: dbDay("2026-03-31"), status: "TERBUKA" as const };

const scenario = (options: { settings?: unknown[]; periods?: unknown[] } = {}) =>
  mockDb([
    { table: fixedAssetSettings, results: [options.settings ?? [settingsRow]] },
    { table: accountingPeriods, results: [options.periods ?? [openPeriod]] },
    { table: fixedAssets, results: [[]] },
  ]);

const insertedAsset = (writes: Write[]) =>
  writes.find((write) => write.op === "insert" && write.table === fixedAssets)?.values as Record<string, unknown>;

const baseInput = {
  name: "Brankas Chubb",
  category: "PERALATAN_KANTOR" as const,
  taxGroup: "KELOMPOK_1" as const,
  acquisitionDate: "2026-03-17",
  acquisitionCost: "24000000.00",
  residualValue: "0.00",
  usefulLifeMonths: 48,
};

beforeEach(() => {
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 91, entryNumber: "JU-202603-0004" } as never);
  vi.mocked(writeAudit).mockReset().mockResolvedValue(undefined as never);
});

describe("batas kapitalisasi", () => {
  it("menolak aset di bawah batas dan menunjuk modul pengeluaran", async () => {
    scenario();
    await expect(registerFixedAsset({ ...baseInput, acquisitionCost: "750000.00" }, { id: 3 }))
      .rejects.toThrow(/Catat Pengeluaran/i);
  });

  it("menyebut angka batasnya di dalam pesannya", async () => {
    scenario();
    await expect(registerFixedAsset({ ...baseInput, acquisitionCost: "750000.00" }, { id: 3 }))
      .rejects.toThrow(/1000000\.00|1\.000\.000/);
  });

  it("menerima aset tepat pada batas", async () => {
    scenario();
    await expect(registerFixedAsset({ ...baseInput, acquisitionCost: "1000000.00" }, { id: 3 })).resolves.toBeTruthy();
  });

  it("mengecualikan tanah dari batas", async () => {
    scenario();
    await expect(
      registerFixedAsset({ ...baseInput, category: "TANAH", taxGroup: "TIDAK_DISUSUTKAN", usefulLifeMonths: null, acquisitionCost: "500000.00" }, { id: 3 }),
    ).resolves.toBeTruthy();
  });

  it("memakai batas default bila barisnya belum ada", async () => {
    scenario({ settings: [] });
    await expect(registerFixedAsset({ ...baseInput, acquisitionCost: "750000.00" }, { id: 3 }))
      .rejects.toThrow(/Catat Pengeluaran/i);
  });
});

describe("pendaftaran aset baru", () => {
  it("menjurnal perolehan ke 1-1510 lawan 2-1900 bersumber PEROLEHAN_ASET", async () => {
    scenario();
    await registerFixedAsset(baseInput, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.sourceType).toBe("PEROLEHAN_ASET");
    expect(entry.sourceReference).toMatch(/^ASET-\d+$/);
    expect(entry.lines.map((line) => line.accountCode)).toEqual(["1-1510", "2-1900"]);
  });

  it("bertanggal tanggal perolehan sebagai tengah malam lokal, bukan UTC", async () => {
    scenario();
    await registerFixedAsset(baseInput, { id: 3 });
    const [entry] = vi.mocked(postJournalEntry).mock.calls[0];
    expect(entry.entryDate).toEqual(dbDay("2026-03-17"));
  });

  it("menyusutkan mulai bulan perolehan", async () => {
    const { writes } = scenario();
    await registerFixedAsset(baseInput, { id: 3 });
    expect(insertedAsset(writes).firstJournalMonth).toBe("2026-03");
    expect(insertedAsset(writes).openingAccumulatedDepreciation).toBe("0.00");
  });

  it("menyimpan tanggal perolehan sebagai tengah malam lokal", async () => {
    const { writes } = scenario();
    await registerFixedAsset(baseInput, { id: 3 });
    expect(insertedAsset(writes).acquisitionDate).toEqual(dbDay("2026-03-17"));
  });

  it("menautkan jurnal perolehannya ke barisnya", async () => {
    const { writes } = scenario();
    await registerFixedAsset(baseInput, { id: 3 });
    const update = writes.find((write) => write.op === "update" && write.table === fixedAssets);
    expect(update?.values).toMatchObject({ acquisitionJournalEntryId: 91 });
  });

  it("menolak tanah yang diberi umur manfaat", async () => {
    scenario();
    await expect(registerFixedAsset({ ...baseInput, category: "TANAH", usefulLifeMonths: 48 }, { id: 3 }))
      .rejects.toThrow(/tanah/i);
  });

  it("menolak aset selain tanah yang umur manfaatnya kosong", async () => {
    scenario();
    await expect(registerFixedAsset({ ...baseInput, usefulLifeMonths: null }, { id: 3 }))
      .rejects.toThrow(/umur manfaat/i);
  });

  it("menolak pendaftaran yang jurnalnya jatuh pada periode tertutup, menunjuk jalur aset warisan", async () => {
    scenario({ periods: [{ ...openPeriod, status: "DITUTUP" }] });
    await expect(registerFixedAsset(baseInput, { id: 3 })).rejects.toThrow(/aset warisan/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it("menulis jejak audit", async () => {
    scenario();
    await registerFixedAsset(baseInput, { id: 3 });
    const [audit] = vi.mocked(writeAudit).mock.calls[0];
    expect(audit.action).toBe("FIXED_ASSET_REGISTERED");
    expect(audit.entityType).toBe("fixed_assets");
  });
});

describe("pendaftaran aset warisan", () => {
  const legacyInput = {
    ...baseInput,
    acquisitionDate: "2024-03-05",
    firstJournalMonth: "2026-09",
    openingAccumulatedDepreciation: "15000000.00",
  };

  it("tidak menulis jurnal perolehan", async () => {
    const { writes } = scenario();
    await registerFixedAsset(legacyInput, { id: 3 });
    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(insertedAsset(writes).acquisitionJournalEntryId).toBeNull();
  });

  it("menyimpan akumulasi awal dan bulan jurnal pertamanya apa adanya", async () => {
    const { writes } = scenario();
    await registerFixedAsset(legacyInput, { id: 3 });
    expect(insertedAsset(writes).firstJournalMonth).toBe("2026-09");
    expect(insertedAsset(writes).openingAccumulatedDepreciation).toBe("15000000.00");
  });

  it("menolak akumulasi awal yang melebihi dasar penyusutan", async () => {
    scenario();
    await expect(registerFixedAsset({ ...legacyInput, openingAccumulatedDepreciation: "30000000.00" }, { id: 3 }))
      .rejects.toThrow(/akumulasi/i);
  });

  it("menolak bulan jurnal pertama yang mendahului bulan perolehan", async () => {
    scenario();
    await expect(registerFixedAsset({ ...legacyInput, firstJournalMonth: "2024-01" }, { id: 3 }))
      .rejects.toThrow(/bulan/i);
  });
});

describe("default umur manfaat kelompok pajak", () => {
  it("memetakan kelompok DJP ke bulan", () => {
    expect(TAX_GROUP_USEFUL_LIFE_MONTHS).toEqual({
      KELOMPOK_1: 48,
      KELOMPOK_2: 96,
      KELOMPOK_3: 192,
      KELOMPOK_4: 240,
      BANGUNAN_PERMANEN: 240,
      BANGUNAN_NON_PERMANEN: 120,
      TIDAK_DISUSUTKAN: null,
    });
  });

  it("memakai umur manfaat yang diberikan, bukan default kelompoknya", async () => {
    const { writes } = scenario();
    await registerFixedAsset({ ...baseInput, usefulLifeMonths: 60 }, { id: 3 });
    expect(insertedAsset(writes).usefulLifeMonths).toBe(60);
  });
});
