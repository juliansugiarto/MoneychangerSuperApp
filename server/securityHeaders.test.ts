import { describe, expect, it, vi } from "vitest";
import { securityHeaders } from "./securityHeaders";

function headersFrom(isProduction: boolean) {
  const headers: Record<string, string> = {};
  const next = vi.fn();
  securityHeaders({ isProduction })({} as never, { setHeader: (name: string, value: string) => { headers[name] = value; } } as never, next);
  expect(next).toHaveBeenCalledOnce();
  return headers;
}

describe("header keamanan", () => {
  it("melarang halaman dibingkai situs lain dan menebak jenis berkas", () => {
    const headers = headersFrom(true);
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
  });

  it("tidak mengirim HSTS di mesin pengembang", () => {
    expect(headersFrom(false)["Strict-Transport-Security"]).toBeUndefined();
  });

  it("tidak membatasi skrip selama jendela cetak masih memakai skrip sebaris", () => {
    expect(headersFrom(true)["Content-Security-Policy"]).not.toContain("script-src");
  });
});
