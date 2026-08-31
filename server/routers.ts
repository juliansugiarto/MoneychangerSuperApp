import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { getRateSyncStatus, syncBiReferenceRates } from "./biRateSync";
import {
  acknowledgeDirectorItem,
  activateOperationalRates,
  activateOperationalRate,
  approveRegulatoryReportPackage,
  cancelTransaction,
  completeTransaction,
  createPublicAnnouncement,
  createPublicServiceRequest,
  createConsumerComplaint,
  createCurrency,
  ensureCurrency,
  createFinancialStatementSnapshot,
  createRegulatoryFinancialDraft,
  createRegulatoryIncidentReport,
  createRegulatoryLkuDraft,
  createCustomer,
  getCustomerById,
  getDailyOperationalChecklist,
  getNextCifNumber,
  createTransaction,
  getAuditLog,
  getHistoricalTransactionReport,
  getOperationalDashboard,
  getRegulatoryReportingReadiness,
  getRateComparisonDashboard,
  getReviewThreshold,
  getStockOpnameReport,
  getTransactionReport,
  importCustomers,
  listCurrencies,
  listCustomers,
  searchCustomers,
  listCashBalances,
  listCashDenominationBalances,
  listConsumerComplaints,
  listDirectorAcknowledgements,
  listFinancialStatementSnapshots,
  listMarketRateObservations,
  listOperationalRates,
  listPublicAnnouncements,
  listPublicAnnouncementsForStaff,
  listPublicActiveRates,
  listRegulatoryReportPackages,
  listRegulatoryIncidentReports,
  listReferenceSnapshots,
  listRateVolatilityAlerts,
  listServiceRequests,
  listTransactions,
  listTransactionDenominations,
  listStockOpnames,
  openStockOpname,
  recordOpeningCash,
  recordCashAdjustment,
  proposeOperationalRate,
  proposeLatestReferenceRates,
  recordMarketRateObservation,
  recordReviewAction,
  markRegulatoryReportExported,
  markRegulatoryIncidentExported,
  approveRegulatoryIncidentReport,
  returnRegulatoryReportPackage,
  prepareRegulatoryIncidentReport,
  prepareRegulatoryReportPackage,
  setRegulatoryReportManualDeadline,
  setCurrencyActive,
  submitTransaction,
  submitStockOpname,
  reconcileStockOpname,
  resolveRateVolatilityAlert,
  updateReviewThreshold,
  updateConsumerComplaint,
  updateDailyOperationalChecklist,
  updatePublicAnnouncement,
  updateServiceRequest,
} from "./operations";
import { getOperationalDocumentDownloadUrl, listOperationalDocuments } from "./documentOperations";
import { simulateArchiveReadiness, simulateClosing, simulateExchange, simulateRateShock } from "./simulation";
import { adminProcedure, controllerProcedure, protectedProcedure, publicProcedure, router, staffProcedure } from "./_core/trpc";
import { createInternalSession, hashPassword, internalSessionMaxAge, validateUsername, verifyInternalCredentials, verifyPassword } from "./internalAuth";
import { createInternalUser, getInternalUserById, listInternalUsers, updateInternalUserPassword, updateInternalUserRole, updateInternalUserStatus } from "./db";
import type { TrpcContext } from "./_core/context";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const decimalString = z.string().trim().regex(/^\d+(\.\d+)?$/, "Masukkan angka desimal yang valid.");
const workforceRole = z.enum(["ADMIN", "STAFF"]);
const creatableRole = z.enum(["ADMIN", "STAFF", "CONTROLLER"]);

function safeUser(user: NonNullable<TrpcContext["user"]>) {
  return { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, accountStatus: user.accountStatus, mustChangePassword: user.mustChangePassword, createdAt: user.createdAt, updatedAt: user.updatedAt, lastSignedIn: user.lastSignedIn };
}

async function setInternalSession(ctx: { req: Parameters<typeof getSessionCookieOptions>[0]; res: { cookie: (name: string, value: string, options: Record<string, unknown>) => unknown } }, user: NonNullable<TrpcContext["user"]>) {
  const token = await createInternalSession(user);
  ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: internalSessionMaxAge() });
}

