import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Decimal from "decimal.js";
import mysql from "mysql2/promise";
import { buildUniqueNameIndex, normalizeHistoricalCustomerName, resolveHistoricalCustomer } from "./historicalCustomerMapping.mjs";

const SOURCE_FILE = "/home/ubuntu/ptibv_document_review/staging/historical_transactions.csv";
const CUSTOMER_SOURCE_FILE = "/home/ubuntu/ptibv_document_review/staging/historical_customers.csv";
const APPLY = process.argv.includes("--apply");
const CURRENCY_NAMES = {
  AED: "United Arab Emirates Dirham", AUD: "Australian Dollar", BHD: "Bahraini Dinar",
  CNY: "Chinese Yuan", EUR: "Euro", JPY: "Japanese Yen", KWD: "Kuwaiti Dinar",
  MYR: "Malaysian Ringgit", QAR: "Qatari Riyal", SAR: "Saudi Riyal", SGD: "Singapore Dollar",
  THB: "Thai Baht", USD: "United States Dollar",
};

function hash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 48);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && char === ",") { row.push(cell); cell = ""; continue; }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = []; cell = ""; continue;
    }
    cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const [header, ...values] = rows;
  return values.map((value) => Object.fromEntries(header.map((key, index) => [key, (value[index] ?? "").trim()])));
}

