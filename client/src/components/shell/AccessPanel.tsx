import { Button } from "@/components/ui/button";
import { LockKeyhole } from "lucide-react";

/** Satu panel untuk belum masuk, wajib ganti sandi, dan kewenangan kurang. */
export function AccessPanel({ title, detail, action, onAction }: { title: string; detail: string; action: string; onAction: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface-raised p-6 text-center">
        <LockKeyhole aria-hidden className="mx-auto size-6 text-ink-subtle" />
        <h1 className="mt-3 text-title font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-body text-ink-muted">{detail}</p>
        <Button onClick={onAction} className="mt-5 h-control w-full bg-brand text-brand-contrast hover:bg-brand/90">{action}</Button>
      </div>
    </div>
  );
}
