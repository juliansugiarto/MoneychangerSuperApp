import { VIEWPORTS, expect, test } from "./fixtures";

for (const viewport of VIEWPORTS) {
  test.describe(`masuk @ ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("halaman masuk", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1, name: "Masuk" })).toBeVisible();
      await expect(page).toHaveScreenshot(`login-${viewport.name}.png`);
    });

    test("pulihkan akun pemilik", async ({ page }) => {
      await page.goto("/pulihkan");
      await expect(page.getByRole("heading", { level: 1, name: "Pulihkan akun pemilik" })).toBeVisible();
      await expect(page).toHaveScreenshot(`pulihkan-${viewport.name}.png`);
    });

    test("wizard pada instalasi yang sudah disiapkan", async ({ page }) => {
      await page.goto("/siapkan");
      await expect(page.getByRole("heading", { level: 1, name: "Perusahaan ini sudah disiapkan" })).toBeVisible();
      await expect(page).toHaveScreenshot(`siapkan-selesai-${viewport.name}.png`);
    });
  });
}
