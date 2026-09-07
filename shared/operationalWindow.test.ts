import { describe, expect, it } from "vitest";
import { startOfOperationalDay, startOfNextOperationalDay, startOfOperationalMonth, startOfNextOperationalMonth } from "./regulatoryActionQueue";

/**
 * Batas hari dan bulan operasional sebagai titik waktu absolut.
 *
 * `jakartaBusinessDate` mengembalikan penanda **tanggal** — tengah malam UTC yang mewakili satu hari
 * WIB — dan itu benar untuk kolom `date`. Ia **bukan** batas instan, dan memakainya untuk membatasi
 * kolom `datetime` seperti `transactionAt` menggeser jendelanya tujuh jam: transaksi pukul 02:00 WIB
 * jatuh di luar hari bisnisnya sendiri.
 *
 * Seluruh harapan di sini dinyatakan sebagai instant UTC, sehingga ujinya benar pada zona waktu
 * proses mana pun — termasuk mesin pengembangan WIB dan server produksi UTC.
 */

// Pukul 02:00 WIB pada 1 September 2026.
const DINI_HARI_WIB = new Date("2026-08-31T19:00:00Z");

describe("awal hari operasional", () => {
  it("mengembalikan instan saat hari WIB dimulai, bukan tengah malam UTC", () => {
    // Hari WIB 1 September 2026 dimulai pukul 17:00 UTC pada 31 Agustus.
    expect(startOfOperationalDay(DINI_HARI_WIB).toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("memasukkan transaksi dini hari ke dalam hari bisnisnya sendiri", () => {
    expect(DINI_HARI_WIB.getTime()).toBeGreaterThanOrEqual(startOfOperationalDay(DINI_HARI_WIB).getTime());
  });

  it("memakai zona operasional lain apa adanya", () => {
    // WITA GMT+8: hari dimulai pukul 16:00 UTC hari sebelumnya.
    expect(startOfOperationalDay(new Date("2026-09-01T05:00:00Z"), "Asia/Makassar").toISOString()).toBe("2026-08-31T16:00:00.000Z");
    // WIT GMT+9.
    expect(startOfOperationalDay(new Date("2026-09-01T05:00:00Z"), "Asia/Jayapura").toISOString()).toBe("2026-08-31T15:00:00.000Z");
  });

  it("jatuh kembali ke zona bawaan bila zonanya tidak dikenal runtime", () => {
    expect(startOfOperationalDay(DINI_HARI_WIB, "Mars/Olympus").toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("tetap pada hari yang sama untuk instan di tengah hari kerja", () => {
    // Pukul 14:00 WIB 1 September = 07:00 UTC.
    expect(startOfOperationalDay(new Date("2026-09-01T07:00:00Z")).toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });
});

describe("awal bulan operasional", () => {
  it("mengembalikan instan saat bulan WIB dimulai", () => {
    expect(startOfOperationalMonth(DINI_HARI_WIB).toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("memasukkan transaksi dini hari tanggal satu ke dalam bulannya sendiri", () => {
    const mulai = startOfOperationalMonth(DINI_HARI_WIB);
    const berikutnya = startOfNextOperationalMonth(DINI_HARI_WIB);
    expect(DINI_HARI_WIB.getTime()).toBeGreaterThanOrEqual(mulai.getTime());
    expect(DINI_HARI_WIB.getTime()).toBeLessThan(berikutnya.getTime());
  });

  it("menghitung bulan berikutnya melewati pergantian tahun", () => {
    // Pukul 10:00 WIB 15 Desember 2026 = 03:00 UTC.
    const desember = new Date("2026-12-15T03:00:00Z");
    expect(startOfOperationalMonth(desember).toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(startOfNextOperationalMonth(desember).toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("tidak pernah menempatkan awal bulan sesudah instannya sendiri", () => {
    for (const iso of ["2026-01-01T00:00:00Z", "2026-06-30T17:00:00Z", "2026-12-31T16:59:59Z"]) {
      const now = new Date(iso);
      expect(startOfOperationalMonth(now).getTime(), iso).toBeLessThanOrEqual(now.getTime());
      expect(startOfNextOperationalMonth(now).getTime(), iso).toBeGreaterThan(now.getTime());
    }
  });
});

describe("awal hari berikutnya", () => {
  it("menutup jendela harian tepat saat hari WIB berikutnya dimulai", () => {
    expect(startOfNextOperationalDay(DINI_HARI_WIB).toISOString()).toBe("2026-09-01T17:00:00.000Z");
  });

  it("melewati pergantian bulan dan tahun", () => {
    expect(startOfNextOperationalDay(new Date("2026-09-30T10:00:00Z")).toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(startOfNextOperationalDay(new Date("2026-12-31T10:00:00Z")).toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("selalu tepat sehari sesudah awal harinya pada zona tanpa DST", () => {
    const now = new Date("2026-09-01T03:00:00Z");
    expect(startOfNextOperationalDay(now).getTime() - startOfOperationalDay(now).getTime()).toBe(86_400_000);
  });
});
