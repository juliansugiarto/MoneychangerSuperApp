import { describe, expect, it } from "vitest";
import { findBestNameMatch, nameTokens, normalizeNameForMatching, parseWatchlistNameList, scoreNameMatch, splitAliasNames } from "../shared/sanctionsNameMatch";

describe("normalizeNameForMatching / nameTokens", () => {
  it("uppercases, strips punctuation and diacritics, and collapses whitespace", () => {
    expect(normalizeNameForMatching("  Budi-Santoso,  S.E.  ")).toBe("BUDI SANTOSO S E");
    expect(normalizeNameForMatching("José García")).toBe("JOSE GARCIA");
  });

  it("tokenizes on whitespace after normalizing", () => {
    expect(nameTokens("Ali Akbar Ahmedian")).toEqual(["ALI", "AKBAR", "AHMEDIAN"]);
  });
});

describe("splitAliasNames", () => {
  it("splits a DTTOT-style 'X alias Y alias Z' field into separate names", () => {
    expect(splitAliasNames("HAMIDAH NABAGALA alias NABAGGALA alias HAMIDA")).toEqual(["HAMIDAH NABAGALA", "NABAGGALA", "HAMIDA"]);
  });

  it("returns the whole name unchanged when there is no alias marker", () => {
    expect(splitAliasNames("Budi Santoso")).toEqual(["Budi Santoso"]);
  });
});

describe("scoreNameMatch", () => {
  it("scores an exact name match at 1.0", () => {
    expect(scoreNameMatch("Budi Santoso", "Budi Santoso")).toBe(1);
  });

  it("scores case/whitespace-insensitive exact matches at 1.0", () => {
    expect(scoreNameMatch("budi   santoso", "BUDI SANTOSO")).toBe(1);
  });

  it("scores a single-character typo close to 1.0 but not exactly 1.0", () => {
    const score = scoreNameMatch("Ali Akbar Ahmedian", "Ali Akbar Ahmadian");
    expect(score).toBeGreaterThan(0.9);
    expect(score).toBeLessThan(1);
  });

  it("scores an unrelated name near 0", () => {
    expect(scoreNameMatch("Budi Santoso", "Siti Rahayu")).toBeLessThan(0.3);
  });

  it("penalizes a candidate with many extra tokens even when one word matches exactly, so a common word alone can't inflate the score", () => {
    const score = scoreNameMatch("Muhammad", "Muhammad Abdul Karim Al-Baghdadi");
    expect(score).toBeLessThan(0.4);
  });

  it("returns 0 when either name has no usable tokens", () => {
    expect(scoreNameMatch("", "Budi Santoso")).toBe(0);
    expect(scoreNameMatch("   ", "Budi Santoso")).toBe(0);
  });

  it("is order-tolerant for reordered tokens", () => {
    expect(scoreNameMatch("Santoso Budi", "Budi Santoso")).toBe(1);
  });
});

describe("findBestNameMatch", () => {
  it("returns the highest-scoring candidate among a name plus its aliases", () => {
    const result = findBestNameMatch("Nabaggala", ["Hamidah Nabagala", "Nabaggala", "Hamida"]);
    expect(result?.name).toBe("Nabaggala");
    expect(result?.score).toBe(1);
  });

  it("returns null when every candidate scores exactly 0 (completely dissimilar single-letter tokens)", () => {
    expect(findBestNameMatch("A", ["B"])).toBeNull();
  });

  it("returns null for an empty candidate list", () => {
    expect(findBestNameMatch("Budi Santoso", [])).toBeNull();
  });

  it("skips blank candidate strings without throwing", () => {
    expect(findBestNameMatch("Budi Santoso", ["", "  ", "Budi Santoso"])?.score).toBe(1);
  });
});

describe("parseWatchlistNameList", () => {
  it("parses one name per line, trimming whitespace and skipping blank lines", () => {
    expect(parseWatchlistNameList("Budi Santoso\n\n  Siti Rahayu  \n")).toEqual([
      { name: "Budi Santoso", note: null },
      { name: "Siti Rahayu", note: null },
    ]);
  });

  it("splits an optional trailing note after the first comma, preserving commas within the note itself", () => {
    expect(parseWatchlistNameList("Budi Santoso, KTP 12345, catatan tambahan")).toEqual([
      { name: "Budi Santoso", note: "KTP 12345, catatan tambahan" },
    ]);
  });

  it("drops entries whose name is shorter than 2 characters", () => {
    expect(parseWatchlistNameList("A\nBudi Santoso")).toEqual([{ name: "Budi Santoso", note: null }]);
  });
});
