import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BellRing, CheckCircle2, CircleAlert, Eye, FileCheck2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function eventLabel(eventType: string) {
  return ({ FLAGGED_TRANSACTION_APPROVED: "Persetujuan transaksi", STOCK_VARIANCE: "Varians kas", RATE_SHOCK: "Perubahan kurs", CONSUMER_COMPLAINT: "Pengaduan konsumen" } as Record<string, string>)[eventType] ?? eventType;
}

function eventIcon(eventType: string) {
  return eventType === "RATE_SHOCK" || eventType === "STOCK_VARIANCE" ? ShieldAlert : eventType === "CONSUMER_COMPLAINT" ? FileCheck2 : BellRing;
}

export default function DirectorAcknowledgements() {
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.directorAcknowledgements.list.useQuery();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const acknowledge = trpc.directorAcknowledgements.acknowledge.useMutation({
    onSuccess: () => { toast.success("Item telah ditandai diketahui."); utils.directorAcknowledgements.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const openItems = (items ?? []).filter((item) => !item.acknowledgedAt);
  const knownItems = (items ?? []).filter((item) => item.acknowledgedAt);

  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="rounded-[1.5rem] border border-[#dce6f0] bg-white p-6 shadow-[0_10px_32px_rgba(30,50,87,0.05)] sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-[#5c8f53] uppercase"><Eye className="size-4" /> Pengawasan Direksi</p><h1 className="mt-2 font-display text-3xl tracking-tight text-[#18395f]">Laporan yang perlu diketahui.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#64748b]">Persetujuan Supervisor dan kontrol outlet tetap berjalan. Halaman ini memastikan Direksi mengetahui kejadian penting tanpa menjadi hambatan bagi layanan yang sudah memiliki kewenangan.</p></div><Badge className={openItems.length ? "w-fit status-pending" : "w-fit status-approved"}>{openItems.length ? `${openItems.length} MENUNGGU DIKETAHUI` : "SEMUA SUDAH DIKETAHUI"}</Badge></div></section>

    <Card className="border-[#dce6f0]"><CardHeader><CardTitle className="font-display text-xl text-[#18395f]">Menunggu pengakuan</CardTitle><CardDescription>Tandai diketahui setelah membaca ringkasan dan bukti terkait. Catatan Direksi bersifat pelengkap jejak audit.</CardDescription></CardHeader><CardContent><div className="space-y-4">{isLoading ? <div className="h-28 animate-pulse rounded-xl bg-[#f2f5f9]" /> : null}{!isLoading && !openItems.length ? <EmptyState /> : null}{openItems.map((item) => { const Icon = eventIcon(item.eventType); return <article key={item.id} className="rounded-2xl border border-[#ece3c8] bg-[#fffcf5] p-5"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Icon className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#294665]">{item.title}</p><Badge className="status-pending">{eventLabel(item.eventType)}</Badge></div><p className="mt-2 max-w-3xl text-sm leading-6 text-[#63758c]">{item.detail}</p><p className="mt-3 text-xs text-[#7a8899]">Dibuat {formatDate(item.createdAt)} · Referensi {item.entityType} #{item.entityId}</p></div></div></div><Textarea value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Catatan Direksi (opsional)" className="mt-4 min-h-20 bg-white" /><Button disabled={acknowledge.isPending} onClick={() => acknowledge.mutate({ acknowledgementId: item.id, notes: notes[item.id] || undefined })} className="press-scale mt-3 bg-[#183f70] text-white hover:bg-[#12345d]"><CheckCircle2 className="mr-2 size-4" />Tandai diketahui</Button></article>;})}</div></CardContent></Card>

    {knownItems.length ? <Card className="border-[#e2eaf2]"><CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Sudah diketahui</CardTitle><CardDescription>Riwayat tetap tersimpan sebagai bagian dari pengawasan dan audit.</CardDescription></CardHeader><CardContent><div className="divide-y divide-[#edf2f7]">{knownItems.slice(0, 20).map((item) => <div className="flex gap-3 py-4" key={item.id}><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /><div><p className="text-sm font-semibold text-[#405b76]">{item.title}</p><p className="mt-1 text-xs text-[#718397]">Diketahui {item.acknowledgedAt ? formatDate(item.acknowledgedAt) : ""}{item.acknowledgementNotes ? ` · ${item.acknowledgementNotes}` : ""}</p></div></div>)}</div></CardContent></Card> : null}
  </div>;
}

function EmptyState() {
  return <div className="rounded-2xl border border-dashed border-[#cddbe7] bg-[#f8fbfe] px-5 py-12 text-center"><span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-5" /></span><p className="mt-4 font-semibold text-[#405b76]">Tidak ada laporan yang menunggu pengakuan.</p><p className="mt-1 text-sm text-[#718397]">Persetujuan transaksi ter-flag, varians kas, perubahan kurs material, dan pengaduan akhir akan muncul di sini.</p></div>;
}
