import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { QUIET_FIELD } from "@/components/patterns/tebal";
import { cellChanged, cellKey, editedValue, type BoardCellPayload, type BoardEdits, type RateField } from "@shared/rateBoard";
import { rateDeviationPercent } from "@shared/rateDeviation";

const FIELDS: RateField[] = ["buyRate", "sellRate"];
const fieldLabel = (field: RateField) => (field === "buyRate" ? "Kurs beli" : "Kurs jual");
const angka = (value: string | null) => (value ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value)) : "—");

/** Selisih kurs beli di layar terhadap referensi BI, satu desimal; "—" bila salah satunya belum ada. */
function selisihLabel(cell: BoardCellPayload, edits: BoardEdits): string {
  const buy = editedValue(cell, edits, "buyRate");
  if (!cell.referenceBuyRate || buy === "" || !Number.isFinite(Number(buy))) return "—";
  const percent = rateDeviationPercent(buy, cell.referenceBuyRate);
  if (percent === null) return "—";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Number(percent))}%`;
}

/**
 * Kisi harga: garis tebal dan sorot baris + kolom supaya harga tidak salah dibaca (keputusan pengguna
 * #7). Ini satu-satunya tempat di aplikasi yang memakai garis kisi tebal — intensitas B menenangkan
 * baris tabel, dan papan kurs adalah pengecualiannya yang disebut spec §A4.
 */
export function RateBoardGrid({ cells, edits, onEdit, onCommit }: {
  cells: readonly BoardCellPayload[];
  edits: BoardEdits;
  onEdit: (key: string, field: RateField, value: string) => void;
  onCommit: () => void;
}) {
  const [focus, setFocus] = useState<{ row: number; field: RateField } | null>(null);
  const inputId = (key: string, field: RateField) => `sel-${key}-${field}`;

  const move = (event: KeyboardEvent<HTMLInputElement>, row: number, field: RateField) => {
    if (event.key === "Enter") { event.preventDefault(); onCommit(); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const next = event.key === "ArrowDown" ? row + 1 : row - 1;
    const target = cells[next];
    if (!target) return;
    event.preventDefault();
    document.getElementById(inputId(cellKey(target), field))?.focus();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-2 border-ink text-body">
        <caption className="sr-only">Kurs beli dan jual per valuta dan kelompok pecahan</caption>
        <thead className="bg-ink text-label text-paper">
          <tr>
            {["Valuta", "Kelompok", "Referensi BI", "Beli", "Jual", "Selisih", "Status"].map((header, index) => (
              <th key={header} scope="col" className={`h-[34px] border-2 border-ink px-3 font-bold uppercase tracking-wide ${index >= 2 && index <= 5 ? "text-right" : "text-left"}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((cell, row) => {
            const key = cellKey(cell);
            const changed = cellChanged(cell, edits);
            const highlighted = focus?.row === row;
            return (
              <tr key={key} data-sorot={highlighted ? "baris" : undefined} className={`h-[34px] ${highlighted ? "bg-second/20" : ""}`}>
                <th scope="row" className="border-2 border-ink px-3 text-left font-bold text-ink">{cell.currencyCode}</th>
                <td className="border-2 border-ink px-3 text-ink-muted">{cell.tierLabel}</td>
                <td className="border-2 border-ink px-3 text-right tabular-nums text-ink-muted">{angka(cell.referenceBuyRate)} / {angka(cell.referenceSellRate)}</td>
                {FIELDS.map((field) => {
                  const active = field === "buyRate" ? cell.activeBuyRate : cell.activeSellRate;
                  const value = editedValue(cell, edits, field);
                  const cellChangedHere = value !== "" && active !== null && Number(value) !== Number(active);
                  return (
                    <td key={field} data-sorot={focus?.row === row && focus.field === field ? "sel" : undefined} data-berubah={cellChangedHere ? "ya" : undefined}
                        className={`border-2 border-ink px-2 text-right ${cellChangedHere ? "bg-warning-soft" : ""} ${focus?.field === field ? "outline outline-2 -outline-offset-2 outline-ink" : ""}`}>
                      <Input
                        id={inputId(key, field)} aria-label={`${fieldLabel(field)} ${cell.currencyCode} ${cell.tierLabel}`}
                        inputMode="decimal" value={value} className={`${QUIET_FIELD} h-control-sm text-right tabular-nums`}
                        onFocus={() => setFocus({ row, field })} onBlur={() => setFocus(null)}
                        onKeyDown={(event) => move(event, row, field)}
                        onChange={(event) => onEdit(key, field, event.target.value)}
                      />
                      {cellChangedHere ? <del className="mt-0.5 block text-label text-ink-subtle">{angka(active)}</del> : null}
                    </td>
                  );
                })}
                <td className="border-2 border-ink px-3 text-right tabular-nums text-ink-muted">{selisihLabel(cell, edits)}</td>
                <td className="border-2 border-ink px-3 font-semibold text-ink">{cell.activeRateId ? (changed ? "Berubah" : "Berlaku") : "Belum ada kurs"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
