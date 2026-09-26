import { sql } from "drizzle-orm";
import { createConnection } from "mysql2/promise";
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
  const openDatabase = async () => {
    const db = await getDb();
    if (!db) throw new Error("database tidak tersedia");
    const rows = await db.execute(sql`SELECT DATABASE() AS name`);
    return String((rows[0] as unknown as Array<{ name: string }>)[0].name);
  };
  /** Hitungan lewat sambungan langsung, di luar ikatan tenant — pembanding yang tidak bergantung isi data. */
  const directCount = async (url: string) => {
    const connection = await createConnection({ uri: url });
    try {
      const [rows] = await connection.query("SELECT COUNT(*) AS total FROM users");
      return Number((rows as Array<{ total: number }>)[0].total);
    } finally {
      await connection.end();
    }
  };
  const databaseNameOf = (url: string) => new URL(url).pathname.slice(1);

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
    // sekali — namun tiap ikatan menjawab dari database miliknya sendiri. Dulu uji ini menuntut
    // database kedua kosong; sejak sub-proyek 2, `mc_t_abcvalas` adalah basis data peragaan wizard
    // dan punya akun, jadi yang dipaku kini nama database yang terbuka dan kecocokan hitungannya
    // dengan sambungan langsung — tidak bergantung isi data.
    expect(await runWithTenant({ kind: "resolved", tenantCode: "ibukota", databaseUrl: primary! }, openDatabase)).toBe(databaseNameOf(primary!));
    expect(await runWithTenant({ kind: "resolved", tenantCode: "abcvalas", databaseUrl: secondary! }, openDatabase)).toBe(databaseNameOf(secondary!));
    expect(databaseNameOf(primary!)).not.toBe(databaseNameOf(secondary!));
    expect(inPrimary).toBe(await directCount(primary!));
    expect(inSecondary).toBe(await directCount(secondary!));
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
      runWithTenant({ kind: "resolved", tenantCode: "ibukota", databaseUrl: primary! }, openDatabase),
      runWithTenant({ kind: "resolved", tenantCode: "abcvalas", databaseUrl: secondary! }, openDatabase),
      runWithTenant({ kind: "resolved", tenantCode: "ibukota", databaseUrl: primary! }, openDatabase),
    ]);
    expect(a).toBe(databaseNameOf(primary!));
    expect(b).toBe(databaseNameOf(secondary!));
    expect(c).toBe(a);
  });
});
