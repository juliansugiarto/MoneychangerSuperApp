export function normalizeHistoricalCustomerName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildUniqueNameIndex(rows, nameKey = "full_name") {
  const index = new Map();
  for (const row of rows) {
    const normalizedName = normalizeHistoricalCustomerName(row[nameKey]);
    if (!normalizedName) continue;
    const matches = index.get(normalizedName) ?? [];
    matches.push(row);
    index.set(normalizedName, matches);
  }
  return index;
}

/**
 * Chooses an existing historical customer only when either the source key or
 * the normalized ledger name gives one unambiguous record. A caller creates a
 * fresh historical profile when `existingCustomer` is null.
 */
export function resolveHistoricalCustomer(sourceCustomer, existingBySourceKey, existingByNormalizedName) {
  const bySource = existingBySourceKey.get(sourceCustomer.source_key);
  if (bySource) return { existingCustomer: bySource, matchType: "SOURCE_KEY" };

  const matches = existingByNormalizedName.get(normalizeHistoricalCustomerName(sourceCustomer.full_name)) ?? [];
  if (matches.length === 1) return { existingCustomer: matches[0], matchType: "UNIQUE_NAME" };
  return { existingCustomer: null, matchType: matches.length ? "AMBIGUOUS_NAME" : "NEW" };
}
