import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ClipboardCheck, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

/**
 * Daftar penilaian risiko lembaga (IRA), satu baris per periode.
 *
 * ADMIN membuat dan mengisi; SHAREHOLDER menyetujui. Yang sudah disetujui terkunci, dan barisnya
 * menunjukkan penggantinya bila ada — dokumen yang pernah ditandatangani tidak pernah hilang dari
 * daftar, hanya ditandai digantikan.
 */

type AssessmentRow = {
  id: number;
  periodStart: string | Date;
  periodEnd: string | Date;
  trigger: "TAHUNAN" | "MANUAL";
  triggerReason: string | null;
  status: "DRAFT" | "MENUNGGU_PERSETUJUAN" | "DISETUJUI";
  finalValue: number | null;
  finalPredicate: string | null;
  supersededByAssessmentId: number | null;
};

const STATUS_TONE: Record<AssessmentRow["status"], string> = {
  DRAFT: "border-[#dce6f0] bg-[#f7fafd] text-[#4a6a8f]",
  MENUNGGU_PERSETUJUAN: "border-[#f0e2c4] bg-[#fdf9f0] text-[#8a6d2f]",
  DISETUJUI: "border-[#cfe3cb] bg-[#f2f8f1] text-[#4a7a43]",
};

const STATUS_LABEL: Record<AssessmentRow["status"], string> = {
  DRAFT: "Draf",
  MENUNGGU_PERSETUJUAN: "Menunggu persetujuan",
  DISETUJUI: "Disetujui",
};

const PREDICATE_LABEL: Record<string, string> = {
  TINGGI: "Tinggi",
  MENENGAH_KE_TINGGI: "Menengah ke Tinggi",
  MENENGAH: "Menengah",
  RENDAH_KE_MENENGAH: "Rendah ke Menengah",
  RENDAH: "Rendah",
};

const formatDate = (value: string | Date | null | undefined) =>
  value ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";

/** Akhir periode disimpan **eksklusif**; yang ditampilkan adalah hari terakhir yang tercakup. */
const inclusiveEnd = (value: string | Date) => {
  const date = new Date(value);
  date.setDate(date.getDate() - 1);
  return date;
};

const startOfYear = (year: number) => `${year}-01-01`;

