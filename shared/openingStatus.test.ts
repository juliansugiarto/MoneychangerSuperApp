import { describe, expect, it } from "vitest";
import { checkOpeningSchedule, describeOpeningStatus, openingStatus, scheduleLines, type OpeningSchedule } from "./openingStatus";

const day = { open: "09:00", close: "17:00" };
// Senin–Sabtu 09.00–17.00, Minggu tutup (keputusan pemilik 12 Nov 2026).
const weekdays: OpeningSchedule = [day, day, day, day, day, day, null];
// Kamis 12 November 2026. WIB = UTC+7, jadi 09.00 WIB = 02.00Z.
const wib = (iso: string) => new Date(`${iso}+07:00`);

describe("status buka", () => {
  it("buka di tengah jam kerja, menyebut jam tutup", () => {
    expect(openingStatus(weekdays, wib("2026-11-12T10:15:00"))).toEqual({ state: "OPEN", closesAt: "17:00" });
  });

  it("30 menit terakhir = segera tutup; tepat jam tutup = tutup, buka lagi besok", () => {
    expect(openingStatus(weekdays, wib("2026-11-12T16:30:00")).state).toBe("CLOSING_SOON");
    expect(openingStatus(weekdays, wib("2026-11-12T16:29:00")).state).toBe("OPEN");
    expect(openingStatus(weekdays, wib("2026-11-12T17:00:00"))).toEqual({ state: "CLOSED", next: { dateKey: "2026-11-13", opensAt: "09:00", today: false } });
  });

  it("sebelum buka = buka hari ini", () => {
    expect(openingStatus(weekdays, wib("2026-11-12T07:40:00"))).toEqual({ state: "CLOSED", next: { dateKey: "2026-11-12", opensAt: "09:00", today: true } });
  });

  it("Sabtu sore dan Minggu melompat ke Senin", () => {
    const next = { dateKey: "2026-11-16", opensAt: "09:00", today: false };
    expect(openingStatus(weekdays, wib("2026-11-14T18:00:00"))).toEqual({ state: "CLOSED", next });
    expect(openingStatus(weekdays, wib("2026-11-15T11:00:00"))).toEqual({ state: "CLOSED", next });
  });

  it("dihitung di zona operasional, bukan zona proses: 23.30Z Rabu = Kamis 06.30 WIB", () => {
    expect(openingStatus(weekdays, new Date("2026-11-11T23:30:00Z"))).toEqual({ state: "CLOSED", next: { dateKey: "2026-11-12", opensAt: "09:00", today: true } });
    // Pukul yang sama di WITA (UTC+8) sudah 10.15 → buka.
    expect(openingStatus(weekdays, new Date("2026-11-12T02:15:00Z"), "Asia/Makassar").state).toBe("OPEN");
  });

  it("jadwal kosong tidak ditebak", () => {
    expect(openingStatus(null, wib("2026-11-12T10:00:00"))).toEqual({ state: "UNKNOWN" });
    expect(openingStatus([null, null, null, null, null, null, null], wib("2026-11-12T10:00:00"))).toEqual({ state: "UNKNOWN" });
  });
});

describe("teks status", () => {
  it("memakai kalimat spec teks", () => {
    expect(describeOpeningStatus({ state: "OPEN", closesAt: "17:00" }, "Asia/Jakarta", null)).toMatchObject({ chip: "Buka", detail: "Buka sampai 17.00 WIB." });
    expect(describeOpeningStatus({ state: "CLOSING_SOON", closesAt: "17:00" }, "Asia/Jakarta", null)).toMatchObject({ chip: "Segera tutup", detail: "Tutup pukul 17.00 WIB." });
    expect(describeOpeningStatus({ state: "CLOSED", next: { dateKey: "2026-11-12", opensAt: "09:00", today: true } }, "Asia/Jakarta", null).detail).toBe("Buka hari ini pukul 09.00 WIB.");
    expect(describeOpeningStatus({ state: "CLOSED", next: { dateKey: "2026-11-16", opensAt: "09:00", today: false } }, "Asia/Jakarta", null).detail).toBe("Buka Senin, 16 November pukul 09.00 WIB.");
    expect(describeOpeningStatus({ state: "UNKNOWN" }, "Asia/Jakarta", "(0263) 265-500")).toMatchObject({ chip: "Jam belum tersedia", detail: "Jam buka belum tersedia. Telepon (0263) 265-500 sebelum Anda datang." });
  });
});

describe("baris jadwal", () => {
  it("menggabungkan hari berurutan yang jamnya sama", () => {
    expect(scheduleLines(weekdays)).toEqual(["Senin–Sabtu: 09.00–17.00 WIB", "Minggu: Tutup"]);
    expect(scheduleLines([day, day, day, day, { open: "13:00", close: "17:00" }, day, null])).toEqual([
      "Senin–Kamis: 09.00–17.00 WIB", "Jumat: 13.00–17.00 WIB", "Sabtu: 09.00–17.00 WIB", "Minggu: Tutup",
    ]);
    expect(scheduleLines(null)).toEqual([]);
  });
});

describe("validasi jadwal", () => {
  it("menolak jam tidak lengkap dan tutup sebelum buka; tujuh hari tutup = belum diisi", () => {
    expect(checkOpeningSchedule([...weekdays.slice(0, 6), { open: "9", close: "17:00" }])).toMatchObject({ ok: false, error: expect.stringContaining("Minggu") });
    expect(checkOpeningSchedule([{ open: "17:00", close: "09:00" }, ...weekdays.slice(1)])).toMatchObject({ ok: false, error: "Jam tutup Senin harus sesudah jam bukanya." });
    expect(checkOpeningSchedule(weekdays.slice(0, 6))).toMatchObject({ ok: false });
    expect(checkOpeningSchedule([null, null, null, null, null, null, null])).toEqual({ ok: true, value: null });
    expect(checkOpeningSchedule(weekdays)).toEqual({ ok: true, value: weekdays });
  });
});
