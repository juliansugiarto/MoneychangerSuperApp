import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { createCustomer, updateCustomer } from "./operations";
import { customerInput, customerUpdateInput } from "./routers";
import { v1Fixtures } from "./v1Fixtures";

/**
 * Deklarasi profil transaksi pada borang nasabah: bahwa penulisnya sungguh menyimpan ketiganya.
 *
 * Aturan CLAUDE.md "Fitur Harus Punya Sumber Data": kolomnya tidak boleh ada tanpa penulisnya.
 */

const existingCustomer = {
  id: 1, cifNumber: "CIF-0001", fullName: "Nasabah Lama", phoneNumber: "0811", identityType: "KTP" as const, identityNumber: "1234",
  identityExpiryDate: null, placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), gender: "MALE" as const, nationality: "ID",
  address: "Jl. Lama", addressType: "RUMAH" as const, addressCountry: "ID", addressProvince: null, addressCity: "Jakarta",
  addressDistrict: null, addressPostalCode: null, npwp: null, occupation: "Pegawai",
  sourceOfFunds: "Gaji", transactionPurpose: "Liburan", profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const, riskNotes: null,
  pepStatus: "NONE" as const, pepDetails: null, dttotPpsdmMatch: false, dttotPpsdmNotes: null, isDemo: false, isHistorical: false,
  declaredMonthlyValueIdr: null, declaredMonthlyCount: null, declaredCurrencies: null,
};

const knownCurrencies = [
  { id: 1, code: "USD", name: "Dolar Amerika Serikat", active: true },
  { id: 2, code: "SGD", name: "Dolar Singapura", active: true },
];

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    limit: () => makeReader(rows),
    orderBy: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

/**
 * Basis data palsu yang mencatat apa yang ditulis.
 *
 * `select` mengembalikan baris menurut tabel yang diminta, sehingga pemeriksaan mata uang membaca
 * daftar mata uang dan pembacaan nasabah membaca barisnya sendiri.
 */
function mockDb() {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const reader = (table: unknown) => {
    const name = String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
    return makeReader(name === "currencies" ? knownCurrencies : [existingCustomer]);
  };
  const fakeDb: Record<string, unknown> = {
    select: vi.fn(() => ({ from: (table: unknown) => reader(table) })),
    insert: vi.fn(() => ({ values: (values: Record<string, unknown>) => { inserted.push(values); return Promise.resolve(undefined); } })),
    update: vi.fn(() => ({ set: (values: Record<string, unknown>) => { updated.push(values); return { where: () => Promise.resolve(undefined) }; } })),
  };
  fakeDb.transaction = vi.fn((run: (tx: unknown) => Promise<unknown>) => run(fakeDb));
  const getDb = vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { getDb, inserted, updated };
}

const createInput = {
  ...v1Fixtures.customer,
  declaredMonthlyValueIdr: "25000000.00",
  declaredMonthlyCount: 4,
  declaredCurrencies: ["USD", "SGD"],
};

const updateBase = {
  customerId: 1, fullName: "Nasabah Lama", phoneNumber: "081100000000", identityType: "KTP" as const, identityNumber: "1234",
  placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), gender: "MALE" as const, nationality: "ID",
  address: "Jl. Lama Nomor 1", addressType: "RUMAH" as const, addressCountry: "ID", addressCity: "Jakarta",
  occupation: "Pegawai", sourceOfFunds: "Gaji", transactionPurpose: "Liburan",
  profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const, pepStatus: "NONE" as const, dttotPpsdmMatch: false,
  changeReason: "nasabah mengkinikan perkiraan aktivitasnya",
};