function assertWorkforceAccount(user: Awaited<ReturnType<typeof getInternalUserById>>) {
  if (!user || !user.username || (user.role !== "ADMIN" && user.role !== "STAFF")) throw new Error("Hanya akun Admin atau Staff yang dapat dikelola melalui delegasi kewenangan.");
  return user;
}
export const beneficialOwnerInput = z.object({
  fullName: z.string().trim().min(3).max(200),
  identityType: z.enum(["KTP", "PASSPORT", "OTHER"]),
  identityNumber: z.string().trim().min(3).max(80),
  phoneNumber: z.string().trim().max(40).optional(),
  address: z.string().trim().min(8),
  occupation: z.string().trim().max(160).optional(),
  relationshipToCustomer: z.string().trim().min(2).max(200),
});
export const customerInput = z.object({
  cifNumber: z.string().trim().min(3).max(40),
  fullName: z.string().trim().min(3).max(200),
  phoneNumber: z.string().trim().min(6).max(40),
  identityType: z.enum(["KTP", "PASSPORT", "OTHER"]),
  identityNumber: z.string().trim().min(3).max(80),
  identityExpiryDate: z.coerce.date().optional(),
  placeOfBirth: z.string().trim().min(2).max(120),
  dateOfBirth: z.coerce.date(),
  address: z.string().trim().min(8),
  occupation: z.string().trim().min(2).max(160),
  sourceOfFunds: z.string().trim().min(3).max(1000),
  transactionPurpose: z.string().trim().min(3).max(1000),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  riskNotes: z.string().trim().max(1000).optional(),
  hasBeneficialOwner: z.boolean().optional(),
  beneficialOwner: beneficialOwnerInput.optional(),
  pepStatus: z.enum(["NONE", "SELF", "RELATED"]).optional(),
  pepDetails: z.string().trim().max(1000).optional(),
  dttotPpsdmMatch: z.boolean().optional(),
  dttotPpsdmNotes: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.hasBeneficialOwner && !value.beneficialOwner) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data pemilik manfaat (beneficial owner) wajib diisi.", path: ["beneficialOwner"] });
  }
  if (value.pepStatus && value.pepStatus !== "NONE" && !value.pepDetails?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Keterangan PEP wajib diisi.", path: ["pepDetails"] });
  }
  if (value.dttotPpsdmMatch && !value.dttotPpsdmNotes?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Catatan kecocokan DTTOT/PPSPM wajib diisi.", path: ["dttotPpsdmNotes"] });
  }
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ? safeUser(opts.ctx.user) : null),
    login: publicProcedure.input(z.object({ username: z.string().trim(), password: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      const user = await verifyInternalCredentials(input.username, input.password);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Username atau kata sandi tidak valid." });
      await setInternalSession(ctx, user);
      return safeUser(user);
    }),
    changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      if (!await verifyPassword(input.currentPassword, ctx.user.passwordHash)) throw new Error("Kata sandi saat ini tidak valid.");
      const updated = await updateInternalUserPassword(ctx.user.id, await hashPassword(input.newPassword), false);
      if (!updated) throw new Error("Akun tidak ditemukan.");
      await setInternalSession(ctx, updated);
      return safeUser(updated);
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      return {
        success: true,
      } as const;
    }),
  }),

  users: router({
    list: controllerProcedure.query(async () => listInternalUsers()),
    create: controllerProcedure.input(z.object({ username: z.string().trim(), name: z.string().trim().min(3).max(200), password: z.string().min(1), role: creatableRole })).mutation(async ({ input, ctx }) => {
      if (input.role === "CONTROLLER" && ctx.user.role !== "SHAREHOLDER") throw new TRPCError({ code: "FORBIDDEN", message: "Hanya Shareholder yang dapat menyiapkan akun Controller." });
      const created = await createInternalUser({ username: validateUsername(input.username), passwordHash: await hashPassword(input.password), name: input.name, role: input.role, mustChangePassword: true });
      if (!created) throw new Error("Akun tidak dapat dibuat.");
      return safeUser(created);
    }),
    setRole: controllerProcedure.input(z.object({ userId: z.number().int().positive(), role: workforceRole })).mutation(async ({ input }) => {
      assertWorkforceAccount(await getInternalUserById(input.userId));
      const updated = await updateInternalUserRole(input.userId, input.role);
      if (!updated) throw new Error("Akun tidak ditemukan.");
      return safeUser(updated);
    }),
    setStatus: controllerProcedure.input(z.object({ userId: z.number().int().positive(), accountStatus: z.enum(["ACTIVE", "SUSPENDED"]) })).mutation(async ({ input }) => {
      assertWorkforceAccount(await getInternalUserById(input.userId));
      const updated = await updateInternalUserStatus(input.userId, input.accountStatus);
      if (!updated) throw new Error("Akun tidak ditemukan.");
      return safeUser(updated);
    }),
    resetPassword: controllerProcedure.input(z.object({ userId: z.number().int().positive(), newPassword: z.string().min(1) })).mutation(async ({ input }) => {
      assertWorkforceAccount(await getInternalUserById(input.userId));
      const updated = await updateInternalUserPassword(input.userId, await hashPassword(input.newPassword), true);
      if (!updated) throw new Error("Akun tidak ditemukan.");
      return safeUser(updated);
    }),
  }),

  rates: router({
    activeRates: publicProcedure.query(() => listPublicActiveRates()),
    syncStatus: adminProcedure.query(() => getRateSyncStatus()),
    syncNow: adminProcedure.mutation(({ ctx }) => syncBiReferenceRates("MANUAL", ctx.user.id)),
    references: adminProcedure.query(() => listReferenceSnapshots()),
    marketObservations: adminProcedure.query(() => listMarketRateObservations()),
    comparison: adminProcedure.query(() => getRateComparisonDashboard()),
    volatilityAlerts: controllerProcedure.query(() => listRateVolatilityAlerts()),
    recordObservation: adminProcedure.input(z.object({ currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/), sourceName: z.string().trim().min(2).max(80), sourceKind: z.enum(["OFFICIAL", "MARKET", "MANUAL"]), sourceUrl: z.string().trim().url().max(500).optional(), quoteUnit: decimalString, buyRate: decimalString, sellRate: decimalString, observedAt: z.coerce.date().optional(), notes: z.string().trim().max(1000).optional() })).mutation(({ input, ctx }) => recordMarketRateObservation(input, ctx.user.id)),
    resolveVolatilityAlert: adminProcedure.input(z.object({ alertId: z.number().int().positive(), notes: z.string().trim().min(3).max(1000) })).mutation(({ input, ctx }) => resolveRateVolatilityAlert(input, ctx.user.id)),
    listOperational: adminProcedure.query(() => listOperationalRates()),
    propose: adminProcedure.input(z.object({ currencyId: z.number().int().positive(), referenceSnapshotId: z.number().int().positive().nullable().optional(), quoteUnit: decimalString, buyRate: decimalString, sellRate: decimalString, effectiveAt: z.coerce.date(), notes: z.string().trim().max(1000).optional() })).mutation(({ input, ctx }) => proposeOperationalRate(input, ctx.user.id)),
    proposeLatest: adminProcedure.mutation(({ ctx }) => proposeLatestReferenceRates(ctx.user.id)),
    activate: adminProcedure.input(z.object({ rateId: z.number().int().positive(), approvalReason: z.string().trim().min(10).max(1000) })).mutation(({ input, ctx }) => activateOperationalRate(input.rateId, ctx.user.id, input.approvalReason)),
    activateMany: adminProcedure.input(z.object({ rateIds: z.array(z.number().int().positive()).min(1).max(100), approvalReason: z.string().trim().min(10).max(1000) })).mutation(({ input, ctx }) => activateOperationalRates(input.rateIds, ctx.user.id, input.approvalReason)),
  }),

  publicContent: router({
    announcements: publicProcedure.query(() => listPublicAnnouncements()),
  }),

  serviceRequests: router({
    create: publicProcedure.input(z.object({
      requesterName: z.string().trim().min(3).max(200),
      contactChannel: z.enum(["PHONE", "WHATSAPP", "EMAIL"]),
      contactValue: z.string().trim().min(6).max(320),
      currencyId: z.number().int().positive(),
      operation: z.enum(["BUY", "SELL"]),
      foreignAmount: decimalString,
      preferredServiceAt: z.coerce.date().optional(),
      contactConsent: z.literal(true),
    })).mutation(({ input }) => createPublicServiceRequest(input)),
    list: staffProcedure.query(() => listServiceRequests()),
    update: staffProcedure.input(z.object({
      requestId: z.number().int().positive(),
      status: z.enum(["MENUNGGU_VERIFIKASI", "KURS_DIKONFIRMASI", "SIAP_DILAYANI", "KEDALUWARSA", "DIBATALKAN"]),
      staffNotes: z.string().trim().max(2000).optional(),
      confirmedOperationalRateId: z.number().int().positive().optional(),
      confirmedRateExpiresAt: z.coerce.date().optional(),
    })).mutation(({ input, ctx }) => updateServiceRequest(input, ctx.user.id)),
  }),

  announcements: router({
    list: adminProcedure.query(() => listPublicAnnouncementsForStaff()),
    create: adminProcedure.input(z.object({ title: z.string().trim().min(5).max(180), content: z.string().trim().min(10).max(4000), expiresAt: z.coerce.date().optional() })).mutation(({ input, ctx }) => createPublicAnnouncement(input, ctx.user.id)),
    update: adminProcedure.input(z.object({ announcementId: z.number().int().positive(), title: z.string().trim().min(5).max(180), content: z.string().trim().min(10).max(4000), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]), expiresAt: z.coerce.date().optional() })).mutation(({ input, ctx }) => updatePublicAnnouncement(input, ctx.user.id)),
  }),

  settings: router({
    reviewThreshold: adminProcedure.query(() => getReviewThreshold()),
    updateReviewThreshold: adminProcedure.input(z.object({ reviewThresholdUsd: decimalString, eddCashDailyThresholdIdr: decimalString.optional(), rateShockThresholdPercent: decimalString.optional() })).mutation(({ input, ctx }) => updateReviewThreshold(input.reviewThresholdUsd, ctx.user.id, input.eddCashDailyThresholdIdr, input.rateShockThresholdPercent)),
  }),

  currencies: router({
    list: staffProcedure.query(() => listCurrencies()),
    create: adminProcedure.input(z.object({ code: z.string().trim().regex(/^[A-Za-z]{3}$/), name: z.string().trim().min(3).max(100) })).mutation(({ input, ctx }) => createCurrency({ ...input, actorUserId: ctx.user.id })),
    setActive: adminProcedure.input(z.object({ currencyId: z.number().int().positive(), active: z.boolean() })).mutation(({ input, ctx }) => setCurrencyActive({ ...input, actorUserId: ctx.user.id })),
    /** Staff-level, idempotent: registers a world currency on first use (e.g. picked from a search box) without needing an Admin to pre-create it. Never touches rates. */
    ensure: staffProcedure.input(z.object({ code: z.string().trim().regex(/^[A-Za-z]{3}$/), name: z.string().trim().min(1).max(100) })).mutation(({ input }) => ensureCurrency(input)),
  }),

  customers: router({
    list: staffProcedure.query(() => listCustomers()),
    nextCif: staffProcedure.query(() => getNextCifNumber()),
    get: staffProcedure.input(z.object({ customerId: z.number().int().positive() })).query(({ input }) => getCustomerById(input.customerId)),
    search: staffProcedure.input(z.object({ query: z.string().trim().max(200), limit: z.number().int().min(1).max(30).default(12) })).query(({ input }) => searchCustomers(input.query, input.limit)),
    create: staffProcedure.input(customerInput).mutation(({ input, ctx }) => createCustomer(input, ctx.user.id)),
    import: controllerProcedure.input(z.object({ rows: z.array(customerInput).min(1).max(300) })).mutation(({ input, ctx }) => importCustomers(input.rows, ctx.user.id)),
  }),

  documents: router({
    forCustomer: staffProcedure.input(z.object({ customerId: z.number().int().positive() })).query(({ input }) => listOperationalDocuments({ customerId: input.customerId })),
    forTransaction: staffProcedure.input(z.object({ transactionId: z.number().int().positive() })).query(({ input }) => listOperationalDocuments({ transactionId: input.transactionId })),
    downloadUrl: staffProcedure.input(z.object({ documentId: z.number().int().positive() })).query(({ input }) => getOperationalDocumentDownloadUrl(input.documentId)),
  }),

  complaints: router({
    list: staffProcedure.query(() => listConsumerComplaints()),
    create: staffProcedure.input(z.object({ reporterName: z.string().trim().min(3).max(200), reporterIdentityNumber: z.string().trim().min(3).max(80), reporterPhone: z.string().trim().min(6).max(40), reporterEmail: z.string().trim().email().max(320).optional().or(z.literal("")), transactionAt: z.coerce.date().optional(), receiptNumber: z.string().trim().max(80).optional(), transactionDetails: z.string().trim().max(1000).optional(), chronology: z.string().trim().min(10).max(4000), supportingDocuments: z.string().trim().max(1000).optional(), category: z.enum(["CASH_COUNT", "BOARD_RATE", "STAFF_SERVICE", "OTHER"]) })).mutation(({ input, ctx }) => createConsumerComplaint(input, ctx.user.id)),
    update: adminProcedure.input(z.object({ complaintId: z.number().int().positive(), status: z.enum(["IN_REVIEW", "RESOLVED", "ESCALATED_LAPS_BI"]), resolution: z.string().trim().max(4000).optional() })).mutation(({ input, ctx }) => updateConsumerComplaint(input, ctx.user.id)),
  }),

  transactions: router({
    list: staffProcedure.query(({ ctx }) => listTransactions(ctx.user)),
    denominations: staffProcedure.input(z.object({ transactionId: z.number().int().positive() })).query(({ input }) => listTransactionDenominations(input.transactionId)),
    create: staffProcedure.input(z.object({
      operation: z.enum(["BUY", "SELL"]),
      customerId: z.number().int().positive(),
      /** Physical receipt-book number, typed manually by the teller. Jual and Beli books are numbered independently. */
      receiptNumber: z.string().trim().min(1).max(80),
      lines: z.array(z.object({
        currencyId: z.number().int().positive(),
        quoteUnit: decimalString.optional(),
        /** Every denomination group is priced on its own (e.g. USD 100s vs USD 10s), so this is required — no line-level price/amount. */
        denominations: z.array(z.object({ value: decimalString, quantity: z.number().int().positive(), rate: decimalString })).min(1).max(50),
      })).min(1).max(30),
      dealNotes: z.string().trim().max(255).optional(),
      paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
      paymentReference: z.string().trim().max(160).optional(),
      transactionPurposeSnapshot: z.string().trim().min(3).max(1000).optional(),
      customerActingAs: z.enum(["SELF", "REPRESENTATIVE"]).default("SELF"),
      /** Registered customer id acting as representative/kuasa; must be picked from search, never typed freely. */
      representativeCustomerId: z.number().int().positive().optional(),
      underlyingRequired: z.boolean().default(false),
      underlyingReference: z.string().trim().max(160).optional(),
      underlyingNotes: z.string().trim().max(1000).optional(),
      transactionAt: z.coerce.date(),
    }).superRefine((value, ctx) => {
      if (value.customerActingAs === "REPRESENTATIVE" && !value.representativeCustomerId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pilih nasabah terdaftar sebagai pihak kuasa/wakil." });
      }
      if (value.underlyingRequired && !value.underlyingReference) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Referensi underlying wajib diisi." });
      }
    })).mutation(({ input, ctx }) => createTransaction(input, ctx.user.id)),
    submit: staffProcedure.input(z.object({ transactionId: z.number().int().positive() })).mutation(({ input, ctx }) => submitTransaction(input.transactionId, ctx.user)),
    cancel: staffProcedure.input(z.object({ transactionId: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) })).mutation(({ input, ctx }) => cancelTransaction(input.transactionId, input.reason, ctx.user)),
    review: adminProcedure.input(z.object({ transactionId: z.number().int().positive(), action: z.enum(["APPROVED", "RETURNED", "ESCALATED"]), notes: z.string().trim().min(3).max(1000) })).mutation(({ input, ctx }) => recordReviewAction(input, ctx.user.id)),
    complete: staffProcedure.input(z.object({ transactionId: z.number().int().positive() })).mutation(({ input, ctx }) => completeTransaction(input.transactionId, ctx.user)),
  }),

  dashboard: router({
    overview: staffProcedure.query(() => getOperationalDashboard()),
  }),

  dailyChecklist: router({
    today: staffProcedure.query(() => getDailyOperationalChecklist()),
    update: staffProcedure.input(z.object({ phase: z.enum(["OPENING", "CLOSING"]), checks: z.record(z.string(), z.boolean()), notes: z.string().trim().max(1000).optional() })).mutation(({ input, ctx }) => updateDailyOperationalChecklist(input, ctx.user.id)),
  }),

  directorAcknowledgements: router({
    list: controllerProcedure.query(() => listDirectorAcknowledgements()),
    acknowledge: controllerProcedure.input(z.object({ acknowledgementId: z.number().int().positive(), notes: z.string().trim().max(1000).optional() })).mutation(({ input, ctx }) => acknowledgeDirectorItem(input, ctx.user.id)),
  }),

  cash: router({
    balances: staffProcedure.query(() => listCashBalances()),
    denominationBalances: staffProcedure.query(() => listCashDenominationBalances()),
    recordOpening: staffProcedure.input(z.object({ currencyId: z.number().int().positive(), openingAmount: decimalString, notes: z.string().trim().max(500).optional(), denominations: z.array(z.object({ value: decimalString, quantity: z.number().int().positive() })).max(50).optional() })).mutation(({ input, ctx }) => recordOpeningCash(input, ctx.user)),
    recordAdjustment: controllerProcedure.input(z.object({ currencyId: z.number().int().positive(), category: z.enum(["SAFE_DEPOSIT", "SAFE_WITHDRAWAL", "OFF_HOURS_SALE", "OTHER"]), amount: decimalString, notes: z.string().trim().min(5).max(500), denominations: z.array(z.object({ value: decimalString, quantity: z.number().int().positive() })).max(50).optional() })).mutation(({ input, ctx }) => recordCashAdjustment(input, ctx.user)),
  }),

  stockOpname: router({
    list: staffProcedure.query(({ ctx }) => listStockOpnames(ctx.user)),
    open: staffProcedure.input(z.object({ currencyId: z.number().int().positive() })).mutation(({ input, ctx }) => openStockOpname({ currencyId: input.currencyId, actorUserId: ctx.user.id })),
    submit: staffProcedure.input(z.object({ stockOpnameId: z.number().int().positive(), physicalBalance: decimalString, varianceNotes: z.string().trim().max(1000).optional() })).mutation(({ input, ctx }) => submitStockOpname(input, ctx.user)),
    reconcile: adminProcedure.input(z.object({ stockOpnameId: z.number().int().positive(), notes: z.string().trim().min(3).max(1000) })).mutation(({ input, ctx }) => reconcileStockOpname(input, ctx.user.id)),
  }),

  simulation: router({
    exchange: staffProcedure.input(z.object({ foreignAmount: decimalString, rate: decimalString, quoteUnit: decimalString })).mutation(({ input }) => simulateExchange(input)),
    closing: staffProcedure.input(z.object({ systemBalance: decimalString, physicalBalance: decimalString })).mutation(({ input }) => simulateClosing(input)),
    rateShock: staffProcedure.input(z.object({ referenceRate: decimalString, proposedRate: decimalString, reviewThresholdPercent: decimalString })).mutation(({ input }) => simulateRateShock(input)),
    archiveReadiness: staffProcedure.input(z.object({ closingChecklistComplete: z.boolean(), stockOpnameReconciled: z.boolean() })).mutation(({ input }) => simulateArchiveReadiness(input)),
  }),

  reports: router({
    transactions: controllerProcedure.input(z.object({ from: z.coerce.date(), to: z.coerce.date() })).query(({ input }) => getTransactionReport(input)),
    stockOpnames: controllerProcedure.input(z.object({ from: z.coerce.date(), to: z.coerce.date() })).query(({ input }) => getStockOpnameReport(input)),
    historicalTransactions: controllerProcedure.input(z.object({ from: z.coerce.date(), to: z.coerce.date(), limit: z.number().int().min(1).max(1000).default(1000) })).query(({ input }) => getHistoricalTransactionReport(input)),
  }),

  regulatoryReports: router({
    readiness: controllerProcedure.input(z.object({ from: z.coerce.date(), to: z.coerce.date() })).query(({ input }) => getRegulatoryReportingReadiness(input)),
    list: controllerProcedure.query(() => listRegulatoryReportPackages()),
    createLkuDraft: controllerProcedure.input(z.object({ from: z.coerce.date(), to: z.coerce.date() })).mutation(({ input, ctx }) => createRegulatoryLkuDraft(input, ctx.user.id)),
    prepare: controllerProcedure.input(z.object({ packageId: z.number().int().positive() })).mutation(({ input, ctx }) => prepareRegulatoryReportPackage(input.packageId, ctx.user.id)),
    approve: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), notes: z.string().trim().max(1000).optional() })).mutation(({ input, ctx }) => {
      if (ctx.user.role !== "SHAREHOLDER") throw new TRPCError({ code: "FORBIDDEN", message: "Hanya Shareholder yang dapat menyetujui paket pelaporan regulator." });
      return approveRegulatoryReportPackage(input.packageId, ctx.user.id, input.notes);
    }),
    returnForRevision: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), notes: z.string().trim().min(5).max(1000) })).mutation(({ input, ctx }) => {
      if (ctx.user.role !== "SHAREHOLDER") throw new TRPCError({ code: "FORBIDDEN", message: "Hanya Shareholder yang dapat mengembalikan paket pelaporan regulator." });
      return returnRegulatoryReportPackage(input.packageId, ctx.user.id, input.notes);
    }),
    setManualDeadline: controllerProcedure.input(z.object({ packageId: z.number().int().positive(), dueAt: z.coerce.date().nullable(), notes: z.string().trim().min(5).max(1000) })).mutation(({ input, ctx }) => setRegulatoryReportManualDeadline(input, ctx.user.id)),
    markExported: controllerProcedure.input(z.object({ packageId: z.number().int().positive() })).mutation(({ input, ctx }) => markRegulatoryReportExported(input.packageId, ctx.user.id)),
    financialSnapshots: router({
      list: controllerProcedure.query(() => listFinancialStatementSnapshots()),
      create: controllerProcedure.input(z.object({
        periodStart: z.coerce.date(), periodEnd: z.coerce.date(), sourceLabel: z.string().trim().min(3).max(180), sourceReference: z.string().trim().max(2000).optional(), sourceStorageKey: z.string().trim().max(500).optional(), sourceFileName: z.string().trim().max(255).optional(), sourceMimeType: z.string().trim().max(120).optional(),
        profitLossRows: z.array(z.object({ code: z.string().trim().min(1).max(40), label: z.string().trim().min(1).max(255), value: z.string().trim().min(1).max(40) })).min(1),
        balanceSheetRows: z.array(z.object({ code: z.string().trim().min(1).max(40), label: z.string().trim().min(1).max(255), value: z.string().trim().min(1).max(40) })).min(1),
        equityRows: z.array(z.object({ code: z.string().trim().min(1).max(40), label: z.string().trim().min(1).max(255), value: z.string().trim().min(1).max(40) })).min(1),
      })).mutation(({ input, ctx }) => createFinancialStatementSnapshot(input, ctx.user.id)),
    }),
    createFinancialDraft: controllerProcedure.input(z.object({ snapshotId: z.number().int().positive() })).mutation(({ input, ctx }) => createRegulatoryFinancialDraft(input.snapshotId, ctx.user.id)),
    incidents: router({
      list: controllerProcedure.query(() => listRegulatoryIncidentReports()),
      create: controllerProcedure.input(z.object({ category: z.enum(["GOVERNANCE", "OFFICE_OR_OUTLET", "BUSINESS_DISRUPTION", "FORCE_MAJEURE", "COOPERATION", "REGULATOR_REQUEST", "OTHER"]), incidentAt: z.coerce.date(), discoveredAt: z.coerce.date(), title: z.string().trim().min(5).max(255), description: z.string().trim().min(10).max(5000), evidenceReference: z.string().trim().max(2000).optional(), initialAction: z.string().trim().max(2000).optional() })).mutation(({ input, ctx }) => createRegulatoryIncidentReport(input, ctx.user.id)),
      prepare: controllerProcedure.input(z.object({ incidentId: z.number().int().positive() })).mutation(({ input, ctx }) => prepareRegulatoryIncidentReport(input.incidentId, ctx.user.id)),
      approve: protectedProcedure.input(z.object({ incidentId: z.number().int().positive(), notes: z.string().trim().max(1000).optional() })).mutation(({ input, ctx }) => {
        if (ctx.user.role !== "SHAREHOLDER") throw new TRPCError({ code: "FORBIDDEN", message: "Hanya Shareholder yang dapat menyetujui laporan insidental." });
        return approveRegulatoryIncidentReport(input.incidentId, ctx.user.id, input.notes);
      }),
      markExported: controllerProcedure.input(z.object({ incidentId: z.number().int().positive() })).mutation(({ input, ctx }) => markRegulatoryIncidentExported(input.incidentId, ctx.user.id)),
    }),
  }),

  audit: router({
    list: controllerProcedure.input(z.object({ limit: z.number().int().min(1).max(250).default(100) })).query(({ input }) => getAuditLog(input.limit)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
