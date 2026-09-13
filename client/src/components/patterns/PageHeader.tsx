import type { ReactNode } from "react";

/**
 * Kepala halaman: judul dalam bahasa sehari-hari, istilah resmi BI/PPATK sebagai label kecil di bawahnya
 * (panduan bahasa), deskripsi singkat, dan tindakan halaman di kanan. Huruf judul Konter Tebal pada
 * ukuran judul 20px spec program §2.2.
 */
export function PageHeader({ title, description, officialLabel, actions }: {
  title: string;
  description?: string;
  officialLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
      <div className="min-w-0">
        <h1 className="font-heading text-title font-extrabold tracking-tight text-ink">{title}</h1>
        {officialLabel ? <p className="mt-0.5 text-label font-semibold text-ink-subtle">{officialLabel}</p> : null}
        {description ? <p className="mt-1 max-w-3xl text-body text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
