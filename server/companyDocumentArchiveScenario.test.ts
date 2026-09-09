import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import * as operations from "./operations";
import {
  addCompanyDocumentVersion,
  companyArchiveWorklist,
  createCompanyDocument,
  deactivateCompanyDocument,
  listCompanyArchiveDocuments,
  listCompanyArchiveVersions,
} from "./companyDocumentArchive";

/**
 * Skenario arsip dokumen menyeluruh, dari data karangan.
 *
 * Basis data palsu di sini menyimpan baris sungguhan dan menyaring `where`, sehingga urutan
 * peristiwanya benar-benar berjalan dari satu langkah ke langkah berikutnya alih-alih diperiksa
 * satu per satu dalam keadaan yang dipasang sendiri.
 */

const HARI_INI = new Date("2026-09-08T05:00:00.000Z"); // 12:00 WIB
const tanggal = (year: number, month: number, day: number) => new Date(year, month - 1, day);
const actor = { id: 3 };

type Row = Record<string, unknown>;

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

/** Pasangan kolom-nilai pada klausa Drizzle; StringChunk pemisah disisihkan lewat Array.isArray. */
function boundPairs(clause: unknown): Record<string, unknown> {
  const pairs: Record<string, unknown> = {};
  let lastColumn: string | null = null;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const candidate = node as { name?: unknown; value?: unknown; queryChunks?: unknown[]; columnType?: unknown };
    if (typeof candidate.name === "string" && candidate.columnType) lastColumn = candidate.name;
    else if (lastColumn && "value" in candidate && !Array.isArray(candidate.value)) { pairs[lastColumn] = candidate.value; lastColumn = null; }
    if (Array.isArray(candidate.queryChunks)) candidate.queryChunks.forEach(walk);
  };
  walk(clause);
  return pairs;
}

/**
 * Urutan yang benar-benar diterapkan, bukan `orderBy` yang diabaikan.
 *
 * Palsu yang mengembalikan urutan penyisipan akan membuat uji "versi terbaru lebih dulu" lulus
 * karena kebetulan, atau gagal karena kekeliruan palsunya sendiri — keduanya sama-sama tidak
 * mengatakan apa pun tentang query yang sesungguhnya.
 */
function sortRows(rows: Row[], clauses: unknown[]): Row[] {
  const keys = clauses.map((clause) => {
    let column: string | null = null;
    let descending = false;
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const candidate = node as { name?: unknown; columnType?: unknown; value?: unknown; queryChunks?: unknown[] };
      if (typeof candidate.name === "string" && candidate.columnType && !column) column = candidate.name;
      if (Array.isArray(candidate.value) && candidate.value.join("").toLowerCase().includes("desc")) descending = true;
      if (Array.isArray(candidate.queryChunks)) candidate.queryChunks.forEach(walk);
    };
    walk(clause);
    return { column, descending };
  }).filter((key): key is { column: string; descending: boolean } => key.column !== null);

  if (!keys.length) return rows;
  return [...rows].sort((left, right) => {
    for (const { column, descending } of keys) {
      const a = left[column];
      const b = right[column];
      if (a === b) continue;
      const smaller = (a as never) < (b as never) ? -1 : 1;
      return descending ? -smaller : smaller;
    }
    return 0;
  });
}

/**
 * Basis data karangan yang menyimpan baris di memori.
 *
 * Pembacaan arsip menggabungkan `company_documents` dengan versi berjalannya, pegawai, dan berkas —
 * gabungan itu dirakit di sini supaya bentuk barisnya sama dengan yang dikembalikan query
 * sesungguhnya.
 */
