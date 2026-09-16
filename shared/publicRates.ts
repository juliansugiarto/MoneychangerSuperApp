export type PublicRateRow = {
  rate: { id: number; buyRate: string; sellRate: string; quoteUnit: string; effectiveAt: Date };
  currency: { id: number; code: string; name: string };
  /** Kelompok pecahan yang dihargai baris ini; null berarti kurs tingkat valuta. */
  tier: { id: number; label: string } | null;
};

/** Valuta menaik menurut kode; di dalamnya kelompok lebih dahulu daripada baris tingkat valuta, sehingga "Pecahan lain" selalu menjadi baris penutup valutanya. */
export function sortPublicRates(rates: readonly PublicRateRow[]): PublicRateRow[] {
  return [...rates].sort((left, right) =>
    left.currency.code.localeCompare(right.currency.code)
    || Number(left.tier === null) - Number(right.tier === null)
    || (left.tier?.label ?? "").localeCompare(right.tier?.label ?? "", "id"));
}

export function latestPublicRateEffectiveAt(rates: readonly PublicRateRow[]): Date | null {
  if (!rates.length) return null;
  return rates.reduce<Date>((latest, item) => {
    const effectiveAt = new Date(item.rate.effectiveAt);
    return effectiveAt.getTime() > latest.getTime() ? effectiveAt : latest;
  }, new Date(rates[0].rate.effectiveAt));
}
