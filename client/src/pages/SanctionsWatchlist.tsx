import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, FileSpreadsheet, Search, ShieldAlert, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const listTypeLabels: Record<string, string> = { DTTOT: "DTTOT (Terduga Teroris)", PPPSM: "PPPSM (Proliferasi Senjata Pemusnah Massal)" };

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Berkas tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
}

export default function SanctionsWatchlist() {
  const { user } = useAuth();
  const canImport = user?.role === "CONTROLLER" || user?.role === "SHAREHOLDER";
  const utils = trpc.useUtils();
  const { data: summary, isLoading: summaryLoading } = trpc.sanctionsWatchlist.summary.useQuery();
  const [query, setQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const search = trpc.sanctionsWatchlist.search.useQuery({ query }, { enabled: query.trim().length >= 3 });

  const uploadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Ukuran berkas maksimal 5 MB.");
    setIsImporting(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const response = await fetch("/api/sanctions-watchlist-import", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataBase64, originalFileName: file.name, mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize: file.size }) });
      const payload = await response.json() as { imported?: { listType: string; sourceLabel: string | null; recordCount: number }; message?: string };
      if (!response.ok || !payload.imported) throw new Error(payload.message || "Berkas tidak dapat diimpor.");
      toast.success(`${listTypeLabels[payload.imported.listType] ?? payload.imported.listType}${payload.imported.sourceLabel ? ` (${payload.imported.sourceLabel})` : ""} diperbarui — ${payload.imported.recordCount} entri.`);
      void utils.sanctionsWatchlist.summary.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Berkas tidak dapat diimpor.");
    } finally {
      setIsImporting(false);
    }
  };

  return <section className="space-y-6">
    <Card className="border-[#dce6f0]">
      <CardHeader><div className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><ShieldAlert className="size-5" /></span><div><CardTitle className="font-display text-xl text-[#18395f]">Cek Watchlist DTTOT/PPPSM</CardTitle><CardDescription>Pencocokan nama fuzzy terhadap Daftar Terduga Teroris dan Organisasi Teroris (DTTOT) dan Daftar Pendanaan Proliferasi Senjata Pemusnah Massal (PPPSM) — data resmi PPATK/DK PBB. Ini hanya <strong>alat bantu penyaringan</strong>: hasil pencarian tidak pernah menandai nasabah secara otomatis. Petugas tetap wajib memeriksa manual dan mencentang kolom Cocok DTTOT/PPPSM beserta catatannya di profil nasabah bila memang cocok.</CardDescription></div></div></CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a7bb]" />
          <Input className="bg-white pl-9" placeholder="Ketik nama lengkap untuk dicocokkan (minimal 3 karakter)…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {query.trim().length > 0 && query.trim().length < 3 ? <p className="text-xs text-[#718297]">Masukkan minimal 3 karakter.</p> : null}
        {search.isFetching ? <div className="h-16 animate-pulse rounded-xl bg-[#f3f6fa]" /> : null}
        {search.error ? <p className="text-xs text-rose-700">{search.error.message}</p> : null}
        {!search.isFetching && search.data && query.trim().length >= 3 ? (
          search.data.length ? <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900"><AlertTriangle className="size-4 shrink-0" />{search.data.length} kemungkinan kecocokan ditemukan. Periksa detail berikut secara manual sebelum mengambil keputusan.</div>
            {search.data.map((match) => <div key={match.id} className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-[#294866]">{match.fullName}</p>
                <Badge className="bg-rose-600 text-white hover:bg-rose-600">{listTypeLabels[match.listType] ?? match.listType}{match.sourceLabel ? ` — ${match.sourceLabel}` : ""}</Badge>
                <Badge variant="outline">{match.entityType === "INDIVIDUAL" ? "Perorangan" : "Korporasi/Entitas"}</Badge>
                <Badge variant="outline">Skor kecocokan {(match.score * 100).toFixed(0)}%</Badge>
              </div>
              {match.matchedOn !== match.fullName ? <p className="mt-1 text-xs text-[#718297]">Cocok pada alias: <strong>{match.matchedOn}</strong></p> : null}
              <dl className="mt-3 grid gap-2 text-xs leading-5 text-[#586f88] sm:grid-cols-2">
                {match.referenceCode ? <div><dt className="font-semibold text-[#425b76]">Kode referensi</dt><dd>{match.referenceCode}</dd></div> : null}
                {match.dateOfBirth ? <div><dt className="font-semibold text-[#425b76]">Tanggal lahir</dt><dd>{match.dateOfBirth}</dd></div> : null}
                {match.placeOfBirth ? <div><dt className="font-semibold text-[#425b76]">Tempat lahir</dt><dd>{match.placeOfBirth}</dd></div> : null}
                {match.nationality ? <div><dt className="font-semibold text-[#425b76]">Kewarganegaraan</dt><dd>{match.nationality}</dd></div> : null}
                {match.address ? <div className="sm:col-span-2"><dt className="font-semibold text-[#425b76]">Alamat</dt><dd className="whitespace-pre-wrap">{match.address}</dd></div> : null}
                {match.description ? <div className="sm:col-span-2"><dt className="font-semibold text-[#425b76]">Keterangan</dt><dd className="whitespace-pre-wrap">{match.description}</dd></div> : null}
              </dl>
            </div>)}
          </div> : <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-800">Tidak ada kecocokan yang cukup dekat ditemukan pada daftar yang sedang dimuat.</p>
        ) : null}
      </CardContent>
    </Card>

    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-xl text-[#18395f]">Daftar yang sedang dimuat</CardTitle><CardDescription>Sumber dan kapan setiap daftar terakhir diperbarui. Perbarui secara berkala mengikuti rilis resmi PPATK — aplikasi ini tidak menarik data otomatis dari sumber mana pun.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {summaryLoading ? <div className="h-16 animate-pulse rounded-xl bg-[#f3f6fa]" /> : null}
        {!summaryLoading && !summary?.length ? <p className="rounded-xl border border-dashed border-[#cfdbe7] p-4 text-sm text-[#718297]">Belum ada daftar yang diimpor. Pencarian di atas tidak akan menemukan apa pun sampai setidaknya satu daftar diimpor.</p> : null}
        <div className="space-y-2">
          {summary?.map((row) => <div key={`${row.listType}-${row.sourceLabel ?? ""}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e0e8f1] bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{listTypeLabels[row.listType] ?? row.listType}{row.sourceLabel ? ` — ${row.sourceLabel}` : ""}</Badge><span className="text-[#586f88]">{row.recordCount} entri</span></div>
            <p className="text-xs text-[#718297]">Sumber: {row.sourceFileName} · Diimpor {new Date(row.importedAt).toLocaleString("id-ID")}</p>
          </div>)}
        </div>
        {canImport ? <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[#bcd1e5] bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-bold text-[#315879]">Impor/perbarui daftar</p><p className="mt-1 text-xs leading-5 text-[#647a92]">Unggah workbook resmi DTTOT atau PPPSM (XLSX/XLS, maks 5 MB). Sistem mendeteksi jenis dan sumbernya secara otomatis dari struktur kolom dan kode referensi, lalu menggantikan seluruh entri lama untuk sumber yang sama.</p></div>
          <label className="press-scale inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-[#e7f49a] px-3 text-sm font-semibold text-[#203a56] hover:bg-[#dff085]"><FileSpreadsheet className="mr-1.5 size-4" />{isImporting ? "Mengimpor…" : "Pilih XLSX / XLS"}<input type="file" className="sr-only" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" disabled={isImporting} onChange={(event) => { void uploadFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
        </div> : <p className="rounded-xl bg-[#f5f8fc] px-3 py-2.5 text-xs text-[#718297]"><Upload className="mr-1 inline size-3.5" />Hanya Controller atau Shareholder yang dapat mengimpor/memperbarui daftar.</p>}
      </CardContent>
    </Card>
  </section>;
}
