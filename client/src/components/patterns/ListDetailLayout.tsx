import { Button } from "@/components/ui/button";
import { useEffect, type ReactNode } from "react";

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
        <aside aria-label={detailTitle ?? "Detail"} className="min-w-0 rounded-lg border border-line bg-surface-raised">
          <div className="flex h-header items-center justify-between border-b border-line px-4">
            <p className="text-body font-semibold text-ink">{detailTitle}</p>
            <Button variant="ghost" size="sm" onClick={onCloseDetail}>Tutup</Button>
          </div>
          <div className="p-4">{detail}</div>
        </aside>
      ) : null}
    </div>
  );
}
