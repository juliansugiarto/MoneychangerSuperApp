export type OperationalReadinessInput = {
  openingChecks: unknown;
  closingChecks: unknown;
  closingCompletedAt?: Date | string | null;
  cashBalanceCount: number;
  activeRateCount: number;
  referenceRateCount: number;
  pendingReviewCount: number;
  varianceCount: number;
  directorOpenCount: number;
};

const openingKeys = ["modalKerjaDiterima", "alatUvSiap", "mesinHitungSiap", "kasAwalDicatat"];
const closingKeys = ["opnameFisikDilakukan", "kasDirekonsiliasi", "uangDiserahterimakan", "brankasDikunci"];

function checks(value: unknown) { return typeof value === "object" && value !== null ? value as Record<string, boolean> : {}; }
function allComplete(value: unknown, keys: string[]) { const record = checks(value); return keys.every((key) => record[key]); }

export function calculateOperationalReadiness(input: OperationalReadinessInput) {
  const openingReady = allComplete(input.openingChecks, openingKeys);
  const closingReady = allComplete(input.closingChecks, closingKeys) && Boolean(input.closingCompletedAt);
  const cashReady = input.cashBalanceCount > 0;
  const rateReady = input.activeRateCount > 0 && input.referenceRateCount > 0;
  const pendingReviews = input.pendingReviewCount + input.varianceCount;
  const oversightReady = pendingReviews + input.directorOpenCount === 0;
  const readyCount = [rateReady, cashReady, openingReady, oversightReady, closingReady].filter(Boolean).length;
  return { openingReady, closingReady, cashReady, rateReady, pendingReviews, oversightReady, readyCount };
}
