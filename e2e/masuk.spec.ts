import { VIEWPORTS, expect, test } from "./fixtures";

for (const viewport of VIEWPORTS) {
  test.describe(`masuk dan halaman publik @ ${viewport.name}`, () => {
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

    test("halaman depan tanpa gulir mendatar", async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-09-14T09:00:00+07:00"));
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("hari ini");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page).toHaveScreenshot(`beranda-${viewport.name}.png`, { fullPage: true, mask: [page.locator("table"), page.getByText(/Diperbarui/)] });
    });
  });
}

test.describe("halaman depan @ ponsel 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("tidak terpotong mendatar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("hari ini");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
