import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createConnection } from "mysql2/promise";
import { beforeAll, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { createInternalUser, getDb, getInternalUserByUsername } from "./db";
import { runWithTenant, type TenantBinding } from "./tenantContext";
import { createScratchDatabase } from "./testing/scratchDatabase";
import { assertUtcSession } from "./utcSession";

let binding: TenantBinding;
let url: string;
const inTenant = <T,>(fn: () => Promise<T>) => runWithTenant(binding, fn);
const firstRow = (result: unknown) => (result as unknown as Array<Array<Record<string, unknown>>>)[0][0];

beforeAll(async () => {
  ({ binding, url } = await createScratchDatabase("mc_uji_zona_waktu"));
  await inTenant(() => createInternalUser({ username: "uji.zona", passwordHash: "x", name: "Uji Zona", role: "STAFF", mustChangePassword: false }));
}, 180_000);

describe("sesi basis data selalu UTC", () => {
  it("waktu bawaan now() terbaca sebagai sekarang, bukan bergeser zona mesin", async () => {
    const user = await inTenant(async () => (await getInternalUserByUsername("uji.zona"))!);
    expect(Math.abs(user.createdAt.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("timestamp yang ditulis Drizzle terbaca kembali sebagai instan yang sama dengan bawaan now()", async () => {
    const at = new Date(Math.floor(Date.now() / 1000) * 1000);
    await inTenant(async () => {
      const db = (await getDb())!;
      await db.update(users).set({ lastSignedIn: at }).where(eq(users.username, "uji.zona"));
    });
    const user = await inTenant(async () => (await getInternalUserByUsername("uji.zona"))!);
    expect(user.lastSignedIn.getTime()).toBe(at.getTime());
    expect(Math.abs(user.lastSignedIn.getTime() - user.createdAt.getTime())).toBeLessThan(60_000);
  });

  it("setiap sambungan pool — bukan hanya yang pertama — bersesi UTC", async () => {
    const zones = await inTenant(async () => {
      const db = (await getDb())!;
      // Lebih banyak kueri serentak daripada ukuran pool (4) memaksa pool membuka sambungan baru.
      return Promise.all(Array.from({ length: 8 }, () => db.execute(sql`SELECT @@session.time_zone AS zone, SLEEP(0.05) AS s`)));
    });
    expect(new Set(zones.map((result) => firstRow(result).zone))).toEqual(new Set(["+00:00"]));
  });

  it("penjaga menerima sesi pool dan menolak sesi +07:00 dengan pesan yang jelas", async () => {
    await inTenant(async () => { await assertUtcSession((await getDb())!); });
    const connection = await createConnection({ uri: url });
    try {
      await connection.query("SET time_zone = '+07:00'");
      await expect(assertUtcSession(drizzle(connection))).rejects.toThrow("bukan UTC");
    } finally {
      await connection.end();
    }
  });
});
