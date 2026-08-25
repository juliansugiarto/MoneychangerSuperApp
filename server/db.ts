import { and, asc, eq, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'ADMIN';
      updateSet.role = 'ADMIN';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getInternalUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getInternalUserByUsername(username: string) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

export async function hasShareholder() {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  const result = await db.select({ id: users.id }).from(users).where(eq(users.role, "SHAREHOLDER")).limit(1);
  return result.length > 0;
}

export async function createInternalUser(input: {
  username: string;
  passwordHash: string;
  name: string;
  role: "SHAREHOLDER" | "CONTROLLER" | "ADMIN" | "STAFF";
  mustChangePassword: boolean;
  loginMethod?: "INTERNAL" | "DEVELOPMENT_TEST";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  const now = new Date();
  await db.insert(users).values({
    openId: `local:${input.username}`,
    username: input.username,
    passwordHash: input.passwordHash,
    name: input.name,
    loginMethod: input.loginMethod ?? "INTERNAL",
    role: input.role,
    accountStatus: "ACTIVE",
    mustChangePassword: input.mustChangePassword,
    sessionVersion: 0,
    lastSignedIn: now,
  });
  return getInternalUserByUsername(input.username);
}

export async function touchLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

export function shouldListInternalAccount(loginMethod: string | null, isProduction: boolean) {
  return !isProduction || loginMethod !== "DEVELOPMENT_TEST";
}

export async function listInternalUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  const visibleAccountFilter = !shouldListInternalAccount("DEVELOPMENT_TEST", ENV.isProduction)
    ? and(sql`${users.username} IS NOT NULL`, ne(users.loginMethod, "DEVELOPMENT_TEST"))
    : sql`${users.username} IS NOT NULL`;
  return db.select({
    id: users.id,
    username: users.username,
    name: users.name,
    email: users.email,
    role: users.role,
    accountStatus: users.accountStatus,
    mustChangePassword: users.mustChangePassword,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).where(visibleAccountFilter).orderBy(asc(users.username));
}

export async function updateInternalUserRole(id: number, role: "ADMIN" | "STAFF") {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  await db.update(users).set({ role, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id));
  return getInternalUserById(id);
}

export async function updateInternalUserStatus(id: number, accountStatus: "ACTIVE" | "SUSPENDED") {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  await db.update(users).set({ accountStatus, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id));
  return getInternalUserById(id);
}

export async function updateInternalUserPassword(id: number, passwordHash: string, mustChangePassword = true) {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia.");
  await db.update(users).set({ passwordHash, mustChangePassword, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id));
  return getInternalUserById(id);
}

// TODO: add feature queries here as your schema grows.
