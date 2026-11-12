import { expect, test, type APIRequestContext } from "@playwright/test";
import mysql from "mysql2/promise";

/**
 * Halaman publik "Paspor & cap" dan /papan terhadap `mc_t_visual`. Kurs dibuat lewat jalur staf sungguhan
 * (masuk → simpan draf papan → aktifkan dengan alasan), bukan disuntik ke tabel. Gerak dimatikan
 * (`reducedMotion`) supaya tidak ada sampul kedatangan dan cap yang menahan klik.
 */
async function trpc(request: APIRequestContext, path: string, input: unknown) {
  const response = await request.post(`/api/trpc/${path}?batch=1`, { data: { 0: { json: input } } });
  expect(response.ok(), `${path}: ${response.status()} ${await response.text()}`).toBe(true);
  return (await response.json())[0].result.data.json;
}

test.beforeAll(async ({ request }) => {
  await trpc(request, "auth.login", { username: "test-controller", password: "123456" });
  const currencies = await request.get(`/api/trpc/currencies.list?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: { json: null } }))}`);
  const list: { id: number; code: string; active: boolean }[] = (await currencies.json())[0].result.data.json;
  const pick = (code: string) => list.find((currency) => currency.code === code && currency.active);
  const cells = [
    { code: "USD", buyRate: "16310", sellRate: "16420" },
    { code: "SAR", buyRate: "4320", sellRate: "4390" },
  ].flatMap((cell) => { const currency = pick(cell.code); return currency ? [{ currencyId: currency.id, rateTierId: null, quoteUnit: "1", buyRate: cell.buyRate, sellRate: cell.sellRate }] : []; });
  expect(cells.length, "mc_t_visual perlu valuta USD/SAR aktif").toBeGreaterThan(0);
  await trpc(request, "rates.saveBoardDrafts", { cells });
  await trpc(request, "rates.activateBoard", { approvalReason: "Uji e2e halaman publik paspor" });
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test.describe(`halaman publik @ ${viewport.width}`, () => {
    test.use({ viewport, reducedMotion: "reduce", locale: "id-ID", timezoneId: "Asia/Jakarta" });

    test("kurs, saklar, hitung, tanpa gulir mendatar", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1, name: "Kurs hari ini" })).toBeVisible();
      await expect(page.locator(viewport.width < 960 ? ".mrates li" : "table.rates tbody tr").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      const hero = page.locator("#kurs");
      await hero.getByRole("radio", { name: "Saya beli valas" }).click();
      await expect(hero.locator(".tg")).toHaveAttribute("data-dir", "beli");
      await expect(page.locator("#hitung .tg")).toHaveAttribute("data-dir", "beli");

      await page.locator("#fCur").selectOption("USD");
      await page.locator("#fAmt").fill("3");
      // 3 × 16.420 = 49.260 → dibulatkan ke atas kelipatan Rp 100 = 49.300.
      await expect(page.locator("#hitung .res-sum")).toHaveText("Anda beli 3 USD. Perkiraan Anda membayar Rp 49.300.");
      await page.locator("#fAmt").fill("lima");
      await expect(page.locator("#eAmt")).toHaveText("Jumlah valas belum terbaca. Isi dengan angka, misalnya 500.");
    });
  });
}

test.describe("tiket konfirmasi", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "id-ID", timezoneId: "Asia/Jakarta" });

  test("menulis service_requests sungguhan dan menampilkan nomornya", async ({ page }) => {
    await page.goto("/");
    await page.locator("#fCur").selectOption("USD");
    await page.locator("#fAmt").fill("500");
    await page.getByRole("button", { name: "Minta konfirmasi kurs" }).first().click();
    const ticket = page.locator("#konfirmasi");
    await ticket.getByRole("button", { name: "Minta konfirmasi kurs" }).click();
    await expect(ticket.locator("#eName")).toContainText("Nama belum diisi");
    await ticket.getByLabel("Nama Anda").fill("Uji E2E Paspor");
    await ticket.getByLabel("Nomor WhatsApp Anda").fill("0812 3456 7890");
    await ticket.getByLabel("Saya setuju dihubungi petugas untuk membahas permintaan ini.").check();
    await ticket.getByRole("button", { name: "Minta konfirmasi kurs" }).click();
    await expect(ticket.getByRole("heading", { name: "Permintaan diterima" })).toBeVisible();
    const number = (await ticket.locator(".req-no .sr").textContent())?.trim() ?? "";
    expect(number).toMatch(/^LNY-\d{8}-[A-Z0-9_-]{6}$/);

    const db = await mysql.createConnection({ host: "127.0.0.1", user: "root", database: "mc_t_visual" });
    try {
      const [rows] = await db.query("SELECT requesterName, contactChannel, operation, foreignAmount, status FROM service_requests WHERE requestNumber = ?", [number]);
      // "Anda jual" (bawaan) = perusahaan membeli = BUY.
      expect(rows).toEqual([{ requesterName: "Uji E2E Paspor", contactChannel: "WHATSAPP", operation: "BUY", foreignAmount: "500.000000", status: "BARU" }]);
    } finally {
      await db.end();
    }
  });
});

test.describe("/papan", () => {
  test.use({ viewport: { width: 1600, height: 900 }, reducedMotion: "reduce", locale: "id-ID", timezoneId: "Asia/Jakarta" });

  test("papan kurs layar penuh dengan jam dan kurs aktif", async ({ page }) => {
    await page.goto("/papan");
    await expect(page).toHaveTitle(/^Papan kurs: /);
    await expect(page.locator(".pp-row").first()).toBeVisible();
    await expect(page.locator(".pp-clock b")).toHaveText(/^\d{2}\.\d{2}\.\d{2}$/);
    await expect(page.getByRole("link", { name: "Buka halaman utama" })).toHaveAttribute("href", "/");
  });
});
