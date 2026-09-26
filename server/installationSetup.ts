import { eq } from "drizzle-orm";
import { appInstallation, auditLogs, companyProfile, users, type User } from "../drizzle/schema";
import { SETUP_CODE_GROUPS, normalizeSecretCode } from "../shared/secretCodes";
import { getInternalUserById } from "./db";
import { assertPasswordPolicy, hashPassword, validateUsername, verifyPassword } from "./internalAuth";
import { databaseOrThrow } from "./operations";
import { replaceRecoveryCodes } from "./recoveryCodes";

type InstallationState = { setupCompletedAt: Date | null; setupCodeHash: string | null; setupCodeExpiresAt: Date | null };

export type SetupInput = {
  setupCode: string;
  owner: { name: string; username: string; password: string };
  company: { legalEntityName: string; tradingName: string; licenseNumber?: string };
};

/** Penolakan yang pesannya boleh ditampilkan apa adanya. Hanya kode yang salah dihitung pembatas percobaan. */
export class SetupRefusal extends Error {
  constructor(message: string, readonly countsAsFailure = false) {
    super(message);
    this.name = "SetupRefusal";
  }
}

const WRONG_SETUP_CODE = "Kode penyiapan salah. Periksa lagi kode yang tampil di terminal server; huruf kecil dan spasi tidak masalah.";

export async function readInstallation(): Promise<InstallationState | null> {
  const db = await databaseOrThrow();
  const [row] = await db.select().from(appInstallation).where(eq(appInstallation.id, 1)).limit(1);
  return row ?? null;
}

export async function isSetupRequired(): Promise<boolean> {
  return !(await readInstallation())?.setupCompletedAt;
}

/** Murni: keadaan instalasi → pesan penolakan, atau `null` bila boleh lanjut memeriksa kodenya. */
export function setupGate(state: InstallationState | null, now: Date): string | null {
  if (state?.setupCompletedAt) return "Perusahaan ini sudah disiapkan. Masuk dengan akun pemilik.";
  if (!state?.setupCodeHash || !state.setupCodeExpiresAt) {
    return "Kode penyiapan belum dibuat. Jalankan `node scripts/tenant.mjs setup-code` di server, lalu masukkan kodenya di sini.";
  }
  if (state.setupCodeExpiresAt.getTime() <= now.getTime()) return "Kode penyiapan sudah kedaluwarsa (berlaku 24 jam). Buat kode baru di server.";
  return null;
}

/**
 * Menulis akun Pemegang Saham, profil perusahaan, kode pemulihan, dan tanda selesai dalam SATU
 * transaksi. Baris `app_installation` dikunci `FOR UPDATE` lebih dulu, sehingga dua penyelesaian
 * bersamaan berurutan dan yang kedua melihat "sudah disiapkan". Panjang kolom sengaja tidak
 * diperiksa di sini (zod di router yang memeriksanya) — uji hidup memakai itu untuk membuktikan
 * rollback.
 */
export async function completeInstallationSetup(input: SetupInput, now = new Date()): Promise<{ user: User; recoveryCodes: string[] }> {
  const username = validateUsername(input.owner.username);
  assertPasswordPolicy(input.owner.password);
  const name = input.owner.name.trim();
  const legalEntityName = input.company.legalEntityName.trim();
  const tradingName = input.company.tradingName.trim();
  if (name.length < 3) throw new SetupRefusal("Nama pemilik minimal 3 karakter.");
  if (!legalEntityName || !tradingName) throw new SetupRefusal("Nama badan hukum dan nama dagang wajib diisi.");
  const compact = normalizeSecretCode(input.setupCode, SETUP_CODE_GROUPS);
  const passwordHash = await hashPassword(input.owner.password);

  const db = await databaseOrThrow();
  const outcome = await db.transaction(async (tx) => {
    const [state] = await tx.select().from(appInstallation).where(eq(appInstallation.id, 1)).for("update");
    const refusal = setupGate(state ?? null, now);
    if (refusal) throw new SetupRefusal(refusal);
    if (!compact || !await verifyPassword(compact, state!.setupCodeHash)) throw new SetupRefusal(WRONG_SETUP_CODE, true);

    const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (taken) throw new SetupRefusal(`Username "${username}" sudah dipakai. Pilih username lain.`);

    const [{ id: userId }] = await tx.insert(users).values({
      openId: `local:${username}`, username, passwordHash, name, loginMethod: "INTERNAL", role: "SHAREHOLDER",
      accountStatus: "ACTIVE", mustChangePassword: false, sessionVersion: 0, lastSignedIn: now,
    }).$returningId();

    const company = { legalEntityName, tradingName, licenseNumber: input.company.licenseNumber?.trim() || null, updatedByUserId: userId };
    const [profile] = await tx.select({ id: companyProfile.id }).from(companyProfile).orderBy(companyProfile.id).limit(1);
    if (profile) await tx.update(companyProfile).set(company).where(eq(companyProfile.id, profile.id));
    else await tx.insert(companyProfile).values(company);

    const recoveryCodes = await replaceRecoveryCodes(tx, userId);
    await tx.update(appInstallation).set({ setupCompletedAt: now, setupCodeHash: null, setupCodeExpiresAt: null }).where(eq(appInstallation.id, 1));
    await tx.insert(auditLogs).values({
      actorUserId: userId, action: "INSTALLATION_SETUP_COMPLETED", entityType: "app_installation", entityId: "1",
      afterState: { ownerUsername: username, legalEntityName, tradingName, recoveryCodeCount: recoveryCodes.length },
    });
    return { userId, recoveryCodes };
  });

  const user = await getInternalUserById(outcome.userId);
  if (!user) throw new Error("Akun pemilik tidak terbaca sesudah penyiapan.");
  return { user, recoveryCodes: outcome.recoveryCodes };
}
