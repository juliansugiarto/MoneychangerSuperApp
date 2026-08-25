import { describe, expect, it } from "vitest";
import { calculateOperationalReadiness } from "../shared/operationalReadiness";

const completeOpening = { modalKerjaDiterima: true, alatUvSiap: true, mesinHitungSiap: true, kasAwalDicatat: true };
const completeClosing = { opnameFisikDilakukan: true, kasDirekonsiliasi: true, uangDiserahterimakan: true, brankasDikunci: true };

describe("pusat kesiapan operasional", () => {
  it("menyatakan semua kontrol siap hanya jika kurs, kas, checklist, pengawasan, dan arsip lengkap", () => {
    expect(calculateOperationalReadiness({ openingChecks: completeOpening, closingChecks: completeClosing, closingCompletedAt: new Date("2026-08-24T12:00:00.000Z"), cashBalanceCount: 2, activeRateCount: 2, referenceRateCount: 2, pendingReviewCount: 0, varianceCount: 0, directorOpenCount: 0 })).toMatchObject({ rateReady: true, cashReady: true, openingReady: true, closingReady: true, oversightReady: true, readyCount: 5 });
  });

  it("menahan kesiapan arsip dan pengawasan bila checklist belum selesai atau ada item terbuka", () => {
    const result = calculateOperationalReadiness({ openingChecks: completeOpening, closingChecks: { ...completeClosing, brankasDikunci: false }, closingCompletedAt: null, cashBalanceCount: 1, activeRateCount: 1, referenceRateCount: 1, pendingReviewCount: 1, varianceCount: 1, directorOpenCount: 1 });
    expect(result).toMatchObject({ closingReady: false, oversightReady: false, pendingReviews: 2, readyCount: 3 });
  });

  it("tidak menyatakan kurs siap hanya karena ada kurs aktif tanpa pembanding", () => {
    const result = calculateOperationalReadiness({ openingChecks: {}, closingChecks: {}, cashBalanceCount: 0, activeRateCount: 1, referenceRateCount: 0, pendingReviewCount: 0, varianceCount: 0, directorOpenCount: 0 });
    expect(result.rateReady).toBe(false);
    expect(result.readyCount).toBe(1);
  });
});
