import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyPicker, PickedCurrency } from "@/components/CurrencyPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, CircleAlert, ClipboardCheck, RefreshCw, ScanLine, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function StockOpnameCount() {
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

  return <div className="mx-auto max-w-4xl space-y-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#5c8f53]"><ClipboardCheck className="size-4" /> Kontrol kas harian</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-[#18395f]">Stock opname</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#64748b]">Cek fisik hanya dilakukan sekali di sini saat mau tutup — bukan sepanjang hari. Buka hitungan setelah kas awal tercatat; masukkan jumlah fisik saat tutup, selisih akan terlihat jelas untuk diperiksa.</p>
      </div>
      <Button variant="outline" className="border-[#d8e5ef]" onClick={refreshAll}><RefreshCw className="mr-2 size-4" /> Muat ulang</Button>
    </section>
    {hasLoadError ? <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Data stock opname belum dapat dimuat.</p><p className="mt-1 text-xs">Tidak ada data yang berubah. Periksa koneksi lalu muat ulang beberapa saat lagi.</p></div><Button size="sm" variant="outline" onClick={refreshAll}>Coba lagi</Button></div> : null}
    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><ScanLine className="size-5 text-[#5c8f53]" /> Buka, hitung, dan periksa</CardTitle><CardDescription>Buka hitungan setelah kas awal tercatat. Saat tutup toko, masukkan jumlah fisik; selisih akan terlihat jelas untuk diperiksa.</CardDescription></CardHeader>
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
              <div><p className="font-semibold text-[#18395f]">{currency.code} · {new Date(opname.opnameDate).toLocaleDateString("id-ID")}</p><p className="mt-1 text-xs text-[#64748b]">Saldo sistem: {String(opname.closingSystemBalance)} · Fisik: {opname.physicalBalance ? String(opname.physicalBalance) : "belum dihitung"} · Selisih: {opname.variance ? String(opname.variance) : "belum ada"}</p></div>
              <Badge className={opname.reconciliationStatus === "VARIANCE" ? "status-rejected" : opname.reconciliationStatus === "RECONCILED" ? "status-approved" : "status-pending"}>{opname.reconciliationStatus === "OPEN" ? "MENUNGGU HITUNG" : opname.reconciliationStatus === "SUBMITTED" ? "MENUNGGU PERIKSA" : opname.reconciliationStatus}</Badge>
            </div>
            {opname.reconciliationStatus === "OPEN" ? <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div><Label className="text-xs">Kas fisik saat tutup</Label><Input inputMode="decimal" value={physical[opname.id] ?? ""} onChange={(event) => setPhysical({ ...physical, [opname.id]: event.target.value })} placeholder="0.000000" /></div>
              <div><Label className="text-xs">Catatan bila ada selisih</Label><Input value={notes[opname.id] ?? ""} onChange={(event) => setNotes({ ...notes, [opname.id]: event.target.value })} placeholder="Contoh: Perbedaan hitung pecahan" /></div>
              <Button className="self-end bg-[#183f70] text-white hover:bg-[#12345d]" disabled={!physical[opname.id] || submit.isPending} onClick={() => submit.mutate({ stockOpnameId: opname.id, physicalBalance: physical[opname.id], varianceNotes: notes[opname.id] || undefined })}>Kirim hasil hitung</Button>
            </div> : null}
            {opname.reconciliationStatus === "SUBMITTED" && canReconcile ? <div className="mt-4 flex flex-wrap gap-3"><Input className="flex-1" value={notes[opname.id] ?? ""} onChange={(event) => setNotes({ ...notes, [opname.id]: event.target.value })} placeholder="Catatan pemeriksaan Admin" /><Button disabled={(notes[opname.id] ?? "").trim().length < 3 || reconcile.isPending} onClick={() => reconcile.mutate({ stockOpnameId: opname.id, notes: notes[opname.id] })}><ShieldCheck className="mr-2 size-4" /> Selesaikan pemeriksaan</Button></div> : null}
            {opname.reconciliationStatus === "RECONCILED" ? <p className="mt-3 flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="size-4" /> Hitungan telah sesuai dan selesai diperiksa.</p> : null}
            {opname.reconciliationStatus === "VARIANCE" ? <p className="mt-3 flex items-center gap-2 text-xs text-rose-700"><CircleAlert className="size-4" /> Ada selisih; tindak lanjuti sesuai prosedur sebelum penutupan final.</p> : null}
          </div>) : <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm leading-6 text-[#64748b]">Mulai dari <strong>Kas Awal</strong>, lalu buka hitungan stok untuk mata uang yang akan dikontrol hari ini.</div>}
        </div>
      </CardContent>
    </Card>
  </div>;
}
