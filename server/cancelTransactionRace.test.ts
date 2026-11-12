import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { cancelTransaction } from "./operations";

/**
 * Batal dan selesai berpacu: pembatalan membaca DRAFT, lalu penyelesaian di layar lain memposting kas dan
 * menjadikannya COMPLETED. Pembaruan pembatalan bersyarat status, jadi ia tidak menyentuh baris (0 baris)
 * dan harus menolak — bukan meninggalkan bon CANCELLED yang kasnya sudah terposting.
 */
function databaseWhereUpdateTouches(affectedRows: number) {
  const draft = { id: 41, status: "DRAFT", isDemo: false, isHistorical: false, tellerUserId: 5 };
  const reader: any = { from: () => reader, where: () => reader, limit: () => Promise.resolve([draft]) };
  const update = vi.fn(() => ({ set: () => ({ where: () => Promise.resolve([{ affectedRows }]) }) }));
  vi.spyOn(db, "getDb").mockResolvedValue({ select: () => reader, update, insert: () => ({ values: () => Promise.resolve(undefined) }) } as never);
  return update;
}

afterEach(() => vi.restoreAllMocks());

describe("pembatalan bon bersamaan dengan penyelesaian", () => {
  it("menolak bila statusnya sudah berubah sejak dibaca", async () => {
    databaseWhereUpdateTouches(0);
    await expect(cancelTransaction(41, "salah ketik", { id: 5, role: "STAFF" })).rejects.toThrow(/baru saja berubah status/);
  });

  it("membatalkan seperti biasa bila statusnya masih sama", async () => {
    databaseWhereUpdateTouches(1);
    await expect(cancelTransaction(41, "salah ketik", { id: 5, role: "STAFF" })).resolves.toMatchObject({ status: "CANCELLED" });
  });
});

describe("kirim dan tinjau bon tidak menimpa pembatalan", () => {
  it("kirim ditolak bila bon baru saja dibatalkan di layar lain", async () => {
    const { submitTransaction } = await import("./operations");
    const draft = { id: 42, status: "DRAFT", isDemo: false, isHistorical: false, tellerUserId: 5, requiresReview: false, purpose: "PERSONAL", operation: "SELL" };
    const reader: any = { from: () => reader, where: () => reader, innerJoin: () => reader, orderBy: () => reader, limit: () => Promise.resolve([draft]), then: (ok: any, err: any) => Promise.resolve([]).then(ok, err) };
    const update = vi.fn(() => ({ set: () => ({ where: () => Promise.resolve([{ affectedRows: 0 }]) }) }));
    vi.spyOn(db, "getDb").mockResolvedValue({ select: () => reader, update, insert: () => ({ values: () => Promise.resolve(undefined) }) } as never);
    await expect(submitTransaction(42, { id: 5, role: "STAFF" })).rejects.toThrow(/baru saja berubah status/);
  });
});
