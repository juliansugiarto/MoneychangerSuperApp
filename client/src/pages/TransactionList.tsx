import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatIdrDecimal } from "@/lib/money";
import { trpc } from "@/lib/trpc";
import { ClipboardList, Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { csvCell, PrintableLine, printBon, transactionStatusClass, transactionStatusLabel } from "./Transactions";

export default function TransactionList() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const { data: transactions, isLoading } = trpc.transactions.list.useQuery(undefined, { enabled: Boolean(user) });
  const { data: companyProfile } = trpc.companyProfile.get.useQuery(undefined, { enabled: Boolean(user) });
  const [listTab, setListTab] = useState<"ALL" | "SELL" | "BUY">("ALL");

  const companyBranding = async () => {
    if (!companyProfile) return null;
    const logoUrl = companyProfile.logoDocumentId ? await utils.documents.downloadUrl.fetch({ documentId: companyProfile.logoDocumentId }).catch(() => null) : null;
    return { tradingName: companyProfile.tradingName, address: companyProfile.address, phone: companyProfile.phone, logoUrl };
  };

  const submit = trpc.transactions.submit.useMutation({
    onSuccess: (result) => {
      utils.transactions.list.invalidate();
      utils.cash.balances.invalidate();
      utils.cash.denominationBalances.invalidate();
      // No review needed: submit auto-completes, so cash/stok are already updated by the time this resolves.
      toast.success(result.status === "COMPLETED" ? "Transaksi selesai — kas dan stok pecahan sudah diperbarui." : "Transaksi dikirim ke alur persetujuan.");
    },
    onError: (error) => toast.error(error.message),
  });
  const cancel = trpc.transactions.cancel.useMutation({ onSuccess: () => utils.transactions.list.invalidate(), onError: (error) => toast.error(error.message) });
  const complete = trpc.transactions.complete.useMutation({ onSuccess: () => { utils.transactions.list.invalidate(); utils.cash.balances.invalidate(); utils.cash.denominationBalances.invalidate(); toast.success("Transaksi selesai — saldo dan stok pecahan sudah diperbarui."); }, onError: (error) => toast.error(error.message) });

  const listRows = useMemo(() => (transactions ?? []).filter((row) => listTab === "ALL" || row.transaction.operation === listTab), [transactions, listTab]);

  /** Each priced denomination group is its own printed/exported row (e.g. USD 100s vs USD 10s at different rates); a line with no denomination rows (very old bons) falls back to its own aggregate figures as one row. */
  const linePrintRows = ({ line, currency, denominations }: NonNullable<typeof transactions>[number]["lines"][number]) => (denominations.length
    ? denominations.map((denomination) => {
      const foreignAmount = Number(denomination.denominationValue) * denomination.quantity;
      const agreedRate = denomination.agreedRate ?? line.agreedRate;
      return { currencyCode: currency.code, foreignAmount: String(foreignAmount), agreedRate: String(agreedRate), rupiahAmount: (foreignAmount * Number(agreedRate) / Number(line.quoteUnit)).toFixed(2) };
    })
    : [{ currencyCode: currency.code, foreignAmount: String(line.foreignAmount), agreedRate: String(line.agreedRate), rupiahAmount: String(line.rupiahAmount) }]);

  const reprint = async (row: NonNullable<typeof transactions>[number]) => {
    const printableLines: PrintableLine[] = row.lines.flatMap(linePrintRows);
    printBon(row.transaction, row.customer, printableLines, await companyBranding());
  };

  const exportCsv = () => {
    const headers = ["No. Transaksi", "No. Kwitansi", "Tanggal", "Nasabah", "CIF", "Jenis", "Mata Uang", "Nominal Valuta", "Kurs", "Nilai Rupiah (baris)", "Cara Bayar", "Status", "Bertindak Sebagai"];
    const rows = listRows.flatMap(({ transaction, customer, lines }) => lines.flatMap(linePrintRows).map((printRow) => [
      transaction.transactionNumber,
      transaction.receiptNumber ?? "-",
      new Date(transaction.transactionAt).toLocaleString("id-ID"),
      customer.fullName,
      customer.cifNumber,
      transaction.operation === "BUY" ? "Transaksi beli" : "Transaksi jual",
      printRow.currencyCode,
      printRow.foreignAmount,
      printRow.agreedRate,
      printRow.rupiahAmount,
      transaction.paymentMethod,
      transactionStatusLabel[transaction.status] ?? transaction.status,
      transaction.customerActingAs === "REPRESENTATIVE" ? `${transaction.representativeName ?? "-"} (kuasa)` : "Nasabah sendiri",
    ]));
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    const suffix = listTab === "ALL" ? "semua" : listTab === "SELL" ? "jual" : "beli";
    anchor.href = url; anchor.download = `transaksi-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <header>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#5c8f53]"><ClipboardList className="size-4" /> Kasir valuta</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-[#18395f]">Daftar transaksi</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#475569]">Pisahkan riwayat transaksi jual dan beli, ekspor detail untuk pelaporan internal, atau cetak ulang kwitansi.</p>
    </header>

    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="text-[#18395f]">Riwayat dan status transaksi</CardTitle><CardDescription>Draft dengan underlying hanya dapat dikirim setelah file tersimpan. Kas dan stok pecahan sudah terpotong/bertambah otomatis begitu transaksi disetujui. Tombol <strong>Selesaikan</strong> hanya muncul untuk transaksi yang tertahan di status "Disetujui" (mis. karena stok sempat kurang) dan perlu diposting ulang secara manual. Gunakan tombol cetak untuk membuka kwitansi.</CardDescription></CardHeader>
      <CardContent>
        <Tabs value={listTab} onValueChange={(value) => setListTab(value as typeof listTab)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList><TabsTrigger value="ALL">Semua</TabsTrigger><TabsTrigger value="SELL">Transaksi jual</TabsTrigger><TabsTrigger value="BUY">Transaksi beli</TabsTrigger></TabsList>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!listRows.length}><Download className="mr-1.5 size-3.5" />Ekspor CSV ({listRows.length})</Button>
          </div>
          <TabsContent value={listTab} className="mt-3">
            <div className="space-y-3">
              {isLoading ? <p className="text-sm text-slate-600">Memuat transaksi…</p> : null}
              {!isLoading && !listRows.length ? <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm leading-6 text-[#475569]">Belum ada transaksi. Buat transaksi baru dari menu <strong>Buat Transaksi</strong>.</div> : null}
              {listRows.map((row) => {
                const { transaction, customer, lines } = row;
                const currencySummary = lines.map(({ line, currency }) => `${String(line.foreignAmount)} ${currency.code}`).join(" + ");
                return <div key={transaction.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <b className="text-[#18395f]">{transaction.receiptNumber ? `No. ${transaction.receiptNumber}` : transaction.transactionNumber}</b>
                      <p className="text-xs text-slate-600">{customer.fullName} · {transaction.operation === "BUY" ? "Transaksi beli" : "Transaksi jual"} · {currencySummary || "Belum ada baris mata uang"}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {transaction.paymentMethod === "CASH" && Number(transaction.rupiahAmount) >= 500000000 ? <Badge className="bg-amber-600 text-white hover:bg-amber-600" title="Memenuhi ambang LTKT (≥ Rp 500 juta tunai) — wajib dilaporkan ke PPATK secara manual sesuai prosedur">LTKT</Badge> : null}
                      <Badge className={transactionStatusClass[transaction.status] ?? "status-inactive"}>{transactionStatusLabel[transaction.status] ?? transaction.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs">{formatIdrDecimal(String(transaction.rupiahAmount))} · {lines.length} baris mata uang</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => reprint(row)}><Printer className="size-3" /></Button>
                    {["DRAFT", "RETURNED"].includes(transaction.status) ? <Button size="sm" variant="outline" onClick={() => submit.mutate({ transactionId: transaction.id })}>Kirim</Button> : null}
                    {transaction.status === "APPROVED" ? <Button size="sm" className="bg-[#183f70]" disabled={complete.isPending} onClick={() => complete.mutate({ transactionId: transaction.id })}>Selesaikan (posting kas &amp; stok)</Button> : null}
                    {!["COMPLETED", "CANCELLED"].includes(transaction.status) ? <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt("Alasan pembatalan:"); if (reason) cancel.mutate({ transactionId: transaction.id, reason }); }}>Batalkan</Button> : null}
                  </div>
                </div>;
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    <Button variant="outline" onClick={() => setLocation("/operasional/transaksi")}>Buat transaksi baru</Button>
  </div>;
}
