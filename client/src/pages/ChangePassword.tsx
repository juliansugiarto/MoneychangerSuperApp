import { useAuth } from "@/_core/hooks/useAuth";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authBrand, usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MIN_LENGTH } from "@shared/accountRules";
import { useEffect, useState, type FormEvent } from "react";
import { AuthFrame } from "./auth/AuthFrame";

export default function ChangePassword() {
  const { user, loading, refresh, logout } = useAuth();
  const profile = usePublicProfile();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const change = trpc.auth.changePassword.useMutation({
    onSuccess: async () => { await refresh(); window.location.assign("/operasional"); },
    onError: (failure) => setError(failure.message),
  });
  useEffect(() => { if (!loading && !user) window.location.assign("/login"); }, [loading, user]);
  const lengthOk = newPassword.length >= PASSWORD_MIN_LENGTH;
  const matchOk = confirmation !== "" && newPassword === confirmation;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lengthOk || !matchOk) return;
    setError(null);
    change.mutate({ currentPassword, newPassword });
  }

  return (
    <AuthFrame brand={authBrand(profile)} logoUrl={profile.data?.logoUrl ?? null} title="Ganti kata sandi Anda" description="Akun baru atau akun yang direset wajib memakai kata sandi pribadi sebelum mulai bekerja.">
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid gap-1">
          <Label htmlFor="current-password">Kata sandi saat ini</Label>
          <Input id="current-password" type="password" autoComplete="current-password" className={QUIET_FIELD} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="new-password">Kata sandi baru</Label>
          <Input id="new-password" type="password" autoComplete="new-password" className={QUIET_FIELD} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          <p className={`text-label ${newPassword === "" || lengthOk ? "text-ink-subtle" : "text-danger"}`}>{lengthOk ? "Panjangnya sudah cukup." : `Minimal ${PASSWORD_MIN_LENGTH} karakter${newPassword ? ` (saat ini ${newPassword.length})` : ""}.`}</p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="confirmation">Ulangi kata sandi baru</Label>
          <Input id="confirmation" type="password" autoComplete="new-password" className={QUIET_FIELD} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
          {confirmation !== "" && !matchOk ? <p className="text-label text-danger">Belum sama dengan kata sandi baru.</p> : null}
        </div>
        {error ? <p role="alert" className="rounded-md border-[1.5px] border-danger bg-danger-soft px-2 py-1 text-body text-ink">{error}</p> : null}
        <Button type="submit" className={`w-full ${BOLD_BUTTON}`} disabled={change.isPending || !lengthOk || !matchOk}>{change.isPending ? "Menyimpan…" : "Simpan kata sandi baru"}</Button>
        <Button type="button" variant="outline" className={`w-full ${OUTLINE_BUTTON}`} onClick={logout}>Keluar</Button>
      </form>
    </AuthFrame>
  );
}
