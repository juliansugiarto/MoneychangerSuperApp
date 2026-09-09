import { describe, expect, it } from "vitest";
import {
  IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY,
  kpmrPillarAverage,
  kpmrScore,
} from "./individualRiskAssessment";
import {
  IRA_KPMR_PILLARS,
  IRA_KPMR_QUESTIONS,
  IRA_KPMR_QUESTION_COUNT_BY_PILLAR,
  kpmrQuestion,
  questionsOfPillar,
} from "./iraKpmrCatalogue";

describe("katalog pertanyaan KPMR", () => {
  it("berjumlah 31 pertanyaan", () => {
    expect(IRA_KPMR_QUESTIONS).toHaveLength(31);
  });

  it("terbagi 7 / 8 / 10 / 3 / 3 sesuai lembar B", () => {
    expect(
      IRA_KPMR_PILLARS.map((pillar) => questionsOfPillar(pillar).length),
    ).toEqual([7, 8, 10, 3, 3]);
    expect(
      IRA_KPMR_PILLARS.map(
        (pillar) => IRA_KPMR_QUESTION_COUNT_BY_PILLAR[pillar],
      ),
    ).toEqual([7, 8, 10, 3, 3]);
  });

  it("pilarnya sama persis dengan yang dipakai aritmetika, bukan kosakata kedua", () => {
    expect(IRA_KPMR_PILLARS).toEqual(
      Object.keys(IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY),
    );
  });

  it("berkode unik, bernomor urut dalam pilarnya, dan berteks penuh", () => {
    expect(
      new Set(IRA_KPMR_QUESTIONS.map((question) => question.code)).size,
    ).toBe(31);
    for (const pillar of IRA_KPMR_PILLARS) {
      const numbers = questionsOfPillar(pillar).map(
        (question) => question.number,
      );
      expect([pillar, numbers]).toEqual([
        pillar,
        numbers.map((_, index) => index + 1),
      ]);
    }
    for (const question of IRA_KPMR_QUESTIONS)
      expect(question.question.trim().length).toBeGreaterThan(40);
  });

  it("kode tidak dikenal dilempar, bukan mengembalikan undefined", () => {
    expect(() => kpmrQuestion("KPMR_P9_1")).toThrow();
  });
});

describe("keberlakuan bagi KUPVA BB", () => {
  it("tepat satu pertanyaan tidak berlaku — kegiatan transfer dana", () => {
    const notApplicable = IRA_KPMR_QUESTIONS.filter(
      (question) => !question.applicableToKupvaBb,
    );
    expect(notApplicable.map((question) => question.code)).toEqual([
      "KPMR_P2_6",
    ]);
    expect(notApplicable[0].question).toContain("Transfer Dana");
  });

  it("pertanyaan yang tidak berlaku menjadi N/A terisi, bukan pertanyaan kosong yang menunggu", () => {
    // 30 pertanyaan berlaku; satu N/A tidak boleh menurunkan rata-rata pilarnya.
    const pilar2 = questionsOfPillar("KEBIJAKAN_PROSEDUR");
    const answers = pilar2.map((question) =>
      question.applicableToKupvaBb ? 4 : null,
    );
    expect(kpmrPillarAverage(answers)?.toNumber()).toBe(4);
    expect(
      IRA_KPMR_QUESTIONS.filter((question) => question.applicableToKupvaBb),
    ).toHaveLength(30);
  });

  it("seluruh pilar tetap punya pertanyaan yang berlaku — tidak ada pilar yang selalu N/A", () => {
    for (const pillar of IRA_KPMR_PILLARS) {
      const applicable = questionsOfPillar(pillar).filter(
        (question) => question.applicableToKupvaBb,
      );
      expect([pillar, applicable.length > 0]).toEqual([pillar, true]);
    }
    const perfect = IRA_KPMR_PILLARS.map((pillar) =>
      kpmrPillarAverage(
        questionsOfPillar(pillar).map((question) =>
          question.applicableToKupvaBb ? 5 : null,
        ),
      ),
    );
    expect(kpmrScore(perfect)?.toNumber()).toBe(5);
  });
});

describe("kaitan dengan temuan pemeriksaan", () => {
  const findingsOf = (code: string) => kpmrQuestion(code).relatedFindings;

  it("temuan 8 pada KPT bertanda tangan dan pelaporan LTKM/LTKT di pilar 1", () => {
    expect(findingsOf("KPMR_P1_1")).toContain(8);
    expect(findingsOf("KPMR_P1_4")).toContain(8);
    expect(kpmrQuestion("KPMR_P1_4").question).toContain("LTKM");
  });

  it("temuan 9 pada pengkinian profil nasabah dan profil transaksi", () => {
    expect(findingsOf("KPMR_P1_6")).toContain(9);
    expect(findingsOf("KPMR_P3_6")).toContain(9);
  });

  it("temuan 10 dan 11 ada di pilar 3", () => {
    const pilar3 = questionsOfPillar("PROSES_MANAJEMEN_RISIKO").flatMap(
      (question) => question.relatedFindings,
    );
    expect(pilar3).toContain(10);
    expect(pilar3).toContain(11);
  });

  it("temuan 12 pada pre-employee screening di pilar 4", () => {
    expect(findingsOf("KPMR_P4_1")).toContain(12);
    expect(kpmrQuestion("KPMR_P4_1").question).toContain(
      "pre-employee screening",
    );
  });

  it("hanya temuan 8 sampai 12 yang dikaitkan, dan tiap temuan itu benar-benar terpakai", () => {
    const used = new Set(
      IRA_KPMR_QUESTIONS.flatMap((question) => question.relatedFindings),
    );
    expect([...used].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12]);
  });
});
