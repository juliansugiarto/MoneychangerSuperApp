/**
 * Penulis penilaian risiko IRA: membuat, mengisi, mengajukan, menyetujui, dan menggantikan.
 *
 * Empat keputusan pengguna 9 September 2026 hidup di berkas ini:
 *
 * 1. **Siklus tahunan ditambah pemicu manual** beserta alasan tertulis.
 * 2. **ADMIN mengisi, SHAREHOLDER menyetujui.** Yang sudah disetujui **terkunci**; perbaikan berarti
 *    penilaian baru yang menggantikannya, bukan suntingan di tempat.
 * 3. **IRA tidak pernah menulis ke `customers`** — tidak otomatis, dan tidak sebagai usulan.
 * 4. **Nilai dibekukan sebagai snapshot saat disetujui**: nilai tiap parameter, ambang yang berlaku,
 *    dan klasifikasi yang dipakai.
 *
 * Pembacaannya **tidak pernah menghitung ulang** penilaian yang sudah disetujui. Menghitung ulang
 * saat membaca adalah kekeliruan yang tidak terlihat sampai seseorang mengubah klasifikasi dan
 * dokumen yang sudah ditandatangani ikut berubah di belakangnya.
 */

import Decimal from "decimal.js";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  iraAssessments,
  iraInherentValues,
  iraKpmrAnswers,
  iraRiskClassifications,
  iraStructuralDeclarations,
  type IraAssessment,
  type IraAssessmentStatus,
  type IraAssessmentTrigger,
} from "../drizzle/schema";
import { isRoleAllowed, type BackOfficeRole } from "../shared/backOfficeNavigation";
import {
  finalAssessmentValue,
  inherentTotalScore,
  kpmrPillarAverage,
  kpmrPredicate,
  kpmrScore,
  riskPredicate,
  weightedGroupScore,
  type IraInherentPredicate,
  type IraKpmrPredicate,
} from "../shared/individualRiskAssessment";
import { IRA_KPMR_PILLARS, IRA_KPMR_QUESTIONS, questionsOfPillar, type IraKpmrPillar } from "../shared/iraKpmrCatalogue";
import { IRA_PARAMETER_CATALOGUE, catalogueEntry } from "../shared/iraParameterCatalogue";
import type { IraParameterRiskType } from "../shared/iraParameters";
import { readIraDataForm } from "./iraDataForm";
import { scoreInherentParameters, type InherentParameterValue } from "./iraInherentScoring";
import { listClassifications, listParameterThresholds, readClassifications } from "./iraRiskClassification";
import { databaseOrThrow, getCompanyProfile, writeAudit } from "./operations";
import type { IraProvince } from "../shared/iraVocabulary";

export type AssessmentActor = { id: number };
type GateUser = { role: string; mustChangePassword: boolean };
type Denial = { status: 403; message: string } | null;

/**
 * Gerbang pengisian. Terpisah dari handler dengan sengaja, meniru `iraClassificationDenial`.
 *
 * Statusnya ikut menjadi masukan: **penilaian yang sudah disetujui menolak siapa pun**, termasuk
 * SHAREHOLDER yang menyetujuinya. Itulah bentuk penguncian yang dijanjikan keputusan 2 — tanpa ini,
 * angka yang sudah ditandatangani dapat berubah tanpa jejak penggantian.
 */
export function iraEditDenial(user: GateUser, status: IraAssessmentStatus | null): Denial {
  if (user.mustChangePassword) {
    return { status: 403, message: "Ganti kata sandi terlebih dahulu sebelum mengisi penilaian risiko." };
  }
  if (!isRoleAllowed(user.role as BackOfficeRole, "ADMIN")) {
    return { status: 403, message: "Hanya Admin ke atas yang dapat mengisi penilaian risiko." };
  }
  if (status === "DISETUJUI") {
    return {
      status: 403,
      message: "Penilaian yang sudah disetujui terkunci. Buat penilaian baru yang menggantikannya bila ada perbaikan.",
    };
  }
  return null;
}

/** Gerbang persetujuan. **Hanya SHAREHOLDER** — Controller sekalipun tidak. */
export function iraApprovalDenial(user: GateUser): Denial {
  if (user.mustChangePassword) {
    return { status: 403, message: "Ganti kata sandi terlebih dahulu sebelum menyetujui penilaian risiko." };
  }
  if (!isRoleAllowed(user.role as BackOfficeRole, "SHAREHOLDER")) {
    return { status: 403, message: "Hanya Pemegang Saham yang dapat menyetujui penilaian risiko." };
  }
  return null;
}

