import { beforeAll, describe, expect, it } from "vitest";
import { createInternalUser } from "./db";
import { hashPassword } from "./internalAuth";
import { databaseOrThrow, ensureCurrency } from "./operations";
import { saveRateTier } from "./rateBoard";
import { rateTiers } from "../drizzle/schema";
import { runWithTenant, type TenantBinding } from "./tenantContext";
import { createScratchDatabase } from "./testing/scratchDatabase";
import { inArray } from "drizzle-orm";

let binding: TenantBinding;
let actorId: number;
let currencyId: number;
const inTenant = <T,>(fn: () => Promise<T>) => runWithTenant(binding, fn);

beforeAll(async () => {
  ({ binding } = await createScratchDatabase("mc_uji_kelompok_kurs"));
  await inTenant(async () => {
    actorId = (await createInternalUser({ username: "admin.kurs", passwordHash: await hashPassword("Admin-kurs-2026"), name: "Admin Kurs", role: "ADMIN", mustChangePassword: false }))!.id;
    currencyId = (await ensureCurrency({ code: "USD", name: "Dolar Amerika" })).id;
  });
}, 180_000);

describe("membuat kelompok pecahan", () => {
  it("setiap penyimpanan bersamaan mengembalikan id kelompoknya sendiri, bukan id terbesar valuta itu", async () => {
    const labels = ["100", "50", "20", "10", "5", "2", "1", "besar"];
    const results = await inTenant(() => Promise.all(labels.map((label, index) =>
      saveRateTier({ currencyId, label, denominationValues: [String(1000 + index)], sortOrder: index }, actorId))));
    const ids = results.map((result) => result.tierId);
    expect(new Set(ids).size).toBe(labels.length);
    const rows = await inTenant(async () => (await databaseOrThrow()).select().from(rateTiers).where(inArray(rateTiers.id, ids)));
    for (const [index, id] of ids.entries()) expect(rows.find((row) => row.id === id)?.label).toBe(labels[index]);
  }, 60_000);
});
