import type { KeyboardEvent } from "react";
import { otherDir, type Dir } from "./viewModel";

/** Saklar "Saya mau: jual / beli" (rujukan `.tg`); panah kiri/kanan berpindah pilihan seperti radiogroup. */
export function Toggle({ dir, onChange, labelId, hint }: { dir: Dir; onChange: (dir: Dir) => void; labelId: string; hint?: boolean }) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = otherDir(dir);
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`button[data-v="${next}"]`)?.focus();
  };
  return (
    <div className="tg-wrap">
      <span className="tg-label" id={labelId}>Saya mau:</span>
      <div className="tg" role="radiogroup" aria-labelledby={labelId} data-dir={dir} onKeyDown={onKeyDown}>
        <span className="tg-ink" aria-hidden="true" />
        {(["jual", "beli"] as const).map((value) => (
          <button key={value} type="button" role="radio" aria-checked={dir === value} tabIndex={dir === value ? 0 : -1} data-v={value} onClick={() => onChange(value)}>
            {value === "jual" ? "Saya jual valas" : "Saya beli valas"}
          </button>
        ))}
      </div>
      {hint ? <p className="tg-hint" aria-live="polite">{dir === "jual" ? "Anda menyerahkan valas dan menerima rupiah." : "Anda membeli valas dan membayar rupiah."}</p> : null}
    </div>
  );
}
