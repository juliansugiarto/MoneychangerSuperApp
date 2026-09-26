export type InternalAccount = {
  id: number;
  username: string | null;
  name: string | null;
  role: string;
  accountStatus: string;
  mustChangePassword: boolean;
  lastSignedIn: string | Date | null;
};

export const ROLE_LABELS: Record<string, string> = { SHAREHOLDER: "Pemegang Saham", CONTROLLER: "Controller", ADMIN: "Admin", STAFF: "Staf" };

/** Hanya Admin dan Staf yang dapat dikelola lewat delegasi; aturan yang sama ditegakkan `assertWorkforceAccount` di server. */
export function isWorkforceAccount(account: Pick<InternalAccount, "role">) {
  return account.role === "ADMIN" || account.role === "STAFF";
}

export function accountDisplayName(account: Pick<InternalAccount, "name" | "username">) {
  return account.name?.trim() || account.username || "Akun tanpa nama";
}
