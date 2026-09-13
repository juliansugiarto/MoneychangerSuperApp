import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { OUTLINE_BUTTON } from "./tebal";

/** Laporan: filter dan ekspor di atas, angka ringkas, lalu tabelnya. */
export function ReportLayout({ filters, summary, table, onExport, exportLabel = "Ekspor" }: {
  filters?: ReactNode;
  summary?: ReactNode;
  table: ReactNode;
  onExport?: () => void;
  exportLabel?: string;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">{filters}</div>
        {onExport ? <Button variant="outline" className={OUTLINE_BUTTON} onClick={onExport}>{exportLabel}</Button> : null}
      </div>
      {summary ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary}</div> : null}
      {table}
    </div>
  );
}
