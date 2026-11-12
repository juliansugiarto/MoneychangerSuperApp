import { describe, expect, it } from "vitest";
import { calendarDay, isoDay } from "../shared/ledger";
import { operationalEntryDate, operationalPostingWindow } from "./ledgerPosting";

/**
 * Pembukuan berhari WIB, server berjam UTC. Bon pukul 05.00 WIB tanggal 1 Oktober adalah 30 September
 * 22.00 UTC — jurnalnya tetap harus bertanggal 1 Oktober (periode Oktober), dan masuk jendela 1 Oktober.
 * Uji ini juga dijalankan dengan TZ=UTC (lihat perintah verifikasi di commit) agar sama di kedua mesin.
 */
const earlyMorningBon = new Date("2026-09-30T22:00:00Z");

describe("tanggal jurnal dan jendela penjurnalan memakai hari WIB", () => {
  it("bon dini hari WIB dijurnal pada hari WIB-nya, dibaca sama oleh isoDay maupun calendarDay", () => {
    const entryDate = operationalEntryDate(earlyMorningBon);
    expect(isoDay(entryDate)).toBe("2026-10-01");
    expect(calendarDay(entryDate)).toBe("2026-10-01");
  });

  it("jendela satu hari mencakup 00.00–23.59 WIB, bukan hari UTC", () => {
    const window = operationalPostingWindow({ from: new Date("2026-10-01"), to: new Date("2026-10-01") });
    expect(window.start.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-10-01T17:00:00.000Z");
    expect(earlyMorningBon >= window.start && earlyMorningBon < window.end).toBe(true);
  });
});
