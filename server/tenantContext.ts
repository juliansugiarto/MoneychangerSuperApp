import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Which tenant's database the code currently running belongs to.
 *
 * The 223 query call sites in this server carry no tenant filter of their own, and adding one to
 * each would make isolation a matter of remembering. Instead the tenant is bound once per request
 * and `getDb()` resolves the connection from it, so a query physically cannot reach another
 * tenant's data — the wrong database is never open in the first place.
 */
export type TenantBinding =
  /** A request that knows which money changer it belongs to. */
  | { kind: "resolved"; tenantCode: string; databaseUrl: string }
  /**
   * A request that reached the application without a tenant. Deliberately represented rather than
   * left absent: an absent binding is indistinguishable from "running a migration script", and
   * treating an unresolvable request as tooling is exactly how one tenant ends up reading another
   * tenant's database. `getDb()` refuses this binding.
   */
  | { kind: "unresolved"; reason: string };

const storage = new AsyncLocalStorage<TenantBinding>();

/** Runs `fn` with `binding` in scope, including everything it awaits. */
export function runWithTenant<T>(binding: TenantBinding, fn: () => T): T {
  return storage.run(binding, fn);
}

/**
 * The binding for the code currently running, or `undefined` outside any request — migrations,
 * tests, and CLI tooling legitimately run unbound and fall back to `DATABASE_URL`.
 */
export function currentTenantBinding(): TenantBinding | undefined {
  return storage.getStore();
}

/** The active tenant's code, for logging and audit. `null` when running unbound. */
export function currentTenantCode(): string | null {
  const binding = storage.getStore();
  return binding?.kind === "resolved" ? binding.tenantCode : null;
}

export class TenantResolutionError extends Error {
  constructor(reason: string) {
    super(`Permintaan tidak dapat dipetakan ke tenant mana pun: ${reason}`);
    this.name = "TenantResolutionError";
  }
}
