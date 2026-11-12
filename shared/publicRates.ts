import Decimal from "decimal.js";
import { zoneAbbreviation } from "./openingStatus";
import { DEFAULT_OPERATIONAL_TIMEZONE } from "./regulatoryActionQueue";

export type PublicRateRow = {
  rate: { id: number; buyRate: string; sellRate: string; quoteUnit: string; effectiveAt: Date };
  currency: { id: number; code: string; name: string };
  /** Kelompok pecahan yang dihargai baris ini; null berarti kurs tingkat valuta. */
  tier: { id: number; label: string; sortOrder?: number } | null;
  /**
   * Kurs RETIRED terakhir untuk valuta + kelompok + satuan kutipan yang sama (spec teks §1 "Perubahan
   * dibanding kurs sebelumnya"). null = belum ada pembanding; jangan ditampilkan sebagai "Tetap".
   */
  previous?: { buyRate: string; sellRate: string } | null;
};

/** Valuta menaik menurut kode; di dalamnya kelompok lebih dahulu (urut `sortOrder`, lalu label) daripada baris tingkat valuta, sehingga "Pecahan lain" selalu menjadi baris penutup valutanya. */
export function sortPublicRates<T extends PublicRateRow>(rates: readonly T[]): T[] {
  return [...rates].sort((left, right) =>
    left.currency.code.localeCompare(right.currency.code)
    || Number(left.tier === null) - Number(right.tier === null)
    || (left.tier?.sortOrder ?? 0) - (right.tier?.sortOrder ?? 0)
    || (left.tier?.label ?? "").localeCompare(right.tier?.label ?? "", "id"));
}

export function latestPublicRateEffectiveAt(rates: readonly PublicRateRow[]): Date | null {
  if (!rates.length) return null;
  return rates.reduce<Date>((latest, item) => {
    const effectiveAt = new Date(item.rate.effectiveAt);
    return effectiveAt.getTime() > latest.getTime() ? effectiveAt : latest;
  }, new Date(rates[0].rate.effectiveAt));
}

/**
 * Arah dari sisi pelanggan (spec teks §1): "Anda jual" = pelanggan menyerahkan valas = kurs **beli**
 * perusahaan (`buyRate`); "Anda beli" = kurs **jual** perusahaan (`sellRate`).
 */
export type CustomerDirection = "SELL" | "BUY";
export const directionRateField = (direction: CustomerDirection) => (direction === "SELL" ? "buyRate" : "sellRate");

export type RateChange = { kind: "up" | "down" | "flat" | "none"; amount: string };

export function rateChange(row: PublicRateRow, direction: CustomerDirection): RateChange {
  const field = directionRateField(direction);
  if (!row.previous) return { kind: "none", amount: "0" };
  const delta = new Decimal(row.rate[field]).minus(row.previous[field]);
  if (delta.isZero()) return { kind: "flat", amount: "0" };
  return { kind: delta.isPositive() ? "up" : "down", amount: delta.abs().toString() };
}

const wholeFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const centsFormat = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "16310.000000" → "16.310"; "11341.3" → "11.341,30" (pecahan selalu dua angka). Kurs tidak dibulatkan seperti total. */
export function formatRupiahNumber(value: Decimal.Value): string {
  const number = new Decimal(value);
  return (number.isInteger() ? wholeFormat : centsFormat).format(number.toNumber());
}

export function formatRateRupiah(value: Decimal.Value): string {
  return `Rp ${formatRupiahNumber(value)}`;
}

/** "1.000000" → "1"; "100.000000" → "100". */
export function formatQuoteUnit(value: Decimal.Value): string {
  return new Decimal(value).toString();
}

/** Satu baris per valuta: baris pertama valuta itu dalam urutan papan (kelompok pecahan terbesar). */
function firstRowPerCurrency(rates: readonly PublicRateRow[]): PublicRateRow[] {
  const seen = new Set<number>();
  return sortPublicRates(rates).filter((row) => (seen.has(row.currency.id) ? false : (seen.add(row.currency.id), true)));
}

export const SHARE_CURRENCY_LIMIT = 4;

/**
 * Pesan "Bagikan ke WhatsApp" (spec teks §3): paling banyak 6 baris — judul, empat valuta teratas
 * urutan papan, penutup bertautan. null bila belum ada kurs (jangan menyiapkan pesan berangka kosong).
 */
export function buildRateShareText(rates: readonly PublicRateRow[], options: { tradingName: string; url: string; timeZone?: string }): string | null {
  const rows = firstRowPerCurrency(rates).slice(0, SHARE_CURRENCY_LIMIT);
  const latest = latestPublicRateEffectiveAt(rows);
  if (!latest) return null;
  const timeZone = options.timeZone ?? DEFAULT_OPERATIONAL_TIMEZONE;
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone }).format(latest);
  const clock = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(latest).replace(":", ".");
  const lines = rows.map((row) => {
    const tier = row.tier ? ` pecahan ${row.tier.label}` : "";
    return `${row.currency.code}${tier} per ${formatQuoteUnit(row.rate.quoteUnit)} ${row.currency.code}: Anda jual ${formatRateRupiah(row.rate.buyRate)}; Anda beli ${formatRateRupiah(row.rate.sellRate)}.`;
  });
  return [`Kurs ${options.tradingName}, ${date} pukul ${clock} ${zoneAbbreviation(timeZone)}`, ...lines, `Kurs perkiraan. Cek yang terbaru: ${options.url}`].join("\n");
}
