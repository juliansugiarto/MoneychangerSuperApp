import { describe, expect, it } from "vitest";
import { buildLkuSnapshotRows, nextRegulatoryReportStatus, regulatoryApprovalBlocker, regulatoryPeriodLockBlocker, regulatoryReturnBlocker } from "./operations";

describe("snapshot LKU pelaporan regulator", () => {
  it("mengagregasi hanya transaksi live yang selesai menurut mata uang dan arah transaksi", () => {
    const result = buildLkuSnapshotRows([
      { transaction: { operation: "BUY", foreignAmount: "100", rupiahAmount: "1770000", status: "COMPLETED", isDemo: false, isHistorical: false }, currency: { code: "USD" } },
      { transaction: { operation: "SELL", foreignAmount: "50", rupiahAmount: "900000", status: "COMPLETED", isDemo: false, isHistorical: false }, currency: { code: "USD" } },
      { transaction: { operation: "BUY", foreignAmount: "1000", rupiahAmount: "1000000", status: "DRAFT", isDemo: false, isHistorical: false }, currency: { code: "USD" } },
      { transaction: { operation: "SELL", foreignAmount: "500", rupiahAmount: "500000", status: "COMPLETED", isDemo: true, isHistorical: false }, currency: { code: "EUR" } },
      { transaction: { operation: "BUY", foreignAmount: "500", rupiahAmount: "500000", status: "COMPLETED", isDemo: false, isHistorical: true }, currency: { code: "JPY" } },
    ]);
    expect(result).toEqual([{ currencyCode: "USD", buyForeign: "100.000000", sellForeign: "50.000000", buyIdr: "1770000.00", sellIdr: "900000.00", transactionCount: 2 }]);
  });

  it("menghasilkan daftar kosong jika seluruh sumber bukan transaksi produksi selesai", () => {
    expect(buildLkuSnapshotRows([{ transaction: { operation: "BUY", foreignAmount: "1", rupiahAmount: "1", status: "PENDING_REVIEW", isDemo: false, isHistorical: false }, currency: { code: "USD" } }])).toEqual([]);
  });

  it("menahan persetujuan diri sendiri tetapi mengizinkan maker dan checker berbeda", () => {
    expect(regulatoryApprovalBlocker({ status: "PREPARED", preparedByUserId: 7, actorUserId: 7 })).toContain("tidak dapat menyetujui");
    expect(regulatoryApprovalBlocker({ status: "PREPARED", preparedByUserId: 7, actorUserId: 9 })).toBeNull();
    expect(regulatoryApprovalBlocker({ status: "DRAFT", preparedByUserId: 7, actorUserId: 9 })).toContain("siap diperiksa");
  });

  it("mengunci satu periode ketika paket sudah siap, disetujui, atau diekspor", () => {
    const periodStart = new Date("2026-08-01T00:00:00.000Z"); const periodEnd = new Date("2026-09-01T00:00:00.000Z");
    const blocker = regulatoryPeriodLockBlocker({ candidate: { reportType: "LKU", periodStart, periodEnd }, packages: [{ id: 8, reportType: "LKU", periodStart, periodEnd, status: "APPROVED" }] });
    expect(blocker).toContain("sudah dikunci");
    expect(regulatoryPeriodLockBlocker({ candidate: { reportType: "LKU", periodStart, periodEnd }, packages: [{ id: 8, reportType: "LKU", periodStart, periodEnd, status: "DRAFT" }] })).toBeNull();
    expect(regulatoryPeriodLockBlocker({ candidate: { reportType: "LKU", periodStart, periodEnd }, packages: [{ id: 8, reportType: "LKU", periodStart, periodEnd, status: "RETURNED" }] })).toBeNull();
  });

  it("membuktikan urutan draf → siap → disetujui checker lain → diekspor", () => {
    const prepared = nextRegulatoryReportStatus({ action: "PREPARE", currentStatus: "DRAFT", actorUserId: 7 });
    const approved = nextRegulatoryReportStatus({ action: "APPROVE", currentStatus: prepared, preparedByUserId: 7, actorUserId: 9 });
    expect(nextRegulatoryReportStatus({ action: "EXPORT", currentStatus: approved, actorUserId: 7 })).toBe("EXPORTED");
    expect(() => nextRegulatoryReportStatus({ action: "APPROVE", currentStatus: prepared, preparedByUserId: 7, actorUserId: 7 })).toThrow("tidak dapat menyetujui");
  });

  it("memungkinkan Shareholder lain mengembalikan paket siap diperiksa dengan jejak status", () => {
    expect(regulatoryReturnBlocker({ status: "PREPARED", preparedByUserId: 7, actorUserId: 9 })).toBeNull();
    expect(regulatoryReturnBlocker({ status: "PREPARED", preparedByUserId: 7, actorUserId: 7 })).toContain("tidak dapat mengembalikan");
    expect(nextRegulatoryReportStatus({ action: "RETURN", currentStatus: "PREPARED", preparedByUserId: 7, actorUserId: 9 })).toBe("RETURNED");
    expect(() => nextRegulatoryReportStatus({ action: "RETURN", currentStatus: "DRAFT", preparedByUserId: 7, actorUserId: 9 })).toThrow("siap diperiksa");
  });
});
