import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/patterns/DataTable";
import { EmptyState } from "@/components/patterns/PageStates";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { trpc } from "@/lib/trpc";
import { operationalActionError } from "@/lib/rateActionError";

const waktu = (value: Date | string) => new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const tanggal = (value: Date | string) => new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const persen = (value: string | null) => (value === null ? "—" : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value))}%`);

function Bagian({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-[0.75rem] border-2 border-ink bg-surface-raised p-4">
      <div>
        <h3 className="font-heading text-body font-extrabold text-ink">{title}</h3>
        {description ? <p className="mt-0.5 max-w-3xl text-label text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="text-label font-bold uppercase tracking-wide text-ink-muted">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * "Referensi & pengaturan" — isi halaman Kurs lama yang bukan papan: sinkronisasi BI, peringatan,
 * pembanding pasar, ambang, dan status valuta. Dipindahkan, bukan dibuang; tertutup secara bawaan
 * supaya papan menjadi hal pertama yang dilihat.
 */
export function RateReferencePanel({ alerts, latestReferenceDate }: {
  alerts: readonly { id: number; currencyCode: string; message: string }[];
  latestReferenceDate: Date | string | null;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const enabled = Boolean(user) && open;
  const syncStatus = trpc.rates.syncStatus.useQuery(undefined, { enabled });
  const comparison = trpc.rates.comparison.useQuery(undefined, { enabled });
  const observations = trpc.rates.marketObservations.useQuery(undefined, { enabled });
  const currencies = trpc.currencies.list.useQuery(undefined, { enabled });
  const settings = trpc.settings.reviewThreshold.useQuery(undefined, { enabled });

  const [alertNotes, setAlertNotes] = useState<Record<number, string>>({});
  const [observation, setObservation] = useState({ currencyId: "", source: "VIP Money Changer", url: "https://www.vip.co.id/", buyRate: "", sellRate: "" });
  const [threshold, setThreshold] = useState({ reviewThresholdUsd: "", eddCashDailyThresholdIdr: "", rateShockThresholdPercent: "", rateDeviationTolerancePercent: "" });

  useEffect(() => {
    const data = settings.data;
    if (!data) return;
    setThreshold((current) => ({
      reviewThresholdUsd: current.reviewThresholdUsd || String(data.reviewThresholdUsd),
      eddCashDailyThresholdIdr: current.eddCashDailyThresholdIdr || String(data.eddCashDailyThresholdIdr),
      rateShockThresholdPercent: current.rateShockThresholdPercent || String(data.rateShockThresholdPercent),
      rateDeviationTolerancePercent: current.rateDeviationTolerancePercent || String(data.rateDeviationTolerancePercent),
    }));
  }, [settings.data]);

  const sync = trpc.rates.syncNow.useMutation({
    onSuccess: (result) => { toast.success(`Sinkronisasi selesai: ${result.inserted} snapshot baru.`); utils.rates.board.invalidate(); utils.rates.comparison.invalidate(); },
    onError: (error) => toast.error(operationalActionError(error)),
    onSettled: () => utils.rates.syncStatus.invalidate(),
  });
  const resolveAlert = trpc.rates.resolveVolatilityAlert.useMutation({
    onSuccess: () => { toast.success("Peringatan kurs ditandai sudah ditinjau."); utils.rates.board.invalidate(); },
    onError: (error) => toast.error(operationalActionError(error)),
  });
  const recordObservation = trpc.rates.recordObservation.useMutation({
    onSuccess: (result) => {
      toast.success(result.alert ? "Observasi tersimpan dan peringatan perubahan kurs dibuat." : "Observasi pembanding tersimpan.");
      setObservation((current) => ({ ...current, buyRate: "", sellRate: "" }));
      utils.rates.marketObservations.invalidate(); utils.rates.comparison.invalidate(); utils.rates.board.invalidate();
    },
    onError: (error) => toast.error(operationalActionError(error)),
  });
  const updateThreshold = trpc.settings.updateReviewThreshold.useMutation({
    onSuccess: (result) => { toast.success(`Ambang diperbarui; toleransi selisih harga bon ±${result.rateDeviationTolerancePercent}%.`); utils.settings.reviewThreshold.invalidate(); },
    onError: (error) => toast.error(operationalActionError(error)),
  });
  const setCurrencyActive = trpc.currencies.setActive.useMutation({
    onSuccess: () => { toast.success("Status valuta diperbarui."); utils.currencies.list.invalidate(); utils.rates.board.invalidate(); },
    onError: (error) => toast.error(operationalActionError(error)),
  });

  const latestObservations = useMemo(() => {
    const seen = new Set<string>();
    return (observations.data ?? []).filter(({ observation: row }) => {
      const key = `${row.currencyId}:${row.sourceName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [observations.data]);

  const submitObservation = (event: FormEvent) => {
    event.preventDefault();
    const currency = currencies.data?.find((item) => String(item.id) === observation.currencyId);
    if (!currency) return toast.error("Pilih valuta untuk observasi pembanding.");
    recordObservation.mutate({ currencyCode: currency.code, sourceName: observation.source, sourceKind: "MARKET", sourceUrl: observation.url || undefined, quoteUnit: "1", buyRate: observation.buyRate, sellRate: observation.sellRate, observedAt: new Date(), notes: "Observasi pembanding pasar; bukan kurs outlet." });
  };

  const thresholdFilled = Object.values(threshold).every((value) => value.trim() !== "");

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className={`${OUTLINE_BUTTON} w-full justify-between`}>
          <span>Referensi &amp; pengaturan{alerts.length ? ` · ${alerts.length} peringatan` : ""}</span>
          <ChevronDown className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4">
        <Bagian title="Sinkronisasi referensi BI" description="Snapshot BI hanya menjadi saran. Kurs outlet tetap diaktifkan manusia dengan alasan.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-body text-ink">
              <p>{syncStatus.data?.lastSuccessfulAt ? `Snapshot terakhir tersimpan ${waktu(syncStatus.data.lastSuccessfulAt)}.` : "Belum ada snapshot BI tersimpan."}</p>
              {latestReferenceDate ? <p className="text-label text-ink-muted">Tanggal referensi terbaru: {tanggal(latestReferenceDate)}</p> : null}
              {syncStatus.data?.lastError ? <p className="mt-1 max-w-3xl text-label font-semibold text-ink"><span className="bg-warning-soft px-1">Perlu ditinjau:</span> {syncStatus.data.lastError} Snapshot sebelumnya tetap dipakai; sistem tidak menggantinya dengan perkiraan.</p> : null}
            </div>
            <Button variant="outline" className={OUTLINE_BUTTON} disabled={sync.isPending} onClick={() => sync.mutate()}>
              <RefreshCw className={`mr-2 size-4 ${sync.isPending ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden /> Sinkronkan sekarang
            </Button>
          </div>
        </Bagian>

        <Bagian title="Peringatan perubahan kurs" description="Peringatan tidak mengubah kurs apa pun. Tandai sudah ditinjau dengan catatan singkat.">
          {alerts.length ? alerts.map((alert) => (
            <div key={alert.id} className="flex flex-wrap items-end gap-2 rounded-lg bg-warning-soft p-3">
              <p className="min-w-60 flex-1 text-body text-ink"><b>{alert.currencyCode}</b> · {alert.message}</p>
              <Input aria-label={`Catatan peninjauan ${alert.currencyCode}`} value={alertNotes[alert.id] ?? ""} onChange={(event) => setAlertNotes({ ...alertNotes, [alert.id]: event.target.value })}
                className={`${QUIET_FIELD} w-64`} placeholder="Catatan peninjauan" />
              <Button variant="outline" className={OUTLINE_BUTTON} disabled={resolveAlert.isPending || (alertNotes[alert.id] ?? "").trim().length < 3}
                onClick={() => resolveAlert.mutate({ alertId: alert.id, notes: (alertNotes[alert.id] ?? "").trim() })}>
                Tandai ditinjau
              </Button>
            </div>
          )) : <p className="text-body text-ink-muted">Tidak ada peringatan terbuka.</p>}
        </Bagian>

        <Bagian title="Pembanding kurs" description="Selisih nilai tengah kurs outlet terhadap BI, JISDOR, dan pembanding pasar.">
          {comparison.data?.length ? (
            <DataTable dense caption="Pembanding kurs outlet" rows={comparison.data} rowKey={(row) => String(row.currency.id)} columns={[
              { key: "valuta", header: "Valuta", cell: (row) => <b>{row.currency.code}</b> },
              { key: "bi", header: "vs BI", align: "right", cell: (row) => persen(row.differences.versusBiPercent) },
              { key: "jisdor", header: "vs JISDOR", align: "right", cell: (row) => persen(row.differences.versusJisdorPercent) },
              { key: "pasar", header: "vs pasar", align: "right", cell: (row) => persen(row.differences.versusMarketPercent) },
            ]} />
          ) : <EmptyState title="Belum ada kurs aktif untuk dibandingkan" nextStep="Aktifkan kurs di papan lebih dahulu." />}
          <Link href="/operasional/perbandingan-kurs" className="text-label font-bold text-ink underline underline-offset-2">Buka perbandingan kurs lengkap</Link>
        </Bagian>

        <Bagian title="Pembanding pasar" description="Kurs indikatif dari sumber luar yang sudah diperiksa petugas. Tidak pernah menjadi kurs outlet otomatis.">
          <form className="grid gap-3 md:grid-cols-[160px_1fr_1fr_140px_140px_auto] md:items-end" onSubmit={submitObservation}>
            <Field id="obs-valuta" label="Valuta">
              <Select value={observation.currencyId} onValueChange={(value) => setObservation({ ...observation, currencyId: value })}>
                <SelectTrigger id="obs-valuta" className={QUIET_FIELD}><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{currencies.data?.filter((item) => item.active && item.code !== "IDR").map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.code} — {item.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field id="obs-sumber" label="Sumber"><Input id="obs-sumber" className={QUIET_FIELD} value={observation.source} onChange={(event) => setObservation({ ...observation, source: event.target.value })} /></Field>
            <Field id="obs-url" label="URL (opsional)"><Input id="obs-url" className={QUIET_FIELD} value={observation.url} onChange={(event) => setObservation({ ...observation, url: event.target.value })} /></Field>
            <Field id="obs-beli" label="Beli"><Input id="obs-beli" inputMode="decimal" className={`${QUIET_FIELD} text-right tabular-nums`} value={observation.buyRate} onChange={(event) => setObservation({ ...observation, buyRate: event.target.value })} /></Field>
            <Field id="obs-jual" label="Jual"><Input id="obs-jual" inputMode="decimal" className={`${QUIET_FIELD} text-right tabular-nums`} value={observation.sellRate} onChange={(event) => setObservation({ ...observation, sellRate: event.target.value })} /></Field>
            <Button type="submit" className={BOLD_BUTTON} disabled={!observation.currencyId || !observation.source || !observation.buyRate || !observation.sellRate || recordObservation.isPending}>Simpan</Button>
          </form>
          {latestObservations.length ? (
            <DataTable dense caption="Observasi terbaru per sumber" rows={latestObservations} rowKey={(row) => String(row.observation.id)} columns={[
              { key: "sumber", header: "Sumber", cell: (row) => <>{row.observation.sourceName}<span className="block text-label text-ink-muted">{row.observation.sourceKind === "OFFICIAL" ? "Referensi resmi" : "Pembanding pasar"}</span></> },
              { key: "valuta", header: "Valuta", cell: (row) => <b>{row.currency.code}</b> },
              { key: "beli", header: "Beli", align: "right", cell: (row) => String(row.observation.buyRate) },
              { key: "jual", header: "Jual", align: "right", cell: (row) => String(row.observation.sellRate) },
              { key: "waktu", header: "Waktu", cell: (row) => waktu(row.observation.observedAt) },
            ]} />
          ) : <p className="text-body text-ink-muted">Belum ada observasi pembanding.</p>}
        </Bagian>

        <Bagian title="Ambang dan toleransi" description="Ambang tinjauan transaksi, EDD tunai, perubahan referensi, dan batas selisih harga bon terhadap kurs papan.">
          <div className="grid gap-3 md:grid-cols-4">
            <Field id="ambang-usd" label="Ambang tinjauan (USD)"><Input id="ambang-usd" inputMode="decimal" className={`${QUIET_FIELD} text-right tabular-nums`} value={threshold.reviewThresholdUsd} onChange={(event) => setThreshold({ ...threshold, reviewThresholdUsd: event.target.value })} /></Field>
            <Field id="ambang-edd" label="EDD tunai harian (Rp)"><Input id="ambang-edd" inputMode="decimal" className={`${QUIET_FIELD} text-right tabular-nums`} value={threshold.eddCashDailyThresholdIdr} onChange={(event) => setThreshold({ ...threshold, eddCashDailyThresholdIdr: event.target.value })} /></Field>
            <Field id="ambang-kurs" label="Perubahan referensi (%)"><Input id="ambang-kurs" inputMode="decimal" className={`${QUIET_FIELD} text-right tabular-nums`} value={threshold.rateShockThresholdPercent} onChange={(event) => setThreshold({ ...threshold, rateShockThresholdPercent: event.target.value })} /></Field>
            <Field id="toleransi-bon" label="Toleransi selisih harga bon (%)"><Input id="toleransi-bon" inputMode="decimal" className={`${QUIET_FIELD} text-right tabular-nums`} value={threshold.rateDeviationTolerancePercent} onChange={(event) => setThreshold({ ...threshold, rateDeviationTolerancePercent: event.target.value })} /></Field>
          </div>
          <Button className={BOLD_BUTTON} disabled={!thresholdFilled || updateThreshold.isPending} onClick={() => updateThreshold.mutate(threshold)}>Simpan ambang</Button>
        </Bagian>

        <Bagian title="Status valuta" description="Valuta nonaktif hilang dari papan dan bon baru; riwayatnya tetap utuh.">
          {currencies.data?.length ? (
            <DataTable dense caption="Status valuta" rows={currencies.data.filter((item) => item.code !== "IDR")} rowKey={(row) => String(row.id)} columns={[
              { key: "kode", header: "Kode", cell: (row) => <b>{row.code}</b> },
              { key: "nama", header: "Nama", cell: (row) => row.name },
              { key: "status", header: "Status", cell: (row) => (row.active ? "Aktif" : "Nonaktif") },
              { key: "aksi", header: "Tindakan", align: "right", cell: (row) => (
                <Button variant="outline" className={OUTLINE_BUTTON} disabled={setCurrencyActive.isPending} onClick={() => setCurrencyActive.mutate({ currencyId: row.id, active: !row.active })}>
                  {row.active ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              ) },
            ]} />
          ) : <p className="text-body text-ink-muted">Belum ada valuta tersimpan.</p>}
        </Bagian>
      </CollapsibleContent>
    </Collapsible>
  );
}
