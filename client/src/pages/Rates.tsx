import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import { DataTable } from "@/components/patterns/DataTable";
import { PageHeader } from "@/components/patterns/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/PageStates";
import { StatTile } from "@/components/patterns/StatTile";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { operationalActionError } from "@/lib/rateActionError";
import { cellChanged, cellKey, editedValue, filterBoardCells, type BoardCellPayload, type BoardEdits, type BoardFilter, type RateField } from "@shared/rateBoard";
import { RateBoardFooter } from "./rates/RateBoardFooter";
import { RateBoardGrid } from "./rates/RateBoardGrid";
import { RateReferencePanel } from "./rates/RateReferencePanel";
import { RateTierDialog } from "./rates/RateTierDialog";

const FILTERS: { value: BoardFilter; label: string }[] = [
  { value: "SEMUA", label: "Semua" },
  { value: "BERUBAH", label: "Berubah" },
  { value: "TANPA_KURS", label: "Tanpa kurs" },
];
const jam = (value: Date | string) => new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/**
 * Sel yang ikut aktivasi berikutnya: yang disunting berbeda dari kurs aktif, atau yang sudah punya draf
 * tersimpan. Draf hasil "Salin kurs kemarin" sama persis dengan kurs aktif, tetapi tetap harus dapat
 * diaktifkan ulang dengan alasan hari ini — kalau tidak, tombol salin tidak menghasilkan apa-apa.
 */
function readyCells(cells: readonly BoardCellPayload[], edits: BoardEdits) {
  return cells.filter((cell) => cellChanged(cell, edits) || cell.draftRateId !== null);
}

