import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import type { User } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";
import { ENV } from "./_core/env";
import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN } from "../shared/accountRules";
import { createInternalUser, getInternalUserById, getInternalUserByUsername, touchLastSignedIn, updateInternalUserPassword } from "./db";

const scryptAsync = promisify(scrypt);
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_ISSUER = "ibukota-valasindo-internal";
const SESSION_AUDIENCE = "ibukota-valasindo-backoffice";
const MINIMUM_SESSION_SECRET_BYTES = 20;
const DEVELOPMENT_TEST_ACCOUNTS = [
  { username: "test-shareholder", name: "Development Shareholder", role: "SHAREHOLDER" as const },
  { username: "test-controller", name: "Development Controller", role: "CONTROLLER" as const },
  { username: "test-admin", name: "Development Admin", role: "ADMIN" as const },
  { username: "test-staff", name: "Development Staff", role: "STAFF" as const },
];
// Explicitly limited to DEVELOPMENT_TEST records; production authentication rejects those accounts.
const DEVELOPMENT_TEST_DEFAULT_PASSWORD = "123456";
let generatedDevelopmentSessionSecret: string | null = null;

type SessionPayload = {
  userId: number;
  sessionVersion: number;
};

/**
 * JWT_SECRET stays server-side. A configured secret is never silently
 * replaced, because that would make its rotation and verification ambiguous.
 */
export function assertSessionSigningSecret(secret: string) {
  if (!secret) throw new Error("JWT_SECRET belum dikonfigurasi untuk sesi internal.");
  if (secret.trim() !== secret) throw new Error("JWT_SECRET tidak boleh memiliki spasi di awal atau akhir.");
  if (Buffer.byteLength(secret, "utf8") < MINIMUM_SESSION_SECRET_BYTES) {
    throw new Error(`JWT_SECRET minimal ${MINIMUM_SESSION_SECRET_BYTES} byte untuk sesi internal.`);
  }
  return secret;
}

function sessionSecret() {
  if (ENV.cookieSecret) {
    return new TextEncoder().encode(assertSessionSigningSecret(ENV.cookieSecret));
  }
  if (!ENV.isProduction) {
    generatedDevelopmentSessionSecret ??= randomBytes(48).toString("base64url");
    return new TextEncoder().encode(generatedDevelopmentSessionSecret);
  }
  throw new Error("JWT_SECRET belum dikonfigurasi aman untuk sesi internal.");
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string) {
  const normalized = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error("Username harus 3–48 karakter dan hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau strip.");
  }
  return normalized;
}

export function assertPasswordPolicy(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`);
  }
}

export async function hashPassword(password: string) {
  assertPasswordPolicy(password);
  return hashSecret(password);
}

/** Hash scrypt tanpa kebijakan panjang — dipakai kata sandi, kode penyiapan, dan kode pemulihan. Formatnya dipaku `scripts/setupCode.mjs`. */
export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scryptAsync(secret, salt, 64) as Buffer;
  return `scrypt$v1$${salt}$${hash.toString("base64url")}`;
}

function isDevelopmentTestAccount(user: Pick<User, "loginMethod">) {
  return user.loginMethod === "DEVELOPMENT_TEST";
}

export async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) return false;
  const [algorithm, version, salt, expected] = storedHash.split("$");
  if (algorithm !== "scrypt" || version !== "v1" || !salt || !expected) return false;
  const actual = await scryptAsync(password, salt, 64) as Buffer;
  const expectedBuffer = Buffer.from(expected, "base64url");
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}

function getSessionCookie(req: Request) {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  return cookies[COOKIE_NAME];
}

export async function createInternalSession(user: Pick<User, "id" | "sessionVersion">) {
  const expirationSeconds = Math.floor((Date.now() + SESSION_TTL_MS) / 1000);
  return new SignJWT({ userId: user.id, sessionVersion: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(expirationSeconds)
    .sign(sessionSecret());
}

export async function verifyInternalSessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    const userId = payload.userId;
    const sessionVersion = payload.sessionVersion;
    if (
      typeof userId !== "number" ||
      !Number.isInteger(userId) ||
      typeof sessionVersion !== "number" ||
      !Number.isInteger(sessionVersion) ||
      payload.sub !== String(userId)
    ) return null;
    return { userId, sessionVersion };
  } catch {
    return null;
  }
}

export async function authenticateInternalRequest(req: Request): Promise<User> {
  const session = await verifyInternalSessionToken(getSessionCookie(req));
  if (!session) throw new Error("Sesi tidak valid.");
  const user = await getInternalUserById(session.userId);
  if (!user || user.accountStatus !== "ACTIVE" || user.sessionVersion !== session.sessionVersion || !user.username || !user.passwordHash || (ENV.isProduction && isDevelopmentTestAccount(user))) {
    throw new Error("Sesi tidak lagi aktif.");
  }
  return user;
}

let timingDummyHash: Promise<string> | null = null;

/** Hash tiruan satu per proses, untuk menyamakan lamanya jawaban pada jalur yang tidak punya hash sungguhan. */
export function timingDummySecretHash(): Promise<string> {
  timingDummyHash ??= hashSecret(randomBytes(16).toString("base64url"));
  return timingDummyHash;
}

/**
 * Username yang tidak ada, berformat salah, atau nonaktif tetap menjalankan satu scrypt atas hash
 * tiruan, supaya lamanya jawaban tidak membocorkan akun mana yang ada.
 */
export async function verifyInternalCredentials(username: string, password: string) {
  let normalized: string | null = null;
  try {
    normalized = validateUsername(username);
  } catch {
    normalized = null;
  }
  const user = normalized ? await getInternalUserByUsername(normalized) : undefined;
  if (!user || user.accountStatus !== "ACTIVE" || !user.passwordHash || (ENV.isProduction && isDevelopmentTestAccount(user))) {
    await verifyPassword(password, await timingDummySecretHash());
    return null;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  await touchLastSignedIn(user.id);
  return user;
}

/** Provisions fixed test roles only for development verification; production authentication rejects these accounts. */
export async function ensureDevelopmentTestAccounts() {
  if (ENV.isProduction) return false;
  const passwordHash = await hashSecret(DEVELOPMENT_TEST_DEFAULT_PASSWORD);
  let synchronizedCount = 0;

  for (const account of DEVELOPMENT_TEST_ACCOUNTS) {
    const existing = await getInternalUserByUsername(account.username);
    if (existing) {
      if (isDevelopmentTestAccount(existing)) {
        // Re-hashing bumps sessionVersion, which invalidates every open session. Doing that on
        // every boot logged the developer out on each hot restart, so only write when the stored
        // password has actually drifted from the fixed development default.
        const alreadySynchronized = await verifyPassword(DEVELOPMENT_TEST_DEFAULT_PASSWORD, existing.passwordHash);
        if (!alreadySynchronized) {
          await updateInternalUserPassword(existing.id, passwordHash, false);
          synchronizedCount += 1;
        }
      }
      continue;
    }
    await createInternalUser({
      ...account,
      passwordHash,
      mustChangePassword: false,
      loginMethod: "DEVELOPMENT_TEST",
    });
    synchronizedCount += 1;
  }

  return synchronizedCount > 0;
}

export function internalSessionMaxAge() {
  return SESSION_TTL_MS;
}
