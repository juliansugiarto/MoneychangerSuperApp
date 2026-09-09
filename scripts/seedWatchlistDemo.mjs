#!/usr/bin/env node
/**
 * Mengisi `sanctions_watchlist_entries` pada basis data LOKAL dengan data peragaan.
 *
 *   node scripts/seedWatchlistDemo.mjs
 *
 * Ada karena kedua basis data lokal memiliki NOL baris pada tabel ini, sementara produksi
 * menyimpan 770 baris (531 DTTOT + 239 PPPSM). Migrasi Paket K2 mengubah nilai enum `listType`,
 * dan menjalankannya di atas tabel kosong hanya membuktikan bahwa `ALTER` tidak melempar galat —
 * ia tidak menyentuh satu pun baris, sehingga justru MELEWATKAN kegagalan yang ditakutkan:
 * penyuntingan senyap baris berjenis lama menjadi string kosong. Peragaan yang berhenti pada tabel
 * kosong belum membuktikan apa pun.
 *
 * Bentuk datanya meniru produksi (diperiksa baca-saja 9 September 2026): satu daftar DTTOT tanpa
 * sourceLabel, dua sub-daftar proliferasi (DPRK dan IR) yang masing-masing diperbarui terpisah,
 * dan kedua entityType pada setiap lingkup.
 *
 * NAMANYA SINTETIS. Daftar sanksi asli tidak pernah masuk ke repo ini, termasuk sebagai fixture.
 * Yang perlu ditiru adalah bentuk dan sebaran lingkupnya, bukan orangnya.
 *
 * Idempoten: menghapus lebih dulu baris yang `sourceFileName`-nya berawalan `peragaan-k2-`, lalu
 * menyisipkan ulang. Sengaja BUKAN `TRUNCATE` — tabel ini menampung data impor sungguhan di
 * lingkungan lain, dan kebiasaan menghapus seisi tabel dari skrip peragaan adalah kebiasaan yang
 * salah untuk dibawa ke sana.
 */

import { createConnection } from "mysql2/promise";

/** Penanda milik skrip ini; hanya baris dengan awalan inilah yang pernah dihapusnya. */
const SEED_FILE_PREFIX = "peragaan-k2-";

/**
 * `listType` di sini masih `PPPSM` — skrip ini menyiapkan keadaan SEBELUM migrasi `0056`.
 * Tugas 2 menggantinya menjadi `DPPSPM` sesudah migrasinya ada, supaya menjalankan ulang skrip ini
 * tidak mengembalikan nilai lama ke dalam basis data.
 */
const SCOPES = [
  { listType: "DTTOT", sourceLabel: null, prefix: "DTTOT", individuals: 4, entities: 2 },
  { listType: "PPPSM", sourceLabel: "DPRK", prefix: "DPRK", individuals: 3, entities: 3 },
  { listType: "PPPSM", sourceLabel: "IR", prefix: "IR", individuals: 2, entities: 3 },
];

const TARGETS = [
  { label: "moneychanger", url: process.env.DATABASE_URL },
  { label: "mc_t_abcvalas", url: process.env.TENANT_TEST_SECONDARY_URL },
];

/** Nama yang jelas-jelas bukan orang maupun badan usaha sungguhan, dan tetap lolos pencocokan fuzzy. */
function entriesFor(scope) {
  const rows = [];
  const fileName = `${SEED_FILE_PREFIX}${scope.prefix.toLowerCase()}.xlsx`;
  for (let n = 1; n <= scope.individuals; n += 1) {
    rows.push({
      listType: scope.listType,
      sourceLabel: scope.sourceLabel,
      entityType: "INDIVIDUAL",
      referenceCode: `${scope.prefix}i.${String(n).padStart(3, "0")}`,
      fullName: `Contoh Peragaan ${scope.prefix} Individu ${n}`,
      aliases: n === 1 ? `Alias Peragaan ${scope.prefix} ${n}` : null,
      sourceFileName: fileName,
    });
  }
  for (let n = 1; n <= scope.entities; n += 1) {
    rows.push({
      listType: scope.listType,
      sourceLabel: scope.sourceLabel,
      entityType: "ENTITY",
      referenceCode: `${scope.prefix}e.${String(n).padStart(3, "0")}`,
      fullName: `Contoh Peragaan ${scope.prefix} Entitas ${n}`,
      aliases: null,
      sourceFileName: fileName,
    });
  }
  return rows;
}

