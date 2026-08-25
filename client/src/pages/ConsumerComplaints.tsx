import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ClipboardPlus, MessageSquareWarning, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const initialForm = {
  reporterName: "",
  reporterIdentityNumber: "",
  reporterPhone: "",
  reporterEmail: "",
  transactionAt: "",
  receiptNumber: "",
  transactionDetails: "",
  chronology: "",
  supportingDocuments: "",
  category: "OTHER" as "CASH_COUNT" | "BOARD_RATE" | "STAFF_SERVICE" | "OTHER",
};

const statusLabel: Record<string, string> = { OPEN: "Diterima", IN_REVIEW: "Ditelaah", RESOLVED: "Selesai", ESCALATED_LAPS_BI: "Dieskalasi" };
const categoryLabel: Record<string, string> = { CASH_COUNT: "Nominal / kas", BOARD_RATE: "Papan kurs", STAFF_SERVICE: "Layanan staf", OTHER: "Lainnya" };

function statusClass(status: string) {
  if (status === "RESOLVED") return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  if (status === "ESCALATED_LAPS_BI") return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  if (status === "IN_REVIEW") return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  return "bg-sky-100 text-sky-700 hover:bg-sky-100";
}

export default function ConsumerComplaints() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: complaints, isLoading } = trpc.complaints.list.useQuery(undefined, { enabled: Boolean(user) });
  const [form, setForm] = useState(initialForm);
  const [resolutionById, setResolutionById] = useState<Record<number, string>>({});
  const [statusById, setStatusById] = useState<Record<number, "IN_REVIEW" | "RESOLVED" | "ESCALATED_LAPS_BI">>({});
  const canResolve = user?.role !== "STAFF";
  const createComplaint = trpc.complaints.create.useMutation({
    onSuccess: (created) => {
      toast.success(`Pengaduan ${created.complaintNumber} berhasil dicatat.`);
      setForm(initialForm);
      utils.complaints.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateComplaint = trpc.complaints.update.useMutation({
    onSuccess: () => { toast.success("Status pengaduan diperbarui dan dicatat pada audit log."); utils.complaints.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createComplaint.mutate({ ...form, transactionAt: form.transactionAt ? new Date(`${form.transactionAt}T00:00:00`) : undefined });
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-[#5c8f53] uppercase"><ShieldCheck className="size-4" /> Perlindungan Konsumen</div><h1 className="font-display text-3xl font-semibold tracking-tight text-[#18395f]">Register pengaduan</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">Catat pengaduan sesuai formulir perusahaan, pantau tindak lanjut, dan simpan hasil penyelesaian pada audit log.</p></div>
      <Badge variant="outline" className="w-fit border-[#cfe2d6] bg-[#f5fbf5] px-3 py-1.5 text-[#3c6f48]">{complaints?.filter((item) => ["OPEN", "IN_REVIEW"].includes(item.status)).length ?? 0} perlu tindak lanjut</Badge>
    </section>

    <div className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
      <Card className="border-[#dce6f0] shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><ClipboardPlus className="size-5 text-[#5c8f53]" /> Penerimaan pengaduan</CardTitle><CardDescription>Identitas pelapor, kronologi, dan bukti pendukung dicatat untuk tindak lanjut yang dapat ditelusuri.</CardDescription></CardHeader><CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Nama pelapor" required><Input value={form.reporterName} onChange={(event) => setForm({ ...form, reporterName: event.target.value })} /></Field><Field label="Nomor identitas" required><Input value={form.reporterIdentityNumber} onChange={(event) => setForm({ ...form, reporterIdentityNumber: event.target.value })} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Nomor telepon" required><Input value={form.reporterPhone} onChange={(event) => setForm({ ...form, reporterPhone: event.target.value })} /></Field><Field label="Email"><Input type="email" value={form.reporterEmail} onChange={(event) => setForm({ ...form, reporterEmail: event.target.value })} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Kategori" required><Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value as typeof form.category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH_COUNT">Nominal / kas</SelectItem><SelectItem value="BOARD_RATE">Papan kurs</SelectItem><SelectItem value="STAFF_SERVICE">Layanan staf</SelectItem><SelectItem value="OTHER">Lainnya</SelectItem></SelectContent></Select></Field><Field label="Tanggal transaksi"><Input type="date" value={form.transactionAt} onChange={(event) => setForm({ ...form, transactionAt: event.target.value })} /></Field></div>
          <Field label="Nomor bukti transaksi"><Input value={form.receiptNumber} onChange={(event) => setForm({ ...form, receiptNumber: event.target.value })} placeholder="Opsional" /></Field>
          <Field label="Rincian transaksi"><Textarea rows={2} value={form.transactionDetails} onChange={(event) => setForm({ ...form, transactionDetails: event.target.value })} placeholder="Mata uang, nominal, atau rincian lain yang relevan" /></Field>
          <Field label="Kronologi pengaduan" required><Textarea rows={5} value={form.chronology} onChange={(event) => setForm({ ...form, chronology: event.target.value })} placeholder="Jelaskan kejadian, waktu, dan permintaan pelapor." /></Field>
          <Field label="Dokumen pendukung"><Textarea rows={2} value={form.supportingDocuments} onChange={(event) => setForm({ ...form, supportingDocuments: event.target.value })} placeholder="Daftar bukti yang diterima atau lokasi penyimpanan berkas." /></Field>
          <Button type="submit" disabled={createComplaint.isPending} className="press-scale w-full bg-[#183f70] text-white hover:bg-[#12345d]">{createComplaint.isPending ? "Mencatat…" : "Catat pengaduan"}</Button>
        </form>
      </CardContent></Card>

      <Card className="border-[#dce6f0] shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><MessageSquareWarning className="size-5 text-[#5c8f53]" /> Tindak lanjut pengaduan</CardTitle><CardDescription>Staff dapat memantau register. Admin, Controller, dan Shareholder dapat memperbarui tindak lanjut hingga selesai atau dieskalasi.</CardDescription></CardHeader><CardContent><div className="space-y-3">
        {isLoading ? <p className="text-sm text-[#64748b]">Memuat register…</p> : complaints?.length ? complaints.map((complaint) => <div key={complaint.id} className="rounded-2xl border border-[#e2eaf2] bg-[#fbfdff] p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-semibold text-[#18395f]">{complaint.complaintNumber} · {complaint.reporterName}</p><p className="mt-1 text-xs text-[#64748b]">{categoryLabel[complaint.category]}{complaint.receiptNumber ? ` · Bukti ${complaint.receiptNumber}` : ""}</p></div><Badge className={statusClass(complaint.status)}>{statusLabel[complaint.status]}</Badge></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#476278]">{complaint.chronology}</p>{complaint.resolution ? <div className="mt-3 rounded-xl bg-[#f2f7f4] p-3 text-sm text-[#3c6f48]"><span className="font-semibold">Hasil: </span>{complaint.resolution}</div> : null}
          {canResolve && !["RESOLVED", "ESCALATED_LAPS_BI"].includes(complaint.status) ? <div className="mt-4 grid gap-3 border-t border-[#e2eaf2] pt-4 sm:grid-cols-[0.38fr_1fr_auto]"><Select value={statusById[complaint.id] ?? "IN_REVIEW"} onValueChange={(value) => setStatusById({ ...statusById, [complaint.id]: value as "IN_REVIEW" | "RESOLVED" | "ESCALATED_LAPS_BI" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IN_REVIEW">Tandai ditelaah</SelectItem><SelectItem value="RESOLVED">Selesaikan</SelectItem><SelectItem value="ESCALATED_LAPS_BI">Eskalasi</SelectItem></SelectContent></Select><Textarea rows={2} value={resolutionById[complaint.id] ?? ""} onChange={(event) => setResolutionById({ ...resolutionById, [complaint.id]: event.target.value })} placeholder="Catatan tindak lanjut; wajib untuk hasil akhir." /><Button disabled={updateComplaint.isPending} variant="outline" className="border-[#b9cce0] text-[#183f70] hover:bg-[#edf4fa]" onClick={() => updateComplaint.mutate({ complaintId: complaint.id, status: statusById[complaint.id] ?? "IN_REVIEW", resolution: resolutionById[complaint.id] || undefined })}>Simpan</Button></div> : null}
        </div>) : <Empty text="Belum ada pengaduan tercatat. Gunakan formulir di samping saat pengaduan diterima." />}
      </div></CardContent></Card>
    </div>
  </div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-xs font-semibold text-[#476278]">{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</Label>{children}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm leading-6 text-[#64748b]">{text}</div>; }
