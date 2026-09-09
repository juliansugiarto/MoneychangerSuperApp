import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import * as operations from "./operations";
import { IRA_KPMR_QUESTIONS } from "../shared/iraKpmrCatalogue";
import { IRA_PARAMETER_CATALOGUE } from "../shared/iraParameterCatalogue";
import {
  approveAssessment,
  computeAssessmentTotals,
  createAssessment,
  readAssessment,
  saveInherentValues,
  saveKpmrAnswers,
  submitAssessment,
} from "./iraAssessment";

/**
 * Penulis penilaian IRA: pembuatan, pengisian, pengajuan, persetujuan yang membekukan, dan
 * penggantian. Basis data palsunya menyaring `where` dan mencatat setiap tulisan, sehingga uji ini
 * benar-benar melihat apa yang ditulis, bukan hanya bahwa fungsinya tidak melempar.
 */

const periodStart = new Date("2026-01-01T00:00:00.000Z");
const periodEnd = new Date("2027-01-01T00:00:00.000Z");
const admin = { id: 4 };
const shareholder = { id: 9 };

/** 33 nilai lengkap, seluruhnya bernilai 5 kecuali yang disebutkan — penilaian paling aman. */
const nilaiLengkap = (over: Record<string, number> = {}) =>
  IRA_PARAMETER_CATALOGUE.map((entry) => ({
    parameterCode: entry.code,
    machineScore: entry.source === "HITUNG" ? (over[entry.code] ?? 5) : null,
    appliedScore: over[entry.code] ?? 5,
    bandIndex: null,
    overrideReason: null,
    basis: null,
  }));

/** 31 jawaban, seluruhnya `strong` kecuali yang tidak berlaku bagi KUPVA BB. */
const jawabanLengkap = (score = 5) =>
  IRA_KPMR_QUESTIONS.map((question) => ({
    questionCode: question.code,
    answered: true,
    score: question.applicableToKupvaBb ? score : null,
    note: null,
    documentReference: null,
  }));

describe("aritmetika penilaian dari baris tersimpan", () => {
  it("seluruh parameter bernilai 5 dan seluruh jawaban strong menghasilkan nilai akhir 5", () => {
    const totals = computeAssessmentTotals(nilaiLengkap(), jawabanLengkap());
    expect(totals.inherentScore).toBe("5");
    expect(totals.inherentPredicate).toBe("RENDAH");
    expect(totals.kpmrScore).toBe("5");
    expect(totals.kpmrPredicate).toBe("STRONG");
    expect(totals.finalValue).toBe(5);
    expect(totals.finalPredicate).toBe("RENDAH");
  });

  it("seluruh parameter bernilai 1 dan seluruh jawaban unsatisfactory menghasilkan nilai akhir 1", () => {
    const semuaSatu = Object.fromEntries(IRA_PARAMETER_CATALOGUE.map((entry) => [entry.code, 1]));
    const totals = computeAssessmentTotals(nilaiLengkap(semuaSatu), jawabanLengkap(1));
    expect(totals.inherentScore).toBe("1");
    expect(totals.inherentPredicate).toBe("TINGGI");
    expect(totals.kpmrPredicate).toBe("UNSATISFACTORY");
    expect(totals.finalValue).toBe(1);
  });

  it("menolak menghitung bila ada parameter yang belum bernilai — bukan menganggapnya nol", () => {
    const kurang = nilaiLengkap().filter((row) => row.parameterCode !== "TPPU_3E");
    expect(() => computeAssessmentTotals(kurang, jawabanLengkap())).toThrow(/TPPU_3E/);
  });

  it("menolak menghitung bila ada pertanyaan yang belum dijawab", () => {
    const belum = jawabanLengkap().map((row, index) => (index === 0 ? { ...row, answered: false, score: null } : row));
    expect(() => computeAssessmentTotals(nilaiLengkap(), belum)).toThrow(/belum dijawab/i);
  });

  it("N/A tidak menurunkan nilai KPMR — pertanyaan transfer dana memang tidak berlaku", () => {
    const totals = computeAssessmentTotals(nilaiLengkap(), jawabanLengkap(4));
    expect(totals.kpmrScore).toBe("4");
    const pilar2 = totals.pillarAverages.find((row) => row.pillar === "KEBIJAKAN_PROSEDUR")!;
    expect(pilar2.average).toBe("4");
  });
});

