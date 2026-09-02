/**
 * goAML XML report builder — scoped to LTKT (Laporan Transaksi Keuangan Tunai) for CASH-settled
 * transactions only, built strictly against goAMLSchema.xsd (report/transaction/t_party/
 * t_person_my_client complex types) as supplied by the user, not guessed.
 *
 * Deliberately Multiparty-only: a KUPVA BB cash exchange has no separate "from"/"to" institution to
 * report (the money changer itself is the implicit counterparty), matching the PPATK SIPENDAR FAQ's
 * own worked example for "transaksi penjualan/pembelian valas pada KUPVA". A BANK_TRANSFER-settled
 * bon needs the Biparty t_account structure (institution_code/swift, neither of which this system
 * captures for the counterparty bank today) and is out of scope until that data exists — see the
 * schema doc's control-table entry for this known gap.
 *
 * One goAML <transaction> is emitted per currency line of a bon (not one per bon), because
 * amount_local/foreign_currency are singular per party — a multi-currency bon is split into one
 * <transaction> per line, sharing the bon's transaction number with a "-L<n>" suffix so each
 * remains traceable back to the source bon.
 */

export type GoAmlGender = "MALE" | "FEMALE";
export type GoAmlAddressType = "RUMAH" | "KANTOR" | "DOMISILI" | "LAINNYA";

export type GoAmlCustomer = {
  fullName: string;
  dateOfBirth: string | Date;
  placeOfBirth: string;
  gender: GoAmlGender;
  nationality: string;
  address: string;
  addressType: GoAmlAddressType;
  addressCountry: string;
  addressProvince?: string | null;
  addressCity: string;
  addressDistrict?: string | null;
  addressPostalCode?: string | null;
  phoneNumber?: string | null;
  occupation: string;
  sourceOfFunds: string;
  npwp?: string | null;
  identityType: "KTP" | "PASSPORT" | "OTHER";
  identityNumber: string;
  identityExpiryDate?: string | Date | null;
};

export type GoAmlLtktLine = {
  /** e.g. "FX-20260901120000-000001-L1" — must be unique within the report file. */
  transactionNumber: string;
  dateTransaction: string | Date;
  operation: "BUY" | "SELL";
  /** Rupiah value of this specific line (not the bon total). */
  amountLocalIdr: string | number;
  currencyCode: string;
  foreignAmount: string | number;
  agreedRate: string | number;
  customer: GoAmlCustomer;
};

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

