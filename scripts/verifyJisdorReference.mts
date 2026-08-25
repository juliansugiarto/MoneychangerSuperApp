import { desc, eq } from "drizzle-orm";
import { currencies, marketRateObservations } from "../drizzle/schema";
import { syncJisdorReference } from "../server/biRateSync";
import { getDb } from "../server/db";

const syncResult = await syncJisdorReference(null);
const db = await getDb();
if (!db) throw new Error("Database tidak tersedia untuk verifikasi JISDOR.");
const usd = (await db.select().from(currencies).where(eq(currencies.code, "USD")).limit(1))[0];
if (!usd) throw new Error("Mata uang USD tidak tersedia.");
const observation = (await db.select().from(marketRateObservations)
  .where(eq(marketRateObservations.currencyId, usd.id))
  .orderBy(desc(marketRateObservations.observedAt))
  .limit(1))[0];
if (!observation || observation.sourceName !== "JISDOR") {
  throw new Error("Observasi JISDOR belum tercatat setelah sinkronisasi.");
}

console.log(JSON.stringify({ syncResult, jisdor: { observedAt: observation.observedAt, buyRate: observation.buyRate, sellRate: observation.sellRate, sourceUrl: observation.sourceUrl } }, null, 2));
