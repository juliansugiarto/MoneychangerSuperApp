import { isRoleAllowed, type BackOfficeRole } from "@shared/backOfficeNavigation";

export type AccessState = "LOADING" | "SIGNED_OUT" | "MUST_CHANGE_PASSWORD" | "FORBIDDEN" | "ALLOWED";

/** Urutan pemeriksaannya sama dengan shell lama; server tetap penegak otorisasi yang sesungguhnya. */
export function accessStateFor(
  input: { loading: boolean; user: { role: string; mustChangePassword?: boolean | null } | null | undefined },
  minimumRole: BackOfficeRole,
): AccessState {
  if (input.loading) return "LOADING";
  if (!input.user) return "SIGNED_OUT";
  if (input.user.mustChangePassword) return "MUST_CHANGE_PASSWORD";
  if (!isRoleAllowed(input.user.role as BackOfficeRole, minimumRole)) return "FORBIDDEN";
  return "ALLOWED";
}
