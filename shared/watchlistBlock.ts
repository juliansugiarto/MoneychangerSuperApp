/**
 * Aturan pemblokiran atas kecocokan DTTOT/DPPSPM — Pasal 47 ayat (1) huruf d PBI 10/2024.
 *
 * Tinggal di `shared/` karena server (penulis blokir, gerbang bon) dan layar Register Pemblokiran
 * wajib sepakat tentang kapan blokir terbuka dan apa yang menahan bon.
 */

/** "Tanpa pemberitahuan": kasir tidak diberi alasan yang dapat terucap kepada nasabah. */
export const WATCHLIST_BLOCK_TELLER_MESSAGE = "Transaksi tidak dapat diproses. Hubungi Controller. Jangan sampaikan alasannya kepada nasabah.";

export type WatchlistBlockStatus = "OPEN" | "CONFIRMED" | "FALSE_POSITIVE" | "DICABUT";
export type BlockLite = { status: WatchlistBlockStatus; matchKeys: string | null };

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();

/** Kunci kecocokan yang bertahan melewati impor ulang — id entri tidak. */
export function matchKeyOf(match: { listType: string; referenceCode: string | null; fullName: string }): string {
  const reference = match.referenceCode?.trim();
  return `${match.listType}:${reference ? reference : normalizeName(match.fullName)}`;
}

export function parseMatchKeys(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function hasActiveBlock(existing: BlockLite[]): boolean {
  return existing.some((block) => block.status === "OPEN" || block.status === "CONFIRMED");
}

/**
 * Apakah penyaringan dengan kunci `newKeys` membuka blokir baru. Penyaringan nihil tidak pernah
 * membuka (dan tidak pernah menutup) apa pun; blokir yang masih menahan tidak digandakan; kunci yang
 * sudah diputuskan salah sasaran tidak membuka ulang.
 */
export function shouldOpenScreeningBlock(existing: BlockLite[], newKeys: string[]): boolean {
  if (!newKeys.length) return false;
  if (hasActiveBlock(existing)) return false;
  const cleared = new Set(existing.filter((block) => block.status === "FALSE_POSITIVE").flatMap((block) => parseMatchKeys(block.matchKeys)));
  return newKeys.some((key) => !cleared.has(key));
}

export type AttemptLineSummary = { currencyId: number; currencyCode: string | null; foreignAmount: string; idrAmount: string };

const toCents = (value: number) => (Number.isFinite(value) ? Math.round(value * 100) : 0);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

/**
 * Ringkasan percobaan dari masukan bon apa adanya. Baris cacat tetap tercatat dengan nol — gagal
 * mencatat percobaan karena masukannya cacat berarti justru percobaan itulah yang hilang.
 */
export function summarizeAttemptLines(
  lines: { currencyId: number; quoteUnit?: string; denominations: { value: string; quantity: number; rate: string }[] }[],
  codeById: Map<number, string>,
): { lines: AttemptLineSummary[]; totalIdr: string } {
  let totalCents = 0;
  const summaries = lines.map((line) => {
    let foreignCents = 0;
    let idrCents = 0;
    // Sama dengan `calculateRupiahAmount`: kurs dikutip per `quoteUnit` satuan (mis. JPY per 100).
    const quoteUnit = Number(line.quoteUnit ?? "1");
    const unit = Number.isFinite(quoteUnit) && quoteUnit > 0 ? quoteUnit : 1;
    for (const denomination of line.denominations ?? []) {
      const foreign = Number(denomination.value) * Number(denomination.quantity);
      foreignCents += toCents(foreign);
      idrCents += toCents((foreign * Number(denomination.rate)) / unit);
    }
    totalCents += idrCents;
    return { currencyId: line.currencyId, currencyCode: codeById.get(line.currencyId) ?? null, foreignAmount: fromCents(foreignCents), idrAmount: fromCents(idrCents) };
  });
  return { lines: summaries, totalIdr: fromCents(totalCents) };
}
