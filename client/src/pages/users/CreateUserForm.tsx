import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN, normalizeUsernameInput } from "@shared/accountRules";
import { useState, type FormEvent } from "react";

type CreatableRole = "STAFF" | "ADMIN" | "CONTROLLER";

export function CreateUserForm({ isShareholder, isPending, onSubmit, initialRole = "STAFF" }: {
  isShareholder: boolean;
  isPending: boolean;
  /** Pintasan dasbor Pemegang Saham membuka layar ini dengan `?role=ADMIN` atau `?role=STAFF`. */
  initialRole?: "STAFF" | "ADMIN";
  /** Selesai = akun dibuat; ditolak = isian dibiarkan supaya pengguna cukup memperbaiki yang salah. */
  onSubmit: (values: { name: string; username: string; password: string; role: CreatableRole }) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreatableRole>(initialRole);
  const normalized = normalizeUsernameInput(username);
  const ready = name.trim().length >= 3 && USERNAME_PATTERN.test(normalized) && password.length >= PASSWORD_MIN_LENGTH;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    onSubmit({ name: name.trim(), username: normalized, password, role }).then(
      () => { setName(""); setUsername(""); setPassword(""); },
      // Pesan galatnya sudah ditampilkan halaman (toast); di sini cukup tidak membuang isian.
      () => undefined,
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="new-user-name">Nama</Label>
        <Input id="new-user-name" className={QUIET_FIELD} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="new-user-username">Username</Label>
        <Input id="new-user-username" className={QUIET_FIELD} placeholder="nama.pengguna" value={username} onChange={(event) => setUsername(event.target.value)} />
        {username !== "" && !USERNAME_PATTERN.test(normalized) ? <p className="text-label text-danger">Huruf kecil, angka, titik, garis bawah, atau strip; 3–48 karakter.</p> : null}
      </div>
      <div className="grid gap-1">
        <Label htmlFor="new-user-password">Kata sandi awal</Label>
        <Input id="new-user-password" type="password" autoComplete="new-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
        <p className="text-label text-ink-subtle">Minimal {PASSWORD_MIN_LENGTH} karakter. Pengguna wajib menggantinya saat pertama masuk.</p>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="new-user-role">Peran</Label>
        <select id="new-user-role" className={`h-control px-2 text-body text-ink ${QUIET_FIELD}`} value={role} onChange={(event) => setRole(event.target.value as CreatableRole)}>
          <option value="STAFF">Staf</option>
          <option value="ADMIN">Admin</option>
          {isShareholder ? <option value="CONTROLLER">Controller</option> : null}
        </select>
        <p className="text-label text-ink-subtle">Admin mengelola kurs dan persetujuan; Staf mencatat operasional. Controller hanya dapat dibuat Pemegang Saham.</p>
      </div>
      <Button type="submit" className={BOLD_BUTTON} disabled={!ready || isPending}>{isPending ? "Membuat…" : "Buat akun"}</Button>
    </form>
  );
}
