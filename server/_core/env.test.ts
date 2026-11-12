import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Akun uji (sandi 123456) dan rahasia sesi acak hanya boleh hidup di mesin pengembang. Server yang lupa
 * mengisi NODE_ENV — mis. pm2 yang menjalankan `node dist/index.js` langsung — harus diperlakukan sebagai
 * produksi, bukan sebaliknya.
 */
const original = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = original;
  vi.resetModules();
});

async function isProductionWhen(nodeEnv: string | undefined) {
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  vi.resetModules();
  return (await import("./env")).ENV.isProduction;
}

describe("ENV.isProduction gagal-tertutup", () => {
  it.each([[undefined], [""], ["production"], ["staging"], ["Production"]])("NODE_ENV=%s dianggap produksi", async (value) => {
    expect(await isProductionWhen(value)).toBe(true);
  });
  it.each([["development"], ["test"]])("hanya NODE_ENV=%s yang membuka mode pengembang", async (value) => {
    expect(await isProductionWhen(value)).toBe(false);
  });
});
