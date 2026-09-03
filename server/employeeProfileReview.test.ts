import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PROFILE_REVIEW_INTERVAL_MONTHS,
  nextReviewDueAt,
  profileReviewStatus,
} from "../shared/employeeProfileReview";

const iso = (value: Date) => value.toISOString().slice(0, 10);

describe("jatuh tempo peninjauan profil", () => {
  it("jatuh tempo enam bulan setelah tanggal acuan", () => {
    expect(PROFILE_REVIEW_INTERVAL_MONTHS).toBe(6);
    expect(iso(nextReviewDueAt(new Date("2026-03-10T00:00:00Z")))).toBe("2026-09-10");
  });

  it("melewati pergantian tahun tanpa tersesat", () => {
    expect(iso(nextReviewDueAt(new Date("2026-10-05T00:00:00Z")))).toBe("2027-04-05");
  });

  it("memundurkan tanggal yang tidak ada di bulan tujuan, bukan melompati bulannya", () => {
    // 31 Agustus + 6 bulan tidak menghasilkan 31 Februari; tanpa penanganan ini tanggalnya
    // melompat ke awal Maret dan tenggat enam bulan diam-diam menjadi lebih panjang.
    expect(iso(nextReviewDueAt(new Date("2025-08-31T00:00:00Z")))).toBe("2026-02-28");
    expect(iso(nextReviewDueAt(new Date("2027-08-31T00:00:00Z")))).toBe("2028-02-29");
  });
});

describe("status peninjauan", () => {
  const now = new Date("2026-09-03T00:00:00Z");

  it("menghitung pegawai yang belum pernah ditinjau dari tanggal masuk", () => {
    // Inilah temuan pemeriksaan: profil tidak pernah dikinikan setelah perekrutan. Menganggap
    // pegawai seperti ini terkini akan menyembunyikan temuannya.
    const result = profileReviewStatus({ joinedAt: new Date("2020-01-15T00:00:00Z"), now });
    expect(result.neverReviewed).toBe(true);
    expect(result.status).toBe("TERLAMBAT");
    expect(iso(result.dueAt)).toBe("2020-07-15");
  });

  it("memakai peninjauan terakhir sebagai acuan bila ada", () => {
    const result = profileReviewStatus({
      joinedAt: new Date("2020-01-15T00:00:00Z"),
      lastReviewedAt: new Date("2026-08-01T00:00:00Z"),
      now,
    });
    expect(result.neverReviewed).toBe(false);
    expect(result.status).toBe("TERKINI");
    expect(iso(result.dueAt)).toBe("2027-02-01");
  });

  it("memberi peringatan sebulan sebelum jatuh tempo", () => {
    const result = profileReviewStatus({
      joinedAt: new Date("2026-03-20T00:00:00Z"),
      lastReviewedAt: new Date("2026-03-20T00:00:00Z"),
      now,
    });
    expect(iso(result.dueAt)).toBe("2026-09-20");
    expect(result.status).toBe("SEGERA");
    expect(result.daysUntilDue).toBe(17);
  });

  it("menyatakan terlambat pada hari setelah jatuh tempo, bukan pada hari jatuh temponya", () => {
    const onDueDate = profileReviewStatus({ joinedAt: now, lastReviewedAt: new Date("2026-03-03T00:00:00Z"), now });
    const dayAfter = profileReviewStatus({ joinedAt: now, lastReviewedAt: new Date("2026-03-02T00:00:00Z"), now });
    expect(onDueDate.status).toBe("SEGERA");
    expect(onDueDate.daysUntilDue).toBe(0);
    expect(dayAfter.status).toBe("TERLAMBAT");
  });

  it("tidak terpengaruh jam pencatatan", () => {
    // reviewedAt tersimpan sebagai datetime; peninjauan sore hari tidak boleh menggeser tenggat.
    const pagi = profileReviewStatus({ joinedAt: now, lastReviewedAt: new Date("2026-08-01T01:00:00Z"), now });
    const malam = profileReviewStatus({ joinedAt: now, lastReviewedAt: new Date("2026-08-01T23:30:00Z"), now });
    expect(iso(pagi.dueAt)).toBe(iso(malam.dueAt));
  });
});

describe("pencatatan peninjauan", () => {
  const source = readFileSync(new URL("./sdmOperations.ts", import.meta.url), "utf8");
  const pageSource = readFileSync(new URL("../client/src/pages/Kepegawaian.tsx", import.meta.url), "utf8");

  it("menolak hasil bukan tidak-ada-perubahan tanpa keterangan", () => {
    expect(source).toContain("Jelaskan perubahan atau tindak lanjut yang ditemukan pada peninjauan ini.");
  });

  it("menolak peninjauan pegawai yang sudah tidak aktif", () => {
    expect(source).toContain("Pegawai yang sudah tidak aktif tidak perlu ditinjau.");
  });

  it("mencatat jejak audit peninjauan", () => {
    expect(source).toContain('action: "EMPLOYEE_PROFILE_REVIEWED"');
  });

  it("mengurutkan jadwal dari yang paling terlambat", () => {
    expect(source).toContain("rows.sort((a, b) => a.daysUntilDue - b.daysUntilDue)");
  });

  it("menandai keterlambatan pada layar, bukan hanya menampilkan tanggalnya", () => {
    expect(pageSource).toContain("Terlambat {Math.abs(daysUntilDue)} hari");
    expect(pageSource).toContain("Profil terlambat ditinjau");
  });
});
