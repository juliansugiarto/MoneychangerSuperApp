import type { TenantBinding } from "./tenantContext";

/**
 * Maps an incoming request to the money changer it belongs to.
 *
 * Deliberately pluggable and, for now, deliberately dull. Until SOLVINC.ID issues real tenant
 * handoffs, this server keeps serving exactly one money changer from `DATABASE_URL`, so the
 * default strategy reproduces today's behaviour byte for byte while the plumbing that will carry
 * many tenants is put in place and tested. Switching strategies is then a configuration change,
 * not a rewrite.
 */
export type TenantResolutionStrategy = "single" | "subdomain";

export type ResolvableRequest = {
  hostname?: string;
  headers: Record<string, string | string[] | undefined>;
};

/** Registered tenants, keyed by the subdomain label that identifies them. */
export type TenantRecord = { tenantCode: string; databaseUrl: string };

function configuredStrategy(): TenantResolutionStrategy {
  return process.env.TENANT_RESOLUTION === "subdomain" ? "subdomain" : "single";
}

/**
 * The subdomain registry, read from `TENANT_REGISTRY` as `code=mysql://…` entries separated by
 * semicolons. A real `solvinc_platform` lookup replaces this in the phase that introduces the
 * control database; the shape of the answer stays the same, so callers do not change.
 */
export function parseTenantRegistry(raw: string | undefined): Map<string, TenantRecord> {
  const registry = new Map<string, TenantRecord>();
  if (!raw) return registry;
  for (const entry of raw.split(";")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const tenantCode = trimmed.slice(0, separator).trim();
    const databaseUrl = trimmed.slice(separator + 1).trim();
    if (tenantCode && databaseUrl) registry.set(tenantCode, { tenantCode, databaseUrl });
  }
  return registry;
}

/** The leading label of a hostname: `abcvalas.solvinc.id` -> `abcvalas`. */
export function subdomainOf(hostname: string | undefined): string | null {
  if (!hostname) return null;
  const host = hostname.split(":")[0].toLowerCase();
  const labels = host.split(".").filter(Boolean);
  // A bare host or an IP address carries no tenant label.
  if (labels.length < 3 || /^\d+$/.test(labels[labels.length - 1])) return null;
  return labels[0];
}

export function resolveTenant(
  request: ResolvableRequest,
  options?: { strategy?: TenantResolutionStrategy; registry?: Map<string, TenantRecord>; defaultDatabaseUrl?: string },
): TenantBinding {
  const strategy = options?.strategy ?? configuredStrategy();

  if (strategy === "single") {
    const databaseUrl = options?.defaultDatabaseUrl ?? process.env.DATABASE_URL;
    if (!databaseUrl) return { kind: "unresolved", reason: "DATABASE_URL belum diatur" };
    return { kind: "resolved", tenantCode: process.env.TENANT_CODE || "default", databaseUrl };
  }

  const label = subdomainOf(request.hostname);
  if (!label) return { kind: "unresolved", reason: "alamat tidak memuat penanda tenant" };

  const registry = options?.registry ?? parseTenantRegistry(process.env.TENANT_REGISTRY);
  const record = registry.get(label);
  // An unknown label must fail rather than fall back: falling back would hand whoever typed it the
  // default tenant's data.
  if (!record) return { kind: "unresolved", reason: `tenant "${label}" tidak terdaftar` };

  return { kind: "resolved", tenantCode: record.tenantCode, databaseUrl: record.databaseUrl };
}
