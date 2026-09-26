import { describe, expect, it } from "vitest";
import { formatNotaDate } from "./notaDate";

describe("tanggal nota", () => {
  // 25 September 16:30 UTC = 23:30 WIB (masih tanggal 25) = 01:30 WIT tanggal 26.
  const nearMidnight = "2026-09-25T16:30:00Z";

  it("mengikuti zona operasional perusahaan, bukan zona peramban atau mesin", () => {
    expect(formatNotaDate(nearMidnight, "Asia/Jakarta")).toBe("25/9/2026");
    expect(formatNotaDate(nearMidnight, "Asia/Jayapura")).toBe("26/9/2026");
  });

  it("zona yang belum diisi memakai zona operasional bawaan (WIB)", () => {
    expect(formatNotaDate(nearMidnight, null)).toBe("25/9/2026");
    expect(formatNotaDate(new Date("2026-09-25T17:30:00Z"), undefined)).toBe("26/9/2026");
  });
});
