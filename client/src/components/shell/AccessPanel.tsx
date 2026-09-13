import { BOLD_BUTTON } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { LockKeyhole } from "lucide-react";

/** Satu panel untuk belum masuk, wajib ganti sandi, dan kewenangan kurang. */
export function AccessPanel({ title, detail, action, onAction }: { title: string; detail: string; action: string; onAction: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-[0.75rem] border-2 border-ink bg-surface-raised p-6 text-center shadow-tile">
        <LockKeyhole aria-hidden className="mx-auto size-6 text-ink" />
        <h1 className="mt-3 font-heading text-title font-extrabold text-ink">{title}</h1>
        <p className="mt-2 text-body text-ink-muted">{detail}</p>
        <Button onClick={onAction} className={`mt-5 w-full ${BOLD_BUTTON}`}>{action}</Button>
      </div>
    </div>
  );
}
