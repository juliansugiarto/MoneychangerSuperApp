import { PageHeader } from "@/components/patterns/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { DEFAULT_OPERATIONAL_TIMEZONE, operationalDateKey } from "@shared/regulatoryActionQueue";
import { useState } from "react";
import { toast } from "sonner";
import { NOTICE_TYPE_LABEL, NoticeCard } from "./laporan-dttot/NoticeCard";

/**
 * Pemberitahuan DTTOT dari BI → saring → Laporan Nihil / Berita Acara → lima pengiriman.
 * Rancangan: docs/superpowers/specs/2026-11-12-pemberitahuan-dttot-design.md. Controller ke atas.
 */
type NoticeType = keyof typeof NOTICE_TYPE_LABEL;
type ListType = "DTTOT" | "DPPSPM";
const TYPES_BY_LIST: Record<ListType, NoticeType[]> = { DTTOT: ["PENCANTUMAN", "PERPANJANGAN", "PENGHAPUSAN"], DPPSPM: ["PEMBARUAN", "PENGHAPUSAN"] };

export default function LaporanDttot() {
  const utils = trpc.useUtils();
  const notices = trpc.dttotNotices.list.useQuery();
  const [form, setForm] = useState({ listType: "DTTOT" as ListType, noticeType: "PERPANJANGAN" as NoticeType, policeLetterNumber: "", listNumber: "", receivedOn: operationalDateKey(new Date(), DEFAULT_OPERATIONAL_TIMEZONE), policeLetterDate: "" });
  const dppspm = form.listType === "DPPSPM";
  const create = trpc.dttotNotices.create.useMutation({
    onSuccess: () => { toast.success("Pemberitahuan dicatat."); setForm({ ...form, policeLetterNumber: "", listNumber: "", policeLetterDate: "" }); void utils.dttotNotices.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  return <div className="space-y-6">
    <PageHeader title="Laporan DTTOT & DPPSPM" description="Setiap pemberitahuan daftar DTTOT (dari BI, lapor ke Densus 88) atau DPPSPM (dari PPATK, lapor ke PPATK): saring nasabah, cetak laporan, lalu catat pengirimannya." />
    <Card>
      <CardHeader><CardTitle className="text-base">Catat pemberitahuan baru</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <div><Label htmlFor="daftar">Daftar</Label>
          <select id="daftar" className="mt-1 h-9 w-full rounded-md border bg-transparent px-2 text-sm" value={form.listType} onChange={(e) => { const listType = e.target.value as ListType; setForm({ ...form, listType, noticeType: TYPES_BY_LIST[listType][0]! }); }}>
            <option value="DTTOT">DTTOT (terorisme)</option><option value="DPPSPM">DPPSPM (senjata pemusnah massal)</option>
          </select></div>
        <div><Label htmlFor="jenis">Jenis</Label>
          <select id="jenis" className="mt-1 h-9 w-full rounded-md border bg-transparent px-2 text-sm" value={form.noticeType} onChange={(e) => setForm({ ...form, noticeType: e.target.value as NoticeType })}>
            {TYPES_BY_LIST[form.listType].map((value) => <option key={value} value={value}>{NOTICE_TYPE_LABEL[value]}</option>)}
          </select></div>
        <div><Label htmlFor="surat">{dppspm ? "Nomor keputusan PPATK" : "Nomor surat Densus 88"}</Label><Input id="surat" className="mt-1" value={form.policeLetterNumber} onChange={(e) => setForm({ ...form, policeLetterNumber: e.target.value })} placeholder={dppspm ? "Nomor pada keputusan PPATK" : "Mis. R/21/X/RES.6.1./2026/Densus"} /></div>
        <div><Label htmlFor="lampiran">Nomor lampiran daftar</Label><Input id="lampiran" className="mt-1" value={form.listNumber} onChange={(e) => setForm({ ...form, listNumber: e.target.value })} placeholder={dppspm ? "Boleh dikosongkan" : "Mis. DTTOT/P-25/X/RES.6.1./2026"} /></div>
        <div><Label htmlFor="tglsurat">{dppspm ? "Tanggal keputusan PPATK" : "Tanggal surat Densus"}</Label><Input id="tglsurat" type="date" className="mt-1" value={form.policeLetterDate} onChange={(e) => setForm({ ...form, policeLetterDate: e.target.value })} /></div>
        <div><Label htmlFor="diterima">{dppspm ? "Diterima" : "Surel BI diterima"}</Label><Input id="diterima" type="date" className="mt-1" value={form.receivedOn} onChange={(e) => setForm({ ...form, receivedOn: e.target.value })} /></div>
        <div className="md:col-span-3"><Button disabled={create.isPending || form.policeLetterNumber.trim().length < 5} onClick={() => create.mutate({ ...form, listNumber: form.listNumber.trim() || undefined, policeLetterDate: form.policeLetterDate || undefined })}>{create.isPending ? "Menyimpan…" : "Catat pemberitahuan"}</Button></div>
      </CardContent>
    </Card>
    {notices.isLoading ? <Skeleton className="h-40 w-full" />
      : notices.isError ? <p className="text-sm text-rose-700">Gagal memuat pemberitahuan. Muat ulang halaman.</p>
      : notices.data?.length ? notices.data.map((notice) => <NoticeCard key={notice.id} notice={notice} lastPlace={notices.data.find((row) => row.reportPlace)?.reportPlace} />)
      : <p className="text-sm text-slate-600">Belum ada pemberitahuan. Catat pemberitahuan DTTOT atau DPPSPM berikutnya di atas.</p>}
  </div>;
}
