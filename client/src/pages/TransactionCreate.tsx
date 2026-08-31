import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, Banknote, CircleDollarSign, FileText, Plus, Printer, Search, Trash2, Upload, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Customer, DenominationRow, PrintableLine, printBon } from "./Transactions";

type LineDraft = { key: string; currencyId: string; agreedRate: string; foreignAmount: string; quoteUnit: string; denominations: DenominationRow[] };

const emptyLine = (): LineDraft => ({ key: crypto.randomUUID(), currencyId: "", agreedRate: "", foreignAmount: "", quoteUnit: "1", denominations: [] });
const denominationsForSubmit = (rows: DenominationRow[]) => rows.filter((row) => row.value && row.quantity).map((row) => ({ value: row.value, quantity: Number(row.quantity) }));
const lineRupiah = (line: LineDraft) => { const foreign = Number(line.foreignAmount) || 0, rate = Number(line.agreedRate) || 0, unit = Number(line.quoteUnit) || 1; return foreign * rate / unit; };

export default function TransactionCreate() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const { data: currencies } = trpc.currencies.list.useQuery(undefined, { enabled: Boolean(user) });
  const { data: rates } = trpc.rates.listOperational.useQuery(undefined, { enabled: Boolean(user) });
  const activeCurrencies = useMemo(() => currencies?.filter((currency) => currency.active) ?? [], [currencies]);
  const referenceRateFor = (currencyId: string) => rates?.find(({ rate, currency }) => rate.status === "ACTIVE" && String(currency.id) === currencyId);

  const [operation, setOperation] = useState<"BUY" | "SELL">("BUY");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER" | "OTHER">("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [purpose, setPurposeValue] = useState("");
  const [customerActingAs, setCustomerActingAs] = useState<"SELF" | "REPRESENTATIVE">("SELF");
  const [repSearch, setRepSearch] = useState("");
  const [representativeCustomer, setRepresentativeCustomer] = useState<Customer | null>(null);
  const [underlyingRequired, setUnderlyingRequired] = useState(false);
  const [underlyingReference, setUnderlyingReference] = useState("");
  const [underlyingNotes, setUnderlyingNotes] = useState("");
  const [underlyingFile, setUnderlyingFile] = useState<File | null>(null);
  const [lastBon, setLastBon] = useState<any>(null);
  const [lastBonLines, setLastBonLines] = useState<PrintableLine[]>([]);

  const { data: customers } = trpc.customers.search.useQuery({ query: search, limit: 12 }, { enabled: Boolean(user) && search.trim().length >= 2 && !customer });
  const { data: representativeCandidates } = trpc.customers.search.useQuery({ query: repSearch, limit: 8 }, { enabled: Boolean(user) && customerActingAs === "REPRESENTATIVE" && repSearch.trim().length >= 2 && !representativeCustomer });
  const { data: linkedBeneficialOwner } = trpc.customers.get.useQuery({ customerId: customer?.beneficialOwnerCustomerId ?? 0 }, { enabled: Boolean(user) && customerActingAs === "REPRESENTATIVE" && Boolean(customer?.beneficialOwnerCustomerId) && !representativeCustomer });

  const setPurpose = (value: string | null) => setPurposeValue(value ?? "");
  useEffect(() => {
    const saved = sessionStorage.getItem("iv:transactionCustomer");
    if (!saved) return;
    try { const created = JSON.parse(saved) as Customer; setCustomer(created); setSearch(created.fullName); setPurpose(created.transactionPurpose); }
    catch { /* Ignore malformed browser-only handoff data. */ }
    finally { sessionStorage.removeItem("iv:transactionCustomer"); }
  }, []);
  useEffect(() => { if (linkedBeneficialOwner && !representativeCustomer) { setRepresentativeCustomer(linkedBeneficialOwner); setRepSearch(linkedBeneficialOwner.fullName); } }, [linkedBeneficialOwner, representativeCustomer]);
  useEffect(() => { if (customerActingAs === "SELF") { setRepresentativeCustomer(null); setRepSearch(""); } }, [customerActingAs]);

  const updateLine = (index: number, patch: Partial<LineDraft>) => setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) => setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  const addDenominationRow = (lineIndex: number) => setLines((prev) => prev.map((line, i) => (i === lineIndex ? { ...line, denominations: [...line.denominations, { value: "", quantity: "" }] } : line)));
  const updateDenominationRow = (lineIndex: number, denomIndex: number, field: "value" | "quantity", value: string) => setLines((prev) => prev.map((line, i) => (i === lineIndex ? { ...line, denominations: line.denominations.map((row, j) => (j === denomIndex ? { ...row, [field]: value } : row)) } : line)));
  const removeDenominationRow = (lineIndex: number, denomIndex: number) => setLines((prev) => prev.map((line, i) => (i === lineIndex ? { ...line, denominations: line.denominations.filter((_, j) => j !== denomIndex) } : line)));

  const totalRupiah = useMemo(() => lines.reduce((sum, line) => sum + lineRupiah(line), 0), [lines]);
  const lineHasDenominationMismatch = (line: LineDraft) => {
    if (!line.denominations.length) return false;
    const total = line.denominations.reduce((sum, row) => sum + (Number(row.value) || 0) * (Number(row.quantity) || 0), 0);
    return Math.abs(total - (Number(line.foreignAmount) || 0)) > 0.005;
  };
  const hasDenominationMismatch = lines.some(lineHasDenominationMismatch);

  const uploadUnderlying = async (transactionId: number) => {
    if (!underlyingFile) return;
    const response = await fetch("/api/operational-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType: "UNDERLYING", transactionId, originalFileName: underlyingFile.name, mimeType: underlyingFile.type, byteSize: underlyingFile.size, dataBase64: await toBase64(underlyingFile), documentReference: underlyingReference }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? "Underlying gagal diunggah.");
  };
  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });

  const create = trpc.transactions.create.useMutation({
    onSuccess: async (transaction) => {
      try {
        if (underlyingRequired) await uploadUnderlying(transaction.id);
        const printableLines: PrintableLine[] = lines.map((line) => { const currency = activeCurrencies.find((c) => String(c.id) === line.currencyId); return { currencyCode: currency?.code ?? "", foreignAmount: line.foreignAmount, agreedRate: line.agreedRate, rupiahAmount: lineRupiah(line).toFixed(2) }; });
        setLastBon(transaction);
        setLastBonLines(printableLines);
        setLines([emptyLine()]);
        setReceiptNumber("");
        setRepresentativeCustomer(null);
        setRepSearch("");
        utils.transactions.list.invalidate();
        toast.success(`Transaksi ${transaction.receiptNumber ?? transaction.transactionNumber} dibuat.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Draft dibuat tetapi unggah underlying gagal.");
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const makeDraft = (event: FormEvent) => {
    event.preventDefault();
    if (!receiptNumber.trim()) return toast.error("Isi nomor kwitansi.");
    if (!customer) return toast.error("Cari dan pilih nasabah.");
    if (lines.some((line) => !line.currencyId || !line.agreedRate || !line.foreignAmount)) return toast.error("Lengkapi mata uang, nominal, dan harga pada setiap baris.");
    if (hasDenominationMismatch) return toast.error("Rincian pecahan pada salah satu baris belum sama dengan nominal valuta baris tersebut.");
    if (customerActingAs === "REPRESENTATIVE" && !representativeCustomer) return toast.error("Pilih nasabah terdaftar sebagai pihak kuasa/wakil.");
    if (underlyingRequired && (!underlyingFile || !underlyingReference)) return toast.error("Lampirkan file dan referensi underlying.");
    create.mutate({
      operation,
      receiptNumber: receiptNumber.trim(),
      customerId: customer.id,
      lines: lines.map((line) => ({ currencyId: Number(line.currencyId), agreedRate: line.agreedRate, foreignAmount: line.foreignAmount, quoteUnit: line.quoteUnit || "1", denominations: denominationsForSubmit(line.denominations) })),
      paymentMethod,
      paymentReference,
      transactionPurposeSnapshot: purpose || customer.transactionPurpose || undefined,
      customerActingAs,
      representativeCustomerId: customerActingAs === "REPRESENTATIVE" ? representativeCustomer?.id : undefined,
      underlyingRequired,
      underlyingReference,
      underlyingNotes: underlyingNotes || undefined,
      transactionAt: new Date(),
    });
  };

  return <div className="mx-auto max-w-4xl space-y-6">
    <header>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#5c8f53]"><ArrowLeftRight className="size-4" /> Kasir valuta</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-[#18395f]">Buat transaksi jual atau beli</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#64748b]">Isi nomor kwitansi fisik, nasabah, dan satu atau lebih baris mata uang. Kirim sesuai alur persetujuan setelah draft tersimpan.</p>
    </header>

    {lastBon ? <Card className="border-emerald-200 bg-emerald-50"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div><p className="font-semibold text-emerald-900">Transaksi {lastBon.receiptNumber ?? lastBon.transactionNumber} berhasil dibuat.</p><p className="text-xs text-emerald-800">Cetak sekarang, atau lihat statusnya di Daftar Transaksi.</p></div>
      <div className="flex gap-2">
        <Button size="sm" className="bg-[#183f70]" onClick={() => printBon(lastBon, customer, lastBonLines)}><Printer className="mr-1 size-4" />Cetak</Button>
        <Button size="sm" variant="outline" onClick={() => setLocation("/operasional/transaksi/daftar")}>Lihat daftar transaksi</Button>
      </div>
    </CardContent></Card> : null}

    <form onSubmit={makeDraft} className="space-y-6">
      <Card className="border-[#dce6f0]">
        <CardHeader><CardTitle className="flex items-center gap-2 font-display text-lg text-[#18395f]"><FileText className="size-5 text-[#5c8f53]" /> 1. Nomor kwitansi &amp; nasabah</CardTitle><CardDescription>Nomor kwitansi mengikuti buku fisik — buku Jual dan Beli punya nomor terpisah, jadi No. 1 boleh ada di keduanya.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0"><Label>Jenis transaksi</Label><Select value={operation} onValueChange={(value) => setOperation(value as "BUY" | "SELL")}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BUY">Transaksi beli — nasabah menjual valuta</SelectItem><SelectItem value="SELL">Transaksi jual — nasabah membeli valuta</SelectItem></SelectContent></Select></div>
            <div className="min-w-0"><Label>No. Kwitansi</Label><Input className="mt-1" required value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="Contoh: 000001" /></div>
          </div>
          <div className="relative">
            <Label>Cari nasabah</Label>
            <div className="relative mt-1"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input required className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setCustomer(null); }} placeholder="Ketik nama, CIF, atau nomor identitas" /></div>
            {search.length >= 2 && !customer ? <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border bg-white p-1 shadow-lg">
              {customers?.length ? customers.map((c) => <button className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" type="button" key={c.id} onClick={() => { setCustomer(c); setSearch(c.fullName); setPurpose(c.transactionPurpose); }}><b className="text-[#18395f]">{c.fullName}</b><span className="ml-2 text-xs text-slate-500">{c.cifNumber} · {c.identityNumber}</span></button>)
                : <div className="p-3 text-sm text-slate-500"><p>Nasabah belum ditemukan.</p><Button className="mt-2" type="button" size="sm" variant="outline" onClick={() => setLocation("/operasional/nasabah?returnTo=/operasional/transaksi")}><UserPlus className="mr-1 size-3" />Buat profil KYC baru</Button></div>}
            </div> : null}
            {customer ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Dipilih: {customer.fullName} · {customer.cifNumber}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#dce6f0]">
        <CardHeader><CardTitle className="flex items-center gap-2 font-display text-lg text-[#18395f]"><CircleDollarSign className="size-5 text-[#5c8f53]" /> 2. Baris mata uang</CardTitle><CardDescription>Tambah baris bila nasabah menukar lebih dari satu mata uang, atau bila pecahan besar dan kecil punya harga berbeda. Semua mata uang aktif bisa dipilih, tidak dibatasi kurs otomatis.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, index) => {
            const reference = referenceRateFor(line.currencyId);
            const mismatch = lineHasDenominationMismatch(line);
            return <div key={line.key} className="rounded-xl border border-[#dce6f0] bg-[#fbfdff] p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-[#5c8f53]">Baris {index + 1}</p>{lines.length > 1 ? <Button type="button" size="sm" variant="ghost" className="h-7 text-rose-600" onClick={() => removeLine(index)}><Trash2 className="mr-1 size-3.5" />Hapus baris</Button> : null}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="min-w-0"><Label className="text-xs">Mata uang</Label><Select value={line.currencyId} onValueChange={(value) => updateLine(index, { currencyId: value })}><SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Pilih mata uang" /></SelectTrigger><SelectContent>{activeCurrencies.map((currency) => <SelectItem key={currency.id} value={String(currency.id)}>{currency.code} — {currency.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Nominal valuta</Label><Input className="mt-1" required inputMode="decimal" value={line.foreignAmount} onChange={(e) => updateLine(index, { foreignAmount: e.target.value })} placeholder="Contoh: 1500" /></div>
                <div><Label className="text-xs">Harga (manual, per satuan)</Label><Input className="mt-1" required inputMode="decimal" value={line.agreedRate} onChange={(e) => updateLine(index, { agreedRate: e.target.value })} placeholder="Contoh: 3550" /></div>
              </div>
              {reference ? <p className="mt-2 text-xs text-slate-500">Kurs referensi hari ini (pembanding saja): {operation === "BUY" ? String(reference.rate.buyRate) : String(reference.rate.sellRate)} IDR per {String(reference.rate.quoteUnit)} {reference.currency.code}.</p> : null}
              {line.foreignAmount && line.agreedRate ? <p className="mt-1 text-xs font-semibold text-[#18395f]">Perkiraan nilai baris ini: Rp {lineRupiah(line).toLocaleString("id-ID")}</p> : null}

              <div className="mt-3 rounded-lg border border-dashed border-[#cbd9e7] bg-white p-3">
                <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-[#18395f]">Rincian pecahan (opsional, disarankan)</Label><Button type="button" size="sm" variant="outline" className="h-7 border-[#bcd2e5] text-xs text-[#183f70]" onClick={() => addDenominationRow(index)}><Plus className="mr-1 size-3" />Tambah pecahan</Button></div>
                {line.denominations.map((row, denomIndex) => <div key={denomIndex} className="mt-2 grid grid-cols-[1fr_100px_auto] gap-2">
                  <Input inputMode="decimal" value={row.value} onChange={(e) => updateDenominationRow(index, denomIndex, "value", e.target.value)} placeholder="Nilai pecahan, mis. 100" />
                  <Input inputMode="numeric" value={row.quantity} onChange={(e) => updateDenominationRow(index, denomIndex, "quantity", e.target.value)} placeholder="Lembar" />
                  <Button type="button" size="sm" variant="ghost" className="text-rose-600" onClick={() => removeDenominationRow(index, denomIndex)}>Hapus</Button>
                </div>)}
                {line.denominations.length ? <p className={`mt-2 text-xs ${mismatch ? "font-semibold text-rose-600" : "text-[#64748b]"}`}>{mismatch ? "Total rincian belum sama dengan nominal valuta baris ini." : "Total rincian sudah sama dengan nominal valuta baris ini."}</p> : null}
              </div>
            </div>;
          })}
          <Button type="button" variant="outline" className="w-full border-dashed border-[#8fb08a] text-[#3d7139]" onClick={addLine}><Plus className="mr-2 size-4" />Tambah baris mata uang</Button>
          <div className="rounded-xl bg-[#18395f] px-4 py-3 text-right text-white"><span className="text-xs uppercase tracking-wide text-white/70">Total keseluruhan transaksi</span><p className="font-display text-xl font-semibold">Rp {totalRupiah.toLocaleString("id-ID")}</p></div>
        </CardContent>
      </Card>

      <Card className="border-[#dce6f0]">
        <CardHeader><CardTitle className="flex items-center gap-2 font-display text-lg text-[#18395f]"><Banknote className="size-5 text-[#5c8f53]" /> 3. Pembayaran &amp; pihak yang bertindak</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Cara bayar</Label><Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Tunai</SelectItem><SelectItem value="BANK_TRANSFER">Transfer bank</SelectItem><SelectItem value="OTHER">Lainnya</SelectItem></SelectContent></Select></div>
            <div><Label>Referensi pembayaran</Label><Input className="mt-1" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="No. transfer / keterangan kas" /></div>
          </div>
          <div><Label>Tujuan transaksi</Label><Input className="mt-1" required value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Contoh: perjalanan atau pendidikan" /></div>
          <div><Label>Bertindak sebagai</Label><Select value={customerActingAs} onValueChange={(value) => setCustomerActingAs(value as "SELF" | "REPRESENTATIVE")}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SELF">Nasabah sendiri</SelectItem><SelectItem value="REPRESENTATIVE">Pihak kuasa / wakil</SelectItem></SelectContent></Select></div>
          {customerActingAs === "REPRESENTATIVE" ? <div className="relative rounded-xl border p-3">
            <Label>Cari nasabah pihak kuasa / wakil</Label>
            <p className="mt-1 text-xs text-slate-500">Pihak kuasa/wakil (termasuk pemilik manfaat/BO) wajib sudah terdaftar sebagai nasabah dengan data lengkap sebelum dipilih di sini.</p>
            <div className="relative mt-2"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input required className="pl-9" value={repSearch} onChange={(e) => { setRepSearch(e.target.value); setRepresentativeCustomer(null); }} placeholder="Ketik nama, CIF, atau nomor identitas" /></div>
            {repSearch.length >= 2 && !representativeCustomer ? <div className="absolute z-20 mt-1 max-h-52 w-[calc(100%-1.5rem)] overflow-auto rounded-xl border bg-white p-1 shadow-lg">
              {representativeCandidates?.length ? representativeCandidates.map((c) => <button className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" type="button" key={c.id} onClick={() => { setRepresentativeCustomer(c); setRepSearch(c.fullName); }}><b className="text-[#18395f]">{c.fullName}</b><span className="ml-2 text-xs text-slate-500">{c.cifNumber} · {c.identityNumber}</span></button>)
                : <div className="p-3 text-sm text-slate-500"><p>Nasabah pihak kuasa/wakil belum ditemukan.</p><Button className="mt-2" type="button" size="sm" variant="outline" onClick={() => setLocation("/operasional/nasabah?returnTo=/operasional/transaksi")}><UserPlus className="mr-1 size-3" />Daftarkan sebagai nasabah baru</Button></div>}
            </div> : null}
            {representativeCustomer ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Dipilih: {representativeCustomer.fullName} · {representativeCustomer.cifNumber} · {representativeCustomer.identityNumber}</p> : null}
          </div> : null}
        </CardContent>
      </Card>

      <Card className="border-[#dce6f0]">
        <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">4. Dokumen underlying</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex gap-3 rounded-xl border p-3 text-sm"><input className="mt-1" type="checkbox" checked={underlyingRequired} onChange={(e) => setUnderlyingRequired(e.target.checked)} /><span><b>Dokumen underlying diperlukan</b><br /><small>Transaksi tidak dapat dikirim sebelum lampiran disimpan.</small></span></label>
          {underlyingRequired ? <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <div><Label>Referensi dokumen</Label><Input className="mt-1" required value={underlyingReference} onChange={(e) => setUnderlyingReference(e.target.value)} placeholder="No. invoice / surat / dokumen" /></div>
            <div><Label>Catatan verifikasi</Label><Input className="mt-1" value={underlyingNotes} onChange={(e) => setUnderlyingNotes(e.target.value)} placeholder="Keterangan pemeriksaan staf" /></div>
            <div><Label>File underlying</Label><Input className="mt-1" required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setUnderlyingFile(e.target.files?.[0] ?? null)} /></div>
            <p className="text-xs text-slate-500"><Upload className="mr-1 inline size-3" />JPG, PNG, WEBP, PDF; maksimal 8 MB.</p>
          </div> : null}
        </CardContent>
      </Card>

      <Button className="w-full bg-[#183f70]" disabled={create.isPending || hasDenominationMismatch}>{create.isPending ? "Membuat transaksi…" : "Simpan transaksi sebagai draft"}</Button>
    </form>
  </div>;
}
