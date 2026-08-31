import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ShieldAlert, ShieldCheck, Upload, UserPlus, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const initialForm = {
  cifNumber: "",
  fullName: "",
  phoneNumber: "",
  identityType: "KTP" as "KTP" | "PASSPORT" | "OTHER",
  identityNumber: "",
  identityExpiryDate: "",
  placeOfBirth: "",
  dateOfBirth: "",
  address: "",
  occupation: "",
  sourceOfFunds: "",
  transactionPurpose: "",
  riskLevel: "LOW" as "LOW" | "MEDIUM" | "HIGH",
  riskNotes: "",
};

const initialBeneficialOwner = {
  fullName: "",
  identityType: "KTP" as "KTP" | "PASSPORT" | "OTHER",
  identityNumber: "",
  phoneNumber: "",
  address: "",
  occupation: "",
  relationshipToCustomer: "",
};

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });

export default function Customers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: customers } = trpc.customers.list.useQuery(undefined, { enabled: Boolean(user) });
  const { data: nextCif } = trpc.customers.nextCif.useQuery(undefined, { enabled: Boolean(user) });
  const [form, setForm] = useState(initialForm);
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [identityNeverExpires, setIdentityNeverExpires] = useState(false);
  const [hasBeneficialOwner, setHasBeneficialOwner] = useState(false);
  const [beneficialOwner, setBeneficialOwner] = useState(initialBeneficialOwner);
  const [pepStatus, setPepStatus] = useState<"NONE" | "SELF" | "RELATED">("NONE");
  const [pepDetails, setPepDetails] = useState("");
  const [dttotMatch, setDttotMatch] = useState(false);
  const [dttotNotes, setDttotNotes] = useState("");

  // Isi otomatis nomor CIF berikutnya selama staf belum mengetik nilai sendiri.
  useEffect(() => {
    if (nextCif && !form.cifNumber) setForm((current) => (current.cifNumber ? current : { ...current, cifNumber: nextCif }));
  }, [nextCif]);

  const resetForm = () => {
    setForm(initialForm);
    setKtpFile(null);
    setIdentityNeverExpires(false);
    setHasBeneficialOwner(false);
    setBeneficialOwner(initialBeneficialOwner);
    setPepStatus("NONE");
    setPepDetails("");
    setDttotMatch(false);
    setDttotNotes("");
  };

  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: async (customer) => {
      try {
        if (ktpFile) {
          const response = await fetch("/api/operational-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType: "KTP_PHOTO", customerId: customer.id, originalFileName: ktpFile.name, mimeType: ktpFile.type, byteSize: ktpFile.size, dataBase64: await fileToBase64(ktpFile) }) });
          const body = await response.json(); if (!response.ok) throw new Error(body.message ?? "Dokumen KTP gagal diunggah.");
        }
        toast.success(dttotMatch ? "Profil tersimpan berstatus RESTRICTED. Segera laporkan LTKM ke PPATK secara manual." : "Profil nasabah dan data KYC berhasil dibuat.");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Profil tersimpan, tetapi dokumen KTP gagal diunggah."); }
      resetForm();
      utils.customers.list.invalidate();
      utils.customers.nextCif.invalidate();
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      if (returnTo === "/operasional/transaksi") {
        sessionStorage.setItem("iv:transactionCustomer", JSON.stringify(customer));
        setLocation(returnTo);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (hasBeneficialOwner && (!beneficialOwner.fullName.trim() || !beneficialOwner.identityNumber.trim() || !beneficialOwner.address.trim() || !beneficialOwner.relationshipToCustomer.trim())) {
      return toast.error("Lengkapi nama, identitas, alamat, dan hubungan pemilik manfaat (beneficial owner).");
    }
    if (pepStatus !== "NONE" && !pepDetails.trim()) return toast.error("Isi keterangan PEP (nama/jabatan pejabat dan jenis hubungan).");
    if (dttotMatch && !dttotNotes.trim()) return toast.error("Isi catatan pencocokan DTTOT/PPSPM sebelum menyimpan.");
    createCustomer.mutate({
      ...form,
      identityExpiryDate: identityNeverExpires ? undefined : new Date(`${form.identityExpiryDate}T00:00:00`),
      dateOfBirth: new Date(`${form.dateOfBirth}T00:00:00`),
      hasBeneficialOwner,
      beneficialOwner: hasBeneficialOwner ? beneficialOwner : undefined,
      pepStatus,
      pepDetails: pepStatus !== "NONE" ? pepDetails : undefined,
      dttotPpsdmMatch: dttotMatch,
      dttotPpsdmNotes: dttotMatch ? dttotNotes : undefined,
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-[#5c8f53] uppercase"><ShieldCheck className="size-4" /> KYC / CDD</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[#18395f]">Tambah nasabah baru</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#475569]">Simpan data identifikasi, pemilik manfaat, status PEP, dan pencocokan DTTOT/PPSPM sebelum nasabah digunakan pada transaksi valuta.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Badge variant="outline" className="w-fit border-[#cfe2d6] bg-[#f5fbf5] px-3 py-1.5 text-[#3c6f48]">{customers?.length ?? 0} profil tersimpan</Badge>
          <Button variant="outline" size="sm" onClick={() => setLocation("/operasional/nasabah/daftar")}><Users className="mr-1.5 size-3.5" />Lihat daftar nasabah</Button>
        </div>
      </section>

      <Card className="border-[#dce6f0] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><UserPlus className="size-5 text-[#5c8f53]" /> Formulir KYC</CardTitle>
          <CardDescription>Kolom bertanda wajib diperlukan untuk membentuk rekam KYC awal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nomor CIF" required><Input value={form.cifNumber} onChange={(event) => setForm({ ...form, cifNumber: event.target.value })} placeholder="CIF-000001" /><p className="mt-1 text-xs text-[#94a7bb]">Terisi otomatis mengikuti nomor nasabah terakhir; boleh diubah bila perlu.</p></Field>
              <Field label="Nama lengkap" required><Input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Sesuai identitas" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jenis identitas" required>
                <Select value={form.identityType} onValueChange={(value) => setForm({ ...form, identityType: value as typeof form.identityType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="KTP">KTP</SelectItem><SelectItem value="PASSPORT">Paspor</SelectItem><SelectItem value="OTHER">Lainnya</SelectItem></SelectContent></Select>
              </Field>
              <Field label="Nomor identitas" required><Input value={form.identityNumber} onChange={(event) => setForm({ ...form, identityNumber: event.target.value })} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tempat lahir" required><Input value={form.placeOfBirth} onChange={(event) => setForm({ ...form, placeOfBirth: event.target.value })} placeholder="Kota / kabupaten" /></Field>
              <Field label="Tanggal lahir" required><Input type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></Field>
            </div>
            <Field label="Masa berlaku identitas" required={!identityNeverExpires}>
              <Input type="date" value={form.identityExpiryDate} disabled={identityNeverExpires} required={!identityNeverExpires} onChange={(event) => setForm({ ...form, identityExpiryDate: event.target.value })} />
              <label className="mt-2 flex items-center gap-2 text-xs text-[#476278]">
                <Checkbox checked={identityNeverExpires} onCheckedChange={(checked) => { const value = checked === true; setIdentityNeverExpires(value); if (value) setForm((current) => ({ ...current, identityExpiryDate: "" })); }} />
                Berlaku seumur hidup (eKTP)
              </label>
            </Field>
            <Field label="Alamat" required><Textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} rows={3} placeholder="Alamat domisili sesuai dokumen pendukung" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nomor HP" required><Input type="tel" value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="08xx atau +62" /></Field>
              <Field label="Pekerjaan" required><Input value={form.occupation} onChange={(event) => setForm({ ...form, occupation: event.target.value })} /></Field>
              <Field label="Tingkat risiko">
                <Select value={form.riskLevel} onValueChange={(value) => setForm({ ...form, riskLevel: value as typeof form.riskLevel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Rendah</SelectItem><SelectItem value="MEDIUM">Menengah</SelectItem><SelectItem value="HIGH">Tinggi</SelectItem></SelectContent></Select>
              </Field>
            </div>
            <Field label="Sumber dana" required><Textarea value={form.sourceOfFunds} onChange={(event) => setForm({ ...form, sourceOfFunds: event.target.value })} rows={2} /></Field>
            <Field label="Tujuan transaksi" required><Textarea value={form.transactionPurpose} onChange={(event) => setForm({ ...form, transactionPurpose: event.target.value })} rows={2} /></Field>
            <Field label="Catatan risiko"><Textarea value={form.riskNotes} onChange={(event) => setForm({ ...form, riskNotes: event.target.value })} rows={2} /></Field>
            <Field label="Dokumen KTP (unggah bila tersedia)"><Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setKtpFile(event.target.files?.[0] ?? null)} /><p className="mt-1 text-xs text-[#475569]"><Upload className="mr-1 inline size-3" />JPG, PNG, WEBP, atau PDF; maksimum 8 MB. File disimpan privat dan hanya dapat diakses petugas berwenang.</p></Field>

            <div className="rounded-2xl border border-[#e2eaf2] bg-[#fbfdff] p-4">
              <label className="flex items-start gap-3 text-sm">
                <Checkbox className="mt-0.5" checked={hasBeneficialOwner} onCheckedChange={(checked) => setHasBeneficialOwner(checked === true)} />
                <span>
                  <b className="text-[#18395f]">Nasabah bertindak atas nama pihak lain (Beneficial Owner)</b>
                  <br /><small className="text-[#475569]">Contoh: bos menyuruh supirnya bertransaksi valas — beneficial owner-nya adalah bosnya. Identitas pemilik manfaat wajib dicatat sebagai profil nasabah terpisah.</small>
                </span>
              </label>
              {hasBeneficialOwner ? (
                <div className="mt-4 space-y-4 border-t border-[#e2eaf2] pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nama lengkap pemilik manfaat" required><Input value={beneficialOwner.fullName} onChange={(event) => setBeneficialOwner({ ...beneficialOwner, fullName: event.target.value })} /></Field>
                    <Field label="Hubungan dengan nasabah" required><Input value={beneficialOwner.relationshipToCustomer} onChange={(event) => setBeneficialOwner({ ...beneficialOwner, relationshipToCustomer: event.target.value })} placeholder="Contoh: atasan/bos, pemilik dana" /></Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Jenis identitas" required>
                      <Select value={beneficialOwner.identityType} onValueChange={(value) => setBeneficialOwner({ ...beneficialOwner, identityType: value as typeof beneficialOwner.identityType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="KTP">KTP</SelectItem><SelectItem value="PASSPORT">Paspor</SelectItem><SelectItem value="OTHER">Lainnya</SelectItem></SelectContent></Select>
                    </Field>
                    <Field label="Nomor identitas" required><Input value={beneficialOwner.identityNumber} onChange={(event) => setBeneficialOwner({ ...beneficialOwner, identityNumber: event.target.value })} /></Field>
                  </div>
                  <Field label="Alamat" required><Textarea value={beneficialOwner.address} onChange={(event) => setBeneficialOwner({ ...beneficialOwner, address: event.target.value })} rows={2} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nomor HP"><Input type="tel" value={beneficialOwner.phoneNumber} onChange={(event) => setBeneficialOwner({ ...beneficialOwner, phoneNumber: event.target.value })} /></Field>
                    <Field label="Pekerjaan"><Input value={beneficialOwner.occupation} onChange={(event) => setBeneficialOwner({ ...beneficialOwner, occupation: event.target.value })} /></Field>
                  </div>
                  <p className="text-xs text-[#94a7bb]">Bila identitas ini sudah terdaftar sebagai nasabah, sistem akan otomatis menautkan ke profil yang sudah ada tanpa membuat CIF baru.</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[#e2eaf2] bg-[#fbfdff] p-4">
              <Field label="Status Politically Exposed Person (PEP)" required>
                <Select value={pepStatus} onValueChange={(value) => setPepStatus(value as typeof pepStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Bukan PEP dan tidak ada hubungan dengan PEP</SelectItem>
                    <SelectItem value="SELF">Nasabah sendiri adalah PEP (pejabat/mantan pejabat)</SelectItem>
                    <SelectItem value="RELATED">Nasabah memiliki hubungan dengan PEP (keluarga/kerabat pejabat)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {pepStatus !== "NONE" ? (
                <div className="mt-3">
                  <Field label={pepStatus === "SELF" ? "Jabatan dan instansi nasabah" : "Nama, jabatan pejabat, dan jenis hubungan"} required>
                    <Textarea value={pepDetails} onChange={(event) => setPepDetails(event.target.value)} rows={2} placeholder={pepStatus === "SELF" ? "Contoh: Anggota DPRD Kota X periode 2019–2024" : "Contoh: Sepupu dari Bupati Kabupaten X"} />
                  </Field>
                </div>
              ) : null}
            </div>

            <div className={`rounded-2xl border p-4 ${dttotMatch ? "border-rose-300 bg-rose-50" : "border-[#e2eaf2] bg-[#fbfdff]"}`}>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox className="mt-0.5" checked={dttotMatch} onCheckedChange={(checked) => setDttotMatch(checked === true)} />
                <span>
                  <b className={dttotMatch ? "text-rose-700" : "text-[#18395f]"}>Nama nasabah cocok dengan Daftar DTTOT/PPSPM</b>
                  <br /><small className={dttotMatch ? "text-rose-700" : "text-[#475569]"}>Daftar Terduga Teroris dan Organisasi Teroris / Daftar Pendanaan Proliferasi Senjata Pemusnah Massal.</small>
                </span>
              </label>
              {dttotMatch ? (
                <div className="mt-3 space-y-2">
                  <p className="flex items-start gap-2 rounded-xl bg-rose-100 px-3 py-2 text-xs text-rose-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />Profil ini otomatis disimpan dengan status <b>RESTRICTED</b> dan risiko <b>TINGGI</b>, serta <b>wajib dilaporkan sebagai LTKM (Laporan Transaksi Keuangan Mencurigakan) ke PPATK secara manual</b> sesuai prosedur resmi APU-PPT. Sistem ini tidak mengirim laporan secara otomatis.</p>
                  <Field label="Catatan pencocokan" required><Textarea value={dttotNotes} onChange={(event) => setDttotNotes(event.target.value)} rows={2} placeholder="Daftar yang dicocokkan, tanggal pengecekan, dan nama petugas yang memverifikasi" /></Field>
                </div>
              ) : null}
            </div>

            <Button type="submit" disabled={createCustomer.isPending} className="press-scale w-full bg-[#183f70] text-white hover:bg-[#12345d]">{createCustomer.isPending ? "Menyimpan…" : dttotMatch ? <span className="flex items-center justify-center gap-2"><ShieldAlert className="size-4" />Simpan &amp; tandai RESTRICTED</span> : "Simpan profil KYC"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-xs font-semibold text-[#476278]">{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</Label>{children}</div>; }
