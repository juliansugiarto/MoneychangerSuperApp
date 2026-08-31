import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyPicker, PickedCurrency } from "@/components/CurrencyPicker";
import { DenominationValueInput } from "@/components/DenominationValueInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPlainAmount } from "@/lib/money";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, Banknote, CircleDollarSign, FileText, Plus, Printer, Search, Trash2, Upload, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Customer, PrintableLine, printBon } from "./Transactions";

/** Every denomination group is priced on its own (e.g. USD 100s vs USD 10s in the same deal), so price lives here, not on the line. */
type PricedDenominationRow = { value: string; quantity: string; rate: string };
type LineDraft = { key: string; currency: PickedCurrency | null; quoteUnit: string; denominations: PricedDenominationRow[] };
/** The Rupiah leg of a CASH deal has no price to enter — it's already valued at face value. */
type PlainDenominationRow = { value: string; quantity: string };

const emptyDenominationRow = (): PricedDenominationRow => ({ value: "", quantity: "", rate: "" });
const emptyPlainDenominationRow = (): PlainDenominationRow => ({ value: "", quantity: "" });
const emptyLine = (): LineDraft => ({ key: crypto.randomUUID(), currency: null, quoteUnit: "1", denominations: [emptyDenominationRow()] });
const isCompleteDenominationRow = (row: PricedDenominationRow) => Boolean(row.value && row.quantity && row.rate);
const lineForeignTotal = (line: LineDraft) => line.denominations.reduce((sum, row) => sum + (Number(row.value) || 0) * (Number(row.quantity) || 0), 0);
const lineRupiahTotal = (line: LineDraft) => { const unit = Number(line.quoteUnit) || 1; return line.denominations.reduce((sum, row) => sum + (Number(row.value) || 0) * (Number(row.quantity) || 0) * (Number(row.rate) || 0) / unit, 0); };

