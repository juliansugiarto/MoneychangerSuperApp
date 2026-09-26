import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, type FormEvent } from "react";
import { RecoveryCodeSheet } from "./RecoveryCodeSheet";

export function RegenerateRecoveryCodes({ brand, codes, errorMessage, isPending, onRegenerate, onDone }: {
  brand: string;
  codes: string[] | null;
  errorMessage: string | null;
  isPending: boolean;
  onRegenerate: (currentPassword: string) => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  if (codes) return <RecoveryCodeSheet brand={brand} codes={codes} continueLabel="Selesai" onContinue={onDone} />;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password) onRegenerate(password);
  }

  return (
    <form onSubmit={submit} className="grid max-w-md gap-3">
      <p className="text-body text-ink-muted">Delapan kode baru akan dibuat, dan seluruh kode lama yang belum terpakai batal saat itu juga. Simpan lembar barunya sebelum menutup halaman.</p>
      <div className="grid gap-1">
        <Label htmlFor="regenerate-password">Kata sandi saat ini</Label>
        <Input id="regenerate-password" type="password" autoComplete="current-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      {errorMessage ? <p role="alert" className="rounded-md border-[1.5px] border-danger bg-danger-soft px-2 py-1 text-body text-ink">{errorMessage}</p> : null}
      <Button type="submit" className={BOLD_BUTTON} disabled={!password || isPending}>{isPending ? "Membuat…" : "Buat 8 kode baru"}</Button>
    </form>
  );
}
