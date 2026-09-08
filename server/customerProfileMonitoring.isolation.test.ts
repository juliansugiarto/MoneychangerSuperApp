import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { auditLogs, customerProfileReviews } from "../drizzle/schema";
import { listCustomerProfileMonitoring, recordCustomerProfileReview } from "./customerProfileMonitoring";
import { getDb } from "./db";

/**
 * Batas "hanya mencatat": membuka worklist tidak boleh menulis apa pun.
 *
 * Keputusan pengguna 7 September 2026 — pemantauan tidak pernah mengubah data nasabah, tidak
 * pernah memblokir transaksi, dan tidak pernah melapor sendiri. Membaca daftar yang menilai
 * nasabah tidak boleh menjadi alasan untuk menyentuh barisnya.
 */
const insert = vi.fn(() => ({
  values: vi.fn(() => {
    const result: Record<string, unknown> = { $returningId: async () => [{ id: 77 }] };
    result.then = (onfulfilled: any, onrejected: any) => Promise.resolve(undefined).then(onfulfilled, onrejected);
    return result;
  }),
}));
const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) }));
const deleteFn = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));

/** Pembaca berantai yang selalu berakhir kosong; yang diuji di sini penulisannya, bukan isinya. */
function emptyReader(): Record<string, unknown> & PromiseLike<unknown[]> {
  const reader: Record<string, unknown> = {};
  for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit", "groupBy"]) {
    reader[method] = () => emptyReader();
  }
  reader.then = (onfulfilled: any, onrejected: any) => Promise.resolve([]).then(onfulfilled, onrejected);
  return reader as Record<string, unknown> & PromiseLike<unknown[]>;
}

const database = { insert, update, delete: deleteFn, select: vi.fn(() => emptyReader()) };

describe("isolasi worklist pemantauan profil", () => {
  beforeEach(() => {
    insert.mockClear();
    update.mockClear();
    deleteFn.mockClear();
    vi.mocked(getDb).mockResolvedValue(database as never);
  });

  it("tidak menyisipkan, memperbarui, maupun menghapus apa pun saat worklist dibaca", async () => {
    await listCustomerProfileMonitoring({ asOf: new Date("2026-09-08T05:00:00Z") });

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
  });
});

/**
 * Nasabah yang ditinjau, beserta aktivitasnya bulan ini — dipakai penulis peninjauan untuk
 * membekukan alasan penyimpangan yang terlihat saat itu.
 */
const customerRow = {
  id: 5, cifNumber: "CIF-000005", fullName: "Nasabah Ditinjau", riskLevel: "LOW" as const,
  declaredMonthlyValueIdr: "10000000.00", declaredMonthlyCount: 5, declaredCurrencies: ["USD"],
};

/**
 * Pembaca berantai yang membedakan query menurut bentuknya: hanya query aktivitas yang memakai
 * `innerJoin`, dan query itu harus berakhir kosong agar barisnya tidak tertukar dengan baris nasabah.
 */
function readerFor(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  const reader: Record<string, unknown> = {};
  for (const method of ["from", "leftJoin", "where", "orderBy", "limit", "groupBy"]) {
    reader[method] = () => readerFor(rows);
  }
  reader.innerJoin = () => readerFor([]);
  reader.then = (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected);
  return reader as Record<string, unknown> & PromiseLike<unknown[]>;
}

describe("pencatatan peninjauan profil nasabah", () => {
  beforeEach(() => {
    insert.mockClear();
    update.mockClear();
    deleteFn.mockClear();
    vi.mocked(getDb).mockResolvedValue({ ...database, select: vi.fn(() => readerFor([customerRow])) } as never);
  });

  it("menulis hanya ke tabel peninjauan dan audit, tanpa menyentuh data nasabah", async () => {
    await recordCustomerProfileReview({ customerId: 5, outcome: "TIDAK_ADA_PERUBAHAN" }, { id: 9 });

    expect(insert.mock.calls.map(([table]) => table)).toEqual([customerProfileReviews, auditLogs]);
    expect(update).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("mewajibkan keterangan bila hasilnya bukan TIDAK_ADA_PERUBAHAN", async () => {
    await expect(recordCustomerProfileReview({ customerId: 5, outcome: "ADA_PERUBAHAN" }, { id: 9 })).rejects.toThrow(/[Jj]elaskan/);
    await expect(recordCustomerProfileReview({ customerId: 5, outcome: "PERLU_TINDAK_LANJUT", notes: "   " }, { id: 9 })).rejects.toThrow(/[Jj]elaskan/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("membekukan alasan penyimpangan yang dinilai server sendiri, bukan yang dikirim pemanggil", async () => {
    const values = await captureReviewValues();
    // Aktivitas kosong terhadap deklarasi yang ada: tidak ada penyimpangan yang terlihat saat itu.
    expect(values.deviationReasons).toEqual([]);
    expect(values.customerId).toBe(5);
    expect(values.reviewedByUserId).toBe(9);
  });

  it("menolak nasabah yang tidak ada", async () => {
    vi.mocked(getDb).mockResolvedValue({ ...database, select: vi.fn(() => readerFor([])) } as never);
    await expect(recordCustomerProfileReview({ customerId: 999, outcome: "TIDAK_ADA_PERUBAHAN" }, { id: 9 })).rejects.toThrow(/tidak ditemukan/i);
    expect(insert).not.toHaveBeenCalled();
  });
});

async function captureReviewValues() {
  const captured: Record<string, unknown>[] = [];
  const capturingInsert = vi.fn(() => ({
    values: vi.fn((v: Record<string, unknown>) => {
      captured.push(v);
      const result: Record<string, unknown> = { $returningId: async () => [{ id: 77 }] };
      result.then = (onfulfilled: any, onrejected: any) => Promise.resolve(undefined).then(onfulfilled, onrejected);
      return result;
    }),
  }));
  vi.mocked(getDb).mockResolvedValue({ ...database, insert: capturingInsert, select: vi.fn(() => readerFor([customerRow])) } as never);
  await recordCustomerProfileReview({ customerId: 5, outcome: "TIDAK_ADA_PERUBAHAN" }, { id: 9 });
  return captured[0];
}
