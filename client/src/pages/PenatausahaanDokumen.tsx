import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { DEFAULT_OPERATIONAL_TIMEZONE } from "@shared/regulatoryActionQueue";
import { Archive, FileSearch, MessageSquareOff, Scale, UserRoundCheck, UserRoundX } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Penatausahaan dokumen — Pasal 48 PBI 10/2024. Halaman pemeriksa, **hanya membaca**.
 *
 * Tidak ada tombol hapus di sini dan tidak akan pernah ada: yang lewat tenggat tidak dihapus dan
 * tidak diusulkan dihapus, karena Pasal 48 menetapkan batas paling singkat dan ayat (6) justru
 * membolehkan penatausahaan lebih lama. Kalimat dasar retensi diambil dari `verdict.detail` apa
 * adanya — layar tidak menyusun ulang kaidahnya.
 */

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  KTP_PHOTO: "Foto identitas",
  UNDERLYING: "Underlying (lama)",
  UNDERLYING_FORM: "Formulir underlying",
  UNDERLYING_STATEMENT: "Surat pernyataan",
  UNDERLYING_INVOICE: "Invoice underlying",
};

const STATUS_LABELS: Record<string, string> = { ACTIVE: "Aktif", RESTRICTED: "Dibatasi", INACTIVE: "Tidak aktif" };

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", PENDING_REVIEW: "Menunggu tinjauan", APPROVED: "Disetujui", COMPLETED: "Selesai", RETURNED: "Dikembalikan", CANCELLED: "Batal",
};

function formatDate(value: string | Date | null | undefined, timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone }).format(new Date(value));
}

function RetainUntil({ value, timeZone }: { value: string | Date | null; timeZone: string }) {
  if (!value) {
    return <span className="font-medium text-[#3c6f48]">Tanpa batas — hubungan usaha masih berjalan</span>;
  }
  return <span className="font-medium text-[#18395f]">{formatDate(value, timeZone)}</span>;
}

function SummaryCard({ icon, title, value, legalBasis, children }: { icon: React.ReactNode; title: string; value: number | string; legalBasis: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e2eaf2] bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7b8fa5]">{icon}{title}</p>
      <p className="mt-2 font-display text-3xl text-[#18395f]">{value}</p>
      {children}
      <p className="mt-2 text-xs leading-5 text-[#718398]">{legalBasis}</p>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-[#f0d6d6] bg-[#fdf6f6] p-4">
      <p className="text-sm text-[#9a4b4b]">{message}</p>
      <Button className="mt-3" variant="outline" onClick={onRetry}>Coba lagi</Button>
    </div>
  );
}