function scenarioDb() {
  const tables: Record<string, Row[]> = {
    company_documents: [],
    company_document_versions: [],
    employees: [{ id: 5, fullName: "Sari Kepatuhan" }],
    operational_documents: [1, 2, 3].map((id) => ({
      id, ownerType: "COMPANY_ARCHIVE", documentType: "COMPANY_ARCHIVE_FILE", originalFileName: `berkas-${id}.pdf`,
    })),
  };
  let nextId = 1;

  const joinedRows = () => tables.company_documents.map((doc) => {
    const current = tables.company_document_versions.find((version) => version.companyDocumentId === doc.id && version.supersededAt === null);
    const employee = tables.employees.find((row) => row.id === doc.responsibleEmployeeId);
    const file = current ? tables.operational_documents.find((row) => row.id === current.operationalDocumentId) : undefined;
    return {
      ...doc,
      versionId: current?.id ?? null,
      versionNumber: current?.versionNumber ?? null,
      operationalDocumentId: current?.operationalDocumentId ?? null,
      validFrom: current?.validFrom ?? null,
      validUntil: current?.validUntil ?? null,
      changeReason: current?.changeReason ?? null,
      responsibleName: employee?.fullName ?? null,
      originalFileName: file?.originalFileName ?? null,
    };
  });

  const reader = (rows: Row[]): any => {
    const chain: any = {
      from: (table: unknown) => reader(tableName(table) === "company_documents" ? joinedRows() : tables[tableName(table)] ?? []),
      leftJoin: () => chain,
      innerJoin: () => chain,
      where: (clause: unknown) => {
        const pairs = boundPairs(clause);
        return reader(rows.filter((row) => Object.entries(pairs).every(([key, value]) => !(key in row) || row[key] === value)));
      },
      orderBy: (...clauses: unknown[]) => reader(sortRows(rows, clauses)),
      limit: (count: number) => reader(rows.slice(0, count)),
      then: (ok: any, err: any) => Promise.resolve(rows).then(ok, err),
    };
    return chain;
  };

  const fakeDb: Record<string, unknown> = {
    select: vi.fn(() => reader([])),
    insert: vi.fn((table: unknown) => ({
      values: (values: Row) => {
        const row = { id: nextId++, supersededAt: null, ...values };
        tables[tableName(table)].push(row);
        return { $returningId: () => Promise.resolve([{ id: row.id }]), then: (ok: any) => Promise.resolve(undefined).then(ok) };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Row) => ({
        where: (clause: unknown) => {
          const pairs = boundPairs(clause);
          for (const row of tables[tableName(table)]) {
            const matches = Object.entries(pairs).every(([key, value]) => !(key in row) || row[key] === value);
            // isNull(supersededAt) tidak menghasilkan Param, jadi klausanya tidak terbaca boundPairs;
            // penutupan versi hanya boleh mengenai versi yang masih berjalan.
            if (matches && (!("supersededAt" in values) || row.supersededAt === null)) Object.assign(row, values);
          }
          return Promise.resolve(undefined);
        },
      }),
    })),
    delete: vi.fn(() => { throw new Error("Arsip tidak pernah menghapus baris."); }),
  };
  fakeDb.transaction = vi.fn((run: (tx: unknown) => Promise<unknown>) => run(fakeDb));

  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  vi.spyOn(operations, "writeAudit").mockResolvedValue(undefined as never);
  return tables;
}

