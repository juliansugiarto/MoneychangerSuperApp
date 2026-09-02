import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Search } from "lucide-react";
import { useState } from "react";

const listTypeLabels: Record<string, string> = { DTTOT: "DTTOT", PPPSM: "PPPSM" };

/**
 * Inline "Cek sekarang" assist for the DTTOT/PPPSM checkbox on the customer form. Purely a
 * screening aid — it never sets the checkbox itself. Staff still ticks "Cocok DTTOT/PPPSM" and
 * writes notes manually after reviewing whatever this turns up (or finds nothing).
 */
export function WatchlistCheckButton({ name }: { name: string }) {
  const [checkedName, setCheckedName] = useState<string | null>(null);
  const search = trpc.sanctionsWatchlist.search.useQuery({ query: checkedName ?? "" }, { enabled: Boolean(checkedName) });

  const runCheck = () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return;
    setCheckedName(trimmed);
  };

  return <div className="mt-2">
    <Button type="button" size="sm" variant="outline" disabled={name.trim().length < 3} onClick={runCheck} className="border-[#bcd1e5] text-[#315879]"><Search className="mr-1.5 size-3.5" />Cek sekarang di DTTOT/PPPSM</Button>
    {checkedName ? <div className="mt-2">
      {search.isFetching ? <p className="text-xs text-[#718297]">Memeriksa "{checkedName}"…</p> : null}
      {!search.isFetching && search.data ? (
        search.data.length ? <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900"><AlertTriangle className="size-3.5" />{search.data.length} kemungkinan kecocokan untuk "{checkedName}" — periksa manual sebelum memutuskan:</p>
          {search.data.map((match) => <div key={match.id} className="rounded-lg bg-white px-2.5 py-2 text-xs leading-5">
            <span className="font-bold text-[#294866]">{match.fullName}</span>{" "}
            <Badge className="bg-rose-600 text-white hover:bg-rose-600">{listTypeLabels[match.listType] ?? match.listType}{match.sourceLabel ? ` — ${match.sourceLabel}` : ""}</Badge>{" "}
            <span className="text-[#718297]">skor {(match.score * 100).toFixed(0)}%{match.matchedOn !== match.fullName ? ` (alias: ${match.matchedOn})` : ""}</span>
          </div>)}
        </div> : <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">Tidak ada kecocokan dekat untuk "{checkedName}" pada daftar yang sedang dimuat.</p>
      ) : null}
    </div> : null}
  </div>;
}
