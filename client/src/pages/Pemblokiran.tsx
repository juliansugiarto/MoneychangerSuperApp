import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { DEFAULT_OPERATIONAL_TIMEZONE, operationalDateKey, startOfOperationalDay } from "@shared/regulatoryActionQueue";
import { parseMatchKeys } from "@shared/watchlistBlock";
import { AlertTriangle, ChevronDown, ChevronRight, ShieldBan } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Register Pemblokiran — Pasal 47 ayat (1) huruf d PBI 10/2024.
 *
 * Blokir dibuka otomatis pada saat kecocokan (penyaringan atau centang petugas); halaman ini hanya
 * tempat manusia memutuskannya. LTKM dan tembusan BI dikirim di luar aplikasi — yang dicatat di
 * sini rujukannya. Tenggat 3 hari kerja sengaja tidak dihitung sampai kalender hari kerja ada.
 */

type Status = "OPEN" | "CONFIRMED" | "FALSE_POSITIVE" | "DICABUT";

const TABS: { key: Status; label: string }[] = [
  { key: "OPEN", label: "Menunggu keputusan" },
  { key: "CONFIRMED", label: "Dikonfirmasi" },
  { key: "FALSE_POSITIVE", label: "Salah sasaran" },
  { key: "DICABUT", label: "Dicabut" },
];

const SOURCE_LABELS: Record<string, string> = {
  PENYARINGAN: "Penyaringan otomatis",
  PETUGAS: "Centang petugas",
  PENGISIAN_AWAL: "Pengisian awal (migrasi)",
};

type AttemptLine = { currencyId: number; currencyCode: string | null; foreignAmount: string; idrAmount: string };

type DialogKind = "CONFIRM" | "FALSE_POSITIVE" | "REPORT" | "REVOKE";

const formatIdr = (value: string | number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
const formatForeign = (value: string) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value));

