/**
 * Fuzzy name-matching for DTTOT/PPPSM watchlist screening. Deliberately simple and dependency-free
 * (token-level Levenshtein similarity, no external NLP/fuzzy-matching library) so the scoring logic
 * stays auditable — a compliance reviewer can be told exactly how a match score was produced.
 *
 * This is a *screening aid*, never a determination: it surfaces candidates above MATCH_THRESHOLD for
 * a human to review. It must never auto-flag a customer as a confirmed DTTOT/PPPSM match — that
 * stays a manual checkbox+notes decision (see customers.dttotPpsdmMatch), same as every other
 * regulatory judgment call in this app.
 */

export const MATCH_THRESHOLD = 0.6;

export function normalizeNameForMatching(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameTokens(name: string): string[] {
  return normalizeNameForMatching(name).split(" ").filter(Boolean);
}

/** Splits a DTTOT-style "X alias Y alias Z" name field into its constituent names. */
export function splitAliasNames(rawName: string): string[] {
  return rawName
    .split(/\balias\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previousRow = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      currentRow.push(Math.min(currentRow[j] + 1, previousRow[j + 1] + 1, previousRow[j] + cost));
    }
    previousRow = currentRow;
  }
  return previousRow[b.length];
}

function tokenSimilarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const maxLength = Math.max(a.length, b.length);
  if (!maxLength) return 1;
  return 1 - levenshteinDistance(a, b) / maxLength;
}

/**
 * Scores how well `queryName` matches `candidateName`, in [0, 1]. Greedily pairs each query token
 * with its best-remaining candidate token (each candidate token usable only once, so a single
 * common word like "MUHAMMAD" can't inflate the score against unrelated names), then divides the
 * summed pair similarities by the larger token count — a candidate with many extra/missing tokens
 * is penalized even if the tokens it does share match perfectly.
 */
export function scoreNameMatch(queryName: string, candidateName: string): number {
  const queryTokens = nameTokens(queryName);
  const candidateTokens = nameTokens(candidateName);
  if (!queryTokens.length || !candidateTokens.length) return 0;

  const remainingCandidates = [...candidateTokens];
  let totalSimilarity = 0;
  for (const queryToken of queryTokens) {
    let bestIndex = -1;
    let bestScore = -1;
    for (let i = 0; i < remainingCandidates.length; i++) {
      const score = tokenSimilarity(queryToken, remainingCandidates[i]);
      if (score > bestScore) { bestScore = score; bestIndex = i; }
    }
    if (bestIndex === -1) continue;
    totalSimilarity += bestScore;
    remainingCandidates.splice(bestIndex, 1);
  }
  return totalSimilarity / Math.max(queryTokens.length, candidateTokens.length);
}

export type NameMatchResult = { name: string; score: number };

/** Scores `queryName` against every candidate string (a full name plus its known aliases) and returns the single best match, or null if none score above 0. */
export function findBestNameMatch(queryName: string, candidateNames: string[]): NameMatchResult | null {
  let best: NameMatchResult | null = null;
  for (const candidateName of candidateNames) {
    if (!candidateName?.trim()) continue;
    const score = scoreNameMatch(queryName, candidateName);
    if (score > 0 && (!best || score > best.score)) best = { name: candidateName, score };
  }
  return best;
}

export type WatchlistNameListEntry = { name: string; note: string | null };

/**
 * Parses a pasted plain-text watchlist name list — one entry per line, optionally
 * "Nama Lengkap, catatan" (e.g. a reference/ID number copied alongside the name). Deliberately not
 * an Excel/XML parser: PPATK's SIPENDAR portal watchlist export column layout isn't documented in a
 * sample we've verified (unlike DTTOT/PPPSM, where the user supplied real files — see
 * server/sanctionsWatchlistImport.ts), so rather than guess at a schema, staff copy the names
 * straight out of whatever export PPATK gives them. The note is carried through for display only —
 * it never affects the match score.
 */
export function parseWatchlistNameList(raw: string): WatchlistNameListEntry[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, ...rest] = line.split(",");
      return { name: namePart.trim(), note: rest.join(",").trim() || null };
    })
    .filter((entry) => entry.name.length >= 2);
}
