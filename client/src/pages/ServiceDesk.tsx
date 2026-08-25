import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BellRing, ClipboardCheck, Megaphone, Send, ShieldCheck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type NextStatus = "MENUNGGU_VERIFIKASI" | "KURS_DIKONFIRMASI" | "SIAP_DILAYANI" | "KEDALUWARSA" | "DIBATALKAN";
type ServiceRequestRow = { request: { id: number; requestNumber: string; requesterName: string; contactChannel: string; contactValue: string; currencyId: number; operation: "BUY" | "SELL"; foreignAmount: string; status: string; staffNotes: string | null; createdAt: Date }; currency: { code: string } };
type ActiveRateRow = { rate: { id: number; effectiveAt: Date }; currency: { id: number } };
const statusLabel: Record<string, string> = { BARU: "Baru", MENUNGGU_VERIFIKASI: "Ditelaah", KURS_DIKONFIRMASI: "Kurs dikonfirmasi", SIAP_DILAYANI: "Siap dilayani", KEDALUWARSA: "Kedaluwarsa", DIBATALKAN: "Dibatalkan" };
const statusTone: Record<string, string> = { BARU: "bg-sky-100 text-sky-800", MENUNGGU_VERIFIKASI: "bg-amber-100 text-amber-900", KURS_DIKONFIRMASI: "bg-violet-100 text-violet-800", SIAP_DILAYANI: "bg-emerald-100 text-emerald-800", KEDALUWARSA: "bg-slate-200 text-slate-700", DIBATALKAN: "bg-rose-100 text-rose-800" };
const allowed: Record<string, NextStatus[]> = { BARU: ["MENUNGGU_VERIFIKASI", "DIBATALKAN"], MENUNGGU_VERIFIKASI: ["KURS_DIKONFIRMASI", "DIBATALKAN"], KURS_DIKONFIRMASI: ["SIAP_DILAYANI", "KEDALUWARSA", "DIBATALKAN"], SIAP_DILAYANI: ["KEDALUWARSA", "DIBATALKAN"], KEDALUWARSA: [], DIBATALKAN: [] };

