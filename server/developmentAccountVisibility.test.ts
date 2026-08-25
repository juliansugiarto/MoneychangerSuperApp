import { describe, expect, it } from "vitest";
import { shouldListInternalAccount } from "./db";

describe("development test account visibility", () => {
  it("keeps development accounts visible locally but excludes them from production user administration", () => {
    expect(shouldListInternalAccount("DEVELOPMENT_TEST", false)).toBe(true);
    expect(shouldListInternalAccount("DEVELOPMENT_TEST", true)).toBe(false);
    expect(shouldListInternalAccount("INTERNAL", true)).toBe(true);
    expect(shouldListInternalAccount(null, true)).toBe(true);
  });
});
