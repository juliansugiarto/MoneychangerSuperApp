import Decimal from "decimal.js";
import { matchTier, type RateTierRow } from "@shared/rateTiers";
import { cellKey, type BoardCellPayload } from "@shared/rateBoard";

/**
 * Harga yang **diusulkan** ke kasir, bukan harga otoritatif: server menghitung ulang rujukannya saat
 * simpan (kurs dapat berubah di antaranya). Null berarti tidak ada kurs papan — kolomnya dibiarkan
 * kosong supaya kasir mengetiknya sendiri, persis seperti sebelum papan ada.
 */
export function suggestDenominationRate(
  board: { cells: readonly BoardCellPayload[] },
  tiers: readonly RateTierRow[],
  currencyId: number,
  operation: "BUY" | "SELL",
  denominationValue: string,
  /** Satuan harga baris bon; kurs papan per 100 unit (JPY) diubah ke satuan ini. Kosong berarti satuan papan. */
  lineQuoteUnit?: string,
): string | null {
  // Nilai muka yang masih diketik ("", "1e") belum dapat dicocokkan; jangan biarkan pencocok melempar galat.
  if (!denominationValue.trim() || !(Number(denominationValue) > 0)) return null;
  const tier = matchTier(tiers.filter((row) => row.currencyId === currencyId), denominationValue);
  const wanted = cellKey({ currencyId, rateTierId: tier?.id ?? null });
  const fallback = cellKey({ currencyId, rateTierId: null });
  const cell = board.cells.find((row) => cellKey(row) === wanted && row.activeRateId)
    ?? board.cells.find((row) => cellKey(row) === fallback && row.activeRateId);
  if (!cell) return null;
  const rate = operation === "BUY" ? cell.activeBuyRate : cell.activeSellRate;
  if (!rate || !lineQuoteUnit || !(Number(lineQuoteUnit) > 0) || new Decimal(lineQuoteUnit).eq(cell.quoteUnit)) return rate;
  return new Decimal(rate).times(lineQuoteUnit).div(cell.quoteUnit).toFixed(6);
}