describe("penulis penilaian", () => {
  it("membuat penilaian tahunan dan mencatat auditnya", async () => {
    const { inserted, audit } = mockDb({ ira_assessments: [] });
    await createAssessment({ periodStart, periodEnd, trigger: "TAHUNAN", triggerReason: null }, admin);

    expect(inserted[0].table).toBe("ira_assessments");
    expect(inserted[0].values).toMatchObject({ trigger: "TAHUNAN", status: "DRAFT", createdByUserId: 4 });
    expect(audit.mock.calls[0][0]).toMatchObject({ action: "IRA_ASSESSMENT_CREATED", entityType: "ira_assessment" });
  });

  it("menolak pemicu manual tanpa alasan tertulis", async () => {
    mockDb({ ira_assessments: [] });
    await expect(createAssessment({ periodStart, periodEnd, trigger: "MANUAL", triggerReason: "   " }, admin))
      .rejects.toThrow(/alasan/i);
  });

  it("menolak penilaian kedua pada periode yang sama tanpa alasan tertulis", async () => {
    mockDb({ ira_assessments: [{ id: 1, periodStart, periodEnd, status: "DISETUJUI", supersededByAssessmentId: null }] });
    await expect(createAssessment({ periodStart, periodEnd, trigger: "TAHUNAN", triggerReason: null }, admin))
      .rejects.toThrow(/sudah ada|alasan/i);
  });

  it("penilaian pengganti menautkan supersededByAssessmentId ke pendahulunya", async () => {
    const { updated } = mockDb({
      ira_assessments: [
        { id: 1, periodStart, periodEnd, status: "DISETUJUI", supersededByAssessmentId: null },
        { id: 2, periodStart, periodEnd, status: "MENUNGGU_PERSETUJUAN", supersededByAssessmentId: null, createdByUserId: 4 },
      ],
      ira_inherent_values: nilaiLengkap().map((row) => ({ ...row, assessmentId: 2 })),
      ira_kpmr_answers: jawabanLengkap().map((row) => ({ ...row, assessmentId: 2 })),
      ira_parameter_thresholds: [],
      ira_risk_classifications: [],
    });

    await approveAssessment(2, shareholder);

    const penggantian = updated.find((row) => row.values.supersededByAssessmentId === 2);
    expect(penggantian).toBeTruthy();
  });

  it("membekukan nilai parameter, ambang, dan klasifikasi saat disetujui", async () => {
    const { updated } = mockDb({
      ira_assessments: [{ id: 5, periodStart, periodEnd, status: "MENUNGGU_PERSETUJUAN", supersededByAssessmentId: null }],
      ira_inherent_values: nilaiLengkap().map((row) => ({ ...row, assessmentId: 5 })),
      ira_kpmr_answers: jawabanLengkap().map((row) => ({ ...row, assessmentId: 5 })),
      ira_parameter_thresholds: [],
      ira_risk_classifications: [{ dimension: "CURRENCY", code: "USD", riskType: "TPPU", level: "TINGGI", sourceNote: "SRA" }],
    });

    await approveAssessment(5, shareholder);

    const beku = updated.find((row) => row.values.status === "DISETUJUI")!;
    expect(beku.values).toMatchObject({ status: "DISETUJUI", approvedByUserId: 9, inherentPredicate: "RENDAH", finalValue: 5 });
    expect(beku.values.inherentScore).toBe("5");
    expect(Array.isArray(beku.values.frozenThresholds)).toBe(true);
    expect(beku.values.frozenClassifications).toEqual([
      { dimension: "CURRENCY", code: "USD", riskType: "TPPU", level: "TINGGI", sourceNote: "SRA" },
    ]);
  });

  it("nilai beku TIDAK berubah ketika klasifikasi diubah sesudahnya", async () => {
    // Penilaian yang sudah disetujui menyimpan nilainya sendiri; pembacaannya tidak menghitung ulang.
    mockDb({
      ira_assessments: [{
        id: 8,
        periodStart,
        periodEnd,
        status: "DISETUJUI",
        inherentScore: "3.9620",
        inherentPredicate: "MENENGAH",
        kpmrScore: "4.0000",
        kpmrPredicate: "SATISFACTORY",
        finalValue: 4,
        finalPredicate: "RENDAH_KE_MENENGAH",
        frozenClassifications: [{ dimension: "CURRENCY", code: "USD", riskType: "TPPU", level: "MENENGAH" }],
        supersededByAssessmentId: null,
      }],
      // Klasifikasi hidup sekarang berbeda dari yang dibekukan: USD sudah dinaikkan menjadi TINGGI.
      ira_risk_classifications: [{ dimension: "CURRENCY", code: "USD", riskType: "TPPU", level: "TINGGI", sourceNote: "SRA baru" }],
      ira_inherent_values: nilaiLengkap().map((row) => ({ ...row, assessmentId: 8 })),
      ira_kpmr_answers: jawabanLengkap().map((row) => ({ ...row, assessmentId: 8 })),
      ira_parameter_thresholds: [],
    });

    const hasil = await readAssessment(8);

    expect(hasil.assessment.inherentScore).toBe("3.9620");
    expect(hasil.assessment.finalValue).toBe(4);
    expect(hasil.assessment.frozenClassifications).toEqual([
      { dimension: "CURRENCY", code: "USD", riskType: "TPPU", level: "MENENGAH" },
    ]);
  });

  it("menolak menyetujui penilaian yang belum diajukan", async () => {
    mockDb({
      ira_assessments: [{ id: 3, periodStart, periodEnd, status: "DRAFT", supersededByAssessmentId: null }],
      ira_inherent_values: [],
      ira_kpmr_answers: [],
    });
    await expect(approveAssessment(3, shareholder)).rejects.toThrow(/diajukan/i);
  });

  it("menolak menyimpan nilai pada penilaian yang sudah disetujui", async () => {
    mockDb({ ira_assessments: [{ id: 6, periodStart, periodEnd, status: "DISETUJUI", supersededByAssessmentId: null }] });
    await expect(saveInherentValues(6, nilaiLengkap(), admin)).rejects.toThrow(/disetujui|terkunci/i);
    await expect(saveKpmrAnswers(6, jawabanLengkap(), admin)).rejects.toThrow(/disetujui|terkunci/i);
    await expect(submitAssessment(6, admin)).rejects.toThrow(/disetujui|terkunci/i);
  });

  it("menolak nilai yang menyimpang dari angka mesin tanpa alasan", async () => {
    mockDb({ ira_assessments: [{ id: 7, periodStart, periodEnd, status: "DRAFT", supersededByAssessmentId: null }] });
    const menyimpang = nilaiLengkap().map((row) =>
      row.parameterCode === "TPPU_1A" ? { ...row, machineScore: 5, appliedScore: 2, overrideReason: null } : row,
    );
    await expect(saveInherentValues(7, menyimpang, admin)).rejects.toThrow(/alasan/i);
  });

  it("menerima penyimpangan yang beralasan dan menyimpan alasannya", async () => {
    const { inserted } = mockDb({ ira_assessments: [{ id: 7, periodStart, periodEnd, status: "DRAFT", supersededByAssessmentId: null }] });
    const menyimpang = nilaiLengkap().map((row) =>
      row.parameterCode === "TPPU_1A" ? { ...row, machineScore: 5, appliedScore: 2, overrideReason: "Omzet USD melonjak pada Desember." } : row,
    );
    await saveInherentValues(7, menyimpang, admin);
    const baris = inserted.find((row) => row.values.parameterCode === "TPPU_1A")!;
    expect(baris.values).toMatchObject({ appliedScore: 2, overrideReason: "Omzet USD melonjak pada Desember." });
  });

  it("tidak pernah menulis ke tabel customers", async () => {
    const { inserted, updated } = mockDb({
      ira_assessments: [{ id: 5, periodStart, periodEnd, status: "MENUNGGU_PERSETUJUAN", supersededByAssessmentId: null }],
      ira_inherent_values: nilaiLengkap().map((row) => ({ ...row, assessmentId: 5 })),
      ira_kpmr_answers: jawabanLengkap().map((row) => ({ ...row, assessmentId: 5 })),
      ira_parameter_thresholds: [],
      ira_risk_classifications: [],
    });

    await createAssessment({ periodStart, periodEnd, trigger: "MANUAL", triggerReason: "Pemeriksaan BI." }, admin);
    await saveInherentValues(5, nilaiLengkap(), admin);
    await saveKpmrAnswers(5, jawabanLengkap(), admin);
    await approveAssessment(5, shareholder);

    for (const write of [...inserted, ...updated]) expect(write.table).not.toBe("customers");
  });
});

