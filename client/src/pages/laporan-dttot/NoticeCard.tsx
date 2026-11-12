import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildLaporanNihilHtml, buildLaporanPemblokiranHtml, longDayDate, printDttotReport } from "@/lib/laporanDttot";
import { printedCompany } from "@/lib/printedCompany";
import { trpc } from "@/lib/trpc";
import { calendarDay } from "@shared/ledger";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import { toast } from "sonner";
import type { AppRouter } from "../../../../server/routers";

type Notice = inferRouterOutputs<AppRouter>["dttotNotices"]["list"][number];
type Step = "policePhysicalSentAt" | "policeEmailSentAt" | "ppatkCopySentAt" | "biCopySentAt" | "biFormUploadedAt";

export const NOTICE_TYPE_LABEL: Record<Notice["noticeType"], string> = { PENCANTUMAN: "Pencantuman", PERPANJANGAN: "Perpanjangan", PENGHAPUSAN: "Penghapusan" };

const DELIVERIES: { step: Step; label: string }[] = [
  { step: "policePhysicalSentAt", label: "Surat asli dikirim ke Densus 88 (Jl. Trunojoyo No. 3, Kebayoran Baru, Jakarta Selatan 12110)" },
  { step: "policeEmailSentAt", label: "Pindaian dikirim ke dttot.report.4@gmail.com" },
  { step: "ppatkCopySentAt", label: "Tembusan ke PPATK (dttot.report@ppatk.go.id)" },
  { step: "biCopySentAt", label: "Tembusan ke pengawas Bank Indonesia" },
  { step: "biFormUploadedAt", label: "Diunggah ke formulir BI \"Laporan Hasil Screening DTTOT dan PPPSPM\"" },
];

const shortDate = (value: Date | string) => new Date(value).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

