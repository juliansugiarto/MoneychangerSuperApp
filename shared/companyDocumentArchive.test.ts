import { describe, expect, it } from "vitest";
import {
  ARCHIVE_EXPIRY_WARNING_DAYS,
  archiveDateKey,
  archiveWorklistReason,
  assessArchiveValidity,
  companyDocumentCategoryLabels,
} from "./companyDocumentArchive";
import { operationalDateKey } from "./regulatoryActionQueue";

/** Nilai kolom `date` seperti yang dikembalikan driver MySQL: tengah malam WAKTU LOKAL proses. */
const dateColumnValue = (year: number, month: number, day: number) => new Date(year, month - 1, day);

const asOf = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

describe("kunci tanggal arsip", () => {
  it("membaca nilai kolom date dengan penggetah lokal, bukan lewat UTC", () => {
    // toISOString() pada tengah malam lokal WIB menghasilkan tanggal SEBELUMNYA. Itulah kekeliruan
    // yang membuat baris jatuh di sisi salah batasnya, dan yang kunci ini ada untuk mencegahnya.
    expect(archiveDateKey(dateColumnValue(2026, 9, 8))).toBe("2026-09-08");
    expect(archiveDateKey(dateColumnValue(2026, 1, 1))).toBe("2026-01-01");
    expect(archiveDateKey(dateColumnValue(2026, 12, 31))).toBe("2026-12-31");
  });

  /**
   * Zona waktu proseslah yang menjatuhkan pola `toISOString().slice(0, 10)`.
   *
   * Nilai kolom `date` dibangun driver sebagai tengah malam waktu lokal proses, sehingga kuncinya
   * harus diambil dengan penggetah lokal. Pada zona positif seperti WIB, membacanya lewat UTC
   * memundurkan tanggalnya satu hari; pada zona negatif ia memajukannya.
   */
  it("menghasilkan kunci yang sama pada zona proses UTC, WIB, dan zona negatif", () => {
    const asli = process.env.TZ;
    const hasil: string[] = [];
    const polaUtc: string[] = [];
    try {
      for (const zona of ["UTC", "Asia/Jakarta", "America/New_York"]) {
        process.env.TZ = zona;
        const nilai = dateColumnValue(2026, 9, 8);
        hasil.push(archiveDateKey(nilai));
        polaUtc.push(nilai.toISOString().slice(0, 10));
      }
    } finally {
      process.env.TZ = asli;
    }

    expect(new Set(hasil).size).toBe(1);
    expect(hasil[0]).toBe("2026-09-08");
    // Pola UTC-nya justru berbeda-beda menurut zona proses — itulah kekeliruan yang dihindari.
    expect(new Set(polaUtc).size).toBeGreaterThan(1);
  });

  it("menurunkan hari ini dari zona operasional, bukan dari zona proses", () => {
    // 7 September 2026 pukul 18:00 UTC sudah tanggal 8 di WIB (GMT+7).
    const instant = new Date("2026-09-07T18:00:00.000Z");
    expect(operationalDateKey(instant, "Asia/Jakarta")).toBe("2026-09-08");
    expect(operationalDateKey(instant, "UTC")).toBe("2026-09-07");
  });
});