export default function TransactionCreate() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const { data: rates } = trpc.rates.listOperational.useQuery(undefined, { enabled: Boolean(user) });
  const referenceRateFor = (currencyId?: number) => rates?.find(({ rate, currency }) => rate.status === "ACTIVE" && currency.id === currencyId);

  const [operation, setOperation] = useState<"BUY" | "SELL">("BUY");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER" | "OTHER">("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDenominations, setPaymentDenominations] = useState<PlainDenominationRow[]>([emptyPlainDenominationRow()]);
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
  const addDenominationRow = (lineIndex: number) => setLines((prev) => prev.map((line, i) => (i === lineIndex ? { ...line, denominations: [...line.denominations, emptyDenominationRow()] } : line)));
  const updateDenominationRow = (lineIndex: number, denomIndex: number, field: keyof PricedDenominationRow, value: string) => setLines((prev) => prev.map((line, i) => (i === lineIndex ? { ...line, denominations: line.denominations.map((row, j) => (j === denomIndex ? { ...row, [field]: value } : row)) } : line)));
  const removeDenominationRow = (lineIndex: number, denomIndex: number) => setLines((prev) => prev.map((line, i) => (i === lineIndex ? { ...line, denominations: line.denominations.length > 1 ? line.denominations.filter((_, j) => j !== denomIndex) : line.denominations } : line)));

  const totalRupiah = useMemo(() => lines.reduce((sum, line) => sum + lineRupiahTotal(line), 0), [lines]);
  const lineIsComplete = (line: LineDraft) => Boolean(line.currency) && line.denominations.length > 0 && line.denominations.every(isCompleteDenominationRow);
  const allLinesComplete = lines.every(lineIsComplete);

  const addPaymentDenominationRow = () => setPaymentDenominations((rows) => [...rows, emptyPlainDenominationRow()]);
  const updatePaymentDenominationRow = (index: number, field: keyof PlainDenominationRow, value: string) => setPaymentDenominations((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const removePaymentDenominationRow = (index: number) => setPaymentDenominations((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  const paymentDenominationTotal = paymentDenominations.reduce((sum, row) => sum + (Number(row.value) || 0) * (Number(row.quantity) || 0), 0);
  const paymentDenominationsComplete = paymentDenominations.length > 0 && paymentDenominations.every((row) => row.value && row.quantity);
  const paymentDenominationMismatch = paymentMethod === "CASH" && totalRupiah > 0 && Math.abs(paymentDenominationTotal - totalRupiah) > 0.5;

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
        const printableLines: PrintableLine[] = lines.flatMap((line) => line.denominations.map((row) => ({
          currencyCode: line.currency?.code ?? "",
          foreignAmount: ((Number(row.value) || 0) * (Number(row.quantity) || 0)).toString(),
          agreedRate: row.rate,
          rupiahAmount: (((Number(row.value) || 0) * (Number(row.quantity) || 0) * (Number(row.rate) || 0)) / (Number(line.quoteUnit) || 1)).toFixed(2),
        })));
        setLastBon(transaction);
        setLastBonLines(printableLines);
        setLines([emptyLine()]);
        setPaymentDenominations([emptyPlainDenominationRow()]);
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
    if (!allLinesComplete) return toast.error("Setiap baris wajib punya mata uang dan minimal satu pecahan lengkap (nilai, jumlah, harga).");
    if (paymentMethod === "CASH" && !paymentDenominationsComplete) return toast.error("Rincian pecahan Rupiah wajib diisi untuk pembayaran tunai.");
    if (paymentDenominationMismatch) return toast.error("Rincian pecahan Rupiah belum sama dengan total transaksi.");
    if (customerActingAs === "REPRESENTATIVE" && !representativeCustomer) return toast.error("Pilih nasabah terdaftar sebagai pihak kuasa/wakil.");
    if (underlyingRequired && (!underlyingFile || !underlyingReference)) return toast.error("Lampirkan file dan referensi underlying.");
    create.mutate({
      operation,
      receiptNumber: receiptNumber.trim(),
      customerId: customer.id,
      lines: lines.map((line) => ({ currencyId: line.currency!.id, quoteUnit: line.quoteUnit || "1", denominations: line.denominations.map((row) => ({ value: row.value, quantity: Number(row.quantity), rate: row.rate })) })),
      paymentMethod,
      paymentReference,
      paymentDenominations: paymentMethod === "CASH" ? paymentDenominations.map((row) => ({ value: row.value, quantity: Number(row.quantity) })) : undefined,
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
      <p className="mt-2 max-w-2xl text-sm text-[#475569]">Isi nomor kwitansi fisik, nasabah, dan satu atau lebih baris mata uang. Kirim sesuai alur persetujuan setelah draft tersimpan.</p>
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
            <div className="relative mt-1"><Search className="absolute left-3 top-2.5 size-4 text-slate-600" /><Input required className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setCustomer(null); }} placeholder="Ketik nama, CIF, atau nomor identitas" /></div>
            {search.length >= 2 && !customer ? <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border bg-white p-1 shadow-lg">
              {customers?.length ? customers.map((c) => <button className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" type="button" key={c.id} onClick={() => { setCustomer(c); setSearch(c.fullName); setPurpose(c.transactionPurpose); }}><b className="text-[#18395f]">{c.fullName}</b><span className="ml-2 text-xs text-slate-600">{c.cifNumber} · {c.identityNumber}</span></button>)
                : <div className="p-3 text-sm text-slate-600"><p>Nasabah belum ditemukan.</p><Button className="mt-2" type="button" size="sm" variant="outline" onClick={() => setLocation("/operasional/nasabah?returnTo=/operasional/transaksi")}><UserPlus className="mr-1 size-3" />Buat profil KYC baru</Button></div>}
            </div> : null}
            {customer ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Dipilih: {customer.fullName} · {customer.cifNumber}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#dce6f0]">
        <CardHeader><CardTitle className="flex items-center gap-2 font-display text-lg text-[#18395f]"><CircleDollarSign className="size-5 text-[#5c8f53]" /> 2. Baris mata uang &amp; pecahan</CardTitle><CardDescription>Cari mata uang apa saja di dunia — tidak dibatasi kurs otomatis. Setiap pecahan wajib punya harga sendiri, karena pecahan besar dan kecil sering dihargai berbeda.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, index) => {
            const reference = referenceRateFor(line.currency?.id);
            return <div key={line.key} className="rounded-xl border border-[#dce6f0] bg-[#fbfdff] p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-[#5c8f53]">Baris {index + 1}</p>{lines.length > 1 ? <Button type="button" size="sm" variant="ghost" className="h-7 text-rose-600" onClick={() => removeLine(index)}><Trash2 className="mr-1 size-3.5" />Hapus baris</Button> : null}</div>

              <div className="mt-3">
                <Label className="text-xs">Mata uang</Label>
                {line.currency ? <p className="mt-1 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span>Dipilih: {line.currency.code} — {line.currency.name}</span><button type="button" className="font-semibold text-emerald-900 underline" onClick={() => updateLine(index, { currency: null })}>Ganti</button></p>
                  : <div className="mt-1"><CurrencyPicker onSelect={(currency) => updateLine(index, { currency })} /></div>}
              </div>
              {reference ? <p className="mt-2 text-xs text-slate-600">Kurs referensi hari ini (pembanding saja): {operation === "BUY" ? String(reference.rate.buyRate) : String(reference.rate.sellRate)} IDR per {String(reference.rate.quoteUnit)} {reference.currency.code}.</p> : null}

              <div className="mt-3 rounded-lg border border-[#cbd9e7] bg-white p-3">
                <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-[#18395f]">Rincian pecahan (wajib — tiap pecahan punya harga sendiri)</Label><Button type="button" size="sm" variant="outline" className="h-7 border-[#bcd2e5] text-xs text-[#183f70]" onClick={() => addDenominationRow(index)}><Plus className="mr-1 size-3" />Tambah pecahan</Button></div>
                {line.denominations.map((row, denomIndex) => <div key={denomIndex} className="mt-2 grid grid-cols-[1fr_90px_1fr_auto] items-start gap-2">
                  <DenominationValueInput currencyCode={line.currency?.code} value={row.value} onChange={(value) => updateDenominationRow(index, denomIndex, "value", value)} />
                  <Input required inputMode="numeric" value={row.quantity} onChange={(e) => updateDenominationRow(index, denomIndex, "quantity", e.target.value)} placeholder="Lembar" />
                  <Input required inputMode="decimal" value={row.rate} onChange={(e) => updateDenominationRow(index, denomIndex, "rate", e.target.value)} placeholder="Harga pecahan ini" />
                  <Button type="button" size="sm" variant="ghost" className="text-rose-600" disabled={line.denominations.length === 1} onClick={() => removeDenominationRow(index, denomIndex)}>Hapus</Button>
                </div>)}
                <p className="mt-2 text-xs text-[#475569]">Contoh: 1000 USD dengan pecahan 100×5 harga 17800, pecahan 50×5 harga 17500, pecahan 10×25 harga 17000 — tambahkan tiga baris pecahan seperti itu.</p>
              </div>
              {lineForeignTotal(line) > 0 ? <p className="mt-2 text-xs font-semibold text-[#18395f]">Total baris ini: {formatPlainAmount(lineForeignTotal(line))} {line.currency?.code ?? ""} · Rp {formatPlainAmount(lineRupiahTotal(line))}</p> : null}
            </div>;
          })}
          <Button type="button" variant="outline" className="w-full border-dashed border-[#8fb08a] text-[#3d7139]" onClick={addLine}><Plus className="mr-2 size-4" />Tambah baris mata uang</Button>
          <div className="rounded-xl bg-[#18395f] px-4 py-3 text-right text-white"><span className="text-xs uppercase tracking-wide text-white/70">Total keseluruhan transaksi</span><p className="font-display text-xl font-semibold">Rp {formatPlainAmount(totalRupiah)}</p></div>
        </CardContent>
      </Card>

      <Card className="border-[#dce6f0]">
        <CardHeader><CardTitle className="flex items-center gap-2 font-display text-lg text-[#18395f]"><Banknote className="size-5 text-[#5c8f53]" /> 3. Pembayaran &amp; pihak yang bertindak</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Cara bayar</Label><Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Tunai</SelectItem><SelectItem value="BANK_TRANSFER">Transfer bank</SelectItem><SelectItem value="OTHER">Lainnya</SelectItem></SelectContent></Select></div>
            <div><Label>Referensi pembayaran</Label><Input className="mt-1" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="No. transfer / keterangan kas" /></div>
          </div>
          {paymentMethod === "CASH" ? <div className="rounded-xl border border-[#cbd9e7] bg-[#f8fbfe] p-3">
            <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-[#18395f]">Rincian pecahan Rupiah yang diterima/dibayarkan (wajib)</Label><Button type="button" size="sm" variant="outline" className="h-7 border-[#bcd2e5] text-xs text-[#183f70]" onClick={addPaymentDenominationRow}><Plus className="mr-1 size-3" />Tambah pecahan</Button></div>
            <p className="mt-1 text-xs text-slate-600">Uang tunai yang benar-benar berpindah — bertambah/berkurang otomatis di stok pecahan Rupiah saat bon ini diselesaikan.</p>
            {paymentDenominations.map((row, index) => <div key={index} className="mt-2 grid grid-cols-[1fr_100px_auto] items-start gap-2">
              <DenominationValueInput currencyCode="IDR" value={row.value} onChange={(value) => updatePaymentDenominationRow(index, "value", value)} />
              <Input required inputMode="numeric" value={row.quantity} onChange={(e) => updatePaymentDenominationRow(index, "quantity", e.target.value)} placeholder="Lembar" />
              <Button type="button" size="sm" variant="ghost" className="text-rose-600" disabled={paymentDenominations.length === 1} onClick={() => removePaymentDenominationRow(index)}>Hapus</Button>
            </div>)}
            <p className={`mt-2 text-xs ${paymentDenominationMismatch ? "font-semibold text-rose-600" : "text-[#475569]"}`}>Total rincian: Rp {formatPlainAmount(paymentDenominationTotal)} {paymentDenominationMismatch ? `— belum sama dengan total transaksi (Rp ${formatPlainAmount(totalRupiah)})` : ""}</p>
          </div> : null}
          <div><Label>Tujuan transaksi</Label><Input className="mt-1" required value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Contoh: perjalanan atau pendidikan" /></div>
          <div><Label>Bertindak sebagai</Label><Select value={customerActingAs} onValueChange={(value) => setCustomerActingAs(value as "SELF" | "REPRESENTATIVE")}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SELF">Nasabah sendiri</SelectItem><SelectItem value="REPRESENTATIVE">Pihak kuasa / wakil</SelectItem></SelectContent></Select></div>
          {customerActingAs === "REPRESENTATIVE" ? <div className="relative rounded-xl border p-3">
            <Label>Cari nasabah pihak kuasa / wakil</Label>
            <p className="mt-1 text-xs text-slate-600">Pihak kuasa/wakil (termasuk pemilik manfaat/BO) wajib sudah terdaftar sebagai nasabah dengan data lengkap sebelum dipilih di sini.</p>
            <div className="relative mt-2"><Search className="absolute left-3 top-2.5 size-4 text-slate-600" /><Input required className="pl-9" value={repSearch} onChange={(e) => { setRepSearch(e.target.value); setRepresentativeCustomer(null); }} placeholder="Ketik nama, CIF, atau nomor identitas" /></div>
            {repSearch.length >= 2 && !representativeCustomer ? <div className="absolute z-20 mt-1 max-h-52 w-[calc(100%-1.5rem)] overflow-auto rounded-xl border bg-white p-1 shadow-lg">
              {representativeCandidates?.length ? representativeCandidates.map((c) => <button className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" type="button" key={c.id} onClick={() => { setRepresentativeCustomer(c); setRepSearch(c.fullName); }}><b className="text-[#18395f]">{c.fullName}</b><span className="ml-2 text-xs text-slate-600">{c.cifNumber} · {c.identityNumber}</span></button>)
                : <div className="p-3 text-sm text-slate-600"><p>Nasabah pihak kuasa/wakil belum ditemukan.</p><Button className="mt-2" type="button" size="sm" variant="outline" onClick={() => setLocation("/operasional/nasabah?returnTo=/operasional/transaksi")}><UserPlus className="mr-1 size-3" />Daftarkan sebagai nasabah baru</Button></div>}
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
            <p className="text-xs text-slate-600"><Upload className="mr-1 inline size-3" />JPG, PNG, WEBP, PDF; maksimal 8 MB.</p>
          </div> : null}
        </CardContent>
      </Card>

      <Button className="w-full bg-[#183f70]" disabled={create.isPending || !allLinesComplete || (paymentMethod === "CASH" && (!paymentDenominationsComplete || paymentDenominationMismatch))}>{create.isPending ? "Membuat transaksi…" : "Simpan transaksi sebagai draft"}</Button>
    </form>
  </div>;
}
