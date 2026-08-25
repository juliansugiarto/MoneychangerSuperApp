export type PublicRateRow = {
  rate: { id: number; buyRate: string; sellRate: string; quoteUnit: string; effectiveAt: Date };
  currency: { id: number; code: string; name: string };
};

/** Keeps the public rate board complete and predictably ordered without mutating query data. */
export function sortPublicRates(rates: readonly PublicRateRow[]): PublicRateRow[] {
  return [...rates].sort((left, right) => left.currency.code.localeCompare(right.currency.code));
}

export function latestPublicRateEffectiveAt(rates: readonly PublicRateRow[]): Date | null {
  if (!rates.length) return null;
  return rates.reduce<Date>((latest, item) => {
    const effectiveAt = new Date(item.rate.effectiveAt);
    return effectiveAt.getTime() > latest.getTime() ? effectiveAt : latest;
  }, new Date(rates[0].rate.effectiveAt));
}
