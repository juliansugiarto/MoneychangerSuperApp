import { describe, expect, it } from "vitest";
import { MONITORED_ACTIVITY_STATUSES, buildMonitoringWorklist, foldMonthlyActivity, operationalMonthWindow } from "./customerProfileMonitoring";

/**
 * Jendela bulanan WIB dan pembacaan aktivitas nyata nasabah.
 *
 * Seluruh harapan waktu dinyatakan sebagai instan UTC, sehingga ujinya benar pada zona waktu proses
 * mana pun — mesin pengembangan WIB maupun server produksi UTC.
 */

// Pukul 02:00 WIB pada 1 September 2026 — dini hari, sisi yang paling mudah salah.
const DINI_HARI_WIB = new Date("2026-08-31T19:00:00Z");

describe("jendela bulan operasional", () => {
  it("membentang dari awal bulan WIB sampai awal bulan WIB berikutnya", () => {
    const window = operationalMonthWindow(DINI_HARI_WIB);
    expect(window.start.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-30T17:00:00.000Z");
  });

  it("memasukkan transaksi dini hari ke dalam bulannya sendiri", () => {
    const window = operationalMonthWindow(DINI_HARI_WIB);
    expect(DINI_HARI_WIB.getTime()).toBeGreaterThanOrEqual(window.start.getTime());
    expect(DINI_HARI_WIB.getTime()).toBeLessThan(window.end.getTime());
  });

  it("berpindah tahun pada bulan Desember", () => {
    const window = operationalMonthWindow(new Date("2026-12-20T05:00:00Z"));
    expect(window.start.toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  /**
   * Zona waktu proseslah yang menjatuhkan pola lama `new Date(y, m, 1)`.
   *
   * Zona negatif memundurkan bulannya satu langkah; helper bersama ini tidak membaca jam lokal
   * proses sama sekali, sehingga hasilnya sama persis pada ketiga zona.
   */
  it("menghasilkan jendela yang sama pada zona waktu proses UTC, WIB, dan zona negatif", () => {
    const asli = process.env.TZ;
    const hasil: string[] = [];
    const polaLama: string[] = [];
    try {
      for (const zona of ["UTC", "Asia/Jakarta", "America/New_York"]) {
        process.env.TZ = zona;
        const window = operationalMonthWindow(DINI_HARI_WIB);
        hasil.push(`${window.start.toISOString()}..${window.end.toISOString()}`);
        // Pola yang dipakai sebelum perbaikan 7 September 2026, untuk memperlihatkan selisihnya.
        polaLama.push(new Date(DINI_HARI_WIB.getFullYear(), DINI_HARI_WIB.getMonth(), 1).toISOString());
      }
    } finally {
      process.env.TZ = asli;
    }

    expect(new Set(hasil).size).toBe(1);
    expect(hasil[0]).toBe("2026-08-31T17:00:00.000Z..2026-09-30T17:00:00.000Z");
    // Pola lamanya justru berbeda-beda menurut zona proses — itulah kekeliruan yang dihindari.
    expect(new Set(polaLama).size).toBeGreaterThan(1);
  });
});

describe("penyaringan aktivitas yang dihitung", () => {
  it("memakai status yang sama persis dengan akumulasi bulanan pada jalur transaksi", () => {
    expect([...MONITORED_ACTIVITY_STATUSES]).toEqual(["DRAFT", "PENDING_REVIEW", "APPROVED", "RETURNED", "COMPLETED"]);
  });
});

describe("melipat baris aktivitas menjadi aktivitas sebulan", () => {
  it("menjumlahkan nilai dan menghitung transaksi per nasabah", () => {
    const activity = foldMonthlyActivity([
      { customerId: 1, transactionId: 10, rupiahAmount: "5000000.00", currencyCode: "USD" },
      { customerId: 1, transactionId: 11, rupiahAmount: "2500000.00", currencyCode: "USD" },
      { customerId: 2, transactionId: 12, rupiahAmount: "1000000.00", currencyCode: "SGD" },
    ]);

    expect(activity.get(1)).toEqual({ customerId: 1, totalValueIdr: "7500000.00", transactionCount: 2, currencyCodes: ["USD"] });
    expect(activity.get(2)).toEqual({ customerId: 2, totalValueIdr: "1000000.00", transactionCount: 1, currencyCodes: ["SGD"] });
  });

  /**
   * Bon berbaris banyak menghasilkan satu baris per mata uang, dan `rupiahAmount` pada tiap baris
   * itu adalah nilai bonnya — bukan nilai barisnya. Menjumlahkannya apa adanya akan menghitung
   * bon yang sama dua kali dan menyalakan bendera nilai yang tidak pernah terjadi.
   */
  it("tidak menghitung ganda bon berbaris banyak, tetapi mengumpulkan seluruh mata uangnya", () => {
    const activity = foldMonthlyActivity([
      { customerId: 1, transactionId: 20, rupiahAmount: "9000000.00", currencyCode: "USD" },
      { customerId: 1, transactionId: 20, rupiahAmount: "9000000.00", currencyCode: "SGD" },
      { customerId: 1, transactionId: 20, rupiahAmount: "9000000.00", currencyCode: "JPY" },
    ]);

    expect(activity.get(1)).toEqual({ customerId: 1, totalValueIdr: "9000000.00", transactionCount: 1, currencyCodes: ["JPY", "SGD", "USD"] });
  });

  it("tetap menghitung bon yang mata uangnya tidak diketahui", () => {
    const activity = foldMonthlyActivity([
      { customerId: 3, transactionId: 30, rupiahAmount: "4000000.00", currencyCode: null },
    ]);

    expect(activity.get(3)).toEqual({ customerId: 3, totalValueIdr: "4000000.00", transactionCount: 1, currencyCodes: [] });
  });

  it("mengembalikan peta kosong untuk bulan tanpa aktivitas", () => {
    expect(foldMonthlyActivity([]).size).toBe(0);
  });
});

describe("menyusun worklist pemantauan", () => {
  const asOf = new Date("2026-09-08T05:00:00Z");

  const nasabah = (over: Partial<Parameters<typeof buildMonitoringWorklist>[0]["customers"][number]> = {}) => ({
    id: 1, cifNumber: "CIF-000001", fullName: "Nasabah Satu", riskLevel: "LOW" as const,
    declaredMonthlyValueIdr: "10000000.00", declaredMonthlyCount: 5, declaredCurrencies: ["USD"],
    ...over,
  });

  const aktivitas = (over: Partial<{ customerId: number; totalValueIdr: string; transactionCount: number; currencyCodes: string[] }> = {}) => ({
    customerId: 1, totalValueIdr: "0.00", transactionCount: 0, currencyCodes: [] as string[], ...over,
  });

  it("memunculkan nasabah yang belum pernah ditinjau beserta penilaiannya", () => {
    const rows = buildMonitoringWorklist({
      customers: [nasabah()],
      lastReviews: new Map(),
      activity: new Map([[1, aktivitas({ totalValueIdr: "20000000.00", transactionCount: 2, currencyCodes: ["USD"] })]]),
      asOf,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      customerId: 1, cifNumber: "CIF-000001", riskLevel: "LOW",
      lastReviewedAt: null, neverReviewed: true, intervalMonths: 12,
      reasons: ["NILAI_BULANAN_MELEBIHI_PROFIL"], hasDeviation: true,
    });
    expect(rows[0].activity).toMatchObject({ totalValueIdr: "20000000.00", transactionCount: 2 });
  });

  it("menyembunyikan nasabah LOW yang baru ditinjau sampai dua belas bulan berikutnya", () => {
    const rows = buildMonitoringWorklist({
      customers: [nasabah()],
      lastReviews: new Map([[1, { customerId: 1, reviewedAt: new Date("2026-06-01T00:00:00Z"), outcome: "TIDAK_ADA_PERUBAHAN" }]]),
      activity: new Map([[1, aktivitas({ totalValueIdr: "99000000.00", transactionCount: 50 })]]),
      asOf,
    });

    expect(rows).toHaveLength(0);
  });

  it("memunculkan nasabah HIGH sebulan sesudah peninjauan terakhirnya", () => {
    const rows = buildMonitoringWorklist({
      customers: [nasabah({ riskLevel: "HIGH" })],
      lastReviews: new Map([[1, { customerId: 1, reviewedAt: new Date("2026-08-08T00:00:00Z"), outcome: "TIDAK_ADA_PERUBAHAN" }]]),
      activity: new Map(),
      asOf,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ intervalMonths: 1, neverReviewed: false, hasDeviation: false });
    expect(rows[0].lastReviewedAt?.toISOString()).toBe("2026-08-08T00:00:00.000Z");
  });

  it("menyebut nasabah tanpa deklarasi sebagai PROFIL_BELUM_DIDEKLARASIKAN, bukan menyimpang", () => {
    const rows = buildMonitoringWorklist({
      customers: [nasabah({ declaredMonthlyValueIdr: null, declaredMonthlyCount: null, declaredCurrencies: null })],
      lastReviews: new Map(),
      activity: new Map([[1, aktivitas({ totalValueIdr: "500000000.00", transactionCount: 99, currencyCodes: ["USD"] })]]),
      asOf,
    });

    expect(rows[0].reasons).toEqual(["PROFIL_BELUM_DIDEKLARASIKAN"]);
    expect(rows[0].hasDeviation).toBe(false);
  });

  it("memberi aktivitas kosong pada nasabah yang tidak bertransaksi bulan ini", () => {
    const rows = buildMonitoringWorklist({ customers: [nasabah()], lastReviews: new Map(), activity: new Map(), asOf });

    expect(rows[0].activity).toEqual({ customerId: 1, totalValueIdr: "0.00", transactionCount: 0, currencyCodes: [] });
    expect(rows[0].hasDeviation).toBe(false);
  });

  it("mendahulukan nasabah yang menyimpang, lalu yang paling lama tidak ditinjau", () => {
    const rows = buildMonitoringWorklist({
      customers: [
        nasabah({ id: 1, cifNumber: "CIF-000001" }),
        nasabah({ id: 2, cifNumber: "CIF-000002" }),
        nasabah({ id: 3, cifNumber: "CIF-000003" }),
      ],
      lastReviews: new Map([
        [1, { customerId: 1, reviewedAt: new Date("2024-01-01T00:00:00Z"), outcome: "TIDAK_ADA_PERUBAHAN" }],
        [2, { customerId: 2, reviewedAt: new Date("2023-01-01T00:00:00Z"), outcome: "TIDAK_ADA_PERUBAHAN" }],
      ]),
      activity: new Map([[1, aktivitas({ customerId: 1, totalValueIdr: "20000000.00", transactionCount: 1, currencyCodes: ["USD"] })]]),
      asOf,
    });

    // Nasabah 1 menyimpang; sisanya menyusul menurut peninjauan terlama (3 belum pernah ditinjau).
    expect(rows.map((row) => row.customerId)).toEqual([1, 3, 2]);
  });
});
