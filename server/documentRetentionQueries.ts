import { and, eq, inArray, isNull, or } from "drizzle-orm";
import {
  auditLogs,
  companyProfile,
  customerProfileReviews,
  customers,
  customerWatchlistScreenings,
  exchangeTransactions,
  operationalDocuments,
} from "../drizzle/schema";
import {
  companyProfileDocumentRetention,
  customerDocumentRetention,
  relationshipEndDenial,
  transactionDocumentRetention,
  type CustomerProfileStatus,
  type RetentionVerdict,
} from "../shared/documentRetention";
import { DEFAULT_OPERATIONAL_TIMEZONE, operationalDateKey, startOfOperationalDay } from "../shared/regulatoryActionQueue";
import { affectedRows } from "./dbResult";
import { databaseOrThrow } from "./operations";

/**
 * Pembacaan penatausahaan dokumen — Pasal 48 PBI 10/2024. **Hanya membaca**, kecuali satu penulis:
 * `recordRelationshipEnd`, yang mengisi tanggal berakhir hubungan atas keputusan Controller.
 *
 * Yang sudah lewat tenggat TIDAK dihapus dan tidak diusulkan dihapus: Pasal 48 menetapkan batas
 * PALING SINGKAT, dan ayat (6) justru membolehkan penatausahaan lebih lama. Aturan retensinya
 * sendiri tinggal di `shared/documentRetention.ts`; berkas ini hanya mengumpulkan faktanya.
 *
 * Tiap jenis baris dibaca satu kali lalu dipilah di sini, bukan hanya di SQL, supaya kaidahnya
 * (transaksi COMPLETED saja, peninjauan dengan alasan penyimpangan saja) terlihat dan teruji.
 */

type Db = Awaited<ReturnType<typeof databaseOrThrow>>;

export const CORRESPONDENCE_NOT_RETAINED = {
  tersedia: false as const,
  keterangan: "Korespondensi dengan nasabah (Pasal 48 ayat (2) huruf d) tidak ditatausahakan di aplikasi ini. Pengaduan konsumen berkunci pada nomor identitas pelapor, bukan pada nasabah.",
};

async function operationalTimeZone(db: Db) {
  const [profile] = await db.select({ timezone: companyProfile.timezone }).from(companyProfile).limit(1);
  return profile?.timezone || DEFAULT_OPERATIONAL_TIMEZONE;
}

/** `deviationReasons` adalah kolom JSON; driver dapat mengembalikannya sebagai larik atau teks. */
function hasDeviation(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

function latest(dates: (Date | null | undefined)[]): Date | null {
  return dates.reduce<Date | null>((best, value) => (value && (!best || value.getTime() > best.getTime()) ? value : best), null);
}

/**
 * Pernyataan retensi satu nasabah — jawaban Pasal 48 ayat (4) dalam satu panggilan: identitas,
 * jam retensinya, setiap dokumen beserta tenggatnya, dan catatan yang ikut ditatausahakan.
 */
export async function customerRetentionStatement(customerId: number) {
  const db = await databaseOrThrow();

  const [customer] = await db.select({
    id: customers.id,
    cifNumber: customers.cifNumber,
    fullName: customers.fullName,
    profileStatus: customers.profileStatus,
    relationshipEndedAt: customers.relationshipEndedAt,
  })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.isDemo, false), eq(customers.isHistorical, false)))
    .limit(1);
  if (!customer) throw new Error("Nasabah tidak ditemukan.");

  const timeZone = await operationalTimeZone(db);

  const transactions = await db.select({
    id: exchangeTransactions.id,
    transactionNumber: exchangeTransactions.transactionNumber,
    transactionAt: exchangeTransactions.transactionAt,
    status: exchangeTransactions.status,
  })
    .from(exchangeTransactions)
    .where(and(eq(exchangeTransactions.customerId, customerId), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false)));

  const reviews = await db.select({ reviewedAt: customerProfileReviews.reviewedAt, deviationReasons: customerProfileReviews.deviationReasons })
    .from(customerProfileReviews)
    .where(eq(customerProfileReviews.customerId, customerId));

  const screenings = await db.select({ id: customerWatchlistScreenings.id })
    .from(customerWatchlistScreenings)
    .where(eq(customerWatchlistScreenings.customerId, customerId));

  const transactionIds = transactions.map((row) => row.id);
  const ownedByCustomer = and(eq(operationalDocuments.ownerType, "CUSTOMER"), eq(operationalDocuments.customerId, customerId));
  const documents = await db.select({
    id: operationalDocuments.id,
    ownerType: operationalDocuments.ownerType,
    documentType: operationalDocuments.documentType,
    originalFileName: operationalDocuments.originalFileName,
    customerId: operationalDocuments.customerId,
    transactionId: operationalDocuments.transactionId,
    createdAt: operationalDocuments.createdAt,
  })
    .from(operationalDocuments)
    .where(transactionIds.length
      ? or(ownedByCustomer, and(eq(operationalDocuments.ownerType, "TRANSACTION"), inArray(operationalDocuments.transactionId, transactionIds)))
      : ownedByCustomer);

  const lastCompletedTransactionAt = latest(transactions.filter((row) => row.status === "COMPLETED" || row.status === "REVERSED").map((row) => row.transactionAt));
  const lastDeviationReviewAt = latest(reviews.filter((row) => hasDeviation(row.deviationReasons)).map((row) => row.reviewedAt));

  const customerVerdict = customerDocumentRetention({
    profileStatus: customer.profileStatus as CustomerProfileStatus,
    relationshipEndedAt: customer.relationshipEndedAt,
    lastCompletedTransactionAt,
    lastDeviationReviewAt,
  });

  const transactionsById = new Map(transactions.map((row) => [row.id, row]));
  const transactionRows = [...transactions]
    .sort((a, b) => b.transactionAt.getTime() - a.transactionAt.getTime())
    .map((row) => ({ ...row, verdict: transactionDocumentRetention(row.transactionAt, customerVerdict, timeZone) }));

  const customerDocuments = documents
    .filter((row) => row.ownerType === "CUSTOMER" && row.customerId === customerId)
    .map((row) => ({ id: row.id, documentType: row.documentType, originalFileName: row.originalFileName, createdAt: row.createdAt, verdict: customerVerdict }));

  const transactionDocuments = documents.flatMap((row) => {
    const transaction = row.ownerType === "TRANSACTION" && row.transactionId ? transactionsById.get(row.transactionId) : undefined;
    if (!transaction) return [];
    return [{
      id: row.id,
      documentType: row.documentType,
      originalFileName: row.originalFileName,
      createdAt: row.createdAt,
      transactionId: transaction.id,
      transactionNumber: transaction.transactionNumber,
      transactionAt: transaction.transactionAt,
      verdict: transactionDocumentRetention(transaction.transactionAt, customerVerdict, timeZone) as RetentionVerdict,
    }];
  });

  return {
    customer,
    timeZone,
    facts: { lastCompletedTransactionAt, lastDeviationReviewAt },
    customerVerdict,
    customerDocuments,
    transactions: transactionRows,
    transactionDocuments,
    records: { watchlistScreenings: screenings.length, profileReviews: reviews.length },
    korespondensi: CORRESPONDENCE_NOT_RETAINED,
  };
}

