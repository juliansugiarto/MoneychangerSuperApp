/**
 * Bentuk baris papan kurs dan aturan murni kisinya. Ditulis sekali di sini: server mengisi baris
 * ini (`server/rateBoard.ts`), klien menyunting dan menyaringnya.
 */
export type BoardCellPayload = {
  currencyId: number; currencyCode: string; currencyName: string;
  rateTierId: number | null; tierLabel: string; sortOrder: number; quoteUnit: string;
  activeRateId: number | null; activeBuyRate: string | null; activeSellRate: string | null; activeEffectiveAt: Date | null;
  draftRateId: number | null; draftBuyRate: string | null; draftSellRate: string | null;
  referenceBuyRate: string | null; referenceSellRate: string | null; referenceSnapshotId: number | null;
};
export type RateField = "buyRate" | "sellRate";
export type BoardEdits = Record<string, Partial<Record<RateField, string>>>;
export type BoardFilter = "SEMUA" | "BERUBAH" | "TANPA_KURS";

export function cellKey(cell: { currencyId: number; rateTierId: number | null }): string {
  return `${cell.currencyId}:${cell.rateTierId ?? "ALL"}`;
}

const savedValue = (cell: BoardCellPayload, field: RateField) =>
  (field === "buyRate" ? cell.draftBuyRate ?? cell.activeBuyRate : cell.draftSellRate ?? cell.activeSellRate) ?? "";

/** Suntingan di layar menang atas draf tersimpan, draf menang atas kurs aktif. Sel tanpa sumber apa pun tetap kosong — nol adalah harga, dan harga yang dikarang lebih buruk daripada sel kosong. */
export function editedValue(cell: BoardCellPayload, edits: BoardEdits, field: RateField): string {
  return edits[cellKey(cell)]?.[field] ?? savedValue(cell, field);
}

const sameNumber = (left: string, right: string) => left !== "" && right !== "" && Number(left) === Number(right);

export function cellChanged(cell: BoardCellPayload, edits: BoardEdits): boolean {
  return (["buyRate", "sellRate"] as RateField[]).some((field) => {
    const next = editedValue(cell, edits, field);
    const active = (field === "buyRate" ? cell.activeBuyRate : cell.activeSellRate) ?? "";
    if (next === "") return false;
    return !sameNumber(next, active);
  });
}

export function filterBoardCells(cells: readonly BoardCellPayload[], filter: BoardFilter, query: string, edits: BoardEdits): BoardCellPayload[] {
  const needle = query.trim().toLowerCase();
  return cells.filter((cell) => {
    if (needle && !`${cell.currencyCode} ${cell.currencyName}`.toLowerCase().includes(needle)) return false;
    if (filter === "BERUBAH") return cellChanged(cell, edits);
    if (filter === "TANPA_KURS") return cell.activeRateId === null;
    return true;
  });
}

export function pendingCells(cells: readonly BoardCellPayload[], edits: BoardEdits): BoardCellPayload[] {
  return cells.filter((cell) => cellChanged(cell, edits));
}
