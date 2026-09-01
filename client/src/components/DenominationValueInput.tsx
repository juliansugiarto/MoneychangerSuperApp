import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPlainAmount } from "@/lib/money";
import { knownDenominationsFor } from "@shared/currencyDenominations";
import { CircleAlert } from "lucide-react";

/**
 * "Nilai pecahan" input, locked to real banknote/coin face values when we know them for the
 * currency — a dropdown, not free text, so a typo like "IDR 131250000 × 1 lembar" (not a real
 * note) is structurally impossible to enter. Falls back to free text with a visible warning only
 * for currencies we don't have curated denomination data for; the server validates the same list
 * either way, so this is a UX guardrail, not the only line of defense.
 */
export function DenominationValueInput({ currencyCode, value, onChange }: { currencyCode: string | undefined; value: string; onChange: (value: string) => void }) {
  const known = knownDenominationsFor(currencyCode);
  if (known) {
    return <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih pecahan" /></SelectTrigger>
      <SelectContent>{known.map((denomination) => <SelectItem key={denomination} value={String(denomination)}>{formatPlainAmount(denomination)}</SelectItem>)}</SelectContent>
    </Select>;
  }
  return <div>
    <Input required inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Nilai pecahan" />
    <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700"><CircleAlert className="size-3 shrink-0" />Belum ada daftar pecahan baku untuk {currencyCode ?? "mata uang ini"} — pastikan nilainya benar secara manual.</p>
  </div>;
}