export type InherentValueInput = {
  parameterCode: string;
  machineScore: number | null;
  appliedScore: number;
  bandIndex: number | null;
  overrideReason: string | null;
  basis: unknown;
};

export type KpmrAnswerInput = {
  questionCode: string;
  answered: boolean;
  /** 1-5, atau `null` untuk N/A. */
  score: number | null;
  note: string | null;
  documentReference: string | null;
};

export type AssessmentTotals = {
  inherentScore: string;
  inherentPredicate: IraInherentPredicate;
  kpmrScore: string;
  kpmrPredicate: IraKpmrPredicate;
  finalValue: number;
  finalPredicate: IraInherentPredicate;
  groupScores: { riskType: IraParameterRiskType; group: string; score: string }[];
  pillarAverages: { pillar: IraKpmrPillar; average: string | null }[];
};

/**
 * Menghitung nilai penilaian dari baris yang tersimpan. **Murni** — tanpa basis data dan tanpa jam.
 *
 * Parameter yang belum bernilai dan pertanyaan yang belum dijawab **dilempar**, tidak dianggap nol
 * maupun dilewati: penilaian setengah jadi yang tetap menghasilkan angka adalah dokumen yang tampak
 * lengkap padahal separuhnya karangan.
 */
export function computeAssessmentTotals(values: InherentValueInput[], answers: KpmrAnswerInput[]): AssessmentTotals {
  const byCode = new Map(values.map((row) => [row.parameterCode, row]));
  const groupScores: AssessmentTotals["groupScores"] = [];
  const perRiskType = new Map<IraParameterRiskType, Decimal[]>();

  const groups = new Map<string, { riskType: IraParameterRiskType; group: string; groupWeight: string }>();
  for (const entry of IRA_PARAMETER_CATALOGUE) {
    groups.set(`${entry.riskType}/${entry.group}`, { riskType: entry.riskType, group: entry.group, groupWeight: entry.groupWeight });
  }

  for (const { riskType, group, groupWeight } of groups.values()) {
    const members = IRA_PARAMETER_CATALOGUE.filter((entry) => entry.riskType === riskType && entry.group === group);
    const parameters = members.map((entry) => {
      const row = byCode.get(entry.code);
      if (!row || row.appliedScore === null || row.appliedScore === undefined) {
        throw new Error(`Parameter ${entry.code} belum bernilai; penilaian belum dapat dihitung.`);
      }
      return { weight: entry.parameterWeight, score: row.appliedScore };
    });
    const score = weightedGroupScore(groupWeight, parameters);
    groupScores.push({ riskType, group, score: score.toString() });
    perRiskType.set(riskType, [...(perRiskType.get(riskType) ?? []), score]);
  }

  const inherent = inherentTotalScore(Object.fromEntries([...perRiskType].map(([riskType, scores]) => [riskType, scores])) as never);

  const byQuestion = new Map(answers.map((row) => [row.questionCode, row]));
  const pillarAverages = IRA_KPMR_PILLARS.map((pillar) => {
    const jawaban = questionsOfPillar(pillar).map((question) => {
      const row = byQuestion.get(question.code);
      if (!row || !row.answered) throw new Error(`Pertanyaan ${question.code} belum dijawab; penilaian belum dapat dihitung.`);
      return row.score;
    });
    const average = kpmrPillarAverage(jawaban);
    return { pillar, average: average ? average.toString() : null };
  });

  const kpmr = kpmrScore(
    pillarAverages.map((row) => (row.average === null ? null : new Decimal(row.average))),
  );
  if (!kpmr) throw new Error("Seluruh pertanyaan KPMR bernilai N/A; nilai KPMR tidak dapat dihitung.");

  const inherentPredicate = riskPredicate(inherent);
  const kpmrPredicateValue = kpmrPredicate(kpmr);
  const finalValue = finalAssessmentValue(inherentPredicate, kpmrPredicateValue);

  return {
    inherentScore: inherent.toString(),
    inherentPredicate,
    kpmrScore: kpmr.toString(),
    kpmrPredicate: kpmrPredicateValue,
    finalValue,
    finalPredicate: riskPredicate(finalValue),
    groupScores,
    pillarAverages,
  };
}

async function assessmentOrThrow(assessmentId: number): Promise<IraAssessment> {
  const db = await databaseOrThrow();
  const [row] = await db.select().from(iraAssessments).where(eq(iraAssessments.id, assessmentId)).limit(1);
  if (!row) throw new Error(`Penilaian ${assessmentId} tidak ditemukan.`);
  return row as IraAssessment;
}

