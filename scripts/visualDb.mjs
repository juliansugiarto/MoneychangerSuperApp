#!/usr/bin/env node
/**
 * Basis data khusus uji tangkapan layar: `mc_t_visual`. Tidak pernah `moneychanger`, tidak pernah
 * produksi. Dibuat lewat `tenant.mjs provision` (membuat basis data dan menerapkan seluruh migrasi),
 * lalu diisi satu baris Profil Perusahaan dengan nama tetap supaya merek pada shell stabil.
 *
 * Aman diulang: basis data yang sudah ada tidak dibuat ulang, dan profilnya hanya disisipkan bila kosong.
 *
 *   ADMIN_DATABASE_URL=mysql://root@127.0.0.1:3306/ node scripts/visualDb.mjs
 */
import { createConnection } from "mysql2/promise";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const DATABASE = "mc_t_visual";
const admin = process.env.ADMIN_DATABASE_URL ?? "mysql://root@127.0.0.1:3306/";
if (process.env.NODE_ENV === "production") throw new Error("Basis data visual hanya untuk mesin lokal.");

const connection = await createConnection({ uri: admin });
const [rows] = await connection.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?", [DATABASE]);
await connection.end();

if (!rows.length) {
  const { stdout } = await run("node", ["scripts/tenant.mjs", "provision", "visual"], { env: { ...process.env, ADMIN_DATABASE_URL: admin } });
  process.stdout.write(stdout);
} else {
  console.log(`${DATABASE} sudah ada — migrasi yang tertunda diterapkan.`);
  const url = new URL(admin);
  url.pathname = `/${DATABASE}`;
  await run("./node_modules/.bin/drizzle-kit", ["migrate"], { env: { ...process.env, DATABASE_URL: url.toString() } });
}

const url = new URL(admin);
url.pathname = `/${DATABASE}`;
const db = await createConnection({ uri: url.toString() });
const [profiles] = await db.query("SELECT id FROM company_profile LIMIT 1");
if (!profiles.length) {
  await db.query("INSERT INTO company_profile (legalEntityName, tradingName, timezone) VALUES (?, ?, ?)", ["PT Contoh Valuta Nusantara", "Contoh Valuta", "Asia/Jakarta"]);
  console.log("Profil Perusahaan contoh disisipkan.");
}
await db.end();
console.log(`${DATABASE} siap.`);
