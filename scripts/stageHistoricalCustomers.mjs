import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeHistoricalCustomerName } from "./historicalCustomerMapping.mjs";

const SOURCE_FILE = "/home/ubuntu/ptibv_document_review/pdf_text/Data Konsumen Valass.txt";
const TRANSACTION_FILE = "/home/ubuntu/ptibv_document_review/staging/historical_transactions.csv";
const OUTPUT_DIR = "/home/ubuntu/ptibv_document_review/staging";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "historical_customers.csv");
const REPORT_FILE = path.join(OUTPUT_DIR, "historical_customers_validation.md");

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
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
  return values.map((valuesRow) => Object.fromEntries(header.map((key, index) => [key, (valuesRow[index] ?? "").trim()])));
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  return /[",\n\r]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function parseCustomers(text) {
  const parsed = [];
  const issues = [];
  const seenIdentityNumbers = new Set();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\f/g, " ").trim();
    if (!/^\d{1,2}\s/.test(line)) continue;
    const match = line.match(/^(\d{1,2})\s+(.+?)\s+(3[0-9\-\s]{10,})\s+(.+)$/);
    if (!match) {
      issues.push(`Baris konsumen tidak dapat dipetakan: ${stableHash(line)}`);
      continue;
    }
    const [, sourceRow, fullName, rawIdentityNumber, address] = match;
    const identityNumber = rawIdentityNumber.replace(/[^0-9]/g, "");
    const normalizedName = normalizeHistoricalCustomerName(fullName);
    if (identityNumber.length < 12 || !normalizedName || !address.trim()) {
      issues.push(`Data wajib tidak lengkap pada baris sumber ${sourceRow}`);
      continue;
    }
    if (seenIdentityNumbers.has(identityNumber)) {
      issues.push(`Nomor identitas duplikat pada baris sumber ${sourceRow}`);
      continue;
    }
    seenIdentityNumbers.add(identityNumber);
    parsed.push({
      source_key: `HIST-CUSTOMER-KTP:${identityNumber}`,
      source_row: sourceRow,
      full_name: fullName.trim(),
      identity_type: "KTP",
      identity_number: identityNumber,
      address: address.trim(),
      normalized_name: normalizedName,
    });
  }
  return { parsed, issues };
}

async function main() {
  const [customerText, transactionText] = await Promise.all([
    readFile(SOURCE_FILE, "utf8"),
    readFile(TRANSACTION_FILE, "utf8"),
  ]);
  const { parsed: customers, issues } = parseCustomers(customerText);
  const transactions = parseCsv(transactionText);
  const transactionNames = new Set(transactions.map((row) => normalizeHistoricalCustomerName(row.customer_name || "")).filter(Boolean));
  const nameCounts = new Map();
  for (const customer of customers) {
    nameCounts.set(customer.normalized_name, (nameCounts.get(customer.normalized_name) ?? 0) + 1);
  }
  const duplicateNormalizedNames = [...nameCounts.values()].filter((count) => count > 1).length;
  const matchedNames = new Set(customers
    .filter((customer) => nameCounts.get(customer.normalized_name) === 1 && transactionNames.has(customer.normalized_name))
    .map((customer) => customer.normalized_name));
  const outputHeader = ["source_key", "source_row", "full_name", "identity_type", "identity_number", "address", "normalized_name"];

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    OUTPUT_FILE,
    [outputHeader.join(","), ...customers.map((customer) => outputHeader.map((key) => csvEscape(customer[key])).join(","))].join("\n") + "\n",
    "utf8",
  );
  const unmatchedLedgerNames = [...transactionNames].filter((name) => !matchedNames.has(name));
  await writeFile(
    REPORT_FILE,
    [
      "# Validasi Staging Nasabah Historis",
      "",
      "Laporan ini sengaja tidak mencantumkan nama, alamat, atau nomor identitas.",
      "",
      `- Baris konsumen valid: ${customers.length}`,
      `- Baris konsumen ditolak: ${issues.length}`,
      `- Nama nasabah yang terduplikasi setelah normalisasi: ${duplicateNormalizedNames}`,
      `- Nasabah sumber dengan kecocokan nama ledger: ${matchedNames.size}`,
      `- Nama pada ledger yang belum cocok dengan daftar konsumen: ${unmatchedLedgerNames.length}`,
      `- Baris transaksi historis yang diperiksa: ${transactions.length}`,
      "",
      "## Pengecualian parsing",
      "",
      ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- Tidak ada."]),
    ].join("\n") + "\n",
    "utf8",
  );
  console.log(JSON.stringify({
    stagedCustomers: customers.length,
    rejectedCustomers: issues.length,
    duplicateNormalizedNames,
    ledgerNameMatches: matchedNames.size,
    unmatchedLedgerNames: unmatchedLedgerNames.length,
    customerOutput: OUTPUT_FILE,
    validationReport: REPORT_FILE,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
