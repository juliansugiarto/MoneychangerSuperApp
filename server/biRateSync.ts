import { createHash } from "crypto";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import type { Request, Response } from "express";
import {
  auditLogs,
  currencies,
  rateReferenceSnapshots,
  rateSyncConfigurations,
  rateSyncRuns,
} from "../drizzle/schema";
import { getDb } from "./db";
import { recordMarketRateObservation, retryTransientDatabaseRead } from "./operations";
import { sdk } from "./_core/sdk";

export const BI_TRANSACTION_RATES_URL = "https://www.bi.go.id/en/statistik/informasi-kurs/transaksi-bi/default.aspx";
export const BI_JISDOR_URL = "https://www.bi.go.id/en/statistik/informasi-kurs/jisdor/default.aspx";
const BI_SOURCE = "BI_TRANSACTION_RATES" as const;
const DEFAULT_CURRENCIES = [
  ["USD", "United States Dollar"],
  ["AED", "United Arab Emirates Dirham"],
  ["SAR", "Saudi Arabian Riyal"],
  ["SGD", "Singapore Dollar"],
  ["MYR", "Malaysian Ringgit"],
  ["AUD", "Australian Dollar"],
  ["JPY", "Japanese Yen"],
] as const;

export type BiTransactionRate = {
  code: string;
  quoteUnit: string;
  sellRate: string;
  buyRate: string;
};

export type ParsedBiRates = {
  referenceDate: Date;
  rates: BiTransactionRate[];
};

export type ParsedJisdorRate = { referenceDate: Date; rate: string };

export function isExpectedBiRateSyncTask(taskUid: string, scheduleCronTaskUid: string | null, enabled: boolean) {
  return enabled && Boolean(scheduleCronTaskUid) && taskUid === scheduleCronTaskUid;
}

function asDecimal(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error(`Nilai kurs BI tidak valid: ${value}`);
  return normalized;
}

function parseBiDate(value: string) {
  const parts = value.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const monthIndex: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const day = Number(parts?.[1]);
  const month = monthIndex[parts?.[2]?.toLowerCase() ?? ""];
  const year = Number(parts?.[3]);
  if (!parts || !Number.isInteger(day) || month === undefined || !Number.isInteger(year)) {
    throw new Error(`Tanggal pembaruan BI tidak valid: ${value}`);
  }
  // Midday UTC prevents date-only storage from rolling into the prior calendar day.
  return new Date(Date.UTC(year, month, day, 12));
}

function formatReferenceDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function referenceDateBounds(referenceDate: Date) {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate() + 1));
  return { start, end };
}

/**
 * Parses either readable table text or source HTML converted to text. This deliberately
 * rejects incomplete tables rather than accepting a partly parsed reference rate.
 */
export function parseBiTransactionRates(source: string): ParsedBiRates {
  const text = source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:td|th|tr|p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\r/g, "");
  const dateMatch = text.match(/Last\s+Update\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (!dateMatch?.[1]) throw new Error("Tanggal pembaruan tidak ditemukan pada sumber BI.");

  const rows = new Map<string, BiTransactionRate>();
  const rowPattern = /(?:^|\n|\|)\s*([A-Z]{3})\s*(?:\||\s)+([\d,.]+)\s*(?:\||\s)+([\d,.]+)\s*(?:\||\s)+([\d,.]+)/g;
  for (const match of Array.from(text.matchAll(rowPattern))) {
    const [, code, quoteUnit, sellRate, buyRate] = match;
    if (!code || !quoteUnit || !sellRate || !buyRate) continue;
    if (!DEFAULT_CURRENCIES.some(([currencyCode]) => currencyCode === code)) continue;
    rows.set(code, {
      code,
      quoteUnit: asDecimal(quoteUnit),
      sellRate: asDecimal(sellRate),
      buyRate: asDecimal(buyRate),
    });
  }

  if (rows.size === 0) throw new Error("Tidak ada baris kurs target yang dapat dibaca dari sumber BI.");
  return { referenceDate: parseBiDate(dateMatch[1]), rates: Array.from(rows.values()) };
}

export function parseJisdorRate(source: string): ParsedJisdorRate {
  const text = source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:td|th|tr|p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\r/g, "");
  const row = text.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})[\s\S]{0,160}?Rp\s*([\d,.]+)/i);
  if (!row?.[1] || !row[2]) throw new Error("Nilai JISDOR terbaru tidak ditemukan pada sumber BI.");
  return { referenceDate: parseBiDate(row[1]), rate: asDecimal(row[2]) };
}

