import { and, count, eq, isNull, sql } from "drizzle-orm";
import { auditLogs, ownerRecoveryCodes, users, type User } from "../drizzle/schema";
import { RECOVERY_CODE_GROUPS, generateRecoveryCodes, normalizeSecretCode } from "../shared/secretCodes";
import { ENV } from "./_core/env";
import { getInternalUserById, getInternalUserByUsername } from "./db";
import { assertPasswordPolicy, hashPassword, hashSecret, validateUsername, verifyPassword } from "./internalAuth";
import { databaseOrThrow } from "./operations";

type Database = Awaited<ReturnType<typeof databaseOrThrow>>;
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Menghapus kode pemilik yang belum terpakai lalu menyimpan hash delapan kode baru. Kode mentahnya
 * dikembalikan satu kali ini saja — tidak disimpan, tidak dicatat. Baris yang sudah terpakai tetap
 * sebagai riwayat.
 */
export async function replaceRecoveryCodes(tx: DbTransaction, userId: number): Promise<string[]> {
  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((code) => hashSecret(normalizeSecretCode(code, RECOVERY_CODE_GROUPS)!)));
  await tx.delete(ownerRecoveryCodes).where(and(eq(ownerRecoveryCodes.userId, userId), isNull(ownerRecoveryCodes.usedAt)));
  await tx.insert(ownerRecoveryCodes).values(hashes.map((codeHash) => ({ userId, codeHash })));
  return codes;
}

export async function countRemainingRecoveryCodes(userId: number): Promise<number> {
  const db = await databaseOrThrow();
  const [row] = await db.select({ total: count() }).from(ownerRecoveryCodes).where(and(eq(ownerRecoveryCodes.userId, userId), isNull(ownerRecoveryCodes.usedAt)));
  return Number(row?.total ?? 0);
}

export async function regenerateRecoveryCodes(user: User, currentPassword: string): Promise<string[]> {
  if (user.role !== "SHAREHOLDER") throw new Error("Hanya Pemegang Saham yang memiliki kode pemulihan.");
  if (!await verifyPassword(currentPassword, user.passwordHash)) throw new Error("Kata sandi saat ini tidak cocok. Kode lama Anda tetap berlaku.");
  const db = await databaseOrThrow();
  return db.transaction(async (tx) => {
    const codes = await replaceRecoveryCodes(tx, user.id);
    await tx.insert(auditLogs).values({ actorUserId: user.id, action: "OWNER_RECOVERY_CODES_REGENERATED", entityType: "user", entityId: String(user.id), afterState: { codeCount: codes.length, unusedCodesRevoked: true } });
    return codes;
  });
}

/**
 * Pemulihan akun pemilik dengan satu kode sekali pakai. `null` untuk setiap kegagalan — pemanggil
 * menampilkan satu pesan yang sama supaya username yang ada tidak dapat ditebak. Kode dikunci
 * `FOR UPDATE` di dalam transaksi, sehingga dua tab yang memakai kode yang sama bersamaan hanya
 * berhasil satu.
 */
export async function recoverOwnerAccount(input: { username: string; code: string; newPassword: string }): Promise<User | null> {
  assertPasswordPolicy(input.newPassword);
  let username: string;
  try {
    username = validateUsername(input.username);
  } catch {
    return null;
  }
  const compact = normalizeSecretCode(input.code, RECOVERY_CODE_GROUPS);
  if (!compact) return null;
  const user = await getInternalUserByUsername(username);
  if (!user || user.role !== "SHAREHOLDER" || user.accountStatus !== "ACTIVE" || (ENV.isProduction && user.loginMethod === "DEVELOPMENT_TEST")) return null;

  const db = await databaseOrThrow();
  const unused = await db.select().from(ownerRecoveryCodes).where(and(eq(ownerRecoveryCodes.userId, user.id), isNull(ownerRecoveryCodes.usedAt)));
  let matchedId: number | null = null;
  for (const row of unused) {
    if (await verifyPassword(compact, row.codeHash)) {
      matchedId = row.id;
      break;
    }
  }
  if (matchedId === null) return null;
  const codeId = matchedId;

  const passwordHash = await hashPassword(input.newPassword);
  const consumed = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(ownerRecoveryCodes).where(eq(ownerRecoveryCodes.id, codeId)).for("update");
    if (!locked || locked.usedAt) return false;
    await tx.update(ownerRecoveryCodes).set({ usedAt: new Date() }).where(eq(ownerRecoveryCodes.id, codeId));
    await tx.update(users).set({ passwordHash, mustChangePassword: false, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, user.id));
    await tx.insert(auditLogs).values({ actorUserId: user.id, action: "OWNER_RECOVERY_CODE_USED", entityType: "user", entityId: String(user.id), afterState: { recoveryCodeId: codeId, sessionsRevoked: true } });
    return true;
  });
  return consumed ? (await getInternalUserById(user.id)) ?? null : null;
}
