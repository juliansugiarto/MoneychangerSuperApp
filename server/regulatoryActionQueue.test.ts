import { describe, expect, it } from "vitest";
import { DEFAULT_OPERATIONAL_TIMEZONE, endOfOperationalDay, getRegulatoryActionQueue, getRegulatoryReportingReadiness } from "../shared/regulatoryActionQueue";

describe("antrian tindak lanjut paket regulator", () => {
  it("memunculkan draf, paket siap diperiksa, dan paket dikembalikan sebagai tindakan manual", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const queue = getRegulatoryActionQueue([{ id: 1, packageNumber: "LKU-1", reportType: "LKU", status: "DRAFT", createdAt: now }, { id: 2, packageNumber: "LKU-2", reportType: "LKU", status: "PREPARED", createdAt: now }, { id: 3, packageNumber: "LKU-3", reportType: "LKU", status: "RETURNED", createdAt: now, manualDueAt: new Date("2026-08-23T23:59:59.000Z") }, { id: 4, packageNumber: "LKU-4", reportType: "LKU", status: "DRAFT", createdAt: now, manualDueAt: new Date("2026-08-24T23:59:59.000Z") }, { id: 5, packageNumber: "LKU-5", reportType: "LKU", status: "PREPARED", createdAt: now, manualDueAt: new Date("2026-08-25T00:00:00.000Z") }, { id: 6, packageNumber: "LKU-6", reportType: "LKU", status: "APPROVED", createdAt: now }], now, "UTC");
    expect(queue).toMatchObject({ total: 5, hasActions: true });
    expect(queue.draft.map((item) => item.packageNumber)).toEqual(["LKU-1", "LKU-4"]);
    expect(queue.prepared.map((item) => item.packageNumber)).toEqual(["LKU-2", "LKU-5"]);
    expect(queue.returned.map((item) => item.packageNumber)).toEqual(["LKU-3"]);
    expect(queue.overdue.map((item) => item.packageNumber)).toEqual(["LKU-3"]);
    expect(queue.dueToday.map((item) => item.packageNumber)).toEqual(["LKU-4"]);
    expect(queue.upcoming.map((item) => item.packageNumber)).toEqual(["LKU-5"]);
  });

  it("membatasi hari memakai zona operasional, bukan zona proses yang menjalankan kode", () => {
    // 16:59 UTC = 23:59 WIB pada hari yang sama; 17:00 UTC sudah masuk hari berikutnya di Jakarta.
    const now = new Date("2026-08-24T03:00:00.000Z");
    expect(endOfOperationalDay(now, "Asia/Jakarta").toISOString()).toBe("2026-08-24T16:59:59.999Z");
    expect(endOfOperationalDay(now, "Asia/Makassar").toISOString()).toBe("2026-08-24T15:59:59.999Z");
    expect(endOfOperationalDay(now, "UTC").toISOString()).toBe("2026-08-24T23:59:59.999Z");
    // Zona tak dikenal tidak boleh diam-diam memakai zona proses.
    expect(endOfOperationalDay(now, "Mars/Olympus").toISOString()).toBe(endOfOperationalDay(now, DEFAULT_OPERATIONAL_TIMEZONE).toISOString());
  });

  it("menempatkan tenggat 23:59 WIB sebagai jatuh tempo hari ini, bukan mendatang", () => {
    const now = new Date("2026-08-24T03:00:00.000Z"); // 10:00 WIB
    const dueTonightJakarta = new Date("2026-08-24T16:59:00.000Z"); // 23:59 WIB hari yang sama
    const items = [{ id: 1, packageNumber: "LKU-A", reportType: "LKU", status: "DRAFT" as const, createdAt: now, manualDueAt: dueTonightJakarta }];

    const jakarta = getRegulatoryActionQueue(items, now, "Asia/Jakarta");
    expect(jakarta.dueToday.map((item) => item.packageNumber)).toEqual(["LKU-A"]);
    expect(jakarta.upcoming).toEqual([]);

    // Perilaku lama (batas hari memakai UTC di server) menaruhnya di kelompok yang sama di sini,
    // tetapi zona yang lebih timur membuktikan batas hari benar-benar mengikuti zona operasional.
    const jayapura = getRegulatoryActionQueue(items, now, "Asia/Jayapura");
    expect(jayapura.dueToday).toEqual([]);
    expect(jayapura.upcoming.map((item) => item.packageNumber)).toEqual(["LKU-A"]);
  });

  it("menyediakan status kartu pelaporan untuk kondisi siap, tindakan, dan sumber tidak tersedia", () => {
    const completed = [{ id: 1, packageNumber: "LKU-1", reportType: "LKU", status: "EXPORTED", createdAt: new Date() }];
    expect(getRegulatoryReportingReadiness(completed)).toMatchObject({ ready: true, unavailable: false, detail: "Tidak ada draf atau paket yang menunggu pemeriksaan." });
    expect(getRegulatoryReportingReadiness([{ id: 2, packageNumber: "LKU-2", reportType: "LKU", status: "DRAFT", createdAt: new Date() }, { id: 3, packageNumber: "FIN-1", reportType: "FINANCIAL_READINESS", status: "PREPARED", createdAt: new Date() }])).toMatchObject({ ready: false, unavailable: false, detail: "1 draf, 1 paket siap diperiksa, 0 paket dikembalikan." });
    expect(getRegulatoryReportingReadiness([], true)).toMatchObject({ ready: false, unavailable: true, detail: "Status paket belum tersedia. Buka Pelaporan Regulator untuk pemeriksaan." });
  });
});