export default function PenilaianRisiko() {
  const utils = trpc.useUtils();
  const [creating, setCreating] = useState(false);
  const thisYear = new Date().getFullYear();
  const [periodStart, setPeriodStart] = useState(startOfYear(thisYear));
  const [periodEnd, setPeriodEnd] = useState(startOfYear(thisYear + 1));
  const [trigger, setTrigger] = useState<"TAHUNAN" | "MANUAL">("TAHUNAN");
  const [triggerReason, setTriggerReason] = useState("");

  const assessments = trpc.ira.list.useQuery();
  const create = trpc.ira.create.useMutation({
    onSuccess: () => {
      toast.success("Penilaian dibuat.");
      setCreating(false);
      setTriggerReason("");
      void utils.ira.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = (assessments.data ?? []) as AssessmentRow[];

  return (
    <div className="space-y-6">
      <Card className="border-[#e4e9f0]">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-[#18395f]">
              <ClipboardCheck className="size-5" /> Penilaian Risiko Lembaga (IRA)
            </CardTitle>
            <CardDescription>
              Satu penilaian per periode. Sisi risiko inheren dihitung dari basis data, sisi KPMR dijawab penilai, dan
              nilai akhirnya mengikuti matriks Bank Indonesia. Penilaian yang sudah disetujui terkunci.
            </CardDescription>
          </div>
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="mr-1 size-4" /> Penilaian baru
          </Button>
        </CardHeader>
        <CardContent>
          {/* `isPending`, bukan `isLoading`: di sela percobaan ulang React Query, `isLoading`
              bernilai false sementara datanya masih kosong, dan halamannya akan menampilkan daftar
              kosong seolah-olah memang belum ada penilaian sama sekali. */}
          {assessments.isPending ? (
            <div className="space-y-2">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-12 w-full" />)}</div>
          ) : assessments.isError ? (
            <div className="rounded-2xl border border-[#f0d6d6] bg-[#fdf6f6] px-5 py-6 text-sm leading-6 text-[#9a4b4b]">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Daftar penilaian gagal dimuat.</p>
              <p className="mt-1">{assessments.error.message}</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void assessments.refetch()}>Coba lagi</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dce6f0] bg-[#f9fbfd] px-5 py-10 text-center text-sm text-[#475569]">
              <p className="font-semibold text-[#18395f]">Belum ada penilaian risiko.</p>
              <p className="mt-1">Buat penilaian untuk periode berjalan, lalu isi Form C1, Form A1, dan kuesioner KPMR-nya.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs tracking-[0.12em] text-[#94a7bb] uppercase">
                  <tr>
                    <th className="px-3 py-3">Periode</th>
                    <th className="px-3 py-3">Pemicu</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Nilai akhir</th>
                    <th className="px-3 py-3">Keterangan</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f5]">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-3 py-3 whitespace-nowrap text-[#18395f]">
                        {formatDate(row.periodStart)} – {formatDate(inclusiveEnd(row.periodEnd))}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className="border-[#dce6f0] bg-[#f7fafd] text-[10px] text-[#4a6a8f]">
                          {row.trigger === "TAHUNAN" ? "Tahunan" : "Manual"}
                        </Badge>
                        {row.triggerReason ? <p className="mt-1 max-w-[280px] text-xs text-[#475569]">{row.triggerReason}</p> : null}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {row.finalValue === null
                          ? <span className="text-[#94a7bb]">belum dinilai</span>
                          : <span className="font-semibold text-[#18395f]">{row.finalValue} · {PREDICATE_LABEL[row.finalPredicate ?? ""] ?? "—"}</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#475569]">
                        {row.supersededByAssessmentId
                          ? <span>Digantikan penilaian #{row.supersededByAssessmentId}</span>
                          : <span className="text-[#94a7bb]">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/kepatuhan/ira/${row.id}`}>
                          <Button type="button" size="sm" variant="outline">Buka</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={(open) => { if (!open) setCreating(false); }}>
        {/* `max-h-[85vh] overflow-y-auto` wajib: tanpa itu borang yang lebih tinggi daripada
            viewport menyembunyikan tombol tindakannya. */}
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Penilaian risiko baru</DialogTitle>
            <DialogDescription>
              Periode penilaian umumnya satu tahun buku. Akhir periode bersifat eksklusif — isi 1 Januari tahun berikutnya
              untuk menilai satu tahun penuh.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ira-mulai">Awal periode</Label>
                <Input id="ira-mulai" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ira-akhir">Akhir periode (eksklusif)</Label>
                <Input id="ira-akhir" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Pemicu</Label>
              <Select value={trigger} onValueChange={(value) => setTrigger(value as "TAHUNAN" | "MANUAL")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAHUNAN">Siklus tahunan</SelectItem>
                  <SelectItem value="MANUAL">Permintaan manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ira-alasan">Alasan {trigger === "MANUAL" ? "(wajib)" : "(opsional)"}</Label>
              <Textarea
                id="ira-alasan"
                value={triggerReason}
                onChange={(event) => setTriggerReason(event.target.value)}
                placeholder="Mis. permintaan pemeriksa, perubahan lini bisnis, atau penilaian ulang setelah temuan."
              />
              <p className="text-xs text-[#94a7bb]">
                Penilaian ulang pada periode yang sudah dinilai wajib bertanda pemicu manual beserta alasannya.
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>Batal</Button>
            <Button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate({
                periodStart: new Date(periodStart),
                periodEnd: new Date(periodEnd),
                trigger,
                triggerReason: triggerReason.trim() || null,
              })}
            >
              Buat penilaian
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
