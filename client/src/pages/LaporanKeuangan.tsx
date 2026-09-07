import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { CheckCircle2, ChevronDown, ChevronRight, RefreshCw, ShieldAlert } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Kelima laporan keuangan yang SAK EP tuntut, di satu halaman.
 *
 * Buku Besar memuat pekerjaan pembukuannya — jurnal, neraca saldo, buku besar akun, penutupan
 * periode. Halaman ini memuat hasilnya. Pemisahan itu bukan kerapian belaka: yang membaca laporan
 * keuangan dan yang mengerjakan pembukuan sering bukan orang yang sama, dan tab Laporan Keuangan
 * sudah menjadi tab terpanjang pada aplikasi.
 */

/** Nominal buku besar selalu Rupiah dua desimal; ditampilkan bergaya Indonesia, tanpa simbol. */
const formatRupiah = (value: string | null | undefined) => {
  if (value === null || value === undefined) return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";

const currentMonthRange = () => {
  const today = new Date();
  const iso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
};

export default function LaporanKeuangan() {
  const [range, setRange] = useState(currentMonthRange);

  const statements = trpc.ledger.statements.useQuery({ from: range.from, to: range.to });
  const cashReconciliation = trpc.ledger.cashReconciliation.useQuery({ asOf: range.to });
  const notes = trpc.ledger.notes.useQuery({ from: range.from, to: range.to });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#18395f]">Laporan Keuangan</h1>
        <p className="mt-1 text-sm text-[#475569]">
          Kelima laporan yang SAK EP tuntut, disusun dari buku besar — bukan diketik. Tiap pos dapat ditelusuri
          kembali ke akun dan jurnalnya.
        </p>
      </div>

      <Card className="border-[#dce6f0]">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg text-[#18395f]">Rentang laporan</CardTitle>
          <CardDescription>Kolom pembandingnya rentang sepanjang ini yang berakhir sehari sebelum rentang ini mulai — SAK EP Bab 3.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs" htmlFor="laporan-dari">Periode dari</Label>
            <Input id="laporan-dari" type="date" className="mt-1" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} />
          </div>
          <div>
            <Label className="text-xs" htmlFor="laporan-sampai">sampai</Label>
            <Input id="laporan-sampai" type="date" className="mt-1" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
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
        <CashFlowCard statements={statements.data} loading={statements.isLoading} />
        <NotesCard range={range} query={notes} />
      </div>
    </div>
  );
}


type LedgerOutputs = inferRouterOutputs<AppRouter>["ledger"];
type StatementsData = LedgerOutputs["statements"];
type NotesData = LedgerOutputs["notes"];
type CashFlowData = StatementsData["cashFlowStatement"];

/**
 * Laporan Arus Kas — metode langsung.
 *
 * Keranjang "belum terklasifikasi" sengaja terlihat beserta nomor jurnalnya, dan selisih
 * rekonsiliasi disajikan sebagai angka, tidak pernah sebagai pos penyeimbang. Laporan yang terlihat
 * rapi padahal dasarnya belum lengkap justru lebih berbahaya di hadapan pemeriksa.
 */
