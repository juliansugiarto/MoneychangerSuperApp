import { describe, expect, it, vi, beforeEach } from "vitest";
import * as db from "./db";
import { screenCustomer, summarizeScreeningMatches, SCREENING_SUMMARY_MAX_LENGTH } from "./customerWatchlistScreening";
import { isScreeningStale } from "../shared/customerHighRisk";

/**
 * Penulis penyaringan nasabah terhadap DTTOT/DPPSPM.
 *
 * Dua uji di bawah ini adalah inti paket ini: baris ditulis meski nihil (bukti yang dicari
 * pemeriksa justru baris nihilnya), dan `dttotPpsdmMatch` tidak pernah tersentuh (mesin mencatat
 * kemungkinan, manusia yang memutuskan).
 */

/**
 * Pasangan kolom-nilai terikat pada klausa Drizzle — disalin dari `server/iraDataForm.test.ts`,
 * bukan dari basis data palsu yang mengabaikan `where`.
 */
function boundValues(clause: unknown): Record<string, unknown[]> {
  const pairs: Record<string, unknown[]> = {};
  let lastColumn: string | null = null;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const candidate = node as { name?: unknown; value?: unknown; queryChunks?: unknown[]; columnType?: unknown };
    if (typeof candidate.name === "string" && candidate.columnType) lastColumn = candidate.name;
    else if (lastColumn && "value" in candidate && !Array.isArray(candidate.value)) {
      (pairs[lastColumn] ??= []).push(candidate.value);
    }
    if (Array.isArray(candidate.queryChunks)) candidate.queryChunks.forEach(walk);
  };
  walk(clause);
  return pairs;
}

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    innerJoin: () => makeReader(rows),
    leftJoin: () => makeReader(rows),
    where: (clause: unknown) => {
      const pairs = boundValues(clause);
      return makeReader(rows.filter((row) => Object.entries(pairs).every(([key, values]) => {
        const record = row as Record<string, unknown>;
        if (!(key in record)) return true;
        return values.some((value) => value instanceof Date && record[key] instanceof Date ? true : record[key] === value);
      })));
    },
    orderBy: () => makeReader(rows),
    limit: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

type Inserted = { table: string; values: Record<string, unknown> };

function mockDb(rowsByTable: Record<string, unknown[]>) {
  const inserted: Inserted[] = [];
  const updated: string[] = [];
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => makeReader(rowsByTable[tableName(table)] ?? []) })),
    insert: vi.fn((table: unknown) => ({
      values: async (values: Record<string, unknown>) => { inserted.push({ table: tableName(table), values }); },
    })),
    update: vi.fn((table: unknown) => {
      updated.push(tableName(table));
      return { set: () => ({ where: async () => {} }) };
    }),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { inserted, updated };
}

/** Satu baris daftar sanksi yang lengkap seperlunya bagi `searchSanctionsWatchlist`. */
function entriDaftar(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1, listType: "DTTOT", sourceLabel: "DTTOT 2026", entityType: "INDIVIDUAL", referenceCode: "IDN-001",
    fullName: "ABDUL RAHMAN SALEH", aliases: null, dateOfBirth: null, placeOfBirth: null, nationality: null,
    address: null, description: null, sourceFileName: "dttot.xlsx", importedByUserId: 1,
    importedAt: new Date("2026-09-01T03:00:00Z"),
    ...overrides,
  };
}

