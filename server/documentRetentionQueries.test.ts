import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { customerRetentionStatement, documentRetentionOverview } from "./documentRetentionQueries";

/**
 * Pembacaan penatausahaan dokumen. `getDb` dipalsukan per tabel: tiap jenis baris dibaca satu
 * kali, dan penyaringannya (COMPLETED saja, penyimpangan saja) diuji di sini.
 */

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    orderBy: () => makeReader(rows),
    limit: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

type Tables = Partial<Record<
  "customers" | "exchange_transactions" | "customer_profile_reviews" | "customer_watchlist_screenings" | "operational_documents" | "company_profile",
  unknown[]
>>;

function mockDb(tables: Tables) {
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => makeReader((tables as Record<string, unknown[]>)[tableName(table)] ?? []) })),
    insert: vi.fn(() => { throw new Error("pembacaan tidak boleh menulis"); }),
    update: vi.fn(() => { throw new Error("pembacaan tidak boleh menulis"); }),
    delete: vi.fn(() => { throw new Error("pembacaan tidak boleh menghapus"); }),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return fakeDb;
}

const wib = (iso: string) => new Date(`${iso}+07:00`);

const nasabah = (overrides: Record<string, unknown> = {}) => ({
  id: 12, cifNumber: "CIF-0012", fullName: "Nasabah Uji", profileStatus: "ACTIVE", relationshipEndedAt: null, ...overrides,
});

const ktp = { id: 101, ownerType: "CUSTOMER", documentType: "KTP_PHOTO", originalFileName: "ktp.jpg", customerId: 12, transactionId: null, createdAt: wib("2019-01-10T10:00:00") };
const underlying = { id: 102, ownerType: "TRANSACTION", documentType: "UNDERLYING_INVOICE", originalFileName: "invoice.pdf", customerId: null, transactionId: 501, createdAt: wib("2019-03-03T09:00:00") };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("customerRetentionStatement", () => {
  it("nasabah ACTIVE: seluruh dokumen dan transaksinya tanpa tenggat", async () => {
    mockDb({
      customers: [nasabah()],
      exchange_transactions: [{ id: 501, transactionNumber: "TRX-501", transactionAt: wib("2019-03-03T09:00:00"), status: "COMPLETED" }],
      operational_documents: [ktp, underlying],
    });
    const statement = await customerRetentionStatement(12);
    expect(statement.customerVerdict.basis).toBe("HUBUNGAN_USAHA_BERJALAN");
    expect(statement.customerDocuments).toHaveLength(1);
    expect(statement.transactionDocuments).toHaveLength(1);
    for (const row of [...statement.customerDocuments, ...statement.transactionDocuments, ...statement.transactions]) {
      expect(row.verdict.retainUntil).toBeNull();
    }
  });

  it("nasabah INACTIVE: dokumen nasabah memakai jam nasabah, dokumen transaksi memakai tahun buku", async () => {
    mockDb({
      customers: [nasabah({ profileStatus: "INACTIVE", relationshipEndedAt: wib("2020-06-01T10:00:00") })],
      exchange_transactions: [
        { id: 501, transactionNumber: "TRX-501", transactionAt: wib("2019-03-03T09:00:00"), status: "COMPLETED" },
        // Bon batal SESUDAH hubungan usaha berakhir tidak boleh memundurkan jam nasabah.
        { id: 502, transactionNumber: "TRX-502", transactionAt: wib("2021-02-02T09:00:00"), status: "CANCELLED" },
      ],
      customer_profile_reviews: [
        // Peninjauan tanpa penyimpangan tidak dihitung, walau lebih akhir.
        { reviewedAt: wib("2020-08-01T09:00:00"), deviationReasons: [] },
        { reviewedAt: wib("2019-05-01T09:00:00"), deviationReasons: ["NILAI_BULANAN_MELEBIHI_PROFIL"] },
      ],
      customer_watchlist_screenings: [{ id: 1 }, { id: 2 }, { id: 3 }],
      operational_documents: [ktp, underlying],
    });
    const statement = await customerRetentionStatement(12);

    expect(statement.facts.lastCompletedTransactionAt).toEqual(wib("2019-03-03T09:00:00"));
    expect(statement.facts.lastDeviationReviewAt).toEqual(wib("2019-05-01T09:00:00"));
    expect(statement.customerVerdict.basis).toBe("HUBUNGAN_USAHA_BERAKHIR");

    expect(statement.customerDocuments[0].verdict.basis).toBe("HUBUNGAN_USAHA_BERAKHIR");
    expect(statement.customerDocuments[0].verdict.retainUntil).toEqual(wib("2025-06-01T10:00:00"));

    expect(statement.transactionDocuments[0]).toMatchObject({ transactionNumber: "TRX-501" });
    expect(statement.transactionDocuments[0].verdict.basis).toBe("TAHUN_BUKU_TRANSAKSI");
    expect(statement.transactionDocuments[0].verdict.retainUntil).toEqual(wib("2030-01-01T00:00:00"));

    expect(statement.records).toEqual({ watchlistScreenings: 3, profileReviews: 2 });
  });

  it("tahun buku dibaca di zona operasional perusahaan, bukan WIB yang diandaikan", async () => {
    mockDb({
      company_profile: [{ timezone: "Asia/Jayapura" }],
      customers: [nasabah({ profileStatus: "INACTIVE", relationshipEndedAt: wib("2020-06-01T10:00:00") })],
      // 00:30 WIT tanggal 1 Januari 2025 masih 31 Desember 2024 di WIB.
      exchange_transactions: [{ id: 501, transactionNumber: "TRX-501", transactionAt: new Date("2025-01-01T00:30:00+09:00"), status: "COMPLETED" }],
      operational_documents: [underlying],
    });
    const statement = await customerRetentionStatement(12);
    expect(statement.timeZone).toBe("Asia/Jayapura");
    expect(statement.transactionDocuments[0].verdict.detail).toBe("10 tahun sejak akhir tahun buku 2025.");
  });

  it("nasabah tanpa dokumen: daftar kosong, bukan galat, dan korespondensi tetap dinyatakan tidak ditatausahakan", async () => {
    const fakeDb = mockDb({ customers: [nasabah()] });
    const statement = await customerRetentionStatement(12);
    expect(statement.customerDocuments).toEqual([]);
    expect(statement.transactionDocuments).toEqual([]);
    expect(statement.transactions).toEqual([]);
    expect(statement.korespondensi.tersedia).toBe(false);
    expect(statement.korespondensi.keterangan).toMatch(/tidak ditatausahakan di aplikasi ini/);
    expect(fakeDb.insert).not.toHaveBeenCalled();
  });

  it("dokumen milik nasabah lain atau bon lain tidak ikut terhitung", async () => {
    mockDb({
      customers: [nasabah()],
      exchange_transactions: [{ id: 501, transactionNumber: "TRX-501", transactionAt: wib("2019-03-03T09:00:00"), status: "COMPLETED" }],
      operational_documents: [ktp, { ...ktp, id: 103, customerId: 99 }, { ...underlying, id: 104, transactionId: 777 }, { ...ktp, id: 105, ownerType: "COMPANY" }],
    });
    const statement = await customerRetentionStatement(12);
    expect(statement.customerDocuments.map((row) => row.id)).toEqual([101]);
    expect(statement.transactionDocuments).toEqual([]);
  });

  it("nasabah yang tidak ada ditolak", async () => {
    mockDb({ customers: [] });
    await expect(customerRetentionStatement(404)).rejects.toThrow(/Nasabah tidak ditemukan/);
  });
});

