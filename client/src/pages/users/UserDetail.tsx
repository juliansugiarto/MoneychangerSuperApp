import { OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, accountDisplayName, isWorkforceAccount, type InternalAccount } from "./accounts";

export function UserDetail({ account, onRoleChange, onSuspend, onActivate, onResetPassword }: {
  account: InternalAccount;
  onRoleChange: (role: "ADMIN" | "STAFF") => void;
  onSuspend: () => void;
  onActivate: () => void;
  onResetPassword: () => void;
}) {
  const name = accountDisplayName(account);
  const lastSignedIn = account.lastSignedIn ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(account.lastSignedIn)) : "belum pernah masuk";
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-body">
        <dt className="text-ink-muted">Username</dt><dd className="font-semibold text-ink">@{account.username}</dd>
        <dt className="text-ink-muted">Peran</dt><dd className="text-ink">{ROLE_LABELS[account.role] ?? account.role}</dd>
        <dt className="text-ink-muted">Status</dt><dd className="text-ink">{account.accountStatus === "ACTIVE" ? "Aktif" : "Nonaktif"}{account.mustChangePassword ? " · wajib ganti kata sandi" : ""}</dd>
        <dt className="text-ink-muted">Terakhir masuk</dt><dd className="text-ink">{lastSignedIn}</dd>
      </dl>
      {!isWorkforceAccount(account) ? (
        <p className="rounded-md border-[1.5px] border-line bg-surface-sunken px-2 py-1 text-label text-ink-muted">Akun tata kelola (Controller dan Pemegang Saham) dilindungi dan tidak dapat diubah dari layar ini.</p>
      ) : (
        <>
          <div className="grid gap-1">
            <Label htmlFor={`role-${account.id}`}>Ubah peran</Label>
            <select id={`role-${account.id}`} className={`h-control px-2 text-body text-ink ${QUIET_FIELD}`} value={account.role} onChange={(event) => onRoleChange(event.target.value as "ADMIN" | "STAFF")}>
              <option value="STAFF">Staf</option>
              <option value="ADMIN">Admin</option>
            </select>
            <p className="text-label text-ink-subtle">Mengubah peran langsung mengeluarkan seluruh sesi akun ini.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className={OUTLINE_BUTTON} onClick={onResetPassword}>Reset kata sandi</Button>
            {account.accountStatus === "ACTIVE" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" className={`${OUTLINE_BUTTON} text-danger`}>Nonaktifkan</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Nonaktifkan {name}?</AlertDialogTitle>
                    <AlertDialogDescription>Akun ini tidak dapat masuk lagi dan seluruh sesinya — termasuk di perangkat lain — langsung dicabut. Dapat diaktifkan kembali kapan saja.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction className="bg-danger text-paper hover:bg-danger" onClick={onSuspend}>Ya, nonaktifkan</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <Button variant="outline" className={OUTLINE_BUTTON} onClick={onActivate}>Aktifkan lagi</Button>}
          </div>
        </>
      )}
    </div>
  );
}