const penyaringan = "customer_watchlist_screenings";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("screenCustomer", () => {
  it("menulis baris meski TIDAK ada kecocokan — nihil adalah buktinya", async () => {
    const { inserted } = mockDb({ sanctions_watchlist_entries: [entriDaftar()] });

    const hasil = await screenCustomer({ customerId: 7, fullName: "BUDI SANTOSO WIJAYA", trigger: "NASABAH_DIBUAT", screenedByUserId: 3 });

    expect(hasil.matchCount).toBe(0);
    const baris = inserted.filter((row) => row.table === penyaringan);
    expect(baris).toHaveLength(1);
    expect(baris[0].values).toMatchObject({ customerId: 7, matchCount: 0, trigger: "NASABAH_DIBUAT", screenedByUserId: 3, summary: null });
  });

  it("mencatat listSnapshotAt dari importedAt terbaru yang sedang termuat", async () => {
    const terbaru = new Date("2026-09-08T04:00:00Z");
    const { inserted } = mockDb({
      sanctions_watchlist_entries: [
        entriDaftar({ id: 1, importedAt: new Date("2026-07-01T03:00:00Z") }),
        entriDaftar({ id: 2, fullName: "SITI AMINAH", listType: "DPPSPM", importedAt: terbaru }),
        entriDaftar({ id: 3, fullName: "JOKO PRABOWO", importedAt: new Date("2026-08-11T03:00:00Z") }),
      ],
    });

    await screenCustomer({ customerId: 7, fullName: "BUDI SANTOSO WIJAYA", trigger: "NASABAH_DIUBAH", screenedByUserId: 3 });

    const baris = inserted.find((row) => row.table === penyaringan)!;
    expect(baris.values.listSnapshotAt).toEqual(terbaru);
  });

  it("listSnapshotAt null bila belum ada daftar sama sekali", async () => {
    const { inserted } = mockDb({ sanctions_watchlist_entries: [] });

    const hasil = await screenCustomer({ customerId: 7, fullName: "BUDI SANTOSO WIJAYA", trigger: "NASABAH_DIBUAT", screenedByUserId: 3 });

    expect(hasil.listSnapshotAt).toBeNull();
    expect(inserted.find((row) => row.table === penyaringan)!.values.listSnapshotAt).toBeNull();
  });

  it("screenedByUserId null saat dipicu sistem", async () => {
    const { inserted } = mockDb({ sanctions_watchlist_entries: [] });

    await screenCustomer({ customerId: 7, fullName: "BUDI SANTOSO WIJAYA", trigger: "DAFTAR_DIIMPOR", screenedByUserId: null });

    expect(inserted.find((row) => row.table === penyaringan)!.values).toMatchObject({ screenedByUserId: null, trigger: "DAFTAR_DIIMPOR" });
  });

  it("TIDAK pernah menyentuh dttotPpsdmMatch", async () => {
    const { inserted, updated } = mockDb({ sanctions_watchlist_entries: [entriDaftar()] });

    // Nama yang persis sama dengan entri daftar: kecocokan sekuat mungkin, dan tetap tidak
    // mengubah apa pun pada nasabahnya.
    const hasil = await screenCustomer({ customerId: 7, fullName: "ABDUL RAHMAN SALEH", trigger: "NASABAH_DIBUAT", screenedByUserId: 3 });

    expect(hasil.matchCount).toBe(1);
    expect(updated).toEqual([]);
    expect(inserted.every((row) => row.table === penyaringan)).toBe(true);
    expect(inserted.every((row) => !("dttotPpsdmMatch" in row.values))).toBe(true);
  });

  it("mencatat ringkasan yang menyebut nama dan skornya saat ada kecocokan", async () => {
    const { inserted } = mockDb({ sanctions_watchlist_entries: [entriDaftar()] });

    await screenCustomer({ customerId: 7, fullName: "ABDUL RAHMAN SALEH", trigger: "MANUAL", screenedByUserId: 3 });

    const summary = inserted.find((row) => row.table === penyaringan)!.values.summary as string;
    expect(summary).toContain("ABDUL RAHMAN SALEH");
    expect(summary).toContain("DTTOT");
    expect(summary).toContain("1.00");
  });

  it("nama terlalu pendek untuk disaring tetap menghasilkan baris, bukan galat", async () => {
    const { inserted } = mockDb({ sanctions_watchlist_entries: [entriDaftar()] });

    const hasil = await screenCustomer({ customerId: 7, fullName: "AB", trigger: "NASABAH_DIBUAT", screenedByUserId: 3 });

    expect(hasil.matchCount).toBe(0);
    expect(inserted.find((row) => row.table === penyaringan)!.values.summary).toContain("terlalu pendek");
  });
});