describe("documentRetentionOverview", () => {
  const tables = (): Tables => ({
    customers: [
      { id: 1, profileStatus: "INACTIVE", relationshipEndedAt: wib("2019-01-01T10:00:00") },
      { id: 2, profileStatus: "INACTIVE", relationshipEndedAt: wib("2024-01-01T10:00:00") },
      { id: 3, profileStatus: "INACTIVE", relationshipEndedAt: null },
      { id: 4, profileStatus: "ACTIVE", relationshipEndedAt: null },
      { id: 5, profileStatus: "RESTRICTED", relationshipEndedAt: null },
    ],
    exchange_transactions: [],
    customer_profile_reviews: [],
    operational_documents: [
      { id: 201, ownerType: "COMPANY", createdAt: wib("2020-01-01T10:00:00"), deactivatedAt: null },
      { id: 202, ownerType: "COMPANY", createdAt: wib("2025-01-01T10:00:00"), deactivatedAt: wib("2026-02-01T10:00:00") },
    ],
  });

  it("menghitung yang lewat tenggat terhadap asOf yang disuntikkan", async () => {
    mockDb(tables());
    const overview = await documentRetentionOverview({ asOf: wib("2026-09-11T12:00:00") });
    expect(overview.customers).toEqual({ relationshipOngoing: 2, relationshipEnded: 2, pastRetention: 1, inactiveWithoutEndDate: 1 });
    expect(overview.companyProfileDocuments).toEqual({ total: 2, deactivated: 1, pastHouseRule: 1 });
  });

  it("asOf lebih awal menghasilkan angka yang lebih kecil — bukan new Date() di dalam", async () => {
    mockDb(tables());
    const overview = await documentRetentionOverview({ asOf: wib("2023-06-01T12:00:00") });
    expect(overview.asOf).toEqual(wib("2023-06-01T12:00:00"));
    expect(overview.customers.pastRetention).toBe(0);
    expect(overview.companyProfileDocuments.pastHouseRule).toBe(0);
  });

  it("transaksi COMPLETED sesudah hubungan usaha berakhir memundurkan tenggatnya", async () => {
    const withLateTransaction = tables();
    withLateTransaction.exchange_transactions = [{ customerId: 1, transactionAt: wib("2022-03-01T10:00:00"), status: "COMPLETED" }];
    mockDb(withLateTransaction);
    const overview = await documentRetentionOverview({ asOf: wib("2026-09-11T12:00:00") });
    // Nasabah 1 kini ditahan sampai 2027-03-01, jadi belum lewat.
    expect(overview.customers.pastRetention).toBe(0);
  });
});
