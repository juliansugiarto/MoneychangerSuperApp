import { TRPCError } from "@trpc/server";

/**
 * Pembatas percobaan masuk, pemulihan, dan penyiapan (spec 2026-09-26 §3). Disimpan di memori proses:
 * benar selama produksi berjalan sebagai SATU proses pm2 `fork`. Bila kelak berkelompok, pembatas ini
 * harus pindah ke basis data — dicatat sebagai risiko residual.
 *
 * Kuncinya membawa kode tenant karena username hanya unik di dalam satu basis data tenant, dan
 * membawa cakupan supaya kegagalan pemulihan tidak mengunci login biasa atau sebaliknya.
 */
export const THROTTLE_MAX_FAILURES = 5;
export const THROTTLE_WINDOW_MS = 15 * 60_000;
export const THROTTLE_BASE_LOCK_MS = 30_000;
export const THROTTLE_MAX_LOCK_MS = 15 * 60_000;
/** Kunci yang diam sehari dan tidak sedang terkunci dibuang supaya peta tidak tumbuh tanpa batas. */
const IDLE_EVICT_MS = 24 * 60 * 60_000;

export type ThrottleScope = "login" | "recover" | "setup";
export type ThrottleDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };
type Entry = { failures: number[]; lockedUntil: number; lockCount: number; lastSeen: number };

export function throttleKeys(scope: ThrottleScope, tenantCode: string | null, username: string, ip: string) {
  const tenant = tenantCode ?? "default";
  return { user: `${tenant}:${scope}:user:${username.trim().toLowerCase()}`, ip: `${tenant}:${scope}:ip:${ip}` };
}

export function createThrottle(now: () => number = Date.now) {
  const entries = new Map<string, Entry>();

  function evictIdle(at: number) {
    for (const [key, entry] of entries) {
      if (at - entry.lastSeen > IDLE_EVICT_MS && entry.lockedUntil <= at) entries.delete(key);
    }
  }

  return {
    check(keys: string[]): ThrottleDecision {
      const at = now();
      const remaining = Math.max(0, ...keys.map((key) => (entries.get(key)?.lockedUntil ?? 0) - at));
      return remaining > 0 ? { allowed: false, retryAfterSeconds: Math.ceil(remaining / 1000) } : { allowed: true };
    },
    recordFailure(keys: string[]) {
      const at = now();
      evictIdle(at);
      for (const key of keys) {
        const entry = entries.get(key) ?? { failures: [], lockedUntil: 0, lockCount: 0, lastSeen: at };
        entry.lastSeen = at;
        entry.failures = entry.failures.filter((failedAt) => at - failedAt < THROTTLE_WINDOW_MS);
        entry.failures.push(at);
        if (entry.failures.length >= THROTTLE_MAX_FAILURES) {
          entry.lockCount += 1;
          entry.lockedUntil = at + Math.min(THROTTLE_BASE_LOCK_MS * 2 ** (entry.lockCount - 1), THROTTLE_MAX_LOCK_MS);
          entry.failures = [];
        }
        entries.set(key, entry);
      }
    },
    recordSuccess(key: string) {
      entries.delete(key);
    },
    reset() {
      entries.clear();
    },
  };
}

export const authThrottle = createThrottle();

export function lockedMessage(seconds: number) {
  return `Terlalu banyak percobaan yang gagal. Coba lagi dalam ${seconds} detik.`;
}

export function assertThrottleAllows(keys: string[]) {
  const decision = authThrottle.check(keys);
  if (!decision.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: lockedMessage(decision.retryAfterSeconds) });
}