export default function PenatausahaanDokumen() {
  const { user } = useAuth();
  const overview = trpc.documents.retentionOverview.useQuery(undefined, { enabled: Boolean(user) });
  const customers = trpc.customers.list.useQuery(undefined, { enabled: Boolean(user) });
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const statement = trpc.documents.retentionStatement.useQuery(
    { customerId: selectedCustomerId ?? 0 },
    { enabled: Boolean(user) && selectedCustomerId !== null },
  );

  // Daftar nasabah dibaca utuh, bukan lewat pencarian transaksi: pencarian itu hanya memuat nasabah
  // ACTIVE, padahal yang paling perlu ditunjukkan kepada pemeriksa justru nasabah yang tidak aktif.
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2 || !customers.data) return [];
    return customers.data
      .filter((row) => row.fullName.toLowerCase().includes(term) || row.cifNumber.toLowerCase().includes(term))
      .slice(0, 8);
  }, [customers.data, search]);

  const timeZone = statement.data?.timeZone ?? DEFAULT_OPERATIONAL_TIMEZONE;
  const documentRows = statement.data
    ? [
      ...statement.data.customerDocuments.map((row) => ({ key: `c-${row.id}`, label: DOCUMENT_TYPE_LABELS[row.documentType] ?? row.documentType, fileName: row.originalFileName, context: "Dokumen nasabah", verdict: row.verdict })),
      ...statement.data.transactionDocuments.map((row) => ({ key: `t-${row.id}`, label: DOCUMENT_TYPE_LABELS[row.documentType] ?? row.documentType, fileName: row.originalFileName, context: `Bon ${row.transactionNumber}`, verdict: row.verdict })),
    ]
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="mt-2 max-w-3xl text-sm text-[#334155]">
          Berapa lama dokumen dan catatan nasabah wajib ditatausahakan menurut Pasal 48 PBI 10/2024, dihitung
          dari data yang benar-benar tercatat. Halaman ini hanya membaca: aplikasi ini <strong>tidak menghapus</strong> dokumen
          nasabah maupun transaksi, termasuk yang tenggatnya sudah lewat.
        </p>
      </header>

      <Card className="border-[#dce6f0] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><Scale className="size-5 text-[#5c8f53]" />Ringkasan</CardTitle>
          <CardDescription>
            {overview.data ? `Dihitung per ${formatDate(overview.data.asOf)}.` : "Jumlah nasabah dan dokumen menurut keadaan jam retensinya."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-40 w-full" />)}</div>
          ) : overview.isError ? (
            <ErrorBox message={`Ringkasan tidak dapat dimuat: ${overview.error.message}`} onRetry={() => overview.refetch()} />
          ) : overview.data ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                icon={<UserRoundCheck className="size-3.5" />}
                title="Hubungan usaha berjalan"
                value={overview.data.customers.relationshipOngoing}
                legalBasis="Pasal 48 ayat (1) huruf a: jam lima tahun belum berdetak selama hubungan usaha masih berjalan."
              />
              <SummaryCard
                icon={<UserRoundX className="size-3.5" />}
                title="Hubungan usaha berakhir"
                value={overview.data.customers.relationshipEnded}
                legalBasis="Lima tahun sejak yang terakhir di antara berakhirnya hubungan usaha, transaksi terakhir, atau ketidaksesuaian profil — masa retensi terlama (penjelasan ayat (1) huruf b)."
              >
                <p className="mt-1 text-sm text-[#33506f]">Tenggat sudah lewat: <strong>{overview.data.customers.pastRetention}</strong></p>
                <p className="text-xs text-[#718398]">Tidak dihapus — ayat (6) membolehkan penatausahaan lebih lama.</p>
              </SummaryCard>
              <SummaryCard
                icon={<FileSearch className="size-3.5" />}
                title="Tidak aktif tanpa tanggal berakhir"
                value={overview.data.customers.inactiveWithoutEndDate}
                legalBasis="Dinonaktifkan sebelum tanggal berakhirnya hubungan usaha mulai dicatat. Diperlakukan belum berdetak, bukan ditebak dari tanggal penyuntingan terakhir."
              />
              <SummaryCard
                icon={<Archive className="size-3.5" />}
                title="Dokumen profil perusahaan"
                value={overview.data.companyProfileDocuments.total}
                legalBasis="Aturan rumah lima tahun sejak diunggah — bukan kewajiban Pasal 48, karena logo dan izin usaha bukan data Pengguna Jasa."
              >
                <p className="mt-1 text-sm text-[#33506f]">Nonaktif: <strong>{overview.data.companyProfileDocuments.deactivated}</strong> · lewat aturan rumah: <strong>{overview.data.companyProfileDocuments.pastHouseRule}</strong></p>
              </SummaryCard>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-[#dce6f0] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><FileSearch className="size-5 text-[#5c8f53]" />Pernyataan per nasabah</CardTitle>
          <CardDescription>Pasal 48 ayat (4): dokumen dan catatan satu nasabah beserta sampai kapan masing-masing wajib ditahan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="retention-customer-search" className="text-xs font-semibold text-[#476278]">Cari nasabah (nama atau CIF), termasuk yang tidak aktif</Label>
            <Input id="retention-customer-search" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Minimal dua huruf" />
          </div>

          {customers.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : customers.isError ? (
            <ErrorBox message={`Daftar nasabah tidak dapat dimuat: ${customers.error.message}`} onRetry={() => customers.refetch()} />
          ) : search.trim().length >= 2 && matches.length === 0 ? (
            <p className="text-sm text-[#475569]">Tidak ada nasabah yang cocok dengan &ldquo;{search.trim()}&rdquo;.</p>
          ) : matches.length ? (
            <ul className="flex flex-wrap gap-2">
              {matches.map((row) => (
                <li key={row.id}>
                  <Button
                    type="button"
                    size="sm"
                    variant={row.id === selectedCustomerId ? "default" : "outline"}
                    onClick={() => setSelectedCustomerId(row.id)}
                    aria-pressed={row.id === selectedCustomerId}
                  >
                    {row.fullName} · {row.cifNumber} · {STATUS_LABELS[row.profileStatus] ?? row.profileStatus}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {selectedCustomerId === null ? (
            <div className="rounded-xl border border-dashed border-[#dce6f0] p-8 text-center">
              <p className="text-sm font-semibold text-[#213f63]">Belum ada nasabah dipilih.</p>
              <p className="mt-1 text-sm text-[#718398]">Cari nasabah di atas untuk menampilkan pernyataan retensinya.</p>
            </div>
          ) : statement.isLoading ? (
            <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>
          ) : statement.isError ? (
            <ErrorBox message={`Pernyataan retensi tidak dapat dimuat: ${statement.error.message}`} onRetry={() => statement.refetch()} />
          ) : statement.data ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#e2eaf2] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#18395f]">{statement.data.customer.fullName}</p>
                    <p className="text-xs text-[#718398]">{statement.data.customer.cifNumber} · zona operasional {timeZone}</p>
                  </div>
                  <Badge variant="outline" className={statement.data.customer.profileStatus === "INACTIVE" ? "border-[#e4dcc4] bg-[#fdfaf0] text-[#7a6626]" : "border-[#cfe2d6] bg-[#f5fbf5] text-[#3c6f48]"}>
                    {STATUS_LABELS[statement.data.customer.profileStatus] ?? statement.data.customer.profileStatus}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-2 text-sm text-[#33506f] sm:grid-cols-2">
                  <div className="flex justify-between gap-3"><dt>Hubungan usaha berakhir</dt><dd>{formatDate(statement.data.customer.relationshipEndedAt, timeZone)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Transaksi selesai terakhir</dt><dd>{formatDate(statement.data.facts.lastCompletedTransactionAt, timeZone)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Ketidaksesuaian profil terakhir</dt><dd>{formatDate(statement.data.facts.lastDeviationReviewAt, timeZone)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Data nasabah ditahan sampai</dt><dd><RetainUntil value={statement.data.customerVerdict.retainUntil} timeZone={timeZone} /></dd></div>
                </dl>
                <p className="mt-2 text-xs text-[#718398]">{statement.data.customerVerdict.detail}</p>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-[#18395f]">Dokumen</h3>
                {documentRows.length === 0 ? (
                  <p className="text-sm text-[#475569]">Belum ada dokumen tersimpan untuk nasabah ini maupun bon-bonnya.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Dokumen</TableHead><TableHead>Dasar retensi</TableHead><TableHead>Ditahan sampai</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {documentRows.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell><p className="font-medium text-[#18395f]">{row.label}</p><p className="text-xs text-[#718398]">{row.fileName} · {row.context}</p></TableCell>
                            <TableCell className="whitespace-normal text-sm text-[#33506f]">{row.verdict.detail}</TableCell>
                            <TableCell><RetainUntil value={row.verdict.retainUntil} timeZone={timeZone} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-[#18395f]">Catatan transaksi (bon)</h3>
                {statement.data.transactions.length === 0 ? (
                  <p className="text-sm text-[#475569]">Nasabah ini belum pernah bertransaksi.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Bon</TableHead><TableHead>Dasar retensi</TableHead><TableHead>Ditahan sampai</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {statement.data.transactions.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell><p className="font-medium text-[#18395f]">{row.transactionNumber}</p><p className="text-xs text-[#718398]">{formatDate(row.transactionAt, timeZone)} · {TRANSACTION_STATUS_LABELS[row.status] ?? row.status}</p></TableCell>
                            <TableCell className="whitespace-normal text-sm text-[#33506f]">{row.verdict.detail}</TableCell>
                            <TableCell><RetainUntil value={row.verdict.retainUntil} timeZone={timeZone} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#f9fbfd] p-3 text-sm text-[#33506f]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7b8fa5]">Catatan yang ikut ditatausahakan</p>
                  <p className="mt-2">Penyaringan daftar pantau: <strong>{statement.data.records.watchlistScreenings}</strong></p>
                  <p>Peninjauan profil: <strong>{statement.data.records.profileReviews}</strong></p>
                </div>
                <div className="rounded-xl border border-[#e4dcc4] bg-[#fdfaf0] p-3 text-sm text-[#7a6626]">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"><MessageSquareOff className="size-3.5" />Korespondensi</p>
                  <p className="mt-2">{statement.data.korespondensi.keterangan}</p>
                </div>
              </section>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
