import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { assertTransactionTimeAllowed } from "./transactionTime";

function periods(closedRows: unknown[]) {
  const reader: any = { from: () => reader, where: () => reader, limit: () => Promise.resolve(closedRows) };
  vi.spyOn(db, "getDb").mockResolvedValue({ select: () => reader } as never);
}

afterEach(() => vi.restoreAllMocks());
const now = new Date("2026-11-12T03:00:00Z");

describe("waktu bon dari perangkat kasir", () => {
  it("menerima waktu sekarang dan jam perangkat yang sedikit lebih cepat", async () => {
    periods([]);
    await expect(assertTransactionTimeAllowed(now, now)).resolves.toBeUndefined();
    await expect(assertTransactionTimeAllowed(new Date(now.getTime() + 10 * 60_000), now)).resolves.toBeUndefined();
  });

  it("menolak waktu di masa depan", async () => {
    periods([]);
    await expect(assertTransactionTimeAllowed(new Date("2026-11-13T03:00:00Z"), now)).rejects.toThrow(/masa depan/);
  });

  it("menolak tanggal di bulan yang sudah tutup buku, memakai tanggal WIB", async () => {
    periods([{ id: 3 }]);
    // 31 Oktober 20.00 UTC = 1 November 03.00 WIB → kunci tanggal 2026-11-01.
    await expect(assertTransactionTimeAllowed(new Date("2026-10-31T20:00:00Z"), now)).rejects.toThrow("Buku tanggal 2026-11-01 sudah ditutup");
  });

  it("menerima bon mundur di dalam periode yang masih terbuka", async () => {
    periods([]);
    await expect(assertTransactionTimeAllowed(new Date("2026-11-02T03:00:00Z"), now)).resolves.toBeUndefined();
  });
});