/**
 * Ringkasan penatausahaan: nasabah yang hubungan usahanya sudah berakhir, berapa yang tenggat
 * retensinya sudah lewat, dan berapa dokumen profil perusahaan yang lewat aturan rumah lima tahun.
 *
 * `asOf` disuntikkan, bukan `new Date()` di dalam, supaya angkanya dapat diuji dan dapat ditanyakan
 * "per tanggal berapa" oleh pemeriksa.
 */
export async function documentRetentionOverview({ asOf = new Date() }: { asOf?: Date } = {}) {
  const db = await databaseOrThrow();

  const customerRows = await db.select({
    id: customers.id,
    fullName: customers.fullName,
    cifNumber: customers.cifNumber,
    profileStatus: customers.profileStatus,
    relationshipEndedAt: customers.relationshipEndedAt,
  })
    .from(customers)
    .where(and(eq(customers.isDemo, false), eq(customers.isHistorical, false)));

  const ended = customerRows.filter((row) => row.profileStatus === "INACTIVE" && row.relationshipEndedAt);
  const endedIds = ended.map((row) => row.id);

  const transactionRows = endedIds.length
    ? await db.select({ customerId: exchangeTransactions.customerId, transactionAt: exchangeTransactions.transactionAt, status: exchangeTransactions.status })
      .from(exchangeTransactions)
      .where(and(
        inArray(exchangeTransactions.customerId, endedIds),
        // Bon yang dibalik tetap pernah terjadi dan tetap memperpanjang masa simpan data nasabahnya.
        inArray(exchangeTransactions.status, ["COMPLETED", "REVERSED"]),
        eq(exchangeTransactions.isDemo, false),
        eq(exchangeTransactions.isHistorical, false),
      ))
    : [];

  const reviewRows = endedIds.length
    ? await db.select({ customerId: customerProfileReviews.customerId, reviewedAt: customerProfileReviews.reviewedAt, deviationReasons: customerProfileReviews.deviationReasons })
      .from(customerProfileReviews)
      .where(inArray(customerProfileReviews.customerId, endedIds))
    : [];

  let pastRetention = 0;
  for (const customer of ended) {
    const verdict = customerDocumentRetention({
      profileStatus: "INACTIVE",
      relationshipEndedAt: customer.relationshipEndedAt,
      lastCompletedTransactionAt: latest(transactionRows.filter((row) => row.customerId === customer.id && (row.status === "COMPLETED" || row.status === "REVERSED")).map((row) => row.transactionAt)),
      lastDeviationReviewAt: latest(reviewRows.filter((row) => row.customerId === customer.id && hasDeviation(row.deviationReasons)).map((row) => row.reviewedAt)),
    });
    if (verdict.retainUntil && verdict.retainUntil.getTime() <= asOf.getTime()) pastRetention += 1;
  }

  const companyDocuments = await db.select({ id: operationalDocuments.id, ownerType: operationalDocuments.ownerType, createdAt: operationalDocuments.createdAt, deactivatedAt: operationalDocuments.deactivatedAt })
    .from(operationalDocuments)
    .where(eq(operationalDocuments.ownerType, "COMPANY"));
  const companyRows = companyDocuments.filter((row) => row.ownerType === "COMPANY");
  const pastHouseRule = companyRows.filter((row) => {
    const retainUntil = companyProfileDocumentRetention(row.createdAt).retainUntil;
    return retainUntil !== null && retainUntil.getTime() <= asOf.getTime();
  }).length;

  return {
    asOf,
    customers: {
      relationshipOngoing: customerRows.filter((row) => row.profileStatus !== "INACTIVE").length,
      relationshipEnded: ended.length,
      pastRetention,
      /** INACTIVE yang dinonaktifkan sebelum migrasi 0058: jamnya tidak tercatat, jadi tidak dianggap berdetak. */
      inactiveWithoutEndDate: customerRows.filter((row) => row.profileStatus === "INACTIVE" && !row.relationshipEndedAt).length,
      /** Daftarnya, supaya Controller dapat mengisi tanggalnya dari sumber yang dapat ditunjukkan. */
      inactiveWithoutEndDateCustomers: customerRows.filter((row) => row.profileStatus === "INACTIVE" && !row.relationshipEndedAt).map((row) => ({ id: row.id, fullName: row.fullName, cifNumber: row.cifNumber })),
    },
    companyProfileDocuments: {
      total: companyRows.length,
      deactivated: companyRows.filter((row) => row.deactivatedAt).length,
      pastHouseRule,
    },
  };
}