export default function ServiceDesk() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const canManageAnnouncements = user?.role !== "STAFF";
  const { data: requests, isLoading } = trpc.serviceRequests.list.useQuery(undefined, { enabled: Boolean(user) });
  const { data: activeRates = [] } = trpc.rates.activeRates.useQuery(undefined, { enabled: Boolean(user) });
  const { data: announcements = [] } = trpc.announcements.list.useQuery(undefined, { enabled: canManageAnnouncements });
  const [statusById, setStatusById] = useState<Record<number, NextStatus>>({});
  const [notesById, setNotesById] = useState<Record<number, string>>({});
  const [rateById, setRateById] = useState<Record<number, string>>({});
  const [expiryById, setExpiryById] = useState<Record<number, string>>({});
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const openCount = useMemo(() => requests?.filter(({ request }) => !["KEDALUWARSA", "DIBATALKAN"].includes(request.status)).length ?? 0, [requests]);

  const updateRequest = trpc.serviceRequests.update.useMutation({
    onSuccess: () => { toast.success("Permintaan diperbarui dan dicatat pada audit log."); utils.serviceRequests.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const createAnnouncement = trpc.announcements.create.useMutation({
    onSuccess: () => { toast.success("Draf pengumuman dibuat."); setAnnouncementTitle(""); setAnnouncementContent(""); utils.announcements.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const updateAnnouncement = trpc.announcements.update.useMutation({
    onSuccess: () => { toast.success("Status pengumuman diperbarui."); utils.announcements.list.invalidate(); utils.publicContent.announcements.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  const saveRequest = (item: NonNullable<typeof requests>[number]) => {
    const request = item.request;
    const status = statusById[request.id] ?? allowed[request.status][0];
    if (!status) return;
    const needsRate = status === "KURS_DIKONFIRMASI";
    updateRequest.mutate({
      requestId: request.id,
      status,
      staffNotes: notesById[request.id] || undefined,
      confirmedOperationalRateId: needsRate ? Number(rateById[request.id]) : undefined,
      confirmedRateExpiresAt: needsRate && expiryById[request.id] ? new Date(expiryById[request.id]) : undefined,
    });
  };
  const createDraft = (event: FormEvent) => { event.preventDefault(); createAnnouncement.mutate({ title: announcementTitle, content: announcementContent }); };

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="flex flex-col justify-between gap-4 rounded-[1.5rem] border-2 border-[#b8d8bd] bg-[#eff8ed] p-5 sm:flex-row sm:items-end sm:p-7">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-extrabold tracking-[0.16em] text-[#0a6b52] uppercase"><ShieldCheck className="size-4" /> Layanan pelanggan</div><h1 className="font-display text-3xl font-bold text-[#102f25]">Meja konfirmasi outlet</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#466253]">Tinjau kebutuhan awal, konfirmasi kurs dengan batas waktu, dan arahkan layanan tanpa membuat transaksi atau KYC otomatis.</p></div>
      <Badge className="w-fit border-0 bg-[#102f25] px-3 py-1.5 text-[#d9f45d] hover:bg-[#102f25]">{openCount} perlu tindak lanjut</Badge>
    </section>

    <Card className="border-2 border-[#c7d8ca] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-xl font-bold text-[#102f25]"><ClipboardCheck className="size-5 text-[#0a6b52]" /> Antrian permintaan layanan</CardTitle><CardDescription>Perubahan status direkam dalam audit log. Hanya pilih kurs aktif saat mengonfirmasi kurs.</CardDescription></CardHeader><CardContent className="space-y-4">
      {isLoading ? <p className="text-sm text-[#466253]">Memuat antrian…</p> : requests?.length ? requests.map((item) => <RequestRow key={item.request.id} item={item} activeRates={activeRates} status={statusById[item.request.id] ?? allowed[item.request.status][0]} note={notesById[item.request.id] ?? ""} rateId={rateById[item.request.id] ?? ""} expiry={expiryById[item.request.id] ?? ""} pending={updateRequest.isPending} onStatus={(value) => setStatusById({ ...statusById, [item.request.id]: value })} onNote={(value) => setNotesById({ ...notesById, [item.request.id]: value })} onRate={(value) => setRateById({ ...rateById, [item.request.id]: value })} onExpiry={(value) => setExpiryById({ ...expiryById, [item.request.id]: value })} onSave={() => saveRequest(item)} />) : <div className="rounded-2xl border border-dashed border-[#b8cdbb] bg-[#f6faf5] p-10 text-center text-sm text-[#466253]">Belum ada permintaan layanan dari halaman publik.</div>}
    </CardContent></Card>

    {canManageAnnouncements ? <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="border-2 border-[#c7d8ca] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-xl font-bold text-[#102f25]"><Megaphone className="size-5 text-[#0a6b52]" /> Buat pengumuman</CardTitle><CardDescription>Simpan sebagai draf. Terbitkan hanya setelah kontennya disetujui.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={createDraft}><div className="space-y-1.5"><Label>Judul</Label><Input required minLength={5} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} /></div><div className="space-y-1.5"><Label>Isi pengumuman</Label><Textarea required minLength={10} rows={6} value={announcementContent} onChange={(event) => setAnnouncementContent(event.target.value)} /></div><Button disabled={createAnnouncement.isPending} type="submit" className="press-scale w-full bg-[#102f25] font-bold text-[#d9f45d] hover:bg-[#0a6b52]"><Send className="mr-2 size-4" /> Simpan sebagai draf</Button></form></CardContent></Card>
      <Card className="border-2 border-[#c7d8ca] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-xl font-bold text-[#102f25]"><BellRing className="size-5 text-[#0a6b52]" /> Register pengumuman</CardTitle><CardDescription>Draf tidak tampil di halaman publik. Status penerbitan dapat ditelusuri melalui audit log.</CardDescription></CardHeader><CardContent className="space-y-3">{announcements.length ? announcements.map((announcement) => <div key={announcement.id} className="rounded-xl border border-[#d5e3d5] bg-[#fbfcf8] p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-bold text-[#102f25]">{announcement.title}</p><p className="mt-1 line-clamp-2 text-sm text-[#466253]">{announcement.content}</p></div><Badge className="w-fit bg-[#e7f3e7] text-[#315342] hover:bg-[#e7f3e7]">{announcement.status}</Badge></div><div className="mt-3 flex gap-2">{announcement.status !== "PUBLISHED" ? <Button size="sm" disabled={updateAnnouncement.isPending} onClick={() => updateAnnouncement.mutate({ announcementId: announcement.id, title: announcement.title, content: announcement.content, status: "PUBLISHED" })} className="bg-[#0a6b52] text-white hover:bg-[#064a38]">Terbitkan</Button> : null}{announcement.status !== "ARCHIVED" ? <Button size="sm" variant="outline" disabled={updateAnnouncement.isPending} onClick={() => updateAnnouncement.mutate({ announcementId: announcement.id, title: announcement.title, content: announcement.content, status: "ARCHIVED" })}>Arsipkan</Button> : null}</div></div>) : <p className="rounded-xl bg-[#f6faf5] p-5 text-sm text-[#466253]">Belum ada draf atau pengumuman tersimpan.</p>}</CardContent></Card>
    </div> : null}
  </div>;
}

function RequestRow({ item, activeRates, status, note, rateId, expiry, pending, onStatus, onNote, onRate, onExpiry, onSave }: { item: ServiceRequestRow; activeRates: ActiveRateRow[]; status?: NextStatus; note: string; rateId: string; expiry: string; pending: boolean; onStatus: (value: NextStatus) => void; onNote: (value: string) => void; onRate: (value: string) => void; onExpiry: (value: string) => void; onSave: () => void }) {
  const { request, currency } = item; const choices = allowed[request.status] ?? []; const rateOptions = activeRates.filter((rate) => rate.currency.id === request.currencyId);
  if (!choices.length) return <article className="rounded-2xl border-2 border-[#d5e3d5] bg-[#fbfcf8] p-4"><p className="font-bold text-[#102f25]">{request.requestNumber} · {request.requesterName}</p><p className="mt-2 text-sm text-[#597366]">Permintaan ini sudah berakhir dan tidak dapat diubah lagi.</p></article>;
  return <article className="rounded-2xl border-2 border-[#d5e3d5] bg-[#fbfcf8] p-4 sm:p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-display text-lg font-bold text-[#102f25]">{request.requestNumber} · {request.requesterName}</p><p className="mt-1 text-sm text-[#466253]">{request.operation === "BUY" ? "Menjual" : "Membeli"} {request.foreignAmount} {currency.code} · via {request.contactChannel}: <span className="font-semibold">{request.contactValue}</span></p><p className="mt-1 text-xs text-[#597366]">Masuk {new Date(request.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p></div><Badge className={`${statusTone[request.status]} w-fit`}>{statusLabel[request.status]}</Badge></div>{request.staffNotes ? <p className="mt-3 rounded-xl bg-[#edf6ee] p-3 text-sm text-[#315342]"><b>Catatan terakhir:</b> {request.staffNotes}</p> : null}<div className="mt-4 grid gap-3 border-t border-[#d5e3d5] pt-4 lg:grid-cols-[0.27fr_0.55fr_auto]"><Select value={status} onValueChange={(value) => onStatus(value as NextStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{choices.map((choice) => <SelectItem key={choice} value={choice}>{statusLabel[choice]}</SelectItem>)}</SelectContent></Select><Textarea rows={2} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Catatan tindak lanjut untuk audit." />{status === "KURS_DIKONFIRMASI" ? <div className="grid gap-2 sm:grid-cols-2 lg:col-span-3"><Select value={rateId} onValueChange={onRate}><SelectTrigger><SelectValue placeholder="Pilih kurs aktif" /></SelectTrigger><SelectContent>{rateOptions.map(({ rate }) => <SelectItem key={rate.id} value={String(rate.id)}>Kurs aktif ID {rate.id} · efektif {new Date(rate.effectiveAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</SelectItem>)}</SelectContent></Select><Input type="datetime-local" value={expiry} onChange={(event) => onExpiry(event.target.value)} /></div> : null}<Button disabled={pending} onClick={onSave} className="press-scale bg-[#0a6b52] font-bold text-white hover:bg-[#064a38]">Simpan</Button></div></article>;
}
