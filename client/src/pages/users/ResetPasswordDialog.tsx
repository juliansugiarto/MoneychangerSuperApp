import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@shared/accountRules";
import { useEffect, useState } from "react";

/** Pengganti `window.prompt`: kata sandi sementara diketik dua kali, tidak pernah tampil di layar. */
export function ResetPasswordDialog({ accountName, open, onOpenChange, isPending, onConfirm }: {
  accountName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: (newPassword: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const ready = password.length >= PASSWORD_MIN_LENGTH && password === confirmation;
  // Dikosongkan setiap kali dialog tertutup — juga saat induk menutupnya sesudah reset berhasil —
  // supaya kata sandi sementara satu akun tidak terbawa ke dialog akun berikutnya.
  useEffect(() => { if (!open) { setPassword(""); setConfirmation(""); } }, [open]);
  const close = (next: boolean) => onOpenChange(next);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset kata sandi {accountName}?</DialogTitle>
          <DialogDescription>Seluruh sesi akun ini langsung keluar, dan pengguna wajib mengganti kata sandi sementara ini saat masuk.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="reset-password">Kata sandi sementara</Label>
            <Input id="reset-password" type="password" autoComplete="new-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
            <p className="text-label text-ink-subtle">Minimal {PASSWORD_MIN_LENGTH} karakter. Sampaikan langsung kepada penggunanya, bukan lewat obrolan grup.</p>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="reset-confirmation">Ulangi kata sandi sementara</Label>
            <Input id="reset-confirmation" type="password" autoComplete="new-password" className={QUIET_FIELD} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className={OUTLINE_BUTTON} onClick={() => close(false)}>Batal</Button>
          <Button className={BOLD_BUTTON} disabled={!ready || isPending} onClick={() => onConfirm(password)}>{isPending ? "Mereset…" : "Reset kata sandi"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
