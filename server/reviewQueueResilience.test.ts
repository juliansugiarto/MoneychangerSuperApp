import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.fn();

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

const operations = await import("./operations");

function emptySelectQuery() {
  const query: Record<string, unknown> & PromiseLike<unknown[]> = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    then: (onfulfilled, onrejected) => Promise.resolve([]).then(onfulfilled, onrejected),
  };
  return query;
}

describe("review queue resilience", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("retries the review-queue dashboard read once after a transient database outage", async () => {
    const readOnlyDatabase = { select: vi.fn(() => emptySelectQuery()) };
    getDbMock.mockResolvedValueOnce(null).mockResolvedValue(readOnlyDatabase);

    const dashboard = await operations.getOperationalDashboard();

    expect(getDbMock).toHaveBeenCalledTimes(3);
    expect(dashboard.pendingReview).toEqual([]);
    expect(dashboard.isDataUnavailable).toBe(false);
  });

  it("returns an explicit empty review queue instead of throwing when the outage persists", async () => {
    getDbMock.mockResolvedValue(null);

    const dashboard = await operations.getOperationalDashboard();

    expect(dashboard.isDataUnavailable).toBe(true);
    expect(dashboard.pendingReview).toEqual([]);
  });
});
