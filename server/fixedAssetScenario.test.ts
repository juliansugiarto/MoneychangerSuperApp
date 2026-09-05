import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import {
  accountingPeriods,
  fixedAssetDepreciationEntries,
  fixedAssetSettings,
  fixedAssets,
  journalEntries,
  journalEntryLines,
} from "../drizzle/schema";
import * as db from "./db";

/**
 * Skenario menyeluruh paket E: satu cerita dijalankan dari ujung ke ujung.
 *
 * Uji-uji lain memeriksa satu fungsi sekaligus dengan bacaan yang sudah disiapkan. Yang ini
 * menjalankan pendaftaran, tiga bulan penyusutan, gerbang penutupan periode, dan pelepasan **di
 * atas satu buku besar yang sama**, sehingga tulisan satu langkah menjadi bacaan langkah
 * berikutnya. Kekeliruan yang hanya muncul saat langkah-langkahnya bersambung — akumulasi yang
 * dibaca dari jadwal alih-alih dari baris yang dijurnal, bulan perolehan yang diambil dari
 * `firstJournalMonth` — tidak terlihat oleh uji per fungsi.
 *
 * `./ledgerOperations` ditambal hanya pada `postJournalEntry`: `closeAccountingPeriod` yang asli
 * ikut diuji, termasuk pemeriksaan keutuhan jurnal yang membaca jurnal yang benar-benar tercatat
 * pada buku besar palsu ini.
 */
vi.mock("./ledgerOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ledgerOperations")>();
  return { ...actual, postJournalEntry: vi.fn() };
});
vi.mock("./operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./operations")>();
  return { ...actual, writeAudit: vi.fn() };
});

import { closeAccountingPeriod, postJournalEntry } from "./ledgerOperations";
import { writeAudit } from "./operations";
import {
  TAX_GROUP_USEFUL_LIFE_MONTHS,
  disposeFixedAsset,
  postMonthlyDepreciation,
  registerFixedAsset,
} from "./fixedAssets";

const dbDay = (iso: string) => new Date(`${iso}T00:00:00`);

const actor = { id: 42 };

type MappedLine = { accountCode: string; side: "DEBIT" | "KREDIT"; amount: string; memo?: string | null };
type JournalEntryInput = {
  entryDate: Date;
  description: string;
  sourceType: string;
  sourceReference: string;
  lines: MappedLine[];
};
type StoredJournal = {
  id: number;
  entryNumber: string;
  entryDate: Date;
  description: string;
  sourceType: string;
  sourceReference: string;
  totalDebit: string;
  totalCredit: string;
};
type PeriodRow = {
  id: number;
  periodStart: Date;
  periodEnd: Date;
  status: "TERBUKA" | "DITUTUP";
  depreciationPostedAt: Date | null;
  depreciationJournalEntryId: number | null;
  valuationPostedAt: Date | null;
  profitClosingPostedAt: Date | null;
  closedAt: Date | null;
  closedByUserId: number | null;
  closingNotes: string | null;
};

const sum = (lines: MappedLine[], side: "DEBIT" | "KREDIT") =>
  lines.filter((line) => line.side === side).reduce((total, line) => total.plus(line.amount), new Decimal(0));

/**
 * Buku besar palsu yang **menyimpan** apa yang ditulis padanya.
 *
 * `getDb` dipalsukan; uji ini tidak menyentuh basis data. Kueri dibedakan lewat tabel yang diberikan
 * ke `from()` — pola `periodClosingPosting.test.ts` — dan, khusus untuk `journal_entries`, lewat ada
 * tidaknya daftar kolom: `verifyLedgerIntegrity` memilih seluruh kolom, sementara pencarian jurnal
 * penyusutan yang sudah tertulis memilih dua kolom saja. Bukan urutan pemanggilan.
 *
 * `where()` tidak dievaluasi — kondisi Drizzle bukan nilai yang dapat dibaca fake ini. Karena itu
 * periode yang sedang dikerjakan ditunjuk secara eksplisit lewat `pakaiPeriode`, dan tiap cerita
 * hanya memuat satu aset.
 */
