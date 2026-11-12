import superjson from "superjson";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { v1Fixtures } from "../server/v1Fixtures";

/**
 * Pembalikan bon selesai lewat layar Daftar Transaksi, sebagai Controller. Datanya dibuat lewat prosedur
 * tRPC yang sama dengan layar kasir, di basis data `mc_t_visual` (tidak pernah moneychanger/produksi).
 */
async function call<T>(page: Page, path: string, input: unknown): Promise<T> {
  const response = await page.request.post(`/api/trpc/${path}?batch=1`, { data: { 0: superjson.serialize(input) } });
  const body = await response.json();
  expect(response.ok(), `${path}: ${JSON.stringify(body).slice(0, 400)}`).toBe(true);
  return superjson.deserialize(body[0].result.data) as T;
}

async function query<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`/api/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: superjson.serialize(undefined) }))}`);
  const body = await response.json();
  expect(response.ok(), `${path}: ${JSON.stringify(body).slice(0, 400)}`).toBe(true);
  return superjson.deserialize(body[0].result.data) as T;
}

test("Controller membalik transaksi selesai dan kas kembali", async ({ signedInPage: page }) => {
  const runId = Date.now();
  const usd = await call<{ id: number }>(page, "currencies.ensure", { code: "USD", name: "Dolar Amerika" });
  const idr = await call<{ id: number }>(page, "currencies.ensure", { code: "IDR", name: "Rupiah" });
  type Balance = { balance: { currencyId: number; availableAmount: string } };
  const balances = () => query<Balance[]>(page, "cash.balances");
  const amountIn = (rows: Balance[], id: number) => Number(rows.find((row) => row.balance.currencyId === id)?.balance.availableAmount ?? 0);
  // Kas awal hanya sekali sehari; uji ini aman diulang di hari yang sama.
  const existing = await balances();
  if (!existing.some((row) => row.balance.currencyId === usd.id)) await call(page, "cash.recordOpening", { currencyId: usd.id, openingAmount: "1", denominations: [{ value: "1", quantity: 1 }] });
  if (!existing.some((row) => row.balance.currencyId === idr.id)) await call(page, "cash.recordOpening", { currencyId: idr.id, openingAmount: "10000000", denominations: [{ value: "100000", quantity: 100 }] });
  const before = await balances();
  const customer = await call<{ id: number }>(page, "customers.create", {
    ...v1Fixtures.customer, cifNumber: `E2E-BALIK-${runId}`, identityNumber: `3174${String(runId).slice(-12)}`, fullName: "Nasabah Pembalikan",
  });
  const bon = await call<{ id: number }>(page, "transactions.create", {
    operation: "BUY", customerId: customer.id, receiptNumber: `E2E-${runId}`, paymentMethod: "CASH", transactionAt: new Date(),
    lines: [{ currencyId: usd.id, denominations: [{ value: "100", quantity: 2, rate: "16000" }] }],
    paymentDenominations: [{ value: "100000", quantity: 32 }],
  });
  await call(page, "transactions.submit", { transactionId: bon.id });

  await page.goto("/operasional/transaksi/daftar");
  const card = page.locator("div.rounded-xl.border", { hasText: `No. E2E-${runId}` }).last();
  await expect(card.getByText("Selesai", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Balik transaksi" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Balik transaksi No. E2E-${runId}?` })).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Balik transaksi" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Alasan").fill("Salah input jumlah lembar");
  await expect(dialog).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "test-results/pembalikan-dialog.png" });
  await confirm.click();

  await expect(card.getByText("Dibalik", { exact: true })).toBeVisible();
  await expect(card.getByText("Dibalik: Salah input jumlah lembar")).toBeVisible();
  await expect(card.getByRole("button", { name: "Balik transaksi" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Batalkan" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/pembalikan-sesudah.png" });

  const after = await balances();
  expect(amountIn(after, idr.id)).toBe(amountIn(before, idr.id));
  expect(amountIn(after, usd.id)).toBe(amountIn(before, usd.id));
});
