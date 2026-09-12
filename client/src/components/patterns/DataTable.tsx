import type { ReactNode } from "react";

export type Column<Row> = { key: string; header: string; cell: (row: Row) => ReactNode; align?: "left" | "right" };

/** Tabel padat: baris 36px (32px bila `dense`), dipilih dengan klik atau Enter, angka rata kanan. */
export function DataTable<Row>({ columns, rows, rowKey, onSelect, selectedKey = null, dense = false, caption }: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onSelect?: (row: Row) => void;
  selectedKey?: string | null;
  dense?: boolean;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
      <table className="w-full text-body">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-surface-sunken text-label text-ink-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`h-row px-3 font-medium ${column.align === "right" ? "text-right" : "text-left"}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                aria-selected={onSelect ? selected : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onClick={onSelect ? () => onSelect(row) : undefined}
                onKeyDown={onSelect ? (event) => { if (event.key === "Enter") onSelect(row); } : undefined}
                className={`border-t border-line ${dense ? "h-row-dense" : "h-row"} ${onSelect ? "cursor-pointer hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-brand" : ""} ${selected ? "bg-info-soft" : ""}`}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-3 text-ink ${column.align === "right" ? "text-right tabular-nums" : ""}`}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