describe("masa berlaku dokumen arsip", () => {
  it("dokumen yang berakhir hari ini belum KEDALUWARSA", () => {
    // validUntil adalah tanggal TERAKHIR dokumen berlaku, bukan tanggal pertama ia tidak berlaku.
    // Sisa nol hari tetap di dalam jendela peringatan, jadi statusnya AKAN_KEDALUWARSA — yang
    // penting di sini adalah ia belum kedaluwarsa hari terakhirnya sendiri.
    const status = assessArchiveValidity({ validFrom: dateColumnValue(2026, 1, 1), validUntil: dateColumnValue(2026, 9, 8) }, asOf(2026, 9, 8));
    expect(status).toBe("AKAN_KEDALUWARSA");
    expect(status).not.toBe("KEDALUWARSA");
  });

  it("KEDALUWARSA sejak hari sesudah validUntil", () => {
    const entry = { validFrom: dateColumnValue(2026, 1, 1), validUntil: dateColumnValue(2026, 9, 8) };
    expect(assessArchiveValidity(entry, asOf(2026, 9, 9))).toBe("KEDALUWARSA");
  });

  it("AKAN_KEDALUWARSA tepat pada hari ke-30, dan BERLAKU pada hari ke-31", () => {
    const entry = { validFrom: dateColumnValue(2026, 1, 1), validUntil: dateColumnValue(2026, 10, 8) };
    expect(ARCHIVE_EXPIRY_WARNING_DAYS).toBe(30);
    expect(assessArchiveValidity(entry, asOf(2026, 9, 8))).toBe("AKAN_KEDALUWARSA");
    expect(assessArchiveValidity(entry, asOf(2026, 9, 7))).toBe("BERLAKU");
  });

  it("menghitung selisih hari melintasi pergantian bulan dan tahun", () => {
    // Selisih atas kunci tanggal, bukan atas selisih milidetik: 24 jam bukan satu hari.
    const entry = { validFrom: dateColumnValue(2026, 1, 1), validUntil: dateColumnValue(2027, 1, 5) };
    expect(assessArchiveValidity(entry, asOf(2026, 12, 6))).toBe("AKAN_KEDALUWARSA");
    expect(assessArchiveValidity(entry, asOf(2026, 12, 5))).toBe("BERLAKU");
  });

  it("validUntil kosong berarti BERLAKU selamanya, bukan kedaluwarsa", () => {
    const entry = { validFrom: dateColumnValue(2020, 1, 1), validUntil: null };
    expect(assessArchiveValidity(entry, asOf(2026, 9, 8))).toBe("BERLAKU");
  });

  it("validFrom di masa depan menghasilkan BELUM_BERLAKU", () => {
    const entry = { validFrom: dateColumnValue(2026, 10, 1), validUntil: null };
    expect(assessArchiveValidity(entry, asOf(2026, 9, 8))).toBe("BELUM_BERLAKU");
    expect(assessArchiveValidity(entry, asOf(2026, 10, 1))).toBe("BERLAKU");
  });

  it("BELUM_BERLAKU mendahului KEDALUWARSA bila kedua tanggalnya di masa depan terbalik", () => {
    // Versi bertanggal berlaku di masa depan belum boleh disebut kedaluwarsa hanya karena
    // validUntil-nya sudah lewat — yang salah adalah tanggalnya, dan itu harus terlihat sebagai
    // "tidak ada versi berlaku", bukan tersembunyi sebagai kedaluwarsa biasa.
    const entry = { validFrom: dateColumnValue(2026, 10, 1), validUntil: dateColumnValue(2026, 9, 1) };
    expect(assessArchiveValidity(entry, asOf(2026, 9, 8))).toBe("BELUM_BERLAKU");
  });
});

describe("alasan worklist arsip", () => {
  const berlaku = { validFrom: dateColumnValue(2026, 1, 1), validUntil: dateColumnValue(2027, 12, 31) };

  it("dokumen berlaku tidak menghasilkan alasan", () => {
    expect(archiveWorklistReason({ ...berlaku, deactivatedAt: null }, asOf(2026, 9, 8))).toBeNull();
  });

  it("kedaluwarsa dan akan kedaluwarsa masing-masing menghasilkan alasannya", () => {
    expect(archiveWorklistReason({ validFrom: dateColumnValue(2026, 1, 1), validUntil: dateColumnValue(2026, 9, 1), deactivatedAt: null }, asOf(2026, 9, 8))).toBe("KEDALUWARSA");
    expect(archiveWorklistReason({ validFrom: dateColumnValue(2026, 1, 1), validUntil: dateColumnValue(2026, 9, 20), deactivatedAt: null }, asOf(2026, 9, 8))).toBe("AKAN_KEDALUWARSA");
  });

  it("versi yang belum berlaku menghasilkan TIDAK_ADA_VERSI_BERLAKU", () => {
    expect(archiveWorklistReason({ validFrom: dateColumnValue(2026, 10, 1), validUntil: null, deactivatedAt: null }, asOf(2026, 9, 8))).toBe("TIDAK_ADA_VERSI_BERLAKU");
  });

  it("dokumen nonaktif tidak pernah menghasilkan alasan, walau kedaluwarsa", () => {
    // Diuji di sini, bukan diserahkan ke pemanggil: worklist yang menampilkan dokumen yang sudah
    // ditarik akan menuntut pekerjaan atas sesuatu yang sengaja tidak lagi dipelihara.
    const dicabut = { validFrom: dateColumnValue(2026, 1, 1), validUntil: dateColumnValue(2026, 9, 1), deactivatedAt: new Date("2026-09-02T03:00:00.000Z") };
    expect(archiveWorklistReason(dicabut, asOf(2026, 9, 8))).toBeNull();
  });

  it("dokumen tanpa validUntil tidak pernah masuk worklist", () => {
    expect(archiveWorklistReason({ validFrom: dateColumnValue(2020, 1, 1), validUntil: null, deactivatedAt: null }, asOf(2026, 9, 8))).toBeNull();
  });
});

describe("label kategori", () => {
  it("memberi label terbaca manusia untuk keenam kategori", () => {
    expect(Object.keys(companyDocumentCategoryLabels)).toHaveLength(6);
    expect(companyDocumentCategoryLabels.SOP).toBe("SOP");
    expect(companyDocumentCategoryLabels.KORESPONDENSI_REGULATOR).toBe("Korespondensi regulator");
  });
});