describe("skenario arsip dokumen menyeluruh", () => {
  it("berjalan dari unggah pertama sampai penonaktifan tanpa kehilangan satu versi pun", async () => {
    const tables = scenarioDb();

    // 1. SOP diarsipkan, berlaku sampai 20 September 2026.
    const sop = await createCompanyDocument({
      category: "SOP", title: "Prosedur Penerimaan Nasabah", referenceNumber: "SOP-001/IV/2026",
      responsibleEmployeeId: 5, operationalDocumentId: 1,
      validFrom: tanggal(2026, 1, 1), validUntil: tanggal(2026, 9, 20),
    }, actor);

    let daftar = await listCompanyArchiveDocuments({ asOf: HARI_INI });
    expect(daftar.documents[0].currentVersion?.versionNumber).toBe(1);
    expect(daftar.documents[0].responsibleName).toBe("Sari Kepatuhan");

    // 2. Dua belas hari menjelang berakhir, ia muncul di worklist.
    let worklist = await companyArchiveWorklist({ asOf: HARI_INI });
    expect(worklist.map((item) => item.reason)).toEqual(["AKAN_KEDALUWARSA"]);

    // 3. Versi 2 diunggah beserta alasan perubahannya.
    await addCompanyDocumentVersion({
      companyDocumentId: sop.id, operationalDocumentId: 2,
      validFrom: tanggal(2026, 9, 15), validUntil: tanggal(2027, 9, 15),
      changeReason: "Revisi berkala; menyesuaikan ambang EDD terbaru.",
    }, actor);

    // 4. Versi 2 langsung menggantikan pendahulunya walau baru berlaku 15 September, sehingga
    //    hari ini justru TIDAK ADA versi yang berlaku. Ini keadaan yang spec-nya sebut dan yang
    //    memang harus terlihat — bukan cacat, dan bukan pula sesuatu yang boleh disembunyikan di
    //    balik status hijau.
    worklist = await companyArchiveWorklist({ asOf: HARI_INI });
    expect(worklist.map((item) => item.reason)).toEqual(["TIDAK_ADA_VERSI_BERLAKU"]);

    // 5. Begitu 15 September tiba, versi 2 berlaku dan dokumennya bersih dari worklist.
    const limaBelas = new Date("2026-09-15T05:00:00.000Z");
    expect(await companyArchiveWorklist({ asOf: limaBelas })).toHaveLength(0);
    expect((await listCompanyArchiveDocuments({ asOf: limaBelas })).documents[0].validityStatus).toBe("BERLAKU");

    const versions = await listCompanyArchiveVersions(sop.id);
    expect(versions.map((version) => version.versionNumber)).toEqual([2, 1]);
    expect(versions[1].operationalDocumentId).toBe(1);
    expect(versions[1].supersededAt).toBeInstanceOf(Date);
    expect(versions[0].supersededAt).toBeNull();

    // 6. Dinonaktifkan dengan alasan. Barisnya tetap ada; tidak ada DELETE yang dipanggil.
    await deactivateCompanyDocument({ companyDocumentId: sop.id, reason: "Digantikan SOP terbaru." }, actor);

    daftar = await listCompanyArchiveDocuments({ asOf: HARI_INI });
    expect(daftar.documents).toHaveLength(0);
    expect(daftar.deactivated).toHaveLength(1);
    expect(daftar.deactivated[0].deactivationReason).toBe("Digantikan SOP terbaru.");
    expect(tables.company_documents).toHaveLength(1);
    expect(tables.company_document_versions).toHaveLength(2);

    // 7. Riwayat versinya tetap terbaca sesudah dinonaktifkan.
    expect(await listCompanyArchiveVersions(sop.id)).toHaveLength(2);
  });

  it("memperlakukan sisi batas masa berlaku sebagaimana ditetapkan", async () => {
    scenarioDb();

    // Berakhir tepat hari ini: belum kedaluwarsa, tetapi sudah di dalam jendela peringatan.
    const hariIni = await createCompanyDocument({
      category: "SURAT_BI", title: "Surat berakhir hari ini",
      operationalDocumentId: 1, validFrom: tanggal(2026, 1, 1), validUntil: tanggal(2026, 9, 8),
    }, actor);

    // Tanpa tanggal berakhir: tidak pernah masuk worklist, tetapi ikut terhitung.
    await createCompanyDocument({
      category: "NOTULEN_RAPAT", title: "Notulen tanpa masa berlaku",
      operationalDocumentId: 2, validFrom: tanggal(2026, 8, 1), validUntil: null,
    }, actor);

    // Berlaku mulai kemudian: tidak ada versi yang berlaku hari ini.
    await createCompanyDocument({
      category: "KORESPONDENSI_REGULATOR", title: "Korespondensi bertanggal maju",
      operationalDocumentId: 3, validFrom: tanggal(2026, 10, 1), validUntil: null,
    }, actor);

    const daftar = await listCompanyArchiveDocuments({ asOf: HARI_INI });
    const status = Object.fromEntries(daftar.documents.map((doc) => [doc.title, doc.validityStatus]));
    expect(status["Surat berakhir hari ini"]).toBe("AKAN_KEDALUWARSA");
    expect(status["Notulen tanpa masa berlaku"]).toBe("BERLAKU");
    expect(status["Korespondensi bertanggal maju"]).toBe("BELUM_BERLAKU");
    expect(daftar.withoutExpiryCount).toBe(2);

    const worklist = await companyArchiveWorklist({ asOf: HARI_INI });
    expect(worklist.map((item) => item.title)).toEqual(["Korespondensi bertanggal maju", "Surat berakhir hari ini"]);

    // Sehari sesudahnya, surat itu kedaluwarsa dan naik ke urutan pertama.
    const besok = new Date("2026-09-09T05:00:00.000Z");
    const worklistBesok = await companyArchiveWorklist({ asOf: besok });
    expect(worklistBesok[0]).toMatchObject({ id: hariIni.id, reason: "KEDALUWARSA" });
  });
});
