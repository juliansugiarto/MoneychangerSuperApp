import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./financialStatements", () => ({ computeFinancialStatements: vi.fn() }));
vi.mock("./operations", () => ({
  getCompanyProfile: vi.fn(),
  listFinancialStatementSnapshots: vi.fn(),
  createFinancialStatementSnapshot: vi.fn(),
}));

import { buildBalanceSheet, buildEquityStatement, buildIncomeStatement, type StatementAccount } from "../shared/financialStatements";
import { buildFormValues } from "../shared/regulatoryFormValues";
import {
  LEDGER_SOURCE_LABEL,
  MissingReporterCodeError,
  assertFullFiscalYear,
  createFinancialFormExport,
  formExportFileName,
  snapshotRows,
} from "./financialFormExport";
import { computeFinancialStatements } from "./financialStatements";
import { createFinancialStatementSnapshot, getCompanyProfile, listFinancialStatementSnapshots } from "./operations";

const juta = (value: number) => BigInt(value) * 1_000_000n;

const SALDO = {
  "1-1110": juta(300),
  "1-1210": juta(200),
  "2-1900": juta(10),
  "3-1100": juta(500),
  "3-2100": juta(20),
  "4-1100": juta(100),
  "6-1100": juta(10),
};

function computed(balances: Record<string, bigint>) {
  const accounts: StatementAccount[] = Object.entries(balances).map(([accountCode, balance]) => ({ accountCode, balance }));
  const income = buildIncomeStatement(accounts, []);
  return {
    income,
    balanceSheet: buildBalanceSheet(accounts, [], income),
    equity: buildEquityStatement(accounts, [], income),
    warnings: [] as string[],
  };
}

const values = (balances: Record<string, bigint>) => {
  const parts = computed(balances);
  return buildFormValues({ balanceSheet: parts.balanceSheet, incomeStatement: parts.income, equityStatement: parts.equity }, 2025);
};

function arrange(balances: Record<string, bigint> = SALDO, existing: unknown[] = []) {
  vi.mocked(computeFinancialStatements).mockResolvedValue(computed(balances) as never);
  vi.mocked(getCompanyProfile).mockResolvedValue({ biReporterCode: "999999999" } as never);
  vi.mocked(listFinancialStatementSnapshots).mockResolvedValue(existing as never);
  vi.mocked(createFinancialStatementSnapshot).mockResolvedValue({ id: 77 } as never);
}

/** Baris snapshot buku besar tahun 2025 dari saldo tertentu, seperti yang tersimpan. */
const storedSnapshot = (balances: Record<string, bigint>, id = 55) => ({
  id,
  sourceLabel: LEDGER_SOURCE_LABEL,
  periodStart: new Date("2025-01-01T00:00:00Z"),
  periodEnd: new Date("2025-12-31T00:00:00Z"),
  balanceSheetRows: snapshotRows(values(balances).find((form) => form.code === "B0002")!),
  profitLossRows: snapshotRows(values(balances).find((form) => form.code === "B0003")!),
  equityRows: snapshotRows(values(balances).find((form) => form.code === "B0004")!),
});

describe("gerbang tahun buku penuh", () => {
  it("menerima 1 Januari sampai 31 Desember tahun yang sama", () => {
    expect(assertFullFiscalYear(new Date("2025-01-01T00:00:00Z"), new Date("2025-12-31T00:00:00Z"))).toBe(2025);
  });

  it("menolak rentang yang bukan tahun penuh dan menyebut tahun terdekat yang dapat diekspor", () => {
    expect(() => assertFullFiscalYear(new Date("2025-01-01T00:00:00Z"), new Date("2025-01-31T00:00:00Z"))).toThrow(/tahun terdekat.*2025/s);
    expect(() => assertFullFiscalYear(new Date("2025-03-01T00:00:00Z"), new Date("2026-02-28T00:00:00Z"))).toThrow(/bukan tahun penuh/);
    expect(() => assertFullFiscalYear(new Date("2025-01-01T00:00:00Z"), new Date("2025-12-30T00:00:00Z"))).toThrow(/Jenis Periode A/);
  });
});

