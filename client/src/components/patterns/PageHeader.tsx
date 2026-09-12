import type { ReactNode } from "react";

/**
 * Kepala halaman: judul dalam bahasa sehari-hari, istilah resmi BI/PPATK sebagai label kecil di
 * bawahnya (panduan bahasa), deskripsi singkat, dan tindakan halaman di kanan.
 */
export function PageHeader({ title, description, officialLabel, actions }: {
  title: string;
  description?: string;
  officialLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
      <div className="min-w-0">
        <h1 className="text-title font-semibold text-ink">{title}</h1>
        {officialLabel ? <p className="mt-0.5 text-label text-ink-subtle">{officialLabel}</p> : null}
        {description ? <p className="mt-1 max-w-3xl text-body text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
