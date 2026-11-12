import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { ensureDevelopmentTestAccounts } from "./internalAuth";
import { authThrottle } from "./loginThrottle";
import { appRouter } from "./routers";

const caller = (ip: string) => appRouter.createCaller({
  req: { headers: {}, ip } as never,
  res: { cookie: () => undefined, clearCookie: () => undefined } as never,
  user: null,
});

beforeAll(async () => {
  ENV.cookieSecret ||= "test-session-secret-for-login-throttle-2026";
  await ensureDevelopmentTestAccounts();
}, 20000);
beforeEach(() => authThrottle.reset());

describe("auth.login dibatasi", () => {
  it("kegagalan kelima mengunci, bahkan untuk kata sandi yang benar sesudahnya", async () => {
    const login = caller("198.51.100.7").auth.login;
    for (let i = 0; i < 5; i += 1) await expect(login({ username: "test-staff", password: "salah-salah" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(login({ username: "test-staff", password: "123456" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: expect.stringContaining("30 detik") });
  }, 20000);

  it("username yang tidak ada, kata sandi salah, dan format username salah mendapat pesan yang sama", async () => {
    const login = caller("198.51.100.8").auth.login;
    const messages = await Promise.all([
      login({ username: "tidak-ada-orangnya", password: "apa-saja" }).catch((error) => error.message),
      login({ username: "test-staff", password: "salah-salah" }).catch((error) => error.message),
      login({ username: "Ada Spasi", password: "apa-saja" }).catch((error) => error.message),
    ]);
    expect(new Set(messages)).toEqual(new Set(["Username atau kata sandi tidak valid."]));
  }, 20000);

  it("username yang tidak ada terkunci pada kegagalan kelima juga", async () => {
    const login = caller("198.51.100.9").auth.login;
    for (let i = 0; i < 5; i += 1) await expect(login({ username: "hantu", password: "apa-saja" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(login({ username: "hantu", password: "apa-saja" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  }, 20000);

  it("berhasil masuk menghapus hitungan username", async () => {
    const login = caller("198.51.100.10").auth.login;
    for (let i = 0; i < 4; i += 1) await expect(login({ username: "test-admin", password: "salah-salah" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(login({ username: "test-admin", password: "123456" })).resolves.toMatchObject({ username: "test-admin" });
    // Tanpa penghapusan, hitungan username sudah 4 dan kegagalan berikutnya akan mengunci.
    const fromElsewhere = caller("198.51.100.11").auth.login;
    for (let i = 0; i < 4; i += 1) await expect(fromElsewhere({ username: "test-admin", password: "salah-salah" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller("198.51.100.12").auth.login({ username: "test-admin", password: "123456" })).resolves.toMatchObject({ username: "test-admin" });
  }, 20000);

  it("tebakan yang dikirim bersamaan (satu batch tRPC) tetap hanya mendapat lima kesempatan", async () => {
    const login = caller("198.51.100.13").auth.login;
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => login({ username: "test-controller", password: "salah-salah" })));
    const codes = results.map((result) => (result.status === "rejected" ? (result.reason as { code?: string }).code : "OK"));
    expect(codes.filter((code) => code === "UNAUTHORIZED")).toHaveLength(5);
    expect(codes.filter((code) => code === "TOO_MANY_REQUESTS")).toHaveLength(15);
  }, 30000);
});