export function NoticeCard({ notice }: { notice: Notice }) {
  const utils = trpc.useUtils();
  const refresh = () => utils.dttotNotices.list.invalidate();
  const company = printedCompany(trpc.companyProfile.get.useQuery().data);
  const [report, setReport] = useState({ reportNumber: notice.reportNumber ?? "", signerName: notice.signerName ?? "", signerPosition: notice.signerPosition ?? "" });
  const [witness, setWitness] = useState({ name: "", position: "" });
  const screen = trpc.dttotNotices.screen.useMutation({ onSuccess: (result) => { toast.success(result.matchedCustomerCount ? `${result.matchedCustomerCount} nasabah cocok dengan DTTOT.` : "Tidak ada nasabah yang cocok (nihil)."); refresh(); }, onError: (error) => toast.error(error.message) });
  const saveReport = trpc.dttotNotices.updateReport.useMutation({ onSuccess: refresh, onError: (error) => toast.error(error.message) });
  const delivery = trpc.dttotNotices.recordDelivery.useMutation({ onSuccess: refresh, onError: (error) => toast.error(error.message) });

  const matched = notice.matchedCustomerCount ?? 0;
  const screened = Boolean(notice.screenedAt);
  const reportReady = report.reportNumber.trim() && report.signerName.trim().length >= 3 && report.signerPosition.trim().length >= 2;
  const sentCount = DELIVERIES.filter(({ step }) => notice[step]).length;

  const print = async () => {
    await saveReport.mutateAsync({ noticeId: notice.id, ...report });
    const signer = { name: report.signerName.trim(), position: report.signerPosition.trim() };
    const common = { company: { legalName: company.legalName, address: company.address }, reportNumber: report.reportNumber.trim(), place: "Jakarta", reportDate: new Date(), signer };
    if (!matched) return printDttotReport(`Laporan Nihil ${notice.policeLetterNumber}`, buildLaporanNihilHtml({ ...common, screenedAt: new Date(notice.screenedAt!) }));
    if (witness.name.trim().length < 3 || witness.position.trim().length < 2) return toast.error("Isi nama dan jabatan saksi untuk berita acara.");
    const data = await utils.dttotNotices.report.fetch({ noticeId: notice.id });
    printDttotReport(`Laporan Pemblokiran ${notice.policeLetterNumber}`, buildLaporanPemblokiranHtml({
      ...common, blockedAt: new Date(notice.screenedAt!), witness: { name: witness.name.trim(), position: witness.position.trim() },
      biLetter: `perihal ${NOTICE_TYPE_LABEL[notice.noticeType].toLowerCase()} DTTOT (surat Densus ${notice.policeLetterNumber})`, listNumber: notice.listNumber ?? "—", matched: data.matched,
    }));
  };

  return <Card>
    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
      <div>
        <CardTitle className="text-base">{NOTICE_TYPE_LABEL[notice.noticeType]} · {notice.policeLetterNumber}</CardTitle>
        <p className="text-xs text-slate-600">Diterima {longDayDate(new Date(`${calendarDay(notice.receivedOn)}T12:00:00Z`))}{notice.listNumber ? ` · Lampiran ${notice.listNumber}` : ""}</p>
      </div>
      <Badge variant="outline" className={sentCount === DELIVERIES.length ? "status-approved" : "status-pending"}>{sentCount === DELIVERIES.length ? "Selesai dikirim" : `${sentCount} dari ${DELIVERIES.length} terkirim`}</Badge>
    </CardHeader>
    <CardContent className="space-y-5 text-sm">
      <section>
        <h3 className="font-semibold">1. Saring seluruh nasabah</h3>
        {screened
          ? <p className="mt-1">{shortDate(notice.screenedAt!)} · {notice.screenedCustomerCount} nasabah disaring · {matched ? <b className="text-rose-700">{matched} cocok DTTOT</b> : <b className="text-emerald-700">nihil</b>}</p>
          : <p className="mt-1 text-slate-600">Impor dulu daftar terbaru dari surel BI di halaman Cek Daftar DTTOT/DPPSPM, lalu saring.</p>}
        <Button size="sm" variant="outline" className="mt-2" disabled={screen.isPending} onClick={() => screen.mutate({ noticeId: notice.id })}>{screen.isPending ? "Menyaring…" : screened ? "Saring ulang" : "Saring sekarang"}</Button>
        {matched ? <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-800">Nasabah yang cocok sudah diblokir otomatis. Putuskan di halaman Pemblokiran, dan kirim LTKM ke PPATK paling lama 3 hari kerja.</p> : null}
      </section>

      <section>
        <h3 className="font-semibold">2. Cetak {matched ? "Laporan Pemblokiran + Berita Acara" : "Laporan Nihil"}</h3>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <div><Label htmlFor={`no-${notice.id}`}>Nomor surat</Label><Input id={`no-${notice.id}`} className="mt-1" value={report.reportNumber} onChange={(e) => setReport({ ...report, reportNumber: e.target.value })} placeholder="Mis. 001/DTTOT/XI/2026" /></div>
          <div><Label htmlFor={`ttd-${notice.id}`}>Ditandatangani</Label><Input id={`ttd-${notice.id}`} className="mt-1" value={report.signerName} onChange={(e) => setReport({ ...report, signerName: e.target.value })} placeholder="Nama pimpinan" /></div>
          <div><Label htmlFor={`jab-${notice.id}`}>Jabatan</Label><Input id={`jab-${notice.id}`} className="mt-1" value={report.signerPosition} onChange={(e) => setReport({ ...report, signerPosition: e.target.value })} placeholder="Mis. Direktur" /></div>
          {matched ? <>
            <div><Label htmlFor={`saksi-${notice.id}`}>Saksi</Label><Input id={`saksi-${notice.id}`} className="mt-1" value={witness.name} onChange={(e) => setWitness({ ...witness, name: e.target.value })} placeholder="Nama saksi" /></div>
            <div><Label htmlFor={`jsaksi-${notice.id}`}>Jabatan saksi</Label><Input id={`jsaksi-${notice.id}`} className="mt-1" value={witness.position} onChange={(e) => setWitness({ ...witness, position: e.target.value })} /></div>
          </> : null}
        </div>
        <Button size="sm" className="mt-3" disabled={!screened || !reportReady || saveReport.isPending} onClick={() => void print()}>Cetak laporan</Button>
        {!screened ? <p className="mt-1 text-xs text-slate-600">Bisa dicetak sesudah penyaringan.</p> : null}
      </section>

      <section>
        <h3 className="font-semibold">3. Kirim laporan yang sudah ditandatangani</h3>
        <ul className="mt-2 space-y-2">
          {DELIVERIES.map(({ step, label }) => <li key={step} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <span>{label}</span>
            {notice[step]
              ? <span className="flex items-center gap-2 text-emerald-700">Terkirim {shortDate(notice[step]!)} <Button size="sm" variant="ghost" disabled={delivery.isPending} onClick={() => delivery.mutate({ noticeId: notice.id, step, at: null })}>Batalkan</Button></span>
              : <Button size="sm" variant="outline" disabled={!screened || delivery.isPending} onClick={() => delivery.mutate({ noticeId: notice.id, step, at: new Date() })}>Tandai terkirim</Button>}
          </li>)}
        </ul>
      </section>
    </CardContent>
  </Card>;
}
