import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

function positiveDecimal(value: string, label: string) {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error(`${label} harus berupa angka desimal yang valid.`);
  const decimal = new Decimal(normalized);
  if (!decimal.gt(0)) throw new Error(`${label} harus lebih besar dari nol.`);
  return decimal;
}

function nonNegativeDecimal(value: string, label: string) {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error(`${label} harus berupa angka desimal yang valid.`);
  const decimal = new Decimal(normalized);
  if (decimal.lt(0)) throw new Error(`${label} tidak boleh negatif.`);
  return decimal;
}

export function simulateExchange(input: { foreignAmount: string; rate: string; quoteUnit: string }) {
  const foreignAmount = positiveDecimal(input.foreignAmount, "Nominal valuta");
  const rate = positiveDecimal(input.rate, "Kurs");
  const quoteUnit = positiveDecimal(input.quoteUnit, "Unit kuotasi");
  const rupiahAmount = foreignAmount.mul(rate).div(quoteUnit).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return { foreignAmount: foreignAmount.toFixed(6), rate: rate.toFixed(6), quoteUnit: quoteUnit.toFixed(6), rupiahAmount: rupiahAmount.toFixed(2), isSimulation: true };
}

export function simulateClosing(input: { systemBalance: string; physicalBalance: string }) {
  const systemBalance = nonNegativeDecimal(input.systemBalance, "Saldo sistem");
  const physicalBalance = nonNegativeDecimal(input.physicalBalance, "Saldo fisik");
  const variance = physicalBalance.minus(systemBalance).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
  return { systemBalance: systemBalance.toFixed(6), physicalBalance: physicalBalance.toFixed(6), variance: variance.toFixed(6), reconciliationStatus: variance.isZero() ? "COCOK" : "PERLU_DITINJAU", isSimulation: true };
}

export function simulateRateShock(input: { referenceRate: string; proposedRate: string; reviewThresholdPercent: string }) {
  const referenceRate = positiveDecimal(input.referenceRate, "Kurs referensi");
  const proposedRate = positiveDecimal(input.proposedRate, "Kurs usulan");
  const reviewThresholdPercent = positiveDecimal(input.reviewThresholdPercent, "Ambang review");
  const differencePercent = proposedRate.minus(referenceRate).div(referenceRate).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const reviewRequired = differencePercent.abs().gte(reviewThresholdPercent);
  return {
    referenceRate: referenceRate.toFixed(6),
    proposedRate: proposedRate.toFixed(6),
    reviewThresholdPercent: reviewThresholdPercent.toFixed(2),
    differencePercent: differencePercent.toFixed(2),
    reviewRequired,
    recommendation: reviewRequired ? "PERLU_REVIEW_MANUSIA" : "DALAM_AMBANG",
    isSimulation: true,
  };
}

export function simulateArchiveReadiness(input: { closingChecklistComplete: boolean; stockOpnameReconciled: boolean }) {
  const missing: string[] = [];
  if (!input.closingChecklistComplete) missing.push("Checklist penutupan latihan");
  if (!input.stockOpnameReconciled) missing.push("Stock opname / rekonsiliasi latihan");
  return {
    closingChecklistComplete: input.closingChecklistComplete,
    stockOpnameReconciled: input.stockOpnameReconciled,
    readyToArchive: missing.length === 0,
    missing,
    isSimulation: true,
  };
}
