import { useId, type ReactNode } from "react";

/** Formulir satu kolom yang dibagi ke bagian bernomor. */
export function FormSection({ number, title, description, children }: {
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-b border-line py-4 last:border-b-0">
      <h2 id={headingId} className="text-body font-semibold text-ink">{number}. {title}</h2>
      {description ? <p className="mt-0.5 text-label text-ink-muted">{description}</p> : null}
      <div className="mt-3 grid max-w-2xl gap-3">{children}</div>
    </section>
  );
}

/** Tombol aksi yang menempel di bawah formulir panjang supaya "Simpan" selalu terlihat. */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-line bg-surface-raised px-gutter py-2">
      {children}
    </div>
  );
}
