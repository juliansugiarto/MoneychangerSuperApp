import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_OPERATIONAL_TIMEZONE, OPERATIONAL_TIMEZONES } from "@shared/regulatoryActionQueue";
import { Building2, FileImage, Paperclip, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });

const emptyForm = { legalEntityName: "", tradingName: "", licenseNumber: "", kupvaCode: "", npwp: "", nib: "", biReporterCode: "", sipesatIdPjk: "", goamlRentityId: "", goamlReportingUserCode: "", address: "", phone: "", email: "", website: "", timezone: "Asia/Jakarta" };

export default function CompanyProfile() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.companyProfile.get.useQuery();
  const { data: documents } = trpc.documents.forCompany.useQuery();
  const [form, setForm] = useState(emptyForm);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      legalEntityName: profile.legalEntityName, tradingName: profile.tradingName, licenseNumber: profile.licenseNumber ?? "",
      kupvaCode: profile.kupvaCode ?? "", npwp: profile.npwp ?? "", nib: profile.nib ?? "", biReporterCode: profile.biReporterCode ?? "", sipesatIdPjk: profile.sipesatIdPjk ?? "",
      goamlRentityId: profile.goamlRentityId ? String(profile.goamlRentityId) : "", goamlReportingUserCode: profile.goamlReportingUserCode ?? "",
      address: profile.address ?? "", phone: profile.phone ?? "", email: profile.email ?? "", website: profile.website ?? "", timezone: profile.timezone ?? DEFAULT_OPERATIONAL_TIMEZONE,
    });
  }, [profile]);

  const logo = documents?.find((doc) => doc.documentType === "COMPANY_LOGO" && doc.id === profile?.logoDocumentId);
  const licenseCertificates = documents?.filter((doc) => doc.documentType === "LICENSE_CERTIFICATE") ?? [];
  const attachments = documents?.filter((doc) => doc.documentType === "LICENSE_ATTACHMENT") ?? [];

  const update = trpc.companyProfile.update.useMutation({
    onSuccess: () => { toast.success("Profil perusahaan disimpan."); utils.companyProfile.get.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  const toPayload = () => ({ ...form, goamlRentityId: form.goamlRentityId.trim() ? Number(form.goamlRentityId) : undefined });

  const save = () => {
    if (!form.legalEntityName.trim() || !form.tradingName.trim()) return toast.error("Nama PT dan nama moneychanger wajib diisi.");
    if (form.goamlRentityId.trim() && !Number.isInteger(Number(form.goamlRentityId))) return toast.error("ID entitas pelapor goAML harus berupa angka bulat.");
    update.mutate({ ...toPayload(), logoDocumentId: profile?.logoDocumentId ?? undefined });
  };

  const uploadDocument = async (file: File, documentType: "COMPANY_LOGO" | "LICENSE_CERTIFICATE" | "LICENSE_ATTACHMENT") => {
    const response = await fetch("/api/operational-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType, originalFileName: file.name, mimeType: file.type, byteSize: file.size, dataBase64: await fileToBase64(file) }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? "Dokumen gagal diunggah.");
    return body.document as { id: number };
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const document = await uploadDocument(file, "COMPANY_LOGO");
      await update.mutateAsync({ ...toPayload(), logoDocumentId: document.id });
      utils.documents.forCompany.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logo gagal diunggah.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLicenseUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingLicense(true);
    try {
      await uploadDocument(file, "LICENSE_CERTIFICATE");
      toast.success("Sertifikat izin diunggah.");
      utils.documents.forCompany.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sertifikat gagal diunggah.");
    } finally {
      setUploadingLicense(false);
    }
  };

  const handleAttachmentUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAttachment(true);
    try {
      await uploadDocument(file, "LICENSE_ATTACHMENT");
      toast.success("Lampiran diunggah.");
      utils.documents.forCompany.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lampiran gagal diunggah.");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const deleteDocument = trpc.documents.deleteCompany.useMutation({
    onSuccess: () => { toast.success("Dokumen dihapus."); utils.documents.forCompany.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  const viewDocument = async (documentId: number) => {
    const url = await utils.documents.downloadUrl.fetch({ documentId });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isLoading) return <p className="text-sm text-[#475569]">Memuat profil perusahaan…</p>;

  return <div className="mx-auto max-w-4xl space-y-6">
    <header><p className="mt-2 max-w-2xl text-sm text-[#334155]">Nama, izin usaha, dan logo di sini tampil di kwitansi cetak dan layar regulator.</p>
    </header>

    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Data badan usaha</CardTitle><CardDescription>Nama PT dan nama moneychanger wajib diisi; sisanya opsional tapi disarankan untuk pelaporan regulator.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Nama PT (badan hukum)</Label><Input autoComplete="off" className="mt-1" value={form.legalEntityName} onChange={(e) => setForm({ ...form, legalEntityName: e.target.value })} placeholder="PT Ibukota Valasindo" /></div>
          <div><Label className="text-xs">Nama moneychanger (dagang)</Label><Input autoComplete="off" className="mt-1" value={form.tradingName} onChange={(e) => setForm({ ...form, tradingName: e.target.value })} placeholder="Ibukota Valasindo" /></div>
          <div><Label className="text-xs">Nomor izin usaha (KUPVA BB)</Label><Input autoComplete="off" className="mt-1" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} /></div>
          <div><Label className="text-xs">Kode KUPVA</Label><Input autoComplete="off" className="mt-1" value={form.kupvaCode} onChange={(e) => setForm({ ...form, kupvaCode: e.target.value })} /></div>
          <div><Label className="text-xs">NPWP</Label><Input autoComplete="off" className="mt-1" value={form.npwp} onChange={(e) => setForm({ ...form, npwp: e.target.value })} /></div>
          <div><Label className="text-xs">NIB</Label><Input autoComplete="off" className="mt-1" value={form.nib} onChange={(e) => setForm({ ...form, nib: e.target.value })} /></div>
          <div><Label className="text-xs">ID PJK SIPESAT</Label><Input autoComplete="off" className="mt-1" value={form.sipesatIdPjk} onChange={(e) => setForm({ ...form, sipesatIdPjk: e.target.value })} placeholder="Lihat pojok kanan halaman sipesat.ppatk.go.id" /></div>
          <div><Label className="text-xs">ID Entitas Pelapor goAML (rentity_id)</Label><Input autoComplete="off" className="mt-1" type="number" min={1} value={form.goamlRentityId} onChange={(e) => setForm({ ...form, goamlRentityId: e.target.value })} placeholder="Angka dari registrasi goAML" /></div>
          <div><Label className="text-xs">Kode User Pelapor goAML</Label><Input autoComplete="off" className="mt-1" value={form.goamlReportingUserCode} onChange={(e) => setForm({ ...form, goamlReportingUserCode: e.target.value })} placeholder="Kode akun pelapor terdaftar di goAML" /></div>
        </div>
        <div>
          <Label className="text-xs">Sandi pelapor BI (SINTA)</Label>
          <Input className="mt-1" type="password" autoComplete="new-password" name="bi-reporter-code" value={form.biReporterCode} onChange={(e) => setForm({ ...form, biReporterCode: e.target.value })} />
          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700"><ShieldCheck className="size-3" />Data sensitif — hanya untuk referensi internal, tidak ditampilkan di kwitansi maupun layar publik.</p>
        </div>
        <div><Label className="text-xs">Alamat</Label><Input autoComplete="off" className="mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Alamat lengkap yang tampil di kwitansi" /></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label className="text-xs">Telepon</Label><Input autoComplete="off" className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label className="text-xs">Email</Label><Input autoComplete="off" className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label className="text-xs">Website</Label><Input autoComplete="off" className="mt-1" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
          <div>
            <Label className="text-xs">Zona waktu operasional</Label>
            <Select value={form.timezone} onValueChange={(value) => setForm({ ...form, timezone: value })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{OPERATIONAL_TIMEZONES.map((zone) => <SelectItem key={zone.value} value={zone.value}>{zone.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-1.5 text-xs leading-5 text-[#718398]">Menentukan batas &ldquo;hari ini&rdquo; untuk tenggat pelaporan. Server berjalan pada UTC, sehingga tanpa pengaturan ini tenggat pukul 23.59 waktu setempat terbaca sebagai hari berikutnya.</p>
          </div>
        </div>
        <Button disabled={update.isPending} onClick={save} className="w-full bg-[#183f70] text-white hover:bg-[#12345d]">{update.isPending ? "Menyimpan…" : "Simpan profil"}</Button>
      </CardContent>
    </Card>

    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Logo</CardTitle><CardDescription>Tampil di kwitansi cetak. JPG, PNG, WEBP; maksimal 8 MB.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {logo ? <div className="flex items-center gap-3"><Badge variant="outline" className="border-[#cfe2d6] bg-[#f5fbf5] text-[#3c6f48]"><FileImage className="mr-1 size-3" />{logo.originalFileName}</Badge><Button type="button" size="sm" variant="outline" onClick={() => viewDocument(logo.id)}>Lihat</Button></div> : <p className="text-sm text-[#475569]">Belum ada logo diunggah.</p>}
        <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingLogo} onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)} />
      </CardContent>
    </Card>

    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Sertifikat izin usaha</CardTitle><CardDescription>Scan/foto sertifikat izin KUPVA BB.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {licenseCertificates.length ? <div className="space-y-2">{licenseCertificates.map((doc) => <div key={doc.id} className="flex items-center justify-between rounded-lg bg-[#f6fafc] px-3 py-2 text-sm"><span className="text-[#18395f]">{doc.originalFileName}</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => viewDocument(doc.id)}>Lihat</Button><Button type="button" size="sm" variant="ghost" className="text-rose-600" onClick={() => deleteDocument.mutate({ documentId: doc.id })}><Trash2 className="size-4" /></Button></div></div>)}</div> : <p className="text-sm text-[#475569]">Belum ada sertifikat diunggah.</p>}
        <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploadingLicense} onChange={(e) => handleLicenseUpload(e.target.files?.[0] ?? null)} />
      </CardContent>
    </Card>

    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Lampiran izin lainnya</CardTitle><CardDescription>Dokumen pendukung izin usaha — bisa lebih dari satu file.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {attachments.length ? <div className="space-y-2">{attachments.map((doc) => <div key={doc.id} className="flex items-center justify-between rounded-lg bg-[#f6fafc] px-3 py-2 text-sm"><span className="flex items-center gap-1.5 text-[#18395f]"><Paperclip className="size-3.5" />{doc.originalFileName}</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => viewDocument(doc.id)}>Lihat</Button><Button type="button" size="sm" variant="ghost" className="text-rose-600" onClick={() => deleteDocument.mutate({ documentId: doc.id })}><Trash2 className="size-4" /></Button></div></div>)}</div> : <p className="text-sm text-[#475569]">Belum ada lampiran diunggah.</p>}
        <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploadingAttachment} onChange={(e) => { handleAttachmentUpload(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <p className="flex items-center gap-1 text-[11px] text-[#475569]"><Upload className="size-3" />Unggah satu per satu — file akan langsung tercatat dalam daftar di atas.</p>
      </CardContent>
    </Card>
  </div>;
}
