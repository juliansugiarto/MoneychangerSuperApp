import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@shared/chartOfAccounts";
import { BookOpen, CalendarCheck, CheckCircle2, FileText, Lock, LockOpen, Plus, RefreshCw, Scale, ShieldAlert, Trash2, Undo2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Buku besar — jawaban atas temuan pemeriksaan BI butir 7.1.
 *
 * Yang harus dapat ditunjukkan kepada pemeriksa bukan sekadar angka laporan, melainkan jalannya:
 * pos laporan → akun → jurnal → rujukan sumbernya. Karena itu keempat tab di halaman ini adalah
 * satu alur yang sama dibaca dari arah berbeda, bukan empat fitur terpisah.
 */

const SIDE_LABELS: Record<string, string> = { DEBIT: "Debit", KREDIT: "Kredit" };

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SALDO_AWAL: "Saldo awal",
  TRANSAKSI_VALUTA: "Transaksi valuta",
  PENGELUARAN: "Pengeluaran",
  MUTASI_KAS: "Mutasi kas",
  MUTASI_BANK: "Mutasi bank",
  PENYUSUTAN: "Penyusutan",
  REVALUASI_KURS: "Revaluasi kurs",
  TUTUP_PERIODE: "Tutup periode",
};

/** Nominal buku besar selalu Rupiah dua desimal; ditampilkan bergaya Indonesia, tanpa simbol. */
const formatRupiah = (value: string | null | undefined) => {
  if (value === null || value === undefined) return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Nol ditampilkan sebagai garis agar mata langsung menemukan baris yang benar-benar bergerak. */
const orDash = (value: string) => (Number(value) === 0 ? "—" : formatRupiah(value));

const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";

const currentMonthRange = () => {
  const today = new Date();
  const iso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
};

type LineDraft = { accountCode: string; side: "DEBIT" | "KREDIT"; amount: string; memo: string };

type SkippedItem = { reference: string; reason: string };
type PostingSummary = {
  postedCount: number;
  alreadyPostedCount: number;
  skippedCount: number;
  transactions: { skipped: SkippedItem[] };
  expenses: { skipped: SkippedItem[] };
};

const emptyLine = (): LineDraft => ({ accountCode: "", side: "DEBIT", amount: "", memo: "" });

export default function BukuBesar() {
  const utils = trpc.useUtils();
  const [range, setRange] = useState(currentMonthRange);
  const [entryForm, setEntryForm] = useState({ entryDate: new Date().toISOString().slice(0, 10), description: "" });
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), { ...emptyLine(), side: "KREDIT" }]);
  const [ledgerAccount, setLedgerAccount] = useState("");
  const [reversalReason, setReversalReason] = useState<Record<number, string>>({});
  const [postingResult, setPostingResult] = useState<PostingSummary | null>(null);

  const accounts = trpc.ledger.accounts.useQuery();
  const periods = trpc.ledger.periods.useQuery();
  /** Penilaian dimuat hanya untuk periode yang sedang dibuka; satu kueri per baris akan memuat seluruh tabel sekaligus. */
  const [inspectedPeriodId, setInspectedPeriodId] = useState<number | null>(null);
  const entries = trpc.ledger.entries.useQuery({ from: range.from, to: range.to });
  const trialBalance = trpc.ledger.trialBalance.useQuery({ from: range.from, to: range.to });
  const integrity = trpc.ledger.integrity.useQuery({ from: range.from, to: range.to });
  const statements = trpc.ledger.statements.useQuery({ from: range.from, to: range.to });
  const cashReconciliation = trpc.ledger.cashReconciliation.useQuery({ asOf: range.to });
  const accountLedger = trpc.ledger.accountLedger.useQuery(
    { accountCode: ledgerAccount, from: range.from, to: range.to },
    { enabled: Boolean(ledgerAccount) },
  );

  const refresh = () => {
    utils.ledger.entries.invalidate();
    utils.ledger.trialBalance.invalidate();
    utils.ledger.integrity.invalidate();
    utils.ledger.accountLedger.invalidate();
    utils.ledger.periods.invalidate();
    utils.ledger.statements.invalidate();
    utils.ledger.cashReconciliation.invalidate();
    utils.ledger.closingValuation.invalidate();
    utils.ledger.monthlyDepreciation.invalidate();
    utils.ledger.currencyRevaluation.invalidate();
  };

  const seedAccounts = trpc.ledger.seedAccounts.useMutation({
    onSuccess: (result) => {
      toast.success(`Bagan akun siap: ${result.total} akun (${result.inserted} baru, ${result.updated} diperbarui).`);
      utils.ledger.accounts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const postEntry = trpc.ledger.post.useMutation({
    onSuccess: (entry) => {
      toast.success(`Jurnal ${entry.entryNumber} tersimpan.`);
      refresh();
      setEntryForm({ ...entryForm, description: "" });
      setLines([emptyLine(), { ...emptyLine(), side: "KREDIT" }]);
    },
    onError: (error) => toast.error(error.message),
  });
  const reverseEntry = trpc.ledger.reverse.useMutation({
    onSuccess: (entry) => { toast.success(`Jurnal balik ${entry.entryNumber} tersimpan.`); refresh(); setReversalReason({}); },
    onError: (error) => toast.error(error.message),
  });
  const postOperations = trpc.ledger.postOperations.useMutation({
    onSuccess: (result) => {
      setPostingResult(result);
      toast.success(`${result.postedCount} jurnal dibuat, ${result.alreadyPostedCount} sudah pernah dijurnal.`);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const closePeriod = trpc.ledger.closePeriod.useMutation({
    onSuccess: () => { toast.success("Periode ditutup."); refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const reopenPeriod = trpc.ledger.reopenPeriod.useMutation({
    onSuccess: () => { toast.success("Periode dibuka kembali."); refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const postClosingValuation = trpc.ledger.postClosingValuation.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.entryNumber
          ? `Penilaian tersimpan dan dijurnal sebagai ${result.entryNumber}.`
          : "Penilaian tersimpan; tidak ada persediaan UKA untuk dijurnal.",
      );
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const postMonthlyDepreciation = trpc.ledger.postMonthlyDepreciation.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.entryNumber
          ? `Penyusutan dijurnal sebagai ${result.entryNumber}.`
          : "Bulan ini ditandai sudah disusutkan; tidak ada aset tersusutkan untuk dijurnal.",
      );
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const postCurrencyRevaluation = trpc.ledger.postCurrencyRevaluation.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.entryNumber
          ? `Revaluasi kurs dijurnal sebagai ${result.entryNumber}.`
          : "Bulan ini ditandai sudah direvaluasi; tidak ada selisih kurs untuk dijurnal.",
      );
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const postYearEndClosing = trpc.ledger.postYearEndClosing.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.entryNumber ? `Penutup laba dijurnal sebagai ${result.entryNumber}.` : "Tidak ada saldo laba rugi untuk ditutup.",
      );
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const accountOptions = useMemo(
    () => Object.fromEntries((accounts.data ?? []).map((row) => [row.code, `${row.code} — ${row.name}`])),
    [accounts.data],
  );

  /**
   * Selisih debit dan kredit ditampilkan sebelum jurnal dikirim. Server tetap menolak jurnal yang
   * tidak seimbang; ini hanya supaya penggunanya tahu di baris mana angkanya belum ketemu, bukan
   * setelah tombolnya ditekan.
   */
  const draftBalance = useMemo(() => {
    const sum = (side: "DEBIT" | "KREDIT") =>
      lines.filter((line) => line.side === side).reduce((total, line) => total + (Number(line.amount) || 0), 0);
    const debit = sum("DEBIT");
    const credit = sum("KREDIT");
    return { debit, credit, difference: debit - credit, balanced: debit === credit && debit > 0 };
  }, [lines]);

  const openPeriods = (periods.data ?? []).filter((row) => row.status === "TERBUKA").length;

  const submitEntry = () => {
    if (!entryForm.entryDate) return toast.error("Tanggal jurnal wajib diisi.");
    if (!entryForm.description.trim()) return toast.error("Uraian jurnal wajib diisi.");
    const filled = lines.filter((line) => line.accountCode && line.amount);
    if (filled.length < 2) return toast.error("Jurnal harus memiliki minimal dua baris terisi.");
    postEntry.mutate({
      entryDate: entryForm.entryDate,
      description: entryForm.description,
      lines: filled.map((line) => ({
        accountCode: line.accountCode,
        side: line.side,
        amount: line.amount,
        memo: line.memo || undefined,
      })),
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <p className="max-w-3xl text-sm leading-6 text-[#475569]">
        Buku besar berpasangan: setiap pos laporan keuangan dapat ditelusuri ke akunnya, tiap akun ke jurnalnya,
        dan tiap jurnal ke rujukan sumbernya. Jurnal tidak pernah diubah maupun dihapus — koreksi dicatat
        sebagai jurnal balik, sehingga kekeliruan dan perbaikannya sama-sama terbaca.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={<BookOpen className="size-5" />} label="Jurnal pada periode" value={trialBalance.data?.entryCount ?? 0} loading={trialBalance.isLoading} />
        <SummaryTile
          icon={<Scale className="size-5" />}
          label="Neraca saldo"
          text={trialBalance.data ? (trialBalance.data.balanced ? "Seimbang" : `Selisih ${formatRupiah(trialBalance.data.difference)}`) : "—"}
          tone={trialBalance.data && !trialBalance.data.balanced ? "warn" : "ok"}
          loading={trialBalance.isLoading}
        />
        <SummaryTile
          icon={<ShieldAlert className="size-5" />}
          label="Jurnal tidak utuh"
          value={integrity.data?.problems.length ?? 0}
          tone={integrity.data?.problems.length ? "warn" : "ok"}
          loading={integrity.isLoading}
        />
        <SummaryTile icon={<CalendarCheck className="size-5" />} label="Periode terbuka" value={openPeriods} loading={periods.isLoading} />
      </div>

      {accounts.data && accounts.data.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="font-display text-lg text-[#18395f]">Bagan akun belum tersedia</CardTitle>
            <CardDescription>
              Bagan akun berisi 42 akun yang masing-masing terpetakan ke satu baris form B0002, B0003, atau B0004.
              Tanpa itu, jurnal tidak dapat dicatat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => seedAccounts.mutate()} disabled={seedAccounts.isPending} className="bg-[#183f70] text-white hover:bg-[#12345d]">
              Siapkan bagan akun
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-[#dce6f0]">
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div>
            <Label className="text-xs">Periode dari</Label>
            <Input type="date" className="mt-1" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} />
          </div>
          <div>
            <Label className="text-xs">sampai</Label>
            <Input type="date" className="mt-1" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} />
          </div>
          <p className="pb-2 text-xs text-[#718398]">
            Saldo akhir dihitung kumulatif — mutasi periode ini ditambahkan ke saldo sebelumnya.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="jurnal">
        <TabsList className="h-auto w-full flex-wrap gap-1.5 rounded-2xl border-2 border-[#183f70]/15 bg-[#eef3f9] p-1.5">
          <TabsTrigger value="jurnal" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><BookOpen className="mr-1.5 size-4" />Jurnal</TabsTrigger>
          <TabsTrigger value="neraca" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><Scale className="mr-1.5 size-4" />Neraca Saldo</TabsTrigger>
          <TabsTrigger value="akun" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><BookOpen className="mr-1.5 size-4" />Buku Besar Akun</TabsTrigger>
          <TabsTrigger value="laporan" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><FileText className="mr-1.5 size-4" />Laporan Keuangan</TabsTrigger>
          <TabsTrigger value="periode" className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#18395f] data-[state=active]:bg-[#183f70] data-[state=active]:text-white"><CalendarCheck className="mr-1.5 size-4" />Periode</TabsTrigger>
        </TabsList>

        {/* -------------------------------- Jurnal -------------------------------- */}
        <TabsContent value="jurnal" className="mt-5 space-y-4">
          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Catat jurnal</CardTitle>
              <CardDescription>
                Jumlah debit harus sama dengan jumlah kredit. Jurnal yang sudah tersimpan tidak dapat diubah —
                koreksinya dicatat sebagai jurnal balik.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <div>
                  <Label className="text-xs">Tanggal jurnal *</Label>
                  <Input type="date" className="mt-1" value={entryForm.entryDate} onChange={(event) => setEntryForm({ ...entryForm, entryDate: event.target.value })} />
                </div>
                <div className="lg:col-span-2">
                  <Label className="text-xs">Uraian *</Label>
                  <Input autoComplete="off" className="mt-1" placeholder="Mis. Bayar sewa kantor September 2026" value={entryForm.description} onChange={(event) => setEntryForm({ ...entryForm, description: event.target.value })} />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-[#e6edf5] bg-[#fafcff] p-4">
                {lines.map((line, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]">
                    <div>
                      {index === 0 ? <Label className="text-xs">Akun</Label> : null}
                      <Select value={line.accountCode} onValueChange={(value) => setLines(lines.map((row, position) => (position === index ? { ...row, accountCode: value } : row)))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih akun" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(accountOptions).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      {index === 0 ? <Label className="text-xs">Sisi</Label> : null}
                      <Select value={line.side} onValueChange={(value) => setLines(lines.map((row, position) => (position === index ? { ...row, side: value as LineDraft["side"] } : row)))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DEBIT">Debit</SelectItem>
                          <SelectItem value="KREDIT">Kredit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      {index === 0 ? <Label className="text-xs">Nominal (Rp)</Label> : null}
                      <Input autoComplete="off" inputMode="decimal" className="mt-1 text-right tabular-nums" placeholder="0.00" value={line.amount} onChange={(event) => setLines(lines.map((row, position) => (position === index ? { ...row, amount: event.target.value } : row)))} />
                    </div>
                    <div>
                      {index === 0 ? <Label className="text-xs">Keterangan baris</Label> : null}
                      <Input autoComplete="off" className="mt-1" value={line.memo} onChange={(event) => setLines(lines.map((row, position) => (position === index ? { ...row, memo: event.target.value } : row)))} />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="icon" aria-label={`Hapus baris ${index + 1}`} disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, position) => position !== index))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <Button type="button" variant="outline" onClick={() => setLines([...lines, emptyLine()])}><Plus className="mr-2 size-4" />Tambah baris</Button>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-[#64768d]">Debit <strong className="tabular-nums text-[#18395f]">{formatRupiah(String(draftBalance.debit))}</strong></span>
                    <span className="text-[#64768d]">Kredit <strong className="tabular-nums text-[#18395f]">{formatRupiah(String(draftBalance.credit))}</strong></span>
                    {draftBalance.balanced ? (
                      <Badge className="bg-[#eef6ed] text-[#4d8548] hover:bg-[#eef6ed]"><CheckCircle2 className="mr-1 size-3" />Seimbang</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Selisih {formatRupiah(String(Math.abs(draftBalance.difference)))}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <Button onClick={submitEntry} disabled={postEntry.isPending} className="bg-[#183f70] text-white hover:bg-[#12345d]">
                <BookOpen className="mr-2 size-4" />Simpan jurnal
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[#dce6f0]">
            <CardHeader><CardTitle className="font-display text-xl text-[#18395f]">Daftar jurnal</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {entries.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat jurnal…</p> : null}
              {!entries.isLoading && !entries.data?.length ? <EmptyNote text="Belum ada jurnal pada periode ini." /> : null}
              {entries.data?.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-[#e6edf5] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#213f63]">
                        {entry.entryNumber}
                        <span className="ml-2 font-normal text-[#8194aa]">{formatDate(entry.entryDate)}</span>
                      </p>
                      <p className="text-sm text-[#475569]">{entry.description}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="outline">{SOURCE_LABELS[entry.sourceType] ?? entry.sourceType}</Badge>
                        {entry.sourceReference ? <Badge variant="outline">{entry.sourceReference}</Badge> : null}
                        {entry.reversesEntryId ? <Badge className="bg-[#eef3fb] text-[#405dbc] hover:bg-[#eef3fb]"><Undo2 className="mr-1 size-3" />Jurnal balik</Badge> : null}
                      </div>
                    </div>
                    <p className="tabular-nums text-sm font-semibold text-[#18395f]">Rp {formatRupiah(entry.totalDebit)}</p>
                  </div>

                  <table className="mt-3 w-full text-left text-sm">
                    <tbody>
                      {entry.lines.map((line) => (
                        <tr key={line.id} className="border-t border-[#eef2f7]">
                          <td className="py-1.5 pr-3 text-[#475569]">{line.accountCode}<span className="ml-2 text-[#8194aa]">{accountOptions[line.accountCode]?.split(" — ")[1] ?? ""}</span></td>
                          <td className="py-1.5 pr-3 text-[#718398]">{line.memo}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-[#475569]">{line.side === "DEBIT" ? formatRupiah(line.amount) : ""}</td>
                          <td className="py-1.5 text-right tabular-nums text-[#475569]">{line.side === "KREDIT" ? formatRupiah(line.amount) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {entry.reversesEntryId ? null : (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="min-w-60 flex-1">
                        <Label className="text-xs">Alasan koreksi</Label>
                        <Input autoComplete="off" className="mt-1" placeholder="Sebutkan alasan sebelum membalik jurnal ini" value={reversalReason[entry.id] ?? ""} onChange={(event) => setReversalReason({ ...reversalReason, [entry.id]: event.target.value })} />
                      </div>
                      <Button
                        variant="outline"
                        disabled={reverseEntry.isPending || (reversalReason[entry.id] ?? "").trim().length < 5}
                        onClick={() => reverseEntry.mutate({ entryId: entry.id, reason: reversalReason[entry.id] ?? "" })}
                      >
                        <Undo2 className="mr-2 size-4" />Balik jurnal
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Jurnal otomatis dari operasi</CardTitle>
              <CardDescription>
                Menjurnal bon valuta yang sudah selesai dan pengeluaran pada periode di atas, tanpa entri ulang.
                Aman dijalankan berkali-kali: sumber yang sudah pernah dijurnal dilewati, bukan dijurnal ulang.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => postOperations.mutate({ from: range.from, to: range.to })}
                disabled={postOperations.isPending}
                className="bg-[#183f70] text-white hover:bg-[#12345d]"
              >
                <RefreshCw className="mr-2 size-4" />Jurnalkan {formatDate(range.from)} — {formatDate(range.to)}
              </Button>

              {postingResult ? (
                <div className="rounded-xl border border-[#e6edf5] bg-[#fafcff] p-4 text-sm">
                  <p className="text-[#475569]">
                    <strong className="text-[#18395f]">{postingResult.postedCount}</strong> jurnal baru ·{" "}
                    <strong className="text-[#18395f]">{postingResult.alreadyPostedCount}</strong> sudah pernah dijurnal ·{" "}
                    <strong className="text-[#18395f]">{postingResult.skippedCount}</strong> dilewati
                  </p>
                  {postingResult.skippedCount ? (
                    <ul className="mt-2 space-y-1 text-xs text-amber-800">
                      {[...postingResult.transactions.skipped, ...postingResult.expenses.skipped].map((item) => (
                        <li key={item.reference}>{item.reference} — {item.reason}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <p>
                  <strong>Kas awal dan mutasi kas belum ikut dijurnal.</strong> Selama itu belum ada, akun Kas Rupiah
                  hanya memuat pergerakan dari bon — dan pada outlet yang lebih banyak membeli daripada menjual,
                  saldonya akan tampil <em>negatif</em>. Itu bukan kekeliruan pembukuan, melainkan modal awalnya
                  memang belum tercatat; catat saldo awal sebagai jurnal manual bila laporannya perlu dipakai.
                </p>
                <p>
                  Mutasi kas sengaja belum dijurnal: sisi kas bon sudah tercatat lewat bonnya sendiri, sehingga
                  menjurnal mutasinya sekaligus akan menghitung uang yang sama dua kali. Kategori lainnya — setor dan
                  tarik brankas, penjualan di luar jam, selisih kas awal — masing-masing perlu keputusan tersendiri.
                  Pengeluaran dicatat sebagai kewajiban lebih dahulu, karena modul pengeluaran memang tidak menyentuh kas.
                </p>
              </div>
            </CardContent>
          </Card>

        {/* ----------------------------- Neraca saldo ----------------------------- */}
        <TabsContent value="neraca" className="mt-5 space-y-4">
          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Neraca saldo</CardTitle>
              <CardDescription>
                Dasar penyusunan tiap pos laporan keuangan. Kolom Form menyebutkan baris B0002/B0003/B0004 yang
                disusun dari akun tersebut.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trialBalance.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat neraca saldo…</p> : null}
              {!trialBalance.isLoading && !trialBalance.data?.rows.length ? <EmptyNote text="Belum ada mutasi pada periode ini." /> : null}
              {trialBalance.data?.rows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="border-b border-[#dce6f0] bg-[#f5f8fc] text-xs uppercase tracking-wide text-[#475569]">
                      <tr>
                        <th className="px-3 py-3">Akun</th>
                        <th className="px-3 py-3">Kelompok</th>
                        <th className="px-3 py-3">Form</th>
                        <th className="px-3 py-3 text-right">Saldo awal</th>
                        <th className="px-3 py-3 text-right">Debit</th>
                        <th className="px-3 py-3 text-right">Kredit</th>
                        <th className="px-3 py-3 text-right">Saldo akhir D</th>
                        <th className="px-3 py-3 text-right">Saldo akhir K</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance.data.rows.map((row) => (
                        <tr key={row.accountCode} className="border-b border-[#eef2f7] last:border-0">
                          <td className="px-3 py-3 font-semibold text-[#213f63]">{row.accountCode}<span className="ml-2 font-normal text-[#475569]">{row.accountName}</span></td>
                          <td className="px-3 py-3 text-[#475569]">{ACCOUNT_TYPE_LABELS[row.accountType as AccountType] ?? row.accountType}</td>
                          <td className="px-3 py-3"><span className="text-xs text-[#718398]">{row.forms.join(" · ")}</span></td>
                          <td className="px-3 py-3 text-right tabular-nums text-[#475569]">{orDash(row.openingBalance)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-[#475569]">{orDash(row.totalDebit)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-[#475569]">{orDash(row.totalCredit)}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-semibold text-[#18395f]">{orDash(row.debitBalance)}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-semibold text-[#18395f]">{orDash(row.creditBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#dce6f0] bg-[#f5f8fc] font-bold text-[#18395f]">
                        <td className="px-3 py-3" colSpan={6}>Jumlah</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(trialBalance.data.totalDebit)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(trialBalance.data.totalCredit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : null}

              {integrity.data?.problems.length ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">Jurnal yang tidak utuh</p>
                  <ul className="mt-2 space-y-1 text-sm text-red-700">
                    {integrity.data.problems.map((problem) => (
                      <li key={problem.entryNumber}>{problem.entryNumber} — {problem.problem}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-red-700">
                    Angka pada periode ini tidak layak dipakai sampai jurnal tersebut diperiksa; periode juga tidak dapat ditutup.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------- Buku besar akun --------------------------- */}
        <TabsContent value="akun" className="mt-5 space-y-4">
          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Buku besar per akun</CardTitle>
              <CardDescription>
                Mutasi berurutan beserta saldo berjalannya. Saldo awal dihitung dari seluruh mutasi sebelum tanggal
                mulai, sehingga satu periode dapat dibaca sendiri tanpa menjumlah ulang riwayatnya.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-md">
                <Label className="text-xs">Akun</Label>
                <Select value={ledgerAccount} onValueChange={setLedgerAccount}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih akun" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(accountOptions).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {!ledgerAccount ? <EmptyNote text="Pilih akun untuk menampilkan buku besarnya." /> : null}
              {ledgerAccount && accountLedger.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat buku besar…</p> : null}

              {accountLedger.data ? (
                <>
                  <div className="flex flex-wrap gap-4 rounded-xl border border-[#e6edf5] bg-[#fafcff] p-4 text-sm">
                    <span className="text-[#64768d]">Saldo awal <strong className="tabular-nums text-[#18395f]">Rp {formatRupiah(accountLedger.data.openingBalance)}</strong></span>
                    <span className="text-[#64768d]">Saldo akhir <strong className="tabular-nums text-[#18395f]">Rp {formatRupiah(accountLedger.data.closingBalance)}</strong></span>
                    <span className="text-[#64768d]">Saldo normal <strong className="text-[#18395f]">{SIDE_LABELS[accountLedger.data.normalBalance]}</strong></span>
                  </div>

                  {!accountLedger.data.movements.length ? <EmptyNote text="Tidak ada mutasi pada periode ini." /> : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[820px] text-left text-sm">
                        <thead className="border-b border-[#dce6f0] bg-[#f5f8fc] text-xs uppercase tracking-wide text-[#475569]">
                          <tr>
                            <th className="px-3 py-3">Tanggal</th>
                            <th className="px-3 py-3">Jurnal</th>
                            <th className="px-3 py-3">Uraian</th>
                            <th className="px-3 py-3 text-right">Debit</th>
                            <th className="px-3 py-3 text-right">Kredit</th>
                            <th className="px-3 py-3 text-right">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountLedger.data.movements.map((movement) => (
                            <tr key={`${movement.entryId}-${movement.entryNumber}`} className="border-b border-[#eef2f7] last:border-0">
                              <td className="px-3 py-3 text-[#475569]">{formatDate(movement.entryDate)}</td>
                              <td className="px-3 py-3 font-semibold text-[#213f63]">{movement.entryNumber}</td>
                              <td className="px-3 py-3 text-[#475569]">
                                {movement.description}
                                {movement.memo ? <span className="block text-xs text-[#8194aa]">{movement.memo}</span> : null}
                                {movement.sourceReference ? <span className="block text-xs text-[#8194aa]">{SOURCE_LABELS[movement.sourceType] ?? movement.sourceType} · {movement.sourceReference}</span> : null}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums text-[#475569]">{orDash(movement.debit)}</td>
                              <td className="px-3 py-3 text-right tabular-nums text-[#475569]">{orDash(movement.credit)}</td>
                              <td className="px-3 py-3 text-right tabular-nums font-semibold text-[#18395f]">{formatRupiah(movement.runningBalance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------- Laporan keuangan --------------------------- */}
        <TabsContent value="laporan" className="mt-5 space-y-4">
          {/*
            Kas buku besar memuat seluruh kas Rupiah milik sendiri, sedangkan kas operasional hanya
            memuat laci — perpindahan ke brankas sengaja tidak dijurnal. Selisih keduanya karena itu
            harus persis sebesar isi brankas, dan ditunjukkan di sini supaya selisih yang tidak
            terjelaskan tidak lagi luput seperti pada temuan pemeriksaan 7.2/7.3.
          */}
          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Rekonsiliasi Kas Rupiah</CardTitle>
              <CardDescription>Posisi per {formatDate(range.to)}.</CardDescription>
            </CardHeader>
            <CardContent>
              {cashReconciliation.isLoading ? (
                <p className="py-4 text-sm text-[#475569]">Menghitung rekonsiliasi kas…</p>
              ) : cashReconciliation.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-900">Rekonsiliasi kas gagal dibaca</p>
                  <p className="mt-1 text-sm text-red-800">{cashReconciliation.error.message}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => cashReconciliation.refetch()}>
                    <RefreshCw className="mr-1.5 size-4" />Coba lagi
                  </Button>
                </div>
              ) : cashReconciliation.data ? (
                <>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: "Kas Rupiah (buku besar)", value: cashReconciliation.data.ledgerCashIdr, hint: "Akun 1-1110" },
                      { label: "Kas operasional", value: cashReconciliation.data.operationalCashIdr, hint: "Laci kasir" },
                      { label: "Saldo brankas", value: cashReconciliation.data.safeBalanceIdr, hint: "Setor dikurangi ambil" },
                      { label: "Selisih", value: cashReconciliation.data.difference, hint: "Yang belum terjelaskan" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-[#dce6f0] bg-[#f8fafc] p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-[#475569]">{item.label}</dt>
                        <dd className="mt-1 font-display text-lg tabular-nums text-[#18395f]">{formatRupiah(item.value)}</dd>
                        <p className="mt-1 text-xs text-[#64748b]">{item.hint}</p>
                      </div>
                    ))}
                  </dl>
                  {cashReconciliation.data.reconciled ? (
                    <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                      Selisih kas buku besar terhadap kas operasional seluruhnya dijelaskan oleh saldo brankas.
                    </p>
                  ) : (
                    <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                      Ada selisih {formatRupiah(cashReconciliation.data.difference)} yang belum dapat dijelaskan oleh saldo
                      brankas. Telusuri mutasi kas dan jurnalnya sebelum laporan ini dipakai.
                    </p>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>

          {statements.isLoading ? <p className="py-8 text-sm text-[#475569]">Menyusun laporan…</p> : null}

          {statements.data?.warnings.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Angka ini belum layak dipakai</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {statements.data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          ) : null}

          {statements.data ? (
            <>
              <Card className="border-[#dce6f0]">
                <CardHeader>
                  <CardTitle className="font-display text-xl text-[#18395f]">Laporan Laba Rugi</CardTitle>
                  <CardDescription>
                    Form B0003 · {formatDate(statements.data.period.from)} — {formatDate(statements.data.period.to)},
                    dibandingkan dengan {formatDate(statements.data.comparativePeriod.from)} — {formatDate(statements.data.comparativePeriod.to)}.
                    Angka pembanding diwajibkan SAK EP Bab 3 meskipun form B tidak menyediakan kolomnya.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StatementTable
                    sections={[
                      statements.data.incomeStatement.revenue,
                      statements.data.incomeStatement.costOfGoods,
                    ]}
                    subtotals={[{ label: "Laba kotor", amount: statements.data.incomeStatement.grossProfit, comparative: statements.data.incomeStatement.grossProfitComparative }]}
                  />
                  <StatementTable
                    sections={[statements.data.incomeStatement.operatingExpenses]}
                    subtotals={[{ label: "Laba usaha", amount: statements.data.incomeStatement.operatingProfit, comparative: statements.data.incomeStatement.operatingProfitComparative }]}
                  />
                  <StatementTable
                    sections={[statements.data.incomeStatement.otherItems, statements.data.incomeStatement.tax]}
                    subtotals={[{ label: "Laba/(rugi) bersih", amount: statements.data.incomeStatement.netProfit, comparative: statements.data.incomeStatement.netProfitComparative, strong: true }]}
                  />
                </CardContent>
              </Card>

              <Card className="border-[#dce6f0]">
                <CardHeader>
                  <CardTitle className="font-display text-xl text-[#18395f]">Laporan Posisi Keuangan</CardTitle>
                  <CardDescription>
                    Form B0002 · per {formatDate(statements.data.period.to)}, dibandingkan dengan posisi sehari sebelum periode ini dimulai.
                    Saldo dihitung kumulatif sejak awal pembukuan.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StatementTable
                    sections={[statements.data.balanceSheet.assets]}
                    subtotals={[{ label: "Jumlah aset", amount: statements.data.balanceSheet.assets.total, comparative: statements.data.balanceSheet.assets.comparativeTotal, strong: true }]}
                  />
                  <StatementTable
                    sections={[statements.data.balanceSheet.liabilities, statements.data.balanceSheet.equity]}
                    extraRows={[{ label: "Laba/(rugi) berjalan", amount: statements.data.balanceSheet.currentPeriodProfit, comparative: statements.data.balanceSheet.currentPeriodProfitComparative }]}
                    subtotals={[{ label: "Jumlah kewajiban dan ekuitas", amount: statements.data.balanceSheet.totalLiabilitiesAndEquity, comparative: statements.data.balanceSheet.totalLiabilitiesAndEquityComparative, strong: true }]}
                  />
                  <div className="mt-3">
                    {statements.data.balanceSheet.balanced ? (
                      <Badge className="bg-[#eef6ed] text-[#4d8548] hover:bg-[#eef6ed]"><CheckCircle2 className="mr-1 size-3" />Neraca seimbang</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Selisih {formatRupiah(statements.data.balanceSheet.difference)}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#dce6f0]">
                <CardHeader>
                  <CardTitle className="font-display text-xl text-[#18395f]">Laporan Perubahan Ekuitas</CardTitle>
                  <CardDescription>Form B0004 · per {formatDate(statements.data.period.to)}.</CardDescription>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {[
                        { label: "Modal disetor", value: statements.data.equityStatement.openingCapital },
                        { label: "Laba ditahan", value: statements.data.equityStatement.openingRetainedEarnings },
                        { label: "Laba/(rugi) periode berjalan", value: statements.data.equityStatement.netProfit },
                        { label: "Dividen", value: Number(statements.data.equityStatement.dividends) === 0 ? "0.00" : `-${statements.data.equityStatement.dividends}` },
                      ].map((row) => (
                        <tr key={row.label} className="border-b border-[#eef2f7]">
                          <td className="py-2 text-[#475569]">{row.label}</td>
                          <td className="py-2 text-right tabular-nums text-[#475569]">{formatRupiah(row.value)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-[#dce6f0] font-bold text-[#18395f]">
                        <td className="py-2">Jumlah ekuitas</td>
                        <td className="py-2 text-right tabular-nums">{formatRupiah(statements.data.equityStatement.closingEquity)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* -------------------------------- Periode ------------------------------- */}
        <TabsContent value="periode" className="mt-5 space-y-4">
          <Card className="border-[#dce6f0]">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[#18395f]">Periode pembukuan</CardTitle>
              <CardDescription>
                Periode dibuat otomatis saat jurnal pertama bulan itu dicatat. Periode yang sudah ditutup menolak
                jurnal baru; koreksinya dicatat sebagai jurnal balik pada periode terbuka.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {periods.isLoading ? <p className="py-8 text-sm text-[#475569]">Memuat periode…</p> : null}
              {!periods.isLoading && !periods.data?.length ? <EmptyNote text="Belum ada periode. Periode terbentuk sendiri begitu jurnal pertama dicatat." /> : null}
              {periods.data?.length ? (
                <div className="space-y-3">
                  {periods.data.map((period) => (
                    <PeriodRow
                      key={period.id}
                      period={period}
                      pending={closePeriod.isPending || reopenPeriod.isPending}
                      inspected={inspectedPeriodId === period.id}
                      onInspect={() => setInspectedPeriodId(inspectedPeriodId === period.id ? null : period.id)}
                      valuationPending={postClosingValuation.isPending}
                      yearEndPending={postYearEndClosing.isPending}
                      depreciationPending={postMonthlyDepreciation.isPending}
                      revaluationPending={postCurrencyRevaluation.isPending}
                      onPostValuation={() => postClosingValuation.mutate({ periodId: period.id })}
                      onPostYearEnd={() => postYearEndClosing.mutate({ periodId: period.id })}
                      onPostDepreciation={() => postMonthlyDepreciation.mutate({ periodId: period.id })}
                      onPostRevaluation={() => postCurrencyRevaluation.mutate({ periodId: period.id })}
                      onClose={(notes) => closePeriod.mutate({ periodId: period.id, notes: notes || undefined })}
                      onReopen={(reason) => reopenPeriod.mutate({ periodId: period.id, reason })}
                    />
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PeriodRow({
  period,
  pending,
  inspected,
  onInspect,
  valuationPending,
  yearEndPending,
  depreciationPending,
  revaluationPending,
  onPostValuation,
  onPostYearEnd,
  onPostDepreciation,
  onPostRevaluation,
  onClose,
  onReopen,
}: {
  period: { id: number; periodStart: string; periodEnd: string; status: string; closedAt: Date | string | null; closingNotes: string | null };
  pending: boolean;
  inspected: boolean;
  onInspect: () => void;
  valuationPending: boolean;
  yearEndPending: boolean;
  depreciationPending: boolean;
  revaluationPending: boolean;
  onPostValuation: () => void;
  onPostYearEnd: () => void;
  onPostDepreciation: () => void;
  onPostRevaluation: () => void;
  onClose: (notes: string) => void;
  onReopen: (reason: string) => void;
}) {
  const [note, setNote] = useState("");
  const closed = period.status === "DITUTUP";
  const valuation = trpc.ledger.closingValuation.useQuery({ periodId: period.id }, { enabled: inspected });
  const depreciation = trpc.ledger.monthlyDepreciation.useQuery({ periodId: period.id }, { enabled: inspected });
  const revaluation = trpc.ledger.currencyRevaluation.useQuery({ periodId: period.id }, { enabled: inspected });
  const blocked = Boolean(valuation.data?.blockers.length);
  const valued = Boolean(valuation.data?.valuationPostedAt);
  const depreciated = Boolean(depreciation.data?.depreciationPostedAt);
  const revalued = Boolean(revaluation.data?.revaluationPostedAt);
  const needsYearEnd = Boolean(valuation.data?.isFiscalYearEnd) && !valuation.data?.profitClosingPostedAt;

  return (
    <div className="rounded-xl border border-[#e6edf5] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#213f63]">{formatDate(period.periodStart)} — {formatDate(period.periodEnd)}</p>
          {closed ? <p className="text-xs text-[#8194aa]">Ditutup {formatDate(period.closedAt)}</p> : null}
          {period.closingNotes ? <p className="mt-1 max-w-2xl whitespace-pre-line text-xs text-[#718398]">{period.closingNotes}</p> : null}
        </div>
        <Badge className={closed ? "bg-[#eef3fb] text-[#405dbc] hover:bg-[#eef3fb]" : "bg-[#eef6ed] text-[#4d8548] hover:bg-[#eef6ed]"}>
          {closed ? <Lock className="mr-1 size-3" /> : <LockOpen className="mr-1 size-3" />}
          {closed ? "Ditutup" : "Terbuka"}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-60 flex-1">
          <Label className="text-xs">{closed ? "Alasan membuka kembali *" : "Catatan penutupan"}</Label>
          <Textarea
            autoComplete="off"
            className="mt-1 min-h-10"
            rows={1}
            placeholder={closed ? "Alasan wajib diisi dan tersimpan pada jejak audit." : "Mis. Ditutup setelah rekonsiliasi kas akhir bulan."}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        {closed ? (
          <Button variant="outline" disabled={pending || note.trim().length < 5} onClick={() => onReopen(note)}>
            <LockOpen className="mr-2 size-4" />Buka kembali
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onInspect} aria-expanded={inspected}>
              <Scale className="mr-2 size-4" />{inspected ? "Tutup panel penilaian" : "Penutupan periode"}
            </Button>
            {/*
              Syaratnya disebutkan pada tombolnya sendiri, bukan disimpan sampai pesan galat:
              pengguna tidak boleh menemukan aturan penutupan dengan cara menabraknya.
            */}
            <Button
              variant="outline"
              disabled={pending || (inspected && (!depreciated || !revalued || !valued))}
              title={
                inspected && !depreciated
                  ? "Jurnalkan penyusutan bulan ini lebih dulu."
                  : inspected && !revalued
                    ? "Jurnalkan revaluasi kurs bulan ini lebih dulu."
                  : inspected && !valued
                    ? "Jalankan penilaian persediaan akhir UKA lebih dulu."
                    : undefined
              }
              onClick={() => onClose(note)}
            >
              <Lock className="mr-2 size-4" />Tutup periode
            </Button>
          </>
        )}
      </div>

      {inspected && !closed ? (
        <MonthlyDepreciationPanel
          depreciation={depreciation}
          pending={depreciationPending}
          onPost={onPostDepreciation}
        />
      ) : null}

      {inspected && !closed ? (
        <CurrencyRevaluationPanel
          revaluation={revaluation}
          pending={revaluationPending}
          onPost={onPostRevaluation}
        />
      ) : null}

      {inspected && !closed ? (
        <PeriodClosingPanel
          periodEnd={period.periodEnd}
          valuation={valuation}
          blocked={blocked}
          valued={valued}
          needsYearEnd={needsYearEnd}
          valuationPending={valuationPending}
          yearEndPending={yearEndPending}
          onPostValuation={onPostValuation}
          onPostYearEnd={onPostYearEnd}
        />
      ) : null}
    </div>
  );
}

/**
 * Panel Penutupan Periode: bukti penilaian persediaan akhir UKA sebelum periodenya dikunci.
 *
 * Angka yang ditampilkan di sini adalah angka yang **akan** dijurnal — keduanya datang dari
 * `closingValuation`, sumber yang sama dengan yang dipakai server saat menjurnalnya. Menghitungnya
 * ulang di layar akan menciptakan kemungkinan angka layar berbeda dari angka buku besar, dan itu
 * pertanyaan pertama yang akan diajukan pemeriksa.
 */
type MonthlyDepreciation = inferRouterOutputs<AppRouter>["ledger"]["monthlyDepreciation"];

/**
 * Panel Penyusutan Bulanan: beban tiap aset sebelum bulannya dijurnal.
 *
 * Diletakkan **di atas** panel penutupan karena urutan di layar mengikuti urutan gerbangnya:
 * penyusutan lebih dulu, lalu penilaian persediaan, lalu penguncian. Angkanya datang dari
 * `monthlyDepreciation`, sumber yang sama dengan yang dipakai server saat menjurnalnya — layar dan
 * buku besar karena itu mustahil berbeda.
 */
function MonthlyDepreciationPanel({
  depreciation,
  pending,
  onPost,
}: {
  depreciation: { data: MonthlyDepreciation | undefined; isLoading: boolean; isError: boolean; error: { message: string } | null };
  pending: boolean;
  onPost: () => void;
}) {
  if (depreciation.isLoading) {
    return <p className="mt-4 border-t border-[#eef2f7] pt-4 text-sm text-[#475569]">Memuat penyusutan bulanan…</p>;
  }
  if (depreciation.isError) {
    return (
      <div className="mt-4 border-t border-[#eef2f7] pt-4">
        <p className="rounded-xl border border-[#f0d6d6] bg-[#fdf6f6] p-4 text-sm text-[#9a4b4b]">
          Penyusutan tidak dapat dimuat: {depreciation.error?.message ?? "sambungan ke server terputus."}
        </p>
      </div>
    );
  }

  const data = depreciation.data;
  if (!data) return null;
  const posted = Boolean(data.depreciationPostedAt);

  return (
    <div className="mt-4 space-y-4 border-t border-[#eef2f7] pt-4">
      <div>
        <p className="font-semibold text-[#213f63]">Penyusutan aset tetap {data.periodMonth}</p>
        <p className="text-xs text-[#718398]">
          Garis lurus atas umur manfaat tiap aset. Bulan perolehan disusutkan penuh. Beban bulan ini
          harus dijurnal sebelum periodenya dapat ditutup.
        </p>
      </div>

      {data.blockers.length ? (
        <div className="rounded-xl border border-[#f2e2c9] bg-[#fdfaf3] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#8a6320]">
            <ShieldAlert className="size-4" />Penyusutan belum dapat dijalankan
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#8a6320]">
            {data.blockers.map((blocker) => (
              <li key={blocker.assetName}>
                <span className="font-semibold">{blocker.assetName}</span> — {blocker.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#8194aa]">
              <tr className="border-b border-[#e6edf5]">
                <th className="py-2 pr-4">Aset</th>
                <th className="py-2 pr-4">Kategori</th>
                <th className="py-2 pr-4 text-right">Beban bulan ini</th>
                <th className="py-2 pr-4 text-right">Akumulasi sesudahnya</th>
                <th className="py-2 text-right">Nilai buku sesudahnya</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.assetId} className="border-b border-[#eef2f7]">
                  <td className="py-2 pr-4 font-semibold text-[#213f63]">
                    {row.assetName}
                    {row.assetCode ? <span className="ml-2 text-xs font-normal text-[#8194aa]">{row.assetCode}</span> : null}
                  </td>
                  <td className="py-2 pr-4 text-[#475569]">{row.category.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[#475569]">{formatRupiah(row.charge)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[#475569]">{formatRupiah(row.accumulatedAfter)}</td>
                  <td className="py-2 text-right tabular-nums text-[#475569]">{formatRupiah(row.carryingAfter)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-2 pr-4 font-semibold text-[#213f63]" colSpan={2}>Total beban penyusutan</td>
                <td className="py-2 pr-4 text-right font-semibold tabular-nums text-[#213f63]">{formatRupiah(data.totalCharge)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <EmptyNote
          text={
            data.blockers.length
              ? "Tidak ada aset lain yang perlu disusutkan bulan ini."
              : "Tidak ada aset tersusutkan pada bulan ini. Menjalankannya tetap menandai bulan ini sudah disusutkan, tanpa menulis jurnal — dan gerbang penutupan periode tetap menuntutnya."
          }
        />
      )}

      {posted ? (
        <p className="text-sm text-[#4d8548]">
          Sudah dijurnal {formatDate(data.depreciationPostedAt)}.
        </p>
      ) : (
        <Button
          disabled={pending || Boolean(data.blockers.length)}
          title={data.blockers.length ? "Selesaikan penghalangnya lebih dulu." : undefined}
          onClick={onPost}
        >
          <Scale className="mr-2 size-4" />Jurnalkan penyusutan bulan ini
        </Button>
      )}
    </div>
  );
}

type CurrencyRevaluation = inferRouterOutputs<AppRouter>["ledger"]["currencyRevaluation"];

/**
 * Panel Revaluasi Kurs: selisih tiap mata uang sebelum bulannya dijurnal.
 *
 * Diletakkan di antara panel penyusutan dan panel penilaian karena urutan di layar mengikuti
 * urutan gerbangnya: penyusutan, lalu revaluasi kurs, lalu penilaian persediaan, lalu penguncian.
 * Angkanya datang dari `currencyRevaluation`, sumber yang sama dengan yang dipakai server saat
 * menjurnalnya — layar dan buku besar karena itu mustahil berbeda.
 */
function CurrencyRevaluationPanel({
  revaluation,
  pending,
  onPost,
}: {
  revaluation: { data: CurrencyRevaluation | undefined; isLoading: boolean; isError: boolean; error: { message: string } | null };
  pending: boolean;
  onPost: () => void;
}) {
  if (revaluation.isLoading) {
    return <p className="mt-4 border-t border-[#eef2f7] pt-4 text-sm text-[#475569]">Memuat revaluasi kurs…</p>;
  }
  if (revaluation.isError) {
    return (
      <div className="mt-4 border-t border-[#eef2f7] pt-4">
        <p className="rounded-xl border border-[#f0d6d6] bg-[#fdf6f6] p-4 text-sm text-[#9a4b4b]">
          Revaluasi kurs tidak dapat dimuat: {revaluation.error?.message ?? "sambungan ke server terputus."}
        </p>
      </div>
    );
  }

  const data = revaluation.data;
  if (!data) return null;
  const posted = Boolean(data.revaluationPostedAt);

  return (
    <div className="mt-4 space-y-4 border-t border-[#eef2f7] pt-4">
      <div>
        <p className="font-semibold text-[#213f63]">Revaluasi kurs {data.periodMonth}</p>
        <p className="text-xs text-[#718398]">
          Saldo rekening valuta asing diukur ulang pada kurs tengah BI akhir periode; selisihnya
          masuk Laba/(Rugi) Selisih Kurs. Uang tunai UKA di laci tidak ikut — ia dinilai dari stock
          opname. Selisihnya bukan uang yang masuk atau keluar.
        </p>
      </div>

      {data.blockers.length ? (
        <div className="rounded-xl border border-[#f2e2c9] bg-[#fdfaf3] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#8a6320]">
            <ShieldAlert className="size-4" />Revaluasi belum dapat dijalankan
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#8a6320]">
            {data.blockers.map((blocker) => (
              <li key={blocker.currencyCode}>
                <span className="font-semibold">{blocker.currencyCode}</span> — {blocker.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#8194aa]">
              <tr className="border-b border-[#e6edf5]">
                <th className="py-2 pr-4">Mata uang</th>
                <th className="py-2 pr-4 text-right">Saldo valuta</th>
                <th className="py-2 pr-4 text-right">Kurs tengah</th>
                <th className="py-2 pr-4">Tanggal kurs</th>
                <th className="py-2 pr-4 text-right">Nilai tercatat</th>
                <th className="py-2 pr-4 text-right">Nilai sesudahnya</th>
                <th className="py-2 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.currencyCode} className="border-b border-[#eef2f7]">
                  <td className="py-2 pr-4 font-semibold text-[#213f63]">{row.currencyCode}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[#475569]">{row.foreignBalance}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[#475569]">{formatRupiah(row.midRatePerUnit)}</td>
                  <td className="py-2 pr-4 text-[#475569]">
                    {row.rateReferenceDate}
                    {row.rateReferenceDate < data.periodEnd ? (
                      <span className="block text-xs text-[#8a6320]">Mundur dari akhir periode</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[#475569]">{formatRupiah(row.carryingBefore)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[#475569]">{formatRupiah(row.carryingAfter)}</td>
                  <td className={`py-2 text-right tabular-nums ${row.difference.startsWith("-") ? "text-[#9a4b4b]" : "text-[#4d8548]"}`}>
                    {formatRupiah(row.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-2 pr-4 font-semibold text-[#213f63]" colSpan={6}>Total selisih kurs</td>
                <td className={`py-2 text-right font-semibold tabular-nums ${data.totalDifference.startsWith("-") ? "text-[#9a4b4b]" : "text-[#213f63]"}`}>
                  {formatRupiah(data.totalDifference)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <EmptyNote
          text={
            data.blockers.length
              ? "Tidak ada mata uang lain yang perlu direvaluasi bulan ini."
              : "Tidak ada saldo rekening valuta asing pada bulan ini. Menjalankannya tetap menandai bulan ini sudah direvaluasi, tanpa menulis jurnal — dan gerbang penutupan periode tetap menuntutnya."
          }
        />
      )}

      {posted ? (
        <p className="text-sm text-[#4d8548]">
          Sudah dijurnal {formatDate(data.revaluationPostedAt)}.
        </p>
      ) : (
        <Button
          disabled={pending || Boolean(data.blockers.length)}
          title={data.blockers.length ? "Selesaikan penghalangnya lebih dulu." : undefined}
          onClick={onPost}
        >
          <Scale className="mr-2 size-4" />Jurnalkan revaluasi bulan ini
        </Button>
      )}
    </div>
  );
}

type ClosingValuation = inferRouterOutputs<AppRouter>["ledger"]["closingValuation"];

function PeriodClosingPanel({
  periodEnd,
  valuation,
  blocked,
  valued,
  needsYearEnd,
  valuationPending,
  yearEndPending,
  onPostValuation,
  onPostYearEnd,
}: {
  periodEnd: string;
  valuation: { data: ClosingValuation | undefined; isLoading: boolean; isError: boolean; error: { message: string } | null };
  blocked: boolean;
  valued: boolean;
  needsYearEnd: boolean;
  valuationPending: boolean;
  yearEndPending: boolean;
  onPostValuation: () => void;
  onPostYearEnd: () => void;
}) {
  const data = valuation.data;
  const endDay = periodEnd.slice(0, 10);

  if (valuation.isLoading) {
    return <p className="mt-4 border-t border-[#eef2f7] pt-4 text-sm text-[#475569]">Memuat penilaian persediaan…</p>;
  }
  if (valuation.isError) {
    return (
      <div className="mt-4 border-t border-[#eef2f7] pt-4">
        <p className="rounded-xl border border-[#f0d6d6] bg-[#fdf6f6] p-4 text-sm text-[#9a4b4b]">
          Penilaian tidak dapat dimuat: {valuation.error?.message ?? "sambungan ke server terputus."}
        </p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="mt-4 space-y-4 border-t border-[#eef2f7] pt-4">
      <div>
        <p className="font-semibold text-[#213f63]">Penilaian persediaan akhir UKA</p>
        <p className="text-xs text-[#718398]">
          Hitungan fisik stock opname dinilai pada kurs tengah Bank Indonesia — (kurs beli + kurs jual) ÷ 2, dibagi
          satuan kuotasinya.
        </p>
      </div>

      {data.blockers.length ? (
        <div className="rounded-xl border border-[#f2e2c9] bg-[#fdfaf3] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#8a6320]">
            <ShieldAlert className="size-4" />Penilaian belum dapat dijalankan
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#8a6320]">
            {data.blockers.map((blocker) => (
              <li key={blocker.currencyCode}>
                <span className="font-semibold">{blocker.currencyCode}</span> — {blocker.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#8194aa]">
              <tr className="border-b border-[#e6edf5]">
                <th className="py-2 pr-4">Mata uang</th>
                <th className="py-2 pr-4 text-right">Kuantitas</th>
                <th className="py-2 pr-4">Tanggal opname</th>
                <th className="py-2 pr-4 text-right">Kurs tengah</th>
                <th className="py-2 pr-4">Tanggal kurs</th>
                <th className="py-2 text-right">Nilai Rupiah</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.currencyId} className="border-b border-[#eef2f7]">
                  <td className="py-2 pr-4 font-semibold text-[#213f63]">{row.currencyCode}</td>
                  <td className="py-2 pr-4 text-right align-top tabular-nums text-[#475569]">{formatRupiah(row.quantity)}</td>
                  {/*
                    Tanggal yang berbeda dari akhir periode ditandai, bukan disamarkan: opname hanya
                    terjadi saat outlet buka dan BI tidak mengumumkan kurs pada hari libur, jadi
                    kemundurannya sah — tetapi harus terbaca.
                  */}
                  <td className="py-2 pr-4 align-top text-[#475569]">
                    <DateWithShift day={row.opnameDate} endDay={endDay} note="hitungan fisik terakhir sebelum akhir periode" />
                  </td>
                  <td className="py-2 pr-4 text-right align-top tabular-nums text-[#475569]">{formatRupiah(row.midRatePerUnit)}</td>
                  <td className="py-2 pr-4 align-top text-[#475569]">
                    <DateWithShift day={row.rateReferenceDate} endDay={endDay} note="kurs BI terakhir sampai akhir periode" />
                  </td>
                  <td className="py-2 text-right align-top font-semibold tabular-nums text-[#213f63]">{formatRupiah(row.rupiahValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyNote text="Tidak ada valuta asing yang perlu dinilai pada periode ini. Penilaiannya tetap harus dijalankan supaya periodenya dapat ditutup." />
      )}

      <div className="rounded-xl border border-[#e6edf5] bg-[#fbfdff] p-4">
        <p className="text-xs uppercase tracking-wide text-[#8194aa]">Yang akan dijurnal</p>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[#475569]">Persediaan awal (5-1100)</dt>
            <dd className="tabular-nums text-[#475569]">{formatRupiah(data.priorClosingValue)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#475569]">Persediaan akhir (5-1300)</dt>
            <dd className="tabular-nums font-semibold text-[#213f63]">{formatRupiah(data.closingValue)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={blocked || valued || valuationPending} onClick={onPostValuation}>
          <CheckCircle2 className="mr-2 size-4" />
          {valuationPending ? "Menjalankan…" : "Jalankan penilaian"}
        </Button>
        {valued ? (
          <span className="text-xs text-[#4d8548]">Sudah dinilai {formatDate(data.valuationPostedAt)}.</span>
        ) : null}
        {data.isFiscalYearEnd ? (
          <Button variant="outline" disabled={!valued || !needsYearEnd || yearEndPending} onClick={onPostYearEnd}>
            <CalendarCheck className="mr-2 size-4" />
            {yearEndPending ? "Menjalankan…" : "Jurnal penutup laba tahunan"}
          </Button>
        ) : null}
        {data.isFiscalYearEnd && !needsYearEnd ? (
          <span className="text-xs text-[#4d8548]">Laba tahun ini sudah ditutup ke Laba Ditahan.</span>
        ) : null}
      </div>
    </div>
  );
}

/** Tanggal beserta tanda bila ia mundur dari akhir periode; alasannya disebut, bukan disembunyikan. */
function DateWithShift({ day, endDay, note }: { day: string; endDay: string; note: string }) {
  if (day === endDay) return <>{formatDate(day)}</>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="whitespace-nowrap">{formatDate(day)}</span>
      <span className="text-xs leading-snug text-[#8a6320]" title={note}>Mundur dari akhir periode — {note}</span>
    </span>
  );
}

type RenderedSection = {
  title: string;
  lines: { accountCode: string; accountName: string; contra: boolean; amount: string; comparative: string }[];
  total: string;
  comparativeTotal: string;
};

/**
 * Satu blok laporan: baris akun, jumlah bagiannya, lalu subtotal turunannya. Kolom pembanding
 * selalu ada — SAK EP mewajibkannya, dan menambahkannya belakangan jauh lebih sulit.
 */
function StatementTable({
  sections,
  subtotals = [],
  extraRows = [],
}: {
  sections: RenderedSection[];
  subtotals?: { label: string; amount: string; comparative: string; strong?: boolean }[];
  extraRows?: { label: string; amount: string; comparative: string }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-[#dce6f0] text-xs uppercase tracking-wide text-[#475569]">
          <tr>
            <th className="px-2 py-2">Pos</th>
            <th className="px-2 py-2 text-right">Periode ini</th>
            <th className="px-2 py-2 text-right">Pembanding</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.title}>
              <tr className="bg-[#f5f8fc]">
                <td className="px-2 py-2 font-semibold text-[#18395f]" colSpan={3}>{section.title}</td>
              </tr>
              {section.lines.length ? section.lines.map((line) => (
                <tr key={line.accountCode} className="border-b border-[#eef2f7]">
                  <td className="px-2 py-2 pl-6 text-[#475569]">
                    {line.accountName}
                    {line.contra ? <span className="ml-1 text-xs text-[#8194aa]">(pengurang)</span> : null}
                    <span className="ml-2 text-xs text-[#a8b4c4]">{line.accountCode}</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#475569]">{formatRupiah(line.amount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#8194aa]">{formatRupiah(line.comparative)}</td>
                </tr>
              )) : (
                <tr className="border-b border-[#eef2f7]"><td className="px-2 py-2 pl-6 text-[#8194aa]" colSpan={3}>Tidak ada</td></tr>
              )}
              <tr className="border-b border-[#dce6f0]">
                <td className="px-2 py-2 pl-6 font-semibold text-[#18395f]">Jumlah {section.title.toLowerCase()}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-[#18395f]">{formatRupiah(section.total)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-[#8194aa]">{formatRupiah(section.comparativeTotal)}</td>
              </tr>
            </Fragment>
          ))}
          {extraRows.map((row) => (
            <tr key={row.label} className="border-b border-[#eef2f7]">
              <td className="px-2 py-2 pl-6 text-[#475569]">{row.label}</td>
              <td className="px-2 py-2 text-right tabular-nums text-[#475569]">{formatRupiah(row.amount)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-[#8194aa]">{formatRupiah(row.comparative)}</td>
            </tr>
          ))}
          {subtotals.map((subtotal) => (
            <tr key={subtotal.label} className={subtotal.strong ? "border-t-2 border-[#dce6f0] bg-[#f5f8fc]" : "border-t border-[#dce6f0]"}>
              <td className="px-2 py-2 font-bold text-[#18395f]">{subtotal.label}</td>
              <td className="px-2 py-2 text-right tabular-nums font-bold text-[#18395f]">{formatRupiah(subtotal.amount)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-[#64768d]">{formatRupiah(subtotal.comparative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  text,
  tone = "neutral",
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  text?: string;
  tone?: "neutral" | "ok" | "warn";
  loading?: boolean;
}) {
  const toneClass = tone === "warn" ? "bg-amber-50 text-amber-700" : tone === "ok" ? "bg-[#eef6ed] text-[#5e9c59]" : "bg-[#eef3fb] text-[#405dbc]";
  return (
    <div className="rounded-2xl border border-[#dce6f0] bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#64768d]">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-3 font-display text-2xl tabular-nums text-[#18395f]">{loading ? "—" : text ?? value ?? 0}</p>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-[#cdd9e5] bg-[#fbfdff] p-6 text-sm text-[#6f8094]">{text}</p>;
}
