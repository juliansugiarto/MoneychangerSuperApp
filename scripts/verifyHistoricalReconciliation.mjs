import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const stagingPath = "/home/ubuntu/ptibv_document_review/staging/historical_transactions.csv";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL tidak tersedia.");

function parseCsvLine(line) {
  const fields = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  fields.push(value);
  return fields;
}

function rupiahToCents(value) {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error(`Nilai Rupiah sumber tidak valid: ${value}`);
  const [whole, fractional = ""] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt((fractional + "00").slice(0, 2));
}

function centsToRupiah(value) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function groupKey(period, operation, currency) {
  return `${period}|${operation}|${currency}`;
}

function addGroup(groups, period, operation, currency, rupiahAmount) {
  const key = groupKey(period, operation, currency);
  const group = groups.get(key) ?? { period, operation, currency, count: 0, rupiahCents: 0n };
  group.count += 1;
  group.rupiahCents += rupiahToCents(rupiahAmount);
  groups.set(key, group);
}

const csv = await fs.readFile(stagingPath, "utf8");
const lines = csv.trim().split(/\r?\n/);
const headers = parseCsvLine(lines[0]);
const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
const requiredHeaders = ["transaction_date", "operation", "currency", "rupiah_amount"];
for (const header of requiredHeaders) {
  if (headerIndex[header] === undefined) throw new Error(`Kolom sumber ${header} tidak ditemukan.`);
}

const sourceGroups = new Map();
const sourcePeriodGroups = new Map();
for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  const row = parseCsvLine(line);
  const period = row[headerIndex.transaction_date].slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`Periode transaksi sumber tidak valid: ${row[headerIndex.transaction_date]}`);
  addGroup(sourceGroups, "ALL", row[headerIndex.operation], row[headerIndex.currency], row[headerIndex.rupiah_amount]);
  addGroup(sourcePeriodGroups, period, row[headerIndex.operation], row[headerIndex.currency], row[headerIndex.rupiah_amount]);
}

function compareGroups(sourceGroupsToCompare, databaseGroupsToCompare) {
  const allKeys = new Set([...sourceGroupsToCompare.keys(), ...databaseGroupsToCompare.keys()]);
  return [...allKeys].flatMap((key) => {
    const source = sourceGroupsToCompare.get(key) ?? { ...databaseGroupsToCompare.get(key), count: 0, rupiahCents: 0n };
    const database = databaseGroupsToCompare.get(key) ?? { ...sourceGroupsToCompare.get(key), count: 0, rupiahCents: 0n };
    if (source.count === database.count && source.rupiahCents === database.rupiahCents) return [];
    return [{
      period: source.period ?? database.period,
      operation: source.operation ?? database.operation,
      currency: source.currency ?? database.currency,
      source: { count: source.count, totalRupiah: centsToRupiah(source.rupiahCents) },
      database: { count: database.count, totalRupiah: centsToRupiah(database.rupiahCents) },
    }];
  });
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.query(`
    SELECT
      et.operation AS operation,
      c.code AS currency,
      COUNT(*) AS transactionCount,
      SUM(et.rupiahAmount) AS totalRupiah
    FROM exchange_transactions AS et
    INNER JOIN currencies AS c ON c.id = et.currencyId
    WHERE et.isHistorical = true
      AND et.historicalSourceKey LIKE 'HIST-TXN:%'
    GROUP BY et.operation, c.code
    ORDER BY et.operation, c.code
  `);

  const databaseGroups = new Map();
  for (const row of rows) {
    databaseGroups.set(groupKey("ALL", row.operation, row.currency), {
      period: "ALL",
      operation: row.operation,
      currency: row.currency,
      count: Number(row.transactionCount),
      rupiahCents: rupiahToCents(row.totalRupiah),
    });
  }

  const [periodRows] = await connection.query(`
    SELECT
      DATE_FORMAT(et.transactionAt, '%Y-%m') AS period,
      et.operation AS operation,
      c.code AS currency,
      COUNT(*) AS transactionCount,
      SUM(et.rupiahAmount) AS totalRupiah
    FROM exchange_transactions AS et
    INNER JOIN currencies AS c ON c.id = et.currencyId
    WHERE et.isHistorical = true
      AND et.historicalSourceKey LIKE 'HIST-TXN:%'
    GROUP BY DATE_FORMAT(et.transactionAt, '%Y-%m'), et.operation, c.code
    ORDER BY period, et.operation, c.code
  `);
  const databasePeriodGroups = new Map();
  for (const row of periodRows) {
    databasePeriodGroups.set(groupKey(row.period, row.operation, row.currency), {
      period: row.period,
      operation: row.operation,
      currency: row.currency,
      count: Number(row.transactionCount),
      rupiahCents: rupiahToCents(row.totalRupiah),
    });
  }

  const mismatches = compareGroups(sourceGroups, databaseGroups);
  const periodMismatches = compareGroups(sourcePeriodGroups, databasePeriodGroups);

  const summarize = (groups) => [...groups.values()].reduce((summary, group) => ({
    transactionCount: summary.transactionCount + group.count,
    totalRupiahCents: summary.totalRupiahCents + group.rupiahCents,
  }), { transactionCount: 0, totalRupiahCents: 0n });
  const sourceSummary = summarize(sourceGroups);
  const databaseSummary = summarize(databaseGroups);

  const output = {
    matched: mismatches.length === 0 && periodMismatches.length === 0,
    source: { transactionCount: sourceSummary.transactionCount, totalRupiah: centsToRupiah(sourceSummary.totalRupiahCents), groupCount: sourceGroups.size },
    database: { transactionCount: databaseSummary.transactionCount, totalRupiah: centsToRupiah(databaseSummary.totalRupiahCents), groupCount: databaseGroups.size },
    mismatches,
    periodReconciliation: {
      matched: periodMismatches.length === 0,
      sourceGroupCount: sourcePeriodGroups.size,
      databaseGroupCount: databasePeriodGroups.size,
      mismatches: periodMismatches,
    },
  };

  console.log(JSON.stringify(output, null, 2));
  if (!output.matched) process.exitCode = 1;
} finally {
  connection.destroy();
}
