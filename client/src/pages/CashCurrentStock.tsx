import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { RefreshCw, Wallet } from "lucide-react";
import { useMemo } from "react";

export default function CashCurrentStock() {
  const { user } = useAuth();
  const balancesQuery = trpc.cash.balances.useQuery(undefined, { enabled: Boolean(user) });
  const denominationBalancesQuery = trpc.cash.denominationBalances.useQuery(undefined, { enabled: Boolean(user) });
  const balances = balancesQuery.data, denominationBalances = denominationBalancesQuery.data;
  const refreshAll = () => Promise.all([balancesQuery.refetch(), denominationBalancesQuery.refetch()]);

  const denominationsByCurrency = useMemo(() => {
    const grouped = new Map<string, typeof denominationBalances>();
    for (const row of denominationBalances ?? []) {
      const existing = grouped.get(row.currency.code) ?? [];
      existing.push(row);
      grouped.set(row.currency.code, existing);
    }
    return grouped;
  }, [denominationBalances]);

  return <div className="mx-auto max-w-5xl space-y-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#5c8f53]"><Wallet className="size-4" /> Kontrol kas harian</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-[#18395f]">Stok saat ini</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#64748b]">Angka sistem berjalan — bertambah/berkurang otomatis saat kas awal, penyesuaian brankas, dan bon yang <strong>diselesaikan</strong>. Cocokkan dengan hitung fisik hanya saat Stock Opname penutupan, bukan sepanjang hari.</p>
      </div>
      <Button variant="outline" className="border-[#d8e5ef]" onClick={refreshAll}><RefreshCw className="mr-2 size-4" /> Muat ulang</Button>
    </section>

    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Saldo per mata uang</CardTitle></CardHeader>
      <CardContent><div className="grid gap-2 sm:grid-cols-2">{balances?.length ? balances.map(({ balance, currency }) => <div key={balance.id} className="flex justify-between rounded-xl bg-[#f6fafc] px-3 py-2 text-sm"><span className="font-semibold text-[#315675]">{currency.code}</span><span className="font-mono text-[#516a81]">{String(balance.availableAmount)}</span></div>) : <p className="text-sm text-[#64748b]">Belum ada saldo kas. Catat kas awal terlebih dahulu.</p>}</div></CardContent>
    </Card>

    <Card className="border-[#dce6f0]">
      <CardHeader><CardTitle className="font-display text-lg text-[#18395f]">Stok pecahan per mata uang</CardTitle><CardDescription>Setiap pecahan wajib tercatat — dari kas awal, penyesuaian brankas, maupun kedua sisi bon (valuta asing dan Rupiah) yang sudah diselesaikan.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {denominationsByCurrency.size ? Array.from(denominationsByCurrency.entries()).map(([code, rows]) => <div key={code}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5c8f53]">{code}</p>
          <div className="grid gap-2 sm:grid-cols-2">{rows?.map(({ balance }) => <div key={balance.id} className="flex justify-between rounded-xl bg-[#f6fafc] px-3 py-2 text-sm"><span className="font-mono text-[#315675]">{String(balance.denominationValue)}</span><span className="font-mono text-[#516a81]">{balance.quantity} lembar/keping</span></div>)}</div>
        </div>) : <p className="text-sm text-[#64748b]">Belum ada rincian pecahan tercatat. Catat kas awal dengan rincian pecahan untuk memulai.</p>}
      </CardContent>
    </Card>
  </div>;
}
