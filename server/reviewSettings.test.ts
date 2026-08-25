import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.fn();

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

const { getReviewThreshold } = await import("./operations");

describe("getReviewThreshold", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("returns safe USD, EDD-cash, and rate-shock defaults when the database is temporarily unavailable", async () => {
    getDbMock.mockResolvedValue(null);

    await expect(getReviewThreshold()).resolves.toEqual({
      reviewThresholdUsd: "10000.00",
      eddCashDailyThresholdIdr: "100000000.00",
      rateShockThresholdPercent: "1.5000",
      isFallback: true,
    });
  });
});