function CashFlowCard({ statements, loading }: { statements: StatementsData | undefined; loading: boolean }) {
  if (loading) return <Card className="border-[#dce6f0]"><CardContent className="py-8 text-sm text-[#475569]">Menyusun Arus Kas…</CardContent></Card>;
  if (!statements) return null;
  const flow = statements.cashFlowStatement;
  const comparative = statements.cashFlowComparative;

  const sections: { key: keyof Pick<CashFlowData, "operating" | "investing" | "financing" | "rateEffect" | "unclassified">; }[] = [
    { key: "operating" }, { key: "investing" }, { key: "financing" }, { key: "rateEffect" }, { key: "unclassified" },
  ];

  return (
    <Card className="border-[#dce6f0]">
      <CardHeader>
        <CardTitle className="font-display text-xl text-[#18395f]">Laporan Arus Kas</CardTitle>
        <CardDescription>
          Metode langsung · {formatDate(flow.period.from)} — {formatDate(flow.period.to)}. Kas dan setara kas adalah
          1-1110, 1-1120, dan 1-1220; Kas UKA fisik adalah persediaan, bukan kas.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              <tr className="border-b border-[#eef2f7]">
                <td className="px-2 py-2 font-semibold text-[#18395f]">Kas dan setara kas awal periode</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatRupiah(flow.openingCash)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-[#718398]">{formatRupiah(comparative.openingCash)}</td>
              </tr>
              {sections.map(({ key }) => {
                const section = flow[key];
                if (!section.lines.length && key === "unclassified") return null;
                return (
                  <Fragment key={key}>
                    <tr className="bg-[#f5f8fc]">
                      <td className="px-2 py-2 font-semibold text-[#18395f]" colSpan={3}>{section.title}</td>
                    </tr>
                    {section.lines.length ? section.lines.map((line) => (
                      <tr key={line.label} className="border-b border-[#eef2f7]">
                        <td className="px-2 py-2 pl-5 text-[#475569]">
                          {line.label}
                          <span className="ml-2 text-xs text-[#8a99ab]">{line.entryNumbers.slice(0, 3).join(", ")}{line.entryNumbers.length > 3 ? ` +${line.entryNumbers.length - 3}` : ""}</span>
                          {line.reason ? <p className="text-xs text-amber-700">{line.reason}</p> : null}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatRupiah(line.amount)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-[#718398]">—</td>
                      </tr>
                    )) : (
                      <tr className="border-b border-[#eef2f7]"><td className="px-2 py-2 pl-5 text-[#8a99ab]" colSpan={3}>Tidak ada pergerakan</td></tr>
                    )}
                    <tr className="border-b border-[#dce6f0] font-semibold text-[#18395f]">
                      <td className="px-2 py-2 pl-5">Jumlah</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatRupiah(section.total)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-[#718398]">{formatRupiah(comparative[key].total)}</td>
                    </tr>
                  </Fragment>
                );
              })}
              <tr className="border-t-2 border-[#dce6f0] font-bold text-[#18395f]">
                <td className="px-2 py-2">Kas dan setara kas akhir periode</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatRupiah(flow.closingCash)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-[#718398]">{formatRupiah(comparative.closingCash)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          {flow.reconciled ? (
            <Badge className="bg-[#eef6ed] text-[#4d8548] hover:bg-[#eef6ed]"><CheckCircle2 className="mr-1 size-3" />Sejalan dengan pergerakan kas sebenarnya</Badge>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              Arus kas hasil hitungan berbeda {formatRupiah(flow.difference)} dari pergerakan nyata 1-1110, 1-1120, dan 1-1220.
              Telusuri buku besarnya; selisih ini sengaja tidak ditutup dengan pos penyeimbang.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * CALK hibrida: catatan bangkitan tidak dapat diketik, catatan naratif tidak pernah diisikan
 * contohnya. Panduan tiap catatan ditampilkan di samping medannya — yang ditulis di sana adalah
 * pernyataan manajemen, dan mengarangnya berarti menandatanganinya atas nama mereka.
 */
function NotesCard({
  range,
  query,
}: {
  range: { from: string; to: string };
  query: { data: NotesData | undefined; isLoading: boolean; error: { message: string } | null; refetch: () => void };
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [scopes, setScopes] = useState<Record<string, "PERIODE" | "BERLAKU_TERUS">>({});

  const save = trpc.ledger.saveNote.useMutation({
    onSuccess: (result) => {
      toast.success("Catatan tersimpan.");
      setDrafts((current) => ({ ...current, [result.noteKey]: result.bodyText }));
      utils.ledger.notes.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const periodKey = useMemo(() => range.to.slice(0, 7), [range.to]);

  if (query.isLoading) return <Card className="border-[#dce6f0]"><CardContent className="py-8 text-sm text-[#475569]">Menyusun catatan…</CardContent></Card>;
  if (query.error) {
    return <Card className="border-[#dce6f0]"><CardContent className="py-6">
      <p className="text-sm font-semibold text-red-900">Catatan gagal disusun</p>
      <p className="mt-1 text-sm text-red-800">{query.error.message}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}><RefreshCw className="mr-1.5 size-4" />Coba lagi</Button>
    </CardContent></Card>;
  }
  if (!query.data) return null;

  return (
    <Card className="border-[#dce6f0]">
      <CardHeader>
        <CardTitle className="font-display text-xl text-[#18395f]">Catatan atas Laporan Keuangan</CardTitle>
        <CardDescription>
          Catatan yang angkanya diketahui buku besar dibangkitkan dan tidak dapat diketik; kebijakan akuntansi dan
          sejenisnya ditulis sendiri. Angkanya karena itu tidak pernah dapat berselisih dengan laporannya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {query.data.warnings.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <ul className="space-y-1 text-sm text-amber-800">
              {query.data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        ) : null}

        {query.data.notes.map((note, index) => {
          const isOpen = open === note.key;
          const draft = drafts[note.key] ?? ("bodyText" in note ? note.bodyText : "");
          return (
            <div key={note.key} className="rounded-xl border border-[#dce6f0]">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : note.key)}
              >
                {isOpen ? <ChevronDown className="size-4 text-[#475569]" /> : <ChevronRight className="size-4 text-[#475569]" />}
                <span className="font-semibold text-[#18395f]">{index + 1}. {note.title}</span>
                <Badge variant="outline" className="ml-auto border-[#cbd6ed] text-xs text-[#526681]">
                  {note.kind === "BANGKITAN" ? "Dibangkitkan dari buku besar" : "bodyText" in note && note.bodyText ? (note.scope === "PERIODE" ? "Teks periode ini" : "Berlaku terus") : "Belum diisi"}
                </Badge>
              </button>

              {isOpen ? (
                <div className="border-t border-[#eef2f7] px-4 py-3">
                  <p className="mb-3 text-xs leading-5 text-[#718398]">{note.guidance}</p>

                  {note.kind === "BANGKITAN" ? (
                    <>
                      {note.warning ? (
                        <p className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          <ShieldAlert className="mt-0.5 size-4 shrink-0" />{note.warning}
                        </p>
                      ) : null}
                      {note.table.rows.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[560px] text-left text-sm">
                            <thead className="border-b border-[#dce6f0] text-xs uppercase tracking-wide text-[#475569]">
                              <tr>{note.table.columns.map((column) => <th key={column} className="px-2 py-2">{column}</th>)}</tr>
                            </thead>
                            <tbody>
                              {note.table.rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className="border-b border-[#eef2f7]">
                                  {row.map((cell, cellIndex) => (
                                    <td key={cellIndex} className={cellIndex === 0 ? "px-2 py-2 text-[#475569]" : "px-2 py-2 tabular-nums text-[#475569]"}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <EmptyNote text="Tidak ada yang perlu diungkapkan pada rentang ini." />}
                    </>
                  ) : (
                    <>
                      <Textarea
                        className="min-h-32"
                        value={draft}
                        placeholder="Tulis catatan ini sesuai keadaan outlet yang sebenarnya."
                        onChange={(event) => setDrafts((current) => ({ ...current, [note.key]: event.target.value }))}
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-[#183f70] text-white hover:bg-[#12345d]"
                          disabled={save.isPending}
                          onClick={() => save.mutate({ noteKey: note.key, periodKey: scopes[note.key] === "PERIODE" ? periodKey : null, bodyText: draft })}
                        >
                          {save.isPending ? "Menyimpan…" : "Simpan catatan"}
                        </Button>
                        <label className="flex items-center gap-2 text-xs text-[#475569]">
                          <input
                            type="checkbox"
                            checked={scopes[note.key] === "PERIODE"}
                            onChange={(event) => setScopes((current) => ({ ...current, [note.key]: event.target.checked ? "PERIODE" : "BERLAKU_TERUS" }))}
                          />
                          Khusus periode {periodKey} (bukan teks yang berlaku terus)
                        </label>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
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

function EmptyNote({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-4 py-6 text-center text-sm text-[#475569]">{text}</p>;
}
