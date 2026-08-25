function toMinorUnits(value: string | number | null | undefined, scale: number) {
  const normalized = String(value ?? "0").trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return BigInt(0);
  const fraction = (match[3] ?? "").padEnd(scale, "0").slice(0, scale);
  const units = BigInt(`${match[2]}${fraction}`);
  return match[1] === "-" ? -units : units;
}

function formatMinorUnits(units: bigint, scale: number) {
  const sign = units < BigInt(0) ? "-" : "";
  const raw = (units < BigInt(0) ? -units : units).toString().padStart(scale + 1, "0");
  const integer = raw.slice(0, -scale).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = scale > 0 ? `,${raw.slice(-scale)}` : "";
  return `${sign}${integer}${fraction}`;
}

export function formatIdrDecimal(value: string | number | null | undefined) {
  return `Rp ${formatMinorUnits(toMinorUnits(value, 2), 2)}`;
}

export function sumIdrDecimals(values: Array<string | number | null | undefined>) {
  const total = values.reduce<bigint>((sum, value) => sum + toMinorUnits(value, 2), BigInt(0));
  return `Rp ${formatMinorUnits(total, 2)}`;
}
