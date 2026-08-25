import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { getOperationalDashboard } from "./operations";

describe("operational dashboard availability", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockReset();
  });

  it("returns an explicit degraded state instead of throwing when a temporary database outage persists", async () => {
    vi.mocked(getDb).mockResolvedValue(undefined);

    const result = await getOperationalDashboard();

    expect(result.isDataUnavailable).toBe(true);
    expect(result.todayTransactions).toEqual([]);
    expect(result.pendingReview).toEqual([]);
    expect(result.cashBalances).toEqual([]);
    expect(result.variances).toEqual([]);
  });
});
