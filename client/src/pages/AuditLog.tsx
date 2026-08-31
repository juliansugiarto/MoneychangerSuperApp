import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ScrollText } from "lucide-react";

export default function AuditLog() {
  const { user } = useAuth();
  const { data, isLoading } = trpc.audit.list.useQuery({ limit: 100 }, { enabled: Boolean(user) });
  return <div className="mx-auto max-w-6xl space-y-6"><section><div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-[#5c8f53] uppercase"><ScrollText className="size-4" /> Audit trail</div><h1 className="font-display text-3xl font-semibold tracking-tight text-[#18395f]">Jejak perubahan operasional</h1><p className="mt-2 text-sm leading-6 text-[#475569]">Catatan signifikan bersifat append-only: pembuatan master, kurs, transaksi, pembatalan, review, dan saldo kas.</p></section><Card className="border-[#dce6f0]"><CardHeader><CardTitle className="font-display text-xl text-[#18395f]">100 aktivitas terbaru</CardTitle><CardDescription>Catatan menampilkan pelaku, entitas, perubahan ringkas, alasan, dan waktu server.</CardDescription></CardHeader><CardContent><div className="space-y-3">{isLoading ? <div className="space-y-3">{[0, 1, 2].map((row) => <div key={row} className="h-16 animate-pulse rounded-2xl bg-[#f2f5f9]" />)}</div> : data?.length ? data.map((entry) => <article key={entry.id} className="rounded-2xl border border-[#e2eaf2] bg-[#fbfdff] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#18395f]">{entry.action}</p><p className="mt-1 text-xs text-[#475569]">{entry.entityType} #{entry.entityId} · Pelaku #{entry.actorUserId ?? "system"}</p></div><Badge variant="outline" className="border-[#d6e3ee] bg-white text-[#536b7e]">{new Date(entry.createdAt).toLocaleString("id-ID")}</Badge></div>{entry.reason ? <p className="mt-3 rounded-lg bg-[#f5f8fb] px-3 py-2 text-xs leading-5 text-[#536b7e]">Alasan/catatan: {entry.reason}</p> : null}</article>) : <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm text-[#475569]">Belum ada audit event. Aktivitas signifikan akan tercatat otomatis setelah penggunaan modul.</div>}</div></CardContent></Card></div>;
}

