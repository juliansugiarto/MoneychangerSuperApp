import { StatTile } from "@/components/patterns/StatTile";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyTheme } from "@/lib/brandAccent";
import { checkAppearance } from "@shared/companyAppearance";
import { THEME_PALETTES } from "@shared/themePalettes";
import { useEffect, useRef, useState } from "react";

/** Contoh warna satu palet — `applyTheme` pada wadahnya sendiri, supaya berkas ini tidak memuat heks. */
function PaletteSwatch({ paletteId }: { paletteId: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (ref.current) applyTheme(ref.current, paletteId); }, [paletteId]);
  return (
    <span ref={ref} aria-hidden className="flex overflow-hidden rounded-md border-2 border-ink">
      <span className="size-4 bg-paper" /><span className="size-4 bg-brand" /><span className="size-4 bg-second" />
    </span>
  );
}

export function AppearanceSection({ initialPalette, initialAccent, isPending, onSave }: {
  initialPalette: string;
  initialAccent: string | null;
  isPending: boolean;
  onSave: (values: { themePalette: string; accentColor: string | null }) => void;
}) {
  const [palette, setPalette] = useState(initialPalette);
  const [accent, setAccent] = useState(initialAccent ?? "");
  const preview = useRef<HTMLDivElement>(null);
  const result = checkAppearance({ themePalette: palette, accentColor: accent });
  const previewAccent = result.ok ? result.values.accentColor : null;
  useEffect(() => { if (preview.current) applyTheme(preview.current, palette, previewAccent); }, [palette, previewAccent]);

  return (
    <section aria-labelledby="bagian-tampilan" className="rounded-[0.75rem] border-2 border-ink bg-surface-raised p-4">
      <h2 id="bagian-tampilan" className="font-heading text-body font-extrabold text-ink">Tampilan</h2>
      <p className="mt-0.5 text-label text-ink-muted">Dipakai seluruh aplikasi, halaman masuk, dan halaman kurs publik.</p>
      <div role="radiogroup" aria-label="Palet" className="mt-3 flex flex-wrap gap-2">
        {THEME_PALETTES.map((option) => (
          <button key={option.id} type="button" role="radio" aria-checked={option.id === palette} onClick={() => setPalette(option.id)} className={`inline-flex items-center gap-2 ${option.id === palette ? BOLD_BUTTON : OUTLINE_BUTTON}`}>
            <PaletteSwatch paletteId={option.id} />
            {option.name}
          </button>
        ))}
      </div>
      <div className="mt-3 grid max-w-sm gap-1">
        <Label htmlFor="accent-color">Warna utama sendiri</Label>
        <Input id="accent-color" placeholder="Kosongkan untuk memakai warna palet" className={`${QUIET_FIELD} font-mono uppercase`} value={accent} onChange={(event) => setAccent(event.target.value)} />
        {result.ok
          ? <p className="text-label text-ink-subtle">Opsional. Hanya warna yang cukup kontras dengan teks di atasnya (minimal 4,5:1) yang dapat disimpan.</p>
          : <p className="text-label text-danger">{result.error}</p>}
      </div>
      <div ref={preview} data-testid="pratinjau-tampilan" className="mt-3 grid gap-3 rounded-[0.75rem] border-2 border-ink bg-paper p-3 sm:grid-cols-[1fr_auto]">
        <StatTile label="Bon hari ini" value="12" tone="brand" />
        <div className="flex items-end"><Button type="button" className={BOLD_BUTTON} tabIndex={-1}>+ Bon baru</Button></div>
      </div>
      <Button type="button" className={`mt-3 ${BOLD_BUTTON}`} disabled={!result.ok || isPending} onClick={() => { if (result.ok) onSave(result.values); }}>
        {isPending ? "Menyimpan…" : "Simpan tampilan"}
      </Button>
    </section>
  );
}
