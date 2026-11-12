// Ukur kinerja kirim tiket halaman publik (DESIGN.md: ≥ 55 fps, tanpa frame > 50 ms pada CPU 4×).
// Pakai: node scripts/ukur-kinerja-publik.mjs [url]   — HANYA terhadap server lokal; membuat satu permintaan layanan uji.
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:3001/";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(url)) throw new Error("Hanya untuk server lokal: skrip ini mengirim permintaan layanan uji.");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => sessionStorage.setItem("paspor-arrived", "1"));
await page.goto(url);
await page.locator("#konfirmasi").scrollIntoViewIfNeeded();
await page.waitForTimeout(1500);
await page.getByLabel("Nama Anda").fill("Uji Kinerja Lokal");
await page.getByLabel("Nomor WhatsApp Anda").fill("0812 3456 7890");
await page.getByLabel("Saya setuju dihubungi petugas untuk membahas permintaan ini.").check();
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.evaluate(() => {
  const w = window;
  w.__frames = []; w.__loaf = [];
  let last = performance.now();
  const loop = (t) => { w.__frames.push(t - last); last = t; if (w.__frames.length < 600) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  try { new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__loaf.push(e.duration))).observe({ type: "long-animation-frame", buffered: false }); } catch {}
});
await page.locator("#stubPre button[type=submit]").click();
await page.waitForTimeout(2600);
const result = await page.evaluate(() => {
  const frames = window.__frames.slice(1);
  const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
  return { frames: frames.length, fps: Math.round(1000 / avg), worstMs: Math.round(Math.max(...frames)), over50: frames.filter((f) => f > 50).length, loafOver50: window.__loaf.filter((d) => d > 50).length };
});
console.log(JSON.stringify(result));
await browser.close();
