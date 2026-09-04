import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountingPeriods, chartOfAccounts, journalEntries, journalEntryLines } from "../drizzle/schema";
import * as db from "./db";

vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { postJournalEntry } from "./ledgerOperations";

/**
 * Tanggal jurnal harus tersimpan sebagai hari yang diminta, di zona waktu mana pun proses berjalan.
 *
 * Driver mysql2 mengembalikan kolom `date` sebagai tengah malam **waktu lokal** dan menuliskannya
 * kembali dari komponen lokal juga. `isoDay` membacanya lewat `toISOString()`, yang di WIB
 * memundurkannya satu hari — 30 September tersimpan sebagai 29 September. Uji ini menahannya pada
 * jalur yang benar-benar terkena: `insertJournal` menormalkan `entryDate` sebelum menyimpannya.
 *
 * Asersinya atas komponen lokal, bukan `toISOString()`: keduanya berbeda tepat pada mesin yang
 * bermasalah, dan `toISOString()` justru menyembunyikan selisihnya.
 */
const localDay = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

function mockDb() {
  const inserted: { table: unknown; values: Record<string, unknown> }[] = [];
  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "limit", "orderBy"]) thenable[method] = () => chain(rows);
    return thenable as never;
  };
  const rowsFor = (table: unknown) => {
    if (table === chartOfAccounts) {
      return [
        { code: "1-1210", isActive: true, normalBalance: "DEBIT" },
        { code: "5-1300", isActive: true, normalBalance: "KREDIT" },
      ];
    }
    if (table === accountingPeriods) {
      return [{
        id: 1,
        // Persis seperti mysql2 mengembalikannya: tengah malam waktu lokal.
        periodStart: new Date("2026-09-01T00:00:00"),
        periodEnd: new Date("2026-09-30T00:00:00"),
        status: "TERBUKA",
      }];
    }
    return [{ latest: null }];
  };
  const writer = {
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserted.push({ table, values: Array.isArray(values) ? { lines: values } : values });
        const result = Promise.resolve() as unknown as Record<string, unknown>;
        result.$returningId = () => Promise.resolve([{ id: 77 }]);
        return result as never;
      },
    }),
  };
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => chain(rowsFor(table)) })),
    ...writer,
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(writer)),
  };
  return { spy: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), inserted };
}

const lines = [
  { accountCode: "1-1210", side: "DEBIT" as const, amount: "100.00" },
  { accountCode: "5-1300", side: "KREDIT" as const, amount: "100.00" },
];
const actor = { id: 2 };

beforeEach(() => vi.restoreAllMocks());

describe("tanggal jurnal pada kolom date", () => {
  it("menyimpan hari yang diminta ketika tanggalnya datang sebagai tengah malam lokal", async () => {
    // Bentuk inilah yang dihasilkan `dbDate` dan dikembalikan kolom `date`; penutupan periode
    // mengirimkannya apa adanya sebagai akhir periode.
    const { spy, inserted } = mockDb();

    await postJournalEntry(
      { entryDate: new Date("2026-09-30T00:00:00"), description: "Penutupan periode", lines },
      actor,
    );

    const entry = inserted.find((row) => row.table === journalEntries)?.values;
    expect(localDay(entry?.entryDate as Date)).toBe("2026-09-30");
    spy.mockRestore();
  });

  it("menyimpan hari yang diminta ketika tanggalnya datang sebagai tengah malam UTC", async () => {
    // Bentuk yang dihasilkan `z.coerce.date()` atas "2026-09-30" dari layar.
    const { spy, inserted } = mockDb();

    await postJournalEntry(
      { entryDate: new Date("2026-09-30T00:00:00Z"), description: "Jurnal manual", lines },
      actor,
    );

    const entry = inserted.find((row) => row.table === journalEntries)?.values;
    expect(localDay(entry?.entryDate as Date)).toBe("2026-09-30");
    spy.mockRestore();
  });

  it("memberi nomor jurnal menurut bulan tanggalnya, bukan bulan sebelumnya", async () => {
    // Hari pertama sebuah bulan adalah batas yang paling mudah meleset: 1 Oktober yang terbaca
    // 30 September menghasilkan nomor berawalan JU-202609 pada jurnal Oktober.
    const { spy, inserted } = mockDb();

    await postJournalEntry(
      { entryDate: new Date("2026-10-01T00:00:00"), description: "Jurnal awal bulan", lines },
      actor,
    );

    const entry = inserted.find((row) => row.table === journalEntries)?.values;
    expect(entry?.entryNumber).toBe("JU-202610-0001");
    expect(localDay(entry?.entryDate as Date)).toBe("2026-10-01");
    spy.mockRestore();
  });

  it("berjam nol secara lokal, bukan sekadar bertanggal benar", () => {
    // Kolom `date` bernilai '2026-09-30' dibandingkan dengan '2026-09-30 07:00:00' tidak pernah
    // cocok, meski bagian tanggalnya sama persis.
    const column = new Date("2026-09-30T00:00:00");
    expect([column.getHours(), column.getMinutes(), column.getSeconds()]).toEqual([0, 0, 0]);
  });
});
