import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  IRA_FINAL_VALUE_MATRIX,
  IRA_GROUP_WEIGHTS,
  IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY,
  IRA_PREDICATE_ANCHORS,
  IRA_RISK_TYPE_WEIGHTS,
  finalAssessmentValue,
  finalPredicate,
  inherentTotalScore,
  kpmrPillarAverage,
  kpmrPredicate,
  kpmrScore,
  riskPredicate,
  riskTypeScore,
  scoreFromPercentageBand,
  scoreFromPresence,
  weightedGroupScore,
} from "./individualRiskAssessment";

describe("aritmetika IRA", () => {
  it("0% menghasilkan 5 dan 100% menghasilkan 1 — skalanya TERBALIK", () => {
    expect(scoreFromPercentageBand(0)).toBe(5);
    expect(scoreFromPercentageBand(100)).toBe(1);
  });

  it("tepat pada batas pita mengambil pita yang lebih rendah risikonya", () => {
    expect(scoreFromPercentageBand("20")).toBe(5);
    expect(scoreFromPercentageBand("20.01")).toBe(4);
    expect(scoreFromPercentageBand("40")).toBe(4);
    expect(scoreFromPercentageBand("80")).toBe(2);
    expect(scoreFromPercentageBand("80.0001")).toBe(1);
  });

  it("predikat memakai nilai terbesar yang tidak melebihi: 3,74 Menengah, 3,75 Rendah ke Menengah", () => {
    expect(riskPredicate("3.74")).toBe("MENENGAH");
    expect(riskPredicate("3.75")).toBe("RENDAH_KE_MENENGAH");
    expect(riskPredicate("4.49")).toBe("RENDAH_KE_MENENGAH");
    expect(riskPredicate("4.5")).toBe("RENDAH");
    expect(riskPredicate(1)).toBe("TINGGI");
    expect(riskPredicate("1.99")).toBe("TINGGI");
    expect(riskPredicate(2)).toBe("MENENGAH_KE_TINGGI");
    expect(kpmrPredicate("3.75")).toBe("SATISFACTORY");
    expect(kpmrPredicate(5)).toBe("STRONG");
  });

  it("rata-rata pilar mengecualikan N/A, bukan menghitungnya sebagai nol", () => {
    // 4 dan 2 dengan satu N/A: 6/2 = 3, bukan 6/3 = 2.
    expect(kpmrPillarAverage([4, null, 2])?.toNumber()).toBe(3);
  });

  it("pilar yang seluruhnya N/A tidak menghasilkan NaN", () => {
    expect(kpmrPillarAverage([null, null])).toBeNull();
    expect(kpmrPillarAverage([])).toBeNull();
  });

  it("nilai KPMR adalah rata-rata SEDERHANA kelima pilar, bukan berbobot 30/25/25/10/10", () => {
    const pillars = [5, 1, 1, 1, 1].map((value) => new Decimal(value));
    // Rata-rata sederhana = 9/5 = 1,8. Berbobot 30/25/25/10/10 akan menghasilkan 2,2.
    expect(kpmrScore(pillars)?.toNumber()).toBe(1.8);
  });

  it("matriks: inheren Rendah × KPMR Strong = 5; inheren Tinggi × KPMR Unsatisfactory = 1", () => {
    expect(finalAssessmentValue("RENDAH", "STRONG")).toBe(5);
    expect(finalAssessmentValue("TINGGI", "UNSATISFACTORY")).toBe(1);
    expect(finalAssessmentValue("MENENGAH", "FAIR")).toBe(3);
    expect(finalAssessmentValue("RENDAH_KE_MENENGAH", "MARGINAL")).toBe(3);
    expect(finalAssessmentValue("MENENGAH_KE_TINGGI", "STRONG")).toBe(4);
  });
});

describe("pita dan kehadiran", () => {
  it("pita sempit dan menengah dipakai apa adanya lewat batas yang dikirim pemanggil", () => {
    const sempit = ["0", "1", "2", "3", null];
    expect(scoreFromPercentageBand(0, sempit)).toBe(5);
    expect(scoreFromPercentageBand("0.5", sempit)).toBe(4);
    expect(scoreFromPercentageBand("3.5", sempit)).toBe(1);
  });

  it("kehadiran: ada berarti risiko tinggi (1), tidak ada berarti rendah (5)", () => {
    expect(scoreFromPresence(true)).toBe(1);
    expect(scoreFromPresence(false)).toBe(5);
  });

  it("persentase negatif atau bukan angka ditolak, bukan didiamkan menjadi pita teraman", () => {
    expect(() => scoreFromPercentageBand(-1)).toThrow();
    expect(() => scoreFromPercentageBand(Number.NaN)).toThrow();
  });

  it("batas pita yang tidak menaik atau tidak berujung null ditolak", () => {
    expect(() => scoreFromPercentageBand(10, ["20", "10", "60", "80", null])).toThrow();
    expect(() => scoreFromPercentageBand(10, ["20", "40", "60", "80", "100"])).toThrow();
    expect(() => scoreFromPercentageBand(10, ["20", "40", null])).toThrow();
  });
});

