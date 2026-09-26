import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { clientIpOf, configureProxyTrust } from "./proxyTrust";

let close: (() => void) | null = null;
afterEach(() => { close?.(); close = null; });

async function ipSeenBy(trustProxy: boolean) {
  const app = express();
  if (trustProxy) configureProxyTrust(app);
  app.get("/ip", (req, res) => { res.send(clientIpOf(req)); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  close = () => server.close();
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}/ip`, { headers: { "X-Forwarded-For": "203.0.113.9" } });
  return response.text();
}

describe("IP klien di balik nginx", () => {
  it("mempercayai X-Forwarded-For dari nginx di mesin yang sama", async () => {
    expect(await ipSeenBy(true)).toBe("203.0.113.9");
  });

  it("tanpa pengaturan itu setiap permintaan terlihat dari loopback — satu penyerang akan mengunci semua orang", async () => {
    expect(await ipSeenBy(false)).not.toBe("203.0.113.9");
  });

  it("permintaan tanpa IP (pemanggil uji) memakai kunci 'unknown'", () => {
    expect(clientIpOf({})).toBe("unknown");
  });
});