function bukuBesar(options: { periods: PeriodRow[] }) {
  const periods = options.periods.map((period) => ({ ...period }));
  const assets: Record<string, unknown>[] = [];
  const depreciationEntries: Record<string, unknown>[] = [];
  const journals: StoredJournal[] = [];
  const lines: (MappedLine & { entryId: number })[] = [];
  let focus = periods[0];
  let nextAssetId = 1;
  let nextJournalId = 1;

  const focusMonth = () => `${focus.periodStart.getFullYear()}-${`${focus.periodStart.getMonth() + 1}`.padStart(2, "0")}`;

  const rowsFor = (table: unknown, fields: unknown): unknown[] => {
    if (table === accountingPeriods) return [focus, ...periods.filter((period) => period !== focus)];
    if (table === fixedAssets) return assets;
    if (table === fixedAssetDepreciationEntries) return depreciationEntries;
    if (table === fixedAssetSettings) return [];
    if (table === journalEntries) {
      if (!fields) return journals;
      const reference = `SUSUT-${focusMonth()}`;
      return journals.filter((entry) => entry.sourceType === "PENYUSUTAN" && entry.sourceReference === reference);
    }
    if (table === journalEntryLines) return lines;
    return [];
  };

  const chain = (rows: unknown[]): never => {
    const thenable = Promise.resolve(rows) as unknown as Record<string, unknown>;
    for (const method of ["where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy"]) {
      thenable[method] = () => chain(rows);
    }
    return thenable as never;
  };

  const writer = {
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        const rows = Array.isArray(values) ? values : [values];
        let inserted: { id: number }[] = [];
        if (table === fixedAssets) {
          inserted = rows.map((row) => {
            const id = nextAssetId++;
            assets.push({ id, ...(row as Record<string, unknown>) });
            return { id };
          });
        } else if (table === fixedAssetDepreciationEntries) {
          depreciationEntries.push(...(rows as Record<string, unknown>[]));
        }
        const done = Promise.resolve(inserted) as unknown as Record<string, unknown>;
        done.$returningId = () => Promise.resolve(inserted);
        return done as never;
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          if (table === accountingPeriods) Object.assign(focus, values);
          if (table === fixedAssets) Object.assign(assets[assets.length - 1], values);
          return Promise.resolve();
        },
      }),
    }),
  };

  const fakeDb = {
    select: vi.fn((fields?: unknown) => ({ from: (table: unknown) => chain(rowsFor(table, fields)) })),
    ...writer,
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(writer)),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);

  return {
    periods,
    assets,
    depreciationEntries,
    journals,
    lines,
    /** Menunjuk periode yang sedang dikerjakan; lihat keterangan fake di atas. */
    pakaiPeriode(month: string) {
      const found = periods.find(
        (period) => `${period.periodStart.getFullYear()}-${`${period.periodStart.getMonth() + 1}`.padStart(2, "0")}` === month,
      );
      if (!found) throw new Error(`Periode ${month} tidak ada pada cerita ini.`);
      focus = found;
      return found;
    },
    /** Pengganti `postJournalEntry`: mencatat jurnalnya supaya langkah berikutnya membacanya. */
    catatJurnal(entry: JournalEntryInput) {
      const debit = sum(entry.lines, "DEBIT");
      const credit = sum(entry.lines, "KREDIT");
      const id = nextJournalId++;
      const month = `${entry.entryDate.getFullYear()}${`${entry.entryDate.getMonth() + 1}`.padStart(2, "0")}`;
      const stored: StoredJournal = {
        id,
        entryNumber: `JU-${month}-${`${id}`.padStart(4, "0")}`,
        entryDate: entry.entryDate,
        description: entry.description,
        sourceType: entry.sourceType,
        sourceReference: entry.sourceReference,
        totalDebit: debit.toFixed(2),
        totalCredit: credit.toFixed(2),
      };
      journals.push(stored);
      lines.push(...entry.lines.map((line) => ({ ...line, entryId: id })));
      return { id, entryNumber: stored.entryNumber };
    },
    /** Saldo sebuah akun pada buku besar palsu: debit dikurangi kredit. */
    saldo(accountCode: string) {
      const own = lines.filter((line) => line.accountCode === accountCode);
      return sum(own, "DEBIT").minus(sum(own, "KREDIT")).toFixed(2);
    },
    jurnalBersumber(sourceType: string) {
      return journals.filter((entry) => entry.sourceType === sourceType);
    },
    barisJurnal(entryNumber: string) {
      const entry = journals.find((journal) => journal.entryNumber === entryNumber);
      return lines
        .filter((line) => line.entryId === entry?.id)
        .map((line) => [line.accountCode, line.side, line.amount]);
    },
  };
}

type Buku = ReturnType<typeof bukuBesar>;

