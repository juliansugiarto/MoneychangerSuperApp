import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { setClassificationReviewInterval, signClassificationReview } from "./iraClassificationReview";
import { IRA_DISTRIBUTION_CHANNELS, IRA_LEGAL_FORMS, IRA_OCCUPATION_CATEGORIES, IRA_PROVINCE_LABELS } from "../shared/iraVocabulary";

/**
 * Pengesahan berkala klasifikasi risiko — ditolak selama ada kode belum diklasifikasi.
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


function fullClassificationRows() {
  const universe: [string, string[]][] = [
    ["CURRENCY", ["USD"]],
    ["OCCUPATION", [...IRA_OCCUPATION_CATEGORIES]],
    ["LEGAL_FORM", [...IRA_LEGAL_FORMS]],
    ["PROVINCE", Object.keys(IRA_PROVINCE_LABELS)],
    ["DISTRIBUTION_CHANNEL", [...IRA_DISTRIBUTION_CHANNELS]],
  ];
  return universe.flatMap(([dimension, codes]) => codes.flatMap((code) => ["TPPU", "TPPT", "PPSPM"].map((riskType) => ({
    dimension, code, riskType, level: "RENDAH", sourceNote: "SRA 2026", updatedAt: new Date(),
  }))));
}

describe("signClassificationReview", () => {
  it("menolak selama masih ada kode belum diklasifikasi", async () => {
    mockDb({ ira_risk_classifications: [], currencies: [{ code: "USD", active: true }], customers: [] });
    await expect(signClassificationReview({ notes: "Tinjauan tahunan" }, { id: 3 })).rejects.toThrow(/belum diklasifikasi/);
  });
  it("mengesahkan dengan snapshot seluruh baris dan menulis audit", async () => {
    const rows = fullClassificationRows(); // helper di berkas uji: seluruh semesta × 3 untuk USD, tanpa negara
    const { inserted } = mockDb({ ira_risk_classifications: rows, currencies: [{ code: "USD", active: true }], customers: [] });
    await signClassificationReview({ notes: "Tidak ada perubahan SRA" }, { id: 3 });
    const review = inserted.find((row) => row.table === "ira_classification_reviews")!;
    expect(review.values).toMatchObject({ reviewedByUserId: 3, notes: "Tidak ada perubahan SRA", classificationCount: rows.length });
    expect(JSON.parse(review.values.snapshot as string)).toHaveLength(rows.length);
    expect(inserted.some((row) => row.table === "audit_logs" && row.values.action === "IRA_CLASSIFICATION_REVIEWED")).toBe(true);
  });
  it("catatan kosong ditolak", async () => {
    mockDb({ ira_risk_classifications: [], currencies: [], customers: [] });
    await expect(signClassificationReview({ notes: "  " }, { id: 3 })).rejects.toThrow(/Catatan/);
  });
});

describe("setClassificationReviewInterval", () => {
  it("hanya 1–36 bulan", async () => {
    mockDb({ operational_settings: [{ settingCode: "REVIEW_THRESHOLD" }] });
    await expect(setClassificationReviewInterval({ months: 0 }, { id: 3 })).rejects.toThrow(/1 sampai 36/);
    await expect(setClassificationReviewInterval({ months: 37 }, { id: 3 })).rejects.toThrow(/1 sampai 36/);
  });
});
