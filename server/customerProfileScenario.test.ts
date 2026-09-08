import { describe, expect, it } from "vitest";
import { buildMonitoringWorklist, type CustomerMonthlyActivity, type LastProfileReview, type MonitoringCustomer } from "./customerProfileMonitoring";
import { assessReviewRequirement } from "./operations";

/**
 * Skenario menyeluruh Paket H: dari nasabah mendeklarasikan profilnya sampai Controller menutup
 * peninjauannya.
 *
 * Seluruhnya memakai data karangan dan fungsi murni — yang diuji di sini adalah **rangkaiannya**,
 * bukan satu aturan tunggal. Rangkaian itulah yang ditanyakan pemeriksa: siapa yang menyatakan apa,
 * kapan aplikasi melihat penyimpangan, siapa yang menutupnya, dan kapan ia muncul lagi.
 */

const NASABAH: MonitoringCustomer = {
  id: 1,
  cifNumber: "CIF-000001",
  fullName: "Nasabah Berdeklarasi",
  riskLevel: "LOW",
  declaredMonthlyValueIdr: "10000000.00",
  declaredMonthlyCount: 5,
  declaredCurrencies: ["USD"],
};

const aktivitas = (over: Partial<CustomerMonthlyActivity> = {}): CustomerMonthlyActivity => ({
  customerId: 1, totalValueIdr: "0.00", transactionCount: 0, currencyCodes: [], ...over,
});

const worklist = (input: {
  customers?: MonitoringCustomer[];
  activity?: CustomerMonthlyActivity;
  lastReview?: LastProfileReview | null;
  asOf: Date;
}) => buildMonitoringWorklist({
  customers: input.customers ?? [NASABAH],
  lastReviews: input.lastReview ? new Map([[input.lastReview.customerId, input.lastReview]]) : new Map(),
  activity: input.activity ? new Map([[input.activity.customerId, input.activity]]) : new Map(),
  asOf: input.asOf,
});

describe("skenario menyeluruh: deklarasi sampai peninjauan ditutup", () => {
  const SEPTEMBER = new Date("2026-09-08T05:00:00Z");

  it("berjalan dari bertransaksi wajar sampai peninjauan ditutup dan tidak muncul lagi", () => {
    // 1. Nasabah baru berdeklarasi dan bertransaksi di bawah ambang. Ia tetap muncul di worklist —
    //    bukan karena menyimpang, melainkan karena belum pernah ditinjau sama sekali.
    const wajar = worklist({ activity: aktivitas({ totalValueIdr: "8000000.00", transactionCount: 3, currencyCodes: ["USD"] }), asOf: SEPTEMBER });
    expect(wajar).toHaveLength(1);
    expect(wajar[0].hasDeviation).toBe(false);
    expect(wajar[0].reasons).toEqual([]);
    expect(wajar[0].neverReviewed).toBe(true);

    // 2. Aktivitasnya mencapai dua kali lipat deklarasi. Alasannya kini terlihat, beserta angkanya.
    const menyimpang = worklist({ activity: aktivitas({ totalValueIdr: "20000000.00", transactionCount: 4, currencyCodes: ["USD"] }), asOf: SEPTEMBER });
    expect(menyimpang[0].reasons).toEqual(["NILAI_BULANAN_MELEBIHI_PROFIL"]);
    expect(menyimpang[0].hasDeviation).toBe(true);
    expect(menyimpang[0].valueThresholdIdr).toBe(20_000_000);

    // 3. Transaksi yang membawanya ke sana juga dialirkan ke review di jalur kasir — dengan alasan
    //    yang sama, dari fungsi yang sama.
    const diKasir = assessReviewRequirement({
      rupiahAmount: "12000000.00",
      thresholdUsd: "10000",
      monthlyRupiahTotal: "20000000.00",
      monthlyTransactionCount: 4,
      profileStatus: "ACTIVE",
      riskLevel: "LOW",
      declaredMonthlyValueIdr: NASABAH.declaredMonthlyValueIdr,
      declaredMonthlyCount: NASABAH.declaredMonthlyCount,
    });
    expect(diKasir.requiresReview).toBe(true);
    expect(diKasir.reviewReason).toContain("AKTIVITAS_MENYIMPANG_DARI_PROFIL");

    // 4. Controller menutup peninjauannya hari itu juga.
    const ditinjau: LastProfileReview = { customerId: 1, reviewedAt: SEPTEMBER, outcome: "PERLU_TINDAK_LANJUT" };

    // 5. Nasabahnya tidak muncul lagi — meski aktivitasnya masih menyimpang. Peninjauannya memang
    //    baru saja dilakukan seseorang; memunculkannya kembali hanya akan meminta pekerjaan yang
    //    sama dua kali.
    const sesudah = worklist({ activity: aktivitas({ totalValueIdr: "20000000.00", transactionCount: 4, currencyCodes: ["USD"] }), lastReview: ditinjau, asOf: SEPTEMBER });
    expect(sesudah).toHaveLength(0);

    // 6. Sebelas bulan kemudian ia masih belum jatuh tempo; pada bulan kedua belas ia muncul lagi.
    expect(worklist({ lastReview: ditinjau, asOf: new Date("2027-09-07T05:00:00Z") })).toHaveLength(0);
    expect(worklist({ lastReview: ditinjau, asOf: new Date("2027-09-08T05:00:00Z") })).toHaveLength(1);
  });
});

