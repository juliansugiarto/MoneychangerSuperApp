import { TRPCError } from "@trpc/server";

/**
 * Pembatas percobaan masuk, pemulihan, dan penyiapan (spec 2026-09-26 §3). Disimpan di memori proses:
 * benar selama produksi berjalan sebagai SATU proses (satu kontainer `web`, tanpa replika). Bila kelak berkelompok, pembatas ini
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
/** `inFlight`: percobaan yang sudah diizinkan tetapi hasilnya belum diketahui (verifikasi scrypt masih berjalan). */
type Entry = { failures: number[]; lockedUntil: number; lockCount: number; lastSeen: number; inFlight: number };

export function throttleKeys(scope: ThrottleScope, tenantCode: string | null, username: string, ip: string) {
  const tenant = tenantCode ?? "default";
  return { user: `${tenant}:${scope}:user:${username.trim().toLowerCase()}`, ip: `${tenant}:${scope}:ip:${ip}` };
}

export function createThrottle(now: () => number = Date.now) {
  const entries = new Map<string, Entry>();

  function evictIdle(at: number) {
    for (const [key, entry] of entries) {
      if (at - entry.lastSeen > IDLE_EVICT_MS && entry.lockedUntil <= at && entry.inFlight === 0) entries.delete(key);
    }
  }

  function entryFor(key: string, at: number) {
    const entry = entries.get(key) ?? { failures: [], lockedUntil: 0, lockCount: 0, lastSeen: at, inFlight: 0 };
    entry.lastSeen = at;
    entries.set(key, entry);
    return entry;
  }

  const throttle = {
    check(keys: string[]): ThrottleDecision {
      const at = now();
      const remaining = Math.max(0, ...keys.map((key) => (entries.get(key)?.lockedUntil ?? 0) - at));
      return remaining > 0 ? { allowed: false, retryAfterSeconds: Math.ceil(remaining / 1000) } : { allowed: true };
    },
    recordFailure(keys: string[]) {
      const at = now();
      evictIdle(at);
      for (const key of keys) {
        const entry = entryFor(key, at);
        entry.failures = entry.failures.filter((failedAt) => at - failedAt < THROTTLE_WINDOW_MS);
        entry.failures.push(at);
        if (entry.failures.length >= THROTTLE_MAX_FAILURES) {
          entry.lockCount += 1;
          entry.lockedUntil = at + Math.min(THROTTLE_BASE_LOCK_MS * 2 ** (entry.lockCount - 1), THROTTLE_MAX_LOCK_MS);
          entry.failures = [];
        }
      }
    },
    /**
     * Izin untuk SATU percobaan, diberikan sebelum verifikasi yang lambat dimulai. Percobaan yang masih berjalan
     * ikut dihitung, sehingga tebakan yang dikirim bersamaan (batch tRPC, banyak tab) tidak bisa melewati
     * batas hanya karena semuanya diperiksa sebelum kegagalan pertama tercatat. Wajib ditutup `settle`.
     */
    admit(keys: string[]): ThrottleDecision {
      const decision = throttle.check(keys);
      if (!decision.allowed) return decision;
      const at = now();
      const saturated = keys.some((key) => {
        const entry = entries.get(key);
        if (!entry) return false;
        const recentFailures = entry.failures.filter((failedAt) => at - failedAt < THROTTLE_WINDOW_MS).length;
        return recentFailures + entry.inFlight >= THROTTLE_MAX_FAILURES;
      });
      if (saturated) return { allowed: false, retryAfterSeconds: Math.ceil(THROTTLE_BASE_LOCK_MS / 1000) };
      for (const key of keys) entryFor(key, at).inFlight += 1;
      return { allowed: true };
    },
    settle(keys: string[], failed: boolean) {
      for (const key of keys) {
        const entry = entries.get(key);
        if (entry) entry.inFlight = Math.max(0, entry.inFlight - 1);
      }
      if (failed) throttle.recordFailure(keys);
    },
    recordSuccess(key: string) {
      entries.delete(key);
    },
    reset() {
      entries.clear();
    },
  };
  return throttle;
}

export const authThrottle = createThrottle();

export function lockedMessage(seconds: number) {
  return `Terlalu banyak percobaan yang gagal. Coba lagi dalam ${seconds} detik.`;
}

/**
 * Menjalankan satu percobaan di bawah pembatas: izin diambil sebelum `attempt` dimulai, lalu ditutup apa pun
 * hasilnya. `attempt` mengembalikan `failed: true` untuk percobaan yang dihitung sebagai kegagalan.
 */
export async function withThrottle<T>(keys: string[], attempt: () => Promise<{ failed: boolean; value: T }>): Promise<T> {
  const decision = authThrottle.admit(keys);
  if (!decision.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: lockedMessage(decision.retryAfterSeconds) });
  let failed = false;
  try {
    const outcome = await attempt();
    failed = outcome.failed;
    return outcome.value;
  } finally {
    authThrottle.settle(keys, failed);
  }
}
