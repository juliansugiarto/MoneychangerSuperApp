import { describe, expect, it } from "vitest";
import { accessStateFor } from "./accessState";

describe("accessStateFor", () => {
  it.each([
    [{ loading: true, user: null }, "STAFF", "LOADING"],
    [{ loading: false, user: null }, "STAFF", "SIGNED_OUT"],
    [{ loading: false, user: { role: "SHAREHOLDER", mustChangePassword: true } }, "STAFF", "MUST_CHANGE_PASSWORD"],
    [{ loading: false, user: { role: "STAFF" } }, "CONTROLLER", "FORBIDDEN"],
    [{ loading: false, user: { role: "CONTROLLER", mustChangePassword: false } }, "CONTROLLER", "ALLOWED"],
    [{ loading: false, user: { role: "SHAREHOLDER" } }, "ADMIN", "ALLOWED"],
  ] as const)("%j pada %s → %s", (input, minimumRole, expected) => {
    expect(accessStateFor(input, minimumRole)).toBe(expected);
  });
});