/** Periode bulanan 2026 yang penilaian persediaannya sudah dijalankan — hanya penyusutan yang jadi soal. */
const bulan2026 = (month: number): PeriodRow => {
  const padded = `${month}`.padStart(2, "0");
  const start = dbDay(`2026-${padded}-01`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return {
    id: month,
    periodStart: start,
    periodEnd: end,
    status: "TERBUKA",
    depreciationPostedAt: null,
    depreciationJournalEntryId: null,
    valuationPostedAt: new Date("2026-01-01T00:00:00"),
    profitClosingPostedAt: null,
    closedAt: null,
    closedByUserId: null,
    closingNotes: null,
  };
};

/** Brankas Rp 24.000.000, kelompok 1 (48 bulan), 17 Maret 2026 → 500.000 sebulan. */
const daftarkanBrankas = () =>
  registerFixedAsset(
    {
      assetCode: "AT-001",
      name: "Brankas Chubb",
      category: "PERALATAN_KANTOR",
      taxGroup: "KELOMPOK_1",
      acquisitionDate: "2026-03-17",
      acquisitionCost: "24000000.00",
      usefulLifeMonths: TAX_GROUP_USEFUL_LIFE_MONTHS.KELOMPOK_1,
    },
    actor,
  );

const jalankanPenyusutan = async (buku: Buku, month: string) => {
  const period = buku.pakaiPeriode(month);
  return postMonthlyDepreciation({ periodId: period.id }, actor);
};

const pasangJurnalPalsu = (buku: Buku) => {
  vi.mocked(postJournalEntry).mockImplementation(async (entry) => buku.catatJurnal(entry as JournalEntryInput) as never);
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(postJournalEntry).mockReset();
  vi.mocked(writeAudit).mockReset().mockResolvedValue(undefined as never);
});

describe("perolehan → tiga bulan penyusutan → pelepasan", () => {
  it("menjalankan seluruh alurnya dan berakhir seimbang", async () => {
    const buku = bukuBesar({ periods: [bulan2026(3), bulan2026(4), bulan2026(5)] });
    pasangJurnalPalsu(buku);

    // 1. Perolehan: Dr 1-1510 / Cr 2-1900, tanpa menyentuh kas sama sekali.
    buku.pakaiPeriode("2026-03");
    const perolehan = await daftarkanBrankas();
    expect(buku.barisJurnal(perolehan.entryNumber!)).toEqual([
      ["1-1510", "DEBIT", "24000000.00"],
      ["2-1900", "KREDIT", "24000000.00"],
    ]);
    expect(buku.jurnalBersumber("PEROLEHAN_ASET")).toHaveLength(1);
    expect(buku.saldo("1-1110")).toBe("0.00");

    // 2. Maret, April, Mei — masing-masing 500.000. Bulan perolehan disusutkan penuh meskipun
    //    brankasnya baru dibeli tanggal 17.
    for (const month of ["2026-03", "2026-04", "2026-05"]) {
      const hasil = await jalankanPenyusutan(buku, month);
      expect(hasil.rows.map((row) => row.charge)).toEqual(["500000.00"]);
      expect(buku.jurnalBersumber("PENYUSUTAN").at(-1)!.sourceReference).toBe(`SUSUT-${month}`);
    }
    expect(buku.jurnalBersumber("PENYUSUTAN").map((entry) => entry.sourceReference)).toEqual([
      "SUSUT-2026-03",
      "SUSUT-2026-04",
      "SUSUT-2026-05",
    ]);
    expect(buku.saldo("6-1700")).toBe("1500000.00");
    expect(buku.saldo("1-1520")).toBe("-1500000.00");

    // 3. Pelepasan 31 Mei: nilai buku 22.500.000, hasil 23.000.000 → laba 500.000 ke 7-1400.
    buku.pakaiPeriode("2026-05");
    const pelepasan = await disposeFixedAsset(
      { assetId: 1, disposalDate: "2026-05-31", proceeds: "23000000.00" },
      actor,
    );
    expect(pelepasan.gainLoss).toBe("500000.00");
    expect(buku.barisJurnal(pelepasan.entryNumber)).toEqual([
      ["1-1320", "DEBIT", "23000000.00"],
      ["1-1520", "DEBIT", "1500000.00"],
      ["1-1510", "KREDIT", "24000000.00"],
      ["7-1400", "KREDIT", "500000.00"],
    ]);
    expect(buku.assets[0].status).toBe("DILEPAS");

    // 4. Brankasnya keluar dari neraca sepenuhnya, dan hasilnya tetap tidak menyentuh kas.
    expect(buku.saldo("1-1510")).toBe("0.00");
    expect(buku.saldo("1-1520")).toBe("0.00");
    expect(buku.saldo("1-1110")).toBe("0.00");
  });
});

describe("gerbang penutupan periode di dalam alur yang sama", () => {
  it("menolak menutup Maret sebelum penyusutannya dijurnal, lalu meloloskannya sesudah", async () => {
    const buku = bukuBesar({ periods: [bulan2026(3), bulan2026(4), bulan2026(5)] });
    pasangJurnalPalsu(buku);

    buku.pakaiPeriode("2026-03");
    await daftarkanBrankas();

    await expect(closeAccountingPeriod({ periodId: 3 }, actor)).rejects.toThrow(
      /penyusutan aset tetap belum dijurnal/i,
    );
    expect(buku.periods[0].status).toBe("TERBUKA");

    await jalankanPenyusutan(buku, "2026-03");
    expect(buku.periods[0].depreciationPostedAt).toBeInstanceOf(Date);

    buku.pakaiPeriode("2026-03");
    await expect(closeAccountingPeriod({ periodId: 3 }, actor)).resolves.toEqual({ id: 3 });
    expect(buku.periods[0].status).toBe("DITUTUP");
  });
});

