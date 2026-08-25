import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { createInternalSession } from "./internalAuth";

const originalCookieSecret = ENV.cookieSecret;
const originalIsProduction = ENV.isProduction;

afterEach(() => {
  ENV.cookieSecret = originalCookieSecret;
  ENV.isProduction = originalIsProduction;
});

describe("session secret environment guard", () => {
  it("uses an in-memory secret only for development preview when JWT_SECRET is unavailable", async () => {
    ENV.cookieSecret = "";
    ENV.isProduction = false;
    await expect(createInternalSession({ id: 101, sessionVersion: 0 })).resolves.toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
  });

  it("fails closed in production when JWT_SECRET is unavailable", async () => {
    ENV.cookieSecret = "";
    ENV.isProduction = true;
    await expect(createInternalSession({ id: 101, sessionVersion: 0 })).rejects.toThrow("JWT_SECRET belum dikonfigurasi aman");
  });
});
