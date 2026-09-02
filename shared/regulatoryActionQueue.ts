export type RegulatoryActionItem = { id: number; packageNumber: string; status: string; reportType: string; createdAt: Date | string; manualDueAt?: Date | string | null };

/** Zona waktu operasional bawaan bila profil perusahaan belum diisi. GMT+7 (WIB), tanpa DST. */
export const DEFAULT_OPERATIONAL_TIMEZONE = "Asia/Jakarta";

export const OPERATIONAL_TIMEZONES = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta (GMT+7)" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar (GMT+8)" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura (GMT+9)" },
] as const;

export const OPERATIONAL_TIMEZONE_VALUES = OPERATIONAL_TIMEZONES.map((zone) => zone.value) as unknown as [string, ...string[]];

/**
 * Akhir hari kalender di zona waktu operasional, dikembalikan sebagai satu titik waktu absolut.
 *
 * Tenggat disimpan sebagai instant UTC, sedangkan "hari ini" hanya bermakna di zona tempat gerai
 * beroperasi. Server produksi berjalan pada UTC dan peramban petugas pada GMT+7, sehingga
 * `setHours(23,59,59)` memberi jawaban berbeda di dua tempat untuk paket yang sama. Menghitung
 * batas hari secara eksplisit di zona operasional membuat keduanya sepakat.
 */
export function endOfOperationalDay(now: Date, timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE): Date {
  let parts: Record<string, string>;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    parts = Object.fromEntries(formatter.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  } catch {
    // Nama zona tidak dikenal runtime — jatuh kembali ke zona bawaan daripada memakai zona proses.
    if (timeZone === DEFAULT_OPERATIONAL_TIMEZONE) throw new Error(`Zona waktu tidak dikenal: ${timeZone}`);
    return endOfOperationalDay(now, DEFAULT_OPERATIONAL_TIMEZONE);
  }
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const wallClock = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  // Selisih zona terhadap UTC, dihitung pada instant ini agar tetap benar bila zona mengenal DST.
  const offset = wallClock - Math.floor(now.getTime() / 1000) * 1000;
  const endOfDayWallClock = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 23, 59, 59, 999);
  return new Date(endOfDayWallClock - offset);
}

export function getRegulatoryActionQueue(items: RegulatoryActionItem[], now = new Date(), timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE) {
  const draft = items.filter((item) => item.status === "DRAFT");
  const prepared = items.filter((item) => item.status === "PREPARED");
  const returned = items.filter((item) => item.status === "RETURNED");
  const actionable = [...draft, ...prepared, ...returned];
  const overdue = actionable.filter((item) => item.manualDueAt && new Date(item.manualDueAt).getTime() < now.getTime());
  const endOfToday = endOfOperationalDay(now, timeZone);
  const dueToday = actionable.filter((item) => item.manualDueAt && new Date(item.manualDueAt).getTime() >= now.getTime() && new Date(item.manualDueAt).getTime() <= endOfToday.getTime());
  const upcoming = actionable.filter((item) => item.manualDueAt && new Date(item.manualDueAt).getTime() > endOfToday.getTime());
  return { draft, prepared, returned, overdue, dueToday, upcoming, total: actionable.length, hasActions: actionable.length > 0 };
}

export function getRegulatoryReportingReadiness(items: RegulatoryActionItem[], unavailable = false, now = new Date(), timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE) {
  const queue = getRegulatoryActionQueue(items, now, timeZone);
  if (unavailable) return { ready: false, unavailable: true, queue, detail: "Status paket belum tersedia. Buka Pelaporan Regulator untuk pemeriksaan." };
  if (!queue.hasActions) return { ready: true, unavailable: false, queue, detail: "Tidak ada draf atau paket yang menunggu pemeriksaan." };
  const parts = [`${queue.draft.length} draf`, `${queue.prepared.length} paket siap diperiksa`, `${queue.returned.length} paket dikembalikan`];
  const overdue = queue.overdue.length ? ` ${queue.overdue.length} melewati tenggat manual.` : "";
  return { ready: false, unavailable: false, queue, detail: `${parts.join(", ")}.${overdue}` };
}
