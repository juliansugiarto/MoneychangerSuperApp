import { createConnection } from "mysql2/promise";
import superjson from "superjson";
import { expect, test } from "./fixtures";
import { v1Fixtures } from "../server/v1Fixtures";

/**
 * Laporan DTTOT (ke Densus 88) dan DPPSPM (ke PPATK) lewat layar, sebagai Controller, di `mc_t_visual` (tidak pernah moneychanger/produksi).
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
  await expect(page.getByRole("heading", { name: "Laporan DTTOT & DPPSPM" })).toBeVisible();
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

test("Penghapusan: blokir yang dicabut dengan surat Densus tercetak sebagai Berita Acara Pembukaan Pemblokiran", async ({ signedInPage: page }) => {
  const runId = Date.now();
  // Nama unik tanpa angka (pencocokan nama mengabaikan angka): digit → huruf.
  const suffix = String(runId).slice(-6).replace(/\d/g, (digit) => "ABCDEFGHIJ"[Number(digit)]!);
  const name = `Muasih Peragaan ${suffix}`;
  const letter = `R/E2E-HAPUS-${runId}/RES.6.1./2026/Densus`;
  const call = async <T,>(path: string, input: unknown) => {
    const response = await page.request.post(`/api/trpc/${path}?batch=1`, { data: { 0: superjson.serialize(input) } });
    const body = await response.json();
    expect(response.ok(), `${path}: ${JSON.stringify(body).slice(0, 300)}`).toBe(true);
    return superjson.deserialize(body[0].result.data) as T;
  };
  const connection = await createConnection({ uri: "mysql://root@127.0.0.1:3306/mc_t_visual" });
  try {
    await connection.query("INSERT INTO sanctions_watchlist_entries (listType, entityType, referenceCode, fullName, sourceFileName, importedByUserId) VALUES ('DTTOT', 'INDIVIDUAL', ?, ?, 'e2e-dttot.xlsx', 1)", [`E2E-HAPUS-${suffix}`, name.toUpperCase()]);
    // Nasabah baru disaring saat disimpan → blokir terbuka otomatis.
    const customer = await call<{ id: number }>("customers.create", { ...v1Fixtures.customer, cifNumber: `E2E-HAPUS-${runId}`, identityNumber: `3175${String(runId).slice(-12)}`, fullName: name });
    const [blocks] = await connection.query("SELECT id FROM watchlist_blocks WHERE customerId = ? AND status = 'OPEN'", [customer.id]);
    const blockId = (blocks as { id: number }[])[0]!.id;
    await call("watchlistBlocks.resolve", { blockId, decision: "CONFIRMED", notes: "cocok DTTOT peragaan" });
    await call("watchlistBlocks.revoke", { blockId, revocationReference: letter, notes: "dihapus dari DTTOT" });
    await connection.query("DELETE FROM sanctions_watchlist_entries WHERE referenceCode = ?", [`E2E-HAPUS-${suffix}`]);
  } finally {
    await connection.end();
  }
  await call("dttotNotices.create", { noticeType: "PENGHAPUSAN", policeLetterNumber: letter, listNumber: "DTTOT/P-24.a/X/RES.6.1./2026", receivedOn: "2026-10-15", policeLetterDate: "2026-10-09" });

  await page.goto("/kepatuhan/laporan-dttot");
  const card = page.locator("[data-slot=card]", { hasText: letter });
  await card.getByRole("button", { name: "Saring sekarang" }).click();
  await expect(card.getByText("1 blokir sudah dicabut dengan surat ini.", { exact: false })).toBeVisible();
  await card.getByLabel("Nomor surat").fill("005/DTTOT/X/2026");
  await card.getByLabel("Kota").fill("Cianjur");
  await card.getByLabel("Ditandatangani").fill("Direktur Uji");
  await card.getByLabel("Jabatan", { exact: true }).fill("Direktur");
  await card.getByLabel("Saksi", { exact: true }).fill("Saksi Uji");
  await card.getByLabel("Jabatan saksi").fill("Petugas APU PPT");
  const [report] = await Promise.all([page.waitForEvent("popup"), card.getByRole("button", { name: "Cetak laporan" }).click()]);
  await expect(report.getByText("Laporan Pembukaan Pemblokiran")).toBeVisible();
  await expect(report.getByRole("heading", { name: /PEMBUKAAN PEMBLOKIRAN/ })).toBeVisible();
  await expect(report.getByText(name, { exact: false }).first()).toBeVisible();
  await report.screenshot({ path: "test-results/laporan-pembukaan.png", fullPage: true });
  await report.close();
});

test("DPPSPM: dicatat lewat formulir, disaring, laporan nihil ditujukan ke PPATK dengan empat langkah kirim", async ({ signedInPage: page }) => {
  const connection = await createConnection({ uri: "mysql://root@127.0.0.1:3306/mc_t_visual" });
  try {
    const [rows] = await connection.query("SELECT COUNT(*) AS n FROM sanctions_watchlist_entries WHERE listType = 'DPPSPM'");
    if (Number((rows as { n: number }[])[0]?.n ?? 0) === 0) {
      await connection.query("INSERT INTO sanctions_watchlist_entries (listType, sourceLabel, entityType, referenceCode, fullName, sourceFileName, importedByUserId) VALUES ('DPPSPM', 'DPRK', 'INDIVIDUAL', 'DPRKi.E2E', 'Nama Fiktif Proliferasi Uji', 'e2e-dppspm.xlsx', 1)");
    }
  } finally {
    await connection.end();
  }
  const decision = `KEP-E2E-${Date.now()}/PPATK/2026`;
  await page.goto("/kepatuhan/laporan-dttot");
  await page.getByLabel("Daftar", { exact: true }).selectOption("DPPSPM");
  await expect(page.getByLabel("Jenis", { exact: true })).toHaveValue("PEMBARUAN");
  await page.getByLabel("Nomor keputusan PPATK").fill(decision);
  await page.getByLabel("Tanggal keputusan PPATK").fill("2026-09-10");
  await page.getByLabel("Diterima", { exact: true }).fill("2026-09-12");
  await page.getByRole("button", { name: "Catat pemberitahuan" }).click();

  const card = page.locator("[data-slot=card]", { hasText: decision });
  await expect(card.getByText(`DPPSPM · Pembaruan daftar · ${decision}`)).toBeVisible();
  await card.getByRole("button", { name: "Saring sekarang" }).click();
  await expect(card.getByText("nihil", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Tandai terkirim" })).toHaveCount(4);
  await expect(card.getByText("Surat asli dikirim ke PPATK", { exact: false })).toBeVisible();

  await card.getByLabel("Nomor surat").fill("02/IBV/IX/2026");
  await card.getByLabel("Kota").fill("Cianjur");
  await card.getByLabel("Ditandatangani").fill("Direktur Uji");
  await card.getByLabel("Jabatan", { exact: true }).fill("Direktur Utama");
  const [report] = await Promise.all([page.waitForEvent("popup"), card.getByRole("button", { name: "Cetak laporan" }).click()]);
  await expect(report.getByText("c.q. Direktur Strategi dan Kerja Sama Dalam Negeri", { exact: false })).toBeVisible();
  await expect(report.getByText("Daftar Pendanaan Proliferasi Senjata Pemusnah Massal di penyelenggara atau NIHIL", { exact: false })).toBeVisible();
  await report.screenshot({ path: "test-results/laporan-nihil-dppspm.png", fullPage: true });
  await report.close();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await card.screenshot({ path: "test-results/laporan-dppspm-390.png" });
});
