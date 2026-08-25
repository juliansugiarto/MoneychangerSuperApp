import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { LockKeyhole } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

export default function ChangePassword() {
  const { user, loading, refresh, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const change = trpc.auth.changePassword.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Kata sandi diperbarui. Silakan lanjutkan ke operasional."); window.location.href = "/operasional"; },
    onError: (error) => toast.error(error.message),
  });
  useEffect(() => { if (!loading && !user) window.location.href = "/login"; }, [loading, user]);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (newPassword !== confirmation) return toast.error("Konfirmasi kata sandi belum sama."); change.mutate({ currentPassword, newPassword }); }
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 py-10"><Card className="w-full max-w-lg border-[#dce6f0] shadow-[0_22px_60px_rgba(16,47,88,0.12)]"><CardHeader><div className="flex size-11 items-center justify-center rounded-xl bg-[#e8f5e4] text-[#4a9849]"><LockKeyhole className="size-5" /></div><CardTitle className="font-display mt-5 text-2xl text-[#18395f]">Perbarui kata sandi</CardTitle><CardDescription>Akun awal atau akun yang direset wajib menggunakan kata sandi baru sebelum mengakses operasional.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-5"><div className="space-y-2"><Label htmlFor="current-password">Kata sandi saat ini</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="new-password">Kata sandi baru</Label><Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} required /><p className="text-xs text-[#708397]">Gunakan minimal 12 karakter.</p></div><div className="space-y-2"><Label htmlFor="confirmation">Konfirmasi kata sandi baru</Label><Input id="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></div><Button type="submit" disabled={change.isPending} className="press-scale w-full bg-[#183f70] text-white hover:bg-[#102f58]">{change.isPending ? "Menyimpan…" : "Simpan kata sandi baru"}</Button><Button type="button" variant="ghost" onClick={logout} className="w-full text-[#587087]">Keluar</Button></form></CardContent></Card></main>;
}
