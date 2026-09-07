import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { financialStatementNotes } from "../drizzle/schema";
import * as db from "./db";
import { buildFinancialNotes, buildNarrativeNotes, saveFinancialNoteText } from "./financialNotes";
import { writeAudit } from "./operations";

const controller = { id: 7 };
const to = new Date("2026-09-30T00:00:00");

type Write = { op: "insert" | "update"; table: unknown; values: any };

function mockDb(rows: unknown[] = []) {
  const writes: Write[] = [];
  const chain = (result: unknown[]): any => {
    const thenable = Promise.resolve(result) as any;
    for (const method of ["where", "orderBy", "limit", "innerJoin"]) thenable[method] = () => chain(result);
    return thenable;
  };
  vi.spyOn(db, "getDb").mockResolvedValue({
    select: () => ({ from: () => chain(rows) }),
    insert: (table: unknown) => ({ values: (values: any) => { writes.push({ op: "insert", table, values }); return Promise.resolve(); } }),
    update: (table: unknown) => ({ set: (values: any) => ({ where: () => { writes.push({ op: "update", table, values }); return Promise.resolve(); } }) }),
  } as never);
  return { writes };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(writeAudit).mockReset().mockResolvedValue(undefined as never);
});

describe("pemilihan teks catatan naratif", () => {
  it("memakai teks khusus periode ketika ada", async () => {
    mockDb([
      { noteKey: "PERISTIWA_SETELAH_PERIODE", periodKey: null, bodyText: "Teks umum", updatedAt: null },
      { noteKey: "PERISTIWA_SETELAH_PERIODE", periodKey: "2026-09", bodyText: "Teks September", updatedAt: null },
    ]);
    const notes = await buildNarrativeNotes({ to });
    const note = notes.find((row) => row.key === "PERISTIWA_SETELAH_PERIODE")!;
    expect(note.bodyText).toBe("Teks September");
    expect(note.scope).toBe("PERIODE");
  });

  it("jatuh ke teks yang berlaku terus ketika periodenya belum punya teks sendiri", async () => {
    mockDb([{ noteKey: "KEBIJAKAN_AKUNTANSI", periodKey: null, bodyText: "Persediaan periodik.", updatedAt: null }]);
    const note = (await buildNarrativeNotes({ to })).find((row) => row.key === "KEBIJAKAN_AKUNTANSI")!;
    expect(note.bodyText).toBe("Persediaan periodik.");
    expect(note.scope).toBe("BERLAKU_TERUS");
  });

  it("mengembalikan catatan kosong tanpa mengarang isinya", async () => {
    mockDb([]);
    const notes = await buildNarrativeNotes({ to });
    expect(notes).toHaveLength(7);
    expect(notes.every((note) => note.bodyText === "" && note.scope === null)).toBe(true);
    expect(notes.every((note) => note.guidance.length > 0)).toBe(true);
  });

  it("menyebutkan catatan yang belum diisi sebagai peringatan, bukan sebagai penghalang", async () => {
    mockDb([]);
    const result = await buildFinancialNotes({ from: new Date("2026-09-01T00:00:00"), to });
    expect(result.warnings.some((warning) => warning.startsWith("CALK belum lengkap: 7"))).toBe(true);
    // Delapan bangkitan ditambah tujuh naratif, disajikan pada urutan daftarnya.
    expect(result.notes).toHaveLength(15);
  });
});

describe("penyuntingan teks catatan", () => {
  it("menyisipkan baris baru ketika catatannya belum pernah diisi", async () => {
    const { writes } = mockDb([]);
    await saveFinancialNoteText({ noteKey: "KEBIJAKAN_AKUNTANSI", periodKey: null, bodyText: "  Persediaan periodik.  " }, controller);
    expect(writes[0]).toMatchObject({ op: "insert", table: financialStatementNotes, values: { noteKey: "KEBIJAKAN_AKUNTANSI", periodKey: null, bodyText: "Persediaan periodik." } });
  });

  it("memperbarui baris yang sudah ada, bukan menyisipkan yang kedua", async () => {
    const { writes } = mockDb([{ id: 3, noteKey: "KEBIJAKAN_AKUNTANSI", periodKey: null, bodyText: "Lama" }]);
    await saveFinancialNoteText({ noteKey: "KEBIJAKAN_AKUNTANSI", periodKey: null, bodyText: "Baru" }, controller);
    expect(writes.map((write) => write.op)).toEqual(["update"]);
  });

  it("menolak menyunting catatan yang dibangkitkan buku besar", async () => {
    // Membiarkannya diketik membuka jalan bagi angka CALK yang berselisih dengan laporannya.
    mockDb([]);
    await expect(saveFinancialNoteText({ noteKey: "ASET_TETAP", periodKey: null, bodyText: "x" }, controller))
      .rejects.toThrow(/dibangkitkan dari buku besar/);
  });

  it("menolak kunci catatan yang tidak dikenal", async () => {
    mockDb([]);
    await expect(saveFinancialNoteText({ noteKey: "TIDAK_ADA", periodKey: null, bodyText: "x" }, controller)).rejects.toThrow(/tidak dikenal/);
  });

  it("menolak kunci periode yang bukan YYYY-MM", async () => {
    mockDb([]);
    await expect(saveFinancialNoteText({ noteKey: "PIHAK_BERELASI", periodKey: "September", bodyText: "x" }, controller)).rejects.toThrow(/YYYY-MM/);
  });

  it("menulis jejak audit berisi teks sebelum dan sesudahnya", async () => {
    mockDb([{ id: 3, noteKey: "PIHAK_BERELASI", periodKey: null, bodyText: "Lama" }]);
    await saveFinancialNoteText({ noteKey: "PIHAK_BERELASI", periodKey: null, bodyText: "Baru" }, controller);
    expect(vi.mocked(writeAudit).mock.calls[0][0]).toMatchObject({
      action: "FINANCIAL_NOTE_UPDATED",
      beforeState: { bodyText: "Lama" },
      afterState: { bodyText: "Baru" },
    });
  });
});
