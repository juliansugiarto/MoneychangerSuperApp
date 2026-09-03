import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PROFILE_REVIEW_INTERVAL_MONTHS, PROFILE_REVIEW_OUTCOME_LABELS, type ProfileReviewStatus } from "@shared/employeeProfileReview";
import { trpc } from "@/lib/trpc";
import { printLampiranRealisasi } from "@/lib/lampiranRealisasi";
import { printLampiranSdm } from "@/lib/lampiranSdm";
import { PIC_ROLE_TITLES, printSuratKeputusan, suggestDecreeNumber } from "@/lib/suratKeputusan";
import { TRAINING_METHOD_LABELS, printSuratPelatihan, suggestTrainingLetterNumber } from "@/lib/suratPelatihan";
import { Award, CalendarCheck, Download, FileCheck2, GraduationCap, Printer, ShieldCheck, UserPlus, UserSearch, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const JOB_LEVEL_LABELS: Record<string, string> = {
  KOMISARIS: "Komisaris",
  DIREKSI: "Direksi",
  PEJABAT_EKSEKUTIF: "Pejabat eksekutif",
  PENYELIA: "Penyelia / Supervisor",
  PELAKSANA: "Pelaksana",
};

const TRACK_LABELS: Record<string, string> = {
  PBK: "PBK Sistem Pembayaran",
  SERTIFIKASI_KOMPETENSI: "Sertifikasi Kompetensi SP",
  TIDAK_WAJIB: "Tidak wajib bersertifikat",
};

const PIC_LABELS: Record<string, string> = {
  INTERNAL_AUDIT: "Audit internal",
  MANAJEMEN_RISIKO: "Manajemen risiko",
  APU_PPT: "APU PPT",
  PERLINDUNGAN_KONSUMEN: "Perlindungan konsumen",
  NASABAH_RISIKO_TINGGI: "Nasabah berisiko tinggi",
};

const SCREENING_LABELS: Record<string, string> = {
  DALAM_PROSES: "Dalam proses",
  LULUS: "Lulus",
  TIDAK_LULUS: "Tidak lulus",
};

const CANDIDATE_DECISION_LABELS: Record<string, string> = {
  DALAM_PROSES: "Belum diputuskan",
  DITERIMA: "Diterima",
  TIDAK_DITERIMA: "Tidak diterima",
};

const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Sebutan ringkas metode pelatihan untuk daftar riwayat. */
const TRAINING_METHOD_SHORT: Record<string, string> = {
  IN_HOUSE: "Tatap muka",
  EKSTERNAL: "Eksternal",
  DARING: "Daring",
};

const monthYear = (value: string) => new Date(value).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

/**
 * Periode pemenuhan tahunan: dua belas bulan penuh yang berakhir pada bulan berjalan, sehingga
 * rekap yang tercetak selalu mencakup satu tahun pelatihan, bukan sisa tahun kalender.
 */
const defaultTrainingPeriod = (() => {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const iso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
})();

const currentQuarter = () => (Math.floor(new Date().getMonth() / 3) + 1) as 1 | 2 | 3 | 4;

export default function Kepegawaian() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const canManage = user?.role === "CONTROLLER" || user?.role === "SHAREHOLDER";

  const employees = trpc.sdm.employees.useQuery();
  const certifications = trpc.sdm.certifications.useQuery();
  const picAssignments = trpc.sdm.picAssignments.useQuery();
  const competencyCodes = trpc.sdm.competencyCodes.useQuery();
  const companyProfile = trpc.companyProfile.get.useQuery();

  const emptyReview = { employeeId: "", reviewedAt: new Date().toISOString().slice(0, 10), outcome: "TIDAK_ADA_PERUBAHAN", notes: "" };
  const [reviewForm, setReviewForm] = useState(emptyReview);
  const today = new Date().toISOString().slice(0, 10);
  const emptyCandidate = { fullName: "", identityNumber: "", appliedPosition: "", appliedAt: today, notes: "" };
  const [candidateForm, setCandidateForm] = useState(emptyCandidate);
  const emptyScreening = { candidateId: "", screeningResult: "LULUS", screenedAt: today, screeningNotes: "" };
  const [screeningForm, setScreeningForm] = useState(emptyScreening);
  const emptyDecision = { candidateId: "", decision: "DITERIMA", decidedAt: today, employeeId: "" };
  const [decisionForm, setDecisionForm] = useState(emptyDecision);
  const emptyTraining = { heldAt: "", topic: "", method: "IN_HOUSE", facilitator: "", materials: "", notes: "", attendeeIds: [] as number[] };
  const [trainingForm, setTrainingForm] = useState(emptyTraining);
  const [trainingPeriod, setTrainingPeriod] = useState(defaultTrainingPeriod);
  const [trainingLetterNumber, setTrainingLetterNumber] = useState("");

  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(currentQuarter());
  const report = trpc.sdm.quarterlyReport.useQuery({ year, quarter }, { enabled: canManage });
  const annualPlan = trpc.sdm.annualPlan.useQuery({ year }, { enabled: canManage });
  const [track, setTrack] = useState<"PBK" | "KOMPETENSI">("PBK");
  const realisasi = trpc.sdm.realisasiReport.useQuery({ year, quarter, track }, { enabled: canManage });
  const profileReviewSchedule = trpc.sdm.profileReviewSchedule.useQuery();
  const candidates = trpc.sdm.candidates.useQuery();
  const trainingSessions = trpc.sdm.trainingSessions.useQuery();
  const trainingRecap = trpc.sdm.trainingRecap.useQuery(
    { from: trainingPeriod.from, to: trainingPeriod.to },
    { enabled: canManage && Boolean(trainingPeriod.from && trainingPeriod.to) },
  );

  const refresh = () => {
    utils.sdm.employees.invalidate();
    utils.sdm.certifications.invalidate();
    utils.sdm.picAssignments.invalidate();
    utils.sdm.quarterlyReport.invalidate();
    utils.sdm.annualPlan.invalidate();
    utils.sdm.realisasiReport.invalidate();
    utils.sdm.profileReviewSchedule.invalidate();
    utils.sdm.candidates.invalidate();
    utils.sdm.trainingSessions.invalidate();
    utils.sdm.trainingRecap.invalidate();
  };

  const createEmployee = trpc.sdm.createEmployee.useMutation({
    onSuccess: () => { toast.success("Pegawai tercatat."); refresh(); setEmployeeForm(emptyEmployee); },
    onError: (error) => toast.error(error.message),
  });
  const recordCertification = trpc.sdm.recordCertification.useMutation({
    onSuccess: () => { toast.success("Sertifikat tercatat."); refresh(); setCertForm(emptyCert); },
    onError: (error) => toast.error(error.message),
  });
  const assignPic = trpc.sdm.assignPicRole.useMutation({
    onSuccess: () => { toast.success("Penunjukan tercatat."); refresh(); setPicForm(emptyPic); },
    onError: (error) => toast.error(error.message),
  });
  const setPlan = trpc.sdm.setPlan.useMutation({
    onSuccess: () => { toast.success("Rencana disimpan."); refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const recordProfileReview = trpc.sdm.recordProfileReview.useMutation({
    onSuccess: () => { toast.success("Peninjauan tercatat."); refresh(); setReviewForm(emptyReview); },
    onError: (error) => toast.error(error.message),
  });
  const recordCandidate = trpc.sdm.recordCandidate.useMutation({
    onSuccess: () => { toast.success("Calon pegawai tercatat dan dicocokkan dengan daftar sanksi."); refresh(); setCandidateForm(emptyCandidate); },
    onError: (error) => toast.error(error.message),
  });
  const screenCandidate = trpc.sdm.screenCandidate.useMutation({
    onSuccess: () => { toast.success("Hasil penyaringan tersimpan."); refresh(); setScreeningForm(emptyScreening); },
    onError: (error) => toast.error(error.message),
  });
  const decideCandidate = trpc.sdm.decideCandidate.useMutation({
    onSuccess: () => { toast.success("Keputusan tersimpan."); refresh(); setDecisionForm(emptyDecision); },
    onError: (error) => toast.error(error.message),
  });
  const recordTraining = trpc.sdm.recordTraining.useMutation({
    onSuccess: () => { toast.success("Pelatihan tercatat."); refresh(); setTrainingForm(emptyTraining); },
    onError: (error) => toast.error(error.message),
  });
  const exportFile = trpc.sdm.exportTextFile.useMutation({
    onSuccess: (result) => {
      const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = result.fileName; anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Berkas ${result.form.toUpperCase()} siap diunggah ke pelaporan.bi.go.id.`);
    },
    onError: (error) => toast.error(error.message),
  });

  const emptyEmployee = { fullName: "", position: "", jobLevel: "PELAKSANA", competencyTrack: "TIDAK_WAJIB", competencyLevel: "", joinedAt: "", identityNumber: "", address: "", education: "", employmentAgreementNumber: "", employmentAgreementAt: "", screeningResult: "", screeningNotes: "" };
  const emptyCert = { employeeId: "", competencyCode: "", issuedAt: "", certificateNumber: "", expiresAt: "" };
  const emptyPic = { employeeId: "", picRole: "APU_PPT", assignedAt: "", decreeNumber: "", decreeAt: "" };
  const nextDecreeNumber = (picRole: string) => {
    const year = new Date().getFullYear();
    const used = (picAssignments.data ?? []).filter((row) => row.picRole === picRole).length;
    return suggestDecreeNumber(picRole, companyProfile.data?.legalEntityName ?? "", used + 1, year);
  };
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee);
  const [certForm, setCertForm] = useState(emptyCert);
  const [picForm, setPicForm] = useState(emptyPic);

  const candidateOptions = useMemo(
    () => Object.fromEntries((candidates.data?.rows ?? []).map((row) => [String(row.id), `${row.fullName} — ${row.appliedPosition}`])),
    [candidates.data],
  );

  const signatory = useMemo(
    () => (employees.data ?? []).find((row) => row.jobLevel === "DIREKSI" && row.employmentStatus === "AKTIF"),
    [employees.data],
  );

  const printLetter = (assignment: { employeeId: number; picRole: string; decreeNumber: string | null; decreeAt: string | Date | null; assignedAt: string | Date }) => {
    const employee = employees.data?.find((row) => row.id === assignment.employeeId);
    if (!employee) return toast.error("Data pegawai tidak ditemukan.");
    if (!signatory) return toast.error("Belum ada direksi aktif yang dapat menandatangani surat.");
    if (!companyProfile.data?.legalEntityName) return toast.error("Nama badan hukum belum diisi pada Profil Perusahaan.");
    if (!employee.identityNumber || !employee.address) {
      // Surat yang tercetak dengan tanda hubung di kolom identitas tidak layak ditandatangani.
      return toast.error("Lengkapi No. KTP dan alamat pegawai sebelum mencetak surat keputusan.");
    }
    const asDate = (value: string | Date | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");
    printSuratKeputusan({
      decreeNumber: assignment.decreeNumber ?? nextDecreeNumber(assignment.picRole),
      roleTitle: PIC_ROLE_TITLES[assignment.picRole] ?? "Penanggung Jawab",
      effectiveAt: asDate(assignment.assignedAt),
      signedAt: asDate(assignment.decreeAt) || asDate(assignment.assignedAt),
      signedCity: (companyProfile.data.address ?? "").split(",").slice(-2)[0]?.trim() || "—",
      employee: { fullName: employee.fullName, identityNumber: employee.identityNumber, address: employee.address },
      signatory: { fullName: signatory.fullName, position: signatory.position },
      company: {
        legalEntityName: companyProfile.data.legalEntityName,
        address: companyProfile.data.address,
        phone: companyProfile.data.phone,
      },
    });
  };

  const printAnnualPlan = () => {
    if (!annualPlan.data) return;
    if (!signatory) return toast.error("Belum ada direksi aktif yang dapat menandatangani lampiran.");
    if (!companyProfile.data?.legalEntityName) return toast.error("Nama badan hukum belum diisi pada Profil Perusahaan.");
    printLampiranSdm({
      ...annualPlan.data,
      lampiran: annualPlan.data.lampiran as "X" | "XI",
      company: { legalEntityName: companyProfile.data.legalEntityName, address: companyProfile.data.address },
      signatory: { fullName: signatory.fullName, position: signatory.position },
      signedCity: (companyProfile.data.address ?? "").split(",").slice(-2)[0]?.trim() || "—",
      signedAt: new Date().toISOString().slice(0, 10),
    });
  };

  const printRealisasi = () => {
    if (!realisasi.data) return;
    if (!signatory) return toast.error("Belum ada direksi aktif yang dapat menandatangani laporan.");
    if (!companyProfile.data?.legalEntityName) return toast.error("Nama badan hukum belum diisi pada Profil Perusahaan.");
    printLampiranRealisasi({
      ...realisasi.data,
      lampiran: realisasi.data.lampiran as "X" | "XI",
      company: { legalEntityName: companyProfile.data.legalEntityName },
      signatory: { fullName: signatory.fullName, position: signatory.position },
      signedCity: (companyProfile.data.address ?? "").split(",").slice(-2)[0]?.trim() || "—",
      signedAt: new Date().toISOString().slice(0, 10),
    });
  };

  const suggestedTrainingLetterNumber = suggestTrainingLetterNumber(new Date().toISOString().slice(0, 10), 1);

  const printTrainingLetter = () => {
    const recap = trainingRecap.data;
    if (!recap?.sessions.length) return toast.error("Belum ada pelatihan pada periode ini.");
    if (!signatory) return toast.error("Belum ada direksi aktif yang dapat menandatangani surat.");
    if (!companyProfile.data?.legalEntityName) return toast.error("Nama badan hukum belum diisi pada Profil Perusahaan.");
    printSuratPelatihan({
      letterNumber: trainingLetterNumber.trim() || suggestedTrainingLetterNumber,
      periodLabel: `${monthYear(recap.from)} - ${monthYear(recap.to)}`,
      topics: recap.sessions.map((session) => session.topic),
      methods: recap.sessions.map((session) => TRAINING_METHOD_LABELS[session.method] ?? session.method),
      facilitators: recap.sessions.map((session) => session.facilitator),
      materials: recap.sessions.flatMap((session) => (session.materials ?? "").split("\n").map((line) => line.trim()).filter(Boolean)),
      signedCity: (companyProfile.data.address ?? "").split(",").slice(-2)[0]?.trim() || "—",
      signedAt: new Date().toISOString().slice(0, 10),
      signatory: { fullName: signatory.fullName, position: signatory.position },
      company: {
        legalEntityName: companyProfile.data.legalEntityName,
        address: companyProfile.data.address,
        phone: companyProfile.data.phone,
      },
      rows: recap.rows.map((row) => ({ fullName: row.fullName, position: row.position, lastTrainedAt: row.lastTrainedAt })),
    });
  };

  const activeStaff = useMemo(() => (employees.data ?? []).filter((row) => row.employmentStatus === "AKTIF"), [employees.data]);
  const withoutAgreement = activeStaff.filter((row) => !row.employmentAgreementNumber && row.jobLevel !== "KOMISARIS" && row.jobLevel !== "DIREKSI");
  const withoutScreening = activeStaff.filter((row) => !row.screeningResult);
  const certificationCount = (employeeId: number) => (certifications.data ?? []).filter((row) => row.employeeId === employeeId).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <p className="max-w-3xl text-sm leading-6 text-[#475569]">
        Catatan pegawai, sertifikat kompetensi Sistem Pembayaran, dan penunjukan penanggung jawab fungsi.
        Angka laporan triwulanan ke pelaporan.bi.go.id disusun dari catatan di halaman ini, bukan diketik terpisah.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={<Users className="size-5" />} label="Pegawai aktif" value={activeStaff.length} loading={employees.isLoading} />
        <SummaryTile icon={<FileCheck2 className="size-5" />} label="Tanpa Perjanjian Kerja" value={withoutAgreement.length} tone={withoutAgreement.length ? "warn" : "ok"} loading={employees.isLoading} />
        <SummaryTile icon={<ShieldCheck className="size-5" />} label="Tanpa hasil penyaringan" value={withoutScreening.length} tone={withoutScreening.length ? "warn" : "ok"} loading={employees.isLoading} />
        <SummaryTile icon={<CalendarCheck className="size-5" />} label="Profil terlambat ditinjau" value={profileReviewSchedule.data?.overdue ?? 0} tone={profileReviewSchedule.data?.overdue ? "warn" : "ok"} loading={profileReviewSchedule.isLoading} />
      </div>

      <Tabs defaultValue="pegawai">
        <TabsList className="h-auto w-full flex-wrap gap-1.5 rounded-2xl border-2 border-[#183f70]/15 bg-[#eef3f9] p-1.5">
          <TabsTrigger value="pegawai" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><Users className="mr-1.5 size-4" />Pegawai</TabsTrigger>
          <TabsTrigger value="calon" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><UserSearch className="mr-1.5 size-4" />Calon Pegawai</TabsTrigger>
          <TabsTrigger value="sertifikat" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><Award className="mr-1.5 size-4" />Sertifikat</TabsTrigger>
          <TabsTrigger value="pic" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><ShieldCheck className="mr-1.5 size-4" />Penanggung Jawab</TabsTrigger>
          <TabsTrigger value="pelatihan" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><GraduationCap className="mr-1.5 size-4" />Pelatihan</TabsTrigger>
          <TabsTrigger value="laporan" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><Download className="mr-1.5 size-4" />Laporan Triwulan</TabsTrigger>
          <TabsTrigger value="realisasi" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><Award className="mr-1.5 size-4" />Realisasi</TabsTrigger>
          <TabsTrigger value="rencana" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><FileCheck2 className="mr-1.5 size-4" />Rencana Tahunan</TabsTrigger>
        </TabsList>

        {/* ------------------------------- Pegawai ------------------------------- */}
        <TabsContent value="pegawai" className="mt-5 space-y-4">
          {canManage ? (
            <Card className="border-[#dce6f0]">
              <CardHeader>
                <CardTitle className="font-display text-xl text-[#18395f]">Tambah pegawai</CardTitle>
                <CardDescription>Perjanjian Kerja dan hasil penyaringan calon pegawai adalah bukti yang diminta pemeriksa; isi sedini mungkin.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 lg:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!employeeForm.joinedAt) return toast.error("Tanggal masuk wajib diisi.");
                    createEmployee.mutate({
                      fullName: employeeForm.fullName,
                      position: employeeForm.position,
                      jobLevel: employeeForm.jobLevel as never,
                      competencyTrack: employeeForm.competencyTrack as never,
                      competencyLevel: (employeeForm.competencyLevel || undefined) as never,
                      joinedAt: new Date(employeeForm.joinedAt),
                      identityNumber: employeeForm.identityNumber || undefined,
                      address: employeeForm.address || undefined,
                      education: employeeForm.education || undefined,
                      employmentAgreementNumber: employeeForm.employmentAgreementNumber || undefined,
                      employmentAgreementAt: employeeForm.employmentAgreementAt ? new Date(employeeForm.employmentAgreementAt) : undefined,
                      screeningResult: (employeeForm.screeningResult || undefined) as never,
                      screeningNotes: employeeForm.screeningNotes || undefined,
                    });
                  }}
                >
                  <Field label="Nama lengkap" value={employeeForm.fullName} onChange={(v) => setEmployeeForm({ ...employeeForm, fullName: v })} required />
                  <Field label="Jabatan" value={employeeForm.position} onChange={(v) => setEmployeeForm({ ...employeeForm, position: v })} required />
                  <Picker label="Jenjang" value={employeeForm.jobLevel} options={JOB_LEVEL_LABELS} onChange={(v) => setEmployeeForm({ ...employeeForm, jobLevel: v })} />
                  <Picker label="Jalur kompetensi" value={employeeForm.competencyTrack} options={TRACK_LABELS} onChange={(v) => setEmployeeForm({ ...employeeForm, competencyTrack: v })} hint="Menentukan kewajiban sertifikasi pada laporan triwulanan." />
                  <Picker label="Jenjang pelaporan kompetensi" value={employeeForm.competencyLevel} options={JOB_LEVEL_LABELS} onChange={(v) => setEmployeeForm({ ...employeeForm, competencyLevel: v })} placeholder="Sama dengan jenjang" hint="Isi bila sertifikat terbit pada jenjang berbeda — mis. direktur bersertifikat Pejabat Eksekutif." />
                  <Field label="Tanggal masuk" type="date" value={employeeForm.joinedAt} onChange={(v) => setEmployeeForm({ ...employeeForm, joinedAt: v })} required />
                  <Field label="Pendidikan terakhir" value={employeeForm.education} onChange={(v) => setEmployeeForm({ ...employeeForm, education: v })} />
                  <Field label="No. KTP" value={employeeForm.identityNumber} onChange={(v) => setEmployeeForm({ ...employeeForm, identityNumber: v })} hint="Tercetak pada surat keputusan penunjukan." />
                  <Field label="Alamat" value={employeeForm.address} onChange={(v) => setEmployeeForm({ ...employeeForm, address: v })} />
                  <Field label="Nomor Perjanjian Kerja" value={employeeForm.employmentAgreementNumber} onChange={(v) => setEmployeeForm({ ...employeeForm, employmentAgreementNumber: v })} />
                  <Field label="Tanggal Perjanjian Kerja" type="date" value={employeeForm.employmentAgreementAt} onChange={(v) => setEmployeeForm({ ...employeeForm, employmentAgreementAt: v })} />
                  <Picker label="Hasil penyaringan calon pegawai" value={employeeForm.screeningResult} options={{ "": "Belum dilakukan", ...SCREENING_LABELS }} onChange={(v) => setEmployeeForm({ ...employeeForm, screeningResult: v })} />
                  <div className="lg:col-span-2">
                    <Label className="text-xs">Catatan penyaringan</Label>
                    <Textarea autoComplete="off" className="mt-1 min-h-20" placeholder="Sumber pemeriksaan, hasil, dan siapa yang memeriksa." value={employeeForm.screeningNotes} onChange={(event) => setEmployeeForm({ ...employeeForm, screeningNotes: event.target.value })} />
                  </div>
                  <div className="lg:col-span-2">
                    <Button type="submit" disabled={createEmployee.isPending} className="bg-[#183f70] text-white hover:bg-[#12345d]"><UserPlus className="mr-2 size-4" />Simpan pegawai</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-[#dce6f0]">
            <CardHeader><CardTitle className="font-display text-xl text-[#18395f]">Struktur organisasi</CardTitle></CardHeader>
            <CardContent>
              {employees.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat pegawai…</p> : null}
              {!employees.isLoading && !employees.data?.length ? <EmptyNote text="Belum ada pegawai tercatat. Mulai dari direksi dan komisaris agar struktur organisasi lengkap." /> : null}
              {employees.data?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="border-b border-[#dce6f0] bg-[#f5f8fc] text-xs uppercase tracking-wide text-[#475569]">
                      <tr><th className="px-3 py-3">Nama</th><th className="px-3 py-3">Jabatan</th><th className="px-3 py-3">Jenjang</th><th className="px-3 py-3">Jalur</th><th className="px-3 py-3">Perjanjian Kerja</th><th className="px-3 py-3">Penyaringan</th><th className="px-3 py-3">Sertifikat</th></tr>
                    </thead>
                    <tbody>
                      {employees.data.map((row) => (
                        <tr key={row.id} className="border-b border-[#eef2f7] last:border-0">
                          <td className="px-3 py-3 font-semibold text-[#213f63]">{row.fullName}{row.employmentStatus === "NONAKTIF" ? <Badge variant="outline" className="ml-2">Nonaktif</Badge> : null}</td>
                          <td className="px-3 py-3 text-[#475569]">{row.position}</td>
                          <td className="px-3 py-3 text-[#475569]">{JOB_LEVEL_LABELS[row.jobLevel] ?? row.jobLevel}</td>
                          <td className="px-3 py-3 text-[#475569]">{TRACK_LABELS[row.competencyTrack]}</td>
                          <td className="px-3 py-3">{row.employmentAgreementNumber ? <span className="text-[#475569]">{row.employmentAgreementNumber}</span> : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Belum ada</Badge>}</td>
                          <td className="px-3 py-3">{row.screeningResult ? <Badge variant="outline">{SCREENING_LABELS[row.screeningResult]}</Badge> : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Belum</Badge>}</td>
                          <td className="px-3 py-3 text-[#475569]">{certificationCount(row.id)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Peninjauan berkala profil pegawai</CardTitle>
              <CardDescription>
                Profil pegawai ditinjau ulang setiap {PROFILE_REVIEW_INTERVAL_MONTHS} bulan. Pegawai yang belum pernah ditinjau
                dihitung sejak tanggal masuk, sehingga yang paling lama terlewat berada di urutan teratas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManage ? (
                <form
                  className="grid gap-4 rounded-xl border border-[#e6edf5] bg-[#fafcff] p-4 lg:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!reviewForm.employeeId || !reviewForm.reviewedAt) return toast.error("Pegawai dan tanggal peninjauan wajib diisi.");
                    recordProfileReview.mutate({
                      employeeId: Number(reviewForm.employeeId),
                      reviewedAt: new Date(reviewForm.reviewedAt),
                      outcome: reviewForm.outcome as "TIDAK_ADA_PERUBAHAN" | "ADA_PERUBAHAN" | "PERLU_TINDAK_LANJUT",
                      notes: reviewForm.notes || undefined,
                    });
                  }}
                >
                  <Picker label="Pegawai" value={reviewForm.employeeId} options={Object.fromEntries(activeStaff.map((row) => [String(row.id), `${row.fullName} — ${row.position}`]))} onChange={(v) => setReviewForm({ ...reviewForm, employeeId: v })} placeholder="Pilih pegawai" />
                  <Field label="Tanggal peninjauan" type="date" value={reviewForm.reviewedAt} onChange={(v) => setReviewForm({ ...reviewForm, reviewedAt: v })} required />
                  <Picker label="Hasil" value={reviewForm.outcome} options={PROFILE_REVIEW_OUTCOME_LABELS} onChange={(v) => setReviewForm({ ...reviewForm, outcome: v })} />
                  <div>
                    <Label className="text-xs">Keterangan{reviewForm.outcome === "TIDAK_ADA_PERUBAHAN" ? "" : " *"}</Label>
                    <Textarea className="mt-1" rows={2} value={reviewForm.notes} onChange={(event) => setReviewForm({ ...reviewForm, notes: event.target.value })} />
                    <p className="mt-1 text-xs text-[#718398]">Wajib diisi bila ada perubahan atau tindak lanjut.</p>
                  </div>
                  <div className="lg:col-span-2">
                    <Button type="submit" disabled={recordProfileReview.isPending} className="bg-[#183f70] text-white hover:bg-[#12345d]"><CalendarCheck className="mr-2 size-4" />Simpan peninjauan</Button>
                  </div>
                </form>
              ) : null}

              {profileReviewSchedule.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat jadwal peninjauan…</p> : null}
              {!profileReviewSchedule.isLoading && !profileReviewSchedule.data?.rows.length ? <EmptyNote text="Belum ada pegawai aktif yang perlu ditinjau." /> : null}

              {profileReviewSchedule.data?.rows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-[#dce6f0] bg-[#f5f8fc] text-xs uppercase tracking-wide text-[#475569]">
                      <tr><th className="px-3 py-3">Nama</th><th className="px-3 py-3">Ditinjau terakhir</th><th className="px-3 py-3">Hasil terakhir</th><th className="px-3 py-3">Jatuh tempo</th><th className="px-3 py-3">Status</th></tr>
                    </thead>
                    <tbody>
                      {profileReviewSchedule.data.rows.map((row) => (
                        <tr key={row.employeeId} className="border-b border-[#eef2f7] last:border-0">
                          <td className="px-3 py-3 font-semibold text-[#213f63]">{row.fullName}<span className="ml-2 font-normal text-[#8194aa]">{row.position}</span></td>
                          <td className="px-3 py-3 text-[#475569]">{row.lastReviewedAt ? formatDate(row.lastReviewedAt) : <span className="text-[#8194aa]">Belum pernah</span>}</td>
                          <td className="px-3 py-3 text-[#475569]">{row.lastOutcome ? PROFILE_REVIEW_OUTCOME_LABELS[row.lastOutcome] ?? row.lastOutcome : "—"}</td>
                          <td className="px-3 py-3 text-[#475569]">{formatDate(row.dueAt)}</td>
                          <td className="px-3 py-3"><ReviewStatusBadge status={row.status} daysUntilDue={row.daysUntilDue} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------- Calon Pegawai ---------------------------- */}
        <TabsContent value="calon" className="mt-5 space-y-4">
          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Penyaringan calon pegawai</CardTitle>
              <CardDescription>
                Setiap calon dicatat di sini sebelum ada keputusan, dan tetap tersimpan meskipun akhirnya tidak diterima —
                itulah bukti bahwa penyaringan benar-benar dilakukan, bukan disusun setelah orangnya bekerja.
                Nama calon otomatis dicocokkan dengan daftar DTTOT/DPPSPM yang termuat; hasil lulus atau tidaknya tetap penilaian manusia.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManage ? (
                <form
                  className="grid gap-4 rounded-xl border border-[#e6edf5] bg-[#fafcff] p-4 lg:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!candidateForm.appliedAt) return toast.error("Tanggal lamaran wajib diisi.");
                    recordCandidate.mutate({
                      fullName: candidateForm.fullName,
                      identityNumber: candidateForm.identityNumber || undefined,
                      appliedPosition: candidateForm.appliedPosition,
                      appliedAt: new Date(candidateForm.appliedAt),
                      notes: candidateForm.notes || undefined,
                    });
                  }}
                >
                  <Field label="Nama lengkap calon" value={candidateForm.fullName} onChange={(v) => setCandidateForm({ ...candidateForm, fullName: v })} required />
                  <Field label="Jabatan yang dilamar" value={candidateForm.appliedPosition} onChange={(v) => setCandidateForm({ ...candidateForm, appliedPosition: v })} required />
                  <Field label="Tanggal lamaran" type="date" value={candidateForm.appliedAt} onChange={(v) => setCandidateForm({ ...candidateForm, appliedAt: v })} required />
                  <Field label="No. KTP" value={candidateForm.identityNumber} onChange={(v) => setCandidateForm({ ...candidateForm, identityNumber: v })} hint="Membantu membedakan calon bernama mirip saat pencocokan daftar sanksi." />
                  <div className="lg:col-span-2">
                    <Label className="text-xs">Catatan</Label>
                    <Textarea autoComplete="off" className="mt-1" rows={2} placeholder="Sumber lamaran, hubungan dengan pegawai/pemilik bila ada, dan berkas yang diterima." value={candidateForm.notes} onChange={(event) => setCandidateForm({ ...candidateForm, notes: event.target.value })} />
                  </div>
                  <div className="lg:col-span-2">
                    <Button type="submit" disabled={recordCandidate.isPending} className="bg-[#183f70] text-white hover:bg-[#12345d]"><UserPlus className="mr-2 size-4" />Catat calon</Button>
                  </div>
                </form>
              ) : null}

              {candidates.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat calon pegawai…</p> : null}
              {!candidates.isLoading && !candidates.data?.rows.length ? <EmptyNote text="Belum ada calon pegawai tercatat. Catat setiap pelamar sejak berkasnya diterima, termasuk yang akhirnya tidak diterima." /> : null}

              {candidates.data?.rows.length ? (
                <>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge className={candidates.data.awaitingScreening ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-[#eef6ed] text-[#4d8548] hover:bg-[#eef6ed]"}>Belum disaring: {candidates.data.awaitingScreening}</Badge>
                    <Badge className={candidates.data.watchlistHits ? "bg-red-100 text-red-800 hover:bg-red-100" : "bg-[#eef6ed] text-[#4d8548] hover:bg-[#eef6ed]"}>Cocok daftar sanksi: {candidates.data.watchlistHits}</Badge>
                    <Badge variant="outline">Tidak diterima: {candidates.data.rejected}</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="border-b border-[#dce6f0] bg-[#f5f8fc] text-xs uppercase tracking-wide text-[#475569]">
                        <tr><th className="px-3 py-3">Nama</th><th className="px-3 py-3">Jabatan dilamar</th><th className="px-3 py-3">Tanggal lamaran</th><th className="px-3 py-3">Pencocokan daftar</th><th className="px-3 py-3">Penyaringan</th><th className="px-3 py-3">Keputusan</th></tr>
                      </thead>
                      <tbody>
                        {candidates.data.rows.map((row) => (
                          <tr key={row.id} className="border-b border-[#eef2f7] last:border-0">
                            <td className="px-3 py-3 font-semibold text-[#213f63]">{row.fullName}</td>
                            <td className="px-3 py-3 text-[#475569]">{row.appliedPosition}</td>
                            <td className="px-3 py-3 text-[#475569]">{formatDate(row.appliedAt)}</td>
                            <td className="px-3 py-3">
                              {!row.watchlistCheckedAt ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Belum dicocokkan</Badge>
                                : row.watchlistMatchCount ? <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{row.watchlistMatchCount} kemiripan</Badge>
                                : <Badge className="bg-[#eef6ed] text-[#4d8548] hover:bg-[#eef6ed]">Nihil</Badge>}
                              {row.watchlistSummary ? <p className="mt-1 whitespace-pre-line text-xs text-[#8a4b4b]">{row.watchlistSummary}</p> : null}
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant="outline">{SCREENING_LABELS[row.screeningResult] ?? row.screeningResult}</Badge>
                              {row.screenedAt ? <p className="mt-1 text-xs text-[#8194aa]">{formatDate(row.screenedAt)}</p> : null}
                              {row.screeningNotes ? <p className="mt-1 max-w-xs whitespace-pre-line text-xs text-[#718398]">{row.screeningNotes}</p> : null}
                            </td>
                            <td className="px-3 py-3">
                              <Badge className={row.decision === "DITERIMA" ? "bg-[#eef6ed] text-[#4d8548] hover:bg-[#eef6ed]" : row.decision === "TIDAK_DITERIMA" ? "bg-[#eef3fb] text-[#405dbc] hover:bg-[#eef3fb]" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>
                                {CANDIDATE_DECISION_LABELS[row.decision] ?? row.decision}
                              </Badge>
                              {row.decidedAt ? <p className="mt-1 text-xs text-[#8194aa]">{formatDate(row.decidedAt)}</p> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {canManage && candidates.data?.rows.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-[#dce6f0]">
                <CardHeader>
                  <CardTitle className="font-display text-lg text-[#18395f]">Hasil penyaringan</CardTitle>
                  <CardDescription>Pencocokan daftar sanksi diulang saat hasil disimpan, karena daftarnya dapat berubah sejak calon dicatat.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!screeningForm.candidateId || !screeningForm.screenedAt) return toast.error("Calon dan tanggal penyaringan wajib diisi.");
                      screenCandidate.mutate({
                        candidateId: Number(screeningForm.candidateId),
                        screeningResult: screeningForm.screeningResult as "DALAM_PROSES" | "LULUS" | "TIDAK_LULUS",
                        screenedAt: new Date(screeningForm.screenedAt),
                        screeningNotes: screeningForm.screeningNotes || undefined,
                      });
                    }}
                  >
                    <Picker label="Calon" value={screeningForm.candidateId} options={candidateOptions} onChange={(v) => setScreeningForm({ ...screeningForm, candidateId: v })} placeholder="Pilih calon" />
                    <Picker label="Hasil" value={screeningForm.screeningResult} options={SCREENING_LABELS} onChange={(v) => setScreeningForm({ ...screeningForm, screeningResult: v })} />
                    <Field label="Tanggal penyaringan" type="date" value={screeningForm.screenedAt} onChange={(v) => setScreeningForm({ ...screeningForm, screenedAt: v })} required />
                    <div>
                      <Label className="text-xs">Keterangan{screeningForm.screeningResult === "DALAM_PROSES" ? "" : " *"}</Label>
                      <Textarea autoComplete="off" className="mt-1" rows={3} placeholder="Sumber pemeriksaan (referensi kerja, catatan kepolisian, wawancara), hasilnya, dan siapa yang memeriksa." value={screeningForm.screeningNotes} onChange={(event) => setScreeningForm({ ...screeningForm, screeningNotes: event.target.value })} />
                      <p className="mt-1 text-xs text-[#718398]">Wajib diisi bila hasilnya sudah lulus atau tidak lulus.</p>
                    </div>
                    <Button type="submit" disabled={screenCandidate.isPending} className="bg-[#183f70] text-white hover:bg-[#12345d]"><ShieldCheck className="mr-2 size-4" />Simpan hasil penyaringan</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-[#dce6f0]">
                <CardHeader>
                  <CardTitle className="font-display text-lg text-[#18395f]">Keputusan</CardTitle>
                  <CardDescription>Calon hanya dapat diterima setelah penyaringannya lulus. Calon yang tidak diterima tetap tersimpan sebagai bukti penyaringan.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!decisionForm.candidateId || !decisionForm.decidedAt) return toast.error("Calon dan tanggal keputusan wajib diisi.");
                      decideCandidate.mutate({
                        candidateId: Number(decisionForm.candidateId),
                        decision: decisionForm.decision as "DALAM_PROSES" | "DITERIMA" | "TIDAK_DITERIMA",
                        decidedAt: new Date(decisionForm.decidedAt),
                        employeeId: decisionForm.employeeId ? Number(decisionForm.employeeId) : undefined,
                      });
                    }}
                  >
                    <Picker label="Calon" value={decisionForm.candidateId} options={candidateOptions} onChange={(v) => setDecisionForm({ ...decisionForm, candidateId: v })} placeholder="Pilih calon" />
                    <Picker label="Keputusan" value={decisionForm.decision} options={CANDIDATE_DECISION_LABELS} onChange={(v) => setDecisionForm({ ...decisionForm, decision: v })} />
                    <Field label="Tanggal keputusan" type="date" value={decisionForm.decidedAt} onChange={(v) => setDecisionForm({ ...decisionForm, decidedAt: v })} required />
                    {decisionForm.decision === "DITERIMA" ? (
                      <Picker label="Tautkan ke pegawai" value={decisionForm.employeeId} options={Object.fromEntries(activeStaff.map((row) => [String(row.id), `${row.fullName} — ${row.position}`]))} onChange={(v) => setDecisionForm({ ...decisionForm, employeeId: v })} placeholder="Belum tercatat sebagai pegawai" hint="Isi setelah calon dicatat pada tab Pegawai, agar penyaringannya tersambung ke berkas kepegawaiannya." />
                    ) : null}
                    <Button type="submit" disabled={decideCandidate.isPending} className="bg-[#183f70] text-white hover:bg-[#12345d]"><CalendarCheck className="mr-2 size-4" />Simpan keputusan</Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* ------------------------------ Sertifikat ------------------------------ */}
        <TabsContent value="sertifikat" className="mt-5 space-y-4">
          {canManage ? (
            <Card className="border-[#dce6f0]">
              <CardHeader>
                <CardTitle className="font-display text-xl text-[#18395f]">Catat sertifikat</CardTitle>
                <CardDescription>Hanya 14 sandi bidang Penukaran Valas yang berlaku bagi KUPVA BB, dari 98 sandi pada template resmi.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 lg:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!certForm.employeeId || !certForm.competencyCode || !certForm.issuedAt) return toast.error("Pegawai, sandi kompetensi, dan tanggal terbit wajib diisi.");
                    recordCertification.mutate({
                      employeeId: Number(certForm.employeeId),
                      competencyCode: certForm.competencyCode,
                      issuedAt: new Date(certForm.issuedAt),
                      certificateNumber: certForm.certificateNumber || undefined,
                      expiresAt: certForm.expiresAt ? new Date(certForm.expiresAt) : undefined,
                    });
                  }}
                >
                  <Picker label="Pegawai" value={certForm.employeeId} options={Object.fromEntries(activeStaff.map((row) => [String(row.id), `${row.fullName} — ${row.position}`]))} onChange={(v) => setCertForm({ ...certForm, employeeId: v })} placeholder="Pilih pegawai" />
                  <Picker label="Sandi kompetensi" value={certForm.competencyCode} options={Object.fromEntries((competencyCodes.data ?? []).map((entry) => [entry.code, `${entry.code} — ${entry.keterangan}`]))} onChange={(v) => setCertForm({ ...certForm, competencyCode: v })} placeholder="Pilih sandi" />
                  <Field label="Tanggal terbit" type="date" value={certForm.issuedAt} onChange={(v) => setCertForm({ ...certForm, issuedAt: v })} required />
                  <Field label="Berlaku sampai" type="date" value={certForm.expiresAt} onChange={(v) => setCertForm({ ...certForm, expiresAt: v })} hint="Kosongkan bila tidak ada masa berlaku." />
                  <Field label="Nomor sertifikat" value={certForm.certificateNumber} onChange={(v) => setCertForm({ ...certForm, certificateNumber: v })} />
                  <div className="lg:col-span-2">
                    <Button type="submit" disabled={recordCertification.isPending} className="bg-[#183f70] text-white hover:bg-[#12345d]"><Award className="mr-2 size-4" />Simpan sertifikat</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-[#dce6f0]">
            <CardHeader><CardTitle className="font-display text-xl text-[#18395f]">Sertifikat tercatat</CardTitle></CardHeader>
            <CardContent>
              {certifications.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat sertifikat…</p> : null}
              {!certifications.isLoading && !certifications.data?.length ? <EmptyNote text="Belum ada sertifikat tercatat." /> : null}
              {certifications.data?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-[#dce6f0] bg-[#f5f8fc] text-xs uppercase tracking-wide text-[#475569]">
                      <tr><th className="px-3 py-3">Pegawai</th><th className="px-3 py-3">Sandi</th><th className="px-3 py-3">Nomor</th><th className="px-3 py-3">Terbit</th><th className="px-3 py-3">Berlaku sampai</th></tr>
                    </thead>
                    <tbody>
                      {certifications.data.map((row) => {
                        const owner = employees.data?.find((employee) => employee.id === row.employeeId);
                        const expired = row.expiresAt ? new Date(row.expiresAt) < new Date() : false;
                        return (
                          <tr key={row.id} className="border-b border-[#eef2f7] last:border-0">
                            <td className="px-3 py-3 font-semibold text-[#213f63]">{owner?.fullName ?? `#${row.employeeId}`}</td>
                            <td className="px-3 py-3 font-mono text-xs text-[#475569]">{row.competencyCode}</td>
                            <td className="px-3 py-3 text-[#475569]">{row.certificateNumber ?? "—"}</td>
                            <td className="px-3 py-3 text-[#475569]">{formatDate(row.issuedAt)}</td>
                            <td className="px-3 py-3">{row.expiresAt ? <span className={expired ? "font-semibold text-rose-700" : "text-[#475569]"}>{formatDate(row.expiresAt)}{expired ? " · kedaluwarsa" : ""}</span> : <span className="text-[#8190a4]">Tanpa masa berlaku</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------- Penanggung jawab --------------------------- */}
        <TabsContent value="pic" className="mt-5 space-y-4">
          {canManage ? (
            <Card className="border-[#dce6f0]">
              <CardHeader>
                <CardTitle className="font-display text-xl text-[#18395f]">Tunjuk penanggung jawab</CardTitle>
                <CardDescription>Penilaian risiko menanyakan apakah penanggung jawab telah ditunjuk dan meminta surat keputusannya sebagai bukti.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 lg:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!picForm.employeeId || !picForm.assignedAt) return toast.error("Pegawai dan tanggal penunjukan wajib diisi.");
                    assignPic.mutate({
                      employeeId: Number(picForm.employeeId),
                      picRole: picForm.picRole as never,
                      assignedAt: new Date(picForm.assignedAt),
                      decreeNumber: picForm.decreeNumber || undefined,
                      decreeAt: picForm.decreeAt ? new Date(picForm.decreeAt) : undefined,
                    });
                  }}
                >
                  <Picker label="Pegawai" value={picForm.employeeId} options={Object.fromEntries(activeStaff.map((row) => [String(row.id), `${row.fullName} — ${row.position}`]))} onChange={(v) => setPicForm({ ...picForm, employeeId: v })} placeholder="Pilih pegawai" />
                  <Picker label="Fungsi" value={picForm.picRole} options={PIC_LABELS} onChange={(v) => setPicForm({ ...picForm, picRole: v, decreeNumber: picForm.decreeNumber || nextDecreeNumber(v) })} />
                  <Field label="Tanggal penunjukan" type="date" value={picForm.assignedAt} onChange={(v) => setPicForm({ ...picForm, assignedAt: v })} required />
                  <Field label="Nomor SK penunjukan" value={picForm.decreeNumber} onChange={(v) => setPicForm({ ...picForm, decreeNumber: v })} hint={`Usulan: ${nextDecreeNumber(picForm.picRole)}`} />
                  <Field label="Tanggal SK" type="date" value={picForm.decreeAt} onChange={(v) => setPicForm({ ...picForm, decreeAt: v })} />
                  <div className="lg:col-span-2">
                    <Button type="submit" disabled={assignPic.isPending} className="bg-[#183f70] text-white hover:bg-[#12345d]"><ShieldCheck className="mr-2 size-4" />Simpan penunjukan</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-[#dce6f0]">
            <CardHeader><CardTitle className="font-display text-xl text-[#18395f]">Penanggung jawab fungsi</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {picAssignments.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat penunjukan…</p> : null}
              {!picAssignments.isLoading && !picAssignments.data?.length ? <EmptyNote text="Belum ada penunjukan tercatat." /> : null}
              {Object.keys(PIC_LABELS).map((role) => {
                const current = (picAssignments.data ?? []).filter((row) => row.picRole === role && !row.endedAt);
                return (
                  <div key={role} className="flex flex-col gap-2 rounded-xl border border-[#e0e8f1] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[#213f63]">{PIC_LABELS[role]}</p>
                      <p className="mt-1 text-sm text-[#64768d]">
                        {current.length
                          ? current.map((row) => employees.data?.find((employee) => employee.id === row.employeeId)?.fullName ?? `#${row.employeeId}`).join(", ")
                          : "Belum ditunjuk"}
                      </p>
                    </div>
                    {current.length ? (
                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs text-[#718398]">
                          {current[0].decreeNumber ? <p>SK {current[0].decreeNumber}</p> : <p className="text-amber-700">SK penunjukan belum dicatat</p>}
                          <p>{formatDate(current[0].assignedAt)}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => printLetter(current[0])}><Printer className="mr-1.5 size-3.5" />Cetak SK</Button>
                      </div>
                    ) : <Badge className="w-fit bg-amber-100 text-amber-800 hover:bg-amber-100">Perlu ditunjuk</Badge>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------- Pelatihan ---------------------------- */}
        <TabsContent value="pelatihan" className="mt-5 space-y-4">
          {canManage ? (
            <Card className="border-[#dce6f0]">
              <CardHeader>
                <CardTitle className="font-display text-xl text-[#18395f]">Catat pelatihan APU PPT</CardTitle>
                <CardDescription>
                  Pelatihan berkala wajib dibuktikan dengan daftar hadir. Yang dicatat di sini menjadi isi Surat Keterangan
                  Pelaksanaan Pelatihan Internal beserta lampirannya, sehingga surat dan buktinya tidak pernah berbeda.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 lg:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!trainingForm.heldAt) return toast.error("Tanggal pelatihan wajib diisi.");
                    if (!trainingForm.attendeeIds.length) return toast.error("Pilih minimal satu pegawai yang hadir.");
                    recordTraining.mutate({
                      heldAt: new Date(trainingForm.heldAt),
                      topic: trainingForm.topic,
                      method: trainingForm.method as "IN_HOUSE" | "EKSTERNAL" | "DARING",
                      facilitator: trainingForm.facilitator,
                      materials: trainingForm.materials || undefined,
                      notes: trainingForm.notes || undefined,
                      attendeeIds: trainingForm.attendeeIds,
                    });
                  }}
                >
                  <Field label="Tanggal pelatihan" type="date" value={trainingForm.heldAt} onChange={(v) => setTrainingForm({ ...trainingForm, heldAt: v })} required />
                  <Picker label="Metode" value={trainingForm.method} options={TRAINING_METHOD_LABELS} onChange={(v) => setTrainingForm({ ...trainingForm, method: v })} />
                  <Field label="Pemateri / fasilitator" value={trainingForm.facilitator} onChange={(v) => setTrainingForm({ ...trainingForm, facilitator: v })} required hint="Nama dan kapasitasnya, mis. Direktur Utama pemegang sertifikat KUPVA BB." />
                  <Field label="Topik pelatihan" value={trainingForm.topic} onChange={(v) => setTrainingForm({ ...trainingForm, topic: v })} required hint="Ditulis pada badan surat keterangan." />
                  <div className="lg:col-span-2">
                    <Label className="text-xs">Materi yang disesuaikan dengan jobdesk</Label>
                    <Textarea className="mt-1" rows={3} value={trainingForm.materials} onChange={(event) => setTrainingForm({ ...trainingForm, materials: event.target.value })} />
                    <p className="mt-1 text-xs text-[#718398]">Satu baris satu materi. Dicetak sebagai halaman terakhir surat keterangan.</p>
                  </div>
                  <div className="lg:col-span-2">
                    <Label className="text-xs">Pegawai yang hadir *</Label>
                    {activeStaff.length ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {activeStaff.map((row) => {
                          const checked = trainingForm.attendeeIds.includes(row.id);
                          return (
                            <label key={row.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#e0e8f1] bg-white px-3 py-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) =>
                                  setTrainingForm({
                                    ...trainingForm,
                                    attendeeIds: value ? [...trainingForm.attendeeIds, row.id] : trainingForm.attendeeIds.filter((id) => id !== row.id),
                                  })
                                }
                              />
                              <span><span className="font-semibold text-[#213f63]">{row.fullName}</span> <span className="text-[#64768d]">— {row.position}</span></span>
                            </label>
                          );
                        })}
                      </div>
                    ) : <EmptyNote text="Belum ada pegawai aktif yang dapat dicatat kehadirannya." />}
                  </div>
                  <div className="lg:col-span-2">
                    <Button type="submit" disabled={recordTraining.isPending} className="bg-[#183f70] text-white hover:bg-[#12345d]"><GraduationCap className="mr-2 size-4" />Simpan pelatihan</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Rekapitulasi periode pelatihan</CardTitle>
              <CardDescription>Pegawai yang belum pernah mengikuti pelatihan tetap ditampilkan, karena merekalah yang perlu terlihat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Periode mulai" type="date" value={trainingPeriod.from} onChange={(v) => setTrainingPeriod({ ...trainingPeriod, from: v })} />
                <Field label="Periode sampai" type="date" value={trainingPeriod.to} onChange={(v) => setTrainingPeriod({ ...trainingPeriod, to: v })} />
                <Field label="Nomor surat keterangan" value={trainingLetterNumber} onChange={setTrainingLetterNumber} hint={`Usulan: ${suggestedTrainingLetterNumber}`} />
              </div>

              {trainingRecap.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat rekapitulasi…</p> : null}
              {!trainingRecap.isLoading && !trainingRecap.data?.rows.length ? <EmptyNote text="Belum ada pegawai aktif pada periode ini." /> : null}

              {trainingRecap.data?.rows.length ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="border-b border-[#e0e8f1] text-left text-xs uppercase tracking-wide text-[#718398]">
                          <th className="py-2 pr-3">Nama pegawai</th>
                          <th className="py-2 pr-3">Jabatan</th>
                          <th className="py-2 pr-3">Pelatihan terakhir</th>
                          <th className="py-2">Jumlah pelatihan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainingRecap.data.rows.map((row) => (
                          <tr key={row.employeeId} className="border-b border-[#eef3f9]">
                            <td className="py-2 pr-3 font-semibold text-[#213f63]">{row.fullName}</td>
                            <td className="py-2 pr-3 text-[#64768d]">{row.position}</td>
                            <td className="py-2 pr-3">
                              {row.lastTrainedAt ? formatDate(row.lastTrainedAt) : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Belum mengikuti</Badge>}
                            </td>
                            <td className="py-2 tabular-nums text-[#64768d]">{row.sessionCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" onClick={printTrainingLetter} disabled={!trainingRecap.data.sessions.length}>
                      <Printer className="mr-1.5 size-3.5" />Cetak surat keterangan
                    </Button>
                    <p className="text-xs text-[#718398]">
                      {trainingRecap.data.sessions.length
                        ? `${trainingRecap.data.sessions.length} pelatihan pada periode ini; ${trainingRecap.data.untrained} pegawai belum mengikuti.`
                        : "Belum ada pelatihan pada periode ini, sehingga surat keterangan belum dapat dicetak."}
                    </p>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-[#dce6f0]">
            <CardHeader><CardTitle className="font-display text-xl text-[#18395f]">Riwayat pelatihan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {trainingSessions.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat riwayat…</p> : null}
              {!trainingSessions.isLoading && !trainingSessions.data?.length ? <EmptyNote text="Belum ada pelatihan tercatat." /> : null}
              {(trainingSessions.data ?? []).map((session) => (
                <div key={session.id} className="rounded-xl border border-[#e0e8f1] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[#213f63]">{formatDate(session.heldAt)}</p>
                    <Badge variant="outline" className="border-[#cdd9e5] text-[#4a5f7a]">{TRAINING_METHOD_SHORT[session.method] ?? session.method}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[#475569]">{session.topic}</p>
                  <p className="mt-1 text-xs text-[#718398]">Pemateri: {session.facilitator} · {session.attendeeIds.length} peserta</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------------------- Laporan ----------------------------- */}
        <TabsContent value="laporan" className="mt-5 space-y-4">
          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Laporan kompetensi SDM triwulanan</CardTitle>
              <CardDescription>
                Disusun dari catatan pegawai dan sertifikat di halaman ini. Rencana diisi manual karena rencana adalah keputusan
                manajemen, bukan fakta yang sudah terjadi. Berkas hasilnya diunggah sendiri ke pelaporan.bi.go.id — halaman ini tidak mengirim apa pun.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-32"><Label className="text-xs">Tahun</Label><Input autoComplete="off" className="mt-1" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></div>
                <div className="w-40">
                  <Label className="text-xs">Triwulan</Label>
                  <Select value={String(quarter)} onValueChange={(value) => setQuarter(Number(value) as 1 | 2 | 3 | 4)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Triwulan {q}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {report.data ? <Badge className="mb-2 bg-[#e7f2fb] text-[#35628f] hover:bg-[#e7f2fb]">Formulir {report.data.form.toUpperCase()} · posisi {report.data.periodEnd}</Badge> : null}
                <Button
                  className="mb-1 bg-[#183f70] text-white hover:bg-[#12345d]"
                  disabled={exportFile.isPending || !report.data || Boolean(report.data?.problems.length)}
                  onClick={() => exportFile.mutate({ year, quarter, idPelapor: companyProfile.data?.biReporterCode ?? "" })}
                ><Download className="mr-2 size-4" />Unduh berkas unggahan</Button>
              </div>

              {report.data?.problems.length ? (
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
                  <p className="font-semibold">Laporan belum layak diunggah:</p>
                  <ul className="mt-1 list-disc pl-5">{report.data.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
                </div>
              ) : null}

              {report.isLoading ? <p className="py-8 text-sm text-[#475569]">Menyusun laporan…</p> : null}
              {report.data ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b border-[#dce6f0] bg-[#f5f8fc] text-xs uppercase tracking-wide text-[#475569]">
                      <tr>
                        <th className="px-3 py-3">Sandi</th><th className="px-3 py-3">Keterangan</th>
                        <th className="px-3 py-3 text-right">Keseluruhan SDM</th><th className="px-3 py-3 text-right">Bersertifikat</th>
                        <th className="px-3 py-3 text-right">Rencana</th><th className="px-3 py-3 text-right">Realisasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.rows.map((row) => (
                        <tr key={row.code} className="border-b border-[#eef2f7] last:border-0">
                          <td className="px-3 py-3 font-mono text-xs text-[#475569]">{row.code}</td>
                          <td className="px-3 py-3 text-[#475569]">{row.keterangan}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-[#213f63]">{row.posisiKeseluruhanSDM}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-[#213f63]">{row.posisiSDMYangMemilikiSertifikat}</td>
                          <td className="px-3 py-3 text-right">
                            {canManage ? (
                              <Input
                                autoComplete="off"
                                aria-label={`Rencana sertifikasi ${row.code}`}
                                className="ml-auto h-9 w-20 text-right tabular-nums"
                                type="number"
                                min={0}
                                defaultValue={row.rencanaSertifikasiSDM}
                                onBlur={(event) => {
                                  const plannedCount = Number(event.target.value);
                                  if (plannedCount === row.rencanaSertifikasiSDM) return;
                                  setPlan.mutate({ periodYear: year, periodQuarter: quarter, competencyCode: row.code, plannedCount });
                                }}
                              />
                            ) : <span className="tabular-nums text-[#213f63]">{row.rencanaSertifikasiSDM}</span>}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-[#213f63]">{row.realisasiSertifikasiSDM}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------- Rencana tahunan --------------------------- */}
        <TabsContent value="rencana" className="mt-5 space-y-4">
          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Rencana tahunan pemenuhan sertifikat</CardTitle>
              <CardDescription>
                Lampiran {annualPlan.data?.lampiran ?? "X/XI"} PADG No. 17 Tahun 2024. Angka per triwulan diambil dari rencana
                yang diisi pada tab Laporan Triwulan, sehingga rencana tahunan dan laporan triwulanan tidak dapat berbeda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-32"><Label className="text-xs">Tahun</Label><Input autoComplete="off" className="mt-1" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></div>
                {annualPlan.data ? <Badge className="mb-2 bg-[#e7f2fb] text-[#35628f] hover:bg-[#e7f2fb]">Lampiran {annualPlan.data.lampiran}</Badge> : null}
                <Button className="mb-1 bg-[#183f70] text-white hover:bg-[#12345d]" disabled={!annualPlan.data} onClick={printAnnualPlan}><Printer className="mr-2 size-4" />Cetak lampiran</Button>
              </div>

              {annualPlan.isLoading ? <p className="py-8 text-sm text-[#475569]">Menyusun rencana…</p> : null}
              {annualPlan.data ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="border-b border-[#dce6f0] bg-[#f5f8fc] text-xs uppercase tracking-wide text-[#475569]">
                      <tr>
                        <th className="px-3 py-3" rowSpan={2}>Jenjang</th>
                        <th className="px-3 py-3 text-right" rowSpan={2}>Total SDM</th>
                        <th className="px-3 py-2 text-center" colSpan={4}>Rencana PBK</th>
                        <th className="px-3 py-2 text-center" colSpan={4}>Rencana Pemeliharaan</th>
                      </tr>
                      <tr>{["I", "II", "III", "IV", "I", "II", "III", "IV"].map((q, index) => <th key={index} className="px-3 py-2 text-center">Tw {q}</th>)}</tr>
                    </thead>
                    <tbody>
                      {annualPlan.data.rows.map((row) => (
                        <tr key={row.name} className="border-b border-[#eef2f7] last:border-0">
                          <td className="px-3 py-3 font-semibold text-[#213f63]">{row.label}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-[#213f63]">{row.totalSdm}</td>
                          {row.rencanaPbk.map((value, index) => <td key={`p${index}`} className="px-3 py-3 text-center tabular-nums text-[#475569]">{value}</td>)}
                          {row.rencanaPemeliharaan.map((value, index) => <td key={`m${index}`} className="px-3 py-3 text-center tabular-nums text-[#475569]">{value}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-sm text-[#64768d]">
                    Rencana penyediaan dana PBK <strong>Rp {new Intl.NumberFormat("id-ID").format(annualPlan.data.totalDanaPbk)}</strong>,
                    pemeliharaan <strong>Rp {new Intl.NumberFormat("id-ID").format(annualPlan.data.totalDanaPemeliharaan)}</strong>.
                    Diisi bersama rencana per triwulan.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------- Realisasi ---------------------------- */}
        <TabsContent value="realisasi" className="mt-5 space-y-4">
          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Laporan realisasi sertifikat</CardTitle>
              <CardDescription>
                Lampiran {realisasi.data?.lampiran ?? "X/XI"} bagian {realisasi.data?.section ?? "B.II / B.IV"}. Bagian B.II melaporkan
                sertifikat PBK, bagian B.IV melaporkan Sertifikasi Kompetensi — hanya B.IV yang memiliki kolom Direksi.
                Dana dilaporkan sebagai realisasi tahun berjalan, dijumlahkan sejak triwulan pertama.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-32"><Label className="text-xs">Tahun</Label><Input autoComplete="off" className="mt-1" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></div>
                <div className="w-36">
                  <Label className="text-xs">Triwulan</Label>
                  <Select value={String(quarter)} onValueChange={(value) => setQuarter(Number(value) as 1 | 2 | 3 | 4)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Triwulan {q}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-56">
                  <Label className="text-xs">Jenis sertifikat</Label>
                  <Select value={track} onValueChange={(value) => setTrack(value as "PBK" | "KOMPETENSI")}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PBK">B.II — Sertifikat PBK</SelectItem>
                      <SelectItem value="KOMPETENSI">B.IV — Sertifikasi Kompetensi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="mb-1 bg-[#183f70] text-white hover:bg-[#12345d]" disabled={!realisasi.data} onClick={printRealisasi}><Printer className="mr-2 size-4" />Cetak laporan</Button>
              </div>

              {realisasi.isLoading ? <p className="py-8 text-sm text-[#475569]">Menyusun laporan…</p> : null}
              {realisasi.data ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b border-[#dce6f0] bg-[#f5f8fc] text-xs uppercase tracking-wide text-[#475569]">
                        <tr>
                          <th className="px-3 py-3">Jenjang</th>
                          <th className="px-3 py-3 text-right">Total SDM</th>
                          <th className="px-3 py-3 text-right">Rencana</th>
                          <th className="px-3 py-3 text-right">Rencana pemeliharaan</th>
                          <th className="px-3 py-3 text-right">Realisasi</th>
                          <th className="px-3 py-3 text-right">Realisasi pemeliharaan</th>
                          <th className="px-3 py-3 text-right">Akumulasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {realisasi.data.columns.map((column) => (
                          <tr key={column.level} className="border-b border-[#eef2f7] last:border-0">
                            <td className="px-3 py-3 font-semibold text-[#213f63]">{column.label}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-[#213f63]">{column.totalSdm}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-[#475569]">{column.rencanaBase}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-[#475569]">{column.rencanaMaintenance}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-[#475569]">{column.realisasiBase}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-[#475569]">{column.realisasiMaintenance}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-[#213f63]">{column.akumulasi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-4 rounded-xl border border-[#e0e8f1] bg-[#f8fbff] p-4 text-sm text-[#475569]">
                    <span>Akumulasi realisasi <strong className="text-[#213f63]">{realisasi.data.totalAkumulasi} dari {realisasi.data.totalSdm} SDM</strong></span>
                    <span>Persentase <strong className="text-[#213f63]">{realisasi.data.persentaseAkumulasi}%</strong></span>
                    <span>Realisasi dana <strong className="text-[#213f63]">Rp {new Intl.NumberFormat("id-ID").format(realisasi.data.realisasiDanaSertifikasi)}</strong></span>
                    <span>Realisasi dana pemeliharaan <strong className="text-[#213f63]">Rp {new Intl.NumberFormat("id-ID").format(realisasi.data.realisasiDanaPemeliharaan)}</strong></span>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryTile({ icon, label, value, tone = "neutral", loading }: { icon: React.ReactNode; label: string; value: number; tone?: "neutral" | "ok" | "warn"; loading?: boolean }) {
  const toneClass = tone === "warn" ? "bg-amber-50 text-amber-700" : tone === "ok" ? "bg-[#eef6ed] text-[#5e9c59]" : "bg-[#eef3fb] text-[#405dbc]";
  return (
    <div className="rounded-2xl border border-[#dce6f0] bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#64768d]">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-3 font-display text-3xl tabular-nums text-[#18395f]">{loading ? "—" : value}</p>
    </div>
  );
}

function ReviewStatusBadge({ status, daysUntilDue }: { status: ProfileReviewStatus; daysUntilDue: number }) {
  if (status === "TERLAMBAT") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Terlambat {Math.abs(daysUntilDue)} hari</Badge>;
  if (status === "SEGERA") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Jatuh tempo {daysUntilDue} hari lagi</Badge>;
  return <Badge className="bg-[#eef6ed] text-[#4d8548] hover:bg-[#eef6ed]">Terkini</Badge>;
}

function EmptyNote({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-[#cdd9e5] bg-[#fbfdff] p-6 text-sm text-[#6f8094]">{text}</p>;
}

function Field({ label, value, onChange, type = "text", required, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; hint?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}{required ? " *" : ""}</Label>
      <Input autoComplete="off" className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <p className="mt-1 text-xs text-[#718398]">{hint}</p> : null}
    </div>
  );
}

function Picker({ label, value, options, onChange, placeholder, hint }: { label: string; value: string; options: Record<string, string>; onChange: (value: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue placeholder={placeholder ?? "Pilih"} /></SelectTrigger>
        <SelectContent>{Object.entries(options).filter(([key]) => key !== "").map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent>
      </Select>
      {hint ? <p className="mt-1 text-xs text-[#718398]">{hint}</p> : null}
    </div>
  );
}
