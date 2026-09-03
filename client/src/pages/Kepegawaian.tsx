import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { printLampiranSdm } from "@/lib/lampiranSdm";
import { PIC_ROLE_TITLES, printSuratKeputusan, suggestDecreeNumber } from "@/lib/suratKeputusan";
import { Award, Download, FileCheck2, Printer, ShieldCheck, UserPlus, Users } from "lucide-react";
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

const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";

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

  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(currentQuarter());
  const report = trpc.sdm.quarterlyReport.useQuery({ year, quarter }, { enabled: canManage });
  const annualPlan = trpc.sdm.annualPlan.useQuery({ year }, { enabled: canManage });

  const refresh = () => {
    utils.sdm.employees.invalidate();
    utils.sdm.certifications.invalidate();
    utils.sdm.picAssignments.invalidate();
    utils.sdm.quarterlyReport.invalidate();
    utils.sdm.annualPlan.invalidate();
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

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile icon={<Users className="size-5" />} label="Pegawai aktif" value={activeStaff.length} loading={employees.isLoading} />
        <SummaryTile icon={<FileCheck2 className="size-5" />} label="Tanpa Perjanjian Kerja" value={withoutAgreement.length} tone={withoutAgreement.length ? "warn" : "ok"} loading={employees.isLoading} />
        <SummaryTile icon={<ShieldCheck className="size-5" />} label="Tanpa hasil penyaringan" value={withoutScreening.length} tone={withoutScreening.length ? "warn" : "ok"} loading={employees.isLoading} />
      </div>

      <Tabs defaultValue="pegawai">
        <TabsList className="h-auto w-full flex-wrap gap-1.5 rounded-2xl border-2 border-[#183f70]/15 bg-[#eef3f9] p-1.5">
          <TabsTrigger value="pegawai" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><Users className="mr-1.5 size-4" />Pegawai</TabsTrigger>
          <TabsTrigger value="sertifikat" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><Award className="mr-1.5 size-4" />Sertifikat</TabsTrigger>
          <TabsTrigger value="pic" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><ShieldCheck className="mr-1.5 size-4" />Penanggung Jawab</TabsTrigger>
          <TabsTrigger value="laporan" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><Download className="mr-1.5 size-4" />Laporan Triwulan</TabsTrigger>
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
