import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import * as operations from "./operations";
import { IRA_KPMR_QUESTIONS } from "../shared/iraKpmrCatalogue";
import { IRA_PARAMETER_CATALOGUE } from "../shared/iraParameterCatalogue";
import { readIraDataForm } from "./iraDataForm";
import {
  approveAssessment,
  createAssessment,
  readAssessment,
  readInherentMachineScores,
  saveInherentValues,
  saveKpmrAnswers,
  saveStructuralDeclarations,
  submitAssessment,
} from "./iraAssessment";

/**
 * Skenario penilaian risiko IRA menyeluruh — satu cerita dari ujung ke ujung.
 *
 * Uji lain memeriksa satu fungsi dengan bacaan yang sudah dipasang. Yang ini menjalankan
 * klasifikasi → nasabah → bon → agregat Form C1 → nilai parameter → kuesioner KPMR → pengajuan →
 * persetujuan → pembekuan → **klasifikasi diubah sesudahnya** → penilaian pengganti, seluruhnya di
 * atas satu basis data palsu yang sama, sehingga tulisan satu langkah menjadi bacaan langkah
 * berikutnya.
 *
 * Kekeliruan yang hanya muncul saat langkah-langkahnya bersambung tidak akan terlihat oleh uji per
 * fungsi: nilai yang dihitung ulang saat dibaca, ambang yang berubah diam-diam, atau penilaian lama
 * yang ikut terbawa persetujuan penggantinya.
 */

const periodStart = new Date("2026-01-01T00:00:00.000Z");
const periodEnd = new Date("2027-01-01T00:00:00.000Z");
const admin = { id: 11 };
const shareholder = { id: 22 };

type Row = Record<string, unknown>;

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

/** Penelusur klausa Drizzle yang ikut menuruni larik, sehingga `inArray` tidak terlewat. */
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

const matches = (row: Row, pairs: Record<string, unknown[]>) =>
  Object.entries(pairs).every(([key, values]) => {
    if (!(key in row)) return true;
    return values.some((value) =>
      value instanceof Date && row[key] instanceof Date ? value.getTime() === (row[key] as Date).getTime() : row[key] === value,
    );
  });

/**
 * Menyalin nilai yang ditulis, meniru MySQL yang **menserialisasi** kolom `json` saat menyimpan.
 *
 * Tanpa ini, snapshot yang dibekukan akan menyimpan rujukan ke baris klasifikasi yang sama,
 * sehingga mengubah klasifikasinya sesudah persetujuan ikut mengubah snapshot-nya — palsu yang
 * berbohong tentang justru sifat yang paling ingin dibuktikan uji ini.
 */
const persisted = <T>(value: T): T => structuredClone(value);

