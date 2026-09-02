import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatIdrDecimal, sumIdrDecimals } from "@/lib/money";
import { trpc } from "@/lib/trpc";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@shared/expenseCategories";
import { Paperclip, Receipt, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = { expenseDate: today(), category: EXPENSE_CATEGORIES[0], amount: "", description: "", notes: "" };
const expenseCategoryLabel = (code: string) => (EXPENSE_CATEGORY_LABELS as Record<string, string>)[code] ?? code;

export default function ExpenseEntry() {
  const utils = trpc.useUtils();
  const { data: expenses, isLoading } = trpc.expenses.list.useQuery(undefined);
  const [form, setForm] = useState(emptyForm);
  const [pendingReceipt, setPendingReceipt] = useState<File | null>(null);
  const [uploadingReceiptFor, setUploadingReceiptFor] = useState<number | null>(null);

  const create = trpc.expenses.create.useMutation({
    onSuccess: async (created) => {
      utils.expenses.list.invalidate();
      if (pendingReceipt && created) {
        try {
          await uploadReceipt(created.id, pendingReceipt);
          utils.documents.forExpense.invalidate({ expenseId: created.id });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Bukti pengeluaran gagal diunggah, catatan tetap tersimpan.");
        }
      }
      toast.success("Pengeluaran tercatat.");
      setForm(emptyForm);
      setPendingReceipt(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const uploadReceipt = async (expenseId: number, file: File) => {
    const response = await fetch("/api/operational-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType: "EXPENSE_RECEIPT", expenseId, originalFileName: file.name, mimeType: file.type, byteSize: file.size, dataBase64: await fileToBase64(file) }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? "Bukti pengeluaran gagal diunggah.");
    return body.document as { id: number };
  };

  const submit = () => {
    if (!form.amount.trim() || Number(form.amount) <= 0) return toast.error("Nominal pengeluaran harus lebih besar dari nol.");
    if (!form.description.trim()) return toast.error("Deskripsi pengeluaran wajib diisi.");
    create.mutate({ expenseDate: new Date(form.expenseDate), category: form.category, amount: form.amount, description: form.description.trim(), notes: form.notes.trim() || undefined });
  };

  const totalThisMonth = sumIdrDecimals((expenses ?? []).filter((expense) => new Date(expense.expenseDate).toISOString().slice(0, 7) === today().slice(0, 7)).map((expense) => String(expense.amount)));

  return <div className="mx-auto max-w-4xl space-y-6">
    <header>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#5c8f53]"><Receipt className="size-4" /> Keuangan internal</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-[#18395f]">Pencatatan pengeluaran</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#334155]">Log pengeluaran operasional sederhana (sewa, gaji, utilitas, dll) untuk pelaporan keuangan internal. Terpisah sepenuhnya dari kas dan stok valuta — mencatat pengeluaran di sini tidak memengaruhi saldo kas atau stok pecahan.</p>
    </header>

    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Catat pengeluaran baru</CardTitle><CardDescription>Setiap entri bersifat permanen (tidak dapat diedit/dihapus) untuk menjaga jejak audit. Bila salah catat, tambahkan entri koreksi baru dengan keterangan yang jelas.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Tanggal</Label><Input className="mt-1" type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></div>
          <div>
            <Label className="text-xs">Kategori</Label>
            <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value as typeof form.category })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{EXPENSE_CATEGORIES.map((code) => <SelectItem key={code} value={code}>{EXPENSE_CATEGORY_LABELS[code]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label className="text-xs">Nominal (Rp)</Label><Input className="mt-1" type="number" min="0" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></div>
        <div><Label className="text-xs">Deskripsi</Label><Input className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="mis. Sewa kantor bulan September 2026" /></div>
        <div><Label className="text-xs">Catatan tambahan (opsional)</Label><Textarea className="mt-1" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div>
          <Label className="text-xs">Bukti pengeluaran (opsional)</Label>
          <Input className="mt-1" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setPendingReceipt(e.target.files?.[0] ?? null)} />
          {pendingReceipt ? <p className="mt-1 flex items-center gap-1 text-[11px] text-[#475569]"><Paperclip className="size-3" />{pendingReceipt.name} akan diunggah setelah entri tersimpan.</p> : null}
        </div>
        <Button disabled={create.isPending} onClick={submit} className="w-full bg-[#183f70] text-white hover:bg-[#12345d]">{create.isPending ? "Menyimpan…" : "Simpan pengeluaran"}</Button>
      </CardContent>
    </Card>

    <Card className="border-[#dce6f0]">
      <CardHeader className="flex-row items-center justify-between gap-4"><div><CardTitle className="font-display text-lg text-[#18395f]">Riwayat pengeluaran</CardTitle><CardDescription>Total bulan ini: {formatIdrDecimal(totalThisMonth)}</CardDescription></div><Badge variant="outline" className="border-[#cbd6ed] text-[#526681]">{expenses?.length ?? 0} entri</Badge></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-[#475569]">Memuat riwayat pengeluaran…</p> : null}
        {!isLoading && !expenses?.length ? <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm leading-6 text-[#475569]">Belum ada pengeluaran tercatat.</div> : null}
        <div className="space-y-2">
          {expenses?.map((expense) => <ExpenseRow key={expense.id} expense={expense} uploading={uploadingReceiptFor === expense.id} onUploadReceipt={async (file) => {
            setUploadingReceiptFor(expense.id);
            try {
              await uploadReceipt(expense.id, file);
              utils.documents.forExpense.invalidate({ expenseId: expense.id });
              toast.success("Bukti pengeluaran diunggah.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Bukti pengeluaran gagal diunggah.");
            } finally {
              setUploadingReceiptFor(null);
            }
          }} />)}
        </div>
      </CardContent>
    </Card>
  </div>;
}

function ExpenseRow({ expense, uploading, onUploadReceipt }: { expense: { id: number; expenseDate: string | Date; category: string; amount: string; description: string; notes: string | null }; uploading: boolean; onUploadReceipt: (file: File) => void }) {
  const utils = trpc.useUtils();
  const { data: documents } = trpc.documents.forExpense.useQuery({ expenseId: expense.id });
  const viewDocument = async (documentId: number) => {
    const url = await utils.documents.downloadUrl.fetch({ documentId });
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return <div className="rounded-xl border p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="font-semibold text-[#18395f]">{expense.description}</p>
        <p className="text-xs text-slate-600">{new Date(expense.expenseDate).toLocaleDateString("id-ID")} · {expenseCategoryLabel(expense.category)}</p>
      </div>
      <p className="table-number text-sm font-semibold text-[#315675]">{formatIdrDecimal(expense.amount)}</p>
    </div>
    {expense.notes ? <p className="mt-1.5 text-xs text-[#64748b]">{expense.notes}</p> : null}
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {documents?.map((doc) => <Button key={doc.id} type="button" size="sm" variant="outline" onClick={() => viewDocument(doc.id)}><Paperclip className="mr-1 size-3" />{doc.originalFileName}</Button>)}
      <label className="press-scale inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[#cbd6ed] px-2.5 py-1.5 text-xs font-semibold text-[#5570cf] hover:bg-[#f2f5ff]">
        <Upload className="size-3" />{uploading ? "Mengunggah…" : "Tambah bukti"}
        <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) onUploadReceipt(file); e.target.value = ""; }} />
      </label>
    </div>
  </div>;
}
