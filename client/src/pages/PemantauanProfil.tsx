import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Pemantauan berkala profil transaksi nasabah — worklist Controller.
 *
 * Halaman ini **hanya mencatat**: menutup peninjauan menulis satu baris jejak dan tidak mengubah
 * data nasabah, tidak memblokir transaksi, dan tidak mengirim laporan ke regulator mana pun.
 */

const REASON_LABELS: Record<string, string> = {
  PROFIL_BELUM_DIDEKLARASIKAN: "Belum mendeklarasikan profil",
  NILAI_BULANAN_MELEBIHI_PROFIL: "Nilai sebulan mencapai dua kali lipat deklarasi",
  FREKUENSI_BULANAN_MELEBIHI_PROFIL: "Frekuensi sebulan mencapai dua kali lipat deklarasi",
  MATA_UANG_TIDAK_DIDEKLARASIKAN: "Memakai mata uang di luar deklarasi",
};

const OUTCOME_LABELS: Record<string, string> = {
  TIDAK_ADA_PERUBAHAN: "Tidak ada perubahan",
  ADA_PERUBAHAN: "Ada perubahan data",
  PERLU_TINDAK_LANJUT: "Perlu tindak lanjut",
};

const RISK_LABELS: Record<string, string> = { LOW: "Rendah", MEDIUM: "Menengah", HIGH: "Tinggi" };

const rupiah = (value: string | number | null) =>
  value === null || value === undefined ? "Belum dideklarasikan" : `Rp ${Number(value).toLocaleString("id-ID")}`;

const formatDate = (value: string | Date | null | undefined) =>
  value ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";