function parseLines(value: string): AttemptLine[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Pemblokiran() {
  const utils = trpc.useUtils();
  const timeZone = trpc.companyProfile.get.useQuery().data?.timezone ?? DEFAULT_OPERATIONAL_TIMEZONE;
  const blocks = trpc.watchlistBlocks.list.useQuery();
  const [tab, setTab] = useState<Status>("OPEN");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{ kind: DialogKind; blockId: number; customerName: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [copyDate, setCopyDate] = useState("");

  const formatDateTime = (value: string | Date | null | undefined) =>
    value ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value)) : "—";
  const formatDate = (value: string | Date | null | undefined) =>
    value ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone }).format(new Date(value)) : "—";
  /** Tanggal dari masukan `type="date"` disimpan sebagai awal hari operasional, bukan tengah malam UTC. */
  const dateFromKey = (key: string) => startOfOperationalDay(new Date(`${key}T12:00:00Z`), timeZone);
  const todayKey = operationalDateKey(new Date(), timeZone);

  const done = (message: string) => {
    toast.success(message);
    setDialog(null);
    void utils.watchlistBlocks.list.invalidate();
  };
  const resolve = trpc.watchlistBlocks.resolve.useMutation({ onSuccess: () => done("Keputusan pemblokiran disimpan."), onError: (error) => toast.error(error.message) });
  const recordReporting = trpc.watchlistBlocks.recordReporting.useMutation({ onSuccess: () => done("Pelaporan dicatat."), onError: (error) => toast.error(error.message) });
  const revoke = trpc.watchlistBlocks.revoke.useMutation({ onSuccess: () => done("Pencabutan dicatat."), onError: (error) => toast.error(error.message) });
  const pending = resolve.isPending || recordReporting.isPending || revoke.isPending;

  const openDialog = (kind: DialogKind, block: { id: number; customerName: string; ltkmReference?: string | null }) => {
    setDialog({ kind, blockId: block.id, customerName: block.customerName });
    setNotes("");
    setReference(kind === "REPORT" ? block.ltkmReference ?? "" : "");
    setCopyDate("");
  };

  const submit = () => {
    if (!dialog) return;
    const blockId = dialog.blockId;
    if (dialog.kind === "CONFIRM" || dialog.kind === "FALSE_POSITIVE") {
      if (notes.trim().length < 3) return toast.error("Catatan keputusan wajib diisi.");
      resolve.mutate({
        blockId,
        decision: dialog.kind === "CONFIRM" ? "CONFIRMED" : "FALSE_POSITIVE",
        notes: notes.trim(),
        ltkmReference: dialog.kind === "CONFIRM" ? reference.trim() || null : null,
        biCopySentAt: dialog.kind === "CONFIRM" && copyDate ? dateFromKey(copyDate) : null,
      });
    } else if (dialog.kind === "REPORT") {
      if (reference.trim().length < 3) return toast.error("Rujukan LTKM wajib diisi.");
      if (!copyDate) return toast.error("Tanggal tembusan ke BI wajib diisi.");
      recordReporting.mutate({ blockId, ltkmReference: reference.trim(), biCopySentAt: dateFromKey(copyDate) });
    } else {
      if (reference.trim().length < 3) return toast.error("Rujukan surat pencabutan wajib diisi.");
      if (notes.trim().length < 3) return toast.error("Catatan wajib diisi.");
      revoke.mutate({ blockId, revocationReference: reference.trim(), notes: notes.trim() });
    }
  };

  const rows = blocks.data ?? [];
  const counts = Object.fromEntries(TABS.map((entry) => [entry.key, rows.filter((row) => row.status === entry.key).length])) as Record<Status, number>;
  const visible = rows.filter((row) => row.status === tab);

  const dialogTitle: Record<DialogKind, string> = {
    CONFIRM: "Konfirmasi kecocokan",
    FALSE_POSITIVE: "Nyatakan salah sasaran",
    REPORT: "Catat pelaporan LTKM/tembusan BI",
    REVOKE: "Catat pencabutan oleh otoritas",
  };
  const dialogHint: Record<DialogKind, string> = {
    CONFIRM: "Kecocokan nyata: blokir menjadi permanen dan centang DTTOT/DPPSPM nasabah diset. Laporkan LTKM termasuk percobaan transaksinya.",
    FALSE_POSITIVE: "Bukan orang yang sama. Nasabah lepas untuk kunci kecocokan ini saja; kecocokan baru tetap akan memblokir lagi.",
    REPORT: "LTKM dan tembusan dikirim di luar aplikasi. Yang dicatat di sini rujukan dan tanggalnya.",
    REVOKE: "Hanya atas surat pencabutan dari otoritas yang berwenang.",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section>
        <p className="max-w-3xl text-sm leading-6 text-[#475569]">
          Pemblokiran serta merta atas kecocokan nama DTTOT/DPPSPM (Pasal 47 ayat (1) huruf d PBI 10/2024). Aplikasi tidak
          mengirim LTKM atau tembusan; yang dicatat di sini rujukannya.
        </p>
      </section>

      <Card className="border-[#dce6f0] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><ShieldBan className="size-5 text-[#9a4b4b]" /> Register pemblokiran</CardTitle>
          <CardDescription>Tembusan ke BI paling lambat 3 hari kerja sejak pemblokiran (Pasal 60 ayat (4) huruf d). Tenggatnya belum dihitung aplikasi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Status pemblokiran">
            {TABS.map((entry) => (
              <Button key={entry.key} type="button" role="tab" aria-selected={tab === entry.key} size="sm" variant={tab === entry.key ? "default" : "outline"} onClick={() => setTab(entry.key)}>
                {entry.label}{blocks.data ? ` (${counts[entry.key]})` : ""}
              </Button>
            ))}
          </div>

          {blocks.isPending ? (
            <div className="space-y-2">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-14 w-full" />)}</div>
          ) : blocks.isError ? (
            <div className="rounded-2xl border border-[#f0d6d6] bg-[#fdf6f6] px-5 py-6 text-sm leading-6 text-[#9a4b4b]">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Register pemblokiran belum dapat dimuat.</p>
              <p className="mt-1">{blocks.error.message}</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void blocks.refetch()}>Coba lagi</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm leading-6 text-[#475569]">
              Belum ada pemblokiran. Blokir terbuka otomatis saat penyaringan menemukan kecocokan DTTOT/DPPSPM.
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-8 text-center text-sm text-[#475569]">
              Tidak ada pemblokiran berstatus ini.
            </div>
          ) : (
            <ul className="divide-y divide-[#edf0f5] rounded-xl border border-[#e2eaf2]">
              {visible.map((block) => {
                const keys = parseMatchKeys(block.matchKeys);
                const isOpen = expanded === block.id;
                return (
                  <li key={block.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button type="button" className="flex min-w-0 items-start gap-2 text-left" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : block.id)}>
                        {isOpen ? <ChevronDown className="mt-0.5 size-4 shrink-0 text-[#94a7bb]" /> : <ChevronRight className="mt-0.5 size-4 shrink-0 text-[#94a7bb]" />}
                        <span className="min-w-0">
                          <span className="block font-semibold text-[#18395f]">{block.customerName} <span className="font-normal text-[#94a7bb]">{block.cifNumber ?? ""}</span></span>
                          <span className="block text-xs text-[#475569]">
                            Diblokir {formatDate(block.openedAt)} · {SOURCE_LABELS[block.source] ?? block.source}
                            {keys.length ? ` · ${keys.join(", ")}` : " · kunci kecocokan tidak diketahui"}
                          </span>
                        </span>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={block.attempts.length ? "border-[#f0d6d6] bg-[#fdf6f6] text-[#9a4b4b]" : "border-[#dce6f0] bg-[#f7fafd] text-[#4a6a8f]"}>
                          {block.attempts.length} percobaan transaksi
                        </Badge>
                        {block.status === "OPEN" ? (
                          <>
                            <Button type="button" size="sm" className="bg-[#9a4b4b] hover:bg-[#843e3e]" onClick={() => openDialog("CONFIRM", block)}>Konfirmasi kecocokan</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => openDialog("FALSE_POSITIVE", block)}>Nyatakan salah sasaran</Button>
                          </>
                        ) : block.status === "CONFIRMED" ? (
                          <>
                            <Button type="button" size="sm" variant="outline" onClick={() => openDialog("REPORT", block)}>Catat pelaporan LTKM/tembusan BI</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => openDialog("REVOKE", block)}>Catat pencabutan oleh otoritas</Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {isOpen ? (
                      <div className="mt-3 space-y-3 pl-6 text-sm">
                        {block.status !== "OPEN" ? (
                          <div className="rounded-lg border border-[#e2eaf2] bg-[#fbfdff] px-3 py-2 text-xs leading-5 text-[#475569]">
                            <p>Diputuskan {formatDateTime(block.resolvedAt)}{block.resolutionNotes ? ` — ${block.resolutionNotes}` : ""}</p>
                            {block.status === "CONFIRMED" || block.status === "DICABUT" ? (
                              <p>LTKM: {block.ltkmReference ?? "belum dicatat"} · Tembusan BI: {block.biCopySentAt ? formatDate(block.biCopySentAt) : "belum dicatat"}</p>
                            ) : null}
                            {block.revocationReference ? <p>Surat pencabutan: {block.revocationReference}</p> : null}
                          </div>
                        ) : null}
                        {block.attempts.length === 0 ? (
                          <p className="text-xs text-[#94a7bb]">Belum ada percobaan transaksi sejak pemblokiran.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[560px] text-left text-xs">
                              <thead className="tracking-[0.12em] text-[#94a7bb] uppercase">
                                <tr><th className="py-2 pr-3">Waktu</th><th className="py-2 pr-3">Jenis</th><th className="py-2 pr-3">Pihak</th><th className="py-2 pr-3">Rincian</th><th className="py-2 pr-3 text-right">Total</th></tr>
                              </thead>
                              <tbody className="divide-y divide-[#edf0f5]">
                                {block.attempts.map((attempt) => (
                                  <tr key={attempt.id} className="align-top">
                                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(attempt.attemptedAt)}</td>
                                    <td className="py-2 pr-3">{attempt.operation === "BUY" ? "Beli" : "Jual"}</td>
                                    <td className="py-2 pr-3">{attempt.blockedParty === "KUASA" ? "Kuasa/wakil" : "Nasabah"}</td>
                                    <td className="py-2 pr-3">
                                      {parseLines(attempt.linesSummary).map((line, index) => (
                                        <span key={index} className="block">{line.currencyCode ?? `valuta #${line.currencyId}`} {formatForeign(line.foreignAmount)} = {formatIdr(line.idrAmount)}</span>
                                      ))}
                                    </td>
                                    <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap">{formatIdr(attempt.totalIdr)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(dialog)} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          {dialog ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-[#18395f]">{dialogTitle[dialog.kind]}</DialogTitle>
                <DialogDescription>{dialog.customerName} — {dialogHint[dialog.kind]}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {dialog.kind !== "FALSE_POSITIVE" ? (
                  <div>
                    <Label htmlFor="block-reference" className="text-xs">
                      {dialog.kind === "REVOKE" ? "Rujukan surat pencabutan (wajib)" : dialog.kind === "REPORT" ? "Rujukan LTKM (wajib)" : "Rujukan LTKM (boleh diisi nanti)"}
                    </Label>
                    <Input id="block-reference" className="mt-1" maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} />
                  </div>
                ) : null}
                {dialog.kind === "CONFIRM" || dialog.kind === "REPORT" ? (
                  <div>
                    <Label htmlFor="block-copy-date" className="text-xs">{dialog.kind === "REPORT" ? "Tanggal tembusan ke BI (wajib)" : "Tanggal tembusan ke BI (boleh diisi nanti)"}</Label>
                    <Input id="block-copy-date" type="date" className="mt-1 w-48" max={todayKey} value={copyDate} onChange={(event) => setCopyDate(event.target.value)} />
                  </div>
                ) : null}
                {dialog.kind !== "REPORT" ? (
                  <div>
                    <Label htmlFor="block-notes" className="text-xs">Catatan keputusan (wajib)</Label>
                    <Textarea id="block-notes" className="mt-1" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: tanggal lahir dan NIK dibandingkan dengan entri daftar." />
                    <p className="mt-1 text-xs text-[#94a7bb]">Tercatat pada jejak audit.</p>
                  </div>
                ) : null}
                <Button type="button" className="w-full bg-[#183f70]" disabled={pending} onClick={submit}>
                  {pending ? "Menyimpan…" : dialogTitle[dialog.kind]}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
