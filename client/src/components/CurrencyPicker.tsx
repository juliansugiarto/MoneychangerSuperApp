import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { WORLD_CURRENCIES, type WorldCurrency } from "@shared/worldCurrencies";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type PickedCurrency = { id: number; code: string; name: string };

/**
 * Lazy-search currency picker, same interaction pattern as the nasabah search box: type to filter,
 * click a match to select. Backed by the full ISO 4217 list (shared/worldCurrencies.ts), not just
 * whatever happens to already be in the `currencies` table — selecting a currency that doesn't exist
 * yet registers it via `currencies.ensure` (idempotent, no rate involved) before returning it.
 */
export function CurrencyPicker({ onSelect, placeholder = "Ketik kode atau nama mata uang, mis. GBP atau Rupiah", excludeCodes }: { onSelect: (currency: PickedCurrency) => void; placeholder?: string; excludeCodes?: string[] }) {
  const [query, setQuery] = useState("");
  const utils = trpc.useUtils();
  const ensure = trpc.currencies.ensure.useMutation();

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (q.length < 1) return [];
    return WORLD_CURRENCIES.filter((currency) => (currency.code.includes(q) || currency.name.toUpperCase().includes(q)) && !excludeCodes?.includes(currency.code)).slice(0, 8);
  }, [query, excludeCodes]);

  const pick = async (candidate: WorldCurrency) => {
    try {
      const known = utils.currencies.list.getData()?.find((currency) => currency.code === candidate.code);
      const resolved = known ?? (await ensure.mutateAsync({ code: candidate.code, name: candidate.name }));
      if (!known) utils.currencies.list.invalidate();
      onSelect(resolved);
      setQuery("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mata uang gagal didaftarkan.");
    }
  };

  return <div className="relative">
    <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-600" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} /></div>
    {query.trim().length >= 1 ? <div className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border bg-white p-1 shadow-lg">
      {matches.length ? matches.map((currency) => <button key={currency.code} type="button" disabled={ensure.isPending} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50" onClick={() => pick(currency)}><b className="text-[#18395f]">{currency.code}</b><span className="ml-2 text-xs text-slate-600">{currency.name}</span></button>)
        : <div className="p-3 text-sm text-slate-600">Mata uang tidak ditemukan. Coba kode ISO 4217, mis. "GBP".</div>}
    </div> : null}
  </div>;
}