/**
 * Impor sungguhan dibatasi Controller ke atas, jadi baris peragaannya pun diatribusikan ke pengguna
 * yang memang berwenang. Tanpa pengguna sama sekali (tenant kosong) tabel ini tidak punya foreign
 * key, sehingga id 1 aman — tetapi itu disebutkan, bukan didiamkan.
 */
async function importerIdFor(connection, label) {
  const [rows] = await connection.query(
    "SELECT id FROM users WHERE role IN ('CONTROLLER', 'SHAREHOLDER') ORDER BY id LIMIT 1",
  );
  if (rows.length) return rows[0].id;
  console.log(`  ${label}: tidak ada pengguna CONTROLLER/SHAREHOLDER, importedByUserId memakai 1`);
  return 1;
}

/**
 * Menolak apa pun yang bukan basis data lokal. Skrip ini membaca DATABASE_URL, dan aturan keras
 * proyek melarang membuat data peragaan di luar `moneychanger` dan `mc_t_abcvalas` — penjaga di
 * sini lebih murah daripada mengandalkan lingkungan selalu benar.
 */
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const LOCAL_DATABASES = new Set(["moneychanger", "mc_t_abcvalas"]);

function assertLocal(url, label) {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!LOCAL_HOSTS.has(parsed.hostname) || !LOCAL_DATABASES.has(database)) {
    throw new Error(
      `${label}: menolak menulis ke ${parsed.hostname}/${database}. ` +
        "Skrip peragaan hanya boleh menyentuh moneychanger dan mc_t_abcvalas di 127.0.0.1.",
    );
  }
  return database;
}

async function seed(target) {
  assertLocal(target.url, target.label);
  const connection = await createConnection({ uri: target.url, multipleStatements: false });
  try {
    const importedByUserId = await importerIdFor(connection, target.label);
    const [deleted] = await connection.execute(
      "DELETE FROM sanctions_watchlist_entries WHERE sourceFileName LIKE ?",
      [`${SEED_FILE_PREFIX}%`],
    );
    const rows = SCOPES.flatMap(entriesFor);
    for (const row of rows) {
      await connection.execute(
        `INSERT INTO sanctions_watchlist_entries
           (listType, sourceLabel, entityType, referenceCode, fullName, aliases, sourceFileName, importedByUserId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.listType, row.sourceLabel, row.entityType, row.referenceCode, row.fullName, row.aliases, row.sourceFileName, importedByUserId],
      );
    }
    const [summary] = await connection.query(
      `SELECT listType, IFNULL(sourceLabel, '(null)') AS scope, entityType, COUNT(*) AS jumlah
         FROM sanctions_watchlist_entries
        GROUP BY listType, scope, entityType
        ORDER BY listType, scope, entityType`,
    );
    const rendered = summary.map((r) => `${r.listType}/${r.scope} ${r.entityType}=${r.jumlah}`).join(" | ");
    // Memeriksa hasilnya sendiri. Angka inilah yang dibandingkan sesudah migrasi `0056`; skrip yang
    // hanya mencetak apa yang kebetulan ada di tabel tidak dapat menjadi pembanding.
    const expected = SCOPES.flatMap((scope) => [
      `${scope.listType}/${scope.sourceLabel ?? "(null)"} INDIVIDUAL=${scope.individuals}`,
      `${scope.listType}/${scope.sourceLabel ?? "(null)"} ENTITY=${scope.entities}`,
    ]).sort().join(" | ");
    const actual = summary.map((r) => `${r.listType}/${r.scope} ${r.entityType}=${r.jumlah}`).sort().join(" | ");
    if (actual !== expected) {
      throw new Error(`${target.label}: jumlah baris tidak sesuai harapan.\n  diharapkan: ${expected}\n  ditemukan : ${actual}`);
    }
    console.log(`${target.label.padEnd(15)} dihapus=${deleted.affectedRows} disisipkan=${rows.length}`);
    console.log(`${"".padEnd(15)} ${rendered}`);
  } finally {
    await connection.end();
  }
}

const targets = TARGETS.filter((t) => {
  if (t.url) return true;
  console.error(`${t.label}: URL basis data tidak diatur — dilewati.`);
  process.exitCode = 1;
  return false;
});

if (!targets.length) {
  console.error("Tidak ada basis data lokal yang dapat diisi. Atur DATABASE_URL dan TENANT_TEST_SECONDARY_URL.");
  process.exitCode = 1;
} else {
  try {
    for (const target of targets) await seed(target);
  } catch (error) {
    // Penjaga basis data lokal adalah alasan utama skrip ini gagal; pesannya harus terbaca, bukan
    // terkubur di bawah jejak tumpukan.
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  }
}
