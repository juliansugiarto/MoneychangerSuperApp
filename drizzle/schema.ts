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
  occupation: varchar("occupation", { length: 160 }),
  sourceOfFunds: text("sourceOfFunds"),
  transactionPurpose: text("transactionPurpose"),
  profileStatus: mysqlEnum("profileStatus", ["ACTIVE", "RESTRICTED", "INACTIVE"]).default("ACTIVE").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["LOW", "MEDIUM", "HIGH"]).default("LOW").notNull(),
  riskNotes: text("riskNotes"),
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
]);

export const exchangeTransactions = mysqlTable("exchange_transactions", {
  id: int("id").autoincrement().primaryKey(),
  transactionNumber: varchar("transactionNumber", { length: 50 }).notNull(),
  transactionAt: datetime("transactionAt").notNull(),
  operation: mysqlEnum("operation", ["BUY", "SELL"]).notNull(),
  customerId: int("customerId").notNull(),
  tellerUserId: int("tellerUserId").notNull(),
  currencyId: int("currencyId").notNull(),
  operationalRateId: int("operationalRateId").notNull(),
  foreignAmount: decimal("foreignAmount", { precision: 24, scale: 6 }).notNull(),
  /** Immutable numerical snapshot copied from the selected operational rate. */
  rateSnapshot: decimal("rateSnapshot", { precision: 24, scale: 6 }).notNull(),
  /** Immutable quote unit copied with the rate snapshot, e.g. 100 for JPY. */
  quoteUnitSnapshot: decimal("quoteUnitSnapshot", { precision: 18, scale: 6 }).notNull(),
  /** Immutable full-precision result in Rupiah, retained as decimal rather than float. */
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
  representativeName: varchar("representativeName", { length: 200 }),
  representativeIdentityNumber: varchar("representativeIdentityNumber", { length: 80 }),
  underlyingRequired: boolean("underlyingRequired").default(false).notNull(),
  underlyingReference: varchar("underlyingReference", { length: 160 }),
  underlyingNotes: text("underlyingNotes"),
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
  index("exchange_transactions_date_idx").on(table.transactionAt),
  index("exchange_transactions_live_date_idx").on(table.isDemo, table.isHistorical, table.transactionAt),
  index("exchange_transactions_status_idx").on(table.status, table.reviewStatus),
  index("exchange_transactions_customer_idx").on(table.customerId),
]);

/**
 * Private KYC and transaction-supporting documents. File bytes live in managed
 * object storage; this table retains authorization, audit, and retrieval metadata.
 */
export const operationalDocuments = mysqlTable("operational_documents", {
  id: int("id").autoincrement().primaryKey(),
  ownerType: mysqlEnum("ownerType", ["CUSTOMER", "TRANSACTION"]).notNull(),
  documentType: mysqlEnum("documentType", ["KTP_PHOTO", "UNDERLYING"]).notNull(),
  customerId: int("customerId"),
  transactionId: int("transactionId"),
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
  index("operational_documents_owner_type_idx").on(table.ownerType, table.documentType),
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
  direction: mysqlEnum("direction", ["IN", "OUT", "ADJUSTMENT"]).notNull(),
  amount: decimal("amount", { precision: 24, scale: 6 }).notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("cash_balance_transaction_movement_uq").on(table.transactionId),
  index("cash_balance_movements_balance_idx").on(table.cashBalanceId, table.createdAt),
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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type StaffRole = User["role"];
