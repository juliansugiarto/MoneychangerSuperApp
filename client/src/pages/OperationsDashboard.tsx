import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sumIdrDecimals } from "@/lib/money";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, CircleAlert, ClipboardList, Landmark, RefreshCw, ShieldCheck, UserPlus, UsersRound, WalletCards } from "lucide-react";
import { toast } from "sonner";

function goTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function OperationsDashboard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.dashboard.overview.useQuery(undefined, { enabled: Boolean(user) });
  const complete = trpc.transactions.complete.useMutation({
    onSuccess: () => {
      toast.success("Transaksi selesai dan saldo kas diperbarui secara atomik.");
      utils.dashboard.overview.invalidate();
      utils.transactions.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const today = data?.todayTransactions ?? [];
  const approved = today.filter(({ transaction }) => transaction.status === "APPROVED");
  const transactionValue = sumIdrDecimals(today.filter(({ transaction }) => transaction.status !== "CANCELLED").map(({ transaction }) => String(transaction.rupiahAmount)));
  const dateLabel = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(data?.businessDate ? new Date(data.businessDate) : new Date());
  const canMonitor = user?.role === "ADMIN" || user?.role === "CONTROLLER" || user?.role === "SHAREHOLDER";
  const queueCount = (data?.pendingReview.length ?? 0) + approved.length;
  const isShareholder = user?.role === "SHAREHOLDER";
  const { data: internalUsers, isLoading: isLoadingUsers } = trpc.users.list.useQuery(undefined, { enabled: isShareholder });
  const workforceUsers = internalUsers?.filter((account) => account.role === "ADMIN" || account.role === "STAFF") ?? [];
  const adminCount = workforceUsers.filter((account) => account.role === "ADMIN").length;
  const staffCount = workforceUsers.filter((account) => account.role === "STAFF").length;
  const suspendedCount = workforceUsers.filter((account) => account.accountStatus === "SUSPENDED").length;

  return <div className="mx-auto max-w-[1380px]">
    <section className="relative overflow-hidden rounded-[1.5rem] bg-[#192a48] px-5 py-7 text-white shadow-[0_18px_45px_rgba(23,40,71,0.16)] sm:px-7 sm:py-8">
      <div className="public-grid absolute inset-0 opacity-45" /><div className="absolute -right-20 -top-20 size-72 rounded-full bg-[#d7ec75]/12 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold tracking-[0.16em] text-[#d7ec75] uppercase">Pusat kendali outlet</p><h1 className="mt-3 font-display text-3xl tracking-[-0.04em] sm:text-4xl">Pilih tindakan yang perlu diselesaikan.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#d3deef]">{dateLabel}. Ringkasan ini menggunakan catatan transaksi, kas, dan pengawasan yang tersedia di sistem.</p></div><Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="press-scale h-10 border-white/15 bg-white/[0.08] text-white hover:bg-white/15 hover:text-white"><RefreshCw className={isLoading ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />Perbarui data</Button></div>
    </section>

    {data?.isDataUnavailable ? <div role="status" className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p>Ringkasan belum dapat dimuat karena koneksi database sementara tidak tersedia. Tidak ada perubahan data yang dilakukan; gunakan <b>Perbarui data</b> beberapa saat lagi.</p></div> : null}

    <section className="mt-6 grid gap-4 lg:grid-cols-3">
      <MetricCard label="Transaksi hari ini" value={String(today.length)} note={`${transactionValue} nilai transaksi non-batal`} icon={ClipboardList} tone="bg-[#e9eeff] text-[#5470cf]" />
      <MetricCard label="Tindakan dalam antrian" value={String(queueCount)} note="Review atau penyelesaian transaksi" icon={ShieldCheck} tone="bg-[#fff3df] text-[#c68a2d]" />
      <MetricCard label="Saldo valuta tercatat" value={String(data?.cashBalances.length ?? 0)} note="Mata uang dengan saldo kas tersedia" icon={WalletCards} tone="bg-[#eaf6e7] text-[#5c9b57]" />
    </section>

    <section className="mt-6 grid gap-4 lg:grid-cols-3">
      <QuickAction icon={ClipboardList} label="Buat bon transaksi" detail="Mulai pencatatan pembelian atau penjualan valuta." action="Buka transaksi" onClick={() => goTo("/operasional/transaksi")} />
      <QuickAction icon={Landmark} label="Buka / tutup outlet" detail="Ikuti checklist modal awal, kesiapan alat, opname, dan serah-terima." action="Buka checklist" onClick={() => goTo("/operasional/checklist")} />
      <QuickAction icon={ShieldCheck} label={canMonitor ? "Tinjau monitoring" : "Permintaan layanan"} detail={canMonitor ? "Lihat tren dan item yang perlu pengawasan." : "Tinjau kebutuhan layanan dari pengunjung."} action={canMonitor ? "Buka monitoring" : "Buka layanan"} onClick={() => goTo(canMonitor ? "/operasional/monitoring" : "/operasional/layanan")} />
    </section>

    {isShareholder ? <ShareholderUserManagement adminCount={adminCount} staffCount={staffCount} suspendedCount={suspendedCount} isLoading={isLoadingUsers} /> : null}

    <section className="mt-6 grid gap-6 xl:grid-cols-[1.36fr_0.64fr]">
      <article className="overflow-hidden rounded-[1.25rem] border border-[#dce2ec] bg-white shadow-[0_10px_32px_rgba(30,50,87,0.05)]"><div className="flex items-start justify-between gap-4 border-b border-[#e8edf4] px-5 py-5"><div><p className="text-[11px] font-bold tracking-[0.14em] text-[#6f819c] uppercase">Worklist</p><h2 className="mt-1 font-display text-lg text-[#293b58]">Antrian yang perlu tindakan</h2><p className="mt-1 text-xs leading-5 text-[#728198]">Transaksi terflag perlu direview; transaksi approved siap dicatat sebagai selesai.</p></div><Badge className="bg-[#eef2fb] text-[#526681] hover:bg-[#eef2fb]">{queueCount} item</Badge></div>
        <div className="divide-y divide-[#edf0f5]">{isLoading ? <WorklistSkeleton /> : null}{!isLoading && data?.pendingReview.map((transaction) => <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" key={transaction.id}><div><div className="flex items-center gap-2"><p className="font-semibold text-[#2b3e5c]">{transaction.transactionNumber}</p><Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">PERLU REVIEW</Badge></div><p className="mt-1 text-xs text-[#728198]">{transaction.operation} · Rp {String(transaction.rupiahAmount)} · {transaction.reviewReason ?? "Memerlukan pemeriksaan"}</p></div><button onClick={() => goTo("/operasional/monitoring")} className="press-scale inline-flex w-fit items-center gap-2 rounded-xl border border-[#cbd6ed] bg-white px-3 py-2 text-xs font-bold text-[#405dbc] hover:bg-[#f2f5ff]">Tinjau <ArrowRight className="size-3.5" /></button></div>)}{!isLoading && approved.map(({ transaction, customer, currency }) => <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" key={transaction.id}><div><div className="flex items-center gap-2"><p className="font-semibold text-[#2b3e5c]">{transaction.transactionNumber}</p><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">SIAP SELESAI</Badge></div><p className="mt-1 text-xs text-[#728198]">{customer.fullName} · {transaction.operation} {String(transaction.foreignAmount)} {currency.code}</p></div><Button size="sm" disabled={complete.isPending} onClick={() => complete.mutate({ transactionId: transaction.id })} className="press-scale w-fit bg-[#2d4774] text-white hover:bg-[#22395e]"><CheckCircle2 className="mr-1.5 size-4" />Catat selesai</Button></div>)}{!isLoading && !data?.pendingReview.length && !approved.length ? <div className="px-5 py-14 text-center"><span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-[#eef6ed] text-[#5e9c59]"><CheckCircle2 className="size-5" /></span><p className="mt-4 font-semibold text-[#3a4d69]">Tidak ada antrian yang perlu ditindaklanjuti.</p><p className="mt-1 text-sm text-[#78869b]">Transaksi yang membutuhkan review atau penyelesaian akan muncul di sini.</p></div> : null}</div>
      </article>

      <div className="grid gap-6"><article className="rounded-[1.25rem] border border-[#dce2ec] bg-white p-5 shadow-[0_10px_32px_rgba(30,50,87,0.05)]"><div className="flex items-center justify-between"><div><p className="text-[11px] font-bold tracking-[0.14em] text-[#6f819c] uppercase">Kesiapan outlet</p><h2 className="mt-1 font-display text-lg text-[#293b58]">Kontrol utama</h2></div><button onClick={() => goTo("/operasional/stock")} className="text-xs font-bold text-[#5570cf] hover:text-[#304eae]">Kelola</button></div><div className="mt-5 space-y-3"><ControlStatus label="Saldo kas" detail={data?.cashBalances.length ? `${data.cashBalances.length} mata uang tercatat.` : "Belum ada saldo kas tercatat."} ok={Boolean(data?.cashBalances.length)} /><ControlStatus label="Stock opname" detail={data?.variances.length ? `${data.variances.length} variance perlu rekonsiliasi.` : "Tidak ada variance aktif."} ok={!data?.variances.length} /><ControlStatus label="Review transaksi" detail={data?.pendingReview.length ? `${data.pendingReview.length} transaksi perlu keputusan.` : "Tidak ada transaksi tertunda."} ok={!data?.pendingReview.length} /></div></article><article className="rounded-[1.25rem] border border-[#dce2ec] bg-white p-5 shadow-[0_10px_32px_rgba(30,50,87,0.05)]"><p className="text-[11px] font-bold tracking-[0.14em] text-[#6f819c] uppercase">Saldo kas tercatat</p><div className="mt-4 space-y-2">{data?.cashBalances.length ? data.cashBalances.slice(0, 5).map(({ balance, currency }) => <div className="flex items-center justify-between rounded-xl bg-[#f7f9fc] px-3 py-2.5 text-sm" key={balance.id}><span className="font-semibold text-[#344965]">{currency.code}</span><span className="table-number text-[#607087]">{String(balance.availableAmount)}</span></div>) : <p className="rounded-xl bg-[#f7f9fc] px-3 py-4 text-sm text-[#76859a]">Belum ada saldo kas yang tercatat.</p>}</div></article></div>
    </section>
  </div>;
}

function MetricCard({ label, value, note, icon: Icon, tone }: { label: string; value: string; note: string; icon: typeof ClipboardList; tone: string }) {
  return <article className="interactive-lift rounded-[1.25rem] border border-[#dce2ec] bg-white p-5 shadow-[0_10px_32px_rgba(30,50,87,0.045)]"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-[#66758b]">{label}</p><span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></span></div><p className="mt-7 font-display text-3xl tracking-tight text-[#2b3d5b]">{value}</p><p className="mt-2 text-xs leading-5 text-[#8190a4]">{note}</p></article>;
}

function QuickAction({ icon: Icon, label, detail, action, onClick }: { icon: typeof ClipboardList; label: string; detail: string; action: string; onClick: () => void }) {
  return <article className="interactive-lift rounded-[1.25rem] border border-[#dce2ec] bg-white p-5 shadow-[0_10px_32px_rgba(30,50,87,0.045)]"><span className="flex size-10 items-center justify-center rounded-xl bg-[#eff3ff] text-[#5b75cf]"><Icon className="size-5" /></span><h2 className="mt-5 font-display text-lg text-[#2d405f]">{label}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-[#6f7e94]">{detail}</p><button onClick={onClick} className="press-scale mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#4a65c0] hover:text-[#2948a3]">{action}<ArrowRight className="size-4" /></button></article>;
}

function ShareholderUserManagement({ adminCount, staffCount, suspendedCount, isLoading }: { adminCount: number; staffCount: number; suspendedCount: number; isLoading: boolean }) {
  return <section aria-label="Manajemen pengguna" className="mt-6 overflow-hidden rounded-[1.25rem] border border-[#d7e5d0] bg-white shadow-[0_10px_32px_rgba(30,50,87,0.05)]"><div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1.2fr_0.8fr]"><div><div className="flex size-10 items-center justify-center rounded-xl bg-[#e8f5e4] text-[#4f914c]"><UsersRound className="size-5" /></div><p className="mt-5 text-[11px] font-bold tracking-[0.14em] text-[#5e8f57] uppercase">Khusus Shareholder</p><h2 className="mt-2 font-display text-2xl text-[#293b58]">Manajemen pengguna</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">Buat akun Admin atau Staff, lalu kelola peran, status akses, dan reset sandi dari satu tempat. Akun baru wajib mengganti sandi pada login pertama.</p><div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => goTo("/operasional/pengguna?role=ADMIN")} className="press-scale bg-[#183f70] text-white hover:bg-[#102f58]"><UserPlus className="mr-2 size-4" />Buat akun Admin</Button><Button variant="outline" onClick={() => goTo("/operasional/pengguna?role=STAFF")} className="press-scale border-[#bcd7b8] bg-[#f7fcf5] text-[#3d7139] hover:bg-[#ecf8e8] hover:text-[#2f5e2c]"><UserPlus className="mr-2 size-4" />Buat akun Staff</Button><button onClick={() => goTo("/operasional/pengguna")} className="press-scale inline-flex items-center gap-2 rounded-xl px-3 text-sm font-extrabold text-[#4a65c0] hover:bg-[#f3f6ff] hover:text-[#2948a3]">Kelola seluruh akun<ArrowRight className="size-4" /></button></div></div><div className="grid grid-cols-3 gap-3 self-end"><TeamMetric label="Admin" value={adminCount} isLoading={isLoading} tone="bg-[#eef2ff] text-[#4f6bc4]" /><TeamMetric label="Staff" value={staffCount} isLoading={isLoading} tone="bg-[#eaf7e8] text-[#4f914c]" /><TeamMetric label="Nonaktif" value={suspendedCount} isLoading={isLoading} tone="bg-[#fff4e3] text-[#b47720]" /></div></div></section>;
}

function TeamMetric({ label, value, isLoading, tone }: { label: string; value: number; isLoading: boolean; tone: string }) {
  return <div className={`rounded-2xl p-4 ${tone}`}><p className="text-xs font-semibold opacity-80">{label}</p><p className="mt-4 font-display text-3xl tracking-tight">{isLoading ? "—" : value}</p></div>;
}

function ControlStatus({ label, detail, ok }: { label: string; detail: string; ok: boolean }) {
  return <div className={ok ? "rounded-xl border border-emerald-100 bg-emerald-50/55 p-3" : "rounded-xl border border-amber-100 bg-amber-50/65 p-3"}><div className="flex items-start gap-3"><span className={ok ? "mt-0.5 text-emerald-600" : "mt-0.5 text-amber-600"}>{ok ? <CheckCircle2 className="size-4" /> : <CircleAlert className="size-4" />}</span><div><p className="text-sm font-semibold text-[#3c506c]">{label}</p><p className="mt-1 text-xs leading-5 text-[#718198]">{detail}</p></div></div></div>;
}

function WorklistSkeleton() {
  return <div className="space-y-3 p-5"><div className="h-14 animate-pulse rounded-xl bg-[#f1f4f8]" /><div className="h-14 animate-pulse rounded-xl bg-[#f1f4f8]" /></div>;
}
