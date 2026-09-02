import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "./db";
import { TenantResolutionError, runWithTenant } from "./tenantContext";

/**
 * Isolation proved against two real databases rather than mocks.
 *
 * The claim being tested is the one the whole tenancy design rests on: a query written without any
 * tenant filter — which is every one of the 223 queries in this server — still cannot reach another
 * money changer's rows, because the binding decides which database is open. A mock would prove the
 * plumbing; only two live databases prove the isolation.
 *
 * Needs the local development databases from `scripts/tenant.mjs`, so it is skipped elsewhere.
 */
const primary = process.env.DATABASE_URL;
const secondary = process.env.TENANT_TEST_SECONDARY_URL;
const runnable = Boolean(primary && secondary);

describe.skipIf(!runnable)("isolasi tenant terhadap database sungguhan", () => {
  const countUsers = async () => {
    const db = await getDb();
    if (!db) throw new Error("database tidak tersedia");
    const rows = await db.execute(sql`SELECT COUNT(*) AS total FROM users`);
    return Number((rows[0] as unknown as Array<{ total: number }>)[0].total);
  };

  it("setiap ikatan hanya melihat database miliknya sendiri", async () => {
    const inPrimary = await runWithTenant(
      { kind: "resolved", tenantCode: "ibukota", databaseUrl: primary! },
      countUsers,
    );
    const inSecondary = await runWithTenant(
      { kind: "resolved", tenantCode: "abcvalas", databaseUrl: secondary! },
      countUsers,
    );

    // Query yang dijalankan identik — "SELECT COUNT(*) FROM users", tanpa penyaring tenant sama
    // sekali — namun hasilnya berbeda karena database yang terbuka memang berbeda.
    expect(inPrimary).toBeGreaterThan(0);
    expect(inSecondary).toBe(0);
    expect(inPrimary).not.toBe(inSecondary);
  });

  it("ikatan kembali seperti semula setelah permintaan selesai", async () => {
    await runWithTenant({ kind: "resolved", tenantCode: "abcvalas", databaseUrl: secondary! }, countUsers);
    // Tanpa ikatan, perkakas kembali memakai DATABASE_URL — bukan tenant terakhir yang kebetulan
    // dipakai. Kebocoran paling halus justru muncul bila ikatan tertinggal.
    expect(await countUsers()).toBeGreaterThan(0);
  });

  it("permintaan yang tenantnya gagal dikenali ditolak, bukan diberi database bawaan", async () => {
    await expect(
      runWithTenant({ kind: "unresolved", reason: "subdomain tidak terdaftar" }, countUsers),
    ).rejects.toThrow(TenantResolutionError);
  });

  it("dua tenant yang berjalan bersamaan tidak saling tertukar", async () => {
    const [a, b, c] = await Promise.all([
      runWithTenant({ kind: "resolved", tenantCode: "ibukota", databaseUrl: primary! }, countUsers),
      runWithTenant({ kind: "resolved", tenantCode: "abcvalas", databaseUrl: secondary! }, countUsers),
      runWithTenant({ kind: "resolved", tenantCode: "ibukota", databaseUrl: primary! }, countUsers),
    ]);
    expect(b).toBe(0);
    expect(a).toBe(c);
    expect(a).toBeGreaterThan(0);
  });
});
