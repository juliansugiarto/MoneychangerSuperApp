import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createConnection } from "mysql2/promise";
import type { TenantBinding } from "../tenantContext";
import { UTC_SESSION_SQL } from "../utcSession";

/**
 * Basis data sekali pakai untuk uji hidup yang MENULIS — tidak pernah `moneychanger`,
 * `mc_t_abcvalas`, `mc_t_visual`, atau produksi. Namanya wajib berawalan `mc_uji_` supaya
 * `DROP DATABASE` di sini tidak dapat mengenai basis data lain. Dibuat ulang tiap jalan dan
 * dibiarkan sesudahnya untuk diperiksa; seluruh migrasi diterapkan di dalam proses, jadi
 * skemanya persis skema yang akan dipasang.
 */
export async function createScratchDatabase(name: `mc_uji_${string}`): Promise<{ binding: TenantBinding; url: string }> {
  if (!/^mc_uji_[a-z_]+$/.test(name)) throw new Error(`Nama basis data uji harus berawalan mc_uji_: ${name}`);
  if (process.env.NODE_ENV === "production") throw new Error("Basis data uji hanya untuk mesin lokal.");
  const admin = process.env.ADMIN_DATABASE_URL || "mysql://root@127.0.0.1:3306/";
  const connection = await createConnection({ uri: admin });
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await connection.end();
  }
  const target = new URL(admin);
  target.pathname = `/${name}`;
  const url = target.toString();
  const migrationConnection = await createConnection({ uri: url });
  try {
    await migrationConnection.query(UTC_SESSION_SQL);
    await migrate(drizzle(migrationConnection), { migrationsFolder: "drizzle" });
  } finally {
    await migrationConnection.end();
  }
  return { binding: { kind: "resolved", tenantCode: name, databaseUrl: url }, url };
}
