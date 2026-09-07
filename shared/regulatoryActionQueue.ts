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

/**
 * Bagian tanggal-jam sebuah instan menurut zona operasional, beserta selisih zona terhadap UTC.
 *
 * Zona yang tidak dikenal runtime jatuh kembali ke zona bawaan, bukan ke zona proses — zona proses
 * berbeda antara server produksi (UTC) dan mesin pengembangan (GMT+7), dan memakainya justru
 * menghidupkan kembali kekeliruan yang helper ini ada untuk mencegahnya.
 */
function operationalParts(now: Date, timeZone: string): { year: number; month: number; day: number; offset: number } {
  let parts: Record<string, string>;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    parts = Object.fromEntries(formatter.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  } catch {
    if (timeZone === DEFAULT_OPERATIONAL_TIMEZONE) throw new Error(`Zona waktu tidak dikenal: ${timeZone}`);
    return operationalParts(now, DEFAULT_OPERATIONAL_TIMEZONE);
  }
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const wallClock = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    offset: wallClock - Math.floor(now.getTime() / 1000) * 1000,
  };
}

/**
 * Instan saat sebuah tengah malam zona operasional terjadi.
 *
 * Selisih zona dihitung dua kali: sekali pada instan masukannya, lalu sekali lagi pada tebakan
 * hasilnya. Zona Indonesia tidak mengenal DST sehingga sekali pun cukup, tetapi tebakan yang
 * melintasi pergantian DST pada zona lain akan meleset satu jam tanpa langkah kedua ini.
 */
function operationalMidnight(now: Date, timeZone: string, year: number, month: number, day: number): Date {
  const wallClock = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const guess = new Date(wallClock - operationalParts(now, timeZone).offset);
  return new Date(wallClock - operationalParts(guess, timeZone).offset);
}

/**
 * Awal hari kalender di zona waktu operasional, sebagai satu titik waktu absolut.
 *
 * Pasangan `endOfOperationalDay`, dan **bukan** pengganti `jakartaBusinessDate`: yang terakhir
 * mengembalikan penanda tanggal untuk kolom `date`, sedangkan fungsi ini mengembalikan instan untuk
 * membatasi kolom `datetime`. Memakai penanda tanggal sebagai batas instan menggeser jendelanya
 * sebesar selisih zona — transaksi pukul 02:00 WIB jatuh di luar hari bisnisnya sendiri.
 */
export function startOfOperationalDay(now: Date, timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE): Date {
  const { year, month, day } = operationalParts(now, timeZone);
  return operationalMidnight(now, timeZone, year, month, day);
}

/**
 * Awal hari operasional berikutnya; batas atas eksklusif sebuah jendela harian.
 *
 * Dihitung dari tanggalnya, bukan dengan menambah 24 jam: pada zona ber-DST sebuah hari dapat
 * sepanjang 23 atau 25 jam.
 */
export function startOfNextOperationalDay(now: Date, timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE): Date {
  const { year, month, day } = operationalParts(now, timeZone);
  return operationalMidnight(now, timeZone, year, month, day + 1);
}

/** Awal bulan kalender di zona waktu operasional, sebagai satu titik waktu absolut. */
export function startOfOperationalMonth(now: Date, timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE): Date {
  const { year, month } = operationalParts(now, timeZone);
  return operationalMidnight(now, timeZone, year, month, 1);
}

/** Awal bulan berikutnya di zona waktu operasional; batas atas eksklusif sebuah jendela bulanan. */
export function startOfNextOperationalMonth(now: Date, timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE): Date {
  const { year, month } = operationalParts(now, timeZone);
  return operationalMidnight(now, timeZone, month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1);
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
