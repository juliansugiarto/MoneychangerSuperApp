/**
 * Urutan valuta yang dipilih pemilik di layar Kurs (keputusan pemilik 12 Nov 2026). Satu pembanding untuk papan
 * staf, halaman publik, /papan, dan pesan WhatsApp, supaya keempatnya tidak pernah berbeda urutan.
 * Valuta tanpa urutan menyusul sesudah yang berurut, menurut abjad kode — sama dengan perilaku sebelumnya.
 */
export type OrderedCurrency = { code: string; boardOrder?: number | null };

export function compareCurrencyOrder(left: OrderedCurrency, right: OrderedCurrency): number {
  const a = left.boardOrder ?? Number.POSITIVE_INFINITY;
  const b = right.boardOrder ?? Number.POSITIVE_INFINITY;
  return a === b ? left.code.localeCompare(right.code) : a - b;
}

/** Penegak bersama layar dan server: daftar lengkap valuta aktif, tanpa ganda, tanpa id asing. */
export function checkCurrencyOrder(requested: readonly number[], activeIds: readonly number[]): { ok: true } | { ok: false; error: string } {
  if (new Set(requested).size !== requested.length) return { ok: false, error: "Ada valuta yang tercantum dua kali. Muat ulang layar, lalu atur lagi." };
  const active = new Set(activeIds);
  if (requested.length !== active.size || requested.some((id) => !active.has(id))) {
    return { ok: false, error: "Daftar valuta berubah sejak layar dibuka. Muat ulang layar, lalu atur lagi." };
  }
  return { ok: true };
}
