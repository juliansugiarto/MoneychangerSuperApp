import { describe, expect, it } from "vitest";
import { getWatchlistBlockActions } from "./regulatoryActionQueue";

describe("getWatchlistBlockActions", () => {
  it("siap bila tidak ada OPEN dan setiap CONFIRMED sudah ditembuskan", () => {
    expect(getWatchlistBlockActions([{ status: "FALSE_POSITIVE", openedAt: "2026-09-01T00:00:00Z", biCopySentAt: null }]).ready).toBe(true);
  });
  it("menghitung OPEN dan CONFIRMED tanpa tembusan; tenggat tidak dihitung", () => {
    const result = getWatchlistBlockActions([
      { status: "OPEN", openedAt: "2026-09-27T18:00:00Z", biCopySentAt: null },
      { status: "CONFIRMED", openedAt: "2026-09-20T03:00:00Z", biCopySentAt: null },
    ], "Asia/Jakarta");
    expect(result).toMatchObject({ openCount: 1, unreportedCount: 1, oldestOpenDateKey: "2026-09-28", ready: false });
    expect(result.detail).toContain("3 hari kerja");
  });
});
