import { describe, expect, it } from "vitest";
import {
  IRA_BAND_INDEXES,
  IRA_DEFAULT_BAND_UPPER_BOUNDS,
  IRA_PARAMETERS,
  IRA_PARAMETER_CODES,
  scoreFromBand,
} from "./iraParameters";

describe("parameter risiko inheren", () => {
  it("berjumlah 33 sebagaimana lembar A1", () => {
    expect(IRA_PARAMETERS).toHaveLength(33);
  });

  it("24 dihitung dan 9 dinyatakan — tidak ada parameter yang menggantung", () => {
    expect(IRA_PARAMETERS.filter((p) => p.source === "HITUNG")).toHaveLength(24);
    expect(IRA_PARAMETERS.filter((p) => p.source === "NYATAKAN")).toHaveLength(9);
  });

  it("berkode unik dan berlabel", () => {
    expect(new Set(IRA_PARAMETER_CODES).size).toBe(33);
    for (const parameter of IRA_PARAMETERS) expect(parameter.label.trim()).not.toBe("");
  });

  it("pita bawaannya lima, menaik, dan yang teratas tak berbatas", () => {
    expect(IRA_DEFAULT_BAND_UPPER_BOUNDS).toHaveLength(IRA_BAND_INDEXES.length);
    expect(IRA_DEFAULT_BAND_UPPER_BOUNDS.at(-1)).toBeNull();
    const bounded = IRA_DEFAULT_BAND_UPPER_BOUNDS.slice(0, -1).map(Number);
    expect(bounded).toEqual([...bounded].sort((a, b) => a - b));
  });

  /** Uji yang gagal bila skalanya dibalik — 5 = Rendah, 1 = Tinggi. */
  it("pita terendah bernilai 5 dan pita tertinggi bernilai 1", () => {
    expect(scoreFromBand(1)).toBe(5);
    expect(scoreFromBand(5)).toBe(1);
    expect(scoreFromBand(3)).toBe(3);
  });

  it("indeks pita di luar 1..5 ditolak", () => {
    expect(() => scoreFromBand(0)).toThrow();
    expect(() => scoreFromBand(6)).toThrow();
  });
});
