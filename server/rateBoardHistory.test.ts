import { describe, expect, it } from "vitest";
import { groupTodayActivationBatches } from "./rateBoard";

// 16 September 2026 pukul 09:15 WIB dan 14:40 WIB, dinyatakan sebagai instan UTC supaya ujinya
// benar pada mesin WIB maupun server UTC.
const PAGI = new Date("2026-09-16T02:15:00Z");
const SIANG = new Date("2026-09-16T07:40:00Z");
// 15 September pukul 23:30 WIB — hari operasional kemarin, walau tanggal UTC-nya masih 15.
const SEMALAM = new Date("2026-09-15T16:30:00Z");
const SEKARANG = new Date("2026-09-16T08:00:00Z");

const row = (batchId: string, approvedAt: Date, approvalReason: string | null = "Kurs pagi mengikuti referensi BI.") =>
  ({ activationBatchId: batchId, approvedAt, approvalReason });

describe("riwayat aktivasi hari ini", () => {
  it("mengelompokkan per batch dan menghitung jumlah kursnya", () => {
    const batches = groupTodayActivationBatches([row("pagi", PAGI), row("pagi", PAGI), row("siang", SIANG)], SEKARANG);
    expect(batches).toEqual([
      { batchId: "siang", approvedAt: SIANG, rateCount: 1, approvalReason: "Kurs pagi mengikuti referensi BI." },
      { batchId: "pagi", approvedAt: PAGI, rateCount: 2, approvalReason: "Kurs pagi mengikuti referensi BI." },
    ]);
  });

  it("membuang aktivasi hari operasional kemarin walau tanggal UTC-nya sama", () => {
    expect(groupTodayActivationBatches([row("semalam", SEMALAM)], SEKARANG)).toEqual([]);
  });

  it("mengabaikan kurs yang belum pernah diaktifkan lewat papan", () => {
    expect(groupTodayActivationBatches([{ activationBatchId: "", approvedAt: PAGI, approvalReason: null }], SEKARANG)).toEqual([]);
  });
});
