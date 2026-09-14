import { VIEWPORTS, expect, test } from "./fixtures";

const SECTIONS = ["token", "palet", "kepala-halaman", "keadaan", "ubin", "tabel", "daftar-detail", "formulir", "alur", "laporan"];
const PALETTES = ["Marun", "Zamrud", "Samudra", "Terakota", "Anggur", "Arang"];

for (const viewport of VIEWPORTS) {
  test.describe(`fondasi desain @ ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("shell: kepala 48px, sidebar, dan tanpa gulir mendatar", async ({ signedInPage: page }) => {
      await page.goto("/operasional/pola");
      await expect(page.getByRole("heading", { level: 1, name: "Galeri pola" })).toBeVisible();
      const header = page.locator("header").first();
      expect((await header.boundingBox())!.height).toBe(48);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page).toHaveScreenshot(`shell-${viewport.name}.png`);
    });

    for (const id of SECTIONS) {
      test(`galeri: #${id}`, async ({ signedInPage: page }) => {
        await page.goto("/operasional/pola");
        const section = page.locator(`section#${id}`);
        await section.scrollIntoViewIfNeeded();
        await expect(section).toHaveScreenshot(`${id}-${viewport.name}.png`);
      });
    }

    test("⌘K membuka palet dan menemukan halaman", async ({ signedInPage: page }) => {
      await page.goto("/operasional/pola");
      // Tunggu hidrasi selesai — tanpa ini pintasan tertekan sebelum React memasang
      // pendengar `keydown` pada `window`, sehingga tombolnya tidak berefek.
      await expect(page.getByRole("heading", { level: 1, name: "Galeri pola" })).toBeVisible();
      await page.keyboard.press("ControlOrMeta+k");
      await page.keyboard.type("kas awal");
      await expect(page.getByRole("option", { name: /Kas Awal Hari Ini/ })).toBeVisible();
    });
  });
}

// Satu tangkapan per palet pada ukuran terkecil yang wajib (spec 2026-09-13 §A6).
test.describe("palet tema @ 1280x800", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const name of PALETTES) {
    test(`palet: ${name}`, async ({ signedInPage: page }) => {
      await page.goto("/operasional/pola");
      const section = page.locator("section#palet");
      await section.scrollIntoViewIfNeeded();
      await section.getByRole("radio", { name }).click();
      await expect(section).toHaveScreenshot(`palet-${name.toLowerCase()}-1280x800.png`);
    });
  }
});
