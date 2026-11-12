import { DEFAULT_OPERATIONAL_TIMEZONE, operationalDateKey, startOfOperationalDay } from "./regulatoryActionQueue";

/**
 * Jadwal buka terstruktur outlet (spec halaman publik 2026-11-12 §1/§5) dan status "Buka sekarang".
 *
 * Tujuh hari, **Senin lebih dulu** (indeks 0 = Senin … 6 = Minggu). `null` pada satu hari = tutup
 * sepanjang hari itu; seluruh jadwal `null` = jadwal belum diisi, dan halaman tidak boleh menebak.
 * Jam dibaca pada zona operasional profil (bawaan WIB), bukan zona perangkat pengunjung.
 */
export type OpeningDay = { open: string; close: string };
export type OpeningSchedule = (OpeningDay | null)[];

export const WEEKDAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;
export const CLOSING_SOON_MINUTES = 30;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function timeToMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Penegak bersama layar dan server. Jam tutup lewat tengah malam sengaja tidak didukung. */
export function checkOpeningSchedule(schedule: OpeningSchedule | null): { ok: true; value: OpeningSchedule | null } | { ok: false; error: string } {
  if (schedule === null) return { ok: true, value: null };
  if (schedule.length !== 7) return { ok: false, error: "Jadwal harus berisi tujuh hari, Senin sampai Minggu." };
  for (const [index, day] of schedule.entries()) {
    if (!day) continue;
    const open = timeToMinutes(day.open);
    const close = timeToMinutes(day.close);
    if (open === null || close === null) return { ok: false, error: `Jam ${WEEKDAY_NAMES[index]} belum lengkap. Isi jam buka dan tutup, atau tandai tutup.` };
    if (close <= open) return { ok: false, error: `Jam tutup ${WEEKDAY_NAMES[index]} harus sesudah jam bukanya.` };
  }
  // Tujuh hari tutup bukan jadwal; simpan sebagai "belum diisi" supaya halaman tidak menulis "Tutup" selamanya.
  return { ok: true, value: schedule.some(Boolean) ? schedule.map((day) => (day ? { open: day.open, close: day.close } : null)) : null };
}

export type OpeningStatus =
  | { state: "UNKNOWN" }
  | { state: "OPEN" | "CLOSING_SOON"; closesAt: string }
  | { state: "CLOSED"; next: { dateKey: string; opensAt: string; today: boolean } | null };

/** Indeks Senin-dulu untuk kunci tanggal `YYYY-MM-DD`. */
function weekdayIndex(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function openingStatus(schedule: OpeningSchedule | null | undefined, now: Date, timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE): OpeningStatus {
  if (!schedule || schedule.length !== 7 || !schedule.some(Boolean)) return { state: "UNKNOWN" };
  const todayKey = operationalDateKey(now, timeZone);
  const minutesNow = Math.floor((now.getTime() - startOfOperationalDay(now, timeZone).getTime()) / 60_000);
  const today = schedule[weekdayIndex(todayKey)];
  if (today) {
    const open = timeToMinutes(today.open)!;
    const close = timeToMinutes(today.close)!;
    if (minutesNow >= open && minutesNow < close) {
      return { state: close - minutesNow <= CLOSING_SOON_MINUTES ? "CLOSING_SOON" : "OPEN", closesAt: today.close };
    }
    if (minutesNow < open) return { state: "CLOSED", next: { dateKey: todayKey, opensAt: today.open, today: true } };
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const key = addDays(todayKey, offset);
    const day = schedule[weekdayIndex(key)];
    if (day) return { state: "CLOSED", next: { dateKey: key, opensAt: day.open, today: false } };
  }
  return { state: "CLOSED", next: null };
}

const ZONE_ABBREVIATIONS: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Pontianak": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" };

export function zoneAbbreviation(timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE): string {
  return ZONE_ABBREVIATIONS[timeZone] ?? "WIB";
}

/** "09:00" → "09.00 WIB" (penulisan jam Indonesia). */
export function formatClock(value: string, timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE): string {
  return `${value.replace(":", ".")} ${zoneAbbreviation(timeZone)}`;
}

const dateKeyFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** "2026-11-16" → "Senin, 16 November". Kunci sudah tanggal operasional, jadi dibaca sebagai UTC. */
export function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return dateKeyFormat.format(new Date(Date.UTC(year, month - 1, day)));
}

export type OpeningStatusText = { chip: string; detail: string; tone: "open" | "soon" | "closed" | "unknown" };

/** Teks chip + penjelas (spec teks §Kepala halaman). `phone` dipakai bila jadwal tidak diketahui. */
export function describeOpeningStatus(status: OpeningStatus, timeZone: string, phone: string | null): OpeningStatusText {
  const unknownDetail = phone ? `Jam buka belum tersedia. Telepon ${phone} sebelum Anda datang.` : "Jam buka belum tersedia.";
  switch (status.state) {
    case "OPEN": return { chip: "Buka", detail: `Buka sampai ${formatClock(status.closesAt, timeZone)}.`, tone: "open" };
    case "CLOSING_SOON": return { chip: "Segera tutup", detail: `Tutup pukul ${formatClock(status.closesAt, timeZone)}.`, tone: "soon" };
    case "CLOSED":
      if (!status.next) return { chip: "Tutup", detail: unknownDetail, tone: "closed" };
      return {
        chip: "Tutup",
        detail: status.next.today
          ? `Buka hari ini pukul ${formatClock(status.next.opensAt, timeZone)}.`
          : `Buka ${formatDateKey(status.next.dateKey)} pukul ${formatClock(status.next.opensAt, timeZone)}.`,
        tone: "closed",
      };
    default: return { chip: "Jam belum tersedia", detail: unknownDetail, tone: "unknown" };
  }
}

/** Baris jadwal ringkas: hari berurutan dengan jam sama digabung. "Senin–Sabtu: 09.00–17.00 WIB · Minggu: Tutup". */
export function scheduleLines(schedule: OpeningSchedule | null | undefined, timeZone: string = DEFAULT_OPERATIONAL_TIMEZONE): string[] {
  if (!schedule || schedule.length !== 7 || !schedule.some(Boolean)) return [];
  const label = (day: OpeningDay | null) => (day ? `${day.open.replace(":", ".")}–${day.close.replace(":", ".")} ${zoneAbbreviation(timeZone)}` : "Tutup");
  const lines: string[] = [];
  let start = 0;
  for (let index = 1; index <= 7; index += 1) {
    if (index < 7 && label(schedule[index]) === label(schedule[start])) continue;
    const days = start === index - 1 ? WEEKDAY_NAMES[start] : `${WEEKDAY_NAMES[start]}–${WEEKDAY_NAMES[index - 1]}`;
    lines.push(`${days}: ${label(schedule[start])}`);
    start = index;
  }
  return lines;
}
