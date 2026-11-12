import { and, desc, eq, inArray, like } from "drizzle-orm";
import { customers, dttotNotices, sanctionsWatchlistEntries, watchlistBlocks } from "../drizzle/schema";
import { matchWatchlistEntries, MIN_SCREENABLE_NAME_LENGTH, rescreenAllCustomers } from "./customerWatchlistScreening";
import { databaseOrThrow, writeAudit } from "./operations";

/**
 * Pemberitahuan daftar DTTOT (surat Densus 88 lewat BI) dan DPPSPM (keputusan PPATK): catat → saring seluruh
 * nasabah → cetak Laporan Nihil atau Berita Acara + Laporan Pemblokiran → catat pengiriman.
 * Rancangan: docs/superpowers/specs/2026-11-12-pemberitahuan-dttot-design.md.
 *
 * Kolom pengiriman bernama menurut DTTOT; pada DPPSPM "police*" berarti PPATK (surat asli & pindaian ke PPATK) dan
 * tembusan PPATK tidak berlaku karena laporannya memang ditujukan ke PPATK.
 */
export const DTTOT_DELIVERY_STEPS = ["policePhysicalSentAt", "policeEmailSentAt", "ppatkCopySentAt", "biCopySentAt", "biFormUploadedAt"] as const;
export type DttotDeliveryStep = (typeof DTTOT_DELIVERY_STEPS)[number];
export type NoticeListType = "DTTOT" | "DPPSPM";
export type NoticeType = "PENCANTUMAN" | "PERPANJANGAN" | "PENGHAPUSAN" | "PEMBARUAN";

export const NOTICE_TYPES_BY_LIST: Record<NoticeListType, NoticeType[]> = {
  DTTOT: ["PENCANTUMAN", "PERPANJANGAN", "PENGHAPUSAN"],
  DPPSPM: ["PEMBARUAN", "PENGHAPUSAN"],
};

export function deliveryStepsFor(listType: NoticeListType): DttotDeliveryStep[] {
  return listType === "DPPSPM" ? DTTOT_DELIVERY_STEPS.filter((step) => step !== "ppatkCopySentAt") : [...DTTOT_DELIVERY_STEPS];
}

export type DttotNoticeInput = {
  listType?: NoticeListType;
  noticeType: NoticeType;
  policeLetterNumber: string;
  listNumber?: string;
  /** YYYY-MM-DD, hari surel BI diterima (WIB). */
  receivedOn: string;
  /** YYYY-MM-DD, tanggal surat Densus 88 / keputusan PPATK. */
  policeLetterDate?: string;
  notes?: string;
};

export async function listDttotNotices() {
  const db = await databaseOrThrow();
  return db.select().from(dttotNotices).orderBy(desc(dttotNotices.receivedOn), desc(dttotNotices.id));
}

export async function createDttotNotice(input: DttotNoticeInput, actor: { id: number }) {
  const listType = input.listType ?? "DTTOT";
  if (!NOTICE_TYPES_BY_LIST[listType].includes(input.noticeType)) throw new Error(`Jenis pemberitahuan ini tidak berlaku untuk daftar ${listType}.`);
  const policeLetterNumber = input.policeLetterNumber.trim();
  if (policeLetterNumber.length < 5) throw new Error(listType === "DPPSPM" ? "Isi nomor keputusan PPATK." : "Isi nomor surat Densus 88 dari surel BI.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn)) throw new Error("Tanggal diterima harus berbentuk YYYY-MM-DD.");
  if (input.policeLetterDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.policeLetterDate)) throw new Error("Tanggal surat harus berbentuk YYYY-MM-DD.");
  if (input.policeLetterDate && input.policeLetterDate > input.receivedOn) throw new Error("Tanggal surat tidak boleh sesudah tanggal pemberitahuan diterima.");
  const db = await databaseOrThrow();
  const [created] = await db.insert(dttotNotices).values({
    listType, noticeType: input.noticeType, policeLetterNumber, listNumber: input.listNumber?.trim() || null,
    receivedOn: input.receivedOn as never, policeLetterDate: (input.policeLetterDate || null) as never, notes: input.notes?.trim() || null, createdByUserId: actor.id,
  }).$returningId();
  await writeAudit({ actorUserId: actor.id, action: "DTTOT_NOTICE_RECORDED", entityType: "dttot_notice", entityId: String(created!.id), afterState: { ...input, listType, policeLetterNumber } });
  return { id: created!.id };
}

