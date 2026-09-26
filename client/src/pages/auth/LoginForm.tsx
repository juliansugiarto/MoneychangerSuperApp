import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, type FormEvent } from "react";

/** Daftar cara masuk (spec program §3.5). "Masuk dengan SOLVINC" kelak ditambahkan di sini tanpa menyentuh sesi maupun peran. */
export const SIGN_IN_METHODS = [{ id: "PASSWORD", label: "Username & kata sandi" }] as const;

export function LoginForm({ onSubmit, isPending, errorMessage }: {
  onSubmit: (values: { username: string; password: string }) => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const ready = username.trim() !== "" && password !== "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready) onSubmit({ username: username.trim(), password });
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <ul aria-label="Cara masuk" className="flex flex-wrap gap-2">
        {SIGN_IN_METHODS.map((method) => (
          <li key={method.id} className="rounded-md border-2 border-ink bg-second px-2 py-0.5 text-label font-bold text-second-contrast">{method.label}</li>
        ))}
      </ul>
      <div className="grid gap-1">
        <Label htmlFor="username">Username</Label>
        <Input id="username" autoComplete="username" className={QUIET_FIELD} value={username} onChange={(event) => setUsername(event.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="password">Kata sandi</Label>
        <Input id="password" type="password" autoComplete="current-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      {errorMessage ? <p role="alert" className="rounded-md border-[1.5px] border-danger bg-danger-soft px-2 py-1 text-body text-ink">{errorMessage}</p> : null}
      <Button type="submit" className={`w-full ${BOLD_BUTTON}`} disabled={!ready || isPending}>{isPending ? "Memeriksa…" : "Masuk"}</Button>
      <a href="/pulihkan" className="text-center text-label font-semibold text-ink underline underline-offset-4">Lupa kata sandi pemilik?</a>
      <p className="text-center text-label text-ink-subtle">Staf yang lupa kata sandi: minta pemilik atau Controller mereset akun Anda.</p>
    </form>
  );
}
