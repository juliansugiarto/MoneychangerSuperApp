import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/PageStates";
import { formatIdrDecimal } from "@/lib/money";
import { sortPublicRates, type PublicRateRow } from "@shared/publicRates";
import { OTHER_TIER_LABEL } from "@shared/rateTiers";

const effectiveFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function PublicRateTable({ rates, isLoading, isError, onRetry }: { rates: PublicRateRow[]; isLoading: boolean; isError: boolean; onRetry: () => void }) {
  if (isLoading) return <LoadingState rows={5} label="Memuat kurs…" />;
  if (isError) return <ErrorState what="Kurs belum dapat dimuat." nextStep="Tidak ada harga yang ditampilkan sebagai pengganti. Coba lagi sebentar lagi." onRetry={onRetry} />;
  if (!rates.length) return <EmptyState title="Belum ada kurs aktif" nextStep="Kurs hari ini sedang disiapkan. Hubungi outlet untuk memastikan kebutuhan valuta Anda." />;
  return (
    <div className="overflow-x-auto rounded-[0.75rem] border-2 border-ink bg-surface-raised">
      <table className="w-full min-w-[36rem] text-body">
        <caption className="sr-only">Kurs operasional aktif</caption>
        <thead className="border-b-2 border-ink bg-surface-sunken text-label font-extrabold uppercase tracking-wider text-ink-subtle">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">Mata uang</th>
            <th scope="col" className="px-3 py-2 text-right">Kami beli</th>
            <th scope="col" className="px-3 py-2 text-right">Kami jual</th>
            <th scope="col" className="px-3 py-2 text-right">Per</th>
            <th scope="col" className="px-3 py-2 text-left">Berlaku</th>
          </tr>
        </thead>
        <tbody>
          {sortPublicRates(rates).map(({ rate, currency, tier }) => (
            <tr key={rate.id} className="h-row border-b border-line last:border-b-0">
              <th scope="row" className="px-3 py-1.5 text-left font-normal">
                <span className="font-bold text-ink">{currency.code}</span> <span className="text-ink-muted">{currency.name}</span>
                <span className="block text-label text-ink-subtle">{tier ? tier.label : OTHER_TIER_LABEL}</span>
              </th>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{formatIdrDecimal(rate.buyRate)}</td>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{formatIdrDecimal(rate.sellRate)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-ink-muted">{rate.quoteUnit}</td>
              <td className="px-3 py-1.5 text-label text-ink-muted">{effectiveFormat.format(new Date(rate.effectiveAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
