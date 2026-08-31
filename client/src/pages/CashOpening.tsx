import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyPicker, PickedCurrency } from "@/components/CurrencyPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Banknote, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DenominationRow = { value: string; quantity: string };
const emptyRow = (): DenominationRow => ({ value: "", quantity: "" });

export default function CashOpening() {
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
      toast.success(`Kas awal ${currencyCode} sebesar ${amount} berhasil dicatat, termasuk rincian pecahannya.`);
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

  return <div className="mx-auto max-w-3xl space-y-6">
    <header>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#5c8f53]"><Banknote className="size-4" /> Kontrol kas harian</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-[#18395f]">Kas awal</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#64748b]">Catat sebelum transaksi pertama hari ini. Rincian pecahan wajib diisi — angka ini jadi stok pecahan awal yang dipakai sistem sepanjang hari, sampai stock opname penutupan.</p>
    </header>
    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Catat kas awal</CardTitle><CardDescription>Masukkan jumlah fisik yang benar-benar diterima. Nilai ini menggantikan saldo sistem dan dicatat sebagai penyesuaian teraudit.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Mata uang</Label>
          {selectedCurrency ? <p className="mt-1 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span>Dipilih: {selectedCurrency.code} — {selectedCurrency.name}</span><button type="button" className="font-semibold text-emerald-900 underline" onClick={() => setSelectedCurrency(null)}>Ganti</button></p> : <div className="mt-1"><CurrencyPicker onSelect={setSelectedCurrency} /></div>}
        </div>
        <div><Label className="text-xs">Jumlah kas fisik pembukaan</Label><Input className="mt-1" inputMode="decimal" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} placeholder="Contoh: 2500.000000" /></div>
        <div><Label className="text-xs">Catatan (opsional)</Label><Input className="mt-1" value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} placeholder="Contoh: Kas awal teller pagi" /></div>
        <div className="rounded-xl border border-[#cbd9e7] bg-[#f8fbfe] p-3">
          <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-[#18395f]">Rincian pecahan (wajib)</Label><Button type="button" size="sm" variant="outline" className="h-7 border-[#bcd2e5] text-xs text-[#183f70]" onClick={addRow}><Plus className="mr-1 size-3" />Tambah pecahan</Button></div>
          {denominations.map((row, index) => <div key={index} className="mt-2 grid grid-cols-[1fr_100px_auto] gap-2">
            <Input required inputMode="decimal" value={row.value} onChange={(event) => updateRow(index, "value", event.target.value)} placeholder="Nilai pecahan, mis. 100000" />
            <Input required inputMode="numeric" value={row.quantity} onChange={(event) => updateRow(index, "quantity", event.target.value)} placeholder="Lembar" />
            <Button type="button" size="sm" variant="ghost" className="text-rose-600" disabled={denominations.length === 1} onClick={() => removeRow(index)}>Hapus</Button>
          </div>)}
          <p className={`mt-2 text-xs ${mismatch ? "font-semibold text-rose-600" : "text-[#64748b]"}`}>Total rincian: {total.toLocaleString("id-ID")} {mismatch ? "— belum sama dengan jumlah kas fisik di atas" : "— sudah sama dengan jumlah kas fisik"}</p>
        </div>
        <Button disabled={!selectedCurrency || !openingAmount || !isComplete || mismatch || opening.isPending} onClick={submit} className="press-scale w-full bg-[#183f70] text-white hover:bg-[#12345d]">{opening.isPending ? "Mencatat…" : "Catat kas awal"}</Button>
      </CardContent>
    </Card>
    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Saldo sistem saat ini</CardTitle></CardHeader>
      <CardContent><div className="space-y-2">{balances?.length ? balances.map(({ balance, currency }) => <div key={balance.id} className="flex justify-between rounded-xl bg-[#f6fafc] px-3 py-2 text-sm"><span className="font-semibold text-[#315675]">{currency.code}</span><span className="font-mono text-[#516a81]">{String(balance.availableAmount)}</span></div>) : <p className="text-sm text-[#64748b]">Belum ada saldo kas tercatat.</p>}</div></CardContent>
    </Card>
  </div>;
}
