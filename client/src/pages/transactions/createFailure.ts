/**
 * Bon yang ditolak server. Server menilai toleransi terhadap kurs papan SAAT SIMPAN, sedangkan
 * formulir menilai dari `rates.pricing` yang mungkin sudah basi; bila keduanya berbeda, formulir
 * tidak menampilkan kolom alasan selisih. Memuat ulang harga papan menyamakan keduanya seketika.
 */
export function handleCreateFailure(error: { message: string }, deps: { notify: (message: string) => void; invalidatePricing: () => unknown }) {
  deps.notify(error.message);
  void deps.invalidatePricing();
}