/** Terkunci sesudah disetujui — ditegakkan di penulis, bukan hanya di gerbang peran. */
function assertEditable(assessment: IraAssessment) {
  if (assessment.status === "DISETUJUI") {
    throw new Error("Penilaian yang sudah disetujui terkunci; buat penilaian baru yang menggantikannya.");
  }
}

export type CreateAssessmentInput = {
  periodStart: Date;
  periodEnd: Date;
  trigger: IraAssessmentTrigger;
  triggerReason: string | null;
};

/**
 * Membuat penilaian baru untuk satu periode.
 *
 * Penilaian **kedua** pada periode yang sama hanya boleh dibuat sebagai pemicu `MANUAL` beserta
 * alasannya: penilaian ulang tanpa alasan tertulis tidak dapat dijelaskan kepada pemeriksa yang
 * menemukan dua dokumen berbeda untuk tahun yang sama.
 */
export async function createAssessment(input: CreateAssessmentInput, actor: AssessmentActor): Promise<{ id: number }> {
  const reason = input.triggerReason?.trim() || null;
  if (input.trigger === "MANUAL" && !reason) {
    throw new Error("Penilaian dengan pemicu manual wajib menyebutkan alasannya.");
  }
  if (input.periodEnd.getTime() <= input.periodStart.getTime()) {
    throw new Error("Akhir periode harus sesudah awal periode.");
  }

  const db = await databaseOrThrow();
  const existing = await db
    .select({ id: iraAssessments.id, status: iraAssessments.status })
    .from(iraAssessments)
    .where(and(eq(iraAssessments.periodStart, input.periodStart), eq(iraAssessments.periodEnd, input.periodEnd)));

  if (existing.length > 0 && !(input.trigger === "MANUAL" && reason)) {
    throw new Error("Periode ini sudah punya penilaian. Penilaian ulang harus bertanda pemicu manual beserta alasannya.");
  }

  const [inserted] = await db
    .insert(iraAssessments)
    .values({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      trigger: input.trigger,
      triggerReason: reason,
      status: "DRAFT",
      createdByUserId: actor.id,
    })
    .$returningId();

  await writeAudit({
    actorUserId: actor.id,
    action: "IRA_ASSESSMENT_CREATED",
    entityType: "ira_assessment",
    entityId: String(inserted.id),
    beforeState: null,
    afterState: { periodStart: input.periodStart, periodEnd: input.periodEnd, trigger: input.trigger, triggerReason: reason },
  });

  return { id: inserted.id };
}

/**
 * Menyimpan nilai parameter risiko inheren.
 *
 * Nilai yang **menyimpang dari angka mesin wajib beralasan** (spec Rancangan 9): penilai boleh
 * tidak setuju dengan hitungan, tetapi ketidaksetujuan yang tidak tertulis tidak dapat dibedakan
 * dari salah ketik.
 */
export async function saveInherentValues(assessmentId: number, values: InherentValueInput[], actor: AssessmentActor) {
  const assessment = await assessmentOrThrow(assessmentId);
  assertEditable(assessment);

  for (const row of values) {
    catalogueEntry(row.parameterCode);
    if (!Number.isInteger(row.appliedScore) || row.appliedScore < 1 || row.appliedScore > 5) {
      throw new Error(`Nilai parameter ${row.parameterCode} harus 1 sampai 5.`);
    }
    if (row.machineScore !== null && row.machineScore !== row.appliedScore && !row.overrideReason?.trim()) {
      throw new Error(`Parameter ${row.parameterCode} menyimpang dari angka mesin dan wajib menyebutkan alasannya.`);
    }
  }

  const db = await databaseOrThrow();
  for (const row of values) {
    const record = {
      assessmentId,
      parameterCode: row.parameterCode,
      machineScore: row.machineScore,
      appliedScore: row.appliedScore,
      bandIndex: row.bandIndex,
      overrideReason: row.overrideReason?.trim() || null,
      basis: row.basis ?? null,
    };
    await db.insert(iraInherentValues).values(record).onDuplicateKeyUpdate({
      set: {
        machineScore: record.machineScore,
        appliedScore: record.appliedScore,
        bandIndex: record.bandIndex,
        overrideReason: record.overrideReason,
        basis: record.basis,
      },
    });
  }
}

