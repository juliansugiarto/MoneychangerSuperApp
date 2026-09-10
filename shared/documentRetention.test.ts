import { describe, expect, it } from "vitest";
import {
  COMPANY_PROFILE_DOCUMENT_RETENTION_YEARS,
  CUSTOMER_DOCUMENT_RETENTION_YEARS,
  TRANSACTION_DOCUMENT_RETENTION_YEARS,
  companyProfileDocumentRetention,
  customerDocumentRetention,
  relationshipEndValues,
  transactionDocumentRetention,
  type CustomerProfileStatus,
  type CustomerRetentionFacts,
} from "./documentRetention";

const wib = (iso: string) => new Date(`${iso}+07:00`);

const inactiveFacts = (overrides: Partial<CustomerRetentionFacts> = {}): CustomerRetentionFacts => ({
  profileStatus: "INACTIVE",
  relationshipEndedAt: wib("2026-03-10T10:00:00"),
  lastCompletedTransactionAt: null,
  lastDeviationReviewAt: null,
  ...overrides,
});

describe("konstanta retensi", () => {
  it("memakai lima tahun untuk nasabah, sepuluh untuk tahun buku, lima untuk aturan rumah", () => {
    expect(CUSTOMER_DOCUMENT_RETENTION_YEARS).toBe(5);
    expect(TRANSACTION_DOCUMENT_RETENTION_YEARS).toBe(10);
    expect(COMPANY_PROFILE_DOCUMENT_RETENTION_YEARS).toBe(5);
  });
});

describe("customerDocumentRetention", () => {
  it.each<CustomerProfileStatus>(["ACTIVE", "RESTRICTED"])("status %s: hubungan usaha berjalan, tanpa tenggat", (profileStatus) => {
    const verdict = customerDocumentRetention({
      profileStatus,
      relationshipEndedAt: null,
      lastCompletedTransactionAt: wib("2026-01-05T09:00:00"),
      lastDeviationReviewAt: wib("2026-02-01T09:00:00"),
    });
    expect(verdict.basis).toBe("HUBUNGAN_USAHA_BERJALAN");
    expect(verdict.basisAt).toBeNull();
    expect(verdict.retainUntil).toBeNull();
  });

  it("INACTIVE tanpa relationshipEndedAt tidak menebak jamnya: tetap tanpa tenggat", () => {
    const verdict = customerDocumentRetention(inactiveFacts({ relationshipEndedAt: null, lastCompletedTransactionAt: wib("2020-01-01T09:00:00") }));
    expect(verdict.basis).toBe("HUBUNGAN_USAHA_BERJALAN");
    expect(verdict.retainUntil).toBeNull();
  });

  it("INACTIVE tanpa transaksi: lima tahun tepat sejak hubungan usaha berakhir", () => {
    const verdict = customerDocumentRetention(inactiveFacts());
    expect(verdict.basis).toBe("HUBUNGAN_USAHA_BERAKHIR");
    expect(verdict.basisAt).toEqual(wib("2026-03-10T10:00:00"));
    expect(verdict.retainUntil).toEqual(wib("2031-03-10T10:00:00"));
    expect(verdict.detail).toBe("5 tahun sejak hubungan usaha berakhir (2026-03-10).");
  });

  it("transaksi sebelum hubungan usaha berakhir tidak memundurkan tenggatnya", () => {
    const verdict = customerDocumentRetention(inactiveFacts({ lastCompletedTransactionAt: wib("2026-03-01T10:00:00") }));
    expect(verdict.basis).toBe("HUBUNGAN_USAHA_BERAKHIR");
    expect(verdict.retainUntil).toEqual(wib("2031-03-10T10:00:00"));
  });

  it("transaksi terakhir SESUDAH hubungan usaha berakhir: jamnya berdetak dari transaksi itu", () => {
    const verdict = customerDocumentRetention(inactiveFacts({ lastCompletedTransactionAt: wib("2026-04-02T14:30:00") }));
    expect(verdict.basis).toBe("TRANSAKSI_TERAKHIR");
    expect(verdict.basisAt).toEqual(wib("2026-04-02T14:30:00"));
    expect(verdict.retainUntil).toEqual(wib("2031-04-02T14:30:00"));
    expect(verdict.detail).toContain("transaksi terakhir (2026-04-02)");
  });

  it("peninjauan menyimpang SESUDAH keduanya: basisnya ketidaksesuaian profil", () => {
    const verdict = customerDocumentRetention(inactiveFacts({
      lastCompletedTransactionAt: wib("2026-04-02T14:30:00"),
      lastDeviationReviewAt: wib("2026-05-20T08:00:00"),
    }));
    expect(verdict.basis).toBe("KETIDAKSESUAIAN_PROFIL");
    expect(verdict.basisAt).toEqual(wib("2026-05-20T08:00:00"));
    expect(verdict.retainUntil).toEqual(wib("2031-05-20T08:00:00"));
    expect(verdict.detail).toContain("ketidaksesuaian profil terakhir ditemukan (2026-05-20)");
  });

  it("tanggal di kalimatnya dibaca di WIB, bukan UTC", () => {
    // 00:30 WIB tanggal 11 masih tanggal 10 di UTC.
    const verdict = customerDocumentRetention(inactiveFacts({ relationshipEndedAt: wib("2026-03-11T00:30:00") }));
    expect(verdict.detail).toContain("(2026-03-11)");
  });
});