describe("skenario sisi batas", () => {
  const SEPTEMBER = new Date("2026-09-08T05:00:00Z");

  it("memunculkan nasabah tanpa deklarasi sebagai PROFIL_BELUM_DIDEKLARASIKAN, bukan sebagai menyimpang", () => {
    const belum: MonitoringCustomer = { ...NASABAH, declaredMonthlyValueIdr: null, declaredMonthlyCount: null, declaredCurrencies: null };
    const rows = worklist({ customers: [belum], activity: aktivitas({ totalValueIdr: "400000000.00", transactionCount: 80, currencyCodes: ["USD", "JPY"] }), asOf: SEPTEMBER });

    expect(rows[0].reasons).toEqual(["PROFIL_BELUM_DIDEKLARASIKAN"]);
    expect(rows[0].hasDeviation).toBe(false);

    // Dan jalur kasir tetap membiarkannya lewat: kekosongan bukan urusan kasir.
    const diKasir = assessReviewRequirement({
      rupiahAmount: "400000000.00", thresholdUsd: "10000", monthlyRupiahTotal: "400000000.00", monthlyTransactionCount: 80,
      profileStatus: "ACTIVE", riskLevel: "LOW", declaredMonthlyValueIdr: null, declaredMonthlyCount: null,
    });
    expect(diKasir.reviewReason).toBeNull();
  });

  it("menahan nasabah LOW yang baru ditinjau selama dua belas bulan penuh", () => {
    const ditinjau: LastProfileReview = { customerId: 1, reviewedAt: new Date("2026-09-08T05:00:00Z"), outcome: "TIDAK_ADA_PERUBAHAN" };

    for (const bulan of ["2026-12-08", "2027-03-08", "2027-06-08", "2027-09-07"]) {
      expect(worklist({ lastReview: ditinjau, asOf: new Date(`${bulan}T05:00:00Z`) }), `masih tertahan pada ${bulan}`).toHaveLength(0);
    }
    expect(worklist({ lastReview: ditinjau, asOf: new Date("2027-09-08T05:00:00Z") })).toHaveLength(1);
  });

  it("memunculkan mata uang tak terdeklarasi sendirian, tanpa penyimpangan nilai", () => {
    const rows = worklist({ activity: aktivitas({ totalValueIdr: "3000000.00", transactionCount: 2, currencyCodes: ["USD", "JPY"] }), asOf: SEPTEMBER });

    expect(rows[0].reasons).toEqual(["MATA_UANG_TIDAK_DIDEKLARASIKAN"]);
    expect(rows[0].undeclaredCurrencies).toEqual(["JPY"]);
  });

  /** Pemecahan transaksi: banyak bon kecil yang totalnya masih wajar. Inilah bentuk yang paling perlu terlihat. */
  it("memunculkan frekuensi menyimpang sendirian ketika nilainya masih di bawah ambang", () => {
    const rows = worklist({ activity: aktivitas({ totalValueIdr: "7000000.00", transactionCount: 10, currencyCodes: ["USD"] }), asOf: SEPTEMBER });

    expect(rows[0].reasons).toEqual(["FREKUENSI_BULANAN_MELEBIHI_PROFIL"]);
    expect(rows[0].activity.totalValueIdr).toBe("7000000.00");
    expect(rows[0].valueThresholdIdr).toBe(20_000_000);
  });

  it("memakai irama yang berbeda menurut risiko pada nasabah yang ditinjau di hari yang sama", () => {
    const ditinjau: LastProfileReview = { customerId: 1, reviewedAt: new Date("2026-09-08T05:00:00Z"), outcome: "TIDAK_ADA_PERUBAHAN" };
    const sebulanKemudian = new Date("2026-10-08T05:00:00Z");

    expect(worklist({ customers: [{ ...NASABAH, riskLevel: "HIGH" }], lastReview: ditinjau, asOf: sebulanKemudian })).toHaveLength(1);
    expect(worklist({ customers: [{ ...NASABAH, riskLevel: "MEDIUM" }], lastReview: ditinjau, asOf: sebulanKemudian })).toHaveLength(0);
    expect(worklist({ customers: [NASABAH], lastReview: ditinjau, asOf: sebulanKemudian })).toHaveLength(0);
  });
});
