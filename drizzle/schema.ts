import {
  boolean,
  date,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const staffRoles = ["STAFF", "ADMIN", "CONTROLLER", "SHAREHOLDER"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Historical identity key retained for audit continuity; internal accounts use `local:<username>`. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", staffRoles).default("STAFF").notNull(),
  accountStatus: mysqlEnum("accountStatus", ["ACTIVE", "SUSPENDED"]).default("ACTIVE").notNull(),
  mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
  sessionVersion: int("sessionVersion").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const currencies = mysqlTable("currencies", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 3 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("currencies_code_uq").on(table.code)]);

/** Immutable copy of an official Bank Indonesia transaction-rate retrieval. */
export const rateReferenceSnapshots = mysqlTable("rate_reference_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  currencyId: int("currencyId").notNull(),
  referenceDate: date("referenceDate").notNull(),
  source: mysqlEnum("source", ["BI_TRANSACTION_RATES"]).default("BI_TRANSACTION_RATES").notNull(),
  /** BI may quote a rate per 100 units, e.g. JPY; retain the original quote basis. */
  quoteUnit: decimal("quoteUnit", { precision: 18, scale: 6 }).default("1.000000").notNull(),
  buyRate: decimal("buyRate", { precision: 24, scale: 6 }).notNull(),
  sellRate: decimal("sellRate", { precision: 24, scale: 6 }).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 500 }).notNull(),
  fetchedAt: datetime("fetchedAt").notNull(),
  payloadHash: varchar("payloadHash", { length: 128 }).notNull(),
  /** Training-only snapshots never participate in live rate proposals. */
  isDemo: boolean("isDemo").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("rate_reference_currency_date_source_uq").on(table.currencyId, table.referenceDate, table.source),
  index("rate_reference_date_idx").on(table.referenceDate),
]);

/** Operational price versions are append-only: never edit a rate that may have been used. */
export const operationalRates = mysqlTable("operational_rates", {
  id: int("id").autoincrement().primaryKey(),
  currencyId: int("currencyId").notNull(),
  referenceSnapshotId: int("referenceSnapshotId"),
  /** The denominator associated with buyRate and sellRate. */
  quoteUnit: decimal("quoteUnit", { precision: 18, scale: 6 }).default("1.000000").notNull(),
  buyRate: decimal("buyRate", { precision: 24, scale: 6 }).notNull(),
  sellRate: decimal("sellRate", { precision: 24, scale: 6 }).notNull(),
  effectiveAt: datetime("effectiveAt").notNull(),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "RETIRED"]).default("DRAFT").notNull(),
  proposedByUserId: int("proposedByUserId").notNull(),
  approvedByUserId: int("approvedByUserId"),
  approvedAt: datetime("approvedAt"),
  notes: text("notes"),
  /** Training-only rate versions must never become an operational live rate. */
  isDemo: boolean("isDemo").default(false).notNull(),
  /** Archived import rate; never eligible for a live transaction or public display. */
  isHistorical: boolean("isHistorical").default(false).notNull(),
  historicalSourceKey: varchar("historicalSourceKey", { length: 180 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("operational_rate_currency_status_idx").on(table.currencyId, table.status),
  index("operational_rate_live_status_idx").on(table.isDemo, table.isHistorical, table.status, table.currencyId),
  index("operational_rate_effective_idx").on(table.effectiveAt),
]);

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  cifNumber: varchar("cifNumber", { length: 40 }).notNull(),
  fullName: varchar("fullName", { length: 200 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 40 }),
  identityType: mysqlEnum("identityType", ["KTP", "PASSPORT", "OTHER"]).notNull(),
  identityNumber: varchar("identityNumber", { length: 80 }).notNull(),
  identityExpiryDate: date("identityExpiryDate"),
  placeOfBirth: varchar("placeOfBirth", { length: 120 }),
  dateOfBirth: date("dateOfBirth"),
  address: text("address").notNull(),
  /** Structured address fields required by goAML's t_address (address_type/city/country_code mandatory; province/district/postal optional) — the free-text `address` column above remains the street-level line. */
  addressType: mysqlEnum("addressType", ["RUMAH", "KANTOR", "DOMISILI", "LAINNYA"]),
  addressCountry: varchar("addressCountry", { length: 2 }),
  addressProvince: varchar("addressProvince", { length: 120 }),
  addressCity: varchar("addressCity", { length: 120 }),
  addressDistrict: varchar("addressDistrict", { length: 120 }),
  addressPostalCode: varchar("addressPostalCode", { length: 20 }),
  /** ISO 3166-1 alpha-2 (mis. "ID") — kewarganegaraan, wajib untuk pelaporan goAML (t_person_my_client.nationality1), beda dari negara alamat/domisili. */
  nationality: varchar("nationality", { length: 2 }),
  /** NPWP nasabah (bukan milik perusahaan) — opsional (banyak individu tak wajib NPWP), tapi wajib diisi bila ada karena goAML membutuhkan tax_reg_number (Y/T) yang diturunkan dari kolom ini. */
  npwp: varchar("npwp", { length: 20 }),
  gender: mysqlEnum("gender", ["MALE", "FEMALE"]),
  occupation: varchar("occupation", { length: 160 }),
  sourceOfFunds: text("sourceOfFunds"),
  transactionPurpose: text("transactionPurpose"),
  /** Nasabah ini hanya bertindak atas nama pihak lain (mis. supir disuruh bos); identitas pemilik manfaat sebenarnya wajib dicatat terpisah. */
  hasBeneficialOwner: boolean("hasBeneficialOwner").default(false).notNull(),
  /** Referensi ke baris customers lain yang menyimpan identitas lengkap pemilik manfaat. */
  beneficialOwnerCustomerId: int("beneficialOwnerCustomerId"),
  pepStatus: mysqlEnum("pepStatus", ["NONE", "SELF", "RELATED"]).default("NONE").notNull(),
  /** Wajib diisi ketika pepStatus bukan NONE: jabatan/nama pejabat dan jenis hubungan bila RELATED. */
  pepDetails: text("pepDetails"),
  /** Kecocokan dengan Daftar Terduga Teroris dan Organisasi Teroris / Daftar Pendanaan Proliferasi Senjata Pemusnah Massal. */
  dttotPpsdmMatch: boolean("dttotPpsdmMatch").default(false).notNull(),
  dttotPpsdmNotes: text("dttotPpsdmNotes"),
  profileStatus: mysqlEnum("profileStatus", ["ACTIVE", "RESTRICTED", "INACTIVE"]).default("ACTIVE").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["LOW", "MEDIUM", "HIGH"]).default("LOW").notNull(),
  riskNotes: text("riskNotes"),
  /**
   * Profil transaksi yang dinyatakan nasabah sendiri pada borang — perkiraan nilai Rupiah sebulan,
   * perkiraan banyaknya transaksi sebulan, dan mata uang yang diharapkan.
   *
   * Ketiganya nullable dan itu disengaja: seluruh nasabah yang sudah ada belum pernah
   * mendeklarasikan apa pun. Nasabah tanpa deklarasi tidak dapat menyimpang — ia muncul di worklist
   * pemantauan dengan alasan PROFIL_BELUM_DIDEKLARASIKAN. Kekosongan itu temuannya sendiri, dan
   * nilai bawaan nol akan mengarang deklarasi atas nama nasabah sekaligus membuat ambangnya nol.
   *
   * Ini pernyataan nasabah, bukan batas yang ditegakkan sistem: melewatinya menyalakan peninjauan,
   * tidak pernah memblokir transaksi.
   */
  declaredMonthlyValueIdr: decimal("declaredMonthlyValueIdr", { precision: 24, scale: 2 }),
  declaredMonthlyCount: int("declaredMonthlyCount"),
  /** Kode mata uang yang diharapkan, misalnya ["USD","SGD"]. */
  declaredCurrencies: json("declaredCurrencies").$type<string[]>(),
  /** Training-only customer profiles are unavailable to the live transaction flow. */
  isDemo: boolean("isDemo").default(false).notNull(),
  /** Limited historical ledger counterparty; never selectable for a new live transaction. */
  isHistorical: boolean("isHistorical").default(false).notNull(),
  historicalSourceKey: varchar("historicalSourceKey", { length: 180 }).unique(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("customers_cif_uq").on(table.cifNumber),
  uniqueIndex("customers_identity_uq").on(table.identityType, table.identityNumber),
  index("customers_live_status_idx").on(table.isDemo, table.isHistorical, table.profileStatus),
  index("customers_profile_status_idx").on(table.profileStatus),
  index("customers_beneficial_owner_idx").on(table.beneficialOwnerCustomerId),
]);

/**
 * Status bon yang ikut dihitung sebagai aktivitas nasabah.
 *
 * Transaksi batal tidak menambah akumulasi; sisanya dihitung meski belum selesai, karena kewajiban
 * underlying muncul saat transaksi dibuat, bukan saat disetujui.
 *
 * Satu daftar untuk seluruh pembacanya — akumulasi harian dan bulanan pada jalur transaksi
 * (`server/operations.ts`) maupun pemantauan profil (`server/customerProfileMonitoring.ts`). Dua
 * definisi "aktivitas" yang berbeda pendapat adalah kekeliruan yang tidak terlihat dari layar mana
 * pun, jadi daftarnya tidak boleh disalin: ubah di sini, berlaku di semuanya.
 *
 * Bukan daftar yang sama dengan penyaringan pelaporan LKU, yang hanya menghitung bon COMPLETED.
 */
export const ACCUMULATED_TRANSACTION_STATUSES = ["DRAFT", "PENDING_REVIEW", "APPROVED", "RETURNED", "COMPLETED"] as const;

