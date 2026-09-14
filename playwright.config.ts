import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Uji tangkapan layar fondasi desain. Server dijalankan sendiri terhadap `mc_t_visual` pada port
 * 3100, tidak memakai server pengembangan di 3000 maupun basis data `moneychanger`.
 */
export default defineConfig({
  testDir: "e2e",
  snapshotPathTemplate: "e2e/__screenshots__/{testFilePath}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" } },
  use: { baseURL, locale: "id-ID", timezoneId: "Asia/Jakarta", ...devices["Desktop Chrome"] },
  webServer: {
    command: "./node_modules/.bin/tsx server/_core/index.ts",
    url: `${baseURL}/api/trpc/auth.me`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "development",
      PORT: String(PORT),
      DATABASE_URL: "mysql://root@127.0.0.1:3306/mc_t_visual",
      TENANT_REGISTRY: "",
    },
  },
});
