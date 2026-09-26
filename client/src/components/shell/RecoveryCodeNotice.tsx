import { BOLD_BUTTON } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import type { BackOfficeRole } from "@shared/backOfficeNavigation";

/** Pada jumlah ini atau kurang, pemilik diajak membuat kode baru sebelum habis. */
export const RECOVERY_CODE_LOW_WATERMARK = 2;

/**
 * Ajakan di atas isi shell. Pemilik produksi dibuat dari .env sebelum sub-proyek 2 dan karena itu
 * belum punya kode sama sekali; ajakan inilah jalan satu-satunya ia mendapatkannya.
 */
export function RecoveryCodeNotice({ role, remaining, onOpen }: { role: BackOfficeRole; remaining: number | null; onOpen: () => void }) {
  if (role !== "SHAREHOLDER" || remaining === null || remaining > RECOVERY_CODE_LOW_WATERMARK) return null;
  const message = remaining === 0
    ? "Anda belum punya kode pemulihan. Tanpanya, kata sandi pemilik yang terlupa tidak dapat dipulihkan dari aplikasi."
    : `Tinggal ${remaining} kode pemulihan. Buat yang baru sebelum habis.`;
  return (
    <div role="status" className="mx-gutter mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-ink bg-warning-soft px-3 py-2">
      <p className="text-body font-semibold text-ink">{message}</p>
      <Button className={BOLD_BUTTON} onClick={onOpen}>Buat kode pemulihan</Button>
    </div>
  );
}