describe("summarizeScreeningMatches", () => {
  const cocok = (fullName: string, score: number) => ({
    id: 1, listType: "DTTOT" as const, sourceLabel: null, entityType: "INDIVIDUAL" as const, referenceCode: "IDN-001",
    fullName, matchedOn: fullName, score, dateOfBirth: "1970-01-01", placeOfBirth: "JAKARTA", nationality: "ID",
    address: "Jalan Panjang Sekali Nomor Seratus Dua Puluh Tiga", description: "Uraian panjang dari daftar sanksi",
  });

  it("nihil berarti null, bukan untaian kosong", () => {
    expect(summarizeScreeningMatches([])).toBeNull();
  });

  it("tidak menyimpan alamat maupun uraian baris daftar sanksi", () => {
    const summary = summarizeScreeningMatches([cocok("ABDUL RAHMAN SALEH", 0.91)])!;
    expect(summary).not.toContain("Jalan Panjang");
    expect(summary).not.toContain("Uraian panjang");
  });

  it("dibatasi panjangnya dan menyebut sisanya bila kecocokannya banyak", () => {
    const banyak = Array.from({ length: 25 }, (_, index) => cocok(`NAMA PANJANG SEKALI NOMOR ${index} DARI DAFTAR SANKSI`, 0.7));
    const summary = summarizeScreeningMatches(banyak)!;
    expect(summary.length).toBeLessThanOrEqual(SCREENING_SUMMARY_MAX_LENGTH);
    expect(summary).toMatch(/dan \d+ lainnya/);
  });
});

/**
 * Pemanggilnya pada jalur simpan nasabah. Yang diuji di sini bukan pencocokannya lagi, melainkan
 * dua hal yang menentukan apakah jejaknya sungguh terkumpul: barisnya ditulis saat nasabah dibuat
 * dan diubah, dan kegagalan penyaringan **tidak** menjatuhkan penyimpanan nasabahnya.
 */
describe("pemanggil pada createCustomer dan updateCustomer", () => {
  const nasabahLama = {
    id: 1, cifNumber: "TEST-CIF-0001", fullName: "Nasabah Lama", phoneNumber: "081100000000", identityType: "KTP" as const, identityNumber: "1234",
    identityExpiryDate: null, placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), gender: "MALE" as const, nationality: "ID",
    address: "Jl. Lama", addressType: "RUMAH" as const, addressCountry: "ID", addressProvince: null, addressCity: "Jakarta",
    addressDistrict: null, addressPostalCode: null, npwp: null, occupation: "Pegawai",
    sourceOfFunds: "Gaji", transactionPurpose: "Liburan", profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const, riskNotes: null,
    pepStatus: "NONE" as const, pepDetails: null, dttotPpsdmMatch: false, dttotPpsdmNotes: null, isDemo: false, isHistorical: false,
    declaredMonthlyValueIdr: null, declaredMonthlyCount: null, declaredCurrencies: null,
    customerType: null, entityLegalForm: null, occupationCategory: null,
  };

  /** `gagalkanDaftar` membuat pembacaan daftar sanksi melemparkan galat — persis keadaan yang tidak boleh menjatuhkan penyimpanan. */
  function mockCustomerDb(gagalkanDaftar = false) {
    const inserted: Inserted[] = [];
    const reader = (table: unknown) => {
      const name = tableName(table);
      if (name === "sanctions_watchlist_entries" && gagalkanDaftar) {
        return { from: () => reader(table), where: () => reader(table), limit: () => reader(table), orderBy: () => reader(table),
          then: (_ok: any, onrejected: any) => Promise.reject(new Error("Daftar sanksi tidak dapat dibaca.")).then(undefined, onrejected) } as never;
      }
      if (name === "currencies") return makeReader([{ id: 1, code: "USD", name: "Dolar Amerika Serikat", active: true }]);
      if (name === "sanctions_watchlist_entries") return makeReader([]);
      return makeReader([nasabahLama]);
    };
    const fakeDb: Record<string, unknown> = {
      select: vi.fn(() => ({ from: (table: unknown) => reader(table) })),
      insert: vi.fn((table: unknown) => ({ values: (values: Record<string, unknown>) => { inserted.push({ table: tableName(table), values }); return Promise.resolve(undefined); } })),
      update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),
    };
    fakeDb.transaction = vi.fn((run: (tx: unknown) => Promise<unknown>) => run(fakeDb));
    vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
    return { inserted };
  }

  const ubahInput = {
    customerId: 1, changeReason: "Pembaruan alamat nasabah",
    fullName: "Nasabah Lama", phoneNumber: "081100000000", identityType: "KTP" as const, identityNumber: "1234",
    placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), gender: "MALE" as const, nationality: "ID",
    address: "Jl. Baru", addressType: "RUMAH" as const, addressCountry: "ID", addressCity: "Jakarta",
    occupation: "Pegawai", sourceOfFunds: "Gaji", transactionPurpose: "Liburan",
    profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const, pepStatus: "NONE" as const, dttotPpsdmMatch: false,
  };

  it("nasabah yang baru dibuat langsung punya baris penyaringan", async () => {
    const { inserted } = mockCustomerDb();
    const { createCustomer } = await import("./operations");
    const { v1Fixtures } = await import("./v1Fixtures");

    await createCustomer({ ...v1Fixtures.customer }, 3);

    const baris = inserted.filter((row) => row.table === penyaringan);
    expect(baris).toHaveLength(1);
    expect(baris[0].values).toMatchObject({ customerId: 1, trigger: "NASABAH_DIBUAT", screenedByUserId: 3, matchCount: 0 });
  });

  it("nasabah yang disunting disaring ulang dengan nama sesudahnya", async () => {
    const { inserted } = mockCustomerDb();
    const { updateCustomer } = await import("./operations");

    await updateCustomer(ubahInput, { id: 5, role: "ADMIN" });

    const baris = inserted.filter((row) => row.table === penyaringan);
    expect(baris).toHaveLength(1);
    expect(baris[0].values).toMatchObject({ customerId: 1, trigger: "NASABAH_DIUBAH", screenedByUserId: 5 });
  });

  it("penyaringan yang gagal tidak menggagalkan penyimpanan, dan kegagalannya masuk audit_logs", async () => {
    const { inserted } = mockCustomerDb(true);
    const { createCustomer } = await import("./operations");
    const { v1Fixtures } = await import("./v1Fixtures");

    const created = await createCustomer({ ...v1Fixtures.customer }, 3);

    expect(created.id).toBe(1);
    expect(inserted.filter((row) => row.table === penyaringan)).toHaveLength(0);
    const audit = inserted.filter((row) => row.table === "audit_logs").map((row) => row.values.action);
    expect(audit).toContain("CUSTOMER_SCREENING_FAILED");
  });
});

