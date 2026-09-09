import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import * as operations from "./operations";
import {
  classificationKey,
  classificationLevel,
  classifyRisk,
  iraClassificationDenial,
  readClassifications,
} from "./iraRiskClassification";

/**
 * Klasifikasi risiko inheren: gerbang peran, penulis yang menimpa alih-alih menggandakan, auditnya,
 * dan ketiadaan yang berperilaku seperti RENDAH.
 */

type Rows = Record<string, unknown[]>;

/**
 * Pasangan kolom-nilai yang terikat pada klausa SQL Drizzle. Palsunya ikut menyaring `where`;
 * palsu yang mengabaikannya mengembalikan baris yang di produksi tidak akan pernah terbaca.
 */
function boundPairs(clause: unknown): Record<string, unknown> {
  const pairs: Record<string, unknown> = {};
  let lastColumn: string | null = null;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const candidate = node as { name?: unknown; value?: unknown; queryChunks?: unknown[]; columnType?: unknown };
    if (typeof candidate.name === "string" && candidate.columnType) lastColumn = candidate.name;
    // `Array.isArray` menyisihkan StringChunk pemisah (` = `), yang juga punya `value` dan kalau
    // tidak disisihkan akan merebut giliran Param yang sesungguhnya.
    else if (lastColumn && "value" in candidate && !Array.isArray(candidate.value)) { pairs[lastColumn] = candidate.value; lastColumn = null; }
    if (Array.isArray(candidate.queryChunks)) candidate.queryChunks.forEach(walk);
  };
  walk(clause);
  return pairs;
}

function makeReader(rows: unknown[], order: { column: string; direction: "asc" | "desc" }[] = []): Record<string, unknown> & PromiseLike<unknown[]> {
  const applied = order.length === 0 ? rows : [...rows].sort((left, right) => {
    for (const { column, direction } of order) {
      const a = (left as Record<string, unknown>)[column];
      const b = (right as Record<string, unknown>)[column];
      if (a === b) continue;
      const smaller = (a as never) < (b as never) ? -1 : 1;
      return direction === "asc" ? smaller : -smaller;
    }
    return 0;
  });
  return {
    from: () => makeReader(applied, order),
    where: (clause: unknown) => {
      const pairs = boundPairs(clause);
      const matching = applied.filter((row) => Object.entries(pairs).every(([key, value]) => {
        const record = row as Record<string, unknown>;
        return !(key in record) || record[key] === value;
      }));
      return makeReader(matching, order);
    },
    limit: (count: number) => makeReader(applied.slice(0, count), order),
    orderBy: (...clauses: unknown[]) => makeReader(applied, clauses.map((clause) => {
      const pairs = boundPairs(clause);
      const column = String((clause as { queryChunks?: { name?: string }[] })?.queryChunks?.find((chunk) => chunk?.name)?.name ?? Object.keys(pairs)[0] ?? "");
      const sql = String((clause as { queryChunks?: { value?: unknown }[] })?.queryChunks?.map((chunk) => chunk?.value).join(" ") ?? "");
      return { column, direction: sql.includes("desc") ? "desc" as const : "asc" as const };
    })),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(applied).then(onfulfilled, onrejected),
  };
}

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

function mockDb(rows: Rows) {
  const inserted: { table: string; values: Record<string, unknown>; upsert?: Record<string, unknown> }[] = [];
  const fakeDb: Record<string, unknown> = {
    select: vi.fn(() => ({ from: (table: unknown) => makeReader(rows[tableName(table)] ?? []) })),
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        const row = { table: tableName(table), values } as { table: string; values: Record<string, unknown>; upsert?: Record<string, unknown> };
        inserted.push(row);
        const result = {
          onDuplicateKeyUpdate: (args: { set: Record<string, unknown> }) => { row.upsert = args.set; return Promise.resolve(undefined); },
          then: (ok: any) => Promise.resolve(undefined).then(ok),
        };
        return result;
      },
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  const audit = vi.spyOn(operations, "writeAudit").mockResolvedValue(undefined as never);
  return { inserted, audit };
}

const actor = { id: 4 };
const usdTppu = {
  dimension: "CURRENCY" as const,
  code: "USD",
  riskType: "TPPU" as const,
  level: "TINGGI" as const,
  sourceNote: "SRA 2024 — dolar AS pada peringkat teratas nilai transaksi valas.",
};

describe("klasifikasi risiko — gerbang peran", () => {
  it("menolak STAFF dan ADMIN, menerima CONTROLLER dan SHAREHOLDER", () => {
    expect(iraClassificationDenial({ role: "STAFF", mustChangePassword: false })?.status).toBe(403);
    expect(iraClassificationDenial({ role: "ADMIN", mustChangePassword: false })?.status).toBe(403);
    expect(iraClassificationDenial({ role: "CONTROLLER", mustChangePassword: false })).toBeNull();
    expect(iraClassificationDenial({ role: "SHAREHOLDER", mustChangePassword: false })).toBeNull();
  });

  it("menolak siapa pun yang masih wajib mengganti kata sandi", () => {
    expect(iraClassificationDenial({ role: "CONTROLLER", mustChangePassword: true })?.status).toBe(403);
  });
});

