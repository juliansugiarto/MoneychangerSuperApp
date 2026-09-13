import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Inbox } from "lucide-react";
import { BOLD_BUTTON, OUTLINE_BUTTON } from "./tebal";

export function LoadingState({ rows = 3, label = "Memuat…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-row w-full rounded-lg bg-surface-sunken" />)}
    </div>
  );
}

/** Keadaan kosong wajib menyebut langkah berikutnya — "Tidak ada data" saja tidak menolong siapa pun. */
export function EmptyState({ title, nextStep, actionLabel, onAction }: {
  title: string;
  nextStep: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-[0.75rem] border-[1.5px] border-dashed border-line-quiet bg-surface-raised px-4 py-8 text-center">
      <Inbox aria-hidden className="mx-auto size-6 text-ink-subtle" />
      <p className="mt-2 text-body font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-body text-ink-muted">{nextStep}</p>
      {actionLabel && onAction ? <Button className={`mt-3 ${BOLD_BUTTON}`} onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}

/** Pesan galat menyebut apa yang terjadi dan apa yang harus dilakukan (panduan bahasa). */
export function ErrorState({ what, nextStep, onRetry }: { what: string; nextStep: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-[0.75rem] border-[1.5px] border-danger/40 bg-danger-soft px-4 py-3">
      <p className="flex items-center gap-2 text-body font-bold text-danger">
        <AlertTriangle aria-hidden className="size-4" />
        {what}
      </p>
      <p className="mt-1 text-body text-ink-muted">{nextStep}</p>
      {onRetry ? <Button variant="outline" className={`mt-2 ${OUTLINE_BUTTON} h-control-sm`} onClick={onRetry}>Coba lagi</Button> : null}
    </div>
  );
}
