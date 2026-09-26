import { and, count, eq, isNull, sql } from "drizzle-orm";
import { auditLogs, ownerRecoveryCodes, users, type User } from "../drizzle/schema";
import { RECOVERY_CODE_COUNT, RECOVERY_CODE_GROUPS, generateRecoveryCodes, normalizeSecretCode } from "../shared/secretCodes";
import { ENV } from "./_core/env";
import { getInternalUserById, getInternalUserByUsername } from "./db";
import { assertPasswordPolicy, hashPassword, hashSecret, timingDummySecretHash, validateUsername, verifyPassword } from "./internalAuth";
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
/**
 * Hash yang diperiksa satu percobaan pemulihan: kode sungguhan yang belum terpakai, ditambah hash tiruan
 * sampai genap delapan. Tanpa ini username yang bukan pemilik dijawab seketika sedangkan pemilik
 * memakan sampai delapan scrypt — lamanya jawaban membocorkan siapa pemiliknya.
 */
export function paddedCodeCandidates(rows: readonly { id: number; codeHash: string }[], dummyHash: string): { id: number | null; codeHash: string }[] {
  const candidates: { id: number | null; codeHash: string }[] = rows.map((row) => ({ id: row.id, codeHash: row.codeHash }));
  while (candidates.length < RECOVERY_CODE_COUNT) candidates.push({ id: null, codeHash: dummyHash });
  return candidates;
}

/** Memeriksa SEMUA kandidat tanpa berhenti di yang cocok, supaya jumlah scrypt selalu sama. */
async function findMatchingCode(compact: string, candidates: { id: number | null; codeHash: string }[]): Promise<number | null> {
  let matchedId: number | null = null;
  for (const candidate of candidates) {
    const matches = await verifyPassword(compact, candidate.codeHash);
    if (matches && candidate.id !== null && matchedId === null) matchedId = candidate.id;
  }
  return matchedId;
}

export async function recoverOwnerAccount(input: { username: string; code: string; newPassword: string }): Promise<User | null> {
  assertPasswordPolicy(input.newPassword);
  let username: string;
  try {
    username = validateUsername(input.username);
  } catch {
    return null;
  }
  // Kode berformat salah tetap diperiksa terhadap bentuk tiruan, bukan ditolak seketika.
  const compact = normalizeSecretCode(input.code, RECOVERY_CODE_GROUPS) ?? "";
  const user = await getInternalUserByUsername(username);
  const eligible = Boolean(compact && user && user.role === "SHAREHOLDER" && user.accountStatus === "ACTIVE" && !(ENV.isProduction && user.loginMethod === "DEVELOPMENT_TEST"));

  const db = await databaseOrThrow();
  const unused = eligible
    ? await db.select().from(ownerRecoveryCodes).where(and(eq(ownerRecoveryCodes.userId, user!.id), isNull(ownerRecoveryCodes.usedAt)))
    : [];
  const matchedId = await findMatchingCode(compact, paddedCodeCandidates(unused, await timingDummySecretHash()));
  if (!eligible || !user || matchedId === null) return null;
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