/** Nasabah hidup yang namanya cocok dengan entri daftar yang diminta saat ini (DTTOT atau DPPSPM, tidak dicampur). */
export async function dttotMatchedCustomers(listType: NoticeListType = "DTTOT") {
  const db = await databaseOrThrow();
  const entries = await db.select().from(sanctionsWatchlistEntries).where(eq(sanctionsWatchlistEntries.listType, listType));
  const live = await db.select().from(customers).where(and(eq(customers.isDemo, false), eq(customers.isHistorical, false)));
  const matched = live.flatMap((customer) => {
    const name = customer.fullName?.trim() ?? "";
    if (name.length < MIN_SCREENABLE_NAME_LENGTH) return [];
    const matches = matchWatchlistEntries(name, entries);
    return matches.length ? [{ customer, matchedNames: matches.map((match) => match.fullName) }] : [];
  });
  return { liveCount: live.length, entryCount: entries.length, matched };
}

/**
 * Menyaring seluruh nasabah atas daftar terbaru (blokir otomatis tetap berjalan lewat `rescreenAllCustomers`),
 * lalu menyimpan hasil khusus DTTOT pada pemberitahuan ini sebagai dasar laporan nihil atau berita acara.
 */
export async function screenDttotNotice(noticeId: number, actor: { id: number }) {
  const db = await databaseOrThrow();
  const notice = (await db.select().from(dttotNotices).where(eq(dttotNotices.id, noticeId)).limit(1))[0];
  if (!notice) throw new Error("Pemberitahuan tidak ditemukan.");
  const { listSnapshotAt } = await rescreenAllCustomers();
  const { liveCount, entryCount, matched } = await dttotMatchedCustomers(notice.listType);
  if (!listSnapshotAt || !entryCount) throw new Error(`Daftar ${notice.listType} belum diimpor. Impor daftar terbaru dulu di halaman Cek Daftar DTTOT/DPPSPM.`);
  const screenedAt = new Date();
  await db.update(dttotNotices).set({ screenedAt, screenedCustomerCount: liveCount, matchedCustomerCount: matched.length }).where(eq(dttotNotices.id, noticeId));
  await writeAudit({
    actorUserId: actor.id, action: "DTTOT_NOTICE_SCREENED", entityType: "dttot_notice", entityId: String(noticeId),
    afterState: { screenedAt, screenedCustomerCount: liveCount, matchedCustomerCount: matched.length, listSnapshotAt },
  });
  return { screenedAt, screenedCustomerCount: liveCount, matchedCustomerCount: matched.length };
}

export async function updateDttotNoticeReport(input: { noticeId: number; reportNumber: string; reportPlace: string; signerName: string; signerPosition: string }, actor: { id: number }) {
  const values = { reportNumber: input.reportNumber.trim(), reportPlace: input.reportPlace.trim(), signerName: input.signerName.trim(), signerPosition: input.signerPosition.trim() };
  if (!values.reportNumber || !values.reportPlace || !values.signerName || !values.signerPosition) throw new Error("Isi nomor surat, kota, nama, dan jabatan penanda tangan.");
  const db = await databaseOrThrow();
  await db.update(dttotNotices).set(values).where(eq(dttotNotices.id, input.noticeId));
  await writeAudit({ actorUserId: actor.id, action: "DTTOT_NOTICE_REPORT_UPDATED", entityType: "dttot_notice", entityId: String(input.noticeId), afterState: values });
  return values;
}

