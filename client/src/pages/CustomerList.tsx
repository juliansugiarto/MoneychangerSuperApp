import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WatchlistCheckButton } from "@/components/WatchlistCheck";
import { trpc } from "@/lib/trpc";
import { Download, IdCard, Pencil, Search, UserPlus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type CustomerRow = { id: number; identityExpiryDate: string | Date | null; dateOfBirth: string | Date | null; fullName: string; phoneNumber: string | null; identityType: "KTP" | "PASSPORT" | "OTHER"; identityNumber: string; placeOfBirth: string | null; address: string; addressType: "RUMAH" | "KANTOR" | "DOMISILI" | "LAINNYA" | null; addressCountry: string | null; addressProvince: string | null; addressCity: string | null; addressDistrict: string | null; addressPostalCode: string | null; nationality: string | null; npwp: string | null; gender: "MALE" | "FEMALE" | null; occupation: string | null; sourceOfFunds: string | null; transactionPurpose: string | null; profileStatus: "ACTIVE" | "RESTRICTED" | "INACTIVE"; riskLevel: "LOW" | "MEDIUM" | "HIGH"; riskNotes: string | null; pepStatus: "NONE" | "SELF" | "RELATED"; pepDetails: string | null; dttotPpsdmMatch: boolean; dttotPpsdmNotes: string | null };
const toDateInputValue = (value: string | Date | null | undefined) => (value ? new Date(value).toISOString().slice(0, 10) : "");
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
  changeReason: "",
});

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

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
    if (editForm.dttotPpsdmMatch && !editForm.dttotPpsdmNotes.trim()) return toast.error("Catatan kecocokan DTTOT/PPSPM wajib diisi.");
    if (editForm.changeReason.trim().length < 5) return toast.error("Alasan perubahan wajib diisi (minimal 5 karakter).");
    update.mutate({
      customerId: selectedCustomer.id,
      ...editForm,
      identityExpiryDate: editForm.identityExpiryDate ? new Date(editForm.identityExpiryDate) : undefined,
      dateOfBirth: new Date(editForm.dateOfBirth),
    });
  };

  const nameById = useMemo(() => new Map((customers ?? []).map((customer) => [customer.id, customer.fullName])), [customers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers ?? [];
    return (customers ?? []).filter((customer) => customer.fullName.toLowerCase().includes(term) || customer.identityNumber.toLowerCase().includes(term) || customer.cifNumber.toLowerCase().includes(term));
  }, [customers, search]);

  const exportCsv = () => {
    const headers = ["CIF", "Nama Lengkap", "Jenis Identitas", "Nomor Identitas", "Berlaku Hingga", "Telepon", "Tempat Lahir", "Tanggal Lahir", "Alamat", "Pekerjaan", "Sumber Dana", "Tujuan Transaksi", "Status Profil", "Tingkat Risiko", "Catatan Risiko", "Beneficial Owner", "Nama Beneficial Owner", "Status PEP", "Keterangan PEP", "Cocok DTTOT/PPSPM", "Catatan DTTOT/PPSPM", "Tanggal Dibuat"];
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
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-[#5c8f53] uppercase"><UsersRound className="size-4" /> KYC / CDD</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[#18395f]">Daftar nasabah</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#475569]">Cari berdasarkan nama, NIK/nomor identitas, atau nomor CIF. Ekspor data ini kapan saja tanpa dokumen KTP.</p>
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
                          {customer.dttotPpsdmMatch ? <Badge className="bg-rose-600 text-white hover:bg-rose-600">DTTOT/PPSPM</Badge> : null}
                          {!customer.hasBeneficialOwner && customer.pepStatus === "NONE" && !customer.dttotPpsdmMatch ? <span className="text-xs text-[#94a7bb]">—</span> : null}
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
                <div><Label className="text-xs">Status PEP</Label><Select value={editForm.pepStatus} onValueChange={(v) => setEditForm({ ...editForm, pepStatus: v as typeof editForm.pepStatus })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Bukan PEP</SelectItem><SelectItem value="SELF">Nasabah adalah PEP</SelectItem><SelectItem value="RELATED">Berhubungan dengan PEP</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Cocok DTTOT/PPSPM</Label><Select value={editForm.dttotPpsdmMatch ? "yes" : "no"} onValueChange={(v) => setEditForm({ ...editForm, dttotPpsdmMatch: v === "yes" })}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">Tidak</SelectItem><SelectItem value="yes">Ya</SelectItem></SelectContent></Select></div>
              </div>
              {editForm.pepStatus !== "NONE" ? <div><Label className="text-xs">Keterangan PEP</Label><Input className="mt-1" value={editForm.pepDetails} onChange={(e) => setEditForm({ ...editForm, pepDetails: e.target.value })} /></div> : null}
              <WatchlistCheckButton name={editForm.fullName} />
              {editForm.dttotPpsdmMatch ? <div><Label className="text-xs">Catatan DTTOT/PPSPM</Label><Input className="mt-1" value={editForm.dttotPpsdmNotes} onChange={(e) => setEditForm({ ...editForm, dttotPpsdmNotes: e.target.value })} /></div> : null}
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
              <DetailField label="Beneficial owner" value={selectedCustomer.hasBeneficialOwner ? (selectedCustomer.beneficialOwnerCustomerId ? (nameById.get(selectedCustomer.beneficialOwnerCustomerId) ?? `#${selectedCustomer.beneficialOwnerCustomerId}`) : "Ya") : "Tidak"} />
              <DetailField label="Status PEP" value={selectedCustomer.pepStatus === "SELF" ? "Nasabah adalah PEP" : selectedCustomer.pepStatus === "RELATED" ? "Berhubungan dengan PEP" : "Bukan PEP"} />
              {selectedCustomer.pepDetails ? <DetailField label="Keterangan PEP" value={selectedCustomer.pepDetails} full /> : null}
              <DetailField label="Cocok DTTOT/PPSPM" value={selectedCustomer.dttotPpsdmMatch ? "Ya" : "Tidak"} />
              {selectedCustomer.dttotPpsdmNotes ? <DetailField label="Catatan DTTOT/PPSPM" value={selectedCustomer.dttotPpsdmNotes} full /> : null}
            </div>}
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

function DetailField({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return <div className={full ? "sm:col-span-2" : undefined}>
    <p className="text-[11px] font-bold tracking-[0.1em] text-[#68758c] uppercase">{label}</p>
    <p className="mt-0.5 text-sm text-[#18395f]">{value}</p>
  </div>;
}
