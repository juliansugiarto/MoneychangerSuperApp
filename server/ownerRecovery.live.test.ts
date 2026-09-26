import { createConnection } from "mysql2/promise";
import { beforeAll, describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { createInternalUser, getInternalUserById, getInternalUserByUsername } from "./db";
import { hashPassword, verifyPassword } from "./internalAuth";
import { countRemainingRecoveryCodes, recoverOwnerAccount, regenerateRecoveryCodes } from "./recoveryCodes";
import { appRouter } from "./routers";
import { runWithTenant, type TenantBinding } from "./tenantContext";
import { createScratchDatabase } from "./testing/scratchDatabase";

let binding: TenantBinding;
let url: string;
let ownerId: number;
let codes: string[] = [];
const OWNER_PASSWORD = "Pemilik-lama-2026";
const NEW_PASSWORD = "Pemilik-baru-2026";

const inTenant = <T,>(fn: () => Promise<T>) => runWithTenant(binding, fn);
const owner = () => inTenant(async () => (await getInternalUserById(ownerId))!);
const remaining = () => inTenant(() => countRemainingRecoveryCodes(ownerId));

async function rows(query: string) {
  const connection = await createConnection({ uri: url });
  try {
    const [result] = await connection.query(query);
    return result as Record<string, unknown>[];
  } finally {
    await connection.end();
  }
}

beforeAll(async () => {
  ({ binding, url } = await createScratchDatabase("mc_uji_pemulihan"));
  await inTenant(async () => {
    const created = await createInternalUser({ username: "pemilik", passwordHash: await hashPassword(OWNER_PASSWORD), name: "Pemilik Uji", role: "SHAREHOLDER", mustChangePassword: false });
    ownerId = created!.id;
    await createInternalUser({ username: "kasir", passwordHash: await hashPassword("Kasir-uji-2026"), name: "Kasir Uji", role: "STAFF", mustChangePassword: false });
  });
}, 180_000);

describe("kode pemulihan pemilik", () => {
  it("membuat ulang menolak kata sandi saat ini yang salah dan tidak membuat kode", async () => {
    await expect(inTenant(async () => regenerateRecoveryCodes(await owner(), "bukan-sandinya"))).rejects.toThrow("Kata sandi saat ini tidak cocok");
    expect(await remaining()).toBe(0);
  });

  it("delapan kode baru; tabel dan audit hanya melihat hash", async () => {
    codes = await inTenant(async () => regenerateRecoveryCodes(await owner(), OWNER_PASSWORD));
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const stored = JSON.stringify(await rows("SELECT codeHash FROM owner_recovery_codes"));
    const audit = JSON.stringify(await rows("SELECT action, afterState FROM audit_logs"));
    for (const code of codes) {
      expect(stored).not.toContain(code.replace("-", ""));
      expect(audit).not.toContain(code.replace("-", ""));
    }
    expect(audit).toContain("OWNER_RECOVERY_CODES_REGENERATED");
    expect(await remaining()).toBe(8);
  });

  it("kode yang diketik huruf kecil tanpa strip memulihkan akun dan mencabut sesi lama", async () => {
    const before = await owner();
    const recovered = await inTenant(() => recoverOwnerAccount({ username: "PEMILIK", code: codes[0].toLowerCase().replace("-", ""), newPassword: NEW_PASSWORD }));
    expect(recovered?.sessionVersion).toBe(before.sessionVersion + 1);
    expect(recovered?.mustChangePassword).toBe(false);
    expect(await verifyPassword(NEW_PASSWORD, recovered!.passwordHash)).toBe(true);
    expect(await remaining()).toBe(7);
    expect(JSON.stringify(await rows("SELECT action FROM audit_logs"))).toContain("OWNER_RECOVERY_CODE_USED");
  });

  it("kode yang sama tidak berlaku dua kali", async () => {
    expect(await inTenant(() => recoverOwnerAccount({ username: "pemilik", code: codes[0], newPassword: NEW_PASSWORD }))).toBeNull();
  });

  it("satu kode yang dipakai bersamaan hanya berhasil sekali", async () => {
    const attempts = await inTenant(() => Promise.all([1, 2].map(() => recoverOwnerAccount({ username: "pemilik", code: codes[1], newPassword: NEW_PASSWORD }))));
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(await remaining()).toBe(6);
  });

  it("akun selain Pemegang Saham tidak dapat dipulihkan", async () => {
    expect(await inTenant(() => recoverOwnerAccount({ username: "kasir", code: codes[2], newPassword: NEW_PASSWORD }))).toBeNull();
    expect(await remaining()).toBe(6);
  });

  it("membuat ulang membatalkan kode lama yang belum terpakai", async () => {
    await inTenant(async () => regenerateRecoveryCodes(await owner(), NEW_PASSWORD));
    expect(await inTenant(() => recoverOwnerAccount({ username: "pemilik", code: codes[3], newPassword: "Pemilik-lain-2026" }))).toBeNull();
    expect(await remaining()).toBe(8);
  });

  it("auth.me melaporkan sisa kode hanya untuk Pemegang Saham", async () => {
    const meFor = (user: User) => inTenant(() => appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user }).auth.me());
    expect((await meFor(await owner()))?.recoveryCodesRemaining).toBe(8);
    const kasir = await inTenant(async () => (await getInternalUserByUsername("kasir"))!);
    expect((await meFor(kasir))?.recoveryCodesRemaining).toBeNull();
  });
});