export const exchangeTransactions = mysqlTable("exchange_transactions", {
  id: int("id").autoincrement().primaryKey(),
  /** System-generated audit id (FX-YYYYMMDDHHMMSS-XXXXXX), always set, never edited by staff. */
  transactionNumber: varchar("transactionNumber", { length: 50 }).notNull(),
  /** Physical receipt-book number, typed manually by the teller. Jual and Beli use separate books, so the same number can exist once per operation (see unique index below). Null on bons created before this field existed. */
  receiptNumber: varchar("receiptNumber", { length: 80 }),
  /** Which company bank account the Rupiah leg moved through — required when paymentMethod is BANK_TRANSFER, null for CASH/OTHER and for bons predating account tracking. */
  bankAccountId: int("bankAccountId"),
  /** The other side of the transfer: for JUAL, whose account the money came FROM; for BELI, whose account it went TO. Always the customer's own bank details unless counterpartyNameMismatchReason explains why not. Required together whenever paymentMethod is BANK_TRANSFER. */
  counterpartyBankName: varchar("counterpartyBankName", { length: 120 }),
  counterpartyAccountNumber: varchar("counterpartyAccountNumber", { length: 60 }),
  counterpartyAccountHolderName: varchar("counterpartyAccountHolderName", { length: 160 }),
  /** Required only when counterpartyAccountHolderName doesn't match the customer's own name — printed on the kwitansi automatically so the discrepancy is never silent. */
  counterpartyNameMismatchReason: text("counterpartyNameMismatchReason"),
  transactionAt: datetime("transactionAt").notNull(),
  operation: mysqlEnum("operation", ["BUY", "SELL"]).notNull(),
  customerId: int("customerId").notNull(),
  tellerUserId: int("tellerUserId").notNull(),
  /** Single-currency legacy fields. Null on multi-line bons (see exchangeTransactionLines) created after this column set was loosened to nullable; still populated as-is on older single-currency bons. */
  currencyId: int("currencyId"),
  operationalRateId: int("operationalRateId"),
  foreignAmount: decimal("foreignAmount", { precision: 24, scale: 6 }),
  /** Immutable numerical snapshot copied from the selected operational rate. This is the price actually applied to the deal — it may equal the reference rate below, or be a negotiated/rounded price the teller entered. */
  rateSnapshot: decimal("rateSnapshot", { precision: 24, scale: 6 }),
  /** Immutable quote unit copied with the rate snapshot, e.g. 100 for JPY. */
  quoteUnitSnapshot: decimal("quoteUnitSnapshot", { precision: 18, scale: 6 }),
  /** The official active operational rate at the moment of the deal, kept for audit even when the teller negotiated a different rateSnapshot. Never used to activate or approve rates — reference only. */
  referenceRateSnapshot: decimal("referenceRateSnapshot", { precision: 24, scale: 6 }),
  /** Optional note explaining why the applied rate differs from the reference rate (e.g. rounding, negotiation). */
  dealNotes: varchar("dealNotes", { length: 255 }),
  /** Immutable full-precision result in Rupiah, retained as decimal rather than float. On a multi-line bon this is the sum of every exchangeTransactionLines row, not a single conversion. */
  rupiahAmount: decimal("rupiahAmount", { precision: 24, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["CASH", "BANK_TRANSFER", "OTHER"]).notNull(),
  paymentReference: varchar("paymentReference", { length: 160 }),
  /** Immutable KYC values rendered on the bon even if a profile is later updated. */
  customerFullNameSnapshot: varchar("customerFullNameSnapshot", { length: 200 }),
  customerIdentityTypeSnapshot: varchar("customerIdentityTypeSnapshot", { length: 20 }),
  customerIdentityNumberSnapshot: varchar("customerIdentityNumberSnapshot", { length: 80 }),
  customerPhoneSnapshot: varchar("customerPhoneSnapshot", { length: 40 }),
  customerAddressSnapshot: text("customerAddressSnapshot"),
  customerOccupationSnapshot: varchar("customerOccupationSnapshot", { length: 160 }),
  sourceOfFundsSnapshot: text("sourceOfFundsSnapshot"),
  transactionPurposeSnapshot: text("transactionPurposeSnapshot"),
  customerActingAs: mysqlEnum("customerActingAs", ["SELF", "REPRESENTATIVE"]).default("SELF").notNull(),
  /** Registered customer row acting as representative/kuasa; required when customerActingAs is REPRESENTATIVE. */
  representativeCustomerId: int("representativeCustomerId"),
  /** Immutable snapshot copied from the representative customer at deal time. */
  representativeName: varchar("representativeName", { length: 200 }),
  representativeIdentityNumber: varchar("representativeIdentityNumber", { length: 80 }),
  underlyingRequired: boolean("underlyingRequired").default(false).notNull(),
  underlyingReference: varchar("underlyingReference", { length: 160 }),
  underlyingNotes: text("underlyingNotes"),
  /** Separate from underlyingNotes — the teller's justification for why this specific deal legitimately reaches the >=10,000 USD-equivalent threshold. Required whenever that threshold is met; kept distinct because underlyingNotes describes the supporting documents, this describes the business reason. */
  thresholdReason: text("thresholdReason"),
  /** TKM = Transaksi Keuangan Mencurigakan (suspicious transaction) per PPATK indicators — internal-only flag, never printed on the kwitansi or included in exports that can leave the office (tipping-off is prohibited by law). */
  isSuspiciousTransaction: boolean("isSuspiciousTransaction").default(false).notNull(),
  /** Array of indicator codes from shared/suspiciousTransactionIndicators.ts, e.g. ["MENOLAK_IDENTIFIKASI"]. Required (min 1) when isSuspiciousTransaction is true. */
  suspiciousIndicators: json("suspiciousIndicators").$type<string[]>(),
  suspiciousNotes: text("suspiciousNotes"),
  status: mysqlEnum("status", ["DRAFT", "PENDING_REVIEW", "APPROVED", "COMPLETED", "RETURNED", "CANCELLED"]).default("DRAFT").notNull(),
  requiresReview: boolean("requiresReview").default(false).notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["NOT_REVIEWED", "NEEDS_REVIEW", "REVIEWED", "ESCALATED"]).default("NOT_REVIEWED").notNull(),
  reviewReason: text("reviewReason"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: datetime("reviewedAt"),
  reviewerNotes: text("reviewerNotes"),
  approvedByUserId: int("approvedByUserId"),
  approvedAt: datetime("approvedAt"),
  cancelledByUserId: int("cancelledByUserId"),
  cancelledAt: datetime("cancelledAt"),
  cancellationReason: text("cancellationReason"),
  /** Training-only transactions are excluded from live operations and reports. */
  isDemo: boolean("isDemo").default(false).notNull(),
  /** Imported ledger transaction excluded from live workflow, balances, and compliance queues. */
  isHistorical: boolean("isHistorical").default(false).notNull(),
  historicalSourceKey: varchar("historicalSourceKey", { length: 180 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("exchange_transactions_number_uq").on(table.transactionNumber),
  /** Physical receipt books are separate per operation, so "receiptNumber 1" can exist once for BUY and once for SELL. MySQL allows unlimited NULLs through a unique index, so pre-migration bons with no receiptNumber never collide. */
  uniqueIndex("exchange_transactions_receipt_number_uq").on(table.operation, table.receiptNumber),
  index("exchange_transactions_date_idx").on(table.transactionAt),
  index("exchange_transactions_live_date_idx").on(table.isDemo, table.isHistorical, table.transactionAt),
  index("exchange_transactions_status_idx").on(table.status, table.reviewStatus),
  index("exchange_transactions_customer_idx").on(table.customerId),
  index("exchange_transactions_representative_idx").on(table.representativeCustomerId),
]);

/** One row per currency/price-tier on a bon — mirrors the printed kwitansi's table (NO. / MATA UANG / JUMLAH / KURS / TOTAL). The same currency can appear on more than one line when denominations within it were priced differently (e.g. large notes vs small notes). */
export const exchangeTransactionLines = mysqlTable("exchange_transaction_lines", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(),
  /** 1-based row order as printed on the kwitansi. */
  lineNumber: int("lineNumber").notNull(),
  currencyId: int("currencyId").notNull(),
  /** Optional reference only — the active operational rate at the time, if the currency happened to have one. Never the source of the price. */
  operationalRateId: int("operationalRateId"),
  referenceRateSnapshot: decimal("referenceRateSnapshot", { precision: 24, scale: 6 }),
  quoteUnit: decimal("quoteUnit", { precision: 18, scale: 6 }).default("1.000000").notNull(),
  /** Price the teller typed in for this line/price-tier, independent of any operational rate. */
  agreedRate: decimal("agreedRate", { precision: 24, scale: 6 }).notNull(),
  foreignAmount: decimal("foreignAmount", { precision: 24, scale: 6 }).notNull(),
  rupiahAmount: decimal("rupiahAmount", { precision: 24, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("exchange_transaction_lines_transaction_idx").on(table.transactionId),
]);

/** Physical denomination breakdown captured at bon creation time, so BI stock/cash records always reflect the actual notes/coins handled per deal. */
export const exchangeTransactionDenominationEntries = mysqlTable("exchange_transaction_denomination_entries", {
  id: int("id").autoincrement().primaryKey(),
  /** Set on every row. On a multi-line bon this is the parent bon (for convenience queries); the specific price-tier is transactionLineId below. */
  transactionId: int("transactionId").notNull(),
  /** Which price-tier line this breakdown belongs to. Null on rows written before multi-line bons existed. */
  transactionLineId: int("transactionLineId"),
  /** Face value of one note/coin in the transaction currency, e.g. 100.000000 for a USD 100 bill. */
  denominationValue: decimal("denominationValue", { precision: 24, scale: 6 }).notNull(),
  quantity: int("quantity").notNull(),
  /** denominationValue * quantity, stored redundantly to make reconciliation queries cheap. */
  lineTotal: decimal("lineTotal", { precision: 24, scale: 6 }).notNull(),
  /** Price the teller typed in for THIS specific denomination group (e.g. USD 100s priced differently from USD 10s in the same deal). Required for transaction bons going forward; null on cash-movement denomination rows (those have no price concept) and on bons written before per-denomination pricing existed. */
  agreedRate: decimal("agreedRate", { precision: 24, scale: 6 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("exchange_transaction_denomination_entries_transaction_idx").on(table.transactionId),
  index("exchange_transaction_denomination_entries_line_idx").on(table.transactionLineId),
]);

/** The other side of a cash exchange: physical Rupiah notes handed over or received, for CASH-settled bons. A money-changer deal always moves two currencies — the foreign leg lives in exchangeTransactionDenominationEntries, this is the Rupiah leg. One set of rows per bon (not per foreign-currency line), because payment is settled once for the whole bon. */
export const exchangeTransactionPaymentDenominations = mysqlTable("exchange_transaction_payment_denominations", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(),
  /** The settlement currency — IDR in practice, stored explicitly rather than hardcoded for correctness. */
  currencyId: int("currencyId").notNull(),
  denominationValue: decimal("denominationValue", { precision: 24, scale: 6 }).notNull(),
  quantity: int("quantity").notNull(),
  lineTotal: decimal("lineTotal", { precision: 24, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("exchange_transaction_payment_denominations_transaction_idx").on(table.transactionId),
]);

/**
 * Private KYC and transaction-supporting documents. File bytes live in managed
 * object storage; this table retains authorization, audit, and retrieval metadata.
 */
export const operationalDocuments = mysqlTable("operational_documents", {
  id: int("id").autoincrement().primaryKey(),
  ownerType: mysqlEnum("ownerType", ["CUSTOMER", "TRANSACTION", "COMPANY", "EXPENSE"]).notNull(),
  /** UNDERLYING is kept only for bons predating the three-document split — new transactions requiring underlying use the three specific types instead (Formulir Underlying, Surat Pernyataan, Invoice), all required together. */
  documentType: mysqlEnum("documentType", ["KTP_PHOTO", "UNDERLYING", "UNDERLYING_FORM", "UNDERLYING_STATEMENT", "UNDERLYING_INVOICE", "COMPANY_LOGO", "LICENSE_CERTIFICATE", "LICENSE_ATTACHMENT", "EXPENSE_RECEIPT"]).notNull(),
  customerId: int("customerId"),
  transactionId: int("transactionId"),
  expenseId: int("expenseId"),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  originalFileName: varchar("originalFileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  byteSize: int("byteSize").notNull(),
  documentReference: varchar("documentReference", { length: 160 }),
  notes: text("notes"),
  uploadedByUserId: int("uploadedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("operational_documents_storage_key_uq").on(table.storageKey),
  index("operational_documents_customer_idx").on(table.customerId, table.createdAt),
  index("operational_documents_transaction_idx").on(table.transactionId, table.createdAt),
  index("operational_documents_expense_idx").on(table.expenseId, table.createdAt),
  index("operational_documents_owner_type_idx").on(table.ownerType, table.documentType),
]);

export const expenseCategories = ["SEWA", "GAJI", "UTILITAS", "PERLENGKAPAN_OPERASIONAL", "PEMASARAN", "PEMELIHARAAN", "IZIN_DAN_PAJAK", "LAINNYA"] as const;

/**
 * Simple categorized operational expense log — day-to-day outlet costs (rent, payroll, utilities,
 * etc.), deliberately kept separate from the FX transaction/cash-denomination system: an expense
 * entry never touches exchangeTransactions, cashBalances, or bankAccounts. It is a record-keeping
 * log for internal financial reporting, not a cash-movement ledger. Entries are append-only (no
 * edit/delete) for audit integrity; a wrong entry is corrected with an offsetting entry, same
 * convention as other financial records in this system.
 */
export const operationalExpenses = mysqlTable("operational_expenses", {
  id: int("id").autoincrement().primaryKey(),
  expenseDate: date("expenseDate").notNull(),
  category: mysqlEnum("category", expenseCategories).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  notes: text("notes"),
  recordedByUserId: int("recordedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("operational_expenses_date_idx").on(table.expenseDate),
  index("operational_expenses_category_idx").on(table.category, table.expenseDate),
]);

/**
 * Reference data for DTTOT/PPPSM screening — imported from PPATK/DK PBB public sanctions lists
 * (Daftar Terduga Teroris dan Organisasi Teroris; Daftar Pendanaan Proliferasi Senjata Pemusnah
 * Massal), never customer or transaction data. `sourceLabel` distinguishes independent PPPSM
 * sub-lists (e.g. "DPRK", "IR") that each get imported/replaced separately — DTTOT has none
 * (single unified list, `sourceLabel` is null and the whole `listType` is replaced together).
 * A fresh import for the same (listType, sourceLabel) scope fully replaces prior rows in that
 * scope; it never merges, so a partial/older re-upload can't leave stale entries mixed in.
 */
export const sanctionsWatchlistEntries = mysqlTable("sanctions_watchlist_entries", {
  id: int("id").autoincrement().primaryKey(),
  listType: mysqlEnum("listType", ["DTTOT", "PPPSM"]).notNull(),
  sourceLabel: varchar("sourceLabel", { length: 60 }),
  entityType: mysqlEnum("entityType", ["INDIVIDUAL", "ENTITY"]).notNull(),
  referenceCode: varchar("referenceCode", { length: 60 }),
  fullName: varchar("fullName", { length: 500 }).notNull(),
  /** Newline-separated known aliases, parsed from dedicated "Alias N" columns (PPPSM) or split out of the name field itself (DTTOT's "X alias Y alias Z" convention). */
  aliases: text("aliases"),
  dateOfBirth: varchar("dateOfBirth", { length: 255 }),
  placeOfBirth: varchar("placeOfBirth", { length: 255 }),
  nationality: varchar("nationality", { length: 255 }),
  identityNumbers: text("identityNumbers"),
  address: text("address"),
  description: text("description"),
  sourceFileName: varchar("sourceFileName", { length: 255 }).notNull(),
  importedByUserId: int("importedByUserId").notNull(),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
}, (table) => [
  index("sanctions_watchlist_entries_scope_idx").on(table.listType, table.sourceLabel),
  index("sanctions_watchlist_entries_name_idx").on(table.fullName),
]);

/** Every review/approval/return decision becomes a standalone immutable record. */
export const transactionReviewActions = mysqlTable("transaction_review_actions", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(),
  action: mysqlEnum("action", ["FLAGGED", "APPROVED", "RETURNED", "ESCALATED", "REVIEWED"]).notNull(),
  reviewerUserId: int("reviewerUserId").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("transaction_review_actions_transaction_idx").on(table.transactionId, table.createdAt)]);

export const cashBalances = mysqlTable("cash_balances", {
  id: int("id").autoincrement().primaryKey(),
  currencyId: int("currencyId").notNull(),
  availableAmount: decimal("availableAmount", { precision: 24, scale: 6 }).default("0.000000").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("cash_balances_currency_uq").on(table.currencyId)]);

/** Immutable ledger rows make each balance movement traceable back to a transaction. */
export const cashBalanceMovements = mysqlTable("cash_balance_movements", {
  id: int("id").autoincrement().primaryKey(),
  cashBalanceId: int("cashBalanceId").notNull(),
  transactionId: int("transactionId"),
  /** Set for movements posted from a multi-line bon (one movement per exchangeTransactionLines row); null for movements predating that model or not tied to a specific line. */
  transactionLineId: int("transactionLineId"),
  direction: mysqlEnum("direction", ["IN", "OUT", "ADJUSTMENT"]).notNull(),
  amount: decimal("amount", { precision: 24, scale: 6 }).notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  /**
   * Classifies why the movement exists, mainly for BI stock reporting; TRANSACTION rows keep the prior default behavior. Kategori CAPITAL_* dan BANK_* mencatat uang yang melintasi batas usaha — tanpanya setoran modal menyamar sebagai selisih hitungan kas pagi dan tidak dapat dijurnal.
   *
   * `KEWAJIBAN_DIBAYAR` dan `PIUTANG_DITERIMA` mencatat uang yang benar-benar keluar melunasi
   * 2-1900 atau masuk menagih 1-1320 — sisi kas yang dijanjikan komentar `mapExpense`
   * ("pelunasannya dijurnal terpisah saat kas benar-benar keluar") tetapi sampai paket F2 tidak
   * pernah ditulis. Baris `ledger_settlements` yang menyebut apa yang dilunasi; kategori ini
   * sendiri sengaja tidak membedakan beban dari aset tetap, karena jurnalnya memang sama.
   */
  category: mysqlEnum("category", ["OPENING", "TRANSACTION", "SAFE_DEPOSIT", "SAFE_WITHDRAWAL", "OFF_HOURS_SALE", "DENOMINATION_EXCHANGE", "CAPITAL_INJECTION", "CAPITAL_WITHDRAWAL", "BANK_DEPOSIT", "BANK_WITHDRAWAL", "KEWAJIBAN_DIBAYAR", "PIUTANG_DITERIMA", "OTHER"]).default("OTHER").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  /** No longer unique: a multi-line bon posts one movement per exchangeTransactionLines row, so the same transactionId now legitimately appears more than once here. Uniqueness (double-posting guard) moved to transactionLineId below; this stays a plain index for lookups on legacy single-line bons. */
  index("cash_balance_movements_transaction_idx").on(table.transactionId),
  /** One movement per bon line — guards against double-posting the same line (MySQL allows unlimited NULLs through a unique index, so legacy movements with no line still coexist freely). */
  uniqueIndex("cash_balance_transaction_line_movement_uq").on(table.transactionLineId),
  index("cash_balance_movements_balance_idx").on(table.cashBalanceId, table.createdAt),
]);

/** Physical denomination breakdown attached to a cash movement (opening, off-hours adjustment, etc.), so the sum always reconciles to the movement amount for BI stock reporting. */
export const cashDenominationEntries = mysqlTable("cash_denomination_entries", {
  id: int("id").autoincrement().primaryKey(),
  cashBalanceMovementId: int("cashBalanceMovementId").notNull(),
  /** Face value of one note/coin, e.g. 100000.000000 for a Rp100.000 bill. */
  denominationValue: decimal("denominationValue", { precision: 24, scale: 6 }).notNull(),
  quantity: int("quantity").notNull(),
  /** denominationValue * quantity, stored redundantly to make reconciliation queries cheap. */
  subtotal: decimal("subtotal", { precision: 24, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("cash_denomination_entries_movement_idx").on(table.cashBalanceMovementId),
]);

/** Running physical stock per denomination, mirroring how cashBalances.availableAmount tracks the running total per currency. Kept up to date by opening cash (resets to the declared count), adjustments, and completed transactions (delta) — so "how many USD 100 notes do we have right now" is a direct lookup, not a ledger sum. */
export const cashDenominationBalances = mysqlTable("cash_denomination_balances", {
  id: int("id").autoincrement().primaryKey(),
  currencyId: int("currencyId").notNull(),
  denominationValue: decimal("denominationValue", { precision: 24, scale: 6 }).notNull(),
  quantity: int("quantity").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("cash_denomination_balances_currency_value_uq").on(table.currencyId, table.denominationValue),
]);

/** Company bank accounts, each with its own running balance — mirrors how cashBalances tracks physical currency, but for money that only ever moves by transfer. IDR-only for now: BANK_TRANSFER only ever covers the Rupiah leg of a bon (see exchangeTransactions.bankAccountId), same scope CASH already has. */
export const bankAccounts = mysqlTable("bank_accounts", {
  id: int("id").autoincrement().primaryKey(),
  bankName: varchar("bankName", { length: 120 }).notNull(),
  accountHolderName: varchar("accountHolderName", { length: 160 }).notNull(),
  accountNumber: varchar("accountNumber", { length: 60 }).notNull(),
  currencyId: int("currencyId").notNull(),
  availableAmount: decimal("availableAmount", { precision: 24, scale: 6 }).default("0.000000").notNull(),
  active: boolean("active").default(true).notNull(),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("bank_accounts_bank_number_uq").on(table.bankName, table.accountNumber),
  index("bank_accounts_currency_idx").on(table.currencyId),
]);

/** Immutable ledger of every bank account balance change — opening declarations, manual adjustments, and completed BANK_TRANSFER bon legs. Same shape as cashBalanceMovements, minus denominations (bank money has no physical notes to count). */
export const bankAccountMovements = mysqlTable("bank_account_movements", {
  id: int("id").autoincrement().primaryKey(),
  bankAccountId: int("bankAccountId").notNull(),
  transactionId: int("transactionId"),
  transactionLineId: int("transactionLineId"),
  direction: mysqlEnum("direction", ["IN", "OUT", "ADJUSTMENT"]).notNull(),
  amount: decimal("amount", { precision: 24, scale: 6 }).notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  /**
   * CASH_TRANSFER adalah sisi bank dari pemindahan kas↔bank; sengaja tidak dijurnal karena sisi kasnya sudah menjurnal pemindahan itu.
   *
   * `KEWAJIBAN_DIBAYAR` dan `PIUTANG_DITERIMA` adalah pelunasan lewat rekening, kembaran kategori
   * bernama sama pada `cash_balance_movements`. Rekening valuta asing memakai jalur `rupiahAmount`
   * paket F1: tanpa kurs tanggal mutasi, pelunasannya dilewati beralasan, bukan ditebak.
   */
  category: mysqlEnum("category", ["OPENING", "TRANSACTION", "ADJUSTMENT", "CAPITAL_INJECTION", "CAPITAL_WITHDRAWAL", "CASH_TRANSFER", "KEWAJIBAN_DIBAYAR", "PIUTANG_DITERIMA", "OTHER"]).default("OTHER").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  /** One movement per bon line, same double-posting guard cashBalanceMovements uses. */
  uniqueIndex("bank_account_movement_transaction_line_uq").on(table.transactionLineId),
  index("bank_account_movements_account_idx").on(table.bankAccountId, table.createdAt),
]);

export const stockOpnames = mysqlTable("stock_opnames", {
  id: int("id").autoincrement().primaryKey(),
  opnameDate: date("opnameDate").notNull(),
  currencyId: int("currencyId").notNull(),
  openingSystemBalance: decimal("openingSystemBalance", { precision: 24, scale: 6 }).notNull(),
  purchases: decimal("purchases", { precision: 24, scale: 6 }).default("0.000000").notNull(),
  sales: decimal("sales", { precision: 24, scale: 6 }).default("0.000000").notNull(),
  adjustments: decimal("adjustments", { precision: 24, scale: 6 }).default("0.000000").notNull(),
  closingSystemBalance: decimal("closingSystemBalance", { precision: 24, scale: 6 }).notNull(),
  physicalBalance: decimal("physicalBalance", { precision: 24, scale: 6 }),
  /** Hasil hitung fisik laci, dijumlahkan dari rincian pecahan — tidak pernah diketik langsung. */
  physicalCounterBalance: decimal("physicalCounterBalance", { precision: 24, scale: 6 }),
  /** Hasil hitung fisik brankas, dijumlahkan dari rincian pecahan. Nol berarti "dihitung dan memang kosong". */
  physicalSafeBalance: decimal("physicalSafeBalance", { precision: 24, scale: 6 }),
  /** Isi brankas menurut sistem saat opname dikirim. NULL pada baris sebelum paket D — aritmetika variansnya lalu identik dengan perilaku lama. */
  closingSystemSafeBalance: decimal("closingSystemSafeBalance", { precision: 24, scale: 6 }),
  /** Ada pecahan yang jumlahnya meleset meski totalnya bisa saja nol. Dihitung saat pengiriman, bukan saat pemeriksaan. */
  hasDenominationVariance: boolean("hasDenominationVariance").default(false).notNull(),
  variance: decimal("variance", { precision: 24, scale: 6 }),
  reconciliationStatus: mysqlEnum("reconciliationStatus", ["OPEN", "SUBMITTED", "RECONCILED", "VARIANCE"]).default("OPEN").notNull(),
  tellerUserId: int("tellerUserId").notNull(),
  reviewerUserId: int("reviewerUserId"),
  reviewedAt: datetime("reviewedAt"),
  varianceNotes: text("varianceNotes"),
  /** Training-only stock opnames are excluded from the live reconciliation queue. */
  isDemo: boolean("isDemo").default(false).notNull(),
  /** Imported monthly stock record excluded from daily live reconciliation. */
  isHistorical: boolean("isHistorical").default(false).notNull(),
  historicalSourceKey: varchar("historicalSourceKey", { length: 180 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("stock_opnames_date_currency_uq").on(table.opnameDate, table.currencyId),
  index("stock_opnames_live_status_idx").on(table.isDemo, table.isHistorical, table.reconciliationStatus),
  index("stock_opnames_status_idx").on(table.reconciliationStatus),
]);

/**
 * Rincian pecahan hasil hitung fisik sebuah opname, terpisah per lokasi.
 *
 * Bentuknya sengaja meniru `cash_denomination_entries` supaya pembacaannya seragam; yang berbeda
 * hanya `location`, karena satu opname menghitung dua tempat sekaligus — laci dan brankas.
 */
export const stockOpnameDenominations = mysqlTable("stock_opname_denominations", {
  id: int("id").autoincrement().primaryKey(),
  stockOpnameId: int("stockOpnameId").notNull(),
  location: mysqlEnum("location", ["COUNTER", "SAFE"]).notNull(),
  denominationValue: decimal("denominationValue", { precision: 24, scale: 6 }).notNull(),
  /** Hasil hitung fisik. Nol berarti pecahan ini ada menurut sistem tetapi tidak ditemukan saat dihitung. */
  quantity: int("quantity").notNull(),
  /**
   * Jumlah menurut sistem **pada saat opname dikirim**, dibekukan di sini dengan sengaja.
   *
   * Tanpanya, rincian varians hanya dapat disusun ulang terhadap stok berjalan yang sudah bergerak
   * sejak pengiriman — persis ketergantungan yang `hasDenominationVariance` dibuat untuk dihindari.
   * NULL hanya pada baris yang ditulis sebelum kolom ini ada.
   */
  systemQuantity: int("systemQuantity"),
  /** denominationValue * quantity, disimpan berlebih supaya kueri rekonsiliasi murah. */
  subtotal: decimal("subtotal", { precision: 24, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("stock_opname_denominations_opname_location_value_uq").on(table.stockOpnameId, table.location, table.denominationValue),
  index("stock_opname_denominations_opname_idx").on(table.stockOpnameId),
]);

/** One checklist per operational date records the outlet opening and closing controls in the SOP. */
export const dailyOperationalChecklists = mysqlTable("daily_operational_checklists", {
  id: int("id").autoincrement().primaryKey(),
  businessDate: date("businessDate").notNull(),
  openingChecks: json("openingChecks").notNull(),
  closingChecks: json("closingChecks").notNull(),
  openingCompletedAt: datetime("openingCompletedAt"),
  openingCompletedByUserId: int("openingCompletedByUserId"),
  closingCompletedAt: datetime("closingCompletedAt"),
  closingCompletedByUserId: int("closingCompletedByUserId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("daily_operational_checklist_date_uq").on(table.businessDate)]);

/** Singleton-style record, keyed by code, for configurable compliance thresholds. */
export const operationalSettings = mysqlTable("operational_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingCode: varchar("settingCode", { length: 50 }).notNull(),
  reviewThresholdUsd: decimal("reviewThresholdUsd", { precision: 24, scale: 2 }).default("10000.00").notNull(),
  eddCashDailyThresholdIdr: decimal("eddCashDailyThresholdIdr", { precision: 24, scale: 2 }).default("100000000.00").notNull(),
  /** A reference movement at or above this percentage is shown as a rate-shock warning. */
  rateShockThresholdPercent: decimal("rateShockThresholdPercent", { precision: 8, scale: 4 }).default("1.5000").notNull(),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("operational_settings_code_uq").on(table.settingCode)]);

/**
 * Company/tenant identity — legal entity, licensing, and branding shown on printed kwitansi and
 * regulator-facing screens. Deliberately a single row (id 1) for this deployment; `baseCurrencyCode`
 * exists for a future multi-tenant "seed" but nothing else in the app reads it yet — IDR stays
 * hardcoded elsewhere until that wiring is done as its own pass.
 */
export const companyProfile = mysqlTable("company_profile", {
  id: int("id").autoincrement().primaryKey(),
  /** Nama badan hukum resmi, mis. "PT Ibukota Valasindo". */
  legalEntityName: varchar("legalEntityName", { length: 200 }).notNull(),
  /** Nama dagang/merek yang tampil ke publik, bisa berbeda dari nama PT. */
  tradingName: varchar("tradingName", { length: 200 }).notNull(),
  licenseNumber: varchar("licenseNumber", { length: 80 }),
  kupvaCode: varchar("kupvaCode", { length: 40 }),
  npwp: varchar("npwp", { length: 40 }),
  nib: varchar("nib", { length: 40 }),
  /** Kredensial pelaporan ke sistem BI (mis. SINTA) — data sensitif operasional, bukan rahasia aplikasi ini, tapi tetap tidak boleh diekspos di tempat lain (log, dsb). */
  biReporterCode: varchar("biReporterCode", { length: 80 }),
  /** ID PJK yang ditetapkan PPATK untuk pelaporan SIPESAT — beda dari NPWP/nomor izin, ditemukan di pojok kanan halaman SIPESAT saat login. Wajib diisi untuk membangun nama file dan isi kolom IDPJK ekspor SIPESAT. */
  sipesatIdPjk: varchar("sipesatIdPjk", { length: 20 }),
  /** ID entitas pelapor (rentity_id) yang ditetapkan PPATK untuk pelaporan goAML — angka, beda dari IDPJK SIPESAT maupun sandi pelapor BI. Wajib untuk header setiap file XML goAML (LTKT/LTKM). */
  goamlRentityId: int("goamlRentityId"),
  /** Kode user pelapor goAML (reporting_user_code) yang terdaftar di aplikasi goAML — dipakai di header laporan sebagai pengganti detail lengkap petugas pelapor. */
  goamlReportingUserCode: varchar("goamlReportingUserCode", { length: 50 }),
  address: text("address"),
  phone: varchar("phone", { length: 60 }),
  email: varchar("email", { length: 200 }),
  website: varchar("website", { length: 200 }),
  baseCurrencyCode: varchar("baseCurrencyCode", { length: 3 }).default("IDR").notNull(),
  /**
   * Zona waktu operasional outlet (nama IANA, mis. "Asia/Jakarta" = GMT+7/WIB). Server berjalan
   * pada UTC sementara petugas dan regulator berada di zona lokal, sehingga batas "hari ini" untuk
   * tenggat pelaporan harus dihitung memakai nilai ini — bukan zona waktu proses yang kebetulan
   * menjalankan kode. Tanpa ini, tenggat 23:59 waktu Jakarta terbaca sebagai hari berikutnya di
   * server, sehingga paket yang jatuh tempo hari ini tampil sebagai "mendatang".
   */
  timezone: varchar("timezone", { length: 64 }).default("Asia/Jakarta").notNull(),
  logoDocumentId: int("logoDocumentId"),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const rateSyncConfigurations = mysqlTable("rate_sync_configurations", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["BI_TRANSACTION_RATES"]).default("BI_TRANSACTION_RATES").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  cronExpression: varchar("cronExpression", { length: 80 }).default("0 30 3 * * 1-5").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  lastSuccessfulAt: datetime("lastSuccessfulAt"),
  lastAttemptAt: datetime("lastAttemptAt"),
  lastError: text("lastError"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("rate_sync_source_uq").on(table.source),
  index("rate_sync_task_uid_idx").on(table.scheduleCronTaskUid),
]);

export const rateSyncRuns = mysqlTable("rate_sync_runs", {
  id: int("id").autoincrement().primaryKey(),
  configurationId: int("configurationId").notNull(),
  status: mysqlEnum("status", ["STARTED", "SUCCEEDED", "FAILED", "SKIPPED"]).notNull(),
  runAt: datetime("runAt").notNull(),
  referenceDate: date("referenceDate"),
  message: text("message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("rate_sync_runs_configuration_idx").on(table.configurationId, table.runAt)]);

/** A time-stamped reference or market observation; never an automatically activated outlet price. */
export const marketRateObservations = mysqlTable("market_rate_observations", {
  id: int("id").autoincrement().primaryKey(),
  currencyId: int("currencyId").notNull(),
  sourceName: varchar("sourceName", { length: 80 }).notNull(),
  sourceKind: mysqlEnum("sourceKind", ["OFFICIAL", "MARKET", "MANUAL"]).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 500 }),
  quoteUnit: decimal("quoteUnit", { precision: 18, scale: 6 }).default("1.000000").notNull(),
  buyRate: decimal("buyRate", { precision: 24, scale: 6 }).notNull(),
  sellRate: decimal("sellRate", { precision: 24, scale: 6 }).notNull(),
  observedAt: datetime("observedAt").notNull(),
  payloadHash: varchar("payloadHash", { length: 128 }),
  notes: text("notes"),
  recordedByUserId: int("recordedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("market_rate_observation_currency_source_idx").on(table.currencyId, table.sourceName, table.observedAt),
  index("market_rate_observation_source_idx").on(table.sourceName, table.observedAt),
]);

/** Warning records retain the evidence behind a material reference movement or outlet deviation. */
export const rateVolatilityAlerts = mysqlTable("rate_volatility_alerts", {
  id: int("id").autoincrement().primaryKey(),
  currencyId: int("currencyId").notNull(),
  sourceName: varchar("sourceName", { length: 80 }).notNull(),
  observationId: int("observationId"),
  referenceSnapshotId: int("referenceSnapshotId"),
  operationalRateId: int("operationalRateId"),
  alertType: mysqlEnum("alertType", ["REFERENCE_MOVEMENT", "OUTLET_DEVIATION"]).notNull(),
  percentageChange: decimal("percentageChange", { precision: 10, scale: 4 }).notNull(),
  severity: mysqlEnum("severity", ["ATTENTION", "HIGH"]).default("ATTENTION").notNull(),
  message: text("message").notNull(),
  resolvedAt: datetime("resolvedAt"),
  resolvedByUserId: int("resolvedByUserId"),
  resolutionNotes: text("resolutionNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("rate_volatility_alert_open_idx").on(table.resolvedAt, table.createdAt),
  index("rate_volatility_alert_currency_idx").on(table.currencyId, table.createdAt),
]);

/** Consumer complaint register follows the company complaint form and requires a recorded outcome. */
export const consumerComplaints = mysqlTable("consumer_complaints", {
  id: int("id").autoincrement().primaryKey(),
  complaintNumber: varchar("complaintNumber", { length: 50 }).notNull(),
  reporterName: varchar("reporterName", { length: 200 }).notNull(),
  reporterIdentityNumber: varchar("reporterIdentityNumber", { length: 80 }).notNull(),
  reporterPhone: varchar("reporterPhone", { length: 40 }).notNull(),
  reporterEmail: varchar("reporterEmail", { length: 320 }),
  transactionAt: datetime("transactionAt"),
  receiptNumber: varchar("receiptNumber", { length: 80 }),
  transactionDetails: text("transactionDetails"),
  chronology: text("chronology").notNull(),
  supportingDocuments: text("supportingDocuments"),
  category: mysqlEnum("category", ["CASH_COUNT", "BOARD_RATE", "STAFF_SERVICE", "OTHER"]).default("OTHER").notNull(),
  status: mysqlEnum("status", ["OPEN", "IN_REVIEW", "RESOLVED", "ESCALATED_LAPS_BI"]).default("OPEN").notNull(),
  receivedByUserId: int("receivedByUserId").notNull(),
  resolution: text("resolution"),
  resolvedByUserId: int("resolvedByUserId"),
  resolvedAt: datetime("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("consumer_complaints_number_uq").on(table.complaintNumber),
  index("consumer_complaints_status_idx").on(table.status, table.createdAt),
  index("consumer_complaints_receipt_idx").on(table.receiptNumber),
]);

/** A public expression of interest, never a completed exchange or a KYC record. */
export const serviceRequests = mysqlTable("service_requests", {
  id: int("id").autoincrement().primaryKey(),
  requestNumber: varchar("requestNumber", { length: 50 }).notNull(),
  requesterName: varchar("requesterName", { length: 200 }).notNull(),
  contactChannel: mysqlEnum("contactChannel", ["PHONE", "WHATSAPP", "EMAIL"]).notNull(),
  contactValue: varchar("contactValue", { length: 320 }).notNull(),
  currencyId: int("currencyId").notNull(),
  operation: mysqlEnum("operation", ["BUY", "SELL"]).notNull(),
  foreignAmount: decimal("foreignAmount", { precision: 24, scale: 6 }).notNull(),
  preferredServiceAt: datetime("preferredServiceAt"),
  contactConsent: boolean("contactConsent").notNull(),
  status: mysqlEnum("status", ["BARU", "MENUNGGU_VERIFIKASI", "KURS_DIKONFIRMASI", "SIAP_DILAYANI", "KEDALUWARSA", "DIBATALKAN"]).default("BARU").notNull(),
  assignedToUserId: int("assignedToUserId"),
  confirmedOperationalRateId: int("confirmedOperationalRateId"),
  confirmedRateExpiresAt: datetime("confirmedRateExpiresAt"),
  staffNotes: text("staffNotes"),
  confirmedByUserId: int("confirmedByUserId"),
  confirmedAt: datetime("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("service_requests_number_uq").on(table.requestNumber),
  index("service_requests_status_created_idx").on(table.status, table.createdAt),
  index("service_requests_currency_status_idx").on(table.currencyId, table.status),
  index("service_requests_assignee_status_idx").on(table.assignedToUserId, table.status),
]);

/** Staff-authored notices are the only announcements eligible for public display. */
export const publicAnnouncements = mysqlTable("public_announcements", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT").notNull(),
  publishedAt: datetime("publishedAt"),
  expiresAt: datetime("expiresAt"),
  createdByUserId: int("createdByUserId").notNull(),
  publishedByUserId: int("publishedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("public_announcements_status_published_idx").on(table.status, table.publishedAt),
  index("public_announcements_expiry_idx").on(table.expiresAt),
]);

/** Append-only log of significant master, workflow, cash, and compliance changes. */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: varchar("entityId", { length: 100 }).notNull(),
  beforeState: json("beforeState"),
  afterState: json("afterState"),
  reason: text("reason"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("audit_logs_entity_idx").on(table.entityType, table.entityId, table.createdAt),
  index("audit_logs_actor_idx").on(table.actorUserId, table.createdAt),
]);

/** A Director knowledge task is distinct from approval and cannot block a completed operational decision. */
export const directorAcknowledgements = mysqlTable("director_acknowledgements", {
  id: int("id").autoincrement().primaryKey(),
  eventType: mysqlEnum("eventType", ["FLAGGED_TRANSACTION_APPROVED", "STOCK_VARIANCE", "RATE_SHOCK", "CONSUMER_COMPLAINT"]).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: varchar("entityId", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  detail: text("detail").notNull(),
  createdByUserId: int("createdByUserId"),
  acknowledgedByUserId: int("acknowledgedByUserId"),
  acknowledgedAt: datetime("acknowledgedAt"),
  acknowledgementNotes: text("acknowledgementNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("director_acknowledgement_open_idx").on(table.acknowledgedAt, table.createdAt),
  index("director_acknowledgement_entity_idx").on(table.entityType, table.entityId),
]);

/** Immutable, manually approved regulator-reporting package. It never submits anything to an external regulator. */
export const regulatoryReportPackages = mysqlTable("regulatory_report_packages", {
  id: int("id").autoincrement().primaryKey(),
  packageNumber: varchar("packageNumber", { length: 64 }).notNull(),
  reportType: mysqlEnum("reportType", ["LKU", "FINANCIAL_READINESS", "INCIDENTAL"]).notNull(),
  periodStart: datetime("periodStart").notNull(),
  periodEnd: datetime("periodEnd").notNull(),
  status: mysqlEnum("status", ["DRAFT", "PREPARED", "RETURNED", "APPROVED", "EXPORTED"]).default("DRAFT").notNull(),
  /** Stable input snapshot; live data may change after a package has been prepared. */
  dataSnapshot: json("dataSnapshot").notNull(),
  validationSummary: json("validationSummary").notNull(),
  sourceDigest: varchar("sourceDigest", { length: 128 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  preparedByUserId: int("preparedByUserId"),
  preparedAt: datetime("preparedAt"),
  approvedByUserId: int("approvedByUserId"),
  approvedAt: datetime("approvedAt"),
  approvalNotes: text("approvalNotes"),
  returnedByUserId: int("returnedByUserId"),
  returnedAt: datetime("returnedAt"),
  returnNotes: text("returnNotes"),
  manualDueAt: datetime("manualDueAt"),
  manualDueNotes: text("manualDueNotes"),
  exportedByUserId: int("exportedByUserId"),
  exportedAt: datetime("exportedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("regulatory_report_package_number_uq").on(table.packageNumber),
  index("regulatory_report_period_idx").on(table.reportType, table.periodStart, table.periodEnd, table.status),
  index("regulatory_report_status_idx").on(table.status, table.createdAt),
  index("regulatory_report_manual_due_idx").on(table.status, table.manualDueAt),
]);

/** Controlled source snapshot for FORM B0002, B0003, and B0004; never inferred from live cash or transactions. */
export const financialStatementSnapshots = mysqlTable("financial_statement_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  periodStart: datetime("periodStart").notNull(),
  periodEnd: datetime("periodEnd").notNull(),
  sourceLabel: varchar("sourceLabel", { length: 180 }).notNull(),
  sourceReference: text("sourceReference"),
  sourceStorageKey: varchar("sourceStorageKey", { length: 500 }),
  sourceFileName: varchar("sourceFileName", { length: 255 }),
  sourceMimeType: varchar("sourceMimeType", { length: 120 }),
  profitLossRows: json("profitLossRows").notNull(),
  balanceSheetRows: json("balanceSheetRows").notNull(),
  equityRows: json("equityRows").notNull(),
  validationSummary: json("validationSummary").notNull(),
  sourceDigest: varchar("sourceDigest", { length: 128 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("financial_snapshot_period_idx").on(table.periodStart, table.periodEnd, table.createdAt),
  index("financial_snapshot_creator_idx").on(table.createdByUserId, table.createdAt),
]);

/** Human-reviewed record of a potential regulator incident. It never decides filing obligation or sends data externally. */
export const regulatoryIncidentReports = mysqlTable("regulatory_incident_reports", {
  id: int("id").autoincrement().primaryKey(),
  reportNumber: varchar("reportNumber", { length: 64 }).notNull(),
  category: mysqlEnum("category", ["GOVERNANCE", "OFFICE_OR_OUTLET", "BUSINESS_DISRUPTION", "FORCE_MAJEURE", "COOPERATION", "REGULATOR_REQUEST", "OTHER"]).notNull(),
  incidentAt: datetime("incidentAt").notNull(),
  discoveredAt: datetime("discoveredAt").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  evidenceReference: text("evidenceReference"),
  initialAction: text("initialAction"),
  status: mysqlEnum("status", ["DRAFT", "PREPARED", "APPROVED", "EXPORTED"]).default("DRAFT").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  preparedByUserId: int("preparedByUserId"),
  preparedAt: datetime("preparedAt"),
  approvedByUserId: int("approvedByUserId"),
  approvedAt: datetime("approvedAt"),
  approvalNotes: text("approvalNotes"),
  exportedByUserId: int("exportedByUserId"),
  exportedAt: datetime("exportedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("regulatory_incident_number_uq").on(table.reportNumber),
  index("regulatory_incident_status_idx").on(table.status, table.incidentAt),
  index("regulatory_incident_category_idx").on(table.category, table.createdAt),
]);

/**
 * Jenjang pada struktur organisasi. KOMISARIS ikut dicatat karena tercantum dalam struktur dan
 * menjadi pihak yang menyetujui kebijakan APU PPT, namun bukan SDM pelaku SK SP: jenjangnya tidak
 * memiliki sandi kompetensi, sehingga tidak pernah masuk hitungan laporan RAP01/RAS01.
 */
export const jobLevels = ["KOMISARIS", "DIREKSI", "PEJABAT_EKSEKUTIF", "PENYELIA", "PELAKSANA"] as const;

/**
 * Fungsi penanggung jawab yang ditunjuk perusahaan. IRA menanyakan secara khusus apakah
 * penyelenggara telah menunjuk pihak yang bertanggung jawab atas penerapan APU PPT PPPSPM dan
 * apakah fungsi audit terpisah dari unit bisnis, sehingga penunjukan ini perlu tercatat beserta
 * surat keputusannya - bukan sekadar diketahui.
 */
export const picRoles = ["INTERNAL_AUDIT", "MANAJEMEN_RISIKO", "APU_PPT", "PERLINDUNGAN_KONSUMEN", "NASABAH_RISIKO_TINGGI"] as const;
export const employmentStatuses = ["AKTIF", "NONAKTIF"] as const;
export const screeningResults = ["DALAM_PROSES", "LULUS", "TIDAK_LULUS"] as const;
/**
 * Jalur kompetensi yang diwajibkan bagi seorang pegawai. PADG No. 17 Tahun 2024 memisahkan PBK
 * Sistem Pembayaran dari Sertifikasi Kompetensi Sistem Pembayaran, dan kewajiban pemeliharaan
 * mengikuti sertifikat yang sudah dimiliki. Menyimpan jalur pada pegawai membuat keempat angka
 * RAP01/RAS01 dapat diturunkan, bukan diketik ulang setiap triwulan.
 */
export const competencyTracks = ["PBK", "SERTIFIKASI_KOMPETENSI", "TIDAK_WAJIB"] as const;

/**
 * Pegawai yang tercantum dalam struktur organisasi.
 *
 * Temuan pemeriksaan Bank Indonesia 2026 butir 2 dan 12: tidak terdapat dokumen kepegawaian,
 * mekanisme rekrutmen, dan pemantauan profil pegawai, serta belum ada prosedur dan dokumentasi
 * penyaringan calon pegawai. Tabel ini menjadi tempat catatan itu berada, sekaligus sumber angka
 * laporan kompetensi SDM triwulanan ke pelaporan.bi.go.id.
 */
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  fullName: varchar("fullName", { length: 200 }).notNull(),
  /** Nomor identitas untuk penyaringan terhadap daftar DTTOT/DPPSPM, dan dicetak pada SK penunjukan. */
  identityNumber: varchar("identityNumber", { length: 40 }),
  /** Alamat pegawai; tercetak pada surat keputusan penunjukan. */
  address: text("address"),
  position: varchar("position", { length: 120 }).notNull(),
  jobLevel: mysqlEnum("jobLevel", jobLevels).notNull(),
  competencyTrack: mysqlEnum("competencyTrack", competencyTracks).default("TIDAK_WAJIB").notNull(),
  /**
   * Jenjang yang dipakai untuk pelaporan kompetensi, bila berbeda dari jenjang pada struktur
   * organisasi. Sertifikat PBK direktur perusahaan ini terbit pada jenjang Pejabat Eksekutif (6),
   * dan template PADG 17/2024 memang tidak memiliki sandi PBK untuk jenjang direksi. Tanpa kolom
   * ini, kewajiban dan sertifikat direktur sama-sama hilang dari laporan.
   */
  competencyLevel: mysqlEnum("competencyLevel", jobLevels),
  employmentStatus: mysqlEnum("employmentStatus", employmentStatuses).default("AKTIF").notNull(),
  joinedAt: datetime("joinedAt").notNull(),
  endedAt: datetime("endedAt"),
  /** Pendidikan terakhir; bagian dari profil pegawai yang diminta pemeriksa. */
  education: varchar("education", { length: 120 }),
  /** Nomor dan tanggal perjanjian kerja - empat pegawai ditemukan tanpa dokumen ini. */
  employmentAgreementNumber: varchar("employmentAgreementNumber", { length: 80 }),
  employmentAgreementAt: datetime("employmentAgreementAt"),
  /** Penyaringan calon pegawai (pre-employee screening) beserta buktinya. */
  screeningResult: mysqlEnum("screeningResult", screeningResults),
  screenedAt: datetime("screenedAt"),
  screeningNotes: text("screeningNotes"),
  screenedByUserId: int("screenedByUserId"),
  /** Akun aplikasi bila pegawai ini memakai sistem; boleh kosong. */
  userId: int("userId"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("employees_status_level_idx").on(table.employmentStatus, table.jobLevel),
  index("employees_track_idx").on(table.competencyTrack),
]);

/**
 * Sertifikat kompetensi yang dimiliki pegawai, satu baris per sertifikat.
 *
 * `competencyCode` memakai sandi resmi PADG 17/2024 (mis. SKNK66SPP054) sehingga angka laporan
 * dapat dijumlahkan langsung per sandi tanpa pemetaan tambahan.
 */
export const employeeCertifications = mysqlTable("employee_certifications", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  competencyCode: varchar("competencyCode", { length: 20 }).notNull(),
  certificateNumber: varchar("certificateNumber", { length: 120 }),
  issuedAt: datetime("issuedAt").notNull(),
  /** Sertifikat wajib dipelihara; kosong berarti tidak memiliki masa berlaku. */
  expiresAt: datetime("expiresAt"),
  documentId: int("documentId"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("employee_certifications_employee_idx").on(table.employeeId, table.competencyCode),
  index("employee_certifications_code_issued_idx").on(table.competencyCode, table.issuedAt),
]);

/**
 * Rencana sertifikasi per triwulan, kolom `rencanaSertifikasiSDM` pada RAP01/RAS01. Ini satu-satunya
 * dari keempat angka laporan yang tidak dapat diturunkan dari catatan pegawai, karena rencana
 * memang keputusan manajemen dan bukan fakta yang sudah terjadi.
 */
export const sdmCompetencyPlans = mysqlTable("sdm_competency_plans", {
  id: int("id").autoincrement().primaryKey(),
  periodYear: int("periodYear").notNull(),
  periodQuarter: int("periodQuarter").notNull(),
  competencyCode: varchar("competencyCode", { length: 20 }).notNull(),
  plannedCount: int("plannedCount").default(0).notNull(),
  /** Rencana penyediaan dana, rupiah penuh - diminta Lampiran X/XI PADG 17/2024. */
  plannedBudgetIdr: decimal("plannedBudgetIdr", { precision: 18, scale: 2 }),
  /**
   * Realisasi penggunaan dana, rupiah penuh. Laporan realisasi (Lampiran X/XI bagian B.II dan B.IV)
   * meminta dana yang benar-benar terpakai, terpisah dari yang direncanakan; tanpa kolom ini
   * angkanya harus diketik ulang dari kwitansi pelatihan setiap triwulan.
   */
  realisasiBudgetIdr: decimal("realisasiBudgetIdr", { precision: 18, scale: 2 }),
  notes: text("notes"),
  updatedByUserId: int("updatedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("sdm_competency_plans_period_code_uq").on(table.periodYear, table.periodQuarter, table.competencyCode),
]);

/**
 * Penunjukan penanggung jawab fungsi, berikut surat keputusannya. Dibuat sebagai tabel tersendiri
 * karena satu orang dapat memegang lebih dari satu fungsi dan penunjukan berganti dari waktu ke
 * waktu; menyimpannya sebagai kolom pada pegawai akan menghapus riwayat penunjukan sebelumnya.
 */
export const employeePicAssignments = mysqlTable("employee_pic_assignments", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  picRole: mysqlEnum("picRole", picRoles).notNull(),
  /** Nomor dan tanggal SK penunjukan; diminta sebagai bukti pada penilaian IRA. */
  decreeNumber: varchar("decreeNumber", { length: 120 }),
  decreeAt: datetime("decreeAt"),
  documentId: int("documentId"),
  assignedAt: datetime("assignedAt").notNull(),
  endedAt: datetime("endedAt"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("employee_pic_assignments_role_idx").on(table.picRole, table.assignedAt),
  index("employee_pic_assignments_employee_idx").on(table.employeeId),
]);

export const trainingMethods = ["IN_HOUSE", "EKSTERNAL", "DARING"] as const;

/**
 * Pelatihan APU PPT PPPSPM bagi pegawai.
 *
 * Berbeda dari sertifikasi kompetensi Sistem Pembayaran: itu kualifikasi jenjang yang diterbitkan
 * lembaga pelatihan, sedangkan ini penyegaran internal yang wajib diselenggarakan penyelenggara
 * sendiri. Penilaian risiko menanyakannya terpisah, temuan pemeriksaan butir 12 memintanya
 * terdokumentasi, dan surat keterangannya dipakai sebagai dokumen pendukung perpanjangan izin
 * pada e-Licensing Bank Indonesia - tiga alasan berbeda untuk catatan yang sama.
 */
export const apuTrainingSessions = mysqlTable("apu_training_sessions", {
  id: int("id").autoincrement().primaryKey(),
  heldAt: datetime("heldAt").notNull(),
  topic: text("topic").notNull(),
  method: mysqlEnum("method", trainingMethods).default("IN_HOUSE").notNull(),
  /** Pemateri; boleh pihak internal maupun lembaga luar. */
  facilitator: varchar("facilitator", { length: 200 }).notNull(),
  materials: text("materials"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("apu_training_sessions_held_idx").on(table.heldAt),
]);

/**
 * Daftar hadir. Bukti yang diminta penilaian risiko adalah daftar hadir beserta dokumentasinya,
 * sehingga kehadiran dicatat per pegawai per sesi - bukan sekadar jumlah peserta.
 */
export const apuTrainingAttendance = mysqlTable("apu_training_attendance", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  employeeId: int("employeeId").notNull(),
  /** Hasil evaluasi bila ada; lampiran surat keterangan menyebut daftar hadir dan evaluasi. */
  evaluation: varchar("evaluation", { length: 120 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("apu_training_attendance_session_employee_uq").on(table.sessionId, table.employeeId),
  index("apu_training_attendance_employee_idx").on(table.employeeId),
]);

export const candidateDecisions = ["DALAM_PROSES", "DITERIMA", "TIDAK_DITERIMA"] as const;

/**
 * Penyaringan calon pegawai (pre-employee screening).
 *
 * Pemeriksaan mencatat perekrutan selama ini berasal dari lingkungan keluarga tanpa penyaringan
 * yang terdokumentasi. Yang perlu dibuktikan bukan hanya bahwa pegawai yang diterima telah
 * disaring, melainkan bahwa setiap calon disaring — termasuk yang akhirnya tidak diterima.
 * Karena itu calon dicatat pada tabelnya sendiri dan tetap tersimpan meskipun tidak jadi bekerja;
 * kolom penyaringan pada tabel pegawai hanya menyimpan hasil akhir bagi yang diterima.
 */
export const employeeCandidates = mysqlTable("employee_candidates", {
  id: int("id").autoincrement().primaryKey(),
  fullName: varchar("fullName", { length: 200 }).notNull(),
  identityNumber: varchar("identityNumber", { length: 40 }),
  appliedPosition: varchar("appliedPosition", { length: 120 }).notNull(),
  appliedAt: datetime("appliedAt").notNull(),
  /** Hasil penilaian manusia atas penyaringan, bukan hasil pencocokan otomatis. */
  screeningResult: mysqlEnum("screeningResult", screeningResults).default("DALAM_PROSES").notNull(),
  screenedAt: datetime("screenedAt"),
  screeningNotes: text("screeningNotes"),
  /** Jejak pencocokan otomatis terhadap daftar DTTOT/DPPSPM yang sedang termuat. */
  watchlistCheckedAt: datetime("watchlistCheckedAt"),
  watchlistMatchCount: int("watchlistMatchCount").default(0).notNull(),
  watchlistSummary: text("watchlistSummary"),
  decision: mysqlEnum("decision", candidateDecisions).default("DALAM_PROSES").notNull(),
  decidedAt: datetime("decidedAt"),
  /** Terisi bila calon diterima dan sudah tercatat sebagai pegawai. */
  employeeId: int("employeeId"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("employee_candidates_decision_idx").on(table.decision, table.appliedAt),
]);

/**
 * Buku besar.
 *
 * Temuan pemeriksaan Bank Indonesia butir 7.1: penyelenggara tidak dapat menunjukkan buku besar
 * sebagai dasar penyusunan masing-masing pos dalam laporan keuangan. Sampai sekarang angka laporan
 * berasal dari snapshot yang diimpor dari luar (`financial_statement_snapshots`) — dapat dipercaya
 * hanya sejauh berkas sumbernya, dan tidak dapat ditelusuri ke transaksi pendukungnya. Empat tabel
 * berikut menggantikan dasar itu dengan pembukuan berpasangan.
 *
 * Bagan akunnya sendiri berada di `shared/chartOfAccounts.ts` dan disemai ke tabel ini; kolom
 * `code` yang menjadi rujukan baris jurnal, bukan `id`, supaya jurnal tetap terbaca pada ekspor
 * paket audit tanpa perlu menggabungkan tabel.
 */
export const accountTypes = ["ASET", "KEWAJIBAN", "EKUITAS", "PENDAPATAN", "HARGA_POKOK", "BEBAN", "LAIN_LAIN", "PAJAK"] as const;

export const chartOfAccounts = mysqlTable("chart_of_accounts", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 12 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  type: mysqlEnum("type", accountTypes).notNull(),
  normalBalance: mysqlEnum("normalBalance", ["DEBIT", "KREDIT"]).notNull(),
  /** Akun lawan: mengurangi pos induknya (akumulasi penyusutan, dividen, persediaan akhir). */
  isContra: boolean("isContra").default(false).notNull(),
  /** Baris form B0002/B0003/B0004 yang disusun dari akun ini — inti jawaban atas temuan 7.1. */
  forms: json("forms").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("chart_of_accounts_code_uq").on(table.code),
  index("chart_of_accounts_type_idx").on(table.type, table.code),
]);

export const accountingPeriodStatuses = ["TERBUKA", "DITUTUP"] as const;

/**
 * Periode pembukuan. Periode yang sudah ditutup tidak dapat menerima jurnal baru maupun perubahan;
 * koreksi atasnya ditulis sebagai jurnal balik pada periode terbuka berikutnya. Ini sejalan dengan
 * sifat append-only yang sudah dipakai bon, kas, dan pengeluaran.
 */
export const accountingPeriods = mysqlTable("accounting_periods", {
  id: int("id").autoincrement().primaryKey(),
  periodStart: date("periodStart").notNull(),
  periodEnd: date("periodEnd").notNull(),
  status: mysqlEnum("status", accountingPeriodStatuses).default("TERBUKA").notNull(),
  closedByUserId: int("closedByUserId"),
  closedAt: datetime("closedAt"),
  closingNotes: text("closingNotes"),
  /**
   * Penanda bahwa penilaian persediaan akhir UKA sudah dijalankan untuk periode ini.
   *
   * Ditaruh sebagai kolom, bukan disimpulkan dari ada-tidaknya baris `period_closing_valuations`:
   * outlet yang belum memegang UKA menghasilkan nol baris penilaian, dan itu keadaan sah yang tetap
   * harus bisa ditutup. Menghitung baris akan mencampur "belum dinilai" dengan "sudah dinilai,
   * hasilnya memang kosong".
   */
  valuationPostedAt: datetime("valuationPostedAt"),
  valuationJournalEntryId: int("valuationJournalEntryId"),
  /** Penanda jurnal penutup laba ke 3-2100; hanya periode yang berakhir 31 Desember mengisinya. */
  profitClosingPostedAt: datetime("profitClosingPostedAt"),
  profitClosingJournalEntryId: int("profitClosingJournalEntryId"),
  /**
   * Penanda bahwa penyusutan bulan ini sudah dijurnal.
   *
   * Kolom, bukan hitungan baris: outlet tanpa aset tersusutkan menghasilkan nol baris beban, dan
   * itu keadaan sah yang tetap harus bisa ditutup. Menghitung baris akan mencampur "belum
   * disusutkan" dengan "sudah disusutkan, hasilnya memang kosong".
   */
  depreciationPostedAt: datetime("depreciationPostedAt"),
  depreciationJournalEntryId: int("depreciationJournalEntryId"),

  /**
   * Penanda bahwa revaluasi kurs bulan ini sudah dijurnal.
   *
   * Kolom, bukan hitungan baris: outlet tanpa rekening valuta asing menghasilkan nol baris
   * revaluasi, dan itu keadaan sah yang tetap harus bisa ditutup. Menghitung baris akan mencampur
   * "belum direvaluasi" dengan "sudah direvaluasi, hasilnya memang kosong" — alasan yang sama
   * persis dengan `depreciationPostedAt`.
   */
  revaluationPostedAt: datetime("revaluationPostedAt"),
  revaluationJournalEntryId: int("revaluationJournalEntryId"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("accounting_periods_range_uq").on(table.periodStart, table.periodEnd),
  index("accounting_periods_status_idx").on(table.status, table.periodStart),
]);

/**
 * Penilaian persediaan valuta akhir periode, satu baris per mata uang per periode.
 *
 * Setiap angka penilaian dapat diturunkan ulang dari barisnya sendiri — kuantitas beserta opname
 * yang membuktikannya, kurs beserta snapshot dan tanggal yang benar-benar dipakai. Itulah jawaban
 * atas temuan 7.1 pada tingkat baris: pos "Kas UKA" pada neraca bukan angka yang muncul entah dari
 * mana, melainkan hitungan fisik dikali kurs BI yang dapat ditunjuk.
 *
 * `opnameDate` dan `rateReferenceDate` disimpan meski sudah dapat dijangkau lewat id-nya, karena
 * keduanya boleh berbeda dari akhir periode — opname hanya terjadi saat outlet buka, dan BI tidak
 * mengumumkan kurs pada hari libur. Perbedaan itu harus terbaca tanpa menelusuri tabel lain.
 */
export const periodClosingValuations = mysqlTable("period_closing_valuations", {
  id: int("id").autoincrement().primaryKey(),
  periodId: int("periodId").notNull(),
  currencyId: int("currencyId").notNull(),
  /** Kuantitas valuta hasil hitung fisik: laci + brankas, dari `stock_opnames.physicalBalance`. */
  quantity: decimal("quantity", { precision: 24, scale: 6 }).notNull(),
  stockOpnameId: int("stockOpnameId").notNull(),
  opnameDate: date("opnameDate").notNull(),
  rateSnapshotId: int("rateSnapshotId").notNull(),
  rateReferenceDate: date("rateReferenceDate").notNull(),
  buyRate: decimal("buyRate", { precision: 24, scale: 6 }).notNull(),
  sellRate: decimal("sellRate", { precision: 24, scale: 6 }).notNull(),
  /** BI mengutip JPY per 100 unit; mengabaikan kolom ini membuat nilainya meleset seratus kali. */
  quoteUnit: decimal("quoteUnit", { precision: 18, scale: 6 }).notNull(),
  /** Kurs tengah per satu unit valuta: (buyRate + sellRate) / 2 / quoteUnit. */
  midRatePerUnit: decimal("midRatePerUnit", { precision: 24, scale: 12 }).notNull(),
  /** quantity × midRatePerUnit, dibulatkan setengah-ke-atas ke sen — lihat spec bagian 7. */
  rupiahValue: decimal("rupiahValue", { precision: 24, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("period_closing_valuations_period_currency_uq").on(table.periodId, table.currencyId),
  index("period_closing_valuations_period_idx").on(table.periodId),
]);

export type PeriodClosingValuation = typeof periodClosingValuations.$inferSelect;

export const fixedAssetCategories = [
  "TANAH",
  "BANGUNAN",
  "KENDARAAN",
  "PERALATAN_KANTOR",
  "PERANGKAT_KERAS",
  "PERANGKAT_LUNAK",
  "INVENTARIS_LAIN",
] as const;

/**
 * Kelompok penyusutan DJP. **Hanya label asal default umur manfaat**, bukan kebijakan akuntansi:
 * SAK EP Bab 17 menuntut umur manfaat sebenarnya yang ditinjau tahunan, sementara kelompok ini
 * aturan pajak (PMK 72/2023). Karena itu `usefulLifeMonths` disimpan terpisah dan dapat berbeda.
 */
export const fixedAssetTaxGroups = [
  "KELOMPOK_1",
  "KELOMPOK_2",
  "KELOMPOK_3",
  "KELOMPOK_4",
  "BANGUNAN_PERMANEN",
  "BANGUNAN_NON_PERMANEN",
  "TIDAK_DISUSUTKAN",
] as const;

/**
 * Register aset tetap.
 *
 * Baris Penyusutan pada B0003 tidak punya asal sampai tabel ini ada. Setiap beban penyusutan dapat
 * ditelusuri kembali ke satu baris di sini beserta harga perolehan, tanggal, dan umur manfaat yang
 * dipakai menghitungnya — jawaban atas temuan 7.1 pada tingkat baris.
 *
 * `acquisitionJournalEntryId` NULL menandai **aset warisan**: aset yang sudah dimiliki sebelum buku
 * besar ini dipakai, yang saldo 1-1510 dan 1-1520-nya masuk lewat jalur `SALDO_AWAL` yang sudah ada.
 * Register tidak boleh menjadi modul kedua yang menulis saldo awal.
 */
export const fixedAssets = mysqlTable("fixed_assets", {
  id: int("id").autoincrement().primaryKey(),
  /** Nomor inventaris fisik yang tertempel di asetnya; boleh kosong, unik bila diisi. */
  assetCode: varchar("assetCode", { length: 60 }),
  name: varchar("name", { length: 200 }).notNull(),
  category: mysqlEnum("category", fixedAssetCategories).notNull(),
  taxGroup: mysqlEnum("taxGroup", fixedAssetTaxGroups),
  acquisitionDate: date("acquisitionDate").notNull(),
  acquisitionCost: decimal("acquisitionCost", { precision: 24, scale: 2 }).notNull(),
  residualValue: decimal("residualValue", { precision: 24, scale: 2 }).default("0.00").notNull(),
  /** NULL berarti tidak disusutkan. Tanah, dan hanya tanah, secara sah tidak pernah menyusut. */
  usefulLifeMonths: int("usefulLifeMonths"),
  /** Bulan pertama yang boleh dijurnal sistem, "YYYY-MM". Sengaja bukan kolom `date`. */
  firstJournalMonth: varchar("firstJournalMonth", { length: 7 }).notNull(),
  /** Akumulasi yang sudah tercatat sebelum `firstJournalMonth`; nol untuk aset yang baru dibeli. */
  openingAccumulatedDepreciation: decimal("openingAccumulatedDepreciation", { precision: 24, scale: 2 }).default("0.00").notNull(),
  /** NULL menandai aset warisan — lihat keterangan tabel. */
  acquisitionJournalEntryId: int("acquisitionJournalEntryId"),
  status: mysqlEnum("status", ["AKTIF", "DILEPAS"]).default("AKTIF").notNull(),
  disposalDate: date("disposalDate"),
  disposalProceeds: decimal("disposalProceeds", { precision: 24, scale: 2 }),
  disposalJournalEntryId: int("disposalJournalEntryId"),
  disposalNotes: text("disposalNotes"),
  notes: text("notes"),
  recordedByUserId: int("recordedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("fixed_assets_code_uq").on(table.assetCode),
  index("fixed_assets_status_idx").on(table.status, table.acquisitionDate),
  index("fixed_assets_category_idx").on(table.category),
]);

export type FixedAsset = typeof fixedAssets.$inferSelect;

/**
 * Beban penyusutan per aset per bulan yang **benar-benar dijurnal**.
 *
 * Bukan jadwal teoretis: baris hanya ada untuk bulan yang jurnalnya sudah ditulis. Pelepasan
 * membaca akumulasi dari sini, bukan dari jadwalnya, karena bulan yang belum dijurnal belum pernah
 * menyentuh 1-1520 — mengeluarkan lebih banyak daripada yang pernah masuk membuat neracanya tetap
 * seimbang sementara angkanya salah.
 */
export const fixedAssetDepreciationEntries = mysqlTable("fixed_asset_depreciation_entries", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  /** "YYYY-MM". */
  periodMonth: varchar("periodMonth", { length: 7 }).notNull(),
  periodId: int("periodId").notNull(),
  charge: decimal("charge", { precision: 24, scale: 2 }).notNull(),
  accumulatedAfter: decimal("accumulatedAfter", { precision: 24, scale: 2 }).notNull(),
  carryingAfter: decimal("carryingAfter", { precision: 24, scale: 2 }).notNull(),
  journalEntryId: int("journalEntryId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("fixed_asset_depreciation_asset_month_uq").on(table.assetId, table.periodMonth),
  index("fixed_asset_depreciation_month_idx").on(table.periodMonth),
  index("fixed_asset_depreciation_period_idx").on(table.periodId),
]);

export type FixedAssetDepreciationEntry = typeof fixedAssetDepreciationEntries.$inferSelect;

/**
 * Kebijakan akuntansi aset tetap. Satu baris, `id = 1`.
 *
 * Sengaja **bukan** kolom pada `operational_settings`: tabel itu menyatakan dirinya "configurable
 * compliance thresholds" dan dibaca `adminProcedure`, sementara batas kapitalisasi menentukan apa
 * yang masuk neraca dan apa yang masuk laba rugi — itu keputusan Controller.
 */
export const fixedAssetSettings = mysqlTable("fixed_asset_settings", {
  id: int("id").autoincrement().primaryKey(),
  capitalisationThresholdIdr: decimal("capitalisationThresholdIdr", { precision: 24, scale: 2 }).default("1000000.00").notNull(),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Bukti retranslasi pos moneter valuta asing pada akhir periode.
 *
 * SAK EP Bab 30 menuntut saldo pos moneter dalam valuta asing diukur ulang pada kurs penutup, dengan
 * selisihnya ke laba rugi. Barisnya dibuat **berdiri sendiri**: `carryingAfter` dapat diturunkan
 * ulang dari `foreignBalance` dikali `midRatePerUnit` tanpa membuka tabel lain, dan
 * `rateReferenceDate` memperlihatkan bila kurs yang dipakai mundur dari akhir periode. Pola dan
 * alasannya sama dengan `period_closing_valuations`.
 *
 * Hanya pos **moneter**. Kas UKA fisik (1-1210) tidak pernah masuk ke sini — ia persediaan, dinilai
 * dari hitungan fisik lewat 5-1300, dan meretranslasinya di sini menghitung pergerakan kurs yang
 * sama dua kali sementara neracanya tetap seimbang.
 */
export const currencyRevaluations = mysqlTable("currency_revaluations", {
  id: int("id").autoincrement().primaryKey(),
  periodId: int("periodId").notNull(),
  currencyId: int("currencyId").notNull(),
  /** Saldo rekening dalam valuta aslinya pada akhir periode; skala 6 seperti mutasi bank. */
  foreignBalance: decimal("foreignBalance", { precision: 24, scale: 6 }).notNull(),
  /** Nilai Rupiah yang tercatat pada 1-1220 untuk mata uang ini sebelum revaluasi. */
  carryingBefore: decimal("carryingBefore", { precision: 24, scale: 2 }).notNull(),
  rateSnapshotId: int("rateSnapshotId").notNull(),
  rateReferenceDate: date("rateReferenceDate").notNull(),
  midRatePerUnit: decimal("midRatePerUnit", { precision: 30, scale: 12 }).notNull(),
  /** foreignBalance × midRatePerUnit, dibulatkan ke sen. */
  carryingAfter: decimal("carryingAfter", { precision: 24, scale: 2 }).notNull(),
  /** carryingAfter − carryingBefore. Positif berarti laba selisih kurs. */
  difference: decimal("difference", { precision: 24, scale: 2 }).notNull(),
  journalEntryId: int("journalEntryId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("currency_revaluation_period_currency_uq").on(table.periodId, table.currencyId),
  index("currency_revaluation_period_idx").on(table.periodId),
]);

export type CurrencyRevaluationRecord = typeof currencyRevaluations.$inferSelect;

/**
 * Pelunasan kewajiban dan penagihan piutang — sisi kas yang selama ini hilang.
 *
 * `mapExpense` dan `mapFixedAssetAcquisition` sama-sama mengkredit 2-1900, dan
 * `mapFixedAssetDisposal` mendebit 1-1320, karena modul di luar sistem kas yang menyentuh 1-1110
 * akan membuat kas buku besar berbeda dari `cash_balances` — temuan pemeriksaan 7.2/7.3. Yang
 * dijanjikan sebagai lanjutannya ("pelunasannya dijurnal terpisah saat kas benar-benar keluar")
 * tidak pernah ditulis sampai paket F2, sehingga tidak ada satu pun pembayaran beban maupun
 * perolehan aset yang pernah menjadi arus kas.
 *
 * Baris di sini mengikat mutasi kas/bank ke **apa** yang dilunasinya, dan hanya itu tugasnya.
 * Jurnalnya sendiri sama untuk beban maupun aset tetap (Dr 2-1900 / Cr kas), sehingga `targetType`
 * inilah satu-satunya penanda yang memisahkan bagian operasi dari bagian investasi pada Laporan
 * Arus Kas — dan ia tercatat, bukan ditebak dari akun lawan yang memang tidak membedakannya.
 */
export const ledgerSettlements = mysqlTable("ledger_settlements", {
  id: int("id").autoincrement().primaryKey(),
  settlementDate: date("settlementDate").notNull(),
  direction: mysqlEnum("direction", ["PEMBAYARAN", "PENERIMAAN"]).notNull(),
  targetType: mysqlEnum("targetType", ["BEBAN", "ASET_TETAP"]).notNull(),
  expenseId: int("expenseId"),
  fixedAssetId: int("fixedAssetId"),
  amount: decimal("amount", { precision: 24, scale: 2 }).notNull(),
  /**
   * Tepat satu dari keduanya terisi; menentukan akun kas mana yang bergerak. Keduanya berindeks
   * unik, dan itulah yang mencegah satu mutasi kas dihitung dua kali sebagai pelunasan — MySQL
   * mengizinkan banyak NULL menembus indeks unik, sehingga sisi yang tidak dipakai tidak saling
   * menghalangi (pola yang sama dengan `cash_balance_transaction_line_movement_uq`).
   */
  cashMovementId: int("cashMovementId"),
  bankMovementId: int("bankMovementId"),
  notes: varchar("notes", { length: 500 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ledger_settlement_cash_movement_uq").on(table.cashMovementId),
  uniqueIndex("ledger_settlement_bank_movement_uq").on(table.bankMovementId),
  index("ledger_settlement_expense_idx").on(table.expenseId),
  index("ledger_settlement_asset_idx").on(table.fixedAssetId),
  index("ledger_settlement_date_idx").on(table.settlementDate),
]);

export type LedgerSettlement = typeof ledgerSettlements.$inferSelect;

/**
 * Teks naratif Catatan atas Laporan Keuangan.
 *
 * CALK-nya hibrida: catatan yang angkanya diketahui buku besar dibangkitkan dan tidak pernah
 * diketik, sehingga mustahil berselisih dengan laporannya; yang tersimpan di sini hanya catatan
 * yang memang pertimbangan manajemen — kebijakan akuntansi, dasar penyusunan, peristiwa setelah
 * periode pelaporan, pihak berelasi.
 *
 * `periodKey` NULL berarti teks yang berlaku terus, dan itu bukan penyederhanaan: kebijakan
 * akuntansi tidak berganti tiap bulan, sedangkan peristiwa setelah periode pelaporan selalu
 * berganti. Baris berperiode menang atas baris NULL, sehingga laporan periode lampau tetap
 * menampilkan teks yang berlaku baginya alih-alih teks yang diubah sesudahnya.
 */
export const financialStatementNotes = mysqlTable("financial_statement_notes", {
  id: int("id").autoincrement().primaryKey(),
  noteKey: varchar("noteKey", { length: 60 }).notNull(),
  /** "YYYY-MM" bulan akhir laporan, atau NULL untuk teks yang berlaku terus. */
  periodKey: varchar("periodKey", { length: 7 }),
  bodyText: text("bodyText").notNull(),
  updatedByUserId: int("updatedByUserId").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("financial_note_key_period_uq").on(table.noteKey, table.periodKey),
]);

export type FinancialStatementNote = typeof financialStatementNotes.$inferSelect;


/**
 * Asal sebuah jurnal. `MANUAL` diketik manusia; sisanya dihasilkan sistem dari catatan operasional
 * yang sudah ada, sehingga tidak ada entri ulang dan tidak ada kesempatan angka buku besar berbeda
 * dari angka operasionalnya.
 */
export const journalSourceTypes = [
  "MANUAL",
  "SALDO_AWAL",
  "TRANSAKSI_VALUTA",
  "PENGELUARAN",
  "MUTASI_KAS",
  "MUTASI_BANK",
  "PENYUSUTAN",
  /**
   * Perolehan dan pelepasan aset tetap. Dipisahkan dari `PENYUSUTAN` karena paket F menyusun
   * bagian **investasi** Arus Kas dengan mengenali kedua kejadian ini, dan `sourceType` adalah
   * satu-satunya penanda yang tidak menebak.
   */
  "PEROLEHAN_ASET",
  "PELEPASAN_ASET",
  "REVALUASI_KURS",
  "TUTUP_PERIODE",
] as const;

export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  entryNumber: varchar("entryNumber", { length: 40 }).notNull(),
  entryDate: date("entryDate").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  sourceType: mysqlEnum("sourceType", journalSourceTypes).default("MANUAL").notNull(),
  /**
   * Rujukan ke catatan operasional asalnya (mis. nomor bon, id pengeluaran). Bersama `sourceType`
   * membentuk kunci unik, sehingga penjurnalan otomatis yang dijalankan dua kali tidak pernah
   * menghasilkan jurnal ganda. Jurnal manual mengisinya NULL — MySQL mengizinkan banyak NULL pada
   * indeks unik, jadi jurnal manual tidak saling menghalangi.
   */
  sourceReference: varchar("sourceReference", { length: 120 }),
  /** Dimensi cabang. Disediakan sejak awal agar penambahan cabang tidak menulis ulang jurnal. */
  branchId: int("branchId"),
  totalDebit: decimal("totalDebit", { precision: 24, scale: 2 }).notNull(),
  totalCredit: decimal("totalCredit", { precision: 24, scale: 2 }).notNull(),
  /** Terisi pada jurnal koreksi; menunjuk jurnal yang dibalik olehnya. */
  reversesEntryId: int("reversesEntryId"),
  reversalReason: text("reversalReason"),
  postedByUserId: int("postedByUserId").notNull(),
  postedAt: datetime("postedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("journal_entries_number_uq").on(table.entryNumber),
  uniqueIndex("journal_entries_source_uq").on(table.sourceType, table.sourceReference),
  index("journal_entries_date_idx").on(table.entryDate, table.id),
  index("journal_entries_reverses_idx").on(table.reversesEntryId),
]);

/**
 * Baris jurnal. Tidak pernah diubah maupun dihapus setelah tersimpan; koreksi selalu berupa jurnal
 * balik, sehingga buku besar yang ditunjukkan kepada pemeriksa memuat kekeliruannya sekaligus
 * perbaikannya, bukan hanya hasil akhir yang rapi.
 */
export const journalEntryLines = mysqlTable("journal_entry_lines", {
  id: int("id").autoincrement().primaryKey(),
  entryId: int("entryId").notNull(),
  lineNumber: int("lineNumber").notNull(),
  accountCode: varchar("accountCode", { length: 12 }).notNull(),
  side: mysqlEnum("side", ["DEBIT", "KREDIT"]).notNull(),
  /** Selalu Rupiah — mata uang fungsional. Nilai valuta asingnya dicatat terpisah di bawah. */
  amount: decimal("amount", { precision: 24, scale: 2 }).notNull(),
  /** Terisi bila baris ini berasal dari pergerakan valuta asing, untuk penelusuran dan revaluasi. */
  currencyCode: varchar("currencyCode", { length: 3 }),
  foreignAmount: decimal("foreignAmount", { precision: 24, scale: 6 }),
  branchId: int("branchId"),
  memo: varchar("memo", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("journal_entry_lines_entry_line_uq").on(table.entryId, table.lineNumber),
  index("journal_entry_lines_account_idx").on(table.accountCode, table.entryId),
]);

export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type AccountingPeriod = typeof accountingPeriods.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;

export const profileReviewOutcomes = ["TIDAK_ADA_PERUBAHAN", "ADA_PERUBAHAN", "PERLU_TINDAK_LANJUT"] as const;

/**
 * Peninjauan berkala profil pegawai.
 *
 * Pemeriksaan menemukan profil pegawai tidak pernah dikinikan setelah perekrutan, sehingga
 * perubahan keadaan pegawai - termasuk yang menaikkan risiko - tidak pernah terlihat. Satu baris
 * per peninjauan, bukan satu kolom "terakhir ditinjau" pada tabel pegawai, karena yang diminta
 * pemeriksa adalah jejak peninjauannya beserta hasilnya, bukan sekadar tanggal terakhir.
 */
export const employeeProfileReviews = mysqlTable("employee_profile_reviews", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  reviewedAt: datetime("reviewedAt").notNull(),
  outcome: mysqlEnum("outcome", profileReviewOutcomes).notNull(),
  /** Ringkasan perubahan yang ditemukan; wajib diisi bila hasilnya bukan "tidak ada perubahan". */
  notes: text("notes"),
  reviewedByUserId: int("reviewedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("employee_profile_reviews_employee_idx").on(table.employeeId, table.reviewedAt),
]);

/**
 * Peninjauan berkala profil nasabah.
 *
 * Meniru `employee_profile_reviews` dan memakai ulang `profileReviewOutcomes` apa adanya — dua
 * kosakata hasil peninjauan yang berbeda untuk persoalan yang sama hanya akan membingungkan
 * pemeriksanya. Satu baris per peninjauan, bukan satu kolom "terakhir ditinjau" pada `customers`,
 * karena yang diminta pemeriksa adalah jejak peninjauannya beserta hasilnya.
 *
 * Iramanya mengikuti risiko nasabah (HIGH sebulan, MEDIUM tiga bulan, LOW setahun); lihat
 * `shared/transactionProfile.ts`.
 */
export const customerProfileReviews = mysqlTable("customer_profile_reviews", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  reviewedAt: datetime("reviewedAt").notNull(),
  outcome: mysqlEnum("outcome", profileReviewOutcomes).notNull(),
  /** Ringkasan yang ditemukan; wajib diisi bila hasilnya bukan "tidak ada perubahan". */
  notes: text("notes"),
  /**
   * Alasan penyimpangan yang terlihat saat peninjauan, dibekukan apa adanya dan tidak dihitung
   * ulang saat dibaca: peninjauan adalah pernyataan tentang apa yang terlihat saat itu, dan
   * menghitungnya ulang enam bulan kemudian akan mengubah isi catatan yang sudah ditandatangani.
   */
  deviationReasons: json("deviationReasons").$type<string[]>(),
  reviewedByUserId: int("reviewedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("customer_profile_reviews_customer_idx").on(table.customerId, table.reviewedAt),
]);

export type CustomerProfileReview = typeof customerProfileReviews.$inferSelect;

export type Employee = typeof employees.$inferSelect;
export type EmployeeCertification = typeof employeeCertifications.$inferSelect;
export type EmployeePicAssignment = typeof employeePicAssignments.$inferSelect;
export type ApuTrainingSession = typeof apuTrainingSessions.$inferSelect;
export type EmployeeProfileReview = typeof employeeProfileReviews.$inferSelect;
export type EmployeeCandidate = typeof employeeCandidates.$inferSelect;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type StaffRole = User["role"];
