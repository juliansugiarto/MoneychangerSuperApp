import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountingPeriods,
  cashBalances,
  currencies,
  journalEntries,
  journalEntryLines,
  periodClosingValuations,
  rateReferenceSnapshots,
  stockOpnames,
} from "../drizzle/schema";
import * as db from "./db";

/**
 * `closeAccountingPeriod` yang asli ikut diuji di berkas ini, jadi `./ledgerOperations` hanya
 * ditambal pada dua fungsi yang dipanggil `periodClosing.ts` — bukan diganti seluruhnya.
 */
vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, postJournalEntry: vi.fn(), accountBalancesFor: vi.fn() };
});
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn(), getOpnameSystemCounts: vi.fn() };
});

import { accountBalancesFor, closeAccountingPeriod, postJournalEntry } from "./ledgerOperations";
import { postYearEndProfitClosing } from "./periodClosing";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

type Write = { op: "update" | "insert" | "delete"; table: unknown; values?: unknown };

function mockDb(reads: { table: unknown; results: unknown[][] }[]) {
  const queues = new Map(reads.map((entry) => [entry.table, [...entry.results]]));
  const writes: Write[] = [];
  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "orderBy", "limit"]) thenable[method] = () => chain(rows);
    return thenable as never;
  };
  const rowsFor = (table: unknown) => {
    const queue = queues.get(table) ?? [];
    return (queue.length > 1 ? queue.shift() : queue[0]) ?? [];
  };
  const writer = {
    delete: (table: unknown) => ({ where: () => { writes.push({ op: "delete", table }); return Promise.resolve(); } }),
    insert: (table: unknown) => ({ values: (values: unknown) => { writes.push({ op: "insert", table, values }); return Promise.resolve(); } }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({ where: () => { writes.push({ op: "update", table, values }); return Promise.resolve(); } }),
    }),
  };
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => chain(rowsFor(table)) })),
    ...writer,
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(writer)),
  };
  return { spy: vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never), writes };
}

const december = (overrides: Record<string, unknown> = {}) => ({
  id: 12,
  periodStart: dbDay("2026-12-01"),
  periodEnd: dbDay("2026-12-31"),
  status: "TERBUKA" as const,
  depreciationPostedAt: new Date("2027-01-02T03:00:00Z"),
  // Revaluasi kurs (paket F1) juga sudah dijalankan; gerbangnya punya berkasnya sendiri di
  // `revaluationGate.test.ts`.
  revaluationPostedAt: new Date("2027-01-02T03:00:00Z"),
  valuationPostedAt: new Date("2027-01-02T03:00:00Z"),
  profitClosingPostedAt: null,
  ...overrides,
});

const september = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  periodStart: dbDay("2026-09-01"),
  periodEnd: dbDay("2026-09-30"),
  status: "TERBUKA" as const,
  depreciationPostedAt: new Date("2026-10-01T03:00:00Z"),
  // Revaluasi kurs (paket F1) juga sudah dijalankan; gerbangnya punya berkasnya sendiri di
  // `revaluationGate.test.ts`.
  revaluationPostedAt: new Date("2026-10-01T03:00:00Z"),
  valuationPostedAt: new Date("2026-10-01T03:00:00Z"),
  profitClosingPostedAt: null,
  ...overrides,
});

/** Tabel yang tidak diatur sebuah uji mengembalikan kosong; buku besar kosong berarti utuh. */
const reads = (periods: unknown[][], extra: { balances?: unknown[]; journal?: unknown[] } = {}) => [
  { table: accountingPeriods, results: periods },
  { table: journalEntries, results: [extra.journal ?? []] },
  { table: journalEntryLines, results: [[]] },
  { table: currencies, results: [[]] },
  { table: stockOpnames, results: [[]] },
  { table: rateReferenceSnapshots, results: [[]] },
  { table: periodClosingValuations, results: [[]] },
  { table: cashBalances, results: [[]] },
];

/**
 * Dua belas bulan tahun buku, seluruhnya sudah disusutkan.
 *
 * `postYearEndProfitClosing` membacanya sebelum penutupan tahunan sebelumnya (paket E): penutup
 * laba menolkan 6-1700, jadi bebannya harus lengkap lebih dulu.
 */
const twelveMonthsPosted = Array.from({ length: 12 }, (_, index) => ({
  periodStart: dbDay(`2026-${`${index + 1}`.padStart(2, "0")}-01`),
  depreciationPostedAt: new Date("2027-01-02T03:00:00Z"),
  revaluationPostedAt: new Date("2027-01-02T03:00:00Z"),
}));

const actor = { id: 42 };

beforeEach(() => {
  vi.mocked(postJournalEntry).mockReset().mockResolvedValue({ id: 4100, entryNumber: "JU-2026-12-0099" } as never);
  vi.mocked(accountBalancesFor).mockReset().mockResolvedValue([]);
});

