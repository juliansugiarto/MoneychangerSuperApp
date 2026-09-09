import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { IRA_GROUP_WEIGHTS, scoreFromPercentageBand } from "./individualRiskAssessment";
import { IRA_DEFAULT_BAND_UPPER_BOUNDS, IRA_PARAMETERS } from "./iraParameters";
import {
  IRA_BAND_TYPES,
  IRA_PARAMETER_CATALOGUE,
  bandDefinition,
  catalogueEntry,
  parametersOfGroup,
} from "./iraParameterCatalogue";

describe("katalog parameter risiko inheren", () => {
  it("memuat 33 parameter, satu untuk tiap parameter pada shared/iraParameters", () => {
    expect(IRA_PARAMETER_CATALOGUE).toHaveLength(33);
    expect(IRA_PARAMETER_CATALOGUE.map((entry) => entry.code)).toEqual(IRA_PARAMETERS.map((p) => p.code));
  });

  it("tidak menurunkan ulang label, kelompok, maupun sumbernya — dibaca dari IRA_PARAMETERS", () => {
    for (const parameter of IRA_PARAMETERS) {
      const entry = catalogueEntry(parameter.code);
      expect([entry.code, entry.riskType, entry.group, entry.label, entry.source]).toEqual([
        parameter.code,
        parameter.riskType,
        parameter.group,
        parameter.label,
        parameter.source,
      ]);
    }
  });

  it("bobot parameter dalam tiap kelompok berjumlah 1", () => {
    const groups = new Map<string, Decimal>();
    for (const entry of IRA_PARAMETER_CATALOGUE) {
      const key = `${entry.riskType}/${entry.group}`;
      groups.set(key, (groups.get(key) ?? new Decimal(0)).plus(entry.parameterWeight));
    }
    for (const [key, total] of groups) expect([key, total.toNumber()]).toEqual([key, 1]);
  });

  it("bobot kelompok dalam tiap jenis risiko berjumlah 1", () => {
    for (const [riskType, weights] of Object.entries(IRA_GROUP_WEIGHTS)) {
      const total = Object.values(weights).reduce((sum, weight) => sum.plus(weight), new Decimal(0));
      expect([riskType, total.toNumber()]).toEqual([riskType, 1]);
    }
  });

  it("bobot kelompok pada entri sama dengan IRA_GROUP_WEIGHTS, bukan salinan kedua", () => {
    for (const entry of IRA_PARAMETER_CATALOGUE) {
      expect(entry.groupWeight).toBe(IRA_GROUP_WEIGHTS[entry.riskType][entry.group]);
    }
  });

  it("seluruh kelompok pada IRA_GROUP_WEIGHTS punya parameter — tidak ada kelompok berbobot tanpa isi", () => {
    for (const [riskType, weights] of Object.entries(IRA_GROUP_WEIGHTS)) {
      for (const group of Object.keys(weights)) {
        expect([riskType, group, parametersOfGroup(riskType as never, group).length > 0]).toEqual([riskType, group, true]);
      }
    }
  });

  it("24 dihitung dan 9 dinyatakan", () => {
    expect(IRA_PARAMETER_CATALOGUE.filter((entry) => entry.source === "HITUNG")).toHaveLength(24);
    expect(IRA_PARAMETER_CATALOGUE.filter((entry) => entry.source === "NYATAKAN")).toHaveLength(9);
  });

  it("tiap parameter membawa teks kriterianya apa adanya dari template", () => {
    for (const entry of IRA_PARAMETER_CATALOGUE) expect(entry.criterion.trim().length).toBeGreaterThan(20);
  });
});

