import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";

const MIN_ALASAN = 10;

/** Bilah menempel di bawah papan. Aktivasi kurs selalu menuntut alasan yang dapat ditelusuri — tombolnya mati sampai alasannya cukup panjang, dan itu aturan operasional, bukan sekadar validasi formulir. */
export function RateBoardFooter({ pendingCount, reason, onReasonChange, onDiscard, onActivate, isPending }: {
  pendingCount: number; reason: string; onReasonChange: (value: string) => void;
  onDiscard: () => void; onActivate: () => void; isPending: boolean;
}) {
  if (!pendingCount) return null;
  const tooShort = reason.trim().length < MIN_ALASAN;
  return (
    <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-end gap-3 border-t-2 border-ink bg-surface-raised px-gutter py-3 shadow-hard">
      <p className="font-heading text-body font-extrabold text-ink">{pendingCount} kurs siap diaktifkan</p>
      <div className="min-w-64 flex-1">
        <label className="text-label font-bold uppercase tracking-wide text-ink-muted" htmlFor="alasan-aktivasi">Alasan aktivasi</label>
        <Textarea id="alasan-aktivasi" rows={2} value={reason} onChange={(event) => onReasonChange(event.target.value)}
          className={`${QUIET_FIELD} mt-1`} placeholder="Mis. Kurs pagi 16 September, mengikuti pergerakan referensi BI." />
        {tooShort ? <p className="mt-1 text-label text-ink-muted">Isi alasan minimal {MIN_ALASAN} karakter — alasan ini tersimpan pada setiap kurs yang diaktifkan.</p> : null}
      </div>
      <Button variant="outline" className={OUTLINE_BUTTON} onClick={onDiscard} disabled={isPending}>Buang draf</Button>
      <Button className={BOLD_BUTTON} onClick={onActivate} disabled={tooShort || isPending}>Aktifkan {pendingCount} kurs</Button>
    </div>
  );
}