describe("skema deklarasi profil transaksi", () => {
  it("menerima nilai desimal non-negatif, frekuensi bilangan bulat, dan kode mata uang", () => {
    const parsed = customerInput.parse(createInput);
    expect(parsed.declaredMonthlyValueIdr).toBe("25000000.00");
    expect(parsed.declaredMonthlyCount).toBe(4);
    expect(parsed.declaredCurrencies).toEqual(["USD", "SGD"]);
  });

  it("menolak nilai negatif dan frekuensi pecahan", () => {
    expect(customerInput.safeParse({ ...createInput, declaredMonthlyValueIdr: "-1" }).success).toBe(false);
    expect(customerInput.safeParse({ ...createInput, declaredMonthlyCount: 2.5 }).success).toBe(false);
    expect(customerInput.safeParse({ ...createInput, declaredMonthlyCount: -1 }).success).toBe(false);
  });

  it("menolak kode mata uang yang bukan tiga huruf dan menyeragamkannya menjadi huruf besar", () => {
    expect(customerInput.safeParse({ ...createInput, declaredCurrencies: ["DOLAR"] }).success).toBe(false);
    expect(customerInput.parse({ ...createInput, declaredCurrencies: ["usd"] }).declaredCurrencies).toEqual(["USD"]);
  });

  it("membiarkan ketiganya kosong — nasabah lama belum pernah ditanya", () => {
    const { declaredMonthlyValueIdr: _v, declaredMonthlyCount: _c, declaredCurrencies: _k, ...tanpaDeklarasi } = createInput;
    expect(customerInput.safeParse(tanpaDeklarasi).success).toBe(true);
    expect(customerUpdateInput.safeParse(updateBase).success).toBe(true);
  });
});

describe("penulis deklarasi profil transaksi", () => {
  it("createCustomer menyimpan ketiga nilainya", async () => {
    const { getDb, inserted } = mockDb();
    await createCustomer(createInput, 7);
    const customerRow = inserted.find((row) => row.cifNumber === "TEST-CIF-0001");
    expect(customerRow).toMatchObject({
      declaredMonthlyValueIdr: "25000000.00",
      declaredMonthlyCount: 4,
      declaredCurrencies: ["USD", "SGD"],
    });
    getDb.mockRestore();
  });

  it("createCustomer menolak kode mata uang yang tidak ada pada tabel mata uang", async () => {
    const { getDb } = mockDb();
    await expect(createCustomer({ ...createInput, declaredCurrencies: ["USD", "XXX"] }, 7)).rejects.toThrow(/XXX/);
    getDb.mockRestore();
  });

  it("createCustomer menyimpan null ketika nasabah belum berdeklarasi", async () => {
    const { getDb, inserted } = mockDb();
    const { declaredMonthlyValueIdr: _v, declaredMonthlyCount: _c, declaredCurrencies: _k, ...tanpaDeklarasi } = createInput;
    await createCustomer(tanpaDeklarasi, 7);
    const customerRow = inserted.find((row) => row.cifNumber === "TEST-CIF-0001");
    expect(customerRow).toMatchObject({
      declaredMonthlyValueIdr: null,
      declaredMonthlyCount: null,
      declaredCurrencies: null,
    });
    getDb.mockRestore();
  });

  it("updateCustomer mengubah deklarasinya dan mencatat perubahannya pada audit", async () => {
    const { getDb, updated, inserted } = mockDb();
    await updateCustomer(
      { ...updateBase, declaredMonthlyValueIdr: "50000000.00", declaredMonthlyCount: 8, declaredCurrencies: ["USD"] },
      { id: 7, role: "ADMIN" },
    );

    expect(updated[0]).toMatchObject({
      declaredMonthlyValueIdr: "50000000.00",
      declaredMonthlyCount: 8,
      declaredCurrencies: ["USD"],
    });

    const audit = inserted.find((row) => row.action === "CUSTOMER_UPDATED");
    expect(audit).toBeTruthy();
    expect(audit?.beforeState).toMatchObject({ declaredMonthlyValueIdr: null, declaredMonthlyCount: null, declaredCurrencies: null });
    expect(audit?.afterState).toMatchObject({ declaredMonthlyValueIdr: "50000000.00", declaredMonthlyCount: 8, declaredCurrencies: ["USD"] });
    getDb.mockRestore();
  });

  /**
   * Deklarasi yang tidak dikirim berarti dikosongkan, bukan dibiarkan.
   *
   * Itu disengaja — hanya begitulah nasabah dapat menarik pernyataannya, sebab borang mengirim
   * `undefined` untuk isian yang dikosongkan. Konsekuensinya mengikat borang penyuntingan:
   * `client/src/pages/CustomerList.tsx` **wajib** selalu mengirimkan ketiganya, kalau tidak
   * menyunting nomor telepon akan menghapus deklarasi nasabah tanpa siapa pun menyadarinya.
   */
  it("updateCustomer mengosongkan deklarasi ketika ketiganya tidak dikirim", async () => {
    const { getDb, updated } = mockDb();
    await updateCustomer(updateBase, { id: 7, role: "ADMIN" });
    expect(updated[0]).toMatchObject({ declaredMonthlyValueIdr: null, declaredMonthlyCount: null, declaredCurrencies: null });
    getDb.mockRestore();
  });
});
