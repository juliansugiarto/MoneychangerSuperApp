import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { BOLD_BUTTON, OUTLINE_BUTTON } from "./tebal";

export type Step = { id: string; title: string };

/**
 * Alur bertahap bernomor. Tindakan akhir (mis. "Kirim untuk disetujui") disediakan isi langkah terakhir
 * sendiri, karena tiap alur menamai tindakannya berbeda.
 */
export function StepFlow({ steps, currentIndex, onStepChange, canAdvance = true, nextLabel = "Lanjut", backLabel = "Kembali", children }: {
  steps: Step[];
  currentIndex: number;
  onStepChange: (index: number) => void;
  canAdvance?: boolean;
  nextLabel?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;
  return (
    <div className="grid gap-4">
      <ol aria-label="Langkah" className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const tone = index === currentIndex
            ? "border-ink bg-brand text-brand-contrast shadow-hard"
            : index < currentIndex ? "border-transparent text-ink" : "border-transparent text-ink-subtle";
          return (
            <li key={step.id} aria-current={index === currentIndex ? "step" : undefined} className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1 text-label font-bold ${tone}`}>
              <span className="tabular-nums">{index + 1}</span>
              <span>{step.title}</span>
            </li>
          );
        })}
      </ol>
      <div>{children}</div>
      <div className="flex justify-between gap-2 border-t border-line pt-3">
        <Button variant="outline" className={OUTLINE_BUTTON} disabled={isFirst} onClick={() => onStepChange(currentIndex - 1)}>{backLabel}</Button>
        {isLast ? null : <Button className={BOLD_BUTTON} disabled={!canAdvance} onClick={() => onStepChange(currentIndex + 1)}>{nextLabel}</Button>}
      </div>
    </div>
  );
}