describe("gerbang penutupan periode", () => {
  it("menolak menutup periode yang persediaan akhirnya belum dinilai", async () => {
    // Mengunci tanpa menilai adalah keadaan yang berlaku sampai paket C, dan justru itu yang
    // membuat 1-1210 Kas UKA berhenti nol selamanya.
    const { spy, writes } = mockDb(reads([[september({ valuationPostedAt: null })]]));

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/penilaian persediaan/i);
    expect(writes).toEqual([]);
    spy.mockRestore();
  });

  it("menolak menutup Desember selama jurnal penutup labanya belum dijalankan", async () => {
    const { spy, writes } = mockDb(reads([[december()]]));

    await expect(closeAccountingPeriod({ periodId: 12 }, actor)).rejects.toThrow(/penutup laba/i);
    expect(writes).toEqual([]);
    spy.mockRestore();
  });

  it("meloloskan periode bukan Desember yang sudah dinilai, seperti sebelumnya", async () => {
    const { spy, writes } = mockDb(reads([[september()]]));

    await expect(closeAccountingPeriod({ periodId: 9, notes: "tutup bulanan" }, actor)).resolves.toEqual({ id: 9 });
    expect(writes).toEqual([
      expect.objectContaining({ table: accountingPeriods, values: expect.objectContaining({ status: "DITUTUP" }) }),
    ]);
    spy.mockRestore();
  });

  it("tetap memeriksa keutuhan jurnal lebih dulu, sebelum syarat penilaian", async () => {
    // Urutannya jangan dibalik: jurnal yang tidak utuh adalah masalah yang lebih besar, dan
    // pesannyalah yang harus sampai lebih dulu.
    const { spy } = mockDb(
      reads([[september({ valuationPostedAt: null })]], {
        journal: [{ id: 1, entryNumber: "JU-2026-09-0001", totalDebit: "10.00", totalCredit: "10.00" }],
      }),
    );

    await expect(closeAccountingPeriod({ periodId: 9 }, actor)).rejects.toThrow(/tidak utuh/i);
    spy.mockRestore();
  });
});

describe("postYearEndProfitClosing", () => {
  it("menolak periode yang tidak berakhir 31 Desember", async () => {
    const { spy } = mockDb(reads([[september()], []]));

    await expect(postYearEndProfitClosing({ periodId: 9 }, actor)).rejects.toThrow(/31 Desember/i);
    expect(postJournalEntry).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("menolak selama persediaan akhir Desember belum dinilai", async () => {
    // Persediaan akhir ikut menentukan harga pokok, jadi ikut menentukan labanya. Menutup laba
    // lebih dulu memindahkan angka yang belum lengkap ke Laba Ditahan.
    const { spy } = mockDb(reads([[december({ valuationPostedAt: null })], []]));

    await expect(postYearEndProfitClosing({ periodId: 12 }, actor)).rejects.toThrow(/penilaian persediaan/i);
    spy.mockRestore();
  });

  it("menolak dijalankan dua kali", async () => {
    const { spy } = mockDb(reads([[december({ profitClosingPostedAt: new Date("2027-01-03T03:00:00Z") })], []]));

    await expect(postYearEndProfitClosing({ periodId: 12 }, actor)).rejects.toThrow(/sudah dijalankan/i);
    spy.mockRestore();
  });

  it("menjurnal saldo laba rugi sejak penutupan tahunan sebelumnya, bersumber TUTUP-LABA-{tahun}", async () => {
    vi.mocked(accountBalancesFor).mockResolvedValue([
      { accountCode: "4-1100", balance: 50000000000n },
      { accountCode: "5-1200", balance: 43000000000n },
    ] as never);
    // Periode ini, lalu periode dinilai sebelumnya (dibaca `buildPeriodValuation`), lalu penutupan
    // tahunan sebelumnya yang menentukan tanggal mulainya.
    const { spy, writes } = mockDb(reads([[december()], [], twelveMonthsPosted, [{ periodEnd: dbDay("2025-12-31") }]]));

    const result = await postYearEndProfitClosing({ periodId: 12 }, actor);

    expect(accountBalancesFor).toHaveBeenCalledWith({ from: "2026-01-01", to: "2026-12-31" });
    expect(postJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        entryDate: dbDay("2026-12-31"),
        sourceType: "TUTUP_PERIODE",
        sourceReference: "TUTUP-LABA-2026",
        lines: [
          expect.objectContaining({ accountCode: "4-1100", side: "DEBIT", amount: "500000000.00" }),
          expect.objectContaining({ accountCode: "5-1200", side: "KREDIT", amount: "430000000.00" }),
          expect.objectContaining({ accountCode: "3-2100", side: "KREDIT", amount: "70000000.00" }),
        ],
      }),
      actor,
    );
    expect(result.entryNumber).toBe("JU-2026-12-0099");
    expect(writes).toEqual([
      expect.objectContaining({
        table: accountingPeriods,
        values: expect.objectContaining({ profitClosingPostedAt: expect.any(Date), profitClosingJournalEntryId: 4100 }),
      }),
    ]);
    spy.mockRestore();
  });

  it("menghitung sejak awal pembukuan bila belum pernah ada penutupan tahunan", async () => {
    const { spy } = mockDb(reads([[december()], [], twelveMonthsPosted, []]));

    await postYearEndProfitClosing({ periodId: 12 }, actor);

    expect(accountBalancesFor).toHaveBeenCalledWith({ from: undefined, to: "2026-12-31" });
    spy.mockRestore();
  });

  it("tetap menandai tahun sudah ditutup meski tidak ada saldo laba rugi untuk dijurnal", async () => {
    const { spy, writes } = mockDb(reads([[december()], [], twelveMonthsPosted, []]));

    const result = await postYearEndProfitClosing({ periodId: 12 }, actor);

    expect(postJournalEntry).not.toHaveBeenCalled();
    expect(result.skipped).toMatch(/tidak ada saldo/i);
    expect(writes).toEqual([
      expect.objectContaining({ values: expect.objectContaining({ profitClosingJournalEntryId: null }) }),
    ]);
    spy.mockRestore();
  });
});
