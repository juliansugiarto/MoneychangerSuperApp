import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BOLD_BUTTON, OUTLINE_BUTTON } from "@/components/patterns/tebal";
import { trpc } from "@/lib/trpc";
import { operationalActionError } from "@/lib/rateActionError";
import { compareCurrencyOrder } from "@shared/currencyOrder";

type Currency = { id: number; code: string; name: string; boardOrder: number | null };

/** "Atur urutan": urutan valuta di papan ini, halaman kurs publik, layar TV, dan pesan WhatsApp. */
export function CurrencyOrderDialog({ currencies, open, onOpenChange }: { currencies: Currency[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const utils = trpc.useUtils();
  const [items, setItems] = useState(() => [...currencies].sort(compareCurrencyOrder));
  const reorder = trpc.currencies.reorder.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.rates.board.invalidate(), utils.rates.activeRates.invalidate(), utils.currencies.list.invalidate()]);
      toast.success("Urutan disimpan. Halaman kurs dan layar TV ikut urutan ini.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(operationalActionError(error)),
  });
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Urutan valuta</DialogTitle>
          <DialogDescription>Urutan ini dipakai di papan kurs, halaman kurs publik, layar TV, dan pesan WhatsApp (4 teratas).</DialogDescription>
        </DialogHeader>
        <ol className="grid max-h-[60vh] gap-1 overflow-y-auto">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2 rounded-lg border-[1.5px] border-line bg-surface-raised px-2 py-1.5">
              <span className="w-6 text-right font-mono text-label text-ink-muted">{index + 1}</span>
              <span className="font-mono font-bold text-ink">{item.code}</span>
              <span className="min-w-0 flex-1 truncate text-label text-ink-muted">{item.name}</span>
              <Button type="button" size="sm" variant="outline" className={`${OUTLINE_BUTTON} h-control-sm`} aria-label={`Naikkan ${item.code}`} disabled={index === 0} onClick={() => move(index, -1)}>Naik</Button>
              <Button type="button" size="sm" variant="outline" className={`${OUTLINE_BUTTON} h-control-sm`} aria-label={`Turunkan ${item.code}`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>Turun</Button>
            </li>
          ))}
        </ol>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="button" className={BOLD_BUTTON} disabled={reorder.isPending || !items.length} onClick={() => reorder.mutate({ currencyIds: items.map((item) => item.id) })}>
            {reorder.isPending ? "Menyimpan…" : "Simpan urutan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
