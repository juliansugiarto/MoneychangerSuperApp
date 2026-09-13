import { Button } from "@/components/ui/button";
import { useEffect, type ReactNode } from "react";
import { OUTLINE_BUTTON } from "./tebal";

/** Daftar dengan panel detail di samping (≥1280px) — memilih baris tidak meninggalkan daftarnya. */
export function ListDetailLayout({ list, detail, detailTitle, onCloseDetail }: {
  list: ReactNode;
  detail?: ReactNode;
  detailTitle?: string;
  onCloseDetail: () => void;
}) {
  useEffect(() => {
    if (!detail) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseDetail(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail, onCloseDetail]);

  return (
    <div className={detail ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]" : ""}>
      <div className="min-w-0">{list}</div>
      {detail ? (
        <aside aria-label={detailTitle ?? "Detail"} className="min-w-0 rounded-[0.75rem] border-2 border-ink bg-surface-raised shadow-tile">
          <div className="flex h-header items-center justify-between border-b-2 border-ink px-4">
            <p className="font-heading text-body font-extrabold text-ink">{detailTitle}</p>
            <Button variant="outline" size="sm" className={`${OUTLINE_BUTTON} h-control-sm`} onClick={onCloseDetail}>Tutup</Button>
          </div>
          <div className="p-4">{detail}</div>
        </aside>
      ) : null}
    </div>
  );
}