async function fetchBiTransactionRates() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(BI_TRANSACTION_RATES_URL, {
      headers: { "user-agent": "IbukotaValasindo-RateSync/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Sumber BI merespons HTTP ${response.status}.`);
    const body = await response.text();
    return { parsed: parseBiTransactionRates(body), payloadHash: createHash("sha256").update(body).digest("hex") };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJisdorRate() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(BI_JISDOR_URL, { headers: { "user-agent": "IbukotaValasindo-RateSync/1.0" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Sumber JISDOR merespons HTTP ${response.status}.`);
    const body = await response.text();
    return { parsed: parseJisdorRate(body), payloadHash: createHash("sha256").update(body).digest("hex") };
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncJisdorReference(actorUserId?: number | null) {
  await ensureDefaultCurrencies();
  const { parsed: jisdor, payloadHash: jisdorPayloadHash } = await fetchJisdorRate();
  return recordMarketRateObservation({
    currencyCode: "USD", sourceName: "JISDOR", sourceKind: "OFFICIAL", sourceUrl: BI_JISDOR_URL,
    quoteUnit: "1", buyRate: jisdor.rate, sellRate: jisdor.rate, observedAt: jisdor.referenceDate, payloadHash: jisdorPayloadHash,
    notes: "Referensi JISDOR BI; tidak digunakan untuk mengaktifkan kurs outlet otomatis.",
  }, actorUserId ?? null);
}

async function ensureConfiguration() {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia untuk sinkronisasi kurs.");
  const existing = await retryTransientDatabaseRead(() => db.select().from(rateSyncConfigurations).where(eq(rateSyncConfigurations.source, BI_SOURCE)).limit(1));
  if (existing[0]) return { db, configuration: existing[0] };
  await db.insert(rateSyncConfigurations).values({ source: BI_SOURCE });
  const created = await retryTransientDatabaseRead(() => db.select().from(rateSyncConfigurations).where(eq(rateSyncConfigurations.source, BI_SOURCE)).limit(1));
  if (!created[0]) throw new Error("Konfigurasi sinkronisasi kurs tidak dapat dibuat.");
  return { db, configuration: created[0] };
}

async function ensureDefaultCurrencies() {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia untuk master mata uang.");
  const existing = await retryTransientDatabaseRead(() => db.select({ code: currencies.code }).from(currencies).where(inArray(currencies.code, DEFAULT_CURRENCIES.map(([code]) => code))));
  const present = new Set(existing.map((item) => item.code));
  const missing = DEFAULT_CURRENCIES.filter(([code]) => !present.has(code)).map(([code, name]) => ({ code, name }));
  if (missing.length) await db.insert(currencies).values(missing);
}

export async function syncBiReferenceRates(trigger: "MANUAL" | "SCHEDULED", actorUserId?: number | null) {
  const { db, configuration } = await ensureConfiguration();
  const startedAt = new Date();
  if (!configuration.enabled) {
    await db.insert(rateSyncRuns).values({ configurationId: configuration.id, status: "SKIPPED", runAt: startedAt, message: "Sinkronisasi dinonaktifkan oleh konfigurasi." });
    return { status: "SKIPPED" as const, inserted: 0, referenceDate: null };
  }

  await db.insert(rateSyncRuns).values({ configurationId: configuration.id, status: "STARTED", runAt: startedAt, message: `Pemicu: ${trigger}` });
  await db.update(rateSyncConfigurations).set({ lastAttemptAt: startedAt, lastError: null }).where(eq(rateSyncConfigurations.id, configuration.id));

  try {
    const { parsed, payloadHash } = await fetchBiTransactionRates();
    await ensureDefaultCurrencies();
    const activeCurrencies = await db.select().from(currencies).where(and(inArray(currencies.code, parsed.rates.map((rate) => rate.code)), eq(currencies.active, true)));
    const currencyByCode = new Map(activeCurrencies.map((currency) => [currency.code, currency]));
    let inserted = 0;

    const { start: referenceDayStart, end: referenceDayEnd } = referenceDateBounds(parsed.referenceDate);
    for (const rate of parsed.rates) {
      const currency = currencyByCode.get(rate.code);
      if (!currency) continue;
      const prior = await db.select({ id: rateReferenceSnapshots.id }).from(rateReferenceSnapshots).where(and(
        eq(rateReferenceSnapshots.currencyId, currency.id),
        gte(rateReferenceSnapshots.referenceDate, referenceDayStart),
        lt(rateReferenceSnapshots.referenceDate, referenceDayEnd),
        eq(rateReferenceSnapshots.source, BI_SOURCE),
      )).limit(1);
      if (prior[0]) continue;
      await db.insert(rateReferenceSnapshots).values({
        currencyId: currency.id,
        referenceDate: parsed.referenceDate,
        source: BI_SOURCE,
        quoteUnit: rate.quoteUnit,
        buyRate: rate.buyRate,
        sellRate: rate.sellRate,
        sourceUrl: BI_TRANSACTION_RATES_URL,
        fetchedAt: new Date(),
        payloadHash,
      });
      inserted += 1;
    }

    try {
      await syncJisdorReference(actorUserId ?? null);
    } catch (jisdorError) {
      const message = jisdorError instanceof Error ? jisdorError.message : "Kegagalan sinkronisasi JISDOR tidak diketahui.";
      console.warn("[BI Rate Sync] JISDOR observation skipped:", message);
      await db.insert(auditLogs).values({ actorUserId: actorUserId ?? null, action: "JISDOR_OBSERVATION_FAILED", entityType: "rate_reference", entityId: formatReferenceDate(parsed.referenceDate), metadata: { message, source: BI_JISDOR_URL } });
    }

    const completedAt = new Date();
    await db.update(rateSyncConfigurations).set({ lastSuccessfulAt: completedAt, lastAttemptAt: completedAt, lastError: null }).where(eq(rateSyncConfigurations.id, configuration.id));
    await db.insert(rateSyncRuns).values({ configurationId: configuration.id, status: "SUCCEEDED", runAt: completedAt, referenceDate: parsed.referenceDate, message: `${inserted} snapshot kurs referensi baru dibuat.` });
    await db.insert(auditLogs).values({
      actorUserId: actorUserId ?? null,
      action: "RATE_REFERENCE_SYNC_SUCCEEDED",
      entityType: "rate_sync_configuration",
      entityId: String(configuration.id),
      metadata: { trigger, inserted, referenceDate: formatReferenceDate(parsed.referenceDate), source: BI_SOURCE },
    });
    return { status: "SUCCEEDED" as const, inserted, referenceDate: formatReferenceDate(parsed.referenceDate) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kegagalan sinkronisasi kurs tidak diketahui.";
    const failedAt = new Date();
    await db.update(rateSyncConfigurations).set({ lastAttemptAt: failedAt, lastError: message }).where(eq(rateSyncConfigurations.id, configuration.id));
    await db.insert(rateSyncRuns).values({ configurationId: configuration.id, status: "FAILED", runAt: failedAt, message });
    await db.insert(auditLogs).values({ actorUserId: actorUserId ?? null, action: "RATE_REFERENCE_SYNC_FAILED", entityType: "rate_sync_configuration", entityId: String(configuration.id), metadata: { trigger, source: BI_SOURCE, message } });
    throw error;
  }
}

export async function getRateSyncStatus() {
  const readStatus = async () => {
    const db = await getDb();
    if (!db) {
      const error = new Error("Database tidak tersedia.") as Error & { code?: string };
      error.code = "DATABASE_UNAVAILABLE";
      throw error;
    }
    return (await db.select().from(rateSyncConfigurations).where(eq(rateSyncConfigurations.source, BI_SOURCE)).limit(1))[0] ?? null;
  };

  try {
    return await retryTransientDatabaseRead(readStatus);
  } catch (error) {
    console.warn("[BI Rate Sync] Status sinkronisasi sementara tidak tersedia.", error);
    return null;
  }
}

export async function handleScheduledBiRateSync(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) throw new Error("Database tidak tersedia untuk validasi jadwal sinkronisasi kurs.");
    const configuration = (await db.select().from(rateSyncConfigurations)
      .where(eq(rateSyncConfigurations.scheduleCronTaskUid, user.taskUid)).limit(1))[0];
    if (!configuration) return res.json({ ok: true, skipped: "orphan" });
    if (!isExpectedBiRateSyncTask(user.taskUid, configuration.scheduleCronTaskUid, configuration.enabled)) {
      return res.status(403).json({ error: "scheduled-sync-disabled" });
    }
    const result = await syncBiReferenceRates("SCHEDULED");
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kegagalan sinkronisasi kurs tidak diketahui.";
    return res.status(500).json({ error: message, timestamp: new Date().toISOString(), context: { route: "/api/scheduled/bi-rate-sync" } });
  }
}
