import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@shared/chartOfAccounts";
import { BookOpen, CalendarCheck, CheckCircle2, Lock, LockOpen, Plus, RefreshCw, Scale, ShieldAlert, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
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
  const entries = trpc.ledger.entries.useQuery({ from: range.from, to: range.to });
  const trialBalance = trpc.ledger.trialBalance.useQuery({ from: range.from, to: range.to });
  const integrity = trpc.ledger.integrity.useQuery({ from: range.from, to: range.to });
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
  onClose,
  onReopen,
}: {
  period: { id: number; periodStart: string; periodEnd: string; status: string; closedAt: Date | string | null; closingNotes: string | null };
  pending: boolean;
  onClose: (notes: string) => void;
  onReopen: (reason: string) => void;
}) {
  const [note, setNote] = useState("");
  const closed = period.status === "DITUTUP";

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
          <Button variant="outline" disabled={pending} onClick={() => onClose(note)}>
            <Lock className="mr-2 size-4" />Tutup periode
          </Button>
        )}
      </div>
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
