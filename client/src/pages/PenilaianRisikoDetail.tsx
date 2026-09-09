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
import { IRA_BAND_DEFINITIONS, IRA_PARAMETER_CATALOGUE } from "@shared/iraParameterCatalogue";
import { AlertTriangle, ArrowLeft, Lock, RefreshCcw, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useParams } from "wouter";

/**
 * Detail satu penilaian: Form C1 (angka terhitung), Form A1 (nilai parameter), dan pernyataan
 * struktural.
 *
 * Penilaian yang sudah **DISETUJUI tampil hanya-baca seluruhnya**, dengan tombol "buat penilaian
 * pengganti" — bukan tombol sunting yang menolak saat diklik. Tombol yang menolak sesudah ditekan
 * memberitahu penggunanya terlambat, dan pada layar kepatuhan itu berarti pekerjaan yang sudah
 * diketik hilang.
 */

const PREDICATE_LABEL: Record<string, string> = {
  TINGGI: "Tinggi",
  MENENGAH_KE_TINGGI: "Menengah ke Tinggi",
  MENENGAH: "Menengah",
  RENDAH_KE_MENENGAH: "Rendah ke Menengah",
  RENDAH: "Rendah",
  UNSATISFACTORY: "Unsatisfactory",
  MARGINAL: "Marginal",
  FAIR: "Fair",
  SATISFACTORY: "Satisfactory",
  STRONG: "Strong",
};

type MachineValue = {
  code: string;
  machineScore: number | null;
  bandIndex: number | null;
  basis: Record<string, string | number | boolean | null> | null;
  missingReason: string | null;
};

const DECLARED = IRA_PARAMETER_CATALOGUE.filter((entry) => entry.source === "NYATAKAN");