describe("transactionDocumentRetention", () => {
  const longInactiveCustomer = customerDocumentRetention(inactiveFacts({ relationshipEndedAt: wib("2020-01-01T10:00:00") }));

  it("transaksi 3 Maret 2024 dari nasabah yang lama tidak aktif: 1 Januari 2035 WIB", () => {
    const verdict = transactionDocumentRetention(wib("2024-03-03T11:00:00"), longInactiveCustomer);
    expect(verdict.basis).toBe("TAHUN_BUKU_TRANSAKSI");
    expect(verdict.basisAt).toEqual(wib("2025-01-01T00:00:00"));
    expect(verdict.retainUntil).toEqual(wib("2035-01-01T00:00:00"));
    expect(verdict.detail).toBe("10 tahun sejak akhir tahun buku 2024.");
  });

  it("bon pukul 00:30 WIB tanggal 1 Januari masuk tahun buku yang baru, bukan tahun sebelumnya", () => {
    const transactionAt = wib("2025-01-01T00:30:00");
    expect(transactionAt.getUTCFullYear()).toBe(2024);
    const verdict = transactionDocumentRetention(transactionAt, longInactiveCustomer);
    expect(verdict.retainUntil).toEqual(wib("2036-01-01T00:00:00"));
    expect(verdict.detail).toBe("10 tahun sejak akhir tahun buku 2025.");
  });

  it("bon pukul 23:30 WIB tanggal 31 Desember tetap tahun buku yang lama", () => {
    const verdict = transactionDocumentRetention(wib("2024-12-31T23:30:00"), longInactiveCustomer);
    expect(verdict.retainUntil).toEqual(wib("2035-01-01T00:00:00"));
  });

  it("mengikuti zona operasional yang diberikan", () => {
    const verdict = transactionDocumentRetention(new Date("2025-01-01T00:30:00+09:00"), longInactiveCustomer, "Asia/Jayapura");
    expect(verdict.retainUntil).toEqual(new Date("2036-01-01T00:00:00+09:00"));
  });

  it("kaidah terlama: tenggat nasabah yang melampaui tahun buku mengalahkan tahun bukunya", () => {
    const customerVerdict = customerDocumentRetention(inactiveFacts({
      relationshipEndedAt: wib("2030-01-01T10:00:00"),
      lastDeviationReviewAt: wib("2031-06-01T09:00:00"),
    }));
    expect(customerVerdict.retainUntil).toEqual(wib("2036-06-01T09:00:00"));
    const verdict = transactionDocumentRetention(wib("2024-03-03T11:00:00"), customerVerdict);
    expect(verdict).toBe(customerVerdict);
  });

  it("nasabah tanpa tenggat + transaksi lama: tetap tanpa tenggat", () => {
    const customerVerdict = customerDocumentRetention({
      profileStatus: "ACTIVE",
      relationshipEndedAt: null,
      lastCompletedTransactionAt: wib("2012-06-01T10:00:00"),
      lastDeviationReviewAt: null,
    });
    const verdict = transactionDocumentRetention(wib("2012-06-01T10:00:00"), customerVerdict);
    expect(verdict.basis).toBe("HUBUNGAN_USAHA_BERJALAN");
    expect(verdict.retainUntil).toBeNull();
  });
});

describe("companyProfileDocumentRetention", () => {
  it("aturan rumah lima tahun sejak diunggah, dan menyatakan dirinya bukan Pasal 48", () => {
    const createdAt = wib("2026-09-11T13:00:00");
    const verdict = companyProfileDocumentRetention(createdAt);
    expect(verdict.basis).toBe("SEJAK_DIUNGGAH");
    expect(verdict.basisAt).toEqual(createdAt);
    expect(verdict.retainUntil).toEqual(wib("2031-09-11T13:00:00"));
    expect(verdict.detail).toContain("Bukan kewajiban Pasal 48");
  });
});

describe("relationshipEndValues", () => {
  const now = wib("2026-09-11T15:00:00");

  it.each<[CustomerProfileStatus, CustomerProfileStatus, { relationshipEndedAt: Date | null } | null]>([
    ["ACTIVE", "INACTIVE", { relationshipEndedAt: now }],
    ["RESTRICTED", "INACTIVE", { relationshipEndedAt: now }],
    ["INACTIVE", "ACTIVE", { relationshipEndedAt: null }],
    ["INACTIVE", "RESTRICTED", { relationshipEndedAt: null }],
    ["INACTIVE", "INACTIVE", null],
    ["ACTIVE", "RESTRICTED", null],
    ["RESTRICTED", "ACTIVE", null],
    ["ACTIVE", "ACTIVE", null],
    ["RESTRICTED", "RESTRICTED", null],
  ])("%s → %s", (previousStatus, nextStatus, expected) => {
    expect(relationshipEndValues(previousStatus, nextStatus, now)).toEqual(expected);
  });
});