function scenarioDb(tables: Record<string, Row[]>) {
  let nextId = 1;
  const reader = (rows: Row[]): Record<string, unknown> & PromiseLike<Row[]> => ({
    from: () => reader(rows),
    innerJoin: () => reader(rows),
    leftJoin: () => reader(rows),
    where: (clause: unknown) => reader(rows.filter((row) => matches(row, boundValues(clause)))),
    orderBy: () => reader(rows),
    limit: (count: number) => reader(rows.slice(0, count)),
    then: (ok: any, fail: any) => Promise.resolve(rows).then(ok, fail),
  });

  const fakeDb: Record<string, unknown> = {
    select: vi.fn(() => ({ from: (table: unknown) => reader(tables[tableName(table)] ?? []) })),
    insert: vi.fn((table: unknown) => ({
      values: (values: Row) => {
        const name = tableName(table);
        tables[name] ??= [];
        const row: Row = persisted({ id: nextId++, ...values }) as Row;
        const finish = () => {
          // Kunci uniknya ditiru: menyimpan ulang parameter atau pertanyaan yang sama menimpa,
          // bukan menggandakan — persis ON DUPLICATE KEY UPDATE pada skemanya.
          const key = ["parameterCode", "questionCode"].find((column) => column in values);
          if (key) {
            const existing = tables[name].find(
              (candidate) => candidate.assessmentId === values.assessmentId && candidate[key] === values[key],
            );
            if (existing) { Object.assign(existing, persisted(values)); return; }
          }
          tables[name].push(row);
        };
        return {
          onDuplicateKeyUpdate: () => { finish(); return Promise.resolve(undefined); },
          $returningId: () => { finish(); return Promise.resolve([{ id: row.id }]); },
          then: (ok: any) => { finish(); return Promise.resolve(undefined).then(ok); },
        };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Row) => ({
        where: (clause: unknown) => {
          const pairs = boundValues(clause);
          for (const row of tables[tableName(table)] ?? []) if (matches(row, pairs)) Object.assign(row, persisted(values));
          return Promise.resolve(undefined);
        },
      }),
    })),
    delete: vi.fn(() => { throw new Error("Penilaian risiko tidak pernah menghapus baris."); }),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  vi.spyOn(operations, "writeAudit").mockResolvedValue(undefined as never);
  return tables;
}

const bon = (id: number, rupiah: string, currencyCode: string, channel: string, nationality: string) => ({
  transactionId: id,
  bonRupiahAmount: rupiah,
  lineRupiahAmount: null,
  currencyCode,
  distributionChannel: channel,
  nationality,
  status: "COMPLETED",
  isDemo: false,
  isHistorical: false,
});

describe("skenario penilaian risiko IRA menyeluruh", () => {
  it("berjalan dari klasifikasi sampai penilaian pengganti tanpa satu pun nilai beku yang bergeser", async () => {
    const tables = scenarioDb({
      ira_risk_classifications: [
        { dimension: "CURRENCY", code: "USD", riskType: "TPPU", level: "TINGGI", sourceNote: "SRA 2025" },
        { dimension: "CURRENCY", code: "EUR", riskType: "TPPU", level: "MENENGAH", sourceNote: "SRA 2025" },
        { dimension: "DISTRIBUTION_CHANNEL", code: "ONLINE_MERCHANT", riskType: "TPPU", level: "TINGGI", sourceNote: "SRA 2025" },
        { dimension: "PROVINCE", code: "JAWA_BARAT", riskType: "TPPU", level: "MENENGAH", sourceNote: "SRA 2025" },
      ],
      ira_parameter_thresholds: [],
      company_profile: [{ id: 1, province: "JAWA_BARAT" }],
      customers: [
        { id: 1, customerType: "INDIVIDU", entityLegalForm: null, occupationCategory: "WIRAUSAHA", pepStatus: "NONE", nationality: "ID", isDemo: false, isHistorical: false },
        { id: 2, customerType: "INDIVIDU", entityLegalForm: null, occupationCategory: "KARYAWAN_SWASTA", pepStatus: "NONE", nationality: "ID", isDemo: false, isHistorical: false },
        { id: 3, customerType: "BADAN_USAHA", entityLegalForm: "PT", occupationCategory: null, pepStatus: "NONE", nationality: "ID", isDemo: false, isHistorical: false },
      ],
      exchange_transactions: [
        bon(1, "600000000.00", "USD", "KANTOR", "ID"),
        bon(2, "200000000.00", "USD", "ONLINE_MERCHANT", "ID"),
        bon(3, "150000000.00", "EUR", "KANTOR", "ID"),
        bon(4, "50000000.00", "SGD", "KANTOR", "ID"),
      ],
      exchange_transaction_lines: [],
      ira_assessments: [],
      ira_inherent_values: [],
      ira_kpmr_answers: [],
      ira_structural_declarations: [],
    });

    // 1. Agregat Form C1 membaca komposisi lembaganya.
    const form = await readIraDataForm(periodStart, periodEnd);
    expect(form.transactionCount).toBe(4);
    expect(form.totalRupiah).toBe("1000000000.00");
    expect(form.currencyTurnover.find((row) => row.code === "USD")?.sharePercent).toBe("80.00");
    expect(form.distributionChannels.find((row) => row.channel === "ONLINE_MERCHANT")?.sharePercent).toBe("25.00");

    // 2. Penilaian tahunan dibuat, lalu angka mesinnya dihitung dari agregat dan klasifikasi.
    const { id } = await createAssessment({ periodStart, periodEnd, trigger: "TAHUNAN", triggerReason: null }, admin);
    const machine = await readInherentMachineScores(id);
    const machineOf = (code: string) => machine.values.find((row) => row.code === code)!;

    // USD 80% berisiko tinggi → pita keempat → nilai 2. Skalanya terbalik, dan inilah buktinya.
    expect(machineOf("TPPU_1A").machineScore).toBe(2);
    expect(machineOf("TPPU_1A").basis).toMatchObject({ percent: "80.00" });
    // EUR 15% berisiko menengah → pita pertama → nilai 5.
    expect(machineOf("TPPU_1B").machineScore).toBe(5);
    // Satu dari empat bon lewat jalur berisiko tinggi = 25% → pita kedua → nilai 4.
    expect(machineOf("TPPU_2A").machineScore).toBe(4);
    // Provinsi gerai berperingkat MENENGAH → nilai 3, bukan persentase.
    expect(machineOf("TPPU_4A").machineScore).toBe(3);
    expect(machineOf("TPPU_4A").basis).toMatchObject({ province: "JAWA_BARAT", level: "MENENGAH" });

    // 3. Nilai mesin dipakai apa adanya, kecuali satu yang sengaja disimpangi beserta alasannya.
    await saveInherentValues(
      id,
      IRA_PARAMETER_CATALOGUE.map((entry) => {
        const value = machineOf(entry.code);
        if (entry.code === "TPPU_1A") {
          return { parameterCode: entry.code, machineScore: 2, appliedScore: 1, bandIndex: 5, overrideReason: "Omzet USD melonjak pada Desember dan diperkirakan berlanjut.", basis: value.basis };
        }
        return {
          parameterCode: entry.code,
          machineScore: value.machineScore,
          appliedScore: value.machineScore ?? 5,
          bandIndex: value.bandIndex,
          overrideReason: null,
          basis: value.basis,
        };
      }),
      admin,
    );

    // 4. Kesembilan parameter yang dinyatakan penilai beserta dasarnya.
    await saveStructuralDeclarations(
      id,
      IRA_PARAMETER_CATALOGUE.filter((entry) => entry.source === "NYATAKAN").map((entry) => ({
        parameterCode: entry.code,
        choiceCode: entry.bandType === "PERSENTASE_KEPEMILIKAN" ? "SELURUHNYA" : "TIDAK_ADA",
        reason: "Akta No.03 14 November 2025; tidak ada mitra maupun lini bisnis lain.",
      })),
      admin,
    );
    expect(tables.ira_structural_declarations).toHaveLength(9);

    // 5. Kuesioner KPMR dijawab, termasuk **satu N/A** untuk kegiatan transfer dana.
    await saveKpmrAnswers(
      id,
      IRA_KPMR_QUESTIONS.map((question) => ({
        questionCode: question.code,
        answered: true,
        score: question.applicableToKupvaBb ? 4 : null,
        note: null,
        documentReference: null,
      })),
      admin,
    );
    expect(tables.ira_kpmr_answers.filter((row) => row.score === null)).toHaveLength(1);

    // 6. Diajukan lalu disetujui; nilainya dibekukan beserta ambang dan klasifikasinya.
    await submitAssessment(id, admin);
    await approveAssessment(id, shareholder);

    const disetujui = await readAssessment(id);
    const beku = disetujui.assessment as unknown as Record<string, unknown>;
    expect(beku.status).toBe("DISETUJUI");
    expect(beku.kpmrPredicate).toBe("SATISFACTORY");
    expect(beku.finalValue).toBeGreaterThanOrEqual(1);
    expect(beku.finalValue).toBeLessThanOrEqual(5);
    expect((beku.frozenClassifications as unknown[]).length).toBe(4);
    expect((beku.frozenThresholds as unknown[]).length).toBe(33);
    const nilaiInherenBeku = beku.inherentScore;
    const nilaiAkhirBeku = beku.finalValue;

    // 7. **Klasifikasi diubah sesudahnya** — EUR dinaikkan menjadi TINGGI, provinsi menjadi TINGGI.
    const eur = tables.ira_risk_classifications.find((row) => row.code === "EUR")!;
    eur.level = "TINGGI";
    const provinsi = tables.ira_risk_classifications.find((row) => row.dimension === "PROVINCE")!;
    provinsi.level = "TINGGI";

    // Angka mesin yang baru memang bergeser — itu benar, karena keadaannya memang berubah.
    const machineSesudah = await readInherentMachineScores(id);
    expect(machineSesudah.values.find((row) => row.code === "TPPU_4A")!.machineScore).toBe(1);

    // Tetapi nilai yang sudah dibekukan **tidak ikut bergeser**. Inilah alasan snapshot itu ada:
    // dokumen yang sudah ditandatangani tidak boleh berubah di belakang penandatangannya.
    const dibacaUlang = await readAssessment(id);
    expect((dibacaUlang.assessment as unknown as Record<string, unknown>).inherentScore).toBe(nilaiInherenBeku);
    expect((dibacaUlang.assessment as unknown as Record<string, unknown>).finalValue).toBe(nilaiAkhirBeku);
    expect(((dibacaUlang.assessment as unknown as Record<string, unknown>).frozenClassifications as { code: string; level: string }[])
      .find((row) => row.code === "EUR")?.level).toBe("MENENGAH");

    // 8. Penilaian yang sudah disetujui menolak penyuntingan; perbaikan berarti pengganti.
    await expect(saveInherentValues(id, [{ parameterCode: "TPPU_1A", machineScore: 2, appliedScore: 2, bandIndex: null, overrideReason: null, basis: null }], admin))
      .rejects.toThrow(/terkunci/i);

    const pengganti = await createAssessment(
      { periodStart, periodEnd, trigger: "MANUAL", triggerReason: "Klasifikasi EUR dan provinsi gerai dinaikkan menjadi TINGGI." },
      admin,
    );
    const machinePengganti = await readInherentMachineScores(pengganti.id);
    await saveInherentValues(
      pengganti.id,
      IRA_PARAMETER_CATALOGUE.map((entry) => {
        const value = machinePengganti.values.find((row) => row.code === entry.code)!;
        return { parameterCode: entry.code, machineScore: value.machineScore, appliedScore: value.machineScore ?? 5, bandIndex: value.bandIndex, overrideReason: null, basis: value.basis };
      }),
      admin,
    );
    await saveKpmrAnswers(
      pengganti.id,
      IRA_KPMR_QUESTIONS.map((question) => ({ questionCode: question.code, answered: true, score: question.applicableToKupvaBb ? 4 : null, note: null, documentReference: null })),
      admin,
    );
    await submitAssessment(pengganti.id, admin);
    await approveAssessment(pengganti.id, shareholder);

    // 9. Pendahulunya ditandai digantikan — ditandai, bukan dihapus.
    const lama = tables.ira_assessments.find((row) => row.id === id)!;
    expect(lama.supersededByAssessmentId).toBe(pengganti.id);
    expect(lama.status).toBe("DISETUJUI");
    expect(tables.ira_assessments).toHaveLength(2);

    // Penilaian penggantinya menilai keadaan yang lebih berisiko, sehingga nilainya lebih rendah
    // pada skala terbalik — bukan lebih tinggi.
    const baru = tables.ira_assessments.find((row) => row.id === pengganti.id)!;
    expect(Number(baru.inherentScore)).toBeLessThan(Number(nilaiInherenBeku));
  });
});
