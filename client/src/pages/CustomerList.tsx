import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Download, Search, UserPlus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
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
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">Cari berdasarkan nama, NIK/nomor identitas, atau nomor CIF. Ekspor data ini kapan saja tanpa dokumen KTP.</p>
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
            <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ketik nama atau NIK/nomor identitas…" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-[#64748b]">Memuat profil…</p>
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
                    <tr key={customer.id} className="align-top hover:bg-[#f9fbff]">
                      <td className="px-3 py-3 font-semibold whitespace-nowrap text-[#18395f]">{customer.cifNumber}</td>
                      <td className="px-3 py-3 font-medium text-[#18395f]">{customer.fullName}</td>
                      <td className="px-3 py-3 text-xs text-[#64748b] whitespace-nowrap">{customer.identityType} · {customer.identityNumber}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap text-[#64748b]">{customer.phoneNumber ?? "—"}</td>
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
                      <td className="px-3 py-3 text-xs whitespace-nowrap text-[#64748b]">{formatDate(customer.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm leading-6 text-[#64748b]">
              {search ? "Tidak ada nasabah yang cocok dengan pencarian." : "Belum ada profil nasabah. Tambahkan profil KYC pertama."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
