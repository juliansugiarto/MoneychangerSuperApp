import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { companyArchiveWorklist, listCompanyArchiveDocuments, listCompanyArchiveVersions } from "./companyDocumentArchive";

/** Pembaca arsip: daftar, riwayat versi, dan worklist masa berlaku. */

const HARI_INI = new Date("2026-09-08T05:00:00.000Z"); // 12:00 WIB

/** Nilai kolom `date` seperti yang dikembalikan driver: tengah malam waktu lokal proses. */
const tanggal = (year: number, month: number, day: number) => new Date(year, month - 1, day);

type Baris = {
  id: number; category: string; title: string; referenceNumber: string | null; responsibleEmployeeId: number | null;
  notes: string | null; deactivatedAt: Date | null; deactivationReason: string | null; createdAt: Date;
  versionId: number | null; versionNumber: number | null; operationalDocumentId: number | null;
  validFrom: Date | null; validUntil: Date | null; changeReason: string | null;
  responsibleName: string | null; originalFileName: string | null;
};

function baris(over: Partial<Baris>): Baris {
  return {
    id: 1, category: "SOP", title: "Prosedur Penerimaan Nasabah", referenceNumber: null, responsibleEmployeeId: null,
    notes: null, deactivatedAt: null, deactivationReason: null, createdAt: new Date("2026-01-01T00:00:00.000Z"),
    versionId: 10, versionNumber: 1, operationalDocumentId: 41,
    validFrom: tanggal(2026, 1, 1), validUntil: tanggal(2027, 12, 31), changeReason: null,
    responsibleName: null, originalFileName: "sop-v1.pdf",
    ...over,
  };
}

function makeReader(rows: unknown[]): any {
  const chain: any = {
    from: () => chain, innerJoin: () => chain, leftJoin: () => chain, where: () => chain,
    orderBy: () => chain, limit: () => chain,
    then: (ok: any, err: any) => Promise.resolve(rows).then(ok, err),
  };
  return chain;
}

function mockDb(rows: unknown[]) {
  const fakeDb: Record<string, unknown> = { select: vi.fn(() => makeReader(rows)) };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
}

describe("daftar dokumen arsip", () => {
  it("mengembalikan versi berjalan beserta status masa berlakunya", async () => {
    mockDb([baris({})]);
    const hasil = await listCompanyArchiveDocuments({ asOf: HARI_INI });
    expect(hasil.documents).toHaveLength(1);
    expect(hasil.documents[0].currentVersion?.versionNumber).toBe(1);
    expect(hasil.documents[0].validityStatus).toBe("BERLAKU");
  });

  it("menghitung dokumen tanpa tanggal berakhir apa adanya", async () => {
    // Worklist yang sunyi tidak boleh terbaca sebagai "semua dokumen berlaku" ketika sebabnya
    // adalah tanggal yang tidak pernah diisi.
    mockDb([baris({ id: 1, validUntil: null }), baris({ id: 2, validUntil: tanggal(2027, 1, 1) })]);
    const hasil = await listCompanyArchiveDocuments({ asOf: HARI_INI });
    expect(hasil.withoutExpiryCount).toBe(1);
  });

  it("memisahkan dokumen nonaktif dari yang aktif", async () => {
    mockDb([baris({ id: 1 }), baris({ id: 2, deactivatedAt: new Date("2026-05-01T00:00:00.000Z"), deactivationReason: "digantikan" })]);
    const hasil = await listCompanyArchiveDocuments({ asOf: HARI_INI });
    expect(hasil.documents.map((doc) => doc.id)).toEqual([1]);
    expect(hasil.deactivated.map((doc) => doc.id)).toEqual([2]);
  });
});

describe("worklist masa berlaku", () => {
  const worklistOf = async (rows: unknown[]) => {
    mockDb(rows);
    return companyArchiveWorklist({ asOf: HARI_INI });
  };

  it("memunculkan dokumen kedaluwarsa", async () => {
    const hasil = await worklistOf([baris({ validUntil: tanggal(2026, 9, 1) })]);
    expect(hasil.map((item) => item.reason)).toEqual(["KEDALUWARSA"]);
  });

  it("memunculkan dokumen yang berakhir dalam 30 hari, dan tidak yang 31 hari", async () => {
    expect(await worklistOf([baris({ validUntil: tanggal(2026, 10, 8) })])).toHaveLength(1);
    expect(await worklistOf([baris({ validUntil: tanggal(2026, 10, 9) })])).toHaveLength(0);
  });

  it("tidak memunculkan dokumen tanpa tanggal berakhir", async () => {
    expect(await worklistOf([baris({ validUntil: null })])).toHaveLength(0);
  });

  it("tidak pernah memunculkan dokumen nonaktif, walau kedaluwarsa", async () => {
    const rows = [baris({ validUntil: tanggal(2026, 9, 1), deactivatedAt: new Date("2026-09-02T00:00:00.000Z") })];
    expect(await worklistOf(rows)).toHaveLength(0);
  });

  it("memunculkan TIDAK_ADA_VERSI_BERLAKU ketika versi berjalan baru berlaku kemudian", async () => {
    const hasil = await worklistOf([baris({ validFrom: tanggal(2026, 10, 1), validUntil: null })]);
    expect(hasil.map((item) => item.reason)).toEqual(["TIDAK_ADA_VERSI_BERLAKU"]);
  });

  it("mengurutkan yang paling mendesak lebih dulu", async () => {
    const rows = [
      baris({ id: 1, validUntil: tanggal(2026, 10, 1) }),
      baris({ id: 2, validUntil: tanggal(2026, 8, 1) }),
      baris({ id: 3, validFrom: tanggal(2026, 12, 1), validUntil: null }),
    ];
    const hasil = await worklistOf(rows);
    expect(hasil.map((item) => item.reason)).toEqual(["KEDALUWARSA", "TIDAK_ADA_VERSI_BERLAKU", "AKAN_KEDALUWARSA"]);
  });
});

describe("riwayat versi", () => {
  it("mengembalikan seluruh versi terbaru dahulu, termasuk yang sudah digantikan", async () => {
    // Versi lama tetap dapat dibuka — keputusan pengguna 2, dan alasan tabel versinya ada.
    const versions = [
      { id: 11, versionNumber: 2, operationalDocumentId: 42, supersededAt: null, validFrom: tanggal(2027, 1, 1), validUntil: null, changeReason: "revisi berkala", originalFileName: "sop-v2.pdf", uploadedByUserId: 3, createdAt: new Date() },
      { id: 10, versionNumber: 1, operationalDocumentId: 41, supersededAt: new Date("2026-12-31T00:00:00.000Z"), validFrom: tanggal(2026, 1, 1), validUntil: null, changeReason: null, originalFileName: "sop-v1.pdf", uploadedByUserId: 3, createdAt: new Date() },
    ];
    mockDb(versions);
    const hasil = await listCompanyArchiveVersions(1);
    expect(hasil.map((version) => version.versionNumber)).toEqual([2, 1]);
    expect(hasil[1].operationalDocumentId).toBe(41);
  });
});
