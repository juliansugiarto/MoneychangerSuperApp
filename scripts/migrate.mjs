#!/usr/bin/env node
/**
 * Menerapkan migrasi Drizzle yang tertunda ke DATABASE_URL, tanpa drizzle-kit (dev dependency, tidak ada di image
 * produksi). Memakai migrator drizzle-orm yang sama dengan `drizzle-kit migrate`: tabel `__drizzle_migrations` dan
 * hash berkas yang sama, sehingga basis data yang dulu dimigrasi drizzle-kit dilanjutkan tanpa mengulang apa pun.
 *
 *   node scripts/migrate.mjs            (di tumpukan Docker: docker compose run --rm ops node scripts/migrate.mjs)
 */
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL belum diatur.");
  process.exit(1);
}
const connection = await createConnection({ uri: url, multipleStatements: true });
try {
  const count = async () => {
    const [rows] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '__drizzle_migrations'");
    if (!Number(rows[0].n)) return 0;
    const [applied] = await connection.query("SELECT COUNT(*) AS n FROM __drizzle_migrations");
    return Number(applied[0].n);
  };
  const before = await count();
  await migrate(drizzle(connection), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  const after = await count();
  console.log(`Migrasi tercatat: ${after} (baru diterapkan: ${after - before}).`);
} finally {
  await connection.end();
}
