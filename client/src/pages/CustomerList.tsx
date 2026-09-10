import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WatchlistCheckButton } from "@/components/WatchlistCheck";
import { trpc } from "@/lib/trpc";
import { IRA_LEGAL_FORM_LABELS, IRA_OCCUPATION_CATEGORY_LABELS } from "@shared/iraVocabulary";
import { Download, IdCard, Pencil, RefreshCw, Search, ShieldAlert, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type CustomerRow = { id: number; identityExpiryDate: string | Date | null; dateOfBirth: string | Date | null; fullName: string; phoneNumber: string | null; identityType: "KTP" | "PASSPORT" | "OTHER"; identityNumber: string; placeOfBirth: string | null; address: string; addressType: "RUMAH" | "KANTOR" | "DOMISILI" | "LAINNYA" | null; addressCountry: string | null; addressProvince: string | null; addressCity: string | null; addressDistrict: string | null; addressPostalCode: string | null; nationality: string | null; npwp: string | null; gender: "MALE" | "FEMALE" | null; occupation: string | null; sourceOfFunds: string | null; transactionPurpose: string | null; profileStatus: "ACTIVE" | "RESTRICTED" | "INACTIVE"; riskLevel: "LOW" | "MEDIUM" | "HIGH"; riskNotes: string | null; pepStatus: "NONE" | "SELF" | "RELATED"; pepDetails: string | null; dttotPpsdmMatch: boolean; dttotPpsdmNotes: string | null; declaredMonthlyValueIdr: string | null; declaredMonthlyCount: number | null; declaredCurrencies: string[] | null; customerType: "INDIVIDU" | "BADAN_USAHA" | null; entityLegalForm: string | null; occupationCategory: string | null };
/** Bentuk minimal yang dibutuhkan panel penyaringan — bukan seluruh baris nasabah. */
type CustomerDetail = {
  id: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  highRiskDecision?: "BELUM" | "DISETUJUI" | "DITOLAK" | null;
  highRiskDecidedAt?: string | Date | null;
  highRiskDecisionNotes?: string | null;
};
const toDateInputValue = (value: string | Date | null | undefined) => (value ? new Date(value).toISOString().slice(0, 10) : "");
/**
 * Nasabah yang kategori Form C1-nya belum lengkap: belum dinyatakan jenisnya, badan usaha tanpa
 * bentuk badan hukum, atau perorangan tanpa kategori pekerjaan.
 *
 * Kekosongan yang terlihat, bukan yang diam. Tidak ada backfill: menebak kategori dari teks bebas
 * berarti mengarang data nasabah, sehingga yang tersisa adalah menampilkannya sebagai pekerjaan
 * yang menunggu.
 */
function kategoriBelumDiisi(customer: { customerType: string | null; entityLegalForm: string | null; occupationCategory: string | null }) {
  if (!customer.customerType) return true;
  return customer.customerType === "BADAN_USAHA" ? !customer.entityLegalForm : !customer.occupationCategory;
}

const editFormFromCustomer = (customer: CustomerRow) => ({
  fullName: customer.fullName, phoneNumber: customer.phoneNumber ?? "", identityType: customer.identityType, identityNumber: customer.identityNumber,
  identityExpiryDate: toDateInputValue(customer.identityExpiryDate), placeOfBirth: customer.placeOfBirth ?? "", dateOfBirth: toDateInputValue(customer.dateOfBirth),
  address: customer.address,
  addressType: customer.addressType ?? "RUMAH" as "RUMAH" | "KANTOR" | "DOMISILI" | "LAINNYA",
  addressCountry: customer.addressCountry ?? "ID", addressProvince: customer.addressProvince ?? "", addressCity: customer.addressCity ?? "",
  addressDistrict: customer.addressDistrict ?? "", addressPostalCode: customer.addressPostalCode ?? "",
  nationality: customer.nationality ?? "ID", npwp: customer.npwp ?? "", gender: customer.gender ?? "MALE" as "MALE" | "FEMALE",
  occupation: customer.occupation ?? "", sourceOfFunds: customer.sourceOfFunds ?? "", transactionPurpose: customer.transactionPurpose ?? "",
  profileStatus: customer.profileStatus, riskLevel: customer.riskLevel, riskNotes: customer.riskNotes ?? "",
  pepStatus: customer.pepStatus, pepDetails: customer.pepDetails ?? "", dttotPpsdmMatch: customer.dttotPpsdmMatch, dttotPpsdmNotes: customer.dttotPpsdmNotes ?? "",
  // Deklarasi profil ikut dibawa: borang yang tidak mengirimkannya akan menghapus pernyataan nasabah.
  declaredMonthlyValueIdr: customer.declaredMonthlyValueIdr ?? "",
  declaredMonthlyCount: customer.declaredMonthlyCount === null || customer.declaredMonthlyCount === undefined ? "" : String(customer.declaredMonthlyCount),
  declaredCurrencies: customer.declaredCurrencies ?? [],
  // Kategori BI ikut dibawa dan selalu dikirim kembali secara eksplisit, sehingga borang ini tidak
  // pernah mengosongkan kategori yang tidak sedang disunting.
  customerType: customer.customerType ?? "",
  entityLegalForm: customer.entityLegalForm ?? "",
  occupationCategory: customer.occupationCategory ?? "",
  changeReason: "",
});

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

/** Jam operasional adalah WIB; server berjalan UTC, jadi zonanya dinyatakan, tidak diwariskan dari peramban. */
function formatDateTimeWib(value: string | Date | null | undefined) {
  if (!value) return "—";
  return `${new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(value))} WIB`;
}

const SCREENING_TRIGGER_LABELS: Record<string, string> = {
  NASABAH_DIBUAT: "Nasabah dibuat",
  NASABAH_DIUBAH: "Nasabah diubah",
  DAFTAR_DIIMPOR: "Daftar sanksi diimpor",
  MANUAL: "Diminta petugas",
};

function riskBadgeClass(riskLevel: string) {
  if (riskLevel === "HIGH") return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  if (riskLevel === "MEDIUM") return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
}

function statusBadgeClass(profileStatus: string) {
  if (profileStatus === "RESTRICTED") return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  if (profileStatus === "INACTIVE") return "bg-slate-100 text-slate-600 hover:bg-slate-100";
  return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
}

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function CustomerList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const { data: customers, isLoading, isError } = trpc.customers.list.useQuery(undefined, { enabled: Boolean(user) });
  const [selectedCustomer, setSelectedCustomer] = useState<NonNullable<typeof customers>[number] | null>(null);
  const [showIdentityRequested, setShowIdentityRequested] = useState(false);
  const [identityPreview, setIdentityPreview] = useState<{ url: string; mimeType: string; fileName: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<ReturnType<typeof editFormFromCustomer> | null>(null);
  const currencyList = trpc.currencies.list.useQuery(undefined, { enabled: Boolean(user) });
  const activeCurrencies = (currencyList.data ?? []).filter((currency) => currency.active && currency.code !== "IDR");
  const utils = trpc.useUtils();

  const openCustomer = (customer: NonNullable<typeof customers>[number]) => { setSelectedCustomer(customer); setShowIdentityRequested(false); setEditing(false); };

  const viewIdentity = async () => {
    if (!selectedCustomer) return;
    setShowIdentityRequested(true);
    try {
      const docs = await utils.documents.forCustomer.fetch({ customerId: selectedCustomer.id });
      const ktp = docs.find((doc) => doc.documentType === "KTP_PHOTO");
      if (!ktp) { toast.error("Belum ada foto identitas tersimpan untuk nasabah ini."); return; }
      const url = await utils.documents.downloadUrl.fetch({ documentId: ktp.id });
      setIdentityPreview({ url, mimeType: ktp.mimeType, fileName: ktp.originalFileName });
    } catch {
      toast.error("Gagal membuka dokumen identitas.");
    } finally {
      setShowIdentityRequested(false);
    }
  };

  const startEdit = () => { if (selectedCustomer) { setEditForm(editFormFromCustomer(selectedCustomer)); setEditing(true); } };

  const update = trpc.customers.update.useMutation({
    onSuccess: (updated) => {
      toast.success("Perubahan data nasabah disimpan.");
      setSelectedCustomer(updated as never);
      setEditing(false);
      utils.customers.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const saveEdit = () => {
    if (!selectedCustomer || !editForm) return;
    if (editForm.pepStatus !== "NONE" && !editForm.pepDetails.trim()) return toast.error("Keterangan PEP wajib diisi.");
    if (editForm.dttotPpsdmMatch && !editForm.dttotPpsdmNotes.trim()) return toast.error("Catatan kecocokan DTTOT/DPPSPM wajib diisi.");
    if (editForm.changeReason.trim().length < 5) return toast.error("Alasan perubahan wajib diisi (minimal 5 karakter).");
    update.mutate({
      customerId: selectedCustomer.id,
      ...editForm,
      identityExpiryDate: editForm.identityExpiryDate ? new Date(editForm.identityExpiryDate) : undefined,
      dateOfBirth: new Date(editForm.dateOfBirth),
      declaredMonthlyValueIdr: editForm.declaredMonthlyValueIdr.trim() || undefined,
      declaredMonthlyCount: editForm.declaredMonthlyCount.trim() ? Number(editForm.declaredMonthlyCount) : undefined,
      declaredCurrencies: editForm.declaredCurrencies.length > 0 ? editForm.declaredCurrencies : undefined,
      customerType: (editForm.customerType || null) as never,
      entityLegalForm: (editForm.customerType === "BADAN_USAHA" ? editForm.entityLegalForm || null : null) as never,
      occupationCategory: (editForm.customerType === "BADAN_USAHA" ? null : editForm.occupationCategory || null) as never,
    });
  };

  const nameById = useMemo(() => new Map((customers ?? []).map((customer) => [customer.id, customer.fullName])), [customers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers ?? [];
    return (customers ?? []).filter((customer) => customer.fullName.toLowerCase().includes(term) || customer.identityNumber.toLowerCase().includes(term) || customer.cifNumber.toLowerCase().includes(term));
  }, [customers, search]);

  const exportCsv = () => {
    const headers = ["CIF", "Nama Lengkap", "Jenis Identitas", "Nomor Identitas", "Berlaku Hingga", "Telepon", "Tempat Lahir", "Tanggal Lahir", "Alamat", "Pekerjaan", "Sumber Dana", "Tujuan Transaksi", "Status Profil", "Tingkat Risiko", "Catatan Risiko", "Beneficial Owner", "Nama Beneficial Owner", "Status PEP", "Keterangan PEP", "Cocok DTTOT/DPPSPM", "Catatan DTTOT/DPPSPM", "Tanggal Dibuat"];
    const rows = filtered.map((customer) => [
      customer.cifNumber, customer.fullName, customer.identityType, customer.identityNumber,
      customer.identityExpiryDate ? formatDate(customer.identityExpiryDate) : "Seumur hidup",
      customer.phoneNumber ?? "", customer.placeOfBirth ?? "", customer.dateOfBirth ? formatDate(customer.dateOfBirth) : "",
      customer.address, customer.occupation ?? "", customer.sourceOfFunds ?? "", customer.transactionPurpose ?? "",
      customer.profileStatus, customer.riskLevel, customer.riskNotes ?? "",
      customer.hasBeneficialOwner ? "Ya" : "Tidak",
      customer.hasBeneficialOwner && customer.beneficialOwnerCustomerId ? (nameById.get(customer.beneficialOwnerCustomerId) ?? `#${customer.beneficialOwnerCustomerId}`) : "",
      customer.pepStatus === "SELF" ? "Nasabah adalah PEP" : customer.pepStatus === "RELATED" ? "Berhubungan dengan PEP" : "Bukan PEP",
      customer.pepDetails ?? "",
      customer.dttotPpsdmMatch ? "Ya" : "Tidak", customer.dttotPpsdmNotes ?? "",
      formatDate(customer.createdAt),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `daftar-nasabah-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mt-2 max-w-2xl text-sm leading-6 text-[#475569]">Cari berdasarkan nama, NIK/nomor identitas, atau nomor CIF. Ekspor data ini kapan saja tanpa dokumen KTP.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Badge variant="outline" className="w-fit border-[#cfe2d6] bg-[#f5fbf5] px-3 py-1.5 text-[#3c6f48]">{customers?.length ?? 0} profil tersimpan</Badge>
          <Button size="sm" onClick={() => setLocation("/operasional/nasabah")} className="bg-[#183f70] hover:bg-[#12345d]"><UserPlus className="mr-1.5 size-3.5" />Nasabah baru</Button>
        </div>
      </section>

      <Card className="border-[#dce6f0] shadow-sm">
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="font-display text-xl text-[#18395f]">Profil nasabah</CardTitle>
              <CardDescription>Profil dengan risiko tinggi atau status terbatas akan memicu tinjauan pada transaksi baru.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}><Download className="mr-1.5 size-3.5" />Ekspor CSV ({filtered.length})</Button>
          </div>
          <div className="relative mt-3">
            <Search className="absolute top-2.5 left-3 size-4 text-slate-600" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ketik nama atau NIK/nomor identitas…" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-[#475569]">Memuat profil…</p>
          ) : isError ? (
            <p className="text-sm text-rose-600">Gagal memuat daftar nasabah. Muat ulang halaman ini.</p>
          ) : filtered.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-[#e2eaf2] text-[11px] font-extrabold tracking-[0.1em] text-[#68758c] uppercase">
                  <tr>
                    <th className="px-3 py-3">CIF</th>
                    <th className="px-3 py-3">Nama</th>
                    <th className="px-3 py-3">Identitas</th>
                    <th className="px-3 py-3">Telepon</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Risiko</th>
                    <th className="px-3 py-3">Tanda khusus</th>
                    <th className="px-3 py-3">Dibuat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f5]">
                  {filtered.map((customer) => (
                    <tr key={customer.id} className="cursor-pointer align-top hover:bg-[#f9fbff]" onClick={() => openCustomer(customer)}>
                      <td className="px-3 py-3 font-semibold whitespace-nowrap text-[#18395f]">{customer.cifNumber}</td>
                      <td className="px-3 py-3 font-medium text-[#18395f]">{customer.fullName}</td>
                      <td className="px-3 py-3 text-xs text-[#475569] whitespace-nowrap">{customer.identityType} · {customer.identityNumber}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap text-[#475569]">{customer.phoneNumber ?? "—"}</td>
                      <td className="px-3 py-3"><Badge className={statusBadgeClass(customer.profileStatus)}>{customer.profileStatus}</Badge></td>
                      <td className="px-3 py-3"><Badge className={riskBadgeClass(customer.riskLevel)}>{customer.riskLevel}</Badge></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {customer.hasBeneficialOwner ? <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">BO{customer.beneficialOwnerCustomerId ? `: ${nameById.get(customer.beneficialOwnerCustomerId) ?? `#${customer.beneficialOwnerCustomerId}`}` : ""}</Badge> : null}
                          {customer.pepStatus !== "NONE" ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{customer.pepStatus === "SELF" ? "PEP" : "Hub. PEP"}</Badge> : null}
                          {customer.dttotPpsdmMatch ? <Badge className="bg-rose-600 text-white hover:bg-rose-600">DTTOT/DPPSPM</Badge> : null}
                          {kategoriBelumDiisi(customer) ? <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">Kategori BI belum diisi</Badge> : null}
                          {!customer.hasBeneficialOwner && customer.pepStatus === "NONE" && !customer.dttotPpsdmMatch && !kategoriBelumDiisi(customer) ? <span className="text-xs text-[#94a7bb]">—</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap text-[#475569]">{formatDate(customer.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm leading-6 text-[#475569]">
              {search ? "Tidak ada nasabah yang cocok dengan pencarian." : "Belum ada profil nasabah. Tambahkan profil KYC pertama."}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedCustomer)} onOpenChange={(open) => { if (!open) setSelectedCustomer(null); }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {selectedCustomer ? <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="font-display text-xl text-[#18395f]">{selectedCustomer.fullName}</DialogTitle>
                <Badge className={statusBadgeClass(selectedCustomer.profileStatus)}>{selectedCustomer.profileStatus}</Badge>
                <Badge className={riskBadgeClass(selectedCustomer.riskLevel)}>{selectedCustomer.riskLevel}</Badge>
              </div>
              <DialogDescription>CIF {selectedCustomer.cifNumber} · Dibuat {formatDate(selectedCustomer.createdAt)}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={viewIdentity} disabled={showIdentityRequested} className="w-fit border-2 border-[#183f70] bg-white text-[#183f70] hover:bg-[#eef4fb]">
                <IdCard className="mr-1.5 size-4" />{showIdentityRequested ? "Membuka…" : "Lihat foto identitas"}
              </Button>
              {!editing ? <Button type="button" size="sm" variant="outline" onClick={startEdit} className="w-fit border-2 border-[#5c8f53] text-[#3d7139] hover:bg-[#f5fbf5]"><Pencil className="mr-1.5 size-4" />Edit</Button> : null}
            </div>

            {editing && editForm ? <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label className="text-xs">Nama lengkap</Label><Input className="mt-1" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} /></div>
                <div><Label className="text-xs">Telepon</Label><Input className="mt-1" value={editForm.phoneNumber} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} /></div>
                <div><Label className="text-xs">Jenis identitas</Label><Select value={editForm.identityType} onValueChange={(v) => setEditForm({ ...editForm, identityType: v as typeof editForm.identityType })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="KTP">KTP</SelectItem><SelectItem value="PASSPORT">Paspor</SelectItem><SelectItem value="OTHER">Lainnya</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Nomor identitas</Label><Input className="mt-1" value={editForm.identityNumber} onChange={(e) => setEditForm({ ...editForm, identityNumber: e.target.value })} /></div>
                <div><Label className="text-xs">Berlaku hingga (kosongkan bila seumur hidup)</Label><Input className="mt-1" type="date" value={editForm.identityExpiryDate} onChange={(e) => setEditForm({ ...editForm, identityExpiryDate: e.target.value })} /></div>
                <div><Label className="text-xs">Tempat lahir</Label><Input className="mt-1" value={editForm.placeOfBirth} onChange={(e) => setEditForm({ ...editForm, placeOfBirth: e.target.value })} /></div>
                <div><Label className="text-xs">Tanggal lahir</Label><Input className="mt-1" type="date" required value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} /></div>
                <div><Label className="text-xs">Jenis kelamin</Label><Select value={editForm.gender} onValueChange={(v) => setEditForm({ ...editForm, gender: v as typeof editForm.gender })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MALE">Laki-laki</SelectItem><SelectItem value="FEMALE">Perempuan</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Kewarganegaraan (ISO 2 huruf)</Label><Input className="mt-1" value={editForm.nationality} maxLength={2} onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value.toUpperCase() })} /></div>
                <div><Label className="text-xs">Pekerjaan</Label><Input className="mt-1" value={editForm.occupation} onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })} /></div>
                <div><Label className="text-xs">NPWP (bila ada)</Label><Input className="mt-1" value={editForm.npwp} onChange={(e) => setEditForm({ ...editForm, npwp: e.target.value })} /></div>
              </div>
              <div><Label className="text-xs">Alamat</Label><Input className="mt-1" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><Label className="text-xs">Jenis alamat</Label><Select value={editForm.addressType} onValueChange={(v) => setEditForm({ ...editForm, addressType: v as typeof editForm.addressType })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RUMAH">Rumah</SelectItem><SelectItem value="KANTOR">Kantor</SelectItem><SelectItem value="DOMISILI">Domisili</SelectItem><SelectItem value="LAINNYA">Lainnya</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Negara (ISO 2 huruf)</Label><Input className="mt-1" value={editForm.addressCountry} maxLength={2} onChange={(e) => setEditForm({ ...editForm, addressCountry: e.target.value.toUpperCase() })} /></div>
                <div><Label className="text-xs">Kota / kabupaten</Label><Input className="mt-1" value={editForm.addressCity} onChange={(e) => setEditForm({ ...editForm, addressCity: e.target.value })} /></div>
                <div><Label className="text-xs">Provinsi</Label><Input className="mt-1" value={editForm.addressProvince} onChange={(e) => setEditForm({ ...editForm, addressProvince: e.target.value })} /></div>
                <div><Label className="text-xs">Kecamatan</Label><Input className="mt-1" value={editForm.addressDistrict} onChange={(e) => setEditForm({ ...editForm, addressDistrict: e.target.value })} /></div>
                <div><Label className="text-xs">Kode pos</Label><Input className="mt-1" value={editForm.addressPostalCode} onChange={(e) => setEditForm({ ...editForm, addressPostalCode: e.target.value })} /></div>
              </div>
              <div><Label className="text-xs">Sumber dana</Label><Input className="mt-1" value={editForm.sourceOfFunds} onChange={(e) => setEditForm({ ...editForm, sourceOfFunds: e.target.value })} /></div>
              <div><Label className="text-xs">Tujuan transaksi</Label><Input className="mt-1" value={editForm.transactionPurpose} onChange={(e) => setEditForm({ ...editForm, transactionPurpose: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label className="text-xs">Status profil</Label><Select value={editForm.profileStatus} onValueChange={(v) => setEditForm({ ...editForm, profileStatus: v as typeof editForm.profileStatus })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Aktif</SelectItem><SelectItem value="RESTRICTED">Terbatas</SelectItem><SelectItem value="INACTIVE">Nonaktif</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Tingkat risiko</Label><Select value={editForm.riskLevel} onValueChange={(v) => setEditForm({ ...editForm, riskLevel: v as typeof editForm.riskLevel })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Rendah</SelectItem><SelectItem value="MEDIUM">Sedang</SelectItem><SelectItem value="HIGH">Tinggi</SelectItem></SelectContent></Select></div>
              </div>
              <div><Label className="text-xs">Catatan risiko</Label><Input className="mt-1" value={editForm.riskNotes} onChange={(e) => setEditForm({ ...editForm, riskNotes: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label className="text-xs">Jenis nasabah (Form C1)</Label><Select value={editForm.customerType || "BELUM"} onValueChange={(v) => setEditForm({ ...editForm, customerType: v === "BELUM" ? "" : v, entityLegalForm: "", occupationCategory: "" })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BELUM">Belum dinyatakan</SelectItem><SelectItem value="INDIVIDU">Perorangan</SelectItem><SelectItem value="BADAN_USAHA">Badan usaha</SelectItem></SelectContent></Select></div>
                {editForm.customerType === "BADAN_USAHA" ? (
                  <div><Label className="text-xs">Bentuk badan hukum</Label><Select value={editForm.entityLegalForm || "BELUM"} onValueChange={(v) => setEditForm({ ...editForm, entityLegalForm: v === "BELUM" ? "" : v })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BELUM">Belum dipilih</SelectItem>{Object.entries(IRA_LEGAL_FORM_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}</SelectContent></Select></div>
                ) : (
                  <div><Label className="text-xs">Kategori pekerjaan (Form C1)</Label><Select value={editForm.occupationCategory || "BELUM"} onValueChange={(v) => setEditForm({ ...editForm, occupationCategory: v === "BELUM" ? "" : v })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BELUM">Belum dipilih</SelectItem>{Object.entries(IRA_OCCUPATION_CATEGORY_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}</SelectContent></Select></div>
                )}
              </div>
              <div><Label className="text-xs">Perkiraan nilai transaksi sebulan menurut nasabah (Rupiah)</Label><Input className="mt-1" inputMode="decimal" value={editForm.declaredMonthlyValueIdr} onChange={(e) => setEditForm({ ...editForm, declaredMonthlyValueIdr: e.target.value })} placeholder="Kosongkan bila nasabah belum menyatakan" /></div>
              <div><Label className="text-xs">Perkiraan banyaknya transaksi sebulan menurut nasabah</Label><Input className="mt-1" type="number" min={0} step={1} value={editForm.declaredMonthlyCount} onChange={(e) => setEditForm({ ...editForm, declaredMonthlyCount: e.target.value })} placeholder="Kosongkan bila nasabah belum menyatakan" /></div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Mata uang yang diharapkan menurut nasabah</Label>
                {currencyList.isLoading ? <p className="mt-1 text-xs text-[#94a7bb]">Memuat daftar mata uang…</p>
                  : currencyList.isError ? <p className="mt-1 text-xs text-rose-700">Daftar mata uang gagal dimuat; deklarasi mata uang tidak dapat diubah sekarang.</p>
                  : activeCurrencies.length === 0 ? <p className="mt-1 text-xs text-[#94a7bb]">Belum ada mata uang aktif yang terdaftar.</p>
                  : <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                      {activeCurrencies.map((currency) => (
                        <label key={currency.code} className="flex items-center gap-2 text-xs text-[#476278]">
                          <Checkbox
                            checked={editForm.declaredCurrencies.includes(currency.code)}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, declaredCurrencies: checked === true ? [...editForm.declaredCurrencies, currency.code] : editForm.declaredCurrencies.filter((code) => code !== currency.code) })}
                          />
                          <span><b className="text-[#18395f]">{currency.code}</b> {currency.name}</span>
                        </label>
                      ))}
                    </div>}
                <p className="mt-1 text-xs text-[#94a7bb]">Pernyataan nasabah, bukan batas yang ditegakkan sistem.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label className="text-xs">Status PEP</Label><Select value={editForm.pepStatus} onValueChange={(v) => setEditForm({ ...editForm, pepStatus: v as typeof editForm.pepStatus })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Bukan PEP</SelectItem><SelectItem value="SELF">Nasabah adalah PEP</SelectItem><SelectItem value="RELATED">Berhubungan dengan PEP</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Cocok DTTOT/DPPSPM</Label><Select value={editForm.dttotPpsdmMatch ? "yes" : "no"} onValueChange={(v) => setEditForm({ ...editForm, dttotPpsdmMatch: v === "yes" })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">Tidak</SelectItem><SelectItem value="yes">Ya</SelectItem></SelectContent></Select></div>
              </div>
              {editForm.pepStatus !== "NONE" ? <div><Label className="text-xs">Keterangan PEP</Label><Input className="mt-1" value={editForm.pepDetails} onChange={(e) => setEditForm({ ...editForm, pepDetails: e.target.value })} /></div> : null}
              <WatchlistCheckButton name={editForm.fullName} />
              {editForm.dttotPpsdmMatch ? <div><Label className="text-xs">Catatan DTTOT/DPPSPM</Label><Input className="mt-1" value={editForm.dttotPpsdmNotes} onChange={(e) => setEditForm({ ...editForm, dttotPpsdmNotes: e.target.value })} /></div> : null}
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
                <Label className="text-xs font-semibold text-amber-900">Alasan perubahan (wajib, tercatat di jejak audit)</Label>
                <Input className="mt-1" value={editForm.changeReason} onChange={(e) => setEditForm({ ...editForm, changeReason: e.target.value })} placeholder="Contoh: koreksi nomor telepon sesuai konfirmasi nasabah" />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Batal</Button>
                <Button type="button" disabled={update.isPending} onClick={saveEdit} className="bg-[#183f70] text-white hover:bg-[#12345d]">{update.isPending ? "Menyimpan…" : "Simpan perubahan"}</Button>
              </div>
            </div> : <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <DetailField label="Jenis identitas" value={selectedCustomer.identityType} />
              <DetailField label="Nomor identitas" value={selectedCustomer.identityNumber} />
              <DetailField label="Berlaku hingga" value={selectedCustomer.identityExpiryDate ? formatDate(selectedCustomer.identityExpiryDate) : "Seumur hidup"} />
              <DetailField label="Telepon" value={selectedCustomer.phoneNumber ?? "—"} />
              <DetailField label="Tempat, tanggal lahir" value={`${selectedCustomer.placeOfBirth ?? "—"}${selectedCustomer.dateOfBirth ? `, ${formatDate(selectedCustomer.dateOfBirth)}` : ""}`} />
              <DetailField label="Pekerjaan" value={selectedCustomer.occupation ?? "—"} />
              <DetailField label="Alamat" value={selectedCustomer.address} full />
              <DetailField label="Sumber dana" value={selectedCustomer.sourceOfFunds ?? "—"} />
              <DetailField label="Tujuan transaksi" value={selectedCustomer.transactionPurpose ?? "—"} />
              <DetailField label="Catatan risiko" value={selectedCustomer.riskNotes ?? "—"} full />
              <DetailField label="Perkiraan nilai transaksi sebulan (nasabah)" value={selectedCustomer.declaredMonthlyValueIdr ? `Rp ${Number(selectedCustomer.declaredMonthlyValueIdr).toLocaleString("id-ID")}` : "Belum dideklarasikan"} />
              <DetailField label="Perkiraan banyaknya transaksi sebulan (nasabah)" value={selectedCustomer.declaredMonthlyCount === null || selectedCustomer.declaredMonthlyCount === undefined ? "Belum dideklarasikan" : `${selectedCustomer.declaredMonthlyCount} transaksi`} />
              <DetailField label="Mata uang yang diharapkan (nasabah)" value={selectedCustomer.declaredCurrencies?.length ? selectedCustomer.declaredCurrencies.join(", ") : "Belum dideklarasikan"} full />
              <DetailField label="Beneficial owner" value={selectedCustomer.hasBeneficialOwner ? (selectedCustomer.beneficialOwnerCustomerId ? (nameById.get(selectedCustomer.beneficialOwnerCustomerId) ?? `#${selectedCustomer.beneficialOwnerCustomerId}`) : "Ya") : "Tidak"} />
              <DetailField label="Status PEP" value={selectedCustomer.pepStatus === "SELF" ? "Nasabah adalah PEP" : selectedCustomer.pepStatus === "RELATED" ? "Berhubungan dengan PEP" : "Bukan PEP"} />
              {selectedCustomer.pepDetails ? <DetailField label="Keterangan PEP" value={selectedCustomer.pepDetails} full /> : null}
              <DetailField label="Cocok DTTOT/DPPSPM" value={selectedCustomer.dttotPpsdmMatch ? "Ya" : "Tidak"} />
              {selectedCustomer.dttotPpsdmNotes ? <DetailField label="Catatan DTTOT/DPPSPM" value={selectedCustomer.dttotPpsdmNotes} full /> : null}
            </div>}

            <CustomerScreeningPanel customer={selectedCustomer} onDecided={(updated) => setSelectedCustomer(updated as never)} />
          </> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(identityPreview)} onOpenChange={(open) => { if (!open) setIdentityPreview(null); }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {identityPreview ? <>
            <DialogHeader><DialogTitle className="font-display text-lg text-[#18395f]">Foto identitas</DialogTitle></DialogHeader>
            {identityPreview.mimeType.startsWith("image/")
              ? <img src={identityPreview.url} alt="Foto identitas nasabah" className="w-full rounded-xl border border-[#e2eaf2]" />
              : <div className="rounded-xl border border-[#e2eaf2] bg-[#f8fbfe] p-6 text-center text-sm text-[#475569]"><p>{identityPreview.fileName}</p><p className="mt-1 text-xs">Format dokumen ini (PDF) tidak dapat ditampilkan langsung di sini.</p><a href={identityPreview.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-semibold text-[#183f70] underline">Buka di tab baru</a></div>}
          </> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Riwayat penyaringan DTTOT/DPPSPM satu nasabah, peringatan daftar usang, dan kendali keputusan
 * risiko tinggi.
 *
 * Tiga keadaan sengaja dibedakan, karena tindakan yang dituntut memang berbeda: **belum pernah
 * disaring** (tidak ada barisnya sama sekali), **disaring terhadap daftar lama** (peringatan usang
 * beserta tombol menyaring ulang), dan **sudah mutakhir**. Tabel kosong tanpa keterangan tidak
 * mengatakan mana di antara ketiganya yang sedang terjadi.
 */
function CustomerScreeningPanel({ customer, onDecided }: { customer: CustomerDetail; onDecided: (updated: unknown) => void }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [notes, setNotes] = useState("");
  const screenings = trpc.customers.screenings.useQuery({ customerId: customer.id }, { enabled: Boolean(user) });

  const rescreen = trpc.customers.rescreen.useMutation({
    onSuccess: () => { toast.success("Nasabah disaring ulang terhadap daftar terbaru."); utils.customers.screenings.invalidate({ customerId: customer.id }); },
    onError: (error) => toast.error(error.message),
  });

  const decide = trpc.customers.decideHighRisk.useMutation({
    onSuccess: (updated) => {
      toast.success("Keputusan nasabah berisiko tinggi tersimpan.");
      setNotes("");
      onDecided(updated);
      utils.customers.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const submitDecision = (decision: "DISETUJUI" | "DITOLAK") => {
    if (notes.trim().length < 5) return toast.error("Alasan keputusan wajib diisi (minimal 5 karakter).");
    decide.mutate({ customerId: customer.id, decision, notes: notes.trim() });
  };

  const data = screenings.data;
  const isShareholder = user?.role === "SHAREHOLDER";
  const decision = customer.highRiskDecision ?? "BELUM";

  return <div className="min-w-0 space-y-3 rounded-xl border border-[#dce6f0] bg-[#fbfdff] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-display text-sm font-bold text-[#18395f]">Riwayat penyaringan DTTOT/DPPSPM</p>
      <Button type="button" size="sm" variant="outline" className="border-2 border-[#183f70] text-[#183f70] hover:bg-[#eef4fb]"
        disabled={rescreen.isPending} onClick={() => rescreen.mutate({ customerId: customer.id })}>
        <RefreshCw className={`mr-1.5 size-3.5 ${rescreen.isPending ? "animate-spin" : ""}`} />{rescreen.isPending ? "Menyaring…" : "Saring ulang sekarang"}
      </Button>
    </div>

    {customer.riskLevel === "HIGH" ? <div className={`rounded-lg border p-3 text-xs ${decision === "DISETUJUI" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
      <p className="flex items-center gap-1.5 font-bold">
        {decision === "DISETUJUI" ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}
        {decision === "DISETUJUI" ? "Disetujui Pemegang Saham — nasabah dapat bertransaksi"
          : decision === "DITOLAK" ? "Ditolak Pemegang Saham — hubungan usaha dihentikan"
          : "Belum diputuskan Pemegang Saham — bon baru akan ditolak"}
      </p>
      {customer.highRiskDecidedAt ? <p className="mt-1">Diputuskan {formatDateTimeWib(customer.highRiskDecidedAt)}{customer.highRiskDecisionNotes ? ` · ${customer.highRiskDecisionNotes}` : ""}</p> : null}

      {isShareholder ? <div className="mt-3 space-y-2">
        <Label className="text-[11px]" htmlFor="high-risk-notes">Alasan keputusan (wajib, tersimpan pada jejak audit)</Label>
        <Textarea id="high-risk-notes" className="bg-white" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)}
          placeholder="Contoh: sumber dana terverifikasi dari dokumen usaha; kunjungan lapangan 9 September 2026." />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="bg-[#3d7139] text-white hover:bg-[#345f31]" disabled={decide.isPending}
            onClick={() => submitDecision("DISETUJUI")}>{decide.isPending ? "Menyimpan…" : "Setujui — nasabah dapat bertransaksi"}</Button>
          <Button type="button" size="sm" variant="outline" className="border-2 border-rose-600 text-rose-700 hover:bg-rose-50" disabled={decide.isPending}
            onClick={() => submitDecision("DITOLAK")}>{decide.isPending ? "Menyimpan…" : "Tolak — hentikan hubungan usaha"}</Button>
        </div>
      </div> : <p className="mt-2 text-[11px]">Hanya Pemegang Saham yang dapat memutuskan.</p>}
    </div> : null}

    {screenings.isLoading ? <p className="text-xs text-[#68758c]">Memuat riwayat penyaringan…</p> : null}
    {screenings.isError ? <p className="text-xs text-rose-700">Riwayat penyaringan gagal dimuat. Muat ulang halaman untuk mencoba lagi.</p> : null}

    {data ? <>
      {data.isStale ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <b>Daftar sanksi sudah lebih baru daripada penyaringan terakhirnya.</b> Penyaringan terakhir memakai daftar {formatDateTimeWib(data.screenings[0]?.listSnapshotAt)}, sedangkan daftar terbaru diimpor {formatDateTimeWib(data.latestImportAt)}. Tekan “Saring ulang sekarang”.
      </p> : null}

      {data.neverScreened ? <p className="rounded-lg border border-[#dce6f0] bg-white px-3 py-3 text-xs text-[#475569]">
        <b>Belum pernah disaring.</b> Nasabah ini belum punya satu pun jejak penyaringan terhadap DTTOT/DPPSPM. Tekan “Saring ulang sekarang” untuk membuatnya.
      </p> : <div className="overflow-x-auto rounded-lg border border-[#e2eaf2] bg-white">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="bg-[#f4f8fc] text-[11px] uppercase tracking-wide text-[#68758c]">
            <tr><th className="px-3 py-2">Waktu</th><th className="px-3 py-2">Pemicu</th><th className="px-3 py-2">Oleh</th><th className="px-3 py-2">Kemungkinan cocok</th><th className="px-3 py-2">Daftar</th></tr>
          </thead>
          <tbody>
            {data.screenings.map((row) => <tr key={row.id} className="border-t border-[#eef3f8]">
              <td className="px-3 py-2 text-[#18395f]">{formatDateTimeWib(row.screenedAt)}</td>
              <td className="px-3 py-2">{SCREENING_TRIGGER_LABELS[row.trigger] ?? row.trigger}</td>
              <td className="px-3 py-2">{row.screenedByUserId ? (row.screenedByName ?? `#${row.screenedByUserId}`) : "Otomatis (sistem)"}</td>
              <td className="px-3 py-2">
                {row.matchCount === 0 ? <span className="text-[#3d7139]">Nihil</span> : <span className="font-semibold text-rose-700">{row.matchCount}</span>}
                {row.summary ? <span className="block text-[11px] text-[#68758c]">{row.summary}</span> : null}
              </td>
              <td className="px-3 py-2 text-[#68758c]">{row.listSnapshotAt ? formatDateTimeWib(row.listSnapshotAt) : "Belum ada daftar"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
      <p className="text-[11px] text-[#68758c]">Kemungkinan cocok bukan keputusan: kotak centang “Cocok DTTOT/DPPSPM” tetap diisi manusia beserta catatannya.</p>
    </> : null}
  </div>;
}

function DetailField({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return <div className={full ? "sm:col-span-2" : undefined}>
    <p className="text-[11px] font-bold tracking-[0.1em] text-[#68758c] uppercase">{label}</p>
    <p className="mt-0.5 text-sm text-[#18395f]">{value}</p>
  </div>;
}