/**
 * Mengisi `relationshipEndedAt` bagi nasabah INACTIVE yang dinonaktifkan sebelum migrasi 0058.
 * Tidak pernah otomatis — tanggalnya berasal dari sumber yang disebut Controller dan disimpan di
 * audit. Sampai diisi, nasabahnya tanpa jam retensi: disimpan tanpa batas.
 */
export async function recordRelationshipEnd(input: { customerId: number; dateKey: string; source: string }, actor: { id: number }) {
  const source = input.source?.trim() ?? "";
  if (source.length < 3) throw new Error("Sumber tanggal berakhir wajib diisi.");
  const db = await databaseOrThrow();
  const [customer] = await db.select({ id: customers.id, profileStatus: customers.profileStatus, relationshipEndedAt: customers.relationshipEndedAt }).from(customers)
    .where(and(eq(customers.id, input.customerId), eq(customers.isDemo, false), eq(customers.isHistorical, false))).limit(1);
  if (!customer) throw new Error("Nasabah tidak ditemukan.");
  if (customer.profileStatus !== "INACTIVE") throw new Error("Hanya nasabah INACTIVE yang dapat diisi tanggal berakhir hubungannya.");
  if (customer.relationshipEndedAt) throw new Error("Tanggal berakhir hubungan nasabah ini sudah tercatat.");
  const timeZone = await operationalTimeZone(db);
  const transactions = await db.select({ transactionAt: exchangeTransactions.transactionAt }).from(exchangeTransactions)
    .where(and(eq(exchangeTransactions.customerId, input.customerId), inArray(exchangeTransactions.status, ["COMPLETED", "REVERSED"]), eq(exchangeTransactions.isDemo, false), eq(exchangeTransactions.isHistorical, false)));
  const lastAt = latest(transactions.map((row) => row.transactionAt));
  const denial = relationshipEndDenial({ dateKey: input.dateKey, todayKey: operationalDateKey(new Date(), timeZone), lastTransactionDateKey: lastAt ? operationalDateKey(lastAt, timeZone) : null });
  if (denial) throw new Error(denial);
  // Tengah hari UTC pada tanggal itu jatuh di hari kalender yang sama untuk zona mana pun dalam daftar.
  const relationshipEndedAt = startOfOperationalDay(new Date(`${input.dateKey}T12:00:00Z`), timeZone);
  // Tulis bersyarat: dua Controller menyimpan bersamaan tidak boleh sama-sama lolos pemeriksaan di atas (temuan M8).
  const result = await db.update(customers).set({ relationshipEndedAt })
    .where(and(eq(customers.id, input.customerId), eq(customers.profileStatus, "INACTIVE"), isNull(customers.relationshipEndedAt)));
  if (affectedRows(result) !== 1) throw new Error("Tanggal berakhir hubungan nasabah ini sudah tercatat.");
  await db.insert(auditLogs).values({ actorUserId: actor.id, action: "CUSTOMER_RELATIONSHIP_END_RECORDED", entityType: "customer", entityId: String(input.customerId), beforeState: { relationshipEndedAt: null }, afterState: { relationshipEndedAt }, reason: source });
  return { relationshipEndedAt };
}