describe("jenis pita", () => {
  it("tiap jenis pita punya lima label, sesuai kolom G sampai K lembar A1", () => {
    for (const bandType of IRA_BAND_TYPES) {
      expect([bandType, bandDefinition(bandType).bandLabels]).toEqual([bandType, expect.any(Array)]);
      expect(bandDefinition(bandType).bandLabels).toHaveLength(5);
    }
  });

  it("jenis pita numerik memakai batas yang diterima scoreFromPercentageBand", () => {
    for (const bandType of IRA_BAND_TYPES) {
      const bounds = bandDefinition(bandType).defaultUpperBounds;
      if (!bounds) continue;
      expect(scoreFromPercentageBand(0, bounds)).toBe(5);
      expect(scoreFromPercentageBand(100, bounds)).toBe(1);
    }
  });

  it("pita lebar sama persis dengan bawaan yang sudah di-seed J1", () => {
    expect(bandDefinition("PERSENTASE_LEBAR").defaultUpperBounds).toEqual(IRA_DEFAULT_BAND_UPPER_BOUNDS);
  });

  it("pita sempit dan menengah memakai batas templatenya sendiri", () => {
    expect(bandDefinition("PERSENTASE_SEMPIT").defaultUpperBounds).toEqual(["0.00", "1.00", "2.00", "3.00", null]);
    expect(bandDefinition("PERSENTASE_MENENGAH").defaultUpperBounds).toEqual(["2.00", "4.00", "5.00", "6.00", null]);
  });

  it("jenis pita berupa pilihan tidak punya batas numerik, dan sebaliknya", () => {
    for (const bandType of IRA_BAND_TYPES) {
      const definition = bandDefinition(bandType);
      expect([bandType, definition.choices === null]).toEqual([bandType, definition.defaultUpperBounds !== null]);
    }
  });

  it("pilihan kehadiran, tingkat risiko, dan kepemilikan memetakan ke pita yang benar", () => {
    const bandOf = (bandType: (typeof IRA_BAND_TYPES)[number], code: string) =>
      bandDefinition(bandType).choices?.find((choice) => choice.code === code)?.bandIndex;
    expect(bandOf("KEHADIRAN", "TIDAK_ADA")).toBe(1);
    expect(bandOf("KEHADIRAN", "ADA")).toBe(5);
    expect(bandOf("TINGKAT_RISIKO", "RENDAH")).toBe(1);
    expect(bandOf("TINGKAT_RISIKO", "MENENGAH")).toBe(3);
    expect(bandOf("TINGKAT_RISIKO", "TINGGI")).toBe(5);
    expect(bandOf("PERSENTASE_KEPEMILIKAN", "TIDAK_ADA")).toBe(1);
    expect(bandOf("PERSENTASE_KEPEMILIKAN", "SEBAGIAN")).toBe(3);
    expect(bandOf("PERSENTASE_KEPEMILIKAN", "SELURUHNYA")).toBe(5);
  });

  it("pilihan berkode unik dan berpita 1 sampai 5", () => {
    for (const bandType of IRA_BAND_TYPES) {
      const choices = bandDefinition(bandType).choices;
      if (!choices) continue;
      expect(new Set(choices.map((choice) => choice.code)).size).toBe(choices.length);
      for (const choice of choices) {
        expect(choice.bandIndex).toBeGreaterThanOrEqual(1);
        expect(choice.bandIndex).toBeLessThanOrEqual(5);
        expect(bandDefinition(bandType).bandLabels[choice.bandIndex - 1]).not.toBe("-");
      }
    }
  });

  it("tiap jenis pita benar-benar dipakai sebuah parameter — tidak ada enum yang menganggur", () => {
    for (const bandType of IRA_BAND_TYPES) {
      expect([bandType, IRA_PARAMETER_CATALOGUE.some((entry) => entry.bandType === bandType)]).toEqual([bandType, true]);
    }
  });

  it("empat parameter wilayah geografis memakai tingkat risiko, bukan persentase", () => {
    const levelled = IRA_PARAMETER_CATALOGUE.filter((entry) => entry.bandType === "TINGKAT_RISIKO").map((e) => e.code);
    expect(levelled).toEqual(["TPPU_4A", "TPPU_4B", "TPPT_4A", "TPPT_4B"]);
  });
});

describe("pencarian", () => {
  it("kode yang tidak dikenal dilempar, bukan mengembalikan undefined", () => {
    expect(() => catalogueEntry("TPPU_9Z")).toThrow();
  });

  it("parametersOfGroup mengembalikan urutan templatenya", () => {
    expect(parametersOfGroup("TPPU", "2").map((entry) => entry.code)).toEqual(["TPPU_2A", "TPPU_2B", "TPPU_2C"]);
  });
});
