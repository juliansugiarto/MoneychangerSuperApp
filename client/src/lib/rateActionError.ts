export function operationalActionError(error: { message?: string }) {
  const message = error.message?.trim() ?? "";
  if (/fetch failed|network|timeout|ETIMEDOUT|DATABASE_UNAVAILABLE|ENOTFOUND/i.test(message)) {
    return "Koneksi layanan sementara tidak tersedia. Tidak ada perubahan kurs yang dicatat; coba lagi beberapa saat.";
  }
  return message || "Tindakan kurs belum dapat diproses. Coba lagi beberapa saat.";
}
