import { createConnection } from "mysql2/promise";
import superjson from "superjson";
import { expect, test } from "./fixtures";

/**
 * Laporan DTTOT ke Densus 88 lewat layar, sebagai Controller, di `mc_t_visual` (tidak pernah moneychanger/produksi).
 * Daftar DTTOT sintetis disisipkan langsung bila belum ada, karena impor berkas BI bukan bagian alur yang diuji di sini.
 */
test.beforeAll(async () => {
  const connection = await createConnection({ uri: "mysql://root@127.0.0.1:3306/mc_t_visual" });
  try {
    const [rows] = await connection.query("SELECT COUNT(*) AS n FROM sanctions_watchlist_entries WHERE listType = 'DTTOT'");
    if (Number((rows as { n: number }[])[0]?.n ?? 0) === 0) {
      await connection.query("INSERT INTO sanctions_watchlist_entries (listType, entityType, referenceCode, fullName, sourceFileName, importedByUserId) VALUES ('DTTOT', 'INDIVIDUAL', 'E2E-P25-001', 'Nama Fiktif Daftar Uji', 'e2e-dttot.xlsx', 1)");
    }
  } finally {
    await connection.end();
  }
});

test("Controller mencatat pemberitahuan, menyaring, mencetak laporan nihil, dan menandai pengiriman", async ({ signedInPage: page }) => {
  const letter = `R/E2E-${Date.now()}/RES.6.1./2026/Densus`;
  const created = await page.request.post("/api/trpc/dttotNotices.create?batch=1", { data: { 0: superjson.serialize({ noticeType: "PERPANJANGAN", policeLetterNumber: letter, listNumber: "DTTOT/P-25/X/RES.6.1./2026", receivedOn: "2026-10-15", policeLetterDate: "2026-10-10" }) } });
  expect(created.ok()).toBe(true);

  await page.goto("/kepatuhan/laporan-dttot");
  await expect(page.getByRole("heading", { name: "Laporan DTTOT ke Densus 88" })).toBeVisible();
  const card = page.locator("[data-slot=card]", { hasText: letter });
  await expect(card.getByText("Diterima Kamis, 15 Oktober 2026", { exact: false })).toBeVisible();
  await card.getByRole("button", { name: "Saring sekarang" }).click();
  await expect(card.getByText("nihil", { exact: true })).toBeVisible();

  await card.getByLabel("Nomor surat").fill("001/DTTOT/X/2026");
  await card.getByLabel("Kota").fill("Cianjur");
  await card.getByLabel("Ditandatangani").fill("Direktur Uji");
  await card.getByLabel("Jabatan", { exact: true }).fill("Direktur");
  const [report] = await Promise.all([page.waitForEvent("popup"), card.getByRole("button", { name: "Cetak laporan" }).click()]);
  await expect(report.getByText("atau NIHIL")).toBeVisible();
  await expect(report.getByText("c.q. Kepala Densus 88", { exact: false })).toBeVisible();
  await expect(report.getByText("tanggal 10 Oktober 2026", { exact: false })).toBeVisible();
  await expect(report.getByText("Cianjur, ", { exact: false })).toBeVisible();
  await report.screenshot({ path: "test-results/laporan-nihil.png", fullPage: true });
  await report.close();

  const steps = card.getByRole("button", { name: "Tandai terkirim" });
  await expect(steps).toHaveCount(5);
  await steps.first().click();
  await expect(card.getByText("1 dari 5 terkirim")).toBeVisible();
  await page.screenshot({ path: "test-results/laporan-dttot.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card.getByText("1 dari 5 terkirim")).toBeVisible();
  // Tidak ada gulir mendatar pada lebar ponsel.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await card.screenshot({ path: "test-results/laporan-dttot-390.png" });
});