export default function PenilaianRisikoDetail() {
  const params = useParams<{ id: string }>();
  const assessmentId = Number(params.id);
  const utils = trpc.useUtils();

  const detail = trpc.ira.detail.useQuery({ id: assessmentId }, { enabled: Number.isFinite(assessmentId) });
  const machine = trpc.ira.machineScores.useQuery({ id: assessmentId }, { enabled: Number.isFinite(assessmentId) });

  const [applied, setApplied] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [declarationReasons, setDeclarationReasons] = useState<Record<string, string>>({});
  const [replacing, setReplacing] = useState(false);
  const [replacementReason, setReplacementReason] = useState("");
  const [, navigate] = useLocation();

  const invalidate = () => {
    void utils.ira.detail.invalidate({ id: assessmentId });
    void utils.ira.list.invalidate();
  };

  const saveInherent = trpc.ira.saveInherent.useMutation({
    onSuccess: () => { toast.success("Nilai parameter disimpan."); invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const saveDeclarations = trpc.ira.saveDeclarations.useMutation({
    onSuccess: () => { toast.success("Pernyataan disimpan."); invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const submit = trpc.ira.submit.useMutation({
    onSuccess: () => { toast.success("Penilaian diajukan untuk disetujui."); invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const replace = trpc.ira.create.useMutation({
    onSuccess: (created) => {
      toast.success("Penilaian pengganti dibuat.");
      setReplacing(false);
      void utils.ira.list.invalidate();
      navigate(`/kepatuhan/ira/${(created as { id: number }).id}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const approve = trpc.ira.approve.useMutation({
    onSuccess: () => { toast.success("Penilaian disetujui dan nilainya dibekukan."); invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  if (detail.isPending) {
    return <div className="space-y-3">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-24 w-full" />)}</div>;
  }

  if (detail.isError) {
    return (
      <div className="rounded-2xl border border-[#f0d6d6] bg-[#fdf6f6] px-5 py-6 text-sm leading-6 text-[#9a4b4b]">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Penilaian gagal dimuat.</p>
        <p className="mt-1">{detail.error.message}</p>
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void detail.refetch()}>Coba lagi</Button>
      </div>
    );
  }

  const assessment = detail.data.assessment as {
    id: number;
    status: "DRAFT" | "MENUNGGU_PERSETUJUAN" | "DISETUJUI";
    periodStart: string | Date;
    periodEnd: string | Date;
    inherentScore: string | null;
    inherentPredicate: string | null;
    kpmrScore: string | null;
    kpmrPredicate: string | null;
    finalValue: number | null;
    finalPredicate: string | null;
    supersededByAssessmentId: number | null;
  };
  const locked = assessment.status === "DISETUJUI";
  const storedValues = new Map((detail.data.values as { parameterCode: string; appliedScore: number; overrideReason: string | null }[]).map((row) => [row.parameterCode, row]));
  const storedDeclarations = new Map((detail.data.declarations as { parameterCode: string; choiceCode: string; reason: string }[]).map((row) => [row.parameterCode, row]));
  const machineByCode = new Map(((machine.data?.values ?? []) as MachineValue[]).map((row) => [row.code, row]));

  const choiceForEarly = (code: string) => choices[code] ?? storedDeclarations.get(code)?.choiceCode ?? "";
  /**
   * Nilai parameter yang **dinyatakan** diturunkan dari pilihan pernyataannya, bukan diketik
   * terpisah: dua tempat untuk satu angka pasti berselisih, dan yang di layar belum tentu yang
   * tersimpan.
   */
  const declaredScore = (code: string): number | null => {
    const entry = IRA_PARAMETER_CATALOGUE.find((row) => row.code === code);
    if (!entry || entry.source !== "NYATAKAN") return null;
    const choice = IRA_BAND_DEFINITIONS[entry.bandType].choices?.find((row) => row.code === choiceForEarly(code));
    // Skala terbalik: pita 1 paling aman bernilai 5.
    return choice ? 6 - choice.bandIndex : null;
  };

  const appliedFor = (code: string) =>
    applied[code] ?? storedValues.get(code)?.appliedScore ?? declaredScore(code) ?? machineByCode.get(code)?.machineScore ?? null;
  const reasonFor = (code: string) => reasons[code] ?? storedValues.get(code)?.overrideReason ?? "";
  const choiceFor = (code: string) => choices[code] ?? storedDeclarations.get(code)?.choiceCode ?? "";
  const declarationReasonFor = (code: string) => declarationReasons[code] ?? storedDeclarations.get(code)?.reason ?? "";

  const form = machine.data?.form;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/kepatuhan/ira">
          <Button type="button" variant="outline" size="sm"><ArrowLeft className="mr-1 size-4" /> Daftar penilaian</Button>
        </Link>
        <div className="flex items-center gap-2">
          {locked ? (
            <>
              <Badge variant="outline" className="border-[#cfe3cb] bg-[#f2f8f1] text-[#4a7a43]"><Lock className="mr-1 size-3" /> Terkunci — sudah disetujui</Badge>
              {/* Tombol yang menjelaskan jalan keluarnya, bukan tombol sunting yang menolak saat
                  diklik: yang kedua memberitahu penggunanya terlambat, sesudah pekerjaannya diketik. */}
              <Button type="button" variant="outline" onClick={() => setReplacing(true)}>
                <RefreshCcw className="mr-1 size-4" /> Buat penilaian pengganti
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={submit.isPending} onClick={() => submit.mutate({ id: assessmentId })}>
                <Send className="mr-1 size-4" /> Ajukan
              </Button>
              <Button type="button" disabled={approve.isPending || assessment.status !== "MENUNGGU_PERSETUJUAN"} onClick={() => approve.mutate({ id: assessmentId })}>
                <ShieldCheck className="mr-1 size-4" /> Setujui
              </Button>
            </>
          )}
        </div>
      </div>

      {locked ? (
        <Card className="border-[#cfe3cb] bg-[#f6faf5]">
          <CardHeader>
            <CardTitle className="text-[#3f6b39]">Nilai beku</CardTitle>
            <CardDescription className="text-[#4a7a43]">
              Angka di bawah ini disimpan apa adanya saat disetujui, beserta ambang dan klasifikasi yang berlaku waktu itu.
              Perubahan klasifikasi sesudahnya tidak mengubahnya. Perbaikan berarti penilaian pengganti.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs tracking-[0.12em] text-[#6f8f6a] uppercase">Risiko inheren</p>
              <p className="text-lg font-semibold text-[#2f5a2a]">{assessment.inherentScore ?? "—"} · {PREDICATE_LABEL[assessment.inherentPredicate ?? ""] ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs tracking-[0.12em] text-[#6f8f6a] uppercase">KPMR</p>
              <p className="text-lg font-semibold text-[#2f5a2a]">{assessment.kpmrScore ?? "—"} · {PREDICATE_LABEL[assessment.kpmrPredicate ?? ""] ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs tracking-[0.12em] text-[#6f8f6a] uppercase">Nilai akhir</p>
              <p className="text-lg font-semibold text-[#2f5a2a]">{assessment.finalValue ?? "—"} · {PREDICATE_LABEL[assessment.finalPredicate ?? ""] ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-[#e4e9f0]">
        <CardHeader>
          <CardTitle className="text-[#18395f]">Form C1 — angka yang terhitung</CardTitle>
          <CardDescription>Komposisi lembaga selama periode penilaian, dibaca langsung dari basis data.</CardDescription>
        </CardHeader>
        <CardContent>
          {machine.isPending ? (
            <div className="space-y-2">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-10 w-full" />)}</div>
          ) : machine.isError ? (
            <div className="rounded-2xl border border-[#f0d6d6] bg-[#fdf6f6] px-5 py-6 text-sm leading-6 text-[#9a4b4b]">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Agregat Form C1 gagal dimuat.</p>
              <p className="mt-1">{machine.error.message}</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void machine.refetch()}>Coba lagi</Button>
            </div>
          ) : form ? (
            <div className="space-y-4">
              {/* Yang belum berkategori tampil di atas, bukan disembunyikan: persentase yang tampak
                  kecil karena penyebutnya belum lengkap adalah angka yang menyesatkan pemeriksa. */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Belum berjenis nasabah", value: form.customersWithoutCustomerType },
                  { label: "Belum berkategori pekerjaan", value: form.customersWithoutOccupationCategory },
                  { label: "Belum berkewarganegaraan", value: form.customersWithoutNationality },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl border px-4 py-3 ${item.value > 0 ? "border-[#f0e2c4] bg-[#fdf9f0]" : "border-[#e4e9f0] bg-[#f9fbfd]"}`}>
                    <p className="text-xs text-[#94a7bb]">{item.label}</p>
                    <p className="text-lg font-semibold text-[#18395f]">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#e4e9f0] bg-[#f9fbfd] px-4 py-3">
                  <p className="text-xs text-[#94a7bb]">Bon periode ini</p>
                  <p className="text-lg font-semibold text-[#18395f]">{form.transactionCount}</p>
                </div>
                <div className="rounded-xl border border-[#e4e9f0] bg-[#f9fbfd] px-4 py-3">
                  <p className="text-xs text-[#94a7bb]">Total omzet</p>
                  <p className="text-lg font-semibold text-[#18395f]">Rp {Number(form.totalRupiah).toLocaleString("id-ID")}</p>
                </div>
                <div className="rounded-xl border border-[#e4e9f0] bg-[#f9fbfd] px-4 py-3">
                  <p className="text-xs text-[#94a7bb]">Nasabah</p>
                  <p className="text-lg font-semibold text-[#18395f]">{form.customersTotal}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs tracking-[0.12em] text-[#94a7bb] uppercase">
                    <tr><th className="px-3 py-2">Mata uang</th><th className="px-3 py-2">Omzet</th><th className="px-3 py-2">Porsi</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0f5]">
                    {form.currencyTurnover.length === 0 ? (
                      <tr><td colSpan={3} className="px-3 py-4 text-sm text-[#94a7bb]">Tidak ada transaksi pada periode ini.</td></tr>
                    ) : form.currencyTurnover.map((row) => (
                      <tr key={row.code}>
                        <td className="px-3 py-2 font-semibold text-[#18395f]">{row.code}</td>
                        <td className="px-3 py-2">Rp {Number(row.rupiah).toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2">{row.sharePercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-[#e4e9f0]">
        <CardHeader>
          <CardTitle className="text-[#18395f]">Form A1 — nilai parameter risiko inheren</CardTitle>
          <CardDescription>
            Skalanya terbalik: <strong>5 berarti risiko rendah</strong>, 1 berarti risiko tinggi. Nilai yang berbeda dari
            angka mesin wajib menyebutkan alasannya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs tracking-[0.12em] text-[#94a7bb] uppercase">
                <tr>
                  <th className="px-3 py-3">Parameter</th>
                  <th className="px-3 py-3">Angka mesin</th>
                  <th className="px-3 py-3">Nilai terpakai</th>
                  <th className="px-3 py-3">Alasan bila menyimpang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f5]">
                {IRA_PARAMETER_CATALOGUE.map((entry) => {
                  const machineValue = machineByCode.get(entry.code);
                  const value = appliedFor(entry.code);
                  const menyimpang = machineValue?.machineScore != null && value != null && value !== machineValue.machineScore;
                  return (
                    <tr key={entry.code} className="align-top">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[#18395f]">{entry.code}</p>
                        <p className="max-w-[320px] text-xs text-[#475569]">{entry.label}</p>
                        <Badge variant="outline" className="mt-1 border-[#dce6f0] bg-[#f7fafd] text-[10px] text-[#4a6a8f]">
                          {entry.source === "HITUNG" ? "dihitung" : "dinyatakan penilai"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {entry.source === "NYATAKAN" ? (
                          <span className="text-[#94a7bb]">dinyatakan penilai</span>
                        ) : machineValue?.missingReason ? (
                          <span className="text-[#8a6d2f]">{machineValue.missingReason}</span>
                        ) : machineValue ? (
                          <>
                            <span className="text-base font-semibold text-[#18395f]">{machineValue.machineScore}</span>
                            {machineValue.basis ? (
                              <p className="mt-1 max-w-[260px] text-[11px] text-[#475569]">
                                {machineValue.basis.percent != null ? `${machineValue.basis.numerator} dari ${machineValue.basis.denominator} = ${machineValue.basis.percent}%` : null}
                                {machineValue.basis.level != null && machineValue.basis.percent == null ? `Peringkat ${machineValue.basis.level}` : null}
                                {machineValue.basis.note ? <span className="block text-[#8a6d2f]">{String(machineValue.basis.note)}</span> : null}
                              </p>
                            ) : null}
                          </>
                        ) : <span className="text-[#94a7bb]">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Select
                          value={value === null ? "" : String(value)}
                          disabled={locked}
                          onValueChange={(next) => setApplied((current) => ({ ...current, [entry.code]: Number(next) }))}
                        >
                          <SelectTrigger className="w-24"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {[5, 4, 3, 2, 1].map((score) => <SelectItem key={score} value={String(score)}>{score}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          className="w-64"
                          disabled={locked || !menyimpang}
                          value={reasonFor(entry.code)}
                          placeholder={menyimpang ? "Wajib diisi" : "—"}
                          onChange={(event) => setReasons((current) => ({ ...current, [entry.code]: event.target.value }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {locked ? null : (
            <div className="flex items-center justify-end gap-3">
              {IRA_PARAMETER_CATALOGUE.filter((entry) => appliedFor(entry.code) === null).length > 0 ? (
                <p className="text-xs text-[#8a6d2f]">
                  {IRA_PARAMETER_CATALOGUE.filter((entry) => appliedFor(entry.code) === null).length} parameter belum bernilai —
                  penilaian tidak dapat disetujui sebelum seluruhnya terisi.
                </p>
              ) : null}
              <Button
                type="button"
                disabled={saveInherent.isPending}
                onClick={() => {
                  // Parameter yang belum bernilai **tidak** dikirim. Mengirimnya dengan nilai
                  // bawaan berarti mengarang angka teraman bagi parameter yang justru belum
                  // dinilai siapa pun, dan penilaiannya akan tampak lengkap padahal belum.
                  const values = IRA_PARAMETER_CATALOGUE.flatMap((entry) => {
                    const machineValue = machineByCode.get(entry.code);
                    const score = appliedFor(entry.code);
                    if (score === null) return [];
                    return [{
                      parameterCode: entry.code,
                      machineScore: machineValue?.machineScore ?? null,
                      appliedScore: score,
                      bandIndex: machineValue?.bandIndex ?? null,
                      overrideReason: reasonFor(entry.code).trim() || null,
                      basis: machineValue?.basis ?? null,
                    }];
                  });
                  if (values.length === 0) {
                    toast.error("Belum ada satu pun parameter yang bernilai.");
                    return;
                  }
                  saveInherent.mutate({ assessmentId, values });
                }}
              >
                Simpan nilai parameter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#e4e9f0]">
        <CardHeader>
          <CardTitle className="text-[#18395f]">Pernyataan struktural</CardTitle>
          <CardDescription>
            Sembilan parameter yang tidak dapat dihitung dari basis data — kepemilikan, mitra kerja sama, dan lini bisnis.
            Semuanya <strong>dinyatakan penilai</strong> beserta dasarnya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DECLARED.map((entry) => {
            const choicesFor = IRA_BAND_DEFINITIONS[entry.bandType].choices ?? [];
            return (
              <div key={entry.code} className="rounded-xl border border-[#e4e9f0] bg-[#f9fbfd] px-4 py-3">
                <p className="font-semibold text-[#18395f]">{entry.code} · {entry.label}</p>
                <p className="mt-1 text-xs text-[#475569]">{entry.criterion}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr]">
                  <div className="space-y-1">
                    <Label>Pernyataan</Label>
                    <Select
                      value={choiceFor(entry.code)}
                      disabled={locked}
                      onValueChange={(next) => setChoices((current) => ({ ...current, [entry.code]: next }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                      <SelectContent>
                        {choicesFor.map((choice) => <SelectItem key={choice.code} value={choice.code}>{choice.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Dasar pernyataan</Label>
                    <Textarea
                      rows={2}
                      disabled={locked}
                      value={declarationReasonFor(entry.code)}
                      onChange={(event) => setDeclarationReasons((current) => ({ ...current, [entry.code]: event.target.value }))}
                      placeholder="Mis. Akta No.03 14 November 2025; seluruh pemegang saham perorangan."
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {locked ? null : (
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={saveDeclarations.isPending}
                onClick={() => {
                  const declarations = DECLARED
                    .filter((entry) => choiceFor(entry.code) && declarationReasonFor(entry.code).trim())
                    .map((entry) => ({ parameterCode: entry.code, choiceCode: choiceFor(entry.code), reason: declarationReasonFor(entry.code).trim() }));
                  if (declarations.length === 0) {
                    toast.error("Isi pernyataan beserta dasarnya lebih dulu.");
                    return;
                  }
                  saveDeclarations.mutate({ assessmentId, declarations });
                }}
              >
                Simpan pernyataan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={replacing} onOpenChange={(open) => { if (!open) setReplacing(false); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Penilaian pengganti</DialogTitle>
            <DialogDescription>
              Penilaian ini tetap tersimpan apa adanya dan akan ditandai digantikan ketika penggantinya disetujui.
              Periodenya sama; pemicunya manual, dan alasannya wajib.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="ira-alasan-ganti">Alasan penggantian</Label>
            <Textarea
              id="ira-alasan-ganti"
              value={replacementReason}
              onChange={(event) => setReplacementReason(event.target.value)}
              placeholder="Mis. koreksi nilai parameter TPPU_1A setelah klasifikasi USD diperbarui."
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReplacing(false)}>Batal</Button>
            <Button
              type="button"
              disabled={replace.isPending || replacementReason.trim().length < 3}
              onClick={() => replace.mutate({
                periodStart: new Date(assessment.periodStart),
                periodEnd: new Date(assessment.periodEnd),
                trigger: "MANUAL",
                triggerReason: replacementReason.trim(),
              })}
            >
              Buat pengganti
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