/**
 * Penyaringan ulang massal sesudah daftar sanksi diimpor.
 *
 * Daftar yang baru masuk tidak ada gunanya bila nasabah lama tetap dinilai terhadap daftar yang
 * kemarin: tanpa langkah ini, seorang nasabah yang baru hari ini muncul di DTTOT tidak akan pernah
 * terlihat sampai ada yang kebetulan menyunting profilnya.
 */
describe("penyaringan ulang massal saat daftar diimpor", () => {
  const dttotHeader = ["Nama", "Deskripsi", "Terduga", "Kode Densus", "Tempat Lahir", "Tanggal Lahir", "WN/Asal Negara", "Alamat"];

  async function workbookBase64(rows: unknown[][]) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return { base64: buffer.toString("base64"), byteSize: buffer.byteLength };
  }

  const nasabahAktif = [
    { id: 11, fullName: "Contoh Orang Uji", isDemo: false, isHistorical: false },
    { id: 12, fullName: "Budi Santoso Wijaya", isDemo: false, isHistorical: false },
    { id: 13, fullName: "Siti Aminah Lestari", isDemo: false, isHistorical: false },
  ];

  /**
   * Basis data palsu yang menyambungkan impor dengan penyaringan ulangnya: entri yang ditulis
   * transaksi impor itulah yang dibaca kembali oleh penyaringan ulang, sehingga `listSnapshotAt`
   * yang diuji sungguh berasal dari impor tersebut, bukan dari nilai yang dipasang uji ini.
   */
  function mockImportDb(nasabah = nasabahAktif) {
    let daftar: Record<string, unknown>[] = [];
    const inserted: Inserted[] = [];
    const catat = (table: unknown, values: unknown) => {
      const name = tableName(table);
      const rows = Array.isArray(values) ? values : [values];
      for (const row of rows) inserted.push({ table: name, values: row as Record<string, unknown> });
      if (name === "sanctions_watchlist_entries") daftar = rows as Record<string, unknown>[];
    };
    const fakeTx = {
      delete: vi.fn(() => ({ where: () => Promise.resolve() })),
      insert: vi.fn((table: unknown) => ({ values: (values: unknown) => { catat(table, values); return Promise.resolve(); } })),
    };
    const fakeDb = {
      transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(fakeTx)),
      select: vi.fn(() => ({ from: (table: unknown) => makeReader(tableName(table) === "sanctions_watchlist_entries" ? daftar : nasabah) })),
      insert: vi.fn((table: unknown) => ({ values: (values: unknown) => { catat(table, values); return Promise.resolve(); } })),
    };
    vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
    return { inserted };
  }

  async function impor(inserted: () => Inserted[]) {
    const { base64, byteSize } = await workbookBase64([
      dttotHeader,
      ["Contoh Orang Uji alias Nama Alias Uji", "- keterangan", "Orang", "TEST-001", "Kota Uji", "01/01/1980", "Indonesia", "Jalan Uji"],
    ]);
    const { importSanctionsWatchlist } = await import("./operations");
    await importSanctionsWatchlist({
      dataBase64: base64, originalFileName: "dttot-uji.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize, actorUserId: 9,
    });
    return inserted().filter((row) => row.table === penyaringan);
  }

  it("menyaring ulang SELURUH nasabah aktif sesudah impor, satu baris per nasabah", async () => {
    const { inserted } = mockImportDb();

    const baris = await impor(() => inserted);

    expect(baris.map((row) => row.values.customerId).sort()).toEqual([11, 12, 13]);
    // Nasabah yang namanya cocok tetap hanya satu baris, dan yang tidak cocok tetap dapat barisnya.
    expect(baris.find((row) => row.values.customerId === 11)!.values.matchCount).toBe(1);
    expect(baris.find((row) => row.values.customerId === 12)!.values.matchCount).toBe(0);
  });

  it("memakai trigger DAFTAR_DIIMPOR dan screenedByUserId null", async () => {
    const { inserted } = mockImportDb();

    const baris = await impor(() => inserted);

    expect(baris.every((row) => row.values.trigger === "DAFTAR_DIIMPOR")).toBe(true);
    // Impor dijalankan seseorang, tetapi penyaringan ulangnya dijalankan sistem.
    expect(baris.every((row) => row.values.screenedByUserId === null)).toBe(true);
  });

  it("listSnapshotAt seluruh baris barunya sama dengan importedAt impor itu", async () => {
    const { inserted } = mockImportDb();

    const baris = await impor(() => inserted);

    const importedAt = inserted.find((row) => row.table === "sanctions_watchlist_entries")!.values.importedAt as Date;
    expect(importedAt).toBeInstanceOf(Date);
    expect(baris.every((row) => row.values.listSnapshotAt === importedAt)).toBe(true);
  });

  it("penyaringan ulang yang gagal tidak membatalkan daftar yang sudah masuk", async () => {
    const { inserted } = mockImportDb();
    const { importSanctionsWatchlist } = await import("./operations");
    const screening = await import("./customerWatchlistScreening");
    vi.spyOn(screening, "rescreenAllCustomers").mockRejectedValue(new Error("Penyaringan ulang gagal."));
    const { base64, byteSize } = await workbookBase64([
      dttotHeader,
      ["Contoh Orang Uji", "- keterangan", "Orang", "TEST-001", "Kota Uji", "01/01/1980", "Indonesia", "Jalan Uji"],
    ]);

    const hasil = await importSanctionsWatchlist({
      dataBase64: base64, originalFileName: "dttot-uji.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize, actorUserId: 9,
    });

    expect(hasil.recordCount).toBe(1);
    expect(inserted.some((row) => row.table === "sanctions_watchlist_entries")).toBe(true);
    expect(inserted.filter((row) => row.table === "audit_logs").map((row) => row.values.action)).toContain("CUSTOMER_RESCREENING_FAILED");
  });
});