type Rows = Record<string, unknown[]>;
type Write = { table: string; values: Record<string, unknown>; upsert?: Record<string, unknown> };

/**
 * Penelusur nilai terikat pada klausa Drizzle, disalin dari `server/iraDataForm.test.ts` — versi
 * yang ikut menuruni larik, sehingga `inArray` tidak terlewat dan penyaringan benar-benar berlaku.
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
        return values.some((value) =>
          value instanceof Date && record[key] instanceof Date
            ? (value as Date).getTime() === (record[key] as Date).getTime()
            : record[key] === value);
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

function mockDb(rows: Rows) {
  const inserted: Write[] = [];
  const updated: Write[] = [];
  const fakeDb: Record<string, unknown> = {
    select: vi.fn(() => ({ from: (table: unknown) => makeReader(rows[tableName(table)] ?? []) })),
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown> | Record<string, unknown>[]) => {
        const list = Array.isArray(values) ? values : [values];
        const written = list.map((value) => {
          const row: Write = { table: tableName(table), values: value };
          inserted.push(row);
          return row;
        });
        return {
          onDuplicateKeyUpdate: (args: { set: Record<string, unknown> }) => {
            for (const row of written) row.upsert = args.set;
            return Promise.resolve(undefined);
          },
          $returningId: () => Promise.resolve([{ id: 101 }]),
          then: (ok: any) => Promise.resolve(undefined).then(ok),
        };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updated.push({ table: tableName(table), values });
          return Promise.resolve(undefined);
        },
      }),
    })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  const audit = vi.spyOn(operations, "writeAudit").mockResolvedValue(undefined as never);
  return { inserted, updated, audit };
}
