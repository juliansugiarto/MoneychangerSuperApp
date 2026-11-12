import { OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAY_NAMES, type OpeningDay, type OpeningSchedule } from "@shared/openingStatus";

/** Satu baris layar per hari. `open === null` berarti hari itu ditandai tutup. */
export type ScheduleDraft = { closed: boolean; open: string; close: string }[];

const BLANK_DAY = { closed: false, open: "", close: "" };

export function toScheduleDraft(schedule: OpeningSchedule | null): ScheduleDraft {
  if (!schedule || schedule.length !== 7) return WEEKDAY_NAMES.map(() => ({ ...BLANK_DAY }));
  return schedule.map((day) => (day ? { closed: false, open: day.open, close: day.close } : { closed: true, open: "", close: "" }));
}

/** Semua baris kosong (belum ada jam maupun tanda tutup) = jadwal belum diisi. */
export function fromScheduleDraft(draft: ScheduleDraft): OpeningSchedule | null {
  if (draft.every((day) => !day.closed && !day.open && !day.close)) return null;
  return draft.map((day): OpeningDay | null => (day.closed ? null : { open: day.open, close: day.close }));
}

export function OpeningScheduleEditor({ draft, onChange }: { draft: ScheduleDraft; onChange: (draft: ScheduleDraft) => void }) {
  const update = (index: number, patch: Partial<ScheduleDraft[number]>) => onChange(draft.map((day, position) => (position === index ? { ...day, ...patch } : day)));
  const copyMonday = () => onChange(draft.map((day, index) => (index === 0 || index === 6 ? day : { ...draft[0] })));

  return (
    <fieldset className="grid gap-2">
      <legend className="text-body font-bold text-ink">Jadwal buka</legend>
      <p className="text-label text-ink-muted">Dipakai untuk tanda Buka atau Tutup di halaman publik, menurut zona waktu outlet.</p>
      <ol className="grid gap-1.5">
        {WEEKDAY_NAMES.map((name, index) => {
          const day = draft[index];
          return (
            <li key={name} className="grid grid-cols-[5.5rem_1fr] items-center gap-2 sm:grid-cols-[5.5rem_auto_auto_auto]">
              <span className="text-body font-semibold text-ink">{name}</span>
              <span className="flex items-center gap-1.5">
                <Checkbox id={`closed-${index}`} aria-label={`${name} tutup`} checked={day.closed} onCheckedChange={(checked) => update(index, { closed: checked === true })} />
                <Label htmlFor={`closed-${index}`}>Tutup</Label>
              </span>
              {!day.closed ? (
                <>
                  <Label className="sr-only" htmlFor={`open-${index}`}>Jam buka {name}</Label>
                  <Input id={`open-${index}`} type="time" className={`${QUIET_FIELD} col-start-2 w-32 sm:col-start-auto`} value={day.open} onChange={(event) => update(index, { open: event.target.value })} />
                  <Label className="sr-only" htmlFor={`close-${index}`}>Jam tutup {name}</Label>
                  <Input id={`close-${index}`} type="time" className={`${QUIET_FIELD} col-start-2 w-32 sm:col-start-auto`} value={day.close} onChange={(event) => update(index, { close: event.target.value })} />
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div>
        <Button type="button" variant="outline" className={OUTLINE_BUTTON} disabled={draft[0].closed || !draft[0].open || !draft[0].close} onClick={copyMonday}>
          Samakan Selasa–Sabtu dengan Senin
        </Button>
      </div>
    </fieldset>
  );
}
