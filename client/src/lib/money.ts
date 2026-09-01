function groupThousands(integer: string) {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Comma-grouped integer part ("7,500,000"), no forced/padded decimals — a whole value never shows
 * ".00", and a genuine fractional value (rare — a manual B2B deal like 149750149.68) keeps its
 * exact digits exactly as typed, nothing trimmed but trailing zeros. Works on the raw string so
 * arbitrarily large decimal(24,6) values never lose precision to float conversion.
 */
export function formatPlainAmount(value: string | number | null | undefined) {
  const str = String(value ?? "0").trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(str);
  if (!match) return str;
  const [, sign, integer, fraction = ""] = match;
  const trimmedFraction = fraction.replace(/0+$/, "");
  return `${sign}${groupThousands(integer)}${trimmedFraction ? `.${trimmedFraction}` : ""}`;
}

function toMinorUnits(value: string | number | null | undefined, scale: number) {
  const normalized = String(value ?? "0").trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return BigInt(0);
  const fraction = (match[3] ?? "").padEnd(scale, "0").slice(0, scale);
  const units = BigInt(`${match[2]}${fraction}`);
  return match[1] === "-" ? -units : units;
}

/** Comma-grouped integer part, trailing-zero cents trimmed (see formatPlainAmount above). */
function formatMinorUnitsPlain(units: bigint, scale: number) {
  const sign = units < BigInt(0) ? "-" : "";
  const raw = (units < BigInt(0) ? -units : units).toString().padStart(scale + 1, "0");
  const integer = raw.slice(0, -scale) || "0";
  const fraction = raw.slice(-scale).replace(/0+$/, "");
  return `${sign}${groupThousands(integer)}${fraction ? `.${fraction}` : ""}`;
}

export function formatIdrDecimal(value: string | number | null | undefined) {
  return `Rp ${formatPlainAmount(value)}`;
}

export function sumIdrDecimals(values: Array<string | number | null | undefined>) {
  const total = values.reduce<bigint>((sum, value) => sum + toMinorUnits(value, 2), BigInt(0));
  return `Rp ${formatMinorUnitsPlain(total, 2)}`;
}
