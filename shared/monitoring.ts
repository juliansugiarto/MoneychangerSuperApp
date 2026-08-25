export type MonitoringDirection = "ALL" | "BUY" | "SELL";

export type MonitoringRecord = {
  transaction: {
    id: number;
    operation: "BUY" | "SELL";
    status: string;
    requiresReview: boolean;
    transactionAt: Date | string | number;
    rupiahAmount: string | number | null;
  };
  customer: { id: number; fullName: string };
  currency: { code: string };
};

export type MonitoringSummary = {
  records: MonitoringRecord[];
  transactionCount: number;
  buyCount: number;
  sellCount: number;
  uniqueCustomerCount: number;
  requiresReviewCount: number;
  pendingReviewCount: number;
  reviewRatePct: number;
  totalValueMinor: bigint;
  buyValueMinor: bigint;
  sellValueMinor: bigint;
  daily: Array<{ day: string; count: number; totalMinor: bigint; buyMinor: bigint; sellMinor: bigint }>;
  currencies: Array<{ code: string; count: number; valueMinor: bigint }>;
};

function decimalToMinor(value: string | number | null | undefined, scale = 2) {
  const normalized = String(value ?? "0").trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return BigInt(0);
  const fraction = (match[3] ?? "").padEnd(scale, "0").slice(0, scale);
  const units = BigInt(`${match[2]}${fraction}`);
  return match[1] === "-" ? -units : units;
}

export function minorToDecimal(value: bigint, scale = 2) {
  const sign = value < BigInt(0) ? "-" : "";
  const raw = (value < BigInt(0) ? -value : value).toString().padStart(scale + 1, "0");
  return `${sign}${raw.slice(0, -scale)}.${raw.slice(-scale)}`;
}

function jakartaDayKey(value: Date | string | number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function summarizeMonitoring(input: readonly MonitoringRecord[], direction: MonitoringDirection = "ALL"): MonitoringSummary {
  const records = input.filter(({ transaction }) => direction === "ALL" || transaction.operation === direction);
  let totalValueMinor = BigInt(0);
  let buyValueMinor = BigInt(0);
  let sellValueMinor = BigInt(0);
  let buyCount = 0;
  let sellCount = 0;
  let requiresReviewCount = 0;
  let pendingReviewCount = 0;
  const customers = new Set<number>();
  const daily = new Map<string, { day: string; count: number; totalMinor: bigint; buyMinor: bigint; sellMinor: bigint }>();
  const currencies = new Map<string, { code: string; count: number; valueMinor: bigint }>();

  for (const record of records) {
    const valueMinor = decimalToMinor(record.transaction.rupiahAmount);
    totalValueMinor += valueMinor;
    customers.add(record.customer.id);
    if (record.transaction.operation === "BUY") {
      buyCount += 1;
      buyValueMinor += valueMinor;
    } else {
      sellCount += 1;
      sellValueMinor += valueMinor;
    }
    if (record.transaction.requiresReview) requiresReviewCount += 1;
    if (record.transaction.status === "PENDING_REVIEW") pendingReviewCount += 1;

    const day = jakartaDayKey(record.transaction.transactionAt);
    const dailyEntry = daily.get(day) ?? { day, count: 0, totalMinor: BigInt(0), buyMinor: BigInt(0), sellMinor: BigInt(0) };
    dailyEntry.count += 1;
    dailyEntry.totalMinor += valueMinor;
    if (record.transaction.operation === "BUY") dailyEntry.buyMinor += valueMinor;
    else dailyEntry.sellMinor += valueMinor;
    daily.set(day, dailyEntry);

    const currencyEntry = currencies.get(record.currency.code) ?? { code: record.currency.code, count: 0, valueMinor: BigInt(0) };
    currencyEntry.count += 1;
    currencyEntry.valueMinor += valueMinor;
    currencies.set(record.currency.code, currencyEntry);
  }

  return {
    records: [...records],
    transactionCount: records.length,
    buyCount,
    sellCount,
    uniqueCustomerCount: customers.size,
    requiresReviewCount,
    pendingReviewCount,
    reviewRatePct: records.length ? (requiresReviewCount / records.length) * 100 : 0,
    totalValueMinor,
    buyValueMinor,
    sellValueMinor,
    daily: Array.from(daily.values()).sort((left, right) => left.day.localeCompare(right.day)),
    currencies: Array.from(currencies.values()).sort((left, right) => (right.valueMinor > left.valueMinor ? 1 : right.valueMinor < left.valueMinor ? -1 : left.code.localeCompare(right.code))),
  };
}
