import { zoneAbbreviation } from "@shared/openingStatus";
import { useEffect, useState } from "react";

export const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const p2 = (value: number) => String(value).padStart(2, "0");

export type WallClock = { day: number; date: number; mon: number; yr: number; h: number; m: number; s: number };

/** Jam dinding pada zona operasional profil — bukan zona perangkat pengunjung. */
export function wallClock(at: Date, timeZone: string): WallClock {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  }).formatToParts(at).map((part) => [part.type, part.value]));
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
    date: Number(parts.day), mon: Number(parts.month) - 1, yr: Number(parts.year),
    h: Number(parts.hour) % 24, m: Number(parts.minute), s: Number(parts.second),
  };
}

/** "Kamis, 12 November 2026" */
export const longDate = (clock: WallClock) => `${HARI[clock.day]}, ${clock.date} ${BULAN[clock.mon]} ${clock.yr}`;
/** "09.15 WIB" */
export const shortTime = (clock: WallClock, timeZone: string) => `${p2(clock.h)}.${p2(clock.m)} ${zoneAbbreviation(timeZone)}`;

/** Detak satu detik yang berhenti saat tab tersembunyi (DESIGN.md: gerak latar berhenti saat tab tersembunyi). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) setNow(new Date()); }, intervalMs);
    const onVisible = () => { if (!document.hidden) setNow(new Date()); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [intervalMs]);
  return now;
}
