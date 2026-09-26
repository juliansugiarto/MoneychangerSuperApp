import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ReactNode } from "react";

/**
 * Daftar dengan panel detail yang mengambang dari kanan. Panel dipasang di atas daftar, bukan di
 * sampingnya, supaya memilih baris tidak menggeser atau menyempitkan tata letak halaman (keputusan
 * pengguna 26 September 2026 sesudah melihat layar Pengguna & peran). Esc dan tombol tutup ditangani
 * Radix sebagai satu lapisan, sehingga Esc di dialog yang dibuka dari panel hanya menutup dialog itu.
 */
export function ListDetailLayout({ list, detail, detailTitle, onCloseDetail }: {
  list: ReactNode;
  detail?: ReactNode;
  detailTitle?: string;
  onCloseDetail: () => void;
}) {
  return (
    <>
      <div className="min-w-0">{list}</div>
      <Sheet open={Boolean(detail)} onOpenChange={(open) => { if (!open) onCloseDetail(); }}>
        <SheetContent side="right" aria-describedby={undefined} className="w-full gap-0 border-l-2 border-ink bg-surface-raised p-0 sm:max-w-md">
          <SheetHeader className="h-header justify-center border-b-2 border-ink px-4 py-0 pr-12">
            <SheetTitle className="font-heading text-body font-extrabold text-ink">{detailTitle ?? "Detail"}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{detail}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