/** xs:dateTime, minInclusive 1900-01-01T00:00:00 — lexical form YYYY-MM-DDTHH:MM:SS (no timezone/millis, per the schema's own examples). */
export function formatSqlDate(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Tanggal tidak valid untuk goAML: ${String(value)}`);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/** sql_decimal — up to 13 fraction digits, plain decimal string (no thousands separators). */
export function formatSqlDecimal(value: string | number): string {
  const normalized = typeof value === "number" ? value.toString() : value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) throw new Error(`Nilai desimal tidak valid untuk goAML: ${normalized}`);
  return normalized;
}

/** goAML gender_type is "M"/"F", not "MALE"/"FEMALE". */
export function toGoAmlGender(gender: GoAmlGender): "M" | "F" {
  return gender === "MALE" ? "M" : "F";
}

/**
 * goAML contact_type (address_type) only has D/K/R (Domisili/Kantor/Rumah) — there is no "Lainnya"
 * code. A customer address typed LAINNYA falls back to "R" (Rumah); this is a deliberate, documented
 * approximation, not a silent guess, because the schema simply has no 4th option.
 */
export function toGoAmlContactType(addressType: GoAmlAddressType): "D" | "K" | "R" {
  if (addressType === "DOMISILI") return "D";
  if (addressType === "KANTOR") return "K";
  return "R";
}

/** transmode_code for a KUPVA BB currency exchange: PBVAL = Pembelian Valuta Asing (BUY), PJVAL = Penjualan Valuta Asing (SELL). */
export function toGoAmlTransmodeCode(operation: "BUY" | "SELL"): "PBVAL" | "PJVAL" {
  return operation === "BUY" ? "PBVAL" : "PJVAL";
}

/**
 * Direction of an LTKT report follows the Rupiah cash leg at the reporting institution, not the
 * customer's perspective: BUY pays Rupiah OUT to the customer (kas keluar, LTKTK); SELL receives
 * Rupiah IN from the customer (kas masuk, LTKTM).
 */
export function toGoAmlLtktReportCode(operation: "BUY" | "SELL"): "LTKTK" | "LTKTM" {
  return operation === "BUY" ? "LTKTK" : "LTKTM";
}

/** Strips non-digits and returns the NPWP only if it forms a valid 15 or 16 digit number — goAML's tax_number pattern requires exactly that, so anything else is omitted rather than submitted malformed. */
export function normalizeNpwpForGoAml(npwp: string | null | undefined): string | null {
  if (!npwp) return null;
  const digits = npwp.replace(/\D/g, "");
  return digits.length === 15 || digits.length === 16 ? digits : null;
}

/**
 * goAML's identifier_type enum has no generic "other document" code (only KITAP/KITAS/KTM/KTP/PAS/
 * SIM/SUKET) — an identityType of "OTHER" therefore has no honest mapping, so the identification
 * block is omitted entirely for those customers rather than guessed at (e.g. forced into SUKET).
 */
function buildIdentificationXml(customer: GoAmlCustomer): string {
  if (customer.identityType === "OTHER") return "";
  const type = customer.identityType === "KTP" ? "KTP" : "PAS";
  // KTP is exclusively Indonesian-issued by definition; a passport's issuing country isn't captured
  // separately today, so nationality1 is the best available stand-in — documented, not silent.
  const issueCountry = customer.identityType === "KTP" ? "ID" : customer.nationality;
  return [
    "<identification>",
    `<type>${type}</type>`,
    tag("number", customer.identityNumber),
    ...(customer.identityExpiryDate ? [`<expiry_date>${formatSqlDate(customer.identityExpiryDate)}</expiry_date>`] : []),
    `<issue_country>${escapeXml(issueCountry)}</issue_country>`,
    "</identification>",
  ].join("");
}

export function buildPersonMyClientXml(customer: GoAmlCustomer): string {
  const npwpDigits = normalizeNpwpForGoAml(customer.npwp);
  const phoneDigits = customer.phoneNumber?.replace(/\D/g, "") ?? "";
  const phones = phoneDigits
    ? `<phones><phone><tph_contact_type>R</tph_contact_type><tph_communication_type>MOB</tph_communication_type><tph_number>${phoneDigits}</tph_number></phone></phones>`
    : "<phones></phones>";
  const address = [
    `<address_type>${toGoAmlContactType(customer.addressType)}</address_type>`,
    tag("address", customer.address),
    tag("town", customer.addressDistrict),
    tag("city", customer.addressCity),
    tag("zip", customer.addressPostalCode),
    `<country_code>${escapeXml(customer.addressCountry)}</country_code>`,
    tag("state", customer.addressProvince),
  ].join("");
  // Element order below follows t_person_my_client's xs:sequence exactly — XSD sequences are
  // order-sensitive, so this is not stylistic: gender, last_name, birthdate, birth_place,
  // nationality1, residence, phones, addresses, occupation, [identification]*, tax_number,
  // tax_reg_number, source_of_wealth.
  return [
    "<person_my_client>",
    `<gender>${toGoAmlGender(customer.gender)}</gender>`,
    tag("last_name", customer.fullName),
    `<birthdate>${formatSqlDate(customer.dateOfBirth)}</birthdate>`,
    tag("birth_place", customer.placeOfBirth),
    `<nationality1>${escapeXml(customer.nationality)}</nationality1>`,
    `<residence>${escapeXml(customer.addressCountry)}</residence>`,
    phones,
    `<addresses><address>${address}</address></addresses>`,
    tag("occupation", customer.occupation),
    buildIdentificationXml(customer),
    ...(npwpDigits ? [tag("tax_number", npwpDigits), "<tax_reg_number>Y</tax_reg_number>"] : ["<tax_reg_number>T</tax_reg_number>"]),
    tag("source_of_wealth", customer.sourceOfFunds),
    "</person_my_client>",
  ].join("");
}

export function buildLtktTransactionXml(line: GoAmlLtktLine): string {
  const party = [
    "<party>",
    "<role>PJS</role>",
    buildPersonMyClientXml(line.customer),
    "<funds_code>UT</funds_code>",
    "<foreign_currency>",
    `<foreign_currency_code>${escapeXml(line.currencyCode)}</foreign_currency_code>`,
    `<foreign_amount>${formatSqlDecimal(line.foreignAmount)}</foreign_amount>`,
    `<foreign_exchange_rate>${formatSqlDecimal(line.agreedRate)}</foreign_exchange_rate>`,
    "</foreign_currency>",
    "</party>",
  ].join("");
  return [
    "<transaction>",
    tag("transactionnumber", line.transactionNumber),
    `<date_transaction>${formatSqlDate(line.dateTransaction)}</date_transaction>`,
    `<transmode_code>${toGoAmlTransmodeCode(line.operation)}</transmode_code>`,
    `<amount_local>${formatSqlDecimal(line.amountLocalIdr)}</amount_local>`,
    `<involved_parties>${party}</involved_parties>`,
    "</transaction>",
  ].join("");
}

export function buildGoAmlLtktReportXml(input: {
  rentityId: number;
  reportCode: "LTKTK" | "LTKTM";
  reportDate: Date;
  currencyCodeLocal: string;
  reportingUserCode: string;
  lines: GoAmlLtktLine[];
}): string {
  const transactions = input.lines.map(buildLtktTransactionXml).join("");
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<report>",
    `<rentity_id>${input.rentityId}</rentity_id>`,
    "<submission_code>E</submission_code>",
    `<report_code>${input.reportCode}</report_code>`,
    `<report_date>${formatSqlDate(input.reportDate)}</report_date>`,
    `<currency_code_local>${escapeXml(input.currencyCodeLocal)}</currency_code_local>`,
    tag("reporting_user_code", input.reportingUserCode),
    transactions,
    "</report>",
  ];
  return body.join("");
}
