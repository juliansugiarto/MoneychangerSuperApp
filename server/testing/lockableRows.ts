/**
 * Hasil `.limit()` tiruan yang juga menerima `.for("update")`, seperti pembangun kueri Drizzle sungguhan.
 * Dipakai uji bertabel tiruan; perilaku penguncian sendiri dibuktikan oleh uji `*.live.test.ts`.
 */
export function lockableRows<T>(rows: T[]) {
  return Object.assign(Promise.resolve(rows), { for: () => Promise.resolve(rows) });
}
