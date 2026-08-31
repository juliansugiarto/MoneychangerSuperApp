import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyPicker, PickedCurrency } from "@/components/CurrencyPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus, Vault } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DenominationRow = { value: string; quantity: string };
const emptyRow = (): DenominationRow => ({ value: "", quantity: "" });

export default function CashAdjustment() {
  const { user } = useAuth();
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
      toast.success(`Penyesuaian ${recordedCategory} untuk ${currencyCode} tercatat. Saldo sekarang ${afterAmount}.`);
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

  return <div className="mx-auto max-w-3xl space-y-6">
    <header>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#5c8f53]"><Vault className="size-4" /> Kontrol kas harian</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-[#18395f]">Penyesuaian brankas</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#64748b]">Untuk kejadian di luar alur transaksi normal: owner menyetor ke brankas, mengambil dari brankas, atau menjual di luar jam kerja. Tercatat teraudit dengan rincian pecahan wajib, otomatis masuk ke laporan stok.</p>
    </header>
    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Catat penyesuaian</CardTitle><CardDescription>Setor/ambil dari brankas mengubah stok pecahan loket secara langsung — rincian pecahan wajib diisi setiap kali.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Mata uang</Label>
          {selectedCurrency ? <p className="mt-1 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span>Dipilih: {selectedCurrency.code} — {selectedCurrency.name}</span><button type="button" className="font-semibold text-emerald-900 underline" onClick={() => setSelectedCurrency(null)}>Ganti</button></p> : <div className="mt-1"><CurrencyPicker onSelect={setSelectedCurrency} /></div>}
        </div>
        <div><Label className="text-xs">Jenis penyesuaian</Label><Select value={category} onValueChange={(value) => setCategory(value as typeof category)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SAFE_DEPOSIT">Setor ke brankas (kas berkurang dari loket)</SelectItem><SelectItem value="SAFE_WITHDRAWAL">Ambil dari brankas (kas bertambah di loket)</SelectItem><SelectItem value="OFF_HOURS_SALE">Terjual di luar jam kerja (kas berkurang)</SelectItem><SelectItem value="OTHER">Lainnya</SelectItem></SelectContent></Select></div>
        <div><Label className="text-xs">Jumlah</Label><Input className="mt-1" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.000000" /></div>
        <div><Label className="text-xs">Catatan (wajib, minimal 5 karakter)</Label><Input className="mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: Owner setor ke brankas pukul 20.00" /></div>
        <div className="rounded-xl border border-[#cbd9e7] bg-[#f8fbfe] p-3">
          <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-[#18395f]">Rincian pecahan (wajib)</Label><Button type="button" size="sm" variant="outline" className="h-7 border-[#bcd2e5] text-xs text-[#183f70]" onClick={addRow}><Plus className="mr-1 size-3" />Tambah pecahan</Button></div>
          {denominations.map((row, index) => <div key={index} className="mt-2 grid grid-cols-[1fr_100px_auto] gap-2">
            <Input required inputMode="decimal" value={row.value} onChange={(event) => updateRow(index, "value", event.target.value)} placeholder="Nilai pecahan" />
            <Input required inputMode="numeric" value={row.quantity} onChange={(event) => updateRow(index, "quantity", event.target.value)} placeholder="Lembar" />
            <Button type="button" size="sm" variant="ghost" className="text-rose-600" disabled={denominations.length === 1} onClick={() => removeRow(index)}>Hapus</Button>
          </div>)}
          <p className={`mt-2 text-xs ${mismatch ? "font-semibold text-rose-600" : "text-[#64748b]"}`}>Total rincian: {total.toLocaleString("id-ID")} {mismatch ? "— belum sama dengan jumlah di atas" : "— sudah sama dengan jumlah di atas"}</p>
        </div>
        <Button disabled={!selectedCurrency || !amount || notes.trim().length < 5 || !isComplete || mismatch || adjustment.isPending} onClick={submit} className="press-scale w-full bg-[#183f70] text-white hover:bg-[#12345d]">{adjustment.isPending ? "Menyimpan…" : "Catat penyesuaian"}</Button>
      </CardContent>
    </Card>
  </div>;
}
