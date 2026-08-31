import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound, Landmark, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

export default function Login() {
  const { user, loading, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: async (account) => {
      await refresh();
      window.location.href = account.mustChangePassword ? "/ubah-sandi" : "/operasional";
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!loading && user) window.location.href = user.mustChangePassword ? "/ubah-sandi" : "/operasional";
  }, [loading, user]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ username, password });
  }

  return <main className="min-h-screen overflow-hidden bg-[#102f58] px-4 py-8 text-white sm:px-6 sm:py-12">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(121,214,93,0.22),transparent_26%),radial-gradient(circle_at_84%_78%,rgba(51,120,190,0.42),transparent_30%)]" />
    <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex flex-col justify-between p-8 sm:p-12">
        <div><div className="flex size-12 items-center justify-center rounded-2xl bg-[#d7ec75] font-display font-bold text-[#102f58]">IV</div><p className="mt-10 text-xs font-bold tracking-[0.2em] text-[#b7dff7] uppercase">Sistem Internal</p><h1 className="font-display mt-4 max-w-md text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Akses operasional yang terkendali.</h1><p className="mt-5 max-w-md text-sm leading-7 text-blue-100/75">Masuk menggunakan akun staf perusahaan. Tidak tersedia login Google maupun akses nasabah.</p></div>
        <div className="mt-12 flex max-w-md gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-blue-100/75"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#9fe98b]" /><p>Sesi dilindungi cookie httpOnly. Controller dan Shareholder dapat mendelegasikan akses hanya untuk Admin dan Staff.</p></div>
      </section>
      <section className="flex items-center bg-white p-7 text-[#18395f] sm:p-12"><form onSubmit={submit} className="w-full"><div className="flex size-11 items-center justify-center rounded-xl bg-[#e8f5e4] text-[#4a9849]"><KeyRound className="size-5" /></div><h2 className="font-display mt-7 text-3xl font-semibold tracking-tight">Masuk ke back office</h2><p className="mt-2 text-sm leading-6 text-[#6d8093]">Gunakan username dan kata sandi akun internal Anda.</p><div className="mt-8 space-y-5"><div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="contoh: j.sugiarto" required /></div><div className="space-y-2"><Label htmlFor="password">Kata sandi</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div></div><Button type="submit" disabled={login.isPending || !username.trim() || !password} className="press-scale mt-8 h-11 w-full bg-[#183f70] text-white hover:bg-[#102f58]">{login.isPending ? "Memverifikasi…" : "Masuk"}</Button><p className="mt-6 text-center text-xs leading-5 text-[#7b8d9f]">Kredensial pertama diberikan oleh Shareholder. Hubungi Controller atau Shareholder untuk pembuatan, penonaktifan, atau reset akses.</p></form></section>
    </div>
  </main>;
}
