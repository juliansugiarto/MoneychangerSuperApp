import { describe, expect, it } from "vitest";
import { currentTenantBinding, currentTenantCode, runWithTenant } from "./tenantContext";
import { parseTenantRegistry, resolveTenant, subdomainOf, type TenantRecord } from "./tenantRegistry";

const registry = new Map<string, TenantRecord>([
  ["ibukota", { tenantCode: "ibukota", databaseUrl: "mysql://u@h/mc_t_ibukota" }],
  ["abcvalas", { tenantCode: "abcvalas", databaseUrl: "mysql://u@h/mc_t_abcvalas" }],
]);

const req = (hostname?: string) => ({ hostname, headers: {} });

describe("pemetaan permintaan ke tenant", () => {
  it("mengambil penanda tenant dari label pertama nama host", () => {
    expect(subdomainOf("abcvalas.solvinc.id")).toBe("abcvalas");
    expect(subdomainOf("ABCVALAS.Solvinc.ID")).toBe("abcvalas");
    expect(subdomainOf("abcvalas.solvinc.id:3000")).toBe("abcvalas");
    // Tanpa label tenant: host telanjang, host lokal, dan alamat IP.
    expect(subdomainOf("solvinc.id")).toBeNull();
    expect(subdomainOf("localhost")).toBeNull();
    expect(subdomainOf("127.0.0.1")).toBeNull();
    expect(subdomainOf(undefined)).toBeNull();
  });

  it("membaca daftar tenant dari konfigurasi", () => {
    const parsed = parseTenantRegistry("ibukota=mysql://a@h/one; abcvalas=mysql://b@h/two");
    expect(parsed.get("ibukota")?.databaseUrl).toBe("mysql://a@h/one");
    expect(parsed.get("abcvalas")?.databaseUrl).toBe("mysql://b@h/two");
    expect(parseTenantRegistry(undefined).size).toBe(0);
    expect(parseTenantRegistry("tanpa-tanda-sama-dengan").size).toBe(0);
  });

  it("mode tunggal tetap melayani satu money changer seperti sebelumnya", () => {
    const binding = resolveTenant(req("localhost"), { strategy: "single", defaultDatabaseUrl: "mysql://u@h/moneychanger" });
    expect(binding).toEqual({ kind: "resolved", tenantCode: "default", databaseUrl: "mysql://u@h/moneychanger" });
  });

  it("mode tunggal menolak berjalan tanpa DATABASE_URL", () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(resolveTenant(req("localhost"), { strategy: "single" }).kind).toBe("unresolved");
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = saved;
    }
  });

  it("mengarahkan tiap subdomain ke database miliknya sendiri", () => {
    expect(resolveTenant(req("ibukota.solvinc.id"), { strategy: "subdomain", registry }))
      .toEqual({ kind: "resolved", tenantCode: "ibukota", databaseUrl: "mysql://u@h/mc_t_ibukota" });
    expect(resolveTenant(req("abcvalas.solvinc.id"), { strategy: "subdomain", registry }))
      .toEqual({ kind: "resolved", tenantCode: "abcvalas", databaseUrl: "mysql://u@h/mc_t_abcvalas" });
  });

  it("menolak tenant yang tidak terdaftar alih-alih memberi database bawaan", () => {
    // Justru di sinilah kebocoran akan terjadi bila diberi nilai bawaan: siapa pun yang mengetik
    // subdomain sembarangan akan mendapat data tenant lain.
    const binding = resolveTenant(req("tidakterdaftar.solvinc.id"), {
      strategy: "subdomain",
      registry,
      defaultDatabaseUrl: "mysql://u@h/moneychanger",
    });
    expect(binding.kind).toBe("unresolved");
    expect(JSON.stringify(binding)).not.toContain("moneychanger");
  });

  it("menolak permintaan tanpa penanda tenant pada mode subdomain", () => {
    expect(resolveTenant(req("solvinc.id"), { strategy: "subdomain", registry }).kind).toBe("unresolved");
    expect(resolveTenant(req(undefined), { strategy: "subdomain", registry }).kind).toBe("unresolved");
  });
});

describe("konteks tenant selama permintaan berjalan", () => {
  it("tidak ada ikatan di luar permintaan, sehingga perkakas dan migrasi tetap bisa jalan", () => {
    expect(currentTenantBinding()).toBeUndefined();
    expect(currentTenantCode()).toBeNull();
  });

  it("ikatan tetap melekat melintasi await", async () => {
    await runWithTenant({ kind: "resolved", tenantCode: "ibukota", databaseUrl: "mysql://u@h/a" }, async () => {
      expect(currentTenantCode()).toBe("ibukota");
      await new Promise((resolve) => setTimeout(resolve, 1));
      // Inilah yang membuat 223 query lama tidak perlu diubah: ikatan bertahan sampai ke
      // pemanggilan terdalam, bukan hanya pada baris pertama penanganan permintaan.
      expect(currentTenantCode()).toBe("ibukota");
    });
    expect(currentTenantCode()).toBeNull();
  });

  it("dua permintaan yang berjalan bersamaan tidak saling menimpa ikatannya", async () => {
    const seen: string[] = [];
    const request = (code: string, delay: number) =>
      runWithTenant({ kind: "resolved", tenantCode: code, databaseUrl: `mysql://u@h/${code}` }, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        seen.push(`${code}:${currentTenantCode()}`);
      });

    await Promise.all([request("ibukota", 5), request("abcvalas", 1), request("ketiga", 3)]);

    // Setiap permintaan melihat tenantnya sendiri meski selesai dengan urutan berbeda.
    expect(seen.sort()).toEqual(["abcvalas:abcvalas", "ibukota:ibukota", "ketiga:ketiga"]);
  });

  it("ikatan gagal tetap terbaca sebagai gagal, bukan sebagai tanpa ikatan", async () => {
    await runWithTenant({ kind: "unresolved", reason: "tenant tidak terdaftar" }, async () => {
      expect(currentTenantBinding()?.kind).toBe("unresolved");
      // Perbedaan ini yang menentukan: tanpa ikatan berarti perkakas dan boleh memakai bawaan,
      // sedangkan gagal berarti permintaan harus ditolak.
      expect(currentTenantCode()).toBeNull();
    });
  });
});
