import { describe, expect, it } from "vitest";
import { isExpectedBiRateSyncTask } from "./biRateSync";

describe("BI scheduled sync authorization", () => {
  it("allows only the enabled schedule task persisted for BI sync", () => {
    expect(isExpectedBiRateSyncTask("task-bi-1", "task-bi-1", true)).toBe(true);
    expect(isExpectedBiRateSyncTask("task-other", "task-bi-1", true)).toBe(false);
    expect(isExpectedBiRateSyncTask("task-bi-1", "task-bi-1", false)).toBe(false);
    expect(isExpectedBiRateSyncTask("task-bi-1", null, true)).toBe(false);
  });
});
