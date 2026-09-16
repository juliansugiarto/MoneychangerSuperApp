import { describe, expect, it } from "vitest";
import { OTHER_TIER_LABEL, findTierOverlap, matchTier, normalizeDenominationValue, sortTiers, tierDisplayLabel, type RateTierRow } from "./rateTiers";

const tier = (id: number, label: string, values: string[], sortOrder = 0, active = true): RateTierRow =>
  ({ id, currencyId: 1, label, denominationValues: values, sortOrder, active });

const USD = [tier(2, "5–20", ["5", "10", "20"], 2), tier(1, "100", ["100"], 1), tier(3, "50", ["50"], 3, false)];

describe("nilai muka pecahan", () => {
  it("dinormalkan ke enam desimal supaya \"100\" dan 100 adalah pecahan yang sama", () => {
    expect(normalizeDenominationValue("100")).toBe("100.000000");
    expect(normalizeDenominationValue(100)).toBe("100.000000");
    expect(normalizeDenominationValue("0.50")).toBe("0.500000");
  });
});

describe("urutan kelompok", () => {
  it("mengikuti sortOrder lalu label, tanpa mengubah larik masukan", () => {
    const ordered = sortTiers(USD);
    expect(ordered.map((row) => row.label)).toEqual(["100", "5–20", "50"]);
    expect(USD.map((row) => row.label)).toEqual(["5–20", "100", "50"]);
  });
});

describe("pencocokan pecahan ke kelompok", () => {
  it("mengembalikan kelompok aktif yang memuat nilai mukanya", () => {
    expect(matchTier(USD, "10")?.label).toBe("5–20");
    expect(matchTier(USD, 100)?.label).toBe("100");
  });

  it("mengabaikan kelompok nonaktif — pecahannya jatuh ke kurs tingkat valuta", () => {
    expect(matchTier(USD, "50")).toBeNull();
  });

  it("mengembalikan null untuk pecahan yang tidak masuk kelompok mana pun", () => {
    expect(matchTier(USD, "2")).toBeNull();
    expect(tierDisplayLabel(null)).toBe(OTHER_TIER_LABEL);
  });

  it("valuta tanpa kelompok aktif berperilaku seperti satu kurs untuk semua pecahan", () => {
    expect(matchTier([], "100")).toBeNull();
  });
});

describe("tumpang tindih kelompok", () => {
  it("menemukan nilai muka yang berada di dua kelompok aktif", () => {
    const overlap = findTierOverlap([tier(1, "100", ["100", "50"], 1), tier(2, "50", ["50"], 2)]);
    expect(overlap).toEqual({ value: "50.000000", labels: ["100", "50"] });
  });

  it("tidak mempersoalkan tumpang tindih dengan kelompok nonaktif", () => {
    expect(findTierOverlap([tier(1, "100", ["100"], 1), tier(2, "lama", ["100"], 2, false)])).toBeNull();
  });

  it("tidak mempersoalkan nilai muka berulang di dalam satu kelompok yang sama", () => {
    expect(findTierOverlap([tier(1, "100", ["100", "100"], 1)])).toBeNull();
  });
});
