/**
 * Real circulating banknote (and major coin) face values per currency, used to validate every
 * denomination row a teller enters — so a typo like "IDR 131250000 × 1 lembar" (not a real banknote)
 * is rejected instead of quietly corrupting the stock count. Descending order (largest note first).
 *
 * Only currencies actually likely to be traded at this business are curated here. A currency not in
 * this map has no known denomination list — the picker falls back to free text with a visible warning
 * instead of silently accepting anything, since we'd rather be honest about the gap than guess wrong.
 */
export const CURRENCY_DENOMINATIONS: Record<string, number[]> = {
  IDR: [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100],
  USD: [100, 50, 20, 10, 5, 2, 1],
  EUR: [200, 100, 50, 20, 10, 5],
  GBP: [50, 20, 10, 5],
  JPY: [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1],
  AUD: [100, 50, 20, 10, 5],
  NZD: [100, 50, 20, 10, 5],
  CAD: [100, 50, 20, 10, 5],
  CHF: [1000, 200, 100, 50, 20, 10],
  SGD: [1000, 100, 50, 10, 5, 2],
  MYR: [100, 50, 20, 10, 5, 1],
  THB: [1000, 500, 100, 50, 20],
  HKD: [1000, 500, 100, 50, 20, 10],
  CNY: [100, 50, 20, 10, 5, 1],
  KRW: [50000, 10000, 5000, 1000],
  TWD: [2000, 1000, 500, 200, 100],
  INR: [500, 200, 100, 50, 20, 10],
  PHP: [1000, 500, 200, 100, 50, 20],
  VND: [500000, 200000, 100000, 50000, 20000, 10000],
  AED: [1000, 500, 200, 100, 50, 20, 10, 5],
  SAR: [500, 100, 50, 20, 10, 5, 1],
  QAR: [500, 100, 50, 10, 5, 1],
  KWD: [20, 10, 5, 1],
  BHD: [20, 10, 5, 1],
  OMR: [50, 20, 10, 5, 1],
  JOD: [50, 20, 10, 5, 1],
  BND: [100, 50, 10, 5, 1],
  MOP: [1000, 500, 100, 50, 20, 10],
  EGP: [200, 100, 50, 20, 10, 5],
  TRY: [200, 100, 50, 20, 10, 5],
  ZAR: [200, 100, 50, 20, 10],
};

export function knownDenominationsFor(currencyCode: string | undefined): number[] | null {
  if (!currencyCode) return null;
  return CURRENCY_DENOMINATIONS[currencyCode.toUpperCase()] ?? null;
}
