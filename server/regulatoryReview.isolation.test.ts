import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { auditLogs, regulatoryReportPackages } from "../drizzle/schema";
import { getDb } from "./db";
import { returnRegulatoryReportPackage, setRegulatoryReportManualDeadline } from "./operations";

let selectedRow: Record<string, unknown>;
const insert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
const where = vi.fn().mockResolvedValue(undefined);
const set = vi.fn(() => ({ where }));
const update = vi.fn(() => ({ set }));
const database = {
  insert,
  update,
  select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockImplementation(async () => [selectedRow]) })) })) })),
};

describe("isolasi review paket regulator", () => {
  beforeEach(() => {
    insert.mockClear();
    update.mockClear();
    set.mockClear();
    where.mockClear();
    vi.mocked(getDb).mockResolvedValue(database as never);
  });

  it("mengembalikan paket hanya pada tabel regulator dan audit tanpa mengubah transaksi atau kas", async () => {
    selectedRow = { id: 40, status: "PREPARED", preparedByUserId: 3, createdAt: new Date("2026-08-01"), manualDueAt: null, manualDueNotes: null };
    await returnRegulatoryReportPackage(40, 8, "Periksa kembali rekonsiliasi sumber.");
    expect(update.mock.calls.map(([table]) => table)).toEqual([regulatoryReportPackages]);
    expect(insert.mock.calls.map(([table]) => table)).toEqual([auditLogs]);
  });

  it("mengatur tenggat manual hanya pada paket regulator dan audit tanpa membuat notifikasi atau perubahan status", async () => {
    selectedRow = { id: 41, status: "DRAFT", preparedByUserId: null, createdAt: new Date("2026-08-01"), manualDueAt: null, manualDueNotes: null };
    const dueAt = new Date("2026-08-31T23:59:59.000Z");
    await setRegulatoryReportManualDeadline({ packageId: 41, dueAt, notes: "Menunggu rekonsiliasi dan bukti pendukung." }, 3);
    expect(update.mock.calls.map(([table]) => table)).toEqual([regulatoryReportPackages]);
    expect(insert.mock.calls.map(([table]) => table)).toEqual([auditLogs]);
    expect(set).toHaveBeenCalledWith({ manualDueAt: dueAt, manualDueNotes: "Menunggu rekonsiliasi dan bukti pendukung." });
  });
});