/**
 * Penanda daftar usang — yang membedakan panel riwayat dari hiasan.
 */
describe("isScreeningStale", () => {
  const kemarin = new Date("2026-09-08T04:00:00Z");
  const hariIni = new Date("2026-09-09T04:00:00Z");

  it("penyaringan terhadap daftar yang sudah tersusul dinyatakan usang", () => {
    expect(isScreeningStale(kemarin, hariIni)).toBe(true);
  });

  it("penyaringan terhadap daftar terbaru tidak usang", () => {
    expect(isScreeningStale(hariIni, hariIni)).toBe(false);
  });

  it("belum ada daftar sama sekali berarti tidak ada yang dapat usang", () => {
    expect(isScreeningStale(null, null)).toBe(false);
    expect(isScreeningStale(kemarin, null)).toBe(false);
  });

  it("disaring sebelum daftar mana pun dimuat, lalu daftarnya masuk: usang", () => {
    expect(isScreeningStale(null, hariIni)).toBe(true);
  });
});

describe("rescreenCustomerNow", () => {
  it("menulis baris bertrigger MANUAL atas nama petugas yang memintanya", async () => {
    const { inserted } = mockDb({
      sanctions_watchlist_entries: [entriDaftar()],
      customers: [{ id: 7, fullName: "ABDUL RAHMAN SALEH", isDemo: false, isHistorical: false }],
    });
    const { rescreenCustomerNow } = await import("./customerWatchlistScreening");

    await rescreenCustomerNow(7, 5);

    const baris = inserted.find((row) => row.table === penyaringan)!;
    expect(baris.values).toMatchObject({ customerId: 7, trigger: "MANUAL", screenedByUserId: 5, matchCount: 1 });
  });

  it("nasabah yang tidak ada menolak dengan jelas, bukan menulis baris kosong", async () => {
    const { inserted } = mockDb({ sanctions_watchlist_entries: [], customers: [] });
    const { rescreenCustomerNow } = await import("./customerWatchlistScreening");

    await expect(rescreenCustomerNow(99, 5)).rejects.toThrow(/tidak ditemukan/);
    expect(inserted).toHaveLength(0);
  });
});

