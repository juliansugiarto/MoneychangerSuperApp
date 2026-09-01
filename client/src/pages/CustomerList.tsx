import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Download, IdCard, Search, UserPlus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

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
  const utils = trpc.useUtils();

  const openCustomer = (customer: NonNullable<typeof customers>[number]) => { setSelectedCustomer(customer); setShowIdentityRequested(false); };

  const viewIdentity = async () => {
    if (!selectedCustomer) return;
    setShowIdentityRequested(true);
    try {
      const docs = await utils.documents.forCustomer.fetch({ customerId: selectedCustomer.id });
      const ktp = docs.find((doc) => doc.documentType === "KTP_PHOTO");
      if (!ktp) { toast.error("Belum ada foto identitas tersimpan untuk nasabah ini."); return; }
      const url = await utils.documents.downloadUrl.fetch({ documentId: ktp.id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Gagal membuka dokumen identitas.");
    } finally {
      setShowIdentityRequested(false);
    }
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
            <Button type="button" size="sm" onClick={viewIdentity} disabled={showIdentityRequested} className="w-fit border-2 border-[#183f70] bg-white text-[#183f70] hover:bg-[#eef4fb]">
              <IdCard className="mr-1.5 size-4" />{showIdentityRequested ? "Membuka…" : "Lihat foto identitas"}
            </Button>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
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
            </div>
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
