import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@shared/accountRules";
import { RECOVERY_CODE_GROUPS, formatSecretCode, normalizeSecretCode } from "@shared/secretCodes";
import { useState, type FormEvent } from "react";

export function RecoverForm({ onSubmit, isPending, errorMessage }: {
  onSubmit: (values: { username: string; code: string; newPassword: string }) => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const compact = normalizeSecretCode(code, RECOVERY_CODE_GROUPS);
  const passwordOk = password.length >= PASSWORD_MIN_LENGTH;
  const matchOk = confirmation !== "" && confirmation === password;
  const ready = username.trim() !== "" && compact !== null && passwordOk && matchOk;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready) onSubmit({ username: username.trim(), code: formatSecretCode(compact!), newPassword: password });
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="recover-username">Username pemilik</Label>
        <Input id="recover-username" autoComplete="username" className={QUIET_FIELD} value={username} onChange={(event) => setUsername(event.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="recover-code">Kode pemulihan</Label>
        <Input id="recover-code" autoComplete="one-time-code" placeholder="XXXX-XXXX" className={`${QUIET_FIELD} font-mono uppercase`} value={code} onChange={(event) => setCode(event.target.value)} />
        {code !== "" && compact === null
          ? <p className="text-label text-danger">Kode pemulihan terdiri dari 8 huruf atau angka, mis. ABCD-EFGH. Huruf kecil dan spasi tidak masalah.</p>
          : <p className="text-label text-ink-subtle">Satu dari delapan kode yang Anda simpan saat penyiapan. Setiap kode hanya berlaku sekali.</p>}
      </div>
      <div className="grid gap-1">
        <Label htmlFor="recover-password">Kata sandi baru</Label>
        <Input id="recover-password" type="password" autoComplete="new-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
        <p className={`text-label ${password === "" || passwordOk ? "text-ink-subtle" : "text-danger"}`}>Minimal {PASSWORD_MIN_LENGTH} karakter{password !== "" && !passwordOk ? ` (saat ini ${password.length}).` : "."}</p>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="recover-confirmation">Ulangi kata sandi baru</Label>
        <Input id="recover-confirmation" type="password" autoComplete="new-password" className={QUIET_FIELD} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        {confirmation !== "" && !matchOk ? <p className="text-label text-danger">Belum sama dengan kata sandi baru.</p> : null}
      </div>
      {errorMessage ? <p role="alert" className="rounded-md border-[1.5px] border-danger bg-danger-soft px-2 py-1 text-body text-ink">{errorMessage}</p> : null}
      <Button type="submit" className={`w-full ${BOLD_BUTTON}`} disabled={!ready || isPending}>{isPending ? "Memulihkan…" : "Pulihkan akun"}</Button>
      <a href="/login" className="text-center text-label font-semibold text-ink underline underline-offset-4">Kembali ke halaman masuk</a>
    </form>
  );
}
