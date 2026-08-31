import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, CircleAlert, LockKeyhole, PlayCircle, Printer, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const openingItems = [
  { key: "modalKerjaDiterima", title: "Modal kerja diterima", detail: "Pastikan modal Rupiah dan valuta diterima sesuai plafon harian." },
  { key: "alatUvSiap", title: "Lampu UV siap dipakai", detail: "Nyalakan dan periksa alat pendeteksi uang palsu sebelum melayani." },
  { key: "mesinHitungSiap", title: "Mesin hitung siap dipakai", detail: "Pastikan mesin hitung uang dapat digunakan dengan baik." },
  { key: "kasAwalDicatat", title: "Kas awal sudah dicatat", detail: "Masukkan kas pembukaan per mata uang pada halaman Kas & Persediaan." },
] as const;

const closingItems = [
  { key: "opnameFisikDilakukan", title: "Opname fisik dilakukan", detail: "Hitung sisa kas secara fisik setelah layanan selesai." },
  { key: "kasDirekonsiliasi", title: "Kas direkonsiliasi", detail: "Kirim stock opname agar sistem membandingkan fisik dan catatan kas." },
  { key: "uangDiserahterimakan", title: "Uang diserahterimakan", detail: "Serahkan seluruh Rupiah dan valuta sesuai prosedur kepada Direksi/Komisaris." },
  { key: "brankasDikunci", title: "Brankas dikunci", detail: "Pastikan uang telah disimpan dan brankas terkunci sebelum outlet ditutup." },
] as const;

function goTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function asChecks(value: unknown) {
  return typeof value === "object" && value !== null ? value as Record<string, boolean> : {};
}

function formatBusinessDate(value?: Date | string) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(value ? new Date(value) : new Date());
}

