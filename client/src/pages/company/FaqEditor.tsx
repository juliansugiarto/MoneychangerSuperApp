import { OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PUBLIC_FAQ, PUBLIC_FAQ_LIMIT, type PublicFaqItem } from "@shared/publicPage";

export function FaqEditor({ items, onChange }: { items: PublicFaqItem[]; onChange: (items: PublicFaqItem[]) => void }) {
  const update = (index: number, patch: Partial<PublicFaqItem>) => onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const atLimit = items.length >= PUBLIC_FAQ_LIMIT;

  return (
    <div className="grid gap-2">
      {items.length === 0 ? <p className="text-label text-ink-subtle">Belum ada pertanyaan sendiri — halaman publik memakai {DEFAULT_PUBLIC_FAQ.length} pertanyaan umum bawaan.</p> : null}
      <ol className="grid gap-2">
        {items.map((item, index) => (
          <li key={index} className="grid gap-1 rounded-lg border-[1.5px] border-line bg-surface-raised p-2">
            <Label htmlFor={`faq-question-${index}`}>Pertanyaan {index + 1}</Label>
            <Input id={`faq-question-${index}`} maxLength={200} className={QUIET_FIELD} value={item.question} onChange={(event) => update(index, { question: event.target.value })} />
            <Label htmlFor={`faq-answer-${index}`}>Jawaban {index + 1}</Label>
            <Textarea id={`faq-answer-${index}`} maxLength={1000} rows={2} className={QUIET_FIELD} value={item.answer} onChange={(event) => update(index, { answer: event.target.value })} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className={`${OUTLINE_BUTTON} h-control-sm`} aria-label={`Naikkan pertanyaan ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>Naik</Button>
              <Button type="button" size="sm" variant="outline" className={`${OUTLINE_BUTTON} h-control-sm`} aria-label={`Turunkan pertanyaan ${index + 1}`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>Turun</Button>
              <Button type="button" size="sm" variant="outline" className={`${OUTLINE_BUTTON} h-control-sm text-danger`} aria-label={`Hapus pertanyaan ${index + 1}`} onClick={() => onChange(items.filter((_, position) => position !== index))}>Hapus</Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" className={OUTLINE_BUTTON} disabled={atLimit} onClick={() => onChange([...items, { question: "", answer: "" }])}>Tambah pertanyaan</Button>
        {atLimit ? <p className="text-label text-ink-subtle">Batas {PUBLIC_FAQ_LIMIT} pertanyaan tercapai.</p> : null}
      </div>
    </div>
  );
}
