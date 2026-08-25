import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { ensureDevelopmentTestAccounts } from "./internalAuth";
import { appRouter } from "./routers";

const originalCookieSecret = ENV.cookieSecret;
const originalIsProduction = ENV.isProduction;

afterEach(() => {
  ENV.cookieSecret = originalCookieSecret;
  ENV.isProduction = originalIsProduction;
});

describe("development-only internal test accounts", () => {
  it("provisions all four roles for development login and rejects those accounts in production mode", async () => {
    const password = "123456";

    ENV.cookieSecret = "test-session-secret-for-development-accounts-2026";
    ENV.isProduction = false;
    await ensureDevelopmentTestAccounts();

    const loginCaller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: { cookie: () => undefined } as never,
      user: null,
    });
    await expect(loginCaller.auth.login({ username: "test-shareholder", password })).resolves.toMatchObject({ username: "test-shareholder", role: "SHAREHOLDER" });
    await expect(loginCaller.auth.login({ username: "test-controller", password })).resolves.toMatchObject({ username: "test-controller", role: "CONTROLLER" });
    await expect(loginCaller.auth.login({ username: "test-admin", password })).resolves.toMatchObject({ username: "test-admin", role: "ADMIN" });
    await expect(loginCaller.auth.login({ username: "test-staff", password })).resolves.toMatchObject({ username: "test-staff", role: "STAFF" });

    ENV.isProduction = true;
    await expect(loginCaller.auth.login({ username: "test-admin", password })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(ensureDevelopmentTestAccounts()).resolves.toBe(false);
  }, 20000);
});
