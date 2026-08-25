import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.fn();

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

const { getRateSyncStatus } = await import("./biRateSync");

function statusDatabase() {
  const query: Record<string, unknown> & PromiseLike<unknown[]> = {
    from: () => query,
    where: () => query,
    limit: () => query,
    then: (onfulfilled, onrejected) => Promise.resolve([{ id: 7, source: "BANK_INDONESIA_TRANSACTION_RATES" }]).then(onfulfilled, onrejected),
  };
  return { select: vi.fn(() => query) };
}

describe("getRateSyncStatus", () => {
  beforeEach(() => getDbMock.mockReset());

  it("retries once then returns the BI configuration after a transient unavailable database", async () => {
    getDbMock.mockResolvedValueOnce(null).mockResolvedValue(statusDatabase());

    await expect(getRateSyncStatus()).resolves.toMatchObject({ id: 7, source: "BANK_INDONESIA_TRANSACTION_RATES" });
    expect(getDbMock).toHaveBeenCalledTimes(2);
  });
});
