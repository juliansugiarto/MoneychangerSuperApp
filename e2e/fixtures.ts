import { test as base, expect, type Page } from "@playwright/test";

/**
 * Masuk lewat prosedur `auth.login`, bukan dengan mengetik di formulir. Akun `test-controller`
 * dibuat server pengembangan sendiri dan ditolak di produksi; kata sandinya adalah konstanta
 * pengembangan di `server/internalAuth.ts`, dan basis datanya `mc_t_visual`.
 */
export const test = base.extend<{ signedInPage: Page }>({
  signedInPage: async ({ page, baseURL }, use) => {
    const response = await page.request.post(`${baseURL}/api/trpc/auth.login?batch=1`, {
      data: { 0: { json: { username: "test-controller", password: "123456" } } },
    });
    expect(response.ok(), `login gagal: ${response.status()}`).toBe(true);
    await page.clock.setFixedTime(new Date("2026-09-14T09:00:00+07:00"));
    await use(page);
  },
});

export { expect };

export const VIEWPORTS = [
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;