/** Mencatat (atau membatalkan catatan, `at = null`) satu dari lima pengiriman laporan. */
export async function recordDttotDelivery(input: { noticeId: number; step: DttotDeliveryStep; at: Date | null }, actor: { id: number }) {
  if (!DTTOT_DELIVERY_STEPS.includes(input.step)) throw new Error("Langkah pengiriman tidak dikenal.");
  if (input.at && input.at.getTime() > Date.now() + 15 * 60_000) throw new Error("Waktu pengiriman tidak boleh di masa depan.");
  const db = await databaseOrThrow();
  const notice = (await db.select().from(dttotNotices).where(eq(dttotNotices.id, input.noticeId)).limit(1))[0];
  if (!notice) throw new Error("Pemberitahuan tidak ditemukan.");
  if (!deliveryStepsFor(notice.listType).includes(input.step)) throw new Error("Langkah pengiriman ini tidak berlaku untuk daftar ini.");
  if (input.at && !notice.screenedAt) throw new Error("Saring seluruh nasabah dulu sebelum mencatat pengiriman laporan.");
  await db.update(dttotNotices).set({ [input.step]: input.at }).where(eq(dttotNotices.id, input.noticeId));
  await writeAudit({ actorUserId: actor.id, action: "DTTOT_NOTICE_DELIVERY_RECORDED", entityType: "dttot_notice", entityId: String(input.noticeId), beforeState: { [input.step]: notice[input.step] }, afterState: { [input.step]: input.at } });
  return { step: input.step, at: input.at };
}

/**
 * Blokir yang masih berlaku (OPEN/CONFIRMED) padahal nama nasabahnya sudah tidak cocok dengan daftar mana pun
 * (DTTOT/DPPSPM): itulah yang harus diputus/dicabut sesudah pemberitahuan penghapusan. Laporan penghapusan
 * baru boleh dicetak bila nol.
 */
export async function staleBlockCount() {
  const db = await databaseOrThrow();
  const open = await db.select({ customerId: watchlistBlocks.customerId, fullName: customers.fullName })
    .from(watchlistBlocks).innerJoin(customers, eq(watchlistBlocks.customerId, customers.id))
    .where(inArray(watchlistBlocks.status, ["OPEN", "CONFIRMED"]));
  if (!open.length) return 0;
  const entries = await db.select().from(sanctionsWatchlistEntries);
  return new Set(open.filter((row) => !matchWatchlistEntries(row.fullName?.trim() ?? "", entries).length).map((row) => row.customerId)).size;
}

/** Bahan cetak: pemberitahuan + nasabah yang cocok DTTOT (untuk Berita Acara per nasabah). */
export async function getDttotNoticeReport(noticeId: number) {
  const db = await databaseOrThrow();
  const notice = (await db.select().from(dttotNotices).where(eq(dttotNotices.id, noticeId)).limit(1))[0];
  if (!notice) throw new Error("Pemberitahuan tidak ditemukan.");
  const { matched } = await dttotMatchedCustomers(notice.listType);
  const removal = notice.noticeType === "PENGHAPUSAN";
  return {
    notice,
    staleBlocks: removal ? await staleBlockCount() : 0,
    unblocked: removal ? await blocksRevokedUnder(notice.policeLetterNumber) : [],
    matched: matched.map(({ customer, matchedNames }) => ({
      fullName: customer.fullName, placeOfBirth: customer.placeOfBirth, dateOfBirth: customer.dateOfBirth,
      occupation: customer.occupation, address: customer.address, identityNumber: customer.identityNumber, matchedNames,
    })),
  };
}

/** Blokir yang dicabut dengan rujukan surat penghapusan ini (diisi Controller saat mencabut di halaman Pemblokiran). */
async function blocksRevokedUnder(policeLetterNumber: string) {
  const db = await databaseOrThrow();
  const rows = await db.select({ block: watchlistBlocks, customer: customers })
    .from(watchlistBlocks).innerJoin(customers, eq(watchlistBlocks.customerId, customers.id))
    .where(and(eq(watchlistBlocks.status, "DICABUT"), like(watchlistBlocks.revocationReference, `%${policeLetterNumber.replace(/[%_\\]/g, (char) => `\\${char}`)}%`)));
  return rows.map(({ block, customer }) => ({
    unblockedAt: block.resolvedAt, fullName: customer.fullName, placeOfBirth: customer.placeOfBirth, dateOfBirth: customer.dateOfBirth,
    occupation: customer.occupation, address: customer.address,
  }));
}