describe("ekspor form dan snapshot bersumber buku besar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menghasilkan berkas bernama tahun bukunya", async () => {
    arrange();
    const result = await createFinancialFormExport({ year: 2025, actorUserId: 9 });
    expect(result.fileName).toBe(formExportFileName(2025));
    expect(result.fileName).toContain("2025");
    expect(result.workbook.byteLength).toBeGreaterThan(0);
  });

  it("menolak mengekspor tanpa Sandi Pelapor, sebelum menyentuh buku besar", async () => {
    arrange();
    vi.mocked(getCompanyProfile).mockResolvedValue({ biReporterCode: "  " } as never);
    await expect(createFinancialFormExport({ year: 2025, actorUserId: 9 })).rejects.toThrow(MissingReporterCodeError);
    expect(computeFinancialStatements).not.toHaveBeenCalled();
    expect(createFinancialStatementSnapshot).not.toHaveBeenCalled();
  });

  it("menulis satu snapshot bersumber Buku besar untuk tahun bukunya", async () => {
    arrange();
    const result = await createFinancialFormExport({ year: 2025, actorUserId: 9 });

    expect(result.snapshotCreated).toBe(true);
    expect(result.snapshotId).toBe(77);
    expect(createFinancialStatementSnapshot).toHaveBeenCalledTimes(1);

    const [input, actor] = vi.mocked(createFinancialStatementSnapshot).mock.calls[0]!;
    expect(actor).toBe(9);
    expect(input.sourceLabel).toBe("Buku besar");
    expect(input.sourceReference).toBe("Tahun buku 2025");
    expect(input.periodStart.toISOString().slice(0, 10)).toBe("2025-01-01");
    expect(input.periodEnd.toISOString().slice(0, 10)).toBe("2025-12-31");
  });

  it("memberi baris snapshot kunci baris form, bukan kode akun", async () => {
    arrange();
    await createFinancialFormExport({ year: 2025, actorUserId: 9 });
    const [input] = vi.mocked(createFinancialStatementSnapshot).mock.calls[0]!;

    expect(input.balanceSheetRows).toHaveLength(19);
    expect(input.profitLossRows).toHaveLength(25);
    expect(input.equityRows).toHaveLength(8);
    expect(input.balanceSheetRows.map((row) => row.code)).toContain("aset-kas-rp");
    expect(input.balanceSheetRows.map((row) => row.code)).not.toContain("1-1110");
    expect(input.equityRows.map((row) => row.code)).toContain("saldo-awal-positif:MODAL_DISETOR");
  });

  it("tidak menulis snapshot kedua bila tahun dan angkanya sama persis", async () => {
    arrange(SALDO, [storedSnapshot(SALDO)]);
    const result = await createFinancialFormExport({ year: 2025, actorUserId: 9 });

    expect(createFinancialStatementSnapshot).not.toHaveBeenCalled();
    expect(result.snapshotCreated).toBe(false);
    expect(result.snapshotId).toBe(55);
    expect(result.workbook.byteLength).toBeGreaterThan(0);
  });

  it("menulis snapshot baru bila angkanya berubah, sehingga riwayatnya utuh", async () => {
    arrange({ ...SALDO, "4-1100": juta(140) }, [storedSnapshot(SALDO)]);
    const result = await createFinancialFormExport({ year: 2025, actorUserId: 9 });

    expect(createFinancialStatementSnapshot).toHaveBeenCalledTimes(1);
    expect(result.snapshotCreated).toBe(true);
  });

  it("mengabaikan snapshot hasil impor ketika mencari kembarannya", async () => {
    const impor = { ...storedSnapshot(SALDO, 61), sourceLabel: "B0002-B0004" };
    arrange(SALDO, [impor]);
    await createFinancialFormExport({ year: 2025, actorUserId: 9 });
    expect(createFinancialStatementSnapshot).toHaveBeenCalledTimes(1);
  });

  it("mengabaikan snapshot buku besar tahun lain", async () => {
    const lain = { ...storedSnapshot(SALDO, 62), periodStart: new Date("2024-01-01T00:00:00Z"), periodEnd: new Date("2024-12-31T00:00:00Z") };
    arrange(SALDO, [lain]);
    await createFinancialFormExport({ year: 2025, actorUserId: 9 });
    expect(createFinancialStatementSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe("baris snapshot", () => {
  it("membawa nilai berdesimal dua angka seperti yang divalidasi penyimpannya", () => {
    const rows = snapshotRows(values(SALDO).find((form) => form.code === "B0002")!);
    for (const row of rows) expect(row.value, row.code).toMatch(/^-?\d+\.\d{2}$/);
  });

  it("tidak memuat baris subtotal", () => {
    const codes = snapshotRows(values(SALDO).find((form) => form.code === "B0002")!).map((row) => row.code);
    expect(codes).not.toContain("aset-jumlah");
    expect(codes).not.toContain("kewajiban-ekuitas-jumlah");
  });
});
