import { useId, type ReactNode } from "react";

/**
 * Formulir satu kolom yang dibagi ke bagian bernomor. Bagian kerja: garis tipis (spec 2026-09-13 §A4).
 * Titik tak terlihat menjaga nama aksesibel "2. Data identitas" sementara nomornya tampil sebagai lencana.
 */
export function FormSection({ number, title, description, children }: {
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-b border-line py-4 last:border-b-0">
      <h2 id={headingId} className="flex items-center gap-2 text-body font-bold text-ink">
        <span aria-hidden className="inline-grid size-5 place-items-center rounded-md bg-ink text-label font-extrabold tabular-nums text-paper">{number}</span>
        <span className="sr-only">{number}. </span>{title}
      </h2>
      {description ? <p className="mt-0.5 text-label text-ink-muted">{description}</p> : null}
      <div className="mt-3 grid max-w-2xl gap-3">{children}</div>
    </section>
  );
}

/** Tombol aksi yang menempel di bawah formulir panjang supaya "Simpan" selalu terlihat. */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t-2 border-ink bg-paper px-gutter py-2">
      {children}
    </div>
  );
}
