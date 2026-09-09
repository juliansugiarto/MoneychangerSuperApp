/**
 * Aritmetika penilaian dari baris yang tersimpan — dipakai server saat menyetujui **dan** halaman
 * kuesioner saat menampilkan hasil sementara.
 *
 * Ditaruh di `shared/` justru karena keduanya membutuhkannya: nilai yang ditampilkan di layar wajib
 * sama persis dengan nilai yang dibekukan saat disetujui, dan dua salinan rumus yang sama pasti
 * berselisih pada suatu hari — selisih yang tidak akan terlihat sampai pemeriksa membandingkan
 * layar dengan dokumennya.
 */

import Decimal from "decimal.js";
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
} from "./individualRiskAssessment";
import { IRA_KPMR_PILLARS, questionsOfPillar, type IraKpmrPillar } from "./iraKpmrCatalogue";
import { IRA_PARAMETER_CATALOGUE } from "./iraParameterCatalogue";
import type { IraParameterRiskType } from "./iraParameters";

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