describe("klasifikasi risiko — penulis", () => {
  it("menolak sourceNote kosong", async () => {
    mockDb({ ira_risk_classifications: [] });
    await expect(classifyRisk({ ...usdTppu, sourceNote: "   " }, actor)).rejects.toThrow(/alasan|rujukan|sourceNote/i);
  });

  it("menimpa klasifikasi yang sama (dimension, code, riskType) alih-alih menggandakannya", async () => {
    const { inserted } = mockDb({
      ira_risk_classifications: [{ id: 1, dimension: "CURRENCY", code: "USD", riskType: "TPPU", level: "RENDAH", sourceNote: "lama" }],
    });
    await classifyRisk(usdTppu, actor);

    expect(inserted).toHaveLength(1);
    // Tanpa ON DUPLICATE KEY UPDATE, penyimpanan kedua atas kunci yang sama akan menabrak indeks
    // uniknya dan petugas mendapat galat basis data alih-alih klasifikasinya tersimpan.
    expect(inserted[0].upsert).toBeTruthy();
    expect(inserted[0].upsert?.level).toBe("TINGGI");
    expect(inserted[0].upsert?.sourceNote).toBe(usdTppu.sourceNote);
    expect(inserted[0].upsert?.updatedByUserId).toBe(4);
  });

  it("USD boleh TINGGI untuk TPPU dan MENENGAH untuk TPPT sekaligus", async () => {
    const { inserted } = mockDb({ ira_risk_classifications: [] });
    await classifyRisk(usdTppu, actor);
    await classifyRisk({ ...usdTppu, riskType: "TPPT", level: "MENENGAH", sourceNote: "SRA 2024 — TPPT menengah." }, actor);

    expect(inserted).toHaveLength(2);
    expect(inserted.map((row) => [row.values.riskType, row.values.level])).toEqual([
      ["TPPU", "TINGGI"],
      ["TPPT", "MENENGAH"],
    ]);
    // Satu kode, dua jenis risiko, dua tingkat berbeda — inilah alasan tabel ini ada dan alasan
    // kolom boolean `isHighRisk` pada `currencies` ditolak.
    expect(inserted[0].values.code).toBe(inserted[1].values.code);
  });

  it("menulis audit_logs berisi nilai lama dan nilai baru", async () => {
    const { audit } = mockDb({
      ira_risk_classifications: [{ id: 1, dimension: "CURRENCY", code: "USD", riskType: "TPPU", level: "RENDAH", sourceNote: "dugaan awal" }],
    });
    await classifyRisk(usdTppu, actor);

    expect(audit).toHaveBeenCalledTimes(1);
    const entry = audit.mock.calls[0][0];
    expect(entry.actorUserId).toBe(4);
    expect(entry.entityType).toBe("ira_risk_classification");
    expect(entry.entityId).toBe("CURRENCY|USD|TPPU");
    expect(entry.beforeState).toMatchObject({ level: "RENDAH", sourceNote: "dugaan awal" });
    expect(entry.afterState).toMatchObject({ level: "TINGGI", sourceNote: usdTppu.sourceNote });
  });

  it("mencatat beforeState null ketika kode itu belum pernah diklasifikasikan", async () => {
    const { audit } = mockDb({ ira_risk_classifications: [] });
    await classifyRisk(usdTppu, actor);
    expect(audit.mock.calls[0][0].beforeState).toBeNull();
  });
});

describe("klasifikasi risiko — pembaca", () => {
  it("kode tanpa baris klasifikasi terbaca sebagai RENDAH, bukan undefined", () => {
    const kosong = new Map<string, never>();
    expect(classificationLevel(kosong, "CURRENCY", "EUR", "TPPU")).toBe("RENDAH");
    expect(classificationLevel(kosong, "PROVINCE", "JAWA-BARAT", "TPPT")).toBe("RENDAH");
  });

  it("membaca seluruh baris menjadi peta berkunci dimension|code|riskType", async () => {
    mockDb({
      ira_risk_classifications: [
        { dimension: "CURRENCY", code: "USD", riskType: "TPPU", level: "TINGGI" },
        { dimension: "CURRENCY", code: "USD", riskType: "TPPT", level: "MENENGAH" },
      ],
    });
    const peta = await readClassifications();

    expect(peta.get(classificationKey("CURRENCY", "USD", "TPPU"))).toBe("TINGGI");
    expect(classificationLevel(peta, "CURRENCY", "USD", "TPPT")).toBe("MENENGAH");
    // Mata uang yang sama, jenis risiko ketiga yang belum diklasifikasikan: RENDAH, bukan TINGGI.
    expect(classificationLevel(peta, "CURRENCY", "USD", "PPSPM")).toBe("RENDAH");
  });
});
