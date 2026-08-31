/**
 * Plain, no-separator number display: whole values show as bare integers ("7500000", not
 * "7,500,000" or "7.500.000" — the "." locale grouping reads as a decimal point to most tellers
 * here and isn't how amounts are written in practice). Genuine fractional values (rare — a manual
 * B2B deal like 149750149.68) keep their exact decimals; nothing is ever padded with trailing
 * zeros. Works on the raw string so arbitrarily large decimal(24,6) values never lose precision
 * to float conversion.
 */
export function formatPlainAmount(value: string | number | null | undefined) {
  const str = String(value ?? "0").trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(str);
  if (!match) return str;
  const [, sign, integer, fraction = ""] = match;
  const trimmedFraction = fraction.replace(/0+$/, "");
  return `${sign}${integer}${trimmedFraction ? `.${trimmedFraction}` : ""}`;
}

function toMinorUnits(value: string | number | null | undefined, scale: number) {
  const normalized = String(value ?? "0").trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return BigInt(0);
  const fraction = (match[3] ?? "").padEnd(scale, "0").slice(0, scale);
  const units = BigInt(`${match[2]}${fraction}`);
  return match[1] === "-" ? -units : units;
}

/** No thousands separator, trailing-zero cents trimmed (see formatPlainAmount above). */
function formatMinorUnitsPlain(units: bigint, scale: number) {
  const sign = units < BigInt(0) ? "-" : "";
  const raw = (units < BigInt(0) ? -units : units).toString().padStart(scale + 1, "0");
  const integer = raw.slice(0, -scale) || "0";
  const fraction = raw.slice(-scale).replace(/0+$/, "");
  return `${sign}${integer}${fraction ? `.${fraction}` : ""}`;
}

export function formatIdrDecimal(value: string | number | null | undefined) {
  return `Rp ${formatPlainAmount(value)}`;
}

export function sumIdrDecimals(values: Array<string | number | null | undefined>) {
  const total = values.reduce<bigint>((sum, value) => sum + toMinorUnits(value, 2), BigInt(0));
  return `Rp ${formatMinorUnitsPlain(total, 2)}`;
}
