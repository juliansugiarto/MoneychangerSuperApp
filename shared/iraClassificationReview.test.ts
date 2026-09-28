import { describe, expect, it } from "vitest";
import { getIraClassificationReviewDue, unclassifiedCodes } from "./iraClassificationReview";
import { IRA_DISTRIBUTION_CHANNELS, IRA_LEGAL_FORMS, IRA_OCCUPATION_CATEGORIES, IRA_PROVINCE_LABELS } from "./iraVocabulary";

describe("unclassifiedCodes", () => {
  const closedCount = (IRA_OCCUPATION_CATEGORIES.length + IRA_LEGAL_FORMS.length + Object.keys(IRA_PROVINCE_LABELS).length + IRA_DISTRIBUTION_CHANNELS.length) * 3;
  it("semesta kosong-klasifikasi = kosakata tertutup + valuta + negara nasabah, × 3 jenis risiko", () => {
    expect(unclassifiedCodes({ currencyCodes: ["USD"], countryCodes: ["SG"], rows: [] })).toHaveLength(closedCount + 3 + 3);
  });
  it("baris yang ada mengurangi per jenis risiko", () => {
    const result = unclassifiedCodes({ currencyCodes: ["USD"], countryCodes: [], rows: [{ dimension: "CURRENCY", code: "USD", riskType: "TPPU" }] });
    expect(result.filter((item) => item.dimension === "CURRENCY").map((item) => item.riskType)).toEqual(["TPPT", "PPSPM"]);
  });
  it("IDR dan kode negara kosong tidak ikut semesta; duplikat dilebur", () => {
    const result = unclassifiedCodes({ currencyCodes: ["IDR", "USD", "USD"], countryCodes: ["", "sg", "SG"], rows: [] });
    expect(result.filter((item) => item.dimension === "CURRENCY")).toHaveLength(3);
    expect(result.filter((item) => item.dimension === "COUNTRY").map((item) => item.code)).toEqual(["SG", "SG", "SG"]);
  });
});

describe("getIraClassificationReviewDue", () => {
  it("belum pernah ditinjau → jatuh tempo", () => {
    expect(getIraClassificationReviewDue(null, 12, new Date("2026-09-28T03:00:00Z"))).toMatchObject({ due: true, dueDateKey: null });
  });
  it("tepat 12 bulan kemudian jatuh tempo pada hari yang sama (WIB)", () => {
    // Ditinjau 30 Sep 2025 01.00 WIB (= 29 Sep 18.00 UTC) → jatuh tempo 30 Sep 2026 WIB.
    const last = new Date("2025-09-29T18:00:00Z");
    expect(getIraClassificationReviewDue(last, 12, new Date("2026-09-29T16:59:00Z"), "Asia/Jakarta")).toMatchObject({ due: false, dueDateKey: "2026-09-30" });
    expect(getIraClassificationReviewDue(last, 12, new Date("2026-09-29T17:00:00Z"), "Asia/Jakarta")).toMatchObject({ due: true });
  });
  it("31 Januari + 1 bulan → akhir Februari, bukan Maret", () => {
    expect(getIraClassificationReviewDue(new Date("2026-01-31T05:00:00Z"), 1, new Date("2026-02-01T00:00:00Z"), "Asia/Jakarta").dueDateKey).toBe("2026-02-28");
  });
});