describe("bobot dan penjumlahannya", () => {
  it("bobot jenis risiko berjumlah 1", () => {
    const total = Object.values(IRA_RISK_TYPE_WEIGHTS).reduce((sum, weight) => sum.plus(weight), new Decimal(0));
    expect(total.toNumber()).toBe(1);
  });

  it("bobot kelompok dalam tiap jenis risiko berjumlah 1", () => {
    for (const [riskType, groups] of Object.entries(IRA_GROUP_WEIGHTS)) {
      const total = Object.values(groups).reduce((sum, weight) => sum.plus(weight), new Decimal(0));
      expect([riskType, total.toNumber()]).toEqual([riskType, 1]);
    }
  });

  it("nilai kelompok adalah bobot kelompok × Σ(bobot parameter × nilai parameter)", () => {
    const value = weightedGroupScore("0.3", [
      { weight: "0.5", score: 5 },
      { weight: "0.5", score: 1 },
    ]);
    expect(value.toNumber()).toBe(0.9);
  });

  it("bobot parameter dalam satu kelompok wajib berjumlah 1", () => {
    expect(() => weightedGroupScore("0.3", [{ weight: "0.5", score: 5 }])).toThrow();
  });

  it("nilai jenis risiko adalah jumlah nilai kelompoknya (A1!E58)", () => {
    expect(riskTypeScore(["0.9", "0.4", "0.6", "0.2"]).toNumber()).toBe(2.1);
  });

  it("nilai inheren adalah Σ(bobot jenis × nilai jenis) — seluruh jenis bernilai 5 menghasilkan 5", () => {
    const perfect = inherentTotalScore({ TPPU: [5], TPPT: [5], PPSPM: [5], STRUKTURAL: [5] });
    expect(perfect.toNumber()).toBe(5);
    expect(riskPredicate(perfect)).toBe("RENDAH");
  });

  it("jenis risiko yang tidak dikirim ditolak, tidak diam-diam bernilai nol", () => {
    expect(() => inherentTotalScore({ TPPU: [5], TPPT: [5], PPSPM: [5] } as never)).toThrow();
  });
});

describe("nilai akhir", () => {
  it("matriksnya lima baris kali lima kolom, seluruhnya bernilai 1 sampai 5", () => {
    const rows = Object.values(IRA_FINAL_VALUE_MATRIX);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      const values = Object.values(row);
      expect(values).toHaveLength(5);
      for (const value of values) expect(value).toBeGreaterThanOrEqual(1);
      for (const value of values) expect(value).toBeLessThanOrEqual(5);
    }
  });

  it("predikat akhir memakai anchor yang sama: nilai 4 adalah Rendah ke Menengah", () => {
    expect(finalPredicate(4)).toBe("RENDAH_KE_MENENGAH");
    expect(finalPredicate(5)).toBe("RENDAH");
    expect(finalPredicate(1)).toBe("TINGGI");
  });

  it("anchornya persis 1 / 2 / 3 / 3,75 / 4,5", () => {
    expect(IRA_PREDICATE_ANCHORS.map((anchor) => anchor.minimum)).toEqual(["1", "2", "3", "3.75", "4.5"]);
  });

  it("bobot pilar KPMR ada sebagai keterangan tetapi tidak dipakai rumusnya", () => {
    const total = Object.values(IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY).reduce(
      (sum, weight) => sum.plus(weight),
      new Decimal(0),
    );
    expect(total.toNumber()).toBe(1);
  });
});

describe("jawaban kuesioner", () => {
  it("jawaban di luar 1..5 ditolak", () => {
    expect(() => kpmrPillarAverage([6])).toThrow();
    expect(() => kpmrPillarAverage([0])).toThrow();
    expect(() => kpmrPillarAverage([2.5])).toThrow();
  });

  it("pilar tanpa jawaban sama sekali dikecualikan dari nilai KPMR", () => {
    expect(kpmrScore([new Decimal(4), null, new Decimal(2)])?.toNumber()).toBe(3);
    expect(kpmrScore([null, null])).toBeNull();
  });
});
