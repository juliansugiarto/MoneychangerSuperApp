import { describe, expect, it } from "vitest";
import { adminProcedure, controllerProcedure, hasMinimumRole, router, shareholderProcedure, staffProcedure } from "./trpc";

const passwordGateRouter = router({
  staff: staffProcedure.query(() => "staff-ok"),
  admin: adminProcedure.query(() => "admin-ok"),
  controller: controllerProcedure.query(() => "controller-ok"),
  shareholder: shareholderProcedure.query(() => "shareholder-ok"),
});

function createPasswordGateCaller(role: "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER", mustChangePassword: boolean) {
  return passwordGateRouter.createCaller({
    req: { headers: {} } as never,
    res: {} as never,
    user: { id: 1, role, mustChangePassword } as never,
  });
}

describe("role authorization matrix", () => {
  const roles = ["STAFF", "ADMIN", "CONTROLLER", "SHAREHOLDER"] as const;

  it("enforces every role-to-minimum-role combination", () => {
    for (const [actualIndex, actual] of roles.entries()) {
      for (const [requiredIndex, required] of roles.entries()) {
        expect(hasMinimumRole(actual, required)).toBe(actualIndex >= requiredIndex);
      }
    }
  });

  it("allows staff to use staff-level actions only", () => {
    expect(hasMinimumRole("STAFF", "STAFF")).toBe(true);
    expect(hasMinimumRole("STAFF", "ADMIN")).toBe(false);
  });

  it("allows Admin and Controller to inherit lower operational access", () => {
    expect(hasMinimumRole("ADMIN", "STAFF")).toBe(true);
    expect(hasMinimumRole("CONTROLLER", "ADMIN")).toBe(true);
    expect(hasMinimumRole("ADMIN", "CONTROLLER")).toBe(false);
  });

  it("keeps Shareholder access as the highest authority", () => {
    expect(hasMinimumRole("SHAREHOLDER", "SHAREHOLDER")).toBe(true);
    expect(hasMinimumRole("SHAREHOLDER", "CONTROLLER")).toBe(true);
    expect(hasMinimumRole("CONTROLLER", "SHAREHOLDER")).toBe(false);
  });

  it("blocks every role from operational procedures until the initial password is changed", async () => {
    await expect(createPasswordGateCaller("STAFF", true).staff()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createPasswordGateCaller("ADMIN", true).admin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createPasswordGateCaller("CONTROLLER", true).controller()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createPasswordGateCaller("SHAREHOLDER", true).shareholder()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an authorized role after its initial password has been changed", async () => {
    await expect(createPasswordGateCaller("ADMIN", false).admin()).resolves.toBe("admin-ok");
  });
});