/** Menyimpan jawaban kuesioner KPMR. N/A adalah jawaban, bukan ketiadaan jawaban. */
export async function saveKpmrAnswers(assessmentId: number, answers: KpmrAnswerInput[], actor: AssessmentActor) {
  const assessment = await assessmentOrThrow(assessmentId);
  assertEditable(assessment);

  const codes = new Set(IRA_KPMR_QUESTIONS.map((question) => question.code));
  for (const row of answers) {
    if (!codes.has(row.questionCode)) throw new Error(`Pertanyaan KPMR tidak dikenal: ${row.questionCode}`);
    if (row.score !== null && (!Number.isInteger(row.score) || row.score < 1 || row.score > 5)) {
      throw new Error(`Jawaban ${row.questionCode} harus 1 sampai 5 atau N/A.`);
    }
  }

  const db = await databaseOrThrow();
  for (const row of answers) {
    const record = {
      assessmentId,
      questionCode: row.questionCode,
      answered: row.answered,
      score: row.score,
      note: row.note?.trim() || null,
      documentReference: row.documentReference?.trim() || null,
      answeredByUserId: actor.id,
    };
    await db.insert(iraKpmrAnswers).values(record).onDuplicateKeyUpdate({
      set: {
        answered: record.answered,
        score: record.score,
        note: record.note,
        documentReference: record.documentReference,
        answeredByUserId: record.answeredByUserId,
      },
    });
  }
}

/** Menyimpan pernyataan penilai atas kesembilan parameter `NYATAKAN`. Alasan wajib. */
export async function saveStructuralDeclarations(
  assessmentId: number,
  declarations: { parameterCode: string; choiceCode: string; reason: string }[],
  actor: AssessmentActor,
) {
  const assessment = await assessmentOrThrow(assessmentId);
  assertEditable(assessment);

  for (const row of declarations) {
    const entry = catalogueEntry(row.parameterCode);
    if (entry.source !== "NYATAKAN") throw new Error(`Parameter ${row.parameterCode} dihitung dari data, bukan dinyatakan.`);
    if (!row.reason.trim()) throw new Error(`Pernyataan ${row.parameterCode} wajib menyebutkan dasarnya.`);
  }

  const db = await databaseOrThrow();
  for (const row of declarations) {
    const record = {
      assessmentId,
      parameterCode: row.parameterCode,
      choiceCode: row.choiceCode,
      reason: row.reason.trim(),
      declaredByUserId: actor.id,
    };
    await db.insert(iraStructuralDeclarations).values(record).onDuplicateKeyUpdate({
      set: { choiceCode: record.choiceCode, reason: record.reason, declaredByUserId: record.declaredByUserId },
    });
  }
}

/** Mengajukan penilaian untuk disetujui. */
export async function submitAssessment(assessmentId: number, actor: AssessmentActor) {
  const assessment = await assessmentOrThrow(assessmentId);
  assertEditable(assessment);

  const db = await databaseOrThrow();
  await db
    .update(iraAssessments)
    .set({ status: "MENUNGGU_PERSETUJUAN", submittedByUserId: actor.id, submittedAt: new Date() })
    .where(eq(iraAssessments.id, assessmentId));

  await writeAudit({
    actorUserId: actor.id,
    action: "IRA_ASSESSMENT_SUBMITTED",
    entityType: "ira_assessment",
    entityId: String(assessmentId),
    beforeState: { status: assessment.status },
    afterState: { status: "MENUNGGU_PERSETUJUAN" },
  });
}

async function readValues(assessmentId: number) {
  const db = await databaseOrThrow();
  const [values, answers, declarations] = await Promise.all([
    db.select().from(iraInherentValues).where(eq(iraInherentValues.assessmentId, assessmentId)),
    db.select().from(iraKpmrAnswers).where(eq(iraKpmrAnswers.assessmentId, assessmentId)),
    db.select().from(iraStructuralDeclarations).where(eq(iraStructuralDeclarations.assessmentId, assessmentId)),
  ]);
  return {
    values: values as unknown as InherentValueInput[],
    answers: answers as unknown as KpmrAnswerInput[],
    declarations: declarations as unknown as { parameterCode: string; choiceCode: string; reason: string }[],
  };
}

/**
 * Menyetujui penilaian dan **membekukan** nilainya.
 *
 * Yang dibekukan bukan hanya angka akhirnya melainkan juga ambang yang berlaku dan klasifikasi yang
 * dipakai. Tanpa keduanya angka lama dapat disalin tetapi tidak dapat ditelusuri ulang, dan
 * pemeriksa yang menanyakan "mengapa USD dinilai begitu tahun lalu" tidak dapat dijawab.
 *
 * Penilaian sebelumnya untuk periode yang sama ditandai **digantikan**, bukan dihapus.
 */