function escapeHtml(value: unknown) {
  return String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

export default function DailyChecklist() {
  const utils = trpc.useUtils();
  const { data: checklist, isLoading } = trpc.dailyChecklist.today.useQuery();
  const { data: stockRows } = trpc.stockOpname.list.useQuery();
  const [openingChecks, setOpeningChecks] = useState<Record<string, boolean>>({});
  const [closingChecks, setClosingChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!checklist) return;
    setOpeningChecks(asChecks(checklist.openingChecks));
    setClosingChecks(asChecks(checklist.closingChecks));
    setNotes(checklist.notes ?? "");
  }, [checklist]);

  const openingComplete = useMemo(() => openingItems.every((item) => openingChecks[item.key]), [openingChecks]);
  const closingComplete = useMemo(() => closingItems.every((item) => closingChecks[item.key]), [closingChecks]);
  const update = trpc.dailyChecklist.update.useMutation({
    onSuccess: (_, variables) => {
      toast.success(variables.phase === "OPENING" ? "Checklist pembukaan disimpan." : "Checklist penutupan disimpan.");
      utils.dailyChecklist.today.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const save = (phase: "OPENING" | "CLOSING") => update.mutate({ phase, checks: phase === "OPENING" ? openingChecks : closingChecks, notes: notes || undefined });
  const printClosingArchive = () => {
    if (!checklist?.closingCompletedAt || !closingComplete) return toast.error("Selesaikan dan simpan checklist penutupan sebelum mengekspor arsip.");
    const businessDate = new Date(checklist.businessDate).toDateString();
    const todayOpnames = stockRows?.filter(({ opname }) => new Date(opname.opnameDate).toDateString() === businessDate) ?? [];
    const closingRows = closingItems.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${closingChecks[item.key] ? "SELESAI" : "BELUM"}</td></tr>`).join("");
    const opnameRows = todayOpnames.length ? todayOpnames.map(({ opname, currency }) => `<tr><td>${escapeHtml(currency.code)}</td><td>${escapeHtml(opname.closingSystemBalance)}</td><td>${escapeHtml(opname.physicalBalance)}</td><td>${escapeHtml(opname.variance)}</td><td>${escapeHtml(opname.reconciliationStatus)}</td></tr>`).join("") : `<tr><td colspan=5>Tidak ada stock opname pada tanggal ini.</td></tr>`;
    const win = window.open("", "_blank");
    if (!win) return toast.error("Izinkan pop-up browser untuk menyimpan PDF atau mencetak ringkasan penutupan.");
    win.document.write(`<!doctype html><title>Penutupan outlet ${escapeHtml(formatBusinessDate(checklist.businessDate))}</title><style>body{font-family:Arial;color:#18395f;margin:34px;line-height:1.4}h1{margin:0 0 6px;font-size:22px}h2{margin:24px 0 8px;font-size:16px}p{font-size:12px}table{border-collapse:collapse;width:100%;margin-top:10px}td,th{border:1px solid #94a7b8;padding:8px;font-size:12px;text-align:left}.archive{margin:12px 0;padding:8px;border:1px dashed #55748e;font-size:10px;letter-spacing:.07em}.sign{display:flex;justify-content:space-between;margin:60px 60px 0;text-align:center;font-size:12px}</style><h1>PT IBU KOTA VALASINDO</h1><p>Jl. Mangun Sarkoro No 35, Cianjur, Jawa Barat 43214</p><div class=archive>ARSIP RINGKASAN PENUTUPAN OUTLET · ${escapeHtml(formatBusinessDate(checklist.businessDate))} · CETAK / SIMPAN PDF ${escapeHtml(new Date().toLocaleString("id-ID"))}</div><h2>Checklist penutupan</h2><table><tr><th>Langkah</th><th>Status</th></tr>${closingRows}</table><h2>Stock opname & rekonsiliasi</h2><table><tr><th>Valuta</th><th>Saldo sistem</th><th>Fisik</th><th>Varians</th><th>Status</th></tr>${opnameRows}</table><h2>Catatan operasional</h2><p>${escapeHtml(checklist.notes || "Tidak ada catatan.")}</p><div class=sign><span>Petugas penutupan<br><br><br>__________________</span><span>Supervisor / Direksi mengetahui<br><br><br>__________________</span></div><script>window.print()</script>`);
    win.document.close();
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="overflow-hidden rounded-[1.5rem] bg-[#192a48] p-6 text-white shadow-[0_18px_45px_rgba(23,40,71,0.16)] sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold tracking-[0.16em] text-[#d7ec75] uppercase">Urutan kerja outlet</p><h1 className="mt-2 font-display text-3xl tracking-tight">Buka dengan siap, tutup dengan cocok.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#d3deef]">{formatBusinessDate(checklist?.businessDate)}. Selesaikan setiap langkah secara berurutan agar kas, transaksi, dan serah-terima harian dapat ditelusuri.</p></div><Badge className={openingComplete && closingComplete ? "w-fit bg-emerald-400 text-emerald-950 hover:bg-emerald-400" : "w-fit bg-white/10 text-white hover:bg-white/10"}>{openingComplete && closingComplete ? "HARIAN LENGKAP" : "ADA LANGKAH TERSISA"}</Badge></div>
    </section>

    {isLoading ? <div className="grid gap-5 lg:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-[#edf1f7]" /><div className="h-80 animate-pulse rounded-2xl bg-[#edf1f7]" /></div> : <div className="grid gap-6 lg:grid-cols-2">
      <ChecklistCard phase="OPENING" title="Sebelum outlet buka" description="Lakukan di awal hari, sebelum transaksi pertama." items={openingItems} checks={openingChecks} setChecks={setOpeningChecks} complete={openingComplete} disabled={update.isPending} onSave={() => save("OPENING")} action={{ label: "Catat kas pembukaan", onClick: () => goTo("/operasional/stock") }} />
      <ChecklistCard phase="CLOSING" title="Sebelum outlet tutup" description={openingComplete ? "Lakukan setelah layanan dan transaksi hari ini selesai." : "Selesaikan checklist pembukaan terlebih dahulu."} items={closingItems} checks={closingChecks} setChecks={setClosingChecks} complete={closingComplete} disabled={update.isPending || !openingComplete} onSave={() => save("CLOSING")} action={{ label: "Buka stock opname", onClick: () => goTo("/operasional/stock") }} secondaryAction={{ label: "Arsip PDF penutupan", onClick: printClosingArchive, disabled: !closingComplete || !checklist?.closingCompletedAt }} />
    </div>}

    <Card className="border-[#dce6f0]"><CardHeader><CardTitle className="font-display text-xl text-[#18395f]">Catatan operasional hari ini</CardTitle><CardDescription>Gunakan untuk keterangan singkat yang perlu dibaca saat rekonsiliasi atau serah-terima. Jangan menuliskan nomor identitas nasabah di sini.</CardDescription></CardHeader><CardContent><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: mesin hitung diganti pukul 10.00 WIB; disaksikan Supervisor." className="min-h-24" /><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={update.isPending} onClick={() => save(openingComplete ? "CLOSING" : "OPENING")}>Simpan catatan</Button><p className="self-center text-xs text-[#718397]">Catatan ikut tersimpan pada checklist tahap yang sedang dikerjakan.</p></div></CardContent></Card>
  </div>;
}

function ChecklistCard({ phase, title, description, items, checks, setChecks, complete, disabled, onSave, action, secondaryAction }: { phase: "OPENING" | "CLOSING"; title: string; description: string; items: readonly { key: string; title: string; detail: string }[]; checks: Record<string, boolean>; setChecks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; complete: boolean; disabled: boolean; onSave: () => void; action: { label: string; onClick: () => void }; secondaryAction?: { label: string; onClick: () => void; disabled: boolean } }) {
  const Icon = phase === "OPENING" ? PlayCircle : LockKeyhole;
  return <Card className={complete ? "border-emerald-200 bg-emerald-50/30" : "border-[#dce6f0]"}><CardHeader><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-xl bg-[#edf4ff] text-[#335f9a]"><Icon className="size-4" /></span><CardTitle className="font-display text-xl text-[#18395f]">{title}</CardTitle></div><CardDescription className="mt-3">{description}</CardDescription></div>{complete ? <Badge className="status-approved">LENGKAP</Badge> : <Badge className="status-pending">BELUM LENGKAP</Badge>}</div></CardHeader><CardContent><div className="space-y-2">{items.map((item) => <label key={item.key} className={disabled ? "flex gap-3 rounded-xl border border-[#e7edf4] bg-[#f7f9fc] p-3 opacity-60" : "flex cursor-pointer gap-3 rounded-xl border border-[#e0e8f1] bg-white p-3 transition-colors hover:border-[#bad0e5]"}><input type="checkbox" className="mt-0.5 size-4 accent-[#3e9365]" checked={Boolean(checks[item.key])} disabled={disabled} onChange={(event) => setChecks((current) => ({ ...current, [item.key]: event.target.checked }))} /><span><span className="block text-sm font-semibold text-[#294665]">{item.title}</span><span className="mt-1 block text-xs leading-5 text-[#6b7d92]">{item.detail}</span></span></label>)}</div>{phase === "OPENING" ? <div className="mt-4 rounded-xl bg-[#f4f8fd] p-3"><WalletCards className="mr-2 inline size-4 text-[#446a9e]" /><span className="text-xs text-[#5c7188]">Kas pembukaan dicatat terpisah per mata uang agar saldo awal dan mutasi tetap dapat ditelusuri.</span></div> : <div className="mt-4 rounded-xl bg-[#fff8eb] p-3"><CircleAlert className="mr-2 inline size-4 text-[#ae7626]" /><span className="text-xs text-[#80622a]">Varians hasil hitung fisik perlu ditinjau Supervisor dan akan masuk pengawasan Direksi.</span></div>}<div className="mt-5 flex flex-col gap-2 sm:flex-row"><Button className="press-scale bg-[#183f70] text-white hover:bg-[#12345d]" disabled={disabled} onClick={onSave}><CheckCircle2 className="mr-2 size-4" />Simpan {phase === "OPENING" ? "pembukaan" : "penutupan"}</Button><Button variant="outline" onClick={action.onClick}>{action.label}</Button>{secondaryAction ? <Button variant="outline" disabled={secondaryAction.disabled} onClick={secondaryAction.onClick}><Printer className="mr-2 size-4" />{secondaryAction.label}</Button> : null}</div></CardContent></Card>;
}
