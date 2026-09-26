import { createConnection } from "mysql2/promise";
import { beforeAll, describe, expect, it } from "vitest";
import { writeSetupCode } from "../scripts/setupCode.mjs";
import { SetupRefusal, completeInstallationSetup, isSetupRequired, readInstallation, type SetupInput } from "./installationSetup";
import { runWithTenant, type TenantBinding } from "./tenantContext";
import { createScratchDatabase } from "./testing/scratchDatabase";

let binding: TenantBinding;
let url: string;
let setupCode = "";
let winnerCodes: string[] = [];

const inTenant = <T,>(fn: () => Promise<T>) => runWithTenant(binding, fn);
const input = (code: string, overrides: Partial<SetupInput> = {}): SetupInput => ({
  setupCode: code,
  owner: { name: "Pemilik ABC", username: "pemilik.abc", password: "Pemilik-abc-2026" },
  company: { legalEntityName: "PT ABC Valas", tradingName: "ABC Valas", licenseNumber: "KUPVA-001" },
  ...overrides,
});

async function sql(query: string) {
  const connection = await createConnection({ uri: url });
  try {
    const [result] = await connection.query(query);
    return result as Record<string, unknown>[];
  } finally {
    await connection.end();
  }
}
const countOf = async (table: string) => Number((await sql(`SELECT COUNT(*) AS n FROM ${table}`))[0].n);
async function freshSetupCode() {
  const connection = await createConnection({ uri: url });
  try { return await writeSetupCode(connection); } finally { await connection.end(); }
}

beforeAll(async () => {
  ({ binding, url } = await createScratchDatabase("mc_uji_penyiapan"));
}, 180_000);

describe("penyiapan awal", () => {
  it("instalasi baru tanpa Pemegang Saham belum disiapkan — isian 0061 tidak menandainya", async () => {
    expect(await inTenant(() => readInstallation())).toBeNull();
    expect(await inTenant(() => isSetupRequired())).toBe(true);
  });

  it("tanpa kode penyiapan, wizard ditolak dengan langkah berikutnya", async () => {
    await expect(inTenant(() => completeInstallationSetup(input("AAAA-BBBB-CCCC")))).rejects.toThrow("Kode penyiapan belum dibuat");
  });

  it("kode yang kedaluwarsa ditolak", async () => {
    setupCode = await freshSetupCode();
    await sql("UPDATE app_installation SET setupCodeExpiresAt = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE id = 1");
    await expect(inTenant(() => completeInstallationSetup(input(setupCode)))).rejects.toThrow("kedaluwarsa");
  });

  it("kode yang salah ditolak, dihitung pembatas, dan tidak menulis apa pun", async () => {
    setupCode = await freshSetupCode();
    const error = await inTenant(() => completeInstallationSetup(input("ZZZZ-ZZZZ-ZZZZ"))).catch((caught) => caught);
    expect(error).toBeInstanceOf(SetupRefusal);
    expect(error.message).toContain("salah");
    expect(error.countsAsFailure).toBe(true);
    expect(await countOf("users")).toBe(0);
  });

  it("kegagalan di tengah transaksi membatalkan seluruhnya", async () => {
    // Nama badan hukum 250 karakter ditolak MySQL (varchar 200, STRICT) SESUDAH akun disisipkan.
    await expect(inTenant(() => completeInstallationSetup(input(setupCode, { company: { legalEntityName: "x".repeat(250), tradingName: "ABC Valas" } })))).rejects.toThrow();
    expect(await countOf("users")).toBe(0);
    expect(await countOf("company_profile")).toBe(0);
    expect(await countOf("owner_recovery_codes")).toBe(0);
    expect((await sql("SELECT setupCompletedAt FROM app_installation WHERE id = 1"))[0].setupCompletedAt).toBeNull();
  });

  it("dua penyelesaian bersamaan hanya menghasilkan satu pemilik; kode boleh diketik huruf kecil berspasi", async () => {
    const typed = setupCode.toLowerCase().replace(/-/g, " ");
    const results = await inTenant(() => Promise.allSettled([
      completeInstallationSetup(input(typed)),
      completeInstallationSetup(input(typed, { owner: { name: "Pemilik Kedua", username: "pemilik.dua", password: "Pemilik-dua-2026" } })),
    ]));
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    winnerCodes = (fulfilled[0] as PromiseFulfilledResult<{ recoveryCodes: string[] }>).value.recoveryCodes;
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.message).toContain("sudah disiapkan");
    expect(Number((await sql("SELECT COUNT(*) AS n FROM users WHERE role = 'SHAREHOLDER'"))[0].n)).toBe(1);
  });

  it("penyiapan yang berhasil menulis akun, profil, kode, dan tanda selesai sekaligus", async () => {
    const [owner] = await sql("SELECT role, mustChangePassword, openId FROM users");
    expect(owner).toMatchObject({ role: "SHAREHOLDER", mustChangePassword: 0 });
    expect(String(owner.openId)).toMatch(/^local:pemilik\.(abc|dua)$/);
    expect((await sql("SELECT legalEntityName, tradingName, licenseNumber FROM company_profile"))[0]).toMatchObject({ legalEntityName: "PT ABC Valas", tradingName: "ABC Valas", licenseNumber: "KUPVA-001" });
    expect(await countOf("owner_recovery_codes")).toBe(8);
    const [installation] = await sql("SELECT setupCompletedAt, setupCodeHash FROM app_installation WHERE id = 1");
    expect(installation.setupCompletedAt).not.toBeNull();
    expect(installation.setupCodeHash).toBeNull();
    const audit = JSON.stringify(await sql("SELECT action, afterState FROM audit_logs"));
    expect(audit).toContain("INSTALLATION_SETUP_COMPLETED");
    for (const code of winnerCodes) expect(audit).not.toContain(code.replace("-", ""));
    expect(await inTenant(() => isSetupRequired())).toBe(false);
  });

  it("penyiapan kedua ditolak tanpa dihitung sebagai tebakan kode", async () => {
    const error = await inTenant(() => completeInstallationSetup(input(setupCode))).catch((caught) => caught);
    expect(error.message).toContain("sudah disiapkan");
    expect(error.countsAsFailure).toBe(false);
  });

  it("perintah setup-code menolak instalasi yang sudah disiapkan", async () => {
    await expect(freshSetupCode()).rejects.toThrow("Penyiapan sudah selesai");
  });
});