/**
 * Waktu penyaringan ditulis penulisnya sendiri, bukan `DEFAULT CURRENT_TIMESTAMP` basis data.
 *
 * MySQL mengisi bawaan itu dari jam sesi basis datanya; pada mesin WIB ia menyimpan jam dinding
 * setempat, sedangkan `listSnapshotAt` ditulis dari JS sebagai instan UTC. Kekeliruan itu terlihat
 * pada peragaan 10 September 2026: panel riwayat memperlihatkan penyaringan tujuh jam di masa depan.
 */
describe("waktu penyaringan", () => {
  it("screenedAt ditulis penulisnya, sekesepakatan dengan listSnapshotAt", async () => {
    const importedAt = new Date("2026-09-10T16:24:20Z");
    const { inserted } = mockDb({ sanctions_watchlist_entries: [entriDaftar({ importedAt })] });

    const sebelum = Date.now();
    await screenCustomer({ customerId: 7, fullName: "BUDI SANTOSO WIJAYA", trigger: "NASABAH_DIBUAT", screenedByUserId: 3 });

    const nilai = inserted.find((row) => row.table === penyaringan)!.values;
    expect(nilai.screenedAt).toBeInstanceOf(Date);
    expect((nilai.screenedAt as Date).getTime()).toBeGreaterThanOrEqual(sebelum);
    expect((nilai.listSnapshotAt as Date).toISOString()).toBe(importedAt.toISOString());
  });

  it("seluruh baris penyaringan ulang massal memakai satu waktu yang sama", async () => {
    const { inserted } = mockDb({
      sanctions_watchlist_entries: [entriDaftar()],
      customers: [
        { id: 1, fullName: "Nasabah Satu", isDemo: false, isHistorical: false },
        { id: 2, fullName: "Nasabah Dua", isDemo: false, isHistorical: false },
      ],
    });
    const { rescreenAllCustomers } = await import("./customerWatchlistScreening");

    await rescreenAllCustomers();

    // Basis data palsu mencatat satu panggilan `values` berisi larik; ambil barisnya apa adanya.
    const baris = inserted.filter((row) => row.table === penyaringan);
    const waktu = baris.flatMap((row) => (Array.isArray(row.values) ? row.values : [row.values])).map((row: any) => (row.screenedAt as Date).getTime());
    expect(new Set(waktu).size).toBe(1);
  });
});
