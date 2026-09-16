import Decimal from "decimal.js";

/**
 * Kelompok harga pecahan dalam satu valuta (mis. USD "100" · "5–20"). Aturannya murni dan berdiri di
 * `shared/` supaya server, papan kurs, dan formulir bon memakai pencocokan yang **sama persis** —
 * harga pecahan yang berbeda pendapat antara layar dan basis data adalah kekeliruan yang tidak akan
 * terlihat dari laporan mana pun.
 */
export type RateTierRow = {
  id: number;
  currencyId: number;
  label: string;
  denominationValues: string[];
  sortOrder: number;
  active: boolean;
};

/** Label baris papan untuk pecahan yang tidak masuk kelompok mana pun. */
export const OTHER_TIER_LABEL = "Pecahan lain";

/** Enam desimal, sama dengan `denominationValue` pada basis data, supaya "100" dan 100 adalah kunci yang sama. */
export function normalizeDenominationValue(value: string | number): string {
  return new Decimal(String(value)).toFixed(6);
}

export function sortTiers(tiers: readonly RateTierRow[]): RateTierRow[] {
  return [...tiers].sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "id"));
}

/** Nilai muka pertama yang dimiliki dua kelompok **aktif** sekaligus; null bila tidak ada. */
export function findTierOverlap(tiers: readonly RateTierRow[]): { value: string; labels: [string, string] } | null {
  const owner = new Map<string, string>();
  for (const tier of sortTiers(tiers)) {
    if (!tier.active) continue;
    for (const raw of new Set(tier.denominationValues)) {
      const value = normalizeDenominationValue(raw);
      const existing = owner.get(value);
      if (existing && existing !== tier.label) return { value, labels: [existing, tier.label] };
      owner.set(value, tier.label);
    }
  }
  return null;
}

/** Kelompok aktif yang memuat nilai muka ini, atau null — dan null berarti kurs tingkat valuta yang berlaku. */
export function matchTier(tiers: readonly RateTierRow[], denominationValue: string | number): RateTierRow | null {
  const value = normalizeDenominationValue(denominationValue);
  return sortTiers(tiers).find((tier) => tier.active && tier.denominationValues.some((candidate) => normalizeDenominationValue(candidate) === value)) ?? null;
}

export function tierDisplayLabel(tier: RateTierRow | null): string {
  return tier ? tier.label : OTHER_TIER_LABEL;
}
