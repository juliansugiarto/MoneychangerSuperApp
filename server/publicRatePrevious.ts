import { sql, type SQL } from "drizzle-orm";
import Decimal from "decimal.js";

/**
 * Pembanding "Naik / Turun / Tetap" di halaman publik: kurs RETIRED terakhir untuk valuta + kelompok
 * pecahan yang sama (rencana bangun 2026-11-12 irisan 2). Satuan kutipan harus sama; bila staf
 * mengganti satuan (mis. JPY per 1 → per 100), selisihnya tidak bermakna dan dianggap belum ada
 * pembanding. Kurs demo/historis tidak pernah menjadi pembanding.
 */
export type PreviousRate = { currencyId: number; rateTierId: number | null; quoteUnit: string; buyRate: string; sellRate: string };

const keyOf = (currencyId: number, rateTierId: number | null) => `${currencyId}:${rateTierId ?? "ALL"}`;

/** Satu baris per pasangan valuta + kelompok: RETIRED terbaru menurut `effectiveAt`, lalu `id`. */
export async function readPreviousRetiredRates(db: { execute(query: SQL): Promise<unknown> }, currencyIds: number[]): Promise<PreviousRate[]> {
  if (!currencyIds.length) return [];
  const result = await db.execute(sql`
    SELECT currencyId, rateTierId, quoteUnit, buyRate, sellRate FROM (
      SELECT currencyId, rateTierId, quoteUnit, buyRate, sellRate,
        ROW_NUMBER() OVER (PARTITION BY currencyId, COALESCE(rateTierId, 0) ORDER BY effectiveAt DESC, id DESC) AS position
      FROM operational_rates
      WHERE status = 'RETIRED' AND isDemo = false AND isHistorical = false
        AND currencyId IN (${sql.join(currencyIds.map((id) => sql`${id}`), sql`, `)})
    ) ranked WHERE position = 1`);
  const rows = (result as unknown as [Array<{ currencyId: number; rateTierId: number | null; quoteUnit: string; buyRate: string; sellRate: string }>])[0];
  return rows.map((row) => ({ currencyId: Number(row.currencyId), rateTierId: row.rateTierId === null ? null : Number(row.rateTierId), quoteUnit: String(row.quoteUnit), buyRate: String(row.buyRate), sellRate: String(row.sellRate) }));
}

export function previousFor(previous: readonly PreviousRate[], rate: { currencyId: number; rateTierId: number | null; quoteUnit: string }): { buyRate: string; sellRate: string } | null {
  const match = previous.find((row) => keyOf(row.currencyId, row.rateTierId) === keyOf(rate.currencyId, rate.rateTierId));
  if (!match || !new Decimal(match.quoteUnit).equals(rate.quoteUnit)) return null;
  return { buyRate: match.buyRate, sellRate: match.sellRate };
}
