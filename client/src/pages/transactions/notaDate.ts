import { DEFAULT_OPERATIONAL_TIMEZONE } from "@shared/regulatoryActionQueue";

/**
 * Tanggal nota (SE BI 18/42/DKSP huruf G angka 1 huruf b) menurut zona operasional perusahaan dari
 * Profil Perusahaan. `toLocaleDateString` memakai zona peramban: bon pukul 23.30 WIB yang dicetak dari
 * perangkat berzona lain bisa tertulis tanggal berikutnya.
 */
export function formatNotaDate(at: Date | string, timeZone: string | null | undefined): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "numeric", year: "numeric", timeZone: timeZone || DEFAULT_OPERATIONAL_TIMEZONE }).format(new Date(at));
}
