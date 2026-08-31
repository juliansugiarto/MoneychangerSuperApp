import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { formatIdrDecimal } from "@/lib/money";
import { minorToDecimal, summarizeMonitoring, type MonitoringDirection } from "@shared/monitoring";
import { ArrowLeftRight, BarChart3, CalendarRange, CircleAlert, FileBarChart, RefreshCw, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocation } from "wouter";

const rangeOptions = [
  { value: "7", label: "7 hari" },
  { value: "30", label: "30 hari" },
  { value: "90", label: "90 hari" },
] as const;

function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_REVIEW: "Menunggu review",
    APPROVED: "Disetujui",
    COMPLETED: "Selesai",
    RETURNED: "Dikembalikan",
    ESCALATED: "Dieskalasi",
    CANCELLED: "Dibatalkan",
  };
  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (status === "COMPLETED" || status === "APPROVED") return "status-approved";
  if (status === "PENDING_REVIEW" || status === "ESCALATED") return "status-pending";
  if (status === "CANCELLED" || status === "RETURNED") return "status-rejected";
  return "status-inactive";
}

export default function Monitoring() {
  const [, setLocation] = useLocation();
  const [days, setDays] = useState<(typeof rangeOptions)[number]["value"]>("30");
  const [direction, setDirection] = useState<MonitoringDirection>("ALL");
  const queryInput = useMemo(() => {
    const now = new Date();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(days) + 1);
    return { from, to };
  }, [days]);
  const { data, isLoading, isFetching, error, refetch } = trpc.reports.transactions.useQuery(queryInput);
  const summary = useMemo(() => summarizeMonitoring(data ?? [], direction), [data, direction]);
  const chartData = useMemo(() => summary.daily.map((item) => ({
    label: new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(`${item.day}T12:00:00+07:00`)),
    transaksi: item.count,
    beli: Number(item.buyMinor) / 100,
    jual: Number(item.sellMinor) / 100,
  })), [summary.daily]);
  const currencyData = useMemo(() => summary.currencies.slice(0, 6).map((item) => ({ code: item.code, nilai: Number(item.valueMinor) / 100 })), [summary.currencies]);
  const period = `${formatDate(queryInput.from)} – ${formatDate(new Date(queryInput.to.getTime() - 1))}`;
  const total = formatIdrDecimal(minorToDecimal(summary.totalValueMinor));
  const isEmpty = !isLoading && !error && summary.transactionCount === 0;

  const metrics = [
    { label: "Transaksi tercatat", value: String(summary.transactionCount), note: `${summary.buyCount} bon beli · ${summary.sellCount} bon jual`, icon: ArrowLeftRight, tone: "bg-blue-50 text-blue-700" },
    { label: "Nilai transaksi", value: total, note: "Akumulasi nominal Rupiah pada periode", icon: WalletCards, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Nasabah unik", value: String(summary.uniqueCustomerCount), note: "Nasabah dengan transaksi tercatat", icon: UsersRound, tone: "bg-violet-50 text-violet-700" },
    { label: "Screening & review", value: `${summary.reviewRatePct.toFixed(1)}%`, note: `${summary.pendingReviewCount} transaksi masih menunggu review`, icon: ShieldCheck, tone: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="mx-auto max-w-[1320px] space-y-6">
      <header className="rounded-3xl bg-[radial-gradient(circle_at_85%_15%,rgba(148,233,133,0.25),transparent_24%),linear-gradient(120deg,#102f58,#1f5c8e)] px-6 py-7 text-white shadow-[0_20px_45px_rgba(16,47,88,0.18)] sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.17em] text-[#bfe9d0] uppercase"><BarChart3 className="size-4" /> Konsol pengawasan</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Monitoring operasional.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/80">Ringkasan bon jual-beli, screening, dan mata uang berdasarkan transaksi IBV yang tercatat. Tidak ada data simulasi atau angka perkiraan.</p>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <RefreshCw className={isFetching ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} /> Perbarui data
          </Button>
        </div>
      </header>

      <Card className="border-[#dce7f0] shadow-[0_8px_24px_rgba(25,65,108,0.04)]">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-[#5c8f53] uppercase"><CalendarRange className="size-4" /> Periode monitoring</p>
            <p className="mt-2 text-sm font-semibold text-[#1b4169]">{period}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex rounded-xl bg-[#f2f6fa] p-1" aria-label="Pilihan periode">
              {rangeOptions.map((item) => <button type="button" key={item.value} onClick={() => setDays(item.value)} className={days === item.value ? "rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#183f70] shadow-sm" : "rounded-lg px-3 py-2 text-xs font-semibold text-[#718397] hover:text-[#183f70]"}>{item.label}</button>)}
            </div>
            <Select value={direction} onValueChange={(value) => setDirection(value as MonitoringDirection)}>
              <SelectTrigger className="w-full bg-white sm:w-[220px]"><SelectValue placeholder="Semua arah transaksi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua transaksi</SelectItem>
                <SelectItem value="BUY">Bon beli valuta (BNS)</SelectItem>
                <SelectItem value="SELL">Bon jual valuta (BNB)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <section aria-busy="true" aria-live="polite" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="col-span-full rounded-2xl border border-[#dce7f0] bg-white p-8 text-center shadow-[0_8px_24px_rgba(25,65,108,0.04)]"><RefreshCw className="mx-auto size-7 animate-spin text-[#315a89]" /><h2 className="mt-4 font-display text-xl font-semibold text-[#18395f]">Memuat data monitoring…</h2><p className="mt-2 text-sm text-[#6d8093]">Metrik dan grafik akan ditampilkan setelah laporan transaksi berhasil diperoleh.</p></div></section> : null}
      {error ? <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center"><CircleAlert className="mx-auto size-8 text-amber-700" /><h2 className="mt-4 font-display text-xl font-semibold text-[#674a21]">Monitoring belum dapat dimuat.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#8a6a3e]">{error.message || "Terjadi gangguan saat membaca laporan transaksi. Tidak ada perubahan data yang dilakukan."}</p><Button onClick={() => refetch()} variant="outline" className="mt-5 border-amber-300 bg-white text-[#785527] hover:bg-amber-50"><RefreshCw className="mr-2 size-4" /> Coba lagi</Button></section> : null}
      {!isLoading && !error ? <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan monitoring">
        {metrics.map((metric) => <Card key={metric.label} className="border-[#dce7f0] shadow-[0_8px_24px_rgba(25,65,108,0.04)]"><CardContent className="p-5"><div className="flex items-start justify-between"><p className="text-sm font-medium text-[#62768a]">{metric.label}</p><span className={`flex size-10 items-center justify-center rounded-xl ${metric.tone}`}><metric.icon className="size-5" /></span></div><p className="mt-6 font-display text-2xl font-semibold tracking-tight text-[#173b63]">{metric.value}</p><p className="mt-2 min-h-5 text-xs leading-5 text-[#8090a0]">{metric.note}</p></CardContent></Card>)}
      </section>

      {isEmpty ? <section className="rounded-2xl border border-dashed border-[#b7cadb] bg-white px-6 py-14 text-center"><FileBarChart className="mx-auto size-9 text-[#7f9cb6]" /><h2 className="mt-4 font-display text-xl font-semibold text-[#1b4169]">Belum ada transaksi pada periode ini.</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6d8093]">Sesuaikan periode atau arah transaksi bila diperlukan. Konsol ini hanya menampilkan bon yang telah tercatat pada IBV.</p><Button onClick={() => setLocation("/operasional/transaksi")} className="mt-6 bg-[#183f70] hover:bg-[#12345d]"><ArrowLeftRight className="mr-2 size-4" /> Buka bon transaksi</Button></section> : null}

      {!isEmpty ? <>
        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Card className="border-[#dce7f0] shadow-[0_8px_24px_rgba(25,65,108,0.04)]"><CardHeader><CardTitle className="font-display text-[#18395f]">Tren aktivitas harian</CardTitle><CardDescription>Jumlah bon beli dan jual yang tercatat setiap hari dalam periode yang dipilih.</CardDescription></CardHeader><CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}><defs><linearGradient id="monitor-buy" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4d9a4a" stopOpacity={0.25} /><stop offset="95%" stopColor="#4d9a4a" stopOpacity={0} /></linearGradient><linearGradient id="monitor-sell" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2f6fa7" stopOpacity={0.25} /><stop offset="95%" stopColor="#2f6fa7" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#e7eef4" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#718397", fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#718397", fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #dce7f0" }} /><Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} /><Area type="monotone" dataKey="beli" name="Bon beli" stroke="#4d9a4a" fill="url(#monitor-buy)" strokeWidth={2} /><Area type="monotone" dataKey="jual" name="Bon jual" stroke="#2f6fa7" fill="url(#monitor-sell)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></CardContent></Card>
          <Card className="border-[#dce7f0] shadow-[0_8px_24px_rgba(25,65,108,0.04)]"><CardHeader><CardTitle className="font-display text-[#18395f]">Eksposur mata uang</CardTitle><CardDescription>Enam mata uang dengan nilai transaksi Rupiah terbesar pada periode ini.</CardDescription></CardHeader><CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={currencyData} layout="vertical" margin={{ top: 8, right: 8, left: 2, bottom: 0 }}><CartesianGrid stroke="#e7eef4" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="code" tickLine={false} axisLine={false} tick={{ fill: "#315675", fontSize: 12, fontWeight: 600 }} width={42} /><Tooltip formatter={(value) => formatIdrDecimal(value as number)} contentStyle={{ borderRadius: 12, border: "1px solid #dce7f0" }} /><Bar dataKey="nilai" name="Nilai transaksi" fill="#315a89" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-[#dce7f0] shadow-[0_8px_24px_rgba(25,65,108,0.04)]"><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle className="font-display text-[#18395f]">Aktivitas transaksi terbaru</CardTitle><CardDescription>Status dan nilai bon terbaru dari periode yang dipilih.</CardDescription></div><Button variant="outline" size="sm" onClick={() => setLocation("/operasional/transaksi")}>Kelola bon</Button></CardHeader><CardContent className="px-0"><div className="divide-y divide-[#edf2f6]">{summary.records.slice().sort((left, right) => new Date(right.transaction.transactionAt).getTime() - new Date(left.transaction.transactionAt).getTime()).slice(0, 6).map(({ transaction, customer, currency }) => <article key={transaction.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold text-[#18395f]">{customer.fullName}</p><Badge className={transaction.operation === "BUY" ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-blue-50 text-blue-700 border border-blue-200"}>{transaction.operation === "BUY" ? "BNS · Beli" : "BNB · Jual"}</Badge></div><p className="mt-1 text-xs text-[#708498]">{currency.code} · {formatDate(transaction.transactionAt)}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><p className="table-number text-sm font-semibold text-[#315675]">{formatIdrDecimal(transaction.rupiahAmount)}</p><Badge className={statusClass(transaction.status)}>{statusLabel(transaction.status)}</Badge></div></article>)}</div></CardContent></Card>
          <div className="space-y-6"><Card className="border-amber-200 bg-[#fffaf2]"><CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-[#fff0d5] text-amber-700"><CircleAlert className="size-5" /></span><div><CardTitle className="font-display text-[#674a21]">Antrian pengawasan</CardTitle><CardDescription className="text-[#8a6a3e]">Prioritas yang tetap harus ditinjau.</CardDescription></div></div></CardHeader><CardContent><p className="font-display text-3xl font-semibold text-[#674a21]">{summary.pendingReviewCount}</p><p className="mt-1 text-sm text-[#8a6a3e]">dari {summary.requiresReviewCount} bon yang memicu review pada periode ini.</p><Button variant="outline" onClick={() => setLocation("/operasional")} className="mt-5 border-amber-300 bg-white text-[#785527] hover:bg-amber-50">Buka worklist review</Button></CardContent></Card>
            <Card className="border-[#cfe7d0] bg-[#f5fbf5]"><CardContent className="p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[#4b9b51]" /><div><p className="font-semibold text-[#315b3a]">Data terkendali</p><p className="mt-1 text-sm leading-6 text-[#618266]">Filter monitoring hanya mengubah tampilan. Keputusan review, penyelesaian bon, kurs, dan stok tetap melalui proses berizin di modul asal.</p></div></div></CardContent></Card></div>
        </section>
      </> : null}
      </> : null}
    </div>
  );
}
