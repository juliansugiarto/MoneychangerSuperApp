import { describe, expect, it } from "vitest";
import { formatIdrDecimal, sumIdrDecimals } from "./money";

describe("money display", () => {
  it("formats and sums large Rupiah decimals without floating point loss, with no thousands separator and no padded decimals", () => {
    expect(formatIdrDecimal("9007199254740993.25")).toBe("Rp 9007199254740993.25");
    expect(formatIdrDecimal("50.000000")).toBe("Rp 50");
    expect(sumIdrDecimals(["0.10", "0.20", "160000000.00"])).toBe("Rp 160000000.3");
  });
});
