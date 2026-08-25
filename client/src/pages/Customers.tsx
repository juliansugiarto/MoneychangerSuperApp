import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ShieldCheck, Upload, UserPlus, UsersRound } from "lucide-react";
import { FormEvent, useState } from "react";
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

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });

export default function Customers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: customers, isLoading } = trpc.customers.list.useQuery(undefined, { enabled: Boolean(user) });
  const [form, setForm] = useState(initialForm);
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: async (customer) => {
      try {
        if (ktpFile) {
          const response = await fetch("/api/operational-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType: "KTP_PHOTO", customerId: customer.id, originalFileName: ktpFile.name, mimeType: ktpFile.type, byteSize: ktpFile.size, dataBase64: await fileToBase64(ktpFile) }) });
          const body = await response.json(); if (!response.ok) throw new Error(body.message ?? "Foto KTP gagal diunggah.");
        }
        toast.success("Profil nasabah dan data KYC berhasil dibuat.");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Profil tersimpan, tetapi foto KTP gagal diunggah."); }
      setForm(initialForm);
      setKtpFile(null);
      utils.customers.list.invalidate();
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
    createCustomer.mutate({ ...form, identityExpiryDate: new Date(`${form.identityExpiryDate}T00:00:00`), dateOfBirth: new Date(`${form.dateOfBirth}T00:00:00`) });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-[#5c8f53] uppercase"><ShieldCheck className="size-4" /> KYC / CDD</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[#18395f]">Nasabah & profil risiko</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">Simpan data identifikasi dan konteks transaksi sebelum nasabah digunakan pada transaksi valuta.</p>
        </div>
        <Badge variant="outline" className="w-fit border-[#cfe2d6] bg-[#f5fbf5] px-3 py-1.5 text-[#3c6f48]">{customers?.length ?? 0} profil tersimpan</Badge>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <Card className="border-[#dce6f0] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><UserPlus className="size-5 text-[#5c8f53]" /> Tambah nasabah</CardTitle>
            <CardDescription>Kolom bertanda wajib diperlukan untuk membentuk rekam KYC awal.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nomor CIF" required><Input value={form.cifNumber} onChange={(event) => setForm({ ...form, cifNumber: event.target.value })} placeholder="CIF-000001" /></Field>
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
              <Field label="Masa berlaku identitas" required><Input type="date" value={form.identityExpiryDate} onChange={(event) => setForm({ ...form, identityExpiryDate: event.target.value })} /></Field>
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
              <Field label="Foto KTP (unggah bila tersedia)"><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setKtpFile(event.target.files?.[0] ?? null)} /><p className="mt-1 text-xs text-[#64748b]"><Upload className="mr-1 inline size-3" />JPG, PNG, atau WEBP; maksimum 8 MB. File disimpan privat dan hanya dapat diakses petugas berwenang.</p></Field>
              <Button type="submit" disabled={createCustomer.isPending} className="press-scale w-full bg-[#183f70] text-white hover:bg-[#12345d]">{createCustomer.isPending ? "Menyimpan…" : "Simpan profil KYC"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-[#dce6f0] shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><UsersRound className="size-5 text-[#5c8f53]" /> Daftar nasabah</CardTitle><CardDescription>Profil dengan risiko tinggi atau status terbatas akan memicu tinjauan pada transaksi baru.</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? <p className="text-sm text-[#64748b]">Memuat profil…</p> : customers?.length ? customers.map((customer) => <div key={customer.id} className="rounded-2xl border border-[#e2eaf2] bg-[#fbfdff] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#18395f]">{customer.fullName}</p><p className="mt-1 text-xs text-[#64748b]">{customer.cifNumber} · {customer.identityType} {customer.identityNumber}</p></div><Badge className={customer.riskLevel === "HIGH" ? "bg-rose-100 text-rose-700 hover:bg-rose-100" : customer.riskLevel === "MEDIUM" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>{customer.riskLevel}</Badge></div><p className="mt-3 text-xs text-[#64748b]">Status profil: <span className="font-semibold text-[#476278]">{customer.profileStatus}</span></p></div>) : <Empty text="Belum ada profil nasabah. Tambahkan profil KYC pertama melalui formulir di samping." />}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-xs font-semibold text-[#476278]">{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</Label>{children}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm leading-6 text-[#64748b]">{text}</div>; }
