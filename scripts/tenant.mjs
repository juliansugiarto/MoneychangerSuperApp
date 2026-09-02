#!/usr/bin/env node
/**
 * Tenant provisioning and migration fan-out.
 *
 * One database per money changer buys isolation that no forgotten WHERE clause can undo, and the
 * price is that schema changes must reach every database rather than one. That price is only safe
 * to pay with tooling that applies migrations everywhere and says plainly where it failed — a
 * tenant left a version behind fails later in ways that look like application bugs.
 *
 *   node scripts/tenant.mjs list
 *   node scripts/tenant.mjs provision <kode>
 *   node scripts/tenant.mjs migrate-all
 *
 * Reads TENANT_REGISTRY ("kode=mysql://…;kode2=mysql://…") and ADMIN_DATABASE_URL, a connection
 * with rights to CREATE DATABASE. Never drops or overwrites anything.
 */

import { createConnection } from "mysql2/promise";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Tenant codes become database names, so keep them to characters that need no quoting. */
const CODE_PATTERN = /^[a-z][a-z0-9_]{2,30}$/;
const databaseNameFor = (code) => `mc_t_${code}`;

function parseRegistry(raw) {
  const registry = new Map();
  for (const entry of (raw ?? "").split(";")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const at = trimmed.indexOf("=");
    if (at === -1) continue;
    const code = trimmed.slice(0, at).trim();
    const url = trimmed.slice(at + 1).trim();
    if (code && url) registry.set(code, url);
  }
  return registry;
}

function adminUrlFor(databaseName) {
  const admin = process.env.ADMIN_DATABASE_URL;
  if (!admin) throw new Error("ADMIN_DATABASE_URL belum diatur (butuh hak CREATE DATABASE).");
  const url = new URL(admin);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function migrate(databaseUrl, label) {
  process.stdout.write(`  ${label.padEnd(24)} `);
  try {
    await run("./node_modules/.bin/drizzle-kit", ["migrate"], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      cwd: process.cwd(),
    });
    console.log("selesai");
    return true;
  } catch (error) {
    console.log("GAGAL");
    console.error(`    ${String(error.stderr || error.message).trim().split("\n").slice(-3).join("\n    ")}`);
    return false;
  }
}

async function list() {
  const registry = parseRegistry(process.env.TENANT_REGISTRY);
  if (!registry.size) return console.log("Belum ada tenant terdaftar di TENANT_REGISTRY.");
  console.log(`${registry.size} tenant terdaftar:`);
  for (const [code, url] of registry) {
    const name = new URL(url).pathname.slice(1);
    console.log(`  ${code.padEnd(20)} ${name}`);
  }
}

async function provision(code) {
  if (!CODE_PATTERN.test(code ?? "")) {
    throw new Error(`Kode tenant tidak sah: "${code}". Gunakan huruf kecil, angka, dan garis bawah (3-31 karakter, diawali huruf).`);
  }
  const databaseName = databaseNameFor(code);
  const admin = await createConnection({ uri: process.env.ADMIN_DATABASE_URL ?? "", multipleStatements: false });
  try {
    const [rows] = await admin.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?", [databaseName]);
    if (rows.length) {
      // Berhenti daripada menimpa: database yang sudah ada mungkin milik tenant yang sedang berjalan.
      throw new Error(`Database ${databaseName} sudah ada. Hapus manual bila memang ingin dibuat ulang; skrip ini tidak menghapus apa pun.`);
    }
    console.log(`Membuat ${databaseName}…`);
    await admin.query(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await admin.end();
  }

  const url = adminUrlFor(databaseName);
  console.log("Menerapkan migrasi:");
  if (!(await migrate(url, code))) throw new Error("Migrasi gagal; database dibuat tetapi belum siap dipakai.");

  console.log(`\nTenant "${code}" siap. Tambahkan ke TENANT_REGISTRY:\n`);
  console.log(`  ${code}=mysql://<pengguna>:<sandi>@127.0.0.1:3306/${databaseName}\n`);
  console.log("Buat pengguna MySQL tersendiri untuk tenant ini, dengan hak hanya pada database tersebut:");
  console.log(`  CREATE USER '${code}'@'localhost' IDENTIFIED BY '<sandi>';`);
  console.log(`  GRANT SELECT, INSERT, UPDATE, DELETE ON \`${databaseName}\`.* TO '${code}'@'localhost';`);
}

async function migrateAll() {
  const registry = parseRegistry(process.env.TENANT_REGISTRY);
  if (!registry.size) return console.log("Tidak ada tenant untuk dimigrasikan.");
  console.log(`Menerapkan migrasi ke ${registry.size} tenant:`);
  const failed = [];
  for (const [code, url] of registry) {
    if (!(await migrate(url, code))) failed.push(code);
  }
  console.log();
  if (failed.length) {
    // Dilaporkan tegas: tenant yang tertinggal versi skema akan gagal dengan gejala yang
    // membingungkan, jauh dari penyebabnya.
    console.error(`${failed.length} tenant GAGAL: ${failed.join(", ")}`);
    console.error("Selesaikan dahulu sebelum menganggap rilis ini selesai.");
    process.exitCode = 1;
    return;
  }
  console.log(`Seluruh ${registry.size} tenant berada pada versi skema yang sama.`);
}

const [command, argument] = process.argv.slice(2);
try {
  if (command === "list") await list();
  else if (command === "provision") await provision(argument);
  else if (command === "migrate-all") await migrateAll();
  else {
    console.log("Perintah: list | provision <kode> | migrate-all");
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}