export default function PemantauanProfil() {
  const utils = trpc.useUtils();
  const worklist = trpc.customerProfileMonitoring.list.useQuery({});
  const [reviewing, setReviewing] = useState<{ customerId: number; fullName: string } | null>(null);
  const [outcome, setOutcome] = useState<"TIDAK_ADA_PERUBAHAN" | "ADA_PERUBAHAN" | "PERLU_TINDAK_LANJUT">("TIDAK_ADA_PERUBAHAN");
  const [notes, setNotes] = useState("");

  const record = trpc.customerProfileMonitoring.record.useMutation({
    onSuccess: () => {
      toast.success("Peninjauan tercatat. Data nasabah tidak diubah.");
      setReviewing(null);
      setNotes("");
      setOutcome("TIDAK_ADA_PERUBAHAN");
      utils.customerProfileMonitoring.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const submitReview = () => {
    if (!reviewing) return;
    if (outcome !== "TIDAK_ADA_PERUBAHAN" && !notes.trim()) {
      return toast.error("Jelaskan perubahan atau tindak lanjut yang ditemukan pada peninjauan ini.");
    }
    record.mutate({ customerId: reviewing.customerId, outcome, notes: notes.trim() || undefined });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section>
        <h1 className="font-display text-2xl text-[#18395f]">Pemantauan Profil Nasabah</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">
          Nasabah yang jatuh tempo ditinjau menurut peringkat risikonya — risiko tinggi sebulan sekali,
          menengah tiga bulan sekali, rendah setahun sekali. Nasabah yang belum pernah ditinjau selalu
          jatuh tempo.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#dce6f0] bg-[#f7fafd] px-4 py-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#5c8f53]" />
          <p className="text-xs leading-5 text-[#475569]">
            <b className="text-[#18395f]">Alat bantu penyaringan, bukan keputusan.</b> Menutup peninjauan
            di sini hanya menulis catatan peninjauannya. Halaman ini tidak mengubah data nasabah, tidak
            memblokir transaksi, dan tidak mengirim laporan apa pun ke PPATK maupun Bank Indonesia —
            pelaporan tetap dilakukan petugas secara manual sesuai prosedur resmi.
          </p>
        </div>
      </section>

      <Card className="border-[#dce6f0] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]">
            <ClipboardCheck className="size-5 text-[#5c8f53]" /> Jatuh tempo ditinjau
          </CardTitle>
          <CardDescription>
            Deklarasi nasabah disandingkan dengan aktivitas nyatanya bulan berjalan, agar peninjau
            melihat angkanya dan bukan hanya benderanya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {worklist.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : worklist.isError ? (
            <div className="rounded-xl border border-[#f0d6d6] bg-[#fdf6f6] p-4">
              <p className="text-sm text-[#9a4b4b]">Worklist tidak dapat dimuat: {worklist.error.message}</p>
              <Button className="mt-3" variant="outline" onClick={() => worklist.refetch()}>Coba lagi</Button>
            </div>
          ) : !worklist.data?.length ? (
            <div className="rounded-xl border border-dashed border-[#dce6f0] p-8 text-center">
              <CheckCircle2 className="mx-auto size-8 text-[#8fb98a]" />
              <p className="mt-3 text-sm font-semibold text-[#213f63]">Tidak ada nasabah yang jatuh tempo ditinjau.</p>
              <p className="mx-auto mt-1 max-w-xl text-sm text-[#718398]">
                Setiap nasabah sudah ditinjau di dalam iramanya masing-masing. Nasabah akan muncul lagi
                di sini ketika iramanya jatuh tempo berikutnya, atau begitu ada nasabah baru yang belum
                pernah ditinjau.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {worklist.data.map((row) => (
                <li key={row.customerId} className="rounded-2xl border border-[#e2eaf2] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#18395f]">{row.fullName}</p>
                      <p className="text-xs text-[#718398]">
                        {row.cifNumber} · Risiko {RISK_LABELS[row.riskLevel] ?? row.riskLevel} · ditinjau tiap {row.intervalMonths} bulan
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="press-scale bg-[#183f70] text-white hover:bg-[#12345d]"
                      onClick={() => setReviewing({ customerId: row.customerId, fullName: row.fullName })}
                    >
                      Catat peninjauan
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.reasons.length === 0 ? (
                      <Badge variant="outline" className="border-[#cfe2d6] bg-[#f5fbf5] text-[#3c6f48]">
                        Tidak ada penyimpangan terlihat — jatuh tempo menurut irama
                      </Badge>
                    ) : row.reasons.map((reason) => (
                      <Badge
                        key={reason}
                        variant="outline"
                        className={reason === "PROFIL_BELUM_DIDEKLARASIKAN"
                          ? "border-[#e4dcc4] bg-[#fdfaf0] text-[#7a6626]"
                          : "border-[#f0d6d6] bg-[#fdf6f6] text-[#9a4b4b]"}
                      >
                        {REASON_LABELS[reason] ?? reason}
                        {reason === "MATA_UANG_TIDAK_DIDEKLARASIKAN" && row.undeclaredCurrencies.length > 0
                          ? `: ${row.undeclaredCurrencies.join(", ")}`
                          : ""}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#f9fbfd] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#7b8fa5]">Dideklarasikan nasabah</p>
                      <dl className="mt-2 space-y-1 text-sm text-[#33506f]">
                        <div className="flex justify-between gap-3"><dt>Nilai sebulan</dt><dd>{rupiah(row.declaration.declaredMonthlyValueIdr)}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Banyaknya transaksi</dt><dd>{row.declaration.declaredMonthlyCount ?? "Belum dideklarasikan"}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Mata uang</dt><dd>{row.declaration.declaredCurrencies?.length ? row.declaration.declaredCurrencies.join(", ") : "Belum dideklarasikan"}</dd></div>
                      </dl>
                    </div>
                    <div className="rounded-xl bg-[#f9fbfd] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#7b8fa5]">Aktivitas nyata bulan ini</p>
                      <dl className="mt-2 space-y-1 text-sm text-[#33506f]">
                        <div className="flex justify-between gap-3"><dt>Nilai sebulan</dt><dd>{rupiah(row.activity.totalValueIdr)}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Banyaknya transaksi</dt><dd>{row.activity.transactionCount}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Mata uang</dt><dd>{row.activity.currencyCodes.length ? row.activity.currencyCodes.join(", ") : "—"}</dd></div>
                      </dl>
                      {row.valueThresholdIdr !== null || row.countThreshold !== null ? (
                        <p className="mt-2 text-xs text-[#7b8fa5]">
                          Ambang: {row.valueThresholdIdr !== null ? rupiah(row.valueThresholdIdr) : "—"}
                          {row.countThreshold !== null ? ` · ${row.countThreshold} transaksi` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-[#718398]">
                    {row.neverReviewed
                      ? "Belum pernah ditinjau."
                      : `Peninjauan terakhir ${formatDate(row.lastReviewedAt)} — ${OUTCOME_LABELS[row.lastOutcome ?? ""] ?? row.lastOutcome}.`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => { if (!open) setReviewing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat peninjauan — {reviewing?.fullName}</DialogTitle>
            <DialogDescription>
              Tersimpan sebagai catatan peninjauan beserta alasan penyimpangan yang terlihat saat ini.
              Data nasabah tidak diubah oleh tindakan ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#476278]">Hasil peninjauan</Label>
              <Select value={outcome} onValueChange={(value) => setOutcome(value as typeof outcome)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#476278]">
                Keterangan{outcome !== "TIDAK_ADA_PERUBAHAN" ? <span className="ml-1 text-rose-500">*</span> : null}
              </Label>
              <Textarea
                value={notes}
                rows={3}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Apa yang ditemukan, dan tindak lanjut apa yang disepakati."
              />
              <p className="text-xs text-[#94a7bb]">
                Wajib diisi bila hasilnya bukan &quot;tidak ada perubahan&quot; — peninjauan tanpa keterangan
                tidak dapat ditindaklanjuti siapa pun.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReviewing(null)}>Batal</Button>
              <Button
                type="button"
                disabled={record.isPending}
                onClick={submitReview}
                className="press-scale bg-[#183f70] text-white hover:bg-[#12345d]"
              >
                {record.isPending ? "Menyimpan…" : "Simpan peninjauan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
