import { DEFAULT_OPERATIONAL_TIMEZONE, operationalDateKey } from "./regulatoryActionQueue";
import { IRA_DISTRIBUTION_CHANNELS, IRA_LEGAL_FORMS, IRA_OCCUPATION_CATEGORIES, IRA_PROVINCE_LABELS } from "./iraVocabulary";

/**
 * Tinjauan berkala klasifikasi risiko IRA — Pasal 9 ayat (6) PBI 10/2024. Satu definisi "belum
 * diklasifikasi" untuk layar dan untuk server yang menolak pengesahan selama masih ada.
 */

const RISK_TYPES = ["TPPU", "TPPT", "PPSPM"] as const;
export type ClassificationKey = { dimension: string; code: string; riskType: string };

export function unclassifiedCodes(input: { currencyCodes: string[]; countryCodes: string[]; rows: ClassificationKey[] }): ClassificationKey[] {
  const clean = (values: string[]) => Array.from(new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean)));
  const universe: { dimension: string; codes: string[] }[] = [
    { dimension: "CURRENCY", codes: clean(input.currencyCodes).filter((code) => code !== "IDR") },
    { dimension: "OCCUPATION", codes: [...IRA_OCCUPATION_CATEGORIES] },
    { dimension: "LEGAL_FORM", codes: [...IRA_LEGAL_FORMS] },
    { dimension: "COUNTRY", codes: clean(input.countryCodes) },
    { dimension: "PROVINCE", codes: Object.keys(IRA_PROVINCE_LABELS) },
    { dimension: "DISTRIBUTION_CHANNEL", codes: [...IRA_DISTRIBUTION_CHANNELS] },
  ];
  const present = new Set(input.rows.map((row) => `${row.dimension}|${row.code}|${row.riskType}`));
  return universe.flatMap(({ dimension, codes }) => codes.flatMap((code) =>
    RISK_TYPES.filter((riskType) => !present.has(`${dimension}|${code}|${riskType}`)).map((riskType) => ({ dimension, code, riskType }))));
}

/** Tambah bulan pada tanggal kalender "YYYY-MM-DD", dijepit ke akhir bulan. */
function addMonthsToDateKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function getIraClassificationReviewDue(lastReviewedAt: Date | string | null, intervalMonths: number, now = new Date(), timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE) {
  if (!lastReviewedAt) return { due: true, dueDateKey: null, detail: "Klasifikasi risiko belum pernah ditinjau dan disahkan." };
  const dueDateKey = addMonthsToDateKey(operationalDateKey(new Date(lastReviewedAt), timeZone), intervalMonths);
  const todayKey = operationalDateKey(now, timeZone);
  const due = todayKey >= dueDateKey;
  return { due, dueDateKey, detail: due ? `Tinjauan klasifikasi risiko jatuh tempo sejak ${dueDateKey}.` : `Tinjauan berikutnya ${dueDateKey}.` };
}
