import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { trpc } from "@/lib/trpc";
import { operationalActionError } from "@/lib/rateActionError";
import { knownDenominationsFor } from "@shared/currencyDenominations";
import { normalizeDenominationValue, type RateTierRow } from "@shared/rateTiers";

const MIN_ALASAN = 10;
const nilaiMuka = (value: string) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value));

type Draft = { tierId?: number; label: string; values: string[]; sortOrder: string };
const EMPTY_DRAFT: Draft = { label: "", values: [], sortOrder: "0" };

/**
 * Kelola kelompok harga pecahan satu valuta. Satu pecahan hanya boleh berada di satu kelompok aktif —
 * penolakannya ditegakkan server; dialog ini hanya menampilkan pesannya.
 */
export function RateTierDialog({ currencyId, currencyCode, tiers, activeTierIds, open, onOpenChange }: {
  currencyId: number;
  currencyCode: string;
  tiers: readonly RateTierRow[];
  /** Kelompok yang sedang punya kurs aktif; menonaktifkannya ikut mencabut kurs itu dan menuntut alasan. */
  activeTierIds: ReadonlySet<number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [retiring, setRetiring] = useState<RateTierRow | null>(null);
  const [reason, setReason] = useState("");
  const refresh = () => Promise.all([utils.rates.board.invalidate(), utils.rates.activeRates.invalidate()]);

  const save = trpc.rateTiers.save.useMutation({
    onSuccess: () => { toast.success("Kelompok pecahan disimpan."); setDraft(EMPTY_DRAFT); refresh(); },
    onError: (error) => toast.error(operationalActionError(error)),
  });
  const deactivate = trpc.rateTiers.deactivate.useMutation({
    onSuccess: () => { toast.success("Kelompok pecahan dinonaktifkan."); setRetiring(null); setReason(""); refresh(); },
    onError: (error) => toast.error(operationalActionError(error)),
  });

  const known = (knownDenominationsFor(currencyCode) ?? []).map((value) => normalizeDenominationValue(value));
  // Nilai muka yang pernah disimpan tetapi tidak ada di katalog tetap harus dapat dicentang ulang.
  const choices = Array.from(new Set([...known, ...draft.values])).sort((left, right) => Number(right) - Number(left));
  const toggle = (value: string) => setDraft((current) => ({
    ...current,
    values: current.values.includes(value) ? current.values.filter((item) => item !== value) : [...current.values, value],
  }));
  const needsReason = retiring ? activeTierIds.has(retiring.id) : false;
  const canSave = draft.label.trim().length > 0 && draft.values.length > 0 && !save.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setDraft(EMPTY_DRAFT); setRetiring(null); setReason(""); } onOpenChange(next); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-title font-extrabold text-ink">Kelompok pecahan {currencyCode}</DialogTitle>
          <DialogDescription className="text-body text-ink-muted">
            Pecahan dalam satu kelompok memakai satu harga. Pecahan yang tidak masuk kelompok mana pun memakai baris "Pecahan lain".
          </DialogDescription>
        </DialogHeader>

        <section aria-label="Kelompok aktif" className="space-y-2">
          {tiers.length ? tiers.map((tier) => (
            <div key={tier.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-ink px-3 py-2">
              <div>
                <p className="font-bold text-ink">{tier.label}</p>
                <p className="text-label text-ink-muted">Pecahan {tier.denominationValues.map(nilaiMuka).join(" · ")} · urutan {tier.sortOrder}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className={OUTLINE_BUTTON}
                  onClick={() => { setRetiring(null); setDraft({ tierId: tier.id, label: tier.label, values: tier.denominationValues.map((value) => normalizeDenominationValue(value)), sortOrder: String(tier.sortOrder) }); }}>
                  Ubah
                </Button>
                <Button variant="outline" className={OUTLINE_BUTTON} onClick={() => { setDraft(EMPTY_DRAFT); setRetiring(tier); setReason(""); }}>Nonaktifkan</Button>
              </div>
            </div>
          )) : <p className="text-body text-ink-muted">Belum ada kelompok. Seluruh pecahan {currencyCode} memakai satu harga sampai Anda menambahkan kelompok.</p>}
        </section>

        {retiring ? (
          <section aria-label="Nonaktifkan kelompok" className="space-y-2 rounded-lg border-2 border-ink bg-warning-soft p-3">
            <p className="font-bold text-ink">Nonaktifkan kelompok "{retiring.label}"?</p>
            {needsReason ? (
              <>
                <p className="text-body text-ink">Kelompok ini masih punya kurs aktif. Kurs itu ikut dinonaktifkan, dan pecahannya kembali memakai harga "Pecahan lain".</p>
                <Label htmlFor="alasan-nonaktif" className="text-label font-bold uppercase tracking-wide text-ink-muted">Alasan</Label>
                <Textarea id="alasan-nonaktif" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} className={QUIET_FIELD}
                  placeholder="Mis. USD 50 kini dihargai sama dengan pecahan lain." />
              </>
            ) : <p className="text-body text-ink">Kelompok ini belum punya kurs aktif.</p>}
            <div className="flex gap-2">
              <Button variant="outline" className={OUTLINE_BUTTON} onClick={() => setRetiring(null)}>Batal</Button>
              <Button className={BOLD_BUTTON} disabled={deactivate.isPending || (needsReason && reason.trim().length < MIN_ALASAN)}
                onClick={() => deactivate.mutate({ tierId: retiring.id, reason: reason.trim() })}>
                Nonaktifkan kelompok
              </Button>
            </div>
          </section>
        ) : null}

        <form className="space-y-3 border-t-2 border-ink pt-3" onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          save.mutate({ tierId: draft.tierId, currencyId, label: draft.label.trim(), denominationValues: draft.values, sortOrder: Number(draft.sortOrder) || 0 });
        }}>
          <p className="font-bold text-ink">{draft.tierId ? `Ubah kelompok "${draft.label}"` : "Tambah kelompok"}</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div>
              <Label htmlFor="label-kelompok" className="text-label font-bold uppercase tracking-wide text-ink-muted">Nama kelompok</Label>
              <Input id="label-kelompok" value={draft.label} maxLength={40} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className={`${QUIET_FIELD} mt-1`} placeholder="Mis. 100 atau 5–20" />
            </div>
            <div>
              <Label htmlFor="urutan-kelompok" className="text-label font-bold uppercase tracking-wide text-ink-muted">Urutan</Label>
              <Input id="urutan-kelompok" inputMode="numeric" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} className={`${QUIET_FIELD} mt-1`} />
            </div>
          </div>
          <fieldset>
            <legend className="text-label font-bold uppercase tracking-wide text-ink-muted">Pecahan dalam kelompok</legend>
            {choices.length ? (
              <div className="mt-1 flex flex-wrap gap-3">
                {choices.map((value) => (
                  <label key={value} className="flex items-center gap-1.5 text-body text-ink">
                    <Checkbox checked={draft.values.includes(value)} onCheckedChange={() => toggle(value)} aria-label={`Pecahan ${nilaiMuka(value)}`} />
                    {nilaiMuka(value)}
                  </label>
                ))}
              </div>
            ) : <p className="mt-1 text-body text-ink-muted">Katalog pecahan {currencyCode} belum tersedia, jadi kelompok belum dapat dibuat untuk valuta ini.</p>}
          </fieldset>
          <div className="flex gap-2">
            {draft.tierId ? <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={() => setDraft(EMPTY_DRAFT)}>Batal ubah</Button> : null}
            <Button type="submit" className={BOLD_BUTTON} disabled={!canSave}>{save.isPending ? "Menyimpan…" : "Simpan kelompok"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