describe("aset warisan", () => {
  it("melanjutkan sisa bulannya dan berakhir tepat pada nilai residu", async () => {
    // Perolehan Maret 2024, jurnal pertama September 2026, akumulasi awal 15.000.000.
    // 48 − 30 bulan terpakai = 18 bulan tersisa; (24.000.000 − 15.000.000) / 18 = 500.000.
    const periods = Array.from({ length: 18 }, (_, index) => {
      const start = new Date(2026, 8 + index, 1);
      return {
        ...bulan2026(1),
        id: 100 + index,
        periodStart: start,
        periodEnd: new Date(start.getFullYear(), start.getMonth() + 1, 0),
      };
    });
    const buku = bukuBesar({ periods });
    pasangJurnalPalsu(buku);

    await registerFixedAsset(
      {
        name: "Brankas Lama",
        category: "PERALATAN_KANTOR",
        taxGroup: "KELOMPOK_1",
        acquisitionDate: "2024-03-11",
        acquisitionCost: "24000000.00",
        usefulLifeMonths: 48,
        firstJournalMonth: "2026-09",
        openingAccumulatedDepreciation: "15000000.00",
      },
      actor,
    );
    // Aset warisan tidak dijurnal perolehannya: saldo 1-1510 dan 1-1520-nya masuk lewat SALDO_AWAL.
    expect(buku.journals).toHaveLength(0);
    expect(buku.assets[0].acquisitionJournalEntryId).toBeNull();

    const bulanan: string[] = [];
    for (const period of periods) {
      const month = `${period.periodStart.getFullYear()}-${`${period.periodStart.getMonth() + 1}`.padStart(2, "0")}`;
      const hasil = await jalankanPenyusutan(buku, month);
      bulanan.push(hasil.rows[0].charge);
    }

    expect(bulanan).toHaveLength(18);
    expect(new Set(bulanan)).toEqual(new Set(["500000.00"]));
    expect(buku.saldo("6-1700")).toBe("9000000.00");

    const terakhir = buku.depreciationEntries.at(-1) as Record<string, string>;
    expect(terakhir.periodMonth).toBe("2028-02");
    expect(terakhir.accumulatedAfter).toBe("24000000.00");
    expect(terakhir.carryingAfter).toBe("0.00");
  });
});

describe("idempotensi penyusutan", () => {
  it("dua kali menjalankan penyusutan bulan yang sama tidak pernah menghasilkan jurnal ganda", async () => {
    const buku = bukuBesar({ periods: [bulan2026(3), bulan2026(4)] });
    pasangJurnalPalsu(buku);

    buku.pakaiPeriode("2026-03");
    await daftarkanBrankas();
    await jalankanPenyusutan(buku, "2026-03");
    expect(buku.jurnalBersumber("PENYUSUTAN")).toHaveLength(1);

    // Percobaan kedua yang paling wajar: tombolnya ditekan lagi. Penanda periodenya menolaknya.
    await expect(jalankanPenyusutan(buku, "2026-03")).rejects.toThrow(/sudah dijalankan/i);
    expect(buku.jurnalBersumber("PENYUSUTAN")).toHaveLength(1);

    // Percobaan kedua yang lebih jahat: penandanya hilang tetapi baris rinciannya sudah ada —
    // keadaan yang tersisa bila transaksinya gagal sebagian. Baris yang ada menjadi penghalang.
    buku.periods[0].depreciationPostedAt = null;
    buku.periods[0].depreciationJournalEntryId = null;
    await expect(jalankanPenyusutan(buku, "2026-03")).rejects.toThrow(/sudah dijurnal/i);
    expect(buku.jurnalBersumber("PENYUSUTAN")).toHaveLength(1);

    // Dan yang paling halus: jurnalnya tertulis, tetapi baris rincian maupun penandanya belum.
    // Kunci (PENYUSUTAN, SUSUT-2026-03) dipakai ulang, bukan ditulis kedua kalinya.
    buku.depreciationEntries.length = 0;
    const sebelum = vi.mocked(postJournalEntry).mock.calls.length;
    await jalankanPenyusutan(buku, "2026-03");
    expect(vi.mocked(postJournalEntry).mock.calls).toHaveLength(sebelum);
    expect(buku.jurnalBersumber("PENYUSUTAN")).toHaveLength(1);
    expect(buku.saldo("6-1700")).toBe("500000.00");
    expect(buku.periods[0].depreciationJournalEntryId).toBe(buku.jurnalBersumber("PENYUSUTAN")[0].id);
  });
});