export default function Rates() {
  const utils = trpc.useUtils();
  const board = trpc.rates.board.useQuery();
  const currencies = trpc.currencies.list.useQuery();
  const [edits, setEdits] = useState<BoardEdits>({});
  const [filter, setFilter] = useState<BoardFilter>("SEMUA");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [tierCurrencyId, setTierCurrencyId] = useState<number | null>(null);

  const refresh = () => Promise.all([utils.rates.board.invalidate(), utils.rates.activeRates.invalidate(), utils.rates.comparison.invalidate()]);
  const onError = (error: { message?: string }) => toast.error(operationalActionError(error));
  const saveDrafts = trpc.rates.saveBoardDrafts.useMutation({ onError });
  const activateBoard = trpc.rates.activateBoard.useMutation({ onError });
  const discardDrafts = trpc.rates.discardBoardDrafts.useMutation({
    onSuccess: (result) => { toast.success(`${result.discarded} draf dibuang; kurs yang berlaku tidak berubah.`); setEdits({}); refresh(); },
    onError,
  });
  const copyActive = trpc.rates.copyActiveToDrafts.useMutation({
    onSuccess: (result) => { toast.success(`${result.saved} kurs disalin sebagai draf. Periksa, lalu aktifkan dengan alasan.`); setEdits({}); refresh(); },
    onError,
  });
  const suggest = trpc.rates.suggestFromReference.useMutation({
    onSuccess: (result) => { toast.success(`${result.saved} saran dari referensi BI diisi sebagai draf. Sesuaikan margin sebelum mengaktifkan.`); setEdits({}); refresh(); },
    onError,
  });
  const setCurrencyActive = trpc.currencies.setActive.useMutation({ onError });

  const cells = board.data?.cells ?? [];
  const visibleCells = useMemo(() => filterBoardCells(cells, filter, query, edits), [cells, filter, query, edits]);
  const ready = useMemo(() => readyCells(cells, edits), [cells, edits]);
  const activeCount = cells.filter((cell) => cell.activeRateId !== null).length;
  const lastBatch = board.data?.batchesToday[0];
  const boardCurrencies = useMemo(() => {
    const seen = new Map<number, string>();
    for (const cell of cells) if (!seen.has(cell.currencyId)) seen.set(cell.currencyId, cell.currencyCode);
    return Array.from(seen, ([id, code]) => ({ id, code }));
  }, [cells]);
  const tierCurrency = boardCurrencies.find((item) => item.id === tierCurrencyId) ?? null;
  const busy = saveDrafts.isPending || activateBoard.isPending || discardDrafts.isPending;

  const onEdit = (key: string, field: RateField, value: string) =>
    setEdits((current) => ({ ...current, [key]: { ...current[key], [field]: value.replace(/\s/g, "").replace(",", ".") } }));

  /** Menyimpan suntingan layar sebagai draf. Mengembalikan false bila ada sel setengah terisi atau server menolak. */
  const commitEdits = async (): Promise<boolean> => {
    const edited = cells.filter((cell) => edits[cellKey(cell)] && cellChanged(cell, edits));
    if (!edited.length) return true;
    const incomplete = edited.filter((cell) => !editedValue(cell, edits, "buyRate") || !editedValue(cell, edits, "sellRate"));
    if (incomplete.length) {
      toast.error(`Kurs beli dan jual ${incomplete.map((cell) => `${cell.currencyCode} ${cell.tierLabel}`).join(", ")} harus diisi keduanya sebelum disimpan.`);
      return false;
    }
    try {
      const result = await saveDrafts.mutateAsync({
        cells: edited.map((cell) => ({
          currencyId: cell.currencyId, rateTierId: cell.rateTierId, quoteUnit: cell.quoteUnit,
          buyRate: editedValue(cell, edits, "buyRate"), sellRate: editedValue(cell, edits, "sellRate"),
          referenceSnapshotId: cell.referenceSnapshotId,
        })),
      });
      setEdits({});
      toast.success(`${result.saved} draf kurs disimpan.`);
      return true;
    } catch {
      return false;
    }
  };

  const activate = async () => {
    if (!(await commitEdits())) return;
    // Daftar id diambil dari papan yang baru dimuat ulang, supaya jumlah yang diaktifkan sama dengan yang disebut tombolnya.
    const fresh = await utils.rates.board.fetch();
    const rateIds = readyCells(fresh.cells, {}).map((cell) => cell.draftRateId).filter((id): id is number => id !== null);
    if (!rateIds.length) return toast.error("Tidak ada draf kurs untuk diaktifkan. Isi atau salin kurs lebih dahulu.");
    try {
      const result = await activateBoard.mutateAsync({ rateIds, approvalReason: reason.trim() });
      toast.success(`${result.activated} kurs berlaku sekarang.`);
      setReason("");
    } finally {
      refresh();
    }
  };

  const onCurrencyPicked = async (picked: { id: number; code: string }) => {
    setAddingCurrency(false);
    const known = currencies.data?.find((item) => item.id === picked.id);
    if (known && !known.active) await setCurrencyActive.mutateAsync({ currencyId: picked.id, active: true }).catch(() => undefined);
    await Promise.all([refresh(), utils.currencies.list.invalidate()]);
    toast.success(`${picked.code} ada di papan. Isi kursnya, lalu aktifkan dengan alasan.`);
  };

  const header = (
    <PageHeader
      title="Kurs berapa hari ini?"
      officialLabel="Kurs operasional"
      description="Isi seluruh kurs sekaligus, lalu aktifkan dengan alasan."
      actions={<>
        <Button variant="outline" className={OUTLINE_BUTTON} disabled={copyActive.isPending || busy} onClick={() => copyActive.mutate()}>Salin kurs kemarin</Button>
        <Button variant="outline" className={OUTLINE_BUTTON} disabled={suggest.isPending || busy} onClick={() => suggest.mutate()}>Isi saran dari referensi BI</Button>
        <Button className={BOLD_BUTTON} onClick={() => setAddingCurrency((value) => !value)} aria-expanded={addingCurrency}>+ Tambah valuta</Button>
      </>}
    />
  );

  if (board.isLoading) return <div className="mx-auto max-w-7xl">{header}<LoadingState rows={6} label="Memuat papan kurs" /></div>;
  if (board.isError || !board.data) return <div className="mx-auto max-w-7xl">{header}<ErrorState what="Papan kurs tidak dapat dimuat." nextStep="Periksa sambungan lalu coba lagi." onRetry={() => board.refetch()} /></div>;

  return (
    <div className="mx-auto max-w-7xl">
      {header}
      {addingCurrency ? (
        <div className="mb-4 max-w-md">
          <CurrencyPicker onSelect={onCurrencyPicked} excludeCodes={["IDR", ...boardCurrencies.map((item) => item.code)]} placeholder="Ketik kode atau nama valuta, mis. GBP" />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile tone="brand" label="Berlaku sekarang" value={`${activeCount} kurs`}
          hint={lastBatch ? `Aktivasi terakhir ${jam(lastBatch.approvedAt)} WIB · ${lastBatch.rateCount} kurs` : "Belum ada aktivasi hari ini"} />
        <StatTile tone="second" label="Belum diaktifkan" value={`${ready.length} kurs`} hint={ready.length ? "Periksa lalu aktifkan di bilah bawah" : "Tidak ada perubahan"} />
        <StatTile label="Perlu perhatian" value={`${board.data.alerts.length} peringatan`} hint={board.data.alerts.length ? "Lihat Referensi & pengaturan" : "Referensi tenang"} />
      </div>

      <section className="mt-6" aria-labelledby="riwayat-hari-ini">
        <h2 id="riwayat-hari-ini" className="mb-2 font-heading text-body font-extrabold text-ink">Riwayat hari ini</h2>
        {board.data.batchesToday.length ? (
          <DataTable dense caption="Aktivasi kurs hari ini" rows={board.data.batchesToday} rowKey={(row) => row.batchId} columns={[
            { key: "waktu", header: "Waktu", cell: (row) => `${jam(row.approvedAt)} WIB` },
            { key: "jumlah", header: "Jumlah kurs", align: "right", cell: (row) => row.rateCount },
            { key: "alasan", header: "Alasan", cell: (row) => row.approvalReason ?? "—" },
          ]} />
        ) : <EmptyState title="Belum ada aktivasi kurs hari ini" nextStep="Isi kursnya di papan bawah, lalu aktifkan dengan alasan." />}
      </section>

      <section className="mt-6" aria-labelledby="papan-kurs">
        <h2 id="papan-kurs" className="sr-only">Papan kurs</h2>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Saring papan" className="flex gap-1">
            {FILTERS.map((item) => (
              <Button key={item.value} variant="outline" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}
                className={filter === item.value ? BOLD_BUTTON : OUTLINE_BUTTON}>
                {item.label}
              </Button>
            ))}
          </div>
          <Input aria-label="Cari valuta" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kode atau nama valuta" className={`${QUIET_FIELD} h-control w-64`} />
          <div className="ml-auto w-60">
            <Select value={tierCurrencyId ? String(tierCurrencyId) : ""} onValueChange={(value) => setTierCurrencyId(Number(value))}>
              <SelectTrigger aria-label="Kelola kelompok pecahan" className={QUIET_FIELD}><SelectValue placeholder="Kelola kelompok pecahan…" /></SelectTrigger>
              <SelectContent>{boardCurrencies.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {!cells.length ? (
          <EmptyState title="Belum ada valuta aktif" nextStep="Tambahkan valuta lebih dahulu lewat tombol + Tambah valuta." actionLabel="+ Tambah valuta" onAction={() => setAddingCurrency(true)} />
        ) : visibleCells.length ? (
          <RateBoardGrid cells={visibleCells} edits={edits} onEdit={onEdit} onCommit={() => { void commitEdits().then((ok) => { if (ok) refresh(); }); }} />
        ) : (
          <EmptyState title="Tidak ada baris yang cocok" nextStep="Ubah penyaring atau kosongkan pencarian." actionLabel="Tampilkan semua" onAction={() => { setFilter("SEMUA"); setQuery(""); }} />
        )}
        <p className="mt-2 text-label text-ink-muted">Enter menyimpan draf · ↑/↓ pindah baris · Tab pindah kolom. Draf belum berlaku sampai diaktifkan.</p>

        <RateBoardFooter pendingCount={ready.length} reason={reason} onReasonChange={setReason} isPending={busy}
          onDiscard={() => { setEdits({}); discardDrafts.mutate(); }} onActivate={() => { void activate(); }} />
      </section>

      <RateReferencePanel alerts={board.data.alerts} latestReferenceDate={board.data.latestReferenceDate} />

      {tierCurrency ? (
        <RateTierDialog
          open currencyId={tierCurrency.id} currencyCode={tierCurrency.code}
          tiers={board.data.tiers.filter((tier) => tier.currencyId === tierCurrency.id)}
          activeTierIds={new Set(cells.filter((cell) => cell.currencyId === tierCurrency.id && cell.rateTierId !== null && cell.activeRateId !== null).map((cell) => cell.rateTierId as number))}
          onOpenChange={(next) => { if (!next) setTierCurrencyId(null); }}
        />
      ) : null}
    </div>
  );
}
