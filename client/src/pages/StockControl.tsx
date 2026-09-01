import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyPicker, PickedCurrency } from "@/components/CurrencyPicker";
import { DenominationValueInput } from "@/components/DenominationValueInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPlainAmount } from "@/lib/money";
import { trpc } from "@/lib/trpc";
import { Banknote, CheckCircle2, CircleAlert, ClipboardCheck, Plus, RefreshCw, ScanLine, ShieldCheck, Vault, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type DenominationRow = { value: string; quantity: string };
const emptyRow = (): DenominationRow => ({ value: "", quantity: "" });

/** Which context is currently visible, decided once from the URL path so every "Kas & Persediaan" link keeps working — switching between them afterward is pure client state, no page navigation, per the "satu halaman, breadcrumb" ask. */
function initialTab(): "kas-awal" | "saat-ini" | "opname" | "penyesuaian" {
  const path = window.location.pathname;
  if (path.includes("saat-ini")) return "saat-ini";
  if (path.includes("opname")) return "opname";
  if (path.includes("penyesuaian")) return "penyesuaian";
  return "kas-awal";
}

export default function StockControl() {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab());
  const canSeePenyesuaian = user?.role !== "STAFF" && user?.role !== "ADMIN";

  return <div className="mx-auto max-w-5xl space-y-6">
    <header>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#5c8f53]"><Wallet className="size-4" /> Kontrol kas harian</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-[#18395f]">Kas &amp; persediaan</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#334155]">Kas awal, stok saat ini, stock opname, dan penyesuaian brankas — semua di sini, pindah lewat tab tanpa ganti halaman.</p>
    </header>
    <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
      <TabsList className="h-auto w-full flex-wrap gap-1.5 rounded-2xl border-2 border-[#183f70]/15 bg-[#eef3f9] p-1.5">
        <TabsTrigger value="kas-awal" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white data-[state=active]:shadow-md"><Banknote className="mr-1.5 size-4" />Kas Awal</TabsTrigger>
        <TabsTrigger value="saat-ini" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white data-[state=active]:shadow-md"><Wallet className="mr-1.5 size-4" />Stok Saat Ini</TabsTrigger>
        <TabsTrigger value="opname" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white data-[state=active]:shadow-md"><ClipboardCheck className="mr-1.5 size-4" />Stock Opname</TabsTrigger>
        {canSeePenyesuaian ? <TabsTrigger value="penyesuaian" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white data-[state=active]:shadow-md"><Vault className="mr-1.5 size-4" />Penyesuaian Brankas</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="kas-awal" className="mt-5"><KasAwalPanel /></TabsContent>
      <TabsContent value="saat-ini" className="mt-5"><StokSaatIniPanel /></TabsContent>
      <TabsContent value="opname" className="mt-5"><StockOpnamePanel /></TabsContent>
      {canSeePenyesuaian ? <TabsContent value="penyesuaian" className="mt-5"><PenyesuaianPanel /></TabsContent> : null}
    </Tabs>
  </div>;
}

function KasAwalPanel() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedCurrency, setSelectedCurrency] = useState<PickedCurrency | null>(null);
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [denominations, setDenominations] = useState<DenominationRow[]>([emptyRow()]);
  const { data: balances } = trpc.cash.balances.useQuery(undefined, { enabled: Boolean(user) });

  const addRow = () => setDenominations((rows) => [...rows, emptyRow()]);
  const updateRow = (index: number, field: keyof DenominationRow, value: string) => setDenominations((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const removeRow = (index: number) => setDenominations((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  const total = denominations.reduce((sum, row) => sum + (Number(row.value) || 0) * (Number(row.quantity) || 0), 0);
  const mismatch = Boolean(openingAmount) && Math.abs(total - Number(openingAmount)) > 0.005;
  const isComplete = denominations.length > 0 && denominations.every((row) => row.value && row.quantity);

  const opening = trpc.cash.recordOpening.useMutation({
    onSuccess: ({ currencyCode, openingAmount: amount }) => {
      toast.success(`Kas awal ${currencyCode} sebesar ${formatPlainAmount(amount)} berhasil dicatat, termasuk rincian pecahannya.`);
      setOpeningAmount(""); setOpeningNotes(""); setDenominations([emptyRow()]); setSelectedCurrency(null);
      utils.cash.balances.invalidate(); utils.cash.denominationBalances.invalidate(); utils.dashboard.overview.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = () => {
    if (!selectedCurrency) return toast.error("Pilih mata uang.");
    if (!openingAmount) return toast.error("Isi jumlah kas fisik pembukaan.");
    if (!isComplete) return toast.error("Rincian pecahan wajib diisi — ini jadi stok pecahan awal sistem.");
    if (mismatch) return toast.error("Total rincian pecahan belum sama dengan jumlah kas fisik.");
    opening.mutate({ currencyId: selectedCurrency.id, openingAmount, notes: openingNotes || undefined, denominations: denominations.map((row) => ({ value: row.value, quantity: Number(row.quantity) })) });
  };

  return <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Catat kas awal</CardTitle><CardDescription>Masukkan jumlah fisik yang benar-benar diterima, termasuk rincian pecahan (wajib). Nilai ini menggantikan saldo sistem dan dicatat sebagai penyesuaian teraudit.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Mata uang</Label>
          {selectedCurrency ? <p className="mt-1 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span>Dipilih: {selectedCurrency.code} — {selectedCurrency.name}</span><button type="button" className="font-semibold text-emerald-900 underline" onClick={() => setSelectedCurrency(null)}>Ganti</button></p> : <div className="mt-1"><CurrencyPicker onSelect={setSelectedCurrency} /></div>}
        </div>
        <div><Label className="text-xs">Jumlah kas fisik pembukaan</Label><Input className="mt-1" inputMode="decimal" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} placeholder="Contoh: 2500" /></div>
        <div><Label className="text-xs">Catatan (opsional)</Label><Input className="mt-1" value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} placeholder="Contoh: Kas awal teller pagi" /></div>
        <div className="rounded-xl border border-[#cbd9e7] bg-[#f8fbfe] p-3">
          <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-[#18395f]">Rincian pecahan (wajib)</Label><Button type="button" size="sm" variant="outline" className="h-7 border-[#bcd2e5] text-xs text-[#183f70]" onClick={addRow}><Plus className="mr-1 size-3" />Tambah pecahan</Button></div>
          {denominations.map((row, index) => <div key={index} className="mt-2 grid grid-cols-[1fr_100px_auto] items-start gap-2">
            <DenominationValueInput currencyCode={selectedCurrency?.code} value={row.value} onChange={(value) => updateRow(index, "value", value)} />
            <Input required inputMode="numeric" value={row.quantity} onChange={(event) => updateRow(index, "quantity", event.target.value)} placeholder="Lembar" />
            <Button type="button" size="sm" variant="ghost" className="text-rose-600" disabled={denominations.length === 1} onClick={() => removeRow(index)}>Hapus</Button>
          </div>)}
          <p className={`mt-2 text-xs ${mismatch ? "font-semibold text-rose-600" : "text-[#475569]"}`}>Total rincian: {formatPlainAmount(total)} {mismatch ? "— belum sama dengan jumlah kas fisik di atas" : "— sudah sama dengan jumlah kas fisik"}</p>
        </div>
        <Button disabled={!selectedCurrency || !openingAmount || !isComplete || mismatch || opening.isPending} onClick={submit} className="press-scale w-full bg-[#183f70] text-white hover:bg-[#12345d]">{opening.isPending ? "Mencatat…" : "Catat kas awal"}</Button>
      </CardContent>
    </Card>
    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Saldo sistem saat ini</CardTitle></CardHeader>
      <CardContent><div className="space-y-2">{balances?.length ? balances.map(({ balance, currency }) => <div key={balance.id} className="flex justify-between rounded-xl bg-[#f6fafc] px-3 py-2 text-sm"><span className="font-semibold text-[#18395f]">{currency.code}</span><span className="font-mono font-semibold text-[#334155]">{formatPlainAmount(balance.availableAmount)}</span></div>) : <p className="text-sm text-[#475569]">Belum ada saldo kas tercatat.</p>}</div></CardContent>
    </Card>
  </div>;
}

function StokSaatIniPanel() {
  const { user } = useAuth();
  const balancesQuery = trpc.cash.balances.useQuery(undefined, { enabled: Boolean(user) });
  const denominationBalancesQuery = trpc.cash.denominationBalances.useQuery(undefined, { enabled: Boolean(user) });
  const balances = balancesQuery.data, denominationBalances = denominationBalancesQuery.data;
  const refreshAll = () => Promise.all([balancesQuery.refetch(), denominationBalancesQuery.refetch()]);

  const denominationsByCurrency = useMemo(() => {
    const grouped = new Map<string, typeof denominationBalances>();
    for (const row of denominationBalances ?? []) {
      const existing = grouped.get(row.currency.code) ?? [];
      existing.push(row);
      grouped.set(row.currency.code, existing);
    }
    return grouped;
  }, [denominationBalances]);

  return <div className="space-y-6">
    <div className="flex justify-end"><Button variant="outline" className="border-[#d8e5ef]" onClick={refreshAll}><RefreshCw className="mr-2 size-4" /> Muat ulang</Button></div>
    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Saldo per mata uang</CardTitle><CardDescription>Bertambah/berkurang otomatis saat kas awal, penyesuaian brankas, dan bon yang diselesaikan. Cocokkan dengan hitung fisik hanya saat Stock Opname penutupan.</CardDescription></CardHeader>
      <CardContent><div className="grid gap-3 sm:grid-cols-2">{balances?.length ? balances.map(({ balance, currency }) => <div key={balance.id} className="flex items-center justify-between rounded-xl border-2 border-[#d3e2f0] bg-white px-4 py-3"><span className="rounded-lg bg-[#183f70] px-2.5 py-1 text-xs font-extrabold tracking-wide text-white">{currency.code}</span><span className="font-mono text-lg font-extrabold text-[#18395f]">{formatPlainAmount(balance.availableAmount)}</span></div>) : <p className="text-sm text-[#475569]">Belum ada saldo kas. Catat kas awal terlebih dahulu.</p>}</div></CardContent>
    </Card>
    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Stok pecahan per mata uang</CardTitle><CardDescription>Setiap pecahan wajib tercatat — dari kas awal, penyesuaian brankas, maupun kedua sisi bon (valuta asing dan Rupiah) yang sudah diselesaikan.</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        {denominationsByCurrency.size ? Array.from(denominationsByCurrency.entries()).map(([code, rows]) => <div key={code} className="overflow-hidden rounded-xl border-2 border-[#d3e2f0]">
          <p className="bg-[#183f70] px-4 py-2 text-xs font-extrabold tracking-[0.12em] text-white uppercase">{code}</p>
          <div className="divide-y divide-[#e2eaf2]">{rows?.map(({ balance }) => <div key={balance.id} className="flex items-center justify-between bg-white px-4 py-2.5 text-sm odd:bg-[#f8fbfe]"><span className="font-mono text-base font-bold text-[#18395f]">{formatPlainAmount(balance.denominationValue)}</span><span className="font-mono text-base font-bold text-[#334155]">{formatPlainAmount(balance.quantity)} lembar/keping</span></div>)}</div>
        </div>) : <p className="text-sm text-[#475569]">Belum ada rincian pecahan tercatat. Catat kas awal dengan rincian pecahan untuk memulai.</p>}
      </CardContent>
    </Card>
  </div>;
}

function StockOpnamePanel() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedCurrency, setSelectedCurrency] = useState<PickedCurrency | null>(null);
  const [physical, setPhysical] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const opnamesQuery = trpc.stockOpname.list.useQuery(undefined, { enabled: Boolean(user) });
  const opnames = opnamesQuery.data;
  const refreshAll = () => Promise.all([opnamesQuery.refetch(), utils.dashboard.overview.invalidate()]);
  const open = trpc.stockOpname.open.useMutation({ onSuccess: () => { toast.success("Hitung stok dibuka. Saldo sistem sudah dikunci sebagai saldo awal."); setSelectedCurrency(null); refreshAll(); }, onError: (error) => toast.error(error.message) });
  const submit = trpc.stockOpname.submit.useMutation({ onSuccess: () => { toast.success("Hasil hitung akhir dikirim untuk diperiksa."); refreshAll(); }, onError: (error) => toast.error(error.message) });
  const reconcile = trpc.stockOpname.reconcile.useMutation({ onSuccess: () => { toast.success("Hasil hitung stok telah direkonsiliasi."); refreshAll(); }, onError: (error) => toast.error(error.message) });
  const canReconcile = user?.role !== "STAFF";
  const hasLoadError = opnamesQuery.isError;

  return <div className="space-y-4">
    <div className="flex justify-end"><Button variant="outline" className="border-[#d8e5ef]" onClick={refreshAll}><RefreshCw className="mr-2 size-4" /> Muat ulang</Button></div>
    {hasLoadError ? <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Data stock opname belum dapat dimuat.</p><p className="mt-1 text-xs">Tidak ada data yang berubah. Periksa koneksi lalu muat ulang beberapa saat lagi.</p></div><Button size="sm" variant="outline" onClick={refreshAll}>Coba lagi</Button></div> : null}
    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><ScanLine className="size-5 text-[#5c8f53]" /> Buka, hitung, dan periksa</CardTitle><CardDescription>Buka hitungan setelah kas awal tercatat. Saat tutup toko, masukkan jumlah fisik; selisih akan terlihat jelas untuk diperiksa. Cek fisik hanya dilakukan sekali di sini, bukan sepanjang hari.</CardDescription></CardHeader>
      <CardContent>
        <div className="rounded-xl border border-[#dce6f0] bg-[#fbfdff] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label className="text-xs">Mata uang untuk hitung stok</Label>
              {selectedCurrency ? <p className="mt-1 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span>Dipilih: {selectedCurrency.code} — {selectedCurrency.name}</span><button type="button" className="font-semibold text-emerald-900 underline" onClick={() => setSelectedCurrency(null)}>Ganti</button></p> : <div className="mt-1"><CurrencyPicker onSelect={setSelectedCurrency} /></div>}
            </div>
            <Button disabled={!selectedCurrency || open.isPending} onClick={() => open.mutate({ currencyId: selectedCurrency!.id })} className="bg-[#183f70] text-white hover:bg-[#12345d]"><ScanLine className="mr-2 size-4" /> Buka hitungan stok</Button>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {opnames?.length ? opnames.map(({ opname, currency }) => <div key={opname.id} className="rounded-2xl border border-[#e2eaf2] bg-[#fbfdff] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold text-[#18395f]">{currency.code} · {new Date(opname.opnameDate).toLocaleDateString("id-ID")}</p><p className="mt-1 text-xs text-[#334155]">Saldo sistem: {formatPlainAmount(opname.closingSystemBalance)} · Fisik: {opname.physicalBalance ? formatPlainAmount(opname.physicalBalance) : "belum dihitung"} · Selisih: {opname.variance ? formatPlainAmount(opname.variance) : "belum ada"}</p></div>
              <Badge className={opname.reconciliationStatus === "VARIANCE" ? "status-rejected" : opname.reconciliationStatus === "RECONCILED" ? "status-approved" : "status-pending"}>{opname.reconciliationStatus === "OPEN" ? "MENUNGGU HITUNG" : opname.reconciliationStatus === "SUBMITTED" ? "MENUNGGU PERIKSA" : opname.reconciliationStatus}</Badge>
            </div>
            {opname.reconciliationStatus === "OPEN" ? <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div><Label className="text-xs">Kas fisik saat tutup</Label><Input inputMode="decimal" value={physical[opname.id] ?? ""} onChange={(event) => setPhysical({ ...physical, [opname.id]: event.target.value })} placeholder="0" /></div>
              <div><Label className="text-xs">Catatan bila ada selisih</Label><Input value={notes[opname.id] ?? ""} onChange={(event) => setNotes({ ...notes, [opname.id]: event.target.value })} placeholder="Contoh: Perbedaan hitung pecahan" /></div>
              <Button className="self-end bg-[#183f70] text-white hover:bg-[#12345d]" disabled={!physical[opname.id] || submit.isPending} onClick={() => submit.mutate({ stockOpnameId: opname.id, physicalBalance: physical[opname.id], varianceNotes: notes[opname.id] || undefined })}>Kirim hasil hitung</Button>
            </div> : null}
            {opname.reconciliationStatus === "SUBMITTED" && canReconcile ? <div className="mt-4 flex flex-wrap gap-3"><Input className="flex-1" value={notes[opname.id] ?? ""} onChange={(event) => setNotes({ ...notes, [opname.id]: event.target.value })} placeholder="Catatan pemeriksaan Admin" /><Button disabled={(notes[opname.id] ?? "").trim().length < 3 || reconcile.isPending} onClick={() => reconcile.mutate({ stockOpnameId: opname.id, notes: notes[opname.id] })}><ShieldCheck className="mr-2 size-4" /> Selesaikan pemeriksaan</Button></div> : null}
            {opname.reconciliationStatus === "RECONCILED" ? <p className="mt-3 flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="size-4" /> Hitungan telah sesuai dan selesai diperiksa.</p> : null}
            {opname.reconciliationStatus === "VARIANCE" ? <p className="mt-3 flex items-center gap-2 text-xs text-rose-700"><CircleAlert className="size-4" /> Ada selisih; tindak lanjuti sesuai prosedur sebelum penutupan final.</p> : null}
          </div>) : <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm leading-6 text-[#475569]">Mulai dari <strong>Kas Awal</strong>, lalu buka hitungan stok untuk mata uang yang akan dikontrol hari ini.</div>}
        </div>
      </CardContent>
    </Card>
  </div>;
}

function PenyesuaianPanel() {
  const utils = trpc.useUtils();
  const [selectedCurrency, setSelectedCurrency] = useState<PickedCurrency | null>(null);
  const [category, setCategory] = useState<"SAFE_DEPOSIT" | "SAFE_WITHDRAWAL" | "OFF_HOURS_SALE" | "OTHER">("SAFE_DEPOSIT");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [denominations, setDenominations] = useState<DenominationRow[]>([emptyRow()]);

  const addRow = () => setDenominations((rows) => [...rows, emptyRow()]);
  const updateRow = (index: number, field: keyof DenominationRow, value: string) => setDenominations((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const removeRow = (index: number) => setDenominations((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  const total = denominations.reduce((sum, row) => sum + (Number(row.value) || 0) * (Number(row.quantity) || 0), 0);
  const mismatch = Boolean(amount) && Math.abs(total - Number(amount)) > 0.005;
  const isComplete = denominations.length > 0 && denominations.every((row) => row.value && row.quantity);

  const adjustment = trpc.cash.recordAdjustment.useMutation({
    onSuccess: ({ currencyCode, category: recordedCategory, afterAmount }) => {
      toast.success(`Penyesuaian ${recordedCategory} untuk ${currencyCode} tercatat. Saldo sekarang ${formatPlainAmount(afterAmount)}.`);
      setAmount(""); setNotes(""); setDenominations([emptyRow()]); setSelectedCurrency(null);
      utils.cash.balances.invalidate(); utils.cash.denominationBalances.invalidate(); utils.dashboard.overview.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = () => {
    if (!selectedCurrency) return toast.error("Pilih mata uang.");
    if (!amount) return toast.error("Isi jumlah penyesuaian.");
    if (notes.trim().length < 5) return toast.error("Catatan wajib diisi (minimal 5 karakter).");
    if (!isComplete) return toast.error("Rincian pecahan wajib diisi untuk setiap penyesuaian.");
    if (mismatch) return toast.error("Total rincian pecahan belum sama dengan jumlah penyesuaian.");
    adjustment.mutate({ currencyId: selectedCurrency.id, category, amount, notes, denominations: denominations.map((row) => ({ value: row.value, quantity: Number(row.quantity) })) });
  };

  return <Card className="border-[#dce6f0]">
    <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Catat penyesuaian brankas</CardTitle><CardDescription>Untuk kejadian di luar alur transaksi normal: owner menyetor ke brankas, mengambil dari brankas, atau menjual di luar jam kerja. Rincian pecahan wajib diisi setiap kali.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div>
        <Label className="text-xs">Mata uang</Label>
        {selectedCurrency ? <p className="mt-1 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span>Dipilih: {selectedCurrency.code} — {selectedCurrency.name}</span><button type="button" className="font-semibold text-emerald-900 underline" onClick={() => setSelectedCurrency(null)}>Ganti</button></p> : <div className="mt-1"><CurrencyPicker onSelect={setSelectedCurrency} /></div>}
      </div>
      <div><Label className="text-xs">Jenis penyesuaian</Label><Select value={category} onValueChange={(value) => setCategory(value as typeof category)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SAFE_DEPOSIT">Setor ke brankas (kas berkurang dari loket)</SelectItem><SelectItem value="SAFE_WITHDRAWAL">Ambil dari brankas (kas bertambah di loket)</SelectItem><SelectItem value="OFF_HOURS_SALE">Terjual di luar jam kerja (kas berkurang)</SelectItem><SelectItem value="OTHER">Lainnya</SelectItem></SelectContent></Select></div>
      <div><Label className="text-xs">Jumlah</Label><Input className="mt-1" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></div>
      <div><Label className="text-xs">Catatan (wajib, minimal 5 karakter)</Label><Input className="mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: Owner setor ke brankas pukul 20.00" /></div>
      <div className="rounded-xl border border-[#cbd9e7] bg-[#f8fbfe] p-3">
        <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-[#18395f]">Rincian pecahan (wajib)</Label><Button type="button" size="sm" variant="outline" className="h-7 border-[#bcd2e5] text-xs text-[#183f70]" onClick={addRow}><Plus className="mr-1 size-3" />Tambah pecahan</Button></div>
        {denominations.map((row, index) => <div key={index} className="mt-2 grid grid-cols-[1fr_100px_auto] items-start gap-2">
          <DenominationValueInput currencyCode={selectedCurrency?.code} value={row.value} onChange={(value) => updateRow(index, "value", value)} />
          <Input required inputMode="numeric" value={row.quantity} onChange={(event) => updateRow(index, "quantity", event.target.value)} placeholder="Lembar" />
          <Button type="button" size="sm" variant="ghost" className="text-rose-600" disabled={denominations.length === 1} onClick={() => removeRow(index)}>Hapus</Button>
        </div>)}
        <p className={`mt-2 text-xs ${mismatch ? "font-semibold text-rose-600" : "text-[#475569]"}`}>Total rincian: {formatPlainAmount(total)} {mismatch ? "— belum sama dengan jumlah di atas" : "— sudah sama dengan jumlah di atas"}</p>
      </div>
      <Button disabled={!selectedCurrency || !amount || notes.trim().length < 5 || !isComplete || mismatch || adjustment.isPending} onClick={submit} className="press-scale w-full bg-[#183f70] text-white hover:bg-[#12345d]">{adjustment.isPending ? "Menyimpan…" : "Catat penyesuaian"}</Button>
    </CardContent>
  </Card>;
}