function asDate(value) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Tanggal tidak valid pada staging: ${value}`);
  return date;
}

function decimal(value, label) {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error(`${label} tidak valid pada staging.`);
  return value;
}

function addRupiah(total, amount) {
  return new Decimal(total ?? "0").plus(new Decimal(amount)).toFixed(2);
}

async function main() {
  const [stagingText, customerStagingText] = await Promise.all([
    readFile(SOURCE_FILE, "utf8"),
    readFile(CUSTOMER_SOURCE_FILE, "utf8"),
  ]);
  const staging = parseCsv(stagingText);
  const customerStaging = parseCsv(customerStagingText);
  if (!staging.length) throw new Error("Staging transaksi historis kosong.");
  if (!customerStaging.length) throw new Error("Staging nasabah historis kosong.");
  const unsupported = staging.filter((row) => !CURRENCY_NAMES[row.currency]);
  if (unsupported.length) throw new Error(`Mata uang staging tidak didukung: ${[...new Set(unsupported.map((row) => row.currency))].join(", ")}`);
  if (!APPLY) {
    const totals = staging.reduce((accumulator, row) => {
      const key = `${row.operation}:${row.currency}`;
      accumulator[key] = addRupiah(accumulator[key], row.rupiah_amount);
      return accumulator;
    }, {});
    console.log(JSON.stringify({ mode: "dry-run", stagedRows: staging.length, stagedCustomers: customerStaging.length, operationCurrencyTotals: totals }, null, 2));
    return;
  }

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL tidak tersedia.");
  const pool = mysql.createPool(process.env.DATABASE_URL);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[actor]] = await connection.query(
      "SELECT id FROM users WHERE role IN ('SHAREHOLDER', 'CONTROLLER', 'ADMIN') AND accountStatus = 'ACTIVE' ORDER BY FIELD(role, 'SHAREHOLDER', 'CONTROLLER', 'ADMIN') LIMIT 1",
    );
    if (!actor) throw new Error("Tidak ada akun pengawas aktif untuk menjadi pencatat impor historis.");

    const currencyIds = new Map();
    for (const code of Object.keys(CURRENCY_NAMES)) {
      await connection.query(
        "INSERT INTO currencies (code, name, active) VALUES (?, ?, true) ON DUPLICATE KEY UPDATE name = VALUES(name)",
        [code, CURRENCY_NAMES[code]],
      );
      const [[currency]] = await connection.query("SELECT id FROM currencies WHERE code = ? LIMIT 1", [code]);
      currencyIds.set(code, currency.id);
    }

    let insertedTransactions = 0;
    let insertedCustomers = 0;
    let enrichedCustomers = 0;
    const totals = {};

    const [existingHistoricalCustomers] = await connection.query(
      "SELECT id, cifNumber, fullName, identityType, identityNumber, historicalSourceKey FROM customers WHERE isHistorical = true",
    );
    const historicalBySourceKey = new Map(existingHistoricalCustomers
      .filter((customer) => customer.historicalSourceKey)
      .map((customer) => [customer.historicalSourceKey, customer]));
    let historicalByName = buildUniqueNameIndex(existingHistoricalCustomers, "fullName");
    const sourceByName = buildUniqueNameIndex(customerStaging, "full_name");

    for (const sourceCustomer of customerStaging) {
      const mapping = resolveHistoricalCustomer(sourceCustomer, historicalBySourceKey, historicalByName);
      const cifNumber = `HIST-KTP-${hash(sourceCustomer.identity_number).slice(0, 24).toUpperCase()}`;
      if (mapping.existingCustomer) {
        await connection.query(
          `UPDATE customers
           SET cifNumber = ?, fullName = ?, identityType = 'KTP', identityNumber = ?, address = ?,
               profileStatus = 'INACTIVE', riskLevel = 'LOW', isDemo = false, isHistorical = true,
               historicalSourceKey = ?
           WHERE id = ? AND isHistorical = true`,
          [cifNumber, sourceCustomer.full_name, sourceCustomer.identity_number, sourceCustomer.address, sourceCustomer.source_key, mapping.existingCustomer.id],
        );
        enrichedCustomers += 1;
      } else {
        await connection.query(
          `INSERT INTO customers (cifNumber, fullName, identityType, identityNumber, address, profileStatus, riskLevel, isDemo, isHistorical, historicalSourceKey, createdByUserId)
           VALUES (?, ?, 'KTP', ?, ?, 'INACTIVE', 'LOW', false, true, ?, ?)`,
          [cifNumber, sourceCustomer.full_name, sourceCustomer.identity_number, sourceCustomer.address, sourceCustomer.source_key, actor.id],
        );
        insertedCustomers += 1;
      }
    }

    const [refreshedHistoricalCustomers] = await connection.query(
      "SELECT id, cifNumber, fullName, identityType, identityNumber, historicalSourceKey FROM customers WHERE isHistorical = true",
    );
    historicalBySourceKey.clear();
    for (const customer of refreshedHistoricalCustomers) {
      if (customer.historicalSourceKey) historicalBySourceKey.set(customer.historicalSourceKey, customer);
    }
    historicalByName = buildUniqueNameIndex(refreshedHistoricalCustomers, "fullName");

    for (const row of staging) {
      const currencyId = currencyIds.get(row.currency);
      const transactionAt = asDate(row.transaction_date);
      const sourceKey = `HIST-TXN:${row.source_key}`;
      const customerKey = `HIST-CUSTOMER:${hash(row.customer_name || `UNKNOWN:${row.source_key}`)}`;
      const rateKey = `HIST-RATE:${row.currency}:${row.transaction_date}:${row.rate}`;
      const identityNumber = `HIST-${hash(customerKey)}`;
      const transactionNumber = `HIST-${hash(sourceKey).toUpperCase()}`;
      const foreignAmount = decimal(row.foreign_amount, "Nominal valas");
      const rate = decimal(row.rate, "Kurs");
      const rupiahAmount = decimal(row.rupiah_amount, "Nominal Rupiah");

      const sourceMatches = sourceByName.get(normalizeHistoricalCustomerName(row.customer_name)) ?? [];
      const sourceCustomer = sourceMatches.length === 1 ? sourceMatches[0] : null;
      const resolved = sourceCustomer
        ? resolveHistoricalCustomer(sourceCustomer, historicalBySourceKey, historicalByName)
        : { existingCustomer: historicalBySourceKey.get(customerKey) ?? null, matchType: "LEGACY_SOURCE" };
      let customer = resolved.existingCustomer;
      if (!customer) {
        await connection.query(
          `INSERT INTO customers (cifNumber, fullName, identityType, identityNumber, address, profileStatus, riskLevel, isDemo, isHistorical, historicalSourceKey, createdByUserId)
           VALUES (?, ?, 'OTHER', ?, 'Data historis impor; detail KYC sumber tidak tersedia.', 'INACTIVE', 'LOW', false, true, ?, ?)`,
          [`HIST-${hash(customerKey).slice(0, 28).toUpperCase()}`, row.customer_name || "Nasabah historis tanpa nama", identityNumber, customerKey, actor.id],
        );
        const [[createdCustomer]] = await connection.query("SELECT id, historicalSourceKey FROM customers WHERE historicalSourceKey = ? LIMIT 1", [customerKey]);
        customer = createdCustomer;
        historicalBySourceKey.set(customerKey, customer);
      }

      await connection.query(
        `INSERT INTO operational_rates (currencyId, referenceSnapshotId, quoteUnit, buyRate, sellRate, effectiveAt, status, proposedByUserId, notes, isDemo, isHistorical, historicalSourceKey)
         VALUES (?, NULL, '1.000000', ?, ?, ?, 'RETIRED', ?, '[HISTORICAL IMPORT] Source ledger rate', false, true, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [currencyId, rate, rate, transactionAt, actor.id, rateKey],
      );
      const [[operationalRate]] = await connection.query("SELECT id FROM operational_rates WHERE historicalSourceKey = ? LIMIT 1", [rateKey]);

      const [result] = await connection.query(
        `INSERT IGNORE INTO exchange_transactions
         (transactionNumber, transactionAt, operation, customerId, tellerUserId, currencyId, operationalRateId, foreignAmount, rateSnapshot, quoteUnitSnapshot, rupiahAmount, paymentMethod, status, requiresReview, reviewStatus, isDemo, isHistorical, historicalSourceKey)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '1.000000', ?, 'CASH', 'COMPLETED', false, 'NOT_REVIEWED', false, true, ?)`,
        [transactionNumber, transactionAt, row.operation, customer.id, actor.id, currencyId, operationalRate.id, foreignAmount, rate, rupiahAmount, sourceKey],
      );
      if (result.affectedRows === 1) insertedTransactions += 1;
      const totalKey = `${row.operation}:${row.currency}`;
      totals[totalKey] = addRupiah(totals[totalKey], rupiahAmount);
    }

    if (insertedTransactions > 0 || insertedCustomers > 0 || enrichedCustomers > 0) {
      await connection.query(
        "INSERT INTO audit_logs (actorUserId, action, entityType, entityId, afterState, reason, metadata) VALUES (?, 'HISTORICAL_LEDGER_IMPORTED', 'historical_import', 'historical-ledger-2026', ?, 'Import ledger historis tervalidasi', ?)",
        [actor.id, JSON.stringify({ insertedTransactions, insertedCustomers, enrichedCustomers }), JSON.stringify({ sourceFile: "historical_transactions.csv", customerSourceFile: "historical_customers.csv", totals })],
      );
    }
    await connection.commit();
    console.log(JSON.stringify({ mode: "apply", stagedRows: staging.length, stagedCustomers: customerStaging.length, insertedTransactions, insertedCustomers, enrichedCustomers, operationCurrencyTotals: totals }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
