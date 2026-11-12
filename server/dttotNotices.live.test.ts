import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { dttotNotices, sanctionsWatchlistEntries, watchlistBlocks } from "../drizzle/schema";
import { createInternalUser } from "./db";
import { createDttotNotice, getDttotNoticeReport, recordDttotDelivery, screenDttotNotice, updateDttotNoticeReport } from "./dttotNotices";
import { hashPassword } from "./internalAuth";
import { createCustomer, databaseOrThrow } from "./operations";
import { runWithTenant, type TenantBinding } from "./tenantContext";
import { createScratchDatabase } from "./testing/scratchDatabase";
import { v1Fixtures } from "./v1Fixtures";

/** Pemberitahuan DTTOT terhadap MySQL sungguhan; daftar dan nasabah sintetis di `mc_uji_pemberitahuan_dttot`. */
let binding: TenantBinding;
const inTenant = <T,>(fn: () => Promise<T>) => runWithTenant(binding, fn);
let controller: { id: number };

beforeAll(async () => {
  ({ binding } = await createScratchDatabase("mc_uji_pemberitahuan_dttot"));
  await inTenant(async () => {
    controller = { id: (await createInternalUser({ username: "controller.dttot", passwordHash: await hashPassword("Uji-dttot-2026"), name: "Controller Uji", role: "CONTROLLER", mustChangePassword: false }))!.id };
    await createCustomer({ ...v1Fixtures.customer, cifNumber: "UJI-DTTOT-1", identityNumber: "3174000000000101", fullName: "Budi Santoso Wibowo" } as never, controller.id);
    const db = await databaseOrThrow();
    await db.insert(sanctionsWatchlistEntries).values({ listType: "DTTOT", entityType: "INDIVIDUAL", referenceCode: "UJI-P25-001", fullName: "Abdul Rahman Fiktif", sourceFileName: "uji-p25.xlsx", importedByUserId: controller.id });
  });
}, 180_000);

describe("pemberitahuan DTTOT", () => {
  it("tanpa kecocokan: hasil saring nihil, lalu lima pengiriman bisa dicatat", async () => {
    await inTenant(async () => {
      const { id } = await createDttotNotice({ noticeType: "PERPANJANGAN", policeLetterNumber: "R/21/X/RES.6.1./2026/Densus", listNumber: "DTTOT/P-25/X/RES.6.1./2026", receivedOn: "2026-10-15" }, controller);
      await expect(recordDttotDelivery({ noticeId: id, step: "policeEmailSentAt", at: new Date() }, controller)).rejects.toThrow(/Saring/);
      const result = await screenDttotNotice(id, controller);
      expect(result).toMatchObject({ screenedCustomerCount: 1, matchedCustomerCount: 0 });
      for (const step of ["policePhysicalSentAt", "policeEmailSentAt", "ppatkCopySentAt", "biCopySentAt", "biFormUploadedAt"] as const) {
        await recordDttotDelivery({ noticeId: id, step, at: new Date() }, controller);
      }
      const db = await databaseOrThrow();
      const row = (await db.select().from(dttotNotices).where(eq(dttotNotices.id, id)).limit(1))[0]!;
      expect(row.biFormUploadedAt).not.toBeNull();
      expect((await getDttotNoticeReport(id)).matched).toHaveLength(0);
    });
  }, 60_000);

  it("nasabah yang namanya ada di DTTOT: tercatat cocok dan muncul di bahan berita acara", async () => {
    await inTenant(async () => {
      const db = await databaseOrThrow();
      await db.insert(sanctionsWatchlistEntries).values({ listType: "DTTOT", entityType: "INDIVIDUAL", referenceCode: "UJI-P25-002", fullName: "Budi Santoso Wibowo", sourceFileName: "uji-p25.xlsx", importedByUserId: controller.id });
      const { id } = await createDttotNotice({ noticeType: "PENCANTUMAN", policeLetterNumber: "R/22/XI/RES.6.1./2026/Densus", receivedOn: "2026-11-12" }, controller);
      expect(await screenDttotNotice(id, controller)).toMatchObject({ matchedCustomerCount: 1 });
      const report = await getDttotNoticeReport(id);
      expect(report.matched.map((row) => row.fullName)).toEqual(["Budi Santoso Wibowo"]);
    });
  }, 60_000);

  it("menolak waktu pengiriman di masa depan", async () => {
    await inTenant(async () => {
      const { id } = await createDttotNotice({ noticeType: "PENGHAPUSAN", policeLetterNumber: "R/20/X/RES.6.1./2026/Densus", receivedOn: "2026-10-15" }, controller);
      await screenDttotNotice(id, controller);
      await expect(recordDttotDelivery({ noticeId: id, step: "policeEmailSentAt", at: new Date(Date.now() + 86_400_000) }, controller)).rejects.toThrow(/masa depan/);
    });
  }, 60_000);

  it("penghapusan: blokir yang namanya sudah hilang dari daftar dihitung sampai dibuka; tanggal surat dan kota tersimpan", async () => {
    await inTenant(async () => {
      const db = await databaseOrThrow();
      await expect(createDttotNotice({ noticeType: "PENGHAPUSAN", policeLetterNumber: "R/23/XI/RES.6.1./2026/Densus", receivedOn: "2026-11-12", policeLetterDate: "2026-11-20" }, controller)).rejects.toThrow(/sesudah/);
      const { id } = await createDttotNotice({ noticeType: "PENGHAPUSAN", policeLetterNumber: "R/23/XI/RES.6.1./2026/Densus", receivedOn: "2026-11-12", policeLetterDate: "2026-11-05" }, controller);
      // Budi (diblokir di uji sebelumnya) dihapus dari daftar terbaru.
      await db.delete(sanctionsWatchlistEntries).where(eq(sanctionsWatchlistEntries.referenceCode, "UJI-P25-002"));
      await screenDttotNotice(id, controller);
      expect((await getDttotNoticeReport(id)).staleOpenBlocks).toBe(1);
      await db.update(watchlistBlocks).set({ status: "DICABUT", resolvedAt: new Date(), resolvedByUserId: controller.id }).where(eq(watchlistBlocks.status, "OPEN"));
      expect((await getDttotNoticeReport(id)).staleOpenBlocks).toBe(0);

      await expect(updateDttotNoticeReport({ noticeId: id, reportNumber: "003/DTTOT/XI/2026", reportPlace: " ", signerName: "Direktur Uji", signerPosition: "Direktur" }, controller)).rejects.toThrow(/kota/);
      await updateDttotNoticeReport({ noticeId: id, reportNumber: "003/DTTOT/XI/2026", reportPlace: "Cianjur", signerName: "Direktur Uji", signerPosition: "Direktur" }, controller);
      const row = (await db.select().from(dttotNotices).where(eq(dttotNotices.id, id)).limit(1))[0]!;
      expect(String(row.policeLetterDate)).toContain("2026");
      expect(row.reportPlace).toBe("Cianjur");
    });
  }, 60_000);
});
