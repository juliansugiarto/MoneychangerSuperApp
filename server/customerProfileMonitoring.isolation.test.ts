import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { listCustomerProfileMonitoring } from "./customerProfileMonitoring";
import { getDb } from "./db";

/**
 * Batas "hanya mencatat": membuka worklist tidak boleh menulis apa pun.
 *
 * Keputusan pengguna 7 September 2026 — pemantauan tidak pernah mengubah data nasabah, tidak
 * pernah memblokir transaksi, dan tidak pernah melapor sendiri. Membaca daftar yang menilai
 * nasabah tidak boleh menjadi alasan untuk menyentuh barisnya.
 */
const insert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
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
