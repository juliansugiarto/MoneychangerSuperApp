import { describe, expect, it } from "vitest";
import { formatIdrDecimal, sumIdrDecimals } from "./money";

describe("money display", () => {
  it("formats and sums large Rupiah decimals without floating point loss", () => {
    expect(formatIdrDecimal("9007199254740993.25")).toBe("Rp 9.007.199.254.740.993,25");
    expect(sumIdrDecimals(["0.10", "0.20", "160000000.00"])).toBe("Rp 160.000.000,30");
  });
});