export async function approveAssessment(assessmentId: number, actor: AssessmentActor) {
  const assessment = await assessmentOrThrow(assessmentId);
  if (assessment.status !== "MENUNGGU_PERSETUJUAN") {
    throw new Error("Hanya penilaian yang sudah diajukan yang dapat disetujui.");
  }

  const { values, answers } = await readValues(assessmentId);
  const totals = computeAssessmentTotals(values, answers);
  const [thresholds, classifications] = await Promise.all([listParameterThresholds(), listClassifications()]);

  const db = await databaseOrThrow();
  await db
    .update(iraAssessments)
    .set({
      status: "DISETUJUI",
      approvedByUserId: actor.id,
      approvedAt: new Date(),
      inherentScore: totals.inherentScore,
      inherentPredicate: totals.inherentPredicate,
      kpmrScore: totals.kpmrScore,
      kpmrPredicate: totals.kpmrPredicate,
      finalValue: totals.finalValue,
      finalPredicate: totals.finalPredicate,
      frozenThresholds: thresholds,
      frozenClassifications: classifications,
    })
    .where(eq(iraAssessments.id, assessmentId));

  // Penilaian lain pada periode yang sama menjadi pendahulu — ditandai, bukan dihapus: dokumen yang
  // pernah ditandatangani tetap harus dapat dibuka beserta alasan penggantiannya.
  const predecessors = await db
    .select({ id: iraAssessments.id })
    .from(iraAssessments)
    .where(and(
      eq(iraAssessments.periodStart, assessment.periodStart),
      eq(iraAssessments.periodEnd, assessment.periodEnd),
      isNull(iraAssessments.supersededByAssessmentId),
    ));

  for (const row of predecessors) {
    if (row.id === assessmentId) continue;
    await db.update(iraAssessments).set({ supersededByAssessmentId: assessmentId }).where(eq(iraAssessments.id, row.id));
  }

  await writeAudit({
    actorUserId: actor.id,
    action: "IRA_ASSESSMENT_APPROVED",
    entityType: "ira_assessment",
    entityId: String(assessmentId),
    beforeState: { status: assessment.status },
    afterState: {
      status: "DISETUJUI",
      inherentScore: totals.inherentScore,
      kpmrScore: totals.kpmrScore,
      finalValue: totals.finalValue,
      finalPredicate: totals.finalPredicate,
      supersedes: predecessors.filter((row) => row.id !== assessmentId).map((row) => row.id),
    },
  });
}

/**
 * Membaca satu penilaian beserta barisnya.
 *
 * **Tidak menghitung ulang.** Penilaian yang sudah disetujui mengembalikan angka yang tersimpan apa
 * adanya, meski klasifikasi maupun ambangnya sudah berubah sesudahnya.
 */
export async function readAssessment(assessmentId: number) {
  const assessment = await assessmentOrThrow(assessmentId);
  const { values, answers, declarations } = await readValues(assessmentId);
  return { assessment, values, answers, declarations };
}

/**
 * Nilai mesin ke-24 parameter terhitung untuk periode sebuah penilaian, beserta agregat Form C1
 * yang membentuknya.
 *
 * Inilah satu-satunya pemanggil `scoreInherentParameters`, dan itu disengaja: penghitungnya murni,
 * dan seluruh pembacaan basis datanya berkumpul di sini — agregat, klasifikasi, ambang, dan
 * provinsi gerai.
 *
 * Ambang yang dipakai adalah yang **tersimpan**; parameter yang belum pernah disunting memakai
 * bawaan jenis pitanya di dalam penghitung, bukan di sini.
 */
export async function readInherentMachineScores(assessmentId: number): Promise<{
  form: Awaited<ReturnType<typeof readIraDataForm>>;
  province: IraProvince | null;
  values: InherentParameterValue[];
}> {
  const assessment = await assessmentOrThrow(assessmentId);
  const [form, levels, thresholds, profile] = await Promise.all([
    readIraDataForm(assessment.periodStart, assessment.periodEnd),
    readClassifications(),
    listParameterThresholds(),
    getCompanyProfile(),
  ]);

  const stored = new Map(
    thresholds
      .filter((row) => !row.isTemplateDefault && row.upperBoundPercent)
      .map((row) => [row.parameterCode, row.upperBoundPercent as (string | null)[]]),
  );
  const province = (profile?.province ?? null) as IraProvince | null;

  return { form, province, values: scoreInherentParameters({ form, levels, province, thresholds: stored }) };
}

/** Daftar penilaian, terbaru lebih dulu. */
export async function listAssessments() {
  const db = await databaseOrThrow();
  return db.select().from(iraAssessments).orderBy(asc(iraAssessments.periodStart));
}

/** Peringkat klasifikasi hidup, dipakai halaman penilaian sebelum disetujui. */
export { listClassifications, listParameterThresholds };
